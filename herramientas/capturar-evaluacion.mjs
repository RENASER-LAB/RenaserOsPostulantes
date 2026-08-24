/**
 * Capturas de la evaluacion, formato por formato.
 *
 * Es la pantalla mas delicada del portal: entre 50 y 85 preguntas, ocho formas
 * de responder y una cola de guardado que no puede perder nada. Aqui se mira
 * cada formato por separado.
 *
 *   node herramientas/capturar-evaluacion.mjs                # la portada
 *   node herramientas/capturar-evaluacion.mjs --caso examen  # una pregunta PC
 *   node herramientas/capturar-evaluacion.mjs --caso mapa    # el mapa abierto
 *   node herramientas/capturar-evaluacion.mjs --caso sec     # ordenar pasos
 *   node herramientas/capturar-evaluacion.mjs --caso sjt     # calificar 1-5
 *   node herramientas/capturar-evaluacion.mjs --caso ef4     # mas y menos
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const caso = process.argv.includes('--caso') ? process.argv[process.argv.indexOf('--caso') + 1] : 'portada'

const opciones = (base, textos) => textos.map((t, i) => ({ id: base + i, letra: 'ABCDE'[i], texto: t }))

const PREGUNTAS = [
  { id: 1, posicion: 1, tipo: 'PC', enunciado: '¿Has tenido que parar una entrega ya comprometida porque el resultado no estaba bien?',
    situacion: null, opciones: opciones(10, ['Sí', 'No']), respuestaTexto: null, respuestaOpcionId: null },
  { id: 2, posicion: 2, tipo: 'SJT-R',
    enunciado: 'Del 1 al 5, ¿qué tan probable es que hagas cada una de estas cosas?',
    situacion: 'Tu equipo entrega un informe semanal al área comercial. Esta semana descubres, el jueves por la tarde, que los datos de los últimos tres informes venían de una consulta mal filtrada.',
    opciones: opciones(20, [
      'Avisar de inmediato al área comercial, aunque todavía no sepas el alcance del error.',
      'Rehacer los tres informes primero y avisar el lunes con la corrección ya hecha.',
      'Preguntar a tu jefe qué prefiere antes de mover nada.',
    ]), respuestaTexto: null, respuestaOpcionId: null },
  { id: 3, posicion: 3, tipo: 'SEC',
    enunciado: 'Se cae el reporte que usa el área comercial cada mañana. Ordena lo que harías, de primero a último.',
    situacion: null,
    opciones: opciones(30, [
      'Avisar al área comercial de que el reporte de hoy va a llegar tarde.',
      'Mirar qué cambió desde la última ejecución que sí funcionó.',
      'Reparar la causa y volver a ejecutarlo.',
      'Comprobar que los números cuadran con los del día anterior.',
      'Dejar anotado qué pasó y cómo se arregló.',
    ]), respuestaTexto: null, respuestaOpcionId: null },
  { id: 4, posicion: 4, tipo: 'EF-4',
    enunciado: 'De estas cuatro frases, ¿cuál se parece más a ti y cuál menos?',
    situacion: null,
    opciones: opciones(40, [
      'Prefiero avisar de un riesgo temprano aunque después resulte que no era nada.',
      'Prefiero resolver primero y contar el problema ya resuelto.',
      'Cuando hay prisa, prefiero que alguien me diga exactamente qué hacer.',
      'Bajo presión trabajo mejor solo que coordinando.',
    ]), respuestaTexto: null, respuestaOpcionId: null },
]

const EVALUACION = {
  id: 7, estado: 'EN_CURSO',
  venceEn: new Date(Date.now() + 9 * 86400000).toISOString(),
  iniciadaEn: caso === 'portada' ? null : new Date(Date.now() - 3600000).toISOString(),
  terminadaEn: null, minutosObjetivo: 45,
  // `total` tiene que cuadrar con las preguntas servidas: si no, la pantalla
  // pinta su estado degradado —«llegaron 4 de las 55»— y lo que se mira no es
  // la evaluación real. Ya pasó: cuatro capturas salieron de esa pantalla.
  total: PREGUNTAS.length, respondidas: 1, preguntas: PREGUNTAS,
}

const AL_FORMATO = { examen: 0, mapa: 0, sjt: 1, sec: 2, ef: 3, ef4: 3 }

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const t of [{ nombre: 'escritorio', width: 1280, height: 900 }, { nombre: 'movil', width: 375, height: 812 }]) {
  const contexto = await navegador.newContext({
    viewport: { width: t.width, height: t.height }, locale: 'es-PE',
    storageState: { cookies: [], origins: [{ origin: PORTAL, localStorage: [{ name: 'renaser_portal_token', value: 'captura' }] }] },
  })
  await contexto.route(`**/api/v1/portal/evaluacion/${UUID}`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EVALUACION) }))
  await contexto.route('**/api/v1/portal/evaluacion/**/respuestas/**', (r) => r.fulfill({ status: 200, body: '' }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/procesos/${UUID}/evaluacion`, { waitUntil: 'networkidle' })

  if (caso in AL_FORMATO) {
    for (let i = 0; i < AL_FORMATO[caso]; i++) {
      await pagina.getByRole('button', { name: 'Siguiente', exact: true }).click()
      await pagina.waitForTimeout(150)
    }
  }
  if (caso === 'mapa') {
    await pagina.getByRole('button', { name: /^Ver las/ }).click()
    await pagina.waitForTimeout(250)
  }

  const archivo = `capturas/evaluacion-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
