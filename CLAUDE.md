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
0 curves (+ "Show the cylinder" wireframe) and 1 color models are built. Color models: six cuts in a CUTS table (theory/src/app.js), 3-D in theory/src/solids.js (WebGL with depth buffer, painter's fallback; cuts opaque, solid translucent). 2 sampling has a literature
review, 3 analysis and 4 random flights have specifications, all in `docs/`, each ending with questions for
the owner. Answer those before building.

## Release and DOI
MIT. `CITATION.cff` and `.zenodo.json` hold the metadata; Zenodo mints a DOI on each GitHub release once the owner has switched the repo on at zenodo.org (GitHub tab). After the first DOI, add it to CITATION.cff (`doi:`), the README and the home footer.

## Checking
Headless Chrome is available: `google-chrome --headless=new --screenshot=… --virtual-time-budget=3000 <file-url>`.
