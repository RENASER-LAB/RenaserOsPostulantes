/**
 * La campana: lo que paso mientras no estaba.
 *
 * El portal solo sabia avisar de una forma —mandando un correo— y el correo se
 * pierde: cae en promociones, se marca leido sin abrir, llega a una direccion
 * que el cargador de curriculums invento y que nadie mira. Cuando la persona
 * entra, lo que ocurrio entretanto no estaba en ninguna parte.
 *
 * ## De donde sale la forma
 *
 * Sigue el `NotificationPopover`: boton de icono con el contador en circulo
 * sobre la esquina, panel que entra con escala (22rem desde el 25/11/2026, para
 * que quepan «Marcar todos como leidos» y la tuerca), cabecera con «Marcar
 * todos como leidos», y una lista con divisores donde cada aviso lleva su punto
 * a la izquierda del titulo, la hora a la derecha y el detalle debajo.
 *
 * ## La tuerca y la guia (25/11/2026)
 *
 * En la cabecera del panel, junto a «Marcar todos como leidos», va la tuerca
 * «Ajustes de avisos»: abre la ventana de WhatsApp, correo y campana
 * (`notificaciones/Ajustes.tsx`), que antes colgaba de un boton en «Mis
 * procesos». Lleva un puntito verde, nunca un texto, cuando WhatsApp se puede
 * activar y no esta encendido ni esperando.
 *
 * La primera vez que alguien entra en «Mis procesos» con alguna postulacion,
 * esa pantalla pide la guia (`notificaciones/guiaPedida.ts`) y aqui se pinta
 * (`notificaciones/Guia.tsx`): la campana es la duena del boton, la tuerca y la
 * ventana sobre los que se pone el foco, y abre el panel en el paso 2.
 *
 * En el telefono (≤ 30rem) el panel es una hoja inferior con velo, y los
 * ajustes se pintan como la misma hoja, con la flecha «Volver a tus avisos».
 *
 * Los avisos entran **escalonados y desenfocandose**: `x: 20, blur(10px)` con
 * un retraso por posicion. Es la unica animacion del portal que dibuja una
 * entrada, y aqui se gana el sitio — la campana se abre sobre contenido que ya
 * estaba, asi que el movimiento es lo que dice cual es la parte nueva.
 *
 * ⚠️ **Lo que se copio es el diseño, no el stack.** El original viene en
 * shadcn + Tailwind + lucide, y cuando se hizo el portal no tenia ninguno de los
 * tres —desde el 01/10/2026 tiene los dos primeros, solo en `/vacantes`—: esto
 * son modulos CSS y los tokens de «El escaparate». Lo que si se usa tal cual es `motion`,
 * que ya estaba en el proyecto — esta es la primera pantalla que la estrena.
 *
 * ⚠️ **Y la superficie se queda clara.** El original va en negro translucido con
 * desenfoque de fondo, pensado para flotar sobre una imagen. Aqui flota sobre la
 * cabecera blanca del portal: no hay nada detras que desenfocar, y seria el unico
 * elemento oscuro de todo el mundo visual. La forma es la suya; el color, el de
 * la casa.
 *
 * Dos decisiones que el diseño trae y valen mas que la forma:
 *
 *   - **Marcar leido lo decide la persona, no el hecho de abrir.** Antes se
 *     apagaban todos al abrir la campana, y con ellos el punto de cada fila de
 *     «Mis procesos» — sin que nadie hubiera leido nada.
 *   - **El aviso entero es pulsable.** El original lo hace con un `onClick` en el
 *     `div`, que no es alcanzable con el tabulador ni responde a Enter; aqui hay
 *     un enlace de verdad estirado con un `::after` sobre la tarjeta: mismo area
 *     para el raton, y un elemento real para el teclado.
 */

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { marcarAvisoLeido, marcarAvisosLeidos, marcarGuiaVista, misAvisos } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import type { AvisoDelPortal, Notificaciones } from '@/api/tipos'
import { IconoTuerca } from './Iconos'
import {
  CLAVE_NOTIFICACIONES,
  useNotificaciones,
  VentanaDeAjustes,
  whatsappPorActivar,
  type ManejoDeAjustes,
} from './notificaciones/Ajustes'
import { GuiaDeAvisos, type PasoDeLaGuia } from './notificaciones/Guia'
import { guiaHecha, olvidarLaGuia, useGuiaPedida } from './notificaciones/guiaPedida'
import estilos from './Campana.module.css'

