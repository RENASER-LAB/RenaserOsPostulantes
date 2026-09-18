import { expect, test as base, type Page } from '@playwright/test'
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
 */
export async function crearCuentaDeCandidato(datos: {
  nombre: string
  apellidos: string
  correo: string
  contrasena?: string
}): Promise<void> {
  const r = await fetch(`${API}/portal/cuentas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      correo: datos.correo,
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
 * `test` con un vigilante puesto: un error de JavaScript en la página hace
 * fallar la prueba aunque todas las comprobaciones hayan pasado.
 *
 * Los arneses viejos lo llevaban todos —`pagina.on('pageerror')` y salir con
 * 1 si había alguno— y es la única red que atrapa un fallo de render que la
 * pantalla disimula.
 */
export const test = base.extend<{ sinErroresDeJavaScript: void }>({
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
