// ============================================================================
//  color.js — colour-space conversions and perceptual difference metrics
//  J. Ezequiel Soto S.
//
//  References:
//    http://www.easyrgb.com/en/math.php
//    https://en.wikipedia.org/wiki/CIELAB_color_space
//    https://en.wikipedia.org/wiki/Color_difference#CIEDE2000
//
//  Conventions used throughout the project:
//    rgb  : {R,G,B}  integers 0..255
//    xyz  : {X,Y,Z}  0..100 (relative to a tristimulus reference white)
//    lab  : {L,a,b}  L 0..100, a/b roughly -128..127
//    lch  : {L,C,H}  H in DEGREES 0..360
//    hsl  : {H,S,L}  all in 0..1  (H is a *turn*, not degrees)
//
//  This file defines plain top-level functions (classic <script>, no build
//  step) and also collects them under the `ColorMath` namespace so that the
//  rest of the project can depend on an explicit object instead of globals.
//  See WIDGET_PLAN.md for the migration to ES modules.
// ============================================================================

// --- Standard illuminants (10deg observer, CIE 1964) ------------------------
var tristimulus = {
  A:   {X:111.144, Y:100, Z: 35.200},
  B:   {X: 99.178, Y:100, Z: 84.3493},
  C:   {X: 97.285, Y:100, Z:116.145},
  D50: {X: 96.720, Y:100, Z: 81.427},
  D55: {X: 95.799, Y:100, Z: 90.926},
  D65: {X: 94.811, Y:100, Z:107.304},
  D75: {X: 94.416, Y:100, Z:120.641},
  E:   {X:100,     Y:100, Z:100},
  F1:  {X: 94.791, Y:100, Z:103.191},
  F2:  {X:103.280, Y:100, Z: 69.026},
  F3:  {X:108.968, Y:100, Z: 51.965},
  F4:  {X:114.961, Y:100, Z: 40.963},
  F5:  {X: 93.369, Y:100, Z: 98.636},
  F6:  {X:102.148, Y:100, Z: 62.074},
  F7:  {X: 95.792, Y:100, Z:107.687},
  F8:  {X: 97.115, Y:100, Z: 81.135},
  F9:  {X:102.116, Y:100, Z: 67.826},
  F10: {X: 99.001, Y:100, Z: 83.134},
  F11: {X:103.866, Y:100, Z: 65.627},
  F12: {X:111.428, Y:100, Z: 40.353}
};

// Default white point for every conversion that does not receive one.
var D65 = tristimulus.D65;

// --- Small numeric helpers --------------------------------------------------

function clip(num, ini, end) {
  if (!isFinite(num)) { return ini; }          // guard against NaN propagating into hex output
  if (num < ini) { return ini; }
  if (num > end) { return end; }
  return num;
}

function deg2rad(a) { return a * Math.PI / 180; }
function rad2deg(a) { return a * 180 / Math.PI; }

// Wrap an angle given in degrees to (-180, 180] and return it in radians.
// Used by CIEDE2000, where hue differences must take the short way around.
function dtor(a) {
  var b = a % 360;
  if (b > 180)  { b -= 360; }
  if (b <= -180) { b += 360; }
  return deg2rad(b);
}

// --- Hex output -------------------------------------------------------------

function w2dig(t) {
  return clip(Math.round(t), 0, 255).toString(16).padStart(2, '0').toUpperCase();
}

// Returns a "#RRGGBB" string. Kept under this name for backwards compatibility;
// `toHex` is the preferred spelling for new code.
function rgb(r, g, b) {
  return "#" + w2dig(r) + w2dig(g) + w2dig(b);
}

function toHex(c) { return rgb(c.R, c.G, c.B); }

