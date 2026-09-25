import { expect, type Locator, type Page } from '@playwright/test'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  sql,
  test,
} from './ayuda-candidato'

/**
 * La ciudad, obligatoria al crear la cuenta.
 *
 * Los recorridos que `specs/ciudad-obligatoria-al-crear-perfil.md` pide dejar
 * repetibles: intentar registrarse sin ciudad, corregirlo y terminar el registro,
 * registrarse con «Fuera del Perú», y entrar con una cuenta que ya existía sin
 * ciudad. Los rechazos por API viven aparte, en el proyecto `e2e/` del backend.
 *
 * ⚠️ **El mensaje se comprueba con `toHaveText` y no con `toContainText`.** Es
 * «Selecciona tu ciudad» **sin punto final**, y eso es deliberado: el resto de los
 * mensajes de este formulario acaban en punto, así que un `contains` dejaría pasar
 * el «arreglo» de añadírselo.
 *
 * ⚠️ **Cada prueba que crea una cuenta usa su propio correo** —`qa.ciudadui.<uuid>@example.com`—
 * y al terminar se limpian solo los correos registrados por esta ejecución. Una cuenta que se queda
 * mueve los recuentos exactos de `05-excel` y `06-sin-ciudad` en la corrida
 * siguiente. El destino de la base sale de `E2E_PG`, `PGUSER` y `PGDATABASE`.
 */

const PREFIJO = 'qa.ciudadui'
const correos: string[] = []
const nuevoCorreo = () => {
  const correo = correoDePrueba(PREFIJO)
  correos.push(correo)
  return correo
}
const EL_ERROR = 'Selecciona tu ciudad'
const FALLO_DEL_CATALOGO = 'No pudimos cargar la lista de ciudades. Vuelve a intentarlo.'
const CATALOGO = '**/portal/catalogos/ubigeo'

/** El desplegable, por su etiqueta: es como lo encuentra quien usa la pantalla. */
const elDesplegable = (page: Page): Locator => page.getByLabel('Ciudad')

/** Todo menos la ciudad, que es lo que cada prueba decide. */
async function rellenarTodoMenosLaCiudad(page: Page, correo: string) {
  await page.getByLabel(/^Nombre/).fill('Camila')
  await page.getByLabel(/^Apellidos/).fill('Ramos Vega')
  await page.getByLabel(/^Correo/).fill(correo)
  await page.getByLabel(/^Contraseña/).fill(CLAVE_DE_CANDIDATO)
  await page.getByLabel('Repite la contraseña').fill(CLAVE_DE_CANDIDATO)
  await page.locator('input[type="checkbox"]').first().check()
}

/** Cuántas cuentas hay con ese correo. Cero significa «no se creó nada». */
function cuantasCuentas(correo: string): number {
  const salida = sql(`select count(*) from usuario where correo = '${correo}';`)
  const numero = salida.match(/^\s*(\d+)\s*$/m)
  if (!numero) throw new Error(`No se pudo leer el recuento de «${correo}»: ${salida}`)
  return Number(numero[1])
}

/** La ciudad guardada de ese correo: el código, `null`, o la marca de que no hay cuenta. */
function laCiudadGuardadaDe(correo: string): string | null {
  const salida = sql(
    `select coalesce(p.ciudad_ubigeo, '<null>') from persona p
      join usuario u on u.persona_id = p.id where u.correo = '${correo}';`,
  )
  const fila = salida
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l === '<null>' || /^[A-Z0-9]{2,6}$/.test(l))
  if (!fila) throw new Error(`No se encontró la ciudad de «${correo}»: ${salida}`)
  return fila === '<null>' ? null : fila
}

/** El `<p>` del error del campo, buscado por el `aria-describedby` del desplegable. */
async function elErrorDelCampo(page: Page): Promise<Locator> {
  const describedBy = await elDesplegable(page).getAttribute('aria-describedby')
  expect(describedBy, 'el desplegable con error tiene que apuntar a su mensaje').toBeTruthy()
  return page.locator(`#${describedBy}`)
}

