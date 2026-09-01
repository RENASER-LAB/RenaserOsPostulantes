import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel, irAVacante, VACANTES } from './ayuda'
import {
  BLOQUE,
  bloque,
  campo,
  elegir,
  escribir,
  laCuenta,
  leer,
  PERDONADOS_DE_LA_VACANTE,
  quitarDeLaLista,
  vigilar,
  type Vigia,
} from './ayuda-prueba'

/**
 * Escribir una prueba del puesto desde el panel, de punta a punta, contra el
 * backend de verdad: se crea la prueba, se compone su primera versión entera
 * —enunciado escrito y subido, guía para la IA, preguntas, entregables, rúbrica
 * y el cambio inesperado—, se intenta publicar hasta que el servidor deja, y se
 * comprueba que la versión publicada aparece en el desplegable de una vacante.
 *
 * Es el recorrido que durante mucho tiempo **nadie había visto funcionar**. Las
 * pantallas se probaron contra un backend simulado que contesta `{ok:true}` a
 * todo lo que no sea GET, así que ningún guardado real se había ejercitado:
 * doce endpoints de edición y borrado, la subida del enunciado y el listado de
 * versiones se estrenaron aquí.
 *
 * ⚠️ **Este archivo ESCRIBE**, y no hay forma de borrarlo desde ninguna pantalla.
 * Cada corrida deja:
 *
 *   - una plantilla de prueba nueva (el nombre lleva la hora, así que no se pisan);
 *   - una versión PUBLICADA suya, que se congela —no existe «despublicar»—;
 *   - una segunda versión en borrador;
 *   - un archivo subido y unas cuantas filas de auditoría.
 *
 * No toca ninguna vacante: la del último tramo solo se mira.
 *
 * ⚠️ **No le pide nada a la IA.** No hay coste ni cola de por medio: todo lo que
 * hace es pantalla y base.
 *
 * Es `serial`: cada prueba es un tramo del mismo recorrido y abre la versión
 * que dejó la anterior; si una cae, las siguientes no tienen sobre qué correr.
 */

const SELLO = new Date().toISOString().slice(11, 19).replace(/:/g, '')
const NOMBRE = `Reto de priorización · e2e ${SELLO}`

/*
  Genérica a propósito: el desplegable de la vacante solo ofrece las pruebas de
  SU puesto y las genéricas, así que atarla a un puesto la volvería invisible en
  el último tramo sin que nada avisara.
*/

const ENUNCIADO =
  'Te llegan a la vez veinte solicitudes de mantenimiento de las tres sedes y solo tienes ' +
  'presupuesto para ocho. Ordénalas, di cuáles no se hacen y explica con qué criterio.'
const MATERIALES =
  'El listado de las veinte solicitudes con su fecha, su sede y lo que costaría cada una.'
const HERRAMIENTAS = 'Hoja de cálculo y calculadora. No se puede consultar a nadie de la empresa.'
const GUIA =
  'Lo que distingue un buen trabajo aquí es que el orden se justifique con el coste de no ' +
  'hacerlo, no con la antigüedad de la solicitud. Premia a quien diga en voz alta qué deja ' +
  'fuera y por qué. Descarta a quien reparta el presupuesto a partes iguales para no elegir.'

// ---------- Cómo se hace cada cosa en el compositor ----------

const pedirEntregable = async (page: Page, nombre: string, detalle: string, formato: string) => {
  const entregables = bloque(page, BLOQUE.ENTREGABLES)
  await entregables.getByRole('button', { name: 'Pedir un entregable' }).click()
  await escribir(entregables, 'Cómo se llama', nombre)
  await elegir(entregables, 'En qué forma se entrega', formato)
  await escribir(entregables, 'Qué tiene que contener', detalle)
  await entregables.getByRole('button', { name: 'Añadirlo' }).click()
  await expect(
    entregables.getByRole('listitem').filter({ hasText: nombre }),
    `el entregable «${nombre}» no llegó a la lista`,
  ).toHaveCount(1, { timeout: 20_000 })
}

