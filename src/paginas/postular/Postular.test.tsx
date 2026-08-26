/**
 * El permiso de tratamiento de datos es un candado, no un aviso.
 *
 * Sin `aceptaTratamiento` el backend responde 400 y no hay postulacion. Eso lo
 * hace distinto de todo lo demas de esta pantalla, y son justo las diferencias
 * que compilan perfectamente estando mal:
 *
 *   1. **Que se pueda enviar sin marcarlo.** El envio llegaria al servidor, el
 *      servidor lo rechazaria, y el candidato veria un error que la pantalla
 *      pudo haberle evitado — despues de subir su curriculum.
 *   2. **Que se mande siempre `true`.** El valor tiene que salir de la casilla,
 *      no de una constante: el backend firma ese dato con la fecha y la IP, y
 *      firmar algo que la persona no marco es peor que no firmarlo.
 *   3. **Que el candado se salte por el aviso de los requisitos.** Los dos
 *      interceptan el envio, y si el aviso gana, se le pregunta si quiere
 *      postular igual cuando no hay ninguna postulacion posible.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Postular } from './Postular'

const VACANTE = {
  id: 7,
  titulo: 'Analista de Datos',
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

const enviados: unknown[] = []

vi.mock('@/api/portal', () => ({
  verVacante: () => Promise.resolve(VACANTE),
  consentimientoDeVacante: () =>
    Promise.resolve({ nombreEmpresa: 'Clínica San Juan', version: '1.0', texto: 'El texto legal.' }),
  postular: (datos: unknown) => {
    enviados.push(datos)
    return Promise.resolve({ codigo: 'uuid-de-prueba' })
  },
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={['/vacantes/7/postular']}>
        <Routes>
          <Route path="/vacantes/:vacanteId/postular" element={<Postular />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Todo lo obligatorio menos el permiso. */
async function rellenarSinAceptar() {
  const archivo = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })
  const campoArchivo = document.querySelector<HTMLInputElement>('input[type=file]')!
  fireEvent.change(campoArchivo, { target: { files: [archivo] } })

  fireEvent.change(screen.getByRole('textbox', { name: /cuéntalo con tus palabras/i }), {
    target: { value: 'Ordené el reporte semanal que antes tardaba tres horas.' },
  })

  fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
}

function laCasilla() {
  return screen.getByRole('checkbox')
}

beforeEach(() => {
  enviados.length = 0

  // jsdom 30 todavia no implementa `showModal` ni `close` de `<dialog>`, y la
  // pantalla usa el elemento nativo a proposito —foco atrapado y tecla de
  // escape gratis—. Sin esto el envio revienta con «close is not a function»,
  // que es un hueco del entorno de pruebas y no un fallo del producto.
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

describe('el permiso de tratamiento de datos', () => {
  it('no deja enviar sin marcarlo, aunque todo lo demás esté completo', async () => {
    montar()
    await screen.findByRole('checkbox')
    await rellenarSinAceptar()

    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

    await waitFor(() => {
      expect(screen.getByText(/sin este permiso/i)).toBeTruthy()
    })
    expect(enviados).toHaveLength(0)
  })

  it('manda el valor de la casilla, no un true fijo', async () => {
    montar()
    await screen.findByRole('checkbox')
    await rellenarSinAceptar()
    fireEvent.click(laCasilla())

    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect((enviados[0] as { aceptaTratamiento: boolean }).aceptaTratamiento).toBe(true)
  })

  it('ata el error a la casilla para que el foco pueda encontrarla', async () => {
    montar()
    await screen.findByRole('checkbox')
    await rellenarSinAceptar()

    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

    await waitFor(() => {
      expect(laCasilla().getAttribute('aria-invalid')).toBe('true')
    })
  })

  it('el error desaparece en cuanto se marca', async () => {
    montar()
    await screen.findByRole('checkbox')
    await rellenarSinAceptar()
    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))
    await waitFor(() => expect(screen.getByText(/sin este permiso/i)).toBeTruthy())

    fireEvent.click(laCasilla())

    await waitFor(() => {
      expect(screen.queryByText(/sin este permiso/i)).toBeNull()
    })
  })

  it('gana al aviso de los requisitos: sin permiso no se pregunta si quiere enviarla igual', async () => {
    montar()
    await screen.findByRole('checkbox')

    const archivo = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type=file]')!, {
      target: { files: [archivo] },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /cuéntalo con tus palabras/i }), {
      target: { value: 'Ordené el reporte semanal que antes tardaba tres horas.' },
    })
    // Dice que NO cumple el requisito: eso normalmente abre el aviso del
    // descarte automatico. Sin el permiso, no debe abrirse.
    fireEvent.click(screen.getByRole('radio', { name: 'No' }))

    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

    await waitFor(() => expect(screen.getByText(/sin este permiso/i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /enviarla de todos modos/i })).toBeNull()
    expect(enviados).toHaveLength(0)
  })
})
