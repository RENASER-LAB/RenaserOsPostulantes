import { expect, type Locator, type Page } from '@playwright/test'
import { API, tokenDelPanel } from './ayuda'

/**
 * Ayudas para los specs que hablan con el backend del panel SIN navegador y
 * después miran la pantalla de Configuración: el banco de preguntas (`19`), la
 * prueba del puesto (`20`) y la simulación con los permisos (`21`).
 *
 * Viven aparte de `ayuda.ts` porque aquella la leen todos los specs y esto solo
 * lo necesitan los tres que comprueban el contrato antes de abrir una pestaña.
 */

// ---------- La API del panel, sin navegador ----------

/** Lo que contestó el backend. `cuerpo` es el JSON si lo hubo; si no, el texto. */
export interface Respuesta<T = unknown> {
  estado: number
  cuerpo: T
}

let token: string | null = null

/**
 * Una llamada al backend del panel con el token de `dev-equipo`.
 *
 * ⚠️ **Primero el estado y después el cuerpo, como manda la casa**: un 500 vacío
 * se colaba como éxito al mirarlo al revés. Por eso devuelve las dos cosas y
 * nunca lanza por un 4xx: los 409 son justamente lo que estos specs vienen a
 * leer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiPanel<T = any>(
  camino: string,
  opciones: { method?: string; cuerpo?: unknown } = {},
): Promise<Respuesta<T>> {
  token ??= await tokenDelPanel()
  const r = await fetch(`${API}/panel${camino}`, {
    method: opciones.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  })
  const texto = await r.text()
  let cuerpo: unknown = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: r.status, cuerpo: cuerpo as T }
}

/** El `detail` del problema, o el cuerpo entero: lo que se lee cuando un `expect` falla. */
export const detalleDe = (r: Respuesta): string => {
  const cuerpo = r.cuerpo as { detail?: unknown } | null
  return `estado ${r.estado}: ${JSON.stringify(cuerpo?.detail ?? r.cuerpo)}`
}

/** El `detail` como texto, para casarlo con una expresión. */
export const detail = (r: Respuesta): string =>
  String((r.cuerpo as { detail?: unknown } | null)?.detail ?? '')

// ---------- El banco de preguntas ----------

export interface VersionDelBanco {
  id: number
  tipoBanco: string
  nivelPuestoCodigo: string | null
  etiqueta: string
  estado: 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA'
  minutosObjetivo: number | null
  publicadaEn: string | null
}

/** Lo que la base tenga, con su estado. Se lee una vez y se reparte. */
export async function versionesDelBanco(): Promise<VersionDelBanco[]> {
  const r = await apiPanel<VersionDelBanco[]>('/banco-preguntas/versiones')
  if (r.estado !== 200 || !Array.isArray(r.cuerpo)) {
    throw new Error(`GET /banco-preguntas/versiones contestó ${detalleDe(r)}`)
  }
  return r.cuerpo
}

/**
 * Un borrador propio, de usar y tirar.
 *
 * Es lo único que estos specs escriben en el banco: nace vacío, choca con el
 * 409 de «banco vacío» al publicarlo y se borra al terminar, así que la base
 * queda como estaba. Su etiqueta empieza por «e2e-banco » para reconocerlo si
 * un recorrido muere a mitad y lo deja vivo.
 *
 * Se crea en el nivel de una PUBLICADA a propósito: así la pregunta de antes
 * de publicar tiene una hermana que nombrar, que es la rama que se comprueba.
 */
export async function crearBorradorDeUsarYTirar(
  etiqueta: string,
  versiones: VersionDelBanco[],
): Promise<number> {
  const nivel =
    versiones.find((v) => v.tipoBanco === 'NIVEL' && v.estado === 'PUBLICADA')?.nivelPuestoCodigo ??
    versiones.find((v) => v.tipoBanco === 'NIVEL')?.nivelPuestoCodigo ??
    'DIRECCION'
  const r = await apiPanel<{ id?: number }>('/banco-preguntas/versiones', {
    method: 'POST',
    cuerpo: { tipoBanco: 'NIVEL', nivelPuestoCodigo: nivel, etiqueta },
  })
  expect(r.estado, `POST /versiones → ${detalleDe(r)}`).toBe(201)
  expect(typeof r.cuerpo?.id).toBe('number')
  return r.cuerpo.id as number
}

export const descartarVersion = (id: number) =>
  apiPanel(`/banco-preguntas/versiones/${id}`, { method: 'DELETE' })

/**
 * Abre Configuración y **espera a que el banco esté**, con sus versiones.
 *
 * Contra el backend real un `waitForTimeout` fijo no vale: se espera a que la
 * pieza exista. Devuelve la sección del banco, que es donde se busca todo lo
 * demás —la de permisos también tiene `h3` y `li`—.
 */
export async function abrirElBanco(page: Page): Promise<Locator> {
  await page.goto('/admin/configuracion')
  const seccion = page.locator('section', {
    has: page.getByRole('heading', { name: 'El banco de preguntas' }),
  })
  await expect(seccion).toBeVisible({ timeout: 20_000 })
  await expect(seccion.getByRole('button', { name: 'Ver qué contiene' }).first()).toBeVisible({
    timeout: 20_000,
  })
  return seccion
}

/** La fila de una versión, por su etiqueta exacta. */
export const filaDelBanco = (seccion: Locator, etiqueta: string): Locator =>
  seccion.getByRole('listitem').filter({ has: seccion.page().getByText(etiqueta, { exact: true }) })
