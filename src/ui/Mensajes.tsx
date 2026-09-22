/** Las pantallas de relleno: cargando, algo falló, y hace falta cuenta. */

import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import { Marca } from './Marca'
import estilos from './Estados.module.css'

export function Cargando({ que = 'Cargando…' }: { que?: string }) {
  return (
    <div className={estilos.marco} aria-busy="true">
      <p className={estilos.texto} style={{ marginTop: 0 }}>
        {que}
      </p>
      <div className={`${estilos.barra} ${estilos.barraLarga}`} />
      <div className={`${estilos.barra} ${estilos.barraCorta}`} />
    </div>
  )
}

export function Fallo({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const mensaje =
    error instanceof Error ? error.message : 'No se pudo completar la operación.'
  return (
    <div className={estilos.marco}>
      <span className={estilos.eti}>Algo salió mal</span>
      <h1 className={estilos.titulo}>No pudimos cargar esto.</h1>
      <p className={estilos.texto}>{mensaje}</p>
      {reintentar && (
        <div className={estilos.botones}>
          <button className={estilos.secundario} type="button" onClick={reintentar}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Lo que ve quien llega a su proceso —o a una de sus pantallas: la prueba, la
 * evaluación, la simulación— cuando la empresa ya retiró la vacante.
 *
 * No es una avería y no se ofrece reintentar: sería mandarlo a chocar contra la
 * misma puerta. Se le dice lo que pasó y se le lleva a su lista, que es lo único
 * que puede hacer. Sin acento: no le toca hacer nada.
 */
export function VacanteRetirada() {
  return (
    <div className={estilos.marco}>
      <span className={estilos.eti}>Proceso cerrado</span>
      <h1 className={estilos.titulo}>Esta vacante ya no está disponible.</h1>
      <p className={estilos.texto}>
        La empresa la retiró, así que su proceso dejó de verse aquí. No tienes que hacer
        nada.
      </p>
      <div className={estilos.botones}>
        <Link className={estilos.secundario} to={rutas.procesos()}>
          Ver mis procesos
        </Link>
      </div>
    </div>
  )
}

/** Lo que ve quien intenta abrir una pantalla privada sin cuenta. */
export function AccesoNecesario() {
  return (
    <div className={estilos.marco}>
      <span className={estilos.hormiga} aria-hidden="true">
        <Marca tamano={30} />
      </span>
      <span className={estilos.eti}>Acceso necesario</span>
      <h1 className={estilos.titulo}>Ingresa para ver tu proceso.</h1>
      <p className={estilos.texto}>
        Las evaluaciones y el estado de las postulaciones solo están disponibles dentro
        de tu cuenta.
      </p>
      <div className={estilos.botones}>
        <Link className={estilos.principal} to={rutas.ingresar()}>
          Ingresar
        </Link>
        <Link to={rutas.vacantes()}>Ver vacantes</Link>
      </div>
    </div>
  )
}
