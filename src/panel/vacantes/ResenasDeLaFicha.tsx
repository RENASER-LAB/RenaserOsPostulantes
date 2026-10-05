/**
 * Las reseñas de empresas en la ficha del postulante (V63): dos bloques.
 *
 * - **«La reseña de [Empresa]»**: el de la empresa autora. Sale solo en una
 *   postulación `CONTRATADO` de la propia empresa y con `resenar_contratado`.
 *   Tiene seis estados —aún no toca, se puede escribir, publicada y editable,
 *   publicada y fija, ocultada por la plataforma, y sin permiso (no sale)—.
 * - **«Reseñas de empresas»**: la lectura, para cualquier empresa con
 *   `ver_resenas_candidato`, esté la persona en el estado que esté. Las de todas
 *   las empresas, también la propia, sin «Reportar» ni «Responder».
 *
 * ⚠️ **El panel no sabe sus permisos**: no hay endpoint de «mis permisos». Lo
 * dicen `puedeResenar` y `puedeVerResenas`, que viajan en la respuesta. Sin
 * ninguno de los dos el backend contesta 403, y entonces no se pinta nada.
 *
 * ⚠️ **Las reseñas no puntúan.** Nada de lo que se escribe aquí entra en una
 * nota, en el orden de la tabla ni en el Excel.
 */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import {
  borrarResena,
  editarResena,
  publicarResena,
  reportarRespuesta,
  verResenas,
} from '../api/resenas'
import type {
  LaResenaDeMiEmpresa,
  ResenaVisible,
  ResenasDeLaPostulacion,
  RespuestaParaLaAutora,
} from '../api/tipos'
import { formatearFechaCorta } from '@/dominio/reloj'
import { Modal } from '@/ui/Modal'
import {
  BloqueDeRespuesta,
  CampoContado,
  FormularioDeReporte,
  PreguntaDeDescartar,
  ResumenDeResenas,
  SelectorDeEstrellas,
  TarjetaDeResena,
  VentanaDeResenas,
} from '@/ui/resenas/Resenas'
import { useBorradorDeLaVentana, useFocoPendiente, useUnSoloEnvio } from '@/ui/resenas/ganchos'
import { faltaEnElTexto, type MotivoDeReporte } from '@/ui/resenas/modelo'
import piezas from '@/ui/resenas/Resenas.module.css'
import ficha from './Vacante.module.css'
import estilos from './ResenasDeLaFicha.module.css'

const MIN_OPINION = 30
const MAX_OPINION = 1000
const ID_REPORTE = 'formulario-reporte-de-respuesta'

/*
  Adónde va el foco cuando el botón pulsado desaparece o se deshabilita: los
  controles del bloque llevan `data-foco` y se buscan otra vez tras pintar.
*/
const ENVIAR_REPORTE = `button[type="submit"][form="${ID_REPORTE}"]`
const PUBLICAR = '[data-foco="publicar"]'
const EDITAR = '[data-foco="editar"]'
const BORRAR = '[data-foco="borrar"]'
const CONFIRMAR_BORRAR = '[data-foco="confirmar-borrar"]'
const CANCELAR_BORRAR = '[data-foco="cancelar-borrar"]'
/** La estrella elegida al abrir la edición: el primer control del formulario. */
const ESTRELLA_ELEGIDA = 'input[type="radio"]:checked'

/** Un 403 o un 404 aquí es «no te toca verlo»: no se pinta nada, ni un error. */
const esNoTeToca = (causa: unknown) =>
  causa instanceof ErrorApi && (causa.estado === 403 || causa.estado === 404)

