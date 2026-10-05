/**
 * El armazon del panel: la barra fina de arriba, el menu lateral y el candado.
 *
 * Si no hay sesion de equipo, cualquier ruta del panel lleva a entrar. El
 * candado vive aqui y no en cada pagina para que añadir una pantalla nueva no
 * pueda olvidarselo.
 *
 * Desde la V64 las pestañas de arriba son un **menu lateral agrupado por
 * familias** —Seleccion, Personas y Configuracion al pie—, porque con la
 * ampliacion de RR.HH. ya no cabian. Se pliega a una columna de iconos, y en
 * una pantalla de menos de 1024 px se abre como un cajon con «Menú».
 *
 * ⚠️ **La marca sigue dentro de la barra (`<header>`, el `banner`) y con su
 * nombre de siempre**, «Panel del equipo, inicio», y «Salir» sigue a la vista:
 * los E2E del armazon (`41-logotipo`, `10-panel-entrar`) los buscan ahi.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Outlet, matchPath, useLocation } from 'react-router-dom'
import { patrones, rutas } from '@/rutas'
import { Marca } from '@/ui/Marca'
import {
  IconoAjustes,
  IconoCruz,
  IconoMaletin,
  IconoMenu,
  IconoPersonas,
  IconoPlegar,
  IconoReloj,
} from '@/ui/Iconos'
import { verSesionDelPanel } from './api/sesion'
import { entradaActiva, guardarPlegado, leerPlegado, menuDe, type ClaveDeEntrada, type Entrada } from './menu'
import { useSesionPanel } from './Sesion'
import { useAltoDeLaCabecera } from './altoDeLaCabecera'
import estilos from './Armazon.module.css'

const TITULOS: Array<[string, string]> = [
  [patrones.adminVacantes, 'Vacantes · Panel'],
  [patrones.adminVacantesArchivadas, 'Vacantes archivadas · Panel'],
  [patrones.adminVacante, 'Vacante · Panel'],
  [patrones.adminPruebaTecnica, 'Prueba técnica · Panel'],
  [patrones.adminSesiones, 'Simulación · Panel'],
  [patrones.adminConfiguracion, 'Configuración · Panel'],
  [patrones.adminColaboradores, 'Colaboradores · Panel'],
  [patrones.adminNuevoColaborador, 'Nuevo colaborador · Panel'],
  [patrones.adminColaborador, 'Colaborador · Panel'],
]

function TituloDelPanel() {
  const { pathname } = useLocation()

  useEffect(() => {
    const encontrado = TITULOS.find(([patron]) => matchPath(patron, pathname))
    document.title = encontrado ? `${encontrado[1]} · EX` : 'Panel · EX'
  }, [pathname])

  return null
}

const ICONOS: Record<ClaveDeEntrada, ReactNode> = {
  vacantes: <IconoMaletin />,
  simulacion: <IconoReloj />,
  colaboradores: <IconoPersonas />,
  configuracion: <IconoAjustes />,
}

/** Lo que se ve en cualquier pantalla de 1024 px o más: el lateral o el cajón. */
const ANCHO_DEL_CAJON = '(max-width: 1023.98px)'

export function ArmazonPanel() {
  const { hayEquipo, nombre, salir } = useSesionPanel()
  const cache = useQueryClient()
  const { pathname } = useLocation()
  // La barra es sticky: lo que una pantalla pega arriba (el balance del editor
  // de preguntas) va debajo de ella, con su alto medido en --alto-cabecera-panel.
  const medirCabecera = useAltoDeLaCabecera()

  const sesion = useQuery({
    queryKey: ['panel-sesion'],
    queryFn: verSesionDelPanel,
    enabled: hayEquipo,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const [plegado, setPlegado] = useState(leerPlegado)
  const [cajonAbierto, setCajonAbierto] = useState(false)
  const botonMenu = useRef<HTMLButtonElement>(null)

  // Otra sesión no hereda el menú de la anterior en la misma pestaña.
  useEffect(() => {
    if (!hayEquipo) cache.removeQueries({ queryKey: ['panel-sesion'] })
  }, [hayEquipo, cache])

  // Elegir una entrada cierra el cajón: el cambio de dirección es la señal.
  useEffect(() => {
    setCajonAbierto(false)
  }, [pathname])

  // Si la pantalla crece con el cajón abierto, el cajón sobra.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const consulta = window.matchMedia(ANCHO_DEL_CAJON)
    const alCambiar = () => {
      if (!consulta.matches) setCajonAbierto(false)
    }
    consulta.addEventListener?.('change', alCambiar)
    return () => consulta.removeEventListener?.('change', alCambiar)
  }, [])

  const cerrarCajon = useCallback(() => {
    setCajonAbierto(false)
    botonMenu.current?.focus()
  }, [])

  function alternarPlegado() {
    setPlegado((antes) => {
      guardarPlegado(!antes)
      return !antes
    })
  }

  if (!hayEquipo) return <Navigate to={rutas.adminEntrar()} replace />

  const menu = menuDe(sesion.data)
  const activa = entradaActiva(pathname)
  const quien = sesion.data?.nombre ?? nombre

  return (
    <div className={estilos.armazon} data-plegado={plegado ? 'true' : 'false'}>
      <TituloDelPanel />

      <header className={estilos.barra} ref={medirCabecera}>
        <div className={estilos.barraDentro}>
          <button
            ref={botonMenu}
            className={estilos.botonMenu}
            type="button"
            onClick={() => setCajonAbierto(true)}
            aria-expanded={cajonAbierto}
            aria-controls="cajon-del-menu"
          >
            <IconoMenu />
            Menú
          </button>
          <Link className={estilos.marca} to={rutas.adminVacantes()} aria-label="Panel del equipo, inicio">
            <Marca tamano={28} />
            {/* La palabra distingue este lado del portal del candidato: mismo
                mundo visual, otra persona delante. */}
            <span className={estilos.quienEs}>Panel del equipo</span>
          </Link>
          {sesion.data?.empresa && <span className={estilos.empresa}>{sesion.data.empresa}</span>}
          <div className={estilos.persona}>
            {quien && <span className={estilos.nombre}>{quien}</span>}
            <button className={estilos.salir} type="button" onClick={salir}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className={estilos.cuerpo}>
        <nav className={estilos.lateral} aria-label="Menú del panel">
          <ListaDelMenu familias={menu.familias} pie={menu.pie} activa={activa} plegado={plegado} />
          <button
            className={estilos.plegar}
            type="button"
            onClick={alternarPlegado}
            aria-pressed={plegado}
          >
            <span className={plegado ? estilos.iconoGirado : undefined}>
              <IconoPlegar />
            </span>
            <span className={estilos.texto}>{plegado ? 'Desplegar menú' : 'Plegar menú'}</span>
          </button>
        </nav>

        <main className={estilos.principal}>
          <Outlet />
        </main>
      </div>

      {cajonAbierto && (
        <Cajon alCerrar={cerrarCajon}>
          <ListaDelMenu
            familias={menu.familias}
            pie={menu.pie}
            activa={activa}
            plegado={false}
            alElegir={cerrarCajon}
          />
        </Cajon>
      )}
    </div>
  )
}

