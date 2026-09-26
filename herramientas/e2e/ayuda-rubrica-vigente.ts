import { execFileSync } from 'node:child_process'

import { API, tokenDelPanel } from './ayuda'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { borrarCuentasDePrueba } from './limpieza-cuentas'

/**
 * El terreno de «el Excel de la prueba del puesto usa la prueba vigente».
 *
 * ⚠️ **La mezcla no se puede fabricar por la API**: desde el 27/08 una vacante con
 * postulantes no puede cambiar de prueba. Así que se siembra directamente en la
 * base del clon, igual que llegó a producción antes de esa regla: la vacante tuvo
 * puesta la demo (B), dos personas la abrieron, y después pasó a la de
 * Administrador (A), que una tercera rindió entera.
 *
 * Todo lo sembrado lleva la marca en el título de la vacante y en el nombre de la
 * plantilla, y las cuentas un prefijo de correo propio: la limpieza quita eso y
 * nada más. Se llama también ANTES de sembrar, por si una ejecución murió a mitad.
 */

export const MARCA = 'QA-RUBRICA-180F'
const TEXTO_SEMBRADO = 'Sembrada por las pruebas de la rúbrica vigente en el Excel'

/** La prueba de Administrador de la vacante 13, tal como está en producción. */
export const ADMINISTRADOR: readonly (readonly [string, string, string])[] = [
  ['EXPERIENCIA', 'Experiencia y magnitud de lo administrado', '15'],
  ['CAJA', 'Manejo y control de caja', '20'],
  ['DIVISAS', 'Conocimiento del negocio de divisas', '15'],
  ['SEDES', 'Supervisión de múltiples sedes', '15'],
  ['PERSONAL', 'Gestión de personal', '15'],
  ['FINANZAS', 'Coordinación contable y financiera', '10'],
  ['OBJETIVOS', 'Orientación a resultados y plan de crecimiento', '10'],
]

/** La «Prueba de ejecución · demo» que siembra scripts/sembrar-datos-de-prueba.py. */
export const DEMO: readonly (readonly [string, string, string])[] = [
  ['CRITERIO', 'Criterio de priorización', '40'],
  ['DESCARTE', 'Qué deja fuera', '25'],
  ['CLARIDAD', 'Claridad', '20'],
  ['REACCION', 'Reacción al cambio', '15'],
]

/** Una rúbrica de una sola versión: todos la rindieron. */
export const CAJERO: readonly (readonly [string, string, string])[] = [
  ['CAJA', 'Manejo y control de caja', '60'],
  ['DIVISAS', 'Conocimiento del negocio de divisas', '40'],
]

/**
 * Un rótulo que pasa de las 8 líneas en 14 de ancho, y dos criterios homónimos que solo
 * distingue su código: la cabecera se queda en 8 líneas y los homónimos se desambiguan como hoy.
 */
export const DESMESURADO = `${'Capacidad demostrada para sostener la operación '.repeat(12).trim()}`
export const RARA: readonly (readonly [string, string, string])[] = [
  ['LARGO', DESMESURADO, '60'],
  ['CLARIDAD_A', 'Claridad', '20'],
  ['CLARIDAD_B', 'Claridad', '20'],
]

/** Las notas de Ana en la vigente, en el orden de la rúbrica. Una es un 0: sigue siendo nota. */
export const NOTAS_DE_ANA = ['12', '18', '0', '11', '13', '8', '9'] as const

/** Las de Bruno en la demo, con su explicación. También lleva un 0. */
export const NOTAS_DE_BRUNO: readonly (readonly [string, string, string])[] = [
  ['CRITERIO', '30', 'Ordena por impacto y dice por qué'],
  ['DESCARTE', '20', 'Nombra lo que no atiende'],
  ['CLARIDAD', '0', 'Se pierde en el detalle'],
  ['REACCION', '10', 'Rehace el orden'],
]

export const rotulo = ([, nombre, puntos]: readonly [string, string, string]) => `${nombre} (pts /${puntos})`

export interface Persona {
  nombre: string
  correo: string
  postulacionId: number
}

export interface Terreno {
  marca: string
  /** Vigente A; Bruno y Carla abrieron B; Ana rindió A; Diego no abrió nada. */
  mezclada: number
  /** Una sola versión: los dos la rindieron. */
  unaVersion: number
  /** Rinde el cuestionario técnico aunque conserve una versión puesta de antes. */
  cuestionario: number
  /** Su vigente tiene un rótulo desmesurado y dos criterios homónimos. */
  desmesurada: number
  /** Con prueba vigente y nadie que la haya abierto todavía. */
  recienAbierta: number
  ana: Persona
  bruno: Persona
  carla: Persona
  diego: Persona
  eva: Persona
  fede: Persona
  gina: Persona
  hugo: Persona
  iris: Persona
  versionA: number
  versionB: number
  correos: string[]
}

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una sola fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

