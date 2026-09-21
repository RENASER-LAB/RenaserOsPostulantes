import { expect, type Page } from '@playwright/test'

import { limpiarSiempre } from './base-de-datos'
import { entrarAlPortal } from './ayuda'
import { CLAVE_DE_CANDIDATO, test } from './ayuda-candidato'
import {
  archivadaEn,
  avisosDe,
  estadoDe,
  estadoDeLaPostulacion,
  PANEL_ACOTADO,
  PANEL_SIN_ARCHIVO,
  pedirAlPanel,
  retirarLoSembrado,
  sembrarEscenario,
  TITULO_CON_GENTE,
  TITULO_SOLA,
  TITULO_VIVA,
  tokenDePanelDe,
  type Escenario,
} from './ayuda-archivar-vacante'

/**
 * Retirar de la lista una vacante cerrada, consultarla y devolverla.
 *
 * Es la parte que ninguna prueba de servicio puede contestar: que la vacante
 * desaparezca de la tabla que el equipo mira todos los días, que aparezca en
 * otra con su fecha, que desde allí se llegue a su proceso entero y que volver
 * a traerla la deje exactamente como estaba — incluido el lado del candidato,
 * que no tiene que enterarse de nada.
 *
 * ⚠️ **ESCRIBE, y por eso siembra su propio terreno**: tres vacantes marcadas,
 * una persona en carrera y una cuenta de panel sin permiso de archivo. No toca
 * las vacantes sembradas de la base —archivar una de ellas la escondería de
 * todas las demás pruebas— y lo suyo se retira al terminar. Ver
 * `ayuda-archivar-vacante`.
 *
 * Los pasos comparten estado y van en orden: cada uno deja la vacante donde el
 * siguiente la necesita.
 */
test.describe.configure({ mode: 'serial' })

let escenario: Escenario

const elArchivo = (page: Page, titulo: string) =>
  page.getByRole('button', { name: `Archivar la vacante ${titulo}` })

const elModal = (page: Page) => page.getByRole('dialog', { name: 'Archivar vacante' })

/** La tabla de vacantes, y solo ella: fuera quedan la cabecera y sus avisos. */
const laTabla = (page: Page) => page.getByRole('table')

/** El botón «Archivadas (N)» de la cabecera, con su número. */
const elBotonDeArchivadas = (page: Page) => page.getByRole('link', { name: /^Archivadas \(/ })

/** Lo que el panel dice en voz alta, sin la región viva vacía de la cabecera. */
const confirmacion = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ })

