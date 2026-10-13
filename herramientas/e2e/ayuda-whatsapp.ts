/**
 * El terreno de las novedades por WhatsApp (V73).
 *
 * El backend del clon corre con el bot de WhatsApp **falso** (`app.whatsapp.modo=falso`, el
 * perfil local): no sale nada hacia ningún sitio y apunta lo que le mandaría al bot de
 * verdad. Desde aquí se hace de bot:
 *
 *   - se leen sus apuntes en `GET /integraciones/whatsapp/falso/registro?telefono=…`;
 *   - se le llama a EX como lo haría el bot (`/vinculos`, `/novedades`, `/bajas`), con la firma
 *     HMAC de `marca.ruta.cuerpo`, como dice el contrato (docs/CONTRATO-NOVEDADES-POR-WHATSAPP.md
 *     del backend).
 *
 * El secreto es el de desarrollo del perfil local (se puede pisar con
 * `E2E_WHATSAPP_SECRETO_DEL_BOT` si el backend arrancó con otro). No abre nada fuera de la
 * máquina.
 *
 * Cada cuenta lleva un celular único, para que cada prueba mire solo lo suyo en un registro
 * que comparte con todas.
 */

import { createHmac } from 'node:crypto'
import { API } from './ayuda'
import { literal, sql } from './base-de-datos'
import { exigir } from './ayuda-preguntas-propias'

export const SECRETO_DEL_BOT =
  process.env.E2E_WHATSAPP_SECRETO_DEL_BOT ?? 'secreto-de-desarrollo-desde-el-bot-solo-local'

/** El número del bot, como va en el enlace. */
export const NUMERO_DEL_BOT = '51928439930'

export const PARAMETRO_BETA = 'whatsapp_novedades_activo'

let siguiente = 0

/** Un celular peruano que ninguna otra prueba usa: «9» y ocho cifras de la hora. */
export function celularUnico(): { escrito: string; e164: string; mostrado: string } {
  const cifras = `9${String(Date.now() + siguiente++).slice(-8)}`
  return {
    escrito: `${cifras.slice(0, 3)} ${cifras.slice(3, 6)} ${cifras.slice(6)}`,
    e164: `+51${cifras}`,
    mostrado: `+51 ${cifras.slice(0, 3)} ${cifras.slice(3, 6)} ${cifras.slice(6)}`,
  }
}

/** La dirección completa de una ruta de la integración: `/vinculos` → `…/api/v1/integraciones/whatsapp/vinculos`. */
export function direccionDelBot(ruta: string): string {
  return `${API}/integraciones/whatsapp${ruta}`
}

/**
 * Las dos cabeceras de la firma: HMAC-SHA256 de «marca.ruta.cuerpo», donde la ruta es el path
 * completo de la dirección, sin host ni query. Con la marca y el secreto que se quieran, para
 * probar la ventana de cinco minutos o un secreto que no es.
 */
export function firmaDelBot(
  direccion: string,
  cuerpo: string,
  { marca = Math.floor(Date.now() / 1000), secreto = SECRETO_DEL_BOT }: { marca?: number; secreto?: string } = {},
): Record<string, string> {
  const m = String(marca)
  const ruta = new URL(direccion).pathname
  const firma = createHmac('sha256', secreto).update(`${m}.${ruta}.${cuerpo}`).digest('hex')
  return { 'X-Renaser-Marca': m, 'X-Renaser-Firma': firma }
}

export interface RespuestaDelBot<T = any> {
  estado: number
  cuerpo: T
}

/** Una llamada del bot a EX, firmada (o sin firmar, para probar la puerta). */
export async function comoElBot<T = any>(
  ruta: string,
  metodo: 'GET' | 'POST',
  cuerpo?: unknown,
  { sinFirma = false }: { sinFirma?: boolean } = {},
): Promise<RespuestaDelBot<T>> {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo)
  const direccion = direccionDelBot(ruta)
  const r = await fetch(direccion, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(sinFirma ? {} : firmaDelBot(direccion, texto)),
    },
    body: metodo === 'GET' ? undefined : texto,
  })
  const crudo = await r.text()
  let json: unknown = null
  try {
    json = crudo ? JSON.parse(crudo) : null
  } catch {
    json = crudo
  }
  return { estado: r.status, cuerpo: json as T }
}

/** Lo que EX le manda al bot, tal como lo apunta el bot falso. */
export interface CuerpoAlBot {
  telefono: string
  postulacionRef: string
  /** Esperas: hasta cuándo vale el anuncio, y el consentimiento que acaba de aceptar. */
  caducaEn?: string
  consentimiento?: { tipo: string; version: string; texto: string; aceptadoEn: string }
  /** Avisos. */
  avisoId?: string
  tipo?: string
  nombre?: string
  vacante?: string
  texto?: string
  /** Revocaciones: DEJAR_DE_RECIBIR, CAMBIO_CELULAR, PROCESO_TERMINADO o BORRADO_DATOS. */
  motivo?: string
}

export interface Llamada {
  tipo: 'ESPERA' | 'AVISO' | 'REVOCACION'
  recibidaEn: string
  cuerpo: CuerpoAlBot
}

/** Las novedades de un número, como las pide el bot: POST con el teléfono en el cuerpo. */
export async function novedadesDe(
  telefono: string,
): Promise<RespuestaDelBot<{ novedades: { vacante: string; titulo: string; texto: string }[] }>> {
  return comoElBot('/novedades', 'POST', { telefono })
}

/** Lo que EX le mandó al bot falso para ese número, en orden. */
export async function loQueRecibioElBot(e164: string): Promise<Llamada[]> {
  const r = await comoElBot<Llamada[]>(
    `/falso/registro?telefono=${encodeURIComponent(e164)}`,
    'GET',
  )
  if (r.estado !== 200) {
    throw new Error(`El registro del bot falso contestó ${r.estado}: ¿el backend no corre en modo falso?`)
  }
  return r.cuerpo
}

/** Enciende o apaga la beta desde el panel, como lo haría Renaser. Devuelve cómo estaba. */
export async function ponerLaBeta(token: string, encendida: boolean): Promise<string> {
  const antes = String(
    JSON.parse(
      sql(`select coalesce(json_agg(p.valor), '[]') from parametro p join organizacion o on o.id = p.organizacion_id
            where o.es_plataforma and p.codigo = ${literal(PARAMETRO_BETA)};`),
    )[0] ?? 'false',
  )
  await exigir(`/panel/parametros/${PARAMETRO_BETA}`, token, 'PUT', {
    valor: String(encendida),
    motivo: 'E2E de las novedades por WhatsApp',
  })
  return antes
}

/**
 * Lo de WhatsApp de estos números: avisos, vínculos y bajas. Va antes de retirar las
 * cuentas, porque los vínculos cuelgan de la postulación y del consentimiento.
 */
export function borrarLoDeWhatsapp(e164s: readonly string[]): void {
  if (!e164s.length) return
  const lista = e164s.map((t) => literal(t)).join(', ')
  sql(`begin;
       delete from aviso_whatsapp where telefono in (${lista});
       delete from aviso_whatsapp where vinculo_whatsapp_id in (select id from vinculo_whatsapp where telefono in (${lista}));
       delete from vinculo_whatsapp where telefono in (${lista});
       delete from whatsapp_baja where telefono in (${lista});
       commit;`)
}
