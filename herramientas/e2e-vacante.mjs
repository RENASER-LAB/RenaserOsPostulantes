/**
 * El recorrido entero de una vacante en el panel, EN UN CHROME VISIBLE, contra
 * el backend local de verdad: crear en borrador, elegir la evaluación y la
 * prueba, y publicarla en el portal.
 *
 * Es el camino que estaba roto: publicar exige plantilla de evaluación y
 * versión de prueba, y hasta ahora no había dónde elegirlas.
 *
 * ⚠️ Escribe en la base local (renaser-postgres). Nunca contra producción.
 *
 *   node herramientas/e2e-vacante.mjs
 *
 * Con `PARAR_EN=N` se puede comprobar solo el tramo que se esta trabajando sin
 * exigir que la base temporal tenga ya publicados bancos, pruebas y pesos.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const PAUSA = Number(process.env.PAUSA ?? 900) // para que se pueda seguir con la vista
const PARAR_EN = Number(process.env.PARAR_EN ?? 0)

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 220 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const fallos = []
pagina.on('pageerror', (e) => fallos.push(`error de página · ${String(e).slice(0, 200)}`))

/**
 * Los 404 de tantear versiones de prueba son los únicos esperados: el backend
 * no deja listarlas, así que el panel prueba ids hasta encontrar el hueco.
 * Se cuentan aparte para que no tapen un 404 de verdad.
 */
const HUECO_CONOCIDO = '/plantillas-prueba/versiones/'
let huecosEsperados = 0
pagina.on('response', (r) => {
  if (r.status() < 400) return
  if (r.url().includes(HUECO_CONOCIDO)) huecosEsperados++
  else fallos.push(`${r.status()} · ${r.url().replace(PORTAL, '')}`)
})
// El texto de la consola no trae la URL, así que el 404 se juzga arriba.
pagina.on(
  'console',
  (m) =>
    m.type() === 'error' &&
    !m.text().includes('404') &&
    fallos.push(`consola · ${m.text().slice(0, 200)}`),
)

const pasos = []
/** Lo que la pantalla esté gritando ahora mismo, si es que grita. */
const queja = async () => {
  const avisos = await pagina.getByRole('alert').allTextContents()
  return avisos.join(' · ')
}

const comprobar = (condicion, queDeberia) => {
  if (!condicion) fallos.push(queDeberia)
}

const resumir = () => {
  console.log(`\n${fallos.length === 0 ? '✓ sin errores' : `⚠️ ${fallos.length} problemas:`}`)
  fallos.forEach((f) => console.log(`   ${f}`))
  console.log(`   (${huecosEsperados} 404 esperados al tantear versiones de prueba)`)
}

const paso = async (titulo) => {
  pasos.push(titulo)
  console.log(`\n${pasos.length}. ${titulo}`)
  await pagina.waitForTimeout(PAUSA)
  await pagina.screenshot({ path: `capturas/e2e-${String(pasos.length).padStart(2, '0')}.png`, fullPage: true })
  if (PARAR_EN > 0 && pasos.length >= PARAR_EN) {
    console.log(`\n⏹  PARAR_EN=${PARAR_EN}: se corta aquí sin exigir los instrumentos de publicación.`)
    resumir()
    await navegador.close()
    process.exit(fallos.length > 0 ? 1 : 0)
  }
}

// 1 · Entrar como el equipo
await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
// ⚠️ El panel entra con correo y contraseña desde la reescritura del login. La
// entrada de desarrollo sigue ahí pero **plegada**, y hay que abrirla: el campo
// no existe en el DOM accesible hasta que el `<details>` se despliega.
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill('andy-dev')
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 15000 })
await paso('Entrar al panel con andy-dev')

// 2 · Abrir el formulario de alta
await pagina.getByRole('button', { name: 'Crear vacante' }).click()
await pagina.waitForTimeout(1200)

