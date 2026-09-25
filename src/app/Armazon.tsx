/**
 * Lo que no cambia al navegar: la cabecera, el hueco de la pagina y el pie.
 *
 * La cabecera es deliberadamente fina. La pantalla es del candidato y de su
 * proceso; el portal solo tiene que estar ahi para volver.
 */

import { Link, NavLink, Outlet, matchPath, useLocation, useNavigationType } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { patrones, rutas } from '@/rutas'
import { useSesion } from './Sesion'
import { Campana } from '@/ui/Campana'
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
  [patrones.inicio, 'Inicio'],
  [patrones.vacantes, 'Vacantes abiertas'],
  [patrones.vacante, 'Detalle de la vacante'],
  [patrones.postular, 'Postular'],
  [patrones.ingresar, 'Entrar'],
  [patrones.acceso, 'Entrando'],
  [patrones.registro, 'Crear cuenta'],
  [patrones.clave, 'Recuperar la contraseña'],
  [patrones.restablecer, 'Elegir contraseña nueva'],
  [patrones.perfil, 'Tu perfil'],
  [patrones.procesos, 'Mis procesos'],
  [patrones.proceso, 'Mi proceso'],
  [patrones.evaluacion, 'Evaluación'],
  [patrones.prueba, 'La prueba del puesto'],
  [patrones.cuestionarioTecnico, 'La prueba del puesto'],
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
  const { pathname, hash } = useLocation()
  const tipo = useNavigationType()

  // Ojo con el cuerpo entre llaves: si se escribe `useEffect(() => window.
  // scrollTo(0, 0), ...)`, el efecto devuelve lo que devuelva `scrollTo`, y
  // React se lo queda como funcion de limpieza. Al desmontar intenta llamarlo
  // y revienta con «destroy is not a function», tumbando la pagina entera.
  useEffect(() => {
    // Con ancla manda `LlevarAlAncla`. Sin esta guarda los dos se pelean: al
    // llegar de otra pantalla a `/#vacantes-abiertas` este efecto sube a cero
    // y deja al visitante arriba del todo, que es justo donde no queria ir.
    if (hash) return
    // Al VOLVER a la lista de vacantes —atrás desde una ficha— manda la propia
    // lista, que se desplaza hasta la tarjeta que se abrió. Subir a cero aquí
    // haría que la pantalla saltara arriba y luego bajara.
    if (tipo === 'POP' && matchPath(patrones.vacantes, pathname)) return
    window.scrollTo(0, 0)
  }, [pathname, hash, tipo])

  return null
}

/**
 * Desplaza hasta el ancla de la direccion.
 *
 * ⚠️ **Hace falta escribirlo: con `<Link>` el navegador no lo hace solo.** Un
 * enlace normal a `#algo` lo resuelve el navegador, pero React Router navega
 * con `pushState`, y `pushState` no dispara el salto al ancla. Sin esto,
 * «Vacantes» cambiaba la direccion a `/#vacantes-abiertas` y la pagina se
 * quedaba exactamente donde estaba.
 *
 * Va contra `key` y no contra `hash`: `key` cambia en cada navegacion aunque
 * el destino sea el mismo, asi que pulsar «Vacantes» dos veces seguidas vuelve
 * a llevar abajo. Contra `hash`, la segunda pulsacion no hacia nada.
 *
 * El `requestAnimationFrame` espera al primer pintado: al llegar de otra
 * pantalla el destino todavia no esta en el documento cuando corre el efecto.
 */
function LlevarAlAncla() {
  const { hash, key } = useLocation()

  useEffect(() => {
    if (!hash) return

    const id = decodeURIComponent(hash.slice(1))

    // Quien pidio menos movimiento salta, no se desliza. El bloque de
    // `prefers-reduced-motion` de `mundo.css` aqui no llega: solo apaga
    // animaciones y transiciones de CSS, y esto es una opcion de JavaScript
    // que ninguna hoja puede sobrescribir.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const cuadro = requestAnimationFrame(() => {
      const destino = document.getElementById(id)
      // `scroll-margin-top` en el destino es lo que impide que la cabecera,
      // que flota encima, le tape el titulo al llegar.
      destino?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' })
    })

    return () => cancelAnimationFrame(cuadro)
  }, [hash, key])

  return null
}

function claseDelEnlace({ isActive }: { isActive: boolean }) {
  return isActive ? `${estilos.enlace} ${estilos.enlaceActivo}` : estilos.enlace
}

/** El destino que cede sitio en una pantalla muy estrecha. Ver `.enlaceQueCede`. */
function claseDelEnlaceQueCede(estado: { isActive: boolean }) {
  return `${claseDelEnlace(estado)} ${estilos.enlaceQueCede}`
}