function ListaDelMenu({
  familias,
  pie,
  activa,
  plegado,
  alElegir,
}: {
  familias: { titulo: string; entradas: Entrada[] }[]
  pie: Entrada[]
  activa: ClaveDeEntrada | null
  plegado: boolean
  alElegir?: () => void
}) {
  return (
    <div className={estilos.menu}>
      <div className={estilos.familias}>
        {familias.map((familia) => (
          <section className={estilos.familia} key={familia.titulo} aria-label={familia.titulo}>
            {/* Plegado, el título de la familia se esconde pero sigue siendo el
                nombre del grupo para quien escucha. */}
            <h2 className={plegado ? estilos.tituloFamiliaOculto : estilos.tituloFamilia} aria-hidden="true">
              {familia.titulo}
            </h2>
            <ul className={estilos.entradas} role="list">
              {familia.entradas.map((entrada) => (
                <li key={entrada.clave}>
                  <EnlaceDelMenu entrada={entrada} activa={activa === entrada.clave} alElegir={alElegir} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ul className={`${estilos.entradas} ${estilos.pie}`} role="list">
        {pie.map((entrada) => (
          <li key={entrada.clave}>
            <EnlaceDelMenu entrada={entrada} activa={activa === entrada.clave} alElegir={alElegir} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Una entrada: icono y nombre. Plegado, el nombre pasa a ser el tooltip —que
 * sale al pasar por encima y al llegar con el teclado— y **sigue siendo el
 * nombre accesible del enlace**: se esconde con opacidad, nunca con `display`,
 * que lo sacaría del árbol de accesibilidad.
 */
function EnlaceDelMenu({
  entrada,
  activa,
  alElegir,
}: {
  entrada: Entrada
  activa: boolean
  alElegir?: () => void
}) {
  return (
    <Link
      className={activa ? `${estilos.enlace} ${estilos.enlaceActivo}` : estilos.enlace}
      to={entrada.ruta}
      aria-current={activa ? 'page' : undefined}
      onClick={alElegir}
    >
      <span className={estilos.icono} aria-hidden="true">
        {ICONOS[entrada.clave]}
      </span>
      <span className={estilos.texto}>{entrada.nombre}</span>
    </Link>
  )
}

const ENFOCABLES = 'a[href], button:not([disabled])'

/**
 * El menú en una pantalla estrecha: un cajón encima de la página.
 *
 * Se cierra con Escape, al tocar fuera o al elegir una entrada; mientras está
 * abierto el foco no sale de él, y al cerrarlo vuelve al botón «Menú» (lo hace
 * quien lo cierra, `cerrarCajon`).
 */
function Cajon({ alCerrar, children }: { alCerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(alCerrar)
  cerrar.current = alCerrar

  useEffect(() => {
    caja.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cerrar.current()
        return
      }
      if (e.key !== 'Tab' || !caja.current) return
      const dentro = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (dentro.length === 0) return
      const primero = dentro[0]!
      const ultimo = dentro[dentro.length - 1]!
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = anterior
    }
  }, [])

  return (
    <>
      <div className={estilos.velo} onClick={alCerrar} data-testid="velo-del-menu" />
      <div
        id="cajon-del-menu"
        ref={caja}
        className={estilos.cajon}
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel"
      >
        <div className={estilos.cabeceraCajon}>
          <span className={estilos.tituloCajon}>Menú</span>
          <button className={estilos.cerrarCajon} type="button" onClick={alCerrar} aria-label="Cerrar el menú">
            <IconoCruz />
          </button>
        </div>
        <nav aria-label="Menú del panel">{children}</nav>
      </div>
    </>
  )
}
