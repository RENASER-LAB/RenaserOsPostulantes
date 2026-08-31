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

/*
  ⚠️ **`!== null` no basta mientras el backend viaja en paralelo.** Un campo que
  el servidor todavia no manda llega `undefined`, no `null`, y `undefined !==
  null` es cierto: la fila diria que tiene nota y luego pintaria un hueco. Con
  `!= null` los dos casos caen del mismo lado, que es el que corresponde.
*/
export const tieneNota = (fila: FilaRanking) => fila.notaEtapa != null

export function filtrar(filas: FilaRanking[], etapa: EtapaPanel, vista: Vista): FilaRanking[] {
  if (vista === 'toda') return filas
  if (vista === 'con-nota') return filas.filter(tieneNota)
  return filas.filter((f) => estaAhoraEn(f.estado, etapa))
}

/**
 * Como se llama cada corte, en un solo sitio.
 *
 * Lo leen los tres botones Y la descripcion que viaja al Excel. Escrito dos
 * veces, la hoja acabaria diciendo que salio de un corte con otro nombre que el
 * que se pulso.
 */
export const rotuloDeVista = (vista: Vista, etapa: EtapaPanel): string =>
  vista === 'con-nota'
    ? `Con ${laEtapaDe(etapa).nota.toLowerCase()}`
    : vista === 'aqui-ahora'
      ? 'Está aquí ahora'
      : 'Toda la tanda'

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
   * cabecera: son las personas de las que el equipo tiene trabajo pendiente, y
   * exactamente a quienes alcanza el bloque de arriba de la tabla.
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

// ---------- El grupo de prioridad ----------

/**
 * El orden de los grupos, copiado de `ServicioPerfilIntegralPanelImpl`.
 *
 * ⚠️ **Manda el grupo, no la nota.** Quien llega a un 90 arrastrando un riesgo
 * crítico no va por delante de quien llega con un 80 y ninguno, y ordenar por el
 * número escondería justo eso. El backend ya sirve la tanda así; aquí se repite
 * para que **ordenar por nota en el navegador no deshaga esa decisión**.
 *
 * Lo que no tiene grupo va al final, no arriba: es el caso normal mientras la IA
 * no ha leído a nadie, y colocarlo primero pondría a los no calificados por
 * delante de los que sí.
 */
export const ORDEN_GRUPO = [
  'ALTA',
  'POTENCIAL_CON_RIESGO',
  'NO_PRIORIZADO',
  'INCOMPATIBLE',
] as const

/*
  Un `Map` y no `ORDEN_GRUPO.indexOf(...)`: con `noUncheckedIndexedAccess` el
  índice de una lista devuelve `T | undefined` y el `?? ` deja el caso del
  desconocido dicho en una línea en vez de escondido en un `-1`.
*/
const POSICION_DEL_GRUPO = new Map<string, number>(ORDEN_GRUPO.map((g, i) => [g, i]))

export const posicionDelGrupo = (grupo: string | null | undefined): number =>
  grupo == null ? ORDEN_GRUPO.length : (POSICION_DEL_GRUPO.get(grupo) ?? ORDEN_GRUPO.length)

const NOMBRE_DEL_GRUPO: Record<string, string> = {
  ALTA: 'Prioridad alta',
  POTENCIAL_CON_RIESGO: 'Potencial con riesgo',
  NO_PRIORIZADO: 'No priorizado',
  INCOMPATIBLE: 'Incompatible',
}

/**
 * El grupo dicho como se lee, o `null` si no tiene.
 *
 * ⚠️ **El panel SÍ pinta el grupo, y aquí hace falta.** La prohibición es del
 * portal del candidato —a nadie se le dice «incompatible» a la cara—, no de la
 * mesa donde se decide. Y ordenando por nota es obligatorio: las notas dejan de
 * ir de mayor a menor al cruzar de grupo, y sin ver el grupo el orden parece roto.
 *
 * Un código que no esté en la lista se enseña tal cual: inventarle un nombre es
 * peor que no saberlo.
 */
