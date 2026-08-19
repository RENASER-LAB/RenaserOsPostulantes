/**
 * Crear cuenta.
 *
 * Dos cosas que el mockup hacia mal y aqui se corrigen:
 *   - el backend pide nombre y apellidos por separado,
 *   - son dos consentimientos distintos, no uno. Aceptar el proceso es
 *     obligatorio; entrar al Radar de Talento es opcional y se puede retirar
 *     despues sin tocar la postulacion.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { textosConsentimiento } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Modal } from '@/ui/Modal'

export function Registro() {
  const { registrar } = useSesion()
  const navegar = useNavigate()
  const avisar = useAviso()
  const [parametros] = useSearchParams()
  const vacanteId = parametros.get('vacante')

  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [repetida, setRepetida] = useState('')
  const [aceptaProceso, setAceptaProceso] = useState(false)
  const [aceptaFuturos, setAceptaFuturos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [verPolitica, setVerPolitica] = useState(false)

  const politica = useQuery({
    queryKey: ['consentimientos'],
    queryFn: textosConsentimiento,
    enabled: verPolitica,
  })

  function validar(): string | null {
    if (!nombre.trim() || !apellidos.trim()) return 'Escribe tu nombre y tus apellidos.'
    if (!correo.includes('@')) return 'Escribe un correo válido.'
    if (contrasena.length < 8) return 'La contraseña necesita al menos 8 caracteres.'
    if (contrasena !== repetida) return 'Las dos contraseñas no coinciden.'
    if (!aceptaProceso) return 'Necesitamos tu consentimiento para evaluar la postulación.'
    return null
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const fallo = validar()
    setError(fallo)
    if (fallo) return

    setEnviando(true)
    try {
      await registrar({
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim(),
        contrasena,
        aceptaProceso: true,
        aceptaFuturosContactos: aceptaFuturos,
      })
      avisar('Cuenta creada.')
      navegar(vacanteId ? rutas.postular(vacanteId) : rutas.procesos(), { replace: true })
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos crear la cuenta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {vacanteId && (
        <Link className="back" to={rutas.vacante(vacanteId)}>
          ← Volver a la vacante
        </Link>
      )}

      <div className="pagehead">
        <div>
          <div className="eyebrow">Crear cuenta</div>
          <h1>Empieza tu postulación.</h1>
          <p>
            Tu cuenta te permitirá guardar avances y consultar el estado de todas tus
            postulaciones.
          </p>
        </div>
      </div>

      <form className="card form-card" onSubmit={enviar} noValidate>
        <div className="formgrid">
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              autoComplete="given-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="apellidos">Apellidos</label>
            <input
              id="apellidos"
              autoComplete="family-name"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
            />
          </div>
          <div className="field full">
            <label htmlFor="correo-nuevo">Correo</label>
            <input
              id="correo-nuevo"
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              type="password"
              autoComplete="new-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
            <div className="hint">Usa al menos 8 caracteres.</div>
          </div>
          <div className="field">
            <label htmlFor="clave2">Repite la contraseña</label>
            <input
              id="clave2"
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </div>

          <div className="field full">
            <div className="stack">
              <div className="consent">
                <input
                  id="acepta-proceso"
                  type="checkbox"
                  checked={aceptaProceso}
                  onChange={(e) => setAceptaProceso(e.target.checked)}
                />
                <div>
                  <b>
                    <label htmlFor="acepta-proceso">
                      Acepto el tratamiento de mis datos personales
                    </label>
                  </b>
                  <p>
                    Mis datos se usarán para evaluar esta postulación. Entiendo que una
                    inteligencia artificial participa en la evaluación y que mis datos
                    pueden almacenarse fuera del Perú.
                  </p>
                  <button
                    className="link"
                    type="button"
                    onClick={() => setVerPolitica(true)}
                  >
                    Leer política completa
                  </button>
                </div>
              </div>

              <div className="consent">
                <input
                  id="acepta-futuros"
                  type="checkbox"
                  checked={aceptaFuturos}
                  onChange={(e) => setAceptaFuturos(e.target.checked)}
                />
                <div>
                  <b>
                    <label htmlFor="acepta-futuros">
                      Quiero que me consideren para futuras convocatorias
                    </label>
                  </b>
                  <p>
                    Opcional. Si no continúas en esta vacante, tu perfil puede tenerse en
                    cuenta para otras. Puedes retirarlo cuando quieras sin que afecte a
                    esta postulación.
                  </p>
                </div>
              </div>
            </div>

            {error && <div className="error">{error}</div>}
          </div>
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <span className="small">
            ¿Ya tienes cuenta? <Link className="link" to={rutas.ingresar()}>Ingresa aquí</Link>
          </span>
          <button className="btn primary large" type="submit" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear cuenta y continuar'}
          </button>
        </div>
      </form>

      <Modal
        abierto={verPolitica}
        titulo="Tratamiento de datos"
        onCerrar={() => setVerPolitica(false)}
      >
        {politica.isPending && <p className="small">Cargando el texto vigente…</p>}
        {politica.isError && (
          <p className="small">No pudimos cargar el texto. Inténtalo de nuevo.</p>
        )}
        <div className="stack">
          {politica.data?.map((t) => (
            <div className="callout" key={`${t.tipo}-${t.version}`}>
              <b>
                {t.tipo} · versión {t.version}
              </b>
              <p style={{ whiteSpace: 'pre-wrap' }}>{t.texto}</p>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
