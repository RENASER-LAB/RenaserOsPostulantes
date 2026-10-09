import { expect, type Locator, type Page } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  guardar,
  test,
  tokenDelCandidato,
} from './ayuda-candidato'

/**
 * Los logros clave del perfil (specs/logros-clave-en-la-cabecera-del-perfil.md),
 * contra el backend de verdad: escribir tres y verlos en la cabecera y en
 * «Acerca de ti»; dejar uno vacío en medio y ver la renumeración; vaciarlos y
 * ver que el bloque se va de las dos vistas; y el tope de 100 caracteres.
 *
 * ⚠️ **La cuenta nace SIN `perfil_candidato`** —se crea perezosamente al primer
 * guardado— y lo primero que se guarda son solo logros: así se prueba de paso
 * que eso basta para estrenar el perfil.
 *
 * ⚠️ **ESCRIBE**: crea `e2e.logros.<uuid>@example.com`, le llena los logros y
 * la borra al terminar.
 *
 * En serie: cada paso parte de lo que dejó el anterior.
 */
test.describe.configure({ mode: 'serial' })

const CORREO = correoDePrueba('e2e.logros')

const TRES = [
  'Reduje de 3 s a 400 ms la respuesta de la API de pagos',
  'Migré 40 servicios a AWS sin caídas',
  'Automaticé el despliegue de 5 aplicaciones',
]

let token = ''

interface PerfilVisto {
  titular: string | null
  ubicacion: string | null
  logros: string[]
}

/** El perfil como lo tiene el servidor, que es lo único que cuenta. */
const pedirPerfil = async (): Promise<PerfilVisto> =>
  (await fetch(`${API}/portal/perfil`, { headers: { Authorization: `Bearer ${token}` } })).json()

/**
 * La lista de la cabecera de identidad y la de la sección «Acerca de ti».
 *
 * La cabecera se busca como el `<header>` que lleva el nombre en el `h1`: dentro
 * de `main` un `<header>` no tiene el rol `banner`, que es el de la barra del sitio.
 */
const enLaCabecera = (page: Page): Locator =>
  page
    .locator('header')
    .filter({ has: page.getByRole('heading', { level: 1 }) })
    .getByRole('list', { name: 'Logros clave' })
const enAcercaDe = (page: Page): Locator =>
  page.locator('#seccion-acerca-de-ti').getByRole('list', { name: 'Logros clave' })

/** Lo que dice cada lista, logro a logro y con su número delante. */
async function loQueDice(lista: Locator): Promise<string[]> {
  return (await lista.getByRole('listitem').allTextContents()).map((t) => t.trim())
}

const numerados = (logros: string[]) => logros.map((l, i) => `${i + 1}${l}`)

async function abrirElFormulario(page: Page) {
  // Sin logros ni nada más, la sección ofrece «Escribir sobre ti»; con algo,
  // «Editar lo tuyo». Las dos abren el mismo formulario.
  await page.getByRole('button', { name: /^(Escribir sobre ti|Editar lo tuyo)$/ }).click()
  await expect(page.getByRole('group', { name: 'Tus logros clave' })).toBeVisible()
}

const caja = (page: Page, n: number): Locator => page.getByRole('textbox', { name: `Logro ${n}` })

