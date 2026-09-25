import type { Page } from '@playwright/test'

import { idDeVacante, VACANTES } from './ayuda'
import { literal, sql } from './base-de-datos'

/**
 * El escenario de la vacante «Desarrollador web» que las pruebas del ranking
 * dan por sabido: notas, grupos de prioridad, ciudades y pretensiones de las
 * cuatro personas sembradas. Es el mismo que escribía
 * `scripts/sembrar-escenario-e2e.py` del backend, en dos vías:
 *
 *   1. **`interceptarEscenario(page)`** —la vía por defecto—: el ranking de la
 *      vacante se pide al backend de verdad y, antes de que llegue a la pantalla,
 *      a cada fila se le sobreescriben la nota, el grupo, la ciudad y la
 *      pretensión con las de aquí. La base no se toca y no hace falta sembrar
 *      nada. Es el patrón que ya usaba `34-filtros-y-seleccion-qa` para la fila
 *      sin fecha.
 *   2. **`sembrarEscenarioEnBase()`**: lo mismo escrito en la base por SQL, con
 *      su restauración. Es la réplica en TypeScript del script de Python, para
 *      cuando haga falta que el BACKEND vea las notas (hoy ninguna prueba lo
 *      necesita: el Excel recibe los ids ya filtrados por el navegador).
 *
 * ⚠️ **`E2E_ESCENARIO=base` apaga las dos vías.** Con esa variable las pruebas
 * se fían de lo que haya en la base —lo que deja el sembrador de Python o el
 * de TypeScript— y así se puede medir cada vía contra la otra con las mismas
 * pruebas:
 *
 *     python3 ../backend/scripts/sembrar-escenario-e2e.py --api … --contenedor … --db …
 *     E2E_ESCENARIO=base npx playwright test 03-orden
 *
 *     npx vite-node herramientas/e2e/sembrar-escenario-desarrollador-web.ts
 *     E2E_ESCENARIO=base npx playwright test 03-orden
 *
 *     npx playwright test 03-orden          # la intercepción, sin sembrar nada
 *
 * ⚠️ **INCOMPATIBLE es un grupo que el sistema real no produce** —quien falla un
 * requisito indispensable se cierra como NO_CONTINUA sin llegar a tener grupo—.
 * Se escribe porque el orden que las pruebas fijan lo exige: Joaquín, con el 95
 * más alto de la tanda, tiene que caer el último por su grupo.
 *
 * ⚠️ **El `puesto` (la columna «#») NO se toca.** El Excel lo escribe desde la
 * base, así que cambiarlo aquí haría que la pantalla y la hoja discreparan por
 * culpa de la prueba y no del producto.
 */

/** Con `E2E_ESCENARIO=base` no se intercepta ni se siembra: manda lo que haya en la base. */
export const ESCENARIO_DESDE_LA_BASE = process.env.E2E_ESCENARIO === 'base'

export type GrupoDelEscenario = 'ALTA' | 'NO_PRIORIZADO' | 'INCOMPATIBLE'

export interface PersonaDelEscenario {
  nombre: string
  correo: string
  grupo: GrupoDelEscenario
  /** La nota del perfil integral. En «Prueba del puesto» nadie tiene nota. */
  nota: number
  ciudad: string
  ciudadCodigo: string
  pretension: { min: number; max: number; moneda: 'PEN' } | null
}

/**
 * En el orden del backend: por grupo (ALTA, POTENCIAL_CON_RIESGO, NO_PRIORIZADO,
 * INCOMPATIBLE) y, dentro de cada grupo, por nota de mayor a menor.
 */
export const ESCENARIO: readonly PersonaDelEscenario[] = [
  {
    nombre: 'Lucía Chávez Paredes',
    correo: 'lucía.chávez@ejemplo.pe',
    grupo: 'ALTA',
    nota: 74,
    ciudad: 'Arequipa — Camaná',
    ciudadCodigo: '0402',
    pretension: { min: 3100, max: 3600, moneda: 'PEN' },
  },
  {
    nombre: 'Camila Torres Rivas',
    correo: 'camila.torres@ejemplo.pe',
    grupo: 'ALTA',
    nota: 55,
    ciudad: 'Lima — Lima',
    ciudadCodigo: '1501',
    pretension: { min: 2500, max: 3000, moneda: 'PEN' },
  },
  {
    // Sin pretensión a propósito: el filtro de pretensión tiene que poder
    // demostrar que quien no declaró sueldo queda FUERA en vez de colarse como un cero.
    nombre: 'Sebastián Cárdenas Rojo',
    correo: 'sebastián.cárdenas@ejemplo.pe',
    grupo: 'NO_PRIORIZADO',
    nota: 61,
    ciudad: 'Junín — Huancayo',
    ciudadCodigo: '1201',
    pretension: null,
  },
  {
    nombre: 'Joaquín Vargas Ureta',
    correo: 'joaquín.vargas@ejemplo.pe',
    grupo: 'INCOMPATIBLE',
    nota: 95,
    ciudad: 'La Libertad — Trujillo',
    ciudadCodigo: '1301',
    pretension: { min: 4000, max: 5200, moneda: 'PEN' },
  },
]