test.afterAll(() => {
  borrarCuentasDePrueba(correos)
})

test.describe('AC-01 · la pantalla dice que la ciudad es obligatoria antes de pulsar', () => {
  test('la etiqueta lo marca, el desplegable lo anuncia y no hay nada preseleccionado', async ({
    page,
  }) => {
    await page.goto('/registro')
    const ciudad = elDesplegable(page)
    await expect(ciudad).toBeEnabled()

    // Nada elegido: el texto de ayuda vale '' y por eso NO cuenta como elección.
    await expect(ciudad).toHaveValue('')
    const primera = ciudad.locator('option').first()
    await expect(primera).toHaveAttribute('value', '')
    await expect(primera).toHaveText('Elige tu ciudad…')

    // Que es obligatorio, dicho en la etiqueta asociada al campo —no en un texto
    // suelto que un lector de pantalla no leería al llegar al desplegable. El
    // asterisco es lo que se ve; «obligatorio» viaja escondido en la misma
    // etiqueta, porque un `*` a solas se oye como «asterisco» o no se oye.
    const id = await ciudad.getAttribute('id')
    expect(id, 'el desplegable necesita id para que su label lo apunte').toBeTruthy()
    await expect(page.locator(`label[for="${id}"]`)).toHaveText('Ciudad * obligatorio')
    await expect(ciudad).toHaveAttribute('aria-required', 'true')

    // Y antes de enviar nada no hay error: la marca informa, no acusa.
    await expect(ciudad).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(EL_ERROR)).toHaveCount(0)

    // 196 provincias + «Fuera del Perú» + el texto de ayuda. Se comprueba por
    // abajo y no con un número exacto: el catálogo es dato, no contrato.
    expect(await ciudad.locator('option').count()).toBeGreaterThan(100)
    await expect(ciudad.locator('option[value="EXT"]')).toHaveText('Fuera del Perú')
    // Agrupado por departamento, y «Fuera del Perú» suelta al final, fuera de todo `optgroup`.
    await expect(ciudad.locator('optgroup').first()).toHaveAttribute('label', /\w+/)
    await expect(ciudad.locator('> option')).toHaveCount(2) // la vacía + EXT
  })
})

