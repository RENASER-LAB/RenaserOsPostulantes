import { expect, test } from '@playwright/test'
import { cabecera, corte, entrarAlPanel, irAVacante, nombresVisibles, pestana, VACANTES } from './ayuda'

/**
 * Orden en la vacante 7. El orden del backend es:
 *   Lucía  (ALTA, 74, Arequipa — Camaná,     3100–3600)
 *   Camila (ALTA, 55, Lima — Lima,           2500–3000)
 *   Sebastián (NO_PRIORIZADO, 61, Junín — Huancayo, sin pretensión)
 *   Joaquín (INCOMPATIBLE, 95, La Libertad — Trujillo, 4000–5200)
 */
const DEL_BACKEND = [
  'Lucía Chávez Paredes',
  'Camila Torres Rivas',
  'Sebastián Cárdenas Rojo',
  'Joaquín Vargas Ureta',
]

test.describe('Nuevo · ordenar por las cuatro columnas', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.LLENA)
  })

  test('los tres estados de Candidato, con aria-sort coherente', async ({ page }) => {
    const th = cabecera(page, 'Candidato')
    await expect(th).toHaveAttribute('aria-sort', 'none')
    expect(await nombresVisibles(page)).toEqual(DEL_BACKEND)

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual([
      'Camila Torres Rivas',
      'Joaquín Vargas Ureta',
      'Lucía Chávez Paredes',
      'Sebastián Cárdenas Rojo',
    ])

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    expect(await nombresVisibles(page)).toEqual([
      'Sebastián Cárdenas Rojo',
      'Lucía Chávez Paredes',
      'Joaquín Vargas Ureta',
      'Camila Torres Rivas',
    ])

    // Tercer clic: vuelve al orden del backend.
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'none')
    expect(await nombresVisibles(page)).toEqual(DEL_BACKEND)
  })

  test('Ciudad ordena alfabéticamente en los dos sentidos', async ({ page }) => {
    const th = cabecera(page, 'Ciudad')
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual([
      'Lucía Chávez Paredes', // Arequipa
      'Sebastián Cárdenas Rojo', // Junín
      'Joaquín Vargas Ureta', // La Libertad
      'Camila Torres Rivas', // Lima
    ])
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    expect(await nombresVisibles(page)).toEqual([
      'Camila Torres Rivas',
      'Joaquín Vargas Ureta',
      'Sebastián Cárdenas Rojo',
      'Lucía Chávez Paredes',
    ])
  })

  /*
    El orden es PLANO: manda la nota y cruza los grupos de prioridad. Ordenaba
    dentro de cada grupo, y producía una mesa 55, 74, 61, 95 que se lee como
    rota. Se quitó al ver quién escribe ese grupo: INCOMPATIBLE —el único que
    podía contradecir a la nota— no lo escribe nadie, y los otros tres cuelgan de
    la propia nota, así que casi siempre iban en el mismo sentido.
  */
  test('Nota abre por la MAYOR y manda la nota, cruzando grupos', async ({ page }) => {
    const th = cabecera(page, 'Nota del perfil')
    await th.getByRole('button').click()
    // El primer clic de nota es descendente: el ranking ES eso.
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    expect(await nombresVisibles(page)).toEqual([
      'Joaquín Vargas Ureta', // 95, aunque su grupo sea el último
      'Lucía Chávez Paredes', // 74
      'Sebastián Cárdenas Rojo', // 61
      'Camila Torres Rivas', // 55
    ])

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual([
      'Camila Torres Rivas',
      'Sebastián Cárdenas Rojo',
      'Lucía Chávez Paredes',
      'Joaquín Vargas Ureta',
    ])

    // El grupo sigue pintándose aunque ya no mueva a nadie: quien mira tiene que
    // ver que ese 95 arrastra algo antes de descolgar el teléfono.
    await expect(page.getByText('Incompatible').first()).toBeVisible()

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'none')
    expect(await nombresVisibles(page)).toEqual(DEL_BACKEND)
  })

  test('el grupo de prioridad se ve en la fila, para que el orden no parezca roto', async ({ page }) => {
    await expect(page.getByText('Prioridad alta').first()).toBeVisible()
    await expect(page.getByText('Incompatible')).toBeVisible()
    await expect(page.getByText('No priorizado')).toBeVisible()
  })

  test('Pretensión: los vacíos al final SUBA O BAJE el orden', async ({ page }) => {
    const th = cabecera(page, 'Pretensión')
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual([
      'Camila Torres Rivas', // 2500
      'Lucía Chávez Paredes', // 3100
      'Joaquín Vargas Ureta', // 4000
      'Sebastián Cárdenas Rojo', // sin declarar -> al final
    ])

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    expect(await nombresVisibles(page)).toEqual([
      'Joaquín Vargas Ureta', // 4000
      'Lucía Chávez Paredes', // 3100
      'Camila Torres Rivas', // 2500
      'Sebastián Cárdenas Rojo', // sin declarar -> SIGUE al final
    ])
  })

  test('solo una columna a la vez lleva aria-sort distinto de none', async ({ page }) => {
    await cabecera(page, 'Ciudad').getByRole('button').click()
    await expect(cabecera(page, 'Ciudad')).toHaveAttribute('aria-sort', 'ascending')
    for (const otra of ['Candidato', 'Nota del perfil', 'Pretensión']) {
      await expect(cabecera(page, otra)).toHaveAttribute('aria-sort', 'none')
    }
    await cabecera(page, 'Pretensión').getByRole('button').click()
    await expect(cabecera(page, 'Pretensión')).toHaveAttribute('aria-sort', 'ascending')
    await expect(cabecera(page, 'Ciudad')).toHaveAttribute('aria-sort', 'none')
  })

  test('las cabeceras de orden se pulsan con el teclado', async ({ page }) => {
    const boton = cabecera(page, 'Candidato').getByRole('button')
    await boton.focus()
    await expect(boton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'ascending')
    await page.keyboard.press('Space')
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'descending')
    await page.keyboard.press('Enter')
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'none')
  })

  test('ordenar una columna ENTERA vacía no rompe nada', async ({ page }) => {
    // En «Prueba del puesto» nadie tiene nota: la columna es toda guiones.
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Toda la tanda').click()
    const antes = await nombresVisibles(page)
    expect(antes).toHaveLength(4)

    const th = cabecera(page, 'Nota de la prueba')
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    // Todas empatan a vacío, así que manda el grupo y luego el orden de origen.
    expect(await nombresVisibles(page)).toEqual(antes)
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual(antes)
  })
})