/** Un INSERT … RETURNING id: psql en modo -q -A -t devuelve solo el id. */
function insertar(consulta: string): number {
  const id = Number(sql(`${consulta};`).split('\n')[0])
  if (!Number.isInteger(id) || id <= 0) throw new Error(`El INSERT no devolvió un id: ${consulta}`)
  return id
}

const prefijoDe = (marca: string) => `e2e.${marca.toLowerCase().replace(/[^a-z0-9]/g, '')}`

export function sembrarTerreno(marca: string = MARCA): Terreno {
  retirarLoSembrado(marca)

  const base = uno(`select solicitud_talento_id, puesto_id, version_pesos_id, organizacion_id
                      from vacante where eliminada_en is null order by id limit 1`)
  const responsable = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  const organizacion = Number(base.organizacion_id)
  const prefijo = prefijoDe(marca)

  const versionB = version(marca, organizacion, Number(base.puesto_id), 'Prueba de ejecución · demo', DEMO)
  const versionA = version(marca, organizacion, Number(base.puesto_id), 'Prueba de Administrador', ADMINISTRADOR)
  const versionCajero = version(marca, organizacion, Number(base.puesto_id), 'Prueba de cajero', CAJERO)

  // La vacante 13 en pequeño: tuvo la demo, dos la abrieron, y pasó a la de Administrador.
  const mezclada = vacante(marca, base, responsable, `${marca} Administrador de sede · mezclada`, versionB.id)
  const bruno = candidato(organizacion, mezclada, 'Bruno', 'Díaz Rúbrica', prefijo)
  rindio(bruno.postulacionId, versionB.id)
  for (const [codigo, puntaje, explicacion] of NOTAS_DE_BRUNO) {
    nota(bruno.postulacionId, versionB.criterios[codigo]!, puntaje, explicacion)
  }
  const carla = candidato(organizacion, mezclada, 'Carla', 'Núñez Rúbrica', prefijo)
  rindio(carla.postulacionId, versionB.id)
  ponerLaPrueba(mezclada, versionA.id)
  const ana = candidato(organizacion, mezclada, 'Ana', 'Quispe Rúbrica', prefijo)
  rindio(ana.postulacionId, versionA.id)
  ADMINISTRADOR.forEach(([codigo], i) =>
    nota(ana.postulacionId, versionA.criterios[codigo]!, NOTAS_DE_ANA[i]!, `Lo sostiene con ejemplos ${i + 1}`))
  const diego = candidato(organizacion, mezclada, 'Diego', 'Rojas Rúbrica', prefijo)

  // Una sola versión: el archivo tiene que salir como siempre.
  const unaVersion = vacante(marca, base, responsable, `${marca} Cajero · una sola versión`, versionCajero.id)
  const eva = candidato(organizacion, unaVersion, 'Eva', 'Luna Rúbrica', prefijo)
  rindio(eva.postulacionId, versionCajero.id)
  nota(eva.postulacionId, versionCajero.criterios.CAJA!, '50', 'Cuadra la caja sin diferencias')
  nota(eva.postulacionId, versionCajero.criterios.DIVISAS!, '30', 'Conoce el tipo de cambio')
  const fede = candidato(organizacion, unaVersion, 'Fede', 'Paz Rúbrica', prefijo)
  rindio(fede.postulacionId, versionCajero.id)
  nota(fede.postulacionId, versionCajero.criterios.CAJA!, '45', 'Cuadra con una diferencia')

  // El cuestionario técnico: el instrumento manda, no la versión que quedó puesta.
  const cuestionario = vacante(marca, base, responsable, `${marca} Analista · cuestionario técnico`, versionA.id)
  sql(`update vacante set instrumento_etapa_tecnica = 'CUESTIONARIO_TECNICO' where id = ${cuestionario};`)
  const gina = candidato(organizacion, cuestionario, 'Gina', 'Soto Rúbrica', prefijo)

  // Un rótulo que no cabe ni en 8 líneas y dos «Claridad» que solo separa el código.
  const versionRara = version(marca, organizacion, Number(base.puesto_id), 'Prueba desmesurada', RARA)
  const desmesurada = vacante(marca, base, responsable, `${marca} Rótulo desmesurado`, versionRara.id)
  const hugo = candidato(organizacion, desmesurada, 'Hugo', 'Vela Rúbrica', prefijo)
  rindio(hugo.postulacionId, versionRara.id)
  nota(hugo.postulacionId, versionRara.criterios.LARGO!, '40', 'Sostiene la operación')
  nota(hugo.postulacionId, versionRara.criterios.CLARIDAD_A!, '15', 'Claro por escrito')
  nota(hugo.postulacionId, versionRara.criterios.CLARIDAD_B!, '0', 'Confuso de palabra')

  // Con la de Administrador puesta y nadie que la haya abierto: sus columnas salen igual, vacías.
  const recienAbierta = vacante(marca, base, responsable, `${marca} Administrador de sede · recién abierta`, versionA.id)
  const iris = candidato(organizacion, recienAbierta, 'Iris', 'Mena Rúbrica', prefijo)

  return {
    marca, mezclada, unaVersion, cuestionario, desmesurada, recienAbierta,
    ana, bruno, carla, diego, eva, fede, gina, hugo, iris,
    versionA: versionA.id, versionB: versionB.id,
    correos: [ana, bruno, carla, diego, eva, fede, gina, hugo, iris].map((p) => p.correo),
  }
}

