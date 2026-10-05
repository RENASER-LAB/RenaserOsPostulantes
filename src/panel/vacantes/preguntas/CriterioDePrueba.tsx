/**
 * Lo que un criterio de la prueba técnica (V67) tiene y uno de las preguntas
 * propias no: su **parte calificada**.
 *
 * Cada criterio de la prueba tiene una parte automática —la suma de sus
 * cerradas, que cuenta el sistema— y una parte calificada: sus puntos y quién la
 * califica (la IA o una persona). Las abiertas no llevan puntos: la parte
 * calificada califica el criterio entero mirando sus abiertas y sus archivos.
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
        {puntos <= 0
          ? 'no tiene. Este criterio solo suma sus cerradas.'
          : `${puntos} pts · ${criterio.calificador === 'PERSONA' ? 'la califica una persona' : 'la califica la IA'}`}
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

interface PropsFormulario {
  vacanteId: number
  /** Nulo para un criterio nuevo. */
  criterio: CriterioDeLaVersion | null
  alGuardar: (editor: EditorDePreguntas) => void
  alCancelar: () => void
}

/**
 * El criterio: nombre, qué evalúa y su parte calificada (puntos y quién la
 * califica). Los puntos van como número tal cual se escribieron: si llevan
 * decimales los rechaza el servidor con su lista.
 */
export function FormularioCriterioDePrueba({ vacanteId, criterio, alGuardar, alCancelar }: PropsFormulario) {
  const [nombre, setNombre] = useState(criterio?.nombre ?? '')
  const [queEvalua, setQueEvalua] = useState(criterio?.queEvalua ?? '')
  const [puntos, setPuntos] = useState(String(criterio?.puntosCalificados ?? 0))
  const [calificador, setCalificador] = useState<Calificador>(criterio?.calificador ?? 'IA')
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const comoNumero = puntos.trim() === '' ? 0 : Number(puntos)
  const conParte = !Number.isNaN(comoNumero) && comoNumero > 0

  const guardado = useMutation({
    mutationFn: () => {
      const datos = {
        nombre: nombre.trim(),
        queEvalua: queEvalua.trim() || null,
        puntosCalificados: comoNumero,
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

      <fieldset className={estilos.grupoOpciones}>
        <legend className={estilos.etiqueta}>Parte calificada</legend>
        <div className={estilos.filaFormulario}>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Puntos</span>
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
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Quién la califica</span>
            <select
              className={estilos.eleccion}
              value={calificador}
              onChange={(e) => setCalificador(e.target.value as Calificador)}
              disabled={!conParte}
            >
              <option value="IA">La IA</option>
              <option value="PERSONA">Una persona</option>
            </select>
          </label>
        </div>
        <p className={estilos.ayuda}>
          La parte calificada califica el criterio entero mirando sus abiertas y los archivos de
          sus preguntas. Con 0 puntos el criterio solo suma sus cerradas.
        </p>
      </fieldset>

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
