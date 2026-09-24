import { expect, type Page } from '@playwright/test'

import { limpiarSiempre } from './base-de-datos'
import { test, tokenDelCandidato } from './ayuda-candidato'
import {
  avisosDe,
  eliminacionesAnotadasDe,
  eliminadaEn,
  estadoDeLaPostulacion,
  PANEL_ACOTADO,
  PANEL_SIN_ELIMINAR,
  pedirAlPanel,
  pedirAlPortal,
  postularComo,
  postulacionesDe,
  retirarLoSembrado,
  sembrarEscenario,
  TITULO_ARCHIVADA,
  TITULO_VIVA,
  tokenDePanelDe,
  type Escenario,
} from './ayuda-eliminar-vacante'

/**
 * Los bordes de la eliminación: permisos, archivadas, repetirla y el formulario
 * que alguien dejó abierto.
 *
 * ⚠️ **Fichero aparte y NO en serie**, a diferencia de `29`. Allí cada paso deja
 * el terreno donde el siguiente lo necesita, así que el primer fallo detiene la
 * fila entera y esconde a los demás. Aquí cada prueba mira una cosa sobre una
 * vacante distinta del mismo terreno, así que se leen por separado y en
 * cualquier orden.
 *
 * Comparten el terreno de `ayuda-eliminar-vacante` para no inventar un segundo
 * juego de datos que diga lo mismo.
 */

let escenario: Escenario

const laPapelera = (page: Page, titulo: string) =>
  page.getByRole('button', { name: `Eliminar la vacante ${titulo}` })

const elModal = (page: Page) => page.getByRole('dialog', { name: 'Eliminar vacante' })

const confirmacion = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ })

async function entrarComo(page: Page, renaserOsId: string) {
  const token = await tokenDePanelDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

test.beforeAll(async () => {
  escenario = await sembrarEscenario()
})

test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(escenario?.correos ?? [])]))

// ---------- Los permisos, en la pantalla y en la API ----------

test('sin el permiso no hay papelera en ninguna fila, y la API contesta 403', async ({
  page,
}) => {
  await entrarComo(page, PANEL_SIN_ELIMINAR)
  await page.goto('/admin')
  await expect(page.getByText(TITULO_VIVA)).toBeVisible({ timeout: 20_000 })

  // La pantalla, y las dos listas: lo que no se puede hacer no se ofrece.
  await expect(page.getByRole('button', { name: /^Eliminar la vacante/ })).toHaveCount(0)

  // Y la API, que es la que de verdad manda: esconder el botón no es la regla.
  const porApi = await pedirAlPanel(`/vacantes/${escenario.viva}`, {
    metodo: 'DELETE',
    cuerpo: { motivo: 'No debería poder' },
    token: await tokenDePanelDe(PANEL_SIN_ELIMINAR),
  })
  expect(porApi.estado).toBe(403)
  expect(eliminadaEn(escenario.viva)).toBeNull()
})

test('fuera del alcance del rol la vacante no existe: 404 y no 403', async () => {
  // Un 403 confirmaría que esa vacante está ahí, y de ahí se sondea qué ids hay
  // al otro lado. Esta cuenta tiene el permiso acotado a SUS vacantes y no
  // dirige ninguna de las sembradas.
  const porApi = await pedirAlPanel(`/vacantes/${escenario.viva}`, {
    metodo: 'DELETE',
    cuerpo: { motivo: 'No debería poder' },
    token: await tokenDePanelDe(PANEL_ACOTADO),
  })
  expect(porApi.estado).toBe(404)
  expect(eliminadaEn(escenario.viva)).toBeNull()
})

// ---------- Una archivada se elimina sin desarchivarla antes ----------

