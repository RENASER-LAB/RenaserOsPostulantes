/**
 * «Ajustes de avisos»: la ventana que abre la tuerca de la campana (V92; desde el 25/11/2026).
 *
 * Un solo ajuste por cuenta para los tres canales —WhatsApp, correo y la campana del
 * portal— en una ventana (`<dialog>`). El interruptor de WhatsApp vale para todos sus
 * procesos, los de hoy y los que vengan. Hasta el 25/11/2026 se abría con un botón
 * «Notificaciones» junto al título de «Mis procesos», con una línea de estado y un mensaje
 * flotante que invitaba a activar WhatsApp; los tres se quitaron: la entrada es la tuerca
 * (ver `Campana.tsx`) y la invitación es el paso 3 de la guía de la primera vez (`Guia.tsx`).
 *
 * Lo que se pinta lo decide el backend (`GET /notificaciones`); aquí solo vive lo que dura
 * un clic: «Activando…», el fallo del bot y la confirmación recién llegada.
 *
 * WhatsApp se enciende por dos caminos, y el backend elige cuál:
 *
 *   - **con un clic**, si esta cuenta ya escribió desde ese número: queda activo y al
 *     candidato le llega un mensaje para confirmarlo;
 *   - **con mensaje**, si el número está sin comprobar: se le abre el chat del bot con el
 *     mensaje ya escrito y queda activo cuando lo envía.
 *
 * ⚠️ **La pestaña del chat se abre ANTES del `await`** cuando se espera el camino con
 * mensaje: después, el navegador ya no la cuenta como parte del clic y la bloquea —Safari
 * siempre—. Por eso `abrirYActivar` (el «Activar WhatsApp» de la guía) es síncrono hasta
 * pedir la pestaña. Si el bot no conocía un número que creíamos comprobado, el chat se abre
 * igual desde un enlace a la vista. En la aplicación de Android se navega y el sistema se lo
 * da a WhatsApp.
 *
 * En el teléfono la ventana se pinta como la hoja inferior de la campana, con una flecha
 * «Volver a tus avisos» en vez de la ×: es la misma hoja que cambia de contenido.
 */

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { esLaAplicacion } from '@/api/almacenNativo'
import { ErrorApi } from '@/api/cliente'
import {
  activarWhatsapp,
  apagarWhatsapp,
  cambiarCelular,
  cambiarNotificaciones,
  misNotificaciones,
} from '@/api/portal'
import type { Notificaciones, WhatsappDeLaCuenta } from '@/api/tipos'
import { comoE164, MENSAJE_CELULAR, MENSAJE_TELEFONO_EN_USO } from '@/dominio/celular'
import { rutas } from '@/rutas'
import { CampoCelular } from '@/ui/campos/CampoCelular'
import { IconoAnterior, IconoCruz, IconoPantalla, IconoSobre, IconoWhatsapp } from '@/ui/Iconos'
import estilos from './Ajustes.module.css'

export const CLAVE_NOTIFICACIONES = ['notificaciones'] as const

/** Lo que firma al encenderlo: el texto WHATSAPP_CUENTA 1.0 del backend, palabra por palabra. */
export const CONSENTIMIENTO_WHATSAPP_CUENTA =
  'Al activarlo aceptas recibir por WhatsApp las novedades de tus procesos. Escribe BAJA cuando quieras dejarlo.'

export const NO_SE_PUDO_ACTIVAR = 'No pudimos activarlo. Vuelve a intentarlo en un momento.'

/** Los tres canales de la cuenta. Lo comparten la campana, la ventana y la guía. */
export function useNotificaciones(activa = true) {
  return useQuery({ queryKey: CLAVE_NOTIFICACIONES, queryFn: misNotificaciones, enabled: activa })
}

/**
 * El puntito verde de la tuerca: WhatsApp se puede activar y no está encendido ni esperando
 * su mensaje (apagado, sin número, no llegó, por BAJA o con un número nuevo). Nunca un texto.
 */
export function whatsappPorActivar(datos: Notificaciones | undefined): boolean {
  if (!datos?.whatsapp.disponible) return false
  return datos.whatsapp.estado !== 'ACTIVO' && datos.whatsapp.estado !== 'ESPERANDO'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

/**
 * «2026-11-12» → «12 nov». Por partes y no con `new Date`: un día suelto se lee como medianoche
 * UTC, y en Lima eso cae en el día anterior.
 */
export function diaCorto(dia: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia ?? '')
  if (!m) return null
  const mes = MESES[Number(m[2]) - 1]
  return mes ? `${Number(m[3])} ${mes}` : null
}

