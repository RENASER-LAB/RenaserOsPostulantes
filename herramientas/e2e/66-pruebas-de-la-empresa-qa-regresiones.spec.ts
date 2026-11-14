/**
 * «Pruebas» (specs/pruebas-indice-de-la-empresa): las regresiones de los hallazgos de la
 * exploración de la QA (ciclo 0), contra el preview real.
 *
 *   - QA-PI-01: el resumen de la prueba («1 criterio · 0 preguntas · 1 entregable · Sin
 *     cronómetro») no parte línea y se sale de su celda: queda debajo de los botones y cortado
 *     por el borde de la tabla o de la tarjeta. La spec dice que los resúmenes no se cortan.
 *   - QA-PI-02: en la hoja (641–1279 px) y a pantalla completa, abrir una fila con Enter no lleva
 *     el foco a la vista previa y cerrarla con Escape lo deja en el `body`, no en su fila.
 *   - QA-PI-03: la línea de búsqueda pierde letras si se teclea rápido: el campo vive en la
 *     dirección y cada pulsación lo repinta con el valor de antes.
 *   - QA-PI-04 (ciclo 1): «Usar en otra vacante» desde la fila de una vacante que ya se miró y
 *     se cerró despliega el bloque de copia sin el foco en su buscador (queda en el `body`).
 *   - QA-PI-05 (ciclo 1): tras mirar una prueba, el enlace «Pruebas» del menú pide la vista
 *     previa de esa vacante en la pestaña de preguntas (404) y la toma por eliminada.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo: vacantes con la marca `QA-PE-0067` y un código propio
 * de la corrida. Las retira `retirarLoSembrado` de `ayuda-prueba-propia`.
 */

import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel, tokenDelPanel } from './ayuda'
import { escribirBorrador, publicarPreguntas } from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, publicarPrueba, retirarLoSembrado } from './ayuda-prueba-propia'

// Sin «serial»: cada regresión se informa por su cuenta aunque otra falle (el sembrado se repite
// en el worker nuevo y lo retira el afterAll de cada uno).

const CODIGO = `Regresion QA ${Math.random().toString(36).slice(2, 7)}`
let conPreguntas = 0
let soloEntregables = 0

const linea = (page: Page) => page.getByRole('searchbox', { name: 'Buscar vacante o filtrar' })
const ver = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^Ver .*${CODIGO} ${nombre}`) })

test.beforeAll(async () => {
  const token = await tokenDelPanel()
  const lugar = await lugarDe(token, 'EJECUCION')
  conPreguntas = await crearVacante(token, `${CODIGO} Contador`, lugar)
  await escribirBorrador(token, conPreguntas, [
    { nombre: 'Rigor', preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo cuadras la caja?', puntos: 100, queDebeTener: 'El arqueo' }] },
  ])
  await publicarPreguntas(token, conPreguntas)

  // Publicada solo con entregables y sin cronómetro: el resumen más largo de la pestaña.
  soloEntregables = await crearVacante(token, `${CODIGO} Redactor`, lugar)
  await escribirPrueba(token, soloEntregables, {
    datos: { modalidad: 'PLAZO_ABIERTO' },
    criterios: [{ nombre: 'Calidad del texto', puntos: 100, calificador: 'IA', preguntas: [] }],
    entregables: [{ nombre: 'Artículo de 800 palabras', formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true }],
  })
  const publicada = await publicarPrueba(token, soloEntregables)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba falló: ${publicada.estado}`)
  // Unos destinos más para que la lista de la copia no quepa en la pantalla del teléfono.
  for (const n of [1, 2, 3, 4]) await crearVacante(token, `${CODIGO} Destino ${n}`, lugar)
})

test.afterAll(() => {
  retirarLoSembrado([])
})

for (const { ancho, como } of [
  { ancho: 1440, como: 'con la columna de filtros' },
  { ancho: 1300, como: 'con la tabla ancha' },
  { ancho: 375, como: 'en el teléfono' },
]) {
  test(`QA-PI-01 · ${ancho} px, ${como}: el resumen de la prueba no se sale de su celda`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await entrarAlPanel(page)
    await page.goto(`/admin/pruebas?tipo=prueba&buscar=${encodeURIComponent(CODIGO)}`)
    const fila = page.locator('tr', { has: ver(page, 'Redactor') })
    const resumen = fila.locator('td[class*="cResumen"]')
    await expect(resumen).toContainText('1 criterio · 0 preguntas · 1 entregable · Sin cronómetro')
    const medida = await resumen.evaluate((td) => ({ scroll: td.scrollWidth, visible: td.clientWidth }))
    expect(medida.scroll, `el resumen mide ${medida.scroll} px y su celda ${medida.visible} px`).toBeLessThanOrEqual(medida.visible + 1)
  })
}

