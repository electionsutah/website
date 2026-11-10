"""Shared result contract: preserve listed options, distinguish missing from zero,
validate independently published totals, and replace outputs only after validation.
No winner is inferred from rank, age of an election, or certification.
"""
import json
import math
from pathlib import Path


def validate_contest(contest):
    options = contest['options']
    assert contest['source'] and contest['name'] and options, contest
    assert len({o['id'] for o in options}) == len(options), contest['id']
    for option in options:
        assert option['name'], contest['id']
        votes = option['votes']
        assert votes is None or (type(votes) in (int,float) and math.isfinite(votes) and votes >= 0), (contest['id'], option)
    total = contest['total']
    assert total is None or (type(total) in (int,float) and math.isfinite(total) and total >= 0), contest['id']
    complete = all(o['votes'] is not None for o in options)
    contest['votesPublished'] = complete and total is not None
    if complete and total is not None:
        contest['optionTotalsReconcile'] = abs(sum(o['votes'] for o in options)-total)<0.000001
    for county in contest.get('counties', []):
        assert sum(o['votes'] for o in county['options']) == county['total'], contest['id']
    if contest.get('counties'):
        contest['countyTotalsReconcile'] = complete and all(
            sum(next((o['votes'] for o in county['options'] if o['id'] == option['id']), 0) for county in contest['counties']) == option['votes']
            for option in options)
    return contest


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(path)
