import { expect, test, type Page } from '@playwright/test'
import { API, entrarAlPanel, tokenDelPanel } from './ayuda'
import { crearVacanteEnBorrador, irALaVacante, marcaDeHora } from './ayuda-tecnica'

/**
 * Las preguntas propias de una vacante (V66, fase 1), de punta a punta en el panel:
 *
 *   1. La vacante nace con «Preguntas propias de esta vacante» y enseña su estado.
 *   2. La primera pregunta sin criterio crea «General»; con 95 puntos y un criterio
 *      vacío, publicar devuelve la lista entera de lo que falta.
 *   3. Con 100 se publican, y la vacante lo dice.
 *   4. Otra vacante de la misma empresa las copia, buscándola por nombre.
 *
 * ⚠️ **ESCRIBE**: crea dos vacantes en borrador en la base a la que apunte el backend.
 * Nunca contra producción. No llama a la IA: las recomendaciones y la calificación se
 * prueban con el agente simulado en el backend (FlujoPreguntasPropiasIT).
 */

const SELLO = marcaDeHora()
const recorrido = {
  vacanteId: 0,
  titulo: `Asistente contable · preguntas e2e ${SELLO}`,
  otraId: 0,
  otra: `Asistente contable II · preguntas e2e ${SELLO}`,
}

async function alPanel(camino: string, cuerpo: unknown): Promise<void> {
  const r = await fetch(`${API}/panel${camino}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenDelPanel()}` },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`POST ${camino} contestó ${r.status}: ${await r.text()}`)
}

const criterio = (page: Page, nombre: string) => page.getByRole('region', { name: `Criterio ${nombre}` })

test.describe('Las preguntas propias de una vacante', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    recorrido.vacanteId = await crearVacanteEnBorrador(recorrido.titulo)
  })

  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('1 · la vacante nace con sus preguntas propias y dice que todavía no hay', async ({ page }) => {
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)
    const propias = page.getByRole('radio', { name: 'Preguntas propias de esta vacante' })
    await expect(propias).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('radio', { name: 'Sin evaluación' })).toBeVisible()

    // Toda vacante nueva nace con sus preguntas propias marcadas (decisión del 30/09/2026):
    // no hay que elegirlas.
    await expect(propias).toBeChecked({ timeout: 20_000 })
    await expect(page.getByText(/Sin preguntas/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Escribir las preguntas →' })).toBeVisible()
  })

  test('2 · la primera pregunta crea «General», y publicar con 95 lista todo lo que falta', async ({ page }) => {
    await page.goto(`/admin/vacantes/${recorrido.vacanteId}/preguntas`)
    await expect(page.getByRole('heading', { level: 1, name: `${recorrido.titulo} · Preguntas` })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('Todavía no hay preguntas')).toBeVisible()

    await page.getByRole('button', { name: 'Agregar pregunta' }).click()
    await page.getByLabel('Enunciado').fill('Cuéntanos un cierre con un descuadre. ¿Cómo lo hallaste?')
    await page.getByLabel('Puntos', { exact: true }).fill('95')
    await page.getByRole('button', { name: 'Agregar la pregunta' }).click()
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Agregar criterio' }).click()
    await page.getByLabel('Nombre del criterio').fill('Manejo de Excel')
    await page.getByRole('button', { name: 'Agregar el criterio' }).click()
    await expect(criterio(page, 'Manejo de Excel').getByText('Sin preguntas: así no se publica.')).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'Publicar las preguntas' }).click()
    const faltas = page.getByRole('alert').filter({ hasText: 'Faltan 2 cosas' })
    await expect(faltas).toBeVisible({ timeout: 20_000 })
    await expect(faltas.getByRole('listitem')).toHaveCount(2)
    await expect(faltas).toContainText('faltan 5')
    await expect(faltas).toContainText('Manejo de Excel')
  })

  test('3 · con 100 puntos se publican, y la vacante lo dice', async ({ page }) => {
    await page.goto(`/admin/vacantes/${recorrido.vacanteId}/preguntas`)
    const general = criterio(page, 'General')
    await expect(general).toBeVisible({ timeout: 20_000 })
    // Los criterios salen plegados al entrar (V68): se despliegan para editar.
    await page.getByRole('button', { name: 'Desplegar todo' }).click()

    await general.getByRole('button', { name: 'Editar la pregunta' }).click()
    await general.getByLabel('Puntos', { exact: true }).fill('100')
    await general.getByRole('button', { name: 'Guardar la pregunta' }).click()
    await expect(general.getByText('100 pts', { exact: true }).first()).toBeVisible({ timeout: 20_000 })

    await criterio(page, 'Manejo de Excel').getByRole('button', { name: 'Quitar el criterio Manejo de Excel' }).click()
    await expect(criterio(page, 'Manejo de Excel')).toHaveCount(0, { timeout: 20_000 })

    await page.getByRole('button', { name: 'Publicar las preguntas' }).click()
    await expect(page.getByText(/Publicadas\. Desde la primera postulación solo se cambian los puntos/)).toBeVisible({
      timeout: 20_000,
    })

    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)
    await expect(page.getByText(/Publicadas · 1 criterio · 1 pregunta/)).toBeVisible({ timeout: 20_000 })
  })

  test('4 · otra vacante de la empresa las copia, buscándola por nombre', async ({ page }) => {
    recorrido.otraId = await crearVacanteEnBorrador(recorrido.otra)
    await alPanel(`/vacantes/${recorrido.otraId}/origen-preguntas`, { origen: 'VACANTE' })

    await page.goto(`/admin/vacantes/${recorrido.otraId}/preguntas`)
    await expect(page.getByText('Todavía no hay preguntas')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click()

    const dialogo = page.getByRole('dialog', { name: 'Copiar de otra vacante' })
    await expect(dialogo).toBeVisible()
    await dialogo.getByLabel('Buscar por nombre').fill(`preguntas e2e ${SELLO}`)
    const origen = dialogo.getByRole('button', { name: new RegExp(`^Asistente contable · preguntas e2e ${SELLO}`) })
    await expect(origen).toBeVisible({ timeout: 20_000 })
    await origen.click()

    // La vista previa no copia nada: solo al pulsar «Copiar esta prueba». Se pinta dos veces
    // (al lado en escritorio y debajo de la vacante tocada en móvil): vale la que se ve.
    await expect(dialogo.getByText('Cuéntanos un cierre con un descuadre. ¿Cómo lo hallaste?').filter({ visible: true }).first()).toBeVisible({
      timeout: 20_000,
    })
    await dialogo.getByRole('button', { name: 'Copiar esta prueba' }).click()

    await expect(dialogo).toBeHidden({ timeout: 20_000 })
    await expect(criterio(page, 'General')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('region', { name: 'Balance de las preguntas' })).toContainText('100')
  })
})
