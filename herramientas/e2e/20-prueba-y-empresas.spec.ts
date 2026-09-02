import { expect, test, type Page } from '@playwright/test'
import { corte, entrarAlPanel, filasDelRanking, irAVacante, pestana, VACANTES } from './ayuda'
import { apiPanel, detail, detalleDe } from './ayuda-configuracion'

/**
 * Las cuatro piezas de la prueba del puesto en el panel, contra el backend de
 * verdad: el ranking que cambia de nombre por etapa, lo que la persona escribió
 * y el botón de la IA, cuándo cierra la prueba, y el paso que produce la nota
 * —para una persona y para la tanda—. Y de propina, la entrada de las empresas
 * en el portal.
 *
 * ⚠️ **Escribe en la base, y poco:** quita el cierre de prueba de una vacante
 * —que ya estaba quitado— y, si hay alguien con la prueba entregada, le pide
 * una calificación a la IA. Las dos son idempotentes; lo que no se deshace son
 * las filas de auditoría, y es correcto que así sea.
 *
 * ⚠️ **Las vacantes y las postulaciones se eligen, no se fijan.** El script del
 * que viene esto llevaba escritas la 3 y la 4 y la postulación 16, y los ids
 * cambian con cada siembra. Aquí se pregunta al backend quién tiene prueba con
 * respuestas, quién la entregó y qué vacante está abierta con su prueba
 * elegida; lo que la siembra no tiene queda en `skip` con su motivo, no en
 * verde callando.
 *
 * Lo que este spec encontró en su día, y no se veía leyendo el código:
 *
 *   1. `CierrePruebaResponse` llama al campo **`intentosConPlazoPropio`**, no
 *      `conPlazoPropio` —ese es el nombre de una variable local dentro de su
 *      implementación—. Con el nombre corto llegaba `undefined` y el único
 *      número que ese bloque existe para no callar se perdía en silencio.
 *   2. Con la vacante **sin versión de prueba elegida**, el backend llegó a
 *      contestar 400 con «The given id must not be null». Se cerró en el ciclo
 *      2 (PR #49); lo que se vigila ahora es que no vuelva el inglés.
 *   3. Una prueba **CRONOMETRADA no admite fecha de cierre**, y el backend lo
 *      explica bien. Es el caso que ejercita este spec.
 *   4. **`estado` no siempre es ENCOLADA.** `SIN_CAMBIOS` significa que NO se
 *      encoló nada, y el panel llegó a decir «se pidió» sobre eso.
 */

interface Vacante {
  id: number
  titulo: string
  estado: string
  versionPlantillaPruebaId: number | null
}

interface FilaDelRanking {
  postulacionId: number
  candidato: string
  correo: string
  estado: string
  notaEtapa: number | null
}

interface RespuestaDePrueba {
  preguntaId: number
  enunciado: string
  respuesta: string | null
  respondidaEn: string | null
}

/** Una postulación con prueba del puesto, y dónde está. */
interface ConPrueba {
  vacante: Vacante
  fila: FilaDelRanking
  respuestas: RespuestaDePrueba[]
}

let vacantes: Vacante[] = []
/** Abierta y con su prueba elegida: donde el control del cierre aparece. */
let vacanteAbierta: Vacante | undefined
/** Sin prueba del puesto elegida: donde el cierre se rechaza con explicación. */
let vacanteSinPrueba: Vacante | undefined
/** La primera con prueba y lista de respuestas: donde se lee lo que escribió. */
let conRespuestas: ConPrueba | undefined
/** La primera con la prueba entregada: la única a la que se le puede pedir la IA. */
let entregada: ConPrueba | undefined

const filasDe = async (vacanteId: number): Promise<FilaDelRanking[]> =>
  (await apiPanel(`/vacantes/${vacanteId}/ranking?etapa=PRUEBA_PUESTO`)).cuerpo?.filas ?? []