function version(marca: string, organizacion: number, puesto: number, nombre: string,
                 rubrica: readonly (readonly [string, string, string])[]): { id: number; criterios: Record<string, number> } {
  const plantilla = insertar(`insert into plantilla_prueba (organizacion_id, puesto_id, nombre)
                              values (${organizacion}, ${puesto}, ${literal(`${marca} ${nombre}`)}) returning id`)
  const id = insertar(`insert into version_plantilla_prueba (plantilla_prueba_id, version, enunciado, modalidad,
                                                             plazo_dias, estado, publicada_en)
                       values (${plantilla}, 1, ${literal(TEXTO_SEMBRADO)}, 'PLAZO_ABIERTO', 3, 'PUBLICADA', now())
                       returning id`)
  // Al revés y con su orden bien puesto: unas columnas que salieran por id y no por
  // orden quedarían al revés y se notaría.
  const criterios: Record<string, number> = {}
  for (let i = rubrica.length - 1; i >= 0; i--) {
    const [codigo, nombreCriterio, puntos] = rubrica[i]!
    criterios[codigo] = insertar(`insert into criterio (codigo, nombre, etapa_codigo, version_plantilla_prueba_id,
                                                        puntos, metodo_verificacion, orden)
                                  values (${literal(codigo)}, ${literal(nombreCriterio)}, 'PRUEBA_PUESTO', ${id},
                                          ${puntos}, 'AGENTE', ${i + 1}) returning id`)
  }
  return { id, criterios }
}

function vacante(marca: string, base: Fila, responsable: number, titulo: string, version: number): number {
  const solicitud = insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                   nivel_puesto_codigo, familia_codigo, resultado_principal, motivo,
                                   consecuencia_no_contratar, analisis_capacidad, responsable_usuario_id)
    select s.organizacion_id, s.origen, s.urgencia, 'CON_VACANTE', s.area_id, s.puesto_id,
           s.nivel_puesto_codigo, s.familia_codigo, ${literal(TEXTO_SEMBRADO)}, ${literal(`${marca} ${TEXTO_SEMBRADO}`)},
           ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${responsable}
    from solicitud_talento s where s.id = ${base.solicitud_talento_id}
    returning id`)
  return insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion, tipo_cierre,
                         estado, version_pesos_id, responsable_usuario_id, aplica_evaluacion,
                         instrumento_etapa_tecnica, remuneracion_tipo, publicada_en, version_plantilla_prueba_id)
    values (${base.organizacion_id}, ${solicitud}, ${base.puesto_id}, ${literal(titulo)}, ${literal(TEXTO_SEMBRADO)},
            'PERMANENTE', 'PUBLICADA', ${base.version_pesos_id}, ${responsable}, false, 'PLANTILLA', 'OCULTA',
            now(), ${version})
    returning id`)
}

/** Lo que la ficha de la vacante dice hoy: se escribe a mano, como llegó en producción. */
function ponerLaPrueba(vacanteId: number, version: number): void {
  sql(`update vacante set version_plantilla_prueba_id = ${version}, instrumento_etapa_tecnica = 'PLANTILLA'
        where id = ${vacanteId};`)
}

