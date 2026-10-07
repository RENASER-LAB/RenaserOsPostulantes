/**
 * Una versión de las preguntas propias, en solo lectura: la vista previa de
 * «Copiar de otra vacante» y la versión publicada para quien no puede editar.
 *
 * Es el mismo modo de lectura del editor, no una pantalla aparte: criterios con
 * sus puntos y lo que evalúan, las preguntas con sus opciones y puntos, lo que
 * debe tener cada abierta y la guía de calificación.
 *
 * Los criterios se pliegan como en el editor, con su misma línea —«▸ Análisis
 * financiero · 30 pts (sistema 5 + IA 25) · 2 preguntas · 1 archivo»— y
 * «Desplegar todo» / «Plegar todo», y al entrar **están todos plegados**: así se
 * lee la prueba de un vistazo. El caso, los materiales, los entregables y la
 * guía no se pliegan.
 *
 * Si la versión es de una prueba técnica (V67) enseña además el caso, el tiempo,
 * los entregables y la parte calificada de cada criterio. Lo decide lo que llega
 * del servidor, no quien la pinta: la misma vista sirve en la copia y en la
 * publicada.
 */

import type { VersionDePreguntas } from '../../api/preguntasPropias'
import {
  archivosDeLasPreguntas,
  ContenidoDePregunta,
  NombrePlegable,
  PlegarTodo,
  ResumenDelCriterio,
} from './BloqueCriterio'
import { LineaDeLaParteCalificada } from './CriterioDePrueba'
import { textoDeLoQueCubre } from './Entregables'
import { cuentaDelCriterio, nombreDelFormato, nombreDelTipo } from './formulario'
import { numerosDePreguntas, useCriteriosPlegados } from './navegacion'
import estilos from './EditorDePreguntas.module.css'

export function VistaDeVersion({ version }: { version: VersionDePreguntas }) {
  const plegado = useCriteriosPlegados(version)
  const prueba = version.prueba ?? null
  const entregables = prueba?.entregables ?? []
  const numeros = numerosDePreguntas(version)
  const tiempo =
    prueba?.modalidad === 'CRONOMETRADA' && prueba.duracionMinutos
      ? ` · ${prueba.duracionMinutos} min`
      : prueba?.modalidad === 'PLAZO_ABIERTO' && prueba.plazoDias
        ? ` · ${prueba.plazoDias} ${prueba.plazoDias === 1 ? 'día' : 'días'}`
        : prueba?.modalidad === 'PLAZO_ABIERTO'
          ? ' · sin cronómetro'
          : version.minutosObjetivo
            ? ` · ${version.minutosObjetivo} min`
            : ''
  return (
    <div className={estilos.criterios}>
      <p className={estilos.cifras}>
        <b>{version.total}</b> de 100 puntos · {version.cuantosCriterios}{' '}
        {version.cuantosCriterios === 1 ? 'criterio' : 'criterios'} · {version.cuantasPreguntas}{' '}
        {version.cuantasPreguntas === 1 ? 'pregunta' : 'preguntas'}
        {prueba && entregables.length > 0
          ? ` · ${entregables.length} ${entregables.length === 1 ? 'entregable' : 'entregables'}`
          : ''}
        {tiempo}
      </p>
      {/* V68: el caso es opcional y es solo el enunciado y su adjunto. Sin caso no
          hay bloque «El caso»: los materiales y las herramientas son de la
          configuración y van aparte. */}
      {prueba && (prueba.enunciado || prueba.consigna) && (
        <section className={estilos.criterio} aria-label="El caso">
          <h3 className={estilos.nombreCriterio}>El caso</h3>
          {prueba.enunciado && <p className={estilos.enunciadoLargo}>{prueba.enunciado}</p>}
          {prueba.consigna && (
            <p className={estilos.queEvalua}>
              <b>Adjunto:</b> {prueba.consigna.nombre ?? 'el enunciado en PDF o Word'}
            </p>
          )}
        </section>
      )}
      {prueba && (prueba.materiales || prueba.herramientasPermitidas) && (
        <section className={estilos.criterio} aria-label="Materiales y herramientas">
          <h3 className={estilos.nombreCriterio}>Materiales y herramientas</h3>
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
                  <span className={estilos.chip}>
                    {e.alcance === 'PREGUNTA' && e.preguntaId != null
                      ? `De la pregunta ${numeros.get(e.preguntaId) ?? ''}`.trim()
                      : textoDeLoQueCubre(e, numeros)}
                  </span>
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
      {version.criterios.length > 0 && (
        <PlegarTodo alDesplegar={plegado.desplegarTodo} alPlegar={plegado.plegarTodo} />
      )}
      {version.criterios.map((c) => {
        const abierto = plegado.abierto(c.id)
        return (
          <section className={estilos.criterio} key={c.id} aria-label={`Criterio ${c.nombre}`}>
            <header className={estilos.cabeceraCriterio}>
              <NombrePlegable titulo={c.nombre} abierto={abierto} alAlternar={() => plegado.alternar(c.id)} />
              <ResumenDelCriterio
                criterio={c}
                cuenta={cuentaDelCriterio(c.preguntas.length, prueba ? archivosDeLasPreguntas(c.preguntas, entregables) : 0)}
              />
            </header>
            {abierto && (
              <>
                {c.queEvalua && (
                  <p className={estilos.queEvalua}>
                    <b>Qué evalúa:</b> {c.queEvalua}
                  </p>
                )}
                {prueba && <LineaDeLaParteCalificada criterio={c} entregables={entregables} numeros={numeros} />}
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
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
