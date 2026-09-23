/**
 * El terreno de «Me olvidé mi contraseña».
 *
 * El backend del clon corre con el transporte de correo `log`: no manda nada y
 * guarda el texto entero en `correo_enviado`. **El enlace se lee de ahí**, que
 * es justo como la spec dice que se prueba en local.
 *
 * ⚠️ **La solicitud contesta antes de hacer el trabajo.** `POST …/recuperacion`
 * responde 202 al momento y crea el enlace y el correo en segundo plano, así que
 * leer la base justo después puede no encontrar nada todavía. Las esperas de
 * aquí sondean hasta que aparece lo nuevo.
 *
 * ⚠️ **El tope por IP es de la plataforma y cuenta todas las solicitudes del
 * proceso**, y en el clon todas salen de 127.0.0.1. Varias corridas seguidas
 * contra el mismo backend lo alcanzarían y las solicitudes se descartarían en
 * silencio —que es lo que el tope tiene que hacer—. Por eso se sube mientras
 * corren estas pruebas y se devuelve al valor que tenía al terminar.
 */

import { expect } from '@playwright/test'

import { API, tokenDelPanel } from './ayuda'
import { literal, sql } from './base-de-datos'

export const PLANTILLA_CANDIDATO = 'RECUPERAR_CLAVE_CANDIDATO'
export const PLANTILLA_EQUIPO = 'RECUPERAR_CLAVE_EQUIPO'

export const MENSAJE_ENVIADO =
  'Si ese correo tiene una cuenta, te enviamos un enlace. Revisa también tu carpeta de spam. Vale por 60 minutos.'

const PARAMETRO_IP = 'max_recuperaciones_por_ip_hora'

/** Sube el tope por IP para esta corrida y devuelve cómo dejarlo como estaba. */
export function holgarElTopePorIp(): () => void {
  const antes = sql(`select valor from parametro p join organizacion o on o.id = p.organizacion_id
    where o.es_plataforma and p.codigo = ${literal(PARAMETRO_IP)};`)
  sql(`update parametro set valor = '100000' where codigo = ${literal(PARAMETRO_IP)}
    and organizacion_id = (select id from organizacion where es_plataforma);`)
  return () => {
    if (antes === '') return
    sql(`update parametro set valor = ${literal(antes)} where codigo = ${literal(PARAMETRO_IP)}
      and organizacion_id = (select id from organizacion where es_plataforma);`)
  }
}

/** Cuántos enlaces tiene la cuenta de ese correo, usados o no. */
export function enlacesDe(correo: string): number {
  return Number(sql(`select count(*) from recuperacion_clave r join usuario u on u.id = r.usuario_id
    where u.correo = ${literal(correo)};`))
}

/** Cuántos enlaces hay en toda la base: para probar que un correo sin cuenta no crea ninguno. */
export function enlacesEnTotal(): number {
  return Number(sql('select count(*) from recuperacion_clave;'))
}

/**
 * El enlace del último correo de ese tipo mandado a ese correo, **relativo**
 * —camino y query—, o '' si no hay. Relativo porque el backend lo arma con
 * `PORTAL_URL`, que puede no coincidir con la base de Playwright aunque apunten
 * al mismo sitio.
 */
function ultimoEnlace(correo: string, plantilla: string): string {
  const cuerpo = sql(`select c.cuerpo from correo_enviado c join usuario u on u.id = c.usuario_id
    where u.correo = ${literal(correo)} and c.plantilla_correo_codigo = ${literal(plantilla)}
    order by c.id desc limit 1;`)
  const enlace = /https?:\/\/\S+?\/restablecer\?token=[A-Za-z0-9_-]+/.exec(cuerpo)?.[0]
  if (!enlace) return ''
  const url = new URL(enlace)
  return url.pathname + url.search
}

/** Espera al correo con un enlace distinto de `anterior` y lo devuelve, relativo. */
export async function esperarEnlace(correo: string, plantilla: string, anterior = ''): Promise<string> {
  await expect
    .poll(() => ultimoEnlace(correo, plantilla), {
      message: `el correo de ${plantilla} con un enlace nuevo`,
      timeout: 20_000,
    })
    .not.toBe(anterior)
  return ultimoEnlace(correo, plantilla)
}

/** El token de una dirección relativa de restablecer. */
export const tokenDe = (ruta: string): string =>
  new URL(ruta, 'http://x.invalid').searchParams.get('token') ?? ''

/** Pide el enlace por la API, como lo haría la pantalla. */
export async function pedirPorApi(puerta: 'portal' | 'panel', correo: string): Promise<number> {
  const r = await fetch(`${API}/${puerta}/auth/recuperacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo }),
  })
  return r.status
}

/** Intenta entrar por la API y devuelve el estado: 200, 401 o 429. */
export async function entrarPorApi(puerta: 'portal' | 'panel', correo: string, contrasena: string) {
  const r = await fetch(`${API}/${puerta}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })
  return r.status
}

/**
 * Una cuenta de equipo con contraseña, por el camino de verdad: alguien de la
 * plataforma invita y el invitado canjea. La limpieza de cuentas borra también
 * la invitación.
 */
export async function crearCuentaDeEquipo(correo: string, contrasena: string): Promise<void> {
  const token = await tokenDelPanel()
  const conToken = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const roles = (await (await fetch(`${API}/panel/roles`, { headers: conToken })).json()) as {
    codigo: string
  }[]
  const rol = roles.find((r) => r.codigo === 'TALENTO') ?? roles[0]
  if (!rol) throw new Error('El catálogo de roles llegó vacío: sin rol no se puede invitar a nadie')
  const invitacion = await fetch(`${API}/panel/usuarios/invitaciones`, {
    method: 'POST',
    headers: conToken,
    body: JSON.stringify({ correo, roles: [rol.codigo] }),
  })
  if (!invitacion.ok) {
    throw new Error(`No se pudo crear la invitación (${invitacion.status}): ${await invitacion.text()}`)
  }
  const { url } = (await invitacion.json()) as { url: string }
  const canje = await fetch(`${API}/panel/auth/invitacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: new URL(url).searchParams.get('token'),
      nombre: 'Equipo',
      apellidos: 'De Prueba',
      contrasena,
    }),
  })
  if (!canje.ok) throw new Error(`No se pudo canjear la invitación (${canje.status}): ${await canje.text()}`)
}
