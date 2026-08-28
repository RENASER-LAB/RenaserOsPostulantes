/**
 * El ranking por etapas, recorrido EN UN CHROME VISIBLE contra el backend
 * local: las cinco pestañas, el filtro de «aquí ahora», y la ficha que cambia
 * con la etapa — las dos tablas del perfil integral incluidas.
 *
 * ⚠️ Solo lee. Necesita el portal en PORTAL y su backend detrás.
 *
 *   PORTAL=http://localhost:5175 node herramientas/e2e-etapas.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5175'
const PAUSA = Number(process.env.PAUSA ?? 900)

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 200 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const fallos = []
pagina.on('pageerror', (e) => fallos.push(`error de página · ${String(e).slice(0, 200)}`))
pagina.on('response', (r) => {
  // Los 404 de validación y prueba sin datos son esperados: la ficha los traduce.
  // Y el tanteo de versiones de prueba: el backend no deja listarlas.
  const esperado =
    r.url().includes('/validacion') || r.url().includes('/prueba/notas') ||
    r.url().includes('/simulacion/notas') ||
    r.url().includes('/plantillas-prueba/versiones/')
  if (r.status() >= 400 && r.status() !== 401 && !esperado)
    fallos.push(`${r.status()} · ${r.url().replace(PORTAL, '')}`)
})

const pasos = []
const paso = async (titulo) => {
  pasos.push(titulo)
  console.log(`\n${pasos.length}. ${titulo}`)
  await pagina.waitForTimeout(PAUSA)
  await pagina.screenshot({ path: `capturas/etapas-${String(pasos.length).padStart(2, '0')}.png`, fullPage: true })
}

// 1 · Entrar
await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
// ⚠️ El panel entra con correo y contraseña desde la reescritura del login. La
// entrada de desarrollo sigue ahí pero **plegada**, y hay que abrirla: el campo
// no existe en el DOM accesible hasta que el `<details>` se despliega. Antes
// esto era el formulario principal, y por eso este bloque se quedó obsoleto.
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill('andy-dev')
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 15000 })
await paso('Entrar al panel')

// 2 · La vacante con más gente: Administrador
await pagina.locator('tr', { hasText: 'Administrador' }).getByRole('link').click()
await pagina.getByRole('heading', { name: 'El ranking, etapa por etapa' }).waitFor({ timeout: 15000 })
await pagina.getByRole('tab', { name: 'Perfil integral' }).waitFor()
await paso('El ranking abre en Perfil integral')

/*
 * ⚠️ **El ranking abre por un corte, no por la tanda entera.** Desde el 28/08
 * son tres cortes del mismo listado —«Con nota de esta etapa» por defecto,
 * «Está aquí ahora» y «Toda la tanda»— asi que una tabla corta es lo normal y
 * no un fallo. Para lo que necesita ver a alguien concreto —el viaje de
 * ana-lopez por cuatro etapas, o abrir una ficha— hay que pedir la tanda
 * entera antes.
 *
 * ⚠️ El corte «con nota» lleva el nombre de la etapa dentro («Con nota de la
 * prueba»), asi que se busca por lo que empieza y no por el texto entero.
 */
const verCorte = async (cual) => {
  await pagina
    .getByRole('group', { name: 'Qué filas se ven' })
    .getByRole('button')
    .filter({ hasText: cual })
    .first()
    .click()
  await pagina.waitForTimeout(700)
}

const verTandaEntera = (encendido) => verCorte(encendido ? /^Toda la tanda/ : /^Está aquí ahora/)

/*
 * ⚠️ **La celda de la nota ya no es solo la cifra.** Desde el 28/08 lleva
 * dentro un `<span>` que dice por que esta vacia, asi que un `textContent` de
 * la celda devuelve «—Todavía no llega a esta etapa». Se lee el primer nodo de
 * texto, que es la cifra o su guion.
 */
const laNotaDe = async (celda) =>
  (await celda.evaluate((td) => td.childNodes[0]?.textContent ?? '').catch(() => '—')).trim()

// 3 · Recorrer las cinco pestañas y anotar la primera nota de cada una.
// Con la tanda entera: lo que se mira aqui es que la NOTA cambie de etapa, y
// una tabla filtrada a cero no tiene ninguna nota que enseñar.
await verTandaEntera(true)
for (const etapa of ['Prueba del puesto', 'Simulación', 'Validación', 'Decisión', 'Perfil integral']) {
  await pagina.getByRole('tab', { name: etapa }).click()
  await pagina.waitForTimeout(1100)
  const primera = await laNotaDe(pagina.locator('tbody tr td:nth-child(4)').first())
  console.log(`   · ${etapa}: primera nota ${primera}`)
  if (etapa === 'Prueba del puesto') await paso('La pestaña de la prueba, con su nota')
}
await paso('De vuelta en Perfil integral')

