// ============================================================================
//  scene.js — the 3-D view: camera, projection, drawing
//
//  Both pages plot the same object — a polyline through the HSL cylinder, one
//  colour per segment — from the same kind of camera, so the projection lives
//  here instead of being written twice.
//
//  The camera is an orbit. `th` (azimuth) and `ph` (elevation) are measured in
//  WHOLE TURNS, the same unit as the curve's own Orientation: th = 1 is one
//  full revolution, ph = 0.25 is straight down the axis. The eye sits on the
//  unit sphere and the screen axes are its two tangents there, which
//  makes the projection ORTHOGRAPHIC: no perspective divide, parallel lines
//  stay parallel, and the cylinder keeps its shape from every angle.
//
//  Nothing here touches the DOM beyond the 2-D context it is handed, and
//  nothing here reads the parameter object: callers pass points and colours.
//
//  Requires: nothing.
// ============================================================================

// The three basis vectors for a camera. `right` and `up` are unit vectors and
// mutually orthogonal, so projecting is two dot products with no normalising.
var TURN = 2 * Math.PI;

function cameraBasis(camera) {
  var ct = Math.cos(TURN * camera.th), st = Math.sin(TURN * camera.th);
  var cp = Math.cos(TURN * camera.ph), sp = Math.sin(TURN * camera.ph);
  return {
    eye:   {x:  ct * cp, y:  st * cp, z: sp},
    right: {x: -st,      y:  ct,      z: 0 },
    up:    {x: -ct * sp, y: -st * sp, z: cp}
  };
}

// Orbit the camera by a screen-space drag, at DRAG_PX pixels per turn.
// Elevation is clamped to a quarter turn so the cylinder is never seen from
// below its own base.
var DRAG_PX = 600;

function orbitCamera(camera, dx, dy, speed) {
  var s = speed || DRAG_PX;
  camera.th += dx / s;
  camera.ph = Math.min(0.25, Math.max(0, camera.ph + dy / s));
  return camera;
}

function project(p, basis) {
  var vx = p.x - basis.eye.x, vy = p.y - basis.eye.y, vz = p.z - basis.eye.z;
  return {
    x: vx * basis.right.x + vy * basis.right.y + vz * basis.right.z,
    y: vx * basis.up.x    + vy * basis.up.y    + vz * basis.up.z
  };
}

function projectAll(points, basis) {
  var out = new Array(points.length);
  for (var i = 0; i < points.length; i++) { out[i] = project(points[i], basis); }
  return out;
}

// Stroke an already-projected polyline, one stroke per segment because the
// colour changes along it. `width` is either a number or a function(i) giving
// the width of the segment leaving point i — that is how the current page
// draws the [ta,tb] portion thick and the rest hairline.
function strokeCurve(ctx, screen, colors, width) {
  var w = (typeof width === 'function') ? width : function () { return width; };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (var k = 0; k < screen.length - 1; k++) {
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = w(k);
    ctx.beginPath();
    ctx.moveTo(screen[k].x, screen[k].y);
    ctx.lineTo(screen[k + 1].x, screen[k + 1].y);
    ctx.stroke();
  }
}

// A filled, outlined marker at a point in space.
function drawDot(ctx, p, basis, opts) {
  var q = project(p, basis);
  ctx.beginPath();
  ctx.arc(q.x, q.y, opts.r, 0, 2 * Math.PI);
  ctx.fillStyle = opts.fill;
  ctx.fill();
  if (opts.stroke) {
    ctx.lineWidth = opts.width;
    ctx.strokeStyle = opts.stroke;
    ctx.stroke();
  }
}

// Set up a canvas so that drawing happens in curve coordinates: the origin at
// the centre, y pointing up, and the unit sphere filling `fill` of the frame.
// Every line width below is therefore in curve units, not pixels, and the same
// numbers work at 800 px and at 1600 px.
function fitCanvas(canvas, size, fill) {
  canvas.width = size;
  canvas.height = size;
  var s = (size / 2) * (fill === undefined ? 0.875 : fill);
  var ctx = canvas.getContext('2d');
  ctx.setTransform(s, 0, 0, -s, size / 2, size / 2);
  return ctx;
}

// The HSL cylinder as a wireframe: the two rims (L = 0 at z = -1, L = 1 at
// z = +1), the equator (L = 0.5), `meridians` vertical lines at equal steps of
// hue, and the lightness axis. Orthographic projection has no depth cue, so
// every line on the far side of the cylinder (its outward normal pointing away
// from the eye) is drawn fainter: that is what lets the eye read it as a solid.
// Line widths are in curve units, like everything fitCanvas() sets up.
var CYL_STEPS = 96;

function drawCylinder(ctx, basis, opts) {
  var o = opts || {};
  var front = o.front || 'rgba(255,255,255,0.42)';
  var back  = o.back  || 'rgba(255,255,255,0.14)';
  var width = o.width || 0.0045;
  var meridians = (o.meridians === undefined) ? 12 : o.meridians;
  var r = (o.radius === undefined) ? 1 : o.radius;

  // Seen from the eye, a surface point at angle a faces it when its normal
  // (cos a, sin a, 0) has a positive dot product with the eye direction.
  function facing(a) {
    return Math.cos(a) * basis.eye.x + Math.sin(a) * basis.eye.y > 0;
  }
  function seg(p, q, style) {
    var a = project(p, basis), b = project(q, basis);
    ctx.strokeStyle = style;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  [-1, 0, 1].forEach(function (z) {
    // The equator is a guide, not an edge: fainter than the rims.
    var f  = (z === 0) ? 'rgba(255,255,255,0.22)' : front;
    var bk = (z === 0) ? 'rgba(255,255,255,0.08)' : back;
    for (var i = 0; i < CYL_STEPS; i++) {
      var a0 = TURN * i / CYL_STEPS, a1 = TURN * (i + 1) / CYL_STEPS;
      seg({x: r * Math.cos(a0), y: r * Math.sin(a0), z: z},
          {x: r * Math.cos(a1), y: r * Math.sin(a1), z: z},
          facing((a0 + a1) / 2) ? f : bk);
    }
  });

  for (var m = 0; m < meridians; m++) {
    var a = TURN * m / meridians;
    var c = Math.cos(a), s = Math.sin(a);
    seg({x: r * c, y: r * s, z: -1}, {x: r * c, y: r * s, z: 1}, facing(a) ? front : back);
  }

  // The lightness axis, dashed: it runs inside the solid, not on its surface.
  if (ctx.setLineDash) { ctx.setLineDash([0.03, 0.03]); }
  seg({x: 0, y: 0, z: -1}, {x: 0, y: 0, z: 1}, back);
  if (ctx.setLineDash) { ctx.setLineDash([]); }

  ctx.restore();
}

var Scene = {
  TURN, DRAG_PX,
  cameraBasis, orbitCamera, project, projectAll, strokeCurve, drawDot, fitCanvas,
  drawCylinder
};

if (typeof module !== 'undefined' && module.exports) { module.exports = Scene; }
