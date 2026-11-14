// ============================================================================
//  widget.js — the embeddable palette picker
//
//  A second front end over the same core as index.html. It is not a smaller
//  copy of the lab: the lab is an instrument for studying the curve, this is a
//  tool for leaving with n colours. Layout, top to bottom:
//
//      ┌──────┬────────────────────────────────────┐
//      │ ◐ ◑  │  k  cyc  hue  sat  light  interval │   envelope + 6 verticals
//      ├──────┴────────────────────────────────────┤
//      │  colours ──────●───────────  7            │
//      │  ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓                     │
//      │  [copy] [json] [gimp]      [ APPLY ]      │
//      └───────────────────────────────────────────┘
//
//  Public API — mount() returns a handle:
//
//      var picker = mountPicker(el, {
//        params:   {...},                  // optional starting point
//        onChange: function (hexes, params) {},
//        onApply:  function (hexes, params) {}
//      });
//      picker.getPalette();   // -> ['#1b2a4a', ...]   plain JS array of hex
//      picker.getParams();    // -> a plain object you can hand back later
//      picker.setParams({N: 3});
//      picker.destroy();
//
//  Apply also fires a DOM event on the host element, so an embedder who is not
//  holding a JS reference can still receive it:
//
//      el.addEventListener('colorcurves:apply', function (e) {
//        e.detail.palette;    // the same array
//      });
//
//  Requires: color.js, curve.js, reparam.js, palette.js, params.js,
//            rangepair.js
// ============================================================================

