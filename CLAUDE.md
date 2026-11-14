# color-lab

A web page holding several color instruments; published at https://cheque.github.io/color-lab/ from
`main` (GitHub Pages). Language: English. Parallel to `../color-curves`, which stays as the reference
(do not edit it for color-lab work).

## Rules of the house
- No build step, plain classic `<script>`s: every page must open from `file://`. Load order matters (each file
  uses the ones above it).
- Shared code lives in `lib/`. `lib/color.js` is the single color-math module (conventions in its header:
  rgb 0–255, hsl all 0–1 with H a *turn*, lab D65 by default). Use `cielab2rgbF` + `inGamut` for gamut
  tests; `lib/scene.js` for 3-D (orthographic orbit camera in turns, `drawCylinder`).
- Look: instruments use `lib/applet.css` (color-curves' gray #666, white ink, cyan #49f5da). The home page
  takes cyclotomic-tilings' layout, cards and fonts (cheque.github.io/assets/fonts.css) in those colors.
- Home-page cards are drawn live by the instruments' code (`src/home.js`), never screenshots.
- `legacy/colortheory/` is the published original, verbatim: never edit it.
- Curves parameters: add one entry to `PARAM_SPECS` in `curves/src/params.js`; UI and permalink follow.

## Status (2026-11-13)
0 curves (+ "Show the cylinder" wireframe) and 1 color models are built. 2 sampling has a literature
review, 3 analysis and 4 random flights have specifications, all in `docs/`, each ending with questions for
the owner. Answer those before building.

## Checking
Headless Chrome is available: `google-chrome --headless=new --screenshot=… --virtual-time-budget=3000 <file-url>`.
