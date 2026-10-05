/**
 * La pestaña «Prueba» de la ficha cuando la vacante rinde la prueba escrita en
 * el editor (V67): la prueba de una persona, criterio a criterio.
 *
 * Cada criterio enseña su nota y de dónde sale —«Sistema 8/10 + IA 16/20»—, sus
 * cerradas con la opción marcada, sus abiertas, los entregables que mira, la
 * explicación de la IA y, si alguien la ajustó, quién, cuándo y por qué. La
 * suma de los criterios es la nota de la etapa; mientras falte uno, no hay nota
 * y se dice qué falta.
 *
 * ⚠️ **Solo se ajusta la parte calificada**, de 0 a su máximo y con motivo: la
 * parte automática sale de las cerradas. Si la IA vuelve a calificar, el
 * ajuste se queda (lo garantiza el servidor).
 *
 * ⚠️ **No se mezcla con la rúbrica de las plantillas** (decisión 3): esa vive en
 * `CriteriosDeEtapa` y sus endpoints; esta, en `/prueba-propia`.
 */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import {
  ajustarCriterio,
  pedirLaIaOtraVez,
  verPruebaDelCandidato,
  type CriterioDelCandidato,
  type EntregaVista,
  type PreguntaDelCandidato,
  type PruebaDelCandidato as Prueba,
} from '../api/pruebaPropia'
import { formatearFechaCorta } from '@/dominio/reloj'
import { AbrirElArchivo, ElEnlaceQuePego } from './EntregablesDePrueba'
import { nombreDelFormato, nombreDelTipo } from './preguntas/formulario'
import estilos from './Vacante.module.css'

const claveDe = (postulacionId: number) => ['panel-prueba-propia-candidato', postulacionId]

/** «Sistema 8/10 + IA 16/20», «Persona pendiente/20», o solo lo del sistema. */
export function deDondeSale(c: CriterioDelCandidato): string {
  const partes: string[] = []
  if (c.sistemaMaximo > 0) partes.push(`Sistema ${num(c.sistema)}/${num(c.sistemaMaximo)}`)
  if (c.calificadaMaximo > 0) {
    const quien = c.calificador === 'PERSONA' ? 'Persona' : 'IA'
    partes.push(
      `${quien} ${c.calificada === null ? 'pendiente' : num(c.calificada)}/${num(c.calificadaMaximo)}`,
    )
  }
  return partes.join(' + ')
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))

function estadoDe(p: Prueba): string {
  const nombre = p.cuestionario ? 'el cuestionario' : 'la prueba'
  // El pronombre y los participios concuerdan con lo que es: «lo abrió», «Entregado, solo».
  const pronombre = p.cuestionario ? 'lo' : 'la'
  const entregada = p.cuestionario ? 'Entregado' : 'Entregada'
  const sola = p.cuestionario ? 'solo' : 'sola'
  switch (p.estado) {
    case 'SIN_PRUEBA':
      return 'Todavía no llegó a la prueba técnica.'
    case 'SIN_EMPEZAR':
      return `Todavía no abrió ${nombre}.`
    case 'EN_CURSO':
      return `Está rindiendo ${nombre}${p.iniciadoEn ? `: ${pronombre} abrió el ${formatearFechaCorta(p.iniciadoEn)}` : ''}.`
    case 'NO_COMPLETADA':
      return `Su tiempo terminó y ${nombre} quedó sin completar${
        p.loQueFalta.length > 0 ? `: ${p.loQueFalta.join('; ')}` : ''
      }. No tiene nota ni sale en el ranking; su proceso espera a que alguien lo cierre.`
    case 'ENTREGADA':
      return `${entregada}${p.entregadoEn ? ` el ${formatearFechaCorta(p.entregadoEn)}` : ''}${
        p.entregaAutomatica ? `, ${sola}, al vencer el tiempo` : ''
      }.`
  }
}

