import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi } from '@/api/puerta'
import { abrirBrochure, direccionDelBrochure, eleccionDe, mismaEleccion } from './brochure'

const descargarBrochure = vi.fn()

vi.mock('../api/presentacion', () => ({
  descargarBrochure: () => descargarBrochure(),
}))

const PDF = { contenido: new Blob(['%PDF'], { type: 'application/pdf' }), nombre: 'Brochure - Acme S.A.C..pdf' }

/** Una pestaña de mentira: `window.open` la devuelve y el PDF se carga en ella. */
function pestana() {
  const ventana = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(ventana as unknown as Window)
  return ventana
}

/** Las descargas que se lanzan con un `<a download>`, con el nombre que llevan. */
function vigilarDescargas() {
  const descargas: Array<{ href: string; nombre: string }> = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    descargas.push({ href: this.href, nombre: this.download })
  })
  return descargas
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:brochure')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  descargarBrochure.mockReset()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('la dirección del brochure', () => {
  it('es la pública de la empresa, en minúsculas y escapada, como la del perfil', () => {
    expect(direccionDelBrochure('ACME')).toBe('/api/v1/portal/empresas/acme/brochure')
    expect(direccionDelBrochure('  Ñandú SAC ')).toBe('/api/v1/portal/empresas/%C3%B1and%C3%BA%20sac/brochure')
    expect(direccionDelBrochure('a/b?c#d')).toBe('/api/v1/portal/empresas/a%2Fb%3Fc%23d/brochure')
  })

  it('sin código no hay dirección', () => {
    expect(direccionDelBrochure('')).toBeNull()
    expect(direccionDelBrochure('   ')).toBeNull()
    expect(direccionDelBrochure(null)).toBeNull()
    expect(direccionDelBrochure(undefined)).toBeNull()
  })

  it('en la aplicación instalada lleva delante el origen, como las imágenes del perfil', async () => {
    // El origen se lee al cargar el módulo: hay que sembrarlo y volver a importar.
    vi.stubEnv('VITE_ORIGEN_API', 'https://renaser-os-postulantes.vercel.app')
    vi.resetModules()
    const { direccionDelBrochure: conOrigen } = await import('./brochure')
    expect(conOrigen('ACME')).toBe('https://renaser-os-postulantes.vercel.app/api/v1/portal/empresas/acme/brochure')
  })
})

