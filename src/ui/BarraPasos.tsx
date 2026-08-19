/**
 * La barra de cinco tramos con sus nombres debajo.
 *
 * Las etiquetas salen de `dominio/estados.ts`, no estan escritas aqui: si
 * cambian las etapas, cambian en un sitio.
 */

import { ETAPAS } from '@/dominio/estados'

interface Props {
  /** Cuantos tramos van llenos. */
  completados: number
  /** En cual esta ahora. `null` cuando la postulacion ya termino. */
  actual: number | null
}

export function BarraPasos({ completados, actual }: Props) {
  return (
    <>
      <div className="steps">
        {ETAPAS.map((etapa, i) => {
          const clase =
            i < completados ? 'step done' : i === actual ? 'step current' : 'step'
          return <span key={etapa.clave} className={clase} />
        })}
      </div>
      <div className="step-labels">
        {ETAPAS.map((etapa) => (
          <span key={etapa.clave}>{etapa.etiqueta}</span>
        ))}
      </div>
    </>
  )
}
