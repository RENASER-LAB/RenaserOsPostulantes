/**
 * Lo que no cambia al navegar: la cabecera, el hueco de la pagina y el pie.
 *
 * La cabecera es deliberadamente fina. La pantalla es del candidato y de su
 * proceso; el portal solo tiene que estar ahi para volver.
 */

import { Link, NavLink, Outlet, matchPath, useLocation, useNavigationType } from 'react-router-dom'
import { useEffect, useRef } from 'react'
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
  /*
   * Las tres puertas del panel entraron en este armazon el 24/09/2026, así que
   * ahora pasan por aquí.
   *
   * ⚠️ **Los rótulos tienen que decir LO MISMO que `useTituloDelPanel` en cada
   * una de esas pantallas.** Las dos cosas escriben `document.title` en un
   * efecto y las dos se montan a la vez; cuál gana depende del orden en que
   * React recorre el árbol, que no es algo sobre lo que apoyarse. Diciendo lo
   * mismo, el orden deja de importar. Si cambias uno, cambia el otro.
   */
  [patrones.adminEntrar, 'Entrar al panel'],
  [patrones.adminClave, 'Recuperar la contraseña'],
  [patrones.adminRestablecer, 'Elegir contraseña nueva'],
]

/** Las pantallas que son una tarjeta sola y se centran en la ventana. */
const CENTRADAS = [
  patrones.ingresar,
  patrones.clave,
  patrones.restablecer,
  patrones.adminEntrar,
  patrones.adminClave,
  patrones.adminRestablecer,
]

/** Las puertas: pantallas de una sola tarea, que llevan el pie corto. */
const PUERTAS = [
  patrones.ingresar,
  patrones.acceso,
  patrones.registro,
  patrones.clave,
  patrones.restablecer,
  patrones.adminEntrar,
  patrones.adminClave,
  patrones.adminRestablecer,
]

/**
 * Las publicas con contenido que leer: llevan el pie en columnas aunque no haya
 * cuenta. Cualquier otra pantalla sin cuenta es «acceso necesario».
 */
const PUBLICAS_CON_CONTENIDO = [
  { path: patrones.inicio, end: true },
  patrones.vacantes,
  patrones.vacante,
  patrones.politica,
]

function TituloDeLaPagina() {
  const { pathname } = useLocation()

  useEffect(() => {
    const encontrado = TITULOS.find(([patron]) => matchPath(patron, pathname))
    document.title = encontrado ? `${encontrado[1]} · EX` : 'EX · Empleos en Renaser'
  }, [pathname])

  return null
}

/**
 * Sube arriba al navegar. Y **si no se cambia de pantalla, subiendo se ve**.
 *
 * Son dos gestos distintos con el mismo destino:
 *
 * - **Cambiar de pantalla** —de una vacante a «Mis procesos»— sube de golpe. Lo
 *   que llega es contenido nuevo: deslizar por encima del anterior tarda y no
 *   dice nada, porque no hay nada que seguir con la vista.
 * - **Pulsar «Inicio» estando ya en la portada** se desliza, igual que
 *   «Vacantes» baja hasta su seccion. Aqui el recorrido SI se ve, y es lo que
 *   dice que subiste tu y que la pagina no salto sola.
 *
 * ⚠️ **Va contra `key` y no solo contra `pathname`.** Pulsar «Inicio» en la
 * portada no cambia ni la ruta ni el ancla, asi que con `[pathname, hash]` el
 * efecto no volvia a correr y el boton no hacia absolutamente nada. `key` cambia
 * en cada navegacion aunque el destino sea el mismo, que es el mismo motivo por
 * el que lo usa `LlevarAlAncla`.
 *
 * `anterior` empieza en `null` a proposito: en la primera carga no hay pantalla
 * de la que venir, y sin eso el primer render contaria como «misma pantalla» y
 * pediria un deslizamiento en una pagina que ya esta arriba.
 *
 * Ojo con el cuerpo entre llaves: si se escribe `useEffect(() => window.
 * scrollTo(0, 0), ...)`, el efecto devuelve lo que devuelva `scrollTo`, y React
 * se lo queda como funcion de limpieza. Al desmontar intenta llamarlo y revienta
 * con «destroy is not a function», tumbando la pagina entera.
 */
