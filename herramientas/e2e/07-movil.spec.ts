import { expect, test } from '@playwright/test'
import {
  abrirFiltros,
  botonFiltros,
  cabecera,
  corte,
  entrarAlPanel,
  filasDelRanking,
  irAVacante,
  nombresVisibles,
  panelFiltros,
  VACANTES,
} from './ayuda'

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
    // Lo que se mide aquí es el orden y el filtro, no el corte: hace falta la
    // tanda entera para tener las cuatro filas con las que trabajar.
    await corte(page, 'Toda la tanda').click()
    await cabecera(page, 'Pretensión').getByRole('button').click()
    await expect(cabecera(page, 'Pretensión')).toHaveAttribute('aria-sort', 'ascending')
    expect((await nombresVisibles(page)).at(-1)).toBe('Sebastián Cárdenas Rojo')

    await page.getByRole('searchbox').fill('camila')
    await expect(filasDelRanking(page)).toHaveCount(1)
    await expect(page.getByText(/Se ven 1 de 4 de este corte/)).toBeVisible()
  })

  test('el pliegue de filtros abre y los chips de ciudad se pueden pulsar', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await abrirFiltros(page)
    const chipLima = page.getByRole('button', { name: /^Lima — Lima/ })
    await expect(chipLima).toBeVisible()
    await chipLima.click()
    await expect(chipLima).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(1)
  })

  // AC-24: en el teléfono, «Filtros» es una hoja modal a lo ancho.
  test('«Filtros» sube como una hoja modal a todo el ancho', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    const hoja = panelFiltros(page)
    await expect(hoja).toHaveAttribute('aria-modal', 'true')
    const caja = await hoja.boundingBox()
    expect(caja!.width).toBeGreaterThanOrEqual(370)
    // Pegada abajo: su borde inferior es el de la ventana.
    expect(Math.round(caja!.y + caja!.height)).toBeGreaterThanOrEqual(810)
    // El pie con la cuenta y el botón de borrar, siempre a mano.
    await expect(hoja.getByText(/^Se ven \d+ de \d+$/)).toBeVisible()
    await expect(hoja.getByRole('button', { name: 'Borrar filtros' })).toBeVisible()

    await hoja.getByRole('button', { name: /^Lima — Lima/ }).click()
    await hoja.getByRole('button', { name: 'Listo' }).click()
    await expect(hoja).toHaveCount(0)
    await expect(botonFiltros(page)).toContainText('1')
    await expect(filasDelRanking(page)).toHaveCount(1)
  })

  /*
    La hoja es modal: el foco no sale de ella sin cerrarla. Ni al tocar un texto
    suyo —el ranking de detrás es enfocable y la envuelve— ni al pulsar
    «Borrar filtros» del pie, que se apaga al pulsarlo (F-06).
  */
  test('tocar un texto de la hoja o «Borrar filtros» de su pie no saca el foco de ella', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    const hoja = panelFiltros(page)
    const enLaHoja = () =>
      page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-label="Filtros"]'))

    await hoja.getByRole('button', { name: /^Lima — Lima/ }).click()
    await hoja.getByText(/^Se ven \d+ de \d+$/).click()
    expect(await enLaHoja()).toBe(true)
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await enLaHoja()).toBe(true)
    }
    await expect(hoja).toBeVisible()

    const borrar = hoja.getByRole('button', { name: 'Borrar filtros' })
    await borrar.focus()
    await page.keyboard.press('Enter')
    await expect(filasDelRanking(page)).toHaveCount(4)
    await expect(borrar).toBeFocused()
    await expect(hoja).toBeVisible()
  })

  test('«Columnas» y las acciones de la tanda van dentro de «Más»', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await expect(page.getByRole('button', { name: /Descargar Excel|Nada que descargar/ })).toBeHidden()
    await expect(page.getByText('Columnas', { exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Más', exact: true }).click()
    await expect(page.getByRole('button', { name: /Descargar Excel|Nada que descargar/ })).toBeVisible()
    await expect(page.getByText('Columnas', { exact: true })).toBeVisible()
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda).toBe(false)
  })

  // AC-24: la barra de lo marcado no tapa la última fila y se pulsa con el pulgar.
  test('la barra de lo marcado no tapa la última fila, y sus botones miden 44 px', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await filasDelRanking(page).first().locator('input[aria-label^="Avanza "]').check()
    const barra = page.getByRole('group', { name: 'Lo marcado' })
    await expect(barra).toBeVisible()

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const ultima = await filasDelRanking(page).last().boundingBox()
    const suCaja = await barra.boundingBox()
    expect(ultima!.y + ultima!.height).toBeLessThanOrEqual(suCaja!.y + 1)

    for (const nombre of [/^Avanzar a/, /^Descartar…$/, /^Soltar selección$/]) {
      const boton = barra.getByRole('button', { name: nombre })
      if ((await boton.count()) === 0) continue
      expect((await boton.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda).toBe(false)
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
    for (const nombre of ['Le toca al candidato', 'Toda la tanda', 'Pendiente']) {
      const boton = corte(page, nombre)
      await expect(boton).toBeVisible()
      await boton.click()
      await expect(boton).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('el registro con su desplegable de ciudad se rellena en el teléfono', async ({ page }) => {
    await page.goto('/registro')
    const select = page.getByLabel('Ciudad')
    await expect(select).toBeVisible()
    await select.selectOption('1501')
    await expect(select).toHaveValue('1501')
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda).toBe(false)
  })
})
