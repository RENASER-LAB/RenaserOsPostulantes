/**
 * El fondo de la portada: la réplica del de northstar-template-demo.vercel.app.
 *
 * Lo que hace la referencia, sacado de su bundle el 13/11/2026: el sombreador
 * «Dithering» de Paper Shaders con
 *
 *   - forma `simplex` (dos octavas de ruido simplex que suben y bajan),
 *   - tramado Bayer 4×4 en celdas de 4 px CSS, escala 1,2,
 *   - frente `#527ADA` sobre fondo transparente, velocidad 0,5,
 *   - el lienzo un 10 % más grande que la caja por cada lado,
 *   - y encima una MÁSCARA DE RAYAS verticales —1,92 px visibles cada 14,4 px—,
 *     que es lo que convierte las manchas tramadas en columnas punteadas.
 *   - Todo al 64 % sobre blanco, y un paralaje de ±8 px que sigue al ratón.
 *
 * Aquí el sombreador es el mismo, recortado a lo que se usa (simplex + Bayer
 * 4×4), en WebGL2 y sin la librería. Las rayas son CSS, como allí.
 *
 * Rendimiento, que es lo que se cuida aquí y la referencia no:
 *   - Se para fuera de la pantalla y en otra pestaña.
 *   - 60 cuadros con ratón fino, 30 en el resto (teléfonos): las celdas son de
 *     4 px y el ruido sube unos 75 px/s, a 30 cuadros no se nota.
 *   - El lienzo no pasa de ~3 Mpx: la densidad baja sola en pantallas grandes;
 *     el tamaño de la celda en px CSS no cambia.
 *   - Con `prefers-reduced-motion` se dibuja un cuadro y se queda quieto, sin
 *     paralaje.
 *   - Sin WebGL2 se pinta UN cuadro quieto en canvas 2D con el mismo cálculo.
 *
 * Es decoración pura: `aria-hidden`, sin eventos propios.
 */

import { useEffect, useRef, useState } from 'react'
import estilos from './FondoDeLaPortada.module.css'

/** Los parámetros de la referencia. */
const TAMANO_CELDA = 4 // px CSS
const ESCALA = 1.2
const VELOCIDAD = 0.5
const FRENTE: [number, number, number] = [82 / 255, 122 / 255, 218 / 255] // #527ADA
const PIXELES_MAXIMOS = 3_000_000

const VERTICE = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

/* El fragmento de Paper «Dithering», solo con la forma simplex y Bayer 4×4. */
const FRAGMENTO = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform vec3 u_front;
out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

const int bayer4x4[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);

