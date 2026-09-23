import { expect } from '@playwright/test'

import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  test,
} from './ayuda-candidato'
import {
  crearCuentaDeEquipo,
  enlacesDe,
  enlacesEnTotal,
  entrarPorApi,
  esperarEnlace,
  holgarElTopePorIp,
  MENSAJE_ENVIADO,
  pedirPorApi,
  PLANTILLA_CANDIDATO,
  PLANTILLA_EQUIPO,
  tokenDe,
} from './ayuda-recuperacion'
import { literal, sql } from './base-de-datos'

/**
 * «Me olvidé mi contraseña», de punta a punta, en las dos puertas.
 *
 * Los cinco recorridos que la spec pide repetibles:
 *
 *   1. Candidato: pedir el enlace en `/clave`, leerlo de `correo_enviado`,
 *      elegir la contraseña, entrar con la nueva y fallar con la vieja.
 *   2. Equipo: lo mismo desde el login del panel, cayendo en `/admin/restablecer`.
 *   3. Un enlace usado dos veces, y uno vencido: la misma frase.
 *   4. Un correo sin cuenta: el mismo mensaje y ningún enlace nuevo.
 *   5. Bloqueado por cinco intentos fallidos, y libre al cambiar la contraseña.
 *
 * ⚠️ **ESCRIBE**: crea cuentas `e2e.recuperacion.<uuid>@example.com` —de
 * candidato y de equipo— y las borra al terminar; sus enlaces se van con ellas
 * (la clave ajena de `recuperacion_clave` borra en cascada). La auditoría de
 * cada solicitud y cada cambio se queda, sin usuario y sin token: no se puede
 * borrar, y no le estorba a la limpieza.
 */
test.describe.configure({ mode: 'serial' })

const CANDIDATA = correoDePrueba('e2e.recuperacion.candidata')
const BLOQUEADA = correoDePrueba('e2e.recuperacion.bloqueada')
const EQUIPO = correoDePrueba('e2e.recuperacion.equipo')
const SIN_CUENTA = correoDePrueba('e2e.recuperacion.nadie')

const CLAVE_NUEVA = 'unaClaveNueva2026'
const CLAVE_DE_EQUIPO = 'unaClaveLargaDePanel2026'
const CLAVE_NUEVA_DE_EQUIPO = 'otraClaveLargaDePanel2026'

let devolverElTope: () => void = () => {}

