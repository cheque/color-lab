
// Hyper-parameters:
var N = 0.5;
var t0 = 0;
var A = 1;
var B = 1;
var C = 1;
var Cmax = 10;
var Nsample = 7;

var ta = -1;
var tb = 1;

log = function () { console.log(arguments); };

function linspace(x0=-1,x1=1,Nstep=10){
    var step = (x1-x0)/Nstep;
    var arr = [];
    for (var i=0;i<=Nstep;i++){
        arr[i] = x0 + i*step;
    }
    return arr
}

function curve1(A=1,B=1,C=10,N=2,t0=0){
    return function(t) { return { H: N*(t-t0) - Math.floor(N*(t-t0)),
                                  S: (1-C/Cmax)*Math.sqrt(1-t**2) * Math.sqrt( (A*Math.cos(N*Math.PI*(t-t0)))**2 + (B*Math.sin(N*Math.PI*(t-t0)))**2 ),
                                  L: (t+1)/2} };
}

function curve2(A=1,B=1,C=10,N=2,t0=0){
    return function(t) { return { H: N*(t-t0) - Math.floor(N*(t-t0)),
                                  S: (1-(C/Cmax)*Math.abs( t )) * Math.sqrt( (A*Math.cos(N*Math.PI*(t-t0)))**2 + (B*Math.sin(N*Math.PI*(t-t0)))**2 ),
                                  L: (t+1)/2} };
}

function curve3(A=1,B=1,C=10,N=2,t0=0){
    return function(t) { return { H: N*(t-t0) - Math.floor(N*(t-t0)),
                                  S: Math.exp( -C * t**2) * Math.sqrt( (A*Math.cos(N*Math.PI*(t-t0)))**2 + (B*Math.sin(N*Math.PI*(t-t0)))**2 ),
                                  L: (t+1)/2} };
}

function curve4(A=1,B=1,C=10,N=2,t0=0){
    return function(t) { return { H: N*(t-t0) - Math.floor(N*(t-t0)),
                                  S: Math.exp( -C * Math.abs(t)) * Math.sqrt( (A*Math.cos(N*Math.PI*(t-t0)))**2 + (B*Math.sin(N*Math.PI*(t-t0)))**2 ),
                                  L: (t+1)/2} };
}

// function curve(A=1,B=1,C=10,N=2,t0=0,k=1){
//     switch (k){
//         case 1:
//             return curve1(A,B,C,N,t0);
//         case 2:
//             return curve2(A,B,C,N,t0);
//         case 3:
//             return curve3(A,B,C,N,t0);
//         case 4:
//             return curve4(A,B,C,N,t0);
//     }
// }

var canvasG = document.getElementById("gradient");
var ctxG = canvasG.getContext("2d");
//ctxG.transform(1,0,0,-1,0,400);

canvasG.setAttribute("width", 400);
canvasG.setAttribute("height", 800);

var tlin = linspace(-1,1,800);

ctxG.transform(1,0,0,-1,0,800);

function updateGradient(){
    ctxG.clearRect(0, 0, 400, 800);
    var tloc = linspace(ta,tb,800);

    var k = document.getElementById('theShape').value;
    var P = (k == 1)? tlin.map( curve1(A,B,C,N,t0) ) :
            (k == 2)? tlin.map( curve2(A,B,C,N,t0) ) :
            (k == 3)? tlin.map( curve3(A,B,C,N,t0) ) : tlin.map( curve4(A,B,C,N,t0) );
    var Q = (k == 1)? tloc.map( curve1(A,B,C,N,t0) ) :
            (k == 2)? tloc.map( curve2(A,B,C,N,t0) ) :
            (k == 3)? tloc.map( curve3(A,B,C,N,t0) ) : tloc.map( curve4(A,B,C,N,t0) );

    var Colors = P.map( hsl2rgb );
    var ColorQ = Q.map( hsl2rgb );
    var K = 800;
    for (var k = 0; k<K; k++) {
        var color = Colors[k];
        ctxG.fillStyle = rgb(color.R,color.G,color.B);
        ctxG.beginPath();
        ctxG.rect(0,k,100,k+1);
        ctxG.closePath();
        ctxG.fill();
        var color2 = ColorQ[k];
        ctxG.fillStyle = rgb(color2.R,color2.G,color2.B);
        ctxG.beginPath();
        ctxG.rect(150,k,100,k+1);
        ctxG.closePath();
        ctxG.fill();
        }
    var step = 800/Nsample;
    for (var k=0; k<Nsample; k++){
        var loc = Math.floor( (k+0.5)*step );
        var color3 = ColorQ[loc];
        ctxG.fillStyle = rgb(color3.R,color3.G,color3.B);
        ctxG.beginPath();
        ctxG.rect(300,Math.floor(k*step),100,Math.floor((k+1)*step));
        ctxG.closePath();
        ctxG.fill();
    }
    //ctxG.strokeStyle = "white";
    ctxG.lineWidth = 3;
    ctxG.beginPath();
    ctxG.setLineDash([5, 3]);
    ctxG.moveTo(100, (ta+1)*400);
    ctxG.lineTo(150, 1);
    ctxG.stroke();

    ctxG.beginPath();
    ctxG.setLineDash([5, 3]);
    ctxG.moveTo(100, (tb+1)*400);
    ctxG.lineTo(150, 800);
    ctxG.stroke();

    document.getElementById('theT0').value = t0;
    document.getElementById('theT0slide').value = t0;
    document.getElementById('Ncycle').value = N;
    document.getElementById('NcycleSlide').value = N;
    document.getElementById('scaleA').value = A;
    document.getElementById('scaleAslide').value = A;
    document.getElementById('scaleB').value = B;
    document.getElementById('scaleBslide').value = B;
    document.getElementById('scaleC').value = C;
    document.getElementById('scaleCslide').value = C;
    document.getElementById('ta').value = ta;
    document.getElementById('taSlide').value = ta;
    if (ta>=tb){
        ta=tb-0.01;
        updateGradient();
    }
    document.getElementById('tb').value = tb;
    document.getElementById('tbSlide').value = tb;
    document.getElementById('Nsample').value = Nsample;
}

updateGradient()