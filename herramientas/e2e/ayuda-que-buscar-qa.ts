/**
 * El terreno de la QA de «Qué buscar en el CV» (V80, specs/que-buscar-en-el-cv), además del de
 * `ayuda-que-buscar.ts`:
 *
 *   - una solicitud aprobada para crear la vacante desde el formulario;
 *   - una vacante publicada con dos candidatos calificados (los ayudantes de la V74) y dos
 *     versiones de pesos iguales salvo el de «Qué buscar en el CV» (25 y 30);
 *   - lo que la IA habría encontrado, sembrado con SQL: en el preview la IA está apagada.
 *
 * Todo lleva la marca `QA-QB-80` y `retirarLoDeLaQa` lo quita sin tocar nada ajeno.
 */

import { execFileSync } from 'node:child_process'

import { API, tokenDelPanel } from './ayuda'
import { literal, sql } from './base-de-datos'
import { consultar, exigir, retirarLoSembrado, uno } from './ayuda-pesos-con-candidatos'
import { lugarDe } from './ayuda-prueba-propia'

export const MARCA_QA = 'QA-QB-80'
const SEMBRADO = `${MARCA_QA} sembrado a mano para revisar`

/** Un INSERT … RETURNING id: en un CTE, que Postgres no admite el INSERT dentro de FROM. */
function insertarUno(consulta: string): number {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as { id: number }[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return Number(filas[0]!.id)
}

/** Una solicitud aprobada, sin vacante, para que el formulario «Crear vacante» la ofrezca. */
export async function solicitudAprobada(token: string): Promise<number> {
  const lugar = await lugarDe(token)
  const { id } = await exigir<{ id: number }>('/panel/solicitudes', token, 'POST', {
    areaId: lugar.areaId,
    puestoId: lugar.puestoId,
    urgencia: 'NORMAL',
    resultadoPrincipal: `${MARCA_QA} Chef de cocina`,
    motivo: SEMBRADO,
    consecuenciaNoContratar: 'La cocina sigue sin quien la lleve.',
    analisisCapacidad: 'Nadie del equipo actual cubre la cocina saludable.',
    resultadosEsperados: [
      { descripcion: 'Carta saludable estable', indicador: 'Platos nuevos por mes' },
      { descripcion: 'Merma controlada', indicador: 'Merma mensual' },
      { descripcion: 'Equipo formado', indicador: 'Rotación del equipo' },
    ],
  })
  await exigir(`/panel/solicitudes/${id}/aprobacion`, token, 'POST', { motivo: SEMBRADO })
  return id
}

/** Las líneas vivas de una vacante, en su orden. */
export const lineasVivasDe = (vacante: number): string[] =>
  consultar(`select texto from linea_busqueda_cv where vacante_id = ${vacante} and archivada_en is null
             order by orden`).map((f) => String(f.texto))

/** Lo guardado de una vacante: sus líneas y lo encontrado, vivo y archivado, para comparar. */
export function fotoDeLoBuscado(vacante: number): {
  vivas: { id: number; version: number; texto: string }[]
  archivadas: number
  busquedasVivas: { postulacion: number; estado: string; version: number }[]
  resultadosVivos: number
  resultadosArchivados: number
} {
  const vivas = consultar(`select id, version_lineas as version, texto from linea_busqueda_cv
                            where vacante_id = ${vacante} and archivada_en is null order by orden`)
    .map((f) => ({ id: Number(f.id), version: Number(f.version), texto: String(f.texto) }))
  const archivadas = Number(uno(`select count(*) as n from linea_busqueda_cv
                                  where vacante_id = ${vacante} and archivada_en is not null`).n)
  const busquedasVivas = consultar(`select b.postulacion_id as postulacion, b.estado, b.version_lineas as version
                                      from busqueda_cv b join postulacion p on p.id = b.postulacion_id
                                     where p.vacante_id = ${vacante} and b.archivada_en is null order by 1`)
    .map((f) => ({ postulacion: Number(f.postulacion), estado: String(f.estado), version: Number(f.version) }))
  const resultados = uno(`select count(*) filter (where r.archivado_en is null) as vivos,
                                 count(*) filter (where r.archivado_en is not null) as archivados
                            from resultado_busqueda_cv r join postulacion p on p.id = r.postulacion_id
                           where p.vacante_id = ${vacante}`)
  return {
    vivas,
    archivadas,
    busquedasVivas,
    resultadosVivos: Number(resultados.vivos),
    resultadosArchivados: Number(resultados.archivados),
  }
}

/**
 * Siembra las líneas de una vacante y lo encontrado en una persona, como lo guarda el backend.
 * `estados` va en el orden de las líneas; «Lo tiene» lleva la frase `${frase} N`.
 */
export function sembrarBusqueda(vacante: number, lineas: readonly string[], postulacion: number,
                                estados: readonly ('TIENE' | 'MENCIONA' | 'NO_APARECE')[], frase: string): void {
  const version = Number(uno(`select coalesce(max(version_lineas), 0) + 1 as v from linea_busqueda_cv
                               where vacante_id = ${vacante}`).v)
  const ids = lineas.map((texto, i) =>
    insertarUno(`insert into linea_busqueda_cv (vacante_id, version_lineas, orden, texto)
                 values (${vacante}, ${version}, ${i + 1}, ${literal(texto)}) returning id`))
  const busqueda = insertarUno(`insert into busqueda_cv (postulacion_id, version_lineas, estado)
                                values (${postulacion}, ${version}, 'TERMINADA') returning id`)
  ids.forEach((linea, i) => {
    const estado = estados[i] ?? 'NO_APARECE'
    sql(`insert into resultado_busqueda_cv (busqueda_cv_id, postulacion_id, linea_busqueda_cv_id, version_lineas,
                                            estado, frase_cv, nota, pregunta)
         values (${busqueda}, ${postulacion}, ${linea}, ${version}, '${estado}',
                 ${estado === 'TIENE' ? literal(`${frase} ${i + 1}`) : 'null'},
                 ${literal(`NQB80 nota de la línea ${i + 1}`)},
                 ${estado === 'TIENE' ? 'null' : literal(`PQB80 ¿pregunta de la línea ${i + 1}?`)});`)
  })
}

/** Una búsqueda que se quedó sin reintentos: lo que deja la cola, sin nada guardado. */
export function busquedaFallida(postulacion: number): void {
  sql(`insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, referencia_tabla, referencia_id,
                               estado, intentos, modo, creado_en, tomado_en, terminado_en)
       select p.organizacion_id, 'BUSQUEDA_CV', p.id, 'postulacion', p.id, 'FALLIDO', 3, 'FINA', now(), now(), now()
         from postulacion p where p.id = ${postulacion};`)
}

/** Notas de los ocho criterios del currículum, como las deja EVIDENCIA_CV. */
export function notasDelCurriculum(postulacion: number, puntaje: number): void {
  sql(`insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen)
       select ${postulacion}, c.id, ${puntaje}, ${literal(`${MARCA_QA}: criterios del currículum`)}, 'AGENTE'
         from criterio c where c.etapa_codigo = 'PERFIL_INTEGRAL' and c.version_plantilla_prueba_id is null
       on conflict (postulacion_id, criterio_id) do nothing;`)
}

/** Quita lo de la QA en las vacantes de siempre: trabajos de búsqueda y notas sembradas. */
export function retirarDeLaVacante(vacante: number): void {
  sql(`begin;
       delete from resultado_busqueda_cv where postulacion_id in (select id from postulacion where vacante_id = ${vacante});
       delete from busqueda_cv where postulacion_id in (select id from postulacion where vacante_id = ${vacante});
       delete from linea_busqueda_cv where vacante_id = ${vacante};
       delete from trabajo_ia where agente_codigo = 'BUSQUEDA_CV'
          and postulacion_id in (select id from postulacion where vacante_id = ${vacante});
       delete from nota_criterio where explicacion = ${literal(`${MARCA_QA}: criterios del currículum`)}
          and postulacion_id in (select id from postulacion where vacante_id = ${vacante});
       commit;`)
}

/**
 * Quita todo lo sembrado con la marca: primero lo de «Qué buscar en el CV» de sus vacantes (sus
 * tablas apuntan a la vacante y a la postulación) y después lo de los ayudantes de la V74.
 */
export function retirarLoDeLaQa(correos: readonly string[]): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${MARCA_QA} %`)}`).map((f) => Number(f.id))
  for (const v of vacantes) retirarDeLaVacante(v)
  if (vacantes.length) {
    const ids = vacantes.join(',')
    sql(`begin;
         delete from requisito_objetivo where vacante_id in (${ids})
            and not exists (select 1 from postulacion p where p.vacante_id = requisito_objetivo.vacante_id);
         delete from ficha_vacante where vacante_id in (${ids})
            and not exists (select 1 from postulacion p where p.vacante_id = ficha_vacante.vacante_id);
         commit;`)
  }
  retirarLoSembrado(MARCA_QA, correos)
}

