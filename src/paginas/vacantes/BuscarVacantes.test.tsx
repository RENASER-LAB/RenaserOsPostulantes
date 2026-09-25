/**
 * La pantalla de buscar vacantes: lo que dice en cada estado y lo que hace la
 * dirección.
 *
 * La lógica de buscar, acotar y ordenar tiene sus propias pruebas en
 * `busqueda.test.ts`; aquí se protege lo que solo se ve montada:
 *
 *   1. **Sin nada escrito no hay conmutador de orden**, en su sitio se lee «Más
 *      recientes primero», y el contador dice «9 vacantes abiertas».
 *   2. **«Ninguna coincide» nunca es «no hay vacantes»**, y «Ver las 9 vacantes»
 *      limpia la búsqueda y los filtros dejando el buscador vacío.
 *   3. **Sin ninguna vacante publicada** no hay buscador, filtros ni orden aunque
 *      la dirección traiga una búsqueda.
 *   4. **Si el servidor no responde**, el buscador conserva el texto del enlace y
 *      hay «Intentar de nuevo»; no aparece «ninguna coincide».
 *   5. **Escribir, filtrar y ordenar escriben la dirección sin crear entradas**:
 *      atrás sale de `/vacantes`.
 *   6. **Un filtro que la dirección trae y hoy no tiene vacantes** aparece como
 *      etiqueta con su nombre y se puede quitar; un departamento se ignora.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { BuscarVacantes } from './BuscarVacantes'

const listarVacantes = vi.fn()
const catalogoUbigeo = vi.fn()

vi.mock('@/api/portal', () => ({
  listarVacantes: () => listarVacantes(),
  catalogoUbigeo: () => catalogoUbigeo(),
}))

let siguienteId = 1
const DIA = 24 * 60 * 60 * 1000

function hace(dias: number): string {
  return new Date(Date.now() - dias * DIA).toISOString()
}

function vacante(cambios: Partial<VacantePublica> = {}): VacantePublica {
  return {
    id: siguienteId++,
    titulo: 'Puesto',
    nombreEmpresa: 'RENASER CONSULTING S.A.C.',
    descripcion: 'Descripción',
    proposito: null,
    responsabilidades: null,
    requisitos: 'Ingeniería o afines',
    modalidad: null,
    horario: null,
    ubicacion: null,
    ciudad: null,
    publicadaEn: hace(1),
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    requisitosObjetivos: [],
    ...cambios,
  }
}

const LIMA = { codigo: '1501', nombre: 'Lima', departamento: 'Lima' }
const AREQUIPA = { codigo: '0401', nombre: 'Arequipa', departamento: 'Arequipa' }

function lasNueve(): VacantePublica[] {
  return [
    vacante({ titulo: 'Especialista en Gestión del Talento', modalidad: 'Presencial', ciudad: AREQUIPA, ubicacion: 'Selva Alegre', publicadaEn: hace(0) }),
    vacante({ titulo: 'Especialista en Marketing Digital', modalidad: 'Presencial', ciudad: AREQUIPA, ubicacion: 'Selva Alegre', publicadaEn: hace(3) }),
    vacante({ titulo: 'Ingeniero Civil Builder Junior', publicadaEn: hace(3) }),
    vacante({ titulo: 'Arquitecto Builder Junior', publicadaEn: hace(10) }),
    vacante({ titulo: 'Ingeniero/a de Infraestructura', publicadaEn: hace(10) }),
    vacante({ titulo: 'Líder de operaciones', publicadaEn: hace(40) }),
    vacante({ titulo: 'Desarrollador web', publicadaEn: null }),
    vacante({ titulo: 'Administrador', modalidad: 'PRESENCIAL', ciudad: LIMA, publicadaEn: hace(40) }),
    vacante({ titulo: 'Asistente Administrativo', modalidad: 'PRESENCIAL', ciudad: LIMA, publicadaEn: hace(40) }),
  ]
}

/** Lo que dice la barra de direcciones, para leerlo desde fuera; y el botón atrás. */
function Direccion() {
  const { pathname, search } = useLocation()
  const navegar = useNavigate()
  return (
    <>
      <output data-testid="direccion">{pathname + search}</output>
      <button type="button" onClick={() => navegar(-1)}>
        Atrás del navegador
      </button>
    </>
  )
}

