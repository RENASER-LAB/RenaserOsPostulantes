/**
 * «El brochure de la empresa, armado solo» (specs/Ready/brochure-de-la-empresa, V86): los
 * recorridos que pide «Verificación», contra el preview real y en escritorio (1280×800).
 *
 *   - Panel, con una cuenta de Talento, en dos pestañas: «Perfil» (por defecto) con misión y
 *     visión en «Presentación», y «Brochure» (`?pestana=brochure`) vacía (AC-01); la vista previa
 *     al escribir y el máximo de 400 (AC-02); guardar y descargar, con «Generando…» y el nombre
 *     del archivo (AC-03); el chip «Usa lo último guardado», que cambiar de pestaña no pierde lo
 *     escrito y la descarga con lo guardado (AC-06); el fallo del armado; «Columnas» y
 *     «Petróleo», que se guardan solos al elegirlos y vuelven a la anterior si no se guardan
 *     (AC-05); siempre al día desde el panel y desde el perfil (AC-08).
 *   - El PDF de la empresa A (la plataforma): «Dónde estamos» con las sedes activas (AC-12); sin
 *     logo ni portada (AC-09) y con ellos, con el logo transparente sobre blanco (AC-10); todo al
 *     máximo (AC-11) con tildes, «ñ», comillas, saltos y algo parecido a HTML (AC-13).
 *   - A y B (AC-14), sin permiso (AC-15) y los casos límite de la API.
 *   - Portal sin cuenta: misión y visión, una sola y ninguna; con el botón y sin él (AC-04, AC-07).
 *
 * ⚠️ **ESCRIBE** en el clon: empresas `QA-BROCH-08DB-*`, cuentas `qa-broch-08db-*`, sedes
 * `QA-BROCH-08DB …` de la plataforma, y la presentación de la plataforma (la de `dev-equipo`),
 * que se fotografía antes y se devuelve al terminar. Lo retira `afterAll`.
 */

import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { entrarAlPanelComo, pedir, subirImagen, tokenDe, type Empresa } from './ayuda-proposito-de-la-empresa'
import {
  colorEn,
  compacto,
  devolver,
  elegirYEsperar,
  elPanelDeLaPestana,
  enlacesDelPdf,
  esquinasDeLasImagenes,
  fotoDe,
  guardarPdf,
  hexARgb,
  imagenesDelPdf,
  irALaPestana,
  laPestanaDelModulo,
  laPlataforma,
  logoTransparente,
  MARCA,
  NOMBRE_DEL_ARCHIVO,
  nombreDeDisposicion,
  paginasDelPdf,
  parecido,
  perfilDe,
  portadaDegradada,
  presentacionEnBase,
  retirarLoSembrado,
  RUTA_DE_LA_ELECCION,
  sembrarCuentaDePanel,
  sembrarEmpresa,
  sembrarSede,
  textoDelPdf,
  tituloDelPdf,
  vaciarLaPresentacion,
  type Foto,
} from './ayuda-brochure'
import { sql } from './base-de-datos'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const EVIDENCIAS = process.env.E2E_EVIDENCIAS ?? ''
async function evidencia(page: Page, nombre: string) {
  if (EVIDENCIAS) await page.screenshot({ path: `${EVIDENCIAS}/${nombre}.png`, fullPage: true })
}

const HOY = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())

const QUIENES_A = 'Somos Cafetalera «Ñuñoa» & Cía.\nTostamos café de altura en el valle.\n<b>esto no es negrita</b>'
const PROPOSITO_A = 'Que cada taza cuente la historia de quien la cultivó.'
const MISION_A = 'Tostar café peruano con comercio justo y ñandutí.'
const SIN_GUARDAR = 'TEXTO SIN GUARDAR ZX9'
const QUIENES_NUEVO = 'Somos Cafetalera y ahora también tostamos cacao. NUEVO-Q8'

const COLORES = { AZUL: '#1E3A8A', VERDE: '#0B7A63', ROJO: '#C22A3F', NOCHE: '#111312', PETROLEO: '#155E75', CIRUELA: '#6B2D5C' } as const

let plataforma: Empresa
let foto: Foto
let imagenesSubidas = false
const panel = { talento: '', responsable: '' }
const e = {} as Record<'mv' | 'soloMision' | 'soloVision' | 'b' | 'suspendida' | 'largo' | 'enlaces', Empresa>
let fotoDeB: ReturnType<typeof presentacionEnBase>

const NOMBRE_LARGO =
  'Corporación Agroindustrial y Exportadora de Cafés Especiales del Valle Sagrado de los Incas Sociedad Anónima Cerrada QA'

const elFormulario = (page: Page) => page.getByRole('form', { name: 'Perfil de la empresa' })
const laVistaPrevia = (page: Page) => page.getByRole('complementary', { name: 'Vista previa del perfil público' })
const campo = (page: Page, etiqueta: string) => elFormulario(page).getByLabel(etiqueta, { exact: true })
const laSeccion = (page: Page) => elPanelDeLaPestana(page, 'Brochure')
const plantilla = (page: Page, nombre: string) =>
  page.getByRole('radiogroup', { name: 'Plantilla del brochure' }).getByRole('radio', { name: nombre, exact: true })
const color = (page: Page, nombre: string) =>
  page.getByRole('radiogroup', { name: 'Color' }).getByRole('radio', { name: nombre, exact: true })
const botonDescargar = (page: Page) => laSeccion(page).getByRole('button', { name: /Descargar brochure \(PDF\)|Generando…/ })
const RUTA_DEL_PANEL = '**/api/v1/panel/organizacion/presentacion/brochure'

async function guardar(page: Page) {
  await elFormulario(page).getByRole('button', { name: 'Guardar' }).click()
  await expect(elFormulario(page).getByRole('status')).toHaveText('Guardado. Tu perfil y tus vacantes publicadas ya lo muestran.')
}

/**
 * Lo que pasa en la pestaña que abre el panel: navega al PDF (`blob:`) o, en headless, Chromium
 * lo entrega como descarga. Se escucha desde que se abre, para no perderse la descarga.
 */
function vigilarLaPestana(page: Page) {
  const descargas: string[] = []
  page.once('popup', (p) => p.on('download', (d) => descargas.push(d.suggestedFilename())))
  return {
    estado: (pestana: Page) =>
      pestana.url().startsWith('blob:') ? `blob: ${pestana.url()}` : descargas.length ? `descarga: ${descargas.join(', ')}` : pestana.url(),
  }
}

/** Pulsa «Descargar brochure (PDF)» y devuelve el PDF que llegó, la pestaña nueva y sus cabeceras. */
async function descargarDesdeElPanel(page: Page, nombre: string) {
  // El cuerpo se toma en la ruta: `response.body()` llega vacío cuando la página ya lo consumió.
  let cuerpo: Buffer = Buffer.alloc(0)
  await page.route(RUTA_DEL_PANEL, async (ruta) => {
    const real = await ruta.fetch()
    cuerpo = await real.body()
    await ruta.fulfill({ response: real, body: cuerpo })
  })
  const abierta = vigilarLaPestana(page)
  const [pestana, respuesta] = await Promise.all([
    page.waitForEvent('popup'),
    page.waitForResponse((r) => r.url().endsWith('/organizacion/presentacion/brochure') && r.request().method() === 'GET'),
    botonDescargar(page).click(),
  ])
  expect(respuesta.status()).toBe(200)
  await expect.poll(() => abierta.estado(pestana)).not.toBe('about:blank')
  await page.unroute(RUTA_DEL_PANEL)
  const ruta = guardarPdf(test.info().outputPath('pdf'), nombre, cuerpo)
  return { pestana, ruta, cabeceras: respuesta.headers() }
}

async function bajarDelPanel(token: string, nombre: string) {
  const r = await pedir('/panel/organizacion/presentacion/brochure', { token })
  expect(r.estado, `brochure del panel (${nombre})`).toBe(200)
  return guardarPdf(test.info().outputPath('pdf'), nombre, r.bytes)
}

async function bajarDelPerfil(codigo: string, nombre: string) {
  const r = await pedir(`/portal/empresas/${encodeURIComponent(codigo.toLowerCase())}/brochure`)
  expect(r.estado, `brochure público (${nombre})`).toBe(200)
  return { ruta: guardarPdf(test.info().outputPath('pdf'), nombre, r.bytes), cabeceras: r.cabeceras }
}

