/**
 * Las preguntas ya publicadas: en lectura, salvo dos cosas que cambian la vara
 * para todos a la vez.
 *
 *   - **Los puntos** (de cada pregunta, opción o nivel): se recalcula a todos al
 *     instante, sin IA. Sirve sobre todo para arreglar una clave mal puesta.
 *   - **Las instrucciones de la IA** (la guía, lo que evalúa cada criterio y lo
 *     que debe tener cada abierta): se vuelve a calificar a quien ya tiene nota.
 *     Sin saldo o con la IA apagada no se guarda nada, y se dice en una ventana.
 *
 * Ningún texto se toca: ni enunciados, ni opciones, ni el nombre de un
 * criterio. Mientras nadie haya postulado, lo que se hace es abrir un borrador.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  abrirBorrador,
  cambiarPuntos,
  corregirInstrucciones,
  reintentarRecalificacion,
  type EditorDePreguntas,
  type VersionDePreguntas,
} from '../../api/preguntasPropias'
import { Modal } from '@/ui/Modal'
import { claveDelEditor, falloDe, type Fallo } from './consultas'
import {
  avisoAntesDeRecalcular,
  avisoAntesDeRecalificar,
  nombreDelTipo,
  puntosDelCriterio,
  resultadoDelReintento,
} from './formulario'
import { ContenidoDePregunta } from './BloqueCriterio'
import { MostrarFallo } from './piezas'
import { VistaDeVersion } from './VistaDeVersion'
import estilos from './EditorDePreguntas.module.css'

type Modo = 'LEER' | 'PUNTOS' | 'INSTRUCCIONES'

interface Props {
  editor: EditorDePreguntas
  publicada: VersionDePreguntas
  alCambiar: (editor: EditorDePreguntas) => void
}

export function PreguntasPublicadas({ editor, publicada, alCambiar }: Props) {
  const cache = useQueryClient()
  const vacanteId = editor.vacanteId
  const [modo, setModo] = useState<Modo>('LEER')
  const [hecho, setHecho] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const recalificacion = editor.recalificacion
  const enCurso = (recalificacion?.recalificando ?? 0) > 0
  const refrescar = () => cache.invalidateQueries({ queryKey: claveDelEditor(vacanteId) })

  const borrador = useMutation({
    mutationFn: () => abrirBorrador(vacanteId),
    onSuccess: alCambiar,
    onError: (c) => setFallo(falloDe(c, 'No se pudo abrir el borrador.')),
  })
  const reintento = useMutation({
    mutationFn: () => reintentarRecalificacion(vacanteId),
    onSuccess: (r) => {
      setHecho(resultadoDelReintento(r))
      void refrescar()
    },
    onError: (c) => setFallo(falloDe(c, 'No se pudo reintentar.')),
  })

  return (
    <div className={estilos.criterios}>
      <p className={estilos.cartel}>
        Publicadas. Desde la primera postulación solo se cambian los puntos y las instrucciones de
        la IA, y cualquiera de los dos vuelve a calcular la nota de todos.
      </p>

      {recalificacion && (recalificacion.recalificando > 0 || recalificacion.pendientes > 0) && (
        <div className={estilos.recalificando} role="status">
          {recalificacion.recalificando > 0 && (
            <p>
              Recalificando con la guía nueva: {recalificacion.alDia} de {recalificacion.conNota}{' '}
              {recalificacion.conNota === 1 ? 'ya tiene' : 'ya tienen'} la nota nueva. Cada persona
              conserva la anterior hasta que llega la suya.
            </p>
          )}
          {recalificacion.pendientes > 0 && (
            <>
              <p>
                Pendiente de recalificar: {recalificacion.pendientes}{' '}
                {recalificacion.pendientes === 1 ? 'persona conserva' : 'personas conservan'} la nota
                de la guía anterior.
              </p>
              <ul>
                {recalificacion.motivos.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              {editor.puedeEditar && (
                <button
                  className={estilos.secundarioPequeno}
                  type="button"
                  onClick={() => reintento.mutate()}
                  disabled={reintento.isPending}
                >
                  Reintentar
                </button>
              )}
            </>
          )}
        </div>
      )}

      {editor.puedeEditar && modo === 'LEER' && (
        <div className={estilos.entradas}>
          {!editor.hayPostulantes && (
            <button
              className={estilos.secundario}
              type="button"
              onClick={() => borrador.mutate()}
              disabled={borrador.isPending}
            >
              Abrir un borrador para cambiarlas
            </button>
          )}
          <button
            className={estilos.secundario}
            type="button"
            onClick={() => {
              setHecho(null)
              setModo('PUNTOS')
            }}
            disabled={enCurso}
          >
            Cambiar los puntos
          </button>
          <button
            className={estilos.secundario}
            type="button"
            onClick={() => {
              setHecho(null)
              setModo('INSTRUCCIONES')
            }}
            disabled={enCurso}
          >
            Corregir las instrucciones de la IA
          </button>
        </div>
      )}
      {enCurso && editor.puedeEditar && (
        <p className={estilos.ayuda}>
          Mientras se recalifica, ni la guía ni los puntos se pueden volver a cambiar.
        </p>
      )}

      {hecho && (
        <p className={estilos.estado} role="status">
          {hecho}
        </p>
      )}
      <MostrarFallo fallo={fallo} />

      {modo === 'LEER' && <VistaDeVersion version={publicada} />}
      {modo === 'PUNTOS' && (
        <CambiarLosPuntos
          vacanteId={vacanteId}
          publicada={publicada}
          rindieron={recalificacion?.rindieron ?? 0}
          alTerminar={(mensaje) => {
            setModo('LEER')
            setHecho(mensaje)
            void refrescar()
          }}
          alCancelar={() => setModo('LEER')}
        />
      )}
      {modo === 'INSTRUCCIONES' && (
        <CorregirLasInstrucciones
          vacanteId={vacanteId}
          publicada={publicada}
          conNota={recalificacion?.conNota ?? 0}
          alTerminar={(mensaje) => {
            setModo('LEER')
            setHecho(mensaje)
            void refrescar()
          }}
          alCancelar={() => setModo('LEER')}
        />
      )}
    </div>
  )
}

// ---------- Los puntos ----------

function CambiarLosPuntos({
  vacanteId,
  publicada,
  rindieron,
  alTerminar,
  alCancelar,
}: {
  vacanteId: number
  publicada: VersionDePreguntas
  rindieron: number
  alTerminar: (mensaje: string) => void
  alCancelar: () => void
}) {
  const preguntas = useMemo(
    () => [...publicada.criterios.flatMap((c) => c.preguntas), ...publicada.sinCriterio],
    [publicada],
  )
  const [puntos, setPuntos] = useState<Record<number, string>>(
    () => Object.fromEntries(preguntas.map((p) => [p.id, String(p.puntos)])),
  )
  const [opciones, setOpciones] = useState<Record<number, string>>(
    () => Object.fromEntries(preguntas.flatMap((p) => p.opciones.map((o) => [o.id, String(o.puntos)]))),
  )
  const [confirmando, setConfirmando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const suma = preguntas.reduce((s, p) => s + (Number(puntos[p.id]) || 0), 0)

  const guardado = useMutation({
    mutationFn: () =>
      cambiarPuntos(vacanteId, {
        preguntas: preguntas.map((p) => ({
          id: p.id,
          puntos: Number(puntos[p.id]),
          opciones: p.opciones.map((o) => ({ id: o.id, puntos: Number(opciones[o.id]) })),
        })),
      }),
    onSuccess: (r) =>
      alTerminar(
        r.personas === 0
          ? 'Puntos guardados.'
          : `Puntos guardados: se recalcularon las notas de ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}, sin IA y sin mover a nadie de etapa.`,
      ),
    onError: (c) => {
      setConfirmando(false)
      setFallo(falloDe(c, 'No se pudieron cambiar los puntos.'))
    },
  })

  return (
    <form
      className={estilos.criterios}
      aria-label="Cambiar los puntos"
      onSubmit={(e) => {
        e.preventDefault()
        if (rindieron > 0 && !confirmando) {
          setConfirmando(true)
          return
        }
        guardado.mutate()
      }}
    >
      <p className={estilos.cifras}>
        Suma de lo escrito: <b>{suma}</b> de 100. El total tiene que seguir en 100.
      </p>
      {publicada.criterios.map((c) => (
        <section className={estilos.criterio} key={c.id}>
          <header className={estilos.cabeceraCriterio}>
            <h3 className={estilos.nombreCriterio}>{c.nombre}</h3>
            <span className={estilos.puntosCriterio}>{puntosDelCriterio(c)}</span>
          </header>
          {c.preguntas.map((p) => (
            <div className={estilos.pregunta} key={p.id}>
              <div className={estilos.cabeceraPregunta}>
                <span className={estilos.chip}>{nombreDelTipo(p.tipo)}</span>
                <label className={estilos.filaOpcion}>
                  <span className={estilos.etiqueta}>Puntos</span>
                  <input
                    className={estilos.entradaPuntos}
                    type="number"
                    step={1}
                    aria-label={`Puntos de «${p.enunciado.slice(0, 40)}»`}
                    value={puntos[p.id]}
                    onChange={(e) => setPuntos((v) => ({ ...v, [p.id]: e.target.value }))}
                  />
                </label>
              </div>
              <p className={estilos.enunciado}>{p.enunciado}</p>
              {p.opciones.map((o) => (
                <label className={estilos.filaOpcion} key={o.id}>
                  <span className={estilos.textoOpcion}>
                    {p.tipo === 'ESCALA' && o.texto !== String(o.orden) ? `${o.orden} · ${o.texto}` : o.texto}
                  </span>
                  <input
                    className={estilos.entradaPuntos}
                    type="number"
                    step={1}
                    aria-label={`Puntos de la opción «${o.texto}»`}
                    value={opciones[o.id]}
                    onChange={(e) => setOpciones((v) => ({ ...v, [o.id]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          ))}
        </section>
      ))}
      {confirmando && (
        <div className={estilos.confirmacion} role="alertdialog" aria-label="Recalcular las notas">
          <span>{avisoAntesDeRecalcular(rindieron)}</span>
        </div>
      )}
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending}>
          {guardado.isPending ? 'Guardando…' : confirmando ? 'Sí, recalcular a todos' : 'Guardar los puntos'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
    </form>
  )
}

// ---------- Las instrucciones de la IA ----------

/** El texto que el backend usa cuando no hay con qué recalificar. */
const esSinSaldo = (mensaje: string) =>
  /saldo|apagada|suspendida|tope/i.test(mensaje)

