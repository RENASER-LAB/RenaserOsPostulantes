import { expect, test, type Page } from '@playwright/test'

/**
 * «Me olvidé mi contraseña» en 375 px (AC-21). Este archivo lo corre el
 * proyecto `movil`: su nombre acaba en `movil.spec.ts`.
 *
 * No escribe nada: las cuatro pantallas se abren sin cuenta, y la de elegir la
 * contraseña con un token inventado —abrirla no llama al servidor, así que no
 * hace falta uno de verdad para medirla—.
 */

async function sinScrollHorizontal(page: Page) {
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(desborda, 'la página entera no debe poder desplazarse en horizontal').toBe(false)
}

/** El botón ocupa el ancho de su columna: en el teléfono no se queda a medias. */
async function botonAlAncho(page: Page, nombre: string) {
  const medidas = await page.getByRole('button', { name: nombre }).evaluate((b) => ({
    boton: b.getBoundingClientRect().width,
    columna: (b.closest('form') ?? b.parentElement!).getBoundingClientRect().width,
  }))
  expect(medidas.boton).toBeGreaterThanOrEqual(medidas.columna - 1)
}

test.describe('Móvil 375px · me olvidé mi contraseña', () => {
  for (const ruta of ['/clave', '/admin/clave']) {
    test(`${ruta} se lee y se completa sin scroll horizontal`, async ({ page }) => {
      await page.goto(ruta)
      await expect(page.getByLabel('Correo')).toBeVisible()
      await sinScrollHorizontal(page)
      await botonAlAncho(page, 'Enviar enlace')
    })
  }

  for (const ruta of ['/restablecer', '/admin/restablecer']) {
    test(`${ruta} se lee sin scroll horizontal, con el ojo dentro del campo`, async ({ page }) => {
      await page.goto(`${ruta}?token=${'x'.repeat(43)}`)
      const campo = page.getByLabel(/^Contraseña nueva/)
      await expect(campo).toBeVisible()
      await sinScrollHorizontal(page)
      await botonAlAncho(page, 'Guardar contraseña')

      const ojo = page.getByRole('button', { name: 'Mostrar la contraseña' }).first()
      const cajaCampo = (await campo.boundingBox())!
      const cajaOjo = (await ojo.boundingBox())!
      expect(cajaOjo.x).toBeGreaterThanOrEqual(cajaCampo.x)
      expect(cajaOjo.x + cajaOjo.width).toBeLessThanOrEqual(cajaCampo.x + cajaCampo.width + 1)
    })
  }
})
