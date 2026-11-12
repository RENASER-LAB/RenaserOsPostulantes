/**
 * La máscara del celular, sin pantalla: qué queda en el campo y dónde queda el
 * cursor tras cada tecla, borrado y pegado (spec «Celular con formato 999 999 999»).
 */

import { describe, expect, it } from 'vitest'
import { comoE164 } from '@/dominio/celular'
import { agrupar, desdeAntiguo, enmascarar, leerEntero, type Cambio } from './mascaraCelular'

/** Una tecla al final de lo que había, como la escribe el navegador. */
function tecla(anterior: string, caracter: string, tipo: string | undefined = 'insertText'): Cambio {
  const escrito = anterior + caracter
  return { anterior, escrito, cursor: escrito.length, tipo }
}

/** Escribe tecla a tecla, como una persona, y devuelve lo que queda en el campo. */
function teclear(texto: string, desde = ''): string {
  let valor = desde
  for (const caracter of texto) {
    const resultado = enmascarar(tecla(valor, caracter))
    if (resultado.acepta) valor = resultado.valor
  }
  return valor
}

describe('número peruano, tecla a tecla', () => {
  it('AC-01 · «987654321» queda «987 654 321», y una décima cifra no entra', () => {
    expect(teclear('987654321')).toBe('987 654 321')
    expect(enmascarar(tecla('987 654 321', '0'))).toEqual({ acepta: false, cursor: 11, aviso: false })
  })

  it('el espacio aparece al llegar la cuarta y la séptima cifra, nunca al final', () => {
    expect(teclear('987')).toBe('987')
    expect(teclear('9876')).toBe('987 6')
    expect(teclear('987654')).toBe('987 654')
    expect(teclear('9876547')).toBe('987 654 7')
  })

  it.each(['a', '-', '.', '(', ')', ' ', 'é'])('AC-02 · «%s» no se escribe y el valor no cambia', (caracter) => {
    expect(enmascarar(tecla('987 6', caracter))).toEqual({ acepta: true, valor: '987 6', cursor: 5 })
  })

  it('un «+» que no va delante no se escribe', () => {
    expect(enmascarar(tecla('987', '+'))).toEqual({ acepta: false, cursor: 3, aviso: false })
  })

  it('sin `inputType`, una cifra más se trata como tecla', () => {
    expect(enmascarar(tecla('987 654 32', '1', undefined))).toMatchObject({ valor: '987 654 321' })
    expect(enmascarar(tecla('987 654 321', '1', undefined))).toMatchObject({ acepta: false, aviso: false })
  })

  it('una cifra metida en medio deja el cursor detrás de ella, no al final', () => {
    // «987 6|54 32» y se escribe un 0.
    const resultado = enmascarar({ anterior: '987 654 32', escrito: '987 6054 32', cursor: 6, tipo: 'insertText' })
    expect(resultado).toEqual({ acepta: true, valor: '987 605 432', cursor: 6 })
  })

  it('una décima cifra metida en medio tampoco entra, y el cursor vuelve a su sitio', () => {
    const resultado = enmascarar({ anterior: '987 654 321', escrito: '9870 654 321', cursor: 4, tipo: 'insertText' })
    expect(resultado).toEqual({ acepta: false, cursor: 3, aviso: false })
  })

  it('escribir sobre una selección la sustituye', () => {
    // «987 [654] 321» seleccionado y se teclea un 1.
    const resultado = enmascarar({ anterior: '987 654 321', escrito: '987 1 321', cursor: 5, tipo: 'insertText' })
    expect(resultado).toEqual({ acepta: true, valor: '987 132 1', cursor: 5 })
  })
})

