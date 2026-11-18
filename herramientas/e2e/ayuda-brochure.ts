/**
 * El terreno de «El brochure de la empresa, armado solo» (specs/Ready/brochure-de-la-empresa,
 * V86) para las pruebas de QA contra el preview real.
 *
 * - La empresa de la plataforma (la de `dev-equipo`) es la empresa A: se llena desde el panel y
 *   por la API, con logo y portada. Antes se le hace una FOTO de su presentación —la de la V85 y
 *   las cuatro columnas de la V86 (misión, visión, plantilla y color)— y al final se le devuelve
 *   tal cual. Sus sedes de prueba llevan el nombre `QA-BROCH-08DB …` y se borran al terminar.
 * - Empresas propias de la corrida, con el código `QA-BROCH-08DB-*`, escritas por SQL: lo que se
 *   prueba con ellas es lo que ve el candidato (el perfil público y su brochure), no el guardado.
 * - Cuentas de panel `qa-broch-08db-*` en la plataforma, con un rol que ya existe.
 *
 * El texto del PDF se lee con `pdftotext`, sus enlaces con `pdfinfo -url`, sus imágenes con
 * `pdfimages` y sus colores con `pdftoppm` (PPM, que se lee sin librerías).
 *
 * En el panel, el módulo va en dos pestañas, «Perfil» y «Brochure» (`?pestana=brochure`), y la
 * plantilla y el color se guardan solos al elegirlos (`PUT …/presentacion/brochure`): las ayudas
 * de «El módulo en el panel» cambian de pestaña y esperan ese guardado.
 *
 * ⚠️ **La auditoría no se puede borrar (V6).** Lo que la plataforma guarda desde el panel deja su
 * rastro, como debe; la limpieza solo retira lo sembrado.
 */

import { expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

import { EQUIPO } from './ayuda'
import { consultar, insertar, uno, type Empresa, type Fila } from './ayuda-proposito-de-la-empresa'
import { literal, sql } from './base-de-datos'

export const MARCA = 'QA-BROCH-08DB'
const PREFIJO_CODIGO = `${MARCA}-`
const PREFIJO_PANEL = 'qa-broch-08db-'

export const NOMBRE_DEL_ARCHIVO = (empresa: string) => `Brochure - ${empresa}.pdf`

/**
 * El nombre del archivo que dice un `Content-Disposition`: el `filename*` (RFC 5987), que es el
 * que usa el navegador, o el `filename` si no lo hay.
 */
export function nombreDeDisposicion(cabecera: string | null | undefined): string | null {
  if (!cabecera) return null
  const extendido = /filename\*=UTF-8''([^;]+)/i.exec(cabecera)
  if (extendido) return decodeURIComponent(extendido[1]!.trim())
  return /filename="([^"]*)"/i.exec(cabecera)?.[1] ?? null
}

// ---------- El módulo en el panel: las pestañas y el guardado al elegir ----------

export type PestanaDelModulo = 'Perfil' | 'Brochure'

export const laPestanaDelModulo = (page: Page, nombre: PestanaDelModulo) =>
  page
    .getByRole('tablist', { name: 'Secciones del perfil de la empresa' })
    .getByRole('tab', { name: nombre, exact: true })

export const elPanelDeLaPestana = (page: Page, nombre: PestanaDelModulo) =>
  page.getByRole('tabpanel', { name: nombre, exact: true })

/** Cambia de pestaña con un clic y comprueba que la dirección lo dice (`?pestana=brochure`). */
export async function irALaPestana(page: Page, nombre: PestanaDelModulo): Promise<void> {
  await laPestanaDelModulo(page, nombre).click()
  await expect(laPestanaDelModulo(page, nombre)).toHaveAttribute('aria-selected', 'true')
  await expect(elPanelDeLaPestana(page, nombre)).toBeVisible()
  await expect(page).toHaveURL(nombre === 'Brochure' ? /\/admin\/empresa\?pestana=brochure$/ : /\/admin\/empresa$/)
}

/** El guardado al elegir: `PUT /api/v1/panel/organizacion/presentacion/brochure`. */
export const RUTA_DE_LA_ELECCION = '**/api/v1/panel/organizacion/presentacion/brochure'

export interface EleccionEnviada {
  plantillaBrochure: string
  colorBrochure: string
}

/**
 * Elige (con un clic o una tecla) y espera el guardado automático. Devuelve lo que mandó la
 * pestaña, después de comprobar que el backend contestó con `estado`.
 */
export async function elegirYEsperar(page: Page, eleccion: () => Promise<unknown>, estado = 200): Promise<EleccionEnviada> {
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/organizacion/presentacion/brochure') && r.request().method() === 'PUT'),
    eleccion(),
  ])
  expect(respuesta.status(), 'el guardado de la elección').toBe(estado)
  return respuesta.request().postDataJSON() as EleccionEnviada
}

