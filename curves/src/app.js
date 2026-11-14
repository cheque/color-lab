// ============================================================================
//  app.js — the demo application: controls, canvases, interaction
//
//  This is the only file that touches the DOM. Everything above it (color,
//  curve, reparam, palette, params) is pure and reusable, which is what makes
//  the widget in WIDGET_PLAN.md possible.
//
//  Requires: color.js, curve.js, reparam.js, palette.js, params.js, scene.js,
//            rangepair.js
// ============================================================================

(function () {
'use strict';

// ----------------------------------------------------------------------------
//  Configuration
// ----------------------------------------------------------------------------

var GRADIENT_W = 400, GRADIENT_H = 800;   // gradient canvas
var CURVE_W    = 800, CURVE_H    = 800;   // 3-D plot canvas
var GRADIENT_SAMPLES = GRADIENT_H;        // one row per pixel
var CURVE_SAMPLES    = 2000;              // polyline segments in the 3-D plot

// Four strips, left to right, each stage of the pipeline made visible:
//   1 full     the whole curve, t in [-1,1]
//   2 clip     cropped to [ta,tb], still uniform in t
//   3 spaced   the same crop after the perceptual re-parameterization
//   4 palette  the n colors actually sampled from it
// Separating 2 from 3 is what makes the re-parameterization legible: the two
// strips hold the same colors, only redistributed.
var BAR_W  = 64;
var BAR_X  = [0, 112, 224, 336];          // pitch 112 = 64 bar + 48 gutter
var BAR_FULL = 0, BAR_CLIP = 1, BAR_SPACED = 2, BAR_PAL = 3;

// ----------------------------------------------------------------------------
//  State
// ----------------------------------------------------------------------------

var P = paramsFromQuery(window.location.search, defaultParams());

var camera = {th: 0.375, ph: 0.05};       // azimuth / elevation, in TURNS

// Cached model output. `dirty` guards the expensive part: dragging the 3-D view
// only moves the camera, so the curve's colors and cylinder coordinates do not
// need recomputing. The old code re-evaluated 5000 hsl2rgb conversions on every
// single mousemove event.
var model = {dirty: true, colors: null, points: null, palette: null};

var els = {};   // key -> {input, slider} built from PARAM_SPECS

// ----------------------------------------------------------------------------
//  Canvases
// ----------------------------------------------------------------------------

var canvasG = document.getElementById('gradient');
var ctxG    = canvasG.getContext('2d');
canvasG.width  = GRADIENT_W;
canvasG.height = GRADIENT_H;
ctxG.transform(1, 0, 0, -1, 0, GRADIENT_H);   // y up

var canvasC = document.getElementById('curve');
var ctxC    = fitCanvas(canvasC, CURVE_W);   // origin centered, y up, unit sphere

// ----------------------------------------------------------------------------
//  Control construction (driven entirely by PARAM_SPECS)
// ----------------------------------------------------------------------------

function el(tag, attrs, children) {
  var n = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') { n.className = attrs[k]; }
      else if (k === 'text') { n.textContent = attrs[k]; }
      else { n.setAttribute(k, attrs[k]); }
    });
  }
  (children || []).forEach(function (c) { n.appendChild(c); });
  return n;
}

// The Export box's buttons. This table is the whole of them: the wording, the
// format each one copies, and its tooltip. Add a row to add a button.
var EXPORT_BUTTONS = [
  {label: 'copy', format: 'list', help: 'Copy as a delimited list'},
  {label: 'css',  format: 'css',  help: 'Copy as CSS custom properties'},
  {label: 'json', format: 'json', help: 'Copy as JSON'},
  {label: 'gimp', format: 'gpl',  help: 'Copy as a GIMP .gpl palette'}
];

