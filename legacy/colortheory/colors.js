// J. Ezequiel Soto S.
//
// References:
// http://www.easyrgb.com/en/math.php
// https://en.wikipedia.org/wiki/CIELAB_color_space

var tristimulus ={
  A: {X:111.144,Y:100,Z:35.2},
  B: {X:99.178,Y:100,Z:84.3493},
  C: {X:97.285,Y:100,Z:116.145},
  D50: {X:96.72,Y:100,Z:81.427},
  D55: {X:95.799,Y:100,Z:90.926},
  D65: {X:94.811,Y:100,Z:107.304},
  D75: {X:94.416,Y:100,Z:120.641},
  E: {X:100,Y:100,Z:100},
  F1: {X:94.791,Y:100,Z:103.191},
  F2: {X:103.28,Y:100,Z:69.026},
  F3: {X:108.968,Y:100,Z:51.965},
  F4: {X:114.961,Y:100,Z:40.963},
  F5: {X:93.369,Y:100,Z:98.636},
  F6: {X:102.148,Y:100,Z:62.074},
  F7: {X:95.792,Y:100,Z:107.687},
  F8: {X:97.115,Y:100,Z:81.135},
  F9: {X:102.116,Y:100,Z:67.826},
  F10: {X:99.001,Y:100,Z:83.134},
  F11: {X:103.866,Y:100,Z:65.627},
  F12: {X:111.428,Y:100,Z:40.353}
};

function clip(num,ini,end) {
  if (num < ini) {
    return ini;
  } else if (num > end) {
    return end;
  } else {
    return num;
  }
}

function w2dig(t){
  return (+Math.floor(t)).toString(16).padStart(2,'0').toUpperCase();
}

function rgb(r,g,b){
  return "#"+w2dig(r)+w2dig(g)+w2dig(b);
}

function gam(u) {
  if ( u > 0.0031308 ) {
    return ( 211*Math.pow(u,5/12) - 11 )/200;
  } else {
    return 323*u / 25;
  }
}

function gaminv(u) {
  if ( u > 0.04045 ) {
    return Math.pow( ( 200*u + 11 ) / 211, 12/5);
  } else {
    return 25*u / 323;
  }
}

function xyz2rgb(xyz){
  var var_R = ( 3.24096994 * xyz.X - 1.53738318 * xyz.Y - 0.49861076 * xyz.Z ) /100;
  var var_G = (-0.96924364 * xyz.X + 1.8759675  * xyz.Y + 0.04155506 * xyz.Z ) /100;
  var var_B = ( 0.05563008 * xyz.X - 0.20397696 * xyz.Y + 1.05697151 * xyz.Z ) /100;

  var R = clip(Math.floor(255*gam(var_R)),0,255);
  var G = clip(Math.floor(255*gam(var_G)),0,255);
  var B = clip(Math.floor(255*gam(var_B)),0,255);

  return {R,G,B};
}

function rgb2xyz(r,g,b){
  var var_R = 100*gaminv( r / 255 );
  var var_G = 100*gaminv( g / 255 );
  var var_B = 100*gaminv( b / 255 );

  var X = var_R * 0.41239080 + var_G * 0.35758434 + var_B * 0.18048079;
  var Y = var_R * 0.21263901 + var_G * 0.71516868 + var_B * 0.07219232;
  var Z = var_R * 0.01933082 + var_G * 0.11919478 + var_B * 0.95053215;

  return {X, Y, Z};
}

function cief(t){
  var delta = 6/29;
  if ( t > Math.pow(delta,3) ) {
    return Math.pow(t, 1/3 );
  } else {
    return (t/(3*Math.pow(delta,2)) + 4/29);
  }
}

function ciefinv(t){
  var delta = 6/29;
  if ( t > delta ) {
    return Math.pow(t, 3 );
  } else {
    return 3*Math.pow(delta,2)*(t - 4/29);
  }
}

function xyz2cielab(xyz,ref){
  var var_X = cief(xyz.X / ref.X);
  var var_Y = cief(xyz.Y / ref.Y);
  var var_Z = cief(xyz.Z / ref.Z);

  var L = ( 116 * var_Y ) - 16;
  var a = 500 * ( var_X - var_Y );
  var b = 200 * ( var_Y - var_Z );

  return {L,a,b};
}

function cielab2xyz(lab,ref){
  var aux = (lab.L + 16) / 116;
  var X = ref.X * ciefinv( aux + lab.a/500 );
  var Y = ref.Y * ciefinv( aux );
  var Z = ref.Z * ciefinv( aux - lab.b/200 );

  return {X,Y,Z};
}

