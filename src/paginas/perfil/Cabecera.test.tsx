/**
 * Cuánto vive la url de la foto y de la portada.
 *
 * Las dos se bajan como blob —un `<img src>` no manda el token— y se pintan con
 * `URL.createObjectURL`. Esa url **no es del componente que la enseña: es del
 * dato que vive en la caché**, y lo de aquí son los tres finales que puede
 * tener:
 *
 *   1. Salir de la pantalla y volver **no** la suelta. Atarla al desmontaje
 *      dejaba la consulta guardada apuntando a una url muerta, y la persona
 *      volvía a «Mi perfil» y veía su foto rota.
 *   2. Cerrar sesión (`clear()`) las suelta **todas**. Sin eso, la url seguía
 *      valiendo aunque el token no: la cuenta siguiente que entrara en la misma
 *      pestaña veía la foto de la anterior.
 *   3. Quitar la foto no vuelve a pedirla ni deja el blob colgado.
 *
 * ⚠️ **Lo que se comprueba no es que el `src` exista.** Existía también con el
 * fallo, con una url ya liberada dentro: es que la url del `src` no esté entre
 * las revocadas, y que la imagen no se vuelva a pedir.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorSesion } from '@/app/Sesion'
import { ProveedorAvisos } from '@/ui/Avisos'
import type { PerfilCompleto } from '@/api/tipos'
import { soltarUrlsDeArchivos } from './archivos'
import { CabeceraDelPerfil } from './Cabecera'

/** Lo que el módulo simulado necesita ver, y que se lee desde las pruebas. */
const espia = vi.hoisted(() => ({ tieneFoto: true, pedidas: 0 }))

vi.mock('@/api/perfil', () => ({
  PORTADAS_DE_LA_CASA: [
    { codigo: 'CANTO_MENTA', nombre: 'Menta' },
    { codigo: 'BRUMA', nombre: 'Bruma' },
  ],
  subirFoto: () => Promise.resolve(undefined),
  quitarFoto: () => {
    espia.tieneFoto = false
    return Promise.resolve(undefined)
  },
  // Se cuenta cada viaje: volver a bajar la imagen al reentrar sería el otro
  // arreglo posible, y es justo el que no se quiere.
  urlDeLaFoto: () => {
    espia.pedidas += 1
    return Promise.resolve(URL.createObjectURL(new Blob(['foto'])))
  },
  subirPortada: () => Promise.resolve(undefined),
  elegirPortada: () => Promise.resolve(undefined),
  quitarPortada: () => Promise.resolve(undefined),
  urlDeLaPortada: () => Promise.resolve(URL.createObjectURL(new Blob(['portada']))),
}))

let sueltas = 0
const creadas: string[] = []
const revocadas: string[] = []

const PERFIL: PerfilCompleto = {
  titular: 'Analista de procesos',
  resumen: null,
  habilidades: [],
  experienciaMeses: null,
  ubicacion: null,
  disponibilidad: null,
  pretension: null,
  experiencia: [],
  educacion: [],
  idiomas: [],
  certificaciones: [],
  enlaces: [],
  lecturaCv: { estado: 'SIN_CV', actualizadoEn: null },
  tieneFoto: true,
  portada: { tipo: 'NINGUNA', codigo: null },
  cv: null,
}

/**
 * La ficha llega por una consulta, como en la pantalla de verdad.
 *
 * Hace falta para que quitar la foto se note: `tieneFoto` pasa a false al
 * refrescar `['perfil']`, y eso es lo que apaga la consulta de la imagen. Con
 * la ficha metida a mano como prop, la pantalla seguiría diciendo que hay foto
 * y la prueba no vería el caso de verdad.
 */
function Pantalla({ base }: { base: PerfilCompleto }) {
  const perfil = useQuery({
    queryKey: ['perfil'],
    queryFn: () => Promise.resolve({ ...base, tieneFoto: espia.tieneFoto }),
  })
  return perfil.data ? <CabeceraDelPerfil perfil={perfil.data} onEditar={() => {}} /> : null
}

/** Una caché nueva con la suscripción que suelta las urls ya enganchada. */
function unaCache() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  soltarUrlsDeArchivos(datos)
  return datos
}

