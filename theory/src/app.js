// ============================================================================
//  theory/src/app.js — the colour-model explorer
//
//  A rewrite of chequesoto.info/colortheory (kept verbatim in
//  legacy/colortheory/) on the shared, tested lib/color.js. What it keeps: the
//  sRGB sliders and hex code, the tristimulus reference, the (H,S) disc and
//  the (a*,b*) plane each with its lightness profile, the sRGB-gamut
//  restriction and the palette you collect by sampling. What changed:
//
//    - every model is editable, not only sRGB and the HSL disc: type into the
//      HSL, L*a*b* or L*C*h° fields, type a hex, or drag in either plane or
//      either lightness bar;
//    - the a*b* plane is now an input too, and with the gamut restriction on
//      a pick outside sRGB is pulled to the gamut boundary along its own
//      chroma (same L*, same hue) instead of being clipped channel by channel;
//    - the gamut test is exact (unclipped sRGB, lib/color.js inGamut) rather
//      than a round-trip distance under 1.2;
//    - XYZ and L*C*h°, hidden in the published page, are shown;
//    - the palette exports (list, CSS, JSON, GIMP), shows the CIEDE2000
//      difference between neighbours, and lives in the permalink;
//    - the legacy DeltaE2000 (which used ^ as a power and undefined weights)
//      is replaced by lib/color.js deltaE2000.
//
//  State has one source of truth per edit: the model being edited keeps its
//  exact values (so a grey keeps its hue while you drag through it) and the
//  others are derived from the resulting sRGB colour.
//
//  Requires: lib/color.js, lib/palette.js
// ============================================================================

