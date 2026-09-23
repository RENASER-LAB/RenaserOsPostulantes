/**
 * «Me olvidé mi contraseña» del lado del panel: el enlace en entrar, la pantalla
 * de pedir y la de elegir la nueva.
 *
 * Lo propio del panel, que es lo que esta prueba fija (lo compartido con el
 * portal ya lo fijan `Clave.test` y `Restablecer.test`):
 *
 *   - **Entrar tiene «¿Olvidaste tu contraseña?»** y ya no dice que no se puede
 *     restablecer.
 *   - **Pedir el enlace no enseña la línea de talento** y llama a la puerta del
 *     panel, no a la del portal.
 *   - **El mínimo es 12**, el de la invitación (AC-11).
 *   - **Todo vuelve al panel**: el enlace nuevo a `/admin/clave` y el éxito a
 *     `/admin/entrar`, con su aviso y sin sesión (AC-06, AC-16).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import { ProveedorSesionPanel } from '../Sesion'
import { ClavePanel } from './ClavePanel'
import { EntrarPanel } from './Entrar'
import { RestablecerPanel } from './RestablecerPanel'

const pedir = vi.fn()
const restablecer = vi.fn()

vi.mock('@/panel/api/panel', async (original) => ({
  ...(await original<typeof import('@/panel/api/panel')>()),
  pedirRecuperacionPanel: (correo: string) => pedir(correo),
  restablecerClavePanel: (datos: unknown) => restablecer(datos),
}))

const TOKEN = 'otroTokenDePrueba_-43caracteresDeAzarBase64'

function montar(entrada: string) {
  const enrutador = createMemoryRouter(
    [
      { path: '/admin/entrar', element: <EntrarPanel /> },
      { path: '/admin/clave', element: <ClavePanel /> },
      { path: '/admin/restablecer', element: <RestablecerPanel /> },
    ],
    { initialEntries: [entrada] },
  )
  render(
    <ProveedorSesionPanel>
      <RouterProvider router={enrutador} />
    </ProveedorSesionPanel>,
  )
  return enrutador
}

function escribir(contrasena: string, repetir: string) {
  fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), { target: { value: contrasena } })
  fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: repetir } })
}

async function guardar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
  })
}

beforeEach(() => {
  pedir.mockReset()
  pedir.mockResolvedValue(undefined)
  restablecer.mockReset()
  localStorage.clear()
})

afterEach(cleanup)

describe('entrar al panel', () => {
  it('tiene «¿Olvidaste tu contraseña?» hacia /admin/clave y ya no dice que no se puede', () => {
    montar('/admin/entrar')
    expect(
      screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).getAttribute('href'),
    ).toBe('/admin/clave')
    expect(screen.queryByText(/todavía no podemos restablecer/i)).toBeNull()
    // Sin haber cambiado nada, no hay aviso de éxito
    expect(screen.queryByText(/contraseña cambiada/i)).toBeNull()
  })
})

describe('pedir el enlace en el panel', () => {
  it('llama a la puerta del panel, enseña el mensaje neutro y no la línea de talento', async () => {
    montar('/admin/clave')
    expect(screen.queryByText(/talento@renaser\.pe/)).toBeNull()

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@empresa.pe' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    })

    expect(pedir).toHaveBeenCalledWith('ana@empresa.pe')
    expect(screen.getByRole('status').textContent).toBe(
      'Si ese correo tiene una cuenta, te enviamos un enlace. Revisa también tu carpeta de spam. Vale por 60 minutos.',
    )
    expect(screen.queryByText(/talento@renaser\.pe/)).toBeNull()
  })

  it('vuelve a entrar al panel, no al portal', () => {
    montar('/admin/clave')
    expect(screen.getByRole('link', { name: /volver a entrar/i }).getAttribute('href')).toBe(
      '/admin/entrar',
    )
  })
})

describe('elegir la contraseña nueva en el panel', () => {
  it('AC-16 · el token sale de la barra al cargar, con replace', () => {
    const enrutador = montar(`/admin/restablecer?token=${TOKEN}`)
    expect(enrutador.state.location.pathname).toBe('/admin/restablecer')
    expect(enrutador.state.location.search).toBe('')
    expect(enrutador.state.historyAction).toBe('REPLACE')
    expect(restablecer).not.toHaveBeenCalled()
  })

  it('AC-11 · pide 12 caracteres: 11 se paran en el campo sin llamar al servidor', async () => {
    montar(`/admin/restablecer?token=${TOKEN}`)
    expect(screen.getByText(/al menos 12 caracteres/i)).toBeTruthy()
    escribir('once-letras', 'once-letras')
    await guardar()
    expect(screen.getByText('La contraseña necesita al menos 12 caracteres.')).toBeTruthy()
    expect(restablecer).not.toHaveBeenCalled()
  })

  it('F-01 · más de 72 bytes se para en el campo, en español y sin llamar al servidor', async () => {
    montar(`/admin/restablecer?token=${TOKEN}`)
    escribir('ñ'.repeat(40), 'ñ'.repeat(40))
    await guardar()
    expect(screen.getByText(/^La contraseña es demasiado larga\./)).toBeTruthy()
    expect(screen.queryByText(/bytes/i)).toBeNull()
    expect(restablecer).not.toHaveBeenCalled()
  })

  it('un enlace que no sirve ofrece pedir otro en el panel', async () => {
    restablecer.mockRejectedValue(new ErrorApi(401, 'Este enlace ya no sirve. Pide uno nuevo.'))
    montar(`/admin/restablecer?token=${TOKEN}`)
    escribir('una-clave-de-panel-larga', 'una-clave-de-panel-larga')
    await guardar()

    expect(screen.getByRole('heading', { name: 'Este enlace ya no sirve.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' }).getAttribute('href')).toBe(
      '/admin/clave',
    )
  })

  it('AC-06 · al guardar va a /admin/entrar con el aviso, el foco en él y sin sesión', async () => {
    restablecer.mockResolvedValue(undefined)
    localStorage.setItem('renaser_panel_token', 'una-sesion-vieja')
    const enrutador = montar(`/admin/restablecer?token=${TOKEN}`)
    escribir('una-clave-de-panel-larga', 'una-clave-de-panel-larga')
    await guardar()

    expect(restablecer).toHaveBeenCalledWith({ token: TOKEN, contrasena: 'una-clave-de-panel-larga' })
    expect(enrutador.state.location.pathname).toBe('/admin/entrar')
    const aviso = screen.getByRole('status')
    expect(aviso.textContent).toContain('Contraseña cambiada exitosamente')
    expect(document.activeElement).toBe(aviso)
    expect(localStorage.getItem('renaser_panel_token')).toBeNull()
  })
})
