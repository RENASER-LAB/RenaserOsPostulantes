import { writeFileSync } from 'node:fs'
import { expect, type Locator, type Page } from '@playwright/test'
import { abrirFiltros, cerrarFiltros, corte, filasDelRanking, nombresVisibles, panelFiltros } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre, sql } from './base-de-datos'
import { entrarAlPanelCon, entrarAlPortalCon, exigir, pedir, tokenDePanel, uno } from './ayuda-preguntas-propias'
import {
  entregarLaPrueba,
  estadoDe,
  iniciarLaPrueba,
  notaDeLaEtapa,
  responderLaPrueba,
  vencer,
  verLaPrueba,
  type Candidata,
} from './ayuda-prueba-propia'
import { excelPorLaApi, leerElLibro } from './ayuda-rubrica-vigente'
import {
  CASO,
  MINUTOS,
  Q1,
  Q2,
  Q3,
  candidata,
  enLimaDentroDeHoras,
  equipoSin,
  esperarAlBarrido,
  instanteDeLima,
  retirarLoSembrado,
  vacanteConPrueba,
} from './ayuda-mas-tiempo-qa'

/**
 * QA de «Las pruebas incompletas, dentro del ranking y con «Darle más tiempo»» (V89),
 * con la sección «Verificación» de la spec: una vacante con la prueba del editor
 * cronometrada, cerrada, y siete candidatas en la etapa.
 *
 *   Ana   · la entrega completa: se califica sola (solo cerradas) → «Calificada».
 *   Beto  · la empieza, responde 1 de 3 y vence → «No la completó» (barrido real).
 *   Carla · la empieza, responde 2 de 3 y vence → «No la completó».
 *   Dani  · nunca la abre y su fecha pasa → «No la completó» sin abrirla.
 *   Eva   · la está haciendo → «En curso».
 *   Fede  · la tiene sin abrir y con plazo → «Sin empezar».
 *   Gabi  · vence con huecos y su proceso ya se cerró → «No la completó», cerrada.
 *
 * El orden de los tests importa poco: cada uno mueve solo a sus candidatas. El del
 * Excel va antes de los que reabren pruebas para verlo con quien sigue abierta.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` retira lo sembrado (marca QA-MT-0089).
 */

const correos: string[] = []
let equipo = ''
let sinMover = ''
let vacante = 0
const quien = {} as Record<'ana' | 'beto' | 'carla' | 'dani' | 'eva' | 'fede' | 'gabi', Candidata>
const nombre = (c: Candidata) => String(uno(`select p.nombre || ' ' || p.apellidos as n from usuario u
                                               join persona p on p.id = u.persona_id where u.id = ${c.usuario}`).n)

const ranking = async () => (await exigir<any>(`/panel/vacantes/${vacante}/ranking?etapa=PRUEBA_PUESTO`, equipo)).filas as any[]
const filaDe = async (c: Candidata) => (await ranking()).find((f) => f.postulacionId === c.postulacion)

/** Responde por la API; `que` dice cuáles. */
async function responder(c: Candidata, que: { q1?: boolean; q2?: boolean; q3?: boolean }) {
  const p = (await verLaPrueba(c)).cuerpo
  const q = (t: string) => (p.preguntas as any[]).find((x) => x.enunciado === t)
  const op = (t: string, o: string) => q(t).opciones.find((x: any) => x.texto === o).id
  if (que.q1) expect((await responderLaPrueba(c, q(Q1).id, { opcionId: op(Q1, 'El arqueo') })).estado).toBe(200)
  if (que.q2) {
    expect((await responderLaPrueba(c, q(Q2).id, { marcadas: [op(Q2, 'Los vouchers'), op(Q2, 'El fondo fijo')] })).estado).toBe(200)
  }
  if (que.q3) expect((await responderLaPrueba(c, q(Q3).id, { opcionId: op(Q3, 'BUSCARV') })).estado).toBe(200)
}

async function abrirLaPrueba(page: Page, cual: 'Toda la tanda' | 'Pendiente' | 'Le toca al candidato') {
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: /^Prueba del puesto/ }).click()
  await corte(page, cual).click()
  await expect(corte(page, cual)).toHaveAttribute('aria-pressed', 'true')
}

const seccionPrueba = (page: Page): Locator =>
  panelFiltros(page).locator('fieldset').filter({ has: page.locator('legend', { hasText: /^Prueba/ }) })

/** Las cifras de las cinco casillas de la sección «Prueba». */
async function cifrasDeLaSeccion(page: Page): Promise<Record<string, string>> {
  const salida: Record<string, string> = {}
  for (const etiqueta of await seccionPrueba(page).locator('label').all()) {
    const cifra = (await etiqueta.locator('[data-cifra]').textContent())!.trim()
    const texto = (await etiqueta.textContent())!.trim()
    salida[texto.slice(0, texto.length - cifra.length).trim()] = cifra
  }
  return salida
}

async function marcarNoLaCompleto(page: Page) {
  await abrirFiltros(page)
  await seccionPrueba(page).getByRole('checkbox', { name: /^No la completó/ }).check()
  await cerrarFiltros(page)
}

const abrirFicha = async (page: Page, c: Candidata) => {
  const ficha = page.locator(`#ficha-${c.postulacion}`)
  // El nombre abre y cierra la ficha: solo se pulsa si no está ya abierta.
  if (!(await ficha.isVisible())) await page.getByRole('button', { name: nombre(c), exact: true }).click()
  await expect(ficha).toBeVisible({ timeout: 20_000 })
  return ficha
}

const intento = (c: Candidata) =>
  uno(`select no_completada, entregado_en is null as abierta, plazo_propio, iniciado_en, vence_en, mas_tiempo_motivo
         from intento_prueba where postulacion_id = ${c.postulacion}`)

const contar = (consulta: string) => Number(uno(`select count(*) as n from (${consulta}) x`).n)