function pintar(entrada = '/vacantes') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/', entrada]} initialIndex={1}>
        <Routes>
          <Route path="/" element={<p>La portada</p>} />
          <Route path="/vacantes" element={<BuscarVacantes />} />
          <Route path="/vacantes/:vacanteId" element={<p>La ficha</p>} />
        </Routes>
        <Direccion />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function direccion(): string {
  return screen.getByTestId('direccion').textContent ?? ''
}

function tarjetas(): string[] {
  return screen.getAllByRole('listitem').flatMap((li) => {
    const enlace = within(li).queryByRole('link')
    return enlace ? [enlace.getAttribute('aria-labelledby') ? within(li).getByRole('heading').textContent ?? '' : ''] : []
  })
}

beforeEach(() => {
  siguienteId = 1
  listarVacantes.mockResolvedValue(lasNueve())
  catalogoUbigeo.mockResolvedValue([
    { codigo: '0801', nombre: 'Cusco', departamento: 'Cusco' },
    ...[LIMA, AREQUIPA],
  ])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Llega sin saber qué hay', () => {
  it('ve las 9 de la más reciente a la más antigua, «9 vacantes abiertas» y «Más recientes primero» sin conmutador', async () => {
    pintar()
    expect(await screen.findByText('9 vacantes abiertas')).toBeTruthy()
    expect(screen.getByText('Más recientes primero')).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Ordenar por' })).toBeNull()
    const titulos = tarjetas()
    expect(titulos).toHaveLength(9)
    expect(titulos[0]).toBe('Especialista en Gestión del Talento')
    expect(titulos.at(-1)).toBe('Desarrollador web')
    // Cada tarjeta es un enlace cuyo nombre es el título.
    expect(screen.getByRole('link', { name: 'Administrador' })).toBeTruthy()
    // El buscador vive en una región de búsqueda con su etiqueta visible.
    expect(within(screen.getByRole('search')).getByLabelText('Buscar vacantes')).toBeTruthy()
  })

  it('mientras carga, el buscador ya se puede usar con el texto del enlace y el contador no dice 0', () => {
    listarVacantes.mockReturnValue(new Promise(() => {}))
    pintar('/vacantes?q=lider')
    expect((screen.getByLabelText('Buscar vacantes') as HTMLInputElement).value).toBe('lider')
    expect(screen.queryByText(/vacantes abiertas/)).toBeNull()
    expect(screen.queryByText(/0 de/)).toBeNull()
  })
})