test.beforeAll(async () => {
  const lista = await apiPanel('/vacantes')
  const crudo = Array.isArray(lista.cuerpo) ? lista.cuerpo : (lista.cuerpo?.contenido ?? lista.cuerpo?.filas ?? [])
  vacantes = []
  for (const v of crudo as { id: number }[]) {
    const detalle = await apiPanel<Vacante>(`/vacantes/${v.id}`)
    if (detalle.estado === 200) vacantes.push(detalle.cuerpo)
  }
  vacanteAbierta = vacantes.find((v) => v.estado !== 'CERRADA' && v.versionPlantillaPruebaId !== null)
  vacanteSinPrueba = vacantes.find((v) => v.versionPlantillaPruebaId === null)

  // Quién tiene prueba con respuestas, y quién la entregó. Se recorre por
  // vacante hasta dar con las dos; con diez postulaciones son diez peticiones.
  for (const vacante of vacantes) {
    for (const fila of await filasDe(vacante.id)) {
      const r = await apiPanel<RespuestaDePrueba[]>(`/postulaciones/${fila.postulacionId}/prueba/respuestas`)
      if (r.estado !== 200 || !Array.isArray(r.cuerpo) || r.cuerpo.length === 0) continue
      const suya = { vacante, fila, respuestas: r.cuerpo }
      conRespuestas ??= suya
      if (r.cuerpo.some((x) => x.respondidaEn !== null)) entregada ??= suya
      if (conRespuestas && entregada) break
    }
    if (conRespuestas && entregada) break
  }
})

const SIN_RESPUESTAS = 'ninguna postulación tiene prueba del puesto con preguntas: no hay ficha que leer'
const SIN_ENTREGADA =
  'nadie tiene la prueba entregada: el backend contesta 409 «todavía no está entregada» y no encola nada'

// ---------- El contrato, antes de mirar ninguna pantalla ----------

test.describe('La prueba · el contrato del backend', () => {
  test('GET /prueba/respuestas devuelve una lista y cada fila trae preguntaId, enunciado y respuesta', async () => {
    test.skip(!conRespuestas, SIN_RESPUESTAS)
    const respuestas = await apiPanel(`/postulaciones/${conRespuestas!.fila.postulacionId}/prueba/respuestas`)
    expect(respuestas.estado, detalleDe(respuestas)).toBe(200)
    expect(Array.isArray(respuestas.cuerpo)).toBe(true)
    const campos = respuestas.cuerpo[0] ?? {}
    expect(Object.keys(campos), `llegó ${JSON.stringify(Object.keys(campos))}`).toEqual(
      expect.arrayContaining(['preguntaId', 'enunciado', 'respuesta']),
    )
  })

  test('CierrePruebaResponse trae «intentosConPlazoPropio», no «conPlazoPropio»', async () => {
    test.skip(!vacanteAbierta, 'no hay ninguna vacante abierta con su prueba elegida')
    // `cierraEn: null` sobre una vacante sin cierre no toca nada: es el único
    // camino que devuelve la forma completa sin escribir.
    const quitado = await apiPanel(`/vacantes/${vacanteAbierta!.id}/cierre-prueba`, {
      method: 'POST',
      cuerpo: { cierraEn: null, motivo: 'e2e: comprobar la forma de la respuesta' },
    })
    expect(quitado.estado, detalleDe(quitado)).toBe(200)
    expect(quitado.cuerpo, `llegó ${JSON.stringify(quitado.cuerpo)}`).toHaveProperty('intentosConPlazoPropio')
  })

  /*
    El hueco se cerró en el ciclo 2 (PR #49): antes contestaba 400 «The given id
    must not be null», el mensaje de Spring Data al recibir un id nulo. Ya
    contesta 409 en español y explica por qué esa vacante no tiene fecha que
    fijar. Se queda vigilando lo contrario de lo que vigilaba: que no vuelva
    el inglés.
  */
  test('sin prueba del puesto elegida lo explica en español, y ya no revienta en inglés', async () => {
    test.skip(!vacanteSinPrueba, 'todas las vacantes sembradas tienen su prueba del puesto elegida')
    const sinVersion = await apiPanel(`/vacantes/${vacanteSinPrueba!.id}/cierre-prueba`, {
      method: 'POST',
      cuerpo: { cierraEn: '2036-01-15T05:00:00Z', motivo: 'e2e: sin prueba del puesto' },
    })
    const explicado = detail(sinVersion)
    expect(sinVersion.estado, detalleDe(sinVersion)).toBe(409)
    expect(explicado).not.toContain('must not be null')
    expect(explicado.length).toBeGreaterThan(20)
  })

  test('POST /prueba/calificacion-ia encola y contesta al momento, con estado ENCOLADA o SIN_CAMBIOS', async () => {
    test.skip(!entregada, SIN_ENTREGADA)
    const encolada = await apiPanel(`/postulaciones/${entregada!.fila.postulacionId}/prueba/calificacion-ia`, {
      method: 'POST',
    })
    expect(encolada.estado, detalleDe(encolada)).toBe(200)
    expect(typeof encolada.cuerpo?.estado).toBe('string')
    // ⚠️ No significan lo mismo: `SIN_CAMBIOS` es que NO se encoló nada —la
    // rúbrica no le reserva criterios al agente, o ya hay un trabajo en marcha—.
    // El día que el backend deje de mandar uno, esta pantalla puede simplificarse.
    expect(['ENCOLADA', 'SIN_CAMBIOS'], JSON.stringify(encolada.cuerpo)).toContain(encolada.cuerpo.estado)
  })
})

