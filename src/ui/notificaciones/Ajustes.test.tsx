/**
 * «Ajustes de avisos» (V92; la tuerca de la campana desde el 25/11/2026): la ventana con los
 * tres canales, lo que la guía le pide (abrir y activar, abrir en el número) y el puntito de
 * la tuerca. Los textos son los de la spec y la maqueta.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import type { Notificaciones, WhatsappDeLaCuenta } from '@/api/tipos'
import {
  CLAVE_NOTIFICACIONES,
  diaCorto,
  VentanaDeAjustes,
  whatsappPorActivar,
  type ManejoDeAjustes,
} from './Ajustes'

vi.mock('@/api/portal', () => ({
  misNotificaciones: vi.fn(),
  activarWhatsapp: vi.fn(),
  apagarWhatsapp: vi.fn(),
  cambiarNotificaciones: vi.fn(),
  cambiarCelular: vi.fn(),
}))

import { activarWhatsapp, apagarWhatsapp, cambiarCelular, cambiarNotificaciones, misNotificaciones } from '@/api/portal'

const NUMERO = '+51 987 654 321'

function whatsapp(cambios: Partial<WhatsappDeLaCuenta> = {}): WhatsappDeLaCuenta {
  return {
    disponible: true,
    estado: 'APAGADO',
    numero: NUMERO,
    comprobado: false,
    porBaja: false,
    bajaEn: null,
    cambioDeNumero: false,
    ...cambios,
  }
}

function notificaciones(
  wa: Partial<WhatsappDeLaCuenta> = {},
  otras: Partial<Omit<Notificaciones, 'whatsapp'>> = {},
): Notificaciones {
  return {
    whatsapp: whatsapp(wa),
    correo: { activo: true, destino: 'lucia.paredes@correo.com' },
    portal: { activo: true },
    mensaje: { mostrar: false, situacion: 'PRIMERA_VEZ' },
    guiaVista: true,
    ...otras,
  }
}

/** Lo que hace la campana con la ventana: abrirla, o abrirla y activar, o en el número. */
function Mandos({ alVolver }: { alVolver: () => void }) {
  const ajustes = useRef<ManejoDeAjustes>(null)
  return (
    <>
      <button type="button" onClick={() => ajustes.current?.abrir()}>
        Tuerca
      </button>
      <button type="button" onClick={() => ajustes.current?.abrirYActivar()}>
        Activar desde la guía
      </button>
      <button type="button" onClick={() => ajustes.current?.abrirEnElNumero()}>
        Al número desde la guía
      </button>
      <VentanaDeAjustes ref={ajustes} alVolverALosAvisos={alVolver} />
    </>
  )
}

function montar(datos: Notificaciones, { yaCargados = false, alVolver = vi.fn() } = {}) {
  vi.mocked(misNotificaciones).mockResolvedValue(datos)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Desde la guía los datos ya están: los pidió la campana para decidir qué paso enseñar.
  if (yaCargados) cache.setQueryData(CLAVE_NOTIFICACIONES, datos)
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <Mandos alVolver={alVolver} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { cache, alVolver }
}

const dialogo = () => document.querySelector('dialog') as HTMLDialogElement

/** Abre la ventana con la tuerca y devuelve su contenido, ya cargado. */
async function abrirLaVentana() {
  fireEvent.click(screen.getByRole('button', { name: 'Tuerca' }))
  const ventana = within(dialogo())
  await ventana.findByText('Te avisamos cuando cambia tu proceso o cuando te toca hacer algo. Nunca publicidad.')
  return ventana
}

