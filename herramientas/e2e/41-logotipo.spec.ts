import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Locator, type Page } from '@playwright/test'

import { entrarAlPanel, idDeVacante, VACANTES } from './ayuda'
import { test } from './ayuda-candidato'

/**
 * El logotipo nuevo de EX (spec `cambiar-el-logo.md`): la «E» maciza y la «X»
 * hueca cruzada por la hormiga, pintado por `Marca` como máscara sobre
 * `currentColor`.
 *
 * Solo lee: un visitante sin sesión y un miembro del equipo por el `dev-login`.
 * No escribe nada en la base.
 *
 * Lo que aquí no se mide —la nitidez a 2× y 3× y si la hormiga se reconoce a
 * 28 px— es de mirar, y lo mira QA con `herramientas/capturar-logo.mjs`. A 360
 * y 375 px, la cabecera se comprueba en `07-movil.spec.ts`.
 */

/** `--tinta`. Literal a propósito: el AC pide este color y no negro puro. */
const TINTA = 'rgb(16, 24, 40)'

const cabecera = (page: Page) => page.getByRole('banner')
const pie = (page: Page) => page.getByRole('contentinfo')
/** El dibujo en sí. Por clase y no por rol: en los estados vacíos va dentro de un `aria-hidden`. */
const dibujo = (dentro: Locator) => dentro.locator('.marca')

async function medir(marca: Locator) {
  await expect(marca).toBeVisible()
  return marca.evaluate((el) => {
    const estilo = getComputedStyle(el)
    const caja = el.getBoundingClientRect()
    return {
      alto: caja.height,
      ancho: caja.width,
      color: estilo.color,
      fondo: estilo.backgroundColor,
      mascara: estilo.getPropertyValue('mask-image') || estilo.getPropertyValue('-webkit-mask-image'),
    }
  })
}

/** El color que resuelve una variable de `mundo.css`, sin copiarlo aquí. */
const colorDeLaVariable = (page: Page, variable: string) =>
  page.evaluate((nombre) => {
    const sonda = document.createElement('span')
    sonda.style.color = `var(${nombre})`
    document.body.append(sonda)
    const color = getComputedStyle(sonda).color
    sonda.remove()
    return color
  }, variable)

/** El alto que la cabecera tenía antes del logotipo nuevo: el token medido en el navegador. */
const altoDeLaCabeceraMedido = (page: Page) =>
  page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-cabecera')),
  )

const hayScrollHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

