/**
 * «El propósito de la empresa, a la vista del candidato» (specs/Ready/proposito-de-la-empresa,
 * V85): los recorridos que pide «Verificación», contra el preview real y en escritorio.
 *
 *   - Panel (1280×800): el módulo «Perfil de la empresa» para Talento y no en Configuración
 *     (AC-01, AC-25); llenar y guardar todos los campos con la auditoría (AC-02) sin tocar otra
 *     empresa (AC-08); los errores de enlace, video y red a la vez (AC-03/04/05); el propósito de
 *     1500 (AC-06); sin red; Responsable del área sin módulo ni API (AC-07); logo y portada
 *     (AC-26) servidos sin token y sin nada más (AC-28); el «Video del puesto» (AC-23/24).
 *   - Portal sin cuenta: la vacante publicada antes de guardar (AC-09); el bloque «Sobre…» tras
 *     los requisitos con los dos propósitos (AC-14); el video que no pide nada a YouTube ni a
 *     Vimeo hasta pulsarlo (AC-10/11, interceptando las peticiones); sin datos y solo la web
 *     (AC-12/13); los dos videos (AC-22/23); la pantalla partida y el cambio de vacante con el
 *     video sonando; el tablón y el detalle por API (AC-15); el perfil público (AC-17/18/19/20/
 *     21/27).
 *
 * ⚠️ **ESCRIBE** en el clon: empresas `QA-PROP-8029-*` con sus vacantes, cuentas de panel
 * `qa-prop-8029-*`, una sede de la plataforma, y la presentación de la plataforma (la de
 * `dev-equipo`), que se fotografía antes y se devuelve al terminar. Lo retira `afterAll`.
 */

import { expect, type Page } from '@playwright/test'
import { entrarAlPanel, tokenDelPanel } from './ayuda'
import { test } from './ayuda-candidato'
import {
  auditoriasDesde,
  consultar,
  contar,
  devolver,
  entrarAlPanelComo,
  fotoDe,
  insertar,
  laPlataforma,
  llevaMetadatos,
  MARCA,
  pedir,
  png,
  ponerPresentacion,
  presentacionEnBase,
  retirarLoSembrado,
  sembrarCuentaDePanel,
  sembrarEmpresa,
  sembrarVacante,
  subirImagen,
  tokenDe,
  ultimaAuditoria,
  uno,
  vaciarLaPresentacion,
  type Empresa,
  type Foto,
} from './ayuda-proposito-de-la-empresa'
import { literal, sql } from './base-de-datos'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const EVIDENCIAS = process.env.E2E_EVIDENCIAS ?? ''
async function evidencia(page: Page, nombre: string) {
  if (EVIDENCIAS) await page.screenshot({ path: `${EVIDENCIAS}/${nombre}.png`, fullPage: true })
}

const VIDEO_EMPRESA = 'https://www.youtube.com/watch?v=abc123DEF45'
const PROPOSITO_PLATAFORMA = 'Que cada persona encuentre un trabajo con sentido.\nY que cada empresa encuentre a quien la entienda.'
const PROPOSITO_MOLINOS = 'Que ninguna familia se quede sin pan en la mesa.\nMolemos trigo andino con precio justo.\n<b>Esto se lee tal cual</b>'

let plataforma: Empresa
let foto: Foto
let sede = 0
let usuarioEquipo = 0
const e: Record<'molinos' | 'ferreteria' | 'textiles' | 'cafe' | 'estudio' | 'suspendida', Empresa> = {} as never
type ClaveDeVacante = 'operario' | 'jefe' | 'calidad' | 'cerrada' | 'archivada' | 'borrador' | 'eliminada' | 'vendedor' | 'tejedor' | 'barista' | 'deSuspendida' | 'analista'
const v = {} as Record<ClaveDeVacante, number>
const panel = { talento: '', responsable: '' }
let logoSubido = false

/** Las peticiones a YouTube y a Vimeo de esta página: se anotan y se cortan. */
async function vigilarVideos(page: Page): Promise<string[]> {
  const pedidas: string[] = []
  await page.context().route(
    /^https?:\/\/([^/]*\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com|vimeo\.com|vimeocdn\.com)(:\d+)?\//,
    async (ruta) => {
      pedidas.push(ruta.request().url())
      await ruta.abort()
    },
  )
  return pedidas
}

const elFormulario = (page: Page) => page.getByRole('form', { name: 'Perfil de la empresa' })
const laVistaPrevia = (page: Page) => page.getByRole('complementary', { name: 'Vista previa del perfil público' })
const campo = (page: Page, etiqueta: string) => elFormulario(page).getByLabel(etiqueta, { exact: true })
const sobre = (page: Page, empresa: string) => page.getByRole('region', { name: `Sobre ${empresa}` })
const tarjeta = (page: Page) => page.getByRole('complementary', { name: 'Lo esencial del puesto' })

/** Ningún campo del formulario lleva texto de ayuda (sí etiqueta, contador y error). */
async function sinTextosDeAyuda(page: Page) {
  const descripciones = await elFormulario(page)
    .locator('input:not([type=file]), textarea, select')
    .evaluateAll((els) => els.map((el) => `${el.id}:${el.getAttribute('aria-describedby') ?? ''}`).filter((d) => !d.endsWith(':')))
  expect(descripciones, 'Ningún campo describe una ayuda bajo él').toEqual([])
}

