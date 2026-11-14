<div align="center">

# Color Lab

**Color is space: let's travel through.**

### [**▶&nbsp; Open the lab**](https://cheque.github.io/color-lab/)

</div>

Every color is a point in a solid: the HSL cylinder, the perceptual L\*a\*b\* space, the RGB cube.
A gradient is a path through it, a palette is a handful of stops along the way, and a harmony is a shape.
These instruments draw those shapes and give back the colors.

## The math of it

| | instrument | |
|---|---|---|
| 0 | [**Parametric curves**](https://cheque.github.io/color-lab/curves/) · [widget](https://cheque.github.io/color-lab/curves/widget.html) | A curve through the HSL cylinder, its gradient, and a palette spaced evenly to the eye ([Bridges 2023](https://archive.bridgesmathart.org/2023/bridges2023-181.html)). Details in [`curves/README.md`](curves/README.md). |
| 1 | [**Color models**](https://cheque.github.io/color-lab/theory/) | One color in RGB, HSL and CIE L\*a\*b\* at once: nine plane cuts to drag in (RGB at constant R, G, B; HSL at constant L, H, S; L\*a\*b\* at constant L\*, a\*, b\*); the RGB cube, the HSL cylinder or the sRGB gamut in 3-D, translucent, with each space's cuts flat and the others' carried over, curved; a palette you collect. |
| 5 | Harmony (in the workshop) | Classic schemes (complements, triads, analogous…) as shapes on a hue wheel of your choice, carried into the solids, with Itten's contrasts measured. [Literature review](docs/literature-review-color-harmony.md) · [specification](docs/spec-color-harmony.md) |

## Some applications (in the workshop)

| | instrument | status |
|---|---|---|
| 2 | Palettes from a photograph: a nested pyramid of palettes | [literature review](docs/literature-review-palette-sampling.md) |
| 3 | Palette analysis: minimum-variance Béziers through given colors | [specification](docs/spec-palette-analysis.md) |
| 4 | Random flights: the disc an arrow cuts through a color solid | [specification](docs/spec-random-flights.md) |

## Layout

```
index.html, css/, src/home.js   the home page (cards drawn live by the instruments' code)
lib/                            shared core: color.js, scene.js, reparam.js, palette.js, rangepair.js, applet.css
curves/                         0 · parametric curves and the palette-picker widget
theory/                         1 · color models
harmony/                        5 · placeholder page
sampling/ analysis/ trajectories/   2–4 · placeholder pages
docs/                           the review and specifications
legacy/colortheory/             the original color-model explorer, verbatim
```

Plain classic scripts, no build step: every page opens straight from the filesystem.

## History

The curves instrument was imported from [cheque/color-curves](https://github.com/cheque/color-curves) at
`21eb871`; that repository stays as the published reference. The color-model explorer is a rewrite of
[chequesoto.info/colortheory](https://chequesoto.info/colortheory/), whose original code is kept in
`legacy/colortheory/`.

## License and citation

MIT (see `LICENSE`). To cite, see `CITATION.cff`; a DOI is minted by Zenodo for each GitHub release.

Cheque Soto · [cheque.github.io](https://cheque.github.io/)
