/**
 * El terreno de «Ver y ajustar el plazo de la prueba del puesto».
 *
 * ⚠️ **No toca las tres vacantes sembradas de la base.** Los demás specs las
 * buscan por su título y necesitan su plantilla y sus plazos tal cual; fijarles
 * una fecha de cierre o cambiarles el instrumento los rompería sin que nada lo
 * dijera. Aquí se siembra un terreno propio, reconocible por su marca, y se
 * retira entero al terminar.
 *
 * Lo que se siembra es exactamente lo que pide la «Verificación» de la spec:
 *
 *   · siete vacantes —PLAZO_ABIERTO con y sin fecha, CRONOMETRADA, cuestionario
 *     técnico, cerrada, sin instrumento elegido y una para el cambio de horario—;
 *   · una plantilla de prueba PLAZO_ABIERTO propia, porque la de la base es
 *     CRONOMETRADA y sin ella no hay forma de leer «N días»;
 *   · candidatos en cada estado: sin intento, sin empezar, en curso, entregado,
 *     con fecha propia, con la fecha del reloj y **sin fecha guardada** (el dato
 *     antiguo, que la ficha no puede leer como una avería);
 *   · una cuenta de panel que **ve** el plazo y no puede moverlo.
 *
 * ⚠️ **Las cifras del aviso previo dependen de cuántos se siembran.** Diez
 * exámenes abiertos, dos de ellos con fecha propia: son los 8 y los 2 del
 * AC-07, y cambiar la lista de abajo cambia lo que el panel tiene que decir.
 *
 * ⚠️ **La auditoría no se borra**: la base lo impide a propósito. Mover una
 * fecha SÍ audita, así que estas pruebas dejan filas que se quedan colgando de
 * un `entidad_id` que ya no existe. Es correcto y ninguna pantalla las lee.
 *
 * ⚠️ **`transicion_estado` tampoco se borra, y eso SÍ ata las manos.** Una
 * postulación con transiciones ya no se puede quitar —la clave ajena lo
 * impide y la fila es inmutable—, así que ninguna prueba de aquí puede dejar
 * que el barrido de vencidos cierre a alguien: el que abre «pegado a la fecha»
 * la tiene a **treinta minutos**, no a uno. Si algún día se acorta, la limpieza
 * empezará a fallar y no será un fallo de la limpieza.
 */

import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import { API } from './ayuda'
import { borrarCuentasDePrueba, crearCuentaDeCandidato } from './ayuda-candidato'
import { literal, sql } from './base-de-datos'

/** La marca que reconoce lo sembrado por estas pruebas, y solo lo suyo. */
export const MARCA = 'QA-PLAZO-E2E-7106'

/** El prefijo de los correos. La limpieza va por el correo entero, nunca por él. */
const PREFIJO = 'e2e.plazodelaprueba'

/**
 * El motivo que se escribe en cada cambio, **distinto en cada ejecución**.
 *
 * ⚠️ **La auditoría no se borra nunca** —la base impide el DELETE—, así que las
 * líneas de la corrida de ayer siguen ahí. Contar «cuántas veces se anotó este
 * motivo» con un texto fijo daría dos en la segunda ejecución y haría fallar
 * justo la prueba del doble clic, que es la que tiene que distinguir una
 * escritura de dos. Con la marca de la corrida, lo que se cuenta es lo de hoy.
 */
const CORRIDA = randomUUID().slice(0, 8)
export const motivoDe = (texto: string) => `QA-PLAZO-E2E-7106 · ${texto} · ${CORRIDA}`

/** La contraseña del portal, la misma que usan los demás specs. */
const CLAVE = 'unaClaveDePrueba123'

export const TITULOS = {
  CON_FECHA: `${MARCA} Plazo abierto con fecha`,
  SIN_FECHA: `${MARCA} Plazo abierto sin fecha`,
  CRONOMETRADA: `${MARCA} Cronometrada`,
  CUESTIONARIO: `${MARCA} Cuestionario tecnico`,
  CERRADA: `${MARCA} Cerrada`,
  SIN_INSTRUMENTO: `${MARCA} Sin instrumento`,
  HORARIO: `${MARCA} Cambio de horario`,
} as const

const NOMBRE_DE_LA_PLANTILLA = `${MARCA} Plantilla de plazo abierto`

/** La cuenta de panel que ve el plazo vigente y no puede moverlo. */
export const PANEL_SOLO_LECTURA = 'qa-plazo-7106-solo-lectura'
const ROL_SOLO_LECTURA = 'QA_PLAZO_7106_SOLO_LECTURA'