export function ResenasDeLaFicha({ postulacionId }: { postulacionId: number }) {
  const consulta = useQuery({
    queryKey: ['panel-resenas', postulacionId],
    // Sin `retry` propio: el cliente de datos ya no insiste con un 403 o un 404.
    queryFn: () => verResenas(postulacionId),
  })

  if (consulta.isPending) {
    return (
      <div className={`${ficha.banda} ${estilos.bloques}`} aria-busy="true">
        <p className={estilos.cargando}>Cargando las reseñas…</p>
      </div>
    )
  }
  if (consulta.isError && !consulta.data) {
    if (esNoTeToca(consulta.error)) return null
    return (
      <div className={`${ficha.banda} ${estilos.bloques}`}>
        <div className={estilos.falloDeCarga} role="alert">
          <p>No pudimos cargar las reseñas.</p>
          <button type="button" className={estilos.secundario} onClick={() => void consulta.refetch()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const datos = consulta.data
  if (!datos.miResena && !datos.puedeVerResenas) return null

  return (
    <div className={`${ficha.banda} ${estilos.bloques}`}>
      {datos.miResena && (
        <LaResenaDeMiEmpresaBloque
          postulacionId={postulacionId}
          bloque={datos.miResena}
          persona={datos.persona}
        />
      )}
      {datos.puedeVerResenas && <LecturaDeResenas datos={datos} />}
    </div>
  )
}

// ---------- El bloque de la empresa autora ----------

function LaResenaDeMiEmpresaBloque({
  postulacionId,
  bloque,
  persona,
}: {
  postulacionId: number
  bloque: LaResenaDeMiEmpresa
  persona: string
}) {
  const cache = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [reportando, setReportando] = useState(false)
  const [falloDelReporte, setFalloDelReporte] = useState<string | null>(null)
  const bloqueRef = useRef<HTMLElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)

  /*
    Todo lo que escribe refresca las dos cosas que lo enseñan: este bloque —que
    puede haber cambiado de estado— y la tabla, cuyo promedio lo lee.
  */
  const refrescar = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ['panel-resenas', postulacionId] }),
      cache.invalidateQueries({ queryKey: ['panel-ranking'] }),
    ])

  /*
    Un 409 trae su porqué escrito —ya hay una, ya no se puede cambiar— y es
    justo el caso en que lo que se ve está viejo: se enseña el texto del
    servidor y se refresca el bloque, que pasa a decir lo que hay.
  */
  /*
    Con un 409 o un 404 lo que se estaba haciendo ya no existe y el foco va al
    título; con otro fallo el formulario sigue, y vuelve al botón que se pulsó
    en cuanto se habilita.
  */
  const alFallar = (reintento: string) => async (causa: unknown) => {
    setFallo(causa instanceof Error ? causa.message : 'No pudimos guardarlo.')
    if (causa instanceof ErrorApi && (causa.estado === 409 || causa.estado === 404)) {
      setEditando(false)
      setConfirmandoBorrar(false)
      await refrescar()
      pedirFoco([titulo])
      return
    }
    pedirFoco([reintento, titulo])
  }

  const publicacion = useMutation({
    mutationFn: (v: { estrellas: number; texto: string }) =>
      bloque.resena ? editarResena(postulacionId, v) : publicarResena(postulacionId, v),
    onSuccess: async () => {
      setFallo(null)
      setEditando(false)
      await refrescar()
      // El formulario deja paso a la reseña publicada: el foco, al título.
      pedirFoco([titulo])
    },
    onError: alFallar(PUBLICAR),
  })

  const baja = useMutation({
    mutationFn: () => borrarResena(postulacionId),
    onSuccess: async () => {
      setFallo(null)
      setConfirmandoBorrar(false)
      await refrescar()
      pedirFoco([titulo])
    },
    onError: alFallar(CONFIRMAR_BORRAR),
  })

  const reporte = useMutation({
    mutationFn: (v: { motivo: MotivoDeReporte; comentario: string | null }) =>
      reportarRespuesta(postulacionId, v),
    onSuccess: async () => {
      setReportando(false)
      borrador.olvidar()
      setFalloDelReporte(null)
      // «Reportar la respuesta», que abrió la ventana, ya no existe: sin esto el
      // foco caería en <body> al cerrarse. Va al título del bloque.
      pedirFoco([titulo])
      await refrescar()
    },
    onError: async (causa) => {
      setFalloDelReporte(
        causa instanceof ErrorApi && causa.estado === 404
          ? 'Esta respuesta ya no está disponible.'
          : causa instanceof Error
            ? causa.message
            : 'No pudimos enviar el reporte.',
      )
      if (causa instanceof ErrorApi && (causa.estado === 404 || causa.estado === 409)) {
        await refrescar()
      }
      pedirFoco([ENVIAR_REPORTE, titulo])
    },
  })

  // Un solo envío por clic, aunque sea doble: ver `useUnSoloEnvio`.
  const envioDeLaResena = useUnSoloEnvio()
  const envioDeLaBaja = useUnSoloEnvio()
  const envioDelReporte = useUnSoloEnvio()
  const publicando = publicacion.isPending || envioDeLaResena.ocupado
  const borrandoAhora = baja.isPending || envioDeLaBaja.ocupado
  const enviandoReporte = reporte.isPending || envioDelReporte.ocupado
  /*
    Con algo en «Cuéntanos más», cerrar «Reportar la respuesta» pregunta antes
    de tirarlo, como en el perfil. Sin texto, o mientras se envía, cierra como
    siempre y el `Modal` devuelve el foco a «Reportar la respuesta».
  */
  const borrador = useBorradorDeLaVentana(enviandoReporte)
  const cerrarElReporte = () => {
    setReportando(false)
    borrador.olvidar()
  }

  const pedirFoco = useFocoPendiente({
    zona: () => bloqueRef.current,
    respaldo: () => titulo.current,
    ocupado: publicando || borrandoAhora || enviandoReporte,
  })

  const resena = bloque.resena
  const escribiendo = bloque.estado === 'SE_PUEDE_ESCRIBIR' || (bloque.estado === 'EDITABLE' && editando)

  return (
    <section className={estilos.bloque} aria-labelledby={`mi-resena-${postulacionId}`} ref={bloqueRef}>
      <h3 className={ficha.tituloDetalle} id={`mi-resena-${postulacionId}`} ref={titulo} tabIndex={-1}>
        La reseña de {bloque.empresa}
      </h3>
      <p className={ficha.dato}>
        Contratado el {formatearFechaCorta(bloque.contratadoEn)}
        {bloque.puesto && ` como ${bloque.puesto}`}
      </p>

      {bloque.estado === 'AUN_NO_TOCA' && (
        <p className={estilos.espera}>
          Podrás dejar una reseña desde el {formatearFechaCorta(bloque.abreEn)}, al cumplir un
          mes de su contratación.
        </p>
      )}

      {escribiendo && (
        <FormularioDeResena
          inicial={resena && editando ? { estrellas: resena.estrellas, texto: resena.texto } : null}
          personaYaRespondio={editando && resena?.respuesta ? persona : null}
          enviando={publicando}
          alEnviar={(v) => envioDeLaResena.enviar(() => publicacion.mutateAsync(v))}
          alCancelar={
            editando
              ? () => {
                  setEditando(false)
                  setFallo(null)
                  pedirFoco([EDITAR, titulo])
                }
              : undefined
          }
        />
      )}

      {resena && !escribiendo && (
        <div className={bloque.estado === 'OCULTADA' ? estilos.ocultada : undefined}>
          <TarjetaDeResena
            resena={{
              id: resena.id,
              estrellas: resena.estrellas,
              empresa: bloque.empresa,
              puesto: bloque.puesto,
              texto: resena.texto,
              publicadaEn: resena.publicadaEn,
              editada: resena.editada,
            }}
            respuesta={
              resena.respuesta && (
                <RespuestaVistaPorLaAutora
                  persona={persona}
                  respuesta={resena.respuesta}
                  alReportar={() => {
                    setFalloDelReporte(null)
                    borrador.olvidar()
                    setReportando(true)
                  }}
                />
              )
            }
          />
          {bloque.estado === 'OCULTADA' && (
            <p className={estilos.notaPlataforma}>
              La plataforma la ocultó: {resena.notaOcultacion}
            </p>
          )}
          {bloque.estado === 'FIJA' && <p className={estilos.detalle}>Ya no se puede cambiar.</p>}
          {bloque.estado === 'EDITABLE' && (
            <div className={estilos.accionesMias}>
              <span className={estilos.detalle}>
                Puedes cambiarla hasta el {formatearFechaCorta(resena.editableHasta)}.
              </span>
              {confirmandoBorrar ? (
                <span className={estilos.confirmar} role="group" aria-label="Borrar la reseña">
                  <span>¿Borrarla? La respuesta de {persona}, si la hay, se borra con ella.</span>
                  <button
                    type="button"
                    className={estilos.peligroso}
                    data-foco="confirmar-borrar"
                    disabled={borrandoAhora}
                    onClick={() => envioDeLaBaja.enviar(() => baja.mutateAsync())}
                  >
                    {borrandoAhora ? 'Borrando…' : 'Borrar'}
                  </button>
                  <button
                    type="button"
                    className={piezas.enlaceDiscreto}
                    data-foco="cancelar-borrar"
                    disabled={borrandoAhora}
                    onClick={() => {
                      setConfirmandoBorrar(false)
                      pedirFoco([BORRAR, titulo])
                    }}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <span className={estilos.botones}>
                  <button
                    type="button"
                    className={estilos.secundario}
                    data-foco="editar"
                    onClick={() => {
                      setFallo(null)
                      setEditando(true)
                      // El formulario sustituye a la reseña: el foco, a su primer control.
                      pedirFoco([ESTRELLA_ELEGIDA, titulo])
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={estilos.secundario}
                    data-foco="borrar"
                    onClick={() => {
                      setFallo(null)
                      setConfirmandoBorrar(true)
                      // La confirmación sustituye a «Borrar»: el foco, a su «Cancelar».
                      pedirFoco([CANCELAR_BORRAR])
                    }}
                  >
                    Borrar
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {fallo && (
        <p className={estilos.fallo} role="alert">
          {fallo}
        </p>
      )}

      {resena?.respuesta && (
        <Modal
          abierto={reportando}
          titulo="Reportar la respuesta"
          onCerrar={(como) => borrador.intentar(como, cerrarElReporte)}
          pantallaCompleta
          pie={
            borrador.preguntando ? (
              <PreguntaDeDescartar
                alSeguir={borrador.seguir}
                alDescartar={() => borrador.descartar(cerrarElReporte)}
              />
            ) : (
              <>
                <button
                  type="button"
                  className={estilos.secundario}
                  onClick={() => borrador.intentar('volver', cerrarElReporte)}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  form={ID_REPORTE}
                  className={estilos.acento}
                  disabled={enviandoReporte}
                >
                  {enviandoReporte ? 'Enviando…' : 'Enviar reporte'}
                </button>
              </>
            )
          }
        >
          <FormularioDeReporte
            id={ID_REPORTE}
            quien="empresa"
            contexto={
              <>
                <p className={estilos.contextoTitulo}>
                  <b>Respuesta de {persona}</b>
                </p>
                <p className={estilos.contextoTexto}>{resena.respuesta.texto}</p>
              </>
            }
            aviso="La respuesta sigue visible mientras la revisamos."
            enviando={enviandoReporte}
            fallo={falloDelReporte}
            alEnviar={(motivo, comentario) =>
              envioDelReporte.enviar(() => reporte.mutateAsync({ motivo, comentario }))
            }
            alCambiarBorrador={borrador.avisar}
          />
        </Modal>
      )}
    </section>
  )
}

/**
 * La respuesta de la persona tal como la ve la empresa autora: con el estado de
 * su reporte y, si se puede, «Reportar la respuesta».
 */
function RespuestaVistaPorLaAutora({
  persona,
  respuesta,
  alReportar,
}: {
  persona: string
  respuesta: RespuestaParaLaAutora
  alReportar: () => void
}) {
  const detalle =
    respuesta.reporte === 'EN_REVISION'
      ? 'Reportada · en revisión'
      : respuesta.reporte === 'MANTENIDA'
        ? `La plataforma la mantuvo: ${respuesta.notaReporte ?? ''}`
        : null
  return (
    <BloqueDeRespuesta
      titulo={`Respuesta de ${persona}`}
      texto={respuesta.texto}
      publicadaEn={respuesta.publicadaEn}
      editada={respuesta.editada}
      ocultadaNota={respuesta.ocultada ? `La plataforma la ocultó: ${respuesta.notaReporte ?? ''}` : null}
      detalle={detalle}
      acciones={
        respuesta.puedeReportar && (
          <button type="button" className={piezas.enlaceDiscreto} onClick={alReportar}>
            Reportar la respuesta
          </button>
        )
      }
    />
  )
}

/**
 * Publicar o editar: estrellas, opinión con su cuenta y el aviso de quién la
 * verá. Si falta algo se dice junto al campo y no se envía nada; el backend
 * aplica las mismas reglas.
 */
function FormularioDeResena({
  inicial,
  personaYaRespondio,
  enviando,
  alEnviar,
  alCancelar,
}: {
  inicial: { estrellas: number; texto: string } | null
  /** Con nombre si editando una reseña ya respondida: hay que avisar antes de guardar. */
  personaYaRespondio: string | null
  enviando: boolean
  alEnviar: (v: { estrellas: number; texto: string }) => void
  alCancelar?: () => void
}) {
  const [estrellas, setEstrellas] = useState<number | null>(inicial?.estrellas ?? null)
  const [texto, setTexto] = useState(inicial?.texto ?? '')
  const [errores, setErrores] = useState<{ estrellas?: string; texto?: string }>({})
  const campo = useRef<HTMLTextAreaElement>(null)
  const primeraEstrella = useRef<HTMLDivElement>(null)

  return (
    <form
      className={estilos.formulario}
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault()
        const siguientes = {
          estrellas: estrellas === null ? 'Elige cuántas estrellas le das, de 1 a 5.' : undefined,
          texto: faltaEnElTexto(texto, MIN_OPINION, MAX_OPINION, 'La opinión') ?? undefined,
        }
        setErrores(siguientes)
        if (siguientes.estrellas) {
          primeraEstrella.current?.querySelector<HTMLInputElement>('input')?.focus()
          return
        }
        if (siguientes.texto) {
          campo.current?.focus()
          return
        }
        alEnviar({ estrellas: estrellas!, texto: texto.trim() })
      }}
    >
      <div ref={primeraEstrella}>
        <SelectorDeEstrellas
          valor={estrellas}
          alCambiar={(n) => {
            setEstrellas(n)
            setErrores((e) => ({ ...e, estrellas: undefined }))
          }}
          error={errores.estrellas}
          deshabilitado={enviando}
        />
      </div>
      <CampoContado
        etiqueta="Opinión"
        valor={texto}
        alCambiar={setTexto}
        minimo={MIN_OPINION}
        maximo={MAX_OPINION}
        error={errores.texto}
        filas={5}
        deshabilitado={enviando}
        referencia={campo}
      />
      {personaYaRespondio && (
        <p className={estilos.yaRespondio} role="note">
          {personaYaRespondio} ya respondió a esta reseña. Si la cambias, le avisaremos para que
          pueda revisar su respuesta.
        </p>
      )}
      <p className={estilos.aviso}>
        La verán la persona, que podrá responderla, y las demás empresas donde postule. Podrás
        editarla o borrarla durante 30 días.
      </p>
      <div className={estilos.botonesFormulario}>
        {alCancelar && (
          <button type="button" className={estilos.secundario} onClick={alCancelar} disabled={enviando}>
            Cancelar
          </button>
        )}
        <button type="submit" className={estilos.acento} data-foco="publicar" disabled={enviando}>
          {enviando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  )
}

// ---------- La lectura, para cualquier empresa ----------

/**
 * «Reseñas de empresas»: el resumen, las dos más recientes y «Ver todas», con
 * la misma ventana y los mismos filtros que la persona ve en su perfil, pero
 * sin «Reportar» ni «Responder».
 */
function LecturaDeResenas({ datos }: { datos: ResenasDeLaPostulacion }) {
  const [abierta, setAbierta] = useState(false)
  const resenas = datos.resenas ?? []
  const resumen = datos.resumen ?? { promedio: null, cantidad: 0, reparto: [] }

  const pintar = (r: ResenaVisible, completa: boolean) => (
    <TarjetaDeResena
      key={r.id}
      resena={r}
      completa={completa}
      respuesta={
        r.respuesta && (
          <BloqueDeRespuesta
            titulo={`Respuesta de ${datos.persona}`}
            texto={r.respuesta.texto}
            publicadaEn={r.respuesta.publicadaEn}
            editada={r.respuesta.editada}
            completa={completa}
          />
        )
      }
    />
  )

  return (
    <section className={estilos.bloque} aria-label="Reseñas de empresas">
      <h3 className={ficha.tituloDetalle}>Reseñas de empresas</h3>
      {resenas.length === 0 ? (
        <p className={estilos.espera}>Sin reseñas de empresas.</p>
      ) : (
        <>
          <ResumenDeResenas resumen={resumen} />
          <div className={estilos.recientes}>{resenas.slice(0, 2).map((r) => pintar(r, false))}</div>
          {resenas.length > 2 && (
            <button type="button" className={estilos.secundario} onClick={() => setAbierta(true)}>
              Ver todas las reseñas ({resenas.length})
            </button>
          )}
          <VentanaDeResenas
            abierto={abierta}
            onCerrar={() => setAbierta(false)}
            resumen={resumen}
            resenas={resenas}
            pintar={(r) => pintar(r, true)}
          />
        </>
      )}
    </section>
  )
}

