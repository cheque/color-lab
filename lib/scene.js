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

var Scene = {
  TURN, DRAG_PX,
  cameraBasis, orbitCamera, project, projectAll, strokeCurve, drawDot, fitCanvas
};

if (typeof module !== 'undefined' && module.exports) { module.exports = Scene; }
