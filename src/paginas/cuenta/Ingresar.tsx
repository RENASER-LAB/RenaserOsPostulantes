/**
 * Entrar.
 *
 * **Hay dos caminos y los dos son normales**, no uno principal y una excepción:
 *
 *   - Correo y contraseña, para quien se registró en el portal.
 *   - **El enlace del correo, sin contraseña**, para quien llegó por una carpeta
 *     de currículums y no tiene cuenta que recordar. Es la vía de toda una tanda
 *     de candidatos, así que aparece en la pantalla, no escondida en un pie.
 *
 * Del segundo camino no hay formulario que enseñar: el enlace se canjea solo al
 * abrirlo. Lo que se puede hacer aquí es decirle dónde buscarlo.
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
      <p className={estilos.bajada}>
        Hay dos formas de entrar, según cómo llegó tu candidatura hasta nosotros.
      </p>

      <div className={estilos.caminos}>
        <section className={estilos.camino}>
          <h2 className={estilos.tituloCamino}>Con tu correo y contraseña</h2>
          <p className={estilos.queEs}>Si creaste tu cuenta en este portal.</p>

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
        </section>

        <section className={estilos.camino}>
          <h2 className={estilos.tituloCamino}>Con el enlace que te enviamos</h2>
          <p className={estilos.queEs}>
            Si tu currículum nos llegó por otra vía, <b>no tienes contraseña</b> y no hace
            falta que crees una: el correo que te mandamos trae un enlace que te mete
            directo.
          </p>
          <div className={estilos.pista}>
            Búscalo por el asunto <span className={estilos.asunto}>«Tu postulación
            avanza»</span> o <span className={estilos.asunto}>«Tu prueba está
            disponible»</span>. Dentro está el botón para entrar.
          </div>
        </section>
      </div>

      <p className={estilos.pie}>
        ¿Todavía no tienes cuenta?{' '}
        <Link to={vacante ? rutas.registro(vacante) : rutas.registro()}>Créala aquí</Link>.
      </p>
    </div>
  )
}
