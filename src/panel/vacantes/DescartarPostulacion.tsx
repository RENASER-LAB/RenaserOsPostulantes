/**
 * Descartar a un candidato desde la ficha.
 *
 * Hasta ahora el panel podia calificar, mover fechas y confirmar avances, pero
 * no habia forma de decir «esta persona no sigue»: el verbo existia en el
 * backend desde el principio y ninguna pantalla lo llamaba.
 *
 * ⚠️ **Esto manda un correo real a una persona real.** Pasar a `NO_CONTINUA`
 * dispara la plantilla `POSTULACION_NO_CONTINUA` —«en esta ocasion tu
 * postulacion no continua»— en la misma transaccion, sin preguntar nada mas. No
 * es un cambio de estado interno que alguien vaya a revisar despues: es la
 * carta de rechazo. Por eso la consecuencia se dice ANTES del boton y con todas
 * sus letras, y por eso el paso de confirmacion existe.
 *
 * ⚠️ **El motivo NO viaja en ese correo.** Quien escribe aqui esta escribiendo
 * para el historial y la auditoria, no para el candidato —el texto que le llega
 * es siempre el mismo—. La ayuda del campo lo dice, porque la suposicion
 * contraria es facil y cara: alguien redactaria una devolucion personal creyendo
 * que la lee quien la merece.
 *
 * ⚠️ **De un estado final no se sale.** El backend lo impide desde
 * `MaquinaEstados`, asi que el boton no se pinta cuando la postulacion ya
 * termino: ofrecer un control que solo puede fallar es peor que no ofrecerlo.
 * Se dice en una linea en vez de esconderlo sin explicacion.
 *
 * ⚠️ **`puedeMoverPostulacion` decide si se ve, no si se puede.** Quien decide
 * de verdad es el `@PreAuthorize` del backend; esto solo evita ensenar un boton
 * que la mitad del equipo no puede pulsar. El 403 se sigue traduciendo por si
 * el permiso cambia entre que se abre la ficha y se pulsa.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { ErrorApi } from '../api/cliente'
import { transicionar } from '../api/panel'
import { Modal } from '@/ui/Modal'
import { AreaTexto } from '@/ui/campos/Campo'
import estilos from './DescartarPostulacion.module.css'

/**
 * El estado al que se va.
 *
 * `NO_CONTINUA` y no `CERRADA`: son los dos finales que puede elegir una
 * persona y significan cosas distintas. `CERRADA` es el cierre administrativo
 * —el candidato se retiro, se cerro la convocatoria—; `NO_CONTINUA` es la
 * empresa diciendo que no sigue, que es esto. El `motivoCierre` que les
 * corresponde lo pone el backend solo.
 */
const NO_CONTINUA = 'NO_CONTINUA'

const Motivo = z
  .string()
  .trim()
  .min(1, 'Escribe por qué no continúa. Queda en el historial de la postulación.')

/**
 * El bloque de `safeParse` que se copia en todo el proyecto: el error del campo
 * y el foco puesto en el.
 *
 * El `requestAnimationFrame` no sobra: sin el, el `aria-invalid` todavia no
 * esta en el DOM cuando se busca y el foco no se mueve de sitio.
 */
function enfocarElError() {
  requestAnimationFrame(() => {
    // ⚠️ **Acotado al modal, no a todo el documento.** El patron copiado del
    // proyecto busca en la pagina entera, y esta ficha monta ademas los campos
    // de nota y de plazo, que usan la misma pieza: un `aria-invalid` suyo que
    // hubiera quedado de antes se lleva el foco FUERA de un modal que ademas
    // atrapa el tabulador. Hoy gana el textarea por orden del DOM, que es
    // casualidad y no diseno.
    document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus()
  })
}

/** Un 403 no se explica como un 500: uno es el reparto de permisos, otro un fallo. */
function explicarFallo(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 403) {
    return 'Tu rol no puede mover esta postulación: hace falta el permiso «mover_postulacion». Pídeselo a quien administra los permisos del equipo.'
  }
  /*
    ⚠️ **El 404 aqui no es que la postulacion no exista.**

    El alcance se guarda POR permiso: un rol puede abrir la ficha de cualquiera
    —`abrir_ficha_candidato` con alcance TODO— y solo poder mover las de sus
    vacantes. Cuando esas dos no coinciden, la ficha se abre, el boton sale
    —`puedeMoverPostulacion` solo dice si el permiso esta, no hasta donde
    llega— y el backend contesta 404 y no 403, a proposito: un 403 confirmaria
    que esa postulacion existe.

    Sin esta rama, el mensaje que sale es «No encontramos eso, o no es tuyo» en
    una ficha que se esta mirando, que es la frase que parece un fallo del
    sistema y no un limite del rol.
  */
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return 'Esta postulación queda fuera de lo que tu rol puede mover, aunque puedas abrir su ficha. Quien administra los permisos del equipo puede ampliar el alcance de «mover_postulacion».'
  }
  if (causa instanceof ErrorApi && causa.estado === 409) {
    return 'Esta postulación ya terminó su recorrido, así que no se puede descartar. Vuelve a cargar la ficha para ver en qué estado quedó.'
  }
  if (causa instanceof ErrorApi && causa.estado >= 500) {
    return 'El servidor falló, así que la postulación sigue como estaba y al candidato no le llegó nada. Vuelve a intentarlo en un momento.'
  }
  return causa instanceof Error ? causa.message : 'No se pudo descartar la postulación.'
}