void main() {
  float t = 0.5 * u_time;
  float pxSize = ${TAMANO_CELDA.toFixed(1)} * u_pixelRatio;
  vec2 pxSizeUV = (gl_FragCoord.xy - 0.5 * u_resolution) / pxSize;
  vec2 celda = (floor(pxSizeUV) + 0.5) * pxSize;

  vec2 uv = (celda / u_pixelRatio / ${ESCALA.toFixed(2)} + 0.5) * 0.001;
  float shape = 0.5 * snoise(uv - vec2(0.0, 0.3 * t));
  shape += 0.5 * snoise(2.0 * uv + vec2(0.0, 0.32 * t));
  shape = smoothstep(0.3, 0.9, 0.5 + 0.5 * shape);

  ivec2 pos = ivec2(fract(pxSizeUV / 4.0) * 4.0);
  float dithering = float(bayer4x4[pos.y * 4 + pos.x]) / 16.0 - 0.5;
  float res = step(0.5, shape + dithering);
  fragColor = vec4(u_front * res, res);
}`

/* ---------- El respaldo en 2D: el mismo cálculo, un solo cuadro ---------- */

const PERM = (x: number) => (((x * 34 + 1) * x) % 289 + 289) % 289
function snoise(vx: number, vy: number) {
  const C = [0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439] as const
  const s = (vx + vy) * C[1]
  let ix = Math.floor(vx + s)
  let iy = Math.floor(vy + s)
  const t0 = (ix + iy) * C[0]
  const x0 = vx - ix + t0
  const y0 = vy - iy + t0
  const i1x = x0 > y0 ? 1 : 0
  const i1y = x0 > y0 ? 0 : 1
  const x1 = x0 + C[0] - i1x
  const y1 = y0 + C[0] - i1y
  const x2 = x0 + C[2]
  const y2 = y0 + C[2]
  ix = ((ix % 289) + 289) % 289
  iy = ((iy % 289) + 289) % 289
  const p = [0, i1y, 1].map((d, k) => PERM(PERM(iy + d) + ix + [0, i1x, 1][k]!))
  const xs = [x0, x1, x2]
  const ys = [y0, y1, y2]
  let suma = 0
  for (let k = 0; k < 3; k++) {
    const xk = xs[k]!
    const yk = ys[k]!
    let m = Math.max(0.5 - (xk * xk + yk * yk), 0)
    m = m * m * m * m
    const fx = 2 * ((p[k]! * C[3]) % 1) - 1
    const h = Math.abs(fx) - 0.5
    const a0 = fx - Math.floor(fx + 0.5)
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h)
    suma += m * (a0 * xk + h * yk)
  }
  return 130 * suma
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function pintarEn2D(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const caja = canvas.getBoundingClientRect()
  canvas.width = Math.round(caja.width)
  canvas.height = Math.round(caja.height)
  const columnas = Math.ceil(caja.width / TAMANO_CELDA)
  const filas = Math.ceil(caja.height / TAMANO_CELDA)
  ctx.fillStyle = `rgb(${FRENTE.map((c) => Math.round(c * 255)).join(' ')})`
  for (let f = 0; f < filas; f++) {
    // De abajo arriba, como `gl_FragCoord`.
    const cy = (f - filas / 2 + 0.5) * TAMANO_CELDA
    for (let c = 0; c < columnas; c++) {
      const cx = (c - columnas / 2 + 0.5) * TAMANO_CELDA
      const ux = (cx / ESCALA + 0.5) * 0.001
      const uy = (cy / ESCALA + 0.5) * 0.001
      let forma = 0.5 * snoise(ux, uy) + 0.5 * snoise(2 * ux, 2 * uy)
      forma = suave(0.3, 0.9, 0.5 + 0.5 * forma)
      const bx = ((c % 4) + 4) % 4
      const by = ((f % 4) + 4) % 4
      if (forma + BAYER[by * 4 + bx]! / 16 - 0.5 >= 0.5) {
        ctx.fillRect(c * TAMANO_CELDA, caja.height - (f + 1) * TAMANO_CELDA, TAMANO_CELDA, TAMANO_CELDA)
      }
    }
  }
}

/* ---------- El componente ---------- */

export function FondoDeLaPortada({ className }: { className?: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  // Sube cuando el navegador devuelve un contexto WebGL perdido: el efecto se
  // vuelve a montar entero y recompila el sombreador.
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const canvas = lienzo.current
    const envoltorio = caja.current
    if (!canvas || !envoltorio) return

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ratonFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const intervalo = ratonFino ? 0 : 1000 / 30

    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true })
    if (!gl) {
      pintarEn2D(canvas)
      return
    }

    function compilar(tipo: number, fuente: string) {
      const s = gl!.createShader(tipo)!
      gl!.shaderSource(s, fuente)
      gl!.compileShader(s)
      return s
    }
    const programa = gl.createProgram()!
    gl.attachShader(programa, compilar(gl.VERTEX_SHADER, VERTICE))
    gl.attachShader(programa, compilar(gl.FRAGMENT_SHADER, FRAGMENTO))
    gl.linkProgram(programa)
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      pintarEn2D(canvas)
      return
    }
    gl.useProgram(programa)
    const bufer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, bufer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(programa, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const uTime = gl.getUniformLocation(programa, 'u_time')
    const uRes = gl.getUniformLocation(programa, 'u_resolution')
    const uRatio = gl.getUniformLocation(programa, 'u_pixelRatio')
    gl.uniform3f(gl.getUniformLocation(programa, 'u_front'), ...FRENTE)

    let tiempo = 0
    let ultimo = 0
    let cuadro = 0
    let visible = true

    function medir() {
      const r = canvas!.getBoundingClientRect()
      let densidad = Math.min(window.devicePixelRatio || 1, 2)
      const pixeles = r.width * r.height * densidad * densidad
      if (pixeles > PIXELES_MAXIMOS) densidad *= Math.sqrt(PIXELES_MAXIMOS / pixeles)
      canvas!.width = Math.max(1, Math.round(r.width * densidad))
      canvas!.height = Math.max(1, Math.round(r.height * densidad))
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
      gl!.uniform2f(uRes, canvas!.width, canvas!.height)
      gl!.uniform1f(uRatio, densidad)
    }

    function pintar() {
      gl!.uniform1f(uTime, tiempo)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    }

    // El bucle se para del todo fuera de pantalla o en otra pestaña, en vez de
    // seguir pidiendo cuadros sin pintar; `reanudar` lo vuelve a poner en marcha.
    let perdido = false
    function bucle(ahora: number) {
      if (!visible || document.hidden || perdido) {
        cuadro = 0
        ultimo = 0
        return
      }
      cuadro = requestAnimationFrame(bucle)
      const delta = ultimo ? ahora - ultimo : 0
      if (delta < intervalo) return
      ultimo = ahora
      // Como Paper: el tiempo avanza con la velocidad y solo mientras se ve. Un
      // salto largo (la pestaña volvió) no se cobra entero.
      tiempo += (Math.min(delta, 100) / 1000) * VELOCIDAD
      pintar()
    }

    medir()
    pintar()

    const alCambiar = new ResizeObserver(() => {
      medir()
      pintar()
    })
    alCambiar.observe(canvas)
    function reanudar() {
      if (!quieto && !cuadro && visible && !document.hidden && !perdido) cuadro = requestAnimationFrame(bucle)
    }
    const alAsomar = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true
      reanudar()
    })
    alAsomar.observe(canvas)
    document.addEventListener('visibilitychange', reanudar)

    // Si el sistema retira el contexto (memoria de la GPU, suspensión), se espera
    // a que lo devuelva y se monta de nuevo; sin esto el fondo quedaba en blanco.
    function alPerder(evento: Event) {
      evento.preventDefault()
      perdido = true
      cancelAnimationFrame(cuadro)
      cuadro = 0
    }
    function alRecuperar() {
      setIntento((n) => n + 1)
    }
    canvas.addEventListener('webglcontextlost', alPerder)
    canvas.addEventListener('webglcontextrestored', alRecuperar)

    // El paralaje de la referencia: ±8 px contra el ratón, solo con ratón fino.
    let destinoX = 0
    let destinoY = 0
    let pendiente = 0
    function alMover(evento: PointerEvent) {
      destinoX = -8 * ((evento.clientX / window.innerWidth) * 2 - 1)
      destinoY = -8 * ((evento.clientY / window.innerHeight) * 2 - 1)
      if (pendiente) return
      pendiente = requestAnimationFrame(() => {
        pendiente = 0
        envoltorio!.style.transform = `translate3d(${destinoX.toFixed(2)}px, ${destinoY.toFixed(2)}px, 0)`
      })
    }
    if (!quieto && ratonFino) window.addEventListener('pointermove', alMover, { passive: true })
    if (!quieto) cuadro = requestAnimationFrame(bucle)

    return () => {
      cancelAnimationFrame(cuadro)
      cancelAnimationFrame(pendiente)
      window.removeEventListener('pointermove', alMover)
      document.removeEventListener('visibilitychange', reanudar)
      canvas.removeEventListener('webglcontextlost', alPerder)
      canvas.removeEventListener('webglcontextrestored', alRecuperar)
      alCambiar.disconnect()
      alAsomar.disconnect()
      // ⚠️ Sin `loseContext()`: el mismo lienzo vuelve a pedir su contexto al
      // montarse otra vez (StrictMode lo hace siempre) y recibiría uno perdido.
      gl.deleteBuffer(bufer)
      gl.deleteProgram(programa)
    }
  }, [intento])

  return (
    <div className={`${estilos.campo} ${className ?? ''}`} aria-hidden="true">
      <div ref={caja} className={estilos.paralaje}>
        <div className={estilos.rayas}>
          <canvas ref={lienzo} className={estilos.lienzo} />
        </div>
      </div>
    </div>
  )
}
