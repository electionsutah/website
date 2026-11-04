"""Build the menu-bar/footer logo: 01-editorial-inverse with enlarged stars.

Small sizes make the original star trail read as specks, so each star is scaled
up and the trail is restacked upward from just above the i stem. Usage:
  python3 make-nav-logo.py [scale] [gap] [lift]
"""
import re, sys
from pathlib import Path

here = Path(__file__).parent
scale = float(sys.argv[1]) if len(sys.argv) > 1 else 1.7
gap = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
# Space between the bottom star and the top of the i stem.
lift = float(sys.argv[3]) if len(sys.argv) > 3 else 7.0
src = (here / '01-editorial-inverse.svg').read_text()
star_re = re.compile(r'<path fill="#ff4c3c" d="([^"]+)"/>')
letters = [m for m in re.findall(r'<path fill="#ffffff" d="[^"]+"/>', src)]

def points(d):
    return [tuple(map(float, p.split(','))) for p in re.findall(r'-?[\d.]+,-?[\d.]+', d)]

stars = sorted((points(d) for d in star_re.findall(src)), key=lambda pts: -max(y for _, y in pts))  # bottom (largest) first
bottom = max(y for _, y in stars[0]) - lift
out = []
for pts in stars:
    cx = sum(x for x, _ in pts) / len(pts)
    top0, bot0 = min(y for _, y in pts), max(y for _, y in pts)
    new = [(cx + (x - cx) * scale, bottom - (bot0 - y) * scale) for x, y in pts]
    out.append(new)
    bottom -= (bot0 - top0) * scale + gap
star_paths = ['<path fill="#ff4c3c" d="M' + ' L'.join(f'{x:.3f},{y:.3f}' for x, y in pts) + ' Z"/>' for pts in out]
top = min(y for pts in out for _, y in pts)
x0, y0, x1, y1 = 22, min(25, top - 4), 396, 235
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0:.1f} {x1 - x0} {y1 - y0:.1f}" width="{x1 - x0}" height="{y1 - y0:.0f}">\n'
       + '\n'.join(letters + star_paths) + '\n</svg>\n')
(here / '01-editorial-inverse-nav.svg').write_text(svg)
print(f'viewBox top {y0:.1f}, height {y1 - y0:.1f}')
