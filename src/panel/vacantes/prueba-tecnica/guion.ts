/**
 * El guion de la ficha del puesto: las diez preguntas de la clienta, las siete
 * familias de textura y lo que vuelve COMPLETA a la ficha.
 *
 * Los textos son los de `docs/CAZATALENTOS-PRUEBA-TECNICA.md` del backend y se
 * le hablan al dueño de la empresa, no a recursos humanos: la ficha se llena
 * con sus palabras y el agente REDACTOR escribe el cuestionario a partir de
 * ellas.
 *
 * ⚠️ **COMPLETA la decide el servidor y llega en `estado`.** La copia de aqui
 * existe para decir QUE falta antes de guardar —el chip del servidor solo dice
 * si— y si un dia difieren manda el servidor y esta lista se corrige. Es la
 * misma lista que `ServicioFichaVacanteImpl.estadoDe`: Q1 a Q9 con texto (Q10
 * es opcional), las dos cifras, los cuatro riesgos, la primera eliminatoria y
 * al menos una familia.
 */

import type { FichaDelPuesto, GuardarFichaDelPuesto } from '../../api/tipos'

export type CampoDeTexto =
  | 'q1Resultado'
  | 'q2Riesgo'
  | 'q3DiaReal'
  | 'q4EpocaDorada'
  | 'q5Estructura'
  | 'q6Autonomia'
  | 'q7JefeDirecto'
  | 'q8LoIncomodo'
  | 'q9Requerimientos'
  | 'q10Espejo'

export interface PreguntaDelGuion {
  campo: CampoDeTexto
  numero: number
  titulo: string
  pregunta: string
  /** Para que sirve lo que conteste: se lo decimos, que asi contesta mejor. */
  ayuda: string
  opcional?: boolean
}

export const PREGUNTAS: readonly PreguntaDelGuion[] = [
  {
    campo: 'q1Resultado',
    numero: 1,
    titulo: 'Resultado',
    pregunta:
      'Dentro de un año, ¿qué tiene que haber pasado para que digas que contratar a esta persona fue un acierto? Dímelo en números si se puede.',
    ayuda: 'Es la base de la muestra de trabajo.',
  },
  {
    campo: 'q2Riesgo',
    numero: 2,
    titulo: 'Riesgo',
    pregunta:
      'Si contratas a la persona equivocada, ¿en qué te vas a dar cuenta primero? ¿Qué es lo primero que empieza a fallar?',
    ayuda: 'Cuéntalo aquí y después resúmelo abajo en cuatro riesgos cortos, ordenados.',
  },
  {
    campo: 'q3DiaReal',
    numero: 3,
    titulo: 'Día real',
    pregunta:
      'Descríbeme un día normal de esa persona, de principio a fin. ¿Qué hace durante ocho horas?',
    ayuda: 'Confirma de qué familia es el puesto y de qué nivel.',
  },
  {
    campo: 'q4EpocaDorada',
    numero: 4,
    titulo: 'Época dorada',
    pregunta:
      '¿Alguien ocupó este puesto antes y lo hizo bien? ¿Qué hacía que las demás no hicieron? ¿Y el que lo hizo mal, en qué falló?',
    ayuda: 'De aquí sale el perfil real del puesto y, muchas veces, la segunda eliminatoria.',
  },
  {
    campo: 'q5Estructura',
    numero: 5,
    titulo: 'Estructura',
    pregunta:
      '¿Cuánta gente hay en la empresa? ¿Cuántas va a tener a cargo? ¿Alguna de ellas tiene gente a su cargo?',
    ayuda: 'Las dos cifras van también en números, aquí debajo: de ellas sale el tamaño de la empresa.',
  },
  {
    campo: 'q6Autonomia',
    numero: 6,
    titulo: 'Autonomía',
    pregunta: '¿Qué va a poder decidir sin preguntarte a ti?',
    ayuda: 'Confirma el nivel real del puesto.',
  },
  {
    campo: 'q7JefeDirecto',
    numero: 7,
    titulo: 'Jefe directo',
    pregunta:
      '¿A quién le va a reportar? ¿Cómo trabaja esa persona? ¿Qué tipo de persona no funciona con ese jefe?',
    ayuda: 'Se valida en la entrevista humana.',
  },
  {
    campo: 'q8LoIncomodo',
    numero: 8,
    titulo: 'Lo incómodo',
    pregunta:
      '¿Qué tiene de difícil o incómodo este puesto que un candidato debería saber antes de aceptar?',
    ayuda: 'Se le dice al candidato: evita salidas tempranas.',
  },
  {
    campo: 'q9Requerimientos',
    numero: 9,
    titulo: 'Requerimientos',
    pregunta:
      '¿Hay algo específico que tenga que saber o poder hacer, sin lo cual no sirve? (máximo 3)',
    ayuda: 'Cuéntalo aquí y resúmelo abajo, uno por línea.',
  },
  {
    campo: 'q10Espejo',
    numero: 10,
    titulo: 'Espejo',
    pregunta:
      'Si ya contrataste antes para este puesto y no funcionó, ¿qué crees TÚ que falló en la elección?',
    ayuda: 'Solo si ya contrataste antes para este puesto. Se escucha sin corregir.',
    opcional: true,
  },
]

