import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  consultar,
  cuentaDeCandidato,
  empezarEvaluacion,
  entrarAlPanelCon,
  entrarAlPortalCon,
  escribirBorrador,
  estadoDeLaPostulacion,
  exigir,
  pedir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  responder,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, MARCA, publicarPrueba, retirarLoSembrado } from './ayuda-prueba-propia'

/**
 * QA de `specs/Ready/perfil-integral-hasta-el-cierre-de-la-vacante` (V78): lo que la exploración
 * recorrió a mano y `61-perfil-hasta-el-cierre.spec.ts` no cubre.
 *
 *   1. Editar una vacante publicada (Flujo 1.3): pasar a «Fecha límite» un día 1, guardar sin
 *      tocar nada no audita, un día pasado se rechaza y volver a Permanente quita la fecha.
 *   2. «Mis procesos» y la campana tampoco hablan de plazos; cerrada la vacante, «Empezar» y
 *      «Entregar» desde la pantalla dicen que se cerró (AC-05, AC-09, AC-12).
 *   3. Un borrador con la fecha ya pasada no se publica ni se cierra solo (casos límite).
 *   4. El día de Lima con el navegador en otro huso (Kiritimati, UTC+14): «hoy en Lima» vale,
 *      «ayer en Lima» no, y lo guardado y lo pintado son el mismo día.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira con la marca de la suite (QA-PE-0067).
 */

const PREGUNTA = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
const RESPUESTA = 'En marzo la caja no cuadraba por 1.200 soles; lo hallé en dos días revisando los vales.'
const VACANTE_CERRADA = 'La vacante se cerró y esta evaluación ya no se puede responder.'
const DIA_PASADO = 'Esa fecha ya pasó: elige un día a partir de hoy.'
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const KIRITIMATI = 'Pacific/Kiritimati'

const correos: string[] = []
let equipo = ''

/** Un día de Lima a tantos días de hoy, como lo escribe el selector: «2026-10-31». */
function diaDeLimaEn(dias: number): string {
  return new Date(Date.now() - 5 * 3_600_000 + dias * 24 * 3_600_000).toISOString().slice(0, 10)
}

/** El día 1 del mes que viene, en Lima: siempre futuro, y el que más fácil se corre de día. */
function primeroDelMesQueViene(): string {
  const [anio, mes] = diaDeLimaEn(0).split('-').map(Number) as [number, number]
  return new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10)
}

/** Las 23:59:59 de Lima de ese día, como la guarda el servidor. */
const finDelDiaEnLima = (dia: string) => new Date(`${dia}T23:59:59-05:00`).toISOString()

/** «mar 01/12, 23:59», como lo pinta el panel. */
function fechaCorta(dia: string): string {
  const [anio, mes, numero] = dia.split('-').map(Number) as [number, number, number]
  const semana = DIAS[new Date(Date.UTC(anio, mes - 1, numero)).getUTCDay()]
  return `${semana} ${String(numero).padStart(2, '0')}/${String(mes).padStart(2, '0')}, 23:59`
}

const cierreGuardado = (vacante: number) =>
  uno(`select tipo_cierre, to_json(cierra_en) as cierra_en from vacante where id = ${vacante}`)

const ediciones = (vacante: number): number =>
  consultar(`select id from auditoria where accion = 'editar_vacante' and entidad = 'vacante' and entidad_id = ${vacante}`)
    .length

/** Una vacante lista para publicar: sus preguntas propias (una abierta) y la prueba del editor. */
async function vacanteLista(nombre: string): Promise<number> {
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await escribirBorrador(
    equipo,
    vacante,
    [{ nombre: 'General', preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA, puntos: 100, queDebeTener: 'El monto.' }] }],
    'Mira el monto y la causa.',
  )
  await publicarPreguntas(equipo, vacante)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre?', queDebeTener: 'La cuenta.' }],
      },
    ],
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  return vacante
}

async function vacantePublicada(nombre: string): Promise<number> {
  const vacante = await vacanteLista(nombre)
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  return vacante
}

/** Abre el lápiz de la vacante desde el listado y devuelve el diálogo. */
async function editar(page: Page, titulo: string) {
  await page.goto('/admin')
  await page.getByRole('button', { name: `Editar la vacante ${titulo}` }).click()
  const dialogo = page.getByRole('dialog', { name: 'Editar vacante' })
  await expect(dialogo.getByLabel('Cómo se cierra', { exact: true })).toBeEnabled({ timeout: 20_000 })
  return dialogo
}

async function guardar(page: Page, aviso: string | RegExp) {
  await page.getByRole('dialog', { name: 'Editar vacante' }).getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status').filter({ hasText: aviso })).toBeVisible({ timeout: 15_000 })
}

/** Nada en la página habla de un plazo del Perfil Integral. */
async function sinNingunPlazo(page: Page) {
  await expect(page.getByText(/para entregarla|Se entrega hoy|Queda poco plazo|vence el/)).toHaveCount(0)
  await expect(page.getByText(/^Quedan \d/)).toHaveCount(0)
  await expect(page.getByText(/\b\d+ días?\b/)).toHaveCount(0)
}