/** El código de un error del backend (`TELEFONO_EN_USO`, `SIN_CELULAR`…), si lo trae. */
function codigoDe(causa: unknown): string | undefined {
  return causa instanceof ErrorApi && typeof causa.cuerpo === 'object' && causa.cuerpo !== null
    ? (causa.cuerpo as { codigo?: string }).codigo
    : undefined
}

/** Lo que dura un clic en la fila de WhatsApp. */
type Fase = 'reposo' | 'activando' | 'fallo' | 'confirmado'

/** Lo que la campana y la guía le piden a la ventana. */
export interface ManejoDeAjustes {
  abrir: () => void
  /** Abre y enciende WhatsApp: el «Activar WhatsApp» de la guía, como el interruptor. */
  abrirYActivar: () => void
  /** Abre con el foco en el campo del celular: activar sin número empieza por ahí. */
  abrirEnElNumero: () => void
}

interface PropsVentana {
  ref?: Ref<ManejoDeAjustes>
  /** La flecha del teléfono: la ventana se cierra y vuelve la hoja de los avisos. */
  alVolverALosAvisos: () => void
  /** Se cerró por cualquier camino: la ×, Esc, el velo o la flecha. */
  alCerrar?: () => void
}

export function VentanaDeAjustes({ ref, alVolverALosAvisos, alCerrar }: PropsVentana) {
  const cache = useQueryClient()
  const [abierta, setAbierta] = useState(false)
  const consulta = useNotificaciones(abierta)
  const datos = consulta.data
  const ventana = useRef<HTMLDialogElement>(null)
  const campoNumero = useRef<HTMLInputElement>(null)
  const idTitulo = useId()
  const [fase, setFase] = useState<Fase>('reposo')
  const [enlaceSinAbrir, setEnlaceSinAbrir] = useState<string | null>(null)
  const [alNumero, setAlNumero] = useState(false)
  const { key: laRuta } = useLocation()

  /*
    Esperando su mensaje: al volver a esta pestaña —lo normal después de escribir en
    WhatsApp— se pregunta otra vez, para que «WhatsApp activo» salga sin recargar. Vale
    también con la ventana cerrada: el puntito de la tuerca se apaga solo.
  */
  const esperando = datos?.whatsapp.estado === 'ESPERANDO'
  useEffect(() => {
    if (!esperando) return undefined
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cache.invalidateQueries({ queryKey: CLAVE_NOTIFICACIONES })
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [esperando, cache])

  /*
    La ventana vive en la cabecera y no se va con la pantalla: si se cambia de ruta con ella
    abierta, se cierra. Si no, se quedaría encima del destino con todo lo de debajo inerte, y
    «Cámbialo en Mi cuenta» llegaría al celular sin poder ponerle el foco.
  */
  useEffect(() => {
    if (ventana.current?.open) ventana.current.close()
  }, [laRuta])

  // Sin número: el foco al campo en cuanto la fila está pintada.
  useEffect(() => {
    if (!abierta || !alNumero || !campoNumero.current) return
    campoNumero.current.focus()
    setAlNumero(false)
  }, [abierta, alNumero, datos])

  /*
    Lo que devuelve el servidor tras un cambio manda sobre una lectura que siguiera en
    camino: al abrir la ventana se vuelve a pedir el estado, y si esa respuesta (anterior al
    cambio) llegara después, pintaría lo de antes. Se cancela y luego se guarda.
  */
  async function guardar(nuevos: Notificaciones) {
    await cache.cancelQueries({ queryKey: CLAVE_NOTIFICACIONES })
    cache.setQueryData(CLAVE_NOTIFICACIONES, nuevos)
  }

  function mostrar() {
    setAbierta(true)
    const dialogo = ventana.current
    if (dialogo && !dialogo.open) dialogo.showModal()
  }

  function cerrar() {
    ventana.current?.close()
  }

  /** Lleva al chat: la pestaña ya pedida, la aplicación, o el enlace a la vista. */
  function abrirChat(enlace: string, pestana: Window | null) {
    if (esLaAplicacion()) {
      window.location.href = enlace
      return
    }
    if (pestana) {
      pestana.opener = null
      pestana.location.href = enlace
      return
    }
    setEnlaceSinAbrir(enlace)
  }

  async function activar() {
    if (fase === 'activando') return
    // Lo último que se sabe, y no lo del último pintado: la guía llama aquí en el mismo clic.
    const ahora = cache.getQueryData<Notificaciones>(CLAVE_NOTIFICACIONES) ?? datos
    setEnlaceSinAbrir(null)
    // Sin comprobar, el backend contestará con el enlace al chat: la pestaña se pide ya.
    const pestana = ahora && !ahora.whatsapp.comprobado && !esLaAplicacion() ? window.open('', '_blank') : null
    setFase('activando')
    try {
      const hecho = await activarWhatsapp()
      await guardar(hecho.notificaciones)
      if (hecho.resultado === 'POR_MENSAJE' && hecho.enlace) {
        abrirChat(hecho.enlace, pestana)
        setFase('reposo')
      } else {
        pestana?.close()
        setFase(hecho.confirmacionEnviada ? 'confirmado' : 'reposo')
      }
    } catch (causa) {
      pestana?.close()
      const codigo = codigoDe(causa)
      if (codigo === 'SIN_CELULAR' || codigo === 'NO_DISPONIBLE') {
        // El servidor sabe algo que esta pantalla no: se vuelve a pedir y la fila cambia sola.
        setFase('reposo')
        void cache.invalidateQueries({ queryKey: CLAVE_NOTIFICACIONES })
      } else {
        setFase('fallo')
      }
    }
  }

  async function apagar() {
    setFase('activando')
    setEnlaceSinAbrir(null)
    try {
      await guardar(await apagarWhatsapp())
      setFase('reposo')
    } catch {
      setFase('fallo')
    }
  }

  useImperativeHandle(ref, () => ({
    abrir: mostrar,
    abrirYActivar: () => {
      mostrar()
      void activar()
    },
    abrirEnElNumero: () => {
      setAlNumero(true)
      mostrar()
    },
  }))

  return (
    <dialog
      ref={ventana}
      className={estilos.ventana}
      aria-labelledby={idTitulo}
      onClose={() => {
        setAbierta(false)
        setAlNumero(false)
        if (fase !== 'activando') setFase('reposo')
        alCerrar?.()
      }}
      onClick={(e) => {
        // Tocar el velo (el propio <dialog>, fuera de su caja) la cierra.
        if (e.target === e.currentTarget) {
          cerrar()
          return
        }
        /*
          Un enlace a otra pantalla del portal también, en el mismo clic: antes de que el
          destino se pinte y quiera el foco (el celular de «Mi cuenta» lo pide al montarse).
          El chat de WhatsApp se abre en otra pestaña y la ventana se queda.
        */
        const enlace = (e.target as Element).closest('a[href]')
        if (enlace && enlace.getAttribute('target') !== '_blank') cerrar()
      }}
    >
      <span className={estilos.asa} aria-hidden="true" />
      <div className={estilos.cabeza}>
        <button
          type="button"
          className={estilos.volver}
          onClick={() => {
            cerrar()
            alVolverALosAvisos()
          }}
          aria-label="Volver a tus avisos"
        >
          <IconoAnterior tamano={20} />
        </button>
        <div className={estilos.cabezaTextos}>
          <h2 id={idTitulo} className={estilos.titulo}>
            Ajustes de avisos
          </h2>
          <p className={estilos.subtitulo}>Para todos tus procesos.</p>
        </div>
        <button type="button" className={estilos.cerrar} onClick={cerrar} aria-label="Cerrar">
          <IconoCruz tamano={18} />
        </button>
      </div>

      {!datos && consulta.isError && (
        <p className={`${estilos.cargando} ${estilos.notaFallo}`} role="alert">
          No pudimos cargar tus ajustes. Vuelve a intentarlo en un momento.
        </p>
      )}
      {!datos && !consulta.isError && (
        <p className={estilos.cargando} aria-busy="true">
          Cargando…
        </p>
      )}

      {datos && (
        <>
          <div className={estilos.canales}>
            {datos.whatsapp.disponible && (
              <FilaWhatsapp
                whatsapp={datos.whatsapp}
                fase={fase}
                enlaceSinAbrir={enlaceSinAbrir}
                campoNumero={campoNumero}
                alActivar={() => void activar()}
                alApagar={() => void apagar()}
                alGuardarNumero={() => void cache.invalidateQueries({ queryKey: CLAVE_NOTIFICACIONES })}
              />
            )}
            <FilaInterruptor
              canal="correo"
              nombre="Correo"
              detalle={datos.correo.destino ?? ''}
              icono={<IconoSobre tamano={18} />}
              activo={datos.correo.activo}
              aviso="No te llegarán por correo los plazos de tus pruebas. Los verás aquí, en el portal."
              alGuardar={guardar}
            />
            <FilaInterruptor
              canal="portal"
              nombre="En el portal"
              detalle="La campana de arriba"
              icono={<IconoPantalla tamano={18} />}
              activo={datos.portal.activo}
              aviso="La campana dejará de marcar novedades. Tus procesos siguen mostrando su estado."
              alGuardar={guardar}
            />
          </div>

          <p className={estilos.pie}>
            Te avisamos cuando cambia tu proceso o cuando te toca hacer algo. Nunca publicidad.
          </p>
        </>
      )}
    </dialog>
  )
}

// ---------- WhatsApp ----------

interface PropsFilaWhatsapp {
  whatsapp: WhatsappDeLaCuenta
  fase: Fase
  enlaceSinAbrir: string | null
  /** El campo del celular, para llevarle el foco cuando la guía abre la ventana sin número. */
  campoNumero: RefObject<HTMLInputElement | null>
  alActivar: () => void
  alApagar: () => void
  alGuardarNumero: () => void
}

function FilaWhatsapp({
  whatsapp,
  fase,
  enlaceSinAbrir,
  campoNumero,
  alActivar,
  alApagar,
  alGuardarNumero,
}: PropsFilaWhatsapp) {
  const { estado, numero } = whatsapp
  const encendido = estado === 'ACTIVO' || estado === 'ESPERANDO'
  const sinNumero = estado === 'SIN_NUMERO'

  let nota: ReactNode
  if (fase === 'activando') {
    nota = <p className={estilos.nota}>Activando…</p>
  } else if (fase === 'fallo') {
    nota = (
      <p className={`${estilos.nota} ${estilos.notaFallo}`} role="alert">
        {NO_SE_PUDO_ACTIVAR}
      </p>
    )
  } else if (sinNumero) {
    nota = <AltaDeNumero campo={campoNumero} alGuardar={alGuardarNumero} />
  } else if (estado === 'ESPERANDO') {
    nota = (
      <p className={`${estilos.nota} ${estilos.notaAviso}`}>
        Te abrimos WhatsApp. Envía el mensaje desde el <span className={estilos.numero}>{numero}</span> para
        terminar.
        {enlaceSinAbrir && (
          <>
            {' '}
            Tu navegador no abrió WhatsApp.{' '}
            <a href={enlaceSinAbrir} target="_blank" rel="noreferrer">
              Ábrelo desde aquí
            </a>
            .
          </>
        )}
      </p>
    )
  } else if (estado === 'NO_LLEGO') {
    nota = (
      <p className={`${estilos.nota} ${estilos.notaFallo}`} role="alert">
        No nos llegó tu mensaje desde el <span className={estilos.numero}>{numero}</span>.{' '}
        <button type="button" className={estilos.enlace} onClick={alActivar}>
          Reintentar
        </button>
      </p>
    )
  } else if (estado === 'ACTIVO') {
    nota = (
      <p className={estilos.nota}>
        {fase === 'confirmado' && 'Te enviamos un mensaje para confirmarlo. '}
        Te avisamos de todos tus procesos y puedes escribirnos tus dudas.
      </p>
    )
  } else if (whatsapp.cambioDeNumero && !whatsapp.comprobado) {
    nota = (
      <p className={`${estilos.nota} ${estilos.notaAviso}`}>
        Cambiaste tu número. Actívalo y envía un mensaje desde el nuevo para comprobarlo.
      </p>
    )
  } else if (whatsapp.porBaja) {
    const dia = diaCorto(whatsapp.bajaEn)
    nota = (
      <p className={estilos.nota}>
        Lo apagaste escribiendo BAJA{dia ? ` el ${dia}` : ''}. Actívalo y vuelves a recibir por aquí las
        novedades de tus procesos; te llegará un mensaje para confirmarlo. Escribe BAJA cuando quieras dejarlo.
      </p>
    )
  } else {
    nota = (
      <p className={estilos.nota}>
        {CONSENTIMIENTO_WHATSAPP_CUENTA}
        {!whatsapp.comprobado && (
          <>
            {' '}
            ¿No es tu número? <Link to={rutas.celularDeLaCuenta()}>Cámbialo en Mi cuenta</Link>.
          </>
        )}
      </p>
    )
  }

  return (
    <div className={`${estilos.canal} ${estilos.canalWhatsapp}`} data-encendido={estado === 'ACTIVO' || undefined}>
      <span className={estilos.sello}>
        <IconoWhatsapp tamano={18} />
      </span>
      <div>
        <p className={estilos.nombre}>
          WhatsApp <span className={estilos.recomendado}>Recomendado</span>
        </p>
        <p className={`${estilos.detalle} ${estilos.numero}`}>{sinNumero ? 'Sin número' : numero}</p>
      </div>
      {sinNumero ? (
        <span />
      ) : (
        <button
          type="button"
          role="switch"
          className={`${estilos.interruptor} ${estilos.interruptorVerde}`}
          aria-checked={encendido}
          aria-label="Notificaciones por WhatsApp"
          aria-busy={fase === 'activando' || undefined}
          disabled={fase === 'activando'}
          onClick={encendido ? alApagar : alActivar}
        />
      )}
      {nota}
    </div>
  )
}

/** Sin número: el campo y «Guardar», con el mismo guardado que «Mi cuenta». */
function AltaDeNumero({ campo, alGuardar }: { campo: RefObject<HTMLInputElement | null>; alGuardar: () => void }) {
  const cache = useQueryClient()
  const [escrito, setEscrito] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!escrito.trim()) {
      setError('Escribe tu celular.')
      return
    }
    if (comoE164(escrito) === null) {
      setError(MENSAJE_CELULAR)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      await cambiarCelular(escrito)
      await cache.invalidateQueries({ queryKey: ['mi-celular'] })
      alGuardar()
    } catch (causa) {
      if (codigoDe(causa) === 'TELEFONO_EN_USO') {
        setError(MENSAJE_TELEFONO_EN_USO)
      } else {
        setError(causa instanceof Error && causa.message ? causa.message : MENSAJE_CELULAR)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className={`${estilos.nota} ${estilos.altaNumero}`} onSubmit={(e) => void enviar(e)} noValidate>
      <div className={estilos.filaNumero}>
        <CampoCelular
          ref={campo}
          etiqueta="Agrega tu celular para recibir avisos por WhatsApp."
          autoComplete="tel-national"
          valor={escrito}
          alCambiar={(valor) => {
            setEscrito(valor)
            setError(null)
          }}
          error={error ?? undefined}
        />
        <button type="submit" className={estilos.guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ---------- Correo y portal ----------

interface PropsFilaInterruptor {
  canal: 'correo' | 'portal'
  nombre: string
  detalle: string
  icono: ReactNode
  activo: boolean
  /** Lo que se dice debajo del interruptor cuando está apagado. */
  aviso: string
  alGuardar: (nuevos: Notificaciones) => Promise<void>
}

function FilaInterruptor({ canal, nombre, detalle, icono, activo, aviso, alGuardar }: PropsFilaInterruptor) {
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(false)

  async function cambiar() {
    setGuardando(true)
    setFallo(false)
    try {
      await alGuardar(await cambiarNotificaciones({ [canal]: !activo }))
    } catch {
      setFallo(true)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={estilos.canal} data-encendido={activo || undefined}>
      <span className={estilos.sello}>{icono}</span>
      <div>
        <p className={estilos.nombre}>{nombre}</p>
        <p className={estilos.detalle}>{detalle}</p>
      </div>
      <button
        type="button"
        role="switch"
        className={estilos.interruptor}
        aria-checked={activo}
        aria-label={`Notificaciones ${canal === 'correo' ? 'por correo' : 'en el portal'}`}
        aria-busy={guardando || undefined}
        disabled={guardando}
        onClick={() => void cambiar()}
      />
      {fallo && (
        <p className={`${estilos.nota} ${estilos.notaFallo}`} role="alert">
          No pudimos guardar el cambio. Vuelve a intentarlo en un momento.
        </p>
      )}
      {!activo && !fallo && <p className={`${estilos.nota} ${estilos.notaAviso}`}>{aviso}</p>}
    </div>
  )
}
