/**
 * El trato del sueldo, en el formulario de postular.
 *
 * Es simetrico y las dos mitades se rompen de formas distintas, las dos
 * silenciosas:
 *
 *   1. **Que se pueda enviar sin la cifra cuando la vacante SI publica la
 *      suya.** El backend contesta 400 y el candidato descubre lo que faltaba
 *      despues de subir su curriculum, en un mensaje que la pantalla pudo
 *      haberle ahorrado.
 *   2. **Que se pida cuando la vacante NO publica nada.** Ese es exactamente el
 *      desequilibrio que este trato vino a romper, y compila igual de bien.
 *   3. **Que el prellenado del perfil pise lo que la persona acaba de teclear.**
 *      Una revalidacion de react-query basta: cambiar de pestaña y volver.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Postular } from './Postular'

const BASE = {
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
  requisitosObjetivos: [],
}

const CON_RANGO = {
  ...BASE,
  remuneracion: {
    tipo: 'RANGO' as const,
    min: 3000,
    max: 4000,
    moneda: 'PEN',
    texto: 'S/ 3 000 a 4 000',
    actualizadaEn: null,
  },
}

const SIN_SUELDO = {
  ...BASE,
  remuneracion: {
    tipo: 'OCULTA' as const,
    min: null,
    max: null,
    moneda: null,
    texto: 'No la publica',
    actualizadaEn: null,
  },
}

let vacante: typeof CON_RANGO | typeof SIN_SUELDO = CON_RANGO
let pretensionDelPerfil: { min: number; max: number; moneda: string } | null = null
const enviados: Record<string, unknown>[] = []

vi.mock('@/api/portal', () => ({
  verVacante: () => Promise.resolve(vacante),
  consentimientoDeVacante: () =>
    Promise.resolve({ nombreEmpresa: 'Clínica San Juan', version: '1.0', texto: 'Legal.' }),
  postular: (datos: Record<string, unknown>) => {
    enviados.push(datos)
    return Promise.resolve({ codigo: 'uuid-de-prueba' })
  },
}))

vi.mock('@/api/perfil', () => ({
  verPerfil: () =>
    Promise.resolve({
      titular: null,
      resumen: null,
      habilidades: [],
      experienciaMeses: null,
      ubicacion: null,
      disponibilidad: null,
      pretension: pretensionDelPerfil,
      experiencia: [],
      educacion: [],
      idiomas: [],
      certificaciones: [],
      enlaces: [],
      lecturaCv: { estado: 'SIN_CV', actualizadoEn: null },
      tieneFoto: false,
      portada: { tipo: 'NINGUNA', codigo: null },
      // Con curriculum guardado: asi la pantalla no exige adjuntar uno y las
      // pruebas se concentran en lo del sueldo.
      cv: { nombre: 'cv.pdf', tamano: 1024, subidoEn: '2026-09-01T10:00:00Z' },
    }),
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

const campoPretension = () => screen.getByLabelText(/tu pretensión mensual/i)

/** Lo obligatorio que no es el sueldo. */
function rellenarLoDemas() {
  fireEvent.change(screen.getByRole('textbox', { name: /cuéntalo con tus palabras/i }), {
    target: { value: 'Ordené el reporte semanal que antes tardaba tres horas.' },
  })
  fireEvent.click(screen.getByRole('checkbox'))
}

const enviar = () =>
  fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

