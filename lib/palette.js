// ============================================================================
//  palette.js — sampling a curve into a finite palette, and exporting it
//
//  Requires: color.js, curve.js, reparam.js
// ============================================================================

// ----------------------------------------------------------------------------
//  Sampling
// ----------------------------------------------------------------------------
//  Two placements of the n sample points on the unit interval:
//
//    'inclusive' u_k = k/(n-1)     — DEFAULT. The first swatch lands exactly on
//                                    ta and the last exactly on tb, so dragging
//                                    the interval handles gives direct control
//                                    of the palette's start and end colours.
//
//    'midpoint'  u_k = (k+0.5)/n   — the original behaviour: n equal bands,
//                                    each represented by its centre. The
//                                    endpoints of [ta,tb] are never reached, so
//                                    the extreme colours drift as n changes.

function samplePositions(n, placement) {
  var u = new Array(n);
  var k;
  if (placement === 'midpoint' || n < 2) {
    for (k = 0; k < n; k++) { u[k] = (k + 0.5) / n; }
  } else {
    for (k = 0; k < n; k++) { u[k] = k / (n - 1); }
  }
  return u;
}

// Sample a curve into n colours.
//
// opts: { n, ta, tb, placement, perceptual, metric, ref, reverse }
//
// `reverse` traverses the interval from tb to ta (u -> 1 - u).  Both placements and the
// arc-length reparametrisation are symmetric under that flip, so it is exactly the same
// colours in the opposite order -- but defined as a direction, not as a list operation.
//
// Returns { swatches, reparam } where each swatch is
//   { u, t, hsl, rgb, hex, dE }   (dE = perceptual distance to the previous
//                                  swatch, 0 for the first)
//
// When `perceptual` is on, the u -> t map is the arc-length inverse from
// reparam.js, so consecutive swatches are (approximately) equally different to
// the eye instead of equally spaced in t.
function samplePalette(curve, opts) {
  opts = opts || {};
  var n  = Math.max(1, Math.round(opts.n || 7));
  var ta = (opts.ta === undefined) ? -1 : opts.ta;
  var tb = (opts.tb === undefined) ?  1 : opts.tb;
  var ref = opts.ref;

  var reparam = makeReparam(curve, ta, tb, {
    enabled: !!opts.perceptual,
    metric:  opts.metric,
    ref:     ref
  });

  var us = samplePositions(n, opts.placement);
  var swatches = new Array(n);
  var prevLab = null;

  for (var k = 0; k < n; k++) {
    var t   = reparam(opts.reverse ? 1 - us[k] : us[k]);
    var hsl = curve(t);
    var c   = hsl2rgb(hsl);
    var lab = hsl2cielab(hsl, ref);

    swatches[k] = {
      u: us[k], t: t, hsl: hsl, rgb: c, hex: toHex(c),
      dE: prevLab ? deltaE2000(prevLab, lab) : 0
    };
    prevLab = lab;
  }

  return { swatches: swatches, reparam: reparam };
}

// How uniform is a palette, perceptually? Returns the coefficient of variation
// of the neighbour distances (0 = perfectly even). Handy to show that the
// re-parameterization is doing something, and useful as a regression check.
function paletteEvenness(swatches) {
  if (swatches.length < 3) { return 0; }
  var d = swatches.slice(1).map(function (s) { return s.dE; });
  var mean = d.reduce(function (a, b) { return a + b; }, 0) / d.length;
  if (mean === 0) { return 0; }
  var varc = d.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / d.length;
  return Math.sqrt(varc) / mean;
}

// ----------------------------------------------------------------------------
//  Export
// ----------------------------------------------------------------------------
//  FORMATS is the extension point: add an entry to offer a new export format.
//  Each `fn` takes the hex strings plus the options and returns text.
//
//  Every format carries `o.source`, a link back to the app WITH the parameters
//  that made the palette. It is not a credit line: these palettes are points on
//  a curve, so the link is the only part of an export that can be re-opened,
//  resampled to a different number of colours, or nudged. A bare list of hexes
//  is a dead end; the same list with its curve is not.

var HOME = 'https://cheque.github.io/color-curves/';

var FORMATS = {
  list: {
    label: 'Delimited list',
    fn: function (hexes, o) {
      return hexes.map(function (h) { return o.strsep + h + o.strsep; })
                  .join(o.sep + '\n') + (o.source ? '\n\n// ' + o.source : '');
    }
  },
  css: {
    label: 'CSS custom properties',
    fn: function (hexes, o) {
      return (o.source ? '/* ' + o.source + ' */\n' : '') +
        ':root {\n' + hexes.map(function (h, i) {
          return '  --palette-' + (i + 1) + ': ' + h.toLowerCase() + ';';
        }).join('\n') + '\n}';
    }
  },
  json: {
    label: 'JSON array',
    fn: function (hexes, o) {
      // An object rather than a bare array, so the link has somewhere to live.
      return JSON.stringify({
        name: o.name || 'color-curves',
        source: o.source || HOME,
        palette: hexes
      }, null, 2);
    }
  },
  gpl: {
    label: 'GIMP palette (.gpl)',
    fn: function (hexes, o) {
      // The .gpl format takes # comments after the header, and GIMP keeps them.
      var head = 'GIMP Palette\nName: ' + (o.name || 'color-curves') +
                 '\nColumns: 0\n#\n# ' + (o.source || HOME) + '\n#\n';
      return head + hexes.map(function (h, i) {
        var c = hex2rgb(h);
        return String(c.R).padStart(3) + ' ' + String(c.G).padStart(3) + ' ' +
               String(c.B).padStart(3) + '\tcolor ' + (i + 1);
      }).join('\n');
    }
  }
};

var FORMAT_ORDER = ['list', 'css', 'json', 'gpl'];

// Render a palette as text. Previously the on-screen text and the clipboard
// disagreed: the box was built with the separator/delimiter settings but the
// Export button copied the raw array, so it always came out comma-joined with
// no delimiters. Both now go through this one function.
function formatPalette(hexes, opts) {
  opts = opts || {};
  var f = FORMATS[opts.format || 'list'] || FORMATS.list;
  return f.fn(hexes, {
    sep:    (opts.sep === undefined) ? ',' : opts.sep,
    strsep: (opts.strsep === undefined) ? '' : opts.strsep,
    name:   opts.name,
    source: opts.source
  });
}

// The app link for a parameter set: the palette, and the curve it came from.
function paletteSource(query) { return HOME + (query ? '?' + query : ''); }

var Palettes = {
  samplePositions, samplePalette, paletteEvenness,
  HOME, paletteSource, FORMATS, FORMAT_ORDER, formatPalette
};

if (typeof module !== 'undefined' && module.exports) { module.exports = Palettes; }
