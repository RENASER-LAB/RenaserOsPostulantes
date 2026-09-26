import { expect, test } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'

/**
 * Lo que YA existía del portal y no puede haberse roto.
 *
 * Lo del alta con ciudad que aquí había —el catálogo agrupado, el rechazo sin
 * ciudad, el alta entera, «Fuera del Perú», el teclado— vive entero en
 * `24-ciudad-obligatoria`, con cuentas que se limpian al terminar (las de aquí
 * se quedaban en la base). Y que el tablón abra sin sesión lo miran `12-postular`
 * y `23-movimiento`.
 */
test.describe('Regresión · el portal del candidato', () => {
  test('entra, ve «Mis procesos» y abre el detalle de una postulación', async ({ page }) => {
    await entrarAlPortal(page, 'camila.torres@ejemplo.pe')
    await page.goto('/procesos')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main')).toContainText(/Desarrollador web/i)

    /*
      El uuid se PREGUNTA, no se fija: cambia en cada siembra, y una prueba que
      lo lleva escrito solo pasa contra la base con la que se escribió.
    */
    const sesion = await fetch(`${API}/portal/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'camila.torres@ejemplo.pe', contrasena: 'Demo12345!' }),
    }).then((r) => r.json())
    const suyas = await fetch(`${API}/portal/postulaciones`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    }).then((r) => r.json())
    expect(suyas.length).toBeGreaterThan(0)
    await page.goto(`/procesos/${suyas[0].uuid}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main')).toContainText(/Desarrollador web/i)
  })
})
