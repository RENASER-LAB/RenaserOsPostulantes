/**
 * Las áreas: la estructura de la organización.
 *
 * Es la pieza más pequeña del panel con las consecuencias más grandes. **Sin un
 * área no se puede registrar una solicitud de talento**, y sin solicitud no hay
 * vacante: una empresa que llega aquí y no crea ninguna se queda parada en el
 * primer paso del proceso entero. Por eso esta sección existe y por eso su
 * estado vacío no dice «no hay nada», dice qué se rompe.
 *
 * ⚠️ **Esta pantalla lee la lista de TODAS, no la de las activas.** `GET /areas`
 * filtra por activas, así que un área desactivada desaparecería de aquí sin
 * ninguna forma de volver a encenderla —el botón de retirar sería un viaje sin
 * retorno—. `GET /areas/todas` es la que trae también las retiradas, y es la
 * única razón por la que desactivar se puede ofrecer.
 *
 * ⚠️ **Retirar y borrar no son lo mismo, y la pantalla tiene que hacerlo obvio.**
 * Retirar deja todo donde está y solo la saca de los desplegables; se deshace.
 * Borrar la quita de la base, y como las dos claves ajenas que apuntan a un área
 * —la solicitud de talento y la persona del equipo— no declaran `ON DELETE`, hay
 * que mover antes lo que colgaba de ella. Ese movimiento no tiene vuelta atrás.
 *
 * ⚠️ **El precio del borrado se enseña ANTES de confirmar, no después.** Al abrir
 * la confirmación se pide `GET /areas/{id}/impacto` y se escriben los dos
 * recuentos de verdad. Un «¿seguro?» sin números deja a quien administra
 * decidiendo a ciegas sobre solicitudes de candidatos reales.
 *
 * La confirmación se despliega **en la propia fila y no en un `<dialog>`**, por
 * lo mismo que la asistencia de una simulación: tiene que leerse pegada al
 * nombre al que se refiere. Y aquí no es un «¿seguro?» de dos líneas —lleva a
 * dónde se mueve todo y por qué—, así que tampoco cabría en uno.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import {
  borrarArea,
  crearArea,
  desactivarArea,
  impactoDeBorrarArea,
  listarTodasLasAreas,
  reactivarArea,
  renombrarArea,
} from '../api/panel'
import type { AreaPanel } from '../api/tipos'
import estilos from './Areas.module.css'

/** Qué se está haciendo con una fila. Solo una fila a la vez tiene algo abierto. */
type Abierto = { id: number; que: 'renombrar' | 'borrar' } | null