export function PruebaDelCandidato({ postulacionId }: { postulacionId: number }) {
  const consulta = useQuery({
    queryKey: claveDe(postulacionId),
    queryFn: () => verPruebaDelCandidato(postulacionId),
    retry: false,
  })
  const p = consulta.data
  return (
    <>
      <h3 className={estilos.tituloDetalle}>
        {p?.cuestionario ? 'El cuestionario, criterio a criterio' : 'La prueba técnica, criterio a criterio'}
      </h3>
      {consulta.isPending && <p className={estilos.dato}>Cargando la prueba…</p>}
      {consulta.isError && (
        <p className={estilos.dato}>
          {consulta.error instanceof ErrorApi && consulta.error.estado === 403
            ? 'Hace falta el permiso «abrir_ficha_candidato» para ver su prueba.'
            : 'No se pudo leer su prueba.'}
        </p>
      )}
      {p && <Contenido prueba={p} />}
    </>
  )
}

function Contenido({ prueba: p }: { prueba: Prueba }) {
  const entregada = p.estado === 'ENTREGADA'
  return (
    <>
      <p className={estilos.dato}>{estadoDe(p)}</p>
      {entregada && (
        <p className={estilos.dato}>
          {p.nota !== null ? (
            <>
              Nota de la prueba: <b>{num(p.nota)}</b> de 100
            </>
          ) : (
            <>Sin nota todavía. Falta {p.loQueFalta.join('; ')}.</>
          )}
        </p>
      )}
      {p.recalificando && (
        <p className={estilos.dato} role="status">
          Recalificando con la guía nueva.
        </p>
      )}
      {entregada && p.motivoPendiente && <PedirLaIa postulacionId={p.postulacionId} motivo={p.motivoPendiente} />}
      {p.criterios.length > 0 && p.estado !== 'SIN_PRUEBA' && (
        <ul className={estilos.criterios} role="list">
          {p.criterios.map((c) => (
            <Criterio
              key={c.criterioId}
              postulacionId={p.postulacionId}
              criterio={c}
              entregables={p.entregables}
              puedeAjustar={p.puedeAjustar}
              mostrarNota={entregada}
            />
          ))}
        </ul>
      )}
      {p.entregables.length > 0 && p.estado !== 'SIN_PRUEBA' && p.estado !== 'SIN_EMPEZAR' && (
        <>
          <h3 className={estilos.tituloDetalle}>Lo que entregó</h3>
          <ul className={estilos.criterios} role="list">
            {p.entregables.map((e) => (
              <Entrega key={e.entregableId} entrega={e} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function Criterio({
  postulacionId,
  criterio: c,
  entregables,
  puedeAjustar,
  mostrarNota,
}: {
  postulacionId: number
  criterio: CriterioDelCandidato
  entregables: EntregaVista[]
  puedeAjustar: boolean
  mostrarNota: boolean
}) {
  const mira = entregables.filter((e) => c.entregables.includes(e.entregableId))
  const ajustada = c.ajustadaPor !== null
  return (
    <li className={estilos.criterio}>
      <span className={`${estilos.notaCriterio} ${estilos.notaAncha}`}>
        {!mostrarNota ? '—' : c.nota !== null ? `${num(c.nota)}/${num(c.maximo)}` : 'pendiente'}
      </span>
      <span className={estilos.cuerpoCriterio}>
        <span>
          <b>{c.nombre}</b>
          {mostrarNota && ` · ${deDondeSale(c)}`}
        </span>
        {mostrarNota && c.estado === 'PENDIENTE' && (
          <span className={estilos.explicacion}>
            {c.calificador === 'PERSONA'
              ? 'La parte calificada la pone una persona: todavía nadie la calificó.'
              : 'Falta la nota de la IA en su parte calificada.'}
          </span>
        )}
        {c.explicacion && <span className={estilos.explicacion}>{c.explicacion}</span>}
        {c.evidencia && (
          <span className={estilos.explicacion}>
            <b>Evidencia:</b> {c.evidencia}
          </span>
        )}
        {ajustada && (
          <span className={estilos.explicacion}>
            Ajustada por {c.ajustadaPor}
            {c.ajustadaEn ? ` el ${formatearFechaCorta(c.ajustadaEn)}` : ''}
            {c.calificadaIa !== null ? ` (la IA había puesto ${num(c.calificadaIa)})` : ''}
            {c.motivoAjuste ? `: ${c.motivoAjuste}` : ''}
          </span>
        )}
        {mira.length > 0 && (
          <span className={estilos.explicacion}>Mira: {mira.map((e) => e.nombre).join(', ')}</span>
        )}
        {c.preguntas.length > 0 && (
          <ol className={estilos.preguntasDelCriterio}>
            {c.preguntas.map((pr) => (
              <Pregunta key={pr.preguntaId} pregunta={pr} />
            ))}
          </ol>
        )}
        {puedeAjustar && c.calificadaMaximo > 0 && (
          <AjustarLaParteCalificada postulacionId={postulacionId} criterio={c} />
        )}
      </span>
    </li>
  )
}

function Pregunta({ pregunta: p }: { pregunta: PreguntaDelCandidato }) {
  const abierta = p.tipo === 'ABIERTA'
  return (
    <li className={estilos.preguntaDelCriterio}>
      <span>
        <b>{nombreDelTipo(p.tipo)}</b>
        {!abierta && p.puntos !== null && ` · ${num(p.obtenido ?? 0)} de ${num(p.puntos)}`}
        {' · '}
        {p.enunciado}
      </span>
      {abierta ? (
        <span className={estilos.explicacion}>
          {p.respondida && p.respuesta ? p.respuesta : 'Sin responder.'}
        </span>
      ) : p.opciones.length > 0 ? (
        <ul className={estilos.opcionesDelCriterio}>
          {p.opciones.map((o) => (
            <li key={o.id} className={o.marcada ? estilos.opcionMarcada : undefined}>
              {o.texto} <span className={estilos.puntosOpcion}>({num(o.puntos)} pts)</span>
              {o.marcada && ' · la marcó'}
            </li>
          ))}
        </ul>
      ) : null}
      {!abierta && !p.respondida && <span className={estilos.explicacion}>Sin responder.</span>}
    </li>
  )
}

function Entrega({ entrega: e }: { entrega: EntregaVista }) {
  return (
    <li className={estilos.criterio}>
      <span className={`${estilos.notaCriterio} ${estilos.notaAncha}`}>
        {e.loEntrego ? 'entregó' : 'falta'}
      </span>
      <span className={estilos.cuerpoCriterio}>
        <span>
          <b>{e.nombre}</b> · {nombreDelFormato(e.formato)} · {e.obligatorio ? 'obligatorio' : 'opcional'}
          {e.subidoEn ? ` · ${formatearFechaCorta(e.subidoEn)}` : ''}
        </span>
        {e.detalle && <span className={estilos.explicacion}>{e.detalle}</span>}
        {e.enlace && <ElEnlaceQuePego enlace={e.enlace} />}
        {e.archivoId !== null && (
          <AbrirElArchivo archivoId={e.archivoId} nombre={e.archivoNombre} deQue={e.nombre} />
        )}
        {e.porQueNoSeVe && e.enlace === null && e.archivoId === null && (
          <span className={estilos.explicacion}>{e.porQueNoSeVe}</span>
        )}
      </span>
    </li>
  )
}

function PedirLaIa({ postulacionId, motivo }: { postulacionId: number; motivo: string }) {
  const cache = useQueryClient()
  const [aviso, setAviso] = useState<string | null>(null)
  const pedido = useMutation({
    mutationFn: () => pedirLaIaOtraVez(postulacionId),
    onSuccess: (r) => {
      setAviso(r.mensaje)
      cache.invalidateQueries({ queryKey: claveDe(postulacionId) })
    },
    onError: (causa) => setAviso(causa instanceof Error ? causa.message : 'No se pudo pedir.'),
  })
  return (
    <p className={estilos.dato} role="status">
      {motivo}{' '}
      <button
        className={estilos.calificarCriterio}
        type="button"
        onClick={() => pedido.mutate()}
        disabled={pedido.isPending}
      >
        {pedido.isPending ? 'Pidiendo…' : 'Reintentar con la IA'}
      </button>
      {aviso && <span className={estilos.explicacion}> {aviso}</span>}
    </p>
  )
}

/**
 * Ajustar la parte calificada de un criterio: de 0 a su máximo, con hasta dos
 * decimales y un motivo. Lo mismo que valida el servidor, dicho antes de pulsar.
 */
function AjustarLaParteCalificada({
  postulacionId,
  criterio: c,
}: {
  postulacionId: number
  criterio: CriterioDelCandidato
}) {
  const cache = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [puntaje, setPuntaje] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
  const [guardada, setGuardada] = useState(false)
  const disparador = useRef<HTMLButtonElement>(null)

  const guardar = useMutation({
    mutationFn: () => ajustarCriterio(postulacionId, c.criterioId, { puntaje: Number(puntaje), motivo: motivo.trim() }),
    onSuccess: (prueba) => {
      setFallo(null)
      setAbierto(false)
      setGuardada(true)
      cache.setQueryData(claveDe(postulacionId), prueba)
      cache.invalidateQueries({ queryKey: ['panel-ranking'] })
      requestAnimationFrame(() => disparador.current?.focus())
    },
    onError: (causa: unknown) => {
      if (causa instanceof ErrorApi && causa.estado === 403) {
        setFallo('Hace falta el permiso «ajustar_nota» para poner esta nota.')
        return
      }
      setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar la nota.')
    },
  })

  const quien = c.calificador === 'PERSONA' ? 'persona' : 'IA'
  if (!abierto) {
    return (
      <>
        {guardada && (
          <p className={estilos.guardadaCriterio} role="status">
            Nota guardada.
          </p>
        )}
        <button
          ref={disparador}
          className={estilos.calificarCriterio}
          type="button"
          onClick={() => {
            setAbierto(true)
            setGuardada(false)
            setFallo(null)
            setPuntaje(c.calificada !== null ? String(c.calificada) : '')
          }}
        >
          <span aria-hidden="true">{c.calificada !== null ? 'Ajustar la parte calificada' : 'Calificar a mano'}</span>
          <span className="solo-lectores">
            {c.calificada !== null ? 'Ajustar la parte calificada de' : 'Calificar a mano'} {c.nombre}
          </span>
        </button>
      </>
    )
  }

  const numero = Number(puntaje)
  const conDosDecimales = /^\d+(?:[.,]\d{1,2})?$/.test(puntaje.trim())
  const valido =
    puntaje.trim() !== '' && conDosDecimales && Number.isFinite(numero) && numero >= 0 && numero <= c.calificadaMaximo
  const listo = valido && motivo.trim() !== ''

  return (
    <form
      className={estilos.formaCriterio}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (listo) guardar.mutate()
      }}
    >
      <label className={estilos.campoCriterio}>
        <span className={estilos.etiquetaCriterio}>
          Parte calificada ({quien}) · de 0 a {num(c.calificadaMaximo)}
        </span>
        <input
          className={estilos.puntajeCriterio}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={c.calificadaMaximo}
          value={puntaje}
          onChange={(e) => setPuntaje(e.target.value)}
          autoFocus
        />
      </label>
      {puntaje.trim() !== '' && !valido && (
        <p className={estilos.falloCriterio}>
          Un número de 0 a {num(c.calificadaMaximo)}, con hasta dos decimales.
        </p>
      )}
      <label className={estilos.campoCriterio}>
        <span className={estilos.etiquetaCriterio}>Motivo · queda registrado</span>
        <textarea
          className={estilos.explicacionCriterio}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Qué viste en su entrega que justifica ese puntaje."
        />
      </label>
      <div className={estilos.accionesCriterio}>
        <button className={estilos.guardarCriterio} type="submit" disabled={!listo || guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar la nota'}
        </button>
        <button
          className={estilos.cancelarCriterio}
          type="button"
          onClick={() => {
            setAbierto(false)
            setFallo(null)
            requestAnimationFrame(() => disparador.current?.focus())
          }}
          disabled={guardar.isPending}
        >
          Cancelar
        </button>
      </div>
      {fallo && (
        <p className={estilos.falloCriterio} role="alert">
          {fallo}
        </p>
      )}
    </form>
  )
}
