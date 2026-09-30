/**
 * «Qué responderá quien postule»: de dónde salen las preguntas de la vacante
 * (V66). Tres opciones, y no siempre las tres:
 *
 *   - **El banco de la empresa para su nivel**, solo si la empresa tiene uno
 *     PROPIO publicado para ese nivel. El de RENASER no cuenta para las demás.
 *   - **Preguntas propias de esta vacante**, con su estado y el enlace al editor.
 *   - **Sin evaluación.**
 *
 * Una vacante de antes que rinde el banco prestado lo enseña marcado con su
 * nombre real, «El banco de RENASER para su nivel», y si se cambia de opción esa
 * desaparece: el servidor ya no la acepta.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { VacantePanel } from '../../api/tipos'
import { elegirOrigenDePreguntas } from '../../api/preguntasPropias'
import { rutas } from '@/rutas'
import { useEditorDePreguntas } from './consultas'
import { textoDelResumen } from './formulario'
import estilos from '../Vacante.module.css'

type Origen = 'SIN_EVALUACION' | 'NIVEL' | 'VACANTE'

export const origenDe = (v: VacantePanel): Origen =>
  !v.aplicaEvaluacion ? 'SIN_EVALUACION' : (v.origenPreguntas ?? 'NIVEL')

/**
 * Si las preguntas propias ya están publicadas: `true`, `false`, o `null` mientras
 * no se sabe. Lo miran a la vez el botón de publicar y el cartel «Todo listo»,
 * igual que el backend (AC-17).
 */
export function usePreguntasListas(vacante: VacantePanel | undefined): boolean | null {
  const propias = vacante !== undefined && origenDe(vacante) === 'VACANTE'
  const editor = useEditorDePreguntas(vacante?.id ?? Number.NaN, propias)
  if (vacante === undefined) return null
  if (!propias) return true
  if (editor.isPending || editor.isError) return null
  return editor.data.resumen.estado === 'PUBLICADAS'
}

export function OrigenDeLasPreguntas({
  vacante,
  alCambiar,
  alFallar,
}: {
  vacante: VacantePanel
  alCambiar: () => void
  alFallar: (causa: unknown) => void
}) {
  const actual = origenDe(vacante)
  // Lo que se acaba de elegir, hasta que el servidor lo confirma y la vacante vuelve
  // con ello. Sin esto, entre el OK y la relectura se veia marcada la anterior.
  const [pendiente, setPendiente] = useState<Origen | null>(null)
  useEffect(() => {
    setPendiente(null)
  }, [actual])
  const propias = actual === 'VACANTE'
  const editor = useEditorDePreguntas(vacante.id, propias)

  const cambio = useMutation({
    mutationFn: (origen: Origen) => elegirOrigenDePreguntas(vacante.id, origen),
    onSuccess: alCambiar,
    onError: (causa) => {
      setPendiente(null)
      alFallar(causa)
    },
  })

  // El banco del nivel se ofrece si es propio. Con un backend anterior al dato
  // (`undefined`) se ofrece como antes, para no esconder lo que sí existe.
  const prestado = vacante.bancoPrestado === true && actual === 'NIVEL'
  const ofreceNivel = vacante.bancoDelNivelPropio !== false || prestado
  const opciones: { valor: Origen; nombre: string }[] = [
    ...(ofreceNivel
      ? [
          {
            valor: 'NIVEL' as const,
            nombre: prestado ? 'El banco de RENASER para su nivel' : 'El banco de la empresa para su nivel',
          },
        ]
      : []),
    { valor: 'VACANTE', nombre: 'Preguntas propias de esta vacante' },
    { valor: 'SIN_EVALUACION', nombre: 'Sin evaluación' },
  ]

  return (
    <div className={estilos.ajuste}>
      <span className={estilos.etiquetaAjuste} id={`origen-${vacante.id}`}>
        De dónde salen sus preguntas
      </span>
      <div role="radiogroup" aria-labelledby={`origen-${vacante.id}`} className={estilos.interruptor}>
        {opciones.map((o) => (
          <label key={o.valor}>
            <input
              type="radio"
              name={`origen-preguntas-${vacante.id}`}
              value={o.valor}
              checked={(pendiente ?? actual) === o.valor}
              disabled={cambio.isPending}
              onChange={() => {
                setPendiente(o.valor)
                cambio.mutate(o.valor)
              }}
            />{' '}
            {o.nombre}
          </label>
        ))}
      </div>
      {prestado && (
        <span className={estilos.ayudaAjuste}>
          Esta vacante es de antes y sigue rindiendo el banco de RENASER. Si eliges otra opción,
          esta desaparece y no se puede volver a elegir.
        </span>
      )}
      {propias && (
        <p className={estilos.bancoQueRige}>
          {editor.isPending
            ? 'Mirando sus preguntas…'
            : editor.isError
              ? 'No se pudo leer el estado de sus preguntas.'
              : textoDelResumen(editor.data.resumen)}{' '}
          <Link to={rutas.adminPreguntasPropias(vacante.id)}>Escribir las preguntas →</Link>
        </p>
      )}
    </div>
  )
}
