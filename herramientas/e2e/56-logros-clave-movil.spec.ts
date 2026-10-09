import { expect, type Locator, type Page } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  test,
  tokenDelCandidato,
} from './ayuda-candidato'

/**
 * Los logros clave en 375 px (AC-05). Este archivo lo corre el proyecto
 * `movil`: su nombre acaba en `movil.spec.ts`.
 *
 * Un logro de 100 caracteres ocupa en la cabecera como mucho dos líneas y
 * termina en «…»; en «Acerca de ti» se lee entero. Se mide el texto pintado, no
 * la clase: lo que importa es cuántas líneas ve la persona.
 *
 * ⚠️ **ESCRIBE**: crea `e2e.logros.movil.<uuid>@example.com`, le pone los
 * logros por la API —lo que se mide aquí es cómo se pintan, no el formulario,
 * que recorre `56-logros-clave`— y la borra al terminar.
 */

const CORREO = correoDePrueba('e2e.logros.movil')

/** Cien caracteres justos, con palabras de verdad: así parte como lo haría uno real. */
const CIEN = 'Reduje de 3 s a 400 ms la respuesta de la API de pagos que atiende a dos millones de clientes al mes'
const CORTO = 'Migré 40 servicios a AWS sin caídas'

const textoEn = (zona: Locator): Locator =>
  zona.getByRole('list', { name: 'Logros clave' }).getByText(CIEN, { exact: true })

/** Cuántas líneas ocupa un texto pintado, y si se le recortó algo. */
async function medir(texto: Locator) {
  return texto.evaluate((el) => {
    const alto = el.getBoundingClientRect().height
    const linea = parseFloat(getComputedStyle(el).lineHeight)
    return { lineas: Math.round(alto / linea), recortado: el.scrollHeight > el.clientHeight + 1 }
  })
}

async function sinScrollHorizontal(page: Page) {
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(desborda, 'la página entera no debe poder desplazarse en horizontal').toBe(false)
}

test.describe('Los logros clave en el teléfono', () => {
  test.beforeAll(async () => {
    expect(CIEN).toHaveLength(100)
    await crearCuentaDeCandidato({ nombre: 'Prueba', apellidos: 'De Logros', correo: CORREO })
    const token = await tokenDelCandidato(CORREO)
    const r = await fetch(`${API}/portal/perfil`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ titular: 'Desarrollador Backend', logros: [CIEN, CORTO] }),
    })
    if (!r.ok) throw new Error(`No se pudieron guardar los logros (${r.status}): ${await r.text()}`)
  })

  test.afterAll(() => borrarCuentasDePrueba([CORREO]))

  test('AC-05 · cien caracteres: dos líneas con «…» en la cabecera, enteros en «Acerca de ti»', async ({
    page,
  }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto('/perfil')
    const cabecera = page
      .locator('header')
      .filter({ has: page.getByRole('heading', { level: 1, name: 'Prueba De Logros' }) })
    await expect(cabecera).toBeVisible({ timeout: 20_000 })

    const arriba = await medir(textoEn(cabecera))
    expect(arriba.lineas, 'en la cabecera, dos líneas como mucho').toBeLessThanOrEqual(2)
    expect(arriba.recortado, 'y lo que no cabe se corta con «…»').toBe(true)

    const acercaDe = page.locator('#seccion-acerca-de-ti')
    await textoEn(acercaDe).scrollIntoViewIfNeeded()
    const abajo = await medir(textoEn(acercaDe))
    expect(abajo.recortado, 'en «Acerca de ti» no se corta nada').toBe(false)
    expect(abajo.lineas, 'y en 375 px eso son más de dos líneas').toBeGreaterThan(2)

    // Los dos sitios, con el mismo número delante y en el mismo orden.
    for (const zona of [cabecera, acercaDe]) {
      const items = zona.getByRole('list', { name: 'Logros clave' }).getByRole('listitem')
      await expect(items).toHaveCount(2)
      // El texto entero está en el DOM también en la cabecera: un lector lo lee completo.
      await expect(items.nth(0)).toHaveText(`1${CIEN}`)
      await expect(items.nth(1)).toHaveText(`2${CORTO}`)
    }

    // La lista ocupa el ancho de la tarjeta, sin desbordar la pantalla.
    await sinScrollHorizontal(page)
  })
})
