/**
 * La politica publica es el documento que Play exige leer sin cuenta, y el unico
 * sitio donde el candidato puede comprobar quien responde por sus datos.
 *
 * Lo que fijan estas pruebas son las tres cosas que se pueden perder en una
 * edicion de estilo sin que nada deje de compilar, y que son justo las que la
 * ley 29733 obliga a decir:
 *
 *   1. **Quien responde, con sus datos registrales.** Sin RUC ni domicilio el
 *      responsable no esta identificado, por mucho que se le nombre.
 *   2. **Los encargados por su nombre, y que los datos salen del pais.** Por
 *      categoria («proveedores de inteligencia artificial») no vale: el flujo
 *      transfronterizo del articulo 15 se informa antes de que nadie acepte.
 *   3. **Que el texto que se enseña es el publicado, no una copia.** Si esta
 *      pagina lo reescribiera a mano, se desviaria del que la gente firma — y
 *      el que vale es el firmado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PoliticaPublica } from './PoliticaPublica'

const TEXTO_PUBLICADO =
  'QUIÉN TRATA MIS DATOS. Esto viene del backend y no de la pantalla.'

/** Lo que contesta el backend en cada prueba. Se cambia antes de montar. */
let textosDelBackend: { tipo: string; version: string; texto: string }[] = []

const TEXTO_POR_VACANTE =
  'Acepto que la empresa que publica la vacante trate mis datos. Ella decide.'

const VIGENTES = [
  { tipo: 'PLATAFORMA', version: '1.0', texto: TEXTO_PUBLICADO },
  { tipo: 'PROCESO', version: '1.1', texto: TEXTO_POR_VACANTE },
  { tipo: 'FUTUROS_CONTACTOS', version: '1.1', texto: 'El opcional, tal cual.' },
]

/** Lo que contesta el texto de una vacante concreta, cuando se pide. */
let deLaVacante = {
  nombreEmpresa: 'Acme S.A.C.',
  version: '2.0',
  texto: 'Acme S.A.C. tratará tus datos conforme a su política propia.',
}

vi.mock('@/api/portal', () => ({
  textosConsentimiento: () => Promise.resolve(textosDelBackend),
  consentimientoDeVacante: () => Promise.resolve(deLaVacante),
}))

beforeEach(() => {
  textosDelBackend = VIGENTES
})

afterEach(cleanup)

