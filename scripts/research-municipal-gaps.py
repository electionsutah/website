#!/usr/bin/env python3
"""Cache a first-pass official-source search for each municipality in the gap cohort.

Review output manually before adding candidates; a search hit is not a verified filing.
"""
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl/municipal-gaps'
CACHE.mkdir(parents=True, exist_ok=True)
rows = json.loads((ROOT / 'reports/municipal-gap-investigation.json').read_text())['municipalities']
limited = Event()

def research(row):
    if limited.is_set():
        return f'Skipped after quota/rate limit: {row["name"]}'
    output = CACHE / (row['id'].replace('/', '--') + '.json')
    if output.exists():
        return f"Cached: {row['name']}"
    query = f'"{row["name"]}" Utah 2025 municipal election candidates cancellation official'
    result = subprocess.run(['firecrawl', 'search', query, '--scrape', '--limit', '3', '--json', '-o', str(output)], capture_output=True, text=True, timeout=240)
    if any(code in result.stderr for code in ['402', '429']):
        limited.set()
    return f'{row["name"]}: ' + ('saved' if result.returncode == 0 else result.stderr[-300:])

with ThreadPoolExecutor(max_workers=2) as pool:
    for result in pool.map(research, rows):
        print(result, flush=True)