export function Areas() {
  const cache = useQueryClient()
  const areas = useQuery({ queryKey: ['panel-areas-todas'], queryFn: listarTodasLasAreas })

  const [abierto, setAbierto] = useState<Abierto>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  /**
   * Refrescar las DOS listas después de cada cambio.
   *
   * ⚠️ No basta con la de esta pantalla. `['panel-areas']` es la de las activas y
   * la usan el desplegable de la vacante y la tabla del equipo: sin invalidarla,
   * un área renombrada aquí sigue saliendo con el nombre viejo allí hasta que
   * alguien recargue.
   */
  async function refrescar() {
    setAbierto(null)
    setFallo(null)
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['panel-areas-todas'] }),
      cache.invalidateQueries({ queryKey: ['panel-areas'] }),
    ])
  }

  function noSePudo(causa: unknown, porDefecto: string) {
    // Los 409 del backend vienen escritos en español y dicen exactamente qué
    // pasa —cuántas solicitudes lo impiden, qué área ya se llama así—. Se
    // enseñan tal cual: sustituirlos por un genérico borra la única indicación
    // de qué hacer a continuación.
    setFallo(causa instanceof Error ? causa.message : porDefecto)
  }

  const sinPermiso = areas.error instanceof ErrorApi && areas.error.estado === 403

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Las áreas de la organización</h2>
      <p className={estilos.nota}>
        La estructura de la empresa. <b>Hace falta un área para registrar una solicitud de
        talento</b>, que es el paso previo a publicar cualquier vacante. Cada cambio queda
        auditado.
      </p>

      {sinPermiso && (
        <p className={estilos.sinPermiso}>
          Puedes ver las áreas al registrar una solicitud, pero administrarlas es otra cosa:
          hace falta el permiso «Crear usuarios y asignar roles», que es con el que se
          administra el resto de la estructura del equipo.
        </p>
      )}

      {areas.isError && !sinPermiso && (
        <p className={estilos.avisoMalo} role="alert">
          No pudimos traer las áreas.{' '}
          <button className={estilos.enlace} type="button" onClick={() => areas.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {areas.data && (
        <>
          <Anadir alHecho={refrescar} alFallar={noSePudo} />

          {fallo && (
            <p className={estilos.avisoMalo} role="alert">
              {fallo}
            </p>
          )}

          {areas.data.length === 0 ? (
            <p className={estilos.vacio}>
              Todavía no hay ninguna área. Hasta que exista una, nadie del equipo puede
              registrar una solicitud de talento: el formulario pide elegir área y no tendría
              nada que ofrecer.
            </p>
          ) : (
            <ul className={estilos.filas} role="list">
              {areas.data.map((area) => (
                <Fila
                  key={area.id}
                  area={area}
                  activas={areas.data.filter((a) => a.esActiva)}
                  abierto={abierto?.id === area.id ? abierto.que : null}
                  alAbrir={(que) => {
                    setFallo(null)
                    setAbierto({ id: area.id, que })
                  }}
                  alCerrar={() => setAbierto(null)}
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

// ---------- Crear una ----------

/**
 * Siempre visible y no detrás de un botón: crear es la acción que arregla el
 * estado vacío, y esconderla dejaría una pantalla que dice «hace falta un área»
 * sin nada que pulsar a la vista.
 */
function Anadir({
  alHecho,
  alFallar,
}: {
  alHecho: () => Promise<void>
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const [nombre, setNombre] = useState('')

  const alta = useMutation({
    mutationFn: () => crearArea(nombre.trim()),
    onSuccess: async () => {
      setNombre('')
      await alHecho()
    },
    onError: (causa) => alFallar(causa, 'No se pudo crear el área.'),
  })

  return (
    <form
      className={estilos.anadir}
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim() !== '') alta.mutate()
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nombre del área nueva</span>
        <input
          className={estilos.entrada}
          type="text"
          value={nombre}
          placeholder="Operaciones"
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <button className={estilos.crear} type="submit" disabled={alta.isPending || nombre.trim() === ''}>
        {alta.isPending ? 'Creando…' : 'Añadir'}
      </button>
    </form>
  )
}

// ---------- Una fila ----------

function Fila({
  area,
  activas,
  abierto,
  alAbrir,
  alCerrar,
  alHecho,
  alFallar,
}: {
  area: AreaPanel
  /** Las que pueden recibir lo que cuelga de esta si se borra. */
  activas: AreaPanel[]
  abierto: 'renombrar' | 'borrar' | null
  alAbrir: (que: 'renombrar' | 'borrar') => void
  alCerrar: () => void
  alHecho: () => Promise<void>
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const actividad = useMutation({
    mutationFn: () => (area.esActiva ? desactivarArea(area.id) : reactivarArea(area.id)),
    onSuccess: alHecho,
    onError: (causa) => alFallar(causa, 'No se pudo cambiar el estado del área.'),
  })

  return (
    <li className={`${estilos.fila} ${area.esActiva ? '' : estilos.filaRetirada}`}>
      <div className={estilos.queEs}>
        <span className={estilos.nombre}>{area.nombre}</span>
        <MarcaDeEstado activa={area.esActiva} />
      </div>

      {abierto === 'renombrar' ? (
        <Renombrar
          /*
           * El nombre del servidor va en la `key`: si cambia —lo guardamos, o lo
           * cambió otra sesión— el editor se remonta con lo que hay ahora. Sin
           * eso ofrecería guardar un nombre que ya no es el de partida.
           */
          key={area.nombre}
          area={area}
          alHecho={alHecho}
          alCerrar={alCerrar}
          alFallar={alFallar}
        />
      ) : (
        <div className={estilos.acciones}>
          <button className={estilos.chico} type="button" onClick={() => alAbrir('renombrar')}>
            Renombrar
          </button>
          <button
            className={estilos.chico}
            type="button"
            onClick={() => actividad.mutate()}
            disabled={actividad.isPending}
          >
            {area.esActiva ? 'Retirar' : 'Reactivar'}
          </button>
          <button
            className={`${estilos.chico} ${estilos.peligro}`}
            type="button"
            onClick={() => alAbrir('borrar')}
          >
            Borrar
          </button>
        </div>
      )}

      {abierto === 'borrar' && (
        <Borrado
          area={area}
          activas={activas.filter((a) => a.id !== area.id)}
          alHecho={alHecho}
          alCerrar={alCerrar}
          alFallar={alFallar}
        />
      )}
    </li>
  )
}

/**
 * Activa o retirada, y se distingue por la forma antes que por el color:
 * relleno lo que circula, contorno punteado lo que ya no. En gris siguen siendo
 * dos cosas distintas.
 */
function MarcaDeEstado({ activa }: { activa: boolean }) {
  return activa ? (
    <span className={`${estilos.marca} ${estilos.viva}`}>En uso</span>
  ) : (
    <span className={`${estilos.marca} ${estilos.retirada}`}>Retirada</span>
  )
}

// ---------- Renombrar ----------

function Renombrar({
  area,
  alHecho,
  alCerrar,
  alFallar,
}: {
  area: AreaPanel
  alHecho: () => Promise<void>
  alCerrar: () => void
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const [nombre, setNombre] = useState(area.nombre)

  const cambio = useMutation({
    mutationFn: () => renombrarArea(area.id, nombre.trim()),
    onSuccess: alHecho,
    onError: (causa) => alFallar(causa, 'No se pudo renombrar el área.'),
  })

  const cambia = nombre.trim() !== '' && nombre.trim() !== area.nombre

  return (
    <div className={estilos.edicion}>
      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nombre nuevo de «{area.nombre}»</span>
        <input
          className={estilos.entrada}
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <div className={estilos.botones}>
        <button
          className={estilos.guardar}
          type="button"
          disabled={cambio.isPending || !cambia}
          onClick={() => cambio.mutate()}
        >
          {cambio.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button className={estilos.chico} type="button" onClick={alCerrar}>
          Dejarlo
        </button>
      </div>
      <p className={estilos.explica}>
        Solo cambia el nombre. Las solicitudes y las personas que ya apuntan a esta área siguen
        apuntando a ella.
      </p>
    </div>
  )
}

// ---------- Borrar, con lo que se lleva por delante ----------

/**
 * El bloque que explica el precio ANTES de cobrarlo.
 *
 * Al abrirse pregunta cuántas solicitudes y cuántas personas cuelgan del área.
 * Mientras la respuesta no está, no se ofrece ningún botón de borrar: enseñarlo
 * antes invitaría a confirmar sin saber qué se confirma.
 */
function Borrado({
  area,
  activas,
  alHecho,
  alCerrar,
  alFallar,
}: {
  area: AreaPanel
  /** Las activas que NO son esta: las únicas que pueden recibir lo que cuelga. */
  activas: AreaPanel[]
  alHecho: () => Promise<void>
  alCerrar: () => void
  alFallar: (causa: unknown, porDefecto: string) => void
}) {
  const impacto = useQuery({
    queryKey: ['panel-area-impacto', area.id],
    queryFn: () => impactoDeBorrarArea(area.id),
    /*
     * ⚠️ Esta lectura NO se cachea, y es lo contrario de lo que hace el resto del
     * panel: `App.tsx` da por buena cualquier respuesta durante 30 segundos.
     * Aquí eso rompía la única promesa del bloque —enseñar el precio antes de
     * cobrarlo—: cerrar la confirmación y volver a abrirla dentro de esa ventana
     * servía los recuentos viejos sin volver a preguntar, y `refrescar()`
     * invalida `panel-areas` y `panel-areas-todas` pero nunca esta clave. Con
     * unos recuentos viejos en cero la pantalla escribe «no cuelga nada de esta
     * área», no pinta el desplegable de destino y manda el borrado sin él.
     *
     * `gcTime: 0` es la mitad que importa: sin él quedaría el dato viejo en la
     * caché y se pintaría mientras se vuelve a pedir. Con él, al cerrar el
     * bloque se tira, y al reabrirlo se vuelve a pasar por «Mirando qué cuelga
     * de…» hasta tener la respuesta de ahora.
     */
    staleTime: 0,
    gcTime: 0,
  })

  const [destino, setDestino] = useState<string>('')
  const [motivo, setMotivo] = useState('')

  const borrado = useMutation({
    mutationFn: () => borrarArea(area.id, destino === '' ? null : Number(destino), motivo.trim()),
    onSuccess: alHecho,
    onError: (causa) => alFallar(causa, 'No se pudo borrar el área.'),
  })

  if (impacto.isPending) {
    return (
      <div className={estilos.borrado}>
        <p className={estilos.explica} role="status">
          Mirando qué cuelga de «{area.nombre}»…
        </p>
      </div>
    )
  }

  if (impacto.isError || !impacto.data) {
    return (
      <div className={estilos.borrado}>
        <p className={estilos.avisoMalo} role="alert">
          No pudimos averiguar qué cuelga de esta área, así que no se ofrece borrarla.{' '}
          <button className={estilos.enlace} type="button" onClick={() => impacto.refetch()}>
            Volver a intentarlo
          </button>
        </p>
        <div className={estilos.botones}>
          <button className={estilos.chico} type="button" onClick={alCerrar}>
            Dejarlo
          </button>
        </div>
      </div>
    )
  }

  const { solicitudes, usuarios } = impacto.data
  const vacia = solicitudes === 0 && usuarios === 0
  // Sin ningún área activa a la que mover, un área con cosas dentro no se puede
  // borrar hoy. Se dice así, con la salida —crear otra, o retirarla— en vez de
  // dejar un botón que solo puede fallar.
  const sinDondeMover = !vacia && activas.length === 0
  const listo = vacia
    ? motivo.trim() !== ''
    : destino !== '' && motivo.trim() !== ''

  return (
    <div className={estilos.borrado}>
      <p className={estilos.titulinBorrado}>Borrar «{area.nombre}» del todo</p>

      {vacia ? (
        <p className={estilos.explica}>
          No cuelga nada de esta área: ninguna solicitud de talento y nadie del equipo. Se borra
          sin mover nada. <b>No se puede deshacer.</b>
        </p>
      ) : (
        <>
          <ul className={estilos.cuenta} role="list">
            <li>
              <span className={estilos.cifra}>{solicitudes}</span>{' '}
              {solicitudes === 1 ? 'solicitud de talento' : 'solicitudes de talento'}
            </li>
            <li>
              <span className={estilos.cifra}>{usuarios}</span>{' '}
              {usuarios === 1 ? 'persona del equipo' : 'personas del equipo'}
            </li>
          </ul>
          <p className={estilos.explica}>
            Todo eso apunta hoy a «{area.nombre}» y hay que moverlo a otra área antes de
            borrarla. <b>El movimiento no se deshace.</b> Si lo que quieres es solo dejar de
            ofrecerla al registrar solicitudes, <b>retírala</b> en vez de borrarla: no se pierde
            nada y se puede volver a encender.
          </p>
        </>
      )}

      {sinDondeMover ? (
        <p className={estilos.aviso}>
          No hay ninguna otra área activa a la que mover esto. Crea una antes, o retira esta en
          lugar de borrarla.
        </p>
      ) : (
        <div className={estilos.formulario}>
          {!vacia && (
            <label className={estilos.campo}>
              <span className={estilos.rotulo}>Todo eso se mueve a</span>
              <select
                className={estilos.entrada}
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              >
                <option value="">Elige un área…</option>
                {activas.map((a) => (
                  <option value={String(a.id)} key={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Motivo</span>
            <input
              className={estilos.entrada}
              type="text"
              value={motivo}
              placeholder="Se fusiona con Operaciones"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
        </div>
      )}

      <p className={estilos.explica}>
        {/*
          El motivo no es burocracia: cuando el área desaparece, la fila de
          auditoría es lo unico que queda de que esas solicitudes estuvieron en
          otro sitio.
        */}
        El motivo queda auditado. Es lo único que sobrevive al borrado: el área ya no estará
        para explicar de dónde venían esas solicitudes.
      </p>

      <div className={estilos.botones}>
        <button
          className={estilos.borrar}
          type="button"
          disabled={borrado.isPending || sinDondeMover || !listo}
          onClick={() => borrado.mutate()}
        >
          {borrado.isPending
            ? 'Borrando…'
            : vacia
              ? 'Borrar el área'
              : 'Mover todo y borrar'}
        </button>
        <button className={estilos.chico} type="button" onClick={alCerrar}>
          Dejarlo
        </button>
      </div>
    </div>
  )
}
