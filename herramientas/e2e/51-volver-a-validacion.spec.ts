import { expect, test } from '@playwright/test'
import { EQUIPO, corte, entrarAlPanel, filasDelRanking, pestana } from './ayuda'
import { apiPanel, detalleDe } from './ayuda-configuracion'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { borrarCuentasDePrueba } from './limpieza-cuentas'

/**
 * Volver a Validación con «Avanzar» sin quedarse atascada.
 *
 * Hasta octubre de 2026, a quien se retrocedía después de iniciar su periodo de
 * validación y se volvía a avanzar le salía «No avanzaron: … (ya existe un
 * registro con postulacion_id X)» y se quedaba en Simulación: el periodo se
 * creaba a ciegas y chocaba con el que ya tenía. Ahora se reutiliza tal cual y la
 * persona entra al paso que le corresponde —con el periodo en curso, a su
 * turno— y el historial de la ficha lo explica con una coletilla.
 *
 * ⚠️ **Este archivo ESCRIBE**, y sobre terreno propio: una vacante con una sola
 * postulación, las dos sembradas aquí y reconocibles por su marca. Lo avanzado no
 * se puede borrar (las transiciones son inmutables, V6): la cuenta se retira del
 * camino y la vacante se marca eliminada, el mismo trato que `09-avance`.
 *
 * El retroceso se prepara por la API porque el panel no ofrece ninguna forma de
 * hacerlo; es justo como le pasó a la persona real.
 */

const MARCA = 'QA-VALIDACION-51'
const TITULO = `${MARCA} Volver a validación`
const TEXTO_SEMBRADO = 'Sembrada por la prueba de volver a validación (51-volver-a-validacion)'
const PREFIJO_CORREO = 'e2e.validacion51'
const NOMBRE = 'Valeria'
const APELLIDOS = 'Vuelve QA'
const NOMBRE_COMPLETO = `${NOMBRE} ${APELLIDOS}`
const MOTIVO = 'Vuelve tras revisar su simulación'
const COLETILLA = 'su periodo de validación ya estaba en curso'

type Fila = Record<string, string | number | null>

const filas = (consulta: string): Fila[] =>
  JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]

function unaFila(consulta: string): Fila {
  const halladas = filas(consulta)
  if (halladas.length !== 1) throw new Error(`Se esperaba una fila y llegaron ${halladas.length}: ${consulta}`)
  return halladas[0]!
}

/** El id de lo insertado. El `with` va arriba del todo: Postgres no admite un INSERT en una subconsulta. */
function idInsertado(insercion: string): number {
  const creadas = JSON.parse(sql(`with f as (${insercion}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (creadas.length !== 1) throw new Error(`La inserción devolvió ${creadas.length} filas: ${insercion}`)
  return Number(creadas[0]!.id)
}

const estadoDe = (postulacion: number): string =>
  String(unaFila(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo)

/** El periodo entero, tal como está guardado: tiene que ser idéntico antes y después. */
const periodoDe = (postulacion: number): Fila =>
  unaFila(`select id, modalidad, tipo_vinculacion, dias, inicio_en, fin_en, estado,
                  habilitada_por_usuario_id, responsable_usuario_id, creado_en
             from validacion where postulacion_id = ${postulacion}`)

/** Una escritura del panel que tiene que salir bien para que haya algo que probar. */
async function enviar(camino: string, cuerpo?: unknown): Promise<void> {
  const r = await apiPanel(camino, { method: 'POST', cuerpo })
  if (r.estado !== 200) throw new Error(`POST ${camino} → ${detalleDe(r)}`)
}

interface Sembrada {
  vacante: number
  postulacion: number
  correo: string
}

/**
 * Una vacante calcada de una de la empresa del equipo —su solicitud, su puesto,
 * sus pesos— y una persona parada en «Simulación · por confirmar», que es el
 * punto de partida de la que se retrocede.
 */
function sembrar(): Sembrada {
  retirar()

  const equipo = unaFila(`select id, organizacion_id from usuario
                            where usuario_renaser_os_id = ${literal(EQUIPO)}`)
  const origen = unaFila(`select solicitud_talento_id, puesto_id, version_pesos_id
                            from vacante
                           where organizacion_id = ${equipo.organizacion_id}
                             and eliminada_en is null and titulo not like ${literal(`${MARCA}%`)}
                           order by id limit 1`)

  const solicitud = idInsertado(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id,
                                   puesto_id, nivel_puesto_codigo, familia_codigo,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    select s.organizacion_id, s.origen, s.urgencia, 'CON_VACANTE', s.area_id,
           s.puesto_id, s.nivel_puesto_codigo, s.familia_codigo,
           ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
           ${literal(TEXTO_SEMBRADO)}, ${equipo.id}
    from solicitud_talento s where s.id = ${origen.solicitud_talento_id}
    returning id`)
  const vacante = idInsertado(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo, publicada_en)
    values (${equipo.organizacion_id}, ${solicitud}, ${origen.puesto_id}, ${literal(TITULO)},
            ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE', 'PUBLICADA', ${origen.version_pesos_id},
            ${equipo.id}, false, 'PLANTILLA', 'OCULTA', now())
    returning id`)

  const correo = correoDePrueba(PREFIJO_CORREO)
  const persona = idInsertado(`
    insert into persona (nombre, apellidos, ciudad_ubigeo)
    values (${literal(NOMBRE)}, ${literal(APELLIDOS)}, '1501') returning id`)
  const usuario = idInsertado(`
    insert into usuario (organizacion_id, persona_id, correo, es_equipo, es_activo)
    values (${equipo.organizacion_id}, ${persona}, ${literal(correo)}, false, true) returning id`)
  const postulacion = idInsertado(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, creado_en, movido_en)
    values (${equipo.organizacion_id}, ${usuario}, ${vacante}, 'SIMULACION_POR_CONFIRMAR', now(), now())
    returning id`)

  return { vacante, postulacion, correo }
}

