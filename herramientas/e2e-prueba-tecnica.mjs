/**
 * La prueba técnica del puesto de punta a punta, EN UN CHROME VISIBLE, contra
 * el backend local de verdad: una vacante en borrador, su ficha hasta que
 * queda COMPLETA, y —solo si se pide— el cuestionario que escribe la IA,
 * corregido y publicado.
 *
 * ⚠️ Escribe en la base a la que apunte el portal (`API_URL` de `.env.local`,
 * o el `API_URL` con el que se arrancó `npm run dev`). Nunca contra producción.
 *
 * ⚠️ **No le pide nada a la IA salvo que se diga.** Generar el cuestionario
 * cuesta una llamada a DeepSeek y cuenta contra el tope mensual de la empresa,
 * así que por defecto el recorrido para en la ficha completa y lo dice. Con
 * `DE_VERDAD=1` sigue: pide el cuestionario, espera al sondeo de la página,
 * corrige una pregunta y publica.
 *
 *   node herramientas/e2e-prueba-tecnica.mjs
 *   DE_VERDAD=1 node herramientas/e2e-prueba-tecnica.mjs
 *
 * Variables: PORTAL (http://localhost:5174), PAUSA (ms entre pasos, 700),
 * DEV_ID (id de desarrollo, andy-dev), DE_VERDAD (1 = pedir a la IA).
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const PAUSA = Number(process.env.PAUSA ?? 700)
const DEV_ID = process.env.DEV_ID ?? 'andy-dev'
const DE_VERDAD = process.env.DE_VERDAD === '1'

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 160 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const fallos = []
pagina.on('pageerror', (e) => fallos.push(`error de página · ${String(e).slice(0, 200)}`))
/**
 * Los 404 esperados: la ficha que todavía no existe (así dice el backend «no
 * hay») y el tanteo de versiones de prueba que ya documenta `e2e-vacante.mjs`.
 */
const ESPERADOS = ['/ficha', '/plantillas-prueba/versiones/']
let cuatrocientosCuatroEsperados = 0
pagina.on('response', (r) => {
  if (r.status() < 400) return
  if (r.status() === 404 && ESPERADOS.some((h) => r.url().includes(h))) {
    cuatrocientosCuatroEsperados++
    return
  }
  fallos.push(`${r.status()} · ${r.request().method()} ${r.url().replace(PORTAL, '')}`)
})
pagina.on(
  'console',
  (m) =>
    m.type() === 'error' &&
    !m.text().includes('404') &&
    fallos.push(`consola · ${m.text().slice(0, 200)}`),
)

const pasos = []
const queja = async () => (await pagina.getByRole('alert').allTextContents()).join(' · ')
const paso = async (titulo) => {
  pasos.push(titulo)
  console.log(`\n${pasos.length}. ${titulo}`)
  await pagina.waitForTimeout(PAUSA)
  await pagina.screenshot({
    path: `capturas/e2e-pt-${String(pasos.length).padStart(2, '0')}.png`,
    fullPage: true,
  })
}

// 1 · Entrar como el equipo, con el id de desarrollo (plegado en un <details>).
await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill(DEV_ID)
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 15000 })
await paso(`Entrar al panel con ${DEV_ID}`)