/**
 * La fecha de cierre de la convocatoria, fija y a las 23:59 de Lima.
 *
 * ⚠️ **Cae en otro día en UTC** (04:59 del 15), y es a propósito: es el caso
 * que convierte un `toISOString().slice(0, 16)` en un día de más en el campo y
 * el que hay que mirar para el AC-17.
 */
export const CIERRA_EN = '2027-03-15T04:59:00.000Z'

type Vence = 'VACANTE' | 'PROPIA' | 'PROPIA_2' | 'RELOJ' | 'NINGUNA'

interface Caso {
  clave: string
  nombre: string
  apellidos: string
  intento: { iniciado: boolean; vence: Vence; entregado: boolean; propio: boolean } | null
}

/** Los candidatos sembrados en la vacante de plazo abierto con fecha. */
export const CASOS: readonly Caso[] = [
  { clave: 'sinintento', nombre: 'Zqa Sin', apellidos: 'Intento', intento: null },
  {
    clave: 'sinempezar',
    nombre: 'Zqa Sin',
    apellidos: 'Empezar',
    intento: { iniciado: false, vence: 'VACANTE', entregado: false, propio: false },
  },
  {
    clave: 'encurso',
    nombre: 'Zqa En',
    apellidos: 'Curso',
    intento: { iniciado: true, vence: 'VACANTE', entregado: false, propio: false },
  },
  {
    clave: 'propio',
    nombre: 'Zqa Fecha',
    apellidos: 'Propia',
    intento: { iniciado: true, vence: 'PROPIA', entregado: false, propio: true },
  },
  {
    clave: 'propiodos',
    nombre: 'Zqa Fecha',
    apellidos: 'Propia Dos',
    intento: { iniciado: true, vence: 'PROPIA_2', entregado: false, propio: true },
  },
  {
    clave: 'entregado',
    nombre: 'Zqa Ya',
    apellidos: 'Entrego',
    intento: { iniciado: true, vence: 'VACANTE', entregado: true, propio: false },
  },
  {
    // El dato antiguo: `vence_en` nulo. La ficha tiene que decir «todavía no
    // tiene fecha», que no es lo mismo que un error.
    clave: 'antiguo',
    nombre: 'Zqa Dato',
    apellidos: 'Antiguo',
    intento: { iniciado: true, vence: 'NINGUNA', entregado: false, propio: false },
  },
  {
    // Empezó y su fecha no es la de la vacante: la calculó el reloj al abrir.
    clave: 'reloj',
    nombre: 'Zqa Por',
    apellidos: 'Reloj',
    intento: { iniciado: true, vence: 'RELOJ', entregado: false, propio: false },
  },
  ...(['Uno', 'Dos', 'Tres', 'Cuatro'] as const).map((n, i) => ({
    clave: `relleno${i + 1}`,
    nombre: 'Zqa Relleno',
    apellidos: n,
    intento: { iniciado: true, vence: 'VACANTE' as Vence, entregado: false, propio: false },
  })),
]

/** Los tres que estrenan la prueba cronometrada con fecha (AC-03b). */
export const DEL_RELOJ = [
  { clave: 'temprano', apellidos: 'Temprano' },
  { clave: 'cerca', apellidos: 'Cerca' },
  { clave: 'tarde', apellidos: 'Tarde' },
] as const

/** El que rinde el cuestionario técnico: su ficha no ofrece fecha por persona. */
export const DEL_CUESTIONARIO = 'cuestionario'

export type Clave = string

export interface Terreno {
  vacantes: Record<keyof typeof TITULOS, number>
  versionPlazoAbierto: number
  /** La versión CRONOMETRADA de la base: la que hace correr el reloj. */
  versionCronometrada: number
  /** El correo de cada caso, que es como se le busca y como se le borra. */
  correos: string[]
  /** El uuid de la postulación de cada uno: lo pide el portal. */
  uuids: Map<Clave, string>
  postulaciones: Map<Clave, number>
  /** El nombre visible en el ranking, para buscar su fila. */
  nombres: Map<Clave, string>
}

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) {
    throw new Error(`Se esperaba una sola fila y llegaron ${filas.length}: ${consulta}`)
  }
  return filas[0]!
}

/**
 * Un `insert … returning` leído como fila.
 *
 * Va en un CTE y no dentro de un `from (…)`: Postgres no admite una escritura
 * como subconsulta, y el error que da —«syntax error at or near INSERT»— no se
 * parece en nada a lo que pasa.
 */
