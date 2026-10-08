/**
 * Postular a una vacante sin banco que pasa sola: la prueba se abre en la misma respuesta (V70).
 *
 * El portal no lo adivina: vuelve a pedir la postulación recién creada y, si quedó en la
 * prueba, lleva a su portada. Si no —sin pase automático, o sin prueba montada—, a sus
 * procesos, como siempre.
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

/** Dónde quedó la postulación recién creada. */
function quedoEn(estado: string, instrumentoEtapaTecnica: string | null = 'PRUEBA_PROPIA') {
  vi.mocked(verPostulacion).mockResolvedValueOnce({
    resumen: { uuid: 'uuid-al-instante', estado, instrumentoEtapaTecnica, pruebaSinCompletar: false },
    historial: [],
  } as unknown as Awaited<ReturnType<typeof verPostulacion>>)
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

describe('al postular, la prueba al instante', () => {
  it('si quedó en la prueba, lleva a su portada y lo dice (AC-2)', async () => {
    quedoEn('PRUEBA_TURNO_CANDIDATO')
    await postularYEnviar()

    expect(await screen.findByText('Portada de la prueba')).toBeTruthy()
    expect(screen.getByText('Tu prueba del puesto ya está disponible')).toBeTruthy()
    expect(verPostulacion).toHaveBeenCalledWith('uuid-al-instante')
  })

  it('con el cuestionario técnico, a la portada del cuestionario (AC-3)', async () => {
    quedoEn('PRUEBA_TURNO_CANDIDATO', 'CUESTIONARIO_TECNICO')
    await postularYEnviar()

    expect(await screen.findByText('Portada del cuestionario')).toBeTruthy()
  })

  it('si espera al equipo, a sus procesos como siempre (AC-7)', async () => {
    quedoEn('PERFIL_POR_CONFIRMAR')
    await postularYEnviar()

    expect(await screen.findByText('Mis procesos')).toBeTruthy()
    expect(screen.queryByText('Tu prueba del puesto ya está disponible')).toBeNull()
  })

  it('si no se puede saber dónde quedó, también a sus procesos', async () => {
    vi.mocked(verPostulacion).mockRejectedValueOnce(new Error('sin red'))
    await postularYEnviar()

    expect(await screen.findByText('Mis procesos')).toBeTruthy()
  })

  it('la campana de la cabecera vuelve a pedir sus avisos, sin recargar (AC-10)', async () => {
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    try {
      quedoEn('PRUEBA_TURNO_CANDIDATO')
      await postularYEnviar()

      expect(await screen.findByText('Portada de la prueba')).toBeTruthy()
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['avisos'] })
    } finally {
      invalidar.mockRestore()
    }
  })
})
