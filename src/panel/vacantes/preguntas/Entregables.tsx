/**
 * Los archivos de la prueba (V68), pedidos donde se usan.
 *
 *   - **El archivo de una pregunta**: dentro de su tarjeta, «Pedir un archivo
 *     para esta pregunta». Como mucho uno por pregunta; se quita con la aspa.
 *   - **Los entregables generales**: un archivo que reúne respuestas de varias
 *     preguntas o el resultado del caso. Cubren toda la prueba o unas preguntas.
 *
 * Nadie marca qué mira cada criterio: lo deduce el servidor del alcance (un
 * criterio mira el archivo de sus preguntas y los generales que cubren toda la
 * prueba o alguna de sus preguntas).
 *
 * Lo que le falta a un archivo para publicar («Informe final» no cubre ninguna
 * pregunta, «Flujo.xlsx»: nadie lo califica…) se escribe bajo su línea, en ámbar.
 */

import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type {
  CriterioDeLaVersion,
  EditorDePreguntas as Editor,
  EntregableDeLaVersion,
  FormatoDeEntregable,
  PreguntaDeLaVersion,
} from '../../api/preguntasPropias'
import { agregarEntregable, editarEntregable, quitarEntregable, type GuardarEntregable } from '../../api/pruebaPropia'
import { IconoCruz, IconoDocumento, IconoLapiz, IconoMas } from '@/ui/Iconos'
import { falloDe, type Fallo } from './consultas'
import { FORMATOS, nombreDelFormato } from './formulario'
import { BotonIcono, ListaDeFaltas, MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

/** El aviso del enlace en un criterio de IA: lo que la IA no puede leer. */
export const AVISO_DEL_ENLACE =
  'La IA no abre enlaces: este criterio lo califica la IA, así que solo leerá la respuesta escrita.'

const esDeIa = (c: CriterioDeLaVersion | null) =>
  c !== null && c.calificador === 'IA' && (c.puntosCalificados ?? 0) > 0

/** «Cubre: toda la prueba», «Cubre: la pregunta 2», «Cubre: las preguntas 2 y 4». */
export function textoDeLoQueCubre(e: EntregableDeLaVersion, numeros: Map<number, number>): string {
  if (e.alcance === 'TODA_LA_PRUEBA') return 'Cubre: toda la prueba'
  if (e.alcance !== 'PREGUNTAS') return 'Cubre: lo que miraban sus criterios'
  const suyos = (e.cubre ?? [])
    .map((id) => numeros.get(id))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b)
  if (suyos.length === 0) return 'Cubre: ninguna pregunta'
  if (suyos.length === 1) return `Cubre: la pregunta ${suyos[0]}`
  return `Cubre: las preguntas ${suyos.slice(0, -1).join(', ')} y ${suyos[suyos.length - 1]}`
}

function LineaDeArchivo({
  entregable,
  extra,
  editable,
  alEditar,
  alQuitar,
  ocupado,
}: {
  entregable: EntregableDeLaVersion
  extra?: string
  editable: boolean
  alEditar: () => void
  alQuitar: () => void
  ocupado: boolean
}) {
  return (
    <div className={estilos.archivo}>
      <IconoDocumento tamano={18} />
      <span className={estilos.nombreArchivo}>{entregable.nombre}</span>
      <span>
        · {nombreDelFormato(entregable.formato)} · {entregable.obligatorio ? 'obligatorio' : 'opcional'}
        {extra ? ` · ${extra}` : ''}
      </span>
      {editable && (
        <span className={estilos.botones}>
          <BotonIcono etiqueta={`Editar el archivo ${entregable.nombre}`} onClick={alEditar} disabled={ocupado}>
            <IconoLapiz />
          </BotonIcono>
          <BotonIcono etiqueta={`Quitar el archivo ${entregable.nombre}`} onClick={alQuitar} disabled={ocupado}>
            <IconoCruz />
          </BotonIcono>
        </span>
      )}
    </div>
  )
}

// ---------- El archivo de una pregunta ----------

