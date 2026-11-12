import { randomUUID } from 'node:crypto'
import { expect, type Locator, type Page } from '@playwright/test'

import { entrarAlPanel, entrarAlPortal, tokenDelPanel } from './ayuda'
import { apiPanel } from './ayuda-configuracion'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  test,
  tokenDelCandidato,
} from './ayuda-candidato'
import { entrarAlPortalCon } from './ayuda-preguntas-propias'
import {
  altaPorLaApi,
  contar,
  dniAlAzar,
  hoyEnLima,
  MARCA,
  retirarLoSembrado,
  sembrarEstructura,
  sembrarPostulacion,
  sembrarVacante,
  uno,
  type Estructura,
} from './ayuda-personas'
import { ponerLaBeta } from './ayuda-whatsapp'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import { libroDeUnaHoja } from './xlsx-minimo'

/**
 * El celular con formato «999 999 999» (spec `celular-con-formato-999-999-999`), los
 * recorridos de su «Verificación» en el navegador:
 *
 *   1. Registro: escribir tecla a tecla, letras y separadores, la décima cifra, el número
 *      incompleto y el que no empieza por 9 (sin cuenta), pegar algo que no es un celular,
 *      y pegar con «+51» para crear la cuenta.
 *   2. Registro: el número de otro país («+34»), el «+51» que se va y vuelve.
 *   3. Pegar «51987654321» y «987-654-321», «12345678901234567» y «hola».
 *   4. «Mi cuenta»: cambiar el celular.
 *   5. La tarjeta de WhatsApp de una cuenta sin celular: la misma máscara.
 *   6. Panel: alta de un colaborador con celular y sin él.
 *   7. Panel: editar un colaborador con un celular antiguo sin tocarlo; tocado, la regla.
 *      Y la petición directa con «abc» (AC-13).
 *   8. Panel: alta desde un contratado, con el celular de su cuenta y no el del CV.
 *   9. Panel: carga por Excel con un celular inválido y después con uno válido.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo. Las cuentas llevan correos únicos `qa.cel.999.*`;
 * lo del panel, la marca de `ayuda-personas` y DNI al azar. `afterAll` lo retira y deja la
 * beta de WhatsApp como estaba.
 */

test.describe.configure({ mode: 'serial' })
// Pegar con el atajo de teclado necesita el portapapeles.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const REGLA = 'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo'
const PREFIJO_CORREO = 'qa.cel.999'
const SUFIJO = randomUUID().slice(0, 6)

let e: Estructura | null = null
const vacantes: number[] = []
const correos: string[] = []
let equipo = ''
let betaAntes: string | null = null

test.beforeAll(async () => {
  e = sembrarEstructura(SUFIJO)
  equipo = await tokenDelPanel()
})

test.afterAll(async () => {
  await limpiarSiempre([
    async () => {
      if (betaAntes !== null) await ponerLaBeta(equipo, betaAntes === 'true')
    },
    () => retirarLoSembrado(e, vacantes),
    () => retirarCuentas(correos),
  ])
})

/**
 * Las cuentas de la prueba, fuera. Cambiar el celular en «Mi cuenta» deja `cambiar_celular` en
 * la auditoría, que es inmutable: esa cuenta no se puede borrar y se retira del camino como
 * hace `limpieza-cuentas` con el historial (sin sesión y con un correo que nadie vuelve a
 * pedir). Las demás se borran.
 */
function retirarCuentas(lista: readonly string[]) {
  if (!lista.length) return
  const seleccion = lista.map((c) => literal(c)).join(', ')
  const conAuditoria = JSON.parse(
    sql(`select coalesce(json_agg(u.correo), '[]') from usuario u where u.correo in (${seleccion})
          and exists (select 1 from auditoria a where a.usuario_id = u.id);`),
  ) as string[]
  borrarCuentasDePrueba(lista.filter((c) => !conAuditoria.includes(c)))
  if (conAuditoria.length) {
    sql(`update usuario set es_activo = false, correo = 'e2e.retirada.' || gen_random_uuid() || '@example.com'
          where correo in (${conAuditoria.map((c) => literal(c)).join(', ')});`)
  }
}

