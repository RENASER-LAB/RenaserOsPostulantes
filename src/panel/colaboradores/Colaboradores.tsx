/**
 * `/admin/colaboradores`: la lista de las personas que trabajan en la empresa.
 *
 * La tabla la sirve el backend en páginas de 50, ya ordenada por apellidos y ya
 * filtrada: con 5.000 personas, traerlas todas para filtrar aquí es justo lo que
 * no escala. Lo que se escribe en el buscador espera un momento antes de
 * preguntar, para no lanzar una consulta por tecla.
 *
 * Arriba, el aviso de los contratados por selección que todavía no tienen
 * ficha: contratar y dar de alta son dos pasos, porque la decisión y el primer
 * día de trabajo no suelen coincidir.
 */

import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import { formatearFechaCorta } from '@/dominio/reloj'
import { Cargando, Fallo } from '@/ui/Mensajes'
import { Modal } from '@/ui/Modal'
import { Vacio } from '@/ui/Vacio'
import { ErrorApi } from '../api/cliente'
import {
  contratadosPendientes,
  listarColaboradores,
  noDarDeAlta,
  opcionesDeColaborador,
} from '../api/colaboradores'
import type {
  ContratadoPendiente,
  EstadoLaboral,
  FiltrosColaboradores,
  FilaColaborador,
} from '../api/tiposPersonas'
import { CargarExcel } from './CargarExcel'
import { formatearDia } from './fechas'
import { EtiquetaDeEstado, FinDeContrato } from './piezas'
import tabla from '../ui/Tabla.module.css'
import estilos from './Colaboradores.module.css'

const ESTADOS: Array<{ valor: string; nombre: string; estados: EstadoLaboral[] }> = [
  { valor: 'vigentes', nombre: 'Activos y por ingresar', estados: ['ACTIVO', 'POR_INGRESAR'] },
  { valor: 'activos', nombre: 'Activos', estados: ['ACTIVO'] },
  { valor: 'por-ingresar', nombre: 'Por ingresar', estados: ['POR_INGRESAR'] },
  { valor: 'cesados', nombre: 'Cesados', estados: ['CESADO'] },
  { valor: 'todos', nombre: 'Todos', estados: ['ACTIVO', 'POR_INGRESAR', 'CESADO'] },
]

const POR_DEFECTO: FiltrosColaboradores = {
  estados: ['ACTIVO', 'POR_INGRESAR'],
  sede: null,
  area: null,
  cargo: null,
  porVencer: false,
  q: '',
  pagina: 0,
}

function sinFiltros(f: FiltrosColaboradores): boolean {
  return (
    f.estados.join() === POR_DEFECTO.estados.join() &&
    f.sede == null &&
    f.area == null &&
    f.cargo == null &&
    !f.porVencer &&
    f.q.trim() === ''
  )
}

