import { expect, test } from '@playwright/test'
import { botonFiltros, corte, entrarAlPanel, filasDelRanking, panelFiltros } from './ayuda'
import { ZONA, retirarLoSembrado, sembrarTerreno, type Terreno } from './ayuda-filtros-y-seleccion'

/**
 * AC-24 en el teléfono (375 × 812, proyecto `movil`), con una tanda LARGA: la de
 * la siembra de siempre tiene cuatro filas y no llega a ser más alta que la
 * pantalla, que es justo cuando la barra fija tiene que demostrar algo.
 */

test.use({ timezoneId: ZONA })

let terreno: Terreno
test.beforeAll(() => {
  terreno = sembrarTerreno()
})
test.afterAll(() => {
  retirarLoSembrado(terreno?.correos ?? [])
})

test.describe('QA · móvil con la tanda de 32', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${terreno.tanda}`)
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
    await corte(page, 'Toda la tanda').click()
  })

  test('la hoja «Filtros» atrapa el foco, Esc la cierra devolviéndolo y la página vuelve a moverse', async ({ page }) => {
    await botonFiltros(page).click()
    const hoja = panelFiltros(page)
    await expect(hoja).toHaveAttribute('aria-modal', 'true')
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(hoja).toHaveCount(0)
    await expect(botonFiltros(page)).toBeFocused()
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })

  // AC-04 en el teléfono: el «clic fuera» de una hoja es tocar el fondo apagado.
  test('F-02 · tocar el fondo apagado cierra la hoja y devuelve el foco a «Filtros»', async ({ page }) => {
    await botonFiltros(page).click()
    const hoja = panelFiltros(page)
    await expect(hoja).toBeVisible()
    const caja = (await hoja.boundingBox())!
    expect(caja.y, 'tiene que quedar fondo a la vista por encima de la hoja').toBeGreaterThan(40)
    await page.mouse.click(187, Math.round(caja.y / 2))
    await expect(hoja).toHaveCount(0)
    await expect(botonFiltros(page)).toBeFocused()
  })

  test('con la tabla más alta que la pantalla, la barra está a la vista a media tabla y al final no tapa la última fila', async ({ page }) => {
    await expect(filasDelRanking(page)).toHaveCount(terreno.filas.length)
    for (const i of [0, 3, 6]) {
      await filasDelRanking(page).nth(i).locator('input[aria-label^="Avanza "]').check()
    }
    const barra = page.getByRole('group', { name: 'Lo marcado' })
    await filasDelRanking(page).nth(15).scrollIntoViewIfNeeded()
    await expect(barra.getByRole('button', { name: 'Avanzar a 3 personas' })).toBeInViewport()
    await expect(barra.getByRole('button', { name: 'Descartar…' })).toBeInViewport()
    for (const nombre of [/^Avanzar a/, /^Descartar…$/, /^Soltar selección$/]) {
      expect((await barra.getByRole('button', { name: nombre }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const ultima = (await filasDelRanking(page).last().boundingBox())!
    const caja = (await barra.locator('xpath=..').boundingBox())!
    expect(ultima.y + ultima.height).toBeLessThanOrEqual(caja.y + 1)
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda).toBe(false)
  })
})
