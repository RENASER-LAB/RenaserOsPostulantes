/**
 * Crear cuenta: que se firme el permiso de Renaser, y no el de una vacante.
 *
 * Hasta la V54 esta pantalla enseñaba el texto `PROCESO` —«evaluar mi
 * postulacion a esta vacante»— cuando todavia no hay ninguna vacante, y quien
 * luego postulaba a una de Renaser volvia a firmar ESE MISMO texto. Dos filas
 * del mismo texto para la misma persona, y una de ellas hablando de algo que no
 * existe: en un juicio por proteccion de datos eso es un consentimiento que no
 * dice a que se refiere.
 *
 * Las cuatro cosas que se pierden en cualquier edicion sin que nada falle:
 *
 *   1. **Que el enlace lleve al texto**, y no a la portada de la politica. Desde
 *      que la explicacion se acorto a una linea (15/09/2026), ese enlace es la
 *      UNICA via por la que el candidato se entera de la IA, los proveedores y la
 *      salida del pais: si deja de llevar al texto, el consentimiento deja de
 *      estar informado.
 *   2. **Que la ciudad no se pueda saltar.** Es el unico sitio donde entra el
 *      dato, y el backend la exige: sin la marca de obligatorio, sin el aviso
 *      junto al campo o con una provincia preseleccionada, la pantalla empuja a
 *      registrarse mal o a rebotar contra un 400 que no supo prevenir.
 *   3. **Que el permiso opcional siga siendo opcional y aparte.** Juntarlos en
 *      una casilla es pedir un permiso que nadie dio.
 *   4. **Que lo que se manda salga de la casilla.** El backend firma ese dato
 *      con la fecha y la IP; firmar algo que la persona no marco es peor que no
 *      firmarlo.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorSesion } from '@/app/Sesion'
import { Registro } from './Registro'

const enviados: unknown[] = []

/*
  `textosConsentimiento` NO se dobla a proposito: esta pantalla ya no lo llama.
  Si alguien volviera a pedir los textos aqui para pintarlos, el mock no tendria
  esa funcion y la prueba reventaria — que es justo el aviso que se quiere.
*/
/*
  El catálogo, con las dos formas que tiene: una provincia con su departamento y
  `EXT`, que no cuelga de ninguno y se ofrece igual. `fallaElCatalogo` lo tumba
  para la prueba del fallo de carga, y se repone en cada `afterEach`.
*/
const CATALOGO = [
  { codigo: '0402', nombre: 'Arequipa', departamento: 'Arequipa' },
  { codigo: 'EXT', nombre: 'Fuera del Perú', departamento: null },
]
let fallaElCatalogo = false
let vecesPedido = 0

vi.mock('@/api/portal', () => ({
  catalogoUbigeo: () => {
    vecesPedido += 1
    return fallaElCatalogo
      ? Promise.reject(new Error('no se pudo cargar el catálogo'))
      : Promise.resolve(CATALOGO)
  },
  crearCuenta: (datos: unknown) => {
    enviados.push(datos)
    return Promise.resolve()
  },
  ingresar: () => Promise.resolve({ token: 't', usuarioId: 1, nombre: 'Camila', apellidos: 'Reyes' }),
  quienSoy: () => Promise.resolve({ usuarioId: 1, nombre: 'Camila', apellidos: 'Reyes' }),
}))

afterEach(() => {
  enviados.length = 0
  fallaElCatalogo = false
  vecesPedido = 0
  cleanup()
})

/** El recuadro de una casilla, por el título que lleva. */
function casillaDe(titulo: RegExp) {
  const etiqueta = screen.getByText(titulo)
  const recuadro = etiqueta.closest('div')?.parentElement
  if (!recuadro) throw new Error('no encuentro el recuadro de esa casilla')
  return within(recuadro)
}

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorSesion>
        <MemoryRouter initialEntries={['/registro']}>
          <Registro />
        </MemoryRouter>
      </ProveedorSesion>
    </QueryClientProvider>,
  )
}

/**
 * El desplegable de la ciudad.
 *
 * Por expresión y no por texto exacto: su etiqueta lleva el asterisco y la
 * palabra «obligatorio» que solo oye el lector de pantalla, que es justamente lo
 * que la pantalla tiene que decir antes de que nadie pulse. Lo mismo vale para
 * los demás campos, y por eso todos se buscan con `/^Nombre/` y no con el texto
 * exacto: `getByLabelText` compara el texto ENTERO de la etiqueta.
 */
