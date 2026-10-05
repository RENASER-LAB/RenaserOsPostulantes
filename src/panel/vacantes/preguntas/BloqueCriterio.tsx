/**
 * Un criterio del borrador con sus preguntas, y la tarjeta de cada pregunta.
 *
 * El criterio es una superficie blanca; sus preguntas van hundidas dentro. Sus
 * puntos no se escriben: son la suma de sus preguntas (y, en la prueba, de su
 * parte calificada).
 *
 * **Es plegable (V68)**, en los dos editores. Plegado ocupa una línea —«▸
 * Análisis financiero · 30 pts (sistema 5 + IA 25) · 2 preguntas · 1
 * archivo»— y, si le falta algo, el borde y un punto se ponen en ámbar con la
 * falta escrita al lado. Mover, editar y quitar el criterio siguen a la mano
 * plegado. Desplegado: lo que evalúa, en la prueba su parte calificada y lo que
 * mira, y sus preguntas.
 *
 * Cada criterio y cada pregunta se editan en su sitio, se mueven arriba o abajo
 * y se quitan. Una pregunta cambia de criterio desde su selector, no arrastrando.
 * En la prueba, cada pregunta puede pedir un archivo dentro de su tarjeta.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  editarCriterio,
  moverCriterio,
  moverPregunta,
  quitarCriterio,
  quitarPregunta,
  type CriterioDeLaVersion,
  type EditorDePreguntas,
  type EntregableDeLaVersion,
  type PreguntaDeLaVersion,
  type VersionDePreguntas,
} from '../../api/preguntasPropias'
import { FormularioCriterioDePrueba, LineaDeLaParteCalificada } from './CriterioDePrueba'
import { ArchivoDeLaPregunta } from './Entregables'
import { esPrueba, useModoDelEditor } from './modo'
import { IconoAbajo, IconoArriba, IconoCruz, IconoDesplegar, IconoLapiz, IconoMas } from '@/ui/Iconos'
import { falloDe, type Fallo } from './consultas'
import { FormularioPregunta } from './FormularioPregunta'
import {
  avisoAlQuitarCriterio,
  cuentaDelCriterio,
  desdePregunta,
  nombreDelTipo,
  preguntaNueva,
  puntosConDesglose,
} from './formulario'
import { faltasPorCriterio, numerosDePreguntas, type useCriteriosAbiertos } from './navegacion'
import { BotonIcono, MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

interface PropsBloque {
  vacanteId: number
  /** Nulo: el bloque de las preguntas que se quedaron sin criterio. */
  criterio: CriterioDeLaVersion | null
  preguntas: PreguntaDeLaVersion[]
  todos: CriterioDeLaVersion[]
  editable: boolean
  primero: boolean
  ultimo: boolean
  alCambiar: (editor: EditorDePreguntas) => void
  /** Solo en la prueba (V67): sus entregables, para decir qué mira y el archivo de cada pregunta. */
  entregables?: EntregableDeLaVersion[]
  /** Desplegado o plegado (V68). Sin `alAlternar`, siempre desplegado. */
  abierto?: boolean
  alAlternar?: () => void
  /** Lo que le falta, tal como lo dice el servidor. */
  faltas?: string[]
  /** El número de cada pregunta en la versión: «Pregunta 4». */
  numeros?: Map<number, number>
}

