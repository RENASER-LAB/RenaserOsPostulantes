import { expect, type Page } from '@playwright/test'

import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  test,
} from './ayuda-candidato'
import {
  crearCuentaDeEquipo,
  enlacesDe,
  esperarEnlace,
  holgarElTopePorIp,
  MENSAJE_ENVIADO,
  pedirPorApi,
  PLANTILLA_CANDIDATO,
  PLANTILLA_EQUIPO,
  tokenDe,
} from './ayuda-recuperacion'
import { literal, sql } from './base-de-datos'

/**
 * «Me olvidé mi contraseña»: los criterios y bordes que los cinco recorridos de
 * `33-recuperar-contrasena.spec.ts` no tocan.
 *
 *   - AC-10: pedir dos veces; el primer enlace ya no sirve y el segundo sí.
 *   - AC-11 · AC-12 · AC-13: las reglas del formulario no gastan el enlace, y
 *     «no coinciden» ni siquiera llama al servidor.
 *   - AC-15 · AC-18 · AC-19: cuatro solicitudes dan tres enlaces y tres correos
 *     NO_ENVIADO; la auditoría lleva cuenta y momento y en ninguna fila está el
 *     token.
 *   - AC-03 · AC-05: cuenta desactivada, de carga masiva o de la otra puerta: ni
 *     un enlace.
 *   - AC-16: el token no vuelve con «atrás» ni «adelante».
 *   - Casos límite: correo vacío o mal formado sin llamada, doble clic en
 *     «Enviar enlace» y en «Guardar contraseña», enlace sin token.
 *
 * Las regresiones de los hallazgos de QA van aparte, en
 * `36-recuperar-contrasena-regresiones.spec.ts`: este archivo es serial y un
 * hallazgo abierto no debe dejar sin correr los criterios que ya se cumplen.
 *
 * ⚠️ **ESCRIBE**: crea cuentas `e2e.rcb.*.<uuid>@example.com`
 * —de candidato y una de equipo— y las borra al terminar. La de carga masiva se
 * renombra a `@cv-convocatoria.local` para la prueba y recupera su correo antes
 * de la limpieza. La auditoría de cada solicitud queda, sin usuario ni token.
 */
test.describe.configure({ mode: 'serial' })

const REEMPLAZADA = correoDePrueba('e2e.rcb.reemplazada')
const REGLAS = correoDePrueba('e2e.rcb.reglas')
const TOPE = correoDePrueba('e2e.rcb.tope')
const INACTIVA = correoDePrueba('e2e.rcb.inactiva')
const MASIVA = correoDePrueba('e2e.rcb.masiva')
const CONTROL = correoDePrueba('e2e.rcb.control')
const HISTORIAL = correoDePrueba('e2e.rcb.historial')
const DOBLE = correoDePrueba('e2e.rcb.doble')
const EQUIPO = correoDePrueba('e2e.rcb.equipo')
const MASIVA_INVENTADA = MASIVA.replace('@example.com', '@cv-convocatoria.local')

const CANDIDATAS = [REEMPLAZADA, REGLAS, TOPE, INACTIVA, MASIVA, CONTROL, HISTORIAL, DOBLE]
const CLAVE_NUEVA = 'otraClaveNueva2026'
const CLAVE_DE_EQUIPO = 'unaClaveLargaDeBordes2026'

let devolverElTope: () => void = () => {}

/** Cuántas peticiones a esa ruta de la API hace la página mientras corre `accion`. */
async function contarPeticiones(page: Page, ruta: string, accion: () => Promise<void>): Promise<number> {
  let cuantas = 0
  const escuchar = (r: { url: () => string; method: () => string }) => {
    if (r.method() === 'POST' && r.url().includes(ruta)) cuantas++
  }
  page.on('request', escuchar)
  try {
    await accion()
  } finally {
    page.off('request', escuchar)
  }
  return cuantas
}

async function escribirClave(page: Page, nueva: string, repetir = nueva) {
  await page.getByLabel(/^Contraseña nueva/).fill(nueva)
  await page.getByLabel('Repetir contraseña').fill(repetir)
}

const guardar = (page: Page) => page.getByRole('button', { name: 'Guardar contraseña' })

