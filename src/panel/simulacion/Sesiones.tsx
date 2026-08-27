/**
 * Las sesiones de simulacion, para quien las organiza.
 *
 * Recursos Humanos crea fechas; los candidatos eligen la que les convenga
 * desde el portal. Publicar una sesion mueve a quien estaba esperando fecha.
 *
 * Cada fila se abre y enseña **quien** eligio esa fecha, con la asistencia. La
 * lista vive en `Inscritos.tsx` porque pide un permiso distinto al de esta
 * pantalla y tiene sus propias ramas de fallo.
 *
 * ⚠️ **Entrar aqui ya no implica poder gestionar.** Los dos GET de sesiones
 * admiten `crear_sesiones_simulacion` **o** `ver_inscritos_simulacion`, pero
 * crear, ampliar el cupo y cancelar siguen pidiendo el primero. Un responsable
 * de area llega a esta tabla y esos tres botones le responden 403.
 *
 * No hay forma de saberlo antes: `Sesion` es `{token, usuarioId}` y no existe
 * un `GET /panel/auth/yo`. Asi que **se aprende del 403 en vez de adivinarlo**:
 * el primero retira las acciones y explica por que, en lugar de dejarlas ahi
 * fallando una y otra vez.
 */

import { Fragment, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ampliarCupo,
  cancelarSesion,
  crearSesion,
  listarSesiones,
  listarVacantes,
} from '../api/panel'
import type { CrearSesion } from '../api/tipos'
import { ErrorApi } from '../api/cliente'
import { formatearFechaLarga } from '@/dominio/reloj'
import { Inscritos } from './Inscritos'
import tabla from '../ui/Tabla.module.css'
import estilos from './Sesiones.module.css'

