// The CIE-L*a*b* color plot:
var canvas1 = document.getElementById("thecanvas");
var ctx = canvas1.getContext("2d");
// The L* bar for CIE-L*a*b*
var canvas2 = document.getElementById("Lbar");
var ctx2 = canvas2.getContext("2d");
// The control of the selected color:
var canvasC = document.getElementById("controlcanvas");
var ctx1 = canvasC.getContext("2d");
// The HSL color disc plot:
var canvas3 = document.getElementById("hslcanvas");
var ctx3 = canvas3.getContext("2d");
// The L bar for HSL:
var canvas4 = document.getElementById("Lhslbar");
var ctx4 = canvas4.getContext("2d");

canvas1.setAttribute("width", 300);
canvas1.setAttribute("height", 300);
canvas2.setAttribute("width", 50);
canvas2.setAttribute("height", 300);
canvasC.setAttribute("width", 300);
canvasC.setAttribute("height", 300);
canvas3.setAttribute("width", 300);
canvas3.setAttribute("height", 300);
canvas4.setAttribute("width", 50);
canvas4.setAttribute("height", 300);

ctx.transform(15/11,0,0,-15/11,150,150);
ctx2.transform(3,0,0,-3,25,300);
ctx1.transform(150,0,0,-150,150,150);
ctx3.transform(150,0,0,-150,150,150);
ctx4.transform(300,0,0,-300,25,300);

var mat = ctx.getTransform().invertSelf();
var mat2 = ctx2.getTransform().invertSelf();
var mat3 = ctx3.getTransform().invertSelf();
var mat4 = ctx4.getTransform().invertSelf();

var sR = 0, sG = 0, sB = 0;
var xyz = rgb2xyz(sR,sG,sB);
var ref = document.getElementById('tri_ref').value;
var xyz_ref = tristimulus[ref];
var cielab = xyz2cielab(xyz,xyz_ref);
var cielch = cielab2cielch(cielab);
var hsl = rgb2hsl(sR,sG,sB);

function update(){
  document.getElementById('sRnum').value=sR;
  document.getElementById('sRslide').value=sR;
  document.getElementById('sGnum').value=sG;
  document.getElementById('sGslide').value=sG;
  document.getElementById('sBnum').value=sB;
  document.getElementById('sBslide').value=sB;
  document.getElementById('HexCode').value=rgb(sR,sG,sB);
  document.getElementById('showcolor').style.background=rgb(sR,sG,sB);
  xyz = rgb2xyz(sR,sG,sB);

  document.getElementById('X').value = xyz.X.toFixed(2);
  document.getElementById('Y').value = xyz.Y.toFixed(2);
  document.getElementById('Z').value = xyz.Z.toFixed(2);

  ref = document.getElementById('tri_ref').value;
  xyz_ref = tristimulus[ref];

  cielab = xyz2cielab(xyz,xyz_ref);
  document.getElementById('cie-L').value = cielab.L.toFixed(2);
  document.getElementById('cie-a').value = cielab.a.toFixed(2);
  document.getElementById('cie-b').value = cielab.b.toFixed(2);

  cielch = cielab2cielch(cielab);
  document.getElementById('lch-L').value = cielch.L.toFixed(2);
  document.getElementById('lch-C').value = cielch.C.toFixed(2);
  document.getElementById('lch-H').value = (cielch.H % 360).toFixed(2);

  hsl = rgb2hsl(sR,sG,sB);
  document.getElementById('hsl-H').value = hsl.H.toFixed(4);
  document.getElementById('hsl-S').value = hsl.S.toFixed(4);
  document.getElementById('hsl-L').value = hsl.L.toFixed(4);

  reDraw_cielab();
  reDraw_hsl();
  reDraw_hsl_pointer();
}

function rev_update(ahsl,end){
  var newRGB = hsl2rgb(ahsl);
  sR = newRGB.R;
  sG = newRGB.G;
  sB = newRGB.B;
  document.getElementById('showcolor').style.background=rgb(newRGB.R,newRGB.G,newRGB.B);

  if (end){
    update();
  }
}

// ----------------------------------------------------------------------------
// ---------------------------- COLOR MAPS ------------------------------------
// ----------------------- Drawing on canvases --------------------------------
// ----------------------------------------------------------------------------

