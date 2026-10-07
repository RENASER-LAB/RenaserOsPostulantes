/**
 * Lo que un criterio de la prueba técnica (V67) tiene y uno de las preguntas
 * propias no: su **parte calificada**.
 *
 * Cada criterio de la prueba tiene una parte automática —la suma de sus
 * cerradas, que cuenta el sistema— y una parte calificada, que califica la IA o
 * una persona. Desde la V69 **se escribe lo que vale el criterio entero** y la
 * parte calificada se deduce: el total menos sus cerradas. Las abiertas no
 * llevan puntos: la parte calificada califica el criterio entero mirando sus
 * abiertas y sus archivos.
 *
 * **«Mira» no se marca** (V68): lo deduce el servidor. Un criterio mira el
 * archivo de cada una de sus preguntas y los entregables generales que cubren
 * toda la prueba o alguna de sus preguntas. Aquí solo se enseña, con el chip
 * «automático».
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type {
  CriterioDeLaVersion,
  EditorDePreguntas,
  EntregableDeLaVersion,
} from '../../api/preguntasPropias'
import { agregarCriterioDePrueba, editarCriterioDePrueba, type Calificador } from '../../api/pruebaPropia'
import { falloDe, type Fallo } from './consultas'
import { cerradasPorEncima, faltaEnLosPuntosDelCriterio, repartoDelCriterio } from './formulario'
import { idDelCalificador } from './navegacion'
import { MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

/** «Flujo de caja.xlsx (pregunta 4)», «Informe final (general)». */
export function nombreEnMira(e: EntregableDeLaVersion, numeros: Map<number, number>): string {
  if (e.alcance === 'PREGUNTA' && e.preguntaId != null) {
    const n = numeros.get(e.preguntaId)
    return n ? `${e.nombre} (pregunta ${n})` : e.nombre
  }
  return e.alcance ? `${e.nombre} (general)` : e.nombre
}

/**
 * «la califica la IA», «la califica una persona» o, si nadie lo ha dicho, la
 * falta: nunca se da por hecha la IA (QA-10).
 */
function quienLaCalifica(calificador: Calificador | null | undefined): string {
  if (calificador === 'PERSONA') return 'la califica una persona'
  if (calificador === 'IA') return 'la califica la IA'
  return 'falta decir quién la califica'
}

/** La parte calificada y lo que mira, deducido. */
export function LineaDeLaParteCalificada({
  criterio,
  entregables,
  numeros = new Map(),
}: {
  criterio: CriterioDeLaVersion
  entregables: EntregableDeLaVersion[]
  numeros?: Map<number, number>
}) {
  const puntos = criterio.puntosCalificados ?? 0
  const mira = entregables.filter((e) => (criterio.entregables ?? []).includes(e.id))
  return (
    <>
      <p className={estilos.queEvalua}>
        <b>Parte calificada:</b>{' '}
        {puntos <= 0 ? 'no tiene. Todo lo puntúa el sistema.' : `${puntos} pts · ${quienLaCalifica(criterio.calificador)}`}
      </p>
      {(puntos > 0 || mira.length > 0) && (
        <p className={estilos.queEvalua}>
          <b>Mira</b>
          <span className={estilos.chipAutomatico}>automático</span>
          {mira.length === 0
            ? 'ningún archivo'
            : mira.map((e) => nombreEnMira(e, numeros)).join(' · ')}
        </p>
      )}
    </>
  )
}

interface PropsReparto {
  /** El nombre del criterio, para decir la falta como la dice el servidor. */
  nombre: string
  /** Lo escrito en «Puntos del criterio», tal cual. */
  puntos: string
  /** Lo que suman hoy sus cerradas. */
  cerradas: number
  /** Nulo: nadie lo ha dicho todavía (un criterio que era todo del sistema). */
  calificador: Calificador | null
  alElegir: (calificador: Calificador) => void
  /** El id del selector, para que su falta lleve el cursor ahí. */
  idDeQuien?: string
}

/** Lo escrito como número, o nulo si no hay número que repartir. */
function puntosEscritos(puntos: string): number | null {
  if (puntos.trim() === '') return null
  const numero = Number(puntos)
  return Number.isFinite(numero) ? numero : null
}

/**
 * Debajo de «Puntos del criterio», en vivo (V69): cuánto suman sus cerradas y
 * quién califica el resto. Si las cerradas lo suman todo no se pregunta quién
 * califica; si lo pasan, la falta en ámbar, la misma que frena publicar. Con un
 * total que no es un entero de 0 a 100 no se reparte nada: se dice qué está mal.
 */
