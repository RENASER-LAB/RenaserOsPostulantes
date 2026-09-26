import { expect, test } from '@playwright/test'
import { corte, entrarAlPanel, filasDelRanking, pestana } from './ayuda'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { borrarCuentasDePrueba } from './limpieza-cuentas'

/**
 * ⚠️ **Este archivo ESCRIBE**, y sobre terreno propio: una vacante con una sola
 * postulación, las dos sembradas aquí y reconocibles por su marca.
 *
 * Hasta el ciclo 4 de la auditoría de la suite movía a **Diego Salazar Núñez**,
 * la postulación sembrada de «Líder de operaciones», una etapa por corrida. Las
 * transiciones son inmutables (V6) y el recorrido acaba en CONTRATADO, así que
 * cada corrida gastaba una de las pocas que le quedaban a una persona de la
 * siembra: la suite dice que se puede volver a correr sobre la misma base, y
 * esta prueba no podía. Ahora cada corrida siembra a su propia persona en
 * PERFIL_POR_CONFIRMAR, la avanza y la retira: se puede repetir sin fin.
 *
 * ⚠️ **Lo avanzado no se puede borrar.** La transición se queda, y con ella la
 * postulación y la cuenta: la cuenta se retira del camino
 * (`borrarCuentasDePrueba`) y la vacante se marca eliminada, que la saca de
 * todas las pantallas. Es el mismo trato que `ayuda-filtros-y-seleccion.ts`.
 */

/** La marca que reconoce lo sembrado por esta prueba, y solo lo suyo. */
const MARCA = 'QA-AVANCE-09'
const TITULO = `${MARCA} Avanzar de etapa`
const TEXTO_SEMBRADO = 'Sembrada por la prueba de avanzar de etapa (09-avance)'
const PREFIJO_CORREO = 'e2e.avance09'
const NOMBRE = 'Avance'
const APELLIDOS = 'Nueve QA'
const NOMBRE_COMPLETO = `${NOMBRE} ${APELLIDOS}`

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una sola fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

function insertar(consulta: string): number {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return Number(filas[0]!.id)
}

const estadoDe = (postulacion: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo)

const transicionesDe = (postulacion: number): number =>
  Number(uno(`select count(*) as n from transicion_estado where postulacion_id = ${postulacion}`).n)

interface Sembrada {
  vacante: number
  postulacion: number
  correo: string
}

/**
 * La vacante copia la solicitud, el puesto, los pesos y **la plantilla de la
 * prueba** de una vacante sembrada que la tenga: sin plantilla el backend no
 * deja pasar del perfil a la prueba (409) y el avance no se podría comprobar.
 */
