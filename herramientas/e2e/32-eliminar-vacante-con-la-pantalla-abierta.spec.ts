import { expect } from '@playwright/test'

import { entrarAlPortal } from './ayuda'
import { CLAVE_DE_CANDIDATO, test } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  eliminadaEn,
  estadoDeLaPostulacion,
  MARCA,
  pedirAlPanel,
  retirarLoSembrado,
  sembrarEscenario,
  sembrarVacantePropia,
  type Escenario,
  type Persona,
} from './ayuda-eliminar-vacante'

/**
 * Eliminar una vacante **mientras el candidato tiene abierta** una pantalla de
 * su proceso —la prueba del puesto, la evaluación del banco, el cuestionario
 * técnico o las fechas de la simulación—.
 *
 * Es la regresión de un hallazgo de QA (ciclo 3, qaVersion f4127ec8…). Al
 * recargar, las cuatro pantallas ya dicen «Esta vacante ya no está disponible»,
 * pero la que estaba abierta desde antes solo lo sabe si su botón lo pregunta:
 *
 *   - La prueba del puesto sí: «Sí, empezar» recibe el 404, cierra el diálogo y
 *     vuelve a preguntar, así que la pantalla lo dice. Se deja como control.
 *   - La evaluación no: «Empezar evaluación» recibía el mismo 404 y no pasaba
 *     nada —ni mensaje ni cambio—; el botón seguía ahí, y así hasta que la
 *     pestaña volviera a tener el foco o se recargara. Y ya empezada, cada
 *     respuesta quedaba en «No se pudo guardar» sin decir por qué.
 *   - El cuestionario técnico tampoco: «Empezar la prueba» enseñaba el texto
 *     crudo del servidor, «Postulación not found with código…».
 *   - Las fechas de la simulación, con la lista abierta, tampoco lo decían al
 *     confirmar.
 *
 * ⚠️ **La vacante se elimina por la API sin salir de la página.** Cambiar de
 * pestaña para eliminarla desde el panel dispara la recarga al volver
 * (`refetchOnWindowFocus`), y eso esconde justo lo que se prueba aquí.
 *
 * ⚠️ **ESCRIBE**: reutiliza el terreno de `ayuda-eliminar-vacante` y le añade
 * un intento de prueba a quien está en su turno de la prueba (en la vacante
 * objetivo) y, a la cuenta «tarde», una postulación en cada una de cuatro
 * vacantes marcadas: su evaluación sin empezar, su evaluación que se empieza
 * aquí, su cuestionario técnico y su turno de elegir fecha, con una sesión de
 * simulación propia. **Cada vacante que se elimina lleva su propia solicitud**
 * (`sembrarVacantePropia`): la de `viva` es la de la primera vacante del clon, y
 * eliminarla la reabriría. Cada prueba elimina su propia vacante; los intentos y
 * la sesión se quitan al terminar y el resto lo retira `retirarLoSembrado`.
 */

/** El lugar por el que se reconoce —y se retira— la sesión de simulación sembrada. */
const LUGAR_DE_LA_SESION = `${MARCA} Sala de la simulación`

interface ConSuVacante { vacanteId: number; uuid: string }

let escenario: Escenario
let enLaPrueba: Persona
let intentoId: number
let conEvaluacion: ConSuVacante & { evaluacionId: number }
let conEvaluacionEnCurso: ConSuVacante & { evaluacionId: number }
let conCuestionario: ConSuVacante & { evaluacionId: number }
let conFechas: ConSuVacante & { sesionId: number }

/** Los intentos de prueba del terreno marcado, y solo esos. */
function quitarIntentosSembrados(): void {
  const suyos = `(select i.id from intento_prueba i
                    join postulacion p on p.id = i.postulacion_id
                    join vacante v on v.id = p.vacante_id
                   where v.titulo like ${literal(`${MARCA}%`)})`
  sql(`begin;
       delete from respuesta_prueba where intento_prueba_id in ${suyos};
       delete from entregable where intento_prueba_id in ${suyos};
       delete from intento_prueba where id in ${suyos};
       commit;`)
}

/**
 * La sesión de simulación sembrada. Va después de `retirarLoSembrado`, que quita
 * su enlace con la vacante; lo que la sujete todavía (una inscripción de una
 * ejecución que murió a mitad) se quita antes.
 */