/**
 * Cuando paso, corto.
 *
 * Va a la derecha del titulo y comparte linea con el, asi que tiene que caber en
 * dos o tres palabras: «hace 3 min», «ayer», «12 sept». El original escribia la
 * fecha entera, que en un aviso de hace un rato dice menos y ocupa mas.
 */
function hace(iso: string): string {
  const cuando = new Date(iso).getTime()
  if (Number.isNaN(cuando)) return ''
  const minutos = Math.floor((Date.now() - cuando) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}

export function Campana() {
  const { hayCuenta } = useSesion()
  const cache = useQueryClient()
  const [abierta, setAbierta] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const tuerca = useRef<HTMLButtonElement>(null)
  const ajustes = useRef<ManejoDeAjustes>(null)
  const guiaPedida = useGuiaPedida()
  const [paso, setPaso] = useState<PasoDeLaGuia | null>(null)
  /*
    Quien pidio menos movimiento no recibe ninguno.

    `motion` lo respeta si se le pregunta, y aqui importa mas que en otros sitios:
    la entrada escalonada con desenfoque es justo el tipo de animacion que provoca
    mareo a quien es sensible a ella. Sin esto, la unica forma de leer sus avisos
    seria esperar a que pararan de moverse.
  */
  const sinMovimiento = useReducedMotion()

  const consulta = useQuery({
    queryKey: ['avisos'],
    queryFn: misAvisos,
    enabled: hayCuenta,
  })

  /*
    Los canales de la cuenta, para el puntito de la tuerca y la guía: solo con el
    panel abierto o la guía pedida. La tuerca no se ve con el panel cerrado, y
    pedirlo en cada pantalla sería una petición más por visita para nada.
  */
  const notificaciones = useNotificaciones(hayCuenta && (abierta || guiaPedida))
  const datos = notificaciones.data
  const enGuia = guiaPedida && paso !== null && datos !== undefined

  /*
    Al cambiar de ruta, el panel se cierra: vale para un aviso, para «Cámbialo en Mi cuenta»
    de los ajustes y para cualquier otro camino. La guía no: ella decide cuándo se abre.
  */
  const { key: laRuta } = useLocation()
  const [rutaDelPanel, setRutaDelPanel] = useState(laRuta)
  if (rutaDelPanel !== laRuta) {
    setRutaDelPanel(laRuta)
    if (paso === null) setAbierta(false)
  }

  // Al salir de la cuenta, la guía vuelve a empezar para quien entre después.
  useEffect(() => {
    if (!hayCuenta) olvidarLaGuia()
  }, [hayCuenta])

  // La guía empieza cuando «Mis procesos» la pide y ya se sabe qué tiene la cuenta.
  useEffect(() => {
    if (!guiaPedida || paso !== null || !datos) return
    setAbierta(false)
    setPaso(1)
  }, [guiaPedida, paso, datos])

  /*
    Las dos invalidan lo mismo: la campana y la lista de procesos, que pinta el
    mismo punto en cada fila. Sin esto, apagar un aviso aqui dejaria encendido su
    punto en «Mis procesos» hasta la siguiente recarga.
  */
  const refrescar = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['avisos'] }),
      cache.invalidateQueries({ queryKey: ['postulaciones'] }),
    ])
  }

  const marcarTodos = useMutation({ mutationFn: marcarAvisosLeidos, onSuccess: refrescar })
  const marcarUno = useMutation({ mutationFn: marcarAvisoLeido, onSuccess: refrescar })

  const avisos = consulta.data?.avisos ?? []
  const sinLeer = consulta.data?.sinLeer ?? 0

  /*
    Cerrar al pulsar fuera y con Escape.

    Las dos, no una: el raton cierra pulsando fuera y el teclado cierra con
    Escape, y quedarse solo con la primera deja atrapado a quien navega con
    tabulador —el foco sigue dentro de un panel que no sabe como cerrar—.
  */
  useEffect(() => {
    if (!abierta) return

    /*
      Con la ventana de ajustes o la guía abiertas, el clic y el Escape son suyos:
      cierran la ventana o saltan la guía, y el panel se queda donde estaba.
    */
    const hayUnaVentana = () => Boolean(contenedor.current?.querySelector('dialog[open]'))

    function fuera(evento: MouseEvent) {
      if (hayUnaVentana()) return
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierta(false)
      }
    }
    function escape(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !hayUnaVentana()) {
        setAbierta(false)
        // El foco vuelve al boton: dejarlo en el aire manda al tabulador al
        // principio de la pagina, que para quien no ve la pantalla es perderse.
        boton.current?.focus()
      }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierta])

  /** La guía pasa de paso: en el 2 y el 3 el panel está abierto, con el foco en la tuerca. */
  function irAlPaso(siguiente: PasoDeLaGuia) {
    setPaso(siguiente)
    setAbierta(siguiente >= 2)
  }

  /** Saltada, «Ahora no», «Entendido», Esc, «Activar WhatsApp» o «Abrir WhatsApp»: vista, aquí y en el servidor. */
  function darLaGuiaPorVista() {
    // Que no se guarde no es para tanto: saldría otra vez en la próxima visita.
    marcarGuiaVista().catch(() => undefined)
    cache.setQueryData<Notificaciones>(CLAVE_NOTIFICACIONES, (antes) => (antes ? { ...antes, guiaVista: true } : antes))
    guiaHecha()
    setPaso(null)
    setAbierta(false)
  }

  function terminarLaGuia() {
    darLaGuiaPorVista()
    // El foco vuelve a la campana, que es de lo que iba la guía.
    requestAnimationFrame(() => boton.current?.focus())
  }

  /*
    «Activar WhatsApp» del paso 3: abre los ajustes y lo enciende como el
    interruptor, en el mismo clic (la pestaña del chat se pide antes de esperar a
    nadie). Sin celular, los ajustes se abren en su campo. Esperando su mensaje,
    «Abrir WhatsApp» pasa por aquí igual: el backend renueva la espera y vuelve a
    dar el chat; si no hay chat que abrir, quedan los ajustes a la vista.
  */
  function activarDesdeLaGuia() {
    const sinNumero = datos?.whatsapp.estado === 'SIN_NUMERO'
    darLaGuiaPorVista()
    if (sinNumero) ajustes.current?.abrirEnElNumero()
    else ajustes.current?.abrirYActivar()
  }

  /**
   * Al cerrar los ajustes, el foco vuelve a la tuerca si el panel sigue abierto, o a la campana.
   *
   * Abierta desde la tuerca, el propio `<dialog>` se lo devuelve y aquí no hay nada que hacer.
   * Abierta desde la guía (QA-08), lo que tenía el foco antes era su botón, ya desmontado: el
   * navegador deja un instante el foco en la × o el campo de la ventana cerrada —conectados,
   * pero sin pintar— y luego lo suelta en el `<body>`. Eso no cuenta como un foco que respetar.
   * El panel se mira al cerrarse y no por la tuerca: mientras el panel sale (200 ms), la tuerca
   * sigue montada.
   */
  function devolverElFoco() {
    const conPanel = abierta
    requestAnimationFrame(() => {
      if (focoALaVista(document.activeElement)) return
      const destino = conPanel && tuerca.current?.isConnected ? tuerca.current : boton.current
      destino?.focus()
    })
  }

  if (!hayCuenta) return null

  return (
    <div className={estilos.contenedor} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={estilos.boton}
        onClick={() => {
          // Al abrirla, lo de ahora y no lo de hace un rato: un aviso que llegó por una
          // acción de otra pantalla o del equipo no puede esperar a que se recargue (AC-10).
          if (!abierta) void consulta.refetch()
          setAbierta(!abierta)
        }}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        // El nombre lleva la cuenta: quien usa lector de pantalla no ve el
        // contador, y «Avisos» a secas no le dice que hay algo nuevo.
        aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      >
        <IconoCampana />
        {sinLeer > 0 && (
          <span className={estilos.contador} aria-hidden="true">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {/* En el teléfono el panel es una hoja inferior: el velo apaga la página y tocarlo la cierra. */}
      {abierta && <div className={estilos.veloDeLaHoja} aria-hidden="true" onClick={() => setAbierta(false)} />}

      <AnimatePresence>
        {abierta && (
          <motion.div
            ref={panel}
            className={estilos.panel}
            role="dialog"
            aria-label="Tus avisos"
            initial={sinMovimiento ? false : { opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={sinMovimiento ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: sinMovimiento ? 0 : 0.2 }}
          >
            <span className={estilos.asa} aria-hidden="true" />
            <div className={estilos.cabecera}>
              <h3 className={estilos.tituloPanel}>Tus avisos</h3>
              <div className={estilos.herramientas}>
                {sinLeer > 0 && (
                  <button
                    type="button"
                    className={estilos.marcarTodos}
                    onClick={() => marcarTodos.mutate()}
                    disabled={marcarTodos.isPending}
                  >
                    Marcar todos como leídos
                  </button>
                )}
                {/*
                  La tuerca: los ajustes de WhatsApp, correo y campana. El puntito
                  verde dice «WhatsApp se puede activar» sin una palabra; el nombre
                  lo lleva `aria-label`, y el globito es para el ratón y el teclado.
                */}
                <button
                  ref={tuerca}
                  type="button"
                  className={estilos.tuerca}
                  aria-label="Ajustes de avisos"
                  aria-haspopup="dialog"
                  onClick={() => ajustes.current?.abrir()}
                >
                  <IconoTuerca tamano={17} />
                  {whatsappPorActivar(datos) && <span className={estilos.puntito} data-puntito="" aria-hidden="true" />}
                  <span className={estilos.globito} aria-hidden="true">
                    Ajustes de avisos
                  </span>
                </button>
              </div>
            </div>

            {consulta.isPending && <p className={estilos.vacio}>Buscando…</p>}

            {consulta.isError && (
              <p className={estilos.vacio} role="alert">
                No pudimos cargar tus avisos. Vuelve a intentarlo en un momento.
              </p>
            )}

            {consulta.isSuccess && avisos.length === 0 && (
              <p className={estilos.vacio}>
                Nada nuevo por ahora. Aquí te contaremos lo que cambie en los procesos
                en los que estás.
              </p>
            )}

            <div className={estilos.lista}>
              {avisos.map((aviso, posicion) => (
                <Aviso
                  key={aviso.id}
                  aviso={aviso}
                  posicion={posicion}
                  sinMovimiento={Boolean(sinMovimiento)}
                  alAbrir={() => {
                    if (!aviso.leidoEn) marcarUno.mutate(aviso.id)
                  }}
                  alNavegar={() => setAbierta(false)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VentanaDeAjustes
        ref={ajustes}
        alVolverALosAvisos={() => {
          setAbierta(true)
          requestAnimationFrame(() => tuerca.current?.focus())
        }}
        alCerrar={devolverElFoco}
      />

      {enGuia && (
        <GuiaDeAvisos
          datos={datos}
          paso={paso}
          campana={boton}
          tuerca={tuerca}
          panel={panel}
          alIrA={irAlPaso}
          alTerminar={terminarLaGuia}
          alActivar={activarDesdeLaGuia}
        />
      )}
    </div>
  )
}

/**
 * Si el foco está en algo vivo y a la vista: ni el `<body>`, ni algo ya desmontado, ni lo que
 * queda dentro de un `<dialog>` cerrado o sin pintar.
 */
export function focoALaVista(activo: Element | null): boolean {
  if (!activo || activo === document.body || !activo.isConnected) return false
  if (activo.closest('dialog:not([open])')) return false
  // jsdom no lo implementa; el navegador sí, y mira también lo oculto por estilo.
  return typeof activo.checkVisibility === 'function' ? activo.checkVisibility() : true
}

/**
 * Los avisos de las reseñas de empresas (V63). No cuelgan de ningún proceso —la
 * reseña es de la persona, no de una postulación— y llevan a su sección del
 * perfil, donde puede leerla, responderla o ver en qué quedó su reporte.
 */
const DE_LAS_RESENAS = new Set([
  'RESENA_PUBLICADA',
  'RESENA_EDITADA',
  'REPORTE_RESENA_RESUELTO',
  'RESPUESTA_RESENA_OCULTADA',
])

/** A dónde lleva un aviso, o `null` si no lleva a ninguna parte. */
export function destinoDelAviso(aviso: AvisoDelPortal): string | null {
  if (DE_LAS_RESENAS.has(aviso.tipo)) return rutas.resenasDelPerfil()
  return aviso.postulacionUuid ? rutas.proceso(aviso.postulacionUuid) : null
}

/**
 * Un aviso de la lista.
 *
 * Entra desde la derecha desenfocandose, con un retraso proporcional a su
 * posicion: los de arriba primero. El tope de retraso existe porque quien lleva
 * meses sin entrar puede tener veinte, y sin el, el ultimo tardaria dos segundos
 * en aparecer sobre un panel que ya se puede desplazar.
 */
function Aviso({
  aviso,
  posicion,
  sinMovimiento,
  alAbrir,
  alNavegar,
}: {
  aviso: AvisoDelPortal
  posicion: number
  sinMovimiento: boolean
  alAbrir: () => void
  alNavegar: () => void
}) {
  const retraso = Math.min(posicion * 0.06, 0.5)

  const cuerpo = (
    <>
      <span className={estilos.lineaTitulo}>
        {!aviso.leidoEn && (
          <>
            <span className={estilos.punto} aria-hidden="true" />
            <span className="solo-lectores">Sin leer. </span>
          </>
        )}
        <span className={estilos.tituloAviso}>{aviso.titulo}</span>
      </span>
      <span className={estilos.cuando}>{hace(aviso.creadoEn)}</span>
    </>
  )

  return (
    <motion.div
      className={estilos.aviso}
      initial={sinMovimiento ? false : { opacity: 0, x: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: sinMovimiento ? 0 : 0.3, delay: sinMovimiento ? 0 : retraso }}
    >
      {/*
        Con proceso detras es un enlace; sin el, un boton. Los dos se estiran
        sobre la tarjeta entera con el mismo `::after`: un solo elemento en el
        arbol de accesibilidad, con el texto que le corresponde, y toda el area
        para el raton.

        El original resuelve esto con un `onClick` en el `div`, que no es
        alcanzable con el tabulador ni responde a Enter. Se ve igual y funciona
        para mas gente.
      */}
      {destinoDelAviso(aviso) ? (
        <Link
          className={estilos.zona}
          to={destinoDelAviso(aviso)!}
          onClick={() => {
            alAbrir()
            alNavegar()
          }}
        >
          {cuerpo}
        </Link>
      ) : (
        <button type="button" className={estilos.zona} onClick={alAbrir}>
          {cuerpo}
        </button>
      )}
      <p className={estilos.detalle}>{aviso.cuerpo}</p>
    </motion.div>
  )
}

/**
 * La campana, dibujada.
 *
 * El mismo trazo que `Bell` de lucide —16 px, grosor 2— para no traerse la
 * libreria entera por un icono. Hereda el color: el contador se pinta aparte.
 */
function IconoCampana() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
