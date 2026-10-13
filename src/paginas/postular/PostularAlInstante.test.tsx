/**
 * Postular a una vacante sin banco que avanza sola: ya no hay prueba al instante (V72).
 *
 * Hasta la V72 la prueba se abría en la misma respuesta y el portal llevaba a su portada.
 * Desde entonces el pase espera la nota del currículum y exige la mínima de la vacante, así
 * que al postular siempre se vuelve a sus procesos, sin preguntar dónde quedó.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { verPostulacion } from '@/api/portal'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Postular } from './Postular'

const VACANTE = {
  id: 7,
  titulo: 'Cajero de sede',
  nombreEmpresa: 'Clínica San Juan',
  descripcion: null,
  proposito: null,
  responsabilidades: null,
  requisitos: null,
  modalidad: null,
  horario: null,
  ubicacion: null,
  compensacionPublica: null,
  requisitosObjetivos: [{ id: 1, descripcion: 'Vivo en Lima.' }],
}

vi.mock('@/api/portal', () => ({
  verVacante: () => Promise.resolve(VACANTE),
  consentimientoDeVacante: () =>
    Promise.resolve({ nombreEmpresa: 'Clínica San Juan', version: '1.0', texto: 'El texto legal.' }),
  postular: () => Promise.resolve({ codigo: 'uuid-al-instante' }),
  verPostulacion: vi.fn(),
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/vacantes/7/postular']}>
          <Routes>
            <Route path="/vacantes/:vacanteId/postular" element={<Postular />} />
            <Route path="/procesos" element={<p>Mis procesos</p>} />
            <Route path="/procesos/:uuid/prueba" element={<p>Portada de la prueba</p>} />
            <Route path="/procesos/:uuid/prueba-tecnica" element={<p>Portada del cuestionario</p>} />
          </Routes>
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
}

/** Rellena lo obligatorio y envía. */
async function postularYEnviar() {
  montar()
  await screen.findByRole('button', { name: /enviar mi postulación/i })
  const archivo = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type=file]')!, {
    target: { files: [archivo] },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /cuéntalo con tus palabras/i }), {
    target: { value: 'Cuadré la caja de tres sedes sin un sol de diferencia.' },
  })
  fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
  fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))
}

beforeEach(() => {
  vi.mocked(verPostulacion).mockReset()
  // jsdom todavía no implementa `showModal` ni `close` de `<dialog>`.
  const dialogo = window.HTMLDialogElement.prototype
  if (typeof dialogo.showModal !== 'function') {
    dialogo.showModal = function abrir(this: HTMLDialogElement) {
      this.open = true
    }
    dialogo.close = function cerrar(this: HTMLDialogElement) {
      this.open = false
    }
  }
})
afterEach(cleanup)

describe('al postular, sin prueba al instante (V72)', () => {
  it('a sus procesos, aunque la vacante avance sola: el pase espera la nota (AC-07)', async () => {
    await postularYEnviar()

    expect(await screen.findByText('Mis procesos')).toBeTruthy()
    expect(screen.queryByText('Portada de la prueba')).toBeNull()
    expect(screen.queryByText('Tu prueba del puesto ya está disponible')).toBeNull()
    // Ya no se pregunta dónde quedó: nadie pasa a la prueba al postular
    expect(verPostulacion).not.toHaveBeenCalled()
  })

  it('la campana de la cabecera vuelve a pedir sus avisos, sin recargar (AC-10)', async () => {
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    try {
      await postularYEnviar()

      expect(await screen.findByText('Mis procesos')).toBeTruthy()
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['avisos'] })
    } finally {
      invalidar.mockRestore()
    }
  })
})
