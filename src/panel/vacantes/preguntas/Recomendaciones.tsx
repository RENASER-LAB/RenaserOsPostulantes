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
  type CriterioPropuesto,
  type EditorDePreguntas,
  type EntregablePropuesto,
  type EstadoDeLaRecomendacion,
} from '../../api/preguntasPropias'
import { useSondeoAcotado } from '../useSondeoAcotado'
import { falloDe, type Fallo } from './consultas'
import { nombreDelFormato, nombreDelTipo, puntosQueFaltan } from './formulario'
import { esPrueba, useModoDelEditor } from './modo'
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
  const modo = useModoDelEditor()
  const deLaPrueba = esPrueba(modo)
  // Las de la prueba y las de las preguntas de una misma vacante no se pisan (V67).
  const clave = [deLaPrueba ? 'panel-prueba-recomendacion' : 'panel-preguntas-recomendacion', vacanteId]
  const [indicacion, setIndicacion] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  /** Lo ya agregado de esta propuesta: «criterio» o «criterio-pregunta». */
  const [agregado, setAgregado] = useState<Set<string>>(new Set())

  const estado = useQuery({ queryKey: clave, queryFn: () => verRecomendacion(vacanteId, modo.ruta) })
  const sondeo = useSondeoAcotado(PASOS, () => void estado.refetch())
  const { empezar, parar, mirando } = sondeo
  const enCurso = estado.data?.estado === 'EN_CURSO'

  useEffect(() => {
    if (enCurso && !mirando) empezar()
    if (!enCurso && mirando) parar()
  }, [enCurso, mirando, empezar, parar])

  const faltan = puntosQueFaltan(total)

  const pedida = useMutation({
    mutationFn: () => pedirRecomendaciones(vacanteId, indicacion.trim() || null, modo.ruta),
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
      caso?: boolean
      entregables?: number[]
    }) =>
      agregarDeLaPropuesta(
        vacanteId,
        datos.propuestaId,
        deLaPrueba
          ? {
              criterios: datos.criterios,
              preguntas: datos.preguntas,
              caso: datos.caso ?? false,
              entregables: datos.entregables ?? [],
            }
          : { criterios: datos.criterios, preguntas: datos.preguntas },
        modo.ruta,
      ),
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
              {deLaPrueba
                ? `La IA completará los ${faltan} puntos que faltan, a partir de lo que describe la vacante, su puesto y la solicitud de talento: propone criterios con su parte calificada y quién la califica, sus preguntas, un caso si le sirve y los archivos donde se usan. Nada se agrega hasta que tú lo elijas.`
                : `La IA completará los ${faltan} puntos que faltan, a partir de lo que describe la vacante, su puesto y la solicitud de talento. Puede llenar tus criterios o proponer otros. Nada se agrega hasta que tú lo elijas.`}
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
                  marcas: [
                    ...propuesta.propuesta.map((_, i) => `${i}`),
                    'caso',
                    ...(propuesta.entregables ?? []).map((_, k) => `e${k}`),
                  ],
                  caso: Boolean(propuesta.caso?.enunciado),
                  entregables: (propuesta.entregables ?? []).map((_, k) => k),
                })
              }
            >
              Agregar todo
            </button>
          </div>
          {deLaPrueba && propuesta.caso?.enunciado && (
            <article className={estilos.propuesto}>
              <div className={estilos.cabeceraCriterio}>
                <h3 className={estilos.nombreCriterio}>El caso</h3>
                <button
                  className={estilos.secundarioPequeno}
                  type="button"
                  disabled={agregar.isPending || agregado.has('caso')}
                  onClick={() =>
                    agregar.mutate({
                      propuestaId: propuesta.propuestaId!,
                      criterios: [],
                      preguntas: [],
                      marcas: ['caso'],
                      caso: true,
                    })
                  }
                >
                  {agregado.has('caso') ? 'Agregado' : 'Agregar el caso'}
                </button>
              </div>
              <p className={estilos.enunciadoLargo}>{propuesta.caso.enunciado}</p>
              <p className={estilos.ayuda}>Solo llena lo que la prueba todavía no tenga escrito.</p>
            </article>
          )}
          {deLaPrueba &&
            (propuesta.entregables ?? []).map((e, k) => e.pregunta ? null : (
              <article className={estilos.propuesto} key={`e${k}`}>
                <div className={estilos.cabeceraCriterio}>
                  <h3 className={estilos.nombreCriterio}>{e.nombre}</h3>
                  <span className={estilos.chip}>{nombreDelFormato(e.formato)}</span>
                  <span className={estilos.chip}>{loQueCubreLaPropuesta(e, propuesta.propuesta)}</span>
                  <button
                    className={estilos.secundarioPequeno}
                    type="button"
                    disabled={agregar.isPending || agregado.has(`e${k}`)}
                    onClick={() =>
                      agregar.mutate({
                        propuestaId: propuesta.propuestaId!,
                        criterios: [],
                        preguntas: [],
                        marcas: [`e${k}`],
                        entregables: [k],
                      })
                    }
                  >
                    {agregado.has(`e${k}`) ? 'Agregado' : 'Agregar el entregable'}
                  </button>
                </div>
                {e.detalle && <p className={estilos.queEvalua}>{e.detalle}</p>}
                {e.queDebeTener && (
                  <p className={estilos.queDebeTener}>
                    <b>Qué debe tener:</b> {e.queDebeTener}
                  </p>
                )}
              </article>
            ))}
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
                    {c.preguntas.reduce((s, p) => s + p.puntos, 0) + (c.parteCalificada ?? 0)} pts
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
                {deLaPrueba && (c.parteCalificada ?? 0) > 0 && (
                  <p className={estilos.queEvalua}>
                    <b>Parte calificada:</b> {c.parteCalificada} pts ·{' '}
                    {c.calificador === 'PERSONA' ? 'una persona' : 'la IA'}
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
                          {!(deLaPrueba && p.tipo === 'ABIERTA') && (
                            <span className={estilos.chip}>{p.puntos} pts</span>
                          )}
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
                        {deLaPrueba &&
                          (propuesta.entregables ?? [])
                            .filter((e) => e.pregunta?.criterio === i && e.pregunta?.pregunta === j)
                            .map((e) => (
                              <p className={estilos.queEvalua} key={e.nombre}>
                                <b>Archivo de esta pregunta:</b> {e.nombre} · {nombreDelFormato(e.formato)}
                                {e.obligatorio === false ? ' · opcional' : ' · obligatorio'}
                              </p>
                            ))}
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

/** «Cubre: toda la prueba» o «Cubre: 2 preguntas propuestas», sin pedir «Mira». */
function loQueCubreLaPropuesta(e: EntregablePropuesto, criterios: CriterioPropuesto[]): string {
  if (e.todaLaPrueba !== false && (e.cubre ?? []).length === 0) return 'Cubre: toda la prueba'
  const enunciados = (e.cubre ?? [])
    .map((p) => criterios[p.criterio]?.preguntas[p.pregunta]?.enunciado)
    .filter((t): t is string => Boolean(t))
  return enunciados.length === 1 ? 'Cubre: 1 pregunta propuesta' : `Cubre: ${enunciados.length} preguntas propuestas`
}
