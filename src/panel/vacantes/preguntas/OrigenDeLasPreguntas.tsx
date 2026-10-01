/**
 * «Qué responderá quien postule»: de dónde salen las preguntas de la vacante
 * (V66). Tres opciones, y no siempre las tres:
 *
 *   - **Preguntas propias de esta vacante**, la primera: toda vacante nueva
 *     nace con ella marcada, también en una empresa con banco propio
 *     (decisión del 30/09/2026). Con su estado y el botón al editor.
 *   - **El banco de la empresa para su nivel**, solo si la empresa tiene uno
 *     PROPIO publicado para ese nivel. El de RENASER no cuenta para las demás.
 *   - **Sin evaluación.**
 *
 * Una vacante de antes que rinde el banco prestado lo enseña marcado con su
 * nombre real, «El banco de RENASER para su nivel», y si se cambia de opción esa
 * desaparece: el servidor ya no la acepta.
 *
 * Pinta DOS celdas de la rejilla de su grupo: las opciones, y —con las propias
 * elegidas— su estado con el botón al editor, que ocupa el sitio donde el banco
 * del nivel dice qué evaluación responderá. Elegir a la izquierda, lo que sale
 * de ello a la derecha; en el teléfono, una debajo de otra.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { VacantePanel } from '../../api/tipos'
import { elegirOrigenDePreguntas } from '../../api/preguntasPropias'
import { rutas } from '@/rutas'
import { useEditorDePreguntas } from './consultas'
import { textoDelResumen } from './formulario'
import estilos from '../Vacante.module.css'
import propio from './OrigenDeLasPreguntas.module.css'

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

  /*
   * Si hay un cambio en vuelo, desde el mismo instante en que se pide: el estado
   * de la mutación llega en el render siguiente, y dos flechas seguidas caben
   * antes. Es lo que impide el doble envío, ahora que los radios no se apagan.
   */
  const enVuelo = useRef(false)
  const cambio = useMutation({
    mutationFn: (origen: Origen) => elegirOrigenDePreguntas(vacante.id, origen),
    onSuccess: alCambiar,
    onError: (causa) => {
      setPendiente(null)
      alFallar(causa)
    },
    onSettled: () => {
      enVuelo.current = false
    },
  })

  // El banco del nivel se ofrece si es propio. Con un backend anterior al dato
  // (`undefined`) se ofrece como antes, para no esconder lo que sí existe.
  const prestado = vacante.bancoPrestado === true && actual === 'NIVEL'
  const ofreceNivel = vacante.bancoDelNivelPropio !== false || prestado
  /*
   * ⚠️ Ninguna ayuda de «propias» ni de «sin evaluación» nombra el banco: a una
   * empresa sin banco propio no se le habla de uno que no tiene (AC-01).
   */
  const opciones: { valor: Origen; nombre: string; ayuda: string }[] = [
    {
      valor: 'VACANTE',
      nombre: 'Preguntas propias de esta vacante',
      ayuda: 'Las escribes tú para este puesto, y se publican antes que la vacante.',
    },
    ...(ofreceNivel
      ? [
          prestado
            ? {
                valor: 'NIVEL' as const,
                nombre: 'El banco de RENASER para su nivel',
                ayuda:
                  'Esta vacante es de antes y sigue rindiendo el banco de RENASER. Si eliges otra opción, esta desaparece y no se puede volver a elegir.',
              }
            : {
                valor: 'NIVEL' as const,
                nombre: 'El banco de la empresa para su nivel',
                ayuda: 'Las mismas para todas las vacantes de este nivel. Se cambian en Configuración.',
              },
        ]
      : []),
    {
      valor: 'SIN_EVALUACION',
      nombre: 'Sin evaluación',
      ayuda: 'Quien postule no responde preguntas: lo siguiente que rinde es la etapa técnica.',
    },
  ]
  const idDe = (o: Origen, parte: 'nombre' | 'ayuda') => `origen-${vacante.id}-${o}-${parte}`

  return (
    <>
      <div className={estilos.ajuste}>
        <span className={estilos.etiquetaAjuste} id={`origen-${vacante.id}`}>
          De dónde salen sus preguntas
        </span>
        <div role="radiogroup" aria-labelledby={`origen-${vacante.id}`} className={propio.opciones}>
          {opciones.map((o) => (
            // La pastilla entera es el blanco de la pulsación; el nombre accesible del
            // radio es solo su nombre, y la ayuda va como descripción.
            <label key={o.valor} className={propio.opcion}>
              <span className={propio.marca}>
                <input
                  type="radio"
                  name={`origen-preguntas-${vacante.id}`}
                  value={o.valor}
                  aria-labelledby={idDe(o.valor, 'nombre')}
                  aria-describedby={idDe(o.valor, 'ayuda')}
                  checked={(pendiente ?? actual) === o.valor}
                  /*
                   * ⚠️ Ocupado, pero NO `disabled` (QA-PP-10). Con el teclado, cada
                   * flecha marca la opción siguiente y la guarda; un radio enfocado
                   * que se deshabilita suelta el foco al <body>, y la flecha
                   * siguiente ya no llegaba a la tercera. Mientras se guarda, el
                   * cambio se ignora y React deja marcada la que se está guardando.
                   */
                  aria-disabled={cambio.isPending || undefined}
                  onChange={() => {
                    if (enVuelo.current) return
                    enVuelo.current = true
                    setPendiente(o.valor)
                    cambio.mutate(o.valor)
                  }}
                />
              </span>
              <span className={propio.nombre} id={idDe(o.valor, 'nombre')}>
                {o.nombre}
              </span>
              <span className={propio.ayuda} id={idDe(o.valor, 'ayuda')}>
                {o.ayuda}
              </span>
            </label>
          ))}
        </div>
      </div>

      {propias && (
        <div className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Sus preguntas propias</span>
          <p className={estilos.bancoQueRige}>
            {editor.isPending
              ? 'Mirando sus preguntas…'
              : editor.isError
                ? 'No se pudo leer el estado de sus preguntas.'
                : textoDelResumen(editor.data.resumen)}
          </p>
          <Link className={propio.escribir} to={rutas.adminPreguntasPropias(vacante.id)}>
            Escribir las preguntas →
          </Link>
        </div>
      )}
    </>
  )
}
