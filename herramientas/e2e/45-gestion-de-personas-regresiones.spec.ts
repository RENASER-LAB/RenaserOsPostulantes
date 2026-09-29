import { randomUUID } from 'node:crypto'
import { expect, type Page } from '@playwright/test'

import { API, entrarAlPanel } from './ayuda'
import { apiPanel } from './ayuda-configuracion'
import { literal, sql } from './base-de-datos'
import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato, test } from './ayuda-candidato'
import {
  altaPorLaApi,
  comoSeVe,
  contar,
  dniAlAzar,
  hoyEnLima,
  MARCA,
  retirarLoSembrado,
  sembrarCuentaDePanel,
  sembrarEstructura,
  sembrarPostulacion,
  sembrarVacante,
  tokenDe,
  type Estructura,
} from './ayuda-personas'

/**
 * Regresiones de QA de la gestión de personas (spec `rrhh-01-gestion-de-personas`).
 *
 * Cada prueba nace de un recorrido de la exploración en el navegador:
 *
 *   1. un ajuste de sueldo programado no existe para quien no tiene `ver_sueldos`:
 *      ni en «Cambios programados», ni en el aviso del cese, ni se puede anular;
 *   2. el error que devuelve el servidor en «Registrar un cambio» (un círculo de
 *      jefes) se ve sin desplazarse y el foco sigue dentro del modal;
 *   3. a 1024 px, con un contrato vencido en la lista, la página no se desplaza
 *      en horizontal;
 *   4. «No dar de alta» con doble clic manda una sola petición y el aviso de
 *      pendientes baja en uno (AC-14);
 *   5. Talento no ve «Contratar» y la API de decisión le responde 403 (AC-12);
 *   6. con el navegador en otra zona horaria, «Rige desde» propone el día de Lima;
 *   7. «Anular el cambio» y «Anular el cese» con doble clic mandan una sola
 *      petición y dejan una sola anulación (historial y auditoría);
 *   8. «Añadir» un cargo con doble clic manda una sola petición y no enseña un
 *      error sobre el cargo que sí se creó;
 *   9. «Dar de alta» con un documento que ya es colaborador: el aviso con el
 *      enlace a su ficha toma el foco (AC-09);
 *  10. un cambio anulado sigue enseñando en el historial lo que cambiaba, aunque
 *      después se registre otro cambio (AC-19).
 *
 * Todo lo sembrado lleva la marca `QA-PERSONAS-3E62` y sale en `afterAll`. Las
 * pruebas no dependen entre sí: si una falla, las demás se ejecutan igual.
 */

const SUFIJO = randomUUID().slice(0, 6)
let e: Estructura | null = null
const vacantes: number[] = []
const cuentas: string[] = []
let talento = ''

