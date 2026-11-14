/**
 * «Pruebas» (specs/pruebas-indice-de-la-empresa): los dos recorridos que la spec pide
 * repetibles.
 *
 *   1. Entrar, cambiar de pestaña, filtrar por nivel y abrir «Ver»; al recargar, la
 *      pestaña, el filtro y la fila abierta siguen puestos (AC-01, AC-02, AC-06).
 *   2. «Usar en otra vacante» hasta terminar en el editor de la destino con el borrador
 *      copiado, sin tocar la de origen (AC-10).
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo: tres vacantes con la marca `QA-PE-0067` y un
 * código propio de la corrida, con sus preguntas y su prueba escritas por la API. Las
 * retira `retirarLoSembrado` de `ayuda-prueba-propia` (las marca eliminadas).
 */

import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel, tokenDelPanel } from './ayuda'
import { escribirBorrador, exigir, publicarPreguntas, RUTA as RUTA_PREGUNTAS } from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, publicarPrueba, retirarLoSembrado } from './ayuda-prueba-propia'

test.describe.configure({ mode: 'serial' })

/** Lo que distingue lo sembrado en esta corrida de cualquier otra cosa del clon. */
const CODIGO = `Indice ${Math.random().toString(36).slice(2, 7)}`

let token = ''
let conPreguntas = 0
let conPrueba = 0
let destino = 0

const menu = (page: Page) => page.getByRole('navigation', { name: 'Menú del panel' })
const linea = (page: Page) => page.getByRole('searchbox', { name: 'Buscar vacante o filtrar' })
const ver = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^Ver .*${CODIGO} ${nombre}`) })
const lectura = (page: Page) => page.locator('#lectura')

test.beforeAll(async () => {
  token = await tokenDelPanel()
  const lugar = await lugarDe(token, 'EJECUCION')

  conPreguntas = await crearVacante(token, `${CODIGO} Contador`, lugar)
  await escribirBorrador(token, conPreguntas, [
    {
      nombre: 'Rigor con los números',
      preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo cuadras una caja con un faltante?', puntos: 100, queDebeTener: 'El monto' }],
    },
  ])
  await publicarPreguntas(token, conPreguntas)

  conPrueba = await crearVacante(token, `${CODIGO} Diseñador`, lugar)
  await escribirPrueba(token, conPrueba, {
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90 },
    criterios: [{ nombre: 'Calidad de las piezas', puntos: 100, calificador: 'IA', preguntas: [] }],
    entregables: [{ nombre: 'Logotipo adaptado', formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true }],
  })
  const publicada = await publicarPrueba(token, conPrueba)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba falló: ${publicada.estado}`)

  destino = await crearVacante(token, `${CODIGO} Destino`, lugar)
})

test.afterAll(() => {
  retirarLoSembrado([])
})

test('entrar, cambiar de pestaña, filtrar por nivel y abrir «Ver»', async ({ page }, info) => {
  await entrarAlPanel(page)
  if (info.project.name === 'escritorio') {
    await page.goto('/admin')
    await menu(page).getByRole('link', { name: 'Pruebas', exact: true }).click()
  } else {
    // En el teléfono el menú vive en el cajón: se entra por la dirección.
    await page.goto('/admin/pruebas')
  }
  await expect(page).toHaveURL(/\/admin\/pruebas/)
  await expect(page.getByRole('heading', { level: 1, name: 'Pruebas.' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Preguntas del Perfil Integral/ })).toHaveAttribute('aria-selected', 'true')

  await linea(page).fill(CODIGO)
  await expect(ver(page, 'Contador')).toBeVisible()
  await expect(ver(page, 'Diseñador')).toHaveCount(0)

  await page.getByRole('tab', { name: /Prueba del puesto/ }).click()
  await expect(page).toHaveURL(/tipo=prueba/)
  await expect(ver(page, 'Diseñador')).toBeVisible()
  const filaDelDisenador = page.locator('tr', { has: ver(page, 'Diseñador') })
  await expect(filaDelDisenador).toContainText('1 criterio · 0 preguntas · 1 entregable · 90 min')
  await expect(filaDelDisenador).toContainText('Publicada')

  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: 'Ejecución', exact: true }).click()
  await page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: 'Listo' }).click()
  await expect(page).toHaveURL(/nivel=EJECUCION/)
  await expect(page.getByRole('button', { name: 'Quitar Nivel: Ejecución' })).toBeVisible()
  await expect(ver(page, 'Diseñador')).toBeVisible()

  await ver(page, 'Diseñador').click()
  await expect(page).toHaveURL(new RegExp(`vacante=${conPrueba}`))
  await expect(lectura(page).getByRole('heading', { name: new RegExp(`${CODIGO} Diseñador`) })).toBeVisible()
  await expect(lectura(page).getByText('Calidad de las piezas')).toBeVisible()
  await expect(lectura(page).getByRole('link', { name: 'Abrir en la vacante' })).toHaveAttribute(
    'href',
    `/admin/vacantes/${conPrueba}/prueba`,
  )

  // La pestaña, el filtro, lo buscado y la fila abierta viven en la dirección.
  await page.reload()
  await expect(page.getByRole('tab', { name: /Prueba del puesto/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Quitar Nivel: Ejecución' })).toBeVisible()
  await expect(linea(page)).toHaveValue(CODIGO)
  await expect(lectura(page).getByText('Calidad de las piezas')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/vacante=/)
})

test('«Usar en otra vacante» termina en el editor de la destino con el borrador copiado', async ({ page }) => {
  const antes = await exigir<any>(RUTA_PREGUNTAS(conPreguntas), token)
  await entrarAlPanel(page)
  await page.goto(`/admin/pruebas?buscar=${encodeURIComponent(CODIGO)}`)

  await page.getByRole('button', { name: new RegExp(`^Usar «.*${CODIGO} Contador.*» en otra vacante`) }).click()
  const grupo = page.getByRole('radiogroup', { name: 'Vacante destino' })
  await expect(grupo).toBeVisible()
  await page.getByRole('searchbox', { name: 'Vacante destino' }).fill(CODIGO)
  // La de origen no se ofrece
  await expect(grupo.getByRole('radio', { name: new RegExp(`${CODIGO} Contador`) })).toHaveCount(0)
  await grupo.getByRole('radio', { name: new RegExp(`${CODIGO} Destino`) }).check()
  await page.getByRole('button', { name: 'Copiar y abrir' }).click()

  await expect(page).toHaveURL(new RegExp(`/admin/vacantes/${destino}/preguntas$`))
  const copiado = await exigir<any>(RUTA_PREGUNTAS(destino), token)
  expect(copiado.borrador.total).toBe(100)
  expect(copiado.borrador.criterios[0].preguntas[0].enunciado).toBe('¿Cómo cuadras una caja con un faltante?')
  // La original no cambia
  const despues = await exigir<any>(RUTA_PREGUNTAS(conPreguntas), token)
  expect(despues.publicada.id).toBe(antes.publicada.id)
  expect(despues.borrador).toBeNull()
})
