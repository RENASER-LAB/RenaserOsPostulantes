/**
 * Las reglas del alta que se avisan antes de enviar. Son las del backend
 * (`ReglasDelColaborador`); aquí solo se comprueba que el aviso llega.
 */

import { describe, expect, it } from 'vitest'
import {
  erroresDePersona,
  erroresDeSituacion,
  limpiarDocumento,
  personaVacia,
  situacionParaLaApi,
  situacionVacia,
} from './formulario'

const HOY = '2026-09-29'
const OPCIONES = { contratosConFin: ['03', '11'], contratoIndeterminado: '01' }

describe('lo personal', () => {
  const valida = {
    ...personaVacia(),
    numeroDocumento: '45.123.456',
    nombres: 'Ana',
    apellidoPaterno: 'Rivas',
    fechaNacimiento: '1990-01-01',
    sexo: 'F',
  }

  it('un DNI con puntos se limpia y vale; con 7 dígitos no', () => {
    expect(limpiarDocumento(' 45.123.456 ')).toBe('45123456')
    expect(erroresDePersona(valida, HOY)).toEqual({})
    expect(erroresDePersona({ ...valida, numeroDocumento: '4512345' }, HOY).numeroDocumento).toBe(
      'El DNI tiene que tener 8 dígitos.',
    )
  })

  it('otros documentos admiten de 4 a 15 letras o dígitos', () => {
    expect(erroresDePersona({ ...valida, tipoDocumento: '07', numeroDocumento: 'PA1234' }, HOY)).toEqual({})
    expect(erroresDePersona({ ...valida, tipoDocumento: '07', numeroDocumento: 'P1' }, HOY).numeroDocumento).toBeDefined()
  })

  it('la fecha de nacimiento no es futura y pide al menos 14 años; un nombre de espacios no vale', () => {
    expect(erroresDePersona({ ...valida, fechaNacimiento: '2026-10-01' }, HOY).fechaNacimiento).toContain('futura')
    expect(erroresDePersona({ ...valida, fechaNacimiento: '2012-09-30' }, HOY).fechaNacimiento).toContain('14 años')
    expect(erroresDePersona({ ...valida, fechaNacimiento: '2012-09-29' }, HOY).fechaNacimiento).toBeUndefined()
    expect(erroresDePersona({ ...valida, nombres: '   ' }, HOY).nombres).toBeDefined()
  })
})

describe('el contrato', () => {
  const base = { ...situacionVacia(), sedeId: '1', areaId: '2', cargoId: '3', tipoContrato: '03', finContrato: '2027-03-01' }

  it('a plazo pide fecha de fin; el indeterminado no la admite', () => {
    expect(erroresDeSituacion({ ...base, finContrato: '' }, HOY, OPCIONES, false).finContrato).toContain('fecha de fin')
    expect(erroresDeSituacion({ ...base, tipoContrato: '01' }, HOY, OPCIONES, false).finContrato).toContain('indeterminado')
    expect(erroresDeSituacion(base, HOY, OPCIONES, false)).toEqual({})
  })

  it('el fin del contrato y el de la prueba van después del ingreso', () => {
    expect(erroresDeSituacion({ ...base, finContrato: HOY }, HOY, OPCIONES, false).finContrato).toContain('posterior')
    expect(erroresDeSituacion({ ...base, finPeriodoPrueba: '2026-09-01' }, HOY, OPCIONES, false).finPeriodoPrueba).toContain(
      'posterior',
    )
  })

  it('sin ver_sueldos el sueldo ni se valida ni viaja', () => {
    const conSueldo = { ...base, sueldoBase: '-5' }
    expect(erroresDeSituacion(conSueldo, HOY, OPCIONES, false).sueldoBase).toBeUndefined()
    expect(erroresDeSituacion(conSueldo, HOY, OPCIONES, true).sueldoBase).toContain('negativo')
    expect(situacionParaLaApi({ ...base, sueldoBase: '4500' }, false)).not.toHaveProperty('sueldoBase')
    expect(situacionParaLaApi({ ...base, sueldoBase: '4500' }, true)).toMatchObject({ sueldoBase: 4500, moneda: 'PEN' })
  })
})
