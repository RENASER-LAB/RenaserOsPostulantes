/**
 * Entrar.
 *
 * Un solo formulario: correo y contraseña.
 *
 * ⚠️ **El enlace del correo sigue funcionando; lo que se quitó es explicarlo.**
 * Esta pantalla tenía un segundo bloque —«Con el enlace que te enviamos»— y se
 * retiró por decisión del cliente. El mecanismo no se tocó: `/acceso` canjea el
 * token igual que antes, y quien llega por ese enlace entra sin pasar por aquí.
 * Lo que ya no ocurre es que alguien que llegó por esa vía y aterrizó en esta
 * pantalla se entere de dónde buscar su correo.
 *
 * Al volver de `/restablecer` con la contraseña cambiada, el aviso va encima
 * del formulario (`AvisoClaveCambiada`) y el foco se posa en él.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { Campo } from '@/ui/campos/Campo'
import { IconoAviso } from '@/ui/Iconos'
import { AvisoClaveCambiada } from '@/ui/recuperacion/AvisoClaveCambiada'
import estilos from './Cuenta.module.css'

const Datos = z.object({
  correo: z.string().min(1, 'Escribe tu correo.').email('Esto no parece un correo.'),
  contrasena: z.string().min(1, 'Escribe tu contraseña.'),
})

export function Ingresar() {
  const { entrar } = useSesion()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const vacante = params.get('vacante')

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [errores, setErrores] = useState<{ correo?: string; contrasena?: string }>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)

    const revision = Datos.safeParse({ correo, contrasena })
    if (!revision.success) {
      const nuevos: { correo?: string; contrasena?: string } = {}
      for (const problema of revision.error.issues) {
        const campo = problema.path[0]
        if (campo === 'correo' || campo === 'contrasena') nuevos[campo] ??= problema.message
      }
      setErrores(nuevos)
      // El primer campo con problema recibe el foco: si no, en un formulario
      // largo el error queda fuera de la pantalla y parece que no pasó nada.
      requestAnimationFrame(() => {
        const primero = document.querySelector<HTMLElement>('[aria-invalid="true"]')
        primero?.focus()
      })
      return
    }

    setErrores({})
    setEntrando(true)
    try {
      await entrar(revision.data)
      // Si venía de una vacante, se sigue con su postulación en vez de dejarlo
      // en la portada buscándola otra vez.
      navegar(vacante ? rutas.postular(vacante) : rutas.procesos())
    } catch (causa) {
      setFallo(
        causa instanceof Error
          ? causa.message
          : 'No pudimos entrar. Vuelve a intentarlo en un momento.',
      )
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className={estilos.paginaEntrar}>
      {/*
        Todo dentro de la tarjeta, incluida la salida a crear cuenta: con el
        boton de contorno fuera, la tarjeta terminaba en el boton negro y el otro
        quedaba flotando debajo sin pertenecer a nada.
      */}
      <div className={estilos.tarjetaEntrar}>
        <h1 className={estilos.titularEntrar}>Entra a tu proceso.</h1>
        <p className={estilos.bajadaEntrar}>Sigue donde lo dejaste.</p>

        {/*
          «✓ Contraseña cambiada exitosamente», al volver de `/restablecer`.

          Va DENTRO de la tarjeta y no encima de ella, que es donde nacio: aqui
          la tarjeta es la pantalla entera, y un aviso flotando fuera se lee como
          de otro sitio. Se protege solo —sin el estado de navegacion devuelve
          `null`—, asi que no hace falta envolverlo.
        */}
        <AvisoClaveCambiada />

        {/*
          El error va ARRIBA del formulario y no pegado al boton.

          Lo que falla aqui no es un campo suelto —el servidor no dice cual de los
          dos—, asi que no puede colgar de ninguno; y al pie solo se ve despues de
          haber vuelto a mirar el formulario entero. Arriba se lee al volver del
          envio, que es cuando aparece.
        */}
        {fallo && (
          <p className={estilos.falloEntrar} role="alert">
            <IconoAviso tamano={18} />
            {fallo}
          </p>
        )}

        <form className={estilos.formularioEntrar} onSubmit={enviar} noValidate>
          <Campo
            etiqueta="Correo"
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={errores.correo}
          />

          <div className={estilos.grupoClave}>
            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              error={errores.contrasena}
            />
            {/*
              Pegada a su campo: quien la necesita esta mirando la contraseña.
            */}
            <p className={estilos.olvidadaEntrar}>
              ¿Olvidaste tu contraseña?{' '}
              {/*
                El rotulo visible es corto porque la frase de al lado ya da el
                contexto, pero un lector de pantalla lee los enlaces en lista y
                fuera de ella «Restablecer» no dice de que. El nombre accesible se
                sostiene solo; el visible se queda como en la referencia.
              */}
              <Link to={rutas.clave()} aria-label="Restablecer tu contraseña">
                Restablecer
              </Link>
            </p>
          </div>

          <button
            type="submit"
            className={estilos.enviarEntrar}
            disabled={entrando}
            data-rotulo={entrando ? 'Entrando…' : 'Entrar'}
          >
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {/*
          Crear cuenta deja de ser un enlace en una frase y pasa a ser un boton de
          contorno, separado por una regla que lo nombra.

          No compiten: el negro es la accion de esta pantalla y el contorno es la
          salida para quien no puede hacerla. La regla con texto en medio dice que
          empieza otra cosa, que es lo que un enlace suelto no decia.
        */}
        <div className={estilos.separador}>
          <span>¿Todavía no tienes cuenta?</span>
        </div>

        <Link
          className={estilos.crearCuenta}
          to={vacante ? rutas.registro(vacante) : rutas.registro()}
          data-rotulo="Crear cuenta"
        >
          Crear cuenta
        </Link>
      </div>
    </div>
  )
}
