/**
 * La simulacion de trabajo: elegir fecha y, ya inscrito, ver la agenda.
 *
 * Son dos momentos en una misma ruta y nunca coinciden: mientras no hay
 * inscripcion se enseñan las fechas, y en cuanto la hay se enseña la sesion.
 * Lo decide el backend, que contesta 404 al pedir «mi sesion» si todavia no se
 * eligio ninguna.
 *
 * Las fechas y sus plazas vienen del servidor, igual que los tramos de la
 * sesion. Nada de esto se escribe a mano.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inscribirse, miSesion, sesionesDisponibles } from '@/api/simulacion'
import { ErrorApi } from '@/api/cliente'
import { formatearFechaLarga, horaDelTramo } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cargando, Fallo } from '@/ui/Mensajes'
import { Vacio } from '@/ui/Vacio'
import estilos from './Simulacion.module.css'

export function Simulacion() {
  const { uuid = '' } = useParams()
  const avisar = useAviso()
  const cache = useQueryClient()
  const [elegida, setElegida] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Si ya esta inscrito, esta consulta trae la sesion. Si no, el backend
  // responde 404 y hay que enseñar las fechas disponibles.
  const inscripcion = useQuery({
    queryKey: ['mi-sesion', uuid],
    queryFn: () => miSesion(uuid),
    enabled: uuid !== '',
    retry: (intentos, causa) =>
      causa instanceof ErrorApi && causa.esAjeno ? false : intentos < 2,
  })

  const yaInscrito = inscripcion.isSuccess

  const disponibles = useQuery({
    queryKey: ['sesiones', uuid],
    queryFn: () => sesionesDisponibles(uuid),
    enabled: uuid !== '' && inscripcion.isError,
  })

  const inscripcionNueva = useMutation({
    mutationFn: (sesionId: number) => inscribirse(uuid, sesionId),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['mi-sesion', uuid] })
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      avisar('Asistencia confirmada.')
    },
    onError: async (causa) => {
      setError(causa instanceof Error ? causa.message : 'No pudimos confirmar la fecha.')

      // El motivo mas probable de que esto falle es que la sesion se llenara
      // entre que se cargo la lista y se pulso el boton. Enseñar el error sobre
      // una lista que ya no es cierta deja al candidato eligiendo entre fechas
      // que no existen, asi que se vuelve a pedir.
      setElegida(null)
      await cache.invalidateQueries({ queryKey: ['sesiones', uuid] })
    },
  })

  if (inscripcion.isPending) return <Cargando que="Revisando tu simulación…" />

  // ---------- Ya tiene fecha ----------

  if (yaInscrito) {
    const s = inscripcion.data
    const donde = [s.lugar, s.modalidad].filter(Boolean).join(' · ')

    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.proceso(uuid)}>
          ← Volver a mi proceso
        </Link>

        <div className={estilos.encabezado}>
          <h1>Tu fecha está reservada.</h1>
          <p className={estilos.bajada}>
            La simulación de trabajo es la cuarta etapa de tu proceso.
          </p>
        </div>

        {/*
          Sin acento: aqui ya no hay nada que hacer hasta el dia de la sesion, y
          el indigo significa exactamente lo contrario.
        */}
        <div className={estilos.confirmada}>
          <h2 className={estilos.cuandoGrande}>{formatearFechaLarga(s.fechaHora)}</h2>
          <span className={estilos.asistira}>Asistencia confirmada</span>
          <p className={estilos.detalleSesion}>
            {donde ? `${donde} · ` : ''}
            {s.duracionMinutos} minutos
          </p>
        </div>

        <div className={`${estilos.bloque} ${estilos.hundido}`}>
          <h2 className={estilos.tituloBloque}>Qué llevar</h2>
          <p className={estilos.textoBloque}>
            Tu documento de identidad y tu computadora con cargador. Llega diez minutos
            antes.
          </p>
          {s.enlace && (
            <a className={estilos.enlaceSesion} href={s.enlace} target="_blank" rel="noreferrer">
              {s.enlace}
            </a>
          )}
        </div>

        {s.enunciado && (
          <div className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Sobre la sesión</h2>
            <p className={estilos.textoBloque}>{s.enunciado}</p>
          </div>
        )}

        {s.tramos.length > 0 && (
          <div className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Así se desarrolla</h2>
            <div className={estilos.agenda}>
              {s.tramos.map((t) => (
                <div className={estilos.tramo} key={t.codigo}>
                  <span className={estilos.hora}>{horaDelTramo(s.fechaHora, t.minutoInicio)}</span>
                  <span className={estilos.queHay}>
                    {t.nombre}
                    <span className={estilos.duracion}>
                      {t.minutoFin - t.minutoInicio} minutos
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Es una regla del producto, no un adorno: la matriz de informacion no
            se entrega entera a proposito. */}
        <p className={estilos.preguntar}>
          Hay datos del encargo que no te vamos a dar de entrada. <b>Preguntar es parte
          de lo que se mira</b>.
        </p>
      </div>
    )
  }

  // ---------- Todavia tiene que elegir ----------

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      <div className={estilos.encabezado}>
        <h1>Elige tu fecha.</h1>
        <p className={estilos.bajada}>
          La simulación de trabajo es una sesión grupal, y trabajarás en tu propia pantalla
          dentro del sistema.
        </p>
      </div>

      {disponibles.isPending && <Cargando que="Buscando fechas disponibles…" />}
      {disponibles.isError && (
        <Fallo error={disponibles.error} reintentar={() => void disponibles.refetch()} />
      )}

      {disponibles.data &&
        (disponibles.data.length === 0 ? (
          <Vacio titulo="Todavía no hay fechas con cupo">
            En cuanto se publique una sesión para tu vacante te avisaremos y aparecerá
            aquí.
          </Vacio>
        ) : (
          <>
            <div className={estilos.fechas}>
              {disponibles.data.map((s) => {
                const llena = s.plazasLibres <= 0
                const marcada = elegida === s.id
                const donde = [s.lugar, s.modalidad].filter(Boolean).join(' · ')
                return (
                  <label
                    className={[
                      estilos.fecha,
                      marcada ? estilos.elegida : '',
                      llena ? estilos.llena : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={s.id}
                  >
                    <input
                      className={estilos.radio}
                      type="radio"
                      name="fecha"
                      checked={marcada}
                      disabled={llena}
                      onChange={() => {
                        setElegida(s.id)
                        setError(null)
                      }}
                    />
                    <span className={estilos.marca} aria-hidden="true" />
                    <span className={estilos.cuando}>
                      <b className={estilos.dia}>{formatearFechaLarga(s.fechaHora)}</b>
                      <span className={estilos.donde}>
                        {s.duracionMinutos} minutos{donde ? ` · ${donde}` : ''}
                      </span>
                    </span>
                    <span
                      className={`${estilos.plazas}${s.plazasLibres === 1 ? ` ${estilos.ultima}` : ''}`}
                    >
                      {llena
                        ? 'Sin plazas'
                        : `${s.plazasLibres} ${s.plazasLibres === 1 ? 'plaza' : 'plazas'}`}
                    </span>
                  </label>
                )
              })}
            </div>

            <p className={estilos.seLlenan}>
              Las plazas se van ocupando. Si se llenan todas antes de que elijas, esta
              pantalla te lo dirá y te avisaremos en cuanto abramos otra fecha.
            </p>

            {error && (
              <p className={estilos.fallo} role="alert">
                {error}
              </p>
            )}

            <div className={estilos.confirmar}>
              <button
                className={estilos.enviar}
                type="button"
                disabled={elegida === null || inscripcionNueva.isPending}
                onClick={() => {
                  if (elegida === null) return
                  inscripcionNueva.mutate(elegida)
                }}
              >
                {inscripcionNueva.isPending ? 'Confirmando…' : 'Confirmar asistencia'}
              </button>
              <span className={estilos.porCorreo}>
                Te llegará un correo con la confirmación. Para cambiar la fecha después
                tendrás que escribirle al equipo.
              </span>
            </div>
          </>
        ))}
    </div>
  )
}
