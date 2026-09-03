/**
 * Lo que la persona subio: los archivos y los enlaces que la prueba le pedia.
 *
 * ⚠️ **Sin esto, la rubrica pedia juzgar algo que la pantalla no ensenaba.** Los
 * entregables solo los leian dos: el propio candidato en su portal, y el agente
 * al armar su insumo. Desde que la ficha deja poner a mano la nota de un
 * criterio —los que la rubrica reserva a una persona, como la sustentacion en
 * video— hacia falta poder VER lo que se califica: pedirle a alguien un puntaje
 * sobre un video que la pantalla no le ensena es pedirle que se lo invente.
 *
 * Va encima de «Lo que escribio en la prueba» y debajo de la rubrica: primero
 * la nota, luego lo que se entrego, luego lo que escribio. Ese es el orden en
 * que se revisa.
 *
 * ⚠️ **Salen TODOS los pedidos, entregados o no.** Un hueco no se lee: se lee
 * una lista mas corta, que parece completa. Que faltara el tercero —y que fuera
 * obligatorio— es justo lo que hay que ver antes de poner una nota.
 *
 * ⚠️ **El enlace firmado responde 200 en local, y su url no la abre nadie.** El
 * almacen de desarrollo reparte `memoria://…` —lo dice `application-local.yaml`—
 * asi que NO se puede decidir por la excepcion: no hay ninguna. Se decide por el
 * **esquema de la url**, y lo que no sea `http`/`https` cae a la descarga, que es
 * el camino que el propio backend documenta como el que funciona en los dos
 * sitios. En produccion el archivo sale del bucket sin pasar por el backend.
 *
 * ⚠️ **Y la ventana se abre ANTES del `await`.** Despues, el navegador ya no la
 * considera parte del gesto de la persona y la bloquea —Safari siempre, Firefox
 * a menudo—; ademas un `window.open` bloqueado **devuelve `null`, no lanza**, asi
 * que un `try/catch` alrededor no se entera. Se abre en blanco, se navega si la
 * url sirve, y se cierra si toca descargar.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { descargarArchivo, enlaceDeArchivo, verEntregablesDePrueba } from '../api/panel'
import type { EntregaDeLaPrueba } from '../api/tipos'
import { formatearFechaLarga } from '@/dominio/reloj'
import estilos from './EntregablesDePrueba.module.css'

/**
 * ⚠️ **Un 404 aqui son DOS cosas, y la pantalla no puede saber cual.** El backend
 * contesta 404 cuando la persona no tiene intento de prueba —no la rindio— y
 * tambien cuando la vacante queda fuera del alcance de quien mira: eso ultimo es
 * decision de `AlcanceSobreLaVacante`, que devuelve 404 y no 403 a proposito,
 * para no confirmar que existe algo que no te toca.
 *
 * Por eso la frase **no afirma** que no rindio. Decirlo era el fallo caro: quien
 * califica leia un hecho sobre la persona —«no entrego nada»— cuando lo que
 * pasaba era que no alcanzaba a verlo. Es la misma leccion que el guion del
 * ranking, que significaba cinco cosas y no decia cual.
 */
const SIN_NADA_QUE_ENSENAR =
  'No hay entregables que enseñar. Puede que todavía no rindiera la prueba, o que su vacante quede fuera de tu alcance.'

/** Una prueba sin entregables es un cuestionario, y eso no es un fallo. */
const SIN_ENTREGABLES =
  'Esta prueba no pedía entregar nada: se contesta escribiendo, y lo escrito está debajo.'

const esVacio = (causa: unknown) => causa instanceof ErrorApi && causa.estado === 404
const esSinPermiso = (causa: unknown) => causa instanceof ErrorApi && causa.estado === 403