function candidato(organizacion: number, vacanteId: number, nombre: string, apellidos: string,
                   prefijo: string): Persona {
  const correo = correoDePrueba(prefijo)
  const persona = insertar(`insert into persona (nombre, apellidos) values (${literal(nombre)}, ${literal(apellidos)})
                            returning id`)
  const usuario = insertar(`insert into usuario (organizacion_id, persona_id, correo, es_equipo, es_activo)
                            values (${organizacion}, ${persona}, ${literal(correo)}, false, true) returning id`)
  const postulacionId = insertar(`insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
                                  values (${organizacion}, ${usuario}, ${vacanteId}, 'PRUEBA_POR_CONFIRMAR')
                                  returning id`)
  return { nombre: `${nombre} ${apellidos}`, correo, postulacionId }
}

/** Abrió su prueba con esa versión y la entregó: queda atado a ella (RF-90). */
function rindio(postulacion: number, version: number): void {
  sql(`insert into intento_prueba (postulacion_id, version_plantilla_prueba_id, iniciado_en, entregado_en)
       values (${postulacion}, ${version}, now() - interval '2 days', now() - interval '1 day');`)
}

function nota(postulacion: number, criterio: number, puntaje: string, explicacion: string): void {
  sql(`insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen)
       values (${postulacion}, ${criterio}, ${puntaje}, ${literal(explicacion)}, 'AGENTE');`)
}

/**
 * Quita lo sembrado con esa marca y nada más: las cuentas por su prefijo de correo,
 * las vacantes y solicitudes por la marca, y las plantillas por su nombre.
 */
