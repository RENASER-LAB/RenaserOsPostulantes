/**
 * El desglose de las preguntas propias en la ficha del candidato (V66).
 *
 * Cada criterio con su nota y de dónde sale («Conocimiento contable 24/30 ·
 * Sistema 8/10 + IA 16/20»); al abrirlo, sus preguntas con lo que respondió, lo
 * que sacó y, en las abiertas, la explicación y la cita de la IA. Un criterio
 * con abiertas sin calificar se ve pendiente, no con una nota parcial.
 *
 * Ajustar a mano una abierta —o calificarla si la IA no pudo— lo ve solo quien
 * tiene `ajustar_nota`: el dato viaja en el desglose, porque el panel no sabe
 * sus permisos. Ajustar no mueve a nadie de etapa.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CriterioDelDesglose,
  DesglosePorPuntos as Desglose,
  PreguntaDelDesglose,
} from '../../api/tipos'
import { ajustarNotaDeAbierta } from '../../api/preguntasPropias'
import { falloDe, type Fallo } from './consultas'
import { nombreDelTipo } from './formulario'
import { MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 })

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  const f = new Date(iso)
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`
}

/** «Sistema 8/10 + IA 16/20», solo con las partes que tiene. */
export function deDondeSale(c: CriterioDelDesglose): string {
  const partes: string[] = []
  if (c.sistemaMaximo > 0) partes.push(`Sistema ${num(c.sistema)}/${c.sistemaMaximo}`)
  if (c.iaMaximo > 0) partes.push(c.pendiente ? `IA pendiente/${c.iaMaximo}` : `IA ${num(c.ia)}/${c.iaMaximo}`)
  return partes.join(' + ')
}

