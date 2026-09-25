import { expect, type Page } from '@playwright/test'

import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import {
  avisosDe,
  MARCA,
  postulantesEnCarrera,
  retirarLoSembrado,
  sembrar,
  solicitudAbierta,
  vacanteEnBase,
  type Postulante,
} from './ayuda-buscar-vacantes'
import { limpiarSiempre, literal, sql } from './base-de-datos'

/**
 * El panel: la modalidad y la ciudad se eligen de una lista (spec
 * `buscar-vacantes.md`, AC-27 y AC-29 a AC-32).
 *
 * ⚠️ **ESCRIBE, y por eso siembra su propio terreno.** Una solicitud aprobada
 * para el alta, y vacantes publicadas con postulantes en carrera para mirar qué
 * aviso les llega al corregirlas. Todo se retira al terminar; ver
 * `ayuda-buscar-vacantes`.
 */

const campo = (page: Page, etiqueta: string) => page.getByLabel(etiqueta)
const modalidad = (page: Page) => page.getByLabel('Modalidad', { exact: true })
const ciudad = (page: Page) => page.getByLabel('Ciudad', { exact: true })
const elLapiz = (page: Page, titulo: string) => page.getByRole('button', { name: `Editar la vacante ${titulo}` })
const confirmacion = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ })
const error = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ })

async function abrirElPanel(page: Page) {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
}

async function abrirElLapiz(page: Page, titulo: string) {
  await abrirElPanel(page)
  await elLapiz(page, titulo).click()
  await expect(page.getByRole('heading', { name: 'Editar vacante' })).toBeVisible()
  // El desplegable de ciudad espera al catálogo.
  await expect(ciudad(page)).toBeEnabled()
}

let correos: string[] = []