/**
 * Por la API, como le pasó a la persona real: entra a Validación, se habilita y se
 * inicia su periodo, y se la retrocede a mano a «Simulación · por confirmar».
 */
async function retrocederConElPeriodoEnCurso(postulacion: number): Promise<void> {
  await enviar(`/postulaciones/${postulacion}/confirmacion-avance`, { motivo: 'Simulación calificada (QA 51)' })
  await enviar(`/postulaciones/${postulacion}/validacion/habilitacion`, {
    modalidad: 'SIMULACION_EXTENDIDA',
    dias: 5,
  })
  await enviar(`/postulaciones/${postulacion}/validacion/inicio`)
  await enviar(`/postulaciones/${postulacion}/transiciones`, {
    estadoDestino: 'SIMULACION_POR_CONFIRMAR',
    motivo: 'Retrocede para revisar su simulación (QA 51)',
  })
}

/**
 * Quita lo sembrado y nada más: la cuenta por su prefijo de correo exacto, la
 * vacante y su solicitud por la marca. Se llama también ANTES de sembrar: si una
 * ejecución murió a mitad, la siguiente no se encuentra el terreno a medio poner.
 */
function retirar(correos: readonly string[] = []): void {
  const huerfanos = filas(
    `select correo from usuario where correo like ${literal(`${PREFIJO_CORREO}.%@example.com`)}`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  const vivas = filas(`select id from vacante where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null`)
  if (vivas.length) {
    const ids = vivas.map((f) => Number(f.id)).join(',')
    // La que conserva la postulación con historial no se puede borrar: se marca
    // eliminada y sale de todas las pantallas.
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from vacante
        where id in (${ids})
          and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
      commit;`)
  }

  sql(`delete from solicitud_talento
        where motivo = ${literal(TEXTO_SEMBRADO)}
          and not exists (select 1 from vacante v where v.solicitud_talento_id = solicitud_talento.id);`)
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)
}

let sembrada: Sembrada | undefined
let periodoAntes: Fila | undefined

test.beforeAll(async () => {
  sembrada = sembrar()
  await retrocederConElPeriodoEnCurso(sembrada.postulacion)
  periodoAntes = periodoDe(sembrada.postulacion)
})

test.afterAll(() => {
  retirar(sembrada ? [sembrada.correo] : [])
})

test.describe('Volver a validación con el periodo en curso', () => {
  test('avanza sin error, entra a su turno con el mismo periodo y su historial lo explica', async ({ page }) => {
    const { vacante, postulacion } = sembrada!
    const suya = () => filasDelRanking(page).filter({ hasText: NOMBRE_COMPLETO })

    // El punto de partida: retrocedida, con su periodo ya corriendo.
    expect(estadoDe(postulacion)).toBe('SIMULACION_POR_CONFIRMAR')
    expect(periodoAntes!.estado).toBe('EN_CURSO')

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}`)
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()

    await pestana(page, 'Simulación').click()
    await corte(page, 'Pendiente').click()
    await expect(suya()).toHaveCount(1)

    await suya().locator('input[type="checkbox"]').check()
    await page.getByLabel('Motivo (obligatorio)').fill(MOTIVO)
    const avanzar = page.getByRole('button', { name: /^Avanzar a/ })
    await expect(avanzar).toBeEnabled()
    await avanzar.click()

    // Antes de esto salía «No avanzaron: … (ya existe un registro con postulacion_id X)».
    const resultado = page.locator('[role="status"]').filter({ hasText: /Avanzaron|No avanzaron/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    await expect(resultado).toContainText(`Avanzaron: ${NOMBRE_COMPLETO}`)
    await expect(resultado).not.toContainText('No avanzaron')

    // En la base: a su turno, con el mismo periodo, intacto y único.
    expect(estadoDe(postulacion)).toBe('VALIDACION_TURNO_CANDIDATO')
    expect(periodoDe(postulacion)).toEqual(periodoAntes)
    expect(Number(unaFila(`select count(*) as n from validacion where postulacion_id = ${postulacion}`).n)).toBe(1)

    // En la pantalla: en la pestaña de Validación, donde ahora le toca a ella.
    await pestana(page, 'Validación').click()
    await corte(page, 'Le toca al candidato').click()
    await expect(suya()).toHaveCount(1)

    // Y la ficha cuenta por qué entró ahí y no a «por habilitar».
    await suya().getByRole('button', { name: NOMBRE_COMPLETO, exact: true }).click()
    const ficha = page.locator(`#ficha-${postulacion}`)
    await expect(ficha.getByRole('heading', { name: 'Cómo llegó hasta aquí' })).toBeVisible()
    await expect(ficha.getByRole('listitem').filter({ hasText: `${MOTIVO} · ${COLETILLA}` })).toHaveCount(1, {
      timeout: 15_000,
    })
  })
})
