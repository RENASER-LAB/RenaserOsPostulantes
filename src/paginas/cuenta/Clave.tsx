/**
 * La contraseña olvidada: pedir el enlace para elegir una nueva.
 *
 * Hasta septiembre de 2026 esta pantalla no restablecía nada —el backend no
 * tenía la ruta— y solo explicaba que se escribiera a talento. Ahora pide el
 * enlace de verdad (`POST /portal/auth/recuperacion`), que llega por correo y
 * lleva a `/restablecer`.
 *
 * La línea de talento **se queda, debajo, en los dos estados**: a una cuenta
 * creada por carga masiva de currículums —con un correo inventado— no le llega
 * ningún enlace, y el mensaje de enviado no puede decírselo sin revelar qué
 * correos tienen cuenta. Para esa persona, y para quien no reciba el correo,
 * escribir sigue siendo la salida.
 *
 * El formulario y su «enviado» son los mismos del panel: `ui/recuperacion`.
 */

import { Link } from 'react-router-dom'
import { pedirRecuperacion } from '@/api/portal'
import { rutas } from '@/rutas'
import { PedirEnlace } from '@/ui/recuperacion/PedirEnlace'
import estilos from './Cuenta.module.css'

const CORREO = 'talento@renaser.pe'

export function Clave() {
  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.ingresar()}>
        ← Volver a entrar
      </Link>

      <PedirEnlace
        pedir={pedirRecuperacion}
        titulo="Te ayudamos a entrar."
        bajada="Escribe el correo con el que creaste tu cuenta y te enviamos un enlace para elegir una contraseña nueva. Tu proceso sigue igual: no pierdes nada de lo que ya respondiste."
        alternativa={
          <p className={estilos.aparte}>
            ¿No te llega? Escríbenos a{' '}
            <a href={`mailto:${CORREO}?subject=No%20puedo%20entrar%20al%20portal`}>{CORREO}</a>
          </p>
        }
      />

      <p className={estilos.pie}>
        ¿Todavía no tienes cuenta? <Link to={rutas.registro()}>Créala aquí</Link>.
      </p>
    </div>
  )
}
