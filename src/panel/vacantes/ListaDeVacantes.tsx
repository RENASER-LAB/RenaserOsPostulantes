/**
 * La lista de vacantes del panel: el resumen, los filtros y una fila por vacante
 * con su anillo de postulantes.
 *
 * Cada fila dice tres cosas sin entrar: cuánta gente tiene (el número del
 * anillo), por dónde va (el anillo partido por etapa y las cinco casillas de al
 * lado) y si hay algo que el equipo tiene que mirar (el arco y la etiqueta
 * verdes). Al pasar por una casilla se resalta su tramo del anillo.
 *
 * ⚠️ **Es una tabla aunque no lo parezca.** Lleva `role="table"`, `row`, `cell`
 * y `columnheader` sobre una rejilla: quien usa lector de pantalla recorre
 * vacantes por columnas igual que antes, y las pruebas y los e2e que buscan una
 * fila por su texto siguen funcionando. La cabecera se esconde a la vista, no al
 * lector.
 *
 * Los números salen de `GET /vacantes/{id}/embudo`, uno por fila, repartidos en
 * `repartoDelEmbudo.ts`. Lo que la fila puede hacer (editar, archivar,
 * eliminar) lo pinta quien la usa, porque los modales viven allí.
 */

import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ConteoEmbudo, VacantePanel } from '../api/tipos'
import { rutas } from '@/rutas'
import { diasHasta } from '@/dominio/reloj'
import { ETAPAS_PANEL } from './ranking'
import { repartoDelEmbudo, tramosDelAnillo, type RepartoDelEmbudo } from './repartoDelEmbudo'
import estilos from './ListaDeVacantes.module.css'

/** Nombres cortos de las etapas: la casilla es estrecha. */
const NOMBRE_CORTO = ['Perfil', 'Prueba', 'Simulación', 'Validación', 'Decisión'] as const

const ESTADO: Record<string, string> = {
  PUBLICADA: 'Publicada',
  BORRADOR: 'Borrador',
  CERRADA: 'Cerrada',
}

type Filtro = 'TODAS' | 'PUBLICADA' | 'BORRADOR' | 'CERRADA'
const FILTROS: { codigo: Filtro; nombre: string }[] = [
  { codigo: 'TODAS', nombre: 'Todas' },
  { codigo: 'PUBLICADA', nombre: 'Publicadas' },
  { codigo: 'BORRADOR', nombre: 'Borradores' },
  { codigo: 'CERRADA', nombre: 'Cerradas' },
]

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/** Sin tildes ni mayúsculas: «tecnico» encuentra «Técnico». */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** «2 jul 2026»: cabe en una línea junto al estado y la ciudad. */
const fechaBreve = (fecha: string) =>
  new Date(fecha)
    .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '')

const movimientoReducido = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** El número sube desde cero cuando llega; con movimiento reducido, quieto. */
function Cifra({ valor }: { valor: number }) {
  const [visto, setVisto] = useState(() => (movimientoReducido() ? valor : 0))
  useEffect(() => {
    if (movimientoReducido() || valor === 0) {
      setVisto(valor)
      return
    }
    let marco = 0
    const inicio = performance.now()
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / 400)
      setVisto(Math.round(valor * (1 - Math.pow(1 - p, 3))))
      if (p < 1) marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [valor])
  return <>{visto}</>
}

interface ConteoDeLaFila {
  reparto: RepartoDelEmbudo | null
  cargando: boolean
}

interface Props {
  vacantes: VacantePanel[]
  /** El embudo de cada vacante, en el mismo orden que `vacantes`. */
  embudos: { data?: ConteoEmbudo; isPending: boolean }[]
  /** Lo que dice la columna «Evaluación». */
  evaluacionDe: (v: VacantePanel) => ReactNode
  /** Los botones de editar, archivar y eliminar de la fila. */
  accionesDe: (v: VacantePanel) => ReactNode
}