function ciudad() {
  return screen.getByLabelText(/^Ciudad/) as HTMLSelectElement
}

/** Todo lo escrito a mano: lo que tiene que seguir ahí después de un error. */
function rellenarLoEscrito() {
  fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Camila' } })
  fireEvent.change(screen.getByLabelText(/^Apellidos/), { target: { value: 'Reyes' } })
  fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'camila@correo.pe' } })
  fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'unaClaveLarga123' } })
  fireEvent.change(screen.getByLabelText(/^Repite la contraseña/), {
    target: { value: 'unaClaveLarga123' },
  })
}

/** Hasta que el catálogo llegó: antes de eso el desplegable está apagado. */
async function esperarLasCiudades() {
  await waitFor(() => expect(screen.getByRole('option', { name: 'Arequipa' })).toBeTruthy())
}

/** Todo lo obligatorio menos el permiso. */
async function rellenarSinAceptar() {
  rellenarLoEscrito()
  await esperarLasCiudades()
  fireEvent.change(ciudad(), { target: { value: '0402' } })
}

/** Todo lo obligatorio menos la ciudad, permiso incluido. */
async function rellenarSinCiudad() {
  rellenarLoEscrito()
  await esperarLasCiudades()
  const obligatorio = screen.getAllByRole('checkbox')[0]
  if (!obligatorio) throw new Error('la casilla obligatoria no está en la pantalla')
  fireEvent.click(obligatorio)
}

function crearCuenta() {
  fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }))
}

