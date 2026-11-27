import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { Vacante } from './Vacante'

const verVacante = vi.fn()

vi.mock('@/app/Sesion', () => ({ useSesion: () => ({ hayCuenta: false }) }))
vi.mock('@/api/portal', () => ({ verVacante: (id: string) => verVacante(id) }))

afterEach(() => {
  cleanup()
  verVacante.mockReset()
})

function vacante(cambios: Partial<VacantePublica> = {}): VacantePublica {
  return {
    id: 7,
    titulo: 'Supervisor de producción',
    nombreEmpresa: 'Molinos del Sur',
    descripcion: 'Descripción',
    proposito: 'Reducir los tiempos de despacho',
    responsabilidades: null,
    requisitos: null,
    modalidad: null,
    horario: null,
    ubicacion: null,
    ciudad: null,
    publicadaEn: null,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    requisitosObjetivos: [{ id: 1, descripcion: 'Título técnico' }],
    codigoEmpresa: 'MOLINOS-DEL-SUR',
    ...cambios,
  }
}

async function abrir(v: VacantePublica) {
  verVacante.mockResolvedValue(v)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const vista = render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/vacantes/7']}>
        <Routes>
          <Route path="/vacantes/:vacanteId" element={<Vacante />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Supervisor de producción' })
  return vista
}

describe('la vacante del portal con la presentación de su empresa', () => {
  it('7b: ya no lleva la etiqueta «Vacante / Ficha del puesto»', async () => {
    const { container } = await abrir(vacante())
    expect(container.querySelector('[data-seccion="Vacante / Ficha del puesto"]')).toBeNull()
  })

  it('un subtítulo que empieza con «¿» lleva la mayúscula en su primera letra', async () => {
    await abrir(vacante({ proposito: null, descripcion: 'Intro.\n\n¿QUÉ OFRECEMOS?\n• Bonos por metas.\n• Línea de carrera.' }))
    expect(screen.getByRole('heading', { level: 3, name: '¿Qué ofrecemos?' })).toBeTruthy()
  })

  it('AC-12: sin datos de la empresa no hay bloque «Sobre…» y el resto se ve igual', async () => {
    await abrir(vacante({ empresa: null }))
    expect(screen.queryByRole('heading', { name: /^Sobre / })).toBeNull()
    expect(screen.getByRole('heading', { name: 'El resultado que esperamos' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Requisitos indispensables' })).toBeTruthy()
  })

  it('AC-13: con solo la web, «Sobre…» trae solo «Página web», sin propósito ni video', async () => {
    const { container } = await abrir(vacante({ empresa: { paginaWeb: 'https://renaser.pe' } }))
    const sobre = screen.getByRole('heading', { name: 'Sobre Molinos del Sur' }).closest('section')!
    const web = screen.getByRole('link', { name: 'Página web' })
    expect(sobre.contains(web)).toBe(true)
    expect(web.getAttribute('target')).toBe('_blank')
    expect(web.getAttribute('rel')).toBe('noopener noreferrer')
    expect(container.querySelector('button[aria-label^="Reproducir"]')).toBeNull()
  })

  it('AC-14: los dos propósitos, cada uno en su bloque; el de la empresa después de los requisitos', async () => {
    const { container } = await abrir(
      vacante({ empresa: { proposito: 'Que ninguna familia se quede sin pan.\nDesde 1987.' } }),
    )
    const puesto = screen.getByRole('heading', { name: 'El resultado que esperamos' }).closest('section')!
    const sobre = screen.getByRole('heading', { name: 'Sobre Molinos del Sur' }).closest('section')!
    expect(puesto.textContent).toContain('Reducir los tiempos de despacho')
    expect(sobre.textContent).toContain('Que ninguna familia se quede sin pan.')
    expect(puesto.textContent).not.toContain('familia')
    const requisitos = screen.getByRole('heading', { name: 'Requisitos indispensables' }).closest('section')!
    // eslint-disable-next-line no-bitwise
    expect(requisitos.compareDocumentPosition(sobre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.innerHTML).not.toContain('<script')
  })

  it('AC-18: el nombre de la empresa y «Ver perfil de…» llevan a su perfil', async () => {
    await abrir(vacante({ empresa: { proposito: 'Pan para todos' } }))
    expect(screen.getByRole('link', { name: 'Molinos del Sur' }).getAttribute('href')).toBe('/empresas/molinos-del-sur')
    expect(screen.getByRole('link', { name: 'Ver perfil de Molinos del Sur →' }).getAttribute('href')).toBe(
      '/empresas/molinos-del-sur',
    )
  })

  it('en el teléfono el video de la empresa va en «Sobre…» y no carga nada hasta pulsar', async () => {
    const { container } = await abrir(
      vacante({ empresa: { video: { servicio: 'YOUTUBE', identificador: 'abc123DEF45', enlace: 'x' } } }),
    )
    const sobre = screen.getByRole('heading', { name: 'Sobre Molinos del Sur' }).closest('section')!
    expect(sobre.querySelector('button[aria-label="Reproducir el video de Molinos del Sur"]')).not.toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })
})
