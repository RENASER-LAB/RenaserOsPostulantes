/**
 * El menú lateral (V64): qué entradas ve cada rol, cuál se marca y el plegado.
 *
 * La regla que no se puede romper: **ningún rol pierde una entrada cuya
 * pantalla le funciona hoy**. Las tres de siempre siguen los permisos que ya
 * exige su pantalla, y sin sesión salen las tres.
 *
 * «Pruebas» es el índice de las pruebas de la empresa (spec
 * pruebas-indice-de-la-empresa, AC-01): sale con `ver_vacantes`, detrás de
 * Vacantes. Los permisos de las plantillas de la sección retirada (spec
 * fuga-del-catalogo-de-preguntas) no la dan.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SesionDelPanel } from './api/tiposPersonas'
import { entradaActiva, guardarPlegado, leerPlegado, menuDe } from './menu'

function sesion(
  permisos: Record<string, 'TODO' | 'SUS_VACANTES' | 'PROPIO'>,
  empresa: { organizacionId: number; empresa: string } = {
    organizacionId: 1,
    empresa: 'Clínica Renaser S.A.C.',
  },
): SesionDelPanel {
  return {
    usuarioId: 1,
    nombre: 'Ana Pérez',
    correo: 'ana@equipo.pe',
    ...empresa,
    permisos: Object.entries(permisos).map(([codigo, alcance]) => ({ codigo, alcance })),
  }
}

const nombres = (menu: ReturnType<typeof menuDe>) => ({
  familias: menu.familias.map((f) => [f.titulo, f.entradas.map((e) => e.nombre)]),
  pie: menu.pie.map((e) => e.nombre),
})

describe('qué entradas ve cada rol', () => {
  it('Talento ve Selección, Personas y Configuración al pie (AC-01)', () => {
    const menu = menuDe(
      sesion({
        ver_vacantes: 'TODO',
        crear_sesiones_simulacion: 'TODO',
        elegir_plantilla_prueba: 'TODO',
        ver_colaboradores: 'TODO',
      }),
    )
    expect(nombres(menu)).toEqual({
      familias: [
        ['Selección', ['Vacantes', 'Pruebas', 'Simulación']],
        ['Personas', ['Colaboradores']],
      ],
      pie: ['Configuración'],
    })
    expect(menu.familias[0]!.entradas.map((e) => e.ruta)).toEqual(['/admin', '/admin/pruebas', '/admin/simulacion'])
  })

  it('el Responsable del área no ve Personas y conserva las tres de hoy con su alcance (AC-02)', () => {
    const menu = menuDe(
      sesion({
        ver_vacantes: 'TODO',
        ver_inscritos_simulacion: 'SUS_VACANTES',
        elegir_plantilla_prueba: 'SUS_VACANTES',
      }),
    )
    expect(nombres(menu)).toEqual({
      familias: [['Selección', ['Vacantes', 'Pruebas', 'Simulación']]],
      pie: ['Configuración'],
    })
  })

  it('«Pruebas» sale con ver_vacantes, en cualquier empresa, también con SUS_VACANTES; sin él no (AC-01, AC-05)', () => {
    for (const empresa of [
      { organizacionId: 1, empresa: 'Clínica Renaser S.A.C.' },
      { organizacionId: 2, empresa: 'Acme S.A.C.' },
    ]) {
      for (const alcance of ['TODO', 'SUS_VACANTES'] as const) {
        const menu = menuDe(sesion({ ver_vacantes: alcance }, empresa))
        const pruebas = menu.familias.flatMap((f) => f.entradas).find((e) => e.nombre === 'Pruebas')
        expect(pruebas?.ruta).toBe('/admin/pruebas')
      }
    }
    // Los permisos de las plantillas de la sección retirada no la dan: sin ver_vacantes, no sale.
    const sinVer = menuDe(sesion({ elegir_plantilla_prueba: 'TODO', editar_plantillas_prueba: 'TODO' }))
    expect(sinVer.familias).toEqual([])
  })

  it('ver_colaboradores con otro alcance que TODO no da la entrada: no alcanzaría a nadie', () => {
    const menu = menuDe(sesion({ ver_vacantes: 'TODO', ver_colaboradores: 'SUS_VACANTES' }))
    expect(menu.familias.map((f) => f.titulo)).toEqual(['Selección'])
  })

  it('una familia sin entradas no sale, y Configuración sale siempre', () => {
    const menu = menuDe(sesion({ crear_usuarios_y_asignar_roles: 'TODO' }))
    expect(menu.familias).toEqual([])
    expect(menu.pie.map((e) => e.nombre)).toEqual(['Configuración'])
  })

  it('sin sesión —cargando o caída— salen las tres de siempre y nada nuevo', () => {
    for (const nada of [null, undefined]) {
      expect(nombres(menuDe(nada))).toEqual({
        familias: [['Selección', ['Vacantes', 'Simulación']]],
        pie: ['Configuración'],
      })
    }
  })
})

describe('la entrada activa, también en las rutas hijas (AC-04)', () => {
  it.each([
    ['/admin', 'vacantes'],
    ['/admin/', 'vacantes'],
    ['/admin/vacantes/12', 'vacantes'],
    ['/admin/vacantes/12/prueba-tecnica', 'vacantes'],
    ['/admin/archivadas', 'vacantes'],
    ['/admin/colaboradores', 'colaboradores'],
    ['/admin/colaboradores/3', 'colaboradores'],
    ['/admin/colaboradores/nuevo', 'colaboradores'],
    ['/admin/simulacion', 'simulacion'],
    ['/admin/configuracion', 'configuracion'],
  ])('%s marca %s', (ruta, clave) => {
    expect(entradaActiva(ruta)).toBe(clave)
  })

  it.each(['/admin/pruebas', '/admin/pruebas/'])('%s marca «Pruebas»', (ruta) => {
    expect(entradaActiva(ruta)).toBe('pruebas')
  })

  it('la versión de una plantilla de la sección retirada no marca ninguna entrada', () => {
    expect(entradaActiva('/admin/pruebas/versiones/4')).toBeNull()
  })
})

describe('el plegado se recuerda en este navegador (AC-03)', () => {
  afterEach(() => localStorage.clear())

  it('plegado y desplegado sobreviven a la recarga', () => {
    expect(leerPlegado()).toBe(false)
    guardarPlegado(true)
    expect(leerPlegado()).toBe(true)
    guardarPlegado(false)
    expect(leerPlegado()).toBe(false)
  })

  it('sin almacenamiento el menú sale desplegado y plegar no revienta', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(leerPlegado()).toBe(false)
    expect(() => guardarPlegado(true)).not.toThrow()
  })
})