// ---------- ayudas ----------

const celularDelRegistro = (page: Page): Locator => page.getByLabel(/^Celular \(WhatsApp\)/)

/** El «+51» que el campo dibuja delante, o null si no está. */
const prefijoDe = (campo: Locator) =>
  campo.evaluate((i) => i.parentElement?.querySelector('[aria-hidden="true"]')?.textContent ?? null)

/** Pega con el atajo de teclado lo que diga `texto`, con el campo enfocado y su cursor donde esté. */
async function pegar(page: Page, campo: Locator, texto: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), texto)
  await campo.focus()
  await page.keyboard.press('ControlOrMeta+V')
}

async function rellenarRegistroMenosElCelular(page: Page, correo: string) {
  await page.getByLabel(/^Nombre/).fill('Celia')
  await page.getByLabel(/^Apellidos/).fill(`Formato ${SUFIJO}`)
  await page.getByLabel(/^Correo/).fill(correo)
  await page.getByLabel(/^Ciudad/).selectOption({ label: 'Lima' })
  await page.getByLabel(/^Contraseña/).fill(CLAVE_DE_CANDIDATO)
  await page.getByLabel('Repite la contraseña').fill(CLAVE_DE_CANDIDATO)
  await page.locator('input[type="checkbox"]').first().check()
}

const telefonoDe = (correo: string) =>
  uno(`select p.telefono from persona p join usuario u on u.persona_id = p.id where u.correo = ${literal(correo)}`)
    .telefono

const cuentas = (correo: string) => contar(`select 1 from usuario where correo = ${literal(correo)}`)

const celularDeLaFicha = (id: number) => uno(`select celular from colaborador where id = ${id}`).celular

async function llenarAlta(page: Page, dni: string, paterno: string) {
  await page.getByLabel('Número de documento').fill(dni)
  await page.getByLabel('Nombres').fill('Rosa')
  await page.getByLabel('Apellido paterno').fill(paterno)
  await page.getByLabel('Fecha de nacimiento').fill('1992-03-04')
  await page.getByLabel('Sexo').selectOption('F')
  await page.getByLabel('Fecha de ingreso').fill(hoyEnLima())
  await page.getByLabel('Sede', { exact: false }).selectOption(String(e!.sedeNorte.id))
  await page.getByLabel('Área').selectOption(String(e!.area.id))
  await page.getByLabel('Cargo').selectOption(String(e!.cargoAnalista.id))
  await page.getByLabel('Tipo de contrato').selectOption('01')
}

// ---------- 1-3 · El registro ----------

