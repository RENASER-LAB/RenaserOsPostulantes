/**
 * La sesión del panel (V64): quién entró, de qué empresa y qué puede hacer.
 *
 * Solo sirve para pintar el menú lateral. No es la defensa: cada endpoint sigue
 * respondiendo 403 y 404 como antes.
 */

import { pedir } from './cliente'
import type { SesionDelPanel } from './tiposPersonas'

export const verSesionDelPanel = () => pedir<SesionDelPanel>('/sesion')