function quitarSesionSembrada(): void {
  const suyas = `(select id from sesion_simulacion where lugar = ${literal(LUGAR_DE_LA_SESION)})`
  sql(`begin;
       delete from inscripcion_sesion where sesion_simulacion_id in ${suyas};
       delete from sesion_vacante where sesion_simulacion_id in ${suyas};
       delete from sesion_simulacion where id in ${suyas};
       commit;`)
}

const iniciadoEn = (tabla: 'intento_prueba' | 'evaluacion', id: number, columna: string): string =>
  sql(`select coalesce(${columna}::text, '') from ${tabla} where id = ${id};`)

const cuantas = (consulta: string): number => Number(sql(consulta))

async function eliminar(vacanteId: number, motivo: string): Promise<void> {
  const r = await pedirAlPanel(`/vacantes/${vacanteId}`, { metodo: 'DELETE', cuerpo: { motivo } })
  expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
  expect(eliminadaEn(vacanteId)).not.toBeNull()
}

/** Una postulación de la cuenta «tarde» en su vacante, en ese estado. */
function postularATarde(vacanteId: number, estado: string): { id: number; uuid: string } {
  const fila = JSON.parse(sql(`
    with po as (
      insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
      select v.organizacion_id, ${escenario.tarde.usuarioId}, v.id, ${literal(estado)}
        from vacante v where v.id = ${vacanteId}
      returning id, uuid)
    select row_to_json(po) from po;`)) as { id: number; uuid: string }
  return { id: Number(fila.id), uuid: String(fila.uuid) }
}

