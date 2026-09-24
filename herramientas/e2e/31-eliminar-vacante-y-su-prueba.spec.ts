import { expect } from '@playwright/test'

import { entrarAlPortal } from './ayuda'
import { CLAVE_DE_CANDIDATO, test, tokenDelCandidato } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  eliminadaEn,
  estadoDeLaPostulacion,
  MARCA,
  pedirAlPanel,
  pedirAlPortal,
  retirarLoSembrado,
  sembrarEscenario,
  type Escenario,
  type Persona,
} from './ayuda-eliminar-vacante'

/**
 * Eliminar una vacante también retira **la prueba del puesto** de quien estaba
 * dentro, en las dos puertas que siguen abiertas después: el enlace del portal
 * y el plazo de cada persona en el panel.
 *
 * Es la regresión de dos hallazgos de QA (ciclo 2, qaVersion d055b118…):
 *
 *   1. En el portal, `/procesos/{uuid}` ya decía «Esta vacante ya no está
 *      disponible», pero `/procesos/{uuid}/prueba` —el enlace de los correos y
 *      del historial del navegador— seguía enseñando la prueba con su reloj, y
 *      `POST /portal/prueba/{uuid}/inicio` la dejaba empezar. Solo la entrega
 *      fallaba, con el texto crudo de la máquina de estados.
 *   2. En el panel, `POST /panel/postulaciones/{id}/prueba/plazo` seguía
 *      moviendo la fecha de una postulación de la vacante eliminada —y dejaba
 *      auditoría—, cuando la de la vacante (`/cierre-prueba`) ya contestaba 404.
 *
 * ⚠️ **ESCRIBE**: reutiliza el terreno de `ayuda-eliminar-vacante` —sus
 * vacantes marcadas y sus cuentas— y le añade un intento de prueba a la persona
 * que está en su turno de la prueba. Ese intento se borra al terminar, antes de
 * que `retirarLoSembrado` retire lo demás.
 *
 * Antes de eliminar se comprueba que el terreno sirve —la prueba se abre y su
 * plazo se lee—, para que los 404 de después solo puedan venir de la
 * eliminación y no de una siembra rota. Las dos pruebas miran cada una su
 * puerta y no dependen entre sí: un fallo en una no esconde la otra.
 */

let escenario: Escenario
let enLaPrueba: Persona
let intentoId: number

/** El intento de prueba de esa postulación, como está en la base. */
function elIntento(): { vence_en: string | null; iniciado_en: string | null; plazo_propio: boolean } {
  return JSON.parse(
    sql(`select row_to_json(i) from (select vence_en, iniciado_en, plazo_propio
                                       from intento_prueba where id = ${intentoId}) i;`),
  )
}

/**
 * Los intentos de prueba de las postulaciones del terreno marcado, y solo esos.
 * Los de cualquier otra vacante no se tocan.
 */
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

const plazosAnotadosDe = (id: number): number =>
  Number(sql(`select count(*) from auditoria
               where accion = 'definir_plazo_prueba' and entidad = 'intento_prueba'
                 and entidad_id = ${id};`))

test.describe('Eliminar una vacante retira también su prueba del puesto', () => {
  test.beforeAll(async () => {
    // Un intento que dejara una ejecución muerta a mitad impediría a
    // `retirarLoSembrado` quitar su postulación (clave ajena): se quita antes.
    quitarIntentosSembrados()
    escenario = await sembrarEscenario()
    // La que está en «su turno de la prueba» es la que tiene un examen abierto.
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

    // El terreno sirve: antes de eliminar, la prueba se abre y su plazo se lee.
    const token = await tokenDelCandidato(enLaPrueba.correo, CLAVE_DE_CANDIDATO)
    const prueba = await pedirAlPortal(`/prueba/${enLaPrueba.uuid}`, token)
    expect(prueba.estado, JSON.stringify(prueba.cuerpo)).toBe(200)
    const plazo = await pedirAlPanel(`/postulaciones/${enLaPrueba.postulacionId}/prueba/plazo`)
    expect(plazo.estado, JSON.stringify(plazo.cuerpo)).toBe(200)
    expect((plazo.cuerpo as { existeIntento: boolean }).existeIntento).toBe(true)

    const eliminada = await pedirAlPanel(`/vacantes/${escenario.objetivo}`, {
      metodo: 'DELETE',
      cuerpo: { motivo: 'Se creó con la prueba equivocada' },
    })
    expect(eliminada.estado, JSON.stringify(eliminada.cuerpo)).toBe(200)
    expect(eliminadaEn(escenario.objetivo)).not.toBeNull()
    expect(estadoDeLaPostulacion(enLaPrueba.postulacionId)).toBe('CERRADA')
  })

  test.afterAll(() =>
    limpiarSiempre([
      () => quitarIntentosSembrados(),
      () => retirarLoSembrado(escenario?.correos ?? []),
    ]))

  test('eliminada la vacante, su prueba ya no se abre en el portal ni se puede empezar', async ({
    page,
  }) => {
    const antes = elIntento()

    // Por la API: la misma respuesta que su proceso, que ya no existe.
    const token = await tokenDelCandidato(enLaPrueba.correo, CLAVE_DE_CANDIDATO)
    const verla = await pedirAlPortal(`/prueba/${enLaPrueba.uuid}`, token)
    expect(verla.estado, JSON.stringify(verla.cuerpo)).toBe(404)
    const empezarla = await pedirAlPortal(`/prueba/${enLaPrueba.uuid}/inicio`, token, {
      metodo: 'POST',
    })
    expect(empezarla.estado, JSON.stringify(empezarla.cuerpo)).toBe(404)
    expect(elIntento().iniciado_en, 'nadie empezó el examen de una vacante retirada')
      .toBe(antes.iniciado_en)

    // Y por el enlace que tiene en sus correos: dice lo que pasó, sin reloj ni botón.
    await entrarAlPortal(page, enLaPrueba.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${enLaPrueba.uuid}/prueba`)
    await expect(page.getByRole('heading', { name: /Esta vacante ya no está disponible/ }))
      .toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Entregar prueba' })).toHaveCount(0)
  })

  test('eliminada la vacante, el plazo de quien estaba dentro ya no se mueve desde el panel', async () => {
    const antes = elIntento()
    const anotadosAntes = plazosAnotadosDe(intentoId)

    const mover = await pedirAlPanel(`/postulaciones/${enLaPrueba.postulacionId}/prueba/plazo`, {
      metodo: 'POST',
      cuerpo: {
        venceEn: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        motivo: 'Más días para una vacante que ya no existe',
      },
    })
    // El mismo 404 que la fecha de la vacante (`/cierre-prueba`) y que mover la
    // postulación: una eliminada no existe para nadie.
    expect(mover.estado, JSON.stringify(mover.cuerpo)).toBe(404)
    expect(elIntento()).toEqual(antes)
    expect(plazosAnotadosDe(intentoId), 'no queda auditoría de un cambio que no se hizo')
      .toBe(anotadosAntes)

    const deLaVacante = await pedirAlPanel(`/vacantes/${escenario.objetivo}/cierre-prueba`, {
      metodo: 'POST',
      cuerpo: { cierraEn: null, motivo: 'Tampoco la de la vacante' },
    })
    expect(deLaVacante.estado).toBe(404)
    expect(elIntento().vence_en).toBe(antes.vence_en)
  })
})