test('una archivada ofrece la papelera en su pantalla y se elimina desde allí', async ({
  page,
}) => {
  await entrarComo(page, 'dev-equipo')
  await page.goto('/admin/archivadas')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes archivadas.' }))
    .toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(TITULO_ARCHIVADA)).toBeVisible()

  await laPapelera(page, TITULO_ARCHIVADA).click()
  await expect(elModal(page)).toBeVisible()
  // Sin nadie dentro, el modal no promete cerrar postulaciones que no existen.
  await expect(elModal(page)).not.toContainText('Se cerrarán')
  await elModal(page).getByLabel('Por qué se elimina').fill('Se archivó por error')
  await elModal(page).getByRole('button', { name: 'Eliminar vacante' }).click()

  await expect(confirmacion(page)).toContainText('Vacante eliminada')
  await expect(page.getByRole('table').getByText(TITULO_ARCHIVADA)).toHaveCount(0)
  expect(eliminadaEn(escenario.archivada)).not.toBeNull()

  // Y sale también del contador de la cabecera, que cuenta el mismo universo.
  const conteo = await pedirAlPanel('/vacantes/archivadas/conteo')
  expect((conteo.cuerpo as { archivadas: number }).archivadas).toBe(0)
})

// ---------- Repetir la eliminación ----------

test('repetir la eliminación contesta 404 y no vuelve a auditar ni a avisar', async () => {
  // Se elimina el borrador (TITULO_BORRADOR), que es el caso más común de vacante
  // mal creada: nadie llegó a verla y no hay a quién avisar.
  const primera = await pedirAlPanel(`/vacantes/${escenario.borrador}`, {
    metodo: 'DELETE',
    cuerpo: { motivo: 'Se creó por duplicado' },
  })
  expect(primera.estado, JSON.stringify(primera.cuerpo)).toBe(200)
  expect(eliminacionesAnotadasDe(escenario.borrador)).toBe(1)

  const segunda = await pedirAlPanel(`/vacantes/${escenario.borrador}`, {
    metodo: 'DELETE',
    cuerpo: { motivo: 'Otra vez' },
  })
  expect(segunda.estado).toBe(404)
  expect(eliminacionesAnotadasDe(escenario.borrador), 'una eliminación, una fila').toBe(1)
})

// ---------- El formulario abierto desde antes ----------

test('postular a una eliminada se rechaza, y su proceso deja de abrirse', async () => {
  // Se elimina la publicada que tiene gente dentro y se prueban las dos puertas
  // del portal que quedan abiertas en el navegador de alguien: postular con el
  // formulario que tenía puesto, y abrir el proceso por su dirección.
  const eliminada = await pedirAlPanel(`/vacantes/${escenario.objetivo}`, {
    metodo: 'DELETE',
    cuerpo: { motivo: 'Se creó con el puesto equivocado' },
  })
  expect(eliminada.estado, JSON.stringify(eliminada.cuerpo)).toBe(200)

  const quien = escenario.enCarrera[0]
  const avisosAntes = avisosDe(quien.usuarioId)

  // Su proceso, por la dirección exacta que tenía guardada.
  const suProceso = await pedirAlPortal(
    `/postulaciones/${quien.uuid}`,
    await tokenDelCandidato(quien.correo),
  )
  expect(suProceso.estado).toBe(404)

  // Y quien iba a postular con el formulario abierto desde antes: manda su
  // currículum contra la URL que tenía puesta y no se le crea nada.
  const postulacionesAntes = postulacionesDe(escenario.objetivo)
  const tarde = await postularComo(
    await tokenDelCandidato(escenario.tarde.correo),
    escenario.objetivo,
  )
  expect(tarde.estado, JSON.stringify(tarde.cuerpo)).toBe(404)
  expect(postulacionesDe(escenario.objetivo), 'no se creó la postulación')
    .toBe(postulacionesAntes)

  // Ni el detalle público que ese formulario vuelve a pedir al enviar.
  const detalle = await pedirAlPortal(
    `/vacantes/${escenario.objetivo}`,
    await tokenDelCandidato(escenario.tarde.correo),
  )
  expect(detalle.estado, 'el detalle público tampoco existe ya').toBe(404)

  // Nada de esto puede haber movido a nadie ni haber repetido un aviso.
  expect(estadoDeLaPostulacion(quien.postulacionId)).toBe('CERRADA')
  expect(avisosDe(quien.usuarioId)).toBe(avisosAntes)
})
