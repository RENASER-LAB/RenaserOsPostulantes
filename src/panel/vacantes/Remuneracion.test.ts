/**
 * La traduccion entre el formulario del panel y lo que el backend espera.
 *
 * Se valida aqui, en el navegador, y no solo en el servidor: el boton de esta
 * pantalla dice que va a escribirle a cuarenta candidatos, y quien lo pulsa
 * merece saber ANTES si lo que escribio tiene sentido. Un 400 despues es un
 * susto sobre una accion que parece irreversible.
 */

import { describe, expect, it } from 'vitest'
import { REMUNERACION_VACIA, comoCuerpo, desdeLaVacante } from './Remuneracion'

const forma = (extra: Partial<typeof REMUNERACION_VACIA>) => ({
  ...REMUNERACION_VACIA,
  ...extra,
})

describe('del formulario al cuerpo', () => {
  it('oculta manda los tres campos vacíos, aunque queden cifras escritas', () => {
    // Quien apaga la remuneracion desde una pantalla que tenia las cifras
    // escritas no debe llevarse un error por unos numeros que ya no significan
    // nada — ni que esas cifras viajen a la base.
    const salida = comoCuerpo(forma({ tipo: 'OCULTA', min: '3000', max: '4000' }))

    expect(salida).toEqual({
      datos: { tipo: 'OCULTA', min: null, max: null, moneda: null },
    })
  })

  it('fija manda un solo monto y deja el máximo vacío', () => {
    const salida = comoCuerpo(forma({ tipo: 'FIJA', min: '3500', max: '9999' }))

    expect(salida).toEqual({
      datos: { tipo: 'FIJA', min: 3500, max: null, moneda: 'PEN' },
    })
  })

  it('rango manda los dos, con su moneda', () => {
    const salida = comoCuerpo(
      forma({ tipo: 'RANGO', min: '3000', max: '4200', moneda: 'USD' }),
    )

    expect(salida).toEqual({
      datos: { tipo: 'RANGO', min: 3000, max: 4200, moneda: 'USD' },
    })
  })

  it('acepta las tres grafías del separador de miles', () => {
    // «3,500», «3.500» y «3 500» son el mismo sueldo y las tres se escriben.
    // Antes `Number` leía las dos primeras como 3.5. Ver `dominio/dinero`.
    for (const escrito of ['3,500', '3.500', '3 500', '3500']) {
      expect(comoCuerpo(forma({ tipo: 'FIJA', min: escrito }))).toEqual({
        datos: { tipo: 'FIJA', min: 3500, max: null, moneda: 'PEN' },
      })
    }
  })

  it('no acepta céntimos: un sueldo mensual no los tiene', () => {
    // Y admitirlos es admitir la ambigüedad entera: con decimales no hay forma
    // de saber si «3,50» son tres soles y medio o un 3500 mal tecleado.
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '3 500,50' }))).toHaveProperty('error')
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '3500.50' }))).toHaveProperty('error')
  })
})

describe('lo que no se deja guardar', () => {
  it('una fija sin monto', () => {
    expect(comoCuerpo(forma({ tipo: 'FIJA' }))).toEqual({
      error: 'Escribe el monto que ofreces.',
    })
  })

  it('un rango sin máximo, y le ofrece la salida', () => {
    expect(comoCuerpo(forma({ tipo: 'RANGO', min: '3000' }))).toEqual({
      error: 'Escribe el máximo del rango, o cámbialo a monto fijo.',
    })
  })

  it('un rango al revés', () => {
    expect(comoCuerpo(forma({ tipo: 'RANGO', min: '4000', max: '3000' }))).toEqual({
      error: 'El máximo del rango no puede ser menor que el mínimo.',
    })
  })

  it('cero, negativo, texto, y lo que antes se colaba', () => {
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '0' }))).toHaveProperty('error')
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '-100' }))).toHaveProperty('error')
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: 'mucho' }))).toHaveProperty('error')
    // `Number('1e5')` valía 100 000 y `Number('0x1f')` valía 31, los dos
    // atravesando la validación entera.
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '1e5' }))).toHaveProperty('error')
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '0x1f' }))).toHaveProperty('error')
  })

  it('la cifra que es un dedo de más', () => {
    // 35 000 000 donde queria 3 500. Aceptarlo publica una vacante que promete
    // diez mil veces lo que paga.
    expect(comoCuerpo(forma({ tipo: 'FIJA', min: '35000000' }))).toEqual({
      error: 'Ese monto parece un error de tecleo: revísalo.',
    })
  })
})

describe('de lo guardado al formulario', () => {
  it('una vacante sin sueldo abre el formulario en oculta', () => {
    expect(desdeLaVacante(null)).toEqual(REMUNERACION_VACIA)
    expect(desdeLaVacante(undefined)).toEqual(REMUNERACION_VACIA)
    expect(
      desdeLaVacante({ tipo: 'OCULTA', min: null, max: null, moneda: null }),
    ).toEqual(REMUNERACION_VACIA)
  })

  it('una guardada vuelve con sus cifras como texto', () => {
    expect(
      desdeLaVacante({ tipo: 'RANGO', min: 3000, max: 4200, moneda: 'USD' }),
    ).toEqual({ tipo: 'RANGO', min: '3000', max: '4200', moneda: 'USD' })
  })

  it('el ida y vuelta no cambia nada', () => {
    // Abrir la pantalla y pulsar guardar sin tocar nada tiene que mandar
    // exactamente lo que habia: si no, el backend lo leeria como un cambio y
    // le escribiria a todos los candidatos por nada.
    const guardado = { tipo: 'RANGO' as const, min: 3000, max: 4200, moneda: 'PEN' }
    expect(comoCuerpo(desdeLaVacante(guardado))).toEqual({ datos: guardado })
  })
})