test.describe('Me olvidé mi contraseña', () => {
  test.beforeAll(async () => {
    devolverElTope = holgarElTopePorIp()
    await crearCuentaDeCandidato({ nombre: 'Rocío', apellidos: 'Recupera', correo: CANDIDATA })
    await crearCuentaDeCandidato({ nombre: 'Bruno', apellidos: 'Bloqueado', correo: BLOQUEADA })
    await crearCuentaDeEquipo(EQUIPO, CLAVE_DE_EQUIPO)
  })

  test.afterAll(() => {
    devolverElTope()
    borrarCuentasDePrueba([CANDIDATA, BLOQUEADA, EQUIPO])
  })

  test('1 · candidato: pide el enlace, elige la contraseña y entra con la nueva, no con la vieja', async ({
    page,
  }) => {
    await page.goto('/ingresar')
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(page).toHaveURL(/\/clave$/)
    await expect(page.getByText(/talento@renaser\.pe/)).toBeVisible()

    await page.getByLabel('Correo').fill(CANDIDATA)
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText(MENSAJE_ENVIADO)).toBeVisible()
    await expect(page.getByRole('button', { name: /reenviar enlace \(en \d+ s\)/i })).toBeDisabled()

    const enlace = await esperarEnlace(CANDIDATA, PLANTILLA_CANDIDATO)
    expect(enlace, 'el enlace del candidato cae en el portal').toMatch(/^\/restablecer\?token=/)

    await page.goto(enlace)
    await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva.' })).toBeVisible()
    // El token sale de la barra al cargar
    await expect(page).toHaveURL(/\/restablecer$/)
    expect(page.url()).not.toContain('token=')

    await page.getByLabel(/^Contraseña nueva/).fill(CLAVE_NUEVA)
    await page.getByLabel('Repetir contraseña').fill(CLAVE_NUEVA)
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()

    await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })
    await expect(page.getByText('Contraseña cambiada exitosamente')).toBeVisible()
    // Sin sesión: la pantalla de entrar sigue pidiendo correo y contraseña
    await expect(page.getByLabel('Correo')).toBeVisible()

    await page.getByLabel('Correo').fill(CANDIDATA)
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE_NUEVA)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/procesos/, { timeout: 15_000 })

    expect(await entrarPorApi('portal', CANDIDATA, CLAVE_DE_CANDIDATO)).toBe(401)
  })

  test('3 · el mismo enlace usado otra vez, o uno vencido, dicen que ya no sirve', async ({ page }) => {
    // El del recorrido 1 ya se usó: es el último que recibió
    const usado = await esperarEnlace(CANDIDATA, PLANTILLA_CANDIDATO)
    await page.goto(usado)
    await page.getByLabel(/^Contraseña nueva/).fill('otraClaveMas2026')
    await page.getByLabel('Repetir contraseña').fill('otraClaveMas2026')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('heading', { name: 'Este enlace ya no sirve.' })).toBeVisible()
    await expect(page.getByText(/^Pide uno nuevo\./)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute('href', '/clave')

    // Uno nuevo, vencido a mano: las dos fechas se mueven para respetar el CHECK
    expect(await pedirPorApi('portal', CANDIDATA)).toBe(202)
    const vencido = await esperarEnlace(CANDIDATA, PLANTILLA_CANDIDATO, usado)
    sql(`update recuperacion_clave set creado_en = now() - interval '2 hours',
           vence_en = now() - interval '1 hour'
         where usuario_id = (select id from usuario where correo = ${literal(CANDIDATA)})
           and usado_en is null and invalidado_en is null;`)
    await page.goto(vencido)
    await page.getByLabel(/^Contraseña nueva/).fill('otraClaveMas2026')
    await page.getByLabel('Repetir contraseña').fill('otraClaveMas2026')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('heading', { name: 'Este enlace ya no sirve.' })).toBeVisible()

    // Y la contraseña sigue siendo la del recorrido 1
    expect(await entrarPorApi('portal', CANDIDATA, CLAVE_NUEVA)).toBe(200)
  })

  test('4 · un correo sin cuenta ve el mismo mensaje y no crea ningún enlace', async ({ page }) => {
    const antes = enlacesEnTotal()
    await page.goto('/clave')
    await page.getByLabel('Correo').fill(SIN_CUENTA)
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText(MENSAJE_ENVIADO)).toBeVisible()
    // El trabajo va en segundo plano: se le da tiempo de sobra para equivocarse
    await page.waitForTimeout(2_000)
    expect(enlacesEnTotal()).toBe(antes)
  })

  test('5 · bloqueado por cinco intentos, entra en cuanto cambia la contraseña', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      expect(await entrarPorApi('portal', BLOQUEADA, `noEsEsta${i}xx`)).toBe(401)
    }
    expect(await entrarPorApi('portal', BLOQUEADA, CLAVE_DE_CANDIDATO)).toBe(429)

    expect(await pedirPorApi('portal', BLOQUEADA)).toBe(202)
    const enlace = await esperarEnlace(BLOQUEADA, PLANTILLA_CANDIDATO)
    await page.goto(enlace)
    await page.getByLabel(/^Contraseña nueva/).fill(CLAVE_NUEVA)
    await page.getByLabel('Repetir contraseña').fill(CLAVE_NUEVA)
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('Contraseña cambiada exitosamente')).toBeVisible({ timeout: 15_000 })

    expect(await entrarPorApi('portal', BLOQUEADA, CLAVE_NUEVA)).toBe(200)
  })

  test('2 · equipo: desde el login del panel, el enlace cae en el panel y entra con la nueva', async ({
    page,
  }) => {
    // Un correo de equipo pedido en el portal no recibe nada
    expect(await pedirPorApi('portal', EQUIPO)).toBe(202)

    await page.goto('/admin/entrar')
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(page).toHaveURL(/\/admin\/clave$/)
    await expect(page.getByText(/talento@renaser\.pe/)).toHaveCount(0)
    await page.getByLabel('Correo').fill(EQUIPO)
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText(MENSAJE_ENVIADO)).toBeVisible()

    const enlace = await esperarEnlace(EQUIPO, PLANTILLA_EQUIPO)
    expect(enlace, 'el enlace del equipo cae en el panel, nunca en el portal').toMatch(
      /^\/admin\/restablecer\?token=/,
    )
    expect(enlacesDe(EQUIPO), 'la solicitud del portal no creó nada').toBe(1)

    // Ese token no sirve en la pantalla del portal
    await page.goto(`/restablecer?token=${encodeURIComponent(tokenDe(enlace))}`)
    await page.getByLabel(/^Contraseña nueva/).fill(CLAVE_NUEVA_DE_EQUIPO)
    await page.getByLabel('Repetir contraseña').fill(CLAVE_NUEVA_DE_EQUIPO)
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('heading', { name: 'Este enlace ya no sirve.' })).toBeVisible()

    // En el panel, 12 como mínimo
    await page.goto(enlace)
    await expect(page).toHaveURL(/\/admin\/restablecer$/)
    await page.getByLabel(/^Contraseña nueva/).fill('once-letras')
    await page.getByLabel('Repetir contraseña').fill('once-letras')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('La contraseña necesita al menos 12 caracteres.')).toBeVisible()

    await page.getByLabel(/^Contraseña nueva/).fill(CLAVE_NUEVA_DE_EQUIPO)
    await page.getByLabel('Repetir contraseña').fill(CLAVE_NUEVA_DE_EQUIPO)
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page).toHaveURL(/\/admin\/entrar$/, { timeout: 15_000 })
    await expect(page.getByText('Contraseña cambiada exitosamente')).toBeVisible()

    await page.getByLabel('Correo').fill(EQUIPO)
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE_NUEVA_DE_EQUIPO)
    await page.getByRole('button', { name: /entrar al panel/i }).click()
    await expect(page).toHaveURL(/\/admin$/, { timeout: 25_000 })

    expect(await entrarPorApi('panel', EQUIPO, CLAVE_DE_EQUIPO)).toBe(401)
  })
})
