/**
 * El recorrido de una postulacion, hito por hito.
 *
 * Es la pieza que define el mundo del portal: tu postulacion como algo que va
 * en camino, con hitos cumplidos y un siguiente hito siempre nombrado. La
 * diferencia con un rastreo de paquete es deliberada — **lo cumplido no se
 * apaga**: una etapa cerrada se sigue leyendo con el mismo peso, porque lo que
 * el candidato ya demostro es suyo.
 *
 * La accion vive DENTRO del hito abierto, nunca en un boton suelto al pie: asi
 * «donde estoy» y «que hago» son la misma mirada.
 *
 * Aqui no hay fechas por etapa, y no es un olvido: la lista de postulaciones no
 * trae historial —eso solo llega en el detalle— y una fecha inventada seria
 * peor que ninguna.
 */

import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import type { MiPostulacion } from '@/api/tipos'
import {
  esFinal,
  leTocaAlCandidato,
  momentoDe,
  recorridoDe,
  type Etapa,
  type Hito,
} from '@/dominio/estados'
import { describirAntiguedad, formatearFechaCorta } from '@/dominio/reloj'
import estilos from './Seguimiento.module.css'

/** Como suena cada estado de hito para quien no ve la pantalla. */
function comoSeOye(paso: Hito['paso'], leToca: boolean): string {
  if (paso === 'cumplida') return 'Etapa superada.'
  if (paso === 'cortada') return 'El proceso terminó en esta etapa.'
  if (paso === 'pendiente') return 'Etapa pendiente.'
  return leToca ? 'Etapa en curso: te toca a ti.' : 'Etapa en curso: en revisión del equipo.'
}

/** El nombre del hito. Es lo que el candidato hace, no como se llama la etapa. */
const QUE_PASA_EN: Record<string, string> = {
  PERFIL: 'Tu perfil',
  PRUEBA: 'La prueba del puesto',
  SIMULACION: 'La simulación de trabajo',
  VALIDACION: 'El periodo de validación',
  DECISION: 'La decisión final',
}

/** Lo que le espera en las etapas que todavia no ha alcanzado. */
const QUE_LE_ESPERA: Record<string, string> = {
  PERFIL: 'Tu currículum y una evaluación escrita.',
  PRUEBA: 'Un encargo real del puesto, con tiempo medido.',
  SIMULACION: 'Una sesión de trabajo, con fecha a elegir.',
  VALIDACION: 'Un periodo corto trabajando de verdad.',
  DECISION: 'Una persona decide, mirando todo el recorrido.',
}

interface Props {
  postulacion: MiPostulacion
  /**
   * Cuando se alcanzo cada etapa. Solo la pantalla de detalle las tiene: la
   * lista de postulaciones no trae historial, y una fecha inventada seria peor
   * que ninguna.
   */
  fechas?: Partial<Record<Etapa, string>>
  /** Donde se detuvo una postulacion terminada, si se sabe. */
  etapaDeCorte?: Etapa
}

export function Seguimiento({ postulacion, fechas, etapaDeCorte }: Props) {
  const hitos = recorridoDe(postulacion.estado, etapaDeCorte)
  const momento = momentoDe(postulacion.estado)
  const leToca = leTocaAlCandidato(postulacion.estado)
  const final = esFinal(postulacion.estado)

  // Solo la etapa que viene ahora explica en que consiste. Explicarlas todas
  // repetia el mismo parrafo en cada postulacion y enterraba lo unico que hay
  // que leer: lo que toca hoy.
  const siguiente = hitos.find((h) => h.paso === 'pendiente')?.clave

  return (
    <ol className={estilos.linea} role="list">
      {hitos.map((hito) => (
        <HitoDelRecorrido
          key={hito.clave}
          hito={hito}
          esSiguiente={hito.clave === siguiente}
          fecha={fechas?.[hito.clave]}
          leToca={leToca}
          final={final}
          titulo={momento.titulo}
          ayuda={momento.ayuda}
          accion={momento.accion}
          uuid={postulacion.uuid}
          diasSinCambio={postulacion.diasSinCambio}
        />
      ))}
    </ol>
  )
}

function HitoDelRecorrido({
  hito,
  esSiguiente,
  fecha,
  leToca,
  final,
  titulo,
  ayuda,
  accion,
  uuid,
  diasSinCambio,
}: {
  hito: Hito
  esSiguiente: boolean
  fecha?: string
  leToca: boolean
  final: boolean
  titulo: string
  ayuda: string
  accion: { etiqueta: string; destino: (uuid: string) => string } | null
  uuid: string
  diasSinCambio: number
}) {
  const sinMovimiento = useReducedMotion()
  const enCurso = hito.paso === 'en_curso'

  // Un hito en curso que no le toca al candidato espera a otra persona: se
  // pinta con contorno, sin acento y sin boton.
  const esperando = enCurso && !leToca
  const clases = [
    estilos.hito,
    estilos[hito.paso === 'en_curso' ? 'enCurso' : hito.paso],
    esperando ? estilos.esperando : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={clases}>
      <div className={estilos.marca}>
        {/* El unico momento con movimiento del portal: la marca que se asienta
            cuando una etapa se cierra. Por eso significa. */}
        <motion.span
          className={estilos.cuadro}
          aria-hidden="true"
          initial={sinMovimiento || hito.paso !== 'cumplida' ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className={estilos.cuerpo}>
        <p className={estilos.nombre}>{QUE_PASA_EN[hito.clave] ?? hito.etiqueta}</p>

        {/* El cuadro es decorativo para un lector de pantalla, asi que el
            estado tiene que estar en el texto. Antes solo hablaban «cumplida» y
            «cortada»: se oian cinco etapas planas sin saber en cual estaba. */}
        <span className={estilos.soloLectores}>{comoSeOye(hito.paso, leToca)}</span>

        {hito.paso === 'cumplida' && (
          <p className={estilos.detalle}>
            {fecha ? (
              <>
                Superada el <time dateTime={fecha}>{formatearFechaCorta(fecha)}</time>
              </>
            ) : (
              'Superada'
            )}
          </p>
        )}

        {/* En un proceso terminado no se anuncia lo que venia despues: decirle
            a quien ya no continua que le esperaba una sesion de trabajo es
            cruel y no sirve para nada. */}
        {hito.paso === 'pendiente' && !final && esSiguiente && (
          <p className={estilos.detalle}>{QUE_LE_ESPERA[hito.clave]}</p>
        )}

        {hito.paso === 'cortada' && (
          <p className={estilos.detalle}>
            {fecha ? (
              <>
                Llegaste el <time dateTime={fecha}>{formatearFechaCorta(fecha)}</time>. El
                proceso terminó aquí.
              </>
            ) : (
              'El proceso terminó en esta etapa.'
            )}
          </p>
        )}

        {enCurso && !final && leToca && accion && (
          <div className={estilos.abierto}>
            <h3 className={estilos.abiertoTitulo}>{titulo}</h3>
            <p className={estilos.abiertoAyuda}>{ayuda}</p>
            <div className={estilos.abiertoPie}>
              <Link className={estilos.accion} to={accion.destino(uuid)}>
                {accion.etiqueta}
              </Link>
              <span className={estilos.plazo}>{describirAntiguedad(diasSinCambio)}</span>
            </div>
          </div>
        )}

        {enCurso && !final && !leToca && (
          <div className={estilos.espera}>
            <h3 className={estilos.esperaTitulo}>{titulo}</h3>
            <p className={estilos.esperaAyuda}>
              {ayuda} <b>No tienes que hacer nada.</b>
            </p>
          </div>
        )}
      </div>
    </li>
  )
}
