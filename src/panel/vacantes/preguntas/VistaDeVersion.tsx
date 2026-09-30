/**
 * Una versión de las preguntas propias, en solo lectura: la vista previa de
 * «Copiar de otra vacante» y la versión publicada para quien no puede editar.
 *
 * Es el mismo modo de lectura del editor, no una pantalla aparte: criterios con
 * sus puntos y lo que evalúan, las preguntas con sus opciones y puntos, lo que
 * debe tener cada abierta y la guía de calificación.
 */

import type { VersionDePreguntas } from '../../api/preguntasPropias'
import { ContenidoDePregunta } from './BloqueCriterio'
import { nombreDelTipo, puntosDelCriterio } from './formulario'
import estilos from './EditorDePreguntas.module.css'

export function VistaDeVersion({ version }: { version: VersionDePreguntas }) {
  return (
    <div className={estilos.criterios}>
      <p className={estilos.cifras}>
        <b>{version.total}</b> de 100 puntos · {version.cuantosCriterios}{' '}
        {version.cuantosCriterios === 1 ? 'criterio' : 'criterios'} · {version.cuantasPreguntas}{' '}
        {version.cuantasPreguntas === 1 ? 'pregunta' : 'preguntas'}
        {version.minutosObjetivo ? ` · ${version.minutosObjetivo} min` : ''}
      </p>
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
          <ol className={estilos.preguntas}>
            {c.preguntas.map((p) => (
              <li key={p.id}>
                <article className={estilos.pregunta}>
                  <div className={estilos.cabeceraPregunta}>
                    <span className={estilos.chip}>{nombreDelTipo(p.tipo)}</span>
                    <span className={estilos.chip}>{p.puntos} pts</span>
                  </div>
                  <ContenidoDePregunta pregunta={p} />
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
