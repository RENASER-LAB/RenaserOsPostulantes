import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { VisorDeInformes } from './VisorDeInformes'
import {
  descargarInforme,
  descargarInformesDeLaVacante,
  verInforme,
  verInformesDelPostulante,
  verVisorDeLaVacante,
  type Informe,
} from '@/panel/api/informes'

vi.mock('@/panel/api/informes', async (original) => ({
  ...(await original<typeof import('@/panel/api/informes')>()),
  verVisorDeLaVacante: vi.fn(),
  verInformesDelPostulante: vi.fn(),
  verInforme: vi.fn(),
  descargarInforme: vi.fn(),
  descargarInformesDelPostulante: vi.fn(),
  descargarInformesDeLaVacante: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const NOMBRES = ['Carlos Mendoza', 'Ana Torres', 'Lucía Paredes', 'Diego Ramos', 'Elena Soto', 'Fabio Ruiz',
  'Gina Vela', 'Hugo Paz', 'Inés Lara', 'Jorge Mora', 'Karla Díaz', 'Luis Quispe', 'María Cruz']

function informe(postulacionId: number, candidato: string): Informe {
  return {
    etapa: 'CV', titulo: 'Informe del currículum', empresa: 'Renaser', vacante: 'Analista',
    postulacionId, candidato, correo: null, generadoEn: '2026-11-16T15:00:00Z',
    nota: { valor: 74, texto: '74', sobre: 'de 100', base: 'Los criterios del currículum.' },
    grupo: 'ALTA', datosClave: [], recuentos: [],
    experiencia: { total: '4 años', totalDetalle: null, ultimoPuesto: 'Analista', ultimoDetalle: null,
      formacion: 'Psicología', habilidades: ['Excel'], perfil: null },
    resumen: null,
    evaluado: { titulo: 'Qué se evaluó', escala: 'sobre 100', pie: null, criterios: [
      { nombre: 'Resultados demostrables', nota: 88, maximo: 100, notaTexto: '88', maximoTexto: null,
        porcentaje: 88, quien: 'IA', ajustada: false, motivoAjuste: null,
        texto: 'Redujo el tiempo de contratación de 30 a 18 días.',
        explicacion: 'Redujo el tiempo de contratación de 30 a 18 días.', preguntas: null, pendiente: null },
    ] },
    bloques: [{ codigo: 'DEMUESTRA', titulo: 'Lo que el CV demuestra', tono: 'BIEN', vacio: 'Sin datos',
      puntos: Array.from({ length: 7 }, (_, i) => ({ texto: `Logro ${i + 1}`, detalle: null, origen: 'CV',
        etiqueta: null, grupo: null })) }],
    enlaces: [{ rotulo: 'LinkedIn', url: 'https://www.linkedin.com/in/x', tipo: 'LINKEDIN' }],
    detalleTitulo: null, detalle: [], detallePie: null, anexo: null, aviso: null,
    textosEnCamino: false, nombreArchivo: `Informe CV - ${candidato}.pdf`,
  }
}

function montar(ruta = '/admin/vacantes/3/informes') {
  vi.mocked(verVisorDeLaVacante).mockResolvedValue({
    vacanteId: 3, vacante: 'Analista de Recursos Humanos', puesto: 'Analista', etapas: ['CV', 'EVALUACION', 'PRUEBA'],
    postulantes: NOMBRES.map((candidato, i) => ({ postulacionId: 100 + i, puesto: i + 1, candidato,
      grupo: i < 3 ? 'ALTA' : 'NO_PRIORIZADO', notaCv: 80 - i, notaEvaluacion: null, notaPrueba: null })),
  })
  vi.mocked(verInformesDelPostulante).mockImplementation(async (id) => ({
    postulacionId: id, candidato: null, informes: [
      { etapa: 'CV', disponible: true, motivo: null, nota: 74 },
      { etapa: 'EVALUACION', disponible: true, motivo: null, nota: 82 },
      { etapa: 'PRUEBA', disponible: false, motivo: 'La IA está calificando', nota: null },
    ],
  }))
  vi.mocked(verInforme).mockImplementation(async (id) => informe(id, NOMBRES[id - 100]!))
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/vacantes/:id/informes" element={<VisorDeInformes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('El visor de informes', () => {
  it('AC-01f · lista a los 13 en el orden del ranking y pasa al siguiente sin recargar', async () => {
    montar()
    const lista = await screen.findByRole('complementary', { name: 'Postulantes de la vacante' })
    const filas = within(lista).getAllByRole('button')
    expect(filas).toHaveLength(13)
    filas.forEach((fila, i) => expect(fila.textContent).toContain(NOMBRES[i]))
    expect(filas[0]!.textContent).toContain('Carlos Mendoza')
    expect(filas[12]!.textContent).toContain('María Cruz')

    expect(await screen.findByRole('heading', { level: 2, name: 'Carlos Mendoza' })).toBeTruthy()
    expect(screen.getByText('1 de 13')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ana Torres' })).toBeTruthy()
    expect(screen.getByText('2 de 13')).toBeTruthy()
    await waitFor(() => expect(verInforme).toHaveBeenCalledWith(101, 'cv'))
  })

  it('AC-01f · la pestaña de quien aún se califica sale desactivada con su motivo', async () => {
    montar()
    const prueba = await screen.findByRole('tab', { name: /Prueba/ })
    expect(prueba.getAttribute('aria-disabled')).toBe('true')
    expect(prueba.getAttribute('title')).toBe('La IA está calificando')
    expect(screen.getByRole('tab', { name: /CV/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Prueba: La IA está calificando')).toBeTruthy()
  })

  it('AC-01f · «Descargar PDF» baja el de la pestaña abierta; el visor abre en la persona y pestaña de la dirección', async () => {
    vi.mocked(descargarInforme).mockResolvedValue({ contenido: new Blob(['%PDF']), nombre: 'Informe evaluación.pdf' })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montar('/admin/vacantes/3/informes?postulante=102&etapa=evaluacion')
    expect(await screen.findByRole('heading', { level: 2, name: 'Lucía Paredes' })).toBeTruthy()
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Evaluación/ }).getAttribute('aria-selected')).toBe('true'),
    )
    fireEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }))
    await waitFor(() => expect(descargarInforme).toHaveBeenCalledWith(102, 'evaluacion'))
    expect(screen.getByRole('link', { name: /Abrir la ficha/ }).getAttribute('href')).toBe(
      '/admin/vacantes/3?etapa=PERFIL_INTEGRAL&postulante=102',
    )
  })

  it('AC-01h · nada se recorta: los siete puntos del bloque salen todos', async () => {
    montar()
    for (let i = 1; i <= 7; i++) {
      expect(await screen.findByText(`Logro ${i}`)).toBeTruthy()
    }
    expect(screen.queryByText(/y \d+ más/)).toBeNull()
  })

  it('«Descargar los de toda la vacante» dice «Preparando…» mientras tanto y avisa al terminar', async () => {
    let soltar: (v: { contenido: Blob; nombre: string | null }) => void = () => {}
    vi.mocked(descargarInformesDeLaVacante).mockReturnValue(new Promise((r) => (soltar = r)))
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Descargar los de toda la vacante/ }))
    const preparando = await screen.findByRole('button', { name: /Preparando…/ })
    expect(preparando.hasAttribute('disabled')).toBe(true)
    soltar({ contenido: new Blob(['zip']), nombre: 'Informes.zip' })
    expect((await screen.findByRole('status')).textContent).toContain('toda la vacante')
  })

  it('el buscador filtra la lista por nombre', async () => {
    montar()
    const lista = await screen.findByRole('complementary', { name: 'Postulantes de la vacante' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar postulante' }), { target: { value: 'lucía' } })
    expect(within(lista).getAllByRole('button')).toHaveLength(1)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar postulante' }), { target: { value: 'zzz' } })
    expect(within(lista).getByText('Ningún postulante se llama «zzz».')).toBeTruthy()
  })
})
