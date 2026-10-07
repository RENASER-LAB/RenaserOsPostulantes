/**
 * El bloque «Prueba técnica» de una vacante nueva (V67): sin nada que elegir.
 *
 * Una vacante nueva rinde la prueba que se escribe en su editor, así que aquí
 * no quedan los dos desplegables, ni los minutos, ni la tarjeta de la ficha y
 * el cuestionario técnico, ni (V68) «Plazos de la prueba»: su fecha límite va en
 * la configuración del editor. Solo el estado —«Sin prueba», «Borrador · 70 de 100 puntos ·
 * 2 entregables», «Publicada · 5 criterios · 2 entregables · 90 min»— y «Armar
 * la prueba».
 *
 * ⚠️ **Publicar la vacante exige la prueba publicada**, y el botón de publicar y
 * el cartel «Todo listo» miran la misma regla: `usePruebaLista`. Si se separan,
 * se contradicen en la misma pantalla.
 */

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verPreguntasPropias } from '../../api/preguntasPropias'
import type { VacantePanel } from '../../api/tipos'
import { rutas } from '@/rutas'
import { claveDelEditor } from './consultas'
import { textoDeLaPrueba } from './formulario'
import { MODO_PRUEBA } from './modo'
import estilos from '../Vacante.module.css'

/** Si la vacante rinde la prueba escrita en el editor. */
export const rindeLaPruebaPropia = (vacante: Pick<VacantePanel, 'instrumentoEtapaTecnica'> | undefined) =>
  vacante?.instrumentoEtapaTecnica === 'PRUEBA_PROPIA'

function usePruebaDeLaVacante(vacante: VacantePanel | undefined) {
  const suya = rindeLaPruebaPropia(vacante)
  const id = vacante?.id ?? Number.NaN
  return useQuery({
    queryKey: claveDelEditor(id, MODO_PRUEBA.ruta),
    queryFn: () => verPreguntasPropias(id, MODO_PRUEBA.ruta),
    enabled: suya && Number.isFinite(id),
  })
}

/**
 * Si su prueba está publicada: `true`, `false`, o `null` mientras no se sabe.
 * Una vacante de antes (PLANTILLA o CUESTIONARIO_TECNICO) contesta `true`: esta
 * regla no es la suya.
 */
export function usePruebaLista(vacante: VacantePanel | undefined): boolean | null {
  const consulta = usePruebaDeLaVacante(vacante)
  if (vacante === undefined) return null
  if (!rindeLaPruebaPropia(vacante)) return true
  if (consulta.isPending || consulta.isError) return null
  return consulta.data.resumen.estado === 'PUBLICADA'
}

export function PruebaDeLaVacante({ vacante }: { vacante: VacantePanel }) {
  const consulta = usePruebaDeLaVacante(vacante)
  return (
    <div className={estilos.ajuste}>
      <span className={estilos.etiquetaAjuste}>La prueba de esta vacante</span>
      {consulta.isPending ? (
        <p className={estilos.bancoQueRige} role="status">
          Buscando la prueba…
        </p>
      ) : consulta.isError ? (
        <span className={estilos.ayudaAjuste} role="status">
          No se pudo leer el estado de la prueba. Al recargar se vuelve a intentar.
        </span>
      ) : (
        <p className={estilos.bancoQueRige}>{textoDeLaPrueba(consulta.data.resumen)}</p>
      )}
      <span className={estilos.ayudaAjuste}>
        Lo que rinde quien llega a la etapa técnica: el caso, el tiempo, los entregables y los
        criterios, escritos para esta vacante. Sin ella publicada, la vacante no se publica.
      </span>
      <Link className={estilos.accionSecundaria} to={rutas.adminPruebaPropia(vacante.id)}>
        Armar la prueba →
      </Link>
    </div>
  )
}
