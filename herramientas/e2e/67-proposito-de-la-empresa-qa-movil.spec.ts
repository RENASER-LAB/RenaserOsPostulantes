/**
 * «El propósito de la empresa» en el teléfono (390×844), contra el preview real.
 *
 *   - AC-16: la página de una vacante con todos los datos: el bloque «Sobre…» cabe a lo ancho,
 *     el video ocupa el ancho del bloque en 16:9, los enlaces pasan a la línea siguiente, la
 *     barra fija de «Postular» no tapa el final del bloque y no hay desplazamiento horizontal.
 *     Un nombre de empresa largo se parte sin cortarse.
 *   - AC-22 en el teléfono: el video del puesto arriba de la ficha y el de la empresa en «Sobre…».
 *   - AC-27 en el teléfono: el perfil con portada y logo en una sola columna, con la ficha antes
 *     que lo demás, y sin desplazamiento horizontal.
 *
 * ⚠️ **ESCRIBE** en el clon: una empresa `QA-PROP-8029-MOVIL` con sus vacantes, y el logo, la
 * portada y la presentación de la plataforma, que se fotografían antes y se devuelven al final.
 */

import { expect, type Locator, type Page } from '@playwright/test'
import { tokenDelPanel } from './ayuda'
import { test } from './ayuda-candidato'
import {
  devolver,
  fotoDe,
  laPlataforma,
  MARCA,
  pedir,
  png,
  ponerPresentacion,
  retirarLoSembrado,
  sembrarEmpresa,
  sembrarVacante,
  subirImagen,
  type Empresa,
  type Foto,
} from './ayuda-proposito-de-la-empresa'
import { sql } from './base-de-datos'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true })

const EVIDENCIAS = process.env.E2E_EVIDENCIAS ?? ''
async function evidencia(page: Page, nombre: string) {
  if (EVIDENCIAS) await page.screenshot({ path: `${EVIDENCIAS}/${nombre}.png`, fullPage: true })
}

const NOMBRE_LARGO = 'Molinos del Sur y Derivados Andinos del Altiplano Peruano Sociedad Anónima Cerrada'
const LINEA = 'Que ninguna familia del altiplano se quede sin pan en la mesa, con trigo andino y precio justo.\n'
const PROPOSITO_LARGO = (LINEA.repeat(Math.ceil(1500 / LINEA.length))).slice(0, 1499).trim()

let plataforma: Empresa
let foto: Foto
let empresa: Empresa
const v = { completa: 0, conVideoDelPuesto: 0 }
let imagenesSubidas = false

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

async function sinDesplazamientoHorizontal(page: Page) {
  const medidas = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    cuerpo: document.body.scrollWidth,
    ventana: document.documentElement.clientWidth,
  }))
  expect(medidas.documento, JSON.stringify(medidas)).toBeLessThanOrEqual(medidas.ventana)
  expect(medidas.cuerpo, JSON.stringify(medidas)).toBeLessThanOrEqual(medidas.ventana)
}

async function caja(l: Locator) {
  const c = await l.boundingBox()
  if (!c) throw new Error('Sin caja: el elemento no se ve')
  return c
}

test.beforeAll(async () => {
  retirarLoSembrado()
  plataforma = laPlataforma()
  foto = fotoDe(plataforma.id)
  sql(`update organizacion set logo_archivo_id = null, portada_archivo_id = null where id = ${plataforma.id};`)
  ponerPresentacion(plataforma.id, {
    proposito: 'Que cada persona encuentre un trabajo con sentido.',
    quienes: 'Somos la consultora que conecta personas y propósito.',
    sector: 'Consultoría de talento',
    tamano: 'DE_11_A_50',
    anio: 2019,
    video: 'https://www.youtube.com/watch?v=abc123DEF45',
    web: 'https://renaser.pe',
    redes: { INSTAGRAM: 'https://www.instagram.com/renaser', LINKEDIN: 'https://www.linkedin.com/company/renaser' },
    beneficios: ['Seguro EPS', 'Trabajo remoto', 'Capacitación pagada'],
  })
  const token = await tokenDelPanel()
  imagenesSubidas = true
  expect((await subirImagen(token, 'logo', png(400, 400))).estado).toBe(200)
  expect((await subirImagen(token, 'portada', png(1600, 400))).estado).toBe(200)

  empresa = sembrarEmpresa('MOVIL', NOMBRE_LARGO)
  ponerPresentacion(empresa.id, {
    proposito: PROPOSITO_LARGO,
    video: 'https://www.youtube.com/watch?v=MoViL123456',
    web: 'https://molinosdelsur.pe',
    redes: {
      FACEBOOK: 'https://www.facebook.com/molinosdelsur',
      INSTAGRAM: 'https://www.instagram.com/molinosdelsur',
      LINKEDIN: 'https://www.linkedin.com/company/molinosdelsur',
      TIKTOK: 'https://www.tiktok.com/@molinosdelsur',
      YOUTUBE: 'https://www.youtube.com/@molinosdelsur',
    },
    beneficios: ['Seguro EPS'],
  })
  v.completa = sembrarVacante(empresa.id, 'Operario en el teléfono', {
    proposito: 'Reducir los tiempos de despacho',
    responsabilidades: 'Operar el molino.',
    requisitos: 'Experiencia en planta.',
    indispensables: ['Secundaria completa'],
  })
  v.conVideoDelPuesto = sembrarVacante(empresa.id, 'Jefe de planta en el teléfono', {
    proposito: 'Que la planta no pare',
    video: 'https://vimeo.com/987654321',
  })
})

