import { expect, test } from '@playwright/test'
import { abrirMasFiltros, cabecera, entrarAlPanel, filasDelRanking, irAVacante, nombresVisibles, VACANTES } from './ayuda'

/** Cómo se llama lo que tiene el foco ahora mismo. */
const enfocado = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null
    if (!e) return 'ninguno'
    const etiqueta = e.getAttribute('aria-label') ?? e.getAttribute('placeholder') ?? (e.textContent ?? '').trim().slice(0, 40)
    return `${e.tagName.toLowerCase()}:${etiqueta}`
  })

test.describe('Teclado sin ratón', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.LLENA)
  })

  test('la barra de filtros entera se recorre con Tab', async ({ page }) => {
    await abrirMasFiltros(page)
    await page.getByRole('searchbox').focus()

    const recorrido: string[] = []
    for (let i = 0; i < 25; i++) {
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
    await abrirMasFiltros(page)
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

  test('el pliegue de filtros abre con teclado desde su resumen', async ({ page }) => {
    const resumen = page.locator('summary')
    await resumen.focus()
    await expect(resumen).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Nota del perfil, desde')).toBeVisible()
  })

  test('se puede ordenar entero sin tocar el ratón', async ({ page }) => {
    await cabecera(page, 'Pretensión').getByRole('button').focus()
    await page.keyboard.press('Enter')
    await expect(cabecera(page, 'Pretensión')).toHaveAttribute('aria-sort', 'ascending')
    expect((await nombresVisibles(page)).at(-1)).toBe('Sebastián Cárdenas Rojo')
    await page.keyboard.press('Enter')
    await expect(cabecera(page, 'Pretensión')).toHaveAttribute('aria-sort', 'descending')
    // El vacío sigue el último, y el foco no se perdió al reordenar.
    expect((await nombresVisibles(page)).at(-1)).toBe('Sebastián Cárdenas Rojo')
    await expect(cabecera(page, 'Pretensión').getByRole('button')).toBeFocused()
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
    await abrirMasFiltros(page)
    await page.getByRole('button', { name: /^Lima — Lima/ }).click()
    await cabecera(page, 'Candidato').getByRole('button').click()
    await page.getByRole('searchbox').fill('zzz')
    await page.waitForTimeout(500)

    expect(errores, errores.join('\n')).toEqual([])
  })
})