/** Los nombres en el orden del backend: lo que la tabla enseña sin ningún orden puesto. */
export const ORDEN_DEL_BACKEND: readonly string[] = ESCENARIO.map((p) => p.nombre)

/** La etapa cuya nota es la del escenario. En las demás, nadie tiene nota. */
const ETAPA_CON_NOTA = 'PERFIL_INTEGRAL'

/** Lo justo de una fila del ranking para sobreescribirla; el resto viaja tal cual. */
interface FilaDelRanking {
  candidato: string
  grupoPrioridad: string | null
  notaEtapa: number | null
  ciudad: string | null
  ciudadCodigo: string | null
  pretensionMin: number | null
  pretensionMax: number | null
  pretensionMoneda: string | null
  pretensionDeclarada: number | null
  pretensionDeclaradaMoneda: string | null
  [otro: string]: unknown
}

/**
 * Las filas del backend con el escenario encima, en el orden del backend.
 *
 * Quien no esté en el escenario —una cuenta que otra prueba haya dejado en la
 * vacante— se queda detrás, como venía. Exportada para la prueba unitaria que
 * fija el mismo escenario sin navegador.
 */
export function conElEscenario<F extends FilaDelRanking>(filas: F[], etapa: string | null): F[] {
  const conNota = (etapa ?? ETAPA_CON_NOTA) === ETAPA_CON_NOTA
  const porNombre = new Map(filas.map((f) => [f.candidato, f]))
  const delEscenario = ESCENARIO.flatMap((p) => {
    const fila = porNombre.get(p.nombre)
    if (!fila) return []
    return [
      {
        ...fila,
        grupoPrioridad: p.grupo,
        notaEtapa: conNota ? p.nota : null,
        ciudad: p.ciudad,
        ciudadCodigo: p.ciudadCodigo,
        pretensionMin: p.pretension?.min ?? null,
        pretensionMax: p.pretension?.max ?? null,
        pretensionMoneda: p.pretension?.moneda ?? null,
        // La declarada al postular mandaría sobre la del perfil: se apaga para
        // que la celda lea la banda del escenario.
        pretensionDeclarada: null,
        pretensionDeclaradaMoneda: null,
      },
    ]
  })
  const nombresDelEscenario = new Set(ESCENARIO.map((p) => p.nombre))
  const elResto = filas.filter((f) => !nombresDelEscenario.has(f.candidato))
  return [...delEscenario, ...elResto]
}

/**
 * Intercepta el ranking de la vacante LLENA y le pone el escenario encima.
 *
 * Solo la ruta del ranking, por su camino exacto: el Excel cuelga de
 * `…/ranking/excel` y ese sí tiene que llegar al backend tal cual.
 */
export async function interceptarEscenario(page: Page): Promise<void> {
  if (ESCENARIO_DESDE_LA_BASE) return
  const vacanteId = await idDeVacante(VACANTES.LLENA)
  const camino = `/panel/vacantes/${vacanteId}/ranking`
  await page.route(
    (url) => url.pathname.endsWith(camino),
    async (ruta) => {
      const respuesta = await ruta.fetch()
      if (!respuesta.ok()) {
        await ruta.fulfill({ response: respuesta })
        return
      }
      const cuerpo = (await respuesta.json()) as { filas?: FilaDelRanking[] }
      const etapa = new URL(ruta.request().url()).searchParams.get('etapa')
      cuerpo.filas = conElEscenario(cuerpo.filas ?? [], etapa)
      await ruta.fulfill({ response: respuesta, json: cuerpo })
    },
  )
}

// ---------- La otra vía: escribirlo en la base, y devolverla ----------

interface Original {
  postulacion_id: number
  correo: string
  grupo_prioridad: string | null
  /** Nulo si no tenía nota del perfil: entonces la que se siembre se borra al restaurar. */
  nota: number | null
  perfil_id: number | null
  pretension_min: number | null
  pretension_max: number | null
  pretension_moneda: string | null
}