/** La fila del ranking de una persona, por la API. */
export async function filaDelRanking(vacante: number, postulacion: number,
                                     token?: string): Promise<Record<string, unknown> & {
  notaCurriculum: number | null
  busqueda: { estado: string; tiene: number; total: number; lineas: { frase: string | null }[] } | null
}> {
  const r = await fetch(`${API}/panel/vacantes/${vacante}/ranking?etapa=PERFIL_INTEGRAL`, {
    headers: { Authorization: `Bearer ${token ?? (await tokenDelPanel())}` },
  })
  if (!r.ok) throw new Error(`El ranking de ${vacante} respondió ${r.status}`)
  const cuerpo = (await r.json()) as { filas: { postulacionId: number }[] }
  const fila = cuerpo.filas.find((f) => f.postulacionId === postulacion)
  if (!fila) throw new Error(`El ranking de ${vacante} no trae la postulación ${postulacion}`)
  return fila as never
}

/**
 * El cuerpo entero del PUT de la vacante, tal como lo manda el formulario, con lo que se le
 * cambie encima. La ciudad va siempre: sin ella el guardado la cambiaría y avisaría a todos.
 */
export async function cuerpoDeLaVacante(vacante: number, token: string,
                                        cambios: Record<string, unknown>): Promise<Record<string, unknown>> {
  const v = await exigir<Record<string, unknown>>(`/panel/vacantes/${vacante}`, token)
  const base: Record<string, unknown> = {}
  for (const campo of ['solicitudTalentoId', 'responsableUsuarioId', 'titulo', 'descripcion', 'proposito',
    'responsabilidades', 'requisitos', 'modalidad', 'horario', 'ubicacion', 'ciudadUbigeo', 'tipoCierre',
    'plazas', 'cierraEn', 'remuneracion']) {
    if (v[campo] !== null && v[campo] !== undefined) base[campo] = v[campo]
  }
  return { ...base, ...cambios }
}

