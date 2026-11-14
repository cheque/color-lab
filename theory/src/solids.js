// ============================================================================
//  theory/src/solids.js — the color solids and their plane cuts, in 3-D
//
//  Two solids can be shown, one at a time:
//    hsl  the HSL cylinder:      x = S cos 2πH, y = S sin 2πH, z = 2L − 1
//    lab  the sRGB gamut inside CIE L*a*b*:  x = a*/AB, y = b*/AB, z = L*/50 − 1
//
//  A cut is a one-parameter family of planes in ONE space (HSL at constant L,
//  H or S; L*a*b* at constant L*, a* or b*). Shown in its own space it is
//  flat, at its geometric place. Shown in the other space, each of its points
//  is carried over by the color conversion, so it arrives curved: that is
//  the "real vs transformed" comparison. Lab points outside sRGB have no HSL
//  image, so in 3-D the Lab cuts are clipped to the gamut in either space;
//  quads on the gamut's edge are refined by bisection so the rim is smooth.
//
//  Rendering is WebGL with a depth buffer: the cuts are opaque and drawn
//  first, then the solid's translucent boundary and the wireframe are
//  depth-tested against them, so intersecting cuts meet cleanly. Colors are
//  per vertex. If WebGL is missing, a painter's-algorithm canvas fallback
//  draws the same meshes (correct except where opaque cuts intersect).
//
//  Requires: lib/color.js, lib/scene.js
// ============================================================================

