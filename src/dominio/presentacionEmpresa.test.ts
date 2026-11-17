import { describe, expect, it } from 'vitest'
import {
  MENSAJE_ENLACE,
  MENSAJE_VIDEO,
  direccionDelReproductor,
  direccionParaVerFuera,
  enlaceSeguro,
  errorDeLaRed,
  errorDelEnlace,
  errorDelVideo,
  leerVideo,
  normalizarEnlace,
} from './presentacionEmpresa'

/*
 * Los mismos casos que `EnlacesDeLaEmpresaTest` y `VideoDePresentacionTest` del
 * backend: un caso nuevo allí va también aquí.
 */

describe('normalizarEnlace', () => {
  it('pone https:// delante si no lleva esquema (AC-02: «renaser.pe»)', () => {
    expect(normalizarEnlace('renaser.pe')).toBe('https://renaser.pe')
    expect(normalizarEnlace('  www.renaser.pe/empleos  ')).toBe('https://www.renaser.pe/empleos')
    expect(normalizarEnlace('renaser.pe:8080/x')).toBe('https://renaser.pe:8080/x')
  })

  it('vacío es vacío y otro esquema se deja como está', () => {
    expect(normalizarEnlace('   ')).toBe('')
    expect(normalizarEnlace(null)).toBe('')
    expect(normalizarEnlace('javascript:alert(1)')).toBe('javascript:alert(1)')
  })
})

describe('la página web', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,hola',
    'ftp://renaser.pe',
    'https://localhost',
    'https://usuario:clave@renaser.pe',
    'https://renaser .pe',
    'mailto:hola@renaser.pe',
    'https://.pe',
  ])('%s no vale (AC-03)', (crudo) => {
    expect(errorDelEnlace(normalizarEnlace(crudo))).toBe(MENSAJE_ENLACE)
  })

  it('más de 500 caracteres no vale', () => {
    const largo = `https://renaser.pe/${'a'.repeat(482)}`
    expect(largo).toHaveLength(501)
    expect(errorDelEnlace(largo)).toBe(MENSAJE_ENLACE)
    expect(errorDelEnlace(largo.slice(0, 500))).toBeNull()
  })

  it('http y https con dominio valen; vacío también', () => {
    expect(errorDelEnlace('https://renaser.pe')).toBeNull()
    expect(errorDelEnlace('http://www.renaser.pe/a?b=1#c')).toBeNull()
    expect(errorDelEnlace('')).toBeNull()
  })
})

describe('las redes', () => {
  it('un Facebook en «Instagram» dice que no es de Instagram (AC-05)', () => {
    expect(errorDeLaRed('INSTAGRAM', 'https://www.facebook.com/renaser')).toBe(
      'Este enlace no es de Instagram',
    )
  })

  it('cada red con su dominio, con www. o m. delante', () => {
    expect(errorDeLaRed('INSTAGRAM', 'https://www.instagram.com/renaser')).toBeNull()
    expect(errorDeLaRed('FACEBOOK', 'https://m.facebook.com/x')).toBeNull()
    expect(errorDeLaRed('FACEBOOK', 'https://fb.com/x')).toBeNull()
    expect(errorDeLaRed('LINKEDIN', 'https://www.linkedin.com/company/renaser')).toBeNull()
    expect(errorDeLaRed('TIKTOK', 'https://www.tiktok.com/@renaser')).toBeNull()
    expect(errorDeLaRed('YOUTUBE', 'https://youtu.be/abc123DEF45')).toBeNull()
  })

  it('un dominio que solo se parece no cuela', () => {
    expect(errorDeLaRed('INSTAGRAM', 'https://noinstagram.com/x')).toBe('Este enlace no es de Instagram')
    expect(errorDeLaRed('TIKTOK', 'javascript:alert(1)')).toBe(MENSAJE_ENLACE)
  })
})

