/**
 * Las sedes de la empresa (V64): dónde se trabaja.
 *
 * Mismo patrón de lista y acciones que las áreas. Quien no tiene
 * `editar_estructura` las ve sin acciones. **No se borran**: se desactivan, y
 * una sede desactivada deja de poder elegirse en altas, cambios y cargas,
 * mientras quien ya está en ella la conserva.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoUbigeo } from '@/api/portal'
import { agrupadasPorDepartamento } from '@/dominio/ubigeo'
import {
  crearSede,
  desactivarSede,
  editarSede,
  listarSedes,
  reactivarSede,
} from '../api/estructura'
import type { GuardarSede, SedePanel } from '../api/tiposPersonas'
import estilos from './Areas.module.css'
import { useRetenerLaSesion } from '../Sesion'
import { AvisoDeFallo, explicarFallo, useUnaVez } from '../ui/Envio'

const VACIA: GuardarSede = { nombre: '', direccion: null, provinciaUbigeo: null, codigoSunat: null }

export function Sedes() {
  const cache = useQueryClient()
  const sedes = useQuery({ queryKey: ['panel-sedes'], queryFn: listarSedes })
  const [editando, setEditando] = useState<number | null>(null)
  const [fallo, setFallo] = useState<ReactNode>(null)

  async function refrescar() {
    setEditando(null)
    setFallo(null)
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['panel-sedes'] }),
      cache.invalidateQueries({ queryKey: ['panel-colaboradores-opciones'] }),
    ])
  }

  const noSePudo = (causa: unknown, porDefecto: string) =>
    setFallo(explicarFallo(causa, porDefecto))

  const puedeEditar = sedes.data?.puedeEditar ?? false

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Sedes</h2>
      <p className={estilos.nota}>
        Los locales de la empresa. Cada colaborador trabaja en una. Una sede no se borra: se
        desactiva, y quien ya está en ella la conserva.
      </p>

      {sedes.isError && (
        <p className={estilos.avisoMalo} role="alert">
          No pudimos traer las sedes.{' '}
          <button className={estilos.enlace} type="button" onClick={() => sedes.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {sedes.data && (
        <>
          {puedeEditar && (
            <FormularioDeSede
              inicial={VACIA}
              enviar={(datos) => crearSede(datos).then(() => undefined)}
              alHecho={refrescar}
              alFallar={noSePudo}
              texto="Añadir"
              enviando="Añadiendo…"
              limpiarAlTerminar
            />
          )}

          {fallo && <AvisoDeFallo className={estilos.avisoMalo}>{fallo}</AvisoDeFallo>}

          {sedes.data.sedes.length === 0 ? (
            <p className={estilos.vacio}>
              Todavía no hay ninguna sede. Hace falta al menos una para dar de alta colaboradores.
            </p>
          ) : (
            <ul className={estilos.filas} role="list">
              {sedes.data.sedes.map((sede) => (
                <FilaDeSede
                  key={sede.id}
                  sede={sede}
                  puedeEditar={puedeEditar}
                  editando={editando === sede.id}
                  alEditar={() => {
                    setFallo(null)
                    setEditando(sede.id)
                  }}
                  alCerrar={() => setEditando(null)}
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

function FilaDeSede({
  sede,
  puedeEditar,
  editando,
  alEditar,
  alCerrar,
  alHecho,
  alFallar,
}: {
  sede: SedePanel
  puedeEditar: boolean
  editando: boolean
  alEditar: () => void
  alCerrar: () => void
  alHecho: () => Promise<void>
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const unaVez = useUnaVez()
  const actividad = useMutation({
    mutationFn: () => (sede.esActiva ? desactivarSede(sede.id) : reactivarSede(sede.id)),
    onSuccess: alHecho,
    onError: (causa) => alFallar(causa, 'No se pudo cambiar el estado de la sede.'),
  })

  const detalle = [sede.direccion, sede.provinciaNombre, sede.codigoSunat && `SUNAT ${sede.codigoSunat}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={`${estilos.fila} ${sede.esActiva ? '' : estilos.filaRetirada}`}>
      <div className={estilos.queEs}>
        <span className={estilos.nombre}>{sede.nombre}</span>
        {sede.esActiva ? (
          <span className={`${estilos.marca} ${estilos.viva}`}>Activa</span>
        ) : (
          <span className={`${estilos.marca} ${estilos.retirada}`}>Desactivada</span>
        )}
      </div>
      {detalle && <span className={estilos.explica}>{detalle}</span>}

      {puedeEditar && !editando && (
        <div className={estilos.acciones}>
          <button className={estilos.chico} type="button" onClick={alEditar}>
            Editar
          </button>
          <button
            className={estilos.chico}
            type="button"
            onClick={() => unaVez(() => actividad.mutateAsync())}
            disabled={actividad.isPending}
          >
            {sede.esActiva ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      )}

      {editando && (
        <div className={estilos.edicion}>
          <FormularioDeSede
            inicial={{
              nombre: sede.nombre,
              direccion: sede.direccion,
              provinciaUbigeo: sede.provinciaUbigeo,
              codigoSunat: sede.codigoSunat,
            }}
            enviar={(datos) => editarSede(sede.id, datos)}
            alHecho={alHecho}
            alFallar={alFallar}
            texto="Guardar"
            enviando="Guardando…"
            alCancelar={alCerrar}
          />
        </div>
      )}
    </li>
  )
}

function FormularioDeSede({
  inicial,
  enviar,
  alHecho,
  alFallar,
  texto,
  enviando,
  alCancelar,
  limpiarAlTerminar,
}: {
  inicial: GuardarSede
  enviar: (datos: GuardarSede) => Promise<void>
  alHecho: () => Promise<void>
  alFallar: (causa: unknown, porDefecto: string) => void
  texto: string
  enviando: string
  alCancelar?: () => void
  limpiarAlTerminar?: boolean
}) {
  const [nombre, setNombre] = useState(inicial.nombre)
  const [direccion, setDireccion] = useState(inicial.direccion ?? '')
  const [provincia, setProvincia] = useState(inicial.provinciaUbigeo ?? '')
  const [codigo, setCodigo] = useState(inicial.codigoSunat ?? '')
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null)
  const ubigeo = useQuery({ queryKey: ['catalogo-ubigeo'], queryFn: catalogoUbigeo })
  const { departamentos, sueltas } = useMemo(
    () => agrupadasPorDepartamento(Array.isArray(ubigeo.data) ? ubigeo.data : []),
    [ubigeo.data],
  )

  const unaVez = useUnaVez()
  const guardado = useMutation({
    mutationFn: () =>
      enviar({
        nombre: nombre.trim(),
        direccion: direccion.trim() === '' ? null : direccion.trim(),
        provinciaUbigeo: provincia === '' ? null : provincia,
        codigoSunat: codigo.trim() === '' ? null : codigo.trim(),
      }),
    onSuccess: async () => {
      if (limpiarAlTerminar) {
        setNombre('')
        setDireccion('')
        setProvincia('')
        setCodigo('')
      }
      await alHecho()
    },
    onError: (causa) => alFallar(causa, 'No se pudo guardar la sede.'),
  })
  // Editar una sede, o empezar a escribir una nueva: si la sesión caduca, no se pierde.
  useRetenerLaSesion(!limpiarAlTerminar || nombre.trim() !== '' || direccion.trim() !== '' || codigo.trim() !== '')

  return (
    <form
      className={estilos.anadir}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim() === '' || guardado.isPending) return
        if (codigo.trim() !== '' && !/^\d{4}$/.test(codigo.trim())) {
          setErrorCodigo('El código de establecimiento de SUNAT tiene 4 dígitos.')
          return
        }
        setErrorCodigo(null)
        unaVez(() => guardado.mutateAsync())
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nombre de la sede</span>
        <input
          className={estilos.entrada}
          type="text"
          value={nombre}
          placeholder="Planta Ventanilla"
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Dirección · opcional</span>
        <input
          className={estilos.entrada}
          type="text"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Provincia · opcional</span>
        <select
          className={estilos.entrada}
          value={provincia}
          disabled={ubigeo.isPending}
          onChange={(e) => setProvincia(e.target.value)}
        >
          <option value="">{ubigeo.isPending ? 'Cargando…' : 'Sin indicar'}</option>
          {departamentos.map(([departamento, provincias]) => (
            <optgroup key={departamento} label={departamento}>
              {provincias.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          ))}
          {sueltas.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Código SUNAT · opcional</span>
        <input
          className={estilos.entrada}
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={codigo}
          placeholder="0001"
          aria-invalid={errorCodigo ? true : undefined}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </label>
      <div className={estilos.botones}>
        <button
          className={estilos.crear}
          type="submit"
          disabled={guardado.isPending || nombre.trim() === ''}
        >
          {guardado.isPending ? enviando : texto}
        </button>
        {alCancelar && (
          <button className={estilos.chico} type="button" onClick={alCancelar}>
            Dejarlo
          </button>
        )}
      </div>
      {errorCodigo && (
        <p className={estilos.avisoMalo} role="alert">
          {errorCodigo}
        </p>
      )}
    </form>
  )
}