describe('borrar', () => {
  it('el retroceso justo detrás de un espacio se lleva la cifra de antes, y el cursor se queda ahí', () => {
    // «987 |654»: el navegador borra el espacio; la máscara borra el 7.
    const resultado = enmascarar({ anterior: '987 654', escrito: '987654', cursor: 3, tipo: 'deleteContentBackward' })
    expect(resultado).toEqual({ acepta: true, valor: '986 54', cursor: 2 })
  })

  it('suprimir justo delante de un espacio se lleva la cifra de después', () => {
    // «987| 654»: el navegador borra el espacio; la máscara borra el 6.
    const resultado = enmascarar({ anterior: '987 654', escrito: '987654', cursor: 3, tipo: 'deleteContentForward' })
    expect(resultado).toEqual({ acepta: true, valor: '987 54', cursor: 3 })
  })

  it('borrar una cifra en medio reagrupa sin mover el cursor de su sitio', () => {
    // «987 65|4 321» y retroceso: se va el 5.
    const resultado = enmascarar({ anterior: '987 654 321', escrito: '987 64 321', cursor: 5, tipo: 'deleteContentBackward' })
    expect(resultado).toEqual({ acepta: true, valor: '987 643 21', cursor: 5 })
  })

  it('el retroceso sobre un espacio al principio no rompe nada', () => {
    const resultado = enmascarar({ anterior: '987', escrito: '987', cursor: 0, tipo: 'deleteContentBackward' })
    expect(resultado).toEqual({ acepta: true, valor: '987', cursor: 0 })
  })

  it('vaciarlo deja el campo vacío', () => {
    expect(enmascarar({ anterior: '987 654 321', escrito: '', cursor: 0, tipo: 'deleteContentBackward' })).toEqual({
      acepta: true,
      valor: '',
      cursor: 0,
    })
  })

  it('sin `inputType`, lo que se acorta es un borrado', () => {
    expect(enmascarar({ anterior: '987 654', escrito: '987 65', cursor: 6 })).toEqual({
      acepta: true,
      valor: '987 65',
      cursor: 6,
    })
  })
})

describe('número de otro país', () => {
  it('AC-05 · con «+» delante acepta el número completo con los espacios que ponga la persona', () => {
    expect(teclear('+34 612 345 678')).toBe('+34 612 345 678')
    expect(comoE164(teclear('+34 612 345 678'))).toBe('+34612345678')
  })

  it('«00» se vuelve «+»', () => {
    expect(teclear('00')).toBe('+')
    expect(teclear('0034612345678')).toBe('+34612345678')
  })

  it('hasta 15 cifras; la decimosexta no entra', () => {
    const quince = teclear('+123456789012345')
    expect(quince).toBe('+123456789012345')
    expect(enmascarar(tecla(quince, '6'))).toMatchObject({ acepta: false, aviso: false })
  })

  it('las letras y un segundo «+» no se escriben', () => {
    expect(enmascarar(tecla('+34 6', 'a'))).toEqual({ acepta: true, valor: '+34 6', cursor: 5 })
    expect(enmascarar(tecla('+34 6', '+'))).toMatchObject({ acepta: false })
  })

  it('un «+» tecleado delante de un número peruano lo pasa a otro país', () => {
    const resultado = enmascarar({ anterior: '987 654', escrito: '+987 654', cursor: 1, tipo: 'insertText' })
    expect(resultado).toEqual({ acepta: true, valor: '+987 654', cursor: 1 })
  })

  it('al borrar el «+» vuelve el peruano, con sus cifras de tres en tres y sin cortar ninguna', () => {
    expect(enmascarar({ anterior: '+987', escrito: '987', cursor: 0, tipo: 'deleteContentBackward' })).toEqual({
      acepta: true,
      valor: '987',
      cursor: 0,
    })
    expect(enmascarar({ anterior: '+34612345678', escrito: '34612345678', cursor: 0, tipo: 'deleteContentBackward' }))
      .toMatchObject({ valor: '346 123 456 78' })
  })

  it('borrar en un número de otro país no toca sus espacios ni el cursor', () => {
    expect(enmascarar({ anterior: '+34 612', escrito: '+34 62', cursor: 5, tipo: 'deleteContentBackward' })).toEqual({
      acepta: true,
      valor: '+34 62',
      cursor: 5,
    })
  })
})

