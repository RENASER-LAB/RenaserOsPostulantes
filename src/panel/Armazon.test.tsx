/**
 * El armazón del panel con su menú lateral (V64).
 *
 * Lo que los E2E del armazón buscan tiene que seguir donde estaba: la marca
 * «Panel del equipo, inicio» dentro del `banner` y llevando a `/admin`, y
 * «Salir» a la vista. Y lo nuevo: las familias según los permisos, la entrada
 * activa en las rutas hijas, el plegado recordado con nombres accesibles, y el
 * cajón de las pantallas estrechas con Escape, fuera y foco de vuelta.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ArmazonPanel } from './Armazon'
import { ProveedorSesionPanel } from './Sesion'
import type { SesionDelPanel } from './api/tiposPersonas'

const verSesion = vi.fn<() => Promise<SesionDelPanel>>()

vi.mock('./api/sesion', () => ({ verSesionDelPanel: () => verSesion() }))

const TALENTO: SesionDelPanel = {
  usuarioId: 7,
  nombre: 'Tania Rojas',
  correo: 'tania@renaser.pe',
  organizacionId: 1,
  empresa: 'Clínica Renaser S.A.C.',
  permisos: [
    { codigo: 'ver_vacantes', alcance: 'TODO' },
    { codigo: 'crear_sesiones_simulacion', alcance: 'TODO' },
    { codigo: 'elegir_plantilla_prueba', alcance: 'TODO' },
    { codigo: 'ver_colaboradores', alcance: 'TODO' },
  ],
}

function montar(ruta = '/admin') {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorSesionPanel>
          <Routes>
            <Route element={<ArmazonPanel />}>
              <Route path="/admin" element={<p>La lista de vacantes</p>} />
              <Route path="/admin/vacantes/:id" element={<p>Una vacante</p>} />
              <Route path="/admin/colaboradores" element={<p>La lista de colaboradores</p>} />
              <Route path="/admin/colaboradores/:id" element={<p>Una ficha</p>} />
              <Route path="/admin/configuracion" element={<p>Configuración</p>} />
            </Route>
            <Route path="/admin/entrar" element={<p>Entrar</p>} />
          </Routes>
        </ProveedorSesionPanel>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const lateral = () => screen.getByRole('navigation', { name: 'Menú del panel' })

beforeEach(() => {
  localStorage.setItem('renaser_panel_token', 'un-token')
  verSesion.mockResolvedValue(TALENTO)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('la barra fina', () => {
  it('lleva la marca con su nombre de siempre hacia /admin, la empresa, la persona y «Salir»', async () => {
    montar('/admin/configuracion')
    const barra = screen.getByRole('banner')
    const marca = within(barra).getByRole('link', { name: 'Panel del equipo, inicio' })
    expect(marca.getAttribute('href')).toBe('/admin')
    expect(within(barra).getByRole('button', { name: 'Salir' })).toBeTruthy()
    expect(await within(barra).findByText('Clínica Renaser S.A.C.')).toBeTruthy()
    expect(within(barra).getByText('Tania Rojas')).toBeTruthy()
  })

  it('«Salir» cierra la sesión y lleva a entrar', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByText('Entrar')).toBeTruthy()
  })
})

describe('el menú lateral', () => {
  it('agrupa Selección y Personas, con Configuración al pie y los nombres de siempre (AC-01)', async () => {
    montar()
    const menu = lateral()
    expect(await within(menu).findByRole('link', { name: 'Colaboradores' })).toBeTruthy()
    for (const nombre of ['Vacantes', 'Simulación', 'Configuración']) {
      expect(within(menu).getByRole('link', { name: nombre })).toBeTruthy()
    }
    // La sección «Pruebas» se retiró: no sale ni con elegir_plantilla_prueba.
    expect(within(menu).queryByRole('link', { name: 'Pruebas' })).toBeNull()
    expect(within(menu).getByRole('region', { name: 'Selección' })).toBeTruthy()
    expect(within(menu).getByRole('region', { name: 'Personas' })).toBeTruthy()
  })

  it('sin ver_colaboradores no sale la familia Personas, y las de siempre sí (AC-02)', async () => {
    verSesion.mockResolvedValue({
      ...TALENTO,
      permisos: [
        { codigo: 'ver_vacantes', alcance: 'TODO' },
        { codigo: 'ver_inscritos_simulacion', alcance: 'SUS_VACANTES' },
        { codigo: 'elegir_plantilla_prueba', alcance: 'SUS_VACANTES' },
      ],
    })
    montar()
    await waitFor(() => expect(verSesion).toHaveBeenCalled())
    await screen.findByText('Clínica Renaser S.A.C.')
    const menu = lateral()
    expect(within(menu).queryByRole('link', { name: 'Colaboradores' })).toBeNull()
    expect(within(menu).queryByRole('region', { name: 'Personas' })).toBeNull()
    for (const nombre of ['Vacantes', 'Simulación', 'Configuración']) {
      expect(within(menu).getByRole('link', { name: nombre })).toBeTruthy()
    }
    expect(within(menu).queryByRole('link', { name: 'Pruebas' })).toBeNull()
  })

  it('si la sesión no se puede cargar, salen las tres de siempre y el panel sigue', async () => {
    verSesion.mockRejectedValue(new Error('sin red'))
    montar()
    await waitFor(() => expect(verSesion).toHaveBeenCalled())
    const menu = lateral()
    for (const nombre of ['Vacantes', 'Simulación', 'Configuración']) {
      expect(within(menu).getByRole('link', { name: nombre })).toBeTruthy()
    }
    expect(within(menu).queryByRole('link', { name: 'Pruebas' })).toBeNull()
    expect(screen.getByText('La lista de vacantes')).toBeTruthy()
  })

  it.each([
    ['/admin/vacantes/12', 'Vacantes'],
    ['/admin/colaboradores/3', 'Colaboradores'],
  ])('en %s marca «%s» como activa (AC-04)', async (ruta, nombre) => {
    montar(ruta)
    const enlace = await within(lateral()).findByRole('link', { name: nombre })
    expect(enlace.getAttribute('aria-current')).toBe('page')
    const otras = within(lateral()).getAllByRole('link').filter((a) => a !== enlace)
    expect(otras.every((a) => a.getAttribute('aria-current') === null)).toBe(true)
  })

  it('plegado se recuerda al recargar y cada entrada conserva su nombre accesible (AC-03)', async () => {
    const { unmount } = montar()
    fireEvent.click(within(lateral()).getByRole('button', { name: 'Plegar menú' }))
    expect(localStorage.getItem('renaser_panel_menu_plegado')).toBe('1')
    unmount()

    montar()
    expect(document.querySelector('[data-plegado="true"]')).not.toBeNull()
    const menu = lateral()
    expect(await within(menu).findByRole('link', { name: 'Colaboradores' })).toBeTruthy()
    expect(within(menu).getByRole('link', { name: 'Vacantes' })).toBeTruthy()
    fireEvent.click(within(menu).getByRole('button', { name: 'Desplegar menú' }))
    expect(localStorage.getItem('renaser_panel_menu_plegado')).toBeNull()
  })
})

describe('el cajón de las pantallas estrechas (AC-03)', () => {
  it('«Menú» lo abre; Escape lo cierra y el foco vuelve al botón', async () => {
    montar()
    const boton = screen.getByRole('button', { name: 'Menú' })
    boton.focus()
    fireEvent.click(boton)
    const cajon = await screen.findByRole('dialog', { name: 'Menú del panel' })
    expect(cajon.contains(document.activeElement)).toBe(true)
    expect(boton.getAttribute('aria-expanded')).toBe('true')

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog', { name: 'Menú del panel' })).toBeNull()
    expect(document.activeElement).toBe(boton)
  })

  it('se cierra al tocar fuera y al elegir una entrada', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.click(await screen.findByTestId('velo-del-menu'))
    expect(screen.queryByRole('dialog', { name: 'Menú del panel' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    const cajon = await screen.findByRole('dialog', { name: 'Menú del panel' })
    fireEvent.click(await within(cajon).findByRole('link', { name: 'Colaboradores' }))
    expect(await screen.findByText('La lista de colaboradores')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Menú del panel' })).toBeNull()
  })

  it('el foco no sale del cajón con Tab', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    const cajon = await screen.findByRole('dialog', { name: 'Menú del panel' })
    await within(cajon).findByRole('link', { name: 'Colaboradores' })
    const enfocables = [...cajon.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
    enfocables[enfocables.length - 1]!.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(enfocables[0])
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(enfocables[enfocables.length - 1])
  })
})
