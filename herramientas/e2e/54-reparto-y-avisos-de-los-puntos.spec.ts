import { expect, type Locator, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import {
  escribirBorrador,
  exigir,
  irConLaPastilla,
  pedir,
  publicarPreguntas,
  RUTA as RUTA_DEL_BANCO,
  tokenDePanel,
} from './ayuda-preguntas-propias'
import {
  crearVacante,
  escribirPrueba,
  lugarDe,
  preguntaDe,
  publicarPrueba,
  retirarLoSembrado,
  type PruebaNueva,
} from './ayuda-prueba-propia'

/**
 * «Los puntos del criterio y de las preguntas, explicados donde se escriben»: los recorridos de
 * la verificación de la spec `reparto-y-avisos-de-los-puntos`, en los dos editores.
 *
 *   1. El lápiz del criterio dice el reparto: con la IA, con una persona, «Todo lo puntúa el
 *      sistema» y sin preguntas (AC-01, AC-02).
 *   2. Una pregunta de 5 con una opción de 10, en la prueba y en el banco: el aviso en vivo, se
 *      guarda, la tarjeta y el criterio plegado en ámbar, «⚠ N por arreglar →» lleva a la
 *      tarjeta, y se corrige (AC-05, AC-06).
 *   3. Una opción múltiple que no llega a sus puntos (AC-07).
 *   4. Un criterio de 20 con una cerrada de 5: el aviso nuevo y la navegación; sin cerradas, el
 *      otro texto (AC-08, AC-09).
 *   5. «Cambiar los puntos» de la prueba (el reparto) y del banco (25.5 por API: sin suma; 150: la
 *      suma de lo escrito; el formulario no envía ninguno) (AC-03, AC-10).
 *   6. El ancho a 1920 px: en la prueba publicada los puntos de la línea acaban en el borde
 *      derecho y en un borrador con botones no; los textos desplegados pasan de 72ch (AC-12, AC-13).
 *
 * La IA va apagada: nada se califica. ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira
 * (marca QA-PE-0067).
 */

const correos: string[] = []
let equipo = ''

const ABIERTA = 'Arma un flujo de caja mensual para una tienda pequeña.'
const CERRADA = '¿Qué haces si falta dinero en el arqueo?'
const MULTIPLE = '¿Qué fórmulas buscan un valor en una tabla?'
/** Una opción única de `puntos` cuya primera opción vale `primera`. */
const unica = (enunciado: string, puntos: number, primera = puntos) => ({
  tipo: 'OPCION_UNICA' as const,
  enunciado,
  puntos,
  opciones: [{ texto: 'Lo reporto', puntos: primera }, { texto: 'Lo repongo', puntos: 0 }],
})

const criterio = (page: Page, nombre: string) => page.getByRole('region', { name: `Criterio ${nombre}` })
const plegador = (page: Page, nombre: string) => criterio(page, nombre).getByRole('button', { name: nombre, exact: true })
const tarjeta = (page: Page, enunciado: string) => page.getByRole('article', { name: `Pregunta: ${enunciado}` })
const faltasDe = (t: Locator) => t.getByRole('list', { name: 'Lo que le falta para publicar' })
const plegarTodo = (page: Page) => page.getByRole('button', { name: 'Plegar todo', exact: true }).click()

const PASA = 'Ninguna opción puede pasar de los 5 puntos de la pregunta.'
const NINGUNA_LA_DA = 'Alguna opción tiene que dar los 5 puntos de la pregunta.'

async function vacanteConPrueba(nombre: string, prueba: PruebaNueva, publicar = false): Promise<number> {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await escribirPrueba(equipo, id, prueba)
  if (publicar) {
    const r = await publicarPrueba(equipo, id)
    expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
    await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
  }
  return id
}

/** Un banco de preguntas propias en borrador (y publicado, si se pide). */
async function vacanteConBanco(nombre: string, criterios: Parameters<typeof escribirBorrador>[2], publicar = false) {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
  await escribirBorrador(equipo, id, criterios, 'Premia lo que se reporta a tiempo.')
  if (publicar) await publicarPreguntas(equipo, id)
  return id
}

/**
 * Una pregunta de 5 con una opción de 10 en el editor abierto: su tarjeta en ámbar con sus
 * faltas, su criterio plegado en ámbar, la pastilla de la cabecera lleva a la tarjeta, y
 * corregida en su formulario —con el aviso en vivo yéndose— deja de estar en ámbar.
 */
async function laTarjetaConFalta(page: Page, cabecera: Locator, nombreDelCriterio: string) {
  const laCerrada = tarjeta(page, CERRADA)
  await expect(faltasDe(laCerrada)).toContainText(PASA, { timeout: 20_000 })
  await expect(faltasDe(laCerrada)).toContainText(NINGUNA_LA_DA)
  await expect(faltasDe(laCerrada)).not.toContainText('La pregunta 1')
  await expect(laCerrada).toHaveCSS('box-shadow', /inset/)

  await plegarTodo(page)
  await expect(criterio(page, nombreDelCriterio).locator('header').first()).toContainText('ninguna opción puede pasar de los 5 puntos')
  await expect(cabecera.getByRole('button', { name: /^\d+ por arreglar$/ })).toBeVisible()
  await irConLaPastilla(page, laCerrada)
  await expect(plegador(page, nombreDelCriterio)).toHaveAttribute('aria-expanded', 'true')

  await laCerrada.getByRole('button', { name: 'Editar la pregunta' }).click()
  const form = page.getByRole('form', { name: 'Corregir la pregunta' })
  await expect(form.getByRole('status')).toContainText(PASA)
  const opcion = form.getByRole('spinbutton', { name: 'Puntos de la opción 1' })
  await opcion.fill('5')
  await expect(form.getByRole('status')).toHaveCount(0)
  await expect(opcion).toBeFocused()
  await form.getByRole('button', { name: 'Guardar la pregunta' }).click()
  await expect(form).toHaveCount(0, { timeout: 20_000 })
  await expect(faltasDe(laCerrada)).toHaveCount(0)
  await expect(laCerrada).toHaveCSS('box-shadow', 'none')
}

test.describe('Los puntos explicados donde se escriben', () => {
  test.beforeAll(async () => {
    equipo = await tokenDePanel()
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('el lápiz del criterio dice el reparto: con la IA, con una persona, todo del sistema y sin preguntas (AC-01, AC-02)', async ({ page }) => {
    const v = await vacanteConPrueba('Reparto en el lápiz', {
      criterios: [{ nombre: 'Análisis', puntos: 40, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }, unica(CERRADA, 20)] }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    })
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await page.getByRole('button', { name: 'Editar el criterio Análisis' }).click({ timeout: 20_000 })
    const form = page.getByRole('form', { name: 'Editar el criterio Análisis' })
    await expect(form).toContainText('Cerradas: 20 pts · Abiertas y archivos: 20 pts, los califica')
    const quien = form.getByRole('combobox', { name: 'Quién califica los 20 puntos de abiertas y archivos' })
    await expect(quien).toHaveValue('IA')
    await quien.selectOption('PERSONA')
    await expect(quien).toHaveValue('PERSONA')
    await expect(form).toContainText(
      'Si luego cambian sus cerradas, el criterio sigue valiendo lo mismo: lo que se ajusta son los puntos de abiertas y archivos.',
    )
    await form.getByRole('spinbutton', { name: 'Puntos del criterio' }).fill('20')
    await expect(form).toContainText('Cerradas: 20 pts · Todo lo puntúa el sistema')
    await expect(form.getByRole('combobox')).toHaveCount(0)
    await form.getByRole('button', { name: 'Cancelar' }).click()

    // Un criterio nuevo, sin preguntas: todo lo que valga es de abiertas y archivos, y propone la IA.
    await page.getByRole('button', { name: 'Agregar criterio' }).click()
    const nuevo = page.getByRole('form', { name: 'Criterio nuevo' })
    await nuevo.getByRole('textbox', { name: 'Nombre del criterio' }).fill('Excel')
    await nuevo.getByRole('spinbutton', { name: 'Puntos del criterio' }).fill('20')
    await expect(nuevo).toContainText('Cerradas: 0 pts · Abiertas y archivos: 20 pts, los califica')
    await expect(nuevo.getByRole('combobox', { name: 'Quién califica los 20 puntos de abiertas y archivos' })).toHaveValue('IA')
  })

  test('en la prueba, una pregunta de 5 con una opción de 10: aviso en vivo, se guarda, ámbar, la falta lleva a la tarjeta y se corrige (AC-05, AC-06)', async ({ page }) => {
    const v = await vacanteConPrueba('Opción que pasa de su pregunta', {
      criterios: [{ nombre: 'Caja', puntos: 40, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }, unica(CERRADA, 10)] }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    })
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const cabecera = page.getByRole('region', { name: 'Balance de la prueba' })
    await plegador(page, 'Caja').click({ timeout: 20_000 })
    await expect(faltasDe(tarjeta(page, CERRADA))).toHaveCount(0)

    // Se escribe 5 en la pregunta: el aviso sale en vivo, sin quitarle el foco, y se guarda igual.
    await tarjeta(page, CERRADA).getByRole('button', { name: 'Editar la pregunta' }).click()
    const form = page.getByRole('form', { name: 'Corregir la pregunta' })
    const puntos = form.getByRole('spinbutton', { name: 'Puntos', exact: true })
    await puntos.fill('5')
    await expect(form.getByRole('status')).toContainText(PASA)
    await expect(form.getByRole('status')).toContainText(NINGUNA_LA_DA)
    await expect(puntos).toBeFocused()
    await form.getByRole('button', { name: 'Guardar la pregunta' }).click()
    await expect(form).toHaveCount(0, { timeout: 20_000 })
    // Sin la lista en la cabecera: la cuenta en la pastilla —el total de 40 y las dos de la
    // pregunta— y cada falta en su sitio.
    await expect(cabecera.getByRole('button', { name: '3 por arreglar' })).toBeVisible()

    await laTarjetaConFalta(page, cabecera, 'Caja')
  })

  test('en el banco, la misma pregunta: tarjeta y criterio plegado en ámbar, la falta lleva a la tarjeta y se corrige (AC-05, AC-06)', async ({ page }) => {
    const v = await vacanteConBanco('Banco: opción que pasa de su pregunta', [
      { nombre: 'Caja', preguntas: [unica(CERRADA, 5, 10), { tipo: 'ABIERTA', enunciado: ABIERTA, puntos: 95 }] },
    ])
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/preguntas`)
    await laTarjetaConFalta(page, page.getByRole('region', { name: 'Balance de las preguntas' }), 'Caja')
  })

  test('una opción múltiple de 10 cuyas buenas suman 6: lo dicen la tarjeta y el formulario (AC-07)', async ({ page }) => {
    const v = await vacanteConPrueba('Múltiple que no llega', {
      criterios: [{
        nombre: 'Excel', puntos: 30, calificador: 'IA',
        preguntas: [
          { tipo: 'ABIERTA', enunciado: ABIERTA },
          { tipo: 'OPCION_MULTIPLE', enunciado: MULTIPLE, puntos: 10, opciones: [{ texto: 'BUSCARV', puntos: 6 }, { texto: 'SUMA', puntos: 0 }] },
        ],
      }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    })
    const texto = 'Marcando todas las opciones buenas no se llega a sus 10 puntos.'
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const laMultiple = tarjeta(page, MULTIPLE)
    await expect(faltasDe(laMultiple)).toHaveText(texto, { timeout: 20_000 })
    await laMultiple.getByRole('button', { name: 'Editar la pregunta' }).click()
    await expect(page.getByRole('form', { name: 'Corregir la pregunta' }).getByRole('status')).toHaveText(texto)
  })

  test('un criterio de 20 con una cerrada de 5 y nada más: el aviso nuevo lleva a su criterio; sin cerradas, el otro texto (AC-08, AC-09)', async ({ page }) => {
    const CON_CERRADA =
      'El criterio «Excel» vale 20 y sus cerradas suman 5: nadie puede calificar los otros 15. Baja el total a 5, sube sus cerradas o agrégale una abierta o un archivo.'
    const SIN_CERRADAS =
      'El criterio «Word» vale 20 y no tiene nada que calificar: agrégale una abierta, un archivo o cerradas que sumen 20.'
    const v = await vacanteConPrueba('Nada que calificar', {
      criterios: [
        { nombre: 'Excel', puntos: 20, calificador: 'IA', preguntas: [unica(CERRADA, 5)] },
        { nombre: 'Word', puntos: 20, calificador: 'IA', preguntas: [] },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    })
    const r = await publicarPrueba(equipo, v)
    expect(r.estado).toBe(400)
    expect(r.cuerpo.faltas).toEqual(expect.arrayContaining([CON_CERRADA, SIN_CERRADAS]))

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    // Desplegados por su falta, cada criterio la escribe bajo su línea; plegados, al lado.
    const suFalta = (nombre: string) => criterio(page, nombre).getByRole('list', { name: 'Lo que le falta al criterio' })
    await expect(suFalta('Excel')).toHaveText(CON_CERRADA, { timeout: 20_000 })
    await expect(suFalta('Word')).toHaveText(SIN_CERRADAS)
    await plegarTodo(page)
    await expect(criterio(page, 'Word').locator('header').first()).toContainText(SIN_CERRADAS)
    await irConLaPastilla(page, criterio(page, 'Excel'))
    await expect(plegador(page, 'Excel')).toHaveAttribute('aria-expanded', 'true')
    await expect(plegador(page, 'Word')).toHaveAttribute('aria-expanded', 'false')
  })

  test('«Cambiar los puntos» del banco: 25.5 no da suma, 150 da la de lo escrito, y el formulario no envía ninguno (AC-10)', async ({ page }) => {
    const enunciados = ['Cuenta un arqueo con faltante.', 'Cuenta un cierre tardío.', 'Cuenta un reclamo.', 'Cuenta un turno difícil.']
    const v = await vacanteConBanco('Banco: cambiar los puntos con decimales', [
      { nombre: 'Caja', preguntas: enunciados.map((enunciado) => ({ tipo: 'ABIERTA' as const, enunciado, puntos: 25 })) },
    ], true)
    const primera = preguntaDe((await pedir(RUTA_DEL_BANCO(v), equipo)).cuerpo.publicada, enunciados[0]!)
    const cambiar = (puntos: number) =>
      pedir(`${RUTA_DEL_BANCO(v)}/publicada/puntos`, equipo, 'PUT', { preguntas: [{ id: primera, puntos }] })

    const conDecimales = await cambiar(25.5)
    expect(conDecimales.estado).toBe(400)
    const suyas: string[] = conDecimales.cuerpo.faltas
    expect(suyas).toEqual([`La pregunta 1 («${enunciados[0]}»): los puntos tienen que ser enteros, sin decimales.`])
    const demasiados = await cambiar(150)
    expect(demasiados.estado).toBe(400)
    expect(demasiados.cuerpo.faltas[0]).toBe('Los puntos suman 225 de 100: sobran 125.')

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/preguntas`)
    await page.getByRole('button', { name: 'Cambiar los puntos' }).click({ timeout: 20_000 })
    const form = page.getByRole('form', { name: 'Cambiar los puntos' })
    let envios = 0
    page.on('request', (r) => {
      if (r.url().includes(`${RUTA_DEL_BANCO(v)}/publicada/puntos`) && r.method() !== 'GET') envios++
    })
    const campo = form.getByRole('spinbutton', { name: `Puntos de «${enunciados[0]}»` })
    for (const malo of ['25.5', '150']) {
      await campo.fill(malo)
      await form.getByRole('button', { name: 'Guardar los puntos' }).click()
      await expect(campo, `con «${malo}»`).toBeFocused()
    }
    await page.waitForTimeout(400)
    expect(envios).toBe(0)
    // Nada cambió.
    const publicada = (await pedir(RUTA_DEL_BANCO(v), equipo)).cuerpo.publicada
    expect((publicada.criterios[0].preguntas as any[]).map((p) => p.puntos)).toEqual([25, 25, 25, 25])
  })

  test('a 1920 px: la prueba publicada lleva los puntos al borde derecho y lee a unos 100 caracteres; «Cambiar los puntos» dice el reparto (AC-03, AC-12, AC-13)', async ({ page }) => {
    const LARGO =
      'Una tienda de barrio vende al contado y al crédito, compra a tres proveedores con plazos distintos y paga el alquiler el día cinco. ' +
      'Arma el flujo de caja de abril con ingresos, egresos y saldo de cada semana, y marca la semana en la que el saldo se queda en rojo.'
    const QUE_EVALUA =
      'Que el flujo cuadre semana a semana, que los cobros al crédito entren cuando de verdad se cobran y no cuando se vende, y que el saldo en rojo se vea a tiempo para negociar con los proveedores.'
    const publicada = await vacanteConPrueba('Ancho de la prueba publicada', {
      criterios: [{
        nombre: 'Contable', queEvalua: QUE_EVALUA, puntos: 100, calificador: 'IA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: LARGO }, unica(CERRADA, 60)],
      }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    }, true)
    const borrador = await vacanteConPrueba('Ancho del borrador', {
      criterios: [{ nombre: 'Contable', puntos: 40, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }] }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    })

    await page.setViewportSize({ width: 1920, height: 1080 })
    await entrarAlPanel(page)
    /** Cuánto le queda a la línea a la derecha de «· N preguntas». */
    const huecoALaDerecha = async () => {
      const linea = criterio(page, 'Contable').locator('header').first()
      const cuenta = linea.getByText(/^· \d+ preguntas?/).first()
      await expect(cuenta).toBeVisible({ timeout: 20_000 })
      const l = (await linea.boundingBox())!
      const c = (await cuenta.boundingBox())!
      return l.x + l.width - (c.x + c.width)
    }

    // En la publicada no hay botones: los puntos y la cuenta acaban en el borde derecho.
    await page.goto(`/admin/vacantes/${publicada}/prueba`)
    expect(await huecoALaDerecha()).toBeLessThan(4)

    // Desplegado, el enunciado y «Qué evalúa» llegan a unos 100 caracteres por línea, no a 72.
    await plegador(page, 'Contable').click()
    const enCaracteres = (texto: Locator) =>
      texto.evaluate((p) => {
        const regla = document.createElement('span')
        regla.style.cssText = 'position:absolute;visibility:hidden;inline-size:1ch'
        p.appendChild(regla)
        const ch = regla.getBoundingClientRect().width
        regla.remove()
        const tarjeta = p.parentElement!.getBoundingClientRect().width
        const ancho = p.getBoundingClientRect().width
        return { caracteres: ancho / ch, cabe: ancho <= tarjeta + 0.5 }
      })
    for (const texto of [page.getByText(LARGO, { exact: true }), page.getByText(QUE_EVALUA)]) {
      const { caracteres, cabe } = await enCaracteres(texto)
      expect(caracteres).toBeGreaterThan(90)
      expect(caracteres).toBeLessThan(101)
      expect(cabe).toBe(true)
    }
    // En 1280 px no pasa del ancho de su tarjeta.
    await page.setViewportSize({ width: 1280, height: 800 })
    expect((await enCaracteres(page.getByText(LARGO, { exact: true }))).cabe).toBe(true)
    await page.setViewportSize({ width: 1920, height: 1080 })

    // «Cambiar los puntos» dice el reparto, como el lápiz pero sin selector.
    await page.getByRole('button', { name: 'Cambiar los puntos' }).click()
    await expect(page.getByRole('form', { name: 'Cambiar los puntos' })).toContainText(
      'Cerradas: 60 pts · Abiertas y archivos: 40 pts, los califica la IA',
    )

    // En un borrador con botones, los puntos siguen tras el nombre y los botones a la derecha.
    await page.goto(`/admin/vacantes/${borrador}/prueba`)
    expect(await huecoALaDerecha()).toBeGreaterThan(200)
    await expect(criterio(page, 'Contable').getByRole('button', { name: 'Editar el criterio Contable' })).toBeVisible()
  })
})
