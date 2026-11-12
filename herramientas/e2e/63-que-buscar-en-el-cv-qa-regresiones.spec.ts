/**
 * Regresiones de la QA de «Qué buscar en el CV» (V80, specs/que-buscar-en-el-cv): lo que la
 * exploración encontró, cada una con su terreno propio.
 *
 *   - QA-01 (AC-02, Flujo 1.3): las formas habituales de pedir la edad o el sexo —«de 25 a 35
 *     años», «máximo 30 años», «menos de 30 años», «mayor a 40 años», «chica para…»— pasaban
 *     por el formulario y por el servidor.
 *   - QA-02 (Flujo 4.4, AC-19): con la búsqueda fallida, la nota del CV de la ficha decía
 *     «Qué buscar en el CV · buscando…» justo encima de «No se pudo buscar.».
 *   - QA-04 / QA-06 (ciclo 2, AC-02): «2 años de experiencia y menor de 35 años», «Señor para
 *     vigilancia» o «Natural de Arequipa» siguen pasando; QA-05: «Experiencia general no menor
 *     de 15 años» se rechaza como si fuera una edad.
 *
 * En el preview la IA está apagada: lo que la búsqueda habría dejado se siembra con SQL.
 */

import { expect } from '@playwright/test'

import { corte, entrarAlPanel, idDeVacante, irAVacante, VACANTES } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import { quitarLoBuscado, sembrarLoBuscado } from './ayuda-que-buscar'
import { uno } from './ayuda-pesos-con-candidatos'
import { tokenDePanel } from './ayuda-preguntas-propias'
import { crearVacante, lugarDe } from './ayuda-prueba-propia'
import {
  busquedaFallida,
  cuerpoDeLaVacante,
  guardarVacante,
  lineasVivasDe,
  MARCA_QA,
  notasDelCurriculum,
  retirarDeLaVacante,
  retirarLoDeLaQa,
} from './ayuda-que-buscar-qa'

const MOTIVO = /No se puede buscar: la edad, el sexo, el estado civil, los hijos, la salud, la religión o el origen no sirven para elegir a nadie\./
const NOMBRE = 'Regresión de lo prohibido'

let equipo: string
let llena: number

test.beforeAll(async () => {
  retirarLoDeLaQa([])
  equipo = await tokenDePanel()
  llena = await idDeVacante(VACANTES.LLENA)
  retirarDeLaVacante(llena)
})

test.afterAll(async () => {
  await limpiarSiempre([() => retirarDeLaVacante(llena), () => quitarLoBuscado(llena), () => retirarLoDeLaQa([])])
})

