/**
 * Lo que no cambia al navegar: la cabecera, el hueco de la pagina y el pie.
 *
 * La cabecera es deliberadamente fina. La pantalla es del candidato y de su
 * proceso; el portal solo tiene que estar ahi para volver.
 */

import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { patrones, rutas } from '@/rutas'
import { useSesion } from './Sesion'
import { Marca } from '@/ui/Marca'
import estilos from './Armazon.module.css'

/**
 * El titulo de la pestaña, por pantalla.
 *
 * Las veintidos combinaciones de ruta compartian `EX · Empleos en Renaser`, y
 * eso es un incumplimiento de WCAG 2.4.2, nivel A: quien navega con lector de
 * pantalla no recibe confirmacion de haber cambiado de pantalla, y quien tiene
 * varias pestañas abiertas —muy probable en alguien postulando a varios sitios—
 * no distingue la suya.
 *
 * No lleva el nombre de la vacante ni el de la postulacion: esos los sabe la
 * pantalla, no el armazon, y un titulo generico correcto vale mas que uno
 * especifico que a veces llega tarde.
 */
const TITULOS: Array<[string, string]> = [
  [patrones.vacantes, 'Vacantes abiertas'],
  [patrones.vacante, 'Detalle de la vacante'],
  [patrones.postular, 'Postular'],
  [patrones.ingresar, 'Entrar'],
  [patrones.acceso, 'Entrando'],
  [patrones.registro, 'Crear cuenta'],
  [patrones.clave, 'No puedo entrar'],
  [patrones.perfil, 'Tu perfil'],
  [patrones.procesos, 'Mis procesos'],
  [patrones.proceso, 'Mi proceso'],
  [patrones.evaluacion, 'Evaluación'],
  [patrones.prueba, 'La prueba del puesto'],
  [patrones.simulacion, 'Simulación de trabajo'],
  [patrones.validacion, 'Validación práctica'],
  [patrones.decision, 'Decisión'],
  [patrones.privacidad, 'Privacidad y control'],
  [patrones.politica, 'Política de privacidad'],
]

function TituloDeLaPagina() {
  const { pathname } = useLocation()

  useEffect(() => {
    const encontrado = TITULOS.find(([patron]) => matchPath(patron, pathname))
    document.title = encontrado ? `${encontrado[1]} · EX` : 'EX · Empleos en Renaser'
  }, [pathname])

  return null
}

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

function claseDelEnlace({ isActive }: { isActive: boolean }) {
  return isActive ? `${estilos.enlace} ${estilos.enlaceActivo}` : estilos.enlace
}

export function Armazon() {
  const { hayCuenta } = useSesion()

  return (
    <div className={estilos.armazon}>
      <ArribaAlCambiarDePagina />
      <TituloDeLaPagina />

      <header className={estilos.cabecera}>
        <div className={estilos.cabeceraDentro}>
          <Link className={estilos.marca} to={rutas.vacantes()} aria-label="EX, inicio">
            <Marca tamano={22} />
          </Link>

          <nav className={estilos.navegacion}>
            <NavLink className={claseDelEnlace} to={rutas.vacantes()} end>
              Vacantes
            </NavLink>
            <NavLink className={claseDelEnlace} to={rutas.procesos()}>
              Mis procesos
            </NavLink>
            {/*
              Con cuenta, «Mi cuenta» lleva al perfil y no a privacidad: aquella
              es la pantalla de retirar consentimientos y pedir el borrado, que
              es una cosa que se hace una vez, no «mi cuenta». Privacidad se
              enlaza desde dentro del perfil y desde el pie.
            */}
            <NavLink
              className={claseDelEnlace}
              to={hayCuenta ? rutas.perfil() : rutas.ingresar()}
            >
              {hayCuenta ? 'Mi cuenta' : 'Ingresar'}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className={estilos.principal}>
        <Outlet />
      </main>

      <footer className={estilos.pie}>
        <div className={estilos.pieDentro}>
          <span>© 2026 Renaser Consulting</span>
          {/*
            La entrada de las empresas vive en el pie y no en la barra de
            arriba, y es una decision, no una rebaja. Esos tres enlaces son el
            camino de quien postula; un cuarto para otro publico distinto los
            diluye justo cuando quien busca trabajo mas los necesita. Quien
            trabaja en el panel entra una vez y lo guarda: lo que necesita es
            que exista un sitio donde encontrarlo, no que le compita al
            candidato.

            Y dice «Entrar», nunca «Crear cuenta»: las cuentas del panel nacen
            solo por invitacion. Un enlace que prometa registrarse lleva a una
            pantalla que no puede cumplirlo.
          */}
          <nav className={estilos.enlacesDelPie} aria-label="Enlaces del pie">
            {/*
              Son dos y se llaman distinto a proposito. «Privacidad y control»
              es el panel de acciones y necesita sesion; la politica es el
              documento y se lee sin cuenta — Google Play exige poder enlazarla
              asi. Con el mismo nombre, la que pide sesion pareceria un error.
            */}
            <Link to={rutas.politica()}>Política de privacidad</Link>
            <Link to={rutas.privacidad()}>Privacidad y control</Link>
            <Link to={rutas.adminEntrar()}>Entrar al panel de empresas</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
