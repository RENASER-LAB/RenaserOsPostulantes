/**
 * Pedirle a la IA que califique: a una persona, o a la tanda entera.
 *
 * El panel enseñaba las notas del agente y no tenia con que pedirlas. Sin este
 * bloque no habia forma de calificar a nadie desde aqui.
 *
 * ⚠️ **Encolar no es calificar, y esa regla ordena todo lo que se lee aqui.**
 * Los cuatro endpoints contestan al momento; la llamada al modelo tarda decenas
 * de segundos —medio minuto por cada diez curriculums en la criba rapida—. Lo
 * unico cierto tras un 200 es que **se pidio**. Por eso en este archivo no se
 * escribe nunca «calificado»: se escribe «se pidio», «esta calificando», «en
 * cola». Es la misma regla de los indicadores que mienten que ya costo
 * respuestas de candidatos perdidas en la evaluacion.
 *
 * ⚠️ **Este bloque no sabe si la nota llego, y no puede saberlo.** No hay
 * endpoint de estado, y los dos componentes reciben `alTerminar` y nada mas:
 * las notas las tiene la tabla del ranking, que las pide al servidor. Asi que
 * quien puede decir «ya hay nota» es la tabla, comparando con el servidor;
 * esto solo cuenta lo que hizo. Un cartel de «listo» dibujado desde aqui seria
 * exactamente el indicador que miente.
 *
 * **Como se entera de que ya esta: sondeo acotado.** Se refresca solo unas
 * cuantas veces, con los huecos creciendo, y **para**. Se eligio sondear en vez
 * de dejar un boton de refrescar a secas porque la espera normal es de decenas
 * de segundos y obligar a pulsar durante ese minuto convierte al equipo en el
 * reloj del agente. Y se acota porque un sondeo infinito no vale: hoy mismo,
 * con la clave de DeepSeek local muerta, estaria refrescando cada pocos
 * segundos hasta que alguien cierre la pestaña sin que llegue nunca una nota.
 * **Al agotarse no dice que fallo —no lo sabe— dice que dejo de mirar.**
 *
 * ⚠️ **Cerrar la ficha mientras se espera corta los refrescos.** El temporizador
 * vive en un efecto y se limpia al desmontar. No es un descuido: la peticion
 * sigue su curso en el servidor y la tabla trae la nota cuando se vuelva a
 * abrir; lo unico que se pierde es que la traiga sola.
 *
 * **El violeta va en la criba rapida y en ningun otro sitio de este archivo.**
 * Es la que llena de notas un ranking vacio —sin ella la fina no tiene sobre
 * que volver— y ademas es la reversible de las dos: ponerlo en la fina
 * empujaria hacia la accion mas cara y la que pisa notas ya puestas. Y el boton
 * de una persona se queda en secundario aunque sea el unico de su ficha: el
 * bloque de la tanda esta siempre encima de la tabla, asi que un violeta en la
 * ficha significaria dos violetas en la misma pantalla.
 *
 * ⚠️ **`estado` SI se mira, y el `mensaje` del backend SI se pinta cuando dice
 * que no.** La primera version no hacia ninguna de las dos cosas: los valores
 * no estaban pactados en el contrato —`estado` es un `string` suelto— y ya paso
 * una vez que el portal filtrara texto interno en ingles a la cara de quien
 * miraba. El e2e contra el backend vivo encontro el agujero: **hay un segundo
 * valor, `SIN_CAMBIOS`, que llega con un 200 y significa que no se encolo
 * nada** —ya la califico el agente, hay un trabajo en marcha, o la rubrica no
 * le reserva ningun criterio al agente y la califica una persona entera—. Sin
 * mirarlo, esto pintaba «Se pidió. La IA está calificando» y arrancaba cinco
 * refrescos sobre una cola vacia. El indicador que miente, otra vez, y en el
 * archivo que lo tenia escrito en la cabecera.
 *
 * Los cuatro motivos son cuatro situaciones distintas —tres se resuelven solas
 * y una obliga a calificar a mano— y **lo unico que las separa es el
 * `mensaje`**, que el backend escribe en español y para esta pantalla. Asi que
 * se pinta, con cinturon: si viene vacio o no es texto, hay una frase propia.
 */

