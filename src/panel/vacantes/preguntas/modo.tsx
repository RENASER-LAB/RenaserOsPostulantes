/**
 * Para qué se está usando el editor: las preguntas del Perfil Integral (fase 1)
 * o la prueba técnica de la vacante (V67).
 *
 * Es el mismo editor —los mismos bloques, el mismo balance, las mismas
 * publicadas, recomendaciones y copia— con tres diferencias que cada pieza lee
 * de aquí en vez de recibirlas por parámetro de componente en componente:
 *
 *   - **La ruta** de la API (`preguntas-propias` o `prueba-propia`) y la clave
 *     de la consulta: las dos de una misma vacante no se pisan.
 *   - **Las abiertas no llevan puntos** en la prueba: la IA o una persona
 *     califican el criterio entero (decisión 3).
 *   - **Los textos**: «preguntas» o «prueba». Desde la V68 no hay «cuestionario»:
 *     la prueba es una sola, con o sin entregables.
 *
 * Sin proveedor es el modo de siempre, el de la fase 1: sus pantallas y sus
 * pruebas no tienen que saber que esto existe.
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { RutaDelEditor } from '../../api/preguntasPropias'

export interface ModoDelEditor {
  tipo: 'BANCO' | 'PRUEBA'
  ruta: RutaDelEditor
}

export const MODO_BANCO: ModoDelEditor = { tipo: 'BANCO', ruta: 'preguntas-propias' }
export const MODO_PRUEBA: ModoDelEditor = { tipo: 'PRUEBA', ruta: 'prueba-propia' }

const Contexto = createContext<ModoDelEditor>(MODO_BANCO)

export function ConModoDelEditor({ modo, children }: { modo: ModoDelEditor; children: ReactNode }) {
  return <Contexto.Provider value={modo}>{children}</Contexto.Provider>
}

export const useModoDelEditor = () => useContext(Contexto)

/** En la prueba: si la abierta no lleva puntos (siempre). */
export const esPrueba = (modo: ModoDelEditor) => modo.tipo === 'PRUEBA'