test.describe('Los logros clave del perfil', () => {
  test.beforeAll(async () => {
    await crearCuentaDeCandidato({ nombre: 'Prueba', apellidos: 'De Logros', correo: CORREO })
    token = await tokenDelCandidato(CORREO)
  })

  test.afterAll(() => borrarCuentasDePrueba([CORREO]))

  test.beforeEach(async ({ page }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { level: 1, name: 'Prueba De Logros' })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('sin logros no hay rótulo en ninguna de las dos vistas', async ({ page }) => {
    await expect(page.getByText('Logros clave', { exact: true })).toHaveCount(0)
    expect((await pedirPerfil()).logros).toEqual([])
  })

  test('tres logros se ven en la cabecera y en «Acerca de ti», en el mismo orden', async ({
    page,
  }) => {
    await abrirElFormulario(page)
    for (const [i, logro] of TRES.entries()) await caja(page, i + 1).fill(logro)
    await guardar(page)

    // Sin recargar: el guardado refresca las dos vistas.
    await expect(enLaCabecera(page)).toBeVisible()
    expect(await loQueDice(enLaCabecera(page))).toEqual(numerados(TRES))
    expect(await loQueDice(enAcercaDe(page))).toEqual(numerados(TRES))
    expect((await pedirPerfil()).logros).toEqual(TRES)

    // Y al volver a editar, las cajas vienen con lo guardado.
    await abrirElFormulario(page)
    for (const [i, logro] of TRES.entries()) await expect(caja(page, i + 1)).toHaveValue(logro)
  })

  test('un PUT sin el campo logros —un cliente anterior— no los borra', async () => {
    const r = await fetch(`${API}/portal/perfil`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ titular: 'Desarrollador Backend', ubicacion: 'Lima' }),
    })
    expect(r.ok).toBe(true)

    const perfil = await pedirPerfil()
    expect(perfil.titular).toBe('Desarrollador Backend')
    expect(perfil.logros).toEqual(TRES)
  })

  test('con la caja del medio vacía quedan dos, renumerados como 1 y 2', async ({ page }) => {
    await abrirElFormulario(page)
    await caja(page, 2).fill('')
    await guardar(page)

    const quedan = [TRES[0]!, TRES[2]!]
    await expect(enLaCabecera(page).getByRole('listitem')).toHaveCount(2)
    expect(await loQueDice(enLaCabecera(page))).toEqual(numerados(quedan))
    expect(await loQueDice(enAcercaDe(page))).toEqual(numerados(quedan))
    expect((await pedirPerfil()).logros).toEqual(quedan)
  })

  test('una caja no admite más de 100 caracteres, y el contador lo dice', async ({ page }) => {
    await abrirElFormulario(page)
    const tercera = caja(page, 3)

    // Tecleado…
    await tercera.fill('')
    await tercera.pressSequentially('a'.repeat(105))
    await expect(tercera).toHaveValue('a'.repeat(100))
    await expect(page.getByText('100 de 100 caracteres')).toBeVisible()

    // …y pegado de golpe.
    await tercera.fill('')
    await tercera.focus()
    await page.keyboard.insertText('b'.repeat(140))
    await expect(tercera).toHaveValue('b'.repeat(100))
    await expect(page.getByText('100 de 100 caracteres')).toBeVisible()

    await guardar(page)
    expect((await pedirPerfil()).logros[2]).toBe('b'.repeat(100))
  })

  test('el backend rechaza por API más de tres o uno de más de 100, sin cambiar nada', async () => {
    const antes = (await pedirPerfil()).logros
    for (const logros of [['a', 'b', 'c', 'd'], ['x'.repeat(101)]]) {
      const r = await fetch(`${API}/portal/perfil`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ titular: 'Otro', logros }),
      })
      expect(r.status).toBe(400)
    }
    const despues = await pedirPerfil()
    expect(despues.logros).toEqual(antes)
    expect(despues.titular).toBe('Desarrollador Backend')
  })

  test('vaciar las tres los borra y el bloque desaparece de las dos vistas', async ({ page }) => {
    await abrirElFormulario(page)
    for (const n of [1, 2, 3]) await caja(page, n).fill('')
    await guardar(page)

    await expect(page.getByText('Logros clave', { exact: true })).toHaveCount(0)
    expect((await pedirPerfil()).logros).toEqual([])
    // El resto de la cabecera sigue ahí: vaciar los logros no vacía lo demás.
    expect((await pedirPerfil()).titular).toBe('Desarrollador Backend')
  })
})
