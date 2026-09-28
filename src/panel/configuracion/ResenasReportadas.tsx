/**
 * «Reseñas reportadas» (V63): la plataforma revisa lo que la persona reporta de
 * una reseña y lo que la empresa autora reporta de una respuesta, en las mismas
 * dos listas.
 *
 * Solo la ve quien tiene `moderar_resenas` y es de la plataforma —doble llave,
 * como el alta de empresas—. Sin las dos, el backend contesta 403 y la sección
 * ni se pinta: no hay nada que explicar a quien no modera.
 *
 * Mantener y ocultar exigen las dos una «Nota de la revisión». Ocultar es
 * definitivo: lo oculto deja de verse y de contar, y nadie puede apelar.
 */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { reportesDeResenas, resolverReporte } from '../api/resenas'
import type { ReporteParaModerar } from '../api/tipos'
import { formatearFechaCorta } from '@/dominio/reloj'
import { Estrellas } from '@/ui/resenas/Resenas'
import { useFocoPendiente, useUnSoloEnvio } from '@/ui/resenas/ganchos'
import { motivosDelReporte } from '@/ui/resenas/modelo'
import estilos from './Configuracion.module.css'
import propios from './ResenasReportadas.module.css'

const MAX_NOTA = 1000

/** El motivo con las palabras de quien reportó: la persona o la empresa. */
function motivoDicho(reporte: ReporteParaModerar): string {
  const quien = reporte.objeto === 'RESENA' ? 'persona' : 'empresa'
  return (
    motivosDelReporte(quien).find((m) => m.codigo === reporte.motivo)?.nombre ?? reporte.motivo
  )
}

/** En qué quedó, en una frase. La retirada dice quién la retiró. */
function resultadoDicho(reporte: ReporteParaModerar): string {
  switch (reporte.estado) {
    case 'MANTENIDA':
      return 'Se mantuvo'
    case 'OCULTADA':
      return 'Se ocultó'
    case 'RETIRADA':
      return reporte.objeto === 'RESENA' ? 'Retirada por la empresa' : 'Retirada por la persona'
    default:
      return 'Pendiente'
  }
}