// ---------- El panel ----------

/**
 * Abre la vacante en la pestaña de la prueba, con la tanda entera, y despliega
 * la ficha de una persona.
 *
 * ⚠️ Con la tanda entera y no con el corte por defecto: quien tiene la rúbrica
 * calificada y ninguna nota de etapa es justamente quien NO sale en «con nota
 * de la prueba», que es el corte con el que abre la pantalla.
 */
async function abrirLaFichaDe(page: Page, vacante: Vacante, fila: FilaDelRanking) {
  await irAVacante(page, vacante.titulo)
  await pestana(page, 'Prueba del puesto').click()
  await corte(page, 'Toda la tanda').click()
  const suya = filasDelRanking(page).filter({ hasText: fila.candidato })
  await expect(suya).toHaveCount(1)
  await suya.click()
}

test.describe('La prueba · el panel', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('el ranking, etapa por etapa: la nota se llama por su etapa y las dimensiones del CV desaparecen', async ({ page }) => {
    await irAVacante(page, conRespuestas?.vacante.titulo ?? VACANTES.LLENA)
    const cabeceras = () => page.locator('table thead th').allTextContents()

    const enPerfil = await cabeceras()
    // Por su etapa y no «Nota de etapa».
    expect(enPerfil, JSON.stringify(enPerfil)).toContain('Nota del perfil')
    expect(enPerfil).toContain('Adecuación')
    expect(enPerfil).toContain('Potencial')

    await pestana(page, 'Prueba del puesto').click()
    await expect(page.locator('table thead th', { hasText: 'Nota de la prueba' })).toBeVisible({ timeout: 20_000 })
    const enPrueba = await cabeceras()
    expect(enPrueba, JSON.stringify(enPrueba)).toContain('Nota de la prueba')
    // Era lo que hacía leer la tabla como si hablara del CV.
    expect(enPrueba).not.toContain('Adecuación')
    expect(enPrueba).not.toContain('Potencial')
  })

  test('la ficha enseña lo que escribió pregunta a pregunta, ofrece pedirle a la IA y deja fijarle su propia fecha', async ({ page }) => {
    test.skip(!conRespuestas, SIN_RESPUESTAS)
    await abrirLaFichaDe(page, conRespuestas!.vacante, conRespuestas!.fila)

    // `.last()`: la ficha vive dentro de otra `section`, y la de dentro es la
    // última en orden de documento.
    const bloque = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Lo que escribió en la prueba' }) })
      .last()
    await expect(bloque).toBeVisible({ timeout: 20_000 })
    // Una por pregunta, con su enunciado: lo mismo que devuelve la API.
    const preguntas = bloque.getByRole('listitem')
    await expect(preguntas).toHaveCount(conRespuestas!.respuestas.length)
    for (const r of conRespuestas!.respuestas.slice(0, 3)) {
      await expect(bloque.getByText(r.enunciado, { exact: true })).toBeVisible()
    }

    await expect(page.getByRole('button', { name: /Pedirle a la IA que califique la prueba/ })).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'El plazo de esta persona' })).toBeVisible()
  })

  /*
    ⚠️ **Las dos respuestas valen, y son opuestas.** `ENCOLADA` es que se
    pidió; `SIN_CAMBIOS` es que no se pidió nada. Lo que no vale es la tercera:
    quedarse callado, o decir que se pidió sobre un SIN_CAMBIOS, que es lo que
    hacía esta pantalla antes de que esta prueba lo encontrara.

    ⚠️ No buscar «se pidió» a secas: el mensaje del backend para SIN_CAMBIOS
    empieza por «No se pidió nada», así que esa cadena está en las DOS ramas y
    encendía las dos banderas a la vez. La señal de que sí se encoló es que
    está calificando ahora.
  */
  test('pedirle a la IA contesta una de las dos cosas —se pidió, o no se encoló nada— y nunca afirma que la nota llegó', async ({ page }) => {
    test.skip(!entregada, SIN_ENTREGADA)
    await abrirLaFichaDe(page, entregada!.vacante, entregada!.fila)

    const boton = page.getByRole('button', { name: /Pedirle a la IA que califique la prueba/ })
    await expect(boton).toBeVisible({ timeout: 20_000 })
    await boton.click()
    await expect(page.locator('main')).toContainText(/está calificando|quedó en cola|no se encoló nada|no había nada que/i, {
      timeout: 20_000,
    })
    const texto = await page.locator('main').innerText()

    const dicePedido = /está calificando|quedó en cola/i.test(texto)
    const diceQueNo = /no se encoló nada|no había nada que/i.test(texto)
    const desde = texto.indexOf('Pedirle a la IA')
    expect(dicePedido !== diceQueNo, texto.slice(desde, desde + 260)).toBe(true)
    /*
      ⚠️ **Sobre la respuesta del botón, NO sobre `main` entero.** Lo que no puede
      pasar es que ESTE bloque afirme que la nota llegó. Mirando la pantalla
      entera se cuela la tabla, y ahí «Terminó su proceso sin nota de esta etapa»
      —uno de los seis porqués de un guion, sobre OTRO candidato— casa con
      `terminó` y pone el test en rojo por un texto que dice justo lo contrario.
      Solo salta cuando la tanda tiene a alguien cerrado, así que el día que
      falle no se parecerá a nada de lo que se acaba de tocar.
    */
    expect(texto.slice(desde, desde + 260)).not.toMatch(
      /(nota|prueba) (ya )?(está|quedó) calificad[ao]|listo|terminó/i,
    )
  })

  test('cuándo cierra la prueba: una cronometrada rechaza la fecha con el porqué del backend, y quitar el cierre no pinta undefined', async ({ page }) => {
    test.skip(!vacanteAbierta, 'no hay ninguna vacante abierta con su prueba elegida')
    await irAVacante(page, vacanteAbierta!.titulo)

    // El control aparece en una vacante abierta con su prueba elegida.
    await expect(page.getByText('Cuándo cierra la prueba')).toBeVisible({ timeout: 20_000 })

    await page.getByLabel('Se cierra el').fill('2036-01-15T23:59')
    await page
      .getByLabel('Por qué se fija esta fecha')
      .fill('e2e: comprobar que una cronometrada lo rechaza con explicación')
    await page.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()

    // ⚠️ La plantilla sembrada es CRONOMETRADA: si un día fuera de plazo
    // abierto, la fecha se guardaría de verdad y esto fallaría a propósito.
    await expect(page.locator('main')).toContainText(/cronometrada/i, { timeout: 20_000 })
    const texto = await page.locator('main').innerText()
    expect(texto).not.toMatch(/must not be null|null|undefined/i)

    // Quitar el cierre: la operación que sí funciona aquí, y la que devuelve
    // los dos números. Es idempotente —ya estaba quitado— así que no deja rastro.
    await page.getByRole('button', { name: 'Quitar el cierre de la vacante' }).click()
    await page.getByRole('button', { name: 'Sí, quitar el cierre' }).click()
    await expect(page.getByText('La prueba ya no tiene fecha de cierre')).toBeVisible({ timeout: 20_000 })

    const despues = await page.locator('main').innerText()
    expect(despues).not.toMatch(/undefined|NaN/)
  })

  /**
   * El paso que faltaba entre calificar la prueba y verla en el ranking.
   *
   * ⚠️ **Calificar con IA no deja nota en la columna.** El agente pone la nota
   * de cada criterio; la de la etapa nace solo de `POST .../prueba/calificacion`,
   * y ese endpoint no estaba cableado.
   *
   * ⚠️ **No se pulsa el botón, a propósito.** Calcular la nota escribe, y se
   * comería el único caso que reproduce el fallo. Lo que se ejercita es que la
   * pantalla DIGA en cuál de las tres situaciones está cada persona, y el 409
   * de la rama que sí se puede provocar sin escribir.
   */
  test.describe('la nota de la prueba, que no nace de calificar', () => {
    interface ConRubrica {
      vacante: Vacante
      fila: FilaDelRanking
      criterios: number
      puestas: number
    }
    const conRubrica: ConRubrica[] = []

    test.beforeAll(async () => {
      for (const vacante of vacantes) {
        for (const fila of await filasDe(vacante.id)) {
          const notas = (await apiPanel(`/postulaciones/${fila.postulacionId}/prueba/notas`)).cuerpo
          if (!Array.isArray(notas) || notas.length === 0) continue
          const puestas = notas.filter((n: { puntaje: number | null }) => n.puntaje !== null).length
          conRubrica.push({ vacante, fila, criterios: notas.length, puestas })
        }
      }
    })

    // `.last()`: la ficha vive dentro de otra `section`, y la de dentro es la
    // última en orden de documento.
    const bloqueDeLaNota = (page: Page) =>
      page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'La nota de la prueba', exact: true }) })
        .last()

    test('hay postulaciones con rúbrica de prueba que mirar', async () => {
      expect(conRubrica.length).toBeGreaterThan(0)
    })

    test('con la rúbrica entera y sin nota, la pantalla lo dice y ofrece el paso que la produce', async ({ page }) => {
      const enteraSinNota = conRubrica.find((f) => f.puestas === f.criterios && f.fila.notaEtapa === null)
      // No se pasa en verde callando: es el caso que esta pieza existe para cubrir.
      test.skip(
        !enteraSinNota,
        'no hay ninguna con la rúbrica entera y sin nota de etapa: ese es el caso que dejaba la columna en blanco; sin él no se ejercita el botón',
      )
      await abrirLaFichaDe(page, enteraSinNota!.vacante, enteraSinNota!.fila)
      const bloque = bloqueDeLaNota(page)
      await expect(bloque).toBeVisible({ timeout: 20_000 })
      const dice = await bloque.innerText()
      expect(dice, `la ${enteraSinNota!.fila.postulacionId} tiene sus ${enteraSinNota!.criterios} criterios y ninguna nota`).toMatch(/todavía no tiene nota de la prueba/i)
      // Lo que no existía.
      await expect(bloque.getByRole('button', { name: 'Calcular la nota de la prueba' })).toHaveCount(1)
      // Calificar y ponderar son dos cosas.
      expect(dice).toMatch(/se calcula ponderándolas/i)
    })

    test('con la rúbrica vacía manda a la IA, NO ofrece calcular, y el 409 nombra los criterios que faltan', async ({ page }) => {
      const sinCalificar = conRubrica.find((f) => f.puestas === 0 && f.fila.notaEtapa === null)
      test.skip(!sinCalificar, 'no hay ninguna con la rúbrica vacía: esa rama no se ejercita')
      await abrirLaFichaDe(page, sinCalificar!.vacante, sinCalificar!.fila)
      const bloque = bloqueDeLaNota(page)
      await expect(bloque).toBeVisible({ timeout: 20_000 })
      const dice = await bloque.innerText()
      expect(dice.slice(0, 140)).toMatch(/Ninguno de sus criterios tiene nota/i)
      // El backend lo rechazaría con 409.
      await expect(bloque.getByRole('button', { name: 'Calcular la nota de la prueba' })).toHaveCount(0)

      // El 409, por la API: nombra los criterios que faltan uno a uno y no escribe.
      const rechazo = await apiPanel(`/postulaciones/${sinCalificar!.fila.postulacionId}/prueba/calificacion`, {
        method: 'POST',
      })
      expect(rechazo.estado, detalleDe(rechazo)).toBe(409)
      expect(detail(rechazo)).toMatch(/faltan notas por poner/i)
    })
  })

  /**
   * El bloque de la tanda, encima de la tabla de la prueba.
   *
   * ⚠️ **El backend no tiene nada en lote para la prueba y no sabe quién está
   * calificado**: el panel pide la rúbrica de cada uno y reparte. Lo que se
   * comprueba aquí es ese reparto contra lo que devuelve la API, no contra una
   * lista escrita a mano.
   *
   * ⚠️ **No se pulsa ninguno de los dos botones.** Ponderar escribe y se
   * comería el caso que reproduce el fallo; calificar cuesta una llamada al
   * modelo por persona.
   *
   * ⚠️ **La vacante se elige, no se fija.** A quien alcanza el bloque es a
   * quien está PARADO en la prueba sin nota, y el estado retrocede: fijarla
   * dejaría esta mitad sin ejercitar y pasando en verde.
   */
  test('las notas de la prueba para la tanda entera: el reparto cuadra con la API y las acciones con el reparto', async ({ page }) => {
    let elegida: Vacante | undefined
    let alcanzados: FilaDelRanking[] = []
    for (const v of vacantes) {
      const suyos = (await filasDe(v.id)).filter(
        (f) => f.notaEtapa === null && f.estado.startsWith('PRUEBA_') && !f.estado.endsWith('TURNO_CANDIDATO'),
      )
      if (suyos.length > alcanzados.length) {
        elegida = v
        alcanzados = suyos
      }
    }
    elegida ??= conRespuestas?.vacante ?? vacantes[0]!
    console.log(`[TANDA] se mira «${elegida.titulo}»: ${alcanzados.length} rindieron y siguen sin nota`)

    await irAVacante(page, elegida.titulo)
    await pestana(page, 'Prueba del puesto').click()
    await expect(page.locator('table thead th', { hasText: 'Nota de la prueba' })).toBeVisible({ timeout: 20_000 })

    const bloque = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Las notas de la prueba', exact: true }) })
      .last()

    if (alcanzados.length === 0) {
      // Sin nadie que haya rendido y siga sin nota, el bloque no se pinta.
      await expect(bloque).toHaveCount(0)
      console.log('[TANDA] nadie rindió la prueba sin nota en esta vacante: el reparto no se ejercita')
      return
    }

    await expect(bloque).toBeVisible({ timeout: 20_000 })
    const dice = await bloque.innerText()
    expect(dice.slice(0, 140)).toContain(`${alcanzados.length} persona`)
    // Y no a quien todavía no la ha rendido.
    expect(dice).not.toMatch(/TURNO_CANDIDATO/)

    // El reparto de verdad, calculado desde la API igual que lo hace el panel.
    const esperado = { entera: 0, vacia: 0, aMedias: 0, sinRubrica: 0 }
    for (const f of alcanzados) {
      const rubrica = (await apiPanel(`/postulaciones/${f.postulacionId}/prueba/notas`)).cuerpo
      if (!Array.isArray(rubrica) || rubrica.length === 0) {
        esperado.sinRubrica += 1
        continue
      }
      const puestas = rubrica.filter((n: { puntaje: number | null }) => n.puntaje !== null).length
      if (puestas === rubrica.length) esperado.entera += 1
      else if (puestas === 0) esperado.vacia += 1
      else esperado.aMedias += 1
    }

    await bloque.getByRole('button', { name: /Ver qué le falta/ }).click()
    await expect(bloque.getByRole('button', { name: 'Dejarlo' })).toBeVisible({ timeout: 20_000 })
    const reparto = await bloque.innerText()

    expect(esperado.entera === 0 || reparto.includes(`${esperado.entera}`), reparto.slice(0, 220)).toBe(true)
    // Con alguna entera ofrece calcular sus notas; sin ninguna NO: el backend contestaría 409.
    await expect(bloque.getByRole('button', { name: /^Calcular/ })).toHaveCount(esperado.entera > 0 ? 1 : 0)
    /*
      ⚠️ **Que no haya ninguna entera pasa en verde, y eso esconde que la mitad
      importante no se miró.** No es un fallo del código —es el estado de la
      base— así que no se marca rojo, pero tampoco se calla. Se siembra
      moviendo a PRUEBA_CALIFICANDO a alguien con la rúbrica entera y sin nota.
    */
    if (esperado.entera === 0) {
      console.log(
        '[TANDA] ⚠ NADIE tiene la rúbrica entera y sin nota: el botón de calcular —lo que este bloque existe para ofrecer— no se ejercitó.',
      )
    }
    // Ofrece pedirle la calificación a la IA solo para quien no tiene ningún criterio.
    await expect(bloque.getByRole('button', { name: /Pedirle a la IA/ })).toHaveCount(esperado.vacia > 0 ? 1 : 0)
    if (esperado.aMedias > 0) {
      // Sin acción en lote: se le termina desde su ficha.
      expect(reparto).toMatch(/se le termina desde su ficha/)
    }
  })

  test('calificar la tanda: la criba rápida pregunta antes, dice a quién alcanza y se puede echar atrás', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)

    const rapida = page.getByRole('button', { name: 'Criba rápida' })
    await expect(rapida).toHaveCount(1)

    await rapida.click()
    await expect(page.locator('main')).toContainText(/¿Seguimos\?/)
    const pregunta = await page.locator('main').innerText()
    expect(pregunta).toMatch(/Alcanza a/i)
    expect(pregunta).toMatch(/¿Seguimos\?/)
    // Nombrando cuánta gente es.
    expect(pregunta).toMatch(/\d+ personas de la tanda|toda la tanda/)

    // No se confirma: pedir la criba de una tanda entera dispara llamadas al
    // modelo para todo el mundo, y esta prueba no tiene por qué costar eso.
    await page.getByRole('button', { name: /Mejor no|Cancelar/ }).first().click()
    await expect(page.getByRole('button', { name: 'Criba rápida' })).toHaveCount(1)
  })
})

// ---------- La entrada de las empresas, en el portal ----------

test.describe('La entrada de las empresas', () => {
  test('vive en el pie del portal, no en la barra de arriba, lleva a la entrada del panel y no ofrece registrarse', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const enlace = page.locator('footer').getByRole('link', { name: /panel de empresas/i })
    await expect(enlace).toHaveCount(1)

    // La barra de arriba es el camino de quien postula.
    const arriba = await page.locator('header').innerText()
    expect(arriba, arriba).not.toMatch(/empresa/i)

    await enlace.click()
    await expect(page).toHaveURL(/\/admin\/entrar/)

    // Las cuentas del panel nacen solo por invitación.
    const texto = await page.locator('main, body').first().innerText()
    expect(texto).not.toMatch(/crear cuenta|regístrate|registrate/i)
  })
})

