/** El aviso flotante de abajo a la derecha. Dura 2,5 segundos. */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import estilos from './Avisos.module.css'

const DURACION = 2500

const Contexto = createContext<((mensaje: string) => void) | null>(null)

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null)
  const temporizador = useRef<number | undefined>(undefined)

  const avisar = useCallback((texto: string) => {
    setMensaje(texto)
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => setMensaje(null), DURACION)
  }, [])

  // Aqui el efecto si devuelve una funcion, y es a proposito: es la limpieza
  // que corta el temporizador si el portal se desmonta con un aviso en pantalla.
  useEffect(() => {
    return () => window.clearTimeout(temporizador.current)
  }, [])

  const valor = useMemo(() => avisar, [avisar])

  return (
    <Contexto value={valor}>
      {children}
      <div
        className={`${estilos.aviso}${mensaje ? ` ${estilos.visible}` : ''}`}
        role="status"
        aria-live="polite"
      >
        {mensaje}
      </div>
    </Contexto>
  )
}

export function useAviso(): (mensaje: string) => void {
  const avisar = use(Contexto)
  if (!avisar) throw new Error('useAviso necesita estar dentro de <ProveedorAvisos>')
  return avisar
}
