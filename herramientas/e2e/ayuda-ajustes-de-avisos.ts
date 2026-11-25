import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Los ajustes de avisos desde la campana (25/11/2026).
 *
 * Hasta ese día se abrían con el botón «Notificaciones» de «Mis procesos», que decía debajo
 * en qué estaba WhatsApp («WhatsApp activo», «Esperando tu mensaje»…). Ese botón, su línea y
 * el mensaje flotante se quitaron: la ventana se abre con la tuerca de la cabecera de la
 * campana, que lleva un puntito verde (nunca texto) cuando WhatsApp se puede activar. Lo que
 * antes se leía en la línea se comprueba ahora en la ventana: el interruptor, su nota y el
 * puntito.
 */

export const campana = (page: Page): Locator => page.getByRole('button', { name: /^Avisos/ })
export const panelDeAvisos = (page: Page): Locator => page.getByRole('dialog', { name: 'Tus avisos' })
export const tuerca = (page: Page): Locator => panelDeAvisos(page).getByRole('button', { name: 'Ajustes de avisos' })
/**
 * El puntito verde de la tuerca. Por CSS y no por rol: con la ventana abierta encima, el
 * panel de debajo queda fuera del árbol de accesibilidad, pero el puntito sigue pintado.
 */
export const puntito = (page: Page): Locator => page.locator('button[aria-label="Ajustes de avisos"] [data-puntito]')
export const ventanaDeAjustes = (page: Page): Locator => page.getByRole('dialog', { name: 'Ajustes de avisos' })
export const interruptorDeWhatsapp = (page: Page): Locator =>
  ventanaDeAjustes(page).getByRole('switch', { name: 'Notificaciones por WhatsApp' })

/** Abre la campana (si no lo está) y comprueba la tuerca. Devuelve el panel. */
export async function abrirLaCampana(page: Page): Promise<Locator> {
  if (!(await panelDeAvisos(page).isVisible())) await campana(page).click()
  await expect(tuerca(page)).toBeVisible()
  return panelDeAvisos(page)
}

/** La campana y su tuerca: abre «Ajustes de avisos» y espera a que pinte sus canales. */
export async function abrirLosAjustes(page: Page): Promise<Locator> {
  await abrirLaCampana(page)
  await tuerca(page).click()
  const ventana = ventanaDeAjustes(page)
  await expect(ventana.getByRole('switch', { name: 'Notificaciones por correo' })).toBeVisible()
  return ventana
}

/** Cierra la ventana con su ×: la campana sigue abierta debajo. */
export async function cerrarLosAjustes(page: Page): Promise<void> {
  await ventanaDeAjustes(page).getByRole('button', { name: 'Cerrar' }).click()
  await expect(ventanaDeAjustes(page)).toBeHidden()
}

export type EstadoDeWhatsapp =
  | 'activo'
  | 'esperando'
  | 'apagado'
  | 'apagado por BAJA'
  | 'sin número'
  | 'no llegó'
  | 'sin WhatsApp'

/**
 * Lo que decía la línea del botón retirado, leído en la ventana ya abierta: el interruptor,
 * su nota y el puntito de la tuerca (solo cuando se puede activar).
 */
export async function whatsappEsta(page: Page, estado: EstadoDeWhatsapp): Promise<void> {
  const ventana = ventanaDeAjustes(page)
  const interruptor = interruptorDeWhatsapp(page)
  switch (estado) {
    case 'activo':
      await expect(interruptor).toHaveAttribute('aria-checked', 'true')
      await expect(ventana.getByText('Te avisamos de todos tus procesos y puedes escribirnos tus dudas.', { exact: false })).toBeVisible()
      await expect(puntito(page)).toHaveCount(0)
      return
    case 'esperando':
      await expect(interruptor).toHaveAttribute('aria-checked', 'true')
      await expect(ventana.getByText(/^Te abrimos WhatsApp\. Envía el mensaje desde el /)).toBeVisible()
      await expect(puntito(page)).toHaveCount(0)
      return
    case 'apagado':
      await expect(interruptor).toHaveAttribute('aria-checked', 'false')
      await expect(ventana.getByText(/escribiendo BAJA/)).toHaveCount(0)
      await expect(puntito(page)).toHaveCount(1)
      return
    case 'apagado por BAJA':
      await expect(interruptor).toHaveAttribute('aria-checked', 'false')
      await expect(ventana.getByText(/^Lo apagaste escribiendo BAJA/)).toBeVisible()
      await expect(puntito(page)).toHaveCount(1)
      return
    case 'sin número':
      await expect(interruptor).toHaveCount(0)
      await expect(ventana.getByText('Sin número', { exact: true })).toBeVisible()
      await expect(ventana.getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')).toBeVisible()
      await expect(puntito(page)).toHaveCount(1)
      return
    case 'no llegó':
      await expect(interruptor).toHaveAttribute('aria-checked', 'false')
      await expect(ventana.getByRole('alert')).toContainText('No nos llegó tu mensaje desde el')
      await expect(puntito(page)).toHaveCount(1)
      return
    case 'sin WhatsApp':
      await expect(interruptor).toHaveCount(0)
      await expect(ventana.getByRole('switch', { name: 'Notificaciones por correo' })).toBeVisible()
      await expect(ventana.getByRole('switch', { name: 'Notificaciones en el portal' })).toBeVisible()
      await expect(puntito(page)).toHaveCount(0)
      return
  }
}