function reDraw_cielab() {
  ctx.clearRect(-150, -150, 300, 300);
  var I = 100, J = I;
  for (var i = 0; i<I ; i++) {
    for (var j = 0; j<J; j++) {
      var Px = 110*(2*(i+0.5)/I-1);
      var Py = 110*(2*(j+0.5)/J-1);
      var plotlab = {"L": cielab.L,"a":Px,"b":Py};
      var color = cielab2rgb(plotlab,xyz_ref);
      var inv = rgb2cielab(color.R,color.G,color.B,xyz_ref);
      if (document.getElementById("gamut").checked) { // Profiling the CIEL*ab solid RGB-gamut
        if (Math.sqrt(Math.pow(inv.a - Px,2) + Math.pow(inv.b - Py,2)) < 1.2){
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = 0;
        }
      }
      ctx.fillStyle = rgb(color.R,color.G,color.B);
      ctx.beginPath();
      ctx.rect(110*(2*i/I-1),110*(2*j/J-1),220/I,220/J);
      // ctx.arc(Px, Py, 3, 0, 2 * Math.PI, false);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  var Px = cielab.a;
  var Py = cielab.b;
  ctx.beginPath();
  ctx.fillStyle = "#FFFFFF";
  ctx.arc(Px, Py, 3, 0, 2 * Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.stroke();

  ctx2.fillStyle = "#FFFFFF";
  ctx2.fillRect(0, 0, 50, 300);

  var K = 150;
  for (var k = 0; k<=K; k++) {
    var theL = 100*(k/K);
    var plotlab = {"L": theL,"a":Px,"b":Py};
    var color = cielab2rgb(plotlab,xyz_ref);
    ctx2.fillStyle = rgb(color.R,color.G,color.B);
    ctx2.beginPath();
    ctx2.rect(-25,theL,50,3);
    ctx2.closePath();
    ctx2.fill();
  }

  ctx2.beginPath();
  ctx2.fillStyle = "#FFFFFF";
  ctx2.arc(0, cielch.L, 1.5, 0, 2 * Math.PI, false);
  ctx2.closePath();
  ctx2.fill();
  ctx2.lineWidth = 0.5;
  ctx2.strokeStyle = "#000000";
  ctx2.stroke();

}

function reDraw_hsl() {
  ctx3.clearRect(-1, -1, 2, 2);
  var I = 25; // Radial mesh
  var J = 120; // Angular mesh
  var drawEPS = 1e-2;
  for (var i = 0; i<I ; i++) {
    for (var j = 0; j<J; j++) {
      var Svar = (i+0.5)/I;
      var Hvar = (j+0.5)/J;
      var plothsl = {"H": Hvar,"S": Svar,"L": hsl.L};
      var color = hsl2rgb(plothsl);
      var a0 = 2*Math.PI*((j)/J)-drawEPS;
      var a1 = 2*Math.PI*(((j+1) % J)/J)+drawEPS;
      ctx3.fillStyle = rgb(color.R,color.G,color.B);
      ctx3.strokeStyle = rgb(color.R,color.G,color.B);
      ctx3.lineWidth = 0.005;
      // ctx3.globalComposite = "destination-atop";
      ctx3.beginPath();
      ctx3.moveTo( (i+1+drawEPS)/I * Math.cos(a1), (i+1+drawEPS)/I * Math.sin(a1) );
      ctx3.arc(0, 0,(i+1+drawEPS)/I, a1, a0, true);
      ctx3.lineTo((i/I)*Math.cos(a0),(i/I)*Math.sin(a0));
      ctx3.arc(0, 0,i/I, a0, a1, false);
      ctx3.closePath();
      ctx3.stroke();
      ctx3.fill();
    }
  }

  var K = 150;
  for (var k = 0; k<K; k++) {
    var theL = (k+0.5)/K;
    var plothsl = {"H": hsl.H,"S": hsl.S,"L": theL};
    var color = hsl2rgb(plothsl);
    ctx4.fillStyle = rgb(color.R,color.G,color.B);
    ctx4.beginPath();
    ctx4.rect(-25,k/K,50,2);
    ctx4.closePath();
    ctx4.fill();
  }

  ctx4.beginPath();
  ctx4.fillStyle = "#FFFFFF";
  ctx4.arc(0, hsl.L, 0.015, 0, 2 * Math.PI, false);
  ctx4.closePath();
  ctx4.fill();
  ctx4.lineWidth = 0.005;
  ctx4.strokeStyle = "#000000";
  ctx4.stroke();
}

function reDraw_hsl_pointer() {
  ctx1.clearRect(-1, -1, 2, 2);
  var Px = hsl.S * Math.cos(2*Math.PI*hsl.H);
  var Py = hsl.S * Math.sin(2*Math.PI*hsl.H);
  ctx1.beginPath();
  ctx1.fillStyle = "#FFFFFF";
  ctx1.arc(Px, Py, 0.03, 0, 2 * Math.PI, false);
  ctx1.closePath();
  ctx1.fill();
  ctx1.strokeStyle = "#000000";
  ctx1.lineWidth = 0.01;
  ctx1.stroke();
}

// ----------------------------------------------------------------------------
// ------------------------- INTERACTION --------------------------------------
// ---------------------- Mouse drag & drop -----------------------------------
// ----------------------------------------------------------------------------

var isMoving = false;
var xoff = 0, yoff = 0;
//var mouse_position = {x: 0, y: 0};

function local_coords(canvas, imatrix, pos){
  var rect = canvas.getBoundingClientRect();
  var posnew = {x: pos.x - rect.left, y: pos.y - rect.top};
  var mouse_x = posnew.x * imatrix.a + posnew.y * imatrix.c + imatrix.e;
  var mouse_y = posnew.x * imatrix.b + posnew.y * imatrix.d + imatrix.f;
  return { x: mouse_x, y: mouse_y};
}

function inCanvas(canvas,pos){
  var rect = canvas.getBoundingClientRect();
  if (pos.x >= rect.left && pos.y>= rect.top
    && pos.x <= rect.right && pos.y <= rect.bottom ) {
    return true;
  }
}

window.addEventListener('mousemove', e => {
  pos = {x: e.clientX, y: e.clientY};
  document.body.style.cursor = 'auto';
  if (inCanvas(canvas3,pos)){
    var local3 = local_coords(canvas3,mat3,pos);
    var ang = 2*Math.PI*hsl.H;
    var EPS = 0.0075;
    if (Math.pow(local3.x - hsl.S*Math.cos(ang),2) + Math.pow(local3.y - hsl.S*Math.sin(ang),2) < EPS) {
      document.body.style.cursor = 'grab';
      if (isMoving == true) {
        document.body.style.cursor = 'grabbing';
        EPS = Math.huge;
        xoff = e.offsetX;
        yoff = e.offsetY;
        var d_x = xoff * mat3.a + yoff * mat3.c + mat3.e;
        var d_y = xoff * mat3.b + yoff * mat3.d + mat3.f;
        hsl.H = Math.atan2(d_y,d_x)/(2*Math.PI);
        hsl.S = Math.sqrt( Math.pow(d_x,2) + Math.pow(d_y,2) );
        local3 = {x: d_x, y: d_y};
        rev_update(hsl,false);
        reDraw_hsl_pointer();
        document.getElementById('hsl-H').value = hsl.H;
        document.getElementById('hsl-S').value = hsl.S;
      }
    } else {
      document.body.style.cursor = 'crosshair';
    }
  }
  // var mouse_x = posnew.x * imatrix.a + posnew.y * imatrix.c + imatrix.e;
  // var mouse_y = posnew.x * imatrix.b + posnew.y * imatrix.d + imatrix.f;
  if (inCanvas(canvas4,pos)){
    var local4 = local_coords(canvas4,mat4,pos);
    var EPS = 0.01;
    if ( Math.pow(local4.y - hsl.L,2) < EPS && Math.abs(local4.x) < 0.05 ) {
      document.body.style.cursor = 'grab';
      // document.body.style.cursor = url(https://ssl.gstatic.com/ui/v1/icons/mail/images/2/openhand.cur);
      if (isMoving == true) {
        document.body.style.cursor = 'grabbing';
        EPS = Math.huge;
        xoff = e.offsetX;
        yoff = e.offsetY;
        var d_x = xoff * mat4.a + yoff * mat4.c + mat4.e;
        var d_y = xoff * mat4.b + yoff * mat4.d + mat4.f;
        hsl.L = d_y;
        local4 = {x: d_x, y: d_y};
        rev_update(hsl,false);
        reDraw_hsl();
        reDraw_hsl_pointer();
        document.getElementById('hsl-L').value = hsl.L;
      }
    } else {
      document.body.style.cursor = 'auto';
    }
  }
  
  });

window.addEventListener('mousedown', e => {
    var pos = {x: e.clientX, y: e.clientY};
    isMoving = true;
    if (inCanvas(canvas3,pos)){
      document.body.style.cursor = 'crosshair';
      var loc = local_coords(canvas3,mat3,pos);
      hsl.H = Math.atan2(loc.y,loc.x)/(2*Math.PI);
      hsl.S = Math.sqrt( Math.pow(loc.x,2) + Math.pow(loc.y,2) );
      rev_update(hsl,false);
      reDraw_hsl_pointer();
      document.getElementById('hsl-H').value = hsl.H;
      document.getElementById('hsl-S').value = hsl.S;
    }
  });

window.addEventListener('mouseup', e => {
    document.body.style.cursor = 'auto';
    isMoving = false;
    xoff = 0;
    yoff = 0;
    // rev_update(hsl,true);
    update();
    reDraw_hsl();
    reDraw_hsl_pointer();
});

window.onload = function() {
  sR = Math.floor(255*Math.random());
  sG = Math.floor(255*Math.random());
  sB = Math.floor(255*Math.random());
  update();
};
