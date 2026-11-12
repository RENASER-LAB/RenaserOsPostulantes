/**
 * Las reglas del alta que se avisan antes de enviar. Son las del backend
 * (`ReglasDelColaborador`); aquí solo se comprueba que el aviso llega.
 */

import { describe, expect, it } from 'vitest'
import type { Perfil, Precarga } from '../api/tiposPersonas'
import {
  celularAntiguo,
  erroresDePersona,
  erroresDeSituacion,
  limpiarDocumento,
  personaDesdePerfil,
  personaDesdePrecarga,
  personaParaLaApi,
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

describe('el celular (spec «Celular con formato 999 999 999»)', () => {
  const MENSAJE = 'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo'
  const valida = {
    ...personaVacia(),
    numeroDocumento: '45123456',
    nombres: 'Ana',
    apellidoPaterno: 'Rivas',
    fechaNacimiento: '1990-01-01',
    sexo: 'F',
  }
  const perfil = (celular: string | null) => ({ ...valida, celular, tipoDocumentoNombre: 'DNI' }) as unknown as Perfil
  const precarga = (celular: string | null) =>
    ({ postulacionId: 1, vacante: 'X', nombres: 'Ana', apellidoPaterno: 'Rivas', correoPersonal: null, celular }) as Precarga

  it('es opcional: vacío vale y viaja como null', () => {
    expect(erroresDePersona(valida, HOY).celular).toBeUndefined()
    expect(personaParaLaApi({ ...valida, celular: '  ' }).celular).toBeNull()
  })

  it('si viene, con la regla del portal y su mensaje', () => {
    expect(erroresDePersona({ ...valida, celular: '987 654 321' }, HOY).celular).toBeUndefined()
    expect(erroresDePersona({ ...valida, celular: '+34 612 345 678' }, HOY).celular).toBeUndefined()
    expect(erroresDePersona({ ...valida, celular: '987 65' }, HOY).celular).toBe(MENSAJE)
    expect(erroresDePersona({ ...valida, celular: '812 345 678' }, HOY).celular).toBe(MENSAJE)
  })

  it('uno de antes de la regla que no se tocó no se comprueba; tocado, sí', () => {
    expect(erroresDePersona({ ...valida, celular: '01-4567890' }, HOY, '01-4567890').celular).toBeUndefined()
    expect(erroresDePersona({ ...valida, celular: '014 567 89' }, HOY, '01-4567890').celular).toBe(MENSAJE)
    expect(personaParaLaApi({ ...valida, celular: '01-4567890' }).celular).toBe('01-4567890')
  })

  it('al editar, el de ahora sale con la forma del campo y el de antes tal cual', () => {
    expect(personaDesdePerfil(perfil('+51987654321')).celular).toBe('987 654 321')
    expect(personaDesdePerfil(perfil('+34612345678')).celular).toBe('+34612345678')
    expect(personaDesdePerfil(perfil('01-4567890')).celular).toBe('01-4567890')
    expect(personaDesdePerfil(perfil(null)).celular).toBe('')
    expect(celularAntiguo('+51987654321')).toBeNull()
    expect(celularAntiguo('987654321')).toBe('987654321')
    expect(celularAntiguo('01-4567890')).toBe('01-4567890')
    expect(celularAntiguo(null)).toBeNull()
  })

  it('AC-11 · el alta de un contratado sale con el de su cuenta, con la forma del campo; uno que no vale, vacío', () => {
    expect(personaDesdePrecarga(precarga('+51987654321')).celular).toBe('987 654 321')
    expect(personaDesdePrecarga(precarga('01-4567890')).celular).toBe('')
    expect(personaDesdePrecarga(precarga(null)).celular).toBe('')
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