test.describe('El panel elige la modalidad y la ciudad de una lista', () => {
  test.beforeAll(() => retirarLoSembrado())
  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(correos)]))
  test.beforeEach(async ({ page }) => entrarAlPanel(page))

  // ---------- AC-27 y AC-28 ----------
  test('AC-27 · el alta no guarda sin modalidad ni con Presencial sin ciudad, y cada campo dice qué falta; con Remoto sin ciudad, guarda', async ({
    page,
  }) => {
    const solicitud = await solicitudAbierta()
    const enviados: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/panel/vacantes')) enviados.push(r.url())
    })

    await abrirElPanel(page)
    await page.getByRole('button', { name: 'Crear vacante' }).click()
    const solicitudes = page.getByLabel('Solicitud aprobada que la respalda')
    await expect(solicitudes).toBeVisible({ timeout: 15_000 })
    await solicitudes.selectOption(String(solicitud))
    await expect(page.getByLabel('Puesto seleccionado')).toBeVisible()
    await page.getByLabel('Responsable del proceso').selectOption({ index: 1 })
    await campo(page, 'Título que ve quien postula').fill('Soporte remoto de prueba')
    await campo(page, 'Descripción').fill(`${MARCA} · Atiende a distancia.`)

    // AC-28: las mismas ciudades que el registro, por departamento y «Fuera del Perú» al final.
    await expect(ciudad(page)).toBeEnabled()
    const grupos = await ciudad(page).locator('optgroup').evaluateAll((els) => els.map((e) => (e as HTMLOptGroupElement).label))
    expect(grupos[0]).toBe('Amazonas')
    expect(grupos).toContain('Lima')
    expect(grupos.length).toBeGreaterThanOrEqual(24)
    const ultima = await ciudad(page).locator('option').last().textContent()
    expect(ultima).toBe('Fuera del Perú')
    expect(await ciudad(page).locator('option').count()).toBe(197 + 1)

    // 1. Sin modalidad.
    await expect(modalidad(page)).toHaveValue('')
    await page.getByRole('button', { name: /Crear en borrador/ }).click()
    await expect(error(page)).toHaveText('Falta elegir algo en los campos marcados.')
    await expect(page.getByText('Elige si es presencial, híbrida o remota.')).toBeVisible()
    await expect(modalidad(page)).toHaveAttribute('aria-invalid', 'true')
    expect(enviados, 'ni una petición sale con el formulario incompleto').toHaveLength(0)

    // 2. Presencial sin ciudad.
    await modalidad(page).selectOption('Presencial')
    await expect(page.getByText('Elige si es presencial, híbrida o remota.')).toHaveCount(0)
    await page.getByRole('button', { name: /Crear en borrador/ }).click()
    await expect(page.getByText('Elige la ciudad del puesto.')).toBeVisible()
    await expect(ciudad(page)).toHaveAttribute('aria-invalid', 'true')
    expect(enviados).toHaveLength(0)

    // 3. Remoto sin ciudad: se guarda.
    await modalidad(page).selectOption('Remoto')
    await expect(page.getByText('Elige la ciudad del puesto.')).toHaveCount(0)
    await page.getByRole('button', { name: /Crear en borrador/ }).click()
    await expect(page.getByRole('row', { name: /Soporte remoto de prueba/ })).toBeVisible({ timeout: 15_000 })
    expect(enviados).toHaveLength(1)
    const creada = JSON.parse(
      sql(
        `select coalesce(json_agg(json_build_object('modalidad', modalidad, 'ciudad', ciudad_ubigeo, 'estado', estado)), '[]')
           from vacante where titulo = 'Soporte remoto de prueba' and descripcion like ${literal(`${MARCA}%`)}`,
      ),
    ) as { modalidad: string; ciudad: string | null; estado: string }[]
    expect(creada).toEqual([{ modalidad: 'Remoto', ciudad: null, estado: 'BORRADOR' }])
  })

  // ---------- AC-29 ----------
  test('AC-29 · con «PRESENCIAL» y Lima guardados, corregir solo el horario los deja igual y el aviso nombra solo el horario', async ({
    page,
  }) => {
    const titulo = 'Administrador de prueba'
    const { admin } = sembrar([
      { clave: 'admin', titulo, modalidad: 'PRESENCIAL', ciudad: '1501', horario: 'Tiempo parcial', hace: 2 },
    ])
    const enCarrera: Postulante[] = await postulantesEnCarrera(admin, 2)
    correos = [...correos, ...enCarrera.map((p) => p.correo)]
    const avisosAntes = avisosDe(admin).length

    await abrirElLapiz(page, titulo)
    // AC-45: el desplegable marca la opción equivalente sin mirar mayúsculas, y la ciudad guardada.
    await expect(modalidad(page)).toHaveValue('Presencial')
    await expect(ciudad(page)).toHaveValue('1501')
    await expect(page.getByText('Al guardar, avisaremos en su portal a 2 postulantes en carrera de lo que cambies')).toBeVisible()

    await campo(page, 'Horario').fill('Tiempo completo')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(confirmacion(page)).toHaveText('Cambios guardados. Avisamos a 2 postulantes en su portal')

    const guardada = vacanteEnBase(admin)
    expect(guardada.modalidad, 'la modalidad se guarda letra por letra').toBe('PRESENCIAL')
    expect(guardada.ciudad_ubigeo).toBe('1501')
    expect(guardada.horario).toBe('Tiempo completo')

    const nuevos = avisosDe(admin).slice(avisosAntes)
    expect(nuevos, 'un aviso por persona en carrera').toHaveLength(2)
    expect(new Set(nuevos.map((a) => Number(a.usuario_id)))).toEqual(new Set(enCarrera.map((p) => p.usuarioId)))
    for (const aviso of nuevos) {
      const cuerpo = String(aviso.cuerpo)
      expect(cuerpo).toContain('Horario: Tiempo parcial → Tiempo completo')
      expect(cuerpo).not.toContain('Modalidad')
      expect(cuerpo).not.toContain('Ciudad')
      expect(cuerpo).not.toContain('Zona')
    }
  })

  // ---------- AC-30 ----------
  test('AC-30 · elegir Arequipa en una publicada sin ciudad deja un solo aviso por persona con «Ciudad: — → Arequipa», y la zona no cambia', async ({
    page,
  }) => {
    const titulo = 'Marketing de prueba'
    const { marketing } = sembrar([
      { clave: 'marketing', titulo, modalidad: 'Presencial', zona: 'Selva Alegre', horario: '9am-6pm', hace: 3 },
    ])
    const enCarrera = await postulantesEnCarrera(marketing, 2)
    correos = [...correos, ...enCarrera.map((p) => p.correo)]
    const avisosAntes = avisosDe(marketing).length

    await abrirElLapiz(page, titulo)
    await expect(ciudad(page)).toHaveValue('')
    await expect(ciudad(page).locator('option[value=""]')).toHaveText('Sin indicar')
    await expect(campo(page, 'Zona o referencia')).toHaveValue('Selva Alegre')
    await ciudad(page).selectOption('0401')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(confirmacion(page)).toHaveText('Cambios guardados. Avisamos a 2 postulantes en su portal')

    const guardada = vacanteEnBase(marketing)
    expect(guardada.ciudad_ubigeo).toBe('0401')
    expect(guardada.ubicacion, 'la zona no se toca').toBe('Selva Alegre')
    expect(guardada.modalidad).toBe('Presencial')

    const nuevos = avisosDe(marketing).slice(avisosAntes)
    expect(nuevos).toHaveLength(2)
    expect(new Set(nuevos.map((a) => Number(a.usuario_id)))).toEqual(new Set(enCarrera.map((p) => p.usuarioId)))
    for (const aviso of nuevos) {
      const cuerpo = String(aviso.cuerpo)
      expect(cuerpo).toContain('Ciudad: — → Arequipa')
      expect(cuerpo).not.toContain('Zona')
      expect(cuerpo).not.toContain('Modalidad')
    }

    // Y el portal ya la enseña en Arequipa, con la zona detrás.
    await page.goto(`/vacantes/${marketing}`)
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    const datos = page.locator('h1').locator('xpath=..').locator('span')
    await expect(datos.filter({ hasText: /^(Presencial|Arequipa|Selva Alegre|9am-6pm)$/ })).toHaveText([
      'Presencial',
      'Arequipa',
      'Selva Alegre',
      '9am-6pm',
    ])
  })

  // ---------- AC-31 ----------
  test('AC-31 · una publicada sin modalidad ni ciudad se guarda con «Sin indicar» en ambos y el aviso nombra solo la descripción', async ({
    page,
  }) => {
    const titulo = 'Líder de prueba'
    const { lider } = sembrar([{ clave: 'lider', titulo, hace: 4 }])
    const enCarrera = await postulantesEnCarrera(lider, 1)
    correos = [...correos, ...enCarrera.map((p) => p.correo)]
    const avisosAntes = avisosDe(lider).length

    await abrirElLapiz(page, titulo)
    await expect(modalidad(page)).toHaveValue('')
    await expect(modalidad(page).locator('option:checked')).toHaveText('Sin indicar')
    await expect(ciudad(page)).toHaveValue('')
    await expect(ciudad(page).locator('option:checked')).toHaveText('Sin indicar')

    await campo(page, 'Descripción').fill(`${MARCA} · Lleva la operación y ahora también la cuenta.`)
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(confirmacion(page)).toHaveText('Cambios guardados. Avisamos a 1 postulante en su portal')

    const guardada = vacanteEnBase(lider)
    expect(guardada.modalidad).toBeNull()
    expect(guardada.ciudad_ubigeo).toBeNull()

    const nuevos = avisosDe(lider).slice(avisosAntes)
    expect(nuevos).toHaveLength(1)
    const cuerpo = String(nuevos[0]!.cuerpo)
    expect(cuerpo).toContain('la descripción')
    expect(cuerpo).not.toContain('Modalidad')
    expect(cuerpo).not.toContain('Ciudad')
    expect(cuerpo).not.toContain('Zona')
  })

  // ---------- AC-32 ----------
  test('AC-32 · una modalidad que no se parece a ninguna sale marcada como «test (valor anterior)» con su pista, y se guarda tal cual', async ({
    page,
  }) => {
    const titulo = 'Vacante con modalidad rara'
    const { rara } = sembrar([{ clave: 'rara', titulo, modalidad: 'test', ciudad: '1501', hace: 5 }])

    await abrirElLapiz(page, titulo)
    await expect(modalidad(page)).toHaveValue('test')
    await expect(modalidad(page).locator('option:checked')).toHaveText('test (valor anterior)')
    await expect(page.getByText('Elige una de las tres para que el portal pueda filtrarla')).toBeVisible()
    // Las tres siguen ahí, detrás de la anterior.
    expect(await modalidad(page).locator('option').allTextContents()).toEqual([
      'test (valor anterior)',
      'Presencial',
      'Híbrido',
      'Remoto',
    ])

    // Corregir otra cosa no la convierte en nada.
    await campo(page, 'Horario').fill('Turnos rotativos')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(confirmacion(page)).toHaveText('Cambios guardados')
    expect(vacanteEnBase(rara).modalidad).toBe('test')
  })
})
