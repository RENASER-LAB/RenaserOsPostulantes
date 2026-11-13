/**
 * «Pruebas» en pantalla (spec pruebas-indice-de-la-empresa): las dos pestañas,
 * los filtros en la dirección, la vista previa, «Abrir en la vacante», «Usar en
 * otra vacante» con sus destinos, y los estados vacío, sin coincidencias y de error.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import type { FilaDePrueba, VacanteDestino } from '../api/pruebas'
import type { VersionDePreguntas } from '../api/preguntasPropias'
import { PruebasPanel } from './Pruebas'

const listar = vi.fn()
const ver = vi.fn()
const destinos = vi.fn()
const copiar = vi.fn()
vi.mock('../api/pruebas', async (original) => ({
  ...(await original<typeof import('../api/pruebas')>()),
  listarPruebas: (tipo: string) => listar(tipo),
  verPrueba: (id: number, tipo: string) => ver(id, tipo),
  listarDestinos: (tipo: string, excluir?: number) => destinos(tipo, excluir),
}))
vi.mock('../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../api/preguntasPropias')>()),
  copiarDeOtraVacante: (destino: number, origen: number, ruta?: string) => copiar(destino, origen, ruta),
}))

const fila = (cambios: Partial<FilaDePrueba>): FilaDePrueba => ({
  vacanteId: 1,
  titulo: 'Asistente Contable',
  sede: 'San Isidro, Lima',
  nivel: 'EJECUCION',
  situacion: 'PUBLICADA',
  estado: 'PUBLICADA',
  laRindeAlguien: false,
  hayBorradorAbierto: false,
  criterios: 4,
  preguntas: 12,
  entregables: null,
  modalidad: null,
  minutos: null,
  dias: null,
  publicadaEn: '2026-10-14T15:00:00Z',
  puedeUsarEnOtra: true,
  ...cambios,
})

const PREGUNTAS: FilaDePrueba[] = [
  fila({ vacanteId: 1, laRindeAlguien: true, hayBorradorAbierto: true }),
  fila({ vacanteId: 2, titulo: 'Jefe de Recursos Humanos', sede: null, nivel: 'DIRECCION', situacion: 'CERRADA', publicadaEn: '2026-07-28T15:00:00Z' }),
  fila({ vacanteId: 3, titulo: 'Analista de Marketing', sede: 'Surco, Lima', estado: 'BORRADOR', situacion: 'SIN_PUBLICAR', publicadaEn: null, puedeUsarEnOtra: false, criterios: 2, preguntas: 5 }),
]
const PRUEBA: FilaDePrueba[] = [
  fila({ vacanteId: 10, titulo: 'Diseñador Gráfico', sede: 'Barranco, Lima', criterios: 1, preguntas: 0, entregables: 3, modalidad: 'CRONOMETRADA', minutos: 90 }),
]

const version = (estado: 'PUBLICADA' | 'BORRADOR', avisos: string[] = []): VersionDePreguntas => ({
  id: estado === 'PUBLICADA' ? 80 : 81,
  estado,
  guiaCalificacion: null,
  minutosObjetivo: null,
  versionGuia: 1,
  total: 100,
  cuantosCriterios: 1,
  cuantasPreguntas: 1,
  sinCriterio: [],
  avisos,
  criterios: [
    { id: 5, nombre: estado === 'PUBLICADA' ? 'Rigor con los números' : 'Análisis de campañas', queEvalua: null, orden: 1, puntos: 100, puntosSistema: 0, puntosIa: 100, preguntas: [] },
  ],
})

const DESTINOS: VacanteDestino[] = [
  { vacanteId: 20, titulo: 'Contador Senior', sede: 'San Isidro, Lima', nivel: 'EJECUCION', situacion: 'PUBLICADA', tieneBorrador: true, puedeRecibir: true, motivo: null },
  { vacanteId: 21, titulo: 'Auxiliar Contable', sede: 'Chiclayo', nivel: 'EJECUCION', situacion: 'SIN_PUBLICAR', tieneBorrador: false, puedeRecibir: true, motivo: null },
  { vacanteId: 22, titulo: 'Cajero', sede: 'Miraflores, Lima', nivel: 'EJECUCION', situacion: 'PUBLICADA', tieneBorrador: false, puedeRecibir: false, motivo: 'Ya tiene postulantes: sus preguntas no se reemplazan' },
]

let ubicacion = ''
let irA: (destino: string) => void = () => {}
function Ubicacion() {
  const l = useLocation()
  ubicacion = `${l.pathname}${l.search}`
  irA = useNavigate()
  return null
}

function pintar(entrada = '/admin/pruebas') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[entrada]}>
        <Ubicacion />
        <Routes>
          <Route path="/admin/pruebas" element={<PruebasPanel />} />
          <Route path="/admin/vacantes/:id/preguntas" element={<p>El editor de preguntas</p>} />
          <Route path="/admin/vacantes/:id/prueba" element={<p>El editor de la prueba</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Una pantalla de tantos píxeles: lo que `matchMedia` contestaría. */
