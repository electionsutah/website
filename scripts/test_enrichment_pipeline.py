import unittest
from unittest.mock import patch
import tempfile
from pathlib import Path
import hashlib
import json
from datetime import datetime, timedelta, timezone
from enrichment_pipeline import canonical, account, Page, identity, discover, Fetcher

class Controls(unittest.TestCase):
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
