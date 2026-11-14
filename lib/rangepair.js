// ============================================================================
//  rangepair.js — a two-thumb slider with a draggable band between them
//
//  There is no native HTML control for a range with two ends, and none for a
//  vertical slider that behaves the same in every browser, so this is both.
//  It is ~150 lines and has no dependencies; the lab uses the horizontal form
//  for lightness and the parametric interval, the widget uses the vertical
//  form for everything.
//
//  Three grab targets, which is what makes it a "triple" slider:
//
//      ●───────────▓▓▓▓▓▓▓▓▓▓▓▓───────────●
//      thumb a         band          thumb b
//
//  Dragging a thumb moves one end. Dragging the BAND slides the whole interval
//  without changing its width — the operation you want constantly (move this
//  window along the curve) and that two separate sliders cannot express at all.
//
//  Options:
//    min, max, step   the scale
//    vertical         thumb a at the bottom, values increasing upwards
//    cross            may the thumbs pass each other? (a descending lightness
//                     ramp is exactly that, so lightness says yes)
//    gap              minimum distance between them when they may not cross
//    onInput(a, b)    called on every movement, with both values
//
//  Requires: nothing.
// ============================================================================

function makeRangePair(opts) {
  var min  = opts.min, max = opts.max, step = opts.step || 0.01;
  var vert = !!opts.vertical;
  var span = max - min;

  var a = opts.a, b = opts.b;

  var root = document.createElement('div');
  root.className = 'rp' + (vert ? ' rp-v' : ' rp-h') + (opts.className ? ' ' + opts.className : '');

  var track = document.createElement('div'); track.className = 'rp-track';
  var band  = document.createElement('div'); band.className  = 'rp-band';
  var thA   = document.createElement('div'); thA.className   = 'rp-thumb rp-a';
  var thB   = document.createElement('div'); thB.className   = 'rp-thumb rp-b';

  // A caller may put anything behind the track — the widget paints the curve's
  // own gradient there, so the interval slider shows what it is selecting.
  var back = document.createElement('div'); back.className = 'rp-back';

  track.appendChild(back);
  track.appendChild(band);
  track.appendChild(thA);
  track.appendChild(thB);
  root.appendChild(track);

  // --- geometry -------------------------------------------------------------

  function quantize(v) {
    var q = min + Math.round((v - min) / step) * step;
    // step is often 0.01 or 0.05; without this the values accumulate binary
    // dust and the readouts show 0.30000000000000004.
    return Number(Math.min(max, Math.max(min, q)).toFixed(6));
  }

  function frac(v) { return span === 0 ? 0 : (v - min) / span; }

  // Where the pointer is along the track, as a fraction. Vertical tracks run
  // bottom-to-top, which is why the y case is inverted.
  function fracAt(ev) {
    var r = track.getBoundingClientRect();
    var f = vert ? (r.bottom - ev.clientY) / r.height
                 : (ev.clientX - r.left) / r.width;
    return Math.min(1, Math.max(0, f));
  }

  function place(el, f) {
    el.style[vert ? 'bottom' : 'left'] = (100 * f) + '%';
  }

  function layout() {
    var fa = frac(a), fb = frac(b);
    var lo = Math.min(fa, fb), hi = Math.max(fa, fb);
    place(thA, fa);
    place(thB, fb);
    band.style[vert ? 'bottom' : 'left']  = (100 * lo) + '%';
    band.style[vert ? 'height' : 'width'] = (100 * (hi - lo)) + '%';
  }

  // --- constraints ----------------------------------------------------------

  // Applied after every move. With `cross` off the two ends keep their order
  // and a minimum gap; the end that did NOT move is the one that gives way.
  function settle(moved) {
    if (opts.cross) { return; }
    var gap = opts.gap || 0;
    if (a > b - gap) {
      if (moved === 'a')      { a = Math.min(a, max - gap); b = Math.min(max, a + gap); }
      else if (moved === 'b') { b = Math.max(b, min + gap); a = Math.max(min, b - gap); }
      else                    { b = Math.min(max, a + gap); }
    }
  }

  function emit() { if (opts.onInput) { opts.onInput(a, b); } }

  // --- dragging -------------------------------------------------------------

  var drag = null;      // 'a' | 'b' | {band: true, ...}

  function start(which) {
    return function (ev) {
      ev.preventDefault();
      var f = fracAt(ev);
      if (which === 'band') {
        drag = {band: true, grab: f, a0: a, b0: b};
      } else {
        drag = which;
        moveTo(f, which);
      }
      root.setPointerCapture ? root.setPointerCapture(ev.pointerId) : null;
    };
  }

  function moveTo(f, which) {
    var v = quantize(min + f * span);
    if (which === 'a') { a = v; } else { b = v; }
    settle(which);
    layout();
    emit();
  }

  // The band keeps its width: both ends move by the same delta, and the delta
  // is clipped so neither end leaves the scale — otherwise the interval would
  // silently shrink when it hit an edge.
  function moveBand(f) {
    var d = (f - drag.grab) * span;
    var lo = Math.min(drag.a0, drag.b0), hi = Math.max(drag.a0, drag.b0);
    d = Math.max(min - lo, Math.min(max - hi, d));
    a = quantize(drag.a0 + d);
    b = quantize(drag.b0 + d);
    layout();
    emit();
  }

  thA.addEventListener('pointerdown', start('a'));
  thB.addEventListener('pointerdown', start('b'));
  band.addEventListener('pointerdown', start('band'));

  // Clicking the bare track jumps the nearer end to the click.
  track.addEventListener('pointerdown', function (ev) {
    if (ev.target !== track && ev.target !== back) { return; }
    ev.preventDefault();
    var f = fracAt(ev);
    var which = Math.abs(f - frac(a)) <= Math.abs(f - frac(b)) ? 'a' : 'b';
    drag = which;
    moveTo(f, which);
  });

  root.addEventListener('pointermove', function (ev) {
    if (!drag) { return; }
    if (drag.band) { moveBand(fracAt(ev)); } else { moveTo(fracAt(ev), drag); }
  });

  function end() { drag = null; }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  // --- keyboard -------------------------------------------------------------

  [thA, thB].forEach(function (el, i) {
    el.tabIndex = 0;
    el.setAttribute('role', 'slider');
    el.addEventListener('keydown', function (ev) {
      var d = {ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1}[ev.key];
      if (!d) { return; }
      ev.preventDefault();
      var which = i === 0 ? 'a' : 'b';
      var v = quantize((which === 'a' ? a : b) + d * step);
      if (which === 'a') { a = v; } else { b = v; }
      settle(which);
      layout();
      emit();
    });
  });

  layout();

  return {
    el: root,
    back: back,                       // for a caller that wants to paint it
    set: function (na, nb) { a = na; b = nb; layout(); },
    get: function () { return [a, b]; }
  };
}

var RangePair = { makeRangePair };
if (typeof module !== 'undefined' && module.exports) { module.exports = RangePair; }
