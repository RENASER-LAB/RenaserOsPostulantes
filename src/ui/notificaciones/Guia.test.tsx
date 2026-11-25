/**
 * La guía de los avisos (25/11/2026): tres pasos sobre la campana, una vez por cuenta.
 *
 * Se monta la campana entera, que es quien la pinta, y se pide como lo hace «Mis procesos».
 * Lo que se cuida: los textos de la maqueta, las variantes del final (por activar, esperando
 * su mensaje, activo y sin WhatsApp), que cualquier salida la dé por vista en el servidor, el
 * foco (al botón principal, atrapado en la burbuja y de vuelta a la campana) y que «Activar
 * WhatsApp» y «Abrir WhatsApp» hagan lo del interruptor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { Notificaciones, WhatsappDeLaCuenta } from '@/api/tipos'
import { Campana } from '@/ui/Campana'
import { colocar } from './Guia'
import { olvidarLaGuia, pedirLaGuia } from './guiaPedida'

vi.mock('@/app/Sesion', () => ({ useSesion: () => ({ hayCuenta: true }) }))

vi.mock('@/api/portal', () => ({
  misAvisos: vi.fn(async () => ({ sinLeer: 1, avisos: [] })),
  marcarAvisosLeidos: vi.fn(),
  marcarAvisoLeido: vi.fn(),
  misNotificaciones: vi.fn(),
  marcarGuiaVista: vi.fn(async () => undefined),
  activarWhatsapp: vi.fn(),
  apagarWhatsapp: vi.fn(),
  cambiarNotificaciones: vi.fn(),
  cambiarCelular: vi.fn(),
}))

import { activarWhatsapp, marcarGuiaVista, misNotificaciones } from '@/api/portal'

function notificaciones(wa: Partial<WhatsappDeLaCuenta> = {}): Notificaciones {
  return {
    whatsapp: {
      disponible: true,
      estado: 'APAGADO',
      numero: '+51 987 654 321',
      comprobado: false,
      porBaja: false,
      bajaEn: null,
      cambioDeNumero: false,
      ...wa,
    },
    correo: { activo: true, destino: 'ana@correo.pe' },
    portal: { activo: true },
    mensaje: { mostrar: false, situacion: 'PRIMERA_VEZ' },
    guiaVista: false,
  }
}

async function empezar(datos: Notificaciones) {
  vi.mocked(misNotificaciones).mockResolvedValue(datos)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <Campana />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: /^Avisos/ })
  // Lo que hace «Mis procesos» al entrar con alguna postulación y la guía sin ver.
  act(() => pedirLaGuia())
  return screen.findByRole('dialog', { name: 'Aquí te avisamos de todo' })
}

const boton = (dentro: HTMLElement, nombre: string) => within(dentro).getByRole('button', { name: nombre })
const guia = () => document.querySelector('dialog[aria-modal="true"]') as HTMLElement | null

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
afterEach(() => {
  cleanup()
  olvidarLaGuia()
})

describe('la guía, paso a paso', () => {
  it('1 · la campana; 2 · el panel abierto y la tuerca; 3 · WhatsApp. «Ahora no» la da por vista', async () => {
    const paso1 = await empezar(notificaciones())

    expect(paso1.getAttribute('aria-modal')).toBe('true')
    expect((paso1 as HTMLDialogElement).open).toBe(true)
    expect(within(paso1).getByText('1 de 3')).toBeTruthy()
    expect(within(paso1).getByText('Cada vez que tu proceso avanza, la campana se marca con un número.')).toBeTruthy()
    expect(boton(paso1, 'Saltar guía')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(boton(paso1, 'Siguiente')))
    // Con la campana cerrada.
    expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull()

    fireEvent.click(boton(paso1, 'Siguiente'))
    const paso2 = await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
    expect(within(paso2).getByText('2 de 3')).toBeTruthy()
    expect(within(paso2).getByText('Enciende o apaga cada canal cuando quieras.')).toBeTruthy()
    expect(within(paso2).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'WhatsApp',
      'Correo',
      'En el portal',
    ])
    // La campana se abre y la tuerca está a la vista.
    const panel = screen.getByRole('dialog', { name: 'Tus avisos' })
    expect(within(panel).getByRole('button', { name: 'Ajustes de avisos' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(boton(paso2, 'Siguiente')))

    fireEvent.click(boton(paso2, 'Siguiente'))
    const paso3 = await screen.findByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' })
    expect(within(paso3).getByText('3 de 3')).toBeTruthy()
    expect(within(paso3).getByText('Y pregúntanos tus dudas. Correo y portal ya están encendidos.')).toBeTruthy()
    expect(
      within(paso3).getByText(
        'Al activarlo aceptas recibir por WhatsApp las novedades de tus procesos. Escribe BAJA cuando quieras dejarlo.',
      ),
    ).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(boton(paso3, 'Activar WhatsApp')))
    expect(boton(paso3, 'Atrás')).toBeTruthy()

    fireEvent.click(boton(paso3, 'Ahora no'))

    await waitFor(() => expect(guia()).toBeNull())
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
    expect(activarWhatsapp).not.toHaveBeenCalled()
    // El foco vuelve a la campana, que se cierra.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Avisos/ })))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())

    // En esta visita no vuelve, la pida quien la pida.
    act(() => pedirLaGuia())
    expect(guia()).toBeNull()
  })

  it('«Atrás» vuelve al paso anterior y en el 1 la campana se cierra otra vez', async () => {
    const paso1 = await empezar(notificaciones())
    fireEvent.click(boton(paso1, 'Siguiente'))
    const paso2 = await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' })

    fireEvent.click(boton(paso2, 'Atrás'))

    expect(await screen.findByRole('dialog', { name: 'Aquí te avisamos de todo' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())
  })

  it('«Saltar guía» y Esc la dan por vista igual', async () => {
    let paso1 = await empezar(notificaciones())
    fireEvent.click(boton(paso1, 'Saltar guía'))
    await waitFor(() => expect(guia()).toBeNull())
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)

    cleanup()
    olvidarLaGuia()
    vi.mocked(marcarGuiaVista).mockClear()
    paso1 = await empezar(notificaciones())

    // Esc: el `cancel` del dialog, que la salta.
    const esc = new Event('cancel', { cancelable: true })
    fireEvent(paso1, esc)

    await waitFor(() => expect(guia()).toBeNull())
    expect(esc.defaultPrevented).toBe(true)
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
  })

  it('Tab no sale de la burbuja: del último botón al primero y al revés', async () => {
    const paso1 = await empezar(notificaciones())
    const saltar = boton(paso1, 'Saltar guía')
    const siguiente = boton(paso1, 'Siguiente')
    await waitFor(() => expect(document.activeElement).toBe(siguiente))

    fireEvent.keyDown(siguiente, { key: 'Tab' })
    expect(document.activeElement).toBe(saltar)

    fireEvent.keyDown(saltar, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(siguiente)
  })
})

/*
  El navegador ignora `focus()` sobre lo que está `visibility: hidden`, y la burbuja lo está
  hasta que se coloca (`data-colocada`, Guia.module.css). jsdom no mira estilos, así que aquí
  se le enseña: un `focus()` dentro de la guía sin colocar no hace nada. Sin esto, la prueba
  pasaba con el foco puesto antes de tiempo, que en el navegador se quedaba en el `<dialog>`.

  Y los cuadros van más despacio que los efectos de React, como en el navegador: así la
  carrera entre los dos (el foco antes de que la burbuja se coloque) sale siempre igual.
*/
function enfocarComoElNavegador() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (alPintar) => setTimeout(() => alPintar(performance.now()), 40) as unknown as number,
  )
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((cuadro) => clearTimeout(cuadro))
  const enfocar = HTMLElement.prototype.focus
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function enfocarSiSeVe(this: HTMLElement, opciones) {
    const laGuia = this.closest('dialog[aria-modal="true"]') as HTMLDialogElement | null
    if (laGuia && (!laGuia.open || !laGuia.hasAttribute('data-colocada'))) return
    enfocar.call(this, opciones)
  })
}

