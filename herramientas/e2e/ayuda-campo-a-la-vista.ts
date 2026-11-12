import { expect, type Page } from '@playwright/test'

/**
 * El campo al que se lleva el foco tras enviar con errores, ENTERO a la vista: su
 * etiqueta, el campo y lo que nombra su `aria-describedby` —la ayuda y el error—,
 * dentro de la ventana y sin nada encima.
 *
 * «Sin nada encima» se mira con `elementFromPoint` en varios puntos de cada pieza,
 * así que vale igual para la cabecera fija del portal, la barra del panel y la
 * cabecera o el pie de una ventana: lo que tape algo se ve en ese punto. No depende
 * de cómo se marque la cabecera ni de cuánto mida.
 *
 * En un grupo de opciones (las estrellas) cuentan la `<legend>` y el error del
 * `fieldset`; la opción en sí suele ser un `input` de 1 px que no se pinta.
 */

/** Escritorio y el teléfono de la revisión. */
export const TAMANOS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const

interface Informe {
  vistas: string[]
  fallos: string[]
}

export async function loEnfocadoSeVeEntero(page: Page, donde: string): Promise<void> {
  const informe: Informe = await page.evaluate(async () => {
    // El foco y el desplazamiento van en el fotograma siguiente al error.
    await new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo())))
    const campo = document.activeElement as HTMLElement | null
    if (!campo || campo === document.body) return { vistas: [], fallos: ['no hay nada enfocado'] }

    const porId = (ids: string | null): HTMLElement[] =>
      (ids ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id))
        .filter((e): e is HTMLElement => e !== null)

    const piezas: [string, Element][] = []
    const etiquetas = (campo as HTMLInputElement).labels
    for (const etiqueta of etiquetas ? Array.from(etiquetas) : []) piezas.push(['etiqueta', etiqueta])
    piezas.push(['campo', campo])
    for (const e of porId(campo.getAttribute('aria-describedby'))) {
      piezas.push([e.id.endsWith('-error') ? 'error' : `descripción #${e.id}`, e])
    }
    const esOpcion = campo instanceof HTMLInputElement && (campo.type === 'radio' || campo.type === 'checkbox')
    const grupo = campo.closest('fieldset')
    if (grupo && esOpcion) {
      const leyenda = grupo.querySelector(':scope > legend')
      if (leyenda) piezas.push(['leyenda', leyenda])
      for (const e of porId(grupo.getAttribute('aria-describedby'))) piezas.push(['error', e])
    }

    const vistas: string[] = []
    const fallos: string[] = []
    for (const [nombre, pieza] of piezas) {
      const caja = pieza.getBoundingClientRect()
      if (caja.width <= 1 || caja.height <= 1) continue
      vistas.push(nombre)
      if (caja.top < 0 || caja.bottom > window.innerHeight) {
        fallos.push(`${nombre}: fuera de la ventana (${Math.round(caja.top)}–${Math.round(caja.bottom)} de ${window.innerHeight})`)
        continue
      }
      const xs = [caja.left + Math.min(8, caja.width / 2), caja.left + caja.width / 2]
      const ys = [caja.top + 2, caja.top + caja.height / 2, caja.bottom - 2]
      buscar: for (const x of xs) {
        for (const y of ys) {
          const encima = document.elementFromPoint(x, y)
          if (encima && (encima === pieza || pieza.contains(encima) || encima.contains(pieza))) continue
          const quien = encima ? `<${encima.tagName.toLowerCase()} class="${String(encima.className).slice(0, 40)}">` : 'nada'
          fallos.push(`${nombre}: tapado en (${Math.round(x)}, ${Math.round(y)}) por ${quien}`)
          break buscar
        }
      }
    }
    return { vistas, fallos }
  })

  expect(informe.fallos, `${donde}: nada de lo enfocado queda tapado`).toEqual([])
  expect(informe.vistas, `${donde}: se ve el mensaje de error`).toContain('error')
  expect(
    informe.vistas.some((n) => n === 'etiqueta' || n === 'leyenda'),
    `${donde}: se ve la etiqueta (o la leyenda del grupo)`,
  ).toBe(true)
}
