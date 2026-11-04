"""Generate standalone outlined logos from the site's self-hosted fonts.

Run with Python + fonttools[woff] + uharfbuzz. No application files are changed.
"""
from pathlib import Path
from io import BytesIO
import base64
import math
import xml.etree.ElementTree as ET

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
INK, BLUE, SALMON, PAPER = '#111110', '#006eb7', '#ff4c3c', '#f2f1ed'


class Lettering:
    def __init__(self, family, weight, optical_size=None):
        source = TTFont(ROOT / 'public/fonts' / f'{family}-normal-latin.woff2')
        axes = {'wght': weight}
        if optical_size is not None:
            axes['opsz'] = optical_size
        self.font = instantiateVariableFont(source, axes, inplace=False)
        self.font.flavor = None
        data = BytesIO()
        self.font.save(data)
        self.hbfont = hb.Font(hb.Face(data.getvalue()))
        self.upm = self.font['head'].unitsPerEm
        self.hbfont.scale = (self.upm, self.upm)
        self.glyphs = self.font.getGlyphSet()
        self.names = self.font.getGlyphOrder()

    def draw(self, word, size, x, baseline, color, tracking=0):
        buffer = hb.Buffer()
        buffer.add_str(word)
        buffer.guess_segment_properties()
        hb.shape(self.hbfont, buffer, {'kern': True, 'liga': False})
        scale = size / self.upm
        paths, positions = [], []
        cursor = 0
        for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions):
            gx = x + cursor + pos.x_offset * scale
            gy = baseline - pos.y_offset * scale
            name = self.names[info.codepoint]
            pen = SVGPathPen(self.glyphs, ntos=lambda v: f'{v:.3f}'.rstrip('0').rstrip('.'))
            self.glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, gx, gy)))
            bounds = BoundsPen(self.glyphs)
            self.glyphs[name].draw(bounds)
            positions.append((gx, pos.x_advance * scale, bounds.bounds))
            if pen.getCommands():
                paths.append(f'<path fill="{color}" d="{pen.getCommands()}"/>')
            cursor += pos.x_advance * scale + tracking
        return '\n'.join(paths), cursor - tracking, positions


def star(cx, cy, radius, color):
    vertices = []
    for n in range(10):
        angle = -math.pi / 2 + n * math.pi / 5
        r = radius if n % 2 == 0 else radius * .46
        vertices.append(f'{cx + math.cos(angle) * r:.3f},{cy + math.sin(angle) * r:.3f}')
    return f'<path fill="{color}" d="M' + ' L'.join(vertices) + ' Z"/>'


