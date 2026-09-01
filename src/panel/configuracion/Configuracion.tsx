/**
 * La configuracion, en un solo sitio y en secciones que se entienden.
 *
 * Cada bloque dice que es y que pasa al tocarlo. Los parametros se editan con
 * motivo porque el backend audita cada cambio con el valor anterior. El banco
 * de preguntas tiene bloque propio: su ciclo —importar, publicar, archivar,
 * descartar— no cabe en una lista.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  editarParametro,
  listarParametros,
  listarPlantillasEvaluacion,
  listarTodasLasAreas,
  listarUsuarios,
  listarVersionesPesos,
} from '../api/panel'
import { Areas } from './Areas'
import { BancoDePreguntas } from './BancoDePreguntas'
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
      {/*
        Las áreas van pegadas al equipo y antes que él: un área es dónde trabaja
        alguien, así que la tabla de abajo no se entiende sin haber visto esta
        lista. Y crear la primera área es lo que desbloquea registrar solicitudes.
      */}
      <Areas />
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

// ---------- El equipo ----------

function Equipo() {
  const usuarios = useQuery({ queryKey: ['panel-usuarios'], queryFn: listarUsuarios })
  /*
   * ⚠️ La lista de TODAS, no la de las activas. Con la de activas, una persona de
   * un área retirada caía en el `?? '—'` de abajo, y ese guion significa «no
   * tiene área»: dos situaciones distintas pintadas igual, y la falsa es la que
   * hace pensar que al desactivar se perdió el dato. Quien ve esta tabla ya
   * tiene `crear_usuarios_y_asignar_roles`, que es el permiso de esa lista.
   */
  const areas = useQuery({ queryKey: ['panel-areas-todas'], queryFn: listarTodasLasAreas })

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