describe('Busca algo concreto', () => {
  it('«GESTION» deja una y el contador dice «1 de 9 vacantes»; con texto aparece el conmutador', async () => {
    pintar()
    await screen.findByText('9 vacantes abiertas')
    fireEvent.change(screen.getByLabelText('Buscar vacantes'), { target: { value: 'GESTION' } })
    expect(await screen.findByText('1 de 9 vacantes')).toBeTruthy()
    expect(tarjetas()).toEqual(['Especialista en Gestión del Talento'])
    const orden = screen.getByRole('radiogroup', { name: 'Ordenar por' })
    expect((within(orden).getByRole('radio', { name: 'Relevantes' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText('Más recientes primero')).toBeNull()
    expect(direccion()).toBe('/vacantes?q=GESTION')
  })

  it('«analista» no encuentra nada: «Ninguna vacante coincide», nunca «no hay vacantes», y «Ver las 9 vacantes» limpia todo', async () => {
    pintar()
    await screen.findByText('9 vacantes abiertas')
    fireEvent.change(screen.getByLabelText('Buscar vacantes'), { target: { value: 'analista' } })
    expect(await screen.findByText('Ninguna vacante coincide con «analista».')).toBeTruthy()
    expect(screen.getByText('Hay 9 vacantes abiertas.')).toBeTruthy()
    expect(screen.queryByText(/no hay vacantes/i)).toBeNull()
    expect((screen.getByLabelText('Buscar vacantes') as HTMLInputElement).value).toBe('analista')

    fireEvent.click(screen.getByRole('button', { name: 'Ver las 9 vacantes' }))
    expect(await screen.findByText('9 vacantes abiertas')).toBeTruthy()
    expect((screen.getByLabelText('Buscar vacantes') as HTMLInputElement).value).toBe('')
    expect(direccion()).toBe('/vacantes')
  })

  it('borrar el texto con la ✕ devuelve la lista completa y «Más recientes primero»', async () => {
    pintar('/vacantes?q=ingeniero&orden=recientes')
    expect(await screen.findByText('2 de 9 vacantes')).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Recientes' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))
    expect(await screen.findByText('9 vacantes abiertas')).toBeTruthy()
    expect(screen.getByText('Más recientes primero')).toBeTruthy()
    expect(direccion()).toBe('/vacantes')
  })
})

describe('Acota', () => {
  it('marcar «Lima» deja 2 con la etiqueta «Lima ✕»; con «Sin indicar» además, 7', async () => {
    pintar()
    await screen.findByText('9 vacantes abiertas')
    const ciudad = screen.getByRole('group', { name: 'Ciudad' })
    fireEvent.click(within(ciudad).getByRole('checkbox', { name: 'Lima (2)' }))
    expect(await screen.findByText('2 de 9 vacantes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quitar filtro Lima' })).toBeTruthy()
    expect(direccion()).toBe('/vacantes?ciudad=1501')
    // Arequipa no baja a (0): dentro del grupo las opciones suman.
    expect(within(ciudad).getByRole('checkbox', { name: 'Arequipa (2)' })).toBeTruthy()

    fireEvent.click(within(ciudad).getByRole('checkbox', { name: 'Sin indicar (5)' }))
    expect(await screen.findByText('7 de 9 vacantes')).toBeTruthy()
    expect(direccion()).toBe('/vacantes?ciudad=1501&ciudad=sin-indicar')
  })

  it('con una sola modalidad escrita no hay filtro de modalidad; con «Remoto» publicada aparece', async () => {
    pintar()
    await screen.findByText('9 vacantes abiertas')
    expect(screen.queryByRole('group', { name: 'Modalidad' })).toBeNull()
    cleanup()

    listarVacantes.mockResolvedValue([...lasNueve(), vacante({ titulo: 'Soporte remoto', modalidad: 'Remoto' })])
    pintar()
    await screen.findByText('10 vacantes abiertas')
    const modalidad = screen.getByRole('group', { name: 'Modalidad' })
    expect(within(modalidad).getAllByRole('checkbox').map((c) => c.getAttribute('aria-label') ?? (c.parentElement?.textContent ?? '').trim()))
      .toEqual(['Presencial (4)', 'Remoto (1)', 'Sin indicar (5)'])
  })

  it('«Publicada» cuenta por ventana y «Últimos 7 días» deja las de esa ventana con su etiqueta', async () => {
    listarVacantes.mockResolvedValue([
      vacante({ titulo: 'Hoy', publicadaEn: hace(0) }),
      vacante({ titulo: 'Hace 3', publicadaEn: hace(3) }),
      vacante({ titulo: 'Hace 10', publicadaEn: hace(10) }),
      vacante({ titulo: 'Hace 40', publicadaEn: hace(40) }),
    ])
    pintar()
    await screen.findByText('4 vacantes abiertas')
    const publicada = screen.getByRole('radiogroup', { name: 'Publicada' })
    expect(within(publicada).getAllByRole('radio').map((r) => (r.parentElement?.textContent ?? '').trim()))
      .toEqual(['Cualquier fecha (4)', 'Últimas 24 horas (1)', 'Últimos 7 días (2)', 'Últimos 30 días (3)'])
    fireEvent.click(within(publicada).getByRole('radio', { name: 'Últimos 7 días (2)' }))
    expect(await screen.findByText('2 de 4 vacantes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quitar filtro Últimos 7 días' })).toBeTruthy()
    expect(direccion()).toBe('/vacantes?publicada=7d')
  })

  it('si todas se publicaron hace más de 30 días, no se muestra «Publicada»', async () => {
    listarVacantes.mockResolvedValue([vacante({ publicadaEn: hace(40) }), vacante({ publicadaEn: hace(50) })])
    pintar()
    await screen.findByText('2 vacantes abiertas')
    expect(screen.queryByRole('radiogroup', { name: 'Publicada' })).toBeNull()
  })
})

describe('Comparte y vuelve', () => {
  it('un enlace con búsqueda, filtro y orden enseña lo mismo', async () => {
    pintar('/vacantes?q=ingeniero&ciudad=0401&orden=recientes')
    expect(await screen.findByText('Ninguna vacante coincide con «ingeniero» en Arequipa.')).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Recientes' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Quitar filtro Arequipa' })).toBeTruthy()
  })

  it('«ciudad=0801» sin vacantes en Cusco sale como «Cusco ✕» y se puede quitar; «ciudad=04» se ignora', async () => {
    pintar('/vacantes?ciudad=0801&ciudad=04')
    const etiqueta = await screen.findByRole('button', { name: 'Quitar filtro Cusco' })
    expect(await screen.findByText('Ninguna vacante coincide en Cusco.')).toBeTruthy()
    // El departamento no es una etiqueta ni cuenta: solo Cusco está puesto.
    expect(screen.getAllByRole('button', { name: /^Quitar filtro / })).toHaveLength(1)
    fireEvent.click(etiqueta)
    expect(await screen.findByText('9 vacantes abiertas')).toBeTruthy()
    expect(direccion()).toBe('/vacantes')
    // Sin etiquetas que enfocar, el foco vuelve al buscador.
    expect(document.activeElement).toBe(screen.getByLabelText('Buscar vacantes'))
  })

  it('escribir letra a letra y cambiar el orden no crean entradas: atrás sale a la portada', async () => {
    pintar()
    await screen.findByText('9 vacantes abiertas')
    const buscador = screen.getByLabelText('Buscar vacantes')
    for (const letras of ['a', 'ad', 'adm', 'admi']) {
      fireEvent.change(buscador, { target: { value: letras } })
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Recientes' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Relevantes' }))
    expect(direccion()).toBe('/vacantes?q=admi')
    fireEvent.click(screen.getByRole('button', { name: 'Atrás del navegador' }))
    expect(await screen.findByText('La portada')).toBeTruthy()
  })

  it('al abrir una tarjeta desde la lista, la ficha sabe que viene de la lista', async () => {
    pintar('/vacantes?q=administrador')
    fireEvent.click(await screen.findByRole('link', { name: 'Administrador' }))
    expect(await screen.findByText('La ficha')).toBeTruthy()
    expect(sessionStorage.getItem('vacantes:vuelta')).toContain('"id":8')
    sessionStorage.removeItem('vacantes:vuelta')
  })
})