def svg(name, description, width, height, content):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">Elections Utah — {name}</title>
<desc id="desc">{description} Transparent background; typography converted to vector paths.</desc>
{content}
</svg>'''


serif = Lettering('source-serif-4', 700, 20)
sans = Lettering('noto-sans', 500)
options = []

for number, name, font, size, color, second_color, description in [
    (1, 'Editorial', serif, 91, INK, BLUE, 'Source Serif 4 Bold; ink Elections, blue Utah, three rising salmon stars replacing the dot over the i.'),
    (2, 'Original, refreshed', sans, 88, BLUE, BLUE, 'Noto Sans Medium; blue stacked wordmark with the original offset composition and three rising salmon stars replacing the dot over the i.'),
]:
    first, width, positions = font.draw('Electıons', size, 0, 0, color, -.025 * size if number == 1 else -.02 * size)
    # Preserve the reference's right-aligned second line and rising-star i.
    first, _, positions = font.draw('Electıons', size, 24, 137, color, -.025 * size if number == 1 else -.02 * size)
    second_size = size * 1.10
    _, second_width, _ = font.draw('Utah', second_size, 0, 0, second_color, -.025 * second_size)
    second, _, _ = font.draw('Utah', second_size, 24 + width - second_width, 228, second_color, -.025 * second_size)
    ix, advance, bounds = positions[5]
    # Align to the visible stem rather than the glyph's advance box.
    cx = ix + ((bounds[0] + bounds[2]) / 2) * size / font.upm
    stars = '\n'.join(star(cx, y, r, SALMON) for y, r in [(80, 12), (54, 7.5), (34, 4.5)])
    text = first + '\n' + second + '\n' + stars
    asset = svg(name, description, round(width + 48, 3), 258, text)
    inverse = asset.replace(f'fill="{INK}"', 'fill="#ffffff"').replace(f'fill="{BLUE}"', 'fill="#ffffff"')
    slug = f'{number:02d}-' + ('editorial' if number == 1 else 'original-refreshed')
    options.append((number, name, slug, asset, inverse))

first, width, _ = serif.draw('Elections', 72, 95, 109, INK, -1.8)
second, second_width, _ = serif.draw('Utah', 72, 95 + width + 18, 109, BLUE, -1.8)
stars = '\n'.join(star(x, y, r, SALMON) for x, y, r in [(39, 99, 19), (48, 58, 11.5), (57, 28, 6.5)])
asset = svg('Masthead', 'Source Serif 4 Bold horizontal wordmark; ink Elections, blue Utah, and a separate rising three-star salmon symbol.', round(95 + width + 18 + second_width + 24, 3), 145, stars + '\n' + first + '\n' + second)
inverse = asset.replace(f'fill="{INK}"', 'fill="#ffffff"').replace(f'fill="{BLUE}"', 'fill="#ffffff"')
options.append((3, 'Masthead', '03-masthead', asset, inverse))

for _, _, slug, asset, inverse in options:
    (HERE / f'{slug}.svg').write_text(asset)
    (HERE / f'{slug}-inverse.svg').write_text(inverse)
    parsed = ET.fromstring(asset)
    assert all(e.tag not in ('{http://www.w3.org/2000/svg}text', '{http://www.w3.org/2000/svg}image') for e in parsed.iter())
    assert 'href=' not in asset

font_data = base64.b64encode((ROOT / 'public/fonts/noto-sans-normal-latin.woff2').read_bytes()).decode()
blurbs = [
    ('Source Serif 4 · Bold', 'Closest to the site’s editorial typography. Keeps the offset stack and rising-star detail.'),
    ('Noto Sans · Medium', 'Closest to your reference. Clean sans-serif lettering with the site’s blue and salmon.'),
    ('Source Serif 4 · Bold', 'A compact horizontal layout for navigation, with the three stars as a separate mark.'),
]
cards = []
for (number, name, slug, asset, inverse), (font_label, blurb) in zip(options, blurbs):
    small = 'wide' if number == 3 else ''
    download = base64.b64encode(asset.encode()).decode()
    download_inverse = base64.b64encode(inverse.encode()).decode()
    # Unique accessible SVG names when all variants share an HTML document.
    asset = asset.replace('id="title"', f'id="title-{number}"').replace('id="desc"', f'id="desc-{number}"').replace('aria-labelledby="title desc"', f'aria-labelledby="title-{number} desc-{number}"')
    inverse = inverse.replace('id="title"', f'id="title-{number}-inverse"').replace('id="desc"', f'id="desc-{number}-inverse"').replace('aria-labelledby="title desc"', f'aria-labelledby="title-{number}-inverse desc-{number}-inverse"')
    cards.append(f'''<article class="option {small}">
