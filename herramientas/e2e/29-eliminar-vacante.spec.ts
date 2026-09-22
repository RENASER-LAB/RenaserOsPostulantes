import { expect, type Page } from '@playwright/test'

import { limpiarSiempre } from './base-de-datos'
import { entrarAlPortal } from './ayuda'
import { CLAVE_DE_CANDIDATO, test } from './ayuda-candidato'
import {
  avisosDe,
  avisosDeEliminacionSinEnlaceDe,
  correosDe,
  eliminacionesAnotadasDe,
  eliminadaEn,
  estadoDe,
  estadoDeLaPostulacion,
  estadoDeLaSolicitud,
  motivoDeCierreDe,
  pedirAlPanel,
  retirarLoSembrado,
  sembrarEscenario,
  TITULO_OBJETIVO,
  TITULO_VIVA,
  tokenDePanelDe,
  type Escenario,
} from './ayuda-eliminar-vacante'

/**
 * Retirar una vacante que no debió existir, con el navegador abierto.
 *
 * Es la parte que ninguna prueba de servicio puede contestar: que la fila
 * desaparezca de la tabla que el equipo mira todos los días, que la persona que
 * estaba postulando deje de ver su proceso y encuentre en su campana lo que
 * pasó, y que la solicitud vuelva a ofrecerse para crear la vacante correcta.
 *
 * ⚠️ **ESCRIBE, y lo que escribe no se deshace desde el panel**: por eso
 * siembra su propio terreno —cuatro vacantes marcadas, cuatro personas y dos
 * cuentas de panel— y lo retira al terminar. No toca las vacantes sembradas de
 * la base: eliminar una de ellas la retiraría para todas las demás pruebas y
 * sin botón para traerla de vuelta. Ver `ayuda-eliminar-vacante`.
 *
 * Los pasos comparten estado y van en orden: cada uno deja el terreno donde el
 * siguiente lo necesita.
 */
test.describe.configure({ mode: 'serial' })

let escenario: Escenario

const laPapelera = (page: Page, titulo: string) =>
  page.getByRole('button', { name: `Eliminar la vacante ${titulo}` })

const elModal = (page: Page) => page.getByRole('dialog', { name: 'Eliminar vacante' })

/** El campo del motivo, que es lo que enciende el botón destructivo. */
const elMotivo = (page: Page) => elModal(page).getByLabel('Por qué se elimina')

const confirmar = (page: Page) => elModal(page).getByRole('button', { name: 'Eliminar vacante' })

/** La tabla de vacantes, y solo ella: fuera quedan la cabecera y sus avisos. */
const laTabla = (page: Page) => page.getByRole('table')

/** Lo que el panel dice en voz alta, sin la región viva vacía de la cabecera. */
const confirmacion = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ })

