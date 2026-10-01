/**
 * La consulta del editor y como se aplica cada cambio.
 *
 * ⚠️ **Cada cambio devuelve el editor entero y se pone tal cual**, igual que
 * `ComponerPrueba.tsx`: nada se parchea a mano en el navegador. El balance, los
 * avisos y los puntos de cada criterio los cuadra el servidor; si el panel
 * sumara por su cuenta, un fallo de red dejaria dos numeros distintos en la
 * misma pantalla.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { ErrorApi } from '../../api/cliente'
import {
  faltasDe,
  verPreguntasPropias,
  type EditorDePreguntas,
} from '../../api/preguntasPropias'

export const claveDelEditor = (vacanteId: number) => ['panel-preguntas-propias', vacanteId] as const

export function useEditorDePreguntas(vacanteId: number, habilitado = true) {
  return useQuery({
    queryKey: claveDelEditor(vacanteId),
    queryFn: () => verPreguntasPropias(vacanteId),
    enabled: habilitado && Number.isFinite(vacanteId),
  })
}

/** Pone el editor que devolvio el servidor y avisa a la ficha de la vacante. */
export function usePonerEditor(vacanteId: number) {
  const cache = useQueryClient()
  return useCallback(
    (editor: EditorDePreguntas) => {
      cache.setQueryData(claveDelEditor(vacanteId), editor)
      // La seccion «Que respondera quien postule» enseña el resumen, y el cartel
      // «Todo listo» depende de que esten publicadas.
      void cache.invalidateQueries({ queryKey: ['panel-vacante', vacanteId] })
    },
    [cache, vacanteId],
  )
}

/** Lo que se le dice a quien pulso, sin mentir sobre lo guardado. */
export interface Fallo {
  mensaje: string
  /** La lista entera de un 400 del editor, para pintarla como lista. */
  faltas: string[] | null
  sinPermiso: boolean
}

export function falloDe(causa: unknown, porDefecto: string): Fallo {
  const sinPermiso = causa instanceof ErrorApi && causa.estado === 403
  return {
    mensaje: sinPermiso
      ? 'No tienes permiso para cambiar las preguntas de esta vacante (hace falta «editar vacante»).'
      : causa instanceof Error && causa.message
        ? causa.message
        : porDefecto,
    faltas: faltasDe(causa),
    sinPermiso,
  }
}