describe('crear cuenta', () => {
  it('el enlace lleva al texto que se va a firmar, no a la portada', async () => {
    montar()

    const casilla = casillaDe(/Acepto el tratamiento de mis datos/)
    // Ni una palabra de «esta vacante» en la pantalla donde no hay ninguna.
    expect(screen.queryByText(/esta vacante/i)).toBeNull()

    // Y el enlace al documento entero, apuntando al bloque que se va a firmar y
    // no a la portada: quien lo pulsa desde aquí no quiere leerse la política.
    const enlace = casilla.getByRole('link', { name: /política de privacidad/i })
    expect(enlace.getAttribute('href')).toBe('/politica-de-privacidad#el-texto-que-aceptas')
    expect(enlace.getAttribute('target')).toBe('_blank')

    await waitFor(() => expect(screen.getByRole('option', { name: 'Arequipa' })).toBeTruthy())
  })

  it('el texto legal ya no se pinta dentro del formulario', () => {
    montar()

    // El plegable de 4.600 caracteres en una caja con scroll se retiró: nadie lo
    // leía ahí y el documento se lee mejor en su propia página.
    expect(screen.queryByText(/Leer el texto completo/i)).toBeNull()
  })

  it('son dos casillas distintas: una obligatoria y otra opcional', () => {
    // Juntarlas en una sola es pedir un permiso que nadie dio: aceptar que te
    // evalúen y querer que te avisen de otras vacantes son cosas distintas, y la
    // segunda se retira por su cuenta sin tocar ningún proceso.
    montar()

    expect(screen.getByText(/Acepto el tratamiento de mis datos/)).toBeTruthy()
    expect(screen.getByText(/Quiero que me avisen de futuras vacantes/)).toBeTruthy()
    const casillas = screen.getAllByRole('checkbox')
    expect(casillas.length).toBe(2)
    expect(casillas.every((c) => !(c as HTMLInputElement).checked)).toBe(true)
    // Y se dice cuál es cuál: sin esto, la opcional parece obligatoria y se marca
    // «por si acaso», que es un consentimiento que no vale nada.
    //
    // El obligatorio lleva el asterisco del resto del formulario; la opcional lo
    // dice con todas sus letras, porque «no tiene asterisco» no es algo que nadie
    // note. Acotado a cada recuadro: los asteriscos son siete en esta pantalla.
    expect(casillaDe(/Acepto el tratamiento de mis datos/).getByText('*')).toBeTruthy()
    expect(
      casillaDe(/Quiero que me avisen de futuras vacantes/).getByText(/· opcional/),
    ).toBeTruthy()
    expect(
      casillaDe(/Quiero que me avisen de futuras vacantes/).queryByText('*'),
    ).toBeNull()
  })

  it('todo lo que el esquema exige lleva asterisco, y lo opcional no', async () => {
    /*
      La marca sale del esquema `Datos`, no de la maquetación: si mañana una
      validación se afloja, el asterisco tiene que irse solo. Aquí se comprueba el
      resultado de esa deducción campo por campo, incluido el permiso obligatorio
      —que el esquema exige con `z.literal(true)`— y el opcional, que no.
    */
    montar()
    await esperarLasCiudades()

    for (const etiqueta of [
      /^Nombre/,
      /^Apellidos/,
      /^Correo/,
      /^Contraseña/,
      /^Repite la contraseña/,
      /^Ciudad/,
    ]) {
      const campo = screen.getByLabelText(etiqueta)
      const suEtiqueta = document.querySelector(`label[for="${campo.id}"]`)
      // El asterisco lo ve quien mira; «obligatorio», quien escucha. Los dos van
      // dentro de la etiqueta, que es lo que se anuncia al llegar al campo.
      expect(suEtiqueta?.textContent, String(etiqueta)).toMatch(/ \* obligatorio$/)
      expect(suEtiqueta?.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('*')
      expect(campo.getAttribute('aria-required'), String(etiqueta)).toBe('true')
    }

    // El permiso obligatorio: mismo trato que un campo.
    const permisos = screen.getAllByRole('checkbox')
    expect(casillaDe(/Acepto el tratamiento de mis datos/).getByText('*')).toBeTruthy()
    expect(permisos[0]?.getAttribute('aria-required')).toBe('true')

    // Y el opcional se queda sin marca: si se marcara todo, la marca no diría nada.
    expect(casillaDe(/Quiero que me avisen de futuras vacantes/).queryByText('*')).toBeNull()
    expect(permisos[1]?.getAttribute('aria-required')).toBeNull()

    // Siete marcas piden que alguien diga qué significan, una vez y antes del
    // primer campo.
    expect(screen.getByText(/Los campos con/).textContent).toMatch(
      /Los campos con \* son obligatorios\./,
    )
  })

  it('sin marcar el obligatorio no se manda nada', async () => {
    montar()
    await rellenarSinAceptar()

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() =>
      expect(screen.getByText(/Sin este permiso no podemos crear tu cuenta/)).toBeTruthy(),
    )
    expect(enviados).toHaveLength(0)
  })

  it('lo que se manda sale de las casillas: aceptaPlataforma y el opcional sin marcar', async () => {
    montar()
    await rellenarSinAceptar()

    const obligatorio = screen.getAllByRole('checkbox')[0]
    if (!obligatorio) throw new Error('la casilla obligatoria no está en la pantalla')
    fireEvent.click(obligatorio)
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({
      correo: 'camila@correo.pe',
      ciudadUbigeo: '0402',
      aceptaPlataforma: true,
      aceptaFuturosContactos: false,
    })
  })
})

