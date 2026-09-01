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
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import estilos from './Campo.module.css'

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  /** Lo que conviene saber antes de escribir. No es el error. */
  ayuda?: string
  error?: string
}

/**
 * El ojo de una contraseña.
 *
 * Dibujado, no un glifo: un emoji cambia de forma en cada sistema y no hereda
 * el grosor de trazo del resto. Las dos siluetas comparten la misma pupila y el
 * mismo párpado, así que **lo que cambia es la barra**, no el icono entero: se
 * lee como un interruptor y no como dos dibujos distintos.
 *
 * ⚠️ **El icono dice la acción, no el estado**, igual que el nombre del botón.
 * Con la contraseña tapada se dibuja el ojo abierto —«mostrar»—, y tachado
 * cuando ya se ve. Al revés, el dibujo diría una cosa y su etiqueta la
 * contraria, y quien navega con lector de pantalla oiría la buena.
 */
function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg
      className={estilos.ojo}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.1" />
      {tachado && <path d="M4.2 19.8 19.8 4.2" />}
    </svg>
  )
}

export const Campo = forwardRef<HTMLInputElement, PropsCampo>(function Campo(
  { etiqueta, ayuda, error, id, type, ...resto },
  ref,
) {
  const propio = useId()
  const idCampo = id ?? propio
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`

  const [visible, setVisible] = useState(false)
  // ⚠️ `type` se saca de `resto` a propósito. Si se quedara dentro del spread,
  // el atributo que gana lo decidiría el orden en el que se escriben las líneas
  // y el ojo dejaría de cambiar nada, en silencio.
  const esContrasena = type === 'password'

  const entrada = (
    <input
      {...resto}
      type={esContrasena && visible ? 'text' : type}
      id={idCampo}
      ref={ref}
      className={`${estilos.entrada}${esContrasena ? ` ${estilos.conOjo}` : ''}`}
      aria-invalid={error ? true : undefined}
      // El error y la ayuda se anuncian con el campo, no sueltos: sin esto,
      // quien navega con lector de pantalla oye el campo y nunca su error.
      aria-describedby={[ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined}
    />
  )

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
      {esContrasena ? (
        <div className={estilos.conBoton}>
          {entrada}
          {/*
            `type="button"` no es adorno: sin él, el botón por defecto envía el
            formulario, y aquí eso sería intentar entrar al pulsar el ojo. Es una
            trampa que este portal ya pagó una vez.

            El nombre dice la acción que va a ocurrir, y cambia con el estado: un
            «Mostrar» fijo miente en cuanto la contraseña ya se ve.
          */}
          <button
            type="button"
            className={estilos.interruptorOjo}
            onClick={() => setVisible((antes) => !antes)}
            aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
            aria-controls={idCampo}
            title={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          >
            <Ojo tachado={visible} />
          </button>
        </div>
      ) : (
        entrada
      )}
      {error && (
        <p className={estilos.error} id={idError}>
          {error}
        </p>
      )}
    </div>
  )
})

interface PropsSeleccion extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string
  ayuda?: string
  error?: string
  /** Las `<option>` y `<optgroup>`, escritas por quien lo usa. */
  children: ReactNode
}

/**
 * Un desplegable del sistema, con su etiqueta y su error atados.
 *
 * ⚠️ **Es un `<select>` de verdad, y esa es la decisión.** Es la regla de la
 * plataforma primero: con casi doscientas provincias agrupadas por departamento,
 * un combobox propio tendría que reimplementar el teclado entero —flechas, inicio
 * y fin, escribir para saltar, `Escape`—, el anuncio de «grupo, tal
 * departamento» del lector de pantalla, y la rueda nativa del móvil. Todo eso
 * viene gratis con `<optgroup>`, y la flecha ya la dibuja `mundo.css`.
 *
 * Comparte forma con `Campo` a propósito: en un formulario, dos campos que se
 * rellenan igual no pueden verse distinto.
 */
export const Seleccion = forwardRef<HTMLSelectElement, PropsSeleccion>(function Seleccion(
  { etiqueta, ayuda, error, id, children, ...resto },
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
      {/*
        `aria-invalid` no es solo para el lector: el formulario busca
        `[aria-invalid="true"]` para llevar el foco al primer campo con problema,
        y sin esto un desplegable sin elegir se saltaría ese salto en silencio.
      */}
      <select
        {...resto}
        id={idCampo}
        ref={ref}
        className={estilos.seleccion}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined
        }
      >
        {children}
      </select>
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
  { etiqueta, ayuda, error, maximo, id, value, maxLength, ...resto },
  ref,
) {
  const propio = useId()
  const idCampo = id ?? propio
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  const escrito = typeof value === 'string' ? value.length : 0
  const avisar = maximo !== undefined && escrito > maximo * 0.8
  // ⚠️ **`maximo` tiene que llegar tambien al elemento, no solo al contador.**
  // Antes solo pintaba la cuenta: se podia escribir de mas, el guardado rebotaba
  // con un 400 del `@Size` del backend y la pantalla no lo habia evitado.
  // Es la trampa de «limites del backend que el portal no conoce».
  const tope = maxLength ?? maximo

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
        maxLength={tope}
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
