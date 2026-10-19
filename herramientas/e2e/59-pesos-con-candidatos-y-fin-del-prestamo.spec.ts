import { expect, type Page } from '@playwright/test'
import { filasDelRanking, nombresVisibles } from './ayuda'
import { test } from './ayuda-candidato'
import { configuracion, limpiarSiempre, literal, sql } from './base-de-datos'
import {
  apuntarComoSePusieron,
  bancoQueRinde,
  bancosDeRenaser,
  CASO,
  candidatoCalificado,
  comoSePuso,
  consultar,
  crearVersionDePesos,
  cuenta,
  enLaPruebaSinEntregar,
  estadoDe,
  empresaClienta,
  enunciadoGuardado,
  equipoSin,
  exigir,
  fotoDeLasNotas,
  grupoDe,
  idDelCriterio,
  loQueNoSeMueve,
  MARCA,
  notaDe,
  notaDeSimulacion,
  otraPruebaDeRenaser,
  pedir,
  pesosDeRenaser,
  pruebaDeRenaser,
  pruebaPropiaEntregada,
  registrosDelCambio,
  retirarLoSembrado,
  sesionAbierta,
  soloPostula,
  subirEnunciado,
  uno,
  validacionDeAntesDeLaV75,
  vacanteConPreguntasYPrueba,
  vacanteViejaDeLaClienta,
  versionDeLaNota,
  versionDeLaVacante,
  yaDecidido,
  type Candidato,
  type Clienta,
} from './ayuda-pesos-con-candidatos'
import { empezarEvaluacion, entrarAlPanelCon, entrarAlPortalCon, postular, postulacionPorUuid, tokenDePanel } from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  enVeinteDias,
  escribirPrueba,
  fijarFechaLimite,
  lugarDe,
  publicarPrueba,
} from './ayuda-prueba-propia'
import { leerElLibro } from './ayuda-rubrica-vigente'

/**
 * Cambiar los pesos con candidatos dentro y dejar de prestar el banco y las pruebas (V74), los
 * tres recorridos de la Verificación de `specs/pesos-con-candidatos-y-fin-del-prestamo.md`:
 *
 *   1. Cambiar los pesos de la vacante con candidatos, leer la confirmación, confirmar y ver
 *      el ranking (y su Excel) reordenado y a nadie movido de etapa.
 *   2. Como la clienta: la configuración del banco y el desplegable de pruebas de una vacante
 *      vieja sin nada de RENASER; postular a la vacante vieja y rendir la misma versión del
 *      banco que los anteriores.
 *   3. Subir un PDF de enunciado en el editor, copiar esa prueba a otra vacante y abrir el
 *      adjunto desde el panel y, tras pulsar «Empezar», desde el portal en las dos.
 *
 * Y lo que añadió la QA del ciclo 1: el fallo a mitad (AC-07), las respuestas de la vacante
 * sin candidatos, cerrada, archivada, eliminada y sin permiso (AC-06), la prueba de RENASER
 * a medio rendir y los pesos de una clienta sin pesos propios (AC-12, AC-15), y dos
 * regresiones de hallazgos:
 *
 *   - QA-01 (AC-03): volver a los pesos de antes no devuelve la simulación que puso el
 *     facilitador: se redondea (7 → 7,01) y un criterio que pasó por peso 0 se pierde (6 → 0).
 *   - QA-02 (AC-05): una nota que se escribe mientras el cambio está a mitad (la de la IA que
 *     llega, o una puesta a mano) se guarda con la versión de antes y pisa la recalculada.
 *
 * El ciclo 2 añadió la validación a la ida y vuelta de QA-01 (filas de antes de la V75, sin
 * apuntar cómo se pusieron), la nota del facilitador a mitad del cambio (QA-02, escala nueva)
 * y una tercera regresión:
 *
 *   - QA-03 (AC-01, AC-05): la prueba del editor que se cierra a mitad del cambio (la IA que
 *     termina o la nota a mano) queda con la versión de antes en una vacante ya en la nueva.
 *
 * El ciclo 3 añadió dos regresiones con el cambio de pesos REAL (no imitado por SQL directo), porque
 * `Postulacion` se reescribe entera al guardarse:
 *
 *   - QA-04 (AC-01, AC-05): la entrega de la prueba que espera a un cambio de pesos le devuelve
 *     a la persona el grupo de antes, aunque su nota ya diga la versión nueva.
 *   - QA-05 (AC-01, AC-04): el cambio de pesos a mitad devuelve al estado de antes a quien el
 *     equipo movió en ese rato.
 *
 * La IA está apagada en el preview: lo que ella pondría (las notas del currículum de 0 a
 * 100 y el retrato) se siembra como lo deja la cola, y la nota de la abierta la pone una
 * persona desde el panel, que recalcula el Perfil Integral con los pesos de la vacante.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PCP-74).
 */

const correos: string[] = []
let equipo = ''
let antes = { id: 0, etiqueta: '' }
let despues = { id: 0, etiqueta: '' }

/**
 * Los dos repartos de la prueba, para Ejecución. «Gestión de personas» no pesa antes y pesa la
 * mitad después (AC-02); la simulación sube la ejecución y baja la calidad, y deja en 0 la
 * evidencia de aprendizaje; el Perfil Integral pasa de 12/28 a 20/20; la prueba de 30 a 35.
 */
const ANTES = {
  pruebaPuesto: 30, validacion: 15, cv: 12, evaluacion: 28,
  curriculum: { CV_RESULTADOS: 100, CV_PERSONAS: 0 },
  simulacion: { SIM_EJECUCION: 15, SIM_CALIDAD: 15 },
  validacionPorCriterio: { VAL_CALIDAD: 15, VAL_SERVICIO: 5 },
}
const DESPUES = {
  pruebaPuesto: 35, validacion: 10, cv: 20, evaluacion: 20,
  curriculum: { CV_RESULTADOS: 50, CV_PERSONAS: 50 },
  simulacion: { SIM_EJECUCION: 20, SIM_CALIDAD: 10, SIM_APRENDIZAJE: 0 },
  validacionPorCriterio: { VAL_CALIDAD: 10, VAL_SERVICIO: 0, VAL_RESULTADO: 15 },
}
/** Lo que el facilitador puso a la simulación de quien ya está decidida (el resto, 5). */
const SIMULACION = { SIM_EJECUCION: 15, SIM_CALIDAD: 7, SIM_APRENDIZAJE: 6 }
/** 15 + 7 + 6 + 7 × 5 con los pesos de antes; 20 + 4,67 + 0 + 35 con los de después. */
const SIMULACION_ANTES = 63
const SIMULACION_DESPUES = 59.67
/**
 * La validación que puso un facilitador antes de la V75, con los pesos de antes (el resto, 6):
 * 9 + 3 + 6 + 6 × 6 = 54. Con los de después, 6 + 0 + 9 + 36 = 51: la calidad baja a 10, el
 * servicio a 0 y el resultado sube a 15.
 */
