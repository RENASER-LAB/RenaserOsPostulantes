/**
 * Las cinco etapas del ranking, y las tres formas de mirarlas.
 *
 * Esto vivia dentro de `Vacante.tsx`, pegado al JSX. Sale porque lo que decide
 * que fila se ve, que cifra se enseña y por que una nota esta vacia son reglas
 * con casos —no dibujo— y hay que poder ponerlas en rojo una a una.
 *
 * ⚠️ **La trampa que gobierna este archivo: casi ningun campo del ranking es de
 * la etapa que se esta mirando.** `?etapa=` cambia UNA cosa, `notaEtapa`, que
 * sale de `nota_etapa` filtrada por esa etapa. Todo lo demas —`calificados`,
 * `enCurso`, `fallidos`, `conPasadaFina`, `estadoCalificacion`, `pasada`,
 * `adecuacion`, `potencial`, `altoRendimiento`, `confianzaEvidencia`,
 * `resumen`, `fortalezas`, `riesgosCriticos` y hasta `notasCriterio`— se arma
 * sin mirar la etapa: viene de la cola que califica el CURRICULUM con IA, del
 * `PerfilTalento` y de los criterios del curriculum.
 *
 * Comprobado contra el backend vivo: en la vacante 3 las cuatro cifras de
 * cabecera son identicas en las cinco pestañas —16/5/0/9— mientras las filas
 * con `notaEtapa` van 5, 1, 1, 1. De ahi salia «76 calificados» encima de
 * setenta y ocho guiones.
 */

import type { FilaRanking } from '../api/tipos'

export const ETAPAS_PANEL = [
  {
    codigo: 'PERFIL_INTEGRAL',
    nombre: 'Perfil integral',
    prefijos: ['POSTULADA', 'PERFIL_'],
    nota: 'Nota del perfil',
    /** Lo que hace falta para que esta etapa deje nota, dicho al candidato. */
    loQueDejaNota: 'el currículum leído y calificado',
  },
  {
    codigo: 'PRUEBA_PUESTO',
    nombre: 'Prueba del puesto',
    prefijos: ['PRUEBA_'],
    nota: 'Nota de la prueba',
    loQueDejaNota: 'la prueba rendida y calificada',
  },
  {
    codigo: 'SIMULACION',
    nombre: 'Simulación',
    prefijos: ['SIMULACION_'],
    nota: 'Nota de la simulación',
    loQueDejaNota: 'la sesión asistida y calificada',
  },
  {
    codigo: 'VALIDACION',
    nombre: 'Validación',
    prefijos: ['VALIDACION_'],
    nota: 'Nota de la validación',
    loQueDejaNota: 'el periodo terminado y calificado',
  },
  {
    codigo: 'DECISION',
    nombre: 'Decisión',
    prefijos: ['DECISION_'],
    nota: 'Nota de la decisión',
    loQueDejaNota: 'la decisión tomada',
  },
] as const

export type EtapaPanel = (typeof ETAPAS_PANEL)[number]['codigo']

export const laEtapaDe = (codigo: EtapaPanel) =>
  ETAPAS_PANEL.find((e) => e.codigo === codigo)!

/**
 * Las dos etapas cuyas cifras y columnas SI hablan del curriculum.
 *
 * En Decisión se sigue decidiendo con el retrato del CV delante, asi que ahi
 * tambien significan algo. En las otras tres serian tres numeros de otra etapa
 * con la misma pinta que el de esta.
 */
export const esDelCurriculum = (etapa: EtapaPanel) =>
  etapa === 'PERFIL_INTEGRAL' || etapa === 'DECISION'

export const estaAhoraEn = (estado: string, etapa: EtapaPanel) =>
  laEtapaDe(etapa).prefijos.some((p) => estado.startsWith(p))

// ---------- Donde esta cada quien respecto a la etapa que se mira ----------

/**
 * El indice de la etapa en la que esta parada una postulacion, o `null` si su
 * estado no pertenece a ninguna —`CONTRATADO`, `NO_CONTINUA` y `CERRADA` son
 * finales y no viven en ninguna etapa—.
 */
export function indiceDeLaEtapaDe(estado: string): number | null {
  const i = ETAPAS_PANEL.findIndex((e) => e.prefijos.some((p) => estado.startsWith(p)))
  return i === -1 ? null : i
}

export type Vista = 'con-nota' | 'aqui-ahora' | 'toda'

export const tieneNota = (fila: FilaRanking) => fila.notaEtapa !== null

export function filtrar(filas: FilaRanking[], etapa: EtapaPanel, vista: Vista): FilaRanking[] {
  if (vista === 'toda') return filas
  if (vista === 'con-nota') return filas.filter(tieneNota)
  return filas.filter((f) => estaAhoraEn(f.estado, etapa))
}

/**
 * Cuantas caen en cada una de las tres vistas.
 *
 * ⚠️ **Las tres se cuentan siempre, aunque solo una se este viendo.** Un
 * control segmentado sin sus cifras obliga a pulsar las tres para saber si
 * alguna tiene algo, y en «Prueba del puesto» los dos primeros cortes casi no
 * se solapan: quien esta ahi ahora es quien todavia NO la ha rendido, y quien
 * tiene nota ya paso de largo. Medido en la vacante 3: una fila cada uno, sin
 * una sola persona en comun.
 */
export const recuentos = (filas: FilaRanking[], etapa: EtapaPanel) => ({
  'con-nota': filas.filter(tieneNota).length,
  'aqui-ahora': filas.filter((f) => estaAhoraEn(f.estado, etapa)).length,
  toda: filas.length,
})

// ---------- Por que esa nota esta vacia ----------