/** Si el mensaje del backend ya dice que el cambio no se guardó (y por qué). */
const explicaQueNoSeGuardo = (mensaje: string) => /no se guardó/i.test(mensaje)

function CorregirLasInstrucciones({
  vacanteId,
  publicada,
  conNota,
  alTerminar,
  alCancelar,
}: {
  vacanteId: number
  publicada: VersionDePreguntas
  conNota: number
  alTerminar: (mensaje: string) => void
  alCancelar: () => void
}) {
  const [guia, setGuia] = useState(publicada.guiaCalificacion ?? '')
  const [queEvalua, setQueEvalua] = useState<Record<number, string>>(
    () => Object.fromEntries(publicada.criterios.map((c) => [c.id, c.queEvalua ?? ''])),
  )
  const abiertas = publicada.criterios.flatMap((c) => c.preguntas).filter((p) => p.tipo === 'ABIERTA')
  const [queDebeTener, setQueDebeTener] = useState<Record<number, string>>(
    () => Object.fromEntries(abiertas.map((p) => [p.id, p.queDebeTener ?? ''])),
  )
  const [confirmando, setConfirmando] = useState(false)
  const [sinSaldo, setSinSaldo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const guardado = useMutation({
    mutationFn: () =>
      corregirInstrucciones(vacanteId, {
        guiaCalificacion: guia,
        criterios: publicada.criterios.map((c) => ({ id: c.id, texto: queEvalua[c.id] ?? '' })),
        preguntas: abiertas.map((p) => ({ id: p.id, texto: queDebeTener[p.id] ?? '' })),
      }),
    onSuccess: (r) =>
      alTerminar(
        r.personas === 0
          ? 'Instrucciones guardadas. Quien responda desde ahora se califica con ellas.'
          : `Instrucciones guardadas: se vuelve a calificar a ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}. Cada una conserva su nota hasta que llega la nueva.`,
      ),
    onError: (c) => {
      setConfirmando(false)
      const f = falloDe(c, 'No se pudieron guardar las instrucciones.')
      if (esSinSaldo(f.mensaje)) {
        setSinSaldo(f.mensaje)
        return
      }
      setFallo(f)
    },
  })

  return (
    <form
      className={estilos.criterios}
      aria-label="Corregir las instrucciones de la IA"
      onSubmit={(e) => {
        e.preventDefault()
        if (conNota > 0 && !confirmando) {
          setConfirmando(true)
          return
        }
        guardado.mutate()
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Guía de calificación para la IA{' '}
          <span className={estilos.cuenta}>(opcional · {guia.length} de 2000)</span>
        </span>
        <textarea className={estilos.area} rows={4} maxLength={2000} value={guia} onChange={(e) => setGuia(e.target.value)} />
      </label>
      {publicada.criterios.map((c) => (
        <section className={estilos.criterio} key={c.id}>
          <h3 className={estilos.nombreCriterio}>{c.nombre}</h3>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Qué evalúa</span>
            <textarea
              className={estilos.area}
              rows={2}
              maxLength={1000}
              value={queEvalua[c.id]}
              onChange={(e) => setQueEvalua((v) => ({ ...v, [c.id]: e.target.value }))}
            />
          </label>
          {c.preguntas
            .filter((p) => p.tipo === 'ABIERTA')
            .map((p) => (
              <div className={estilos.pregunta} key={p.id}>
                <ContenidoDePregunta pregunta={{ ...p, queDebeTener: null }} />
                <label className={estilos.campo}>
                  <span className={estilos.etiqueta}>Qué debe tener una buena respuesta</span>
                  <textarea
                    className={estilos.area}
                    rows={2}
                    maxLength={1000}
                    value={queDebeTener[p.id]}
                    onChange={(e) => setQueDebeTener((v) => ({ ...v, [p.id]: e.target.value }))}
                  />
                </label>
              </div>
            ))}
        </section>
      ))}
      {confirmando && (
        <div className={estilos.confirmacion} role="alertdialog" aria-label="Volver a calificar">
          <span>{avisoAntesDeRecalificar(conNota)}</span>
        </div>
      )}
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending}>
          {guardado.isPending ? 'Guardando…' : confirmando ? 'Sí, volver a calificar' : 'Guardar las instrucciones'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
      <Modal abierto={sinSaldo !== null} titulo="La IA no tiene saldo" onCerrar={() => setSinSaldo(null)}>
        {/* El motivo y por qué no se guardó los dice el servidor, como en «Reintentar»
            (QA-PP-09): la frase propia solo sale si su mensaje no lo explica ya. */}
        {sinSaldo !== null && !explicaQueNoSeGuardo(sinSaldo) && (
          <p className={estilos.explica}>
            No se puede recalificar ahora, así que el cambio no se guardó: guardarlo sin
            recalificar dejaría a unos candidatos medidos con una guía y a otros con otra.
          </p>
        )}
        <p className={estilos.explica}>{sinSaldo}</p>
      </Modal>
    </form>
  )
}
