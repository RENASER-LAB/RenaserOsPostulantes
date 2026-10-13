/**
 * El terreno de las novedades por WhatsApp (V73).
 *
 * El backend del clon corre con el bot de WhatsApp **falso** (`app.whatsapp.modo=falso`, el
 * perfil local): no sale nada hacia ningún sitio y apunta lo que le mandaría al bot de
 * verdad. Desde aquí se hace de bot:
 *
 *   - se leen sus apuntes en `GET /integraciones/whatsapp/falso/registro?telefono=…`;
 *   - se le llama a EX como lo haría el bot (`/vinculos`, `/bajas`), con la firma HMAC.
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

/** Las dos cabeceras de la firma: HMAC-SHA256 de «marca.cuerpo». */
function firmado(cuerpo: string): Record<string, string> {
  const marca = String(Math.floor(Date.now() / 1000))
  const firma = createHmac('sha256', SECRETO_DEL_BOT).update(`${marca}.${cuerpo}`).digest('hex')
  return { 'X-Renaser-Marca': marca, 'X-Renaser-Firma': firma }
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
  const r = await fetch(`${API}/integraciones/whatsapp${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(sinFirma ? {} : firmado(texto)),
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

export interface Llamada {
  tipo: 'ESPERA' | 'AVISO' | 'REVOCACION'
  recibidaEn: string
  cuerpo: Record<string, string>
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