test.beforeAll(() => {
  retirarLoSembrado()
  plataforma = laPlataforma()
  foto = fotoDe(plataforma.id)
  usuarioEquipo = Number(uno(`select id from usuario where usuario_renaser_os_id = 'dev-equipo'`).id)
  // La empresa sin datos, como pide AC-01. Logo y portada fuera mientras dura la prueba: subir
  // uno nuevo soltaría el contenido del anterior.
  vaciarLaPresentacion(plataforma.id)
  sql(`update organizacion set logo_archivo_id = null, portada_archivo_id = null where id = ${plataforma.id};
       update vacante set video_presentacion = null where organizacion_id = ${plataforma.id};`)
  sede = Number(
    insertar(`insert into sede (organizacion_id, nombre, provincia_ubigeo)
              values (${plataforma.id}, ${literal(`${MARCA} Sede Juliaca`)}, '2111') returning id`).id,
  )

  e.molinos = sembrarEmpresa('MOLINOS', 'Molinos del Sur')
  ponerPresentacion(e.molinos.id, {
    proposito: PROPOSITO_MOLINOS,
    quienes: 'Somos una cooperativa de molineros del sur andino.',
    sector: 'Agroindustria',
    tamano: 'DE_51_A_200',
    anio: 1987,
    video: 'https://youtu.be/MoLiNoS1234',
    web: 'https://molinosdelsur.pe',
    redes: {
      FACEBOOK: 'https://www.facebook.com/molinosdelsur',
      INSTAGRAM: 'https://www.instagram.com/molinosdelsur',
      LINKEDIN: 'https://www.linkedin.com/company/molinosdelsur',
      TIKTOK: 'https://www.tiktok.com/@molinosdelsur',
      YOUTUBE: 'https://www.youtube.com/@molinosdelsur',
    },
    beneficios: ['Seguro EPS', 'Capacitación pagada', 'Horario flexible'],
  })
  v.operario = sembrarVacante(e.molinos.id, 'Operario de molino', {
    proposito: 'Reducir los tiempos de despacho',
    responsabilidades: 'Operar el molino.\nLimpiar la línea.',
    requisitos: 'Experiencia en planta.',
    indispensables: ['Secundaria completa'],
    publicadaHaceDias: 1,
  })
  v.jefe = sembrarVacante(e.molinos.id, 'Jefe de planta', {
    proposito: 'Que la planta no pare',
    video: 'https://www.youtube.com/shorts/PuEsTo98765',
    publicadaHaceDias: 3,
  })
  v.calidad = sembrarVacante(e.molinos.id, 'Analista de calidad', { publicadaHaceDias: 4 })
  v.cerrada = sembrarVacante(e.molinos.id, 'Cerrada de Molinos', { estado: 'CERRADA' })
  v.archivada = sembrarVacante(e.molinos.id, 'Archivada de Molinos', { estado: 'ARCHIVADA' })
  v.borrador = sembrarVacante(e.molinos.id, 'Borrador de Molinos', { estado: 'BORRADOR' })
  v.eliminada = sembrarVacante(e.molinos.id, 'Eliminada de Molinos', { eliminada: true })

  e.ferreteria = sembrarEmpresa('FERRETERIA', 'Ferretería Los Andes')
  v.vendedor = sembrarVacante(e.ferreteria.id, 'Vendedor de mostrador', {
    proposito: 'Atender bien a cada cliente',
    requisitos: 'Trato amable.',
    publicadaHaceDias: 2,
  })
  e.textiles = sembrarEmpresa('TEXTILES', 'Textiles Puno')
  ponerPresentacion(e.textiles.id, { web: 'https://textilespuno.pe' })
  v.tejedor = sembrarVacante(e.textiles.id, 'Tejedor', { publicadaHaceDias: 2 })
  e.cafe = sembrarEmpresa('CAFE', 'Café Valle Sagrado')
  ponerPresentacion(e.cafe.id, { video: 'https://vimeo.com/123456789/abcdef1234' })
  v.barista = sembrarVacante(e.cafe.id, 'Barista', { publicadaHaceDias: 2 })
  e.estudio = sembrarEmpresa('ESTUDIO', 'Estudio Contable Ayacucho')
  e.suspendida = sembrarEmpresa('SUSPENDIDA', 'Empresa Suspendida', { activa: false })
  ponerPresentacion(e.suspendida.id, { proposito: 'No debería verse' })
  v.deSuspendida = sembrarVacante(e.suspendida.id, 'Vacante de suspendida', { publicadaHaceDias: 2 })

  panel.talento = sembrarCuentaDePanel('talento', 'TALENTO').renaserOsId
  panel.responsable = sembrarCuentaDePanel('responsable', 'RESPONSABLE_AREA').renaserOsId
})

