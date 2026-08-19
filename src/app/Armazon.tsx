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
import { useTema } from './Tema'

function ArribaAlCambiarDePagina() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export function Armazon() {
  const { hayCuenta, saludo } = useSesion()
  const { tema, alternar } = useTema()

  return (
    <div className="shell">
      <ArribaAlCambiarDePagina />

      <header className="header">
        <div className="header-inner">
          <Link className="brand" to={rutas.vacantes()}>
            <div className="brandmark">R</div>
            <div>
              <div className="brandname">RENASER</div>
              <span className="brandsub">Oportunidades profesionales</span>
            </div>
          </Link>

          <nav className="nav">
            <NavLink className="navlink desktop" to={rutas.vacantes()}>
              Vacantes
            </NavLink>
            <NavLink className="navlink" to={rutas.procesos()}>
              Mis procesos
            </NavLink>
            <button
              className="iconbtn"
              onClick={alternar}
              aria-label={tema === 'light' ? 'Usar tema oscuro' : 'Usar tema claro'}
            >
              {tema === 'light' ? '◐' : '☀'}
            </button>
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
          <span>© 2026 Renaser Consulting · Portal de empleo</span>
          <span>Privacidad · Tratamiento de datos · Ayuda</span>
        </div>
      </footer>
    </div>
  )
}