import { useState } from 'react'
import { ErrorApi } from '../api/cliente'
import {
  calificarPerfilIntegralConIa,
  calificarPruebaConIa,
  cribaFina,
  cribaRapida,
} from '../api/panel'
import { useSondeoAcotado } from './useSondeoAcotado'
import estilos from './CalificarConIa.module.css'

/**
 * Cada cuanto se vuelve a pedir las notas, en milisegundos, desde el refresco
 * anterior. Crecientes: los primeros minutos es cuando puede haber llegado algo
 * y ahi conviene mirar seguido; despues, cada vuelta vale menos.
 *
 * La longitud del array **es** el tope del sondeo, y es lo que se le dice a
 * quien mira: «cinco intentos». No se dice cuanto duran en minutos porque ese
 * numero se quedaria viejo en cuanto alguien toque los huecos.
 */
const PASOS_UNO = [8_000, 12_000, 16_000, 22_000, 30_000] as const

/** La tanda tarda mas, asi que se mira mas espaciado y una vuelta mas. */
const PASOS_TANDA = [15_000, 20_000, 30_000, 40_000, 55_000, 70_000] as const

type EtapaQueSeCalifica = 'PRUEBA_PUESTO' | 'PERFIL_INTEGRAL'

const COMO_SE_PIDE: Record<EtapaQueSeCalifica, { boton: string; que: string }> = {
  PRUEBA_PUESTO: {
    boton: 'Pedirle a la IA que califique la prueba',
    que: 'la prueba del puesto',
  },
  PERFIL_INTEGRAL: {
    boton: 'Pedirle a la IA que califique el perfil',
    que: 'el perfil integral: el currículum y la evaluación del banco juntos',
  },
}

type Criba = 'RAPIDA' | 'FINA'

/**
 * Cuanta gente hay en la tanda, dicho como se lee.
 *
 * Sin el dato —o con una tanda de cero— se queda en palabras: «toda la tanda»
 * sigue diciendo el alcance, que es lo que la pregunta tiene que decir.
 */
const cuantos = (total?: number) =>
  !total
    ? 'toda la tanda'
    : total === 1
      ? 'la única persona de la tanda'
      : `las ${total} personas de la tanda`

/**
 * Lo que se pregunta antes de cada criba.
 *
 * Las dos preguntan, y no solo la fina: las dos cambian de golpe los datos de
 * mucha gente, y la pregunta tiene que decir **a cuantos alcanza y que se
 * pierde**. Lo que no dice es lo que no sabemos: la rapida vuelve a puntuar a
 * todo el mundo, pero nadie ha comprobado si tambien pisa una nota de la fina,
 * asi que no se afirma.
 *
 * ⚠️ **El tamaño de la tanda se nombra en la rapida y NO en la fina**, aunque
 * el dato este ahi en las dos. En la rapida el numero **es** el alcance. En la
 * fina no: la fina va sobre la parte alta y cuanta es lo decide un parametro
 * del backend que esta pantalla no conoce. Metido ahi seria el unico numero de
 * la frase, y un numero gana siempre a la salvedad que lo rodea: se leeria
 * «pisa las notas de 24 personas», que es justo lo que no sabemos.
 */
const CRIBAS: Record<
  Criba,
  { boton: string; confirmar: string; queSePierde: (total?: number) => string }
