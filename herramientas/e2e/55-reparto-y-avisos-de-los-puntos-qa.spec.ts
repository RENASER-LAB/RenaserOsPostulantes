import { expect, type Locator, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import {
  entrarAlPanelCon,
  escribirBorrador,
  exigir,
  irConLaPastilla,
  publicarPreguntas,
  tokenDePanel,
} from './ayuda-preguntas-propias'
import {
  criterioDe,
  crearVacante,
  escribirPrueba,
  lugarDe,
  RUTA as RUTA_DE_LA_PRUEBA,
  retirarLoSembrado,
  sembrarEquipoSin,
  type PruebaNueva,
} from './ayuda-prueba-propia'

/**
 * QA de «Los puntos del criterio y de las preguntas, explicados donde se escriben»: lo que la
 * exploración con navegador recorrió y la suite 54 no fija.
 *
 *   - Sin `editar_vacante`: el borrador se lee con la tarjeta en ámbar y sus faltas, sin
 *     formularios ni «Publicar», la pastilla lleva igual a la falta, y la línea de cada criterio
 *     acaba en el borde derecho (AC-12, casos límite).
 *   - El criterio desplegado no repite el reparto: lo dice su línea, con la IA, con una persona
 *     y cuando todo lo puntúa el sistema (AC-04).
 *   - El banco publicado a 1920 px lleva los puntos al borde derecho; su borrador con botones no
 *     (AC-12).
 *   - En el banco, el aviso en vivo de una opción múltiple que no llega, se guarda con él y la
 *     tarjeta queda en ámbar; corregida, deja de estarlo (AC-06, AC-07).
 *   - Una pregunta sin criterio dice «No está en ningún criterio.» con sus faltas de puntos, y la
 *     pastilla lleva a ella (casos límite).
 *   - La falta nueva de un criterio «Excel» no se confunde con la de un archivo «Excel»: cada una
 *     se escribe y lleva a su sitio (riesgo de la verificación).
 *
 * La IA va apagada: nada se califica. ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira
 * (marca QA-PE-0067).
 */

const correos: string[] = []
let equipo = ''

const ABIERTA = 'Arma un flujo de caja mensual para una tienda pequeña.'
const CERRADA = '¿Qué haces si falta dinero en el arqueo?'
const MULTIPLE = '¿Qué fórmulas buscan un valor en una tabla?'
const unica = (enunciado: string, puntos: number, primera = puntos) => ({
  tipo: 'OPCION_UNICA' as const,
  enunciado,
  puntos,
  opciones: [{ texto: 'Lo reporto', puntos: primera }, { texto: 'Lo repongo', puntos: 0 }],
})
const CRONOMETRADA = { modalidad: 'CRONOMETRADA' as const, duracionMinutos: 60 }

const criterio = (page: Page, nombre: string) => page.getByRole('region', { name: `Criterio ${nombre}` })
const tarjeta = (page: Page, enunciado: string) => page.getByRole('article', { name: `Pregunta: ${enunciado}` })
const faltasDe = (t: Locator) => t.getByRole('list', { name: 'Lo que le falta para publicar' })

/** Cuánto le queda a la línea de un criterio a la derecha de su resumen (puntos, cuenta y punto ámbar). */
const huecoALaDerecha = (linea: Locator) =>
  linea.evaluate((h) => {
    const resumen = h.querySelector('[class*="resumenCriterio"]')
    if (!resumen) throw new Error('La línea no tiene resumen')
    return h.getBoundingClientRect().right - resumen.getBoundingClientRect().right
  })

const sinScrollHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

async function vacanteConPrueba(nombre: string, prueba: PruebaNueva): Promise<number> {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await escribirPrueba(equipo, id, prueba)
  return id
}

async function vacanteConBanco(nombre: string, criterios: Parameters<typeof escribirBorrador>[2], publicar = false) {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
  await escribirBorrador(equipo, id, criterios, 'Premia lo que se reporta a tiempo.')
  if (publicar) await publicarPreguntas(equipo, id)
  return id
}

test.describe('QA de los puntos explicados donde se escriben', () => {
  test.beforeAll(async () => {
    equipo = await tokenDePanel()
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('sin editar_vacante: el borrador se lee con la tarjeta en ámbar y sus faltas, sin formularios, y los puntos al borde derecho (AC-04, AC-12)', async ({ page }) => {
    const v = await vacanteConPrueba('Lectura de un borrador con faltas', {
      criterios: [
        { nombre: 'Caja', puntos: 40, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }, unica(CERRADA, 5, 10)] },
        { nombre: 'Atención', puntos: 30, calificador: 'PERSONA', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Cuenta un reclamo difícil.' }, unica('¿Qué haces primero?', 10)] },
        { nombre: 'Normas', puntos: 10, calificador: 'IA', preguntas: [unica('¿Cuál es el plazo de la factura?', 10)] },
      ],
      datos: CRONOMETRADA,
    })
    const lector = await tokenDePanel(sembrarEquipoSin('reparto-lector', ['editar_vacante']))
    expect((await exigir(RUTA_DE_LA_PRUEBA(v), lector)).puedeEditar).toBe(false)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await entrarAlPanelCon(page, lector)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await expect(page.getByText('La ves en lectura: cambiarla pide el permiso de editar esta vacante.').first()).toBeVisible({ timeout: 20_000 })

    // Sin botones en la línea: los puntos, la cuenta y el punto ámbar acaban en el borde derecho.
    for (const nombre of ['Caja', 'Atención', 'Normas']) {
      const linea = criterio(page, nombre).locator('header').first()
      await expect(linea.getByRole('button', { name: `Editar el criterio ${nombre}` })).toHaveCount(0)
      expect(await huecoALaDerecha(linea), nombre).toBeLessThan(4)
    }

    await page.getByRole('button', { name: 'Desplegar todo', exact: true }).click()
    // La tarjeta en ámbar con sus faltas, sin formulario con que corregirla.
    const laCerrada = tarjeta(page, CERRADA)
    await expect(faltasDe(laCerrada).locator('li')).toHaveText([
      'Ninguna opción puede pasar de los 5 puntos de la pregunta.',
      'Alguna opción tiene que dar los 5 puntos de la pregunta.',
    ])
    await expect(laCerrada).toHaveCSS('box-shadow', /inset/)
    await expect(page.getByRole('button', { name: 'Editar la pregunta' })).toHaveCount(0)
    await expect(page.getByRole('form', { name: 'Corregir la pregunta' })).toHaveCount(0)
    await expect(faltasDe(tarjeta(page, '¿Qué haces primero?'))).toHaveCount(0)

    // AC-04: desplegado, el criterio no repite el reparto: lo dice su línea, con la IA, con una
    // persona y todo del sistema.
    await expect(criterio(page, 'Caja').locator('header').first()).toContainText('40 pts (sistema 5 + IA 35)')
    await expect(criterio(page, 'Atención').locator('header').first()).toContainText('30 pts (sistema 10 + persona 20)')
    await expect(criterio(page, 'Normas').locator('header').first()).toContainText('10 pts (sistema 10)')
    await expect(page.locator('main')).not.toContainText('Abiertas y archivos')
    await expect(page.locator('main')).not.toContainText('Parte calificada:')
    expect(await sinScrollHorizontal(page)).toBe(true)

    // Sin «Publicar», la pastilla lleva igual a la falta.
    const cabecera = page.getByRole('region', { name: 'Balance de la prueba' })
    await expect(cabecera.getByRole('button', { name: /^Publicar/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    await irConLaPastilla(page, laCerrada)
  })

  test('el banco publicado a 1920 px lleva los puntos al borde derecho; su borrador con botones no (AC-12)', async ({ page }) => {
    const criterios = [
      { nombre: 'Atención al cliente en mostrador', preguntas: [{ tipo: 'ABIERTA' as const, enunciado: 'Cuenta un reclamo difícil.', puntos: 50 }] },
      { nombre: 'Caja', preguntas: [{ tipo: 'ABIERTA' as const, enunciado: 'Cuenta un arqueo con faltante.', puntos: 50 }] },
    ]
    const publicado = await vacanteConBanco('Banco publicado a lo ancho', criterios, true)
    const borrador = await vacanteConBanco('Banco en borrador a lo ancho', criterios)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${publicado}/preguntas`)
    for (const nombre of ['Atención al cliente en mostrador', 'Caja']) {
      const linea = criterio(page, nombre).locator('header').first()
      await expect(linea).toContainText('50 pts', { timeout: 20_000 })
      expect(await huecoALaDerecha(linea), nombre).toBeLessThan(4)
    }
    expect(await sinScrollHorizontal(page)).toBe(true)

    await page.goto(`/admin/vacantes/${borrador}/preguntas`)
    const linea = criterio(page, 'Caja').locator('header').first()
    await expect(linea.getByRole('button', { name: 'Editar el criterio Caja' })).toBeVisible({ timeout: 20_000 })
    expect(await huecoALaDerecha(linea)).toBeGreaterThan(150)
  })

  test('en el banco, la múltiple que no llega avisa en vivo, se guarda y queda en ámbar; corregida, deja de estarlo (AC-06, AC-07)', async ({ page }) => {
    const NO_LLEGA = 'Marcando todas las opciones buenas no se llega a sus 10 puntos.'
    const v = await vacanteConBanco('Banco: múltiple que no llega', [
      {
        nombre: 'Excel',
        preguntas: [
          { tipo: 'OPCION_MULTIPLE', enunciado: MULTIPLE, puntos: 10, opciones: [{ texto: 'BUSCARV', puntos: 10 }, { texto: 'SUMA', puntos: 0 }] },
          { tipo: 'ABIERTA', enunciado: ABIERTA, puntos: 90 },
        ],
      },
    ])
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/preguntas`)
    const laMultiple = tarjeta(page, MULTIPLE)
    // Sin faltas al entrar, el criterio sale plegado.
    await page.getByRole('button', { name: 'Desplegar todo', exact: true }).click({ timeout: 20_000 })
    await expect(laMultiple).toBeVisible()
    await expect(faltasDe(laMultiple)).toHaveCount(0)

    await laMultiple.getByRole('button', { name: 'Editar la pregunta' }).click()
    const form = page.getByRole('form', { name: 'Corregir la pregunta' })
    const primera = form.getByRole('spinbutton', { name: 'Puntos de la opción 1' })
    await primera.fill('6')
    await expect(form.getByRole('status')).toHaveText(NO_LLEGA)
    await expect(primera).toBeFocused()
    await form.getByRole('button', { name: 'Guardar la pregunta' }).click()
    await expect(form).toHaveCount(0, { timeout: 20_000 })
    await expect(faltasDe(laMultiple)).toHaveText(NO_LLEGA)
    await expect(laMultiple).toHaveCSS('box-shadow', /inset/)
    const cabecera = page.getByRole('region', { name: 'Balance de las preguntas' })
    await expect(cabecera.getByRole('button', { name: '1 por arreglar' })).toBeVisible()

    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    await expect(criterio(page, 'Excel').locator('header').first()).toContainText('marcando todas las opciones buenas no se llega')

    await page.getByRole('button', { name: 'Desplegar todo', exact: true }).click()
    await laMultiple.getByRole('button', { name: 'Editar la pregunta' }).click()
    await form.getByRole('spinbutton', { name: 'Puntos de la opción 2' }).fill('4')
    await expect(form.getByRole('status')).toHaveCount(0)
    await form.getByRole('button', { name: 'Guardar la pregunta' }).click()
    await expect(form).toHaveCount(0, { timeout: 20_000 })
    await expect(faltasDe(laMultiple)).toHaveCount(0)
    await expect(laMultiple).toHaveCSS('box-shadow', 'none')
  })

  test('una pregunta sin criterio dice «No está en ningún criterio.» con sus faltas de puntos, y la cabecera lleva a ella (casos límite)', async ({ page }) => {
    const SUELTA = '¿Quién firma el arqueo de la tarde?'
    const v = await vacanteConPrueba('Pregunta sin criterio', {
      criterios: [
        { nombre: 'Caja', puntos: 100, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }] },
        { nombre: 'Temporal', puntos: 10, calificador: 'IA', preguntas: [unica(SUELTA, 5, 10)] },
      ],
      datos: CRONOMETRADA,
    })
    const temporal = criterioDe((await exigir(RUTA_DE_LA_PRUEBA(v), equipo)).borrador, 'Temporal').id
    const editor = await exigir(`${RUTA_DE_LA_PRUEBA(v)}/criterios/${temporal}`, equipo, 'DELETE')
    expect((editor.borrador.sinCriterio as any[]).map((p) => p.enunciado)).toEqual([SUELTA])

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const laSuelta = tarjeta(page, SUELTA)
    await expect(faltasDe(laSuelta).locator('li')).toHaveText(
      [
        'No está en ningún criterio.',
        'Ninguna opción puede pasar de los 5 puntos de la pregunta.',
        'Alguna opción tiene que dar los 5 puntos de la pregunta.',
      ],
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    await irConLaPastilla(page, laSuelta)
  })

  test('la falta nueva del criterio «Excel» no se confunde con la del archivo «Excel»: cada una lleva a su sitio (AC-08)', async ({ page }) => {
    const PLAZO = '¿Cuál es el plazo de la factura?'
    const DEL_CRITERIO =
      'El criterio «Excel» vale 20 y sus cerradas suman 5: nadie puede calificar los otros 15. Baja el total a 5, sube sus cerradas o agrégale una abierta o un archivo.'
    const v = await vacanteConPrueba('Criterio y archivo del mismo nombre', {
      criterios: [
        { nombre: 'Excel', puntos: 20, calificador: 'IA', preguntas: [unica(CERRADA, 5)] },
        { nombre: 'Normas', puntos: 10, calificador: 'IA', preguntas: [unica(PLAZO, 10)] },
      ],
      entregables: [{ nombre: 'Excel', formato: 'ARCHIVO', obligatorio: true, de: PLAZO }],
      datos: CRONOMETRADA,
    })
    const avisos: string[] = (await exigir(RUTA_DE_LA_PRUEBA(v), equipo)).borrador.avisos
    expect(avisos).toContain(DEL_CRITERIO)
    expect(avisos.some((a) => a.startsWith('«Excel»: nadie lo califica.'))).toBe(true)

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    // Cada una escrita en su sitio: la del criterio, bajo su línea; la del archivo, bajo el archivo de su pregunta.
    await expect(criterio(page, 'Excel').getByRole('list', { name: 'Lo que le falta al criterio' })).toHaveText(DEL_CRITERIO, {
      timeout: 20_000,
    })
    await expect(tarjeta(page, PLAZO).getByRole('list', { name: 'Lo que le falta al archivo' })).toContainText('«Excel»: nadie lo califica.')
    await expect(criterio(page, 'Excel')).not.toContainText('nadie lo califica')
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()

    // Y la pastilla lleva a cada una a su sitio: el criterio, desplegado, y luego la tarjeta del archivo.
    await irConLaPastilla(page, criterio(page, 'Excel'))
    await expect(criterio(page, 'Excel').getByRole('button', { name: 'Excel', exact: true })).toHaveAttribute('aria-expanded', 'true')
    await irConLaPastilla(page, tarjeta(page, PLAZO))
  })
})
