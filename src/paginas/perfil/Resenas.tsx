/**
 * «Reseñas de empresas», al final de «Mi perfil» (V63).
 *
 * Lo que opinan de la persona las empresas que la contrataron por EX. No puede
 * aceptarlas ni rechazarlas, pero sí **responder** a cada una —su versión sale
 * debajo, en todos los sitios donde sale la reseña— y **reportar** la que
 * incumpla las normas.
 *
 * ⚠️ **Una sola ventana.** «Ver todas», «Reportar» y «Responder» son pasos de la
 * MISMA ventana: el `Modal` lleva un `id` fijo en su título y no admite dos. Si
 * se reporta o se responde desde la sección, la ventana se abre directamente en
 * ese paso; «Volver» la cierra, porque no hay lista a la que volver.
 *
 * ⚠️ **Lo escrito no se tira sin preguntar.** Con texto sin enviar en
 * «Responder» o en «Cuéntanos más», cerrar el paso —«Volver», Escape, el aspa o
 * el fondo— cambia el pie a «¿Descartar lo que escribiste?». Ver
 * `useBorradorDeLaVentana`.
 *
 * ⚠️ **La sección y su entrada en el índice salen siempre**, también sin
 * reseñas: quien nunca tuvo una tiene que saber que existe y cómo llega.
 *
 * El fallo de esta sección no tumba el perfil: son dos consultas, y si esta
 * falla se dice aquí, con «Reintentar», y el resto sigue funcionando.
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  borrarRespuesta,
  editarRespuesta,
  misResenas,
  reportarResena,
  responderResena,
} from '@/api/resenas'
import { ErrorApi } from '@/api/cliente'
import type { MisResenas, ResenaMia } from '@/api/tipos'
import { formatearFechaCorta } from '@/dominio/reloj'
import {
  BloqueDeRespuesta,
  CampoContado,
  Estrellas,
  FormularioDeReporte,
  PreguntaDeDescartar,
  ResumenDeResenas,
  TarjetaDeResena,
  VentanaDeResenas,
  type PasoDeLaVentana,
} from '@/ui/resenas/Resenas'
import {
  useAvisoDeBorrador,
  useBorradorDeLaVentana,
  useFocoPendiente,
  useUnSoloEnvio,
  type CierreDelPaso,
} from '@/ui/resenas/ganchos'
import { faltaEnElTexto, type MotivoDeReporte } from '@/ui/resenas/modelo'
import piezasResenas from '@/ui/resenas/Resenas.module.css'
import estilos from './Perfil.module.css'
import propios from './Resenas.module.css'

/** El ancla del perfil a la que llevan la cabecera, el índice y la campana. */
export const ANCLA_RESENAS = 'resenas'

const MIN_RESPUESTA = 30
const MAX_RESPUESTA = 500
const ID_FORMULARIO = 'formulario-del-paso-de-resenas'

type Ventana =
  | { vista: 'lista' }
  | { vista: 'reportar'; id: number; desde: 'lista' | 'seccion' }
  | { vista: 'responder'; id: number; desde: 'lista' | 'seccion'; editando: boolean }

type Paso = Exclude<Ventana, { vista: 'lista' }>

/*
  Los botones de cada tarjeta llevan `data-foco="accion-id"`: es como se
  encuentran otra vez después de pintar, porque la ventana y la sección los
  crean de nuevo cada vez que cambian de contenido.
*/
type Accion = 'responder' | 'reportar' | 'editar' | 'borrar' | 'cancelar' | 'confirmar'
const boton = (accion: Accion, id: number) => `[data-foco="${accion}-${id}"]`
/** La fila de la ventana (`VentanaDeResenas`). En la sección no hay filas. */
const fila = (id: number) => `[data-resena="${id}"]`
const ENVIAR_EL_PASO = `button[type="submit"][form="${ID_FORMULARIO}"]`
const VOLVER_DEL_PASO = '[data-foco="volver"]'

