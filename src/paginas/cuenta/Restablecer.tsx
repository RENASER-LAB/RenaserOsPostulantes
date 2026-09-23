/**
 * Elegir la contraseña nueva, del lado del candidato.
 *
 * Llega aquí el enlace del correo de `/clave`: `/restablecer?token=…`. La
 * pantalla entera vive en `ui/recuperacion/ElegirClave`, que comparte con el
 * panel; aquí solo va lo del portal: el mínimo de 8, a dónde se vuelve a pedir
 * el enlace y a dónde se va al terminar.
 *
 * **No abre sesión.** Al guardar se va a `/ingresar` con el aviso encima, y si
 * en este navegador había una sesión abierta se cierra: quien acaba de cambiar
 * su contraseña entra con ella, no sigue dentro con la de antes.
 */

import { useNavigate } from 'react-router-dom'
import { restablecerClave } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { ESTADO_CLAVE_CAMBIADA } from '@/ui/recuperacion/AvisoClaveCambiada'
import { ElegirClave } from '@/ui/recuperacion/ElegirClave'
import estilos from './Cuenta.module.css'

export function Restablecer() {
  const navegar = useNavigate()
  const { hayCuenta, salir } = useSesion()

  return (
    <div className={estilos.pagina}>
      <ElegirClave
        minimo={8}
        ayuda="Al menos 8 caracteres, sin espacios al principio ni al final."
        restablecer={restablecerClave}
        rutaPedirEnlace={rutas.clave()}
        alCambiar={() => {
          if (hayCuenta) salir()
          navegar(rutas.ingresar(), { replace: true, state: ESTADO_CLAVE_CAMBIADA })
        }}
      />
    </div>
  )
}