function sembrar(): Sembrada {
  retirar()

  const responsable = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  const origen = uno(`select solicitud_talento_id, puesto_id, version_pesos_id, organizacion_id,
                             version_plantilla_prueba_id
                        from vacante
                       where eliminada_en is null and version_plantilla_prueba_id is not null
                         and titulo not like ${literal(`${MARCA}%`)}
                       order by id limit 1`)
  const organizacion = Number(origen.organizacion_id)

  const solicitud = insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id,
                                   puesto_id, nivel_puesto_codigo, familia_codigo,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    select s.organizacion_id, s.origen, s.urgencia, 'CON_VACANTE', s.area_id,
           s.puesto_id, s.nivel_puesto_codigo, s.familia_codigo,
           ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
           ${literal(TEXTO_SEMBRADO)}, ${responsable}
    from solicitud_talento s where s.id = ${origen.solicitud_talento_id}
    returning id`)
  const vacante = insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo, publicada_en,
                         version_plantilla_prueba_id)
    values (${organizacion}, ${solicitud}, ${origen.puesto_id}, ${literal(TITULO)},
            ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE', 'PUBLICADA', ${origen.version_pesos_id},
            ${responsable}, false, 'PLANTILLA', 'OCULTA', now(), ${origen.version_plantilla_prueba_id})
    returning id`)

  const correo = correoDePrueba(PREFIJO_CORREO)
  const persona = insertar(`
    insert into persona (nombre, apellidos, ciudad_ubigeo)
    values (${literal(NOMBRE)}, ${literal(APELLIDOS)}, '1501') returning id`)
  const usuario = insertar(`
    insert into usuario (organizacion_id, persona_id, correo, es_equipo, es_activo)
    values (${organizacion}, ${persona}, ${literal(correo)}, false, true) returning id`)
  const postulacion = insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, creado_en, movido_en)
    values (${organizacion}, ${usuario}, ${vacante}, 'PERFIL_POR_CONFIRMAR', now(), now())
    returning id`)

  return { vacante, postulacion, correo }
}

/**
 * Quita lo sembrado y nada más: la cuenta por su prefijo de correo exacto, la
 * vacante y su solicitud por la marca. Se llama también ANTES de sembrar: si una
 * ejecución murió a mitad, la siguiente no se encuentra el terreno a medio poner.
 */
function retirar(correos: readonly string[] = []): void {
  const huerfanos = consultar(
    `select correo from usuario where correo like ${literal(`${PREFIJO_CORREO}.%@example.com`)}`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  const vivas = consultar(
    `select id from vacante where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null`,
  )
  if (vivas.length) {
    const ids = vivas.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from plantilla_correo_vacante where vacante_id in (${ids});
      delete from ficha_vacante where vacante_id in (${ids});
      delete from sesion_vacante where vacante_id in (${ids});
      delete from vacante
        where id in (${ids})
          and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      -- La que conserva la postulación avanzada no se puede borrar: se marca
      -- eliminada y sale de todas partes.
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

test.beforeAll(() => {
  sembrada = sembrar()
})

test.afterAll(() => {
  retirar(sembrada ? [sembrada.correo] : [])
})

test.describe('Regresión · avanzar de etapa', () => {
  test('el botón exige motivo y marcados, y el avance mueve a la persona de etapa', async ({ page }) => {
    const { vacante, postulacion } = sembrada!
    const suya = () => filasDelRanking(page).filter({ hasText: NOMBRE_COMPLETO })

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}`)
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()

    // Antes: en la prueba no le toca nada, y en el perfil espera una decisión de la empresa.
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Le toca al candidato').click()
    await expect(suya()).toHaveCount(0)
    await pestana(page, 'Perfil integral').click()
    await corte(page, 'Pendiente').click()
    await expect(suya()).toHaveCount(1)
    await corte(page, 'Toda la tanda').click()

    const avanzar = page.getByRole('button', { name: /^Avanzar a/ })
    // Sin nadie marcado no hay barra: ni botón que pulsar, ni motivo que escribir.
    await expect(avanzar).toHaveCount(0)
    await expect(page.getByLabel('Motivo (obligatorio)')).toHaveCount(0)

    await suya().locator('input[type="checkbox"]').check()
    // Marcado pero sin motivo: la barra sale y el botón sigue apagado.
    await expect(avanzar).toHaveText('Avanzar a 1 persona')
    await expect(avanzar).toBeDisabled()

    // ⚠️ El motivo vive en la barra de lo marcado, con su rótulo «Motivo
    // (obligatorio)»; se busca por el rótulo y no por el texto de ayuda del campo.
    await page.getByLabel('Motivo (obligatorio)').fill('Verificación QA de la rama')
    await expect(avanzar).toBeEnabled()
    await avanzar.click()

    // El resultado se anuncia, y esta vez tiene que ser que avanzó: la persona es
    // de la prueba y está en un estado desde el que la máquina calcula un paso.
    const resultado = page.locator('[role="status"]').filter({ hasText: /Avanzaron|No avanzaron/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    await expect(resultado).toContainText(`Avanzaron: ${NOMBRE_COMPLETO}`)
    await expect(resultado).not.toContainText('No avanzaron')
    // Y la tanda se refresca sola: las marcas se sueltan y la barra de acciones se va.
    await expect(avanzar).toHaveCount(0)
    console.log('[AVANCE]', await resultado.textContent())

    // En la base: un paso, el que calcula la máquina, con su transición.
    expect(estadoDe(postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(transicionesDe(postulacion)).toBe(1)

    // Y en la pantalla: sale de «Pendiente» del perfil y aparece en la prueba,
    // donde ahora le toca a ella.
    await corte(page, 'Pendiente').click()
    await expect(suya()).toHaveCount(0)
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Le toca al candidato').click()
    await expect(suya()).toHaveCount(1)
  })
})
