import { randomUUID } from 'node:crypto'
import { expect, type Page } from '@playwright/test'

import { API, entrarAlPanel, corte } from './ayuda'
import { apiPanel } from './ayuda-configuracion'
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
  uno,
  type Estructura,
} from './ayuda-personas'
import { libroDeUnaHoja } from './xlsx-minimo'

/**
 * La gestión de personas (spec `rrhh-01-gestion-de-personas`, V64), de punta a
 * punta en el navegador.
 *
 * Los recorridos de la sección «Verificación» de la spec, menos el 8 (los E2E
 * del armazón que ya existían: `15`, `41` y `10` siguen tal cual):
 *
 *   1. el menú por rol, plegar y recordar, y el cajón en pantallas estrechas;
 *   2. el alta manual y el documento duplicado, y una sede nueva en Configuración;
 *   3. contratar desde la ficha, el alta precargada y la ficha enlazada;
 *   4. la carga por Excel con errores —sin guardar nada— y después la válida;
 *   5. un cambio de hoy, uno programado y su anulación, y el historial;
 *   6. el cese con el aviso de sus reportes, y el reingreso;
 *   7. el sueldo oculto para Talento en pantalla y en la API.
 *
 * Todo lo sembrado lleva la marca `QA-PERSONAS-3E62` o un DNI al azar, y sale en
 * `afterAll`. Las fechas son relativas a hoy en Lima.
 */

test.describe.configure({ mode: 'serial' })

const SUFIJO = randomUUID().slice(0, 6)
let e: Estructura | null = null
const vacantes: number[] = []
const cuentas: string[] = []
let talento = ''
let responsable = ''
/** La ficha del recorrido 2, que después reciben los cambios del 5. */
let fichaDelAlta = 0
const dniDelAlta = dniAlAzar()
const paternoDelAlta = `Rivas ${MARCA} ${SUFIJO}`

