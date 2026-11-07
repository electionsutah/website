"""Offline integrity checks for the 1994–2012 backfill."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('early', Path(__file__).with_name('import-1994-2012-candidates.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EarlierRosterTests(unittest.TestCase):
    def test_ballot_suffixes_and_embedded_nicknames(self):
        self.assertEqual(module.ballot_name('Ross C. "Rocky" Anderson (J)'), ('Ross C. "Rocky" Anderson', 'Justice'))
        self.assertEqual(module.ballot_name('Mike Lee "R"'), ('Mike Lee', 'Republican'))
        self.assertEqual(module.ballot_name('Loy Brunson (Write-In)'), ('Loy Brunson', ''))
        with self.assertRaises(ValueError): module.ballot_name('Candidate (UNRECOGNIZED)')

    def test_abbreviated_municipal_headers_reset_and_merge(self):
        module.base.SOURCES.update(module.SOURCES)
        module.base.DATES.update(module.DATES)
        text = '''ALTA COUNCIL AT LRG 4Yr   NP
STEVEN GILMAN                  94    45.85%
Write-in Votes                  2     0.98%
SOUTH SL CITY CNCL @ LRG   NP
MIKE RUTTER                  1150    50.35%
SOUTH SL CITY COUNCIL 1 NP
COREY THOMAS                  100    50.00%
ALTA CANYON RECREATION
ANNE T. BARR                   100    50.00%
SCHOOL DIST QUESTION 1
YES                            100    50.00%
NO                             100    50.00%
SOUTH SALT LAKE SPECIAL BOND ELECTION
FOR THE ISSUANCE OF BONDS      100    50.00%
'''
        rows = module.municipal_records('2007-general', text)
        self.assertEqual([r['office'] for r in rows], ['Alta Council at Large', 'South Salt Lake Council at Large', 'South Salt Lake Council District 1'])
        self.assertEqual(len(rows), 3)

    def test_wrapped_headers_keep_correct_city_and_term(self):
        module.base.SOURCES.update(module.SOURCES)
        module.base.DATES.update(module.DATES)
        text = """SLC COUNCIL 02
FOR COUNCIL
MEMBER DIST #2 4 YEAR
ROBERT ARCHULETA          100  50.00%
TAYLORSVILLE AT-
LARGE
FOR COUNCIL
MEMBER AT-LARGE 4YR-VOTE FOR 03
JIM DUNNIGAN             100  50.00%
MURRAY COUNCIL
#2
FOR COUNCIL
MEMBER DIST #2 2 YEAR
REN SOUZA                100  50.00%
"""
        rows = module.municipal_records('1999-primary', text)
        self.assertEqual([r['office'] for r in rows], ['Salt Lake City Council District 2', 'Taylorsville Council at Large', 'Murray Council District 2 (2-Year Term)'])

    def test_reviewed_pdf_columns_and_existing_coverage(self):
        module.base.SOURCES.update(module.SOURCES)
        module.base.DATES.update(module.DATES)
        reviewed = module.reviewed_records()
        treasurer = [r for r in reviewed['1996-general'] if r['office']=='State Treasurer']
        self.assertEqual({(r['name'],r['party']) for r in treasurer}, {('Edward T. Alter','Republican'), ("D'Arcy D. Pignanelli",'Democratic'), ('Hugh A. Butler','Libertarian')})
        nolan = next(r for r in reviewed['2006-general'] if r['name']=='C. Dane Nolan')
        self.assertEqual(nolan['office'], 'Judge of the Third District Juvenile Court')
        self.assertEqual(nolan['sourceStatus'], 'Judicial Retention Candidate')
        for rows in reviewed.values():
            self.assertTrue(all('#page=' in r['source'] for r in rows))
            self.assertTrue(all(r['runningMate'] != 'Unknown' for r in rows))
        inventory = json.loads((module.ROOT/'reports/historical-backfill-1994-2012.json').read_text())
        older = next(r for r in inventory if r['year']==1995)
        self.assertEqual(older['status'], 'existing_unofficial')
        self.assertEqual(older['existingNewspaperRecords'],1225)

    def test_published_roster_integrity(self):
        archive = json.loads((module.ROOT/'src/data/historical-candidates.json').read_text())
        rows = [r for r in archive if 1994 <= r['year'] <= 2012]
        self.assertEqual(len(rows), 2518)
        keys = [(r['year'],r['id'],r['office'],r['party']) for r in rows]
        self.assertEqual(len(keys),len(set(keys)))
        for r in rows:
            self.assertIn(r['source'].split('#')[0],module.SOURCES.values())
            self.assertNotRegex(r['name'].lower(),r'^(yes$|no$|write-in votes|for |against |total|times counted|precincts reporting)')
            self.assertNotEqual(r['name'],r.get('runningMate'))
            self.assertNotRegex(r['office'],r' NP$| #|Distict|Distrtict')
            if r['year']%2: self.assertEqual(r['county'],'Salt Lake')
        for year in (2008,2010,2012):
            self.assertEqual({r['office'] for r in rows if r['year']==year and r['section']=='State House'},
                             {f'State House District {n}' for n in range(1,76)})
        self.assertTrue(any(r['year']==2012 and r['name']=='Fred Karger' and r['status']=='primary_election' for r in rows))


if __name__=='__main__': unittest.main()