// ---------- La plataforma (la empresa A, la de dev-equipo) ----------

export function laPlataforma(): Empresa {
  const f = uno(`select o.id, o.codigo, o.nombre from organizacion o join usuario u on u.organizacion_id = o.id
                  where u.usuario_renaser_os_id = ${literal(EQUIPO)}`)
  return { id: Number(f.id), codigo: String(f.codigo), nombre: String(f.nombre) }
}

/** Todo lo que el módulo guarda en `organizacion`: lo de la V85 y lo de la V86. */
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
  'mision',
  'vision',
  'plantilla_brochure',
  'color_brochure',
] as const

export interface Foto {
  organizacion: number
  columnas: Fila
  beneficios: Fila[]
  redes: Fila[]
}

export function fotoDe(organizacion: number): Foto {
  return {
    organizacion,
    columnas: uno(`select ${COLUMNAS.join(', ')} from organizacion where id = ${organizacion}`),
    beneficios: consultar(`select texto, orden from organizacion_beneficio where organizacion_id = ${organizacion} order by orden`),
    redes: consultar(`select red, enlace from organizacion_red_social where organizacion_id = ${organizacion} order by red`),
  }
}

const valor = (v: string | number | boolean | null | undefined) =>
  v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : literal(String(v))

/** Deja la empresa como estaba en la foto. */
export function devolver(foto: Foto): void {
  const c = foto.columnas
  const benef = foto.beneficios
    .map((b) => `insert into organizacion_beneficio (organizacion_id, texto, orden) values (${foto.organizacion}, ${valor(b.texto)}, ${valor(b.orden)});`)
    .join('\n')
  const redes = foto.redes
    .map((r) => `insert into organizacion_red_social (organizacion_id, red, enlace) values (${foto.organizacion}, ${valor(r.red)}, ${valor(r.enlace)});`)
    .join('\n')
  sql(`
    begin;
    update organizacion set ${COLUMNAS.map((col) => `${col} = ${valor(c[col])}`).join(', ')}
     where id = ${foto.organizacion};
    delete from organizacion_beneficio where organizacion_id = ${foto.organizacion};
    ${benef}
    delete from organizacion_red_social where organizacion_id = ${foto.organizacion};
    ${redes}
    commit;`)
}

/** La presentación vacía, con «Clásica» y «Azul», sin logo ni portada (la foto los recuerda). */
export function vaciarLaPresentacion(organizacion: number): void {
  sql(`
    begin;
    update organizacion set proposito_empresa = null, quienes_somos = null, sector = null, tamano = null,
           anio_fundacion = null, video_presentacion = null, pagina_web = null, mision = null, vision = null,
           plantilla_brochure = 'CLASICA', color_brochure = 'AZUL', logo_archivo_id = null, portada_archivo_id = null
     where id = ${organizacion};
    delete from organizacion_beneficio where organizacion_id = ${organizacion};
    delete from organizacion_red_social where organizacion_id = ${organizacion};
    commit;`)
}

/** Lo que guarda el módulo de una empresa, para comparar antes y después. */
export function presentacionEnBase(organizacion: number): Fila {
  return uno(`select ${COLUMNAS.join(', ')},
                     (select coalesce(json_agg(texto order by orden), '[]') from organizacion_beneficio b
                       where b.organizacion_id = o.id)::text as beneficios,
                     (select coalesce(json_object_agg(red, enlace), '{}') from organizacion_red_social r
                       where r.organizacion_id = o.id)::text as redes
                from organizacion o where o.id = ${organizacion}`)
}

/** Una sede de prueba de una empresa, con su provincia y su dirección. */
export function sembrarSede(organizacion: number, nombre: string, provincia: string, direccion: string, activa = true): number {
  return Number(insertar(`
    insert into sede (organizacion_id, nombre, direccion, provincia_ubigeo, es_activa)
    values (${organizacion}, ${literal(`${MARCA} ${nombre}`)}, ${literal(direccion)}, ${literal(provincia)}, ${activa})
    returning id`).id)
}

// ---------- Empresas sembradas ----------

export interface Presentacion {
  quienes?: string
  proposito?: string
  mision?: string
  vision?: string
  sector?: string
  web?: string
  video?: string
  plantilla?: 'CLASICA' | 'PORTADA' | 'COLUMNAS'
  color?: 'AZUL' | 'VERDE' | 'ROJO' | 'NOCHE' | 'PETROLEO' | 'CIRUELA'
  redes?: Record<string, string>
}