/** Un PUT a la vacante que devuelve estado y cuerpo, sin lanzar en un 4xx. */
export async function guardarVacante(vacante: number, token: string,
                                     cuerpo: Record<string, unknown>): Promise<{ estado: number; cuerpo: unknown }> {
  const r = await fetch(`${API}/panel/vacantes/${vacante}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let leido: unknown = texto
  try { leido = texto ? JSON.parse(texto) : null } catch { /* texto plano */ }
  return { estado: r.status, cuerpo: leido }
}

/**
 * La primera hoja de un .xlsx, leída solo con la biblioteca estándar de Python (zipfile y el XML
 * de la hoja y de sus textos compartidos): las Excel de la suite usan openpyxl, que no viene en
 * todos los equipos. Devuelve la cabecera (fila 1), las filas hasta el primer hueco y el pie.
 */
export function leerLaHoja(ruta: string): { cabeceras: string[]; filas: string[][]; pie: string[] } {
  const salida = execFileSync('python3', ['-I', '-c', `
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
    nombres = z.namelist()
    hoja = sorted(n for n in nombres if re.match(r'xl/worksheets/sheet\\d+\\.xml$', n))[0]
    raiz = ET.fromstring(z.read(hoja))
    compartidos = []
    if 'xl/sharedStrings.xml' in nombres:
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            compartidos.append(''.join(t.text or '' for t in si.iter() if t.tag.endswith('}t')))
ns = raiz.tag[1:].split('}')[0]
def columna(ref):
    n = 0
    for c in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + ord(c) - 64
    return n - 1
filas = {}
for fila in raiz.iter('{%s}row' % ns):
    r = int(fila.get('r'))
    celdas = {}
    for c in fila.findall('{%s}c' % ns):
        tipo = c.get('t')
        v = c.find('{%s}v' % ns)
        if tipo == 's' and v is not None:
            texto = compartidos[int(v.text)]
        elif tipo == 'inlineStr':
            texto = ''.join(t.text or '' for t in c.iter() if t.tag.endswith('}t'))
        elif v is not None and v.text is not None:
            texto = v.text
            if re.fullmatch(r'-?\\d+\\.0', texto):
                texto = texto[:-2]
        else:
            texto = ''
        celdas[columna(c.get('r'))] = texto
    ancho = max(celdas) + 1 if celdas else 0
    filas[r] = [celdas.get(i, '') for i in range(ancho)]
ultima = max(filas) if filas else 0
tabla = [filas.get(i, []) for i in range(1, ultima + 1)]
cabeceras = tabla[0] if tabla else []
cuerpo, pie, en_pie = [], [], False
for f in tabla[1:]:
    if not en_pie and any(c.strip() for c in f):
        cuerpo.append(f)
        continue
    en_pie = True
    pie.extend(c for c in f if c.strip())
print(json.dumps({'cabeceras': cabeceras, 'filas': cuerpo, 'pie': pie}, ensure_ascii=False))
`, ruta])
  return JSON.parse(salida.toString()) as { cabeceras: string[]; filas: string[][]; pie: string[] }
}