export function EntregablesDePrueba({ postulacionId }: { postulacionId: number }) {
  const consulta = useQuery({
    queryKey: ['panel-entregables-prueba', postulacionId],
    queryFn: () => verEntregablesDePrueba(postulacionId),
    retry: false,
  })

  const filas = consulta.data
  // Igual que la lista de respuestas: `isError` a secas se enciende tambien al
  // fallar un refresco de fondo, y ahi quitar lo que hay deja a quien califica
  // sin lo que estaba mirando.
  const sinNada = !filas
  const entregados = filas?.filter((f) => f.loEntrego).length ?? 0

  return (
    <section className={estilos.bloque}>
      <div className={estilos.cabecera}>
        <h3 className={estilos.titulo}>Lo que entregó</h3>
        {filas && filas.length > 0 && (
          <p className={estilos.recuento}>
            {entregados} de {filas.length} entregados
          </p>
        )}
      </div>

      {consulta.isPending && <p className={estilos.dato}>Buscando lo que entregó…</p>}

      {sinNada && esSinPermiso(consulta.error) && (
        <p className={estilos.sinPermiso}>
          <b>Tu rol ve el ranking, no la ficha de cada persona.</b> Lo que entregó se abre
          con el permiso de ver la ficha de un candidato. Si lo necesitas para calificar,
          pídeselo a quien administra los permisos.
        </p>
      )}

      {sinNada && esVacio(consulta.error) && <p className={estilos.vacio}>{SIN_NADA_QUE_ENSENAR}</p>}

      {sinNada && consulta.isError && !esSinPermiso(consulta.error) && !esVacio(consulta.error) && (
        <p className={estilos.avisoMalo} role="alert">
          {consulta.error instanceof Error
            ? consulta.error.message
            : 'No pudimos traer lo que entregó.'}{' '}
          <button className={estilos.reintentar} type="button" onClick={() => consulta.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {consulta.isError && filas && (
        <p className={estilos.desactualizado} role="status">
          No pudimos refrescar esto, así que es lo último que llegó.{' '}
          <button className={estilos.reintentar} type="button" onClick={() => consulta.refetch()}>
            Volver a intentarlo
          </button>
        </p>
      )}

      {filas &&
        (filas.length === 0 ? (
          <p className={estilos.vacio}>{SIN_ENTREGABLES}</p>
        ) : (
          <ul className={estilos.lista} role="list">
            {filas.map((fila) => (
              <Entrega fila={fila} key={fila.entregableRequeridoId} />
            ))}
          </ul>
        ))}
    </section>
  )
}

/**
 * Una de las cosas pedidas, con lo que llego debajo.
 *
 * ⚠️ **«Falta» lleva la palabra dentro, no solo el color.** Es «la regla de la
 * forma primero»: en gris, un rojo y un gris de prosa caen casi en la misma
 * luminancia, y lo que no puede pasar es que un obligatorio sin entregar se lea
 * como uno mas de la lista.
 */
function Entrega({ fila }: { fila: EntregaDeLaPrueba }) {
  const contexto = [
    fila.esObligatorio ? 'obligatorio' : 'opcional',
    fila.version && fila.version > 1 ? `versión ${fila.version}` : null,
    fila.subidoEn ? `entregado el ${formatearFechaLarga(fila.subidoEn)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={estilos.entrega}>
      <div className={estilos.cuerpo}>
        <p className={estilos.nombre}>
          {fila.nombre}
          {!fila.loEntrego && (
            <span className={fila.esObligatorio ? estilos.faltaGrave : estilos.falta}>
              {fila.esObligatorio ? 'Falta, y era obligatorio' : 'No lo entregó'}
            </span>
          )}
        </p>
        {fila.detalle && <p className={estilos.detalle}>{fila.detalle}</p>}
        {contexto && <p className={estilos.contexto}>{contexto}</p>}
        <LoQueLlego fila={fila} />
      </div>
    </li>
  )
}

/**
 * Lo que hay donde va el contenido: un enlace, un archivo, o el motivo de que
 * no haya ninguno.
 *
 * ⚠️ **Una fila NUNCA trae las dos cosas.** Al subir se guarda `(archivoId, null)`
 * y al pegar un enlace `(null, enlace)`; la restriccion de la base es un O, no un
 * Y. Se pintan los dos campos igual porque el que sobra viene nulo, y escribirlo
 * asi evita tener que adivinar cual toca.
 *
 * ⚠️ **Con formato `CUALQUIERA` se puede perder una entrega de vista.** Quien pega
 * un enlace y luego sube un archivo deja DOS filas, y de un entregable se enseña
 * la ultima version: el enlace anterior no se pinta. No se inventa aqui una
 * solucion —haria falta que el backend mandara el historial— pero se dice, que es
 * lo que separa un hueco de un dato que no llego.
 */
function LoQueLlego({ fila }: { fila: EntregaDeLaPrueba }) {
  if (!fila.loEntrego) {
    return null
  }
  const hayContenido = fila.enlace !== null || fila.archivoId !== null
  return (
    <div className={estilos.contenido}>
      {fila.enlace && <ElEnlaceQuePego enlace={fila.enlace} />}
      {fila.archivoId !== null && (
        <AbrirElArchivo
          archivoId={fila.archivoId}
          nombre={fila.archivoNombre}
          deQue={fila.nombre}
        />
      )}
      {/*
        El porque solo se pinta si de verdad no hay nada que ensenar. Con
        contenido delante seria ruido, y el backend lo manda tambien en el caso
        de «el archivo ya no esta guardado» junto al enlace que si sigue.
      */}
      {!hayContenido && fila.porQueNoSeVe && (
        <p className={estilos.porQueNo}>{fila.porQueNoSeVe}</p>
      )}
    </div>
  )
}

/**
 * El enlace que pego el candidato.
 *
 * ⚠️ **Solo se hace pulsable lo que es `http` o `https`.** Es texto libre: la
 * unica validacion que tiene es que no venga en blanco, ni en el DTO ni en la
 * base. React neutraliza `javascript:` en un `href`, pero no los demas esquemas,
 * y un `href` que no sea web no lleva a ningun sitio que quien califica quiera
 * ir. Lo que no pasa la guarda se pinta como texto, que se puede leer y copiar.
 *
 * ⚠️ **El texto del enlace ES la direccion, a proposito.** Un «Ver el video»
 * esconderia a donde lleva, y esto es contenido de fuera: quien va a pulsar
 * tiene derecho a ver el destino antes. Por lo mismo va `noopener noreferrer`,
 * sin el cual la pestana abierta con `_blank` puede reescribir la nuestra desde
 * el otro lado.
 */
function ElEnlaceQuePego({ enlace }: { enlace: string }) {
  let navegable = false
  try {
    const url = new URL(enlace)
    navegable = url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    // Ni siquiera es una direccion: se queda en texto.
  }
  if (!navegable) {
    return (
      <p className={estilos.enlaceRaro}>
        {enlace}
        <span className={estilos.avisoEnlace}>
          No es una dirección web, así que no se abre desde aquí.
        </span>
      </p>
    )
  }
  return (
    <a className={estilos.enlace} href={enlace} target="_blank" rel="noopener noreferrer">
      {enlace}
    </a>
  )
}

/**
 * El boton que abre un archivo entregado.
 *
 * ⚠️ **Dos caminos, y el primero no existe en local.** Se pide el enlace
 * firmado —en produccion el archivo sale del bucket sin pasar por el backend— y
 * si ese endpoint contesta que este entorno no reparte enlaces, se cae a la
 * descarga por el backend. Sin la caida esta pantalla no se podria mirar en
 * local, que es donde se mira.
 */
function AbrirElArchivo({
  archivoId,
  nombre,
  deQue,
}: {
  archivoId: number
  nombre: string | null
  /** El entregable al que pertenece: es lo que distingue un boton de otro. */
  deQue: string
}) {
  const [yendo, setYendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function abrir() {
    setYendo(true)
    setFallo(null)
    /*
      La ventana se pide AHORA, dentro del gesto de la persona. Un `window.open`
      despues del `await` lo bloquea el navegador, y bloqueado devuelve `null`
      sin lanzar: un `try/catch` no se enteraria.
    */
    const ventana = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const firmado = await enlaceDeArchivo(archivoId)
      // Se decide por el esquema y no por la excepcion: en local el backend
      // contesta 200 con una url `memoria://` que ningun navegador abre.
      if (/^https?:/i.test(firmado.url) && ventana) {
        ventana.location.href = firmado.url
        return
      }
      ventana?.close()
      await bajarlo()
    } catch {
      ventana?.close()
      await bajarlo()
    } finally {
      setYendo(false)
    }
  }

  /**
   * Los bytes por el backend. Es el camino que funciona en los dos entornos, y
   * el unico que funciona en local.
   */
  async function bajarlo() {
    try {
      const archivo = await descargarArchivo(archivoId)
      const url = URL.createObjectURL(archivo.contenido)
      const enlace = document.createElement('a')
      enlace.href = url
      // El nombre lo pone el servidor en `Content-Disposition`; el de reserva es
      // para no guardar un archivo sin nombre.
      enlace.download = archivo.nombre ?? nombre ?? `entregable-${archivoId}`
      /*
        Se engancha al documento antes de pulsarlo y se suelta despues: un ancla
        desprendida no dispara la descarga en todos los navegadores. Y la url se
        revoca en la vuelta siguiente, porque revocarla en la misma puede abortar
        la descarga que se acaba de pedir.
      */
      document.body.appendChild(enlace)
      enlace.click()
      document.body.removeChild(enlace)
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : 'No pudimos abrir el archivo.')
    }
  }

  return (
    <>
      <button
        className={estilos.archivo}
        type="button"
        onClick={abrir}
        disabled={yendo}
        /*
          ⚠️ **Dos entregables sin nombre de archivo darian dos botones iguales.**
          `nombre_original` es nullable en la base, asi que el nombre visible
          puede ser el mismo texto de reserva dos veces. Quien usa lector de
          pantalla necesita saber cual de los dos es.
        */
        aria-label={`Abrir lo que entregó en ${deQue}`}
      >
        <span>{yendo ? 'Abriendo…' : (nombre ?? 'Abrir el archivo')}</span>
      </button>
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </>
  )
}