// Parse "#RGB" / "#RRGGBB" into {R,G,B}. Returns null when unparsable.
function hex2rgb(str) {
  var s = String(str).trim().replace(/^#/, '');
  if (s.length === 3) { s = s[0]+s[0]+s[1]+s[1]+s[2]+s[2]; }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) { return null; }
  return {
    R: parseInt(s.slice(0, 2), 16),
    G: parseInt(s.slice(2, 4), 16),
    B: parseInt(s.slice(4, 6), 16)
  };
}

// --- sRGB transfer function (gamma) ----------------------------------------
// 211/200 = 1.055, 11/200 = 0.055, 5/12 = 1/2.4, 323/25 = 12.92.

function gam(u) {
  if (u > 0.0031308) { return (211 * Math.pow(u, 5 / 12) - 11) / 200; }
  return 323 * u / 25;
}

function gaminv(u) {
  if (u > 0.04045) { return Math.pow((200 * u + 11) / 211, 12 / 5); }
  return 25 * u / 323;
}

// --- XYZ <-> sRGB -----------------------------------------------------------

function xyz2rgb(xyz) {
  var var_R = ( 3.24096994 * xyz.X - 1.53738318 * xyz.Y - 0.49861076 * xyz.Z) / 100;
  var var_G = (-0.96924364 * xyz.X + 1.87596750 * xyz.Y + 0.04155506 * xyz.Z) / 100;
  var var_B = ( 0.05563008 * xyz.X - 0.20397696 * xyz.Y + 1.05697151 * xyz.Z) / 100;

  // NOTE: round (not floor) — flooring biased every channel ~0.5/255 dark.
  var R = clip(Math.round(255 * gam(var_R)), 0, 255);
  var G = clip(Math.round(255 * gam(var_G)), 0, 255);
  var B = clip(Math.round(255 * gam(var_B)), 0, 255);

  return {R, G, B};
}

function rgb2xyz(r, g, b) {
  var var_R = 100 * gaminv(r / 255);
  var var_G = 100 * gaminv(g / 255);
  var var_B = 100 * gaminv(b / 255);

  var X = var_R * 0.41239080 + var_G * 0.35758434 + var_B * 0.18048079;
  var Y = var_R * 0.21263901 + var_G * 0.71516868 + var_B * 0.07219232;
  var Z = var_R * 0.01933082 + var_G * 0.11919478 + var_B * 0.95053215;

  return {X, Y, Z};
}

// --- XYZ <-> CIE L*a*b* -----------------------------------------------------

function cief(t) {
  var delta = 6 / 29;
  if (t > Math.pow(delta, 3)) { return Math.pow(t, 1 / 3); }
  return t / (3 * Math.pow(delta, 2)) + 4 / 29;
}

function ciefinv(t) {
  var delta = 6 / 29;
  if (t > delta) { return Math.pow(t, 3); }
  return 3 * Math.pow(delta, 2) * (t - 4 / 29);
}

function xyz2cielab(xyz, ref) {
  ref = ref || D65;
  var var_X = cief(xyz.X / ref.X);
  var var_Y = cief(xyz.Y / ref.Y);
  var var_Z = cief(xyz.Z / ref.Z);

  var L = 116 * var_Y - 16;
  var a = 500 * (var_X - var_Y);
  var b = 200 * (var_Y - var_Z);

  return {L, a, b};
}

function cielab2xyz(lab, ref) {
  ref = ref || D65;
  var aux = (lab.L + 16) / 116;
  var X = ref.X * ciefinv(aux + lab.a / 500);
  var Y = ref.Y * ciefinv(aux);
  var Z = ref.Z * ciefinv(aux - lab.b / 200);

  return {X, Y, Z};
}

// --- CIE L*a*b* <-> CIE L*C*h -----------------------------------------------

function cielab2cielch(lab) {
  var H = rad2deg(Math.atan2(lab.b, lab.a));
  if (H < 0) { H += 360; }
  return {L: lab.L, C: Math.hypot(lab.a, lab.b), H: H};
}

function cielch2cielab(lch) {
  return {
    L: lch.L,
    a: Math.cos(deg2rad(lch.H)) * lch.C,
    b: Math.sin(deg2rad(lch.H)) * lch.C
  };
}

