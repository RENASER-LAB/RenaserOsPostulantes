/**
 * Ingresar.
 *
 * En el mockup era un modal. Aqui es una pantalla con su direccion propia,
 * porque hay que poder mandar a alguien aqui desde un correo o desde una
 * pantalla privada que le pidio la sesion.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'

export function Ingresar() {
  const { entrar } = useSesion()
  const navegar = useNavigate()
  const avisar = useAviso()
  const [parametros] = useSearchParams()

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Si llegamos aqui desde una pantalla privada, volvemos a ella al entrar.
  const volverA = parametros.get('volverA') ?? rutas.procesos()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!correo.includes('@') || contrasena.length === 0) {
      setError('Escribe tu correo y tu contraseña.')
      return
    }

    setEnviando(true)
    try {
      await entrar({ correo: correo.trim(), contrasena })
      avisar('Bienvenido de vuelta.')
      navegar(volverA, { replace: true })
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No pudimos entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Acceso</div>
          <h1>Ingresa a tu cuenta.</h1>
          <p>Desde aquí ves el estado de todas tus postulaciones.</p>
        </div>
      </div>

      <form className="card form-card" onSubmit={enviar} noValidate>
        <div className="formgrid">
          <div className="field full">
            <label htmlFor="correo">Correo</label>
            <input
              id="correo"
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div className="field full">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              id="contrasena"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="row" style={{ marginTop: 20 }}>
          <span className="small">
            ¿Todavía no tienes cuenta? <Link className="link" to={rutas.registro()}>Créala aquí</Link>
          </span>
          <button className="btn primary large" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </>
  )
}