function insertar(consulta: string): Fila {
  const filas = JSON.parse(
    sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`),
  ) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return filas[0]!
}

export const correoDe = (clave: Clave) => `${PREFIJO}.${clave}@example.com`

/** El instante fijo de la convocatoria, como expresión SQL. */
const CIERRA_SQL = `${literal(CIERRA_EN)}::timestamptz`

// ---------- sembrar ----------

/**
 * Deja el terreno como lo pide la spec, borrando antes lo que quedara de un
 * intento anterior: una prueba que solo pasa la primera vez no sirve de nada.
 */
export async function sembrarTerreno(): Promise<Terreno> {
  retirarLoSembrado()

  const base = uno(`select organizacion_id, solicitud_talento_id, puesto_id, version_pesos_id
                      from vacante order by id limit 1`)
  const responsable = Number(
    uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id,
  )
  const organizacion = Number(base.organizacion_id)

  /*
    La plantilla propia, y no una versión más de la que hay.

    ⚠️ Publicar otra versión bajo la plantilla sembrada la convertiría en «la
    publicada más reciente» y se la pondría encima a todo el que entre en la
    etapa técnica de las vacantes de los demás specs.
  */
  const plantilla = Number(
    insertar(`insert into plantilla_prueba (organizacion_id, puesto_id, nombre, es_activa)
              values (${organizacion}, ${base.puesto_id}, ${literal(NOMBRE_DE_LA_PLANTILLA)}, true)
              returning id`).id,
  )
  const version = Number(
    insertar(`insert into version_plantilla_prueba (plantilla_prueba_id, version, enunciado,
                                                    modalidad, plazo_dias, estado,
                                                    publicada_por_usuario_id, publicada_en)
              values (${plantilla}, 1, ${literal(`Sembrada por las pruebas de plazo (${MARCA}).`)},
                      'PLAZO_ABIERTO', 5, 'PUBLICADA', ${responsable}, now())
              returning id`).id,
  )
  const cronometrada = Number(
    uno(`select id from version_plantilla_prueba
          where modalidad = 'CRONOMETRADA' and estado = 'PUBLICADA' order by id limit 1`).id,
  )

  // título, estado, instrumento, minutos propios, versión, fecha de cierre
  const definiciones: [keyof typeof TITULOS, string, string, number | null, number | null, boolean][] =
    [
      ['CON_FECHA', 'PUBLICADA', 'PLANTILLA', null, version, true],
      ['SIN_FECHA', 'PUBLICADA', 'PLANTILLA', null, version, false],
      ['CRONOMETRADA', 'PUBLICADA', 'PLANTILLA', null, cronometrada, false],
      ['CUESTIONARIO', 'PUBLICADA', 'CUESTIONARIO_TECNICO', 45, null, false],
      ['CERRADA', 'CERRADA', 'PLANTILLA', null, version, true],
      ['SIN_INSTRUMENTO', 'PUBLICADA', 'PLANTILLA', null, null, false],
      ['HORARIO', 'PUBLICADA', 'PLANTILLA', null, version, false],
    ]

  const vacantes = {} as Record<keyof typeof TITULOS, number>
  for (const [clave, estado, instrumento, minutos, versionId, conFecha] of definiciones) {
    vacantes[clave] = Number(
      insertar(`insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo,
                                     descripcion, tipo_cierre, estado, version_pesos_id,
                                     responsable_usuario_id, aplica_evaluacion,
                                     instrumento_etapa_tecnica, minutos_etapa_tecnica,
                                     version_plantilla_prueba_id, prueba_cierra_en,
                                     remuneracion_tipo, publicada_en, cerrada_en)
                values (${organizacion}, ${base.solicitud_talento_id}, ${base.puesto_id},
                        ${literal(TITULOS[clave])},
                        ${literal(`Sembrada por las pruebas de plazo de la prueba del puesto (${MARCA}).`)},
                        'PERMANENTE', ${literal(estado)}, ${base.version_pesos_id}, ${responsable},
                        false, ${literal(instrumento)}, ${minutos === null ? 'null' : minutos},
                        ${versionId === null ? 'null' : versionId},
                        ${conFecha ? CIERRA_SQL : 'null'},
                        'OCULTA', now(), ${estado === 'CERRADA' ? 'now()' : 'null'})
                returning id`).id,
    )
  }

  const nombres = new Map<Clave, string>()
  const correos: string[] = []
  const alta = async (clave: Clave, nombre: string, apellidos: string) => {
    correos.push(correoDe(clave))
    nombres.set(clave, `${nombre} ${apellidos}`)
    await crearCuentaDeCandidato({ nombre, apellidos, correo: correoDe(clave), contrasena: CLAVE })
  }

  for (const caso of CASOS) await alta(caso.clave, caso.nombre, caso.apellidos)
  for (const caso of DEL_RELOJ) await alta(caso.clave, 'Zqa Reloj', caso.apellidos)
  await alta(DEL_CUESTIONARIO, 'Zqa Cuestionario', 'Tecnico')

  const enLista = (claves: readonly { clave: string }[]) =>
    claves.map((c) => literal(correoDe(c.clave))).join(', ')

  sql(`
    begin;
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
    select ${organizacion}, u.id, ${vacantes.CON_FECHA}, 'PRUEBA_POR_CONFIRMAR'
    from usuario u where u.correo in (${enLista(CASOS)});

    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
    select ${organizacion}, u.id, ${vacantes.CUESTIONARIO}, 'PRUEBA_POR_CONFIRMAR'
    from usuario u where u.correo = ${literal(correoDe(DEL_CUESTIONARIO))};

    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
    select ${organizacion}, u.id, ${vacantes.CRONOMETRADA}, 'PRUEBA_TURNO_CANDIDATO'
    from usuario u where u.correo in (${enLista(DEL_RELOJ)});
    commit;`)

  restaurarElTerreno(vacantes, version)

  const postulaciones = new Map<Clave, number>()
  const uuids = new Map<Clave, string>()
  for (const fila of consultar(`select u.correo, p.id, p.uuid from postulacion p
                                  join usuario u on u.id = p.usuario_id
                                 where u.correo like ${literal(`${PREFIJO}.%@example.com`)}`)) {
    const clave = String(fila.correo).slice(PREFIJO.length + 1).replace('@example.com', '')
    postulaciones.set(clave, Number(fila.id))
    uuids.set(clave, String(fila.uuid))
  }

  sembrarCuentaDePanel(organizacion)
  return {
    vacantes,
    versionPlazoAbierto: version,
    versionCronometrada: cronometrada,
    correos,
    uuids,
    postulaciones,
    nombres,
  }
}

/**
 * Devuelve la fecha de las convocatorias y los intentos a como nacieron.
 *
 * Se llama **antes de cada prueba**: fijar una fecha mueve los exámenes
 * abiertos de verdad, y la prueba siguiente se encontraría a «Zqa Dato Antiguo»
 * con la fecha que la anterior le acaba de poner. Un caso que solo existe hasta
 * que otra prueba lo pisa no comprueba nada.
 */
export function restaurarElTerreno(
  vacantes: Record<keyof typeof TITULOS, number>,
  version: number,
): void {
  const fechaDe = (cual: Vence) =>
    cual === 'VACANTE'
      ? CIERRA_SQL
      : cual === 'PROPIA'
        ? `(${CIERRA_SQL} + interval '2 days')`
        : cual === 'PROPIA_2'
          ? `(${CIERRA_SQL} + interval '3 days')`
          : cual === 'RELOJ'
            ? "(now() + interval '3 hours')"
            : 'null'

  const valores = CASOS.filter((c) => c.intento !== null)
    .map((c) => {
      const i = c.intento!
      return `(${literal(correoDe(c.clave))}, ${i.iniciado ? "(now() - interval '2 hours')" : 'null'}::timestamptz, ${fechaDe(i.vence)}::timestamptz, ${i.entregado ? "(now() - interval '1 hour')" : 'null'}::timestamptz, ${i.propio})`
    })
    .join(',\n      ')

  sql(`
    begin;
    update vacante set prueba_cierra_en = ${CIERRA_SQL}
      where id in (${vacantes.CON_FECHA}, ${vacantes.CERRADA});
    update vacante set prueba_cierra_en = null
      where id in (${vacantes.SIN_FECHA}, ${vacantes.CRONOMETRADA}, ${vacantes.HORARIO});

    delete from intento_prueba where postulacion_id in (
      select id from postulacion where vacante_id in (${vacantes.CON_FECHA}, ${vacantes.CRONOMETRADA}));

    insert into intento_prueba (postulacion_id, version_plantilla_prueba_id, iniciado_en,
                                vence_en, entregado_en, es_entrega_automatica, plazo_propio)
    select p.id, ${version}, c.iniciado, c.vence, c.entregado, false, c.propio
    from postulacion p
    join usuario u on u.id = p.usuario_id
    join (values
      ${valores}
    ) as c(correo, iniciado, vence, entregado, propio) on c.correo = u.correo;
    commit;`)
}

/**
 * Los tres de la prueba cronometrada, con su fecha puesta respecto a AHORA.
 *
 * Van aparte porque son relativos al reloj de verdad —uno abre con la fecha
 * lejos, otro a diez minutos y al tercero ya se le pasó— y eso no se puede
 * sembrar una vez para toda la sesión.
 */
export function prepararElReloj(vacanteCronometrada: number, version: number): void {
  sql(`
    begin;
    update vacante set prueba_cierra_en = ${CIERRA_SQL} where id = ${vacanteCronometrada};
    delete from intento_prueba where postulacion_id in (
      select id from postulacion where vacante_id = ${vacanteCronometrada});
    insert into intento_prueba (postulacion_id, version_plantilla_prueba_id, vence_en,
                                es_entrega_automatica, plazo_propio)
    select p.id, ${version}, c.vence, false, false
    from postulacion p join usuario u on u.id = p.usuario_id
    join (values
      (${literal(correoDe('temprano'))}, ${CIERRA_SQL}),
      (${literal(correoDe('cerca'))}, (now() + interval '30 minutes')::timestamptz),
      (${literal(correoDe('tarde'))}, (now() - interval '1 minute')::timestamptz)
    ) as c(correo, vence) on c.correo = u.correo;
    commit;`)
}

/**
 * La cuenta de panel que **ve** el plazo vigente y no puede moverlo.
 *
 * Lleva `ver_vacantes`, `abrir_ficha_candidato` y `ver_embudo` —las tres de
 * leer— y ninguna de las dos de mover (`elegir_plantilla_prueba` en la vacante,
 * `mover_postulacion` en la persona). Sin `ver_embudo` no llegaría siquiera al
 * ranking, y la mitad del caso quedaría sin mirar.
 */
function sembrarCuentaDePanel(organizacionId: number): void {
  const rol = Number(
    insertar(`insert into rol (organizacion_id, codigo, nombre, descripcion)
              values (${organizacionId}, ${literal(ROL_SOLO_LECTURA)},
                      'QA · ve el plazo, no lo mueve',
                      'Sembrado por las pruebas de plazo de la prueba del puesto')
              returning id`).id,
  )
  const persona = Number(
    insertar(`insert into persona (nombre, apellidos)
              values ('QA', ${literal(PANEL_SOLO_LECTURA)}) returning id`).id,
  )
  sql(`
    begin;
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rol}, id, 'TODO' from permiso
    where codigo in ('ver_vacantes', 'abrir_ficha_candidato', 'ver_embudo');
    insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
    values (${organizacionId}, ${persona}, ${literal(PANEL_SOLO_LECTURA)}, true, true);
    insert into usuario_rol (usuario_id, rol_id)
    select id, ${rol} from usuario where usuario_renaser_os_id = ${literal(PANEL_SOLO_LECTURA)};
    commit;`)
}

// ---------- entrar y pedir ----------

/** El token de panel de la cuenta que se le diga. */
export async function tokenDePanelDe(renaserOsId: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status}`)
  return (await r.json()).token as string
}

