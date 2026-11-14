// ============================================================================
//  home.js — the pictures on the home page's cards
//
//  Each card is drawn live by the instrument's own code (lib/color.js,
//  lib/scene.js, curves/src/curve.js), so the pictures are the model itself,
//  not screenshots. The three workshop cards preview what their instrument
//  will compute, with the same mathematics at miniature scale.
//
//  Requires: lib/color.js, lib/scene.js, curves/src/curve.js, theory/src/solids.js
// ============================================================================

(function () {
  'use strict';

  var GROUND = '#5b5b5b';

  // Size a canvas to its CSS box at the device's pixel ratio and hand back a
  // context in CSS pixels.
  function setup(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) { return null; }
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, w, h);
    return {ctx: ctx, w: w, h: h, dpr: dpr};
  }

  // Fill a rectangle pixel by pixel: f(u, v) returns {R,G,B} or null (ground),
  // with u, v in [-1, 1] across the rectangle and v pointing up.
  function pixels(g, x0, y0, w, h, f) {
    var W = Math.round(w * g.dpr), H = Math.round(h * g.dpr);
    var img = g.ctx.createImageData(W, H), d = img.data;
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var c = f(2 * (i + 0.5) / W - 1, 1 - 2 * (j + 0.5) / H);
        if (!c) { continue; }
        var k = 4 * (j * W + i);
        d[k] = c.R; d[k + 1] = c.G; d[k + 2] = c.B; d[k + 3] = 255;
      }
    }
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    off.getContext('2d').putImageData(img, 0, 0);
    g.ctx.drawImage(off, x0, y0, w, h);
  }

  // A context whose units are the curve's: origin at (cx, cy), y up, `s` px
  // per unit. Scene's functions draw in these units.
  function unitFrame(g, cx, cy, s) {
    g.ctx.save();
    g.ctx.translate(cx, cy);
    g.ctx.scale(s, -s);
  }

  // --------------------------------------------------------------------------
  //  0 · Parametric curves: the spring inside the wireframe cylinder
  // --------------------------------------------------------------------------
  function paintCurves(g) {
    var p = {shape: 'pbell', k: 1.2, sign: -1, N: 2.6, t0: 0.08, S: 1, L0: 0.04, L1: 0.97};
    var curve = makeCurve(p), point = makeCurvePoint(p);
    var basis = cameraBasis({th: 0.375, ph: 0.06});
    var n = 600, pts = [], cols = [];
    for (var i = 0; i <= n; i++) {
      var t = -1 + 2 * i / n;
      pts.push(point(t));
      cols.push(toHex(hsl2rgb(curve(t))));
    }
    unitFrame(g, g.w / 2, g.h / 2, g.h / 2 * 0.62);
    drawCylinder(g.ctx, basis, {width: 0.006});
    strokeCurve(g.ctx, projectAll(pts, basis), cols, 0.03);
    g.ctx.restore();
  }

  // --------------------------------------------------------------------------
  //  1 · Color models: the HSL disc beside the a*b* plane, gamut-clipped
  // --------------------------------------------------------------------------
  function paintTheory(g) {
    var side = Math.min(g.w * 0.36, g.h * 0.7);
    var gap = (g.w - 2 * side) / 3.6;          // the disc a little left, the solid more room
    var y0 = (g.h - side) / 2;

    pixels(g, gap, y0, side, side, function (u, v) {
      var r = Math.hypot(u, v);
      if (r > 1) { return null; }
      var H = Math.atan2(v, u) / (2 * Math.PI);
      return hsl2rgb({H: H - Math.floor(H), S: r, L: 0.5});
    });

    // The L*a*b* solid: the sRGB gamut, opaque, drawn by the color-models
    // instrument's own painter (theory/src/solids.js) on a canvas of its own.
    var F = 1.7, box = side * F;               // the solid's frame, larger than the disc's
    var off = document.createElement('canvas');
    off.width = Math.round(box * g.dpr); off.height = Math.round(box * g.dpr);
    var camera = {th: 0.1, ph: 0.06, zoom: 1.1, panX: 0, panY: 0};
    Solids.drawPainter(off, camera, {cuts: [], solid: Solids.solidLab(D65), opacity: 1, wire: []}, g.dpr);
    g.ctx.drawImage(off, 2.45 * gap + side + side / 2 - box / 2, y0 + side / 2 - box / 2, box, box);

    // One color marked on the disc's rim and on the solid's skin: full HSL
    // saturation puts it on a face of the RGB cube, hence on the gamut's surface.
    var mark = {R: 214, G: 30, B: 120};
    var hsl = rgb2hsl(mark.R, mark.G, mark.B);
    var r = side / 2;
    var ctx = g.ctx;
    function dot(x, y) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = toHex(mark); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    dot(gap + r + r * hsl.S * Math.cos(2 * Math.PI * hsl.H),
        y0 + r - r * hsl.S * Math.sin(2 * Math.PI * hsl.H));
    var basis = cameraBasis(camera), q = project(Solids.posLab(rgb2cielab(mark.R, mark.G, mark.B, D65)), basis);
    var S = (box / 2) * (0.875 / Math.SQRT2) * camera.zoom;
    dot(2.45 * gap + side + r + S * q.x, y0 + r - S * q.y);
  }

  // --------------------------------------------------------------------------
  //  2 · Palettes from a photograph: nested median cut on a painted landscape
  // --------------------------------------------------------------------------

  // A small procedural "photograph": dusk sky, a low sun, two ranges of hills
  // and a lake. Returned as an array of {R,G,B} plus its size.
  function landscape(W, H) {
    var px = [];
    function mix(a, b, s) { return a + (b - a) * s; }
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var x = i / W, y = j / H, c;
        var hill1 = 0.62 + 0.06 * Math.sin(7 * x + 1.3) + 0.03 * Math.sin(19 * x);
        var hill2 = 0.72 + 0.05 * Math.sin(4 * x - 0.4) + 0.02 * Math.sin(23 * x + 2);
        if (y > 0.84) {                       // the lake mirrors the sky, darker
          var m = 1.68 - y;
          c = {H: mix(0.62, 1.04, m), S: 0.45, L: mix(0.20, 0.40, m)};
        } else if (y > hill2) {
          c = {H: 0.36, S: 0.35, L: 0.16 + 0.06 * (y - hill2)};
        } else if (y > hill1) {
          c = {H: 0.72, S: 0.22, L: 0.30};
        } else {
          var sun = Math.hypot(x - 0.7, (y - 0.5) * 1.3);
          c = {H: mix(0.62, 1.07, y / hill1), S: mix(0.45, 0.85, y / hill1), L: mix(0.30, 0.62, y / hill1)};
          if (sun < 0.07) { c = {H: 0.12, S: 1, L: 0.82}; }
          else if (sun < 0.2) { c.L += 0.2 * (1 - sun / 0.2); c.H = mix(1.11, c.H, sun / 0.2); }
        }
        c.H -= Math.floor(c.H);
        px.push(hsl2rgb(c));
      }
    }
    return {px: px, W: W, H: H};
  }

  // Median cut, one split at a time: the box with the largest spread along its
  // widest channel is cut at its median. Every palette is therefore the
  // previous one with one color replaced by two — a genuine pyramid.
  function medianCutPyramid(px, levels) {
    function boxOf(list) {
      var lo = [255, 255, 255], hi = [0, 0, 0], sum = [0, 0, 0];
      list.forEach(function (c) {
        var v = [c.R, c.G, c.B];
        for (var k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); sum[k] += v[k];
        }
      });
      var axis = 0, span = -1;
      for (var k = 0; k < 3; k++) { if (hi[k] - lo[k] > span) { span = hi[k] - lo[k]; axis = k; } }
      return {list: list, axis: axis, score: span * Math.sqrt(list.length),
              mean: {R: sum[0] / list.length, G: sum[1] / list.length, B: sum[2] / list.length}};
    }
    var boxes = [boxOf(px)], out = [];
    for (var n = 1; n <= levels; n++) {
      out.push(boxes.map(function (b) { return b.mean; })
                    .sort(function (a, b) { return rgb2hsl(a.R, a.G, a.B).L - rgb2hsl(b.R, b.G, b.B).L; }));
      var best = 0;
      boxes.forEach(function (b, i) { if (b.score > boxes[best].score) { best = i; } });
      var B = boxes[best], key = ['R', 'G', 'B'][B.axis];
      var sorted = B.list.slice().sort(function (a, b) { return a[key] - b[key]; });
      var mid = sorted.length >> 1;
      if (mid < 1) { break; }
      boxes.splice(best, 1, boxOf(sorted.slice(0, mid)), boxOf(sorted.slice(mid)));
    }
    return out;
  }

  function paintSampling(g) {
    var ctx = g.ctx;
    var photo = landscape(64, 48);
    var pw = g.w * 0.44, ph = pw * 0.75, px0 = g.w * 0.05, py0 = (g.h - ph) / 2;
    var cw = pw / photo.W, ch = ph / photo.H;
    photo.px.forEach(function (c, k) {
      ctx.fillStyle = toHex(c);
      ctx.fillRect(px0 + (k % photo.W) * cw, py0 + Math.floor(k / photo.W) * ch, cw + 0.5, ch + 0.5);
    });

    var levels = 6, rows = medianCutPyramid(photo.px, levels);
    var area = {x: g.w * 0.55, w: g.w * 0.40};
    var rowH = Math.min(g.h * 0.12, (g.h * 0.8) / levels), gapY = rowH * 0.22;
    var top = (g.h - levels * rowH - (levels - 1) * gapY) / 2;
    rows.forEach(function (row, r) {
      var sw = area.w / levels, total = sw * row.length;
      var x = area.x + (area.w - total) / 2, y = top + r * (rowH + gapY);
      row.forEach(function (c, i) {
        ctx.fillStyle = toHex(rgbClip(c));
        ctx.fillRect(x + i * sw + 1, y, sw - 2, rowH);
      });
    });
  }

  // --------------------------------------------------------------------------
  //  3 · Palette analysis: colors in the HSL disc and paths that join them
  // --------------------------------------------------------------------------
  function paintAnalysis(g) {
    var ctx = g.ctx;
    var R = g.h * 0.4, cx = g.w / 2, cy = g.h / 2;
    pixels(g, cx - R, cy - R, 2 * R, 2 * R, function (u, v) {
      var r = Math.hypot(u, v);
      if (r > 1) { return null; }
      var H = Math.atan2(v, u) / (2 * Math.PI);
      var c = hsl2rgbF({H: H - Math.floor(H), S: r, L: 0.5});
      // A veil over the disc so the paths read on top of it.
      return rgbClip({R: 0.35 * c.R + 0.65 * 91, G: 0.35 * c.G + 0.65 * 91, B: 0.35 * c.B + 0.65 * 91});
    });

    var keys = [{H: 0.58, S: 0.85, L: 0.35}, {H: 0.95, S: 0.7, L: 0.55},
                {H: 0.12, S: 0.9, L: 0.62}, {H: 0.33, S: 0.55, L: 0.45}];
    function xy(c) {
      return {x: c.S * Math.cos(2 * Math.PI * c.H), y: c.S * Math.sin(2 * Math.PI * c.H)};
    }
    function toScreen(p) { return {x: cx + R * p.x, y: cy - R * p.y}; }

    // Path A: a Catmull–Rom spline through the keys in the disc's own
    // Cartesian coordinates (a chain of cubic Béziers). Path B: straight steps
    // in (H, S) — the cylindrical interpolation, which bends into arcs.
    function catmull(P, t) {
      var n = P.length - 1, seg = Math.min(n - 1, Math.floor(t * n)), u = t * n - seg;
      var p0 = P[Math.max(0, seg - 1)], p1 = P[seg], p2 = P[seg + 1], p3 = P[Math.min(n, seg + 2)];
      function c(a, b, cc, d) {
        return 0.5 * ((2 * b) + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
      }
      return {x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y),
              L: c(p0.L, p1.L, p2.L, p3.L)};
    }
    var P = keys.map(function (k) { var q = xy(k); q.L = k.L; return q; });
    function strokePath(f, width, dash) {
      var n = 160, prev = null;
      ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.setLineDash(dash || []);
      for (var i = 0; i <= n; i++) {
        var q = f(i / n), s = toScreen(q);
        if (prev) {
          var H = Math.atan2(q.y, q.x) / (2 * Math.PI);
          ctx.strokeStyle = toHex(hsl2rgb({H: H - Math.floor(H), S: Math.min(1, Math.hypot(q.x, q.y)), L: q.L}));
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(s.x, s.y); ctx.stroke();
        }
        prev = s;
      }
      ctx.setLineDash([]);
    }
    strokePath(function (t) {
      var n = keys.length - 1, seg = Math.min(n - 1, Math.floor(t * n)), u = t * n - seg;
      var a = keys[seg], b = keys[seg + 1];
      var dH = ((b.H - a.H + 1.5) % 1) - 0.5;                     // the short way round
      var c = {H: a.H + dH * u, S: a.S + (b.S - a.S) * u, L: a.L + (b.L - a.L) * u};
      var q = xy(c); q.L = c.L; return q;
    }, 2, [5, 5]);
    strokePath(function (t) { return catmull(P, t); }, 5);

    keys.forEach(function (k) {
      var s = toScreen(xy(k));
      ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = toHex(hsl2rgb(k)); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    });
  }

  // --------------------------------------------------------------------------
  //  4 · Random flights: the disc an arrow cuts through the solid
  // --------------------------------------------------------------------------
  function paintTrajectories(g) {
    var ctx = g.ctx;
    var c = {x: 0.15, y: -0.1, z: 0.05};                 // where the arrow is
    var d = norm({x: 0.55, y: 0.35, z: 0.75});           // where it is heading
    var rho = 0.85;                                      // disc radius
    // An orthonormal frame around d.
    var u = norm(cross(d, Math.abs(d.z) < 0.9 ? {x: 0, y: 0, z: 1} : {x: 1, y: 0, z: 0}));
    var v = cross(d, u);

    function at(s, t) {
      return {x: c.x + rho * (s * u.x + t * v.x), y: c.y + rho * (s * u.y + t * v.y),
              z: c.z + rho * (s * u.z + t * v.z)};
    }
    function colorAt(p) {
      var H = Math.atan2(p.y, p.x) / (2 * Math.PI);
      return hsl2rgb({H: H - Math.floor(H), S: Math.min(1, Math.hypot(p.x, p.y)),
                      L: Math.max(0, Math.min(1, (p.z + 1) / 2))});
    }

    // The big circle: what the screen will show.
    var R = g.h * 0.4, cx = g.w * 0.66, cy = g.h / 2;
    pixels(g, cx - R, cy - R, 2 * R, 2 * R, function (s, t) {
      return (s * s + t * t > 1) ? null : colorAt(at(s, t));
    });
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();

    // The miniature: cylinder, the arrow and its disc.
    var basis = cameraBasis({th: 0.4, ph: 0.08});
    var m = g.h * 0.2, mx = g.w * 0.2, my = g.h / 2;
    unitFrame(g, mx, my, m);
    drawCylinder(ctx, basis, {width: 0.012, meridians: 8});
    var ring = [];
    for (var k = 0; k <= 48; k++) {
      var a = 2 * Math.PI * k / 48;
      ring.push(project(at(Math.cos(a), Math.sin(a)), basis));
    }
    ctx.beginPath();
    ring.forEach(function (q, i) { if (i) { ctx.lineTo(q.x, q.y); } else { ctx.moveTo(q.x, q.y); } });
    ctx.fillStyle = 'rgba(73,245,218,0.22)'; ctx.fill();
    ctx.lineWidth = 0.02; ctx.strokeStyle = '#49f5da'; ctx.stroke();
    var tail = project({x: c.x - 0.7 * d.x, y: c.y - 0.7 * d.y, z: c.z - 0.7 * d.z}, basis);
    var head = project({x: c.x + 0.7 * d.x, y: c.y + 0.7 * d.y, z: c.z + 0.7 * d.z}, basis);
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y);
    ctx.lineWidth = 0.035; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.stroke();
    var ang = Math.atan2(head.y - tail.y, head.x - tail.x);
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(head.x - 0.18 * Math.cos(ang - 0.45), head.y - 0.18 * Math.sin(ang - 0.45));
    ctx.lineTo(head.x - 0.18 * Math.cos(ang + 0.45), head.y - 0.18 * Math.sin(ang + 0.45));
    ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }

  function cross(a, b) {
    return {x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x};
  }
  function norm(a) {
    var l = Math.hypot(a.x, a.y, a.z);
    return {x: a.x / l, y: a.y / l, z: a.z / l};
  }

  // --------------------------------------------------------------------------
  //  5 · Harmony: a hue wheel with a triad and a complementary pair on it
  // --------------------------------------------------------------------------
  function paintHarmony(g) {
    var ctx = g.ctx;
    var R = g.h * 0.42, cx = g.w / 2, cy = g.h / 2, r0 = 0.62;
    // The wheel: a ring of full hues around a disc that fades to gray.
    pixels(g, cx - R, cy - R, 2 * R, 2 * R, function (u, v) {
      var r = Math.hypot(u, v);
      if (r > 1) { return null; }
      var H = Math.atan2(v, u) / (2 * Math.PI);
      var c = hsl2rgbF({H: H - Math.floor(H), S: r < r0 ? r / r0 : 1, L: 0.5});
      var k = r < r0 ? 0.45 : 1;
      return rgbClip({R: k * c.R + (1 - k) * 91, G: k * c.G + (1 - k) * 91, B: k * c.B + (1 - k) * 91});
    });
    function at(t, rr) {
      var a = 2 * Math.PI * t;
      return {x: cx + rr * R * Math.cos(a), y: cy - rr * R * Math.sin(a)};
    }
    function poly(ts, rr, dash, width) {
      ctx.beginPath();
      ts.forEach(function (t, i) { var p = at(t, rr); if (i) { ctx.lineTo(p.x, p.y); } else { ctx.moveTo(p.x, p.y); } });
      if (ts.length > 2) { ctx.closePath(); }
      ctx.setLineDash(dash); ctx.lineWidth = width; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.setLineDash([]);
    }
    var base = 0.04, triad = [base, base + 1 / 3, base + 2 / 3], comp = [base + 0.5 + 0.08, base + 0.5 - 0.08];
    poly([comp[0], base, comp[1]], 0.81, [5, 5], 1.5);   // split complementary
    poly(triad, 0.81, [], 2.5);                          // triad
    triad.concat(comp).forEach(function (t, i) {
      var p = at(t, 0.81), c = hsl2rgbF({H: t - Math.floor(t), S: 1, L: 0.5});
      ctx.beginPath(); ctx.arc(p.x, p.y, i < 3 ? 9 : 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgb(' + rgbClip(c).R + ',' + rgbClip(c).G + ',' + rgbClip(c).B + ')';
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    });
  }

  // --------------------------------------------------------------------------

  var PAINTERS = {
    curves: paintCurves, theory: paintTheory, sampling: paintSampling,
    analysis: paintAnalysis, trajectories: paintTrajectories, harmony: paintHarmony
  };

  function paintAll() {
    document.querySelectorAll('canvas[data-paint]').forEach(function (canvas) {
      var g = setup(canvas);
      var f = PAINTERS[canvas.dataset.paint];
      if (g && f) {
        try { f(g); } catch (e) { console.error('card', canvas.dataset.paint, e); }
      }
    });
  }

  var pending = 0;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(paintAll);
  });
  paintAll();
})();
