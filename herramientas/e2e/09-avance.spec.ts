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

    const avanzar = page.getByRole('button', { name: /Avanzar a|Marca a quienes avanzan/ })
    // Sin nadie marcado, el botón lo dice y está apagado.
    await expect(avanzar).toHaveText('Marca a quienes avanzan')
    await expect(avanzar).toBeDisabled()

    const fila = filasDelRanking(page).filter({ hasText: 'Diego Salazar Núñez' })
    await fila.locator('input[type="checkbox"]').check()
    // Marcado pero sin motivo: sigue apagado.
    await expect(avanzar).toHaveText('Avanzar a 1 persona')
    await expect(avanzar).toBeDisabled()

    // ⚠️ «Motivo (obligatorio)» y no «Motivo del avance (obligatorio)»: la barra dejó de ser
    // solo la de avanzar cuando aprendió a descartar a la tanda marcada (PR #42, 7b0eb66), y
    // el texto se acortó con ella. Este spec se quedó con el nombre viejo y desde entonces
    // moría aquí por tiempo de espera, sin llegar nunca a comprobar el avance que da nombre
    // al archivo.
    await page.getByPlaceholder('Motivo (obligatorio)').fill('Verificación QA de la rama')
    await expect(avanzar).toBeEnabled()
    await avanzar.click()

    // El resultado se anuncia, diga lo que diga el backend.
    const resultado = page.locator('[role="status"]').filter({ hasText: /Avanzaron|No avanzaron/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    const texto = (await resultado.textContent()) ?? ''
    expect(texto).toContain('Diego Salazar Núñez')
    // Y la tanda se refresca sola: el botón vuelve a su estado de reposo.
    await expect(avanzar).toHaveText('Marca a quienes avanzan')
    console.log('[AVANCE]', texto)
  })
})
