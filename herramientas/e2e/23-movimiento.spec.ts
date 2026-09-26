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
 * ⚠️ **Y muestrea en el instante en que la franja entra al DOM, no solo frame a
 * frame.** Con solo `requestAnimationFrame`, bajo carga el primer frame que se
 * pinta puede llegar con la animacion ya avanzada —en una corrida entera se
 * vio un minimo de 0,88 al volver a la portada—: el reloj de `motion` corre
 * aunque el navegador no pinte. La franja nace con `transform: scaleX(0)`
 * escrito en su estilo (y en `none`, escala 1, con el movimiento reducido),
 * asi que leerla al entrar da su punto de partida real.
 *
 * ⚠️ **No comprueban que quede bonito.** Eso no lo sabe una prueba; para eso hay
 * que mirarlo.
 */

import { expect, test, type Page } from '@playwright/test'

/**
 * La primera franja del recorrido de la portada.
 *
 * ⚠️ **Se busca por `aria-hidden`, no por posicion.** Esto decia `ol li > div`,
 * y el 22/09/2026 dejo de apuntar a la franja sin que nadie se enterara: cada
 * etapa se envolvio en la pieza E para que asome escalonada, asi que el primer
 * `div` del `<li>` paso a ser ese envoltorio. El envoltorio mueve `y`, nunca
 * `scaleX`, de modo que la prueba leia una escala de 1 constante y fallaba
 * diciendo que la franja «no se dibujo» cuando se dibujaba perfectamente.
 *
 * La franja es el unico `div` decorativo de la etapa —los demas hijos son
 * parrafos—, y `aria-hidden` es parte de lo que la pieza promete, no un detalle
 * de como este anidada hoy.
 */
const FRANJA = 'ol li div[aria-hidden="true"]'

/** Lo que anota el observador por cada vez que la franja entra al DOM. */
interface Escala {
  min: number
  max: number
  visto: number
  /** Ya pasaron los `ms` de la anotacion: se puede leer. */
  listo: boolean
}

/**
 * El observador, en el idioma del navegador. Cada vez que la franja entra al
 * DOM abre una anotacion en `window.__escalas` y le sigue la escala durante
 * `ms`: la primera muestra en el mismo instante en que aparece —un
 * `MutationObserver`, antes del primer frame— y las siguientes, frame a frame.
 *
 * ⚠️ **Va con `addInitScript`, que corre una vez por documento, y las
 * navegaciones dentro del portal no cambian de documento.** Por eso el mismo
 * observador ve tambien la vuelta a la portada: cada aparicion de la franja es
 * una anotacion mas, y la prueba lee la que le toca.
 */
const OBSERVADOR = ([selector, ms]: readonly [string, number]) => {
  const w = window as unknown as { __escalas: Escala[] }
  const escalas: Escala[] = []
  w.__escalas = escalas
  let vigilada: Element | null = null

  const seguir = (franja: Element) => {
    const anotacion: Escala = {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      visto: 0,
      listo: false,
    }
    escalas.push(anotacion)
    const t0 = performance.now()
    const mirar = () => {
      if (franja.isConnected) {
        const a = new DOMMatrixReadOnly(getComputedStyle(franja).transform).a
        if (a < anotacion.min) anotacion.min = a
        if (a > anotacion.max) anotacion.max = a
        anotacion.visto += 1
      }
      if (performance.now() - t0 < ms) requestAnimationFrame(mirar)
      else anotacion.listo = true
    }
    mirar()
  }

  const buscar = () => {
    const franja = document.querySelector(selector)
    if (franja !== null && franja !== vigilada) seguir(franja)
    vigilada = franja
  }
  new MutationObserver(buscar).observe(document, { childList: true, subtree: true })
  buscar()
}

/** Instala el observador para la proxima carga. Hay que llamarlo antes de `goto`. */
async function observarAlCargar(pagina: Page, ms = 2000) {
  await pagina.addInitScript(OBSERVADOR, [FRANJA, ms] as const)
}

/** Cuantas veces ha entrado la franja al DOM hasta ahora. */
function apariciones(pagina: Page) {
  return pagina.evaluate(() => ((window as unknown as { __escalas?: Escala[] }).__escalas ?? []).length)
}

/** La anotacion numero `cual` (desde 0), una vez cerrada. */
async function leerEscala(pagina: Page, cual = 0) {
  await pagina.waitForFunction(
    (i) => (window as unknown as { __escalas?: Escala[] }).__escalas?.[i]?.listo === true,
    cual,
    { timeout: 8_000 },
  )
  return pagina.evaluate((i) => (window as unknown as { __escalas: Escala[] }).__escalas[i]!, cual)
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
    // El mismo observador de la carga: sigue vivo en la vuelta, que no cambia
    // de documento. Antes se instalaba con `page.evaluate` justo antes de
    // volver y solo por frames, y bajo carga su primera muestra llegaba con la
    // franja ya casi entera (0,88 en una corrida completa).
    await observarAlCargar(page)
    await page.goto('/')
    const tarjeta = primeraVacante(page)
    await expect(tarjeta).toBeVisible()
    const titulo = await tarjeta.locator('h3').innerText()
    await tarjeta.locator('a').first().click()
    await expect(page).toHaveURL(/\/vacantes\/\d+$/)

    /*
     * ⚠️ **La URL cambia antes de que la portada se vaya, asi que hay que
     * esperar a la ficha pintada.** React Router escribe la direccion con
     * `pushState` en el mismo clic, y React monta la ficha un poco despues.
     * Esta prueba volvia atras en cuanto cambiaba la URL: con la maquina
     * cargada —la corrida entera, o la CPU frenada x4 por CDP, que lo reproduce
     * siempre— el `popstate` llegaba antes de que React desmontara la portada,
     * las dos navegaciones se resolvian en una y la portada no llegaba a irse.
     * Sin salida no hay vuelta que animar: la franja era la misma, el
     * observador no abria anotacion nueva y `leerEscala` agotaba sus 8 s.
     *
     * El titular de la tarjeta en el `h1` dice que la ficha se pinto, y sin
     * franjas en el documento, que la portada salio de verdad.
     */
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    await expect(page.locator(FRANJA), 'la portada no salio al abrir la ficha').toHaveCount(0)

    // Lo anotado hasta aqui es de la primera carga; la vuelta abre la siguiente.
    const antes = await apariciones(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)

    // La portada montada otra vez: su recorrido vuelve al documento y la
    // franja nueva abre su anotacion.
    await expect(page.locator(FRANJA).first()).toBeAttached()
    await expect
      .poll(() => apariciones(page), { message: 'la franja no volvio a entrar al volver a la portada' })
      .toBeGreaterThan(antes)

    /*
     * El umbral se deja mas flojo que en la carga inicial —0,6 y no 0,2—: en la
     * vuelta la pantalla vieja se funde primero (`AnimatePresence mode="wait"`)
     * y hay mas trabajo entre que la franja entra y su primer frame. Lo que se
     * comprueba es que empezo claramente encogida y termino entera, no el
     * valor exacto del primer frame.
     */
    const { min, max, visto } = await leerEscala(page, antes)
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
