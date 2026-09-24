/**
 * `/restablecer`: elegir la contraseña nueva con el enlace del correo.
 *
 * Lo que esta prueba fija:
 *
 *   - **El token sale de la barra al cargar, con `replace`** (AC-16), y aun así
 *     viaja en el cuerpo al guardar.
 *   - **Abrir la pantalla no llama al servidor**: los clientes de correo
 *     precargan los enlaces y eso no puede gastarlo.
 *   - **Las reglas se paran en la pantalla** (AC-11, AC-12) sin llamar a nadie.
 *   - **Un 401 es «este enlace ya no sirve»**, uno solo para todo (AC-08…10); un
 *     400 va al campo (AC-13).
 *   - **Al guardar se va a `/ingresar` con el aviso y sin sesión** (AC-06), y el
 *     foco pasa al aviso (AC-20).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import { ProveedorSesion } from '@/app/Sesion'
import { Ingresar } from './Ingresar'
import { Restablecer } from './Restablecer'

const restablecer = vi.fn()

vi.mock('@/api/portal', async (original) => ({
  ...(await original<typeof import('@/api/portal')>()),
  restablecerClave: (datos: unknown) => restablecer(datos),
  quienSoy: () => Promise.resolve({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez' }),
}))

const TOKEN = 'unTokenDePrueba_-43caracteresDeAzarBase64Url'

function montar(entrada = `/restablecer?token=${TOKEN}`) {
  const enrutador = createMemoryRouter(
    [
      { path: '/restablecer', element: <Restablecer /> },
      { path: '/ingresar', element: <Ingresar /> },
      { path: '/clave', element: <p>Pedir el enlace</p> },
    ],
    { initialEntries: [entrada] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProveedorSesion>
        <RouterProvider router={enrutador} />
      </ProveedorSesion>
    </QueryClientProvider>,
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
  restablecer.mockReset()
  localStorage.clear()
})

afterEach(cleanup)

describe('elegir la contraseña nueva en el portal', () => {
  it('AC-16 · el token sale de la barra al cargar, con replace, y abrir no llama a nadie', () => {
    const enrutador = montar()

    expect(enrutador.state.location.pathname).toBe('/restablecer')
    expect(enrutador.state.location.search).toBe('')
    expect(enrutador.state.historyAction).toBe('REPLACE')
    expect(restablecer).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Elige una contraseña nueva.' })).toBeTruthy()
  })

  it('los dos campos tienen etiqueta, la regla a la vista y su ojo', () => {
    montar()
    const nueva = screen.getByLabelText(/^Contraseña nueva/) as HTMLInputElement
    expect(nueva.type).toBe('password')
    expect(screen.getByText(/al menos 8 caracteres/i)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Mostrar la contraseña' })).toHaveLength(2)
  })

  it('sin token en la dirección dice que el enlace está incompleto y ofrece pedir otro', () => {
    montar('/restablecer')
    expect(screen.getByRole('heading', { name: 'El enlace está incompleto.' })).toBeTruthy()
    expect(screen.getByText(/cópialo entero desde el correo/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' }).getAttribute('href')).toBe(
      '/clave',
    )
    expect(screen.queryByLabelText(/^Contraseña nueva/)).toBeNull()
  })

  it('AC-12 · si no coinciden, el error va en la repetición y no se llama al servidor', async () => {
    montar()
    escribir('una-clave-larga', 'otra-clave-larga')
    await guardar()

    const repetir = screen.getByLabelText('Repetir contraseña')
    expect(repetir.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeTruthy()
    expect(restablecer).not.toHaveBeenCalled()
  })

  it('AC-11 · menos de 8, o espacios en los bordes, se paran en el campo', async () => {
    montar()
    escribir('corta', 'corta')
    await guardar()
    expect(screen.getByText('La contraseña necesita al menos 8 caracteres.')).toBeTruthy()

    escribir(' una-clave-larga', ' una-clave-larga')
    await guardar()
    expect(screen.getByText(/no puede empezar ni terminar con un espacio/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Contraseña nueva/).getAttribute('aria-invalid')).toBe('true')
    expect(restablecer).not.toHaveBeenCalled()
  })

  it('F-01 · más de 72 bytes se para en el campo, en español y sin llamar al servidor', async () => {
    montar()
    // 40 «ñ»: 40 letras y 80 bytes
    escribir('ñ'.repeat(40), 'ñ'.repeat(40))
    await guardar()
    expect(
      screen.getByText(
        'La contraseña es demasiado larga. Usa como máximo 72 caracteres; las letras con tilde, la ñ y los emojis cuentan por más de uno.',
      ),
    ).toBeTruthy()
    expect(screen.getByLabelText(/^Contraseña nueva/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByText(/bytes/i)).toBeNull()
    expect(restablecer).not.toHaveBeenCalled()

    // 72 justos sí se mandan
    restablecer.mockReturnValue(new Promise<void>(() => {}))
    escribir('ñ'.repeat(36), 'ñ'.repeat(36))
    await guardar()
    expect(restablecer).toHaveBeenCalledWith({ token: TOKEN, contrasena: 'ñ'.repeat(36) })
  })

  it('AC-08 · AC-20 · un 401 dice que el enlace ya no sirve, lleva el foco ahí y ofrece otro', async () => {
    restablecer.mockRejectedValue(
      new ErrorApi(401, 'Este enlace ya no sirve. Pide uno nuevo.', null),
    )
    montar()
    escribir('una-clave-larga', 'una-clave-larga')
    await guardar()

    const titular = screen.getByRole('heading', { name: 'Este enlace ya no sirve.' })
    expect(document.activeElement).toBe(titular)
    expect(screen.getByText(/^Pide uno nuevo\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' }).getAttribute('href')).toBe(
      '/clave',
    )
  })

  it('AC-13 · un 400 del servidor va al campo y deja el formulario para corregir', async () => {
    restablecer.mockRejectedValue(
      new ErrorApi(400, 'Elige una contraseña distinta a la anterior', null),
    )
    montar()
    escribir('la-de-siempre', 'la-de-siempre')
    await guardar()

    expect(screen.getByText('Elige una contraseña distinta a la anterior')).toBeTruthy()
    expect(screen.getByLabelText(/^Contraseña nueva/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeTruthy()
  })

  it('un fallo de red se dice con un aviso y el formulario sigue ahí', async () => {
    restablecer.mockRejectedValue(new ErrorApi(0, 'No pudimos conectar. Revisa tu conexión.'))
    montar()
    escribir('una-clave-larga', 'una-clave-larga')
    await guardar()

    expect(screen.getByRole('alert').textContent).toMatch(/no pudimos guardar tu contraseña/i)
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeTruthy()
  })

  it('mientras se guarda, el formulario queda apagado', async () => {
    let soltar: () => void = () => {}
    restablecer.mockReturnValue(new Promise<void>((r) => (soltar = r)))
    montar()
    escribir('una-clave-larga', 'una-clave-larga')
    await guardar()

    const boton = screen.getByRole('button', { name: 'Guardando…' }) as HTMLButtonElement
    expect(boton.closest('fieldset')?.disabled).toBe(true)
    fireEvent.click(boton)
    expect(restablecer).toHaveBeenCalledTimes(1)
    await act(async () => {
      soltar()
    })
  })

  it('AC-06 · al guardar manda el token del enlace y lleva a entrar con el aviso, sin sesión', async () => {
    restablecer.mockResolvedValue(undefined)
    // Había una sesión abierta en este navegador: tiene que cerrarse
    localStorage.setItem('renaser_portal_token', 'una-sesion-vieja')
    const enrutador = montar()
    escribir('una-clave-larga', 'una-clave-larga')
    await guardar()

    expect(restablecer).toHaveBeenCalledWith({ token: TOKEN, contrasena: 'una-clave-larga' })
    expect(enrutador.state.location.pathname).toBe('/ingresar')
    const aviso = screen.getByRole('status')
    expect(aviso.textContent).toContain('Contraseña cambiada exitosamente')
    expect(document.activeElement).toBe(aviso)
    expect(localStorage.getItem('renaser_portal_token')).toBeNull()
    expect(screen.getByLabelText('Correo')).toBeTruthy()
  })
})
