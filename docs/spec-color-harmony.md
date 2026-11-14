# Harmony (specification)

*Status: draft, 2026-11-13. Nothing is built yet beyond the home-page card. Based on
[the literature review](literature-review-color-harmony.md).*

## What it does

The user picks a base color and a **scheme** (complementary, split complementary, analogous, triad,
tetrad, square, hexad, monochromatic, or a free polygon). The instrument draws the scheme as a **shape on
a hue wheel**, generates its colors, and shows the same shape carried into the three solids of the
color-models instrument (RGB cube, HSL cylinder, L\*a\*b\*). Beside the shape it reports the measurable
contrasts and the balance of the colors. The **wheel is a choice**, so the user sees that "the complement"
or "a triad" depends on the wheel it is drawn on.

## Layout

The same frame as Color Models: plane views on the left, the 3-D solid on the right with the title above
it, the palette strip at the foot.

- **Wheel** (large, ~420 px): the chosen wheel as a disc (hue around, chroma or saturation outward, at
  the base color's lightness). The scheme's polygon is drawn on it; its vertices are the colors. Drag
  the base vertex to rotate the whole shape; drag another vertex to change the angle δ where the scheme
  has one (analogous, split, tetrad); drag radially to change chroma.
- **Wheel selector:** RYB (painter's, Itten's 12 hues), HSL (additive), CIELCh (perceptual), and
  "afterimage" (complements by opponent process; approximated as CIELAB opposite with the Mahyar et al.
  correction table, if we can get one; otherwise left out).
- **Comparison strip:** the scheme's colors as generated on each of the wheels, one row per wheel, so the
  differences read at a glance.
- **3-D solid:** the polygon's vertices and edges in the chosen solid. Edges are drawn as paths of
  constant lightness on the chosen wheel, carried point by point into the solid (they bend, as the cuts do
  in Color Models).
- **Readouts** (table, under the wheel):
  - ΔE00 for each pair, and the minimum.
  - Itten's contrasts as numbers: hue spread, ΔL\* range, ΔC\* range, warm–cool range, the **balance
    vector** (sum of the colors' a\*b\* vectors, weighted by area; zero means the colors mix to gray).
  - WCAG 2 contrast ratio for each pair, flagged at 3 : 1 and 4.5 : 1.
  - Optional (question 2): the Ou & Luo (2006) two-color harmony score per pair.
- **Proportion bar** (contrast of extension): the colors as one bar, with areas from (a) equal, (b)
  Goethe/Itten light values, or (c) Munsell's balance (areas making the weighted a\*b\* sum zero, solved
  as a small non-negative least-squares problem).
- **Context grid** (Albers): an *n* × *n* grid, each color as a small square on each other color, and
  a neutral gray square on each (Chevreul's simultaneous contrast).

## The mathematics

**Wheels as hue maps.** Each wheel is a bijection between its own hue angle φ and a color at given
lightness and chroma.

- HSL: φ = 360° · H; colors `hsl2rgbF({H, S, L})`.
- CIELCh: φ = h°; colors from `(L*, C*, h°)`, with chroma reduced to the sRGB gamut by bisection (as in
  Color Models' `fromLab`) when the gamut switch is on.
- RYB: a monotone piecewise-linear map φ_RYB → H_HSL through Itten's 12 hues at equal 30° steps (red 0,
  orange 30°, yellow 60°, green 120°, blue 240°, violet 270° on the HSL wheel, approximately; the knots are
  a table to tune). Gossett & Chen's trilinear RYB cube as an alternative.

**Schemes as angle sets.** For base angle θ and spread δ:

| scheme | angles |
|---|---|
| analogous (n) | θ + kδ, k = −(n−1)/2 … (n−1)/2 |
| complementary | θ, θ + 180° |
| split complementary | θ, θ + 180° − δ, θ + 180° + δ |
| triad / square / hexad | θ + k · 360°/n |
| tetrad (rectangle) | θ, θ + δ, θ + 180°, θ + 180° + δ |
| monochromatic (n) | θ, with L (or C) in n even steps |
| free | n vertices, each dragged |

**Lightness and chroma of the vertices:** (a) all as the base color (default); (b) an Ostwald-style
series (equal white or equal black content, approximated in HSL as fixed L or fixed S·(1−|2L−1|)); (c)
free per vertex.

**Balance.** With colors `c_i` in CIELAB and areas `w_i ≥ 0`, `Σ w_i = 1`: the balance vector is
`b = Σ w_i (a*_i, b*_i)`. Itten's claim for regular polygons is that `b = 0` on a wheel of complements
with equal chroma; the readout shows how far from zero it lands on each wheel. "Munsell areas" solve
`min ‖Σ w_i (a*_i, b*_i)‖²` subject to the simplex, with a small pull towards equal areas so the solution
is unique.

**Template fit (later, question 3).** For a given palette (from Color Models' strip or the photograph
pyramid), find the Matsuda template T and rotation α minimizing
`Σ_i C_i · dist(h_i, T_α)` (distance from each hue to the nearest sector, weighted by chroma, as in
Cohen-Or et al. 2006). Show the best template on the wheel and the hue shift each color would need.

## Reuse

`lib/color.js` (conversions, `inGamut`, ΔE2000), `lib/scene.js` and `theory/src/solids.js` (3-D solids
and carried curves), `lib/palette.js` (palette strip, exports), the Color Models layout and pointer
handling. Permalink as in Color Models: `?c=base&s=scheme&w=wheel&d=delta&n=count`.

## Questions for the owner

1. Wheels in the first version: RYB, HSL and CIELCh only, or also Munsell (approximated from CIELAB) and
   OSA-UCS?
2. Should the instrument judge (an empirical harmony score per pair, Ou & Luo 2006), or only describe
   (shapes, contrasts, balance)?
3. The template fit to an existing palette or photograph: here, or in Palette analysis?
4. Lightness and chroma of the generated colors: fixed from the base color, an Ostwald series, or free per
   vertex, and which as the default?
5. Should areas (contrast of extension, Munsell balance) travel with the palette, so the exports carry
   weights as well as colors?
