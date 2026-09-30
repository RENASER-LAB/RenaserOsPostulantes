/**
 * Las piezas que la lista y la ficha del colaborador pintan igual: el estado y
 * el fin de contrato.
 */

import type { Dia, EstadoLaboral } from '../api/tiposPersonas'
import { avisoDelContrato, formatearDia, hoyEnLima, NOMBRE_DEL_ESTADO } from './fechas'
import estilos from './piezas.module.css'

/**
 * El estado, distinguible por la forma y no solo por el color: relleno lo que
 * está dentro, contorno lo que todavía no, punteado lo que ya salió. Con una
 * fecha de cese futura dice cuándo cesa: hasta ese día la persona sigue activa.
 */
export function EtiquetaDeEstado({ estado, fechaCese }: { estado: EstadoLaboral; fechaCese?: Dia | null }) {
  const clase =
    estado === 'ACTIVO' ? estilos.activo : estado === 'POR_INGRESAR' ? estilos.porIngresar : estilos.cesado
  return (
    <span className={estilos.estado}>
      <span className={`${estilos.marca} ${clase}`}>{NOMBRE_DEL_ESTADO[estado]}</span>
      {estado !== 'CESADO' && fechaCese && (
        <span className={estilos.cesa}>Cesa el {formatearDia(fechaCese)}</span>
      )}
    </span>
  )
}

/** La fecha de fin y, si toca, «vence en N días» o «vencido» con su explicación. */
export function FinDeContrato({ fin, estado, hoy = hoyEnLima() }: { fin: Dia | null; estado: EstadoLaboral; hoy?: Dia }) {
  if (!fin) return <span className={estilos.sinFin}>Sin fecha de fin</span>
  const aviso = avisoDelContrato(fin, estado, hoy)
  return (
    <span className={estilos.fin}>
      {formatearDia(fin)}
      {aviso && (
        <span
          className={aviso.tono === 'vencido' ? estilos.vencido : estilos.vence}
          title={aviso.explicacion}
        >
          {aviso.texto}
        </span>
      )}
      {aviso?.explicacion && <span className={estilos.soloLectores}>{aviso.explicacion}</span>}
    </span>
  )
}
