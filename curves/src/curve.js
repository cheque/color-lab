// ============================================================================
//  curve.js — the parametric curve model
//
//  A curve is a map  t in [-1,1]  ->  HSL point in the colour cylinder:
//
//      H(t) = frac( sign * phase(t) / 2 )          hue, in turns
//      S(t) = S * env(t)                           saturation
//      L(t) = L0*(1-s) + L1*s                      s = (t+1)/2
//
//      phase(t) = N*t + 2*t0                       in half-turns
//
//  `env` is the RADIAL ENVELOPE and is the only part that differs between the
//  shapes. Everything else (hue winding, the A/B ellipse, the lightness ramp)
//  is shared.
//
//  >>> TO ADD A NEW CURVE: add one entry to SHAPES below. Nothing else. <<<
//      The <select> in the UI, the 3-D plot and the palette all read from it.
//
//  Requires: color.js
// ============================================================================

// ----------------------------------------------------------------------------
//  Shape registry — the extension point for new curves
// ----------------------------------------------------------------------------
//  env(t, p) -> radial scale in [0,1], where `p` is the full parameter object
//  so a shape may use any parameter it likes.
//
//  Both shapes are ONE family each, indexed by a single exponent p = 2^k:
//
//      p-circle(t) = (1 - |t|^p)^(1/p)     the unit ball of the p-norm
//      p-bell(t)   = exp(-(|t|/p)^2)       a Gaussian of width p
//
//  This replaced the four fixed envelopes of the Bridges 2023 paper, which are
//  four points inside this one family: p-circle at p = 2 is the old `circle`,
//  at p = 1 the old `linear`, and p-bell at p = 1/sqrt(C) the old `normal`.
//  The old `C` — an amplitude for two shapes and a decay rate for the other
//  two, which is why it needed a per-shape label — is gone. `k` says the same
//  thing once, in one place, and continuously.
//
//  k is deliberately the control and p the derived quantity: each step of 1 in
//  k doubles p, so equal steps of k are equal visual steps. A slider in p could
//  not do that — it would spend most of its travel up near 32, where the
//  picture has stopped changing. Both envelopes fill out as k grows: p-circle
//  runs spike -> diamond -> circle -> square, p-bell narrow -> wide.

// p = 2^k, the exponent both envelopes are built on.
function shapeP(par) { return Math.pow(2, par.k); }

var SHAPES = {
  pcircle: {
    label: 'p-circle',
    env: function (t, p) {
      var e = shapeP(p);
      // max(0,...) only guards the rounding at |t| = 1, where the base is 0.
      return Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), e)), 1 / e);
    }
  },
  pbell: {
    label: 'p-bell',
    env: function (t, p) {
      var e = Math.abs(t) / shapeP(p);
      return Math.exp(-e * e);
    }
  }
};

// Order shown in the UI. Add new shape keys here too.
var SHAPE_ORDER = ['pcircle', 'pbell'];

// Used whenever `p.shape` names something not in the registry — an old
// permalink, say, from when there were four shapes.
var DEFAULT_SHAPE = 'pbell';

// The phase, in half-turns. ORIENTATION IS IN WHOLE TURNS — t0 = 1 is one
// complete revolution of the hue, and of the curve about the lightness axis —
// so it enters here doubled. Everything needing the phase goes through this one
// function, which is what keeps the drawn point and its own colour agreeing.
function phaseOf(p, t) { return p.N * t + 2 * p.t0; }

// ----------------------------------------------------------------------------
//  Curve construction
// ----------------------------------------------------------------------------

function shapeOf(p) { return SHAPES[p.shape] || SHAPES[DEFAULT_SHAPE]; }

// Build the HSL curve for a parameter set. Returns t -> {H,S,L}.
//
// Previously curve1..curve4 took (A,B,C,N,t0) as arguments but their returned
// closures ignored them and read the module-level globals instead, so passing
// arguments silently did nothing. The parameters now arrive in a single `p`
// object and are genuinely the only input.
//
// SATURATION IS ONE NUMBER. It used to be an A/B ellipse — two scales, one per
// axis — and the radius was hypot(A cos phi, B sin phi). With a single S that
// collapses to S itself, which is why no trigonometry survives in here: the
// curve's distance from the lightness axis is S*env(t) and nothing else. The
// `hueMode` switch went with it. It existed because on an ellipse the ANGLE of
// a point and the PHASE that gives it its colour disagree when A != B, so you
// had to choose which one the hue followed. On a circle they are equal, and
// the choice is not a choice any more. (REVIEW.md section 4 asked you to make
// that call; joining the two scales answers it.)
function makeCurve(p) {
  var env = shapeOf(p).env;

  return function (t) {
    var turn = p.sign * phaseOf(p, t) / 2;
    var s = (t + 1) / 2;

    return {
      H: turn - Math.floor(turn),                 // wrap into [0,1)
      S: clip(p.S * env(t, p), 0, 1),
      L: clip(p.L0 * (1 - s) + p.L1 * s, 0, 1)
    };
  };
}

// Position of the curve inside the unit colour cylinder, for the 3-D plot.
// Returns t -> {x,y,z}, with z the lightness mapped to [-1,1].
//
// This is a cylindrical plot of the colour itself: the radius IS the
// saturation S*env(t), the angle IS the hue, and the height IS the lightness.
// The old version had a caveat here — the radius agreed with the colour but
// the angle did not, because the point sat at the ellipse angle while its
// colour came from the phase. One saturation removes the ellipse, and with it
// the discrepancy: every point is now drawn exactly where its own colour says.
function makeCurvePoint(p) {
  var env = shapeOf(p).env;

  return function (t) {
    var r  = p.S * env(t, p);
    var th = Math.PI * p.sign * phaseOf(p, t);
    var s  = (t + 1) / 2;

    return {
      x: r * Math.cos(th),
      y: r * Math.sin(th),
      z: 2 * (p.L0 * (1 - s) + p.L1 * s) - 1
    };
  };
}

var Curves = { SHAPES, SHAPE_ORDER, DEFAULT_SHAPE, shapeOf, shapeP, phaseOf,
               makeCurve, makeCurvePoint };

if (typeof module !== 'undefined' && module.exports) { module.exports = Curves; }