export function ColaboradoresPanel() {
  const [filtros, setFiltros] = useState<FiltrosColaboradores>(POR_DEFECTO)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)

  // Lo escrito se aplica tras una pausa: una consulta por palabra, no por tecla.
  useEffect(() => {
    const espera = window.setTimeout(() => {
      setFiltros((antes) => (antes.q === busqueda ? antes : { ...antes, q: busqueda, pagina: 0 }))
    }, 300)
    return () => window.clearTimeout(espera)
  }, [busqueda])

  const opciones = useQuery({ queryKey: ['panel-colaboradores-opciones'], queryFn: opcionesDeColaborador })
  const lista = useQuery({
    queryKey: ['panel-colaboradores', filtros],
    queryFn: () => listarColaboradores(filtros),
    placeholderData: keepPreviousData,
  })
  const puedeEditar = opciones.data?.puedeEditar ?? false

  const sinPermiso = lista.error instanceof ErrorApi && lista.error.estado === 403

  function cambiar(parcial: Partial<FiltrosColaboradores>) {
    setFiltros((antes) => ({ ...antes, ...parcial, pagina: parcial.pagina ?? 0 }))
  }

  function quitarFiltros() {
    setBusqueda('')
    setFiltros(POR_DEFECTO)
  }

  const valorEstado = ESTADOS.find((e) => e.estados.join() === filtros.estados.join())?.valor ?? 'vigentes'

  return (
    <div className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <div>
          <h1>Colaboradores.</h1>
          <p className={estilos.bajada}>
            Quién trabaja en la empresa, dónde y con qué contrato. Cada cambio queda en su
            historial.
          </p>
        </div>
        {puedeEditar && (
          <div className={estilos.acciones}>
            <button className={estilos.secundario} type="button" onClick={() => setCargando(true)}>
              Cargar Excel
            </button>
            <Link className={estilos.crear} to={rutas.adminNuevoColaborador()}>
              Nuevo colaborador
            </Link>
          </div>
        )}
      </header>

      {sinPermiso ? (
        <p className={estilos.avisoMalo} role="alert">
          Tu rol no puede ver los colaboradores. Si crees que deberías, pide el acceso a quien
          administra los permisos.
        </p>
      ) : (
        <>
          <AvisoDePendientes puedeEditar={puedeEditar} />

          <div className={estilos.filtros} role="search">
            <label className={estilos.buscador}>
              <span className={estilos.rotulo}>Buscar por nombre o documento</span>
              <input
                className={estilos.entrada}
                type="search"
                value={busqueda}
                placeholder="Rivas, 45123456…"
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <label className={estilos.campo}>
              <span className={estilos.rotulo}>Estado</span>
              <select
                className={estilos.entrada}
                value={valorEstado}
                onChange={(e) =>
                  cambiar({ estados: ESTADOS.find((x) => x.valor === e.target.value)?.estados ?? POR_DEFECTO.estados })
                }
              >
                {ESTADOS.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </label>
            <FiltroDeLista
              etiqueta="Sede"
              todas="Todas las sedes"
              valor={filtros.sede}
              opciones={opciones.data?.sedes ?? []}
              alCambiar={(sede) => cambiar({ sede })}
            />
            <FiltroDeLista
              etiqueta="Área"
              todas="Todas las áreas"
              valor={filtros.area}
              opciones={opciones.data?.areas ?? []}
              alCambiar={(area) => cambiar({ area })}
            />
            <FiltroDeLista
              etiqueta="Cargo"
              todas="Todos los cargos"
              valor={filtros.cargo}
              opciones={opciones.data?.cargos ?? []}
              alCambiar={(cargo) => cambiar({ cargo })}
            />
            <label className={estilos.casilla}>
              <input
                type="checkbox"
                checked={filtros.porVencer}
                onChange={(e) => cambiar({ porVencer: e.target.checked })}
              />
              Contratos por vencer
            </label>
            <p className={estilos.contador} aria-live="polite">
              {lista.data
                ? `${lista.data.total} ${lista.data.total === 1 ? 'colaborador' : 'colaboradores'}`
                : ''}
            </p>
          </div>

          {lista.isPending ? (
            <Cargando que="Cargando los colaboradores…" />
          ) : lista.isError ? (
            <Fallo error={lista.error} reintentar={() => lista.refetch()} />
          ) : lista.data.filas.length === 0 ? (
            !lista.data.hayColaboradores && sinFiltros(filtros) ? (
              <Vacio
                titulo="Todavía no hay colaboradores"
                accion={
                  puedeEditar ? (
                    <>
                      <Link className={estilos.crear} to={rutas.adminNuevoColaborador()}>
                        Nuevo colaborador
                      </Link>
                      <button className={estilos.secundario} type="button" onClick={() => setCargando(true)}>
                        Cargar Excel
                      </button>
                    </>
                  ) : undefined
                }
              >
                Aquí aparecerá cada persona que trabaja en la empresa. Se dan de alta una a una, en
                bloque con un Excel, o desde la ficha de quien se contrató por selección.
              </Vacio>
            ) : (
              <Vacio
                titulo="Ningún colaborador cumple estos filtros"
                accion={
                  <button className={estilos.secundario} type="button" onClick={quitarFiltros}>
                    Quitar filtros
                  </button>
                }
              >
                Prueba con otra búsqueda o quita alguno de los filtros.
              </Vacio>
            )
          ) : (
            <>
              <TablaDeColaboradores filas={lista.data.filas} />
              <Paginas
                pagina={lista.data.pagina}
                total={lista.data.total}
                tamano={lista.data.tamano}
                alCambiar={(pagina) => cambiar({ pagina })}
              />
            </>
          )}
        </>
      )}

      {cargando && <CargarExcel alCerrar={() => setCargando(false)} />}
    </div>
  )
}