export function SesionesPanel() {
  const cache = useQueryClient()
  const [creando, setCreando] = useState(false)
  const [abierta, setAbierta] = useState<number | null>(null)

  const sesiones = useQuery({ queryKey: ['panel-sesiones'], queryFn: listarSesiones })
  const vacantes = useQuery({ queryKey: ['panel-vacantes'], queryFn: listarVacantes })

  const invalidar = () => cache.invalidateQueries({ queryKey: ['panel-sesiones'] })

  const [fallo, setFallo] = useState<string | null>(null)
  // Se enciende con el primer 403 de gestion y ya no se apaga: ver la tabla y
  // poder tocarla son dos permisos distintos desde que los GET se ampliaron.
  const [sinGestion, setSinGestion] = useState(false)

  /** Un 403 aqui es la respuesta correcta a algo que este rol no puede hacer. */
  function alFallar(causa: unknown, porDefecto: string) {
    if (causa instanceof ErrorApi && causa.estado === 403) {
      setSinGestion(true)
      setCreando(false)
      setFallo(null)
      return
    }
    setFallo(causa instanceof Error ? causa.message : porDefecto)
  }

  const cancelacion = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) => cancelarSesion(id, motivo),
    onSuccess: invalidar,
    onError: (c) => alFallar(c, 'No se pudo cancelar.'),
  })
  const ampliacion = useMutation({
    mutationFn: ({ id, cupo }: { id: number; cupo: number }) => ampliarCupo(id, cupo),
    onSuccess: invalidar,
    onError: (c) => alFallar(c, 'No se pudo ampliar.'),
  })

  const nombreDeVacante = (id: number) =>
    vacantes.data?.find((v) => v.id === id)?.titulo ?? `Vacante ${id}`

  return (
    <div className={estilos.pagina}>
      <div className={estilos.cabecera}>
        <div>
          <h1>Sesiones de simulación.</h1>
          <p className={estilos.bajada}>
            Las fechas que se ofrecen a los candidatos. Cada uno elige la suya desde el
            portal; aquí se ve cuántas plazas quedan.
          </p>
        </div>
        {!sinGestion && (
          <button className={estilos.crear} type="button" onClick={() => setCreando((v) => !v)}>
            {creando ? 'Cerrar el formulario' : 'Crear sesión'}
          </button>
        )}
      </div>

      {sinGestion && (
        <p className={estilos.soloLectura} role="status">
          <b>Tu rol ve estas sesiones pero no las gestiona.</b> Crear fechas, ampliar el cupo
          y cancelar son de quien organiza la simulación. Lo que sí puedes hacer es abrir una
          fecha para ver quién la eligió y pasar lista.
        </p>
      )}

      {creando && !sinGestion && (
        <FormularioDeSesion
          alCrear={async () => {
            setCreando(false)
            await invalidar()
          }}
          alNoPoder={() => {
            setSinGestion(true)
            setCreando(false)
          }}
        />
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {sesiones.isPending && <p className={estilos.aviso}>Cargando las sesiones…</p>}
      {sesiones.data && (
        <div className={tabla.envoltura}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th className={estilos.cuando}>Cuándo</th>
                <th>Modalidad</th>
                <th>Dónde</th>
                <th className={tabla.cifra}>Inscritos</th>
                <th>Estado</th>
                <th>Para qué vacantes</th>
                <th className={tabla.acciones} />
              </tr>
            </thead>
            <tbody>
              {sesiones.data.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td className={estilos.cuando}>
                      {formatearFechaLarga(s.fechaHora)} · {s.duracionMinutos} min
                    </td>
                    <td>{s.modalidad === 'GRUPAL' ? 'Grupal' : 'Individual'}</td>
                    <td>{s.lugar ?? s.enlace ?? '—'}</td>
                    <td className={tabla.cifra}>
                      {s.inscritos} de {s.cupo}
                    </td>
                    <td>{s.estado}</td>
                    <td>{s.vacanteIds.map(nombreDeVacante).join(', ') || '—'}</td>
                    <td className={tabla.acciones}>
                      <div className={estilos.accionesFila}>
                        {/*
                          Abrir es un boton propio y no la fila entera: la fila
                          lleva dentro dos acciones que borran, y una zona
                          pulsable alrededor de ellas convierte cualquier fallo
                          de punteria en algo que no se queria hacer.
                        */}
                        <button
                          className={estilos.chico}
                          type="button"
                          onClick={() => setAbierta((a) => (a === s.id ? null : s.id))}
                          aria-expanded={abierta === s.id}
                        >
                          {abierta === s.id ? 'Cerrar' : 'Ver quién viene'}
                        </button>
                        {s.estado !== 'CANCELADA' && !sinGestion && (
                          <>
                            <button
                              className={estilos.chico}
                              type="button"
                              onClick={() => ampliacion.mutate({ id: s.id, cupo: s.cupo + 1 })}
                              disabled={ampliacion.isPending}
                            >
                              +1 al cupo
                            </button>
                            <button
                              className={`${estilos.chico} ${estilos.peligro}`}
                              type="button"
                              onClick={() => {
                                // La cancelacion avisa a los inscritos y los manda a
                                // elegir otra fecha: pide confirmacion y motivo.
                                const motivo = window.prompt(
                                  `Cancelar la sesión del ${formatearFechaLarga(s.fechaHora)}. ¿Motivo?`,
                                )
                                if (motivo && motivo.trim() !== '') {
                                  cancelacion.mutate({ id: s.id, motivo: motivo.trim() })
                                }
                              }}
                              disabled={cancelacion.isPending}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {abierta === s.id && (
                    <tr className={tabla.detalle}>
                      <td colSpan={7}>
                        <Inscritos sesionId={s.id} aforo={s.cupo} inscritos={s.inscritos} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {sesiones.data.length === 0 && (
                <tr>
                  <td colSpan={7} className={tabla.vacia}>
                    No hay sesiones creadas. Quien llegue a la etapa de simulación esperará
                    hasta que exista una con cupo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}

// ---------- El alta de una sesion ----------

function FormularioDeSesion({
  alCrear,
  alNoPoder,
}: {
  alCrear: () => Promise<void>
  alNoPoder: () => void
}) {
  const vacantes = useQuery({ queryKey: ['panel-vacantes'], queryFn: listarVacantes })

  const [datos, setDatos] = useState({
    fecha: '',
    hora: '09:00',
    duracionMinutos: '120',
    modalidad: 'GRUPAL' as 'GRUPAL' | 'INDIVIDUAL',
    lugar: '',
    enlace: '',
    cupo: '5',
    enunciado: '',
  })
  const [paraVacantes, setParaVacantes] = useState<Set<number>>(new Set())
  const [fallo, setFallo] = useState<string | null>(null)

  const creacion = useMutation({
    mutationFn: (cuerpo: CrearSesion) => crearSesion(cuerpo),
    onSuccess: alCrear,
    onError: (c) => {
      // El formulario se cierra entero: lo escrito aqui no sirve de nada si el
      // rol no puede crear sesiones, y dejarlo abierto invita a reintentarlo.
      if (c instanceof ErrorApi && c.estado === 403) {
        alNoPoder()
        return
      }
      setFallo(c instanceof Error ? c.message : 'No se pudo crear la sesión.')
    },
  })

  function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    if (!datos.fecha || !datos.hora) {
      setFallo('La sesión necesita fecha y hora.')
      return
    }
    if (paraVacantes.size === 0) {
      setFallo('Marca al menos una vacante: sin eso, nadie puede inscribirse.')
      return
    }
    creacion.mutate({
      fechaHora: new Date(`${datos.fecha}T${datos.hora}`).toISOString(),
      duracionMinutos: Number(datos.duracionMinutos) || 120,
      modalidad: datos.modalidad,
      lugar: datos.lugar.trim() || undefined,
      enlace: datos.enlace.trim() || undefined,
      cupo: Number(datos.cupo) || 1,
      enunciado: datos.enunciado.trim() || undefined,
      vacanteIds: [...paraVacantes],
    })
  }

  const publicadas = (vacantes.data ?? []).filter((v) => v.estado === 'PUBLICADA')

  return (
    <form className={estilos.alta} onSubmit={alEnviar} noValidate>
      <h2 className={estilos.tituloAlta}>Sesión nueva</h2>
      <div className={estilos.rejilla}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Fecha</span>
          <input
            className={estilos.entrada}
            type="date"
            value={datos.fecha}
            onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value }))}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Hora</span>
          <input
            className={estilos.entrada}
            type="time"
            value={datos.hora}
            onChange={(e) => setDatos((d) => ({ ...d, hora: e.target.value }))}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Duración en minutos</span>
          <input
            className={estilos.entrada}
            type="text"
            inputMode="numeric"
            value={datos.duracionMinutos}
            onChange={(e) => setDatos((d) => ({ ...d, duracionMinutos: e.target.value }))}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Modalidad</span>
          <select
            className={estilos.entrada}
            value={datos.modalidad}
            onChange={(e) =>
              setDatos((d) => ({ ...d, modalidad: e.target.value as 'GRUPAL' | 'INDIVIDUAL' }))
            }
          >
            <option value="GRUPAL">Grupal</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Lugar (si es presencial)</span>
          <input
            className={estilos.entrada}
            type="text"
            value={datos.lugar}
            onChange={(e) => setDatos((d) => ({ ...d, lugar: e.target.value }))}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Enlace (si es remota)</span>
          <input
            className={estilos.entrada}
            type="text"
            value={datos.enlace}
            onChange={(e) => setDatos((d) => ({ ...d, enlace: e.target.value }))}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Cupo</span>
          <input
            className={estilos.entrada}
            type="text"
            inputMode="numeric"
            value={datos.cupo}
            onChange={(e) => setDatos((d) => ({ ...d, cupo: e.target.value }))}
          />
        </label>
      </div>

      <fieldset className={estilos.grupoVacantes}>
        <legend className={estilos.etiqueta}>Para qué vacantes se ofrece</legend>
        {publicadas.length === 0 && (
          <p className={estilos.aviso}>No hay vacantes publicadas a las que ofrecerla.</p>
        )}
        {publicadas.map((v) => (
          <label className={estilos.opcionVacante} key={v.id}>
            <input
              type="checkbox"
              checked={paraVacantes.has(v.id)}
              onChange={() =>
                setParaVacantes((antes) => {
                  const nuevas = new Set(antes)
                  if (nuevas.has(v.id)) nuevas.delete(v.id)
                  else nuevas.add(v.id)
                  return nuevas
                })
              }
            />
            {v.titulo}
          </label>
        ))}
      </fieldset>

      <label className={`${estilos.campo} ${estilos.anchoEntero}`}>
        <span className={estilos.etiqueta}>Sobre la sesión (lo ve el candidato)</span>
        <textarea
          className={estilos.area}
          value={datos.enunciado}
          onChange={(e) => setDatos((d) => ({ ...d, enunciado: e.target.value }))}
        />
      </label>

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      <button className={estilos.enviar} type="submit" disabled={creacion.isPending}>
        {creacion.isPending ? 'Creando…' : 'Crear la sesión'}
      </button>
    </form>
  )
}