describe('el foco, con la burbuja ya a la vista (QA-06)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('paso 1: al aparecer, el foco está en «Siguiente» y no en el <dialog>; y cada paso lo lleva a su botón', async () => {
    enfocarComoElNavegador()
    const enfocados: { boton: string; colocada: boolean }[] = []
    const anotar = (evento: FocusEvent) => {
      const quien = evento.target as HTMLElement
      const laGuia = quien.closest('dialog[aria-modal="true"]')
      if (laGuia && quien.tagName === 'BUTTON') {
        enfocados.push({ boton: quien.textContent ?? '', colocada: laGuia.hasAttribute('data-colocada') })
      }
    }
    document.addEventListener('focusin', anotar)
    try {
      const paso1 = await empezar(notificaciones())
      await waitFor(() => expect(document.activeElement).toBe(boton(paso1, 'Siguiente')))

      fireEvent.click(boton(paso1, 'Siguiente'))
      const paso2 = await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      await waitFor(() => expect(document.activeElement).toBe(boton(paso2, 'Siguiente')))

      fireEvent.click(boton(paso2, 'Siguiente'))
      const paso3 = await screen.findByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' })
      await waitFor(() => expect(document.activeElement).toBe(boton(paso3, 'Activar WhatsApp')))
    } finally {
      document.removeEventListener('focusin', anotar)
    }
    // Nunca con la burbuja oculta, y uno por paso.
    expect(enfocados).toEqual([
      { boton: 'Siguiente', colocada: true },
      { boton: 'Siguiente', colocada: true },
      { boton: 'Activar WhatsApp', colocada: true },
    ])
  })

  it('igual en el teléfono (390 px) y con movimiento reducido, también al volver con «Atrás»', async () => {
    vi.stubGlobal(
      'matchMedia',
      (consulta: string) =>
        ({
          matches: consulta.includes('max-width') || consulta.includes('prefers-reduced-motion'),
          media: consulta,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )
    enfocarComoElNavegador()

    const paso1 = await empezar(notificaciones())
    await waitFor(() => expect(document.activeElement).toBe(boton(paso1, 'Siguiente')))

    fireEvent.click(boton(paso1, 'Siguiente'))
    const paso2 = await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
    await waitFor(() => expect(document.activeElement).toBe(boton(paso2, 'Siguiente')))

    fireEvent.click(boton(paso2, 'Atrás'))
    const otraVez1 = await screen.findByRole('dialog', { name: 'Aquí te avisamos de todo' })
    await waitFor(() => expect(document.activeElement).toBe(boton(otraVez1, 'Siguiente')))
  })
})

