/**
 * Las cuatro piezas de movimiento de la portada, y su interruptor.
 *
 * Las piezas viven en `src/ui/movimiento.tsx` y estan documentadas en DESIGN.md.
 *
 * ⚠️ **Se mide el `transform` del elemento, NO `document.getAnimations()`.**
 * Esta version reemplaza a una que contaba animaciones vivas, y aquella no
 * comprobaba lo que decia: **`motion` no usa la API de animaciones del
 * navegador** para estas piezas —las mueve escribiendo estilos frame a frame—,
 * asi que `getAnimations()` devolvia cero incluso mientras la franja se
 * dibujaba. Las pruebas pasaban contando transiciones CSS de otras cosas, y las
 * dos de movimiento reducido pasaban por comprobar que una lista siempre vacia
 * seguia vacia.
 *
 * Ese error escondio un fallo real durante toda la migracion: la franja **no se
 * dibujaba en la primera carga**, que es justo como casi todo el mundo ve la
 * portada. Ver el comentario de `FranjaQueSeLlena`.
 *
 * ⚠️ **Tampoco se muestrea desde fuera con `expect.poll`.** La franja dura medio
 * segundo: si termino antes de la primera lectura ya no vuelve, y reintentar es
 * esperar un evento que no va a repetirse. El observador se instala ANTES de
 * cargar y anota lo que pasa, asi que da igual cuando mire la prueba.
 *
 * ⚠️ **No comprueban que quede bonito.** Eso no lo sabe una prueba; para eso hay
 * que mirarlo.
 */

import { expect, test, type Page } from '@playwright/test'

/** La primera franja del recorrido de la portada. */
const FRANJA = 'ol li > div'

/** El observador, en el idioma del navegador. Anota la escala minima y maxima. */
const OBSERVADOR = ([selector, ms]: readonly [string, number]) => {
  const w = window as unknown as Record<string, unknown>
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let visto = 0
  const t0 = performance.now()
  const mirar = () => {
    const e = document.querySelector(selector)
    if (e) {
      const a = new DOMMatrixReadOnly(getComputedStyle(e).transform).a
      if (a < min) min = a
      if (a > max) max = a
      visto += 1
    }
    if (performance.now() - t0 < ms) requestAnimationFrame(mirar)
    else w.__escala = { min, max, visto }
  }
  requestAnimationFrame(mirar)
}

/** Instala el observador para la proxima carga. Hay que llamarlo antes de `goto`. */
async function observarAlCargar(pagina: Page, ms = 2000) {
  await pagina.addInitScript(OBSERVADOR, [FRANJA, ms] as const)
}

async function leerEscala(pagina: Page) {
  await pagina.waitForFunction(() => (window as unknown as Record<string, unknown>).__escala, null, {
    timeout: 8_000,
  })
  return pagina.evaluate(
    () =>
      (window as unknown as Record<string, unknown>).__escala as {
        min: number
        max: number
        visto: number
      },
  )
}

/** La primera tarjeta de vacante de la portada. */
function primeraVacante(pagina: Page) {
  return pagina.locator('article').filter({ has: pagina.locator('a[href^="/vacantes/"]') }).first()
}

