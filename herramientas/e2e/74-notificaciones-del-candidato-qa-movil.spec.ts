import { expect, type Locator } from '@playwright/test'
import { borrarCuentasDePrueba, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import { abrirLaCampana, abrirLosAjustes, panelDeAvisos, tuerca, ventanaDeAjustes } from './ayuda-ajustes-de-avisos'
import { correoDePrueba, limpiarSiempre, literal, sql } from './base-de-datos'
import {
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
  postular,
  publicarPreguntas,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, publicarPrueba } from './ayuda-prueba-propia'
import { ponerLaBeta } from './ayuda-whatsapp'

/**
 * Notificaciones del candidato (V92) en el teléfono, a 390 px (la medida de la spec) y a los
 * 375 px del proyecto `movil`. Desde el 25/11/2026 los ajustes se abren con la tuerca de la
 * campana, que aquí es una hoja inferior:
 *
 *   - La tuerca mide 44 px y la campana abre una hoja pegada abajo, a todo el ancho; los ajustes
 *     se pintan como la misma hoja, con «Volver a tus avisos», que devuelve a la hoja de avisos.
 *   - Sin número: el celular de nueve cifras se ve entero en el campo (regresión de QA: comparte
 *     fila con «Guardar» y «955 111 222» se cortaba en «955 111»).
 *   - La guía de la primera vez: la burbuja a todo el ancho bajo la cabecera y, en el paso 2,
 *     encima de la hoja.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo (cuentas, una vacante con la marca QA-NC-0092-M) y
 * enciende la beta de WhatsApp mientras dura; `afterAll` lo deja como estaba.
 */

const MARCA = 'QA-NC-0092-M'
const PREFIJO = 'qa.nc.0092.movil'
const correos: string[] = []
let equipo = ''
let betaAntes = 'false'
let vacante = 0

async function cuenta(nombre: string, { sinNumero = false } = {}): Promise<string> {
  const correo = correoDePrueba(PREFIJO)
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Prueba', correo })
  if (sinNumero) {
    const persona = Number(uno(`select persona_id as p from usuario where correo = ${literal(correo)}`).p)
    sql(`update persona set telefono = null where id = ${persona};`)
  }
  return tokenDelCandidato(correo)
}

/** Lo que mide una caja cuando ha terminado de entrar (las hojas suben en ~240 ms). */
async function quieta(locator: Locator) {
  let antes = ''
  await expect
    .poll(async () => {
      const caja = await locator.boundingBox()
      const ahora = JSON.stringify(caja && [caja.x, caja.y, caja.width, caja.height].map(Math.round))
      const igual = ahora === antes
      antes = ahora
      return igual
    })
    .toBe(true)
  return (await locator.boundingBox())!
}

test.beforeAll(async () => {
  test.setTimeout(120_000)
  equipo = await tokenDePanel()
  betaAntes = await ponerLaBeta(equipo, true)
  const lugar = await lugarDe(equipo)
  vacante = await crearVacante(equipo, 'Asistente de Caja', lugar, undefined, MARCA)
  await escribirBorrador(equipo, vacante, [
    { nombre: 'General', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Cuéntanos un día difícil.', puntos: 100, queDebeTener: 'La causa.' }] },
  ])
  await publicarPreguntas(equipo, vacante)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Análisis',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo lo resolverías?', queDebeTener: 'Los pasos.' }],
      },
    ],
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira los pasos.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${vacante}/calificacion-automatica`, equipo, 'POST', { activa: false })
})

test.afterAll(async () => {
  await limpiarSiempre([
    () => ponerLaBeta(equipo, betaAntes === 'true').then(() => undefined),
    () => borrarCuentasDePrueba(correos),
    () => {
      sql(`update vacante set eliminada_en = now() where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null;`)
      sql(`update solicitud_talento set estado = 'ARCHIVADA'
            where motivo like ${literal(`${MARCA}%`)} and estado <> 'ARCHIVADA';`)
    },
  ])
})

for (const ancho of [390, 375]) {
  test(`a ${ancho} px: la campana es una hoja inferior, la tuerca mide 44 px y los ajustes vuelven a los avisos`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 })
    await entrarAlPortalCon(page, await cuenta('Rosa'))
    await page.goto('/procesos')

    await abrirLaCampana(page)
    // Pegada abajo y a todo el ancho.
    const hoja = await quieta(panelDeAvisos(page))
    expect(Math.round(hoja.x)).toBe(0)
    expect(Math.round(hoja.width)).toBe(ancho)
    expect(Math.round(hoja.y + hoja.height)).toBe(844)
    const laTuerca = await tuerca(page).boundingBox()
    expect(Math.round(laTuerca!.width)).toBe(44)
    expect(Math.round(laTuerca!.height)).toBe(44)

    await tuerca(page).click()
    const ventana = ventanaDeAjustes(page)
    await expect(ventana.getByRole('heading', { name: 'Ajustes de avisos' })).toBeVisible()
    await expect(ventana.getByText('Para todos tus procesos.')).toBeVisible()
    const caja = await quieta(ventana)
    expect(Math.round(caja.width)).toBe(ancho)
    expect(Math.round(caja.y + caja.height)).toBe(844)
    // Sin ×: la flecha vuelve a los avisos.
    await expect(ventana.getByRole('button', { name: 'Cerrar' })).toBeHidden()
    await ventana.getByRole('button', { name: 'Volver a tus avisos' }).click()
    await expect(ventana).toBeHidden()
    await expect(panelDeAvisos(page)).toBeVisible()
    await expect(tuerca(page)).toBeFocused()
    // Y sin desplazamiento lateral.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho)
  })

  test(`sin número, a ${ancho} px: el celular de nueve cifras se ve entero en el campo de la ventana`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 })
    await entrarAlPortalCon(page, await cuenta('Sara', { sinNumero: true }))
    await page.goto('/procesos')
    const ventana = await abrirLosAjustes(page)
    await expect(ventana.getByText('Sin número', { exact: true })).toBeVisible()
    const campo = ventana.getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')
    await campo.fill('955 111 222')
    await expect(campo).toHaveValue('955 111 222')

    const medida = await campo.evaluate((el: HTMLInputElement) => ({ visible: el.clientWidth, contenido: el.scrollWidth }))
    expect(medida.contenido, `el campo mide ${medida.visible} px y el número ${medida.contenido} px`).toBeLessThanOrEqual(medida.visible + 1)
    // «Guardar» sigue a la vista y dentro de la ventana.
    const caja = await ventana.boundingBox()
    const guardar = await ventana.getByRole('button', { name: 'Guardar' }).boundingBox()
    expect(caja && guardar && guardar.x + guardar.width <= caja.x + caja.width).toBe(true)
  })
}

test.describe('la guía en el teléfono', () => {
  test.use({ guiaDeAvisos: true })

  test('a 390 px: la burbuja a todo el ancho bajo la cabecera y, en el paso 2, encima de la hoja', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const token = await cuenta('Tula')
    await postular(token, vacante)
    await entrarAlPortalCon(page, token)
    await page.goto('/procesos')

    const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
    const burbuja = paso1.locator('h2').locator('xpath=ancestor::div[2]')
    await expect(paso1.getByRole('button', { name: 'Siguiente' })).toBeFocused()
    const arriba = await burbuja.boundingBox()
    expect(Math.round(arriba!.x)).toBe(16)
    expect(Math.round(arriba!.width)).toBe(390 - 32)
    const cabecera = await page.locator('header').first().boundingBox()
    expect(arriba!.y).toBeGreaterThanOrEqual(cabecera!.y + cabecera!.height - 1)

    await paso1.getByRole('button', { name: 'Siguiente' }).click()
    const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
    await expect(paso2.getByRole('button', { name: 'Siguiente' })).toBeFocused()
    const hoja = page.locator('[role="dialog"][aria-label="Tus avisos"]')
    await expect(hoja).toBeVisible()
    const laHoja = await quieta(hoja)
    expect(Math.round(laHoja.y + laHoja.height)).toBe(844)
    const burbuja2 = await quieta(paso2.locator('h2').locator('xpath=ancestor::div[2]'))
    expect(Math.round(burbuja2.y + burbuja2.height)).toBeLessThanOrEqual(Math.round(laHoja.y))
    expect(Math.round(burbuja2.width)).toBe(390 - 32)

    // Esc la salta y la da por vista.
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[aria-modal="true"]')).toHaveCount(0)
  })
})