export const nombreDelGrupo = (grupo: string | null | undefined): string | null =>
  grupo == null ? null : (NOMBRE_DEL_GRUPO[grupo] ?? grupo.replaceAll('_', ' ').toLowerCase())

// ---------- La ciudad y la pretensión, dichas ----------

/**
 * El texto listo para buscar: sin tildes, sin mayúsculas y sin espacios de más.
 *
 * ⚠️ **Sin esto el buscador está muerto al nacer.** Media tanda se llama Fátima,
 * Lucía o Muñoz, y quien teclea `fatima` en un buscador que compara literales no
 * encuentra a nadie y concluye que la caja no funciona.
 */
export const paraBuscar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const SIMBOLO_DE_MONEDA: Record<string, string> = { PEN: 'S/', USD: 'US$' }

/*
  `es-PE` y no `es-ES`, y está medido, no supuesto: en `es-ES` los números de
  cuatro cifras salen SIN separador —`2500`— porque el CLDR español pide dos
  dígitos de grupo mínimo, así que ni siquiera daría el `2.500` que se buscaría.
  `es-PE` agrupa con coma —`2,500`—, que además es lo que devuelve el propio
  formato de moneda peruano (`S/ 2,500.00`) y lo que ya usa el resto del portal.

  Los decimales se conservan hasta dos y no se rellenan: una pretensión de 2500
  se lee «2,500» y una de 2500.5 no se redondea a la baja en silencio.
*/
const CIFRA = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

/**
 * La pretensión de una fila, en una línea que quepa en una celda.
 *
 * Cinco casos y ninguno se puede tapar con el mismo texto:
 *
 *   - los dos extremos → `S/ 2,500 – 3,000`
 *   - solo el mínimo   → `desde S/ 2,500`
 *   - solo el máximo   → `hasta S/ 3,000`
 *   - ninguno          → `null`, y la celda pone su guion
 *   - con cifras y sin moneda → las cifras sin símbolo. **No se supone soles**:
 *     un candidato que pide 3,000 dólares y aparece con «S/ 3,000» al lado es
 *     una llamada perdida.
 *
 * Una moneda que no se conozca viaja con su código delante (`EUR 3,000`).
 */
export function pretensionDicha(fila: FilaRanking): string | null {
  const min = fila.pretensionMin ?? null
  const max = fila.pretensionMax ?? null
  if (min == null && max == null) return null

  const moneda = fila.pretensionMoneda ?? null
  const simbolo = moneda == null ? '' : (SIMBOLO_DE_MONEDA[moneda] ?? moneda)
  const con = (valor: number) => (simbolo === '' ? CIFRA.format(valor) : `${simbolo} ${CIFRA.format(valor)}`)

  if (min != null && max != null) return `${con(min)} – ${CIFRA.format(max)}`
  if (min != null) return `desde ${con(min)}`
  return `hasta ${con(max!)}`
}

/**
 * Con qué cifra se ordena una pretensión: el mínimo, y el máximo si no declaró
 * mínimo.
 *
 * Quien solo dijo «hasta 3,000» tiene que caer en algún sitio del orden, y su
 * techo es lo único que dijo. Quien no dijo nada vale `null` y se va al final,
 * como todos los vacíos.
 */
export const pretensionParaOrdenar = (fila: FilaRanking): number | null =>
  fila.pretensionMin ?? fila.pretensionMax ?? null

// ---------- Ordenar ----------

export type ColumnaOrdenable = 'nombre' | 'ciudad' | 'nota' | 'pretension'
export type Sentido = 'asc' | 'desc'

export interface Orden {
  columna: ColumnaOrdenable
  sentido: Sentido
}