describe('abrir el brochure desde el panel', () => {
  it('QA-BROCH-01/02: primero lo arma el panel y luego la pestaña va a la dirección del PDF, sin `blob:` que caduque', async () => {
    const ventana = pestana()
    let terminar: (archivo: typeof PDF) => void = () => {}
    descargarBrochure.mockReturnValue(new Promise((resuelve) => (terminar = resuelve)))

    const abriendo = abrirBrochure('Acme S.A.C.', 'ACME')
    // La pestaña se pide dentro del clic, antes de esperar al backend, y sin opener.
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(ventana.opener).toBeNull()
    expect(ventana.location.href).toBe('')
    expect(descargarBrochure).toHaveBeenCalledTimes(1)

    terminar(PDF)
    await abriendo
    expect(ventana.location.href).toBe('/api/v1/portal/empresas/acme/brochure')
    expect(ventana.close).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('pasado un minuto nada suelta la dirección de la pestaña', async () => {
    vi.useFakeTimers()
    const ventana = pestana()
    descargarBrochure.mockResolvedValue(PDF)

    await abrirBrochure('Acme S.A.C.', 'ACME')
    vi.advanceTimersByTime(120_000)

    expect(ventana.location.href).toBe('/api/v1/portal/empresas/acme/brochure')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('si el panel no lo puede dar (403, 409 o fallo) la pestaña se cierra sin ir a ninguna parte y el error llega a quien llama', async () => {
    for (const fallo of [new ErrorApi(403, 'Permiso denegado'), new ErrorApi(409, 'Falta'), new ErrorApi(500, 'Error')]) {
      const ventana = pestana()
      descargarBrochure.mockRejectedValueOnce(fallo)

      await expect(abrirBrochure('Acme S.A.C.', 'ACME')).rejects.toBe(fallo)
      expect(ventana.close).toHaveBeenCalled()
      expect(ventana.location.href).toBe('')
      vi.restoreAllMocks()
    }
  })

  it('con una elección guardándose, abre la pestaña al momento y pide el PDF cuando termina; si falla, con la anterior', async () => {
    for (const termina of ['bien', 'mal'] as const) {
      const ventana = pestana()
      descargarBrochure.mockResolvedValue(PDF)
      let terminar: () => void = () => {}
      let fallar: (causa: unknown) => void = () => {}
      const guardando = new Promise<void>((si, no) => {
        terminar = si
        fallar = no
      })

      const abriendo = abrirBrochure('Acme S.A.C.', 'ACME', guardando)
      expect(window.open).toHaveBeenCalledWith('', '_blank')
      await Promise.resolve()
      expect(descargarBrochure).not.toHaveBeenCalled()

      if (termina === 'bien') terminar()
      else fallar(new ErrorApi(500, 'Error'))
      await abriendo
      expect(descargarBrochure).toHaveBeenCalledTimes(1)
      expect(ventana.location.href).toBe('/api/v1/portal/empresas/acme/brochure')
      descargarBrochure.mockReset()
      vi.restoreAllMocks()
    }
  })

  it('con la pestaña bloqueada se guarda con su nombre, «Brochure - {empresa}.pdf»', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'open').mockReturnValue(null)
    const descargas = vigilarDescargas()
    descargarBrochure.mockResolvedValue(PDF)

    await abrirBrochure('Acme S.A.C.', 'ACME')

    expect(descargas).toEqual([{ href: 'blob:brochure', nombre: 'Brochure - Acme S.A.C..pdf' }])
    const archivo = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as File
    expect(archivo.name).toBe('Brochure - Acme S.A.C..pdf')
    expect(archivo.type).toBe('application/pdf')
    // La dirección de la descarga se suelta después, no antes de que empiece.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:brochure')
  })

  it('sin código con el que formar la dirección, cierra la pestaña vacía y lo guarda con su nombre', async () => {
    const ventana = pestana()
    const descargas = vigilarDescargas()
    descargarBrochure.mockResolvedValue({ ...PDF, nombre: null })

    await abrirBrochure('Acme S.A.C.', '')

    expect(ventana.close).toHaveBeenCalled()
    expect(ventana.location.href).toBe('')
    expect(descargas).toEqual([{ href: 'blob:brochure', nombre: 'Brochure - Acme S.A.C..pdf' }])
  })
})

describe('la elección del brochure', () => {
  it('es la guardada, o «Clásica» y «Azul» si no hay o no se reconoce (un backend anterior)', () => {
    expect(eleccionDe({ plantillaBrochure: 'COLUMNAS', colorBrochure: 'PETROLEO' })).toEqual({
      plantilla: 'COLUMNAS',
      color: 'PETROLEO',
    })
    expect(eleccionDe({ plantillaBrochure: 'MOSAICO', colorBrochure: null })).toEqual({ plantilla: 'CLASICA', color: 'AZUL' })
    expect(eleccionDe(undefined)).toEqual({ plantilla: 'CLASICA', color: 'AZUL' })
  })

  it('dos elecciones son la misma si coinciden la plantilla y el color', () => {
    expect(mismaEleccion({ plantilla: 'PORTADA', color: 'VERDE' }, { plantilla: 'PORTADA', color: 'VERDE' })).toBe(true)
    expect(mismaEleccion({ plantilla: 'PORTADA', color: 'VERDE' }, { plantilla: 'PORTADA', color: 'ROJO' })).toBe(false)
    expect(mismaEleccion({ plantilla: 'PORTADA', color: 'VERDE' }, { plantilla: 'CLASICA', color: 'VERDE' })).toBe(false)
  })
})
