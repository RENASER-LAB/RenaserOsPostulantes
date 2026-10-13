/**
 * «Recibe tus novedades por WhatsApp» (V73): los estados de la tarjeta y el botón.
 *
 * AC-03 (sale con su número, el botón y el consentimiento), AC-04 (no sale fuera de la
 * beta, ni cuando le toca algo), AC-05 (sin celular lo pide), AC-06 (el botón prepara
 * y abre el enlace), AC-12 (dejar de recibir) y AC-13 (dado de baja).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { MiPostulacion, WhatsappDelProceso } from '@/api/tipos'
import { ErrorApi } from '@/api/cliente'
import { Seguimiento } from './Seguimiento'
import { CONSENTIMIENTO_WHATSAPP, TarjetaWhatsapp } from './TarjetaWhatsapp'

const api = vi.hoisted(() => ({
  escribirPorWhatsapp: vi.fn(),
  dejarDeRecibirPorWhatsapp: vi.fn(),
  cambiarCelular: vi.fn(),
}))

vi.mock('@/api/portal', () => api)

const ENLACE = 'https://wa.me/51928439930?text=Hola%2C%20soy%20Ana'

function postulacion(estado: string, whatsapp: WhatsappDelProceso | null): MiPostulacion {
  return {
    uuid: 'b6b7d2c4-0000-4000-8000-000000000001',
    vacante: 'Asistente Contable',
    empresa: 'RENASER CONSULTING S.A.C.',
    estado,
    estadoNombre: estado,
    grupoPrioridad: null,
    diasSinCambio: 1,
    creadoEn: '2026-10-10T15:00:00Z',
    instrumentoEtapaTecnica: null,
    avisosSinLeer: 0,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    miPretension: null,
    whatsapp,
  } as MiPostulacion
}

const SIN_VINCULAR: WhatsappDelProceso = { disponible: true, estado: 'SIN_VINCULAR', numero: '+51 987 654 321' }

function montar(contenido: React.ReactNode) {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter>{contenido}</MemoryRouter>
    </QueryClientProvider>,
  )
}

let pestana: { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> }

beforeEach(() => {
  pestana = { opener: window, location: { href: '' }, close: vi.fn() }
  vi.spyOn(window, 'open').mockImplementation(() => pestana as unknown as Window)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  api.escribirPorWhatsapp.mockReset()
  api.dejarDeRecibirPorWhatsapp.mockReset()
  api.cambiarCelular.mockReset()
})

describe('la tarjeta de WhatsApp mientras espera', () => {
  it('AC-03 · sin vincular: su número, el botón verde y el consentimiento', () => {
    montar(<TarjetaWhatsapp postulacion={postulacion('PERFIL_CALIFICANDO', SIN_VINCULAR)} />)

    expect(screen.getByRole('heading', { name: 'Recibe tus novedades por WhatsApp' })).toBeTruthy()
    expect(screen.getByText('+51 987 654 321').tagName).toBe('B')
    expect(screen.getByText(/y te contaremos cómo va tu proceso/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Escribir por WhatsApp' })).toBeTruthy()
    // Lleva al campo del celular, no al principio del perfil (observación de la QA).
    expect(screen.getByRole('link', { name: 'Cámbialo en Mi cuenta' }).getAttribute('href')).toBe(
      '/perfil#celular',
    )
    expect(screen.getByText(/¿No es tu número\?/)).toBeTruthy()
    expect(screen.getByText(CONSENTIMIENTO_WHATSAPP)).toBeTruthy()
  })

  it('AC-04 · fuera de la beta o en otra empresa no hay tarjeta', () => {
    const { container } = montar(
      <TarjetaWhatsapp
        postulacion={postulacion('PERFIL_CALIFICANDO', { disponible: false, estado: null, numero: null })}
      />,
    )
    expect(container.textContent).toBe('')
  })

  it('AC-06 · el botón prepara el enlace, abre WhatsApp en otra pestaña y queda pendiente', async () => {
    api.escribirPorWhatsapp.mockResolvedValue({
      enlace: ENLACE,
      whatsapp: { disponible: true, estado: 'PENDIENTE', numero: '+51 987 654 321' },
    })
    montar(<TarjetaWhatsapp postulacion={postulacion('PERFIL_CALIFICANDO', SIN_VINCULAR)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Escribir por WhatsApp' }))

    // La pestaña se pidió dentro del clic, antes de esperar al servidor.
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    await waitFor(() => expect(pestana.location.href).toBe(ENLACE))
    expect(pestana.opener).toBeNull()
    expect(api.escribirPorWhatsapp).toHaveBeenCalledWith('b6b7d2c4-0000-4000-8000-000000000001')
    expect(await screen.findByText(/Aún no recibimos tu mensaje/)).toBeTruthy()
    expect(screen.getByText(/¿Usas otro número\?/)).toBeTruthy()
  })

  it('mientras se prepara el botón se apaga; si falla, lo dice y cierra la pestaña', async () => {
    let fallar: (causa: unknown) => void = () => {}
    api.escribirPorWhatsapp.mockReturnValue(new Promise((_, rechazar) => (fallar = rechazar)))
    montar(<TarjetaWhatsapp postulacion={postulacion('PERFIL_CALIFICANDO', SIN_VINCULAR)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Escribir por WhatsApp' }))

    const preparando = await screen.findByRole('button', { name: 'Preparando el enlace…' })
    expect((preparando as HTMLButtonElement).disabled).toBe(true)
    fallar(new ErrorApi(503, 'El servidor no responde'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('No pudimos preparar el enlace. Inténtalo de nuevo.')
    expect(pestana.close).toHaveBeenCalled()
  })

  it('si el navegador no dio la pestaña, el enlace queda a la vista', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    api.escribirPorWhatsapp.mockResolvedValue({
      enlace: ENLACE,
      whatsapp: { disponible: true, estado: 'PENDIENTE', numero: '+51 987 654 321' },
    })
    montar(<TarjetaWhatsapp postulacion={postulacion('PERFIL_CALIFICANDO', SIN_VINCULAR)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Escribir por WhatsApp' }))

    const enlace = await screen.findByRole('link', { name: 'Ábrelo desde aquí' })
    expect(enlace.getAttribute('href')).toBe(ENLACE)
    expect(enlace.getAttribute('target')).toBe('_blank')
  })

  it('AC-05 · sin celular lo pide con la misma regla, lo guarda y sigue', async () => {
    api.cambiarCelular.mockResolvedValue({ telefono: '+51987654321', paraMostrar: '+51 987 654 321' })
    api.escribirPorWhatsapp.mockResolvedValue({
      enlace: ENLACE,
      whatsapp: { disponible: true, estado: 'PENDIENTE', numero: '+51 987 654 321' },
    })
    montar(
      <TarjetaWhatsapp
        postulacion={postulacion('PERFIL_CALIFICANDO', { disponible: true, estado: 'SIN_CELULAR', numero: null })}
      />,
    )

    const campo = screen.getByLabelText(/^Tu celular \(WhatsApp\)/)
    const boton = screen.getByRole('button', { name: 'Guardar y escribir por WhatsApp' })

    // Uno que no vale: el error junto al campo, y no se abre nada ni se llama a nadie.
    fireEvent.change(campo, { target: { value: '54 123456' } })
    fireEvent.click(boton)
    expect(
      await screen.findByText(
        'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo',
      ),
    ).toBeTruthy()
    expect(window.open).not.toHaveBeenCalled()
    expect(api.cambiarCelular).not.toHaveBeenCalled()

    fireEvent.change(campo, { target: { value: '987 654 321' } })
    fireEvent.click(boton)

    await waitFor(() => expect(pestana.location.href).toBe(ENLACE))
    expect(api.cambiarCelular).toHaveBeenCalledWith('987 654 321')
    expect(api.escribirPorWhatsapp).toHaveBeenCalled()
  })

  it('conectado: el número enmascarado y «Dejar de recibir», que cierra el vínculo (AC-12)', async () => {
    api.dejarDeRecibirPorWhatsapp.mockResolvedValue({
      disponible: true,
      estado: 'REVOCADO',
      numero: '+51 987 654 321',
    })
    montar(
      <TarjetaWhatsapp
        postulacion={postulacion('PERFIL_CALIFICANDO', { disponible: true, estado: 'ACTIVO', numero: '+51 9•• ••• 321' })}
      />,
    )

    const conectado = screen.getByText(
      (_, el) => el?.tagName === 'B' && /^Conectado por WhatsApp \(/.test(el.textContent ?? ''),
    )
    expect(conectado.textContent).toBe('Conectado por WhatsApp (+51 9•• ••• 321).')
    // El número va en su propia pieza, que no se parte entre «+51» y el resto.
    expect(screen.getByText('+51 9•• ••• 321').tagName).toBe('SPAN')
    expect(screen.getByText(/Escríbenos cuando quieras para saber cómo va tu proceso/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Escribir por WhatsApp' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Dejar de recibir' }))

    await waitFor(() => expect(api.dejarDeRecibirPorWhatsapp).toHaveBeenCalled())
    // Vuelve a ofrecerse, como al principio.
    expect(await screen.findByRole('button', { name: 'Escribir por WhatsApp' })).toBeTruthy()
  })

  it('AC-13 · dado de baja: lo dice, sin botón', () => {
    montar(
      <TarjetaWhatsapp
        postulacion={postulacion('PERFIL_CALIFICANDO', { disponible: true, estado: 'SUPRIMIDO', numero: null })}
      />,
    )

    expect(screen.getByText('Este número se dio de baja de nuestros mensajes')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('en el recuadro de espera del recorrido', () => {
  it('AC-03 · sale debajo de «No tienes que hacer nada.»', () => {
    montar(<Seguimiento postulacion={postulacion('PERFIL_CALIFICANDO', SIN_VINCULAR)} />)

    expect(screen.getByText('Estamos calificando tus respuestas')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Escribir por WhatsApp' })).toBeTruthy()
  })

  it('AC-04 · cuando le toca algo no sale: manda la acción', () => {
    montar(<Seguimiento postulacion={postulacion('PRUEBA_TURNO_CANDIDATO', SIN_VINCULAR)} />)

    expect(screen.getByRole('link', { name: 'Abrir prueba' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Escribir por WhatsApp' })).toBeNull()
  })

  it('AC-17 · «Estamos revisando tu postulación» dice «No tienes que hacer nada.» una sola vez', () => {
    const { container } = montar(<Seguimiento postulacion={postulacion('POSTULADA', null)} />)

    expect(container.textContent?.match(/No tienes que hacer nada\./g)).toHaveLength(1)
  })
})
