import { expect, test } from '@playwright/test'
import { corte, entrarAlPanel, filasDelRanking, irAVacante, VACANTES } from './ayuda'

/**
 * ⚠️ **Este archivo ESCRIBE**: mueve de etapa a una persona real de la base.
 *
 * Va el último y sobre la **vacante 8**, no la 7: la 7 es el banco de pruebas de
 * todo lo demás y cambiarle un estado movería los contadores de «Está aquí
 * ahora» y los motivos de «por qué no hay nota» de las otras pruebas.
 */
test.describe('Regresión · avanzar de etapa', () => {
  test('el botón exige motivo y marcados, y el avance se confirma', async ({ page }) => {
    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.SIN_PRETENSION)
    await corte(page, 'Toda la tanda').click()

    const avanzar = page.getByRole('button', { name: /^Avanzar a/ })
    // Sin nadie marcado no hay barra: ni botón que pulsar, ni motivo que escribir.
    await expect(avanzar).toHaveCount(0)
    await expect(page.getByLabel('Motivo (obligatorio)')).toHaveCount(0)

    const fila = filasDelRanking(page).filter({ hasText: 'Diego Salazar Núñez' })
    await fila.locator('input[type="checkbox"]').check()
    // Marcado pero sin motivo: la barra sale y el botón sigue apagado.
    await expect(avanzar).toHaveText('Avanzar a 1 persona')
    await expect(avanzar).toBeDisabled()

    // ⚠️ El motivo vive ahora en la barra de lo marcado, con su rótulo «Motivo
    // (obligatorio)»; se busca por el rótulo y no por el texto de ayuda del campo.
    await page.getByLabel('Motivo (obligatorio)').fill('Verificación QA de la rama')
    await expect(avanzar).toBeEnabled()
    await avanzar.click()

    // El resultado se anuncia, diga lo que diga el backend.
    const resultado = page.locator('[role="status"]').filter({ hasText: /Avanzaron|No avanzaron/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    const texto = (await resultado.textContent()) ?? ''
    expect(texto).toContain('Diego Salazar Núñez')
    // Y la tanda se refresca sola: las marcas se sueltan y la barra de acciones se va.
    await expect(avanzar).toHaveCount(0)
    console.log('[AVANCE]', texto)
  })
})