function ArribaAlCambiarDePagina() {
  const { pathname, hash, key } = useLocation()
  const tipo = useNavigationType()
  const anterior = useRef<string | null>(null)

  useEffect(() => {
    // Con ancla manda `LlevarAlAncla`. Sin esta guarda los dos se pelean: al
    // llegar de otra pantalla a `/#vacantes-abiertas` este efecto sube a cero
    // y deja al visitante arriba del todo, que es justo donde no queria ir.
    if (hash) {
      anterior.current = pathname
      return
    }

    // Al VOLVER a la lista de vacantes —atrás desde una ficha— manda la propia
    // lista, que se desplaza hasta la tarjeta que se abrió. Subir a cero aquí
    // haría que la pantalla saltara arriba y luego bajara.
    if (tipo === 'POP' && matchPath(patrones.vacantes, pathname)) {
      anterior.current = pathname
      return
    }

    const mismaPantalla = anterior.current === pathname
    anterior.current = pathname

    /*
     * Quien pidio menos movimiento salta, no se desliza. El bloque de
     * `prefers-reduced-motion` de `mundo.css` aqui no llega: solo apaga
     * animaciones y transiciones de CSS, y esto es una opcion de JavaScript que
     * ninguna hoja puede sobrescribir. Mismo criterio que `LlevarAlAncla`.
     */
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.scrollTo({ top: 0, behavior: mismaPantalla && !quieto ? 'smooth' : 'auto' })
  }, [pathname, hash, key, tipo])

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

/*
 * Aqui vivia `usarPosada`, que escuchaba el desplazamiento para saber si la
 * pagina se habia movido de arriba y ponerle `.posada` a la cabecera: primero
 * para sacar su superficie, y luego para hondear su sombra. Se fue el
 * 25/09/2026, cuando la pildora paso a ser blanca a secas en reposo y al bajar,
 * como la de la referencia del cliente: ya no habia nada que cambiar al bajar,
 * y un oyente de `scroll` que no pinta nada es trabajo en cada frame para nada.
 */

export function Armazon() {
  const { hayCuenta } = useSesion()
  const { pathname } = useLocation()

  /*
   * Las pantallas que son UNA tarjeta sola: se centran en lo que se ve en vez de
   * fluir desde arriba. Eso cambia el armazon —la cadena de altos y el aire del
   * pie—, asi que la decision se toma aqui. Ver `.armazonJusto`.
   *
   * ⚠️ **Centrar solo es seguro mientras la tarjeta quepa.** Centrar lo que no
   * cabe desborda por los dos lados, y a lo que se sale por arriba el navegador
   * no deja llegar. `/admin/entrar` solo pudo entrar al quitarle el bloque «¿No
   * puedes entrar?», y la contraseña olvidada —las cuatro— al pasar a tarjeta con
   * titular de 30 px, el 25/09/2026. Si alguna vuelve a crecer por debajo de la
   * tarjeta, hay que sacarla de aqui.
   */
  const justo = CENTRADAS.some((patron) => matchPath(patron, pathname) !== null)

  /*
   * El amanecer de la portada. Va detras de la cabecera, asi que la decision es
   * del armazon y no de la pantalla. Ver `.armazonConCielo` en la hoja.
   *
   * `end` importa: sin el, `/` casa con todo y el cielo saldria en las dieciocho
   * pantallas.
   */
  const conCielo = matchPath({ path: patrones.inicio, end: true }, pathname) !== null

  /*
   * El pie corto: una sola linea, para las pantallas que son una tarjeta.
   *
   * ⚠️ **El pie en columnas mide 290 px, y en estas pantallas sacaba scroll.**
   * Medido el 25/09/2026 a 1440×900: `/ingresar` se pasaba 24 px, `/clave` 289 y
   * «acceso necesario» 39 — pantallas que tienen UNA cosa que hacer y ningun
   * motivo para bajar. El pie grande es para las paginas que se leen; en una
   * puerta, el pie tiene que estar y apartarse.
   *
   * Van con el corto las puertas —entrar, crear cuenta, el enlace del correo, la
   * contraseña olvidada, y las tres del panel— y cualquier pantalla privada vista
   * SIN cuenta, que es «acceso necesario». Con el largo, las publicas que tienen
   * contenido que leer: la portada, el buscador de vacantes, la ficha de una
   * vacante y la politica.
   *
   * `hayCuenta` sale del token guardado y se sabe desde el primer render, asi que
   * quien tiene cuenta no ve parpadear el pie al abrir «Mis procesos».
   */
  const esPuerta = PUERTAS.some((patron) => matchPath(patron, pathname) !== null)
  const publicaConContenido = PUBLICAS_CON_CONTENIDO.some(
    (patron) => matchPath(patron, pathname) !== null,
  )
  const pieCorto = esPuerta || (!hayCuenta && !publicaConContenido)

  return (
    <div
      className={`${estilos.armazon} ${justo ? estilos.armazonJusto : ''} ${
        conCielo ? estilos.armazonConCielo : ''
      }`}
    >
      <ArribaAlCambiarDePagina />
      <LlevarAlAncla />
      <TituloDeLaPagina />

      <header className={estilos.cabecera}>
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

      <footer className={`${estilos.pie} ${pieCorto ? estilos.pieCorto : ''}`}>
        {pieCorto ? (
          /*
            Los tres enlaces que no llevan a una pantalla de la cabecera: la
            politica —que Google Play exige poder leer sin cuenta—, el panel de
            los datos y la entrada de las empresas. Los destinos del portal ya
            estan arriba, a un palmo.
          */
          <div className={estilos.pieLinea}>
            <span>© 2026 Renaser Consulting</span>
            <nav className={estilos.pieLineaEnlaces} aria-label="Enlaces del pie">
              <Link to={rutas.politica()}>Política de privacidad</Link>
              <Link to={rutas.privacidad()}>Privacidad y control</Link>
              <Link to={rutas.adminEntrar()}>Entrar al panel de empresas</Link>
            </nav>
          </div>
        ) : (
          <PieEnColumnas />
        )}
      </footer>
    </div>
  )
}

/**
 * El pie en columnas, desde el 25/09/2026, para las paginas que se leen.
 *
 * Era una linea con el copyright y tres enlaces apretados a la derecha; en
 * columnas cada grupo dice de que va y se puede crecer sin que el de al lado se
 * resienta.
 *
 * ⚠️ **Los enlaces son los que ya existian mas los tres destinos de la
 * cabecera.** Aqui no se invento ningun sitio nuevo: un pie con enlaces que no
 * llevan a nada es peor que un pie corto.
 */
function PieEnColumnas() {
  return (
    <>
        <div className={estilos.pieDentro}>
          <div className={estilos.pieMarca}>
            <Link className={estilos.marcaDelPie} to={rutas.inicio()} aria-label="EX, inicio">
              <Marca tamano={20} />
            </Link>
          </div>

          <nav className={estilos.pieColumnas} aria-label="Enlaces del pie">
            <div className={estilos.pieColumna}>
              <h2 className={estilos.pieTitulo}>El portal</h2>
              <Link to={rutas.inicio()}>Inicio</Link>
              <Link to={rutas.vacantes()}>Vacantes abiertas</Link>
              <Link to={rutas.procesos()}>Mis procesos</Link>
            </div>

            <div className={estilos.pieColumna}>
              <h2 className={estilos.pieTitulo}>Tus datos</h2>
              {/*
                Son dos y se llaman distinto a proposito. «Privacidad y control»
                es el panel de acciones y necesita sesion; la politica es el
                documento y se lee sin cuenta — Google Play exige poder enlazarla
                asi. Con el mismo nombre, la que pide sesion pareceria un error.
              */}
              <Link to={rutas.politica()}>Política de privacidad</Link>
              <Link to={rutas.privacidad()}>Privacidad y control</Link>
            </div>

            <div className={estilos.pieColumna}>
              <h2 className={estilos.pieTitulo}>Empresas</h2>
              {/*
                La entrada de las empresas vive en el pie y no en la barra de
                arriba, y es una decision, no una rebaja. Los tres destinos de
                arriba son el camino de quien postula; un cuarto para otro
                publico distinto los diluye justo cuando quien busca trabajo mas
                los necesita.

                Y dice «Entrar», nunca «Crear cuenta»: las cuentas del panel
                nacen solo por invitacion. Un enlace que prometa registrarse
                lleva a una pantalla que no puede cumplirlo.
              */}
              <Link to={rutas.adminEntrar()}>Entrar al panel de empresas</Link>
            </div>
          </nav>
        </div>

        <div className={estilos.pieAbajo}>
          <span>© 2026 Renaser Consulting</span>
        </div>
    </>
  )
}