// 2 · Una vacante en borrador. Si ya hay alguna, se usa; si no, se crea como en
// e2e-vacante.mjs (solicitud aprobada incluida). Por índice y no por nombre:
// este recorrido también corre contra una base recién sembrada.
const marca = new Date().toISOString().slice(11, 19).replace(/:/g, '')
let titulo = null
const filaBorrador = pagina.locator('tr', { hasText: /borrador/i }).first()
if (await filaBorrador.isVisible().catch(() => false)) {
  titulo = (await filaBorrador.locator('td').first().textContent())?.trim() ?? null
  await filaBorrador.getByRole('link').first().click()
  await paso(`Abrir una vacante que ya estaba en borrador · «${titulo}»`)
} else {
  await pagina.getByRole('button', { name: 'Crear vacante' }).click()
  await pagina.waitForTimeout(1200)
  const sinSolicitud = await pagina
    .getByRole('button', { name: 'Escribir una solicitud nueva' })
    .isVisible()
    .catch(() => false)
  if (sinSolicitud) {
    await pagina.getByRole('button', { name: 'Escribir una solicitud nueva' }).click()
    await pagina.getByLabel('El resultado principal que se busca').waitFor({ timeout: 10000 })
    await pagina.getByLabel('Área que pide').selectOption({ index: 1 })
    await pagina.getByLabel('Urgencia').selectOption({ index: 0 })
    await pagina.getByLabel('El resultado principal que se busca').fill('Que la caja cuadre todos los días')
    await pagina.getByLabel('Por qué hace falta').fill('Los arqueos salen con faltantes y nadie responde por ellos.')
    await pagina.getByLabel('Qué pasa si no se contrata').fill('Seguimos perdiendo plata en caja sin saber dónde.')
    await pagina.getByLabel('Por qué el equipo actual no puede asumirlo').fill('Las dos personas de administración ya cierran a las nueve.')
    const esperados = [
      ['Arqueo diario sin faltantes', 'Faltantes por mes'],
      ['Cuadre contra sistema cada cierre', 'Cierres cuadrados por semana'],
      ['Un informe mensual de caja', 'Informe entregado cada mes'],
    ]
    for (const [i, [descripcion, indicador]] of esperados.entries()) {
      await pagina.getByLabel(`Resultado ${i + 1}`, { exact: true }).fill(descripcion)
      await pagina.getByLabel(`Cómo se medirá ${i + 1}`, { exact: true }).fill(indicador)
    }
    await pagina.getByRole('button', { name: /Crear la solicitud y aprobarla/ }).click()
    await pagina.getByLabel('Título que ve quien postula').waitFor({ timeout: 15000 })
    await paso('Solicitud creada y aprobada')
  } else {
    await pagina.getByLabel('Título que ve quien postula').waitFor({ timeout: 10000 })
  }
  titulo = `Administrador de sedes · e2e ${marca}`
  await pagina.getByLabel('Solicitud aprobada que la respalda').selectOption({ index: 1 })
  await pagina.getByLabel('Puesto del catálogo').selectOption({ index: 1 })
  await pagina.getByLabel('Responsable del proceso').selectOption({ index: 1 })
  await pagina.getByLabel('Título que ve quien postula').fill(titulo)
  await pagina.getByLabel('Descripción').fill('Llevas la caja y el personal de tres sedes.')
  await pagina.getByRole('button', { name: /Crear en borrador/ }).click()
  await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 10000 })
  await pagina.getByText(titulo).first().waitFor({ timeout: 10000 }).catch(async () => {
    throw new Error(`No se creó la vacante. La pantalla dice: ${(await queja()) || '(nada)'}`)
  })
  const fila = pagina.locator('tr', { hasText: titulo }).first()
  await fila.getByRole('link').first().click()
  await paso(`Creada en borrador y abierta · «${titulo}»`)
}

// 3 · La tarjeta de la prueba técnica, bajo «Qué responderá quien postule».
await pagina.getByRole('heading', { name: 'Qué responderá quien postule' }).waitFor({ timeout: 15000 })
const tarjeta = pagina.getByText(/Ficha: .* · Cuestionario: .*/)
await tarjeta.waitFor({ timeout: 15000 })
console.log(`   · la tarjeta dice: ${(await tarjeta.textContent())?.trim()}`)
await paso('La vacante enseña en qué va su prueba técnica')

await pagina.getByRole('link', { name: /la prueba técnica →/ }).click()
await pagina.getByRole('heading', { name: 'La prueba técnica del puesto' }).waitFor({ timeout: 15000 })
await paso('La página de la prueba técnica')

