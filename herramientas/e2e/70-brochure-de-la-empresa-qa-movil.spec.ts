/**
 * «El brochure de la empresa, armado solo» (specs/Ready/brochure-de-la-empresa, V86) en el
 * teléfono: el perfil público a 390×844, sin desplazamiento horizontal, con los botones bajo el
 * nombre que pasan de línea cuando no caben, «Misión y visión» una debajo de otra y el brochure
 * que se abre sin cuenta.
 *
 * ⚠️ **ESCRIBE** en el clon: empresas `QA-BROCH-08DB-*`, que retira `afterAll`.
 */

import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { pedir, type Empresa } from './ayuda-proposito-de-la-empresa'
import { perfilDe, retirarLoSembrado, sembrarEmpresa } from './ayuda-brochure'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

const EVIDENCIAS = process.env.E2E_EVIDENCIAS ?? ''
async function evidencia(page: Page, nombre: string) {
  if (EVIDENCIAS) await page.screenshot({ path: `${EVIDENCIAS}/${nombre}.png`, fullPage: true })
}

let mv: Empresa
let soloVision: Empresa

test.beforeAll(() => {
  retirarLoSembrado()
  mv = sembrarEmpresa('MOVIL-MV', 'Cafetalera Valle Alto Sociedad Anónima Cerrada QA', {
    quienes: 'Tostamos café de altura en Villa Rica desde 1987.',
    proposito: 'Que cada taza cuente la historia de quien la cultivó.',
    mision: 'Tostar café peruano con comercio justo.\nPagar a tiempo a cada productor.',
    vision: 'Ser la marca de café de especialidad más querida del Perú.',
    web: 'https://www.cafetaleravallealto-qa.pe',
  })
  soloVision = sembrarEmpresa('MOVIL-V', 'Solo Visión Móvil QA', { vision: 'Una visión sin quiénes somos.' })
})

test.afterAll(() => retirarLoSembrado())

async function sinDesplazamientoHorizontal(page: Page) {
  const medidas = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(medidas.ancho, 'sin desplazamiento horizontal').toBeLessThanOrEqual(medidas.ventana)
}

test('390×844: los botones van bajo el nombre y pasan de línea; «Misión y visión» una debajo de otra; sin desplazamiento horizontal; el brochure se abre sin cuenta', async ({ page }) => {
  await page.goto(perfilDe(mv))
  const nombre = page.getByRole('heading', { level: 1, name: mv.nombre })
  await expect(nombre).toBeVisible()
  await sinDesplazamientoHorizontal(page)

  const ver = page.getByRole('link', { name: /^Ver vacantes \(\d+\)$/ })
  const web = page.getByRole('link', { name: 'Visitar web' })
  const pdf = page.getByRole('link', { name: 'Descargar brochure (PDF)' })
  const cajaNombre = (await nombre.boundingBox())!
  const cajas = await Promise.all([ver, web, pdf].map(async (l) => (await l.boundingBox())!))
  for (const caja of cajas) {
    expect(caja.y, 'bajo el nombre').toBeGreaterThanOrEqual(cajaNombre.y + cajaNombre.height - 1)
    expect(caja.x).toBeGreaterThanOrEqual(0)
    expect(caja.x + caja.width, 'dentro de la pantalla').toBeLessThanOrEqual(390)
  }
  // Ninguno se monta sobre otro: lo que no cabe pasa a la línea siguiente.
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i]!
      const b = cajas[j]!
      const seCruzan = a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1
      expect(seCruzan, `botones ${i} y ${j} sin montarse`).toBe(false)
    }
  }

  const bloque = page.getByRole('region', { name: 'Misión y visión' })
  await bloque.scrollIntoViewIfNeeded()
  const m = (await bloque.getByRole('heading', { level: 3, name: 'Misión' }).boundingBox())!
  const v = (await bloque.getByRole('heading', { level: 3, name: 'Visión' }).boundingBox())!
  expect(v.y, 'la visión debajo de la misión').toBeGreaterThan(m.y + m.height)
  expect(Math.abs(v.x - m.x)).toBeLessThan(4)
  await evidencia(page, 'brochure-movil-perfil')

  const href = (await pdf.getAttribute('href'))!
  const peticion = page.context().waitForEvent('request', (r) => r.url().endsWith(`/${mv.codigo.toLowerCase()}/brochure`))
  const [pestana] = await Promise.all([page.waitForEvent('popup'), pdf.tap()])
  const pedida = await peticion
  expect(pedida.isNavigationRequest()).toBe(true)
  expect(pedida.frame().page()).toBe(pestana)
  await pestana.close()
  const r = await pedir(new URL(href, page.url()).toString())
  expect(r.estado).toBe(200)
  expect(r.cabeceras.get('content-type')).toContain('application/pdf')
})

test('390×844: con solo la visión y sin «Quiénes somos», el bloque se titula «Visión», no hay botón y nada se sale de la pantalla', async ({ page }) => {
  await page.goto(perfilDe(soloVision))
  await expect(page.getByRole('heading', { level: 1, name: soloVision.nombre })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Visión', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar brochure (PDF)' })).toHaveCount(0)
  await expect(page.getByText('Misión')).toHaveCount(0)
  await sinDesplazamientoHorizontal(page)
  await evidencia(page, 'brochure-movil-solo-vision')
})