describe('los videos', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc123DEF45',
    'https://youtube.com/watch?v=abc123DEF45&t=30s',
    'https://m.youtube.com/watch?feature=share&v=abc123DEF45',
    'https://youtu.be/abc123DEF45?si=xyz',
    'https://www.youtube.com/shorts/abc123DEF45',
    'https://youtube.com/embed/abc123DEF45/',
    'http://www.youtu.be/abc123DEF45',
  ])('%s es de YouTube', (enlace) => {
    expect(leerVideo(enlace)).toEqual({ servicio: 'YOUTUBE', identificador: 'abc123DEF45', clave: null })
  })

  it('Vimeo con su número, y el oculto con su clave (AC-11)', () => {
    expect(leerVideo('https://vimeo.com/123456789')).toEqual({
      servicio: 'VIMEO',
      identificador: '123456789',
      clave: null,
    })
    expect(leerVideo('https://www.vimeo.com/123456789/abcdef1234?share=copy')).toEqual({
      servicio: 'VIMEO',
      identificador: '123456789',
      clave: 'abcdef1234',
    })
  })

  it.each([
    'https://www.facebook.com/renaser/videos/123',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=',
    'https://www.youtube.com/watch?v=abc%22onload',
    'https://www.youtube.com/@renaser',
    'https://www.youtube.com/playlist?list=PL123456',
    'https://youtu.be/',
    'https://youtu.be/abc/def',
    'https://vimeo.com/renaser',
    'https://vimeo.com/123/abc/def',
    'https://vimeo.com/123/ab-cd',
    'https://drive.google.com/file/d/abc/view',
    'javascript:alert(1)',
  ])('%s no es un video del que se pueda sacar cuál es', (enlace) => {
    expect(leerVideo(enlace)).toBeNull()
  })

  it('un video de Facebook dice lo del video (AC-04); lo que no es enlace, lo de la dirección', () => {
    expect(errorDelVideo('https://www.facebook.com/renaser/videos/123')).toBe(MENSAJE_VIDEO)
    expect(errorDelVideo('javascript:alert(1)')).toBe(MENSAJE_ENLACE)
    expect(errorDelVideo(normalizarEnlace('youtu.be/abc123DEF45'))).toBeNull()
  })
})

describe('al pintarlo', () => {
  it('el reproductor se reconstruye sin cookies de seguimiento (AC-10, AC-11)', () => {
    const youtube = { servicio: 'YOUTUBE' as const, identificador: 'abc123DEF45', enlace: 'x' }
    expect(direccionDelReproductor(youtube)).toBe(
      'https://www.youtube-nocookie.com/embed/abc123DEF45?autoplay=1&rel=0',
    )
    expect(direccionParaVerFuera(youtube)).toBe('https://www.youtube.com/watch?v=abc123DEF45')
    const vimeo = { servicio: 'VIMEO' as const, identificador: '123456789', clave: 'abcdef1234', enlace: 'x' }
    expect(direccionDelReproductor(vimeo)).toBe(
      'https://player.vimeo.com/video/123456789?autoplay=1&dnt=1&h=abcdef1234',
    )
    expect(direccionParaVerFuera(vimeo)).toBe('https://vimeo.com/123456789/abcdef1234')
  })

  it('unas piezas raras no llegan a ninguna dirección', () => {
    expect(
      direccionDelReproductor({ servicio: 'YOUTUBE', identificador: 'a"><script>', enlace: 'x' }),
    ).toBeNull()
    expect(direccionParaVerFuera({ servicio: 'VIMEO', identificador: '12a', enlace: 'x' })).toBeNull()
  })

  it('solo se pintan enlaces http o https', () => {
    expect(enlaceSeguro('https://renaser.pe')).toBe('https://renaser.pe/')
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull()
    expect(enlaceSeguro('data:text/html,hola')).toBeNull()
    expect(enlaceSeguro(null)).toBeNull()
  })
})