test.afterAll(async () => {
  const errores: unknown[] = []
  const paso = async (accion: () => unknown) => {
    try { await accion() } catch (error) { errores.push(error) }
  }
  if (logoSubido) {
    // Por la API, para que se suelte el contenido de lo que subió la prueba.
    await paso(async () => {
      const token = await tokenDelPanel()
      await pedir('/panel/organizacion/presentacion/imagenes/logo', { token, metodo: 'DELETE' })
      await pedir('/panel/organizacion/presentacion/imagenes/portada', { token, metodo: 'DELETE' })
    })
  }
  await paso(() => devolver(foto))
  await paso(() => sql(`delete from sede where id = ${sede};`))
  await paso(() => retirarLoSembrado())
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza: ${errores.map(String).join('\n')}`)
})

// =============================== Panel ===============================

test('AC-01 · AC-25: Talento ve «Perfil de la empresa» en el menú y no en Configuración; vacío, con la vista previa de iniciales, nombre y vacantes, que cambia al escribir', async ({ page }) => {
  await entrarAlPanelComo(page, panel.talento)
  await page.goto('/admin')
  const menu = page.getByRole('navigation', { name: 'Menú del panel' })
  const entrada = menu.getByRole('link', { name: 'Perfil de la empresa' })
  await expect(entrada).toBeVisible()
  await entrada.click()
  await expect(page).toHaveURL(/\/admin\/empresa$/)
  await expect(page.getByRole('heading', { level: 1, name: /Perfil de la empresa/ })).toBeVisible()

  const form = elFormulario(page)
  await expect(form).toBeVisible()
  await expect(campo(page, 'Nombre de la empresa')).toHaveValue(plataforma.nombre)
  for (const etiqueta of ['Sector', 'Año de fundación', 'Quiénes somos', 'Nuestro propósito', 'Video de presentación',
    'Página web', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube']) {
    await expect(campo(page, etiqueta), etiqueta).toHaveValue('')
  }
  await expect(campo(page, 'Tamaño')).toHaveValue('')
  await expect(form.getByText('0 / 1500')).toHaveCount(2)
  // Las sedes, de solo lectura y con su provincia, y «Gestionar sedes».
  await expect(form.getByRole('list', { name: 'Sedes' })).toContainText(`${MARCA} Sede Juliaca`)
  await expect(form.getByRole('list', { name: 'Sedes' })).toContainText('San Román')
  await expect(form.getByRole('link', { name: 'Gestionar sedes' })).toBeVisible()
  await sinTextosDeAyuda(page)

  const previa = laVistaPrevia(page)
  await expect(previa).toBeVisible()
  await expect(previa).toContainText(plataforma.nombre)
  await expect(previa).toContainText('Vacantes abiertas (3)')
  await expect(previa.locator('img')).toHaveCount(0)
  await expect(previa).not.toContainText('Quiénes somos')
  await expect(previa).not.toContainText('Nuestro propósito')
  await expect(previa.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await evidencia(page, 'panel-vacio')

  await campo(page, 'Quiénes somos').fill('Somos la consultora que conecta personas y propósito.')
  await expect(previa).toContainText('Quiénes somos')
  await expect(previa).toContainText('Somos la consultora que conecta personas y propósito.')
  await campo(page, 'Video de presentación').fill('youtu.be/abc123DEF45')
  await expect(previa.getByRole('button', { name: `Reproducir el video de ${plataforma.nombre}` })).toBeVisible()
  await form.getByRole('button', { name: 'Dejarlo' }).click()
  await expect(previa).not.toContainText('Quiénes somos')

  // Ya no hay nada de esto en Configuración.
  await menu.getByRole('link', { name: 'Configuración' }).click()
  await expect(page).toHaveURL(/\/admin\/configuracion/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Nuestro propósito')).toHaveCount(0)
  await expect(page.getByText('Video de presentación')).toHaveCount(0)
  await expect(page.getByText('Quiénes somos')).toHaveCount(0)
  await expect(page.getByRole('main').getByText(/Perfil de la empresa/)).toHaveCount(0)
})

test('AC-02 · AC-08: llena y guarda todos los campos; la web queda como https://renaser.pe, se audita, y Molinos (otra empresa) no cambia', async ({ page }) => {
  const molinosAntes = presentacionEnBase(e.molinos.id)
  const desde = ultimaAuditoria(plataforma.id, 'editar_presentacion_empresa')
  await entrarAlPanel(page)
  await page.goto('/admin/empresa')
  const form = elFormulario(page)
  await expect(form).toBeVisible()

  await campo(page, 'Sector').fill('  Consultoría de talento  ')
  await campo(page, 'Tamaño').selectOption({ label: '11–50 colaboradores' })
  await campo(page, 'Año de fundación').fill('2019')
  await campo(page, 'Quiénes somos').fill('Somos la consultora que conecta personas y propósito.')
  await campo(page, 'Nuestro propósito').fill(PROPOSITO_PLATAFORMA)
  for (const beneficio of ['Seguro EPS', 'Trabajo remoto']) {
    await form.getByLabel('Nuevo beneficio').fill(beneficio)
    await form.getByRole('button', { name: 'Añadir' }).click()
  }
  await form.getByLabel('Nuevo beneficio').fill('Capacitación')
  await form.getByLabel('Nuevo beneficio').press('Enter')
  await expect(form.getByRole('list', { name: 'Beneficios' }).getByRole('listitem')).toHaveCount(3)
  await form.getByRole('button', { name: 'Quitar Capacitación' }).click()
  await expect(form.getByRole('list', { name: 'Beneficios' }).getByRole('listitem')).toHaveCount(2)
  await campo(page, 'Video de presentación').fill(VIDEO_EMPRESA)
  await campo(page, 'Página web').fill('renaser.pe')
  await campo(page, 'Facebook').fill('facebook.com/renaser')
  await campo(page, 'Instagram').fill('https://www.instagram.com/renaser')
  await campo(page, 'LinkedIn').fill('https://www.linkedin.com/company/renaser')
  await campo(page, 'TikTok').fill('https://www.tiktok.com/@renaser')
  await campo(page, 'YouTube').fill('https://www.youtube.com/@renaser')
  await expect(laVistaPrevia(page)).toContainText('Consultoría de talento · 11–50 colaboradores · Fundada en 2019')

  await form.getByRole('button', { name: 'Guardar' }).click()
  await expect(form.getByRole('status')).toHaveText('Guardado. Tu perfil y tus vacantes publicadas ya lo muestran.')
  await expect(campo(page, 'Página web')).toHaveValue('https://renaser.pe')
  await expect(campo(page, 'Facebook')).toHaveValue('https://facebook.com/renaser')
  await expect(campo(page, 'Sector')).toHaveValue('Consultoría de talento')
  await evidencia(page, 'panel-guardado')

  const guardado = presentacionEnBase(plataforma.id)
  expect(guardado).toMatchObject({
    sector: 'Consultoría de talento',
    tamano: 'DE_11_A_50',
    anio_fundacion: 2019,
    quienes_somos: 'Somos la consultora que conecta personas y propósito.',
    proposito_empresa: PROPOSITO_PLATAFORMA,
    video_presentacion: VIDEO_EMPRESA,
    pagina_web: 'https://renaser.pe',
  })
  expect(JSON.parse(String(guardado.beneficios))).toEqual(['Seguro EPS', 'Trabajo remoto'])
  expect(JSON.parse(String(guardado.redes))).toEqual({
    FACEBOOK: 'https://facebook.com/renaser',
    INSTAGRAM: 'https://www.instagram.com/renaser',
    LINKEDIN: 'https://www.linkedin.com/company/renaser',
    TIKTOK: 'https://www.tiktok.com/@renaser',
    YOUTUBE: 'https://www.youtube.com/@renaser',
  })
  const auditadas = auditoriasDesde(plataforma.id, 'editar_presentacion_empresa', desde)
  expect(auditadas).toHaveLength(1)
  expect(Number(auditadas[0]!.usuario_id)).toBe(usuarioEquipo)
  expect(JSON.parse(String(auditadas[0]!.antes))).toMatchObject({ propositoEmpresa: null, paginaWeb: null })
  expect(JSON.parse(String(auditadas[0]!.despues))).toMatchObject({ propositoEmpresa: PROPOSITO_PLATAFORMA, paginaWeb: 'https://renaser.pe' })

  // Guardar otra vez lo mismo deja lo mismo.
  await form.getByRole('button', { name: 'Guardar' }).click()
  await expect(form.getByRole('status')).toBeVisible()
  expect(presentacionEnBase(plataforma.id)).toEqual(guardado)

  // Recargar enseña lo guardado.
  await page.reload()
  await expect(campo(page, 'Nuestro propósito')).toHaveValue(PROPOSITO_PLATAFORMA)
  await expect(campo(page, 'Instagram')).toHaveValue('https://www.instagram.com/renaser')
  await expect(elFormulario(page).getByRole('list', { name: 'Beneficios' }).getByRole('listitem')).toHaveCount(2)

  // AC-08: lo de la otra empresa sigue igual, en la base y en su vacante.
  expect(presentacionEnBase(e.molinos.id)).toEqual(molinosAntes)
  const deMolinos = await pedir(`/portal/vacantes/${v.operario}`)
  expect(deMolinos.cuerpo.empresa.proposito).toBe(PROPOSITO_MOLINOS)
})

test('AC-09: la vacante publicada antes del cambio enseña «Sobre…» con el nuevo propósito a quien no tiene cuenta, sin volver a publicarla', async ({ page }) => {
  const vieja = uno(`select id, publicada_en from vacante where organizacion_id = ${plataforma.id}
                       and titulo = 'Desarrollador web'`)
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${vieja.id}`)
  const bloque = sobre(page, plataforma.nombre)
  await expect(bloque).toBeVisible()
  await expect(bloque.getByText(/Que cada persona encuentre un trabajo con sentido/)).toBeVisible()
  // Sin video del puesto, el de la empresa va en la tarjeta lateral y el bloque no lo repite.
  await expect(tarjeta(page).getByText(`Conoce a ${plataforma.nombre}`)).toBeVisible()
  await expect(bloque.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await expect(bloque.getByRole('link', { name: 'Página web' })).toHaveAttribute('href', 'https://renaser.pe/')
  expect(pedidas).toEqual([])
  expect(uno(`select publicada_en from vacante where id = ${vieja.id}`).publicada_en).toBe(vieja.publicada_en)
})

