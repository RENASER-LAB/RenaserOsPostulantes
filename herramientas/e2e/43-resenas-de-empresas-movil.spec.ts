import { expect, type Page } from '@playwright/test'
import { crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import {
  correoDeCandidata,
  idsDeLaCuenta,
  retirarLoSembrado,
  sembrarEmpresaB,
  sembrarPostulacion,
  sembrarResenaDe,
  sembrarRespuesta,
  sembrarVacanteDe,
  usuarioDelEquipo,
} from './ayuda-resenas'
import { sql } from './base-de-datos'

/**
 * Las reseñas en el teléfono (375 px, proyecto `movil`): los riesgos de la spec
 * que solo se ven en móvil. Textos de 1000 caracteres, una respuesta de 500 y
 * una empresa de nombre largo.
 */

const MIL = ('Muy responsable con los plazos y con el equipo de obra. '.repeat(40)).slice(0, 1000)
const QUINIENTOS = ('Gracias por la oportunidad, aprendí mucho con todo el equipo. '.repeat(10)).slice(0, 500)

let correo = ''

test.beforeAll(async () => {
  retirarLoSembrado([], null)
  correo = correoDeCandidata()
  await crearCuentaDeCandidato({ nombre: 'Rocío', apellidos: 'Móvil', correo })
  const { usuario, persona } = idsDeLaCuenta(correo)
  const b = sembrarEmpresaB(correo)
  const equipo = usuarioDelEquipo()
  const plataforma = Number(sql('select id from organizacion where es_plataforma;'))
  const va = sembrarVacanteDe(plataforma, equipo, 'Coordinador de obra')
  const va2 = sembrarVacanteDe(plataforma, equipo, 'Asistente de almacén')
  const vb = sembrarVacanteDe(b.id, b.usuario, 'Operario de campo')
  const larga = sembrarResenaDe(sembrarPostulacion(va, usuario, 'CONTRATADO'), persona, 5, MIL, 3, equipo)
  sembrarRespuesta(larga, usuario, QUINIENTOS, 2, 28)
  sembrarResenaDe(sembrarPostulacion(vb, usuario, 'CONTRATADO'), persona, 1,
    'No cumplió con los horarios pactados y dejó tareas sin terminar en la obra.', 5, b.usuario)
  sembrarResenaDe(sembrarPostulacion(va2, usuario, 'CONTRATADO'), persona, 4,
    'Buen desempeño general, con margen para mejorar la comunicación con el equipo.', 8, equipo)
})

test.afterAll(() => {
  retirarLoSembrado([correo].filter(Boolean), null)
})

async function alPerfil(page: Page) {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(correo),
  ])
  await page.goto('/perfil')
  await expect(page.getByRole('link', { name: /Ir a tus reseñas/ })).toBeVisible()
}

const desbordeDeLaPagina = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('la cabecera en una línea, el resumen apilado y la tarjeta de 1000 + 500 caracteres cortada', async ({ page }) => {
  await alPerfil(page)
  const linea = page.getByRole('link', { name: /Ir a tus reseñas/ })
  await expect(linea).toHaveText('3,3 · 3 reseñas')
  // Las líneas del TEXTO (no del icono, que va a otra altura dentro del flex).
  const alto = await linea.evaluate((e) => {
    const tops = new Set<number>()
    const recorrido = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
    for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
      if (!n.textContent?.trim()) continue
      const r = document.createRange()
      r.selectNodeContents(n)
      for (const x of r.getClientRects()) tops.add(Math.round(x.top / 4))
    }
    return tops.size
  })
  expect(alto, 'la línea de la cabecera se parte en varias').toBe(1)

  const seccion = page.locator('#resenas')
  await seccion.scrollIntoViewIfNeeded()
  const promedio = await seccion.getByText('3,3', { exact: true }).first().boundingBox()
  const reparto = await seccion.getByRole('list', { name: 'Reparto por estrellas' }).boundingBox()
  expect(promedio!.y + promedio!.height).toBeLessThanOrEqual(reparto!.y)

  const tarjeta = seccion.getByRole('article').filter({ hasText: 'Muy responsable' })
  await expect(tarjeta.getByRole('button', { name: 'Leer más' })).toHaveCount(2)
  const caja = await tarjeta.boundingBox()
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(375)
  expect(await desbordeDeLaPagina(page)).toBeLessThanOrEqual(0)
  await tarjeta.getByRole('button', { name: 'Leer más' }).first().click()
  await expect(tarjeta.getByRole('button', { name: 'Leer menos' })).toBeVisible()
})

test('AC-31 · «Ver todas» ocupa la pantalla, los chips se desplazan en horizontal y los filtros van apilados', async ({
  page,
}) => {
  await alPerfil(page)
  const verTodas = page.getByRole('button', { name: 'Ver todas las reseñas (3)' })
  await verTodas.click()
  const ventana = page.getByRole('dialog', { name: 'Reseñas de empresas' })
  await expect(ventana).toBeVisible()
  const caja = await ventana.boundingBox()
  expect(caja).toEqual({ x: 0, y: 0, width: 375, height: 812 })
  const chips = await ventana.getByRole('group', { name: 'Estrellas' }).evaluate((g) => {
    const fila = g.querySelector('button')!.parentElement!
    const estilo = getComputedStyle(fila)
    return { overflowX: estilo.overflowX, wrap: estilo.flexWrap, cabe: fila.scrollWidth <= fila.clientWidth }
  })
  expect(chips.overflowX).toMatch(/auto|scroll/)
  expect(chips.wrap).toBe('nowrap')
  const empresa = await ventana.getByLabel('Empresa').boundingBox()
  const orden = await ventana.getByLabel('Orden').boundingBox()
  expect(orden!.y).toBeGreaterThanOrEqual(empresa!.y + empresa!.height)
  // Las tarjetas de la ventana van completas, también la respuesta de 500.
  const larga = ventana.getByRole('article').filter({ hasText: 'Muy responsable' })
  await expect(larga.getByRole('button', { name: 'Leer más' })).toHaveCount(0)
  await expect(larga).toContainText(QUINIENTOS.trim().slice(-40))
  await page.keyboard.press('Escape')
  await expect(verTodas).toBeFocused()
})

test('RES-QA-01 · en el móvil nada de la ventana se sale del ancho (nombre de empresa largo)', async ({ page }) => {
  await alPerfil(page)
  await page.getByRole('button', { name: 'Ver todas las reseñas (3)' }).click()
  const ventana = page.getByRole('dialog', { name: 'Reseñas de empresas' })
  await expect(ventana.getByLabel('Empresa')).toBeVisible()
  const fuera = await ventana.evaluate((d) => {
    const ancho = window.innerWidth
    const cuerpo = d.children[1] as HTMLElement
    const chips = d.querySelector('[role=group][aria-label="Estrellas"]')
    const salidos = [...d.querySelectorAll<HTMLElement>('select, label, article, p, h2')]
      .filter((e) => !chips?.contains(e))
      .filter((e) => e.getBoundingClientRect().right > ancho + 1)
      .map((e) => `${e.tagName}:${Math.round(e.getBoundingClientRect().right)}`)
    return { salidos, desborde: cuerpo.scrollWidth - cuerpo.clientWidth }
  })
  expect(fuera.salidos, 'elementos de la ventana que se salen de los 375 px').toEqual([])
  expect(fuera.desborde, 'la ventana tiene scroll horizontal').toBeLessThanOrEqual(0)
})