/*
  La ciudad, que es obligatoria y solo se pide aquí.

  El backend la exige contra su catálogo y devuelve un 400 con cualquier código que
  el desplegable no ofrezca. Estas pruebas son de lo otro: que la pantalla lo diga
  ANTES —y no rebotando contra ese 400—, que no lo diga con una ciudad
  preseleccionada que nadie eligió, y que un error no cueste volver a escribir el
  formulario entero.
*/
describe('la ciudad al crear la cuenta', () => {
  it('se ve obligatoria y sin ninguna ciudad elegida', async () => {
    montar()
    await esperarLasCiudades()

    // La marca va en la etiqueta, que es lo que se lee sin pulsar nada: el
    // asterisco para quien mira —escondido del lector, que diría «asterisco»— y
    // la palabra para quien escucha. Y `aria-required` en el control, que es el
    // estado de verdad y no depende de ninguna marca dibujada.
    const etiqueta = document.querySelector(`label[for="${ciudad().id}"]`)
    expect(etiqueta?.textContent).toBe('Ciudad * obligatorio')
    expect(etiqueta?.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('*')
    expect(ciudad().getAttribute('aria-required')).toBe('true')

    // Nada elegido: lo que está puesto es el texto de ayuda, y vale `''`. Si
    // alguna vez arranca con una provincia de verdad, alguien acabará registrado
    // en una ciudad que no es la suya sin haber tocado el desplegable.
    expect(ciudad().value).toBe('')
    const ayuda = screen.getByRole('option', { name: /Elige tu ciudad/ }) as HTMLOptionElement
    expect(ayuda.value).toBe('')
    expect(ciudad().selectedIndex).toBe(0)
  })

  it('sin ciudad no se crea la cuenta: el error sale junto al campo y no se pierde lo escrito', async () => {
    montar()
    await rellenarSinCiudad()

    crearCuenta()

    // La frase exacta que pidió el cliente, no una parecida.
    const mensaje = await waitFor(() => screen.getByText('Selecciona tu ciudad'))
    expect(enviados).toHaveLength(0)

    // Junto al campo y atado a él: sin esto el error existe en la pantalla pero
    // no para quien la escucha, y el salto al primer campo con problema —que
    // busca `aria-invalid`— se lo saltaría en silencio.
    expect(ciudad().getAttribute('aria-invalid')).toBe('true')
    expect(ciudad().getAttribute('aria-describedby')?.split(' ')).toContain(mensaje.id)

    // Y lo demás sigue escrito: un error en un campo no vacía el formulario.
    expect((screen.getByLabelText(/^Nombre/) as HTMLInputElement).value).toBe('Camila')
    expect((screen.getByLabelText(/^Apellidos/) as HTMLInputElement).value).toBe('Reyes')
    expect((screen.getByLabelText(/^Correo/) as HTMLInputElement).value).toBe('camila@correo.pe')
    expect((screen.getByLabelText(/^Contraseña/) as HTMLInputElement).value).toBe('unaClaveLarga123')
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true)
  })

  it('al elegir la ciudad el error se retira y el registro continúa con su código', async () => {
    montar()
    await rellenarSinCiudad()
    crearCuenta()
    await waitFor(() => expect(screen.getByText('Selecciona tu ciudad')).toBeTruthy())

    fireEvent.change(ciudad(), { target: { value: '0402' } })

    // El aviso se va al corregir: leer «Selecciona tu ciudad» debajo de la ciudad
    // recién elegida es la pantalla contradiciéndose.
    await waitFor(() => expect(screen.queryByText('Selecciona tu ciudad')).toBeNull())
    crearCuenta()

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({ correo: 'camila@correo.pe', ciudadUbigeo: '0402' })
  })

  it('«Fuera del Perú» cuenta como ciudad elegida', async () => {
    // Es la opción de escape del catálogo: no cuelga de ningún departamento, así
    // que se pinta suelta al final. Tratarla como «sin elegir» dejaría fuera del
    // registro a quien vive fuera del país.
    montar()
    await rellenarSinCiudad()

    fireEvent.change(ciudad(), { target: { value: 'EXT' } })
    crearCuenta()

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({ ciudadUbigeo: 'EXT' })
  })

  it('si el catálogo no carga se dice, se puede reintentar y no se registra sin ciudad', async () => {
    fallaElCatalogo = true
    montar()

    await waitFor(() =>
      expect(screen.getByText(/No pudimos cargar la lista de ciudades/)).toBeTruthy(),
    )
    expect(ciudad().disabled).toBe(true)

    // Sin lista no se puede elegir, y sin elegir no se crea la cuenta: el fallo
    // del catálogo no abre la puerta a un registro sin ciudad.
    rellenarLoEscrito()
    const permiso = screen.getAllByRole('checkbox')[0]
    if (!permiso) throw new Error('la casilla obligatoria no está en la pantalla')
    fireEvent.click(permiso)
    crearCuenta()
    await waitFor(() => expect(screen.getByText(/Falta un dato por revisar/)).toBeTruthy())
    expect(enviados).toHaveLength(0)
    // Y el aviso sigue siendo el del fallo de carga, no «elige una ciudad»: no hay
    // lista de la que elegir, y la culpa no es de quien se está registrando.
    expect(screen.getByText(/No pudimos cargar la lista de ciudades/)).toBeTruthy()
    expect(screen.queryByText('Selecciona tu ciudad')).toBeNull()

    // Reintentar sin recargar: lo escrito sigue ahí cuando la lista llega.
    fallaElCatalogo = false
    fireEvent.click(screen.getByRole('button', { name: /Volver a cargar las ciudades/ }))

    await esperarLasCiudades()
    expect(vecesPedido).toBeGreaterThan(1)
    expect(ciudad().disabled).toBe(false)
    expect((screen.getByLabelText(/^Nombre/) as HTMLInputElement).value).toBe('Camila')
  })
})