// 4 · Cuanto esconde el corte: la tanda entera contra quien esta parado aqui
const enLaTanda = await pagina.locator('tbody tr').count()
await verTandaEntera(false)
const enLaEtapa = await pagina.locator('tbody tr').count()
console.log(`   · filas: ${enLaTanda} en la tanda → ${enLaEtapa} parados en el perfil`)
if (enLaEtapa > enLaTanda) fallos.push('El filtro por etapa enseña MÁS filas que la tanda entera')
await paso('Perfil integral enseña solo a quien está ahí hoy')

// 5 · La ficha del perfil integral: las dos tablas.
// ⚠️ Con la tanda entera puesta: quien tiene la evaluacion del banco hecha
// puede haber avanzado de etapa, y entonces no esta en esta pestaña.
await verTandaEntera(true)
await pagina.locator('tbody tr').first().click()
await pagina.getByRole('heading', { name: 'La evaluación del banco' }).waitFor({ timeout: 15000 })
await pagina.getByRole('heading', { name: 'Lo que calificó la IA' }).waitFor()
await paso('La ficha: el CV criterio a criterio y la evaluación del banco')

// 6 · La misma ficha en la pestaña de la prueba. Tambien con la tanda entera:
// en la base local no siempre hay alguien PARADO en la prueba, y lo que se
// mira aqui es que la ficha cambie de contenido con la pestaña.
await pagina.getByRole('tab', { name: 'Prueba del puesto' }).click()
await pagina.waitForTimeout(1100)
await pagina.locator('tbody tr').first().click()
await pagina.getByRole('heading', { name: /La prueba del puesto, criterio a criterio/ }).waitFor({ timeout: 15000 })
await paso('La ficha de la prueba: su rúbrica, no el CV')

// 7 · El viaje de ana-lopez: nota en las cuatro etapas
await pagina.goto(`${PORTAL}/admin/vacantes/3`, { waitUntil: 'domcontentloaded' })
await pagina.getByRole('heading', { name: 'El ranking, etapa por etapa' }).waitFor({ timeout: 15000 })
// ⚠️ Ana esta parada en UNA etapa: sin la tanda entera, en las otras tres no
// aparece. Que sus notas viejas sigan ahi es justamente lo que se comprueba.
await verTandaEntera(true)
for (const [etapa, celda] of [
  ['Prueba del puesto', '73.8'],
  ['Simulación', '72.8'],
  ['Validación', '73.2'],
]) {
  await pagina.getByRole('tab', { name: etapa }).click()
  await pagina.locator('tbody tr', { hasText: 'ana-lopez' }).getByText(celda).waitFor({ timeout: 15000 })
  console.log(`   · ${etapa}: ana-lopez con ${celda}`)
}
await paso('ana-lopez tiene nota en prueba, simulación y validación')

// 8 · Su ficha en Validación: el periodo y las métricas con su porqué
await pagina.locator('tbody tr', { hasText: 'ana-lopez' }).first().click()
await pagina.getByRole('heading', { name: 'El periodo de validación' }).waitFor({ timeout: 15000 })
await pagina.getByRole('heading', { name: 'Las métricas del periodo' }).waitFor()
await paso('El periodo de validación: 15 días y las métricas explicadas')

// 9 · Decisión, sin el escape: solo quien está ahí hoy
await pagina.getByRole('tab', { name: 'Decisión' }).click()
await verTandaEntera(false)
const enDecision = await pagina.locator('tbody tr').count()
console.log(`   · en Decisión ahora: ${enDecision} fila(s)`)
await paso('Decisión enseña a quien está ahí hoy, y nada más')

// 10 · La siembra: la evaluación del banco abierta por dentro
await pagina.getByRole('tab', { name: 'Perfil integral' }).click()
await pagina.waitForTimeout(900)
// La siembra puede haber avanzado de etapa: se la busca en la tanda entera.
await verTandaEntera(true)
await pagina.locator('tr', { hasText: 'Siembra' }).first().click()
await pagina.getByRole('heading', { name: 'La evaluación del banco' }).waitFor({ timeout: 15000 })
await pagina.getByText(/cerradas promedian/).waitFor()
// Si la IA ya calificó, cada abierta trae su nota y su evidencia; si aún
// no, se dice cuántas esperan. Ambas son pantallas honestas.
const pendientes = await pagina.getByText(/esperan calificación|espera calificación/).count()
const conNota = await pagina.locator('td', { hasText: '/4' }).count()
console.log(`   · abiertas con nota: ${conNota} · aviso de pendientes: ${pendientes > 0 ? 'sí' : 'no'}`)
await paso('La siembra: la evaluación del banco, abierta por dentro')

console.log(`\n${fallos.length === 0 ? '✓ sin errores' : `⚠️ ${fallos.length} problemas:`}`)
fallos.forEach((f) => console.log(`   ${f}`))
console.log('\nEl navegador queda abierto. Ciérralo cuando termines de mirar.')
