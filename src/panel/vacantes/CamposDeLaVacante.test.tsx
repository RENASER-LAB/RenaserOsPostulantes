/**
 * La modalidad y la ciudad se eligen de una lista, y lo que no se toca no cambia.
 *
 * Lo que se protege, en orden de lo que más cuesta si se rompe:
 *
 *   1. **Que guardar sin tocar los desplegables devuelva lo que había, letra por
 *      letra.** «PRESENCIAL» marca la opción Presencial, pero si nadie la toca se
 *      manda «PRESENCIAL»: para el backend «PRESENCIAL» → «Presencial» es un
 *      cambio de modalidad y avisaría a cada postulante en carrera de algo que no
 *      pasó.
 *   2. **Que al crear no se guarde sin modalidad, ni presencial sin ciudad**, y
 *      que cada campo diga lo suyo; con Remoto y sin ciudad, sí se guarda.
 *   3. **Que una vacante vieja sin modalidad ni ciudad se pueda guardar con «Sin
 *      indicar»**, y que «Sin indicar» solo se ofrezca en ese caso.
 *   4. **Que una modalidad rara («test») salga como «test (valor anterior)»**,
 *      marcada y con la pista de elegir una de las tres.
 *   5. **Que el desplegable de ciudad sea el del registro**: agrupado por
 *      departamento y con «Fuera del Perú» al final.
 */

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { VacantePanel } from '../api/tipos'
import {
  CamposComunes,
  VACANTE_VACIA,
  camposParaGuardar,
  loQueFaltaEnLosDesplegables,
  opcionDeModalidad,
  vacanteComoFormulario,
  type DatosDeVacante,
} from './CamposDeLaVacante'

vi.mock('../api/panel', () => ({
  listarUsuarios: () => Promise.resolve([{ id: 3, correo: 'ana@renaser.pe' }]),
  verCatalogos: () =>
    Promise.resolve({
      nivelesPuesto: [],
      familias: [],
      etapas: [],
      urgencias: [],
      tiposCierre: [{ codigo: 'PERMANENTE', nombre: 'Permanente' }],
      motivosCierre: [],
      estados: [],
    }),
}))

vi.mock('@/api/portal', () => ({
  catalogoUbigeo: () =>
    Promise.resolve([
      { codigo: '0102', nombre: 'Bagua', departamento: 'Amazonas' },
      { codigo: '0401', nombre: 'Arequipa', departamento: 'Arequipa' },
      { codigo: '0402', nombre: 'Camaná', departamento: 'Arequipa' },
      { codigo: '1501', nombre: 'Lima', departamento: 'Lima' },
      { codigo: 'EXT', nombre: 'Fuera del Perú', departamento: null },
    ]),
}))

function vacante(cambios: Partial<VacantePanel> = {}): VacantePanel {
  return {
    id: 10,
    titulo: 'Administrador',
    estado: 'PUBLICADA',
    tipoCierre: 'PERMANENTE',
    puestoId: 5,
    solicitudTalentoId: 30,
    responsableUsuarioId: 3,
    publicadaEn: '2026-09-01T10:00:00Z',
    cerradaEn: null,
    aplicaEvaluacion: true,
    plantillaEvaluacionId: null,
    versionPlantillaPruebaId: null,
    versionPesosId: null,
    instrumentoEtapaTecnica: 'PLANTILLA',
    minutosEtapaTecnica: null,
    calificacionAutomatica: false,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null },
    remuneracionActualizadaEn: null,
    descripcion: 'Lleva la operación',
    proposito: null,
    responsabilidades: null,
    requisitos: null,
    modalidad: 'PRESENCIAL',
    horario: 'Tiempo completo',
    ubicacion: null,
    ciudad: { codigo: '1501', nombre: 'Lima' },
    plazas: null,
    abreEn: null,
    cierraEn: null,
    postulantesEnCarrera: 2,
    archivadaEn: null,
    puedeEditar: true,
    puedeArchivar: false,
    puedeDesarchivar: false,
    puedeEliminar: false,
    ...cambios,
  }
}