> = {
  RAPIDA: {
    boton: 'Criba rápida',
    confirmar: 'Sí, criba rápida',
    queSePierde: (total) =>
      `Alcanza a ${cuantos(total)}, también a quien ya tiene nota: se le vuelve a ` +
      'puntuar y su nota queda marcada como provisional. Ordena la tanda, no decide por ti.',
  },
  FINA: {
    boton: 'Criba fina',
    confirmar: 'Sí, criba fina',
    queSePierde: () =>
      'Alcanza solo a la parte alta de la tanda —cuánta gente es lo decide un parámetro ' +
      'del backend, no esta pantalla— y pisa las notas provisionales de la criba rápida ' +
      'de quienes alcance.',
  },
}

/** El unico valor de `estado` que significa que hay trabajo en marcha. */
const ENCOLADA = 'ENCOLADA'
/** Un 200 que dice que no se pidio nada. Comprobado contra el backend vivo. */
const SIN_CAMBIOS = 'SIN_CAMBIOS'

type NoSeEncolo = { titular: string; porque: string }

/**
 * Que dijo de verdad el backend al contestar 200.
 *
 * ⚠️ **Solo `ENCOLADA` cuenta como encolado, y todo lo demas no.** Podria
 * mirarse al reves —dar por bueno todo lo que no sea `SIN_CAMBIOS`— y seria
 * mas comodo el dia que el backend añada un valor nuevo. Pero las dos
 * equivocaciones no cuestan lo mismo: pasarse de prudente enseña el mensaje del
 * servidor y no refresca solo, con el boton de mirar al lado; quedarse corto
 * vuelve a pintar «está calificando» sobre una cola vacia, que es el fallo que
 * este archivo tiene prohibido por escrito.
 *
 * Vale para las dos formas de respuesta —`CalificacionEncolada` y
 * `PasadaEncolada`— porque el `estado` y el `mensaje` son los mismos campos.
 */
function loQuePaso(
  respuesta: { estado?: string; mensaje?: string } | null | undefined,
): { encolado: true } | ({ encolado: false } & NoSeEncolo) {
  const estado = typeof respuesta?.estado === 'string' ? respuesta.estado : ''
  if (estado === ENCOLADA) {
    return { encolado: true }
  }

  // El cinturon del mensaje: es texto del backend, y aunque hoy los cuatro
  // esten escritos en español y para esta pantalla, un `mensaje` vacio dejaria
  // el bloque mudo justo cuando hay algo que explicar.
  const mensaje = typeof respuesta?.mensaje === 'string' ? respuesta.mensaje.trim() : ''

  if (estado === SIN_CAMBIOS) {
    return {
      encolado: false,
      titular: 'No se encoló nada.',
      porque:
        mensaje ||
        'El servidor no dijo por qué. Mira las notas antes de volver a pedirlo: puede que ' +
          'ya estén puestas, o que haya un trabajo en marcha ahora mismo.',
    }
  }

  return {
    encolado: false,
    titular: 'No damos por hecho que se encolara.',
    porque:
      mensaje ||
      `El servidor contestó «${estado || 'sin estado'}», que este panel no conoce, así que ` +
        'no decimos que haya nada calificándose. Mira las notas.',
  }
}

/**
 * Por que no se pudo pedir.
 *
 * Un 403 y un 500 no se arreglan igual y no se pueden contar igual: el primero
 * es el reparto de permisos funcionando y no hay nada que reintentar; el
 * segundo se reintenta, y ademas hay que decir que **no quedo nada encolado**,
 * porque si no quien mira se queda sin saber si esperar o volver a pulsar.
 */
