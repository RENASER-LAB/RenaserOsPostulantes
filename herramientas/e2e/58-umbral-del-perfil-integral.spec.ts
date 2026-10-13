import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { limpiarSiempre, sql } from './base-de-datos'
import {
  auditoriasDe,
  cuentaDeCandidato,
  empezarEvaluacion,
  entrarAlPanelCon,
  entrarAlPortalCon,
  entregar,
  escribirBorrador,
  estadoDeLaPostulacion,
  exigir,
  pedir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  respuestaA,
  responder,
  tokenDePanel,
  uno,
  vacanteDe,
} from './ayuda-preguntas-propias'
import {
  crearVacante,
  escribirPrueba,
  lugarDe,
  MARCA,
  publicarPrueba,
  retirarLoSembrado,
  sembrarEquipoSin,
} from './ayuda-prueba-propia'

/**
 * La nota mínima del Perfil Integral para pasar sola a la prueba (V72), los cuatro recorridos
 * de la Verificación de `specs/umbral-del-perfil-integral.md`:
 *
 *   1. Entregar el banco y ver el aviso nuevo, sin prueba.
 *   2. Con nota 72,40, ver la prueba disponible en «Mis procesos».
 *   3. Con nota 59,99, ver «Tu perfil está en revisión» y, en el panel, la ficha con la
 *      explicación.
 *   4. Cambiar la mínima en la tuerca.
 *
 * Y lo que añadió la QA: la ficha sin nota completa y la del interruptor apagado (3b), el
 * aviso de error y la vacante cerrada en la tuerca (5), que el campo desactivado se vea
 * desactivado (6), que al dejar de poder editarse enseñe la mínima guardada y no lo que se
 * escribió sin guardar (7), que sin el permiso del interruptor se vea desactivado (8), y que
 * la mínima y el interruptor tocados a la vez no pierdan ninguno de los dos cambios (9, 10), y
 * que tampoco los pierdan frente a otro guardado de la vacante en la misma tuerca (11, 12).
 *
 * La IA está apagada en el preview. Su cierre se siembra como lo deja la cola —el retrato y
 * el paso a «por confirmar»— sin nota de la abierta, y la nota la pone una persona desde el
 * panel: es el camino del recálculo (AC-06), que pasa por el mismo pase y la misma regla. Las
 * notas exactas al cerrar (72,40, 59,99, nula) las recorre `FlujoNotaMinimaDelPerfilIT`.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const PREGUNTA_DEL_BANCO = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
const RESPUESTA = 'En marzo la caja no cuadraba por 1.200 soles; lo hallé en dos días revisando los vales.'
const ENTREGADA = 'Evaluación entregada. Te avisaremos por correo y en la campana cuando haya novedades.'
const CAMPO = 'Nota mínima para pasar el perfil integral'

const correos: string[] = []
let equipo = ''
let conPase = 0
let sinPase = 0
let fondoEditable = ''

/** Una vacante publicada con banco (una abierta de 100) y prueba del editor. */
async function vacanteConBancoYPrueba(nombre: string, paseAutomatico: boolean): Promise<number> {
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await escribirBorrador(equipo, vacante, [
    {
      nombre: 'General',
      preguntas: [
        { tipo: 'ABIERTA', enunciado: PREGUNTA_DEL_BANCO, puntos: 100, queDebeTener: 'El monto, la causa y el plazo.' },
      ],
    },
  ])
  await publicarPreguntas(equipo, vacante)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [
          { tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre de marzo?', queDebeTener: 'La cuenta y el monto.' },
        ],
      },
    ],
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${vacante}/calificacion-automatica`, equipo, 'POST', { activa: paseAutomatico })
  return vacante
}

/** Postula y entrega el banco por la API; devuelve el id de la postulación. */
async function postularYEntregar(token: string, vacante: number): Promise<number> {
  const uuid = await postular(token, vacante)
  const id = postulacionPorUuid(uuid)
  await empezarEvaluacion(token, uuid)
  const preguntaId = Number(
    uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
          where p.id = ${id}`).pregunta_id,
  )
  await responder(token, uuid, preguntaId, { texto: RESPUESTA })
  await entregar(token, uuid)
  return id
}

