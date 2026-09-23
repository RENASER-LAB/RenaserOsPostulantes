/**
 * Elegir la contraseña nueva del panel.
 *
 * Llega aquí el enlace del correo del equipo, siempre `/admin/restablecer`:
 * el backend añade el `/admin` si `renaser.panel.url` no lo lleva, porque
 * `/restablecer` a secas es la pantalla del candidato.
 *
 * ⚠️ **Fuera del armazón del panel**, como la invitación: el armazón manda a
 * entrar a quien no tiene sesión, y quien llega aquí es justo eso.
 *
 * El mínimo es 12, el mismo de la invitación. No abre sesión: al guardar va a
 * `/admin/entrar` con el aviso encima, y cierra la del panel si había una.
 */

import { useNavigate } from 'react-router-dom'
import { restablecerClavePanel } from '@/panel/api/panel'
import { rutas } from '@/rutas'
import { Marca } from '@/ui/Marca'
import { ESTADO_CLAVE_CAMBIADA } from '@/ui/recuperacion/AvisoClaveCambiada'
import { ElegirClave } from '@/ui/recuperacion/ElegirClave'
import { useSesionPanel } from '../Sesion'
import { useTituloDelPanel } from '../titulo'
import estilos from './Entrar.module.css'

export function RestablecerPanel() {
  useTituloDelPanel('Elegir contraseña nueva')
  const navegar = useNavigate()
  const { hayEquipo, salir } = useSesionPanel()

  return (
    <div className={estilos.pagina}>
      <span className={estilos.marca}>
        <Marca />
      </span>
      <ElegirClave
        minimo={12}
        ayuda="Al menos 12 caracteres, sin espacios al principio ni al final. Es más que en el portal del candidato porque desde aquí se ven los datos de muchas personas."
        restablecer={restablecerClavePanel}
        rutaPedirEnlace={rutas.adminClave()}
        alCambiar={() => {
          if (hayEquipo) salir()
          navegar(rutas.adminEntrar(), { replace: true, state: ESTADO_CLAVE_CAMBIADA })
        }}
      />
    </div>
  )
}
