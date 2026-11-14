# App 3: Palette analysis (specification)

*Status: draft, 2026-11-13. Nothing is built yet beyond the home-page card.*

## What it does

The user gives a few colors (typed hex, picked, pasted from the color-models palette, or a row of the
app-2 pyramid). The app places them in the HSL solid and computes a family of interpolating curves
through them. Each curve is a chain of cubic Béziers chosen to keep **lightness**, **saturation** or **hue**
as steady as possible along the way. The result is shown like color-curves: the curves inside the
cylinder in 3-D, the gradient strip of each, and a resampled palette (with perceptual spacing, from
`lib/reparam.js`).

## The mathematics

Colors as points: `x = S cos 2πH`, `y = S sin 2πH`, `z = 2L − 1` (the curves instrument's convention).
For ordered keys `P₀ … P_m`, segment *i* is the cubic Bézier `P_i, P_i + a_i, P_{i+1} − b_i, P_{i+1}`.
The **free variables are the handles** `a_i, b_i`. Two choices of continuity:

- **C¹** (one tangent per key, `a_i = b_{i−1}`): fewer unknowns, smooth gradients.
- **G¹** (same direction, independent lengths): more freedom, and still no visible kink.

**Objectives**, each the variance along the curve, measured over *t* or over arc length (one toggle):

| objective | function along the curve | structure |
|---|---|---|
| min. lightness variance | `L(t) = (z(t)+1)/2`, linear in the control points | **quadratic**: one linear solve, exact |
| min. saturation variance | `S(t) = √(x² + y²)` | non-linear: Gauss–Newton or L-BFGS from the C¹ Catmull–Rom start |
| min. hue variance | unwrapped `H(t) = atan2(y, x)/2π` | non-linear, and undefined on the axis: needs a barrier keeping the curve off `S = 0` |

**Constraints:** the curve stays in the solid (`S ≤ 1`, `0 ≤ L ≤ 1`), enforced with a smooth penalty.
Optional handle-length regularizer so curves do not balloon. Optional weighted mix of the three objectives
(one slider per term) instead of picking one.

**Second representation (toggle):** the Bézier written directly in cylindrical coordinates (H, S, L).
Then every coordinate is linear in the control points, so **all three objectives are quadratic** and
closed-form. This is the "spiral" interpolation, close in spirit to the curves instrument. Showing both
side by side is itself an analysis: Cartesian Béziers cut across the solid through grays, cylindrical
ones go around it.

**Order of the keys:** as given, or the order that minimizes the total curve length (≤ 8 keys: try all
orders; more: 2-opt). Cf. Phan et al. 2018, *Color Orchestra*.

## Readouts

For each curve: the variance of L, S and H it achieves, its length in ΔE00, its maximum chroma excursion
outside sRGB (if the perceptual space is shown), and the palette sampled from it with its evenness
(color-curves' `paletteEvenness`).

## Reuse

`lib/color.js`, `lib/scene.js` (3-D view and `drawCylinder`), `lib/reparam.js` (perceptual respacing),
`lib/palette.js` (sampling, export), and the color-models instrument's palette strip as the input widget.

## Questions for the owner

1. Is "minimum variance" taken over the parameter *t*, or over arc length (perceptual or Euclidean)?
2. Must the curve pass **through** the colors (interpolation), or may it only approach them
   (approximation, with the colors as Bézier control points)?
3. Hue variance: should the hue be allowed to wind more than once, or always take the short way between keys?
4. Which first: the three single objectives, or the weighted mix?
5. Should the curves also be computed in CIELAB (the perceptual solid), or only in the HSL cylinder for now?
