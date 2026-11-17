/**
 * El «Video del puesto» del formulario de la vacante (V85): las mismas reglas y
 * errores que el video de la empresa, y el chip «Se usará el video de la
 * empresa» cuando está vacío y la empresa tiene el suyo.
 */

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  CamposComunes,
  VACANTE_VACIA,
  camposParaGuardar,
  loQueFaltaEnLaVacante,
  type DatosDeVacante,
} from './CamposDeLaVacante'

const verVideoDeLaEmpresa = vi.fn()

vi.mock('../api/presentacion', () => ({ verVideoDeLaEmpresa: () => verVideoDeLaEmpresa() }))
vi.mock('../api/panel', () => ({
  listarUsuarios: () => Promise.resolve([]),
  verCatalogos: () => Promise.resolve({ tiposCierre: [{ codigo: 'PERMANENTE', nombre: 'Permanente' }] }),
}))
vi.mock('@/api/portal', () => ({ catalogoUbigeo: () => Promise.resolve([]) }))

afterEach(() => {
  cleanup()
  verVideoDeLaEmpresa.mockReset()
})

const LISTA: DatosDeVacante = { ...VACANTE_VACIA, responsableUsuarioId: '3', titulo: 'Cajero', descripcion: 'Atiende caja' }

function Formulario({ inicial }: { inicial: DatosDeVacante }) {
  const [datos, setDatos] = useState(inicial)
  return (
    <CamposComunes
      datos={datos}
      poner={(campo) => (valor) => setDatos((antes) => ({ ...antes, [campo]: valor }))}
    />
  )
}

function abrir(inicial: DatosDeVacante = LISTA, { enUnFormulario = false } = {}) {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      {enUnFormulario ? (
        <form aria-label="Vacante" noValidate onSubmit={(e) => e.preventDefault()}>
          <Formulario inicial={inicial} />
        </form>
      ) : (
        <Formulario inicial={inicial} />
      )}
    </QueryClientProvider>,
  )
}

describe('el «Video del puesto»', () => {
  it('AC-24: un enlace de Facebook no deja guardar, con el aviso del formulario', () => {
    expect(
      loQueFaltaEnLaVacante({ ...LISTA, videoPresentacion: 'https://www.facebook.com/renaser/videos/123' }),
    ).toBe('Corrige lo marcado en «Video del puesto».')
    expect(loQueFaltaEnLaVacante({ ...LISTA, videoPresentacion: 'youtu.be/abc123DEF45' })).toBeNull()
  })

  it('viaja normalizado; vacío viaja vacío para quitarlo', () => {
    expect(camposParaGuardar({ ...LISTA, videoPresentacion: ' youtu.be/abc123DEF45 ' }).videoPresentacion).toBe(
      'https://youtu.be/abc123DEF45',
    )
    expect(camposParaGuardar(LISTA).videoPresentacion).toBe('')
  })

  it('AC-23: vacío y con video de la empresa, el chip «Se usará el video de la empresa»', async () => {
    verVideoDeLaEmpresa.mockResolvedValue({ tieneVideo: true })
    abrir()
    expect(await screen.findByText('Se usará el video de la empresa')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Video del puesto (opcional)'), {
      target: { value: 'https://vimeo.com/123456789' },
    })
    expect(screen.queryByText('Se usará el video de la empresa')).toBeNull()
  })

  it('sin video de la empresa no hay chip, y el error sale al dejar el campo, con borde rojo', async () => {
    verVideoDeLaEmpresa.mockResolvedValue({ tieneVideo: false })
    abrir()
    const entrada = screen.getByLabelText('Video del puesto (opcional)')
    fireEvent.change(entrada, { target: { value: 'https://www.facebook.com/renaser/videos/123' } })
    expect(screen.queryByText('Pega el enlace de un video de YouTube o de Vimeo')).toBeNull()
    fireEvent.blur(entrada)
    expect(screen.getByText('Pega el enlace de un video de YouTube o de Vimeo')).toBeTruthy()
    expect(entrada.getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByText('Se usará el video de la empresa')).toBeNull()
  })

  it('QA-PROP-03: al enviar el formulario sin dejar el campo (Enter) también lo marca; vacío no', async () => {
    verVideoDeLaEmpresa.mockResolvedValue({ tieneVideo: false })
    abrir(LISTA, { enUnFormulario: true })
    const entrada = screen.getByLabelText('Video del puesto (opcional)') as HTMLInputElement
    const formulario = screen.getByRole('form', { name: 'Vacante' })

    fireEvent.submit(formulario)
    expect(entrada.getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText('Pega el enlace de un video de YouTube o de Vimeo')).toBeNull()

    entrada.focus()
    fireEvent.change(entrada, { target: { value: 'https://www.facebook.com/renaser/videos/123' } })
    fireEvent.submit(formulario)
    expect(document.activeElement).toBe(entrada)
    expect(entrada.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(entrada.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Pega el enlace de un video de YouTube o de Vimeo',
    )
  })
})
