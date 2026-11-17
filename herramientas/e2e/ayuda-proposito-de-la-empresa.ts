/**
 * El terreno de «El propósito de la empresa» (specs/Ready/proposito-de-la-empresa, V85) para
 * las pruebas de QA contra el preview real.
 *
 * - Empresas propias de la corrida, con un código `QA-PROP-8029-*`: la que tiene todo
 *   («Molinos del Sur»), la que no llenó nada, la que solo puso la web, la del Vimeo oculto,
 *   la que no tiene vacantes y la suspendida. Su presentación se escribe por SQL: lo que se
 *   prueba con ellas es lo que ve el candidato, no el guardado.
 * - La empresa de la plataforma (la de `dev-equipo`) es la que se llena desde el panel. Antes
 *   se le hace una FOTO de su presentación —textos, beneficios, redes, logo, portada y el video
 *   de sus vacantes— y al final se le devuelve tal cual: las pruebas no se quedan con nada suyo.
 * - Cuentas de panel `qa-prop-8029-*` en la plataforma, con un rol que ya existe (Talento,
 *   Responsable del área), que entran por el `dev-login`.
 *
 * ⚠️ **La auditoría no se puede borrar (V6).** Lo que la plataforma guarda desde el panel deja
 * su rastro, como debe; la limpieza solo retira lo sembrado.
 */

import { deflateSync } from 'node:zlib'
import type { Page } from '@playwright/test'

import { API, EQUIPO } from './ayuda'
import { literal, sql } from './base-de-datos'

export const MARCA = 'QA-PROP-8029'
const PREFIJO_CODIGO = `${MARCA}-`
const PREFIJO_PANEL = 'qa-prop-8029-'
const TEXTO_SEMBRADO = `${MARCA} sembrado por la QA del propósito de la empresa`

export type Fila = Record<string, string | number | boolean | null>

export function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

export function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

export function insertar(consulta: string): Fila {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return filas[0]!
}

export const contar = (consulta: string): number => Number(uno(`select count(*)::int as n from (${consulta}) c`).n)

// ---------- La plataforma (la empresa de dev-equipo) ----------

export interface Empresa {
  id: number
  codigo: string
  nombre: string
}

export function laPlataforma(): Empresa {
  const f = uno(`select o.id, o.codigo, o.nombre from organizacion o join usuario u on u.organizacion_id = o.id
                  where u.usuario_renaser_os_id = ${literal(EQUIPO)}`)
  return { id: Number(f.id), codigo: String(f.codigo), nombre: String(f.nombre) }
}

const COLUMNAS = [
  'proposito_empresa',
  'quienes_somos',
  'sector',
  'tamano',
  'anio_fundacion',
  'video_presentacion',
  'pagina_web',
  'logo_archivo_id',
  'portada_archivo_id',
] as const

export interface Foto {
  organizacion: number
  columnas: Fila
  beneficios: Fila[]
  redes: Fila[]
  videosDeVacantes: Fila[]
}

/** Lo que la empresa tiene ahora, para devolvérselo al terminar. */
export function fotoDe(organizacion: number): Foto {
  return {
    organizacion,
    columnas: uno(`select ${COLUMNAS.join(', ')} from organizacion where id = ${organizacion}`),
    beneficios: consultar(`select texto, orden from organizacion_beneficio where organizacion_id = ${organizacion} order by orden`),
    redes: consultar(`select red, enlace from organizacion_red_social where organizacion_id = ${organizacion} order by red`),
    videosDeVacantes: consultar(`select id, video_presentacion from vacante where organizacion_id = ${organizacion} order by id`),
  }
}

/** La presentación vacía, sin tocar logo ni portada (esos se quitan aparte). */
export function vaciarLaPresentacion(organizacion: number): void {
  sql(`
    begin;
    update organizacion set proposito_empresa = null, quienes_somos = null, sector = null, tamano = null,
           anio_fundacion = null, video_presentacion = null, pagina_web = null
     where id = ${organizacion};
    delete from organizacion_beneficio where organizacion_id = ${organizacion};
    delete from organizacion_red_social where organizacion_id = ${organizacion};
    commit;`)
}