/**
 * Traer del catálogo la primera pregunta disponible de un tipo. Devuelve su código.
 *
 * Se vuelve a mirar el desplegable en cada llamada: `disponibles` encoge según
 * se añaden, así que una lista leída una sola vez elegiría dos veces la misma.
 */
const traerPregunta = async (page: Page, tipo: 'UNIVERSAL' | 'ESPECIFICA'): Promise<string> => {
  const preguntas = bloque(page, BLOQUE.PREGUNTAS)
  const desplegable = campo(preguntas, 'Traer una del catálogo').locator('select')
  for (const opcion of await desplegable.locator('option').all()) {
    const valor = await opcion.getAttribute('value')
    const texto = (await opcion.textContent()) ?? ''
    if (valor === '' || !texto.includes(` · ${tipo} · `)) continue
    // `split` devuelve al menos un trozo; el `?? texto` es para el tipado, no un caso real.
    const codigo = texto.split(' · ')[0] ?? texto
    await desplegable.selectOption(valor as string)
    await preguntas.getByRole('button', { name: 'Añadirla' }).click()
    await expect(
      preguntas.getByRole('listitem').filter({ hasText: codigo }),
      `la pregunta ${codigo} no llegó a la lista de la versión`,
    ).toHaveCount(1, { timeout: 20_000 })
    return codigo
  }
  throw new Error(`El catálogo se quedó sin preguntas de tipo ${tipo}`)
}

const anadirCriterio = async (
  page: Page,
  codigo: string,
  nombre: string,
  puntos: number,
  quien: string,
  descripcion?: string,
) => {
  const rubrica = bloque(page, BLOQUE.RUBRICA)
  await rubrica.getByRole('button', { name: 'Añadir un criterio' }).click()
  await escribir(rubrica, 'Código', codigo)
  await escribir(rubrica, 'Cuántos puntos vale', String(puntos))
  await elegir(rubrica, 'Quién lo comprueba', quien)
  await escribir(rubrica, 'Qué mira este criterio', nombre)
  if (descripcion) await escribir(rubrica, 'La explicación larga, si hace falta', descripcion)
  await rubrica.getByRole('button', { name: 'Añadirlo' }).click()
  await expect(
    rubrica.getByRole('listitem').filter({ hasText: codigo }),
    `el criterio ${codigo} no llegó a la rúbrica`,
  ).toHaveCount(1, { timeout: 20_000 })
}

const escribirVariante = async (page: Page, texto: string) => {
  const variantes = bloque(page, BLOQUE.VARIANTES)
  await variantes.getByRole('button', { name: 'Escribir un cambio posible' }).click()
  await escribir(variantes, 'Qué le pasa a mitad de la prueba', texto)
  await variantes.getByRole('button', { name: 'Añadirlo' }).click()
}

const intentarPublicar = async (page: Page) => {
  await page.getByRole('button', { name: /^Publicar (la prueba|de todos modos)$/ }).click()
  await page.getByRole('button', { name: 'Sí, publicar' }).click()
}

/** Esperar a que el servidor confirme un guardado de los datos, y decir qué se quejó si no. */
const esperarGuardado = async (page: Page, que: string) => {
  const datos = bloque(page, BLOQUE.DATOS)
  // ⚠️ El «Guardado.» sale del `onSuccess` de la mutación, o sea de que el
  // servidor lo confirmó. Esperarlo es lo único que distingue guardar de haber
  // pulsado un botón.
  const guardado = datos.getByText('Guardado.', { exact: true })
  const queja = page.getByRole('alert')
  await expect(guardado.or(queja).first()).toBeVisible({ timeout: 20_000 })
  if (await queja.count()) throw new Error(`${que}: ${(await queja.allTextContents()).join(' · ')}`)
}

