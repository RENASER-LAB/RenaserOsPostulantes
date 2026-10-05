import { expect, type Page } from '@playwright/test'
import { API, corte, entrarAlPanel } from './ayuda'
import { CLAVE_DE_CANDIDATO, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import {
  asegurarQueModera,
  correoDeCandidata,
  empresaDelEquipo,
  idsDeLaCuenta,
  retirarLoSembrado,
  sembrarContratacion,
  sembrarResena,
  sembrarVacante,
  tokenDelEquipo,
} from './ayuda-resenas'

/**
 * Las reseñas de empresas a quien contrataron (V63), de punta a punta.
 *
 * Los recorridos de la spec, en orden y sobre el mismo terreno:
 *
 *   1. La empresa publica una reseña desde la ficha —estrellas con el teclado—,
 *      la edita y sale «Editada»; la persona recibe el aviso y la ve en su perfil:
 *      cabecera, índice y sección.
 *   2. Con tres reseñas, «Ver todas»: filtrar por estrellas, cambiar el orden y
 *      quitar los filtros.
 *   3. La persona responde a una y reporta otra; la plataforma oculta la
 *      reportada y el promedio cambia en el perfil y en la tabla.
 *   4. La columna «Reseñas»: apagada, se enciende, se ordena y abre la ficha con
 *      el bloque de lectura.
 *   5. Los rechazos por la API: la de 10 días, la doble publicación, la fuera de
 *      plazo, otra cuenta del portal y la segunda respuesta.
 *
 * Lo que una sola empresa no puede sembrar aquí —la empresa B leyendo, y su
 * reporte de una respuesta ajena— lo cubre `FlujoResenasIT` en el backend.
 *
 * Las contrataciones se siembran insertando la transición a CONTRATADO con una
 * fecha pasada, relativa a hoy: sin fechas quemadas.
 */

const OPINION =
  'Muy responsable con los plazos y con el equipo de obra en todo momento, lo recomendaría.'
const RESPUESTA = 'Gracias por la oportunidad, aprendí mucho con todo el equipo de obra.'

test.describe.configure({ mode: 'serial' })

let correo = ''
let otraCuenta = ''
let persona = 0
let empresa = ''
let vacanteA = 0
let deHace31 = 0
let deHace10 = 0
let rolPrestado: number | null = null
/** Contratada hace 70 días, con una reseña de hace 31: ya fija. */
let deHace70 = 0

/** Un nombre de empresa dentro de una expresión regular, sin que un punto signifique nada. */
const literalmente = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function entrarComoCandidata(page: Page, cual = correo) {
  const token = await tokenDelCandidato(cual)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_portal_token', token],
  )
}

async function abrirLaFicha(page: Page, vacante: number) {
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  await corte(page, 'Toda la tanda').click()
  await page.getByRole('button', { name: 'Camila Reseñas', exact: true }).click()
}

test.beforeAll(async () => {
  retirarLoSembrado([], null)
  correo = correoDeCandidata()
  otraCuenta = correoDeCandidata()
  await crearCuentaDeCandidato({ nombre: 'Camila', apellidos: 'Reseñas', correo })
  await crearCuentaDeCandidato({ nombre: 'Bruno', apellidos: 'Ajeno', correo: otraCuenta })
  const ids = idsDeLaCuenta(correo)
  persona = ids.persona
  empresa = empresaDelEquipo()
  vacanteA = sembrarVacante('Desarrollador Backend')
  deHace31 = sembrarContratacion(vacanteA, ids.usuario, 31)
  deHace10 = sembrarContratacion(sembrarVacante('Analista de datos'), ids.usuario, 10)
  rolPrestado = asegurarQueModera()
})

test.afterAll(() => {
  retirarLoSembrado([correo, otraCuenta].filter(Boolean), rolPrestado)
})