test('1 · registro: tecla a tecla, sin letras ni décima, incompleto avisado y pegado con +51 (AC-01, AC-02, AC-03, AC-04, AC-06)', async ({ page }) => {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  await page.goto('/registro')
  await rellenarRegistroMenosElCelular(page, correo)
  const campo = celularDelRegistro(page)
  await expect(campo).toHaveAttribute('type', 'tel')
  await expect(campo).toHaveAttribute('inputmode', 'tel')
  expect(await prefijoDe(campo)).toBe('+51')

  // AC-01 y AC-02: tecla a tecla, las letras y los separadores no se escriben y la décima tampoco.
  await campo.pressSequentially('98a7-6.5(4) 3x21')
  await expect(campo).toHaveValue('987 654 321')
  await campo.press('0')
  await expect(campo).toHaveValue('987 654 321')

  // AC-06: incompleto, al enviar, el mensaje junto al campo y sin cuenta; lo demás sigue ahí.
  await campo.fill('')
  await campo.pressSequentially('98765')
  await expect(campo).toHaveValue('987 65')
  await page.getByRole('button', { name: /Crear cuenta/ }).click()
  await expect(page.getByText(REGLA)).toBeVisible()
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL(/\/registro/)
  await expect(page.getByLabel(/^Nombre/)).toHaveValue('Celia')
  await expect(page.getByLabel(/^Correo/)).toHaveValue(correo)
  expect(cuentas(correo)).toBe(0)

  // AC-04: pegar algo que no es un celular deja el campo como estaba y dice la regla.
  await campo.fill('')
  await pegar(page, campo, 'hola')
  await expect(campo).toHaveValue('')
  await expect(page.getByText(REGLA)).toBeVisible()

  // AC-06: uno que no empieza por 9 tampoco crea la cuenta.
  await campo.pressSequentially('812345678')
  await expect(campo).toHaveValue('812 345 678')
  await page.getByRole('button', { name: /Crear cuenta/ }).click()
  await expect(page.getByText(REGLA)).toBeVisible()
  await expect(page).toHaveURL(/\/registro/)
  expect(cuentas(correo)).toBe(0)

  // AC-03: pegado con su «+51» sobre lo que había: queda «987 654 321» y la cuenta se crea.
  await campo.selectText()
  await pegar(page, campo, '+51 987 654 321')
  await expect(campo).toHaveValue('987 654 321')
  expect(await prefijoDe(campo)).toBe('+51')
  await page.getByRole('button', { name: /Crear cuenta/ }).click()
  await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
  expect(telefonoDe(correo)).toBe('+51987654321')
})

test('2 · registro con un número de otro país: el «+51» se va con el «+» y vuelve sin él (AC-05)', async ({ page }) => {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  await page.goto('/registro')
  await rellenarRegistroMenosElCelular(page, correo)
  const campo = celularDelRegistro(page)

  await campo.pressSequentially('+')
  await expect(campo).toHaveValue('+')
  expect(await prefijoDe(campo)).toBeNull()
  await campo.press('Backspace')
  await expect(campo).toHaveValue('')
  expect(await prefijoDe(campo)).toBe('+51')

  await campo.pressSequentially('+34 612 345 678')
  await expect(campo).toHaveValue('+34 612 345 678')
  expect(await prefijoDe(campo)).toBeNull()
  // Sin el «+», vuelve el «+51» y no se corta nada.
  await campo.evaluate((i: HTMLInputElement) => i.setSelectionRange(1, 1))
  await campo.press('Backspace')
  expect(await prefijoDe(campo)).toBe('+51')
  await expect(campo).toHaveValue('346 123 456 78')
  await campo.press('Home')
  await campo.press('+')
  expect(await prefijoDe(campo)).toBeNull()

  // «00» delante se vuelve «+».
  await campo.fill('')
  await campo.pressSequentially('0034 612 345 678')
  await expect(campo).toHaveValue('+34 612 345 678')
  await page.getByRole('button', { name: /Crear cuenta/ }).click()
  await expect(page).toHaveURL(/\/procesos/, { timeout: 20_000 })
  expect(telefonoDe(correo)).toBe('+34612345678')
})

test('3 · pegar: se limpia entero lo que es un celular y lo demás no entra (AC-03, AC-04)', async ({ page }) => {
  await page.goto('/registro')
  const campo = celularDelRegistro(page)
  for (const pegado of ['51987654321', '987-654-321', '(987) 654 321']) {
    await campo.fill('')
    await pegar(page, campo, pegado)
    await expect(campo, `pegado «${pegado}»`).toHaveValue('987 654 321')
  }
  await campo.fill('')
  await campo.pressSequentially('987 65')
  for (const pegado of ['12345678901234567', 'hola', '12345678901']) {
    await campo.press('End')
    await pegar(page, campo, pegado)
    await expect(campo, `pegado «${pegado}»`).toHaveValue('987 65')
    await expect(page.getByText(REGLA)).toBeVisible()
  }
  // Al seguir escribiendo, el aviso del pegado se va.
  await campo.press('4')
  await expect(campo).toHaveValue('987 654')
  await expect(page.getByText(REGLA)).toHaveCount(0)
})

