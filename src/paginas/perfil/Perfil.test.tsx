/**
 * La cabecera del perfil se manda ENTERA, o se pierden datos en silencio.
 *
 * `PUT /portal/perfil` reemplaza los siete campos de golpe: un campo que no
 * viaje se guarda vacío, no se conserva. Los logros clave (V71) son la única
 * excepción —ausentes no se tocan, vacíos se borran—, y por eso este cliente
 * los manda siempre. Es la misma forma del fallo que ya
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
 *   5. Los logros clave se ven igual en la cabecera y en «Acerca de ti» —mismo
 *      rótulo, numeración y orden—, solo cortados en la cabecera.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorSesion } from '@/app/Sesion'
import { ProveedorAvisos } from '@/ui/Avisos'
import type { PerfilCompleto } from '@/api/tipos'
import { Perfil } from './Perfil'

const guardados: unknown[] = []

const LOGROS = [
  'Reduje de 10 a 4 días el cierre contable',
  'Ordené el archivo de una clínica entera',
]

const PERFIL: PerfilCompleto = {
  titular: 'Analista de procesos',
  resumen: 'Ocho años ordenando operaciones.',
  logros: LOGROS,
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
  tieneFoto: false,
  portada: { tipo: 'NINGUNA', codigo: null },
  cv: null,
}

/**
 * Lo que devuelve el «servidor». El guardado lo pisa con lo que se mandó —los
 * nombres de la cabecera son los mismos que los del perfil—, así que el refresco
 * de después enseña lo guardado sin recargar la página, como en la de verdad.
 */
let servido: PerfilCompleto = PERFIL

