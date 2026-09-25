/**
 * La contraseña olvidada del panel: pedir el enlace para elegir una nueva.
 *
 * Es el mismo formulario del portal (`ui/recuperacion/PedirEnlace`) sin la
 * línea de talento: el equipo no escribe a talento, y quien no recibe el
 * correo —o tiene la cuenta desactivada— sigue teniendo la salida de siempre,
 * que su administrador lo invite de nuevo.
 *
 * Si el correo tiene cuenta en más de una empresa llega un enlace por cada
 * una, y cada correo dice de qué empresa es. La pantalla no lo sabe ni lo dice:
 * decirlo sería contar que la cuenta existe.
 */

import { Link } from 'react-router-dom'
import { pedirRecuperacionPanel } from '@/panel/api/panel'
import { rutas } from '@/rutas'
import { PedirEnlace } from '@/ui/recuperacion/PedirEnlace'
import { useTituloDelPanel } from '../titulo'
import estilos from './Entrar.module.css'

export function ClavePanel() {
  useTituloDelPanel('Recuperar la contraseña')

  return (
    <div className={estilos.pagina}>
      {/* La marca la pone ahora la cabecera del portal, que envuelve esta
          pantalla desde el 24/09/2026. Repetirla aquí ponía dos EX seguidas. */}
      <div className={estilos.vuelta}>
        <Link className={estilos.volver} to={rutas.adminEntrar()}>
          ← Volver a entrar
        </Link>
      </div>

      <PedirEnlace
        pedir={pedirRecuperacionPanel}
        titulo="Recupera tu acceso al panel."
        bajada="Escribe el correo de tu cuenta del panel y te enviamos un enlace para elegir una contraseña nueva."
        claseFormulario={estilos.superficieDelFormulario}
      />

      <section className={estilos.camino}>
        <h2 className={estilos.tituloCamino}>Si el correo no llega</h2>
        <p className={estilos.queEs}>
          Espera un minuto y pide otro. Si sigue sin llegar, pídele a quien administra tu
          equipo que te invite de nuevo: la invitación también te deja poner una contraseña.
        </p>
      </section>
    </div>
  )
}