/** Siembra el token ANTES de que arranque la app, como `entrarAlPanel`. */
export async function entrarAlPanelComo(page: Page, renaserOsId: string): Promise<void> {
  const token = await tokenDePanelDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

/** El token del portal de un candidato sembrado. */
export async function tokenDelCandidatoDe(clave: Clave): Promise<string> {
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correoDe(clave), contrasena: CLAVE }),
  })
  if (!r.ok) throw new Error(`login del portal de ${clave} falló: ${r.status}`)
  return (await r.json()).token as string
}

/** Una llamada a la API con el token que se le diga. Devuelve estado y cuerpo. */
export async function pedir(
  camino: string,
  opciones: { metodo?: string; cuerpo?: unknown; token?: string } = {},
): Promise<{ estado: number; cuerpo: Record<string, unknown> | string | null }> {
  const token = opciones.token ?? (await tokenDePanelDe('dev-equipo'))
  const r = await fetch(`${API}${camino}`, {
    method: opciones.metodo ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  })
  const texto = await r.text()
  let cuerpo: Record<string, unknown> | string | null = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: r.status, cuerpo }
}

// ---------- leer la base ----------

export const venceEnDe = (clave: Clave): string | null => {
  const valor = uno(`select i.vence_en from intento_prueba i
                       join postulacion p on p.id = i.postulacion_id
                       join usuario u on u.id = p.usuario_id
                      where u.correo = ${literal(correoDe(clave))}`).vence_en
  return valor === null ? null : String(valor)
}

