/**
 * La contraseña olvidada.
 *
 * ⚠️ **Esta pantalla no restablece nada, y lo dice.** No hay ruta en el backend
 * para pedir un restablecimiento, asi que fingir un formulario de «escribe tu
 * correo y te mandamos un enlace» seria prometer un correo que nadie va a
 * mandar — y el transporte de correo esta en modo registro por defecto, asi que
 * ni siquiera saldria.
 *
 * Existe porque el agujero era peor que la pantalla: quien se registro con
 * contraseña y la olvida **se queda fuera de un proceso de semanas sin ninguna
 * salida dentro del producto**, con una evaluacion abierta y catorce dias de
 * plazo corriendo. Que la unica via sea escribir a una direccion es poco; que
 * no haya ni direccion es perder una oportunidad de trabajo por la interfaz.
 *
 * Lo que hace falta para que esto deje de ser una pantalla de disculpa:
 *
 *   POST /portal/auth/recuperacion  { correo }  → manda el mismo enlace de
 *   entrada que ya canjea `POST /portal/auth/acceso`. La via tecnica esta
 *   construida entera; solo le falta quien la dispare.
 */

import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import estilos from './Cuenta.module.css'

const CORREO = 'talento@renaser.pe'

export function Clave() {
  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.ingresar()}>
        ← Volver a entrar
      </Link>

      <h1>Te ayudamos a entrar.</h1>
      <p className={estilos.bajada}>
        Todavía no podemos restablecer una contraseña desde aquí. Pero hay dos formas de
        que vuelvas a tu proceso hoy mismo, y ninguna te hace empezar de cero.
      </p>

      <div className={estilos.caminos}>
        <section className={estilos.camino}>
          <h2 className={estilos.tituloCamino}>Busca el enlace en tu correo</h2>
          <p className={estilos.queEs}>
            Cada aviso que te mandamos trae un enlace que te mete directo, <b>sin pedirte
            la contraseña</b>. Si tienes cualquiera de esos correos a mano, ese enlace
            sigue siendo la vía más rápida.
          </p>
        </section>

        <section className={estilos.camino}>
          <h2 className={estilos.tituloCamino}>O escríbenos</h2>
          <p className={estilos.queEs}>
            Dinos desde qué correo postulaste y te mandamos un enlace nuevo. Contesta una
            persona, así que no es inmediato, pero <b>tu proceso no se cierra mientras
            tanto</b> y no pierdes nada de lo que ya respondiste.
          </p>
          <a className={estilos.enviar} href={`mailto:${CORREO}?subject=No%20puedo%20entrar%20al%20portal`}>
            Escribir a {CORREO}
          </a>
        </section>
      </div>

      <p className={estilos.pie}>
        ¿Todavía no tienes cuenta? <Link to={rutas.registro()}>Créala aquí</Link>.
      </p>
    </div>
  )
}
