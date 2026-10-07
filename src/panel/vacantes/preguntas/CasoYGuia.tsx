/**
 * El escenario de la prueba y la guía para la IA (V68).
 *
 *   - **El escenario o caso práctico** es opcional, haya o no entregables, y sale
 *     plegado. Abierto: el enunciado (hasta 10000 caracteres) y el PDF o Word.
 *     «Quitar el caso» con algo escrito pide confirmación y solo borra eso: las
 *     preguntas y los entregables se quedan. Un caso abierto y vacío no se guarda.
 *   - **La guía de calificación para la IA** se queda en la página, bajo los
 *     criterios: vale para todo lo que califica la IA en esta prueba.
 *
 * ⚠️ `PUT /borrador` guarda el caso, el tiempo, los materiales y la guía de una
 * vez: cada sección manda lo suyo y lo guardado de las demás
 * (`datosDeLaPrueba`), así que lo que se escribe en una no pisa a otra.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { EditorDePreguntas as Editor, VersionDePreguntas } from '../../api/preguntasPropias'
import { descargarConsigna, guardarDatosDeLaPrueba, quitarConsigna, subirConsigna } from '../../api/pruebaPropia'
import { IconoMas } from '@/ui/Iconos'
import { datosDeLaPrueba } from './ConfiguracionDeLaPrueba'
import { falloDe, type Fallo } from './consultas'
import { MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

const ACEPTA = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const AL_QUITAR_EL_CASO =
  'Se borran el enunciado y el PDF. Las preguntas y los entregables se quedan como están.'

export function EscenarioDeLaPrueba({
  vacanteId,
  version,
  editable,
  alGuardar,
}: {
  vacanteId: number
  version: VersionDePreguntas | null
  editable: boolean
  alGuardar: (e: Editor) => void
}) {
  const prueba = version?.prueba ?? null
  const guardado = prueba?.enunciado ?? ''
  const consigna = prueba?.consigna ?? null
  const hayCaso = guardado.trim() !== '' || consigna !== null
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(guardado)
  const [quitando, setQuitando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  // Lo que se ve es lo guardado: si otra cosa trae otro caso (copiar encima), se pone al día.
  const [firmaVista, setFirmaVista] = useState(guardado)
  if (firmaVista !== guardado) {
    setFirmaVista(guardado)
    setTexto(guardado)
  }

  const alTerminar = (e: Editor) => {
    setFallo(null)
    alGuardar(e)
  }
  const guardar = useMutation({
    mutationFn: () => guardarDatosDeLaPrueba(vacanteId, datosDeLaPrueba(version, { enunciado: texto.trim() || null })),
    onSuccess: alTerminar,
    onError: (c) => setFallo(falloDe(c, 'No se pudo guardar el caso.')),
  })
  const adjunto = useMutation({
    mutationFn: (archivo: File) => subirConsigna(vacanteId, archivo),
    onSuccess: alTerminar,
    onError: (c) => setFallo(falloDe(c, 'No se pudo subir el enunciado.')),
  })
  const sinAdjunto = useMutation({
    mutationFn: () => quitarConsigna(vacanteId),
    onSuccess: alTerminar,
    onError: (c) => setFallo(falloDe(c, 'No se pudo quitar el enunciado.')),
  })
  const quitar = useMutation({
    mutationFn: async () => {
      let ultimo: Editor | null = null
      if (guardado.trim() !== '') {
        ultimo = await guardarDatosDeLaPrueba(vacanteId, datosDeLaPrueba(version, { enunciado: null }))
      }
      if (consigna !== null) ultimo = await quitarConsigna(vacanteId)
      return ultimo
    },
    onSuccess: (e) => {
      setQuitando(false)
      setAbierto(false)
      setTexto('')
      if (e) alTerminar(e)
    },
    onError: (c) => setFallo(falloDe(c, 'No se pudo quitar el caso.')),
  })

  const abrirAdjunto = async () => {
    if (!consigna) return
    const archivo = await descargarConsigna(consigna.archivoId).catch(() => null)
    if (!archivo) {
      setFallo(falloDe(new Error('No se pudo abrir el enunciado adjunto.'), ''))
      return
    }
    const url = URL.createObjectURL(archivo.contenido)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const pulsarQuitar = () => {
    if (hayCaso || texto.trim() !== '') setQuitando(true)
    else {
      setAbierto(false)
      setTexto('')
    }
  }

  return (
    <section
      className={`${estilos.seccionPrueba} ${estilos.destino}`}
      aria-labelledby="titulo-escenario"
      id="escenario"
      tabIndex={-1}
    >
      <div className={estilos.cabeceraSeccion}>
        <h2 className={estilos.subtitulo} id="titulo-escenario">
          Escenario o caso práctico <span className={estilos.cuenta}>(opcional)</span>
        </h2>
        {abierto ? (
          <button className={estilos.enlacePlegar} type="button" aria-expanded onClick={() => setAbierto(false)}>
            Plegar
          </button>
        ) : hayCaso ? (
          <button className={estilos.enlacePlegar} type="button" aria-expanded={false} onClick={() => setAbierto(true)}>
            Ver el caso
          </button>
        ) : (
          editable && (
            <button className={estilos.secundarioPequeno} type="button" onClick={() => setAbierto(true)}>
              <IconoMas tamano={18} />
              Agregar un caso
            </button>
          )
        )}
      </div>

      {!abierto && hayCaso && (
        <p className={estilos.queEvalua}>
          {guardado.trim() !== '' ? recortar(guardado, 160) : 'Sin enunciado escrito.'}
          {consigna ? ` · Adjunto: ${consigna.nombre ?? 'el enunciado en PDF o Word'}` : ''}
        </p>
      )}

      {abierto && (
        <>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>
              Enunciado <span className={estilos.cuenta}>({texto.length} de 10000)</span>
            </span>
            <textarea
              className={estilos.area}
              rows={6}
              maxLength={10000}
              placeholder="La situación que tiene que resolver: qué pasó, con qué cifras y qué se le pide."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              readOnly={!editable}
            />
          </label>
          <div className={estilos.adjunto}>
            <span className={estilos.etiqueta}>Enunciado en PDF o Word</span>
            {consigna ? (
              <span className={estilos.filaAdjunto}>
                <button className={estilos.enlaceBoton} type="button" onClick={() => void abrirAdjunto()}>
                  {consigna.nombre ?? 'El enunciado adjunto'}
                </button>
                {editable && (
                  <button
                    className={estilos.secundarioPequeno}
                    type="button"
                    onClick={() => sinAdjunto.mutate()}
                    disabled={sinAdjunto.isPending}
                  >
                    Quitar
                  </button>
                )}
              </span>
            ) : (
              editable && (
                <label className={estilos.secundarioPequeno}>
                  {adjunto.isPending ? 'Subiendo…' : 'Subir PDF o Word'}
                  <input
                    className={estilos.soloLectores}
                    type="file"
                    accept={ACEPTA}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0]
                      if (archivo) adjunto.mutate(archivo)
                      e.target.value = ''
                    }}
                  />
                </label>
              )
            )}
            <span className={estilos.ayuda}>Opcional: como la consigna de las pruebas de antes.</span>
          </div>
          {editable && (
            <div className={estilos.acciones}>
              {texto !== guardado && (
                <button className={estilos.guardar} type="button" onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                  {guardar.isPending ? 'Guardando…' : 'Guardar el caso'}
                </button>
              )}
              <button className={estilos.secundario} type="button" onClick={pulsarQuitar} disabled={quitar.isPending}>
                Quitar el caso
              </button>
            </div>
          )}
          {quitando && (
            <div className={estilos.confirmacion} role="alertdialog" aria-label="Quitar el caso">
              <span>{AL_QUITAR_EL_CASO}</span>
              <button className={estilos.peligroso} type="button" onClick={() => quitar.mutate()} disabled={quitar.isPending}>
                Quitar el caso
              </button>
              <button className={estilos.secundario} type="button" onClick={() => setQuitando(false)}>
                Cancelar
              </button>
            </div>
          )}
        </>
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}

const recortar = (texto: string, largo: number) =>
  texto.length <= largo ? texto : `${texto.slice(0, largo - 1).trimEnd()}…`

export const LO_QUE_TOCA_LA_GUIA =
  'Vale para todo lo que califica la IA en esta prueba: las abiertas y los entregables de los criterios de IA. No toca las cerradas ni los criterios que califica una persona.'

export function GuiaParaLaIa({
  vacanteId,
  version,
  editable,
  alGuardar,
}: {
  vacanteId: number
  version: VersionDePreguntas | null
  editable: boolean
  alGuardar: (e: Editor) => void
}) {
  const guardada = version?.guiaCalificacion ?? ''
  const [guia, setGuia] = useState(guardada)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const [firmaVista, setFirmaVista] = useState(guardada)
  if (firmaVista !== guardada) {
    setFirmaVista(guardada)
    setGuia(guardada)
  }
  const guardado = useMutation({
    mutationFn: () => guardarDatosDeLaPrueba(vacanteId, datosDeLaPrueba(version, { guiaCalificacion: guia.trim() || null })),
    onSuccess: (e) => {
      setFallo(null)
      alGuardar(e)
    },
    onError: (c) => setFallo(falloDe(c, 'No se pudo guardar la guía.')),
  })
  return (
    <section className={estilos.seccionPrueba} aria-labelledby="titulo-guia-ia">
      <h2 className={estilos.subtitulo} id="titulo-guia-ia">
        Guía de calificación para la IA{' '}
        <span className={estilos.cuenta}>(opcional · {guia.length} de 2000)</span>
      </h2>
      <p className={estilos.explica} id="explica-guia-ia">
        {LO_QUE_TOCA_LA_GUIA}
      </p>
        <textarea
          aria-labelledby="titulo-guia-ia"
          aria-describedby="explica-guia-ia"
          className={estilos.area}
          rows={3}
          maxLength={2000}
          placeholder="Qué distingue una buena entrega en este puesto…"
          value={guia}
          onChange={(e) => setGuia(e.target.value)}
          readOnly={!editable}
        />
      {editable && guia !== guardada && (
        <div className={estilos.acciones}>
          <button className={estilos.guardar} type="button" onClick={() => guardado.mutate()} disabled={guardado.isPending}>
            {guardado.isPending ? 'Guardando…' : 'Guardar la guía'}
          </button>
        </div>
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}
