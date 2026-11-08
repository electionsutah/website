"""Integrity checks for reviewed scan facts and index year verification."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

rosters=load('reviewed','import-reviewed-state-rosters.py')
audit=load('audit','audit-historical-state-sources.py')


class ReviewedScanTests(unittest.TestCase):
    def setUp(self):
        self.review=json.loads((ROOT/'src/data/history/reviewed-state-rosters.json').read_text())

    def test_joined_1960_has_each_column_once_without_ballot_responses(self):
        rows=[r for r in rosters.normalize(self.review) if r['year']==1960]
        self.assertEqual(len(rows),40)
        self.assertEqual(len({(r['id'],r['office']) for r in rows}),40)
        self.assertEqual({r['year'] for r in rows},{1960})
        self.assertEqual({r['lastUpdated'] for r in rows},{'1960-11-08'})
        district_three=[r for r in rows if r['office']=='District Attorney, Third District']
        self.assertEqual({r['name'] for r in district_three},{'Ramon M. Child','Jay E. Banks'})
        self.assertEqual({r['source'].rsplit('=',1)[1] for r in district_three},{'3','4'})
        judges=[r for r in rows if r['section']=='State Judicial']
        self.assertEqual(len(judges),4)
        self.assertTrue(all(r['sourceStatus']=='General Election Candidate' for r in judges))
        governor=[r for r in rows if r['office']=='Governor']
        self.assertEqual(len(governor),2)
        self.assertTrue(all(not r['runningMate'] for r in governor))
        self.assertTrue(any('Soc.' in r['sourceStatus'] and not r['party'] for r in rows))
        broken=copy.deepcopy(self.review);broken['records'][0]['name']='YES'
        with self.assertRaises(AssertionError):rosters.normalize(broken)

    def test_primary_and_general_records_remain_distinct(self):
        rows=rosters.normalize(self.review)
        bennett=[r for r in rows if r['year']==1962 and r['name']=='Wallace F. Bennett']
        self.assertEqual({r['electionType'] for r in bennett},{'primary','general'})
        merged=rosters.merge([],rows,set())
        self.assertEqual(len(merged),len(rows))

    def test_regeneration_preserves_other_imports(self):
        rows=rosters.normalize(self.review)
        other=copy.deepcopy(rows[0]);other['year']=2026;other['source']='https://example.org/curated';other['contact']['email']='preserved@example.org'
        sources={d['url'] for d in self.review['sources'].values()}
        first=rosters.merge([other],rows,sources)
        second=rosters.merge(first,rows,sources)
        self.assertEqual(first,second)
        self.assertEqual(next(r for r in second if r['year']==2026),other)

    def test_retention_and_contested_judges_are_distinct(self):
        rows=rosters.normalize(self.review)
        tibbs=next(r for r in rows if r['year']==1980 and r['name']=='Don V. Tibbs')
        self.assertIn('Judicial Retention',tibbs['sourceStatus'])
        payton=next(r for r in rows if r['year']==1982 and r['name']=='Steven Lee Payton')
        self.assertNotIn('Retention',payton['sourceStatus'])
        self.assertEqual(tibbs['section'],'State Judicial')

    def test_narrow_office_boundaries_do_not_shift_candidates(self):
        rows=rosters.normalize(self.review)
        wright=next(r for r in rows if r['year']==1980 and r['name']=='Bob Wright')
        self.assertEqual(wright['office'],'Governor')
        for name,district in [('Robert B. Darby',32),('Robert C. Fillerup',34),('Adam A. Jacobs',52),('James J. White',62)]:
            row=next(r for r in rows if r['year']==1980 and r['name']==name)
            self.assertEqual(row['office'],f'State House District {district}')
        clegg=next(r for r in rows if r['year']==1982 and r['name']=='N. Jay Clegg')
        self.assertEqual(clegg['office'],'State Senate District 22')
        self.assertEqual(clegg['party'],'Democratic')

    def test_uncertain_dates_and_withheld_columns_are_not_invented(self):
        rows=rosters.normalize(self.review)
        self.assertTrue(all(not r['lastUpdated'] for r in rows if r['year']==1988 and r['electionType']=='primary'))
        self.assertFalse(any(r['year']==1980 and r['name']=='Lee W. Farnsworth' for r in rows))
        self.assertFalse(any(r['year']==1992 and r['office']=='Governor & Lieutenant Governor' for r in rows))
        self.assertTrue(self.review['sources']['1992-primary']['remainingWork'])

    def test_partial_source_status_survives_import(self):
        url=self.review['sources']['1992-general']['url']
        snapshot={'markdown':f'- [1992 General]({url})'}
        rows=rosters.normalize(self.review)
        report=audit.build_inventory(snapshot,[rows],[],{url:{'documentYear':1992,'remainingWork':['Review remaining pages.']}})
        election=report['elections'][0]
        self.assertGreater(election['recordsUsingLinkedSources'],0)
        self.assertEqual(election['status'],'partially_imported')

    def test_filename_is_not_authoritative_for_document_year(self):
        url='https://vote.utah.gov/wp-content/uploads/2023/09/1960Pri.pdf'
        index={'markdown':f'- [1962 Primary]({url})'}
        pending=audit.build_inventory(index,[],[])['elections'][0]
        self.assertEqual(pending['status'],'year_mismatch')
        verified=audit.build_inventory(index,[],[],{url:{'documentYear':1962}})['elections'][0]
        self.assertEqual(verified['yearLabel'],1962)
        self.assertEqual(verified['status'],'source_not_imported')
        self.assertFalse(verified['sources'][0]['needsYearVerification'])
        self.assertTrue(verified['sources'][0]['filenameYearMismatch'])
        wrong=audit.build_inventory(index,[],[],{url:{'documentYear':1960}})['elections'][0]
        self.assertEqual(wrong['status'],'year_mismatch')

if __name__=='__main__':unittest.main()