test('1 · la empresa publica y edita; la persona recibe el aviso y la ve en su perfil', async ({
  page,
  browser,
}) => {
  await entrarAlPanel(page)

  // AC-02: a los 10 días, el bloque dice desde cuándo y no hay formulario.
  const token = await tokenDelEquipo()
  const noToca = await fetch(`${API}/panel/postulaciones/${deHace10}/resenas`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  expect(noToca.miResena.estado).toBe('AUN_NO_TOCA')

  // AC-01 y AC-32: a los 31 días, el formulario; las estrellas se eligen con flechas.
  await abrirLaFicha(page, vacanteA)
  const bloque = page.getByRole('region', { name: `La reseña de ${empresa}` })
  await expect(bloque).toBeVisible()
  await bloque.getByRole('radio', { name: '3 estrellas, Aceptable' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(bloque.getByRole('radio', { name: '4 estrellas, Buena' })).toBeChecked()
  await bloque.getByLabel('Opinión').fill(OPINION)
  await bloque.getByRole('button', { name: 'Publicar reseña' }).click()
  await expect(bloque.getByText(/Puedes cambiarla hasta el/)).toBeVisible()

  // AC-08: se edita y sale «Editada».
  await bloque.getByRole('button', { name: 'Editar', exact: true }).click()
  await bloque.getByLabel('Opinión').fill(`${OPINION} Mejoró mucho en su segundo mes.`)
  await bloque.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(bloque.getByText(/· Editada/)).toBeVisible()

  // AC-11: el aviso en la campana lleva a la sección de reseñas del perfil.
  const portal = await browser.newPage()
  await entrarComoCandidata(portal)
  await portal.goto('/procesos')
  await portal.getByRole('button', { name: /^Avisos/ }).click()
  await portal
    .getByRole('link', { name: new RegExp(`${literalmente(empresa)} te dejó una reseña`) })
    .first()
    .click()
  await expect(portal).toHaveURL(/\/perfil#resenas$/)
  await expect(portal.getByRole('heading', { name: 'Reseñas de empresas' })).toBeVisible()

  // AC-12: la cabecera, el índice y la sección.
  await expect(portal.getByRole('link', { name: /4 de 5 estrellas · 1 reseña/ })).toBeVisible()
  await expect(
    portal.getByRole('navigation', { name: 'Secciones de tu perfil' }).getByRole('link', { name: /Reseñas/ }),
  ).toContainText('1')
  await expect(portal.getByText('Contratado como')).toBeVisible()
  await portal.close()
})

test('2 · con tres reseñas, «Ver todas» filtra, ordena y quita los filtros', async ({ page }) => {
  const { usuario } = idsDeLaCuenta(correo)
  // Dos contrataciones más con su reseña ya publicada: una de hace 31 días —ya
  // fija— y una reciente de 2 estrellas.
  deHace70 = sembrarContratacion(sembrarVacante('Coordinador de obra'), usuario, 70)
  sembrarResena(deHace70, persona, 5, `${OPINION} Siempre puntual.`, 31)
  const reciente = sembrarContratacion(sembrarVacante('Asistente de almacén'), usuario, 45)
  sembrarResena(reciente, persona, 2, 'Le costó adaptarse a los turnos y a los cambios del equipo.', 2)

  await entrarComoCandidata(page)
  await page.goto('/perfil')
  const verTodas = page.getByRole('button', { name: 'Ver todas las reseñas (3)' })
  await verTodas.click()
  const ventana = page.getByRole('dialog', { name: 'Reseñas de empresas' })
  await expect(ventana.getByText('Se ven 3 de 3')).toBeVisible()
  // AC-17: una sola empresa, sin filtro «Empresa».
  await expect(ventana.getByLabel('Empresa')).toHaveCount(0)

  // El chip y no la barra del resumen: los dos dicen «5 estrellas (1)».
  await ventana.getByRole('button', { name: '5 estrellas (1)', exact: true }).click()
  await expect(ventana.getByText('Se ven 1 de 3')).toBeVisible()
  await ventana.getByRole('button', { name: 'Quitar filtros' }).first().click()
  await expect(ventana.getByText('Se ven 3 de 3')).toBeVisible()

  // AC-16: «Peor calificadas» pone la de 2 estrellas arriba.
  await ventana.getByLabel('Orden').selectOption('peores')
  await expect(ventana.getByRole('article').first()).toContainText('Le costó adaptarse')

  // AC-32: se cierra con Escape y el foco vuelve a «Ver todas».
  await page.keyboard.press('Escape')
  await expect(ventana).toHaveCount(0)
  await expect(verTodas).toBeFocused()
})

test('3 · responde a una, reporta otra, y la plataforma la oculta', async ({ page, browser }) => {
  await entrarComoCandidata(page)
  await page.goto('/perfil')
  const seccion = page.locator('#resenas')

  // AC-33: responder dentro de la misma ventana.
  await seccion.getByRole('article').first().getByRole('button', { name: 'Responder' }).click()
  const responder = page.getByRole('dialog', { name: `Responder a la reseña de ${empresa}` })
  await responder.getByLabel('Tu respuesta').fill(RESPUESTA)
  await page.getByRole('button', { name: 'Publicar respuesta' }).click()
  await expect(seccion.getByText('Tu respuesta', { exact: true }).first()).toBeVisible()

  // AC-18: reportar la de 2 estrellas, con «Otro motivo» y su comentario.
  const deDos = seccion.getByRole('article').filter({ hasText: 'Le costó adaptarse' })
  await deDos.getByRole('button', { name: 'Reportar' }).click()
  const reportar = page.getByRole('dialog', { name: `Reportar la reseña de ${empresa}` })
  await reportar.getByLabel('Otro motivo').check()
  await reportar.getByLabel(/Cuéntanos más/).fill('No es cierto, cumplí todos los turnos.')
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(deDos.getByText('Reportada · en revisión')).toBeVisible()
  await expect(page.getByRole('link', { name: /3 reseñas/ })).toBeVisible()

  // AC-20: la plataforma la oculta con una nota, confirmándolo en la ventana.
  const panel = await browser.newPage()
  await entrarAlPanel(panel)
  await panel.goto('/admin/configuracion')
  const moderacion = panel.getByRole('region', { name: 'Reseñas reportadas' })
  const tarjeta = moderacion.getByRole('article').filter({ hasText: 'Le costó adaptarse' })
  await tarjeta.getByLabel('Nota de la revisión').fill('Describe hechos que la persona niega.')
  await tarjeta.getByRole('button', { name: 'Ocultar', exact: true }).click()
  const confirmacion = panel.getByRole('dialog', { name: 'Ocultar la reseña' })
  await expect(confirmacion).toContainText('No se podrá deshacer.')
  await confirmacion.getByRole('button', { name: 'Ocultar la reseña' }).click()
  await expect(confirmacion).toHaveCount(0)
  await expect(tarjeta).toHaveCount(0)
  await panel.close()

  await page.reload()
  await expect(page.getByRole('link', { name: /2 reseñas/ })).toBeVisible()
  await expect(seccion.getByText('Le costó adaptarse')).toHaveCount(0)
})

test('4 · la columna «Reseñas»: apagada, se enciende, y la celda abre la ficha', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto(`/admin/vacantes/${vacanteA}`)
  await corte(page, 'Toda la tanda').click()
  const tabla = page.getByRole('table').first()
  await expect(tabla.getByRole('columnheader', { name: /Reseñas/ })).toHaveCount(0)

  await page.locator('summary', { hasText: 'Columnas' }).click()
  await page.getByRole('checkbox', { name: /Reseñas de empresas/ }).check()
  await expect(tabla.getByRole('columnheader', { name: /Reseñas/ })).toBeVisible()

  // AC-24: ordenar por ella no rompe la tabla; la celda abre la ficha.
  await tabla.getByRole('button', { name: 'Reseñas', exact: true }).click()
  const celda = tabla.getByRole('button', { name: /Reseñas de Camila Reseñas: .*\(2\)/ })
  await celda.click()
  await expect(page.getByRole('heading', { name: 'Reseñas de empresas' })).toBeVisible()
  await expect(page.getByText(/Respuesta de Camila Reseñas/).first()).toBeVisible()
})

test('5 · los rechazos por la API', async () => {
  const equipo = await tokenDelEquipo()
  const conEquipo = (ruta: string, metodo: string, cuerpo?: unknown) =>
    fetch(`${API}/panel${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${equipo}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })

  // AC-02: a los 10 días.
  expect(
    (await conEquipo(`/postulaciones/${deHace10}/resena`, 'POST', { estrellas: 5, texto: OPINION })).status,
  ).toBe(409)
  // AC-07: la doble publicación.
  expect(
    (await conEquipo(`/postulaciones/${deHace31}/resena`, 'POST', { estrellas: 5, texto: OPINION })).status,
  ).toBe(409)
  // AC-09: la de hace 31 días ya no se puede cambiar.
  expect(
    (await conEquipo(`/postulaciones/${deHace70}/resena`, 'PUT', { estrellas: 1, texto: OPINION })).status,
  ).toBe(409)
  // AC-06: 4,5 estrellas.
  expect(
    (await conEquipo(`/postulaciones/${deHace10}/resena`, 'POST', { estrellas: 4.5, texto: OPINION })).status,
  ).toBe(400)

  // AC-35: otra cuenta del portal no encuentra la reseña; un token del panel no abre el portal.
  const propia = await fetch(`${API}/portal/resenas`, {
    headers: { Authorization: `Bearer ${await tokenDelCandidato(correo, CLAVE_DE_CANDIDATO)}` },
  }).then((r) => r.json())
  const id = propia.resenas[0].id as number
  const ajena = await tokenDelCandidato(otraCuenta, CLAVE_DE_CANDIDATO)
  const respuestaAjena = await fetch(`${API}/portal/resenas/${id}/respuesta`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ajena}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: RESPUESTA }),
  })
  expect(respuestaAjena.status).toBe(404)
  const desdeElPanel = await fetch(`${API}/portal/resenas/${id}/respuesta`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${equipo}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: RESPUESTA }),
  })
  expect([401, 403]).toContain(desdeElPanel.status)

  // AC-34: la segunda respuesta a la misma reseña.
  const suya = await tokenDelCandidato(correo, CLAVE_DE_CANDIDATO)
  const conRespuesta = propia.resenas.find((r: { respuesta: unknown }) => r.respuesta !== null)
  const segunda = await fetch(`${API}/portal/resenas/${conRespuesta.id}/respuesta`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${suya}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: RESPUESTA }),
  })
  expect(segunda.status).toBe(409)
})