export function ListaDeVacantes({ vacantes, embudos, evaluacionDe, accionesDe }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('TODAS')
  const [busqueda, setBusqueda] = useState('')
  const idBusqueda = useId()

  const conteos = useMemo(
    () =>
      new Map<number, ConteoDeLaFila>(
        vacantes.map((v, i) => {
          const e = embudos[i]
          return [
            v.id,
            { reparto: e?.data ? repartoDelEmbudo(e.data) : null, cargando: e?.isPending ?? true },
          ]
        }),
      ),
    [vacantes, embudos],
  )

  const cuantasPor = (codigo: Filtro) =>
    codigo === 'TODAS' ? vacantes.length : vacantes.filter((v) => v.estado === codigo).length

  const visibles = vacantes.filter(
    (v) =>
      (filtro === 'TODAS' || v.estado === filtro) &&
      normalizar(v.titulo).includes(normalizar(busqueda.trim())),
  )

  return (
    <div className={estilos.lista}>
      <Resumen vacantes={vacantes} conteos={conteos} />

      <div className={estilos.barra}>
        <div className={estilos.filtros} role="group" aria-label="Qué vacantes ver">
          {FILTROS.map((f) => (
            <button
              key={f.codigo}
              type="button"
              className={estilos.filtro}
              aria-pressed={filtro === f.codigo}
              onClick={() => setFiltro(f.codigo)}
            >
              {f.nombre}
              <span className={estilos.cuantas}>{cuantasPor(f.codigo)}</span>
            </button>
          ))}
        </div>
        <label className={estilos.buscar} htmlFor={idBusqueda}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <span className={estilos.oculto}>Buscar una vacante por su nombre</span>
          <input
            id={idBusqueda}
            type="search"
            placeholder="Buscar vacante"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      <Leyenda />

      <div className={estilos.tabla} role="table" aria-label="Vacantes">
        <div className={estilos.cabecera} role="rowgroup">
          <div className={estilos.filaCabecera} role="row">
            <span role="columnheader" className={estilos.oculto}>
              Postulantes
            </span>
            <span role="columnheader" style={{ gridArea: 'titulo' }}>
              Vacante
            </span>
            <span role="columnheader" className={estilos.oculto}>
              Estado
            </span>
            <span role="columnheader" style={{ gridArea: 'etapas' }}>
              Dónde está cada persona
            </span>
            <span role="columnheader" className={estilos.oculto}>
              Evaluación
            </span>
            <span role="columnheader" className={estilos.oculto}>
              Acciones
            </span>
          </div>
        </div>

        <div role="rowgroup">
          {visibles.map((v, i) => (
            <Fila
              key={v.id}
              vacante={v}
              orden={i}
              conteo={conteos.get(v.id)!}
              evaluacion={evaluacionDe(v)}
              acciones={accionesDe(v)}
            />
          ))}
        </div>

        {vacantes.length === 0 && (
          <div className={estilos.vacio} role="row">
            <p role="cell">Todavía no hay vacantes. Crea la primera con el botón de arriba.</p>
          </div>
        )}
        {vacantes.length > 0 && visibles.length === 0 && (
          <div className={estilos.vacio} role="row">
            <p role="cell">
              Ninguna vacante coincide.{' '}
              <button
                type="button"
                className={estilos.limpiar}
                onClick={() => {
                  setFiltro('TODAS')
                  setBusqueda('')
                }}
              >
                Ver todas
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- El resumen de arriba ----------

function Resumen({
  vacantes,
  conteos,
}: {
  vacantes: VacantePanel[]
  conteos: Map<number, ConteoDeLaFila>
}) {
  const todos = [...conteos.values()]
  const listos = todos.length > 0 && todos.every((c) => !c.cargando)
  const suma = (f: (r: RepartoDelEmbudo) => number) =>
    todos.reduce((s, c) => s + (c.reparto ? f(c.reparto) : 0), 0)
  const postulantes = suma((r) => r.total)
  const porRevisar = suma((r) => r.porRevisar)
  const enDecision = suma((r) => r.porEtapa[ETAPAS_PANEL.length - 1] ?? 0)
  const publicadas = vacantes.filter((v) => v.estado === 'PUBLICADA').length

  const cifra = (n: number) => (listos ? <Cifra valor={n} /> : '—')

  return (
    <dl className={estilos.resumen}>
      <div className={estilos.dato}>
        <dt>Postulantes</dt>
        <dd>{cifra(postulantes)}</dd>
        <span>en proceso, en todas las vacantes</span>
      </div>
      <div className={`${estilos.dato} ${porRevisar > 0 ? estilos.datoVerde : ''}`}>
        <dt>
          Esperan tu decisión
          {listos && porRevisar > 0 && <span className={estilos.latido} aria-hidden="true" />}
        </dt>
        <dd>{cifra(porRevisar)}</dd>
        <span>para seguir en su proceso</span>
      </div>
      <div className={estilos.dato}>
        <dt>Publicadas</dt>
        <dd>
          <Cifra valor={publicadas} />
        </dd>
        <span>
          de {vacantes.length} {plural(vacantes.length, 'vacante', 'vacantes')}
        </span>
      </div>
      <div className={estilos.dato}>
        <dt>En decisión</dt>
        <dd>{cifra(enDecision)}</dd>
        <span>llegaron a la última etapa</span>
      </div>
    </dl>
  )
}

function Leyenda() {
  return (
    <div className={estilos.leyenda} aria-hidden="true">
      {NOMBRE_CORTO.map((nombre, i) => (
        <span key={nombre}>
          <i data-etapa={i} />
          {nombre}
        </span>
      ))}
      <span>
        <i className={estilos.aroVerde} />
        Esperan tu decisión
      </span>
    </div>
  )
}

// ---------- Una vacante ----------

function Fila({
  vacante: v,
  orden,
  conteo,
  evaluacion,
  acciones,
}: {
  vacante: VacantePanel
  orden: number
  conteo: ConteoDeLaFila
  evaluacion: ReactNode
  acciones: ReactNode
}) {
  const [resaltada, setResaltada] = useState<number | null>(null)
  const { reparto, cargando } = conteo
  const plazo = v.estado === 'PUBLICADA' && v.cierraEn ? diasHasta(v.cierraEn) : null

  return (
    <div
      className={estilos.fila}
      role="row"
      style={{ '--orden': orden } as CSSProperties}
      data-resaltada={resaltada ?? undefined}
    >
      <div role="cell" style={{ gridArea: 'anillo' }}>
        <Anillo vacante={v} reparto={reparto} cargando={cargando} resaltada={resaltada} />
      </div>

      <div role="cell" className={estilos.titulo} style={{ gridArea: 'titulo' }}>
        {v.titulo}
      </div>

      <div role="cell" className={estilos.meta} style={{ gridArea: 'meta' }}>
        <span className={estilos.estado} data-estado={v.estado}>
          <i aria-hidden="true" />
          {ESTADO[v.estado] ?? v.estado}
        </span>
        {v.ciudad?.nombre && <span>{v.ciudad.nombre}</span>}
        {v.publicadaEn && <span>Desde el {fechaBreve(v.publicadaEn)}</span>}
        {plazo && (
          <span className={plazo === 'hoy' || plazo === '1 día' ? estilos.urge : undefined}>
            {plazo === 'vencida'
              ? 'Plazo vencido'
              : plazo === 'hoy'
                ? 'Cierra hoy'
                : `Cierra en ${plazo}`}
          </span>
        )}
      </div>

      <div role="cell" className={estilos.celdaEtapas} style={{ gridArea: 'etapas' }}>
        {cargando ? (
          <span className={estilos.etapasCargando} aria-label="Contando postulantes" />
        ) : !reparto ? (
          <span className={estilos.apoyo}>No se pudo contar a los postulantes.</span>
        ) : reparto.total === 0 ? (
          <span className={estilos.apoyo}>
            {v.estado === 'BORRADOR'
              ? 'Publícala para empezar a recibir postulantes.'
              : reparto.terminadas > 0
                ? 'Nadie sigue en proceso.'
                : 'Todavía nadie postuló.'}
          </span>
        ) : (
          <>
            <ul className={estilos.etapas} aria-label="Postulantes por etapa">
              {ETAPAS_PANEL.map((e, i) => (
                <li
                  key={e.codigo}
                  className={estilos.etapa}
                  data-etapa={i}
                  data-vacia={reparto.porEtapa[i] ? undefined : true}
                  onMouseEnter={() => setResaltada(i)}
                  onMouseLeave={() => setResaltada(null)}
                  title={e.nombre}
                >
                  <span>
                    <i aria-hidden="true" />
                    {NOMBRE_CORTO[i]}
                  </span>
                  <b>{reparto.porEtapa[i]}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div role="cell" className={estilos.evaluacion} style={{ gridArea: 'evaluacion' }}>
        {evaluacion}
      </div>

      <div role="cell" className={estilos.acciones} style={{ gridArea: 'acciones' }}>
        <div className={estilos.principal}>
          {reparto && reparto.porRevisar > 0 ? (
            <span className={estilos.chip}>
              <span className={estilos.latido} aria-hidden="true" />
              {reparto.porRevisar} {plural(reparto.porRevisar, 'espera', 'esperan')} tu decisión
            </span>
          ) : reparto && reparto.total > 0 ? (
            <span className={`${estilos.chip} ${estilos.chipQuieto}`}>
              Nadie espera tu decisión
            </span>
          ) : null}
          <Link
            to={rutas.adminVacante(v.id)}
            className={estilos.ver}
            aria-label="Ver postulantes y gestionar"
          >
            Ver postulantes <span aria-hidden="true">→</span>
          </Link>
        </div>
        {/* Editar, archivar, eliminar: su propia columna, alineada en todas las filas. */}
        <div className={estilos.herramientas}>{acciones}</div>
      </div>
    </div>
  )
}

// ---------- El anillo ----------

function Anillo({
  vacante,
  reparto,
  cargando,
  resaltada,
}: {
  vacante: VacantePanel
  reparto: RepartoDelEmbudo | null
  cargando: boolean
  resaltada: number | null
}) {
  // El trazo arranca vacío y se estira en el siguiente cuadro: así la
  // transición de CSS tiene un «antes» desde el que dibujarse.
  const [dibujado, setDibujado] = useState(() => movimientoReducido())
  useEffect(() => {
    if (cargando || dibujado) return
    const marco = requestAnimationFrame(() => requestAnimationFrame(() => setDibujado(true)))
    return () => cancelAnimationFrame(marco)
  }, [cargando, dibujado])

  if (cargando) return <span className={estilos.anilloCargando} aria-hidden="true" />

  const total = reparto?.total ?? 0
  const tramos = reparto ? tramosDelAnillo(reparto, 1.6) : []
  const verde = reparto && total ? (reparto.porRevisar / total) * 100 : 0
  const nombre = !reparto
    ? `${vacante.titulo}: sin conteo`
    : `${total} ${plural(total, 'postulante', 'postulantes')}` +
      (reparto.porRevisar
        ? `, ${reparto.porRevisar} ${plural(reparto.porRevisar, 'espera', 'esperan')} tu decisión`
        : '')

  return (
    <Link
      to={rutas.adminVacante(vacante.id)}
      className={estilos.anillo}
      data-vacio={total === 0 ? true : undefined}
      aria-label={nombre}
      tabIndex={-1}
    >
      <svg viewBox="0 0 84 84" aria-hidden="true">
        {total === 0 ? (
          <circle className={estilos.pistaVacia} cx="42" cy="42" r="32" />
        ) : (
          <>
            <circle className={estilos.pista} cx="42" cy="42" r="32" />
            {tramos.map((t, k) => (
              <circle
                key={t.etapa}
                className={estilos.tramo}
                data-etapa={t.etapa}
                data-apagado={resaltada !== null && resaltada !== t.etapa ? true : undefined}
                cx="42"
                cy="42"
                r="32"
                pathLength={100}
                style={{
                  strokeDasharray: `${dibujado ? t.largo : 0} 100`,
                  strokeDashoffset: -t.desde,
                  transitionDelay: `${k * 40}ms, 0s, 0s`,
                }}
              />
            ))}
            {verde > 0 && (
              <circle
                className={estilos.arcoVerde}
                cx="42"
                cy="42"
                r="39.5"
                pathLength={100}
                style={{ strokeDasharray: `${dibujado ? verde : 0} 100` }}
              />
            )}
          </>
        )}
      </svg>
      <span className={estilos.centro} aria-hidden="true">
        <b>{reparto ? <Cifra valor={total} /> : '—'}</b>
      </span>
    </Link>
  )
}