/**
 * Hacia dónde ordena el primer clic de cada columna.
 *
 * La nota abre por la mayor porque el ranking ES eso: pedir «ordenar por nota» y
 * recibir los ceros arriba obliga a un segundo clic siempre. Los textos abren de
 * la A a la Z, y la pretensión de la más baja, que es la que cabe en presupuesto.
 */
const SENTIDO_INICIAL: Record<ColumnaOrdenable, Sentido> = {
  nombre: 'asc',
  ciudad: 'asc',
  nota: 'desc',
  pretension: 'asc',
}

/**
 * El clic sobre una cabecera: entra por su sentido natural, se da la vuelta, y
 * al tercero **vuelve al orden del backend**.
 *
 * El tercer estado no es un capricho: el orden de origen —grupo de prioridad y,
 * dentro, nota— es la opinión del producto sobre la tanda, y sin forma de
 * volver a él habría que recargar la página para recuperarlo.
 */
export function alternarOrden(actual: Orden | null, columna: ColumnaOrdenable): Orden | null {
  const inicial = SENTIDO_INICIAL[columna]
  if (actual === null || actual.columna !== columna) return { columna, sentido: inicial }
  if (actual.sentido === inicial) return { columna, sentido: inicial === 'asc' ? 'desc' : 'asc' }
  return null
}

/** Lo que va en `aria-sort` de la cabecera. */
export const comoSeOrdena = (
  orden: Orden | null,
  columna: ColumnaOrdenable,
): 'ascending' | 'descending' | 'none' =>
  orden?.columna !== columna ? 'none' : orden.sentido === 'asc' ? 'ascending' : 'descending'

/**
 * Los vacíos, siempre al final.
 *
 * ⚠️ **No se puede resolver invirtiendo la comparación entera**, que es como
 * sale mal: con `ordenar(...).reverse()` los huecos suben a la primera pantalla
 * en cuanto se pulsa «descendente», y la mesa de decidir empieza con diez filas
 * sin dato. Se decide la ausencia ANTES de aplicar el sentido, así que el hueco
 * va abajo suba o baje el orden.
 *
 * Devuelve `null` cuando los dos tienen valor: ahí decide quien llama.
 */
function elHuecoAlFinal(a: unknown, b: unknown): number | null {
  const faltaA = a == null || a === ''
  const faltaB = b == null || b === ''
  if (faltaA && faltaB) return 0
  if (faltaA) return 1
  if (faltaB) return -1
  return null
}

const textoDe = (fila: FilaRanking, columna: ColumnaOrdenable): string | null =>
  columna === 'nombre' ? (fila.candidato ?? null) : (fila.ciudad ?? null)

const cifraDe = (fila: FilaRanking, columna: ColumnaOrdenable): number | null =>
  columna === 'nota' ? (fila.notaEtapa ?? null) : pretensionParaOrdenar(fila)

function comparadorDe(orden: Orden): (a: FilaRanking, b: FilaRanking) => number {
  const signo = orden.sentido === 'asc' ? 1 : -1
  const esTexto = orden.columna === 'nombre' || orden.columna === 'ciudad'

  return (a, b) => {
    /*
      ⚠️ **La nota se ordena DENTRO de cada grupo de prioridad, y el grupo no se
      da la vuelta.** Quien ordena está pidiendo otra nota arriba, no descartar
      la separación por grupo, que es la que dice que un 90 con riesgo crítico no
      manda sobre un 80 limpio. Sin esto, «nota descendente» mezcla los cuatro
      grupos y el orden del backend queda deshecho por un clic.
    */
    if (orden.columna === 'nota') {
      const porGrupo = posicionDelGrupo(a.grupoPrioridad) - posicionDelGrupo(b.grupoPrioridad)
      if (porGrupo !== 0) return porGrupo
    }

    if (esTexto) {
      const ta = textoDe(a, orden.columna)
      const tb = textoDe(b, orden.columna)
      const hueco = elHuecoAlFinal(ta, tb)
      if (hueco !== null) return hueco
      // `localeCompare` en español: con `<` a secas, «Ávila» cae detrás de
      // «Zurita» y la columna deja de estar alfabetizada justo en los apellidos
      // que más se repiten aquí.
      return signo * ta!.localeCompare(tb!, 'es', { sensitivity: 'base' })
    }

    const na = cifraDe(a, orden.columna)
    const nb = cifraDe(b, orden.columna)
    const hueco = elHuecoAlFinal(na, nb)
    if (hueco !== null) return hueco
    return signo * (na! - nb!)
  }
}