function explicarFallo(causa: unknown): { texto: string; permiso: boolean } {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 403) {
      return {
        permiso: true,
        texto:
          'Tu rol no puede pedirle notas a la IA. Es el permiso «ajustar nota»: ' +
          'pídeselo a quien administra los permisos del panel. No hay nada que ' +
          'reintentar desde aquí.',
      }
    }
    if (causa.estado === 404) {
      return {
        permiso: true,
        texto:
          'El servidor no encuentra esto, o queda fuera de tu alcance de vacantes. ' +
          'No se pidió nada. Si debería ser tuyo, pídele a quien administra los ' +
          'permisos que revise tu alcance.',
      }
    }
    if (causa.estado >= 500) {
      return {
        permiso: false,
        texto:
          `El servidor falló al encolarlo (error ${causa.estado}). No quedó nada en ` +
          'cola, así que no hay ninguna nota en camino: vuelve a intentarlo, y si se ' +
          'repite avisa a quien mantiene el backend.',
      }
    }
    return {
      permiso: false,
      texto: `El servidor rechazó la petición (error ${causa.estado}): ${causa.message} No quedó nada en cola.`,
    }
  }
  return {
    permiso: false,
    texto:
      causa instanceof Error
        ? `No llegamos a pedirlo: ${causa.message} Comprueba la conexión y vuelve a intentarlo.`
        : 'No llegamos a pedirlo. Comprueba la conexión y vuelve a intentarlo.',
  }
}

type Fase = 'reposo' | 'pidiendo' | 'encolado'

/**
 * Pedir la nota de UNA persona. Vive dentro de su ficha, junto a sus notas.
 *
 * No pregunta antes, y la asimetria con las cribas es el punto: esto alcanza a
 * una sola persona, la que ya se esta mirando, y `calificarPruebaConIa` no pisa
 * lo que un evaluador haya ajustado a mano. Preguntar aqui seria pedir permiso
 * para reparar lo que la criba dejo sin nota.
 */
export function CalificarAUno({
  postulacionId,
  etapa,
  alTerminar,
}: {
  postulacionId: number
  etapa: EtapaQueSeCalifica
  /** Refrescar las notas. Esto no sabe si llegaron: quien las tiene es la tabla. */
  alTerminar: () => void
}) {
  const [fase, setFase] = useState<Fase>('reposo')
  const [fallo, setFallo] = useState<{ texto: string; permiso: boolean } | null>(null)
  const [noSeEncolo, setNoSeEncolo] = useState<NoSeEncolo | null>(null)
  const sondeo = useSondeoAcotado(PASOS_UNO, alTerminar)
  const texto = COMO_SE_PIDE[etapa]

  async function pedirla() {
    setFase('pidiendo')
    setFallo(null)
    setNoSeEncolo(null)
    try {
      const respuesta = await (etapa === 'PRUEBA_PUESTO'
        ? calificarPruebaConIa(postulacionId)
        : calificarPerfilIntegralConIa(postulacionId))
      const paso = loQuePaso(respuesta)
      if (!paso.encolado) {
        // ⚠️ 200 y nada en cola. Ni «se pidió», ni sondeo, ni cuenta de
        // refrescos: no hay ninguna nota en camino que esperar. Y vuelve a
        // reposo, porque tres de los cuatro motivos se resuelven solos y
        // reintentar mas tarde es lo que toca.
        setFase('reposo')
        setNoSeEncolo({ titular: paso.titular, porque: paso.porque })
        return
      }
      setFase('encolado')
      sondeo.empezar()
    } catch (causa) {
      // Vuelve a reposo y no a un estado de error propio: el boton tiene que
      // seguir siendo pulsable, porque en un 500 reintentar es justo la salida.
      setFase('reposo')
      setFallo(explicarFallo(causa))
    }
  }

  // Sigue el mismo camino que un 403: es una respuesta correcta a lo que se
  // pidio, no una averia. Nube hundida y `role="status"`, nunca el aviso rojo.
  const sinCambios = noSeEncolo && (
    <NoEncolado titular={noSeEncolo.titular} porque={noSeEncolo.porque} alMirar={alTerminar} />
  )

  // ⚠️ **Apagado tambien mientras el sondeo mira, y no solo mientras se pide.**
  // Volver a pulsar ahi reiniciaria la cuenta de vueltas —«3 de 5» saltaria a
  // «0 de 5» con la primera peticion todavia viva— y encima pagaria una segunda
  // llamada al modelo por lo mismo. Al agotarse el sondeo vuelve a estar
  // pulsable, que es justo cuando reintentar puede tener sentido.
  const ocupado = fase === 'pidiendo' || sondeo.mirando

  return (
    <div className={estilos.uno}>
      <div className={estilos.filaAccion}>
        <button
          className={estilos.pedir}
          type="button"
          onClick={pedirla}
          disabled={ocupado}
          aria-busy={fase === 'pidiendo'}
        >
          {fase === 'pidiendo' ? 'Pidiéndolo…' : texto.boton}
        </button>

        {fase === 'encolado' && sondeo.mirando && (
          <span className={estilos.calificando}>Está calificando</span>
        )}
      </div>

      <Fallo fallo={fallo} />
      {sinCambios}

      {fase === 'encolado' && sondeo.mirando && (
        <p className={estilos.esperando} role="status">
          <b>Se pidió.</b> La IA está calificando {texto.que}, y eso tarda decenas de
          segundos. Refrescamos las notas por ti: {sondeo.vueltas} de {sondeo.total} veces.
          La nota que aparezca en la tabla sale del servidor; si no está, es que el agente
          todavía no ha terminado.
        </p>
      )}

      {fase === 'encolado' && sondeo.agotado && (
        <SeguimosEsperando total={sondeo.total} alMirar={alTerminar} />
      )}
    </div>
  )
}

