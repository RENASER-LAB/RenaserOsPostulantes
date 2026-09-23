import { expect } from '@playwright/test'

import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato, test } from './ayuda-candidato'
import {
  crearCuentaDeEquipo,
  esperarEnlace,
  holgarElTopePorIp,
  pedirPorApi,
  PLANTILLA_CANDIDATO,
  PLANTILLA_EQUIPO,
} from './ayuda-recuperacion'
import { literal, sql } from './base-de-datos'

/**
 * «Me olvidé mi contraseña»: regresiones de lo que encontró QA explorando.
 *
 *   1. Una contraseña de más de 72 bytes (el tope de BCrypt) llegaba al campo
 *      como «password cannot be more than 72 bytes», el texto crudo de Spring
 *      Security.
 *   2. La organización plataforma se llama «RENASER CONSULTING S.A.C.», y las
 *      plantillas sembradas ponen un punto detrás de `{{nombre_empresa}}`: los
 *      correos salían con «S.A.C..».
 *
 * Cada prueba es independiente —crea su cuenta y la borra— para que un hallazgo
 * abierto no deje sin correr al otro.
 *
 * ⚠️ **ESCRIBE**: crea cuentas `e2e.rcr.*.<uuid>@example.com` y las borra al
 * terminar. La auditoría de cada solicitud queda, sin usuario ni token.
 */

/** El último cuerpo de ese correo, o '' si no hay. */
function ultimoCuerpo(correo: string, plantilla: string): string {
  return sql(`select c.cuerpo from correo_enviado c join usuario u on u.id = c.usuario_id
    where u.correo = ${literal(correo)} and c.plantilla_correo_codigo = ${literal(plantilla)}
    order by c.id desc limit 1;`)
}

test.describe('Me olvidé mi contraseña · regresiones de QA', () => {
  let devolverElTope: () => void = () => {}
  test.beforeAll(() => {
    devolverElTope = holgarElTopePorIp()
  })
  test.afterAll(() => {
    devolverElTope()
  })

  test('una contraseña de más de 72 bytes no termina en un mensaje técnico en inglés', async ({ page }) => {
    const larga = correoDePrueba('e2e.rcr.larga')
    try {
      await crearCuentaDeCandidato({ nombre: 'Larga', apellidos: 'Recupera', correo: larga })
      expect(await pedirPorApi('portal', larga)).toBe(202)
      const enlace = await esperarEnlace(larga, PLANTILLA_CANDIDATO)
      await page.goto(enlace)

      // 40 «ñ»: 40 caracteres y 80 bytes. Pasa el mínimo de 8 y no cabe en BCrypt.
      const clave = 'ñ'.repeat(40)
      await page.getByLabel(/^Contraseña nueva/).fill(clave)
      await page.getByLabel('Repetir contraseña').fill(clave)
      await page.getByRole('button', { name: 'Guardar contraseña' }).click()

      // Vale que se acepte o que se rechace; lo que no vale es el texto crudo.
      const errorDelCampo = page.locator('[id$="-error"]').first()
      await expect(page.getByText('Contraseña cambiada exitosamente').or(errorDelCampo)).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText(/password cannot|bytes/i)).toHaveCount(0)
      if (!/\/ingresar$/.test(page.url())) {
        await expect(errorDelCampo, 'el motivo se dice en español').toContainText(/contraseña/i)
        // Y el enlace no se perdió
        await page.getByLabel(/^Contraseña nueva/).fill('otraClaveMasCorta2026')
        await page.getByLabel('Repetir contraseña').fill('otraClaveMasCorta2026')
        await page.getByRole('button', { name: 'Guardar contraseña' }).click()
        await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })
      }
    } finally {
      borrarCuentasDePrueba([larga])
    }
  })

  test('los correos de recuperación no dicen «S.A.C..» con el punto repetido', async () => {
    const candidata = correoDePrueba('e2e.rcr.punto')
    const equipo = correoDePrueba('e2e.rcr.equipo')
    try {
      await crearCuentaDeCandidato({ nombre: 'Punto', apellidos: 'Recupera', correo: candidata })
      await crearCuentaDeEquipo(equipo, 'unaClaveLargaDePunto2026')
      expect(await pedirPorApi('portal', candidata)).toBe(202)
      expect(await pedirPorApi('panel', equipo)).toBe(202)
      await esperarEnlace(candidata, PLANTILLA_CANDIDATO)
      await esperarEnlace(equipo, PLANTILLA_EQUIPO)

      const delCandidato = ultimoCuerpo(candidata, PLANTILLA_CANDIDATO)
      const delEquipo = ultimoCuerpo(equipo, PLANTILLA_EQUIPO)
      // Dos puntos seguidos que no son unos puntos suspensivos
      expect(delCandidato, 'correo del candidato').not.toMatch(/[^.]\.\.(?!\.)/)
      expect(delEquipo, 'correo del equipo').not.toMatch(/[^.]\.\.(?!\.)/)
    } finally {
      borrarCuentasDePrueba([candidata, equipo])
    }
  })
})