function montar(datos: QueryClient, base: PerfilCompleto) {
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorSesion>
        <ProveedorAvisos>
          <MemoryRouter initialEntries={['/perfil']}>
            <Pantalla base={base} />
          </MemoryRouter>
        </ProveedorAvisos>
      </ProveedorSesion>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  sueltas = 0
  espia.tieneFoto = true
  espia.pedidas = 0
  creadas.length = 0
  revocadas.length = 0
  // jsdom no trae ninguna de las dos: se ponen a mano y se apuntan las urls.
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:soltada-${++sueltas}`
    creadas.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    revocadas.push(url)
  })
})
afterEach(cleanup)

describe('salir de la pantalla y volver', () => {
  it('la foto sigue apuntando a una url viva, y no se vuelve a pedir', async () => {
    const datos = unaCache()

    const primera = montar(datos, PERFIL)
    const antes = await screen.findByRole('img', { name: /tu foto/i })
    await waitFor(() => expect(antes.getAttribute('src')).toBeTruthy())

    // Irse a otra pantalla del portal: el componente se va, la caché se queda.
    primera.unmount()

    montar(datos, PERFIL)
    const despues = await screen.findByRole('img', { name: /tu foto/i })
    await waitFor(() => expect(despues.getAttribute('src')).toBeTruthy())

    expect(revocadas).not.toContain(despues.getAttribute('src')!)
    // Ni un viaje de más: la caché es la que evita volver a bajar la imagen.
    expect(espia.pedidas).toBe(1)
    expect(creadas).toHaveLength(1)
  })

  it('la portada propia tampoco se queda con una url muerta', async () => {
    const datos = unaCache()
    espia.tieneFoto = false
    const conPortada: PerfilCompleto = {
      ...PERFIL,
      tieneFoto: false,
      portada: { tipo: 'PROPIA', codigo: null },
    }

    // La portada no es una imagen: es una banda con `background-image`, así que
    // se espera a que el estilo la lleve puesta — y no a que la url exista, que
    // pasa una vuelta antes de que React la pinte.
    const conLaBanda = (raiz: HTMLElement) => raiz.querySelector<HTMLElement>('[style*="blob:"]')

    const primera = montar(datos, conPortada)
    await waitFor(() => expect(conLaBanda(primera.container)).toBeTruthy())
    primera.unmount()

    const segunda = montar(datos, conPortada)
    await waitFor(() => expect(conLaBanda(segunda.container)).toBeTruthy())

    const url = conLaBanda(segunda.container)!.style.backgroundImage.replace(
      /^url\(["']?|["']?\)$/g,
      '',
    )
    expect(revocadas).not.toContain(url)
    expect(creadas).toHaveLength(1)
  })
})

describe('cerrar sesión', () => {
  it('vaciar la caché suelta todas las urls, y por eso la cuenta siguiente no ve la foto ajena', async () => {
    // ⚠️ Esta es la que se cae si se quita `soltarUrlsDeArchivos`: sin la
    // suscripción, `clear()` tira el dato y la url se queda viva y válida.
    const datos = unaCache()
    montar(datos, { ...PERFIL, portada: { tipo: 'PROPIA', codigo: null } })
    await waitFor(() => expect(creadas).toHaveLength(2))

    datos.clear()

    expect(revocadas).toEqual(expect.arrayContaining(creadas))
    expect(revocadas).toHaveLength(2)
  })
})

describe('quitar la foto', () => {
  it('no vuelve a pedir la imagen y no deja el blob colgado', async () => {
    const datos = unaCache()
    montar(datos, PERFIL)
    const img = await screen.findByRole('img', { name: /tu foto/i })
    await waitFor(() => expect(img.getAttribute('src')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tu foto de perfil' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar la foto' }))

    // La ficha vuelve diciendo que ya no hay foto: salen las iniciales.
    await screen.findByRole('button', { name: 'Añadir una foto de perfil' })
    expect(screen.queryByRole('img', { name: /tu foto/i })).toBeNull()

    // ⚠️ Ni un GET fantasma: quitar la consulta a mano la habría recreado —la
    // pantalla seguía mirándola— y habría pedido una foto que ya no existe.
    expect(espia.pedidas).toBe(1)

    // Y el blob no se queda colgado: lo suelta la caché al soltar el dato.
    datos.clear()
    expect(revocadas).toEqual(creadas)
  })
})
