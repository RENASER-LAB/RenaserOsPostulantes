/**
 * La página web y las redes de una empresa (V85), como chips con su nombre:
 * «Página web», «Facebook», «Instagram», «LinkedIn», «TikTok», «YouTube».
 *
 * Todos abren en otra pestaña con `noopener noreferrer`, y **se vuelve a mirar
 * que sean http o https antes de pintarlos**, aunque el backend ya lo haya
 * exigido: si alguno no lo es, no se pinta.
 */

import type { RedPublica } from '@/api/tipos'
import { enlaceSeguro, nombreDeRed, REDES } from '@/dominio/presentacionEmpresa'
import { IconoDeRed } from '@/ui/Iconos'
import estilos from './Presentacion.module.css'

export interface EnlaceDeLaEmpresa {
  clave: string
  nombre: string
  href: string
}

/** La web primero y luego las redes en su orden; solo las que se pueden pintar. */
export function enlacesDeLaEmpresa(
  paginaWeb: string | null | undefined,
  redes: RedPublica[] | null | undefined,
): EnlaceDeLaEmpresa[] {
  const lista: EnlaceDeLaEmpresa[] = []
  const web = enlaceSeguro(paginaWeb)
  if (web) lista.push({ clave: 'WEB', nombre: 'Página web', href: web })
  for (const red of REDES) {
    const suya = (redes ?? []).find((r) => r.red === red.codigo)
    const href = enlaceSeguro(suya?.enlace)
    if (href) lista.push({ clave: red.codigo, nombre: nombreDeRed(red.codigo) ?? red.nombre, href })
  }
  return lista
}

export function EnlacesDeLaEmpresa({
  enlaces,
  className,
  etiqueta = 'Enlaces de la empresa',
}: {
  enlaces: EnlaceDeLaEmpresa[]
  className?: string
  etiqueta?: string
}) {
  if (enlaces.length === 0) return null
  return (
    <ul className={`${estilos.enlaces}${className ? ` ${className}` : ''}`} role="list" aria-label={etiqueta}>
      {enlaces.map((e) => (
        <li key={e.clave}>
          <a className={estilos.chip} href={e.href} target="_blank" rel="noopener noreferrer">
            <IconoDeRed red={e.clave} tamano={18} />
            {e.nombre}
          </a>
        </li>
      ))}
    </ul>
  )
}
