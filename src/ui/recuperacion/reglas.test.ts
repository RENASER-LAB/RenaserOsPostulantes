/**
 * Las reglas de «me olvidé mi contraseña», sin pantalla delante.
 *
 * Son la mitad del contrato con el backend: el mínimo (8 en el portal, 12 en el
 * panel) y los espacios de los bordes los rechaza también el servidor, y si la
 * pantalla dejara pasar algo que él rebota, el envío fallaría con un error que
 * se pudo evitar.
 */

import { describe, expect, it } from 'vitest'
import {
  CLAVE_DEMASIADO_LARGA,
  EsquemaCorreo,
  MENSAJE_ENVIADO,
  bytesDe,
  esquemaClaveNueva,
} from './reglas'

function erroresDe(minimo: number, contrasena: string, repetir: string) {
  const revision = esquemaClaveNueva(minimo).safeParse({ contrasena, repetir })
  if (revision.success) return {}
  const errores: Record<string, string> = {}
  for (const problema of revision.error.issues) {
    const campo = String(problema.path[0])
    errores[campo] ??= problema.message
  }
  return errores
}

describe('el mensaje de enviado', () => {
  it('es exactamente el de la spec, el mismo exista o no la cuenta', () => {
    expect(MENSAJE_ENVIADO).toBe(
      'Si ese correo tiene una cuenta, te enviamos un enlace. Revisa también tu carpeta de spam. Vale por 60 minutos.',
    )
  })
})

describe('el correo', () => {
  it('vacío o sin forma de correo no pasa', () => {
    expect(EsquemaCorreo.safeParse({ correo: '' }).success).toBe(false)
    expect(EsquemaCorreo.safeParse({ correo: 'ana' }).success).toBe(false)
    expect(EsquemaCorreo.safeParse({ correo: 'ana@' }).success).toBe(false)
  })

  it('se manda sin los espacios que se colaron al escribirlo', () => {
    const revision = EsquemaCorreo.safeParse({ correo: '  ana@correo.pe ' })
    expect(revision.success && revision.data.correo).toBe('ana@correo.pe')
  })
})

describe('la contraseña nueva', () => {
  it('AC-11 · en el portal pide 8; en el panel, 12', () => {
    expect(erroresDe(8, 'corta12', 'corta12').contrasena).toBe(
      'La contraseña necesita al menos 8 caracteres.',
    )
    expect(erroresDe(8, 'ocho1234', 'ocho1234')).toEqual({})
    expect(erroresDe(12, 'once1234567', 'once1234567').contrasena).toBe(
      'La contraseña necesita al menos 12 caracteres.',
    )
    expect(erroresDe(12, 'doce12345678', 'doce12345678')).toEqual({})
  })

  it('AC-12 · si no coinciden, el error va en la repetición y no en la primera', () => {
    const errores = erroresDe(8, 'una-clave-larga', 'otra-clave-larga')
    expect(errores.repetir).toBe('Las dos contraseñas no coinciden.')
    expect(errores.contrasena).toBeUndefined()
  })

  it('un espacio al principio o al final se avisa en vez de recortarse', () => {
    const aviso =
      'La contraseña no puede empezar ni terminar con un espacio. Revisa si se pegó uno de más.'
    expect(erroresDe(8, ' una-clave-larga', ' una-clave-larga').contrasena).toBe(aviso)
    expect(erroresDe(8, 'una-clave-larga ', 'una-clave-larga ').contrasena).toBe(aviso)
    // Uno en medio no es un espacio sobrante: es parte de la contraseña
    expect(erroresDe(8, 'una clave larga', 'una clave larga')).toEqual({})
  })

  it('F-01 · más de 72 bytes se para en el campo, contados en bytes y no en letras', () => {
    // 72 justos pasan, en las dos puertas
    expect(erroresDe(8, 'x'.repeat(72), 'x'.repeat(72))).toEqual({})
    expect(erroresDe(12, 'ñ'.repeat(36), 'ñ'.repeat(36))).toEqual({})
    // Uno más, no
    expect(erroresDe(8, 'x'.repeat(73), 'x'.repeat(73)).contrasena).toBe(CLAVE_DEMASIADO_LARGA)
    // 40 «ñ»: 40 letras, 80 bytes. Pasa el mínimo y no cabe
    expect(bytesDe('ñ'.repeat(40))).toBe(80)
    expect(erroresDe(8, 'ñ'.repeat(40), 'ñ'.repeat(40)).contrasena).toBe(CLAVE_DEMASIADO_LARGA)
    expect(erroresDe(12, 'ñ'.repeat(40), 'ñ'.repeat(40)).contrasena).toBe(CLAVE_DEMASIADO_LARGA)
    // 19 emojis: 38 posiciones de JavaScript y 76 bytes
    expect(erroresDe(8, '🔑'.repeat(19), '🔑'.repeat(19)).contrasena).toBe(CLAVE_DEMASIADO_LARGA)
  })

  it('F-01 · el motivo se dice en español y no habla de bytes', () => {
    expect(CLAVE_DEMASIADO_LARGA).toBe(
      'La contraseña es demasiado larga. Usa como máximo 72 caracteres; las letras con tilde, la ñ y los emojis cuentan por más de uno.',
    )
    expect(CLAVE_DEMASIADO_LARGA).not.toMatch(/bytes|password/i)
  })

  it('un solo motivo por campo: vacío antes que espacios, espacios antes que largo', () => {
    expect(erroresDe(8, '', '').contrasena).toBe('Escribe tu contraseña nueva.')
    expect(erroresDe(8, '', '').repetir).toBe('Repite la contraseña.')
    expect(erroresDe(8, ' ab', ' ab').contrasena).toMatch(/espacio/)
    // Demasiado larga y con espacio al borde: se dice el espacio
    expect(erroresDe(8, ` ${'x'.repeat(80)}`, ` ${'x'.repeat(80)}`).contrasena).toMatch(/espacio/)
  })
})
