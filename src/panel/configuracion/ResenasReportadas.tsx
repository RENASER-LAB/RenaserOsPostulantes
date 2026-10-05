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
 *
 * ⚠️ **Ninguna de las dos decisiones sale con un clic.** Las dos cierran el
 * reporte para siempre, avisan a terceros y no se deshacen. Con la nota válida,
 * «Mantener» u «Ocultar» abren una ventana que dice qué se juzga, lo que va a
 * pasar, quién leerá la nota y que no se puede deshacer; solo su botón envía.
 * La confirmación es de esta pantalla: la API se comporta igual sin ella.
 */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { reportesDeResenas, resolverReporte } from '../api/resenas'
import type { ReporteParaModerar } from '../api/tipos'
import { formatearFechaCorta } from '@/dominio/reloj'
import { Modal } from '@/ui/Modal'
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

type Decision = 'MANTENER' | 'OCULTAR'

/**
 * Lo que dice la ventana de confirmación en cada uno de los cuatro casos: el
 * título —que es también el botón de confirmar— y lo que pasa al confirmar.
 */
export function loQueSeConfirma(
  objeto: ReporteParaModerar['objeto'],
  decision: Decision,
): { titulo: string; loQuePasa: string[] } {
  if (objeto === 'RESENA') {
    return decision === 'OCULTAR'
      ? {
          titulo: 'Ocultar la reseña',
          loQuePasa: [
            'Deja de verse en el perfil de la persona y en el panel de las demás empresas, y deja de contar en el promedio.',
            'La empresa autora la verá atenuada, con tu nota.',
            'A la persona le llega «Revisamos tu reporte: la ocultamos».',
          ],
        }
      : {
          titulo: 'Mantener la reseña',
          loQuePasa: [
            'Sigue visible y contando.',
            'A la persona le llega «Revisamos tu reporte: la mantuvimos».',
            'Solo se podrá volver a reportar si la empresa la edita.',
          ],
        }
  }
  return decision === 'OCULTAR'
    ? {
        titulo: 'Ocultar la respuesta',
        loQuePasa: [
          'Deja de verse para todas las empresas.',
          'La persona la verá atenuada, con tu nota, y no podrá editarla, borrarla ni volver a responder a esa reseña.',
          'Le llega un aviso a la campana.',
        ],
      }
    : {
        titulo: 'Mantener la respuesta',
        loQuePasa: [
          'Nada cambia.',
          'La empresa autora verá «La plataforma la mantuvo» con tu nota.',
          'A la persona no se le avisa.',
          'Solo se podrá volver a reportar si la persona la edita.',
        ],
      }
}

/** Qué se juzga, con nombres: la reseña de la empresa, o la respuesta de la persona. */
const queSeJuzga = (reporte: ReporteParaModerar): string =>
  reporte.objeto === 'RESENA'
    ? `Reseña de ${reporte.empresa} a ${reporte.persona}`
    : `Respuesta de ${reporte.persona} a la reseña de ${reporte.empresa}`

