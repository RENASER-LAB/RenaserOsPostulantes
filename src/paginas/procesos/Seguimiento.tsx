/**
 * El recorrido de una postulacion, tramo por tramo.
 *
 * Es la pieza que define el mundo del portal: tu candidatura como un canto de
 * nube que se va formando. El espectro corre una sola vez de la primera etapa a
 * la quinta y cada tramo enseña su rebanada, asi que el color dice cuanto has
 * avanzado y no que etapa es. La diferencia con el fenomeno real es deliberada
 * —alli el canto se deshace, aqui **lo formado se queda formado**— porque lo
 * que el candidato ya demostro es suyo.
 *
 * La accion vive en el panel que cuelga del tramo abierto, marcado con su
 * misma señal violeta: asi «donde estoy» y «que hago» son la misma mirada. No
 * va dentro del tramo porque un tramo mide una quinta parte del ancho y ahi no
 * cabe ni el titulo.
 *
 * Aqui no hay fechas por etapa, y no es un olvido: la lista de postulaciones no
 * trae historial —eso solo llega en el detalle— y una fecha inventada seria
 * peor que ninguna.
 */

import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
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

/** Como suena cada estado de tramo para quien no ve la pantalla. */
function comoSeOye(paso: Hito['paso'], leToca: boolean): string {
  if (paso === 'cumplida') return 'Etapa superada.'
  if (paso === 'cortada') return 'El proceso terminó en esta etapa.'
  if (paso === 'pendiente') return 'Etapa pendiente.'
  return leToca ? 'Etapa en curso: te toca a ti.' : 'Etapa en curso: en revisión del equipo.'
}

/** El nombre del tramo. Es lo que el candidato hace, no como se llama la etapa. */
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
  const enCurso = hitos.find((h) => h.paso === 'en_curso')

  return (
    <div className={estilos.recorrido}>
      <ol className={estilos.banda} role="list">
        {hitos.map((hito, indice) => (
          <Tramo
            key={hito.clave}
            hito={hito}
            indice={indice}
            esSiguiente={hito.clave === siguiente}
            fecha={fechas?.[hito.clave]}
            leToca={leToca}
            final={final}
          />
        ))}
      </ol>

      {/*
        El panel del tramo abierto. Fuera de la lista y no dentro de un `<li>`:
        una lista de cinco etapas cuyo tercer elemento pesa diez veces mas que
        los otros deja de leerse como una secuencia de cinco.
      */}
      {enCurso && !final && leToca && momento.accion && (
        <div className={estilos.abierto}>
          <h3 className={estilos.abiertoTitulo}>{momento.titulo}</h3>
          <p className={estilos.abiertoAyuda}>{momento.ayuda}</p>
          <div className={estilos.abiertoPie}>
            <Link className={estilos.accion} to={momento.accion.destino(postulacion.uuid)}>
              {momento.accion.etiqueta}
            </Link>
            <span className={estilos.plazo}>
              {describirAntiguedad(postulacion.diasSinCambio)}
            </span>
          </div>
        </div>
      )}

      {enCurso && !final && !leToca && (
        <div className={estilos.espera}>
          <h3 className={estilos.esperaTitulo}>{momento.titulo}</h3>
          <p className={estilos.esperaAyuda}>
            {momento.ayuda} <b>No tienes que hacer nada.</b>
          </p>
        </div>
      )}
    </div>
  )
}

function Tramo({
  hito,
  indice,
  esSiguiente,
  fecha,
  leToca,
  final,
}: {
  hito: Hito
  indice: number
  esSiguiente: boolean
  fecha?: string
  leToca: boolean
  final: boolean
}) {
  const enCurso = hito.paso === 'en_curso'
  // Un tramo en curso que no le toca al candidato espera a otra persona: la
  // banda se queda a medias, sin violeta y sin boton.
  const forma = enCurso ? (leToca ? estilos.viva : estilos.esperando) : estilos[hito.paso]
  const clases = `${estilos.tramo} ${forma}`

  return (
    <li className={clases} style={{ '--i': indice } as CSSProperties}>
      {/* La franja es decorativa para un lector de pantalla: su estado va en el
          texto de abajo, no en la forma. */}
      <span className={estilos.franja} aria-hidden="true" />

      <div>
        <p className={estilos.nombre}>{QUE_PASA_EN[hito.clave] ?? hito.etiqueta}</p>

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
      </div>
    </li>
  )
}
