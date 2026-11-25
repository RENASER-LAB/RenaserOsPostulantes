/**
 * La campana del portal.
 *
 * Tres formas de romperla sin que nada se queje:
 *
 *   1. **Pedir los avisos sin sesion.** El tablon se sirve sin cuenta, y una
 *      consulta con token vacio serian 401 en cada visita anonima.
 *   2. **Apagar los avisos por abrir la campana.** Es lo que hacia antes, y el
 *      punto de cada fila de «Mis procesos» se apagaba con ellos sin que nadie
 *      hubiera leido nada. Ahora lo decide la persona: el que pulsa, o todos con
 *      el boton de la cabecera.
 *   3. **Marcar leido lo que ya lo estaba**: trafico por un clic que no apaga nada.
 *
 * Y desde el 25/11/2026, la tuerca de la cabecera: abre «Ajustes de avisos», lleva el
 * puntito verde solo cuando WhatsApp se puede activar, y su Escape no cierra el panel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Campana, focoALaVista } from './Campana'

let hayCuenta = true
let avisos: { sinLeer: number; avisos: unknown[] } = { sinLeer: 0, avisos: [] }
let vecesQueSeMarco = 0
let vecesQueSePidio = 0
let estadoDeWhatsapp = 'APAGADO'
let pedidasDeNotificaciones = 0

vi.mock('@/app/Sesion', () => ({
  useSesion: () => ({ hayCuenta }),
}))

const marcadosUnoAUno: number[] = []

vi.mock('@/api/portal', () => ({
  misAvisos: () => {
    vecesQueSePidio += 1
    return Promise.resolve(avisos)
  },
  marcarAvisosLeidos: () => {
    vecesQueSeMarco += 1
    return Promise.resolve({ marcados: 1 })
  },
  marcarAvisoLeido: (id: number) => {
    marcadosUnoAUno.push(id)
    return Promise.resolve()
  },
  misNotificaciones: () => {
    pedidasDeNotificaciones += 1
    return Promise.resolve({
      whatsapp: {
        disponible: true,
        estado: estadoDeWhatsapp,
        numero: '+51 987 654 321',
        comprobado: false,
        porBaja: false,
        bajaEn: null,
        cambioDeNumero: false,
      },
      correo: { activo: true, destino: 'ana@correo.pe' },
      portal: { activo: true },
      mensaje: { mostrar: false, situacion: 'PRIMERA_VEZ' },
      guiaVista: true,
    })
  },
  marcarGuiaVista: () => Promise.resolve(),
  activarWhatsapp: () => Promise.reject(new Error('no se usa aquí')),
  apagarWhatsapp: () => Promise.reject(new Error('no se usa aquí')),
  cambiarNotificaciones: () => Promise.reject(new Error('no se usa aquí')),
  cambiarCelular: () => Promise.reject(new Error('no se usa aquí')),
}))

const UN_AVISO = {
  id: 10,
  tipo: 'REMUNERACION_ACTUALIZADA',
  titulo: 'Cambió la remuneración de «Analista»',
  cuerpo: 'Antes: S/ 3 000 · Ahora: S/ 3 500.',
  postulacionUuid: 'uuid-1',
  vacanteId: 7,
  leidoEn: null,
  creadoEn: new Date().toISOString(),
}

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter>
        <Campana />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Si al pintarse «Mi cuenta» quedaba alguna ventana abierta encima (y lo de debajo, inerte). */
let ventanaAbiertaAlLlegar: boolean | null = null

function MiCuenta() {
  useEffect(() => {
    ventanaAbiertaAlLlegar = document.querySelector('dialog[open]') !== null
  }, [])
  return <p>Mi cuenta</p>
}

/** Otro camino para cambiar de ruta: el «atrás» del navegador o una redirección. */
function OtraRuta() {
  const navegar = useNavigate()
  const { pathname, hash } = useLocation()
  return (
    <>
      <output aria-label="Dónde estoy">{pathname + hash}</output>
      <button type="button" onClick={() => navegar('/vacantes')}>
        Ir a otra pantalla
      </button>
    </>
  )
}

