PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH

const resolution = {
    width: document.getElementById("app").offsetWidth + 1,
    height: document.getElementById("app").offsetHeight + 1
}

class MandelbrotMesh {
    constructor(app, resolution, resolutionScale){
        this.width  = resolution.width * resolutionScale
        this.height = resolution.height * resolutionScale
        this.resolutionScale = resolutionScale

        this.state = {
            center     : [-0.5, 0.0],
            scale      : 2.4 / Math.min(this.height, this.width),
            iterations : 180
        }

        this.movementSpeed = this.state.scale * resolutionScale

        let uniforms = {
            center     : [
                ...MandelbrotMesh._split(this.state.center[0]),
                ...MandelbrotMesh._split(this.state.center[1])
            ],
            offset     : [this.width / 2.0, this.height / 2.0],
            scale      : MandelbrotMesh._split(this.state.scale),
            zero       : [0.00000000000001, 0.00000000000001],
            iterations : this.state.iterations,
        }

        // full canvas quad
        let vertices = [
            -this.width, -this.height,
             this.width, -this.height,
             this.width,  this.height,
            -this.width,  this.height
        ]

        let geometry = new PIXI.Geometry()
            .addAttribute('aVertexPosition', vertices, 2)
            .addIndex([0, 1, 2, 0, 2, 3])

        let shader = PIXI.Shader.from(vertex, fragment, uniforms)
        this.mesh = new PIXI.Mesh(geometry, shader, uniforms)
    }

    /**
     * Split double into two singles
     */
    static _split(a) {
        let b = a + a * 1e-7 * Math.random() // improve stability
        let hi = Math.fround(b)
        let lo = a - hi

        return [hi, lo]
    }

    update() {
        this.mesh.shader.uniforms.iterations = this.state.iterations
        this.mesh.shader.uniforms.scale = MandelbrotMesh._split(this.state.scale)
        this.mesh.shader.uniforms.center = [
            ...MandelbrotMesh._split(this.state.center[0]),
            ...MandelbrotMesh._split(this.state.center[1])
        ]
    }

    resize(newWidth, newHeight) {
        let newW = newWidth * this.resolutionScale
        let newH = newHeight * this.resolutionScale

        this.mesh.setTransform(0, 0, newW / this.width, newH / this.height)
        this.mesh.shader.uniforms.offset = [newW / 2.0, newH / 2.0]
    }
}

// App
const app = new PIXI.Application(resolution)
const hammer = new Hammer(app.view)
hammer.add( new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }) )
hammer.add( new Hammer.Pinch({ threshold: 0 }) )

// Get debug info
const gl = app.renderer.context.gl
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)

// Add to canvas
const coords = new PIXI.Text('', {fontFamily : 'Arial', fontSize: 12, fill : 0x00ff00, align : 'left'})
const baseMesh = new MandelbrotMesh(app, resolution, 1, true)
const hdMesh = new MandelbrotMesh(app, resolution, 2, false)

// hi res sprite for super sampling
const SSAATexture = PIXI.RenderTexture.create({ width: hdMesh.width, height: hdMesh.height, scaleMode: PIXI.SCALE_MODES.LINEAR })
const SSAASprite = new PIXI.Sprite(SSAATexture)
SSAASprite.setTransform(0, resolution.height, 1, -1, 0, 0, 0, 0, 0) // webgl frame buffers have inverted y axis
SSAASprite.width = resolution.width
SSAASprite.height = resolution.height

app.stage.addChild(baseMesh.mesh)
app.stage.addChild(SSAASprite)
app.stage.addChild(coords)

// super sampling function
let SSAAPass = () => {
    app.renderer.render(hdMesh.mesh, SSAATexture)
    SSAASprite.visible = true
    app.render()
}

let meshes = [baseMesh, hdMesh]
let mesh = null

// Movement
let keyState = {}
let keyStateLen = 0

let mouseover = false
let mousemoving = false
let scrolling = null

let zoom = 0.99
let scrollZoom = 0.84
let showDebug = false

let prevCoord = null
let baseScale = null
let baseMs = null

window.addEventListener('keydown', (e) => {
    if (!(e.key in keyState)){
        keyState[e.key] = true
        keyStateLen += 1
    }

    if (e.key === 'd') showDebug = !showDebug
    app.ticker.start()
}, true)

window.addEventListener('keyup', (e) => {
    if (e.key in keyState){
        delete keyState[e.key]
        keyStateLen -= 1
    }
},true)