// --- Composite conversions --------------------------------------------------
// NOTE: cielab2rgb clips in XYZ, which is a crude gamut mapping (it can shift
// hue). See REVIEW.md — a proper chroma-reducing gamut map is listed as future
// work; the clip is kept here so the CIELAB explorer keeps its current look.

function cielab2rgb(lab, ref) {
  var xyz = cielab2xyz(lab, ref);
  xyz.X = clip(xyz.X, 0, 100);
  xyz.Y = clip(xyz.Y, 0, 100);
  xyz.Z = clip(xyz.Z, 0, 100);
  return xyz2rgb(xyz);
}

function rgb2cielab(r, g, b, ref) {
  return xyz2cielab(rgb2xyz(r, g, b), ref);
}

// --- Unclipped conversions and the sRGB gamut -------------------------------
// The same matrices as xyz2rgb, but nothing is clipped or rounded: a colour
// outside the sRGB gamut comes back with a channel below 0 or above 255. That
// makes the gamut test exact (the old explorer approximated it by a round trip
// through the clipped conversion and a distance threshold of 1.2).

function xyz2rgbF(xyz) {
  var r = ( 3.24096994 * xyz.X - 1.53738318 * xyz.Y - 0.49861076 * xyz.Z) / 100;
  var g = (-0.96924364 * xyz.X + 1.87596750 * xyz.Y + 0.04155506 * xyz.Z) / 100;
  var b = ( 0.05563008 * xyz.X - 0.20397696 * xyz.Y + 1.05697151 * xyz.Z) / 100;
  // The transfer function is odd-extended so negative channels stay negative.
  function g1(u) { return u < 0 ? -gam(-u) : gam(u); }
  return {R: 255 * g1(r), G: 255 * g1(g), B: 255 * g1(b)};
}

function cielab2rgbF(lab, ref) { return xyz2rgbF(cielab2xyz(lab, ref)); }

// True when every channel is a displayable value. `tol` is in 8-bit steps.
function inGamut(c, tol) {
  var e = (tol === undefined) ? 0.5 : tol;
  return c.R >= -e && c.R <= 255 + e && c.G >= -e && c.G <= 255 + e &&
         c.B >= -e && c.B <= 255 + e;
}

// Round and clip an unclipped colour for display.
function rgbClip(c) {
  return {R: clip(Math.round(c.R), 0, 255), G: clip(Math.round(c.G), 0, 255),
          B: clip(Math.round(c.B), 0, 255)};
}

// Convenience: {R,G,B} -> {L,a,b}. This is the hot path for the perceptual
// re-parameterization, so it avoids building intermediate argument lists.
function rgbObj2cielab(c, ref) {
  return xyz2cielab(rgb2xyz(c.R, c.G, c.B), ref);
}

// --- HSL <-> sRGB -----------------------------------------------------------

function rgb2hsl(R, G, B) {
  // H, S, L output range 0..1 ; R, G, B input range 0..255
  var var_R = R / 255, var_G = G / 255, var_B = B / 255;

  var var_Min = Math.min(var_R, var_G, var_B);
  var var_Max = Math.max(var_R, var_G, var_B);
  var del_Max = var_Max - var_Min;

  var L = (var_Max + var_Min) / 2;
  var H = 0, S = 0;

  if (del_Max !== 0) {
    S = (L < 0.5) ? del_Max / (var_Max + var_Min)
                  : del_Max / (2 - var_Max - var_Min);

    var del_R = (((var_Max - var_R) / 6) + (del_Max / 2)) / del_Max;
    var del_G = (((var_Max - var_G) / 6) + (del_Max / 2)) / del_Max;
    var del_B = (((var_Max - var_B) / 6) + (del_Max / 2)) / del_Max;

    if (var_R === var_Max)      { H = del_B - del_G; }
    else if (var_G === var_Max) { H = 1 / 3 + del_R - del_B; }
    else                        { H = 2 / 3 + del_G - del_R; }

    if (H < 0) { H += 1; }
    if (H > 1) { H -= 1; }
  }
  return {H, S, L};
}

