/**
 * El menú lateral del panel (V64): qué entradas salen, en qué familias, cuál
 * está activa y si el menú está plegado.
 *
 * Separado del armazón para que las reglas se prueben sin pintar nada.
 *
 * ⚠️ **Las entradas siguen los permisos que ya exige su pantalla**, no otros
 * nuevos: Vacantes pide `ver_vacantes`; Simulación, crear sesiones o ver sus
 * inscritos; Pruebas, `elegir_plantilla_prueba`. Configuración sale siempre,
 * porque su página abre para cualquiera y cada sección decide lo suyo. Ningún
 * rol pierde así una entrada cuya pantalla le funcionaba. Y si la sesión no se
 * puede cargar, salen las cuatro de siempre: el panel sigue funcionando.
 */

import { rutas } from '@/rutas'
import type { SesionDelPanel } from './api/tiposPersonas'

export type ClaveDeEntrada = 'vacantes' | 'simulacion' | 'pruebas' | 'colaboradores' | 'configuracion'

export interface Entrada {
  clave: ClaveDeEntrada
  nombre: string
  ruta: string
}

export interface Familia {
  titulo: string
  entradas: Entrada[]
}

export interface Menu {
  familias: Familia[]
  /** Al pie, separado: Configuración. */
  pie: Entrada[]
}

const VACANTES: Entrada = { clave: 'vacantes', nombre: 'Vacantes', ruta: rutas.adminVacantes() }
const SIMULACION: Entrada = { clave: 'simulacion', nombre: 'Simulación', ruta: rutas.adminSesiones() }
const PRUEBAS: Entrada = { clave: 'pruebas', nombre: 'Pruebas', ruta: rutas.adminPruebas() }
const COLABORADORES: Entrada = {
  clave: 'colaboradores',
  nombre: 'Colaboradores',
  ruta: rutas.adminColaboradores(),
}
const CONFIGURACION: Entrada = {
  clave: 'configuracion',
  nombre: 'Configuración',
  ruta: rutas.adminConfiguracion(),
}

/**
 * Las entradas que ve esta sesión. Sin sesión (cargando o caída), las cuatro de
 * siempre y nada nuevo.
 */
export function menuDe(sesion: SesionDelPanel | null | undefined): Menu {
  if (!sesion) {
    return {
      familias: [{ titulo: 'Selección', entradas: [VACANTES, SIMULACION, PRUEBAS] }],
      pie: [CONFIGURACION],
    }
  }
  const alcance = new Map(sesion.permisos.map((p) => [p.codigo, p.alcance]))
  const tiene = (codigo: string) => alcance.has(codigo)

  const seleccion: Entrada[] = []
  if (tiene('ver_vacantes')) seleccion.push(VACANTES)
  if (tiene('crear_sesiones_simulacion') || tiene('ver_inscritos_simulacion')) {
    seleccion.push(SIMULACION)
  }
  if (tiene('elegir_plantilla_prueba')) seleccion.push(PRUEBAS)

  // Solo cuenta el alcance TODO: con otro, el backend no alcanza a nadie y la
  // entrada llevaría a una lista vacía que nadie entendería.
  const personas: Entrada[] = alcance.get('ver_colaboradores') === 'TODO' ? [COLABORADORES] : []

  return {
    familias: [
      { titulo: 'Selección', entradas: seleccion },
      { titulo: 'Personas', entradas: personas },
    ].filter((f) => f.entradas.length > 0),
    pie: [CONFIGURACION],
  }
}

/** Qué entrada marca una dirección, también en sus rutas hijas. */
export function entradaActiva(ruta: string): ClaveDeEntrada | null {
  const limpia = ruta.replace(/\/+$/, '') || '/'
  if (limpia === '/admin' || limpia.startsWith('/admin/vacantes') || limpia.startsWith('/admin/archivadas')) {
    return 'vacantes'
  }
  if (limpia.startsWith('/admin/simulacion')) return 'simulacion'
  if (limpia.startsWith('/admin/pruebas')) return 'pruebas'
  if (limpia.startsWith('/admin/colaboradores')) return 'colaboradores'
  if (limpia.startsWith('/admin/configuracion')) return 'configuracion'
  return null
}

const CLAVE_PLEGADO = 'renaser_panel_menu_plegado'

/** Si el menú quedó plegado en este navegador. Sin almacenamiento, desplegado. */
export function leerPlegado(): boolean {
  try {
    return localStorage.getItem(CLAVE_PLEGADO) === '1'
  } catch {
    return false
  }
}

export function guardarPlegado(plegado: boolean): void {
  try {
    if (plegado) localStorage.setItem(CLAVE_PLEGADO, '1')
    else localStorage.removeItem(CLAVE_PLEGADO)
  } catch {
    // Navegación privada con el almacenamiento bloqueado: se pliega igual, solo
    // que no se recuerda.
  }
}