window.addEventListener('wheel', (e) => {
    // only scroll when mouse over canvas
    if (mouseover){

        if (scrolling === null && !app.ticker.started){
            scrolling = setTimeout(() => {
                scrolling = null
                app.ticker.update()
            }, 250)
        }

        for (i in meshes) {
            mesh = meshes[i]

            // zoom in
            if (Math.sign(e.deltaY) > 0){
                mesh.state.scale /= scrollZoom
                mesh.movementSpeed /= scrollZoom

            // zoom out
            }else {
                mesh.state.scale *= scrollZoom
                mesh.movementSpeed *= scrollZoom
            }
        }

        app.ticker.update()
    }
}, true)

app.view.onmouseover = () => {mouseover = true}
app.view.onmouseout = () => {mouseover = false}

// Mobile controls
hammer
    .on('panstart', (e) => {
        mousemoving = true
        prevCoord = {x: e.deltaX, y: e.deltaY}
        app.ticker.start()
    })
    .on('panmove', (e) => {
        pos = {x: e.deltaX, y: e.deltaY}

        for (i in meshes) {
            mesh = meshes[i]
            mesh.state.center[0] += mesh.movementSpeed * (prevCoord.x - pos.x)
            mesh.state.center[1] += mesh.movementSpeed * (pos.y - prevCoord.y)
        }

        prevCoord = pos
    })
    .on('panend', (e) => {
        mousemoving = false
    })
    .on('pinchstart', (e) => {
        mousemoving = true

        for (i in meshes) {
            mesh = meshes[i]
            mesh.baseScale = mesh.state.scale
            mesh.baseMs = mesh.movementSpeed
        }

        app.ticker.start()
    })
    .on('pinch', (e) => {
        for (i in meshes) {
            mesh = meshes[i]
            mesh.state.scale = mesh.baseScale / e.scale
            mesh.movementSpeed = mesh.baseMs / e.scale
        }
    })
    .on('pinchend', (e) => {
        mousemoving = false
    })

// Render
let avgFPS = 1.0
let compSpeed = 0.0
let compZoom = 0.0

app.ticker.add((delta) => {
    avgFPS = 0.9 * avgFPS + (0.1 * app.ticker.FPS)

    if (showDebug){
        coords.text = "renderer: " + renderer +
                    "\nx: " + baseMesh.state.center[0] +
                    "\ny: " + baseMesh.state.center[1] +
                    "\ns: " + baseMesh.state.scale +
                    "\niterations: " + Math.floor(baseMesh.state.iterations) +
                    "\nfps: " + Math.floor(avgFPS)
    } else coords.text = ""

    for (i in meshes) {
        mesh = meshes[i]
        compSpeed = mesh.movementSpeed * delta * 8
        compZoom = Math.pow(zoom, delta * 2)

        // Up
        if (keyState['ArrowUp']){
            mesh.state.center[1] += compSpeed
        }

        // Down
        if (keyState['ArrowDown']){
            mesh.state.center[1] -= compSpeed
        }

        // Pan Left
        if (keyState['ArrowRight']){
            mesh.state.center[0] += compSpeed
        }

        // Pan Right
        if (keyState['ArrowLeft']){
            mesh.state.center[0] -= compSpeed
        }

        // Zoom in - Q
        if (keyState['q']){
            mesh.state.scale *= compZoom
            mesh.movementSpeed *= compZoom
        }

        // Zoom out - W
        if (keyState['w']){
            mesh.state.scale /= compZoom
            mesh.movementSpeed /= compZoom
        }

        // Increase iterations - A
        if (keyState['a']){
            mesh.state.iterations += delta
        }

        // Decrease iterations - S
        if (keyState['s']){
            mesh.state.iterations -= delta
        }

        mesh.update()
    }

    if (keyStateLen === 0 && !mousemoving && scrolling === null){
        app.ticker.stop()
        SSAAPass()

    } else {
        SSAASprite.visible = false
    }
})

app.ticker.stop()

// resize app on window resize
window.addEventListener("resize", () => {
    let newW = document.getElementById("app").offsetWidth + 1
    let newH = document.getElementById("app").offsetHeight + 1

    app.renderer.resize(newW, newH)

    for (i in meshes){
        mesh = meshes[i]
        mesh.resize(newW, newH)
    }

    SSAATexture.framebuffer.resize(newW * hdMesh.resolutionScale, newH * hdMesh.resolutionScale)
    SSAASprite.setTransform(0, newH, 1, -1, 0, 0, 0, 0, 0)
    SSAASprite.width = newW
    SSAASprite.height = newH
    SSAAPass()
})

// remove loader and add app to dom
let appElement = document.getElementById("app")

while (appElement.firstChild) {
    appElement.removeChild(appElement.firstChild)
}

appElement.appendChild(app.view)
appElement.onwheel = e => e.preventDefault()
SSAAPass()

// ios not loading sometimes need rerender
setTimeout(() => {SSAAPass()}, 1000)