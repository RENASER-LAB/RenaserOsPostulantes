/**
 * El tope de cada archivo del perfil, comprobado donde de verdad decide.
 *
 * ⚠️ **Lo que costó esta prueba:** la pantalla del diploma aceptaba cualquier
 * archivo de hasta 10 MB y ofrecía elegir JPG, PNG o WebP además de PDF, pero
 * el servidor manda toda imagen por `TiposDeArchivo.exigirImagen`, que corta en
 * 2 MB. La foto de un diploma hecha con un móvil —tres o cuatro megas, lo
 * normal— se subía entera, tardaba, y al final rebotaba diciendo que el máximo
 * eran dos. La pantalla prometía diez y el servidor contestaba dos.
 *
 * Se prueba la función suelta y no la pantalla a propósito: la regla es la
 * misma en los cuatro sitios que suben algo y aquí se lee de una vez.
 */

import { describe, expect, it } from 'vitest'
import {
  MAXIMO_DOCUMENTO,
  MAXIMO_IMAGEN,
  revisarCurriculum,
  revisarDiploma,
  revisarImagen,
} from './archivos'

/** Un archivo del tamaño que haga falta sin reservar los megas de verdad. */
function archivoDe(nombre: string, tipo: string, tamano: number): File {
  const archivo = new File(['x'], nombre, { type: tipo })
  Object.defineProperty(archivo, 'size', { value: tamano })
  return archivo
}

describe('el diploma de una certificación', () => {
  it('rechaza la foto de un diploma de 3 MB antes de subirla', () => {
    const foto = archivoDe('diploma.jpg', 'image/jpeg', 3 * 1024 * 1024)

    expect(revisarDiploma(foto)).toBe(
      'La foto del diploma no puede pesar más de 2 MB. Prueba a guardarla más pequeña.',
    )
  })

  it('deja pasar un PDF que pesa justo el tope', () => {
    // El servidor corta con `>`, así que el archivo de exactamente 10 MB entra.
    expect(revisarDiploma(archivoDe('diploma.pdf', 'application/pdf', MAXIMO_DOCUMENTO))).toBeNull()
    expect(revisarDiploma(archivoDe('diploma.pdf', 'application/pdf', MAXIMO_DOCUMENTO + 1))).toBe(
      'El archivo no puede pesar más de 10 MB.',
    )
  })

  it('deja pasar la foto de un diploma que pesa justo el tope de las imágenes', () => {
    expect(revisarDiploma(archivoDe('diploma.png', 'image/png', MAXIMO_IMAGEN))).toBeNull()
  })

  it('no acepta un Word ni un GIF, y dice cuál es el reparo de cada uno', () => {
    // El Word no es imagen: cae por la rama del PDF.
    expect(
      revisarDiploma(
        archivoDe(
          'diploma.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          1000,
        ),
      ),
    ).toBe('El diploma tiene que ser un PDF o una foto en JPG, PNG o WebP.')

    // El GIF sí es imagen —el servidor bifurca por `image/`— y por eso le
    // contesta con los formatos de imagen, no con los del PDF.
    expect(revisarDiploma(archivoDe('diploma.gif', 'image/gif', 1000))).toBe(
      'La foto del diploma tiene que ser JPG, PNG o WebP.',
    )
  })

  it('rechaza un .jfif, que el navegador declara image/jpeg y el servidor no acepta', () => {
    // ⚠️ El caso que se escapaba: `.jfif` es lo que pone Windows al guardar una
    // imagen de la web y es un JPEG de verdad, así que el `content-type` pasa.
    // El servidor exige que casen extensión Y tipo, y el diploma se manda crudo
    // —no se redibuja como la foto—, así que rebotaba con un 400 después de
    // subirlo entero.
    expect(revisarDiploma(archivoDe('diploma.jfif', 'image/jpeg', 1000))).toBe(
      '«diploma.jfif» no acaba en .jpg, .jpeg, .png ni .webp. Guárdala con una de esas y vuelve a intentarlo.',
    )
    // Y los cuatro que sí valen pasan, con el tipo que les toca.
    for (const [nombre, tipo] of [
      ['d.jpg', 'image/jpeg'],
      ['d.JPEG', 'image/jpeg'],
      ['d.png', 'image/png'],
      ['d.webp', 'image/webp'],
    ] as const) {
      expect(revisarDiploma(archivoDe(nombre, tipo, 1000))).toBeNull()
    }
  })
})

describe('la foto y la portada usan la misma regla, con su nombre delante', () => {
  it('NO miran la extensión: se redibujan en un lienzo y salen de aquí como .jpg', () => {
    // Lo contrario del diploma, y a propósito. Exigirle la extensión a la foto
    // rechazaría un `.jfif` que la pantalla iba a reempaquetar como `foto.jpg`
    // de todas formas.
    expect(revisarImagen(archivoDe('yo.jfif', 'image/jpeg', 1000), 'La foto')).toBeNull()
  })

  it('rechaza más de 2 MB', () => {
    const grande = archivoDe('yo.jpg', 'image/jpeg', MAXIMO_IMAGEN + 1)

    expect(revisarImagen(grande, 'La foto')).toBe(
      'La foto no puede pesar más de 2 MB. Prueba a guardarla más pequeña.',
    )
    expect(revisarImagen(grande, 'La portada')).toBe(
      'La portada no puede pesar más de 2 MB. Prueba a guardarla más pequeña.',
    )
  })

  it('acepta los tres formatos que acepta el servidor y ninguno más', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(revisarImagen(archivoDe('yo.x', tipo, 1000), 'La foto')).toBeNull()
    }
    expect(revisarImagen(archivoDe('yo.svg', 'image/svg+xml', 1000), 'La foto')).toBe(
      'La foto tiene que ser JPG, PNG o WebP.',
    )
  })
})

describe('el currículum', () => {
  it('se mira por extensión y llega a los 10 MB', () => {
    expect(revisarCurriculum(archivoDe('cv.pdf', 'application/pdf', MAXIMO_DOCUMENTO))).toBeNull()
    expect(revisarCurriculum(archivoDe('cv.pdf', 'application/pdf', MAXIMO_DOCUMENTO + 1))).toBe(
      'El archivo no puede pesar más de 10 MB.',
    )
    expect(revisarCurriculum(archivoDe('cv.png', 'image/png', 1000))).toBe(
      '«cv.png» no es un PDF ni un Word. Conviértelo a PDF y vuelve a intentarlo.',
    )
  })
})