test.describe('QA V89 · las incompletas en el ranking y «Darle más tiempo»', () => {
  test.beforeAll(async () => {
    // El barrido de vencimientos pasa cada 60 s.
    test.setTimeout(300_000)
    equipo = await tokenDePanel()
    vacante = await vacanteConPrueba(equipo, 'Cajera de la sede norte')
    for (const n of ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fede', 'Gabi'] as const) {
      quien[n.toLowerCase() as keyof typeof quien] = await candidata(equipo, vacante, n, correos)
    }
    // Ana la entrega completa: con solo cerradas se califica al entregar.
    await iniciarLaPrueba(quien.ana)
    await responder(quien.ana, { q1: true, q2: true, q3: true })
    expect((await entregarLaPrueba(quien.ana)).estado).toBe(200)
    // Beto, Carla y Gabi la empiezan y la dejan vencer con huecos; Eva la está haciendo.
    for (const c of [quien.beto, quien.gabi, quien.carla, quien.eva]) await iniciarLaPrueba(c)
    await responder(quien.beto, { q1: true })
    await responder(quien.gabi, { q1: true })
    await responder(quien.carla, { q1: true, q2: true })
    for (const c of [quien.beto, quien.carla, quien.gabi]) vencer(c.postulacion)
    // Dani nunca la abre y su fecha ya pasó: el barrido no la toca, se calcula al leer.
    sql(`update intento_prueba set vence_en = now() - interval '3 hours'
          where postulacion_id = ${quien.dani.postulacion};`)
    await esperarAlBarrido([quien.beto.postulacion, quien.carla.postulacion, quien.gabi.postulacion])
    // El proceso de Gabi ya se cerró, como con el «Cerrar su proceso» de antes.
    await exigir(`/panel/postulaciones/${quien.gabi.postulacion}/transiciones`, equipo, 'POST', {
      estadoDestino: 'NO_CONTINUA', motivo: 'QA-MT-0089: no completó la prueba', avisar: false,
    })
    // La vacante se cierra, como el cierre automático de la V78 antes de que se rinda la prueba.
    await exigir(`/panel/vacantes/${vacante}/cierre`, equipo, 'POST', { motivo: 'QA-MT-0089: cierre por fecha' })
    sinMover = equipoSin('sin-mover', ['mover_postulacion'])
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('la tabla, los cortes y el filtro «Prueba» (AC-01..AC-05, cifras y título al pasar el ratón)', async ({ page }) => {
    expect(String(uno(`select estado from vacante where id = ${vacante}`).estado)).toBe('CERRADA')
    // Lo que manda el backend, por fila
    const filas = await ranking()
    const estadoPrueba = (c: Candidata) => filas.find((f) => f.postulacionId === c.postulacion)?.estadoPrueba
    expect(estadoPrueba(quien.ana)).toBe('CALIFICADA')
    for (const c of [quien.beto, quien.carla, quien.dani, quien.gabi]) expect(estadoPrueba(c), nombre(c)).toBe('NO_COMPLETADA')
    expect(estadoPrueba(quien.eva)).toBe('EN_CURSO')
    expect(estadoPrueba(quien.fede)).toBe('SIN_EMPEZAR')
    expect(filas).toHaveLength(7)
    expect(filas.find((f) => f.postulacionId === quien.beto.postulacion).detallePrueba.queFalto).toBe('le faltaron 2 preguntas')
    expect(filas.find((f) => f.postulacionId === quien.dani.postulacion).detallePrueba.abiertaEn).toBeNull()
    // La lista aparte y su endpoint ya no existen
    expect((await pedir(`/panel/vacantes/${vacante}/prueba-propia/no-completaron`, equipo)).estado).not.toBe(200)

    await entrarAlPanelCon(page, equipo)

    // «Le toca al candidato»: Eva y Fede; ni rastro de quien no la completó, tampoco con el filtro
    await abrirLaPrueba(page, 'Le toca al candidato')
    expect((await nombresVisibles(page)).sort()).toEqual([nombre(quien.eva), nombre(quien.fede)].sort())
    await abrirFiltros(page)
    expect(await cifrasDeLaSeccion(page)).toEqual({
      Calificada: '0', 'Pendiente de calificación': '0', 'No la completó': '0', 'En curso': '1', 'Sin empezar': '1',
    })
    await cerrarFiltros(page)
    await marcarNoLaCompleto(page)
    await expect(filasDelRanking(page)).toHaveCount(0)
    await expect(corte(page, 'Le toca al candidato')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^Prueba: No la completó/ })).toBeVisible()

    // «Pendiente»: Ana; el filtro, conservado, no devuelve a nadie ni cambia el corte
    await corte(page, 'Pendiente').click()
    await expect(corte(page, 'Pendiente')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(0)
    await page.getByRole('button', { name: /^Prueba: No la completó/ }).click()
    await expect(page.getByRole('button', { name: /^Prueba: / })).toHaveCount(0)
    expect(await nombresVisibles(page)).toEqual([nombre(quien.ana)])
    await abrirFiltros(page)
    // La sección va antes de «Ciudad»
    const leyendas = (await panelFiltros(page).locator('legend').allTextContents()).map((t) => t.trim())
    const enPrueba = leyendas.findIndex((t) => /^Prueba/.test(t))
    const enCiudad = leyendas.findIndex((t) => /^Ciudad/.test(t))
    expect(enPrueba, leyendas.join(' | ')).toBeGreaterThanOrEqual(0)
    expect(enPrueba).toBeLessThan(enCiudad)
    expect(await cifrasDeLaSeccion(page)).toEqual({
      Calificada: '1', 'Pendiente de calificación': '0', 'No la completó': '0', 'En curso': '0', 'Sin empezar': '0',
    })
    await cerrarFiltros(page)

    // «Toda la tanda»: las siete, con sus cifras, y el filtro aísla a las cuatro que no la completaron
    await corte(page, 'Toda la tanda').click()
    await expect(filasDelRanking(page)).toHaveCount(7)
    await abrirFiltros(page)
    expect(await cifrasDeLaSeccion(page)).toEqual({
      Calificada: '1', 'Pendiente de calificación': '0', 'No la completó': '4', 'En curso': '1', 'Sin empezar': '1',
    })
    await cerrarFiltros(page)
    await expect(page.locator('main')).toContainText('4 no la completaron')
    await expect(page.locator('main')).not.toContainText('Prueba incompleta')
    await expect(page.locator('details').filter({ hasText: 'No completaron la prueba' })).toHaveCount(0)
    await marcarNoLaCompleto(page)
    expect((await nombresVisibles(page)).sort()).toEqual(
      [quien.beto, quien.carla, quien.dani, quien.gabi].map(nombre).sort(),
    )
    const etiqueta = page.getByRole('button', { name: /^Prueba: No la completó/ })
    await expect(etiqueta).toBeVisible()
    await expect(etiqueta).toContainText('×')
    await expect(page.getByText(/Se ven 4 de 7/)).toBeVisible()
    // La celda de la Nota y lo que dice al pasar el ratón
    const celdaDe = (c: Candidata) =>
      filasDelRanking(page).filter({ hasText: nombre(c) }).locator('[title]').filter({ hasText: 'No la completó' })
    await expect(celdaDe(quien.beto)).toHaveAttribute('title', /^Se le acabó el tiempo el \d{1,2} \S+: le faltaron 2 preguntas$/)
    await expect(celdaDe(quien.dani)).toHaveAttribute('title', /^Se le acabó el tiempo el \d{1,2} \S+ sin abrirla$/)
    // «Borrar filtros» la quita
    await page.getByRole('button', { name: 'Borrar filtros' }).first().click()
    await expect(filasDelRanking(page)).toHaveCount(7)

    // En «Perfil integral» la sección no sale
    await page.getByRole('tab', { name: /^Perfil integral/ }).click()
    await abrirFiltros(page)
    await expect(panelFiltros(page).locator('legend', { hasText: /^Ciudad/ })).toBeVisible()
    await expect(seccionPrueba(page)).toHaveCount(0)
    await cerrarFiltros(page)
  })

  test('«Abrir ficha» del visor de informes la abre en «Toda la tanda» (AC-19), con su informe «No la completó» disponible', async ({ page }) => {
    expect(estadoDe(quien.carla.postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')
    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${vacante}/informes?postulante=${quien.carla.postulacion}&etapa=prueba`)
    await expect(page.getByRole('heading', { level: 2, name: nombre(quien.carla) })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: /Abrir la ficha para ajustar/ }).click()
    await expect(page).toHaveURL(new RegExp(`etapa=PRUEBA_PUESTO&postulante=${quien.carla.postulacion}`))
    const ficha = page.locator(`#ficha-${quien.carla.postulacion}`)
    await expect(ficha).toBeVisible({ timeout: 20_000 })
    await expect(corte(page, 'Toda la tanda')).toHaveAttribute('aria-pressed', 'true')
    await expect(ficha.getByText(/^No la completó · se le acabó el tiempo el/)).toBeVisible()
    await expect(ficha.getByRole('group', { name: 'Informes en PDF' })
      .getByRole('button', { name: 'Descargar el informe de la prueba' })).toBeEnabled()
  })

  test('la ventana «Darle más tiempo» en 390×844: ocupa la pantalla, apila los botones y deja ver su título y su «×» (AC-14)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await entrarAlPanelCon(page, equipo)
    await abrirLaPrueba(page, 'Toda la tanda')
    const ficha = await abrirFicha(page, quien.carla)
    await ficha.getByRole('button', { name: 'Darle más tiempo' }).click()
    const ventana = page.getByRole('dialog', { name: `Darle más tiempo a ${nombre(quien.carla)}` })
    await expect(ventana).toBeVisible()
    await page.waitForTimeout(400)
    const caja = (await ventana.boundingBox())!
    expect(caja.width).toBeGreaterThanOrEqual(389)
    expect(caja.height).toBeGreaterThanOrEqual(843)
    const dar = (await ventana.getByRole('button', { name: 'Darle más tiempo' }).boundingBox())!
    const cancelar = (await ventana.getByRole('button', { name: 'Cancelar' }).boundingBox())!
    expect(Math.abs(dar.x - cancelar.x)).toBeLessThan(2)
    expect(Math.abs(dar.y - cancelar.y)).toBeGreaterThan(dar.height - 1)
    // Lo que hay arriba de la ventana —su título y la «×»— no lo tapa la cabecera del panel:
    // un toque en la «×» cierra la ventana, no pulsa «Salir».
    const quienEstaEn = async (l: Locator) => {
      const b = (await l.boundingBox())!
      return ventana.evaluate((v, [x, y]) => v.contains(document.elementFromPoint(x!, y!)), [b.x + b.width / 2, b.y + b.height / 2])
    }
    expect.soft(await quienEstaEn(ventana.getByRole('heading').first()), 'el título de la ventana queda debajo de la cabecera').toBe(true)
    expect.soft(await quienEstaEn(ventana.getByRole('button', { name: /cerrar/i }).first()), 'la «×» queda debajo de «Salir»').toBe(true)
    await ventana.getByRole('button', { name: 'Cancelar' }).click()
    await expect(ventana).toHaveCount(0)
    expect(intento(quien.carla).no_completada).toBe(true)
  })

  test('«Avanzar» en lote no mueve a quien no la completó, y por la API tampoco (AC-06)', async ({ page }) => {
    const antesAna = estadoDe(quien.ana.postulacion)
    expect(antesAna).toBe('PRUEBA_POR_CONFIRMAR')
    await entrarAlPanelCon(page, equipo)
    await abrirLaPrueba(page, 'Toda la tanda')
    for (const c of [quien.ana, quien.beto]) {
      await page.getByRole('checkbox', { name: `Avanza ${nombre(c)}`, exact: true }).check()
    }
    const barra = page.getByRole('group', { name: 'Lo marcado' })
    await barra.getByLabel('Motivo (obligatorio)').fill('QA-MT-0089: avanzar en lote')
    await barra.getByRole('button', { name: 'Avanzar a 2 personas' }).click()
    const resultado = page.locator('[role="status"]').filter({ hasText: /No avanzaron:/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    // A Ana sí la avanza; Beto queda en «No avanzaron» con el porqué
    await expect(resultado).toHaveText(
      `Avanzaron: ${nombre(quien.ana)}. No avanzaron: ${nombre(quien.beto)} (no completó la prueba).`,
    )
    await expect.poll(() => estadoDe(quien.ana.postulacion), { timeout: 20_000 }).not.toBe(antesAna)
    expect(estadoDe(quien.beto.postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')
    const directa = await pedir(`/panel/postulaciones/${quien.beto.postulacion}/confirmacion-avance`, equipo, 'POST',
      { motivo: 'QA-MT-0089: por la API' })
    expect(directa.estado).toBe(409)
    expect(JSON.stringify(directa.cuerpo)).toContain('No completó la prueba')
    expect(estadoDe(quien.beto.postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')
  })

  test('el Excel de «Toda la tanda» lleva a quienes no la completaron, con la nota en blanco (AC-12)', async () => {
    const filas = await ranking()
    const sinCompletar = filas.filter((f) => f.estadoPrueba === 'NO_COMPLETADA')
    expect(sinCompletar.length).toBeGreaterThanOrEqual(2)
    const ruta = test.info().outputPath('ranking-prueba-v89.xlsx')
    writeFileSync(ruta, await excelPorLaApi(vacante, 'PRUEBA_PUESTO', filas.map((f) => f.postulacionId)))
    const libro = leerElLibro(ruta)
    const nota = libro.cabeceras.indexOf('Nota Examen Técnico /100')
    const candidato = libro.cabeceras.indexOf('Candidato')
    expect(nota, libro.cabeceras.join(' | ')).toBeGreaterThanOrEqual(0)
    expect(libro.filas).toHaveLength(filas.length)
    for (const f of sinCompletar) {
      const suya = libro.filas.find((l) => l[candidato] === f.candidato)
      expect(suya, `${f.candidato} no está en el Excel`).toBeTruthy()
      expect.soft(suya![nota], `${f.candidato}: su nota tendría que ir en blanco y dice «${suya![nota]}»`).toBe('')
    }
    expect(libro.pie.join(' ')).not.toContain('no son de esta vacante')
  })

  test('«Darle más tiempo» en la vacante cerrada: valida, guarda, avisa, sale del filtro y el portal sigue hasta calificarse (AC-07, AC-08, AC-09, AC-15, AC-16)', async ({ page }) => {
    test.setTimeout(120_000)
    const beto = quien.beto
    const antes = intento(beto)
    expect(antes.no_completada).toBe(true)
    await entrarAlPanelCon(page, equipo)
    await abrirLaPrueba(page, 'Toda la tanda')
    await marcarNoLaCompleto(page)
    const ficha = await abrirFicha(page, beto)

    // La ficha habitual: arriba lo que pasó, sus respuestas debajo, su informe y sin «El plazo de esta persona» (AC-15)
    await expect(ficha.getByText(/^No la completó · se le acabó el tiempo el \d{1,2} \S+, \d{1,2}:\d{2}/)).toBeVisible()
    await expect(ficha.getByText('Le faltaron 2 preguntas', { exact: true })).toBeVisible()
    await expect(ficha).not.toContainText('No tiene nota ni sale en el ranking')
    await expect(ficha).not.toContainText('El plazo ya no cambia')
    await expect(ficha).toContainText(Q1)
    await expect(ficha.getByText('Sin responder.').first()).toBeVisible()
    const informes = ficha.getByRole('group', { name: 'Informes en PDF' })
    await expect(informes.getByRole('button', { name: 'Descargar el informe de la prueba' })).toBeEnabled()

    // La ventana, vacía y con «Avisar» marcada
    await ficha.getByRole('button', { name: 'Darle más tiempo' }).click()
    const ventana = page.getByRole('dialog', { name: `Darle más tiempo a ${nombre(beto)}` })
    await expect(ventana).toBeVisible()
    await expect(ventana.getByLabel('Hasta')).toHaveValue('')
    await expect(ventana.getByLabel('Motivo')).toHaveValue('')
    await expect(ventana.getByRole('checkbox', { name: 'Avisar a Beto' })).toBeChecked()
    await expect(ventana.getByRole('button', { name: 'Cancelar' })).toBeVisible()

    // Sin fecha ni motivo, y con fecha pasada: dice por qué y no guarda (AC-11)
    await ventana.getByRole('button', { name: 'Darle más tiempo' }).click()
    await expect(ventana).toContainText('Elige hasta qué día y hora tiene.')
    await expect(ventana).toContainText('Escribe por qué se le da más tiempo.')
    await ventana.getByLabel('Hasta').fill(enLimaDentroDeHoras(-2))
    await ventana.getByLabel('Motivo').fill('QA-MT-0089: se le cortó la luz a mitad de la prueba')
    await ventana.getByRole('button', { name: 'Darle más tiempo' }).click()
    await expect(ventana).toContainText('Esa fecha ya pasó: elige una futura.')
    expect(intento(beto).no_completada).toBe(true)

    // Con fecha futura y motivo
    const hasta = enLimaDentroDeHoras(48)
    await ventana.getByLabel('Hasta').fill(hasta)
    await ventana.getByRole('button', { name: 'Darle más tiempo' }).click()
    await expect(ventana).toHaveCount(0, { timeout: 20_000 })
    // Con el filtro «No la completó» puesto, su fila deja de verse sin recargar (AC-07)
    await expect(filasDelRanking(page).filter({ hasText: nombre(beto) })).toHaveCount(0, { timeout: 20_000 })
    await expect(filasDelRanking(page)).toHaveCount(3)

    const despues = intento(beto)
    expect(despues).toMatchObject({ no_completada: false, abierta: true, plazo_propio: true,
      mas_tiempo_motivo: 'QA-MT-0089: se le cortó la luz a mitad de la prueba' })
    expect(Date.parse(String(despues.vence_en))).toBe(instanteDeLima(hasta))
    const auditoria = uno(`select valor_anterior->>'venceEn' as antes, valor_nuevo->>'venceEn' as nueva, motivo
                             from auditoria where accion = 'dar_mas_tiempo_prueba' and entidad_id =
                                  (select id from intento_prueba where postulacion_id = ${beto.postulacion})`)
    expect(Date.parse(String(auditoria.antes))).toBe(Date.parse(String(antes.vence_en)))
    expect(Date.parse(String(auditoria.nueva))).toBe(instanteDeLima(hasta))
    expect(auditoria.motivo).toBe('QA-MT-0089: se le cortó la luz a mitad de la prueba')
    // El correo, sin enlace con token, y la campana (AC-08)
    const correo = uno(`select asunto, cuerpo from correo_enviado where plantilla_correo_codigo = 'PRUEBA_MAS_TIEMPO'
                          and usuario_id = ${beto.usuario}`)
    expect(String(correo.cuerpo)).toContain('Tienes más tiempo para la prueba de')
    expect(String(correo.cuerpo)).toContain('(hora de Lima)')
    expect(String(correo.cuerpo)).not.toContain('token=')
    expect(contar(`select 1 from aviso_portal where tipo = 'PRUEBA_MAS_TIEMPO' and postulacion_id = ${beto.postulacion}`)).toBe(1)
    expect(estadoDe(beto.postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect((await filaDe(beto)).estadoPrueba).toBe('EN_CURSO')

    // Sin el filtro vuelve a verse: la ficha cuenta quién y por qué; el informe pasa a «sin calificar» (AC-16)
    await page.getByRole('button', { name: 'Borrar filtros' }).first().click()
    await expect(filasDelRanking(page).filter({ hasText: nombre(beto) })).toContainText('En curso')
    await abrirFicha(page, beto)
    await expect(ficha.getByText(/^En curso · le cierra el /)).toBeVisible({ timeout: 20_000 })
    await expect(ficha).toContainText(/Más tiempo dado el \d{1,2} \S+ por .+: QA-MT-0089: se le cortó la luz/)
    await expect(informes.getByRole('button', { name: /^El informe de la prueba no está disponible/ }))
      .toHaveAttribute('title', 'Todavía no tiene calificación', { timeout: 20_000 })

    // Un segundo envío ya no la encuentra sin completar y no repite los avisos
    const segundo = await pedir(`/panel/postulaciones/${beto.postulacion}/prueba/mas-tiempo`, equipo, 'POST', {
      venceEn: new Date(instanteDeLima(hasta)).toISOString(), motivo: 'QA-MT-0089: otra vez', avisar: true,
    })
    expect(segundo.estado).toBe(409)
    expect(contar(`select 1 from aviso_portal where tipo = 'PRUEBA_MAS_TIEMPO' and postulacion_id = ${beto.postulacion}`)).toBe(1)

    // En «Le toca al candidato» vuelve, con «En curso»
    await corte(page, 'Le toca al candidato').click()
    await expect(filasDelRanking(page).filter({ hasText: nombre(beto) })).toContainText('En curso')

    // El portal: sin «Tu tiempo terminó», con lo que había respondido y el reloj hasta la fecha nueva
    await entrarAlPortalCon(page, beto.token)
    await page.goto(`/procesos/${beto.uuid}/prueba`)
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /Tu tiempo terminó/ })).toHaveCount(0)
    await expect(page.locator('main').getByRole('button', { name: 'Pregunta 1, lista' })).toBeVisible()
    const vista = (await verLaPrueba(beto)).cuerpo
    expect(vista.estadoIntento).toBe('EN_CURSO')
    expect(Date.parse(vista.venceEn)).toBe(instanteDeLima(hasta))
    const proceso = await exigir<any>(`/portal/postulaciones/${beto.uuid}`, beto.token)
    expect(proceso.resumen.pruebaSinCompletar).toBe(false)

    // Completa y entrega: se califica como cualquier otra (AC-09) y su informe vuelve (AC-16)
    await responder(beto, { q2: true, q3: true })
    expect((await entregarLaPrueba(beto)).estado).toBe(200)
    expect(estadoDe(beto.postulacion)).toBe('PRUEBA_POR_CONFIRMAR')
    expect(notaDeLaEtapa(beto.postulacion)).toBe(100)
    const suyos = await exigir<any>(`/panel/postulaciones/${beto.postulacion}/informes`, equipo)
    expect(suyos.informes.find((i: any) => i.etapa === 'PRUEBA').disponible).toBe(true)
  })

  test('quien no la abrió: más tiempo sin avisar, nada antes de «Empezar», la abre sin pasar de la fecha nueva y la entrega (AC-08, AC-10, AC-17)', async ({ page }) => {
    const dani = quien.dani
    expect((await filaDe(dani)).estadoPrueba).toBe('NO_COMPLETADA')
    await entrarAlPanelCon(page, equipo)
    await abrirLaPrueba(page, 'Toda la tanda')
    const ficha = await abrirFicha(page, dani)
    await expect(ficha.getByText('No la abrió', { exact: true })).toBeVisible()
    await ficha.getByRole('button', { name: 'Darle más tiempo' }).click()
    const ventana = page.getByRole('dialog', { name: `Darle más tiempo a ${nombre(dani)}` })
    const hasta = enLimaDentroDeHoras(72)
    await ventana.getByLabel('Hasta').fill(hasta)
    await ventana.getByLabel('Motivo').fill('QA-MT-0089: no le llegó el correo')
    await ventana.getByRole('checkbox', { name: 'Avisar a Dani' }).uncheck()
    await ventana.getByRole('button', { name: 'Darle más tiempo' }).click()
    await expect(page.getByText('Sin avisarle')).toBeVisible({ timeout: 20_000 })
    await expect(ficha.getByText(/^Sin empezar · le cierra el /)).toBeVisible({ timeout: 20_000 })
    await expect(filasDelRanking(page).filter({ hasText: nombre(dani) })).toContainText('Sin empezar')
    // Sin avisar: nada por ningún canal (AC-08)
    expect(contar(`select 1 from correo_enviado where plantilla_correo_codigo = 'PRUEBA_MAS_TIEMPO' and usuario_id = ${dani.usuario}`)).toBe(0)
    expect(contar(`select 1 from aviso_portal where tipo = 'PRUEBA_MAS_TIEMPO' and postulacion_id = ${dani.postulacion}`)).toBe(0)
    expect(contar(`select 1 from aviso_whatsapp where intento_prueba_id =
                     (select id from intento_prueba where postulacion_id = ${dani.postulacion})`)).toBe(0)
    expect((await filaDe(dani)).estadoPrueba).toBe('SIN_EMPEZAR')

    // Antes de «Empezar», ni el caso ni las preguntas (AC-17)
    const antes = await verLaPrueba(dani)
    expect(antes.cuerpo.estadoIntento).toBe('PENDIENTE')
    expect(antes.cuerpo.preguntas ?? []).toHaveLength(0)
    const crudo = JSON.stringify(antes.cuerpo)
    for (const secreto of [CASO, Q1, Q2, Q3, 'El arqueo']) expect(crudo).not.toContain(secreto)
    await entrarAlPortalCon(page, dani.token)
    await page.goto(`/procesos/${dani.uuid}/prueba`)
    await expect(page.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('main')).not.toContainText(CASO)
    await expect(page.getByRole('heading', { name: /Tu tiempo terminó/ })).toHaveCount(0)

    // La abre: su reloj no pasa de la fecha nueva (AC-10)
    const inicio = Date.now()
    const empezada = await iniciarLaPrueba(dani)
    expect(empezada.estado).toBe(200)
    const venceEn = Date.parse(String(intento(dani).vence_en))
    expect(venceEn).toBeLessThanOrEqual(instanteDeLima(hasta))
    // Punto 11 de la spec: «su reloj arranca cuando la abra, sin pasarse de la fecha nueva». La
    // pantalla previa le promete «30 min desde que pulses Empezar»: con la fecha nueva a 72 h,
    // la prueba cronometrada tiene que vencer a los 30 min de empezar, no en la fecha nueva.
    expect.soft(venceEn, 'el reloj de una cronometrada arranca al abrirla: vence a los minutos de la prueba')
      .toBeLessThanOrEqual(Date.now() + MINUTOS * 60_000 + 60_000)
    test.info().annotations.push({
      type: 'reloj tras reabrir sin abrir',
      description: `cronometrada de ${MINUTOS} min; vence ${Math.round((venceEn - inicio) / 60_000)} min después de empezar (fecha nueva a ${Math.round((instanteDeLima(hasta) - inicio) / 60_000)} min)`,
    })
    await responder(dani, { q1: true, q2: true, q3: true })
    expect((await entregarLaPrueba(dani)).estado).toBe(200)
    expect(estadoDe(dani.postulacion)).toBe('PRUEBA_POR_CONFIRMAR')
  })

  test('los rechazos: sin permiso, vacante archivada, sin motivo, fecha pasada y proceso cerrado; «Descartar…» en lote desde el filtro (AC-11, AC-13)', async ({ page }) => {
    const carla = quien.carla
    const ruta = `/panel/postulaciones/${carla.postulacion}/prueba/mas-tiempo`
    const futura = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect((await filaDe(carla)).estadoPrueba).toBe('NO_COMPLETADA')

    // Sin `mover_postulacion`: ve la tabla, el filtro y la ficha, pero no el botón; la API, 403
    const tokenSinMover = await tokenDePanel(sinMover)
    expect((await pedir(ruta, tokenSinMover, 'POST', { venceEn: futura, motivo: 'QA-MT-0089: sin permiso' })).estado).toBe(403)
    await entrarAlPanelCon(page, tokenSinMover)
    await abrirLaPrueba(page, 'Toda la tanda')
    await marcarNoLaCompleto(page)
    let ficha = await abrirFicha(page, carla)
    await expect(ficha.getByText(/^No la completó · se le acabó el tiempo el/)).toBeVisible()
    await expect(ficha.getByRole('button', { name: 'Darle más tiempo' })).toHaveCount(0)

    // Sin motivo y con fecha pasada, la API no guarda (400)
    expect((await pedir(ruta, equipo, 'POST', { venceEn: futura, motivo: '   ' })).estado).toBe(400)
    expect((await pedir(ruta, equipo, 'POST', {
      venceEn: new Date(Date.now() - 3_600_000).toISOString(), motivo: 'QA-MT-0089: pasada',
    })).estado).toBe(400)
    expect(intento(carla).no_completada).toBe(true)

    // Vacante archivada: botón apagado con su chip y 409, también en «El plazo de esta persona»
    sql(`update vacante set archivada_en = now() where id = ${vacante};`)
    try {
      const archivada = await pedir(ruta, equipo, 'POST', { venceEn: futura, motivo: 'QA-MT-0089: archivada' })
      expect(archivada.estado).toBe(409)
      expect(JSON.stringify(archivada.cuerpo)).toContain('La vacante está archivada: desarchívala para darle más tiempo')
      expect((await pedir(`/panel/postulaciones/${quien.eva.postulacion}/prueba/plazo`, equipo, 'POST', {
        venceEn: futura, motivo: 'QA-MT-0089: plazo con la vacante archivada',
      })).estado).toBe(409)
      const otra = await page.context().newPage()
      await entrarAlPanelCon(otra, equipo)
      await otra.goto(`/admin/vacantes/${vacante}?etapa=PRUEBA_PUESTO&postulante=${carla.postulacion}`)
      const fichaArchivada = otra.locator(`#ficha-${carla.postulacion}`)
      await expect(fichaArchivada).toBeVisible({ timeout: 20_000 })
      await expect(fichaArchivada.getByRole('button', { name: 'Darle más tiempo' })).toBeDisabled()
      await expect(fichaArchivada.getByText('Vacante archivada', { exact: true })).toBeVisible()
      await otra.close()
    } finally {
      sql(`update vacante set archivada_en = null where id = ${vacante};`)
    }
    expect(intento(carla).no_completada).toBe(true)

    // «Descartar…» en lote desde «Toda la tanda» con el filtro: cierra a las abiertas; las cerradas, igual
    await page.close()
    const pagina = await page.context().newPage()
    await entrarAlPanelCon(pagina, equipo)
    await abrirLaPrueba(pagina, 'Toda la tanda')
    await marcarNoLaCompleto(pagina)
    const visibles = await nombresVisibles(pagina)
    expect(visibles).toContain(nombre(carla))
    expect(visibles).toContain(nombre(quien.gabi))
    const transicionesDeGabi = contar(`select 1 from transicion_estado where postulacion_id = ${quien.gabi.postulacion}`)
    await pagina.getByRole('checkbox', { name: 'Marcar todas las que se ven' }).check()
    const barra = pagina.getByRole('group', { name: 'Lo marcado' })
    await barra.getByLabel('Motivo (obligatorio)').fill('QA-MT-0089: no completó la prueba')
    await barra.getByRole('button', { name: 'Descartar…' }).click()
    const ventana = pagina.getByRole('dialog', { name: /^Descartar a \d+ persona/ })
    await expect(ventana).toContainText(nombre(carla))
    await ventana.getByRole('checkbox').uncheck()
    await ventana.getByRole('button', { name: /sin avisar$/ }).click()
    await expect.poll(() => estadoDe(carla.postulacion), { timeout: 20_000 }).toBe('NO_CONTINUA')
    expect(estadoDe(quien.gabi.postulacion)).toBe('NO_CONTINUA')
    expect(contar(`select 1 from transicion_estado where postulacion_id = ${quien.gabi.postulacion}`)).toBe(transicionesDeGabi)

    // Con el proceso cerrado: sigue en «Toda la tanda», botón apagado con «Proceso cerrado» y 409
    await pagina.reload()
    await abrirLaPrueba(pagina, 'Toda la tanda')
    ficha = await abrirFicha(pagina, carla)
    await expect(ficha.getByRole('button', { name: 'Darle más tiempo' })).toBeDisabled()
    await expect(ficha.getByText('Proceso cerrado', { exact: true })).toBeVisible()
    const cerrado = await pedir(ruta, equipo, 'POST', { venceEn: futura, motivo: 'QA-MT-0089: cerrado' })
    expect(cerrado.estado).toBe(409)
    expect(intento(carla).no_completada).toBe(true)
    expect((await filaDe(carla)).estadoPrueba).toBe('NO_COMPLETADA')
  })
})

/**
 * Punto 16 de la spec: con la prueba «Sin empezar» o «En curso» y el plazo vigente se sigue
 * usando «El plazo de esta persona», sin cambios. Su regla (V32) es que empezar no toca la
 * fecha concedida a mano, ni para acercarla con el cronómetro. La corrección de F-3 hace que
 * la fecha de «Darle más tiempo» sea solo un tope: aquí se comprueba que eso no se lleva por
 * delante un «El plazo de esta persona» puesto después a la misma persona.
 */
test.describe('QA V89 · «El plazo de esta persona» tras «Darle más tiempo» (punto 16)', () => {
  let equipoPlazo = ''
  let vacantePlazo = 0

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    equipoPlazo = await tokenDePanel()
    vacantePlazo = await vacanteConPrueba(equipoPlazo, 'Cajera del plazo a mano')
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('a quien no la abrió y recibió más tiempo, «El plazo de esta persona» le fija una fecha que empezar no toca, como a cualquiera', async () => {
    const hugo = await candidata(equipoPlazo, vacantePlazo, 'Hugo', correos)
    const iris = await candidata(equipoPlazo, vacantePlazo, 'Iris', correos)
    // Hugo nunca la abrió y su fecha pasó: «No la completó». Se le da más tiempo, sin avisar.
    sql(`update intento_prueba set vence_en = now() - interval '3 hours'
          where postulacion_id = ${hugo.postulacion};`)
    await exigir(`/panel/postulaciones/${hugo.postulacion}/prueba/mas-tiempo`, equipoPlazo, 'POST', {
      venceEn: new Date(Date.now() + 24 * 3_600_000).toISOString(), motivo: 'QA-MT-0089: más tiempo', avisar: false,
    })
    expect((await exigir<any>(`/panel/vacantes/${vacantePlazo}/ranking?etapa=PRUEBA_PUESTO`, equipoPlazo))
      .filas.find((f: any) => f.postulacionId === hugo.postulacion).estadoPrueba).toBe('SIN_EMPEZAR')

    // Con la prueba «Sin empezar» y el plazo vigente, «El plazo de esta persona» a 48 h para los
    // dos: Iris no recibió más tiempo y es la referencia de cómo se ha comportado siempre.
    const plazo = new Date(Math.floor((Date.now() + 48 * 3_600_000) / 60_000) * 60_000).toISOString()
    for (const c of [iris, hugo]) {
      await exigir(`/panel/postulaciones/${c.postulacion}/prueba/plazo`, equipoPlazo, 'POST', {
        venceEn: plazo, motivo: 'QA-MT-0089: plazo a mano',
      })
      expect(intento(c).plazo_propio).toBe(true)
    }
    for (const c of [iris, hugo]) expect((await iniciarLaPrueba(c)).estado).toBe(200)

    // Iris: empezar no toca la fecha concedida a mano (V32), aunque la prueba sea de 30 min.
    expect(Date.parse(String(intento(iris).vence_en))).toBe(Date.parse(plazo))
    // Hugo: «sin cambios» (punto 16), la misma fecha.
    const deHugo = Date.parse(String(intento(hugo).vence_en))
    expect(deHugo, `«El plazo de esta persona» puesto tras el más tiempo vence ${Math.round((deHugo - Date.now()) / 60_000)} min después de empezar, no en la fecha concedida`)
      .toBe(Date.parse(plazo))
  })
})

/**
 * Revisión humana del 18/11/2026: la pantalla previa del portal decía «30 min desde que pulses
 * Empezar» también a quien tiene su fecha puesta a mano («El plazo de esta persona»), aunque al
 * empezar su reloj llega hasta esa fecha. Se comprueba, en el portal de verdad, lo que dice la
 * previa en los cuatro casos y que al empezar pasa lo que dijo:
 *
 *   Kiko · «El plazo de esta persona» a 48 h, sin más tiempo        → hasta la fecha límite.
 *   Lola · nunca la abrió, más tiempo y DESPUÉS el plazo a mano   → hasta la fecha límite.
 *   Mia  · nunca la abrió y recibió más tiempo (72 h)             → 30 min, la fecha de tope.
 *   Nico · sin fecha propia (la de la vacante, a 20 días)          → 30 min, la fecha de tope.
 *
 * Y que antes de «Sí, empezar» nada de la prueba viaja al navegador (AC-17).
 */
test.describe('QA V89 · la pantalla previa del portal dice cómo correrá el tiempo (revisión del 18/11)', () => {
  type Caso = 'kiko' | 'lola' | 'mia' | 'nico'
  const caso = {} as Record<Caso, Candidata>
  let equipoPrevia = ''
  let plazo = ''
  let masTiempo = ''

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    equipoPrevia = await tokenDePanel()
    const vacantePrevia = await vacanteConPrueba(equipoPrevia, 'Cajera de la pantalla previa')
    for (const [k, n] of [['kiko', 'Kiko'], ['lola', 'Lola'], ['mia', 'Mia'], ['nico', 'Nico']] as const) {
      caso[k] = await candidata(equipoPrevia, vacantePrevia, n, correos)
    }
    // Lola y Mia nunca la abrieron y su fecha pasó: se les da más tiempo, sin avisar.
    sql(`update intento_prueba set vence_en = now() - interval '3 hours'
          where postulacion_id in (${caso.lola.postulacion}, ${caso.mia.postulacion});`)
    masTiempo = new Date(Math.floor((Date.now() + 72 * 3_600_000) / 60_000) * 60_000).toISOString()
    for (const c of [caso.lola, caso.mia]) {
      await exigir(`/panel/postulaciones/${c.postulacion}/prueba/mas-tiempo`, equipoPrevia, 'POST', {
        venceEn: masTiempo, motivo: 'QA-MT-0089: no le llegó el correo', avisar: false,
      })
    }
    // Después, «El plazo de esta persona» a 48 h para Kiko (sin más tiempo) y para Lola.
    plazo = new Date(Math.floor((Date.now() + 48 * 3_600_000) / 60_000) * 60_000).toISOString()
    for (const c of [caso.kiko, caso.lola]) {
      await exigir(`/panel/postulaciones/${c.postulacion}/prueba/plazo`, equipoPrevia, 'POST', {
        venceEn: plazo, motivo: 'QA-MT-0089: plazo a mano',
      })
    }
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  const celda = (page: Page, etiqueta: string): Locator =>
    page.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${etiqueta}$`) }) })

  /** Entra a la previa y guarda lo que el servidor le manda al navegador antes de empezar. */
  async function entrarALaPrevia(page: Page, c: Candidata): Promise<string[]> {
    const recibido: string[] = []
    page.on('response', async (r) => {
      if (r.url().includes(`/portal/prueba/${c.uuid}`)) recibido.push(await r.text().catch(() => ''))
    })
    await entrarAlPortalCon(page, c.token)
    await page.goto(`/procesos/${c.uuid}/prueba`)
    await expect(page.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })
    return recibido
  }

  function nadaDeLaPrueba(recibido: string[], page: Page) {
    expect(recibido.length, 'el navegador pidió la prueba').toBeGreaterThan(0)
    const crudo = recibido.join('\n')
    for (const secreto of [CASO, Q1, Q2, Q3, 'El arqueo', 'BUSCARV']) expect(crudo).not.toContain(secreto)
    return expect(page.locator('main')).not.toContainText(CASO)
  }

  test('lo que viaja antes de «Empezar»: la marca de fecha a mano solo con «El plazo de esta persona», y nada de la prueba (AC-17)', async () => {
    const esperado: Record<Caso, { aMano: boolean; fecha: string | null }> = {
      kiko: { aMano: true, fecha: plazo },
      lola: { aMano: true, fecha: plazo },
      mia: { aMano: false, fecha: masTiempo },
      nico: { aMano: false, fecha: null },
    }
    for (const k of Object.keys(esperado) as Caso[]) {
      const { cuerpo } = await verLaPrueba(caso[k])
      expect(cuerpo.estadoIntento, k).toBe('PENDIENTE')
      expect(cuerpo.fechaConcedidaAMano, k).toBe(esperado[k].aMano)
      expect(cuerpo.duracionMinutos, k).toBe(MINUTOS)
      expect(cuerpo.totalPreguntas, k).toBe(3)
      expect(cuerpo.preguntas ?? [], k).toHaveLength(0)
      if (esperado[k].fecha) expect(Date.parse(cuerpo.fechaLimite), k).toBe(Date.parse(esperado[k].fecha!))
      else expect(cuerpo.fechaLimite, `${k}: la de la vacante`).toBeTruthy()
      const crudo = JSON.stringify(cuerpo)
      for (const secreto of [CASO, Q1, Q2, Q3, 'El arqueo']) expect(crudo, k).not.toContain(secreto)
    }
  })

  for (const [k, cuando] of [
    ['kiko', '«El plazo de esta persona» sin más tiempo'],
    ['lola', 'más tiempo y después «El plazo de esta persona»'],
  ] as const) {
    test(`con ${cuando}: la previa dice «Hasta la fecha límite» (hora de Lima), sin minutos ni cronómetro, y al empezar el reloj llega a esa fecha`, async ({ page }) => {
      const c = caso[k]
      const recibido = await entrarALaPrevia(page, c)
      const tiempo = celda(page, 'Tiempo')
      await expect(tiempo).toContainText('Hasta la fecha límite')
      await expect(tiempo).not.toContainText(`${MINUTOS} min`)
      await expect(celda(page, 'Fecha límite')).toContainText('hora de Lima')
      const main = page.locator('main')
      await expect(main).not.toContainText('desde que pulses Empezar')
      await expect(main).not.toContainText('si llega antes')
      await expect(main).toContainText('las preguntas se abren al empezar, y desde ahí tienes hasta la fecha límite.')
      await expect(main).toContainText('si llega la fecha límite con algo pendiente, queda sin completar.')
      await expect(main).not.toContainText('si el tiempo termina')

      await page.getByRole('button', { name: 'Empezar prueba' }).click()
      const dialogo = page.getByRole('dialog', { name: '¿Empezar ahora?' })
      await expect(dialogo).toContainText('Desde ese momento tienes hasta la fecha límite, también para leer')
      await expect(dialogo).not.toContainText('cronómetro')
      await expect(dialogo).not.toContainText('empieza a correr el tiempo')
      await nadaDeLaPrueba(recibido, page)

      await dialogo.getByRole('button', { name: 'Sí, empezar' }).click()
      await expect(page.getByText('Tiempo restante').first()).toBeVisible({ timeout: 20_000 })
      await expect.poll(() => Date.parse(String(intento(c).vence_en)), { timeout: 10_000 }).toBe(Date.parse(plazo))
      // El cronómetro cuenta hasta su fecha (unas 47-48 h), no los 30 min de la prueba.
      await expect(page.getByText(/^4[67]:\d{2}:\d{2}$/)).toBeVisible()
    })
  }

  for (const [k, cuando, fecha] of [
    ['mia', 'más tiempo a quien nunca la abrió', 'la fecha nueva'],
    ['nico', 'la fecha de la vacante (sin fecha propia)', 'la de la vacante'],
  ] as const) {
    test(`con ${cuando}: la previa sigue en «${MINUTOS} min · desde que pulses Empezar · o hasta la fecha límite, si llega antes» y al empezar vence a los ${MINUTOS} min (tope: ${fecha})`, async ({ page }) => {
      const c = caso[k]
      const recibido = await entrarALaPrevia(page, c)
      const tiempo = celda(page, 'Tiempo')
      await expect(tiempo).toContainText(`${MINUTOS} min`)
      await expect(tiempo).toContainText('desde que pulses Empezar')
      await expect(tiempo).toContainText('o hasta la fecha límite, si llega antes')
      await expect(tiempo).not.toContainText('Hasta la fecha límite')
      await expect(celda(page, 'Fecha límite')).toBeVisible()
      await expect(celda(page, 'Fecha límite')).not.toContainText('hora de Lima')
      const main = page.locator('main')
      await expect(main).toContainText('las preguntas se abren al empezar, y desde ahí corre el tiempo.')
      await expect(main).toContainText('si el tiempo termina con algo pendiente, queda sin completar.')

      await page.getByRole('button', { name: 'Empezar prueba' }).click()
      const dialogo = page.getByRole('dialog', { name: '¿Empezar ahora?' })
      await expect(dialogo).toContainText('y empieza a correr el tiempo')
      await expect(dialogo).toContainText('el cronómetro sigue corriendo')
      await nadaDeLaPrueba(recibido, page)

      const inicio = Date.now()
      await dialogo.getByRole('button', { name: 'Sí, empezar' }).click()
      await expect(page.getByText('Tiempo restante').first()).toBeVisible({ timeout: 20_000 })
      await expect.poll(() => String(intento(c).vence_en ?? ''), { timeout: 10_000 }).not.toBe('')
      const vence = Date.parse(String(intento(c).vence_en))
      expect(vence).toBeGreaterThanOrEqual(inicio + (MINUTOS - 1) * 60_000)
      expect(vence).toBeLessThanOrEqual(Date.now() + MINUTOS * 60_000 + 60_000)
      await expect(page.getByText(/^00:(29|30):\d{2}$/)).toBeVisible()
    })
  }
})