/** La campana en una cabecera de verdad: con rutas debajo, como en el armazón. */
function montarConRutas() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={['/procesos']}>
        <Campana />
        <OtraRuta />
        <Routes>
          <Route path="/procesos" element={<p>Mis procesos</p>} />
          <Route path="/perfil" element={<MiCuenta />} />
          <Route path="/vacantes" element={<p>Vacantes</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  hayCuenta = true
  avisos = { sinLeer: 0, avisos: [] }
  vecesQueSeMarco = 0
  vecesQueSePidio = 0
  estadoDeWhatsapp = 'APAGADO'
  pedidasDeNotificaciones = 0
  marcadosUnoAUno.length = 0
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

describe('la campana', () => {
  it('sin sesión no se pinta ni pide nada', async () => {
    hayCuenta = false
    montar()

    expect(screen.queryByRole('button')).toBeNull()
    await waitFor(() => expect(vecesQueSePidio).toBe(0))
  })

  it('la píldora lleva la cuenta, y el lector de pantalla también la oye', async () => {
    avisos = { sinLeer: 3, avisos: [UN_AVISO] }
    montar()

    // El nombre accesible dice el numero: quien no ve el punto necesita que el
    // boton se lo diga, y un circulo de CSS no dice nada.
    await screen.findByRole('button', { name: /3 sin leer/i })
  })

  it('abrir la campana NO apaga nada: lo decide la persona', async () => {
    // Antes se marcaban todos al abrir, y con ellos se apagaba el punto de cada
    // fila de «Mis procesos» — sin que nadie hubiera leido nada.
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })

    fireEvent.click(screen.getByRole('button'))
    await screen.findByRole('dialog')

    expect(vecesQueSeMarco).toBe(0)
    expect(marcadosUnoAUno).toHaveLength(0)
  })

  it('pulsar un aviso apaga ESE, no todos', async () => {
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(await screen.findByRole('link', { name: /cambió la remuneración/i }))

    await waitFor(() => expect(marcadosUnoAUno).toEqual([10]))
    expect(vecesQueSeMarco).toBe(0)
  })

  it('«marcar todos» solo sale si hay algo sin leer, y los apaga de una vez', async () => {
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(await screen.findByRole('button', { name: /marcar todos como leídos/i }))

    await waitFor(() => expect(vecesQueSeMarco).toBe(1))
  })

  it('con la campana vacía no se ofrece marcar nada', async () => {
    montar()
    await screen.findByRole('button', { name: 'Avisos' })

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText(/nada nuevo por ahora/i)
    expect(screen.queryByRole('button', { name: /marcar todos/i })).toBeNull()
    expect(vecesQueSeMarco).toBe(0)
  })

  it('un aviso ya leído no se vuelve a marcar al pulsarlo', async () => {
    avisos = {
      sinLeer: 0,
      avisos: [{ ...UN_AVISO, leidoEn: '2026-09-14T10:00:00Z' }],
    }
    montar()
    await screen.findByRole('button', { name: 'Avisos' })
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(await screen.findByRole('link', { name: /cambió la remuneración/i }))

    await waitFor(() => expect(marcadosUnoAUno).toHaveLength(0))
  })

  it('cada aviso enseña lo que pasó y lleva a su proceso', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })

    fireEvent.click(screen.getByRole('button'))

    const enlace = await screen.findByRole('link', { name: /cambió la remuneración/i })
    expect(enlace.getAttribute('href')).toBe('/procesos/uuid-1')
    expect(screen.getByText(/antes: s\/ 3 000/i)).toBeTruthy()
    // «Sin leer» va DENTRO del nombre del enlace, no suelto al lado: asi quien
    // navega por la lista de enlaces oye que ese aviso es nuevo sin tener que
    // encontrar un punto de 5px que para el no existe. `name` de `getByRole` es
    // el nombre accesible calculado, que es exactamente lo que se quiere probar.
    expect(screen.getByRole('link', { name: /sin leer/i })).toBe(enlace)
  })

  it('un aviso ya leído no anuncia «sin leer»', async () => {
    avisos = {
      sinLeer: 0,
      avisos: [{ ...UN_AVISO, leidoEn: '2026-09-14T10:00:00Z' }],
    }
    montar()
    await screen.findByRole('button', { name: 'Avisos' })
    fireEvent.click(screen.getByRole('button'))

    await screen.findByRole('link', { name: /cambió la remuneración/i })
    expect(screen.queryByRole('link', { name: /sin leer/i })).toBeNull()
  })

  it('un aviso sin proceso detrás no se pinta como enlace', async () => {
    // Un enlace que no lleva a ninguna parte es peor que no tenerlo: se pulsa,
    // no pasa nada, y la proxima vez ya no se pulsa ninguno. Sigue siendo
    // pulsable —es un boton— para poder apagarlo.
    avisos = { sinLeer: 1, avisos: [{ ...UN_AVISO, postulacionUuid: null }] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText(/cambió la remuneración/i)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('AC-11: el aviso de una reseña lleva a la sección de reseñas del perfil, no a un proceso', async () => {
    avisos = {
      sinLeer: 1,
      avisos: [
        {
          ...UN_AVISO,
          id: 11,
          tipo: 'RESENA_PUBLICADA',
          titulo: 'Constructora Andina te dejó una reseña',
          cuerpo: 'Puedes leerla en tu perfil y, si quieres, responderla.',
          postulacionUuid: null,
          vacanteId: null,
        },
      ],
    }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })
    fireEvent.click(screen.getByRole('button'))

    const enlace = await screen.findByRole('link', { name: /te dejó una reseña/i })
    expect(enlace.getAttribute('href')).toBe('/perfil#resenas')
  })

  it('los otros tres avisos de reseñas también llevan allí', async () => {
    avisos = {
      sinLeer: 3,
      avisos: ['RESENA_EDITADA', 'REPORTE_RESENA_RESUELTO', 'RESPUESTA_RESENA_OCULTADA'].map(
        (tipo, i) => ({ ...UN_AVISO, id: 20 + i, tipo, titulo: `Aviso ${tipo}`, postulacionUuid: null }),
      ),
    }
    montar()
    await screen.findByRole('button', { name: /3 sin leer/i })
    fireEvent.click(screen.getByRole('button'))

    const enlaces = await screen.findAllByRole('link', { name: /Aviso/ })
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual([
      '/perfil#resenas',
      '/perfil#resenas',
      '/perfil#resenas',
    ])
  })

  it('AC-10: al abrirla vuelve a pedir los avisos, y trae el que llegó mientras tanto', async () => {
    // El aviso de la prueba llega por una acción de otra pantalla (entregar, postular) o del
    // equipo: lo cargado al entrar ya no lo tiene, y antes no aparecía hasta recargar.
    montar()
    await waitFor(() => expect(vecesQueSePidio).toBe(1))
    expect(screen.getByRole('button', { name: 'Avisos' })).toBeTruthy()

    avisos = {
      sinLeer: 1,
      avisos: [{ ...UN_AVISO, titulo: 'Tu prueba del puesto está disponible · Analista' }],
    }
    fireEvent.click(screen.getByRole('button', { name: 'Avisos' }))

    expect(await screen.findByText('Tu prueba del puesto está disponible · Analista')).toBeTruthy()
    expect(vecesQueSePidio).toBe(2)
    await screen.findByRole('button', { name: 'Avisos, 1 sin leer' })
  })

  it('al cerrarla no la vuelve a pedir: solo al abrir', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })
    fireEvent.click(screen.getByRole('button'))
    await screen.findByRole('dialog')
    await waitFor(() => expect(vecesQueSePidio).toBe(2))

    fireEvent.click(screen.getByRole('button', { name: /1 sin leer/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(vecesQueSePidio).toBe(2)
  })

  it('se cierra con Escape', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })
    fireEvent.click(screen.getByRole('button'))
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('la cabecera se llama «Tus avisos»', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))

    expect(await screen.findByRole('heading', { name: 'Tus avisos' })).toBeTruthy()
  })
})