/**
 * Lo que deja la IA al cerrar el Perfil Integral cuando no pudo calificar la abierta: el
 * retrato hecho y la postulación en «por confirmar», sin nota. En el preview la IA está
 * apagada y se siembra así.
 */
function laIaCierraSinNota(id: number) {
  sql(`begin;
       insert into perfil_talento (postulacion_id, confianza_evidencia, version_pesos_id, actualizado_en, creado_en)
       select p.id, 70, v.version_pesos_id, now(), now()
         from postulacion p join vacante v on v.id = p.vacante_id where p.id = ${id};
       insert into transicion_estado (postulacion_id, estado_anterior_codigo, estado_nuevo_codigo,
                                      es_sistema, aviso_al_candidato, ocurrida_en)
       values (${id}, 'PERFIL_CALIFICANDO', 'PERFIL_POR_CONFIRMAR', true, 'CORREO', now());
       update postulacion set estado_codigo = 'PERFIL_POR_CONFIRMAR', movido_en = now() where id = ${id};
       commit;`)
}

/** Una persona del equipo pone a mano la nota de la abierta: se recalcula y se mira el pase. */
async function ponerLaNota(id: number, puntaje: number) {
  await exigir(`/panel/postulaciones/${id}/evaluacion/respuestas/${respuestaA(id, PREGUNTA_DEL_BANCO)}/nota`, equipo, 'PUT', {
    puntaje,
    motivo: `${MARCA}: la IA no pudo calificarla`,
  })
}

/**
 * Lo último que la auditoría dice de un campo de la vacante, o `siNunca` si nadie lo tocó.
 * Lo que contestó 200 y quedó auditado tiene que ser lo que la vacante guarda (QA-F04).
 */
function ultimoAuditado(accion: string, vacante: number, campo: string, siNunca: unknown): unknown {
  const filas = auditoriasDe(accion, vacante)
  return filas.length ? JSON.parse(String(filas[filas.length - 1]!.despues))[campo] : siNunca
}

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