// 2b · Si no hay solicitud aprobada, el flujo empieza antes: se escribe una.
const sinSolicitud = await pagina.getByRole('button', { name: 'Escribir una solicitud nueva' }).isVisible().catch(() => false)
if (sinSolicitud) {
  await paso('No hay solicitud aprobada: el panel lo dice y deja escribir una')
  await pagina.getByRole('button', { name: 'Escribir una solicitud nueva' }).click()
  await pagina.getByLabel('El resultado principal que se busca').waitFor({ timeout: 10000 })
  await pagina.getByRole('button', { name: 'Crear un puesto nuevo' }).click()
  await pagina.getByLabel('Nombre del puesto').fill('Analista de experiencia')
  await pagina.getByRole('radio', { name: 'Ejecución' }).check()
  await pagina.getByLabel('Familia del puesto').selectOption({ label: 'Operaciones' })
  await pagina.getByRole('button', { name: 'Guardar y elegir este puesto' }).click()

  const puestoDeLaSolicitud = pagina.getByLabel('Puesto seleccionado')
  await puestoDeLaSolicitud.waitFor({ timeout: 15000 })
  comprobar(
    (await puestoDeLaSolicitud.innerText()).includes('Analista de experiencia') &&
      (await puestoDeLaSolicitud.innerText()).includes('Ejecución · Operaciones'),
    'El puesto creado no quedó elegido con su nivel y familia en la solicitud',
  )
  await paso('El puesto nace en la solicitud: Ejecución · Operaciones')

  await pagina.getByLabel('Área que pide').selectOption({ label: 'Crecimiento' })
  await pagina.getByLabel('Urgencia').selectOption({ index: 0 })
  await pagina.getByLabel('El resultado principal que se busca').fill(
    'Que quien ya es cliente reciba respuesta el mismo día',
  )
  await pagina.getByLabel('Por qué hace falta').fill(
    'Las consultas de clientes se acumulan y hoy las atiende quien puede, entre otras tareas.',
  )
  await pagina.getByLabel('Qué pasa si no se contrata').fill(
    'Seguimos respondiendo tarde y perdiendo clientes que ya nos habían elegido.',
  )
  await pagina.getByLabel('Por qué el equipo actual no puede asumirlo').fill(
    'El equipo de Crecimiento son dos personas y ya están al límite con la captación.',
  )
  const esperados = [
    ['Responder toda consulta el mismo día', 'Horas hasta la primera respuesta'],
    ['Un informe mensual de lo que más se repite', 'Informe entregado cada mes'],
    ['Menos clientes que se van sin avisar', 'Bajas mensuales'],
  ]
  for (const [i, [descripcion, indicador]] of esperados.entries()) {
    await pagina.getByLabel(`Resultado ${i + 1}`, { exact: true }).fill(descripcion)
    await pagina.getByLabel(`Cómo se medirá ${i + 1}`, { exact: true }).fill(indicador)
  }
  await paso('La solicitud de contratación, rellenada')
  await pagina.getByRole('button', { name: /Crear la solicitud y aprobarla/ }).click()
  await pagina.getByLabel('Título que ve quien postula').waitFor({ timeout: 15000 })
  await paso('Solicitud creada y aprobada: ya se puede abrir la vacante')
} else {
  await pagina.getByLabel('Título que ve quien postula').waitFor({ timeout: 10000 })
  await paso('Abrir el formulario de alta')
}

// 3 · Rellenarlo. El puesto manda: su nivel decide qué evaluación vale.
const marca = new Date().toISOString().slice(11, 19).replace(/:/g, '')
const titulo = `Analista de experiencia · e2e ${marca}`
await pagina.getByLabel('Solicitud aprobada que la respalda').selectOption({ index: 1 })
const puestoHeredado = pagina.getByLabel('Puesto seleccionado')
await puestoHeredado.waitFor({ timeout: 10000 })
comprobar(
  (await puestoHeredado.innerText()).includes('Analista de experiencia') &&
    (await puestoHeredado.innerText()).includes('Ejecución · Operaciones'),
  'La vacante no enseña el puesto heredado de la solicitud',
)
comprobar(
  (await pagina.getByLabel('Puesto del catálogo').count()) === 0,
  'La vacante moderna todavía deja escoger otro puesto',
)
await pagina.getByLabel('Responsable del proceso').selectOption({ index: 1 })
await pagina.getByLabel('Título que ve quien postula').fill(titulo)
await pagina.getByLabel('Descripción').fill(
  'Acompañas a quien ya es cliente: resuelves sus dudas, detectas lo que se repite y lo llevas al equipo que puede arreglarlo.',
)
await pagina.getByLabel('Modalidad (Presencial, Híbrido…)').fill('Híbrido')
await pagina.getByLabel('Horario').fill('Lunes a viernes, 9:00 a 18:00')
await pagina.getByLabel('Ubicación').fill('San Isidro, Lima')
await paso(`Rellenar el alta · «${titulo}»`)

// 4 · Crear en borrador
await pagina.getByRole('button', { name: /Crear en borrador/ }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 10000 })
await pagina.getByText(titulo).first().waitFor({ timeout: 10000 }).catch(async () => {
  throw new Error(`No se creó la vacante. La pantalla dice: ${(await queja()) || '(nada)'}`)
})
await paso('Creada en borrador: ya está en la lista')

// 5 · Entrar a la vacante recién creada
const fila = pagina.locator('tr', { hasText: titulo }).first()
await fila.getByRole('link').first().click()
await pagina.getByRole('heading', { name: 'Qué responderá quien postule' }).waitFor({ timeout: 15000 })
await paso('El detalle de la vacante, todavía sin configurar')

