/**
 * Qué puede cada rol, y con qué alcance.
 *
 * Hasta ahora el reparto se tocaba entrando a la base a mano. El backend abrió
 * `rol_permiso` al panel, así que esto se edita en caliente: **el cambio vale
 * desde la petición siguiente de cada afectado**, sin desplegar y sin que nadie
 * vuelva a entrar.
 *
 * ⚠️ **Esta pantalla se puede usar contra sí misma.** Quien escribe aquí puede
 * concederse cualquier cosa, así que el permiso es propio —`administrar_permisos`,
 * no el de crear usuarios— y cada cambio pide un motivo que queda auditado. Eso
 * no es burocracia: cambia lo que un grupo de personas puede hacer con los datos
 * de candidatos reales, y si alguien pregunta después por qué su equipo empezó a
 * ver algo, la respuesta tiene que estar escrita.
 *
 * ⚠️ **Hacen falta dos permisos, no uno.** La matriz es de `administrar_permisos`
 * pero elegir el rol necesita `crear_usuarios_y_asignar_roles`, que es lo que
 * abre `GET /roles`. Hoy solo Administrador tiene los dos; conceder el primero
 * sin el segundo deja a alguien mirando una lista de roles vacía. Se dice cuál
 * de los dos falta en vez de pintar «no pudimos cargar».
 *
 * ⚠️ **`PROPIO` casi nunca es lo que se quiere aquí.** Se lee de la persona que
 * llama, y en el panel nadie mira su propia postulación: en toda la simulación
 * el backend lo trata como «no alcanza a nadie». Se ofrece porque existe, con la
 * advertencia al lado.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { concederPermiso, listarRoles, permisosDelRol, revocarPermiso } from '../api/panel'
import type { AlcancePermiso, PermisoDelRol } from '../api/tipos'
import estilos from './Permisos.module.css'

/** Lo que se elige en la fila. `QUITAR` no es un alcance: es no tenerlo. */
type Eleccion = AlcancePermiso | 'QUITAR'

const ALCANCES: { valor: Eleccion; nombre: string; explica: string }[] = [
  { valor: 'QUITAR', nombre: 'No lo tiene', explica: 'El rol no puede hacerlo.' },
  { valor: 'TODO', nombre: 'Todo', explica: 'Sobre cualquier vacante o candidato de la empresa.' },
  {
    valor: 'SUS_VACANTES',
    nombre: 'Sus vacantes',
    explica: 'Solo donde figura como responsable de la vacante.',
  },
  {
    valor: 'PROPIO',
    nombre: 'Propio',
    explica:
      'Solo sobre su propia postulación. En el panel esto casi siempre equivale a no alcanzar a nadie.',
  },
]

/**
 * Los grupos del catálogo, con acento.
 *
 * El backend los manda en mayúsculas y sin tildes. Traducirlos aquí es
 * presentación de un enum conocido, no inventar: uno que no esté en el mapa sale
 * tal cual en vez de perderse.
 */
const GRUPOS: Record<string, string> = {
  CANDIDATOS: 'Candidatos',
  CIERRE: 'Postulaciones y cierre',
  CONFIGURACION: 'Configuración',
  EVALUACION: 'Evaluación y decisión',
  METRICAS: 'Métricas',
  SESIONES: 'Simulación',
  SOLICITUDES: 'Solicitudes de talento',
  VACANTES: 'Vacantes',
  VALIDACION: 'Validación',
}