describe('la tuerca de los ajustes', () => {
  it('va en la cabecera del panel, junto a «Marcar todos como leídos», y abre «Ajustes de avisos»', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /1 sin leer/ }))
    const panel = await screen.findByRole('dialog', { name: 'Tus avisos' })
    expect(within(panel).getByRole('button', { name: /marcar todos como leídos/i })).toBeTruthy()

    fireEvent.click(within(panel).getByRole('button', { name: 'Ajustes de avisos' }))

    const ventana = await screen.findByRole('dialog', { name: 'Ajustes de avisos' })
    expect((ventana as HTMLDialogElement).open).toBe(true)
    expect(await within(ventana).findByRole('switch', { name: 'Notificaciones por WhatsApp' })).toBeTruthy()
  })

  it('con la campana cerrada no hay tuerca ni se piden los ajustes', async () => {
    montar()
    await waitFor(() => expect(vecesQueSePidio).toBe(1))
    expect(pedidasDeNotificaciones).toBe(0)
    expect(screen.queryByRole('button', { name: 'Ajustes de avisos' })).toBeNull()
  })

  it('el puntito verde sale con WhatsApp por activar y nunca con texto', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    const tuerca = await screen.findByRole('button', { name: 'Ajustes de avisos' })

    await waitFor(() => expect(tuerca.querySelector('[data-puntito]')).not.toBeNull())
    // El nombre sigue siendo el mismo: el puntito no dice nada en palabras.
    expect(tuerca.getAttribute('aria-label')).toBe('Ajustes de avisos')
  })

  it('con WhatsApp activo, la tuerca va limpia', async () => {
    estadoDeWhatsapp = 'ACTIVO'
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    const tuerca = await screen.findByRole('button', { name: 'Ajustes de avisos' })

    await waitFor(() => expect(pedidasDeNotificaciones).toBe(1))
    expect(tuerca.querySelector('[data-puntito]')).toBeNull()
  })

  it('QA-05 · «Cámbialo en Mi cuenta» cierra los ajustes y el panel antes de que «Mi cuenta» se pinte', async () => {
    ventanaAbiertaAlLlegar = null
    montarConRutas()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes de avisos' }))
    const ventana = await screen.findByRole('dialog', { name: 'Ajustes de avisos' })

    fireEvent.click(await within(ventana).findByRole('link', { name: 'Cámbialo en Mi cuenta' }))

    await screen.findByText('Mi cuenta')
    expect(screen.getByLabelText('Dónde estoy').textContent).toBe('/perfil#celular')
    // Cerrada ya cuando el destino se monta y pide el foco para su campo.
    expect(ventanaAbiertaAlLlegar).toBe(false)
    expect((ventana as HTMLDialogElement).open).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())
  })

  it('QA-05 · al cambiar de ruta por cualquier otro camino, panel y ajustes se cierran', async () => {
    montarConRutas()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes de avisos' }))
    const ventana = await screen.findByRole('dialog', { name: 'Ajustes de avisos' })

    fireEvent.click(screen.getByRole('button', { name: 'Ir a otra pantalla' }))

    await screen.findByText('Vacantes')
    await waitFor(() => expect((ventana as HTMLDialogElement).open).toBe(false))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())

    // Y solo el panel, sin los ajustes abiertos.
    fireEvent.click(screen.getByRole('button', { name: 'Avisos' }))
    await screen.findByRole('dialog', { name: 'Tus avisos' })
    fireEvent.click(screen.getByRole('button', { name: 'Ir a otra pantalla' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tus avisos' })).toBeNull())
  })

  it('con los ajustes abiertos, Escape no cierra el panel de debajo', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes de avisos' }))
    await screen.findByRole('dialog', { name: 'Ajustes de avisos' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog', { name: 'Tus avisos' })).toBeTruthy()
  })

  it('QA-08 · al cerrar los ajustes con el foco en la × ya oculta, vuelve a la tuerca si el panel sigue abierto', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes de avisos' }))
    const ventana = (await screen.findByRole('dialog', { name: 'Ajustes de avisos' })) as HTMLDialogElement
    const cruz = within(ventana).getByRole('button', { name: 'Cerrar' })
    cruz.focus()

    fireEvent.click(cruz)

    expect(ventana.open).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ajustes de avisos' })))
    expect(screen.getByRole('dialog', { name: 'Tus avisos' })).toBeTruthy()
  })

  it('QA-08 · si al cerrarse el foco ya está en algo a la vista (el campo de otra pantalla), no se lo quita', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes de avisos' }))
    const ventana = (await screen.findByRole('dialog', { name: 'Ajustes de avisos' })) as HTMLDialogElement
    const fuera = document.createElement('input')
    document.body.appendChild(fuera)
    try {
      act(() => {
        ventana.close()
        fuera.focus()
      })
      await new Promise((listo) => requestAnimationFrame(() => setTimeout(listo, 0)))
      expect(document.activeElement).toBe(fuera)
    } finally {
      fuera.remove()
    }
  })
})