export function ResenasReportadas() {
  const [vista, setVista] = useState<'pendientes' | 'resueltas'>('pendientes')
  const titulo = useRef<HTMLHeadingElement>(null)
  // Resuelto, el reporte sale de «Pendientes» con sus botones: el foco iría a
  // <body>. Va al título de la sección.
  const pedirFoco = useFocoPendiente({ zona: () => null, respaldo: () => titulo.current, ocupado: false })
  const pendientes = useQuery({
    queryKey: ['panel-resenas-reportadas', false],
    // Sin `retry` propio: el cliente de datos ya no insiste con un 403.
    queryFn: () => reportesDeResenas(false),
  })
  const resueltas = useQuery({
    queryKey: ['panel-resenas-reportadas', true],
    queryFn: () => reportesDeResenas(true),
    // Solo cuando se mira: la lista de resueltas crece y no hace falta al entrar.
    enabled: vista === 'resueltas',
  })

  // Sin la doble llave, la sección no existe para quien mira.
  if (pendientes.error instanceof ErrorApi && pendientes.error.estado === 403) return null
  if (pendientes.isPending) return null

  const lista = vista === 'pendientes' ? pendientes : resueltas

  return (
    <section className={estilos.seccion} aria-labelledby="titulo-resenas-reportadas">
      <h2 className={estilos.tituloSeccion} id="titulo-resenas-reportadas" ref={titulo} tabIndex={-1}>
        Reseñas reportadas
      </h2>
      <p className={estilos.nota}>
        Lo que la persona reporta de una reseña y lo que la empresa autora reporta de una
        respuesta. Mientras está pendiente, lo reportado sigue visible y contando. Mantener u
        ocultar pide una nota; ocultar es definitivo.
      </p>

      <div className={propios.pestanas} role="group" aria-label="Qué reportes ver">
        <button
          type="button"
          className={propios.pestana}
          aria-pressed={vista === 'pendientes'}
          onClick={() => setVista('pendientes')}
        >
          Pendientes ({pendientes.data?.length ?? 0})
        </button>
        <button
          type="button"
          className={propios.pestana}
          aria-pressed={vista === 'resueltas'}
          onClick={() => setVista('resueltas')}
        >
          Resueltas
        </button>
      </div>

      {lista.isError && (
        <p className={estilos.avisoMalo} role="alert">
          No pudimos traer los reportes.{' '}
          <button className={propios.enlace} type="button" onClick={() => void lista.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}
      {lista.isPending && vista === 'resueltas' && <p className={estilos.nota}>Cargando…</p>}
      {lista.data && lista.data.length === 0 && (
        <p className={estilos.nota}>
          {vista === 'pendientes'
            ? 'No hay nada pendiente de revisar.'
            : 'Todavía no se ha resuelto ningún reporte.'}
        </p>
      )}
      {lista.data && lista.data.length > 0 && (
        <ul className={propios.tarjetas} role="list">
          {lista.data.map((r) => (
            <li key={r.id}>
              <TarjetaDeReporte reporte={r} alResolver={() => pedirFoco([titulo])} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TarjetaDeReporte({
  reporte,
  alResolver,
}: {
  reporte: ReporteParaModerar
  /** Resuelto, sale de la lista: quien la contiene decide adónde va el foco. */
  alResolver: () => void
}) {
  const cache = useQueryClient()
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const tarjeta = useRef<HTMLElement>(null)
  const pendiente = reporte.estado === 'PENDIENTE'

  const resolucion = useMutation({
    mutationFn: (decision: 'MANTENER' | 'OCULTAR') =>
      resolverReporte(reporte.id, { decision, nota: nota.trim() }),
    onSuccess: async () => {
      setError(null)
      alResolver()
      await cache.invalidateQueries({ queryKey: ['panel-resenas-reportadas'] })
    },
    onError: async (causa, decision) => {
      setError(causa instanceof Error ? causa.message : 'No pudimos guardar la revisión.')
      // Ya resuelto por otra persona, o retirado mientras se leía: se refresca.
      if (causa instanceof ErrorApi && causa.estado === 409) {
        alResolver()
        await cache.invalidateQueries({ queryKey: ['panel-resenas-reportadas'] })
        return
      }
      // Sigue pendiente: el foco vuelve al botón pulsado en cuanto se habilita.
      pedirFoco([`[data-decision="${decision}"]`])
    },
  })

  // «Mantener» y «Ocultar» comparten candado: una sola decisión por reporte.
  const envio = useUnSoloEnvio()
  const resolviendo = resolucion.isPending || envio.ocupado
  const pedirFoco = useFocoPendiente({
    zona: () => tarjeta.current,
    respaldo: () => null,
    ocupado: resolviendo,
  })

  const resolver = (decision: 'MANTENER' | 'OCULTAR') => {
    if (nota.trim() === '') {
      setError('Escribe la nota de la revisión: la leerán quienes se vean afectados.')
      return
    }
    if (Array.from(nota.trim()).length > MAX_NOTA) {
      setError(`La nota admite hasta ${MAX_NOTA} caracteres.`)
      return
    }
    envio.enviar(() => resolucion.mutateAsync(decision))
  }

  const idNota = `nota-reporte-${reporte.id}`
  return (
    <article ref={tarjeta} className={propios.tarjeta} aria-label={`Reporte de ${reporte.objeto === 'RESENA' ? 'una reseña' : 'una respuesta'}`}>
      <p className={propios.que}>
        <b>{reporte.objeto === 'RESENA' ? 'Reseña' : 'Respuesta'}</b> · reportada el{' '}
        {formatearFechaCorta(reporte.reportadoEn)}
      </p>
      <p className={propios.quien}>
        <span>
          {reporte.empresa} → {reporte.persona}
        </span>
        <Estrellas valor={reporte.estrellas} />
      </p>
      {/* Si se reporta la respuesta, la reseña va encima de contexto y la respuesta es lo que se juzga. */}
      <p className={reporte.objeto === 'RESPUESTA' ? propios.contexto : propios.juzgado}>
        {reporte.textoResena}
      </p>
      {reporte.objeto === 'RESPUESTA' && reporte.textoRespuesta && (
        <div className={propios.respuestaJuzgada}>
          <p className={propios.etiqueta}>La respuesta de {reporte.persona}</p>
          <p className={propios.juzgado}>{reporte.textoRespuesta}</p>
        </div>
      )}
      <p className={propios.motivo}>
        <b>Motivo:</b> {motivoDicho(reporte)}
      </p>
      {reporte.comentario && <p className={propios.comentario}>«{reporte.comentario}»</p>}

      {pendiente ? (
        <div className={propios.revision}>
          <label className={propios.etiqueta} htmlFor={idNota}>
            Nota de la revisión
          </label>
          <textarea
            id={idNota}
            className={propios.area}
            rows={3}
            value={nota}
            disabled={resolviendo}
            onChange={(e) => {
              setNota(e.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${idNota}-error` : undefined}
          />
          {error && (
            <p className={propios.error} id={`${idNota}-error`} role="alert">
              {error}
            </p>
          )}
          <div className={propios.botones}>
            <button
              type="button"
              className={propios.mantener}
              data-decision="MANTENER"
              disabled={resolviendo}
              onClick={() => resolver('MANTENER')}
            >
              Mantener
            </button>
            <button
              type="button"
              className={propios.ocultar}
              data-decision="OCULTAR"
              disabled={resolviendo}
              onClick={() => resolver('OCULTAR')}
            >
              {resolviendo ? 'Guardando…' : 'Ocultar'}
            </button>
          </div>
        </div>
      ) : (
        <p className={propios.resultado}>
          <b>{resultadoDicho(reporte)}</b>
          {reporte.resueltoEn && ` el ${formatearFechaCorta(reporte.resueltoEn)}`}
          {reporte.notaRevision && ` · «${reporte.notaRevision}»`}
        </p>
      )}
    </article>
  )
}
