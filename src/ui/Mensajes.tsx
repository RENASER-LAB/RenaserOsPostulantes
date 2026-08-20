/** Las pantallas de relleno: cargando, algo falló, y no hay nada que enseñar. */

import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import { Marca } from './Marca'

export function Cargando({ que = 'Cargando…' }: { que?: string }) {
  return (
    <div className="card center-card" aria-busy="true">
      <div className="status-icon">…</div>
      <p>{que}</p>
    </div>
  )
}

export function Fallo({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const mensaje =
    error instanceof Error ? error.message : 'No se pudo completar la operación.'
  return (
    <div className="card center-card">
      <div className="status-icon">!</div>
      <div className="eyebrow">Algo salió mal</div>
      <h1>No pudimos cargar esto.</h1>
      <p>{mensaje}</p>
      {reintentar && (
        <div className="row" style={{ marginTop: 22 }}>
          <span />
          <button className="btn primary" onClick={reintentar}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}

/** Lo que ve quien intenta abrir una pantalla privada sin cuenta. */
export function AccesoNecesario() {
  return (
    <div className="card center-card">
      <span className="vacio-marca" aria-hidden="true">
        <Marca tamano={30} acento />
      </span>
      <div className="eyebrow">Acceso necesario</div>
      <h1>Ingresa para ver tu proceso.</h1>
      <p>
        Las evaluaciones y el estado de las postulaciones solo están disponibles dentro
        de tu cuenta.
      </p>
      <div className="row" style={{ marginTop: 22 }}>
        <Link className="link" to={rutas.vacantes()}>
          Ver vacantes
        </Link>
        <Link className="btn primary large" to={rutas.ingresar()}>
          Ingresar
        </Link>
      </div>
    </div>
  )
}
