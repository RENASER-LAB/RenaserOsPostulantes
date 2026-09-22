import { expect, type Locator, type Page } from '@playwright/test'

import { corte, entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import {
  auditoriaDe,
  campoLocal,
  CIERRA_EN,
  entrarAlPanelComo,
  fechaLarga,
  motivoDe,
  pedir,
  PANEL_SOLO_LECTURA,
  plazoPropioDe,
  prepararElReloj,
  pruebaCierraEnDe,
  restaurarElTerreno,
  retirarLoSembrado,
  sembrarTerreno,
  type Terreno,
  tokenDelCandidatoDe,
  tokenDePanelDe,
  venceEnDe,
} from './ayuda-plazo-de-la-prueba'

/**
 * **Ver y ajustar el plazo de la prueba del puesto** (AC-01 … AC-17).
 *
 * ⚠️ **ESCRIBE**: siembra siete vacantes marcadas `QA-PLAZO-E2E-7106`, una
 * plantilla de prueba de plazo abierto, dieciséis cuentas de candidato y una
 * cuenta de panel de solo lectura. Todo se retira en `afterAll`; la siembra va
 * en `ayuda-plazo-de-la-prueba.ts`, que explica por qué no se tocan las
 * vacantes de la base.
 *
 * Lo que aquí se comprueba, y que ninguna otra prueba mira:
 *
 *   1. **Qué plazo rige HOY se lee antes de tocarlo**, en las dos pantallas: la
 *      línea de la vacante con sus cinco casos y la de cada persona con sus
 *      cuatro estados. Hasta ahora los dos campos de fecha salían vacíos y la
 *      pantalla decía en voz alta que no podía saber qué había.
 *   2. **Una plantilla CRONOMETRADA sí admite fecha**, y el reloj y la fecha
 *      conviven: quien abre temprano tiene sus minutos, quien abre pegado a la
 *      fecha cierra a la fecha y quien llega después no puede abrirla.
 *   3. **El aviso previo cuenta igual que el resultado**: ocho se mueven, dos
 *      no porque tienen fecha propia, y después del guardado coincide.
 *   4. **Una fecha propia sobrevive al cambio de la de la convocatoria**, y la
 *      ficha sigue diciendo «puesta a mano».
 *   5. **La hora escrita, la mostrada y la guardada en UTC son la misma**,
 *      incluso cruzando la medianoche y el domingo del cambio de horario.
 *   6. **Quien no puede mover el plazo igualmente lo ve**, y al intentarlo
 *      recibe el aviso del permiso sin que nada cambie.
 */

const ZONA = 'America/Lima'

let terreno: Terreno

test.beforeAll(async () => {
  terreno = await sembrarTerreno()
})

test.afterAll(() => {
  retirarLoSembrado()
})

// ---------- llegar a cada control ----------

const plegableDePlazos = (page: Page): Locator =>
  page.locator('details:has(summary:text-is("Plazos de la prueba"))')

/** Abre «Plazos de la prueba» de una vacante y devuelve el desplegable. */
async function abrirPlazos(page: Page, vacanteId: number): Promise<Locator> {
  await page.goto(`/admin/vacantes/${vacanteId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const cajon = page.getByRole('region', { name: 'Configuración de la vacante' })
  if (!(await cajon.isVisible())) {
    await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
  }
  await expect(cajon).toBeVisible()
  const plegable = plegableDePlazos(page)
  await expect(plegable).toBeAttached({ timeout: 20_000 })
  if (!(await plegable.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await plegable.locator('summary').click()
  }
  return plegable
}

/** Abre la ficha de una persona en la etapa Prueba del puesto. */
async function abrirFicha(page: Page, vacanteId: number, nombre: string): Promise<Locator> {
  await page.goto(`/admin/vacantes/${vacanteId}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  const cajon = page.getByRole('region', { name: 'Configuración de la vacante' })
  if (await cajon.isVisible()) {
    await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
    await expect(cajon).toBeHidden()
  }
  await page.getByRole('tab', { name: 'Prueba del puesto', exact: true }).click()
  await corte(page, 'Toda la tanda').click()
  await page.getByRole('button', { name: nombre, exact: true }).click()
  const bloque = page.locator('div:has(> h3:text-is("El plazo de esta persona"))')
  await expect(bloque).toBeVisible({ timeout: 20_000 })
  // La consulta del plazo tiene su propio «buscando…»: esperar a que termine
  // evita leer el hueco y darlo por el estado de la persona.
  await expect(bloque).not.toContainText('Buscando qué plazo rige', { timeout: 20_000 })
  return bloque
}

const laLinea = (donde: Locator): Locator => donde.locator('[role="status"]').first()
const campoDeFecha = (donde: Locator): Locator => donde.locator('input[type="datetime-local"]')

test.describe('Nuevo · el plazo de la prueba se ve antes de tocarlo', () => {
  test.beforeEach(async ({ page }) => {
    restaurarElTerreno(terreno.vacantes, terreno.versionPlazoAbierto)
    await entrarAlPanel(page)
  })

  test('AC-01, AC-07, AC-10, AC-16 · la fecha vigente se lee, el aviso previo cuenta igual que el resultado, y la ficha la llama «de la vacante»', async ({
    page,
  }) => {
    const plazos = await abrirPlazos(page, terreno.vacantes.CON_FECHA)

    // AC-01: la línea dice qué rige, y el campo llega sembrado con ello.
    await expect(laLinea(plazos)).toHaveText(
      `Cierra el ${fechaLarga(CIERRA_EN, ZONA)} (hora de tu equipo, ${ZONA}).`,
    )
    await expect(campoDeFecha(plazos)).toHaveValue(campoLocal(CIERRA_EN, ZONA))

    // Sin cambio pendiente no se promete ningún movimiento.
    await expect(plazos.getByText(/Se moverá el cierre de/)).toHaveCount(0)

    // AC-07: al escribir otra fecha, ANTES de guardar, se dice a cuántos alcanza.
    const nueva = '2027-04-18T07:45'
    const nuevaUtc = new Date(nueva).toISOString()
    await campoDeFecha(plazos).fill(nueva)
    await expect(
      plazos.getByText(
        'Se moverá el cierre de 8 exámenes abiertos; 2 quedan como están porque tienen fecha propia.',
      ),
    ).toBeVisible()

    const motivo = motivoDe('la tanda entera cierra el domingo')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivo)
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()

    // El resultado coincide con lo prometido…
    await expect(plazos.getByText('Se movieron 8 exámenes ya abiertos a esa fecha.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      plazos.getByText(
        '2 personas no cambiaron: tienen fecha propia, y esa manda sobre la de la vacante.',
      ),
    ).toBeVisible()
    // …y la línea de «lo que rige hoy» se actualiza SIN recargar la página.
    await expect(laLinea(plazos)).toHaveText(
      `Cierra el ${fechaLarga(nuevaUtc, ZONA)} (hora de tu equipo, ${ZONA}).`,
    )

    // Lo guardado es lo escrito, y a quien tenía fecha propia no se le tocó.
    expect(new Date(pruebaCierraEnDe(terreno.vacantes.CON_FECHA)!).toISOString()).toBe(nuevaUtc)
    expect(new Date(venceEnDe('encurso')!).toISOString()).toBe(nuevaUtc)
    expect(new Date(venceEnDe('propio')!).toISOString()).not.toBe(nuevaUtc)

    // AC-16: la auditoría guarda el antes, el después y el motivo.
    const anotado = auditoriaDe(motivo)
    expect(anotado).toHaveLength(1)
    expect(anotado[0]!.accion).toBe('definir_cierre_prueba')
    // ⚠️ Se comparan INSTANTES y no cadenas: la auditoría guarda el
    // `Instant.toString()` de Java, que se come los milisegundos en cero
    // («…04:59:00Z» y no «…04:59:00.000Z»). Comparar el texto haría fallar a
    // esta prueba por una fecha que es exactamente la que tenía que anotarse.
    const anotadoComo = (crudo: unknown) =>
      new Date((JSON.parse(String(crudo)) as { pruebaCierraEn: string }).pruebaCierraEn).toISOString()
    expect(anotadoComo(anotado[0]!.anterior)).toBe(new Date(CIERRA_EN).toISOString())
    expect(anotadoComo(anotado[0]!.nuevo)).toBe(nuevaUtc)

    // AC-10: en la ficha de quien la está rindiendo, esa misma fecha y su origen.
    const ficha = await abrirFicha(page, terreno.vacantes.CON_FECHA, 'Zqa En Curso')
    await expect(laLinea(ficha)).toContainText(`Le cierra el ${fechaLarga(nuevaUtc, ZONA)}`)
    await expect(laLinea(ficha)).toContainText('(la de la vacante)')
  })

  test('AC-02 y AC-08 · sin fecha se dicen los días de cada persona, y quitarla vuelve a decirlos', async ({
    page,
  }) => {
    const plazos = await abrirPlazos(page, terreno.vacantes.SIN_FECHA)
    const sinFecha = 'Sin fecha para todos: a cada persona le cierra 5 días después de que empieza.'

    await expect(laLinea(plazos)).toHaveText(sinFecha)
    await expect(campoDeFecha(plazos)).toHaveValue('')

    // Se le pone una…
    await campoDeFecha(plazos).fill('2027-05-30T18:00')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivoDe('probando a fijarla'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(laLinea(plazos)).toContainText('Cierra el', { timeout: 20_000 })

    // AC-08: …y se quita, con motivo, y la línea vuelve a la regla de los días.
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivoDe('se quita el cierre'))
    await plazos.getByRole('button', { name: 'Quitar el cierre de la vacante' }).click()
    await plazos.getByRole('button', { name: 'Sí, quitar el cierre' }).click()
    await expect(plazos.getByText('La prueba ya no tiene fecha de cierre')).toBeVisible({
      timeout: 20_000,
    })
    await expect(laLinea(plazos)).toHaveText(sinFecha)
    await expect(campoDeFecha(plazos)).toHaveValue('')
    expect(pruebaCierraEnDe(terreno.vacantes.SIN_FECHA)).toBeNull()
  })

  test('AC-03 y AC-03b · una cronometrada acepta fecha, y al empezar rige el plazo que caiga antes', async ({
    page,
  }) => {
    const plazos = await abrirPlazos(page, terreno.vacantes.CRONOMETRADA)
    const minutos = Number(
      /Cronometrada: (\d+) minutos/.exec((await laLinea(plazos).innerText()) ?? '')?.[1],
    )
    expect(minutos, 'la línea no dice los minutos de la prueba cronometrada').toBeGreaterThan(0)
    await expect(laLinea(plazos)).toHaveText(
      `Cronometrada: ${minutos} minutos desde que cada persona empieza, sin fecha límite para empezar.`,
    )

    // AC-03: la fecha se guarda SIN error. Antes esto contestaba 400
    // («anularía el reloj») y el panel ni ofrecía el control.
    await campoDeFecha(plazos).fill(campoLocal(CIERRA_EN, ZONA))
    await plazos
      .getByRole('textbox', { name: 'Por qué se fija esta fecha' })
      .fill(motivoDe('nadie sigue después del domingo'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(plazos.getByText('La prueba se cierra el')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('main')).not.toContainText('anularía el reloj')
    await expect(laLinea(plazos)).toHaveText(
      `Cronometrada: ${minutos} minutos desde que cada persona empieza, y nadie puede seguir ` +
        `después del ${fechaLarga(CIERRA_EN, ZONA)} (hora de tu equipo, ${ZONA}). Rige lo que caiga antes.`,
    )
    expect(new Date(pruebaCierraEnDe(terreno.vacantes.CRONOMETRADA)!).toISOString()).toBe(
      new Date(CIERRA_EN).toISOString(),
    )

    // AC-03b: los dos plazos conviven y gana el que caiga antes.
    prepararElReloj(terreno.vacantes.CRONOMETRADA, terreno.versionCronometrada)

    const temprano = await pedir(`/portal/prueba/${terreno.uuids.get('temprano')}/inicio`, {
      metodo: 'POST',
      token: await tokenDelCandidatoDe('temprano'),
    })
    expect(temprano.estado, JSON.stringify(temprano.cuerpo)).toBe(200)
    const suyo = temprano.cuerpo as Record<string, string>
    expect(
      Math.round((Date.parse(suyo.venceEn!) - Date.parse(suyo.iniciadoEn!)) / 60_000),
      'quien abre lejos de la fecha tiene sus minutos completos',
    ).toBe(minutos)

    const antesDeLaFecha = venceEnDe('cerca')
    const cerca = await pedir(`/portal/prueba/${terreno.uuids.get('cerca')}/inicio`, {
      metodo: 'POST',
      token: await tokenDelCandidatoDe('cerca'),
    })
    expect(cerca.estado, JSON.stringify(cerca.cuerpo)).toBe(200)
    expect(
      new Date(venceEnDe('cerca')!).toISOString(),
      'quien abre pegado a la fecha cierra a la fecha, no a sus minutos',
    ).toBe(new Date(antesDeLaFecha!).toISOString())

    const tarde = await pedir(`/portal/prueba/${terreno.uuids.get('tarde')}/inicio`, {
      metodo: 'POST',
      token: await tokenDelCandidatoDe('tarde'),
    })
    expect(tarde.estado).toBe(409)
    expect(JSON.stringify(tarde.cuerpo)).toContain('El tiempo para esta prueba ya se agotó')
  })

  test('AC-04, AC-05, AC-06 y AC-13 · los tres casos sin control dicen por qué, y el cuestionario ofrece sus minutos', async ({
    page,
  }) => {
    // AC-04: cuestionario técnico — minutos, sin fecha, y el enlace al ajuste.
    let plazos = await abrirPlazos(page, terreno.vacantes.CUESTIONARIO)
    await expect(plazos).toContainText(
      'Esta vacante rinde el cuestionario técnico: cada persona tiene 45 minutos desde que lo abre',
    )
    await expect(campoDeFecha(plazos)).toHaveCount(0)
    const enlace = plazos.getByRole('link', { name: /Ajustar los minutos/ })
    await expect(enlace).toHaveAttribute('href', '#tiempo-de-la-etapa-tecnica')
    await enlace.click()
    await expect(page.locator('#tiempo-de-la-etapa-tecnica')).toContainText('Cuánto tiempo tendrá')

    // AC-13: y su ficha no ofrece fecha por persona, y explica por qué.
    const ficha = await abrirFicha(page, terreno.vacantes.CUESTIONARIO, 'Zqa Cuestionario Tecnico')
    await expect(laLinea(ficha)).toHaveText(
      'Esta vacante rinde el cuestionario técnico: el tiempo de cada persona son los minutos de la vacante, y no hay una fecha por persona que fijar.',
    )
    await expect(campoDeFecha(ficha)).toHaveCount(0)

    // AC-05: vacante cerrada.
    plazos = await abrirPlazos(page, terreno.vacantes.CERRADA)
    await expect(plazos).toContainText(
      'La vacante está cerrada, así que su prueba ya no admite una fecha nueva.',
    )
    await expect(campoDeFecha(plazos)).toHaveCount(0)

    // AC-06: sin instrumento elegido, con lo que hay que elegir antes.
    plazos = await abrirPlazos(page, terreno.vacantes.SIN_INSTRUMENTO)
    await expect(plazos).toContainText('hay que elegir antes cuál rendirá')
    await expect(campoDeFecha(plazos)).toHaveCount(0)
  })

  test('AC-09, AC-11 y AC-12 · cada estado de la persona dice lo suyo, y el dato antiguo no es un error', async ({
    page,
  }) => {
    const vacante = terreno.vacantes.CON_FECHA

    // AC-09: no llegó a la etapa — no hay control.
    let ficha = await abrirFicha(page, vacante, 'Zqa Sin Intento')
    await expect(laLinea(ficha)).toHaveText(
      'Todavía no tiene prueba. El plazo se fija cuando llegue a la etapa.',
    )
    await expect(campoDeFecha(ficha)).toHaveCount(0)

    // Sin empezar: la fecha que heredó de la vacante, y el control sembrado.
    ficha = await abrirFicha(page, vacante, 'Zqa Sin Empezar')
    await expect(laLinea(ficha)).toContainText('Todavía no ha abierto la prueba.')
    await expect(laLinea(ficha)).toContainText(
      `Le cierra el ${fechaLarga(CIERRA_EN, ZONA)} (la de la vacante)`,
    )
    await expect(campoDeFecha(ficha)).toHaveValue(campoLocal(CIERRA_EN, ZONA))

    // AC-11: fecha puesta a mano — se dice, y guardar otra sigue pidiendo motivo.
    ficha = await abrirFicha(page, vacante, 'Zqa Fecha Propia')
    await expect(laLinea(ficha)).toContainText(
      'fecha puesta a mano, y no se mueve si cambia la de la vacante',
    )
    await ficha.getByRole('button', { name: 'Guardar el plazo' }).click()
    await expect(
      ficha.getByText('Escribe por qué se mueve la fecha. Queda guardado en la auditoría.'),
    ).toBeVisible()

    // El reloj: empezó y su fecha no es la de la convocatoria.
    ficha = await abrirFicha(page, vacante, 'Zqa Por Reloj')
    await expect(laLinea(ficha)).toContainText('la calculó el reloj de su prueba al abrirla')

    // Datos antiguos: `vence_en` nulo se lee como «todavía no», no como avería.
    ficha = await abrirFicha(page, vacante, 'Zqa Dato Antiguo')
    await expect(laLinea(ficha)).toContainText('Todavía no tiene fecha de cierre guardada.')
    await expect(laLinea(ficha)).not.toContainText(/error|no encontrada|undefined|null/i)
    await expect(campoDeFecha(ficha)).toHaveValue('')

    // AC-12: ya entregó — se dice cuándo y no se ofrece el control.
    ficha = await abrirFicha(page, vacante, 'Zqa Ya Entrego')
    await expect(laLinea(ficha)).toContainText('Entregó el')
    await expect(laLinea(ficha)).toContainText('El plazo ya no cambia.')
    await expect(ficha).toContainText('Una prueba entregada ya no admite otra fecha')
    await expect(campoDeFecha(ficha)).toHaveCount(0)
  })

  test('la fecha propia sobrevive al cambio de la de la vacante, y el aviso previo lo cuenta antes', async ({
    page,
  }) => {
    // Se le concede la suya desde la ficha…
    const ficha = await abrirFicha(page, terreno.vacantes.CON_FECHA, 'Zqa Relleno Uno')
    await expect(laLinea(ficha)).toContainText('(la de la vacante)')
    const suya = '2027-06-20T16:30'
    const suyaUtc = new Date(suya).toISOString()
    await campoDeFecha(ficha).fill(suya)
    await ficha
      .getByRole('textbox', { name: 'Por qué esta persona tiene otro plazo' })
      .fill(motivoDe('pidió más horas'))
    await ficha.getByRole('button', { name: 'Guardar el plazo' }).click()

    // …y la línea de arriba pasa a decir «a mano» sin recargar la página.
    await expect(laLinea(ficha)).toContainText(
      'fecha puesta a mano, y no se mueve si cambia la de la vacante',
      { timeout: 20_000 },
    )
    expect(plazoPropioDe('relleno1')).toBe(true)

    // Ahora son siete los que se mueven y tres los que no, y se dice ANTES.
    const plazos = await abrirPlazos(page, terreno.vacantes.CON_FECHA)
    const otra = '2027-07-04T10:00'
    await campoDeFecha(plazos).fill(otra)
    await expect(
      plazos.getByText(
        'Se moverá el cierre de 7 exámenes abiertos; 3 quedan como están porque tienen fecha propia.',
      ),
    ).toBeVisible()
    await plazos
      .getByRole('textbox', { name: 'Por qué se fija esta fecha' })
      .fill(motivoDe('la fecha propia no se mueve'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(plazos.getByText('Se movieron 7 exámenes ya abiertos a esa fecha.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      plazos.getByText(
        '3 personas no cambiaron: tienen fecha propia, y esa manda sobre la de la vacante.',
      ),
    ).toBeVisible()

    // La suya sigue donde estaba, y su ficha lo sigue diciendo.
    expect(new Date(venceEnDe('relleno1')!).toISOString()).toBe(suyaUtc)
    expect(new Date(venceEnDe('encurso')!).toISOString()).toBe(new Date(otra).toISOString())
    const otraVez = await abrirFicha(page, terreno.vacantes.CON_FECHA, 'Zqa Relleno Uno')
    await expect(laLinea(otraVez)).toContainText(`Le cierra el ${fechaLarga(suyaUtc, ZONA)}`)
    await expect(laLinea(otraVez)).toContainText('fecha puesta a mano')
  })

  test('AC-14 · lo vacío y lo pasado se avisan en el campo, sin llamar o con el texto del backend, y el doble clic no guarda dos veces', async ({
    page,
  }) => {
    const plazos = await abrirPlazos(page, terreno.vacantes.CON_FECHA)
    const llamadas: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/cierre-prueba')) llamadas.push(r.url())
    })

    // Fecha vacía sin querer quitarla: error en el campo y ninguna llamada.
    await campoDeFecha(plazos).fill('')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivoDe('sin fecha'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(
      plazos.getByText('Elige el día y la hora en que se cierra la prueba.'),
    ).toBeVisible()

    // Motivo vacío: lo mismo, y tampoco se llama.
    await campoDeFecha(plazos).fill('2027-08-08T12:00')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill('   ')
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(
      plazos.getByText('Escribe por qué se mueve la fecha. Queda guardado en la auditoría.'),
    ).toBeVisible()
    expect(llamadas, 'lo que no pasa la revisión del panel no se manda').toHaveLength(0)

    // AC-14: fecha pasada — el panel avisa, y si se insiste manda el texto del
    // backend al campo y no cambia nada.
    await campoDeFecha(plazos).fill('2020-01-05T10:00')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivoDe('fecha pasada'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(plazos.getByText('Esa fecha ya pasó. Guardarla cierra la prueba')).toBeVisible()
    await plazos.getByRole('button', { name: 'Sí, cerrarla ahora' }).click()
    await expect(
      plazos.getByText('Esa fecha ya pasó: fijarla entregaría sola la prueba de todos'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(laLinea(plazos)).toHaveText(
      `Cierra el ${fechaLarga(CIERRA_EN, ZONA)} (hora de tu equipo, ${ZONA}).`,
    )
    expect(new Date(pruebaCierraEnDe(terreno.vacantes.CON_FECHA)!).toISOString()).toBe(
      new Date(CIERRA_EN).toISOString(),
    )

    // El doble clic: el botón se deshabilita mientras guarda, así que una sola
    // línea de auditoría. Dos serían dos motivos para la misma fecha.
    const motivo = motivoDe('doble envío')
    await campoDeFecha(plazos).fill('2027-08-08T12:00')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivo)
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).dblclick()
    await expect(plazos.getByText('La prueba se cierra el')).toBeVisible({ timeout: 20_000 })
    expect(auditoriaDe(motivo)).toHaveLength(1)
  })

  test('AC-14 en la ficha · la fecha pasada de una persona también se avisa con el texto del backend', async ({
    page,
  }) => {
    const ficha = await abrirFicha(page, terreno.vacantes.CON_FECHA, 'Zqa Relleno Dos')
    await campoDeFecha(ficha).fill('2019-05-05T08:00')
    await ficha
      .getByRole('textbox', { name: 'Por qué esta persona tiene otro plazo' })
      .fill(motivoDe('fecha pasada de una persona'))
    await ficha.getByRole('button', { name: 'Guardar el plazo' }).click()
    await expect(ficha.getByText('Esa fecha ya pasó. Guardarla le cierra la prueba')).toBeVisible()
    await ficha.getByRole('button', { name: 'Sí, cerrársela ahora' }).click()
    await expect(
      ficha.getByText('Esa fecha ya pasó: al candidato se le entregaría la prueba sola'),
    ).toBeVisible({ timeout: 20_000 })
    expect(new Date(venceEnDe('relleno2')!).toISOString()).toBe(new Date(CIERRA_EN).toISOString())
    expect(plazoPropioDe('relleno2')).toBe(false)
  })
})

test.describe('Nuevo · quien no puede mover el plazo igualmente lo ve', () => {
  test.beforeEach(async ({ page }) => {
    restaurarElTerreno(terreno.vacantes, terreno.versionPlazoAbierto)
    await entrarAlPanelComo(page, PANEL_SOLO_LECTURA)
  })

  test('AC-15 · el vigente se lee en las dos pantallas, y guardar devuelve el aviso del permiso sin cambiar nada', async ({
    page,
  }) => {
    // La vacante: ve la fecha y el campo sembrado…
    const plazos = await abrirPlazos(page, terreno.vacantes.CON_FECHA)
    await expect(laLinea(plazos)).toHaveText(
      `Cierra el ${fechaLarga(CIERRA_EN, ZONA)} (hora de tu equipo, ${ZONA}).`,
    )
    await expect(campoDeFecha(plazos)).toHaveValue(campoLocal(CIERRA_EN, ZONA))

    // …y al intentar moverla, el aviso del permiso que ya existía.
    await campoDeFecha(plazos).fill('2027-09-09T23:59')
    await plazos.getByRole('textbox', { name: 'Por qué se fija esta fecha' }).fill(motivoDe('sin permiso'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(
      plazos.getByText('hace falta el permiso «elegir_plantilla_prueba»'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(laLinea(plazos)).toHaveText(
      `Cierra el ${fechaLarga(CIERRA_EN, ZONA)} (hora de tu equipo, ${ZONA}).`,
    )
    expect(new Date(pruebaCierraEnDe(terreno.vacantes.CON_FECHA)!).toISOString()).toBe(
      new Date(CIERRA_EN).toISOString(),
    )

    // La persona: lo mismo, con el permiso que toca a esa pantalla.
    const ficha = await abrirFicha(page, terreno.vacantes.CON_FECHA, 'Zqa Relleno Tres')
    await expect(laLinea(ficha)).toContainText(
      `Le cierra el ${fechaLarga(CIERRA_EN, ZONA)} (la de la vacante)`,
    )
    await campoDeFecha(ficha).fill('2027-09-09T23:59')
    await ficha
      .getByRole('textbox', { name: 'Por qué esta persona tiene otro plazo' })
      .fill(motivoDe('sin permiso en la ficha'))
    await ficha.getByRole('button', { name: 'Guardar el plazo' }).click()
    await expect(ficha.getByText('hace falta el permiso «mover_postulacion»')).toBeVisible({
      timeout: 20_000,
    })
    expect(new Date(venceEnDe('relleno3')!).toISOString()).toBe(new Date(CIERRA_EN).toISOString())
    expect(plazoPropioDe('relleno3')).toBe(false)
  })

  test('leer el plazo pide el permiso de abrir la ficha, no el de moverlo', async () => {
    const token = await tokenDePanelDe(PANEL_SOLO_LECTURA)
    const postulacion = terreno.postulaciones.get('encurso')
    const leer = await pedir(`/panel/postulaciones/${postulacion}/prueba/plazo`, { token })
    expect(leer.estado).toBe(200)
    expect((leer.cuerpo as Record<string, unknown>).origen).toBe('VACANTE')

    const mover = await pedir(`/panel/postulaciones/${postulacion}/prueba/plazo`, {
      metodo: 'POST',
      token,
      cuerpo: { venceEn: '2027-09-09T23:59:00Z', motivo: motivoDe('no debería poder') },
    })
    expect(mover.estado).toBe(403)
  })
})

/**
 * El domingo del cambio de horario, mirado desde un sitio que lo tiene.
 *
 * ⚠️ **Lima no cambia la hora**, así que el resto de la suite nunca pisa este
 * caso: el error clásico —armar el campo con el reloj de UTC— se ve igual de
 * mal a −05:00 fijo que en marzo, pero la hora que **no existe** solo aparece
 * donde los relojes saltan. Madrid adelanta a las 02:00 del 28 de marzo de
 * 2027, así que las 04:00 de ese día son 02:00Z y las 02:30 no existen.
 */
test.describe('Nuevo · la hora escrita, la mostrada y la guardada son la misma', () => {
  const MADRID = 'Europe/Madrid'
  test.use({ timezoneId: MADRID })

  test.beforeEach(async ({ page }) => {
    restaurarElTerreno(terreno.vacantes, terreno.versionPlazoAbierto)
    await entrarAlPanel(page)
  })

  test('AC-17 · una fecha del domingo del cambio de horario se guarda, se relee y se vuelve a pintar igual', async ({
    page,
  }) => {
    const plazos = await abrirPlazos(page, terreno.vacantes.HORARIO)

    // Una hora que NO existe: el panel no la silencia, dice qué se guardará.
    await campoDeFecha(plazos).fill('2027-03-28T02:30')
    await expect(plazos.getByText(/Se guardará como .* eso es /)).toContainText(
      fechaLarga('2027-03-28T01:30:00Z', MADRID),
    )

    // Y una del día siguiente al salto, que ya va con el desfase nuevo.
    const escrita = '2027-03-28T04:00'
    const enUtc = '2027-03-28T02:00:00.000Z'
    await campoDeFecha(plazos).fill(escrita)
    await plazos
      .getByRole('textbox', { name: 'Por qué se fija esta fecha' })
      .fill(motivoDe('el domingo del cambio de horario'))
    await plazos.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
    await expect(plazos.getByText('La prueba se cierra el')).toBeVisible({ timeout: 20_000 })

    // Lo guardado en UTC es el instante que toca…
    expect(new Date(pruebaCierraEnDe(terreno.vacantes.HORARIO)!).toISOString()).toBe(
      new Date(enUtc).toISOString(),
    )
    // …y al recargar, el campo vuelve a escribir la misma hora local.
    const otraVez = await abrirPlazos(page, terreno.vacantes.HORARIO)
    await expect(campoDeFecha(otraVez)).toHaveValue(escrita)
    expect(campoLocal(enUtc, MADRID)).toBe(escrita)
    await expect(laLinea(otraVez)).toHaveText(
      `Cierra el ${fechaLarga(enUtc, MADRID)} (hora de tu equipo, ${MADRID}).`,
    )
  })
})