const VALIDACION = { VAL_CALIDAD: 9, VAL_SERVICIO: 3, VAL_RESULTADO: 6 }
const VALIDACION_ANTES = 54
const VALIDACION_DESPUES = 51

/**
 * Ana: currículo 40 de resultados y 100 de personas, la abierta 70.
 *   antes  → CV 40 → (40·12 + 70·28) / 40 = 61, no priorizada
 *   después → CV 70 → (70 + 70) / 2      = 70, con riesgo (≥ 65)
 * Beto: 90 y 10, la abierta 60.
 *   antes  → CV 90 → (90·12 + 60·28) / 40 = 69, con riesgo
 *   después → CV 50 → (50 + 60) / 2      = 55, no priorizado
 * Cata: 50, 50 y 50 en las dos, ya contratada, con la prueba del puesto (72) y la simulación.
 */
const ANA = { resultados: 40, personas: 100, abierta: 70 }
const BETO = { resultados: 90, personas: 10, abierta: 60 }
const CATA = { resultados: 50, personas: 50, abierta: 50 }

async function abrirLaTuerca(page: Page, vacante: number) {
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
  const cajon = page.getByRole('region', { name: 'Configuración de la vacante' })
  if (!(await cajon.isVisible())) {
    await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
  }
  await expect(cajon).toBeVisible()
  return cajon
}

const desplegableDePesos = (page: Page) => page.getByLabel('Qué pesos rigen la decisión')

/** Las cifras «Antes» y «Después» de una fila de la confirmación. */
const cifrasDe = (page: Page, etapa: string) =>
  page.getByRole('dialog').getByRole('row').filter({ hasText: etapa }).getByRole('cell').allTextContents()

