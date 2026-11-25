import { expect, type Page } from '@playwright/test'
import { API } from './ayuda'
import { CLAVE_DE_CANDIDATO, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import { correoDePrueba, limpiarSiempre, literal, sql } from './base-de-datos'
import {
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
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
  loQueRecibioElBot,
  novedadesDe,
  NUMERO_DEL_BOT,
  ponerLaBeta,
} from './ayuda-whatsapp'
import { abrirLosAjustes, cerrarLosAjustes, interruptorDeWhatsapp, ventanaDeAjustes, whatsappEsta } from './ayuda-ajustes-de-avisos'

/**
 * Las novedades de la postulación por WhatsApp (V73), los recorridos de la Verificación de
 * `specs/novedades-por-whatsapp.md` en EX, con el bot falso del backend del clon:
 *
 *   1. Registrarse sin celular (error) y con celular.
 *   2. Activar WhatsApp en la ventana «Ajustes de avisos» y comprobar el enlace, el mensaje y
 *      el anuncio que le llega al bot.
 *   3. Hacer de bot: la llamada firmada a `/vinculos` desde el número anunciado, y la ventana
 *      lo da por activo.
 *   4. Pasar la postulación a la prueba: un solo aviso para el bot.
 *   5. Apagarlo en la ventana: le llega la revocación.
 *   6. Cambiar el celular en «Mi cuenta»: le llega la revocación del anterior.
 *   7. La cuenta sin celular lo da en la ventana.
 *   8. Una vacante de otra empresa no entra en WhatsApp.
 *
 * Desde la V92 (spec notificaciones-del-candidato) WhatsApp es un ajuste de la cuenta: la
 * tarjeta de cada proceso, su «Escribir por WhatsApp» y su «Dejar de recibir» ya no existen, y
 * estos recorridos pasan por la ventana de ajustes, que desde el 25/11/2026 se abre con la
 * tuerca de la campana (ya no con un botón «Notificaciones» en «Mis procesos»). Lo propio de la
 * ventana —la guía de la primera vez, la BAJA, correo y campana…— vive en `73-…-qa`.
 *
 * El enlace `wa.me` no sale a internet: la pestaña que se abre se queda con una página de
 * mentira. La beta se enciende desde el panel y se deja como estaba al terminar.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-WA-0073).
 */

const MARCA = 'QA-WA-0073'
const TITULO = 'Asistente Contable'
const PREFIJO = 'qa.wa.0073'

const correos: string[] = []
const celulares: string[] = []
let equipo = ''
let vacante = 0
let otraVacante = 0
let otraEmpresa = 0
let betaAntes = 'false'

interface Cuenta {
  correo: string
  token: string
  celular: ReturnType<typeof celularUnico>
}

/** Una cuenta con su celular único, ya dentro del portal por la API. */
async function cuentaCon(nombre: string): Promise<Cuenta> {
  const correo = correoDePrueba(PREFIJO)
  const celular = celularUnico()
  correos.push(correo)
  celulares.push(celular.e164)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Prueba', correo, telefono: celular.escrito })
  return { correo, token: await tokenDelCandidato(correo), celular }
}

/** Postula y la deja en «Estamos calificando tus respuestas», un momento de espera. */
async function postuladaYEsperando(cuenta: Cuenta, aVacante = vacante): Promise<string> {
  const uuid = await postular(cuenta.token, aVacante)
  sql(`update postulacion set estado_codigo = 'PERFIL_CALIFICANDO' where uuid = ${literal(uuid)};`)
  return uuid
}

/** La ventana «Ajustes de avisos» (la tuerca de la campana) y su interruptor de WhatsApp. */
const ventana = ventanaDeAjustes
const interruptor = interruptorDeWhatsapp

/** El texto de consentimiento de WhatsApp para la cuenta (V92): el que se lee y se firma. */
const CONSENTIMIENTO_DE_LA_CUENTA =
  'Al activarlo aceptas recibir por WhatsApp las novedades de tus procesos. Escribe BAJA cuando quieras dejarlo.'

const personaDe = (cuenta: Cuenta): number =>
  Number(uno(`select persona_id as p from usuario where correo = ${literal(cuenta.correo)}`).p)

/** El chat no sale a internet: la pestaña que se abre se queda con una página de mentira. */
async function chatDeMentira(page: Page) {
  await page.context().route('https://wa.me/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp de mentira</p>' }),
  )
}