test('AC-03 · AC-04 · AC-05: javascript:, un video de Facebook y Facebook en «Instagram» fallan a la vez, cada uno junto a su campo, y no se guarda ningún campo', async ({ page }) => {
  const antes = presentacionEnBase(plataforma.id)
  await entrarAlPanel(page)
  await page.goto('/admin/empresa')
  const form = elFormulario(page)
  await expect(campo(page, 'Nuestro propósito')).toHaveValue(PROPOSITO_PLATAFORMA)

  await campo(page, 'Nuestro propósito').fill('Un propósito que no debe guardarse')
  await campo(page, 'Página web').fill('javascript:alert(1)')
  await campo(page, 'Video de presentación').fill('https://www.facebook.com/renaser/videos/123')
  await campo(page, 'Instagram').fill('https://www.facebook.com/renaser')
  await campo(page, 'LinkedIn').fill('https://usuario:clave@linkedin.com/company/renaser')
  await form.getByRole('button', { name: 'Guardar' }).click()

  await expect(form.getByRole('alert').filter({ hasText: 'No se guardó nada. Corrige los campos marcados.' })).toBeVisible()
  await expect(campo(page, 'Página web')).toHaveAccessibleDescription('Escribe una dirección web que empiece por https://')
  await expect(campo(page, 'Video de presentación')).toHaveAccessibleDescription('Pega el enlace de un video de YouTube o de Vimeo')
  await expect(campo(page, 'Instagram')).toHaveAccessibleDescription('Este enlace no es de Instagram')
  await expect(campo(page, 'LinkedIn')).toHaveAccessibleDescription('Escribe una dirección web que empiece por https://')
  await expect(campo(page, 'Página web')).toHaveAttribute('aria-invalid', 'true')
  await expect(campo(page, 'Nuestro propósito')).toHaveValue('Un propósito que no debe guardarse')
  await evidencia(page, 'panel-errores')
  expect(presentacionEnBase(plataforma.id)).toEqual(antes)

  // El servidor dice lo mismo aunque el panel no estuviera: 400 con todos y nada guardado.
  const token = await tokenDelPanel()
  const r = await pedir('/panel/organizacion/presentacion', {
    token,
    metodo: 'PUT',
    cuerpo: {
      propositoEmpresa: 'Tampoco por la API',
      paginaWeb: 'javascript:alert(1)',
      videoPresentacion: 'https://www.facebook.com/renaser/videos/123',
      redes: { INSTAGRAM: 'https://www.facebook.com/renaser', FACEBOOK: 'renaser .pe', TIKTOK: 'data:text/html,hola' },
      beneficios: [],
    },
  })
  expect(r.estado).toBe(400)
  expect(r.cuerpo.errores).toEqual({
    videoPresentacion: 'Pega el enlace de un video de YouTube o de Vimeo',
    paginaWeb: 'Escribe una dirección web que empiece por https://',
    FACEBOOK: 'Escribe una dirección web que empiece por https://',
    INSTAGRAM: 'Este enlace no es de Instagram',
    TIKTOK: 'Escribe una dirección web que empiece por https://',
  })
  expect(presentacionEnBase(plataforma.id)).toEqual(antes)

  await form.getByRole('button', { name: 'Dejarlo' }).click()
  await expect(campo(page, 'Página web')).toHaveValue('https://renaser.pe')
  await expect(campo(page, 'Página web')).not.toHaveAttribute('aria-invalid', 'true')
})

test('AC-06: con 1500 caracteres el contador marca «1500 / 1500» y no entra uno más; 1501 por la API es un 400', async ({ page }) => {
  const antes = presentacionEnBase(plataforma.id)
  await entrarAlPanel(page)
  await page.goto('/admin/empresa')
  const linea = 'Molemos trigo andino.\n'
  const largo = (linea.repeat(Math.ceil(1500 / linea.length)) + 'x'.repeat(1500)).slice(0, 1500)
  const proposito = campo(page, 'Nuestro propósito')
  await proposito.fill(largo)
  await expect(elFormulario(page).getByText('1500 / 1500')).toBeVisible()
  await proposito.press('End')
  await page.keyboard.press('Control+End')
  await page.keyboard.type('Z')
  expect((await proposito.inputValue()).length).toBe(1500)
  await expect(elFormulario(page).getByText('1500 / 1500')).toBeVisible()
  await evidencia(page, 'panel-1500')

  const token = await tokenDelPanel()
  const r = await pedir('/panel/organizacion/presentacion', {
    token,
    metodo: 'PUT',
    cuerpo: { propositoEmpresa: 'a'.repeat(1501), beneficios: [], redes: {} },
  })
  expect(r.estado).toBe(400)
  expect(r.cuerpo.errores.propositoEmpresa).toBe('El propósito admite hasta 1500 caracteres')
  expect(presentacionEnBase(plataforma.id)).toEqual(antes)
})

test('Sin red: «Guardar» se desactiva mientras envía, sale «No se pudo guardar.» y el formulario conserva lo escrito', async ({ page }) => {
  const antes = presentacionEnBase(plataforma.id)
  await entrarAlPanel(page)
  await page.goto('/admin/empresa')
  await expect(campo(page, 'Sector')).toHaveValue('Consultoría de talento')
  let soltar: () => void = () => {}
  const retenida = new Promise<void>((r) => { soltar = r })
  await page.route('**/api/v1/panel/organizacion/presentacion', async (ruta) => {
    if (ruta.request().method() !== 'PUT') return ruta.continue()
    await retenida
    await ruta.abort('internetdisconnected')
  })
  await campo(page, 'Sector').fill('Sector escrito sin red')
  await elFormulario(page).getByRole('button', { name: 'Guardar' }).click()
  await expect(elFormulario(page).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  soltar()
  await expect(elFormulario(page).getByRole('alert').filter({ hasText: 'No se pudo guardar.' })).toBeVisible()
  await expect(campo(page, 'Sector')).toHaveValue('Sector escrito sin red')
  await expect(elFormulario(page).getByRole('button', { name: 'Guardar' })).toBeEnabled()
  expect(presentacionEnBase(plataforma.id)).toEqual(antes)
})

test('AC-07: Responsable del área no ve «Perfil de la empresa», la dirección no le enseña el editor y la API le da 403 sin cambiar nada', async ({ page }) => {
  const antes = presentacionEnBase(plataforma.id)
  await entrarAlPanelComo(page, panel.responsable)
  await page.goto('/admin')
  const menu = page.getByRole('navigation', { name: 'Menú del panel' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Vacantes' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Perfil de la empresa' })).toHaveCount(0)
  await page.goto('/admin/empresa')
  await expect(page.getByText(/No tienes permiso para editar el perfil de la empresa/)).toBeVisible()
  await expect(page.getByRole('form', { name: 'Perfil de la empresa' })).toHaveCount(0)
  await expect(page.getByLabel('Nuestro propósito')).toHaveCount(0)
  await evidencia(page, 'panel-responsable-sin-permiso')

  const token = await tokenDe(panel.responsable)
  expect((await pedir('/panel/organizacion/presentacion', { token })).estado).toBe(403)
  const r = await pedir('/panel/organizacion/presentacion', {
    token, metodo: 'PUT', cuerpo: { propositoEmpresa: 'Lo cambia quien no puede', beneficios: [], redes: {} },
  })
  expect(r.estado).toBe(403)
  expect((await subirImagen(token, 'logo', png(400, 400))).estado).toBe(403)
  expect(presentacionEnBase(plataforma.id)).toEqual(antes)
})

