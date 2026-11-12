import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'

import { corte, entrarAlPanel, entrarAlPortal } from './ayuda'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  test,
} from './ayuda-candidato'
import { loEnfocadoSeVeEntero, TAMANOS } from './ayuda-campo-a-la-vista'
import {
  retirarLoSembrado as retirarLoDePersonas,
  sembrarEstructura,
  sembrarPostulacion,
  sembrarVacante as vacanteDePersonas,
  uno,
  type Estructura,
} from './ayuda-personas'
import {
  correoDeCandidata,
  idsDeLaCuenta,
  retirarLoSembrado as retirarLoDeResenas,
  sembrarContratacion,
  sembrarResena,
  sembrarVacante as vacanteDeResenas,
} from './ayuda-resenas'
import { limpiarSiempre } from './base-de-datos'

/**
 * El campo con error, entero bajo la cabecera fija (feedback de la revisión del
 * celular): al enviar con errores, el campo al que se lleva el foco —con su
 * etiqueta y su mensaje— queda a la vista, en el portal y en el panel, en
 * escritorio y a 390 × 844. El registro y el alta del colaborador están en el
 * test 10 de `61-celular-con-formato`; el cierre de la prueba y el plazo de una
 * persona, en `29-plazo-de-la-prueba` (FB-01), que ya siembra su terreno.
 *
 *   1. «Mi cuenta»: la pretensión a medias (con el botón, desde abajo) y la
 *      experiencia fuera de rango (con Enter, desde arriba).
 *   2. Entrar al panel sin datos.
 *   3. Descartar una postulación sin motivo: el campo dentro de la ventana.
 *   4. Reseñas: la del panel sin estrellas (un grupo de opciones) y la respuesta
 *      del portal vacía (dentro de la ventana).
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo: dos cuentas con correo único, una
 * estructura y una vacante con la marca de `ayuda-personas`, dos vacantes y una
 * reseña con la de `ayuda-resenas`. Ningún formulario se envía válido; `afterAll`
 * lo retira todo.
 */

test.describe.configure({ mode: 'serial' })

const SUFIJO = randomUUID().slice(0, 6)
const CORREO_PORTAL = correoDePrueba('qa.campo.vista')
const CORREO_RESENA = correoDeCandidata()

let e: Estructura | null = null
const vacantesDePersonas: number[] = []
let postulacion = 0
let vacanteParaEscribir = 0

test.beforeAll(async () => {
  await crearCuentaDeCandidato({ nombre: 'Vista', apellidos: `Campo ${SUFIJO}`, correo: CORREO_PORTAL })
  e = sembrarEstructura(SUFIJO)
  const vacante = vacanteDePersonas(e, `Campo a la vista ${SUFIJO}`)
  vacantesDePersonas.push(vacante)
  postulacion = sembrarPostulacion(vacante, CORREO_PORTAL, 'PERFIL_POR_CONFIRMAR')

  await crearCuentaDeCandidato({ nombre: 'Reseña', apellidos: `Vista ${SUFIJO}`, correo: CORREO_RESENA })
  const { usuario, persona } = idsDeLaCuenta(CORREO_RESENA)
  vacanteParaEscribir = vacanteDeResenas(`Campo a la vista por escribir ${SUFIJO}`)
  sembrarContratacion(vacanteParaEscribir, usuario, 40)
  const publicada = sembrarContratacion(vacanteDeResenas(`Campo a la vista publicada ${SUFIJO}`), usuario, 40)
  sembrarResena(
    publicada,
    persona,
    4,
    'Puntual y ordenada, con compromiso durante todo el tiempo que trabajó con nosotros.',
    3,
  )
})

test.afterAll(async () => {
  await limpiarSiempre([
    () => retirarLoDeResenas([CORREO_RESENA], null),
    () => retirarLoDePersonas(e, vacantesDePersonas),
    () => borrarCuentasDePrueba([CORREO_PORTAL]),
  ])
})