test.describe('Cambiar los pesos con candidatos dentro y el fin del préstamo (V74)', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    retirarLoSembrado(MARCA, [])
    equipo = await tokenDePanel()
    antes = crearVersionDePesos(MARCA, 'Pesos de antes', ANTES)
    despues = crearVersionDePesos(MARCA, 'Pesos de después', DESPUES)
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    await limpiarSiempre([() => retirarLoSembrado(MARCA, correos)])
  })

  // ------------------------------------------------------------ Parte A

  test('recorrido 1 · la confirmación, el recálculo sin IA ni movimientos, y el ranking y su Excel reordenados (AC-01..AC-04, AC-08, AC-09)', async ({ page }, info) => {
    test.setTimeout(240_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · recorrido 1', antes.id)
    const ana = await candidatoCalificado(equipo, MARCA, vacante, 'Ana', ANA, correos)
    const beto = await candidatoCalificado(equipo, MARCA, vacante, 'Beto', BETO, correos)
    const cata = await candidatoCalificado(equipo, MARCA, vacante, 'Cata', CATA, correos)
    yaDecidido(cata.postulacion, antes.id, 72, SIMULACION, 55)
    const dani = await soloPostula(MARCA, vacante, 'Dani', correos)

    // Con los pesos de antes, Beto va delante
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(61)
    expect(notaDe(beto.postulacion, 'PERFIL_INTEGRAL')).toBe(69)
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(SIMULACION_ANTES)
    const quieto = loQueNoSeMueve(vacante)

    await entrarAlPanelCon(page, equipo)
    await abrirLaTuerca(page, vacante)
    await expect.poll(() => nombresVisibles(page)).toEqual(['Beto Pesos QA', 'Ana Pesos QA'])

    // El desplegable sigue activo con candidatos dentro, y antes de guardar pregunta
    const desplegable = desplegableDePesos(page)
    await expect(desplegable).toBeEnabled()
    await desplegable.selectOption(String(despues.id))
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText(`¿Cambiar a «${despues.etiqueta}»?`)
    // Cuenta a los tres con nota, no a Dani, que todavía no tiene ninguna
    await expect(dialogo).toContainText(
      'Se recalcularán las notas de 3 personas con los pesos nuevos: currículum, Perfil Integral, simulación, ' +
        'validación y nota final. No se llama a la IA y nadie cambia de etapa. Las decisiones ya tomadas se mantienen.',
    )
    await expect(dialogo).toContainText('Currículum 12 → 20 · Preguntas 28 → 20')
    expect(await cifrasDe(page, 'Perfil Integral')).toEqual(['40', '40'])
    expect(await cifrasDe(page, 'Prueba del puesto')).toEqual(['30', '35'])
    expect(await cifrasDe(page, 'Simulación')).toEqual(['15', '15'])
    expect(await cifrasDe(page, 'Validación')).toEqual(['15', '10'])
    // Preguntar no escribe nada
    expect(versionDeLaVacante(vacante)).toBe(antes.id)

    // «Cancelar» lo deja como estaba
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(desplegable).toHaveValue(String(antes.id))
    expect(registrosDelCambio(vacante).filter((r) => String(r.despues).includes(String(despues.id)))).toHaveLength(0)

    // Y «Cambiar y recalcular», pulsado dos veces, recalcula una sola
    await desplegable.selectOption(String(despues.id))
    await page.getByRole('dialog').getByRole('button', { name: 'Cambiar y recalcular' }).dblclick()
    await expect(page.getByRole('status').filter({ hasText: 'Pesos cambiados' }))
      .toHaveText('Pesos cambiados: se recalcularon 3 personas.', { timeout: 30_000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(desplegable).toHaveValue(String(despues.id))

    // AC-01 · AC-02: el currículum usa la nota de 0 a 100 que la IA ya había puesto a
    // «Gestión de personas», el Perfil Integral el reparto nuevo, y el grupo se rehace
    expect(versionDeLaVacante(vacante)).toBe(despues.id)
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(70)
    expect(notaDe(beto.postulacion, 'PERFIL_INTEGRAL')).toBe(55)
    expect(notaDe(cata.postulacion, 'PERFIL_INTEGRAL')).toBe(50)
    expect(grupoDe(ana.postulacion)).toBe('POTENCIAL_CON_RIESGO')
    expect(grupoDe(beto.postulacion)).toBe('NO_PRIORIZADO')
    // La prueba técnica lleva sus puntos: vale lo mismo y pasa a decir la versión nueva
    expect(notaDe(cata.postulacion, 'PRUEBA_PUESTO')).toBe(72)
    // AC-03: la simulación se repondera con el peso de sus criterios en la versión nueva
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(SIMULACION_DESPUES)
    // Todas sus notas y sus retratos dicen la versión nueva; Dani sigue sin ninguna
    const ids = [ana, beto, cata].map((c) => c.postulacion).join(',')
    expect(Number(uno(`select count(*) as n from nota_etapa where postulacion_id in (${ids})
                         and version_pesos_id <> ${despues.id}`).n)).toBe(0)
    expect(Number(uno(`select count(*) as n from perfil_talento where postulacion_id in (${ids})
                         and version_pesos_id <> ${despues.id}`).n)).toBe(0)
    expect(Number(uno(`select count(*) as n from nota_etapa where postulacion_id = ${dani.postulacion}`).n)).toBe(0)
    // AC-01 · AC-04: sin IA, sin máquina de estados, nadie se mueve, y la decisión conserva
    // la nota y la versión con que se tomó
    expect(loQueNoSeMueve(vacante)).toBe(quieto)
    expect(uno(`select nota_global::text as nota, version_pesos_id as version from decision
                 where postulacion_id = ${cata.postulacion}`)).toEqual({ nota: '55.00', version: antes.id })
    expect(uno(`select estado_codigo from postulacion where id = ${cata.postulacion}`).estado_codigo).toBe('CONTRATADO')

    // AC-08: quién, cuándo, las dos versiones y a cuántos; y una sola vez pese al doble clic
    const registros = registrosDelCambio(vacante).filter((r) => String(r.despues).includes(String(despues.id)))
    expect(registros).toHaveLength(1)
    const registro = registros[0]!
    expect(registro.usuario_id).toBe(Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id))
    expect(registro.creado_en).not.toBeNull()
    expect(JSON.parse(String(registro.antes))).toEqual({ versionPesosId: String(antes.id) })
    expect(JSON.parse(String(registro.despues))).toEqual({ versionPesosId: String(despues.id), personasRecalculadas: 3 })

    // AC-09: el ranking, sin recargar, con las notas nuevas y el orden nuevo
    await expect.poll(() => nombresVisibles(page)).toEqual(['Ana Pesos QA', 'Beto Pesos QA'])
    await expect(filasDelRanking(page).nth(0)).toContainText('70')
    await expect(filasDelRanking(page).nth(1)).toContainText('55')

    // Y su Excel, justo después
    const boton = page.getByRole('button', { name: /^Descargar Excel \(\d+\)$/ })
    await expect(boton).toBeEnabled()
    const espera = page.waitForEvent('download', { timeout: 30_000 })
    await boton.click()
    const ruta = info.outputPath('ranking-tras-el-cambio.xlsx')
    await (await espera).saveAs(ruta)
    const libro = leerElLibro(ruta)
    const columna = libro.cabeceras.indexOf('Nota Perfil Integral /100')
    expect(columna).toBeGreaterThan(-1)
    expect(libro.filas.map((f) => [f[1], f[columna]])).toEqual([
      ['Ana Pesos QA', '70'],
      ['Beto Pesos QA', '55'],
    ])
  })

  test('AC-07 · si una nota no se puede recalcular a mitad, no se guarda nada y el diálogo lo dice', async ({ page }) => {
    test.setTimeout(180_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · fallo a mitad', antes.id)
    const ana = await candidatoCalificado(equipo, MARCA, vacante, 'Ana', ANA, correos)
    const dani = await soloPostula(MARCA, vacante, 'Dani', correos)
    // Una nota de simulación sin su rúbrica: no se puede volver a sumar
    sql(`insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id, calculada_en)
         values (${dani.postulacion}, 'SIMULACION', 30, ${antes.id}, now());`)
    const foto = fotoDeLasNotas(vacante)
    const registros = registrosDelCambio(vacante).length

    await entrarAlPanelCon(page, equipo)
    await abrirLaTuerca(page, vacante)
    await desplegableDePesos(page).selectOption(String(despues.id))
    const dialogo = page.getByRole('dialog')
    await dialogo.getByRole('button', { name: 'Cambiar y recalcular' }).click()
    await expect(dialogo.getByRole('alert')).toContainText('No se cambió nada: la vacante sigue con sus pesos y sus notas.', { timeout: 30_000 })
    await expect(dialogo.getByRole('button', { name: 'Cambiar y recalcular' })).toBeEnabled()

    expect(versionDeLaVacante(vacante)).toBe(antes.id)
    expect(fotoDeLasNotas(vacante)).toBe(foto)
    expect(registrosDelCambio(vacante)).toHaveLength(registros)
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(61)

    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
    await expect(desplegableDePesos(page)).toHaveValue(String(antes.id))
  })

  test('AC-06 · sin nadie con nota se guarda sin preguntar; la misma no registra; cerrada, archivada o eliminada contesta 409; sin permiso, 403', async ({ page }) => {
    test.setTimeout(180_000)
    // Una vacante con alguien dentro pero sin nota: se guarda sin confirmación
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · sin notas', antes.id)
    await soloPostula(MARCA, vacante, 'Dani', correos)
    await entrarAlPanelCon(page, equipo)
    await abrirLaTuerca(page, vacante)
    await desplegableDePesos(page).selectOption(String(despues.id))
    await expect.poll(() => versionDeLaVacante(vacante), { timeout: 20_000 }).toBe(despues.id)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(desplegableDePesos(page)).toHaveValue(String(despues.id))
    const todos = registrosDelCambio(vacante)
    const ultimo = todos[todos.length - 1]!
    expect(JSON.parse(String(ultimo.despues))).toEqual({ versionPesosId: String(despues.id), personasRecalculadas: 0 })

    // La misma versión: ni recalcula ni registra
    const cuantos = registrosDelCambio(vacante).length
    const igual = await exigir<any>(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: despues.id })
    expect(igual).toEqual({ versionPesosId: despues.id, personasRecalculadas: 0 })
    expect(registrosDelCambio(vacante)).toHaveLength(cuantos)

    // Sin el permiso de hoy para asignar la versión de pesos: 403, al preguntar y al cambiar
    const sinPermiso = await tokenDePanel(equipoSin(MARCA, 'sinpesos', ['publicar_version_pesos']))
    expect((await pedir(`/panel/vacantes/${vacante}/version-pesos/cambio?versionPesosId=${antes.id}`, sinPermiso)).estado).toBe(403)
    expect((await pedir(`/panel/vacantes/${vacante}/version-pesos`, sinPermiso, 'POST', { versionPesosId: antes.id })).estado).toBe(403)
    expect(versionDeLaVacante(vacante)).toBe(despues.id)

    // Cerrada: 409, y el desplegable en solo lectura con el porqué
    sql(`update vacante set estado = 'CERRADA', cerrada_en = now() where id = ${vacante};`)
    const cerrada = await pedir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: antes.id })
    expect(cerrada.estado).toBe(409)
    await page.reload()
    await abrirLaTuerca(page, vacante)
    await expect(desplegableDePesos(page)).toBeDisabled()
    await expect(page.getByRole('group', { name: 'Pesos de la decisión' }))
      .toContainText('La vacante está cerrada: sus pesos ya no se cambian')
    // Archivada: 409
    sql(`update vacante set archivada_en = now() where id = ${vacante};`)
    expect((await pedir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: antes.id })).estado).toBe(409)
    // Eliminada: 409, porque existe y es de la empresa
    sql(`update vacante set archivada_en = null, eliminada_en = now() where id = ${vacante};`)
    expect((await pedir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: antes.id })).estado).toBe(409)
    expect(versionDeLaVacante(vacante)).toBe(despues.id)
  })

  test('QA-01 · volver a los pesos de antes deja la simulación y la validación del facilitador como estaban, aunque pasen por peso 0 (AC-03)', async () => {
    test.setTimeout(120_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · ida y vuelta', antes.id)
    const cata = await soloPostula(MARCA, vacante, 'Cata', correos)
    yaDecidido(cata.postulacion, antes.id, 72, SIMULACION, 55)
    validacionDeAntesDeLaV75(cata.postulacion, antes.id, VALIDACION)
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(SIMULACION_ANTES)
    expect(notaDe(cata.postulacion, 'VALIDACION')).toBe(VALIDACION_ANTES)
    // Las dos se sembraron como antes de la V75: sin apuntar todavía cómo se pusieron
    expect(comoSePuso(cata.postulacion, 'VAL_SERVICIO')).toBe('/')

    const ida = await exigir<any>(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: despues.id })
    expect(ida.personasRecalculadas).toBe(1)
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(SIMULACION_DESPUES)
    expect(notaDe(cata.postulacion, 'VALIDACION')).toBe(VALIDACION_DESPUES)
    expect(notaDeSimulacion(cata.postulacion, 'VAL_SERVICIO')).toBe(0)
    // El primer cambio apunta cómo se puso, con el máximo de la versión que la vacante tenía
    expect(comoSePuso(cata.postulacion, 'VAL_SERVICIO')).toBe('3.00/5.00')

    const vuelta = await exigir<any>(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: antes.id })
    expect(vuelta.personasRecalculadas).toBe(1)

    // Con la misma vara de antes, las mismas notas que puso el facilitador y la misma suma
    expect({
      SIM_EJECUCION: notaDeSimulacion(cata.postulacion, 'SIM_EJECUCION'),
      SIM_CALIDAD: notaDeSimulacion(cata.postulacion, 'SIM_CALIDAD'),
      SIM_APRENDIZAJE: notaDeSimulacion(cata.postulacion, 'SIM_APRENDIZAJE'),
    }).toEqual(SIMULACION)
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(SIMULACION_ANTES)
    expect({
      VAL_CALIDAD: notaDeSimulacion(cata.postulacion, 'VAL_CALIDAD'),
      VAL_SERVICIO: notaDeSimulacion(cata.postulacion, 'VAL_SERVICIO'),
      VAL_RESULTADO: notaDeSimulacion(cata.postulacion, 'VAL_RESULTADO'),
    }).toEqual(VALIDACION)
    expect(notaDe(cata.postulacion, 'VALIDACION')).toBe(VALIDACION_ANTES)
    expect(versionDeLaNota(cata.postulacion, 'VALIDACION')).toBe(antes.id)

    // Y otra ida da lo mismo que la primera: nada se acumula
    await exigir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: despues.id })
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(SIMULACION_DESPUES)
    expect(notaDe(cata.postulacion, 'VALIDACION')).toBe(VALIDACION_DESPUES)
  })

  test('QA-02 · la nota que pone el facilitador mientras cambian los pesos espera y queda en la escala nueva (AC-03, AC-05)', async () => {
    test.setTimeout(120_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · facilitador a mitad', antes.id)
    const cata = await soloPostula(MARCA, vacante, 'Cata', correos)
    yaDecidido(cata.postulacion, antes.id, 72, SIMULACION, 55)
    const calidad = idDelCriterio('SIM_CALIDAD')

    /*
      El cambio a mitad, como lo deja ServicioPesosDeLaVacanteImpl#cambiar mientras recalcula:
      la vacante bloqueada y ya en la versión nueva, y la simulación de Cata ya llevada a ella
      (20 · 4,67 · 0 → 59,67), sin confirmar todavía. En ese hueco el facilitador corrige la
      calidad a 8: el máximo con el que se valida y se apunta tiene que ser el nuevo (10), no
      el de antes (15).

      Como el cambio real, antes de reescribir las notas apunta cómo se pusieron (15/15, 7/15,
      6/10): sin eso la vuelta de abajo partía del 0 del aprendizaje y daba 62 (QA del ciclo 2).
    */
    const cambio = sesionAbierta(`
      begin;
      select id from vacante where id = ${vacante} for no key update;
      update vacante set version_pesos_id = ${despues.id} where id = ${vacante};
      ${apuntarComoSePusieron(vacante, cata.postulacion, antes.id)}
      update nota_criterio nc set puntaje = x.p
        from (values ('SIM_EJECUCION', 20.00), ('SIM_CALIDAD', 4.67), ('SIM_APRENDIZAJE', 0.00)) x(c, p), criterio c
       where c.id = nc.criterio_id and c.codigo = x.c and c.version_plantilla_prueba_id is null
         and nc.postulacion_id = ${cata.postulacion};
      update nota_etapa set puntaje = ${SIMULACION_DESPUES}, version_pesos_id = ${despues.id}, calculada_en = now()
       where postulacion_id = ${cata.postulacion} and etapa_codigo = 'SIMULACION';
      select pg_sleep(5);
      commit;`)
    await new Promise((r) => setTimeout(r, 1_500))
    const desde = Date.now()
    await exigir(`/panel/postulaciones/${cata.postulacion}/simulacion/criterios/${calidad}/nota`, equipo, 'POST', {
      puntaje: 8,
      explicacion: `${MARCA}: el facilitador corrige la calidad mientras cambian los pesos`,
    })
    const espero = Date.now() - desde
    await cambio
    expect(espero).toBeGreaterThan(1_500)
    expect(comoSePuso(cata.postulacion, 'SIM_CALIDAD')).toBe('8.00/10.00')
    const suma = await exigir<any>(`/panel/postulaciones/${cata.postulacion}/simulacion/calificacion`, equipo, 'POST')
    expect(Number(suma.nota)).toBe(63) // 20 + 8 + 0 + 35
    expect(versionDeLaNota(cata.postulacion, 'SIMULACION')).toBe(despues.id)

    // De vuelta a los de antes, su 8 sobre 10 vale 12 sobre 15: 15 + 12 + 6 + 35
    await exigir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: antes.id })
    expect(notaDeSimulacion(cata.postulacion, 'SIM_CALIDAD')).toBe(12)
    expect(notaDe(cata.postulacion, 'SIMULACION')).toBe(68)
  })

  test('QA-02 · una nota que se escribe mientras el cambio está a mitad sale con la versión nueva (AC-05)', async () => {
    test.setTimeout(120_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · nota a mitad', antes.id)
    const ana = await candidatoCalificado(equipo, MARCA, vacante, 'Ana', ANA, correos)
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(61)
    const respuesta = Number(uno(`select r.id from respuesta r join postulacion p on p.evaluacion_id = r.evaluacion_id
                                   where p.id = ${ana.postulacion}`).id)

    /*
      El cambio a mitad, como lo deja ServicioPesosDeLaVacanteImpl#cambiar mientras recalcula:
      la vacante bloqueada y ya en la versión nueva, y la nota de Ana ya recalculada con ella
      (70), sin confirmar todavía. En ese hueco llega una nota de Ana —la de la IA que estaba
      en curso, o una persona que ajusta la abierta—, que relee los pesos de la vacante.
    */
    const cambio = sesionAbierta(`
      begin;
      select id from vacante where id = ${vacante} for update;
      update vacante set version_pesos_id = ${despues.id} where id = ${vacante};
      update nota_etapa set puntaje = 70.00, version_pesos_id = ${despues.id}, calculada_en = now()
       where postulacion_id = ${ana.postulacion} and etapa_codigo = 'PERFIL_INTEGRAL';
      select pg_sleep(5);
      commit;`)
    await new Promise((r) => setTimeout(r, 1_500))
    await exigir(`/panel/postulaciones/${ana.postulacion}/evaluacion/respuestas/${respuesta}/nota`, equipo, 'PUT', {
      puntaje: ANA.abierta,
      motivo: `${MARCA}: ajuste mientras cambian los pesos`,
    })
    await cambio

    // Lo que llega después del cambio se calcula con la versión nueva, no con la que se leyó antes
    expect(versionDeLaVacante(vacante)).toBe(despues.id)
    expect(versionDeLaNota(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(despues.id)
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(70)
    expect(grupoDe(ana.postulacion)).toBe('POTENCIAL_CON_RIESGO')
  })

  test('QA-03 · la prueba del editor que se cierra mientras cambian los pesos dice la versión nueva (AC-01, AC-05)', async () => {
    test.setTimeout(120_000)
    const { vacante, postulacion, criterio } = await pruebaPropiaEntregada(equipo, MARCA, antes.id, correos)
    expect(notaDe(postulacion, 'PRUEBA_PUESTO')).toBeNull()

    /*
      El cambio a mitad: la vacante bloqueada y ya en la versión nueva, sin confirmar. En ese
      hueco se cierra la prueba —aquí la nota a mano del único criterio; en producción, la IA
      que termina de calificarla, por el mismo CierreDeLaPruebaPropia—. Su nota no depende de
      los pesos, pero dice con qué versión se calculó, y la vacante acaba en la nueva.
    */
    const cambio = sesionAbierta(`
      begin;
      select id from vacante where id = ${vacante} for no key update;
      update vacante set version_pesos_id = ${despues.id} where id = ${vacante};
      select pg_sleep(5);
      commit;`)
    await new Promise((r) => setTimeout(r, 1_500))
    await exigir(`/panel/postulaciones/${postulacion}/prueba-propia/criterios/${criterio}/nota`, equipo, 'PUT', {
      puntaje: 80,
      motivo: `${MARCA}: nota a mano mientras cambian los pesos`,
    })
    await cambio

    expect(versionDeLaVacante(vacante)).toBe(despues.id)
    expect(notaDe(postulacion, 'PRUEBA_PUESTO')).toBe(80)
    // Como la del Perfil Integral (QA-02) y la del cuestionario técnico: la versión de la vacante
    expect(versionDeLaNota(postulacion, 'PRUEBA_PUESTO')).toBe(despues.id)
  })

  test('QA-04 · la entrega que espera a un cambio de pesos no le devuelve a la persona el grupo de antes (AC-01, AC-05)', async () => {
    test.setTimeout(120_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · entrega a mitad del cambio', antes.id)
    const ana = await candidatoCalificado(equipo, MARCA, vacante, 'Ana', ANA, correos)
    await enLaPruebaSinEntregar(equipo, MARCA, ana)
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(61)
    expect(grupoDe(ana.postulacion)).toBe('NO_PRIORIZADO')

    /*
      Un cambio de pesos REAL en curso cuando Ana entrega. Para que la entrega llegue con el
      cambio a mitad, otra sesión retiene la vacante unos segundos: el cambio queda en cola
      detrás de ella, y la entrega —que ya leyó la postulación— detrás del cambio. Al soltarla,
      el cambio recalcula a Ana (61 → 70, «con riesgo») y confirma; la entrega sigue después y
      no debe reescribir el grupo que el cambio acaba de poner.
    */
    const retenida = sesionAbierta(`
      begin;
      select id from vacante where id = ${vacante} for no key update;
      select pg_sleep(4);
      rollback;`)
    await new Promise((r) => setTimeout(r, 700))
    const cambio = exigir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: despues.id })
    await new Promise((r) => setTimeout(r, 1_000))
    const entrega = exigir(`/portal/prueba/${ana.uuid}/entrega`, ana.token, 'POST')
    await Promise.all([retenida, cambio, entrega])

    expect(versionDeLaVacante(vacante)).toBe(despues.id)
    expect(estadoDe(ana.postulacion)).toBe('PRUEBA_CALIFICANDO')
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(70)
    expect(versionDeLaNota(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(despues.id)
    // El de la nota nueva, como sale sin carrera (QA-02 lo comprueba con la misma Ana)
    expect(grupoDe(ana.postulacion)).toBe('POTENCIAL_CON_RIESGO')
  })

  test('QA-05 · el cambio de pesos a mitad no devuelve a su estado de antes a quien el equipo movió en ese rato (AC-01, AC-04)', async () => {
    test.setTimeout(120_000)
    const vacante = await vacanteConPreguntasYPrueba(equipo, MARCA, 'Analista de caja · avance a mitad del cambio', antes.id)
    const ana = await candidatoCalificado(equipo, MARCA, vacante, 'Ana', ANA, correos)
    const beto = await candidatoCalificado(equipo, MARCA, vacante, 'Beto', BETO, correos)
    expect(estadoDe(ana.postulacion)).toBe('PERFIL_POR_CONFIRMAR')

    /*
      El cambio REAL recorre a los dos, los más recientes primero, y reescribe la fila de cada
      uno porque su grupo cambia. Otra sesión retiene la de Beto: el cambio, que ya leyó a Ana,
      se queda a mitad al ir a reescribirlo. En ese rato el equipo pasa a Ana a la prueba
      técnica. Al soltarse, el cambio no debe devolverla al estado en que la leyó.
    */
    const retenida = sesionAbierta(`
      begin;
      select id from postulacion where id = ${beto.postulacion} for update;
      select pg_sleep(4);
      commit;`)
    await new Promise((r) => setTimeout(r, 700))
    const cambio = exigir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: despues.id })
    await new Promise((r) => setTimeout(r, 1_000))
    await exigir(`/panel/postulaciones/${ana.postulacion}/confirmacion-avance`, equipo, 'POST', {
      motivo: `${MARCA}: pasa a la prueba mientras cambian los pesos`,
    })
    const movida = estadoDe(ana.postulacion)
    expect(movida).not.toBe('PERFIL_POR_CONFIRMAR')
    await Promise.all([retenida, cambio])

    expect(versionDeLaVacante(vacante)).toBe(despues.id)
    expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBe(70)
    expect(grupoDe(ana.postulacion)).toBe('POTENCIAL_CON_RIESGO')
    expect(grupoDe(beto.postulacion)).toBe('NO_PRIORIZADO')
    // El cambio de pesos no mueve a nadie: Ana sigue donde la dejó el equipo
    expect(estadoDe(ana.postulacion)).toBe(movida)
  })

  // ------------------------------------------------------------ Parte B

  test.describe('La clienta sin banco ni pruebas propias', () => {
    let clienta: Clienta
    let bancos = { publicado: 0, anterior: 0 }
    let prestada = { version: 0, nombre: '' }
    let otra = { version: 0, nombre: '' }
    let conBanco = 0
    let conPrueba = 0
    let sinPrueba = 0

    test.beforeAll(async () => {
      test.setTimeout(120_000)
      clienta = await empresaClienta(MARCA, correos)
      bancos = bancosDeRenaser()
      prestada = pruebaDeRenaser()
      otra = otraPruebaDeRenaser(MARCA)
      conBanco = vacanteViejaDeLaClienta(clienta, MARCA, 'Asistente contable · banco de RENASER fijo', {
        aplicaEvaluacion: true,
        fija: bancos.anterior,
      })
      conPrueba = vacanteViejaDeLaClienta(clienta, MARCA, 'Asistente contable · prueba de RENASER', {
        aplicaEvaluacion: false,
        pruebaAsignada: prestada.version,
      })
      sinPrueba = vacanteViejaDeLaClienta(clienta, MARCA, 'Asistente contable · sin prueba elegida', {
        aplicaEvaluacion: false,
      })
    })

    test('recorrido 2 · no ve nada de RENASER, y la vacante vieja rinde la misma versión del banco que los anteriores (AC-10, AC-14)', async ({ page }) => {
      test.setTimeout(180_000)
      expect(bancos.anterior).not.toBe(bancos.publicado)
      const deRenaser = consultar(`select etiqueta from version_banco where organizacion_id =
                                     (select id from organizacion where es_plataforma) and vacante_id is null`)
        .map((f) => String(f.etiqueta))
      expect(deRenaser.length).toBeGreaterThan(0)

      await entrarAlPanelCon(page, clienta.token)
      // La configuración del banco
      await page.goto('/admin/configuracion')
      const banco = page.getByRole('heading', { name: 'El banco de preguntas' }).locator('xpath=ancestor::section[1]')
      await expect(banco).toContainText('Tu empresa no tiene banco por nivel', { timeout: 20_000 })
      for (const etiqueta of deRenaser) await expect(page.locator('main')).not.toContainText(etiqueta)

      // El desplegable de pruebas de una vacante vieja sin prueba elegida: nada de RENASER
      let cajon = await abrirLaTuerca(page, sinPrueba)
      const pruebas = page.getByLabel('Qué prueba del puesto rendirá')
      await expect(pruebas).toBeEnabled({ timeout: 20_000 })
      await expect(pruebas.locator('option')).toHaveText(['Elige la prueba…'])
      await expect(cajon).not.toContainText(prestada.nombre)
      await expect(cajon).not.toContainText(otra.nombre)

      // La vieja que ya tenía una de RENASER la conserva (AC-12), y no se ofrece ninguna otra
      cajon = await abrirLaTuerca(page, conPrueba)
      const numero = Number(uno(`select version from version_plantilla_prueba where id = ${prestada.version}`).version)
      await expect(pruebas.locator('option')).toHaveText(['Elige la prueba…', `${prestada.nombre} · v${numero}`], { timeout: 20_000 })
      await expect(pruebas).toHaveValue(String(prestada.version))
      await expect(cajon).not.toContainText(otra.nombre)

      // La del banco fijo se sigue llamando como siempre
      cajon = await abrirLaTuerca(page, conBanco)
      await expect(cajon).toContainText('El banco de RENASER para su nivel', { timeout: 20_000 })

      // Por la API: ni sus versiones del banco ni sus pruebas existen para la clienta
      expect((await exigir<any[]>('/panel/banco-preguntas/versiones', clienta.token))).toEqual([])
      expect((await exigir<any>('/panel/banco-preguntas/propio', clienta.token)).propio).toBe(false)
      for (const id of [bancos.publicado, bancos.anterior]) {
        expect((await pedir(`/panel/banco-preguntas/versiones/${id}/preguntas`, clienta.token)).estado).toBe(404)
      }
      const plantillas = await exigir<{ nombre: string }[]>('/panel/plantillas-prueba', clienta.token)
      expect(plantillas.map((p) => p.nombre)).not.toContain(prestada.nombre)
      expect(plantillas.map((p) => p.nombre)).not.toContain(otra.nombre)
      for (const id of [prestada.version, otra.version]) {
        expect((await pedir(`/panel/plantillas-prueba/versiones/${id}`, clienta.token)).estado).toBe(404)
      }
      expect((await pedir(`/panel/vacantes/${sinPrueba}/plantilla-prueba`, clienta.token, 'POST',
        { versionPlantillaPruebaId: otra.version })).estado).toBe(404)

      // AC-10: dos postulan y rinden la versión fija; postula un tercero y rinde la misma,
      // aunque RENASER tenga publicada otra para Ejecución
      const primeros: Candidato[] = []
      for (const nombre of ['Elena', 'Fabio']) primeros.push(await soloPostula(MARCA, conBanco, nombre, correos))
      for (const c of primeros) expect(bancoQueRinde(c.postulacion)).toBe(bancos.anterior)
      const tercero = await soloPostula(MARCA, conBanco, 'Gael', correos)
      expect(bancoQueRinde(tercero.postulacion)).toBe(bancos.anterior)
      await empezarEvaluacion(tercero.token, tercero.uuid)
      expect(Number(uno(`select count(*) as n from orden_pregunta o join pregunta q on q.id = o.pregunta_id
                           join postulacion p on p.evaluacion_id = o.evaluacion_id
                          where p.id = ${tercero.postulacion} and q.version_banco_id <> ${bancos.anterior}`).n)).toBe(0)
      expect(Number(uno(`select count(*) as n from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
                          where p.id = ${tercero.postulacion}`).n)).toBeGreaterThan(0)
    })

    test('AC-12 · AC-15 · la prueba de RENASER asignada se sigue rindiendo, y los pesos de RENASER se siguen usando y personalizando', async () => {
      test.setTimeout(180_000)
      // Un candidato a medio rendir la prueba de RENASER de la vacante vieja
      const { correo, token } = await cuenta(MARCA, 'Hugo', correos)
      const uuid = await postular(token, conPrueba)
      const postulacion = postulacionPorUuid(uuid)
      await exigir(`/panel/postulaciones/${postulacion}/confirmacion-avance`, clienta.token, 'POST', {
        motivo: `${MARCA}: pasa a la prueba técnica`,
      })
      expect(String(uno(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo)).toBe('PRUEBA_TURNO_CANDIDATO')
      expect((await pedir(`/portal/prueba/${uuid}`, token)).estado).toBe(200)
      const empezada = await pedir<any>(`/portal/prueba/${uuid}/inicio`, token, 'POST')
      expect(empezada.estado).toBe(200)
      const enunciado = String(uno(`select enunciado from version_plantilla_prueba where id = ${prestada.version}`).enunciado)
      expect(empezada.cuerpo.enunciado).toBe(enunciado)
      expect(Number(uno(`select version_plantilla_prueba_id as v from intento_prueba where postulacion_id = ${postulacion}`).v))
        .toBe(prestada.version)
      // Y la clienta ve su rúbrica para calificarla
      const notas = await exigir<{ nombre: string }[]>(`/panel/postulaciones/${postulacion}/prueba/notas`, clienta.token)
      expect(notas.map((n) => n.nombre)).toEqual(
        consultar(`select nombre from criterio where version_plantilla_prueba_id = ${prestada.version} order by orden`)
          .map((f) => String(f.nombre)),
      )
      expect(correo).toMatch(/@example\.com$/)

      // AC-15: sin pesos propios ve y usa las versiones de RENASER
      const versiones = await exigir<{ id: number; estado: string }[]>('/panel/pesos/versiones', clienta.token)
      expect(versiones.map((v) => v.id)).toContain(pesosDeRenaser())
      const otraDeRenaser = versiones.find((v) => v.estado === 'PUBLICADA' && v.id !== versionDeLaVacante(conBanco))!
      expect((await exigir<any>(`/panel/vacantes/${conBanco}/version-pesos`, clienta.token, 'POST',
        { versionPesosId: otraDeRenaser.id })).versionPesosId).toBe(otraDeRenaser.id)
      expect(versionDeLaVacante(conBanco)).toBe(otraDeRenaser.id)
      // Y personalizar los pesos y las plantillas de evaluación sigue funcionando; el banco no
      expect(await exigir<any>('/panel/organizacion/personalizacion', clienta.token))
        .toEqual({ pesosPropios: false, plantillasEvaluacionPropias: false })
      for (const instrumento of ['PESOS', 'PLANTILLA_EVALUACION']) {
        const r = await pedir('/panel/organizacion/personalizacion', clienta.token, 'POST', { instrumento })
        expect(r.estado, `personalizar ${instrumento}`).toBeLessThan(300)
      }
      expect(await exigir<any>('/panel/organizacion/personalizacion', clienta.token))
        .toEqual({ pesosPropios: true, plantillasEvaluacionPropias: true })
      const banco = await pedir('/panel/organizacion/personalizacion', clienta.token, 'POST', { instrumento: 'BANCO' })
      expect(banco.estado).toBe(400)
      expect(JSON.stringify(banco.cuerpo)).toContain('Esta personalización ya no existe')
    })
  })

  // ------------------------------------------------------------ Parte C

  test('recorrido 3 · el enunciado se guarda como archivo, la copia lo lleva, y se abre desde el panel y, tras «Empezar», desde el portal (AC-17, AC-18, AC-19)', async ({ page, browser }) => {
    test.setTimeout(240_000)
    const NOMBRE = 'caso-de-caja.pdf'
    const ENLACE_VIEJO = 'https://enlace-viejo.example.com/consigna-de-180-dias.pdf'
    const lugar = await lugarDe(equipo)
    const a = await crearVacante(equipo, 'Cajera con enunciado', lugar, undefined, MARCA)
    const b = await crearVacante(equipo, 'Cajera que copia', lugar, undefined, MARCA)
    for (const v of [a, b]) await exigir(`/panel/vacantes/${v}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
    await escribirPrueba(equipo, a, {
      criterios: [{ nombre: 'Caja', puntosCalificados: 100, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Dónde está el descuadre?', queDebeTener: 'La cuenta.' }] }],
      datos: { enunciado: CASO, modalidad: 'CRONOMETRADA', duracionMinutos: 60, guiaCalificacion: 'Mira las cifras.' },
    })

    // AC-17: se guarda el archivo y ningún enlace
    await subirEnunciado(equipo, a, NOMBRE)
    const deA = enunciadoGuardado(a)
    expect(deA).toHaveLength(1)
    expect(deA[0]!.archivo).not.toBeNull()
    expect(deA[0]!.enlace).toBeNull()

    /**
     * Abre el adjunto desde el editor del panel: lo descarga por su archivo, con su sesión.
     *
     * El panel lee esa descarga como blob y la abre con `window.open`, y Playwright no conserva
     * el cuerpo de una respuesta así: `respuesta.body()` sale vacío aunque llegue entera (QA del
     * ciclo 2). Por eso el cuerpo se toma al pasar, interceptando la petición, y se le entrega a
     * la página tal cual llegó.
     */
    const abrirDesdeElPanel = async (vacante: number) => {
      await page.goto(`/admin/vacantes/${vacante}/prueba`)
      const verCaso = page.getByRole('button', { name: 'Ver el caso' })
      await expect(verCaso.or(page.getByRole('button', { name: NOMBRE })).first()).toBeVisible({ timeout: 20_000 })
      if (await verCaso.first().isVisible()) await verCaso.first().click()
      const descargado: { estado?: number; cuerpo?: Buffer } = {}
      const ruta = '**/archivos/*/descarga'
      await page.route(ruta, async (route) => {
        const servida = await route.fetch()
        descargado.estado = servida.status()
        descargado.cuerpo = await servida.body()
        await route.fulfill({ response: servida })
      })
      try {
        // La abre con `noopener`: se espera en el contexto, no como ventana hija de la página
        const ventana = page.context().waitForEvent('page', { timeout: 20_000 })
        await page.getByRole('button', { name: NOMBRE }).first().click()
        // Se abrió: el panel solo abre la ventana si recibió el archivo con algo dentro
        await (await ventana).close()
        expect(descargado.estado).toBe(200)
        expect(descargado.cuerpo?.subarray(0, 5).toString()).toBe('%PDF-')
        await expect(page.getByText('No se pudo abrir el enunciado adjunto.')).toHaveCount(0)
      } finally {
        await page.unroute(ruta)
      }
    }
    await entrarAlPanelCon(page, equipo)
    await abrirDesdeElPanel(a)
    expect((await publicarPrueba(equipo, a)).estado).toBe(200)

    // AC-18: la otra vacante copia la prueba y lleva el mismo archivo, sin enlace
    await page.goto(`/admin/vacantes/${b}/prueba`)
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click({ timeout: 20_000 })
    const dialogo = page.getByRole('dialog')
    await dialogo.getByText(`${MARCA} Cajera con enunciado`).first().click()
    await expect(dialogo).toContainText(NOMBRE, { timeout: 20_000 })
    await dialogo.getByRole('button', { name: 'Copiar esta prueba' }).click()
    await expect(dialogo).toHaveCount(0, { timeout: 20_000 })
    await expect.poll(() => enunciadoGuardado(b).map((v) => v.archivo)).toEqual([deA[0]!.archivo])
    expect(enunciadoGuardado(b)[0]!.enlace).toBeNull()
    await abrirDesdeElPanel(b)
    expect((await fijarFechaLimite(equipo, b, enVeinteDias())).estado).toBe(200)
    expect((await publicarPrueba(equipo, b)).estado).toBe(200)
    for (const v of [a, b]) await exigir(`/panel/vacantes/${v}/publicacion`, equipo, 'POST')

    // AC-19: la versión de A aún guarda un enlace de antes; no debe salir por ningún lado
    sql(`update version_banco set url_consigna = ${literal(ENLACE_VIEJO)}
          where vacante_id = ${a} and proposito = 'PRUEBA_PUESTO' and estado = 'PUBLICADA';`)
    try {
      for (const [vacante, nombre] of [[a, 'Gina'], [b, 'Hilda']] as const) {
        const c = await candidataEnLaPrueba(equipo, vacante, nombre, correos, 'qa.qapcp74')
        const contexto = await browser.newContext({ baseURL: configuracion().E2E_PORTAL, locale: 'es-PE' })
        try {
          const portal = await contexto.newPage()
          await entrarAlPortalCon(portal, c.token)
          await portal.goto(`/procesos/${c.uuid}/prueba`)
          const empezar = portal.getByRole('button', { name: 'Empezar prueba' })
          await expect(empezar).toBeVisible({ timeout: 20_000 })
          // Antes de «Empezar» no llega ni el caso ni su adjunto (decisión 8)
          await expect(portal.locator('main')).not.toContainText(NOMBRE)
          await empezar.click()
          await portal.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
          await expect(portal.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
          const enlace = portal.getByRole('link', { name: `Abrir el enunciado adjunto: ${NOMBRE}` }).first()
          await expect(enlace).toBeVisible({ timeout: 20_000 })
          const href = await enlace.getAttribute('href')
          expect(href, `el enlace del portal en la vacante ${vacante}`).toMatch(/^(memoria|https?):\/\//)
          expect(href).not.toBe(ENLACE_VIEJO)
          const vista = await pedir(`/portal/prueba/${c.uuid}`, c.token)
          expect(vista.estado).toBe(200)
          expect(JSON.stringify(vista.cuerpo)).not.toContain(ENLACE_VIEJO)
          expect(JSON.stringify(vista.cuerpo)).toContain(NOMBRE)
        } finally {
          await contexto.close()
        }
      }
    } finally {
      sql(`update version_banco set url_consigna = null where vacante_id = ${a};`)
    }
  })
})