function anchoDePantalla(px: number) {
  window.matchMedia = ((consulta: string) => {
    const min = consulta.match(/min-width:\s*(\d+)/)
    const max = consulta.match(/max-width:\s*(\d+(?:\.\d+)?)/)
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false
    return { matches, media: consulta, addEventListener: () => {}, removeEventListener: () => {} }
  }) as unknown as typeof window.matchMedia
}

/** Como en el navegador: lo que está bajo `inert` no toma el foco (jsdom no lo sabe). */
function focoComoElNavegador() {
  const enfocar = HTMLElement.prototype.focus
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, opciones?: FocusOptions) {
    if (!this.closest('[inert]')) enfocar.call(this, opciones)
  })
}

const original = window.matchMedia
const tabla = () => screen.getByRole('table')
const filaDe = (titulo: string) =>
  within(tabla()).getByRole('button', { name: new RegExp(`^Ver ${titulo}`) }).closest('tr') as HTMLElement
const lectura = (titulo: RegExp) => screen.getByRole('region', { name: titulo })

beforeEach(() => {
  vi.clearAllMocks()
  listar.mockImplementation((tipo: string) => Promise.resolve(tipo === 'PRUEBA_PUESTO' ? PRUEBA : PREGUNTAS))
  ver.mockImplementation((id: number) => Promise.resolve(version(id === 3 ? 'BORRADOR' : 'PUBLICADA', ['Falta la fecha límite'])))
  destinos.mockResolvedValue(DESTINOS)
})
afterEach(() => {
  cleanup()
  window.matchMedia = original
})