/** Guarda por la API lo que ya hay con algunos cambios, como lo haría «Guardar». */
async function guardarPorApi(token: string, cambios: Record<string, unknown>) {
  const a = (await pedir('/panel/organizacion/presentacion', { token })).cuerpo
  const cuerpo = {
    sector: a.sector, tamano: a.tamano, anioFundacion: a.anioFundacion, quienesSomos: a.quienesSomos,
    propositoEmpresa: a.propositoEmpresa, beneficios: a.beneficios ?? [], videoPresentacion: a.videoPresentacion,
    paginaWeb: a.paginaWeb, redes: a.redes ?? {}, mision: a.mision, vision: a.vision,
    plantillaBrochure: a.plantillaBrochure, colorBrochure: a.colorBrochure, ...cambios,
  }
  const r = await pedir('/panel/organizacion/presentacion', { token, metodo: 'PUT', cuerpo })
  expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
  return r.cuerpo
}

/** Un texto de `n` caracteres que empieza y acaba con una marca propia. */
function largo(inicio: string, fin: string, n: number) {
  let s = inicio
  for (let i = 1; s.length < n; i++) s += ` palabra${i} añejo «ñandú» "dobles"`
  return s.slice(0, n - fin.length - 1).trimEnd().padEnd(n - fin.length - 1, 'x') + ' ' + fin
}

test.beforeAll(async () => {
  retirarLoSembrado()
  plataforma = laPlataforma()
  foto = fotoDe(plataforma.id)
  vaciarLaPresentacion(plataforma.id)

  panel.talento = sembrarCuentaDePanel('talento', 'TALENTO').renaserOsId
  panel.responsable = sembrarCuentaDePanel('responsable', 'RESPONSABLE_AREA').renaserOsId

  e.mv = sembrarEmpresa('MV', 'Textiles Ayllu QA', {
    quienes: 'Tejemos alpaca en Cusco desde hace tres generaciones.',
    proposito: 'Que el tejido andino viaje con quien lo hizo.',
    mision: 'Tejer prendas de alpaca con tintes naturales.\nPagar justo a cada tejedora.',
    vision: 'Ser la marca textil andina que todos reconocen.',
    web: 'https://www.textilesayllu-qa.pe',
    video: 'https://www.youtube.com/watch?v=abc123DEF45',
  })
  e.soloMision = sembrarEmpresa('SOLO-M', 'Panadería Solo Misión QA', {
    quienes: 'Horneamos pan de masa madre cada mañana.',
    mision: 'Hornear pan honesto para el barrio.',
  })
  e.soloVision = sembrarEmpresa('SOLO-V', 'Ferretería Solo Visión QA', {
    vision: 'Ser la ferretería de confianza del distrito.',
  })
  e.b = sembrarEmpresa('B', 'Empresa Bravo Sin Quiénes QA', {
    mision: 'MISION-DE-B-QA8 nunca debe salir en otra empresa.',
    vision: 'VISION-DE-B-QA8 tampoco.',
    redes: { FACEBOOK: 'https://www.facebook.com/bravo-de-b-qa8' },
  })
  e.suspendida = sembrarEmpresa('SUSP', 'Empresa Suspendida QA', { quienes: 'Tenía quiénes somos.' }, { activa: false })
  e.largo = sembrarEmpresa('LARGO', NOMBRE_LARGO, { quienes: 'Un nombre muy largo no se corta.', plantilla: 'PORTADA' })
  e.enlaces = sembrarEmpresa('ENLACES', 'Enlaces Raros QA', {
    quienes: 'Guardó enlaces que no son web antes de la regla.',
    web: 'javascript:alert(1)',
    redes: { FACEBOOK: 'ftp://facebook.com/raro', INSTAGRAM: 'https://www.instagram.com/enlacesraros' },
  })
  fotoDeB = presentacionEnBase(e.b.id)
})

