import { expect, type Page } from '@playwright/test'

import { test } from './ayuda-candidato'
import {
  devolverLasEscondidas,
  esconderLasDemas,
  muro,
  retirarLoSembrado,
  sembrar,
} from './ayuda-buscar-vacantes'
import { limpiarSiempre } from './base-de-datos'

/**
 * Buscar vacantes en un teléfono de 375 px (AC-19), con el juego «muro» de
 * cuarenta publicadas: sin scroll horizontal, los filtros plegados tras
 * «Filtrar», el orden bajo el contador, la tecla «Buscar» del teclado cierra el
 * teclado sin recargar ni navegar, y filtrar cuarenta se siente instantáneo.
 *
 * Solo lo corre el proyecto `movil` (ver `playwright.config.ts`): sus medidas
 * no significan nada en una ventana de escritorio.
 */

const buscador = (page: Page) => page.getByRole('searchbox', { name: 'Buscar vacantes' })
const tarjetas = (page: Page) => page.getByRole('list', { name: 'Vacantes', exact: true }).getByRole('listitem')
const filtrar = (page: Page) => page.getByRole('button', { name: /^Filtrar/ })

const anchoDelDocumento = (page: Page) =>
  page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }))

test.describe('Buscar vacantes en el teléfono · el muro de cuarenta', () => {
  let ids: Record<string, number>
  test.beforeAll(() => {
    retirarLoSembrado()
    esconderLasDemas()
    ids = sembrar(muro(40))
  })

  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(), () => devolverLasEscondidas()]))

  test('AC-19 · a 375 px no hay scroll horizontal, los filtros van plegados tras «Filtrar» y el orden bajo el contador', async ({
    page,
  }) => {
    await page.goto('/vacantes')
    await expect(tarjetas(page)).toHaveCount(40)
    await expect(page.getByText('40 vacantes abiertas', { exact: true })).toBeVisible()

    // `soft`: si desborda, que se lea también el resto de la pantalla.
    const ancho = await anchoDelDocumento(page)
    expect.soft(ancho.documento, 'la pantalla pide scroll horizontal').toBeLessThanOrEqual(ancho.ventana)

    // Plegados: el botón dice que está cerrado y el panel no se ve.
    await expect(filtrar(page)).toBeVisible()
    await expect(filtrar(page)).toHaveAttribute('aria-expanded', 'false')
    const filtros = page.locator('#filtros-de-vacantes')
    await expect(filtros).toBeHidden()
    await expect(page.getByRole('group', { name: 'Ciudad' })).toBeHidden()

    // Se despliega en su sitio y la lista responde con el panel abierto.
    await filtrar(page).click()
    await expect(filtrar(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(filtros).toBeVisible()
    const lima = page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: /^Lima/ })
    // Clic y no `check()`: la casilla la escribe el router en una transición.
    await lima.click()
    await expect(lima).toBeChecked()
    await expect(tarjetas(page)).toHaveCount(10)
    await expect(filtrar(page)).toHaveText('Filtrar (1)')
    await expect(page.getByRole('button', { name: 'Quitar filtro Lima' })).toBeVisible()
    await expect(filtros).toBeVisible()

    // Con el panel abierto tampoco hay scroll horizontal; y la cabecera enseña sus cuatro destinos.
    const conFiltros = await anchoDelDocumento(page)
    expect.soft(conFiltros.documento, 'con los filtros abiertos hay scroll horizontal').toBeLessThanOrEqual(conFiltros.ventana)
    // Lo que desborda es la cabecera: su contenido pide más ancho que la ventana.
    const cabeceraDentro = await page.locator('header > div').evaluate((e) => ({ scroll: e.scrollWidth, ventana: window.innerWidth }))
    expect.soft(cabeceraDentro.scroll, 'la cabecera pide más ancho que la ventana').toBeLessThanOrEqual(cabeceraDentro.ventana)
    await expect.soft(page.locator('header').getByRole('link', { name: 'Iniciar sesión' }), 'el botón «Iniciar sesión» se sale de la pantalla').toBeInViewport({ ratio: 1 })
    for (const destino of ['Inicio', 'Vacantes', 'Mis procesos']) {
      await expect(page.locator('header nav').getByRole('link', { name: destino, exact: true })).toBeVisible()
    }
    const cabecera = await page.locator('header').boundingBox()
    expect(cabecera?.height, 'la cabecera dejó de medir 70 px').toBeGreaterThanOrEqual(60)
    expect(cabecera?.height).toBeLessThanOrEqual(80)

    // El orden queda bajo el contador, también sin texto (ciclo 2: se ve siempre).
    const orden = page.getByRole('radiogroup', { name: 'Ordenar por' })
    await expect(orden).toBeVisible()
    await expect(orden.getByRole('radio', { name: 'Relevantes' })).toBeChecked()
    await buscador(page).fill('puesto 1')
    await expect(orden).toBeVisible()
    // El visible, no la región aria-live que repite la cuenta para el lector de pantalla.
    const contador = await page.locator('p:not([aria-live])').filter({ hasText: /de 40 vacantes/ }).boundingBox()
    const filaDelOrden = await orden.boundingBox()
    expect(filaDelOrden!.y, 'el orden no está debajo del contador').toBeGreaterThan(contador!.y + contador!.height - 1)

    // La tarjeta se apila: los datos bajan debajo del resumen, y nada se sale del ancho.
    const tarjeta = tarjetas(page).first()
    const titulo = await tarjeta.getByRole('heading', { level: 3 }).boundingBox()
    const sueldo = await tarjeta.getByText('Sueldo sin publicar', { exact: true }).boundingBox()
    expect(sueldo!.y, 'los datos no bajaron debajo del título').toBeGreaterThan(titulo!.y + titulo!.height - 1)
    const alFinal = await anchoDelDocumento(page)
    expect.soft(alFinal.documento, 'con las tarjetas apiladas hay scroll horizontal').toBeLessThanOrEqual(alFinal.ventana)
  })

  test('AC-19 · la tecla «Buscar» del teclado cierra el teclado sin recargar ni navegar', async ({ page }) => {
    await page.goto('/vacantes')
    await expect(tarjetas(page)).toHaveCount(40)
    // Una marca en la ventana: si la página recargara, se perdería.
    await page.evaluate(() => {
      ;(window as unknown as { __qaSinRecarga: boolean }).__qaSinRecarga = true
    })
    await buscador(page).click()
    await buscador(page).pressSequentially('remoto')
    await expect(buscador(page)).toBeFocused()
    await buscador(page).press('Enter')
    await expect(buscador(page)).not.toBeFocused()
    await expect(page).toHaveURL(/\/vacantes\?q=remoto$/)
    expect(await page.evaluate(() => (window as unknown as { __qaSinRecarga?: boolean }).__qaSinRecarga)).toBe(true)
    await expect(buscador(page)).toHaveValue('remoto')
    await expect(tarjetas(page)).toHaveCount(10)
  })

  test('filtrar cuarenta se siente instantáneo y las etiquetas activas se ven siempre', async ({ page }) => {
    await page.goto('/vacantes')
    await expect(tarjetas(page)).toHaveCount(40)
    const desde = Date.now()
    await buscador(page).fill('muro')
    await expect(page.getByText('40 de 40 vacantes', { exact: true })).toBeVisible()
    await buscador(page).fill('muro 3')
    // «3» en 03, 13, 23 y del 30 al 39: trece.
    await expect(tarjetas(page)).toHaveCount(13)
    expect(Date.now() - desde, 'filtrar cuarenta tardó demasiado').toBeLessThan(3_000)

    // Un filtro puesto se ve como etiqueta aunque el panel esté plegado.
    await page.goto('/vacantes?modalidad=remoto&publicada=7d')
    await expect(filtrar(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('button', { name: 'Quitar filtro Remoto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quitar filtro Últimos 7 días' })).toBeVisible()
    await expect(filtrar(page)).toHaveText('Filtrar (2)')
    // Remoto cada cuatro (índices 2, 6, 10…) y publicada en los últimos 7 días: hace 2 y hace 6 → 2.
    await expect(tarjetas(page)).toHaveCount(2)
    const sinScroll = await anchoDelDocumento(page)
    expect.soft(sinScroll.documento, 'la pantalla pide scroll horizontal').toBeLessThanOrEqual(sinScroll.ventana)
  })

  /**
   * F-01 del ciclo 0 de QA: de 369 a 420 px la cabecera desbordaba y toda página
   * del portal tenía scroll horizontal. Se mide por ancho y por pantalla, y se
   * mide también lo que la cabecera promete: sus 70 px y los 44 px táctiles.
   */
  test('AC-19 · de 320 a 431 px la cabecera cabe en portada, lista y ficha, mide lo que promete y sus destinos son táctiles', async ({
    page,
  }) => {
    const anchos = [320, 360, 368, 369, 375, 390, 412, 430, 431]
    const pantallas = ['/', '/vacantes', `/vacantes/${ids['muro-1']}`]
    const DESTINOS = ['Inicio', 'Vacantes', 'Mis procesos', 'Iniciar sesión']
    for (const camino of pantallas) {
      await page.goto(camino)
      await expect(page.locator('header').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
      for (const ancho of anchos) {
        await page.setViewportSize({ width: ancho, height: 812 })
        const m = await page.evaluate((nombres) => {
          const cabecera = document.querySelector('header')!
          const visibles = [...cabecera.querySelectorAll<HTMLElement>('a, button')].filter((e) => e.getClientRects().length > 0)
          const caja = (e: HTMLElement) => e.getBoundingClientRect()
          return {
            documento: document.documentElement.scrollWidth,
            dentro: (cabecera.firstElementChild as HTMLElement).scrollWidth,
            alto: caja(cabecera).height,
            prometido: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-cabecera')),
            piezas: visibles.map((e) => ({ nombre: (e.textContent ?? '').trim(), alto: caja(e).height, derecha: caja(e).right, izquierda: caja(e).left })),
            destinos: visibles.map((e) => (e.textContent ?? '').trim()).filter((n) => nombres.includes(n)),
          }
        }, DESTINOS)
        const donde = `${camino} a ${ancho} px`
        expect.soft(m.documento, `${donde}: la página pide scroll horizontal`).toBeLessThanOrEqual(ancho)
        expect.soft(m.dentro, `${donde}: la cabecera pide más ancho que la ventana`).toBeLessThanOrEqual(ancho)
        expect.soft(Math.abs(m.alto - m.prometido), `${donde}: la cabecera mide ${m.alto} px y promete ${m.prometido}`).toBeLessThanOrEqual(1)
        const esperados = ancho <= 368 ? DESTINOS.filter((d) => d !== 'Vacantes') : DESTINOS
        expect.soft(m.destinos, `${donde}: no se ven los destinos que tocan`).toEqual(esperados)
        for (const pieza of m.piezas) {
          expect.soft(pieza.derecha, `${donde}: «${pieza.nombre}» se sale por la derecha`).toBeLessThanOrEqual(ancho)
          expect.soft(pieza.izquierda, `${donde}: «${pieza.nombre}» se sale por la izquierda`).toBeGreaterThanOrEqual(0)
          if (DESTINOS.includes(pieza.nombre)) {
            expect.soft(pieza.alto, `${donde}: «${pieza.nombre}» mide ${pieza.alto} px de alto, no llega a 44`).toBeGreaterThanOrEqual(44)
          }
        }
      }
    }
  })
})

