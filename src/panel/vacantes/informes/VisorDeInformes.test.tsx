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
  type CelularDelVisor,
  type EntregableDelAnexo,
  type Informe,
} from '@/panel/api/informes'
import { descargarArchivo, enlaceDeArchivo } from '@/panel/api/panel'

vi.mock('@/panel/api/informes', async (original) => ({
  ...(await original<typeof import('@/panel/api/informes')>()),
  verVisorDeLaVacante: vi.fn(),
  verInformesDelPostulante: vi.fn(),
  verInforme: vi.fn(),
  descargarInforme: vi.fn(),
  descargarInformesDelPostulante: vi.fn(),
  descargarInformesDeLaVacante: vi.fn(),
}))

vi.mock('@/panel/api/panel', async (original) => ({
  ...(await original<typeof import('@/panel/api/panel')>()),
  enlaceDeArchivo: vi.fn(),
  descargarArchivo: vi.fn(),
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

function montar(ruta = '/admin/vacantes/3/informes', celulares: Record<number, CelularDelVisor> = {}) {
  vi.mocked(verVisorDeLaVacante).mockResolvedValue({
    vacanteId: 3, vacante: 'Analista de Recursos Humanos', puesto: 'Analista', etapas: ['CV', 'EVALUACION', 'PRUEBA'],
    postulantes: NOMBRES.map((candidato, i) => ({ postulacionId: 100 + i, puesto: i + 1, candidato,
      grupo: i < 3 ? 'ALTA' : 'NO_PRIORIZADO', notaCv: 80 - i, notaEvaluacion: null, notaPrueba: null,
      celular: celulares[100 + i] ?? null })),
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

  it('el subtítulo dice que van ordenados por nota combinada y la cabecera «Puesto N de M»', async () => {
    montar('/admin/vacantes/3/informes?postulante=101')
    expect(await screen.findByText(/13 postulantes, ordenados por nota combinada/)).toBeTruthy()
    expect(await screen.findByText('Puesto 2 de 13')).toBeTruthy()
    expect(screen.queryByText(/del ranking/)).toBeNull()
  })
})

describe('El celular en el visor', () => {
  it('AC-14 · sale el que manda el backend como 999 999 999, con enlace para llamar y WhatsApp con el 51 en otra pestaña', async () => {
    montar('/admin/vacantes/3/informes', {
      100: { texto: '987 654 321', llamar: 'tel:+51987654321', whatsapp: 'https://wa.me/51987654321' },
    })
    const llamar = await screen.findByRole('link', { name: 'Llamar al 987 654 321' })
    expect(llamar.getAttribute('href')).toBe('tel:+51987654321')
    expect(llamar.textContent).toContain('987 654 321')
    const whatsapp = screen.getByRole('link', { name: 'Escribir por WhatsApp al 987 654 321' })
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/51987654321')
    expect(whatsapp.getAttribute('target')).toBe('_blank')
    expect(whatsapp.textContent).toContain('WhatsApp')
  })

  it('AC-16 · un fijo sale para llamar y sin WhatsApp', async () => {
    montar('/admin/vacantes/3/informes', {
      100: { texto: '(01) 456-7890', llamar: 'tel:014567890', whatsapp: null },
    })
    expect((await screen.findByRole('link', { name: 'Llamar al (01) 456-7890' })).getAttribute('href')).toBe(
      'tel:014567890',
    )
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
  })

  it('AC-15 · sin ningún celular no sale nada', async () => {
    montar()
    expect(await screen.findByRole('heading', { level: 2, name: 'Carlos Mendoza' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Llamar/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
  })

  it('va después de «Currículum» y antes de las redes', async () => {
    montar('/admin/vacantes/3/informes', {
      100: { texto: '987 654 321', llamar: 'tel:+51987654321', whatsapp: 'https://wa.me/51987654321' },
    })
    vi.mocked(verInforme).mockImplementation(async (id) => ({
      ...informe(id, NOMBRES[id - 100]!),
      enlaces: [
        { rotulo: 'Currículum (PDF)', url: 'https://almacen.example/cv.pdf', tipo: 'CV' },
        { rotulo: 'LinkedIn', url: 'https://www.linkedin.com/in/x', tipo: 'LINKEDIN' },
      ],
    }))
    await screen.findByRole('link', { name: /Currículum/ })
    const textos = screen.getAllByRole('link').map((a) => a.textContent ?? '')
    const cv = textos.findIndex((t) => t.includes('Currículum'))
    const celular = textos.findIndex((t) => t.includes('987 654 321'))
    const linkedin = textos.findIndex((t) => t.includes('LinkedIn'))
    expect(cv).toBeLessThan(celular)
    expect(celular).toBeLessThan(linkedin)
  })
})

describe('Los entregables desde el visor', () => {
  function conEntregables(entregables: EntregableDelAnexo[]) {
    montar('/admin/vacantes/3/informes?postulante=100&etapa=prueba')
    vi.mocked(verInformesDelPostulante).mockImplementation(async (id) => ({
      postulacionId: id, candidato: null,
      informes: [{ etapa: 'PRUEBA', disponible: true, motivo: null, nota: 78 }],
    }))
    vi.mocked(verInforme).mockImplementation(async (id) => ({
      ...informe(id, NOMBRES[id - 100]!),
      etapa: 'PRUEBA',
      titulo: 'Informe de la prueba del puesto',
      experiencia: null,
      anexo: { titulo: 'Respuestas y entregables', subtitulo: null, caso: null, preguntas: [],
        entregablesResumen: '2 de 3 entregados', entregables },
    }))
  }

  it('AC-12 · con permiso, el archivo entregado se abre en una pestaña nueva con su enlace firmado', async () => {
    const pestana = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
    const abrir = vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    vi.mocked(enlaceDeArchivo).mockResolvedValue({
      url: 'https://almacen.example/rrhh.pdf?firma=1', expiraEn: '2026-11-16T20:00:00Z', nombre: 'rrhh.pdf',
    })
    conEntregables([
      { nombre: 'Documento de Recursos Humanos', detalle: 'Subido el 14/11 a las 10:14', entregado: true,
        archivoId: 77, url: 'https://almacen.example/rrhh.pdf?firma=8h' },
      { nombre: 'Video de sustentación', detalle: 'Subido el 14/11 a las 10:20', entregado: true,
        archivoId: null, url: 'https://drive.example/video' },
      { nombre: 'Cronograma', detalle: 'No se subió ningún archivo', entregado: false, archivoId: null, url: null },
    ])

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir «Documento de Recursos Humanos» en una pestaña nueva' }))

    await waitFor(() => expect(pestana.location.href).toBe('https://almacen.example/rrhh.pdf?firma=1'))
    expect(abrir).toHaveBeenCalledWith('', '_blank')
    expect(pestana.opener).toBeNull()
    expect(enlaceDeArchivo).toHaveBeenCalledWith(77)
    expect(descargarArchivo).not.toHaveBeenCalled()
    // El de tipo enlace abre la dirección que pegó; el no entregado sigue sin enlace.
    const video = screen.getByRole('link', { name: 'Abrir «Video de sustentación» en una pestaña nueva' })
    expect(video.getAttribute('href')).toBe('https://drive.example/video')
    expect(video.getAttribute('target')).toBe('_blank')
    expect(screen.queryByRole('button', { name: /Cronograma/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Cronograma/ })).toBeNull()
    expect(screen.getByText('Cronograma')).toBeTruthy()
    // La pastilla no cambia.
    expect(screen.getAllByText('Entregado')).toHaveLength(2)
  })

  it('si este entorno no reparte enlaces web (local), cierra la pestaña y lo descarga', async () => {
    const pestana = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    vi.mocked(enlaceDeArchivo).mockResolvedValue({ url: 'memoria://77', expiraEn: '', nombre: 'rrhh.pdf' })
    vi.mocked(descargarArchivo).mockResolvedValue({ contenido: new Blob(['%PDF']), nombre: 'rrhh.pdf' })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const pulsar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    conEntregables([{ nombre: 'Documento de Recursos Humanos', detalle: 'Subido el 14/11 a las 10:14',
      entregado: true, archivoId: 77, url: null }])

    fireEvent.click(await screen.findByRole('button', { name: /Documento de Recursos Humanos/ }))

    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith(77))
    expect(pestana.close).toHaveBeenCalled()
    await waitFor(() => expect(pulsar).toHaveBeenCalled())
  })

  it('AC-13 · sin permiso (nada con que abrirlo) el nombre sale como siempre, sin enlace', async () => {
    conEntregables([
      { nombre: 'Documento de Recursos Humanos', detalle: 'Subido el 14/11 a las 10:14', entregado: true,
        archivoId: null, url: null },
    ])
    expect(await screen.findByText('Documento de Recursos Humanos')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Documento de Recursos Humanos/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Documento de Recursos Humanos/ })).toBeNull()
  })

  it('una dirección que no es web no se hace pulsable', async () => {
    conEntregables([
      { nombre: 'Enlace raro', detalle: 'Subido el 14/11 a las 10:30', entregado: true,
        archivoId: null, url: 'javascript:alert(1)' },
    ])
    expect(await screen.findByText('Enlace raro')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Enlace raro/ })).toBeNull()
  })
})
