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

/**
 * El botón ocupa el ancho de su columna: en el teléfono no se queda a medias.
 *
 * ⚠️ **La columna es el hueco INTERIOR del formulario, no su borde exterior.**
 * Esto medía `getBoundingClientRect()`, que incluye relleno y borde, y funcionaba
 * solo porque el formulario no tenía ninguno de los dos. Desde el 23/09/2026 el
 * del portal va sobre una superficie —`.superficieDelFormulario`, que es como se
 * leen todos los formularios de esa familia— y en móvil esa superficie pone 24 px
 * de relleno y 1 px de borde por lado: el botón salía 50 px «corto» estando
 * perfectamente a ras. Restando el relleno se mide lo que la prueba quiere decir,
 * y deja de depender de que la caja no tenga ninguno.
 *
 * Esa superficie se fue el 25/09/2026, cuando las cuatro pantallas pasaron a la
 * tarjeta de `/ingresar` y el formulario volvió a no tener relleno. La resta se
 * queda: sigue midiendo lo mismo si algún día vuelve a tenerlo.
 */
async function botonAlAncho(page: Page, nombre: string) {
  const medidas = await page.getByRole('button', { name: nombre }).evaluate((b) => {
    const caja = b.closest('form') ?? b.parentElement!
    const estilo = getComputedStyle(caja)
    return {
      boton: b.getBoundingClientRect().width,
      // `clientWidth` ya deja fuera el borde; el relleno hay que restarlo.
      columna:
        caja.clientWidth -
        parseFloat(estilo.paddingLeft) -
        parseFloat(estilo.paddingRight),
    }
  })
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
