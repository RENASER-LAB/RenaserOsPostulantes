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
 * **La contraseña olvidada** tiene su enlace dentro del formulario, pegado al
 * campo: lleva a `/admin/clave`, que manda por correo un enlace de un solo uso a
 * `/admin/restablecer`. Al volver de allí con la contraseña cambiada, esta
 * pantalla enseña el aviso encima (`AvisoClaveCambiada`).
 *
 * ⚠️ **Aquí hubo un bloque «¿No puedes entrar?» y se fue el 25/09/2026.**
 * Explicaba lo mismo que el enlace de arriba y añadía que las cuentas nacen por
 * invitación. Se quitó por petición: la pantalla es una tarjeta centrada, y dos
 * párrafos debajo la descolgaban de su sitio para decir algo que quien trabaja
 * en el panel ya sabe. Lo de «si el correo no llega» sigue vivo donde hace
 * falta, en `/admin/clave`, que es la pantalla a la que se llega buscándolo.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ErrorApi } from '@/panel/api/cliente'
import { rutas } from '@/rutas'
import { IconoAviso } from '@/ui/Iconos'
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
    <div className={estilos.paginaEntrar}>
      {/*
        Todo lo que se rellena, dentro de la tarjeta, como en `/ingresar`: aquí la
        pantalla es el formulario, y la superficie es lo que le da principio y fin.
        Abajo solo queda la puerta de desarrollo, que no es la tarea.

        ⚠️ **Sin bajada bajo el titular, y se quitó el 25/09/2026 por petición.**
        Explicaba qué se gestiona en el panel y que no es la entrada de quien
        postula. Quien llega aquí trabaja en el panel y ya lo sabe; quien llegó
        por error lo descubre antes por el titular que por tres líneas de prosa.
      */}
      <div className={estilos.tarjeta}>
        <h1 className={estilos.titularEntrar}>Panel de Empresa.</h1>

        <AvisoClaveCambiada />

        {/*
          El error va ARRIBA del formulario y no pegado al botón: el servidor no
          dice cuál de los dos campos falla, así que no puede colgar de ninguno, y
          al pie solo se ve después de haber vuelto a mirar el formulario entero.
        */}
        {fallo && (
          <p className={estilos.falloEntrar} role="alert">
            <IconoAviso tamano={18} />
            {fallo}
          </p>
        )}

        <form className={estilos.formularioEntrar} onSubmit={alEnviar} noValidate>
          <Campo
            etiqueta="Correo"
            type="email"
            autoComplete="username"
            value={valores.correo}
            onChange={(e) => cambiar('correo', e.target.value)}
            error={errores.correo}
          />

          {/*
            El campo de la contraseña y su salida son UN grupo: el hueco del
            formulario separa campos, y entre un campo y su nota tiene que ser más
            corto o la nota parece pertenecer a lo de abajo.

            ⚠️ **El rótulo es la frase entera y no «Restablecer» como en el
            portal.** Aquí no hay texto alrededor que dé contexto, y dos pruebas
            —el unitario de `RecuperarClavePanel` y el escenario 2 de
            `33-recuperar-contrasena`— buscan el enlace por ese nombre exacto.
          */}
          <div className={estilos.grupoClave}>
            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={valores.contrasena}
              onChange={(e) => cambiar('contrasena', e.target.value)}
              error={errores.contrasena}
            />
            <p className={estilos.olvidadaEntrar}>
              <Link to={rutas.adminClave()}>¿Olvidaste tu contraseña?</Link>
            </p>
          </div>

          <button className={estilos.enviarEntrar} type="submit" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar al panel'}
          </button>
        </form>
      </div>

      {/*
        La salida de desarrollo, al final y plegada: en una base local recién
        levantada puede no haber ninguna cuenta con contraseña, y entonces esto
        es lo único que abre el panel.

        ⚠️ **Solo existe en local, y no por estar escondida: no llega a
        compilarse.** Las dos son constantes que Vite sustituye al construir, así
        que en el paquete de producción este bloque entero desaparece en el
        sacudido de árbol —ni el `<details>`, ni el manejador, ni el texto del
        campo—. Comprobado: `npm run build` y `grep` en `dist/` no encuentran
        nada. Esconderlo con CSS o con una bandera de tiempo de ejecución habría
        dejado en producción una puerta que el backend ya apaga, pero que
        cualquiera podía ver y probar.

        ⚠️ **`DEV` solo no basta, y por eso está la bandera.** Dos cosas la abren
        desde la interfaz: `herramientas/verificar-panel.mjs:34` y el escenario de
        regresión `13-etapas.spec.ts:100`. La primera apunta al servidor de
        desarrollo y le vale `DEV`; la segunda depende de cómo se haya levantado
        el portal, y `playwright.config.ts:5` habla de un **preview**, que es un
        paquete construido y ahí `DEV` es falso. Quien corra los e2e contra un
        preview tiene que construirlo con `VITE_PUERTA_DESARROLLO=1`. Vercel no
        define esa variable, así que en producción sigue sin existir. El resto de
        escenarios no la tocan: llaman a `/panel/auth/dev-login` por HTTP.
      */}
      {(import.meta.env.DEV || import.meta.env.VITE_PUERTA_DESARROLLO === '1') && (
        <details className={estilos.desarrollo}>
          <summary className={estilos.resumenDesarrollo}>
            Entrar con un id de desarrollo
          </summary>
          <form
            className={estilos.formularioDesarrollo}
            onSubmit={alEntrarComoDesarrollo}
            noValidate
          >
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
      )}
    </div>
  )
}
