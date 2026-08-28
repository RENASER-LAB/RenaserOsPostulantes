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
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { Campo } from '@/ui/campos/Campo'
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
    <div className={estilos.pagina}>
      <h1>Entra a tu proceso.</h1>

      {/*
        Sin caja alrededor y sin subtítulo encima: con un solo camino, el
        recuadro no separaba de nada y el «Con tu correo y contraseña» repetía
        lo que las dos etiquetas de debajo ya dicen. El titular nombra la
        pantalla y el formulario empieza en la línea siguiente.
      */}
      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        <Campo
          etiqueta="Correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={errores.contrasena}
        />

        {fallo && (
          <p className={estilos.falloEnvio} role="alert">
            {fallo}
          </p>
        )}

        <button type="submit" className={estilos.enviar} disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className={estilos.olvidada}>
        <Link to={rutas.clave()}>¿Olvidaste tu contraseña?</Link>
      </p>

      <p className={estilos.pie}>
        ¿Todavía no tienes cuenta?{' '}
        <Link to={vacante ? rutas.registro(vacante) : rutas.registro()}>Créala aquí</Link>.
      </p>
    </div>
  )
}
