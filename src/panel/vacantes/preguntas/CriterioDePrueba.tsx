/**
 * Lo que un criterio de la prueba técnica (V67) tiene y uno de las preguntas
 * propias no: su **parte calificada**.
 *
 * Cada criterio de la prueba tiene una parte automática —la suma de sus
 * cerradas, que cuenta el sistema— y una parte calificada: sus puntos, quién la
 * califica (la IA o una persona) y qué entregables mira. Las abiertas no llevan
 * puntos: la parte calificada califica el criterio entero mirando sus abiertas y
 * esos entregables.
 *
 * «Mira» es una lista de casillas con los entregables de la prueba, una por
 * línea en el teléfono. Sin entregables, la línea no sale.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type {
  CriterioDeLaVersion,
  EditorDePreguntas,
  EntregableDeLaVersion,
} from '../../api/preguntasPropias'
import {
  agregarCriterioDePrueba,
  editarCriterioDePrueba,
  type Calificador,
} from '../../api/pruebaPropia'
import { falloDe, type Fallo } from './consultas'
import { MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

/** «Parte calificada: 20 pts · IA · Mira: Tablero.xlsx», o que no tiene. */
export function LineaDeLaParteCalificada({
  criterio,
  entregables,
}: {
  criterio: CriterioDeLaVersion
  entregables: EntregableDeLaVersion[]
}) {
  const puntos = criterio.puntosCalificados ?? 0
  if (puntos <= 0) {
    return (
      <p className={estilos.queEvalua}>
        <b>Parte calificada:</b> no tiene. Este criterio solo suma sus cerradas.
      </p>
    )
  }
  const mira = entregables.filter((e) => (criterio.entregables ?? []).includes(e.id))
  return (
    <p className={estilos.queEvalua}>
      <b>Parte calificada:</b> {puntos} pts ·{' '}
      {criterio.calificador === 'PERSONA' ? 'la califica una persona' : 'la califica la IA'}
      {entregables.length > 0 && (
        <>
          {' '}
          · <b>Mira:</b> {mira.length === 0 ? 'ningún entregable' : mira.map((e) => e.nombre).join(', ')}
        </>
      )}
    </p>
  )
}

interface PropsFormulario {
  vacanteId: number
  /** Nulo para un criterio nuevo. */
  criterio: CriterioDeLaVersion | null
  entregables: EntregableDeLaVersion[]
  alGuardar: (editor: EditorDePreguntas) => void
  alCancelar: () => void
}

/**
 * El criterio entero: nombre, qué evalúa y su parte calificada. Los puntos van
 * como número tal cual se escribieron: si llevan decimales los rechaza el
 * servidor con su lista, que es la misma que se pinta al publicar.
 */
export function FormularioCriterioDePrueba({
  vacanteId,
  criterio,
  entregables,
  alGuardar,
  alCancelar,
}: PropsFormulario) {
  const [nombre, setNombre] = useState(criterio?.nombre ?? '')
  const [queEvalua, setQueEvalua] = useState(criterio?.queEvalua ?? '')
  const [puntos, setPuntos] = useState(String(criterio?.puntosCalificados ?? 0))
  const [calificador, setCalificador] = useState<Calificador>(criterio?.calificador ?? 'IA')
  const [mira, setMira] = useState<number[]>(criterio?.entregables ?? [])
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const comoNumero = puntos.trim() === '' ? 0 : Number(puntos)
  const conParte = !Number.isNaN(comoNumero) && comoNumero > 0
  const soloEnlacesConIa =
    conParte &&
    calificador === 'IA' &&
    mira.length > 0 &&
    entregables.filter((e) => mira.includes(e.id)).every((e) => e.formato === 'ENLACE') &&
    !(criterio?.preguntas ?? []).some((p) => p.tipo === 'ABIERTA')

  const guardado = useMutation({
    mutationFn: () => {
      const datos = {
        nombre: nombre.trim(),
        queEvalua: queEvalua.trim() || null,
        puntosCalificados: comoNumero,
        calificador: conParte ? calificador : null,
        entregables: mira,
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
        {entregables.length > 0 && (
          <div className={estilos.campo} role="group" aria-label="Qué entregables mira">
            <span className={estilos.etiqueta}>Mira</span>
            {entregables.map((e) => (
              <label className={estilos.casilla} key={e.id}>
                <input
                  type="checkbox"
                  checked={mira.includes(e.id)}
                  onChange={(ev) =>
                    setMira((antes) =>
                      ev.target.checked ? [...antes, e.id] : antes.filter((id) => id !== e.id),
                    )
                  }
                />
                <span>
                  {e.nombre} <span className={estilos.cuenta}>({e.formato === 'ENLACE' ? 'enlace' : e.formato === 'ARCHIVO' ? 'archivo' : 'archivo o enlace'})</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <p className={estilos.ayuda}>
          La parte calificada califica el criterio entero mirando sus abiertas y los entregables
          marcados. Con 0 puntos el criterio solo suma sus cerradas.
        </p>
        {soloEnlacesConIa && (
          <p className={estilos.aviso} role="status">
            La IA no abre enlaces: un criterio de IA que solo mira enlaces, sin abiertas, no se
            publica. Pásalo a una persona o agrégale una abierta.
          </p>
        )}
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
