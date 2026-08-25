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
await pagina.getByLabel('Tu identificador de RENASER OS').fill('andy-dev')
await pagina.getByRole('button', { name: 'Entrar al panel' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 15000 })
await paso('Entrar al panel')

// 2 · La vacante con más gente: Administrador
await pagina.locator('tr', { hasText: 'Administrador' }).getByRole('link').click()
await pagina.getByRole('heading', { name: 'El ranking, etapa por etapa' }).waitFor({ timeout: 15000 })
await pagina.getByRole('tab', { name: 'Perfil integral' }).waitFor()
await paso('El ranking abre en Perfil integral')

// 3 · Recorrer las cinco pestañas y anotar la primera nota de cada una
for (const etapa of ['Prueba del puesto', 'Simulación', 'Validación', 'Decisión', 'Perfil integral']) {
  await pagina.getByRole('tab', { name: etapa }).click()
  await pagina.waitForTimeout(1100)
  const primera = await pagina.locator('tbody tr td:nth-child(4)').first().textContent().catch(() => '—')
  console.log(`   · ${etapa}: primera nota ${primera?.trim()}`)
  if (etapa === 'Prueba del puesto') await paso('La pestaña de la prueba, con su nota')
}
await paso('De vuelta en Perfil integral')

// 4 · El filtro de «aquí ahora»
const antes = await pagina.locator('tbody tr').count()
await pagina.getByLabel(/Solo quienes están aquí ahora/).check()
await pagina.waitForTimeout(700)
const despues = await pagina.locator('tbody tr').count()
console.log(`   · filas: ${antes} → ${despues} con el filtro`)
await paso('El filtro deja solo a quienes están en la etapa hoy')
await pagina.getByLabel(/Solo quienes están aquí ahora/).uncheck()

// 5 · La ficha del perfil integral: las dos tablas
await pagina.locator('tbody tr').first().click()
await pagina.getByRole('heading', { name: 'La evaluación del banco' }).waitFor({ timeout: 15000 })
await pagina.getByRole('heading', { name: 'Lo que calificó la IA' }).waitFor()
await paso('La ficha: el CV criterio a criterio y la evaluación del banco')

// 6 · La misma ficha en la pestaña de la prueba
await pagina.getByRole('tab', { name: 'Prueba del puesto' }).click()
await pagina.waitForTimeout(1100)
await pagina.locator('tbody tr').first().click()
await pagina.getByRole('heading', { name: /La prueba del puesto, criterio a criterio/ }).waitFor({ timeout: 15000 })
await paso('La ficha de la prueba: su rúbrica, no el CV')

// 7 · El viaje de ana-lopez: nota en las cuatro etapas
await pagina.goto(`${PORTAL}/admin/vacantes/3`, { waitUntil: 'domcontentloaded' })
await pagina.getByRole('heading', { name: 'El ranking, etapa por etapa' }).waitFor({ timeout: 15000 })
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

// 9 · Decisión con el filtro: solo quien está ahí hoy
await pagina.getByRole('tab', { name: 'Decisión' }).click()
await pagina.getByLabel(/Solo quienes están aquí ahora/).check()
await pagina.waitForTimeout(800)
const enDecision = await pagina.locator('tbody tr').count()
console.log(`   · en Decisión ahora: ${enDecision} fila(s)`)
await paso('El filtro en Decisión: solo ana-lopez')
await pagina.getByLabel(/Solo quienes están aquí ahora/).uncheck()

// 10 · La siembra: la evaluación del banco abierta por dentro
await pagina.getByRole('tab', { name: 'Perfil integral' }).click()
await pagina.waitForTimeout(900)
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
