/**
 * «Recibe tus novedades por WhatsApp» (V73).
 *
 * Sale dentro del recuadro de espera —en «Mis procesos» y en el detalle— cuando la
 * vacante es de RENASER, la beta está encendida y al candidato no le toca nada.
 * Cuando le toca algo no se ofrece: manda la acción. Pero si ya está conectado, sale
 * en una línea al pie de la acción (`compacta`): «Dejar de recibir» no puede
 * desaparecer justo cuando el aviso que llegó por WhatsApp fue el de «te toca».
 *
 * El candidato **escribe primero**: el botón guarda su consentimiento, le anuncia al
 * bot que ese número va a escribir y abre el chat con un mensaje ya escrito. El bot
 * lo reconoce solo por el número, así que puede cambiar el mensaje o borrarlo.
 *
 * Los estados vienen del backend (`whatsapp.estado`):
 *
 *   SIN_CELULAR   la cuenta es anterior y no tiene celular: se pide aquí mismo.
 *   SIN_VINCULAR  nunca pulsó, o el anuncio caducó, o cambió de celular.
 *   REVOCADO      dejó de recibir: se le vuelve a ofrecer, como al principio.
 *   PENDIENTE     pulsó y todavía no escribió: «Aún no recibimos tu mensaje».
 *   ACTIVO        ya escribió: conectado, con el número enmascarado.
 *   SUPRIMIDO     escribió BAJA al bot: no se vuelve a ofrecer.
 *
 * ⚠️ **La pestaña se abre ANTES del `await`.** Después, el navegador ya no la cuenta
 * como parte del clic y la bloquea —Safari siempre—, y bloqueada devuelve `null` sin
 * lanzar. Se pide en blanco y se lleva al chat cuando el enlace está listo; si el
 * navegador no la dio, el enlace queda a la vista para pulsarlo. En la aplicación
 * de Android no hay pestañas: se navega y el sistema se lo da a WhatsApp.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '@/api/cliente'
import { esLaAplicacion } from '@/api/almacenNativo'
import { cambiarCelular, dejarDeRecibirPorWhatsapp, escribirPorWhatsapp } from '@/api/portal'
import type { MiPostulacion, WhatsappDelProceso } from '@/api/tipos'
import { comoE164, MENSAJE_CELULAR } from '@/dominio/celular'
import { rutas } from '@/rutas'
import { Campo } from '@/ui/campos/Campo'
import { IconoWhatsapp } from '@/ui/Iconos'
import estilos from './TarjetaWhatsapp.module.css'

/** Lo que firma al pulsar. Es el texto WHATSAPP 1.0 del backend, palabra por palabra. */
export const CONSENTIMIENTO_WHATSAPP =
  'Al escribirnos aceptas recibir por WhatsApp las novedades de este proceso. Puedes dejarlo cuando quieras.'

const NO_SE_PUDO = 'No pudimos preparar el enlace. Inténtalo de nuevo.'

interface Props {
  postulacion: Pick<MiPostulacion, 'uuid' | 'whatsapp'>
  /**
   * El nivel de su título, según dónde caiga: en «Mis procesos» cuelga del nombre de la
   * vacante (h2) y en el detalle, del título del momento (h3).
   */
  nivelDelTitulo?: 3 | 4
  /**
   * Al pie de la acción, cuando al candidato le toca algo: solo si ya está conectado, y
   * en una línea. Sin conexión no pinta nada —ni el botón verde, que le competiría a la
   * acción— y, tras «Dejar de recibir», lo confirma en la misma línea.
   */
  compacta?: boolean
}

/** Si la tarjeta se pinta: solo con la beta, en una vacante de RENASER y con un estado que contar. */
export function hayTarjetaDeWhatsapp(postulacion: Pick<MiPostulacion, 'whatsapp'>): boolean {
  return Boolean(postulacion.whatsapp?.disponible && postulacion.whatsapp.estado)
}