const correosDelEscenario = () => ESCENARIO.map((p) => literal(p.correo)).join(', ')

/**
 * Escribe el escenario en la base —grupo, nota del perfil y pretensión— y
 * devuelve cómo dejarla exactamente como estaba.
 *
 * Es lo que hacía el script de Python, sin Python y sin `requests`: la
 * pretensión va también por SQL porque el perfil ya existe para las cuatro
 * cuentas sembradas (si alguna no lo tuviera, se avisa y se deja sin pretensión
 * en vez de inventarle un perfil).
 *
 * La nota se escribe con `insert … on conflict do update`: el script de Python
 * hacía un `update` sobre una fila que en una base recién sembrada no existe, y
 * afectaba a cero filas sin decirlo.
 *
 * No mira `E2E_ESCENARIO`: quien la llama decide. Hoy solo la llama el guion
 * `sembrar-escenario-desarrollador-web.ts`, que es la vía que se mide.
 */
export function sembrarEscenarioEnBase(): () => void {
  const vacante = sql(`select id from vacante where titulo = ${literal(VACANTES.LLENA)} and eliminada_en is null;`)
  if (!/^\d+$/.test(vacante)) throw new Error(`No hay una única vacante «${VACANTES.LLENA}» en el clon: ${vacante || '(ninguna)'}`)

  const originales = JSON.parse(
    sql(`select coalesce(json_agg(r), '[]') from (
      select p.id as postulacion_id, u.correo, p.grupo_prioridad, n.puntaje::float as nota,
             pc.id as perfil_id, pc.pretension_min::float as pretension_min,
             pc.pretension_max::float as pretension_max, pc.pretension_moneda
        from postulacion p
        join usuario u on u.id = p.usuario_id
        left join nota_etapa n on n.postulacion_id = p.id and n.etapa_codigo = ${literal(ETAPA_CON_NOTA)}
        left join perfil_candidato pc on pc.persona_id = u.persona_id
       where p.vacante_id = ${vacante} and u.correo in (${correosDelEscenario()})) r;`),
  ) as Original[]
  const faltan = ESCENARIO.filter((p) => !originales.some((o) => o.correo === p.correo))
  if (faltan.length) {
    throw new Error(`Faltan en la vacante las cuentas del escenario: ${faltan.map((p) => p.correo).join(', ')}`)
  }

  const ordenes = ESCENARIO.map((p) => {
    const suya = originales.find((o) => o.correo === p.correo)!
    const lineas = [
      `update postulacion set grupo_prioridad = ${literal(p.grupo)} where id = ${suya.postulacion_id};`,
      `insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id)
         select ${suya.postulacion_id}, ${literal(ETAPA_CON_NOTA)}, ${p.nota}, v.version_pesos_id
           from vacante v where v.id = ${vacante}
         on conflict (postulacion_id, etapa_codigo) do update set puntaje = excluded.puntaje;`,
    ]
    if (suya.perfil_id !== null) {
      lineas.push(
        `update perfil_candidato set pretension_min = ${p.pretension?.min ?? 'null'},
             pretension_max = ${p.pretension?.max ?? 'null'},
             pretension_moneda = ${p.pretension ? literal(p.pretension.moneda) : 'null'}
         where id = ${suya.perfil_id};`,
      )
    } else {
      console.warn(`[escenario] ${p.correo} no tiene perfil: se queda sin pretensión`)
    }
    return lineas.join('\n')
  })
  sql(`begin;\n${ordenes.join('\n')}\ncommit;`)

  return () => {
    const vuelta = originales.map((o) => {
      const lineas = [
        `update postulacion set grupo_prioridad = ${literal(o.grupo_prioridad)} where id = ${o.postulacion_id};`,
        o.nota === null
          ? `delete from nota_etapa where postulacion_id = ${o.postulacion_id} and etapa_codigo = ${literal(ETAPA_CON_NOTA)};`
          : `update nota_etapa set puntaje = ${o.nota} where postulacion_id = ${o.postulacion_id} and etapa_codigo = ${literal(ETAPA_CON_NOTA)};`,
      ]
      if (o.perfil_id !== null) {
        lineas.push(
          `update perfil_candidato set pretension_min = ${o.pretension_min ?? 'null'},
               pretension_max = ${o.pretension_max ?? 'null'},
               pretension_moneda = ${literal(o.pretension_moneda)}
           where id = ${o.perfil_id};`,
        )
      }
      return lineas.join('\n')
    })
    sql(`begin;\n${vuelta.join('\n')}\ncommit;`)
  }
}
