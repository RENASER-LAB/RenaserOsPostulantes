/**
 * Capturas de «Mi perfil», con sus casos que importan.
 *
 * Lo que hay que mirar de cerca es **el origen de cada dato**: un dato que
 * dedujo la IA y nadie confirmó no lo ha dicho la persona, y tiene que
 * distinguirse en la forma antes que en el color.
 *
 *   node herramientas/capturar-perfil.mjs                 perfil lleno, con datos sin confirmar
 *   node herramientas/capturar-perfil.mjs --caso vacio     recién llegado, sin nada
 *   node herramientas/capturar-perfil.mjs --caso leyendo   la lectura del CV corriendo
 *   node herramientas/capturar-perfil.mjs --caso ilegible  del archivo no salió nada
 *   node herramientas/capturar-perfil.mjs --caso gris      el mismo lleno, en escala de grises
 *
 * ⚠️ El caso `gris` es la comprobación de la regla de la forma primero: si al
 * quitarle el color deja de saberse qué está sin confirmar, la pantalla está mal.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const caso = process.argv.includes('--caso')
  ? process.argv[process.argv.indexOf('--caso') + 1]
  : 'lleno'

const NIVELES_EDUCATIVOS = [
  { codigo: 'SECUNDARIA', nombre: 'Secundaria completa' },
  { codigo: 'TECNICA', nombre: 'Técnica' },
  { codigo: 'UNIVERSITARIA', nombre: 'Universitaria' },
  { codigo: 'TITULADO', nombre: 'Titulado' },
  { codigo: 'MAESTRIA', nombre: 'Maestría' },
  { codigo: 'DOCTORADO', nombre: 'Doctorado' },
]

const NIVELES_IDIOMA = [
  { codigo: 'A1', nombre: 'A1 · Principiante' },
  { codigo: 'A2', nombre: 'A2 · Básico' },
  { codigo: 'B1', nombre: 'B1 · Intermedio' },
  { codigo: 'B2', nombre: 'B2 · Intermedio alto' },
  { codigo: 'C1', nombre: 'C1 · Avanzado' },
  { codigo: 'C2', nombre: 'C2 · Superior' },
  { codigo: 'NATIVO', nombre: 'Lengua materna' },
]

const LLENO = {
  titular: 'Analista de procesos',
  resumen:
    'Ocho años ordenando operaciones en salud y transporte. Lo que mejor se me da es dejar '
    + 'documentado por qué un número es ese número, para que no haya que preguntarlo cada mes.',
  habilidades: ['Excel avanzado', 'Power BI', 'Gestión de procesos', 'SQL'],
  experienciaMeses: 96,
  ubicacion: 'Arequipa, Perú',
  disponibilidad: 'Inmediata',
  pretension: { min: 3500, max: 4200, moneda: 'PEN' },
  experiencia: [
    {
      id: 12, puesto: 'Analista senior', empresa: 'Clínica San Juan',
      desde: '2022-03-01', hasta: null,
      descripcion: 'Rehice el reporte de ocupación de camas: pasó de tres días a salir solo cada lunes.',
      origen: 'PERSONA', confirmado: true,
    },
    {
      id: 13, puesto: 'Asistente de operaciones', empresa: 'Transportes del Sur',
      desde: '2019-01-01', hasta: '2022-02-01', descripcion: null,
      origen: 'CURRICULUM', confirmado: false,
    },
    {
      id: 14, puesto: 'Practicante de mejora continua', empresa: 'Molinos del Norte',
      desde: '2018-01-01', hasta: '2018-12-01', descripcion: null,
      origen: 'CURRICULUM', confirmado: true,
    },
  ],
  educacion: [
    {
      id: 3, titulo: 'Ingeniería Industrial', institucion: 'UNSA',
      nivelCodigo: 'TITULADO', desde: '2014-03-01', hasta: '2019-12-01',
      enCurso: false, origen: 'CURRICULUM', confirmado: false,
    },
  ],
  idiomas: [
    { id: 1, idioma: 'Inglés', nivelCodigo: 'B2', origen: 'PERSONA', confirmado: true },
    { id: 2, idioma: 'Portugués', nivelCodigo: 'A2', origen: 'CURRICULUM', confirmado: false },
  ],
  certificaciones: [
    {
      id: 5, nombre: 'Soporte Vital Básico (BLS)', entidad: 'American Heart Association',
      emitidaEn: '2022-05-01', venceEn: '2024-05-01', origen: 'PERSONA', confirmado: true,
    },
    {
      id: 6, nombre: 'Power BI Data Analyst', entidad: 'Microsoft',
      emitidaEn: '2024-02-01', venceEn: null, origen: 'PERSONA', confirmado: true,
    },
  ],
  enlaces: [
    { id: 8, tipo: 'LINKEDIN', url: 'https://linkedin.com/in/ejemplo' },
    { id: 9, tipo: 'PORTAFOLIO', url: 'https://ejemplo.pe/trabajo' },
  ],
  lecturaCv: { estado: 'LISTA', actualizadoEn: '2026-08-24T10:00:00Z' },
}

const VACIO = {
  titular: null, resumen: null, habilidades: [], experienciaMeses: null,
  ubicacion: null, disponibilidad: null, pretension: null,
  experiencia: [], educacion: [], idiomas: [], certificaciones: [], enlaces: [],
  lecturaCv: { estado: 'SIN_CV', actualizadoEn: null },
}

const PERFILES = {
  lleno: LLENO,
  gris: LLENO,
  vacio: VACIO,
  leyendo: { ...VACIO, lecturaCv: { estado: 'EN_CURSO', actualizadoEn: '2026-08-26T10:00:00Z' } },
  ilegible: { ...VACIO, lecturaCv: { estado: 'NO_LEGIBLE', actualizadoEn: '2026-08-26T10:00:00Z' } },
}

const perfil = PERFILES[caso] ?? LLENO

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const t of [
  { nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 812 },
]) {
  const contexto = await navegador.newContext({
    viewport: { width: t.width, height: t.height },
    locale: 'es-PE',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: PORTAL,
          localStorage: [{ name: 'renaser_portal_token', value: 'captura' }],
        },
      ],
    },
  })

  await contexto.route('**/api/v1/portal/perfil', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(perfil) }))
  await contexto.route('**/api/v1/portal/catalogos/niveles-educativos', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NIVELES_EDUCATIVOS) }))
  await contexto.route('**/api/v1/portal/catalogos/niveles-idioma', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NIVELES_IDIOMA) }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/perfil`, { waitUntil: 'domcontentloaded' })
  await pagina.waitForTimeout(600)

  // La comprobación de la regla de la forma primero: sin color, ¿se sigue
  // sabiendo qué está sin confirmar?
  if (caso === 'gris') {
    await pagina.addStyleTag({ content: 'html { filter: grayscale(1); }' })
    await pagina.waitForTimeout(200)
  }

  const archivo = `capturas/perfil-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