describe('el final de la guía', () => {
  it('«Activar WhatsApp» la da por vista, abre los ajustes y lo enciende como el interruptor', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockReturnValue(new Promise(() => undefined))
    const paso1 = await empezar(notificaciones())
    fireEvent.click(boton(paso1, 'Siguiente'))
    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' }), 'Siguiente'))
    const paso3 = await screen.findByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' })

    fireEvent.click(boton(paso3, 'Activar WhatsApp'))

    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
    // Sin comprobar: la pestaña del chat se pide en el mismo clic, antes de esperar a nadie.
    expect(abrir).toHaveBeenCalledWith('', '_blank')
    expect(activarWhatsapp).toHaveBeenCalledTimes(1)
    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    expect(ventana.open).toBe(true)
    expect(await within(ventana).findByText('Activando…')).toBeTruthy()
    await waitFor(() => expect(guia()).toBeNull())
  })

  it('sin número, «Activar WhatsApp» abre los ajustes en el campo del celular', async () => {
    const paso1 = await empezar(notificaciones({ estado: 'SIN_NUMERO', numero: null }))
    fireEvent.click(boton(paso1, 'Siguiente'))
    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' }), 'Siguiente'))

    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' }), 'Activar WhatsApp'))

    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    expect(ventana.open).toBe(true)
    const campo = await within(ventana).findByLabelText(/Agrega tu celular para recibir avisos por WhatsApp/)
    await waitFor(() => expect(document.activeElement).toBe(campo))
    expect(activarWhatsapp).not.toHaveBeenCalled()
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
  })

  it('QA-08 · sin número, Esc en los ajustes que abrió «Activar WhatsApp» devuelve el foco a la campana, no al <body>', async () => {
    const paso1 = await empezar(notificaciones({ estado: 'SIN_NUMERO', numero: null }))
    fireEvent.click(boton(paso1, 'Siguiente'))
    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' }), 'Siguiente'))
    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' }), 'Activar WhatsApp'))
    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    const campo = await within(ventana).findByLabelText(/Agrega tu celular para recibir avisos por WhatsApp/)
    await waitFor(() => expect(document.activeElement).toBe(campo))
    await waitFor(() => expect(guia()).toBeNull())

    // Esc: el navegador cierra la ventana y deja un instante el foco en el campo, ya sin pintar.
    act(() => ventana.close())
    expect(document.activeElement).toBe(campo)

    // A la campana y no a la tuerca del panel que se está yendo (sigue montado mientras sale).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Avisos/ })))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())
  })

  it('con WhatsApp ACTIVO: «Todo listo» y un solo «Entendido»', async () => {
    const paso1 = await empezar(notificaciones({ estado: 'ACTIVO', numero: '+51 9•• ••• 321', comprobado: true }))
    fireEvent.click(boton(paso1, 'Siguiente'))
    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' }), 'Siguiente'))

    const paso3 = await screen.findByRole('dialog', { name: 'Todo listo' })
    expect(within(paso3).getByText('Te avisamos de todos tus procesos y puedes escribirnos tus dudas.')).toBeTruthy()
    expect(within(paso3).getAllByRole('button').map((b) => b.textContent)).toEqual(['Entendido'])
    expect(within(paso3).queryByText(/Al activarlo aceptas/)).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(boton(paso3, 'Entendido')))

    fireEvent.click(boton(paso3, 'Entendido'))

    await waitFor(() => expect(guia()).toBeNull())
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
  })

  it('sin WhatsApp disponible: dos pasos, sin su chip, y el segundo termina en «Entendido»', async () => {
    const paso1 = await empezar(notificaciones({ disponible: false }))
    expect(within(paso1).getByText('1 de 2')).toBeTruthy()
    fireEvent.click(boton(paso1, 'Siguiente'))

    const paso2 = await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
    expect(within(paso2).getByText('2 de 2')).toBeTruthy()
    expect(within(paso2).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual(['Correo', 'En el portal'])
    expect(within(paso2).queryByRole('button', { name: 'Siguiente' })).toBeNull()

    fireEvent.click(boton(paso2, 'Entendido'))

    await waitFor(() => expect(guia()).toBeNull())
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
  })
})