/**
 * Un guion no significa una sola cosa, y esa era la queja: «están calificados y
 * no se ve su nota».
 *
 * ⚠️ **`estadoCalificacion` NO sirve para explicarlo fuera del curriculum.**
 * Es el estado de la cola que califica el CV con IA, asi que un `TERMINADA` en
 * la pestaña de la prueba dice que el curriculum esta calificado y no dice
 * absolutamente nada de la prueba. Usarlo ahi seria repetir el fallo que se
 * viene a arreglar.
 *
 * Lo que si es de la etapa es **donde esta parada la persona**, que sale de su
 * estado. De ahi los cinco motivos.
 */
export function porQueNoHayNota(fila: FilaRanking, etapa: EtapaPanel): string {
  const suya = indiceDeLaEtapaDe(fila.estado)
  const esta = ETAPAS_PANEL.findIndex((e) => e.codigo === etapa)

  if (suya === null) return 'Terminó su proceso sin nota de esta etapa'

  /*
    ⚠️ **El estado NO es monótono, así que no se puede decir «todavía no llega»
    ni «ya pasó».** Comprobado contra el backend vivo: las postulaciones 16 y 18
    de la base local hicieron `PRUEBA_CALIFICANDO → PERFIL_CALIFICANDO`, es
    decir, rindieron la prueba y volvieron al perfil —se recalifica el
    currículum y el proceso retrocede—. Sobre ellas, «todavía no llega a esta
    etapa» es sencillamente falso: la 16 tiene los siete criterios de la prueba
    calificados.

    Lo único que el ranking puede afirmar con lo que trae es **dónde está
    ahora**, y eso además es lo accionable: dice qué pestaña mirar.
  */
  if (suya !== esta) return `Su proceso está en ${ETAPAS_PANEL[suya]!.nombre}`

  /*
    Está parada justo aquí. El sufijo del estado dice de quién se espera algo,
    que es la misma regla con la que el portal del candidato decide si hay
    botón: `TURNO_CANDIDATO` es suyo, `CALIFICANDO` es del sistema, y
    `POR_CONFIRMAR` y `POR_HABILITAR` son del equipo.
  */
  if (fila.estado.endsWith('TURNO_CANDIDATO')) return 'Le toca a la persona: aún no la ha hecho'
  /*
    ⚠️ **`CALIFICANDO` no significa que algo se esté calificando ahora.** La
    persona la hizo y su nota de etapa no existe, y eso cubre tres situaciones
    que desde el ranking no se distinguen: nadie pidió la calificación, la IA
    está en ello, o **está calificada entera y falta ponderarla** —el paso que
    produce la nota—. Saber en cuál está exige la rúbrica de esa persona, que
    son 78 peticiones desde aquí y una sola desde su ficha.

    Por eso el motivo no afirma quién trabaja: dice que ya la hizo y manda al
    único sitio donde la respuesta existe.
  */
  if (fila.estado.endsWith('CALIFICANDO')) return 'Ya la hizo: su nota se calcula en la ficha'
  if (fila.estado.endsWith('POR_HABILITAR')) return 'El equipo no la ha habilitado'
  if (fila.estado.endsWith('POR_CONFIRMAR')) return 'Hecha, pendiente de que el equipo la cierre'
  return 'Sin nota de esta etapa'
}

// ---------- Las cifras de la cabecera ----------

export interface CifrasDeLaEtapa {
  conNota: number
  sinNota: number
  /** Le toca a la persona: todavía no la ha hecho. */
  esperandoALaPersona: number
  /**
   * **Ya la hicieron y siguen sin nota.** Es la cifra accionable de la
   * cabecera: son las personas de las que el equipo tiene trabajo pendiente.
   */
  hechasSinNota: number
  /** Ni una cosa ni la otra: su proceso está parado en otra etapa. */
  enOtraEtapa: number
}

/**
 * Las cifras de la etapa que se esta mirando, contadas de las filas SIN filtrar.
 *
 * ⚠️ **Se cuentan de `filas`, nunca de lo que se pinta.** Derivarlas de lo
 * visible haria que el corte «con nota» dijera siempre «12 de 12», que es la
 * misma trampa del conteo de una sesion frente a la longitud de su lista de
 * inscritos.
 */
/*
  ⚠️ **Las categorías tienen que sumar `sinNota`, y antes no sumaban.** Eran
  «esperando a la persona» (TURNO_CANDIDATO) y «esperando al equipo»
  (POR_CONFIRMAR / POR_HABILITAR), y **`CALIFICANDO` no caía en ninguna**. En una
  vacante real de 78 eso dejaba fuera a 15 personas — y eran justo las que
  importan: rindieron la prueba y siguen sin nota.

  Ahora son tres, y la del medio es la accionable: **quien ya la hizo y sigue
  sin nota** es de quien el equipo tiene trabajo pendiente. Un `CALIFICANDO` no
  significa que algo se esté calificando ahora mismo: puede que nadie lo haya
  pedido, o que esté calificada y falte ponderar (ver `porQueNoHayNota`).
*/
export function cifrasDeLaEtapa(filas: FilaRanking[], etapa: EtapaPanel): CifrasDeLaEtapa {
  const sinNota = filas.filter((f) => !tieneNota(f))
  const aqui = sinNota.filter((f) => estaAhoraEn(f.estado, etapa))
  const esperandoALaPersona = aqui.filter((f) => f.estado.endsWith('TURNO_CANDIDATO')).length
  return {
    conNota: filas.length - sinNota.length,
    sinNota: sinNota.length,
    esperandoALaPersona,
    hechasSinNota: aqui.length - esperandoALaPersona,
    enOtraEtapa: sinNota.length - aqui.length,
  }
}
