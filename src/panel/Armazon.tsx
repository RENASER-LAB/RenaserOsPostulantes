/**
 * El armazon del panel: cabecera con las tres pestañas, y el candado.
 *
 * Si no hay sesion de equipo, cualquier ruta del panel lleva a entrar. El
 * candado vive aqui y no en cada pagina para que añadir una pantalla nueva no
 * pueda olvidarselo.
 */

import { useEffect } from 'react'
import { Link, Navigate, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom'
import { patrones, rutas } from '@/rutas'
import { Marca } from '@/ui/Marca'
import { useSesionPanel } from './Sesion'
import estilos from './Armazon.module.css'

const TITULOS: Array<[string, string]> = [
  [patrones.adminVacantes, 'Vacantes · Panel'],
  [patrones.adminVacante, 'Vacante · Panel'],
  [patrones.adminPruebaTecnica, 'Prueba técnica · Panel'],
  [patrones.adminSesiones, 'Simulación · Panel'],
  [patrones.adminPruebas, 'Pruebas del puesto · Panel'],
  [patrones.adminComponerPrueba, 'Componer una prueba · Panel'],
  [patrones.adminConfiguracion, 'Configuración · Panel'],
]

function TituloDelPanel() {
  const { pathname } = useLocation()

  useEffect(() => {
    const encontrado = TITULOS.find(([patron]) => matchPath(patron, pathname))
    document.title = encontrado ? `${encontrado[1]} · EX` : 'Panel · EX'
  }, [pathname])

  return null
}

function claseDelEnlace({ isActive }: { isActive: boolean }) {
  return isActive ? `${estilos.enlace} ${estilos.enlaceActivo}` : estilos.enlace
}

export function ArmazonPanel() {
  const { hayEquipo, salir } = useSesionPanel()

  if (!hayEquipo) return <Navigate to={rutas.adminEntrar()} replace />

  return (
    <div className={estilos.armazon}>
      <TituloDelPanel />

      <header className={estilos.cabecera}>
        <div className={estilos.cabeceraDentro}>
          <Link className={estilos.marca} to={rutas.adminVacantes()} aria-label="Panel del equipo, inicio">
            <Marca tamano={22} />
            {/* La palabra distingue este lado del portal del candidato: mismo
                mundo visual, otra persona delante. */}
            <span className={estilos.quienEs}>Panel del equipo</span>
          </Link>

          <nav className={estilos.navegacion}>
            <NavLink className={claseDelEnlace} to={rutas.adminVacantes()} end>
              Vacantes
            </NavLink>
            <NavLink className={claseDelEnlace} to={rutas.adminSesiones()}>
              Simulación
            </NavLink>
            <NavLink className={claseDelEnlace} to={rutas.adminPruebas()}>
              Pruebas
            </NavLink>
            <NavLink className={claseDelEnlace} to={rutas.adminConfiguracion()}>
              Configuración
            </NavLink>
            <button className={estilos.salir} type="button" onClick={salir}>
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className={estilos.principal}>
        <Outlet />
      </main>
    </div>
  )
}