(function () {
  'use strict';

  var ILLUMINANTS = [
    ['A', 'A · incandescent / tungsten'], ['B', 'B · old direct sunlight at noon'], ['C', 'C · old daylight'],
    ['D50', 'D50 · ICC profile PCS'], ['D55', 'D55 · mid-morning daylight'],
    ['D65', 'D65 · daylight, sRGB, Adobe RGB'], ['D75', 'D75 · north sky daylight'], ['E', 'E · equal energy'],
    ['F1', 'F1 · daylight fluorescent'], ['F2', 'F2 · cool fluorescent'], ['F3', 'F3 · white fluorescent'],
    ['F4', 'F4 · warm white fluorescent'], ['F5', 'F5 · daylight fluorescent'], ['F6', 'F6 · lite white fluorescent'],
    ['F7', 'F7 · D65 simulator'], ['F8', 'F8 · Sylvania F40, D50 simulator'], ['F9', 'F9 · cool white fluorescent'],
    ['F10', 'F10 · Ultralume 50, Philips TL85'], ['F11', 'F11 · Ultralume 40, Philips TL84'],
    ['F12', 'F12 · Ultralume 30, Philips TL83']
  ];

  var PLANE = 300;     // CSS px, both planes
  var BAR_W = 36;      // CSS px, both lightness bars
  var AB = 110;        // the a*b* plane spans [-AB, AB] on both axes

  var state = {
    rgb: {R: 0, G: 0, B: 0},
    hsl: {H: 0, S: 0, L: 0},
    lab: {L: 0, a: 0, b: 0},
    ref: 'D65',
    gamut: true,
    clipped: false,      // the requested L*a*b* was outside sRGB and had to be clipped
    palette: []          // hex strings, in the order shown
  };

  function refWhite() { return tristimulus[state.ref]; }
  function $(id) { return document.getElementById(id); }

  // --------------------------------------------------------------------------
  //  Setting the colour from each model
  // --------------------------------------------------------------------------

  function fromRGB(c) {
    state.rgb = {R: c.R, G: c.G, B: c.B};
    var h = rgb2hsl(c.R, c.G, c.B);
    // A grey has no hue and black/white no saturation either; keep the ones we
    // had, so the pointer does not jump to red when you drag through the axis.
    if (h.S === 0) { h.H = state.hsl.H; }
    if (h.L === 0 || h.L === 1) { h.S = state.hsl.S; }
    state.hsl = h;
    state.lab = rgb2cielab(c.R, c.G, c.B, refWhite());
    state.clipped = false;
    changed();
  }

  function fromHSL(h) {
    state.hsl = {H: h.H - Math.floor(h.H), S: clip(h.S, 0, 1), L: clip(h.L, 0, 1)};
    var c = hsl2rgb(state.hsl);
    state.rgb = c;
    state.lab = rgb2cielab(c.R, c.G, c.B, refWhite());
    state.clipped = false;
    changed();
  }

  // Pull an out-of-gamut L*a*b* colour to the sRGB boundary by scaling its
  // chroma down at constant L* and hue. The neutral axis is always inside, so
  // bisection on the scale factor converges.
  function mapToGamut(lab) {
    var ref = refWhite();
    if (inGamut(cielab2rgbF(lab, ref))) { return lab; }
    var lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) {
      var m = (lo + hi) / 2;
      if (inGamut(cielab2rgbF({L: lab.L, a: lab.a * m, b: lab.b * m}, ref))) { lo = m; } else { hi = m; }
    }
    return {L: lab.L, a: lab.a * lo, b: lab.b * lo};
  }

  function fromLab(lab) {
    var want = {L: clip(lab.L, 0, 100), a: lab.a, b: lab.b};
    if (state.gamut) { want = mapToGamut(want); }
    var f = cielab2rgbF(want, refWhite());
    state.clipped = !inGamut(f);
    state.lab = want;
    var c = rgbClip(f);
    state.rgb = c;
    var h = rgb2hsl(c.R, c.G, c.B);
    if (h.S === 0) { h.H = state.hsl.H; }
    state.hsl = h;
    changed();
  }

  // --------------------------------------------------------------------------
  //  Canvases
  // --------------------------------------------------------------------------

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function hidpi(canvas, w, h) {
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    return canvas.getContext('2d');
  }

  var cv = {
    hsl: $('hsl'), hslBar: $('hslBar'), lab: $('lab'), labBar: $('labBar')
  };
  var ctx = {
    hsl: hidpi(cv.hsl, PLANE, PLANE), hslBar: hidpi(cv.hslBar, BAR_W, PLANE),
    lab: hidpi(cv.lab, PLANE, PLANE), labBar: hidpi(cv.labBar, BAR_W, PLANE)
  };

  // Backgrounds are rendered pixel by pixel into offscreen canvases and cached
  // under a key of what they depend on; dragging only redraws the markers.
  var cache = {};

  function background(name, key, w, h, f) {
    if (cache[name] && cache[name].key === key) { return cache[name].canvas; }
    var W = Math.round(w * DPR), H = Math.round(h * DPR);
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var g = off.getContext('2d');
    var img = g.createImageData(W, H), d = img.data;
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var c = f((i + 0.5) / W, 1 - (j + 0.5) / H);   // u, v in [0,1], v up
        if (!c) { continue; }
        var k = 4 * (j * W + i);
        d[k] = c.R; d[k + 1] = c.G; d[k + 2] = c.B; d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    cache[name] = {key: key, canvas: off};
    return off;
  }

  function marker(g, x, y, fill) {
    g.beginPath();
    g.arc(x * DPR, y * DPR, 6 * DPR, 0, 2 * Math.PI);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 2 * DPR;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.lineWidth = 1 * DPR;
    g.strokeStyle = '#000000';
    g.beginPath();
    g.arc(x * DPR, y * DPR, 7.5 * DPR, 0, 2 * Math.PI);
    g.stroke();
  }

  function barMarker(g, y) {
    var w = BAR_W * DPR;
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000000';
    g.lineWidth = DPR;
    g.beginPath();
    g.rect(1 * DPR, y * DPR - 3 * DPR, w - 2 * DPR, 6 * DPR);
    g.fill(); g.stroke();
  }

  function drawHSL() {
    var L = state.hsl.L;
    var bg = background('hsl', L.toFixed(4), PLANE, PLANE, function (u, v) {
      var x = 2 * u - 1, y = 2 * v - 1, r = Math.hypot(x, y);
      if (r > 1) { return null; }
      var H = Math.atan2(y, x) / (2 * Math.PI);
      return hsl2rgb({H: H - Math.floor(H), S: r, L: L});
    });
    var g = ctx.hsl;
    g.clearRect(0, 0, cv.hsl.width, cv.hsl.height);
    g.drawImage(bg, 0, 0);
    var a = 2 * Math.PI * state.hsl.H, R = PLANE / 2;
    marker(g, R + R * state.hsl.S * Math.cos(a), R - R * state.hsl.S * Math.sin(a), toHex(state.rgb));

    var H = state.hsl.H, S = state.hsl.S;
    var bar = background('hslBar', H.toFixed(4) + ',' + S.toFixed(4), BAR_W, PLANE, function (u, v) {
      return hsl2rgb({H: H, S: S, L: v});
    });
    var b = ctx.hslBar;
    b.clearRect(0, 0, cv.hslBar.width, cv.hslBar.height);
    b.drawImage(bar, 0, 0);
    barMarker(b, PLANE * (1 - L));
  }

  function drawLab() {
    var ref = refWhite(), L = state.lab.L, gam = state.gamut;
    var key = [L.toFixed(3), state.ref, gam].join(',');
    var bg = background('lab', key, PLANE, PLANE, function (u, v) {
      var c = cielab2rgbF({L: L, a: AB * (2 * u - 1), b: AB * (2 * v - 1)}, ref);
      if (gam && !inGamut(c)) { return null; }
      return rgbClip(c);
    });
    var g = ctx.lab;
    g.clearRect(0, 0, cv.lab.width, cv.lab.height);
    // The axes, under the colours: they show through where the gamut ends.
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = DPR;
    g.beginPath();
    g.moveTo(cv.lab.width / 2, 0); g.lineTo(cv.lab.width / 2, cv.lab.height);
    g.moveTo(0, cv.lab.height / 2); g.lineTo(cv.lab.width, cv.lab.height / 2);
    g.stroke();
    g.drawImage(bg, 0, 0);
    var R = PLANE / 2;
    marker(g, R + R * state.lab.a / AB, R - R * state.lab.b / AB, toHex(state.rgb));

    var a = state.lab.a, b = state.lab.b;
    var bar = background('labBar', [a.toFixed(3), b.toFixed(3), state.ref, gam].join(','), BAR_W, PLANE,
      function (u, v) {
        var c = cielab2rgbF({L: 100 * v, a: a, b: b}, ref);
        if (gam && !inGamut(c)) { return null; }
        return rgbClip(c);
      });
    var bb = ctx.labBar;
    bb.clearRect(0, 0, cv.labBar.width, cv.labBar.height);
    bb.drawImage(bar, 0, 0);
    barMarker(bb, PLANE * (1 - L / 100));
  }

  // --------------------------------------------------------------------------
  //  Pointer input on the planes and bars
  // --------------------------------------------------------------------------

  // Local coordinates in [0,1], v up, whatever size CSS gave the canvas.
  function local(canvas, e) {
    var r = canvas.getBoundingClientRect();
    return {u: clip((e.clientX - r.left) / r.width, 0, 1), v: clip(1 - (e.clientY - r.top) / r.height, 0, 1)};
  }

  function drag(canvas, onMove) {
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      onMove(local(canvas, e));
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (canvas.hasPointerCapture(e.pointerId)) { onMove(local(canvas, e)); }
    });
  }

  drag(cv.hsl, function (p) {
    var x = 2 * p.u - 1, y = 2 * p.v - 1;
    var H = Math.atan2(y, x) / (2 * Math.PI);
    fromHSL({H: H, S: Math.min(1, Math.hypot(x, y)), L: state.hsl.L});
  });
  drag(cv.hslBar, function (p) { fromHSL({H: state.hsl.H, S: state.hsl.S, L: p.v}); });
  drag(cv.lab, function (p) {
    fromLab({L: state.lab.L, a: AB * (2 * p.u - 1), b: AB * (2 * p.v - 1)});
  });
  drag(cv.labBar, function (p) { fromLab({L: 100 * p.v, a: state.lab.a, b: state.lab.b}); });

  // --------------------------------------------------------------------------
  //  Controls
  // --------------------------------------------------------------------------

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') { n.className = attrs[k]; }
      else if (k === 'text') { n.textContent = attrs[k]; }
      else { n.setAttribute(k, attrs[k]); }
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  // sRGB: number + slider per channel, the color-curves row.
  var rgbEls = {};
  ['R', 'G', 'B'].forEach(function (ch) {
    var num = el('input', {type: 'number', class: 'num', min: 0, max: 255, step: 1, id: 'rgb' + ch});
    var sl = el('input', {type: 'range', class: 'slider', min: 0, max: 255, step: 1, 'aria-label': ch});
    function set(v) {
      var c = {R: state.rgb.R, G: state.rgb.G, B: state.rgb.B};
      c[ch] = clip(Math.round(+v || 0), 0, 255);
      fromRGB(c);
    }
    num.addEventListener('input', function () { set(num.value); });
    sl.addEventListener('input', function () { set(sl.value); });
    rgbEls[ch] = {num: num, slider: sl};
    $('rgbRows').appendChild(el('div', {class: 'row'}, [el('label', {for: 'rgb' + ch, text: ch}), num, sl]));
  });

  // Hex: accepted as soon as it parses, rewritten in canonical form on blur.
  var hexEl = $('hex');
  hexEl.addEventListener('input', function () {
    var c = hex2rgb(hexEl.value);
    hexEl.classList.toggle('bad', !c);
    if (c) { fromRGB(c); }
  });
  hexEl.addEventListener('blur', function () { hexEl.classList.remove('bad'); sync(); });

  // Reference white.
  var refEl = $('ref');
  ILLUMINANTS.forEach(function (o) { refEl.appendChild(el('option', {value: o[0], text: o[1]})); });
  refEl.addEventListener('change', function () {
    state.ref = refEl.value;
    fromRGB(state.rgb);   // the stimulus stays; its L*a*b* description changes
  });

  // The readout table: [label, fields], each field [key, unit hint, digits, step, editable].
  var MODELS = [
    {name: 'XYZ', fields: [['X', '', 2], ['Y', '', 2], ['Z', '', 2]], edit: null},
    {name: 'HSL', fields: [['H', 'turn', 4, 0.001], ['S', '0–1', 4, 0.001], ['L', '0–1', 4, 0.001]],
     edit: function (v) { fromHSL({H: v.H, S: v.S, L: v.L}); }},
    {name: 'L*a*b*', fields: [['L', 'L*', 2, 0.1], ['a', 'a*', 2, 0.1], ['b', 'b*', 2, 0.1]],
     edit: function (v) { fromLab({L: v.L, a: v.a, b: v.b}); }},
    {name: 'L*C*h°', fields: [['L', 'L*', 2, 0.1], ['C', 'C*', 2, 0.1], ['H', 'h°', 2, 0.1]],
     edit: function (v) { fromLab(cielch2cielab({L: v.L, C: v.C, H: v.H})); }}
  ];
  var readEls = {};
  MODELS.forEach(function (m) {
    var tr = el('tr', {}, [el('th', {text: m.name})]);
    readEls[m.name] = {};
    m.fields.forEach(function (f) {
      var inp = el('input', {type: m.edit ? 'number' : 'text', step: f[3] || 'any',
                             'aria-label': m.name + ' ' + (f[1] || f[0])});
      if (!m.edit) { inp.readOnly = true; }
      readEls[m.name][f[0]] = inp;
      tr.appendChild(el('td', {}, [inp, el('span', {text: f[1] || f[0]})]));
      if (m.edit) {
        inp.addEventListener('change', function () {
          var v = {};
          m.fields.forEach(function (g) { v[g[0]] = parseFloat(readEls[m.name][g[0]].value) || 0; });
          m.edit(v);
        });
      }
    });
    $('readout').appendChild(tr);
  });

  function lchOf(lab) {
    var c = cielab2cielch(lab);
    return {L: c.L, C: c.C, H: ((c.H % 360) + 360) % 360};
  }

  // Write the state into every control except the one being typed in.
  function sync() {
    var c = state.rgb, hex = toHex(c);
    ['R', 'G', 'B'].forEach(function (ch) {
      if (document.activeElement !== rgbEls[ch].num) { rgbEls[ch].num.value = c[ch]; }
      rgbEls[ch].slider.value = c[ch];
    });
    if (document.activeElement !== hexEl) { hexEl.value = hex; }
    $('swatch').style.background = hex;
    $('gamutNote').hidden = !state.clipped;
    refEl.value = state.ref;
    $('gamut').checked = state.gamut;

    var xyz = rgb2xyz(c.R, c.G, c.B);
    var vals = {'XYZ': xyz, 'HSL': state.hsl, 'L*a*b*': state.lab, 'L*C*h°': lchOf(state.lab)};
    MODELS.forEach(function (m) {
      m.fields.forEach(function (f) {
        var inp = readEls[m.name][f[0]];
        if (document.activeElement !== inp) { inp.value = vals[m.name][f[0]].toFixed(f[2]); }
      });
    });
  }

  // --------------------------------------------------------------------------
  //  Palette
  // --------------------------------------------------------------------------

  var dragIndex = -1;

  function renderPalette() {
    var root = $('palette');
    root.textContent = '';
    $('paletteHint').hidden = state.palette.length > 0;
    state.palette.forEach(function (hex, i) {
      if (i > 0) {
        var a = hex2rgb(state.palette[i - 1]), b = hex2rgb(hex);
        var de = deltaE2000(rgb2cielab(a.R, a.G, a.B, D65), rgb2cielab(b.R, b.G, b.B, D65));
        root.appendChild(el('span', {class: 'de', title: 'CIEDE2000 between neighbours', text: de.toFixed(1)}));
      }
      var x = el('button', {type: 'button', class: 'x', 'aria-label': 'Remove ' + hex, text: '×'});
      var chip = el('div', {class: 'chip', draggable: 'true', title: 'Click to load, drag to reorder'},
                    [el('div', {class: 'sw'}), el('code', {text: hex}), x]);
      chip.firstChild.style.background = hex;
      chip.addEventListener('click', function (e) {
        if (e.target === x) { return; }
        fromRGB(hex2rgb(hex));
      });
      x.addEventListener('click', function () {
        state.palette.splice(i, 1);
        renderPalette(); updatePermalink();
      });
      chip.addEventListener('dragstart', function (e) {
        dragIndex = i; chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', hex);
      });
      chip.addEventListener('dragend', function () { chip.classList.remove('dragging'); dragIndex = -1; });
      chip.addEventListener('dragover', function (e) { e.preventDefault(); chip.classList.add('over'); });
      chip.addEventListener('dragleave', function () { chip.classList.remove('over'); });
      chip.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragIndex < 0 || dragIndex === i) { return; }
        var moved = state.palette.splice(dragIndex, 1)[0];
        state.palette.splice(i, 0, moved);
        renderPalette(); updatePermalink();
      });
      root.appendChild(chip);
    });
  }

  function flash(msg) {
    var n = $('status');
    n.textContent = msg;
    n.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { n.classList.remove('show'); }, 1800);
  }

  function copy(text, what) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { flash(what + ' copied to the clipboard'); })
        .catch(function () { flash('Could not copy to the clipboard'); });
    } else {
      flash('The clipboard is not available here');
    }
  }

  FORMAT_ORDER.forEach(function (fmt) {
    var b = el('button', {type: 'button', title: FORMATS[fmt].label,
                          text: {list: 'copy', css: 'css', json: 'json', gpl: 'gimp'}[fmt]});
    b.addEventListener('click', function () {
      if (!state.palette.length) { flash('The palette is empty'); return; }
      copy(formatPalette(state.palette, {format: fmt, name: 'color-lab', source: location.href}),
           FORMATS[fmt].label);
    });
    $('exportButtons').appendChild(b);
  });

  // --------------------------------------------------------------------------
  //  Permalink: ?c=RRGGBB&ref=D65&gamut=0&p=RRGGBB-RRGGBB
  // --------------------------------------------------------------------------

  function query() {
    var q = ['c=' + toHex(state.rgb).slice(1)];
    if (state.ref !== 'D65') { q.push('ref=' + state.ref); }
    if (!state.gamut) { q.push('gamut=0'); }
    if (state.palette.length) {
      q.push('p=' + state.palette.map(function (h) { return h.slice(1); }).join('-'));
    }
    return '?' + q.join('&');
  }

  function updatePermalink() {
    try { history.replaceState(null, '', query()); } catch (e) { /* file:// in some browsers */ }
  }

  function readQuery() {
    var q = new URLSearchParams(location.search);
    if (q.get('ref') && tristimulus[q.get('ref')]) { state.ref = q.get('ref'); }
    if (q.get('gamut') === '0') { state.gamut = false; }
    (q.get('p') || '').split('-').forEach(function (h) {
      var c = hex2rgb(h);
      if (c) { state.palette.push(toHex(c)); }
    });
    return hex2rgb(q.get('c') || '');
  }

  // --------------------------------------------------------------------------
  //  Wiring
  // --------------------------------------------------------------------------

  var frame = 0;
  function changed() {
    // Coalesce bursts of input (a drag fires faster than the screen) into one
    // repaint per frame.
    if (frame) { return; }
    frame = requestAnimationFrame(function () {
      frame = 0;
      sync();
      drawHSL();
      drawLab();
      updatePermalink();
    });
  }

  $('gamut').addEventListener('change', function () {
    state.gamut = $('gamut').checked;
    if (state.gamut) { fromLab(state.lab); } else { changed(); }
  });

  function randomColour() {
    return {R: Math.floor(256 * Math.random()), G: Math.floor(256 * Math.random()),
            B: Math.floor(256 * Math.random())};
  }

  $('random').addEventListener('click', function () { fromRGB(randomColour()); });
  $('sample').addEventListener('click', function () {
    state.palette.push(toHex(state.rgb));
    renderPalette(); updatePermalink();
  });
  $('permalink').addEventListener('click', function () { copy(location.href, 'Link'); });

  var start = readQuery();
  fromRGB(start || randomColour());
  renderPalette();
})();