/** Cuerpos de los correos de recuperación de esa cuenta, del más viejo al más nuevo. */
function correosDe(correo: string, plantilla: string): { estado: string; cuerpo: string }[] {
  const filas = sql(`select json_agg(json_build_object('estado', c.estado_entrega, 'cuerpo', c.cuerpo) order by c.id)
    from correo_enviado c join usuario u on u.id = c.usuario_id
    where u.correo = ${literal(correo)} and c.plantilla_correo_codigo = ${literal(plantilla)};`)
  return filas === '' ? [] : (JSON.parse(filas) as { estado: string; cuerpo: string }[])
}

/**
 * Pide un enlace para el testigo y espera a que su correo llegue. La cola atiende
 * en orden: cuando el del testigo está, lo pedido antes ya se atendió, y un «no se
 * creó nada» deja de poder ser un «todavía no se creó».
 */
async function esperarAlTestigo(): Promise<void> {
  const antes = correosDe(CONTROL, PLANTILLA_CANDIDATO).length
  expect(await pedirPorApi('portal', CONTROL)).toBe(202)
  await expect
    .poll(() => correosDe(CONTROL, PLANTILLA_CANDIDATO).length, { message: 'el correo del testigo', timeout: 20_000 })
    .toBe(antes + 1)
}

test.describe('Me olvidé mi contraseña · criterios y bordes', () => {
  test.beforeAll(async () => {
    devolverElTope = holgarElTopePorIp()
    for (const correo of CANDIDATAS) {
      await crearCuentaDeCandidato({ nombre: 'Borde', apellidos: 'Recupera', correo })
    }
    await crearCuentaDeEquipo(EQUIPO, CLAVE_DE_EQUIPO)
  })

  test.afterAll(() => {
    devolverElTope()
    // La de carga masiva vuelve a su correo de prueba para que la limpieza la encuentre.
    sql(`update usuario set correo = ${literal(MASIVA)} where correo = ${literal(MASIVA_INVENTADA)};`)
    borrarCuentasDePrueba([...CANDIDATAS, EQUIPO])
  })

  test('AC-10 · pedir otro deja sin efecto el primero: el enlace viejo no sirve y el nuevo sí', async ({ page }) => {
    expect(await pedirPorApi('portal', REEMPLAZADA)).toBe(202)
    const primero = await esperarEnlace(REEMPLAZADA, PLANTILLA_CANDIDATO)
    expect(await pedirPorApi('portal', REEMPLAZADA)).toBe(202)
    const segundo = await esperarEnlace(REEMPLAZADA, PLANTILLA_CANDIDATO, primero)

    await page.goto(primero)
    await escribirClave(page, CLAVE_NUEVA)
    await guardar(page).click()
    await expect(page.getByRole('heading', { name: 'Este enlace ya no sirve.' })).toBeVisible()
    await expect(page.getByText(/^Pide uno nuevo\./)).toBeVisible()

    await page.goto(segundo)
    await escribirClave(page, CLAVE_NUEVA)
    await guardar(page).click()
    await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })
    await expect(page.getByText('Contraseña cambiada exitosamente')).toBeVisible()
  })

  test('AC-11 · AC-12 · AC-13 · las reglas avisan en el campo y el enlace sigue sirviendo', async ({ page }) => {
    expect(await pedirPorApi('portal', REGLAS)).toBe(202)
    const enlace = await esperarEnlace(REGLAS, PLANTILLA_CANDIDATO)
    await page.goto(enlace)

    // Menos de 8 y no coinciden: se dice en el campo y no sale ninguna petición
    const sinLlamar = await contarPeticiones(page, '/auth/restablecer', async () => {
      await escribirClave(page, 'corta7x')
      await guardar(page).click()
      await expect(page.getByText('La contraseña necesita al menos 8 caracteres.')).toBeVisible()

      await escribirClave(page, 'unaClaveBuena2026', 'unaClaveBuena2027')
      await guardar(page).click()
      const repetir = page.getByLabel('Repetir contraseña')
      await expect(repetir).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByText('Las dos contraseñas no coinciden.')).toBeVisible()
      await expect(repetir).toBeFocused()

      await escribirClave(page, ' conEspacio2026', ' conEspacio2026')
      await guardar(page).click()
      await expect(page.getByText(/no puede empezar ni terminar con un espacio/)).toBeVisible()
    })
    expect(sinLlamar, 'las reglas del navegador no llaman al servidor').toBe(0)

    // La misma de ahora: la rechaza el servidor, en el campo, sin gastar el enlace
    await escribirClave(page, CLAVE_DE_CANDIDATO)
    await guardar(page).click()
    await expect(page.getByText('Elige una contraseña distinta a la anterior')).toBeVisible()
    await expect(page.getByLabel(/^Contraseña nueva/)).toHaveAttribute('aria-invalid', 'true')

    // Y el mismo enlace todavía cambia la contraseña
    await escribirClave(page, CLAVE_NUEVA)
    await guardar(page).click()
    await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })
    await expect(page.getByText('Contraseña cambiada exitosamente')).toBeFocused()
  })

  test('AC-15 · AC-18 · AC-19 · cuatro solicitudes: tres enlaces, tres correos NO_ENVIADO y auditoría sin token', async ({
    page,
  }) => {
    for (let i = 0; i < 4; i++) expect(await pedirPorApi('portal', TOPE)).toBe(202)
    await esperarAlTestigo()

    expect(enlacesDe(TOPE), 'la cuarta de la hora no crea enlace').toBe(3)
    const correos = correosDe(TOPE, PLANTILLA_CANDIDATO)
    expect(correos, 'la cuarta de la hora no manda correo').toHaveLength(3)
    for (const { estado, cuerpo } of correos) {
      expect(estado, 'con el transporte log el correo queda NO_ENVIADO').toBe('NO_ENVIADO')
      expect(cuerpo).toMatch(/\/restablecer\?token=[A-Za-z0-9_-]{43}/)
      expect(cuerpo).toMatch(/vence el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2}/)
    }

    // El último enlace se usa, y el cambio también queda en la auditoría
    const enlace = await esperarEnlace(TOPE, PLANTILLA_CANDIDATO)
    await page.goto(enlace)
    await escribirClave(page, CLAVE_NUEVA)
    await guardar(page).click()
    await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })

    const cuenta = sql(`select id from usuario where correo = ${literal(TOPE)};`)
    const acciones = sql(`select accion || ':' || count(*) || ':' || (case when bool_and(ocurrida_en is not null) then 'con-momento' else 'sin-momento' end)
        from auditoria where entidad = 'usuario' and entidad_id = ${cuenta}
         and accion in ('solicitar_recuperacion_clave', 'restablecer_clave')
       group by accion order by accion;`)
    expect(acciones.split('\n')).toEqual([
      'restablecer_clave:1:con-momento',
      'solicitar_recuperacion_clave:3:con-momento',
    ])

    const tokens = correos.map(({ cuerpo }) => tokenDe(/\/restablecer\?\S+/.exec(cuerpo)![0]))
    for (const token of tokens) {
      const conToken = sql(`select count(*) from auditoria
          where coalesce(valor_nuevo::text, '') || coalesce(valor_anterior::text, '') || coalesce(motivo, '')
                like ${literal(`%${token}%`)};`)
      expect(conToken, 'ninguna fila de auditoría lleva el token').toBe('0')
    }
    const conHash = sql(`select count(*) from auditoria a join recuperacion_clave r on r.usuario_id = a.entidad_id
        where a.entidad = 'usuario' and a.entidad_id = ${cuenta}
          and coalesce(a.valor_nuevo::text, '') like '%' || r.token_hash || '%';`)
    expect(conHash, 'ni su hash').toBe('0')
  })

  test('AC-03 · AC-05 · desactivada, de carga masiva o de la otra puerta: el mismo mensaje y ningún enlace', async ({
    page,
  }) => {
    sql(`update usuario set es_activo = false where correo = ${literal(INACTIVA)};`)
    sql(`update usuario set correo = ${literal(MASIVA_INVENTADA)} where correo = ${literal(MASIVA)};`)

    for (const correo of [INACTIVA, MASIVA_INVENTADA]) {
      await page.goto('/clave')
      await page.getByLabel('Correo').fill(correo)
      await page.getByRole('button', { name: 'Enviar enlace' }).click()
      await expect(page.getByText(MENSAJE_ENVIADO)).toBeVisible()
    }
    // Un candidato activo pedido en el panel, y la cuenta de equipo pedida en el portal
    await page.goto('/admin/clave')
    await page.getByLabel('Correo').fill(CONTROL)
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText(MENSAJE_ENVIADO)).toBeVisible()
    expect(await pedirPorApi('portal', EQUIPO)).toBe(202)

    await esperarAlTestigo()

    expect(enlacesDe(INACTIVA), 'cuenta desactivada').toBe(0)
    expect(enlacesDe(MASIVA_INVENTADA), 'cuenta de carga masiva').toBe(0)
    expect(enlacesDe(EQUIPO), 'correo de equipo pedido en el portal').toBe(0)
    expect(correosDe(CONTROL, PLANTILLA_EQUIPO), 'correo de candidato pedido en el panel').toHaveLength(0)
  })

  test('AC-16 · el token no vuelve a la barra con «atrás» ni «adelante»', async ({ page }) => {
    expect(await pedirPorApi('portal', HISTORIAL)).toBe(202)
    const enlace = await esperarEnlace(HISTORIAL, PLANTILLA_CANDIDATO)

    await page.goto('/ingresar')
    await page.goto(enlace)
    await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva.' })).toBeVisible()
    await expect(page).toHaveURL(/\/restablecer$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/ingresar$/)
    await page.goForward()
    await expect(page).toHaveURL(/\/restablecer$/)
    expect(page.url()).not.toContain('token')
    await expect(page.getByRole('heading', { name: 'El enlace está incompleto.' })).toBeVisible()

    // Abrir el enlace no lo gastó: sigue sirviendo
    await page.goto(enlace)
    await escribirClave(page, CLAVE_NUEVA)
    await guardar(page).click()
    await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })
  })

  test('casos límite · correo vacío o mal escrito no llama; el doble clic manda una sola petición', async ({ page }) => {
    await page.goto('/clave')
    const invalidas = await contarPeticiones(page, '/auth/recuperacion', async () => {
      await page.getByRole('button', { name: 'Enviar enlace' }).click()
      await expect(page.getByText('Escribe tu correo.')).toBeVisible()
      await page.getByLabel('Correo').fill('sin-arroba.com')
      await page.getByRole('button', { name: 'Enviar enlace' }).click()
      await expect(page.getByText(/no parece un correo/)).toBeVisible()
      await expect(page.getByLabel('Correo')).toBeFocused()
    })
    expect(invalidas, 'un correo vacío o mal formado no sale del navegador').toBe(0)

    const pedidas = await contarPeticiones(page, '/auth/recuperacion', async () => {
      await page.getByLabel('Correo').fill(correoDePrueba('e2e.rcb.nadie'))
      await page.getByRole('button', { name: 'Enviar enlace' }).dblclick()
      await expect(page.getByText(MENSAJE_ENVIADO)).toBeFocused()
      await expect(page.getByRole('button', { name: /reenviar enlace \(en \d+ s\)/i })).toBeDisabled()
    })
    expect(pedidas, 'doble clic en «Enviar enlace»').toBe(1)

    expect(await pedirPorApi('portal', DOBLE)).toBe(202)
    const enlace = await esperarEnlace(DOBLE, PLANTILLA_CANDIDATO)
    await page.goto(enlace)
    await escribirClave(page, CLAVE_NUEVA)
    const guardadas = await contarPeticiones(page, '/auth/restablecer', async () => {
      await guardar(page).dblclick()
      await expect(page).toHaveURL(/\/ingresar$/, { timeout: 15_000 })
    })
    expect(guardadas, 'doble clic en «Guardar contraseña»').toBe(1)
  })

  test('enlace sin token: lo dice y lleva a pedir otro en su propia puerta', async ({ page }) => {
    await page.goto('/restablecer')
    await expect(page.getByRole('heading', { name: 'El enlace está incompleto.' })).toBeVisible()
    await expect(page.getByText(/^Cópialo entero desde el correo\./)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute('href', '/clave')

    await page.goto('/admin/restablecer?token=')
    await expect(page.getByRole('heading', { name: 'El enlace está incompleto.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute('href', '/admin/clave')
  })
})