// 4 · La ficha, con las palabras del dueño. Si la vacante ya traía ficha (una
// corrida anterior), las dos comprobaciones de abajo no aplican: el riesgo 2 ya
// tiene con qué encenderse y lo escrito coincide con lo guardado.
const fichaVacia = (await pagina.getByLabel(/Riesgo 1/).inputValue()) === ''
const respuestas = {
  'Q1 · Resultado': 'Que en un año no haya ni un faltante de caja sin explicar y que las tres sedes cierren con arqueo el mismo día.',
  'Q2 · Riesgo': 'En la caja. Si no cuadra a la primera semana, ya sé que me equivoqué. Después, el personal: empiezan a faltar sin avisar.',
  'Q3 · Día real': 'Abre la sede principal a las ocho, revisa el arqueo de la noche, pasa por las otras dos sedes, atiende proveedores, cierra caja a las siete.',
  'Q4 · Época dorada': 'Rosa lo hizo bien tres años: llegaba antes que todos y no dejaba pasar un sol. El que vino después confiaba en la gente y se lo comieron.',
  'Q5 · Estructura': 'Somos cuarenta y cinco en total. Tendría a cargo a doce, los cajeros de las tres sedes; ninguno tiene gente a su cargo.',
  'Q6 · Autonomía': 'Puede decidir horarios y reemplazos, y autorizar descuentos hasta cien soles. Contratar o despedir, no.',
  'Q7 · Jefe directo': 'A mí. Soy de números y de preguntar por qué. No me funciona quien se ofende cuando le piden el detalle.',
  'Q8 · Lo incómodo': 'Se trabaja sábados y algunos domingos, y cuando falta plata en caja se queda hasta que aparece.',
  'Q9 · Requerimientos': 'Tiene que haber manejado caja con dinero físico y saber Excel para el cuadre. Deseable: haber llevado más de una sede.',
}
for (const [etiqueta, texto] of Object.entries(respuestas)) {
  await pagina.getByLabel(new RegExp(etiqueta)).fill(texto)
}
await pagina.getByLabel('Cuánta gente hay en la empresa', { exact: true }).fill('45')
await pagina.getByLabel('Cuántas personas tendrá a cargo', { exact: true }).fill('12')

// El riesgo 2 se enciende solo cuando el 1 tiene texto: se comprueba.
const riesgo2 = pagina.getByLabel('Riesgo 2', { exact: true })
if (fichaVacia && !(await riesgo2.isDisabled())) fallos.push('El riesgo 2 estaba encendido sin riesgo 1')
await pagina.getByLabel(/Riesgo 1/).fill('Faltantes de caja')
await riesgo2.fill('Personal que falta sin avisar')
await pagina.getByLabel('Riesgo 3', { exact: true }).fill('Descuentos a clientes sin autorización')
await pagina.getByLabel('Riesgo 4', { exact: true }).fill('Proveedores pagados dos veces')
await pagina.getByLabel('Eliminatoria 1', { exact: true }).fill('Haber manejado caja con dinero físico')
await pagina.getByLabel('Requerimiento 1', { exact: true }).fill('Excel para el cuadre contra sistema')
await pagina.getByLabel(/F4 Administración/).check()
await pagina.getByLabel(/F1 Mando/).check()
await paso('La ficha, rellenada con las palabras del dueño')

if (fichaVacia && !(await pagina.getByText('Hay cambios sin guardar.').isVisible())) {
  fallos.push('Con la ficha escrita y sin guardar no dice «Hay cambios sin guardar»')
}

// 5 · Guardar: el servidor la declara COMPLETA y deriva el tamaño.
await pagina.getByRole('button', { name: 'Guardar la ficha' }).click()
await pagina.getByText('Guardada.').waitFor({ timeout: 15000 }).catch(async () => {
  throw new Error(`No se guardó la ficha. La pantalla dice: ${(await queja()) || '(nada)'}`)
})
await pagina.getByText('Completa', { exact: true }).waitFor({ timeout: 5000 })
const tamano = await pagina.getByText(/el puesto es/).textContent()
console.log(`   · ${tamano?.trim()}`)
if (!/MEDIA/.test(tamano ?? '')) fallos.push(`Con 45 personas el tamaño debía ser MEDIA y la pantalla dice: ${tamano}`)
await paso('Guardada y COMPLETA: el servidor derivó el tamaño')

// 6 · Los pesos que sugiere, si hay una versión publicada para ese tamaño.
const usarPesos = pagina.getByRole('button', { name: 'Usar estos pesos' })
if (await usarPesos.isVisible().catch(() => false)) {
  await usarPesos.click()
  await pagina.getByText(/Ya rigen los pesos/).waitFor({ timeout: 15000 })
  await paso('Los pesos sugeridos quedaron asignados a la vacante')
} else if (await pagina.getByText(/Ya rigen los pesos/).isVisible().catch(() => false)) {
  console.log('   · los pesos sugeridos ya eran los de la vacante: no hay botón (correcto)')
} else {
  console.log('   · sin versión de pesos publicada para ese tamaño: no hay botón (correcto)')
}