/** Deja la empresa como estaba en la foto. */
export function devolver(foto: Foto): void {
  const c = foto.columnas
  const valor = (v: string | number | boolean | null | undefined) =>
    v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : literal(String(v))
  const benef = foto.beneficios
    .map((b) => `insert into organizacion_beneficio (organizacion_id, texto, orden) values (${foto.organizacion}, ${valor(b.texto)}, ${valor(b.orden)});`)
    .join('\n')
  const redes = foto.redes
    .map((r) => `insert into organizacion_red_social (organizacion_id, red, enlace) values (${foto.organizacion}, ${valor(r.red)}, ${valor(r.enlace)});`)
    .join('\n')
  const videos = foto.videosDeVacantes
    .map((v) => `update vacante set video_presentacion = ${valor(v.video_presentacion)} where id = ${v.id};`)
    .join('\n')
  sql(`
    begin;
    update organizacion set ${COLUMNAS.map((col) => `${col} = ${valor(c[col])}`).join(', ')}
     where id = ${foto.organizacion};
    delete from organizacion_beneficio where organizacion_id = ${foto.organizacion};
    ${benef}
    delete from organizacion_red_social where organizacion_id = ${foto.organizacion};
    ${redes}
    ${videos}
    commit;`)
}

export function presentacionEnBase(organizacion: number): Fila {
  return uno(`select ${COLUMNAS.join(', ')},
                     (select coalesce(json_agg(texto order by orden), '[]') from organizacion_beneficio b
                       where b.organizacion_id = o.id)::text as beneficios,
                     (select coalesce(json_object_agg(red, enlace), '{}') from organizacion_red_social r
                       where r.organizacion_id = o.id)::text as redes
                from organizacion o where o.id = ${organizacion}`)
}

export function ultimaAuditoria(organizacion: number, accion: string): number {
  return Number(uno(`select coalesce(max(id), 0) as id from auditoria where organizacion_id = ${organizacion}
                        and accion = ${literal(accion)}`).id)
}

export function auditoriasDesde(organizacion: number, accion: string, desde: number): Fila[] {
  return consultar(`select id, usuario_id, valor_anterior::text as antes, valor_nuevo::text as despues, ocurrida_en
                      from auditoria where organizacion_id = ${organizacion} and accion = ${literal(accion)}
                       and id > ${desde} order by id`)
}

// ---------- Empresas y vacantes sembradas ----------

export interface Presentacion {
  proposito?: string
  quienes?: string
  sector?: string
  tamano?: string
  anio?: number
  video?: string
  web?: string
  redes?: Partial<Record<'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE', string>>
  beneficios?: string[]
}

/** Una empresa activa (o suspendida) con su código de la corrida, sin roles ni usuarios. */
export function sembrarEmpresa(sufijo: string, nombre: string, opciones: { activa?: boolean } = {}): Empresa {
  const codigo = `${PREFIJO_CODIGO}${sufijo}`
  const f = insertar(`
    insert into organizacion (codigo, nombre, es_activa)
    values (${literal(codigo)}, ${literal(nombre)}, ${opciones.activa === false ? 'false' : 'true'})
    returning id, codigo, nombre`)
  return { id: Number(f.id), codigo: String(f.codigo), nombre: String(f.nombre) }
}

