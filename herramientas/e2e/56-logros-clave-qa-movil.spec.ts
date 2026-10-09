import { expect, type Locator } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'
import { CLAVE_DE_CANDIDATO, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import {
  correoDeCandidata,
  idsDeLaCuenta,
  retirarLoSembrado,
  sembrarContratacion,
  sembrarResena,
  sembrarVacante,
} from './ayuda-resenas'

/**
 * QA de los logros clave a 375 px (lo corre el proyecto `movil`): la cabecera
 * entera —señas, reseñas, logros y enlaces— en el teléfono. Los logros van
 * debajo de la línea de reseñas y antes de los enlaces, a todo el ancho de la
 * tarjeta, cada uno en dos líneas como mucho, y nada se pisa ni desborda.
 *
 * ⚠️ **ESCRIBE**: una cuenta `qa.resenas.c9f0.*` con dos contrataciones y sus
 * reseñas (vacantes con la marca de `ayuda-resenas`), retirada al terminar.
 */

const CIEN = 'Reduje de 3 s a 400 ms la respuesta de la API de pagos que atiende a dos millones de clientes al mes'
const OTRO = 'Lideré la migración de 40 servicios a AWS sin caídas y bajé un 35 % la factura del primer trimestre.'
const CORTO = 'Automaticé el despliegue de 5 aplicaciones'

const correo = correoDeCandidata()

test.beforeAll(async () => {
  expect(CIEN).toHaveLength(100)
  expect(OTRO).toHaveLength(100)
  await crearCuentaDeCandidato({ nombre: 'Valeria', apellidos: 'Quispe Movil', correo })
  const token = await tokenDelCandidato(correo)
  const r = await fetch(`${API}/portal/perfil`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titular: 'Desarrolladora Backend',
      experienciaMeses: 20,
      ubicacion: 'Lima, Perú',
      disponibilidad: 'Inmediata',
      logros: [CIEN, OTRO, CORTO],
    }),
  })
  expect(r.ok).toBe(true)
  for (const [tipo, url] of [
    ['LINKEDIN', 'https://www.linkedin.com/in/valeria-quispe-movil'],
    ['GITHUB', 'https://github.com/valeria-quispe-movil'],
  ] as const) {
    const e = await fetch(`${API}/portal/perfil/enlaces`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, url }),
    })
    expect(e.ok, `enlace ${tipo}`).toBe(true)
  }
  const { usuario, persona } = idsDeLaCuenta(correo)
  const p = sembrarContratacion(sembrarVacante('Logros QA movil'), usuario, 70)
  sembrarResena(p, persona, 5, 'Siempre puntual y muy clara al explicar lo que hacía.', 31)
})

test.afterAll(() => retirarLoSembrado([correo], null))

test('375 px: reseñas, logros y enlaces apilados sin pisarse, a lo ancho de la tarjeta', async ({ page }) => {
  await entrarAlPortal(page, correo, CLAVE_DE_CANDIDATO)
  await page.goto('/perfil')
  const cabecera = page
    .locator('header')
    .filter({ has: page.getByRole('heading', { level: 1, name: 'Valeria Quispe Movil' }) })
  await expect(cabecera).toBeVisible({ timeout: 20_000 })
  const lista = cabecera.getByRole('list', { name: 'Logros clave' })
  await expect(lista.getByRole('listitem')).toHaveCount(3)

  const caja = async (l: Locator) => (await l.boundingBox())!
  const resenas = await caja(cabecera.getByRole('link', { name: /1 reseña/ }))
  const rotulo = await caja(cabecera.getByText('Logros clave', { exact: true }))
  const logros = await caja(lista)
  const enlaces = await caja(cabecera.getByRole('link', { name: /LinkedIn|GitHub/ }).first())
  const tarjeta = await caja(cabecera)

  expect(resenas.y + resenas.height).toBeLessThanOrEqual(rotulo.y)
  expect(rotulo.y + rotulo.height).toBeLessThanOrEqual(logros.y)
  expect(logros.y + logros.height).toBeLessThanOrEqual(enlaces.y)
  // A lo ancho de la tarjeta: sin encogerse al ancho del texto ni salirse de ella.
  expect(logros.x + logros.width).toBeLessThanOrEqual(tarjeta.x + tarjeta.width + 1)
  expect(logros.width).toBeGreaterThan(tarjeta.width * 0.8)

  const medidas = await lista.evaluate((ol) =>
    [...ol.querySelectorAll('li')].map((li) => {
      const texto = li.lastElementChild as HTMLElement
      return {
        lineas: Math.round(texto.getBoundingClientRect().height / parseFloat(getComputedStyle(texto).lineHeight)),
        recortado: texto.scrollHeight > texto.clientHeight + 1,
      }
    }),
  )
  expect(medidas.map((m) => m.lineas <= 2)).toEqual([true, true, true])
  expect(medidas[0]!.recortado && medidas[1]!.recortado, 'los de cien caracteres, cortados con «…»').toBe(true)

  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(desborda).toBe(false)
})
