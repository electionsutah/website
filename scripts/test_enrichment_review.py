import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from enrichment_console import color
from enrichment_review import snapshot_date, interactive_review, digest, confirm_discovery

ROOT=Path(__file__).resolve().parents[1]

class ReviewControls(unittest.TestCase):
    def test_terminal_colors_respect_no_color_and_redirection(self):
        import os
        from unittest.mock import Mock
        terminal=Mock();terminal.isatty.return_value=True
        pipe=Mock();pipe.isatty.return_value=False
        with patch.dict(os.environ,{'TERM':'xterm'},clear=True):
            self.assertIn('\033[',color('Review','step',terminal))
            self.assertEqual(color('Review','step',pipe),'Review')
        with patch.dict(os.environ,{'NO_COLOR':''},clear=True):
            self.assertEqual(color('Review','step',terminal),'Review')

    def test_override_discovery_requires_a_prompt(self):
        seeds={'seeds':[{'name':'Person','manualOverride':True,'editorialOverride':{'links':[]}}]}
        with patch('builtins.input',return_value=''):
            self.assertFalse(confirm_discovery(seeds))
        with patch('builtins.input',return_value='y'):
            self.assertTrue(confirm_discovery(seeds))
        self.assertTrue(seeds['seeds'][0]['interactiveDiscovery'])

    def test_empty_run_offers_retry_instead_of_an_empty_review(self):
        with tempfile.TemporaryDirectory() as directory:
            run=Path(directory)/'run.json';run.write_text(json.dumps({'people':[{'name':'Person','id':'person','status':'blocked','candidates':[]}]}))
            with patch('enrichment_review.sys.stdin.isatty',return_value=True),patch('builtins.input',return_value='q') as prompt,patch('enrichment_review.helper') as helper:
                interactive_review(run)
                self.assertIn('retry',prompt.call_args.args[0].lower().replace('[r]etry','retry'))
                helper.assert_not_called()

    def test_snapshot_dates(self):
        self.assertEqual(snapshot_date('https://web.archive.org/web/20250118224934id_/https://example.com/'),'2025-01-18')
        self.assertIsNone(snapshot_date('https://example.com/20250118/'))
        self.assertIsNone(snapshot_date('https://web.archive.org/web/20259999/https://example.com/'))

    def test_review_requires_terminal(self):
        with patch('enrichment_review.sys.stdin.isatty',return_value=False):
            with self.assertRaisesRegex(ValueError,'requires a terminal'): interactive_review('/not/read')

    def test_historical_confirmation_is_required_and_cancellation_never_applies(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'reports').mkdir()
            run=root/'run.json'
            run.write_text(json.dumps({'people':[{'id':'person','kind':'people','name':'Person','entityUrl':'https://www.electionsutah.org/people/person/','historical':True,'candidates':[{'url':'https://x.com/person','platform':'x','sourceUrl':'https://web.archive.org/web/20250118224934/https://example.com/'}]}]}))
            with patch('enrichment_review.ROOT',root),patch('enrichment_review.sys.stdin.isatty',return_value=True),patch('builtins.input',side_effect=['a','Exact historical identity verified','']),patch('enrichment_review.helper') as helper:
                interactive_review(run)
                helper.assert_not_called()
            manifest=json.loads(next((root/'reports').glob('*.json')).read_text())
            self.assertEqual(manifest['people'][0]['decisions'][0]['decision'],'hold')

    def test_isolated_historical_plan_apply_and_rollback(self):
        # Exercise the real writer and resolver against a disposable repository copy.
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            shutil.copytree(ROOT/'src',root/'src')
            (root/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
            (root/'scripts').mkdir()
            for name in ['apply-interactive-enrichment.mjs','enrichment_pipeline.py','enrichment_console.py']:
                shutil.copy(ROOT/'scripts'/name,root/'scripts'/name)
            # Isolate the validation runner too; prove failure restores the exact bytes.
            (root/'package.json').write_text(json.dumps({'type':'module','scripts':{'check:links':'node -e "process.exit(1)"'}}))
            run={'people':[{'id':'john-frugal-dougall','kind':'people','name':'John Dougall','historical':True,
                 'existingLinks':[],'entityUrl':'https://www.electionsutah.org/people/john-frugal-dougall/',
                 'candidates':[{'url':'https://x.com/VoteFrugal','platform':'x','entityId':'john-frugal-dougall',
                 'sourceUrl':'https://web.archive.org/web/20250118224934/https://www.votefrugal.com/',
                 'fetchedAt':'2026-11-11T15:47:42Z','primaryIdentityMatched':False}]}]}
            # Remove overrides for this fixture's person only.
            override=root/'src/data/editor-overrides.json';saved=json.loads(override.read_text());saved['people'].pop('john-frugal-dougall',None);override.write_text(json.dumps(saved))
            run_path=root/'run.json';run_path.write_text(json.dumps(run))
            review={'runSource':str(run_path),'runHash':digest(run_path.read_bytes()),'people':[{'id':'john-frugal-dougall','decisions':[{'candidate':run['people'][0]['candidates'][0],'decision':'approve','historical':True,'ownershipEvidence':'Fixture reviewer confirms exact historical identity and endorsement.'}]}]}
            review_path=root/'review.json';review_path.write_text(json.dumps(review))
            plan=root/'plan.json'
            def call(mode,token=None,path=plan):
                args=['node','scripts/apply-interactive-enrichment.mjs',mode,str(review_path),str(path)]
                if token:args.append(token)
                return subprocess.run(args,cwd=root,text=True,capture_output=True)
            before=(root/'src/data/person-link-enrichment.json').read_bytes()
            result=call('plan');self.assertEqual(result.returncode,0,result.stderr)
            proposal=json.loads(result.stdout)
            self.assertEqual(proposal['changes'][0]['link']['disposition'],'historical')
            self.assertEqual(proposal['changes'][0]['link']['snapshotDate'],'2025-01-18')
            self.assertEqual((root/'src/data/person-link-enrichment.json').read_bytes(),before)
            bad=call('apply','wrong');self.assertNotEqual(bad.returncode,0)
            target=root/'src/data/person-link-enrichment.json'
            target.write_bytes(before+b' ')
            stale=call('apply',proposal['fingerprint']);self.assertNotEqual(stale.returncode,0)
            self.assertIn('changed',stale.stderr)
            target.write_bytes(before)
            failed=call('apply',proposal['fingerprint']);self.assertNotEqual(failed.returncode,0)
            self.assertEqual((root/'src/data/person-link-enrichment.json').read_bytes(),before)
            audit=root/'plan-application.json';self.assertEqual(json.loads(audit.read_text())['status'],'rolled_back')
            # A fresh plan can apply after passing validation; the original audit is immutable.
            (root/'package.json').write_text(json.dumps({'type':'module','scripts':{'check:links':'node -e "process.exit(0)"'}}))
            plan2=root/'plan2.json';prepared=call('plan',path=plan2);self.assertEqual(prepared.returncode,0,prepared.stderr)
            fingerprint=json.loads(prepared.stdout)['fingerprint']
            applied=call('apply',fingerprint,path=plan2);self.assertEqual(applied.returncode,0,applied.stderr)
            entry=json.loads((root/'src/data/person-link-enrichment.json').read_text())['john-frugal-dougall']
            self.assertEqual(entry['links'][-1]['disposition'],'historical')
            self.assertEqual(entry['links'][-1]['source'],run['people'][0]['candidates'][0]['sourceUrl'])
            shutil.copy(ROOT/'scripts/check-person-links.mjs',root/'scripts/check-person-links.mjs')
            actual_check=subprocess.run(['node','scripts/check-person-links.mjs'],cwd=root,text=True,capture_output=True)
            self.assertEqual(actual_check.returncode,0,actual_check.stderr)
            self.assertNotEqual(call('apply',fingerprint,path=plan2).returncode,0)
            self.assertEqual(json.loads(audit.read_text())['status'],'rolled_back')
            # Review additions to a real editorial override without touching its other fields.
            current_override=json.loads(override.read_text())
            old={'lastVerified':'2026-11-11','links':[{'url':'https://www.facebook.com/votefrugal','platform':'facebook'}]}
            current_override['people']['john-frugal-dougall']=old
            override.write_text(json.dumps(current_override))
            shutil.copy(ROOT/'scripts/prepare-entity-enrichment.mjs',root/'scripts/prepare-entity-enrichment.mjs')
            resolved=subprocess.run(['node','scripts/prepare-entity-enrichment.mjs','people/john-frugal-dougall'],cwd=root,text=True,capture_output=True)
            self.assertEqual(resolved.returncode,0,resolved.stderr)
            original=json.loads(resolved.stdout)['seeds'][0]
            original['candidates']=[run['people'][0]['candidates'][0]]
            run_path.write_text(json.dumps({'people':[original]}))
            review['runHash']=digest(run_path.read_bytes())
            review_path.write_text(json.dumps(review))
            plan3=root/'plan3.json'
            refused=call('plan',path=plan3);self.assertNotEqual(refused.returncode,0)
            review['people'][0]['overrideAction']='append';review_path.write_text(json.dumps(review))
            prepared=call('plan',path=plan3);self.assertEqual(prepared.returncode,0,prepared.stderr)
            fingerprint=json.loads(prepared.stdout)['fingerprint']
            applied=call('apply',fingerprint,path=plan3);self.assertEqual(applied.returncode,0,applied.stderr)
            changed=json.loads(override.read_text())['people']['john-frugal-dougall']
            self.assertEqual(changed['lastVerified'],old['lastVerified'])
            self.assertEqual(changed['links'][0],old['links'][0])
            self.assertEqual(changed['links'][-1]['disposition'],'historical')

if __name__=='__main__':unittest.main()