test.describe('AC-02 · sin ciudad no se crea la cuenta y se dice junto al campo', () => {
  test('con el botón: no navega, marca el campo, conserva lo escrito y no nace ninguna cuenta', async ({
    page,
  }) => {
    const correo = nuevoCorreo()
    await page.goto('/registro')
    await rellenarTodoMenosLaCiudad(page, correo)

    await page.getByRole('button', { name: /Crear cuenta/i }).click()

    // No se fue a ningún sitio.
    await expect(page).toHaveURL(/\/registro/)

    // El error, junto al campo y asociado a él por `aria-describedby`.
    const ciudad = elDesplegable(page)
    await expect(ciudad).toHaveAttribute('aria-invalid', 'true')
    const error = await elErrorDelCampo(page)
    await expect(error).toBeVisible()
    await expect(error).toHaveText(EL_ERROR)

    // El foco va al campo que falta: en un formulario largo, un error fuera de
    // la pantalla es un formulario que «no hizo nada».
    await expect(ciudad).toBeFocused()

    // Y el resumen de arriba cuenta uno, no cero ni dos.
    await expect(page.getByText('Falta un dato por revisar. Te lo marcamos abajo.')).toBeVisible()

    // Lo escrito sigue escrito: nadie tiene que teclearlo otra vez.
    await expect(page.getByLabel(/^Nombre/)).toHaveValue('Camila')
    await expect(page.getByLabel(/^Apellidos/)).toHaveValue('Ramos Vega')
    await expect(page.getByLabel(/^Correo/)).toHaveValue(correo)
    await expect(page.getByLabel(/^Contraseña/)).toHaveValue(CLAVE_DE_CANDIDATO)
    await expect(page.getByLabel('Repite la contraseña')).toHaveValue(CLAVE_DE_CANDIDATO)
    await expect(page.locator('input[type="checkbox"]').first()).toBeChecked()

    // Y en la base no hay ni una fila: el rechazo es antes de escribir nada.
    expect(cuantasCuentas(correo)).toBe(0)
  })

  test('con la tecla Enter: el mismo rechazo, que el formulario también se manda así', async ({
    page,
  }) => {
    const correo = nuevoCorreo()
    await page.goto('/registro')
    await rellenarTodoMenosLaCiudad(page, correo)

    // Enter desde un campo de texto envía el formulario: es como se manda un
    // formulario sin llegar al botón, y tiene que validar la ciudad igual.
    await page.getByLabel(/^Apellidos/).press('Enter')

    await expect(page).toHaveURL(/\/registro/)
    await expect(elDesplegable(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(await elErrorDelCampo(page)).toHaveText(EL_ERROR)
    expect(cuantasCuentas(correo)).toBe(0)
  })

})

test.describe('AC-03 · al elegir ciudad el aviso se retira y el registro continúa', () => {
  test('el error se va al corregirlo, el registro termina y la ciudad queda guardada', async ({
    page,
  }) => {
    const correo = nuevoCorreo()
    await page.goto('/registro')
    await rellenarTodoMenosLaCiudad(page, correo)
    await page.getByRole('button', { name: /Crear cuenta/i }).click()
    await expect(await elErrorDelCampo(page)).toHaveText(EL_ERROR)

    // La primera provincia que ofrezca el catálogo, no un código escrito a mano.
    const ciudad = elDesplegable(page)
    const elegida = await ciudad.locator('option').nth(1).getAttribute('value')
    expect(elegida, 'el catálogo tiene que ofrecer al menos una provincia').toBeTruthy()
    await ciudad.selectOption(elegida!)

    // El aviso se retira al corregir, sin esperar a otro envío: si no, se lee
    // «Selecciona tu ciudad» justo debajo de la ciudad que se acaba de elegir.
    await expect(ciudad).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(EL_ERROR)).toHaveCount(0)
    await expect(page.getByText('Falta un dato por revisar. Te lo marcamos abajo.')).toHaveCount(0)

    await page.getByRole('button', { name: /Crear cuenta/i }).click()

    // El flujo habitual sigue: se entra al portal y se ven los procesos.
    await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
    expect(laCiudadGuardadaDe(correo)).toBe(elegida)
  })

  test('el doble clic en «Crear cuenta» con la ciudad puesta crea UNA cuenta, no dos', async ({
    page,
  }) => {
    const correo = nuevoCorreo()
    await page.goto('/registro')
    await rellenarTodoMenosLaCiudad(page, correo)
    await elDesplegable(page).selectOption('EXT')

    // Dos pulsaciones seguidas. El botón se apaga mientras se envía, y esto es lo
    // que comprueba que ese apagado llega a tiempo: dos cuentas con el mismo
    // correo no las puede deshacer nadie desde el portal.
    await page.getByRole('button', { name: /Crear cuenta/i }).dblclick()

    await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
    expect(cuantasCuentas(correo)).toBe(1)
    expect(laCiudadGuardadaDe(correo)).toBe('EXT')
  })

  // Que «Fuera del Perú» (EXT) sea una elección válida y se guarde tal cual lo
  // demuestra el doble clic de arriba, que crea la cuenta con EXT y lo lee de la base.

  test('se elige y se envía solo con el teclado, sin tocar el ratón', async ({ page }) => {
    const correo = nuevoCorreo()
    await page.goto('/registro')
    await rellenarTodoMenosLaCiudad(page, correo)

    const ciudad = elDesplegable(page)
    await ciudad.focus()
    await expect(ciudad).toBeFocused()
    // La rueda nativa del `<select>`: bajar una opción ya es elegir.
    await page.keyboard.press('ArrowDown')
    const elegida = await ciudad.inputValue()
    expect(elegida, 'con el teclado también se elige').not.toBe('')

    /*
      Y el envío con Enter, desde un campo de texto.

      ⚠️ **No desde el desplegable**: en Chromium, Enter sobre un `<select>` no
      manda el formulario —el envío implícito nace de los campos de texto—, así
      que esperarlo ahí probaría el navegador y no la pantalla. Comprobado en la
      exploración: ni envía ni se queda a medias.
    */
    await page.getByLabel('Repite la contraseña').press('Enter')
    await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
    expect(laCiudadGuardadaDe(correo)).toBe(elegida)
  })

  test('en pantalla de teléfono (375 px) el campo, su marca y su error se ven', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const correo = nuevoCorreo()
    await page.goto('/registro')
    const ciudad = elDesplegable(page)
    const id = await ciudad.getAttribute('id')
    await expect(page.locator(`label[for="${id}"]`)).toHaveText('Ciudad * obligatorio')

    await rellenarTodoMenosLaCiudad(page, correo)
    await page.getByRole('button', { name: /Crear cuenta/i }).click()

    const error = await elErrorDelCampo(page)
    await expect(error).toBeVisible()
    await expect(error).toHaveText(EL_ERROR)
    // Visible de verdad: dentro del ancho del teléfono, no cortado a la derecha.
    const caja = await error.boundingBox()
    expect(caja, 'el error tiene que ocupar sitio en pantalla').toBeTruthy()
    expect(caja!.x).toBeGreaterThanOrEqual(0)
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(375)
    // Y el formulario entero, con su desplegable, cabe sin scroll horizontal.
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda, 'el registro no debe poder desplazarse en horizontal').toBe(false)

    await ciudad.selectOption('EXT')
    await expect(page.getByText(EL_ERROR)).toHaveCount(0)
    await page.getByRole('button', { name: /Crear cuenta/i }).click()
    await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
    expect(laCiudadGuardadaDe(correo)).toBe('EXT')
  })
})

