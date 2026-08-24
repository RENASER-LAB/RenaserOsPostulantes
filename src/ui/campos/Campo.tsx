/**
 * Los campos de formulario del portal.
 *
 * Existen como pieza compartida porque la parte que se equivoca siempre es la
 * misma: atar la etiqueta al campo, atar el error al campo, y decir el error en
 * palabras. Hecho una vez, lo heredan todos los formularios.
 */

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import estilos from './Campo.module.css'

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  /** Lo que conviene saber antes de escribir. No es el error. */
  ayuda?: string
  error?: string
}

export const Campo = forwardRef<HTMLInputElement, PropsCampo>(function Campo(
  { etiqueta, ayuda, error, id, ...resto },
  ref,
) {
  const propio = useId()
  const idCampo = id ?? propio
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`

  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={idCampo}>
        {etiqueta}
      </label>
      {ayuda && (
        <span className={estilos.ayuda} id={idAyuda}>
          {ayuda}
        </span>
      )}
      <input
        {...resto}
        id={idCampo}
        ref={ref}
        className={estilos.entrada}
        aria-invalid={error ? true : undefined}
        // El error y la ayuda se anuncian con el campo, no sueltos: sin esto,
        // quien navega con lector de pantalla oye el campo y nunca su error.
        aria-describedby={[ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined}
      />
      {error && (
        <p className={estilos.error} id={idError}>
          {error}
        </p>
      )}
    </div>
  )
})

interface PropsConsentimiento extends InputHTMLAttributes<HTMLInputElement> {
  titulo: string
  /** Qué se está aceptando, en una frase que se entienda sin abrir el legal. */
  explicacion: ReactNode
  obligatorio?: boolean
  /** El texto legal vigente que sirve el backend. Se pliega. */
  legal?: string
  error?: string
  marcado?: boolean
}

/**
 * Un consentimiento.
 *
 * Son dos y distintos: aceptar el tratamiento para este proceso es obligatorio,
 * y querer avisos de futuras vacantes es aparte y opcional. Nunca se juntan en
 * una sola casilla.
 *
 * El bloque del texto legal esta plegado y con su propio scroll a proposito:
 * los textos vigentes todavia no nombran a las empresas que procesan los datos y
 * tienen que hacerlo antes del primer candidato real, asi que va a crecer.
 */
export const Consentimiento = forwardRef<HTMLInputElement, PropsConsentimiento>(
  function Consentimiento(
    { titulo, explicacion, obligatorio, legal, error, marcado, id, ...resto },
    ref,
  ) {
    const propio = useId()
    const idCampo = id ?? propio
    const idError = `${idCampo}-error`

    const clases = [
      estilos.consentimiento,
      marcado ? estilos.marcado : '',
      error ? estilos.invalido : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div>
        <div className={clases}>
          <input
            {...resto}
            type="checkbox"
            id={idCampo}
            ref={ref}
            className={estilos.casilla}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? idError : undefined}
          />
          <div className={estilos.cuerpoConsentimiento}>
            <label className={estilos.tituloConsentimiento} htmlFor={idCampo}>
              {titulo}{' '}
              <span className={estilos.obligatorio}>
                {obligatorio ? '· obligatorio' : '· opcional'}
              </span>
            </label>
            <p className={estilos.textoConsentimiento}>{explicacion}</p>
            {legal && (
              <details className={estilos.legal}>
                <summary className={estilos.legalResumen}>Leer el texto completo</summary>
                <div className={estilos.legalTexto}>{legal}</div>
              </details>
            )}
          </div>
        </div>
        {error && (
          <p className={estilos.error} id={idError} style={{ marginTop: 'var(--e2)' }}>
            {error}
          </p>
        )}
      </div>
    )
  },
)

interface PropsArea extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string
  ayuda?: string
  error?: string
  /**
   * El limite del backend, cuando lo hay.
   *
   * Se enseña la cuenta solo al acercarse: un contador desde el primer caracter
   * convierte escribir en una carrera contra un numero.
   */
  maximo?: number
}

export const AreaTexto = forwardRef<HTMLTextAreaElement, PropsArea>(function AreaTexto(
  { etiqueta, ayuda, error, maximo, id, value, ...resto },
  ref,
) {
  const propio = useId()
  const idCampo = id ?? propio
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  const escrito = typeof value === 'string' ? value.length : 0
  const avisar = maximo !== undefined && escrito > maximo * 0.8

  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={idCampo}>
        {etiqueta}
      </label>
      {ayuda && (
        <span className={estilos.ayuda} id={idAyuda}>
          {ayuda}
        </span>
      )}
      <textarea
        {...resto}
        value={value}
        id={idCampo}
        ref={ref}
        className={estilos.area}
        aria-invalid={error ? true : undefined}
        aria-describedby={[ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined}
      />
      {avisar && (
        <span className={`${estilos.cuenta}${escrito > maximo ? ` ${estilos.pasado}` : ''}`}>
          {escrito.toLocaleString('es-PE')} de {maximo.toLocaleString('es-PE')} caracteres
        </span>
      )}
      {error && (
        <p className={estilos.error} id={idError}>
          {error}
        </p>
      )}
    </div>
  )
})
