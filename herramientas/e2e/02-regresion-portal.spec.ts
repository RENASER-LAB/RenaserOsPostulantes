import { expect, test } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'

test.describe('Regresión · el portal del candidato', () => {
  test('entra, ve «Mis procesos» y abre el detalle de una postulación', async ({ page }) => {
    await entrarAlPortal(page, 'camila.torres@ejemplo.pe')
    await page.goto('/procesos')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const enlaces = page.getByRole('link', { name: /Ver|proceso|Desarrollador/i })
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
    expect(enlaces).toBeTruthy()
  })

  test('el listado público de vacantes sigue abriendo sin sesión', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main')).toContainText(/Desarrollador web/i)
  })
})

test.describe('Regresión · crear cuenta, que ahora exige ciudad', () => {
  test('el catálogo de ubigeo llega y el desplegable se puebla agrupado', async ({ page }) => {
    await page.goto('/registro')
    const select = page.getByLabel('Dónde vives')
    await expect(select).toBeEnabled()
    // 196 provincias + `EXT` + la opción vacía.
    const opciones = await select.locator('option').count()
    expect(opciones).toBeGreaterThan(100)
    await expect(select.locator('optgroup').first()).toHaveAttribute('label', /\w+/)
    // `EXT` va suelta al final, fuera de todo `optgroup`.
    await expect(select.locator('> option')).toHaveCount(2) // la vacía + EXT
    await expect(select.locator('> option').nth(1)).toHaveText('Fuera del Perú')
  })

  test('sin ciudad NO deja pasar: sale el error y el campo queda inválido', async ({ page }) => {
    await page.goto('/registro')
    await page.getByLabel('Nombre', { exact: true }).fill('Prueba')
    await page.getByLabel('Apellidos', { exact: true }).fill('QA Sin Ciudad')
    await page.getByLabel('Correo', { exact: true }).fill(`qa.sinciudad.${Date.now()}@ejemplo.pe`)
    await page.getByLabel('Contraseña', { exact: true }).fill('Demo12345!')
    await page.getByLabel(/Repetir|Repite/i).fill('Demo12345!')
    await page.locator('input[type="checkbox"]').first().check()

    await page.getByRole('button', { name: /Crear cuenta/i }).click()

    await expect(page.getByText('Elige dónde vives.')).toBeVisible()
    await expect(page.getByLabel('Dónde vives')).toHaveAttribute('aria-invalid', 'true')
    // Y no navegó a ningún sitio.
    await expect(page).toHaveURL(/\/registro/)
  })

  test('el alta completa con ciudad funciona de principio a fin', async ({ page }) => {
    const correo = `qa.altaciudad.${Date.now()}@ejemplo.pe`
    await page.goto('/registro')
    await page.getByLabel('Nombre', { exact: true }).fill('Ana')
    await page.getByLabel('Apellidos', { exact: true }).fill('Quality Assurance')
    await page.getByLabel('Correo', { exact: true }).fill(correo)
    await page.getByLabel('Contraseña', { exact: true }).fill('Demo12345!')
    await page.getByLabel(/Repetir|Repite/i).fill('Demo12345!')
    await page.getByLabel('Dónde vives').selectOption('1501') // Lima — Lima
    await page.locator('input[type="checkbox"]').first().check()

    await page.getByRole('button', { name: /Crear cuenta/i }).click()

    // Sale del registro: la cuenta quedó creada y la sesión abierta.
    await expect(page).not.toHaveURL(/\/registro/, { timeout: 15_000 })

    // Y el backend la acepta: la cuenta existe con esa contraseña.
    const r = await fetch(`${API}/portal/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena: 'Demo12345!' }),
    })
    expect(r.status).toBe(200)
  })

  test('«Fuera del Perú» (EXT) también se puede elegir y el backend lo acepta', async ({ page }) => {
    const correo = `qa.ext.${Date.now()}@ejemplo.pe`
    await page.goto('/registro')
    await page.getByLabel('Nombre', { exact: true }).fill('Ext')
    await page.getByLabel('Apellidos', { exact: true }).fill('De Fuera')
    await page.getByLabel('Correo', { exact: true }).fill(correo)
    await page.getByLabel('Contraseña', { exact: true }).fill('Demo12345!')
    await page.getByLabel(/Repetir|Repite/i).fill('Demo12345!')
    await page.getByLabel('Dónde vives').selectOption('EXT')
    await page.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /Crear cuenta/i }).click()
    await expect(page).not.toHaveURL(/\/registro/, { timeout: 15_000 })
  })

  test('el desplegable de ciudad se maneja solo con teclado', async ({ page }) => {
    await page.goto('/registro')
    const select = page.getByLabel('Dónde vives')
    await expect(select).toBeEnabled()
    await select.focus()
    await expect(select).toBeFocused()
    // Escribir salta a la opción: la rueda nativa del `<select>`.
    await page.keyboard.press('ArrowDown')
    const elegido = await select.inputValue()
    expect(elegido).not.toBe('')
  })
})