/** Espera a que el bot falso haya recibido algo de ese tipo para ese número. */
async function hastaQueLlegue(e164: string, tipo: string, cuantas = 1) {
  await expect
    .poll(async () => (await loQueRecibioElBot(e164)).filter((l) => l.tipo === tipo).length, {
      timeout: 40_000,
      intervals: [500, 1_000, 2_000],
    })
    .toBeGreaterThanOrEqual(cuantas)
}

test.describe('Las novedades de la postulación por WhatsApp', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)
    for (const nombre of [TITULO, `${TITULO} de otra empresa`]) {
      const id = await crearVacante(equipo, nombre, lugar, undefined, MARCA)
      await escribirBorrador(equipo, id, [
        {
          nombre: 'General',
          preguntas: [
            { tipo: 'ABIERTA', enunciado: 'Cuéntanos un cierre contable difícil.', puntos: 100, queDebeTener: 'El monto y la causa.' },
          ],
        },
      ])
      await publicarPreguntas(equipo, id)
      await escribirPrueba(equipo, id, {
        criterios: [
          {
            nombre: 'Cierre',
            puntosCalificados: 100,
            calificador: 'IA',
            preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre?', queDebeTener: 'La cuenta.' }],
          },
        ],
        datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' },
      })
      const publicada = await publicarPrueba(equipo, id)
      if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
      await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
      await exigir(`/panel/vacantes/${id}/calificacion-automatica`, equipo, 'POST', { activa: false })
      if (vacante === 0) vacante = id
      else otraVacante = id
    }
    // La empresa a la que pasará la segunda: la beta es solo para las vacantes de RENASER.
    otraEmpresa = Number(
      JSON.parse(
        sql(`with f as (insert into organizacion (codigo, nombre)
                        values (${literal(`${MARCA}-B-${Date.now()}`)}, ${literal(`${MARCA} Constructora Andina`)})
                        returning id)
             select json_agg(f) from f;`),
      )[0].id,
    )
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
        if (otraEmpresa) sql(`update organizacion set es_activa = false where id = ${otraEmpresa};`)
      },
    ])
  })

  test('1 · AC-01 · sin celular o con uno que no vale no hay cuenta; con uno válido, sí', async ({ page }) => {
    const correo = correoDePrueba(PREFIJO)
    correos.push(correo)
    const celular = celularUnico()
    celulares.push(celular.e164)

    await page.goto('/registro')
    await page.getByLabel(/^Nombre/).fill('Rocío')
    await page.getByLabel(/^Apellidos/).fill('Prueba WhatsApp')
    await page.getByLabel(/^Correo/).fill(correo)
    await page.getByLabel(/^Contraseña/).fill(CLAVE_DE_CANDIDATO)
    await page.getByLabel('Repite la contraseña').fill(CLAVE_DE_CANDIDATO)
    await page.getByLabel(/^Ciudad/).selectOption({ label: 'Fuera del Perú' })
    await page.locator('input[type="checkbox"]').first().check()

    const campo = page.getByLabel(/^Celular \(WhatsApp\)/)
    await expect(campo.locator('xpath=..')).toContainText('+51')

    await page.getByRole('button', { name: /Crear cuenta/ }).click()
    await expect(page.getByText('Escribe tu celular.')).toBeVisible()
    await expect(campo).toHaveAttribute('aria-invalid', 'true')

    await campo.fill('812 345 678')
    await page.getByRole('button', { name: /Crear cuenta/ }).click()
    await expect(
      page.getByText('Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo'),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/registro/)
    expect(Number(uno(`select count(*) as n from usuario where correo = ${literal(correo)}`).n)).toBe(0)

    await campo.fill(celular.escrito)
    await page.getByRole('button', { name: /Crear cuenta/ }).click()
    await expect(page).not.toHaveURL(/\/registro/, { timeout: 20_000 })
    expect(
      uno(`select p.telefono from persona p join usuario u on u.persona_id = p.id
            where u.correo = ${literal(correo)}`).telefono,
    ).toBe(celular.e164)
  })

  test('2-5 · activar en la ventana, el bot que vincula, el aviso de la prueba y apagarlo', async ({ page }) => {
    const ana = await cuentaCon('Ana')
    const uuid = await postuladaYEsperando(ana)
    await entrarAlPortalCon(page, ana.token)
    await chatDeMentira(page)

    // AC-03 · ninguna tarjeta en el proceso: la ventana, con su número y el consentimiento
    await page.goto('/procesos')
    await expect(page.getByRole('region', { name: /novedades por WhatsApp/i })).toHaveCount(0)
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'apagado')
    await expect(ventana(page).getByText(ana.celular.mostrado)).toBeVisible()
    await expect(ventana(page).getByText(CONSENTIMIENTO_DE_LA_CUENTA)).toBeVisible()
    await expect(interruptor(page)).toHaveAttribute('aria-checked', 'false')

    // AC-06 · encender: se abre el chat del bot con el mensaje ya escrito, y el bot recibe el anuncio
    const [pestana] = await Promise.all([page.waitForEvent('popup'), interruptor(page).click()])
    await pestana.waitForURL(/wa\.me/)
    const enlace = new URL(pestana.url())
    expect(enlace.pathname).toBe(`/${NUMERO_DEL_BOT}`)
    expect(enlace.searchParams.get('text')).toBe(
      `Hola, soy Ana Prueba. Quiero saber cómo va mi postulación a ${MARCA} ${TITULO}.`,
    )
    await pestana.close()
    await whatsappEsta(page, 'esperando')
    await expect(ventana(page).getByText(`Te abrimos WhatsApp. Envía el mensaje desde el ${ana.celular.mostrado} para terminar.`)).toBeVisible()
    await expect.poll(async () => (await loQueRecibioElBot(ana.celular.e164)).length, { timeout: 30_000 }).toBe(1)
    const anuncios = await loQueRecibioElBot(ana.celular.e164)
    expect(anuncios.map((l) => l.tipo)).toEqual(['ESPERA'])
    const referencia = anuncios[0]!.cuerpo.postulacionRef
    expect(referencia).toMatch(/^pw_/)
    expect(referencia).not.toContain(uuid)
    // El anuncio lleva el consentimiento que acaba de aceptar: el de la cuenta viaja como el tipo
    // WHATSAPP del contrato, con su versión, el texto exacto y la fecha.
    expect(anuncios[0]!.cuerpo.consentimiento).toMatchObject({
      tipo: 'WHATSAPP',
      version: '1.0',
      texto: CONSENTIMIENTO_DE_LA_CUENTA,
    })
    expect(Date.parse(anuncios[0]!.cuerpo.consentimiento!.aceptadoEn)).not.toBeNaN()
    expect(Date.parse(anuncios[0]!.cuerpo.caducaEn!)).toBeGreaterThan(Date.now())
    const postulacion = postulacionPorUuid(uuid)
    expect(
      Number(uno(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                   where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${personaDe(ana)} and c.postulacion_id is null`).n),
    ).toBe(1)

    // AC-14 · sin firma, el bot no entra
    const sinFirma = await comoElBot('/vinculos', 'POST', { telefono: ana.celular.e164, texto: 'hola' }, { sinFirma: true })
    expect(sinFirma.estado).toBe(401)

    // AC-07 · el bot escribe desde el número anunciado, con cualquier texto: queda vinculado y
    // la novedad dice lo mismo que el portal
    const vinculo = await comoElBot('/vinculos', 'POST', {
      telefono: ana.celular.e164.replace('+', ''),
      wamid: `wamid.${Date.now()}`,
      texto: 'borré el mensaje y escribí otra cosa',
      recibidoEn: new Date().toISOString(),
    })
    expect(vinculo.estado).toBe(200)
    expect(vinculo.cuerpo.nombre).toBe('Ana')
    expect(vinculo.cuerpo.postulaciones).toEqual([{ postulacionRef: referencia }])
    expect(vinculo.cuerpo.novedades).toEqual([
      {
        vacante: `${MARCA} ${TITULO}`,
        titulo: 'Estamos calificando tus respuestas',
        texto: 'Se juntan tu currículum y tu evaluación en un solo perfil. Suele tardar poco.',
      },
    ])
    // Las novedades, por POST y con las mismas palabras.
    const novedades = await novedadesDe(ana.celular.e164)
    expect(novedades.estado).toBe(200)
    expect(novedades.cuerpo).toEqual({ novedades: vinculo.cuerpo.novedades })
    await page.reload()
    await expect(page.getByText('Estamos calificando tus respuestas').first()).toBeVisible()
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'activo')
    await cerrarLosAjustes(page)

    // AC-08 · pasa a la prueba: correo, campana y UN aviso para el bot
    await exigir(`/panel/postulaciones/${postulacion}/transiciones`, equipo, 'POST', {
      estadoDestino: 'PRUEBA_TURNO_CANDIDATO',
      motivo: 'Pasa a la prueba (E2E de WhatsApp)',
      avisar: true,
    })
    await expect
      .poll(() => Number(uno(`select count(*) as n from aviso_whatsapp where postulacion_id = ${postulacion}`).n))
      .toBe(1)
    await hastaQueLlegue(ana.celular.e164, 'AVISO')
    const avisos = (await loQueRecibioElBot(ana.celular.e164)).filter((l) => l.tipo === 'AVISO')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]!.cuerpo.tipo).toBe('PRUEBA_DISPONIBLE')
    // El formato de la regla 19 (contexto y resultados por WhatsApp, V76 del backend): bloques,
    // negritas y el enlace fijo a «Mis procesos», sin token.
    expect(avisos[0]!.cuerpo.texto).toContain(`¡Felicidades, Ana! 🎉\n\n📌 *${MARCA} ${TITULO}*\nTu *prueba del puesto* ya está disponible.`)
    expect(avisos[0]!.cuerpo.texto).toContain('Inicia sesión con tu correo y contraseña y abre «Mis procesos».')
    expect(avisos[0]!.cuerpo.texto).not.toContain('token')
    // Le toca algo: manda la acción, y WhatsApp sigue activo para la cuenta sin tarjeta alguna
    await page.goto('/procesos')
    await expect(page.getByRole('link', { name: /Abrir prueba/ }).first()).toBeVisible()
    await expect(page.getByRole('region', { name: /novedades por WhatsApp/i })).toHaveCount(0)
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'activo')

    // AC-12 · apagarlo en la ventana, con la prueba abierta, y la revocación
    await expect(interruptor(page)).toHaveAttribute('aria-checked', 'true')
    await interruptor(page).click()
    await expect(interruptor(page)).toHaveAttribute('aria-checked', 'false')
    await whatsappEsta(page, 'apagado')
    await hastaQueLlegue(ana.celular.e164, 'REVOCACION')
    const revocacion = (await loQueRecibioElBot(ana.celular.e164)).find((l) => l.tipo === 'REVOCACION')
    expect(revocacion?.cuerpo).toMatchObject({ postulacionRef: referencia, motivo: 'DEJAR_DE_RECIBIR' })
  })

  test('6 · AC-02 · cambiar el celular en «Mi cuenta» revoca el anterior', async ({ page }) => {
    const carla = await cuentaCon('Carla')
    await postuladaYEsperando(carla)
    const nuevo = celularUnico()
    celulares.push(nuevo.e164)

    await entrarAlPortalCon(page, carla.token)
    // Desde la ventana, «Cámbialo en Mi cuenta» lleva al campo del celular: ya abierto con
    // el número de ahora, a la vista y con el foco dentro, no al principio del perfil.
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await ventana(page).getByRole('link', { name: 'Cámbialo en Mi cuenta' }).click()
    await expect(page).toHaveURL(/\/perfil#celular$/)
    const campo = page.getByLabel(/^Celular \(WhatsApp\)/)
    await expect(campo).toBeFocused()
    await expect(campo).toBeInViewport()
    await expect(campo).toHaveValue(carla.celular.escrito)

    // Activado por la API (sin comprobar, espera su mensaje) antes de cambiarlo.
    expect((await exigir('/portal/notificaciones/whatsapp', carla.token, 'POST')).resultado).toBe('POR_MENSAJE')
    await hastaQueLlegue(carla.celular.e164, 'ESPERA')
    await campo.fill('54 123456')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(
      page.getByText('Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo'),
    ).toBeVisible()
    await campo.fill(nuevo.escrito)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText(nuevo.mostrado)).toBeVisible()

    await hastaQueLlegue(carla.celular.e164, 'REVOCACION')
    const revocacion = (await loQueRecibioElBot(carla.celular.e164)).find((l) => l.tipo === 'REVOCACION')
    expect(revocacion?.cuerpo.motivo).toBe('CAMBIO_CELULAR')

    // Ya no espera ningún mensaje: la ventana enseña el número nuevo, apagado, para activarlo de
    // nuevo. (El anterior nunca se comprobó, así que no es «Cambiaste tu número»: eso es de quien
    // lo tenía activo, en `73-…-qa`, AC-12.)
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'apagado')
    await expect(ventana(page).getByText(nuevo.mostrado)).toBeVisible()
    await expect(ventana(page).getByText(CONSENTIMIENTO_DE_LA_CUENTA)).toBeVisible()
    await expect(interruptor(page)).toHaveAttribute('aria-checked', 'false')
  })

  test('7 · AC-05 · la cuenta sin celular lo da en la ventana', async ({ page }) => {
    const dora = await cuentaCon('Dora')
    await postuladaYEsperando(dora)
    // Una cuenta anterior a la V73: sin celular.
    sql(`update persona set telefono = null
          where id = (select persona_id from usuario where correo = ${literal(dora.correo)});`)
    await chatDeMentira(page)

    await entrarAlPortalCon(page, dora.token)
    // WhatsApp vive solo en «Mis procesos»: en la ventana, el campo y «Guardar».
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'sin número')
    await expect(interruptor(page)).toHaveCount(0)
    const campo = ventana(page).getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')
    await campo.fill(dora.celular.escrito)
    await ventana(page).getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(ventana(page).getByText(dora.celular.mostrado)).toBeVisible()
    expect(
      uno(`select p.telefono from persona p join usuario u on u.persona_id = p.id
            where u.correo = ${literal(dora.correo)}`).telefono,
    ).toBe(dora.celular.e164)

    // Con el número ya guardado, el interruptor abre el chat.
    const [pestana] = await Promise.all([page.waitForEvent('popup'), interruptor(page).click()])
    await pestana.waitForURL(/wa\.me/)
    await pestana.close()
    await whatsappEsta(page, 'esperando')
    await expect.poll(async () => (await loQueRecibioElBot(dora.celular.e164)).map((l) => l.tipo), { timeout: 30_000 })
      .toEqual(['ESPERA'])
  })

  test('8 · AC-04 · una vacante de otra empresa no entra en WhatsApp', async ({ page }) => {
    const eva = await cuentaCon('Eva')
    const uuid = await postular(eva.token, otraVacante)
    // Se postula mientras es de RENASER y después pasa, con su postulación, a la otra empresa.
    sql(`begin;
         update vacante set organizacion_id = ${otraEmpresa} where id = ${otraVacante};
         update postulacion set estado_codigo = 'PERFIL_CALIFICANDO', organizacion_id = ${otraEmpresa}
          where uuid = ${literal(uuid)};
         commit;`)

    await entrarAlPortalCon(page, eva.token)
    await page.goto(`/procesos/${uuid}`)
    await expect(page.getByText('Estamos calificando tus respuestas').first()).toBeVisible()
    await expect(page.getByRole('region', { name: /novedades por WhatsApp/i })).toHaveCount(0)
    // El botón por proceso, que se conserva una versión, sigue diciendo que no.
    const delProceso = await fetch(`${API}/portal/postulaciones/${uuid}/whatsapp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${eva.token}` },
    })
    expect(delProceso.status).toBe(409)
    expect(await loQueRecibioElBot(eva.celular.e164)).toEqual([])
    // Y encender WhatsApp para la cuenta no la anuncia: solo cuentan los procesos de la beta.
    expect((await exigir('/portal/notificaciones/whatsapp', eva.token, 'POST')).resultado).toBe('POR_MENSAJE')
    const postulacion = postulacionPorUuid(uuid)
    expect(Number(uno(`select count(*) as n from vinculo_whatsapp where postulacion_id = ${postulacion}`).n)).toBe(0)
  })
})