interface Props {
  postulacionId: number
  /** Para nombrar a quien se descarta: un modal que dice «este candidato» no confirma nada. */
  candidato: string
  /**
   * Si la postulacion ya termino su recorrido, de `esFinal` del catálogo.
   *
   * ⚠️ **`undefined` significa «todavia no se sabe», y NO es lo mismo que
   * `false`.** El catálogo y la ficha son dos consultas en paralelo, asi que hay
   * un hueco en que la ficha ya esta pintada y el catálogo aun viaja —y si
   * falla, ese hueco no se cierra nunca—. Dandolo por `false` el boton sale
   * sobre alguien ya cerrado: se lee que le va a salir un correo, se escribe el
   * motivo y el backend contesta 409. Sin saberlo no se ofrece nada.
   */
  yaTermino: boolean | undefined
  /** Si quien mira tiene `mover_postulacion`. */
  puedeMover: boolean
  /** Refrescar la ficha, el historial y el ranking: el estado cambia en los tres. */
  alDescartar: () => void
}

export function DescartarPostulacion({
  postulacionId,
  candidato,
  yaTermino,
  puedeMover,
  alDescartar,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  /*
    Avisar es lo normal y por eso nace encendido: callar tiene que ser una
    decision que alguien toma, no la que sale por no mirar la casilla.
  */
  const [avisar, setAvisar] = useState(true)

  const descartar = useMutation({
    mutationFn: (porQue: string) => transicionar(postulacionId, NO_CONTINUA, porQue, avisar),
    onMutate: () => setFallo(null),
    onSuccess: () => {
      cerrar()
      setHecho(true)
      alDescartar()
    },
    onError: (causa) => setFallo(explicarFallo(causa)),
  })

  function cerrar() {
    setAbierto(false)
    setMotivo('')
    setError(undefined)
    setFallo(null)
  }

  /**
   * Cerrar el modal, salvo mientras la peticion vuela.
   *
   * ⚠️ **Es lo que separa «no salio» de «no me enteré».** El `Modal` cierra con
   * Escape, con un clic en el fondo y con el aspa, y esta llamada tarda —manda
   * el correo dentro de la misma transaccion—. Quien se impacienta y cierra deja
   * el modal desmontado: el fallo que llega despues se escribe en algo que ya no
   * se pinta, y **un descarte que reboto se ve exactamente igual que uno que
   * salio**. La persona se queda en el proceso y nadie se entera.
   *
   * Es mas honesto no dejar cerrar durante los segundos que dura: el boton ya
   * dice «Descartando…» mientras tanto.
   */
  function cerrarSiSePuede() {
    if (descartar.isPending) return
    cerrar()
  }

  /** Abrir siempre en limpio: un fallo de un intento anterior no es el de este. */
  function abrir() {
    setFallo(null)
    setError(undefined)
    setHecho(false)
    // El aviso vuelve a encenderse en cada apertura: haberlo apagado para una
    // persona no puede arrastrarse a la siguiente sin que nadie lo mire.
    setAvisar(true)
    setAbierto(true)
  }

  function intentarDescartar() {
    const revision = Motivo.safeParse(motivo)
    if (!revision.success) {
      setError(revision.error.issues[0]?.message)
      enfocarElError()
      return
    }
    setError(undefined)
    descartar.mutate(revision.data)
  }

  // Sin el permiso no hay nada que ensenar: el boton no se puede pulsar y
  // explicar un permiso que no se tiene, en una ficha que se abre para leer, es
  // ruido en todas las fichas del equipo.
  if (!puedeMover) return null

  /*
    Ya cerrada se dice, no se esconde. Un boton que desaparece sin explicacion
    deja pensando si falta un permiso; una linea de texto cierra la pregunta.

    Y si acaba de descartarse desde aqui, lo que se dice es lo que se hizo: al
    refrescarse la ficha esta postulacion pasa a ser final, asi que sin este
    caso el unico rastro de haber mandado una carta de rechazo seria que el
    boton se convirtiera en «ya terminó su recorrido», que es una frase sobre
    otra cosa.
  */
  if (yaTermino) {
    return hecho ? (
      <p className={estilos.hecho} role="status">
        {avisar
          ? `Descartada. A ${candidato} ya le salió el correo.`
          : `Descartada, sin avisar a ${candidato}. Queda anotado en su historial.`}
      </p>
    ) : (
      <p className={estilos.cerrada}>
        Esta postulación ya terminó su recorrido, así que no se puede descartar.
      </p>
    )
  }

  /*
    ⚠️ **Sin catálogo no se ofrece nada.** `undefined` es «todavia no se sabe si
    esta cerrada», y ofrecer descartar bajo esa duda es prometer un correo que
    puede no salir. El hueco dura lo que tarda una consulta; si el catálogo
    falla, no se cierra nunca, y entonces callar es lo correcto.
  */
  if (yaTermino === undefined) return null

  return (
    <div className={estilos.bloque}>
      {/*
        `type="button"` y no `submit`: esto vive dentro del detalle de la
        vacante, que ya tiene sus propios formularios, y un boton por defecto
        acabaria enviando el de fuera.
      */}
      <button type="button" className={estilos.descartar} onClick={abrir}>
        Descartar
      </button>

      {/*
        ⚠️ **La unica senal de que salio.** Sin esto, descartar bien y que la
        peticion rebotara sin que nadie lo viera se parecian demasiado: el modal
        se cierra en los dos casos. `role="status"` lo anuncia tambien a quien
        navega con lector de pantalla, que si no se queda sin saber que paso.

        Se pinta aqui y no solo en la rama de arriba porque la ficha tarda un
        instante en volver con el estado nuevo, y ese instante es justo cuando se
        mira a ver si funciono.
      */}
      {hecho && (
        <p className={estilos.hecho} role="status">
          {avisar
            ? `Descartada. A ${candidato} ya le salió el correo.`
            : `Descartada, sin avisar a ${candidato}. Queda anotado en su historial.`}
        </p>
      )}

      <Modal
        abierto={abierto}
        titulo={`Descartar a ${candidato}`}
        onCerrar={cerrarSiSePuede}
        pie={
          /* Sin contenedor propio: el pie del `Modal` ya es un flex alineado a
             la derecha con su separacion. Meter otro `div` dentro anidaba dos
             flex y el segundo perdia la alineacion del primero. */
          <>
            <button
              type="button"
              className={estilos.cancelar}
              onClick={cerrarSiSePuede}
              disabled={descartar.isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={intentarDescartar}
              disabled={descartar.isPending}
              aria-busy={descartar.isPending}
            >
              {descartar.isPending
                ? 'Descartando…'
                : avisar
                  ? 'Descartar y avisarle'
                  : 'Descartar sin avisar'}
            </button>
          </>
        }
      >
        {/*
          La consecuencia va arriba y antes del campo, no como letra pequena
          debajo del boton: quien abre esto tiene que saber que va a mandar un
          correo mientras decide, no despues de haberlo mandado.

          Ambar y no rojo: no es un error ni algo que se pueda deshacer mal, es
          una decision que sale del sistema y llega a una persona.
        */}
        <p className={estilos.consecuencia}>
          {avisar ? (
            <>
              Al descartar, <b>a {candidato} le llega un correo</b> diciéndole que su postulación
              no continúa. Sale al momento y no se puede recoger.
            </>
          ) : (
            <>
              <b>A {candidato} no le va a llegar nada.</b> Queda anotado en su historial que se
              descartó sin avisarle, para que quien lo lea después no dé por hecho que se le
              dijo.
            </>
          )}{' '}
          La postulación queda cerrada: de un estado final no se vuelve.
        </p>

        {/*
          ⚠️ **La casilla dice lo que HACE, no lo que deja de hacer.** «Avisar al
          candidato» encendida es el estado normal; una casilla «no avisar» que
          hay que marcar para lo de siempre invierte la lectura y se marca por
          error. Y el aviso de arriba cambia con ella: un texto que sigue
          prometiendo un correo mientras la casilla dice lo contrario es peor que
          no decir nada.
        */}
        <label className={estilos.avisar}>
          <input
            type="checkbox"
            checked={avisar}
            onChange={(e) => setAvisar(e.target.checked)}
          />
          <span>
            Avisar a {candidato} por correo
            <span className={estilos.ayudaAvisar}>
              Quítalo solo si ya se lo dijisteis por otro lado: un correo automático llegaría
              después de esa conversación diciendo lo mismo peor.
            </span>
          </span>
        </label>

        <AreaTexto
          etiqueta="Por qué no continúa"
          ayuda="Lo lee el equipo en el historial de la postulación, no el candidato: el correo que le llega es siempre el mismo."
          value={motivo}
          /* El error se va al empezar a corregirlo, no al volver a pulsar: un
             campo que sigue en rojo mientras se escribe la respuesta buena dice
             que lo escrito tampoco vale. */
          onChange={(e) => {
            setMotivo(e.target.value)
            if (error) setError(undefined)
          }}
          error={error}
          rows={4}
        />

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}
      </Modal>
    </div>
  )
}