describe('focoALaVista (QA-08)', () => {
  it('no cuenta el <body>, lo desmontado ni lo que queda dentro de un <dialog> cerrado', () => {
    const dialogo = document.createElement('dialog')
    const dentro = document.createElement('button')
    dialogo.appendChild(dentro)
    const suelto = document.createElement('button')
    document.body.append(dialogo, suelto)
    try {
      expect(focoALaVista(null)).toBe(false)
      expect(focoALaVista(document.body)).toBe(false)
      expect(focoALaVista(document.createElement('button'))).toBe(false)
      expect(focoALaVista(dentro)).toBe(false)
      dialogo.setAttribute('open', '')
      expect(focoALaVista(dentro)).toBe(true)
      expect(focoALaVista(suelto)).toBe(true)
    } finally {
      dialogo.remove()
      suelto.remove()
    }
  })

  it('con el navegador que sabe si se pinta, tampoco cuenta lo oculto por estilo', () => {
    const oculto = document.createElement('button')
    document.body.appendChild(oculto)
    const conVisibilidad = oculto as HTMLButtonElement & { checkVisibility: () => boolean }
    try {
      conVisibilidad.checkVisibility = () => false
      expect(focoALaVista(oculto)).toBe(false)
      conVisibilidad.checkVisibility = () => true
      expect(focoALaVista(oculto)).toBe(true)
    } finally {
      oculto.remove()
    }
  })
})