function buildControls(root) {
  paramGroups().forEach(function (group) {
    var box = el('fieldset', {class: 'group'});
    box.appendChild(el('legend', {text: group.name}));

    // Specs sharing a `row` id share one line, which is how the two one-letter
    // export fields stop taking a full row each.
    var line = null, lineId = null;
    group.specs.forEach(function (spec) {
      if (isPairTail(spec)) { return; }   // drawn by its head's two-thumb control
      if (spec.row) {
        if (lineId !== spec.row) {
          line = el('div', {class: 'row row-inline'});
          lineId = spec.row;
          box.appendChild(line);
        }
        line.appendChild(buildInline(spec));
        return;
      }
      line = null; lineId = null;
      box.appendChild(buildControl(spec));
    });

    if (group.name === 'Export') { box.appendChild(buildExportButtons()); }
    root.appendChild(box);
  });
}

// One button per format, built and wired in the same place. Pressing a button
// IS choosing the format, which is why no format is stored anywhere.
function buildExportButtons() {
  var bar = el('div', {class: 'actions'});
  EXPORT_BUTTONS.forEach(function (b) {
    var btn = el('button', {type: 'button', text: b.label, title: b.help});
    btn.addEventListener('click', function () { copyPalette(b.format); });
    bar.appendChild(btn);
  });
  return bar;
}

// A compact label+field pair for a shared line.
function buildInline(spec) {
  var wrap = el('span', {class: 'inline-field'});
  wrap.appendChild(el('label', {text: spec.label, for: 'p-' + spec.key}));
  var txt = el('input', {type: 'text', class: 'num inline-num', id: 'p-' + spec.key,
                         maxlength: spec.maxlength || 8, size: 1});
  if (spec.help) { wrap.title = spec.help; }
  txt.addEventListener('input', function () { setParam(spec, txt.value); });
  wrap.appendChild(txt);
  els[spec.key] = {row: wrap, text: txt};
  return wrap;
}

function buildControl(spec) {
  var row = el('div', {class: 'row', 'data-key': spec.key});
  row.appendChild(el('label', {text: spec.label, for: 'p-' + spec.key}));
  if (spec.help) { row.title = spec.help; }

  var handle = {row: row};

  // A paired spec owns two parameters and one control. It is checked before
  // the type switch because it overrides how a 'range' is drawn.
  if (spec.pairWith) {
    var tail = paramSpec(spec.pairWith);
    // One readout per END, not one per parameter: they sit at the left and
    // right of the track and report whichever thumb is there. Lightness thumbs
    // may cross, and when they do the numbers stay under the thumb you are
    // looking at rather than swapping sides.
    var lo   = el('span', {class: 'pair-val pair-lo'});
    var hi   = el('span', {class: 'pair-val pair-hi'});
    var pair = makeRangePair({
      min: spec.min, max: spec.max, step: spec.step,
      a: P[spec.key], b: P[tail.key],
      cross: spec.cross, gap: spec.gap,
      onInput: function (a, b) {
        P[spec.key]  = coerceParam(spec, a);
        P[tail.key]  = coerceParam(tail, b);
        P._last = null;                 // both ends moved; no single culprit
        normalizeParams(P);
        model.dirty = true;
        render();
      }
    });
    row.appendChild(lo);
    row.appendChild(pair.el);
    row.appendChild(hi);
    handle.pair = pair;
    handle.lo = lo;
    handle.hi = hi;
    handle.tail = tail;
    els[spec.key] = handle;
    return row;
  }

  switch (spec.type) {
    case 'range': {
      var num = el('input', {type: 'number', class: 'num', id: 'p-' + spec.key,
                             min: spec.min, max: spec.max, step: spec.step});
      var sld = el('input', {type: 'range', class: 'slider',
                             min: spec.min, max: spec.max, step: spec.step});
      // Both controls write the same parameter; `input` covers dragging and
      // typing, so the separate onchange handlers of the old markup are gone.
      num.addEventListener('input', function () { setParam(spec, num.value); });
      sld.addEventListener('input', function () { setParam(spec, sld.value); });
      row.appendChild(num); row.appendChild(sld);
      handle.num = num; handle.slider = sld;
      break;
    }
    case 'select': {
      var sel = el('select', {id: 'p-' + spec.key});
      resolveOptions(spec).forEach(function (o) {
        sel.appendChild(el('option', {value: o.value, text: o.label}));
      });
      sel.addEventListener('change', function () { setParam(spec, sel.value); });
      row.appendChild(sel);
      handle.select = sel;
      break;
    }
    case 'check': {
      var chk = el('input', {type: 'checkbox', id: 'p-' + spec.key});
      chk.addEventListener('change', function () { setParam(spec, chk.checked); });
      row.insertBefore(chk, row.firstChild);
      handle.check = chk;
      break;
    }
    default: {
      var txt = el('input', {type: 'text', class: 'num', id: 'p-' + spec.key,
                             maxlength: spec.maxlength || 8, size: 2});
      txt.addEventListener('input', function () { setParam(spec, txt.value); });
      row.appendChild(txt);
      handle.text = txt;
    }
  }

  els[spec.key] = handle;
  return row;
}