beforeEach(() => {
  // jsdom todavía no implementa `showModal` ni `close` de `<dialog>`.
  const prototipo = window.HTMLDialogElement.prototype
  if (typeof prototipo.showModal !== 'function') {
    prototipo.showModal = function abrir(this: HTMLDialogElement) {
      this.open = true
    }
    prototipo.close = function cerrar(this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
})
afterEach(cleanup)

describe('el puntito de la tuerca', () => {
  it('sale cuando WhatsApp se puede activar: apagado, sin número, no llegó, por BAJA o con número nuevo', () => {
    expect(whatsappPorActivar(notificaciones())).toBe(true)
    expect(whatsappPorActivar(notificaciones({ estado: 'SIN_NUMERO', numero: null }))).toBe(true)
    expect(whatsappPorActivar(notificaciones({ estado: 'NO_LLEGO' }))).toBe(true)
    expect(whatsappPorActivar(notificaciones({ porBaja: true, comprobado: true }))).toBe(true)
    expect(whatsappPorActivar(notificaciones({ cambioDeNumero: true }))).toBe(true)
  })

  it('no sale con WhatsApp activo o esperando su mensaje, sin la beta, ni sin datos', () => {
    expect(whatsappPorActivar(notificaciones({ estado: 'ACTIVO', comprobado: true }))).toBe(false)
    expect(whatsappPorActivar(notificaciones({ estado: 'ESPERANDO' }))).toBe(false)
    expect(whatsappPorActivar(notificaciones({ disponible: false }))).toBe(false)
    expect(whatsappPorActivar(undefined)).toBe(false)
  })

  it('la fecha de la BAJA se lee por partes: un día suelto no cae en el anterior', () => {
    expect(diaCorto('2026-11-12')).toBe('12 nov')
    expect(diaCorto('2026-09-01')).toBe('1 set')
    expect(diaCorto(null)).toBeNull()
  })
})

describe('la ventana', () => {
  it('se llama «Ajustes de avisos», vale para todos sus procesos y no pide nada hasta abrirse', async () => {
    montar(notificaciones())
    expect(misNotificaciones).not.toHaveBeenCalled()

    const ventana = await abrirLaVentana()

    expect(dialogo().open).toBe(true)
    expect(ventana.getByRole('heading', { name: 'Ajustes de avisos' })).toBeTruthy()
    expect(ventana.getByText('Para todos tus procesos.')).toBeTruthy()
    expect(misNotificaciones).toHaveBeenCalledTimes(1)
  })

  it('la × la cierra; en el teléfono, la flecha la cierra y vuelve a los avisos', async () => {
    const { alVolver } = montar(notificaciones())
    let ventana = await abrirLaVentana()
    fireEvent.click(ventana.getByRole('button', { name: 'Cerrar' }))
    expect(dialogo().open).toBe(false)
    expect(alVolver).not.toHaveBeenCalled()

    ventana = await abrirLaVentana()
    fireEvent.click(ventana.getByRole('button', { name: 'Volver a tus avisos' }))
    expect(dialogo().open).toBe(false)
    expect(alVolver).toHaveBeenCalledTimes(1)
  })

  it('QA-05 · «Cámbialo en Mi cuenta» la cierra en el mismo clic: no se queda encima de «Mi cuenta»', async () => {
    montar(notificaciones())
    const ventana = await abrirLaVentana()

    fireEvent.click(ventana.getByRole('link', { name: 'Cámbialo en Mi cuenta' }))

    expect(dialogo().open).toBe(false)
  })

  it('QA-05 · el enlace al chat de WhatsApp, que abre otra pestaña, la deja abierta', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })
    montar(notificaciones())
    const ventana = await abrirLaVentana()
    fireEvent.click(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }))
    const alChat = await ventana.findByRole('link', { name: 'Ábrelo desde aquí' })
    // jsdom no sabe abrir pestañas: el clic se queda en la página.
    const sinIrse = (evento: Event) => evento.preventDefault()
    document.addEventListener('click', sinIrse, true)
    try {
      fireEvent.click(alChat)
    } finally {
      document.removeEventListener('click', sinIrse, true)
    }

    expect(dialogo().open).toBe(true)
  })
})

