#!/usr/bin/env python3
"""Render reproducible page-header evidence from a PDF without joining repeated columns.

Use --rotate -90 for sideways old canvasses; --top/--bottom are fractions of
an upright page. Each contact-sheet row retains its original PDF page number.
The optional name sheet turns vertical candidate names into horizontal lines.
Requires pdftoppm and Pillow. Outputs PNG evidence and a JSON transform manifest.
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('pdf',type=Path);p.add_argument('output',type=Path)
p.add_argument('--rotate',type=int,default=0);p.add_argument('--top',type=float,default=0)
p.add_argument('--bottom',type=float,default=.5);p.add_argument('--scale',type=int,default=3000)
p.add_argument('--pages',type=int,nargs='*');p.add_argument('--names',action='store_true')
a=p.parse_args();assert 0<=a.top<a.bottom<=1
with tempfile.TemporaryDirectory(prefix='elut-canvass-') as tmp:
 prefix=Path(tmp)/'page'
 selection=['-f',str(min(a.pages)),'-l',str(max(a.pages))] if a.pages else []
 subprocess.run(['pdftoppm',*selection,'-scale-to',str(a.scale),'-png',str(a.pdf),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 images=[];transforms=[]
 for f in sorted(Path(tmp).glob('page-*.png')):
  number=int(f.stem.rsplit('-',1)[1])
  if a.pages and number not in a.pages:continue
  image=Image.open(f).convert('RGB').rotate(a.rotate,expand=True)
  box=(0,int(image.height*a.top),image.width,int(image.height*a.bottom))
  crop=image.crop(box)
  if a.names:crop=crop.rotate(-90,expand=True)
  canvas=Image.new('RGB',(crop.width,crop.height+30),'white');canvas.paste(crop,(0,30))
  ImageDraw.Draw(canvas).text((10,8),f'{a.pdf.name} — PDF page {number}',fill='black')
  images.append(canvas);transforms.append(dict(page=number,rotation=a.rotate,crop=list(box),nameRotation=-90 if a.names else 0))
 assert images,'No pages selected'
 # Side-by-side narrow name strips; stacked wide table headers.
 horizontal=a.names
 size=(sum(i.width for i in images),max(i.height for i in images)) if horizontal else (max(i.width for i in images),sum(i.height for i in images))
 out=Image.new('RGB',size,'white');x=y=0
 for im in images:
  out.paste(im,(x,y))
  if horizontal:x+=im.width
  else:y+=im.height
 a.output.parent.mkdir(parents=True,exist_ok=True);out.save(a.output,optimize=True)
 a.output.with_suffix('.json').write_text(json.dumps(dict(sourceFile=a.pdf.name,renderLongEdge=a.scale,transforms=transforms),indent=2)+'\n')
 print(a.output)
