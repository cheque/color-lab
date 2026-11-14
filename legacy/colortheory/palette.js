function clearPalette(){
  console.log("Coming soon...");
}

function savePalette(){
  console.log("Coming soon...");
}


// ----------------------------------------------------------------------------
// ---------------------------- PALETTES --------------------------------------
// -------------------------- Drag & Drop -------------------------------------
// ----------------------------------------------------------------------------

var dragSrcEl = null;

function handleDragStart(e) {
  this.style.opacity = '0.4';

  dragSrcEl = this;

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }

  e.dataTransfer.dropEffect = 'move';

  return false;
}

function handleDragEnter(e) {
  this.classList.add('over');
}

function handleDragLeave(e) {
  this.classList.remove('over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation(); // stops the browser from redirecting.
  }
  // if (dragSrcEl != this) {
  //   dragSrcEl.innerHTML = this.innerHTML;
  //   this.innerHTML = e.dataTransfer.getData('text/html');
  // }
  //console.log(this);
  if (this == null){
    document.getElementById("thepalette").append(dragSrcEl);
  } else {
    document.getElementById("thepalette").insertBefore(dragSrcEl,this);
  }

  return false;
}

function handleDragEnd(e) {
  this.style.opacity = '1';

  let items = document.querySelectorAll('.container .box');
  items.forEach(function (item) {
    item.classList.remove('over');
  });
  isMoving = false;
}

function insertColor(){
  var theColor = rgb(sR,sG,sB);
  var node = document.createElement('div');
  node.draggable = 'true';
  node.className = 'box';
  // node.style.cssTex = "draggable='true' class='box'";
  node.innerHTML = "" //"<div draggable='true' class='box'>"
              + "<div id='colorsample' style='background-color: "+ theColor
              + ";'></div>"
              + "<div id='colortag'>" + theColor + "</div>";
              // + "</div>";

    node.addEventListener('dragstart', handleDragStart, false);
    node.addEventListener('dragenter', handleDragEnter, false);
    node.addEventListener('dragover', handleDragOver, false);
    node.addEventListener('dragleave', handleDragLeave, false);
    node.addEventListener('drop', handleDrop, false);
    node.addEventListener('dragend', handleDragEnd, false);

  document.getElementById("thepalette").appendChild(node);
}

// ----------------------------------------------------------------------------
// ---------------------------- PALETTES --------------------------------------
// --------------------- Methods and generation -------------------------------
// ----------------------------------------------------------------------------

function polygon(N){
  // var Palette = [];
  var R = 50;
  for(var i=0; i<N; i++){
    var ares = R*Math.cos(2*Math.PI*(i/N));
    var bres = R*Math.sin(2*Math.PI*(i/N));
    var labres = {"L": cielch.L,"a":ares,"b":bres};
    // Palette.push(cielab2rgb(labres,xyz_ref));
  }
  // return Palette;
}

function palette(){
  
}