/**
 * Si la pagina ya se movio de arriba.
 *
 * Es lo unico que separa la cabecera en reposo —solo la marca y los enlaces
 * sobre el cielo— de la cabecera posada, que saca su superficie para que el
 * contenido no se le mezcle por debajo.
 *
 * ⚠️ **Se lee una vez al montar, ademas de escuchar.** Al volver a una pantalla
 * con el navegador ya desplazado, un oyente que solo reacciona a `scroll` deja
 * la barra transparente sobre contenido.
 *
 * El oyente va en `passive`: no llama a `preventDefault` y sin la marca el
 * navegador tiene que esperar a saber si lo hara antes de desplazar.
 */
function usarPosada() {
  const [posada, setPosada] = useState(false)

  useEffect(() => {
    const mirar = () => setPosada(window.scrollY > 4)
    mirar()
    window.addEventListener('scroll', mirar, { passive: true })
    return () => window.removeEventListener('scroll', mirar)
  }, [])

  return posada
}

export function Armazon() {
  const { hayCuenta } = useSesion()
  const posada = usarPosada()
  const { pathname } = useLocation()

  // «Entrar» es una tarjeta sola en la pantalla y se centra en lo que se ve, no
  // fluye desde arriba. Eso cambia el armazon —la cadena de altos y el aire del
  // pie—, asi que la decision se toma aqui. Ver `.armazonJusto` en la hoja.
  const justo = matchPath(patrones.ingresar, pathname) !== null

  return (
    <div className={`${estilos.armazon} ${justo ? estilos.armazonJusto : ''}`}>
      <ArribaAlCambiarDePagina />
      <LlevarAlAncla />
      <TituloDeLaPagina />

      <header className={`${estilos.cabecera} ${posada ? estilos.posada : ''}`}>
        <div className={estilos.cabeceraDentro}>
          <Link className={estilos.marca} to={rutas.inicio()} aria-label="EX, inicio">
            <Marca tamano={22} />
          </Link>

          <nav className={estilos.navegacion}>
            <NavLink className={claseDelEnlace} to={rutas.inicio()} end>
              Inicio
            </NavLink>
            {/*
              «Vacantes» es una pantalla desde el 25/09/2026: `/vacantes`, con
              el buscador y los filtros. Va de `NavLink` sin `end` para encenderse
              también en la ficha de cualquier vacante (`/vacantes/:id`); en la
              portada solo se enciende «Inicio». Hasta entonces era un ancla a la
              sección `#vacantes-abiertas` de la portada y no se encendía nunca.
            */}
            <NavLink className={claseDelEnlaceQueCede} to={rutas.vacantes()}>
              Vacantes
            </NavLink>
            <NavLink className={claseDelEnlace} to={rutas.procesos()}>
              Mis procesos
            </NavLink>
          </nav>

          {/*
            La accion sale del `<nav>` y vive en su propia celda a la derecha.
            No es navegacion: es lo unico que se pulsa en la barra, y la rejilla
            de tres columnas necesita que sea un hermano para poder dejar los
            destinos centrados de verdad.

            Con cuenta, «Mi cuenta» lleva al perfil y no a privacidad: aquella es
            la pantalla de retirar consentimientos y pedir el borrado, que se hace
            una vez, no «mi cuenta». Privacidad se enlaza desde dentro del perfil
            y desde el pie. Y con cuenta no hay accion, solo navegacion: vuelve a
            ser un enlace de texto como los otros tres.

            El <span> de dentro de «Iniciar sesión» NO es decorativo y no se
            puede quitar: el enlace es el marco rosa y el hijo es la cara con la
            rampa. Ver `.entrar` en la hoja.

            La campana va aqui y no dentro del `<nav>`, que es donde nacio: no es
            un destino, es lo unico —con «Mi cuenta»— que se pulsa sin cambiar de
            pantalla, y metida en el `<nav>` descentraba los tres destinos, que
            es justo lo que la rejilla de tres columnas existe para evitar. Se
            protege sola: sin sesion devuelve `null`, asi que no hace falta
            envolverla.
          */}
          <div className={estilos.acciones}>
            {hayCuenta ? (
              <NavLink className={claseDelEnlace} to={rutas.perfil()}>
                Mi cuenta
              </NavLink>
            ) : (
              <Link className={estilos.entrar} to={rutas.ingresar()}>
                <span className={estilos.entrarCara} data-rotulo="Iniciar sesión">
                  Iniciar sesión
                </span>
              </Link>
            )}
            <Campana />
          </div>
        </div>
      </header>

      <main className={estilos.principal}>
        {/*
          ⚠️ **Sin la pieza A, y a proposito.** Cada cambio de ruta fundia la
          pantalla vieja y entraba la nueva desplazandose. Se quito el
          22/09/2026 por peticion: al cambiar de pestaña el contenido llegaba
          tarde y se leia como un fallo, no como una transicion. La pieza sigue
          en `movimiento.tsx` por si se quiere recuperar; lo que ya no hace es
          envolver al `<Outlet>`.

          El movimiento de entrada vive ahora solo en la portada, con la pieza E
          —`AlAsomarse`—, que se dispara al asomar cada bloque y no al navegar.
        */}
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