async function entrarCon(page: Page, renaserOsId: string) {
  const token = await tokenDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

async function comoTalento(ruta: string, opciones: { method?: string; cuerpo?: unknown } = {}) {
  const token = await tokenDe(talento)
  const r = await fetch(`${API}/panel${ruta}`, {
    method: opciones.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  })
  return { estado: r.status, texto: await r.text() }
}

function situacionBase(extra: Record<string, unknown> = {}) {
  return {
    sedeId: e!.sedeNorte.id,
    areaId: e!.area.id,
    cargoId: e!.cargoAnalista.id,
    jefeId: null,
    tipoContrato: '01',
    regimenLaboral: '01',
    sueldoBase: 4100,
    moneda: 'PEN',
    ...extra,
  }
}

test.beforeAll(() => {
  e = sembrarEstructura(SUFIJO)
  talento = sembrarCuentaDePanel('TALENTO', SUFIJO)
})

test.afterAll(async () => {
  retirarLoSembrado(e, vacantes)
  if (cuentas.length) await borrarCuentasDePrueba(cuentas)
})

test('1 · sin ver_sueldos, un ajuste de sueldo programado no sale ni se anula (AC-23)', async ({ page }) => {
  const id = await altaPorLaApi({
    dni: dniAlAzar(),
    nombres: 'Sara',
    paterno: `Programada ${MARCA}`,
    ingreso: hoyEnLima(-90),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
    sueldo: 4100,
  })
  const enVeinte = hoyEnLima(20)
  const ajuste = await apiPanel<{ id: number }>(`/colaboradores/${id}/cambios`, {
    method: 'POST',
    cuerpo: { vigenteDesde: enVeinte, tipoMotivo: 'AJUSTE_REMUNERACION', situacion: situacionBase({ sueldoBase: 4600 }) },
  })
  expect(ajuste.estado).toBe(201)

  // Dirección sí lo tiene programado.
  const direccion = await apiPanel<{ programados: { id: number }[] }>(`/colaboradores/${id}`)
  expect(direccion.cuerpo.programados.map((p) => p.id)).toContain(ajuste.cuerpo.id)

  // Talento: la API no lo envía…
  const ficha = await comoTalento(`/colaboradores/${id}`)
  expect(ficha.estado).toBe(200)
  const programados = (JSON.parse(ficha.texto) as { programados: { id: number }[] }).programados
  expect(programados.map((p) => p.id), 'un cambio que solo toca el sueldo no existe sin ver_sueldos').not.toContain(
    ajuste.cuerpo.id,
  )
  // …ni lo deja anular: anularlo es editar el sueldo.
  const anular = await comoTalento(`/colaboradores/${id}/cambios/${ajuste.cuerpo.id}/anulacion`, {
    method: 'POST',
    cuerpo: { motivo: 'QA: Talento no edita sueldos' },
  })
  expect([403, 404], `anular un ajuste de sueldo sin ver_sueldos respondió ${anular.estado}`).toContain(anular.estado)
  expect(contar(`select 1 from situacion_laboral where id = ${ajuste.cuerpo.id} and anulada_en is not null`)).toBe(0)

  // …ni la pantalla lo enseña, ni en «Cambios programados» ni en el aviso del cese.
  await entrarCon(page, talento)
  await page.goto(`/admin/colaboradores/${id}`)
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('No hay cambios con fecha futura.')
  await expect(page.getByRole('tabpanel')).not.toContainText(comoSeVe(enVeinte))
  await page.getByRole('button', { name: 'Registrar el cese' }).click()
  const cese = page.getByRole('dialog', { name: /Registrar el cese/ })
  await expect(cese).toBeVisible()
  await expect(cese).not.toContainText('Ajuste de remuneración')
  await expect(cese).not.toContainText(comoSeVe(enVeinte))
})

test('2 · el error del servidor en «Registrar un cambio» se ve y el foco sigue en el modal', async ({ page }) => {
  const base = { ingreso: hoyEnLima(-60), sede: e!.sedeNorte.id, area: e!.area.id, cargo: e!.cargoAnalista.id }
  const jefe = await altaPorLaApi({ ...base, dni: dniAlAzar(), nombres: 'Irene', paterno: `Circulo ${MARCA}` })
  await altaPorLaApi({ ...base, dni: dniAlAzar(), nombres: 'Ivan', paterno: `Reporta ${MARCA}`, jefe })

  await page.setViewportSize({ width: 1366, height: 900 })
  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/${jefe}`)
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await page.getByRole('button', { name: 'Registrar un cambio' }).click()
  const modal = page.getByRole('dialog', { name: 'Registrar un cambio' })
  await modal.getByLabel('Tipo de motivo').selectOption('CAMBIO_JEFE')
  await modal.getByLabel('Jefe directo', { exact: false }).fill(`Reporta ${MARCA}`)
  await modal.getByText(`Reporta ${MARCA}, Ivan`).click()
  await modal.getByRole('button', { name: 'Guardar el cambio' }).click()

  const error = modal.getByRole('alert')
  await expect(error).toContainText('círculo')
  await expect(error, 'el error queda debajo del pliegue del modal').toBeInViewport()
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), {
      message: 'tras el error, el foco salió del modal',
    })
    .toBe(true)
})

test('3 · a 1024 px, un contrato vencido en la lista no desplaza la página en horizontal', async ({ page }) => {
  const dni = dniAlAzar()
  const r = await apiPanel('/colaboradores', {
    method: 'POST',
    cuerpo: {
      persona: {
        tipoDocumento: '01',
        numeroDocumento: dni,
        nombres: 'Vera',
        apellidoPaterno: `Vencida ${MARCA}`,
        fechaNacimiento: '1990-05-04',
        sexo: 'F',
      },
      fechaIngreso: hoyEnLima(-200),
      situacion: situacionBase({ tipoContrato: '04', finContrato: hoyEnLima(-5) }),
    },
  })
  expect(r.estado).toBe(201)

  await page.setViewportSize({ width: 1024, height: 800 })
  await entrarAlPanel(page)
  await page.goto('/admin/colaboradores')
  await page.getByLabel('Buscar por nombre o documento').fill(dni)
  const fila = page.getByRole('row', { name: new RegExp(dni) })
  await expect(fila).toContainText('vencido')
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(sobra, 'la página entera se desplaza en horizontal').toBeLessThanOrEqual(0)
})

test('4 · «No dar de alta» con doble clic manda una sola petición y el aviso baja en uno (AC-14)', async ({ page }) => {
  const vacante = sembrarVacante(e!, `Pendientes ${SUFIJO}`)
  vacantes.push(vacante)
  for (const quien of ['Pia', 'Rut']) {
    const correo = correoDePrueba(`qa.personas.3e62.${quien.toLowerCase()}`)
    cuentas.push(correo)
    await crearCuentaDeCandidato({ nombre: quien, apellidos: `Pendiente ${SUFIJO}`, correo })
    sembrarPostulacion(vacante, correo, 'CONTRATADO')
  }
  const pendientes = await apiPanel<unknown[]>('/colaboradores/pendientes')
  const n = pendientes.cuerpo.length
  expect(n).toBeGreaterThanOrEqual(2)

  await entrarAlPanel(page)
  await page.goto('/admin/colaboradores')
  await expect(page.getByText(`${n} personas contratadas por selección esperan su alta`)).toBeVisible()
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  const suya = page.getByRole('listitem').filter({ hasText: `Pia Pendiente ${SUFIJO}` })
  await suya.getByRole('button', { name: 'No dar de alta' }).click()
  const modal = page.getByRole('dialog', { name: /No dar de alta a/ })
  await modal.getByLabel('Motivo').fill('Ya no trabaja aquí')

  const envios: number[] = []
  page.on('response', (res) => {
    if (res.url().includes('/descarte') && res.request().method() === 'POST') envios.push(res.status())
  })
  await modal.getByRole('button', { name: 'No dar de alta' }).dblclick()
  await expect(modal).toBeHidden()
  const restantes = n - 1
  await expect(
    page.getByText(
      restantes === 1
        ? '1 persona contratada por selección espera su alta'
        : `${restantes} personas contratadas por selección esperan su alta`,
    ),
  ).toBeVisible()
  expect(envios, 'el botón admitió un segundo envío').toEqual([204])
  expect(
    contar(`select 1 from auditoria a join postulacion p on p.id = a.entidad_id
            where a.accion = 'no_dar_de_alta_contratado' and p.vacante_id = ${vacante}`),
  ).toBe(1)
})

test('5 · Talento no ve «Contratar» y la API de decisión le responde 403 (AC-12)', async ({ page }) => {
  const correo = correoDePrueba('qa.personas.3e62.tal')
  cuentas.push(correo)
  await crearCuentaDeCandidato({ nombre: 'Teo', apellidos: `Candidato ${SUFIJO}`, correo })
  const vacante = sembrarVacante(e!, `Talento ${SUFIJO}`)
  vacantes.push(vacante)
  const postulacion = sembrarPostulacion(vacante, correo, 'PRUEBA_TURNO_CANDIDATO')

  await entrarCon(page, talento)
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  await page.getByRole('button', { name: /Toda la tanda/ }).first().click()
  await page.getByRole('button', { name: `Teo Candidato ${SUFIJO}`, exact: true }).click()
  await expect(page.getByText(`Teo Candidato ${SUFIJO}`).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Contratar', exact: true })).toHaveCount(0)

  const decision = await comoTalento(`/postulaciones/${postulacion}/decision`, {
    method: 'POST',
    cuerpo: { semaforo: 'VERDE', motivo: 'QA' },
  })
  expect(decision.estado).toBe(403)
})

test('6 · con el navegador en otra zona horaria, «Rige desde» propone el día de Lima', async ({ browser }) => {
  const id = await altaPorLaApi({
    dni: dniAlAzar(),
    nombres: 'Lia',
    paterno: `Zona ${MARCA}`,
    ingreso: hoyEnLima(-30),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
  })
  const contexto = await browser.newContext({ timezoneId: 'Asia/Tokyo', locale: 'es-PE', baseURL: test.info().project.use.baseURL })
  const page = await contexto.newPage()
  try {
    await entrarAlPanel(page)
    await page.goto(`/admin/colaboradores/${id}`)
    await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
    await page.getByRole('button', { name: 'Registrar un cambio' }).click()
    await expect(page.getByRole('dialog', { name: 'Registrar un cambio' }).getByLabel('Rige desde')).toHaveValue(hoyEnLima())
  } finally {
    await contexto.close()
  }
})

test('7 · «Anular el cambio» y «Anular el cese» con doble clic: una petición y una sola anulación', async ({ page }) => {
  const id = await altaPorLaApi({
    dni: dniAlAzar(),
    nombres: 'Olga',
    paterno: `Anulaciones ${MARCA}`,
    ingreso: hoyEnLima(-60),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
  })
  const traslado = await apiPanel<{ id: number }>(`/colaboradores/${id}/cambios`, {
    method: 'POST',
    cuerpo: {
      vigenteDesde: hoyEnLima(15),
      tipoMotivo: 'TRASLADO',
      situacion: situacionBase({ sedeId: e!.sedeSur.id, sueldoBase: undefined, moneda: undefined }),
    },
  })
  expect(traslado.estado).toBe(201)
  const envios: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/anulacion')) envios.push(req.url().replace(/.*\/colaboradores\//, ''))
  })

  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/${id}`)
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Anular', exact: true }).click()
  const anularCambio = page.getByRole('dialog', { name: 'Anular el cambio programado' })
  await anularCambio.getByRole('textbox').fill('QA: doble clic en anular el cambio')
  await anularCambio.getByRole('button', { name: 'Anular el cambio', exact: true }).dblclick()
  await expect(anularCambio).toBeHidden()
  await expect(page.getByRole('tabpanel')).toContainText('No hay cambios con fecha futura.')
  await page.waitForLoadState('networkidle')
  expect(envios, 'anular el cambio admitió un segundo envío').toEqual([`${id}/cambios/${traslado.cuerpo.id}/anulacion`])
  expect(contar(`select 1 from auditoria where accion = 'anular_cambio_colaborador' and entidad_id = ${id}`)).toBe(1)

  // El cese, igual: un solo envío y una sola anulación en el historial.
  const cese = await apiPanel(`/colaboradores/${id}/cese`, {
    method: 'POST',
    cuerpo: { fechaCese: hoyEnLima(30), motivoCodigo: '01' },
  })
  expect(cese.estado).toBe(204)
  envios.length = 0
  await page.reload()
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Anular el cese', exact: true }).click()
  const anularCese = page.getByRole('dialog', { name: /Anular el cese/ })
  await anularCese.getByRole('textbox').fill('QA: doble clic en anular el cese')
  await anularCese.getByRole('button', { name: 'Anular el cese', exact: true }).dblclick()
  await expect(anularCese).toBeHidden()
  await page.waitForLoadState('networkidle')
  expect(envios, 'anular el cese admitió un segundo envío').toEqual([`${id}/cese/anulacion`])
  expect(
    contar(`select 1 from cese_anulado ca join periodo_laboral p on p.id = ca.periodo_id where p.colaborador_id = ${id}`),
  ).toBe(1)
  await page.getByRole('tab', { name: 'Historial' }).click()
  await expect(page.getByRole('tabpanel').getByText('Cese: Renuncia', { exact: true })).toHaveCount(1)
})