async function entrarCon(page: Page, renaserOsId: string) {
  const token = await tokenDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Menú del panel' })

test.beforeAll(() => {
  e = sembrarEstructura(SUFIJO)
  talento = sembrarCuentaDePanel('TALENTO', SUFIJO)
  responsable = sembrarCuentaDePanel('RESPONSABLE_AREA', SUFIJO)
})

test.afterAll(async () => {
  retirarLoSembrado(e, vacantes)
  if (cuentas.length) await borrarCuentasDePrueba(cuentas)
})

// ---------- 1 · El menú ----------

test('1 · el menú por rol, plegado recordado y cajón en pantallas estrechas (AC-01 a AC-04)', async ({ page, browser }) => {
  await entrarCon(page, talento)
  await page.goto('/admin')
  for (const nombre of ['Vacantes', 'Simulación', 'Pruebas', 'Colaboradores', 'Configuración']) {
    await expect(menu(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
  }
  await expect(menu(page).getByRole('region', { name: 'Selección' })).toBeVisible()
  await expect(menu(page).getByRole('region', { name: 'Personas' })).toBeVisible()
  await expect(menu(page).getByRole('link', { name: 'Vacantes', exact: true })).toHaveAttribute('href', '/admin')

  // AC-02: el Responsable del área no ve Personas y conserva las cuatro de hoy.
  const otra = await browser.newPage()
  await entrarCon(otra, responsable)
  await otra.goto('/admin')
  await expect(menu(otra).getByRole('link', { name: 'Vacantes', exact: true })).toBeVisible()
  for (const nombre of ['Simulación', 'Pruebas', 'Configuración']) {
    await expect(menu(otra).getByRole('link', { name: nombre, exact: true })).toBeVisible()
  }
  await expect(menu(otra).getByRole('link', { name: 'Colaboradores' })).toHaveCount(0)
  await otra.close()

  // AC-04: una ruta hija marca su entrada.
  await page.goto('/admin/colaboradores/999999999')
  await expect(menu(page).getByRole('link', { name: 'Colaboradores' })).toHaveAttribute('aria-current', 'page')

  // AC-03: plegar se recuerda al recargar; cada icono conserva su nombre y su tooltip.
  await page.goto('/admin')
  await menu(page).getByRole('button', { name: 'Plegar menú' }).click()
  await page.reload()
  await expect(page.locator('[data-plegado="true"]')).toHaveCount(1)
  const vacantesPlegado = menu(page).getByRole('link', { name: 'Vacantes', exact: true })
  await expect(vacantesPlegado).toBeVisible()
  await vacantesPlegado.hover()
  await expect(vacantesPlegado.getByText('Vacantes')).toHaveCSS('opacity', '1')
  await menu(page).getByRole('button', { name: 'Desplegar menú' }).click()

  // En menos de 1024 px: el cajón, que se cierra con Escape, tocando fuera y al elegir.
  await page.setViewportSize({ width: 800, height: 900 })
  await page.goto('/admin')
  await expect(menu(page)).toBeHidden()
  const boton = page.getByRole('button', { name: 'Menú', exact: true })
  await boton.click()
  const cajon = page.getByRole('dialog', { name: 'Menú del panel' })
  await expect(cajon).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(cajon).toBeHidden()
  await expect(boton).toBeFocused()
  await boton.click()
  await page.mouse.click(780, 450)
  await expect(cajon).toBeHidden()
  await boton.click()
  await cajon.getByRole('link', { name: 'Colaboradores' }).click()
  await expect(page).toHaveURL(/\/admin\/colaboradores$/)
  await expect(cajon).toBeHidden()
})

// ---------- 2 · El alta manual ----------

test('2 · una sede nueva en Configuración, el alta manual y el documento duplicado (AC-05, AC-07, AC-09)', async ({ page }) => {
  await entrarAlPanel(page)

  // AC-05: la sede nueva sale en la lista y se puede elegir en el alta.
  const sedeNueva = `${MARCA} Planta Ventanilla ${SUFIJO}`
  await page.goto('/admin/configuracion')
  const sedes = page.locator('section', { has: page.getByRole('heading', { name: 'Sedes', exact: true }) })
  await sedes.getByLabel('Nombre de la sede').fill(sedeNueva)
  await sedes.getByLabel('Código SUNAT · opcional').fill('0003')
  await sedes.getByRole('button', { name: 'Añadir' }).click()
  await expect(sedes.getByText(sedeNueva)).toBeVisible()

  await page.goto('/admin/colaboradores')
  await page.getByRole('link', { name: 'Nuevo colaborador' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Nuevo colaborador.' })).toBeVisible()
  await expect(page.getByLabel('Sede', { exact: false }).locator('option', { hasText: sedeNueva })).toHaveCount(1)

  await page.getByLabel('Número de documento').fill(dniDelAlta)
  await page.getByLabel('Nombres').fill('Ana')
  await page.getByLabel('Apellido paterno').fill(paternoDelAlta)
  await page.getByLabel('Fecha de nacimiento').fill('1990-05-04')
  await page.getByLabel('Sexo').selectOption('F')
  await page.getByLabel('Fecha de ingreso').fill(hoyEnLima())
  await page.getByLabel('Sede', { exact: false }).selectOption(String(e!.sedeNorte.id))
  await page.getByLabel('Área').selectOption(String(e!.area.id))
  await page.getByLabel('Cargo').selectOption(String(e!.cargoAnalista.id))
  await page.getByLabel('Tipo de contrato').selectOption('01')
  await page.getByRole('button', { name: 'Dar de alta' }).click()

  await expect(page).toHaveURL(/\/admin\/colaboradores\/\d+$/)
  fichaDelAlta = Number(page.url().split('/').pop())
  await expect(page.getByRole('heading', { level: 1, name: `${paternoDelAlta}, Ana` })).toBeVisible()

  // AC-07: en la lista, Activa con su cargo, área y sede; y su historial abre con «Ingreso».
  await page.goto('/admin/colaboradores')
  await page.getByLabel('Buscar por nombre o documento').fill(dniDelAlta)
  const fila = page.getByRole('row', { name: new RegExp(dniDelAlta) })
  await expect(fila).toBeVisible()
  await expect(fila).toContainText('Activo')
  await expect(fila).toContainText(e!.cargoAnalista.nombre)
  await expect(fila).toContainText(e!.area.nombre)
  await expect(fila).toContainText(e!.sedeNorte.nombre)
  await page.goto(`/admin/colaboradores/${fichaDelAlta}`)
  await page.getByRole('tab', { name: 'Historial' }).click()
  await expect(page.getByRole('tabpanel').getByText('Ingreso', { exact: true })).toBeVisible()
  expect(contar(`select 1 from auditoria where accion = 'alta_colaborador' and entidad_id = ${fichaDelAlta}`)).toBe(1)

  // AC-09: el mismo DNI otra vez: «Ya es colaborador» con el enlace a su ficha.
  await page.goto('/admin/colaboradores/nuevo')
  await page.getByLabel('Número de documento').fill(dniDelAlta)
  await page.getByLabel('Nombres').fill('Otra')
  await page.getByLabel('Apellido paterno').fill(`Persona ${MARCA}`)
  await page.getByLabel('Fecha de nacimiento').fill('1991-01-01')
  await page.getByLabel('Sexo').selectOption('M')
  await page.getByLabel('Fecha de ingreso').fill(hoyEnLima())
  await page.getByLabel('Sede', { exact: false }).selectOption(String(e!.sedeNorte.id))
  await page.getByLabel('Área').selectOption(String(e!.area.id))
  await page.getByLabel('Cargo').selectOption(String(e!.cargoAnalista.id))
  await page.getByLabel('Tipo de contrato').selectOption('01')
  await page.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(page.getByRole('alert')).toContainText('Ya es colaborador')
  await expect(page.getByRole('link', { name: 'Ver su ficha' })).toHaveAttribute('href', `/admin/colaboradores/${fichaDelAlta}`)

  // AC-05: desactivada, deja de poder elegirse.
  await page.goto('/admin/configuracion')
  const suFila = sedes.getByRole('listitem').filter({ hasText: sedeNueva })
  await suFila.getByRole('button', { name: 'Desactivar' }).click()
  await expect(suFila.getByText('Desactivada')).toBeVisible()
  await page.goto('/admin/colaboradores/nuevo')
  await expect(page.getByLabel('Número de documento')).toBeVisible()
  await expect(page.getByLabel('Sede', { exact: false }).locator('option', { hasText: sedeNueva })).toHaveCount(0)
})

// ---------- 3 · Contratar y dar de alta ----------

test('3 · contratar desde la ficha y dar de alta precargado, con la ficha enlazada (AC-11, AC-13)', async ({ page }) => {
  const correo = correoDePrueba('qa.personas.3e62')
  cuentas.push(correo)
  await crearCuentaDeCandidato({ nombre: 'Carla', apellidos: `De la Cruz ${SUFIJO}`, correo })
  const vacante = sembrarVacante(e!, `Asistente ${SUFIJO}`)
  vacantes.push(vacante)
  const postulacion = sembrarPostulacion(vacante, correo, 'PRUEBA_TURNO_CANDIDATO', '987654321')
  const usuario = Number(uno(`select usuario_id from postulacion where id = ${postulacion}`).usuario_id)

  await entrarAlPanel(page)
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  await corte(page, 'Toda la tanda').click()
  await page.getByRole('button', { name: `Carla De la Cruz ${SUFIJO}`, exact: true }).click()

  // Crear la cuenta ya deja su correo de bienvenida (CUENTA_CREADA): lo que no
  // puede aparecer es ninguno nuevo por contratar.
  const correosAntes = contar(`select 1 from correo_enviado where usuario_id = ${usuario}`)
  await page.getByRole('button', { name: 'Contratar', exact: true }).click()
  const modal = page.getByRole('dialog', { name: `Contratar a Carla De la Cruz ${SUFIJO}` })
  await expect(modal).toContainText('Todavía está en la etapa')
  await expect(modal).toContainText('No se le envía ningún correo.')
  await modal.getByLabel('Motivo').fill('Resolvió el caso mejor que nadie')
  await modal.getByRole('button', { name: 'Contratar', exact: true }).click()
  await expect(page.getByText(`Carla De la Cruz ${SUFIJO} quedó contratado.`)).toBeVisible()
  expect(uno(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo).toBe('CONTRATADO')
  expect(uno(`select semaforo, motivo from decision where postulacion_id = ${postulacion}`)).toMatchObject({
    semaforo: 'VERDE',
    motivo: 'Resolvió el caso mejor que nadie',
  })
  expect(contar(`select 1 from correo_enviado where usuario_id = ${usuario}`)).toBe(correosAntes)

  await page.getByRole('link', { name: 'Dar de alta como colaborador' }).click()
  await expect(page.getByLabel('Nombres')).toHaveValue('Carla')
  await expect(page.getByLabel('Apellido paterno')).toHaveValue(`De la Cruz ${SUFIJO}`)
  await expect(page.getByLabel('Correo personal')).toHaveValue(correo)
  await expect(page.getByLabel('Celular')).toHaveValue('987654321')
  await expect(page.getByLabel('Cargo')).toHaveValue(String(e!.cargoAnalista.id))
  await expect(page.getByLabel('Área')).toHaveValue(String(e!.area.id))
  await expect(page.getByLabel('Fecha de ingreso')).toHaveValue('')

  await page.getByLabel('Número de documento').fill(dniAlAzar())
  await page.getByLabel('Fecha de nacimiento').fill('1995-02-03')
  await page.getByLabel('Sexo').selectOption('F')
  await page.getByLabel('Fecha de ingreso').fill(hoyEnLima(7))
  await page.getByLabel('Sede', { exact: false }).selectOption(String(e!.sedeNorte.id))
  await page.getByLabel('Tipo de contrato').selectOption('01')
  await page.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(page).toHaveURL(/\/admin\/colaboradores\/\d+$/)
  const ficha = Number(page.url().split('/').pop())
  await expect(page.getByText('Por ingresar')).toBeVisible()
  await expect(page.getByRole('link', { name: `«${MARCA} Asistente ${SUFIJO}»` })).toHaveAttribute(
    'href',
    `/admin/vacantes/${vacante}`,
  )
  expect(Number(uno(`select postulacion_id from colaborador where id = ${ficha}`).postulacion_id)).toBe(postulacion)

  // Un segundo alta desde esa contratación no se ofrece.
  await page.goto(`/admin/colaboradores/nuevo?postulacion=${postulacion}`)
  await expect(page.getByRole('link', { name: 'Ver su ficha' })).toHaveAttribute('href', `/admin/colaboradores/${ficha}`)
  await expect(page.getByRole('button', { name: 'Dar de alta' })).toHaveCount(0)
})

// ---------- 4 · La carga por Excel ----------

const CABECERAS = [
  'Tipo de documento *',
  'Número de documento *',
  'Nombres *',
  'Apellido paterno *',
  'Fecha de nacimiento *',
  'Sexo *',
  'Fecha de ingreso *',
  'Sede *',
  'Área *',
  'Cargo *',
  'Tipo de documento del jefe',
  'Número de documento del jefe',
  'Tipo de contrato *',
  'Régimen laboral *',
]

function filaDelExcel(dni: string, sede: string, jefe = ''): string[] {
  return [
    'DNI',
    dni,
    'Persona',
    `Carga ${MARCA}`,
    '1990-01-01',
    'Femenino',
    hoyEnLima(-30),
    sede,
    e!.area.nombre,
    e!.cargoAnalista.nombre,
    jefe ? 'DNI' : '',
    jefe,
    'A plazo indeterminado',
    'General',
  ]
}

async function subir(page: Page, contenido: Buffer) {
  await page.goto('/admin/colaboradores')
  await page.getByRole('button', { name: 'Cargar Excel' }).first().click()
  const modal = page.getByRole('dialog', { name: 'Cargar colaboradores desde Excel' })
  await modal.getByLabel('Archivo .xlsx').setInputFiles({
    name: 'carga.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: contenido,
  })
  await modal.getByRole('button', { name: 'Validar y cargar' }).click()
  return modal
}

test('4 · un Excel con errores no guarda nada y los enseña todos; el válido da de alta 20 (AC-15, AC-16)', async ({ page }) => {
  await entrarAlPanel(page)
  const antes = contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)
  const repetido = dniAlAzar()
  const [c1, c2] = [dniAlAzar(), dniAlAzar()]
  const conErrores = libroDeUnaHoja('Colaboradores', [
    CABECERAS,
    filaDelExcel(dniAlAzar(), `Arequipa ${SUFIJO}`),
    filaDelExcel('4512345', e!.sedeNorte.nombre),
    filaDelExcel(repetido, e!.sedeNorte.nombre),
    filaDelExcel(repetido, e!.sedeNorte.nombre),
    filaDelExcel(c1, e!.sedeNorte.nombre, c2),
    filaDelExcel(c2, e!.sedeNorte.nombre, c1),
  ])
  const modal = await subir(page, conErrores)
  await expect(modal.getByRole('alert')).toContainText('El archivo tiene 6 errores. No se guardó nada.')
  const errores = modal.getByRole('table', { name: 'Errores del archivo' })
  await expect(errores.getByRole('row')).toHaveCount(7)
  await expect(errores).toContainText(`No existe la sede «Arequipa ${SUFIJO}»`)
  await expect(errores).toContainText('El DNI tiene que tener 8 dígitos')
  await expect(errores).toContainText('El documento se repite en las filas 4, 5')
  await expect(errores).toContainText('Crea un círculo con la fila 7')
  expect(contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)).toBe(antes)

  const jefe = dniAlAzar()
  const filas = [CABECERAS, filaDelExcel(jefe, e!.sedeSur.nombre)]
  for (let i = 1; i < 20; i++) filas.push(filaDelExcel(dniAlAzar(), e!.sedeSur.nombre, i <= 3 ? jefe : ''))
  const validos = await subir(page, libroDeUnaHoja('Colaboradores', filas))
  await expect(validos.getByRole('status')).toContainText('Se dieron de alta 20 colaboradores y se actualizaron 0')
  expect(contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)).toBe(antes + 20)
})

// ---------- 5 · Los cambios ----------

test('5 · un cambio de hoy, uno programado y su anulación, con el historial (AC-18, AC-19)', async ({ page }) => {
  test.skip(fichaDelAlta === 0, 'Depende del alta del recorrido 2')
  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/${fichaDelAlta}`)
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()

  await page.getByRole('button', { name: 'Registrar un cambio' }).click()
  let modal = page.getByRole('dialog', { name: 'Registrar un cambio' })
  await expect(modal.getByLabel('Rige desde')).toHaveValue(hoyEnLima())
  await modal.getByLabel('Tipo de motivo').selectOption('PROMOCION')
  await modal.getByLabel('Cargo').selectOption(String(e!.cargoJefe.id))
  await page.getByRole('button', { name: 'Guardar el cambio' }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByRole('tabpanel')).toContainText(e!.cargoJefe.nombre)

  const enDiez = hoyEnLima(10)
  await page.getByRole('button', { name: 'Registrar un cambio' }).click()
  modal = page.getByRole('dialog', { name: 'Registrar un cambio' })
  await modal.getByLabel('Rige desde').fill(enDiez)
  await modal.getByLabel('Tipo de motivo').selectOption('TRASLADO')
  await modal.getByLabel('Sede', { exact: false }).selectOption(String(e!.sedeSur.id))
  await page.getByRole('button', { name: 'Guardar el cambio' }).click()
  await expect(modal).toBeHidden()
  const programado = page.getByRole('listitem').filter({ hasText: `Desde el ${comoSeVe(enDiez)}` })
  await expect(programado).toBeVisible()
  // La situación vigente no cambia hasta ese día.
  await expect(page.getByRole('tabpanel')).toContainText(e!.sedeNorte.nombre)

  await programado.getByRole('button', { name: 'Anular' }).click()
  modal = page.getByRole('dialog', { name: 'Anular el cambio programado' })
  await modal.getByLabel('Motivo').fill('Se queda en su sede')
  await page.getByRole('button', { name: 'Anular el cambio' }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByText('No hay cambios con fecha futura.')).toBeVisible()

  await page.getByRole('tab', { name: 'Historial' }).click()
  const historial = page.getByRole('tabpanel')
  await expect(historial).toContainText(`Cargo: ${e!.cargoAnalista.nombre} → ${e!.cargoJefe.nombre}`)
  await expect(historial).toContainText('Anulado')
  await expect(historial).toContainText('Se queda en su sede')
})

// ---------- 6 · El cese y el reingreso ----------

test('6 · el cese nombra a sus reportes; un cesado se reingresa con un periodo nuevo (AC-21, AC-22)', async ({ page }) => {
  const base = { ingreso: hoyEnLima(-400), sede: e!.sedeNorte.id, area: e!.area.id, cargo: e!.cargoAnalista.id }
  const jefe = await altaPorLaApi({ ...base, dni: dniAlAzar(), nombres: 'Luis', paterno: `Torres ${MARCA}` })
  await altaPorLaApi({ ...base, dni: dniAlAzar(), nombres: 'Uno', paterno: `Reporte ${MARCA}`, jefe })
  await altaPorLaApi({ ...base, dni: dniAlAzar(), nombres: 'Dos', paterno: `Reporte ${MARCA}`, jefe })

  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/${jefe}`)
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await page.getByRole('button', { name: 'Registrar el cese' }).click()
  const modal = page.getByRole('dialog', { name: 'Registrar el cese de Luis' })
  await expect(modal).toContainText('2 personas la tienen como jefe')
  await expect(modal).toContainText(`Reporte ${MARCA}, Uno`)
  await expect(modal).toContainText(`Reporte ${MARCA}, Dos`)
  await modal.getByLabel('Motivo').selectOption('01')
  await modal.getByRole('button', { name: 'Registrar el cese' }).click()
  await expect(modal).toBeHidden()
  // Con fecha de hoy sigue activo hasta el final del día.
  await expect(page.getByText(`Cesa el ${comoSeVe(hoyEnLima())}`)).toBeVisible()

  // Un cese de ayer: hoy ya es Cesado, y se reingresa.
  const cesada = await altaPorLaApi({ ...base, dni: dniAlAzar(), nombres: 'Elena', paterno: `Paredes ${MARCA}` })
  const cese = await apiPanel(`/colaboradores/${cesada}/cese`, {
    method: 'POST',
    cuerpo: { fechaCese: hoyEnLima(-1), motivoCodigo: '07' },
  })
  expect(cese.estado).toBe(204)
  await page.goto(`/admin/colaboradores/${cesada}`)
  await expect(page.getByText('Cesado', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await page.getByRole('button', { name: 'Reingresar' }).click()
  const reingreso = page.getByRole('dialog', { name: 'Reingresar a Elena' })
  await reingreso.getByLabel('Fecha de reingreso').fill(hoyEnLima())
  await reingreso.getByRole('button', { name: 'Reingresar', exact: true }).click()
  await expect(reingreso).toBeHidden()
  await expect(page.getByText('Activo', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Historial' }).click()
  const historial = page.getByRole('tabpanel')
  await expect(historial).toContainText('Reingreso')
  await expect(historial).toContainText('Cese: Fin del contrato o de la obra')
  await expect(historial).toContainText('Ingreso')
})

// ---------- 7 · El sueldo ----------

test('7 · sin ver_sueldos el sueldo no sale en pantalla ni en la API (AC-23)', async ({ page }) => {
  const conSueldo = await altaPorLaApi({
    dni: dniAlAzar(),
    nombres: 'Sofía',
    paterno: `Sueldo ${MARCA}`,
    ingreso: hoyEnLima(-60),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
    sueldo: 4567.89,
  })

  // Dirección (el equipo de la suite) lo ve.
  const direccion = await apiPanel(`/colaboradores/${conSueldo}`)
  expect(JSON.stringify(direccion.cuerpo)).toContain('sueldoBase')

  // Talento, no: ni en la API…
  const token = await tokenDe(talento)
  for (const ruta of [`/colaboradores/${conSueldo}`, `/colaboradores/${conSueldo}/historial`, '/colaboradores']) {
    const r = await fetch(`${API}/panel${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
    expect(r.status, ruta).toBe(200)
    const texto = await r.text()
    expect(texto, ruta).not.toContain('sueldo')
    expect(texto, ruta).not.toContain('4567.89')
  }
  // …ni en pantalla.
  await entrarCon(page, talento)
  await page.goto(`/admin/colaboradores/${conSueldo}`)
  await page.getByRole('tab', { name: 'Puesto y contrato' }).click()
  await expect(page.getByRole('tabpanel')).toContainText(e!.cargoAnalista.nombre)
  await expect(page.getByText('Sueldo base')).toHaveCount(0)
})