describe('las dos pestañas (AC-02)', () => {
  it('abre en «Preguntas del Perfil Integral» con sus filas, su estado y su resumen', async () => {
    pintar()
    expect(await screen.findByRole('button', { name: /Ver Asistente Contable/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Pruebas.' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Preguntas del Perfil Integral/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /Prueba del puesto/ }).textContent).toContain('1')

    const contador = filaDe('Asistente Contable')
    // La marca del estado y la situación de la vacante
    expect(within(contador).getAllByText('Publicada')).toHaveLength(2)
    expect(within(contador).getByText('La rinde alguien')).toBeTruthy()
    expect(within(contador).getByText('Hay un borrador abierto')).toBeTruthy()
    expect(contador.textContent).toContain('4 criterios · 12 preguntas')
    expect(contador.textContent).toContain('14 oct 2026')
    expect(contador.textContent).toContain('San Isidro, Lima')

    const borrador = filaDe('Analista de Marketing')
    expect(within(borrador).getByText('Borrador')).toBeTruthy()
    expect(borrador.textContent).toContain('Sin publicar')
    // Las publicadas arriba, los borradores sin publicar abajo
    expect(screen.getByText('Publicadas')).toBeTruthy()
    expect(screen.getByText('Borradores sin publicar')).toBeTruthy()
  })

  it('la otra pestaña enseña la prueba con sus entregables y su tiempo, y queda en la dirección', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    fireEvent.click(screen.getByRole('tab', { name: /Prueba del puesto/ }))
    const disenador = await screen.findByRole('button', { name: /Ver Diseñador Gráfico/ })
    expect(disenador.closest('tr')!.textContent).toContain('1 criterio · 0 preguntas · 3 entregables · 90 min')
    expect(ubicacion).toContain('tipo=prueba')
  })

  it('cada parte del resumen va entera y el « · » queda fuera, para que la línea parta entre ellas (QA-PI-01)', async () => {
    pintar('/admin/pruebas?tipo=prueba&vacante=10')
    const disenador = await screen.findByRole('button', { name: /Ver Diseñador Gráfico/ })
    const partes = ['1 criterio', '0 preguntas', '3 entregables', '90 min']
    const enLaFila = within(disenador.closest('tr')!).getByText('90 min').parentElement!
    const enLaVista = within(lectura(/Diseñador Gráfico/)).getByText('90 min').parentElement!
    for (const resumen of [enLaFila, enLaVista]) {
      expect([...resumen.children].map((parte) => parte.textContent)).toEqual(partes)
      expect(resumen.textContent).toBe(partes.join(' · '))
    }
  })
})

describe('filtros y búsqueda (AC-06)', () => {
  it('desde la dirección: la pestaña, el texto y los filtros siguen puestos al recargar', async () => {
    pintar('/admin/pruebas?tipo=preguntas&buscar=jefe&nivel=DIRECCION&estado=PUBLICADA&situacion=CERRADA')
    expect(await screen.findByRole('button', { name: /Ver Jefe de Recursos Humanos/ })).toBeTruthy()
    expect(within(tabla()).queryByRole('button', { name: /Ver Asistente Contable/ })).toBeNull()
    expect((screen.getByRole('searchbox', { name: 'Buscar vacante o filtrar' }) as HTMLInputElement).value).toBe('jefe')
    expect(screen.getByRole('button', { name: 'Quitar Nivel: Dirección' })).toBeTruthy()
  })

  it('la columna de filtros cuenta y combina; «Limpiar» los quita', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    const columna = screen.getByRole('complementary', { name: 'Filtros' })
    const ejecucion = within(columna).getByRole('checkbox', { name: /Ejecución/ })
    expect(ejecucion.closest('label')!.textContent).toContain('2')
    fireEvent.click(ejecucion)
    fireEvent.click(within(columna).getByRole('checkbox', { name: /La rinde alguien/ }))
    expect(ubicacion).toContain('nivel=EJECUCION')
    expect(ubicacion).toContain('estado=EN_USO')
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(1)
    fireEvent.click(within(columna).getByRole('button', { name: 'Limpiar' }))
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(3)
  })

  it('por debajo de 1440 px, «Filtros» abre los grupos y «Quitar filtros» aparece con alguno', async () => {
    anchoDePantalla(1200)
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    expect(screen.queryByRole('complementary', { name: 'Filtros' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const ventana = screen.getByRole('dialog', { name: 'Filtros' })
    fireEvent.click(within(ventana).getByRole('button', { name: 'Cerrada' }))
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Filtros, 1 activos' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar filtros' }).at(-1)!)
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(3)
  })

  it('en el teléfono el botón dice «Filtrar (n)»', async () => {
    anchoDePantalla(390)
    pintar('/admin/pruebas?situacion=CERRADA')
    await screen.findByRole('button', { name: /Ver Jefe/ })
    expect(screen.getByRole('button', { name: 'Filtros, 1 activos' }).textContent).toContain('Filtrar (1)')
  })

  it('lo escrito que casa con un filtro se ofrece como etiqueta; Retroceso dos veces la quita', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    const linea = screen.getByRole('searchbox', { name: 'Buscar vacante o filtrar' })
    fireEvent.change(linea, { target: { value: 'dire' } })
    fireEvent.click(await screen.findByRole('button', { name: /Nivel Dirección/ }))
    expect(screen.getByRole('button', { name: 'Quitar Nivel: Dirección' })).toBeTruthy()
    expect((linea as HTMLInputElement).value).toBe('')
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(1)
    fireEvent.keyDown(linea, { key: 'Backspace' })
    expect(screen.getByRole('button', { name: 'Quitar Nivel: Dirección' })).toBeTruthy()
    fireEvent.keyDown(linea, { key: 'Backspace' })
    expect(screen.queryByRole('button', { name: 'Quitar Nivel: Dirección' })).toBeNull()
  })

  it('si los filtros no dejan nada: «Ninguna coincide con los filtros» y «Quitar filtros»', async () => {
    pintar('/admin/pruebas?nivel=SUPERVISION')
    expect(await screen.findByText('Ninguna coincide con los filtros')).toBeTruthy()
    const quitar = screen.getAllByRole('button', { name: 'Quitar filtros' })
    fireEvent.click(quitar.at(-1)!)
    expect(await screen.findByRole('button', { name: /Ver Asistente Contable/ })).toBeTruthy()
  })

  it('la línea no pierde letras aunque se teclee antes de que se pinte la dirección (QA-PI-03)', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    const linea = screen.getByRole('searchbox', { name: 'Buscar vacante o filtrar' }) as HTMLInputElement
    const ponerValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    // Tecla tras tecla sin `act`: la navegación va en una transición y todavía no se ha pintado.
    const entorno = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const antes = entorno.IS_REACT_ACT_ENVIRONMENT
    entorno.IS_REACT_ACT_ENVIRONMENT = false
    try {
      for (const letra of 'jefe ') {
        ponerValor.call(linea, linea.value + letra)
        linea.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } finally {
      entorno.IS_REACT_ACT_ENVIRONMENT = antes
    }
    expect(linea.value).toBe('jefe ')
    await waitFor(() => expect(ubicacion).toContain('buscar=jefe+'))
    expect(linea.value).toBe('jefe ')
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(1)
  })

  it('una dirección que llega de fuera trae su búsqueda; la línea la sigue (QA-PI-03)', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    const linea = screen.getByRole('searchbox', { name: 'Buscar vacante o filtrar' }) as HTMLInputElement
    fireEvent.change(linea, { target: { value: 'jefe' } })
    act(() => irA('/admin/pruebas?buscar=analista'))
    expect(linea.value).toBe('analista')
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(1)
    act(() => irA('/admin/pruebas'))
    expect(linea.value).toBe('')
    expect(within(tabla()).getAllByRole('button', { name: /^Ver / })).toHaveLength(3)
  })

  it('Enter en la línea abre la primera fila', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Buscar vacante o filtrar' }), { key: 'Enter' })
    await waitFor(() => expect(ubicacion).toContain('vacante=1'))
  })
})