test.describe('El logotipo nuevo en el portal', () => {
  // AC-01, AC-05
  test('la cabecera de la portada lleva el logotipo de 28 px, en tinta, que vuelve a Inicio', async ({ page }) => {
    await page.goto('/')
    const enlace = cabecera(page).getByRole('link', { name: 'EX, inicio' })
    await expect(enlace).toBeVisible()
    await expect(enlace).toHaveAttribute('href', '/')

    const marca = await medir(dibujo(enlace))
    expect(Math.abs(marca.alto - 28), `alto ${marca.alto}`).toBeLessThanOrEqual(1)
    // El ancho sale de la proporción del archivo, 808 × 714.
    expect(Math.abs(marca.ancho - 28 * (808 / 714)), `ancho ${marca.ancho}`).toBeLessThanOrEqual(1)
    expect(marca.color).toBe(TINTA)
    expect(marca.fondo, 'se pinta con currentColor, no en negro fijo').toBe(TINTA)
    expect(marca.mascara).toContain('logotipo')

    // La palabra con la hormiga vista desde arriba ya no existe en ningún sitio.
    await expect(page.locator('.marca-letras, .marca-hormiga')).toHaveCount(0)
    await expect(page.locator('.marca svg')).toHaveCount(0)
  })

  // AC-03
  test('en el pie mide 56 px en la portada y 24 en cualquier otro pie en columnas', async ({ page }) => {
    await page.goto('/')
    const dePortada = await medir(dibujo(pie(page).getByRole('link', { name: 'EX, inicio' })))
    expect(Math.abs(dePortada.alto - 56), `alto ${dePortada.alto}`).toBeLessThanOrEqual(1)
    expect(dePortada.fondo).toBe(TINTA)

    await page.goto('/vacantes')
    const deVacantes = await medir(dibujo(pie(page).getByRole('link', { name: 'EX, inicio' })))
    expect(Math.abs(deVacantes.alto - 24), `alto ${deVacantes.alto}`).toBeLessThanOrEqual(1)
    expect(deVacantes.fondo).toBe(TINTA)
  })

  // AC-04
  test('en «Acceso necesario» sale en gris `--regla2` a 36 px, como marca de agua', async ({ page }) => {
    await page.goto('/procesos')
    await expect(page.getByRole('heading', { name: 'Ingresa para ver tu proceso.' })).toBeVisible()
    const marca = await medir(dibujo(page.getByRole('main')))
    const gris = await colorDeLaVariable(page, '--regla2')
    expect(Math.abs(marca.alto - 36), `alto ${marca.alto}`).toBeLessThanOrEqual(1)
    expect(marca.fondo, 'el gris prueba que se pinta con currentColor').toBe(gris)
    expect(marca.fondo).not.toBe(TINTA)
    // El envoltorio va con `aria-hidden`: la marca de agua no se anuncia.
    await expect(page.getByRole('main').getByRole('img', { name: 'EX' })).toHaveCount(0)
  })

  // AC-06
  test('el enlace del correo que falla lo enseña a 48 px, sin anunciarlo', async ({ page }) => {
    await page.goto('/acceso')
    await expect(page.getByRole('heading', { name: 'No pudimos abrir tu enlace.' })).toBeVisible()
    const marca = await medir(dibujo(page.getByRole('main')))
    expect(Math.abs(marca.alto - 48), `alto ${marca.alto}`).toBeLessThanOrEqual(1)
    expect(marca.fondo).toBe(TINTA)
  })

  // AC-06
  test('la invitación al panel lo enseña a 28 px y lo anuncia como «EX»', async ({ page }) => {
    await page.goto('/admin/invitacion?token=solo-para-mirar-el-logotipo')
    await expect(page.getByRole('heading', { name: 'Crea tu acceso al panel.' })).toBeVisible()
    const imagen = page.getByRole('img', { name: 'EX', exact: true })
    await expect(imagen).toHaveCount(1)
    const marca = await medir(imagen)
    expect(Math.abs(marca.alto - 28), `alto ${marca.alto}`).toBeLessThanOrEqual(1)
    expect(marca.fondo).toBe(TINTA)
  })

  // AC-07
  test('la pestaña lleva `/favicon.png`, nadie pide `/hormiga.svg` y la consola queda limpia', async ({ page }) => {
    const pedidas: string[] = []
    const errores: string[] = []
    page.on('request', (r) => pedidas.push(new URL(r.url()).pathname))
    page.on('console', (m) => {
      if (m.type() === 'error') errores.push(m.text().slice(0, 200))
    })

    await page.goto('/')
    await expect(cabecera(page).getByRole('link', { name: 'EX, inicio' })).toBeVisible()
    await page.waitForLoadState('load')

    const icono = page.locator('link[rel="icon"]')
    await expect(icono).toHaveCount(1)
    await expect(icono).toHaveAttribute('href', '/favicon.png')
    await expect(icono).toHaveAttribute('type', 'image/png')

    const favicon = await page.request.get('/favicon.png')
    expect(favicon.status()).toBe(200)
    expect(favicon.headers()['content-type']).toContain('image/png')

    expect(pedidas.filter((ruta) => ruta.endsWith('/hormiga.svg'))).toEqual([])
    expect(existsSync(resolve(process.cwd(), 'public/hormiga.svg')), 'el SVG viejo sigue en public/').toBe(false)
    expect(errores, `Errores en la consola:\n${errores.join('\n')}`).toEqual([])
  })

  // AC-08, en escritorio. A 360 y 375, en `07-movil.spec.ts`.
  test('a 1280 px la cabecera no crece, los destinos siguen al centro y no hay scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const barra = cabecera(page)
    await expect(barra.getByRole('link', { name: 'EX, inicio' })).toBeVisible()

    const alto = (await barra.boundingBox())!.height
    expect(Math.abs(alto - (await altoDeLaCabeceraMedido(page))), `la cabecera mide ${alto}`).toBeLessThanOrEqual(0.5)

    // La columna central sigue en el eje de la barra: la marca no la empuja.
    const pildora = (await barra.locator(':scope > div').first().boundingBox())!
    const destinos = (await barra.getByRole('navigation').boundingBox())!
    const eje = pildora.x + pildora.width / 2
    expect(Math.abs(destinos.x + destinos.width / 2 - eje)).toBeLessThanOrEqual(1)

    expect(await hayScrollHorizontal(page)).toBe(false)
  })

  // AC-10
  test('con colores forzados sigue visible, en el color de texto del sistema', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/')
    const marca = dibujo(cabecera(page).getByRole('link', { name: 'EX, inicio' }))
    const { fondo, ajuste, textoDelSistema } = await marca.evaluate((el) => {
      const sonda = document.createElement('span')
      sonda.style.color = 'CanvasText'
      document.body.append(sonda)
      const texto = getComputedStyle(sonda).color
      sonda.remove()
      const estilo = getComputedStyle(el)
      return { fondo: estilo.backgroundColor, ajuste: estilo.getPropertyValue('forced-color-adjust'), textoDelSistema: texto }
    })
    expect(ajuste).toBe('none')
    expect(fondo).toBe(textoDelSistema)
    expect(fondo).not.toBe('rgba(0, 0, 0, 0)')
    const caja = (await marca.boundingBox())!
    expect(caja.height).toBeGreaterThan(27)
  })

  // Punto 8 de la spec: si el PNG no llega, el hueco se queda y el enlace conserva su nombre.
  test('si el PNG no carga, la caja guarda su sitio y el enlace su nombre', async ({ page }) => {
    // ⚠️ Solo se corta la IMAGEN. Con el servidor de Vite el `import` del PNG
    // también es una petición —`logotipo.png?import`, un módulo JS— y cortarla
    // tumba la aplicación entera: eso probaría otra cosa, no el punto 8.
    const cortadas: string[] = []
    await page.route(/logotipo[^/]*\.png/, (ruta) => {
      if (ruta.request().resourceType() === 'script') return ruta.continue()
      cortadas.push(ruta.request().url())
      return ruta.abort('internetdisconnected')
    })
    const errores: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errores.push(m.text().slice(0, 200))
    })

    await page.goto('/')
    const enlace = cabecera(page).getByRole('link', { name: 'EX, inicio' })
    await expect(enlace).toBeVisible()
    await expect.poll(() => cortadas.length, 'la imagen del logotipo debe haberse pedido y cortado').toBeGreaterThan(0)
    const caja = (await dibujo(enlace).boundingBox())!
    expect(Math.abs(caja.height - 28)).toBeLessThanOrEqual(1)
    expect(Math.abs(caja.width - 28 * (808 / 714))).toBeLessThanOrEqual(1)
    expect((await cabecera(page).boundingBox())!.height, 'la cabecera no cambia de alto').toBeCloseTo(await altoDeLaCabeceraMedido(page), 0)
    // Nada de imagen rota del navegador: el logotipo no es un `<img>`.
    await expect(enlace.locator('img')).toHaveCount(0)
    // La única línea admitida es la que escribe el propio Chrome por la petición
    // cortada («Failed to load resource»); ningún error de la aplicación.
    const propios = errores.filter((texto) => !texto.startsWith('Failed to load resource'))
    expect(propios, `Errores en la consola:\n${propios.join('\n')}`).toEqual([])
  })
})