vi.mock('@/api/perfil', () => ({
  verPerfil: () => Promise.resolve(servido),
  guardarCabecera: (datos: Partial<PerfilCompleto>) => {
    guardados.push(datos)
    servido = { ...servido, ...datos }
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
  crearEducacion: () => Promise.resolve({ id: 9 }),
  editarEducacion: () => Promise.resolve(undefined),
  borrarEducacion: () => Promise.resolve(undefined),
  confirmarEducacion: () => Promise.resolve(undefined),
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
  // Lo de los archivos del perfil: la cabecera de identidad y la lateral los
  // llaman al montar, y sin dobles el modulo simulado no los tendria.
  PORTADAS_DE_LA_CASA: [
    { codigo: 'CANTO_MENTA', nombre: 'Arena' },
    { codigo: 'BRUMA', nombre: 'Bruma' },
  ],
  subirFoto: () => Promise.resolve(undefined),
  quitarFoto: () => Promise.resolve(undefined),
  urlDeLaFoto: () => Promise.resolve('blob:foto'),
  subirPortada: () => Promise.resolve(undefined),
  elegirPortada: () => Promise.resolve(undefined),
  quitarPortada: () => Promise.resolve(undefined),
  urlDeLaPortada: () => Promise.resolve('blob:portada'),
  subirCurriculum: () => Promise.resolve(undefined),
  quitarCurriculum: () => Promise.resolve(undefined),
  descargarCurriculum: () => Promise.resolve({ contenido: new Blob(), nombre: 'cv.pdf' }),
  subirDiploma: () => Promise.resolve(undefined),
  quitarDiploma: () => Promise.resolve(undefined),
  descargarDiploma: () => Promise.resolve({ contenido: new Blob(), nombre: 'diploma.pdf' }),
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorSesion>
        <ProveedorAvisos>
          <MemoryRouter initialEntries={['/perfil']}>
            <Perfil />
          </MemoryRouter>
        </ProveedorAvisos>
      </ProveedorSesion>
    </QueryClientProvider>,
  )
}

async function abrirLaCabecera() {
  // Hay dos puertas al mismo formulario: «Editar perfil», en la cabecera de
  // identidad, y este de dentro de la sección. Se usa el de la sección porque el
  // otro hace scroll, que en jsdom no existe.
  const editar = await screen.findByRole('button', { name: 'Editar lo tuyo' })
  fireEvent.click(editar)
  await screen.findByRole('textbox', { name: /titular/i })
}

beforeEach(() => {
  guardados.length = 0
  servido = PERFIL
})
afterEach(cleanup)

describe('la cabecera del perfil', () => {
  it('manda los siete campos —y los logros tal cual— aunque solo se cambie uno', async () => {
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
      // AC-10: editar otro campo devuelve los logros guardados sin cambiarlos.
      logros: LOGROS,
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
        <ProveedorSesion>
          <ProveedorAvisos>
            <MemoryRouter initialEntries={['/perfil']}>
              <Perfil />
            </MemoryRouter>
          </ProveedorAvisos>
        </ProveedorSesion>
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

describe('cerrar sesión vive en «Mi cuenta»', () => {
  it('sigue estando en la pantalla, ahora en el pie', async () => {
    montar()
    await screen.findByText('Analista senior')

    // ⚠️ Bajó de la primera línea al pie cuando la cabecera pasó a ser la
    // identidad de la persona, pero NO puede desaparecer: antes vivía al final
    // de «Privacidad», detrás de tres acciones que no se deshacen, y esta es la
    // pantalla a la que lleva «Mi cuenta».
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy()
  })

  it('borra la sesión al pulsarlo', async () => {
    localStorage.setItem('renaser_portal_token', 'un-token')
    montar()
    await screen.findByText('Analista senior')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => expect(localStorage.getItem('renaser_portal_token')).toBeNull())
  })
})

// ---------- Los logros clave (V71) ----------

/** Las dos listas «Logros clave»: la de la cabecera y la de «Acerca de ti». */
function lasDosListas() {
  return screen.getAllByRole('list', { name: 'Logros clave' })
}

/** Lo que dice cada lista, logro a logro y con su número delante. */
function loQueDice(lista: HTMLElement) {
  return within(lista)
    .getAllByRole('listitem')
    .map((li) => li.textContent)
}

function escribirLogro(caja: number, texto: string) {
  fireEvent.change(screen.getByRole('textbox', { name: `Logro ${caja}` }), {
    target: { value: texto },
  })
}

describe('los logros clave', () => {
  it('AC-01 · sin logros no hay rótulo ni hueco en ningún sitio', async () => {
    servido = { ...PERFIL, logros: [] }
    montar()
    await screen.findByText('Analista senior')

    expect(screen.queryByText('Logros clave')).toBeNull()
    expect(screen.queryAllByRole('list', { name: 'Logros clave' })).toHaveLength(0)
  })

  it('se leen igual en la cabecera y en «Acerca de ti»: mismo rótulo, número y orden', async () => {
    montar()
    await screen.findByText('Analista senior')

    const [cabecera, acercaDe] = lasDosListas()
    const esperado = ['1Reduje de 10 a 4 días el cierre contable', '2Ordené el archivo de una clínica entera']
    expect(loQueDice(cabecera!)).toEqual(esperado)
    expect(loQueDice(acercaDe!)).toEqual(esperado)
    // En «Acerca de ti» es un subtítulo, como «Lo que sabes hacer».
    expect(screen.getByRole('heading', { level: 3, name: 'Logros clave' })).toBeTruthy()
  })

  it('AC-05 · solo la cabecera los corta; en «Acerca de ti» van enteros', async () => {
    const largo = 'x'.repeat(100)
    servido = { ...PERFIL, logros: [largo] }
    montar()
    await screen.findByText('Analista senior')

    const [cabecera, acercaDe] = lasDosListas()
    const textoDe = (lista: HTMLElement) => within(lista).getByText(largo)
    // El texto completo está en los dos sitios —un lector de pantalla lo lee
    // entero—; el corte a dos líneas es solo la clase de la cabecera.
    expect(textoDe(cabecera!).className).toMatch(/textoCortado/)
    expect(textoDe(acercaDe!).className).not.toMatch(/textoCortado/)
  })

  it('al editar, las tres cajas vienen sembradas con lo guardado', async () => {
    montar()
    await abrirLaCabecera()

    expect(screen.getByRole('group', { name: 'Tus logros clave' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Logro 1' }) as HTMLInputElement).value).toBe(LOGROS[0])
    expect((screen.getByRole('textbox', { name: 'Logro 2' }) as HTMLInputElement).value).toBe(LOGROS[1])
    expect((screen.getByRole('textbox', { name: 'Logro 3' }) as HTMLInputElement).value).toBe('')
  })

  it('AC-02 · tres logros guardados se ven en los dos sitios sin recargar', async () => {
    servido = { ...PERFIL, logros: [] }
    montar()
    await abrirLaCabecera()

    escribirLogro(1, 'Reduje de 3 s a 400 ms la respuesta de la API')
    escribirLogro(2, 'Migré 40 servicios a AWS sin caídas')
    escribirLogro(3, 'Automaticé el despliegue de 5 aplicaciones')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(lasDosListas()).toHaveLength(2))
    const esperado = [
      '1Reduje de 3 s a 400 ms la respuesta de la API',
      '2Migré 40 servicios a AWS sin caídas',
      '3Automaticé el despliegue de 5 aplicaciones',
    ]
    for (const lista of lasDosListas()) expect(loQueDice(lista)).toEqual(esperado)
  })

  it('AC-03 · con la caja del medio vacía se guardan dos, recortados, como 1 y 2', async () => {
    servido = { ...PERFIL, logros: [] }
    montar()
    await abrirLaCabecera()

    escribirLogro(1, '  Uno  ')
    escribirLogro(2, '   ')
    escribirLogro(3, 'Tres')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(guardados).toHaveLength(1))
    expect((guardados[0] as { logros: string[] }).logros).toEqual(['Uno', 'Tres'])
    await waitFor(() => expect(lasDosListas()).toHaveLength(2))
    for (const lista of lasDosListas()) expect(loQueDice(lista)).toEqual(['1Uno', '2Tres'])
  })

  it('AC-04 · vaciar las tres manda una lista vacía y el bloque desaparece', async () => {
    montar()
    await abrirLaCabecera()

    escribirLogro(1, '')
    escribirLogro(2, '')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(guardados).toHaveLength(1))
    // Vacía y no ausente: para el backend, «ausente» es «no los toques».
    expect((guardados[0] as { logros: string[] }).logros).toEqual([])
    await waitFor(() => expect(screen.queryByText('Logros clave')).toBeNull())
  })

  it('AC-06 · una caja no pasa de 100 caracteres y el contador lo dice', async () => {
    montar()
    await abrirLaCabecera()

    const caja = screen.getByRole('textbox', { name: 'Logro 3' }) as HTMLInputElement
    expect(caja.maxLength).toBe(100)
    // `fireEvent` se salta el `maxLength` del navegador: lo que se prueba es la
    // red de debajo, la que cubre el teclado de Android.
    escribirLogro(3, 'y'.repeat(130))

    expect(caja.value).toHaveLength(100)
    expect(screen.getByText('100 de 100 caracteres')).toBeTruthy()
  })

  it('con solo logros la sección ya no está vacía', async () => {
    servido = {
      ...PERFIL,
      titular: null,
      resumen: null,
      habilidades: [],
      experienciaMeses: null,
      ubicacion: null,
      disponibilidad: null,
      pretension: null,
      logros: ['Único logro'],
    }
    montar()
    await screen.findByText('Analista senior')

    expect(screen.queryByText(/cuéntale al equipo/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar lo tuyo' })).toBeTruthy()
    expect(lasDosListas()).toHaveLength(2)
  })
})