test('AC-26 · AC-28: el logo y la portada se suben y se ven; lo que no vale se rechaza con su motivo; el servidor quita el GPS y sirve solo esas dos imágenes, sin token y con caché pública', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto('/admin/empresa')
  const form = elFormulario(page)
  const logo = form.getByLabel('Logo', { exact: true })
  const errorDelLogo = form.getByRole('alert').filter({ hasText: /^El logo/ })

  await logo.setInputFiles({ name: 'pesado.png', mimeType: 'image/png', buffer: Buffer.concat([png(200, 200), Buffer.alloc(3 * 1024 * 1024, 1)]) })
  await expect(errorDelLogo).toHaveText('El logo no puede pesar más de 2 MB. Prueba a guardarlo más pequeño.')
  await logo.setInputFiles({ name: 'chico.png', mimeType: 'image/png', buffer: png(100, 100) })
  await expect(errorDelLogo).toHaveText('El logo tiene que medir al menos 200 × 200 píxeles.')
  await logo.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('no soy una imagen') })
  await expect(errorDelLogo).toHaveText('El logo tiene que ser JPG o PNG.')
  await logo.setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: Buffer.from('tampoco soy una imagen') })
  await expect(errorDelLogo).toHaveText('El logo no es una imagen que podamos leer.')

  const conGps = png(400, 400, { ruido: true, gps: true, relleno: 360_000 })
  expect(conGps.length).toBeGreaterThan(900_000)
  expect(conGps.length).toBeLessThan(2 * 1024 * 1024)
  expect(llevaMetadatos(conGps)).toBe(true)
  await logo.setInputFiles({ name: 'logo-con-gps.png', mimeType: 'image/png', buffer: conGps })
  await expect(errorDelLogo).toHaveCount(0)
  await expect(laVistaPrevia(page).locator('img').first()).toBeVisible()
  await form.getByLabel('Foto de portada', { exact: true }).setInputFiles({ name: 'portada.png', mimeType: 'image/png', buffer: png(1600, 400) })
  await expect(form.getByRole('img', { name: `Portada de ${plataforma.nombre}` })).toBeVisible()
  await form.getByRole('button', { name: 'Guardar' }).click()
  logoSubido = true
  await expect(form.getByRole('status')).toHaveText('Guardado. Tu perfil y tus vacantes publicadas ya lo muestran.')
  await expect(form.getByRole('img', { name: `Logo de ${plataforma.nombre}` })).toBeVisible()
  await evidencia(page, 'panel-logo-y-portada')

  // El servidor: el mismo PNG con GPS subido sin pasar por el recorte del navegador.
  const token = await tokenDelPanel()
  const subida = await subirImagen(token, 'logo', conGps, 'logo.png')
  expect(subida.estado).toBe(200)
  expect(subida.cuerpo.logo).toMatch(/^\/api\/v1\/portal\/empresas\/renaser\/imagenes\/logo\?v=\d+$/)
  const origen = new URL(process.env.E2E_API!).origin
  const servida = await pedir(`${origen}${subida.cuerpo.logo}`)
  expect(servida.estado).toBe(200)
  expect(servida.cabeceras.get('content-type')).toBe('image/png')
  expect(servida.cabeceras.get('cache-control')).toMatch(/max-age=86400/)
  expect(servida.cabeceras.get('cache-control')).toMatch(/public/)
  expect(servida.bytes.subarray(0, 4).toString('latin1')).toBe('\x89PNG')
  expect(llevaMetadatos(servida.bytes)).toBe(false)

  // Lo que no vale, también por la API.
  const pesado = await subirImagen(token, 'logo', Buffer.concat([png(200, 200), Buffer.alloc(3 * 1024 * 1024, 1)]), 'pesado.png')
  expect(pesado.estado).toBe(400)
  expect(pesado.cuerpo.detail).toBe('El logo no puede pesar más de 2 MB. Prueba a guardarlo más pequeño.')
  const chico = await subirImagen(token, 'logo', png(100, 100), 'chico.png')
  expect(chico.estado).toBe(400)
  expect(chico.cuerpo.detail).toBe('El logo tiene que medir al menos 200 × 200 píxeles.')
  const texto = await subirImagen(token, 'logo', Buffer.from('hola'), 'notas.txt', 'text/plain')
  expect(texto.estado).toBe(400)
  expect((await subirImagen(token, 'portada', png(800, 300))).estado).toBe(400)
  // El logo bueno sigue siendo el de antes.
  expect((await pedir(`${origen}${subida.cuerpo.logo}`)).estado).toBe(200)

  // AC-28: otra empresa sin logo, otro nombre o una ruta rara no entregan nada.
  expect((await pedir(`/portal/empresas/${e.molinos.codigo.toLowerCase()}/imagenes/logo`)).estado).toBe(404)
  expect((await pedir(`/portal/empresas/renaser/imagenes/otra`)).estado).toBe(404)
  expect((await pedir(`/portal/empresas/renaser/imagenes/..%2F..%2Fapplication.yaml`)).estado).not.toBe(200)
  expect((await pedir(`/portal/empresas/no-existe-8029/imagenes/logo`)).estado).toBe(404)
  expect((await pedir(`/portal/empresas/${e.suspendida.codigo.toLowerCase()}/imagenes/logo`)).estado).toBe(404)
})

test('AC-27: el perfil público de la plataforma en PC, sin cuenta: portada con logo, «Sector · Tamaño · Fundada en AAAA», la ficha lateral, los beneficios como chips y sus 3 vacantes', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto('/empresas/renaser')
  await expect(page.getByRole('heading', { level: 1, name: plataforma.nombre })).toBeVisible()
  const portada = page.getByRole('img', { name: `Portada de ${plataforma.nombre}` })
  await expect(portada).toHaveAttribute('style', /\/api\/v1\/portal\/empresas\/renaser\/imagenes\/portada\?v=\d+/)
  const logo = page.getByRole('img', { name: `Logo de ${plataforma.nombre}` })
  await expect(logo).toBeVisible()
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(page.getByText('Consultoría de talento · 11–50 colaboradores · Fundada en 2019')).toBeVisible()
  await expect(page.getByText('San Román').first()).toBeVisible()
  const ficha = page.getByRole('complementary', { name: 'Datos de la empresa' })
  await expect(ficha).toContainText('Consultoría de talento')
  await expect(ficha).toContainText('11–50 colaboradores')
  await expect(ficha).toContainText('2019')
  await expect(ficha).toContainText('San Román')
  await expect(ficha.getByRole('link', { name: 'Instagram' })).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('region', { name: 'Beneficios' }).getByRole('listitem')).toHaveText(['Seguro EPS', 'Trabajo remoto'])
  await expect(page.getByRole('heading', { name: 'Vacantes abiertas (3)' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver vacantes (3)' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Visitar web' })).toHaveAttribute('href', 'https://renaser.pe/')
  // La ficha queda a la derecha de la columna principal.
  const cajaFicha = await ficha.boundingBox()
  const cajaVacantes = await page.getByRole('heading', { name: 'Vacantes abiertas (3)' }).boundingBox()
  expect(cajaFicha!.x).toBeGreaterThan(cajaVacantes!.x + cajaVacantes!.width / 2)
  expect(pedidas).toEqual([])
  await evidencia(page, 'perfil-plataforma-pc')
})