export function ArchivoDeLaPregunta({
  vacanteId,
  pregunta,
  numero,
  archivo,
  criterio,
  editable,
  alCambiar,
  faltas,
}: {
  vacanteId: number
  pregunta: PreguntaDeLaVersion
  numero: number
  archivo: EntregableDeLaVersion | null
  criterio: CriterioDeLaVersion | null
  editable: boolean
  alCambiar: (e: Editor) => void
  /** Lo que le falta al archivo para publicar, tal como lo dice el servidor. */
  faltas?: string[]
}) {
  const [editando, setEditando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const quitar = useMutation({
    mutationFn: () => quitarEntregable(vacanteId, archivo!.id),
    onSuccess: (e) => {
      setFallo(null)
      alCambiar(e)
    },
    onError: (c) => setFallo(falloDe(c, 'No se pudo quitar el archivo.')),
  })

  if (editando) {
    return (
      <FormularioDeArchivo
        vacanteId={vacanteId}
        entregable={archivo}
        titulo={`Archivo de la pregunta ${numero}`}
        preguntaId={pregunta.id}
        deIa={esDeIa(criterio)}
        alGuardar={(e) => {
          setEditando(false)
          alCambiar(e)
        }}
        alCancelar={() => setEditando(false)}
      />
    )
  }
  return (
    <>
      {archivo ? (
        <LineaDeArchivo
          entregable={archivo}
          editable={editable}
          alEditar={() => setEditando(true)}
          alQuitar={() => quitar.mutate()}
          ocupado={quitar.isPending}
        />
      ) : (
        editable && (
          <button className={estilos.secundarioPequeno} type="button" onClick={() => setEditando(true)}>
            <IconoMas tamano={18} />
            Pedir un archivo para esta pregunta
          </button>
        )
      )}
      <ListaDeFaltas faltas={faltas} nombre="Lo que le falta al archivo" />
      <MostrarFallo fallo={fallo} />
    </>
  )
}

// ---------- Los entregables generales ----------

export interface PreguntaNumerada {
  id: number
  numero: number
  enunciado: string
}

export function EntregablesGenerales({
  vacanteId,
  generales,
  preguntas,
  numeros,
  editable,
  alCambiar,
  faltas,
}: {
  vacanteId: number
  generales: EntregableDeLaVersion[]
  preguntas: PreguntaNumerada[]
  numeros: Map<number, number>
  editable: boolean
  alCambiar: (e: Editor) => void
  /** Lo que le falta a cada entregable para publicar, por su id. */
  faltas: Map<number, string[]>
}) {
  const [nuevo, setNuevo] = useState(false)
  return (
    <section
      className={`${estilos.seccionPrueba} ${estilos.destino}`}
      aria-labelledby="titulo-entregables-generales"
      id="entregables-generales"
      tabIndex={-1}
    >
      <div className={estilos.cabeceraSeccion}>
        <h2 className={estilos.subtitulo} id="titulo-entregables-generales">
          Entregables generales <span className={estilos.cuenta}>(opcional)</span>
        </h2>
      </div>
      {generales.length === 0 ? (
        <p className={estilos.explica}>Ninguno. Úsalo solo si un archivo reúne varias respuestas.</p>
      ) : (
        <ul className={estilos.preguntas}>
          {generales.map((e) => (
            <li key={e.id} id={`entregable-${e.id}`} tabIndex={-1} className={estilos.destino}>
              <General
                vacanteId={vacanteId}
                entregable={e}
                preguntas={preguntas}
                numeros={numeros}
                editable={editable}
                alCambiar={alCambiar}
              />
              <ListaDeFaltas faltas={faltas.get(e.id)} nombre="Lo que le falta al entregable" />
            </li>
          ))}
        </ul>
      )}
      {editable &&
        (nuevo ? (
          <FormularioDeArchivo
            vacanteId={vacanteId}
            entregable={null}
            titulo="Entregable general nuevo"
            preguntas={preguntas}
            alGuardar={(e) => {
              setNuevo(false)
              alCambiar(e)
            }}
            alCancelar={() => setNuevo(false)}
          />
        ) : (
          <button className={estilos.secundarioPequeno} type="button" onClick={() => setNuevo(true)}>
            <IconoMas tamano={18} />
            Agregar entregable general
          </button>
        ))}
    </section>
  )
}

function General({
  vacanteId,
  entregable,
  preguntas,
  numeros,
  editable,
  alCambiar,
}: {
  vacanteId: number
  entregable: EntregableDeLaVersion
  preguntas: PreguntaNumerada[]
  numeros: Map<number, number>
  editable: boolean
  alCambiar: (e: Editor) => void
}) {
  const [editando, setEditando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const quitar = useMutation({
    mutationFn: () => quitarEntregable(vacanteId, entregable.id),
    onSuccess: (e) => {
      setFallo(null)
      alCambiar(e)
    },
    onError: (c) => setFallo(falloDe(c, 'No se pudo quitar el entregable.')),
  })
  if (editando) {
    return (
      <FormularioDeArchivo
        vacanteId={vacanteId}
        entregable={entregable}
        titulo={`Editar ${entregable.nombre}`}
        preguntas={preguntas}
        alGuardar={(e) => {
          setEditando(false)
          alCambiar(e)
        }}
        alCancelar={() => setEditando(false)}
      />
    )
  }
  return (
    <>
      <LineaDeArchivo
        entregable={entregable}
        extra={textoDeLoQueCubre(entregable, numeros)}
        editable={editable}
        alEditar={() => setEditando(true)}
        alQuitar={() => quitar.mutate()}
        ocupado={quitar.isPending}
      />
      <MostrarFallo fallo={fallo} />
    </>
  )
}

// ---------- El formulario ----------

/**
 * El nombre, el formato, si es obligatorio y qué debe tener una buena entrega.
 * Un general añade «Cubre»; el de una pregunta, el aviso del enlace si su
 * criterio lo califica la IA, en el momento en que se elige.
 */
function FormularioDeArchivo({
  vacanteId,
  entregable,
  titulo,
  preguntaId,
  preguntas,
  deIa = false,
  alGuardar,
  alCancelar,
}: {
  vacanteId: number
  entregable: EntregableDeLaVersion | null
  titulo: string
  /** El de una pregunta: su id. */
  preguntaId?: number
  /** Un general: las preguntas que puede cubrir, con su número. */
  preguntas?: PreguntaNumerada[]
  deIa?: boolean
  alGuardar: (e: Editor) => void
  alCancelar: () => void
}) {
  const general = preguntaId === undefined
  const grupoCubre = useId()
  const [nombre, setNombre] = useState(entregable?.nombre ?? '')
  const [formato, setFormato] = useState<FormatoDeEntregable>(entregable?.formato ?? 'ARCHIVO')
  const [obligatorio, setObligatorio] = useState(entregable?.obligatorio ?? true)
  const [queDebeTener, setQueDebeTener] = useState(entregable?.queDebeTener ?? '')
  const [todaLaPrueba, setTodaLaPrueba] = useState(entregable ? entregable.alcance !== 'PREGUNTAS' : true)
  const [cubre, setCubre] = useState<number[]>(entregable?.cubre ?? [])
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const guardado = useMutation({
    mutationFn: () => {
      const cuerpo: GuardarEntregable = {
        nombre: nombre.trim(),
        // «Qué debe contener» ya no se pide (V68): se conserva el de antes, si lo había.
        detalle: entregable?.detalle ?? null,
        formato,
        obligatorio,
        queDebeTener: queDebeTener.trim() || null,
        preguntaId: general ? null : preguntaId!,
        todaLaPrueba: general && todaLaPrueba,
        cubre: general && !todaLaPrueba ? cubre : [],
      }
      return entregable === null
        ? agregarEntregable(vacanteId, cuerpo)
        : editarEntregable(vacanteId, entregable.id, cuerpo)
    },
    onSuccess: (e) => {
      setFallo(null)
      alGuardar(e)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar el archivo.')),
  })

  const sinCubre = general && !todaLaPrueba && cubre.length === 0
  return (
    <form
      className={estilos.formulario}
      aria-label={titulo}
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim() && !sinCubre) guardado.mutate()
      }}
    >
      <div className={estilos.filaFormulario}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Nombre</span>
          <input
            className={estilos.entrada}
            type="text"
            maxLength={200}
            placeholder={general ? 'Por ejemplo: Informe final' : 'Por ejemplo: Flujo de caja.xlsx'}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Formato</span>
          <select
            className={estilos.eleccion}
            value={formato}
            onChange={(e) => setFormato(e.target.value as FormatoDeEntregable)}
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!general && deIa && formato === 'ENLACE' && (
        <p className={estilos.aviso} role="status">
          {AVISO_DEL_ENLACE}
        </p>
      )}
      <label className={estilos.casilla}>
        <input type="checkbox" checked={obligatorio} onChange={(e) => setObligatorio(e.target.checked)} />
        <span>Obligatorio: sin él no se puede entregar</span>
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Qué debe tener una buena entrega{' '}
          <span className={estilos.cuenta}>(opcional · {queDebeTener.length} de 1000)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={2}
          maxLength={1000}
          value={queDebeTener}
          onChange={(e) => setQueDebeTener(e.target.value)}
        />
        <span className={estilos.ayuda}>Lo leen la IA y quien califica; quien rinde no lo ve.</span>
      </label>
      {general && (
        <fieldset className={estilos.grupoOpciones}>
          <legend className={estilos.etiqueta}>Cubre</legend>
          <div className={estilos.radios}>
            <label className={estilos.casilla}>
              <input type="radio" name={grupoCubre} checked={todaLaPrueba} onChange={() => setTodaLaPrueba(true)} />
              <span>Toda la prueba</span>
            </label>
            <label className={estilos.casilla}>
              <input type="radio" name={grupoCubre} checked={!todaLaPrueba} onChange={() => setTodaLaPrueba(false)} />
              <span>Estas preguntas</span>
            </label>
          </div>
          {!todaLaPrueba && (
            <div className={estilos.cubre} role="group" aria-label="Las preguntas que cubre">
              {(preguntas ?? []).map((p) => (
                <label className={estilos.casilla} key={p.id} title={p.enunciado}>
                  <input
                    type="checkbox"
                    checked={cubre.includes(p.id)}
                    onChange={(e) =>
                      setCubre((antes) => (e.target.checked ? [...antes, p.id] : antes.filter((id) => id !== p.id)))
                    }
                  />
                  <span>{p.numero}</span>
                  <span className={estilos.soloLectores}>{p.enunciado}</span>
                </label>
              ))}
              {(preguntas ?? []).length === 0 && (
                <p className={estilos.ayuda}>Todavía no hay preguntas que cubrir.</p>
              )}
            </div>
          )}
          {sinCubre && <p className={estilos.ayuda}>Marca al menos una pregunta, o elige «Toda la prueba».</p>}
        </fieldset>
      )}
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending || !nombre.trim() || sinCubre}>
          {guardado.isPending ? 'Guardando…' : entregable === null ? 'Pedir el archivo' : 'Guardar el archivo'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
    </form>
  )
}
