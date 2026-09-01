import { expect, test, type Page } from '@playwright/test'
import {
  abrirMasFiltros,
  cabecera,
  corte,
  entrarAlPanel,
  filasDelRanking,
  irAVacante,
  nombresVisibles,
  pestana, VACANTES } from './ayuda'

const chip = (page: Page, ciudad: string) =>
  page.getByRole('button', { name: new RegExp(`^${ciudad}`) })

const notaDesde = (page: Page) => page.getByLabel('Nota del perfil, desde')
const notaHasta = (page: Page) => page.getByLabel('Nota del perfil, hasta')
const pretDesde = (page: Page) => page.getByLabel('Pretensión, desde')
const pretHasta = (page: Page) => page.getByLabel('Pretensión, hasta')

test.describe('Nuevo · filtros del ranking', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.LLENA)
  })

  test('el buscador encuentra CON y SIN tildes, en los dos sentidos', async ({ page }) => {
    const caja = page.getByRole('searchbox')

    // Escrito sin tilde, el dato la lleva.
    await caja.fill('lucia')
    await expect(filasDelRanking(page)).toHaveCount(1)
    expect(await nombresVisibles(page)).toEqual(['Lucía Chávez Paredes'])

    // Escrito CON tilde, también.
    await caja.fill('Lucía')
    await expect(filasDelRanking(page)).toHaveCount(1)

    // Por apellido y sin tilde.
    await caja.fill('chavez')
    await expect(filasDelRanking(page)).toHaveCount(1)

    // En mayúsculas.
    await caja.fill('CAMILA')
    expect(await nombresVisibles(page)).toEqual(['Camila Torres Rivas'])

    // Con espacios alrededor: se recortan.
    await caja.fill('   camila   ')
    await expect(filasDelRanking(page)).toHaveCount(1)

    // Solo espacios NO es un filtro puesto.
    await caja.fill('   ')
    await expect(filasDelRanking(page)).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Ver a todos' })).toHaveCount(0)
  })

  test('el contador «Se ven N de M» cuadra con las filas visibles', async ({ page }) => {
    await page.getByRole('searchbox').fill('a')
    const cuantas = await filasDelRanking(page).count()
    await expect(page.getByText(/Se ven \d+ de \d+ de este corte/)).toContainText(
      `Se ven ${cuantas} de 4 de este corte.`,
    )
    await expect(page.getByText(/El Excel lleva exactamente estas, en este orden/)).toBeVisible()
  })

  test('multi-selección de ciudad: dos marcadas suman las dos', async ({ page }) => {
    await abrirMasFiltros(page)
    await chip(page, 'Lima — Lima').click()
    await expect(chip(page, 'Lima — Lima')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(1)

    await chip(page, 'Arequipa — Camaná').click()
    await expect(filasDelRanking(page)).toHaveCount(2)
    expect((await nombresVisibles(page)).sort()).toEqual([
      'Camila Torres Rivas',
      'Lucía Chávez Paredes',
    ])

    // Desmarcar una la quita.
    await chip(page, 'Lima — Lima').click()
    await expect(chip(page, 'Lima — Lima')).toHaveAttribute('aria-pressed', 'false')
    await expect(filasDelRanking(page)).toHaveCount(1)

    // Los chips llevan su recuento y salen de las filas, no del catálogo (4 ciudades).
    await expect(page.locator('fieldset').first().getByRole('button')).toHaveCount(4)
  })

  test('rango de nota: quien no tiene nota queda fuera, y se dice', async ({ page }) => {
    await abrirMasFiltros(page)
    await expect(page.getByText('Quien no tiene nota queda fuera.')).toBeVisible()

    await notaDesde(page).fill('60')
    await notaHasta(page).fill('80')
    await expect(filasDelRanking(page)).toHaveCount(2)
    expect((await nombresVisibles(page)).sort()).toEqual([
      'Lucía Chávez Paredes',
      'Sebastián Cárdenas Rojo',
    ])

    // Solo un extremo también filtra.
    await notaHasta(page).fill('')
    await expect(filasDelRanking(page)).toHaveCount(3) // 61, 74, 95
  })

  test('rango de pretensión: solape, no contención; sin declarar queda fuera', async ({ page }) => {
    await abrirMasFiltros(page)
    await expect(
      page.getByText('Sale quien pida algo dentro de esa banda. Quien no la declaró queda fuera.'),
    ).toBeVisible()

    await pretDesde(page).fill('2000')
    await pretHasta(page).fill('3000')
    // Camila pide 2500–3000: solapa. Lucía empieza en 3100: no. Sebastián no declaró.
    await expect(filasDelRanking(page)).toHaveCount(1)
    expect(await nombresVisibles(page)).toEqual(['Camila Torres Rivas'])

    await pretHasta(page).fill('3200')
    await expect(filasDelRanking(page)).toHaveCount(2)
  })

  test('los filtros se combinan entre sí y con el corte', async ({ page }) => {
    await abrirMasFiltros(page)
    await notaDesde(page).fill('50')
    await chip(page, 'Lima — Lima').click()
    await chip(page, 'Arequipa — Camaná').click()
    await page.getByRole('searchbox').fill('lucia')
    await expect(filasDelRanking(page)).toHaveCount(1)
    expect(await nombresVisibles(page)).toEqual(['Lucía Chávez Paredes'])

    // El resumen del pliegue cuenta los filtros plegados (ciudad + nota = 2).
    await expect(page.getByText('Ciudad, nota y pretensión')).toContainText('2')

    // Y el corte recorta encima: «Está aquí ahora» en Perfil es solo Camila.
    await corte(page, 'Está aquí ahora').click()
    await expect(filasDelRanking(page)).toHaveCount(0)
  })

  test('«Ver a todos» borra los cuatro filtros de un golpe', async ({ page }) => {
    await abrirMasFiltros(page)
    await page.getByRole('searchbox').fill('lucia')
    await notaDesde(page).fill('70')
    await chip(page, 'Arequipa — Camaná').click()
    await expect(filasDelRanking(page)).toHaveCount(1)

    await page.getByRole('button', { name: 'Ver a todos' }).click()
    await expect(filasDelRanking(page)).toHaveCount(4)
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(notaDesde(page)).toHaveValue('')
    await expect(chip(page, 'Arequipa — Camaná')).toHaveAttribute('aria-pressed', 'false')
  })

  test('vacío por filtro: NO dice «nadie tiene nota», nombra el filtro', async ({ page }) => {
    await page.getByRole('searchbox').fill('zzzzzz')
    await expect(filasDelRanking(page)).toHaveCount(0)

    const vacio = page.locator('table tbody tr').last()
    await expect(vacio).toContainText(
      'Ninguna de las 4 de este corte pasa los filtros que hay puestos. Pulsa «Ver a todos» para quitarlos.',
    )
    await expect(vacio).not.toContainText('Nadie tiene todavía')
    // Y el botón del Excel se apaga en vez de bajar una hoja vacía.
    await expect(page.getByRole('button', { name: 'Nada que descargar' })).toBeDisabled()
  })

  test('rango invertido (80–20) deja la tabla vacía y lo explica como filtro', async ({ page }) => {
    await abrirMasFiltros(page)
    await notaDesde(page).fill('80')
    await notaHasta(page).fill('20')
    await expect(filasDelRanking(page)).toHaveCount(0)
    await expect(page.locator('table tbody tr').last()).toContainText('pasa los filtros que hay puestos')
  })

  test('el vacío SIN filtros sí dice por qué nadie tiene nota', async ({ page }) => {
    await pestana(page, 'Prueba del puesto').click()
    // Corte «Con nota de la prueba»: nadie la ha rendido.
    await expect(filasDelRanking(page)).toHaveCount(0)
    await expect(page.locator('table tbody tr').last()).toContainText(
      'Nadie tiene todavía nota de la prueba: hace falta la prueba rendida y calificada.',
    )
  })

  test('el filtro sobrevive a ordenar, y el orden al filtrar', async ({ page }) => {
    await page.getByRole('searchbox').fill('a') // las cuatro llevan «a»
    await expect(filasDelRanking(page)).toHaveCount(4)
    await cabecera(page, 'Candidato').getByRole('button').click()
    expect(await nombresVisibles(page)).toEqual([
      'Camila Torres Rivas',
      'Joaquín Vargas Ureta',
      'Lucía Chávez Paredes',
      'Sebastián Cárdenas Rojo',
    ])
    await page.getByRole('searchbox').fill('ar') // Camila (Torres), Joaquín (Vargas), Sebastián (Cárdenas)
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'ascending')
    const tras = await nombresVisibles(page)
    expect(tras).toEqual([...tras].sort((a, b) => a.localeCompare(b, 'es')))
  })

  test('recargar la página pierde filtros, orden, etapa y corte (todo vive en memoria)', async ({ page }) => {
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('searchbox').fill('lucia')
    await cabecera(page, 'Candidato').getByRole('button').click()

    await page.reload()
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
    await expect(pestana(page, 'Perfil integral')).toHaveAttribute('aria-selected', 'true')
    await expect(corte(page, 'Con nota del perfil')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'none')
  })
})

