import type { Locator, Page } from '@playwright/test'

/**
 * Ayudas para las pruebas que ESCRIBEN de verdad: el compositor de la prueba
 * del puesto (`15-componer-prueba`) y el recorrido de una vacante
 * (`14-vacante`). Viven aparte de `ayuda.ts` porque aquella la leen todos los
 * specs y esta solo la necesitan los que crean cosas en la base.
 */

// ---------- Los bloques del compositor ----------

/**
 * Los seis bloques del compositor son `<section aria-labelledby=…>`, o sea
 * regiones con nombre. Agarrarlos por ahí es lo que hace que «Cómo se llama» de
 * un entregable no se confunda con el «Cómo se llama» de una plantilla.
 */
export const BLOQUE = {
  BALANCE: 'Lo que falta para publicar',
  DATOS: 'Qué se pide y en cuánto tiempo',
  PREGUNTAS: 'Las preguntas que responderá',
  ENTREGABLES: 'Lo que tiene que entregar',
  RUBRICA: 'Con qué se le pone la nota',
  VARIANTES: 'El cambio inesperado',
} as const

export const bloque = (page: Page, titulo: string): Locator =>
  page.getByRole('region', { name: titulo })

/**
 * ⚠️ **`getByLabel` no sirve en estas pantallas.** Las etiquetas envuelven al
 * control y llevan dentro el texto de ayuda, así que el nombre accesible de la
 * caja del enunciado es «El enunciadoLo que quien la rinde lee para…». Se busca
 * la `<label>` por su principio y se baja al control.
 */
export const campo = (donde: Locator | Page, etiqueta: string): Locator =>
  donde.locator('label').filter({ hasText: etiqueta }).first()

export const escribir = (donde: Locator | Page, etiqueta: string, texto: string) =>
  campo(donde, etiqueta).locator('textarea, input').first().fill(texto)

export const elegir = (donde: Locator | Page, etiqueta: string, valor: string | { label: string }) =>
  campo(donde, etiqueta).locator('select').first().selectOption(valor)

export const leer = (donde: Locator | Page, etiqueta: string) =>
  campo(donde, etiqueta).locator('textarea, input, select').first().inputValue()

/**
 * Una cuenta del balance, buscada por su nombre EXACTO. Devuelve la fila entera
 * («Preguntas universales 8 de 8 a 10 ya está») o `null` si no está pintada.
 *
 * ⚠️ Se compara contra el primer `<span>` de la fila y no contra el texto entero.
 * Los nombres se solapan —«Preguntas» es principio de «Preguntas universales»— y
 * buscar por principio de línea daba por presente el marcador del cuestionario
 * cuando lo que había era el de las universales: la afirmación de que la cuota
 * cambia al añadir un entregable fallaba sola, con la pantalla haciéndolo bien.
 */
export async function laCuenta(page: Page, nombre: string): Promise<string | null> {
  const filas = await bloque(page, BLOQUE.BALANCE).getByRole('listitem').all()
  for (const fila of filas) {
    const suNombre = ((await fila.locator('span').first().textContent()) ?? '').trim()
    if (suNombre === nombre) return ((await fila.textContent()) ?? '').replace(/\s+/g, ' ').trim()
  }
  return null
}

/** Quitar algo de una lista: pulsar «Quitar» y confirmar en el sitio. */
export async function quitarDeLaLista(page: Page, region: string, textoDeLaFila: string, queEs: string) {
  const fila = bloque(page, region).getByRole('listitem').filter({ hasText: textoDeLaFila }).first()
  await fila.getByRole('button', { name: 'Quitar' }).click()
  await fila.getByRole('button', { name: `Sí, quitar ${queEs}` }).click()
}

// ---------- La red y la consola ----------

export interface Vigia {
  /** Lo que no debería haber pasado: respuestas 4xx/5xx sin perdón, errores de página y de consola. */
  fallos: string[]
  /** Cuántos rechazos del servidor se pidieron a propósito y llegaron. */
  rechazosEsperados: number
  /** Cuántos 404 de los conocidos se dejaron pasar. */
  perdonados: number
  /**
   * A partir de aquí, un `estado` en una URL que contenga `enLaUrl` es lo que
   * la prueba está provocando y no cuenta como fallo. Se apaga con `yaNo()`.
   */
  esperarRechazo(enLaUrl: string, estado: number): void
  yaNo(): void
}

/**
 * Vigila la página entera: cualquier respuesta de error, cualquier excepción
 * en la ventana y cualquier `console.error` acaban en `fallos`, que el spec
 * afirma vacío al terminar cada prueba. Es lo que convierte «pasó» en «pasó y
 * no rompió nada por debajo».
 *
 * Los 404 de `perdonar404` son los que significan «no hay» y no «se rompió»,
 * y solo con ese estado: un 500 en la misma URL sigue contando.
 */
export function vigilar(page: Page, { perdonar404 = [] }: { perdonar404?: RegExp[] } = {}): Vigia {
  let esperando: { enLaUrl: string; estado: number } | null = null
  const vigia: Vigia = {
    fallos: [],
    rechazosEsperados: 0,
    perdonados: 0,
    esperarRechazo: (enLaUrl, estado) => {
      esperando = { enLaUrl, estado }
    },
    yaNo: () => {
      esperando = null
    },
  }

  page.on('pageerror', (e) => vigia.fallos.push(`error de página · ${String(e).slice(0, 200)}`))
  // El texto de la consola no trae la URL, así que el 404 se juzga por la
  // respuesta, más abajo; aquí solo se descartan sus ecos.
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const texto = m.text()
    if (texto.includes('404') || texto.includes('Failed to load resource')) return
    vigia.fallos.push(`consola · ${texto.slice(0, 200)}`)
  })
  page.on('response', (r) => {
    if (r.status() < 400) return
    const url = r.url()
    if (esperando && url.includes(esperando.enLaUrl) && r.status() === esperando.estado) {
      vigia.rechazosEsperados++
      return
    }
    if (r.status() === 404 && perdonar404.some((conocido) => conocido.test(url))) {
      vigia.perdonados++
      return
    }
    vigia.fallos.push(`${r.status()} · ${r.request().method()} ${new URL(url).pathname}`)
  })

  return vigia
}

/**
 * Los 404 que el detalle de una vacante levanta sin que nada esté roto:
 *
 *  - `/vacantes/N/ficha`: la ficha del puesto no está escrita —la escribe el
 *    dueño para el cuestionario técnico— y la pantalla la pide para saber si
 *    hay cuestionario publicado. El «no hay» viaja como 404.
 *  - `/plantillas-prueba/versiones/N`: la versión que la vacante tiene puesta
 *    se busca aparte si no salió en el listado de plantillas.
 */
export const PERDONADOS_DE_LA_VACANTE = [/\/vacantes\/\d+\/ficha$/, /\/plantillas-prueba\/versiones\/\d+$/]
