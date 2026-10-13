import { expect, type Page } from '@playwright/test'
import { API } from './ayuda'
import { crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import { correoDePrueba, limpiarSiempre, literal, sql } from './base-de-datos'
import {
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
  pedir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, publicarPrueba, retirarLoSembrado } from './ayuda-prueba-propia'
import {
  borrarLoDeWhatsapp,
  celularUnico,
  comoElBot,
  direccionDelBot,
  firmaDelBot,
  loQueRecibioElBot,
  novedadesDe,
  ponerLaBeta,
} from './ayuda-whatsapp'

/**
 * QA de las novedades por WhatsApp (V73): los bordes que el recorrido principal
 * (`58-novedades-por-whatsapp.spec.ts`) no pisa.
 *
 *   - AC-04 · con la beta apagada no hay tarjeta, ni anuncio, ni vínculo.
 *   - AC-07 / AC-14 · un número no anunciado da 404 SIN_ANUNCIO; firma mala, marca vieja, de
 *     otra ruta o con el cuerpo cambiado dan 401 {codigo: FIRMA_INVALIDA} y no vinculan.
 *   - Contrato · sin teléfono o con uno que no vale, /vinculos, /novedades y /bajas dan
 *     400 {codigo: VALIDACION}, nunca 500.
 *   - AC-13 · la baja del bot (204, también repetida) deja «Este número se dio de baja de
 *     nuestros mensajes», sin botón, y el botón ya no anuncia ese número.
 *   - AC-17 · «Estamos revisando tu postulación» dice «No tienes que hacer nada.» una vez.
 *   - Doble clic: un solo anuncio vivo y un solo consentimiento.
 *   - Dueño: la postulación de otra persona es 404.
 *   - Proceso terminado entre el botón y el mensaje: 409 PROCESO_TERMINADO y revocación.
 *   - Dos cuentas con el mismo celular: /vinculos devuelve todas las activas del número,
 *     también las ya vinculadas, y repetido da lo mismo; cambiar el celular de una no toca la
 *     otra.
 *   - Móvil: el botón ocupa el ancho de la tarjeta, el número no se parte (375 y 320 px) y no
 *     hay desplazamiento lateral.
 *
 * El backend del clon corre con el bot falso (perfil local). ⚠️ **ESCRIBE** en el clon del
 * trabajo; `afterAll` lo retira (marca QA-WAQ-0073) y deja la beta como estaba.
 */

const MARCA = 'QA-WAQ-0073'
const TITULO = 'Auxiliar de Tesorería'
const PREFIJO = 'qa.waq.0073'

const correos: string[] = []
const celulares: string[] = []
let equipo = ''
let vacante = 0
let betaAntes = 'false'

interface Cuenta {
  correo: string
  token: string
  celular: ReturnType<typeof celularUnico>
}

async function cuentaCon(nombre: string, celular = celularUnico()): Promise<Cuenta> {
  const correo = correoDePrueba(PREFIJO)
  correos.push(correo)
  if (!celulares.includes(celular.e164)) celulares.push(celular.e164)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Borde', correo, telefono: celular.escrito })
  return { correo, token: await tokenDelCandidato(correo), celular }
}

/** Postula y la deja en un momento de espera (por defecto «Estamos calificando tus respuestas»). */
async function postuladaYEsperando(cuenta: Cuenta, estado = 'PERFIL_CALIFICANDO'): Promise<string> {
  const uuid = await postular(cuenta.token, vacante)
  sql(`update postulacion set estado_codigo = ${literal(estado)} where uuid = ${literal(uuid)};`)
  return uuid
}

const tarjeta = (page: Page) => page.getByRole('region', { name: /novedades por WhatsApp/i }).first()

const VINCULOS = direccionDelBot('/vinculos')

/** La firma del bot para /vinculos con la marca que se quiera (para probar la ventana de cinco minutos). */
function firmaCon(marca: number, cuerpo: string, secreto?: string): Record<string, string> {
  return firmaDelBot(VINCULOS, cuerpo, { marca, secreto })
}

async function vinculosCon(cabeceras: Record<string, string>, cuerpo: string): Promise<number> {
  const r = await fetch(VINCULOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: cuerpo,
  })
  return r.status
}

const vivos = (postulacion: number) =>
  Number(
    uno(`select count(*) as n from vinculo_whatsapp
          where postulacion_id = ${postulacion} and estado in ('PENDIENTE', 'ACTIVO')`).n,
  )

