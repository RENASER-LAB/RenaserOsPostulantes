import { expect, test } from '@playwright/test'
import { abrirMasFiltros, cabecera, corte, entrarAlPanel, filasDelRanking, irAVacante, nombresVisibles, VACANTES } from './ayuda'

/** Todo lo nuevo, en 375 px. Este archivo lo corre el proyecto `movil`. */
test.describe('Móvil 375px', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('la tabla no desborda el <body>: el scroll va dentro de su envoltura', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda, 'la página entera no debe poder desplazarse en horizontal').toBe(false)

    // La tabla sí puede ser más ancha, pero dentro de un contenedor con scroll propio.
    const dentro = await page.evaluate(() => {
      const t = document.querySelector('table')
      if (!t) return null
      const env = t.parentElement!
      return {
        tabla: t.scrollWidth,
        envoltura: env.clientWidth,
        overflow: getComputedStyle(env).overflowX,
      }
    })
    expect(dentro).not.toBeNull()
    if (dentro!.tabla > dentro!.envoltura) {
      expect(['auto', 'scroll']).toContain(dentro!.overflow)
    }
  })

  test('ordenar y filtrar funcionan igual en el teléfono', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await cabecera(page, 'Pretensión').getByRole('button').click()
    await expect(cabecera(page, 'Pretensión')).toHaveAttribute('aria-sort', 'ascending')
    expect((await nombresVisibles(page)).at(-1)).toBe('Sebastián Cárdenas Rojo')

    await page.getByRole('searchbox').fill('camila')
    await expect(filasDelRanking(page)).toHaveCount(1)
    await expect(page.getByText(/Se ven 1 de 4 de este corte/)).toBeVisible()
  })

  test('el pliegue de filtros abre y los chips de ciudad se pueden pulsar', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await abrirMasFiltros(page)
    const chipLima = page.getByRole('button', { name: /^Lima — Lima/ })
    await expect(chipLima).toBeVisible()
    await chipLima.click()
    await expect(chipLima).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(1)
  })

  test('el estado vacío cabe en la celda y no se va al scroll', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await page.getByRole('searchbox').fill('zzzz')
    const parrafo = page.locator('table tbody tr td p').first()
    await expect(parrafo).toBeVisible()
    const caja = await parrafo.boundingBox()
    expect(caja!.width).toBeLessThanOrEqual(375)
  })

  test('los tres cortes siguen pulsables en 375px', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    for (const nombre of ['Está aquí ahora', 'Toda la tanda', 'Con nota del perfil']) {
      const boton = corte(page, nombre)
      await expect(boton).toBeVisible()
      await boton.click()
      await expect(boton).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('el registro con su desplegable de ciudad se rellena en el teléfono', async ({ page }) => {
    await page.goto('/registro')
    const select = page.getByLabel('Dónde vives')
    await expect(select).toBeVisible()
    await select.selectOption('1501')
    await expect(select).toHaveValue('1501')
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda).toBe(false)
  })
})