/**
 * Pedirle notas a la tanda entera. Va encima de la tabla del ranking.
 *
 * ⚠️ **Las dos cribas preguntan antes**, y la pregunta va aqui mismo y no en un
 * `<dialog>`: cabe en dos lineas, se lee pegada al boton que la abrio, y en una
 * pantalla donde ya hay una tabla larga un modal solo tapa lo que se esta a
 * punto de cambiar.
 */
export function CalificarLaTanda({
  vacanteId,
  total,
  alTerminar,
}: {
  vacanteId: number
  /**
   * Cuanta gente hay en la tanda, si se sabe. Sale de `ranking.data.total`.
   *
   * Opcional porque este bloque tiene que poder preguntar bien sin el: sin
   * numero la pregunta dice «toda la tanda», que sigue siendo el alcance. Lo
   * que no hace nunca es inventarse una cifra ni deducirla de nada de aqui.
   */
  total?: number
  /** Refrescar el ranking. Las notas nuevas las trae el, no este bloque. */
  alTerminar: () => void
}) {
  const [preguntando, setPreguntando] = useState<Criba | null>(null)
  const [fase, setFase] = useState<Fase>('reposo')
  const [fallo, setFallo] = useState<{ texto: string; permiso: boolean } | null>(null)
  // Cuanta gente dijo el servidor que entraba en la pasada. Es su numero, no
  // uno calculado aqui: por eso solo existe despues de la respuesta.
  const [encolados, setEncolados] = useState<number | null>(null)
  const [pedida, setPedida] = useState<Criba | null>(null)
  const [noSeEncolo, setNoSeEncolo] = useState<NoSeEncolo | null>(null)
  const sondeo = useSondeoAcotado(PASOS_TANDA, alTerminar)

  async function lanzar(criba: Criba) {
    setPreguntando(null)
    setFase('pidiendo')
    setFallo(null)
    setEncolados(null)
    setNoSeEncolo(null)
    setPedida(criba)
    try {
      const respuesta = await (criba === 'RAPIDA' ? cribaRapida(vacanteId) : cribaFina(vacanteId))
      // Las dos cribas devuelven hoy `ENCOLADA` siempre, pero se comprueba
      // igual: es la misma forma de respuesta que la de una persona, donde el
      // segundo valor si existe, y el fallo que se arregla aqui consistio en
      // dar por hecho lo que el servidor no habia dicho.
      const paso = loQuePaso(respuesta)
      if (!paso.encolado) {
        setFase('reposo')
        setNoSeEncolo({ titular: paso.titular, porque: paso.porque })
        return
      }
      setEncolados(respuesta.candidatos)
      setFase('encolado')
      // Una pasada que no alcanzo a nadie no tiene nota que esperar: sondearla
      // seria refrescar seis veces un ranking que no va a cambiar, y enseñar
      // «esta calificando» encima de una cola vacia.
      if (respuesta.candidatos > 0) {
        sondeo.empezar()
      }
    } catch (causa) {
      setFase('reposo')
      setFallo(explicarFallo(causa))
    }
  }

  const pidiendo = fase === 'pidiendo'

  /*
   * La criba que se esta esperando se apaga; la otra no.
   *
   * Volver a pulsar la misma reiniciaria la cuenta de vueltas —«4 de 6» a «0 de
   * 6»— con la pasada anterior todavia viva, y encima pagaria una segunda
   * llamada al modelo por los mismos curriculums. La otra se deja pulsable a
   * proposito: encadenar la fina detras de la rapida es una secuencia normal.
   *
   * ⚠️ **El sondeo sigue a la ultima peticion, no a las dos.** Si se lanza la
   * fina con la rapida en marcha, la cuenta pasa a ser la de la fina. Es la
   * simplificacion honesta que se puede hacer sin endpoint de estado.
   */
  const enVuelo = (criba: Criba) => sondeo.mirando && pedida === criba

  return (
    <div className={estilos.tanda}>
      <h3 className={estilos.titulo}>Pedirle notas a la IA</h3>
      {/* Tres frases y no cinco: esto vive encima de la tabla del ranking, que
          es la mesa de trabajo de la jornada entera, y cada linea de aqui es una
          linea que la tabla baja. Lo que se pierde al recortar lo repite la
          pregunta de la confirmacion, que es donde de verdad hace falta. */}
      <p className={estilos.explica}>
        La rápida ordena la tanda entera con el modelo que no razona, y sus notas quedan
        provisionales. La fina vuelve sobre la parte alta con el modelo que razona y las
        sustituye. Ninguna de las dos devuelve la nota al momento: encolan.
      </p>

      {preguntando ? (
        <div className={estilos.pregunta} role="status">
          <p className={estilos.queSePierde}>
            {CRIBAS[preguntando].queSePierde(total)} ¿Seguimos?
          </p>
          <div className={estilos.acciones}>
            <button
              className={estilos.confirmar}
              type="button"
              onClick={() => lanzar(preguntando)}
            >
              {CRIBAS[preguntando].confirmar}
            </button>
            <button
              className={estilos.cancelar}
              type="button"
              onClick={() => setPreguntando(null)}
            >
              Mejor no
            </button>
          </div>
        </div>
      ) : (
        <div className={estilos.acciones}>
          <button
            className={estilos.rapida}
            type="button"
            onClick={() => setPreguntando('RAPIDA')}
            disabled={pidiendo || enVuelo('RAPIDA')}
            aria-busy={pidiendo && pedida === 'RAPIDA'}
          >
            {pidiendo && pedida === 'RAPIDA' ? 'Pidiéndolo…' : CRIBAS.RAPIDA.boton}
          </button>
          <button
            className={estilos.fina}
            type="button"
            onClick={() => setPreguntando('FINA')}
            disabled={pidiendo || enVuelo('FINA')}
            aria-busy={pidiendo && pedida === 'FINA'}
          >
            {pidiendo && pedida === 'FINA' ? 'Pidiéndolo…' : CRIBAS.FINA.boton}
          </button>
          {fase === 'encolado' && sondeo.mirando && (
            <span className={estilos.calificando}>Está calificando</span>
          )}
        </div>
      )}

      <Fallo fallo={fallo} />

      {noSeEncolo && (
        <NoEncolado
          titular={noSeEncolo.titular}
          porque={noSeEncolo.porque}
          alMirar={alTerminar}
        />
      )}

      {/* Aceptada y vacia. Sin esta rama se leia «Se pidió la criba rápida para
          0 personas. Están en cola», con el sondeo mirando una cola que no
          existe. Que el servidor acepte no quiere decir que hubiera trabajo. */}
      {fase === 'encolado' && encolados === 0 && (
        <p className={estilos.esperando} role="status">
          <b>La pasada no alcanzó a nadie.</b> El servidor aceptó la petición y dice que en
          esta tanda no hay ahora mismo nadie a quien pasarle la criba{' '}
          {pedida === 'FINA' ? 'fina' : 'rápida'}. No hay nada esperando y el ranking no va
          a cambiar por esto.
        </p>
      )}

      {fase === 'encolado' && sondeo.mirando && (
        <p className={estilos.esperando} role="status">
          <b>
            Se pidió la criba {pedida === 'FINA' ? 'fina' : 'rápida'} para{' '}
            {encolados === 1 ? '1 persona' : `${encolados ?? 0} personas`}.
          </b>{' '}
          Están en cola: la IA tarda alrededor de medio minuto por cada diez currículums.
          Refrescamos el ranking por ti: {sondeo.vueltas} de {sondeo.total} veces. Las notas
          que aparezcan en la tabla salen del servidor.
        </p>
      )}

      {fase === 'encolado' && sondeo.agotado && (
        <SeguimosEsperando total={sondeo.total} alMirar={alTerminar} />
      )}
    </div>
  )
}

