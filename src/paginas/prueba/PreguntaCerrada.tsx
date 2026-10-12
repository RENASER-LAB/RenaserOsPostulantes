/**
 * Una cerrada de la prueba escrita en el editor (V67): opción única, opción
 * múltiple o escala.
 *
 * Se pinta con los mismos formatos que la evaluación (`Formatos.tsx`), así que
 * se ven y se responden igual en las dos pantallas. Desde que la prueba va de
 * una pregunta por pantalla (09/10/2026) esto solo pinta: el guardado es de la
 * cola compartida (`useColaDeRespuestas`), que reintenta aunque la pregunta ya
 * no esté en pantalla.
 *
 * ⚠️ **Sin puntos ni cuál es la buena**: no llegan al portal (RF-53).
 */

import type { DetalleRespuesta, PreguntaEvaluacion, PreguntaPrueba } from '@/api/tipos'
import { RespuestaDeLaPregunta } from '../evaluacion/Formatos'
import estilos from './Prueba.module.css'

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'

/** Lo que se manda de una cerrada: la opción elegida, o las marcadas. */
export type RespuestaCerradaValor = { opcionId: number | null } | { marcadas: number[] }

/** La pregunta de la prueba con la forma que leen los formatos de la evaluación. */
export function comoDeLaEvaluacion(p: PreguntaPrueba, numero: number): PreguntaEvaluacion {
  return {
    id: p.id,
    posicion: numero,
    tipo: p.tipo,
    enunciado: p.enunciado,
    situacion: null,
    opciones: [...(p.opciones ?? [])]
      .sort((a, b) => a.orden - b.orden)
      // La escala se lee por su número de nivel (1, 2, 3…); las demás, por su letra.
      .map((o, i) => ({
        id: o.id,
        letra: p.tipo === 'ESCALA' ? String(i + 1) : (LETRAS[i] ?? String(i + 1)),
        texto: o.texto ?? '',
      })),
    respuestaTexto: null,
    respuestaOpcionId: p.respuestaOpcionId ?? null,
    respuestaDetalle: p.respuestaMarcadas ? { marcadas: p.respuestaMarcadas } : null,
  }
}

/**
 * La forma de responder una cerrada, dentro de su tarjeta. El grupo se nombra con el
 * enunciado de la tarjeta, y con el tiempo agotado se queda a la vista pero no se toca.
 */
export function RespuestaCerrada({
  pregunta,
  numero,
  valor,
  bloqueado,
  idEnunciado,
  alCambiar,
}: {
  pregunta: PreguntaPrueba
  numero: number
  valor: RespuestaCerradaValor
  bloqueado: boolean
  idEnunciado: string
  alCambiar: (valor: RespuestaCerradaValor) => void
}) {
  const marcadas = 'marcadas' in valor ? valor.marcadas : []
  const opcion = 'opcionId' in valor ? valor.opcionId : null
  return (
    <fieldset className={estilos.grupoCerrada} aria-labelledby={idEnunciado} disabled={bloqueado}>
      <RespuestaDeLaPregunta
        pregunta={comoDeLaEvaluacion(pregunta, numero)}
        detalle={'marcadas' in valor ? ({ marcadas } satisfies DetalleRespuesta) : undefined}
        opcionElegida={opcion}
        texto=""
        onOpcion={(id) => alCambiar({ opcionId: id })}
        onDetalle={(d) => alCambiar({ marcadas: d.marcadas ?? [] })}
        onTexto={() => {}}
      />
    </fieldset>
  )
}
