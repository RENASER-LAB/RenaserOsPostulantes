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
 * falta escrita al lado. En el teléfono los puntos y la cuenta bajan bajo el
 * nombre, en ese orden y antes que los botones. Mover, editar y quitar el
 * criterio siguen a la mano plegado. Desplegado: sus propias faltas en ámbar
 * (las de sus preguntas van en cada tarjeta), lo que evalúa y sus preguntas.
 * Lo que vale y quién lo califica ya lo dice su línea: no se repite.
 *
 * Cada criterio y cada pregunta se editan en su sitio, se mueven arriba o abajo
 * y se quitan. Una pregunta cambia de criterio desde su selector, no arrastrando.
 * En la prueba, cada pregunta puede pedir un archivo dentro de su tarjeta.
 */

import { useLayoutEffect, useState, type ReactNode } from 'react'
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
import { FormularioCriterioDePrueba } from './CriterioDePrueba'
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
import {
  faltasPorCriterio,
  faltasPorEntregable,
  faltasPorPregunta,
  faltasPropiasPorCriterio,
  numerosDePreguntas,
  type useCriteriosAbiertos,
} from './navegacion'
import { BotonIcono, ListaDeFaltas, MostrarFallo } from './piezas'
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
  /** Lo que le falta, también a sus preguntas, tal como lo dice el servidor: su punto y su línea plegada. */
  faltas?: string[]
  /** Solo las suyas, sin las de sus preguntas: se escriben desplegado. */
  faltasPropias?: string[]
  /** Lo que le falta a cada una de sus preguntas, sin «La pregunta N (…): », por su id. */
  faltasDePreguntas?: Map<number, string[]>
  /** En la prueba, lo que le falta a cada archivo, por el id de su entregable. */
  faltasDeArchivos?: Map<number, string[]>
  /** El número de cada pregunta en la versión: «Pregunta 4». */
  numeros?: Map<number, number>
  /** Una falta pidió abrir su lápiz (QA-10); `alAbrirLapiz` avisa de que ya se abrió. */
  pedirLapiz?: boolean
  alAbrirLapiz?: () => void
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
  faltasPropias = [],
  faltasDePreguntas = new Map(),
  faltasDeArchivos = new Map(),
  numeros = new Map(),
  pedirLapiz = false,
  alAbrirLapiz,
}: PropsBloque) {
  const modo = useModoDelEditor()
  const deLaPrueba = esPrueba(modo)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(criterio?.nombre ?? '')
  const [queEvalua, setQueEvalua] = useState(criterio?.queEvalua ?? '')
  const [quitando, setQuitando] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  // Antes de pintar, para que la falta que lo pidió encuentre su selector y le dé el foco.
  useLayoutEffect(() => {
    if (!pedirLapiz) return
    if (criterio && editable) {
      setNombre(criterio.nombre)
      setQueEvalua(criterio.queEvalua ?? '')
      setEditando(true)
    }
    alAbrirLapiz?.()
  }, [pedirLapiz, criterio, editable, alAbrirLapiz])

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
  const archivos = archivosDeLasPreguntas(preguntas, entregables)
  const punto = faltas.length > 0 ? <span className={estilos.puntoFalta} aria-hidden="true" /> : null

  return (
    <section
      className={`${estilos.criterio} ${estilos.destino}${faltas.length > 0 ? ` ${estilos.criterioConFalta}` : ''}`}
      aria-label={`Criterio ${titulo}`}
      id={criterio ? `criterio-${criterio.id}` : 'sin-criterio'}
      tabIndex={-1}
    >
      {/* Sin `editar_vacante` no hay botones: los puntos van al borde derecho (AC-12). */}
      <header className={criterio && !editable ? estilos.cabeceraSinBotones : estilos.cabeceraCriterio}>
        {plegable ? (
          <NombrePlegable titulo={titulo} abierto={abierto} alAlternar={alAlternar} />
        ) : (
          <h3 className={estilos.nombreCriterio}>{titulo}</h3>
        )}
        {criterio && (
          <ResumenDelCriterio
            criterio={criterio}
            cuenta={plegable ? cuentaDelCriterio(preguntas.length, deLaPrueba ? archivos : 0) : undefined}
            punto={punto}
          />
        )}
        {!(criterio && plegable) && punto}
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
      {desplegado && <ListaDeFaltas faltas={faltasPropias} nombre="Lo que le falta al criterio" />}

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
        desplegado &&
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

      {desplegado && (
        <>
          {!criterio && (
            <p className={estilos.aviso}>
              Estas preguntas no están en ningún criterio. Muévelas con su selector «Criterio»: sin
              criterio no se publica.
            </p>
          )}

          {preguntas.length > 0 && (
            <ol className={estilos.preguntas}>
              {preguntas.map((p, i) => {
                const archivo = deLaPrueba ? archivoDe(p.id) : undefined
                return (
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
                      archivo={archivo}
                      faltas={faltasDePreguntas.get(p.id)}
                      faltasDelArchivo={archivo ? faltasDeArchivos.get(archivo.id) : undefined}
                    />
                  </li>
                )
              })}
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
  /** Lo que le falta para publicar, sin «La pregunta N (…): », en el orden del servidor. */
  faltas?: string[]
  /** Lo que le falta a su archivo («Flujo.xlsx»: nadie lo califica…): se escribe bajo el archivo. */
  faltasDelArchivo?: string[]
}

/**
 * Una pregunta del borrador. Con falta, el borde y el punto ámbar de los criterios
 * con falta y cada falta escrita debajo, en los dos editores; también sin
 * `editar_vacante`, que la ve sin poder corregirla.
 */
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
  faltas = [],
  faltasDelArchivo = [],
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
  // La falta de su archivo también lleva a esta tarjeta: se pone en ámbar igual.
  const conFalta = faltas.length > 0 || faltasDelArchivo.length > 0
  return (
    <article
      className={`${estilos.pregunta} ${estilos.destino}${conFalta ? ` ${estilos.preguntaConFalta}` : ''}`}
      aria-label={`Pregunta: ${pregunta.enunciado}`}
      id={`pregunta-${pregunta.id}`}
      tabIndex={-1}
    >
      <div className={estilos.cabeceraPregunta}>
        {conFalta && <span className={estilos.puntoFalta} aria-hidden="true" />}
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
      <ListaDeFaltas faltas={faltas} nombre="Lo que le falta para publicar" />
      {archivo !== undefined && (
        <ArchivoDeLaPregunta
          vacanteId={vacanteId}
          pregunta={pregunta}
          numero={numero ?? 0}
          archivo={archivo}
          criterio={criterio}
          editable={editable}
          alCambiar={alTerminar}
          faltas={faltasDelArchivo}
        />
      )}
      <MostrarFallo fallo={fallo} />
    </article>
  )
}

// ---------- La línea del criterio plegable (V68) ----------
// Las mismas piezas en el editor, en la versión publicada, en la vista previa de
// «Copiar de otra vacante» y en «Cambiar los puntos».

/** El nombre del criterio, que lo pliega y lo despliega: «▸ Análisis financiero». */
export function NombrePlegable({
  titulo,
  abierto,
  alAlternar,
}: {
  titulo: string
  abierto: boolean
  alAlternar: () => void
}) {
  return (
    <h3 className={estilos.nombreCriterio}>
      <button className={estilos.plegador} type="button" aria-expanded={abierto} onClick={alAlternar}>
        <IconoDesplegar tamano={18} className={abierto ? estilos.flecha : `${estilos.flecha} ${estilos.flechaPlegada}`} />
        {titulo}
      </button>
    </h3>
  )
}

/**
 * «30 pts (sistema 5 + IA 25) · 2 preguntas · 1 archivo». Puntos y cuenta van
 * juntos y en ese orden también en el teléfono (QA-05); el «·» va en su caja,
 * que se recorta cuando la cuenta empieza fila. Sin `cuenta`, solo los puntos.
 */
export function ResumenDelCriterio({
  criterio,
  cuenta,
  punto = null,
}: {
  criterio: CriterioDeLaVersion
  cuenta?: string
  /** El punto ámbar de un criterio con falta. */
  punto?: ReactNode
}) {
  return (
    <span className={estilos.resumenCriterio}>
      <span className={estilos.filasDelResumen}>
        <span className={estilos.puntosCriterio}>{puntosConDesglose(criterio)}</span>
        {cuenta !== undefined && (
          <span className={estilos.cuentaCriterio}>
            <span className={estilos.separadorCuenta}>·</span> {cuenta}
            {punto}
          </span>
        )}
      </span>
    </span>
  )
}

/** «Desplegar todo» y «Plegar todo», sobre la lista de criterios. */
export function PlegarTodo({ alDesplegar, alPlegar }: { alDesplegar: () => void; alPlegar: () => void }) {
  return (
    <div className={estilos.plegarTodo}>
      <button className={estilos.enlacePlegar} type="button" onClick={alDesplegar}>
        Desplegar todo
      </button>
      <button className={estilos.enlacePlegar} type="button" onClick={alPlegar}>
        Plegar todo
      </button>
    </div>
  )
}

/** Cuántas de estas preguntas piden un archivo: el «1 archivo» de la línea del criterio. */
export function archivosDeLasPreguntas(preguntas: PreguntaDeLaVersion[], entregables: EntregableDeLaVersion[]): number {
  return preguntas.filter((p) => entregables.some((e) => e.alcance === 'PREGUNTA' && e.preguntaId === p.id)).length
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
  const propias = faltasPropiasPorCriterio(version)
  const faltasDePreguntas = faltasPorPregunta(version)
  const faltasDeArchivos = faltasPorEntregable(version)
  return (
    <>
      {version.criterios.length > 0 && (
        <PlegarTodo alDesplegar={plegado.desplegarTodo} alPlegar={plegado.plegarTodo} />
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
          faltasPropias={propias.get(c.id)}
          faltasDePreguntas={faltasDePreguntas}
          faltasDeArchivos={faltasDeArchivos}
          numeros={numeros}
          pedirLapiz={plegado.aEditar === c.id}
          alAbrirLapiz={plegado.lapizAbierto}
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
          faltasDePreguntas={faltasDePreguntas}
          faltasDeArchivos={faltasDeArchivos}
          numeros={numeros}
        />
      )}
    </>
  )
}