test.describe.serial('Componer una prueba del puesto', () => {
  let vigia: Vigia
  /** La pantalla del compositor de la v1, que cada tramo vuelve a abrir. */
  let urlDelCompositor: string | null = null

  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    vigia = vigilar(page, { perdonar404: PERDONADOS_DE_LA_VACANTE })
  })

  // Pasar no basta: que nada haya fallado por debajo mientras tanto.
  test.afterEach(() => {
    expect(vigia.fallos, vigia.fallos.join('\n')).toEqual([])
  })

  async function abrirElCompositor(page: Page) {
    if (urlDelCompositor === null) throw new Error('La versión todavía no existe: este tramo va después de crearla')
    await page.goto(urlDelCompositor)
    await expect(page.getByRole('heading', { name: NOMBRE })).toBeVisible({ timeout: 20_000 })
    await expect(bloque(page, BLOQUE.DATOS)).toBeVisible({ timeout: 15_000 })
  }

  /**
   * Antes de tocar nada. Un backend contesta a esto con un 401 y un cuerpo JSON;
   * Adminer —o cualquier otra cosa en el puerto de al lado— contesta un 200 con
   * HTML, y a partir de ahí toda la e2e mide el vacío sin que nada avise.
   */
  test('al otro lado del portal hay un backend, no Adminer', async ({ baseURL }) => {
    const r = await fetch(new URL('/api/v1/panel/plantillas-prueba', baseURL)).catch(() => null)
    const tipo = r?.headers.get('content-type') ?? ''
    expect(
      r != null && (r.status === 401 || r.status === 403) && tipo.includes('json'),
      `${baseURL} no está sirviendo el backend del panel: /api/v1/panel/plantillas-prueba contestó ` +
        `${r?.status ?? 'nada'} (${tipo || 'sin tipo'}) y se esperaba un 401 con JSON. ` +
        'Lo normal es que el proxy del portal apunte al puerto equivocado —el 8080 es Adminer y contesta 200 a todo—.',
    ).toBe(true)
  })

  /**
   * La pestaña «Pruebas» no existía: las pruebas reales entraron por un script
   * de Python, y quien no escribe Python no podía escribir una prueba.
   */
  test('la pestaña «Pruebas» crea la plantilla, y sin puesto nace genérica', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('link', { name: 'Pruebas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Pruebas del puesto.' })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Escribir una prueba nueva' }).click()
    await escribir(page, 'Cómo se llama', NOMBRE)
    await page.getByRole('button', { name: 'Crear la prueba' }).click()

    const laPlantilla = page.getByRole('listitem').filter({ hasText: NOMBRE }).first()
    const queja = page.getByRole('alert')
    await expect(laPlantilla.or(queja).first()).toBeVisible({ timeout: 20_000 })
    if (await queja.count()) {
      throw new Error(`La prueba nueva no salió en la lista: ${(await queja.allTextContents()).join(' · ')}`)
    }
    await expect(
      laPlantilla.getByText('Genérica: sirve para cualquier puesto'),
      'la prueba nueva no se declara genérica, y sin puesto debería serlo',
    ).toBeVisible()
  })

  /** Una plantilla no es una prueba: es su nombre. Lo que se rinde es una versión suya. */
  test('la v1 nace en borrador y se abre el compositor con sus bloques', async ({ page }) => {
    await page.goto('/admin/pruebas')
    const laPlantilla = page.getByRole('listitem').filter({ hasText: NOMBRE }).first()
    await expect(laPlantilla).toBeVisible({ timeout: 20_000 })

    await laPlantilla.getByRole('button', { name: 'Empezar una versión nueva' }).click()
    await expect(
      laPlantilla.getByText('BORRADOR', { exact: true }),
      'crear una versión no dejó ningún borrador en la lista de la plantilla',
    ).toBeVisible({ timeout: 20_000 })

    await laPlantilla.getByRole('link', { name: 'Componer' }).first().click()
    await expect(page.getByRole('heading', { name: NOMBRE })).toBeVisible({ timeout: 20_000 })
    // El balance arriba y los cinco bloques que hay que llenar.
    await expect(bloque(page, BLOQUE.BALANCE)).toBeVisible()
    for (const titulo of [BLOQUE.DATOS, BLOQUE.PREGUNTAS, BLOQUE.ENTREGABLES, BLOQUE.RUBRICA, BLOQUE.VARIANTES]) {
      await expect(bloque(page, titulo)).toBeVisible({ timeout: 15_000 })
    }
    urlDelCompositor = page.url()
  })

  /**
   * **Este es el tramo que de verdad importa.**
   *
   * `PUT /versiones/{id}` reemplaza la versión ENTERA: lo que la pantalla no
   * mande se guarda en nulo. Un formulario al que le faltara un campo borraría
   * ese campo sin que nadie lo tocara, y nada en la pantalla lo diría — el
   * estado de React seguiría enseñando lo tecleado. La única forma de verlo es
   * recargar y volver a leer del servidor.
   */
  test('los datos se guardan, y sobreviven a recargar campo por campo', async ({ page }) => {
    await abrirElCompositor(page)
    const datos = bloque(page, BLOQUE.DATOS)

    await escribir(datos, 'El enunciado', ENUNCIADO)
    await escribir(datos, 'Con qué material se le entrega', MATERIALES)
    await escribir(datos, 'Qué herramientas puede usar', HERRAMIENTAS)
    await elegir(datos, 'Cómo se rinde', 'CRONOMETRADA')
    await escribir(datos, 'Cuántos minutos dura', '90')
    await escribir(datos, 'El cambio llega a partir del minuto', '30')
    await escribir(datos, '…y como muy tarde en el minuto', '45')
    await escribir(datos, 'Minutos extra que se dan por el cambio', '10')
    await datos.getByRole('button', { name: 'Guardar estos datos' }).click()
    await esperarGuardado(page, 'Los datos no se guardaron')

    await page.reload()
    await expect(datos).toBeVisible({ timeout: 20_000 })
    expect(await leer(datos, 'El enunciado'), 'el enunciado no sobrevivió a recargar').toBe(ENUNCIADO)
    expect(
      await leer(datos, 'Con qué material se le entrega'),
      'los materiales no sobrevivieron a recargar: el PUT reemplaza la versión entera y se perdieron',
    ).toBe(MATERIALES)
    expect(await leer(datos, 'Qué herramientas puede usar'), 'las herramientas no sobrevivieron a recargar').toBe(HERRAMIENTAS)
    expect(await leer(datos, 'Cuántos minutos dura'), 'los 90 minutos no sobrevivieron').toBe('90')
    expect(
      [
        await leer(datos, 'El cambio llega a partir del minuto'),
        await leer(datos, '…y como muy tarde en el minuto'),
        await leer(datos, 'Minutos extra que se dan por el cambio'),
      ],
      'el rango del cambio inesperado no sobrevivió a recargar',
    ).toEqual(['30', '45', '10'])
  })

  test('el enunciado se sube como archivo, y guardar los datos después no se lo lleva', async ({ page }) => {
    await abrirElCompositor(page)
    const datos = bloque(page, BLOQUE.DATOS)

    // El PDF vive aquí, en memoria: no hace falta un archivo real para que la
    // versión quede apuntando a uno.
    await page.locator('input[type=file]').setInputFiles({
      name: 'enunciado-priorizacion.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 el enunciado de la prueba de priorización, en papel'),
    })
    await datos.getByRole('button', { name: 'Subir el enunciado' }).click()
    const elEnunciadoSubido = page.getByRole('link', { name: 'Ver el enunciado que hay subido' })
    const queja = page.getByRole('alert')
    await expect(elEnunciadoSubido.or(queja).first()).toBeVisible({ timeout: 25_000 })
    if (await queja.count()) throw new Error(`El enunciado no quedó subido: ${(await queja.allTextContents()).join(' · ')}`)
    /*
      ⚠️ Se comprueba que el enlace ESTÁ, no que se abra. En local el almacén es
      el doble en memoria y reparte urls «memoria://», que ningún navegador
      abre: es el entorno, no una avería. Lo que importa es que la versión quedó
      apuntando a un archivo.
    */
    expect((await elEnunciadoSubido.getAttribute('href')) ?? '', 'el enunciado subido no dejó ningún enlace').not.toBe('')

    /*
     * Y ahora al revés: **guardar los datos DESPUÉS de subir**. El formulario de
     * arriba no manda `urlConsigna` —no viaja en ese contrato—, así que un PUT
     * que pusiera en nulo todo lo que no recibe se llevaría por delante el
     * enunciado recién subido. Guardar primero y subir después nunca lo habría
     * enseñado.
     */
    await escribir(datos, 'Cuántos minutos dura', '95')
    await datos.getByRole('button', { name: 'Guardar estos datos' }).click()
    await esperarGuardado(page, 'El cambio a 95 minutos no se guardó')
    await page.reload()
    await expect(datos).toBeVisible({ timeout: 20_000 })
    expect(await leer(datos, 'Cuántos minutos dura'), 'el cambio a 95 minutos no se guardó').toBe('95')
    await expect(
      page.getByRole('link', { name: 'Ver el enunciado que hay subido' }),
      'guardar los datos borró el enunciado subido: el PUT reemplaza la versión entera y se llevó urlConsigna',
    ).toBeVisible()
  })

  test('la guía para la IA se cuenta mientras se escribe, se guarda y se relee del servidor', async ({ page }) => {
    await abrirElCompositor(page)
    const datos = bloque(page, BLOQUE.DATOS)

    await escribir(datos, 'Qué debería mirar la IA al calificarla', GUIA)
    await expect(
      datos.getByText(`${GUIA.length} de 2000 caracteres`),
      'el contador de la guía no cuenta lo que hay escrito',
    ).toBeVisible()
    await datos.getByRole('button', { name: 'Guardar estos datos' }).click()
    await esperarGuardado(page, 'La guía no se guardó')

    await page.reload()
    await expect(datos).toBeVisible({ timeout: 20_000 })
    expect(await leer(datos, 'Qué debería mirar la IA al calificarla'), 'la guía de calificación no sobrevivió a recargar').toBe(GUIA)
  })

  /**
   * Sin entregables la prueba es un cuestionario: sus preguntas SON la prueba y
   * basta con una. El primer entregable cambia eso —pasan a hacer falta 8-10
   * universales y 3-5 del puesto—, y el balance tiene que decirlo en el momento,
   * no al intentar publicar.
   */
  test('los entregables cambian la cuota de preguntas, y se corrigen y se quitan', async ({ page }) => {
    await abrirElCompositor(page)
    const entregables = bloque(page, BLOQUE.ENTREGABLES)

    await test.step('Con cero entregables el balance pide «al menos 1» pregunta: es un cuestionario', async () => {
      expect(await laCuenta(page, 'Preguntas'), 'sin entregables, el balance no trata la prueba como un cuestionario').not.toBeNull()
      expect(await laCuenta(page, 'Preguntas universales'), 'sin entregables, el balance no trata la prueba como un cuestionario').toBeNull()
    })

    await test.step('El primer entregable cambia la prueba: ahora el balance pide 8-10 y 3-5 preguntas', async () => {
      await pedirEntregable(page, 'La lista priorizada', 'Las veinte solicitudes ordenadas, con las ocho que se hacen marcadas.', 'ARCHIVO')
      await expect
        .poll(() => laCuenta(page, 'Preguntas universales'), {
          timeout: 20_000,
          message: 'añadir el primer entregable no hizo aparecer la cuota de preguntas universales',
        })
        .not.toBeNull()
      expect(
        await laCuenta(page, 'Preguntas'),
        'con un entregable ya puesto, el balance sigue tratando la prueba como un cuestionario',
      ).toBeNull()
    })

    // Corregir uno: es uno de los endpoints que nadie había visto por pantalla.
    await test.step('Dos entregables, y el segundo corregido: el PUT de entregables funciona', async () => {
      await pedirEntregable(page, 'El descarte', 'Las doce que no se hacen y por qué.', 'CUALQUIERA')
      const filaDescarte = entregables.getByRole('listitem').filter({ hasText: 'El descarte' }).first()
      await filaDescarte.getByRole('button', { name: 'Corregir' }).click()
      await escribir(entregables, 'Cómo se llama', 'El descarte, con su motivo')
      await escribir(entregables, 'Qué tiene que contener', 'Las doce que no se hacen, cada una con la razón de por qué no, en una línea.')
      await entregables.getByRole('button', { name: 'Guardarlo' }).click()
      await expect(
        entregables.getByRole('listitem').filter({ hasText: 'El descarte, con su motivo' }),
        'corregir el entregable no cambió lo que se ve',
      ).toHaveCount(1, { timeout: 20_000 })
    })

    // Y quitar uno, que es el otro endpoint nuevo.
    await test.step('Y uno quitado: quedan los dos que la prueba pide de verdad', async () => {
      await pedirEntregable(page, 'Un tercero de sobra', 'Está aquí para que se le pueda quitar.', 'ENLACE')
      await quitarDeLaLista(page, BLOQUE.ENTREGABLES, 'Un tercero de sobra', 'el entregable')
      await expect(
        entregables.getByRole('listitem').filter({ hasText: 'Un tercero de sobra' }),
        'quitar el entregable no lo sacó de la lista',
      ).toHaveCount(0, { timeout: 20_000 })
    })
  })

  test('ocho universales y tres del puesto ponen las cuotas en verde; quitar una las pone en rojo al momento', async ({ page }) => {
    // Once viajes al servidor, uno por pregunta.
    test.slow()
    await abrirElCompositor(page)

    const universales: string[] = []
    for (let i = 0; i < 8; i++) universales.push(await traerPregunta(page, 'UNIVERSAL'))
    for (let i = 0; i < 3; i++) await traerPregunta(page, 'ESPECIFICA')

    expect(
      await laCuenta(page, 'Preguntas universales'),
      'con ocho universales el balance no las da por buenas',
    ).toContain('ya está')
    expect(
      await laCuenta(page, 'Preguntas del puesto'),
      'con tres específicas el balance no las da por buenas',
    ).toContain('ya está')

    // Quitar una y ver que el balance lo dice al momento, sin recargar.
    const laQuitada = universales.at(-1)
    if (!laQuitada) throw new Error('No quedó ninguna pregunta universal que quitar')
    await quitarDeLaLista(page, BLOQUE.PREGUNTAS, laQuitada, 'la pregunta')
    await expect
      .poll(() => laCuenta(page, 'Preguntas universales'), {
        timeout: 20_000,
        message: `quitada la ${laQuitada}, el balance no dice que falta una`,
      })
      .toContain('faltan 1 pregunta')
  })

  test('tres criterios que suman 140: el balance dice que sobran 40 puntos', async ({ page }) => {
    await abrirElCompositor(page)
    await anadirCriterio(page, 'CRITERIO_ORDEN', 'El orden se justifica con el coste de no hacerlo', 40, 'AGENTE',
      'Se mira si el argumento de cada posición nombra una consecuencia concreta.')
    await anadirCriterio(page, 'CRITERIO_DESCARTE', 'Dice qué deja fuera y lo sostiene', 40, 'AGENTE')
    await anadirCriterio(page, 'CRITERIO_CUENTAS', 'Las ocho elegidas caben en el presupuesto', 60, 'PERSONA')
    await expect
      .poll(() => laCuenta(page, 'La rúbrica, en puntos'), { message: 'con 140 puntos el balance no dice que sobran 40' })
      .toContain('sobran 40 puntos')
  })

  /**
   * El backend valida en cascada —duración, cuota de preguntas, rúbrica— y
   * **para en la primera que falla**, así que nombra una sola cosa aunque haya
   * tres mal. Se intenta con todo mal a la vez, se arregla lo que diga, y se
   * vuelve.
   *
   * Los 400 de `/publicacion` son los rechazos que esta prueba PIDE a propósito:
   * se avisa al vigía justo antes, para que un 400 que no fuera ese siga
   * contando como fallo.
   */
  test('publicar para en la primera regla que falla: primero las universales, luego la rúbrica', async ({ page }) => {
    await abrirElCompositor(page)
    const rechazo = bloque(page, BLOQUE.BALANCE).getByRole('alert')
    vigia.esperarRechazo('/publicacion', 400)

    await intentarPublicar(page)
    await expect(
      rechazo,
      'el primer rechazo debería hablar de las preguntas universales, que es lo primero que falla',
    ).toContainText(/universales/, { timeout: 20_000 })
    console.log(`[PRUEBA] primer rechazo: «${((await rechazo.textContent()) ?? '').trim()}»`)

    // Se devuelve la pregunta que faltaba y se vuelve a intentar: ahora toca la rúbrica.
    await traerPregunta(page, 'UNIVERSAL')
    await expect
      .poll(() => laCuenta(page, 'Preguntas universales'), {
        timeout: 20_000,
        message: 'devuelta la octava universal, el balance sigue diciendo que falta',
      })
      .toContain('ya está')
    await intentarPublicar(page)
    await expect(rechazo, 'el segundo rechazo no habla de la rúbrica, que es lo único que quedaba mal').toContainText(/rúbrica/i, {
      timeout: 20_000,
    })
    await expect(rechazo, 'el rechazo de la rúbrica no dice cuánto suma hoy, que es lo que la hace arreglable').toContainText(/140/)
    console.log(`[PRUEBA] segundo rechazo: «${((await rechazo.textContent()) ?? '').trim()}»`)
    expect(vigia.rechazosEsperados, 'los dos rechazos tenían que ser 400 del servidor, no otra cosa').toBe(2)
  })

  test('corregir un criterio a 20 deja la rúbrica en 100, y la explicación larga no se abre en blanco', async ({ page }) => {
    await abrirElCompositor(page)
    const rubrica = bloque(page, BLOQUE.RUBRICA)

    const filaCuentas = rubrica.getByRole('listitem').filter({ hasText: 'CRITERIO_CUENTAS' }).first()
    await filaCuentas.getByRole('button', { name: 'Corregir' }).click()
    await escribir(rubrica, 'Cuántos puntos vale', '20')
    await rubrica.getByRole('button', { name: 'Guardarlo' }).click()
    await expect
      .poll(() => laCuenta(page, 'La rúbrica, en puntos'), {
        timeout: 20_000,
        message: 'corregido el criterio a 20 puntos, la rúbrica no llega a 100',
      })
      .toContain('ya está')

    /*
      ⚠️ **La explicación larga tiene que seguir ahí al volver a abrir el
      criterio.** Corregir manda el criterio ENTERO, así que si el listado no la
      devuelve el formulario se abre en blanco y guardar la borra sin decir nada.
      CRITERIO_ORDEN nació con explicación: se abre para mirarla y se deja como
      estaba.
    */
    const filaOrden = rubrica.getByRole('listitem').filter({ hasText: 'CRITERIO_ORDEN' }).first()
    await filaOrden.getByRole('button', { name: 'Corregir' }).click()
    expect(
      await leer(rubrica, 'La explicación larga, si hace falta'),
      'al corregir un criterio, su explicación larga se abre en blanco: guardarla así la borra sin avisar',
    ).toContain('consecuencia concreta')
    await rubrica.getByRole('button', { name: 'Dejarlo' }).click()
  })

  /** No hace falta para publicar, pero es una lista más y sus tres endpoints tampoco se habían visto. */
  test('el cambio inesperado: dos formas posibles, y una corregida', async ({ page }) => {
    await abrirElCompositor(page)
    const variantes = bloque(page, BLOQUE.VARIANTES)

    await escribirVariante(page, 'El presupuesto se recorta a la mitad: ahora solo caben cuatro.')
    await expect(
      variantes.getByRole('listitem').filter({ hasText: 'se recorta' }),
      'la variante del cambio inesperado no llegó a la lista',
    ).toHaveCount(1, { timeout: 20_000 })

    await escribirVariante(page, 'Se cae el techo de la sede norte: hay una solicitud nueva que no estaba en el listado.')
    await expect(variantes.getByRole('listitem'), 'la segunda variante no llegó a la lista').toHaveCount(2, { timeout: 20_000 })

    const laVariante = variantes.getByRole('listitem').filter({ hasText: 'techo' }).first()
    await laVariante.getByRole('button', { name: 'Corregir' }).click()
    await escribir(variantes, 'Qué le pasa a mitad de la prueba',
      'Se cae el techo de la sede norte: entra una solicitud urgente que no estaba en el listado.')
    await variantes.getByRole('button', { name: 'Guardarlo' }).click()
    await expect(
      variantes.getByRole('listitem').filter({ hasText: 'urgente' }),
      'corregir la variante no cambió lo que se ve',
    ).toHaveCount(1, { timeout: 20_000 })
  })

  test('ahora sí: publicada, se congela entera y no hay «despublicar»', async ({ page }) => {
    await abrirElCompositor(page)
    await intentarPublicar(page)
    const publicada = page.getByText('Esta versión ya está publicada')
    const queja = page.getByRole('alert')
    await expect(publicada.or(queja).first()).toBeVisible({ timeout: 25_000 })
    if (await queja.count()) throw new Error(`No se publicó: ${(await queja.allTextContents()).join(' · ')}`)

    await expect(bloque(page, BLOQUE.BALANCE), 'publicada, la pantalla sigue ofreciendo publicar').toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Añadir un criterio' }),
      'publicada, la rúbrica sigue dejando añadir criterios: una publicada se congela',
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Guardar estos datos' }), 'publicada, los datos siguen dejando guardarse').toHaveCount(0)
  })

  test('sobre la publicada nace una v2 en borrador, y la v1 no se toca', async ({ page }) => {
    await page.goto('/admin/pruebas')
    await expect(page.getByRole('heading', { name: 'Pruebas del puesto.' })).toBeVisible({ timeout: 20_000 })
    const laPlantilla = page.getByRole('listitem').filter({ hasText: NOMBRE }).first()
    // ⚠️ `exact`: la insignia dice «PUBLICADA», pero «Publicada el…» y «La publicada de ahora…» están al lado.
    await expect(laPlantilla.getByText('PUBLICADA', { exact: true }), 'la lista de pruebas no se enteró de que la v1 se publicó').toBeVisible({
      timeout: 20_000,
    })
    await laPlantilla.getByRole('button', { name: 'Empezar una versión nueva' }).click()
    await expect(laPlantilla.getByText('BORRADOR', { exact: true }), 'no se pudo abrir una v2 en borrador sobre la publicada').toBeVisible({
      timeout: 20_000,
    })
  })

  /**
   * El desplegable «Qué prueba del puesto rendirá» adivinaba ids por fuerza
   * bruta: pedía versiones de ocho en ocho hasta dar con un hueco. Ahora
   * pregunta plantilla por plantilla al listado de versiones, que es lo que
   * además le trae el estado — y con el estado puede dejar fuera los
   * borradores, que el backend rechaza con un 409.
   *
   * La vacante solo se mira. Es la llena porque rinde la prueba del puesto
   * —una que rindiera el cuestionario técnico no tendría este desplegable—.
   */
  test('la vacante ofrece la v1 publicada, y no la v2 en borrador', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    const elDesplegable = campo(page, 'Qué prueba del puesto rendirá').locator('select')
    await expect(elDesplegable, 'el desplegable de la prueba del puesto se quedó buscando para siempre').toBeEnabled({
      timeout: 20_000,
    })
    const loQueOfrece = (await elDesplegable.locator('option').allTextContents()).map((t) => t.trim())
    console.log(`[PRUEBA] la vacante ofrece: ${loQueOfrece.join(' | ')}`)
    expect(
      loQueOfrece.some((t) => t.includes(`${NOMBRE} · v1`)),
      `la versión recién publicada no sale en el desplegable de la vacante. Ofrece: ${loQueOfrece.join(' | ')}`,
    ).toBe(true)
    expect(
      loQueOfrece.some((t) => t.includes(`${NOMBRE} · v2`)),
      'el desplegable ofrece la v2, que está en borrador: el backend la rechazaría con un 409',
    ).toBe(false)
  })
})
