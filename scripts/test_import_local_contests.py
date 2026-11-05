"""Offline regressions for distinct local contests and named write-ins.

Run with: python3 -m unittest discover -s scripts -p 'test_*.py'
"""
import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('local_contests', Path(__file__).with_name('import-local-contests.py'))
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def option(name, votes=0):
    return {'id': name, 'name': name, 'voteCount': votes}


def contest(identifier, name, candidates, seats=1):
    return {'id': identifier, 'name': name, 'voteFor': f'Vote for {seats}',
            'voteTotal': sum(row['voteCount'] for row in candidates),
            'summaryResults': {'ballotOptions': candidates}}


class LocalImportTests(unittest.TestCase):
    def run_import(self, items, kind='general'):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'candidates.json'
            def fetch(url, cache_name, use_cache):
                if cache_name.startswith('Utah_'):
                    return {'election': {'isOfficialResults': True}, 'jurisdiction': {
                        'childLocalities': [{'shortName': 'sample', 'name': 'Weber County'}]}}
                return {'ballotItems': items}
            with patch.object(importer, 'OUTPUT', output), \
                 patch.object(importer, 'CACHE', Path(directory)), \
                 patch.object(importer, 'ELECTIONS', [('sample', 2025, kind, '2025-11-04')]), \
                 patch.object(importer, 'municipalities', return_value={'Weber': {'Roy', 'Riverdale'}}), \
                 patch.object(importer, 'fetch_json', side_effect=fetch), \
                 patch.object(sys, 'argv', ['import-local-contests.py', '--use-cache']), \
                 contextlib.redirect_stdout(io.StringIO()):
                importer.main()
            return json.loads(output.read_text())

    def test_same_county_separate_seats_survive(self):
        rows = self.run_import([
            contest('regular', 'RIVERDALE CITY COUNCIL AT-LARGE', [option('KENT ANDERSON', 734), option('BART STEVENS', 619)], 2),
            contest('special', 'RIVERDALE CITY COUNCIL AT-LARGE', [option('ANNE K. HANSEN', 1140)]),
        ])
        self.assertEqual({row['name'] for row in rows}, {'Kent Anderson', 'Bart Stevens', 'Anne K. Hansen'})
        self.assertTrue(all(row['status'] == 'elected' for row in rows))

    def test_both_party_primaries_survive(self):
        rows = self.run_import([
            contest('dem', 'COUNTY COUNCIL AT LARGE C (DEM)', [option('DUSTIN GETTEL', 9351)]),
            contest('rep', 'COUNTY COUNCIL AT LARGE C (REP)', [option('MICHAEL CAREY', 42266)]),
        ], kind='primary')
        self.assertEqual({(row['name'], row['party']) for row in rows},
                         {('Dustin Gettel', 'Democratic'), ('Michael Carey', 'Republican')})

    def test_placeholders_do_not_take_seats_and_named_writeins_are_imported(self):
        rows = self.run_import([contest('council', 'ROY CITY COUNCIL', [
            option('YVONNE LARSEN', 68), option('Write-in', 62), option('TAMRA D PRIVETT', 36),
            option('Write-in: Not Assigned', 100), option('Write-in (Invalid)', 100),
            option('Write-in: Not Valid', 100), option('Write-in (Delete)', 100),
            {**option('INVALID', 100), 'isWriteIn': True},
            option('Write-in: MEGAN BAGLEY', 80), option('Write-in - Tim R Barney', 20),
        ], 3)])
        by_name = {row['name']: row for row in rows}
        self.assertEqual(set(by_name), {'Yvonne Larsen', 'Tamra D Privett', 'Megan Bagley', 'Tim R Barney'})
        self.assertEqual(by_name['Tamra D Privett']['status'], 'elected')
        self.assertEqual(by_name['Megan Bagley']['sourceStatus'], 'Elected (Write-in)')
        self.assertEqual(by_name['Tim R Barney']['sourceStatus'], 'Defeated (Write-in)')

    def test_cross_county_dedup_requires_matching_slates_seats_and_parties(self):
        def entry(county, names, total=10, seats=1, party=''):
            return {'election': 'sample', 'office': 'Shared School Board', 'county': county,
                    'total': total, 'seats': seats,
                    'candidates': [{'option': option(name), 'party': party} for name in names]}
        first = entry('Weber', ['ANN', 'BEN'])
        repeated = entry('Davis', ['BEN', 'ANN'], total=20)
        other_slate = entry('Salt Lake', ['ANN', 'CAM'])
        other_seats = entry('Box Elder', ['ANN', 'BEN'], seats=2)
        other_party = entry('Morgan', ['ANN', 'BEN'], party='Republican')
        self.assertEqual(importer.deduplicate_contests([first, repeated, other_slate, other_seats, other_party]),
                         [repeated, other_slate, other_seats, other_party])
        same_county = entry('Weber', ['ANN', 'BEN'], total=30)
        self.assertEqual(importer.deduplicate_contests([first, same_county]), [first, same_county])

    def test_ranked_preferences_keep_existing_representative(self):
        def preference(rank, votes):
            return {'election': 'sample', 'office': 'Roy Council', 'county': 'Weber',
                    'raw': f'Roy Council {rank} Choice', 'total': votes, 'seats': None,
                    'candidates': [{'option': option('ANN'), 'party': ''}]}
        first, second = preference('1st', 20), preference('2nd', 10)
        self.assertEqual(importer.deduplicate_contests([first, second]), [first])

    def test_primary_terms_are_reconciled_per_contest(self):
        def race(kind, office, names):
            return {'year': 2025, 'county': 'Weber', 'kind': kind, 'office': office,
                    'candidates': [{'option': option(name), 'party': ''} for name in names]}
        regular = race('primary', 'Roy Council', ['ANN', 'BEN'])
        short = race('primary', 'Roy Council', ['CAM', 'DAN'])
        general_regular = race('general', 'Roy Council', ['ANN'])
        general_short = race('general', 'Roy Council (2-Year Term)', ['CAM'])
        ambiguous = race('primary', 'Roy Council', ['ANN', 'CAM'])
        importer.reconcile_primary_offices([regular, short, ambiguous, general_regular, general_short])
        self.assertEqual(regular['office'], 'Roy Council')
        self.assertEqual(short['office'], 'Roy Council (2-Year Term)')
        self.assertEqual(ambiguous['office'], 'Roy Council')


if __name__ == '__main__':
    unittest.main()