for (const ancho of [900, 375]) {
  test(`QA-PI-02 · ${ancho} px: Enter abre la vista previa con el foco dentro y Escape lo devuelve a su fila`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await entrarAlPanel(page)
    await page.goto(`/admin/pruebas?tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`)
    await expect(ver(page, 'Contador')).toBeVisible()
    await linea(page).focus()
    await page.keyboard.press('ArrowDown')
    await expect(ver(page, 'Contador')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`vacante=${conPreguntas}`))
    await expect(page.getByRole('dialog').getByText('Rigor')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.querySelector('#lectura')?.contains(document.activeElement) ?? false), {
        message: 'el foco debe estar dentro de la vista previa modal',
      })
      .toBe(true)
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/vacante=/)
    await expect(ver(page, 'Contador')).toBeFocused()
  })
}

test('QA-PI-03 · la línea de búsqueda no pierde letras al teclear rápido', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto('/admin/pruebas?tipo=preguntas')
  await expect(page.getByRole('button', { name: /^Ver / }).first()).toBeVisible()
  await linea(page).click()
  const texto = `${CODIGO} Contador`
  await page.keyboard.type(texto)
  await expect(linea(page)).toHaveValue(texto)
  await expect(page).toHaveURL(new RegExp(`buscar=${encodeURIComponent(texto).replace(/%20/g, '(\\+|%20)')}`))
  await expect(ver(page, 'Contador')).toBeVisible()
})

// ---------- Ciclo 1 de la QA ----------

const usarEnOtra = (page: Page, nombre: string) =>
  page.getByRole('button', { name: new RegExp(`^Usar «.*${CODIGO} ${nombre}.*» en otra vacante$`) })

for (const ancho of [1440, 900, 375]) {
  test(`QA-PI-04 · ${ancho} px: «Usar en otra vacante» de una fila ya vista abre el bloque con el foco en su buscador`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await entrarAlPanel(page)
    await page.goto(`/admin/pruebas?tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`)
    await expect(ver(page, 'Contador')).toBeVisible()
    // Mirarla primero y cerrarla: es lo que deja la vacante como «la última abierta».
    await ver(page, 'Contador').focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`vacante=${conPreguntas}`))
    await expect(page.locator('#lectura').getByText('Rigor')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/vacante=/)
    // La dirección cambia antes de pintarse: el foco de vuelta en su fila dice que la lista ya responde.
    await expect(ver(page, 'Contador')).toBeFocused()
    await usarEnOtra(page, 'Contador').focus()
    await expect(usarEnOtra(page, 'Contador')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`vacante=${conPreguntas}`))
    const buscadorDelBloque = page.locator('#bloque-de-copia').getByPlaceholder('Buscar vacante…')
    await expect(buscadorDelBloque).toBeVisible()
    await expect(buscadorDelBloque).toBeFocused()
  })
}

// ---------- Ciclo 2 de la QA ----------

for (const ancho of [1440, 900, 375]) {
  test(`QA-PI-06 · ${ancho} px: «Cancelar» del bloque de copia lo pliega y deja el foco en «Usar en otra vacante»`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await entrarAlPanel(page)
    await page.goto(`/admin/pruebas?tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`)
    await usarEnOtra(page, 'Contador').focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`vacante=${conPreguntas}`))
    const bloque = page.locator('#bloque-de-copia')
    await expect(bloque.getByPlaceholder('Buscar vacante…')).toBeFocused()
    await bloque.getByRole('button', { name: 'Cancelar' }).focus()
    await page.keyboard.press('Enter')
    await expect(bloque).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`vacante=${conPreguntas}`))
    // Como Escape (y como la maqueta): el foco vuelve al botón que despliega el bloque.
    await expect(page.locator('#lectura [aria-controls="bloque-de-copia"]')).toBeFocused()
  })
}

test('QA-PI-05 · el enlace «Pruebas» del menú no pide la vista previa de la última vacante en la otra pestaña', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrarAlPanel(page)
  await page.goto(`/admin/pruebas?tipo=prueba&buscar=${encodeURIComponent(CODIGO)}`)
  await ver(page, 'Redactor').click()
  await expect(page).toHaveURL(new RegExp(`vacante=${soloEntregables}`))
  await expect(page.locator('#lectura').getByText('Artículo de 800 palabras')).toBeVisible()
  const pedidas: string[] = []
  page.on('request', (r) => {
    if (r.url().includes(`/panel/pruebas/${soloEntregables}?`)) pedidas.push(r.url())
  })
  await page.getByRole('navigation').getByRole('link', { name: /^Pruebas/ }).first().click()
  await expect(page).toHaveURL(/\/admin\/pruebas$/)
  await expect(page.getByRole('tab', { name: /Preguntas del Perfil Integral/, selected: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Ver / }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(pedidas, 'nadie abrió una vista previa: no hay nada que pedir').toEqual([])
})
