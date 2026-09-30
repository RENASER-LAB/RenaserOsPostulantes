/**
 * Un criterio del borrador con sus preguntas, y la tarjeta de cada pregunta.
 *
 * El criterio es una superficie blanca; sus preguntas van hundidas dentro. Sus
 * puntos no se escriben: son la suma de sus preguntas, y quién lo califica
 * tampoco se elige (el sistema sus cerradas, la IA sus abiertas).
 *
 * Cada criterio y cada pregunta se editan en su sitio, se mueven arriba o abajo
 * y se quitan. Una pregunta cambia de criterio desde su selector, no arrastrando.
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
  type PreguntaDeLaVersion,
} from '../../api/preguntasPropias'
import { IconoAbajo, IconoArriba, IconoCruz, IconoLapiz, IconoMas } from '@/ui/Iconos'
import { falloDe, type Fallo } from './consultas'
import { FormularioPregunta } from './FormularioPregunta'
import {
  avisoAlQuitarCriterio,
  desdePregunta,
  nombreDelTipo,
  preguntaNueva,
  puntosDelCriterio,
} from './formulario'
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
}: PropsBloque) {
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
    mutationFn: (direccion: 'ARRIBA' | 'ABAJO') => moverCriterio(vacanteId, criterio!.id, direccion),
    onSuccess: alTerminar,
    onError: alFallar,
  })
  const quitar = useMutation({
    mutationFn: () => quitarCriterio(vacanteId, criterio!.id),
    onSuccess: alTerminar,
    onError: alFallar,
  })

  const titulo = criterio ? criterio.nombre : 'Sin criterio'
  const ocupado = guardar.isPending || mover.isPending || quitar.isPending

  return (
    <section className={estilos.criterio} aria-label={`Criterio ${titulo}`}>
      <header className={estilos.cabeceraCriterio}>
        <h3 className={estilos.nombreCriterio}>{titulo}</h3>
        {criterio && <span className={estilos.puntosCriterio}>{puntosDelCriterio(criterio)}</span>}
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
      </header>

      {criterio && editando ? (
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
        criterio?.queEvalua && (
          <p className={estilos.queEvalua}>
            <b>Qué evalúa:</b> {criterio.queEvalua}
          </p>
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

      {criterio && preguntas.length === 0 && (
        <p className={estilos.aviso}>Sin preguntas: así no se publica.</p>
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
                todos={todos}
                editable={editable}
                primera={i === 0}
                ultima={i === preguntas.length - 1}
                alCambiar={alTerminar}
              />
            </li>
          ))}
        </ol>
      )}

      {criterio && editable && (
        agregando ? (
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
        )
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}

interface PropsTarjeta {
  vacanteId: number
  pregunta: PreguntaDeLaVersion
  todos: CriterioDeLaVersion[]
  editable: boolean
  primera: boolean
  ultima: boolean
  alCambiar: (editor: EditorDePreguntas) => void
}

function TarjetaPregunta({
  vacanteId,
  pregunta,
  todos,
  editable,
  primera,
  ultima,
  alCambiar,
}: PropsTarjeta) {
  const [editando, setEditando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const alFallar = (causa: unknown) => setFallo(falloDe(causa, 'No se pudo guardar.'))
  const alTerminar = (editor: EditorDePreguntas) => {
    setFallo(null)
    alCambiar(editor)
  }
  const mover = useMutation({
    mutationFn: (direccion: 'ARRIBA' | 'ABAJO') => moverPregunta(vacanteId, pregunta.id, direccion),
    onSuccess: alTerminar,
    onError: alFallar,
  })
  const quitar = useMutation({
    mutationFn: () => quitarPregunta(vacanteId, pregunta.id),
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
    <article className={estilos.pregunta} aria-label={`Pregunta: ${pregunta.enunciado}`}>
      <div className={estilos.cabeceraPregunta}>
        <span className={estilos.chip}>{nombreDelTipo(pregunta.tipo)}</span>
        <span className={estilos.chip}>{pregunta.puntos} pts</span>
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