/**
 * Cuando el sondeo se agota.
 *
 * Lo unico que ha pasado es que **nosotros** dejamos de mirar, asi que eso es
 * lo que dice. Decir «no se pudo calificar» seria inventarse un resultado que
 * nadie ha visto: la peticion sigue viva en el servidor.
 */
function SeguimosEsperando({ total, alMirar }: { total: number; alMirar: () => void }) {
  return (
    <p className={estilos.agotado} role="status">
      Dejamos de refrescar después de {total} intentos. <b>No quiere decir que fallara</b>:
      la petición sigue su curso en el servidor y puede tardar más que eso. Vuelve a mirar
      dentro de un rato.{' '}
      <button className={estilos.mirarOtraVez} type="button" onClick={() => alMirar()}>
        Mirar otra vez
      </button>
    </p>
  )
}

/**
 * Un 200 que no encolo nada.
 *
 * ⚠️ **No es un error y no se pinta como uno.** Tres de los cuatro motivos que
 * devuelve el backend se resuelven solos —ya la califico el agente, hay un
 * trabajo en marcha— y el cuarto no es una averia sino un dato del puesto: la
 * rubrica no le reserva ningun criterio al agente y la califica una persona.
 * Va donde el 403: nube hundida y `role="status"`.
 *
 * Lleva el boton de mirar porque en dos de esos motivos la nota puede estar a
 * punto de aparecer, y aqui no hay sondeo que la traiga sola.
 */
function NoEncolado({
  titular,
  porque,
  alMirar,
}: {
  titular: string
  porque: string
  alMirar: () => void
}) {
  return (
    <p className={estilos.sinCambios} role="status">
      <b>{titular}</b> {porque}{' '}
      <button className={estilos.mirarOtraVez} type="button" onClick={() => alMirar()}>
        Mirar las notas
      </button>
    </p>
  )
}

/** El 403 y el 404 no son averias, asi que no se pintan como tales. */
function Fallo({ fallo }: { fallo: { texto: string; permiso: boolean } | null }) {
  if (!fallo) return null
  if (fallo.permiso) {
    return (
      <p className={estilos.sinPermiso} role="status">
        {fallo.texto}
      </p>
    )
  }
  return (
    <p className={estilos.avisoMalo} role="alert">
      {fallo.texto}
    </p>
  )
}
