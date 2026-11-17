import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import type { PerfilDeEmpresa as Perfil, VacantePublica } from '@/api/tipos'
import { PerfilDeEmpresa } from './PerfilDeEmpresa'

const verPerfilDeEmpresa = vi.fn()
vi.mock('@/api/portal', () => ({ verPerfilDeEmpresa: (c: string) => verPerfilDeEmpresa(c) }))

afterEach(() => {
  cleanup()
  verPerfilDeEmpresa.mockReset()
})

function vacante(id: number, titulo: string): VacantePublica {
  return {
    id,
    titulo,
    nombreEmpresa: 'Molinos del Sur',
    descripcion: 'Descripción',
    proposito: null,
    responsabilidades: null,
    requisitos: null,
    modalidad: 'Presencial',
    horario: null,
    ubicacion: null,
    ciudad: null,
    publicadaEn: null,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    requisitosObjetivos: [],
  }
}

async function abrir(respuesta: Perfil | Error) {
  if (respuesta instanceof Error) verPerfilDeEmpresa.mockRejectedValue(respuesta)
  else verPerfilDeEmpresa.mockResolvedValue(respuesta)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const vista = render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/empresas/molinos-del-sur']}>
        <Routes>
          <Route path="/empresas/:codigo" element={<PerfilDeEmpresa />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: (nombre) => !nombre.startsWith('Cargando') })
  return vista
}

describe('el perfil público de una empresa', () => {
  it('AC-17 y AC-27: presentación, ficha, beneficios y «Vacantes abiertas (3)» con sus tarjetas', async () => {
    const { container } = await abrir({
      codigo: 'MOLINOS-DEL-SUR',
      nombre: 'Molinos del Sur',
      ciudad: 'Arequipa',
      sector: 'Industria alimentaria',
      tamanoTexto: '201–500 colaboradores',
      anioFundacion: 1987,
      sedes: ['Arequipa', 'Cusco'],
      quienesSomos: 'Molemos trigo desde 1987.',
      proposito: 'Que ninguna familia se quede sin pan.',
      video: { servicio: 'YOUTUBE', identificador: 'abc123DEF45', enlace: 'x' },
      beneficios: ['Seguro EPS', 'Comedor'],
      paginaWeb: 'https://molinosdelsur.pe',
      redes: [{ red: 'INSTAGRAM', enlace: 'https://www.instagram.com/molinos' }],
      vacantes: [vacante(1, 'Supervisor'), vacante(2, 'Asistente'), vacante(3, 'Analista')],
    })
    expect(verPerfilDeEmpresa).toHaveBeenCalledWith('molinos-del-sur')
    expect(screen.getByRole('heading', { level: 1, name: 'Molinos del Sur' })).toBeTruthy()
    expect(screen.getByText('Industria alimentaria · 201–500 colaboradores · Fundada en 1987')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Nuestro propósito' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Vacantes abiertas (3)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver vacantes (3)' }).getAttribute('href')).toBe('#vacantes-abiertas')
    expect(screen.getByRole('link', { name: 'Visitar web' }).getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('link', { name: 'Supervisor' }).getAttribute('href')).toBe('/vacantes/1')
    expect(screen.getByText('Comedor')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Instagram' })[0]!.getAttribute('rel')).toBe('noopener noreferrer')
    // El video no carga nada hasta pulsarlo.
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reproducir el video de Molinos del Sur' })).toBeTruthy()
  })

  it('AC-19: sin presentación sale el nombre, sin bloques vacíos, y dice que no hay vacantes', async () => {
    await abrir({ codigo: 'VACIA', nombre: 'Vacía S.A.C.', vacantes: [] })
    expect(screen.getByRole('heading', { level: 1, name: 'Vacía S.A.C.' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Quiénes somos' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Nuestro propósito' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Beneficios' })).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Datos de la empresa' })).toBeNull()
    expect(screen.getByText('Ahora no tiene vacantes abiertas')).toBeTruthy()
  })

  it('AC-20: una empresa que no existe o suspendida da «no encontrada»', async () => {
    await abrir(new ErrorApi(404, 'No encontrada'))
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta empresa.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver los puestos abiertos' })).toBeTruthy()
  })
})