function cielab2cielch(lab){
  var H = Math.atan2( lab.b, lab.a );
  if ( H > 0 ) {
    H = ( H / Math.PI ) * 180;
  } else {
    H = 360 - ( Math.abs( H ) / Math.PI ) * 180;
  }
  var L = lab.L;
  var C = Math.sqrt(Math.pow(lab.a,2) + Math.pow(lab.b,2));

  return {L,C,H};
}

function cielch2cielab(lch) {
  var L = lch.L;
  var a = Math.cos( ( Math.PI*lch.H /180 ) ) * lch.C;
  var b = Math.sin( ( Math.PI*lch.H /180 ) ) * lch.C;

  return {L,a,b};
}

function cielab2rgb(lab,ref) {
  var xyz = cielab2xyz(lab,ref);
  xyz.X = clip(xyz.X,0,100);
  xyz.Y = clip(xyz.Y,0,100);
  xyz.Z = clip(xyz.Z,0,100);
  var rgb = xyz2rgb(xyz);
  return rgb;
}

function rgb2cielab(r,g,b,ref) {
  var xyz = rgb2xyz(r,g,b);
  var lab = xyz2cielab(xyz,ref)
  return lab;
}

function rgb2hsl(R,G,B){
  //H, S and L output range = 0 ÷ 1.0
  //R, G and B input range = 0 ÷ 255

  var var_R = ( R / 255 );
  var var_G = ( G / 255 );
  var var_B = ( B / 255 );

  var var_Min = Math.min( var_R, var_G, var_B );    //Min. value of RGB
  var var_Max = Math.max( var_R, var_G, var_B );    //Max. value of RGB
  var del_Max = var_Max - var_Min;             //Delta RGB value

  var L = ( var_Max + var_Min )/ 2;
  var H, S;

  if ( del_Max == 0 ) {                    //This is a gray, no chroma...
      H = 0;
      S = 0;
  } else {                                    //Chromatic data...
     if ( L < 0.5 ) {
       S = del_Max / ( var_Max + var_Min );
     } else {
       S = del_Max / ( 2 - var_Max - var_Min );
     }

     var del_R = ( ( ( var_Max - var_R ) / 6 ) + ( del_Max / 2 ) ) / del_Max;
     var del_G = ( ( ( var_Max - var_G ) / 6 ) + ( del_Max / 2 ) ) / del_Max;
     var del_B = ( ( ( var_Max - var_B ) / 6 ) + ( del_Max / 2 ) ) / del_Max;

     if ( var_R == var_Max ) {
       H = del_B - del_G;
     } else if ( var_G == var_Max ) {
       H = ( 1 / 3 ) + del_R - del_B;
     } else if ( var_B == var_Max ) {
       H = ( 2 / 3 ) + del_G - del_R;
     }
      if ( H < 0 ) {H += 1;}
      if ( H > 1 ) {H -= 1;}
  }
  return {H,S,L};
}

function Hue_2_RGB( v1, v2, vH ) {
   if ( vH < 0 ) {vH += 1;}
   if( vH > 1 ) {vH -= 1;}
   if ( ( 6 * vH ) < 1 ) { return ( v1 + ( v2 - v1 ) * 6 * vH ); }
   if ( ( 2 * vH ) < 1 ) { return ( v2 ); }
   if ( ( 3 * vH ) < 2 ) { return ( v1 + ( v2 - v1 ) * ( ( 2 / 3 ) - vH ) * 6 ); }
   return ( v1 );
}

function hsl2rgb(hsl){
  //H, S and L input range = 0 - 1.0
  //R, G and B output range = 0 - 255
  var R, G, B, var_1, var_2;
  var H = hsl.H;
  var S = hsl.S;
  var L = hsl.L;

  if ( S == 0 ) {
     R = L * 255
     G = L * 255
     B = L * 255
  } else {
     if ( L < 0.5 ) { var_2 = L * ( 1 + S ); }
     else { var_2 = ( L + S ) - ( S * L ); }

     var_1 = 2 * L - var_2;

     R = 255 * Hue_2_RGB( var_1, var_2, H + ( 1 / 3 ) );
     G = 255 * Hue_2_RGB( var_1, var_2, H );
     B = 255 * Hue_2_RGB( var_1, var_2, H - ( 1 / 3 ) );
  }

  R = clip(Math.floor(R),0,255);
  G = clip(Math.floor(G),0,255);
  B = clip(Math.floor(B),0,255);

  return {R,G,B};
}