async function abrirElPanel(page: Page) {
  const token = await tokenDePanelDe('dev-equipo')
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('Eliminar una vacante publicada con gente dentro', () => {
  test.beforeAll(async () => {
    escenario = await sembrarEscenario()
  })

  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(escenario?.correos ?? [])]))

  // ---------- 1. La papelera está en todas las filas ----------

  test('la papelera sale en cualquier estado y va la última de la fila', async ({ page }) => {
    await abrirElPanel(page)
    await expect(page.getByText(TITULO_OBJETIVO)).toBeVisible({ timeout: 20_000 })

    await expect(laPapelera(page, TITULO_OBJETIVO)).toBeVisible()
    await expect(laPapelera(page, TITULO_VIVA)).toBeVisible()

    // El orden de las acciones: editar y después eliminar. Una acción que no se
    // deshace en medio de la fila se pulsa por inercia, apuntando a la de al lado.
    const fila = page.getByRole('row').filter({ hasText: TITULO_OBJETIVO })
    const nombres = await fila.getByRole('button').evaluateAll((botones) =>
      botones.map((b) => b.getAttribute('aria-label')),
    )
    expect(nombres.filter((n): n is string => n !== null)).toEqual([
      `Editar la vacante ${TITULO_OBJETIVO}`,
      `Eliminar la vacante ${TITULO_OBJETIVO}`,
    ])
  })

  // ---------- 2. Abrir, mirar las consecuencias y cancelar ----------

  test('el modal cuenta las consecuencias, exige motivo y cancelar no hace nada', async ({
    page,
  }) => {
    await abrirElPanel(page)
    await laPapelera(page, TITULO_OBJETIVO).click()

    await expect(elModal(page)).toBeVisible()
    await expect(elModal(page)).toContainText(TITULO_OBJETIVO)
    await expect(elModal(page)).toContainText('Dejará de verse en el panel y en el portal')
    // Las dos en carrera, y solo esas: la descartada y la contratada no cuentan.
    await expect(elModal(page)).toContainText('Se cerrarán sus 2 postulaciones')
    await expect(elModal(page)).toContainText('No se podrá deshacer desde el panel')

    // El botón nace apagado, y un motivo de solo espacios no lo enciende.
    await expect(confirmar(page)).toBeDisabled()
    await elMotivo(page).fill('    ')
    await expect(confirmar(page)).toBeDisabled()
    await elMotivo(page).fill('Se creó con el puesto equivocado')
    await expect(confirmar(page)).toBeEnabled()

    // Y cancelar no ejecuta nada de lo que acaba de contar.
    await elModal(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(elModal(page)).toHaveCount(0)
    expect(eliminadaEn(escenario.objetivo), 'cancelar no elimina').toBeNull()
    expect(estadoDeLaPostulacion(escenario.enCarrera[0].postulacionId))
      .toBe('PERFIL_POR_CONFIRMAR')
    expect(estadoDeLaSolicitud(escenario.solicitudDelObjetivo)).toBe('CON_VACANTE')
    expect(eliminacionesAnotadasDe(escenario.objetivo)).toBe(0)

    // Y la API tampoco acepta un motivo vacío desde fuera del navegador.
    const sinMotivo = await pedirAlPanel(`/vacantes/${escenario.objetivo}`, {
      metodo: 'DELETE',
      cuerpo: { motivo: '   ' },
    })
    expect(sinMotivo.estado).toBe(400)
    expect(eliminadaEn(escenario.objetivo)).toBeNull()
  })

  // ---------- 3. Confirmar ----------

  test('confirmar retira la fila y dice cuántas postulaciones se cerraron', async ({ page }) => {
    const correosAntes = escenario.enCarrera.map((p) => correosDe(p.usuarioId))
    const avisosDeLaContratada = avisosDe(escenario.terminadas[1].usuarioId)

    await abrirElPanel(page)
    await laPapelera(page, TITULO_OBJETIVO).click()
    await elMotivo(page).fill('Se creó con el puesto equivocado')
    await confirmar(page).click()

    await expect(confirmacion(page)).toContainText(
      'Vacante eliminada. Se cerraron 2 postulaciones y se les avisó en su portal',
    )
    // ⚠️ Acotado a la TABLA: el aviso nombra la vacante que se acaba de
    // eliminar, así que un `getByText` suelto se casa con él y diría que la
    // fila sigue puesta cuando ya no está.
    await expect(laTabla(page).getByText(TITULO_OBJETIVO)).toHaveCount(0)
    // Lo que se retiró es una sola fila: la de al lado sigue donde estaba.
    await expect(laTabla(page).getByText(TITULO_VIVA)).toBeVisible()

    expect(eliminadaEn(escenario.objetivo)).not.toBeNull()
    expect(estadoDe(escenario.objetivo), 'eliminar no cambia el estado').toBe('PUBLICADA')

    // Las dos que seguían dentro, cerradas con el motivo nuevo y avisadas sin enlace.
    for (const [i, persona] of escenario.enCarrera.entries()) {
      expect(estadoDeLaPostulacion(persona.postulacionId)).toBe('CERRADA')
      expect(motivoDeCierreDe(persona.postulacionId)).toBe('VACANTE_ELIMINADA')
      expect(avisosDeEliminacionSinEnlaceDe(persona.usuarioId)).toBe(1)
      expect(correosDe(persona.usuarioId), 'ningún correo nuevo').toBe(correosAntes[i])
    }

    // Las dos que ya habían terminado, intactas y sin enterarse de nada.
    expect(estadoDeLaPostulacion(escenario.terminadas[0].postulacionId)).toBe('NO_CONTINUA')
    expect(motivoDeCierreDe(escenario.terminadas[0].postulacionId)).toBe('DECISION_PERSONA')
    expect(estadoDeLaPostulacion(escenario.terminadas[1].postulacionId)).toBe('CONTRATADO')
    expect(avisosDe(escenario.terminadas[1].usuarioId)).toBe(avisosDeLaContratada)

    expect(eliminacionesAnotadasDe(escenario.objetivo)).toBe(1)
  })

  // ---------- 4. No vuelve a aparecer en el panel ----------

  test('no reaparece al recargar, ni en Archivadas, ni por su dirección', async ({ page }) => {
    await abrirElPanel(page)
    await expect(page.getByText(TITULO_VIVA)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(TITULO_OBJETIVO)).toHaveCount(0)

    // Archivar y eliminar son cosas distintas: una eliminada tampoco está en
    // «Archivadas», que es donde se consulta lo que se guardó.
    await page.getByRole('link', { name: /^Archivadas \(/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes archivadas.' }))
      .toBeVisible()
    await expect(page.getByText(TITULO_OBJETIVO)).toHaveCount(0)

    // Y su dirección de panel ya no abre nada.
    const detalle = await pedirAlPanel(`/vacantes/${escenario.objetivo}`)
    expect(detalle.estado).toBe(404)
  })

  // ---------- 5. El lado del candidato ----------

  test('quien estaba dentro deja de ver su proceso y encuentra el aviso en su campana', async ({
    page,
  }) => {
    const quien = escenario.enCarrera[0]
    await entrarAlPortal(page, quien.correo, CLAVE_DE_CANDIDATO)

    await page.goto('/procesos')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(TITULO_OBJETIVO)).toHaveCount(0)

    // El enlace directo al proceso, que sigue estando en su navegador y en los
    // correos que se le mandaron, dice lo que pasó en vez de un error.
    await page.goto(`/procesos/${quien.uuid}`)
    await expect(page.getByRole('heading', { name: 'Esta vacante ya no está disponible.' }))
      .toBeVisible({ timeout: 20_000 })

    // Y el tablón tampoco la enseña, ni su detalle público.
    await page.goto(`/vacantes/${escenario.objetivo}`)
    await expect(page.getByRole('heading', { name: 'Esta vacante ya no está disponible.' }))
      .toBeVisible({ timeout: 20_000 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(TITULO_OBJETIVO)).toHaveCount(0)
  })

  // ---------- 6. La solicitud liberada vuelve a servir ----------

  test('la solicitud vuelve a ABIERTA y permite crear otra vacante con el mismo título', async () => {
    expect(estadoDeLaSolicitud(escenario.solicitudDelObjetivo)).toBe('ABIERTA')

    // Aparece entre las aprobadas disponibles, que es lo que lee «Crear vacante».
    const solicitudes = await pedirAlPanel('/solicitudes')
    expect(solicitudes.estado).toBe(200)
    const suya = (solicitudes.cuerpo as Array<{ id: number; estado: string }>).find(
      (s) => s.id === escenario.solicitudDelObjetivo,
    )
    expect(suya?.estado).toBe('ABIERTA')

    // Y crea de verdad, con el MISMO título: el borrado lógico no reserva nombres.
    const nueva = await pedirAlPanel('/vacantes', {
      metodo: 'POST',
      cuerpo: {
        solicitudTalentoId: escenario.solicitudDelObjetivo,
        titulo: TITULO_OBJETIVO,
        descripcion: 'La correcta, sembrada por las pruebas de eliminación',
        tipoCierre: 'PERMANENTE',
        responsableUsuarioId: 1,
      },
    })
    expect(nueva.estado, JSON.stringify(nueva.cuerpo)).toBe(201)
    expect((nueva.cuerpo as { id: number }).id).not.toBe(escenario.objetivo)
    expect(estadoDeLaSolicitud(escenario.solicitudDelObjetivo)).toBe('CON_VACANTE')
  })
})
