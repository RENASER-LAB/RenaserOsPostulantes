import { expect } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import { entrarAlPortalCon, exigir, tokenDePanel, uno } from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  escribirPrueba,
  iniciarLaPrueba,
  lugarDe,
  publicarPrueba,
  responderLaPrueba,
  entregarLaPrueba,
  retirarLoSembrado,
  vencer,
  type Candidata,
} from './ayuda-prueba-propia'

/**
 * Regresiones de lo que encontró la QA exploratoria de la prueba del editor
 * (V67). Cada prueba nombra el hallazgo; hoy fallan y deben pasar con el arreglo.
 *
 * La vacante: un cuestionario (sin entregables) de dos criterios, uno de cerradas
 * y otro de una persona, para que quien entrega se quede sin nota de la etapa.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const OU = '¿Cuánto es el IGV general en el Perú?'
const ABIERTA = 'Explica a un gerente, en tres líneas, por qué no cuadraba.'
const correos: string[] = []
let equipo = ''
let vacante = 0
let entrego: Candidata
let vence: Candidata

test.describe('Regresiones de la prueba del editor', () => {
  // Independientes: un hallazgo abierto no debe esconder el resultado de los demás.

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    vacante = await crearVacante(equipo, 'Regresiones del cuestionario', await lugarDe(equipo))
    await exigir(`/panel/vacantes/${vacante}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
    await escribirPrueba(equipo, vacante, {
      criterios: [
        {
          nombre: 'Tributación',
          preguntas: [{ tipo: 'OPCION_UNICA', enunciado: OU, puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] }],
        },
        {
          nombre: 'Comunicación', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA, queDebeTener: 'Claridad sin jerga.' }],
        },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
    })
    expect((await publicarPrueba(equipo, vacante)).estado).toBe(200)
    await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
    entrego = await candidataEnLaPrueba(equipo, vacante, 'Rita', correos)
    vence = await candidataEnLaPrueba(equipo, vacante, 'Saúl', correos)
    // Rita lo entrega entero: queda «calificando», esperando a la persona
    const p = (await iniciarLaPrueba(entrego)).cuerpo
    const q = (t: string) => p.preguntas.find((x: any) => x.enunciado === t)
    await responderLaPrueba(entrego, q(OU).id, { opcionId: q(OU).opciones[0].id })
    await responderLaPrueba(entrego, q(ABIERTA).id, { texto: 'El banco cobró dos veces la misma comisión.' })
    expect((await entregarLaPrueba(entrego)).estado).toBe(200)
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('H-01: al empezar, el aviso no promete que al vencer se entrega lo guardado', async ({ page }) => {
    await entrarAlPortalCon(page, vence.token)
    await page.goto(`/procesos/${vence.uuid}/prueba`)
    await page.getByRole('button', { name: 'Empezar cuestionario' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText('¿Empezar ahora?')
    // Con algo sin responder al vencer, queda «sin completar» y NO se entrega (decisión 11)
    await expect(dialogo).not.toContainText('se entrega lo que hayas guardado')
    await dialogo.getByRole('button', { name: 'Sí, empezar' }).click()
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
  })

  test('H-02: tras quedar «sin completar», su proceso no le dice que le toca abrir la prueba', async ({ page }) => {
    // Por si H-01 no llegó a empezarla: el reloj tiene que estar corriendo para vencer
    if (uno(`select iniciado_en is null as sin_empezar from intento_prueba where postulacion_id = ${vence.postulacion}`).sin_empezar) {
      expect((await iniciarLaPrueba(vence)).estado).toBe(200)
    }
    vencer(vence.postulacion)
    await expect
      .poll(() => uno(`select no_completada from intento_prueba where postulacion_id = ${vence.postulacion}`).no_completada,
        { timeout: 100_000, intervals: [2_000] })
      .toBe(true)
    await entrarAlPortalCon(page, vence.token)
    await page.goto(`/procesos/${vence.uuid}`)
    // El recorrido ya pintado: sin esto, un «no contiene» pasaría antes de que llegue.
    await expect(page.getByText('Cómo llegaste hasta aquí')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('main')).toContainText('La prueba del puesto')
    await expect(page.locator('main')).not.toContainText('Prueba del puesto habilitada')
    await expect(page.getByRole('link', { name: 'Abrir prueba' })).toHaveCount(0)
    await page.goto('/procesos')
    await expect(page.locator('main')).toContainText('Regresiones del cuestionario', { timeout: 20_000 })
    await expect(page.locator('main')).not.toContainText('Tienes una cosa pendiente')
  })

  test('H-03: el ranking de la prueba del editor no usa el bloque de la plantilla ni dice que no hay rúbrica', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}`)
    await page.getByRole('tab', { name: /Prueba del puesto/ }).click()
    await page.getByRole('button', { name: /Toda la tanda/ }).first().click()
    await expect(page.getByRole('row').filter({ hasText: 'Rita Prueba Editor QA' })).toHaveCount(1, { timeout: 20_000 })
    const revisar = page.getByRole('button', { name: 'Ver qué le falta a esa persona' })
    if (await revisar.count()) {
      await revisar.click()
      await page.waitForResponse((r) => r.url().includes('/prueba/notas'), { timeout: 10_000 }).catch(() => null)
    }
    await expect(page.locator('main')).not.toContainText('no tiene rúbrica de prueba que calificar')
  })

  test('H-04: el balance de un cuestionario se anuncia bien a un lector de pantalla', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}/prueba`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cuestionario', { timeout: 20_000 })
    // Hace falta un borrador para que se pinte el balance: se abre desde la publicada
    // (alguien ya empezó, así que no se puede) → se comprueba en una vacante sin rendiciones.
    const otra = await crearVacante(equipo, 'Regresiones del balance', await lugarDe(equipo))
    await escribirPrueba(equipo, otra, {
      criterios: [{ nombre: 'Tributación', preguntas: [{ tipo: 'OPCION_UNICA', enunciado: OU, puntos: 100, opciones: [{ texto: '18 %', puntos: 100 }, { texto: '19 %', puntos: 0 }] }] }],
    })
    await page.goto(`/admin/vacantes/${otra}/prueba`)
    const balance = page.locator('section[aria-label^="Balance"]')
    await expect(balance).toBeVisible({ timeout: 20_000 })
    await expect(balance).not.toHaveAttribute('aria-label', 'Balance de la cuestionario')
  })
})
