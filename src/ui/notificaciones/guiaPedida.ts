/**
 * Quién pide la guía de los avisos y quién la pinta (25/11/2026).
 *
 * La pide «Mis procesos» —es ahí donde sale, la primera vez que se entra con alguna
 * postulación— y la pinta la campana, que vive en la cabecera del armazón y es la que tiene
 * el botón, la tuerca y la ventana sobre los que se pone el foco. Son dos ramas del árbol que
 * no se ven, así que se hablan por aquí, como un interruptor con tres posiciones:
 *
 *   sin-pedir  todavía nadie la pidió en esta visita;
 *   pedida     «Mis procesos» dijo que toca y la campana la está enseñando;
 *   hecha      ya salió (o se saltó) en esta visita: no vuelve aunque llegue otra respuesta
 *              del servidor que todavía no lo sepa.
 *
 * Lo que dura entre visitas es `guiaVista`, en el servidor (V93); esto solo evita que salga
 * dos veces en la misma.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useNotificaciones } from './Ajustes'

type EstadoDeLaGuia = 'sin-pedir' | 'pedida' | 'hecha'

let estado: EstadoDeLaGuia = 'sin-pedir'
const oyentes = new Set<() => void>()

function cambiar(nuevo: EstadoDeLaGuia) {
  if (estado === nuevo) return
  estado = nuevo
  oyentes.forEach((oyente) => oyente())
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** «Mis procesos» pide la guía. Si ya salió en esta visita, no hace nada. */
export function pedirLaGuia() {
  if (estado === 'sin-pedir') cambiar('pedida')
}

/** La guía terminó (o se saltó): no vuelve en esta visita. */
export function guiaHecha() {
  cambiar('hecha')
}

/** Otra sesión empieza de cero: al salir de la cuenta, o entre pruebas. */
export function olvidarLaGuia() {
  cambiar('sin-pedir')
}

/** Si la guía está pedida y por enseñar. */
export function useGuiaPedida(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => estado === 'pedida',
    () => false,
  )
}

/**
 * Lo que hace «Mis procesos» al entrar: con alguna postulación y la guía sin ver en el
 * servidor, la pide. Se decide UNA vez por visita a la pantalla, con lo primero que llega:
 * lo que traiga después una ventana o un interruptor (que devuelven el estado entero) no la
 * vuelve a sacar.
 */
export function usePedirLaGuiaAlEntrar(hayPostulaciones: boolean) {
  const consulta = useNotificaciones(hayPostulaciones)
  const decidido = useRef(false)
  const datos = consulta.data
  useEffect(() => {
    if (decidido.current || !hayPostulaciones || !datos) return
    decidido.current = true
    // `=== false` y no `!`: contra un backend sin la V93 el campo falta, y entonces no sale.
    if (datos.guiaVista === false) pedirLaGuia()
  }, [hayPostulaciones, datos])
}