export function ResenasReportadas() {
  const [vista, setVista] = useState<'pendientes' | 'resueltas'>('pendientes')
  /*
    El porqué del servidor cuando el reporte ya no estaba pendiente —otra
    persona lo resolvió, o se retiró mientras se leía—. Va aquí, encima de la
    lista, y no en la tarjeta: la tarjeta sale de «Pendientes» al refrescar y
    se llevaría el mensaje con ella.
  */
  const [aviso, setAviso] = useState<string | null>(null)
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
          onClick={() => {
            setVista('pendientes')
            setAviso(null)
          }}
        >
          Pendientes ({pendientes.data?.length ?? 0})
        </button>
        <button
          type="button"
          className={propios.pestana}
          aria-pressed={vista === 'resueltas'}
          onClick={() => {
            setVista('resueltas')
            setAviso(null)
          }}
        >
          Resueltas
        </button>
      </div>

      {aviso && (
        <p className={estilos.avisoMalo} role="alert">
          {aviso}
        </p>
      )}
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
              <TarjetaDeReporte
                reporte={r}
                alResolver={() => pedirFoco([titulo])}
                alAvisar={setAviso}
              />
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
  alAvisar,
}: {
  reporte: ReporteParaModerar
  /** Resuelto, sale de la lista: quien la contiene decide adónde va el foco. */
  alResolver: () => void
  /** El mensaje que tiene que quedar encima de la lista, o `null` para quitarlo. */
  alAvisar: (mensaje: string | null) => void
}) {
  const cache = useQueryClient()
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  // La decisión que se está confirmando: con ella, la ventana está abierta.
  const [confirmando, setConfirmando] = useState<Decision | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const tarjeta = useRef<HTMLElement>(null)
  const confirmar = useRef<HTMLButtonElement>(null)
  const pendiente = reporte.estado === 'PENDIENTE'

  const resolucion = useMutation({
    mutationFn: (decision: Decision) =>
      resolverReporte(reporte.id, { decision, nota: nota.trim() }),
    onSuccess: async () => {
      setError(null)
      setFallo(null)
      setConfirmando(null)
      alAvisar(null)
      alResolver()
      await cache.invalidateQueries({ queryKey: ['panel-resenas-reportadas'] })
    },
    onError: async (causa) => {
      const mensaje = causa instanceof Error ? causa.message : 'No pudimos guardar la revisión.'
      // Ya resuelto por otra persona, o retirado mientras se leía: la ventana se
      // cierra, la lista se refresca y el porqué queda encima de ella.
      if (causa instanceof ErrorApi && causa.estado === 409) {
        setFallo(null)
        setConfirmando(null)
        alAvisar(mensaje)
        alResolver()
        await cache.invalidateQueries({ queryKey: ['panel-resenas-reportadas'] })
        return
      }
      // Sigue pendiente: la ventana sigue abierta con el error, y el foco vuelve
      // al botón de confirmar en cuanto se habilita, para reintentar.
      setFallo(mensaje)
      pedirFoco([confirmar])
    },
  })

  // Una sola decisión por reporte, aunque se pulse dos veces seguidas.
  const envio = useUnSoloEnvio()
  const resolviendo = resolucion.isPending || envio.ocupado
  const pedirFoco = useFocoPendiente({
    zona: () => tarjeta.current,
    respaldo: () => null,
    ocupado: resolviendo,
  })

  /** Con la nota válida, abre la ventana. Todavía no se envía nada. */
  const pedirConfirmacion = (decision: Decision) => {
    if (nota.trim() === '') {
      setError('Escribe la nota de la revisión: la leerán quienes se vean afectados.')
      return
    }
    if (Array.from(nota.trim()).length > MAX_NOTA) {
      setError(`La nota admite hasta ${MAX_NOTA} caracteres.`)
      return
    }
    setFallo(null)
    setConfirmando(decision)
  }

  /*
    «Volver», Escape, el aspa o el fondo: no se envía nada, la nota sigue en la
    tarjeta y el foco vuelve al botón que abrió la ventana. Mientras se guarda
    no se cierra: la decisión ya salió y hay que ver cómo acaba.
  */
  const cerrarConfirmacion = () => {
    if (resolviendo || !confirmando) return
    const decision = confirmando
    setConfirmando(null)
    setFallo(null)
    pedirFoco([`[data-decision="${decision}"]`])
  }

  const idNota = `nota-reporte-${reporte.id}`
  return (
    <>
      <article
        ref={tarjeta}
        className={propios.tarjeta}
        aria-label={`Reporte de ${reporte.objeto === 'RESENA' ? 'una reseña' : 'una respuesta'}`}
      >
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
                onClick={() => pedirConfirmacion('MANTENER')}
              >
                Mantener
              </button>
              <button
                type="button"
                className={propios.ocultar}
                data-decision="OCULTAR"
                disabled={resolviendo}
                onClick={() => pedirConfirmacion('OCULTAR')}
              >
                Ocultar
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
      {/* Fuera de la tarjeta: la ventana no es parte de lo que se juzga. */}
      {confirmando && (
        <ConfirmacionDeLaRevision
          reporte={reporte}
          decision={confirmando}
          nota={nota.trim()}
          guardando={resolviendo}
          fallo={fallo}
          referencia={confirmar}
          alVolver={cerrarConfirmacion}
          alConfirmar={() => envio.enviar(() => resolucion.mutateAsync(confirmando))}
        />
      )}
    </>
  )
}

/**
 * La ventana que se interpone entre «Ocultar» o «Mantener» y el envío.
 *
 * Es la compartida y sin pantalla completa: es un aviso corto. Abre con el foco
 * en el aspa —el primero de la ventana—, nunca en el botón de confirmar: un
 * Intro repetido tras pulsar «Ocultar» con el teclado la cierra, no resuelve.
 * La lista de «lo que pasa» sigue la de «Eliminar vacante».
 */
function ConfirmacionDeLaRevision({
  reporte,
  decision,
  nota,
  guardando,
  fallo,
  referencia,
  alVolver,
  alConfirmar,
}: {
  reporte: ReporteParaModerar
  decision: Decision
  nota: string
  guardando: boolean
  fallo: string | null
  referencia: React.Ref<HTMLButtonElement>
  alVolver: () => void
  alConfirmar: () => void
}) {
  const { titulo, loQuePasa } = loQueSeConfirma(reporte.objeto, decision)
  return (
    <Modal
      abierto
      titulo={titulo}
      onCerrar={alVolver}
      pie={
        <>
          <button type="button" className={propios.volver} onClick={alVolver} disabled={guardando}>
            Volver
          </button>
          <button
            ref={referencia}
            type="button"
            className={decision === 'OCULTAR' ? propios.ocultar : propios.confirmarMantener}
            onClick={alConfirmar}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : titulo}
          </button>
        </>
      }
    >
      <p className={propios.queSeJuzga}>{queSeJuzga(reporte)}</p>
      {/* `role="list"`: mundo.css le quita las viñetas a todo `ul`, y sin él Safari
          y VoiceOver dejan de anunciarla como lista. */}
      <ul className={propios.loQuePasa} role="list">
        {loQuePasa.map((frase) => (
          <li key={frase}>{frase}</li>
        ))}
      </ul>
      <p className={propios.tuNotaEtiqueta}>Tu nota</p>
      <p className={propios.tuNota}>«{nota}»</p>
      <p className={propios.sinDeshacer}>No se podrá deshacer.</p>
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </Modal>
  )
}