/**
 * La tanda ordenada. Sin orden puesto se devuelve tal cual: el del backend
 * —grupo y nota— ya es un orden, y rehacerlo aquí solo abriría la puerta a que
 * los dos discrepen.
 *
 * ⚠️ **Copia antes de ordenar.** `filas` es el array que guarda react-query en
 * su caché; un `.sort()` encima lo reordena para todo el que lo lea después, y
 * ese estropicio sobrevive a cambiar de pestaña. Y al ser `sort` estable, la
 * copia conserva el orden del backend como desempate gratis.
 */
export function ordenar(filas: FilaRanking[], orden: Orden | null): FilaRanking[] {
  if (orden === null) return filas
  return [...filas].sort(comparadorDe(orden))
}

// ---------- Filtrar ----------

export interface Filtros {
  /** Se busca en el nombre, sin tildes ni mayúsculas. */
  texto: string
  /** Códigos de ubigeo marcados. Vacío significa «todas», no «ninguna». */
  ciudades: string[]
  notaMin: number | null
  notaMax: number | null
  pretensionMin: number | null
  pretensionMax: number | null
}

export const SIN_FILTROS: Filtros = {
  texto: '',
  ciudades: [],
  notaMin: null,
  notaMax: null,
  pretensionMin: null,
  pretensionMax: null,
}

export const hayFiltroPuesto = (f: Filtros): boolean =>
  f.texto.trim() !== '' ||
  f.ciudades.length > 0 ||
  f.notaMin != null ||
  f.notaMax != null ||
  f.pretensionMin != null ||
  f.pretensionMax != null

/**
 * Los cuatro filtros de la barra, encima del corte que ya elige la botonera.
 *
 * ⚠️ **Un rango deja fuera a quien no declaró el dato, y es a propósito.** Una
 * fila sin nota no es «≥ 60»; una sin pretensión no cabe en ninguna banda. Lo
 * contrario —colarlos por si acaso— llena de huecos justo la lista que se pidió
 * recortar. Los vacíos vuelven quitando el filtro, que es un clic.
 *
 * ⚠️ **La pretensión se cruza contra lo que la persona DIJO, no contra lo que se
 * pueda deducir.** Quien declaró «2,000 a 3,000» sale si su rango toca la banda
 * buscada. Y **quien solo declaró un extremo cuenta como esa cifra a secas**, no
 * como una recta abierta: «desde 5,000» se cruza como 5,000, así que entra en
 * «hasta 6,000» y no en «desde 6,000». Es lo que dice el rótulo del control
 * —«sale quien pida algo dentro de esa banda»— y lo que se puede afirmar: leer
 * un «desde 5,000» como «acepta cualquier cosa por encima» es ponerle en la boca
 * al candidato una cifra que no escribió.
 */
