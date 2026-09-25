import { expect, test } from '@playwright/test'
import { apiPanel, detalleDe } from './ayuda-configuracion'

/**
 * Dos cosas sueltas que hablan con el backend de verdad: la forma de
 * `CierrePruebaResponse` y la entrada de las empresas en el portal.
 *
 * ⚠️ **Escribe en la base, y poco:** quita el cierre de prueba de una vacante
 * —que ya estaba quitado—. Es idempotente; lo que no se deshace es la fila de
 * auditoría, y es correcto que así sea.
 *
 * Lo que este archivo traía y ya no está, y por qué:
 *
 *   - Las columnas del ranking por etapa —«Nota del perfil» / «Nota de la
 *     prueba» en el título, y que el retrato del CV no sea columna— son lógica
 *     de `columnasDelRanking` y se prueban sin navegador. Además esperaba
 *     «Adecuación» y «Potencial» como columnas, que dejaron de serlo: fallaba
 *     por formato, no por datos.
 *   - Cuándo cierra la prueba, la cronometrada que acepta fecha y quitar el
 *     cierre los cubre entero `29-plazo-de-la-prueba`, sobre terreno propio.
 *   - Lo que la persona escribió, pedirle la nota a la IA, la rúbrica entera o
 *     vacía y la tanda entera de la prueba necesitan una prueba ENTREGADA, que
 *     la siembra no tiene: se saltaban siempre (o fallaban, «hay postulaciones
 *     con rúbrica que mirar»). La pantalla de cada caso se fija sin navegador
 *     en `CalificarConIa.test`, `NotaDeLaPrueba.test`, `LaTandaDeLaPrueba.test`
 *     y `RespuestasDePrueba.test`; el recorrido con IA de verdad queda en
 *     `16-cuestionario-tecnico`, a mano. Anotado en
 *     `docs/SUITE-E2E-CLASIFICACION-2026-09-25.md`.
 */

interface Vacante {
  id: number
  titulo: string
  estado: string
  versionPlantillaPruebaId: number | null
}

/** Abierta y con su prueba elegida: donde el control del cierre existe. */
let vacanteAbierta: Vacante | undefined

test.beforeAll(async () => {
  const lista = await apiPanel('/vacantes')
  const crudo = Array.isArray(lista.cuerpo) ? lista.cuerpo : (lista.cuerpo?.contenido ?? lista.cuerpo?.filas ?? [])
  for (const v of crudo as { id: number }[]) {
    const detalle = await apiPanel<Vacante>(`/vacantes/${v.id}`)
    if (detalle.estado === 200 && detalle.cuerpo.estado !== 'CERRADA' && detalle.cuerpo.versionPlantillaPruebaId !== null) {
      vacanteAbierta = detalle.cuerpo
      break
    }
  }
})

test.describe('La prueba · el contrato del backend', () => {
  /*
    Lo que este spec encontró en su día, y no se veía leyendo el código:
    `CierrePruebaResponse` llama al campo `intentosConPlazoPropio`, no
    `conPlazoPropio` —ese es el nombre de una variable local dentro de su
    implementación—. Con el nombre corto llegaba `undefined` y el único número
    que ese bloque existe para no callar se perdía en silencio.
  */
  test('CierrePruebaResponse trae «intentosConPlazoPropio», no «conPlazoPropio»', async () => {
    test.skip(!vacanteAbierta, 'no hay ninguna vacante abierta con su prueba elegida')
    // `cierraEn: null` sobre una vacante sin cierre no toca nada: es el único
    // camino que devuelve la forma completa sin escribir.
    const quitado = await apiPanel(`/vacantes/${vacanteAbierta!.id}/cierre-prueba`, {
      method: 'POST',
      cuerpo: { cierraEn: null, motivo: 'e2e: comprobar la forma de la respuesta' },
    })
    expect(quitado.estado, detalleDe(quitado)).toBe(200)
    expect(quitado.cuerpo, `llegó ${JSON.stringify(quitado.cuerpo)}`).toHaveProperty('intentosConPlazoPropio')
  })
})

// ---------- La entrada de las empresas, en el portal ----------

test.describe('La entrada de las empresas', () => {
  test('vive en el pie del portal, no en la barra de arriba, lleva a la entrada del panel y no ofrece registrarse', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const enlace = page.locator('footer').getByRole('link', { name: /panel de empresas/i })
    await expect(enlace).toHaveCount(1)

    // La barra de arriba es el camino de quien postula.
    const arriba = await page.locator('header').innerText()
    expect(arriba, arriba).not.toMatch(/empresa/i)

    await enlace.click()
    await expect(page).toHaveURL(/\/admin\/entrar/)

    // Las cuentas del panel nacen solo por invitación.
    const texto = await page.locator('main, body').first().innerText()
    expect(texto).not.toMatch(/crear cuenta|regístrate|registrate/i)
  })
})