function FiltroDeLista({
  etiqueta,
  todas,
  valor,
  opciones,
  alCambiar,
}: {
  etiqueta: string
  todas: string
  valor: number | null
  opciones: Array<{ id: number; nombre: string }>
  alCambiar: (valor: number | null) => void
}) {
  return (
    <label className={estilos.campo}>
      <span className={estilos.rotulo}>{etiqueta}</span>
      <select
        className={estilos.entrada}
        value={valor == null ? '' : String(valor)}
        onChange={(e) => alCambiar(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">{todas}</option>
        {opciones.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

function TablaDeColaboradores({ filas }: { filas: FilaColaborador[] }) {
  return (
    <>
      <div className={`${tabla.envoltura} ${estilos.soloAncho}`}>
        <table className={tabla.tabla}>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Documento</th>
              <th>Cargo</th>
              <th>Área</th>
              <th>Sede</th>
              <th>Jefe</th>
              <th>Ingreso</th>
              <th>Fin de contrato</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td className={estilos.celdaNombre}>
                  <Link className={estilos.nombre} to={rutas.adminColaborador(f.id)}>
                    {f.nombreCompleto}
                  </Link>
                </td>
                <td className={estilos.celdaDocumento}>
                  {f.tipoDocumentoNombre} {f.numeroDocumento}
                </td>
                <td>{f.cargo ?? '—'}</td>
                <td>{f.area ?? '—'}</td>
                <td>{f.sede ?? '—'}</td>
                <td>{f.jefe ?? '—'}</td>
                <td className={estilos.celdaFecha}>
                  {formatearDia(f.fechaIngreso)}
                </td>
                <td className={estilos.celdaFecha}>
                  <FinDeContrato fin={f.finContrato} estado={f.estado} />
                </td>
                <td>
                  <EtiquetaDeEstado estado={f.estado} fechaCese={f.fechaCese} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* En el teléfono, tarjetas: nombre, cargo, área y estado. */}
      <ul className={estilos.tarjetas} role="list">
        {filas.map((f) => (
          <li className={estilos.tarjeta} key={f.id}>
            <Link className={estilos.nombre} to={rutas.adminColaborador(f.id)}>
              {f.nombreCompleto}
            </Link>
            <span className={estilos.detalleTarjeta}>
              {[f.cargo, f.area].filter(Boolean).join(' · ') || '—'}
            </span>
            <EtiquetaDeEstado estado={f.estado} fechaCese={f.fechaCese} />
          </li>
        ))}
      </ul>
    </>
  )
}

function Paginas({
  pagina,
  total,
  tamano,
  alCambiar,
}: {
  pagina: number
  total: number
  tamano: number
  alCambiar: (pagina: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(total / tamano))
  if (paginas <= 1) return null
  return (
    <nav className={estilos.paginas} aria-label="Páginas de la lista">
      <button
        className={estilos.chico}
        type="button"
        disabled={pagina === 0}
        onClick={() => alCambiar(pagina - 1)}
      >
        ‹ Anterior
      </button>
      <span className={estilos.paginaActual}>
        Página {pagina + 1} de {paginas}
      </span>
      <button
        className={estilos.chico}
        type="button"
        disabled={pagina + 1 >= paginas}
        onClick={() => alCambiar(pagina + 1)}
      >
        Siguiente ›
      </button>
    </nav>
  )
}

// ---------- El aviso de contratados pendientes ----------

function AvisoDePendientes({ puedeEditar }: { puedeEditar: boolean }) {
  const pendientes = useQuery({
    queryKey: ['panel-colaboradores-pendientes'],
    queryFn: contratadosPendientes,
  })
  const [abierto, setAbierto] = useState(false)
  const [descartando, setDescartando] = useState<ContratadoPendiente | null>(null)

  const cuantos = pendientes.data?.length ?? 0
  if (cuantos === 0) return null

  return (
    <section className={estilos.pendientes} aria-labelledby="titulo-pendientes">
      <div className={estilos.cabeceraPendientes}>
        <p className={estilos.textoPendientes} id="titulo-pendientes">
          {cuantos === 1
            ? '1 persona contratada por selección espera su alta'
            : `${cuantos} personas contratadas por selección esperan su alta`}
        </p>
        <button
          className={estilos.chico}
          type="button"
          aria-expanded={abierto}
          aria-controls="lista-pendientes"
          onClick={() => setAbierto((a) => !a)}
        >
          {abierto ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      {abierto && (
        <ul
          className={estilos.listaPendientes}
          id="lista-pendientes"
          role="list"
          aria-label="Contratados que esperan su alta"
        >
          {pendientes.data?.map((p) => (
            <li className={estilos.pendiente} key={p.postulacionId}>
              <div className={estilos.quienPendiente}>
                <b>{p.nombre}</b>
                <span className={estilos.detalleTarjeta}>
                  {p.vacante}
                  {p.contratadoEn ? ` · contratado el ${formatearFechaCorta(p.contratadoEn)}` : ''}
                </span>
              </div>
              {puedeEditar && (
                <div className={estilos.accionesPendiente}>
                  <Link className={estilos.crearChico} to={rutas.adminNuevoColaborador(p.postulacionId)}>
                    Dar de alta
                  </Link>
                  <button className={estilos.chico} type="button" onClick={() => setDescartando(p)}>
                    No dar de alta
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <NoDarDeAlta contratado={descartando} alCerrar={() => setDescartando(null)} />
    </section>
  )
}

function NoDarDeAlta({
  contratado,
  alCerrar,
}: {
  contratado: ContratadoPendiente | null
  alCerrar: () => void
}) {
  const cache = useQueryClient()
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)

  const descarte = useMutation({
    mutationFn: () => noDarDeAlta(contratado!.postulacionId, motivo.trim()),
    onSuccess: async () => {
      setMotivo('')
      setFallo(null)
      alCerrar()
      await cache.invalidateQueries({ queryKey: ['panel-colaboradores-pendientes'] })
    },
    onError: (causa) => setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar.'),
  })

  return (
    <Modal
      abierto={contratado !== null}
      titulo={contratado ? `No dar de alta a ${contratado.nombre}` : ''}
      onCerrar={alCerrar}
      pie={
        <>
          <button className={estilos.chico} type="button" onClick={alCerrar}>
            Cancelar
          </button>
          <button
            className={estilos.crearChico}
            type="button"
            disabled={descarte.isPending || motivo.trim() === ''}
            onClick={() => descarte.mutate()}
          >
            {descarte.isPending ? 'Guardando…' : 'No dar de alta'}
          </button>
        </>
      }
    >
      <p className={estilos.explica}>
        Sale del aviso y no se le crea ficha. La contratación sigue igual, y el motivo queda en la
        auditoría.
      </p>
      <label className={estilos.campoModal}>
        <span className={estilos.rotulo}>Motivo</span>
        <input
          className={estilos.entrada}
          type="text"
          value={motivo}
          placeholder="Ya no trabaja aquí"
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </Modal>
  )
}
