/**
 * Lo que se guarda cuando el campo de aptitudes se queda a medias.
 *
 * El resto de `Aptitudes` —los chips, el aviso al lector de pantalla, el
 * retroceso que borra la última— se prueba a través de la pantalla en
 * `Perfil.test.tsx`. Aquí solo vive `leerTodas`, que es pura y es la que decide
 * qué pasa con lo escrito sin confirmar: el momento en que de verdad se pierden
 * aptitudes.
 */

import { describe, expect, it } from 'vitest'
import { leerTodas } from './Aptitudes'

describe('leerTodas · lo escrito sin pulsar Enter', () => {
  it('no inventa nada si el campo está vacío', () => {
    expect(leerTodas(['Excel'], '')).toEqual(['Excel'])
    expect(leerTodas(['Excel'], '   ')).toEqual(['Excel'])
  })

  it('recoge la aptitud que quedó escrita', () => {
    expect(leerTodas(['Excel'], 'Power BI')).toEqual(['Excel', 'Power BI'])
  })

  it('parte la lista pegada por comas, igual que al pulsar Enter', () => {
    // Sin esto se guardaba UNA aptitud llamada «Power BI, SQL, Lean», que no la
    // encuentra ninguna búsqueda. Es el caso que más se da: pegar la lista de un
    // currículum de una sola línea y darle a Guardar.
    expect(leerTodas(['Excel'], 'Power BI, SQL, Lean')).toEqual([
      'Excel',
      'Power BI',
      'SQL',
      'Lean',
    ])
  })

  it('no repite lo que ya estaba, sin mirar mayúsculas ni acentos', () => {
    expect(leerTodas(['Excel', 'Inglés'], 'excel, ingles, SQL')).toEqual([
      'Excel',
      'Inglés',
      'SQL',
    ])
  })

  it('las comas de más no crean aptitudes vacías', () => {
    expect(leerTodas([], 'Excel, , SQL,')).toEqual(['Excel', 'SQL'])
  })
})
