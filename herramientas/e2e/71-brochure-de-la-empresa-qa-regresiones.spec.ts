/**
 * Regresiones de la QA de «El brochure de la empresa, armado solo»
 * (specs/Ready/brochure-de-la-empresa, V86), halladas al explorar con Chrome visible.
 *
 *   - F-01: el PDF que abre el panel se guarda con un nombre aleatorio (`9bf82ef4-….pdf`) en vez
 *     de «Brochure - {empresa}.pdf» (paso 6, AC-03). Desde el perfil público sí sale bien.
 *   - F-02: pasado un minuto, la pestaña del brochure ya no sirve el PDF: guardarlo desde el visor
 *     de Chrome falla con «Error de red», y volver atrás tras pulsar un enlace del PDF o recargar
 *     da «No se pudo acceder a tu archivo» (paso 6: «donde el navegador deja verlo, guardarlo o
 *     imprimirlo»).
 *   - Feedback del usuario: a 390 px con barra de desplazamiento clásica, «Añadir» de los
 *     beneficios se salía 9 px del bloque y la página se desplazaba de lado.
 *   - Feedback del usuario tras la QA: el brochure va en su propia pestaña («Perfil» y
 *     «Brochure», `?pestana=brochure`); tampoco se sale nada a 390, 375 ni 320 px.
 *
 * En headless, Chromium entrega como descarga lo que el navegador con ventana abre en su visor:
 * el nombre que propone esa descarga es el que el visor propone al guardar, y su dirección es la
 * que el visor vuelve a pedir al guardar o al recargar.
 *
 * ⚠️ **ESCRIBE** en el clon: una cuenta `qa-broch-08db-*` y la presentación de la plataforma (la
 * de `dev-equipo`), que se fotografía antes y se devuelve al terminar.
 */