export function retirarLoSembrado(marca: string = MARCA, correos: readonly string[] = []): void {
  const prefijo = prefijoDe(marca)
  const huerfanos = consultar(`select correo from usuario where correo like ${literal(`${prefijo}.%@example.com`)}`)
    .map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  const sembradas = consultar(`select id from vacante where titulo like ${literal(`${marca} %`)}`)
  if (sembradas.length) {
    const ids = sembradas.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from plantilla_correo_vacante where vacante_id in (${ids});
      delete from ficha_vacante where vacante_id in (${ids});
      delete from sesion_vacante where vacante_id in (${ids});
      delete from vacante where id in (${ids})
         and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
      commit;`)
  }
  sql(`delete from solicitud_talento
        where motivo = ${literal(`${marca} ${TEXTO_SEMBRADO}`)}
          and not exists (select 1 from vacante v where v.solicitud_talento_id = solicitud_talento.id);`)

  // Las plantillas, solo si ya no las usa nada: ni una vacante ni un intento.
  sql(`
    begin;
    create temporary table qa_versiones on commit drop as
      select v.id from version_plantilla_prueba v join plantilla_prueba p on p.id = v.plantilla_prueba_id
       where p.nombre like ${literal(`${marca} %`)}
         and not exists (select 1 from vacante x where x.version_plantilla_prueba_id = v.id)
         and not exists (select 1 from intento_prueba i where i.version_plantilla_prueba_id = v.id);
    delete from criterio where version_plantilla_prueba_id in (select id from qa_versiones);
    delete from version_plantilla_prueba where id in (select id from qa_versiones);
    delete from plantilla_prueba p where p.nombre like ${literal(`${marca} %`)}
       and not exists (select 1 from version_plantilla_prueba v where v.plantilla_prueba_id = p.id);
    commit;`)
}

// ---------- mirar ----------

/** Todo lo que una descarga podría tocar, en una línea que se compara antes y después. */
export function fotoDeLaBase(vacantes: readonly number[]): string {
  const ids = vacantes.join(',')
  return sql(`
    select (select count(*) from nota_etapa) || '/' || (select count(*) from nota_criterio) || '/' ||
           (select coalesce(sum(puntaje), 0) from nota_criterio) || '/' || (select count(*) from intento_prueba) || '/' ||
           (select count(*) from auditoria) || '/' || (select count(*) from transicion_estado) || '/' ||
           (select count(*) from trabajo_ia) || '/' || (select count(*) from criterio) || '/' ||
           (select string_agg(p.id::text || p.estado_codigo || coalesce(p.movido_en::text, ''), ',' order by p.id)
              from postulacion p where p.vacante_id in (${ids})) || '/' ||
           (select string_agg(v.id::text || coalesce(v.version_plantilla_prueba_id, 0)::text || v.instrumento_etapa_tecnica
                              || v.estado || coalesce(v.cerrada_en::text, '') || coalesce(v.archivada_en::text, ''),
                              ',' order by v.id)
              from vacante v where v.id in (${ids}));`)
}

// ---------- el archivo ----------

export interface Libro {
  hojas: string[]
  cabeceras: string[]
  /** Las filas de candidatos, como se leen: enteros sin «.0». */
  filas: string[][]
  pie: string[]
  /** La fila 1 tal como va escrita en el XML de la hoja. */
  alturaCabecera: number | null
  alturaEscrita: boolean
  /** Anchos por columna, en el orden de las columnas. */
  anchos: number[]
  /** La celda desde la que se congela, p. ej. «A2». */
  congelada: string | null
}

/**
 * La hoja leída de verdad: los valores con openpyxl y la fila 1, los anchos y el
 * panel fijo del XML crudo, que es lo que abre Excel o LibreOffice.
 */
export function leerElLibro(ruta: string): Libro {
  const salida = execFileSync('python3', ['-c', `
import json, re, sys, warnings, zipfile
import xml.etree.ElementTree as ET
import openpyxl
warnings.simplefilter('ignore')
ruta = sys.argv[1]
libro = openpyxl.load_workbook(ruta, data_only=True)
hoja = libro.worksheets[0]
def visible(c):
    if c is None:
        return ''
    if isinstance(c, float) and c.is_integer():
        return str(int(c))
    return str(c)
tabla = [[visible(c) for c in f] for f in hoja.iter_rows(values_only=True)]
cabeceras = tabla[0]
filas, pie, en_pie = [], [], False
for f in tabla[1:]:
    if not en_pie and any(c.strip() for c in f):
        filas.append(f)
        continue
    en_pie = True
    pie.extend(c for c in f if c.strip())
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(ruta) as z:
    nombre = [n for n in z.namelist() if re.match(r'xl/worksheets/sheet\\d+\\.xml$', n)][0]
    raiz = ET.fromstring(z.read(nombre))
fila1 = raiz.find('.//s:sheetData/s:row[@r="1"]', ns)
anchos = {}
for col in raiz.findall('.//s:cols/s:col', ns):
    for i in range(int(col.get('min')), int(col.get('max')) + 1):
        anchos[i] = float(col.get('width'))
panel = raiz.find('.//s:sheetView/s:pane', ns)
print(json.dumps({
    'hojas': libro.sheetnames,
    'cabeceras': cabeceras,
    'filas': filas,
    'pie': pie,
    'alturaCabecera': float(fila1.get('ht')) if fila1 is not None and fila1.get('ht') else None,
    'alturaEscrita': fila1 is not None and fila1.get('customHeight') in ('1', 'true'),
    'anchos': [anchos.get(i + 1) for i in range(len(cabeceras))],
    'congelada': panel.get('topLeftCell') if panel is not None and panel.get('state') == 'frozen' else None,
}, ensure_ascii=False))
`, ruta])
  return JSON.parse(salida.toString()) as Libro
}

/** El Excel pedido directamente a la API, con la lista de postulaciones ya ordenada. */
export async function excelPorLaApi(vacanteId: number, etapa: 'PRUEBA_PUESTO' | 'PERFIL_INTEGRAL',
                                    postulaciones: number[]): Promise<Buffer> {
  const r = await fetch(`${API}/panel/vacantes/${vacanteId}/ranking/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenDelPanel()}` },
    body: JSON.stringify({ etapa, postulacionIds: postulaciones, filtroDescrito: 'Todos' }),
  })
  if (!r.ok) throw new Error(`El Excel de ${vacanteId}/${etapa} respondió ${r.status}: ${await r.text()}`)
  return Buffer.from(await r.arrayBuffer())
}

export interface NotaDelRanking { criterio: string; codigo: string | null; puntaje: number | null; maximo: number | null }
export interface FilaDelRanking { postulacionId: number; notasCriterio: NotaDelRanking[] }

export async function rankingPorLaApi(vacanteId: number, etapa: 'PRUEBA_PUESTO' | 'PERFIL_INTEGRAL'):
  Promise<{ campos: string[]; filas: FilaDelRanking[] }> {
  const r = await fetch(`${API}/panel/vacantes/${vacanteId}/ranking?etapa=${etapa}`, {
    headers: { Authorization: `Bearer ${await tokenDelPanel()}` },
  })
  if (!r.ok) throw new Error(`El ranking de ${vacanteId}/${etapa} respondió ${r.status}`)
  const cuerpo = await r.json()
  return { campos: Object.keys(cuerpo), filas: cuerpo.filas }
}