// 6 · Lo que el backend exige antes de publicar
const publicar = pagina.getByRole('button', { name: /Publicar en el portal/ })
const bloqueado = await publicar.isDisabled()
console.log(`   · el botón de publicar está ${bloqueado ? 'apagado, y dice qué falta' : '⚠️ ENCENDIDO sin configurar'}`)
if (!bloqueado) fallos.push('El botón de publicar no espera a que se elija evaluación y prueba')

// 7 · El interruptor del banco: apagarlo y volver a encenderlo. Se prueba
// aquí porque es el único de los cuatro ajustes que cambia lo que se pide.
// La casilla la manda el servidor, no el navegador: no se marca sola al
// pulsarla, cambia cuando el backend lo confirma. Por eso se espera al texto.
// ⚠️ Nombrada, no `getByRole('checkbox')` a secas: el ranking por etapas trajo
// a esta misma pantalla la casilla «Ver la tanda entera» —y una por fila del
// ranking—, así que el selector anónimo se rompe por ambigüedad.
const interruptor = pagina.getByRole('checkbox', { name: /La evaluación del banco/ })
await interruptor.click()
await pagina.getByText(/Apagada: la prueba del puesto/).waitFor({ timeout: 15000 })
await paso('Evaluación del banco apagada: ya no pide elegir cuál')
await interruptor.click()
await pagina.getByText(/Encendida: responderá el cuestionario/).waitFor({ timeout: 15000 })

// 8 · La evaluación ya no se elige: se dice qué banco le toca por su nivel
//
// ⚠️ Aquí había un `selectOption` sobre «Qué evaluación responderá». Ese
// desplegable ya no existe: la plantilla tenía una sola respuesta legal —una
// publicada por nivel— y desde que se retiraron las cuotas tampoco decide qué
// preguntas caen. Ahora es una línea que nombra el banco del nivel.
const laEvaluacion = pagina.locator('div').filter({
  hasText: /^Qué evaluación responderá/,
})
if ((await laEvaluacion.count()) > 0) {
  console.log(`   · ${(await laEvaluacion.first().innerText()).replace(/\n/g, ' · ')}`)
} else {
  console.log('   ⚠ no aparece la línea del banco: mírala antes de seguir')
}
await paso('El banco del nivel, dicho y no preguntado')

// 9 · Elegir la prueba del puesto
const selPrueba = pagina.getByLabel('Qué prueba del puesto rendirá')
// Un <option> nunca es "visible": se espera a que haya alguno, no a verlo.
await pagina.waitForFunction(
  () => {
    const sel = [...document.querySelectorAll('select')].find((s) =>
      s.closest('label')?.textContent?.includes('Qué prueba del puesto'))
    return (sel?.options.length ?? 0) > 1
  },
  { timeout: 30000 },
)
const opcionesPrueba = await selPrueba.locator('option:not([value=""])').allTextContents()
console.log(`   · pruebas ofrecidas: ${opcionesPrueba.join(' | ') || '(ninguna)'}`)
await selPrueba.selectOption({ index: 1 })
await pagina.waitForTimeout(1200)
await paso('Elegida la prueba del puesto')

// 10 · Los pesos que rigen la decisión
const selPesos = pagina.getByLabel('Qué pesos rigen la decisión')
const pesos = await selPesos.locator('option:not([value=""])').allTextContents()
console.log(`   · pesos ofrecidos: ${pesos.length}`)
await selPesos.selectOption({ index: 1 })
await pagina.waitForTimeout(1200)
await paso('Elegida la versión de pesos')

// 11 · Ahora sí: publicar
await pagina.getByText('Todo listo: ya se puede publicar.').waitFor({ timeout: 10000 })
await publicar.click()
await pagina.getByText(/Publicada el/).waitFor({ timeout: 15000 })
await paso('Publicada: ya la ve quien postula')

// 12 · Y comprobarlo desde el lado del candidato
await pagina.goto(`${PORTAL}/`, { waitUntil: 'domcontentloaded' })
await pagina.getByText(titulo).first().waitFor({ timeout: 15000 })
await paso('La misma vacante, ya en la portada del portal')

// 13 · Recoger. Una vacante publicada la ve todo el que entre al portal, y
// no hay forma de borrarla: lo más cerca que se puede dejar es cerrada.
await pagina.goBack({ waitUntil: 'domcontentloaded' })
await pagina.getByRole('heading', { name: 'Qué responderá quien postule' }).waitFor({ timeout: 15000 })
await pagina.getByPlaceholder('Motivo del cierre').fill('Limpieza: la dejó el e2e')
await pagina.getByRole('button', { name: 'Cerrar vacante' }).click()
await pagina.getByText(/^Cerrada/).waitFor({ timeout: 15000 })
await paso('Cerrada: el e2e no deja vacantes sueltas en el portal')

resumir()
console.log('\nEl navegador queda abierto. Ciérralo cuando termines de mirar.')