test('8 · «Añadir» un cargo con doble clic manda una sola petición y no enseña un error falso (AC-05)', async ({ page }) => {
  const nombre = `${MARCA} Cargo doble clic ${SUFIJO}`
  const envios: number[] = []
  page.on('response', (res) => {
    if (res.request().method() === 'POST' && /\/panel\/cargos$/.test(res.url())) envios.push(res.status())
  })
  try {
    await entrarAlPanel(page)
    await page.goto('/admin/configuracion')
    const cargos = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Cargos', exact: true }) })
    await cargos.getByLabel('Nombre del cargo').fill(nombre)
    await cargos.getByLabel('Nivel').selectOption({ label: 'Ejecución' })
    await cargos.getByLabel('Familia').selectOption({ label: 'Tecnología' })
    await cargos.getByRole('button', { name: 'Añadir', exact: true }).dblclick()
    await expect(cargos.getByText(nombre, { exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(envios, 'el botón admitió un segundo envío').toEqual([201])
    await expect(cargos.getByRole('alert'), 'el cargo se creó, pero la pantalla dice que falló').toHaveCount(0)
    expect(contar(`select 1 from puesto where organizacion_id = ${e!.organizacion} and nombre = ${literal(nombre)}`)).toBe(1)
  } finally {
    sql(`delete from puesto where organizacion_id = ${e!.organizacion} and nombre = ${literal(nombre)};`)
  }
})

test('9 · «Dar de alta» con un documento que ya es colaborador: el aviso toma el foco (AC-09)', async ({ page }) => {
  const dni = dniAlAzar()
  const yaEs = await altaPorLaApi({
    dni,
    nombres: 'Rita',
    paterno: `Duplicada ${MARCA}`,
    ingreso: hoyEnLima(-10),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
  })

  await page.setViewportSize({ width: 1366, height: 768 })
  await entrarAlPanel(page)
  await page.goto('/admin/colaboradores/nuevo')
  await page.getByLabel('Número de documento').fill(dni)
  await page.getByLabel('Nombres').fill('Otra')
  await page.getByLabel('Apellido paterno').fill(`Persona ${MARCA}`)
  await page.getByLabel('Fecha de nacimiento').fill('1991-01-01')
  await page.getByLabel('Sexo').selectOption('M')
  await page.getByLabel('Fecha de ingreso').fill(hoyEnLima())
  await page.getByLabel('Sede', { exact: false }).selectOption(String(e!.sedeNorte.id))
  await page.getByLabel('Área').selectOption(String(e!.area.id))
  await page.getByLabel('Cargo').selectOption(String(e!.cargoAnalista.id))
  await page.getByLabel('Tipo de contrato').selectOption('01')
  // Con el teclado: el botón se desactiva al enviar y suelta el foco.
  await page.getByRole('button', { name: 'Dar de alta' }).focus()
  await page.keyboard.press('Enter')

  const aviso = page.getByRole('alert').filter({ hasText: 'Ya es colaborador' })
  await expect(aviso).toBeVisible()
  await expect(aviso).toBeInViewport()
  await expect(aviso.getByRole('link', { name: 'Ver su ficha' })).toHaveAttribute('href', `/admin/colaboradores/${yaEs}`)
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="alert"]')), {
      message: 'tras el rechazo, el foco cayó fuera del aviso',
    })
    .toBe(true)
})