export const plazoPropioDe = (clave: Clave): boolean =>
  // `json_agg` devuelve el booleano de Postgres como `true`/`false` de JSON, y
  // `Fila` lo tipa como cualquier otro valor: se normaliza aquí y no en cada
  // afirmación, que es donde se colaría un `'false'` leído como cierto.
  String(
    uno(`select i.plazo_propio from intento_prueba i
           join postulacion p on p.id = i.postulacion_id
           join usuario u on u.id = p.usuario_id
          where u.correo = ${literal(correoDe(clave))}`).plazo_propio,
  ) === 'true'

export const pruebaCierraEnDe = (vacanteId: number): string | null => {
  const valor = uno(`select prueba_cierra_en from vacante where id = ${vacanteId}`).prueba_cierra_en
  return valor === null ? null : String(valor)
}

/** Las líneas de auditoría que dejó un motivo exacto, con su antes y su después. */
export const auditoriaDe = (motivo: string): Fila[] =>
  consultar(`select accion, entidad, valor_anterior::text as anterior,
                    valor_nuevo::text as nuevo
               from auditoria where motivo = ${literal(motivo)} order by id`)

// ---------- lo que la pantalla tiene que pintar ----------

/**
 * Un instante, tal y como lo escribe el campo `datetime-local` en esa zona.
 *
 * ⚠️ **Se arma con `Intl` y no con la función del panel.** Comprobar la pantalla
 * con su propia cuenta no comprueba nada: si `aCampoLocal` volviera al
 * `toISOString().slice(0, 16)` que pinta el reloj de UTC, las dos se
 * equivocarían igual y la prueba pasaría.
 */
