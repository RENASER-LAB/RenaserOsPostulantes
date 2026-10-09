import { readFile } from 'node:fs/promises'
import { expect, type Locator, type Page } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  guardar,
  sql,
  test,
  tokenDelCandidato,
} from './ayuda-candidato'
import { literal } from './base-de-datos'
import {
  correoDeCandidata,
  idsDeLaCuenta,
  retirarLoSembrado,
  sembrarContratacion,
  sembrarResena,
  sembrarVacante,
} from './ayuda-resenas'

/**
 * QA de los logros clave (specs/logros-clave-en-la-cabecera-del-perfil.md): lo
 * que `56-logros-clave` no recorre.
 *
 * - La cabecera completa —señas, reseñas, logros y enlaces— en escritorio: el
 *   orden, el corte a dos líneas con «…» y que nada sea índigo.
 * - Una cuenta SIN `perfil_candidato` que llena solo las cajas 1 y 3 (AC-03 al
 *   pie de la letra) y el aviso de «Acerca de ti» vacía, que se va y vuelve.
 * - AC-10 y AC-09 desde la pantalla: cambiar la ubicación no toca los logros y
 *   «Descargar todos mis datos» los lleva.
 * - El contador desde el 81 y un pegado de verdad (portapapeles) con saltos.
 * - Por API: `logros: null` conserva, y un 400 no estrena el perfil.
 *
 * ⚠️ **ESCRIBE**: crea cuentas `e2e.logros.qa.*@example.com` y una
 * `qa.resenas.c9f0.*` con dos contrataciones y sus reseñas (vacantes con la
 * marca de `ayuda-resenas`). Todo se retira al terminar.
 */

const CIEN = 'Reduje de 3 s a 400 ms la respuesta de la API de pagos que atiende a dos millones de clientes al mes'
/** Cien glifos anchos: no caben en dos líneas de 50ch y tienen que acabar en «…». */
const ANCHO = 'W'.repeat(100)
const CORTO = 'Automaticé el despliegue de 5 aplicaciones'

const cabecera = (page: Page): Locator =>
  page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
const enLaCabecera = (page: Page): Locator =>
  cabecera(page).getByRole('list', { name: 'Logros clave' })
const enAcercaDe = (page: Page): Locator =>
  page.locator('#seccion-acerca-de-ti').getByRole('list', { name: 'Logros clave' })
const caja = (page: Page, n: number): Locator => page.getByRole('textbox', { name: `Logro ${n}` })
const AVISO_VACIA = /Cuéntale al equipo/

async function loQueDice(lista: Locator): Promise<string[]> {
  return (await lista.getByRole('listitem').allTextContents()).map((t) => t.trim())
}

