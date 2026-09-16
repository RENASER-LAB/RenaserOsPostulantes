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
 * sobre la esquina, panel de 20rem que entra con escala, cabecera con
 * «Marcar todos como leidos», y una lista con divisores donde cada aviso lleva
 * su punto a la izquierda del titulo, la hora a la derecha y el detalle debajo.
 *
 * Los avisos entran **escalonados y desenfocandose**: `x: 20, blur(10px)` con
 * un retraso por posicion. Es la unica animacion del portal que dibuja una
 * entrada, y aqui se gana el sitio — la campana se abre sobre contenido que ya
 * estaba, asi que el movimiento es lo que dice cual es la parte nueva.
 *
 * ⚠️ **Lo que se copio es el diseño, no el stack.** El original viene en
 * shadcn + Tailwind + lucide, y este portal no tiene ninguno de los tres: tiene
 * modulos CSS y los tokens de «El escaparate». Lo que si se usa tal cual es `motion`,
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
import { Link } from 'react-router-dom'
import { marcarAvisoLeido, marcarAvisosLeidos, misAvisos } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import type { AvisoDelPortal } from '@/api/tipos'
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

    function fuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierta(false)
      }
    }
    function escape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
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

  if (!hayCuenta) return null

  return (
    <div className={estilos.contenedor} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={estilos.boton}
        onClick={() => setAbierta((estaba) => !estaba)}
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

      <AnimatePresence>
        {abierta && (
          <motion.div
            className={estilos.panel}
            role="dialog"
            aria-label="Tus avisos"
            initial={sinMovimiento ? false : { opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={sinMovimiento ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: sinMovimiento ? 0 : 0.2 }}
          >
            <div className={estilos.cabecera}>
              <h3 className={estilos.tituloPanel}>Avisos</h3>
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
    </div>
  )
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
      {aviso.postulacionUuid ? (
        <Link
          className={estilos.zona}
          to={rutas.proceso(aviso.postulacionUuid)}
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