export function BloqueCriterio({
  vacanteId,
  criterio,
  preguntas,
  todos,
  editable,
  primero,
  ultimo,
  alCambiar,
  entregables = [],
  abierto = true,
  alAlternar,
  faltas = [],
  numeros = new Map(),
}: PropsBloque) {
  const modo = useModoDelEditor()
  const deLaPrueba = esPrueba(modo)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(criterio?.nombre ?? '')
  const [queEvalua, setQueEvalua] = useState(criterio?.queEvalua ?? '')
  const [quitando, setQuitando] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const alFallar = (causa: unknown) => setFallo(falloDe(causa, 'No se pudo guardar.'))
  const alTerminar = (editor: EditorDePreguntas) => {
    setFallo(null)
    alCambiar(editor)
  }

  const guardar = useMutation({
    mutationFn: () =>
      editarCriterio(vacanteId, criterio!.id, {
        nombre: nombre.trim(),
        queEvalua: queEvalua.trim() || null,
      }),
    onSuccess: (e) => {
      setEditando(false)
      alTerminar(e)
    },
    onError: alFallar,
  })
  const mover = useMutation({
    mutationFn: (direccion: 'ARRIBA' | 'ABAJO') =>
      moverCriterio(vacanteId, criterio!.id, direccion, modo.ruta),
    onSuccess: alTerminar,
    onError: alFallar,
  })
  const quitar = useMutation({
    mutationFn: () => quitarCriterio(vacanteId, criterio!.id, modo.ruta),
    onSuccess: alTerminar,
    onError: alFallar,
  })

  const titulo = criterio ? criterio.nombre : 'Sin criterio'
  const ocupado = guardar.isPending || mover.isPending || quitar.isPending
  const plegable = criterio !== null && alAlternar !== undefined
  const desplegado = !plegable || abierto
  const archivoDe = (preguntaId: number) =>
    entregables.find((e) => e.alcance === 'PREGUNTA' && e.preguntaId === preguntaId) ?? null
  const archivos = preguntas.filter((p) => archivoDe(p.id) !== null).length

  return (
    <section
      className={`${estilos.criterio} ${estilos.destino}${faltas.length > 0 ? ` ${estilos.criterioConFalta}` : ''}`}
      aria-label={`Criterio ${titulo}`}
      id={criterio ? `criterio-${criterio.id}` : 'sin-criterio'}
      tabIndex={-1}
    >
      <header className={estilos.cabeceraCriterio}>
        <h3 className={estilos.nombreCriterio}>
          {plegable ? (
            <button className={estilos.plegador} type="button" aria-expanded={abierto} onClick={alAlternar}>
              <IconoDesplegar
                tamano={18}
                className={abierto ? estilos.flecha : `${estilos.flecha} ${estilos.flechaPlegada}`}
              />
              {titulo}
            </button>
          ) : (
            titulo
          )}
        </h3>
        {criterio && <span className={estilos.puntosCriterio}>{puntosConDesglose(criterio)}</span>}
        {criterio && plegable && (
          <span className={estilos.cuentaCriterio}>{cuentaDelCriterio(preguntas.length, deLaPrueba ? archivos : 0)}</span>
        )}
        {faltas.length > 0 && <span className={estilos.puntoFalta} aria-hidden="true" />}
        {criterio && editable && !editando && (
          <div className={estilos.botones}>
            <BotonIcono
              etiqueta={`Subir el criterio ${criterio.nombre}`}
              onClick={() => mover.mutate('ARRIBA')}
              disabled={primero || ocupado}
            >
              <IconoArriba />
            </BotonIcono>
            <BotonIcono
              etiqueta={`Bajar el criterio ${criterio.nombre}`}
              onClick={() => mover.mutate('ABAJO')}
              disabled={ultimo || ocupado}
            >
              <IconoAbajo />
            </BotonIcono>
            <BotonIcono
              etiqueta={`Editar el criterio ${criterio.nombre}`}
              onClick={() => {
                setNombre(criterio.nombre)
                setQueEvalua(criterio.queEvalua ?? '')
                setEditando(true)
              }}
              disabled={ocupado}
            >
              <IconoLapiz />
            </BotonIcono>
            <BotonIcono
              etiqueta={`Quitar el criterio ${criterio.nombre}`}
              onClick={() => (preguntas.length > 0 ? setQuitando(true) : quitar.mutate())}
              disabled={ocupado}
            >
              <IconoCruz />
            </BotonIcono>
          </div>
        )}
        {plegable && !abierto && faltas.length > 0 && (
          <span className={estilos.faltaCriterio}>
            {faltas[0]}
            {faltas.length > 1 ? ` (y ${faltas.length - 1} más)` : ''}
          </span>
        )}
      </header>

      {criterio && editando && deLaPrueba ? (
        <FormularioCriterioDePrueba
          vacanteId={vacanteId}
          criterio={criterio}
          alGuardar={(e) => {
            setEditando(false)
            alTerminar(e)
          }}
          alCancelar={() => setEditando(false)}
        />
      ) : criterio && editando ? (
        <form
          className={estilos.formulario}
          aria-label={`Editar el criterio ${criterio.nombre}`}
          onSubmit={(e) => {
            e.preventDefault()
            if (nombre.trim()) guardar.mutate()
          }}
        >
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Nombre</span>
            <input
              className={estilos.entrada}
              type="text"
              maxLength={120}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>
              Qué evalúa <span className={estilos.cuenta}>(opcional · {queEvalua.length} de 1000)</span>
            </span>
            <textarea
              className={estilos.area}
              rows={2}
              maxLength={1000}
              value={queEvalua}
              onChange={(e) => setQueEvalua(e.target.value)}
            />
          </label>
          <div className={estilos.acciones}>
            <button className={estilos.guardar} type="submit" disabled={guardar.isPending || !nombre.trim()}>
              {guardar.isPending ? 'Guardando…' : 'Guardar el criterio'}
            </button>
            <button className={estilos.secundario} type="button" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        desplegado && (
          <>
            {criterio?.queEvalua && (
              <p className={estilos.queEvalua}>
                <b>Qué evalúa:</b> {criterio.queEvalua}
              </p>
            )}
            {criterio && deLaPrueba && (
              <LineaDeLaParteCalificada criterio={criterio} entregables={entregables} numeros={numeros} />
            )}
          </>
        )
      )}

      {quitando && criterio && (
        <div className={estilos.confirmacion} role="alertdialog" aria-label="Quitar el criterio">
          <span>{avisoAlQuitarCriterio(preguntas.length)}</span>
          <button
            className={estilos.peligroso}
            type="button"
            onClick={() => {
              setQuitando(false)
              quitar.mutate()
            }}
          >
            Quitar el criterio
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setQuitando(false)}>
            Cancelar
          </button>
        </div>
      )}

      {desplegado && (
        <>
          {criterio && preguntas.length === 0 && !deLaPrueba && (
            <p className={estilos.aviso}>Sin preguntas: así no se publica.</p>
          )}
          {criterio && preguntas.length === 0 && deLaPrueba && (criterio.puntosCalificados ?? 0) === 0 && (
            <p className={estilos.aviso}>Sin cerradas ni parte calificada: así no se publica.</p>
          )}
          {!criterio && (
            <p className={estilos.aviso}>
              Estas preguntas no están en ningún criterio. Muévelas con su selector «Criterio»: sin
              criterio no se publica.
            </p>
          )}

          {preguntas.length > 0 && (
            <ol className={estilos.preguntas}>
              {preguntas.map((p, i) => (
                <li key={p.id}>
                  <TarjetaPregunta
                    vacanteId={vacanteId}
                    pregunta={p}
                    numero={numeros.get(p.id)}
                    criterio={criterio}
                    todos={todos}
                    editable={editable}
                    primera={i === 0}
                    ultima={i === preguntas.length - 1}
                    alCambiar={alTerminar}
                    archivo={deLaPrueba ? archivoDe(p.id) : undefined}
                  />
                </li>
              ))}
            </ol>
          )}

          {criterio &&
            editable &&
            (agregando ? (
              <FormularioPregunta
                vacanteId={vacanteId}
                preguntaId={null}
                inicial={preguntaNueva(criterio.id)}
                criterios={todos}
                alGuardar={(e) => {
                  setAgregando(false)
                  alTerminar(e)
                }}
                alCancelar={() => setAgregando(false)}
              />
            ) : (
              <button className={estilos.secundarioPequeno} type="button" onClick={() => setAgregando(true)}>
                <IconoMas tamano={18} />
                Agregar pregunta
              </button>
            ))}
        </>
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}

interface PropsTarjeta {
  vacanteId: number
  pregunta: PreguntaDeLaVersion
  /** Su número en la versión: «Pregunta 4». */
  numero?: number
  criterio: CriterioDeLaVersion | null
  todos: CriterioDeLaVersion[]
  editable: boolean
  primera: boolean
  ultima: boolean
  alCambiar: (editor: EditorDePreguntas) => void
  /** Solo en la prueba: el archivo que pide (nulo si no pide); sin la prop, no se ofrece. */
  archivo?: EntregableDeLaVersion | null
}

function TarjetaPregunta({
  vacanteId,
  pregunta,
  numero,
  criterio,
  todos,
  editable,
  primera,
  ultima,
  alCambiar,
  archivo,
}: PropsTarjeta) {
  const modo = useModoDelEditor()
  const [editando, setEditando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const alFallar = (causa: unknown) => setFallo(falloDe(causa, 'No se pudo guardar.'))
  const alTerminar = (editor: EditorDePreguntas) => {
    setFallo(null)
    alCambiar(editor)
  }
  const mover = useMutation({
    mutationFn: (direccion: 'ARRIBA' | 'ABAJO') =>
      moverPregunta(vacanteId, pregunta.id, direccion, modo.ruta),
    onSuccess: alTerminar,
    onError: alFallar,
  })
  const quitar = useMutation({
    mutationFn: () => quitarPregunta(vacanteId, pregunta.id, modo.ruta),
    onSuccess: alTerminar,
    onError: alFallar,
  })

  if (editando) {
    return (
      <FormularioPregunta
        vacanteId={vacanteId}
        preguntaId={pregunta.id}
        inicial={desdePregunta(pregunta)}
        criterios={todos}
        alGuardar={(e) => {
          setEditando(false)
          alTerminar(e)
        }}
        alCancelar={() => setEditando(false)}
      />
    )
  }

  const ocupado = mover.isPending || quitar.isPending
  return (
    <article
      className={`${estilos.pregunta} ${estilos.destino}`}
      aria-label={`Pregunta: ${pregunta.enunciado}`}
      id={`pregunta-${pregunta.id}`}
      tabIndex={-1}
    >
      <div className={estilos.cabeceraPregunta}>
        {numero !== undefined && <span className={estilos.numeroPregunta}>Pregunta {numero}</span>}
        <span className={estilos.chip}>{nombreDelTipo(pregunta.tipo)}</span>
        {/* En la prueba la abierta no lleva puntos: la califica su criterio entero. */}
        {!(esPrueba(modo) && pregunta.tipo === 'ABIERTA') && (
          <span className={estilos.chip}>{pregunta.puntos} pts</span>
        )}
        {editable && (
          <div className={estilos.botones}>
            <BotonIcono etiqueta="Subir la pregunta" onClick={() => mover.mutate('ARRIBA')} disabled={primera || ocupado}>
              <IconoArriba />
            </BotonIcono>
            <BotonIcono etiqueta="Bajar la pregunta" onClick={() => mover.mutate('ABAJO')} disabled={ultima || ocupado}>
              <IconoAbajo />
            </BotonIcono>
            <BotonIcono etiqueta="Editar la pregunta" onClick={() => setEditando(true)} disabled={ocupado}>
              <IconoLapiz />
            </BotonIcono>
            <BotonIcono etiqueta="Quitar la pregunta" onClick={() => quitar.mutate()} disabled={ocupado}>
              <IconoCruz />
            </BotonIcono>
          </div>
        )}
      </div>
      <ContenidoDePregunta pregunta={pregunta} />
      {archivo !== undefined && (
        <ArchivoDeLaPregunta
          vacanteId={vacanteId}
          pregunta={pregunta}
          numero={numero ?? 0}
          archivo={archivo}
          criterio={criterio}
          editable={editable}
          alCambiar={alTerminar}
        />
      )}
      <MostrarFallo fallo={fallo} />
    </article>
  )
}

/** El enunciado, las opciones con sus puntos y el «qué debe tener». Lo usan también las vistas en lectura. */
export function ContenidoDePregunta({ pregunta }: { pregunta: PreguntaDeLaVersion }) {
  const opciones = [...pregunta.opciones].sort((a, b) => a.orden - b.orden)
  return (
    <>
      <p className={estilos.enunciado}>{pregunta.enunciado}</p>
      {opciones.length > 0 && (
        <ul className={estilos.opciones}>
          {opciones.map((o) => (
            <li className={estilos.opcion} key={o.id}>
              <span>
                {pregunta.tipo === 'ESCALA' && o.texto !== String(o.orden)
                  ? `${o.orden} · ${o.texto}`
                  : o.texto}
              </span>
              <span>{o.puntos}</span>
            </li>
          ))}
        </ul>
      )}
      {pregunta.tipo === 'ABIERTA' && pregunta.queDebeTener && (
        <p className={estilos.queDebeTener}>
          <b>Qué debe tener:</b> {pregunta.queDebeTener}
        </p>
      )}
    </>
  )
}

/**
 * La lista de criterios del borrador (V68), la misma en los dos editores: «Desplegar
 * todo» y «Plegar todo», un bloque plegable por criterio con sus faltas y, al final,
 * las preguntas que se quedaron sin criterio.
 */
export function ListaDeCriterios({
  vacanteId,
  version,
  editable,
  alCambiar,
  plegado,
  entregables,
}: {
  vacanteId: number
  version: VersionDePreguntas
  editable: boolean
  alCambiar: (editor: EditorDePreguntas) => void
  plegado: ReturnType<typeof useCriteriosAbiertos>
  /** Solo en la prueba: sus entregables. */
  entregables?: EntregableDeLaVersion[]
}) {
  const numeros = numerosDePreguntas(version)
  const faltas = faltasPorCriterio(version)
  return (
    <>
      {version.criterios.length > 0 && (
        <div className={estilos.plegarTodo}>
          <button className={estilos.enlacePlegar} type="button" onClick={plegado.desplegarTodo}>
            Desplegar todo
          </button>
          <button className={estilos.enlacePlegar} type="button" onClick={plegado.plegarTodo}>
            Plegar todo
          </button>
        </div>
      )}
      {version.criterios.map((c, i) => (
        <BloqueCriterio
          key={c.id}
          vacanteId={vacanteId}
          criterio={c}
          preguntas={c.preguntas}
          todos={version.criterios}
          editable={editable}
          primero={i === 0}
          ultimo={i === version.criterios.length - 1}
          alCambiar={alCambiar}
          entregables={entregables}
          abierto={plegado.abierto(c.id)}
          alAlternar={() => plegado.alternar(c.id)}
          faltas={faltas.get(c.id) ?? []}
          numeros={numeros}
        />
      ))}
      {version.sinCriterio.length > 0 && (
        <BloqueCriterio
          vacanteId={vacanteId}
          criterio={null}
          preguntas={version.sinCriterio}
          todos={version.criterios}
          editable={editable}
          primero
          ultimo
          alCambiar={alCambiar}
          entregables={entregables}
          numeros={numeros}
        />
      )}
    </>
  )
}