test.describe('Nuevo · las columnas que aparecen y desaparecen', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('vacante 7: están Ciudad y Pretensión', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await expect(cabecera(page, 'Ciudad')).toHaveCount(1)
    await expect(cabecera(page, 'Pretensión')).toHaveCount(1)
    // Y la pretensión se lee con su símbolo y su separador peruano.
    await expect(page.locator('table tbody')).toContainText('S/ 2,500 – 3,000')
  })

  test('vacante 8: la Pretensión desaparece y se explica por qué', async ({ page }) => {
    await irAVacante(page, VACANTES.SIN_PRETENSION)
    await corte(page, 'Toda la tanda').click()
    await expect(cabecera(page, 'Pretensión')).toHaveCount(0)
    // La ciudad SÍ la trae, así que esa columna se queda.
    await expect(cabecera(page, 'Ciudad')).toHaveCount(1)

    await abrirMasFiltros(page)
    await expect(
      page.getByText(
        'Ninguno de estos candidatos declaró pretensión salarial. La columna no sale porque no hay nada que poner en ella, no porque esté oculta.',
      ),
    ).toBeVisible()
    // Y no se cuela el motivo equivocado: la ciudad sí está.
    await expect(page.getByText('Todavía no hay ninguna ciudad en esta tanda')).toHaveCount(0)
    // Sin pretensión no hay rango de pretensión que ofrecer.
    await expect(page.getByLabel('Pretensión, desde')).toHaveCount(0)
  })

  test('vacante 9: mismo caso, y el ancho de la fila de detalle cuadra con las columnas', async ({ page }) => {
    await irAVacante(page, VACANTES.OTRA)
    await corte(page, 'Toda la tanda').click()
    await expect(cabecera(page, 'Pretensión')).toHaveCount(0)

    const columnas = await page.locator('table thead th').count()
    await filasDelRanking(page).first().click()
    const detalle = page.locator('table tbody tr td[colspan]')
    await expect(detalle.first()).toHaveAttribute('colspan', String(columnas))
  })
})
