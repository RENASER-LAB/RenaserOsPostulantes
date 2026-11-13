/**
 * QA de «Qué buscar en el CV» (V80, specs/que-buscar-en-el-cv): los recorridos de la
 * Verificación que no cubre `63-que-buscar-en-el-cv.spec.ts`. Las regresiones de lo que encontró
 * la exploración van aparte, en `63-que-buscar-en-el-cv-qa-regresiones.spec.ts`.
 *
 *   1. Crear la vacante desde el formulario: la vista previa, la 7 y la 8 tachadas, lo prohibido
 *      que apaga el botón y las tres que se guardan (AC-01, AC-03).
 *   2. El servidor: 400 con lo prohibido o larguísimo, «Carné de salud» sí, seis de ocho y el
 *      campo ausente que no borra nada (AC-02, AC-03).
 *   4. Con candidatos calificados de verdad: la nota del CV con lo buscado (AC-08), la ficha con
 *      sus pesos (AC-18) y el cambio a la versión de 30 (AC-22).
 *   5. Nada llega al candidato: portal, «Mis procesos» y su detalle (AC-05).
 *   6. Cambiar solo las líneas no avisa ni toca el contexto de WhatsApp; sin el campo no cambian
 *      (AC-04), y la nota vuelve a los criterios generales (AC-13).
 *   7. Editar con candidatos dentro desde el panel: la confirmación, el doble clic y lo archivado
 *      (AC-13).
 *   8. «Volver a buscar» con y sin `ajustar_nota` (AC-19).
 *   9. El Excel de verdad, bajado del panel con «Por lo buscado» (AC-20).
 *
 * En el preview la IA está apagada: lo que la búsqueda habría guardado se siembra con SQL.
 */

