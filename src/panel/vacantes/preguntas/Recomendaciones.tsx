/**
 * Recomendaciones por IA: la IA propone criterios y preguntas, una persona
 * decide qué agrega.
 *
 * Cuatro cosas que no se pueden hacer mal:
 *   0. **Completa lo que falta, no empieza de cero.** Antes de pedirla se dice
 *      cuántos puntos va a proponer; con el borrador en 100 no se llama a nadie.
 *   1. **Un 202 no es una propuesta.** Se pidió; lo que haya se lee del GET, con
 *      el mismo sondeo acotado que el cuestionario técnico.
 *   2. **«No se encoló» no es un error.** Sin cupo o con la IA apagada se dice
 *      tal cual, en tono de estado.
 *   3. **Nada se agrega solo.** Cada criterio y cada pregunta tiene su
 *      «Agregar», y hay un «Agregar todo»; el borrador no cambia hasta pulsarlos.
 */

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  agregarDeLaPropuesta,
  pedirRecomendaciones,
  verRecomendacion,
  type CriterioDeLaVersion,
  type EditorDePreguntas,
  type EstadoDeLaRecomendacion,
} from '../../api/preguntasPropias'
import { useSondeoAcotado } from '../useSondeoAcotado'
import { falloDe, type Fallo } from './consultas'
import { nombreDelTipo, puntosQueFaltan } from './formulario'
import { MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

const PASOS = [2000, 3000, 5000, 8000, 13000, 20000] as const

interface Props {
  vacanteId: number
  /** Los puntos que ya tiene el borrador (o la publicada, si no hay borrador). */
  total: number
  criterios: CriterioDeLaVersion[]
  alAgregar: (editor: EditorDePreguntas) => void
  alCerrar: () => void
}

export function Recomendaciones({ vacanteId, total, criterios, alAgregar, alCerrar }: Props) {
  const cache = useQueryClient()
  const clave = ['panel-preguntas-recomendacion', vacanteId]
  const [indicacion, setIndicacion] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  /** Lo ya agregado de esta propuesta: «criterio» o «criterio-pregunta». */
  const [agregado, setAgregado] = useState<Set<string>>(new Set())

  const estado = useQuery({ queryKey: clave, queryFn: () => verRecomendacion(vacanteId) })
  const sondeo = useSondeoAcotado(PASOS, () => void estado.refetch())
  const { empezar, parar, mirando } = sondeo
  const enCurso = estado.data?.estado === 'EN_CURSO'

  useEffect(() => {
    if (enCurso && !mirando) empezar()
    if (!enCurso && mirando) parar()
  }, [enCurso, mirando, empezar, parar])

  const faltan = puntosQueFaltan(total)

  const pedida = useMutation({
    mutationFn: () => pedirRecomendaciones(vacanteId, indicacion.trim() || null),
    onSuccess: (r) => {
      setFallo(null)
      setAviso(r.encolada ? null : r.mensaje)
      setAgregado(new Set())
      if (r.encolada) {
        void cache.invalidateQueries({ queryKey: clave })
        empezar()
      }
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo pedir la recomendación.')),
  })

  const agregar = useMutation({
    mutationFn: (datos: {
      propuestaId: number
      criterios: number[]
      preguntas: { criterio: number; pregunta: number }[]
      marcas: string[]
    }) =>
      agregarDeLaPropuesta(vacanteId, datos.propuestaId, {
        criterios: datos.criterios,
        preguntas: datos.preguntas,
      }),
    onSuccess: (editor, datos) => {
      setFallo(null)
      setAgregado((antes) => new Set([...antes, ...datos.marcas]))
      alAgregar(editor)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo agregar.')),
  })

  const propuesta: EstadoDeLaRecomendacion | undefined = estado.data
  const nombreExistente = (id: number | null) =>
    criterios.find((c) => c.id === id)?.nombre ?? 'un criterio del borrador'

  return (
    <section className={estilos.panelIa} aria-label="Recomendaciones por IA">
      <h2>Recomendaciones por IA</h2>

      {faltan === 0 ? (
        <p className={estilos.estado}>
          El borrador ya suma 100 puntos: no queda sitio. Quita puntos o preguntas para que la IA
          complete lo que falte.
        </p>
      ) : (
        !enCurso && (
          <>
            <p className={estilos.explica}>
              La IA completará los {faltan} puntos que faltan, a partir de lo que describe la
              vacante, su puesto y la solicitud de talento. Puede llenar tus criterios o proponer
              otros. Nada se agrega hasta que tú lo elijas.
            </p>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>
                Indicación <span className={estilos.cuenta}>(opcional)</span>
              </span>
              <textarea
                className={estilos.area}
                rows={2}
                maxLength={1000}
                placeholder="Por ejemplo: 4 criterios, 12 preguntas, énfasis en Excel"
                value={indicacion}
                onChange={(e) => setIndicacion(e.target.value)}
              />
            </label>
            <div className={estilos.acciones}>
              <button
                className={estilos.guardar}
                type="button"
                onClick={() => pedida.mutate()}
                disabled={pedida.isPending}
              >
                {pedida.isPending ? 'Pidiendo…' : 'Pedir recomendaciones'}
              </button>
              <button className={estilos.secundario} type="button" onClick={alCerrar}>
                Cerrar
              </button>
            </div>
          </>
        )
      )}

      {aviso && (
        <p className={estilos.estado} role="status">
          {aviso}
        </p>
      )}

      {enCurso && (
        <p className={estilos.estado} role="status">
          {sondeo.agotado
            ? 'La IA sigue trabajando. Dejamos de mirar solos: vuelve a abrir esta sección en un momento.'
            : `La IA está proponiendo criterios y preguntas… ${Math.min(sondeo.vueltas + 1, sondeo.total)} de ${sondeo.total}`}
        </p>
      )}

      {propuesta?.estado === 'FALLIDA' && (
        <p className={estilos.error} role="alert">
          La IA no pudo proponer nada esta vez. {propuesta.motivo}
        </p>
      )}

      {propuesta?.estado === 'LISTA' && propuesta.propuestaId !== null && propuesta.propuesta.length > 0 && (
        <>
          <p className={estilos.explica}>
            Propuesta para {propuesta.puntosQueFaltan} puntos
            {propuesta.indicacion ? ` · «${propuesta.indicacion}»` : ''}.
          </p>
          <div className={estilos.acciones}>
            <button
              className={estilos.secundario}
              type="button"
              disabled={agregar.isPending || agregado.size > 0}
              onClick={() =>
                agregar.mutate({
                  propuestaId: propuesta.propuestaId!,
                  criterios: propuesta.propuesta.map((_, i) => i),
                  preguntas: [],
                  marcas: propuesta.propuesta.map((_, i) => `${i}`),
                })
              }
            >
              Agregar todo
            </button>
          </div>
          {propuesta.propuesta.map((c, i) => {
            const todoAgregado = agregado.has(`${i}`)
            return (
              <article className={estilos.propuesto} key={i}>
                <div className={estilos.cabeceraCriterio}>
                  <h3 className={estilos.nombreCriterio}>
                    {c.criterioExistenteId !== null
                      ? `Para «${nombreExistente(c.criterioExistenteId)}»`
                      : c.nombre}
                  </h3>
                  <span className={estilos.puntosCriterio}>
                    {c.preguntas.reduce((s, p) => s + p.puntos, 0)} pts
                  </span>
                  <button
                    className={estilos.secundarioPequeno}
                    type="button"
                    disabled={agregar.isPending || todoAgregado}
                    onClick={() =>
                      agregar.mutate({
                        propuestaId: propuesta.propuestaId!,
                        criterios: [i],
                        preguntas: [],
                        marcas: [`${i}`],
                      })
                    }
                  >
                    {todoAgregado ? 'Agregado' : c.criterioExistenteId !== null ? 'Agregar sus preguntas' : 'Agregar el criterio'}
                  </button>
                </div>
                {c.queEvalua && (
                  <p className={estilos.queEvalua}>
                    <b>Qué evalúa:</b> {c.queEvalua}
                  </p>
                )}
                <ol className={estilos.preguntas}>
                  {c.preguntas.map((p, j) => {
                    const hecha = todoAgregado || agregado.has(`${i}-${j}`)
                    return (
                      <li key={j} className={estilos.pregunta}>
                        <div className={estilos.cabeceraPregunta}>
                          {c.criterioExistenteId !== null && <span className={estilos.nueva}>Nueva</span>}
                          <span className={estilos.chip}>{nombreDelTipo(p.tipo)}</span>
                          <span className={estilos.chip}>{p.puntos} pts</span>
                          <button
                            className={estilos.secundarioPequeno}
                            type="button"
                            disabled={agregar.isPending || hecha}
                            onClick={() =>
                              agregar.mutate({
                                propuestaId: propuesta.propuestaId!,
                                criterios: [],
                                preguntas: [{ criterio: i, pregunta: j }],
                                marcas: [`${i}-${j}`],
                              })
                            }
                          >
                            {hecha ? 'Agregada' : 'Agregar'}
                          </button>
                        </div>
                        <p className={estilos.enunciado}>{p.enunciado}</p>
                        {p.opciones.length > 0 && (
                          <ul className={estilos.opciones}>
                            {p.opciones.map((o, k) => (
                              <li className={estilos.opcion} key={k}>
                                <span>{o.texto || `Nivel ${k + 1}`}</span>
                                <span>{o.puntos}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {p.queDebeTener && (
                          <p className={estilos.queDebeTener}>
                            <b>Qué debe tener:</b> {p.queDebeTener}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </article>
            )
          })}
        </>
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}
