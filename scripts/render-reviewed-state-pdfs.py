#!/usr/bin/env python3
"""Batch reproducible header review for cached official state PDFs.

Uses reviewed source keys and rotation settings. Output images are review aids,
not automatically imported facts. Each image has its page-transform manifest.
Run with Pillow in the Python environment and pdftoppm on PATH.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',action='append',help='Manifest source key; repeat to select documents. Defaults to all.')
p.add_argument('--cache',type=Path,default=ROOT/'.firecrawl/state-history')
p.add_argument('--output',type=Path,default=ROOT/'.firecrawl/state-history/review-images')
p.add_argument('--scale',type=int,default=3000)
a=p.parse_args()
layouts=json.loads((ROOT/'src/data/history/state-pdf-review-layouts.json').read_text())
manifest=json.loads((ROOT/'src/data/history/reviewed-state-rosters.json').read_text())
if a.source:
 assert set(a.source)<=set(manifest['sources']),'Unknown source key'
for layout in layouts:
 key=layout['sourceDocument']
 if a.source and key not in a.source:continue
 source=manifest['sources'][key]
 pdf=a.cache/layout['pdf']
 if not pdf.exists():raise SystemExit(f'Missing cached source PDF: {pdf}')
 # Render each reviewed page individually, avoiding an unreadably tall montage.
 for page in source['sourcePages']:
  output=a.output/f'{key}-page-{page}.png'
  subprocess.run([sys.executable,str(ROOT/'scripts/render-canvass-review.py'),str(pdf),str(output),'--rotate',str(layout['rotation']),'--bottom','.55','--scale',str(a.scale),'--pages',str(page)],check=True)