describe('el final de la guía esperando su mensaje', () => {
  /** Hasta el paso 3 con WhatsApp activado y sin su mensaje todavía. */
  async function alPaso3(wa: Partial<WhatsappDeLaCuenta> = {}) {
    const paso1 = await empezar(notificaciones({ estado: 'ESPERANDO', ...wa }))
    fireEvent.click(boton(paso1, 'Siguiente'))
    fireEvent.click(boton(await screen.findByRole('dialog', { name: 'Con la tuerca eliges por dónde' }), 'Siguiente'))
    return screen.findByRole('dialog', { name: 'Termina de activar WhatsApp' })
  }

  it('ya no dice «Todo listo»: su número enmascarado, «Abrir WhatsApp» con el foco (ya visible) y «Ahora no», que la da por vista sin activar', async () => {
    enfocarComoElNavegador()
    const paso3 = await alPaso3()

    expect(screen.queryByRole('dialog', { name: 'Todo listo' })).toBeNull()
    expect(within(paso3).getByText('3 de 3')).toBeTruthy()
    // QA-09: el número enmascarado, como el de WhatsApp activo; nunca entero en la burbuja.
    expect(within(paso3).getByText('+51 9•• ••• 321').closest('p')?.textContent).toBe(
      'Envía el mensaje desde tu número +51 9•• ••• 321.',
    )
    expect(within(paso3).queryByText(/987 654 321/)).toBeNull()
    expect(within(paso3).getAllByRole('button').map((b) => b.textContent)).toEqual(['Abrir WhatsApp', 'Ahora no'])
    // Ya firmó al activarlo: el consentimiento no se repite.
    expect(within(paso3).queryByText(/Al activarlo aceptas/)).toBeNull()
    // QA-06: el foco, al botón verde y solo con la burbuja colocada.
    await waitFor(() => expect(document.activeElement).toBe(boton(paso3, 'Abrir WhatsApp')))
    expect(guia()?.hasAttribute('data-colocada')).toBe(true)

    fireEvent.click(boton(paso3, 'Ahora no'))

    await waitFor(() => expect(guia()).toBeNull())
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
    expect(activarWhatsapp).not.toHaveBeenCalled()
    // Los ajustes no se abren: «Ahora no» no toca WhatsApp.
    expect(screen.queryByRole('dialog', { name: 'Ajustes de avisos' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Avisos/ })))
  })

  it('«Abrir WhatsApp» la da por vista y repite la activación de la ventana: la pestaña pedida en el clic lleva al chat', async () => {
    const pestana = { opener: {}, location: { href: '' }, close: vi.fn() }
    const abrir = vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })
    const paso3 = await alPaso3()

    fireEvent.click(boton(paso3, 'Abrir WhatsApp'))

    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
    expect(abrir).toHaveBeenCalledWith('', '_blank')
    expect(activarWhatsapp).toHaveBeenCalledTimes(1)
    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    expect(ventana.open).toBe(true)
    await waitFor(() => expect(pestana.location.href).toBe('https://wa.me/51928439930?text=Hola'))
    expect(pestana.opener).toBeNull()
    expect(await within(ventana).findByText(/Te abrimos WhatsApp\. Envía el mensaje desde el/)).toBeTruthy()
    await waitFor(() => expect(guia()).toBeNull())
  })

  it('sin chat que abrir (el navegador bloqueó la pestaña), quedan los ajustes con «Ábrelo desde aquí»', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })

    fireEvent.click(boton(await alPaso3(), 'Abrir WhatsApp'))

    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    expect(ventana.open).toBe(true)
    const enlace = await within(ventana).findByRole('link', { name: 'Ábrelo desde aquí' })
    expect(enlace.getAttribute('href')).toBe('https://wa.me/51928439930?text=Hola')
    await waitFor(() => expect(guia()).toBeNull())
  })

  it('QA-08 · sin pestaña, cerrar con la × los ajustes que abrió «Abrir WhatsApp» devuelve el foco a la campana, no al <body>', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO' }),
    })
    fireEvent.click(boton(await alPaso3(), 'Abrir WhatsApp'))
    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    await within(ventana).findByRole('link', { name: 'Ábrelo desde aquí' })
    await waitFor(() => expect(guia()).toBeNull())

    // El clic en la × la enfoca; cerrada la ventana, el foco sigue en ella, conectada y oculta.
    const cruz = within(ventana).getByRole('button', { name: 'Cerrar' })
    cruz.focus()
    fireEvent.click(cruz)
    expect(ventana.open).toBe(false)
    expect(document.activeElement).toBe(cruz)

    // A la campana y no a la tuerca del panel que se está yendo (sigue montado mientras sale).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Avisos/ })))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())
  })

  it('QA-09 · un número de otro país también va enmascarado en la guía; la ventana de ajustes lo sigue enseñando entero', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'POR_MENSAJE',
      enlace: 'https://wa.me/51928439930?text=Hola',
      confirmacionEnviada: false,
      notificaciones: notificaciones({ estado: 'ESPERANDO', numero: '+34612345678' }),
    })
    const paso3 = await alPaso3({ numero: '+34612345678' })

    expect(within(paso3).getByText('+346•••••678').closest('p')?.textContent).toBe(
      'Envía el mensaje desde tu número +346•••••678.',
    )
    expect(within(paso3).queryByText(/612345678/)).toBeNull()

    fireEvent.click(boton(paso3, 'Abrir WhatsApp'))

    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    expect(await within(ventana).findByText(/Te abrimos WhatsApp\. Envía el mensaje desde el/)).toBeTruthy()
    expect(within(ventana).getAllByText('+34612345678').length).toBeGreaterThan(0)
  })

  it('sin chat que abrir (el número ya estaba comprobado y se enciende con un clic), quedan los ajustes con el resultado', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(activarWhatsapp).mockResolvedValue({
      resultado: 'ACTIVADO',
      enlace: null,
      confirmacionEnviada: true,
      notificaciones: notificaciones({ estado: 'ACTIVO', numero: '+51 9•• ••• 321', comprobado: true }),
    })

    fireEvent.click(boton(await alPaso3({ comprobado: true }), 'Abrir WhatsApp'))

    // Comprobado, el backend no contesta con el chat: no se pide pestaña.
    expect(abrir).not.toHaveBeenCalled()
    const ventana = screen.getByRole('dialog', { name: 'Ajustes de avisos' }) as HTMLDialogElement
    expect(ventana.open).toBe(true)
    expect(await within(ventana).findByText(/Te enviamos un mensaje para confirmarlo\./)).toBeTruthy()
    expect(marcarGuiaVista).toHaveBeenCalledTimes(1)
  })
})

