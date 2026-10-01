/**
 * Una cerrada de la prueba escrita en el editor (V67): opción única, opción
 * múltiple o escala.
 *
 * Se pinta con los mismos formatos que la evaluación (`Formatos.tsx`), así que
 * se ven y se responden igual en las dos pantallas. Lo único propio es el
 * guardado: cada clic se manda en el momento, y si falla se reintenta solo con
 * lo último marcado, como las abiertas.
 *
 * ⚠️ **Sin puntos ni cuál es la buena**: no llegan al portal (RF-53).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { responderPruebaCerrada } from '@/api/prueba'
import type { DetalleRespuesta, PreguntaEvaluacion, PreguntaPrueba } from '@/api/tipos'
import { RespuestaDeLaPregunta } from '../evaluacion/Formatos'
import estilos from './Prueba.module.css'

const ESPERA_ANTES_DE_REINTENTAR = 5000
const LETRAS = 'abcdefghijklmnopqrstuvwxyz'

type Respuesta = { opcionId: number | null } | { marcadas: number[] }

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

const respondida = (r: Respuesta) =>
  'marcadas' in r ? r.marcadas.length > 0 : r.opcionId !== null

export function PreguntaCerrada({
  uuid,
  pregunta,
  numero,
  bloqueado,
  registrarEnvio,
  registrarSiTieneTexto,
  siSeCerroLaPuerta,
}: {
  uuid: string
  pregunta: PreguntaPrueba
  /** Su número en la prueba: «Pregunta 3». */
  numero: number
  bloqueado: boolean
  registrarEnvio: (preguntaId: number, mandar: (() => Promise<unknown>) | null) => void
  /** Si está respondida ahora mismo: es lo que cuenta «Entregar». */
  registrarSiTieneTexto: (preguntaId: number, tiene: boolean | null) => void
  siSeCerroLaPuerta: (causa: unknown) => boolean
}) {
  const cache = useQueryClient()
  const multiple = pregunta.tipo === 'OPCION_MULTIPLE'
  const [opcion, setOpcion] = useState<number | null>(pregunta.respuestaOpcionId ?? null)
  const [marcadas, setMarcadas] = useState<number[]>(pregunta.respuestaMarcadas ?? [])
  const [estado, setEstado] = useState<'limpio' | 'guardando' | 'pendiente'>('limpio')
  const pendiente = useRef<Respuesta | null>(null)
  const enVuelo = useRef<Promise<unknown> | null>(null)
  const yaNoSeAdmite = useRef(bloqueado)
  useEffect(() => {
    yaNoSeAdmite.current = bloqueado
  }, [bloqueado])

  const guardar = useMutation({
    mutationFn: (r: Respuesta) => responderPruebaCerrada(uuid, pregunta.id, r),
    onMutate: () => setEstado('guardando'),
    onSuccess: async (_x, r) => {
      await cache.cancelQueries({ queryKey: ['prueba', uuid] })
      if (pendiente.current === r) {
        pendiente.current = null
        setEstado('limpio')
      }
    },
    onError: (causa) => {
      setEstado('pendiente')
      siSeCerroLaPuerta(causa)
    },
  })
  const guardarAsync = guardar.mutateAsync

  const mandarPendiente = useCallback(async () => {
    if (pendiente.current === null || yaNoSeAdmite.current) return
    if (enVuelo.current) return enVuelo.current
    const viaje = guardarAsync(pendiente.current)
      .catch(() => {})
      .finally(() => {
        enVuelo.current = null
      })
    enVuelo.current = viaje
    return viaje
  }, [guardarAsync])

  const elegir = (r: Respuesta) => {
    if (bloqueado) return
    if ('marcadas' in r) setMarcadas(r.marcadas)
    else setOpcion(r.opcionId)
    pendiente.current = r
    setEstado('pendiente')
    // Si hay uno en vuelo, el reintento manda lo último en cuanto termine.
    void mandarPendiente().then(() => {
      if (pendiente.current !== null) void mandarPendiente()
    })
  }

  useEffect(() => {
    if (estado !== 'pendiente' || bloqueado) return
    const reloj = window.setInterval(() => void mandarPendiente(), ESPERA_ANTES_DE_REINTENTAR)
    return () => window.clearInterval(reloj)
  }, [estado, bloqueado, mandarPendiente])

  useEffect(() => {
    registrarEnvio(pregunta.id, mandarPendiente)
    return () => registrarEnvio(pregunta.id, null)
  }, [registrarEnvio, pregunta.id, mandarPendiente])

  const ahora: Respuesta = multiple ? { marcadas } : { opcionId: opcion }
  const tiene = respondida(ahora)
  useEffect(() => {
    registrarSiTieneTexto(pregunta.id, tiene)
    return () => registrarSiTieneTexto(pregunta.id, null)
  }, [registrarSiTieneTexto, pregunta.id, tiene])

  const comoEvaluacion = comoDeLaEvaluacion(pregunta, numero)
  const pista = bloqueado
    ? estado !== 'limpio'
      ? 'No llegó a guardarse antes de que terminara el tiempo.'
      : tiene
        ? 'Guardado antes de que terminara el tiempo.'
        : 'Se quedó sin responder.'
    : estado !== 'limpio'
      ? 'Guardando…'
      : tiene
        ? 'Guardado.'
        : 'Sin responder.'

  return (
    <fieldset className={estilos.pregunta} id={`pregunta-${pregunta.id}`} disabled={bloqueado}>
      <legend className={estilos.enunciado}>
        <span className={estilos.numeroPregunta}>Pregunta {numero}</span>
        {' · '}
        {pregunta.enunciado}
      </legend>
      <RespuestaDeLaPregunta
        pregunta={comoEvaluacion}
        detalle={multiple ? ({ marcadas } satisfies DetalleRespuesta) : undefined}
        opcionElegida={opcion}
        texto=""
        onOpcion={(id) => elegir({ opcionId: id })}
        onDetalle={(d) => elegir({ marcadas: d.marcadas ?? [] })}
        onTexto={() => {}}
      />
      <span className={estilos.estadoRespuesta}>{pista}</span>
    </fieldset>
  )
}