describe('encender WhatsApp', () => {
  it('AC-05 · con el número comprobado: «Activando…» y luego activo con un clic, sin abrir el chat', async () => {
    const abrir = vi.spyOn(window, 'open')
    let terminar: (n: Awaited<ReturnType<typeof activarWhatsapp>>) => void = () => undefined
    vi.mocked(activarWhatsapp).mockReturnValue(new Promise((r) => (terminar = r)))
    montar(notificaciones({ porBaja: true, comprobado: true, bajaEn: '2026-11-12' }))
    const ventana = await abrirLaVentana()
    expect(ventana.getByText(/Lo apagaste escribiendo BAJA el 12 nov/)).toBeTruthy()

    fireEvent.click(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }))
    expect(await ventana.findByText('Activando…')).toBeTruthy()
    expect(abrir).not.toHaveBeenCalled()

    terminar({
      resultado: 'ACTIVADO',
      enlace: null,
      confirmacionEnviada: true,
      notificaciones: notificaciones({ estado: 'ACTIVO', comprobado: true, numero: '+51 9•• ••• 321' }),
    })
    expect(
      await ventana.findByText(
        'Te enviamos un mensaje para confirmarlo. Te avisamos de todos tus procesos y puedes escribirnos tus dudas.',
      ),
    ).toBeTruthy()
    expect(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('AC-02 · sin comprobar: la pestaña se pide antes de esperar y se lleva al chat; queda esperando su mensaje', async () => {
    const pestana = { opener: {}, location: { href: '' }, close: vi.fn() }
    const abrir = vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })
    montar(notificaciones())
    const ventana = await abrirLaVentana()
    expect(ventana.getByText(/Al activarlo aceptas recibir por WhatsApp las novedades de tus procesos/)).toBeTruthy()

    fireEvent.click(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }))

    expect(abrir).toHaveBeenCalledWith('', '_blank')
    await waitFor(() => expect(pestana.location.href).toBe('https://wa.me/51928439930?text=Hola'))
    expect(pestana.opener).toBeNull()
    expect(await ventana.findByText(/Te abrimos WhatsApp\. Envía el mensaje desde el/)).toBeTruthy()
    expect(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('desde la guía: abre la ventana y activa en el mismo clic, con la pestaña pedida antes de esperar', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    let terminar: (n: Awaited<ReturnType<typeof activarWhatsapp>>) => void = () => undefined
    vi.mocked(activarWhatsapp).mockReturnValue(new Promise((r) => (terminar = r)))
    montar(notificaciones(), { yaCargados: true })

    fireEvent.click(screen.getByRole('button', { name: 'Activar desde la guía' }))

    expect(dialogo().open).toBe(true)
    expect(abrir).toHaveBeenCalledWith('', '_blank')
    expect(activarWhatsapp).toHaveBeenCalledTimes(1)
    // Al abrirse la ventana vuelve a pedir el estado; esa lectura, anterior al cambio, no pisa
    // lo que contesta la activación aunque llegue después.
    await waitFor(() => expect(misNotificaciones).toHaveBeenCalled())
    terminar({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })
    // El navegador no dio la pestaña: el enlace queda a la vista.
    expect(await within(dialogo()).findByRole('link', { name: 'Ábrelo desde aquí' })).toBeTruthy()
    expect(within(dialogo()).getByText(/Te abrimos WhatsApp\. Envía el mensaje desde el/)).toBeTruthy()
  })

  it('desde la guía, sin número: abre la ventana con el foco en el campo del celular y no activa nada', async () => {
    montar(notificaciones({ estado: 'SIN_NUMERO', numero: null }), { yaCargados: true })

    fireEvent.click(screen.getByRole('button', { name: 'Al número desde la guía' }))

    const campo = await within(dialogo()).findByLabelText(/Agrega tu celular para recibir avisos por WhatsApp/)
    await waitFor(() => expect(document.activeElement).toBe(campo))
    expect(activarWhatsapp).not.toHaveBeenCalled()
  })

  it('AC-13 · si el bot falla: «No pudimos activarlo. Vuelve a intentarlo en un momento.»', async () => {
    vi.mocked(activarWhatsapp).mockRejectedValue(
      new ErrorApi(503, 'No pudimos activarlo. Vuelve a intentarlo en un momento.', { codigo: 'NO_SE_PUDO_ACTIVAR' }),
    )
    montar(notificaciones({ comprobado: true }))
    const ventana = await abrirLaVentana()

    fireEvent.click(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }))

    expect((await ventana.findByRole('alert')).textContent).toBe(
      'No pudimos activarlo. Vuelve a intentarlo en un momento.',
    )
  })

  it('AC-04 · no llegó su mensaje: lo dice y «Reintentar» vuelve a activarlo', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })
    montar(notificaciones({ estado: 'NO_LLEGO' }))
    const ventana = await abrirLaVentana()

    expect(ventana.getByRole('alert').textContent).toContain(`No nos llegó tu mensaje desde el ${NUMERO}.`)
    fireEvent.click(ventana.getByRole('button', { name: 'Reintentar' }))
    expect(activarWhatsapp).toHaveBeenCalledTimes(1)
  })

  it('AC-12 · cambió de número: se le dice que lo active y lo compruebe con un mensaje', async () => {
    montar(notificaciones({ cambioDeNumero: true, numero: '+51 912 345 678' }))
    const ventana = await abrirLaVentana()

    expect(
      ventana.getByText('Cambiaste tu número. Actívalo y envía un mensaje desde el nuevo para comprobarlo.'),
    ).toBeTruthy()
  })
})