function montar(direccion = '/politica-de-privacidad') {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={[direccion]}>
        <PoliticaPublica />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la política de privacidad pública', () => {
  it('identifica al responsable con razón social, RUC y domicilio', () => {
    montar()

    expect(screen.getByText('RENASER CONSULTING S.A.C.')).toBeTruthy()
    expect(screen.getByText('20615428419')).toBeTruthy()
    expect(screen.getByText(/Manuel Castillo/)).toBeTruthy()
    // El correo sale varias veces a lo largo del documento; aquí basta con que
    // esté, y en la ficha del responsable.
    expect(screen.getAllByRole('link', { name: 'renaserlab@gmail.com' }).length)
      .toBeGreaterThan(0)
  })

  it('nombra a los encargados y dice que los datos salen del Perú', () => {
    montar()

    expect(screen.getByRole('rowheader', { name: 'DeepSeek' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Google' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Supabase' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Amazon Web Services' })).toBeTruthy()
    // Vercel sirve la página donde se teclean nombre, correo y contraseña: declararlo de
    // menos en el formulario de Seguridad de Datos de Play es motivo de retirada.
    expect(screen.getByRole('rowheader', { name: 'Vercel' })).toBeTruthy()
    expect(screen.getByText(/están fuera del Perú/)).toBeTruthy()
    expect(screen.getByText(/flujo transfronterizo/)).toBeTruthy()
  })

  it('no promete que ninguna decisión es automática: enumera las tres que sí lo son', () => {
    // La versión anterior decía «ninguna decisión sobre tu candidatura se toma
    // automáticamente» y era falso — `cerrarVencidas` cierra procesos cada 60 segundos sin
    // persona. Esta prueba existe para que esa frase no vuelva sola en una edición de
    // estilo: una política que promete lo que el código no hace es la prueba en contra.
    montar()

    expect(screen.queryByText(/ninguna decisión sobre tu candidatura se toma autom/i)).toBeNull()
    expect(screen.getByText(/Ninguna nota te contrata ni te descarta por sí sola/)).toBeTruthy()
    expect(screen.getByText(/si se te pasa el plazo/i)).toBeTruthy()
    expect(screen.getByText(/configuró su vacante para avanzar sola/i)).toBeTruthy()
    expect(screen.getByText(/no cumples un requisito indispensable/i)).toBeTruthy()
  })

  it('separa el permiso con Renaser del de cada empresa', () => {
    montar()

    // La confusión que el rediseño vino a arreglar: eran el mismo texto firmado
    // dos veces, y ahora son dos permisos con dos responsables distintos.
    expect(screen.getByRole('heading', { name: /tres permisos/i })).toBeTruthy()
    // Y que al postular NO hay casilla: es la parte que más se presta a que alguien
    // «arregle» el texto de vuelta a la versión anterior.
    expect(screen.getByText(/Aquí no hay casilla/i)).toBeTruthy()
    expect(screen.getByText(/no alcanza a las demás empresas del portal/i)).toBeTruthy()
  })

  it('enseña el texto vigente que sirve el backend, no uno copiado aquí', async () => {
    montar()

    await waitFor(() => expect(screen.getByText(TEXTO_PUBLICADO)).toBeTruthy())
    expect(screen.getByText('El opcional, tal cual.')).toBeTruthy()
    // Y sin el número de versión a la vista: el versionado vive en la base, que es
    // donde sostiene la prueba. Al candidato «versión 1.0» no le dice nada y solo
    // sugiere que hay otras versiones por ahí que no puede ver.
    expect(screen.queryByText(/versión 1\.\d/)).toBeNull()
  })

  it('con la lista vacía lo dice, en vez de dejar el hueco callado', async () => {
    // El 200 con lista vacía no es un error para react-query: sin esta comprobación la
    // sección «El texto que aceptas» se queda con su título y nada debajo, que en una
    // página legal es peor que un error.
    textosDelBackend = []
    montar()

    await waitFor(() =>
      expect(screen.getByText(/No pudimos cargar el texto vigente/)).toBeTruthy(),
    )
  })

  it('si falta alguno, lo dice y enseña los que sí llegaron', async () => {
    textosDelBackend = [VIGENTES[0]!]
    montar()

    await waitFor(() => expect(screen.getByText(TEXTO_PUBLICADO)).toBeTruthy())
    expect(screen.getByText(/Falta por cargar alguno de los textos/)).toBeTruthy()
  })

  it('sin vacante, el texto por vacante llega ya compuesto desde el backend', async () => {
    // Es uno solo para todas las empresas y guarda un hueco donde va el nombre de
    // quien publica la vacante. Aquí no hay vacante de la que sacarlo, así que el
    // backend lo compone con «la empresa que publica la vacante»: el hueco no cruza
    // la frontera, para que ningún cliente tenga que saber sustituirlo.
    montar()

    await waitFor(() =>
      expect(
        screen.getByText(/Acepto que la empresa que publica la vacante trate mis datos/),
      ).toBeTruthy(),
    )
    expect(screen.queryByText(/\{EMPRESA\}/)).toBeNull()
  })

  it('llegando desde una vacante, enseña el texto de ESA empresa', async () => {
    /*
      El agujero que abrió quitar la casilla de postular: el formulario dejó de
      pintar el texto legal y el enlace traía aquí, donde el texto sale con «la
      empresa que publica la vacante» en vez de un nombre. Quien llega desde el
      formulario está a punto de firmar y tiene que leer el suyo: es lo único que
      la casilla aportaba de verdad.
    */
    montar('/politica-de-privacidad?vacante=7')

    await waitFor(() =>
      expect(screen.getByText(/Acme S\.A\.C\. tratará tus datos conforme a su política propia/))
        .toBeTruthy(),
    )
    expect(screen.getByRole('heading', { name: /Al postular a Acme S\.A\.C\./ })).toBeTruthy()
    // Y no se enseña el general, que no es el que esa persona va a firmar.
    expect(screen.queryByText(/la empresa que publica la vacante trate mis datos/)).toBeNull()
  })

  it('la sección de los textos lleva el ancla a la que apuntan las casillas', () => {
    // Sin ella, quien pulsa el enlace desde una casilla aterriza arriba del todo
    // y tiene que buscar el párrafo que está a punto de firmar.
    const { container } = montar()

    expect(container.querySelector('#el-texto-que-aceptas')).toBeTruthy()
  })

  it('dice el plazo de conservación con un número, no «lo que haga falta»', () => {
    montar()

    expect(screen.getByText(/24 meses sin actividad/)).toBeTruthy()
  })
})