/** Una empresa activa (o suspendida) con su código de la corrida y su presentación. */
export function sembrarEmpresa(sufijo: string, nombre: string, p: Presentacion = {}, opciones: { activa?: boolean } = {}): Empresa {
  const codigo = `${PREFIJO_CODIGO}${sufijo}`
  const v = (x: string | undefined) => (x === undefined ? 'null' : literal(x))
  const f = insertar(`
    insert into organizacion (codigo, nombre, es_activa, quienes_somos, proposito_empresa, mision, vision, sector,
                              pagina_web, video_presentacion, plantilla_brochure, color_brochure)
    values (${literal(codigo)}, ${literal(nombre)}, ${opciones.activa === false ? 'false' : 'true'}, ${v(p.quienes)},
            ${v(p.proposito)}, ${v(p.mision)}, ${v(p.vision)}, ${v(p.sector)}, ${v(p.web)}, ${v(p.video)},
            ${literal(p.plantilla ?? 'CLASICA')}, ${literal(p.color ?? 'AZUL')})
    returning id, codigo, nombre`)
  const id = Number(f.id)
  for (const [red, enlace] of Object.entries(p.redes ?? {})) {
    sql(`insert into organizacion_red_social (organizacion_id, red, enlace) values (${id}, ${literal(red)}, ${literal(enlace)});`)
  }
  return { id, codigo: String(f.codigo), nombre: String(f.nombre) }
}

/** La dirección del perfil público de una empresa (su código en minúsculas). */
export const perfilDe = (empresa: Empresa) => `/empresas/${encodeURIComponent(empresa.codigo.toLowerCase())}`

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

// ---------- Limpieza ----------

/** Retira las empresas, sedes y cuentas de la corrida. No toca nada de nadie más. */
export function retirarLoSembrado(): void {
  sql(`delete from sede where nombre like ${literal(`${MARCA} %`)};`)
  const empresas = consultar(`select id from organizacion where codigo like ${literal(`${PREFIJO_CODIGO}%`)}`).map((f) => Number(f.id))
  for (const id of empresas) {
    sql(`
      begin;
      delete from organizacion_beneficio where organizacion_id = ${id};
      delete from organizacion_red_social where organizacion_id = ${id};
      delete from organizacion o where o.id = ${id}
         and not exists (select 1 from auditoria a where a.organizacion_id = o.id)
         and not exists (select 1 from usuario u where u.organizacion_id = o.id);
      update organizacion set es_activa = false where id = ${id};
      commit;`)
  }
  sql(`
    begin;
    create temporary table qa_broch_panel on commit drop as
      select id, persona_id from usuario where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    delete from usuario_rol where usuario_id in (select id from qa_broch_panel);
    delete from usuario u where u.id in (select id from qa_broch_panel)
       and not exists (select 1 from auditoria a where a.usuario_id = u.id);
    update usuario set es_activo = false, usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
     where id in (select id from qa_broch_panel);
    delete from persona where id in (select persona_id from qa_broch_panel)
       and not exists (select 1 from usuario u where u.persona_id = persona.id);
    commit;`)
}

// ---------- El PDF ----------

/**
 * Guarda el PDF para leerlo y, con `E2E_EVIDENCIAS`, también como evidencia. Devuelve la ruta.
 */
export function guardarPdf(carpeta: string, nombre: string, bytes: Buffer): string {
  mkdirSync(carpeta, { recursive: true })
  const ruta = join(carpeta, `${nombre}.pdf`)
  writeFileSync(ruta, bytes)
  const evidencias = process.env.E2E_EVIDENCIAS
  if (evidencias) {
    mkdirSync(evidencias, { recursive: true })
    writeFileSync(join(evidencias, `${nombre}.pdf`), bytes)
  }
  return ruta
}

/**
 * El texto del PDF, de una página o de todas, con los espacios juntados. Con `desdeX` (en puntos
 * desde la izquierda) solo lee lo que queda a la derecha de esa línea: la columna de los textos
 * de «Columnas», sin mezclarla con la columna del color.
 */
export function textoDelPdf(ruta: string, pagina?: number, desdeX?: number): string {
  const rango = pagina ? ['-f', String(pagina), '-l', String(pagina)] : []
  const recorte = desdeX === undefined ? [] : ['-x', String(desdeX), '-y', '0', '-W', String(Math.ceil(595 - desdeX)), '-H', '842']
  return execFileSync('pdftotext', [...rango, ...recorte, ruta, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
}

/**
 * El texto sin ningún espacio y en mayúsculas: los títulos del brochure van espaciados
 * («QUIÉNES S OM OS») y así se pueden buscar enteros.
 */
export const compacto = (texto: string) => texto.replace(/\s+/g, '').toLocaleUpperCase('es')

export const paginasDelPdf = (ruta: string): number =>
  Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [ruta], { encoding: 'utf8' }))![1])

export const tituloDelPdf = (ruta: string): string =>
  (/Title:\s+(.*)/.exec(execFileSync('pdfinfo', [ruta], { encoding: 'utf8' }))?.[1] ?? '').trim()