test.describe('El movimiento de la portada', () => {
  test('C · la franja se dibuja de cero a su ancho en la primera carga', async ({ page }) => {
    await observarAlCargar(page)
    await page.goto('/')

    const { min, max, visto } = await leerEscala(page)
    expect(visto, 'no se llego a ver la franja').toBeGreaterThan(0)
    expect(min, 'la franja no empezo encogida: no se dibujo').toBeLessThan(0.2)
    expect(max, 'la franja no llego a su ancho completo').toBeCloseTo(1, 1)
  })

  test('C · y tambien al volver a la portada desde dentro del portal', async ({ page }) => {
    await page.goto('/')
    await expect(primeraVacante(page)).toBeVisible()
    await primeraVacante(page).locator('a').first().click()
    await expect(page).toHaveURL(/\/vacantes\/\d+$/)

    // Aqui el observador se instala en la pagina ya cargada, para la vuelta.
    await page.evaluate(
      ([sel, ms]) => {
        const w = window as unknown as Record<string, unknown>
        let min = Number.POSITIVE_INFINITY
        let max = Number.NEGATIVE_INFINITY
        let visto = 0
        const t0 = performance.now()
        const mirar = () => {
          const e = document.querySelector(sel as string)
          if (e) {
            const a = new DOMMatrixReadOnly(getComputedStyle(e).transform).a
            if (a < min) min = a
            if (a > max) max = a
            visto += 1
          }
          if (performance.now() - t0 < (ms as number)) requestAnimationFrame(mirar)
          else w.__escala = { min, max, visto }
        }
        requestAnimationFrame(mirar)
      },
      [FRANJA, 2000] as const,
    )
    await page.goBack()

    /*
     * El umbral es mas flojo que en la carga inicial —0,6 y no 0,2— porque aqui
     * el observador se instala DESPUES de que la pagina exista: entre que
     * arranca y toma su primera muestra caben un par de frames, y la franja ya
     * ha crecido. Lo que se comprueba es que empezo claramente encogida y
     * termino entera, no el valor exacto del primer frame.
     */
    const { min, max, visto } = await leerEscala(page)
    expect(visto, 'no se llego a ver la franja al volver').toBeGreaterThan(0)
    expect(min, 'la franja no se dibujo al volver').toBeLessThan(0.6)
    expect(max, 'la franja no llego a su ancho completo').toBeCloseTo(1, 1)
  })

  test('D · la tarjeta se levanta al pasar por encima y vuelve al salir', async ({ page }) => {
    await page.goto('/')
    const tarjeta = primeraVacante(page)
    await expect(tarjeta).toBeVisible()

    const alturaDe = () =>
      tarjeta.evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).f)

    expect(await alturaDe(), 'la tarjeta no empieza en reposo').toBeCloseTo(0, 1)

    await tarjeta.hover()
    await expect
      .poll(alturaDe, { message: 'la tarjeta no se levanto al pasar por encima' })
      .toBeLessThan(-1)

    // Salir de encima: se vuelve a su sitio.
    await page.mouse.move(0, 0)
    await expect.poll(alturaDe, { message: 'la tarjeta no volvio a su sitio' }).toBeCloseTo(0, 0)
  })

  test('B · el titulo de la tarjeta es el titular de la ficha, y llega entero', async ({ page }) => {
    await page.goto('/')
    const tarjeta = primeraVacante(page)
    await expect(tarjeta).toBeVisible()
    const titulo = await tarjeta.locator('h3').innerText()

    await tarjeta.locator('a').first().click()

    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    expect(new URL(page.url()).pathname).toMatch(/^\/vacantes\/\d+$/)
  })

  test('B · el titulo que viaja lleva el numero de su vacante, no un id compartido', async ({
    page,
  }) => {
    await page.goto('/')
    /*
      Dos elementos con el mismo `layoutId` vivos a la vez pelean, y en la
      portada hay una tarjeta por puesto. Motion no expone el id en el DOM, asi
      que se comprueba por su efecto: al pasar por encima de UNA tarjeta solo se
      mueve esa.
    */
    const tarjetas = page.locator('article').filter({ has: page.locator('a[href^="/vacantes/"]') })
    // Las vacantes llegan por red: contarlas antes daria cero y saltaria la prueba.
    await expect(tarjetas.first()).toBeVisible()
    const cuantas = await tarjetas.count()
    test.skip(cuantas < 2, 'hacen falta dos vacantes para comprobarlo')

    await tarjetas.nth(0).hover()
    await expect
      .poll(
        () =>
          tarjetas.evaluateAll(
            (nodos) =>
              nodos.filter((n) => new DOMMatrixReadOnly(getComputedStyle(n).transform).f < -1)
                .length,
          ),
        { message: 'se movio un numero de tarjetas distinto de una' },
      )
      .toBe(1)
  })
})

test.describe('Con el movimiento reducido', () => {
  test('la franja nace a su ancho y no se dibuja en ningun frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await observarAlCargar(page, 1500)
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const { min, max, visto } = await leerEscala(page)
    expect(visto, 'no se llego a ver la franja').toBeGreaterThan(0)
    // Ni un solo frame encogida: nace entera.
    expect(min, 'la franja se dibujo con el movimiento reducido').toBeCloseTo(1, 1)
    expect(max, 'la franja no esta a su ancho completo').toBeCloseTo(1, 1)
  })

  test('la tarjeta no se mueve al pasar por encima, y la ficha sigue abriendo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const tarjeta = primeraVacante(page)
    await expect(tarjeta).toBeVisible()
    const titulo = await tarjeta.locator('h3').innerText()

    await tarjeta.hover()
    await page.waitForTimeout(400)
    const altura = await tarjeta.evaluate(
      (e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).f,
    )
    expect(altura, 'la tarjeta se movio con el movimiento reducido').toBeCloseTo(0, 1)

    await tarjeta.locator('a').first().click()
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
  })
})
