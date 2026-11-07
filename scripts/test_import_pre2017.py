"""Regression checks for historical roster parsing and integration (no network)."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('pre2017', Path(__file__).with_name('import-pre2017-candidates.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HistoricalImportTests(unittest.TestCase):
    def test_measures_and_unnamed_writeins_cannot_become_people(self):
        text = '''SOUTH SALT LAKE CITY COUNCIL DISTRICT 5
L. SHANE SIWIK               185    52.26%
JILL L. COIL                 169    47.74%
Write-in Votes                0     0.00%
SOUTH SALT LAKE SPECIAL BOND ELECTION
AGAINST THE ISSUANCE OF BONDS  1188    51.41%
FOR THE ISSUANCE OF BONDS      1123    48.59%
TAYLORSVILLE CITY COUNCIL DISTRICT 1
ERNEST BURGESS               576    49.83%
'''
        rows = module.municipal_records('2015-general', text)
        self.assertEqual([r['name'] for r in rows], ['L. Shane Siwik', 'Jill L. Coil', 'Ernest Burgess'])
        self.assertEqual(rows[-1]['city'], 'Taylorsville')
        self.assertEqual(rows[-1]['office'], 'Taylorsville Council District 1')

    def test_tickets_and_office_normalization(self):
        row = module.record('2016-general', 'Donald J. Trump, Michael R. Pence', 'U.S. President & Vice President - Write-in Candidates', 'Republican')
        self.assertEqual(row['name'], 'Donald J. Trump')
        self.assertEqual(row['runningMate'], 'Michael R. Pence')
        self.assertEqual(row['office'], 'U.S. President & Vice President')
        self.assertEqual(module.office_name('State House 75'), 'State House District 75')

    def test_published_archive(self):
        rows = json.loads((module.ROOT / 'src/data/historical-candidates.json').read_text())
        old = [r for r in rows if 2013 <= r['year'] < 2017]
        self.assertEqual(len(old), 826)
        identities = [(r['year'], r['id'], r['office'], r['party']) for r in old]
        self.assertEqual(len(identities), len(set(identities)))
        for row in old:
            self.assertIn(row['source'], module.SOURCES.values())
            self.assertNotRegex(row['name'].lower(), r'^(for |against |write-in votes|total|county$)')
            self.assertIn(row['status'], {'primary_election', 'general_election'})
            if row['year'] % 2:
                self.assertEqual(row['county'], 'Salt Lake')
                self.assertIn(row['city'], module.CITIES)
        # A known general appearance supersedes its primary without losing the ticket.
        herbert = [r for r in old if r['year'] == 2016 and r['name'] == 'Gary R. Herbert']
        self.assertEqual(len(herbert), 1)
        self.assertEqual(herbert[0]['electionType'], 'general')
        self.assertEqual(herbert[0]['runningMate'], 'Spencer J. Cox')
        for year in (2014, 2016):
            self.assertEqual(len({r['office'] for r in old if r['year'] == year and r['section'] == 'State House'}), 75)


if __name__ == '__main__': unittest.main()
