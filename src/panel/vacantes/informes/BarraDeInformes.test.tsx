import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { BarraDeInformes, informesDeLaPestana } from './BarraDeInformes'
import { descargarInforme, verInformesDelPostulante, type InformesDelPostulante } from '@/panel/api/informes'

vi.mock('@/panel/api/informes', async (original) => ({
  ...(await original<typeof import('@/panel/api/informes')>()),
  verInformesDelPostulante: vi.fn(),
  descargarInforme: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function conTodo(hijo: ReactNode) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={cliente}>
      <MemoryRouter>{hijo}</MemoryRouter>
    </QueryClientProvider>
  )
}

const estados = (informes: InformesDelPostulante['informes']): InformesDelPostulante => ({
  postulacionId: 7,
  candidato: null,
  informes,
})

describe('La barra de informes de la ficha', () => {
  it('pone CV y Evaluación en Perfil Integral, y Prueba en la prueba del puesto', () => {
    expect(informesDeLaPestana('PERFIL_INTEGRAL')).toEqual(['CV', 'EVALUACION'])
    expect(informesDeLaPestana('PRUEBA_PUESTO')).toEqual(['PRUEBA'])
    expect(informesDeLaPestana('SIMULACION')).toEqual([])
  })

  it('AC-08 · el informe que se califica sale gris y desactivado, con el motivo en title y aria-label', async () => {
    vi.mocked(verInformesDelPostulante).mockResolvedValue(
      estados([
        { etapa: 'CV', disponible: true, motivo: null, nota: 74 },
        { etapa: 'EVALUACION', disponible: false, motivo: 'La IA está calificando', nota: null },
        { etapa: 'PRUEBA', disponible: true, motivo: null, nota: 78 },
      ]),
    )
    render(conTodo(<BarraDeInformes postulacionId={7} vacanteId={3} etapa="PERFIL_INTEGRAL" />))

    const evaluacion = await screen.findByRole('button', { name: /informe de la evaluación/i })
    expect(evaluacion.hasAttribute('disabled')).toBe(true)
    expect(evaluacion.getAttribute('title')).toBe('La IA está calificando')
    expect(evaluacion.getAttribute('aria-label')).toContain('La IA está calificando')
    expect(screen.getByRole('button', { name: 'Descargar el informe del CV' }).hasAttribute('disabled')).toBe(false)
    // La prueba es de otra pestaña: aquí no sale.
    expect(screen.queryByRole('button', { name: /informe de la prueba/i })).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver informes' }).getAttribute('href')).toBe(
      '/admin/vacantes/3/informes?postulante=7&etapa=cv',
    )
    expect(screen.getByText('Todavía no · el motivo al pasar el ratón')).toBeTruthy()
  })

  it('AC-09 · sin permiso para la evaluación, su botón no aparece', async () => {
    vi.mocked(verInformesDelPostulante).mockResolvedValue(
      estados([{ etapa: 'CV', disponible: true, motivo: null, nota: 74 }]),
    )
    render(conTodo(<BarraDeInformes postulacionId={7} vacanteId={3} etapa="PERFIL_INTEGRAL" />))
    await screen.findByRole('button', { name: 'Descargar el informe del CV' })
    expect(screen.queryByRole('button', { name: /evaluación/i })).toBeNull()
  })

  it('mientras genera dice «Generando…» y no se puede pulsar otra vez; al terminar baja el PDF con su nombre', async () => {
    vi.mocked(verInformesDelPostulante).mockResolvedValue(
      estados([{ etapa: 'PRUEBA', disponible: true, motivo: null, nota: 78 }]),
    )
    let soltar: (v: { contenido: Blob; nombre: string | null }) => void = () => {}
    vi.mocked(descargarInforme).mockReturnValue(new Promise((r) => (soltar = r)))
    URL.createObjectURL = vi.fn(() => 'blob:informe')
    URL.revokeObjectURL = vi.fn()
    let nombre = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nombre = this.download
    })
    render(conTodo(<BarraDeInformes postulacionId={7} vacanteId={3} etapa="PRUEBA_PUESTO" />))

    fireEvent.click(await screen.findByRole('button', { name: 'Descargar el informe de la prueba' }))
    const generando = await screen.findByRole('button', { name: 'Generando el informe de la prueba' })
    expect(generando.hasAttribute('disabled')).toBe(true)
    expect(generando.textContent).toContain('Generando…')
    expect(descargarInforme).toHaveBeenCalledWith(7, 'prueba')

    soltar({ contenido: new Blob(['%PDF']), nombre: 'Informe prueba - Ana - Analista.pdf' })
    await waitFor(() => expect(nombre).toBe('Informe prueba - Ana - Analista.pdf'))
    expect(await screen.findByRole('button', { name: 'Descargar el informe de la prueba' })).toBeTruthy()
  })

  it('si el backend no deja descargar, dice por qué', async () => {
    vi.mocked(verInformesDelPostulante).mockResolvedValue(
      estados([{ etapa: 'CV', disponible: true, motivo: null, nota: 74 }]),
    )
    vi.mocked(descargarInforme).mockRejectedValue(new Error('Todavía no hay informe del currículum'))
    render(conTodo(<BarraDeInformes postulacionId={7} vacanteId={3} etapa="PERFIL_INTEGRAL" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar el informe del CV' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Todavía no hay informe del currículum')
  })
})
