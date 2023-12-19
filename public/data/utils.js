const checkData = function (data, title) {
    return (data.slice(-1 * title.length) === title);
};

const percentageToHsl = function (percentage) {
    const hue0 = 100;
    const hue1 = 0;
    const hue = (percentage * (hue1 - hue0)) + hue0;
    return 'hsl(' + hue + ', 100%, 50%)';
}

let currentZindex = 10;
let moveDiv = false;

let timing = document.getElementById("timing");
let lapTime = document.getElementById("lapTime");
let track = document.getElementById("track");
let allDiv = [/*track, */lapTime, timing];

function moveTrack(id) {
    let div = document.getElementById(id);
    div.style.top = div.offsetTop + "px";
    div.style.left = div.offsetLeft + "px";
    div.style.position = 'absolute';
    div.style.bottom = "";
    div.style.right = "";
    div.style.cursor = 'move';
    div.style.overflow = 'auto';
    div.style.resize = 'both';
    dragElement(div);
}

function move() {
    if (moveDiv === false) {
        for (let i = 0; i < allDiv.length; i++) {
            // Change position of all div
            allDiv[i].style.top = allDiv[i].offsetTop + "px";
            allDiv[i].style.left = allDiv[i].offsetLeft + "px";
            allDiv[i].style.position = 'absolute';

            // Apply CSS
            allDiv[i].style.animation = 'tilt-shaking 0.5s infinite';
            allDiv[i].style.cursor = 'move';
            allDiv[i].style.resize = 'both';
            allDiv[i].style.overflow = 'auto';

            //Make the DIV element draggagle:
            dragElement(allDiv[i]);
        }
    }
    else {
        for (let i = 0; i < allDiv.length; i++) {
            // Reset CSS
            allDiv[i].style.animation = null;
            allDiv[i].style.cursor = 'default';
            allDiv[i].style.resize = 'none';

            //Make the DIV element NOT draggagle:
            noDragElement(allDiv[i]);
        }
    }

    moveDiv = !moveDiv;
}

function noDragElement(elmnt) {
    elmnt.onmousedown = null;
    elmnt.touchstart  = null;
}

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
    elmnt.touchstart  = dragMouseDown;

    function dragMouseDown(e) {
        // Hack to be sure the resize will be correctly performed
        e.originalTarget.parentNode.style.zIndex = ++currentZindex;

        elmnt.style.zIndex = ++currentZindex;

        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}