/**
 * Entrar al panel del equipo.
 *
 * Correo y contraseña. RENASER OS quedó dormido y ahora entra así todo el
 * equipo, Renaser incluida.
 *
 * **No hay registro, y no es un olvido**: las cuentas del panel nacen solo por
 * invitación de alguien que ya está dentro. Una cuenta de equipo ve los datos
 * de mucha gente, así que no puede crearse sola.
 *
 * **La contraseña olvidada** tiene su enlace debajo del formulario: lleva a
 * `/admin/clave`, que manda por correo un enlace de un solo uso a
 * `/admin/restablecer`. Al volver de allí con la contraseña cambiada, esta
 * pantalla enseña el aviso encima (`AvisoClaveCambiada`). Lo que queda escrito
 * abajo es para cuando eso no basta: cuenta desactivada o correo que no llega.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ErrorApi } from '@/panel/api/cliente'
import { rutas } from '@/rutas'
import { Marca } from '@/ui/Marca'
import { Campo } from '@/ui/campos/Campo'
import { AvisoClaveCambiada } from '@/ui/recuperacion/AvisoClaveCambiada'
import { useSesionPanel } from '../Sesion'
import { useTituloDelPanel } from '../titulo'
import estilos from './Entrar.module.css'

const Datos = z.object({
  correo: z
    .string()
    .min(1, 'Escribe tu correo.')
    .email('Esto no parece un correo. Revisa que tenga arroba y dominio.'),
  contrasena: z.string().min(1, 'Escribe tu contraseña.'),
})

type Campos = z.infer<typeof Datos>
type Errores = Partial<Record<keyof Campos, string>>

const VACIO: Campos = { correo: '', contrasena: '' }

/**
 * Traduce el fallo del backend.
 *
 * Un 429 trae `segundosDeEspera` en el cuerpo: decir cuánto falta es la
 * diferencia entre esperar y volver a probar cada dos segundos.
 */
function leerFallo(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 429) {
    const cuerpo = causa.cuerpo as { segundosDeEspera?: number } | null
    const segundos = cuerpo?.segundosDeEspera
    if (typeof segundos === 'number' && segundos > 0) {
      const minutos = Math.ceil(segundos / 60)
      return minutos <= 1
        ? 'Demasiados intentos fallidos. Vuelve a probar en un minuto.'
        : `Demasiados intentos fallidos. Vuelve a probar en ${minutos} minutos.`
    }
    return 'Demasiados intentos fallidos. Espera un momento antes de volver a probar.'
  }
  // El 401 llega con su propio texto: genérico si las credenciales no cuadran
  // —igual exista o no el correo— y explicado si la empresa está suspendida.
  return causa instanceof Error ? causa.message : 'No pudimos entrar.'
}

export function EntrarPanel() {
  useTituloDelPanel('Entrar al panel')
  const { entrar, entrarConIdDeDesarrollo } = useSesionPanel()
  const navegar = useNavigate()
  const [valores, setValores] = useState<Campos>(VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [idDesarrollo, setIdDesarrollo] = useState('')

  function cambiar<C extends keyof Campos>(campo: C, valor: Campos[C]) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)

    const revision = Datos.safeParse(valores)
    if (!revision.success) {
      const nuevos: Errores = {}
      for (const problema of revision.error.issues) {
        const campo = problema.path[0] as keyof Campos
        nuevos[campo] ??= problema.message
      }
      setErrores(nuevos)
      // Sin el cuadro, el atributo todavia no esta en el DOM cuando se busca.
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    setEntrando(true)
    try {
      await entrar(revision.data)
      navegar(rutas.adminVacantes(), { replace: true })
    } catch (causa) {
      setFallo(leerFallo(causa))
    } finally {
      setEntrando(false)
    }
  }

  async function alEntrarComoDesarrollo(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    if (idDesarrollo.trim() === '') {
      // Antes salía en silencio: se pulsaba y no pasaba absolutamente nada.
      setFallo('Escribe el identificador de desarrollo.')
      return
    }
    setEntrando(true)
    try {
      await entrarConIdDeDesarrollo(idDesarrollo.trim())
      navegar(rutas.adminVacantes(), { replace: true })
    } catch (causa) {
      setFallo(leerFallo(causa))
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className={estilos.pagina}>
      <span className={estilos.marca}>
        <Marca />
      </span>
      <h1>Panel del equipo.</h1>
      <p className={estilos.bajada}>
        Aquí se gestionan las vacantes, las sesiones de simulación y la configuración del
        proceso. Es la entrada del equipo, no la de quien postula.
      </p>

      <AvisoClaveCambiada />

      <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
        <Campo
          etiqueta="Correo"
          type="email"
          autoComplete="username"
          value={valores.correo}
          onChange={(e) => cambiar('correo', e.target.value)}
          error={errores.correo}
        />

        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={valores.contrasena}
          onChange={(e) => cambiar('contrasena', e.target.value)}
          error={errores.contrasena}
        />

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}

        <button className={estilos.enviar} type="submit" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar al panel'}
        </button>
      </form>

      <p className={estilos.olvidada}>
        <Link to={rutas.adminClave()}>¿Olvidaste tu contraseña?</Link>
      </p>

      <section className={estilos.camino}>
        <h2 className={estilos.tituloCamino}>¿No puedes entrar?</h2>
        <p className={estilos.queEs}>
          Si olvidaste tu contraseña, pide un enlace para elegir una nueva. Si el correo no
          llega o tu cuenta está desactivada,{' '}
          <b>pídele a quien administra tu equipo que te invite de nuevo</b>: no pierdes nada
          de lo que ya estaba a tu nombre.
        </p>
        <p className={estilos.queEs}>
          Las cuentas del panel <b>solo se crean por invitación</b>. Si nunca has tenido
          una, pídesela a tu administrador.
        </p>
      </section>

      {/*
        La salida de desarrollo, al final y plegada: en una base local recién
        levantada puede no haber ninguna cuenta con contraseña, y entonces esto
        es lo único que abre el panel. El backend lo apaga en producción.
      */}
      <details className={estilos.desarrollo}>
        <summary className={estilos.resumenDesarrollo}>Entrar con un id de desarrollo</summary>
        <form className={estilos.formularioDesarrollo} onSubmit={alEntrarComoDesarrollo} noValidate>
          <Campo
            etiqueta="Identificador de RENASER OS"
            ayuda="Es texto, no un número. En la base local suele existir «andy-dev»."
            type="text"
            value={idDesarrollo}
            onChange={(e) => setIdDesarrollo(e.target.value)}
          />
          <button className={estilos.secundario} type="submit" disabled={entrando}>
            Entrar como desarrollo
          </button>
        </form>
      </details>
    </div>
  )
}
