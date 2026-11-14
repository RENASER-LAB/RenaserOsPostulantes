/**
 * Buscar y filtrar en «Pruebas» (spec pruebas-indice-de-la-empresa, punto 3).
 *
 * Una sola línea a todo el ancho: escribir busca por **título**; si el texto
 * coincide con un valor de filtro («tác», «publi», «nivel:»), se ofrece
 * convertirlo en filtro, que queda como etiqueta quitable dentro de la propia
 * línea —con su aspa o con Retroceso dos veces con la línea vacía—. Junto a
 * ella, «Filtros» («Filtrar (n)» en el teléfono) abre los tres grupos, y
 * «Quitar filtros» aparece cuando hay alguno. Desde 1440 px y sin ninguna
 * prueba abierta, además, una columna de filtros con sus recuentos.
 */

import { forwardRef, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconoCruz, IconoDesplegar, IconoFiltros, IconoLupa, IconoMas } from '@/ui/Iconos'
import type { FilaDePrueba } from '../api/pruebas'
import {
  cuantasCumplen,
  cuantosFiltros,
  etiquetas,
  GRUPOS,
  NOMBRE_DEL_GRUPO,
  nombreDeLaOpcion,
  opcionesDe,
  type Filtros,
  type Grupo,
  type Sugerencia,
} from './indice'
import estilos from './Pruebas.module.css'

// ---------- La línea ----------

interface PropsLinea {
  buscar: string
  filtros: Filtros
  sugerencias: Sugerencia[]
  esTelefono: boolean
  alEscribir: (texto: string) => void
  alQuitar: (grupo: Grupo, valores: string[]) => void
  /** Enter: abre la primera fila, o aplica la primera sugerencia si no hay filas. */
  alConfirmar: () => void
  /** ↓: a la primera fila (o sugerencia); ↑: a la última sugerencia. */
  alBajar: () => void
  alSubir: () => void
}

export const LineaDeBusqueda = forwardRef<HTMLInputElement, PropsLinea>(function LineaDeBusqueda(
  { buscar, filtros, sugerencias, esTelefono, alEscribir, alQuitar, alConfirmar, alBajar, alSubir },
  referencia,
) {
  // Retroceso con la línea vacía marca la última etiqueta; el segundo la quita.
  const [armada, setArmada] = useState(false)
  const unidades = etiquetas(filtros)
  const entrada = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (unidades.length === 0) setArmada(false)
  }, [unidades.length])

  function alPulsar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      alBajar()
    } else if (e.key === 'ArrowUp') {
      if (sugerencias.length > 0) {
        e.preventDefault()
        alSubir()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      alConfirmar()
    } else if (e.key === 'Backspace' && buscar === '') {
      const ultima = unidades[unidades.length - 1]
      if (!ultima) return
      if (armada) {
        alQuitar(ultima.grupo, ultima.valores)
        setArmada(false)
      } else {
        setArmada(true)
      }
    } else if (e.key === 'Escape') {
      if (buscar) {
        e.stopPropagation()
        alEscribir('')
      } else if (armada) {
        e.stopPropagation()
        setArmada(false)
      }
    } else if (armada) {
      setArmada(false)
    }
  }

  return (
    <div
      className={estilos.linea}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) entrada.current?.focus()
      }}
    >
      <IconoLupa />
      {unidades.map((u, i) => {
        const texto = u.valores.map((v) => nombreDeLaOpcion(u.grupo, v)).join(', ')
        const marcada = armada && i === unidades.length - 1
        return (
          <span key={`${u.grupo}-${u.valores.join('|')}`} className={marcada ? `${estilos.etiqueta} ${estilos.etiquetaMarcada}` : estilos.etiqueta}>
            <b>{NOMBRE_DEL_GRUPO[u.grupo].corto}</b>&nbsp;<span>{texto}</span>
            <button
              type="button"
              aria-label={`Quitar ${NOMBRE_DEL_GRUPO[u.grupo].corto}: ${texto}`}
              onClick={() => {
                alQuitar(u.grupo, u.valores)
                entrada.current?.focus()
              }}
            >
              <IconoCruz tamano={16} />
            </button>
          </span>
        )
      })}
      <input
        ref={(el) => {
          entrada.current = el
          if (typeof referencia === 'function') referencia(el)
          else if (referencia) referencia.current = el
        }}
        className={estilos.entradaLinea}
        type="search"
        aria-label="Buscar vacante o filtrar"
        autoComplete="off"
        spellCheck={false}
        placeholder={esTelefono || unidades.length > 0 ? 'Buscar…' : 'Buscar vacante, nivel, estado…'}
        value={buscar}
        onChange={(e) => {
          setArmada(false)
          alEscribir(e.target.value)
        }}
        onKeyDown={alPulsar}
      />
      <kbd className={estilos.teclaBarra} aria-hidden="true">
        /
      </kbd>
    </div>
  )
})

// ---------- Las sugerencias ----------

