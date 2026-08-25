/**
 * Entrar al panel del equipo.
 *
 * Es el login de desarrollo del backend: un identificador de RENASER OS y ya.
 * No hay contraseña porque la identidad la emitira RENASER OS cuando exista el
 * contrato; mientras tanto el backend lo deja pasar solo si
 * `app.seguridad.dev-login-activo` esta encendido, y en produccion se apaga.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { rutas } from '@/rutas'
import { useSesionPanel } from '../Sesion'
import estilos from './Entrar.module.css'

export function EntrarPanel() {
  const { entrar } = useSesionPanel()
  const navegar = useNavigate()
  const [id, setId] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (id.trim() === '') {
      setFallo('Escribe tu identificador de RENASER OS.')
      return
    }
    setEntrando(true)
    setFallo(null)
    try {
      await entrar(id.trim())
      navegar(rutas.adminVacantes(), { replace: true })
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : 'No pudimos entrar.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className={estilos.pagina}>
      <h1>Panel del equipo.</h1>
      <p className={estilos.bajada}>
        Aquí se gestionan las vacantes, las sesiones de simulación y la configuración del
        proceso. Es la entrada del equipo, no la de quien postula.
      </p>

      <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
        <div className={estilos.campo}>
          <label className={estilos.etiqueta} htmlFor="id-equipo">
            Tu identificador de RENASER OS
          </label>
          <input
            className={estilos.entrada}
            id="id-equipo"
            type="text"
            autoComplete="username"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </div>

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}

        <button className={estilos.enviar} type="submit" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar al panel'}
        </button>
      </form>

      <p className={estilos.aparte}>
        Mientras el panel no está integrado con RENASER OS, esta entrada usa el acceso de
        desarrollo del backend. En producción se apaga.
      </p>
    </div>
  )
}