describe('la vista previa (AC-07, AC-08, AC-09)', () => {
  it('con un borrador abierto, «Ver» enseña la publicada', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /Ver Asistente Contable/ }))
    expect(await screen.findByText('Rigor con los números')).toBeTruthy()
    expect(ver).toHaveBeenCalledWith(1, 'PERFIL_INTEGRAL')
    expect(screen.queryByText('Borrador: todavía puede cambiar')).toBeNull()
    expect(ubicacion).toContain('vacante=1')
  })

  it('solo borrador: se ve el borrador con su etiqueta, sin avisos ni «por arreglar»', async () => {
    pintar('/admin/pruebas?vacante=3')
    expect(await screen.findByText('Análisis de campañas')).toBeTruthy()
    expect(screen.getByText('Borrador: todavía puede cambiar')).toBeTruthy()
    expect(screen.queryByText('Falta la fecha límite')).toBeNull()
    expect(screen.queryByText(/por arreglar/)).toBeNull()
    // Un borrador no se usa en otra vacante
    expect(within(lectura(/Analista de Marketing/)).queryByRole('button', { name: /Usar en otra vacante/ })).toBeNull()
  })

  it('«Abrir en la vacante» lleva al editor de esa vacante, en su pestaña', async () => {
    pintar()
    await screen.findByRole('button', { name: /Ver Asistente Contable/ })
    expect(within(filaDe('Asistente Contable')).getByRole('link', { name: /Abrir «Asistente Contable/ }).getAttribute('href')).toBe(
      '/admin/vacantes/1/preguntas',
    )
    fireEvent.click(screen.getByRole('tab', { name: /Prueba del puesto/ }))
    await screen.findByRole('button', { name: /Ver Diseñador Gráfico/ })
    expect(within(filaDe('Diseñador')).getByRole('link', { name: /Abrir/ }).getAttribute('href')).toBe('/admin/vacantes/10/prueba')
  })

  it('Escape la cierra y la dirección lo olvida', async () => {
    pintar('/admin/pruebas?vacante=1')
    await screen.findByText('Rigor con los números')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(ubicacion).not.toContain('vacante='))
  })

  it('si la vacante ya no existe: «Esta vacante ya no existe» y la lista se refresca', async () => {
    ver.mockRejectedValue(new ErrorApi(404, 'Vacante not found'))
    pintar('/admin/pruebas?vacante=2')
    expect(await screen.findByText('Esta vacante ya no existe')).toBeTruthy()
    await waitFor(() => expect(listar.mock.calls.filter(([t]) => t === 'PERFIL_INTEGRAL').length).toBeGreaterThan(1))
  })

  it('si falla, un aviso con «Reintentar»', async () => {
    ver.mockRejectedValueOnce(new Error('caída'))
    pintar('/admin/pruebas?vacante=1')
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Rigor con los números')).toBeTruthy()
  })
})