async function ponerPerfil(token: string, cuerpo: Record<string, unknown>): Promise<Response> {
  return fetch(`${API}/portal/perfil`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

async function pedirPerfil(token: string): Promise<{ titular: string | null; ubicacion: string | null; logros: string[] }> {
  return (await fetch(`${API}/portal/perfil`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

const filasDePerfil = (correo: string): number =>
  Number(
    sql(`select count(*) from perfil_candidato pc join usuario u on u.persona_id = pc.persona_id
          where u.correo = ${literal(correo)};`),
  )

async function abrirElFormulario(page: Page) {
  await page.getByRole('button', { name: /^(Escribir sobre ti|Editar lo tuyo)$/ }).click()
  await expect(page.getByRole('group', { name: 'Tus logros clave' })).toBeVisible()
}

async function entrarASuPerfil(page: Page, correo: string, nombre: string) {
  await entrarAlPortal(page, correo, CLAVE_DE_CANDIDATO)
  await page.goto('/perfil')
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible({ timeout: 20_000 })
}

test.describe('Los logros clave · QA', () => {
  const conResenas = correoDeCandidata()
  const sinPerfil = correoDePrueba('e2e.logros.qa.sinperfil')
  const conLogros = correoDePrueba('e2e.logros.qa.conlogros')
  const porApi = correoDePrueba('e2e.logros.qa.api')

  test.beforeAll(async () => {
    expect(CIEN).toHaveLength(100)

    // La cabecera llena: señas, dos reseñas publicadas, dos enlaces y tres logros.
    await crearCuentaDeCandidato({ nombre: 'Valeria', apellidos: 'Quispe Logros', correo: conResenas })
    const t1 = await tokenDelCandidato(conResenas)
    const r1 = await ponerPerfil(t1, {
      titular: 'Desarrolladora Backend',
      experienciaMeses: 20,
      ubicacion: 'Lima, Perú',
      disponibilidad: 'Inmediata',
      logros: [CIEN, ANCHO, CORTO],
    })
    expect(r1.ok).toBe(true)
    for (const [tipo, url] of [
      ['LINKEDIN', 'https://www.linkedin.com/in/valeria-quispe-qa'],
      ['GITHUB', 'https://github.com/valeria-quispe-qa'],
    ] as const) {
      const r = await fetch(`${API}/portal/perfil/enlaces`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, url }),
      })
      expect(r.ok, `enlace ${tipo}`).toBe(true)
    }
    const { usuario, persona } = idsDeLaCuenta(conResenas)
    const p1 = sembrarContratacion(sembrarVacante('Logros QA uno'), usuario, 70)
    sembrarResena(p1, persona, 5, 'Siempre puntual y muy clara al explicar lo que hacía.', 31)
    const p2 = sembrarContratacion(sembrarVacante('Logros QA dos'), usuario, 45)
    sembrarResena(p2, persona, 4, 'Buen trabajo en equipo y ordenada con la documentación.', 32)

    await crearCuentaDeCandidato({ nombre: 'Tomás', apellidos: 'Sin Perfil', correo: sinPerfil })

    await crearCuentaDeCandidato({ nombre: 'Rosa', apellidos: 'Con Logros', correo: conLogros })
    const r3 = await ponerPerfil(await tokenDelCandidato(conLogros), {
      titular: 'Analista contable',
      ubicacion: 'Arequipa',
      logros: [CORTO, CIEN],
    })
    expect(r3.ok).toBe(true)

    await crearCuentaDeCandidato({ nombre: 'Api', apellidos: 'De Logros', correo: porApi })
  })

  test.afterAll(() => {
    retirarLoSembrado([conResenas], null)
    borrarCuentasDePrueba([sinPerfil, conLogros, porApi])
  })

  test('escritorio: señas, reseñas, logros y enlaces en ese orden; dos líneas con «…» y nada índigo', async ({
    page,
  }) => {
    await entrarASuPerfil(page, conResenas, 'Valeria Quispe Logros')
    const cab = cabecera(page)
    const resenas = cab.getByRole('link', { name: /2 reseñas/ })
    const enlaces = cab.getByRole('link', { name: /LinkedIn|GitHub/ })
    await expect(resenas).toBeVisible()
    await expect(enlaces).toHaveCount(2)

    // El orden de la spec: debajo de las señas y de las reseñas, antes de los enlaces.
    const y = async (l: Locator) => (await l.boundingBox())!.y
    const rotulo = cab.getByText('Logros clave', { exact: true })
    expect(await y(cab.getByText('Lima, Perú'))).toBeLessThan(await y(resenas))
    expect(await y(resenas)).toBeLessThan(await y(rotulo))
    expect(await y(rotulo)).toBeLessThan(await y(enLaCabecera(page)))
    const finLogros = await enLaCabecera(page).evaluate((ol) => ol.getBoundingClientRect().bottom)
    expect(finLogros).toBeLessThanOrEqual(await y(enlaces.first()))

    expect(await loQueDice(enLaCabecera(page))).toEqual([`1${CIEN}`, `2${ANCHO}`, `3${CORTO}`])

    // Cada logro, dos líneas como mucho; el ancho, cortado con «…»; nada desborda.
    const medidas = await enLaCabecera(page).evaluate((ol) =>
      [...ol.querySelectorAll('li')].map((li) => {
        const texto = li.lastElementChild as HTMLElement
        const alto = texto.getBoundingClientRect().height
        return {
          lineas: Math.round(alto / parseFloat(getComputedStyle(texto).lineHeight)),
          recortado: texto.scrollHeight > texto.clientHeight + 1,
          desborda: texto.scrollWidth > texto.clientWidth + 1,
        }
      }),
    )
    for (const m of medidas) {
      expect(m.lineas).toBeLessThanOrEqual(2)
      expect(m.desborda).toBe(false)
    }
    expect(medidas[1]!.recortado, 'cien «W» no caben en dos líneas: se cortan').toBe(true)

    // La regla de la voz única: ni el rótulo, ni el número, ni el texto en índigo.
    const colores = await cab.evaluate((h) => {
      const sonda = document.createElement('span')
      sonda.style.color = 'var(--activo)'
      document.body.append(sonda)
      const indigo = getComputedStyle(sonda).color
      sonda.remove()
      const ol = h.querySelector('ol')!
      const rotuloEl = document.getElementById(ol.getAttribute('aria-labelledby')!)!
      const li = ol.querySelector('li')!
      return {
        indigo,
        usados: [rotuloEl, li.firstElementChild!, li.lastElementChild!].map((e) => getComputedStyle(e).color),
      }
    })
    for (const usado of colores.usados) expect(usado).not.toBe(colores.indigo)

    // En «Acerca de ti», los mismos y enteros.
    await enAcercaDe(page).scrollIntoViewIfNeeded()
    expect(await loQueDice(enAcercaDe(page))).toEqual([`1${CIEN}`, `2${ANCHO}`, `3${CORTO}`])
    const recortados = await enAcercaDe(page).evaluate((ol) =>
      [...ol.querySelectorAll('li')].filter((li) => {
        const t = li.lastElementChild as HTMLElement
        return t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1
      }).length,
    )
    expect(recortados).toBe(0)
  })

  test('sin perfil todavía: llenar solo las cajas 1 y 3 crea el perfil, quedan 1 y 2, y el aviso de vacía se va y vuelve', async ({
    page,
  }) => {
    expect(filasDePerfil(sinPerfil)).toBe(0)
    await entrarASuPerfil(page, sinPerfil, 'Tomás Sin Perfil')
    await expect(page.getByText(AVISO_VACIA)).toBeVisible()
    await expect(page.getByText('Logros clave', { exact: true })).toHaveCount(0)

    await abrirElFormulario(page)
    await caja(page, 1).fill('Bajé un 20 % la rotación del área de ventas')
    await caja(page, 3).fill('   Cerré 12 contratos B2B en mi primer año   ')
    await guardar(page)

    const quedan = ['Bajé un 20 % la rotación del área de ventas', 'Cerré 12 contratos B2B en mi primer año']
    await expect(enLaCabecera(page).getByRole('listitem')).toHaveCount(2)
    expect(await loQueDice(enLaCabecera(page))).toEqual(quedan.map((l, i) => `${i + 1}${l}`))
    expect(await loQueDice(enAcercaDe(page))).toEqual(quedan.map((l, i) => `${i + 1}${l}`))
    expect(filasDePerfil(sinPerfil)).toBe(1)
    // Con logros, «Acerca de ti» ya no está vacía.
    await expect(page.getByText(AVISO_VACIA)).toHaveCount(0)

    // Y al vaciarlas —una con solo espacios— todo vuelve a como estaba.
    await abrirElFormulario(page)
    await caja(page, 1).fill('')
    await caja(page, 2).fill('     ')
    await caja(page, 3).fill('')
    await guardar(page)
    await expect(page.getByText('Logros clave', { exact: true })).toHaveCount(0)
    await expect(page.getByText(AVISO_VACIA)).toBeVisible()
  })

  test('AC-10 y AC-09 desde la pantalla: cambiar la ubicación no toca los logros y la descarga los lleva', async ({
    page,
  }) => {
    const token = await tokenDelCandidato(conLogros)
    await entrarASuPerfil(page, conLogros, 'Rosa Con Logros')

    await abrirElFormulario(page)
    await page.getByRole('textbox', { name: /Dónde estás/ }).fill('Trujillo, Perú')
    await guardar(page)
    await expect(cabecera(page).getByText('Trujillo, Perú')).toBeVisible()
    expect(await loQueDice(enLaCabecera(page))).toEqual([`1${CORTO}`, `2${CIEN}`])
    const perfil = await pedirPerfil(token)
    expect(perfil.ubicacion).toBe('Trujillo, Perú')
    expect(perfil.logros).toEqual([CORTO, CIEN])

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar todos mis datos' }).click(),
    ])
    const datos = JSON.parse(await readFile((await descarga.path())!, 'utf8'))
    expect(datos.logros).toEqual([CORTO, CIEN])
  })

  test('el contador sale desde el 81 y un pegado de verdad con saltos queda en una línea de 100', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await entrarASuPerfil(page, conLogros, 'Rosa Con Logros')
    await abrirElFormulario(page)
    const grupo = page.getByRole('group', { name: 'Tus logros clave' })
    const tercera = caja(page, 3)

    await tercera.fill('a'.repeat(80))
    await expect(grupo.getByText('80 de 100 caracteres')).toHaveCount(0)
    await tercera.press('End')
    await tercera.pressSequentially('a')
    await expect(grupo.getByText('81 de 100 caracteres')).toBeVisible()

    const pegar = async (texto: string) => {
      await tercera.fill('')
      await tercera.focus()
      await page.evaluate((t) => navigator.clipboard.writeText(t), texto)
      await page.keyboard.press('ControlOrMeta+V')
    }
    await pegar('Primera línea\nsegunda línea\r\ntercera')
    await expect(tercera).toHaveValue('Primera línea segunda línea tercera')

    await pegar('P'.repeat(150))
    await expect(tercera).toHaveValue('P'.repeat(100))
    await expect(grupo.getByText('100 de 100 caracteres').last()).toBeVisible()

    // Lo pegado no se guarda: se deja el formulario como estaba.
    await page.getByRole('button', { name: 'Dejarlo' }).click()
    expect((await pedirPerfil(await tokenDelCandidato(conLogros))).logros).toEqual([CORTO, CIEN])
  })

  test('por API: `logros: null` conserva y un 400 no estrena el perfil de quien no lo tenía', async () => {
    const token = await tokenDelCandidato(porApi)
    for (const logros of [['a', 'b', 'c', 'd'], ['x'.repeat(101)]]) {
      expect((await ponerPerfil(token, { titular: 'Nada', logros })).status).toBe(400)
    }
    expect(filasDePerfil(porApi), 'un 400 no deja creado el perfil').toBe(0)

    expect((await ponerPerfil(token, { logros: ['uno', 'uno'] })).ok).toBe(true)
    expect((await pedirPerfil(token)).logros, 'los repetidos se guardan tal cual').toEqual(['uno', 'uno'])

    expect((await ponerPerfil(token, { titular: 'Contadora', logros: null })).ok).toBe(true)
    const perfil = await pedirPerfil(token)
    expect(perfil.titular).toBe('Contadora')
    expect(perfil.logros, 'null es «no tocar», no «borrar»').toEqual(['uno', 'uno'])
  })
})
