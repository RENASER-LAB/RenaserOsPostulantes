import { expect, test } from '@playwright/test'
import { abrirFiltros, botonFiltros, cabecera, cerrarFiltros, corte, entrarAlPanel, filasDelRanking, irAVacante, panelFiltros, VACANTES } from './ayuda'
import { interceptarEscenario } from './escenario-desarrollador-web'

/**
 * El panel de filtros y las cabeceras, sin ratón.
 *
 * ⚠️ **El escenario viene interceptado** (`escenario-desarrollador-web.ts`): así
 * la columna de Pretensión y sus dos campos existen seguro en el recorrido con
 * Tab. Ordenar entero con el teclado —Enter, Espacio y el foco que no se
 * pierde— vive en `03-orden`.
 */

/** Cómo se llama lo que tiene el foco ahora mismo. */
const enfocado = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null
    if (!e) return 'ninguno'
    const etiqueta = e.getAttribute('aria-label') ?? e.getAttribute('placeholder') ?? (e.textContent ?? '').trim().slice(0, 40)
    return `${e.tagName.toLowerCase()}:${etiqueta}`
  })

test.describe('Teclado sin ratón', () => {
  /*
    La pantalla abre por «Pendiente», que solo trae a quien espera una
    decisión. Lo que se mide aquí es otra cosa —los filtros, el orden, el
    teclado—, así que se abre la tanda entera para tener filas con las que
    trabajar; es lo que traía el corte de antes, «Con nota», en esta vacante.
  */
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await interceptarEscenario(page)
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
  })

  test('la barra de filtros entera se recorre con Tab', async ({ page }) => {
    await abrirFiltros(page)
    await page.getByRole('searchbox').focus()

    const recorrido: string[] = []
    // Más pasos que antes: el panel suma la fecha —con sus tres segmentos en
    // Chrome—, sus atajos y las tres casillas de la IA.
    for (let i = 0; i < 40; i++) {
      recorrido.push(await enfocado(page))
      await page.keyboard.press('Tab')
    }
    const todo = recorrido.join(' | ')

    // Los cuatro filtros y el botón del Excel tienen que ser alcanzables.
    expect(todo, todo).toContain('Lima — Lima')
    expect(todo, todo).toContain('Nota del perfil, desde')
    expect(todo, todo).toContain('Nota del perfil, hasta')
    expect(todo, todo).toContain('Pretensión, desde')
    expect(todo, todo).toContain('Pretensión, hasta')
    expect(todo, todo).toContain('Descargar Excel')
  })

  test('los chips de ciudad se marcan con Enter y con Espacio', async ({ page }) => {
    await abrirFiltros(page)
    const chip = page.getByRole('button', { name: /^Lima — Lima/ })
    await chip.focus()
    await expect(chip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(1)
    await page.keyboard.press('Space')
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await expect(filasDelRanking(page)).toHaveCount(4)
  })

  test('«Filtros» abre con teclado, y Esc lo cierra devolviendo el foco', async ({ page }) => {
    const boton = botonFiltros(page)
    await boton.focus()
    await expect(boton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Nota del perfil, desde')).toBeVisible()
    // El foco entra en el panel: se puede operar sin recorrer la página.
    await expect(panelFiltros(page).getByRole('radio', { name: 'Un día' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panelFiltros(page)).toHaveCount(0)
    await expect(boton).toBeFocused()
  })

  // Un texto del panel no es un control: pulsarlo no puede llevar el foco al
  // ranking de detrás, que es enfocable y envuelve el panel.
  test('pulsar un texto del panel lo deja abierto con el foco dentro, y Tab sigue en él', async ({ page }) => {
    await abrirFiltros(page)
    const panel = panelFiltros(page)
    const enElPanel = () =>
      page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-label="Filtros"]'))
    await panel.getByText(/^Se ven \d+ de \d+$/).click()
    await expect(panel).toBeVisible()
    expect(await enElPanel()).toBe(true)
    await page.keyboard.press('Tab')
    await expect(panel).toBeVisible()
    expect(await enElPanel()).toBe(true)
  })

  // F-06 con el ratón: ni el «Borrar filtros» del pie ni el de la barra dejan el foco en <body>.
  test('«Borrar filtros» con el ratón: la barra lo manda a «Filtros» y el pie lo conserva', async ({ page }) => {
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    const delPie = panelFiltros(page).getByRole('button', { name: 'Borrar filtros' })
    await delPie.click()
    await expect(filasDelRanking(page)).toHaveCount(4)
    await expect(delPie).toBeFocused()

    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    await cerrarFiltros(page)
    await page.getByRole('button', { name: 'Borrar filtros' }).click()
    await expect(filasDelRanking(page)).toHaveCount(4)
    await expect(botonFiltros(page)).toBeFocused()
  })
})

/**
 * Los 404 de `/ficha` y de `plantillas-prueba/versiones/N` son PREEXISTENTES:
 * ya estaban en `main` y no se cuentan.
 */
const CONOCIDOS = [/\/ficha\b/, /plantillas-prueba\/versiones\/\d+/, /Failed to load resource/]

test.describe('La consola, sin los fallos conocidos', () => {
  test('recorrer el ranking no levanta errores nuevos', async ({ page }) => {
    const errores: string[] = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const texto = m.text()
      if (CONOCIDOS.some((r) => r.test(texto))) return
      errores.push(texto)
    })
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))

    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.LLENA)
    for (const etapa of ['Prueba del puesto', 'Simulación', 'Validación', 'Decisión', 'Perfil integral']) {
      await page.getByRole('tab', { name: etapa, exact: true }).click()
    }
    await abrirFiltros(page)
    await page.getByRole('button', { name: /^Lima — Lima/ }).click()
    // El panel flota encima de la tabla: se cierra antes de pulsar la cabecera.
    await cerrarFiltros(page)
    await cabecera(page, 'Candidato').getByRole('button').click()
    await page.getByRole('searchbox').fill('zzz')
    await page.waitForTimeout(500)

    expect(errores, errores.join('\n')).toEqual([])
  })
})
