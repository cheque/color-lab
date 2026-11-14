// ============================================================================
//  params.js — the parameter schema
//
//  ONE declarative list describes every parameter: its default, its range, the
//  control used to edit it, and the group it belongs to. The defaults, the HTML
//  controls, the URL state and the reset button are all derived from it.
//
//  >>> TO ADD A PARAMETER: add one entry to PARAM_SPECS. Nothing else. <<<
//      A control appears in the UI, it round-trips through the permalink, and
//      it arrives inside the `p` object that makeCurve() and the shape
//      envelopes receive.
//
//  Previously the defaults lived in three places at once — the `let`
//  declarations at the top of curves.js, the value= attributes in index.html,
//  and the min/max/step attributes — and they disagreed (C was 10 in JS but 1
//  in the HTML, ta/tb were -0.66/0.66 vs -1/1, strsep was "'" vs empty). The
//  JS values silently won because updateGradient() wrote them back into the DOM
//  after every redraw. There is now exactly one place.
// ============================================================================

// type:
//   'range'  number input + slider, kept in sync
//   'select' <select>, `options` is [{value,label}] or a function returning it
//   'check'  checkbox; `on`/`off` give the values it maps to (default true/false)
//   'text'   free text, `maxlength` optional
//
// group: heading the control is filed under in the UI.
// view:  true for parameters that only affect drawing, never the model, so
//        editing them repaints without recomputing the curve.

