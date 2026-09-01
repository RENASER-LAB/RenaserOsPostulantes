import { expect } from '@playwright/test'
import { API, tokenDelPanel } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, test } from './ayuda-candidato'

/**
 * Entrar al panel de punta a punta: invitación, canje y login.
 *
 * Es el bucle completo, que es lo único que demuestra que las cuentas del
 * panel funcionan: alguien que ya está dentro invita a un correo nuevo; el
 * invitado abre el enlace, pone su nombre y una contraseña, **y entra**; sale, y
 * vuelve a entrar con ese correo y esa contraseña; una contraseña equivocada da
 * un error genérico; y el enlace ya usado no vale una segunda vez.
 *
 * El token de quien invita se saca por el `dev-login`, que el backend mantiene
 * para local. Del canje en adelante todo va por las rutas de verdad.
 *
 * ⚠️ **ESCRIBE**: crea una invitación y una cuenta de equipo, con correo
 * `e2e.equipo.<instante>@example.com`, y las borra al terminar.
 *
 * Los pasos van en serie porque cada uno deja al siguiente donde lo necesita:
 * sin el canje no hay cuenta con la que fallar el login, y sin el canje el
 * enlace todavía no está gastado.
 */
test.describe.configure({ mode: 'serial' })

const CORREO = correoDePrueba('e2e.equipo')
// Doce como mínimo: el panel exige más que el portal porque ve datos ajenos.
const CLAVE = 'unaClaveLargaDePanel2026'

let tokenDeLaInvitacion = ''
/** La ruta tal cual la arma el backend, que puede no llevar el `/admin`. */
let rutaDelCorreo = ''

test.describe('Regresión · entrar al panel: invitación, canje y login', () => {
  test.beforeAll(async () => {
    const token = await tokenDelPanel()
    const conToken = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const roles = (await (await fetch(`${API}/panel/roles`, { headers: conToken })).json()) as {
      codigo: string
    }[]
    const rol = roles.find((r) => r.codigo === 'TALENTO') ?? roles[0]
    // Sin ningún rol no hay invitación que probar, y que reviente aquí con un
    // motivo vale más que un `undefined.codigo` tres líneas más abajo.
    if (!rol) throw new Error('El catálogo de roles llegó vacío: sin rol no se puede invitar a nadie')

    const invitacion = await fetch(`${API}/panel/usuarios/invitaciones`, {
      method: 'POST',
      headers: conToken,
      body: JSON.stringify({ correo: CORREO, roles: [rol.codigo] }),
    })
    if (!invitacion.ok) {
      throw new Error(`No se pudo crear la invitación (${invitacion.status}): ${await invitacion.text()}`)
    }
    const { url } = (await invitacion.json()) as { url: string }

    /*
      El backend arma el enlace con `renaser.panel.url`, que puede no llevar el
      `/admin`. Se conserva el token y se deja que el portal resuelva la
      dirección: eso es justo lo que la ruta suelta de `/invitacion` tiene que
      arreglar.
    */
    tokenDeLaInvitacion = new URL(url).searchParams.get('token') ?? ''
    rutaDelCorreo = new URL(url).pathname
    expect(tokenDeLaInvitacion, 'el enlace de la invitación lleva su token').not.toBe('')
  })

  test.afterAll(() => {
    try {
      borrarCuentasDePrueba('e2e.equipo')
    } catch (causa) {
      console.warn(`[10-panel-entrar] No se pudo borrar la cuenta ${CORREO}: ${String(causa).split('\n')[0]}`)
    }
  })

  const enlaceDelCorreo = () => `${rutaDelCorreo}?token=${encodeURIComponent(tokenDeLaInvitacion)}`

  test('el enlace del correo, tal cual lo arma el backend, llega a la pantalla de crear el acceso', async ({
    page,
  }) => {
    await page.goto(enlaceDelCorreo())
    await expect(page.getByRole('heading', { name: /crea tu acceso/i })).toBeVisible({ timeout: 15_000 })
  })

  test('una contraseña de menos de 12 se para en la pantalla, no en el servidor', async ({ page }) => {
    const peticiones: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/panel/auth/invitacion') && r.method() === 'POST') peticiones.push(r.url())
    })

    await page.goto(enlaceDelCorreo())
    await page.getByLabel('Nombre', { exact: true }).fill('Equipo')
    await page.getByLabel('Apellidos').fill('De Prueba')
    await page.getByLabel('Contraseña', { exact: true }).fill('corta123')
    await page.getByLabel('Repite la contraseña').fill('corta123')
    await page.getByRole('button', { name: /crear mi acceso/i }).click()

    await expect(page.getByText(/al menos 12 caracteres/i).first()).toBeVisible()
    expect(peticiones, 'el canje no llegó a salir hacia el servidor').toEqual([])
  })

  test('la invitación se canjea y entra directo al panel; salir devuelve a la entrada', async ({ page }) => {
    await page.goto(enlaceDelCorreo())
    await page.getByLabel('Nombre', { exact: true }).fill('Equipo')
    await page.getByLabel('Apellidos').fill('De Prueba')
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
    await page.getByLabel('Repite la contraseña').fill(CLAVE)
    await page.getByRole('button', { name: /crear mi acceso/i }).click()
    // Sin pasar por la pantalla de entrar: el canje ya abre la sesión.
    await expect(page).toHaveURL(/\/admin$/, { timeout: 25_000 })
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()

    await page.getByRole('button', { name: /cerrar sesión|salir/i }).first().click()
    await expect(page).toHaveURL(/\/admin\/entrar/, { timeout: 15_000 })
  })

  test('una contraseña equivocada da un error genérico, que no dice si el correo existe', async ({ page }) => {
    await page.goto('/admin/entrar')
    await page.getByLabel('Correo').fill(CORREO)
    await page.getByLabel('Contraseña', { exact: true }).fill('estaNoEsLaBuena123')
    await page.getByRole('button', { name: /entrar al panel/i }).click()

    const error = page.getByRole('alert').first()
    await expect(error).toBeVisible()
    // Un error que repite el correo le dice a quien prueba enlaces cuál existe.
    await expect(error).not.toContainText(CORREO, { ignoreCase: true })
    await expect(page).toHaveURL(/\/admin\/entrar/)
  })

  test('entra con correo y contraseña, sin RENASER OS', async ({ page }) => {
    await page.goto('/admin/entrar')
    await page.getByLabel('Correo').fill(CORREO)
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
    await page.getByRole('button', { name: /entrar al panel/i }).click()
    await expect(page).toHaveURL(/\/admin$/, { timeout: 25_000 })
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  })

  test('el enlace ya usado no vale una segunda vez', async ({ page }) => {
    await page.goto(`/admin/invitacion?token=${encodeURIComponent(tokenDeLaInvitacion)}`)
    await page.getByLabel('Nombre', { exact: true }).fill('Otra')
    await page.getByLabel('Apellidos').fill('Persona')
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
    await page.getByLabel('Repite la contraseña').fill(CLAVE)
    await page.getByRole('button', { name: /crear mi acceso/i }).click()

    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 15_000 })
    // Y no entró: sigue en la pantalla de la invitación.
    await expect(page).toHaveURL(/\/admin\/invitacion/)
  })
})
