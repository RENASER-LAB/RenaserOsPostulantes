/**
 * Quién eligió esta fecha, y quién vino.
 *
 * Se abre desde una fila de la tabla de sesiones. Hasta que el backend expuso
 * `GET /sesiones-simulacion/{id}/inscritos` el panel solo sabía **cuántos**
 * eran, y quien conducía la sesión llegaba a la sala sin saber a quién
 * esperaba. Con la lista llega además la `inscripcionId`, que es lo que piden
 * pasar lista y —el día que se construya— marcar los diez eventos observables.
 *
 * ⚠️ **La lista pide un permiso distinto al de la pantalla.** A las sesiones se
 * entra con `crear_sesiones_simulacion` **o** con `ver_inscritos_simulacion`, y
 * esto último es lo único que abre los nombres. Un 403 aquí no es un fallo: es
 * que ese rol organiza fechas y no ve identidades. Se dice con esas palabras y
 * no con «no pudimos cargar».
 *
 * ⚠️ **`asistio` tiene tres valores y los tres se distinguen sin color.** Vacío
 * es «nadie ha pasado lista todavía», que no es «no vino»: uno es una tarea
 * pendiente del equipo y el otro una decisión que ya cierra el paso de alguien.
 *
 * ⚠️ **Marcar «No vino» saca a la persona de esta lista, y no se deshace desde
 * aquí.** Comprobado contra el backend: `marcarAsistencia(false)` pone
 * `es_vigente = false`, y `listarInscritos` solo devuelve las vigentes. La
 * postulación vuelve a la bandeja del equipo, que decidirá entre otra fecha o
 * cerrar — nunca es automático.
 *
 * De ahí las dos cosas raras de esta pantalla, que no son descuidos:
 *
 *   1. **La ausencia pregunta antes.** Sin eso se pulsa, la fila se desvanece y
 *      no queda ni rastro de qué pasó ni de a quién le pasó.
 *   2. **`asistio === false` no llega nunca por esta ruta**, así que su píldora
 *      es defensiva: el contrato admite el valor y el panel no puede pintar
 *      «Sin pasar lista» si algún día llega. Lo que sí se ve es la fila
 *      marchándose, y eso se cuenta con el aviso de después.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { listarInscritos, marcarAsistencia } from '../api/panel'
import type { InscritoEnSesion } from '../api/tipos'
import { formatearFechaLarga } from '@/dominio/reloj'
import estilos from './Inscritos.module.css'

export function Inscritos({
  sesionId,
  aforo,
  inscritos: inscritosDeLaSesion,
}: {
  sesionId: number
  aforo: number
  /** El conteo que trae la sesion. Puede ser mayor que la lista: ver `Recuento`. */
  inscritos: number
}) {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)
  // Quien acaba de salir de la lista. Sin esto la fila se desvanece en silencio.
  const [seFue, setSeFue] = useState<string | null>(null)

  const consulta = useQuery({
    queryKey: ['panel-inscritos', sesionId],
    queryFn: () => listarInscritos(sesionId),
  })

  const lista = useMutation({
    mutationFn: ({
      inscripcionId,
      asistio,
    }: {
      inscripcionId: number
      asistio: boolean
      candidato: string
    }) => marcarAsistencia(inscripcionId, asistio),
    onMutate: () => {
      setFallo(null)
      setSeFue(null)
    },
    onSuccess: (_r, variables) => {
      if (!variables.asistio) setSeFue(variables.candidato)
      return cache.invalidateQueries({ queryKey: ['panel-inscritos', sesionId] })
    },
    onError: (causa) =>
      setFallo(
        causa instanceof ErrorApi && causa.estado === 403
          ? 'Tu rol no puede pasar lista en esta sesión.'
          : causa instanceof Error
            ? causa.message
            : 'No se pudo guardar la asistencia.',
      ),
  })

  if (consulta.isPending) {
    return <p className={estilos.aviso}>Buscando quién eligió esta fecha…</p>
  }

  // El 403 tiene su propia rama: es una respuesta correcta a una pregunta que
  // este rol no puede hacer, no un error del que se pueda salir reintentando.
  if (consulta.error instanceof ErrorApi && consulta.error.estado === 403) {
    return (
      <div className={estilos.sinPermiso}>
        <p className={estilos.textoSinPermiso}>
          <b>Tu rol ve el aforo de esta sesión, no quién la eligió.</b> Son dos permisos
          distintos: uno organiza fechas y cupos, el otro abre los nombres de quienes se
          inscribieron. Si necesitas la lista para conducir la sesión, pídele a quien
          administra los permisos que te dé «Ver quién eligió cada sesión de simulación».
        </p>
      </div>
    )
  }

  // Solo cuando no hay NADA que enseñar. `isError` a secas se enciende también
  // al fallar un refresco de fondo con los datos ya puestos, y ahí desmontar la
  // lista se llevaría por delante el estado de lo que se está marcando.
  if (consulta.isError && !consulta.data) {
    return (
      <div className={estilos.avisoMalo} role="alert">
        <span>
          No pudimos traer la lista de inscritos.{' '}
          <button className={estilos.reintentar} type="button" onClick={() => consulta.refetch()}>
            Volver a intentarlo
          </button>
        </span>
      </div>
    )
  }

  const inscritos = consulta.data ?? []

  return (
    <div className={estilos.bloque}>
      <div className={estilos.cabeceraLista}>
        <h3 className={estilos.titulo}>Quién eligió esta fecha</h3>
        <Recuento
          visibles={inscritos.length}
          inscritos={inscritosDeLaSesion}
          aforo={aforo}
        />
      </div>

      {consulta.isError && consulta.data && (
        <p className={estilos.desactualizado} role="status">
          No pudimos refrescar la lista, así que esto es lo último que llegó.{' '}
          <button className={estilos.reintentar} type="button" onClick={() => consulta.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {seFue && (
        <p className={estilos.seFue} role="status">
          <b>{seFue} queda marcada como ausente</b> y sale de esta lista. Su postulación
          vuelve a la bandeja del equipo, que decidirá entre darle otra fecha o cerrarla.
        </p>
      )}

      {inscritos.length === 0 ? (
        <p className={estilos.vacio}>
          Todavía no se ha inscrito nadie. Quien llegue a la etapa de simulación verá esta
          fecha entre las que puede elegir, mientras quede cupo.
        </p>
      ) : (
        <ul className={estilos.lista} role="list">
          {inscritos.map((i) => (
            <Fila
              /*
               * La `key` lleva `asistio` dentro por lo mismo que el editor de
               * alcance del panel de permisos: la fila guarda en local si esta
               * a media pregunta, y si el dato del servidor cambia bajo ella
               * —otra persona paso lista, o lo hicimos nosotros— esa pregunta
               * ya no es sobre lo que hay. Remontar la devuelve a cero.
               */
              key={`${i.inscripcionId}-${i.asistio}`}
              inscrito={i}
              guardando={lista.isPending && lista.variables?.inscripcionId === i.inscripcionId}
              alMarcar={(asistio) =>
                lista.mutate({
                  inscripcionId: i.inscripcionId,
                  asistio,
                  candidato: i.candidato,
                })
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * El recuento de la lista frente a la sesión.
 *
 * ⚠️ **La cifra de la fila y la longitud de la lista pueden no coincidir, y no
 * es un fallo.** El conteo de la sesión es aforo —cuántas plazas están
 * ocupadas— y la lista es identidades: con alcance acotado a sus vacantes, el
 * backend recorta la segunda y no la primera.
 *
 * Enseñar «3 personas» debajo de una fila que dice «5 de 8» sin decir nada es
 * una contradicción que quien mira tiene que resolver adivinando, y adivinando
 * lo normal es concluir que el panel se equivoca. Así que cuando divergen, se
 * nombra por qué.
 */
function Recuento({
  visibles,
  inscritos,
  aforo,
}: {
  visibles: number
  inscritos: number
  aforo: number
}) {
  const gente = visibles === 1 ? '1 persona' : `${visibles} personas`

  if (visibles < inscritos) {
    return (
      <p className={estilos.recuento}>
        {gente} de las {inscritos} inscritas —{' '}
        <span className={estilos.porQue}>tu alcance llega solo a tus vacantes</span>
      </p>
    )
  }

  return (
    <p className={estilos.recuento}>
      {gente} de {aforo} plazas
    </p>
  )
}

function Fila({
  inscrito,
  guardando,
  alMarcar,
}: {
  inscrito: InscritoEnSesion
  guardando: boolean
  alMarcar: (asistio: boolean) => void
}) {
  const { candidato, vacante, inscritaEn, asistio } = inscrito
  const [confirmando, setConfirmando] = useState(false)

  return (
    <li className={estilos.fila}>
      <div className={estilos.quien}>
        <span className={estilos.nombre}>{candidato}</span>
        <span className={estilos.contexto}>
          {vacante} · eligió esta fecha el {formatearFechaLarga(inscritaEn)}
        </span>
      </div>

      <MarcaDeAsistencia asistio={asistio} />

      {/*
        La ausencia pregunta y la asistencia no, y la asimetría es el punto:
        marcar que vino se corrige volviendo a pulsar, marcar que no vino saca a
        la persona de la lista y desde aquí ya no se puede deshacer.

        Dos pasos en la propia fila y no un `<dialog>`: la pregunta tiene que
        verse pegada al nombre al que se refiere, y en una lista de diez un
        modal que dice «¿seguro?» no dice de quién.
      */}
      {confirmando ? (
        <div className={estilos.acciones}>
          <span className={estilos.pregunta}>Sale de la lista. ¿Seguro?</span>
          <button
            className={`${estilos.chico} ${estilos.confirmar}`}
            type="button"
            onClick={() => {
              setConfirmando(false)
              alMarcar(false)
            }}
            disabled={guardando}
          >
            Sí, no vino
          </button>
          <button
            className={estilos.chico}
            type="button"
            onClick={() => setConfirmando(false)}
          >
            Mejor no
          </button>
        </div>
      ) : (
        <div className={estilos.acciones}>
          <button
            className={estilos.chico}
            type="button"
            onClick={() => alMarcar(true)}
            disabled={guardando || asistio === true}
          >
            {asistio === true ? 'Marcado: vino' : 'Vino'}
          </button>
          <button
            className={`${estilos.chico} ${estilos.peligro}`}
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={guardando}
          >
            No vino
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Los tres estados de la asistencia.
 *
 * Se leen en la forma antes que en el color: contorno punteado lo pendiente,
 * relleno lo que ya se decidió, y un punto delante en la ausencia — que es la
 * única de las tres que cambia el proceso de alguien.
 *
 * ⚠️ **`false` no llega por `GET /inscritos`** —la fila deja de ser vigente al
 * marcarla— así que esa rama es defensiva. Se queda porque el contrato admite
 * el valor y pintar «Sin pasar lista» sobre una ausencia sería mentir.
 */
function MarcaDeAsistencia({ asistio }: { asistio: boolean | null }) {
  if (asistio === null) {
    return <span className={`${estilos.marca} ${estilos.pendiente}`}>Sin pasar lista</span>
  }
  if (asistio) {
    return <span className={`${estilos.marca} ${estilos.vino}`}>Asistió</span>
  }
  return <span className={`${estilos.marca} ${estilos.falto}`}>No asistió</span>
}
