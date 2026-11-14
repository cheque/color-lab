// ============================================================================
//  reparam.js — perceptual re-parameterization of the curve
//
//  THE PROBLEM
//  The curve is parameterized by t, and the palette used to be sampled at
//  equally spaced t. But equal steps in t are not equal steps in *appearance*:
//  wherever the curve crosses the low-saturation core of the cylinder the
//  colours barely change, and wherever it sweeps through a saturated hue arc
//  they change fast. Uniform-t palettes therefore waste swatches on near
//  duplicates and skip over whole hue regions.
//
//  THE FIX
//  Measure arc length along the curve using a perceptual metric in CIE L*a*b*
//  (CIEDE2000 by default), build the cumulative length s(t), and sample at
//  equal steps of s instead. Formally we replace t by the inverse of
//
//      s(t) = integral from ta to t of  |dE(gamma(u))/du|  du
//
//  approximated by the polyline sum over a dense sampling. The resulting
//  palette has (approximately) equal perceived difference between neighbours.
//
//  Requires: color.js
// ============================================================================

// ----------------------------------------------------------------------------
//  Metric registry — the extension point for new distance measures
// ----------------------------------------------------------------------------
//  Every entry takes two {L,a,b} and returns a non-negative number.

var METRICS = {
  de2000: { label: 'CIEDE2000', fn: deltaE2000 },
  de94:   { label: 'CIE94',     fn: deltaE94 },
  de76:   { label: 'CIE76 (Lab Euclidean)', fn: deltaE76 }
};

var METRIC_ORDER = ['de2000', 'de94', 'de76'];

// How many segments the arc-length integral is approximated with. 512 is well
// past the point where the sampled palette stops changing (the swatch indices
// are stable to the pixel), and costs ~512 CIEDE2000 evaluations per redraw.
var ARC_SAMPLES = 512;

// ----------------------------------------------------------------------------
//  Cumulative arc length
// ----------------------------------------------------------------------------

// Tabulate s(t) for t in [ta,tb].
// Returns {ts, cum, total} with cum monotone non-decreasing and cum[0] === 0.
function arcLengthTable(curve, ta, tb, samples, metricFn, ref) {
  samples  = samples  || ARC_SAMPLES;
  metricFn = metricFn || deltaE2000;

  var ts   = new Float64Array(samples + 1);
  var cum  = new Float64Array(samples + 1);
  var prev = null;

  for (var i = 0; i <= samples; i++) {
    var t   = ta + (tb - ta) * (i / samples);
    var lab = hsl2cielab(curve(t), ref);
    ts[i]  = t;
    cum[i] = (i === 0) ? 0 : cum[i - 1] + metricFn(prev, lab);
    prev = lab;
  }

  return { ts: ts, cum: cum, total: cum[samples] };
}

// Forward lookup: given t, return the arc length s(t) reached there.
// `ts` is uniform in t, so the bracketing segment is found by arithmetic rather
// than by search. Used to draw the tie-lines between the clipped strip and the
// re-parameterized strip: a given t sits at height (t-ta)/(tb-ta) in the first
// and at height s(t)/total in the second, and the lines between them are the
// re-parameterization made visible.
function arcLengthAt(table, t) {
  var ts = table.ts, n = ts.length - 1;
  var ta = ts[0], tb = ts[n];
  if (tb === ta) { return 0; }

  var x = (t - ta) / (tb - ta) * n;
  if (x <= 0) { return 0; }
  if (x >= n) { return table.cum[n]; }

  var i = Math.floor(x);
  return table.cum[i] + (x - i) * (table.cum[i + 1] - table.cum[i]);
}

// Invert the table: given an arc length s, return the t that reaches it.
// Binary search for the bracketing segment, then linear interpolation inside
// it (the segment is short enough that s is effectively affine there).
function arcLengthInvert(table, s) {
  var cum = table.cum, ts = table.ts;
  var hi  = cum.length - 1;

  if (!(s > 0))            { return ts[0]; }
  if (s >= cum[hi])        { return ts[hi]; }

  var lo = 0;
  while (hi - lo > 1) {
    var mid = (lo + hi) >> 1;
    if (cum[mid] <= s) { lo = mid; } else { hi = mid; }
  }

  var span = cum[hi] - cum[lo];
  var frac = (span > 0) ? (s - cum[lo]) / span : 0;
  return ts[lo] + frac * (ts[hi] - ts[lo]);
}

// ----------------------------------------------------------------------------
//  The re-parameterization itself
// ----------------------------------------------------------------------------

// Build  u in [0,1] -> t in [ta,tb].
//
// opts: { enabled, metric, samples, ref }
//   enabled : false gives back the plain affine map (uniform in t)
//   metric  : key into METRICS, or a function (lab1,lab2) -> number
//
// The returned function carries a `.table` (null when disabled) and a
// `.total` so callers can report the total perceptual length of the curve.
function makeReparam(curve, ta, tb, opts) {
  opts = opts || {};

  var uniform = function (u) { return ta + (tb - ta) * clip(u, 0, 1); };
  uniform.table = null;
  uniform.total = 0;
  uniform.perceptual = false;

  if (!opts.enabled) { return uniform; }

  var m = opts.metric;
  var metricFn = (typeof m === 'function') ? m
               : (METRICS[m] || METRICS.de2000).fn;

  var table = arcLengthTable(curve, ta, tb, opts.samples, metricFn, opts.ref);

  // A constant-colour curve has zero length and nothing to equalize; fall back
  // rather than dividing by zero.
  if (!(table.total > 0)) { return uniform; }

  var f = function (u) { return arcLengthInvert(table, clip(u, 0, 1) * table.total); };
  f.table = table;
  f.total = table.total;
  f.perceptual = true;
  return f;
}

var Reparam = {
  METRICS, METRIC_ORDER, ARC_SAMPLES,
  arcLengthTable, arcLengthAt, arcLengthInvert, makeReparam
};

if (typeof module !== 'undefined' && module.exports) { module.exports = Reparam; }
