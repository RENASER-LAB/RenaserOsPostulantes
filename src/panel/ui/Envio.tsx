/**
 * Lo que comparten los formularios del panel al enviar: un solo envío por clic,
 * el fallo del servidor a la vista y con el foco, y la sesión caducada dicha
 * sin perder lo escrito.
 *
 * ⚠️ **El foco se pierde al enviar, y no es un descuido de cada pantalla.** El
 * botón se desactiva mientras envía, y un botón desactivado suelta el foco: cae
 * en `<body>`, fuera del modal. Si el fallo aparece al pie de un cuerpo que
 * rueda, además queda debajo del pliegue y nadie lo ve. `AvisoDeFallo` toma el
 * foco al aparecer, y con él el navegador lo trae a la vista.
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { rutas } from '@/rutas'
import { ErrorApi } from '../api/cliente'

/**
 * El fallo de un formulario, anunciado y con el foco.
 *
 * El foco se toma **al montarse**, no en cada pintado: el formulario borra su
 * fallo al enviar y lo vuelve a poner si el servidor rechaza, así que cada
 * rechazo es un montaje nuevo; y mientras tanto escribir en un campo no le
 * roba el foco a nadie.
 */
export function AvisoDeFallo({ className, children }: { className?: string; children: ReactNode }) {
  const aviso = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = aviso.current
    if (!el) return
    el.focus()
    // `focus()` ya lo trae a la vista en los navegadores; jsdom no tiene esto.
    el.scrollIntoView?.({ block: 'nearest' })
  }, [])

  return (
    <p ref={aviso} className={className} role="alert" tabIndex={-1}>
      {children}
    </p>
  )
}

/**
 * Qué decir cuando el servidor rechaza un envío.
 *
 * Un 401 a mitad de un formulario no es un fallo del dato: la sesión caducó.
 * Se dice así, y se dice que lo escrito sigue ahí: el formulario retiene la
 * sesión (`useRetenerLaSesion`) para que el panel no salte a «Entrar» y lo tire.
 */
export function explicarFallo(causa: unknown, porDefecto: string): ReactNode {
  if (causa instanceof ErrorApi && causa.esSesionCaida) return <SesionCaducada />
  return causa instanceof Error ? causa.message : porDefecto
}

export function SesionCaducada() {
  return (
    <>
      Tu sesión caducó y esto no se guardó. Lo que escribiste sigue aquí:{' '}
      <a href={rutas.adminEntrar()} target="_blank" rel="noopener noreferrer">
        entra de nuevo en otra pestaña
      </a>{' '}
      y vuelve a guardar.
    </>
  )
}

/**
 * Un envío a la vez, marcado en el mismo clic.
 *
 * `isPending` de React Query llega al pintado siguiente: un doble clic lo lee
 * dos veces en falso y manda dos peticiones. Esto se marca antes de mandar la
 * primera y se suelta cuando termina, salga bien o mal.
 */
export function useUnaVez(): (enviar: () => Promise<unknown>) => void {
  const enCurso = useRef(false)
  return useCallback((enviar: () => Promise<unknown>) => {
    if (enCurso.current) return
    enCurso.current = true
    enviar()
      .catch(() => {
        // El fallo lo pinta el `onError` de la mutación; aquí solo se suelta.
      })
      .finally(() => {
        enCurso.current = false
      })
  }, [])
}
