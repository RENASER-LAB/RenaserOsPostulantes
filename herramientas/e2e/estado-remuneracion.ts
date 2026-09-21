import { literal, sql } from './base-de-datos'

type Consultar = typeof sql
type Registro = { id: number }
const CAMPOS = ['remuneracion_tipo', 'remuneracion_min', 'remuneracion_max', 'remuneracion_moneda', 'remuneracion_actualizada_en'] as const

/** Un solo escritor por clon. Captura IDs inmediatamente alrededor de cada petición. */
export function guardarRemuneracion(vacanteId: number, consultar: Consultar = sql) {
  if (!Number.isSafeInteger(vacanteId) || vacanteId < 1) throw new Error('Vacante inválida.')
  const filas = JSON.parse(consultar(`select coalesce(json_agg(v), '[]') from
    (select ${CAMPOS.join(', ')} from vacante where id = ${vacanteId}) v;`)) as Record<typeof CAMPOS[number], string | number | null>[]
  if (filas.length !== 1) throw new Error('No existe la vacante esperada; no se modificó nada.')
  const original = filas[0]!
  const avisos = new Set<number>()
  const correos = new Set<number>()
  const leer = (tabla: 'aviso_portal' | 'correo_enviado'): number[] => {
    const condicion = tabla === 'aviso_portal' ? `vacante_id = ${vacanteId}` :
      `usuario_id in (select usuario_id from postulacion where vacante_id = ${vacanteId})`
    return (JSON.parse(consultar(`select coalesce(json_agg(r), '[]') from
      (select id from ${tabla} where ${condicion}) r;`)) as Registro[]).map(r => r.id)
  }
  return {
    async registrar<T>(accion: () => Promise<T>): Promise<T> {
      const antesAvisos = new Set(leer('aviso_portal'))
      const antesCorreos = new Set(leer('correo_enviado'))
      try { return await accion() }
      finally {
        leer('aviso_portal').filter(id => !antesAvisos.has(id)).forEach(id => avisos.add(id))
        leer('correo_enviado').filter(id => !antesCorreos.has(id)).forEach(id => correos.add(id))
      }
    },
    restaurar() {
      // Restauración directa del estado real: no dispara otra ronda de notificaciones.
      consultar(`begin;
        update vacante set ${CAMPOS.map(c => `${c} = ${literal(original[c])}`).join(', ')} where id = ${vacanteId};
        ${avisos.size ? `delete from aviso_portal where id in (${[...avisos].join(',')}) and vacante_id = ${vacanteId};` : ''}
        ${correos.size ? `delete from correo_enviado where id in (${[...correos].join(',')});` : ''}
        commit;`)
    },
  }
}
