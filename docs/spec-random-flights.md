# App 4: Random flights (specification)

*Status: draft, 2026-11-13. Nothing is built yet beyond the home-page card.*

## What it does

An arrow flies through a colour solid. Perpendicular to it, a disc of radius ρ travels along. The colours
the disc cuts are drawn, large, as a **circle on the screen**: the main view. A **miniature** in one
corner shows the solid as a wireframe, the arrow, its disc and the path ahead and behind, so it is always
clear where the colours come from.

## Trajectory

- A chain of cubic Béziers between **random points** inside the solid, joined C¹ (each new segment's first
  handle mirrors the previous segment's last), generated ahead of the arrow in real time so the flight
  never ends.
- Constant **speed** along the curve (re-parameterised by arc length, as in `lib/reparam.js`), adjustable.
- **Frame:** the tangent is the arrow. The disc's in-plane axes use a rotation-minimising frame (double
  reflection, Wang et al. 2008), so the circle on the screen does not spin on its own.
- **Steering:** the arrow keys turn the heading (yaw and pitch), `+`/`−` change speed, space pauses. When
  the user steers, the random generator takes over again from wherever the arrow is.
- **Editing:** drag the upcoming control points in the miniature. Pause to rotate the miniature.
- **Walls:** random points are drawn inside the solid. If the arrow is about to leave it, the next segment
  bends back in. Disc points that fall outside are shown as the page's grey (masked), or clamped (option).

## Spaces (selector)

| space | coordinates | inside test |
|---|---|---|
| HSL cylinder | `x = S cos 2πH, y = S sin 2πH, z = 2L−1` | `x²+y² ≤ 1, |z| ≤ 1` |
| CIELAB (perceptual) | `(a*, b*, L*)` scaled to the unit box | `inGamut(cielab2rgbF(…))` from `lib/color.js` |
| RGB cube | `(R, G, B)` | the cube |

The perceptual space's solid is the sRGB gamut inside Lab, an irregular shape. Its wireframe is the
image of the cube's edges. A later option: OKLab.

## Rendering

The disc is sampled on a polar grid (or per pixel inside the circle) every frame. At 256×256 that is about
51 000 conversions per frame: feasible on the CPU at 30–60 fps with `ImageData`. A **WebGL fragment
shader** (the HSL/Lab→sRGB formulas are a few lines of GLSL) is the robust path to full resolution and is
recommended from the start. The miniature uses `lib/scene.js` (orthographic camera, `drawCylinder`).

## Output

A ring palette: *n* colours sampled on the rim of the disc, live, with color-curves' export buttons.
Freeze frame (PNG). Record a flight as the list of Bézier control points (JSON permalink) so it can be
replayed exactly. Later, perhaps, a video export.

## Questions for the owner

1. Disc of a fixed radius, or one that breathes (ρ varying along the path, randomly or by key)?
2. Outside the solid: mask with grey, clamp to the boundary, or reflect the trajectory so the disc never leaves?
3. Is the circle on screen just the disc, or also a strip that records the disc's centre colour over time
   (a gradient of the flight)?
4. WebGL from the start (smooth, full resolution) or canvas first (simpler, like the other instruments)?
5. Should the flight be reproducible from a seed (same random path every time for a given number)?