test('QA-01 · AC-02: las formas habituales de pedir la edad o el sexo se bloquean en el formulario y en el servidor', async ({ page }) => {
  const vacante = await crearVacante(equipo, NOMBRE, await lugarDe(equipo), undefined, MARCA_QA)
  const pidenEdadOSexo = [
    'Personas de 25 a 35 años',
    'Máximo 30 años',
    'Menos de 30 años',
    'Mayor a 40 años',
    'Chica para atención al cliente',
  ]
  for (const linea of pidenEdadOSexo) {
    const r = await guardarVacante(vacante, equipo, await cuerpoDeLaVacante(vacante, equipo, { queBuscarEnElCv: [linea] }))
    expect.soft(r.estado, `el servidor acepta «${linea}»`).toBe(400)
  }
  expect.soft(lineasVivasDe(vacante), 'alguna de esas líneas quedó guardada').toEqual([])

  // Lo que sí se puede pedir sigue pasando
  const permitidas = ['Más de 3 años de experiencia en cocina', 'Carné de salud vigente']
  const r = await guardarVacante(vacante, equipo, await cuerpoDeLaVacante(vacante, equipo, { queBuscarEnElCv: permitidas }))
  expect(r.estado).toBe(200)
  expect(lineasVivasDe(vacante)).toEqual(permitidas)

  await entrarAlPanel(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  await page.getByRole('button', { name: `Editar la vacante ${MARCA_QA} ${NOMBRE}`, exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Editar vacante' })
  await expect(modal).toBeVisible()
  const casilla = modal.getByLabel(/Qué buscar en el CV, uno por línea/)
  const vista = modal.getByRole('region', { name: 'La IA buscará esto en cada CV que llegue' })
  for (const linea of pidenEdadOSexo) {
    await casilla.fill(`Experiencia en cocina saludable\n${linea}`)
    await expect.soft(vista.getByRole('listitem').filter({ hasText: linea }), `el formulario no marca «${linea}»`)
      .toContainText(MOTIVO, { timeout: 2_000 })
    await expect.soft(page.getByRole('button', { name: 'Guardar cambios' }), `«${linea}» no apaga el guardado`)
      .toBeDisabled({ timeout: 2_000 })
  }
})

test('QA-04 · QA-05 · QA-06 · AC-02: la edad junto a la experiencia, «señor» y el origen se bloquean; 15 años de experiencia no', async ({ page }) => {
  const nombre = 'Regresión de lo prohibido, ciclo 2'
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo), undefined, MARCA_QA)
  const pidenLoProhibido = [
    '2 años de experiencia y menor de 35 años',
    'Con experiencia y mayor de 25 años',
    'Señor para vigilancia',
    'Natural de Arequipa',
  ]
  for (const linea of pidenLoProhibido) {
    const r = await guardarVacante(vacante, equipo, await cuerpoDeLaVacante(vacante, equipo, { queBuscarEnElCv: [linea] }))
    expect.soft(r.estado, `el servidor acepta «${linea}»`).toBe(400)
  }
  expect.soft(lineasVivasDe(vacante), 'alguna de esas líneas quedó guardada').toEqual([])

  // Años de experiencia, no una edad
  const deExperiencia = ['Experiencia general no menor de 15 años', 'Experiencia en cocina, al menos 15 años']
  const r = await guardarVacante(vacante, equipo, await cuerpoDeLaVacante(vacante, equipo, { queBuscarEnElCv: deExperiencia }))
  expect.soft(r.estado, 'el servidor rechaza años de experiencia como si fueran una edad').toBe(200)

  await entrarAlPanel(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  await page.getByRole('button', { name: `Editar la vacante ${MARCA_QA} ${nombre}`, exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Editar vacante' })
  await expect(modal).toBeVisible()
  const casilla = modal.getByLabel(/Qué buscar en el CV, uno por línea/)
  const vista = modal.getByRole('region', { name: 'La IA buscará esto en cada CV que llegue' })
  for (const linea of pidenLoProhibido) {
    await casilla.fill(`Experiencia en cocina saludable\n${linea}`)
    await expect.soft(vista.getByRole('listitem').filter({ hasText: linea }), `el formulario no marca «${linea}»`)
      .toContainText(MOTIVO, { timeout: 2_000 })
    await expect.soft(page.getByRole('button', { name: 'Guardar cambios' }), `«${linea}» no apaga el guardado`)
      .toBeDisabled({ timeout: 2_000 })
  }
  await casilla.fill(deExperiencia.join('\n'))
  for (const linea of deExperiencia) {
    await expect.soft(vista.getByRole('listitem').filter({ hasText: linea }), `el formulario marca «${linea}» como edad`)
      .not.toContainText(MOTIVO, { timeout: 2_000 })
  }
  await expect.soft(page.getByRole('button', { name: 'Guardar cambios' }), 'los años de experiencia apagan el guardado')
    .toBeEnabled({ timeout: 2_000 })
})

test('QA-02 · AC-19: con la búsqueda fallida, la nota del CV de la ficha no dice que está «buscando»', async ({ page }) => {
  quitarLoBuscado(llena)
  const sembrado = sembrarLoBuscado(llena)
  const nombres = [sembrado.todo, sembrado.uno, sembrado.sinTexto].map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')
  const cuarta = uno(`select p.id, trim(coalesce(pe.nombre, '') || ' ' || coalesce(pe.apellidos, '')) as nombre
                        from postulacion p join usuario u on u.id = p.usuario_id join persona pe on pe.id = u.persona_id
                       where p.vacante_id = ${llena} and pe.anonimizado_en is null
                         and trim(coalesce(pe.nombre, '') || ' ' || coalesce(pe.apellidos, '')) not in (${nombres})
                       order by p.id limit 1`)
  busquedaFallida(Number(cuarta.id))
  notasDelCurriculum(Number(cuarta.id), 70)

  await entrarAlPanel(page)
  await irAVacante(page, VACANTES.LLENA)
  await corte(page, 'Toda la tanda').click()
  await page.getByRole('table').getByRole('button', { name: String(cuarta.nombre), exact: true }).click()
  const bloque = page.getByRole('region', { name: 'Qué buscar en el CV' })
  await expect(bloque).toContainText('No se pudo buscar.')
  await expect(bloque).toContainText('Nota del CV')
  await expect(bloque).not.toContainText('buscando…')
})