/** Una modalidad basura de 200 letras: sale tal cual como opción y como etiqueta (F-03 del ciclo 0 de QA). */
const MODALIDAD_LARGA = `Modalidad${'x'.repeat(191)}`

test.describe('Buscar vacantes en el teléfono · los textos largos', () => {
  test.beforeAll(() => {
    retirarLoSembrado()
    esconderLasDemas()
    sembrar([
      { clave: 'larga', titulo: 'Puesto con modalidad larga', modalidad: MODALIDAD_LARGA, hace: 2 },
      { clave: 'remota', titulo: 'Puesto remoto', modalidad: 'Remoto', hace: 3 },
      { clave: 'sin', titulo: 'Puesto sin nada', hace: 4 },
    ])
  })

  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(), () => devolverLasEscondidas()]))

  test('F-03 · 200 letras en el buscador, y una modalidad de 200 letras como opción y como etiqueta, no sacan el teléfono de su ancho', async ({
    page,
  }) => {
    await page.goto('/vacantes')
    await expect(tarjetas(page)).toHaveCount(3)

    await buscador(page).fill('x'.repeat(200))
    const aviso = page.getByText(/^Ninguna vacante coincide con «x{200}»/)
    await expect(aviso).toBeVisible()
    const conBusqueda = await aviso.evaluate((p) => ({
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      derecha: p.getBoundingClientRect().right,
    }))
    expect.soft(conBusqueda.documento, 'con 200 letras la pantalla pide scroll horizontal').toBeLessThanOrEqual(conBusqueda.ventana)
    expect.soft(conBusqueda.derecha, 'el aviso se sale por la derecha').toBeLessThanOrEqual(conBusqueda.ventana)

    await page.getByRole('button', { name: 'Ver las 3 vacantes' }).click()
    await expect(tarjetas(page)).toHaveCount(3)
    await filtrar(page).click()
    const opcion = page.getByRole('group', { name: 'Modalidad' }).getByRole('checkbox', { name: /^Modalidadx+/ })
    await expect(opcion).toBeVisible()
    const opcionMedida = await opcion.evaluate((c) => {
      const caja = (c.closest('label') ?? c.parentElement!) as HTMLElement
      return { derecha: caja.getBoundingClientRect().right, ventana: window.innerWidth, desborde: caja.scrollWidth - caja.clientWidth }
    })
    expect.soft(opcionMedida.derecha, 'la opción larga se sale por la derecha').toBeLessThanOrEqual(opcionMedida.ventana)
    expect.soft(opcionMedida.desborde, 'el texto de la opción larga se sale de su caja').toBeLessThanOrEqual(1)

    await opcion.click()
    await expect(opcion).toBeChecked()
    await expect(tarjetas(page)).toHaveCount(1)
    const etiquetaLarga = page.getByRole('button', { name: /^Quitar filtro Modalidadx+/ })
    await expect(etiquetaLarga).toBeVisible()
    const m = await etiquetaLarga.evaluate((b) => {
      const r = b.getBoundingClientRect()
      return {
        documento: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
        derecha: r.right,
        izquierda: r.left,
        alto: r.height,
        desborde: b.scrollWidth - b.clientWidth,
      }
    })
    expect.soft(m.documento, 'con la etiqueta larga la pantalla pide scroll horizontal').toBeLessThanOrEqual(m.ventana)
    expect.soft(m.derecha, 'la etiqueta larga se sale por la derecha').toBeLessThanOrEqual(m.ventana)
    expect.soft(m.izquierda, 'la etiqueta larga se sale por la izquierda').toBeGreaterThanOrEqual(0)
    expect.soft(m.desborde, 'el texto de la etiqueta se sale de su caja').toBeLessThanOrEqual(1)
    // Se partió en varias líneas en vez de empujar la fila.
    expect.soft(m.alto, 'la etiqueta larga no se partió').toBeGreaterThan(44)
    await expect(filtrar(page)).toHaveText('Filtrar (1)')
  })
})
