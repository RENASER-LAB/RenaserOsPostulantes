import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { abrirMasFiltros, cabecera, corte, entrarAlPanel, irAVacante, nombresVisibles, VACANTES } from './ayuda'

/**
 * El caso «la tanda no trae ciudad», que con los datos sembrados NO se da: las
 * seis postulaciones de las vacantes 8 y 9 tienen ubigeo.
 *
 * ⚠️ Se fabrica escribiendo en el Postgres **desechable del 5434** y solo sobre
 * la vacante 9; la 8 se deja intacta. Al terminar se restaura.
 */
const sql = (consulta: string) =>
  execFileSync('docker', ['exec', 'renaser-verifica', 'psql', '-U', 'postgres', '-d', 'renaser_db', '-c', consulta])
    .toString()

/** Las personas de la vacante 9 y su ubigeo original. */
const PERSONAS_V9 = [4, 7, 10]
const ORIGINAL: Record<number, string> = { 4: '1501', 7: '0701', 10: '2101' }

const restaurar = () => {
  for (const [id, ubigeo] of Object.entries(ORIGINAL)) {
    sql(`update persona set ciudad_ubigeo = '${ubigeo}' where id = ${id};`)
  }
}

test.afterAll(restaurar)

test.describe('Nuevo · cuando la ciudad falta', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('MEZCLA: una sola fila sin ciudad se va al final, suba o baje el orden', async ({ page }) => {
    restaurar()
    sql('update persona set ciudad_ubigeo = null where id = 7;') // Mateo

    await irAVacante(page, VACANTES.OTRA)
    await corte(page, 'Toda la tanda').click()
    // La columna sigue: dos filas sí la traen.
    await expect(cabecera(page, 'Ciudad')).toHaveCount(1)
    // Y la fila sin dato pone su guion, que aquí sí significa «no lo declaró».
    await expect(page.locator('table tbody')).toContainText('—')

    const th = cabecera(page, 'Ciudad')
    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual([
      'Fernanda Quispe Mamani', // Lima
      'Renata Espinoza León', // Puno
      'Mateo Ibáñez Flores', // sin ciudad -> al final
    ])

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    expect(await nombresVisibles(page)).toEqual([
      'Renata Espinoza León',
      'Fernanda Quispe Mamani',
      'Mateo Ibáñez Flores', // sin ciudad -> SIGUE al final
    ])

    // Y el desplegable de ciudad solo ofrece las dos que de verdad hay.
    await abrirMasFiltros(page)
    await expect(page.locator('fieldset').first().getByRole('button')).toHaveCount(2)
  })

  test('TODA VACÍA: la columna Ciudad desaparece y se dice por qué', async ({ page }) => {
    restaurar()
    sql(`update persona set ciudad_ubigeo = null where id in (${PERSONAS_V9.join(',')});`)

    await irAVacante(page, VACANTES.OTRA)
    await corte(page, 'Toda la tanda').click()

    await expect(cabecera(page, 'Ciudad')).toHaveCount(0)
    await expect(cabecera(page, 'Pretensión')).toHaveCount(0)
    // Candidato y Nota siguen ahí: no se cae toda la tabla.
    await expect(cabecera(page, 'Candidato')).toHaveCount(1)
    await expect(cabecera(page, 'Nota del perfil')).toHaveCount(1)

    // El colSpan de la fila de detalle sigue cuadrando con menos columnas.
    // Se comprueba ANTES de desplegar los filtros: abiertos, el panel tapa la tabla.
    const columnas = await page.locator('table thead th').count()
    await page.locator('table tbody tr').first().click()
    await expect(page.locator('table tbody tr td[colspan]').first()).toHaveAttribute(
      'colspan',
      String(columnas),
    )
    await page.locator('table tbody tr').first().click()

    await abrirMasFiltros(page)
    await expect(
      page.getByText(
        'Todavía no hay ninguna ciudad en esta tanda: solo se le pide a quien crea su cuenta desde ahora, así que ninguna postulación anterior la trae.',
      ),
    ).toBeVisible()
    // Sin ciudades no se sirve un desplegable vacío.
    await expect(page.locator('fieldset').first().getByRole('button')).toHaveCount(0)
  })

  test('y la vacante 8, que no se tocó, sigue con su columna Ciudad', async ({ page }) => {
    await irAVacante(page, VACANTES.SIN_PRETENSION)
    await corte(page, 'Toda la tanda').click()
    await expect(cabecera(page, 'Ciudad')).toHaveCount(1)
    await expect(page.locator('table tbody')).toContainText('Lima — Lima')
  })
})