/** Entra al panel con una cuenta concreta y no con la de todos los permisos. */
async function entrarAlPanelComo(page: Page, renaserOsId: string) {
  const token = await tokenDePanelDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

async function abrirElPanel(page: Page) {
  await entrarAlPanelComo(page, 'dev-equipo')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('Archivar una vacante cerrada y traerla de vuelta', () => {
  test.beforeAll(async () => {
    escenario = await sembrarEscenario()
  })

  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(escenario?.correos ?? [])]))

  // ---------- 1. El icono, y dónde no está ----------

  test('el icono de archivo está solo en las cerradas, y nunca junto al lápiz', async ({
    page,
  }) => {
    await abrirElPanel(page)
    await expect(page.getByText(TITULO_SOLA)).toBeVisible({ timeout: 20_000 })

    await expect(elArchivo(page, TITULO_SOLA)).toBeVisible()
    await expect(elArchivo(page, TITULO_CON_GENTE)).toBeVisible()
    // Una publicada se corrige, no se guarda: lápiz sí, archivo no.
    await expect(elArchivo(page, TITULO_VIVA)).toHaveCount(0)
    await expect(page.getByRole('button', { name: `Editar la vacante ${TITULO_VIVA}` }))
      .toBeVisible()
    // Y al revés en la cerrada: el lápiz no aparece donde no se puede editar.
    await expect(page.getByRole('button', { name: `Editar la vacante ${TITULO_SOLA}` }))
      .toHaveCount(0)
  })

  // ---------- 2. Con alguien en carrera no se archiva ----------

  test('con una persona en carrera el modal lo dice, enlaza a la vacante y no deja confirmar', async ({
    page,
  }) => {
    await abrirElPanel(page)
    await elArchivo(page, TITULO_CON_GENTE).click()

    await expect(elModal(page)).toBeVisible()
    await expect(elModal(page)).toContainText('Quedan 1 postulantes en carrera')
    await expect(elModal(page)).toContainText('descártalos en lote')
    await expect(elModal(page).getByRole('link', { name: new RegExp(`Ir a ${TITULO_CON_GENTE}`) }))
      .toBeVisible()
    await expect(elModal(page).getByRole('button', { name: 'Archivar vacante' })).toBeDisabled()

    await elModal(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(elModal(page)).toHaveCount(0)
    expect(archivadaEn(escenario.conGente), 'cancelar no cambia nada').toBeNull()

    // Y la API tampoco se deja saltar la regla desde fuera del navegador.
    const porApi = await pedirAlPanel(`/vacantes/${escenario.conGente}/archivo`, {
      metodo: 'POST',
    })
    expect(porApi.estado).toBe(409)
    expect(archivadaEn(escenario.conGente)).toBeNull()
  })

  // ---------- 3. Abrir, cancelar y confirmar ----------

  test('abrir y cancelar no archiva; confirmar la retira de la lista habitual', async ({
    page,
  }) => {
    await abrirElPanel(page)

    // Abrir y cancelar: la vacante sigue donde estaba.
    await elArchivo(page, TITULO_SOLA).click()
    await expect(elModal(page)).toBeVisible()
    await expect(elModal(page)).toContainText(TITULO_SOLA)
    await expect(elModal(page)).toContainText('Deja la lista habitual')
    await elModal(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(elModal(page)).toHaveCount(0)
    expect(archivadaEn(escenario.sola)).toBeNull()

    // Y ahora sí.
    await elArchivo(page, TITULO_SOLA).click()
    await elModal(page).getByRole('button', { name: 'Archivar vacante' }).click()

    await expect(confirmacion(page)).toContainText('está en Archivadas')
    // ⚠️ Acotado a la TABLA: el aviso de la cabecera nombra la vacante que se
    // acaba de archivar, así que un `getByText` suelto se casa con él y diría
    // que la fila sigue puesta cuando ya no está.
    await expect(laTabla(page).getByText(TITULO_SOLA)).toHaveCount(0)
    expect(archivadaEn(escenario.sola)).not.toBeNull()
    expect(estadoDe(escenario.sola), 'archivar no es un estado: sigue CERRADA').toBe('CERRADA')

    // La que sigue viva no se ha movido: lo que se retiró es una sola fila.
    await expect(laTabla(page).getByText(TITULO_VIVA)).toBeVisible()
  })

  // ---------- 4. Buscarla en las dos vistas ----------

  test('no reaparece al recargar la lista habitual, y sí está en Archivadas con su fecha', async ({
    page,
  }) => {
    await abrirElPanel(page)
    await expect(page.getByText(TITULO_VIVA)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(TITULO_SOLA)).toHaveCount(0)

    // La vista propia, identificable en la URL y a la que se llega desde la cabecera.
    await page.getByRole('link', { name: /^Archivadas \(/ }).click()
    await expect(page).toHaveURL(/\/admin\/archivadas$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes archivadas.' }))
      .toBeVisible()
    await expect(page.getByText(TITULO_SOLA)).toBeVisible()
    // Con su fecha de archivo, y sin las que siguen vivas.
    await expect(page.getByRole('columnheader', { name: 'Archivada' })).toBeVisible()
    await expect(page.getByText(TITULO_VIVA)).toHaveCount(0)

    // Recargar conserva la vista, y Atrás vuelve a la lista habitual.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes archivadas.' }))
      .toBeVisible({ timeout: 20_000 })
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  })

  // ---------- 5. Su proceso, en lectura ----------

  test('su detalle se consulta entero y dice que está archivada, sin ofrecer cambiarla', async ({
    page,
  }) => {
    await abrirElPanel(page)
    await page.goto(`/admin/vacantes/${escenario.sola}`)

    await expect(page.getByRole('heading', { level: 1, name: TITULO_SOLA })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Archivada el /)).toBeVisible()
    await expect(
      page.getByText('Esta vacante está archivada: se consulta, no se cambia.'),
    ).toBeVisible()

    // El proceso sigue: el ranking con sus etapas.
    await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible()
    // Lo que no está es nada con lo que tocarla.
    await expect(page.getByRole('button', { name: 'Configuración de la vacante' }))
      .toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cerrar vacante' })).toHaveCount(0)

    // Y la API lo hace cumplir, que es donde de verdad vive la regla.
    const detalle = await pedirAlPanel(`/vacantes/${escenario.sola}`)
    const v = detalle.cuerpo as Record<string, unknown>
    const edicion = await pedirAlPanel(`/vacantes/${escenario.sola}`, {
      metodo: 'PUT',
      cuerpo: {
        solicitudTalentoId: v.solicitudTalentoId,
        responsableUsuarioId: v.responsableUsuarioId,
        titulo: 'Título que no debería quedarse',
        descripcion: v.descripcion,
        tipoCierre: v.tipoCierre,
        remuneracion: v.remuneracion,
      },
    })
    expect(edicion.estado).toBe(409)
    const publicacion = await pedirAlPanel(`/vacantes/${escenario.sola}/publicacion`, {
      metodo: 'POST',
    })
    expect(publicacion.estado).toBe(409)
  })

  // ---------- 6. Los permisos ----------

  test('sin «cerrar_vacante» no hay icono ni API, pero Archivadas se consulta igual', async ({
    page,
  }) => {
    await entrarAlPanelComo(page, PANEL_SIN_ARCHIVO)
    await page.goto('/admin')
    await expect(page.getByText(TITULO_VIVA)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^Archivar la vacante/ })).toHaveCount(0)

    // Consultar lo guardado usa el permiso de lectura de siempre.
    await page.getByRole('link', { name: /^Archivadas \(/ }).click()
    await expect(page.getByText(TITULO_SOLA)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Desarchivar la vacante/ })).toHaveCount(0)

    const token = await tokenDePanelDe(PANEL_SIN_ARCHIVO)
    const archivar = await pedirAlPanel(`/vacantes/${escenario.conGente}/archivo`, {
      metodo: 'POST',
      token,
    })
    expect(archivar.estado).toBe(403)
    const desarchivar = await pedirAlPanel(`/vacantes/${escenario.sola}/archivo`, {
      metodo: 'DELETE',
      token,
    })
    expect(desarchivar.estado).toBe(403)
    expect(archivadaEn(escenario.sola), 'sigue archivada').not.toBeNull()
  })

  test('con el permiso acotado a «sus vacantes», la de otro responsable no existe: 404', async ({
    page,
  }) => {
    // Ve la lista entera —`ver_vacantes` con alcance TODO— y su `cerrar_vacante`
    // solo alcanza a las suyas, que no son ninguna de las sembradas.
    await entrarAlPanelComo(page, PANEL_ACOTADO)
    await page.goto('/admin')
    await expect(laTabla(page).getByText(TITULO_CON_GENTE)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^Archivar la vacante/ })).toHaveCount(0)

    // 404 y no 403: un 403 confirmaría que esa vacante está ahí.
    const token = await tokenDePanelDe(PANEL_ACOTADO)
    const archivar = await pedirAlPanel(`/vacantes/${escenario.conGente}/archivo`, {
      metodo: 'POST',
      token,
    })
    expect(archivar.estado).toBe(404)
    const desarchivar = await pedirAlPanel(`/vacantes/${escenario.sola}/archivo`, {
      metodo: 'DELETE',
      token,
    })
    expect(desarchivar.estado).toBe(404)
    expect(archivadaEn(escenario.conGente), 'nada se archivó').toBeNull()
    expect(archivadaEn(escenario.sola), 'y la archivada sigue archivada').not.toBeNull()
  })

  // ---------- 7. Desarchivar ----------

  test('desarchivar la devuelve a la lista como CERRADA, sin tocar ninguna postulación', async ({
    page,
  }) => {
    const avisosAntes = avisosDe(escenario.enCarrera.usuarioId)

    await abrirElPanel(page)
    await page.goto('/admin/archivadas')
    await page.getByRole('button', { name: `Desarchivar la vacante ${TITULO_SOLA}` }).click()

    await expect(confirmacion(page)).toContainText('vuelve a la lista de vacantes')
    expect(archivadaEn(escenario.sola)).toBeNull()
    expect(estadoDe(escenario.sola), 'desarchivar no reabre la convocatoria').toBe('CERRADA')

    await page.getByRole('link', { name: '← Volver a vacantes' }).click()
    await expect(laTabla(page).getByText(TITULO_SOLA)).toBeVisible()
    // Y el contador vuelve a cero: la vacante ya no está guardada en ninguna parte.
    await expect(elBotonDeArchivadas(page)).toHaveText('Archivadas (0)')

    // Y el otro lado: al candidato no le ha pasado nada en todo esto.
    expect(estadoDeLaPostulacion(escenario.enCarrera.postulacionId))
      .toBe('PERFIL_POR_CONFIRMAR')
    expect(avisosDe(escenario.enCarrera.usuarioId), 'archivar no avisa a nadie')
      .toBe(avisosAntes)
  })

  test('el candidato ve su proceso exactamente igual que antes', async ({ page }) => {
    await entrarAlPortal(page, escenario.enCarrera.correo, CLAVE_DE_CANDIDATO)
    await page.goto(`/procesos/${escenario.enCarrera.uuid}`)

    await expect(page.getByRole('heading', { level: 1, name: TITULO_CON_GENTE })).toBeVisible({
      timeout: 20_000,
    })
  })

})