// Single entry point for every parameter edit.
function setParam(spec, raw) {
  P[spec.key] = coerceParam(spec, raw);
  P._last = spec.key;
  normalizeParams(P);
  if (!spec.view) { model.dirty = true; }   // view flags only change the paint
  render();
}

// Push the current parameter values back into the controls. Only needed for
// values normalizeParams() may have adjusted and for the initial paint, but it
// is cheap and keeps number/slider pairs in lockstep.
function syncControls() {
  PARAM_SPECS.forEach(function (spec) {
    var h = els[spec.key], v = P[spec.key];
    if (!h) { return; }
    if (h.pair)   {
      var w = P[h.tail.key];
      h.pair.set(v, w);
      h.lo.textContent = fmtPair(Math.min(v, w));
      h.hi.textContent = fmtPair(Math.max(v, w));
    }
    if (h.num)    { if (document.activeElement !== h.num) { h.num.value = v; } h.slider.value = v; }
    if (h.select) { h.select.value = v; }
    if (h.check)  { h.check.checked = isOn(spec, v); }
    if (h.text)   { if (document.activeElement !== h.text) { h.text.value = v; } }

    // Gray out controls whose prerequisite is off (e.g. the metric picker when
    // perceptual spacing is disabled).
    if (spec.dependsOn) {
      var parts  = spec.dependsOn.split(':');
      var pspec  = paramSpec(parts[0]);
      var active = (parts.length > 1) ? (P[parts[0]] === parts[1])
                                      : isOn(pspec, P[parts[0]]);
      h.row.classList.toggle('disabled', !active);
    }
  });

  // k is the control, p = 2^k is what the envelope actually uses; show both,
  // so the slider is legible without doing the arithmetic in your head.
  var kRow = els.k && els.k.row.querySelector('label');
  if (kRow) { kRow.textContent = 'k · p=' + shapeP(P).toFixed(2); }
}

function fmtPair(v) { return (v === Math.round(v)) ? String(v) : v.toFixed(2); }

// ----------------------------------------------------------------------------
//  Rendering
// ----------------------------------------------------------------------------

function render() {
  syncControls();
  var curve = makeCurve(P);
  if (model.dirty) { rebuild(curve); }
  drawGradient();
  drawCurve();
  writePalette();
  updatePermalink();
}