describe('el teclado con la vista previa modal (QA-PI-02)', () => {
  for (const ancho of [900, 390]) {
    it(`a ${ancho} px, Enter la abre con el foco en su título y Escape lo devuelve a su fila, aunque la dirección se pinte tarde`, async () => {
      anchoDePantalla(ancho)
      pintar()
      const verContador = await screen.findByRole('button', { name: /Ver Asistente Contable/ })
      // Como en el navegador: el siguiente frame llega antes de que se pinte la navegación.
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((alLlegar) => {
        alLlegar(0)
        return 0
      })
      verContador.focus()
      fireEvent.click(verContador) // Enter sobre el botón: un clic sin ratón (detail 0).
      const hoja = document.getElementById('lectura')!
      expect(hoja.getAttribute('role')).toBe('dialog')
      expect(ubicacion).toContain('vacante=1')
      expect(document.activeElement).toBe(hoja.querySelector('[data-titulo-lectura]'))
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(ubicacion).not.toContain('vacante=')
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Ver Asistente Contable/ }))
    })
  }
})

describe('«Usar en otra vacante» (AC-10, AC-11, AC-12, AC-13)', () => {
  async function abrirLaCopia() {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Usar «Asistente Contable · San Isidro, Lima» en otra vacante' }))
    return screen.findByRole('radiogroup', { name: 'Vacante destino' })
  }

  it('sin editar_vacante no aparece, ni en la fila ni en la vista previa (AC-13)', async () => {
    listar.mockResolvedValue(PREGUNTAS.map((f) => ({ ...f, puedeUsarEnOtra: false })))
    pintar('/admin/pruebas?vacante=1')
    await screen.findByText('Rigor con los números')
    expect(screen.queryAllByRole('button', { name: /en otra vacante/ })).toHaveLength(0)
  })

  it('la que ya rinde alguien sale deshabilitada con su motivo; sin la de origen (AC-11)', async () => {
    const grupo = await abrirLaCopia()
    expect(destinos).toHaveBeenCalledWith('PERFIL_INTEGRAL', 1)
    const cajero = within(grupo).getByRole('radio', { name: /Cajero/ }) as HTMLInputElement
    expect(cajero.disabled).toBe(true)
    expect(grupo.textContent).toContain('Ya tiene postulantes: sus preguntas no se reemplazan')
    expect((within(grupo).getByRole('radio', { name: /Auxiliar Contable/ }) as HTMLInputElement).disabled).toBe(false)
  })

  it('una destino con borrador pide confirmar el reemplazo; al copiar se abre su editor (AC-10, AC-12)', async () => {
    copiar.mockResolvedValue({ vacanteId: 20, borrador: version('BORRADOR') })
    const grupo = await abrirLaCopia()
    fireEvent.click(within(grupo).getByRole('radio', { name: /Contador Senior/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar y abrir' }))
    expect(copiar).not.toHaveBeenCalled()
    expect(screen.getByText('Ya hay un borrador en esta vacante: la copia lo reemplaza entero.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar y copiar' }))
    await waitFor(() => expect(copiar).toHaveBeenCalledWith(20, 1, 'preguntas-propias'))
    expect(await screen.findByText('El editor de preguntas')).toBeTruthy()
    expect(ubicacion).toBe('/admin/vacantes/20/preguntas')
  })

  it('si la destino empezó a rendirse, el rechazo se dice, queda deshabilitada y la lista se pide otra vez', async () => {
    copiar.mockRejectedValue(new ErrorApi(409, 'Esta vacante ya tiene postulantes y sus preguntas no se cambian.'))
    const grupo = await abrirLaCopia()
    fireEvent.click(within(grupo).getByRole('radio', { name: /Auxiliar Contable/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar y abrir' }))
    expect(await screen.findByText('Esta vacante ya tiene postulantes y sus preguntas no se cambian.')).toBeTruthy()
    expect((within(grupo).getByRole('radio', { name: /Auxiliar Contable/ }) as HTMLInputElement).disabled).toBe(true)
    await waitFor(() => expect(destinos).toHaveBeenCalledTimes(2))
  })

  it('si la copia falla: «No se pudo copiar» con «Reintentar», y nada cambia', async () => {
    copiar.mockRejectedValueOnce(new Error('caída')).mockResolvedValueOnce({ vacanteId: 21 })
    const grupo = await abrirLaCopia()
    fireEvent.click(within(grupo).getByRole('radio', { name: /Auxiliar Contable/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar y abrir' }))
    expect(await screen.findByText('No se pudo copiar. La vacante destino no cambió.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('El editor de preguntas')).toBeTruthy()
  })

  it('desde la vista previa abierta, «Usar en otra vacante» despliega el bloque con el foco en su buscador y lo pliega', async () => {
    focoComoElNavegador()
    pintar('/admin/pruebas?vacante=1')
    const lecturaAbierta = await screen.findByRole('region', { name: /Asistente Contable/ })
    await within(lecturaAbierta).findByText('Rigor con los números')
    const alternar = within(lecturaAbierta).getByRole('button', { name: 'Usar en otra vacante' })
    fireEvent.click(alternar)
    expect(alternar.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(within(document.getElementById('bloque-de-copia')!).getByPlaceholderText('Buscar vacante…'))
    fireEvent.click(alternar)
    expect(document.getElementById('bloque-de-copia')).toBeNull()
    expect(ubicacion).toContain('vacante=1')
  })

  it('Escape cierra primero el bloque de copia y después la vista previa', async () => {
    await abrirLaCopia()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByRole('radiogroup', { name: 'Vacante destino' })).toBeNull()
    expect(ubicacion).toContain('vacante=1')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(ubicacion).not.toContain('vacante='))
  })

  // QA-PI-06 (ciclo 2): como en la maqueta, «Cancelar» pliega el bloque igual que Escape y deja
  // el foco en el botón que lo despliega, no en el `body`.
  it('«Cancelar» pliega el bloque y devuelve el foco a «Usar en otra vacante» de la vista previa', async () => {
    await abrirLaCopia()
    const bloque = document.getElementById('bloque-de-copia')!
    const cancelar = within(bloque).getByRole('button', { name: 'Cancelar' })
    cancelar.focus()
    fireEvent.click(cancelar)
    expect(document.getElementById('bloque-de-copia')).toBeNull()
    expect(ubicacion).toContain('vacante=1')
    const alternar = document.querySelector<HTMLElement>('#lectura [aria-controls="bloque-de-copia"]')!
    await waitFor(() => expect(document.activeElement).toBe(alternar))
    expect(alternar.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('una fila que ya se miró (QA-PI-04, QA-PI-05)', () => {
  const usarContador = () => screen.getByRole('button', { name: 'Usar «Asistente Contable · San Isidro, Lima» en otra vacante' })

  for (const ancho of [1440, 900, 390]) {
    it(`a ${ancho} px, «Usar en otra vacante» de la fila que se miró y se cerró deja el foco en el buscador del bloque`, async () => {
      anchoDePantalla(ancho)
      focoComoElNavegador()
      pintar()
      const verContador = await screen.findByRole('button', { name: /Ver Asistente Contable/ })
      verContador.focus()
      fireEvent.click(verContador)
      await within(document.getElementById('lectura')!).findByText('Rigor con los números')
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(ubicacion).not.toContain('vacante=')
      // Cerrada, la vista previa conserva esa vacante (para animar la salida) y no toma el foco.
      expect(document.getElementById('lectura')!.hasAttribute('inert')).toBe(true)
      usarContador().focus()
      fireEvent.click(usarContador())
      expect(ubicacion).toContain('vacante=1')
      const bloque = document.getElementById('bloque-de-copia')!
      expect(document.activeElement).toBe(within(bloque).getByPlaceholderText('Buscar vacante…'))
    })
  }

  it('los destinos se piden solo para la vacante que se abre, aunque la última vista fuera otra', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /Ver Jefe de Recursos Humanos/ }))
    await within(lectura(/Jefe de Recursos Humanos/)).findByText('Rigor con los números')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(ubicacion).not.toContain('vacante=')
    fireEvent.click(usarContador())
    expect(await screen.findByRole('radiogroup', { name: 'Vacante destino' })).toBeTruthy()
    expect(destinos.mock.calls).toEqual([['PERFIL_INTEGRAL', 1]])
  })

  for (const cerrada of [false, true]) {
    it(`el enlace del menú que cambia de pestaña no pide la última vacante con el otro tipo${cerrada ? ' (ya cerrada)' : ''}`, async () => {
      // Como el servidor: la vacante de la prueba no tiene preguntas del Perfil Integral.
      ver.mockImplementation((id: number, tipo: string) =>
        id === 10 && tipo === 'PERFIL_INTEGRAL' ? Promise.reject(new ErrorApi(404, 'Vacante not found')) : Promise.resolve(version('PUBLICADA')),
      )
      pintar('/admin/pruebas?tipo=prueba')
      fireEvent.click(await screen.findByRole('button', { name: /Ver Diseñador Gráfico/ }))
      await within(lectura(/Diseñador Gráfico/)).findByText('Rigor con los números')
      if (cerrada) {
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(ubicacion).not.toContain('vacante=')
      }
      const listasAntes = listar.mock.calls.length
      act(() => irA('/admin/pruebas')) // El enlace «Pruebas» del menú: una dirección sin la marca de la pantalla.
      expect(screen.getByRole('tab', { name: /Preguntas del Perfil Integral/ }).getAttribute('aria-selected')).toBe('true')
      expect(await screen.findByRole('button', { name: /Ver Asistente Contable/ })).toBeTruthy()
      await act(() => new Promise((listo) => setTimeout(listo, 0)))
      expect(ver).not.toHaveBeenCalledWith(10, 'PERFIL_INTEGRAL')
      expect(screen.queryByText('Esta vacante ya no existe')).toBeNull()
      expect(listar.mock.calls.length).toBe(listasAntes)
    })
  }
})

describe('vacío y errores (AC-14)', () => {
  it('sin nada escrito: el estado vacío con «Ir a Vacantes», sin buscador ni filtros', async () => {
    listar.mockResolvedValue([])
    pintar()
    expect((await screen.findAllByText('Ninguna vacante tiene preguntas propias todavía')).length).toBeGreaterThan(0)
    expect(screen.getByText('Las preguntas del Perfil Integral se escriben dentro de cada vacante.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a Vacantes' }).getAttribute('href')).toBe('/admin')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Filtros' })).toBeNull()
  })

  it('si falla la carga: el aviso con «Reintentar», que vuelve a pedirla', async () => {
    listar.mockRejectedValueOnce(new Error('caída'))
    pintar()
    expect(await screen.findByText('No se pudo cargar la lista.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: /Ver Asistente Contable/ })).toBeTruthy()
  })

  it('sin permiso: el aviso de permiso del panel, sin reintentar', async () => {
    listar.mockRejectedValue(new ErrorApi(403, 'No tienes permiso para hacer esto.'))
    pintar()
    expect(await screen.findByText('No tienes permiso para hacer esto.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })
})