describe('Cargando, sin conexión y sin vacantes', () => {
  it('sin ninguna vacante publicada dice «Ahora mismo no hay vacantes abiertas» sin buscador ni filtros, aunque el enlace traiga búsqueda', async () => {
    listarVacantes.mockResolvedValue([])
    pintar('/vacantes?q=analista')
    expect(await screen.findByText('Ahora mismo no hay vacantes abiertas.')).toBeTruthy()
    expect(screen.queryByRole('search')).toBeNull()
    expect(screen.queryByText('Más recientes primero')).toBeNull()
  })

  it('si el servidor no responde, conserva el texto, ofrece «Intentar de nuevo» y no dice «ninguna coincide»', async () => {
    listarVacantes.mockRejectedValueOnce(new Error('No pudimos conectar con el servidor.'))
    pintar('/vacantes?q=lider')
    expect(await screen.findByText('No pudimos cargar las vacantes.')).toBeTruthy()
    expect((screen.getByLabelText('Buscar vacantes') as HTMLInputElement).value).toBe('lider')
    expect(screen.queryByText(/Ninguna vacante coincide/)).toBeNull()
    expect(screen.queryByText(/no hay vacantes/i)).toBeNull()

    listarVacantes.mockResolvedValue(lasNueve())
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    expect(await screen.findByText('1 de 9 vacantes')).toBeTruthy()
    expect(tarjetas()).toEqual(['Líder de operaciones'])
  })
})

describe('Lo que se anuncia', () => {
  it('cambiar el orden anuncia por qué se ordena, y el contador se anuncia al dejar de escribir', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      pintar('/vacantes?q=ingeniero')
      await screen.findByText('2 de 9 vacantes')
      fireEvent.click(screen.getByRole('radio', { name: 'Recientes' }))
      expect(screen.getByText('Ordenadas por más recientes')).toBeTruthy()
      await vi.advanceTimersByTimeAsync(600)
      await waitFor(() => expect(screen.getByText('2 de 9 vacantes', { selector: '[aria-live]' })).toBeTruthy())
    } finally {
      vi.useRealTimers()
    }
  })
})