describe('apagar y los otros canales', () => {
  it('AC-07 · apagar WhatsApp lo cierra para todos sus procesos', async () => {
    vi.mocked(apagarWhatsapp).mockResolvedValue(notificaciones({ comprobado: true }))
    montar(notificaciones({ estado: 'ACTIVO', comprobado: true }))
    const ventana = await abrirLaVentana()
    const interruptor = ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' })
    expect(interruptor.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(interruptor)

    await waitFor(() => expect(apagarWhatsapp).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(ventana.getByRole('switch', { name: 'Notificaciones por WhatsApp' }).getAttribute('aria-checked')).toBe(
        'false',
      ),
    )
    expect(ventana.getByText(/Al activarlo aceptas recibir por WhatsApp/)).toBeTruthy()
  })

  it('AC-08 · apagar el correo lo guarda y dice qué deja de llegar', async () => {
    vi.mocked(cambiarNotificaciones).mockResolvedValue(
      notificaciones({}, { correo: { activo: false, destino: 'lucia.paredes@correo.com' } }),
    )
    montar(notificaciones())
    const ventana = await abrirLaVentana()
    expect(ventana.getByText('lucia.paredes@correo.com')).toBeTruthy()

    fireEvent.click(ventana.getByRole('switch', { name: 'Notificaciones por correo' }))

    expect(cambiarNotificaciones).toHaveBeenCalledWith({ correo: false })
    expect(
      await ventana.findByText('No te llegarán por correo los plazos de tus pruebas. Los verás aquí, en el portal.'),
    ).toBeTruthy()
  })

  it('AC-09 · con la campana apagada, lo dice', async () => {
    montar(notificaciones({}, { portal: { activo: false } }))
    const ventana = await abrirLaVentana()

    expect(
      ventana.getByText('La campana dejará de marcar novedades. Tus procesos siguen mostrando su estado.'),
    ).toBeTruthy()
  })

  it('sin la beta no hay fila de WhatsApp; correo y portal siguen', async () => {
    montar(notificaciones({ disponible: false }))
    const ventana = await abrirLaVentana()

    expect(ventana.queryByRole('switch', { name: 'Notificaciones por WhatsApp' })).toBeNull()
    expect(ventana.getByRole('switch', { name: 'Notificaciones por correo' })).toBeTruthy()
    expect(ventana.getByRole('switch', { name: 'Notificaciones en el portal' })).toBeTruthy()
  })
})

describe('sin número', () => {
  it('AC-11 · sin interruptor: el campo y «Guardar»; un número de otra cuenta se dice junto al campo', async () => {
    vi.mocked(cambiarCelular).mockRejectedValue(
      new ErrorApi(409, 'Ese número ya está en otra cuenta. Usa otro o entra con esa cuenta.', {
        codigo: 'TELEFONO_EN_USO',
      }),
    )
    montar(notificaciones({ estado: 'SIN_NUMERO', numero: null }))
    const ventana = await abrirLaVentana()

    expect(ventana.queryByRole('switch', { name: 'Notificaciones por WhatsApp' })).toBeNull()
    expect(ventana.getByText('Sin número')).toBeTruthy()
    fireEvent.change(ventana.getByLabelText(/Agrega tu celular para recibir avisos por WhatsApp/), {
      target: { value: '987654321' },
    })
    fireEvent.click(ventana.getByRole('button', { name: 'Guardar' }))

    expect(await ventana.findByText('Ese número ya está en otra cuenta. Usa otro o entra con esa cuenta.')).toBeTruthy()
    expect(cambiarCelular).toHaveBeenCalledTimes(1)
  })
})