test.describe('Caso límite · el catálogo de ciudades no carga', () => {
  test('se informa el fallo, se puede reintentar y no se crea ninguna cuenta sin ciudad', async ({
    page,
  }) => {
    const correo = nuevoCorreo()
    let fallar = true
    await page.route(CATALOGO, async (ruta) => {
      if (fallar) await ruta.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      else await ruta.continue()
    })

    await page.goto('/registro')

    // El fallo se dice con palabras y el desplegable queda apagado: no se ofrece
    // una lista vacía como si fuera una elección posible.
    const ciudad = elDesplegable(page)
    await expect(ciudad).toBeDisabled()
    await expect(page.getByText(FALLO_DEL_CATALOGO)).toBeVisible()

    // Y el aviso del fallo es el que se lee junto al campo.
    await expect(await elErrorDelCampo(page)).toHaveText(FALLO_DEL_CATALOGO)

    /*
      El botón de reintentar, buscado por sus DOS textos: mientras la petición
      está en vuelo se llama «Cargando las ciudades…». Buscarlo solo por el
      nombre en reposo hace que el segundo clic llegue cuando el botón «no
      existe» y la prueba falle por su propia prisa, no por la pantalla.
    */
    const reintentar = page.getByRole('button', {
      name: /Volver a cargar las ciudades|Cargando las ciudades/,
    })
    await expect(reintentar).toBeVisible()
    await expect(reintentar).toHaveText('Volver a cargar las ciudades')

    /*
      Y se alcanza con el teclado. Importa porque el desplegable está apagado, y
      un control apagado no recibe el tabulador: si el botón tampoco estuviera en
      el recorrido, quien navega sin ratón se quedaría sin salida en esta
      pantalla. Se comprueba que el tabulador desde «Correo» cae justo en él.
    */
    await page.getByLabel(/^Correo/).focus()
    await page.keyboard.press('Tab')
    await expect(reintentar).toBeFocused()

    // Con la lista caída, el alta no pasa: ni por el botón ni tras reintentar.
    await rellenarTodoMenosLaCiudad(page, correo)
    await page.getByRole('button', { name: /Crear cuenta/i }).click()
    await expect(page).toHaveURL(/\/registro/)
    expect(cuantasCuentas(correo)).toBe(0)

    // Reintentar es reintentar, no enviar: el botón está dentro del formulario y
    // sin `type="button"` lo mandaría.
    await reintentar.click()
    await expect(page).toHaveURL(/\/registro/)
    expect(cuantasCuentas(correo)).toBe(0)
    // El reintento fallido se asienta —la query insiste dos veces— y el botón
    // vuelve a ofrecerse: sigue habiendo salida, no se queda «cargando» para siempre.
    await expect(reintentar).toHaveText('Volver a cargar las ciudades', { timeout: 30_000 })
    await expect(page.getByText(FALLO_DEL_CATALOGO)).toBeVisible()

    // Cuando el catálogo vuelve, el reintento lo trae sin perder lo escrito.
    fallar = false
    await reintentar.click()
    await expect(ciudad).toBeEnabled({ timeout: 30_000 })
    expect(await ciudad.locator('option').count()).toBeGreaterThan(100)
    await expect(page.getByText(FALLO_DEL_CATALOGO)).toHaveCount(0)
    await expect(page.getByLabel(/^Correo/)).toHaveValue(correo)

    /*
      Y el aviso que el fallo tapaba sale ahora, que ya se puede hacer algo con
      él: el intento anterior sí dejó la ciudad sin elegir. Mientras no había
      lista se leía el fallo del catálogo —no tiene sentido pedir que elija de un
      desplegable vacío—, pero eso no borró el problema, solo lo aparcó, y el
      resumen de arriba y el mensaje del campo vuelven a decir lo mismo.
    */
    await expect(await elErrorDelCampo(page)).toHaveText(EL_ERROR)
    await expect(page.getByText('Falta un dato por revisar. Te lo marcamos abajo.')).toBeVisible()

    // Y ahora sí: se elige, se envía y la cuenta nace con su ciudad.
    await ciudad.selectOption('EXT')
    await page.getByRole('button', { name: /Crear cuenta/i }).click()
    await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
    expect(laCiudadGuardadaDe(correo)).toBe('EXT')
  })
})