function Hue_2_RGB(v1, v2, vH) {
  if (vH < 0) { vH += 1; }
  if (vH > 1) { vH -= 1; }
  if (6 * vH < 1) { return v1 + (v2 - v1) * 6 * vH; }
  if (2 * vH < 1) { return v2; }
  if (3 * vH < 2) { return v1 + (v2 - v1) * (2 / 3 - vH) * 6; }
  return v1;
}

// Unrounded variant of hsl2rgb: channels stay floating point in 0..255.
// The perceptual re-parameterization integrates arc length in L*a*b*, and
// rounding to 8 bits first turns a smooth curve into a staircase, which shows
// up as visible jitter in the sampled palette. Use this for measurement and
// hsl2rgb for display.
function hsl2rgbF(hsl) {
  var H = hsl.H, S = clip(hsl.S, 0, 1), L = clip(hsl.L, 0, 1);
  if (S === 0) { return {R: L * 255, G: L * 255, B: L * 255}; }
  var var_2 = (L < 0.5) ? L * (1 + S) : (L + S) - (S * L);
  var var_1 = 2 * L - var_2;
  return {
    R: 255 * Hue_2_RGB(var_1, var_2, H + 1 / 3),
    G: 255 * Hue_2_RGB(var_1, var_2, H),
    B: 255 * Hue_2_RGB(var_1, var_2, H - 1 / 3)
  };
}

// HSL (0..1) straight to CIE L*a*b*, without the 8-bit round trip.
function hsl2cielab(hsl, ref) {
  var c = hsl2rgbF(hsl);
  return xyz2cielab(rgb2xyz(c.R, c.G, c.B), ref);
}

function hsl2rgb(hsl) {
  // H, S, L input range 0..1 ; R, G, B output range 0..255
  var H = hsl.H, S = clip(hsl.S, 0, 1), L = clip(hsl.L, 0, 1);
  var R, G, B, var_1, var_2;

  if (S === 0) {
    R = G = B = L * 255;
  } else {
    var_2 = (L < 0.5) ? L * (1 + S) : (L + S) - (S * L);
    var_1 = 2 * L - var_2;

    R = 255 * Hue_2_RGB(var_1, var_2, H + 1 / 3);
    G = 255 * Hue_2_RGB(var_1, var_2, H);
    B = 255 * Hue_2_RGB(var_1, var_2, H - 1 / 3);
  }

  return {
    R: clip(Math.round(R), 0, 255),
    G: clip(Math.round(G), 0, 255),
    B: clip(Math.round(B), 0, 255)
  };
}

// ----------------------------------------------------------------------------
//  Perceptual colour difference
// ----------------------------------------------------------------------------

// CIE-h° of a Lab pair, in degrees 0..360.
function CieLab2Hue(var_a, var_b) {
  if (var_a === 0 && var_b === 0) { return 0; }
  var h = rad2deg(Math.atan2(var_b, var_a));
  return (h + 360) % 360;
}