export function RepartoDelCriterio({ nombre, puntos, cerradas, calificador, alElegir, idDeQuien }: PropsReparto) {
  if (puntos.trim() === '') {
    return <p className={estilos.ayuda}>Lo que vale el criterio entero, cerradas incluidas.</p>
  }
  const total = puntosEscritos(puntos)
  const malEscrito = faltaEnLosPuntosDelCriterio(puntos)
  if (total === null || malEscrito !== null) {
    return (
      <p className={estilos.aviso} role="status">
        {malEscrito}
      </p>
    )
  }
  const reparto = repartoDelCriterio(total, cerradas)
  if (reparto.tipo === 'POR_ENCIMA') {
    return (
      <p className={estilos.aviso} role="status">
        {cerradasPorEncima(nombre, cerradas, total)}
      </p>
    )
  }
  if (reparto.tipo === 'SISTEMA') {
    return (
      <p className={estilos.reparto} role="status">
        Sus cerradas suman {cerradas}. Todo lo puntúa el sistema.
      </p>
    )
  }
  return (
    <p className={estilos.reparto}>
      <span role="status">
        Sus cerradas suman {cerradas}. Los otros {reparto.otros} los califica
      </span>{' '}
      <select
        id={idDeQuien}
        className={estilos.eleccionEnLinea}
        aria-label={`Quién califica los otros ${reparto.otros} puntos`}
        value={calificador ?? ''}
        onChange={(e) => alElegir(e.target.value as Calificador)}
      >
        {/* Sin quién la califique, el selector no elige por nadie (QA-10). */}
        {calificador === null && (
          <option value="" disabled>
            Elige quién
          </option>
        )}
        <option value="IA">La IA</option>
        <option value="PERSONA">Una persona</option>
      </select>{' '}
      mirando sus abiertas y archivos.
    </p>
  )
}

interface PropsFormulario {
  vacanteId: number
  /** Nulo para un criterio nuevo. */
  criterio: CriterioDeLaVersion | null
  alGuardar: (editor: EditorDePreguntas) => void
  alCancelar: () => void
}

/**
 * El criterio: nombre, qué evalúa y **lo que vale entero** (V69). Sus cerradas
 * las puntúa el sistema y el resto —su parte calificada— lo califica la IA o
 * una persona; si luego cambian sus cerradas, el criterio sigue valiendo lo
 * mismo y es esa parte la que se ajusta. Los puntos van como número tal cual se
 * escribieron: si llevan decimales o faltan, los rechaza el servidor con su lista.
 */
export function FormularioCriterioDePrueba({ vacanteId, criterio, alGuardar, alCancelar }: PropsFormulario) {
  const [nombre, setNombre] = useState(criterio?.nombre ?? '')
  const [queEvalua, setQueEvalua] = useState(criterio?.queEvalua ?? '')
  const [puntos, setPuntos] = useState(criterio ? String(criterio.puntos) : '')
  // Uno nuevo propone la IA; uno guardado sin quién califica (era todo del sistema) no
  // elige por nadie: si le queda parte calificada, se elige aquí (QA-10).
  const [calificador, setCalificador] = useState<Calificador | null>(
    criterio === null ? 'IA' : (criterio.calificador ?? null),
  )
  const [fallo, setFallo] = useState<Fallo | null>(null)

  // Un criterio nuevo no tiene cerradas: lo que valga es, de momento, todo calificado.
  const cerradas = criterio?.puntosSistema ?? 0
  const total = puntosEscritos(puntos)
  const conParte = total !== null && total > cerradas

  const guardado = useMutation({
    mutationFn: () => {
      const datos = {
        nombre: nombre.trim(),
        queEvalua: queEvalua.trim() || null,
        puntos: puntos.trim() === '' ? null : Number(puntos),
        calificador: conParte ? calificador : null,
      }
      return criterio === null
        ? agregarCriterioDePrueba(vacanteId, datos)
        : editarCriterioDePrueba(vacanteId, criterio.id, datos)
    },
    onSuccess: (editor) => {
      setFallo(null)
      alGuardar(editor)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar el criterio.')),
  })

  return (
    <form
      className={estilos.formulario}
      aria-label={criterio === null ? 'Criterio nuevo' : `Editar el criterio ${criterio.nombre}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) guardado.mutate()
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>{criterio === null ? 'Nombre del criterio' : 'Nombre'}</span>
        <input
          className={estilos.entrada}
          type="text"
          maxLength={120}
          placeholder="Por ejemplo: Conocimiento contable"
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

      <div className={estilos.grupoOpciones}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Puntos del criterio</span>
          <input
            className={estilos.entradaPuntos}
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            max={100}
            value={puntos}
            onChange={(e) => setPuntos(e.target.value)}
          />
        </label>
        <RepartoDelCriterio
          nombre={nombre.trim() || (criterio?.nombre ?? '')}
          puntos={puntos}
          cerradas={cerradas}
          calificador={calificador}
          alElegir={setCalificador}
          idDeQuien={criterio ? idDelCalificador(criterio.id) : undefined}
        />
        <p className={estilos.ayuda}>
          Si luego cambian sus cerradas, el criterio sigue valiendo lo mismo: lo que se ajusta es la
          parte que califican la IA o una persona.
        </p>
      </div>

      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending || !nombre.trim()}>
          {guardado.isPending ? 'Guardando…' : criterio === null ? 'Agregar el criterio' : 'Guardar el criterio'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
    </form>
  )
}