function CieLab2Hue( var_a, var_b )          //Function returns CIE-H° value
{
   var var_bias = 0
   if ( var_a >= 0 && var_b == 0 ) return 0
   if ( var_a <  0 && var_b == 0 ) return 180
   if ( var_a == 0 && var_b >  0 ) return 90
   if ( var_a == 0 && var_b <  0 ) return 270
   if ( var_a >  0 && var_b >  0 ) var_bias = 0
   if ( var_a <  0               ) var_bias = 180
   if ( var_a >  0 && var_b <  0 ) var_bias = 360
   return ( rad2deg( atan( var_b / var_a ) ) + var_bias )
}

function deg2rad(a){
  return a*Math.PI / 180;
}

function dtor(a){
  var b = deg2rad(a) % 360;
  if (Math.abs(b) <= 180) {
    return b;
  } else {
    return b-360;
  }
}

function DeltaE2000(cielab1,cielab2){
  var whtL, whtC, whtH                //Wheight factors

  var xC1 = Math.sqrt( cielab1.a * cielab1.a + cielab1.b * cielab1.b );
  var xC2 = Math.sqrt( cielab2.a * cielab2.a + cielab2.b * cielab2.b );
  var xCX = ( xC1 + xC2 ) / 2;
  var xGX = 0.5 * ( 1 - Math.sqrt( ( xCX ^ 7 ) / ( ( xCX ^ 7 ) + ( 25 ^ 7 ) ) ) );
  var xNN = ( 1 + xGX ) * cielab1.a;
  var xC1 = Math.sqrt( xNN * xNN + cielab1.b * cielab1.b );
  var xH1 = CieLab2Hue( xNN, cielab1.b );
  var xNN = ( 1 + xGX ) * cielab2.a;
  var xC2 = Math.sqrt( xNN * xNN + cielab2.b * cielab2.b );
  var xH2 = CieLab2Hue( xNN, cielab2.b );
  var xDL = cielab2.L - cielab1.L;
  var xDC = xC2 - xC1;
  var xDH = 0;
  if ( ( xC1 * xC2 ) == 0 ) {
     xDH = 0;
  } else {
     // xNN = Math.round( xH2 - xH1, 12 );
     xNN = Math.round( (xH2 - xH1) * 1e12 )/1e12;
     if ( Math.abs( xNN ) <= 180 ) {
        xDH = xH2 - xH1;
     } else {
        if ( xNN > 180 ) {
          xDH = xH2 - xH1 - 360;
        } else{
          xDH = xH2 - xH1 + 360;
        }
     }
  }

  xDH = 2 * Math.sqrt( xC1 * xC2 ) * Math.sin( dtor( xDH / 2 ) );
  var xLX = ( cielab1.L + cielab2.L ) / 2;
  var xCY = ( xC1 + xC2 ) / 2;
  var xHX;
  if ( ( xC1 *  xC2 ) == 0 ) {
     xHX = xH1 + xH2;
  } else {
     xNN = Math.abs( Math.round( (xH1 - xH2) * 1e12 ) / 1e12 );
     if ( xNN >  180 ) {
        if ( ( xH2 + xH1 ) <  360 ) xHX = xH1 + xH2 + 360
        else                        xHX = xH1 + xH2 - 360
     }
     else {
        xHX = xH1 + xH2;
     }
     xHX = xHX / 2;
  }
  var xTX = 1 - 0.17 * Math.cos( dtor( xHX - 30 ) ) + 0.24
                 * Math.cos( deg2rad( 2 * xHX ) ) + 0.32
                 * Math.cos( deg2rad( 3 * xHX + 6 ) ) - 0.20
                 * Math.cos( dtor( 4 * xHX - 63 ) );
  var xPH = 30 * Math.exp( - ( ( xHX  - 275 ) / 25 ) * ( ( xHX  - 275 ) / 25 ) );
  var xRC = 2 * Math.sqrt( ( Math.pow(xCY,7) ) / ( ( Math.pow(xCY,7) ) + ( Math.pow(25,7) ) ) );
  var xSL = 1 + ( ( 0.015 * ( ( xLX - 50 ) * ( xLX - 50 ) ) )
           / Math.sqrt( 20 + ( ( xLX - 50 ) * ( xLX - 50 ) ) ) );

  var xSC = 1 + 0.045 * xCY;
  var xSH = 1 + 0.015 * xCY * xTX;
  var xRT = - Math.sin( deg2rad( 2 * xPH ) ) * xRC;
  var xDL = xDL / ( whtL * xSL );
  var xDC = xDC / ( whtC * xSC );
  var xDH = xDH / ( whtH * xSH );

  // DeltaE00:
  return Math.sqrt( Math.pow(xDL,2) + Math.pow(xDC,2) + Math.pow(xDH,2) + xRT * xDC * xDH );
}