var Solids = (function () {
  'use strict';

  var AB = 110;          // a*, b* in [-AB, AB] map to [-1, 1]
  var SOLID_N = 24;      // grid per face of the boundary
  var CUT_N = 48;        // grid per cut
  var FIT = 0.875 / Math.SQRT2;   // the cylinder's rims fit from every angle

  function posHSL(h) {
    var a = 2 * Math.PI * h.H;
    return {x: h.S * Math.cos(a), y: h.S * Math.sin(a), z: 2 * h.L - 1};
  }
  function posLab(l) { return {x: l.a / AB, y: l.b / AB, z: l.L / 50 - 1}; }

  // Where an (unclipped, in-gamut) sRGB color sits in a space.
  function posOfRGB(space, c, ref) {
    if (space === 'hsl') { return posHSL(rgb2hsl(c.R, c.G, c.B)); }
    return posLab(rgb2cielab(c.R, c.G, c.B, ref));
  }

  // A cut sample is {hsl: …} or {lab: …} (or null outside the cut's shape).
  // Its sRGB color, or null when it has none (Lab outside the gamut).
  function rgbOfSample(smp, ref) {
    if (!smp) { return null; }
    if (smp.hsl) { return hsl2rgbF(smp.hsl); }
    var c = cielab2rgbF(smp.lab, ref);
    return inGamut(c, 0.5) ? c : null;
  }

  // ---- meshes: lists of quads with a color per corner ----------------------
  //  {quads: [{p: [4 points], c: [4 colors {R,G,B} 0..255]}], alpha}
  //  A triangle is a quad whose last corner repeats the third.

  function solidHSL() {
    var quads = [], NH = 4 * SOLID_N, NL = SOLID_N;
    function v(h, l) { return {p: posHSL({H: h, S: 1, L: l}), c: hsl2rgbF({H: h, S: 1, L: l})}; }
    for (var i = 0; i < NH; i++) {
      var h0 = i / NH, h1 = (i + 1) / NH;
      for (var j = 0; j < NL; j++) {
        var l0 = j / NL, l1 = (j + 1) / NL;
        var q = [v(h0, l0), v(h1, l0), v(h1, l1), v(h0, l1)];
        quads.push({p: q.map(function (x) { return x.p; }), c: q.map(function (x) { return x.c; })});
      }
      // The caps: white on top, black below.
      var a0 = 2 * Math.PI * h0, a1 = 2 * Math.PI * h1;
      [[1, {R: 255, G: 255, B: 255}], [-1, {R: 0, G: 0, B: 0}]].forEach(function (cap) {
        var c0 = {x: 0, y: 0, z: cap[0]}, c1 = {x: Math.cos(a0), y: Math.sin(a0), z: cap[0]},
            c2 = {x: Math.cos(a1), y: Math.sin(a1), z: cap[0]};
        quads.push({p: [c0, c1, c2, c2], c: [cap[1], cap[1], cap[1], cap[1]]});
      });
    }
    return {quads: quads};
  }

  // The sRGB gamut in L*a*b*: the image of the RGB cube's six faces.
  function solidLab(ref) {
    var quads = [], N = SOLID_N;
    for (var axis = 0; axis < 3; axis++) {
      [0, 255].forEach(function (fixed) {
        function rgbAt(u, v) {
          var c = [0, 0, 0];
          c[axis] = fixed; c[(axis + 1) % 3] = 255 * u; c[(axis + 2) % 3] = 255 * v;
          return {R: c[0], G: c[1], B: c[2]};
        }
        for (var i = 0; i < N; i++) {
          for (var j = 0; j < N; j++) {
            var cs = [rgbAt(i / N, j / N), rgbAt((i + 1) / N, j / N),
                      rgbAt((i + 1) / N, (j + 1) / N), rgbAt(i / N, (j + 1) / N)];
            quads.push({p: cs.map(function (c) { return posOfRGB('lab', c, ref); }), c: cs});
          }
        }
      });
    }
    return {quads: quads};
  }

  // Wireframes as polylines: [{pts: [...], rgba: [r,g,b,a]}].
  function wireHSL() {
    var lines = [], W = [1, 1, 1, 0.38], Wf = [1, 1, 1, 0.18];
    [-1, 0, 1].forEach(function (z) {
      var pts = [];
      for (var k = 0; k <= 96; k++) {
        var a = 2 * Math.PI * k / 96;
        pts.push({x: Math.cos(a), y: Math.sin(a), z: z});
      }
      lines.push({pts: pts, rgba: z === 0 ? Wf : W});
    });
    for (var m = 0; m < 12; m++) {
      var a = 2 * Math.PI * m / 12;
      lines.push({pts: [{x: Math.cos(a), y: Math.sin(a), z: -1}, {x: Math.cos(a), y: Math.sin(a), z: 1}], rgba: Wf});
    }
    lines.push({pts: [{x: 0, y: 0, z: -1}, {x: 0, y: 0, z: 1}], rgba: Wf});
    return lines;
  }

  // The twelve edges of the RGB cube, carried into L*a*b*: the gamut's outline.
  function wireLab(ref) {
    var corners = [], lines = [];
    for (var k = 0; k < 8; k++) { corners.push([(k & 1) ? 255 : 0, (k & 2) ? 255 : 0, (k & 4) ? 255 : 0]); }
    for (var a = 0; a < 8; a++) {
      for (var b = a + 1; b < 8; b++) {
        var diff = 0;
        for (var t = 0; t < 3; t++) { if (corners[a][t] !== corners[b][t]) { diff++; } }
        if (diff !== 1) { continue; }
        var pts = [];
        for (var s = 0; s <= 32; s++) {
          var f = s / 32, c = corners[a], d = corners[b];
          pts.push(posOfRGB('lab', {R: c[0] + (d[0] - c[0]) * f, G: c[1] + (d[1] - c[1]) * f,
                                    B: c[2] + (d[2] - c[2]) * f}, ref));
        }
        lines.push({pts: pts, rgba: [1, 1, 1, 0.38]});
      }
    }
    lines.push({pts: [{x: 0, y: 0, z: -1}, {x: 0, y: 0, z: 1}], rgba: [1, 1, 1, 0.18]});
    return lines;
  }

  // ---- a cut, in its own space or carried into the other -------------------

  // `cut.sample3d(s, t, val)` gives the cut's point for grid coordinates
  // s, t in [0,1] (see the CUTS table in app.js).
  function buildCut(cut, val, view, ref) {
    var N = CUT_N;

    // The cut's vertex at grid coordinates (s, t): position in the view's
    // space and color, or null where it has no sRGB color.
    function vertex(s, t) {
      var smp = cut.sample3d(s, t, val), c = rgbOfSample(smp, ref);
      if (!c) { return null; }
      var p = (cut.space === view) ? (smp.hsl ? posHSL(smp.hsl) : posLab(smp.lab)) : posOfRGB(view, c, ref);
      return {p: p, c: c};
    }

    var grid = [];
    for (var j = 0; j <= N; j++) {
      grid.push([]);
      for (var i = 0; i <= N; i++) { grid[j].push(vertex(i / N, j / N)); }
    }

    var quads = [];
    for (var jj = 0; jj < N; jj++) {
      for (var ii = 0; ii < N; ii++) {
        var st = [[ii, jj], [ii + 1, jj], [ii + 1, jj + 1], [ii, jj + 1]];
        var q = st.map(function (c) { return grid[c[1]][c[0]]; });
        var inside = q.filter(Boolean).length;
        if (inside === 0) { continue; }

        // A quad straddling the gamut's edge: pull each outside corner in along
        // an edge to an inside corner, by bisection, until it sits on the
        // boundary. Without this the rim is a staircase of whole quads.
        if (inside < 4) {
          var fixed = q.slice();
          for (var k = 0; k < 4; k++) {
            if (q[k]) { continue; }
            var from = q[(k + 3) % 4] ? (k + 3) % 4 : q[(k + 1) % 4] ? (k + 1) % 4 : (k + 2) % 4;
            if (!q[from]) { continue; }
            var a = st[from], b = st[k], lo = 0, hi = 1, best = q[from];
            for (var it = 0; it < 14; it++) {
              var m = (lo + hi) / 2;
              var v = vertex((a[0] + (b[0] - a[0]) * m) / N, (a[1] + (b[1] - a[1]) * m) / N);
              if (v) { lo = m; best = v; } else { hi = m; }
            }
            fixed[k] = best;
          }
          q = fixed;
          if (!q[0] || !q[1] || !q[2] || !q[3]) { continue; }
        }
        quads.push({p: q.map(function (x) { return x.p; }), c: q.map(function (x) { return x.c; })});
      }
    }
    return {quads: quads};
  }

  // ---- the overlay: the marker and the axis names --------------------------

  function toScreen(p, basis, W, H) {
    var q = project(p, basis), s = (Math.min(W, H) / 2) * FIT;
    return {x: W / 2 + s * q.x, y: H / 2 - s * q.y};
  }

  // `keep` draws over what is there (the painter's fallback shares the canvas).
  function drawOverlay(canvas, camera, scene, dpr, keep) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!keep) { ctx.clearRect(0, 0, W, H); }
    var basis = cameraBasis(camera);
    if (scene.marker) {
      var m = toScreen(scene.marker.p, basis, W, H);
      ctx.beginPath(); ctx.arc(m.x, m.y, 6 * dpr, 0, 2 * Math.PI);
      ctx.fillStyle = scene.marker.hex; ctx.fill();
      ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.lineWidth = dpr; ctx.strokeStyle = '#000';
      ctx.beginPath(); ctx.arc(m.x, m.y, 7.5 * dpr, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.font = (11 * dpr) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    var labels = scene.view === 'lab'
      ? [[{x: 1.05, y: 0, z: 0}, '+a*'], [{x: 0, y: 1.05, z: 0}, '+b*'], [{x: 0, y: 0, z: 1.1}, 'L*']]
      : [[{x: 1.08, y: 0, z: 1}, 'H = 0'], [{x: 0, y: 0, z: 1.1}, 'L']];
    labels.forEach(function (lbl) {
      var q = toScreen(lbl[0], basis, W, H);
      ctx.fillText(lbl[1], q.x - 8 * dpr, q.y + 4 * dpr);
    });
  }

  // ---- WebGL renderer ---------------------------------------------------------

  var VS = [
    'attribute vec3 p; attribute vec4 c;',
    'uniform vec3 R, U, E; uniform float s;',
    'varying vec4 vc;',
    'void main() {',
    '  gl_Position = vec4(s * dot(p, R), s * dot(p, U), -0.5 * dot(p, E), 1.0);',
    '  vc = c;',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float;',
    'varying vec4 vc; uniform float alpha;',
    'void main() { gl_FragColor = vec4(vc.rgb, vc.a * alpha); }'
  ].join('\n');

  function createGL(canvas) {
    var gl = canvas.getContext('webgl', {antialias: true, alpha: true, premultipliedAlpha: false});
    if (!gl) { return null; }
    function shader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(sh)); }
      return sh;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { return null; }
    var loc = {
      p: gl.getAttribLocation(prog, 'p'), c: gl.getAttribLocation(prog, 'c'),
      R: gl.getUniformLocation(prog, 'R'), U: gl.getUniformLocation(prog, 'U'),
      E: gl.getUniformLocation(prog, 'E'), s: gl.getUniformLocation(prog, 's'),
      alpha: gl.getUniformLocation(prog, 'alpha')
    };

    // Upload a mesh (quads → triangles) or a set of polylines (→ segments),
    // once; the buffers ride on the object, which the caller caches.
    function triangles(mesh) {
      if (mesh._gl) { return mesh._gl; }
      var P = [], C = [];
      mesh.quads.forEach(function (q) {
        [0, 1, 2, 0, 2, 3].forEach(function (k) {
          P.push(q.p[k].x, q.p[k].y, q.p[k].z);
          C.push(q.c[k].R / 255, q.c[k].G / 255, q.c[k].B / 255, 1);
        });
      });
      return (mesh._gl = buffers(P, C, gl.TRIANGLES));
    }
    function segments(lines) {
      if (lines._gl) { return lines._gl; }
      var P = [], C = [];
      lines.forEach(function (l) {
        for (var i = 0; i < l.pts.length - 1; i++) {
          [l.pts[i], l.pts[i + 1]].forEach(function (p) {
            P.push(p.x, p.y, p.z); C.push(l.rgba[0], l.rgba[1], l.rgba[2], l.rgba[3]);
          });
        }
      });
      return (lines._gl = buffers(P, C, gl.LINES));
    }
    function buffers(P, C, mode) {
      var bp = gl.createBuffer(), bc = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bc); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(C), gl.STATIC_DRAW);
      return {bp: bp, bc: bc, n: P.length / 3, mode: mode, gl: gl};
    }
    function release(obj) {
      if (obj && obj._gl && obj._gl.gl === gl) { gl.deleteBuffer(obj._gl.bp); gl.deleteBuffer(obj._gl.bc); delete obj._gl; }
    }
    function drawBuf(b, alpha) {
      if (!b.n) { return; }
      gl.uniform1f(loc.alpha, alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.bp);
      gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.bc);
      gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(b.mode, 0, b.n);
    }

    function draw(camera, scene) {
      var basis = cameraBasis(camera);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform3f(loc.R, basis.right.x, basis.right.y, basis.right.z);
      gl.uniform3f(loc.U, basis.up.x, basis.up.y, basis.up.z);
      gl.uniform3f(loc.E, basis.eye.x, basis.eye.y, basis.eye.z);
      gl.uniform1f(loc.s, FIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      // 1. the cuts: opaque, writing depth
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      scene.cuts.forEach(function (m) { drawBuf(triangles(m), 1); });

      // 2. the solid's skin and the wireframe: translucent, tested, not written
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      if (scene.opacity > 0) { drawBuf(triangles(scene.solid), scene.opacity); }
      drawBuf(segments(scene.wire), 1);
      gl.depthMask(true);
    }

    return {draw: draw, release: release};
  }

  // ---- canvas fallback (painter's algorithm) ---------------------------------

  function drawPainter(canvas, camera, scene, dpr) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var s = (Math.min(W, H) / 2) * FIT, basis = cameraBasis(camera), px = 1 / s;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, -s, W / 2, H / 2);
    var items = [];
    function add(mesh, alpha) {
      mesh.quads.forEach(function (q) {
        var d = 0, c = {R: 0, G: 0, B: 0};
        q.p.forEach(function (p, k) {
          d += p.x * basis.eye.x + p.y * basis.eye.y + p.z * basis.eye.z;
          c.R += q.c[k].R / 4; c.G += q.c[k].G / 4; c.B += q.c[k].B / 4;
        });
        items.push({s: q.p.map(function (p) { return project(p, basis); }), d: d / 4, c: rgbClip(c), a: alpha});
      });
    }
    scene.cuts.forEach(function (m) { add(m, 1); });
    if (scene.opacity > 0) { add(scene.solid, scene.opacity); }
    items.sort(function (a, b) { return a.d - b.d; });
    items.forEach(function (it) {
      var col = 'rgba(' + it.c.R + ',' + it.c.G + ',' + it.c.B + ',' + it.a + ')';
      ctx.beginPath();
      it.s.forEach(function (p, i) { if (i) { ctx.lineTo(p.x, p.y); } else { ctx.moveTo(p.x, p.y); } });
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      if (it.a === 1) { ctx.lineWidth = 0.8 * dpr * px; ctx.strokeStyle = col; ctx.stroke(); }
    });
    ctx.lineWidth = dpr * px;
    scene.wire.forEach(function (l) {
      ctx.strokeStyle = 'rgba(255,255,255,' + l.rgba[3] + ')';
      ctx.beginPath();
      l.pts.forEach(function (p, i) { var q = project(p, basis); if (i) { ctx.lineTo(q.x, q.y); } else { ctx.moveTo(q.x, q.y); } });
      ctx.stroke();
    });
  }

  return {
    AB: AB, posHSL: posHSL, posLab: posLab, posOfRGB: posOfRGB,
    solidHSL: solidHSL, solidLab: solidLab, wireHSL: wireHSL, wireLab: wireLab,
    buildCut: buildCut, createGL: createGL, drawPainter: drawPainter, drawOverlay: drawOverlay
  };
})();
