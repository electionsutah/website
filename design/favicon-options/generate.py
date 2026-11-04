"""Favicon options: the logo's ascending star trail on black. Run: python3 generate.py"""
import math
from pathlib import Path

SALMON, BLACK = '#ff4c3c', '#111110'
INNER = 0.46  # inner/outer radius ratio of the logo's stars

def star(cx, cy, r, rot=0.0):
    pts = []
    for i in range(10):
        a = math.radians(-90 + rot + i * 36)
        rr = r if i % 2 == 0 else r * INNER
        pts.append(f'{cx + rr * math.cos(a):.2f},{cy + rr * math.sin(a):.2f}')
    return f'<path fill="{SALMON}" d="M{" L".join(pts)}Z"/>'

def svg(body, rx=0, extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<rect width="64" height="64" rx="{rx}" fill="{BLACK}"/>{extra}{body}</svg>\n')

SIZES = (1, 0.625, 0.375)  # the logo's star size ratio, bottom to top
DOWN = math.cos(math.radians(36))  # a star's lower points sit this far below center, in radii

def trail(r, bottom, gap, x=32.0):
    """The logo's vertical trail: stars stacked upward from `bottom` with `gap` between them."""
    out = []
    for k in SIZES:
        rr = r * k
        cy = bottom - rr * DOWN
        out.append(star(x, cy, rr))
        bottom = cy - rr - gap
    return ''.join(out)

def climb(r, start, end):
    """The trail climbing diagonally from the big star at `start` to the small one at `end`."""
    (x0, y0), (x1, y1) = start, end
    return ''.join(star(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r * k) for k, t in zip(SIZES, (0, 0.58, 1)))

options = {
    # 1. The logo's vertical trail, as-is.
    '1-trail': svg(trail(14, 58.5, 2.2)),
    # 2. The trail climbing diagonally, so it fills the square.
    '2-diagonal': svg(climb(17, (23, 40), (52, 11))),
    # 3. The trail with the header's salmon rule along the bottom.
    '3-rule': svg(trail(12.5, 51, 2), extra=f'<rect y="57" width="64" height="7" fill="{SALMON}"/>'),
    # 4. The diagonal trail on a rounded tile (app-icon look).
    '4-rounded': svg(climb(15.5, (24, 39), (49, 14)), rx=14),
}
for name, content in options.items():
    Path(f'{name}.svg').write_text(content)
print(', '.join(options))