export function Permisos() {
  const [rolId, setRolId] = useState<number | null>(null)
  const roles = useQuery({ queryKey: ['panel-roles'], queryFn: listarRoles })

  const sinPermisoDeRoles = roles.error instanceof ErrorApi && roles.error.estado === 403

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Qué puede cada rol</h2>
      <p className={estilos.nota}>
        El reparto de permisos, editable en caliente: un cambio aquí vale desde la siguiente
        acción de cada persona afectada, sin que tenga que volver a entrar —y sin que reciba
        aviso—. Cada cambio pide un motivo y queda auditado.
      </p>

      {sinPermisoDeRoles && (
        <p className={estilos.sinPermiso}>
          Para editar el reparto hacen falta <b>dos</b> permisos: «Cambiar qué puede cada rol»
          para la matriz y «Crear usuarios y asignar roles» para poder listar los roles. Tienes
          uno de los dos.
        </p>
      )}

      {roles.isError && !sinPermisoDeRoles && (
        <p className={estilos.avisoMalo} role="alert">
          No pudimos traer los roles.{' '}
          <button className={estilos.enlace} type="button" onClick={() => roles.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {roles.data && roles.data.length > 0 && (
        <>
          <div className={estilos.selectorRol} role="group" aria-label="Rol que se edita">
            {roles.data.map((r) => (
              <button
                className={`${estilos.pestanaRol} ${rolId === r.id ? estilos.pestanaViva : ''}`}
                type="button"
                key={r.id}
                aria-pressed={rolId === r.id}
                onClick={() => setRolId((a) => (a === r.id ? null : r.id))}
              >
                {r.nombre ?? r.codigo}
              </button>
            ))}
          </div>

          {rolId === null ? (
            <p className={estilos.nota}>
              Elige un rol para ver el catálogo entero y qué tiene concedido.
            </p>
          ) : (
            <MatrizDelRol rolId={rolId} />
          )}
        </>
      )}
    </section>
  )
}

// ---------- La matriz de un rol ----------

function MatrizDelRol({ rolId }: { rolId: number }) {
  const cache = useQueryClient()
  const consulta = useQuery({
    queryKey: ['panel-permisos-rol', rolId],
    queryFn: () => permisosDelRol(rolId),
  })

  const [editando, setEditando] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const cambio = useMutation({
    mutationFn: ({ codigo, eleccion, motivo }: { codigo: string; eleccion: Eleccion; motivo: string }) =>
      eleccion === 'QUITAR'
        ? revocarPermiso(rolId, codigo, motivo)
        : concederPermiso(rolId, codigo, eleccion, motivo),
    onSuccess: async () => {
      setEditando(null)
      await cache.invalidateQueries({ queryKey: ['panel-permisos-rol', rolId] })
    },
    // El 409 del último «administrar_permisos» trae su explicación completa: se
    // enseña tal cual porque dice exactamente por qué no se puede.
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo guardar el cambio.'),
  })

  if (consulta.isPending) return <p className={estilos.nota}>Cargando el catálogo…</p>

  if (consulta.error instanceof ErrorApi && consulta.error.estado === 403) {
    return (
      <p className={estilos.sinPermiso}>
        Tu rol puede ver quién forma el equipo, pero no redefinir lo que cada rol significa.
        Son dos cosas distintas a propósito: asignar un rol a alguien es una, y cambiar lo que
        ese rol puede hacer con los datos de los candidatos es bastante mayor.
      </p>
    )
  }

  if (consulta.isError && !consulta.data) {
    return (
      <p className={estilos.avisoMalo} role="alert">
        No pudimos traer los permisos de este rol.{' '}
        <button className={estilos.enlace} type="button" onClick={() => consulta.refetch()}>
          Volver a intentarlo
        </button>
      </p>
    )
  }

  // Llega ordenado por grupo y orden desde el backend: se agrupa conservando ese
  // orden, no se reordena. Dentro de un grupo el orden es el del proceso.
  const porGrupo: [string, PermisoDelRol[]][] = []
  for (const p of consulta.data ?? []) {
    const ultimo = porGrupo.at(-1)
    if (ultimo && ultimo[0] === p.grupo) ultimo[1].push(p)
    else porGrupo.push([p.grupo, [p]])
  }

  const concedidos = (consulta.data ?? []).filter((p) => p.alcance !== null).length

  return (
    <div className={estilos.matriz}>
      <p className={estilos.recuento}>
        {concedidos} de {consulta.data?.length ?? 0} permisos concedidos
      </p>

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {porGrupo.map(([grupo, permisos]) => (
        <div className={estilos.grupo} key={grupo}>
          <h3 className={estilos.tituloGrupo}>{GRUPOS[grupo] ?? grupo}</h3>
          <ul className={estilos.filas} role="list">
            {permisos.map((p) => (
              <FilaPermiso
                key={p.codigo}
                permiso={p}
                editando={editando === p.codigo}
                guardando={cambio.isPending}
                alAbrir={() => {
                  setFallo(null)
                  setEditando(p.codigo)
                }}
                alCerrar={() => setEditando(null)}
                alGuardar={(eleccion, motivo) => cambio.mutate({ codigo: p.codigo, eleccion, motivo })}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function FilaPermiso({
  permiso,
  editando,
  guardando,
  alAbrir,
  alCerrar,
  alGuardar,
}: {
  permiso: PermisoDelRol
  editando: boolean
  guardando: boolean
  alAbrir: () => void
  alCerrar: () => void
  alGuardar: (eleccion: Eleccion, motivo: string) => void
}) {
  return (
    <li className={estilos.fila}>
      <div className={estilos.queEs}>
        <span className={estilos.etiquetaPermiso}>{permiso.etiqueta}</span>
        <code className={estilos.codigo}>{permiso.codigo}</code>
      </div>

      {editando ? (
        /*
         * La `key` lleva el alcance dentro a proposito: si el valor del servidor
         * cambia —lo guardamos, o lo cambio otra sesion— el editor se remonta y
         * arranca de lo que hay ahora. Sin eso conservaria la eleccion vieja y
         * ofreceria guardar algo que ya estaba puesto.
         */
        <EditorDeAlcance
          key={`${permiso.codigo}-${permiso.alcance ?? 'QUITAR'}`}
          actual={permiso.alcance ?? 'QUITAR'}
          guardando={guardando}
          alGuardar={alGuardar}
          alCerrar={alCerrar}
        />
      ) : (
        <div className={estilos.estado}>
          <MarcaDeAlcance alcance={permiso.alcance} />
          <button className={estilos.chico} type="button" onClick={alAbrir}>
            Cambiar
          </button>
        </div>
      )}
    </li>
  )
}

function EditorDeAlcance({
  actual,
  guardando,
  alGuardar,
  alCerrar,
}: {
  actual: Eleccion
  guardando: boolean
  alGuardar: (eleccion: Eleccion, motivo: string) => void
  alCerrar: () => void
}) {
  const [eleccion, setEleccion] = useState<Eleccion>(actual)
  const [motivo, setMotivo] = useState('')

  const elegido = ALCANCES.find((a) => a.valor === eleccion)
  const cambia = eleccion !== actual

  return (
        <div className={estilos.edicion}>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Alcance</span>
            <select
              className={estilos.entrada}
              value={eleccion}
              onChange={(e) => setEleccion(e.target.value as Eleccion)}
            >
              {ALCANCES.map((a) => (
                <option value={a.valor} key={a.valor}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          {elegido && <p className={estilos.explica}>{elegido.explica}</p>}

          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Motivo del cambio</span>
            <input
              className={estilos.entrada}
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>

          <div className={estilos.botones}>
            <button
              className={estilos.guardar}
              type="button"
              disabled={guardando || motivo.trim() === '' || !cambia}
              onClick={() => alGuardar(eleccion, motivo.trim())}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button className={estilos.chico} type="button" onClick={alCerrar}>
              Cancelar
            </button>
          </div>
          {!cambia && (
            <p className={estilos.explica}>Elige un alcance distinto del que ya tiene.</p>
          )}
        </div>
  )
}

/**
 * Los cuatro estados de una casilla.
 *
 * Se distinguen por la forma antes que por el color: contorno punteado lo que
 * no está concedido, relleno lo que sí, y `Propio` lleva punto porque es el que
 * parece un permiso y en el panel casi nunca alcanza a nadie.
 */
function MarcaDeAlcance({ alcance }: { alcance: AlcancePermiso | null }) {
  if (alcance === null) {
    return <span className={`${estilos.marca} ${estilos.noTiene}`}>No lo tiene</span>
  }
  if (alcance === 'TODO') {
    return <span className={`${estilos.marca} ${estilos.todo}`}>Todo</span>
  }
  if (alcance === 'SUS_VACANTES') {
    return <span className={`${estilos.marca} ${estilos.suyas}`}>Sus vacantes</span>
  }
  return <span className={`${estilos.marca} ${estilos.propio}`}>Propio</span>
}