describe('pegar o autocompletar', () => {
  it.each(['987-654-321', '987654321', '(987) 654 321', '51987654321', '+51 987 654 321', '0051987654321'])(
    'AC-03 · «%s» queda «987 654 321»',
    (pegado) => {
      expect(enmascarar({ anterior: '', escrito: pegado, cursor: pegado.length, tipo: 'insertFromPaste' })).toEqual({
        acepta: true,
        valor: '987 654 321',
        cursor: 11,
      })
    },
  )

  it.each(['hola', '12345678901234567', '9876543210', '34612345678', '+1234567890123456', '987 654 321 ext 2', '+51+987'])(
    'AC-04 · «%s» no se puede leer: el campo no cambia y pide el mensaje',
    (pegado) => {
      expect(enmascarar({ anterior: '', escrito: pegado, cursor: pegado.length, tipo: 'insertFromPaste' })).toEqual({
        acepta: false,
        cursor: 0,
        aviso: true,
      })
    },
  )

  it('nunca corta en silencio: pegado detrás de un número a medias, si no cabe, no entra', () => {
    expect(enmascarar({ anterior: '987', escrito: '987654321', cursor: 9, tipo: 'insertFromPaste' })).toMatchObject({
      valor: '987 654 321',
    })
    expect(
      enmascarar({ anterior: '987 654', escrito: '987 654654321', cursor: 13, tipo: 'insertFromPaste' }),
    ).toEqual({ acepta: false, cursor: 7, aviso: true })
  })

  it('el número de otro país pegado conserva sus grupos con espacios', () => {
    expect(leerEntero('+1 (415) 555-2671')).toBe('+1 415 555 2671')
    expect(leerEntero('00 34 612.345.678')).toBe('+34 612 345 678')
    expect(leerEntero('0 0 34 612')).toBe('+34 612')
    expect(leerEntero('+34612345678')).toBe('+34612345678')
  })

  it('el autocompletado sin `inputType` se lee entero, como un pegado', () => {
    expect(enmascarar({ anterior: '', escrito: '+51 987 654 321', cursor: 15 })).toMatchObject({ valor: '987 654 321' })
    expect(enmascarar({ anterior: '', escrito: 'hola', cursor: 4 })).toMatchObject({ acepta: false, aviso: true })
    expect(enmascarar({ anterior: '', escrito: '987654321', cursor: 9, tipo: 'insertReplacementText' })).toMatchObject({
      valor: '987 654 321',
    })
  })

  it('una cifra a medias se pega tal cual; la regla la avisa al enviar', () => {
    expect(leerEntero('98765')).toBe('987 65')
    expect(leerEntero('   ')).toBe('')
  })

  it('un texto entero metido con `insertText` (un teclado o Playwright) también se lee entero', () => {
    expect(enmascarar({ anterior: '', escrito: '+51 987 654 321', cursor: 15, tipo: 'insertText' })).toMatchObject({
      valor: '987 654 321',
    })
  })
})

describe('un celular de antes de la regla', () => {
  it('al tocarlo se lee entero con la máscara', () => {
    expect(desdeAntiguo({ anterior: '01-4567890', escrito: '01-456789', cursor: 9, tipo: 'deleteContentBackward' }))
      .toMatchObject({ acepta: true, valor: '014 567 89' })
    expect(desdeAntiguo({ anterior: '01-4567890', escrito: '9', cursor: 1, tipo: 'insertText' })).toMatchObject({
      valor: '9',
    })
  })

  it('si no se puede leer, no cambia y pide el mensaje; vaciarlo siempre se puede', () => {
    expect(desdeAntiguo({ anterior: 'Casa 4567890', escrito: 'Casa 456789', cursor: 11 })).toMatchObject({
      acepta: false,
      aviso: true,
    })
    expect(desdeAntiguo({ anterior: '01-4567890', escrito: '', cursor: 0 })).toEqual({ acepta: true, valor: '', cursor: 0 })
  })
})

it('agrupa de tres en tres', () => {
  expect(agrupar('')).toBe('')
  expect(agrupar('98')).toBe('98')
  expect(agrupar('987654321')).toBe('987 654 321')
})