test('AC-23 · AC-24: en el formulario de la vacante, «Video del puesto» dice «Se usará el video de la empresa»; un enlace de Facebook da el error del de la empresa y no se guarda; uno de YouTube sí, sin avisar a nadie', async ({ page }) => {
  const titulo = 'Analista de experiencia del cliente'
  const id = Number(uno(`select id from vacante where organizacion_id = ${plataforma.id} and titulo = ${literal(titulo)}`).id)
  v.analista = id
  const avisos = contar(`select 1 from aviso_portal where vacante_id = ${id}`)
  const correos = contar('select 1 from correo_enviado')
  await entrarAlPanel(page)
  await page.goto('/admin')
  await page.getByRole('button', { name: `Editar la vacante ${titulo}` }).click()
  const modal = page.getByRole('dialog', { name: 'Editar vacante' })
  await expect(modal).toBeVisible()
  const video = modal.getByLabel('Video del puesto (opcional)')
  await expect(video).toHaveValue('')
  await expect(modal.getByText('Se usará el video de la empresa')).toBeVisible()
  await evidencia(page, 'panel-video-del-puesto-chip')

  await video.fill('https://www.facebook.com/renaser/videos/123')
  await expect(modal.getByText('Se usará el video de la empresa')).toHaveCount(0)
  await modal.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(video).toHaveAccessibleDescription('Pega el enlace de un video de YouTube o de Vimeo')
  await expect(video).toHaveAttribute('aria-invalid', 'true')
  await expect(modal.getByText('Corrige lo marcado en «Video del puesto».')).toBeVisible()
  await evidencia(page, 'panel-video-del-puesto-error')
  expect(uno(`select video_presentacion from vacante where id = ${id}`).video_presentacion).toBeNull()

  await video.fill('youtu.be/PuEsTo12345')
  await modal.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(modal).toHaveCount(0)
  expect(uno(`select video_presentacion from vacante where id = ${id}`).video_presentacion).toBe('https://youtu.be/PuEsTo12345')
  expect(contar(`select 1 from aviso_portal where vacante_id = ${id}`)).toBe(avisos)
  expect(contar('select 1 from correo_enviado')).toBe(correos)
})

// =============================== Portal ===============================