export function filtrarFino(filas: FilaRanking[], filtros: Filtros): FilaRanking[] {
  const buscado = paraBuscar(filtros.texto)
  const porCiudad = new Set(filtros.ciudades)

  return filas.filter((fila) => {
    if (buscado !== '' && !paraBuscar(fila.candidato ?? '').includes(buscado)) return false

    if (porCiudad.size > 0) {
      const codigo = fila.ciudadCodigo ?? null
      if (codigo === null || !porCiudad.has(codigo)) return false
    }

    if (filtros.notaMin != null || filtros.notaMax != null) {
      const nota = fila.notaEtapa ?? null
      if (nota === null) return false
      if (filtros.notaMin != null && nota < filtros.notaMin) return false
      if (filtros.notaMax != null && nota > filtros.notaMax) return false
    }

    if (filtros.pretensionMin != null || filtros.pretensionMax != null) {
      const suyoMin = fila.pretensionMin ?? fila.pretensionMax ?? null
      const suyoMax = fila.pretensionMax ?? fila.pretensionMin ?? null
      if (suyoMin === null || suyoMax === null) return false
      if (filtros.pretensionMax != null && suyoMin > filtros.pretensionMax) return false
      if (filtros.pretensionMin != null && suyoMax < filtros.pretensionMin) return false
    }

    return true
  })
}

// ---------- Las ciudades que de verdad hay ----------

export interface CiudadDelRanking {
  codigo: string
  nombre: string
  cuantas: number
}

/**
 * Las ciudades presentes en la tanda, contadas.
 *
 * ⚠️ **Salen de las FILAS, nunca del catálogo de ubigeo.** El catálogo trae 196
 * provincias y hoy casi ninguna postulación tiene ciudad —solo se pide a quien
 * crea cuenta desde ahora—, así que un desplegable servido del catálogo
 * ofrecería ciento noventa y seis filtros que no devuelven a nadie. Es
 * exactamente «prometer lo que el sistema no cumple».
 *
 * ⚠️ **Y se calculan de las filas SIN filtrar.** Sobre las visibles, marcar una
 * ciudad haría desaparecer a las demás de la lista y no habría forma de añadir
 * la segunda.
 *
 * Una lista vacía es la señal de que todavía no hay ninguna: quien la pinta
 * tiene que decirlo con palabras, no enseñar un desplegable sin opciones.
 */