export function ponerPresentacion(organizacion: number, p: Presentacion): void {
  const v = (x: string | number | undefined) =>
    x === undefined ? 'null' : typeof x === 'number' ? String(x) : literal(x)
  const redes = Object.entries(p.redes ?? {})
    .map(([red, enlace]) => `insert into organizacion_red_social (organizacion_id, red, enlace) values (${organizacion}, ${literal(red)}, ${literal(enlace!)});`)
    .join('\n')
  const beneficios = (p.beneficios ?? [])
    .map((b, i) => `insert into organizacion_beneficio (organizacion_id, texto, orden) values (${organizacion}, ${literal(b)}, ${i + 1});`)
    .join('\n')
  sql(`
    begin;
    update organizacion set proposito_empresa = ${v(p.proposito)}, quienes_somos = ${v(p.quienes)},
           sector = ${v(p.sector)}, tamano = ${v(p.tamano)}, anio_fundacion = ${v(p.anio)},
           video_presentacion = ${v(p.video)}, pagina_web = ${v(p.web)}
     where id = ${organizacion};
    delete from organizacion_red_social where organizacion_id = ${organizacion};
    ${redes}
    delete from organizacion_beneficio where organizacion_id = ${organizacion};
    ${beneficios}
    commit;`)
}

const usuarioDelEquipo = (): number =>
  Number(uno(`select id from usuario where usuario_renaser_os_id = ${literal(EQUIPO)}`).id)

export interface DatosDeVacante {
  proposito?: string
  responsabilidades?: string
  requisitos?: string
  indispensables?: string[]
  video?: string
  modalidad?: string
  horario?: string
  /** PUBLICADA por defecto; CERRADA, BORRADOR, o «ARCHIVADA» (cerrada y archivada). */
  estado?: 'PUBLICADA' | 'CERRADA' | 'BORRADOR' | 'ARCHIVADA'
  eliminada?: boolean
  /** Cuántos días antes de hoy se publicó (por defecto 2). */
  publicadaHaceDias?: number
}

/** Una vacante de cualquier empresa, con su área, puesto y solicitud propios. */
export function sembrarVacante(organizacion: number, titulo: string, d: DatosDeVacante = {}): number {
  const responsable = usuarioDelEquipo()
  const sufijo = `${Date.now()}${Math.floor(Math.random() * 100000)}`
  const area = Number(insertar(`
    insert into area (organizacion_id, nombre)
    values (${organizacion}, ${literal(`${MARCA} ${titulo} ${sufijo}`)}) returning id`).id)
  const puesto = Number(insertar(`
    insert into puesto (organizacion_id, codigo, nombre, nivel_puesto_codigo, familia_codigo)
    values (${organizacion}, ${literal(`QA_PROP_8029_${sufijo}`)}, ${literal(titulo)}, 'EJECUCION', 'OPERACIONES')
    returning id`).id)
  const solicitud = Number(insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    values (${organizacion}, 'DIRECTA', 'NORMAL', 'CON_VACANTE', ${area}, ${puesto},
            ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
            ${literal(TEXTO_SEMBRADO)}, ${responsable})
    returning id`).id)
  const estado = d.estado === 'ARCHIVADA' ? 'CERRADA' : (d.estado ?? 'PUBLICADA')
  const v = (x: string | undefined) => (x === undefined ? 'null' : literal(x))
  const id = Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion, proposito,
                         responsabilidades, requisitos, modalidad, horario, video_presentacion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, publicada_en, archivada_en, eliminada_en)
    values (${organizacion}, ${solicitud}, ${puesto}, ${literal(`${MARCA} ${titulo}`)},
            ${literal(`Descripción de ${titulo}.`)}, ${v(d.proposito)}, ${v(d.responsabilidades)},
            ${v(d.requisitos)}, ${v(d.modalidad ?? 'Presencial')}, ${v(d.horario)}, ${v(d.video)},
            'PERMANENTE', ${literal(estado)}, (select min(id) from version_pesos), ${responsable}, false,
            ${estado === 'BORRADOR' ? 'null' : `now() - make_interval(days => ${d.publicadaHaceDias ?? 2})`},
            ${d.estado === 'ARCHIVADA' ? 'now()' : 'null'}, ${d.eliminada ? 'now()' : 'null'})
    returning id`).id)
  for (const requisito of d.indispensables ?? []) {
    sql(`insert into requisito_objetivo (vacante_id, descripcion, regla, es_activo, creado_en)
         values (${id}, ${literal(requisito)}, 'MANUAL', true, now());`)
  }
  return id
}

