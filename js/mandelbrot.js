// Split double into two singles
let split = (a) => {
    let hi = Math.fround(a);
    let lo = a - hi;
    
    return [hi, lo];
}

// State
const resolution = {
    width: window.innerWidth * 0.26,
    height: window.innerHeight * 0.3
}

let gridItem = document.getElementsByClassName('grid-item');
for (var i = 0; i < gridItem.length; i++) {
  gridItem[i].style.width = resolution.width;
  gridItem[i].style.height = resolution.height;
}

const state = {
    center : [-(resolution.height / resolution.width), 0.0],
    scale  : (resolution.height / resolution.width) * 0.01
}
    
const uniforms = {
    center     : [...split(state.center[0]), ...split(state.center[1])],
    offset     : [resolution.width / 2.0, resolution.height / 2.0],
    scale      : split(state.scale),
    zero       : [0.00000000000001, 0.00000000000001],
    iterations : 512.0,
};

// App
const app = new PIXI.Application(resolution);
const hammer = new Hammer(app.view);
hammer.add( new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }) );
hammer.add( new Hammer.Pinch({ threshold: 0 }) );

document.getElementById("app").appendChild(app.view);
document.getElementById("app").onwheel = (e) => {e.preventDefault()};


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
quad.interactive = true;

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
    if (app.renderer.plugins.interaction.mouseOverRenderer){

        // zoom in
        if (Math.sign(e.deltaY) > 0){
            state.scale /= scrollZoom;
            movementSpeed /= scrollZoom;
            
        // zoom out
        }else {
            state.scale *= scrollZoom;
            movementSpeed *= scrollZoom;

            // fix transition between singles and doubles
            state.center[1] += movementSpeed / 100000.0;
            state.center[0] += movementSpeed / 100000.0;
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
    .on('pinchstart', (e) => {
        app.ticker.start();
        baseScale = state.scale;
        baseMs = movementSpeed;
    })
    .on('pinch', (e) => {
        state.scale = baseScale / e.scale;
        movementSpeed = baseMs / e.scale;
    })

// Render
let avgFPS = 1.0;
let compSpeed = 0.0;
let compZoom = 0.0;

app.ticker.add((delta) => {
    avgFPS = 0.9 * avgFPS + (0.1 * app.ticker.FPS);
    compSpeed = movementSpeed * delta * 2;
    compZoom = Math.pow(zoom, delta * 2);
    
    if (showDebug){
        coords.text = "renderer: " + renderer +
                    "\n x: " + quad.shader.uniforms.center[0] +
                    "\n ex: " + quad.shader.uniforms.center[1] +     
                    "\n y: " + quad.shader.uniforms.center[2] + 
                    "\n ey: " + quad.shader.uniforms.center[3] + 
                    "\n s: " + quad.shader.uniforms.scale[0] + 
                    "\n es: " + quad.shader.uniforms.scale[1] + 
                    "\n iterations: " + quad.shader.uniforms.iterations +
                    "\n mantissa: " + precision + " bit" +
                    "\n fps: " + Math.floor(avgFPS);
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
        quad.shader.uniforms.iterations += 2.0 * delta;
    }
    
    // Decrease iterations - S
    if (keyState[83]){
        quad.shader.uniforms.iterations -= 2.0 * delta;
    }
    
    quad.shader.uniforms.scale = split(state.scale);
    quad.shader.uniforms.center = [...split(state.center[0]), ...split(state.center[1])];
});

// Only render when mouse over the canvas
app.ticker.stop();
app.ticker.update();

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