test.afterAll(async () => {
  const errores: unknown[] = []
  const paso = async (accion: () => unknown) => {
    try { await accion() } catch (error) { errores.push(error) }
  }
  if (imagenesSubidas) {
    await paso(async () => {
      const token = await tokenDelPanel()
      await pedir('/panel/organizacion/presentacion/imagenes/logo', { token, metodo: 'DELETE' })
      await pedir('/panel/organizacion/presentacion/imagenes/portada', { token, metodo: 'DELETE' })
    })
  }
  await paso(() => devolver(foto))
  await paso(() => retirarLoSembrado())
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza: ${errores.map(String).join('\n')}`)
})

test('AC-16: con todos los datos el bloque cabe a lo ancho, el video ocupa el ancho del bloque en 16:9, los enlaces pasan de línea, la barra de «Postular» no tapa el final y no hay desplazamiento horizontal', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${v.completa}`)
  await expect(page.getByRole('heading', { level: 1, name: `${MARCA} Operario en el teléfono` })).toBeVisible()
  const bloque = page.getByRole('region', { name: `Sobre ${NOMBRE_LARGO}` })
  await expect(bloque).toBeVisible()
  await sinDesplazamientoHorizontal(page)

  // El nombre largo se parte, no se corta.
  const nombre = page.getByRole('link', { name: NOMBRE_LARGO, exact: true })
  const medidaNombre = await nombre.evaluate((el) => ({ scroll: el.scrollWidth, ancho: el.clientWidth, alto: el.getBoundingClientRect().height }))
  expect(medidaNombre.scroll).toBeLessThanOrEqual(medidaNombre.ancho + 1)
  const tituloBloque = bloque.getByRole('heading', { name: `Sobre ${NOMBRE_LARGO}` })
  expect(await tituloBloque.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)

  const cajaBloque = await caja(bloque)
  expect(cajaBloque.x).toBeGreaterThanOrEqual(0)
  expect(cajaBloque.x + cajaBloque.width).toBeLessThanOrEqual(390)

  // En el teléfono no hay video en la tarjeta: va en el bloque, al ancho del bloque y en 16:9.
  await expect(page.getByRole('button', { name: /^Reproducir/ })).toHaveCount(1)
  await expect(bloque.getByText(`Conoce a ${NOMBRE_LARGO}`)).toBeVisible()
  const recuadro = bloque.getByRole('button', { name: `Reproducir el video de ${NOMBRE_LARGO}` })
  await recuadro.scrollIntoViewIfNeeded()
  const cajaRecuadro = await caja(recuadro)
  const anchoUtil = await bloque.evaluate((el) => {
    const estilo = getComputedStyle(el)
    return el.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
  })
  expect(Math.abs(cajaRecuadro.width - anchoUtil)).toBeLessThanOrEqual(2)
  expect(Math.abs(cajaRecuadro.height - (cajaRecuadro.width * 9) / 16)).toBeLessThanOrEqual(2)

  // Los seis enlaces caben y pasan a la línea siguiente.
  const enlaces = bloque.getByRole('list', { name: 'Enlaces de la empresa' }).getByRole('link')
  await expect(enlaces).toHaveText(['Página web', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube'])
  const cajas = await enlaces.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), right: r.right })))
  for (const c of cajas) expect(c.right).toBeLessThanOrEqual(390)
  expect(new Set(cajas.map((c) => c.top)).size).toBeGreaterThan(1)

  // Al final de la página, la barra fija de «Postular» no tapa el último enlace ni «Ver perfil…».
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  const postular = page.getByRole('link', { name: /postular/i }).last()
  await expect(postular).toBeVisible()
  const cajaPostular = await caja(postular)
  const ultimo = await caja(enlaces.last())
  const verPerfil = await caja(bloque.getByRole('link', { name: `Ver perfil de ${NOMBRE_LARGO} →` }))
  expect(ultimo.y + ultimo.height).toBeLessThanOrEqual(cajaPostular.y)
  expect(verPerfil.y + verPerfil.height).toBeLessThanOrEqual(cajaPostular.y)
  expect(pedidas).toEqual([])
  await evidencia(page, 'movil-vacante-completa')

  await recuadro.scrollIntoViewIfNeeded()
  await recuadro.click()
  const reproductor = bloque.locator('iframe')
  await expect(reproductor).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/MoViL123456?autoplay=1&rel=0')
  const cajaReproductor = await caja(reproductor)
  expect(Math.abs(cajaReproductor.width - anchoUtil)).toBeLessThanOrEqual(2)
  expect(Math.abs(cajaReproductor.height - (cajaReproductor.width * 9) / 16)).toBeLessThanOrEqual(2)
  await sinDesplazamientoHorizontal(page)
})

