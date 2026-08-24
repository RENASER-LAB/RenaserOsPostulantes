/**
 * Capturas del camino publico: portada, ficha, entrar, crear cuenta y la
 * pantalla de la contraseña olvidada.
 *
 * Como el resto: la respuesta se intercepta, asi que no se le pide nada a ningun
 * backend. Importa: apuntando `.env.local` a AWS, el backend escribe en la base
 * de produccion.
 *
 *   node herramientas/capturar-publico.mjs
 *   node herramientas/capturar-publico.mjs --errores   # los formularios en rojo
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const conErrores = process.argv.includes('--errores')

const VACANTES = [
  {
    id: 1, titulo: 'Analista de Datos',
    descripcion: null,
    proposito: 'Que los reportes semanales salgan solos y sean confiables, y que el área comercial deje de pedir números por chat.',
    responsabilidades: 'Ordenar la información que hoy vive en hojas sueltas\nArmar los reportes que el equipo comercial usa cada semana\nDejar documentado cómo se calcula cada número',
    requisitos: 'Experiencia con SQL\nSaber explicar un número a quien no es técnico',
    modalidad: 'Híbrido', horario: 'L-V, 9 a 18', ubicacion: 'Lima',
    compensacionPublica: 'A convenir',
    requisitosObjetivos: [
      { id: 1, descripcion: 'Disponibilidad para trabajar de forma híbrida en Lima.' },
      { id: 2, descripcion: 'Experiencia demostrable con SQL.' },
      { id: 3, descripcion: 'Título universitario o técnico concluido.' },
    ],
  },
  {
    id: 2, titulo: 'Administrador',
    descripcion: 'Llevar la operación del día a día: compras, proveedores, caja chica y el control de que lo comprometido se cumpla.',
    proposito: null, responsabilidades: null, requisitos: null,
    modalidad: 'Presencial', horario: null, ubicacion: 'Lima',
    compensacionPublica: null, requisitosObjetivos: [],
  },
]

const TEXTOS = [
  { tipo: 'TRATAMIENTO_PROCESO', version: '1.1', texto: 'Autorizo el tratamiento de mis datos personales para la evaluación de mi candidatura.\n\nMi currículum y mis respuestas serán procesados con servicios de terceros ubicados fuera del país. Antes de salir, mi currículum se anonimiza: edad, sexo y estado civil quedan cubiertos.\n\n[Pendiente: este texto tiene que nombrar a las empresas concretas que procesan los datos antes del primer candidato real.]' },
  { tipo: 'FUTUROS_CONTACTOS', version: '1.0', texto: 'Autorizo que Renaser me contacte para futuras convocatorias que encajen con mi perfil. Puedo retirar este permiso en cualquier momento desde el portal.' },
]

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

const PANTALLAS = [
  { nombre: 'portada', ruta: '/' },
  { nombre: 'vacante', ruta: '/vacantes/1' },
  { nombre: 'entrar', ruta: '/ingresar' },
  { nombre: 'registro', ruta: '/registro?vacante=1' },
  // La salida de quien no puede entrar. No restablece nada: lo explica.
  { nombre: 'clave', ruta: '/clave' },
]

for (const t of [{ nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 812 }]) {
  for (const pantalla of PANTALLAS) {
    const contexto = await navegador.newContext({
      viewport: { width: t.width, height: t.height }, locale: 'es-PE',
    })
    await contexto.route('**/api/v1/portal/vacantes', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VACANTES) }))
    await contexto.route('**/api/v1/portal/vacantes/*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VACANTES[0]) }))
    await contexto.route('**/api/v1/portal/consentimientos/textos', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TEXTOS) }))

    const pagina = await contexto.newPage()
    const fallos = []
    pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
    pagina.on('pageerror', (e) => fallos.push(String(e)))
    await pagina.goto(PORTAL + pantalla.ruta, { waitUntil: 'networkidle' })

    // Enviar el formulario vacio para ver como se ven los errores.
    if (conErrores && (pantalla.nombre === 'registro' || pantalla.nombre === 'entrar')) {
      await pagina.locator('button[type="submit"]').first().click()
      await pagina.waitForTimeout(300)
    }

    const sufijo = conErrores && (pantalla.nombre === 'registro' || pantalla.nombre === 'entrar') ? '-errores' : ''
    const archivo = `capturas/${pantalla.nombre}${sufijo}-${t.nombre}.png`
    await pagina.screenshot({ path: archivo, fullPage: true })
    console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
    for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
    await contexto.close()
  }
}
await navegador.close()
