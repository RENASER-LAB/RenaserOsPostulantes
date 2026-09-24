/**
 * Pedir el enlace para elegir una contraseña nueva: el formulario del correo y
 * lo que se ve después de enviarlo. Lo usan el portal (`/clave`) y el panel
 * (`/admin/clave`); cada uno pone alrededor su columna, su marca y su pie.
 *
 * ⚠️ **Después de enviar se ve siempre lo mismo**, exista o no la cuenta: el
 * backend contesta 202 vacío en todos los casos y la pantalla no tiene nada que
 * distinguir. Solo un fallo de red o del servidor es un error de verdad, y ese
 * se dice sin salir del formulario.
 *
 * «Reenviar» queda apagado un minuto con su cuenta atrás. No es el único freno
 * —el backend admite tres enlaces por cuenta y hora, y al cuarto contesta lo
 * mismo sin mandar nada—, pero es el que evita el doble clic y la impaciencia.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Campo } from '@/ui/campos/Campo'
import {
  EsquemaCorreo,
  FALLO_AL_PEDIR,
  MENSAJE_ENVIADO,
  SEGUNDOS_PARA_REENVIAR,
} from './reglas'
import { useCuentaAtras } from './useCuentaAtras'
import estilos from './Recuperacion.module.css'

interface Props {
  /** La llamada de su puerta: `pedirRecuperacion` o `pedirRecuperacionPanel`. */
  pedir: (correo: string) => Promise<unknown>
  titulo: string
  bajada: ReactNode
  /** Lo que va debajo en los dos estados. En el portal, la línea de talento. */
  alternativa?: ReactNode
  /**
   * La superficie del formulario, si quien lo usa tiene una.
   *
   * El portal pone el suyo sobre nube, como el resto de sus formularios; el
   * panel lo deja a pelo sobre el fondo, que es su disposición. La decisión es
   * de cada puerta y no de esta pieza, que es la misma para las dos.
   */
  claseFormulario?: string
}

export function PedirEnlace({ pedir, titulo, bajada, alternativa, claseFormulario }: Props) {
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  /** A qué correo se pidió. Nulo mientras no se ha pedido nada. */
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  /** Cuántas veces se envió: cada una devuelve el foco al mensaje. */
  const [envios, setEnvios] = useState(0)
  const { quedan, empezar } = useCuentaAtras()

  const campo = useRef<HTMLInputElement>(null)
  const mensaje = useRef<HTMLParagraphElement>(null)
  // El botón apagado no basta contra el doble clic: los dos clics pueden llegar
  // antes de que React vuelva a pintar. Este cerrojo sí se entera al momento.
  const enCurso = useRef(false)

  // El foco pasa al mensaje al enviar: sin esto, quien usa lector de pantalla
  // pulsa el botón y no oye nada, porque el formulario que tenía delante se fue.
  useEffect(() => {
    if (envios > 0) mensaje.current?.focus()
  }, [envios])

  async function mandar(destino: string) {
    if (enCurso.current) return
    enCurso.current = true
    setFallo(null)
    setEnviando(true)
    try {
      await pedir(destino)
      setEnviadoA(destino)
      empezar(SEGUNDOS_PARA_REENVIAR)
      setEnvios((n) => n + 1)
    } catch {
      setFallo(FALLO_AL_PEDIR)
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enCurso.current) return
    setFallo(null)
    const revision = EsquemaCorreo.safeParse({ correo })
    if (!revision.success) {
      setError(revision.error.issues[0]?.message)
      // Sin el cuadro, el atributo todavía no está en el DOM cuando se busca.
      requestAnimationFrame(() => {
        campo.current?.focus()
      })
      return
    }
    setError(undefined)
    await mandar(revision.data.correo)
  }

  function usarOtroCorreo() {
    setEnviadoA(null)
    setCorreo('')
    setFallo(null)
    requestAnimationFrame(() => {
      campo.current?.focus()
    })
  }

  if (enviadoA !== null) {
    return (
      <>
        <h1 className={estilos.titular}>Revisa tu correo.</h1>
        <p ref={mensaje} className={estilos.mensaje} role="status" tabIndex={-1}>
          {MENSAJE_ENVIADO}
        </p>
        <p className={estilos.para}>
          Lo pediste para <b>{enviadoA}</b>.
        </p>

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}

        <div className={estilos.acciones}>
          <button
            type="button"
            className={estilos.secundario}
            onClick={() => void mandar(enviadoA)}
            disabled={quedan > 0 || enviando}
          >
            {enviando
              ? 'Enviando…'
              : quedan > 0
                ? `Reenviar enlace (en ${quedan} s)`
                : 'Reenviar enlace'}
          </button>
          <button
            type="button"
            className={estilos.secundario}
            onClick={usarOtroCorreo}
            disabled={enviando}
          >
            Usar otro correo
          </button>
        </div>

        {alternativa}
      </>
    )
  }

  return (
    <>
      <h1 className={estilos.titular}>{titulo}</h1>
      <p className={estilos.bajada}>{bajada}</p>

      <form
        className={`${estilos.formulario} ${claseFormulario ?? ''}`}
        onSubmit={alEnviar}
        noValidate
      >
        <Campo
          ref={campo}
          etiqueta="Correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value)
            setError(undefined)
          }}
          error={error}
        />

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}

        <button type="submit" className={estilos.enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>

      {alternativa}
    </>
  )
}