// 7 · El cuestionario: el botón ya se ofrece porque la ficha está completa.
const pedir = pagina.getByRole('button', { name: 'Pedirle el cuestionario a la IA' })
const volverAGenerar = pagina.getByRole('button', { name: 'Volver a generar' })
const hayBoton = (await pedir.isVisible().catch(() => false)) || (await volverAGenerar.isVisible().catch(() => false))
if (!hayBoton) fallos.push('Con la ficha completa no se ofrece pedir el cuestionario')
await paso('Con la ficha completa se ofrece pedirle el cuestionario a la IA')

if (!DE_VERDAD) {
  console.log('\n   ⚠️ No se le pide nada a la IA: cuesta una llamada al modelo y cuenta contra el tope.')
  console.log('   Para seguir hasta publicar el cuestionario: DE_VERDAD=1 node herramientas/e2e-prueba-tecnica.mjs')
} else {
  // 8 · Pedirlo de verdad. Si ya había un cuestionario, se regenera (con su modal).
  if (await pedir.isVisible().catch(() => false)) {
    await pedir.click()
  } else {
    await volverAGenerar.click()
    await pagina.getByRole('button', { name: 'Sí, volver a generar' }).click()
  }
  await pagina.getByText(/La IA está redactando el cuestionario/).waitFor({ timeout: 15000 }).catch(async () => {
    throw new Error(`No arrancó la generación. La pantalla dice: ${(await queja()) || '(nada)'}`)
  })
  await paso('Pedido: la página sondea sola mientras la IA redacta')

  // La página refresca sola durante unos minutos; se espera a que aparezca
  // «Corregir» en alguna tarjeta, que solo existe con un borrador con preguntas.
  await pagina.getByRole('button', { name: 'Corregir' }).first().waitFor({ timeout: 270_000 }).catch(async () => {
    throw new Error(`En cuatro minutos y medio no llegó el borrador. La pantalla dice: ${(await queja()) || '(nada)'}`)
  })
  const cuantas = await pagina.getByRole('article').count()
  const presencial = await pagina.getByText(/no se envía al candidato/).count()
  console.log(`   · llegaron ${cuantas} preguntas, ${presencial} presencial(es)`)
  await paso(`El borrador: ${cuantas} preguntas con su guía`)

  // 9 · Corregir una con las palabras del dueño: viajan los cuatro campos.
  const primera = pagina.getByRole('article').first()
  await primera.getByRole('button', { name: 'Corregir' }).click()
  const enunciado = primera.getByLabel('Enunciado')
  const original = await enunciado.inputValue()
  await enunciado.fill(`${original} (en soles, por favor)`)
  await primera.getByRole('button', { name: 'Guardar la corrección' }).click()
  await primera.getByText(/\(en soles, por favor\)/).waitFor({ timeout: 15000 })
  await paso('Una pregunta corregida con las palabras del dueño')

  // 10 · Publicar: el acto humano.
  await pagina.getByRole('button', { name: 'Publicar el cuestionario' }).click()
  await pagina.getByText('Publicado', { exact: true }).waitFor({ timeout: 20000 }).catch(async () => {
    throw new Error(`No se publicó. La pantalla dice: ${(await queja()) || '(nada)'}`)
  })
  if (await pagina.getByRole('button', { name: 'Corregir' }).first().isVisible().catch(() => false)) {
    fallos.push('Publicado y sigue ofreciendo corregir')
  }
  await paso('Publicado: ya no se corrige, y se puede volver a generar aparte')

  // 11 · De vuelta en la vacante, la tarjeta lo cuenta.
  await pagina.getByRole('link', { name: '← Volver a la vacante' }).click()
  await pagina.getByText(/Cuestionario: publicado/).waitFor({ timeout: 15000 })
  await paso('La tarjeta de la vacante dice «Cuestionario: publicado»')
}

console.log(`\n${fallos.length === 0 ? '✓ sin errores' : `⚠️ ${fallos.length} problemas:`}`)
fallos.forEach((f) => console.log(`   ${f}`))
console.log(`   (${cuatrocientosCuatroEsperados} 404 esperados: la ficha sin empezar y el tanteo de pruebas)`)
console.log('\nEl navegador queda abierto. Ciérralo cuando termines de mirar.')