test.afterAll(async () => {
  await limpiarSiempre([() => retirarLoSembrado(correos)])
})

test.describe('QA · el Perfil Integral dura hasta el cierre (V78)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
  })

  test('1 · editar la publicada: «Fecha límite» un día 1, sin cambios no audita, un día pasado no, y a Permanente (Flujo 1.3, AC-02, AC-03)', async ({ page }) => {
    const nombre = 'Editar el cierre (V78 QA)'
    const titulo = `${MARCA} ${nombre}`
    const vacante = await vacantePublicada(nombre)
    const dia = primeroDelMesQueViene()
    await entrarAlPanelCon(page, equipo)

    let dialogo = await editar(page, titulo)
    const cierre = dialogo.getByLabel('Cómo se cierra', { exact: true })
    await expect(cierre.locator('option')).toHaveText(['Permanente', 'Fecha límite'])
    await expect(cierre).toHaveValue('PERMANENTE')
    await expect(dialogo.getByText(/plazas/i)).toHaveCount(0)
    await cierre.selectOption('FECHA')
    await dialogo.getByLabel('Fecha de cierre').fill(dia)
    await guardar(page, /^Cambios guardados/)
    expect(cierreGuardado(vacante)).toEqual({ tipo_cierre: 'FECHA', cierra_en: expect.any(String) })
    expect(new Date(String(cierreGuardado(vacante).cierra_en)).toISOString()).toBe(finDelDiaEnLima(dia))

    await page.goto(`/admin/vacantes/${vacante}`)
    await expect(page.getByText(`se cierra el ${fechaCorta(dia)}`)).toBeVisible({ timeout: 20_000 })

    // El selector vuelve con el mismo día de Lima —no el siguiente, que es el día UTC de las
    // 23:59:59 de Lima— y guardar sin tocar nada no es un cambio
    dialogo = await editar(page, titulo)
    await expect(dialogo.getByLabel('Fecha de cierre')).toHaveValue(dia)
    const antes = ediciones(vacante)
    await guardar(page, 'No había cambios que guardar')
    expect(ediciones(vacante)).toBe(antes)

    // Un día que ya pasó no se guarda, tampoco al editar
    dialogo = await editar(page, titulo)
    await dialogo.getByLabel('Fecha de cierre').fill(diaDeLimaEn(-1))
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByRole('alert').filter({ hasText: DIA_PASADO })).toBeVisible()
    expect(new Date(String(cierreGuardado(vacante).cierra_en)).toISOString()).toBe(finDelDiaEnLima(dia))

    // Y de vuelta a Permanente: la fecha deja de regir y la cabecera ya no la dice
    await dialogo.getByLabel('Cómo se cierra', { exact: true }).selectOption('PERMANENTE')
    await expect(dialogo.getByLabel('Fecha de cierre')).toHaveCount(0)
    await guardar(page, /^Cambios guardados/)
    expect(cierreGuardado(vacante)).toEqual({ tipo_cierre: 'PERMANENTE', cierra_en: null })
    await page.goto(`/admin/vacantes/${vacante}`)
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/se cierra el/)).toHaveCount(0)
  })

  test('2 · «Mis procesos» y la campana no dicen plazos; cerrada la vacante, «Empezar» y «Entregar» dicen que se cerró (AC-05, AC-09, AC-12)', async ({ page, browser }) => {
    const vacante = await vacantePublicada('Cierre con la pantalla abierta (V78 QA)')

    const ana = await cuentaDeCandidato('Ana', correos)
    const uuidAna = await postular(ana.token, vacante)
    const beto = await cuentaDeCandidato('Beto', correos)
    const uuidBeto = await postular(beto.token, vacante)
    await empezarEvaluacion(beto.token, uuidBeto)
    const pregunta = Number(
      uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
            where p.uuid = ${literal(uuidBeto)}`).pregunta_id,
    )
    await responder(beto.token, uuidBeto, pregunta, { texto: RESPUESTA })

    // Ana, sin empezar: ni «Mis procesos» ni la campana hablan de días ni de plazos
    await entrarAlPortalCon(page, ana.token)
    await page.goto('/procesos')
    await expect(page.getByRole('link', { name: /evaluación/i }).first()).toBeVisible({ timeout: 20_000 })
    await sinNingunPlazo(page)
    await page.getByRole('button', { name: /^Avisos/ }).click()
    const avisos = page.getByRole('dialog', { name: 'Tus avisos' })
    await expect(avisos.getByText(/Te toca tu evaluación/)).toBeVisible()
    await expect(avisos.getByText(/d[ií]as|plazo|vence/i)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.goto(`/procesos/${uuidAna}/evaluacion`)
    await expect(page.getByRole('button', { name: /Empezar evaluación/ })).toBeVisible({ timeout: 20_000 })
    await sinNingunPlazo(page)

    // Beto tiene la evaluación respondida y abierta, sin entregar
    const contextoDeBeto = await browser.newContext()
    const paginaDeBeto = await contextoDeBeto.newPage()
    await entrarAlPortalCon(paginaDeBeto, beto.token)
    await paginaDeBeto.goto(`/procesos/${uuidBeto}/evaluacion`)
    await expect(paginaDeBeto.getByLabel('Tu respuesta')).toHaveValue(RESPUESTA, { timeout: 20_000 })
    await sinNingunPlazo(paginaDeBeto)

    // El equipo cierra la vacante con las dos pantallas abiertas
    await exigir(`/panel/vacantes/${vacante}/cierre`, equipo, 'POST', { motivo: `${MARCA} ya contratamos` })

    await page.getByRole('button', { name: /Empezar evaluación/ }).click()
    await expect(page.getByText(VACANTE_CERRADA)).toBeVisible({ timeout: 15_000 })

    await paginaDeBeto.getByRole('button', { name: 'Entregar la evaluación' }).click()
    const entrega = paginaDeBeto.getByRole('dialog', { name: 'Entregar la evaluación' })
    await entrega.getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(entrega.getByText(VACANTE_CERRADA)).toBeVisible({ timeout: 15_000 })
    await contextoDeBeto.close()

    for (const uuid of [uuidAna, uuidBeto]) {
      const id = postulacionPorUuid(uuid)
      expect(estadoDeLaPostulacion(id)).toBe('CERRADA')
      expect(uno(`select motivo_cierre from postulacion where id = ${id}`).motivo_cierre).toBe('PLAZO_VENCIDO')
      expect(
        uno(`select e.estado from evaluacion e join postulacion p on p.evaluacion_id = e.id where p.id = ${id}`).estado,
      ).toBe('VENCIDA')
    }

    // La campana de Ana trae el aviso de siempre del cierre
    await page.goto('/procesos')
    await page.getByRole('button', { name: /^Avisos/ }).click()
    await expect(page.getByRole('dialog', { name: 'Tus avisos' }).getByText(/se cerró/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('dialog', { name: 'Tus avisos' }).getByText(/El proceso terminó/)).toBeVisible()
  })

  test('3 · un borrador con la fecha ya pasada no se publica ni se cierra solo (casos límite)', async ({ page }) => {
    test.setTimeout(150_000)
    const vacante = await vacanteLista('Borrador con la fecha pasada (V78 QA)')
    sql(`update vacante set tipo_cierre = 'FECHA', cierra_en = ${literal(finDelDiaEnLima(diaDeLimaEn(-1)))}
          where id = ${vacante};`)

    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${vacante}`)
    await page.getByRole('button', { name: 'Publicar en el portal' }).click()
    await expect(page.getByRole('alert').filter({ hasText: DIA_PASADO })).toBeVisible({ timeout: 15_000 })

    const porLaApi = await pedir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
    expect(porLaApi.estado).toBe(409)
    expect(porLaApi.cuerpo.detail).toBe(DIA_PASADO)

    // Una vuelta entera del sondeo (cada 60 s): en borrador no se cierra sola
    await page.waitForTimeout(65_000)
    expect(uno(`select estado from vacante where id = ${vacante}`).estado).toBe('BORRADOR')
    expect(consultar(`select id from auditoria where accion = 'cerrar_vacante' and entidad_id = ${vacante}`)).toHaveLength(0)
  })
})