/** Monta los campos con su propio estado, como hacen el alta y la edición. */
function Formulario({ inicial, guardada }: { inicial: DatosDeVacante; guardada?: VacantePanel }) {
  const [datos, setDatos] = useState(inicial)
  const poner = (campo: keyof DatosDeVacante) => (valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }))
  return (
    <form>
      <CamposComunes datos={datos} poner={poner} guardada={guardada} />
      <output data-testid="cuerpo">{JSON.stringify(camposParaGuardar(datos))}</output>
    </form>
  )
}


function pintar(inicial: DatosDeVacante, guardada?: VacantePanel) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <Formulario inicial={inicial} guardada={guardada} />
    </QueryClientProvider>,
  )
}

function cuerpo(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('cuerpo').textContent ?? '{}') as Record<string, unknown>
}

afterEach(() => cleanup())

describe('Qué opción marca una modalidad guardada', () => {
  it('«PRESENCIAL» y «Hibrido» marcan la suya sin mirar mayúsculas ni tildes; «test» es propia', () => {
    expect(opcionDeModalidad('PRESENCIAL')).toBe('Presencial')
    expect(opcionDeModalidad('Hibrido')).toBe('Híbrido')
    expect(opcionDeModalidad(' remoto ')).toBe('Remoto')
    expect(opcionDeModalidad('test')).toBe('test')
    expect(opcionDeModalidad('   ')).toBe('')
  })
})

describe('Al editar, lo que no se toca no cambia', () => {
  it('con «PRESENCIAL» y Lima guardados, el desplegable marca Presencial y Lima, y el cuerpo manda «PRESENCIAL» y «1501»', async () => {
    const guardada = vacante()
    pintar(vacanteComoFormulario(guardada), guardada)

    const modalidad = screen.getByLabelText('Modalidad') as HTMLSelectElement
    expect(modalidad.value).toBe('Presencial')
    expect(within(modalidad).queryByRole('option', { name: 'Sin indicar' })).toBeNull()

    const ciudad = (await screen.findByLabelText('Ciudad')) as HTMLSelectElement
    await waitFor(() => expect(ciudad.disabled).toBe(false))
    expect(ciudad.value).toBe('1501')

    expect(cuerpo()).toMatchObject({ modalidad: 'PRESENCIAL', ciudadUbigeo: '1501' })
  })

  it('elegir otra opción sí cambia lo que se manda', async () => {
    const guardada = vacante()
    pintar(vacanteComoFormulario(guardada), guardada)
    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: 'Remoto' } })
    const ciudad = (await screen.findByLabelText('Ciudad')) as HTMLSelectElement
    await waitFor(() => expect(ciudad.disabled).toBe(false))
    fireEvent.change(ciudad, { target: { value: '0401' } })
    expect(cuerpo()).toMatchObject({ modalidad: 'Remoto', ciudadUbigeo: '0401' })
  })

  it('una vacante vieja sin modalidad ni ciudad muestra «Sin indicar» en los dos y se manda sin ellos', async () => {
    const guardada = vacante({ modalidad: null, ciudad: null, ubicacion: 'Selva Alegre' })
    pintar(vacanteComoFormulario(guardada), guardada)

    const modalidad = screen.getByLabelText('Modalidad') as HTMLSelectElement
    expect(modalidad.value).toBe('')
    expect(within(modalidad).getByRole('option', { name: 'Sin indicar' })).toBeTruthy()

    const ciudad = (await screen.findByLabelText('Ciudad')) as HTMLSelectElement
    await waitFor(() => expect(ciudad.disabled).toBe(false))
    expect(within(ciudad).getByRole('option', { name: 'Sin indicar' })).toBeTruthy()

    expect(loQueFaltaEnLosDesplegables(vacanteComoFormulario(guardada), guardada)).toEqual({})
    const enviado = cuerpo()
    expect(enviado.modalidad).toBeUndefined()
    expect(enviado.ciudadUbigeo).toBeUndefined()
    expect(enviado.ubicacion).toBe('Selva Alegre')
  })

  it('«test» aparece como «test (valor anterior)», marcada y con la pista de elegir una de las tres', () => {
    const guardada = vacante({ modalidad: 'test' })
    pintar(vacanteComoFormulario(guardada), guardada)
    const modalidad = screen.getByLabelText('Modalidad') as HTMLSelectElement
    expect(modalidad.value).toBe('test')
    expect(within(modalidad).getByRole('option', { name: 'test (valor anterior)' })).toBeTruthy()
    expect(screen.getByText('Elige una de las tres para que el portal pueda filtrarla')).toBeTruthy()
    expect(cuerpo()).toMatchObject({ modalidad: 'test' })
  })

  it('elegir Presencial en una vieja sin ciudad vuelve a pedir la ciudad; sin tocarla, no', () => {
    const guardada = vacante({ modalidad: null, ciudad: null })
    const datos = vacanteComoFormulario(guardada)
    expect(loQueFaltaEnLosDesplegables({ ...datos, modalidad: 'Presencial' }, guardada))
      .toEqual({ ciudadUbigeo: 'Elige la ciudad del puesto.' })
    expect(loQueFaltaEnLosDesplegables({ ...datos, modalidad: 'Remoto' }, guardada)).toEqual({})
    expect(loQueFaltaEnLosDesplegables({ ...datos, horario: '9am-6pm' }, guardada)).toEqual({})
  })
})

