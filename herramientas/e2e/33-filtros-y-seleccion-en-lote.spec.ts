import { expect, test, type Page } from '@playwright/test'
import {
  API,
  abrirFiltros,
  botonFiltros,
  cerrarFiltros,
  corte,
  entrarAlPanel,
  filasDelRanking,
  idDeVacante,
  irAVacante,
  panelFiltros,
  pestana,
  tokenDelPanel,
  VACANTES,
} from './ayuda'

/**
 * El botón «Filtros» sobre la vacante sembrada de siempre: lo que solo se ve
 * en el navegador y no necesita terreno propio.
 *
 * ⚠️ **No escribe nada.**
 *
 * Lo que este archivo traía y ya no está, y por qué:
 *
 *   - Un día, un rango, las etiquetas, la insignia y «Borrar filtros»; «Fallida»;
 *     marcar todo con un filtro y avanzar; «Descartar…» con la tabla alta; y
 *     marcar todo en dos etapas los ejercita `34-filtros-y-seleccion-qa` sobre
 *     una tanda de 32 con fechas y estados de IA de verdad —aquí, con cuatro
 *     filas del mismo día, un rango daba siempre todo o nada—.
 *   - «Desde» después de «Hasta», «Últimos 7 días» y que marcar todo no toque a
 *     las ocultas son reglas de `ranking.ts` y se prueban sin navegador.
 */

interface Fila {
  postulacionId: number
  candidato: string
  ciudadCodigo: string | null
}

async function tandaPorApi(titulo: string, etapa = 'PERFIL_INTEGRAL'): Promise<Fila[]> {
  const id = await idDeVacante(titulo)
  const r = await fetch(`${API}/panel/vacantes/${id}/ranking?etapa=${etapa}`, {
    headers: { Authorization: `Bearer ${await tokenDelPanel()}` },
  })
  if (!r.ok) throw new Error(`el ranking de «${titulo}» contestó ${r.status}`)
  return (await r.json()).filas as Fila[]
}

const etiquetas = (page: Page) =>
  page.getByRole('list', { name: 'Filtros activos' }).getByRole('button')

test.describe('«Filtros» sobre la vacante de siempre', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
  })

  // AC-04 y AC-04b: en escritorio el panel flota; abrirlo y cerrarlo no mueve la tabla.
  test('el panel flota: no es modal, abrirlo y cerrarlo no mueve ni una fila, y el foco vuelve al botón', async ({ page }) => {
    const cabecera = page.locator('table thead')
    const antes = await cabecera.boundingBox()
    await abrirFiltros(page)
    // En escritorio no es modal: sin fondo apagado, la tabla sigue detrás.
    await expect(panelFiltros(page)).toHaveAttribute('aria-modal', 'false')
    const abierto = await cabecera.boundingBox()
    await cerrarFiltros(page)
    const despues = await cabecera.boundingBox()
    expect(abierto!.y).toBe(antes!.y)
    expect(despues!.y).toBe(antes!.y)
    await expect(botonFiltros(page)).toBeFocused()
  })

  // AC-07: al cambiar de etapa y volver, el filtro sigue puesto.
  test('los filtros se conservan al cambiar de etapa y volver', async ({ page }) => {
    const filas = await tandaPorApi(VACANTES.LLENA)
    const deLima = filas.filter((f) => f.ciudadCodigo === '1501')
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    await cerrarFiltros(page)
    await expect(filasDelRanking(page)).toHaveCount(deLima.length)

    await pestana(page, 'Prueba del puesto').click()
    await expect(botonFiltros(page)).toContainText('1')
    await expect(etiquetas(page).first()).toContainText('Ciudad: Lima — Lima')
    await expect(filasDelRanking(page)).toHaveCount(deLima.length)

    await pestana(page, 'Perfil integral').click()
    await expect(botonFiltros(page)).toContainText('1')
    await expect(filasDelRanking(page)).toHaveCount(deLima.length)
  })
})
