import unittest
import io
from contextlib import redirect_stderr
from unittest.mock import patch
import tempfile
from pathlib import Path
import hashlib
import gzip
import json
from datetime import datetime, timedelta, timezone
from enrichment_pipeline import canonical, account, Page, identity, discover, Fetcher, load_entity, supply_website, print_outcomes, report, challenge_page, outcome_label

class Controls(unittest.TestCase):
    def test_cached_false_block_is_reclassified_without_requests(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);cache=root/'cache';cache.mkdir()
            url='https://example.com/';key=hashlib.sha256(url.encode()).hexdigest()
            (cache/(key+'.body')).write_text('<html><title>Campaign</title><script>{"features":["captcha"]}</script><a href="https://x.com/candidate">X</a></html>')
            (cache/(key+'.json')).write_text(json.dumps({'url':url,'status':'blocked','httpStatus':200,'fetchedAt':'2026-11-01T00:00:00Z','nextReviewAt':'2099-01-01T00:00:00Z'}))
            with patch('enrichment_pipeline.ROOT',root),patch('enrichment_pipeline.subprocess.run',side_effect=AssertionError('network request')):
                fetcher=Fetcher(cache,offline=True);result=fetcher.fetch(url)
            self.assertEqual(result['status'],'verified')
            self.assertEqual(result['fetchedAt'],'2026-11-01T00:00:00Z')
            self.assertTrue((root/result['bodyFile']).exists())
            self.assertEqual(fetcher.stats['requests'],0)

    def test_review_labels_distinguish_accounts_from_override_holds(self):
        record={'status':'ambiguous','candidates':[{'url':'https://x.com/example'}]}
        self.assertEqual(outcome_label(record),'Found accounts — ownership review required')
        self.assertEqual(record['status'],'ambiguous')
        self.assertEqual(outcome_label({'status':'ambiguous','candidates':[]}), 'Manual review required')

    def test_archived_accounts_preserve_archive_evidence(self):
        url='https://web.archive.org/web/20250118224934/https://www.twitter.com/VoteFrugal'
        candidate=account(url)
        self.assertEqual(candidate['url'],'https://x.com/VoteFrugal')
        self.assertEqual(candidate['archivedAccountUrl'],url)
        self.assertIsNone(account('https://web.archive.org/web/20250118224934/https://www.facebook.com/share'))
        self.assertIsNone(account('https://example.com/web/20250118224934/https://x.com/person'))

    def test_captcha_script_feature_is_not_a_challenge(self):
        page='<html><head><title>John &quot;Frugal&quot; Dougall for Congress</title><script>{"siteFeatures":["captcha"]}</script></head><body>John Dougall for Congress</body></html>'
        self.assertFalse(challenge_page(page))

    def test_visible_browser_challenge_is_blocked(self):
        self.assertTrue(challenge_page('<html><body>Verify you are human</body></html>'))
        self.assertTrue(challenge_page('<html><head><title>CAPTCHA verification</title></head></html>'))

    def test_missing_website_queues_discovery_without_fetching(self):
        seed={'id':'jane','name':'Jane Doe','kind':'people','websites':[],
              'sources':['https://example.com/filing.pdf'],'offices':['Mayor']}
        class NoFetch:
            def fetch(self,url): raise AssertionError('Must not fetch without a website')
        record=discover(seed,NoFetch())
        self.assertEqual(record['status'],'not_attempted')
        self.assertEqual(record['websiteDiscovery']['sourceUrls'],seed['sources'])
        self.assertIn('Mayor',record['websiteDiscovery']['suggestedQuery'])
        output=io.StringIO()
        with redirect_stderr(output): print_outcomes({'people':[record]},Path('/tmp/result.json'))
        self.assertIn('No primary website seed',output.getvalue())
        self.assertIn('--website URL',output.getvalue())
        self.assertIn('/tmp/result.html',output.getvalue())

    def test_supplied_website_preserves_recorded_evidence_and_override(self):
        seed={'id':'jane','name':'Jane Doe','websites':['https://old.example.com/'],
              'manualOverride':True,'historical':True,'existingLinks':[{'url':'https://x.com/jane'}]}
        supplied=supply_website({'seeds':[seed]},'https://campaign.example.com/?utm_source=test')['seeds'][0]
        self.assertEqual(supplied['recordedWebsites'],['https://old.example.com/'])
        self.assertEqual(supplied['websites'],['https://campaign.example.com/'])
        self.assertEqual(supplied['websiteInput']['disposition'],'ambiguous')
        self.assertTrue(supplied['historical'])
        self.assertEqual(supplied['existingLinks'],[{'url':'https://x.com/jane'}])
        # Supplying a website cannot bypass an existing editorial override.
        class NoFetch:
            def fetch(self,url): raise AssertionError('Must preserve override')
        result=discover(supplied,NoFetch())
        self.assertEqual(result['status'],'ambiguous')
        self.assertIn('Editorial override',result['reason'])

    def test_supplied_website_rejects_local_and_account_urls(self):
        for url in ('file:///tmp/test.html','http://localhost/','http://127.0.0.1/','https://x.com/jane'):
            with self.assertRaises(ValueError): supply_website({'seeds':[{}]},url)

    def test_entity_selector_preserves_nested_place_id(self):
        with patch('enrichment_pipeline.subprocess.run') as run:
            run.return_value = type('Response', (), {'returncode': 0, 'stdout': '{"seeds": []}'})()
            self.assertEqual(load_entity('places/utah/alpine'), {'seeds': []})
            self.assertEqual(run.call_args.args[0][-1], 'places/utah/alpine')

    def test_entity_selector_rejects_unknown_kind_and_path_traversal(self):
        with patch('enrichment_pipeline.subprocess.run') as run:
            for selector in ('elections/2026', 'people/../secret', 'people/', 'people/foo bar'):
                with self.assertRaises(ValueError): load_entity(selector)
            run.assert_not_called()

    def test_unknown_entity_surfaces_resolver_error(self):
        with patch('enrichment_pipeline.subprocess.run') as run:
            run.return_value = type('Response', (), {'returncode': 1, 'stderr': 'Unknown entity: people/missing'})()
            with self.assertRaisesRegex(ValueError, 'Unknown entity'):
                load_entity('people/missing')

    def test_archived_primary_url_preserves_embedded_scheme(self):
        archived='https://web.archive.org/web/20230903180637id_/https://beckyforutah.com/'
        self.assertEqual(canonical(archived),archived.rstrip('/'))
        self.assertEqual(canonical('https://example.com//about///social/'),'https://example.com/about/social')
    def test_compressed_primary_page_is_parsed(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            def transport(command,**kwargs):
                self.assertIn('--compressed',command)
                Path(command[command.index('-D')+1]).write_text('HTTP/2 200\nContent-Encoding: gzip\n')
                Path(command[command.index('-o')+1]).write_bytes(gzip.compress(b'<html>Jane Doe<a href="https://instagram.com/janedoe">Instagram</a></html>'))
                return type('Response',(),{'returncode':0,'stdout':'200\nhttps://example.com/'})()
            with patch('enrichment_pipeline.ROOT',root),patch('enrichment_pipeline.subprocess.run',side_effect=transport):
                result=Fetcher(root/'cache').fetch('https://example.com/')
            self.assertEqual(result['status'],'verified')
            page=Page((root/result['bodyFile']).read_text())
            self.assertEqual(account(page.links[0][0])['url'],'https://instagram.com/janedoe')
    def test_compressed_page_cannot_exceed_decoded_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            def transport(command,**kwargs):
                Path(command[command.index('-D')+1]).write_text('HTTP/2 200\nContent-Encoding: gzip\n')
                Path(command[command.index('-o')+1]).write_bytes(gzip.compress(b'<html>'+b'x'*3000000+b'</html>'))
                return type('Response',(),{'returncode':0,'stdout':'200\nhttps://example.com/'})()
            with patch('enrichment_pipeline.ROOT',root),patch('enrichment_pipeline.subprocess.run',side_effect=transport):
                result=Fetcher(root/'cache').fetch('https://example.com/')
            self.assertEqual(result['status'],'retrieval_failed')
            self.assertIn('Decoded response exceeds size budget',result['error'])
    def test_negative_cache_prevents_network_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            cache=Path(directory); url='https://example.com/'
            key=hashlib.sha256(url.encode()).hexdigest()
            (cache/(key+'.json')).write_text(json.dumps({'url':url,'status':'blocked','nextReviewAt':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}))
            fetcher=Fetcher(cache)
            with patch('enrichment_pipeline.subprocess.run',side_effect=AssertionError('network retry')):
                self.assertEqual(fetcher.fetch(url)['status'],'blocked')
            self.assertEqual(fetcher.stats['requests'],0)
            self.assertEqual(fetcher.stats['cacheHits'],1)
    def test_conditional_refresh_and_304_preserve_body(self):
        with tempfile.TemporaryDirectory() as directory:
            cache=Path(directory); url='https://example.com/'; key=hashlib.sha256(url.encode()).hexdigest()
            (cache/(key+'.json')).write_text(json.dumps({'url':url,'status':'verified','etag':'test-etag','bodyFile':'saved.html','contentHash':'abc','nextReviewAt':'2000-01-01'}))
            def transport(command,**kwargs):
                self.assertIn('If-None-Match: test-etag',command)
                Path(command[command.index('-D')+1]).write_text('HTTP/2 304\n')
                return type('Response',(),{'returncode':0,'stdout':'304\nhttps://example.com/'})()
            with patch('enrichment_pipeline.subprocess.run',side_effect=transport):
                result=Fetcher(cache,refresh=True).fetch(url)
            self.assertEqual(result['bodyFile'],'saved.html')
            self.assertEqual(result['contentHash'],'abc')
    def test_account_aliases_and_queries(self):
        self.assertEqual(account('http://www.twitter.com/RepName/?utm_source=x#bio')['url'],'https://x.com/RepName')
        self.assertEqual(account('https://facebook.com/profile.php?id=123&ref=x')['url'],'https://facebook.com/profile.php?id=123')
        self.assertNotEqual(account('https://instagram.com/person1'),account('https://instagram.com/person2'))
    def test_reject_non_accounts(self):
        for url in ['javascript:alert(1)','https://user:password@x.com/person','https://x.com/intent/tweet','https://facebook.com/sharer.php','https://facebook.com/photo.php?fbid=123','https://youtube.com/watch?v=abc','https://instagram.com/p/123','https://x.com/person/status/123','https://instagram.com.evil.example/person','https://linkedin.com/feed/','https://facebook.com/groups/123','https://facebook.com/407231955959632_1330551635555119']:
            self.assertIsNone(account(url),url)
        self.assertIsNone(canonical('http://127.0.0.1/'))
    def test_anchor_and_jsonld(self):
        page=Page('<html><h1>Jane Doe for Utah House District 10</h1><a href="https://x.com/janedoe" aria-label="X">Follow</a><script type="application/ld+json">{"@type":"Person","name":"Jane Doe","sameAs":["https://instagram.com/janedoe"]}</script></html>')
        self.assertEqual(len(page.candidates()),2)
        self.assertTrue(identity({'name':'Jane Doe','offices':['Utah House District 10']},page)['nameMatched'])
        self.assertFalse(identity({'name':'John Smith','offices':['Utah House District 10']},page)['nameMatched'])
    def test_historical_and_mislabeled_accounts_stay_out_of_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            body=Path(directory)/'page.html'
            body.write_text('<html><h1>Jane Doe Utah House District 10</h1><a href="https://x.com/janedoe">Threads</a><a href="https://instagram.com/janedoe">Instagram</a></html>')
            class Saved:
                def fetch(self,url):return {'status':'verified','url':url,'finalUrl':url,'bodyFile':str(body),'fetchedAt':'2026-11-10'}
            seed={'id':'jane-doe','name':'Jane Doe','offices':['Utah House District 10'],'websites':['https://example.com/']}
            current=discover(seed,Saved())
            self.assertFalse(current['candidates'][0]['primaryIdentityMatched'])
            self.assertTrue(current['candidates'][1]['primaryIdentityMatched'])
            historical=discover(dict(seed,historical=True),Saved())
            self.assertTrue(all(not c['primaryIdentityMatched'] for c in historical['candidates']))
    def test_followup_page_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            body=Path(directory)/'page.html';body.write_text('<html>Jane Doe<a href="/about">About</a><a href="/contact">Contact</a></html>')
            class Saved:
                def fetch(self,url):return {'status':'verified','url':url,'finalUrl':url,'bodyFile':str(body),'fetchedAt':'2026-11-10'}
            seed={'id':'jane-doe','name':'Jane Doe','offices':[],'websites':['https://example.com/']}
            result=discover(seed,Saved(),2)
            self.assertEqual(len(result['fetches']),2)
    def test_editorial_override_never_fetches(self):
        class NoFetch:
            def fetch(self,url): raise AssertionError('must preserve override')
        result=discover({'id':'test','manualOverride':True},NoFetch())
        self.assertEqual(result['status'],'ambiguous')
        self.assertEqual(result['fetches'],[])
    def test_failure_does_not_change_existing(self):
        class Failed:
            def fetch(self,url): return {'status':'retrieval_failed','url':url}
        seed={'id':'test','websites':['https://example.com'],'existingLinks':[{'url':'https://x.com/known'}]}
        result=discover(seed,Failed())
        self.assertEqual(result['existingLinks'],seed['existingLinks'])
        self.assertEqual(result['status'],'retrieval_failed')

if __name__=='__main__':unittest.main()