// ---------- 4-5 · «Mi cuenta» y la tarjeta de WhatsApp ----------

test('4 · «Mi cuenta» abre el guardado con su forma y guarda el nuevo (AC-07, AC-02)', async ({ page }) => {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre: 'Marta', apellidos: `Cuenta ${SUFIJO}`, correo, telefono: '+51987654321' })
  await entrarAlPortal(page, correo, CLAVE_DE_CANDIDATO)
  await page.goto('/perfil')
  const bloque = page.locator('#celular')
  await expect(bloque.getByText('+51 987 654 321')).toBeVisible()
  await bloque.getByRole('button', { name: 'Cambiar' }).click()
  const campo = bloque.getByLabel(/^Celular \(WhatsApp\)/)
  await expect(campo).toHaveValue('987 654 321')
  expect(await prefijoDe(campo)).toBe('+51')

  await campo.press('End')
  await campo.pressSequentially('a-.() 5')
  await expect(campo).toHaveValue('987 654 321')
  await campo.selectText()
  await campo.pressSequentially('912345678')
  await expect(campo).toHaveValue('912 345 678')
  await bloque.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(bloque.getByText('+51 912 345 678')).toBeVisible()
  expect(telefonoDe(correo)).toBe('+51912345678')
  await page.reload()
  await expect(page.locator('#celular').getByText('+51 912 345 678')).toBeVisible()
})

test('5 · la tarjeta de WhatsApp de una cuenta sin celular usa la misma máscara (AC-08)', async ({ page }) => {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre: 'Nora', apellidos: `Tarjeta ${SUFIJO}`, correo })
  sql(`update persona set telefono = null
        where id = (select persona_id from usuario where correo = ${literal(correo)});`)
  const vacante = sembrarVacante(e!, `Tarjeta ${SUFIJO}`)
  vacantes.push(vacante)
  sembrarPostulacion(vacante, correo, 'PERFIL_CALIFICANDO')
  betaAntes = await ponerLaBeta(equipo, true)

  await entrarAlPortalCon(page, await tokenDelCandidato(correo))
  await page.goto('/procesos')
  const campo = page
    .getByRole('region', { name: /novedades por WhatsApp/i })
    .first()
    .getByLabel(/^Tu celular \(WhatsApp\)/)
  await expect(campo).toBeVisible()
  expect(await prefijoDe(campo)).toBe('+51')
  await campo.pressSequentially('9a8-7.6(5)4 3210')
  await expect(campo).toHaveValue('987 654 321')
  await campo.fill('')
  await pegar(page, campo, 'hola')
  await expect(campo).toHaveValue('')
  await expect(page.getByText(REGLA)).toBeVisible()
  await pegar(page, campo, '+51 987 654 321')
  await expect(campo).toHaveValue('987 654 321')
  await campo.fill('')
  await campo.pressSequentially('+34 612')
  expect(await prefijoDe(campo)).toBeNull()
  // Incompleto: al enviar se avisa junto al campo y no se guarda nada.
  await campo.fill('')
  await campo.pressSequentially('98765')
  await page.getByRole('button', { name: 'Guardar y escribir por WhatsApp' }).click()
  await expect(page.getByText(REGLA)).toBeVisible()
  expect(telefonoDe(correo)).toBeNull()
})

// ---------- 6-9 · El panel ----------

test('6 · alta de un colaborador con celular y sin él (AC-09)', async ({ page }) => {
  await entrarAlPanel(page)
  const conCelular = dniAlAzar()
  await page.goto('/admin/colaboradores/nuevo')
  await llenarAlta(page, conCelular, `Con celular ${MARCA} ${SUFIJO}`)
  const campo = page.getByLabel(/^Celular/)
  expect(await prefijoDe(campo)).toBe('+51')
  await campo.pressSequentially('987-654-321 0')
  await expect(campo).toHaveValue('987 654 321')
  await page.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(page).toHaveURL(/\/admin\/colaboradores\/\d+$/)
  const ficha = Number(page.url().split('/').pop())
  expect(celularDeLaFicha(ficha)).toBe('+51987654321')
  await expect(page.getByText('+51 987 654 321')).toBeVisible()

  await page.goto('/admin/colaboradores/nuevo')
  await llenarAlta(page, dniAlAzar(), `Sin celular ${MARCA} ${SUFIJO}`)
  await expect(page.getByLabel(/^Celular/)).toHaveValue('')
  await page.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(page).toHaveURL(/\/admin\/colaboradores\/\d+$/)
  expect(celularDeLaFicha(Number(page.url().split('/').pop()))).toBeNull()
})

