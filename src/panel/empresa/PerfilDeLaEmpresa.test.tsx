import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import type { GuardarPresentacion, PresentacionPanel } from '../api/presentacion'
import { PerfilDeLaEmpresaPanel } from './PerfilDeLaEmpresa'

const verPresentacion = vi.fn()
const guardarPresentacion = vi.fn()

vi.mock('../api/presentacion', async (original) => ({
  ...(await original<typeof import('../api/presentacion')>()),
  verPresentacion: () => verPresentacion(),
  guardarPresentacion: (d: GuardarPresentacion) => guardarPresentacion(d),
  subirImagenDeLaEmpresa: vi.fn(),
  quitarImagenDeLaEmpresa: vi.fn(),
}))
vi.mock('@/api/portal', () => ({
  verPerfilDeEmpresa: () =>
    Promise.resolve({ codigo: 'ACME', nombre: 'Acme S.A.C.', vacantes: [{ id: 1, titulo: 'Cajero', modalidad: 'Presencial' }] }),
}))
vi.mock('../Sesion', () => ({ useRetenerLaSesion: () => {} }))

const VACIA: PresentacionPanel = { codigo: 'ACME', nombre: 'Acme S.A.C.', beneficios: [], redes: {}, sedes: [] }

beforeEach(() => {
  verPresentacion.mockResolvedValue(VACIA)
})

afterEach(() => {
  cleanup()
  verPresentacion.mockReset()
  guardarPresentacion.mockReset()
})

function abrir() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter>
        <PerfilDeLaEmpresaPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement | HTMLTextAreaElement