export function campoLocal(iso: string, zona: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(' ', 'T')
}

/** El día y la hora como los dice el panel: «domingo, 14 de marzo · 23:59». */
export function fechaLarga(iso: string, zona: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('es-PE', {
    timeZone: zona,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const hora = d.toLocaleTimeString('es-PE', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${dia} · ${hora}`
}

// ---------- retirar ----------

/**
 * Quita lo sembrado y nada más: las vacantes y la plantilla por su marca, las
 * cuentas de candidato por su correo exacto y la de panel por su id.
 *
 * Se llama también ANTES de sembrar: si una ejecución murió a mitad, la
 * siguiente no puede encontrarse el terreno a medio poner.
 */
export function retirarLoSembrado(): void {
  const huerfanos = consultar(
    `select correo from usuario where correo like ${literal(`${PREFIJO}.%@example.com`)}`,
  ).map((f) => String(f.correo))
  if (huerfanos.length) borrarCuentasDePrueba(huerfanos)

  const sembradas = consultar(
    `select id from vacante where titulo like ${literal(`${MARCA}%`)}`,
  ).map((f) => Number(f.id))
  if (sembradas.length) {
    const ids = sembradas.join(',')
    sql(`
      begin;
      delete from intento_prueba where postulacion_id in (
        select id from postulacion where vacante_id in (${ids}));
      delete from aviso_portal where vacante_id in (${ids});
      delete from postulacion where vacante_id in (${ids});
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from plantilla_correo_vacante where vacante_id in (${ids});
      delete from ficha_vacante where vacante_id in (${ids});
      delete from vacante where id in (${ids});
      commit;`)
  }

  sql(`
    begin;
    delete from version_plantilla_prueba where plantilla_prueba_id in (
      select id from plantilla_prueba where nombre = ${literal(NOMBRE_DE_LA_PLANTILLA)});
    delete from plantilla_prueba where nombre = ${literal(NOMBRE_DE_LA_PLANTILLA)};
    delete from usuario_rol where usuario_id in (
      select id from usuario where usuario_renaser_os_id = ${literal(PANEL_SOLO_LECTURA)});
    delete from usuario where usuario_renaser_os_id = ${literal(PANEL_SOLO_LECTURA)};
    delete from persona where apellidos = ${literal(PANEL_SOLO_LECTURA)};
    delete from rol_permiso where rol_id in (
      select id from rol where codigo = ${literal(ROL_SOLO_LECTURA)});
    delete from rol where codigo = ${literal(ROL_SOLO_LECTURA)};
    commit;`)
}