test.describe('QA · el día de Lima con el navegador en otro huso (V78)', () => {
  test.use({ timezoneId: KIRITIMATI })

  test('4 · en UTC+14 «hoy en Lima» vale, «ayer en Lima» no, y lo guardado y lo pintado son el mismo día (AC-02, AC-03)', async ({ page }) => {
    equipo = equipo || (await tokenDePanel())
    const nombre = 'Fecha desde Kiritimati (V78 QA)'
    const titulo = `${MARCA} ${nombre}`
    const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo))
    const hoy = diaDeLimaEn(0)
    await entrarAlPanelCon(page, equipo)

    let dialogo = await editar(page, titulo)
    await dialogo.getByLabel('Cómo se cierra', { exact: true }).selectOption('FECHA')
    await dialogo.getByLabel('Fecha de cierre').fill(diaDeLimaEn(-1))
    await dialogo.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByRole('alert').filter({ hasText: DIA_PASADO })).toBeVisible()

    await dialogo.getByLabel('Fecha de cierre').fill(hoy)
    await guardar(page, /^Cambios guardados/)
    expect(new Date(String(cierreGuardado(vacante).cierra_en)).toISOString()).toBe(finDelDiaEnLima(hoy))

    dialogo = await editar(page, titulo)
    await expect(dialogo.getByLabel('Fecha de cierre')).toHaveValue(hoy)
    await page.goto(`/admin/vacantes/${vacante}`)
    await expect(page.getByText(`se cierra el ${fechaCorta(hoy)}`)).toBeVisible({ timeout: 20_000 })
  })
})
