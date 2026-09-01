import { expect, type Locator, type Page } from '@playwright/test'

export const API = 'http://localhost:8081/api/v1'

/** El token del panel: `dev-login` da todos los roles. */
export async function tokenDelPanel(): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: 'dev-equipo' }),
  })
  if (!r.ok) throw new Error(`dev-login falló: ${r.status}`)
  return (await r.json()).token
}

/**
 * Siembra el token ANTES de que arranque la app.
 *
 * Con `page.evaluate` después de navegar, la app ya decidió que no hay sesión y
 * redirigió a la pantalla de entrar.
 */
export async function entrarAlPanel(page: Page) {
  const token = await tokenDelPanel()
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

export async function entrarAlPortal(page: Page, correo: string, contrasena = 'Demo12345!') {
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })
  if (!r.ok) throw new Error(`login portal falló: ${r.status} ${await r.text()}`)
  const token = (await r.json()).token
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_portal_token', token],
  )
}

/**
 * Las filas de candidato de la tabla del ranking.
 *
 * ⚠️ **Se cuentan por la casilla de avance y no por `tr`.** La fila de detalle
 * desplegada y la celda del «no hay» también son `<tr>`: contarlas daría uno de
 * más justo en las pruebas que comparan con «Se ven N de M».
 */
export const filasDelRanking = (page: Page): Locator =>
  page.locator('table tbody tr', { has: page.locator('input[aria-label^="Avanza "]') })

/** Los nombres visibles, en el orden en que están pintados. */
export async function nombresVisibles(page: Page): Promise<string[]> {
  return filasDelRanking(page)
    .locator('input[aria-label^="Avanza "]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute('aria-label')!.replace(/^Avanza /, '')))
}

/** La cabecera ordenable por su texto (el `th` lleva el `aria-sort`). */
export const cabecera = (page: Page, titulo: string): Locator =>
  page.locator('table thead th').filter({ has: page.getByRole('button', { name: titulo, exact: true }) })

/**
 * Las tres vacantes sembradas, por TÍTULO y no por id.
 *
 * ⚠️ **Los ids no son estables.** Dependen de cuántas veces se haya sembrado la
 * base: en una siembra limpia salen 1, 2 y 3, y en una base que ya tenía intentos
 * previos salieron 7, 8 y 9. Fijarlos a mano hace que la suite pase hoy y falle
 * mañana contra los mismos datos, que es la forma más cara de tener una prueba.
 *
 * `LLENA` es la preparada a mano —ciudades, grupos, notas y pretensión— y es
 * donde se prueban orden y filtros. Las otras dos no traen pretensión y sirven
 * justo para el caso contrario: que la columna desaparezca.
 */
export const VACANTES = {
  LLENA: 'Desarrollador web',
  SIN_PRETENSION: 'Líder de operaciones',
  OTRA: 'Analista de experiencia del cliente',
} as const

const idsPorTitulo = new Map<string, number>()

/** El id de una vacante por su título, preguntado al backend una sola vez. */
export async function idDeVacante(titulo: string): Promise<number> {
  if (idsPorTitulo.size === 0) {
    const r = await fetch(`${API}/panel/vacantes`, {
      headers: { Authorization: `Bearer ${await tokenDelPanel()}` },
    })
    if (!r.ok) throw new Error(`no se pudo listar vacantes: ${r.status}`)
    const cuerpo = await r.json()
    const lista = Array.isArray(cuerpo) ? cuerpo : (cuerpo.contenido ?? cuerpo.filas ?? [])
    for (const v of lista) idsPorTitulo.set(v.titulo, v.id)
  }
  const id = idsPorTitulo.get(titulo)
  if (id == null) {
    throw new Error(
      `No hay ninguna vacante titulada «${titulo}». ¿Se sembró la base? ` +
        `Las que hay: ${[...idsPorTitulo.keys()].join(', ') || '(ninguna)'}`,
    )
  }
  return id
}

export async function irAVacante(page: Page, titulo: string) {
  const id = await idDeVacante(titulo)
  await page.goto(`/admin/vacantes/${id}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
}

export const pestana = (page: Page, nombre: string): Locator =>
  page.getByRole('tab', { name: nombre, exact: true })

export const corte = (page: Page, nombre: string): Locator =>
  page.getByRole('group', { name: 'Qué filas se ven' }).getByRole('button', { name: new RegExp(`^${nombre}`) })

export const abrirMasFiltros = async (page: Page) => {
  const resumen = page.getByText('Ciudad, nota y pretensión')
  const abierto = await page.locator('details').first().evaluate((d) => (d as HTMLDetailsElement).open)
  if (!abierto) await resumen.click()
}
