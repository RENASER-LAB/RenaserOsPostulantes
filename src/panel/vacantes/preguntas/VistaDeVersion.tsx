/**
 * Una versión de las preguntas propias, en solo lectura: la vista previa de
 * «Copiar de otra vacante» y la versión publicada para quien no puede editar.
 *
 * Es el mismo modo de lectura del editor, no una pantalla aparte: criterios con
 * sus puntos y lo que evalúan, las preguntas con sus opciones y puntos, lo que
 * debe tener cada abierta y la guía de calificación.
 *
 * Si la versión es de una prueba técnica (V67) enseña además el caso, el tiempo,
 * los entregables y la parte calificada de cada criterio. Lo decide lo que llega
 * del servidor, no quien la pinta: la misma vista sirve en la copia y en la
 * publicada.
 */

import type { VersionDePreguntas } from '../../api/preguntasPropias'
import { ContenidoDePregunta } from './BloqueCriterio'
import { LineaDeLaParteCalificada } from './CriterioDePrueba'
import { nombreDelFormato, nombreDelTipo, puntosDelCriterio } from './formulario'
import estilos from './EditorDePreguntas.module.css'

export function VistaDeVersion({ version }: { version: VersionDePreguntas }) {
  const prueba = version.prueba ?? null
  const entregables = prueba?.entregables ?? []
  const tiempo =
    prueba?.modalidad === 'CRONOMETRADA' && prueba.duracionMinutos
      ? ` · ${prueba.duracionMinutos} min`
      : prueba?.modalidad === 'PLAZO_ABIERTO' && prueba.plazoDias
        ? ` · ${prueba.plazoDias} ${prueba.plazoDias === 1 ? 'día' : 'días'}`
        : version.minutosObjetivo
          ? ` · ${version.minutosObjetivo} min`
          : ''
  return (
    <div className={estilos.criterios}>
      <p className={estilos.cifras}>
        <b>{version.total}</b> de 100 puntos · {version.cuantosCriterios}{' '}
        {version.cuantosCriterios === 1 ? 'criterio' : 'criterios'} · {version.cuantasPreguntas}{' '}
        {version.cuantasPreguntas === 1 ? 'pregunta' : 'preguntas'}
        {prueba && !prueba.cuestionario
          ? ` · ${entregables.length} ${entregables.length === 1 ? 'entregable' : 'entregables'}`
          : ''}
        {prueba?.cuestionario ? ' · cuestionario' : ''}
        {tiempo}
      </p>
      {prueba && (prueba.enunciado || prueba.consigna || prueba.materiales || prueba.herramientasPermitidas) && (
        <section className={estilos.criterio} aria-label="El caso">
          <h3 className={estilos.nombreCriterio}>El caso</h3>
          {prueba.enunciado && <p className={estilos.enunciadoLargo}>{prueba.enunciado}</p>}
          {prueba.consigna && (
            <p className={estilos.queEvalua}>
              <b>Adjunto:</b> {prueba.consigna.nombre ?? 'el enunciado en PDF o Word'}
            </p>
          )}
          {prueba.materiales && (
            <p className={estilos.queEvalua}>
              <b>Materiales:</b> {prueba.materiales}
            </p>
          )}
          {prueba.herramientasPermitidas && (
            <p className={estilos.queEvalua}>
              <b>Herramientas:</b> {prueba.herramientasPermitidas}
            </p>
          )}
        </section>
      )}
      {entregables.length > 0 && (
        <section className={estilos.criterio} aria-label="Los entregables">
          <h3 className={estilos.nombreCriterio}>Entregables</h3>
          <ul className={estilos.preguntas}>
            {entregables.map((e) => (
              <li key={e.id} className={estilos.pregunta}>
                <div className={estilos.cabeceraPregunta}>
                  <span className={estilos.chip}>{nombreDelFormato(e.formato)}</span>
                  <span className={estilos.chip}>{e.obligatorio ? 'obligatorio' : 'opcional'}</span>
                </div>
                <p className={estilos.enunciado}>{e.nombre}</p>
                {e.detalle && <p className={estilos.queEvalua}>{e.detalle}</p>}
                {e.queDebeTener && (
                  <p className={estilos.queDebeTener}>
                    <b>Qué debe tener:</b> {e.queDebeTener}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {version.guiaCalificacion && (
        <p className={estilos.queEvalua}>
          <b>Guía de calificación:</b> {version.guiaCalificacion}
        </p>
      )}
      {version.criterios.map((c) => (
        <section className={estilos.criterio} key={c.id} aria-label={`Criterio ${c.nombre}`}>
          <header className={estilos.cabeceraCriterio}>
            <h3 className={estilos.nombreCriterio}>{c.nombre}</h3>
            <span className={estilos.puntosCriterio}>{puntosDelCriterio(c)}</span>
          </header>
          {c.queEvalua && (
            <p className={estilos.queEvalua}>
              <b>Qué evalúa:</b> {c.queEvalua}
            </p>
          )}
          {prueba && <LineaDeLaParteCalificada criterio={c} entregables={entregables} />}
          {(c.preguntas.length > 0 || !prueba) && (
            <ol className={estilos.preguntas}>
              {c.preguntas.map((p) => (
                <li key={p.id}>
                  <article className={estilos.pregunta}>
                    <div className={estilos.cabeceraPregunta}>
                      <span className={estilos.chip}>{nombreDelTipo(p.tipo)}</span>
                      {!(prueba && p.tipo === 'ABIERTA') && (
                        <span className={estilos.chip}>{p.puntos} pts</span>
                      )}
                    </div>
                    <ContenidoDePregunta pregunta={p} />
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  )
}
