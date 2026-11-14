// ============================================================================
//  theory/src/app.js — the color-model explorer
//
//  A rewrite of chequesoto.info/colortheory (kept verbatim in
//  legacy/colortheory/) on the shared, tested lib/color.js.
//
//  One color, every model at once:
//    - numbers: sRGB, hex, XYZ, HSL, L*a*b*, L*C*h°, all but XYZ editable;
//    - six plane cuts through the current color, each a drag surface: HSL at
//      constant L, H and S; L*a*b* at constant L*, a* and b*;
//    - one solid in 3-D (the HSL cylinder or the sRGB gamut in L*a*b*), drawn
//      translucent, with any of the six cuts: flat in their own space, carried
//      over (and curved) in the other;
//    - a palette collected by sampling, with CIEDE2000 between neighbors.
//
//  Every cut is one row of the CUTS table below. The 2-D view, the 3-D mesh,
//  the marker and the drag all read the same row, so adding a cut is adding
//  a row.
//
//  The model being edited keeps its exact values (a gray keeps its hue while
//  you drag through it) and the others are derived from the resulting color.
//  While you drag in a cut, its fixed coordinate is pinned to the value it had
//  when you pressed, so the plane under the pointer does not move.
//
//  Requires: lib/color.js, lib/scene.js, lib/palette.js, theory/src/solids.js
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

  var AB = Solids.AB;      // a*, b* span [-AB, AB] in the cuts and the solid
  var CUT_PX = 200;        // CSS size of a cut; computed at device resolution, drawn 1:1
  var SOLID_PX = 630;      // CSS size of the 3-D view

  var state = {
    rgb: {R: 0, G: 0, B: 0},
    hsl: {H: 0, S: 0, L: 0},
    lab: {L: 0, a: 0, b: 0},
    ref: 'D65',
    gamut: true,
    clipped: false,                    // the requested L*a*b* was outside sRGB
    palette: [],                       // hex strings, in order
    view: 'hsl',                       // the solid shown in 3-D
    opacity: 0.14,
    show: {hslL: true, labL: true}     // the cuts shown in 3-D
  };
  var CAMERA0 = {th: 0.38, ph: 0.09, zoom: 1, panX: 0, panY: 0};
  var camera = Object.assign({}, CAMERA0);
  var anchors = {};                    // cut id -> pinned fixed value while dragging

  function refWhite() { return tristimulus[state.ref]; }
  function $(id) { return document.getElementById(id); }
  function wrap(h) { return h - Math.floor(h); }
  function fmt(v, d) { return (+v).toFixed(d); }

  // --------------------------------------------------------------------------
  //  The six cuts
  //
  //  current(state)   the cut's fixed coordinate for the current color
  //  sample(u, v, k)  the cut's point at 2-D position u, v in [0,1] (v up),
  //                   for fixed value k: {hsl: …} or {lab: …}, or null outside
  //  sample3d(s,t,k)  the same, on the grid used for the 3-D mesh (the disc is
  //                   gridded in polar coordinates so its rim is round)
  //  mark(state, k)   where the current color sits, as {u, v}
  //  pick(u, v, k)    set the color from a pointer position
  // --------------------------------------------------------------------------

  var CUTS = [
    {
      id: 'hslL', space: 'hsl', name: 'L', axes: 'hue around · S outward',
      current: function () { return state.hsl.L; },
      label: function (k) { return 'L = ' + fmt(k, 3); },
      sample: function (u, v, k) {
        var x = 2 * u - 1, y = 2 * v - 1, r = Math.hypot(x, y);
        return r > 1 ? null : {hsl: {H: wrap(Math.atan2(y, x) / (2 * Math.PI)), S: r, L: k}};
      },
      sample3d: function (s, t, k) { return {hsl: {H: t, S: s, L: k}}; },
      mark: function () {
        var a = 2 * Math.PI * state.hsl.H;
        return {u: (1 + state.hsl.S * Math.cos(a)) / 2, v: (1 + state.hsl.S * Math.sin(a)) / 2};
      },
      pick: function (u, v, k) {
        var x = 2 * u - 1, y = 2 * v - 1;
        fromHSL({H: Math.atan2(y, x) / (2 * Math.PI), S: Math.min(1, Math.hypot(x, y)), L: k});
      }
    },
    {
      // The plane through the axis at hue H: hue H to the right, its
      // complement H + ½ to the left, lightness up.
      id: 'hslH', space: 'hsl', name: 'H', axes: '← H+½ · S · H → · L ↑',
      current: function () { return state.hsl.H; },
      label: function (k) { return 'H = ' + fmt(k, 3) + ' | ' + fmt(wrap(k + 0.5), 3); },
      sample: function (u, v, k) {
        var s = 2 * u - 1;
        return {hsl: {H: s >= 0 ? k : wrap(k + 0.5), S: Math.abs(s), L: v}};
      },
      sample3d: function (s, t, k) { return this.sample(s, t, k); },
      mark: function (k) {
        var same = Math.abs(wrap(state.hsl.H - k + 0.5) - 0.5) < 0.25;
        return {u: (1 + (same ? 1 : -1) * state.hsl.S) / 2, v: state.hsl.L};
      },
      pick: function (u, v, k) {
        var s = 2 * u - 1;
        fromHSL({H: s >= 0 ? k : k + 0.5, S: Math.min(1, Math.abs(s)), L: v});
      }
    },
    {
      // The cylinder of radius S, unrolled: hue across, lightness up.
      id: 'hslS', space: 'hsl', name: 'S', axes: 'H → · L ↑ (unrolled)',
      current: function () { return state.hsl.S; },
      label: function (k) { return 'S = ' + fmt(k, 3); },
      sample: function (u, v, k) { return {hsl: {H: u, S: k, L: v}}; },
      sample3d: function (s, t, k) { return this.sample(s, t, k); },
      mark: function () { return {u: state.hsl.H, v: state.hsl.L}; },
      pick: function (u, v, k) { fromHSL({H: u, S: k, L: v}); }
    },
    {
      id: 'labL', space: 'lab', name: 'L*', axes: 'a* → · b* ↑',
      current: function () { return state.lab.L; },
      label: function (k) { return 'L* = ' + fmt(k, 1); },
      sample: function (u, v, k) { return {lab: {L: k, a: AB * (2 * u - 1), b: AB * (2 * v - 1)}}; },
      sample3d: function (s, t, k) { return this.sample(s, t, k); },
      mark: function () { return {u: (1 + state.lab.a / AB) / 2, v: (1 + state.lab.b / AB) / 2}; },
      pick: function (u, v, k) { dragLab({L: k, a: AB * (2 * u - 1), b: AB * (2 * v - 1)}); }
    },
    {
      id: 'labA', space: 'lab', name: 'a*', axes: 'b* → · L* ↑',
      current: function () { return state.lab.a; },
      label: function (k) { return 'a* = ' + fmt(k, 1); },
      sample: function (u, v, k) { return {lab: {L: 100 * v, a: k, b: AB * (2 * u - 1)}}; },
      sample3d: function (s, t, k) { return this.sample(s, t, k); },
      mark: function () { return {u: (1 + state.lab.b / AB) / 2, v: state.lab.L / 100}; },
      pick: function (u, v, k) { dragLab({L: 100 * v, a: k, b: AB * (2 * u - 1)}); }
    },
    {
      id: 'labB', space: 'lab', name: 'b*', axes: 'a* → · L* ↑',
      current: function () { return state.lab.b; },
      label: function (k) { return 'b* = ' + fmt(k, 1); },
      sample: function (u, v, k) { return {lab: {L: 100 * v, a: AB * (2 * u - 1), b: k}}; },
      sample3d: function (s, t, k) { return this.sample(s, t, k); },
      mark: function () { return {u: (1 + state.lab.a / AB) / 2, v: state.lab.L / 100}; },
      pick: function (u, v, k) { dragLab({L: 100 * v, a: AB * (2 * u - 1), b: k}); }
    }
  ];

  function fixedOf(cut) { return (cut.id in anchors) ? anchors[cut.id] : cut.current(); }

  // --------------------------------------------------------------------------
  //  Setting the color from each model
  // --------------------------------------------------------------------------

  function fromRGB(c) {
    state.rgb = {R: c.R, G: c.G, B: c.B};
    var h = rgb2hsl(c.R, c.G, c.B);
    // A gray has no hue and black/white no saturation; keep the ones we had,
    // so the cuts do not jump to red when you pass through the axis.
    if (h.S === 0) { h.H = state.hsl.H; }
    if (h.L === 0 || h.L === 1) { h.S = state.hsl.S; }
    state.hsl = h;
    state.lab = rgb2cielab(c.R, c.G, c.B, refWhite());
    state.clipped = false;
    changed();
  }

  function fromHSL(h) {
    state.hsl = {H: wrap(h.H), S: clip(h.S, 0, 1), L: clip(h.L, 0, 1)};
    var c = hsl2rgb(state.hsl);
    state.rgb = c;
    state.lab = rgb2cielab(c.R, c.G, c.B, refWhite());
    state.clipped = false;
    changed();
  }

  // Set the color from L*a*b* exactly as given (clipping the display color
  // if it is outside sRGB, and saying so).
  function setLab(lab) {
    var f = cielab2rgbF(lab, refWhite());
    state.clipped = !inGamut(f);
    state.lab = {L: lab.L, a: lab.a, b: lab.b};
    var c = rgbClip(f);
    state.rgb = c;
    var h = rgb2hsl(c.R, c.G, c.B);
    if (h.S === 0) { h.H = state.hsl.H; }
    state.hsl = h;
    changed();
  }

  // Typed values: with the restriction on, pull an out-of-gamut color to the
  // boundary by reducing its chroma at constant L* and hue (the neutral axis
  // is always inside, so bisection on the chroma factor converges).
  function fromLab(lab) {
    var want = {L: clip(lab.L, 0, 100), a: lab.a, b: lab.b};
    if (state.gamut && !inGamut(cielab2rgbF(want, refWhite()))) {
      var lo = 0, hi = 1;
      for (var i = 0; i < 24; i++) {
        var m = (lo + hi) / 2;
        if (inGamut(cielab2rgbF({L: want.L, a: want.a * m, b: want.b * m}, refWhite()))) { lo = m; } else { hi = m; }
      }
      want = {L: want.L, a: want.a * lo, b: want.b * lo};
    }
    setLab(want);
  }

  // Dragging in a Lab cut: with the restriction on, a target outside the gamut
  // is replaced by the last in-gamut point on the segment from the current
  // color to it. Both ends lie in the cut's plane, so the color slides along
  // the gamut's edge without leaving the plane under the pointer.
  function dragLab(target) {
    target = {L: clip(target.L, 0, 100), a: target.a, b: target.b};
    var ref = refWhite();
    if (!state.gamut || inGamut(cielab2rgbF(target, ref))) { setLab(target); return; }
    var from = state.lab;
    if (!inGamut(cielab2rgbF(from, ref))) { fromLab(target); return; }
    var lo = 0, hi = 1;
    function at(t) {
      return {L: from.L + (target.L - from.L) * t, a: from.a + (target.a - from.a) * t,
              b: from.b + (target.b - from.b) * t};
    }
    for (var i = 0; i < 24; i++) {
      var m = (lo + hi) / 2;
      if (inGamut(cielab2rgbF(at(m), ref))) { lo = m; } else { hi = m; }
    }
    setLab(at(lo));
  }

  // --------------------------------------------------------------------------
  //  The 2-D cuts
  // --------------------------------------------------------------------------

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') { n.className = attrs[k]; }
      else if (k === 'text') { n.textContent = attrs[k]; }
      else if (k === 'html') { n.innerHTML = attrs[k]; }
      else { n.setAttribute(k, attrs[k]); }
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  var cutEls = {};

  CUTS.forEach(function (cut) {
    var canvas = el('canvas', {'aria-label': (cut.space === 'hsl' ? 'HSL' : 'L*a*b*') + ' cut at constant ' +
                                             cut.name + ': drag to choose the other two coordinates'});
    canvas.width = Math.round(CUT_PX * DPR);
    canvas.height = Math.round(CUT_PX * DPR);
    var cap = el('figcaption');
    $(cut.space === 'hsl' ? 'cutsHSL' : 'cutsLab').appendChild(el('figure', {class: 'cut'}, [canvas, cap]));
    cutEls[cut.id] = {canvas: canvas, cap: cap, key: null, bg: null};

    function local(e) {
      var r = canvas.getBoundingClientRect();
      return {u: clip((e.clientX - r.left) / r.width, 0, 1), v: clip(1 - (e.clientY - r.top) / r.height, 0, 1)};
    }
    // The active pointer is tracked here rather than read back from
    // hasPointerCapture, which is not reliable everywhere.
    var active = null;
    canvas.addEventListener('pointerdown', function (e) {
      active = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      anchors[cut.id] = cut.current();
      var p = local(e);
      cut.pick(p.u, p.v, anchors[cut.id]);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (active !== e.pointerId) { return; }
      var p = local(e);
      cut.pick(p.u, p.v, anchors[cut.id]);
    });
    function release() { active = null; delete anchors[cut.id]; changed(); }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  });

  function cutBackground(cut, k) {
    var E = cutEls[cut.id];
    var key = [fmt(k, 4), cut.space === 'lab' ? state.ref + state.gamut : ''].join(',');
    if (E.key === key) { return E.bg; }
    var ref = refWhite(), gam = state.gamut;
    var off = E.bg || document.createElement('canvas');
    // One computed pixel per device pixel: the cut is drawn 1:1, never scaled.
    var RES = E.canvas.width;
    off.width = RES; off.height = RES;
    var g = off.getContext('2d'), img = g.createImageData(RES, RES), d = img.data;
    for (var j = 0; j < RES; j++) {
      for (var i = 0; i < RES; i++) {
        var smp = cut.sample((i + 0.5) / RES, 1 - (j + 0.5) / RES, k), c = null;
        if (smp && smp.hsl) { c = hsl2rgb(smp.hsl); }
        else if (smp) {
          var f = cielab2rgbF(smp.lab, ref);
          c = (gam && !inGamut(f)) ? null : rgbClip(f);
        }
        if (!c) { continue; }
        var o = 4 * (j * RES + i);
        d[o] = c.R; d[o + 1] = c.G; d[o + 2] = c.B; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    E.key = key; E.bg = off;
    return off;
  }

  function drawCut(cut) {
    var E = cutEls[cut.id], k = fixedOf(cut);
    var g = E.canvas.getContext('2d'), W = E.canvas.width;
    g.clearRect(0, 0, W, W);
    if (cut.space === 'lab') {      // axes under the colors: they show where the gamut ends
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = DPR;
      g.beginPath();
      g.moveTo(W / 2, 0); g.lineTo(W / 2, W);
      if (cut.id === 'labL') { g.moveTo(0, W / 2); g.lineTo(W, W / 2); }
      g.stroke();
    }
    g.drawImage(cutBackground(cut, k), 0, 0);
    var m = cut.mark(k);
    var x = m.u * W, y = (1 - m.v) * W;
    g.beginPath(); g.arc(x, y, 5.5 * DPR, 0, 2 * Math.PI);
    g.fillStyle = toHex(state.rgb); g.fill();
    g.lineWidth = 2 * DPR; g.strokeStyle = '#fff'; g.stroke();
    g.lineWidth = DPR; g.strokeStyle = '#000';
    g.beginPath(); g.arc(x, y, 7 * DPR, 0, 2 * Math.PI); g.stroke();
    E.cap.innerHTML = '<b>' + cut.name + '</b> fixed · <span class="val">' + cut.label(k) + '</span><br>' + cut.axes;
  }

  // --------------------------------------------------------------------------
  //  The solid
  // --------------------------------------------------------------------------

  // Two stacked canvases: WebGL draws the solid and its cuts, the 2-D overlay
  // on top draws the marker and the axis names and takes the pointer. Without
  // WebGL the overlay's canvas falls back to a painter's-algorithm drawing.
  var solidCanvas = $('solid'), glCanvas = $('solidGL');
  [solidCanvas, glCanvas].forEach(function (c) {
    c.width = Math.round(SOLID_PX * DPR);
    c.height = Math.round(SOLID_PX * DPR);
  });
  var renderer = null;
  try { renderer = Solids.createGL(glCanvas); } catch (e) { console.warn('WebGL unavailable', e); }

  var meshCache = {solid: null, wire: null, solidKey: null, cuts: {}};

  function swap(old, fresh) { if (renderer && old) { renderer.release(old); } return fresh; }

  function solidMesh() {
    var key = [state.view, state.ref].join(',');
    if (meshCache.solidKey !== key) {
      meshCache.solid = swap(meshCache.solid, state.view === 'hsl' ? Solids.solidHSL() : Solids.solidLab(refWhite()));
      meshCache.wire = swap(meshCache.wire, state.view === 'hsl' ? Solids.wireHSL() : Solids.wireLab(refWhite()));
      meshCache.solidKey = key;
    }
    return meshCache.solid;
  }

  function cutMesh(cut) {
    var k = fixedOf(cut);
    var key = [state.view, state.ref, fmt(k, 4)].join(',');
    var c = meshCache.cuts[cut.id];
    if (!c || c.key !== key) {
      var mesh = Solids.buildCut(cut, k, state.view, refWhite());
      if (c) { swap(c.mesh, null); }
      c = meshCache.cuts[cut.id] = {key: key, mesh: mesh};
    }
    return c.mesh;
  }

  function drawSolid() {
    var scene = {
      view: state.view, solid: solidMesh(), wire: meshCache.wire, opacity: state.opacity,
      cuts: CUTS.filter(function (cut) { return state.show[cut.id]; }).map(cutMesh),
      marker: {p: Solids.posOfRGB(state.view, state.rgb, refWhite()), hex: toHex(state.rgb)}
    };
    if (renderer) {
      renderer.draw(camera, scene);
      Solids.drawOverlay(solidCanvas, camera, scene, DPR);
    } else {
      Solids.drawPainter(solidCanvas, camera, scene, DPR);
      Solids.drawOverlay(solidCanvas, camera, scene, DPR, true);
    }
  }

  (function () {
    // Drag rotates; shift-drag, or the right or middle button, pans; the wheel
    // zooms about the pointer; a double click puts the view back.
    var last = null, panning = false;
    solidCanvas.addEventListener('pointerdown', function (e) {
      try { solidCanvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      last = {x: e.clientX, y: e.clientY};
      panning = e.shiftKey || e.button === 1 || e.button === 2;
      e.preventDefault();
    });
    solidCanvas.addEventListener('pointermove', function (e) {
      if (!last) { return; }
      var dx = e.clientX - last.x, dy = e.clientY - last.y, r = solidCanvas.getBoundingClientRect();
      if (panning) {
        camera.panX += 2 * dx / r.width;
        camera.panY -= 2 * dy / r.height;
      } else {
        orbitCamera(camera, -dx, dy);
      }
      last = {x: e.clientX, y: e.clientY};
      requestSolid();
    });
    solidCanvas.addEventListener('pointerup', function () { last = null; });
    solidCanvas.addEventListener('pointercancel', function () { last = null; });
    solidCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    solidCanvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = solidCanvas.getBoundingClientRect();
      // The pointer, in the pan's units (half the canvas, y up).
      var px = 2 * (e.clientX - r.left) / r.width - 1, py = 1 - 2 * (e.clientY - r.top) / r.height;
      var z0 = camera.zoom, z1 = clip(z0 * Math.exp(-e.deltaY * 0.0015), 0.4, 8);
      // Keep the point under the pointer fixed while the scale changes.
      camera.panX = px - (px - camera.panX) * z1 / z0;
      camera.panY = py - (py - camera.panY) * z1 / z0;
      camera.zoom = z1;
      requestSolid();
    }, {passive: false});
    solidCanvas.addEventListener('dblclick', function () {
      Object.assign(camera, CAMERA0);
      requestSolid();
    });
  })();

  var solidFrame = 0;
  function requestSolid() {
    if (solidFrame) { return; }
    solidFrame = requestAnimationFrame(function () { solidFrame = 0; drawSolid(); });
  }

  // Controls of the solid: space, opacity, which cuts.
  $('space').addEventListener('change', function () { state.view = $('space').value; changed(); });
  $('opacity').addEventListener('input', function () { state.opacity = +$('opacity').value; changed(); });

  var toggleEls = {};
  (function () {
    var root = $('cutToggles');
    [['hsl', 'HSL'], ['lab', 'L*a*b*']].forEach(function (sp) {
      root.appendChild(el('span', {class: 'head', text: sp[1]}));
      CUTS.filter(function (c) { return c.space === sp[0]; }).forEach(function (cut) {
        var box = el('input', {type: 'checkbox', id: 'show-' + cut.id});
        box.addEventListener('change', function () { state.show[cut.id] = box.checked; changed(); });
        toggleEls[cut.id] = box;
        root.appendChild(el('label', {for: 'show-' + cut.id}, [box, document.createTextNode(cut.name)]));
      });
    });
  })();

  // --------------------------------------------------------------------------
  //  Numbers
  // --------------------------------------------------------------------------

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

  var hexEl = $('hex');
  hexEl.addEventListener('input', function () {
    var c = hex2rgb(hexEl.value);
    hexEl.classList.toggle('bad', !c);
    if (c) { fromRGB(c); }
  });
  hexEl.addEventListener('blur', function () { hexEl.classList.remove('bad'); sync(); });

  var refEl = $('ref');
  ILLUMINANTS.forEach(function (o) { refEl.appendChild(el('option', {value: o[0], text: o[1]})); });
  refEl.addEventListener('change', function () {
    state.ref = refEl.value;
    fromRGB(state.rgb);   // the stimulus stays; its L*a*b* description changes
  });

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
    $('space').value = state.view;
    $('opacity').value = state.opacity;
    CUTS.forEach(function (cut) { toggleEls[cut.id].checked = !!state.show[cut.id]; });

    var vals = {'XYZ': rgb2xyz(c.R, c.G, c.B), 'HSL': state.hsl, 'L*a*b*': state.lab, 'L*C*h°': lchOf(state.lab)};
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
        root.appendChild(el('span', {class: 'de', title: 'CIEDE2000 between neighbors', text: de.toFixed(1)}));
      }
      var x = el('button', {type: 'button', class: 'x', 'aria-label': 'Remove ' + hex, text: '×'});
      var chip = el('div', {class: 'chip', draggable: 'true', title: 'Click to load, drag to reorder'},
                    [el('div', {class: 'sw'}), el('code', {text: hex}), x]);
      chip.firstChild.style.background = hex;
      chip.addEventListener('click', function (e) { if (e.target !== x) { fromRGB(hex2rgb(hex)); } });
      x.addEventListener('click', function () { state.palette.splice(i, 1); renderPalette(); updatePermalink(); });
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
        state.palette.splice(i, 0, state.palette.splice(dragIndex, 1)[0]);
        renderPalette(); updatePermalink();
      });
      root.appendChild(chip);
    });
    root.scrollLeft = root.scrollWidth;   // the newest swatch in view
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

  FORMAT_ORDER.forEach(function (fmtName) {
    var b = el('button', {type: 'button', title: FORMATS[fmtName].label,
                          text: {list: 'copy', css: 'css', json: 'json', gpl: 'gimp'}[fmtName]});
    b.addEventListener('click', function () {
      if (!state.palette.length) { flash('The palette is empty'); return; }
      copy(formatPalette(state.palette, {format: fmtName, name: 'color-lab', source: location.href}),
           FORMATS[fmtName].label);
    });
    $('exportButtons').appendChild(b);
  });

  // --------------------------------------------------------------------------
  //  Permalink: ?c=RRGGBB&ref=D65&gamut=0&v=lab&k=hslL.labL&p=RRGGBB-RRGGBB
  // --------------------------------------------------------------------------

  var DEFAULT_SHOW = 'hslL.labL';

  function shownList() { return CUTS.filter(function (c) { return state.show[c.id]; }).map(function (c) { return c.id; }).join('.'); }

  function query() {
    var q = ['c=' + toHex(state.rgb).slice(1)];
    if (state.ref !== 'D65') { q.push('ref=' + state.ref); }
    if (!state.gamut) { q.push('gamut=0'); }
    if (state.view !== 'hsl') { q.push('v=' + state.view); }
    if (shownList() !== DEFAULT_SHOW) { q.push('k=' + (shownList() || 'none')); }
    if (state.palette.length) { q.push('p=' + state.palette.map(function (h) { return h.slice(1); }).join('-')); }
    return '?' + q.join('&');
  }

  function updatePermalink() {
    try { history.replaceState(null, '', query()); } catch (e) { /* some browsers refuse on file:// */ }
  }

  function readQuery() {
    var q = new URLSearchParams(location.search);
    if (q.get('ref') && tristimulus[q.get('ref')]) { state.ref = q.get('ref'); }
    if (q.get('gamut') === '0') { state.gamut = false; }
    if (q.get('v') === 'lab') { state.view = 'lab'; }
    if (q.get('k')) {
      state.show = {};
      q.get('k').split('.').forEach(function (id) {
        if (CUTS.some(function (c) { return c.id === id; })) { state.show[id] = true; }
      });
    }
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
    // One repaint per screen frame, however fast the input arrives.
    if (frame) { return; }
    frame = requestAnimationFrame(function () {
      frame = 0;
      sync();
      CUTS.forEach(drawCut);
      drawSolid();
      updatePermalink();
    });
  }

  $('gamut').addEventListener('change', function () {
    state.gamut = $('gamut').checked;
    if (state.gamut) { fromLab(state.lab); } else { changed(); }
  });

  function randomColor() {
    return {R: Math.floor(256 * Math.random()), G: Math.floor(256 * Math.random()), B: Math.floor(256 * Math.random())};
  }

  $('random').addEventListener('click', function () { fromRGB(randomColor()); });
  $('sample').addEventListener('click', function () {
    state.palette.push(toHex(state.rgb));
    renderPalette(); updatePermalink();
  });
  $('permalink').addEventListener('click', function () { copy(location.href, 'Link'); });

  var start = readQuery();
  fromRGB(start || randomColor());
  renderPalette();
})();
