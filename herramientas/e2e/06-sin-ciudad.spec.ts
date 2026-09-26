import { expect, test } from '@playwright/test'
import { abrirFiltros, cabecera, corte, entrarAlPanel, irAVacante, nombresVisibles, VACANTES } from './ayuda'
import { sql, literal } from './base-de-datos'

/**
 * La ciudad que falta, sobre «Analista de experiencia del cliente».
 *
 * ⚠️ **El escenario son las tres personas que siembra el sembrador, no la vacante
 * entera.** Esa vacante la usan también las pruebas que postulan de verdad desde
 * el portal —`22-perfil-con-foto-y-cv` manda ahí su «LA TRAMPA»—, y esas
 * postulaciones no se pueden borrar después: nacen con su transición, que es
 * inmutable (ver `borrarCuentasDePrueba`). Cada corrida entera deja una fila más
 * de «Prueba De Archivos», con Lima. Afirmar la lista exacta de la vacante hacía
 * que esta prueba pasara solo la primera vez sobre una base limpia.
 *
 * Así que se afirma el orden de las tres personas sembradas entre sí, que la fila
 * sin ciudad es la ÚLTIMA de toda la tabla —con o sin filas ajenas delante—, y el
 * desplegable contra las ciudades que de verdad hay en la vacante, leídas de la
 * base. Las filas ajenas se toleran solo si traen ciudad: si alguna no la trae,
 * «una sola fila sin ciudad» ya no sería cierto y la prueba lo dice por su nombre.
 */

/** Se guardan los datos existentes antes de escribir, siempre dentro de la vacante esperada. */
type Persona = { id: number; ciudad: string | null; nombre: string; apellidos: string }
let originales: Persona[] = []
let mateo: number

const FERNANDA = 'Fernanda Quispe Mamani' // Cusco
const RENATA = 'Renata Espinoza León' // Puno
const MATEO = 'Mateo Ibáñez Flores' // Callao; la prueba se la quita
const ESCENARIO: readonly string[] = [FERNANDA, RENATA, MATEO]
const nombreDe = (p: Persona) => `${p.nombre} ${p.apellidos}`
const delEscenario = (nombres: string[]) => nombres.filter(n => ESCENARIO.includes(n))

const leerPersonas = () => {
  const vacantes: { id: number }[] = JSON.parse(sql(`select coalesce(json_agg(v), '[]') from
    (select id from vacante where titulo = ${literal(VACANTES.OTRA)}) v;`))
  if (vacantes.length !== 1) throw new Error('Se esperaba una única vacante para probar la ciudad; no se modificó nada.')
  const filas: Persona[] = JSON.parse(sql(`select coalesce(json_agg(p), '[]') from (
    select distinct pe.id, pe.ciudad_ubigeo as ciudad, pe.nombre, pe.apellidos
    from postulacion p join usuario u on u.id = p.usuario_id join persona pe on pe.id = u.persona_id
    where p.vacante_id = ${vacantes[0]!.id}) p;`))
  for (const nombre of ESCENARIO) {
    const suyas = filas.filter(p => nombreDe(p) === nombre)
    if (suyas.length !== 1) throw new Error(`Falta ${nombre} en la vacante esperada o es ambiguo; no se modificó nada.`)
    if (nombre !== MATEO && suyas[0]!.ciudad === null) throw new Error(`${nombre} llegó sin ciudad: el sembrador se la pone; no se modificó nada.`)
  }
  originales = filas
  mateo = filas.find(p => nombreDe(p) === MATEO)!.id
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
    // Una fila ajena sin ciudad haría dos sin dato, y el caso dejaría de ser «una sola».
    expect(
      originales.filter(p => p.id !== mateo && p.ciudad === null).map(nombreDe),
      'postulaciones sin ciudad en la vacante, aparte de la de Mateo',
    ).toEqual([])
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
    const subiendo = await nombresVisibles(page)
    expect(delEscenario(subiendo)).toEqual([FERNANDA, RENATA, MATEO])
    // Sin ciudad -> al final de TODA la tabla, también detrás de las filas ajenas.
    expect(subiendo.at(-1)).toBe(MATEO)

    await th.getByRole('button').click()
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    const bajando = await nombresVisibles(page)
    expect(delEscenario(bajando)).toEqual([RENATA, FERNANDA, MATEO])
    // Sin ciudad -> SIGUE al final: el orden inverso no la sube arriba.
    expect(bajando.at(-1)).toBe(MATEO)

    // Y el desplegable de ciudad solo ofrece las que de verdad hay: las de quien la
    // conserva, sin la que se le quitó a Mateo. Sobre la siembra limpia son dos.
    const ciudades = new Set(originales.filter(p => p.id !== mateo).map(p => p.ciudad))
    await abrirFiltros(page)
    await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('button')).toHaveCount(ciudades.size)
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