var PARAM_SPECS = [
  // --- shape -------------------------------------------------------------
  {
    key: 'shape', group: 'Curve', label: 'Envelope', type: 'select', def: 'pcircle',
    options: function () {
      return SHAPE_ORDER.map(function (k) { return {value: k, label: SHAPES[k].label}; });
    },
    help: 'Radial envelope. Defined in src/curve.js, SHAPES.'
  },
  {
    key: 'k', group: 'Curve', label: 'k', type: 'range', def: 1.0,
    min: -5, max: 5, step: 0.05,
    help: 'Shape exponent. Both envelopes are built on p = 2^k, so k runs the ' +
          'family from p = 1/32 (k = -5) to p = 32 (k = 5). Both envelopes ' +
          'fill out as k grows. p-circle: k = 0 is the diamond, k = 1 the ' +
          'circle, large k the square. p-bell: p is the width, so each step ' +
          'of 1 in k doubles it.'
  },
  {
    key: 'sign', group: 'Curve', label: 'Invert spiral direction', type: 'check',
    def: -1, on: -1, off: 1,
    help: 'Direction the hue winds around the cylinder.'
  },

  // --- the curve's own parameters ----------------------------------------
  { key: 'N',  group: 'Curve', label: 'Hue cycles',      type: 'range', def: 1, min: 0,  max: 17,  step: 0.05,
    help: 'How many times the hue wraps over t in [-1,1].' },
  { key: 't0', group: 'Curve', label: 'Hue start', type: 'range', def: 0, min: 0, max: 1,  step: 0.01,
    help: 'Phase offset in WHOLE TURNS: 1 rotates the curve once around the ' +
          'lightness axis and back to where it started.' },
  { key: 'S',  group: 'Curve', label: 'saturation',  type: 'range', def: 1, min: 0,  max: 1,  step: 0.05,
    help: 'How far the curve reaches from the lightness axis — the same in ' +
          'every direction, so the cross-section is a circle. Replaces the ' +
          'old scale-x / scale-y pair.' },

  // --- lightness ramp ------------------------------------------------------
  // `pairWith` makes the two ends ONE control with two thumbs. They keep their
  // own keys, defaults and permalink entries — only the UI is joined.
  // `cross: true` lets L0 pass above L1, which is a descending ramp: light at
  // t = -1, dark at t = +1. A range that forbade it would quietly delete half
  // of the parameter space.
  { key: 'L0', group: 'Lightness', label: 'lightness', type: 'range', def: 0, min: 0, max: 1, step: 0.01,
    pairWith: 'L1', cross: true,
    help: 'Lightness at each end of the curve: one thumb is t = -1, the other ' +
          't = +1. Drag the band between them to slide the whole ramp. ' +
          'Crossing the thumbs reverses it.' },
  { key: 'L1', group: 'Lightness', label: 'L1', type: 'range', def: 1, min: 0, max: 1, step: 0.01 },

  // --- the sub-interval the palette is taken from --------------------------
  // The same pairing, with `gap` instead of `cross`: this interval may not be
  // empty or inverted, which normalizeParams() has always enforced.
  { key: 'ta', group: 'Parametric interval', label: 'interval', type: 'range', def: -1, min: -1, max: 1, step: 0.01,
    pairWith: 'tb', gap: 0.01,
    help: 'The stretch of curve the palette is sampled from. Drag either end, ' +
          'or the band between them to slide the window along the curve.' },
  { key: 'tb', group: 'Parametric interval', label: 'tb', type: 'range', def:  1, min: -1, max: 1, step: 0.01 },

  // --- palette -------------------------------------------------------------
  { key: 'Nsample', group: 'Palette', label: 'Colors', type: 'range',
    def: 7, min: 2, max: 50, step: 1 },
  {
    key: 'perceptual', group: 'Palette', label: 'Perceptual spacing', type: 'check', def: true,
    help: 'Sample at equal steps of perceptual arc length instead of equal steps of t, ' +
          'so neighboring swatches differ by the same amount to the eye.'
  },
  {
    key: 'metric', group: 'Palette', label: 'Metric', type: 'select', def: 'de2000',
    dependsOn: 'perceptual',
    // sculpture.html loads neither reparam.js nor palette.js, so these lists
    // can legitimately be absent. An empty list makes coerceParam() fall back
    // to the default, which is what a page with no such control wants: the
    // parameter still round-trips through a shared permalink.
    options: function () {
      return (typeof METRIC_ORDER === 'undefined') ? []
        : METRIC_ORDER.map(function (k) { return {value: k, label: METRICS[k].label}; });
    },
    help: 'Color-difference formula used to measure arc length.'
  },
  {
    key: 'reverse', group: 'Palette', label: 'Reverse the curve', type: 'check', def: false,
    help: 'Hand the palette over from tb to ta (1 to -1 on the full interval): only the ' +
          'order of the swatches and of the exports flips. The curve, its bars and its ' +
          'sample points stay as they are.'
  },

  // --- what gets drawn -----------------------------------------------------
  // Neither of these enters the model: they only change how it is painted, so
  // their specs carry `view: true` and editing one skips the rebuild.
  {
    key: 'showPoints', group: 'View', label: 'Show sample points', type: 'check', def: true,
    view: true,
    help: 'Draw the dots marking the sampled colors, both on the 3-D curve and ' +
          'on the re-parameterized strip.'
  },
  {
    key: 'accumulate', group: 'View', label: 'Keep previous curves', type: 'check', def: false,
    view: true,
    help: 'Do not clear the 3-D canvas between redraws, so successive curves pile ' +
          'up on top of each other. The Clear button empties it.'
  },
  {
    key: 'showCylinder', group: 'View', label: 'Show the cylinder', type: 'check', def: false,
    view: true,
    help: 'Draw the HSL cylinder as a wireframe behind the curve: the black and ' +
          'white rims, the L = 0.5 equator, twelve lines of constant hue and the ' +
          'lightness axis. Lines on the far side are fainter.'
  },

  // --- export --------------------------------------------------------------
  {
    key: 'strsep', group: 'Export', label: 'quote', type: 'text', def: '', maxlength: 1,
    row: 'export',
    help: 'Put around each hex in the copied list, e.g. a quote.'
  },
  {
    key: 'sep', group: 'Export', label: 'separator', type: 'text', def: ',', maxlength: 1,
    row: 'export',
    help: 'Put between the hexes in the copied list.'
  }
];

// Parameters that are not user-facing controls but belong to the model.
// `hueMode` used to live here. It chose whether the hue followed the phase or
// the angle on the A/B ellipse — a question that only had two answers while
// there was an ellipse. One saturation makes them the same answer.
var HIDDEN_PARAMS = {
  placement: 'inclusive' // 'inclusive' | 'midpoint' — see samplePositions()
};

// The second half of a paired control is never shown on its own.
function isPairTail(spec) {
  return PARAM_SPECS.some(function (s) { return s.pairWith === spec.key; });
}

// ----------------------------------------------------------------------------
//  Helpers
// ----------------------------------------------------------------------------

function paramSpec(key) {
  for (var i = 0; i < PARAM_SPECS.length; i++) {
    if (PARAM_SPECS[i].key === key) { return PARAM_SPECS[i]; }
  }
  return null;
}