test.afterAll(async () => {
  const errores: unknown[] = []
  const paso = async (accion: () => unknown) => {
    try { await accion() } catch (error) { errores.push(error) }
  }
  if (imagenesSubidas) {
    await paso(async () => {
      const token = await tokenDe('dev-equipo')
      await pedir('/panel/organizacion/presentacion/imagenes/logo', { token, metodo: 'DELETE' })
      await pedir('/panel/organizacion/presentacion/imagenes/portada', { token, metodo: 'DELETE' })
    })
  }
  await paso(() => devolver(foto))
  await paso(() => retirarLoSembrado())
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza: ${errores.map(String).join('\n')}`)
})

// =============================== Panel ===============================

test('AC-01: vacía, «Perfil» por defecto con «Misión» y «Visión» a «0 / 400» y nada del brochure; «Brochure» en su pestaña con «Clásica» y «Azul», la primera hoja al lado, el botón desactivado con «Falta «Quiénes somos»», ninguna mención a «opcional» y nada en Configuración', async ({ page }) => {
  // La API: sin «Quiénes somos», 409 en el panel y 404 en el perfil, que no da dirección.
  const token = await tokenDe(panel.talento)
  const r409 = await pedir('/panel/organizacion/presentacion/brochure', { token })
  expect(r409.estado).toBe(409)
  expect((await pedir(`/portal/empresas/${plataforma.codigo.toLowerCase()}/brochure`)).estado).toBe(404)
  const publico = await pedir(`/portal/empresas/${plataforma.codigo.toLowerCase()}`)
  expect(publico.cuerpo.brochure).toBeNull()
  expect(publico.cuerpo.mision).toBeNull()
  expect(publico.cuerpo.vision).toBeNull()

  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa')
  const form = elFormulario(page)
  await expect(form).toBeVisible()
  // Dos pestañas arriba, «Perfil» elegida por defecto.
  const pestanas = page.getByRole('tablist', { name: 'Secciones del perfil de la empresa' }).getByRole('tab')
  expect((await pestanas.allTextContents()).map((t) => t.trim())).toEqual(['Perfil', 'Brochure'])
  await expect(laPestanaDelModulo(page, 'Perfil')).toHaveAttribute('aria-selected', 'true')
  await expect(elPanelDeLaPestana(page, 'Perfil')).toBeVisible()
  expect((await laPestanaDelModulo(page, 'Brochure').boundingBox())!.y).toBeLessThan((await form.boundingBox())!.y)
  await expect(campo(page, 'Misión')).toHaveValue('')
  await expect(campo(page, 'Visión')).toHaveValue('')
  await expect(form.getByText('0 / 400', { exact: true })).toHaveCount(2)
  await expect(campo(page, 'Misión')).toHaveAttribute('maxlength', '400')
  await expect(campo(page, 'Visión')).toHaveAttribute('maxlength', '400')
  // Sin texto de ayuda debajo de ningún campo.
  const descripciones = await form
    .locator('input:not([type=file]), textarea, select')
    .evaluateAll((els) => els.map((el) => `${el.id}:${el.getAttribute('aria-describedby') ?? ''}`).filter((d) => !d.endsWith(':')))
  expect(descripciones).toEqual([])

  // Después de «Nuestro propósito» y antes de los beneficios.
  const y = async (l: ReturnType<typeof campo>) => (await l.boundingBox())!.y
  const yProposito = await y(campo(page, 'Nuestro propósito'))
  const yMision = await y(campo(page, 'Misión'))
  const yVision = await y(campo(page, 'Visión'))
  const yBeneficios = (await form.locator('#rotulo-beneficios').boundingBox())!.y
  expect(yProposito).toBeLessThan(yMision)
  expect(yMision).toBeLessThan(yVision)
  expect(yVision).toBeLessThan(yBeneficios)

  // «Perfil» lleva las tres secciones de siempre y nada del brochure.
  expect((await form.locator('h2').allTextContents()).map((t) => t.trim())).toEqual(['Identidad', 'Presentación', 'Video y enlaces'])
  await expect(elPanelDeLaPestana(page, 'Perfil').getByText(/brochure/i)).toHaveCount(0)
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByText(/opcional/i)).toHaveCount(0)
  // La vista previa no trae «Misión» ni «Visión».
  await expect(laVistaPrevia(page)).not.toContainText('Misión')
  await expect(laVistaPrevia(page)).not.toContainText('Visión')
  await evidencia(page, 'brochure-panel-vacio-perfil')

  await irALaPestana(page, 'Brochure')
  const seccion = laSeccion(page)
  await expect(form).toHaveCount(0)
  await expect(page.getByText(/opcional/i)).toHaveCount(0)
  // Se guarda al elegir: ni «Guardar» ni «Dejarlo» en la pestaña.
  await expect(seccion.getByRole('button', { name: 'Guardar' })).toHaveCount(0)
  await expect(seccion.getByRole('button', { name: 'Dejarlo' })).toHaveCount(0)

  // Tres tarjetas con su miniatura, «Clásica» elegida; seis colores, «Azul» elegido.
  const radiosPlantilla = page.getByRole('radiogroup', { name: 'Plantilla del brochure' }).getByRole('radio')
  await expect(radiosPlantilla).toHaveCount(3)
  expect((await radiosPlantilla.allTextContents()).map((t) => t.trim())).toEqual(['Clásica', 'Portada', 'Columnas'])
  await expect(radiosPlantilla.locator('svg')).toHaveCount(3)
  await expect(plantilla(page, 'Clásica')).toHaveAttribute('aria-checked', 'true')
  await expect(plantilla(page, 'Portada')).toHaveAttribute('aria-checked', 'false')
  await expect(plantilla(page, 'Columnas')).toHaveAttribute('aria-checked', 'false')
  const radiosColor = page.getByRole('radiogroup', { name: 'Color' }).getByRole('radio')
  await expect(radiosColor).toHaveCount(6)
  for (const nombre of ['Azul', 'Verde', 'Rojo', 'Noche', 'Petróleo', 'Ciruela']) await expect(color(page, nombre)).toBeVisible()
  await expect(color(page, 'Azul')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radiogroup', { name: 'Color' }).locator('[aria-checked="true"]')).toHaveCount(1)

  await expect(botonDescargar(page)).toHaveText('Descargar brochure (PDF)')
  await expect(botonDescargar(page)).toBeDisabled()
  await expect(seccion.getByText('Falta «Quiénes somos»', { exact: true })).toBeVisible()
  await expect(seccion.getByText('Usa lo último guardado')).toHaveCount(0)
  // Sin ninguna línea de ayuda: solo rótulos, nombres, el botón y su chip.
  const lineas = (await seccion.innerText()).split('\n').map((l) => l.trim().toLocaleLowerCase('es')).filter(Boolean)
  expect(lineas).toEqual(['Plantilla del brochure', 'Clásica', 'Portada', 'Columnas', 'Color', 'Descargar brochure (PDF)', 'Falta «Quiénes somos»'].map((l) => l.toLocaleLowerCase('es')))
  // Al lado, la primera hoja con la plantilla y el color elegidos.
  const hoja = seccion.getByRole('img', { name: 'Primera hoja del brochure: Clásica, Azul' })
  await expect(hoja).toBeVisible()
  await expect(hoja.locator('svg [fill="#1E3A8A"]').first()).toBeAttached()
  const cajaHoja = (await hoja.boundingBox())!
  const cajaBoton = (await botonDescargar(page).boundingBox())!
  expect(cajaHoja.x, 'la hoja, al lado de la elección').toBeGreaterThan(cajaBoton.x + cajaBoton.width)
  expect(cajaHoja.y + cajaHoja.height, 'la hoja entera a la vista a 1280×800').toBeLessThanOrEqual(800)
  await evidencia(page, 'brochure-panel-vacio')

  // Nada del brochure en Configuración.
  await page.goto('/admin/configuracion')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(/brochure/i)).toHaveCount(0)
  await expect(page.getByText('Plantilla del brochure')).toHaveCount(0)
})

test('AC-02: la misión sale en la vista previa al momento, debajo de «Nuestro propósito», y no entra el carácter 401', async ({ page }) => {
  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa')
  const previa = laVistaPrevia(page)
  await campo(page, 'Nuestro propósito').fill(PROPOSITO_A)
  await campo(page, 'Misión').fill(MISION_A)
  await expect(previa).toContainText('Misión')
  await expect(previa).toContainText(MISION_A)
  await expect(previa).not.toContainText('Visión')
  const texto = await previa.innerText()
  expect(texto.indexOf(PROPOSITO_A)).toBeGreaterThan(-1)
  expect(texto.indexOf(PROPOSITO_A)).toBeLessThan(texto.indexOf(MISION_A))
  // El mismo título pequeño en mayúsculas que los otros bloques.
  const titulos = await previa.locator('p', { hasText: /^(Nuestro propósito|Misión)$/ }).evaluateAll((els) =>
    els.map((el) => { const s = getComputedStyle(el); return `${el.className}|${s.textTransform}|${s.fontSize}` }))
  expect(titulos).toHaveLength(2)
  expect(titulos[0]).toBe(titulos[1])
  await campo(page, 'Visión').fill('Ser la marca de café más querida.')
  await expect(previa).toContainText('Visión')
  const conVision = await previa.innerText()
  expect(conVision.indexOf(MISION_A)).toBeLessThan(conVision.indexOf('Ser la marca de café más querida.'))

  // 400 sí, el 401 no entra.
  const cuatrocientos = largo('Misión larga.', 'M400', 400)
  expect(cuatrocientos.length).toBe(400)
  await campo(page, 'Misión').fill(cuatrocientos)
  await expect(elFormulario(page).getByText('400 / 400', { exact: true })).toBeVisible()
  await campo(page, 'Misión').press('Control+End')
  await page.keyboard.type('Z')
  expect((await campo(page, 'Misión').inputValue()).length).toBe(400)
  await expect(elFormulario(page).getByText('400 / 400', { exact: true })).toBeVisible()
  await evidencia(page, 'brochure-panel-mision-400')

  // «Dejarlo» lo descarta todo: la vista previa vuelve a no tener misión ni visión.
  await elFormulario(page).getByRole('button', { name: 'Dejarlo' }).click()
  await expect(previa).not.toContainText('Misión')
  await expect(previa).not.toContainText('Visión')
  await expect(campo(page, 'Misión')).toHaveValue('')
})

test('AC-03: guarda quiénes somos, propósito y web, luego la misión; «Generando…» y se abre «Brochure - {empresa}.pdf» sin «Visión» ni títulos vacíos', async ({ page }) => {
  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa')
  await campo(page, 'Quiénes somos').fill(QUIENES_A)
  await campo(page, 'Nuestro propósito').fill(PROPOSITO_A)
  await campo(page, 'Página web').fill('www.cafetalera-qa.pe')
  // Con «Quiénes somos» escrito pero sin guardar, el botón sigue desactivado.
  await irALaPestana(page, 'Brochure')
  await expect(botonDescargar(page)).toBeDisabled()
  await expect(laSeccion(page).getByText('Falta «Quiénes somos»', { exact: true })).toBeVisible()
  // Volver a «Perfil» no pierde lo escrito.
  await irALaPestana(page, 'Perfil')
  await expect(campo(page, 'Quiénes somos')).toHaveValue(QUIENES_A)
  await expect(campo(page, 'Página web')).toHaveValue('www.cafetalera-qa.pe')
  await guardar(page)
  await irALaPestana(page, 'Brochure')
  await expect(botonDescargar(page)).toBeEnabled()
  await expect(laSeccion(page).getByText('Falta «Quiénes somos»')).toHaveCount(0)
  await expect(laSeccion(page).getByText('Usa lo último guardado')).toHaveCount(0)

  await irALaPestana(page, 'Perfil')
  await campo(page, 'Misión').fill(MISION_A)
  await irALaPestana(page, 'Brochure')
  await expect(laSeccion(page).getByText('Usa lo último guardado', { exact: true })).toBeVisible()
  await irALaPestana(page, 'Perfil')
  await guardar(page)
  await irALaPestana(page, 'Brochure')
  await expect(laSeccion(page).getByText('Usa lo último guardado')).toHaveCount(0)
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ mision: MISION_A, vision: null, quienes_somos: QUIENES_A })

  // Mientras se arma: «Generando…» y no se puede volver a pulsar.
  let cuerpo: Buffer = Buffer.alloc(0)
  await page.route(RUTA_DEL_PANEL, async (ruta) => {
    await new Promise((listo) => setTimeout(listo, 1500))
    const real = await ruta.fetch()
    cuerpo = await real.body()
    await ruta.fulfill({ response: real, body: cuerpo })
  })
  const pedidas: string[] = []
  page.on('request', (r) => { if (r.url().endsWith('/organizacion/presentacion/brochure')) pedidas.push(r.url()) })
  const abierta = vigilarLaPestana(page)
  const [pestana, respuesta] = await Promise.all([
    page.waitForEvent('popup'),
    page.waitForResponse((r) => r.url().endsWith('/organizacion/presentacion/brochure')),
    (async () => {
      await botonDescargar(page).click()
      await expect(botonDescargar(page)).toHaveText('Generando…')
      await expect(botonDescargar(page)).toBeDisabled()
      await botonDescargar(page).click({ force: true }).catch(() => undefined)
    })(),
  ])
  await page.unroute(RUTA_DEL_PANEL)
  await expect(botonDescargar(page)).toHaveText('Descargar brochure (PDF)')
  await expect(botonDescargar(page)).toBeEnabled()
  expect(pedidas, 'un solo armado aunque se pulse dos veces').toHaveLength(1)
  expect(respuesta.status()).toBe(200)
  const cabeceras = respuesta.headers()
  expect(cabeceras['content-type']).toContain('application/pdf')
  expect(cabeceras['content-disposition']).toContain('inline')
  expect(nombreDeDisposicion(cabeceras['content-disposition'])).toBe(NOMBRE_DEL_ARCHIVO(plataforma.nombre))
  expect(cabeceras['cache-control']).toContain('no-store')
  // Se abre en otra pestaña, con el PDF (en headless, Chromium lo entrega como descarga).
  await expect.poll(() => abierta.estado(pestana)).not.toBe('about:blank')
  test.info().annotations.push({ type: 'pestaña del brochure', description: abierta.estado(pestana) })

  const ruta = guardarPdf(test.info().outputPath('pdf'), 'ac03-clasica-mision-sin-vision', cuerpo)
  expect(tituloDelPdf(ruta)).toBe(NOMBRE_DEL_ARCHIVO(plataforma.nombre).replace(/\.pdf$/, ''))
  const texto = textoDelPdf(ruta)
  const todo = compacto(texto)
  for (const parte of [plataforma.nombre, 'Somos Cafetalera «Ñuñoa» & Cía.', 'Tostamos café de altura en el valle.', '<b>esto no es negrita</b>', PROPOSITO_A, MISION_A, 'cafetalera-qa.pe']) {
    expect(texto, parte).toContain(parte)
  }
  expect(todo).toContain(compacto('Quiénes somos'))
  expect(todo).toContain(compacto('Nuestro propósito'))
  expect(todo).toContain(compacto('Misión'))
  expect(todo).not.toContain(compacto('Visión'))
  expect(todo).not.toContain(compacto('Beneficios'))
  expect(todo).not.toContain(compacto('Dónde estamos'))
  expect(todo).toContain(compacto(`Brochure generado con EX · ${HOY}`))
  // El orden del perfil: quiénes somos, propósito, misión, contacto.
  const orden = [compacto('Quiénes somos'), compacto('Nuestro propósito'), compacto('Misión'), compacto('Contacto')].map((t) => todo.indexOf(t))
  expect(orden).toEqual([...orden].sort((a, b) => a - b))
  expect(enlacesDelPdf(ruta)).toContain('https://www.cafetalera-qa.pe')
  await evidencia(page, 'brochure-panel-guardado')
})

test('AC-06: con cambios sin guardar en «Perfil» sale «Usa lo último guardado» en «Brochure», la descarga trae lo guardado, no lo escrito, y lo escrito sigue al volver', async ({ page }) => {
  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa?pestana=brochure')
  await expect(laPestanaDelModulo(page, 'Brochure')).toHaveAttribute('aria-selected', 'true')
  await expect(laSeccion(page).getByText('Usa lo último guardado')).toHaveCount(0)
  await irALaPestana(page, 'Perfil')
  await campo(page, 'Quiénes somos').fill(SIN_GUARDAR)
  await campo(page, 'Visión').fill('VISION SIN GUARDAR ZX9')
  await irALaPestana(page, 'Brochure')
  await expect(laSeccion(page).getByText('Usa lo último guardado', { exact: true })).toBeVisible()
  await expect(botonDescargar(page)).toBeEnabled()
  await evidencia(page, 'brochure-panel-usa-lo-guardado')
  const { ruta } = await descargarDesdeElPanel(page, 'ac06-lo-guardado')
  const texto = textoDelPdf(ruta)
  expect(texto).toContain('Tostamos café de altura en el valle.')
  expect(texto).not.toContain('ZX9')
  expect(compacto(texto)).not.toContain(compacto('Visión'))
  // Lo escrito sigue en el formulario de «Perfil».
  await irALaPestana(page, 'Perfil')
  await expect(campo(page, 'Quiénes somos')).toHaveValue(SIN_GUARDAR)
  await expect(campo(page, 'Visión')).toHaveValue('VISION SIN GUARDAR ZX9')
  await elFormulario(page).getByRole('button', { name: 'Dejarlo' }).click()
  await expect(campo(page, 'Quiénes somos')).toHaveValue(QUIENES_A)
  await irALaPestana(page, 'Brochure')
  await expect(laSeccion(page).getByText('Usa lo último guardado')).toHaveCount(0)
})

test('Falla el armado: al lado sale «No se pudo armar el brochure.», la pestaña se cierra y se puede volver a pulsar', async ({ page }) => {
  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa?pestana=brochure')
  await page.route(RUTA_DEL_PANEL, (ruta) =>
    ruta.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ status: 500, detail: 'fallo' }) }))
  const [pestana] = await Promise.all([page.waitForEvent('popup'), botonDescargar(page).click()])
  await expect(laSeccion(page).getByRole('alert')).toHaveText('No se pudo armar el brochure.')
  await expect.poll(() => pestana.isClosed()).toBe(true)
  await expect(botonDescargar(page)).toBeEnabled()
  await expect(botonDescargar(page)).toHaveText('Descargar brochure (PDF)')
  await evidencia(page, 'brochure-panel-fallo')
  await page.unroute(RUTA_DEL_PANEL)
  const { ruta } = await descargarDesdeElPanel(page, 'fallo-y-reintento')
  expect(paginasDelPdf(ruta)).toBeGreaterThanOrEqual(1)
  await expect(laSeccion(page).getByText('No se pudo armar el brochure.')).toHaveCount(0)
})

test('AC-05: «Columnas» y «Petróleo» se guardan solos al elegirlos (también con las flechas), la primera hoja cambia con ellos, si no se guarda vuelve la anterior y «Guardar» de «Perfil» no los pisa; la descarga sale así y la tarjeta elegida lleva el borde azul', async ({ page }) => {
  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa')
  await irALaPestana(page, 'Brochure')
  await expect(laSeccion(page).getByRole('button', { name: 'Guardar' })).toHaveCount(0)

  // Cada elección se guarda al momento, con la plantilla y el color que se ven.
  expect(await elegirYEsperar(page, () => plantilla(page, 'Columnas').click())).toEqual({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'AZUL' })
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ plantilla_brochure: 'COLUMNAS', color_brochure: 'AZUL' })
  expect(await elegirYEsperar(page, () => color(page, 'Petróleo').click())).toEqual({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'PETROLEO' })
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ plantilla_brochure: 'COLUMNAS', color_brochure: 'PETROLEO' })
  await expect(plantilla(page, 'Columnas')).toHaveAttribute('aria-checked', 'true')
  await expect(plantilla(page, 'Clásica')).toHaveAttribute('aria-checked', 'false')
  await expect(color(page, 'Petróleo')).toHaveAttribute('aria-checked', 'true')
  await expect(color(page, 'Azul')).toHaveAttribute('aria-checked', 'false')
  // Elegir no es un cambio sin guardar del perfil.
  await expect(laSeccion(page).getByText('Usa lo último guardado')).toHaveCount(0)
  // Al lado, la primera hoja de «Columnas» en petróleo.
  const hoja = laSeccion(page).getByRole('img', { name: 'Primera hoja del brochure: Columnas, Petróleo' })
  await expect(hoja).toBeVisible()
  await expect(hoja.locator(`svg [fill="${COLORES.PETROLEO}"]`).first()).toBeAttached()

  // El borde azul de Northstar en la elegida, no en las demás.
  const azul = await page.evaluate(() => {
    const d = document.createElement('div')
    d.style.color = 'var(--activo)'
    document.body.appendChild(d)
    const c = getComputedStyle(d).color
    d.remove()
    return c
  })
  expect(azul).toBe('rgb(30, 58, 138)')
  const borde = (nombre: string) => plantilla(page, nombre).evaluate((el) => getComputedStyle(el).borderTopColor)
  // El borde cambia con una transición de 150 ms.
  await expect.poll(() => borde('Columnas')).toBe(azul)
  expect(await borde('Clásica')).not.toBe(azul)
  const anillo = await color(page, 'Petróleo').evaluate((el) => getComputedStyle(el).boxShadow)
  expect(anillo).toContain(azul)

  // Con el teclado, como un grupo de radios: cada flecha también se guarda.
  await color(page, 'Petróleo').focus()
  expect(await elegirYEsperar(page, () => page.keyboard.press('ArrowRight'))).toEqual({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'CIRUELA' })
  await expect(color(page, 'Ciruela')).toHaveAttribute('aria-checked', 'true')
  await expect(color(page, 'Ciruela')).toBeFocused()
  expect(await elegirYEsperar(page, () => page.keyboard.press('ArrowLeft'))).toEqual({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'PETROLEO' })
  await expect(color(page, 'Petróleo')).toHaveAttribute('aria-checked', 'true')
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ plantilla_brochure: 'COLUMNAS', color_brochure: 'PETROLEO' })
  await evidencia(page, 'brochure-panel-columnas-petroleo')

  // Si no se guarda, vuelve la anterior y lo dice; en la base no cambia nada.
  await page.route(RUTA_DE_LA_ELECCION, (ruta) =>
    ruta.request().method() === 'PUT'
      ? ruta.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ status: 500, detail: 'fallo' }) })
      : ruta.fallback())
  await elegirYEsperar(page, () => plantilla(page, 'Portada').click(), 500)
  await expect(laSeccion(page).getByRole('alert')).toHaveText('No se guardó la elección.')
  await expect(plantilla(page, 'Columnas')).toHaveAttribute('aria-checked', 'true')
  await expect(plantilla(page, 'Portada')).toHaveAttribute('aria-checked', 'false')
  await expect(laSeccion(page).getByRole('img', { name: 'Primera hoja del brochure: Columnas, Petróleo' })).toBeVisible()
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ plantilla_brochure: 'COLUMNAS', color_brochure: 'PETROLEO' })
  await evidencia(page, 'brochure-panel-eleccion-no-guardada')
  await page.unroute(RUTA_DE_LA_ELECCION)

  // Cambiar de pestaña no pierde lo escrito, y «Guardar» de «Perfil» no manda ni la plantilla ni el color.
  await irALaPestana(page, 'Perfil')
  await campo(page, 'Visión').fill('VISION SIN GUARDAR AC05')
  await irALaPestana(page, 'Brochure')
  await expect(laSeccion(page).getByText('Usa lo último guardado', { exact: true })).toBeVisible()
  await irALaPestana(page, 'Perfil')
  await expect(campo(page, 'Visión')).toHaveValue('VISION SIN GUARDAR AC05')
  await elFormulario(page).getByRole('button', { name: 'Dejarlo' }).click()
  await expect(campo(page, 'Visión')).toHaveValue('')
  const [peticion] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/v1/panel/organizacion/presentacion') && r.method() === 'PUT'),
    guardar(page),
  ])
  const cuerpo = peticion.postDataJSON() as Record<string, unknown>
  expect(cuerpo.quienesSomos).toBe(QUIENES_A)
  expect(cuerpo).not.toHaveProperty('plantillaBrochure')
  expect(cuerpo).not.toHaveProperty('colorBrochure')
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ plantilla_brochure: 'COLUMNAS', color_brochure: 'PETROLEO' })

  // Se quedó guardado: al recargar, la pestaña sigue en la dirección y con lo elegido.
  await irALaPestana(page, 'Brochure')
  await page.reload()
  await expect(laPestanaDelModulo(page, 'Brochure')).toHaveAttribute('aria-selected', 'true')
  await expect(plantilla(page, 'Columnas')).toHaveAttribute('aria-checked', 'true')
  await expect(color(page, 'Petróleo')).toHaveAttribute('aria-checked', 'true')

  const { ruta } = await descargarDesdeElPanel(page, 'ac05-columnas-petroleo')
  // La columna del color a la izquierda, de arriba abajo.
  for (const y of [0.3, 0.6, 0.95]) expect(parecido(colorEn(ruta, 1, 0.03, y), hexARgb(COLORES.PETROLEO)), `columna en y=${y}`).toBe(true)
  // A la derecha, el papel.
  expect(parecido(colorEn(ruta, 1, 0.9, 0.9), [255, 255, 255])).toBe(true)
  const pagina1 = textoDelPdf(ruta, 1)
  expect(pagina1).toContain(plataforma.nombre)
})

test('AC-08: tras cambiar «Quiénes somos» y guardar, la siguiente descarga desde el panel y desde el perfil trae el texto nuevo', async ({ page }) => {
  const antes = await bajarDelPerfil(plataforma.codigo, 'ac08-perfil-antes')
  expect(textoDelPdf(antes.ruta)).toContain('Tostamos café de altura en el valle.')

  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin/empresa')
  await campo(page, 'Quiénes somos').fill(QUIENES_NUEVO)
  await guardar(page)
  await irALaPestana(page, 'Brochure')
  const { ruta } = await descargarDesdeElPanel(page, 'ac08-panel-despues')
  expect(textoDelPdf(ruta)).toContain(QUIENES_NUEVO)
  expect(textoDelPdf(ruta)).not.toContain('Tostamos café de altura en el valle.')
  const despues = await bajarDelPerfil(plataforma.codigo, 'ac08-perfil-despues')
  expect(textoDelPdf(despues.ruta)).toContain(QUIENES_NUEVO)
  expect(textoDelPdf(despues.ruta)).not.toContain('Tostamos café de altura en el valle.')
  // Sin caché pública.
  expect(despues.cabeceras.get('cache-control')).toContain('no-store')
})

// =============================== El PDF de A ===============================

test('AC-12: «Dónde estamos» trae solo las provincias de las sedes activas, sin direcciones, y un cambio en las sedes se ve en la siguiente descarga', async () => {
  const token = await tokenDe(panel.talento)
  sembrarSede(plataforma.id, 'Sede Cusco', '0801', 'Av. El Sol 123, Cusco')
  const arequipa = sembrarSede(plataforma.id, 'Sede Arequipa', '0401', 'Calle Mercaderes 456')
  sembrarSede(plataforma.id, 'Sede Piura cerrada', '2001', 'Jr. Lima 789, Piura', false)
  const ruta = await bajarDelPanel(token, 'ac12-sedes')
  const texto = textoDelPdf(ruta)
  expect(compacto(texto)).toContain(compacto('Dónde estamos'))
  expect(texto).toContain('Cusco')
  expect(texto).toContain('Arequipa')
  expect(texto).not.toContain('Piura')
  for (const direccion of ['Av. El Sol', 'Mercaderes', 'Jr. Lima', '123', '456', '789']) expect(texto, direccion).not.toContain(direccion)
  expect(texto).not.toContain(MARCA)

  // Configuración → Sedes: al desactivar una, la siguiente descarga ya no la trae.
  sql(`update sede set es_activa = false where id = ${arequipa};`)
  const otra = textoDelPdf(await bajarDelPanel(token, 'ac12-sede-desactivada'))
  expect(otra).toContain('Cusco')
  expect(otra).not.toContain('Arequipa')
})

test('AC-09: sin logo ni portada, las tres plantillas salen sin imágenes ni huecos, con las iniciales y el nombre', async () => {
  const token = await tokenDe(panel.talento)
  for (const [p, c] of [['CLASICA', 'AZUL'], ['PORTADA', 'VERDE'], ['COLUMNAS', 'ROJO']] as const) {
    await guardarPorApi(token, { plantillaBrochure: p, colorBrochure: c })
    const ruta = await bajarDelPanel(token, `ac09-${p.toLowerCase()}-sin-fotos`)
    expect(imagenesDelPdf(ruta), `${p}: ninguna imagen`).toEqual([])
    const primera = textoDelPdf(ruta, 1)
    expect(primera, p).toContain('RC')
    expect(compacto(primera), p).toContain(compacto(plataforma.nombre))
    if (p === 'PORTADA') {
      // La primera hoja es el color elegido, no un recuadro vacío (abajo lleva su banda, como la maqueta).
      for (const [x, y] of [[0.5, 0.012], [0.01, 0.5], [0.99, 0.95]]) expect(parecido(colorEn(ruta, 1, x!, y!), hexARgb(COLORES.VERDE)), `portada ${x},${y}`).toBe(true)
    }
    if (p === 'COLUMNAS') expect(parecido(colorEn(ruta, 1, 0.03, 0.5), hexARgb(COLORES.ROJO))).toBe(true)
    expect(paginasDelPdf(ruta)).toBeLessThanOrEqual(3)
  }
})

test('AC-10: con logo (PNG transparente) y portada, «Portada» la lleva a toda la primera hoja, «Columnas» como franja y el logo sale en las tres, sobre blanco', async () => {
  const token = await tokenDe(panel.talento)
  imagenesSubidas = true
  expect((await subirImagen(token, 'logo', logoTransparente())).estado).toBe(200)
  expect((await subirImagen(token, 'portada', portadaDegradada())).estado).toBe(200)

  await guardarPorApi(token, { plantillaBrochure: 'CLASICA', colorBrochure: 'AZUL' })
  const clasica = await bajarDelPanel(token, 'ac10-clasica-con-fotos')
  const imgClasica = imagenesDelPdf(clasica)
  expect(imgClasica.some((i) => i.pagina === 1 && i.ancho === 512 && i.alto === 512), 'logo en «Clásica»').toBe(true)
  expect(imgClasica.some((i) => i.ancho === 1600), '«Clásica» no usa la portada').toBe(false)
  expect(imgClasica.some((i) => i.tipo === 'smask'), 'ninguna transparencia incrustada').toBe(false)
  // El logo transparente va aplanado sobre blanco: su esquina es blanca, nunca negra.
  const logo = esquinasDeLasImagenes(clasica, 1, test.info().outputPath('imagenes')).find((i) => i.ancho === 512)!
  expect(parecido(logo.esquina, [255, 255, 255], 3), `esquina del logo ${logo.esquina}`).toBe(true)

  await guardarPorApi(token, { plantillaBrochure: 'PORTADA', colorBrochure: 'VERDE' })
  const portada = await bajarDelPanel(token, 'ac10-portada-con-fotos')
  const imgPortada = imagenesDelPdf(portada)
  expect(imgPortada.some((i) => i.pagina === 1 && i.ancho === 1600 && i.alto === 400), 'la foto de portada en la primera hoja').toBe(true)
  expect(imgPortada.some((i) => i.pagina === 1 && i.ancho === 512), 'el logo en la portada').toBe(true)
  // A toda la página: arriba y abajo no queda el color liso ni el papel.
  for (const [x, y] of [[0.5, 0.02], [0.02, 0.5], [0.98, 0.98]]) {
    const punto = colorEn(portada, 1, x!, y!)
    expect(parecido(punto, [255, 255, 255], 10), `portada ${x},${y} no es papel`).toBe(false)
  }
  expect(textoDelPdf(portada, 1)).toContain(PROPOSITO_A)

  await guardarPorApi(token, { plantillaBrochure: 'COLUMNAS', colorBrochure: 'PETROLEO' })
  const columnas = await bajarDelPanel(token, 'ac10-columnas-con-fotos')
  const imgColumnas = imagenesDelPdf(columnas)
  expect(imgColumnas.some((i) => i.pagina === 1 && i.ancho === 1600), 'la franja de portada').toBe(true)
  expect(imgColumnas.some((i) => i.pagina === 1 && i.ancho === 512), 'el logo en la columna').toBe(true)
  // Franja: arriba a la derecha hay foto; más abajo, el papel con los textos.
  expect(parecido(colorEn(columnas, 1, 0.7, 0.05), [255, 255, 255], 10)).toBe(false)
  expect(parecido(colorEn(columnas, 1, 0.7, 0.85), [255, 255, 255], 10)).toBe(true)

  // El perfil público enseña el mismo PDF.
  const publico = await bajarDelPerfil(plataforma.codigo, 'ac10-columnas-perfil')
  expect(imagenesDelPdf(publico.ruta).length).toBe(imgColumnas.length)
})

test('AC-11 · AC-13: con todos los textos al máximo y caracteres especiales nada se corta y ninguna plantilla pasa de tres hojas; se arma en menos de 3 s', async () => {
  const token = await tokenDe(panel.talento)
  const quienes = largo('Quiénes «Ñuñoa» & Cía.\n<b>no es negrita</b> <script>alert(1)</script>\nSegunda línea.', 'QFIN1500', 1500)
  const proposito = largo('Propósito con tildes áéíóú.\nOtra línea.', 'PFIN1500', 1500)
  const mision = largo('Misión «larga»\n<i>cursiva falsa</i>', 'MFIN400', 400)
  const vision = largo('Visión "larga" con ñ', 'VFIN400', 400)
  const beneficios = Array.from({ length: 12 }, (_, i) => `Beneficio ${String(i + 1).padStart(2, '0')} ñandú «x» áéíóú`.padEnd(40, 'z').slice(0, 40))
  const redes = {
    FACEBOOK: 'https://www.facebook.com/cafetaleraqa', INSTAGRAM: 'https://www.instagram.com/cafetaleraqa',
    LINKEDIN: 'https://www.linkedin.com/company/cafetaleraqa', TIKTOK: 'https://www.tiktok.com/@cafetaleraqa',
    YOUTUBE: 'https://www.youtube.com/@cafetaleraqa',
  }
  expect([quienes.length, proposito.length, mision.length, vision.length]).toEqual([1500, 1500, 400, 400])
  for (const [p, c] of [['CLASICA', 'NOCHE'], ['PORTADA', 'CIRUELA'], ['COLUMNAS', 'AZUL']] as const) {
    await guardarPorApi(token, {
      quienesSomos: quienes, propositoEmpresa: proposito, mision, vision, beneficios, redes,
      sector: 'Agroindustria y café de especialidad', tamano: 'DE_51_A_200', anioFundacion: 1987,
      videoPresentacion: 'https://www.youtube.com/watch?v=abc123DEF45', paginaWeb: 'https://www.cafetalera-qa.pe',
      plantillaBrochure: p, colorBrochure: c,
    })
    const inicio = Date.now()
    const ruta = await bajarDelPanel(token, `ac11-${p.toLowerCase()}-al-maximo`)
    expect(Date.now() - inicio, `${p}: tiempo de armado`).toBeLessThan(3000)
    const hojas = paginasDelPdf(ruta)
    expect(hojas, `${p}: hojas`).toBeGreaterThanOrEqual(1)
    expect(hojas, `${p}: hojas`).toBeLessThanOrEqual(3)
    const texto = textoDelPdf(ruta)
    const todo = compacto(texto)
    // Quiénes somos y propósito, enteros y en su orden. En «Columnas» se lee solo la columna de
    // los textos (desde x = 180 pt en la primera hoja y a la derecha de la franja estrecha, desde
    // x = 60 pt, en las siguientes), para no mezclarla con la columna del color.
    const textos = p === 'COLUMNAS'
      ? compacto(Array.from({ length: hojas }, (_, i) => textoDelPdf(ruta, i + 1, i === 0 ? 180 : 60)).join(' '))
      : todo
    expect(textos, `${p}: quiénes somos entero`).toContain(compacto(quienes))
    expect(textos, `${p}: propósito entero`).toContain(compacto(proposito))
    // Misión y visión van en dos columnas: su principio y su final.
    for (const marca of ['Misión «larga»', '<i>cursiva falsa</i>', 'MFIN400', 'Visión "larga" con ñ', 'VFIN400']) expect(texto, `${p}: ${marca}`).toContain(marca)
    for (const b of beneficios) expect(todo, `${p}: ${b}`).toContain(compacto(b))
    for (const especial of ['«Ñuñoa» & Cía.', '<b>no es negrita</b>', '<script>alert(1)</script>', 'áéíóú']) expect(texto, `${p}: ${especial}`).toContain(especial)
    const enlaces = enlacesDelPdf(ruta)
    expect(enlaces, `${p}: enlaces`).toEqual(expect.arrayContaining([
      ...Object.values(redes), 'https://www.cafetalera-qa.pe', 'https://www.youtube.com/watch?v=abc123DEF45',
      `${new URL(test.info().project.use.baseURL!).origin}/empresas/${plataforma.codigo.toLowerCase()}`,
    ]))
    for (const escrito of ['facebook.com/cafetaleraqa', 'linkedin.com/company/cafetaleraqa', 'cafetalera-qa.pe', 'youtube.com/watch?v=abc123DEF45']) {
      expect(texto, `${p}: ${escrito} escrito`).toContain(escrito)
    }
    expect(todo).toContain(compacto(`Brochure generado con EX · ${HOY}`))
    // El pie va en la última hoja.
    expect(compacto(textoDelPdf(ruta, hojas))).toContain(compacto('Brochure generado con EX'))
  }
})

test('AC-13: en el perfil público todo se lee tal cual se escribió, sin convertirse en HTML', async ({ page }) => {
  await page.goto(perfilDe(plataforma))
  await expect(page.getByRole('heading', { level: 1, name: plataforma.nombre })).toBeVisible()
  const bloque = page.getByRole('region', { name: 'Misión y visión' })
  await expect(bloque).toBeVisible()
  await expect(bloque).toContainText('<i>cursiva falsa</i>')
  await expect(bloque.locator('i')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Quiénes somos' })).toContainText('<b>no es negrita</b> <script>alert(1)</script>')
  await expect(page.locator('main b, main script')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Quiénes somos' })).toContainText('Quiénes «Ñuñoa» & Cía.')
  const lineas = await page.getByRole('region', { name: 'Quiénes somos' }).locator('p').innerText()
  expect(lineas.split('\n').length).toBeGreaterThanOrEqual(3)
  await expect(page.getByRole('link', { name: 'Descargar brochure (PDF)' })).toBeVisible()
  await evidencia(page, 'brochure-perfil-plataforma-al-maximo')
})

// =============================== A y B, permisos y la API ===============================

test('AC-14: A guarda y descarga y B no cambia; el brochure de A no enseña nada de B', async () => {
  const token = await tokenDe(panel.talento)
  await guardarPorApi(token, { mision: 'Misión de A tras guardar.', plantillaBrochure: 'CLASICA', colorBrochure: 'AZUL' })
  const ruta = await bajarDelPanel(token, 'ac14-a')
  const publico = await bajarDelPerfil(plataforma.codigo, 'ac14-a-perfil')
  for (const r of [ruta, publico.ruta]) {
    const texto = textoDelPdf(r)
    expect(texto).toContain('Misión de A tras guardar.')
    for (const deB of [e.b.nombre, 'MISION-DE-B-QA8', 'VISION-DE-B-QA8', 'bravo-de-b-qa8']) expect(texto, deB).not.toContain(deB)
    expect(enlacesDelPdf(r).some((u) => u.includes('bravo-de-b-qa8'))).toBe(false)
  }
  expect(presentacionEnBase(e.b.id)).toEqual(fotoDeB)
  // B no tiene lo mínimo: ni botón ni brochure.
  expect((await pedir(`/portal/empresas/${e.b.codigo.toLowerCase()}/brochure`)).estado).toBe(404)
  const panelA = await pedir('/panel/organizacion/presentacion', { token })
  expect(panelA.cuerpo.codigo).toBe(plataforma.codigo)

  // La pestaña «Brochure» también guarda solo en A: B no cambia, y el PDF de A ya sale con lo nuevo.
  const antesDeElegir = (await pedir(`/portal/empresas/${plataforma.codigo.toLowerCase()}/brochure`)).bytes
  const eleccion = await pedir('/panel/organizacion/presentacion/brochure', {
    token, metodo: 'PUT', cuerpo: { plantillaBrochure: 'PORTADA', colorBrochure: 'VERDE' },
  })
  expect(eleccion.estado, JSON.stringify(eleccion.cuerpo)).toBe(200)
  expect(eleccion.cuerpo).toMatchObject({ codigo: plataforma.codigo, plantillaBrochure: 'PORTADA', colorBrochure: 'VERDE', mision: 'Misión de A tras guardar.' })
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ plantilla_brochure: 'PORTADA', color_brochure: 'VERDE', mision: 'Misión de A tras guardar.' })
  expect(presentacionEnBase(e.b.id)).toEqual(fotoDeB)
  const trasElegir = (await pedir(`/portal/empresas/${plataforma.codigo.toLowerCase()}/brochure`)).bytes
  expect(trasElegir.equals(antesDeElegir), 'el PDF recordado no sobrevive a otra plantilla').toBe(false)
})

test('AC-15: Responsable del área recibe 403 al guardar y al descargar desde el panel, y no cambia nada; la descarga pública sigue funcionando', async () => {
  const antes = presentacionEnBase(plataforma.id)
  const token = await tokenDe(panel.responsable)
  const put = await pedir('/panel/organizacion/presentacion', {
    token, metodo: 'PUT',
    cuerpo: { quienesSomos: 'Intento sin permiso', mision: 'Intento', beneficios: [], redes: {}, plantillaBrochure: 'PORTADA', colorBrochure: 'ROJO' },
  })
  expect(put.estado).toBe(403)
  expect((await pedir('/panel/organizacion/presentacion/brochure', { token })).estado).toBe(403)
  const eleccion = await pedir('/panel/organizacion/presentacion/brochure', {
    token, metodo: 'PUT', cuerpo: { plantillaBrochure: 'COLUMNAS', colorBrochure: 'NOCHE' },
  })
  expect(eleccion.estado, 'la elección de la pestaña «Brochure» sin el permiso').toBe(403)
  expect(presentacionEnBase(plataforma.id)).toEqual(antes)
  const publico = await pedir(`/portal/empresas/${plataforma.codigo.toLowerCase()}/brochure`)
  expect(publico.estado).toBe(200)
  expect(publico.cabeceras.get('content-type')).toContain('application/pdf')
  expect(publico.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('Casos límite de la API: solo espacios se guarda vacía; 401 caracteres, plantilla o color fuera del catálogo (también en la pestaña «Brochure») son un 400 y no se guarda nada', async () => {
  const token = await tokenDe(panel.talento)
  await guardarPorApi(token, { mision: '    ', vision: ' \n ' })
  expect(presentacionEnBase(plataforma.id)).toMatchObject({ mision: null, vision: null })
  await guardarPorApi(token, { mision: 'Misión que se queda.', vision: 'Visión que se queda.', plantillaBrochure: 'PORTADA', colorBrochure: 'ROJO' })
  const antes = presentacionEnBase(plataforma.id)
  const a = (await pedir('/panel/organizacion/presentacion', { token })).cuerpo
  const base = { ...a, beneficios: a.beneficios ?? [], redes: a.redes ?? {} }
  for (const [cambio, campoDeError, mensaje] of [
    [{ mision: 'm'.repeat(401) }, 'mision', 'La misión admite hasta 400 caracteres'],
    [{ vision: 'v'.repeat(401) }, 'vision', 'La visión admite hasta 400 caracteres'],
    [{ plantillaBrochure: 'MODERNA' }, 'plantillaBrochure', 'Esa plantilla no está entre las que se ofrecen'],
    [{ colorBrochure: 'DORADO' }, 'colorBrochure', 'Ese color no está entre los que se ofrecen'],
    [{ colorBrochure: '#FF0000' }, 'colorBrochure', 'Ese color no está entre los que se ofrecen'],
  ] as const) {
    const r = await pedir('/panel/organizacion/presentacion', { token, metodo: 'PUT', cuerpo: { ...base, quienesSomos: 'Cambio que no debe quedar', ...cambio } })
    expect(r.estado, JSON.stringify(cambio)).toBe(400)
    expect(r.cuerpo.errores[campoDeError]).toBe(mensaje)
    expect(presentacionEnBase(plataforma.id)).toEqual(antes)
  }
  // La pestaña «Brochure»: los dos del catálogo y los dos presentes; si no, 400 y nada cambia.
  for (const [cuerpo, campos] of [
    [{ plantillaBrochure: 'MODERNA', colorBrochure: 'DORADO' }, ['plantillaBrochure', 'colorBrochure']],
    [{ plantillaBrochure: 'COLUMNAS', colorBrochure: '#FF0000' }, ['colorBrochure']],
    [{ plantillaBrochure: 'columnas', colorBrochure: 'VERDE' }, ['plantillaBrochure']],
    [{ plantillaBrochure: 'COLUMNAS' }, ['colorBrochure']],
    [{}, ['plantillaBrochure', 'colorBrochure']],
  ] as const) {
    const r = await pedir('/panel/organizacion/presentacion/brochure', { token, metodo: 'PUT', cuerpo })
    expect(r.estado, JSON.stringify(cuerpo)).toBe(400)
    expect(Object.keys(r.cuerpo.errores).sort(), JSON.stringify(cuerpo)).toEqual([...campos].sort())
    expect(presentacionEnBase(plataforma.id)).toEqual(antes)
  }

  // 400 exactos sí.
  await guardarPorApi(token, { mision: 'm'.repeat(400), vision: 'v'.repeat(400) })
  expect(String(presentacionEnBase(plataforma.id).mision).length).toBe(400)
})

test('Casos límite del perfil: suspendida y código inexistente dan 404; el nombre largo se parte y el archivo lo recorta a 80; solo enlaces http(s) en el PDF', async () => {
  expect((await pedir(`/portal/empresas/${e.suspendida.codigo.toLowerCase()}`)).estado).toBe(404)
  expect((await pedir(`/portal/empresas/${e.suspendida.codigo.toLowerCase()}/brochure`)).estado).toBe(404)
  expect((await pedir('/portal/empresas/no-existe-qa-broch-08db/brochure')).estado).toBe(404)

  const largoPdf = await bajarDelPerfil(e.largo.codigo, 'limite-nombre-largo')
  const disposicion = largoPdf.cabeceras.get('content-disposition') ?? ''
  const recortado = NOMBRE_LARGO.slice(0, 80).trim()
  expect(disposicion).toContain('inline')
  expect(nombreDeDisposicion(disposicion)).toBe(`Brochure - ${recortado}.pdf`)
  expect(compacto(textoDelPdf(largoPdf.ruta, 1))).toContain(compacto(NOMBRE_LARGO))
  expect(paginasDelPdf(largoPdf.ruta)).toBeLessThanOrEqual(3)

  const enlaces = await bajarDelPerfil(e.enlaces.codigo, 'limite-enlaces-raros')
  const urls = enlacesDelPdf(enlaces.ruta)
  expect(urls.every((u) => /^https?:\/\//.test(u)), urls.join(', ')).toBe(true)
  expect(urls).toContain('https://www.instagram.com/enlacesraros')
  const texto = textoDelPdf(enlaces.ruta)
  expect(texto).not.toContain('javascript')
  expect(texto).not.toContain('ftp://')
})

// =============================== Portal sin cuenta ===============================

test('AC-04 · AC-07: con misión y visión, el bloque «Misión y visión» en dos columnas tras el propósito y antes del video; «Descargar brochure (PDF)» tras «Ver vacantes» y «Visitar web» abre el PDF sin cuenta', async ({ page }) => {
  await page.goto(perfilDe(e.mv))
  await expect(page.getByRole('heading', { level: 1, name: e.mv.nombre })).toBeVisible()
  const bloque = page.getByRole('region', { name: 'Misión y visión' })
  await expect(bloque).toBeVisible()
  await expect(bloque.getByRole('heading', { level: 3, name: 'Misión' })).toBeVisible()
  await expect(bloque.getByRole('heading', { level: 3, name: 'Visión' })).toBeVisible()
  await expect(bloque).toContainText('Tejer prendas de alpaca con tintes naturales.')
  await expect(bloque).toContainText('Ser la marca textil andina que todos reconocen.')
  const m = (await bloque.getByRole('heading', { level: 3, name: 'Misión', exact: true }).boundingBox())!
  const v = (await bloque.getByRole('heading', { level: 3, name: 'Visión', exact: true }).boundingBox())!
  expect(Math.abs(m.y - v.y)).toBeLessThan(4)
  expect(v.x).toBeGreaterThan(m.x + m.width)
  // El mismo estilo que «Quiénes somos».
  const clase = async (nombre: string) => page.getByRole('region', { name: nombre }).evaluate((el) => el.className)
  expect(await clase('Misión y visión')).toBe(await clase('Quiénes somos'))
  // Después de «Nuestro propósito» y antes del video.
  const orden = await page.evaluate((nombre) => {
    const principal = Array.from(document.querySelectorAll('section'))
    const i = (f: (s: Element) => boolean) => principal.findIndex(f)
    return [
      i((s) => s.getAttribute('aria-labelledby') === 'nuestro-proposito'),
      i((s) => s.getAttribute('aria-labelledby') === 'mision-vision'),
      i((s) => s.getAttribute('aria-label') === `Video de ${nombre}`),
    ]
  }, e.mv.nombre)
  expect(orden[0]).toBeGreaterThanOrEqual(0)
  expect(orden[1]).toBe(orden[0]! + 1)
  expect(orden[2]).toBe(orden[1]! + 1)

  // El botón, después de «Ver vacantes (N)» y «Visitar web», con el icono de descarga.
  const acciones = await page.locator('header a').evaluateAll((els) => els.map((el) => el.textContent!.trim()))
  const iVer = acciones.findIndex((t) => /^Ver vacantes \(\d+\)$/.test(t))
  const iWeb = acciones.indexOf('Visitar web')
  const iPdf = acciones.indexOf('Descargar brochure (PDF)')
  expect(iVer).toBeGreaterThanOrEqual(0)
  expect(iWeb).toBeGreaterThan(iVer)
  expect(iPdf).toBeGreaterThan(iWeb)
  const boton = page.getByRole('link', { name: 'Descargar brochure (PDF)' })
  await expect(boton.locator('svg')).toHaveCount(1)
  await expect(boton).toHaveAttribute('target', '_blank')
  const href = (await boton.getAttribute('href'))!
  expect(href).toMatch(new RegExp(`/api/v1/portal/empresas/${e.mv.codigo.toLowerCase()}/brochure$`))
  await evidencia(page, 'brochure-perfil-mision-y-vision')
  // La pestaña nueva pide el PDF (en headless, Chromium lo entrega como descarga y la pestaña se
  // queda sin dirección).
  const peticion = page.context().waitForEvent('request', (r) => r.url().endsWith(`/${e.mv.codigo.toLowerCase()}/brochure`))
  const [pestana] = await Promise.all([page.waitForEvent('popup'), boton.click()])
  const pedida = await peticion
  expect(pedida.isNavigationRequest()).toBe(true)
  expect(pedida.frame().page()).toBe(pestana)
  expect(pedida.headers().authorization).toBeUndefined()
  await pestana.close()
  const pdf = await pedir(new URL(href, page.url()).toString())
  expect(pdf.estado).toBe(200)
  expect(pdf.cabeceras.get('content-type')).toContain('application/pdf')
  expect(pdf.cabeceras.get('content-disposition')).toContain('inline')
  expect(nombreDeDisposicion(pdf.cabeceras.get('content-disposition'))).toBe(NOMBRE_DEL_ARCHIVO(e.mv.nombre))
  const ruta = guardarPdf(test.info().outputPath('pdf'), 'ac07-perfil-mv', pdf.bytes)
  const texto = textoDelPdf(ruta)
  expect(texto).toContain('Tejer prendas de alpaca con tintes naturales.')
  expect(texto).toContain('Ser la marca textil andina que todos reconocen.')
  expect(compacto(texto)).toContain(compacto('Visión'))
})

test('AC-04: con solo la misión el bloque se titula «Misión» y «Visión» no sale en ningún sitio; con solo la visión, «Visión», y sin «Quiénes somos» no hay botón y su brochure es 404', async ({ page }) => {
  await page.goto(perfilDe(e.soloMision))
  await expect(page.getByRole('heading', { level: 1, name: e.soloMision.nombre })).toBeVisible()
  const soloM = page.getByRole('region', { name: 'Misión', exact: true })
  await expect(soloM).toBeVisible()
  await expect(soloM.getByRole('heading', { level: 2, name: 'Misión', exact: true })).toBeVisible()
  await expect(soloM.getByRole('heading', { level: 3 })).toHaveCount(0)
  await expect(soloM).toContainText('Hornear pan honesto para el barrio.')
  await expect(page.getByText('Visión')).toHaveCount(0)
  await expect(page.getByText('Misión y visión')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Descargar brochure (PDF)' })).toBeVisible()
  await evidencia(page, 'brochure-perfil-solo-mision')
  const pdf = await bajarDelPerfil(e.soloMision.codigo, 'ac04-solo-mision')
  expect(compacto(textoDelPdf(pdf.ruta))).not.toContain(compacto('Visión'))

  await page.goto(perfilDe(e.soloVision))
  await expect(page.getByRole('heading', { level: 1, name: e.soloVision.nombre })).toBeVisible()
  const soloV = page.getByRole('region', { name: 'Visión', exact: true })
  await expect(soloV).toBeVisible()
  await expect(soloV).toContainText('Ser la ferretería de confianza del distrito.')
  await expect(page.getByText('Misión')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Descargar brochure (PDF)' })).toHaveCount(0)
  expect((await pedir(`/portal/empresas/${e.soloVision.codigo.toLowerCase()}`)).cuerpo.brochure).toBeNull()
  expect((await pedir(`/portal/empresas/${e.soloVision.codigo.toLowerCase()}/brochure`)).estado).toBe(404)
  await evidencia(page, 'brochure-perfil-solo-vision-sin-boton')
})

test('AC-04 · AC-07: sin misión ni visión no hay bloque; sin «Quiénes somos» no hay botón y la dirección del brochure responde 404', async ({ page }) => {
  // B tiene misión y visión en la base pero ningún «Quiénes somos»: el bloque sale y el botón no.
  const nada = sembrarEmpresa('NADA', 'Empresa Sin Nada QA')
  await page.goto(perfilDe(nada))
  await expect(page.getByRole('heading', { level: 1, name: nada.nombre })).toBeVisible()
  await expect(page.getByText('Misión')).toHaveCount(0)
  await expect(page.getByText('Visión')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Descargar brochure (PDF)' })).toHaveCount(0)
  const api = await pedir(`/portal/empresas/${nada.codigo.toLowerCase()}`)
  expect(api.cuerpo).toMatchObject({ mision: null, vision: null, brochure: null })
  expect((await pedir(`/portal/empresas/${nada.codigo.toLowerCase()}/brochure`)).estado).toBe(404)
  await evidencia(page, 'brochure-perfil-sin-nada')

  await page.goto(perfilDe(e.b))
  await expect(page.getByRole('heading', { level: 1, name: e.b.nombre })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Misión y visión' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar brochure (PDF)' })).toHaveCount(0)
})
