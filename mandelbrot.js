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

window.addEventListener('keydown', (e) => {
    keyState[e.keyCode || e.which] = true;
}, true);

window.addEventListener('keyup', (e) => {
    keyState[e.keyCode || e.which] = false;
},true);

let zoom = 0.99;
let movementSpeed = 4 * state.scale;
let sens = 1 - (resolution.height / resolution.width);

let prevcoord = null;
let basescale = null;
let basems = null

hammer
    .on('panstart', (e) => {
        prevcoord = {x: e.deltaX * sens, y: e.deltaY * sens};
    })
    .on('panmove', (e) => {
        pos = {x: e.deltaX * sens, y: e.deltaY * sens};
        state.center[0] += movementSpeed * (prevcoord.x - pos.x);
        state.center[1] += movementSpeed * (pos.y - prevcoord.y);
        prevcoord = pos
    })
    .on('pinchstart', (e) => {
        basescale = state.scale;
        basems = movementSpeed;
    })
    .on('pinch', (e) => {
        state.scale = basescale / e.scale;
        movementSpeed = basems / e.scale;
    })

// Render
app.ticker.add((delta) => {
    coords.text = " fps: " + Math.floor(app.ticker.FPS) +
                "\n x: " + quad.shader.uniforms.center[0] +
                "\n ex: " + quad.shader.uniforms.center[1] +     
                "\n y: " + quad.shader.uniforms.center[2] + 
                "\n ey: " + quad.shader.uniforms.center[3] + 
                "\n s: " + quad.shader.uniforms.scale[0] + 
                "\n es: " + quad.shader.uniforms.scale[1];
    
    // Up
    if (keyState[38]){
        state.center[1] += movementSpeed;
    }
    
    // Down
    if (keyState[40]){
        state.center[1] -= movementSpeed;
    }
    
    // Left
    if (keyState[39]){
        state.center[0] += movementSpeed;
    }
    
    // Right
    if (keyState[37]){
        state.center[0] -= movementSpeed;
    }
    
    // Zoom in - Pg Up
    if (keyState[33]){
        state.scale *= zoom;
        movementSpeed *= zoom;
    }
    
    // Zoom out - Pg Down
    if (keyState[34]){
        state.scale /= zoom;
        movementSpeed /= zoom;
    }
    
    quad.shader.uniforms.scale = split(state.scale);
    quad.shader.uniforms.center = [...split(state.center[0]), ...split(state.center[1])];
});