// Recompute everything that depends on the parameters but not on the camera.
function rebuild(curve) {
  var full   = new Array(GRADIENT_SAMPLES);
  var clip   = new Array(GRADIENT_SAMPLES);
  var spaced = new Array(GRADIENT_SAMPLES);

  // The third strip is drawn through the same u -> t map the palette uses, so
  // comparing it with the second shows exactly what the re-parameterization
  // did before any sampling happens.
  var map = makeReparam(curve, P.ta, P.tb, {
    enabled: !!P.perceptual, metric: P.metric
  });

  for (var i = 0; i < GRADIENT_SAMPLES; i++) {
    var u = (i + 0.5) / GRADIENT_SAMPLES;
    full[i]   = toHex(hsl2rgb(curve(-1 + 2 * u)));
    clip[i]   = toHex(hsl2rgb(curve(P.ta + (P.tb - P.ta) * u)));
    spaced[i] = toHex(hsl2rgb(curve(map(u))));
  }

  // The 3-D polyline: colors and cylinder coordinates, camera-independent.
  var point  = makeCurvePoint(P);
  var colors = new Array(CURVE_SAMPLES + 1);
  var points = new Array(CURVE_SAMPLES + 1);
  var inSel  = new Array(CURVE_SAMPLES + 1);
  for (var k = 0; k <= CURVE_SAMPLES; k++) {
    var t = -1 + 2 * (k / CURVE_SAMPLES);
    colors[k] = toHex(hsl2rgb(curve(t)));
    points[k] = point(t);
    inSel[k]  = (t >= P.ta && t <= P.tb);
  }
  model.point = point;

  model.full = full;
  model.clip = clip;
  model.spaced = spaced;
  model.map = map;
  model.colors = colors;
  model.points = points;
  model.inSel = inSel;
  model.palette = samplePalette(curve, {
    n: P.Nsample, ta: P.ta, tb: P.tb,
    perceptual: !!P.perceptual, metric: P.metric, placement: P.placement
  });
  model.dirty = false;
}

function drawGradient() {
  ctxG.setTransform(1, 0, 0, 1, 0, 0);
  ctxG.clearRect(0, 0, GRADIENT_W, GRADIENT_H);
  ctxG.transform(1, 0, 0, -1, 0, GRADIENT_H);

  // u runs 0..1 bottom to top, matching t running ta..tb.
  var y = function (u) { return u * GRADIENT_H; };

  // Strips 1-3: one row of pixels per sample.
  // The old code called rect(0, k, 100, k+1) — passing a HEIGHT that grew with
  // k. It happened to look right because each row was overpainted by the next,
  // but it did ~400x the fill work it needed to.
  for (var i = 0; i < GRADIENT_SAMPLES; i++) {
    ctxG.fillStyle = model.full[i];
    ctxG.fillRect(BAR_X[BAR_FULL], i, BAR_W, 1);
    ctxG.fillStyle = model.clip[i];
    ctxG.fillRect(BAR_X[BAR_CLIP], i, BAR_W, 1);
    ctxG.fillStyle = model.spaced[i];
    ctxG.fillRect(BAR_X[BAR_SPACED], i, BAR_W, 1);
  }

  // Strip 4: the palette, as exact equal-height bands.
  var sw = model.palette.swatches;
  var band = GRADIENT_H / sw.length;
  for (var k = 0; k < sw.length; k++) {
    ctxG.fillStyle = sw[k].hex;
    ctxG.fillRect(BAR_X[BAR_PAL], k * band, BAR_W, Math.ceil(band));
  }

  ctxG.save();
  ctxG.strokeStyle = '#FFFFFF';

  // 1 -> 2 : the interval clip. Dashed leaders from ta and tb on the full
  // strip to the top and bottom of the cropped one.
  ctxG.lineWidth = 2;
  ctxG.setLineDash([5, 3]);
  line(right(BAR_FULL), y((P.ta + 1) / 2), BAR_X[BAR_CLIP], 0);
  line(right(BAR_FULL), y((P.tb + 1) / 2), BAR_X[BAR_CLIP], GRADIENT_H);

  // 2 -> 3 : the re-parameterization. Each tie-line joins the SAME t in both
  // strips, so where the lines splay apart the curve is being stretched and
  // where they bunch it is being compressed. Parallel lines mean no warp,
  // which is exactly what you should see with the checkbox off.
  ctxG.setLineDash([]);
  ctxG.lineWidth = 1;
  ctxG.globalAlpha = 0.45;
  var table = model.map.table;
  var TIES = 24;
  for (var j = 0; j <= TIES; j++) {
    var u = j / TIES;
    var t = P.ta + (P.tb - P.ta) * u;
    var v = (table && model.map.total > 0)
      ? arcLengthAt(table, t) / model.map.total
      : u;
    line(right(BAR_CLIP), y(u), BAR_X[BAR_SPACED], y(v));
  }

  // 3 -> 4 : the sampling. One line per swatch, from where it sits on the
  // re-parameterized strip to the middle of its band.
  ctxG.globalAlpha = 0.85;
  for (var m = 0; m < sw.length; m++) {
    line(right(BAR_SPACED), y(sw[m].u), BAR_X[BAR_PAL], (m + 0.5) * band);
  }
  ctxG.restore();

  // The sample points themselves, marked on the re-parameterized strip — the
  // same points as the dots on the 3-D curve. They are evenly spaced *here* by
  // construction, in both modes: this strip is the one sampling is uniform in.
  // What perceptual spacing changes is which colors end up at those heights,
  // which is what the tie-lines to the left show.
  if (P.showPoints) {
    var dotR = Math.min(5, Math.max(2, band / 3));
    var cx = BAR_X[BAR_SPACED] + BAR_W / 2;
    ctxG.save();
    ctxG.lineWidth = 1.5;
    ctxG.strokeStyle = '#FFFFFF';
    for (var d = 0; d < sw.length; d++) {
      // The first and last samples sit exactly on ta and tb, i.e. on the very
      // edge of the strip, so nudge them inwards to keep the marker whole.
      var cy = clip(y(sw[d].u), dotR + 1, GRADIENT_H - dotR - 1);
      ctxG.beginPath();
      ctxG.arc(cx, cy, dotR, 0, 2 * Math.PI);
      ctxG.fillStyle = sw[d].hex;
      ctxG.fill();
      ctxG.stroke();
    }
    ctxG.restore();
  }

  function right(bar) { return BAR_X[bar] + BAR_W; }

  function line(x0, y0, x1, y1) {
    ctxG.beginPath();
    ctxG.moveTo(x0, y0);
    ctxG.lineTo(x1, y1);
    ctxG.stroke();
  }
}

