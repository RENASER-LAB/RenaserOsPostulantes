/**
 * Claro y oscuro.
 *
 * El tema es un atributo en la etiqueta <html>. Ninguna regla de CSS necesita
 * saber cual esta puesto: `variables.css` redefine los colores y ya.
 */

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

const CLAVE = 'renaser_portal_tema'

export type Tema = 'light' | 'dark'

interface ControlTema {
  tema: Tema
  alternar: () => void
}

const Contexto = createContext<ControlTema | null>(null)

function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'light' || guardado === 'dark') return guardado
  } catch {
    /* almacenamiento bloqueado */
  }
  // Sin eleccion previa se respeta lo que pide el sistema.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    try {
      localStorage.setItem(CLAVE, tema)
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [tema])

  const alternar = useCallback(() => {
    setTema((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar])

  return <Contexto value={valor}>{children}</Contexto>
}

export function useTema(): ControlTema {
  const control = use(Contexto)
  if (!control) throw new Error('useTema necesita estar dentro de <ProveedorTema>')
  return control
}
