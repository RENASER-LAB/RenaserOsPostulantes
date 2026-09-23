import { expect, test } from '@playwright/test'
import { abrirFiltros, cabecera, corte, entrarAlPanel, irAVacante, nombresVisibles, VACANTES } from './ayuda'
import { sql, literal } from './base-de-datos'

/** Se guardan los datos existentes antes de escribir, siempre dentro de la vacante esperada. */
type Persona = { id: number; ciudad: string | null; nombre: string; apellidos: string }
let originales: Persona[] = []
let mateo: number

const leerPersonas = () => {
  const vacantes: { id: number }[] = JSON.parse(sql(`select coalesce(json_agg(v), '[]') from
    (select id from vacante where titulo = ${literal(VACANTES.OTRA)}) v;`))
  if (vacantes.length !== 1) throw new Error('Se esperaba una única vacante para probar la ciudad; no se modificó nada.')
  const filas: Persona[] = JSON.parse(sql(`select coalesce(json_agg(p), '[]') from (
    select distinct pe.id, pe.ciudad_ubigeo as ciudad, pe.nombre, pe.apellidos
    from postulacion p join usuario u on u.id = p.usuario_id join persona pe on pe.id = u.persona_id
    where p.vacante_id = ${vacantes[0]!.id}) p;`))
  const candidatos = filas.filter(p => p.nombre === 'Mateo' && p.apellidos === 'Ibáñez Flores')
  if (!filas.length || candidatos.length !== 1) throw new Error('Falta Mateo en la vacante esperada o es ambiguo; no se modificó nada.')
  originales = filas
  mateo = candidatos[0]!.id
}
const restaurar = () => {
  if (!originales.length) return
  sql(`begin; ${originales.map(p => `update persona set ciudad_ubigeo = ${literal(p.ciudad)} where id = ${p.id};`).join('\n')} commit;`)
}
const sinCiudad = (ids: number[]) => {
  if (!ids.length || ids.some(id => !originales.some(p => p.id === id))) throw new Error('Personas fuera de la selección original.')
  sql(`begin; update persona set ciudad_ubigeo = null where id in (${ids.join(',')}); commit;`)
}

test.beforeAll(leerPersonas)
test.afterEach(restaurar)
test.afterAll(restaurar)

test.describe('Nuevo · cuando la ciudad falta', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('MEZCLA: una sola fila sin ciudad se va al final, suba o baje el orden', async ({ page }) => {
    restaurar()
    sinCiudad([mateo])

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
    await abrirFiltros(page)
    await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('button')).toHaveCount(2)
  })

  test('TODA VACÍA: la columna Ciudad desaparece y se dice por qué', async ({ page }) => {
    restaurar()
    sinCiudad(originales.map(p => p.id))

    await irAVacante(page, VACANTES.OTRA)
    await corte(page, 'Toda la tanda').click()

    await expect(cabecera(page, 'Ciudad')).toHaveCount(0)
    await expect(cabecera(page, 'Pretensión')).toHaveCount(0)
    // Candidato y Nota siguen ahí: no se cae toda la tabla.
    await expect(cabecera(page, 'Candidato')).toHaveCount(1)
    await expect(cabecera(page, 'Nota')).toHaveCount(1)

    // El colSpan de la fila de detalle sigue cuadrando con menos columnas.
    // Se comprueba ANTES de desplegar los filtros: abiertos, el panel tapa la tabla.
    const columnas = await page.locator('table thead th').count()
    await page.locator('table tbody tr').first().click()
    await expect(page.locator('table tbody tr td[colspan]').first()).toHaveAttribute(
      'colspan',
      String(columnas),
    )
    await page.locator('table tbody tr').first().click()

    await abrirFiltros(page)
    await expect(
      page.getByText(
        'Todavía no hay ninguna ciudad en esta tanda: solo se le pide a quien crea su cuenta desde ahora, así que ninguna postulación anterior la trae.',
      ),
    ).toBeVisible()
    // Sin ciudades no se sirve un desplegable vacío.
    await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('button')).toHaveCount(0)
  })

  test('y la vacante 8, que no se tocó, sigue con su columna Ciudad', async ({ page }) => {
    await irAVacante(page, VACANTES.SIN_PRETENSION)
    await corte(page, 'Toda la tanda').click()
    await expect(cabecera(page, 'Ciudad')).toHaveCount(1)
    await expect(page.locator('table tbody')).toContainText('Lima — Lima')
  })
})