function defaultParams() {
  var p = {};
  for (var k in HIDDEN_PARAMS) { p[k] = HIDDEN_PARAMS[k]; }
  PARAM_SPECS.forEach(function (s) { p[s.key] = s.def; });
  return p;
}

function paramGroups() {
  var order = [], byName = {};
  PARAM_SPECS.forEach(function (s) {
    if (!byName[s.group]) { byName[s.group] = []; order.push(s.group); }
    byName[s.group].push(s);
  });
  return order.map(function (g) { return {name: g, specs: byName[g]}; });
}

// Coerce a raw value (string from an input, or from a URL) to the spec's type,
// and clamp it into range. Centralizing this is what stops NaN reaching the
// curve and coming back out as "#NANNANNAN".
function coerceParam(spec, raw) {
  switch (spec.type) {
    case 'range': {
      var v = parseFloat(raw);
      if (!isFinite(v)) { return spec.def; }
      if (spec.step === 1) { v = Math.round(v); }
      return clip(v, spec.min, spec.max);
    }
    case 'check':
      if (typeof raw === 'boolean') { return raw ? valOn(spec) : valOff(spec); }
      return (String(raw) === String(valOn(spec)) || raw === 'true' || raw === '1')
        ? valOn(spec) : valOff(spec);
    case 'select': {
      var opts = resolveOptions(spec).map(function (o) { return o.value; });
      return opts.indexOf(raw) >= 0 ? raw : spec.def;
    }
    default: {
      var s = String(raw === undefined || raw === null ? '' : raw);
      return spec.maxlength ? s.slice(0, spec.maxlength) : s;
    }
  }
}

function valOn(spec)  { return spec.on  === undefined ? true  : spec.on; }
function valOff(spec) { return spec.off === undefined ? false : spec.off; }
function isOn(spec, v) { return v === valOn(spec); }

function resolveOptions(spec) {
  return (typeof spec.options === 'function') ? spec.options() : (spec.options || []);
}

// Enforce relationships between parameters that no single control can. Called
// after every edit. The old code clamped ta against tb *after* drawing and then
// re-entered updateGradient() recursively; doing it here, before anything is
// drawn, removes both the stale frame and the recursion.
function normalizeParams(p) {
  var eps = 0.01;
  if (p.ta > p.tb - eps) {
    if (p._last === 'tb') {
      // The user dragged tb below ta: give way with ta.
      p.ta = clip(p.tb - eps, -1, 1 - eps);
    } else if (p._last === 'ta') {
      // The user dragged ta above tb: give way with tb.
      p.tb = clip(p.ta + eps, -1 + eps, 1);
    } else {
      // Not an interactive edit (a permalink with the endpoints the wrong way
      // round). Swapping preserves the interval the author clearly meant.
      var swap = p.ta; p.ta = p.tb; p.tb = swap;
      if (p.ta > p.tb - eps) { p.tb = clip(p.ta + eps, -1 + eps, 1); }
    }
  }
  if (p.L0 === undefined || !isFinite(p.L0)) { p.L0 = 0; }
  if (p.L1 === undefined || !isFinite(p.L1)) { p.L1 = 1; }
  return p;
}

// ----------------------------------------------------------------------------
//  Permalink state — params <-> query string
// ----------------------------------------------------------------------------

function paramsToQuery(p) {
  return PARAM_SPECS.filter(function (s) { return p[s.key] !== s.def; })
                    .map(function (s) {
                      return encodeURIComponent(s.key) + '=' + encodeURIComponent(p[s.key]);
                    })
                    .join('&');
}

function paramsFromQuery(query, base) {
  var p = base || defaultParams();
  if (!query) { return p; }
  query.replace(/^[?#]/, '').split('&').forEach(function (pair) {
    if (!pair) { return; }
    var i    = pair.indexOf('=');
    var key  = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
    var raw  = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1));
    var spec = paramSpec(key);
    if (spec) { p[key] = coerceParam(spec, raw); }
  });
  return normalizeParams(p);
}

var Params = {
  PARAM_SPECS, HIDDEN_PARAMS, isPairTail,
  paramSpec, defaultParams, paramGroups, coerceParam,
  valOn, valOff, isOn, resolveOptions, normalizeParams,
  paramsToQuery, paramsFromQuery
};

if (typeof module !== 'undefined' && module.exports) { module.exports = Params; }