beforeEach(() => {
  enviados.length = 0
  vacante = CON_RANGO
  pretensionDelPerfil = null

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

describe('cuando la vacante publica lo que paga', () => {
  it('pide la pretensión, y enseña al lado lo que ofrece la empresa', async () => {
    montar()
    await screen.findByRole('checkbox')

    expect(campoPretension()).toBeTruthy()
    // La cifra de la empresa se repite aqui: estaba en la pantalla anterior y ya
    // no se ve. Pedirle la suya sin recordarle la de ellos le obliga a volver
    // atras o a decidir de memoria.
    expect(screen.getAllByText('S/ 3 000 a 4 000').length).toBeGreaterThan(0)
  })

  it('no deja enviar sin la cifra, y lo dice antes de tocar el servidor', async () => {
    montar()
    await screen.findByRole('checkbox')
    rellenarLoDemas()

    enviar()

    await screen.findByText(/dinos cuánto quieres ganar/i)
    expect(enviados).toHaveLength(0)
  })

  it('rechaza el cero y la cifra absurda sin llamar al servidor', async () => {
    montar()
    await screen.findByRole('checkbox')
    rellenarLoDemas()

    fireEvent.change(campoPretension(), { target: { value: '0' } })
    enviar()
    await screen.findByText(/cifras enteras|soles enteros/i)
    expect(enviados).toHaveLength(0)

    // El dedo de mas: 35 000 000 donde queria 3 500.
    fireEvent.change(campoPretension(), { target: { value: '35000000' } })
    enviar()
    await screen.findByText(/error de tecleo/i)
    expect(enviados).toHaveLength(0)
  })

  it('«3,500» vale tres mil quinientos, no tres soles con cincuenta', async () => {
    // El bug que traia `Number('3,500')` → 3.5, que pasaba las tres validaciones
    // y dejaba registrado que esta persona pide S/ 3.50. Ver `dominio/dinero`.
    montar()
    await screen.findByRole('checkbox')
    rellenarLoDemas()
    fireEvent.change(campoPretension(), { target: { value: '3,500' } })

    enviar()

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]!.pretensionMonto).toBe(3500)
  })

  it('manda el monto y la moneda de la vacante', async () => {
    montar()
    await screen.findByRole('checkbox')
    rellenarLoDemas()
    fireEvent.change(campoPretension(), { target: { value: '3800' } })

    enviar()

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]!.pretensionMonto).toBe(3800)
    // La moneda sale de la vacante, no de una constante: una vacante en dolares
    // con una pretension marcada como soles es una llamada perdida.
    expect(enviados[0]!.pretensionMoneda).toBe('PEN')
  })
})

describe('cuando la vacante NO publica lo que paga', () => {
  it('no pide la pretensión, ni siquiera como opcional', async () => {
    vacante = SIN_SUELDO
    montar()
    await screen.findByRole('checkbox')

    expect(screen.queryByLabelText(/tu pretensión mensual/i)).toBeNull()
  })

  it('deja enviar sin ella, y no manda ningún monto', async () => {
    vacante = SIN_SUELDO
    montar()
    await screen.findByRole('checkbox')
    rellenarLoDemas()

    enviar()

    await waitFor(() => expect(enviados).toHaveLength(1))
    // Ni siquiera como `undefined` explicito: la clave no viaja. Aceptarle un
    // numero mientras la empresa calla el suyo es lo que esto no hace.
    expect('pretensionMonto' in enviados[0]!).toBe(false)
  })
})

describe('el prellenado desde el perfil', () => {
  it('propone el centro de su banda, no el borde bajo', async () => {
    // Quien puso «3000 a 4000» no esta diciendo que quiera 3000: prellenar con
    // el minimo le regalaria a la empresa el borde bajo de su expectativa cada
    // vez que alguien pulsa enviar sin mirar.
    pretensionDelPerfil = { min: 3000, max: 4000, moneda: 'PEN' }
    montar()
    await screen.findByRole('checkbox')

    await waitFor(() =>
      expect((campoPretension() as HTMLInputElement).value).toBe('3500'),
    )
  })

  it('sin nada guardado, el campo sale vacío', async () => {
    montar()
    await screen.findByRole('checkbox')

    expect((campoPretension() as HTMLInputElement).value).toBe('')
  })

  it('no pisa lo que la persona ya escribió', async () => {
    pretensionDelPerfil = { min: 3000, max: 4000, moneda: 'PEN' }
    montar()
    await screen.findByRole('checkbox')
    await waitFor(() =>
      expect((campoPretension() as HTMLInputElement).value).toBe('3500'),
    )

    fireEvent.change(campoPretension(), { target: { value: '4200' } })
    // Y aunque lo borre entero: vaciar el campo es una decision suya, y volver a
    // meterle el numero del perfil le reescribiria lo que acaba de quitar.
    fireEvent.change(campoPretension(), { target: { value: '' } })

    await waitFor(() =>
      expect((campoPretension() as HTMLInputElement).value).toBe(''),
    )
  })
})