export function ListaDeSugerencias({
  sugerencias,
  alAplicar,
}: {
  sugerencias: Sugerencia[]
  alAplicar: (s: Sugerencia) => void
}) {
  if (sugerencias.length === 0) return null
  return (
    <div className={`${estilos.envoltura} ${estilos.sugerencias}`}>
      <div className={estilos.cabeceraGrupo} id="titulo-sugerencias">
        Filtrar por
      </div>
      <div role="group" aria-labelledby="titulo-sugerencias">
        {sugerencias.map((s) => (
          <button
            key={`${s.grupo}-${s.valor}`}
            type="button"
            className={estilos.sugerencia}
            data-recorrible=""
            onClick={() => alAplicar(s)}
          >
            <span className={estilos.mas} aria-hidden="true">
              <IconoMas tamano={14} />
            </span>
            <span>
              <b>{NOMBRE_DEL_GRUPO[s.grupo].corto}</b> {nombreDeLaOpcion(s.grupo, s.valor)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- El botón «Filtros» y su ventanita ----------

interface PropsFiltros {
  filtros: Filtros
  filas: readonly FilaDePrueba[]
  abierto: boolean
  esTelefono: boolean
  alAbrir: (abierto: boolean) => void
  alAlternar: (grupo: Grupo, valor: string) => void
  alQuitarTodo: () => void
}

export function BotonDeFiltros({ filtros, filas, abierto, esTelefono, alAbrir, alAlternar, alQuitarTodo }: PropsFiltros) {
  const ventana = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const envoltura = useRef<HTMLDivElement>(null)
  const n = cuantosFiltros(filtros)

  // Al abrir, el foco va a la primera opción; tocar fuera la cierra.
  useEffect(() => {
    if (!abierto) return
    ventana.current?.querySelector<HTMLElement>('button[aria-pressed]')?.focus()
    function alTocar(e: MouseEvent) {
      if (envoltura.current && !envoltura.current.contains(e.target as Node)) alAbrir(false)
    }
    document.addEventListener('mousedown', alTocar)
    return () => document.removeEventListener('mousedown', alTocar)
  }, [abierto, alAbrir])

  return (
    <div className={estilos.envolturaFiltros} ref={envoltura}>
      <button
        ref={boton}
        className={estilos.secundario}
        type="button"
        aria-expanded={abierto}
        aria-controls="ventana-filtros"
        aria-label={n > 0 ? `Filtros, ${n} activos` : 'Filtros'}
        onClick={() => alAbrir(!abierto)}
      >
        <IconoFiltros />
        {esTelefono ? `Filtrar${n > 0 ? ` (${n})` : ''}` : 'Filtros'}
        {!esTelefono && n > 0 && <span className={estilos.insignia}>{n}</span>}
      </button>
      {esTelefono && (
        <div
          className={abierto ? `${estilos.veloFiltros} ${estilos.veloFiltrosVisible}` : estilos.veloFiltros}
          aria-hidden="true"
          onClick={() => alAbrir(false)}
        />
      )}
      <div
        ref={ventana}
        id="ventana-filtros"
        className={abierto ? `${estilos.ventanaFiltros} ${estilos.ventanaFiltrosAbierta}` : estilos.ventanaFiltros}
        role="dialog"
        aria-label="Filtros"
        inert={!abierto}
      >
        <div className={estilos.asa} aria-hidden="true" />
        {GRUPOS.map((g) => (
          <div key={g} className={estilos.grupoVentana} role="group" aria-labelledby={`grupo-ventana-${g}`}>
            <h3 id={`grupo-ventana-${g}`}>{NOMBRE_DEL_GRUPO[g].largo}</h3>
            <div className={estilos.pastillas}>
              {opcionesDe(g, filas).map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={estilos.pastilla}
                  aria-pressed={filtros[g].includes(o.valor)}
                  onClick={() => alAlternar(g, o.valor)}
                >
                  {o.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className={estilos.pieVentana}>
          <button className={estilos.fantasma} type="button" disabled={n === 0} onClick={alQuitarTodo}>
            Quitar filtros
          </button>
          <button
            className={estilos.secundario}
            type="button"
            onClick={() => {
              alAbrir(false)
              boton.current?.focus()
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- La columna de filtros (desde 1440 px) ----------

export function ColumnaDeFiltros({
  filtros,
  filas,
  alAlternar,
  alQuitarTodo,
}: {
  filtros: Filtros
  filas: readonly FilaDePrueba[]
  alAlternar: (grupo: Grupo, valor: string) => void
  alQuitarTodo: () => void
}) {
  return (
    <aside className={estilos.columnaFiltros} aria-label="Filtros">
      <div className={estilos.cabeceraColumna}>
        <h2>Filtros</h2>
        {cuantosFiltros(filtros) > 0 && (
          <button className={estilos.fantasma} type="button" onClick={alQuitarTodo}>
            Limpiar
          </button>
        )}
      </div>
      {GRUPOS.map((g) => (
        <GrupoPlegable key={g} titulo={NOMBRE_DEL_GRUPO[g].largo}>
          {opcionesDe(g, filas).map((o) => (
            <label key={o.valor} className={estilos.casilla}>
              <input type="checkbox" checked={filtros[g].includes(o.valor)} onChange={() => alAlternar(g, o.valor)} />
              {o.nombre}
              <span className={estilos.cuentaCasilla}>{cuantasCumplen(filas, g, o.valor)}</span>
            </label>
          ))}
        </GrupoPlegable>
      ))}
    </aside>
  )
}

function GrupoPlegable({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className={estilos.grupoColumna} open>
      <summary>
        {titulo}
        <IconoDesplegar tamano={16} />
      </summary>
      <div className={estilos.opcionesColumna} role="group" aria-label={titulo}>
        {children}
      </div>
    </details>
  )
}
