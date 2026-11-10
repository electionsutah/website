"""Offline checks of source completeness and vote semantics for the shared pipeline."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from result_contract import validate_contest

spec=importlib.util.spec_from_file_location('all_results',Path(__file__).with_name('import-all-results.py'))
imports=importlib.util.module_from_spec(spec);spec.loader.exec_module(imports)

class ResultContractTests(unittest.TestCase):
    def contest(self):
        return dict(id='race',name='Test race',source='https://example.org/canvass',total=9,options=[dict(id='a',name='Ann',votes=9),dict(id='b',name='Ben',votes=0)],counties=[])

    def test_missing_is_not_zero(self):
        race=self.contest()
        self.assertTrue(validate_contest(race)['votesPublished'])
        race['options'][1]['votes']=None
        self.assertFalse(validate_contest(race)['votesPublished'])
        self.assertIsNone(race['options'][1]['votes'])

    def test_inconsistent_source_totals_are_flagged_and_retained(self):
        race=self.contest();race['total']=10
        validate_contest(race)
        self.assertFalse(race['optionTotalsReconcile'])
        self.assertEqual(race['total'],10)
        self.assertEqual(race['options'][0]['votes'],9)

    def test_invalid_votes_or_duplicate_options_fail(self):
        for value in [-1,True,float('nan'),'3']:
            race=self.contest();race['options'][0]['votes']=value
            with self.assertRaises(AssertionError):validate_contest(race)
        race=self.contest();race['options'][1]['id']='a'
        with self.assertRaises(AssertionError):validate_contest(race)

    def test_all_candidate_columns_and_named_writein_panels_survive(self):
        sheets={'President':{1:{2:'U.S. President & Vice President',4:'U.S. President & Vice President - Write-in Candidates'},3:{1:'County',2:'Ann (DEM)',3:'Ben (REP)',4:'Cara (Write-in)'},4:{1:'Beaver',2:'9',3:'0',4:'0'},33:{1:'TOTAL',2:'9',3:'0',4:'0'}}}
        with patch.object(imports,'read_workbook',return_value=sheets):
            races=imports.parse_workbook(Path('test.xlsx'),'https://example.org/test.xlsx',2018,'general')
        self.assertEqual(len(races),1)
        self.assertEqual([(o['name'],o['votes']) for o in races[0]['options']],[('Ann',9),('Ben',0),('Cara',0)])
        self.assertEqual(races[0]['total'],9)
        self.assertTrue(races[0]['countyTotalsReconcile'])

    def test_party_primaries_stay_separate(self):
        sheets={'Federal':{1:{2:'U.S. Senate',4:'U.S. Senate'},3:{2:'Democratic',4:'Republican'},4:{1:'County',2:'Ann',3:'Ben',4:'Cara'},5:{1:'Beaver',2:'1',3:'2',4:'3'},34:{1:'TOTAL',2:'1',3:'2',4:'3'}}}
        with patch.object(imports,'read_workbook',return_value=sheets):
            races=imports.parse_workbook(Path('test.xlsx'),'https://example.org/test.xlsx',2018,'primary')
        self.assertEqual(len(races),2)
        self.assertEqual({c['party'] for c in races},{'Republican','Democratic'})

    def test_multiple_races_in_one_workbook_are_not_deduplicated_by_url(self):
        first=dict(self.contest(),year=2018,electionType='general',sourceSheet='Sheet',kind='candidate')
        other=dict(copy.deepcopy(first),id='race2',name='Other race')
        self.assertEqual(len(imports.deduplicate([first,other])),2)

if __name__=='__main__':unittest.main()