// CIE76: plain Euclidean distance in L*a*b*. Cheap, and good enough to drive
// the arc-length re-parameterization when speed matters.
function deltaE76(lab1, lab2) {
  var dL = lab2.L - lab1.L, da = lab2.a - lab1.a, db = lab2.b - lab1.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// CMC-style intermediate; CIE94 (graphic-arts weights).
function deltaE94(lab1, lab2) {
  var C1 = Math.hypot(lab1.a, lab1.b);
  var C2 = Math.hypot(lab2.a, lab2.b);
  var dL = lab1.L - lab2.L;
  var dC = C1 - C2;
  var da = lab1.a - lab2.a;
  var db = lab1.b - lab2.b;
  var dH2 = da * da + db * db - dC * dC;
  var dH = dH2 > 0 ? Math.sqrt(dH2) : 0;
  var SL = 1, SC = 1 + 0.045 * C1, SH = 1 + 0.015 * C1;
  return Math.sqrt(Math.pow(dL / SL, 2) + Math.pow(dC / SC, 2) + Math.pow(dH / SH, 2));
}

// CIEDE2000.
//
// This replaces the previous easyrgb-derived transcription, which was broken in
// three independent ways and always returned NaN:
//   * `xCX ^ 7` is JavaScript bitwise XOR, not exponentiation;
//   * the weight factors whtL/whtC/whtH were declared but never assigned;
//   * `CieLab2Hue` called `rad2deg`/`atan`, neither of which existed.
//
// kL, kC, kH are the parametric weights (1,1,1 = reference conditions).
function deltaE2000(lab1, lab2, kL, kC, kH) {
  kL = (kL === undefined) ? 1 : kL;
  kC = (kC === undefined) ? 1 : kC;
  kH = (kH === undefined) ? 1 : kH;

  var POW25_7 = Math.pow(25, 7);

  var C1 = Math.hypot(lab1.a, lab1.b);
  var C2 = Math.hypot(lab2.a, lab2.b);
  var Cbar = (C1 + C2) / 2;
  var Cbar7 = Math.pow(Cbar, 7);
  var G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));

  var a1p = (1 + G) * lab1.a;
  var a2p = (1 + G) * lab2.a;
  var C1p = Math.hypot(a1p, lab1.b);
  var C2p = Math.hypot(a2p, lab2.b);
  var h1p = CieLab2Hue(a1p, lab1.b);
  var h2p = CieLab2Hue(a2p, lab2.b);

  var dLp = lab2.L - lab1.L;
  var dCp = C2p - C1p;

  var dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp >  180) { dhp -= 360; }
    if (dhp < -180) { dhp += 360; }
  }
  var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp / 2));

  var Lbp = (lab1.L + lab2.L) / 2;
  var Cbp = (C1p + C2p) / 2;

  var hbp;
  if (C1p * C2p === 0) {
    hbp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbp = (h1p + h2p + 360) / 2;
  } else {
    hbp = (h1p + h2p - 360) / 2;
  }

  var T = 1 - 0.17 * Math.cos(deg2rad(hbp - 30))
            + 0.24 * Math.cos(deg2rad(2 * hbp))
            + 0.32 * Math.cos(deg2rad(3 * hbp + 6))
            - 0.20 * Math.cos(deg2rad(4 * hbp - 63));

  var dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  var Cbp7 = Math.pow(Cbp, 7);
  var RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + POW25_7));

  var SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  var SC = 1 + 0.045 * Cbp;
  var SH = 1 + 0.015 * Cbp * T;
  var RT = -Math.sin(deg2rad(2 * dTheta)) * RC;

  var tL = dLp / (kL * SL);
  var tC = dCp / (kC * SC);
  var tH = dHp / (kH * SH);

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

// Legacy spelling kept so older sketches keep running.
var DeltaE2000 = deltaE2000;

// ----------------------------------------------------------------------------
//  Namespace
// ----------------------------------------------------------------------------

var ColorMath = {
  tristimulus, D65,
  clip, deg2rad, rad2deg, dtor,
  rgb, toHex, hex2rgb, w2dig,
  gam, gaminv,
  xyz2rgb, rgb2xyz,
  cief, ciefinv, xyz2cielab, cielab2xyz,
  cielab2cielch, cielch2cielab,
  cielab2rgb, rgb2cielab, rgbObj2cielab,
  xyz2rgbF, cielab2rgbF, inGamut, rgbClip,
  rgb2hsl, hsl2rgb, hsl2rgbF, hsl2cielab,
  CieLab2Hue, deltaE76, deltaE94, deltaE2000
};

if (typeof module !== 'undefined' && module.exports) { module.exports = ColorMath; }
