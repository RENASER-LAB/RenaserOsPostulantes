/**
 * «El propósito de la empresa» (specs/Ready/proposito-de-la-empresa, V85): las regresiones de
 * los hallazgos de la QA del ciclo 1, cada una independiente de las demás.
 *
 *   - QA-PROP-01: desde 1280 px la vista previa del panel está siempre a la vista y el botón
 *     «Vista previa» no debe salir (la spec y la maqueta: el botón es para pantallas estrechas).
 *   - QA-PROP-02 (AC-11): el reproductor de Vimeo se queda en 00:00 si el `<iframe>` no le deja
 *     `encrypted-media`; con ese permiso se reproduce (comprobado en Chrome con red real).
 *   - AC-24 con Enter: guardar la vacante con Enter desde «Video del puesto» marca el campo igual
 *     que con el botón.
 *
 * ⚠️ **ESCRIBE** en el clon: una empresa `QA-PROP-8029-REG-VIMEO` con una vacante. La retira
 * `afterAll`. A la plataforma solo le lee la presentación y le abre el formulario sin guardar.
 */

import { expect, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import {
  laPlataforma,
  ponerPresentacion,
  retirarLoSembrado,
  sembrarEmpresa,
  sembrarVacante,
  uno,
  type Empresa,
} from './ayuda-proposito-de-la-empresa'
import { literal } from './base-de-datos'

let plataforma: Empresa
let vimeo = 0

async function cortarVideos(page: Page) {
  await page.context().route(
    /^https?:\/\/([^/]*\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com|vimeo\.com|vimeocdn\.com)(:\d+)?\//,
    (ruta) => ruta.abort(),
  )
}

test.beforeAll(() => {
  retirarLoSembrado()
  plataforma = laPlataforma()
  const cafe = sembrarEmpresa('REG-VIMEO', 'Café Valle Sagrado')
  ponerPresentacion(cafe.id, { video: 'https://vimeo.com/123456789/abcdef1234' })
  vimeo = sembrarVacante(cafe.id, 'Barista de la regresión', { publicadaHaceDias: 2 })
})

test.afterAll(() => retirarLoSembrado())

test('QA-PROP-01: desde 1280 px la vista previa está a la vista y no hay botón «Vista previa»; por debajo, el botón abre el cajón', async ({ page }) => {
  await entrarAlPanel(page)
  for (const ancho of [1280, 1440]) {
    await page.setViewportSize({ width: ancho, height: 900 })
    await page.goto('/admin/empresa')
    await expect(page.getByRole('complementary', { name: 'Vista previa del perfil público' })).toBeVisible()
    await expect(
      page.getByRole('form', { name: 'Perfil de la empresa' }).getByRole('button', { name: 'Vista previa' }),
      `a ${ancho} px`,
    ).toBeHidden()
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/admin/empresa')
  await expect(page.getByRole('complementary', { name: 'Vista previa del perfil público' })).toBeHidden()
  await page.getByRole('form', { name: 'Perfil de la empresa' }).getByRole('button', { name: 'Vista previa' }).click()
  await expect(page.getByRole('dialog', { name: 'Vista previa' })).toContainText(plataforma.nombre)
})

test('QA-PROP-02 · AC-11: el reproductor de Vimeo lleva el permiso `encrypted-media`, sin el que se queda en 00:00', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await cortarVideos(page)
  await page.goto(`/vacantes/${vimeo}`)
  const lateral = page.getByRole('complementary', { name: 'Lo esencial del puesto' })
  await lateral.getByRole('button', { name: 'Reproducir el video de Café Valle Sagrado' }).click()
  const reproductor = lateral.locator('iframe')
  await expect(reproductor).toHaveAttribute('src', 'https://player.vimeo.com/video/123456789?autoplay=1&dnt=1&h=abcdef1234')
  await expect(reproductor).toHaveAttribute('allow', /(^|;\s*)encrypted-media\s*(;|$)/)
})

test('AC-24 con Enter: un enlace de Facebook en «Video del puesto» y Enter marca el campo con su error y no guarda', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const titulo = 'Analista de experiencia del cliente'
  const fila = uno(`select id, video_presentacion from vacante where organizacion_id = ${plataforma.id}
                     and titulo = ${literal(titulo)}`)
  await entrarAlPanel(page)
  await page.goto('/admin')
  await page.getByRole('button', { name: `Editar la vacante ${titulo}` }).click()
  const modal = page.getByRole('dialog', { name: 'Editar vacante' })
  const video = modal.getByLabel('Video del puesto (opcional)')
  await video.fill('https://www.facebook.com/renaser/videos/123')
  await video.press('Enter')
  await expect(modal.getByText('Corrige lo marcado en «Video del puesto».')).toBeVisible()
  await expect(video).toHaveAttribute('aria-invalid', 'true')
  await expect(video).toHaveAccessibleDescription('Pega el enlace de un video de YouTube o de Vimeo')
  expect(uno(`select video_presentacion from vacante where id = ${fila.id}`).video_presentacion).toBe(fila.video_presentacion)
})