export function TarjetaWhatsapp({ postulacion, nivelDelTitulo = 4, compacta = false }: Props) {
  const cache = useQueryClient()
  /*
    Lo que contestó el backend al pulsar manda sobre lo que trajo la lista, pero solo
    mientras la lista siga trayendo lo mismo que había entonces. En cuanto llega otra
    cosa —la caché de TanStack conserva la misma referencia si nada cambió—, manda la
    lista: así «Aún no recibimos tu mensaje» pasa a «Conectado» al volver de WhatsApp.
  */
  const [propia, setPropia] = useState<{
    sobre: WhatsappDelProceso | null | undefined
    valor: WhatsappDelProceso
  } | null>(null)
  const tarjeta =
    propia && propia.sobre === postulacion.whatsapp ? propia.valor : postulacion.whatsapp
  const quedarseCon = (valor: WhatsappDelProceso) =>
    setPropia({ sobre: postulacion.whatsapp, valor })
  const [preparando, setPreparando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [celular, setCelular] = useState('')
  const [errorCelular, setErrorCelular] = useState<string | null>(null)
  const [enlaceSinAbrir, setEnlaceSinAbrir] = useState<string | null>(null)
  // Solo lo lee la línea compacta: tras dejarlo, la lista trae REVOCADO y sin esto la
  // línea se iría sin decir nada.
  const [dejado, setDejado] = useState(false)
  const estado = tarjeta?.estado

  /*
    Pendiente: al volver a esta pestaña —lo normal después de escribir en WhatsApp— se
    pregunta otra vez, para que el «Conectado» salga sin tener que recargar.
  */
  useEffect(() => {
    if (estado !== 'PENDIENTE') return undefined
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        void cache.invalidateQueries({ queryKey: ['postulaciones'] })
        void cache.invalidateQueries({ queryKey: ['postulacion', postulacion.uuid] })
      }
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [estado, cache, postulacion.uuid])

  if (!tarjeta?.disponible || !tarjeta.estado) return null

  async function refrescar() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['postulaciones'] }),
      cache.invalidateQueries({ queryKey: ['postulacion', postulacion.uuid] }),
    ])
  }

  /** Lleva al chat: la pestaña ya pedida, la aplicación, o el enlace a la vista. */
  function abrir(enlace: string, pestana: Window | null) {
    if (esLaAplicacion()) {
      window.location.href = enlace
      return
    }
    if (pestana) {
      pestana.opener = null
      pestana.location.href = enlace
      return
    }
    setEnlaceSinAbrir(enlace)
  }

  async function escribir(evento?: FormEvent) {
    evento?.preventDefault()
    setFallo(null)
    setEnlaceSinAbrir(null)

    // Sin celular en la cuenta: primero se comprueba lo escrito, sin abrir nada.
    const pideCelular = tarjeta?.estado === 'SIN_CELULAR'
    if (pideCelular) {
      if (!celular.trim()) {
        setErrorCelular('Escribe tu celular.')
        return
      }
      if (comoE164(celular) === null) {
        setErrorCelular(MENSAJE_CELULAR)
        return
      }
      setErrorCelular(null)
    }

    const pestana = esLaAplicacion() ? null : window.open('', '_blank')
    setPreparando(true)
    try {
      if (pideCelular) {
        await cambiarCelular(celular)
        await cache.invalidateQueries({ queryKey: ['mi-celular'] })
      }
      const respuesta = await escribirPorWhatsapp(postulacion.uuid)
      abrir(respuesta.enlace, pestana)
      quedarseCon(respuesta.whatsapp)
      void refrescar()
    } catch (causa) {
      pestana?.close()
      const codigo =
        causa instanceof ErrorApi && typeof causa.cuerpo === 'object' && causa.cuerpo !== null
          ? (causa.cuerpo as { codigo?: string }).codigo
          : undefined
      if (pideCelular && causa instanceof ErrorApi && causa.estado === 400) {
        // El celular no pasó en el servidor: el error va junto al campo.
        setErrorCelular(causa.message || MENSAJE_CELULAR)
      } else if (codigo) {
        // El servidor sabe algo que la lista no: se vuelve a pedir y la tarjeta cambia sola.
        setFallo(NO_SE_PUDO)
        void refrescar()
      } else {
        setFallo(NO_SE_PUDO)
      }
    } finally {
      setPreparando(false)
    }
  }

  async function dejarDeRecibir() {
    setFallo(null)
    setPreparando(true)
    try {
      quedarseCon(await dejarDeRecibirPorWhatsapp(postulacion.uuid))
      setDejado(true)
      void refrescar()
    } catch {
      setFallo('No pudimos dejar de enviarte novedades. Inténtalo de nuevo.')
    } finally {
      setPreparando(false)
    }
  }

  const fallos = (
    <>
      {fallo && (
        <p className={estilos.fallo} role="alert">
          {fallo}
        </p>
      )}
      {enlaceSinAbrir && (
        <p className={estilos.texto}>
          Tu navegador no abrió WhatsApp.{' '}
          <a href={enlaceSinAbrir} target="_blank" rel="noreferrer">
            Ábrelo desde aquí
          </a>
          .
        </p>
      )}
    </>
  )

  if (compacta) {
    if (dejado && tarjeta.estado !== 'ACTIVO') {
      return (
        <section className={estilos.compacta} aria-label="Novedades por WhatsApp">
          <p className={estilos.hecho} role="status">
            Listo: ya no recibirás por WhatsApp las novedades de este proceso.
          </p>
        </section>
      )
    }
    if (tarjeta.estado !== 'ACTIVO') return null
    return (
      <section className={estilos.compacta} aria-label="Novedades por WhatsApp">
        <p className={estilos.conectadoCompacto}>
          <IconoWhatsapp tamano={16} className={estilos.iconoCompacto} />
          <span>
            Conectado por WhatsApp (<span className={estilos.numero}>{tarjeta.numero}</span>).
          </span>
        </p>
        <button
          type="button"
          className={estilos.dejar}
          onClick={() => void dejarDeRecibir()}
          disabled={preparando}
        >
          Dejar de recibir
        </button>
        {fallos}
      </section>
    )
  }

  if (tarjeta.estado === 'SUPRIMIDO') {
    return (
      <section className={estilos.tarjeta} aria-label="Novedades por WhatsApp">
        <p className={estilos.texto}>Este número se dio de baja de nuestros mensajes</p>
      </section>
    )
  }

  if (tarjeta.estado === 'ACTIVO') {
    return (
      <section className={estilos.tarjeta} aria-label="Novedades por WhatsApp">
        <p className={estilos.conectado}>
          <IconoWhatsapp tamano={18} className={estilos.iconoConectado} />
          <span>
            <b>
              Conectado por WhatsApp (<span className={estilos.numero}>{tarjeta.numero}</span>).
            </b>{' '}
            Escríbenos cuando quieras para saber cómo va tu proceso.
          </span>
        </p>
        <button
          type="button"
          className={estilos.dejar}
          onClick={() => void dejarDeRecibir()}
          disabled={preparando}
        >
          Dejar de recibir
        </button>
        {fallos}
      </section>
    )
  }

  const Titulo = nivelDelTitulo === 3 ? 'h3' : 'h4'
  const pendiente = tarjeta.estado === 'PENDIENTE'
  const sinCelular = tarjeta.estado === 'SIN_CELULAR'
  const rotulo = sinCelular ? 'Guardar y escribir por WhatsApp' : 'Escribir por WhatsApp'

  return (
    <section className={estilos.tarjeta} aria-labelledby={`whatsapp-${postulacion.uuid}`}>
      <Titulo className={estilos.titulo} id={`whatsapp-${postulacion.uuid}`}>
        Recibe tus novedades por WhatsApp
      </Titulo>

      {pendiente ? (
        <p className={estilos.texto}>
          Aún no recibimos tu mensaje. Escríbenos desde el{' '}
          <b className={estilos.numero}>{tarjeta.numero}</b>, el celular de tu cuenta.
        </p>
      ) : sinCelular ? (
        <p className={estilos.texto}>
          Déjanos tu celular y escríbenos desde él: te contaremos cómo va tu proceso.
        </p>
      ) : (
        <p className={estilos.texto}>
          Escríbenos desde tu celular <b className={estilos.numero}>{tarjeta.numero}</b> y te
          contaremos cómo va tu proceso.
        </p>
      )}

      <form className={estilos.formulario} onSubmit={(e) => void escribir(e)} noValidate>
        {sinCelular && (
          <div className={estilos.campo}>
            <Campo
              etiqueta="Tu celular (WhatsApp)"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              prefijo="+51"
              placeholder="987 654 321"
              value={celular}
              onChange={(e) => {
                setCelular(e.target.value)
                setErrorCelular(null)
              }}
              error={errorCelular ?? undefined}
            />
          </div>
        )}

        <div className={estilos.acciones}>
          <button
            type="submit"
            className={estilos.escribir}
            disabled={preparando}
            aria-busy={preparando || undefined}
          >
            <IconoWhatsapp tamano={18} />
            {preparando ? 'Preparando el enlace…' : rotulo}
          </button>
          {!sinCelular && (
            <span className={estilos.otroNumero}>
              {pendiente ? '¿Usas otro número?' : '¿No es tu número?'}{' '}
              <Link to={rutas.celularDeLaCuenta()}>Cámbialo en Mi cuenta</Link>.
            </span>
          )}
        </div>
      </form>

      {fallos}

      {!pendiente && <p className={estilos.consentimiento}>{CONSENTIMIENTO_WHATSAPP}</p>}
    </section>
  )
}