test('10 · un cambio anulado sigue enseñando lo que cambiaba, aunque después se registre otro (AC-19)', async ({ page }) => {
  const id = await altaPorLaApi({
    dni: dniAlAzar(),
    nombres: 'Hilda',
    paterno: `Historial ${MARCA}`,
    ingreso: hoyEnLima(-60),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
    sueldo: 4100,
  })
  const traslado = await apiPanel<{ id: number }>(`/colaboradores/${id}/cambios`, {
    method: 'POST',
    cuerpo: { vigenteDesde: hoyEnLima(15), tipoMotivo: 'TRASLADO', situacion: situacionBase({ sedeId: e!.sedeSur.id }) },
  })
  expect(traslado.estado).toBe(201)
  const anulacion = await apiPanel(`/colaboradores/${id}/cambios/${traslado.cuerpo.id}/anulacion`, {
    method: 'POST',
    cuerpo: { motivo: 'QA: al final no se traslada' },
  })
  expect(anulacion.estado).toBe(204)

  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/${id}`)
  await page.getByRole('tab', { name: 'Historial' }).click()
  const anulado = page.getByRole('tabpanel').locator('ol > li').filter({ hasText: 'Cambio: Traslado' })
  const loQueCambiaba = `Sede: ${e!.sedeNorte.nombre} → ${e!.sedeSur.nombre}`
  await expect(anulado).toContainText('Anulado')
  await expect(anulado.getByRole('listitem')).toHaveText([loQueCambiaba])

  // Lo que sugiere el propio aviso de «Registrar un cambio»: anular el programado y registrar
  // otro. La promoción de hoy no puede reescribir lo que el traslado anulado cambiaba.
  const promocion = await apiPanel(`/colaboradores/${id}/cambios`, {
    method: 'POST',
    cuerpo: {
      vigenteDesde: hoyEnLima(),
      tipoMotivo: 'PROMOCION',
      situacion: situacionBase({ cargoId: e!.cargoJefe.id, sueldoBase: 5000 }),
    },
  })
  expect(promocion.estado).toBe(201)
  await page.reload()
  await page.getByRole('tab', { name: 'Historial' }).click()
  await expect(page.getByRole('tabpanel').getByText('Cambio: Promoción')).toBeVisible()
  await expect(anulado).toContainText('Anulado')
  await expect(
    anulado.getByRole('listitem'),
    'el traslado anulado se atribuye el cargo y el sueldo de la promoción posterior',
  ).toHaveText([loQueCambiaba])
})
