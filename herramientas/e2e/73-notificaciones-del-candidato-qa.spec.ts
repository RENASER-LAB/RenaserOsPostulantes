import { expect, type Locator, type Page } from '@playwright/test'
import { borrarCuentasDePrueba, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import {
  abrirLaCampana,
  abrirLosAjustes,
  campana,
  interruptorDeWhatsapp,
  puntito,
  tuerca,
  ventanaDeAjustes,
  whatsappEsta,
} from './ayuda-ajustes-de-avisos'
import { configuracion, correoDePrueba, limpiarSiempre, literal, sql } from './base-de-datos'
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
import { crearVacante, escribirPrueba, lugarDe, publicarPrueba } from './ayuda-prueba-propia'
import { holgarElTopePorIp, pedirPorApi, PLANTILLA_CANDIDATO } from './ayuda-recuperacion'
import {
  borrarLoDeWhatsapp,
  celularUnico,
  comoElBot,
  loQueRecibioElBot,
  NUMERO_DEL_BOT,
  ponerLaBeta,
} from './ayuda-whatsapp'

/**
 * Notificaciones del candidato (V92): un solo ajuste por cuenta para WhatsApp, correo y la
 * campana, con el bot falso del backend del clon. Los recorridos de la Verificación de
 * `specs/Ready/notificaciones-del-candidato/spec.md`, con el cambio de diseño del 25/11/2026:
 * la ventana «Ajustes de avisos» se abre con la tuerca de la campana (sin botón, ni línea de
 * estado, ni mensaje flotante en «Mis procesos») y la invitación a WhatsApp es el paso 3 de la
 * guía de la primera vez (V93).
 *
 *   - AC-01 · la guía de tres pasos tras postular, sin tarjeta de WhatsApp en ningún proceso.
 *   - AC-02/03 · activar desde la guía con un número sin comprobar: firma, un PENDIENTE por
 *     proceso vivo, el chat y «Te abrimos WhatsApp…»; el bot escribe y todo queda ACTIVO.
 *   - AC-04 · el anuncio caducó: «No nos llegó tu mensaje… Reintentar».
 *   - AC-05/13 · tras BAJA, con el bot caído no cambia nada; con el bot de vuelta, un clic.
 *   - AC-06 · con WhatsApp activo, la postulación nueva se vincula sola (NUEVA_POSTULACION).
 *   - AC-07 · apagarlo cierra todo con DEJAR_DE_RECIBIR; volver a encender es un clic.
 *   - AC-08/09 · correo o campana apagados al mover la postulación; recuperar la clave sale.
 *   - V93 · la guía sale una vez por cuenta: saltarla o Esc la dan por vista en el servidor y no
 *     vuelve al recargar, al postular otra vez ni en otro navegador. (Sustituye a la AC-10 del
 *     mensaje flotante, que el portal ya no pinta; su contador lo prueba el backend.)
 *   - AC-11 · un celular de otra cuenta: 409 TELEFONO_EN_USO en la ventana y en «Mi cuenta».
 *   - AC-12 · cambiar el número deja WhatsApp apagado y activar abre el chat.
 *
 * Lo que decía la línea del botón retirado se comprueba en la ventana: el interruptor, su nota
 * y el puntito verde de la tuerca (`whatsappEsta`). Las pruebas que no son de la guía la
 * saltan (ver `saltarLaGuiaDeAvisos`); las de la guía la piden con `guiaDeAvisos: true`.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-NC-0092). El enlace
 * `wa.me` no sale a internet: la pestaña se queda con una página de mentira.
 */

const MARCA = 'QA-NC-0092'
const PREFIJO = 'qa.nc.0092'
const TITULOS = ['Analista de Datos', 'Asistente de Planeamiento', 'Auxiliar de Caja', 'Coordinador de Ventas']

const correos: string[] = []
const celulares: string[] = []
const vacantes: number[] = []
let equipo = ''
let betaAntes = 'false'

interface Cuenta {
  correo: string
  token: string
  celular: ReturnType<typeof celularUnico>
  personaId: number
  usuarioId: number
}

async function cuentaCon(nombre: string): Promise<Cuenta> {
  const correo = correoDePrueba(PREFIJO)
  const celular = celularUnico()
  correos.push(correo)
  celulares.push(celular.e164)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Prueba', correo, telefono: celular.escrito })
  const ids = uno(`select u.id as usuario, u.persona_id as persona from usuario u where u.correo = ${literal(correo)}`)
  return {
    correo,
    token: await tokenDelCandidato(correo),
    celular,
    personaId: Number(ids.persona),
    usuarioId: Number(ids.usuario),
  }
}

/** Postula y la deja en «Estamos calificando tus respuestas»: un proceso vivo, de espera. */
async function postulada(cuenta: Cuenta, vacante: number): Promise<number> {
  const uuid = await postular(cuenta.token, vacante)
  sql(`update postulacion set estado_codigo = 'PERFIL_CALIFICANDO' where uuid = ${literal(uuid)};`)
  return postulacionPorUuid(uuid)
}

const contar = (consulta: string): number => Number(uno(consulta).n)

const vinculosDe = (personaId: number, estado: string): number =>
  contar(`select count(*) as n from vinculo_whatsapp where persona_id = ${personaId} and estado = ${literal(estado)}`)

const enLaBaja = (e164: string): number =>
  contar(`select count(*) as n from whatsapp_baja where telefono = ${literal(e164)}`)

const ventana = ventanaDeAjustes
const interruptor = (page: Page, nombre: string) => ventana(page).getByRole('switch', { name: nombre })
/** La guía, en el paso que sea: el único `<dialog>` modal con `aria-modal`. */
const laGuia = (page: Page) => page.locator('dialog[aria-modal="true"]')
const guiaVistaEn = (personaId: number): unknown =>
  uno(`select max(guia_avisos_vista_en) as v from preferencia_aviso where persona_id = ${personaId}`).v
const CONSENTIMIENTO =
  'Al activarlo aceptas recibir por WhatsApp las novedades de tus procesos. Escribe BAJA cuando quieras dejarlo.'

/** El bot escribe desde ese número: lo que hace quien envía el mensaje del chat. */
async function escribeElBot(e164: string) {
  const r = await comoElBot('/vinculos', 'POST', {
    telefono: e164.replace('+', ''),
    wamid: `wamid.${Date.now()}.${Math.random()}`,
    texto: 'hola',
    recibidoEn: new Date().toISOString(),
  })
  expect(r.estado).toBe(200)
  return r
}

/** WhatsApp encendido por la API y comprobado por el bot: el punto de partida «activo». */
async function conWhatsappActivo(cuenta: Cuenta) {
  const activacion = await exigir('/portal/notificaciones/whatsapp', cuenta.token, 'POST')
  expect(activacion.resultado).toBe('POR_MENSAJE')
  await escribeElBot(cuenta.celular.e164)
  expect(Boolean(uno(`select whatsapp_activo as a from preferencia_aviso where persona_id = ${cuenta.personaId}`).a)).toBe(true)
}

/**
 * Lo que mueve de verdad la animación CSS de un elemento: las propiedades de los fotogramas
 * de su `animation-name` (sin depender del nombre que le ponga CSS Modules).
 */
async function loQueAnima(elemento: Locator): Promise<string[]> {
  return elemento.evaluate((el) => {
    const nombre = getComputedStyle(el).animationName
    const propiedades = new Set<string>()
    const recorrer = (reglas: CSSRuleList) => {
      for (const regla of Array.from(reglas)) {
        if (regla instanceof CSSKeyframesRule && regla.name === nombre) {
          for (const fotograma of Array.from(regla.cssRules) as CSSKeyframeRule[]) {
            for (let i = 0; i < fotograma.style.length; i++) propiedades.add(fotograma.style.item(i))
          }
        } else if (regla instanceof CSSGroupingRule) {
          recorrer(regla.cssRules)
        }
      }
    }
    for (const hoja of Array.from(document.styleSheets)) {
      try {
        recorrer(hoja.cssRules)
      } catch {
        // Una hoja de otro origen no deja leer sus reglas.
      }
    }
    return Array.from(propiedades).sort()
  })
}

async function vinculacionesDe(e164: string) {
  return (await loQueRecibioElBot(e164)).filter((l) => (l.tipo as string) === 'VINCULACION')
}

test.describe('Notificaciones del candidato (V92)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000)
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)
    for (const nombre of TITULOS) {
      const id = await crearVacante(equipo, nombre, lugar, undefined, MARCA)
      await escribirBorrador(equipo, id, [
        {
          nombre: 'General',
          preguntas: [
            { tipo: 'ABIERTA', enunciado: 'Cuéntanos un problema difícil que resolviste.', puntos: 100, queDebeTener: 'La causa.' },
          ],
        },
      ])
      await publicarPreguntas(equipo, id)
      await escribirPrueba(equipo, id, {
        criterios: [
          {
            nombre: 'Análisis',
            puntosCalificados: 100,
            calificador: 'IA',
            preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo lo resolverías?', queDebeTener: 'Los pasos.' }],
          },
        ],
        datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira los pasos.' },
      })
      const publicada = await publicarPrueba(equipo, id)
      if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
      await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
      await exigir(`/panel/vacantes/${id}/calificacion-automatica`, equipo, 'POST', { activa: false })
      vacantes.push(id)
    }
    betaAntes = await ponerLaBeta(equipo, true)
  })

  test.afterAll(async () => {
    await limpiarSiempre([
      () => comoElBot('/falso/caido', 'POST', { caido: false }).then(() => undefined),
      () => ponerLaBeta(equipo, betaAntes === 'true').then(() => undefined),
      () => borrarLoDeWhatsapp(celulares),
      // El aviso que siembra «la tuerca» (las cuentas con historial se retiran, no se borran).
      () => { sql(`delete from aviso_portal where titulo like ${literal(`${MARCA}%`)};`) },
      () => borrarCuentasDePrueba(correos),
      () => {
        sql(`update vacante set eliminada_en = now() where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null;`)
        sql(`update solicitud_talento set estado = 'ARCHIVADA'
              where motivo like ${literal(`${MARCA}%`)} and estado <> 'ARCHIVADA';`)
      },
    ])
  })

  test.describe('la guía de la primera vez (V93)', () => {
    test.use({ guiaDeAvisos: true })

    test('AC-01/02/03 · tras postular, la guía de tres pasos; «Activar WhatsApp» sin comprobar abre el chat y el bot confirma', async ({ page }) => {
      const ana = await cuentaCon('Ana')
      const p1 = await postulada(ana, vacantes[0]!)
      const p2 = await postulada(ana, vacantes[1]!)
      await entrarAlPortalCon(page, ana.token)
      await page.context().route('https://wa.me/**', (ruta) =>
        ruta.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp de mentira</p>' }),
      )

      // AC-01 · la guía sobre la campana, y ninguna tarjeta ni botón de WhatsApp en sus procesos
      await page.goto('/procesos')
      const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
      await expect(paso1).toBeVisible()
      await expect(paso1.getByText('1 de 3')).toBeVisible()
      await expect(paso1.getByText('Cada vez que tu proceso avanza, la campana se marca con un número.')).toBeVisible()
      await expect(paso1.getByRole('button', { name: 'Siguiente' })).toBeFocused()
      await expect(page.getByRole('region', { name: /novedades por WhatsApp/i })).toHaveCount(0)
      await expect(page.locator('main button', { hasText: /Notificaciones|Escribir por WhatsApp|Dejar de recibir/ })).toHaveCount(0)
      expect(guiaVistaEn(ana.personaId)).toBeNull()

      await paso1.getByRole('button', { name: 'Siguiente' }).click()
      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      await expect(paso2.getByText('Enciende o apaga cada canal cuando quieras.')).toBeVisible()
      // La campana se abre debajo, con el puntito verde en la tuerca: WhatsApp por activar.
      await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toBeVisible()
      await expect(puntito(page)).toHaveCount(1)
      await paso2.getByRole('button', { name: 'Siguiente' }).click()

      const paso3 = page.getByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' })
      await expect(paso3.getByText('Y pregúntanos tus dudas. Correo y portal ya están encendidos.')).toBeVisible()
      await expect(paso3.getByText(CONSENTIMIENTO)).toBeVisible()
      await expect(paso3.getByRole('button', { name: 'Activar WhatsApp' })).toBeFocused()

      // AC-02 · «Activar WhatsApp»: firma, un PENDIENTE por proceso vivo, el chat y la espera
      const [pestana] = await Promise.all([
        page.waitForEvent('popup'),
        paso3.getByRole('button', { name: 'Activar WhatsApp' }).click(),
      ])
      await pestana.waitForURL(/wa\.me/)
      expect(new URL(pestana.url()).pathname).toBe(`/${NUMERO_DEL_BOT}`)
      await pestana.close()
      await expect(laGuia(page)).toHaveCount(0)
      // Activar la da por vista, en el servidor.
      await expect.poll(() => guiaVistaEn(ana.personaId) !== null).toBe(true)
      await expect(ventana(page).getByText(/Te abrimos WhatsApp\. Envía el mensaje desde el \+51 \d{3} \d{3} \d{3} para terminar\./)).toBeVisible()
      await whatsappEsta(page, 'esperando')
      expect(
        contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                 where t.tipo = 'WHATSAPP_CUENTA' and t.version = '1.0' and c.persona_id = ${ana.personaId}
                   and c.postulacion_id is null`),
      ).toBe(1)
      expect(vinculosDe(ana.personaId, 'PENDIENTE')).toBe(2)
      expect(
        contar(`select count(distinct postulacion_id) as n from vinculo_whatsapp
                 where persona_id = ${ana.personaId} and estado = 'PENDIENTE' and postulacion_id in (${p1}, ${p2})`),
      ).toBe(2)
      await expect
        .poll(async () => (await loQueRecibioElBot(ana.celular.e164)).filter((l) => l.tipo === 'ESPERA').length, { timeout: 30_000 })
        .toBe(2)

      // AC-03 · el bot recibe su mensaje: todos ACTIVO y la ventana lo dice
      await escribeElBot(ana.celular.e164)
      expect(vinculosDe(ana.personaId, 'ACTIVO')).toBe(2)
      expect(vinculosDe(ana.personaId, 'PENDIENTE')).toBe(0)
      await page.reload()
      // La guía no vuelve: la campana se pulsa sin nada encima.
      await abrirLosAjustes(page)
      await whatsappEsta(page, 'activo')
      await expect(laGuia(page)).toHaveCount(0)
    })

    test('V93 · una vez por cuenta: Esc la da por vista y no vuelve al recargar, al postular otra vez ni en otro navegador', async ({ page, browser }) => {
      const hugo = await cuentaCon('Hugo')
      await entrarAlPortalCon(page, hugo.token)
      await postulada(hugo, vacantes[0]!)

      await page.goto('/procesos')
      await expect(page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(laGuia(page)).toHaveCount(0)
      // El foco vuelve a la campana.
      await expect(campana(page)).toBeFocused()
      await expect.poll(() => guiaVistaEn(hugo.personaId) !== null).toBe(true)
      const vistaEn = String(guiaVistaEn(hugo.personaId))
      expect((await exigir('/portal/notificaciones', hugo.token)).guiaVista).toBe(true)

      // Al recargar, la campana se pulsa sin nada encima.
      await page.reload()
      await abrirLaCampana(page)
      await expect(laGuia(page)).toHaveCount(0)

      // Tras otra postulación, tampoco.
      await postulada(hugo, vacantes[1]!)
      await page.reload()
      await abrirLaCampana(page)
      await expect(laGuia(page)).toHaveCount(0)

      // En otro navegador, sin nada guardado en él: tampoco. Es el servidor el que lo recuerda.
      const otro = await browser.newContext({ baseURL: configuracion().E2E_PORTAL, locale: 'es-PE' })
      try {
        const enOtro = await otro.newPage()
        await entrarAlPortalCon(enOtro, hugo.token)
        await enOtro.goto('/procesos')
        await abrirLaCampana(enOtro)
        await expect(laGuia(enOtro)).toHaveCount(0)
      } finally {
        await otro.close()
      }
      // Y la fecha es la de la primera vez.
      expect(String(guiaVistaEn(hugo.personaId))).toBe(vistaEn)
    })

    test('«Saltar guía» la da por vista sin tocar WhatsApp; sin postulaciones no sale', async ({ page }) => {
      const iris = await cuentaCon('Iris')
      await entrarAlPortalCon(page, iris.token)

      // Sin postulaciones, «Mis procesos» no la pide.
      await page.goto('/procesos')
      await abrirLaCampana(page)
      await expect(laGuia(page)).toHaveCount(0)
      expect(guiaVistaEn(iris.personaId)).toBeNull()

      await postulada(iris, vacantes[0]!)
      await page.reload()
      const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
      await paso1.getByRole('button', { name: 'Saltar guía' }).click()
      await expect(laGuia(page)).toHaveCount(0)
      await expect.poll(() => guiaVistaEn(iris.personaId) !== null).toBe(true)
      expect(vinculosDe(iris.personaId, 'PENDIENTE') + vinculosDe(iris.personaId, 'ACTIVO')).toBe(0)
      expect(
        contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                 where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${iris.personaId}`),
      ).toBe(0)
    })

    // ---- QA, ciclo 4: las variantes de la guía y su accesibilidad, contra el backend del clon ----

    test('variante activo · con WhatsApp ya encendido el paso 3 es «Todo listo» con un solo «Entendido», que la da por vista', async ({ page }) => {
      const ema = await cuentaCon('Ema')
      await postulada(ema, vacantes[0]!)
      await conWhatsappActivo(ema)
      await entrarAlPortalCon(page, ema.token)
      await page.goto('/procesos')

      const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
      await expect(paso1.getByText('1 de 3')).toBeVisible()
      await paso1.getByRole('button', { name: 'Siguiente' }).click()
      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toBeVisible()
      // Encendido: la tuerca va limpia.
      await expect(puntito(page)).toHaveCount(0)
      await paso2.getByRole('button', { name: 'Siguiente' }).click()

      const paso3 = page.getByRole('dialog', { name: 'Todo listo' })
      await expect(paso3.getByText('3 de 3')).toBeVisible()
      await expect(paso3.getByText('Te avisamos de todos tus procesos y puedes escribirnos tus dudas.')).toBeVisible()
      await expect(paso3.getByRole('button', { name: 'Activar WhatsApp' })).toHaveCount(0)
      await expect(paso3.getByRole('button')).toHaveCount(1)
      const entendido = paso3.getByRole('button', { name: 'Entendido' })
      await expect(entendido).toBeFocused()
      await entendido.click()

      await expect(laGuia(page)).toHaveCount(0)
      await expect(campana(page)).toBeFocused()
      await expect.poll(() => guiaVistaEn(ema.personaId) !== null).toBe(true)
      // WhatsApp no se toca: sigue encendido, con su vínculo y sin otra firma.
      expect(vinculosDe(ema.personaId, 'ACTIVO')).toBe(1)
      expect(
        contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                 where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${ema.personaId}`),
      ).toBe(1)
    })

    // ---- Ciclo 6, decisión del usuario: esperando su mensaje ya no es «Todo listo» ----

    test('variante esperando · activado y sin su mensaje, el paso 3 es «Termina de activar WhatsApp» con su número enmascarado; «Abrir WhatsApp» la da por vista y reabre el chat', async ({ page }) => {
      const olga = await cuentaCon('Olga')
      await postulada(olga, vacantes[0]!)
      // Activado por la API y sin escribir desde su número: esperando su mensaje.
      const activacion = await exigir('/portal/notificaciones/whatsapp', olga.token, 'POST')
      expect(activacion.resultado).toBe('POR_MENSAJE')
      expect(vinculosDe(olga.personaId, 'PENDIENTE')).toBe(1)
      await entrarAlPortalCon(page, olga.token)
      await page.context().route('https://wa.me/**', (ruta) =>
        ruta.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp de mentira</p>' }),
      )
      await page.goto('/procesos')

      const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
      await expect(paso1.getByText('1 de 3')).toBeVisible()
      await paso1.getByRole('button', { name: 'Siguiente' }).click()
      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      // Esperando: la tuerca va limpia.
      await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toBeVisible()
      await expect(puntito(page)).toHaveCount(0)
      await paso2.getByRole('button', { name: 'Siguiente' }).click()

      const paso3 = page.getByRole('dialog', { name: 'Termina de activar WhatsApp' })
      await expect(paso3.getByText('3 de 3')).toBeVisible()
      await expect(page.getByRole('dialog', { name: 'Todo listo' })).toHaveCount(0)
      // QA-09: su número enmascarado, como el de WhatsApp activo («+51 9•• ••• 434»); nunca entero.
      const suNumero = `+51 ${olga.celular.e164.charAt(3)}•• ••• ${olga.celular.e164.slice(-3)}`
      await expect(paso3.getByText(`Envía el mensaje desde tu número ${suNumero}.`, { exact: true })).toBeVisible()
      await expect(paso3.getByText(olga.celular.mostrado)).toHaveCount(0)
      // Ya firmó al activarlo: sin consentimiento, y solo el botón verde y «Ahora no».
      await expect(paso3.getByText(CONSENTIMIENTO)).toHaveCount(0)
      await expect(paso3.getByRole('button')).toHaveText(['Abrir WhatsApp', 'Ahora no'])
      const abrirWhatsapp = paso3.getByRole('button', { name: 'Abrir WhatsApp' })
      await expect(abrirWhatsapp).toBeFocused()

      // El mismo flujo que la ventana: la pestaña pedida en el clic lleva al chat del bot.
      const [pestana] = await Promise.all([page.waitForEvent('popup'), abrirWhatsapp.click()])
      await pestana.waitForURL(/wa\.me/)
      expect(new URL(pestana.url()).pathname).toBe(`/${NUMERO_DEL_BOT}`)
      await pestana.close()
      await expect(laGuia(page)).toHaveCount(0)
      await expect.poll(() => guiaVistaEn(olga.personaId) !== null).toBe(true)
      // Detrás quedan los ajustes, todavía esperando su mensaje.
      await whatsappEsta(page, 'esperando')
      // Renueva la espera: ni otro vínculo ni otra firma.
      expect(vinculosDe(olga.personaId, 'PENDIENTE')).toBe(1)
      expect(vinculosDe(olga.personaId, 'ACTIVO')).toBe(0)
      expect(
        contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                 where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${olga.personaId}`),
      ).toBe(1)
    })

    test('variante esperando · «Ahora no» la da por vista sin abrir el chat ni los ajustes, y el foco vuelve a la campana', async ({ page }) => {
      const pia = await cuentaCon('Pia')
      await postulada(pia, vacantes[0]!)
      expect((await exigir('/portal/notificaciones/whatsapp', pia.token, 'POST')).resultado).toBe('POR_MENSAJE')
      const anunciadoAntes = String(uno(`select max(anunciado_en) as a from vinculo_whatsapp where persona_id = ${pia.personaId}`).a)
      await entrarAlPortalCon(page, pia.token)
      let abrioPestana = false
      page.context().on('page', () => { abrioPestana = true })
      await page.goto('/procesos')

      await page.getByRole('dialog', { name: 'Aquí te avisamos de todo' }).getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' }).getByRole('button', { name: 'Siguiente' }).click()
      const paso3 = page.getByRole('dialog', { name: 'Termina de activar WhatsApp' })
      await expect(paso3.getByRole('button', { name: 'Abrir WhatsApp' })).toBeFocused()
      await paso3.getByRole('button', { name: 'Ahora no' }).click()

      await expect(laGuia(page)).toHaveCount(0)
      await expect(campana(page)).toBeFocused()
      await expect(ventana(page)).toBeHidden()
      await expect.poll(() => guiaVistaEn(pia.personaId) !== null).toBe(true)
      expect(abrioPestana).toBe(false)
      // WhatsApp no se toca: sigue esperando el mismo anuncio.
      expect(vinculosDe(pia.personaId, 'PENDIENTE')).toBe(1)
      expect(String(uno(`select max(anunciado_en) as a from vinculo_whatsapp where persona_id = ${pia.personaId}`).a)).toBe(anunciadoAntes)
    })

    // ---- QA, ciclo 6 (QA-08): los ajustes que abre la guía, al cerrarse, devuelven el foco a la campana ----

    test('variante esperando · sin pestaña (el navegador la bloquea), Esc en los ajustes que abrió «Abrir WhatsApp» devuelve el foco a la campana', async ({ page }) => {
      const quique = await cuentaCon('Quique')
      await postulada(quique, vacantes[0]!)
      expect((await exigir('/portal/notificaciones/whatsapp', quique.token, 'POST')).resultado).toBe('POR_MENSAJE')
      await entrarAlPortalCon(page, quique.token)
      // Como un bloqueador de ventanas emergentes: el chat queda en «Ábrelo desde aquí».
      await page.addInitScript(() => {
        window.open = () => null
      })
      await page.goto('/procesos')

      await page.getByRole('dialog', { name: 'Aquí te avisamos de todo' }).getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' }).getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('dialog', { name: 'Termina de activar WhatsApp' }).getByRole('button', { name: 'Abrir WhatsApp' }).click()

      await expect(laGuia(page)).toHaveCount(0)
      await expect(ventana(page).getByRole('link', { name: 'Ábrelo desde aquí' })).toBeVisible()
      await page.keyboard.press('Escape')

      await expect(ventana(page)).toBeHidden()
      // Sin esto el foco cae al <body> y el tabulador sigue desde cualquier parte de la página.
      await expect(campana(page)).toBeFocused()
    })

    test('variante sin número · cerrar con la × los ajustes que abrió «Activar WhatsApp» devuelve el foco a la campana', async ({ page }) => {
      const rita = await cuentaCon('Rita')
      await postulada(rita, vacantes[0]!)
      sql(`update persona set telefono = null where id = ${rita.personaId};`)
      await entrarAlPortalCon(page, rita.token)
      await page.goto('/procesos')

      await page.getByRole('dialog', { name: 'Aquí te avisamos de todo' }).getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' }).getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' }).getByRole('button', { name: 'Activar WhatsApp' }).click()

      await expect(laGuia(page)).toHaveCount(0)
      await expect(ventana(page).getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')).toBeFocused()
      await ventana(page).getByRole('button', { name: 'Cerrar' }).click()

      await expect(ventana(page)).toBeHidden()
      await expect(campana(page)).toBeFocused()
    })

    test('variante sin WhatsApp (beta apagada) · dos pasos, sin su chip ni puntito, y el segundo termina en «Entendido»', async ({ page }) => {
      const fede = await cuentaCon('Fede')
      await postulada(fede, vacantes[0]!)
      await entrarAlPortalCon(page, fede.token)
      await ponerLaBeta(equipo, false)
      try {
        await page.goto('/procesos')
        const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
        await expect(paso1.getByText('1 de 2')).toBeVisible()
        await paso1.getByRole('button', { name: 'Siguiente' }).click()

        const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
        await expect(paso2.getByText('2 de 2')).toBeVisible()
        await expect(paso2.getByRole('listitem')).toHaveText(['Correo', 'En el portal'])
        await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toBeVisible()
        await expect(puntito(page)).toHaveCount(0)
        const entendido = paso2.getByRole('button', { name: 'Entendido' })
        await expect(entendido).toBeFocused()
        await entendido.click()

        await expect(laGuia(page)).toHaveCount(0)
        await expect.poll(() => guiaVistaEn(fede.personaId) !== null).toBe(true)
        // La guía cierra la campana al terminar: se espera a que salga antes de volver a abrirla.
        await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toHaveCount(0)
        await abrirLosAjustes(page)
        await whatsappEsta(page, 'sin WhatsApp')
      } finally {
        await ponerLaBeta(equipo, true)
      }
    })

    test('variante sin número · «Activar WhatsApp» abre los ajustes con el foco en el campo del celular, sin firmar ni abrir el chat', async ({ page }) => {
      const gala = await cuentaCon('Gala')
      await postulada(gala, vacantes[0]!)
      sql(`update persona set telefono = null where id = ${gala.personaId};`)
      await entrarAlPortalCon(page, gala.token)
      let abrioPestana = false
      page.context().on('page', () => { abrioPestana = true })
      await page.goto('/procesos')

      await page.getByRole('dialog', { name: 'Aquí te avisamos de todo' }).getByRole('button', { name: 'Siguiente' }).click()
      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      // Sin número también se puede activar: puntito.
      await expect(puntito(page)).toHaveCount(1)
      await paso2.getByRole('button', { name: 'Siguiente' }).click()
      const paso3 = page.getByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' })
      await paso3.getByRole('button', { name: 'Activar WhatsApp' }).click()

      await expect(laGuia(page)).toHaveCount(0)
      const campo = ventana(page).getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')
      await expect(campo).toBeVisible()
      await expect(campo).toBeFocused()
      await expect(ventana(page).getByText('Sin número', { exact: true })).toBeVisible()
      await expect(interruptorDeWhatsapp(page)).toHaveCount(0)
      await expect.poll(() => guiaVistaEn(gala.personaId) !== null).toBe(true)
      expect(abrioPestana).toBe(false)
      expect(vinculosDe(gala.personaId, 'PENDIENTE') + vinculosDe(gala.personaId, 'ACTIVO')).toBe(0)
      expect(
        contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                 where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${gala.personaId}`),
      ).toBe(0)
    })

    test('variante comprobado (tras BAJA) · «Activar WhatsApp» lo enciende con un clic, sin chat, y sale de la BAJA', async ({ page }) => {
      const ines = await cuentaCon('Ines')
      await postulada(ines, vacantes[0]!)
      await conWhatsappActivo(ines)
      const baja = await comoElBot('/bajas', 'POST', { telefono: ines.celular.e164.replace('+', '') })
      expect(baja.estado).toBe(204)
      expect(enLaBaja(ines.celular.e164)).toBe(1)
      await entrarAlPortalCon(page, ines.token)
      let abrioPestana = false
      page.context().on('page', () => { abrioPestana = true })
      await page.goto('/procesos')

      await page.getByRole('dialog', { name: 'Aquí te avisamos de todo' }).getByRole('button', { name: 'Siguiente' }).click()
      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      await expect(puntito(page)).toHaveCount(1)
      await paso2.getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' }).getByRole('button', { name: 'Activar WhatsApp' }).click()

      await expect(laGuia(page)).toHaveCount(0)
      await expect(ventana(page).getByText('Te enviamos un mensaje para confirmarlo.', { exact: false })).toBeVisible()
      await expect(interruptorDeWhatsapp(page)).toHaveAttribute('aria-checked', 'true')
      expect(abrioPestana).toBe(false)
      expect(enLaBaja(ines.celular.e164)).toBe(0)
      expect(vinculosDe(ines.personaId, 'ACTIVO')).toBe(1)
      expect((await vinculacionesDe(ines.celular.e164)).map((l) => l.cuerpo.motivo)).toEqual(['ACTIVACION'])
      await expect.poll(() => guiaVistaEn(ines.personaId) !== null).toBe(true)
    })

    test('teclado · Tab no sale de la burbuja, «Atrás» vuelve, y «Ahora no» la da por vista sin tocar WhatsApp; fuera de «Mis procesos» no sale', async ({ page }) => {
      const hana = await cuentaCon('Hana')
      await postulada(hana, vacantes[0]!)
      await entrarAlPortalCon(page, hana.token)

      // Otra pantalla, con postulación y la guía sin ver: no la pide.
      await page.goto('/perfil')
      await abrirLaCampana(page)
      await expect(laGuia(page)).toHaveCount(0)

      await page.goto('/procesos')
      const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
      const siguiente1 = paso1.getByRole('button', { name: 'Siguiente' })
      // El foco inicial del paso 1 lo exigen «AC-01/02/03» y la 74 (hallazgo QA-06); aquí se
      // pone a mano para probar lo demás del teclado sin depender de él.
      await expect(siguiente1).toBeVisible()
      await siguiente1.focus()
      await expect(siguiente1).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(paso1.getByRole('button', { name: 'Saltar guía' })).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(siguiente1).toBeFocused()
      await page.keyboard.press('Enter')

      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      await expect(paso2.getByRole('button', { name: 'Siguiente' })).toBeFocused()
      await paso2.getByRole('button', { name: 'Atrás' }).click()
      await expect(paso1.getByRole('button', { name: 'Siguiente' })).toBeFocused()
      // En el paso 1 la campana vuelve a estar cerrada.
      await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toHaveCount(0)
      await paso1.getByRole('button', { name: 'Siguiente' }).click()
      await paso2.getByRole('button', { name: 'Siguiente' }).click()

      const paso3 = page.getByRole('dialog', { name: 'Recibe tus avisos por WhatsApp' })
      const activar = paso3.getByRole('button', { name: 'Activar WhatsApp' })
      await expect(activar).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(paso3.getByRole('button', { name: 'Atrás' })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(paso3.getByRole('button', { name: 'Ahora no' })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(activar).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(paso3.getByRole('button', { name: 'Ahora no' })).toBeFocused()
      await page.keyboard.press('Enter')

      await expect(laGuia(page)).toHaveCount(0)
      await expect(campana(page)).toBeFocused()
      await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toHaveCount(0)
      await expect.poll(() => guiaVistaEn(hana.personaId) !== null).toBe(true)
      expect(vinculosDe(hana.personaId, 'PENDIENTE') + vinculosDe(hana.personaId, 'ACTIVO')).toBe(0)
      expect(Boolean(uno(`select coalesce(bool_or(whatsapp_activo), false) as a from preferencia_aviso where persona_id = ${hana.personaId}`).a)).toBe(false)
      expect(
        contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
                 where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${hana.personaId}`),
      ).toBe(0)
      await page.reload()
      await abrirLaCampana(page)
      await expect(laGuia(page)).toHaveCount(0)
    })

    test('movimiento reducido · los pasos y la ventana solo cambian de opacidad, y el foco salta sin deslizarse', async ({ page }) => {
      const juan = await cuentaCon('Juan')
      await postulada(juan, vacantes[0]!)
      await entrarAlPortalCon(page, juan.token)
      await page.goto('/procesos')

      // Testigo: sin la preferencia, el paso entra con desplazamiento.
      const paso1 = page.getByRole('dialog', { name: 'Aquí te avisamos de todo' })
      expect(await loQueAnima(paso1.locator('h2').locator('xpath=..'))).toContain('transform')

      await page.emulateMedia({ reducedMotion: 'reduce' })
      await paso1.getByRole('button', { name: 'Siguiente' }).click()
      const paso2 = page.getByRole('dialog', { name: 'Con la tuerca eliges por dónde' })
      await expect(paso2.getByRole('button', { name: 'Siguiente' })).toBeFocused()
      expect(await loQueAnima(paso2.locator('h2').locator('xpath=..'))).toEqual(['opacity'])
      await expect(laGuia(page)).toHaveAttribute('data-colocada', '')
      const foco = laGuia(page).locator('div[aria-hidden="true"]').first()
      // `transition: none` (o la regla global de 0,01 ms): nada que se vea deslizarse.
      const duraciones = await foco.evaluate((el) => getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d)))
      expect(Math.max(...duraciones)).toBeLessThanOrEqual(0.001)

      await page.keyboard.press('Escape')
      await expect(laGuia(page)).toHaveCount(0)
      await expect(page.locator('[role="dialog"][aria-label="Tus avisos"]')).toHaveCount(0)
      await abrirLosAjustes(page)
      expect(await loQueAnima(ventana(page))).toEqual(['opacity'])
    })
  })

  test('la tuerca · en escritorio el panel mide 22rem y la tuerca va junto a «Marcar todos como leídos»; «Mis procesos» ya no tiene botón, línea ni mensaje', async ({ page }) => {
    const kira = await cuentaCon('Kira')
    const postulacion = await postulada(kira, vacantes[0]!)
    const organizacion = Number(uno(`select organizacion_id as o from vacante where id = ${vacantes[0]!}`).o)
    sql(`insert into aviso_portal (usuario_id, organizacion_id, tipo, titulo, cuerpo, postulacion_id)
         values (${kira.usuarioId}, ${organizacion}, 'POSTULACION_AVANZA', ${literal(`${MARCA} Tu proceso avanzó`)},
                 'Mira en qué está.', ${postulacion});`)
    await entrarAlPortalCon(page, kira.token)
    const mensajeVisto: string[] = []
    page.on('request', (r) => { if (r.url().includes('/notificaciones/mensaje-visto')) mensajeVisto.push(r.url()) })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/procesos')

    await expect(page.getByText('Estamos calificando tus respuestas').first()).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: /Notificaciones/ })).toHaveCount(0)
    await expect(page.locator('main').getByText(/^(WhatsApp (activo|apagado|sin número)|Correo y portal|Esperando tu mensaje)$/)).toHaveCount(0)
    await expect(page.getByText('Recibe tus avisos por WhatsApp')).toHaveCount(0)

    const panel = await abrirLaCampana(page)
    // 22rem con el tamaño de letra raíz del portal, una vez terminada la entrada (escala 0,95 → 1).
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
    await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(Math.round(22 * rem))
    const caja = await panel.boundingBox()
    const marcar = await panel.getByRole('button', { name: 'Marcar todos como leídos' }).boundingBox()
    const laTuerca = await tuerca(page).boundingBox()
    expect(marcar && laTuerca).toBeTruthy()
    // En la misma fila, la tuerca a la derecha.
    expect(Math.abs(marcar!.y + marcar!.height / 2 - (laTuerca!.y + laTuerca!.height / 2))).toBeLessThanOrEqual(4)
    expect(laTuerca!.x).toBeGreaterThanOrEqual(marcar!.x + marcar!.width)
    expect(laTuerca!.x + laTuerca!.width).toBeLessThanOrEqual(caja!.x + caja!.width)
    await expect(puntito(page)).toHaveCount(1)

    // El globito lo nombra al pasar el ratón; el puntito no lleva texto.
    await tuerca(page).hover()
    await expect(tuerca(page).getByText('Ajustes de avisos')).toBeVisible()
    await expect(puntito(page)).toHaveText('')

    await tuerca(page).click()
    await expect(ventana(page).getByRole('heading', { name: 'Ajustes de avisos' })).toBeVisible()
    await whatsappEsta(page, 'apagado')
    // Esc cierra la ventana y deja la campana abierta debajo, con el foco en la tuerca.
    await page.keyboard.press('Escape')
    await expect(ventana(page)).toBeHidden()
    await expect(panel).toBeVisible()
    await expect(tuerca(page)).toBeFocused()
    expect(mensajeVisto).toEqual([])
  })

  test('«Cámbialo en Mi cuenta» · lleva al celular de «Mi cuenta» con el foco dentro y la ventana de ajustes se cierra', async ({ page }) => {
    const lia = await cuentaCon('Lia')
    await postulada(lia, vacantes[0]!)
    await entrarAlPortalCon(page, lia.token)
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await ventana(page).getByRole('link', { name: 'Cámbialo en Mi cuenta' }).click()

    await expect(page).toHaveURL(/\/perfil#celular$/)
    // La ventana vive en la cabecera y ya no se va con «Mis procesos»: tiene que cerrarse sola.
    await expect(ventana(page)).toBeHidden()
    const campo = page.getByLabel(/^Celular \(WhatsApp\)/)
    await expect(campo).toBeFocused()
    await expect(campo).toHaveValue(lia.celular.escrito)
  })

  test('AC-07 · apagarlo cierra todo con DEJAR_DE_RECIBIR y volver a encender es un clic', async ({ page }) => {
    const beto = await cuentaCon('Beto')
    await postulada(beto, vacantes[0]!)
    await postulada(beto, vacantes[1]!)
    await conWhatsappActivo(beto)
    await entrarAlPortalCon(page, beto.token)
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'activo')

    await interruptor(page, 'Notificaciones por WhatsApp').click()
    await expect(interruptor(page, 'Notificaciones por WhatsApp')).toHaveAttribute('aria-checked', 'false')
    await whatsappEsta(page, 'apagado')
    await expect(ventana(page).getByText(CONSENTIMIENTO)).toBeVisible()
    expect(vinculosDe(beto.personaId, 'ACTIVO')).toBe(0)
    expect(
      contar(`select count(*) as n from vinculo_whatsapp where persona_id = ${beto.personaId}
               and estado = 'REVOCADO' and motivo_cierre = 'DEJAR_DE_RECIBIR'`),
    ).toBe(2)
    await expect
      .poll(async () => (await loQueRecibioElBot(beto.celular.e164)).filter((l) => l.tipo === 'REVOCACION').length, { timeout: 30_000 })
      .toBe(2)

    // Volver a encender: número comprobado, un clic, sin chat.
    let abrioPestana = false
    page.context().on('page', () => { abrioPestana = true })
    await interruptor(page, 'Notificaciones por WhatsApp').click()
    await whatsappEsta(page, 'activo')
    await expect(ventana(page).getByText('Te enviamos un mensaje para confirmarlo.', { exact: false })).toBeVisible()
    expect(abrioPestana).toBe(false)
    expect(vinculosDe(beto.personaId, 'ACTIVO')).toBe(2)
    const vinculaciones = await vinculacionesDe(beto.celular.e164)
    expect(vinculaciones.map((l) => l.cuerpo.motivo)).toEqual(['ACTIVACION'])
  })

  test('AC-05/13 · tras BAJA: con el bot caído no cambia nada; con el bot de vuelta, un clic', async ({ page }) => {
    const carla = await cuentaCon('Carla')
    const p1 = await postulada(carla, vacantes[0]!)
    const p2 = await postulada(carla, vacantes[1]!)
    await conWhatsappActivo(carla)
    const baja = await comoElBot('/bajas', 'POST', { telefono: carla.celular.e164.replace('+', '') })
    expect(baja.estado).toBe(204)
    expect(enLaBaja(carla.celular.e164)).toBe(1)
    expect(vinculosDe(carla.personaId, 'ACTIVO')).toBe(0)

    await entrarAlPortalCon(page, carla.token)
    await page.goto('/procesos')
    // Tras la BAJA, la tuerca vuelve a llevar el puntito y la ventana dice cuándo la escribió.
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'apagado por BAJA')
    await expect(ventana(page).getByText(/^Lo apagaste escribiendo BAJA el \d{1,2} [a-z]{3}\./)).toBeVisible()

    let abrioPestana = false
    page.context().on('page', () => { abrioPestana = true })
    const activosAntes = vinculosDe(carla.personaId, 'ACTIVO')

    // AC-13 · el bot no contesta: nada sale de la BAJA, ningún vínculo, y el aviso de la ventana
    await comoElBot('/falso/caido', 'POST', { caido: true })
    try {
      await interruptor(page, 'Notificaciones por WhatsApp').click()
      await expect(ventana(page).getByRole('alert')).toHaveText('No pudimos activarlo. Vuelve a intentarlo en un momento.')
    } finally {
      await comoElBot('/falso/caido', 'POST', { caido: false })
    }
    expect(enLaBaja(carla.celular.e164)).toBe(1)
    expect(vinculosDe(carla.personaId, 'ACTIVO')).toBe(activosAntes)
    expect(vinculosDe(carla.personaId, 'PENDIENTE')).toBe(0)
    expect(Boolean(uno(`select whatsapp_activo as a from preferencia_aviso where persona_id = ${carla.personaId}`).a)).toBe(false)
    await expect(interruptorDeWhatsapp(page)).toHaveAttribute('aria-checked', 'false')
    await expect(puntito(page)).toHaveCount(1)

    // AC-05 · con el bot de vuelta: ACTIVACION, sale de la BAJA, sus procesos ACTIVO, sin chat
    await interruptor(page, 'Notificaciones por WhatsApp').click()
    await whatsappEsta(page, 'activo')
    await expect(ventana(page).getByText('Te enviamos un mensaje para confirmarlo.', { exact: false })).toBeVisible()
    expect(abrioPestana).toBe(false)
    expect(enLaBaja(carla.celular.e164)).toBe(0)
    expect(
      contar(`select count(*) as n from vinculo_whatsapp where persona_id = ${carla.personaId}
               and estado = 'ACTIVO' and postulacion_id in (${p1}, ${p2})`),
    ).toBe(2)
    const vinculaciones = await vinculacionesDe(carla.celular.e164)
    expect(vinculaciones).toHaveLength(1)
    expect(vinculaciones[0]!.cuerpo.motivo).toBe('ACTIVACION')
    expect((vinculaciones[0]!.cuerpo as { postulaciones?: unknown[] }).postulaciones).toHaveLength(2)
  })

  test('AC-06 · con WhatsApp activo, la postulación nueva queda vinculada sola', async ({ page }) => {
    const dani = await cuentaCon('Dani')
    await postulada(dani, vacantes[0]!)
    await conWhatsappActivo(dani)
    const nueva = postulacionPorUuid(await postular(dani.token, vacantes[2]!))

    await expect
      .poll(() => contar(`select count(*) as n from vinculo_whatsapp where postulacion_id = ${nueva} and estado = 'ACTIVO'`), { timeout: 30_000 })
      .toBe(1)
    const referencia = String(uno(`select referencia from vinculo_whatsapp where postulacion_id = ${nueva}`).referencia)
    const vinculaciones = await vinculacionesDe(dani.celular.e164)
    expect(vinculaciones.map((l) => l.cuerpo.motivo)).toEqual(['NUEVA_POSTULACION'])
    expect((vinculaciones[0]!.cuerpo as { postulaciones?: { postulacionRef: string }[] }).postulaciones)
      .toEqual([expect.objectContaining({ postulacionRef: referencia })])

    await entrarAlPortalCon(page, dani.token)
    await page.goto('/procesos')
    await expect(page.getByRole('region', { name: /novedades por WhatsApp/i })).toHaveCount(0)
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'activo')
  })

  test('AC-08/09 · correo o campana apagados al mover la postulación; recuperar la clave sale', async ({ page }) => {
    const restaurarTope = holgarElTopePorIp()
    try {
      const eva = await cuentaCon('Eva') // correo apagado, WhatsApp activo
      const fede = await cuentaCon('Fede') // campana apagada
      const gina = await cuentaCon('Gina') // todo encendido: el testigo
      const pEva = await postulada(eva, vacantes[0]!)
      const pFede = await postulada(fede, vacantes[0]!)
      const pGina = await postulada(gina, vacantes[0]!)
      await conWhatsappActivo(eva)

      // Eva apaga el correo desde la ventana, con su aviso debajo.
      await entrarAlPortalCon(page, eva.token)
      await page.goto('/procesos')
      await abrirLosAjustes(page)
      await interruptor(page, 'Notificaciones por correo').click()
      await expect(interruptor(page, 'Notificaciones por correo')).toHaveAttribute('aria-checked', 'false')
      await expect(ventana(page).getByText('No te llegarán por correo los plazos de tus pruebas. Los verás aquí, en el portal.')).toBeVisible()
      await expect.poll(() => uno(`select correo from preferencia_aviso where persona_id = ${eva.personaId}`).correo).toBe(false)
      // Lo que le llegó al postular (con el correo encendido) no cuenta: desde aquí, nada de sus procesos.
      const ultimoCorreoAntes = Number(uno(`select coalesce(max(id), 0) as n from correo_enviado where usuario_id = ${eva.usuarioId}`).n)
      // Fede apaga la campana por la API.
      const cambio = await exigir('/portal/notificaciones', fede.token, 'PATCH', { portal: false })
      expect(cambio.portal.activo).toBe(false)
      expect(cambio.correo.activo).toBe(true)
      // Lo que su campana recibió al postular (con ella encendida) no cuenta.
      const ultimoAvisoDeFede = Number(uno(`select coalesce(max(id), 0) as n from aviso_portal where usuario_id = ${fede.usuarioId}`).n)

      const correosAntes = (u: number) =>
        contar(`select count(*) as n from correo_enviado where usuario_id = ${u} and plantilla_correo_codigo = 'PRUEBA_DISPONIBLE'`)
      expect(correosAntes(eva.usuarioId)).toBe(0)

      for (const p of [pEva, pFede, pGina]) {
        await exigir(`/panel/postulaciones/${p}/transiciones`, equipo, 'POST', {
          estadoDestino: 'PRUEBA_TURNO_CANDIDATO',
          motivo: 'Pasa a la prueba (E2E de notificaciones)',
          avisar: true,
        })
      }
      // El testigo recibe correo y campana; Eva, WhatsApp y campana pero no el correo.
      await expect.poll(() => correosAntes(gina.usuarioId), { timeout: 30_000 }).toBe(1)
      await expect
        .poll(() => contar(`select count(*) as n from aviso_portal where usuario_id = ${gina.usuarioId} and postulacion_id = ${pGina}`), { timeout: 30_000 })
        .toBeGreaterThan(0)
      await expect
        .poll(() => contar(`select count(*) as n from aviso_whatsapp where postulacion_id = ${pEva}`), { timeout: 30_000 })
        .toBe(1)
      await expect
        .poll(() => contar(`select count(*) as n from aviso_portal where usuario_id = ${eva.usuarioId} and postulacion_id = ${pEva}`), { timeout: 30_000 })
        .toBeGreaterThan(0)
      await expect.poll(() => correosAntes(fede.usuarioId), { timeout: 30_000 }).toBe(1)
      expect(correosAntes(eva.usuarioId)).toBe(0)
      expect(contar(`select count(*) as n from correo_enviado where usuario_id = ${eva.usuarioId}
                      and id > ${ultimoCorreoAntes}`)).toBe(0)
      // AC-09 · Fede: la campana no recibe nada de su proceso, y el proceso muestra el estado nuevo
      expect(contar(`select count(*) as n from aviso_portal where usuario_id = ${fede.usuarioId}
                      and postulacion_id = ${pFede} and id > ${ultimoAvisoDeFede}`)).toBe(0)
      await page.evaluate(() => window.localStorage.clear())
      await entrarAlPortalCon(page, fede.token)
      await page.goto('/procesos')
      await expect(page.getByRole('link', { name: /Abrir prueba/ }).first()).toBeVisible()

      // Recuperar la clave sigue mandando correo con el correo apagado.
      expect(await pedirPorApi('portal', eva.correo)).toBeLessThan(300)
      await expect
        .poll(() => contar(`select count(*) as n from correo_enviado where usuario_id = ${eva.usuarioId}
                             and plantilla_correo_codigo = ${literal(PLANTILLA_CANDIDATO)}`), { timeout: 20_000 })
        .toBe(1)
    } finally {
      restaurarTope()
    }
  })

  test('AC-11 · un celular de otra cuenta: 409 TELEFONO_EN_USO en la ventana y en «Mi cuenta»', async ({ page }) => {
    const ines = await cuentaCon('Inés') // dueña del número
    const juan = await cuentaCon('Juan') // lo quiere en «Mi cuenta»
    const kira = await cuentaCon('Kira') // sin número: lo quiere en la ventana
    sql(`update persona set telefono = null where id = ${kira.personaId};`)
    const MENSAJE = 'Ese número ya está en otra cuenta. Usa otro o entra con esa cuenta.'

    // La API
    const r = await pedir('/portal/cuenta/telefono', juan.token, 'PUT', { telefono: ines.celular.e164 })
    expect(r.estado).toBe(409)
    expect(r.cuerpo.codigo).toBe('TELEFONO_EN_USO')

    // En la ventana, sin número: el campo y «Guardar»
    await entrarAlPortalCon(page, kira.token)
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'sin número')
    const campo = ventana(page).getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')
    await expect(campo).toBeVisible()
    await expect(interruptor(page, 'Notificaciones por WhatsApp')).toHaveCount(0)
    await campo.fill(ines.celular.escrito)
    const [respuesta] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/portal/cuenta/telefono') && res.request().method() !== 'GET'),
      ventana(page).getByRole('button', { name: 'Guardar' }).click(),
    ])
    expect(respuesta.status()).toBe(409)
    await expect(ventana(page).getByText(MENSAJE)).toBeVisible()
    expect(uno(`select telefono from persona where id = ${kira.personaId}`).telefono).toBeNull()

    // En «Mi cuenta»
    await page.evaluate(() => window.localStorage.clear())
    await entrarAlPortalCon(page, juan.token)
    // «/perfil#celular» abre el campo ya editable (el enlace «Cámbialo en Mi cuenta» lleva aquí).
    await page.goto('/perfil#celular')
    const delPerfil = page.getByLabel(/^Celular \(WhatsApp\)/)
    await expect(delPerfil).toBeVisible()
    await delPerfil.fill(ines.celular.escrito)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(MENSAJE)).toBeVisible()
    expect(uno(`select telefono from persona where id = ${juan.personaId}`).telefono).toBe(juan.celular.e164)
  })

  test('AC-12 · cambiar el número deja WhatsApp apagado y activar abre el chat', async ({ page }) => {
    const lia = await cuentaCon('Lía')
    await postulada(lia, vacantes[0]!)
    await conWhatsappActivo(lia)
    const nuevo = celularUnico()
    celulares.push(nuevo.e164)
    await exigir('/portal/cuenta/telefono', lia.token, 'PUT', { telefono: nuevo.e164 })

    const estado = await exigir('/portal/notificaciones', lia.token)
    expect(estado.whatsapp).toMatchObject({ estado: 'APAGADO', cambioDeNumero: true, comprobado: false })

    await entrarAlPortalCon(page, lia.token)
    await page.context().route('https://wa.me/**', (ruta) =>
      ruta.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp de mentira</p>' }),
    )
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'apagado')
    await expect(ventana(page).getByText('Cambiaste tu número. Actívalo y envía un mensaje desde el nuevo para comprobarlo.')).toBeVisible()
    const [pestana] = await Promise.all([
      page.waitForEvent('popup'),
      interruptor(page, 'Notificaciones por WhatsApp').click(),
    ])
    await pestana.waitForURL(/wa\.me/)
    await pestana.close()
    await whatsappEsta(page, 'esperando')
  })

  test('Doble clic · dos activaciones a la vez: una firma y un PENDIENTE por proceso', async () => {
    const nora = await cuentaCon('Nora')
    await postulada(nora, vacantes[0]!)
    await postulada(nora, vacantes[1]!)
    const [a, b] = await Promise.all([
      pedir('/portal/notificaciones/whatsapp', nora.token, 'POST'),
      pedir('/portal/notificaciones/whatsapp', nora.token, 'POST'),
    ])
    expect([a.estado, b.estado]).toEqual([200, 200])
    expect(
      contar(`select count(*) as n from consentimiento c join texto_consentimiento t on t.id = c.texto_consentimiento_id
               where t.tipo = 'WHATSAPP_CUENTA' and c.persona_id = ${nora.personaId}`),
    ).toBe(1)
    expect(vinculosDe(nora.personaId, 'PENDIENTE')).toBe(2)
  })

  test('AC-04 · 24 h sin mensaje: «No nos llegó tu mensaje… Reintentar»', async ({ page }) => {
    const mia = await cuentaCon('Mía')
    await postulada(mia, vacantes[0]!)
    const activacion = await exigir('/portal/notificaciones/whatsapp', mia.token, 'POST')
    expect(activacion.resultado).toBe('POR_MENSAJE')
    // Pasan las 24 h del anuncio.
    sql(`update vinculo_whatsapp set anunciado_en = now() - interval '25 hours', anuncio_caduca_en = now() - interval '1 hour'
          where persona_id = ${mia.personaId};`)

    await entrarAlPortalCon(page, mia.token)
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'no llegó')
    await expect(ventana(page).getByRole('alert')).toContainText(`No nos llegó tu mensaje desde el ${mia.celular.mostrado}.`)
    await expect(ventana(page).getByRole('button', { name: 'Reintentar' })).toBeVisible()
  })

  test('Paso 2 · lo que el bot contesta a quien escribe sin activar (404 SIN_ANUNCIO) no lo manda a un botón retirado', async () => {
    // El bot repite tal cual el `texto` de EX. Desde la V92 no hay «Escribir por WhatsApp», y
    // desde el 25/11/2026 tampoco el botón «Notificaciones» de «Mis procesos»: se activa en la
    // tuerca de la campana, «Ajustes de avisos». Regresión de QA (QA-03).
    const nina = await cuentaCon('Nina')
    await postulada(nina, vacantes[0]!)
    const r = await comoElBot('/vinculos', 'POST', {
      telefono: nina.celular.e164.replace('+', ''),
      wamid: `wamid.${Date.now()}.${Math.random()}`,
      texto: 'hola',
      recibidoEn: new Date().toISOString(),
    })
    expect(r.estado).toBe(404)
    expect(r.cuerpo.codigo).toBe('SIN_ANUNCIO')
    const texto = String(r.cuerpo.texto)
    expect(texto).not.toContain('Escribir por WhatsApp')
    expect(texto).not.toContain('«Notificaciones»')
    expect(texto).toContain('campana')
    expect(texto).toContain('«Ajustes de avisos»')
    expect(vinculosDe(nina.personaId, 'ACTIVO')).toBe(0)
  })

  test('Paso 23 · sin número, en escritorio: con el error junto al campo, «Guardar» sigue a la altura del campo', async ({ page }) => {
    // Regresión de QA (QA-04): en la maqueta el error va debajo de la fila y «Guardar» queda al
    // lado del campo. El error no debe arrastrar el botón hasta su última línea.
    const olga = await cuentaCon('Olga')
    await postulada(olga, vacantes[0]!)
    sql(`update persona set telefono = null where id = ${olga.personaId};`)
    await entrarAlPortalCon(page, olga.token)
    await page.goto('/procesos')
    await abrirLosAjustes(page)
    await whatsappEsta(page, 'sin número')
    const campo = ventana(page).getByLabel('Agrega tu celular para recibir avisos por WhatsApp.')
    const guardar = ventana(page).getByRole('button', { name: 'Guardar', exact: true })
    const pie = async () => {
      const c = (await campo.boundingBox())!
      const g = (await guardar.boundingBox())!
      return { campo: Math.round(c.y + c.height), guardar: Math.round(g.y + g.height) }
    }
    await campo.pressSequentially('98765')
    const sinError = await pie()
    expect(Math.abs(sinError.guardar - sinError.campo), JSON.stringify(sinError)).toBeLessThanOrEqual(2)

    await guardar.click()
    await expect(ventana(page).getByText(/^Escribe un celular de 9 cifras/)).toBeVisible()
    const conError = await pie()
    expect(Math.abs(conError.guardar - conError.campo), `con el error: ${JSON.stringify(conError)}`).toBeLessThanOrEqual(2)
    expect(uno(`select telefono from persona where id = ${olga.personaId}`).telefono).toBeNull()
  })
})

