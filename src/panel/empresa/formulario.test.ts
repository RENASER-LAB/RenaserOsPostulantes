import { describe, expect, it } from 'vitest'
import {
  anadirBeneficio,
  comoCuerpo,
  desdeLoGuardado,
  erroresDelFormulario,
  hayCambios,
} from './formulario'

const VACIO = desdeLoGuardado(null)

describe('el formulario de «Perfil de la empresa»', () => {
  it('vacío no tiene errores y se manda como «sin dato»', () => {
    expect(erroresDelFormulario(VACIO, 2026)).toEqual({})
    expect(comoCuerpo(VACIO)).toEqual({
      sector: null,
      tamano: null,
      anioFundacion: null,
      quienesSomos: null,
      propositoEmpresa: null,
      beneficios: [],
      videoPresentacion: null,
      paginaWeb: null,
      redes: {},
      mision: null,
      vision: null,
    })
  })

  it('AC-02: la web «renaser.pe» se manda como https://renaser.pe, y los bordes se recortan', () => {
    const cuerpo = comoCuerpo({
      ...VACIO,
      propositoEmpresa: '  Que nadie se quede sin pan.  ',
      videoPresentacion: 'https://www.youtube.com/watch?v=abc123DEF45',
      paginaWeb: 'renaser.pe',
      redes: { ...VACIO.redes, INSTAGRAM: 'https://www.instagram.com/renaser' },
    })
    expect(cuerpo.paginaWeb).toBe('https://renaser.pe')
    expect(cuerpo.propositoEmpresa).toBe('Que nadie se quede sin pan.')
    expect(cuerpo.redes).toEqual({ INSTAGRAM: 'https://www.instagram.com/renaser' })
  })

  it('AC-03/04/05: varios errores a la vez, cada uno con la clave del backend', () => {
    const errores = erroresDelFormulario(
      {
        ...VACIO,
        paginaWeb: 'javascript:alert(1)',
        videoPresentacion: 'https://www.facebook.com/renaser/videos/123',
        redes: { ...VACIO.redes, INSTAGRAM: 'https://www.facebook.com/renaser' },
      },
      2026,
    )
    expect(errores).toEqual({
      paginaWeb: 'Escribe una dirección web que empiece por https://',
      videoPresentacion: 'Pega el enlace de un video de YouTube o de Vimeo',
      INSTAGRAM: 'Este enlace no es de Instagram',
    })
  })

  it('AC-06: un propósito de 1501 caracteres pegado igual dice su error', () => {
    expect(erroresDelFormulario({ ...VACIO, propositoEmpresa: 'a'.repeat(1500) }, 2026)).toEqual({})
    expect(erroresDelFormulario({ ...VACIO, propositoEmpresa: 'a'.repeat(1501) }, 2026)).toEqual({
      propositoEmpresa: 'El propósito admite hasta 1500 caracteres',
    })
  })

  it('el año, entre 1800 y el año actual', () => {
    expect(erroresDelFormulario({ ...VACIO, anioFundacion: '1987' }, 2026)).toEqual({})
    expect(erroresDelFormulario({ ...VACIO, anioFundacion: '2027' }, 2026).anioFundacion).toBe(
      'Escribe un año entre 1800 y 2026',
    )
    expect(erroresDelFormulario({ ...VACIO, anioFundacion: '1799' }, 2026).anioFundacion).toBeDefined()
  })

  it('los beneficios: sin repetidos, hasta 12 y de 40 caracteres como mucho', () => {
    let lista: string[] = []
    lista = anadirBeneficio(lista, ' Seguro EPS ')
    lista = anadirBeneficio(lista, 'seguro eps')
    lista = anadirBeneficio(lista, 'x'.repeat(50))
    expect(lista).toEqual(['Seguro EPS', 'x'.repeat(40)])
    const doce = Array.from({ length: 12 }, (_, i) => `B${i}`)
    expect(anadirBeneficio(doce, 'otro')).toBe(doce)
  })

  it('lo guardado vuelve al formulario y sin tocar nada no hay cambios', () => {
    const guardado = desdeLoGuardado({
      codigo: 'ACME',
      nombre: 'Acme',
      anioFundacion: 1987,
      redes: { FACEBOOK: 'https://facebook.com/acme' },
      beneficios: ['Comedor'],
    })
    expect(guardado.anioFundacion).toBe('1987')
    expect(guardado.redes.FACEBOOK).toBe('https://facebook.com/acme')
    expect(guardado.redes.TIKTOK).toBe('')
    expect(hayCambios(guardado, desdeLoGuardado({ codigo: 'ACME', nombre: 'Acme', anioFundacion: 1987, redes: { FACEBOOK: 'https://facebook.com/acme' }, beneficios: ['Comedor'] }))).toBe(false)
    expect(hayCambios({ ...guardado, sector: 'Construcción' }, guardado)).toBe(true)
  })

  it('V86: misión y visión hasta 400; con solo espacios se mandan vacías', () => {
    expect(erroresDelFormulario({ ...VACIO, mision: 'm'.repeat(400), vision: 'v'.repeat(400) }, 2026)).toEqual({})
    expect(erroresDelFormulario({ ...VACIO, mision: 'm'.repeat(401), vision: 'v'.repeat(401) }, 2026)).toEqual({
      mision: 'La misión admite hasta 400 caracteres',
      vision: 'La visión admite hasta 400 caracteres',
    })
    const cuerpo = comoCuerpo({ ...VACIO, mision: '  Moler bien.  ', vision: '   ' })
    expect(cuerpo.mision).toBe('Moler bien.')
    expect(cuerpo.vision).toBeNull()
  })

  it('V86: la plantilla y el color no son del formulario: «Guardar» no los manda y elegirlos no es un cambio sin guardar', () => {
    const guardado = desdeLoGuardado({
      codigo: 'ACME',
      nombre: 'Acme',
      mision: 'Moler bien.',
      plantillaBrochure: 'COLUMNAS',
      colorBrochure: 'PETROLEO',
    })
    expect(guardado.mision).toBe('Moler bien.')
    expect(guardado).not.toHaveProperty('plantillaBrochure')
    expect(guardado).not.toHaveProperty('colorBrochure')
    // Sin ellos en el cuerpo el backend deja los que había: un «Guardar» no pisa la pestaña «Brochure».
    expect(comoCuerpo(guardado)).not.toHaveProperty('plantillaBrochure')
    expect(comoCuerpo(guardado)).not.toHaveProperty('colorBrochure')
    // La pestaña «Brochure» guardó otra elección: el formulario del perfil sigue sin cambios.
    const tras = desdeLoGuardado({
      codigo: 'ACME',
      nombre: 'Acme',
      mision: 'Moler bien.',
      plantillaBrochure: 'CLASICA',
      colorBrochure: 'VERDE',
    })
    expect(hayCambios(tras, guardado)).toBe(false)
  })
})
