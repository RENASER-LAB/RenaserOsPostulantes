import { expect, test as base, type BrowserContext, type Page } from '@playwright/test'
export { borrarCuentasDePrueba } from './limpieza-cuentas'
export { correoDePrueba, sql } from './base-de-datos'
import { API } from './ayuda'

/** Las cuentas se identifican por sus correos únicos completos, nunca por prefijo. */

/** La contraseña del portal del candidato: ocho como mínimo. */
export const CLAVE_DE_CANDIDATO = 'unaClaveDePrueba123'

/**
 * La cuenta se crea por la API cuando lo que se prueba no es el alta.
 *
 * Lleva ciudad porque el backend la exige desde que el registro la pide: sin
 * `ciudadUbigeo` el alta rebota con 400 aunque la pantalla del perfil no la use.
 *
 * Y celular desde la V73, por lo mismo: el alta lo exige. Desde la V92 un celular es de una
 * sola cuenta (409 TELEFONO_EN_USO), así que por defecto cada cuenta lleva uno peruano nuevo
 * (`celularUnico`); quien prueba WhatsApp pasa el suyo para mirar solo lo de su número en el
 * registro del bot falso.
 */
export const CELULAR_DE_PRUEBA = '987 654 321'

/**
 * Un celular peruano que no se repite: «96» y siete cifras al azar. No choca con los que fijan
 * las pruebas a mano (98…, 91…) y, como la base de QA guarda las cuentas de corridas
 * anteriores, el azar evita que dos corridas den el mismo.
 */
export function celularUnico(): string {
  const cifras = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')
  return `96${cifras.slice(0, 1)} ${cifras.slice(1, 4)} ${cifras.slice(4)}`
}

export async function crearCuentaDeCandidato(datos: {
  nombre: string
  apellidos: string
  correo: string
  contrasena?: string
  telefono?: string
}): Promise<void> {
  const r = await fetch(`${API}/portal/cuentas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      correo: datos.correo,
      telefono: datos.telefono ?? celularUnico(),
      contrasena: datos.contrasena ?? CLAVE_DE_CANDIDATO,
      ciudadUbigeo: '1501', // Lima — Lima
      aceptaPlataforma: true,
      aceptaFuturosContactos: false,
    }),
  })
  if (!r.ok) throw new Error(`No se pudo crear la cuenta ${datos.correo} (${r.status}): ${await r.text()}`)
}

/** El token de sesión del candidato, para pedir cosas a la API con su nombre. */
export async function tokenDelCandidato(correo: string, contrasena = CLAVE_DE_CANDIDATO): Promise<string> {
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })
  if (!r.ok) throw new Error(`login portal falló: ${r.status} ${await r.text()}`)
  return (await r.json()).token
}

/**
 * La guía de los avisos (V93, 25/11/2026) sale a pantalla completa la primera vez que una
 * cuenta entra en «Mis procesos» con alguna postulación, y lo de debajo queda inerte. Las
 * pruebas que no son de la guía la SALTAN de forma explícita: en este contexto el portal oye
 * `guiaVista: true` en todo lo que devuelve `/notificaciones` (también dentro de lo que
 * contesta activar WhatsApp), así que nunca la pide. La base no se toca: la cuenta sigue con
 * la guía sin ver, y lo demás de la respuesta llega tal cual del backend.
 *
 * El `test` de aquí lo hace solo en el contexto de cada prueba (`guiaDeAvisos: false`, por
 * defecto); las de la guía lo apagan con `test.use({ guiaDeAvisos: true })`. Un contexto o
 * una página que la prueba abra por su cuenta (`browser.newPage()`) lo necesita a mano.
 */
export async function saltarLaGuiaDeAvisos(destino: BrowserContext | Page): Promise<void> {
  await destino.route(
    (url) => url.pathname.endsWith('/api/v1/portal/notificaciones') || url.pathname.includes('/api/v1/portal/notificaciones/'),
    async (ruta) => {
      let respuesta: Awaited<ReturnType<typeof ruta.fetch>>
      try {
        respuesta = await ruta.fetch()
      } catch {
        /*
          La prueba terminó con la petición en vuelo («route.fetch: Test ended», el contexto ya
          cerrado) o la red falló. Lo primero no es un fallo de la prueba; lo segundo la página
          lo ve igual, como una petición caída. Nunca se deja pasar tal cual: llegaría sin
          `guiaVista` y la guía saldría encima.
        */
        await ruta.abort('failed').catch(() => undefined)
        return
      }
      let cuerpo: unknown
      try {
        cuerpo = await respuesta.json()
      } catch {
        // Un 204 (mensaje visto, guía vista) o un error sin JSON: tal cual.
        await ruta.fulfill({ response: respuesta }).catch(() => undefined)
        return
      }
      if (cuerpo && typeof cuerpo === 'object') {
        const conGuia = cuerpo as { guiaVista?: boolean; notificaciones?: { guiaVista?: boolean } }
        if ('whatsapp' in conGuia) conGuia.guiaVista = true
        if (conGuia.notificaciones && typeof conGuia.notificaciones === 'object') conGuia.notificaciones.guiaVista = true
      }
      // Si la prueba acabó mientras se leía, ya no hay a quién contestar.
      await ruta.fulfill({ response: respuesta, json: cuerpo }).catch(() => undefined)
    },
  )
}

/**
 * `test` con un vigilante puesto: un error de JavaScript en la página hace
 * fallar la prueba aunque todas las comprobaciones hayan pasado.
 *
 * Los arneses viejos lo llevaban todos —`pagina.on('pageerror')` y salir con
 * 1 si había alguno— y es la única red que atrapa un fallo de render que la
 * pantalla disimula.
 *
 * Y la guía de los avisos saltada (ver `saltarLaGuiaDeAvisos`), salvo que la prueba
 * diga `test.use({ guiaDeAvisos: true })`.
 */
export const test = base.extend<{ sinErroresDeJavaScript: void; guiaDeAvisos: boolean }>({
  guiaDeAvisos: [false, { option: true }],
  // Sobre el contexto de siempre, y no como fixture automático: las pruebas que solo hablan
  // con la API no abren navegador por esto.
  context: async ({ context, guiaDeAvisos }, usar) => {
    if (!guiaDeAvisos) await saltarLaGuiaDeAvisos(context)
    await usar(context)
    // Lo que siga en vuelo al acabar no marca la prueba: es lo que propone Playwright.
    await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined)
  },
  sinErroresDeJavaScript: [
    async ({ page }, usar) => {
      const errores: string[] = []
      page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
      await usar()
      expect(errores, `Errores de JavaScript en la página:\n${errores.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})

/**
 * Espera a que un formulario del portal termine de guardar: el botón «Guardar»
 * desaparece cuando el servidor confirma, y no antes.
 */
export async function guardar(page: Page) {
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /^Guardar|^Guardando/ })).toHaveCount(0)
}