import { expect, type Locator, type Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { API, corte, entrarAlPanel, idDeVacante, irAVacante, nombresVisibles, VACANTES } from './ayuda'
import { test } from './ayuda-candidato'
import { configuracion, limpiarSiempre, sql } from './base-de-datos'
import { quitarLoBuscado, sembrarLoBuscado, type Sembrado } from './ayuda-que-buscar'
import {
  candidatoCalificado,
  consultar,
  crearVersionDePesos,
  equipoSin,
  exigir,
  loQueNoSeMueve,
  notaDe,
  uno,
  vacanteConPreguntasYPrueba,
  versionDeLaVacante,
  type Candidato,
} from './ayuda-pesos-con-candidatos'
import { entrarAlPanelCon, entrarAlPortalCon, tokenDePanel } from './ayuda-preguntas-propias'
import { excelPorLaApi } from './ayuda-rubrica-vigente'
import {
  busquedaFallida,
  cuerpoDeLaVacante,
  filaDelRanking,
  fotoDeLoBuscado,
  guardarVacante,
  leerLaHoja,
  lineasVivasDe,
  MARCA_QA,
  notasDelCurriculum,
  retirarDeLaVacante,
  retirarLoDeLaQa,
  sembrarBusqueda,
  solicitudAprobada,
} from './ayuda-que-buscar-qa'

test.describe.configure({ mode: 'serial' })

const MOTIVO = /No se puede buscar: la edad, el sexo, el estado civil, los hijos, la salud, la religión o el origen no sirven para elegir a nadie\./
const TITULO_ALTA = `${MARCA_QA} Chef de cocina`
/** Marcas que no salen en ningún otro texto: buscarlas en el portal es buscar la línea. */
const LINEAS_CHEF = [
  'ZQB80 Experiencia en cocina saludable',
  'ZQB80 Ha dirigido un equipo de cocina',
  'ZQB80 Controla costos y mermas',
  'ZQB80 Certificado de manipulación de alimentos',
] as const
const FRASE_ANA = 'FQB80 frase de Ana'
const SECRETOS = ['ZQB80', 'FQB80', 'NQB80', 'PQB80']
/** Los pesos del currículum: resultados y personas, mitad y mitad; los demás criterios, 0. */
const REPARTO = {
  pruebaPuesto: 30,
  validacion: 15,
  cv: 12,
  evaluacion: 28,
  curriculum: { CV_RESULTADOS: 50, CV_PERSONAS: 50 },
  simulacion: {},
}

const correos: string[] = []
let equipo: string
let vacanteAlta: number
let vacanteChef: number
let pesos30: { id: number; etiqueta: string }
let ana: Candidato
let beto: Candidato
let llena: number

const PANEL = configuracion().E2E_PORTAL
const CARPETA = mkdtempSync(join(tmpdir(), 'qa-qb-80-'))

const casillaDe = (raiz: Page | Locator) => raiz.getByLabel(/Qué buscar en el CV, uno por línea/)
const vistaPrevia = (raiz: Page | Locator) =>
  raiz.getByRole('region', { name: 'La IA buscará esto en cada CV que llegue' })

async function abrirLaTuerca(page: Page, vacante: number) {
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
  const cajon = page.getByRole('region', { name: 'Configuración de la vacante' })
  if (!(await cajon.isVisible())) await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
  await expect(cajon).toBeVisible()
}

async function abrirLaEdicion(page: Page, titulo: string) {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  await page.getByRole('button', { name: `Editar la vacante ${titulo}`, exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Editar vacante' })
  await expect(modal).toBeVisible()
  return modal
}

const avisosDe = (vacante: number): number =>
  Number(uno(`select count(*) as n from aviso_portal where vacante_id = ${vacante}`).n)
const contextoDe = (vacante: number): string | null =>
  (uno(`select contexto_actualizado_en::text as c from vacante where id = ${vacante}`).c as string | null) ?? null

test.beforeAll(async () => {
  test.setTimeout(180_000)
  retirarLoDeLaQa([])
  equipo = await tokenDePanel()
  llena = await idDeVacante(VACANTES.LLENA)
  retirarDeLaVacante(llena)
})

test.afterAll(async () => {
  test.setTimeout(180_000)
  await limpiarSiempre([() => retirarDeLaVacante(llena), () => quitarLoBuscado(llena), () => retirarLoDeLaQa(correos)])
})

test('AC-01 · AC-03: crear la vacante con líneas: la vista previa cuenta, tacha la 7 y la 8 y se guardan las válidas', async ({ page }) => {
  await solicitudAprobada(equipo)
  await entrarAlPanel(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  await page.getByRole('button', { name: 'Crear vacante' }).click()

  const solicitud = page.getByLabel('Solicitud aprobada que la respalda')
  const valor = await solicitud.locator('option', { hasText: TITULO_ALTA }).getAttribute('value')
  await solicitud.selectOption(valor!)
  await page.getByLabel('Responsable del proceso').selectOption({ index: 1 })
  await page.getByLabel('Título que ve quien postula').fill(TITULO_ALTA)
  await page.getByLabel('Descripción').fill('Lleva la cocina de un restaurante de comida saludable.')

  // La casilla privada, con su chip y sin nada todavía
  await expect(page.getByText('Solo lo ve tu equipo')).toBeVisible()
  await expect(vistaPrevia(page)).toContainText('Nada todavía. Sin líneas, la ficha no muestra el checklist.')
  await expect(vistaPrevia(page)).toContainText('0 de 6 como máximo')

  // Ocho válidas, con una vacía y una repetida que no cuentan: la 7 y la 8 salen tachadas
  await casillaDe(page).fill(
    'Uno cocina saludable\n\nDos dirige equipos\n  dos DIRIGE   equipos \nTres costos y mermas\n' +
      'Carné de salud vigente\nCinco inventarios\nSeis inglés\nSiete pastelería\nOcho panadería',
  )
  await expect(vistaPrevia(page)).toContainText('6 de 6 como máximo')
  const lineas = vistaPrevia(page).getByRole('listitem')
  await expect(lineas).toHaveCount(8)
  for (const sobra of ['Siete pastelería', 'Ocho panadería']) {
    const fila = lineas.filter({ hasText: sobra })
    await expect(fila).toContainText('No se buscará: el máximo es 6.')
    const tachada = await fila.evaluate((li) =>
      [li, ...li.querySelectorAll('*')].some((e) => getComputedStyle(e).textDecorationLine.includes('line-through')))
    expect(tachada, `«${sobra}» sale tachada`).toBe(true)
  }
  await expect(page.getByRole('button', { name: 'Crear en borrador' })).toBeEnabled()

  // Una prohibida sale en rojo con el motivo y apaga el botón
  await casillaDe(page).fill('Experiencia en cocina saludable\nMenor de 35 años')
  await expect(vistaPrevia(page).getByRole('listitem').filter({ hasText: 'Menor de 35 años' })).toContainText(MOTIVO)
  await expect(page.getByRole('button', { name: 'Crear en borrador' })).toBeDisabled()

  // Tres válidas: «3 de 6 como máximo», y se guardan las tres
  const tres = ['Experiencia en cocina saludable', 'Ha dirigido un equipo de cocina', 'Carné de salud vigente']
  await casillaDe(page).fill(tres.join('\n'))
  await expect(vistaPrevia(page)).toContainText('3 de 6 como máximo')
  await page.getByLabel('Modalidad').selectOption({ label: 'Presencial' })
  await page.getByLabel('Ciudad').selectOption({ label: 'Lima' })
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/panel/vacantes') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Crear en borrador' }).click()
  const creada = await respuesta
  expect(creada.status()).toBe(201)
  vacanteAlta = Number(((await creada.json()) as { id: number }).id)
  expect(lineasVivasDe(vacanteAlta)).toEqual(tres)
})

test('AC-02 · AC-03: el servidor rechaza lo prohibido y lo larguísimo, acepta «Carné de salud» y guarda seis de ocho', async () => {
  const antes = lineasVivasDe(vacanteAlta)
  const con = async (lineas: string[] | undefined) =>
    guardarVacante(vacanteAlta, equipo, await cuerpoDeLaVacante(vacanteAlta, equipo,
      lineas === undefined ? {} : { queBuscarEnElCv: lineas }))

  for (const lineas of [['Cocina saludable', 'Menor de 35 años'], ['Cocina saludable', 'Que sea casado'], ['x'.repeat(201)]]) {
    const r = await con(lineas)
    expect(r.estado, `«${lineas.join(' / ').slice(0, 40)}» es un 400`).toBe(400)
    expect(lineasVivasDe(vacanteAlta)).toEqual(antes)
  }
  expect(JSON.stringify((await con(['Que sea casado'])).cuerpo)).toMatch(MOTIVO)

  expect((await con(['Carné de salud vigente', 'Carné sanitario'])).estado).toBe(200)
  expect(lineasVivasDe(vacanteAlta)).toEqual(['Carné de salud vigente', 'Carné sanitario'])

  const ocho = Array.from({ length: 8 }, (_, i) => `Línea ${i + 1} de cocina`)
  expect((await con(['  Línea 1 de cocina  ', '', ...ocho])).estado).toBe(200)
  expect(lineasVivasDe(vacanteAlta)).toEqual(ocho.slice(0, 6))

  // Un cuerpo sin el campo no las toca
  const sinCampo = await con(undefined)
  expect(sinCampo.estado).toBe(200)
  expect((sinCampo.cuerpo as { huboCambios: boolean }).huboCambios).toBe(false)
  expect(lineasVivasDe(vacanteAlta)).toEqual(ocho.slice(0, 6))
})

test('AC-08 · AC-18 · AC-22: con candidatos calificados, la nota del CV lleva lo buscado y el cambio a la versión de 30 lo recalcula', async ({ page }) => {
  test.setTimeout(240_000)
  const pesos25 = crearVersionDePesos(MARCA_QA, 'Pesos con 25', REPARTO)
  pesos30 = crearVersionDePesos(MARCA_QA, 'Pesos con 30', REPARTO)
  sql(`update version_pesos set peso_busqueda_cv = 30 where id = ${pesos30.id};`)
  expect(Number(uno(`select peso_busqueda_cv from version_pesos where id = ${pesos25.id}`).peso_busqueda_cv)).toBe(25)

  vacanteChef = await vacanteConPreguntasYPrueba(equipo, MARCA_QA, 'Chef con candidatos', pesos25.id)
  ana = await candidatoCalificado(equipo, MARCA_QA, vacanteChef, 'Ana', { resultados: 80, personas: 40, abierta: 70 }, correos)
  beto = await candidatoCalificado(equipo, MARCA_QA, vacanteChef, 'Beto', { resultados: 90, personas: 10, abierta: 60 }, correos)
  // Ana: lo tiene, lo tiene, lo menciona, no aparece → lo buscado 62,5. Beto, sin buscar.
  sembrarBusqueda(vacanteChef, LINEAS_CHEF, ana.postulacion, ['TIENE', 'TIENE', 'MENCIONA', 'NO_APARECE'], FRASE_ANA)

  // AC-08: criterios generales 60 × 0,75 + 62,5 × 0,25 = 60,625; sin búsqueda, los generales solos
  const filaAna = await filaDelRanking(vacanteChef, ana.postulacion, equipo)
  expect(filaAna.notaCurriculum).toBeCloseTo(60.625, 3)
  expect(filaAna.busqueda).toMatchObject({ estado: 'TERMINADA', tiene: 2, total: 4 })
  const filaBeto = await filaDelRanking(vacanteChef, beto.postulacion, equipo)
  expect(filaBeto.notaCurriculum).toBeCloseTo(50, 3)
  expect(filaBeto.busqueda).toMatchObject({ estado: 'PENDIENTE' })

  // AC-18: la ficha con el recuento y los pesos de la versión
  await entrarAlPanelCon(page, equipo)
  await page.goto(`/admin/vacantes/${vacanteChef}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible({ timeout: 20_000 })
  await corte(page, 'Toda la tanda').click()
  await page.getByRole('table').getByRole('button', { name: ana.nombre, exact: true }).click()
  const bloque = page.getByRole('region', { name: 'Qué buscar en el CV' })
  await expect(bloque).toContainText('2 de 4')
  await expect(bloque).toContainText('pesan 75 %')
  await expect(bloque).toContainText('pesa 25 %')
  await expect(bloque).toContainText(`«${FRASE_ANA} 1»`)
  await expect(bloque).toContainText('Lo menciona, sin detalle')
  await expect(bloque.getByText('Para la entrevista:')).toHaveCount(2)

  // AC-22: la confirmación enseña «Qué buscar en el CV 25 % → 30 %» y recalcula sin mover a nadie
  const quieto = loQueNoSeMueve(vacanteChef)
  await abrirLaTuerca(page, vacanteChef)
  await page.getByLabel('Qué pesos rigen la decisión').selectOption(String(pesos30.id))
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText(`¿Cambiar a «${pesos30.etiqueta}»?`)
  const fila = dialogo.getByRole('row').filter({ hasText: 'Qué buscar en el CV' })
  await expect(fila.getByRole('cell')).toHaveText(['25 %', '30 %'])
  await dialogo.getByRole('button', { name: 'Cambiar y recalcular' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Pesos cambiados' }))
    .toHaveText('Pesos cambiados: se recalcularon 2 personas.', { timeout: 30_000 })
  expect(versionDeLaVacante(vacanteChef)).toBe(pesos30.id)
  expect(loQueNoSeMueve(vacanteChef)).toBe(quieto)

  // 60 × 0,7 + 62,5 × 0,3 = 60,75 en el ranking, y el Perfil Integral con ese mismo número:
  // (60,75 × 12 + 70 × 28) / 40 = 67,225
  expect((await filaDelRanking(vacanteChef, ana.postulacion, equipo)).notaCurriculum).toBeCloseTo(60.75, 3)
  expect(notaDe(ana.postulacion, 'PERFIL_INTEGRAL')).toBeCloseTo(67.225, 1)
  expect(notaDe(beto.postulacion, 'PERFIL_INTEGRAL')).toBeCloseTo((50 * 12 + 60 * 28) / 40, 1)
})

test('AC-05: ni las líneas ni lo encontrado llegan al portal, a «Mis procesos» ni a su detalle', async ({ page }) => {
  const sinSecretos = (texto: string, donde: string) => {
    for (const s of SECRETOS) expect(texto, `${donde} enseña «${s}»`).not.toContain(s)
  }
  for (const ruta of ['/portal/vacantes', `/portal/vacantes/${vacanteChef}`]) {
    const r = await fetch(`${API}${ruta}`)
    expect(r.ok).toBe(true)
    sinSecretos(await r.text(), ruta)
  }
  const procesos = await fetch(`${API}/portal/postulaciones`, { headers: { Authorization: `Bearer ${ana.token}` } })
  expect(procesos.ok).toBe(true)
  sinSecretos(await procesos.text(), '/portal/postulaciones')

  await entrarAlPortalCon(page, ana.token)
  for (const ruta of ['/procesos', `/procesos/${ana.uuid}`, `/vacantes/${vacanteChef}`]) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
    await page.waitForLoadState('networkidle')
    sinSecretos(await page.locator('body').innerText(), ruta)
  }
})

test('AC-04 · AC-13: cambiar solo las líneas no avisa ni toca el contexto de WhatsApp, y sin el campo no cambian', async () => {
  const avisos = avisosDe(vacanteChef)
  const contexto = contextoDe(vacanteChef)
  const nuevas = ['ZQB80 Experiencia en cocina saludable', 'ZQB80 Maneja inventarios']

  // Con CV calificados, sin confirmar es un 409 y no cambia nada
  const sinConfirmar = await guardarVacante(vacanteChef, equipo,
    await cuerpoDeLaVacante(vacanteChef, equipo, { queBuscarEnElCv: nuevas }))
  expect(sinConfirmar.estado).toBe(409)
  expect(lineasVivasDe(vacanteChef)).toEqual([...LINEAS_CHEF])

  const r = await guardarVacante(vacanteChef, equipo,
    await cuerpoDeLaVacante(vacanteChef, equipo, { queBuscarEnElCv: nuevas, confirmarNuevaBusqueda: true }))
  expect(r.estado).toBe(200)
  expect(r.cuerpo).toMatchObject({ huboCambios: true, postulantesAvisados: 0 })
  expect(lineasVivasDe(vacanteChef)).toEqual(nuevas)
  expect(avisosDe(vacanteChef)).toBe(avisos)
  expect(contextoDe(vacanteChef)).toBe(contexto)
  // Lo de Ana se archivó: su nota del CV vuelve a los criterios generales
  expect((await filaDelRanking(vacanteChef, ana.postulacion, equipo)).notaCurriculum).toBeCloseTo(60, 3)

  // Un formulario que no manda el campo no las borra
  const sinCampo = await guardarVacante(vacanteChef, equipo, await cuerpoDeLaVacante(vacanteChef, equipo, {}))
  expect(sinCampo.estado).toBe(200)
  expect(lineasVivasDe(vacanteChef)).toEqual(nuevas)
  expect(avisosDe(vacanteChef)).toBe(avisos)
})

test('AC-13: editar las líneas con candidatos dentro desde el panel: una sola petición al doble clic, lo viejo archivado y nadie movido', async ({ page }) => {
  quitarLoBuscado(llena)
  const sembrado: Sembrado = sembrarLoBuscado(llena)
  const antes = fotoDeLoBuscado(llena)
  const quieto = loQueNoSeMueve(llena)
  const { cvsParaVolverABuscar } = await exigir<{ cvsParaVolverABuscar: number }>(
    `/panel/vacantes/${llena}/que-buscar-en-el-cv`, equipo)
  expect(cvsParaVolverABuscar).toBeGreaterThanOrEqual(2)

  await entrarAlPanel(page)
  const modal = await abrirLaEdicion(page, VACANTES.LLENA)
  const nuevas = ['QA-QB-80 Experiencia en cocina saludable', 'QA-QB-80 Dirige equipos']
  await casillaDe(modal).fill(nuevas.join('\n'))
  const puts: unknown[] = []
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().endsWith(`/panel/vacantes/${llena}`)) puts.push(r.postDataJSON())
  })
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  const pregunta = page.getByRole('alertdialog', { name: `¿Volver a buscar en ${cvsParaVolverABuscar} CV?` })
  await expect(pregunta).toContainText('Las notas del CV se recalculan al terminar.')
  await expect(pregunta).toContainText('No cambia nadie de etapa.')
  await pregunta.getByRole('button', { name: 'Guardar y volver a buscar' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Cambios guardados' }))
    .toHaveText(`Cambios guardados. Volvemos a buscar en ${cvsParaVolverABuscar} CV`)
  expect(puts).toHaveLength(1)
  expect(puts[0]).toMatchObject({ queBuscarEnElCv: nuevas, confirmarNuevaBusqueda: true })

  const despues = fotoDeLoBuscado(llena)
  expect(despues.vivas.map((l) => l.texto)).toEqual(nuevas)
  expect(despues.vivas.every((l) => l.version === antes.vivas[0]!.version + 1)).toBe(true)
  expect(despues.archivadas).toBe(antes.archivadas + antes.vivas.length)
  expect(despues.resultadosVivos).toBe(0)
  expect(despues.resultadosArchivados).toBe(antes.resultadosArchivados + antes.resultadosVivos)
  // El «CV sin texto» pasa a la versión nueva sin volver a mirarlo
  expect(despues.busquedasVivas).toEqual([
    expect.objectContaining({ estado: 'SIN_TEXTO', version: antes.vivas[0]!.version + 1 }),
  ])
  expect(loQueNoSeMueve(llena)).toBe(quieto)
  const auditoria = uno(`select valor_anterior::text as antes, valor_nuevo::text as despues from auditoria
                          where accion = 'editar_que_buscar_en_el_cv' and entidad_id = ${llena}
                          order by id desc limit 1`)
  expect(JSON.parse(String(auditoria.antes))).toEqual({ lineas: antes.vivas.map((l) => l.texto) })
  expect(JSON.parse(String(auditoria.despues))).toEqual({ lineas: nuevas, personasABuscar: cvsParaVolverABuscar })

  // En el ranking, quien estaba buscado vuelve a «pendiente» y el CV sin texto sigue igual
  await irAVacante(page, VACANTES.LLENA)
  await corte(page, 'Toda la tanda').click()
  const tabla = page.getByRole('table')
  await expect(tabla.getByRole('row').filter({ hasText: sembrado.todo })).toContainText(/Requisitos pendientes|Buscando requisitos/)
  await expect(tabla.getByRole('row').filter({ hasText: sembrado.sinTexto })).toContainText('CV sin texto')
})

test('AC-19: con la búsqueda fallida, «Volver a buscar» sale con ajustar_nota y manda una sola petición; sin el permiso, ni botón ni API', async ({ page, browser }) => {
  quitarLoBuscado(llena)
  retirarDeLaVacante(llena)
  const sembrado = sembrarLoBuscado(llena)
  const cuarta = uno(`select p.id, trim(coalesce(pe.nombre, '') || ' ' || coalesce(pe.apellidos, '')) as nombre
                        from postulacion p join usuario u on u.id = p.usuario_id join persona pe on pe.id = u.persona_id
                       where p.vacante_id = ${llena} and pe.anonimizado_en is null
                         and trim(coalesce(pe.nombre, '') || ' ' || coalesce(pe.apellidos, '')) not in
                             (${[sembrado.todo, sembrado.uno, sembrado.sinTexto].map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')})
                       order by p.id limit 1`)
  const fallida = { id: Number(cuarta.id), nombre: String(cuarta.nombre) }
  busquedaFallida(fallida.id)
  notasDelCurriculum(fallida.id, 70)

  await entrarAlPanel(page)
  await irAVacante(page, VACANTES.LLENA)
  await corte(page, 'Toda la tanda').click()
  await expect(page.getByRole('table').getByRole('row').filter({ hasText: fallida.nombre })).toContainText('No se pudo buscar')
  await page.getByRole('table').getByRole('button', { name: fallida.nombre, exact: true }).click()
  const bloque = page.getByRole('region', { name: 'Qué buscar en el CV' })
  await expect(bloque).toContainText('No se pudo buscar.')
  await expect(bloque).toContainText('Nota del CV')

  const posts: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith(`/postulaciones/${fallida.id}/busqueda-cv`)) posts.push(r.url())
  })
  await bloque.getByRole('button', { name: 'Volver a buscar' }).dblclick()
  await expect(bloque.getByRole('status')).not.toHaveText('', { timeout: 10_000 })
  expect(posts).toHaveLength(1)

  // Sin ajustar_nota: el botón no sale y la API contesta 403
  const sinPermiso = await tokenDePanel(equipoSin(MARCA_QA, 'sin-ajustar', ['ajustar_nota']))
  const directo = await fetch(`${API}/panel/postulaciones/${fallida.id}/busqueda-cv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sinPermiso}` },
  })
  expect(directo.status).toBe(403)
  const contexto = await browser.newContext({ baseURL: PANEL })
  try {
    const otra = await contexto.newPage()
    await entrarAlPanelCon(otra, sinPermiso)
    await otra.goto(`/admin/vacantes/${llena}`)
    await expect(otra.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible({ timeout: 20_000 })
    await otra.getByRole('group', { name: 'Qué filas se ven' }).getByRole('button', { name: /^Toda la tanda/ }).click()
    await otra.getByRole('table').getByRole('button', { name: fallida.nombre, exact: true }).click()
    const suyo = otra.getByRole('region', { name: 'Qué buscar en el CV' })
    await expect(suyo).toContainText('No se pudo buscar.')
    await expect(suyo.getByRole('button', { name: 'Volver a buscar' })).toHaveCount(0)
  } finally {
    await contexto.close()
  }
})

test('AC-20: el Excel bajado del panel con «Por lo buscado» trae la columna tras «Teléfono», el orden de la pantalla y el pie', async ({ page }) => {
  quitarLoBuscado(llena)
  retirarDeLaVacante(llena)
  const sembrado = sembrarLoBuscado(llena)

  await entrarAlPanel(page)
  await irAVacante(page, VACANTES.LLENA)
  await corte(page, 'Toda la tanda').click()
  await page.getByRole('group', { name: 'Orden' }).getByRole('button', { name: 'Por lo buscado' }).click()
  const enPantalla = await nombresVisibles(page)
  expect(enPantalla.slice(0, 2)).toEqual([sembrado.todo, sembrado.uno])

  const boton = page.getByRole('button', { name: `Descargar Excel (${enPantalla.length})` })
  const espera = page.waitForEvent('download', { timeout: 30_000 })
  await boton.click()
  const descarga = await espera
  const ruta = join(CARPETA, `${Date.now()}-${descarga.suggestedFilename()}`)
  await descarga.saveAs(ruta)
  const libro = leerLaHoja(ruta)

  const telefono = libro.cabeceras.indexOf('Teléfono')
  expect(telefono).toBeGreaterThan(-1)
  expect(libro.cabeceras[telefono + 1]).toBe('Qué buscar en el CV')
  expect(libro.filas.map((f) => f[1])).toEqual(enPantalla)
  const columna = (nombre: string) => libro.filas.find((f) => f[1] === nombre)![telefono + 1]
  expect(columna(sembrado.todo)).toBe('4 de 4')
  expect(columna(sembrado.uno)).toBe('1 de 4')
  expect(columna(sembrado.sinTexto)).toBe('CV sin texto')
  for (const otro of enPantalla.filter((n) => ![sembrado.todo, sembrado.uno, sembrado.sinTexto].includes(n))) {
    expect(columna(otro)).toBe('Pendiente')
  }
  expect(libro.pie.join(' ')).toContain('Orden: por lo buscado')

  // Sin líneas en la vacante, la columna no sale
  const otra = await idDeVacante(VACANTES.SIN_PRETENSION)
  const ids = consultar(`select id from postulacion where vacante_id = ${otra} order by id`).map((f) => Number(f.id))
  const ruta2 = join(CARPETA, `${Date.now()}-sin-lineas.xlsx`)
  writeFileSync(ruta2, await excelPorLaApi(otra, 'PERFIL_INTEGRAL', ids))
  expect(leerLaHoja(ruta2).cabeceras).not.toContain('Qué buscar en el CV')
})