describe('Al crear', () => {
  it('sin modalidad no se guarda; con Presencial sin ciudad tampoco; con Remoto sin ciudad, sí', () => {
    expect(loQueFaltaEnLosDesplegables(VACANTE_VACIA)).toEqual({
      modalidad: 'Elige si es presencial, híbrida o remota.',
    })
    expect(loQueFaltaEnLosDesplegables({ ...VACANTE_VACIA, modalidad: 'Presencial' })).toEqual({
      ciudadUbigeo: 'Elige la ciudad del puesto.',
    })
    expect(loQueFaltaEnLosDesplegables({ ...VACANTE_VACIA, modalidad: 'Híbrido' })).toEqual({
      ciudadUbigeo: 'Elige la ciudad del puesto.',
    })
    expect(loQueFaltaEnLosDesplegables({ ...VACANTE_VACIA, modalidad: 'Remoto' })).toEqual({})
    expect(loQueFaltaEnLosDesplegables({ ...VACANTE_VACIA, modalidad: 'Presencial', ciudadUbigeo: '1501' })).toEqual({})
  })

  it('el desplegable ofrece «Elige…» y las tres, nunca «Sin indicar»; y cada campo dice lo que falta', () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={cliente}>
        <CamposComunes
          datos={VACANTE_VACIA}
          poner={() => () => {}}
          errores={{
            modalidad: 'Elige si es presencial, híbrida o remota.',
            ciudadUbigeo: 'Elige la ciudad del puesto.',
          }}
        />
      </QueryClientProvider>,
    )
    const modalidad = screen.getByLabelText('Modalidad') as HTMLSelectElement
    expect(within(modalidad).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Elige…', 'Presencial', 'Híbrido', 'Remoto',
    ])
    expect(modalidad.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Elige si es presencial, híbrida o remota.')).toBeTruthy()
    expect(screen.getByText('Elige la ciudad del puesto.')).toBeTruthy()
    expect(screen.getByLabelText('Zona o referencia (opcional)')).toBeTruthy()
    expect(screen.getByText('Barrio, distrito o dirección. Se ve en la ficha de la vacante')).toBeTruthy()
  })
})

describe('El desplegable de ciudad', () => {
  it('agrupa las provincias por departamento y deja «Fuera del Perú» al final, como el registro', async () => {
    pintar(VACANTE_VACIA)
    const ciudad = (await screen.findByLabelText('Ciudad')) as HTMLSelectElement
    await waitFor(() => expect(ciudad.disabled).toBe(false))
    const grupos = Array.from(ciudad.querySelectorAll('optgroup')).map((g) => g.label)
    expect(grupos).toEqual(['Amazonas', 'Arequipa', 'Lima'])
    const opciones = within(ciudad).getAllByRole('option').map((o) => o.textContent)
    expect(opciones[0]).toBe('Elige la ciudad…')
    expect(opciones.at(-1)).toBe('Fuera del Perú')
    expect(ciudad.querySelector('option[value="EXT"]')?.closest('optgroup')).toBeNull()
  })
})
