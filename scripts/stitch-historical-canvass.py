#!/usr/bin/env python3
"""Join reviewed overlapping scan panels into a single PNG, retaining provenance.

Requires Pillow and Poppler. Example:
uv run --with pillow python scripts/stitch-historical-canvass.py .firecrawl/state-history/1960Gen.pdf
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]


def stitch(pdf, layout, output, scale=3):
    reference = layout['referenceLongEdge']
    target_body = layout['targetBodyTop']
    target_totals = layout['targetTotalsTop']
    panels = []
    provenance = []
    with tempfile.TemporaryDirectory(prefix='elut-canvass-') as temp:
        for panel in layout['panels']:
            page = panel['page']
            path = Path(temp)/f'page-{page}'
            subprocess.run(['pdftoppm','-f',str(page),'-singlefile','-scale-to',str(reference*scale),'-png',str(pdf),str(path)],check=True)
            image = Image.open(path.with_suffix('.png')).convert('RGB')
            image = image.rotate(-layout['clockwiseRotation'],expand=True)
            image = image.rotate(panel['deskewDegrees'],resample=Image.Resampling.BICUBIC,fillcolor='white')
            stretch = (target_totals-target_body)/(panel['totalsTop']-panel['bodyTop'])
            offset = target_body-stretch*panel['bodyTop']
            box = (round(panel['cropLeft']*scale),round((layout['tableCropTop']-offset)/stretch*scale),
                   round(panel['cropRight']*scale),round((layout['tableCropBottom']-offset)/stretch*scale))
            assert 0 <= box[0] < box[2] <= image.width, (page,box,image.size)
            assert 0 <= box[1] < box[3] <= image.height, (page,box,image.size)
            piece = image.crop(box).resize((box[2]-box[0],(layout['tableCropBottom']-layout['tableCropTop'])*scale),Image.Resampling.LANCZOS)
            panels.append(piece)
            provenance.append({'sourcePage':page,'outputXStart':sum(p.width for p in panels[:-1]),'outputXEnd':sum(p.width for p in panels),'verticalStretch':stretch,'verticalOffsetReferencePixels':offset,'sourceCropPixels':box,'keptColumns':panel['keptColumns']})
    joined = Image.new('RGB',(sum(p.width for p in panels),panels[0].height),'white')
    left = 0
    for panel in panels:
        joined.paste(panel,(left,0)); left += panel.width
    output.parent.mkdir(parents=True,exist_ok=True)
    joined.save(output,optimize=True)
    preview = joined.convert('L')
    preview.thumbnail((2000,1000))
    preview.save(output.with_name(output.stem+'-preview.png'),optimize=True)
    # A separate name-header view turns the vertical labels into horizontal text.
    top = round((200-layout['tableCropTop'])*scale)
    bottom = round((target_body-layout['tableCropTop'])*scale)
    joined.crop((0,top,joined.width,bottom)).rotate(-90,expand=True).save(output.with_name(output.stem+'-name-headers.png'))
    output.with_suffix('.json').write_text(json.dumps({'source':layout['source'],'originalTablePages':layout['tablePages'],'abstractPage':layout['abstractPage'],'imageSize':list(joined.size),'panels':provenance,'notes':layout['notes']},indent=2)+'\n')
    return joined.size


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('pdf',type=Path)
    ap.add_argument('--layout',type=Path,default=ROOT/'src/data/history/1960-scan-layout.json')
    ap.add_argument('--output',type=Path,default=ROOT/'reports/source-images/1960-general-table-joined.png')
    args=ap.parse_args()
    print(args.output,stitch(args.pdf,json.loads(args.layout.read_text()),args.output))

if __name__=='__main__': main()