const firmasWhatsapp = (postulacion: number) =>
  Number(
    uno(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
          where t.tipo = 'WHATSAPP' and c.postulacion_id = ${postulacion}`).n,
  )

test.describe('Novedades por WhatsApp · bordes de QA', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)
    vacante = await crearVacante(equipo, TITULO, lugar, undefined, MARCA)
    await escribirBorrador(equipo, vacante, [
      {
        nombre: 'General',
        preguntas: [
          { tipo: 'ABIERTA', enunciado: 'Cuéntanos un arqueo de caja difícil.', puntos: 100, queDebeTener: 'El monto y la causa.' },
        ],
      },
    ])
    await publicarPreguntas(equipo, vacante)
    await escribirPrueba(equipo, vacante, {
      criterios: [
        {
          nombre: 'Arqueo',
          puntosCalificados: 100,
          calificador: 'IA',
          preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo cuadrarías la caja chica?', queDebeTener: 'El arqueo.' }],
        },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60, guiaCalificacion: 'Mira las cifras.' },
    })
    const publicada = await publicarPrueba(equipo, vacante)
    if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
    await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
    await exigir(`/panel/vacantes/${vacante}/calificacion-automatica`, equipo, 'POST', { activa: false })
    betaAntes = await ponerLaBeta(equipo, true)
  })

  test.afterAll(async () => {
    await limpiarSiempre([
      () => ponerLaBeta(equipo, betaAntes === 'true').then(() => undefined),
      () => borrarLoDeWhatsapp(celulares),
      () => retirarLoSembrado(correos),
      () => {
        sql(`update vacante set eliminada_en = now() where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null;`)
        sql(`update solicitud_talento set estado = 'ARCHIVADA'
              where motivo like ${literal(`${MARCA}%`)} and estado <> 'ARCHIVADA';`)
      },
    ])
  })

  test('AC-04 · con la beta apagada no hay tarjeta, ni anuncio, ni vínculo', async ({ page }) => {
    const fer = await cuentaCon('Fernanda')
    const uuid = await postuladaYEsperando(fer)
    await entrarAlPortalCon(page, fer.token)
    await ponerLaBeta(equipo, false)
    try {
      await page.goto('/procesos')
      await expect(page.getByText('Estamos calificando tus respuestas').first()).toBeVisible()
      await expect(page.getByText('Recibe tus novedades por WhatsApp')).toHaveCount(0)
      await page.goto(`/procesos/${uuid}`)
      await expect(page.getByText('Estamos calificando tus respuestas').first()).toBeVisible()
      await expect(page.getByText('Recibe tus novedades por WhatsApp')).toHaveCount(0)

      const boton = await pedir(`/portal/postulaciones/${uuid}/whatsapp`, fer.token, 'POST')
      expect(boton.estado).toBe(409)
      expect(boton.cuerpo.codigo).toBe('NO_DISPONIBLE')
      const bot = await comoElBot('/vinculos', 'POST', { telefono: fer.celular.e164, wamid: 'w-fer', texto: 'hola' })
      expect(bot.estado).toBe(409)
      expect(bot.cuerpo.codigo).toBe('BETA_APAGADA')
      expect(bot.cuerpo.texto).toBeTruthy()
      expect(await loQueRecibioElBot(fer.celular.e164)).toEqual([])
      expect(vivos(postulacionPorUuid(uuid))).toBe(0)
    } finally {
      await ponerLaBeta(equipo, true)
    }
    // Encendida otra vez, la misma postulación sí la ofrece.
    await page.reload()
    await expect(tarjeta(page).getByRole('button', { name: 'Escribir por WhatsApp' })).toBeVisible()
  })

  test('AC-07 / AC-14 · sin anuncio es 404; firma mala, marca vieja, de otra ruta o cuerpo cambiado son 401 y no vinculan', async () => {
    const gabi = await cuentaCon('Gabriela')
    const uuid = await postuladaYEsperando(gabi)
    const sinAnuncio = await comoElBot('/vinculos', 'POST', { telefono: gabi.celular.e164, wamid: 'w-gabi-0', texto: 'hola' })
    expect(sinAnuncio.estado).toBe(404)
    expect(sinAnuncio.cuerpo.codigo).toBe('SIN_ANUNCIO')
    expect(sinAnuncio.cuerpo.texto).toContain('Escribir por WhatsApp')

    await exigir(`/portal/postulaciones/${uuid}/whatsapp`, gabi.token, 'POST')
    const cuerpo = JSON.stringify({ telefono: gabi.celular.e164, wamid: 'w-gabi-1', texto: 'hola' })
    const ahora = Math.floor(Date.now() / 1000)
    expect(await vinculosCon(firmaCon(ahora - 360, cuerpo), cuerpo), 'marca de hace 6 minutos').toBe(401)
    expect(await vinculosCon(firmaCon(ahora + 360, cuerpo), cuerpo), 'marca 6 minutos en el futuro').toBe(401)
    expect(await vinculosCon(firmaCon(ahora, cuerpo, 'otro-secreto'), cuerpo), 'otro secreto').toBe(401)
    expect(await vinculosCon({ ...firmaCon(ahora, cuerpo), 'X-Renaser-Firma': '0'.repeat(64) }, cuerpo), 'firma mala').toBe(401)
    const otro = JSON.stringify({ telefono: gabi.celular.e164, wamid: 'w-gabi-2', texto: 'cambiado' })
    expect(await vinculosCon(firmaCon(ahora, cuerpo), otro), 'cuerpo cambiado tras firmar').toBe(401)
    expect(
      await vinculosCon(firmaDelBot(direccionDelBot('/bajas'), cuerpo, { marca: ahora }), cuerpo),
      'firma de otra ruta',
    ).toBe(401)
    expect(await vinculosCon({ Authorization: `Bearer ${gabi.token}` }, cuerpo), 'token de candidato').toBe(401)
    // El 401 lleva el formato de los errores de EX hacia el bot: {codigo, texto}.
    const sinFirma = await comoElBot('/vinculos', 'POST', JSON.parse(cuerpo), { sinFirma: true })
    expect(sinFirma.estado).toBe(401)
    expect(sinFirma.cuerpo).toMatchObject({ codigo: 'FIRMA_INVALIDA', texto: expect.any(String) })
    // Nada de eso vinculó: sigue pendiente.
    const lista = await exigir<any[]>('/portal/postulaciones', gabi.token)
    expect(lista.find((p) => p.uuid === uuid)?.whatsapp?.estado).toBe('PENDIENTE')
    // La buena sí.
    expect(await vinculosCon(firmaCon(ahora, cuerpo), cuerpo)).toBe(200)
  })

  test('contrato · sin teléfono o con uno que no vale es 400 VALIDACION en /vinculos, /novedades y /bajas', async () => {
    // Es definitivo para el bot (un 4xx que no es 401): tiene que ser un 400 con {codigo, texto},
    // nunca un 500, que el bot reintentaría.
    for (const ruta of ['/vinculos', '/novedades', '/bajas']) {
      for (const cuerpo of [{}, { telefono: '' }, { telefono: 'no-es-un-numero' }]) {
        const r = await comoElBot(ruta, 'POST', cuerpo)
        expect(r.estado, `${ruta} ${JSON.stringify(cuerpo)}`).toBe(400)
        expect(r.cuerpo, `${ruta} ${JSON.stringify(cuerpo)}`).toMatchObject({ codigo: 'VALIDACION', texto: expect.any(String) })
      }
    }
  })

  test('AC-13 · la baja del bot deja el número suprimido en el portal, sin botón', async ({ page }) => {
    const hugo = await cuentaCon('Hugo')
    const uuid = await postuladaYEsperando(hugo)
    await exigir(`/portal/postulaciones/${uuid}/whatsapp`, hugo.token, 'POST')
    expect((await comoElBot('/vinculos', 'POST', { telefono: hugo.celular.e164, wamid: 'w-hugo', texto: 'hola' })).estado).toBe(200)

    // 204, también la segunda vez, cuando ya no queda nada que desvincular.
    const baja = await comoElBot('/bajas', 'POST', { telefono: hugo.celular.e164.replace('+', '') })
    expect(baja.estado).toBe(204)
    expect(vivos(postulacionPorUuid(uuid))).toBe(0)
    const otraVez = await comoElBot('/bajas', 'POST', { telefono: hugo.celular.e164 })
    expect(otraVez.estado).toBe(204)

    await entrarAlPortalCon(page, hugo.token)
    for (const ruta of ['/procesos', `/procesos/${uuid}`]) {
      await page.goto(ruta)
      await expect(tarjeta(page).getByText('Este número se dio de baja de nuestros mensajes')).toBeVisible()
      await expect(tarjeta(page).getByRole('button')).toHaveCount(0)
    }
    const boton = await pedir(`/portal/postulaciones/${uuid}/whatsapp`, hugo.token, 'POST')
    expect(boton.estado).toBe(409)
    expect(boton.cuerpo.codigo).toBe('SUPRIMIDO')
    expect((await novedadesDe(hugo.celular.e164)).cuerpo.novedades).toEqual([])
    expect((await loQueRecibioElBot(hugo.celular.e164)).filter((l) => l.tipo === 'ESPERA')).toHaveLength(1)
  })

  test('AC-17 · «Estamos revisando tu postulación» dice «No tienes que hacer nada.» una sola vez', async ({ page }) => {
    const ines = await cuentaCon('Inés')
    const uuid = await postuladaYEsperando(ines, 'POSTULADA')
    await entrarAlPortalCon(page, ines.token)
    for (const ruta of ['/procesos', `/procesos/${uuid}`]) {
      await page.goto(ruta)
      await expect(page.getByText('Estamos revisando tu postulación').first()).toBeVisible()
      await expect(tarjeta(page)).toBeVisible()
      const visible = await page.locator('main').innerText()
      expect(visible.match(/No tienes que hacer nada\./g) ?? [], ruta).toHaveLength(1)
      expect(visible).toContain('Comprobamos los requisitos indispensables del puesto. No tienes que hacer nada.')
    }
  })

  test('doble clic en «Escribir por WhatsApp»: un anuncio vivo, un consentimiento, una pestaña', async ({ page }) => {
    const juan = await cuentaCon('Juan')
    const uuid = await postuladaYEsperando(juan)
    await entrarAlPortalCon(page, juan.token)
    await page.context().route('https://wa.me/**', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp de mentira</p>' }),
    )
    const pestanas: Page[] = []
    page.context().on('page', (p) => pestanas.push(p))
    await page.goto(`/procesos/${uuid}`)
    await tarjeta(page).getByRole('button', { name: 'Escribir por WhatsApp' }).dblclick()
    await expect(tarjeta(page).getByText(/Aún no recibimos tu mensaje/)).toBeVisible()
    await expect.poll(() => pestanas.length).toBe(1)
    const postulacion = postulacionPorUuid(uuid)
    expect(vivos(postulacion)).toBe(1)
    expect(firmasWhatsapp(postulacion)).toBe(1)
    // Volver a pulsar renueva el mismo anuncio: ni otro vínculo ni otra firma.
    await exigir(`/portal/postulaciones/${uuid}/whatsapp`, juan.token, 'POST')
    expect(vivos(postulacion)).toBe(1)
    expect(firmasWhatsapp(postulacion)).toBe(1)
  })

  test('dueño · la postulación de otra persona es 404, y sin token 401', async () => {
    const kati = await cuentaCon('Katia')
    const luis = await cuentaCon('Luis')
    const uuid = await postuladaYEsperando(kati)
    expect((await pedir(`/portal/postulaciones/${uuid}/whatsapp`, luis.token, 'POST')).estado).toBe(404)
    expect((await pedir(`/portal/postulaciones/${uuid}/whatsapp`, luis.token, 'DELETE')).estado).toBe(404)
    const sinToken = await fetch(`${API}/portal/postulaciones/${uuid}/whatsapp`, { method: 'POST' })
    expect(sinToken.status).toBe(401)
    expect(vivos(postulacionPorUuid(uuid))).toBe(0)
    expect(await loQueRecibioElBot(luis.celular.e164)).toEqual([])
  })

  test('proceso terminado entre el botón y el mensaje: 409 PROCESO_TERMINADO y revocación', async () => {
    const mia = await cuentaCon('Mía')
    const uuid = await postuladaYEsperando(mia)
    await exigir(`/portal/postulaciones/${uuid}/whatsapp`, mia.token, 'POST')
    await exigir(`/panel/postulaciones/${postulacionPorUuid(uuid)}/transiciones`, equipo, 'POST', {
      estadoDestino: 'NO_CONTINUA',
      motivo: 'QA de WhatsApp: termina antes de que escriba',
      avisar: false,
    })
    const r = await comoElBot('/vinculos', 'POST', { telefono: mia.celular.e164, wamid: 'w-mia', texto: 'hola' })
    expect(r.estado).toBe(409)
    expect(r.cuerpo).toMatchObject({
      codigo: 'PROCESO_TERMINADO',
      texto: 'No tienes procesos activos con avisos por WhatsApp. Puedes ver todo en el portal, en «Mis procesos».',
    })
    await expect
      .poll(async () => (await loQueRecibioElBot(mia.celular.e164)).filter((l) => l.tipo === 'REVOCACION').map((l) => l.cuerpo.motivo), {
        timeout: 40_000,
        intervals: [500, 1_000, 2_000],
      })
      .toEqual(['PROCESO_TERMINADO'])
    expect((await loQueRecibioElBot(mia.celular.e164)).filter((l) => l.tipo === 'AVISO')).toEqual([])
  })

  test('dos cuentas con el mismo celular: /vinculos devuelve también lo ya vinculado; cambiar el de una no toca la otra', async () => {
    const compartido = celularUnico()
    const nora = await cuentaCon('Nora', compartido)
    const omar = await cuentaCon('Omar', compartido)
    const deNora = await postuladaYEsperando(nora)
    const deOmar = await postuladaYEsperando(omar)

    // Omar pulsa y el número escribe primero, con el texto vacío (un adjunto o un Flow).
    await exigir(`/portal/postulaciones/${deOmar}/whatsapp`, omar.token, 'POST')
    const primero = await comoElBot('/vinculos', 'POST', { telefono: compartido.e164, wamid: 'w-familia-1', texto: '' })
    expect(primero.estado).toBe(200)
    expect(primero.cuerpo.postulaciones).toHaveLength(1)
    const refDeOmar: string = primero.cuerpo.postulaciones[0].postulacionRef

    // Después pulsa Nora y el número vuelve a escribir: vincula lo de Nora y devuelve todas las
    // activas de ese número, también la de Omar, que ya lo estaba (contrato idempotente).
    await exigir(`/portal/postulaciones/${deNora}/whatsapp`, nora.token, 'POST')
    const v = await comoElBot('/vinculos', 'POST', { telefono: compartido.e164, wamid: 'w-familia-2', texto: 'hola' })
    expect(v.estado).toBe(200)
    expect(v.cuerpo.postulaciones).toHaveLength(2)
    expect(v.cuerpo.postulaciones.map((p: { postulacionRef: string }) => p.postulacionRef)).toContain(refDeOmar)
    expect(v.cuerpo.novedades).toHaveLength(2)
    // Repetida, devuelve lo mismo; y /novedades cuenta esos mismos procesos.
    const repetida = await comoElBot('/vinculos', 'POST', { telefono: compartido.e164, wamid: 'w-familia-2', texto: 'hola' })
    expect(repetida.estado).toBe(200)
    expect(repetida.cuerpo).toEqual(v.cuerpo)
    expect((await novedadesDe(compartido.e164)).cuerpo).toEqual({ novedades: v.cuerpo.novedades })

    const nuevo = celularUnico()
    celulares.push(nuevo.e164)
    await exigir('/portal/cuenta/telefono', nora.token, 'PUT', { telefono: nuevo.escrito })
    const estadoDe = async (c: Cuenta, uuid: string) =>
      (await exigir<any[]>('/portal/postulaciones', c.token)).find((p) => p.uuid === uuid)?.whatsapp?.estado
    expect(await estadoDe(nora, deNora)).toBe('SIN_VINCULAR')
    expect(await estadoDe(omar, deOmar)).toBe('ACTIVO')
    const novedades = await novedadesDe(compartido.e164)
    expect(novedades.cuerpo.novedades).toHaveLength(1)
    // /vinculos es idempotente: repetido, devuelve lo que queda vinculado a ese número (lo de Omar).
    const queda = await comoElBot('/vinculos', 'POST', { telefono: compartido.e164, wamid: 'w-familia', texto: 'hola' })
    expect(queda.estado).toBe(200)
    expect(queda.cuerpo.postulaciones).toHaveLength(1)
    expect(queda.cuerpo.nombre).toBe('Omar')
  })

  test('móvil · el botón ocupa el ancho de la tarjeta, el número no se parte y la página no se desplaza a lo ancho', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const pia = await cuentaCon('Pía')
    await postuladaYEsperando(pia)
    await entrarAlPortalCon(page, pia.token)
    await page.goto('/procesos')
    const suya = tarjeta(page)
    await expect(suya).toBeVisible()
    const boton = suya.getByRole('button', { name: 'Escribir por WhatsApp' })
    const caja = (await suya.boundingBox())!
    const ancho = (await boton.boundingBox())!
    // La tarjeta tiene su relleno a cada lado: el botón llena todo lo que queda.
    expect(ancho.width).toBeGreaterThan(caja.width * 0.8)
    expect(ancho.height).toBeGreaterThanOrEqual(44)
    // El número va entero en una línea («+51 900…» no se separa del resto), también a 320 px.
    const numero = suya.getByText(pia.celular.mostrado, { exact: true })
    for (const anchoDeLaVentana of [375, 320]) {
      await page.setViewportSize({ width: anchoDeLaVentana, height: 812 })
      await expect(numero).toBeVisible()
      expect(await numero.evaluate((e) => e.getClientRects().length), `líneas del número a ${anchoDeLaVentana} px`).toBe(1)
      const [desplazable, ventana] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
      expect(desplazable, `desplazamiento lateral a ${anchoDeLaVentana} px`).toBeLessThanOrEqual(ventana)
    }
  })
})