test('7 · un celular antiguo sigue igual si no se toca; tocado, rige la regla; la API rechaza «abc» (AC-10, AC-13)', async ({ page }) => {
  const ficha = await altaPorLaApi({
    dni: dniAlAzar(),
    nombres: 'Olga',
    paterno: `Antigua ${MARCA} ${SUFIJO}`,
    ingreso: hoyEnLima(-10),
    sede: e!.sedeNorte.id,
    area: e!.area.id,
    cargo: e!.cargoAnalista.id,
  })
  sql(`update colaborador set celular = '01-4567890' where id = ${ficha};`)

  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/${ficha}`)
  await expect(page.getByText('01-4567890')).toBeVisible()
  await page.getByRole('button', { name: 'Editar' }).click()
  const campo = page.getByLabel(/^Celular/)
  await expect(campo).toHaveValue('01-4567890')
  expect(await prefijoDe(campo)).toBeNull()
  await page.getByLabel(/^Nacionalidad/).fill('Chilena')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible()
  expect(uno(`select celular, nacionalidad from colaborador where id = ${ficha}`)).toEqual({
    celular: '01-4567890',
    nacionalidad: 'Chilena',
  })
  await expect(page.getByText('01-4567890')).toBeVisible()

  // Tocado, se aplica la máscara y lo que no cumple la regla no se guarda.
  await page.getByRole('button', { name: 'Editar' }).click()
  await campo.press('End')
  await campo.press('Backspace')
  await expect(campo).toHaveValue('014 567 89')
  expect(await prefijoDe(campo)).toBe('+51')
  const puts: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().includes(`/colaboradores/${ficha}/perfil`)) puts.push(r.url())
  })
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(REGLA)).toBeVisible()
  expect(puts).toEqual([])
  expect(celularDeLaFicha(ficha)).toBe('01-4567890')

  // AC-13: la petición directa con «abc», al editar y al crear, es un 400 con la regla.
  const perfil = (await apiPanel<{ perfil: Record<string, unknown> }>(`/colaboradores/${ficha}`)).cuerpo.perfil
  const editar = await apiPanel(`/colaboradores/${ficha}/perfil`, {
    method: 'PUT',
    cuerpo: {
      tipoDocumento: perfil.tipoDocumento,
      numeroDocumento: perfil.numeroDocumento,
      nombres: perfil.nombres,
      apellidoPaterno: perfil.apellidoPaterno,
      fechaNacimiento: perfil.fechaNacimiento,
      sexo: perfil.sexo,
      nacionalidad: 'Chilena',
      celular: 'abc',
    },
  })
  expect(editar.estado).toBe(400)
  expect(JSON.stringify(editar.cuerpo)).toContain(REGLA)
  expect(celularDeLaFicha(ficha)).toBe('01-4567890')

  const antes = contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)
  const crear = await apiPanel('/colaboradores', {
    method: 'POST',
    cuerpo: {
      persona: {
        tipoDocumento: '01',
        numeroDocumento: dniAlAzar(),
        nombres: 'Abc',
        apellidoPaterno: `Abc ${MARCA} ${SUFIJO}`,
        fechaNacimiento: '1990-05-04',
        sexo: 'F',
        celular: 'abc',
      },
      fechaIngreso: hoyEnLima(),
      situacion: {
        sedeId: e!.sedeNorte.id,
        areaId: e!.area.id,
        cargoId: e!.cargoAnalista.id,
        jefeId: null,
        tipoContrato: '01',
        regimenLaboral: '01',
      },
    },
  })
  expect(crear.estado).toBe(400)
  expect(JSON.stringify(crear.cuerpo)).toContain(REGLA)
  expect(contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)).toBe(antes)
})

test('8 · el alta desde un contratado trae el celular de su cuenta y no el del CV (AC-11)', async ({ page }) => {
  const vacante = sembrarVacante(e!, `Contratado ${SUFIJO}`)
  vacantes.push(vacante)
  const conCuenta = correoDePrueba(PREFIJO_CORREO)
  const sinCelular = correoDePrueba(PREFIJO_CORREO)
  correos.push(conCuenta, sinCelular)
  await crearCuentaDeCandidato({ nombre: 'Lía', apellidos: `Contratada ${SUFIJO}`, correo: conCuenta, telefono: '+51987654321' })
  await crearCuentaDeCandidato({ nombre: 'Ada', apellidos: `Sin celular ${SUFIJO}`, correo: sinCelular })
  sql(`update persona set telefono = null
        where id = (select persona_id from usuario where correo = ${literal(sinCelular)});`)
  const contratada = sembrarPostulacion(vacante, conCuenta, 'CONTRATADO', '912 345 678')
  const delCv = sembrarPostulacion(vacante, sinCelular, 'CONTRATADO', '987-111-222')

  await entrarAlPanel(page)
  await page.goto(`/admin/colaboradores/nuevo?postulacion=${contratada}`)
  await expect(page.getByLabel('Nombres')).toHaveValue('Lía')
  await expect(page.getByLabel(/^Celular/)).toHaveValue('987 654 321')

  // Paso 8: sin celular en la cuenta, el del CV que cumple la regla, con la forma del campo.
  await page.goto(`/admin/colaboradores/nuevo?postulacion=${delCv}`)
  await expect(page.getByLabel('Nombres')).toHaveValue('Ada')
  await expect(page.getByLabel(/^Celular/)).toHaveValue('987 111 222')
})

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
  'Tipo de contrato *',
  'Régimen laboral *',
  'Celular',
]

function filaDelExcel(dni: string, celular: string): string[] {
  return [
    'DNI',
    dni,
    'Persona',
    `Carga ${MARCA} ${SUFIJO}`,
    '1990-01-01',
    'Femenino',
    hoyEnLima(-30),
    e!.sedeSur.nombre,
    e!.area.nombre,
    e!.cargoAnalista.nombre,
    'A plazo indeterminado',
    'General',
    celular,
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

test('9 · un Excel con el celular «12345» se rechaza entero; con «987 654 321» se guarda internacional (AC-12)', async ({ page }) => {
  await entrarAlPanel(page)
  const dni = dniAlAzar()
  const otro = dniAlAzar()
  const antes = contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)

  const modal = await subir(page, libroDeUnaHoja('Colaboradores', [CABECERAS, filaDelExcel(otro, '987 654 322'), filaDelExcel(dni, '12345')]))
  await expect(modal.getByRole('alert')).toContainText('No se guardó nada.')
  const errores = modal.getByRole('table', { name: 'Errores del archivo' })
  await expect(errores.getByRole('row')).toHaveCount(2)
  const fila = errores.getByRole('row').nth(1)
  await expect(fila.getByRole('cell').nth(0)).toHaveText('3')
  await expect(fila.getByRole('cell').nth(1)).toHaveText('Celular')
  await expect(fila.getByRole('cell').nth(2)).toHaveText('12345')
  await expect(fila.getByRole('cell').nth(3)).toHaveText(REGLA)
  expect(contar(`select 1 from colaborador where organizacion_id = ${e!.organizacion}`)).toBe(antes)

  const validos = await subir(page, libroDeUnaHoja('Colaboradores', [CABECERAS, filaDelExcel(otro, '987 654 322'), filaDelExcel(dni, '987 654 321')]))
  await expect(validos.getByRole('status')).toContainText('Se dieron de alta 2')
  expect(
    uno(`select celular from colaborador where organizacion_id = ${e!.organizacion} and numero_documento = ${literal(dni)}`)
      .celular,
  ).toBe('+51987654321')
  expect(
    uno(`select celular from colaborador where organizacion_id = ${e!.organizacion} and numero_documento = ${literal(otro)}`)
      .celular,
  ).toBe('+51987654322')
})

// ---------- 10 · El campo con error, entero bajo la cabecera fija ----------

const TAMANOS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const

/**
 * Lo enfocado tras enviar con errores: su etiqueta empieza por debajo de la
 * cabecera fija —la primera `<header>`, la del armazón— y su error acaba dentro
 * de la ventana. Antes el salto de `focus()` lo dejaba detrás de la píldora.
 */
async function loEnfocadoSeVeEntero(page: Page, donde: string) {
  const medidas = await page.evaluate(() => {
    const campo = document.activeElement as HTMLInputElement | HTMLSelectElement
    const idError = (campo.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .find((id) => id.endsWith('-error'))
    const error = idError ? document.getElementById(idError) : null
    return {
      cabecera: document.querySelector('header')!.getBoundingClientRect().bottom,
      etiqueta: campo.labels?.[0]?.getBoundingClientRect().top ?? null,
      error: error?.getBoundingClientRect().bottom ?? null,
      alto: window.innerHeight,
    }
  })
  expect(medidas.etiqueta, `${donde}: la etiqueta`).not.toBeNull()
  expect(medidas.error, `${donde}: el error`).not.toBeNull()
  expect(medidas.etiqueta!, `${donde}: la etiqueta bajo la cabecera`).toBeGreaterThanOrEqual(medidas.cabecera)
  expect(medidas.error!, `${donde}: el error dentro de la ventana`).toBeLessThanOrEqual(medidas.alto)
}

test('10 · al enviar con errores, el campo enfocado queda con su etiqueta y su error bajo la cabecera fija', async ({ page }) => {
  // El portal: el registro sin ciudad, que es lo que vio QA tapado.
  for (const tamano of TAMANOS) {
    await page.setViewportSize(tamano)
    await page.goto('/registro')
    await page.getByLabel(/^Nombre/).fill('Celia')
    await page.getByLabel(/^Apellidos/).fill(`Formato ${SUFIJO}`)
    await page.getByLabel(/^Correo/).fill(correoDePrueba(PREFIJO_CORREO))
    await celularDelRegistro(page).pressSequentially('987654321')
    await page.getByLabel(/^Contraseña/).fill(CLAVE_DE_CANDIDATO)
    await page.getByLabel('Repite la contraseña').fill(CLAVE_DE_CANDIDATO)
    await page.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /Crear cuenta/ }).click()
    await expect(page.getByLabel(/^Ciudad/)).toBeFocused()
    await loEnfocadoSeVeEntero(page, `registro a ${tamano.width} px`)
  }

  // El panel: el alta de un colaborador con el celular a medias.
  await entrarAlPanel(page)
  for (const tamano of TAMANOS) {
    await page.setViewportSize(tamano)
    await page.goto('/admin/colaboradores/nuevo')
    await llenarAlta(page, dniAlAzar(), `Foco ${MARCA} ${SUFIJO}`)
    const celular = page.getByLabel(/^Celular/)
    // El alta guarda su borrador en `sessionStorage`: en la segunda vuelta vuelve
    // con el «987 65» de la primera, y teclear encima lo completaba y lo daba de alta.
    await celular.clear()
    await celular.pressSequentially('98765')
    await expect(celular).toHaveValue('987 65')
    await page.getByRole('button', { name: 'Dar de alta' }).click()
    await expect(celular).toBeFocused()
    await loEnfocadoSeVeEntero(page, `alta de colaborador a ${tamano.width} px`)
    await expect(page).toHaveURL(/\/admin\/colaboradores\/nuevo/)
  }
})