// --- 3-D view (projection lives in scene.js) --------------------------------

// `opts.clear` forces the wipe that the "Keep previous curves" checkbox
// otherwise suppresses; it is what the Clear button uses.
function drawCurve(opts) {
  var cleared = !P.accumulate || (opts && opts.clear);
  // The default frame fits the unit sphere. The cylinder's rims project up to
  // sqrt(2) from the center (cos ph + sin ph at ph = 1/8 turn), so showing it
  // zooms out by that factor — a fixed scale, so dragging never makes it pulse.
  var s = (CURVE_W / 2) * (P.showCylinder ? 0.875 / Math.SQRT2 : 0.875);
  ctxC.setTransform(s, 0, 0, -s, CURVE_W / 2, CURVE_W / 2);
  if (cleared) { ctxC.clearRect(-2, -2, 4, 4); }

  var basis = cameraBasis(camera);

  // Behind the curve, so it never covers a color. Only on a fresh canvas:
  // with "Keep previous curves" on, its translucent lines would otherwise
  // pile up and brighten on every redraw.
  if (P.showCylinder && cleared) { drawCylinder(ctxC, basis); }

  strokeCurve(ctxC, projectAll(model.points, basis), model.colors, function (k) {
    return model.inSel[k] ? 0.022 : 0.008;
  });

  // Mark where the palette actually lands on the curve. Positions come from
  // the same map as the polyline, so the dots sit exactly on it.
  if (P.showPoints) {
    model.palette.swatches.forEach(function (s) {
      drawDot(ctxC, model.point(s.t), basis,
              {r: 0.018, fill: s.hex, stroke: '#FFFFFF', width: 0.006});
    });
  }
}

