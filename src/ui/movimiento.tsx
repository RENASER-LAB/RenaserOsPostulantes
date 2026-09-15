/**
 * El movimiento del portal, con `motion`.
 *
 * Cuatro piezas **independientes** entre si, para poder quedarse con unas y
 * tirar otras sin desmontar el resto:
 *
 *   A · `PantallaConEntrada`  — cada pantalla entra desplazandose y fundiendo.
 *   B · `TituloQueViaja`      — el titulo de la vacante viaja de la tarjeta a la ficha.
 *   C · `FranjaQueSeLlena`    — la barra del recorrido se dibuja de izquierda a derecha.
 *   D · `TarjetaQueResponde`  — la tarjeta se levanta al pasar por encima.
 *
 * ⚠️ **Todas respetan `prefers-reduced-motion`.** No es un adorno de
 * accesibilidad: esto es un portal de empleo y una barrera aqui impide postular
 * a un trabajo. `useReducedMotion` de motion lee la preferencia del sistema, y
 * cuando esta puesta las piezas se montan ya en su estado final.
 *
 * ⚠️ **Dentro de la prueba del puesto no se usa ninguna.** Lo dice DESIGN.md y
 * el motivo es del producto: el reloj corre y cualquier cosa que se mueva
 * compite con una tarea cronometrada.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { matchPath, useLocation } from 'react-router-dom'
import { patrones } from '@/rutas'

/** La curva del mundo, la misma que usan las transiciones CSS. */
const SALIDA = [0.16, 1, 0.3, 1] as const

/**
 * Donde corre el reloj.
 *
 * La regla de arriba decia que dentro de la prueba no se usa ninguna pieza,
 * pero `PantallaConEntrada` envuelve el `<Outlet>` del armazon, asi que las
 * tres entraban desplazandose igual que las demas: la unica pieza que una
 * pantalla no puede rechazar es la que le pone su contenedor. Se rechaza aqui.
 */
const CRONOMETRADAS = [patrones.evaluacion, patrones.prueba, patrones.cuestionarioTecnico]

function conElRelojCorriendo(pathname: string) {
  return CRONOMETRADAS.some((patron) => matchPath(patron, pathname) !== null)
}

/* ------------------------------------------------------------------ *
 * A · La pantalla que entra
 * ------------------------------------------------------------------ */

/**
 * Envuelve el `<Outlet>` del armazon. Cada cambio de ruta funde la pantalla
 * vieja y entra la nueva con un desplazamiento corto.
 *
 * `mode="wait"` para que no se solapen dos pantallas: con el ancho fijo del
 * portal, dos capas a la vez producen un salto de altura feo.
 */
export function PantallaConEntrada({ children }: { children: ReactNode }) {
  const donde = useLocation()
  const quieto = useReducedMotion()

  if (quieto || conElRelojCorriendo(donde.pathname)) return <>{children}</>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={donde.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: SALIDA }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ *
 * B · El titulo que viaja
 * ------------------------------------------------------------------ */

/**
 * El titulo de una vacante, compartido entre su tarjeta y su ficha.
 *
 * `layoutId` es lo que hace el trabajo: cuando dos elementos con el mismo id
 * existen en momentos distintos, motion interpola posicion y tamano de uno al
 * otro en vez de fundir dos fotos, que es donde la API nativa se quedaba corta.
 *
 * ⚠️ **El id lleva el numero de la vacante.** En la portada hay una tarjeta por
 * puesto y dos elementos con el mismo `layoutId` vivos a la vez pelean.
 */
export function TituloQueViaja({
  id,
  como: Como = 'h3',
  className,
  children,
}: {
  id: number | string
  como?: 'h1' | 'h3'
  className?: string
  children: ReactNode
}) {
  const quieto = useReducedMotion()
  if (quieto) return <Como className={className}>{children}</Como>

  const Etiqueta = Como === 'h1' ? motion.h1 : motion.h3
  return (
    <Etiqueta
      layoutId={`vacante-${id}`}
      className={className}
      transition={{ duration: 0.34, ease: SALIDA }}
    >
      {children}
    </Etiqueta>
  )
}

/* ------------------------------------------------------------------ *
 * C · La franja que se llena
 * ------------------------------------------------------------------ */

/**
 * La barra de una etapa del recorrido, dibujandose de izquierda a derecha.
 *
 * Es la unica de las cuatro cuyo movimiento **significa algo del producto**:
 * dice hasta donde llegaste. Por eso entra escalonada, una etapa tras otra, en
 * vez de todas a la vez.
 *
 * ⚠️ **Se anima a mano y no con `initial`/`animate`, y esto costo encontrarlo.**
 * `PantallaConEntrada` envuelve el `<Outlet>` en un `AnimatePresence` con
 * `initial={false}` —para que la primera pantalla no entre deslizandose—, y esa
 * bandera **viaja por contexto a todos los `motion` que haya debajo**: la franja
 * no se dibujaba en la carga inicial, que es justo como casi todo el mundo ve la
 * portada. Al navegar dentro del portal si lo hacia, asi que el fallo solo se
 * veia entrando de cero.
 *
 * Es la misma leccion que las pantallas cronometradas: **una pieza no puede
 * depender de lo que decida su contenedor**. `animate()` imperativo no lee el
 * contexto de presencia, asi que la franja se dibuja siempre.
 */
export function FranjaQueSeLlena({
  orden,
  className,
}: {
  orden: number
  className?: string
}) {
  const quieto = useReducedMotion()
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const nodo = caja.current
    if (quieto || !nodo) return
    const control = animate(
      nodo,
      { scaleX: [0, 1] },
      { duration: 0.5, delay: 0.08 * orden, ease: SALIDA },
    )
    return () => control.stop()
  }, [quieto, orden])

  return (
    <div
      ref={caja}
      className={className}
      aria-hidden="true"
      /*
       * Empieza encogida para que no se vea entera un instante antes de que
       * arranque el efecto. Con el movimiento reducido nace a su ancho: no hay
       * nada que dibujar.
       */
      style={{ transformOrigin: 'left', transform: quieto ? 'none' : 'scaleX(0)' }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * D · La tarjeta que responde
 * ------------------------------------------------------------------ */

/**
 * Una superficie que se levanta al pasar por encima y se hunde al pulsarla.
 *
 * Con muelle y no con duracion: al pulsar y soltar rapido, una duracion fija
 * se siente pegajosa y el muelle no.
 */
export function TarjetaQueResponde({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const quieto = useReducedMotion()
  if (quieto) return <article className={className}>{children}</article>

  return (
    <motion.article
      className={className}
      whileHover={{ y: -4 }}
      whileTap={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {children}
    </motion.article>
  )
}