(function (global) {
'use strict';

// ----------------------------------------------------------------------------
//  The controls, in the order they appear
// ----------------------------------------------------------------------------
//  Each vertical slider names a parameter from PARAM_SPECS; the paired ones
//  (lightness, interval) become two-thumb sliders exactly as in the lab. The
//  widget deliberately does NOT invent parameters of its own — anything it can
//  set, the lab can set, and a permalink carries between them.

var COLUMNS = ['k', 'N', 't0', 'S', 'L0', 'ta'];

// Shorter than the lab's labels: the column is 44px wide.
var SHORT = {
  k: 'k', N: 'cycles', t0: 'hue', S: 'sat.', L0: 'light', ta: 'interval'
};

var ENVELOPES = [
  {key: 'pcircle', title: 'circle — a rounded envelope, full at the centre'},
  {key: 'pbell',   title: 'bell — a peak at the centre, fading to the ends'}
];

var SWATCH_SAMPLES = 64;      // resolution of the gradient behind the interval

// ----------------------------------------------------------------------------
//  Styles — injected once, every rule scoped under .cc-widget
// ----------------------------------------------------------------------------

var CSS = [
'.cc-widget{--cc-bg:#5b5b5b;--cc-ink:#fff;--cc-muted:#d6d6d6;--cc-line:#7a7a7a;',
'  --cc-field:#3a3a3a;--cc-accent:#49f5da;',
'  display:inline-block;width:392px;max-width:100%;padding:14px;border-radius:10px;',
'  background:var(--cc-bg);',
'  color:var(--cc-ink);font-family:system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;',
'  font-size:13px;box-sizing:border-box}',
'.cc-widget *{box-sizing:border-box}',
'.cc-top{display:flex;gap:14px;align-items:stretch}',
'.cc-envs{display:flex;flex-direction:column;gap:10px;justify-content:center}',
'.cc-envwrap{display:flex;flex-direction:column;align-items:center;gap:3px}',
'.cc-env{width:54px;height:54px;border-radius:12px;border:2px solid var(--cc-line);',
'  background:var(--cc-field);cursor:pointer;padding:0;display:block}',
'.cc-env svg{display:block;width:100%;height:100%}',
'.cc-env.on{border-color:var(--cc-accent)}',
'.cc-env:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}',
'.cc-cols{display:flex;gap:6px;flex:1 1 auto}',
'.cc-col{display:flex;flex-direction:column;align-items:center;gap:4px;width:46px}',
'.cc-col .rp{flex:1 1 auto}',
'.cc-cap{font-size:10px;color:var(--cc-muted);letter-spacing:.03em;text-align:center;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
'.cc-val{font-size:10px;color:var(--cc-accent);font-family:ui-monospace,Menlo,Consolas,monospace}',
'.cc-rule{height:0;border:0;border-top:1px solid var(--cc-line);margin:12px 0}',
'.cc-count{display:flex;align-items:center;gap:8px;margin-top:0}',
'.cc-count .cc-cap{flex:0 0 auto}',
'.cc-count .rp{flex:1 1 auto}',
'.cc-toggles{display:flex;gap:14px;margin-top:8px;font-size:11px;color:var(--cc-muted)}',
'.cc-toggles label{display:flex;align-items:center;gap:5px;cursor:pointer}',
'.cc-toggles input{accent-color:var(--cc-accent);margin:0}',
// Ten to a line, whatever the width: 1fr columns plus a square aspect keeps
// the boxes the same size whether the palette has 3 colours or 50.
'.cc-swatches{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:0}',
'.cc-sw{aspect-ratio:1;border:2px solid #fff;border-radius:6px}',
'.cc-actions{display:flex;gap:6px;align-items:center;justify-content:center;margin-top:12px}',
'.cc-btn{font:inherit;font-size:12px;color:var(--cc-ink);background:var(--cc-field);',
'  border:1px solid var(--cc-line);border-radius:5px;padding:5px 10px;cursor:pointer}',
'.cc-btn:hover{border-color:var(--cc-accent);color:var(--cc-accent)}',
'.cc-btn.cc-reverse{margin-left:auto;padding:1px 8px;font-size:11px}',
'.cc-btn.cc-reverse.on{border-color:var(--cc-accent);color:var(--cc-accent)}',
'.cc-apply{flex:1 1 auto;margin-top:10px;padding:11px;font-size:14px;font-weight:600;',
'  letter-spacing:.04em;background:var(--cc-accent);color:#123;border:none;',
'  border-radius:8px;cursor:pointer;width:100%}',
'.cc-apply:hover{filter:brightness(1.08)}',
'.cc-note{font-size:10px;color:var(--cc-muted);margin-top:8px;text-align:right}',
'.cc-note a{color:var(--cc-accent);text-decoration:none}',
'.cc-note a:hover{text-decoration:underline}',
// --- the shared two-thumb slider, in this widget's skin ---
'.cc-widget .rp{position:relative}',
'.cc-widget .rp-v{width:22px;min-height:150px}',
'.cc-widget .rp-h{height:22px;width:100%}',
'.cc-widget .rp-track{position:absolute;background:var(--cc-field);',
'  border:1px solid var(--cc-line);border-radius:999px}',
// Both dimensions are stated on both orientations, including the `auto` that
// lets top/bottom (or left/right) set the length. Leaving one out worked right
// up until this widget was embedded in a page that had its own opinion about
// .rp-track height, which collapsed every vertical slider to 6px. An embedded
// component cannot assume anything about the CSS around it.
'.cc-widget .rp-v .rp-track{left:50%;right:auto;transform:translateX(-50%);',
'  width:8px;top:8px;bottom:8px;height:auto}',
'.cc-widget .rp-h .rp-track{top:50%;bottom:auto;transform:translateY(-50%);',
'  height:8px;left:8px;right:8px;width:auto}',
'.cc-widget .rp-back{position:absolute;inset:0;border-radius:999px;overflow:hidden}',
'.cc-widget .rp-band{position:absolute;background:var(--cc-accent);opacity:.55;cursor:grab}',
'.cc-widget .rp-v .rp-band{left:0;right:0}',
'.cc-widget .rp-h .rp-band{top:0;bottom:0}',
'.cc-widget .rp-thumb{position:absolute;width:16px;height:16px;border-radius:50%;',
'  background:#fff;border:2px solid var(--cc-field);cursor:grab;touch-action:none}',
'.cc-widget .rp-v .rp-thumb{left:50%;transform:translate(-50%,50%)}',
'.cc-widget .rp-h .rp-thumb{top:50%;transform:translate(-50%,-50%)}',
'.cc-widget .rp-thumb:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}'
].join('\n');

function injectStyles() {
  if (document.getElementById('cc-widget-styles')) { return; }
  var st = document.createElement('style');
  st.id = 'cc-widget-styles';
  st.textContent = CSS;
  document.head.appendChild(st);
}

// ----------------------------------------------------------------------------
//  The envelope buttons
// ----------------------------------------------------------------------------
//  Their "example image" is not a picture of a shape in the abstract: it is the
//  envelope this widget would draw RIGHT NOW, at the current k, sampled from
//  the same SHAPES function the curve uses. Moving the k slider redraws both
//  buttons, so the pair doubles as a live preview of what k is doing.

function envelopePath(shapeKey, k) {
  var env = SHAPES[shapeKey].env;
  var W = 40, H = 34, N = 48;
  var d = '';
  for (var i = 0; i <= N; i++) {
    var t = -1 + 2 * (i / N);
    var x = 2 + (W - 4) * (i / N);
    var y = (H - 3) - (H - 8) * env(t, {k: k});
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d;
}

function envelopeSVG(shapeKey, k) {
  return '<svg viewBox="0 0 40 40" aria-hidden="true">' +
         '<path d="' + envelopePath(shapeKey, k) + '" fill="none" ' +
         'stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" ' +
         'stroke-linecap="round"/></svg>';
}

// ----------------------------------------------------------------------------
//  mountPicker
// ----------------------------------------------------------------------------

function mountPicker(host, options) {
  options = options || {};
  injectStyles();

  // Start from the schema's defaults so the widget and the lab cannot drift,
  // then apply whatever the embedder passed.
  var P = defaultParams();
  Object.keys(options.params || {}).forEach(function (key) {
    var spec = paramSpec(key);
    if (spec) { P[key] = coerceParam(spec, options.params[key]); }
  });
  normalizeParams(P);

  var root = document.createElement('div');
  root.className = 'cc-widget';

  var els = {cols: {}, envs: {}};
  var palette = [];

  // --- top row: envelope buttons, then the vertical sliders -----------------

  var top  = div('cc-top');
  var envs = div('cc-envs');

  ENVELOPES.forEach(function (e) {
    var wrap = div('cc-envwrap');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cc-env';
    b.title = e.title;
    b.setAttribute('aria-pressed', String(P.shape === e.key));
    b.addEventListener('click', function () {
      P.shape = e.key;
      refresh();
    });
    // The legend is the shape's own name from the registry, so the widget and
    // the lab's <select> can never disagree about what to call it.
    var legend = cap(SHAPES[e.key].label);
    legend.title = e.title;
    wrap.appendChild(b);
    wrap.appendChild(legend);
    els.envs[e.key] = b;
    envs.appendChild(wrap);
  });

  var cols = div('cc-cols');
  COLUMNS.forEach(function (key) { cols.appendChild(buildColumn(key)); });

  top.appendChild(envs);
  top.appendChild(cols);
  root.appendChild(top);

  // --- the number of colours ------------------------------------------------

  root.appendChild(document.createElement('hr')).className = 'cc-rule';

  var countRow = div('cc-count');
  countRow.appendChild(cap('colours'));
  var countSpec = paramSpec('Nsample');
  var count = makeRangePair({
    min: countSpec.min, max: countSpec.max, step: countSpec.step,
    a: P.Nsample, b: P.Nsample, cross: true,
    // One value on a two-thumb control: both thumbs carry it, and only the
    // one being dragged is read. Cheaper than a second slider class, and the
    // widget then has exactly one slider implementation in it.
    onInput: function (a, b) {
      P.Nsample = coerceParam(countSpec, (a !== P.Nsample) ? a : b);
      count.set(P.Nsample, P.Nsample);
      refresh();
    }
  });
  countRow.appendChild(count.el);
  var countOut = cap('7');
  countOut.className = 'cc-val';
  countRow.appendChild(countOut);
  root.appendChild(countRow);

  // --- the two toggles ------------------------------------------------------

  var toggles = div('cc-toggles');
  var evenBox = check('perceptual even steps', P.perceptual, function (on) {
    P.perceptual = on;
    refresh();
  });
  var invBox = check('invert hue spiral', !isOn(paramSpec('sign'), P.sign), function (on) {
    P.sign = on ? valOff(paramSpec('sign')) : valOn(paramSpec('sign'));
    refresh();
  });
  evenBox.title = 'Sample at equal steps of perceived colour difference ' +
                  'instead of equal steps of the parameter.';
  invBox.title  = 'Reverse the direction the hue winds around the cylinder.';
  toggles.appendChild(evenBox);
  toggles.appendChild(invBox);
  // Reverse the WHOLE curve: walk the interval from tb to ta (1 -> -1 on the full curve).
  // Unlike swapping the interval ends, this keeps the interval as it is.
  var revBtn = document.createElement('button');
  revBtn.type = 'button';
  revBtn.className = 'cc-btn cc-reverse';
  revBtn.textContent = '\u21c4 reverse curve';
  revBtn.title = 'Traverse the curve backwards: from tb to ta (1 \u2192 -1 on the full interval).';
  revBtn.addEventListener('click', function () {
    P.reverse = !P.reverse;
    refresh();
  });
  toggles.appendChild(revBtn);
  els.reverse = revBtn;
  root.appendChild(toggles);

  root.appendChild(document.createElement('hr')).className = 'cc-rule';

  // --- swatches, exports, apply ---------------------------------------------

  var strip = div('cc-swatches');
  root.appendChild(strip);

  var actions = div('cc-actions');
  // Same formats, same order, as the lab's Export box and as FORMAT_ORDER.
  [['copy', 'list', 'Copy as a delimited list'],
   ['css',  'css',  'Copy as CSS custom properties'],
   ['json', 'json', 'Copy as JSON'],
   ['gimp', 'gpl',  'Copy as a GIMP .gpl palette']
  ].forEach(function (b) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc-btn';
    btn.textContent = b[0];
    btn.title = b[2];
    btn.addEventListener('click', function () { copyAs(b[1], btn, b[0]); });
    actions.appendChild(btn);
  });
  root.appendChild(actions);

  var apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'cc-apply';
  apply.textContent = 'APPLY PALETTE';
  apply.addEventListener('click', function () {
    if (options.onApply) { options.onApply(palette.slice(), getParams()); }
    host.dispatchEvent(new CustomEvent('colorcurves:apply', {
      bubbles: true,
      detail: {palette: palette.slice(), params: getParams(), source: sourceLink()}
    }));
  });
  root.appendChild(apply);

  var note = div('cc-note');
  note.innerHTML = '<a href="' + HOME + '" target="_blank" rel="noopener">' +
                   'cheque.github.io/color-lab/curves</a>';
  root.appendChild(note);

  host.appendChild(root);

  // --- building blocks ------------------------------------------------------

  function div(cls) { var d = document.createElement('div'); d.className = cls; return d; }

  function cap(text) {
    var s = document.createElement('span');
    s.className = 'cc-cap';
    s.textContent = text;
    return s;
  }

  function check(label, on, onChange) {
    var l = document.createElement('label');
    var i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = on;
    i.addEventListener('change', function () { onChange(i.checked); });
    l.appendChild(i);
    l.appendChild(document.createTextNode(label));
    return l;
  }

  // One vertical slider. A paired spec (lightness, interval) gets both thumbs
  // and the draggable band; a single one gets two thumbs carrying the same
  // value, which reads as an ordinary slider.
  function buildColumn(key) {
    var spec = paramSpec(key);
    var tail = spec.pairWith ? paramSpec(spec.pairWith) : null;
    var col  = div('cc-col');
    // A readout per END of the slider: the top one reports whichever thumb is
    // up there, the bottom one whichever is down. Single sliders keep the
    // bottom slot empty so every track in the row is the same length.
    var out  = cap(''); out.className = 'cc-val';
    var bot  = cap(''); bot.className = 'cc-val';

    var rp = makeRangePair({
      vertical: true,
      min: spec.min, max: spec.max, step: spec.step,
      a: P[key], b: tail ? P[tail.key] : P[key],
      cross: tail ? spec.cross : true,
      gap: spec.gap,
      onInput: function (a, b) {
        if (tail) {
          P[key] = coerceParam(spec, a);
          P[tail.key] = coerceParam(tail, b);
          P._last = null;
        } else {
          P[key] = coerceParam(spec, (a !== P[key]) ? a : b);
          rp.set(P[key], P[key]);
        }
        normalizeParams(P);
        refresh();
      }
    });

    col.appendChild(out);
    col.appendChild(rp.el);
    col.appendChild(bot);
    var label = cap(SHORT[key] || spec.label);
    label.title = spec.help || spec.label;
    col.appendChild(label);

    els.cols[key] = {rp: rp, out: out, bot: bot, spec: spec, tail: tail};
    return col;
  }

  // --- state -> screen ------------------------------------------------------

  function fmt(v) { return (v === Math.round(v)) ? String(v) : v.toFixed(2); }

  function getParams() {
    var out = {};
    Object.keys(P).forEach(function (key) { if (key[0] !== '_') { out[key] = P[key]; } });
    return out;
  }

  function sourceLink() { return paletteSource(paramsToQuery(P)); }

  function refresh() {
    // 1. the palette itself — the only expensive step, and the only one that
    //    the embedder's callbacks ever see.
    var curve = makeCurve(P);
    var sampled = samplePalette(curve, {
      n: P.Nsample, ta: P.ta, tb: P.tb,
      perceptual: !!P.perceptual, metric: P.metric, placement: P.placement,
      reverse: !!P.reverse
    });
    palette = sampled.swatches.map(function (s) { return s.hex; });
    if (els.reverse) {
      els.reverse.classList.toggle('on', !!P.reverse);
      els.reverse.setAttribute('aria-pressed', String(!!P.reverse));
    }

    // 2. the envelope buttons, redrawn at the current k
    ENVELOPES.forEach(function (e) {
      var b = els.envs[e.key];
      b.innerHTML = envelopeSVG(e.key, P.k);
      b.classList.toggle('on', P.shape === e.key);
      b.setAttribute('aria-pressed', String(P.shape === e.key));
      b.style.color = (P.shape === e.key) ? 'var(--cc-accent)' : 'var(--cc-muted)';
    });

    // 3. the sliders' readouts, and the gradient behind the interval
    Object.keys(els.cols).forEach(function (key) {
      var c = els.cols[key];
      c.rp.set(P[key], c.tail ? P[c.tail.key] : P[key]);
      if (c.tail) {
        var a = P[key], b = P[c.tail.key];
        c.out.textContent = fmt(Math.max(a, b));   // the thumb at the top
        c.bot.textContent = fmt(Math.min(a, b));   // the thumb at the bottom
      } else {
        c.out.textContent = (key === 'k')
          ? 'p=' + shapeP(P).toFixed(2)            // k reads out the p it means
          : fmt(P[key]);
        c.bot.textContent = '\u00a0';             // keep the tracks aligned
      }
    });
    paintInterval(curve);

    // The count slider is not one of `els.cols`, so it needs saying: without
    // this its thumb ignored setParams() and every other programmatic change,
    // and sat where the last drag had left it while the readout moved on.
    count.set(P.Nsample, P.Nsample);
    countOut.textContent = String(P.Nsample);

    // 4. the swatches
    strip.innerHTML = '';
    palette.forEach(function (hex, i) {
      var b = div('cc-sw');
      b.style.background = hex;
      b.title = hex + '  (' + (i + 1) + ' of ' + palette.length + ')';
      strip.appendChild(b);
    });

    if (options.onChange) { options.onChange(palette.slice(), getParams()); }
  }

  // The interval slider selects a stretch of the curve, so its track shows the
  // curve: the whole of it, bottom to top, with the band picking out the part
  // being sampled. It is the one control whose meaning is otherwise invisible.
  function paintInterval(curve) {
    var back = els.cols.ta.rp.back;
    var stops = [];
    for (var i = 0; i <= SWATCH_SAMPLES; i++) {
      var t = -1 + 2 * (i / SWATCH_SAMPLES);
      stops.push(toHex(hsl2rgb(curve(t))) + ' ' + (100 * i / SWATCH_SAMPLES).toFixed(1) + '%');
    }
    back.style.background = 'linear-gradient(to top, ' + stops.join(',') + ')';
  }

  // --- exporting ------------------------------------------------------------

  function copyAs(format, btn, label) {
    var text = formatPalette(palette, {
      format: format, sep: ',', strsep: '', name: 'color-curves',
      source: sourceLink()
    });
    var done = function (ok) {
      btn.textContent = ok ? '✓' : '⚠';
      setTimeout(function () { btn.textContent = label; }, 1100);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); },
                                              function () { done(false); });
    } else {
      done(false);
    }
  }

  refresh();

  // --- the handle -----------------------------------------------------------

  return {
    el: root,
    getPalette: function () { return palette.slice(); },
    getParams: getParams,
    getSource: sourceLink,
    setParams: function (next) {
      Object.keys(next || {}).forEach(function (key) {
        var spec = paramSpec(key);
        if (spec) { P[key] = coerceParam(spec, next[key]); }
      });
      normalizeParams(P);
      refresh();
    },
    destroy: function () { if (root.parentNode) { root.parentNode.removeChild(root); } }
  };
}

var Widget = {mountPicker: mountPicker};

global.ColorCurves = global.ColorCurves || {};
global.ColorCurves.mountPicker = mountPicker;

if (typeof module !== 'undefined' && module.exports) { module.exports = Widget; }

})(typeof window !== 'undefined' ? window : this);
