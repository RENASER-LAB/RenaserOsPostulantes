/**
 * La configuracion, en un solo sitio y en secciones que se entienden.
 *
 * Cada bloque dice que es y que pasa al tocarlo. Los parametros se editan con
 * motivo porque el backend audita cada cambio con el valor anterior; el banco
 * de preguntas entra por la plantilla Excel y, si el archivo tiene problemas,
 * el backend contesta con la lista completa y no importa nada.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  editarParametro,
  importarBanco,
  listarAreas,
  listarParametros,
  listarPlantillasEvaluacion,
  listarUsuarios,
  listarVersionesBanco,
  listarVersionesPesos,
  verCatalogos,
} from '../api/panel'
import { Permisos } from './Permisos'
import tabla from '../ui/Tabla.module.css'
import estilos from './Configuracion.module.css'

export function ConfiguracionPanel() {
  return (
    <div className={estilos.pagina}>
      <h1>Configuración.</h1>
      <p className={estilos.bajada}>
        Lo que gobierna el proceso: los plazos y reglas, el banco de preguntas, y quiénes
        forman el equipo. Cada cambio queda auditado.
      </p>

      <Parametros />
      <BancoDePreguntas />
      <Equipo />
      <Permisos />
      <SoloLectura />
    </div>
  )
}

// ---------- Parametros del sistema ----------

function Parametros() {
  const cache = useQueryClient()
  const parametros = useQuery({ queryKey: ['panel-parametros'], queryFn: listarParametros })

  const [editando, setEditando] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)

  const edicion = useMutation({
    mutationFn: () => editarParametro(editando ?? '', valor.trim(), motivo.trim()),
    onSuccess: async () => {
      setEditando(null)
      setMotivo('')
      await cache.invalidateQueries({ queryKey: ['panel-parametros'] })
    },
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo guardar.'),
  })

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Los plazos y reglas del proceso</h2>
      <p className={estilos.nota}>
        Editar pide un motivo: el cambio queda auditado junto al valor anterior.
      </p>

      {parametros.data && (
        <div className={tabla.envoltura}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th>Qué controla</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parametros.data.map((p) => (
                <tr key={p.codigo}>
                  <td>
                    <span className={estilos.codigoParametro}>{p.codigo}</span>
                    <span className={estilos.descripcionParametro}>{p.descripcion}</span>
                  </td>
                  <td className={estilos.valorParametro}>
                    {editando === p.codigo ? (
                      <div className={estilos.edicion}>
                        <input
                          className={estilos.entrada}
                          type="text"
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          aria-label={`Valor nuevo de ${p.codigo}`}
                        />
                        <input
                          className={estilos.entrada}
                          type="text"
                          placeholder="Motivo del cambio"
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          aria-label={`Motivo del cambio de ${p.codigo}`}
                        />
                      </div>
                    ) : (
                      p.valor
                    )}
                  </td>
                  <td>
                    {editando === p.codigo ? (
                      <div className={estilos.botonesEdicion}>
                        <button
                          className={estilos.chico}
                          type="button"
                          onClick={() => edicion.mutate()}
                          disabled={edicion.isPending || motivo.trim() === ''}
                        >
                          Guardar
                        </button>
                        <button
                          className={estilos.chico}
                          type="button"
                          onClick={() => setEditando(null)}
                        >
                          Dejarlo
                        </button>
                      </div>
                    ) : (
                      <button
                        className={estilos.chico}
                        type="button"
                        onClick={() => {
                          setEditando(p.codigo)
                          setValor(p.valor)
                          setMotivo('')
                          setFallo(null)
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

// ---------- El banco de preguntas ----------

function BancoDePreguntas() {
  const cache = useQueryClient()
  const versiones = useQuery({ queryKey: ['panel-banco'], queryFn: listarVersionesBanco })
  const catalogos = useQuery({ queryKey: ['panel-catalogos'], queryFn: verCatalogos })

  const [archivo, setArchivo] = useState<File | null>(null)
  const [nivel, setNivel] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const importacion = useMutation({
    mutationFn: () => importarBanco(archivo as File, nivel, etiqueta.trim()),
    onSuccess: async () => {
      setResultado('Banco importado: quedó como versión en borrador, lista para revisar y publicar.')
      setArchivo(null)
      setEtiqueta('')
      await cache.invalidateQueries({ queryKey: ['panel-banco'] })
    },
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo importar.'),
  })

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>El banco de preguntas</h2>
      <p className={estilos.nota}>
        Se importa desde la plantilla Excel. Si el archivo tiene problemas, el backend
        devuelve la lista completa y no importa nada: la versión solo se crea entera.
      </p>

      <div className={estilos.importar}>
        <input
          className={estilos.archivo}
          type="file"
          accept=".xlsx,.xls"
          aria-label="La plantilla Excel del banco"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <select
          className={estilos.entrada}
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          aria-label="Nivel del puesto al que pertenece el banco"
        >
          <option value="">Nivel del puesto…</option>
          {(catalogos.data?.nivelesPuesto ?? []).map((n) => (
            <option value={n.codigo} key={n.codigo}>
              {n.nombre}
            </option>
          ))}
        </select>
        <input
          className={estilos.entrada}
          type="text"
          placeholder="Etiqueta de la versión (p. ej. «v4 borrador septiembre»)"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
        />
        <button
          className={estilos.subir}
          type="button"
          onClick={() => importacion.mutate()}
          disabled={importacion.isPending || !archivo || nivel === '' || etiqueta.trim() === ''}
        >
          {importacion.isPending ? 'Importando…' : 'Importar el Excel'}
        </button>
      </div>
      {resultado && (
        <p className={estilos.avisoBien} role="status">
          {resultado}
        </p>
      )}
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {versiones.data && versiones.data.length > 0 && (
        <ul className={estilos.versiones} role="list">
          {versiones.data.map((v) => (
            <li className={estilos.version} key={v.id}>
              <span className={estilos.estadoVersion}>{String(v.estado)}</span>
              <span>
                {String(v.nombre ?? v.etiqueta ?? `Versión ${v.id}`)}
                {v.nivelPuestoCodigo ? ` · ${String(v.nivelPuestoCodigo)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------- El equipo ----------

function Equipo() {
  const usuarios = useQuery({ queryKey: ['panel-usuarios'], queryFn: listarUsuarios })
  const areas = useQuery({ queryKey: ['panel-areas'], queryFn: listarAreas })

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>El equipo y sus roles</h2>
      {usuarios.data && (
        <div className={tabla.envoltura}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th>Quién</th>
                <th>Roles</th>
                <th>Área</th>
                <th>Activo</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.correo ?? u.usuarioRenaserOsId ?? `Usuario ${u.id}`}</td>
                  <td>{u.roles.join(', ')}</td>
                  <td>{areas.data?.find((a) => a.id === u.areaId)?.nombre ?? '—'}</td>
                  <td>{u.esActivo ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------- Lo que se lee y todavia no se edita desde aqui ----------

function SoloLectura() {
  const plantillas = useQuery({
    queryKey: ['panel-plantillas-eva'],
    queryFn: listarPlantillasEvaluacion,
  })
  const pesos = useQuery({ queryKey: ['panel-pesos'], queryFn: listarVersionesPesos })

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Plantillas y pesos</h2>
      <p className={estilos.nota}>
        Se listan para saber qué hay. Editarlas tiene su flujo propio —borrador,
        validación, publicación— y todavía no está en este panel.
      </p>
      <div className={estilos.dosListas}>
        <div>
          <h3 className={estilos.subtitulo}>Plantillas de evaluación</h3>
          <ul className={estilos.versiones} role="list">
            {(plantillas.data ?? []).map((p) => (
              <li className={estilos.version} key={p.id}>
                <span className={estilos.estadoVersion}>{p.estado}</span>
                <span>
                  {p.nombre} · {p.nivelPuestoCodigo}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={estilos.subtitulo}>Versiones de pesos</h3>
          <ul className={estilos.versiones} role="list">
            {(pesos.data ?? []).map((p) => (
              <li className={estilos.version} key={p.id}>
                <span className={estilos.estadoVersion}>{p.estado}</span>
                <span>{p.etiqueta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