test('1 · «Mi cuenta»: la pretensión a medias y la experiencia fuera de rango quedan enteras bajo la cabecera', async ({
  page,
}) => {
  await entrarAlPortal(page, CORREO_PORTAL, CLAVE_DE_CANDIDATO)
  for (const tamano of TAMANOS) {
    await page.setViewportSize(tamano)
    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Editar perfil' }).click()
    const formulario = page.locator('form').filter({ has: page.getByLabel('Experiencia, en meses') })

    // Desde abajo: el botón «Guardar» está al pie y el campo con error, más arriba.
    await formulario.getByLabel('Desde', { exact: true }).fill('3000')
    await formulario.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(formulario.getByLabel('Hasta', { exact: true })).toBeFocused()
    await loEnfocadoSeVeEntero(page, `pretensión a ${tamano.width} px`)

    // Desde arriba: Enter en «Titular» con la página arriba; el error queda más abajo.
    await formulario.getByLabel('Desde', { exact: true }).fill('')
    await formulario.getByLabel('Experiencia, en meses').fill('999')
    await formulario.getByLabel('Titular').focus()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.keyboard.press('Enter')
    await expect(formulario.getByLabel('Experiencia, en meses')).toBeFocused()
    await loEnfocadoSeVeEntero(page, `experiencia a ${tamano.width} px`)
  }
})

test('2 · entrar al panel sin datos: el correo queda entero bajo la cabecera', async ({ page }) => {
  for (const tamano of TAMANOS) {
    await page.setViewportSize(tamano)
    await page.goto('/admin/entrar')
    await page.getByRole('button', { name: 'Entrar al panel' }).click()
    await expect(page.getByLabel(/^Correo/)).toBeFocused()
    await loEnfocadoSeVeEntero(page, `entrar al panel a ${tamano.width} px`)
  }
})

test('3 · descartar sin motivo: el motivo queda entero dentro de la ventana y no se descarta nada', async ({ page }) => {
  await entrarAlPanel(page)
  for (const tamano of TAMANOS) {
    await page.setViewportSize(tamano)
    await page.goto(`/admin/vacantes/${vacantesDePersonas[0]}`)
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('button', { name: /^Vista Campo/i }).click()
    await page.getByRole('button', { name: 'Descartar', exact: true }).click()
    const ventana = page.getByRole('dialog')
    await ventana.getByRole('button', { name: /^Descartar / }).click()
    await expect(ventana.getByLabel('Por qué no continúa')).toBeFocused()
    await loEnfocadoSeVeEntero(page, `descartar a ${tamano.width} px`)
    await ventana.getByRole('button', { name: 'Cancelar' }).click()
    await expect(ventana).toBeHidden()
  }
  expect(uno(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo).toBe('PERFIL_POR_CONFIRMAR')
})

test('4 · reseñas: la del panel sin estrellas y la respuesta del portal vacía quedan enteras a la vista', async ({
  page,
}) => {
  await entrarAlPanel(page)
  await entrarAlPortal(page, CORREO_RESENA, CLAVE_DE_CANDIDATO)
  for (const tamano of TAMANOS) {
    await page.setViewportSize(tamano)

    // El panel: publicar sin elegir estrellas lleva el foco a la primera, con la
    // leyenda «Calificación» y su error.
    await page.goto(`/admin/vacantes/${vacanteParaEscribir}`)
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('button', { name: /^Reseña Vista/i }).click()
    await page.getByRole('button', { name: 'Publicar reseña' }).click()
    await expect(page.getByRole('radio', { name: /^1 estrella/ })).toBeFocused()
    await loEnfocadoSeVeEntero(page, `reseña del panel a ${tamano.width} px`)

    // El portal: responder sin texto, dentro de la ventana.
    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Responder' }).first().click()
    const ventana = page.getByRole('dialog')
    await ventana.getByRole('button', { name: 'Publicar respuesta' }).click()
    await expect(ventana.getByLabel('Tu respuesta')).toBeFocused()
    await loEnfocadoSeVeEntero(page, `respuesta del portal a ${tamano.width} px`)
    await page.keyboard.press('Escape')
    await expect(ventana).toBeHidden()
  }
  expect(Number(uno(`select count(*) as n from resena r join postulacion p on p.id = r.postulacion_id
                       where p.vacante_id = ${vacanteParaEscribir}`).n)).toBe(0)
})
