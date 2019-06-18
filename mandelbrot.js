// Split double into two singles
let split = (a) => {
    let hi = Math.fround(a);
    let lo = a - hi;
    
    return [hi, lo];
}

const resolution = {
    width: 800,
    height: 600
}

const app = new PIXI.Application(resolution);
const hammer = new Hammer(app.view);
hammer.add( new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }) );
hammer.add( new Hammer.Pinch({ threshold: 0 }) );

document.getElementById("app").appendChild(app.view);

// Check Available Presicion and Renderer
const gl = app.renderer.context.gl;
const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision;
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
const node = document.createTextNode("Mantissa is " + precision + " bits, " + "Renderer is " + renderer); 
document.getElementById("debug").appendChild(node); 

// Full Screen Quad
const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition',
        [-resolution.width, -resolution.height, 
          resolution.width, -resolution.height,
          resolution.width,  resolution.height,
         -resolution.width,  resolution.height], 
        2) 
    .addIndex([0, 1, 2, 0, 2, 3]);

// State
const state = {
    center : [-(resolution.height / resolution.width), 0.0],
    scale  : 0.004
}
    
const uniforms = {
    center : [...split(state.center[0]), ...split(state.center[1])],
    offset : [resolution.width / 2.0, resolution.height / 2.0],
    scale  : split(state.scale),
    zero   : [0.00000000000001, 0.00000000000001]
};

// Add
const shader = PIXI.Shader.from(vertex, fragment, uniforms);
const quad = new PIXI.Mesh(geometry, shader, uniforms);
const coords = new PIXI.Text('x: 0, y: 0',{fontFamily : 'Arial', fontSize: 12, fill : 0x00ff00, align : 'left'});
quad.interactive = true;

app.stage.addChild(quad);
app.stage.addChild(coords);

// Movement
let keyState = {};

let zoom = 0.99;
let scrollZoom = 0.84;
let movementSpeed = 4 * state.scale;
let panSens = 1 - (resolution.height / resolution.width);

let prevCoord = null;
let baseScale = null;
let baseMs = null

window.addEventListener('keydown', (e) => {
    keyState[e.keyCode || e.which] = true;
}, true);

window.addEventListener('keyup', (e) => {
    keyState[e.keyCode || e.which] = false;
},true);

window.addEventListener('wheel', (e) => {
    if (Math.sign(e.deltaY) > 0){
        state.scale /= scrollZoom;
        movementSpeed /= scrollZoom;
    }else {
        state.scale *= scrollZoom;
        movementSpeed *= scrollZoom;
        
        // fix transition between singles and doubles
        state.center[1] += movementSpeed / 100000.0;
        state.center[0] += movementSpeed / 100000.0;
    }
},true);

hammer
    .on('panstart', (e) => {
        prevCoord = {x: e.deltaX * panSens, y: e.deltaY * panSens};
    })
    .on('panmove', (e) => {
        pos = {x: e.deltaX * panSens, y: e.deltaY * panSens};
        state.center[0] += movementSpeed * (prevCoord.x - pos.x);
        state.center[1] += movementSpeed * (pos.y - prevCoord.y);
        prevCoord = pos
    })
    .on('pinchstart', (e) => {
        baseScale = state.scale;
        baseMs = movementSpeed;
    })
    .on('pinch', (e) => {
        state.scale = baseScale / e.scale;
        movementSpeed = baseMs / e.scale;
    })

let avgFPS = 1.0;
let compSpeed = 0.0;
let compZoom = 0.0;

// Render
app.ticker.add((delta) => {
    avgFPS = 0.9 * avgFPS + (0.1 * app.ticker.FPS);
    compSpeed = movementSpeed * delta * 2;
    compZoom = Math.pow(zoom, delta * 2);
    
    coords.text = " fps: " + Math.floor(avgFPS) +
                "\n x: " + quad.shader.uniforms.center[0] +
                "\n ex: " + quad.shader.uniforms.center[1] +     
                "\n y: " + quad.shader.uniforms.center[2] + 
                "\n ey: " + quad.shader.uniforms.center[3] + 
                "\n s: " + quad.shader.uniforms.scale[0] + 
                "\n es: " + quad.shader.uniforms.scale[1];
    
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
    
    quad.shader.uniforms.scale = split(state.scale);
    quad.shader.uniforms.center = [...split(state.center[0]), ...split(state.center[1])];
});