export function ciudadesDelRanking(filas: FilaRanking[]): CiudadDelRanking[] {
  const cuenta = new Map<string, CiudadDelRanking>()
  for (const fila of filas) {
    const codigo = fila.ciudadCodigo ?? null
    if (codigo === null) continue
    const ya = cuenta.get(codigo)
    if (ya) ya.cuantas += 1
    else cuenta.set(codigo, { codigo, nombre: fila.ciudad ?? codigo, cuantas: 1 })
  }
  return [...cuenta.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// ---------- Las columnas de la tabla ----------

export interface ColumnaDelRanking {
  clave: string
  /** Lo que se lee en la cabecera. Vacío en la casilla de avance. */
  titulo: string
  /** A la derecha y con `tabular-nums`. */
  cifra?: boolean
  /** Si se puede ordenar por ella, con qué clave. */
  ordenable?: ColumnaOrdenable
}

/**
 * Qué de lo nuevo trae de verdad esta tanda.
 *
 * ⚠️ **Las dos columnas nuevas pueden venir vacías enteras, y por motivos
 * distintos.** La ciudad, porque solo se le pide a quien crea su cuenta desde
 * ahora y ninguna postulación anterior la trae. La pretensión, porque viaja bajo
 * el permiso `ver_pretension` —que solo tiene DIRECCIÓN— y para todo el rol
 * TALENTO llega nula siempre.
 *
 * Una columna entera de guiones no es una columna: es una promesa incumplida que
 * además se lee al revés —«nadie pidió sueldo»—. Cuando no hay nada, la columna
 * no se pinta y se dice por qué.
 *
 * ⚠️ **La ciudad se detecta por el código además de por el nombre**: llegan de
 * dos consultas distintas y tener código no implica tener nombre.
 */
export interface QueTraeLaTanda {
  hayCiudad: boolean
  hayPretension: boolean
  /**
   * Si la petición pudo consultar la pretensión. Viaja DENTRO de esto y no
   * suelto porque `hayPretension: false` tiene dos causas opuestas y quien
   * pinte el aviso necesita las dos cosas a la vez, esté donde esté.
   */
  puedeVerPretension: boolean
}

/** Lo que se supone cuando nadie ha mirado las filas: que están las dos. */
const TRAE_TODO: QueTraeLaTanda = {
  hayCiudad: true,
  hayPretension: true,
  puedeVerPretension: true,
}

export const queTraeLaTanda = (
  filas: FilaRanking[],
  puedeVerPretension = true,
): QueTraeLaTanda => ({
  hayCiudad: filas.some((f) => f.ciudad != null || f.ciudadCodigo != null),
  hayPretension:
    puedeVerPretension &&
    filas.some((f) => f.pretensionMin != null || f.pretensionMax != null),
  puedeVerPretension,
})

/**
 * Por qué no hay ciudad en ninguna fila. El motivo se sabe entero.
 */
export const POR_QUE_NO_HAY_CIUDAD =
  'Todavía no hay ninguna ciudad en esta tanda: solo se le pide a quien crea su cuenta ' +
  'desde ahora, así que ninguna postulación anterior la trae.'

/**
 * Por qué no hay pretensión, dicho con el motivo exacto.
 *
 * Son dos motivos opuestos y el nulo por sí solo no los separa: el backend manda
 * nulo tanto cuando el candidato no declaró sueldo como cuando quien mira no
 * tiene el permiso `ver_pretension`. Por eso `RankingVacante.puedeVerPretension`
 * viaja: sin esa señal la frase tenía que nombrar los dos motivos sin afirmar
 * ninguno, y una pantalla que enumera hipótesis no está informando.
 */
export const porQueNoHayPretension = (puedeVerPretension: boolean): string =>
  puedeVerPretension
    ? 'Ninguno de estos candidatos declaró pretensión salarial. La columna no sale ' +
      'porque no hay nada que poner en ella, no porque esté oculta.'
    : 'Tu rol no puede ver la pretensión salarial —solo Dirección la ve, para que el ' +
      'sueldo no pese al calificar—. El dato ni se consultó: que no salga NO quiere ' +
      'decir que estos candidatos no pidieran sueldo.'

/**
 * Las columnas de la tabla, en su orden, y **la única fuente del `colSpan`**.
 *
 * ⚠️ De aquí sale el ancho de la fila de detalle y el de la celda del «no hay».
 * Estaba escrito a mano —un `8 : 6` sobre nueve y siete columnas reales— y ese
 * es justo el fallo que se repite cada vez que alguien añade una columna y no se
 * acuerda de sumar uno. Con la lista delante, `columnas.length` no se olvida —y
 * ahora además hay columnas que aparecen y desaparecen con los datos, que a mano
 * sería imposible de cuadrar.
 *
 * Ciudad y Pretensión van pegadas al candidato porque es lo que se lee junto al
 * decidir a quién llamar; el retrato del CV se queda donde estaba, y solo en las
 * dos etapas donde significa algo.
 */
export function columnasDelRanking(
  etapa: EtapaPanel,
  trae: QueTraeLaTanda = TRAE_TODO,
): ColumnaDelRanking[] {
  return [
    { clave: 'avance', titulo: '' },
    { clave: 'puesto', titulo: '#', cifra: true },
    { clave: 'candidato', titulo: 'Candidato', ordenable: 'nombre' },
    ...(trae.hayCiudad
      ? ([{ clave: 'ciudad', titulo: 'Ciudad', ordenable: 'ciudad' }] as ColumnaDelRanking[])
      : []),
    ...(trae.hayPretension
      ? ([
          { clave: 'pretension', titulo: 'Pretensión', cifra: true, ordenable: 'pretension' },
        ] as ColumnaDelRanking[])
      : []),
    { clave: 'nota', titulo: laEtapaDe(etapa).nota, cifra: true, ordenable: 'nota' },
    ...(esDelCurriculum(etapa)
      ? ([
          { clave: 'adecuacion', titulo: 'Adecuación', cifra: true },
          { clave: 'potencial', titulo: 'Potencial', cifra: true },
        ] as ColumnaDelRanking[])
      : []),
    { clave: 'riesgos', titulo: 'Riesgos', cifra: true },
    { clave: 'alertas', titulo: 'Alertas', cifra: true },
    { clave: 'estado', titulo: 'Estado' },
  ]
}

// ---------- El Excel ----------

/**
 * Las dos etapas que se exportan.
 *
 * Son las dos que tienen rúbrica con criterios que sostengan una hoja de
 * detalle. En Simulación, Validación y Decisión el botón no existe en vez de
 * salir y fallar con un 400: ofrecer una descarga que el servidor va a rechazar
 * es peor que no ofrecerla.
 */
export const seExportaAExcel = (etapa: EtapaPanel): boolean =>
  etapa === 'PERFIL_INTEGRAL' || etapa === 'PRUEBA_PUESTO'

const RANGO_DICHO = (min: number | null, max: number | null): string =>
  min != null && max != null ? `${min}–${max}` : min != null ? `≥ ${min}` : `≤ ${max}`

const ROTULO_DE_COLUMNA: Record<ColumnaOrdenable, string> = {
  nombre: 'Candidato',
  ciudad: 'Ciudad',
  nota: 'Nota',
  pretension: 'Pretensión',
}

/**
 * De qué recorte salió la hoja, en una frase que se lea dentro del Excel.
 *
 * ⚠️ **Lleva el corte de la botonera además de los filtros.** El corte es lo que
 * más filas quita —«Con nota del perfil» esconde a media tanda— y una hoja que
 * solo dijera «Ciudad: Lima» se leería como si trajera a todos los de Lima.
 *
 * ⚠️ **Y lleva el orden.** El backend escribe las filas en el orden que se le
 * manda y nada más; sin decirlo, quien abra la hoja dentro de un mes no sabrá si
 * ese orden significa algo.
 *
 * ⚠️ **Y dice si la columna de pretensión salió vacía, y por qué.** Es donde más
 * falta hace: la hoja se descarga, se reenvía y se abre fuera del panel, donde
 * ya no hay ninguna pantalla que pueda explicar que un blanco ahí puede ser un
 * permiso y no un candidato que no pidió sueldo.
 */
export function describirFiltro(
  etapa: EtapaPanel,
  vista: Vista,
  filtros: Filtros,
  orden: Orden | null,
  ciudades: CiudadDelRanking[],
  trae: QueTraeLaTanda = TRAE_TODO,
): string {
  const nombreDeCiudad = (codigo: string) =>
    ciudades.find((c) => c.codigo === codigo)?.nombre ?? codigo

  const partes = [
    laEtapaDe(etapa).nombre,
    rotuloDeVista(vista, etapa),
    filtros.texto.trim() !== '' ? `Nombre contiene «${filtros.texto.trim()}»` : null,
    filtros.ciudades.length > 0
      ? `Ciudad: ${filtros.ciudades.map(nombreDeCiudad).join(', ')}`
      : null,
    filtros.notaMin != null || filtros.notaMax != null
      ? `Nota ${RANGO_DICHO(filtros.notaMin, filtros.notaMax)}`
      : null,
    filtros.pretensionMin != null || filtros.pretensionMax != null
      ? `Pretensión ${RANGO_DICHO(filtros.pretensionMin, filtros.pretensionMax)}`
      : null,
    orden === null
      ? 'Orden del ranking (grupo de prioridad y nota)'
      : `Orden: ${ROTULO_DE_COLUMNA[orden.columna]}, ${orden.sentido === 'asc' ? 'de menor a mayor' : 'de mayor a menor'}`,
    trae.hayCiudad ? null : POR_QUE_NO_HAY_CIUDAD,
    trae.hayPretension ? null : porQueNoHayPretension(trae.puedeVerPretension),
  ]

  return partes.filter(Boolean).join(' · ')
}

