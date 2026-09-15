/**
 * El permiso de tratamiento de datos, ahora sin casilla.
 *
 * Aqui habia una casilla obligatoria y se retiro: enviar la candidatura a una
 * empresa que la persona eligio, despues de leer quien la recibe, es el acto
 * afirmativo que la ley 29733 pide. Lo que sigue es lo que una edicion de estilo
 * puede llevarse por delante sin que nada deje de compilar:
 *
 *   1. **Que el aviso nombre a la empresa.** Sin eso, la persona envia su
 *      curriculum sin saber a quien. Es lo unico que la casilla aportaba de
 *      verdad, y por eso el aviso va pegado al boton y no al principio.
 *   2. **Que el enlace lleve al texto** que se esta a punto de firmar.
 *   3. **Que se siga mandando el permiso.** El backend guarda la firma a nombre
 *      de esa empresa, con el texto, la fecha y la IP: sin este dato no hay
 *      constancia, y la constancia es lo que NO se retiro.
 *   4. **Que la casilla no vuelva sola.**
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

/** Todo lo obligatorio para poder enviar. */
async function rellenarElFormulario() {
  const archivo = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })
  const campoArchivo = document.querySelector<HTMLInputElement>('input[type=file]')!
  fireEvent.change(campoArchivo, { target: { files: [archivo] } })

  fireEvent.change(screen.getByRole('textbox', { name: /cuéntalo con tus palabras/i }), {
    target: { value: 'Ordené el reporte semanal que antes tardaba tres horas.' },
  })

  fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
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
  it('dice quién va a recibir la candidatura, justo encima del botón', async () => {
    montar()
    await screen.findByRole('button', { name: /enviar mi postulación/i })

    // El nombre de la empresa es lo único que la casilla aportaba de verdad, y
    // sigue ahí: sin él, la persona manda su currículum sin saber a quién.
    const aviso = screen.getByText(/Al enviar,/)
    expect(aviso.textContent).toContain('Clínica San Juan')
    expect(aviso.textContent).toContain('quedará registrado tu permiso')

    const enlace = screen.getByRole('link', { name: /política de privacidad/i })
    // Con la vacante dentro: la política tiene que enseñar el texto de ESTA empresa,
    // que puede haber publicado el suyo y entonces es el que se firma. Sin esto, el
    // enlace llevaría al general y no habría dónde leer el de verdad.
    expect(enlace.getAttribute('href')).toBe(
      '/politica-de-privacidad?vacante=7#el-texto-que-aceptas',
    )
  })

  it('ya no hay casilla que marcar', async () => {
    montar()
    await screen.findByRole('button', { name: /enviar mi postulación/i })

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText(/Permiso para tratar tus datos/i)).toBeNull()
  })

  it('el permiso viaja igual: sin él no hay constancia de quién consintió', async () => {
    montar()
    await screen.findByRole('button', { name: /enviar mi postulación/i })
    await rellenarElFormulario()

    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

    await waitFor(() => expect(enviados).toHaveLength(1))
    // El backend firma con este dato la fecha y la IP, y guarda el texto que se
    // enseñó. Quitar la casilla cambió CÓMO se da el permiso, no que se dé.
    expect(enviados[0]).toMatchObject({ aceptaTratamiento: true })
  })

  it('el aviso de los requisitos sigue interceptando el envío', async () => {
    // Era la prueba de que el permiso ganaba a este aviso. Sin casilla, este aviso
    // es el único que se interpone, y tiene que seguir haciéndolo: quien dice que
    // no cumple un indispensable merece saber que su postulación se cerrará.
    montar()
    await screen.findByRole('button', { name: /enviar mi postulación/i })

    const archivo = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type=file]')!, {
      target: { files: [archivo] },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /cuéntalo con tus palabras/i }), {
      target: { value: 'Ordené el reporte semanal que antes tardaba tres horas.' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'No' }))

    fireEvent.click(screen.getByRole('button', { name: /enviar mi postulación/i }))

    await waitFor(() =>
      expect(screen.getByText(/Esta postulación se va a cerrar/i)).toBeTruthy(),
    )
    expect(enviados).toHaveLength(0)
  })
})
