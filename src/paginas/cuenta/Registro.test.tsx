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
vi.mock('@/api/portal', () => ({
  catalogoUbigeo: () =>
    Promise.resolve([{ codigo: '0402', nombre: 'Arequipa', departamento: 'Arequipa' }]),
  crearCuenta: (datos: unknown) => {
    enviados.push(datos)
    return Promise.resolve()
  },
  ingresar: () => Promise.resolve({ token: 't', usuarioId: 1, nombre: 'Camila', apellidos: 'Reyes' }),
  quienSoy: () => Promise.resolve({ usuarioId: 1, nombre: 'Camila', apellidos: 'Reyes' }),
}))

afterEach(() => {
  enviados.length = 0
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

/** Todo lo obligatorio menos el permiso. */
async function rellenarSinAceptar() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Camila' } })
  fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Reyes' } })
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'camila@correo.pe' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'unaClaveLarga123' } })
  fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
    target: { value: 'unaClaveLarga123' },
  })
  await waitFor(() => expect(screen.getByRole('option', { name: 'Arequipa' })).toBeTruthy())
  fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: '0402' } })
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
    expect(screen.getByText(/· obligatorio/)).toBeTruthy()
    expect(screen.getByText(/· opcional/)).toBeTruthy()
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