test.describe('El logotipo nuevo en el panel', () => {
  // AC-02
  test('la cabecera lleva el logotipo de 28 px y «Panel del equipo», y lleva a Vacantes', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto('/admin/pruebas')
    const enlace = cabecera(page).getByRole('link', { name: 'Panel del equipo, inicio' })
    await expect(enlace).toBeVisible()
    await expect(enlace).toContainText('Panel del equipo')
    await expect(enlace).toHaveAttribute('href', '/admin')

    const marca = await medir(dibujo(enlace))
    expect(Math.abs(marca.alto - 28), `alto ${marca.alto}`).toBeLessThanOrEqual(1)
    expect(marca.fondo).toBe(TINTA)

    await enlace.click()
    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  })

  // AC-04, la lista vacía (`Vacio`). Solo lee: la vacante sembrada «Desarrollador
  // web» no trae cuestionario técnico y ninguna otra prueba se lo escribe (16 y
  // 32 crean su propia vacante).
  test('en una lista vacía —el cuestionario técnico sin preguntas— sale en gris `--regla2` a 36 px', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${await idDeVacante(VACANTES.LLENA)}/prueba-tecnica`)
    const titulo = page.getByText('Todavía no hay cuestionario', { exact: true })
    await expect(titulo).toBeVisible({ timeout: 20_000 })
    const vacio = titulo.locator('..')
    const marca = await medir(dibujo(vacio))
    const gris = await colorDeLaVariable(page, '--regla2')
    expect(Math.abs(marca.alto - 36), `alto ${marca.alto}`).toBeLessThanOrEqual(1)
    expect(marca.fondo, 'el gris prueba que se pinta con currentColor').toBe(gris)
    expect(marca.fondo).not.toBe(TINTA)
    // El envoltorio va con `aria-hidden`: la marca de agua no se anuncia.
    await expect(vacio.getByRole('img', { name: 'EX' })).toHaveCount(0)
  })
})
