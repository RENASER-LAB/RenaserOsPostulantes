/**
 * El celular de la cuenta, en «Mi cuenta» (V73).
 *
 * «Celular: +51 987 654 321» con «Cambiar», que abre el campo con la misma regla que
 * el registro. Es el número desde el que el candidato escribe al bot de WhatsApp:
 * cambiarlo cierra lo que estuviera vinculado con el anterior, y por eso se dice.
 *
 * Las cuentas anteriores a la V73 no lo tienen: se ofrece «Añadir» en vez de
 * «Cambiar», sin obligar a nada (la spec no obliga a darlo al entrar).
 *
 * Se llega aquí desde «Cámbialo en Mi cuenta», en la tarjeta de WhatsApp, por
 * `/perfil#celular`: el campo sale ya abierto, el bloque a la vista y el foco dentro.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cambiarCelular, quienSoy } from '@/api/portal'
import type { QuienSoy } from '@/api/tipos'
import { comoE164, MENSAJE_CELULAR, paraEditar, paraMostrar } from '@/dominio/celular'
import { Campo } from '@/ui/campos/Campo'
import estilos from './MiCelular.module.css'

/** El ancla de este bloque en el perfil. Ver `rutas.celularDeLaCuenta`. */
export const ANCLA_CELULAR = 'celular'

export function MiCelular() {
  const cache = useQueryClient()
  const sesion = useQuery({ queryKey: ['mi-celular'], queryFn: quienSoy })
  const [editando, setEditando] = useState(false)
  const [escrito, setEscrito] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { hash, key } = useLocation()
  const seccion = useRef<HTMLElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  // La navegación cuyo ancla ya se atendió: «Cancelar» no tiene que volver a abrirlo.
  const atendida = useRef<string | null>(null)
  const bajarAlCampo = useRef(false)

  const guardar = useMutation({
    mutationFn: (telefono: string) => cambiarCelular(telefono),
    onSuccess: async (celular) => {
      cache.setQueryData<QuienSoy>(['mi-celular'], (antes) =>
        antes ? { ...antes, telefono: celular.telefono } : antes,
      )
      setEditando(false)
      // Las tarjetas de WhatsApp de sus procesos enseñan este número: se vuelven a pedir.
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['postulaciones'] }),
        cache.invalidateQueries({ queryKey: ['postulacion'] }),
      ])
    },
    onError: (causa) => {
      setError(causa instanceof Error && causa.message ? causa.message : MENSAJE_CELULAR)
    },
  })

  const telefono = sesion.data?.telefono ?? null
  const sabido = sesion.isSuccess

  /*
    Llegar desde «Cámbialo en Mi cuenta» a `/perfil#celular`. El ancla la intenta el
    armazón al navegar, pero entonces el perfil todavía se está cargando y este bloque
    no existe; y el campo, además, se edita con el número de ahora, que llega aparte.
    Así que se resuelve aquí, en cuanto se sabe el número: se abre el campo y, ya
    pintado, se baja hasta el bloque y se pone el foco dentro.
  */
  useEffect(() => {
    if (hash !== `#${ANCLA_CELULAR}` || !sabido || atendida.current === key) return
    atendida.current = key
    bajarAlCampo.current = true
    setEscrito(paraEditar(telefono))
    setError(null)
    setEditando(true)
  }, [hash, key, sabido, telefono])

  /*
    Sin deslizar, como las reseñas: el `autoFocus` del campo ya dio su propio salto al
    montarse, y un deslizamiento encima se pisaría con él. Este deja a la vista el
    título del bloque, que el `scroll-margin-top` aparta de la cabecera flotante; el
    foco ya está dentro, y se asegura sin mover nada más.
  */
  useEffect(() => {
    if (!editando || !bajarAlCampo.current) return
    bajarAlCampo.current = false
    seccion.current?.scrollIntoView({ block: 'start' })
    campo.current?.focus({ preventScroll: true })
  }, [editando])

  function abrir() {
    setEscrito(paraEditar(telefono))
    setError(null)
    setEditando(true)
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!escrito.trim()) {
      setError('Escribe tu celular.')
      return
    }
    if (comoE164(escrito) === null) {
      setError(MENSAJE_CELULAR)
      return
    }
    setError(null)
    guardar.mutate(escrito)
  }

  return (
    <section
      ref={seccion}
      id={ANCLA_CELULAR}
      className={estilos.bloque}
      aria-labelledby="titulo-mi-celular"
    >
      <h2 className={estilos.titulo} id="titulo-mi-celular">
        Tu cuenta
      </h2>

      {!editando ? (
        <div className={estilos.fila}>
          <p className={estilos.dato}>
            Celular:{' '}
            {sesion.isPending ? (
              <span className={estilos.cargando}>…</span>
            ) : telefono ? (
              <b className={estilos.numero}>{paraMostrar(telefono)}</b>
            ) : (
              <span className={estilos.sinDato}>todavía no lo has dado</span>
            )}
          </p>
          <button
            type="button"
            className={estilos.cambiar}
            onClick={abrir}
            disabled={sesion.isPending}
          >
            {telefono ? 'Cambiar' : 'Añadir'}
          </button>
        </div>
      ) : (
        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <div className={estilos.campo}>
            <Campo
              ref={campo}
              etiqueta="Celular (WhatsApp)"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              prefijo="+51"
              placeholder="987 654 321"
              value={escrito}
              onChange={(e) => {
                setEscrito(e.target.value)
                setError(null)
              }}
              error={error ?? undefined}
              autoFocus
            />
          </div>
          <div className={estilos.acciones}>
            <button type="submit" className={estilos.guardar} disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              className={estilos.cancelar}
              onClick={() => setEditando(false)}
              disabled={guardar.isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <p className={estilos.ayuda}>
        Es el número desde el que nos escribes por WhatsApp. Si lo cambias, dejas de recibir
        las novedades en el anterior.
      </p>
    </section>
  )
}