test.describe('La nota mínima del Perfil Integral para pasar sola a la prueba', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    conPase = await vacanteConBancoYPrueba('Umbral con pase', true)
    sinPase = await vacanteConBancoYPrueba('Umbral sin pase', false)
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('1 · al entregar el banco, el aviso nuevo y ninguna prueba (AC-01)', async ({ page }) => {
    const ana = await cuentaDeCandidato('Ana', correos)
    const uuid = await postular(ana.token, conPase)
    await entrarAlPortalCon(page, ana.token)

    await page.goto(`/procesos/${uuid}/evaluacion`)
    await page.getByRole('button', { name: /Empezar evaluación/ }).click()
    await page.getByLabel('Tu respuesta').fill(RESPUESTA)
    await page.getByRole('button', { name: 'Entregar la evaluación' }).click()
    await page.getByRole('button', { name: 'Entregar', exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`), { timeout: 20_000 })
    await expect(page.getByText(ENTREGADA)).toBeVisible()
    const id = postulacionPorUuid(uuid)
    expect(estadoDeLaPostulacion(id)).toBe('PERFIL_CALIFICANDO')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(0)
  })

  test('2 · con 72,40 pasa sola: la prueba disponible en «Mis procesos» (AC-02, AC-06)', async ({ page }) => {
    const beto = await cuentaDeCandidato('Beto', correos)
    const id = await postularYEntregar(beto.token, conPase)
    laIaCierraSinNota(id)

    await ponerLaNota(id, 72.4)

    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(1)
    expect(String(uno(`select motivo from transicion_estado where postulacion_id = ${id}
                        order by id desc limit 1`).motivo)).toBe(
      'Pase automático tras recalcular: nota 72,40 (mínima 60)',
    )

    await entrarAlPortalCon(page, beto.token)
    await page.goto('/procesos')
    // Por su titular: la región para lectores de pantalla repite el mismo texto
    await expect(page.getByRole('heading', { name: 'Prueba del puesto habilitada' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Abrir prueba' })).toBeVisible()
  })

  test('3 · con 59,99 se queda en revisión, y la ficha del panel dice por qué (AC-03)', async ({ page }) => {
    const caro = await cuentaDeCandidato('Caro', correos)
    const id = await postularYEntregar(caro.token, conPase)
    laIaCierraSinNota(id)

    await ponerLaNota(id, 59.99)

    expect(estadoDeLaPostulacion(id)).toBe('PERFIL_POR_CONFIRMAR')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(0)

    // El portal: en revisión, sin nada que hacer
    await entrarAlPortalCon(page, caro.token)
    await page.goto('/procesos')
    // Exacto y el primero: la región para lectores de pantalla repite el estado dentro de una
    // frase más larga, y el recorrido plegado lo vuelve a titular
    await expect(page.getByText('Tu perfil está en revisión', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Abrir prueba' })).toHaveCount(0)

    // El panel: la ficha explica que no llega a la mínima, junto al estado
    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${conPase}`)
    await page.getByRole('button', { name: /^Toda la tanda/ }).click()
    await page.getByRole('button', { name: 'Caro Preguntas QA' }).click()
    await expect(page.getByText('Nota 59,99: no llega a la mínima de la vacante (60)')).toBeVisible({
      timeout: 20_000,
    })
  })

  test('3b · sin nota completa la ficha lo dice; con el interruptor apagado no explica nada aunque no llegue (AC-04, AC-08)', async ({ page }) => {
    // Cierre de la IA sin nota de la abierta: se queda en revisión, sin prueba
    const dani = await cuentaDeCandidato('Dani', correos)
    const conPaseId = await postularYEntregar(dani.token, conPase)
    laIaCierraSinNota(conPaseId)
    expect(estadoDeLaPostulacion(conPaseId)).toBe('PERFIL_POR_CONFIRMAR')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${conPaseId}`).n)).toBe(0)

    // Sin interruptor, una nota que no llega no se explica: decide el equipo como siempre
    const eli = await cuentaDeCandidato('Eli', correos)
    const sinPaseId = await postularYEntregar(eli.token, sinPase)
    laIaCierraSinNota(sinPaseId)
    await ponerLaNota(sinPaseId, 30)
    expect(estadoDeLaPostulacion(sinPaseId)).toBe('PERFIL_POR_CONFIRMAR')

    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${conPase}`)
    await page.getByRole('button', { name: /^Toda la tanda/ }).click()
    await page.getByRole('button', { name: 'Dani Preguntas QA' }).click()
    await expect(page.getByText('Sin nota completa: revisa el Perfil Integral')).toBeVisible({ timeout: 20_000 })

    await page.goto(`/admin/vacantes/${sinPase}`)
    await page.getByRole('button', { name: /^Toda la tanda/ }).click()
    await page.getByRole('button', { name: 'Eli Preguntas QA' }).click()
    await expect(page.getByText(/^Postuló el .* por confirmar$/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/no llega a la mínima|Sin nota completa/)).toHaveCount(0)
  })

  test('4 · la mínima se cambia en la tuerca, rechaza lo que no es de 0 a 100 y queda auditada (AC-09)', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    const cajon = await abrirLaTuerca(page, conPase)

    await expect(cajon).toContainText('si llega a la nota mínima, pasa a la prueba del puesto')
    const campo = cajon.getByLabel(CAMPO)
    await expect(campo).toHaveValue('60')
    await expect(campo).toBeEnabled()

    // El aspecto del campo editable, para compararlo con el desactivado (test 6)
    fondoEditable = await campo.evaluate((e) => getComputedStyle(e).backgroundColor)

    for (const malo of ['101', '70.5', '-1', '']) {
      await campo.fill(malo)
      await campo.blur()
      await expect(cajon.getByText('Escribe un número de 0 a 100')).toBeVisible()
    }
    expect(auditoriasDe('fijar_nota_minima', conPase)).toHaveLength(0)

    await campo.fill('70')
    await campo.blur()
    await expect.poll(async () => (await vacanteDe(equipo, conPase)).notaMinima, { timeout: 15_000 }).toBe(70)
    const auditadas = auditoriasDe('fijar_nota_minima', conPase)
    expect(auditadas).toHaveLength(1)
    expect(JSON.parse(String(auditadas[0]!.antes)).notaMinima).toBe(60)
    expect(JSON.parse(String(auditadas[0]!.despues)).notaMinima).toBe(70)

    // Con el interruptor apagado se ve, pero desactivado
    const otro = await abrirLaTuerca(page, sinPase)
    await expect(otro.getByLabel(CAMPO)).toHaveValue('60')
    await expect(otro.getByLabel(CAMPO)).toBeDisabled()
  })

  test('5 · si el guardado falla lo dice; con la vacante cerrada el campo no se edita (AC-09, estados de la tuerca)', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    const cajon = await abrirLaTuerca(page, conPase)
    const campo = cajon.getByLabel(CAMPO)
    await expect(campo).toBeEnabled()

    // Otra persona apaga el interruptor mientras esta pantalla sigue abierta: el servidor
    // rechaza la mínima (409) y la tuerca lo dice con el aviso de la configuración
    await exigir(`/panel/vacantes/${conPase}/calificacion-automatica`, equipo, 'POST', { activa: false })
    const antes = auditoriasDe('fijar_nota_minima', conPase).length
    await campo.fill('65')
    await campo.blur()
    await expect(cajon.getByRole('alert').filter({ hasText: 'No se pudo guardar la nota mínima' })).toBeVisible({
      timeout: 15_000,
    })
    expect((await vacanteDe(equipo, conPase)).notaMinima).toBe(70)
    expect(auditoriasDe('fijar_nota_minima', conPase)).toHaveLength(antes)

    // Cerrada, con el interruptor encendido, el campo se ve pero no se edita
    await exigir(`/panel/vacantes/${conPase}/calificacion-automatica`, equipo, 'POST', { activa: true })
    await exigir(`/panel/vacantes/${conPase}/cierre`, equipo, 'POST', { motivo: `${MARCA}: fin de la prueba del umbral` })
    const cerrada = await abrirLaTuerca(page, conPase)
    await expect(cerrada.getByLabel(CAMPO)).toHaveValue('70')
    await expect(cerrada.getByLabel(CAMPO)).toBeDisabled()
  })

  test('6 · desactivado, el campo se ve desactivado y no igual que el editable (AC-09, punto 9 de la spec)', async ({ page }) => {
    // «Apagado, se ve desactivado»: la maqueta aprobada lo pinta en gris. Un `disabled` que se
    // ve igual que el campo editable no se distingue hasta que se intenta escribir en él.
    expect(fondoEditable).not.toBe('')
    await entrarAlPanelCon(page, equipo)
    const apagado = await abrirLaTuerca(page, sinPase)
    const campo = apagado.getByLabel(CAMPO)
    await expect(campo).toBeDisabled()
    expect(await campo.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(fondoEditable)
  })

  test('7 · al apagar el interruptor, el campo enseña la mínima guardada y no lo que se escribió sin guardar (AC-09, QA-F02)', async ({ page }) => {
    // Encendida, se escribe un valor que no vale y no se guarda; luego se apaga el interruptor
    // desde la misma tuerca. El campo, ya en gris, no puede quedarse diciendo «101 / 100»
    // sin aviso: la mínima de la vacante sigue siendo 60.
    await exigir(`/panel/vacantes/${sinPase}/calificacion-automatica`, equipo, 'POST', { activa: true })
    await entrarAlPanelCon(page, equipo)
    const cajon = await abrirLaTuerca(page, sinPase)
    const campo = cajon.getByLabel(CAMPO)
    await expect(campo).toBeEnabled()
    await expect(campo).toHaveValue('60')

    await campo.fill('101')
    await campo.blur()
    await expect(cajon.getByText('Escribe un número de 0 a 100')).toBeVisible()

    await cajon.getByRole('checkbox', { name: /Calificar y avanzar sola/ }).click()
    await expect(campo).toBeDisabled({ timeout: 15_000 })
    await expect(cajon.getByText('Solo se usa con «Calificar y avanzar sola» encendido.')).toBeVisible()
    expect((await vacanteDe(equipo, sinPase)).notaMinima).toBe(60)
    expect(auditoriasDe('fijar_nota_minima', sinPase)).toHaveLength(0)
    await expect(campo).toHaveValue('60')
  })

  test('8 · sin el permiso del interruptor, el campo se ve desactivado y la API lo rechaza (casos límite: sin permiso, QA-F03)', async ({ page }) => {
    // Una cuenta que ve la vacante pero no puede configurarla: sin `editar_vacante` ni
    // `elegir_plantilla_evaluacion` (el permiso del interruptor y de la mínima). Spec, casos
    // límite: «el campo se ve desactivado y la API responde como el interruptor».
    await exigir(`/panel/vacantes/${sinPase}/calificacion-automatica`, equipo, 'POST', { activa: true })
    const sinPermiso = await tokenDePanel(
      sembrarEquipoSin('umbral-sin-config', ['editar_vacante', 'elegir_plantilla_evaluacion']),
    )

    const antes = auditoriasDe('fijar_nota_minima', sinPase).length
    expect((await pedir(`/panel/vacantes/${sinPase}/nota-minima`, sinPermiso, 'PUT', { notaMinima: 50 })).estado).toBe(403)
    expect((await pedir(`/panel/vacantes/${sinPase}/calificacion-automatica`, sinPermiso, 'POST', { activa: false })).estado).toBe(403)
    expect((await vacanteDe(equipo, sinPase)).notaMinima).toBe(60)
    expect(auditoriasDe('fijar_nota_minima', sinPase)).toHaveLength(antes)

    await entrarAlPanelCon(page, sinPermiso)
    const cajon = await abrirLaTuerca(page, sinPase)
    await expect(cajon.getByLabel(CAMPO)).toHaveValue('60')
    await expect(cajon.getByLabel(CAMPO)).toBeDisabled()
  })

  test('9 · escribir la mínima y apagar el interruptor en el mismo gesto no pierde ninguno de los dos cambios (AC-09, casos límite: se apaga el interruptor, QA-F04)', async ({ page }) => {
    // El campo se guarda al salir, y salir es pulsar el interruptor que tiene encima: las dos
    // peticiones salen juntas. Lo que cada una contesta con 200 y audita tiene que quedar; si
    // una pisa a la otra, o la mínima no se guarda o el pase sigue encendido tras «apagarlo».
    await exigir(`/panel/vacantes/${sinPase}/calificacion-automatica`, equipo, 'POST', { activa: true })
    await entrarAlPanelCon(page, equipo)
    const cajon = await abrirLaTuerca(page, sinPase)
    const campo = cajon.getByLabel(CAMPO)
    const interruptor = cajon.getByRole('checkbox', { name: /Calificar y avanzar sola/ })
    await expect(campo).toBeEnabled()
    const nueva = (await campo.inputValue()) === '70' ? 71 : 70

    const laMinima = page.waitForResponse(
      (r) => r.url().endsWith(`/vacantes/${sinPase}/nota-minima`) && r.request().method() === 'PUT',
    )
    const elInterruptor = page.waitForResponse(
      (r) => r.url().endsWith(`/vacantes/${sinPase}/calificacion-automatica`) && r.request().method() === 'POST',
    )
    await campo.fill(String(nueva))
    await interruptor.click()
    const [minima, apagado] = await Promise.all([laMinima, elInterruptor])

    const vacante = await vacanteDe(equipo, sinPase)
    const cuenta = `mínima ${minima.status()}, interruptor ${apagado.status()}`
    if (apagado.status() === 200) expect(vacante.calificacionAutomatica, cuenta).toBe(false)
    if (minima.status() === 200) expect(vacante.notaMinima, cuenta).toBe(nueva)
    expect(vacante.calificacionAutomatica, cuenta).toBe(
      ultimoAuditado('activar_calificacion_automatica', sinPase, 'calificacionAutomatica', false),
    )
    expect(vacante.notaMinima, cuenta).toBe(ultimoAuditado('fijar_nota_minima', sinPase, 'notaMinima', 60))
    await expect(interruptor).toBeChecked({ checked: vacante.calificacionAutomatica, timeout: 15_000 })
  })

  test('10 · la mínima y el interruptor a la vez por la API: lo que contesta 200 y se audita es lo que queda (AC-09, QA-F04)', async () => {
    // Dos personas, o dos pestañas, tocando la misma vacante. Cada intento parte del pase
    // encendido; la mínima puede llegar antes (200) o después del apagado (409), pero nunca
    // contestar 200, quedar auditada y no estar.
    for (let intento = 1; intento <= 5; intento++) {
      await exigir(`/panel/vacantes/${sinPase}/calificacion-automatica`, equipo, 'POST', { activa: true })
      const nueva = 60 + intento
      const [minima, apagado] = await Promise.all([
        pedir(`/panel/vacantes/${sinPase}/nota-minima`, equipo, 'PUT', { notaMinima: nueva }),
        pedir(`/panel/vacantes/${sinPase}/calificacion-automatica`, equipo, 'POST', { activa: false }),
      ])
      const vacante = await vacanteDe(equipo, sinPase)
      const cuenta = `intento ${intento}: mínima ${minima.estado}, interruptor ${apagado.estado}`
      if (apagado.estado === 200) expect(vacante.calificacionAutomatica, cuenta).toBe(false)
      if (minima.estado === 200) expect(vacante.notaMinima, cuenta).toBe(nueva)
      expect(vacante.calificacionAutomatica, cuenta).toBe(
        ultimoAuditado('activar_calificacion_automatica', sinPase, 'calificacionAutomatica', false),
      )
      expect(vacante.notaMinima, cuenta).toBe(ultimoAuditado('fijar_nota_minima', sinPase, 'notaMinima', 60))
    }
  })

  test('11 · escribir la mínima y elegir de dónde salen las preguntas en el mismo gesto no pierde la mínima (AC-09, QA-F05)', async ({ page }) => {
    // La tuerca tiene más guardados que el interruptor: justo debajo de la mínima está «De dónde
    // salen sus preguntas», y elegir una opción es salir del campo. En borrador se elige libre,
    // y es cuando se monta la vacante de arriba abajo.
    const borrador = await crearVacante(equipo, 'Umbral en borrador', await lugarDe(equipo))
    await exigir(`/panel/vacantes/${borrador}/calificacion-automatica`, equipo, 'POST', { activa: true })
    await entrarAlPanelCon(page, equipo)
    const cajon = await abrirLaTuerca(page, borrador)
    const campo = cajon.getByLabel(CAMPO)
    await expect(campo).toBeEnabled()
    const sinEvaluacion = cajon.getByRole('radio', { name: 'Sin evaluación' })
    const opcion = (await sinEvaluacion.isChecked()) ? 'Preguntas propias de esta vacante' : 'Sin evaluación'

    const laMinima = page.waitForResponse(
      (r) => r.url().endsWith(`/vacantes/${borrador}/nota-minima`) && r.request().method() === 'PUT',
    )
    const elOrigen = page.waitForResponse(
      (r) => r.url().endsWith(`/vacantes/${borrador}/origen-preguntas`) && r.request().method() === 'POST',
    )
    await campo.fill('70')
    await cajon.getByText(opcion, { exact: true }).click()
    const [minima, origen] = await Promise.all([laMinima, elOrigen])

    const vacante = await vacanteDe(equipo, borrador)
    const cuenta = `mínima ${minima.status()}, origen ${origen.status()}`
    if (minima.status() === 200) expect(vacante.notaMinima, cuenta).toBe(70)
    expect(vacante.notaMinima, cuenta).toBe(ultimoAuditado('fijar_nota_minima', borrador, 'notaMinima', 60))
    if (origen.status() === 200) {
      expect(vacante.aplicaEvaluacion ? vacante.origenPreguntas : 'SIN_EVALUACION', cuenta).toBe(
        ultimoAuditado('elegir_origen_preguntas', borrador, 'origen', null),
      )
    }
    // Sin recargar, el campo acaba enseñando lo que la vacante guarda: si la mínima se perdiera,
    // seguiría diciendo 70 sobre una vacante con 60
    await expect(campo).toHaveValue(String(vacante.notaMinima), { timeout: 15_000 })
    // Y tras recargar, igual
    await page.reload()
    const otraVez = await abrirLaTuerca(page, borrador)
    await expect(otraVez.getByLabel(CAMPO)).toHaveValue(String(vacante.notaMinima))
  })

  test('12 · la mínima o el interruptor a la vez que otro guardado de la vacante: lo que contesta 200 y se audita es lo que queda (AC-09, casos límite: se apaga el interruptor, QA-F05)', async () => {
    // El bloqueo de QA-F04 solo ordena a la mínima y al interruptor entre sí. Otro guardado de la
    // misma vacante (aquí, de dónde salen las preguntas, en la misma tuerca) que la lea sin
    // bloquear la reescribe entera al confirmar: con la mínima vieja, o con el pase encendido.
    const borrador = await crearVacante(equipo, 'Umbral carrera con el origen', await lugarDe(equipo))
    const elOtroOrigen = async () =>
      (await vacanteDe(equipo, borrador)).aplicaEvaluacion ? 'SIN_EVALUACION' : 'VACANTE'
    for (let intento = 1; intento <= 3; intento++) {
      await exigir(`/panel/vacantes/${borrador}/calificacion-automatica`, equipo, 'POST', { activa: true })
      const nueva = 60 + intento
      // El origen se decide antes: las dos peticiones tienen que salir a la vez
      let origen = await elOtroOrigen()
      const [minima, conLaMinima] = await Promise.all([
        pedir(`/panel/vacantes/${borrador}/nota-minima`, equipo, 'PUT', { notaMinima: nueva }),
        pedir(`/panel/vacantes/${borrador}/origen-preguntas`, equipo, 'POST', { origen }),
      ])
      let vacante = await vacanteDe(equipo, borrador)
      let cuenta = `intento ${intento}: mínima ${minima.estado}, origen ${conLaMinima.estado}`
      if (minima.estado === 200) expect(vacante.notaMinima, cuenta).toBe(nueva)
      expect(vacante.notaMinima, cuenta).toBe(ultimoAuditado('fijar_nota_minima', borrador, 'notaMinima', 60))

      origen = await elOtroOrigen()
      const [apagado, conElApagado] = await Promise.all([
        pedir(`/panel/vacantes/${borrador}/calificacion-automatica`, equipo, 'POST', { activa: false }),
        pedir(`/panel/vacantes/${borrador}/origen-preguntas`, equipo, 'POST', { origen }),
      ])
      vacante = await vacanteDe(equipo, borrador)
      cuenta = `intento ${intento}: interruptor ${apagado.estado}, origen ${conElApagado.estado}`
      if (apagado.estado === 200) expect(vacante.calificacionAutomatica, cuenta).toBe(false)
      expect(vacante.calificacionAutomatica, cuenta).toBe(
        ultimoAuditado('activar_calificacion_automatica', borrador, 'calificacionAutomatica', false),
      )
    }
  })
})