describe('«Perfil de la empresa» en el panel', () => {
  it('AC-07: sin el permiso (403) no se enseña el editor', async () => {
    verPresentacion.mockRejectedValue(new ErrorApi(403, 'Permiso denegado'))
    abrir()
    expect(await screen.findByText(/No tienes permiso para editar el perfil de la empresa/)).toBeTruthy()
    expect(screen.queryByLabelText('Nuestro propósito')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('AC-01: la primera vez, los campos vacíos y la vista previa con el nombre y sus vacantes', async () => {
    abrir()
    expect(((await screen.findByLabelText('Nuestro propósito')) as HTMLTextAreaElement).value).toBe('')
    expect(campo('Nombre de la empresa').value).toBe('Acme S.A.C.')
    expect((campo('Nombre de la empresa') as HTMLInputElement).readOnly).toBe(true)
    const previa = screen.getByRole('complementary', { name: 'Vista previa del perfil público' })
    expect(within(previa).getByText('Acme S.A.C.')).toBeTruthy()
    expect(await within(previa).findByText('Vacantes abiertas (1)')).toBeTruthy()
    expect(within(previa).queryByText('Nuestro propósito')).toBeNull()
  })

  it('AC-25: al escribir en «Quiénes somos» la vista previa cambia en vivo', async () => {
    abrir()
    fireEvent.change(await screen.findByLabelText('Quiénes somos'), {
      target: { value: 'Somos una empresa arequipeña.' },
    })
    const previa = screen.getByRole('complementary', { name: 'Vista previa del perfil público' })
    expect(within(previa).getByText('Somos una empresa arequipeña.')).toBeTruthy()
  })

  it('AC-06: el contador del propósito está siempre a la vista y no deja pasar de 1500', async () => {
    abrir()
    const proposito = (await screen.findByLabelText('Nuestro propósito')) as HTMLTextAreaElement
    expect(proposito.maxLength).toBe(1500)
    expect(screen.getAllByText('0 / 1500')).toHaveLength(2)
    fireEvent.change(proposito, { target: { value: 'a'.repeat(1500) } })
    expect(screen.getByText('1500 / 1500')).toBeTruthy()
  })

  it('AC-03/04/05: los errores salen junto a cada campo y no se envía nada', async () => {
    abrir()
    fireEvent.change(await screen.findByLabelText('Página web'), { target: { value: 'javascript:alert(1)' } })
    fireEvent.change(campo('Video de presentación'), {
      target: { value: 'https://www.facebook.com/renaser/videos/123' },
    })
    fireEvent.change(campo('Instagram'), { target: { value: 'https://www.facebook.com/renaser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Escribe una dirección web que empiece por https://')).toBeTruthy()
    expect(screen.getByText('Pega el enlace de un video de YouTube o de Vimeo')).toBeTruthy()
    expect(screen.getByText('Este enlace no es de Instagram')).toBeTruthy()
    expect(screen.getByText('No se guardó nada. Corrige los campos marcados.')).toBeTruthy()
    expect(campo('Página web').getAttribute('aria-invalid')).toBe('true')
    expect(guardarPresentacion).not.toHaveBeenCalled()
  })

  it('AC-02: guarda todo junto, con «renaser.pe» como https://renaser.pe, y dice que ya se ve', async () => {
    guardarPresentacion.mockImplementation((d: GuardarPresentacion) =>
      Promise.resolve({ ...VACIA, ...d, redes: d.redes, beneficios: d.beneficios }),
    )
    abrir()
    fireEvent.change(await screen.findByLabelText('Nuestro propósito'), {
      target: { value: 'Que ninguna familia se quede sin pan.' },
    })
    fireEvent.change(campo('Video de presentación'), {
      target: { value: 'https://www.youtube.com/watch?v=abc123DEF45' },
    })
    fireEvent.change(campo('Página web'), { target: { value: 'renaser.pe' } })
    fireEvent.change(campo('Instagram'), { target: { value: 'https://www.instagram.com/renaser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Guardado. Tu perfil y tus vacantes publicadas ya lo muestran.')).toBeTruthy()
    expect(guardarPresentacion).toHaveBeenCalledTimes(1)
    const cuerpo = guardarPresentacion.mock.calls[0]![0] as GuardarPresentacion
    expect(cuerpo.paginaWeb).toBe('https://renaser.pe')
    expect(cuerpo.propositoEmpresa).toBe('Que ninguna familia se quede sin pan.')
    expect(cuerpo.redes).toEqual({ INSTAGRAM: 'https://www.instagram.com/renaser' })
    // La sección vuelve a mostrar lo guardado.
    await waitFor(() => expect(campo('Página web').value).toBe('https://renaser.pe'))
  })

  it('los errores del servidor se pintan en su campo; sin red, se conserva lo escrito', async () => {
    guardarPresentacion.mockRejectedValueOnce(
      new ErrorApi(400, 'x', { errores: { propositoEmpresa: 'El propósito admite hasta 1500 caracteres' } }),
    )
    abrir()
    fireEvent.change(await screen.findByLabelText('Nuestro propósito'), { target: { value: 'Algo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El propósito admite hasta 1500 caracteres')).toBeTruthy()

    guardarPresentacion.mockRejectedValueOnce(new ErrorApi(0, 'Sin red'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('No se pudo guardar.')).toBeTruthy()
    expect(campo('Nuestro propósito').value).toBe('Algo')
  })

  it('QA-PROP-01: «Vista previa» se esconde desde 1280 px con una regla que le gana a «.secundario»', async () => {
    abrir()
    await screen.findByLabelText('Nuestro propósito')
    const boton = within(screen.getByRole('form', { name: 'Perfil de la empresa' })).getByRole('button', {
      name: 'Vista previa',
    })
    expect(boton.className).toMatch(/botonPrevia/)
    expect(boton.className).not.toMatch(/chico/)

    // Un `display: none` en la hoja de la pantalla perdía contra el de `.secundario`
    // compuesto desde otra hoja: el botón salía a 1280 px junto a la vista previa ya
    // visible. El esconder y enseñar va en la variante con nombre de `piezas`.
    const pantalla = readFileSync(`${process.cwd()}/src/panel/empresa/PerfilDeLaEmpresa.module.css`, 'utf8')
    const regla = pantalla.match(/(^|\n)\.botonPrevia\s*\{([^}]*)\}/)
    expect(regla?.[2]).toMatch(/composes:\s*secundarioSinLateral from '..\/..\/estilos\/piezas.module.css';/)
    expect(pantalla).not.toMatch(/\.botonPrevia\s*\{[^}]*display/)

    const piezas = readFileSync(`${process.cwd()}/src/estilos/piezas.module.css`, 'utf8')
    const variante = piezas.indexOf('.secundarioSinLateral {')
    expect(variante).toBeGreaterThan(piezas.indexOf('.secundario {'))
    expect(piezas.slice(variante)).toMatch(
      /^\.secundarioSinLateral \{\s*composes: secundario;\s*display: none;\s*\}\s*@media \(max-width: 1279\.98px\) \{\s*\.secundarioSinLateral \{\s*display: inline-flex;\s*\}\s*\}/,
    )
  })
})