/** El botón que abrió el paso: «Reportar», «Responder» o «Editar». */
const accionDelPaso = (paso: Paso): Accion =>
  paso.vista === 'reportar' ? 'reportar' : paso.editando ? 'editar' : 'responder'

/** Las ventanas del portal van dentro de la página: se buscan por su papel. */
const ventanaAbierta = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')

/**
 * Qué decir cuando el servidor dice que no.
 *
 * El 404 es «ya no está»: la empresa la borró o la plataforma la ocultó
 * mientras escribías. El 409 trae su porqué escrito —«Ya no se puede cambiar»,
 * «Ya la reportaste»— y se enseña tal cual. En los dos casos la sección se
 * refresca, para que lo que se ve cuadre con lo que hay.
 */
function queDecir(causa: unknown): { mensaje: string; refrescar: boolean } {
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return { mensaje: 'Esta reseña ya no está disponible.', refrescar: true }
  }
  if (causa instanceof ErrorApi && causa.estado === 409) {
    return { mensaje: causa.message, refrescar: true }
  }
  return {
    mensaje: causa instanceof Error ? causa.message : 'No pudimos guardarlo. Inténtalo de nuevo.',
    refrescar: false,
  }
}

export function ResenasDelPerfil() {
  const cache = useQueryClient()
  const consulta = useQuery({ queryKey: ['mis-resenas'], queryFn: misResenas })
  const [ventana, setVentana] = useState<Ventana | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<number | null>(null)
  const [falloDeBorrar, setFalloDeBorrar] = useState<string | null>(null)
  const seccion = useRef<HTMLElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const { hash } = useLocation()
  // La ventana de este pintado, para lo que termina después de un `await`: si
  // mientras tanto se cerró con Escape, no se vuelve a abrir.
  const ventanaActual = useRef(ventana)
  ventanaActual.current = ventana

  /*
    Llegar desde la campana o desde la cabecera a `/perfil#resenas`: el ancla la
    resuelve el armazón al navegar, pero en ese momento el perfil todavía se
    está cargando y esta sección no existe. Se baja aquí, al montarse.
  */
  useEffect(() => {
    if (hash === `#${ANCLA_RESENAS}`) {
      seccion.current?.scrollIntoView({ block: 'start' })
    }
    // Solo al montarse: una navegación posterior al mismo ancla la resuelve el armazón.
  }, [])

  const refrescar = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ['mis-resenas'] }),
      // La cabecera lleva el promedio en el GET del perfil.
      cache.invalidateQueries({ queryKey: ['perfil'] }),
    ])

  /**
   * Cierra la ventana o vuelve a la lista, según de dónde se abrió el paso, y
   * devuelve el foco al botón que lo abrió. Si ya no está —tras reportar o
   * responder desaparece—, a la fila de la ventana; en la sección, al título.
   */
  const terminarPaso = (paso: Paso) => {
    setFallo(null)
    borrador.olvidar()
    setVentana(paso.desde === 'lista' ? { vista: 'lista' } : null)
    pedirFoco([boton(accionDelPaso(paso), paso.id), fila(paso.id)])
  }

  /*
    Al terminar bien, primero se refresca y DESPUÉS se cierra el paso: así la
    lista a la que se vuelve ya no tiene el botón que se acaba de gastar, y el
    foco no se posa en él para perderse medio segundo después.
  */
  const alTerminarBien = async (id: number) => {
    await refrescar()
    const actual = ventanaActual.current
    if (actual && actual.vista !== 'lista' && actual.id === id) terminarPaso(actual)
  }

  /** Si falla, el paso sigue: el foco vuelve a «Enviar» en cuanto se habilita. */
  const alFallarElPaso = async (causa: unknown) => {
    const { mensaje, refrescar: hayQue } = queDecir(causa)
    setFallo(mensaje)
    if (hayQue) await refrescar()
    pedirFoco([ENVIAR_EL_PASO, VOLVER_DEL_PASO])
  }

  const reporte = useMutation({
    mutationFn: (v: { id: number; motivo: MotivoDeReporte; comentario: string | null }) =>
      reportarResena(v.id, { motivo: v.motivo, comentario: v.comentario }),
    onSuccess: (_, v) => alTerminarBien(v.id),
    onError: alFallarElPaso,
  })

  const respuesta = useMutation({
    mutationFn: (v: { id: number; texto: string; editando: boolean }) =>
      v.editando ? editarRespuesta(v.id, v.texto) : responderResena(v.id, v.texto),
    onSuccess: (_, v) => alTerminarBien(v.id),
    onError: alFallarElPaso,
  })

  const baja = useMutation({
    mutationFn: (id: number) => borrarRespuesta(id),
    onSuccess: async (_, id) => {
      await refrescar()
      setBorrando(null)
      setFalloDeBorrar(null)
      // Sin respuesta vuelve «Responder»: ahí va el foco.
      pedirFoco([boton('responder', id), fila(id)])
    },
    onError: async (causa, id) => {
      const { mensaje, refrescar: hayQue } = queDecir(causa)
      setFalloDeBorrar(mensaje)
      if (hayQue) await refrescar()
      pedirFoco([boton('confirmar', id), boton('responder', id), fila(id)])
    },
  })

  // Un solo envío por clic, aunque sea doble: ver `useUnSoloEnvio`.
  const envioDelReporte = useUnSoloEnvio()
  const envioDeLaRespuesta = useUnSoloEnvio()
  const envioDeLaBaja = useUnSoloEnvio()
  const reportando = reporte.isPending || envioDelReporte.ocupado
  const respondiendo = respuesta.isPending || envioDeLaRespuesta.ocupado
  const borrandoAhora = baja.isPending || envioDeLaBaja.ocupado
  // Mientras se envía no se pregunta: la ventana se cierra como siempre.
  const borrador = useBorradorDeLaVentana(reportando || respondiendo)

  /*
    ⚠️ **El foco no se pierde.** Volver de un paso, terminarlo, abrir o cerrar
    la confirmación de borrar: el botón pulsado deja de existir, o se
    deshabilita mientras trabaja, y el foco caería en `<body>` —con la ventana
    abierta, Tab recorrería la página de detrás—. Se pide adónde llevarlo, del
    mejor destino al peor, y se busca dentro de la ventana si está abierta y en
    la sección si no. Sin ninguno: el aspa de la ventana, o el título.
  */
  const pedirFoco = useFocoPendiente({
    zona: () => ventanaAbierta() ?? seccion.current,
    respaldo: () => ventanaAbierta()?.querySelector<HTMLElement>('button') ?? titulo.current,
    // Mientras algo trabaja, su botón está deshabilitado: se espera a que vuelva.
    ocupado: reportando || respondiendo || borrandoAhora,
  })

  const abrirPaso = (siguiente: Paso) => {
    setFallo(null)
    borrador.olvidar()
    setVentana(siguiente)
  }

  const cerrarVentana = () => {
    setVentana(null)
    setFallo(null)
    borrador.olvidar()
  }

  /*
    Lo que hace cada cierre de un paso, sin borrador o tras «Descartar»: «Volver»
    vuelve a la lista o cierra, según de dónde se abrió (`terminarPaso`); Escape,
    el aspa y el fondo cierran la ventana entera, y el `Modal` devuelve el foco.
  */
  const cerrarPaso = (paso: Paso) => (como: CierreDelPaso) =>
    como === 'volver' ? terminarPaso(paso) : cerrarVentana()

  const abrirBorrar = (id: number) => {
    setFalloDeBorrar(null)
    setBorrando(id)
    // La confirmación sustituye a «Borrar»: el foco, a su «Cancelar».
    pedirFoco([boton('cancelar', id)])
  }

  const cancelarBorrar = (id: number) => {
    setBorrando(null)
    setFalloDeBorrar(null)
    pedirFoco([boton('borrar', id), fila(id)])
  }

  /** Lo que cuelga de cada reseña: su respuesta y los dos botones discretos. */
  const pintar = (r: ResenaMia, desde: 'lista' | 'seccion') => (
    <TarjetaDeResena
      key={r.id}
      resena={r}
      completa={desde === 'lista'}
      marca={r.reportadaEnRevision ? 'Reportada · en revisión' : undefined}
      respuesta={
        r.respuesta && (
          <BloqueDeRespuesta
            titulo="Tu respuesta"
            texto={r.respuesta.texto}
            publicadaEn={r.respuesta.publicadaEn}
            editada={r.respuesta.editada}
            completa={desde === 'lista'}
            ocultadaNota={
              r.respuesta.ocultada
                ? `La plataforma ocultó tu respuesta: ${r.respuesta.notaOcultacion ?? ''}`
                : null
            }
            detalle={
              r.respuesta.ocultada
                ? null
                : r.respuesta.editable
                  ? `Puedes cambiarla hasta el ${formatearFechaCorta(r.respuesta.editableHasta)}`
                  : 'Ya no se puede cambiar'
            }
            acciones={
              r.respuesta.editable &&
              (borrando === r.id ? (
                <span className={propios.confirmar} role="group" aria-label="Borrar tu respuesta">
                  <span>¿Borrar tu respuesta? Podrás volver a responder.</span>
                  <button
                    type="button"
                    className={propios.borrar}
                    data-foco={`confirmar-${r.id}`}
                    disabled={borrandoAhora}
                    onClick={() => envioDeLaBaja.enviar(() => baja.mutateAsync(r.id))}
                  >
                    {borrandoAhora ? 'Borrando…' : 'Borrar'}
                  </button>
                  <button
                    type="button"
                    className={piezasResenas.enlaceDiscreto}
                    data-foco={`cancelar-${r.id}`}
                    disabled={borrandoAhora}
                    onClick={() => cancelarBorrar(r.id)}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className={piezasResenas.enlaceDiscreto}
                    data-foco={`editar-${r.id}`}
                    onClick={() => abrirPaso({ vista: 'responder', id: r.id, desde, editando: true })}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={piezasResenas.enlaceDiscreto}
                    data-foco={`borrar-${r.id}`}
                    onClick={() => abrirBorrar(r.id)}
                  >
                    Borrar
                  </button>
                </>
              ))
            }
          />
        )
      }
      acciones={
        <>
          {borrando === r.id && falloDeBorrar && (
            <span className={propios.falloEnLinea} role="alert">
              {falloDeBorrar}
            </span>
          )}
          {r.puedeResponder && (
            <button
              type="button"
              className={piezasResenas.enlaceDiscreto}
              data-foco={`responder-${r.id}`}
              onClick={() => abrirPaso({ vista: 'responder', id: r.id, desde, editando: false })}
            >
              Responder
            </button>
          )}
          {r.puedeReportar && (
            <button
              type="button"
              className={piezasResenas.enlaceDiscreto}
              data-foco={`reportar-${r.id}`}
              onClick={() => abrirPaso({ vista: 'reportar', id: r.id, desde })}
            >
              Reportar
            </button>
          )}
        </>
      }
    />
  )

  const datos: MisResenas | undefined = consulta.data
  const pasoAbierto = ventana && ventana.vista !== 'lista' ? ventana : null
  const armado = datos && pasoAbierto
    ? pasoDeLaVentana(pasoAbierto, datos, {
        enviandoReporte: reportando,
        enviandoRespuesta: respondiendo,
        fallo,
        alVolver: () => borrador.intentar('volver', cerrarPaso(pasoAbierto)),
        alReportar: (id, motivo, comentario) =>
          envioDelReporte.enviar(() => reporte.mutateAsync({ id, motivo, comentario })),
        alResponder: (id, texto, editando) =>
          envioDeLaRespuesta.enviar(() => respuesta.mutateAsync({ id, texto, editando })),
        alCambiarBorrador: borrador.avisar,
      })
    : null
  // Con la pregunta a la vista, el pie es la pregunta; el formulario sigue debajo.
  const paso = armado && pasoAbierto && borrador.preguntando
    ? {
        ...armado,
        pie: (
          <PreguntaDeDescartar
            alSeguir={borrador.seguir}
            alDescartar={() => borrador.descartar(cerrarPaso(pasoAbierto))}
          />
        ),
      }
    : armado

  return (
    <section
      className={`${estilos.seccion} ${propios.seccion}`}
      id={ANCLA_RESENAS}
      ref={seccion}
      aria-labelledby="titulo-resenas"
    >
      <div className={estilos.tituloSeccion}>
        <h2 id="titulo-resenas" ref={titulo} tabIndex={-1}>
          Reseñas de empresas
        </h2>
      </div>
      <p className={estilos.explicacion}>
        Te las escriben las empresas que te contrataron por EX, a partir de tu primer mes. Las
        ven las empresas donde te postulas.
      </p>

      {consulta.isPending ? (
        <div className={propios.cargando} aria-busy="true" aria-label="Cargando tus reseñas">
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
        </div>
      ) : consulta.isError && !datos ? (
        <div className={propios.falloDeCarga} role="alert">
          <p>No pudimos cargar las reseñas.</p>
          <button
            type="button"
            className={propios.reintentar}
            onClick={() => void consulta.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : datos && datos.resenas.length === 0 ? (
        <p className={estilos.ninguna}>
          Todavía no tienes reseñas. Cuando una empresa te contrate por EX, podrá dejarte una a
          partir del primer mes.
        </p>
      ) : datos ? (
        <>
          <ResumenDeResenas resumen={datos.resumen} />
          <div className={propios.recientes}>
            {datos.resenas.slice(0, 2).map((r) => pintar(r, 'seccion'))}
          </div>
          {datos.resenas.length > 2 && (
            <button
              type="button"
              className={propios.verTodas}
              onClick={() => setVentana({ vista: 'lista' })}
            >
              Ver todas las reseñas ({datos.resenas.length})
            </button>
          )}
        </>
      ) : null}

      {datos && (
        <VentanaDeResenas
          abierto={ventana !== null}
          onCerrar={(como) =>
            pasoAbierto ? borrador.intentar(como, cerrarPaso(pasoAbierto)) : cerrarVentana()
          }
          resumen={datos.resumen}
          resenas={datos.resenas}
          pintar={(r) => pintar(r, 'lista')}
          paso={paso}
        />
      )}
    </section>
  )
}

/** El paso de reportar o de responder, armado para la ventana. */
function pasoDeLaVentana(
  ventana: Paso,
  datos: MisResenas,
  acciones: {
    enviandoReporte: boolean
    enviandoRespuesta: boolean
    fallo: string | null
    alVolver: () => void
    alReportar: (id: number, motivo: MotivoDeReporte, comentario: string | null) => void
    alResponder: (id: number, texto: string, editando: boolean) => void
    alCambiarBorrador: (hay: boolean) => void
  },
): PasoDeLaVentana {
  const resena = datos.resenas.find((r) => r.id === ventana.id)
  // Mientras escribía, la empresa la borró o la plataforma la ocultó: ya no está
  // en la lista refrescada. Se dice y se ofrece volver, sin formulario.
  if (!resena) {
    return {
      titulo: 'Reseña no disponible',
      cuerpo: (
        <p className={propios.noDisponible} role="alert">
          {acciones.fallo ?? 'Esta reseña ya no está disponible.'}
        </p>
      ),
      pie: (
        <button type="button" className={propios.volver} data-foco="volver" onClick={acciones.alVolver}>
          Volver
        </button>
      ),
    }
  }

  const contexto = (
    <>
      <div className={propios.contextoCabeza}>
        <Estrellas valor={resena.estrellas} />
        <b>{resena.empresa}</b>
      </div>
      <p className={propios.contextoTexto}>{resena.texto}</p>
    </>
  )

  if (ventana.vista === 'reportar') {
    return {
      titulo: `Reportar la reseña de ${resena.empresa}`,
      cuerpo: (
        <FormularioDeReporte
          key={`reportar-${resena.id}`}
          id={ID_FORMULARIO}
          quien="persona"
          contexto={contexto}
          aviso="La reseña sigue visible mientras la revisamos."
          enviando={acciones.enviandoReporte}
          fallo={acciones.fallo}
          alEnviar={(motivo, comentario) => acciones.alReportar(resena.id, motivo, comentario)}
          alCambiarBorrador={acciones.alCambiarBorrador}
        />
      ),
      pie: (
        <>
          <button type="button" className={propios.volver} data-foco="volver" onClick={acciones.alVolver}>
            Volver
          </button>
          <button
            type="submit"
            form={ID_FORMULARIO}
            className={propios.enviar}
            disabled={acciones.enviandoReporte}
          >
            {acciones.enviandoReporte ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </>
      ),
    }
  }

  return {
    titulo: `Responder a la reseña de ${resena.empresa}`,
    cuerpo: (
      <FormularioDeRespuesta
        key={`responder-${resena.id}-${ventana.editando}`}
        contexto={contexto}
        inicial={ventana.editando ? (resena.respuesta?.texto ?? '') : ''}
        enviando={acciones.enviandoRespuesta}
        fallo={acciones.fallo}
        alEnviar={(texto) => acciones.alResponder(resena.id, texto, ventana.editando)}
        alCambiarBorrador={acciones.alCambiarBorrador}
      />
    ),
    pie: (
      <>
        <button type="button" className={propios.volver} data-foco="volver" onClick={acciones.alVolver}>
          Volver
        </button>
        <button
          type="submit"
          form={ID_FORMULARIO}
          className={propios.enviar}
          disabled={acciones.enviandoRespuesta}
        >
          {acciones.enviandoRespuesta
            ? 'Publicando…'
            : ventana.editando
              ? 'Guardar respuesta'
              : 'Publicar respuesta'}
        </button>
      </>
    ),
  }
}

/**
 * «Tu respuesta»: de 30 a 500 caracteres sin contar los espacios de los
 * extremos, con la cuenta a la vista. Si falta algo se dice junto al campo y no
 * se envía nada.
 *
 * Hay borrador cuando el texto, sin los espacios de los extremos, no es el que
 * ya está guardado: al responder por primera vez, cualquier texto; al editar,
 * uno distinto. Cambiarlo y dejarlo como estaba no es borrador.
 */
function FormularioDeRespuesta({
  contexto,
  inicial,
  enviando,
  fallo,
  alEnviar,
  alCambiarBorrador,
}: {
  contexto: React.ReactNode
  inicial: string
  enviando: boolean
  fallo: string | null
  alEnviar: (texto: string) => void
  alCambiarBorrador: (hay: boolean) => void
}) {
  const [texto, setTexto] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const notarBorrador = useAvisoDeBorrador(alCambiarBorrador)

  useEffect(() => {
    campo.current?.focus()
  }, [])

  return (
    <form
      id={ID_FORMULARIO}
      className={propios.formulario}
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault()
        const falta = faltaEnElTexto(texto, MIN_RESPUESTA, MAX_RESPUESTA, 'Tu respuesta')
        setError(falta)
        if (falta) {
          campo.current?.focus()
          return
        }
        alEnviar(texto.trim())
      }}
    >
      <div className={propios.contexto}>{contexto}</div>
      <CampoContado
        etiqueta="Tu respuesta"
        valor={texto}
        alCambiar={(nuevo) => {
          setTexto(nuevo)
          notarBorrador(nuevo.trim() !== inicial.trim())
        }}
        minimo={MIN_RESPUESTA}
        maximo={MAX_RESPUESTA}
        error={error}
        deshabilitado={enviando}
        referencia={campo}
      />
      <p className={propios.aviso}>
        La verán las empresas donde te postules, debajo de la reseña. Podrás editarla o
        borrarla durante 30 días.
      </p>
      {fallo && (
        <p className={propios.fallo} role="alert">
          {fallo}
        </p>
      )}
    </form>
  )
}
