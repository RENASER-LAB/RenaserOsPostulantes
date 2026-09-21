import { expect, type Page } from '@playwright/test'

import { limpiarSiempre } from './base-de-datos'
import { test } from './ayuda-candidato'
import {
  archivadaEn,
  archivadosAnotadosDe,
  pedirAlPanel,
  retirarLoSembrado,
  sembrarEscenario,
  TITULO_SOLA,
  tokenDePanelDe,
  type Escenario,
} from './ayuda-archivar-vacante'

/**
 * Las dos cosas que se descubrieron mirando el archivo con el navegador
 * abierto, y que la prueba de al lado no miraba.
 *
 * ⚠️ **Fichero aparte y NO en serie**, a diferencia de `27`. Allí cada paso deja
 * la vacante donde el siguiente la necesita, así que el primer fallo detiene la
 * fila entera — y estos dos casos fallan hoy los dos. Puestos allí, el primero
 * en romperse escondería al segundo y el informe contaría un defecto en vez de
 * dos. Aquí cada prueba siembra lo suyo, archiva una vez y devuelve la vacante a
 * la lista, así que se leen por separado y en cualquier orden.
 *
 * Comparten el terreno de `ayuda-archivar-vacante` para no inventar un segundo
 * juego de datos que diga lo mismo.
 */

let escenario: Escenario

const elArchivo = (page: Page, titulo: string) =>
  page.getByRole('button', { name: `Archivar la vacante ${titulo}` })

const elModal = (page: Page) => page.getByRole('dialog', { name: 'Archivar vacante' })

const confirmacion = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ })

const elBotonDeArchivadas = (page: Page) => page.getByRole('link', { name: /^Archivadas \(/ })

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

/** Devuelve la vacante a la lista habitual: cada prueba la encuentra igual. */
async function devolverALaLista(id: number) {
  if (archivadaEn(id) === null) return
  const vuelta = await pedirAlPanel(`/vacantes/${id}/archivo`, { metodo: 'DELETE' })
  expect(vuelta.estado, 'la limpieza de la prueba no pudo desarchivar').toBeLessThan(300)
}

test.describe('Archivar · lo que se vio con el navegador abierto', () => {
  test.beforeAll(async () => {
    escenario = await sembrarEscenario()
  })

  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(escenario?.correos ?? [])]))

  test.beforeEach(() => devolverALaLista(escenario.sola))

  /**
   * Un doble clic en «Archivar vacante» es un solo archivo.
   *
   * Archivar se pulsa con prisa y el botón está donde el ratón ya estaba. Si
   * salen las dos pulsaciones, las dos llegan antes de que ninguna haya escrito:
   * las dos leen «no archivada», las dos archivan, y la auditoría queda diciendo
   * que la vacante pasó dos veces de no archivada a archivada. Esa fila de más
   * deja sin respuesta «¿cuándo se archivó esto?», que es justo lo que la
   * trazabilidad contesta.
   */
  test('un doble clic en confirmar archiva una sola vez, y lo anota una sola vez', async ({
    page,
  }) => {
    const anotadosAntes = archivadosAnotadosDe(escenario.sola)
    const enviadas: string[] = []
    page.on('request', (r) => {
      if (r.url().includes(`/vacantes/${escenario.sola}/archivo`)) enviadas.push(r.method())
    })

    await abrirElPanel(page)
    await elArchivo(page, TITULO_SOLA).click()
    await elModal(page).waitFor()
    await elModal(page).getByRole('button', { name: 'Archivar vacante' }).dblclick()
    await expect(confirmacion(page)).toContainText('está en Archivadas')
    await page.waitForTimeout(1_500)

    expect(enviadas, 'una confirmación, una petición').toEqual(['POST'])
    expect(
      archivadosAnotadosDe(escenario.sola) - anotadosAntes,
      'un archivo, una fila de auditoría',
    ).toBe(1)
  })

  /**
   * «Archivadas (N)» cuenta lo que acaba de pasar, sin recargar.
   *
   * El número vive en la misma cabecera que el aviso «está en Archivadas». Si no
   * se refresca, la pantalla se contradice en dos líneas seguidas: arriba dice
   * que hay cero y debajo que la vacante ya está allí. La de arriba es la que se
   * pulsa, y es la que miente.
   */
  test('el contador «Archivadas (N)» se actualiza al archivar, sin recargar', async ({ page }) => {
    await abrirElPanel(page)
    await expect(elBotonDeArchivadas(page)).toHaveText('Archivadas (0)')

    await elArchivo(page, TITULO_SOLA).click()
    await elModal(page).waitFor()
    await elModal(page).getByRole('button', { name: 'Archivar vacante' }).click()
    await expect(confirmacion(page)).toContainText('está en Archivadas')

    await expect(elBotonDeArchivadas(page)).toHaveText('Archivadas (1)')
  })

  /**
   * Y la vuelta: desarchivar dos veces seguidas no puede decir que falló.
   *
   * «Desarchivar» es un botón suelto en una tabla, sin modal que lo frene, así
   * que el doble clic manda dos DELETE. El servidor hace lo suyo —la segunda
   * llega tarde y contesta 409, que es lo correcto— pero la pantalla pinta ese
   * 409 como un error rojo encima de una operación que SÍ funcionó: la vacante
   * ya está de vuelta en la lista y aquí se lee «Esta vacante no está
   * archivada». Quien lo vea no sabe si desarchivó o no, y lo intentará otra vez.
   */
  test('un doble clic en «Desarchivar» no deja un error falso sobre algo que funcionó', async ({
    page,
  }) => {
    const enviadas: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'DELETE' && r.url().includes(`/vacantes/${escenario.sola}/archivo`)) {
        enviadas.push(r.method())
      }
    })

    const archivar = await pedirAlPanel(`/vacantes/${escenario.sola}/archivo`, { metodo: 'POST' })
    expect(archivar.estado).toBeLessThan(300)

    await abrirElPanel(page)
    await page.goto('/admin/archivadas')
    const boton = page.getByRole('button', { name: `Desarchivar la vacante ${TITULO_SOLA}` })
    await boton.waitFor()
    await boton.dblclick()
    // La fila se va: la operación funcionó, y es contra eso que se mide lo demás.
    await expect(boton).toHaveCount(0)
    await page.waitForTimeout(1_500)
    expect(archivadaEn(escenario.sola), 'la vacante sí volvió a la lista').toBeNull()

    await expect(
      page.getByRole('alert'),
      'lo que funcionó no puede anunciarse como un fallo',
    ).toHaveCount(0)
    await expect(
      page.getByRole('status').filter({ hasText: /\S/ }),
      'y lo que se dice es que volvió a la lista',
    ).toContainText('vuelve a la lista de vacantes')
    expect(enviadas, 'una pulsación efectiva, un DELETE').toEqual(['DELETE'])
  })
})