test('AC-22 · AC-23: con video del puesto, la tarjeta lateral dice «Conoce el puesto» y el bloque «Sobre…» lleva el de la empresa; sin él, la tarjeta lleva el de la empresa y el bloque no lo repite; nada carga hasta pulsar', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${v.analista}`)
  await expect(tarjeta(page).getByText('Conoce el puesto')).toBeVisible()
  await expect(tarjeta(page).getByRole('link', { name: 'Ver en YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=PuEsTo12345')
  const bloque = sobre(page, plataforma.nombre)
  await expect(bloque.getByText(`Conoce a ${plataforma.nombre}`)).toBeVisible()
  await expect(bloque.getByRole('link', { name: 'Ver en YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123DEF45')
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(pedidas).toEqual([])
  await evidencia(page, 'vacante-dos-videos-pc')

  await tarjeta(page).getByRole('button', { name: /^Reproducir/ }).click()
  await expect(tarjeta(page).locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/PuEsTo12345?autoplay=1&rel=0')
  await expect.poll(() => pedidas.some((u) => u.startsWith('https://www.youtube-nocookie.com/embed/PuEsTo12345'))).toBe(true)
  expect(pedidas.every((u) => u.includes('youtube-nocookie.com'))).toBe(true)
  await expect(bloque.locator('iframe')).toHaveCount(0)

  const otra = uno(`select id from vacante where organizacion_id = ${plataforma.id} and titulo = 'Desarrollador web'`)
  await page.goto(`/vacantes/${otra.id}`)
  await expect(tarjeta(page).getByText(`Conoce a ${plataforma.nombre}`)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reproducir/ })).toHaveCount(1)
})

test('AC-10 · AC-14 · AC-18: la vacante de Molinos enseña los dos propósitos en su bloque, «Sobre…» después de los requisitos con sus saltos de línea y sin HTML; el video no pide nada hasta pulsarlo y «Ver en YouTube» abre fuera; el nombre lleva al perfil', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${v.operario}`)
  await expect(page.getByRole('heading', { level: 1, name: `${MARCA} Operario de molino` })).toBeVisible()
  // Sin la etiqueta «Vacante / Ficha del puesto».
  await expect(page.locator('[data-seccion="Vacante / Ficha del puesto"]')).toHaveCount(0)

  const resultado = page.locator('section').filter({ has: page.getByRole('heading', { name: 'El resultado que esperamos' }) })
  await expect(resultado).toContainText('Reducir los tiempos de despacho')
  await expect(resultado).not.toContainText('Que ninguna familia')
  const bloque = sobre(page, 'Molinos del Sur')
  await expect(bloque).toContainText('Que ninguna familia se quede sin pan en la mesa.')
  await expect(bloque).not.toContainText('Reducir los tiempos de despacho')
  const texto = bloque.getByText(/Que ninguna familia/)
  expect(await texto.evaluate((p) => (p as HTMLElement).innerText)).toBe(PROPOSITO_MOLINOS)
  await expect(bloque.locator('b')).toHaveCount(0)
  // Después de toda la información del puesto, incluidos los requisitos indispensables.
  const orden = await page.evaluate(() => {
    const titulos = [...document.querySelectorAll('article h2')].map((h) => h.textContent?.trim())
    return titulos
  })
  expect(orden).toEqual(['El resultado que esperamos', 'Lo que harás', 'Lo que buscamos', 'Requisitos indispensables', 'Sobre Molinos del Sur'])
  await expect(bloque.getByRole('list', { name: 'Enlaces de la empresa' }).getByRole('link')).toHaveText(
    ['Página web', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube'],
  )
  for (const enlace of await bloque.getByRole('list', { name: 'Enlaces de la empresa' }).getByRole('link').all()) {
    await expect(enlace).toHaveAttribute('target', '_blank')
    await expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
  }
  await expect(bloque.getByRole('link', { name: 'Ver perfil de Molinos del Sur →' })).toBeVisible()

  // El video: en PC va en la tarjeta lateral, arriba de «Remuneración», y no pide nada.
  const lateral = tarjeta(page)
  await expect(lateral.getByText('Conoce a Molinos del Sur')).toBeVisible()
  await expect(bloque.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.mouse.wheel(0, 1500)
  await page.waitForTimeout(300)
  expect(pedidas).toEqual([])
  await evidencia(page, 'vacante-molinos-pc-antes-de-pulsar')
  const verFuera = lateral.getByRole('link', { name: 'Ver en YouTube' })
  await expect(verFuera).toHaveAttribute('href', 'https://www.youtube.com/watch?v=MoLiNoS1234')
  await expect(verFuera).toHaveAttribute('target', '_blank')
  await expect(verFuera).toHaveAttribute('rel', 'noopener noreferrer')

  await lateral.getByRole('button', { name: 'Reproducir el video de Molinos del Sur' }).click()
  const reproductor = lateral.locator('iframe')
  await expect(reproductor).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/MoLiNoS1234?autoplay=1&rel=0')
  await expect(reproductor).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  await expect(reproductor).toHaveAttribute('allow', /autoplay/)
  await expect.poll(() => pedidas.length).toBeGreaterThan(0)
  expect(pedidas.every((u) => u.startsWith('https://www.youtube-nocookie.com/'))).toBe(true)
  await expect(lateral.getByRole('link', { name: 'Ver en YouTube' })).toBeVisible()

  // AC-18: el nombre bajo el titular y «Ver perfil de… →» llevan al perfil.
  await page.getByRole('link', { name: 'Molinos del Sur', exact: true }).click()
  await expect(page).toHaveURL(/\/empresas\/qa-prop-8029-molinos$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Molinos del Sur' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: `${MARCA} Operario de molino` })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await tarjeta(page).getByRole('link', { name: 'Ver perfil de Molinos del Sur →' }).click()
  await expect(page).toHaveURL(/\/empresas\/qa-prop-8029-molinos$/)
})

test('AC-11: el video oculto de Vimeo se reproduce en el reproductor de Vimeo, con dnt=1 y su clave', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${v.barista}`)
  const lateral = tarjeta(page)
  await expect(lateral.getByText('Conoce a Café Valle Sagrado')).toBeVisible()
  await expect(lateral.getByRole('link', { name: 'Ver en Vimeo' })).toHaveAttribute('href', 'https://vimeo.com/123456789/abcdef1234')
  expect(pedidas).toEqual([])
  await lateral.getByRole('button', { name: 'Reproducir el video de Café Valle Sagrado' }).click()
  await expect(lateral.locator('iframe')).toHaveAttribute('src', 'https://player.vimeo.com/video/123456789?autoplay=1&dnt=1&h=abcdef1234')
  await expect.poll(() => pedidas.some((u) => u.startsWith('https://player.vimeo.com/video/123456789'))).toBe(true)
  // Solo el video, nada más en «Sobre…»: en PC no lo repite, así que no hay bloque.
  await expect(page.getByRole('region', { name: /^Sobre / })).toHaveCount(0)
})

test('AC-12 · AC-13: la empresa sin datos no tiene bloque ni video; la que solo puso la web enseña solo «Página web»', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${v.vendedor}`)
  await expect(page.getByRole('heading', { level: 1, name: `${MARCA} Vendedor de mostrador` })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'El resultado que esperamos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lo que buscamos' })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Sobre / })).toHaveCount(0)
  await expect(page.getByText(/^Sobre Ferretería/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await expect(page.getByText(/^Conoce /)).toHaveCount(0)
  await expect(tarjeta(page).getByRole('link', { name: /Postular/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ferretería Los Andes', exact: true }).locator('xpath=..').locator('img')).toHaveCount(0)
  await evidencia(page, 'vacante-sin-datos-pc')

  await page.goto(`/vacantes/${v.tejedor}`)
  const bloque = sobre(page, 'Textiles Puno')
  await expect(bloque).toBeVisible()
  await expect(bloque.getByRole('list', { name: 'Enlaces de la empresa' }).getByRole('link')).toHaveText(['Página web'])
  await expect(bloque.getByRole('link', { name: 'Página web' })).toHaveAttribute('href', 'https://textilespuno.pe/')
  await expect(bloque.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await expect(bloque.locator('p').filter({ hasNotText: /Ver perfil/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  expect(pedidas).toEqual([])
  await evidencia(page, 'vacante-solo-web-pc')
})

test('Pantalla partida (1280×800): la vacante elegida enseña el video y «Sobre…»; al elegir otra el reproductor desaparece y la suspendida no sale', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto('/vacantes')
  const lista = page.getByRole('list', { name: 'Vacantes' })
  await expect(lista).toBeVisible()
  await expect(lista.getByRole('link', { name: `${MARCA} Vacante de suspendida` })).toHaveCount(0)
  await lista.getByRole('link', { name: `${MARCA} Operario de molino`, exact: true }).click()
  const elegida = page.getByRole('region', { name: `${MARCA} Operario de molino` })
  await expect(elegida).toBeVisible()
  await expect(elegida.getByText('Conoce a Molinos del Sur')).toBeVisible()
  const bloque = elegida.getByRole('region', { name: 'Sobre Molinos del Sur' })
  await expect(bloque).toContainText('Que ninguna familia se quede sin pan en la mesa.')
  await expect(bloque.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await expect(elegida.getByRole('link', { name: 'Molinos del Sur', exact: true })).toHaveAttribute('href', '/empresas/qa-prop-8029-molinos')
  expect(pedidas).toEqual([])
  await evidencia(page, 'pantalla-partida-molinos')

  await elegida.getByRole('button', { name: 'Reproducir el video de Molinos del Sur' }).click()
  await expect(elegida.locator('iframe')).toHaveCount(1)
  await lista.getByRole('link', { name: `${MARCA} Vendedor de mostrador`, exact: true }).click()
  const otra = page.getByRole('region', { name: `${MARCA} Vendedor de mostrador` })
  await expect(otra).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(otra.getByRole('region', { name: /^Sobre / })).toHaveCount(0)
  await lista.getByRole('link', { name: `${MARCA} Operario de molino`, exact: true }).click()
  await expect(page.getByRole('region', { name: `${MARCA} Operario de molino` }).getByRole('button', { name: 'Reproducir el video de Molinos del Sur' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)

  // Con video del puesto, en la pantalla partida también va el del puesto arriba.
  await lista.getByRole('link', { name: `${MARCA} Jefe de planta`, exact: true }).click()
  const jefe = page.getByRole('region', { name: `${MARCA} Jefe de planta` })
  await expect(jefe.getByText('Conoce el puesto')).toBeVisible()
  await expect(jefe.getByRole('region', { name: 'Sobre Molinos del Sur' }).getByText('Conoce a Molinos del Sur')).toBeVisible()
})

test('AC-15: el tablón y el detalle, sin token, traen los datos de cada empresa; sin datos, `empresa` nulo; los campos de siempre siguen', async () => {
  const tablon = await pedir('/portal/vacantes')
  expect(tablon.estado).toBe(200)
  const lista = tablon.cuerpo as Array<Record<string, any>>
  const por = (id: number) => lista.find((x) => x.id === id)!
  const campos = ['id', 'titulo', 'nombreEmpresa', 'descripcion', 'proposito', 'responsabilidades', 'requisitos',
    'modalidad', 'horario', 'ubicacion', 'ciudad', 'publicadaEn', 'remuneracion', 'requisitosObjetivos']
  for (const x of lista) for (const c of campos) expect(x, `${x.id} trae ${c}`).toHaveProperty(c)
  const operario = por(v.operario)
  expect(operario.nombreEmpresa).toBe('Molinos del Sur')
  expect(operario.proposito).toBe('Reducir los tiempos de despacho')
  expect(operario.codigoEmpresa).toBe(e.molinos.codigo)
  expect(operario.empresa).toEqual({
    proposito: PROPOSITO_MOLINOS,
    video: { servicio: 'YOUTUBE', identificador: 'MoLiNoS1234', clave: null, enlace: 'https://youtu.be/MoLiNoS1234' },
    paginaWeb: 'https://molinosdelsur.pe',
    redes: [
      { red: 'FACEBOOK', enlace: 'https://www.facebook.com/molinosdelsur' },
      { red: 'INSTAGRAM', enlace: 'https://www.instagram.com/molinosdelsur' },
      { red: 'LINKEDIN', enlace: 'https://www.linkedin.com/company/molinosdelsur' },
      { red: 'TIKTOK', enlace: 'https://www.tiktok.com/@molinosdelsur' },
      { red: 'YOUTUBE', enlace: 'https://www.youtube.com/@molinosdelsur' },
    ],
    logo: null,
  })
  expect(operario.videoPuesto).toBeNull()
  expect(por(v.jefe).videoPuesto).toMatchObject({ servicio: 'YOUTUBE', identificador: 'PuEsTo98765' })
  expect(por(v.vendedor).empresa).toBeNull()
  expect(por(v.barista).empresa.video).toEqual({ servicio: 'VIMEO', identificador: '123456789', clave: 'abcdef1234', enlace: 'https://vimeo.com/123456789/abcdef1234' })
  expect(lista.some((x) => x.id === v.deSuspendida)).toBe(false)

  const detalle = await pedir(`/portal/vacantes/${v.operario}`)
  expect(detalle.estado).toBe(200)
  expect(detalle.cuerpo.empresa).toEqual(operario.empresa)
  expect((await pedir(`/portal/vacantes/${v.vendedor}`)).cuerpo.empresa).toBeNull()
  expect((await pedir(`/portal/vacantes/${v.deSuspendida}`)).estado).toBe(404)
})

test('AC-17 · AC-21: el perfil de Molinos sin cuenta: nombre, video sin pedir nada hasta pulsar, propósito, web y redes, y «Vacantes abiertas (3)» con tarjetas a cada vacante; la API solo trae lo público y las 3 publicadas', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto('/empresas/qa-prop-8029-molinos')
  await expect(page.getByRole('heading', { level: 1, name: 'Molinos del Sur' })).toBeVisible()
  await expect(page.getByText('Agroindustria · 51–200 colaboradores · Fundada en 1987')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quiénes somos' })).toContainText('cooperativa de molineros')
  await expect(page.getByRole('region', { name: 'Nuestro propósito' })).toContainText('Que ninguna familia se quede sin pan')
  await expect(page.getByRole('region', { name: 'Beneficios' }).getByRole('listitem')).toHaveText(['Seguro EPS', 'Capacitación pagada', 'Horario flexible'])
  const ficha = page.getByRole('complementary', { name: 'Datos de la empresa' })
  await expect(ficha.getByRole('list', { name: 'Enlaces de la empresa' }).getByRole('link')).toHaveText(
    ['Página web', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube'],
  )
  const vacantes = page.getByRole('region', { name: 'Vacantes abiertas (3)' })
  await expect(vacantes.getByRole('link')).toHaveCount(3)
  for (const [titulo, id] of [['Operario de molino', v.operario], ['Jefe de planta', v.jefe], ['Analista de calidad', v.calidad]] as const) {
    await expect(vacantes.getByRole('link', { name: `${MARCA} ${titulo}` })).toHaveAttribute('href', `/vacantes/${id}`)
  }
  await expect(vacantes).not.toContainText('Molinos del Sur')
  expect(pedidas).toEqual([])
  await evidencia(page, 'perfil-molinos-pc')
  await page.getByRole('button', { name: 'Reproducir el video de Molinos del Sur' }).click()
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/MoLiNoS1234?autoplay=1&rel=0')
  await vacantes.getByRole('link', { name: `${MARCA} Jefe de planta` }).click()
  await expect(page).toHaveURL(new RegExp(`/vacantes/${v.jefe}$`))
  await expect(page.getByRole('heading', { level: 1, name: `${MARCA} Jefe de planta` })).toBeVisible()

  const r = await pedir(`/portal/empresas/${e.molinos.codigo.toLowerCase()}`)
  expect(r.estado).toBe(200)
  expect((r.cuerpo.vacantes as Array<{ id: number }>).map((x) => x.id).sort()).toEqual([v.operario, v.jefe, v.calidad].sort())
  // La V86 (brochure-de-la-empresa) suma `mision`, `vision` y `brochure`, también públicos.
  expect(Object.keys(r.cuerpo).sort()).toEqual(['anioFundacion', 'beneficios', 'brochure', 'ciudad', 'codigo', 'logo', 'mision', 'nombre',
    'paginaWeb', 'portada', 'proposito', 'quienesSomos', 'redes', 'sector', 'sedes', 'tamano', 'tamanoTexto', 'vacantes', 'video', 'vision'])
  const crudo = JSON.stringify(r.cuerpo).toLowerCase()
  for (const prohibido of ['pretension', 'postulacion', 'candidato', 'correo', 'responsable', 'nota', 'solicitud']) {
    expect(crudo, `el perfil no trae «${prohibido}»`).not.toContain(prohibido)
  }
  // Con otra escritura del código también es la misma empresa.
  expect((await pedir(`/portal/empresas/${e.molinos.codigo}`)).estado).toBe(200)
})

test('AC-19 · AC-20: sin presentación sale el nombre con sus vacantes y sin bloques vacíos; sin vacantes, «Ahora no tiene vacantes abiertas»; un código que no existe o una empresa suspendida, «no encontrada» y 404', async ({ page }) => {
  await page.goto('/empresas/qa-prop-8029-ferreteria')
  await expect(page.getByRole('heading', { level: 1, name: 'Ferretería Los Andes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Vacantes abiertas (1)' })).toBeVisible()
  for (const titulo of ['Quiénes somos', 'Nuestro propósito', 'Beneficios', 'Datos de la empresa']) {
    await expect(page.getByRole('heading', { name: titulo })).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: 'Visitar web' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reproducir/ })).toHaveCount(0)
  await evidencia(page, 'perfil-sin-presentacion')

  await page.goto('/empresas/qa-prop-8029-estudio')
  await expect(page.getByRole('heading', { level: 1, name: 'Estudio Contable Ayacucho' })).toBeVisible()
  await expect(page.getByText('Ahora no tiene vacantes abiertas')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver vacantes (0)' })).toBeVisible()

  for (const codigo of ['qa-prop-8029-no-existe', 'qa-prop-8029-suspendida']) {
    await page.goto(`/empresas/${codigo}`)
    await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta empresa.' })).toBeVisible()
    await expect(page.getByText('No debería verse')).toHaveCount(0)
    expect((await pedir(`/portal/empresas/${codigo}`)).estado).toBe(404)
  }
  await evidencia(page, 'perfil-no-encontrada')
})

test('Sin datos de presentación la vacante se ve igual que antes: los bloques del puesto en su orden y nada más (AC-12, regresión)', async ({ page }) => {
  await page.goto(`/vacantes/${v.vendedor}`)
  await expect(page.getByRole('heading', { name: 'Lo que buscamos' })).toBeVisible()
  const titulos = await page.evaluate(() => [...document.querySelectorAll('article h2')].map((h) => h.textContent?.trim()))
  expect(titulos).toEqual(['El resultado que esperamos', 'Lo que buscamos'])
  expect(consultar(`select 1 from organizacion_red_social where organizacion_id = ${e.ferreteria.id}`)).toHaveLength(0)
})

