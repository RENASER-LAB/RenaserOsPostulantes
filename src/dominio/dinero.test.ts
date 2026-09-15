/**
 * Leer una cifra de dinero escrita a mano.
 *
 * Esto nació de un bug de verdad, no de un supuesto: los dos formularios del
 * sueldo hacían `Number(texto.replace(/\s/g,'').replace(',','.'))`, y eso
 * convierte **«3,500» en 3.5**. Pasaba las tres validaciones que había —mayor
 * que cero, menor que un millón, número finito— y quedaba registrado como un
 * sueldo de tres soles con cincuenta. En el panel, además, disparaba los correos
 * que se lo contaban a todos los candidatos.
 *
 * Los casos de abajo son exactamente los que atravesaban el error que decía
 * «solo números».
 */

import { describe, expect, it } from 'vitest'
import { aCifra } from './dinero'

describe('lo que se lee bien', () => {
  it('la cifra a secas', () => {
    expect(aCifra('3500')).toBe(3500)
    expect(aCifra('1200')).toBe(1200)
    expect(aCifra('1000000')).toBe(1000000)
  })

  it('con separador de miles, coma o punto, y con espacios', () => {
    // Las tres grafías del mismo sueldo. En el Perú se escriben las tres.
    expect(aCifra('3,500')).toBe(3500)
    expect(aCifra('3.500')).toBe(3500)
    expect(aCifra('3 500')).toBe(3500)
    expect(aCifra('1,234,567')).toBe(1234567)
    expect(aCifra('1.234.567')).toBe(1234567)
  })

  it('el espacio duro que llega al pegar desde una hoja de cálculo', () => {
    expect(aCifra('3 500')).toBe(3500)
  })
})

describe('lo que NO se lee, y antes sí pasaba', () => {
  it('«3,500» ya no vale 3.5', () => {
    // El bug entero, en una línea.
    expect(Number('3,500'.replace(/\s/g, '').replace(',', '.'))).toBe(3.5)
    expect(aCifra('3,500')).toBe(3500)
  })

  it('la notación científica y la hexadecimal', () => {
    // `Number('1e5')` valía 100 000 y `Number('0x1f')` valía 31, los dos
    // atravesando un mensaje de error que decía «solo números».
    expect(aCifra('1e5')).toBeNull()
    expect(aCifra('0x1f')).toBeNull()
  })

  it('los céntimos: un sueldo mensual no los tiene', () => {
    // Y admitirlos es admitir la ambigüedad entera: con decimales sobre la mesa
    // no hay forma de saber si «3,50» son tres soles y medio o un 3500 mal
    // tecleado.
    expect(aCifra('3.50')).toBeNull()
    expect(aCifra('3,50')).toBeNull()
    expect(aCifra('3500.50')).toBeNull()
    expect(aCifra('.5')).toBeNull()
  })

  it('los grupos que no son de tres', () => {
    expect(aCifra('3,5')).toBeNull()
    expect(aCifra('12,34')).toBeNull()
    // Dos convenciones a la vez es un error de quien lo escribió, no un número.
    expect(aCifra('1,234.567')).toBeNull()
  })

  it('el signo, el vacío y la letra suelta', () => {
    expect(aCifra('+3500')).toBeNull()
    expect(aCifra('-3500')).toBeNull()
    expect(aCifra('')).toBeNull()
    expect(aCifra('   ')).toBeNull()
    expect(aCifra('mucho')).toBeNull()
    expect(aCifra('3500 soles')).toBeNull()
  })

  it('la cifra que deja de ser exacta en punto flotante', () => {
    // Un sueldo que pierde precisión al leerse es peor que uno rechazado.
    expect(aCifra('99999999999999999999')).toBeNull()
  })
})
