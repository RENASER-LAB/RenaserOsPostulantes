import { expect, test } from '@playwright/test'
import { cabecera, corte, entrarAlPanel, filasDelRanking, irAVacante, pestana, VACANTES } from './ayuda'

/**
 * Lo que YA existía antes de la rama y no puede haberse roto.
 *
 * Es la mitad que más importa del encargo: el listado, el embudo, las cinco
 * pestañas, los tres cortes con sus cifras, el detalle desplegable, y el resto
 * del panel (Simulación, Configuración, Banco de preguntas).
 */
test.describe('Regresión · el panel del equipo', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('el listado de vacantes trae las tres publicadas y se entra a una', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()

    const filas = page.locator('table tbody tr')
    await expect(filas.first()).toBeVisible()
    expect(await filas.count()).toBeGreaterThanOrEqual(3)
    for (const titulo of ['Desarrollador web', 'Líder de operaciones', 'Analista de experiencia del cliente']) {
      await expect(page.getByRole('cell', { name: titulo, exact: true }).first()).toBeVisible()
    }

    await page.getByRole('row', { name: /Analista de experiencia del cliente/ }).first()
      .getByRole('link', { name: /Ver postulantes/ }).click()
    await expect(page).toHaveURL(/\/admin\/vacantes\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('el embudo pinta los tramos con sus cifras', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await expect(page.getByRole('heading', { name: 'En qué va la tanda' })).toBeVisible()
    const tramos = page.locator('ul[role="list"]').first().locator('li')
    expect(await tramos.count()).toBeGreaterThan(0)
    // Cada tramo lleva una cifra y un nombre de estado.
    await expect(tramos.first()).toHaveText(/\d+\s*\S+/)
  })

  test('las cinco pestañas de etapa existen y se pueden recorrer', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    const etapas = ['Perfil integral', 'Prueba del puesto', 'Simulación', 'Validación', 'Decisión']
    await expect(page.getByRole('tab')).toHaveCount(5)

    for (const nombre of etapas) {
      await pestana(page, nombre).click()
      await expect(pestana(page, nombre)).toHaveAttribute('aria-selected', 'true')
      // La tabla del ranking sigue montada en las cinco.
      await expect(page.locator('table').last()).toBeVisible()
    }
  })

  test('los tres cortes y sus contadores cuadran con las filas', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)

    // Perfil integral: 4 con nota, 1 aquí ahora (PERFIL_POR_CONFIRMAR), 4 en total.
    const esperado: [string, number][] = [
      ['Con nota del perfil', 4],
      ['Está aquí ahora', 1],
      ['Toda la tanda', 4],
    ]
    for (const [nombre, cuantas] of esperado) {
      const boton = corte(page, nombre)
      await expect(boton).toContainText(String(cuantas))
      await boton.click()
      await expect(boton).toHaveAttribute('aria-pressed', 'true')
      await expect(filasDelRanking(page)).toHaveCount(cuantas)
    }
  })

  test('el detalle de un candidato se despliega y se pliega', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    const fila = filasDelRanking(page).filter({ hasText: 'Camila Torres Rivas' })
    await fila.click()
    await expect(page.getByText('Camila Torres Rivas').first()).toBeVisible()
    // La fila de detalle es un <tr> extra sin casilla de avance.
    await expect(page.locator('table tbody tr')).toHaveCount(5)
    await fila.click()
    await expect(page.locator('table tbody tr')).toHaveCount(4)
  })

  test('Simulación, Configuración y el Banco de preguntas siguen abriendo', async ({ page }) => {
    await page.goto('/admin/simulacion')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.getByRole('alert').count()).toBe(0)

    await page.goto('/admin/configuracion')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/banco de preguntas/i).first()).toBeVisible()
  })

  test('las tres etapas que no exportan no enseñan el botón de Excel', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    for (const nombre of ['Simulación', 'Validación', 'Decisión']) {
      await pestana(page, nombre).click()
      await expect(page.getByRole('button', { name: /Descargar Excel|Nada que descargar|Preparando el Excel/ })).toHaveCount(0)
    }
    // Y en las dos que sí, existe.
    for (const nombre of ['Perfil integral', 'Prueba del puesto']) {
      await pestana(page, nombre).click()
      await expect(page.getByRole('button', { name: /Descargar Excel|Nada que descargar/ })).toHaveCount(1)
    }
  })

  test('cambiar de pestaña con filtros puestos los limpia, pero el corte se conserva', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('searchbox').fill('camila')
    await expect(filasDelRanking(page)).toHaveCount(1)

    await pestana(page, 'Prueba del puesto').click()
    // `<Ranking key={etapa}>` remonta: los filtros mueren con él.
    await expect(page.getByRole('searchbox')).toHaveValue('')
    // `vista` vive en el padre y NO se reinicia.
    await expect(corte(page, 'Toda la tanda')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(4)
  })

  test('el orden puesto tampoco sobrevive al cambio de pestaña', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await cabecera(page, 'Candidato').getByRole('button').click()
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'ascending')

    await pestana(page, 'Decisión').click()
    await pestana(page, 'Perfil integral').click()
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'none')
  })
})