test.describe('AC-05 · a quien ya tenía cuenta sin ciudad no se le pide nada', () => {
  test('entra con su contraseña, ve su perfil y sigue sin ciudad', async ({ page }) => {
    const correo = nuevoCorreo()
    await crearCuentaDeCandidato({ nombre: 'Antigua', apellidos: 'Sin Ciudad', correo })

    /*
      Las cuentas anteriores al 01/09 no traen ciudad y no hay ninguna pantalla
      que se la pida: el dato solo entra por el alta. Así que se deja la fila como
      están las suyas —en null— y se comprueba lo único que importa, que nada se
      le cierra.
    */
    sql(`update persona set ciudad_ubigeo = null
          where id = (select persona_id from usuario where correo = '${correo}');`)
    expect(laCiudadGuardadaDe(correo)).toBeNull()

    await page.goto('/ingresar')
    await page.getByLabel('Correo', { exact: true }).fill(correo)
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE_DE_CANDIDATO)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    // Entra: ni se queda en la pantalla de entrar ni se le manda al registro.
    await expect(page).not.toHaveURL(/\/ingresar/, { timeout: 20_000 })
    await expect(page).not.toHaveURL(/\/registro/)

    // Y su perfil responde, sin pedirle la ciudad por ninguna parte.
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { name: 'No pudimos cargar tu perfil.' })).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(EL_ERROR)).toHaveCount(0)
    await expect(page.getByLabel('Ciudad')).toHaveCount(0)

    // Consultar el perfil no le inventa una ciudad ni se la exige.
    expect(laCiudadGuardadaDe(correo)).toBeNull()
  })
})
