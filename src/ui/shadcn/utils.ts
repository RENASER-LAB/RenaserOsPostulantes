/**
 * `cn`: junta clases y, si dos de Tailwind se pisan —`px-3` y `px-4`—, se
 * queda con la última. Es la pieza que usan todos los componentes de shadcn/ui
 * de esta carpeta para que quien los usa pueda cambiarles una clase sin pelear
 * con la de fábrica.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases))
}