// ----------------------------------------------------------------------------
//  Palette output
// ----------------------------------------------------------------------------

// The palette as it is handed over. `reverse` flips only this: the swatches and the exports.
// model.palette stays in curve order, so the palette bar, the sample points and their
// connecting lines keep describing the curve as it is.
function outputSwatches() {
  var sw = model.palette.swatches;
  return P.reverse ? sw.slice().reverse() : sw;
}

function paletteText(format) {
  return formatPalette(outputSwatches().map(function (s) { return s.hex; }), {
    format: format, sep: P.sep, strsep: P.strsep, name: 'color-curves',
    source: paletteSource(paramsToQuery(P))
  });
}

// The palette used to be printed into a <pre> as well as copied. Two renderings
// of the same list is one too many — the swatches show it and the buttons hand
// it over — so the box is gone and this only paints the colors.
function writePalette() {
  var sw = outputSwatches();
  var strip = document.getElementById('swatches');
  strip.innerHTML = '';
  sw.forEach(function (s) {
    var b = el('div', {class: 'swatch', title: s.hex + '  (t = ' + s.t.toFixed(3) + ')'});
    b.style.background = s.hex;
    strip.appendChild(b);
  });

  var cv = paletteEvenness(sw);
  document.getElementById('evenness').textContent =
    P.perceptual
      ? 'perceptually spaced — neighbor ΔE spread ' + (100 * cv).toFixed(1) + '%'
      : 'uniform in t — neighbor ΔE spread ' + (100 * cv).toFixed(1) + '%';
}

function updatePermalink() {
  var q = paramsToQuery(P);
  var url = window.location.pathname + (q ? '?' + q : '');
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', url);
  }
}

// ----------------------------------------------------------------------------
//  Interaction
// ----------------------------------------------------------------------------

function inCanvas(canvas, pos) {
  var r = canvas.getBoundingClientRect();
  return pos.x >= r.left && pos.y >= r.top && pos.x <= r.right && pos.y <= r.bottom;
}

var isMoving = false;

canvasC.addEventListener('mousedown', function (e) {
  if (e.buttons === 1) { isMoving = true; e.preventDefault(); }
});

window.addEventListener('mouseup', function () { isMoving = false; });

window.addEventListener('mousemove', function (e) {
  var pos = {x: e.clientX, y: e.clientY};
  if (inCanvas(canvasC, pos)) {
    document.body.style.cursor = isMoving ? 'grabbing' : 'grab';
  } else if (!isMoving) {
    document.body.style.cursor = 'auto';
  }
  if (!isMoving) { return; }

  orbitCamera(camera, e.movementX, e.movementY);
  drawCurve();      // camera only — no need to rebuild the model
});

// ----------------------------------------------------------------------------
//  Buttons
// ----------------------------------------------------------------------------

function flash(msg) {
  var n = document.getElementById('status');
  n.textContent = msg;
  n.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(function () { n.classList.remove('show'); }, 1800);
}

// Copy the palette in one format, with the link that reopens the curve.
function copyPalette(format) {
  var text = paletteText(format);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(function () { flash(FORMATS[format].label + ' copied to clipboard'); })
      .catch(function () { flash('Could not copy to the clipboard'); });
  } else {
    flash('Clipboard unavailable in this browser');
  }
}

document.getElementById('reset').addEventListener('click', function () {
  P = defaultParams();
  model.dirty = true;
  render();
  flash('Parameters reset');
});

document.getElementById('clear').addEventListener('click', function () {
  drawCurve({clear: true});
});

document.getElementById('permalink').addEventListener('click', function () {
  var url = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { flash('Link copied'); });
  } else {
    flash(url);
  }
});

// ----------------------------------------------------------------------------
//  Boot
// ----------------------------------------------------------------------------

buildControls(document.getElementById('controls'));
render();

})();