// ---------- Cuentas de panel ----------

/** Una cuenta de panel en la plataforma con un rol que ya existe (TALENTO, RESPONSABLE_AREA…). */
export function sembrarCuentaDePanel(sufijo: string, rol: string): { usuario: number; renaserOsId: string } {
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const renaserOsId = `${PREFIJO_PANEL}${sufijo}`
  const rolId = Number(uno(`select id from rol where organizacion_id = ${plataforma} and codigo = ${literal(rol)}`).id)
  const persona = Number(insertar(`
    insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id`).id)
  const usuario = Number(insertar(`
    insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
    values (${plataforma}, ${persona}, ${literal(renaserOsId)}, true, true) returning id`).id)
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rolId});`)
  return { usuario, renaserOsId }
}

export async function tokenDe(renaserOsId: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status} ${await r.text()}`)
  return (await r.json()).token as string
}

/** Siembra el token del panel ANTES de que arranque la app. */
export async function entrarAlPanelComo(page: Page, renaserOsId: string): Promise<void> {
  const token = await tokenDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

export async function pedir(
  ruta: string,
  opciones: { token?: string; metodo?: string; cuerpo?: unknown; formulario?: FormData } = {},
): Promise<{ estado: number; cuerpo: any; cabeceras: Headers; bytes: Buffer }> {
  const cabeceras: Record<string, string> = {}
  if (opciones.token) cabeceras.Authorization = `Bearer ${opciones.token}`
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'
  const r = await fetch(ruta.startsWith('http') ? ruta : `${API}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: cabeceras,
    body: opciones.formulario ?? (opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)),
  })
  const bytes = Buffer.from(await r.arrayBuffer())
  let cuerpo: unknown = null
  const texto = bytes.toString('utf8')
  try { cuerpo = texto ? JSON.parse(texto) : null } catch { cuerpo = texto }
  return { estado: r.status, cuerpo, cabeceras: r.headers, bytes }
}

/** Sube el logo o la portada de la empresa del token, como lo haría el panel. */
export async function subirImagen(token: string, cual: 'logo' | 'portada', png: Buffer, nombre = `${cual}.png`, tipo = 'image/png') {
  const formulario = new FormData()
  formulario.append('archivo', new Blob([new Uint8Array(png)], { type: tipo }), nombre)
  return pedir(`/panel/organizacion/presentacion/imagenes/${cual}`, { token, metodo: 'POST', formulario })
}

// ---------- Imágenes de prueba ----------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(datos: Buffer): number {
  let c = 0xffffffff
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/**
 * Un PNG RGBA de `ancho × alto`. Con `ruido`, los píxeles salen de un generador con semilla
 * (pesa y no se comprime); sin él, un degradado liso. Con `gps`, lleva metadatos de ubicación
 * en un `eXIf` y en un `tEXt`, y `relleno` bytes más de comentario para llegar al peso pedido.
 */
export function png(ancho: number, alto: number, opciones: { ruido?: boolean; gps?: boolean; relleno?: number } = {}): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // bits
  ihdr[9] = 6 // RGBA
  const fila = ancho * 4 + 1
  const crudo = Buffer.alloc(fila * alto)
  let semilla = 8029
  for (let y = 0; y < alto; y++) {
    crudo[y * fila] = 0
    for (let x = 0; x < ancho; x++) {
      const i = y * fila + 1 + x * 4
      if (opciones.ruido) {
        for (let k = 0; k < 3; k++) {
          // xorshift32: el byte bajo de un congruencial se repite y se comprime.
          semilla ^= semilla << 13
          semilla ^= semilla >>> 17
          semilla ^= semilla << 5
          semilla >>>= 0
          crudo[i + k] = semilla & 0xff
        }
      } else {
        crudo[i] = (x * 255) / ancho
        crudo[i + 1] = (y * 255) / alto
        crudo[i + 2] = 160
      }
      crudo[i + 3] = 255
    }
  }
  const trozos = [trozo('IHDR', ihdr)]
  if (opciones.gps) {
    // Un EXIF mínimo (TIFF big-endian) con el texto de un GPS dentro: lo que la re-codificación
    // del servidor tiene que tirar.
    const exif = Buffer.concat([Buffer.from('MM\u0000*\u0000\u0000\u0000\b', 'binary'), Buffer.from('GPSLatitude=-12.0464;GPSLongitude=-77.0428', 'ascii')])
    trozos.push(trozo('eXIf', exif))
    trozos.push(trozo('tEXt', Buffer.from('GPS\u0000Lima -12.0464 -77.0428', 'latin1')))
  }
  if (opciones.relleno) {
    trozos.push(trozo('tEXt', Buffer.concat([Buffer.from('Comment\u0000', 'latin1'), Buffer.alloc(opciones.relleno, 0x61)])))
  }
  trozos.push(trozo('IDAT', deflateSync(crudo)))
  trozos.push(trozo('IEND', Buffer.alloc(0)))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...trozos])
}

/** Si unos bytes llevan rastro de los metadatos que se sembraron. */
export function llevaMetadatos(bytes: Buffer): boolean {
  const texto = bytes.toString('latin1')
  return texto.includes('GPS') || texto.includes('eXIf') || texto.includes('Exif') || texto.includes('-77.0428')
}

// ---------- Limpieza ----------

/** Retira las empresas, vacantes y cuentas de la corrida. No toca nada de nadie más. */
export function retirarLoSembrado(): void {
  const empresas = consultar(`select id from organizacion where codigo like ${literal(`${PREFIJO_CODIGO}%`)}`).map((f) => Number(f.id))
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${MARCA} %`)}`).map((f) => Number(f.id))
  if (vacantes.length) {
    const ids = vacantes.join(',')
    sql(`
      begin;
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from aviso_portal where vacante_id in (${ids});
      delete from vacante v where v.id in (${ids})
         and not exists (select 1 from postulacion p where p.vacante_id = v.id);
      update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
      commit;`)
  }
  sql(`
    begin;
    create temporary table qa_prop_solicitudes on commit drop as
      select id from solicitud_talento s where s.motivo = ${literal(TEXTO_SEMBRADO)}
         and not exists (select 1 from vacante v where v.solicitud_talento_id = s.id);
    delete from solicitud_talento where id in (select id from qa_prop_solicitudes);
    delete from area a where a.nombre like ${literal(`${MARCA} %`)}
       and not exists (select 1 from solicitud_talento s where s.area_id = a.id);
    delete from puesto p where p.codigo like 'QA\\_PROP\\_8029\\_%'
       and not exists (select 1 from solicitud_talento s where s.puesto_id = p.id)
       and not exists (select 1 from vacante v where v.puesto_id = p.id);
    commit;`)
  for (const id of empresas) {
    sql(`
      begin;
      delete from organizacion_beneficio where organizacion_id = ${id};
      delete from organizacion_red_social where organizacion_id = ${id};
      delete from organizacion o where o.id = ${id}
         and not exists (select 1 from auditoria a where a.organizacion_id = o.id)
         and not exists (select 1 from vacante v where v.organizacion_id = o.id)
         and not exists (select 1 from usuario u where u.organizacion_id = o.id);
      update organizacion set es_activa = false where id = ${id};
      commit;`)
  }
  sql(`
    begin;
    create temporary table qa_prop_panel on commit drop as
      select id, persona_id from usuario where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    delete from usuario_rol where usuario_id in (select id from qa_prop_panel);
    delete from usuario u where u.id in (select id from qa_prop_panel)
       and not exists (select 1 from auditoria a where a.usuario_id = u.id);
    update usuario set es_activo = false, usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
     where id in (select id from qa_prop_panel);
    delete from persona where id in (select persona_id from qa_prop_panel)
       and not exists (select 1 from usuario u where u.persona_id = persona.id);
    commit;`)
}