test('AC-22 en el teléfono: el video del puesto va arriba, antes de la información, y el de la empresa en «Sobre…»; ninguno pide nada hasta pulsarlo', async ({ page }) => {
  const pedidas = await vigilarVideos(page)
  await page.goto(`/vacantes/${v.conVideoDelPuesto}`)
  const arriba = page.getByText('Conoce el puesto')
  await expect(arriba).toBeVisible()
  const resultado = page.getByRole('heading', { name: 'El resultado que esperamos' })
  expect((await caja(arriba)).y).toBeLessThan((await caja(resultado)).y)
  const bloque = page.getByRole('region', { name: `Sobre ${NOMBRE_LARGO}` })
  await expect(bloque.getByText(`Conoce a ${NOMBRE_LARGO}`)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reproducir/ })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Ver en Vimeo' })).toHaveAttribute('href', 'https://vimeo.com/987654321')
  await sinDesplazamientoHorizontal(page)
  expect(pedidas).toEqual([])
  await evidencia(page, 'movil-vacante-dos-videos')
  await page.getByRole('button', { name: /^Reproducir/ }).first().click()
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://player.vimeo.com/video/987654321?autoplay=1&dnt=1')
})

test('AC-27 en el teléfono: el perfil con portada y logo va en una columna, la ficha antes que lo demás, y sin desplazamiento horizontal', async ({ page }) => {
  await page.goto('/empresas/renaser')
  await expect(page.getByRole('heading', { level: 1, name: plataforma.nombre })).toBeVisible()
  const portada = page.getByRole('img', { name: `Portada de ${plataforma.nombre}` })
  const logo = page.getByRole('img', { name: `Logo de ${plataforma.nombre}` })
  await expect(portada).toBeVisible()
  await expect(logo).toBeVisible()
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  const cajaPortada = await caja(portada)
  expect(Math.abs(cajaPortada.height - 120)).toBeLessThanOrEqual(2)
  expect(cajaPortada.x).toBeLessThanOrEqual(1)
  expect(cajaPortada.width).toBeGreaterThanOrEqual(388)
  await expect(page.getByText('Consultoría de talento · 11–50 colaboradores · Fundada en 2019')).toBeVisible()

  const ficha = page.getByRole('complementary', { name: 'Datos de la empresa' })
  const quienes = page.getByRole('region', { name: 'Quiénes somos' })
  const vacantes = page.getByRole('region', { name: /^Vacantes abiertas/ })
  const [f, q, va] = [await caja(ficha), await caja(quienes), await caja(vacantes)]
  expect(f.y).toBeLessThan(q.y)
  expect(Math.abs(f.x - q.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(f.x - va.x)).toBeLessThanOrEqual(2)
  expect(f.x + f.width).toBeLessThanOrEqual(390)
  await expect(page.getByRole('region', { name: 'Beneficios' }).getByRole('listitem')).toHaveCount(3)
  await sinDesplazamientoHorizontal(page)
  await evidencia(page, 'movil-perfil-plataforma')

  await page.goto('/empresas/qa-prop-8029-movil')
  await expect(page.getByRole('heading', { level: 1, name: NOMBRE_LARGO })).toBeVisible()
  expect(await page.getByRole('heading', { level: 1 }).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await expect(page.getByRole('heading', { name: 'Vacantes abiertas (2)' })).toBeVisible()
  await sinDesplazamientoHorizontal(page)
  await evidencia(page, 'movil-perfil-nombre-largo')
})