describe('dónde se pone', () => {
  const campana = { left: 1188, top: 12, width: 44, height: 44 }

  it('escritorio, paso 1: el foco sobra 6 px alrededor de la campana y la burbuja cuelga debajo, con el pico hacia ella', () => {
    const c = colocar({ objetivo: campana, panel: null, ancho: 1280, alto: 800, altoBurbuja: 180, estrecha: false, sobreElPanel: false })

    expect(c.foco).toEqual({ left: 1182, top: 6, width: 56, height: 56 })
    expect(c.burbuja).toEqual({ left: 884, width: 360, top: 74 })
    expect(c.flecha).toEqual({ lado: 'arriba', a: 1210 - 884 })
  })

  it('escritorio, pasos 2 y 3: a la izquierda del panel, a la altura de la tuerca; si no cabe, debajo', () => {
    const tuerca = { left: 1195, top: 88, width: 32, height: 32 }
    const panel = { left: 888, top: 77, width: 352, height: 300 }

    const c = colocar({ objetivo: tuerca, panel, ancho: 1280, alto: 800, altoBurbuja: 220, estrecha: false, sobreElPanel: true })
    expect(c.foco).toEqual({ left: 1189, top: 82, width: 44, height: 44 })
    expect(c.burbuja).toEqual({ left: 868 - 360, width: 360, top: 70 })
    expect(c.flecha).toEqual({ lado: 'derecha', a: 34 })

    const estrecho = colocar({
      objetivo: tuerca,
      panel: { ...panel, left: 300 },
      ancho: 700,
      alto: 800,
      altoBurbuja: 220,
      estrecha: false,
      sobreElPanel: true,
    })
    expect(estrecho.flecha).toBeNull()
    expect(estrecho.burbuja.top).toBe(77 + 300 + 16)
  })

  it('teléfono: a todo el ancho bajo la cabecera, y en los pasos 2 y 3 encima de la hoja', () => {
    const enElTelefono = { left: 334, top: 12, width: 44, height: 44 }
    const arriba = colocar({ objetivo: enElTelefono, panel: null, ancho: 390, alto: 844, altoBurbuja: 200, estrecha: true, sobreElPanel: false })
    expect(arriba.burbuja).toEqual({ left: 16, width: 358, top: 74 })
    expect(arriba.flecha).toEqual({ lado: 'arriba', a: 340 })

    const tuerca = { left: 334, top: 564, width: 44, height: 44 }
    const hoja = { left: 0, top: 544, width: 390, height: 300 }
    const encima = colocar({ objetivo: tuerca, panel: hoja, ancho: 390, alto: 844, altoBurbuja: 250, estrecha: true, sobreElPanel: true })
    expect(encima.burbuja).toEqual({ left: 16, width: 358, bottom: 844 - 544 + 16 })
    expect(encima.flecha?.lado).toBe('abajo')

    // Si la hoja no deja sitio, arriba del todo y sin pico.
    const sinSitio = colocar({ objetivo: tuerca, panel: hoja, ancho: 390, alto: 844, altoBurbuja: 600, estrecha: true, sobreElPanel: true })
    expect(sinSitio.burbuja).toEqual({ left: 16, width: 358, top: 16 })
    expect(sinSitio.flecha).toBeNull()
  })
})
