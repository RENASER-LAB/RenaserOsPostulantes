/**
 * Los cargos (V64): el catálogo de puestos que ya usan las solicitudes y las
 * vacantes, ahora con añadir, renombrar, desactivar y reactivar.
 *
 * ⚠️ **Renombrar cambia el nombre en todas partes, vacantes incluidas**, porque
 * las vacantes y las fichas apuntan al cargo y no copian su nombre. Por eso el
 * formulario lo avisa ANTES de guardar, con cuántas vacantes y personas lo
 * usan hoy.
 *
 * Un cargo desactivado no se elige en altas, cambios, cargas ni solicitudes
 * nuevas; lo que ya lo usa lo conserva.
 */

import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verCatalogos } from '../api/panel'
import {
  crearCargo,
  desactivarCargo,
  listarCargos,
  reactivarCargo,
  renombrarCargo,
} from '../api/estructura'
import type { CargoPanel } from '../api/tiposPersonas'
import estilos from './Areas.module.css'
import { useRetenerLaSesion } from '../Sesion'
import { AvisoDeFallo, explicarFallo, useUnaVez } from '../ui/Envio'

export function Cargos() {
  const cache = useQueryClient()
  const cargos = useQuery({ queryKey: ['panel-cargos'], queryFn: listarCargos })
  const [renombrando, setRenombrando] = useState<number | null>(null)
  const [fallo, setFallo] = useState<ReactNode>(null)

  async function refrescar() {
    setRenombrando(null)
    setFallo(null)
    // El nombre del cargo sale en las vacantes y en las fichas: todo lo que lo
    // pinta se vuelve a pedir.
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['panel-cargos'] }),
      cache.invalidateQueries({ queryKey: ['panel-puestos'] }),
      cache.invalidateQueries({ queryKey: ['panel-puestos-todos'] }),
      cache.invalidateQueries({ queryKey: ['panel-colaboradores-opciones'] }),
      cache.invalidateQueries({ queryKey: ['panel-colaboradores'] }),
      cache.invalidateQueries({ queryKey: ['panel-colaborador'] }),
    ])
  }

  const noSePudo = (causa: unknown, porDefecto: string) =>
    setFallo(explicarFallo(causa, porDefecto))

  const puedeEditar = cargos.data?.puedeEditar ?? false

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Cargos</h2>
      <p className={estilos.nota}>
        El catálogo de puestos que usan las solicitudes, las vacantes y las fichas de los
        colaboradores. Un cargo no se borra: se desactiva, y lo que ya lo usa lo conserva.
      </p>

      {cargos.isError && (
        <p className={estilos.avisoMalo} role="alert">
          No pudimos traer los cargos.{' '}
          <button className={estilos.enlace} type="button" onClick={() => cargos.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {cargos.data && (
        <>
          {puedeEditar && <AnadirCargo alHecho={refrescar} alFallar={noSePudo} />}

          {fallo && <AvisoDeFallo className={estilos.avisoMalo}>{fallo}</AvisoDeFallo>}

          {cargos.data.cargos.length === 0 ? (
            <p className={estilos.vacio}>Todavía no hay ningún cargo.</p>
          ) : (
            <ul className={estilos.filas} role="list">
              {cargos.data.cargos.map((cargo) => (
                <FilaDeCargo
                  key={cargo.id}
                  cargo={cargo}
                  puedeEditar={puedeEditar}
                  renombrando={renombrando === cargo.id}
                  alRenombrar={() => {
                    setFallo(null)
                    setRenombrando(cargo.id)
                  }}
                  alCerrar={() => setRenombrando(null)}
                  alHecho={refrescar}
                  alFallar={noSePudo}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function AnadirCargo({
  alHecho,
  alFallar,
}: {
  alHecho: () => Promise<void>
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const catalogos = useQuery({ queryKey: ['panel-catalogos'], queryFn: verCatalogos })
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState('')
  const [familia, setFamilia] = useState('')

  // `isPending` llega un pintado tarde: con un doble clic saldrían dos altas y la segunda
  // diría que el cargo ya existe, aunque se acaba de crear.
  const unaVez = useUnaVez()
  const alta = useMutation({
    mutationFn: () => crearCargo({ nombre: nombre.trim(), nivelPuestoCodigo: nivel, familiaCodigo: familia }),
    onSuccess: async () => {
      setNombre('')
      setNivel('')
      setFamilia('')
      await alHecho()
    },
    onError: (causa) => alFallar(causa, 'No se pudo añadir el cargo.'),
  })

  const listo = nombre.trim() !== '' && nivel !== '' && familia !== ''
  // Con algo escrito, una sesión que caduca no lo tira.
  useRetenerLaSesion(nombre.trim() !== '' || nivel !== '' || familia !== '')

  return (
    <form
      className={estilos.anadir}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (listo && !alta.isPending) unaVez(() => alta.mutateAsync())
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nombre del cargo</span>
        <input
          className={estilos.entrada}
          type="text"
          value={nombre}
          placeholder="Analista de finanzas"
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nivel</span>
        <select className={estilos.entrada} value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Elige…</option>
          {(catalogos.data?.nivelesPuesto ?? []).map((n) => (
            <option key={n.codigo} value={n.codigo}>
              {n.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Familia</span>
        <select className={estilos.entrada} value={familia} onChange={(e) => setFamilia(e.target.value)}>
          <option value="">Elige…</option>
          {(catalogos.data?.familias ?? []).map((f) => (
            <option key={f.codigo} value={f.codigo}>
              {f.nombre}
            </option>
          ))}
        </select>
      </label>
      <button className={estilos.crear} type="submit" disabled={alta.isPending || !listo}>
        {alta.isPending ? 'Añadiendo…' : 'Añadir'}
      </button>
    </form>
  )
}

function FilaDeCargo({
  cargo,
  puedeEditar,
  renombrando,
  alRenombrar,
  alCerrar,
  alHecho,
  alFallar,
}: {
  cargo: CargoPanel
  puedeEditar: boolean
  renombrando: boolean
  alRenombrar: () => void
  alCerrar: () => void
  alHecho: () => Promise<void>
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const unaVez = useUnaVez()
  const actividad = useMutation({
    mutationFn: () => (cargo.esActivo ? desactivarCargo(cargo.id) : reactivarCargo(cargo.id)),
    onSuccess: alHecho,
    onError: (causa) => alFallar(causa, 'No se pudo cambiar el estado del cargo.'),
  })

  return (
    <li className={`${estilos.fila} ${cargo.esActivo ? '' : estilos.filaRetirada}`}>
      <div className={estilos.queEs}>
        <span className={estilos.nombre}>{cargo.nombre}</span>
        {cargo.esActivo ? (
          <span className={`${estilos.marca} ${estilos.viva}`}>Activo</span>
        ) : (
          <span className={`${estilos.marca} ${estilos.retirada}`}>Desactivado</span>
        )}
      </div>
      <span className={estilos.explica}>
        {cargo.nivelNombre} · {cargo.familiaNombre}
      </span>

      {puedeEditar && !renombrando && (
        <div className={estilos.acciones}>
          <button className={estilos.chico} type="button" onClick={alRenombrar}>
            Renombrar
          </button>
          <button
            className={estilos.chico}
            type="button"
            onClick={() => unaVez(() => actividad.mutateAsync())}
            disabled={actividad.isPending}
          >
            {cargo.esActivo ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      )}

      {renombrando && (
        <Renombrar key={cargo.nombre} cargo={cargo} alHecho={alHecho} alCerrar={alCerrar} alFallar={alFallar} />
      )}
    </li>
  )
}

function Renombrar({
  cargo,
  alHecho,
  alCerrar,
  alFallar,
}: {
  cargo: CargoPanel
  alHecho: () => Promise<void>
  alCerrar: () => void
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const [nombre, setNombre] = useState(cargo.nombre)
  const cambio = useMutation({
    mutationFn: () => renombrarCargo(cargo.id, nombre.trim()),
    onSuccess: alHecho,
    onError: (causa) => alFallar(causa, 'No se pudo renombrar el cargo.'),
  })
  const unaVez = useUnaVez()
  useRetenerLaSesion(true)
  const cambia = nombre.trim() !== '' && nombre.trim() !== cargo.nombre
  const usos = [
    cargo.vacantes > 0 && `${cargo.vacantes} ${cargo.vacantes === 1 ? 'vacante' : 'vacantes'}`,
    cargo.colaboradores > 0 && `${cargo.colaboradores} ${cargo.colaboradores === 1 ? 'persona' : 'personas'}`,
  ].filter(Boolean)

  return (
    <div className={estilos.edicion}>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nombre nuevo de «{cargo.nombre}»</span>
        <input
          className={estilos.entrada}
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <p className={estilos.aviso} role="note">
        El nombre nuevo sale en todas partes: en las vacantes, en las solicitudes y en las fichas
        {usos.length > 0 ? `. Hoy lo usan ${usos.join(' y ')}.` : '.'}
      </p>
      <div className={estilos.botones}>
        <button
          className={estilos.guardar}
          type="button"
          disabled={cambio.isPending || !cambia}
          onClick={() => unaVez(() => cambio.mutateAsync())}
        >
          {cambio.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button className={estilos.chico} type="button" onClick={alCerrar}>
          Dejarlo
        </button>
      </div>
    </div>
  )
}