/** La pregunta de control de la clienta para cada eliminatoria. */
export const CONTROL_DE_ELIMINATORIA =
  'Si fuera excelente en todo menos en esto, ¿lo contratarías igual? Si la respuesta es no, es eliminatoria. Máximo dos.'

export interface Familia {
  codigo: string
  nombre: string
  pista: string
}

/** Los siete diccionarios de textura. El candidato nunca ve la lista. */
export const FAMILIAS: readonly Familia[] = [
  { codigo: 'F1', nombre: 'Mando', pista: 'dirige gente: plazos, actas, el que se fue' },
  { codigo: 'F2', nombre: 'Comercial', pista: 'vende: ciclo, objeción, cuota, cartera' },
  { codigo: 'F3', nombre: 'Operación', pista: 'máquinas y turnos: tolerancias, EPP, qué falla primero' },
  { codigo: 'F4', nombre: 'Administración', pista: 'caja y cuadre: arqueo, faltante, quién firma' },
  { codigo: 'F5', nombre: 'Servicio', pista: 'atiende clientes: hasta dónde decidía solo, escalamiento' },
  { codigo: 'F6', nombre: 'Proyectos', pista: 'entrega cosas: quién aprobaba, alcance, la fecha que se movió' },
  { codigo: 'F7', nombre: 'Soporte', pista: 'asiste a alguien: lo pendiente, qué decidía sin consultar' },
]

/**
 * Lo que el formulario escribe: todo texto.
 *
 * Los `<input>` hablan en texto, y un `null` en `value` es un aviso de React y
 * una casilla que no se puede borrar. Las cifras viven aqui como texto y se
 * convierten al mandar; `familias` es la cadena del backend, `F1,F4`.
 */
export type Borrador = { [K in keyof GuardarFichaDelPuesto]: string }

export const BORRADOR_VACIO: Borrador = {
  q1Resultado: '',
  q2Riesgo: '',
  q3DiaReal: '',
  q4EpocaDorada: '',
  q5Estructura: '',
  q6Autonomia: '',
  q7JefeDirecto: '',
  q8LoIncomodo: '',
  q9Requerimientos: '',
  q10Espejo: '',
  genteEnEmpresa: '',
  genteACargo: '',
  riesgo1: '',
  riesgo2: '',
  riesgo3: '',
  riesgo4: '',
  eliminatoria1: '',
  eliminatoria2: '',
  requerimiento1: '',
  requerimiento2: '',
  requerimiento3: '',
  familias: '',
}

/** Todos los campos, en el orden del record. Es lo que garantiza que el PUT lleve los 22. */
export const CAMPOS = Object.keys(BORRADOR_VACIO) as (keyof Borrador)[]

