/**
 * Lo que no cambia al navegar: la cabecera, el hueco de la pagina y el pie.
 *
 * En el mockup el boton de cuenta hacia dos cosas segun hubiera sesion o no.
 * Aqui se mantiene: sin cuenta lleva a ingresar, con cuenta abre privacidad.
 */

import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { rutas } from '@/rutas'
import { useSesion } from './Sesion'
import { Marca } from '@/ui/Marca'

function ArribaAlCambiarDePagina() {
  const { pathname } = useLocation()

  // Ojo con el cuerpo entre llaves: si se escribe `useEffect(() => window.
  // scrollTo(0, 0), ...)`, el efecto devuelve lo que devuelva `scrollTo`, y
  // React se lo queda como funcion de limpieza. Al desmontar intenta llamarlo
  // y revienta con «destroy is not a function», tumbando la pagina entera.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export function Armazon() {
  const { hayCuenta, saludo } = useSesion()

  return (
    <div className="shell">
      <ArribaAlCambiarDePagina />

      <header className="header">
        <div className="header-inner">
          <Link className="brand" to={rutas.vacantes()}>
            <Marca />
            <span className="brandsub">un producto de Renaser</span>
          </Link>

          <nav className="nav">
            <NavLink className="navlink desktop" to={rutas.vacantes()}>
              Vacantes
            </NavLink>
            <NavLink className="navlink" to={rutas.procesos()}>
              Mis procesos
            </NavLink>
            {hayCuenta ? (
              <Link className="btn" to={rutas.privacidad()}>
                {saludo ?? 'Mi cuenta'}
              </Link>
            ) : (
              <Link className="btn" to={rutas.ingresar()}>
                Ingresar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-marca">
            <Marca tamano={15} acento />
            © 2026 Renaser Consulting · Portal de empleo
          </span>
          <span>Privacidad · Tratamiento de datos · Ayuda</span>
        </div>
      </footer>
    </div>
  )
}
