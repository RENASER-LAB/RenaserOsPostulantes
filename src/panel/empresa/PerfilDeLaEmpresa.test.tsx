import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import type { GuardarBrochure, GuardarPresentacion, PresentacionPanel } from '../api/presentacion'
import { PerfilDeLaEmpresaPanel } from './PerfilDeLaEmpresa'

const verPresentacion = vi.fn()
const guardarPresentacion = vi.fn()
const guardarBrochure = vi.fn()
const descargarBrochure = vi.fn()

vi.mock('../api/presentacion', async (original) => ({
  ...(await original<typeof import('../api/presentacion')>()),
  verPresentacion: () => verPresentacion(),
  guardarPresentacion: (d: GuardarPresentacion) => guardarPresentacion(d),
  guardarBrochure: (d: GuardarBrochure) => guardarBrochure(d),
  subirImagenDeLaEmpresa: vi.fn(),
  quitarImagenDeLaEmpresa: vi.fn(),
  descargarBrochure: () => descargarBrochure(),
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
  guardarBrochure.mockReset()
  descargarBrochure.mockReset()
  vi.restoreAllMocks()
})

/** La dirección de la pantalla, para ver la pestaña reflejada en ella. */
function Ubicacion() {
  const { pathname, search } = useLocation()
  return <output data-testid="ubicacion">{`${pathname}${search}`}</output>
}

function abrir(ruta = '/admin/empresa') {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={[ruta]}>
        <PerfilDeLaEmpresaPanel />
        <Ubicacion />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ubicacion = () => screen.getByTestId('ubicacion').textContent

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

// ==================== El brochure (V86) ====================

const CON_QUIENES: PresentacionPanel = {
  ...VACIA,
  quienesSomos: 'Construimos casas que duran.',
  plantillaBrochure: 'CLASICA',
  colorBrochure: 'AZUL',
}

/** Una pestaña de mentira: `window.open` la devuelve y el PDF se carga en ella. */
function pestana() {
  const ventana = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(ventana as unknown as Window)
  URL.createObjectURL = vi.fn(() => 'blob:brochure')
  URL.revokeObjectURL = vi.fn()
  return ventana
}

/** Una promesa que se resuelve o se rechaza desde la prueba. */
function aMano<T>() {
  let resolver: (valor: T) => void = () => {}
  let rechazar: (causa: unknown) => void = () => {}
  const promesa = new Promise<T>((si, no) => {
    resolver = si
    rechazar = no
  })
  return { promesa, resolver, rechazar }
}

/** El backend devuelve lo guardado con la elección nueva, como `PUT /presentacion/brochure`. */
const responderConLaEleccion = (base: PresentacionPanel) => (d: GuardarBrochure) =>
  Promise.resolve({ ...base, plantillaBrochure: d.plantillaBrochure, colorBrochure: d.colorBrochure })

const radio = (nombre: string) => screen.getByRole('radio', { name: new RegExp(`^${nombre}$`) })
const laPestana = (nombre: string) => screen.getByRole('tab', { name: nombre })
const hoja = () => screen.getByRole('img', { name: /^Primera hoja del brochure/ })

async function irABrochure() {
  fireEvent.click(await screen.findByRole('tab', { name: 'Brochure' }))
  return screen.getByRole('tabpanel', { name: 'Brochure' })
}

describe('«Perfil de la empresa»: las pestañas «Perfil» y «Brochure»', () => {
  it('«Perfil» por defecto: Identidad, Presentación y Video y enlaces, nada del brochure y ninguna mención a «opcional»', async () => {
    abrir()
    expect(((await screen.findByLabelText('Misión')) as HTMLTextAreaElement).value).toBe('')
    expect((campo('Visión') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getAllByText('0 / 400')).toHaveLength(2)

    const lista = screen.getByRole('tablist', { name: 'Secciones del perfil de la empresa' })
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Perfil', 'Brochure'])
    expect(laPestana('Perfil').getAttribute('aria-selected')).toBe('true')
    expect(laPestana('Brochure').getAttribute('aria-selected')).toBe('false')
    const panel = screen.getByRole('tabpanel', { name: 'Perfil' })
    expect(laPestana('Perfil').getAttribute('aria-controls')).toBe(panel.id)

    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Identidad', 'Presentación', 'Video y enlaces'])
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Descargar brochure (PDF)' })).toBeNull()
    expect(panel.textContent).not.toMatch(/brochure/i)
    expect(within(panel).getByRole('button', { name: 'Guardar' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/opcional/i)
    expect(ubicacion()).toBe('/admin/empresa')
  })

  it('AC-01: en «Brochure», «Clásica» y «Azul», la primera hoja al lado y el botón apagado con «Falta «Quiénes somos»»; la dirección dice ?pestana=brochure', async () => {
    abrir()
    const panel = await irABrochure()
    expect(ubicacion()).toBe('/admin/empresa?pestana=brochure')
    expect(laPestana('Brochure').getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('form', { name: 'Perfil de la empresa' })).toBeNull()

    expect(within(panel).getAllByRole('radio')).toHaveLength(9)
    expect(radio('Clásica').getAttribute('aria-checked')).toBe('true')
    expect(radio('Portada').getAttribute('aria-checked')).toBe('false')
    expect(radio('Azul').getAttribute('aria-checked')).toBe('true')
    expect(hoja().getAttribute('aria-label')).toBe('Primera hoja del brochure: Clásica, Azul')
    expect(hoja().querySelector('svg')).toBeTruthy()

    const boton = within(panel).getByRole('button', { name: 'Descargar brochure (PDF)' }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect(within(panel).getByText('Falta «Quiénes somos»')).toBeTruthy()
    expect(within(panel).queryByText('Usa lo último guardado')).toBeNull()
    // Se guarda al elegir: ni «Guardar» ni «Dejarlo», y ninguna línea de ayuda.
    expect(within(panel).queryByRole('button', { name: 'Guardar' })).toBeNull()
    expect(within(panel).queryByRole('button', { name: 'Dejarlo' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/opcional/i)

    // Con el teclado, como las demás pestañas del panel.
    fireEvent.keyDown(laPestana('Brochure'), { key: 'ArrowLeft' })
    expect(laPestana('Perfil').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(laPestana('Perfil'))
    expect(ubicacion()).toBe('/admin/empresa')
  })

  it('con ?pestana=brochure en la dirección abre directamente «Brochure»', async () => {
    abrir('/admin/empresa?pestana=brochure')
    expect(await screen.findByRole('tabpanel', { name: 'Brochure' })).toBeTruthy()
    expect(laPestana('Brochure').getAttribute('aria-selected')).toBe('true')
  })

  it('cambiar de pestaña no pierde lo escrito: en «Brochure» sale «Usa lo último guardado» y al volver el texto sigue', async () => {
    verPresentacion.mockResolvedValue(CON_QUIENES)
    abrir()
    fireEvent.change(await screen.findByLabelText('Quiénes somos'), { target: { value: 'Otra cosa sin guardar' } })
    fireEvent.change(campo('Nuevo beneficio'), { target: { value: 'Seguro EPS' } })

    const panel = await irABrochure()
    expect(within(panel).getByText('Usa lo último guardado')).toBeTruthy()
    expect(within(panel).queryByText('Falta «Quiénes somos»')).toBeNull()

    fireEvent.click(laPestana('Perfil'))
    expect(campo('Quiénes somos').value).toBe('Otra cosa sin guardar')
    expect(campo('Nuevo beneficio').value).toBe('Seguro EPS')
    expect(screen.getByRole('button', { name: 'Dejarlo' })).toBeTruthy()
  })

  it('AC-05: elegir «Columnas» y «Petróleo» se guarda solo, al momento, y la primera hoja cambia con ellos', async () => {
    guardarBrochure.mockImplementation(responderConLaEleccion(CON_QUIENES))
    verPresentacion.mockResolvedValue(CON_QUIENES)
    abrir()
    await irABrochure()

    fireEvent.click(radio('Columnas'))
    expect(radio('Columnas').getAttribute('aria-checked')).toBe('true')
    expect(radio('Clásica').getAttribute('aria-checked')).toBe('false')
    expect(guardarBrochure).toHaveBeenLastCalledWith({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'AZUL' })
    await waitFor(() => expect(guardarBrochure).toHaveBeenCalledTimes(1))

    fireEvent.click(radio('Petróleo'))
    await waitFor(() =>
      expect(guardarBrochure).toHaveBeenLastCalledWith({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'PETROLEO' }),
    )
    expect(radio('Petróleo').getAttribute('aria-checked')).toBe('true')
    expect(hoja().getAttribute('aria-label')).toBe('Primera hoja del brochure: Columnas, Petróleo')
    expect(hoja().innerHTML).toContain('#155E75')
    // La elegida otra vez no vuelve a guardar; «Guardar» del perfil nunca se llamó.
    fireEvent.click(radio('Petróleo'))
    expect(guardarBrochure).toHaveBeenCalledTimes(2)
    expect(guardarPresentacion).not.toHaveBeenCalled()

    // Guardado: al volver a la pestaña sigue elegido, y no hay nada sin guardar en el perfil.
    fireEvent.click(laPestana('Perfil'))
    expect(screen.queryByRole('button', { name: 'Dejarlo' })).toBeNull()
    await irABrochure()
    expect(radio('Columnas').getAttribute('aria-checked')).toBe('true')
    expect(radio('Petróleo').getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('Usa lo último guardado')).toBeNull()
  })

  it('si no se guarda, vuelve la elección anterior y dice «No se guardó la elección.»', async () => {
    guardarBrochure.mockRejectedValueOnce(new ErrorApi(0, 'Sin red'))
    verPresentacion.mockResolvedValue(CON_QUIENES)
    abrir()
    const panel = await irABrochure()

    fireEvent.click(radio('Portada'))
    expect(await within(panel).findByRole('alert')).toHaveProperty('textContent', 'No se guardó la elección.')
    expect(radio('Clásica').getAttribute('aria-checked')).toBe('true')
    expect(radio('Portada').getAttribute('aria-checked')).toBe('false')
    expect(hoja().getAttribute('aria-label')).toBe('Primera hoja del brochure: Clásica, Azul')

    // Otra elección lo vuelve a intentar y el aviso se va.
    guardarBrochure.mockImplementation(responderConLaEleccion(CON_QUIENES))
    fireEvent.click(radio('Verde'))
    expect(within(panel).queryByText('No se guardó la elección.')).toBeNull()
    await waitFor(() => expect(guardarBrochure).toHaveBeenCalledTimes(2))
    expect(guardarBrochure).toHaveBeenLastCalledWith({ plantillaBrochure: 'CLASICA', colorBrochure: 'VERDE' })
    await waitFor(() => expect(radio('Verde').getAttribute('aria-checked')).toBe('true'))
  })

  it('lo que se elige mientras se guarda la anterior se guarda después, en orden, y queda lo último', async () => {
    const primera = aMano<PresentacionPanel>()
    guardarBrochure.mockReturnValueOnce(primera.promesa).mockImplementation(responderConLaEleccion(CON_QUIENES))
    verPresentacion.mockResolvedValue(CON_QUIENES)
    abrir()
    await irABrochure()

    fireEvent.click(radio('Portada'))
    fireEvent.click(radio('Rojo'))
    fireEvent.click(radio('Noche'))
    // Se ve lo último, y hasta que conteste el primero no sale otro.
    expect(radio('Portada').getAttribute('aria-checked')).toBe('true')
    expect(radio('Noche').getAttribute('aria-checked')).toBe('true')
    expect(guardarBrochure).toHaveBeenCalledTimes(1)

    primera.resolver({ ...CON_QUIENES, plantillaBrochure: 'PORTADA', colorBrochure: 'AZUL' })
    await waitFor(() => expect(guardarBrochure).toHaveBeenCalledTimes(2))
    expect(guardarBrochure).toHaveBeenLastCalledWith({ plantillaBrochure: 'PORTADA', colorBrochure: 'NOCHE' })
    await waitFor(() => expect(radio('Noche').getAttribute('aria-checked')).toBe('true'))
    expect(radio('Portada').getAttribute('aria-checked')).toBe('true')
  })

  it('guardar la plantilla no borra lo escrito en «Perfil», y «Guardar» no manda ni la plantilla ni el color', async () => {
    guardarBrochure.mockImplementation(responderConLaEleccion(CON_QUIENES))
    guardarPresentacion.mockImplementation((d: GuardarPresentacion) =>
      Promise.resolve({ ...CON_QUIENES, ...d, plantillaBrochure: 'PORTADA', colorBrochure: 'AZUL' }),
    )
    verPresentacion.mockResolvedValue(CON_QUIENES)
    abrir()
    fireEvent.change(await screen.findByLabelText('Misión'), { target: { value: 'Construir bien.' } })

    await irABrochure()
    fireEvent.click(radio('Portada'))
    await waitFor(() => expect(guardarBrochure).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(radio('Portada').getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByText('Usa lo último guardado')).toBeTruthy()

    fireEvent.click(laPestana('Perfil'))
    expect(campo('Misión').value).toBe('Construir bien.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('Guardado. Tu perfil y tus vacantes publicadas ya lo muestran.')
    const cuerpo = guardarPresentacion.mock.calls[0]![0] as GuardarPresentacion
    expect(cuerpo.mision).toBe('Construir bien.')
    expect(cuerpo).not.toHaveProperty('plantillaBrochure')
    expect(cuerpo).not.toHaveProperty('colorBrochure')

    await irABrochure()
    expect(radio('Portada').getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('Usa lo último guardado')).toBeNull()
  })

  it('las flechas mueven la elección, como un grupo de radios, y cada una se guarda', async () => {
    guardarBrochure.mockImplementation(responderConLaEleccion(VACIA))
    abrir()
    await irABrochure()
    expect(radio('Clásica').tabIndex).toBe(0)
    expect(radio('Portada').tabIndex).toBe(-1)
    fireEvent.keyDown(radio('Clásica'), { key: 'ArrowRight' })
    expect(radio('Portada').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radio('Portada'))
    await waitFor(() =>
      expect(guardarBrochure).toHaveBeenLastCalledWith({ plantillaBrochure: 'PORTADA', colorBrochure: 'AZUL' }),
    )
    fireEvent.keyDown(radio('Azul'), { key: 'ArrowLeft' })
    expect(radio('Ciruela').getAttribute('aria-checked')).toBe('true')
    await waitFor(() =>
      expect(guardarBrochure).toHaveBeenLastCalledWith({ plantillaBrochure: 'PORTADA', colorBrochure: 'CIRUELA' }),
    )
  })

  it('AC-06: con cambios sin guardar en «Perfil» sale «Usa lo último guardado» y la descarga abre lo guardado en otra pestaña', async () => {
    verPresentacion.mockResolvedValue(CON_QUIENES)
    const ventana = pestana()
    const archivo = aMano<{ contenido: Blob; nombre: string }>()
    descargarBrochure.mockReturnValue(archivo.promesa)
    abrir()
    fireEvent.change(await screen.findByLabelText('Quiénes somos'), { target: { value: 'Otra cosa sin guardar' } })
    const panel = await irABrochure()
    expect(within(panel).getByText('Usa lo último guardado')).toBeTruthy()
    expect(within(panel).queryByText('Falta «Quiénes somos»')).toBeNull()

    fireEvent.click(within(panel).getByRole('button', { name: 'Descargar brochure (PDF)' }))
    // Mientras se arma no se puede volver a pulsar.
    const generando = (await screen.findByRole('button', { name: 'Generando…' })) as HTMLButtonElement
    expect(generando.disabled).toBe(true)
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(ventana.opener).toBeNull()

    archivo.resolver({ contenido: new Blob(['%PDF'], { type: 'application/pdf' }), nombre: 'Brochure - Acme S.A.C..pdf' })
    // QA-BROCH-01/02: la pestaña va a la dirección del PDF de la propia empresa —la que el
    // backend sirve con «Brochure - {empresa}.pdf» y el visor vuelve a pedir—, no a un `blob:`.
    await waitFor(() => expect(ventana.location.href).toBe('/api/v1/portal/empresas/acme/brochure'))
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(descargarBrochure).toHaveBeenCalledTimes(1)
    // No se mandó lo escrito: la descarga es de lo guardado.
    expect(guardarPresentacion).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Descargar brochure (PDF)' })).toBeTruthy()
    // Y lo escrito sigue en «Perfil».
    fireEvent.click(laPestana('Perfil'))
    expect(campo('Quiénes somos').value).toBe('Otra cosa sin guardar')
  })

  it('la descarga pulsada mientras se guarda la elección espera a que termine, para salir con ella', async () => {
    verPresentacion.mockResolvedValue(CON_QUIENES)
    const ventana = pestana()
    const eleccion = aMano<PresentacionPanel>()
    guardarBrochure.mockReturnValue(eleccion.promesa)
    descargarBrochure.mockResolvedValue({ contenido: new Blob(['%PDF']), nombre: 'Brochure - Acme S.A.C..pdf' })
    abrir()
    const panel = await irABrochure()

    fireEvent.click(radio('Columnas'))
    fireEvent.click(within(panel).getByRole('button', { name: 'Descargar brochure (PDF)' }))
    // La pestaña se abre al momento, dentro del clic, pero el PDF no se pide todavía.
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    await screen.findByRole('button', { name: 'Generando…' })
    expect(descargarBrochure).not.toHaveBeenCalled()

    eleccion.resolver({ ...CON_QUIENES, plantillaBrochure: 'COLUMNAS', colorBrochure: 'AZUL' })
    await waitFor(() => expect(descargarBrochure).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(ventana.location.href).toBe('/api/v1/portal/empresas/acme/brochure'))
  })

  it('si el armado falla dice «No se pudo armar el brochure.», cierra la pestaña y deja volver a pulsar', async () => {
    verPresentacion.mockResolvedValue(CON_QUIENES)
    const ventana = pestana()
    descargarBrochure.mockRejectedValue(new ErrorApi(500, 'Error'))
    abrir('/admin/empresa?pestana=brochure')
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar brochure (PDF)' }))

    expect(await screen.findByText('No se pudo armar el brochure.')).toBeTruthy()
    expect(ventana.close).toHaveBeenCalled()
    const boton = screen.getByRole('button', { name: 'Descargar brochure (PDF)' }) as HTMLButtonElement
    expect(boton.disabled).toBe(false)
  })

  it('lo guardado vuelve: misión y visión en «Perfil», plantilla y color en «Brochure»', async () => {
    verPresentacion.mockResolvedValue({
      ...CON_QUIENES,
      mision: 'Moler bien.',
      vision: 'Ser del sur.',
      plantillaBrochure: 'PORTADA',
      colorBrochure: 'VERDE',
    })
    abrir()
    expect(((await screen.findByLabelText('Misión')) as HTMLTextAreaElement).value).toBe('Moler bien.')
    expect((campo('Visión') as HTMLTextAreaElement).value).toBe('Ser del sur.')
    expect(screen.getByText('11 / 400')).toBeTruthy()
    await irABrochure()
    expect(radio('Portada').getAttribute('aria-checked')).toBe('true')
    expect(radio('Verde').getAttribute('aria-checked')).toBe('true')
    expect(hoja().getAttribute('aria-label')).toBe('Primera hoja del brochure: Portada, Verde')
  })
})

describe('«Perfil de la empresa»: misión y visión', () => {
  it('AC-02: la misión sale al momento en la vista previa, bajo el propósito, y no admite el carácter 401', async () => {
    abrir()
    const mision = (await screen.findByLabelText('Misión')) as HTMLTextAreaElement
    expect(mision.maxLength).toBe(400)
    fireEvent.change(campo('Nuestro propósito'), { target: { value: 'Que nadie se quede sin pan.' } })
    fireEvent.change(mision, { target: { value: 'Moler el mejor trigo del sur.' } })

    const previa = screen.getByRole('complementary', { name: 'Vista previa del perfil público' })
    expect(within(previa).getByText('Moler el mejor trigo del sur.')).toBeTruthy()
    expect(within(previa).queryByText('Visión')).toBeNull()
    const textos = Array.from(previa.querySelectorAll('p')).map((p) => p.textContent)
    expect(textos.indexOf('Misión')).toBeGreaterThan(textos.indexOf('Nuestro propósito'))
    expect(screen.getByText('29 / 400')).toBeTruthy()
  })
})