/** Las tres listas donde el orden manda y no se admiten huecos. */
export const RIESGOS = ['riesgo1', 'riesgo2', 'riesgo3', 'riesgo4'] as const
export const ELIMINATORIAS = ['eliminatoria1', 'eliminatoria2'] as const
export const REQUERIMIENTOS = ['requerimiento1', 'requerimiento2', 'requerimiento3'] as const
const EN_ORDEN: readonly (readonly (keyof Borrador)[])[] = [RIESGOS, ELIMINATORIAS, REQUERIMIENTOS]

export function deFicha(ficha: FichaDelPuesto | null): Borrador {
  if (!ficha) return { ...BORRADOR_VACIO }
  const borrador = { ...BORRADOR_VACIO }
  for (const campo of CAMPOS) {
    const valor = ficha[campo]
    borrador[campo] = valor === null || valor === undefined ? '' : String(valor)
  }
  return borrador
}

/**
 * Una cifra escrita a mano: vacia o rara es «no la dijo», no cero.
 *
 * Entera y sin signo, o nada: `parseInt` convertia «12.7» en 12 y dejaba pasar
 * «-5» — el backend los rechaza, pero recortar sin avisar es peor que no mandar.
 */
function cifra(texto: string): number | null {
  const limpio = texto.trim()
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function texto(valor: string): string | null {
  const limpio = valor.trim()
  return limpio === '' ? null : limpio
}

/**
 * El cuerpo del PUT, con los 22 campos.
 *
 * ⚠️ Es un reemplazo completo en el servidor: un campo que no viaje se borra.
 * Por eso se construye recorriendo `CAMPOS` y no a mano campo por campo.
 */
export function aCuerpo(borrador: Borrador): GuardarFichaDelPuesto {
  const cuerpo: Record<string, string | number | null> = {}
  for (const campo of CAMPOS) {
    cuerpo[campo] =
      campo === 'genteEnEmpresa' || campo === 'genteACargo'
        ? cifra(borrador[campo])
        : texto(borrador[campo])
  }
  // Sin huecos, como exige el backend: lo que venga despues del primer vacio de
  // cada lista ordenada no viaja. En pantalla esas casillas estan apagadas,
  // pero conservan lo escrito por si el hueco se vuelve a llenar.
  for (const grupo of EN_ORDEN) {
    let hueco = false
    for (const campo of grupo) {
      if (hueco) cuerpo[campo] = null
      else if (cuerpo[campo] === null) hueco = true
    }
  }
  return cuerpo as unknown as GuardarFichaDelPuesto
}

export function tieneFamilia(familias: string, codigo: string): boolean {
  return familias.split(',').map((f) => f.trim()).includes(codigo)
}

/** Marca o quita una familia dejando la cadena en el orden F1..F7 del backend. */
export function conFamilia(familias: string, codigo: string, marcada: boolean): string {
  const actuales = new Set(familias.split(',').map((f) => f.trim()).filter(Boolean))
  if (marcada) actuales.add(codigo)
  else actuales.delete(codigo)
  return FAMILIAS.map((f) => f.codigo)
    .filter((c) => actuales.has(c))
    .join(',')
}

/** Que le falta a este borrador para quedar COMPLETA, dicho como se lee. Vacio = nada. */
export function queLeFalta(borrador: Borrador): string[] {
  const faltan: string[] = []
  for (const p of PREGUNTAS) {
    if (!p.opcional && borrador[p.campo].trim() === '') faltan.push(`la pregunta ${p.numero}`)
  }
  if (cifra(borrador.genteEnEmpresa) === null) faltan.push('cuánta gente hay en la empresa')
  if (cifra(borrador.genteACargo) === null) faltan.push('cuántas personas tendrá a cargo')
  const riesgosVacios = (['riesgo1', 'riesgo2', 'riesgo3', 'riesgo4'] as const).filter(
    (r) => borrador[r].trim() === '',
  ).length
  if (riesgosVacios > 0) faltan.push(riesgosVacios === 4 ? 'los cuatro riesgos' : `${riesgosVacios} de los cuatro riesgos`)
  if (borrador.eliminatoria1.trim() === '') faltan.push('la primera eliminatoria')
  if (borrador.familias.trim() === '') faltan.push('al menos una familia')
  return faltan
}
