PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH

// Split double into two singles
let split = (a) => {
    let b = a + a * 1e-7 * Math.random() // improve stability
    let hi = Math.fround(b);
    let lo = a - hi;
    
    return [hi, lo];
}

// State
const resolution = {
    width: document.getElementById("app").offsetWidth + 1,
    height: document.getElementById("app").offsetHeight + 1
}

const state = {
    center : [-0.5, 0.0],
    scale  : 2.4 / Math.min(resolution.height, resolution.width)
}
    
const uniforms = {
    center     : [...split(state.center[0]), ...split(state.center[1])],
    offset     : [resolution.width / 2.0, resolution.height / 2.0],
    scale      : split(state.scale),
    zero       : [0.00000000000001, 0.00000000000001],
    iterations : 256.0,
};

// App
const app = new PIXI.Application(resolution);
const hammer = new Hammer(app.view);
hammer.add( new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }) );
hammer.add( new Hammer.Pinch({ threshold: 0 }) );

// Check Available Presicion and Renderer
const gl = app.renderer.context.gl;
const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision;
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

// Canvas sized Quad
const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition',
        [-resolution.width, -resolution.height, 
          resolution.width, -resolution.height,
          resolution.width,  resolution.height,
         -resolution.width,  resolution.height], 
        2) 
    .addIndex([0, 1, 2, 0, 2, 3]);

// Add to canvas
const shader = PIXI.Shader.from(vertex, fragment, uniforms);
const quad = new PIXI.Mesh(geometry, shader, uniforms);
const coords = new PIXI.Text('', {fontFamily : 'Arial', fontSize: 12, fill : 0x00ff00, align : 'left'});

app.stage.addChild(quad);
app.stage.addChild(coords);

// Movement
let keyState = {};
let mousedown = false;
let mouseover = false;

let zoom = 0.99;
let scrollZoom = 0.84;
let movementSpeed = state.scale;
let showDebug = false;

let prevCoord = null;
let baseScale = null;
let baseMs = null

window.addEventListener('keydown', (e) => {
    keyState[e.keyCode || e.which] = true;
    if (e.keyCode == 68 || e.which == 68) showDebug = !showDebug;
    app.ticker.start();
}, true);

window.addEventListener('keyup', (e) => {
    delete keyState[e.keyCode || e.which];
    
    // Stop rendering if no keys pressed and mouse not over canvas
    if (Object.keys(keyState).length == 0 && !mouseover) app.ticker.stop();
},true);

window.addEventListener('wheel', (e) => {
    // only scroll when mouse over canvas
    if (mouseover){

        // zoom in
        if (Math.sign(e.deltaY) > 0){
            state.scale /= scrollZoom;
            movementSpeed /= scrollZoom;
            
        // zoom out
        }else {
            state.scale *= scrollZoom;
            movementSpeed *= scrollZoom;
        }
 
    }
}, true);

// Mobile controls
hammer
    .on('panstart', (e) => {
        app.ticker.start();
        prevCoord = {x: e.deltaX, y: e.deltaY};
    })
    .on('panmove', (e) => {
        pos = {x: e.deltaX, y: e.deltaY};
        state.center[0] += movementSpeed * (prevCoord.x - pos.x);
        state.center[1] += movementSpeed * (pos.y - prevCoord.y);
        prevCoord = pos
    })
    .on('panend', (e) => {
        if (!mouseover) app.ticker.stop();
    })
    .on('pinchstart', (e) => {
        app.ticker.start();
        baseScale = state.scale;
        baseMs = movementSpeed;
    })
    .on('pinch', (e) => {
        state.scale = baseScale / e.scale;
        movementSpeed = baseMs / e.scale;
    })
    .on('pinchend', (e) => {
        if (!mouseover) app.ticker.stop();
    })

// Render
let avgFPS = 1.0;
let compSpeed = 0.0;
let compZoom = 0.0;

app.ticker.add((delta) => {
    avgFPS = 0.9 * avgFPS + (0.1 * app.ticker.FPS);
    compSpeed = movementSpeed * delta * 8;
    compZoom = Math.pow(zoom, delta * 2);
    
    if (showDebug){
        coords.text = "renderer: " + renderer +
                    "\nx: " + state.center[0] +  
                    "\ny: " + state.center[1] + 
                    "\ns: " + state.scale + 
                    "\niterations: " + Math.floor(quad.shader.uniforms.iterations) +
                    "\nfps: " + Math.floor(avgFPS)
    } else coords.text = "";
    
    // Up
    if (keyState[38]){
        state.center[1] += compSpeed;
    }
    
    // Down
    if (keyState[40]){
        state.center[1] -= compSpeed;
    }
    
    // Left
    if (keyState[39]){
        state.center[0] += compSpeed;
    }
    
    // Right
    if (keyState[37]){
        state.center[0] -= compSpeed;
    }
    
    // Zoom in - Q
    if (keyState[81]){
        state.scale *= compZoom;
        movementSpeed *= compZoom;
    }
    
    // Zoom out - W
    if (keyState[87]){
        state.scale /= compZoom;
        movementSpeed /= compZoom;
    }
    
    // Increase iterations - A
    if (keyState[65]){
        quad.shader.uniforms.iterations += delta;
    }
    
    // Decrease iterations - S
    if (keyState[83]){
        quad.shader.uniforms.iterations -= delta;
    }
    
    quad.shader.uniforms.scale = split(state.scale);
    quad.shader.uniforms.center = [...split(state.center[0]), ...split(state.center[1])];
});

// Start render when mouse over the canvas
app.ticker.stop();

app.view.onmouseover = () => {
    app.ticker.start();
    mouseover = true;
    document.body.onmouseup = () => {
        mousedown = false;
    }
}

app.view.onmousedown = () => {
    mousedown = true;
}

// stop rendering if out of canvas and not clicked down
app.view.onmouseout = () => {
    mouseover = false;
    if (!mousedown) app.ticker.stop();
    else {
        document.body.onmouseup = () => {
            app.ticker.stop();
            mousedown = false;
        }
    }
}

// resize app on window resize
window.addEventListener("resize", () => {
    let newW = document.getElementById("app").offsetWidth + 1;
    let newH = document.getElementById("app").offsetHeight + 1;

    app.renderer.resize(newW, newH);
    quad.setTransform(0, 0, newW / resolution.width, newH / resolution.height);
    quad.shader.uniforms.offset = [newW / 2.0, newH / 2.0]
    
    app.ticker.update();  
});

// remove loader and add app to dom
let appElement = document.getElementById("app")

while (appElement.firstChild) {
    appElement.removeChild(appElement.firstChild);
}

appElement.appendChild(app.view);
appElement.onwheel = (e) => {e.preventDefault()};
app.render();

// ios not loading sometimes need rerender
setTimeout(() => {app.render()}, 1000);