test.describe('Eliminar una vacante con la pantalla del candidato abierta', () => {
  test.beforeAll(async () => {
    quitarIntentosSembrados()
    escenario = await sembrarEscenario()
    quitarSesionSembrada()

    // La prueba del puesto, sin abrir, de quien está en su turno (vacante objetivo).
    enLaPrueba = escenario.enCarrera[1]
    expect(estadoDeLaPostulacion(enLaPrueba.postulacionId)).toBe('PRUEBA_TURNO_CANDIDATO')
    intentoId = Number(sql(`
      with f as (
        insert into intento_prueba (postulacion_id, version_plantilla_prueba_id, vence_en,
                                    es_entrega_automatica, plazo_propio)
        select ${enLaPrueba.postulacionId}, v.id, date_trunc('hour', now()) + interval '7 days',
               false, false
          from version_plantilla_prueba v
         where v.estado = 'PUBLICADA' and v.modalidad = 'CRONOMETRADA'
         order by v.id limit 1
        returning id)
      select coalesce(max(id), 0) from f;`))
    expect(intentoId, 'hace falta una versión de prueba publicada en el clon').toBeGreaterThan(0)

    // Dos evaluaciones del banco, PENDIENTES, de la cuenta que aún no había postulado:
    // una se abre sin empezar y la otra se empieza con la vacante viva. Se copia la
    // plantilla de una evaluación que ya exista en el clon.
    const modelo = JSON.parse(sql(`
      select coalesce(row_to_json(e)::text, 'null') from (
        select plantilla_evaluacion_id, version_banco_nivel_id from evaluacion
         where proposito = 'PERFIL_INTEGRAL' and plantilla_evaluacion_id is not null
         order by id limit 1) e;`)) as { plantilla_evaluacion_id: number; version_banco_nivel_id: number } | null
    expect(modelo, 'hace falta una evaluación del banco en el clon de la que copiar la plantilla')
      .not.toBeNull()

    const conSuEvaluacion = (titulo: string, proposito: 'PERFIL_INTEGRAL' | 'CUESTIONARIO_TECNICO') => {
      const vacanteId = sembrarVacantePropia(`${MARCA} ${titulo}`,
        proposito === 'CUESTIONARIO_TECNICO' ? 'CUESTIONARIO_TECNICO' : 'PLANTILLA')
      const postulacion = postularATarde(vacanteId,
        proposito === 'CUESTIONARIO_TECNICO' ? 'PRUEBA_TURNO_CANDIDATO' : 'PERFIL_TURNO_CANDIDATO')
      const columna = proposito === 'CUESTIONARIO_TECNICO' ? 'evaluacion_tecnica_id' : 'evaluacion_id'
      // El cuestionario saca sus preguntas de la misma versión del banco que la
      // evaluación copiada: la portada solo necesita que las haya.
      const evaluacionId = Number(sql(`
        with ev as (
          insert into evaluacion (organizacion_id, usuario_id, plantilla_evaluacion_id,
                                  version_banco_nivel_id, estado, vence_en, proposito)
          select v.organizacion_id, ${escenario.tarde.usuarioId},
                 ${proposito === 'PERFIL_INTEGRAL' ? modelo!.plantilla_evaluacion_id : 'null'},
                 ${modelo!.version_banco_nivel_id}, 'PENDIENTE', now() + interval '7 days',
                 ${literal(proposito)}
            from vacante v where v.id = ${vacanteId}
          returning id),
        po as (update postulacion set ${columna} = (select id from ev)
                where id = ${postulacion.id} returning ${columna})
        select ${columna} from po;`))
      return { vacanteId, uuid: postulacion.uuid, evaluacionId }
    }
    conEvaluacion = conSuEvaluacion('Con la evaluación abierta', 'PERFIL_INTEGRAL')
    conEvaluacionEnCurso = conSuEvaluacion('Con la evaluación en curso', 'PERFIL_INTEGRAL')
    conCuestionario = conSuEvaluacion('Con el cuestionario técnico abierto', 'CUESTIONARIO_TECNICO')

    // El turno de elegir fecha, con una sesión propia publicada y con cupo.
    const vacanteDeLasFechas = sembrarVacantePropia(`${MARCA} Con las fechas abiertas`)
    const conSuTurno = postularATarde(vacanteDeLasFechas, 'SIMULACION_TURNO_CANDIDATO')
    const sesionId = Number(sql(`
      with s as (
        insert into sesion_simulacion (organizacion_id, fecha_hora, duracion_minutos, modalidad,
                                       lugar, cupo, estado, creada_por_usuario_id)
        select v.organizacion_id, date_trunc('hour', now()) + interval '5 days', 90, 'GRUPAL',
               ${literal(LUGAR_DE_LA_SESION)}, 5, 'PUBLICADA', v.responsable_usuario_id
          from vacante v where v.id = ${vacanteDeLasFechas}
        returning id),
      sv as (insert into sesion_vacante (sesion_simulacion_id, vacante_id)
             select id, ${vacanteDeLasFechas} from s returning sesion_simulacion_id)
      select sesion_simulacion_id from sv;`))
    conFechas = { vacanteId: vacanteDeLasFechas, uuid: conSuTurno.uuid, sesionId }
  })

  test.afterAll(() =>
    limpiarSiempre([
      () => quitarIntentosSembrados(),
      () => retirarLoSembrado(escenario?.correos ?? []),
      () => quitarSesionSembrada(),
    ]))

  test('con la prueba abierta, «Sí, empezar» tras eliminar dice que la vacante ya no está', async ({
    page,
  }) => {
    await entrarAlPortal(page, enLaPrueba.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${enLaPrueba.uuid}/prueba`)
    await page.getByRole('button', { name: 'Empezar prueba' }).click()
    await expect(page.getByRole('dialog').filter({ hasText: '¿Empezar ahora?' })).toBeVisible()

    await eliminar(escenario.objetivo, 'Se eliminó con la prueba abierta')
    await page.getByRole('button', { name: 'Sí, empezar' }).click()

    await expect(page.getByRole('heading', { name: /Esta vacante ya no está disponible/ }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Entregar prueba' })).toHaveCount(0)
    expect(iniciadoEn('intento_prueba', intentoId, 'iniciado_en'), 'el reloj no arrancó').toBe('')
  })

  test('con la evaluación abierta, «Empezar evaluación» tras eliminar dice que la vacante ya no está', async ({
    page,
  }) => {
    await entrarAlPortal(page, escenario.tarde.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${conEvaluacion.uuid}/evaluacion`)
    const empezar = page.getByRole('button', { name: 'Empezar evaluación' })
    await expect(empezar).toBeVisible()

    await eliminar(conEvaluacion.vacanteId, 'Se eliminó con la evaluación abierta')
    const inicio = page.waitForResponse((r) =>
      r.url().endsWith(`/portal/evaluacion/${conEvaluacion.uuid}/inicio`))
    await empezar.click()
    // El backend ya cerró la puerta: el 404 llega; lo que falta es que la pantalla lo diga.
    expect((await inicio).status()).toBe(404)

    await expect(page.getByRole('heading', { name: /Esta vacante ya no está disponible/ }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Empezar evaluación' })).toHaveCount(0)
    expect(iniciadoEn('evaluacion', conEvaluacion.evaluacionId, 'iniciada_en'),
      'la evaluación de una vacante retirada no se empezó').toBe('')
  })

  test('con la evaluación en curso, responder tras eliminar dice que la vacante ya no está, no «No se pudo guardar»', async ({
    page,
  }) => {
    await entrarAlPortal(page, escenario.tarde.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${conEvaluacionEnCurso.uuid}/evaluacion`)
    // Se empieza con la vacante viva: el orden de las preguntas queda armado.
    await page.getByRole('button', { name: 'Empezar evaluación' }).click()
    await expect(page.getByText(/Pregunta 1 de \d+/)).toBeVisible()
    expect(iniciadoEn('evaluacion', conEvaluacionEnCurso.evaluacionId, 'iniciada_en')).not.toBe('')

    await eliminar(conEvaluacionEnCurso.vacanteId, 'Se eliminó con la evaluación en curso')
    // La primera pregunta del banco se contesta escribiendo. Hay que llenar todos sus
    // datos: una respuesta a medias no sale a guardarse, a propósito (ver `escribir`).
    const guardado = page.waitForResponse((r) =>
      r.url().includes(`/portal/evaluacion/${conEvaluacionEnCurso.uuid}/respuestas/`)
      && r.request().method() === 'PUT')
    const cajas = await page.locator('main').getByRole('textbox').all()
    expect(cajas.length, 'la primera pregunta se contesta escribiendo').toBeGreaterThan(0)
    for (const caja of cajas) await caja.fill('4')
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
    expect((await guardado).status()).toBe(404)

    await expect(page.getByRole('heading', { name: /Esta vacante ya no está disponible/ }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('No se pudo guardar')).toHaveCount(0)
    expect(cuantas(`select count(*) from respuesta
                     where evaluacion_id = ${conEvaluacionEnCurso.evaluacionId};`),
      'la respuesta a una vacante retirada no se guardó').toBe(0)
  })

  test('con el cuestionario técnico abierto, «Empezar la prueba» tras eliminar dice que la vacante ya no está', async ({
    page,
  }) => {
    await entrarAlPortal(page, escenario.tarde.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${conCuestionario.uuid}/prueba-tecnica`)
    const empezar = page.getByRole('button', { name: 'Empezar la prueba' })
    await expect(empezar).toBeVisible()

    await eliminar(conCuestionario.vacanteId, 'Se eliminó con el cuestionario técnico abierto')
    const inicio = page.waitForResponse((r) =>
      r.url().endsWith(`/portal/cuestionario-tecnico/${conCuestionario.uuid}/inicio`))
    await empezar.click()
    expect((await inicio).status()).toBe(404)

    await expect(page.getByRole('heading', { name: /Esta vacante ya no está disponible/ }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Empezar la prueba' })).toHaveCount(0)
    // El texto del servidor no se le enseña a nadie.
    await expect(page.getByText(/not found/)).toHaveCount(0)
    expect(iniciadoEn('evaluacion', conCuestionario.evaluacionId, 'iniciada_en'),
      'el cuestionario de una vacante retirada no se empezó').toBe('')
  })

  test('con las fechas de la simulación abiertas, «Confirmar asistencia» tras eliminar dice que la vacante ya no está', async ({
    page,
  }) => {
    await entrarAlPortal(page, escenario.tarde.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${conFechas.uuid}/simulacion`)
    await expect(page.getByRole('heading', { name: 'Elige tu fecha.' })).toBeVisible()
    await page.getByText(LUGAR_DE_LA_SESION).click()
    await expect(page.getByRole('radio')).toBeChecked()

    await eliminar(conFechas.vacanteId, 'Se eliminó con las fechas de la simulación abiertas')
    const confirmacion = page.waitForResponse((r) =>
      r.url().endsWith(`/portal/simulacion/${conFechas.uuid}/sesiones/${conFechas.sesionId}`)
      && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Confirmar asistencia' }).click()
    expect((await confirmacion).status()).toBe(404)

    await expect(page.getByRole('heading', { name: /Esta vacante ya no está disponible/ }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Confirmar asistencia' })).toHaveCount(0)
    await expect(page.getByText(/not found/)).toHaveCount(0)
    expect(cuantas(`select count(*) from inscripcion_sesion
                     where sesion_simulacion_id = ${conFechas.sesionId};`),
      'nadie quedó inscrito en la sesión de una vacante retirada').toBe(0)
  })
})