export function DesglosePorPuntos({
  postulacionId,
  desglose,
}: {
  postulacionId: number
  desglose: Desglose
}) {
  const pendientes = [...desglose.criterios.flatMap((c) => c.preguntas), ...desglose.sinCriterio].filter(
    (p) => p.pendiente,
  ).length
  return (
    <div className={estilos.criterios}>
      <p className={estilos.cifras}>
        {desglose.completo ? (
          <>
            Nota de las preguntas: <b>{num(desglose.total)}</b> de 100
          </>
        ) : (
          <>
            Pendiente: {pendientes === 1 ? 'falta la nota de 1 abierta' : `falta la nota de ${pendientes} abiertas`}.
            Sin ella no hay nota de las preguntas ni del Perfil Integral.
          </>
        )}
      </p>
      {desglose.recalificacion === 'EN_CURSO' && (
        <p className={estilos.recalificando} role="status">
          Recalificando con la guía nueva: se ve su nota anterior hasta que llegue la nueva.
        </p>
      )}
      {desglose.recalificacion === 'PENDIENTE' && (
        <p className={estilos.aviso} role="status">
          Pendiente de recalificar: conserva la nota de la guía anterior.
          {desglose.motivoRecalificacion ? ` ${desglose.motivoRecalificacion}` : ''}
        </p>
      )}
      {desglose.criterios.map((c) => (
        <details className={estilos.criterio} key={c.id}>
          <summary className={estilos.cabeceraCriterio}>
            <span className={estilos.nombreCriterio}>{c.nombre}</span>
            <span className={estilos.puntosCriterio}>
              {c.pendiente ? `pendiente/${c.maximo}` : `${num(c.nota)}/${c.maximo}`} · {deDondeSale(c)}
            </span>
          </summary>
          {c.queEvalua && (
            <p className={estilos.queEvalua}>
              <b>Qué evalúa:</b> {c.queEvalua}
            </p>
          )}
          <ol className={estilos.preguntas}>
            {c.preguntas.map((p) => (
              <li key={p.preguntaId}>
                <PreguntaDelCandidato
                  postulacionId={postulacionId}
                  pregunta={p}
                  puedeAjustar={desglose.puedeAjustar}
                />
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  )
}

function PreguntaDelCandidato({
  postulacionId,
  pregunta: p,
  puedeAjustar,
}: {
  postulacionId: number
  pregunta: PreguntaDelDesglose
  puedeAjustar: boolean
}) {
  const cache = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState(p.obtenido === null ? '' : String(p.obtenido))
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const esAbierta = p.tipo === 'ABIERTA'
  const escrita = (p.respuesta ?? '').trim() !== ''
  const ajustable = puedeAjustar && esAbierta && p.maximo > 0 && escrita && p.respuestaId !== null

  const ajuste = useMutation({
    mutationFn: () => ajustarNotaDeAbierta(postulacionId, p.respuestaId!, { puntaje: Number(nota), motivo: motivo.trim() }),
    onSuccess: () => {
      setAbierto(false)
      setFallo(null)
      setMotivo('')
      // El criterio, la nota del banco, la del Perfil Integral y el grupo se recalculan.
      void cache.invalidateQueries({ queryKey: ['panel-desglose-evaluacion', postulacionId] })
      void cache.invalidateQueries({ queryKey: ['panel-perfil', postulacionId] })
      void cache.invalidateQueries({ queryKey: ['panel-ranking'] })
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar la nota.')),
  })

  const valor = Number(nota)
  const notaValida = nota.trim() !== '' && !Number.isNaN(valor) && valor >= 0 && valor <= p.maximo

  return (
    <article className={estilos.pregunta}>
      <div className={estilos.cabeceraPregunta}>
        <span className={estilos.chip}>
          {nombreDelTipo(p.tipo)} ·{' '}
          {p.sinPuntos ? 'sin puntos' : p.pendiente ? `pendiente/${p.maximo}` : `${num(p.obtenido)}/${p.maximo}`}
        </span>
        {ajustable && !abierto && (
          <button className={estilos.secundarioPequeno} type="button" onClick={() => setAbierto(true)}>
            {p.pendiente ? 'Calificar a mano' : 'Ajustar nota'}
          </button>
        )}
      </div>
      <p className={estilos.enunciado}>{p.enunciado}</p>
      {esAbierta ? (
        <p className={estilos.queDebeTener}>{escrita ? `«${p.respuesta}»` : 'En blanco: vale 0.'}</p>
      ) : (
        <p className={estilos.queDebeTener}>
          {p.opcionesElegidas.length > 0 ? `Marcó: ${p.opcionesElegidas.join(' · ')}` : 'Sin responder: vale 0.'}
        </p>
      )}
      {esAbierta && p.pendiente && <p className={estilos.ayuda}>Pendiente de la IA.</p>}
      {p.ajustada && (
        <p className={estilos.queDebeTener}>
          Ajustada por {p.ajustadaPor ?? 'alguien del equipo'}
          {p.ajustadaEn ? ` el ${fechaCorta(p.ajustadaEn)}` : ''}: «{p.motivoAjuste}»
        </p>
      )}
      {esAbierta && p.explicacion && (!p.ajustada || p.puntajeIa !== null) && (
        <p className={estilos.ayuda}>
          IA{p.ajustada && p.puntajeIa !== null ? ` ${num(p.puntajeIa)}/${p.maximo}` : ''} · {p.explicacion}
          {p.evidenciaCitada ? ` — cita: «${p.evidenciaCitada}»` : ''}
        </p>
      )}
      {abierto && (
        <form
          className={estilos.formulario}
          aria-label={p.pendiente ? 'Calificar a mano' : 'Ajustar la nota'}
          onSubmit={(e) => {
            e.preventDefault()
            if (notaValida && motivo.trim()) ajuste.mutate()
          }}
        >
          <div className={estilos.filaFormulario}>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Nota nueva (de 0 a {p.maximo})</span>
              <input
                className={estilos.entradaPuntos}
                type="number"
                min={0}
                max={p.maximo}
                step={0.01}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </label>
          </div>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>
              Motivo <span className={estilos.cuenta}>({motivo.length} de 1000)</span>
            </span>
            <textarea
              className={estilos.area}
              rows={2}
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className={estilos.acciones}>
            <button className={estilos.guardar} type="submit" disabled={ajuste.isPending || !notaValida || !motivo.trim()}>
              {ajuste.isPending ? 'Guardando…' : 'Guardar la nota'}
            </button>
            <button className={estilos.secundario} type="button" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
          {!notaValida && nota.trim() !== '' && (
            <p className={estilos.ayuda}>La nota va de 0 a {p.maximo}.</p>
          )}
          <MostrarFallo fallo={fallo} />
        </form>
      )}
    </article>
  )
}
