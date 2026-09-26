import { expect } from '@playwright/test'
import { EQUIPO, VACANTES, corte, entrarAlPanel, filasDelRanking, irAVacante, pestana } from './ayuda'
import { test as base } from './ayuda-candidato'

/**
 * La entrada de desarrollo y la ficha que cambia con la etapa.
 *
 * ⚠️ Solo lee.
 *
 * Lo que este archivo miraba y YA cubren otros no se repite: la celda de la
 * nota en las cinco pestañas —la cifra o su guion con su porqué— la contrasta
 * `18-ranking-contra-api` contra la API y la fija sin navegador
 * `ranking.test.ts` («el motivo del guion, en dos palabras»); «Le toca al
 * candidato» en Decisión también está en `18`.
 *
 * ⚠️ **Tres comprobaciones que había aquí se retiraron porque la siembra nunca
 * trae lo que pedían** —alguien con nota en prueba, simulación y validación a
 * la vez; un periodo de validación habilitado; una evaluación del banco
 * respondida— y se saltaban siempre. Quedan anotadas como recorridos sin
 * cobertura en `docs/SUITE-E2E-CLASIFICACION-2026-09-25.md`.
 */

/**
 * Los 404 que la ficha traduce y no son fallo: validación sin habilitar, notas
 * de prueba y simulación sin calificar, el tanteo de versiones de prueba que el
 * backend no deja listar, y la ficha del perfil que ya daba 404 en `main`
 * (ver `08-teclado-y-consola`).
 *
 * ⚠️ **Lo entregado y lo escrito en la prueba también, y por lo mismo que sus
 * notas.** La ficha de «Prueba del puesto» monta siempre esos dos bloques, y a
 * quien no tiene `intento_prueba` el backend le contesta 404 en las tres rutas
 * (`ServicioCalificacionPruebaImpl`); la ficha lo traduce en «no rindió»
 * (`EntregablesDePrueba.test.tsx`, `RespuestasDePrueba.test.tsx`). Faltaban
 * aquí y la prueba solo pasaba si acababa antes de que llegaran: con la traza
 * puesta fallaba siempre.
 *
 * ⚠️ **Se perdona la ruta CON su estado, y solo el 404.** La lista se miraba
 * sin el estado, y cualquier error de esas rutas pasaba: un 500 en
 * `/prueba/entregables` dejaba la prueba en verde con la ficha diciendo «El
 * sistema tuvo un problema». El 404 es lo único que la ficha traduce en «no
 * hay»; un 500, un 403 o un 400 en la misma URL son fallo.
 */
const ESPERADOS_404 = [
  /\/validacion\b/,
  /\/prueba\/notas/,
  /\/prueba\/entregables/,
  /\/prueba\/respuestas/,
  /\/simulacion\/notas/,
  /\/plantillas-prueba\/versiones\//,
  /\/ficha\b/,
]

/**
 * `test` con el segundo vigilante del arnés viejo: cualquier respuesta de 400
 * para arriba que no sea uno de los 404 esperados (ni un 401, que es cosa de
 * sesión) hace fallar la prueba.
 */
const test = base.extend<{ sinRespuestasMalas: void }>({
  sinRespuestasMalas: [
    async ({ page }, usar) => {
      const malas: string[] = []
      page.on('response', (r) => {
        if (r.status() < 400 || r.status() === 401) return
        if (r.status() === 404 && ESPERADOS_404.some((patron) => patron.test(new URL(r.url()).pathname))) return
        malas.push(`${r.status()} · ${r.url()}`)
      })
      await usar()
      expect(malas, `Respuestas de error inesperadas:\n${malas.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})

test.describe('Regresión · el ranking por etapas', () => {
  test('la entrada de desarrollo, plegada al final de la pantalla de entrar, sigue abriendo el panel', async ({
    page,
  }) => {
    await page.goto('/admin/entrar')
    /*
      El panel entra con correo y contraseña. La entrada de desarrollo sigue ahí
      pero **plegada**, y hay que abrirla: el campo no existe en el DOM
      accesible hasta que el `<details>` se despliega.
    */
    await page.getByText('Entrar con un id de desarrollo').click()
    await page.getByLabel('Identificador de RENASER OS').fill(EQUIPO)
    await page.getByRole('button', { name: 'Entrar como desarrollo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible({ timeout: 15_000 })
  })

  test.describe('con sesión', () => {
    test.beforeEach(async ({ page }) => {
      await entrarAlPanel(page)
    })

    /*
      ⚠️ Con la tanda entera puesta: quien tiene la evaluación del banco hecha
      puede haber avanzado de etapa, y entonces no está parado en esta pestaña.
    */
    test('la ficha del perfil integral trae las dos tablas: lo que calificó la IA y la evaluación del banco', async ({
      page,
    }) => {
      await irAVacante(page, VACANTES.LLENA)
      await corte(page, 'Toda la tanda').click()
      await filasDelRanking(page).first().click()
      await expect(page.getByRole('heading', { name: 'La evaluación del banco' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Lo que calificó la IA' })).toBeVisible()
    })

    /*
      También con la tanda entera: en la base local no siempre hay alguien
      PARADO en la prueba, y lo que se mira aquí es que la ficha cambie de
      contenido con la pestaña.
    */
    test('la misma ficha en «Prueba del puesto» enseña su rúbrica, no el CV', async ({ page }) => {
      await irAVacante(page, VACANTES.LLENA)
      await pestana(page, 'Prueba del puesto').click()
      await corte(page, 'Toda la tanda').click()
      await filasDelRanking(page).first().click()
      await expect(
        page.getByRole('heading', { name: /La prueba del puesto, criterio a criterio/ }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Lo que calificó la IA' })).toHaveCount(0)

      /*
        Se espera a que los tres bloques contesten —las notas, lo entregado y lo
        escrito— para que el vigilante juzgue sus respuestas en todas las
        corridas, y no según lo que tarde la prueba en acabar: como solo perdona
        el 404, un 500 en cualquiera de las tres rutas la hace fallar siempre.
      */
      for (const bloque of ['Lo que entregó', 'Lo que escribió en la prueba']) {
        await expect(page.getByRole('heading', { name: bloque, exact: true })).toBeVisible()
      }
      await expect(
        page.getByText(/^(Buscando lo que (entregó|escribió)|Cargando las notas)…$/),
      ).toHaveCount(0, { timeout: 15_000 })
    })
  })
})
