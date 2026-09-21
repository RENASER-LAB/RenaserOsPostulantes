/**
 * La remuneracion de una vacante, desde el panel.
 *
 * Dos piezas y una sola idea:
 *
 *   - `CamposDeRemuneracion` son los campos sueltos, para el alta: ahi el sueldo
 *     es un campo mas del formulario porque todavia no hay nadie a quien avisar.
 *   - `RemuneracionDeLaVacante` es la seccion de configuracion, con su motivo y
 *     su boton propio: es la puerta para cambiar SOLO el sueldo sin abrir el
 *     formulario entero. Cambiarlo **le deja un aviso en el portal a cada
 *     candidato vivo**; desde el formulario de edicion ese aviso sale junto con
 *     el resto del guardado, en uno solo.
 *
 * ⚠️ **El cambio de sueldo ya no manda correo.** La campana se queda quieta
 * hasta que la persona entra y la ve; el correo se pierde —promociones,
 * direcciones que invento el cargador de curriculums— y prometer los dos era
 * prometer una entrega que nadie podia confirmar.
 *
 * ⚠️ **Esconder el sueldo no es un ajuste de presentacion.** Es la mitad de un
 * trato: si la vacante lo enseña, quien postula esta obligado a decir cuanto
 * quiere ganar; si lo calla, no se le pide nada. La pantalla tiene que decirlo
 * con esas palabras, porque quien elige «oculta» para no comprometerse no suele
 * saber que con eso tambien esta renunciando a saber lo que piden los demas.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { COMO_SE_ESCRIBE, aCifra } from '@/dominio/dinero'
import { actualizarRemuneracion } from '@/panel/api/panel'
import type { RemuneracionDeLaVacante as Datos, VacantePanel } from '@/panel/api/tipos'
import estilos from './Remuneracion.module.css'

export type TipoRemuneracion = 'OCULTA' | 'FIJA' | 'RANGO'

/** Lo que el formulario tiene en la mano: texto, que es lo que hay en un input. */
export interface FormularioRemuneracion {
  tipo: TipoRemuneracion
  min: string
  max: string
  moneda: string
}

export const REMUNERACION_VACIA: FormularioRemuneracion = {
  tipo: 'OCULTA',
  min: '',
  max: '',
  moneda: 'PEN',
}

/** Lo guardado, traido al formulario. */
export function desdeLaVacante(r: Datos | null | undefined): FormularioRemuneracion {
  if (!r || r.tipo === 'OCULTA') return REMUNERACION_VACIA
  return {
    tipo: r.tipo,
    min: r.min === null ? '' : String(r.min),
    max: r.max === null ? '' : String(r.max),
    moneda: r.moneda ?? 'PEN',
  }
}

/**
 * El formulario convertido en lo que el backend espera, o el error que lo impide.
 *
 * Se valida aqui y no solo en el servidor porque un 400 despues de pulsar
 * «guardar» en una vacante publicada es un susto: el boton dice que va a
 * avisar a cuarenta personas, y quien lo pulsa merece saber antes si lo que
 * escribio tiene sentido.
 */
export function comoCuerpo(f: FormularioRemuneracion): { datos: Datos } | { error: string } {
  if (f.tipo === 'OCULTA') {
    return { datos: { tipo: 'OCULTA', min: null, max: null, moneda: null } }
  }
  // `aCifra` y no `Number`: `Number('3,500')` vale 3.5 y pasaria las validaciones
  // de abajo. Un monto fijo mal leido en una vacante publicada deja cuarenta
  // avisos que dicen «Ahora: S/ 3.50». Ver `dominio/dinero`.
  const min = aCifra(f.min)
  if (f.min.trim() === '') {
    return {
      error: f.tipo === 'FIJA'
        ? 'Escribe el monto que ofreces.'
        : 'Escribe el mínimo del rango.',
    }
  }
  if (min === null || min <= 0) {
    return { error: COMO_SE_ESCRIBE }
  }
  if (min > 1_000_000) {
    return { error: 'Ese monto parece un error de tecleo: revísalo.' }
  }
  if (f.tipo === 'FIJA') {
    return { datos: { tipo: 'FIJA', min, max: null, moneda: f.moneda } }
  }
  const max = aCifra(f.max)
  if (f.max.trim() === '') {
    return { error: 'Escribe el máximo del rango, o cámbialo a monto fijo.' }
  }
  if (max === null || max <= 0) {
    return { error: COMO_SE_ESCRIBE }
  }
  if (max < min) {
    return { error: 'El máximo del rango no puede ser menor que el mínimo.' }
  }
  if (max > 1_000_000) {
    return { error: 'Ese monto parece un error de tecleo: revísalo.' }
  }
  return { datos: { tipo: 'RANGO', min, max, moneda: f.moneda } }
}

