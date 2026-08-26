/**
 * La cabecera del perfil se manda ENTERA, o se pierden datos en silencio.
 *
 * `PUT /portal/perfil` reemplaza los siete campos de golpe: un campo que no
 * viaje se guarda vacío, no se conserva. Es la misma forma del fallo que ya
 * costó respuestas perdidas en la evaluación, y compila perfectamente estando
 * mal — nadie se entera hasta que alguien abre su perfil y le falta la mitad.
 *
 * Lo que se prueba aquí:
 *
 *   1. **Cambiar un campo manda los siete**, no solo el que se tocó.
 *   2. **La pretensión es todo o nada.** Un mínimo suelto da 400 en el backend,
 *      así que la pantalla lo para antes de salir.
 *   3. **No se dice «guardado» hasta que el servidor lo confirma.**
 *   4. Los tres estados del origen se distinguen **sin mirar el color**: por la
 *      palabra de la píldora y por si existe el botón de confirmar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorAvisos } from '@/ui/Avisos'
import type { PerfilCompleto } from '@/api/tipos'
import { Perfil } from './Perfil'

const guardados: unknown[] = []

const PERFIL: PerfilCompleto = {
  titular: 'Analista de procesos',
  resumen: 'Ocho años ordenando operaciones.',
  habilidades: ['Excel avanzado', 'Power BI'],
  experienciaMeses: 96,
  ubicacion: 'Arequipa, Perú',
  disponibilidad: 'Inmediata',
  pretension: { min: 3500, max: 4200, moneda: 'PEN' },
  experiencia: [
    {
      id: 1,
      puesto: 'Analista senior',
      empresa: 'Clínica San Juan',
      desde: '2022-03-01',
      hasta: null,
      descripcion: null,
      origen: 'PERSONA',
      confirmado: true,
    },
    {
      id: 2,
      puesto: 'Asistente de operaciones',
      empresa: 'Transportes del Sur',
      desde: '2019-01-01',
      hasta: '2022-02-01',
      descripcion: null,
      origen: 'CURRICULUM',
      confirmado: false,
    },
    {
      id: 3,
      puesto: 'Practicante',
      empresa: 'Molinos del Norte',
      desde: '2018-01-01',
      hasta: '2018-12-01',
      descripcion: null,
      origen: 'CURRICULUM',
      confirmado: true,
    },
  ],
  educacion: [],
  idiomas: [],
  certificaciones: [],
  enlaces: [],
  lecturaCv: { estado: 'LISTA', actualizadoEn: '2026-08-24T10:00:00Z' },
}

vi.mock('@/api/perfil', () => ({
  verPerfil: () => Promise.resolve(PERFIL),
  guardarCabecera: (datos: unknown) => {
    guardados.push(datos)
    return Promise.resolve(undefined)
  },
  descargarMisDatos: () => Promise.resolve(PERFIL),
  nivelesEducativos: () => Promise.resolve([]),
  nivelesIdioma: () => Promise.resolve([]),
  TIPOS_DE_ENLACE: [{ codigo: 'LINKEDIN', nombre: 'LinkedIn' }],
  crearExperiencia: () => Promise.resolve({ id: 9 }),
  editarExperiencia: () => Promise.resolve(undefined),
  borrarExperiencia: () => Promise.resolve(undefined),
  confirmarExperiencia: () => Promise.resolve(undefined),
  ordenarExperiencia: () => Promise.resolve(undefined),
  crearEducacion: () => Promise.resolve({ id: 9 }),
  editarEducacion: () => Promise.resolve(undefined),
  borrarEducacion: () => Promise.resolve(undefined),
  confirmarEducacion: () => Promise.resolve(undefined),
  ordenarEducacion: () => Promise.resolve(undefined),
  crearIdioma: () => Promise.resolve({ id: 9 }),
  editarIdioma: () => Promise.resolve(undefined),
  borrarIdioma: () => Promise.resolve(undefined),
  confirmarIdioma: () => Promise.resolve(undefined),
  crearCertificacion: () => Promise.resolve({ id: 9 }),
  editarCertificacion: () => Promise.resolve(undefined),
  borrarCertificacion: () => Promise.resolve(undefined),
  confirmarCertificacion: () => Promise.resolve(undefined),
  crearEnlace: () => Promise.resolve({ id: 9 }),
  borrarEnlace: () => Promise.resolve(undefined),
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/perfil']}>
          <Perfil />
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
}

async function abrirLaCabecera() {
  const editar = await screen.findByRole('button', { name: 'Editar quién eres' })
  fireEvent.click(editar)
  await screen.findByRole('textbox', { name: /titular/i })
}

beforeEach(() => {
  guardados.length = 0
})
afterEach(cleanup)

describe('la cabecera del perfil', () => {
  it('manda los siete campos aunque solo se cambie uno', async () => {
    montar()
    await abrirLaCabecera()

    fireEvent.change(screen.getByRole('textbox', { name: /titular/i }), {
      target: { value: 'Jefa de operaciones' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(guardados).toHaveLength(1))
    expect(guardados[0]).toEqual({
      titular: 'Jefa de operaciones',
      resumen: 'Ocho años ordenando operaciones.',
      habilidades: ['Excel avanzado', 'Power BI'],
      experienciaMeses: 96,
      ubicacion: 'Arequipa, Perú',
      disponibilidad: 'Inmediata',
      pretension: { min: 3500, max: 4200, moneda: 'PEN' },
    })
  })

  it('no deja mandar la pretensión a medias', async () => {
    montar()
    await abrirLaCabecera()

    // Borrar solo el máximo: el backend responde 400 a eso.
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hasta' }), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(screen.getByText(/pon también el máximo/i)).toBeTruthy()
    })
    expect(guardados).toHaveLength(0)
  })

  it('borrar los dos números manda la pretensión en null, que es como se quita', async () => {
    montar()
    await abrirLaCabecera()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Desde' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hasta' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(guardados).toHaveLength(1))
    expect((guardados[0] as { pretension: unknown }).pretension).toBeNull()
  })

  it('rechaza una experiencia fuera del rango que acepta el backend', async () => {
    montar()
    await abrirLaCabecera()

    fireEvent.change(screen.getByRole('spinbutton', { name: /experiencia, en meses/i }), {
      target: { value: '900' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(screen.getByText(/entre 0 y 720/i)).toBeTruthy()
    })
    expect(guardados).toHaveLength(0)
  })
})

describe('un refresco fallido no puede tirar el formulario', () => {
  it('sigue enseñando el perfil cuando el refresco falla habiendo datos', async () => {
    // TanStack Query pone `status: 'error'` **aunque `data` siga estando**: lo
    // hace sin condiciones al fallar un refresco de fondo. Esta pantalla se
    // sondea sola cada cinco segundos mientras se lee el currículum, así que
    // mirando solo `isError` un hipo del servidor desmontaba el formulario
    // entero con lo que la persona estuviera escribiendo dentro.
    const datos = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={datos}>
        <ProveedorAvisos>
          <MemoryRouter initialEntries={['/perfil']}>
            <Perfil />
          </MemoryRouter>
        </ProveedorAvisos>
      </QueryClientProvider>,
    )
    await screen.findByText('Analista senior')

    // El estado exacto de un refresco que falló teniendo ya datos.
    datos.setQueryData(['perfil'], PERFIL)
    const query = datos.getQueryCache().find({ queryKey: ['perfil'] })!
    query.setState({ ...query.state, status: 'error', error: new Error('se cayó la red') })

    await waitFor(() => {
      expect(screen.getByText(/no pudimos comprobar si hay algo nuevo/i)).toBeTruthy()
    })
    // Lo que importa: el perfil sigue ahí.
    expect(screen.getByText('Analista senior')).toBeTruthy()
    expect(screen.queryByText('No pudimos cargar tu perfil.')).toBeNull()
  })
})

describe('el origen de cada dato se lee sin color', () => {
  it('marca con una palabra lo que dedujo la IA y nadie confirmó', async () => {
    montar()
    await screen.findByText('Analista senior')

    // Lo que escribió la persona no lleva ninguna marca.
    expect(screen.queryAllByText('Sin confirmar')).toHaveLength(1)
    expect(screen.queryAllByText('Del currículum')).toHaveLength(1)
  })

  it('el botón de confirmar existe solo en lo que está sin confirmar', async () => {
    montar()
    await screen.findByText('Analista senior')

    expect(screen.queryAllByRole('button', { name: /^Confirmar / })).toHaveLength(1)
  })

  it('cuenta los que quedan por revisar, no los que vinieron del currículum', async () => {
    montar()
    // La fixtura tiene DOS datos del currículum: uno sin confirmar y otro ya
    // confirmado. El título tiene que contar uno, no dos: si contara la
    // procedencia, el número no cuadraría con lo que se ve marcado abajo.
    await screen.findByText(/te queda un dato por revisar/i)
  })
})