<div class="label"><span class="number">0{number}</span><h2>{name}</h2></div>
<div class="art art-{number}">{asset}</div>
<div class="header-sample"><span class="sample-logo">{inverse}</span><span class="sample-nav">Elections &nbsp; People</span></div>
<div class="copy"><p class="font-label">{font_label}</p><p>{blurb}</p>
<div class="downloads"><a download="elections-utah-{slug}.svg" href="data:image/svg+xml;base64,{download}">Download SVG <span aria-hidden="true">↓</span></a><a download="elections-utah-{slug}-inverse.svg" href="data:image/svg+xml;base64,{download_inverse}">White version <span aria-hidden="true">↓</span></a></div></div>
</article>''')

html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Elections Utah logo choices</title><style>
@font-face{{font-family:Noto;src:url(data:font/woff2;base64,{font_data}) format('woff2');font-weight:100 900}}
*{{box-sizing:border-box}}body{{margin:0;color:var(--foreground,#111110);font-family:Noto,Arial,sans-serif;font-size:13px}}.intro{{margin:0 0 18px;line-height:1.6;color:var(--muted-foreground,#5f5e59)}}.choices{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}.option{{border:1px solid var(--border,#e3e2dd);border-radius:10px;overflow:hidden;background:var(--card,#fff)}}.wide{{grid-column:1/-1}}.label{{display:flex;gap:11px;align-items:center;padding:17px 20px}}.number{{color:var(--muted-foreground,#5f5e59);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}}h2{{font-size:15px;font-weight:650;margin:0;letter-spacing:-.025em}}.art{{background:{PAPER};height:255px;display:flex;align-items:center;justify-content:center;padding:35px 28px}}.art>svg{{display:block;width:100%;height:auto;max-height:100%}}.art-3{{height:180px;padding:34px 45px}}.header-sample{{background:{INK};border-bottom:4px solid {SALMON};height:61px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:9px 20px}}.sample-logo{{width:80px;height:42px;display:flex;align-items:center}}.sample-logo svg{{width:100%;height:100%}}.wide .sample-logo{{width:225px}}.sample-nav{{font-size:9px;color:#fff;font-weight:650;white-space:nowrap}}.copy{{padding:18px 20px 20px}}.copy p{{margin:0;color:var(--muted-foreground,#5f5e59);font-size:12px;line-height:1.65}}.copy .font-label{{color:var(--foreground,#111110);font-size:10px;font-weight:700;letter-spacing:.035em;margin-bottom:7px}}.downloads{{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:15px}}.downloads a{{color:var(--foreground,#111110);font-size:11px;font-weight:650;text-decoration:underline;text-underline-offset:3px}}a:focus-visible{{outline:3px solid {BLUE};outline-offset:4px}}.palette{{display:flex;gap:17px;flex-wrap:wrap;margin:18px 0 12px;font-size:10px;color:var(--muted-foreground,#5f5e59)}}.palette span{{display:flex;gap:7px;align-items:center}}.dot{{width:11px;height:11px;border-radius:50%;display:inline-block;border:1px solid #8885}}.note{{font-size:11px;line-height:1.6;color:var(--muted-foreground,#5f5e59);margin:0}}@media(max-width:520px){{.choices{{grid-template-columns:1fr}}.wide{{grid-column:auto}}.art{{height:245px;padding:35px 45px}}.art-3{{height:135px;padding:24px}}.wide .sample-logo{{width:180px}}.sample-nav{{font-size:8px}}}}
</style></head><body>
<p class="intro">Three directions using the current site fonts and colors, each preserving the rising three-star motif.</p>
<main class="choices">{''.join(cards)}</main>
<div class="palette"><span><i class="dot" style="background:{INK}"></i>Ink {INK}</span><span><i class="dot" style="background:{BLUE}"></i>Blue {BLUE}</span><span><i class="dot" style="background:{SALMON}"></i>Salmon {SALMON}</span></div>
<p class="note">All downloads are transparent SVGs with outlined lettering. The warm paper panels and dark header strips are previews; white versions are included for dark backgrounds.</p>
<script>console.log(JSON.stringify({{svgCount:document.querySelectorAll('svg').length,outlined:!document.querySelector('svg text,svg image'),overflow:document.documentElement.scrollWidth>innerWidth,links:document.querySelectorAll('[download]').length,uniqueIds:new Set([...document.querySelectorAll('[id]')].map(e=>e.id)).size===document.querySelectorAll('[id]').length,artWithinBounds:[...document.querySelectorAll('svg')].every(s=>{{const b=s.getBBox(),v=s.viewBox.baseVal;return b.x>=0&&b.y>=0&&b.x+b.width<=v.width&&b.y+b.height<=v.height}})}}))</script>
</body></html>'''
(HERE / 'comparison.html').write_text(html)
(HERE / 'README.md').write_text('''# Elections Utah logo options

1. **Editorial** — Source Serif 4 Bold, offset stacked composition.
2. **Original, refreshed** — Noto Sans Medium, offset stacked composition.
3. **Masthead** — Source Serif 4 Bold, horizontal composition.

Each logo preserves three rising five-point stars. Colors come from `src/app.css`:
ink `#111110`, blue `#006eb7`, salmon `#ff4c3c`. Source Serif 4 uses weight 700
and optical size 20, matching the site's bold display type. Noto Sans uses weight 500.
The original i dot is replaced by the star trail in options 1 and 2.

All SVGs are self-contained with outlined text and transparent backgrounds.
The `-inverse.svg` companions use white lettering for the current ink-black header.
The comparison HTML shows the light versions on the site's warm paper color
`#f2f1ed` and each white variant at navigation scale.

Open `comparison.html` to view the choices and download the files. Application
source and the current live logo have not been edited pending selection.

To regenerate: run `generate.py` with Python, `fonttools[woff]`, and `uharfbuzz`.
Typography is shaped with HarfBuzz (including kerning), then converted to paths
from the existing self-hosted font files. The fonts are SIL Open Font License fonts.
''')
print('Generated 3 options, 3 white variants, and comparison.html.')