/**
 * Si dos remuneraciones dicen lo mismo.
 *
 * Lo usa el formulario de edicion para decidir si pedir el motivo: el sueldo se
 * manda siempre —el cuerpo es el formulario entero— y sin esta comparacion se
 * pediria una justificacion por no haber tocado nada.
 */
export function mismoSueldo(a: Datos, b: Datos | null | undefined): boolean {
  if (!b) return a.tipo === 'OCULTA'
  if (a.tipo !== b.tipo) return false
  if (a.tipo === 'OCULTA') return true
  return Number(a.min) === Number(b.min)
    && Number(a.max ?? 0) === Number(b.max ?? 0)
    && (a.moneda ?? 'PEN') === (b.moneda ?? 'PEN')
}

const SIMBOLO: Record<string, string> = { PEN: 'S/', USD: 'US$' }

// ---------- los campos sueltos ----------

export function CamposDeRemuneracion({
  valor,
  alCambiar,
  /**
   * Si ya no se puede cambiar la decision de publicar el sueldo o no.
   *
   * Lo enciende la seccion de configuracion de una vacante PUBLICADA. En el alta
   * va apagado: ahi es justo la decision que se viene a tomar.
   */
  visibilidadCongelada = false,
  /** Que lado esta congelado: publicaba (true) o no publicaba (false). */
  laEnsenaba = false,
}: {
  valor: FormularioRemuneracion
  alCambiar: (v: FormularioRemuneracion) => void
  visibilidadCongelada?: boolean
  laEnsenaba?: boolean
}) {
  const poner = (parte: Partial<FormularioRemuneracion>) =>
    alCambiar({ ...valor, ...parte })

  /**
   * Bloqueada solo la tarjeta que cruzaria la linea, no las tres.
   *
   * Una vacante publicada con rango puede pasar a monto fijo sin problema: las
   * dos publican, y el trato sigue en pie. Lo que no puede es apagarlo. Bloquear
   * las tres seria impedir un cambio que si es legitimo — y de los que mas se
   * hacen: cerrar un rango en una cifra cuando ya se sabe el numero.
   */
  const bloqueada = (tipo: TipoRemuneracion) => {
    if (!visibilidadCongelada) return false
    const esaEnsena = tipo !== 'OCULTA'
    return laEnsenaba !== esaEnsena
  }

  return (
    <div className={estilos.campos}>
      <fieldset className={estilos.tipos}>
        <legend className={estilos.leyenda}>Qué paga este puesto</legend>

        {(
          [
            ['RANGO', 'Un rango', 'De un mínimo a un máximo, según experiencia.'],
            ['FIJA', 'Un monto fijo', 'Una sola cifra, la misma para quien entre.'],
            [
              'OCULTA',
              'No publicarlo',
              'No se muestra en la convocatoria — y entonces tampoco se le pide al candidato la suya.',
            ],
          ] as const
        ).map(([tipo, titulo, ayuda]) => (
          <label
            key={tipo}
            className={[
              estilos.tipo,
              valor.tipo === tipo ? estilos.elegido : '',
              bloqueada(tipo) ? estilos.bloqueada : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="radio"
              name="tipo-remuneracion"
              className={estilos.radio}
              checked={valor.tipo === tipo}
              disabled={bloqueada(tipo)}
              onChange={() => poner({ tipo })}
            />
            <span className={estilos.tipoTitulo}>{titulo}</span>
            {/*
              Bloqueada, la tarjeta cambia de texto: decir POR QUE no se puede es
              lo unico que distingue una regla de un fallo. Un radio gris sin
              explicacion se lee como que la pantalla esta rota.
            */}
            <span className={estilos.tipoAyuda}>
              {bloqueada(tipo)
                ? laEnsenaba
                  ? 'No se puede: esta vacante ya salió publicando lo que paga, y a quienes postularon se les exigió su cifra a cambio.'
                  : 'No se puede: se publicó sin enseñar el sueldo, y a quienes ya postularon no hay forma de pedirles la suya ahora.'
                : ayuda}
            </span>
          </label>
        ))}
      </fieldset>

      {valor.tipo !== 'OCULTA' && (
        <div className={estilos.montos}>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Moneda</span>
            <select
              className={estilos.entrada}
              value={valor.moneda}
              onChange={(e) => poner({ moneda: e.target.value })}
            >
              <option value="PEN">Soles (S/)</option>
              <option value="USD">Dólares (US$)</option>
            </select>
          </label>

          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>
              {valor.tipo === 'FIJA' ? 'Monto mensual' : 'Mínimo mensual'}
            </span>
            <div className={estilos.conSimbolo}>
              <span className={estilos.simbolo} aria-hidden="true">
                {SIMBOLO[valor.moneda] ?? 'S/'}
              </span>
              <input
                className={estilos.entrada}
                type="text"
                inputMode="decimal"
                value={valor.min}
                onChange={(e) => poner({ min: e.target.value })}
              />
            </div>
          </label>

          {valor.tipo === 'RANGO' && (
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Máximo mensual</span>
              <div className={estilos.conSimbolo}>
                <span className={estilos.simbolo} aria-hidden="true">
                  {SIMBOLO[valor.moneda] ?? 'S/'}
                </span>
                <input
                  className={estilos.entrada}
                  type="text"
                  inputMode="decimal"
                  value={valor.max}
                  onChange={(e) => poner({ max: e.target.value })}
                />
              </div>
            </label>
          )}
        </div>
      )}

      {/*
        La consecuencia, dicha donde se decide.

        Quien elige «no publicarlo» para no comprometerse rara vez sabe que con
        eso renuncia tambien a saber lo que piden los candidatos. Escondido en la
        documentacion, ese trato no lo conoce nadie; aqui se lee antes de elegir.
      */}
      <p className={estilos.consecuencia}>
        {valor.tipo === 'OCULTA' ? (
          <>
            <b>Al no publicar la remuneración</b>, tampoco se le exige al candidato decir
            cuánto quiere ganar. Es un trato simétrico: pedir su cifra escondiendo la
            tuya es lo que este sistema no hace.
          </>
        ) : (
          <>
            <b>Al publicar la remuneración</b>, quien postule tendrá que declarar cuánto
            quiere ganar, de forma obligatoria. Solo la verán los roles con permiso para
            ver pretensiones.
          </>
        )}
      </p>
    </div>
  )
}

// ---------- la seccion de configuracion ----------

export function RemuneracionDeLaVacante({ vacante }: { vacante: VacantePanel }) {
  const cache = useQueryClient()
  const [forma, setForma] = useState(() => desdeLaVacante(vacante.remuneracion))
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const cerrada = vacante.estado === 'CERRADA'
  const publicada = vacante.estado === 'PUBLICADA'

  /**
   * Publicar el sueldo, o no publicarlo, se decide ANTES de publicar la vacante.
   *
   * Una vacante publicada enseñando lo que paga le exigio su cifra a cada
   * persona que postulo. Dejar de publicarla ahora seria quedarse con lo que
   * dijeron sin dar nada a cambio — y encenderla en una que se publico sin ella
   * deja media tanda con cifra y media sin, porque a los de antes no hay forma de
   * volver a pedirsela.
   *
   * El **monto** si se cambia, y es justo lo que les llega a la campana de su
   * portal.
   * Por eso se congela solo la eleccion de publicar o no, y moverse entre «rango»
   * y «monto fijo» sigue estando abierto: las dos publican.
   *
   * El backend lo hace cumplir igual; esto es para que no se descubra pulsando.
   */
  const laEnsenaba = vacante.remuneracion?.tipo
    ? vacante.remuneracion.tipo !== 'OCULTA'
    : false
  const visibilidadCongelada = publicada

  const guardar = useMutation({
    mutationFn: () => {
      const salida = comoCuerpo(forma)
      if ('error' in salida) return Promise.reject(new Error(salida.error))
      return actualizarRemuneracion(vacante.id, {
        remuneracion: salida.datos,
        motivo: motivo.trim(),
      })
    },
    onSuccess: async (respuesta) => {
      setFallo(null)
      setMotivo('')
      // Se dice a cuanta gente le llego, con nombre y apellido. «Guardado» a
      // secas deja a quien acaba de mover un sueldo sin saber si el aviso salio
      // —y es la pregunta que se hace en el mismo segundo de pulsar—.
      setHecho(
        respuesta.candidatosAvisados === 0
          ? `Guardado: ${respuesta.ahora}. No había candidatos a quienes avisar.`
          : `Guardado: de ${respuesta.antes} a ${respuesta.ahora}. Avisamos a ` +
            `${respuesta.candidatosAvisados} candidato` +
            `${respuesta.candidatosAvisados === 1 ? '' : 's'} en su portal.`,
      )
      await cache.invalidateQueries({ queryKey: ['panel-vacante', vacante.id] })
    },
    onError: (causa) => {
      setHecho(null)
      setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar la remuneración.')
    },
  })

  // En borrador no hay a quien avisar, asi que tampoco hace falta justificarse.
  // Pedir un motivo para rellenar un campo de una vacante que nadie ha visto es
  // burocracia; pedirlo cuando cuarenta personas van a recibir el aviso, no.
  const motivoObligatorio = publicada

  function enviar() {
    setHecho(null)
    const salida = comoCuerpo(forma)
    if ('error' in salida) {
      setFallo(salida.error)
      return
    }
    // La misma guarda que el backend, dicha antes de pulsar. Las tarjetas ya
    // salen bloqueadas, asi que esto solo salta si algo las esquiva — pero el
    // mensaje tiene que existir de todos modos, no un 409 opaco.
    const iraAEnsenarla = salida.datos.tipo !== 'OCULTA'
    if (visibilidadCongelada && laEnsenaba !== iraAEnsenarla) {
      setFallo(
        laEnsenaba
          ? 'Esta vacante ya está publicada enseñando lo que paga, y a cada persona que ' +
            'postuló se le exigió decir cuánto quiere ganar. El monto sí se puede cambiar; ' +
            'para esconderlo habría que cerrarla y abrir otra.'
          : 'Esta vacante se publicó sin enseñar lo que paga, así que a quienes ya postularon ' +
            'no se les pidió su pretensión y no hay forma de volver atrás a pedírsela. ' +
            'Para publicarlo habría que cerrarla y abrir otra.',
      )
      return
    }
    if (motivoObligatorio && motivo.trim() === '') {
      setFallo('Escribe por qué cambia el sueldo: queda en la auditoría de la vacante.')
      return
    }
    guardar.mutate()
  }

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Remuneración</h2>

      {vacante.remuneracionActualizadaEn && (
        <p className={estilos.ultimoCambio}>
          Última vez que cambió:{' '}
          {new Date(vacante.remuneracionActualizadaEn).toLocaleDateString('es-PE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          . Los candidatos lo ven marcado en su portal.
        </p>
      )}

      {cerrada ? (
        <p className={estilos.aviso}>Una vacante cerrada no cambia de sueldo.</p>
      ) : (
        <>
          <CamposDeRemuneracion
            valor={forma}
            alCambiar={setForma}
            visibilidadCongelada={visibilidadCongelada}
            laEnsenaba={laEnsenaba}
          />

          {publicada && (
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Por qué cambia</span>
              <input
                className={estilos.entrada}
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="El presupuesto aprobado subió"
              />
              <span className={estilos.ayudaMotivo}>
                Queda en la auditoría. No se le enseña al candidato: a él le llega el
                antes y el ahora.
              </span>
            </label>
          )}

          {publicada && (
            <p className={estilos.consecuenciaFuerte}>
              Esta vacante está publicada: al guardar, cada candidato que sigue en carrera
              recibirá un aviso en su portal. A quienes ya no continúan, no.
            </p>
          )}

          <button
            type="button"
            className={estilos.guardar}
            onClick={enviar}
            disabled={guardar.isPending}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar la remuneración'}
          </button>
        </>
      )}

      {fallo && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {fallo}
        </p>
      )}
      {hecho && (
        <p className={`${estilos.aviso} ${estilos.bueno}`} role="status">
          {hecho}
        </p>
      )}
    </section>
  )
}