import { expect, type Download, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { entrarAlPanelComo, type Empresa } from './ayuda-proposito-de-la-empresa'
import {
  devolver,
  elPanelDeLaPestana,
  fotoDe,
  irALaPestana,
  laPestanaDelModulo,
  laPlataforma,
  NOMBRE_DEL_ARCHIVO,
  retirarLoSembrado,
  sembrarCuentaDePanel,
  vaciarLaPresentacion,
  type Foto,
} from './ayuda-brochure'
import { literal, sql } from './base-de-datos'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

let plataforma: Empresa
let foto: Foto
let talento = ''

test.beforeAll(() => {
  retirarLoSembrado()
  plataforma = laPlataforma()
  foto = fotoDe(plataforma.id)
  vaciarLaPresentacion(plataforma.id)
  sql(`update organizacion set quienes_somos = ${literal('Somos la consultora que conecta personas y propósito.')}
        where id = ${plataforma.id};`)
  talento = sembrarCuentaDePanel('talento-regresion', 'TALENTO').renaserOsId
})

test.afterAll(async () => {
  const errores: unknown[] = []
  for (const paso of [() => devolver(foto), () => retirarLoSembrado()]) {
    try { paso() } catch (error) { errores.push(error) }
  }
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza: ${errores.map(String).join('\n')}`)
})

test('F-01 · F-02: el PDF que abre el panel se guarda como «Brochure - {empresa}.pdf» y la pestaña lo sigue sirviendo pasado un minuto', async ({ page }) => {
  test.setTimeout(150_000)
  await entrarAlPanelComo(page, talento)
  await page.goto('/admin/empresa?pestana=brochure')
  const boton = elPanelDeLaPestana(page, 'Brochure').getByRole('button', { name: 'Descargar brochure (PDF)' })
  await expect(boton).toBeEnabled()

  const entregada = new Promise<Download>((listo) => page.once('popup', (p) => p.once('download', listo)))
  await Promise.all([page.waitForEvent('popup'), boton.click()])
  const descarga = await entregada
  expect.soft(descarga.suggestedFilename(), 'F-01: el nombre al guardar').toBe(NOMBRE_DEL_ARCHIVO(plataforma.nombre))

  // El visor de Chrome vuelve a pedir esa dirección al guardar o al recargar, aunque sea más tarde.
  await page.waitForTimeout(65_000)
  const sigue = await page.evaluate(async (direccion) => {
    try {
      const r = await fetch(direccion)
      return r.ok ? (await r.blob()).size : -r.status
    } catch (fallo) {
      return String(fallo)
    }
  }, descarga.url())
  expect(typeof sigue === 'number' && sigue > 0, `F-02: la pestaña sigue sirviendo el PDF (${descarga.url()} → ${sigue})`).toBe(true)
})

/**
 * Lo que se sale del contenido de su bloque en la pestaña abierta: cada elemento visible cuyo borde
 * derecho pasa del borde interior (sin relleno ni filete) de la sección que lo contiene.
 */
async function loQueSeSale(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fuera: string[] = []
    for (const seccion of document.querySelectorAll<HTMLElement>('[role="tabpanel"] section')) {
      const caja = seccion.getBoundingClientRect()
      const estilo = getComputedStyle(seccion)
      const borde = caja.right - parseFloat(estilo.paddingRight) - parseFloat(estilo.borderRightWidth)
      for (const el of seccion.querySelectorAll<HTMLElement>('*')) {
        const r = el.getBoundingClientRect()
        if (r.width > 1 && r.right > borde + 0.5) {
          fuera.push(`${seccion.getAttribute('aria-labelledby') ?? 'brochure'} › ${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 30)}» (${Math.round(r.right - borde)} px)`)
        }
      }
    }
    return fuera
  })
}

async function sinDesplazamientoHorizontal(page: Page) {
  const medidas = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, ventana: document.documentElement.clientWidth }))
  expect(medidas.ancho, 'sin desplazamiento horizontal').toBeLessThanOrEqual(medidas.ventana)
}

/*
 * Feedback del usuario tras la QA: a 390 px con barra de desplazamiento clásica, «Añadir» de los
 * beneficios sobresalía 9 px del bloque y la página se desplazaba de lado. El campo no encogía por
 * debajo del ancho propio del `<input>`. La suite oculta las barras, así que se mide también a
 * 375 px (390 menos una barra clásica de 15) y a 320 px, y en las dos pestañas, que nada se salga
 * de su bloque ni de la pantalla.
 */
for (const ancho of [390, 375, 320]) {
  test.describe(`${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 844 } })

    test(`a ${ancho} px nada se sale de su bloque: ni «Añadir», ni un beneficio largo sin espacios en «Perfil», ni la elección y la primera hoja en «Brochure»`, async ({ page }) => {
      await entrarAlPanelComo(page, talento)
      await page.goto('/admin/empresa')
      await expect(elPanelDeLaPestana(page, 'Perfil')).toBeVisible()
      for (const nombre of ['Perfil', 'Brochure'] as const) {
        const caja = (await laPestanaDelModulo(page, nombre).boundingBox())!
        expect(caja.x + caja.width, `la pestaña «${nombre}» dentro de la pantalla`).toBeLessThanOrEqual(ancho)
      }

      // Un beneficio de 40 letras sin espacios, solo en el borrador: no se guarda.
      await page.getByRole('textbox', { name: 'Nuevo beneficio' }).fill('Aseguramientoprivadoconcoberturafamiliar')
      await page.getByRole('button', { name: 'Añadir', exact: true }).click()
      await expect(page.getByRole('list', { name: 'Beneficios' }).getByRole('listitem')).toHaveCount(1)

      expect(await loQueSeSale(page), 'nada se sale de su bloque en «Perfil»').toEqual([])
      await sinDesplazamientoHorizontal(page)

      await irALaPestana(page, 'Brochure')
      const hoja = elPanelDeLaPestana(page, 'Brochure').getByRole('img', { name: /^Primera hoja del brochure/ })
      await hoja.scrollIntoViewIfNeeded()
      await expect(hoja).toBeVisible()
      const cajaHoja = (await hoja.boundingBox())!
      expect(cajaHoja.x, 'la primera hoja dentro de la pantalla').toBeGreaterThanOrEqual(0)
      expect(cajaHoja.x + cajaHoja.width, 'la primera hoja dentro de la pantalla').toBeLessThanOrEqual(ancho)
      expect(await loQueSeSale(page), 'nada se sale de su bloque en «Brochure»').toEqual([])
      await sinDesplazamientoHorizontal(page)

      // El borrador de «Perfil» sigue ahí al volver.
      await irALaPestana(page, 'Perfil')
      await expect(page.getByRole('list', { name: 'Beneficios' }).getByRole('listitem')).toHaveCount(1)
    })
  })
}
