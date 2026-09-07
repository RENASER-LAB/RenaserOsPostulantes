import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DescargarCv } from './DescargarCv'
import { descargarArchivo } from '../api/panel'

vi.mock('../api/panel', () => ({ descargarArchivo: vi.fn() }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('descarga el archivo de la ficha con el nombre enviado por el backend', async () => {
  const contenido = new Blob(['CV'])
  vi.mocked(descargarArchivo).mockResolvedValue({ contenido, nombre: 'curriculum.pdf' })
  const crear = vi.fn(() => 'blob:cv')
  URL.createObjectURL = crear
  URL.revokeObjectURL = vi.fn()
  let nombre = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { nombre = this.download })
  render(<DescargarCv archivoId={42} nombre="original.pdf" />)
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(nombre).toBe('curriculum.pdf'))
  expect(descargarArchivo).toHaveBeenCalledWith(42)
  expect(crear).toHaveBeenCalledWith(contenido)
})

it('explica el fallo y permite reintentar cuando el archivo no está disponible', async () => {
  vi.mocked(descargarArchivo).mockRejectedValue(new Error('Archivo no disponible'))
  render(<DescargarCv archivoId={42} nombre="original.pdf" />)
  fireEvent.click(screen.getByRole('button'))
  expect((await screen.findByRole('alert')).textContent).toBe('Archivo no disponible')
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
})
