# Elections Utah logo options

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
