import { describe, expect, it } from 'vitest'
import type { VacantePublica } from '@/api/tipos'
import { presentacionDeLaVacante } from './presentacionDeLaVacante'

const YOUTUBE = { servicio: 'YOUTUBE' as const, identificador: 'abc123DEF45', enlace: 'https://youtu.be/abc123DEF45' }
const VIMEO = { servicio: 'VIMEO' as const, identificador: '123456789', clave: 'abcdef1234', enlace: 'https://vimeo.com/123456789/abcdef1234' }

function vacante(cambios: Partial<VacantePublica> = {}): VacantePublica {
  return {
    id: 1,
    titulo: 'Supervisor de producción',
    nombreEmpresa: 'Molinos del Sur',
    descripcion: 'Descripción',
    proposito: 'Reducir los tiempos de despacho',
    responsabilidades: null,
    requisitos: null,
    modalidad: null,
    horario: null,
    ubicacion: null,
    ciudad: null,
    publicadaEn: null,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    requisitosObjetivos: [],
    codigoEmpresa: 'MOLINOS-DEL-SUR',
    ...cambios,
  }
}

describe('lo que la vacante enseña de su empresa', () => {
  it('AC-12: sin ningún dato no hay bloque «Sobre…» ni video', () => {
    for (const enPc of [true, false]) {
      const p = presentacionDeLaVacante(vacante({ empresa: null }), enPc)
      expect(p.sobre).toBeNull()
      expect(p.enLaTarjeta).toBeNull()
      expect(p.arriba).toBeNull()
    }
    // Un backend anterior, sin el campo: igual que hoy.
    expect(presentacionDeLaVacante(vacante({ empresa: undefined }), true).sobre).toBeNull()
  })

  it('AC-13: solo la página web sale sola, sin propósito ni video', () => {
    const p = presentacionDeLaVacante(vacante({ empresa: { paginaWeb: 'https://renaser.pe' } }), false)
    expect(p.sobre).toEqual({
      proposito: null,
      video: null,
      enlaces: [{ clave: 'WEB', nombre: 'Página web', href: 'https://renaser.pe/' }],
    })
  })

  it('AC-23: en PC, sin video del puesto, el de la empresa va en la tarjeta y no se repite abajo', () => {
    const p = presentacionDeLaVacante(vacante({ empresa: { proposito: 'Pan para todos', video: YOUTUBE } }), true)
    expect(p.enLaTarjeta).toEqual({ video: YOUTUBE, titulo: 'Conoce a Molinos del Sur' })
    expect(p.sobre?.video).toBeNull()
    expect(p.sobre?.proposito).toBe('Pan para todos')
  })

  it('AC-22: con video del puesto, el del puesto en la tarjeta y el de la empresa en «Sobre…»', () => {
    const p = presentacionDeLaVacante(vacante({ videoPuesto: VIMEO, empresa: { video: YOUTUBE } }), true)
    expect(p.enLaTarjeta).toEqual({ video: VIMEO, titulo: 'Conoce el puesto' })
    expect(p.sobre?.video).toEqual({ video: YOUTUBE, titulo: 'Conoce a Molinos del Sur' })
  })

  it('en el teléfono, el del puesto arriba de la ficha y el de la empresa en «Sobre…»', () => {
    const p = presentacionDeLaVacante(vacante({ videoPuesto: VIMEO, empresa: { video: YOUTUBE } }), false)
    expect(p.enLaTarjeta).toBeNull()
    expect(p.arriba).toEqual({ video: VIMEO, titulo: 'Conoce el puesto' })
    expect(p.sobre?.video?.video).toEqual(YOUTUBE)
  })

  it('en PC, con solo el video de la empresa, no queda un «Sobre…» vacío', () => {
    const p = presentacionDeLaVacante(vacante({ empresa: { video: YOUTUBE } }), true)
    expect(p.enLaTarjeta).not.toBeNull()
    expect(p.sobre).toBeNull()
  })

  it('un enlace que no es http ni https no se pinta, y el perfil va en minúsculas', () => {
    const p = presentacionDeLaVacante(
      vacante({ empresa: { redes: [{ red: 'FACEBOOK', enlace: 'javascript:alert(1)' }], proposito: 'x' } }),
      true,
    )
    expect(p.sobre?.enlaces).toEqual([])
    expect(p.perfil).toBe('/empresas/molinos-del-sur')
    expect(presentacionDeLaVacante(vacante({ codigoEmpresa: undefined }), true).perfil).toBeNull()
  })
})
