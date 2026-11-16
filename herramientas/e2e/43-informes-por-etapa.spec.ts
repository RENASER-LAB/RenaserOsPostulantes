import { expect, test, type Page } from '@playwright/test'
import { API, VACANTES, corte, entrarAlPanel, idDeVacante, irAVacante, pestana, tokenDelPanel } from './ayuda'

/**
 * Los informes por etapa desde la ficha del candidato (spec informe-pdf-por-etapa),
 * contra el backend de verdad, en la vacante llena del snapshot de QA.
 *
 * Aquí quedan los casos que la base de QA ya trae: el botón gris de un informe que
 * todavía no existe y el que no sale sin permiso. Las descargas de los tres PDF desde
 * la ficha —nombre, candidato, nota y «Por verificar en la entrevista» solo en el de
 * la prueba— las cubre `60-informes-por-etapa-qa` («Ficha · …» y «API · …»), que
 * siembra a sus candidatos calificados; aquí se saltaban siempre, porque en la base
 * sintética nadie tiene un informe listo.
 *
 * Los candidatos se eligen preguntando a la API qué informe tiene cada uno: la base de
 * QA cambia y no hay un nombre fijo que valga para siempre. Solo lee: ninguna prueba
 * escribe en la base.
 */

type Codigo = 'CV' | 'EVALUACION' | 'PRUEBA'

interface Estado {
  etapa: Codigo
  disponible: boolean
  motivo: string | null
  nota: number | null
}

const PESTANA: Record<Codigo, string> = {
  CV: 'Perfil integral',
  EVALUACION: 'Perfil integral',
  PRUEBA: 'Prueba del puesto',
}

async function api<T>(ruta: string): Promise<T> {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${await tokenDelPanel()}` } })
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`)
  return r.json() as Promise<T>
}

/** El primer postulante de la vacante cuyo informe de esa etapa cumple la condición. */
async function alguienCon(
  vacanteId: number,
  cumple: (e: Estado) => boolean,
): Promise<{ id: number; nombre: string; estado: Estado } | null> {
  const visor = await api<{ postulantes: { postulacionId: number; candidato: string }[] }>(
    `/panel/vacantes/${vacanteId}/informes`,
  )
  for (const p of visor.postulantes) {
    const estados = await api<{ informes: Estado[] }>(`/panel/postulaciones/${p.postulacionId}/informes`)
    const estado = estados.informes.find(cumple)
    if (estado) return { id: p.postulacionId, nombre: p.candidato, estado }
  }
  return null
}

/** Abre la ficha de esa persona en esa pestaña, con toda la tanda a la vista. */
async function abrirLaFicha(page: Page, nombre: string, etapa: Codigo) {
  await irAVacante(page, VACANTES.LLENA)
  await pestana(page, PESTANA[etapa]).click()
  await corte(page, 'Toda la tanda').click()
  const fila = page.locator('table tbody tr', { has: page.getByLabel(`Avanza ${nombre}`, { exact: true }) })
  await fila.locator('td').nth(1).click()
  await expect(page.getByRole('group', { name: 'Informes en PDF' })).toBeVisible({ timeout: 20_000 })
}

test.describe('Los informes por etapa desde la ficha', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('un informe que todavía no existe sale gris y desactivado, con su motivo', async ({ page }) => {
    const vacanteId = await idDeVacante(VACANTES.LLENA)
    const quien = await alguienCon(vacanteId, (e) => e.etapa !== 'PRUEBA' && !e.disponible)
    test.skip(quien == null, `En la base de QA todos tienen listos sus informes de Perfil Integral`)

    await abrirLaFicha(page, quien!.nombre, quien!.estado.etapa)
    const nombre = quien!.estado.etapa === 'CV' ? /informe del CV/ : /informe de la evaluación/
    const boton = page.getByRole('group', { name: 'Informes en PDF' }).getByRole('button', { name: nombre })
    await expect(boton).toBeDisabled()
    await expect(boton).toHaveAttribute('title', quien!.estado.motivo!)
    await expect(boton).toHaveAttribute('aria-label', new RegExp(quien!.estado.motivo!))
    expect(['Todavía no tiene calificación', 'La IA está calificando', 'La calificación falló'])
      .toContain(quien!.estado.motivo)
  })

  test('sin permiso para la evaluación no hay botón de ese informe', async ({ page }) => {
    const vacanteId = await idDeVacante(VACANTES.LLENA)
    const quien = await alguienCon(vacanteId, (e) => e.etapa === 'CV')
    test.skip(quien == null, `En la base de QA no hay postulantes en «${VACANTES.LLENA}»`)

    // Lo que el backend devuelve a quien no tiene «ver_respuestas_evaluacion»: la etapa
    // no viene. Se reproduce quitándola de la respuesta, sin tocar los roles de la base.
    await page.route('**/panel/postulaciones/*/informes', async (ruta) => {
      const respuesta = await ruta.fetch()
      const cuerpo = await respuesta.json()
      cuerpo.informes = cuerpo.informes.filter((i: Estado) => i.etapa !== 'EVALUACION')
      await ruta.fulfill({ response: respuesta, json: cuerpo })
    })
    await abrirLaFicha(page, quien!.nombre, 'CV')
    const grupo = page.getByRole('group', { name: 'Informes en PDF' })
    await expect(grupo.getByRole('button', { name: /informe del CV/ })).toBeVisible()
    await expect(grupo.getByRole('button', { name: /evaluación/ })).toHaveCount(0)

    // Y pedirlo directamente, con una cuenta sin ese permiso, sería un 403: lo comprueba
    // FlujoInformesPorEtapaIT en el backend.
  })
})
