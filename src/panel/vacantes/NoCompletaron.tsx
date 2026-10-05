/**
 * «No completaron la prueba (N)», plegable, debajo del ranking de la prueba
 * (V67).
 *
 * Quien dejó vencer el tiempo con algo sin responder o sin subir no tiene nota
 * ni sale en el ranking ni en su Excel, y su postulación sigue en su etapa
 * hasta que alguien cierre su proceso. Sin esta lista esas personas no estarían
 * en ninguna pantalla.
 *
 * ⚠️ **Va por su propio endpoint**, no dentro del ranking: el contrato del
 * ranking lo fijan el Excel y sus pruebas, y no cambia.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { verQuienesNoCompletaron } from '../api/pruebaPropia'
import { formatearFechaCorta } from '@/dominio/reloj'
import { DescartarPostulacion } from './DescartarPostulacion'
import estilos from './Vacante.module.css'

export function NoCompletaron({ vacanteId, puedeMover }: { vacanteId: number; puedeMover: boolean }) {
  const cache = useQueryClient()
  const consulta = useQuery({
    queryKey: ['panel-no-completaron', vacanteId],
    queryFn: () => verQuienesNoCompletaron(vacanteId),
    retry: false,
  })
  // Un fallo (un permiso, sobre todo) no tapa el ranking: la lista no sale y ya.
  if (!consulta.data || consulta.data.length === 0) return null
  const lista = consulta.data
  return (
    <details className={estilos.plazosPlegables}>
      <summary>No completaron la prueba ({lista.length})</summary>
      <p className={estilos.ayudaAjuste}>
        Su tiempo terminó con algo sin responder o sin subir: no tienen nota ni salen en el ranking,
        y su proceso sigue abierto hasta que alguien lo cierre.
      </p>
      <ul className={estilos.criterios} role="list">
        {lista.map((n) => (
          <li className={estilos.criterio} key={n.postulacionId}>
            <span className={estilos.cuerpoCriterio}>
              <span>
                <b>{n.candidato}</b> · {n.queFalto || 'no la completó'}
                {n.cerradaEn ? ` · ${formatearFechaCorta(n.cerradaEn)}` : ''}
              </span>
              <DescartarPostulacion
                postulacionId={n.postulacionId}
                candidato={n.candidato}
                yaTermino={n.procesoCerrado}
                puedeMover={puedeMover}
                textoDelBoton="Cerrar su proceso"
                alDescartar={() => {
                  cache.invalidateQueries({ queryKey: ['panel-no-completaron', vacanteId] })
                  cache.invalidateQueries({ queryKey: ['panel-ranking', vacanteId] })
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