/** Las direcciones enlazadas dentro del PDF (las anotaciones de enlace). */
export const enlacesDelPdf = (ruta: string): string[] =>
  execFileSync('pdfinfo', ['-url', ruta], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/).slice(2).join(' '))
    .filter(Boolean)

export interface ImagenDelPdf {
  pagina: number
  ancho: number
  alto: number
  tipo: string
  color: string
}

/** Las imágenes que se dibujan, hoja a hoja (una por cada vez que sale). */
export function imagenesDelPdf(ruta: string): ImagenDelPdf[] {
  return execFileSync('pdfimages', ['-list', ruta], { encoding: 'utf8' })
    .split('\n')
    .slice(2)
    .map((l) => l.trim().split(/\s+/))
    .filter((c) => c.length > 6)
    .map((c) => ({ pagina: Number(c[0]), tipo: c[2]!, ancho: Number(c[3]), alto: Number(c[4]), color: c[5]! }))
}

type Rgb = [number, number, number]

function leerPpm(bytes: Buffer): { ancho: number; alto: number; pixel: (x: number, y: number) => Rgb } {
  // P6\n<ancho> <alto>\n255\n<datos>
  let i = 0
  const campos: string[] = []
  while (campos.length < 4) {
    while (/\s/.test(String.fromCharCode(bytes[i]!))) i++
    let campo = ''
    while (!/\s/.test(String.fromCharCode(bytes[i]!))) campo += String.fromCharCode(bytes[i++]!)
    campos.push(campo)
  }
  i++
  const ancho = Number(campos[1])
  const alto = Number(campos[2])
  const datos = bytes.subarray(i)
  return {
    ancho,
    alto,
    pixel: (x, y) => {
      const p = (Math.min(alto - 1, Math.max(0, y)) * ancho + Math.min(ancho - 1, Math.max(0, x))) * 3
      return [datos[p]!, datos[p + 1]!, datos[p + 2]!]
    },
  }
}

/** El color de un punto de una hoja, en fracciones del ancho y el alto (0 a 1). */
export function colorEn(ruta: string, pagina: number, x: number, y: number): Rgb {
  const ppm = execFileSync('pdftoppm', ['-r', '30', '-f', String(pagina), '-l', String(pagina), '-singlefile', ruta])
  const img = leerPpm(ppm)
  return img.pixel(Math.round(x * (img.ancho - 1)), Math.round(y * (img.alto - 1)))
}

export const hexARgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb

export const parecido = (a: Rgb, b: Rgb, tolerancia = 8) => a.every((v, i) => Math.abs(v - b[i]!) <= tolerancia)

/**
 * Las esquinas de las imágenes de una hoja tal como van incrustadas: un logo transparente
 * aplanado sobre blanco tiene la esquina blanca; sobre negro, negra.
 */
export function esquinasDeLasImagenes(ruta: string, pagina: number, carpeta: string): { ancho: number; alto: number; esquina: Rgb }[] {
  const destino = join(carpeta, `imagenes-${pagina}-${Date.now()}`)
  mkdirSync(destino, { recursive: true })
  execFileSync('pdfimages', ['-f', String(pagina), '-l', String(pagina), ruta, join(destino, 'i')])
  return readdirSync(destino)
    .filter((f) => f.endsWith('.ppm'))
    .sort()
    .map((f) => {
      const img = leerPpm(readFileSync(join(destino, f)))
      return { ancho: img.ancho, alto: img.alto, esquina: img.pixel(2, 2) }
    })
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

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  let c = 0xffffffff
  for (const b of cuerpo) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0)
  return Buffer.concat([largo, cuerpo, crc])
}

/** Un PNG RGBA de `ancho × alto` dibujado píxel a píxel con `pintar(x, y) → [r, g, b, a]`. */
export function pngDibujado(ancho: number, alto: number, pintar: (x: number, y: number) => [number, number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const fila = ancho * 4 + 1
  const crudo = Buffer.alloc(fila * alto)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const [r, g, b, a] = pintar(x, y)
      const i = y * fila + 1 + x * 4
      crudo[i] = r
      crudo[i + 1] = g
      crudo[i + 2] = b
      crudo[i + 3] = a
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo)),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/** El logo de prueba: un círculo naranja sobre fondo TRANSPARENTE, de 512 × 512. */
export const logoTransparente = () =>
  pngDibujado(512, 512, (x, y) => ((x - 256) ** 2 + (y - 256) ** 2 < 200 ** 2 ? [230, 120, 20, 255] : [0, 0, 0, 0]))

/** La portada de prueba: un degradado verde y ocre de 1600 × 400, opaco. */
export const portadaDegradada = () =>
  pngDibujado(1600, 400, (x, y) => [Math.round(40 + (150 * x) / 1600), Math.round(120 + (100 * y) / 400), 90, 255])
