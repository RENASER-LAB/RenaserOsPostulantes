import { expect, type Page } from '@playwright/test'

import { limpiarSiempre } from './base-de-datos'
import { entrarAlPortal } from './ayuda'
import { CLAVE_DE_CANDIDATO, test } from './ayuda-candidato'
import {
  auditoriasDe,
  avisosDe,
  correosEnviados,
  formularioDe,
  HORARIO_SEMBRADO,
  PANEL_ACOTADO,
  PANEL_SIN_PERMISO,
  pedirAlPanel,
  retirarLoSembrado,
  sembrarEscenario,
  TITULO_BORRADOR,
  TITULO_PUBLICADA,
  tokenDePanelDe,
  vacanteEnBase,
  type Escenario,
} from './ayuda-editar-vacante'

/**
 * Corregir una vacante publicada y contárselo a quien sigue en carrera.
 *
 * Es la parte que ninguna prueba de servicio puede contestar: que el lápiz diga
 * ANTES de guardar a cuánta gente va a llegar, que el panel cuente después a
 * cuánta llegó de verdad, que un guardado sin cambios no despierte a nadie, y
 * que el aviso que le queda al candidato en la campana lo lleve a su proceso.
 *
 * ⚠️ **ESCRIBE, y por eso siembra su propio terreno.** Una vacante marcada, dos
 * candidatos en carrera, uno que no continúa y uno contratado, un borrador sin
 * nadie y dos cuentas de panel para mirar los permisos desde fuera. No toca las
 * vacantes sembradas de la base —editarlas dejaría avisos que otras pruebas no
 * esperan— y lo suyo se retira al terminar. Ver `ayuda-editar-vacante`.
 *
 * Los pasos comparten estado y van en orden: cada uno deja la vacante donde el
 * siguiente la necesita.
 */
test.describe.configure({ mode: 'serial' })

let escenario: Escenario
/** El título de la publicada, que el último paso cambia a propósito. */
let tituloActual = TITULO_PUBLICADA

const elLapiz = (page: Page, titulo: string) =>
  page.getByRole('button', { name: `Editar la vacante ${titulo}` })

/**
 * Un campo del formulario por su etiqueta.
 *
 * ⚠️ **Sin `exact`, y no es descuido.** La etiqueta envuelve al control, así que
 * el nombre accesible de un `textarea` arrastra lo que tiene escrito dentro:
 * «Descripción» exacta no encuentra nada en cuanto el campo tiene texto.
 */
const campo = (page: Page, etiqueta: string) => page.getByLabel(etiqueta)

/**
 * Lo que el panel dice en voz alta, sin la región viva vacía.
 *
 * La cabecera del portal deja un `role="status"` permanente y vacío para anunciar
 * los cambios de página; buscar «el status» a secas caza los dos.
 */
const confirmacion = (page: Page) => page.getByRole('status').filter({ hasText: /\S/ })

/** Entra al panel con una cuenta concreta y no con la de todos los permisos. */
async function entrarAlPanelComo(page: Page, renaserOsId: string) {
  const token = await tokenDePanelDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

/** Los avisos que la vacante publicada tiene ahora mismo, por su id. */
const idsDeAvisos = (): number[] =>
  avisosDe(escenario.publicada).map((a) => Number(a.id))

test.describe('Editar una vacante publicada y avisar a quien sigue en carrera', () => {
  test.beforeAll(async () => {
    escenario = await sembrarEscenario()
  })

  test.afterAll(() =>
    limpiarSiempre([() => retirarLoSembrado(escenario?.correos ?? [])]),
  )

  // ---------- 1. Horario y descripción: un aviso por persona en carrera ----------

  test('cambiar el horario y la descripción deja UN aviso a cada persona en carrera y ningún correo', async ({
    page,
  }) => {
    const correosAntes = correosEnviados()
    await abrirElPanel(page)

    await elLapiz(page, tituloActual).click()
    await expect(page.getByRole('heading', { name: 'Editar vacante' })).toBeVisible()

    // Lo que se promete antes de pulsar, con la cifra de verdad.
    await expect(
      page.getByText(
        'Al guardar, avisaremos en su portal a 2 postulantes en carrera de lo que cambies',
      ),
    ).toBeVisible()

    await campo(page, 'Horario').fill('L-V de 8 a 5')
    await campo(page, 'Descripción').fill('Lee datos y los cuenta. Ahora también los explica.')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    // Y lo que se dice después: el número es el de los avisos que de verdad se publicaron.
    await expect(confirmacion(page)).toHaveText(
      'Cambios guardados. Avisamos a 2 postulantes en su portal',
    )

    const avisos = avisosDe(escenario.publicada, 'VACANTE_ACTUALIZADA')
    expect(avisos).toHaveLength(2)
    expect(avisos.map((a) => Number(a.usuario_id)).sort()).toEqual(
      escenario.enCarrera.map((p) => p.usuarioId).sort(),
    )
    // Cada aviso cuelga de SU postulación: es lo que hace que lleve al proceso.
    expect(avisos.map((a) => Number(a.postulacion_id)).sort()).toEqual(
      escenario.enCarrera.map((p) => p.postulacionId).sort(),
    )

    const cuerpo = String(avisos[0]!.cuerpo)
    expect(cuerpo).toContain(`Horario: ${HORARIO_SEMBRADO} → L-V de 8 a 5`)
    // Lo largo se nombra y no se pega: dos párrafos en una campana tapan en vez de informar.
    expect(cuerpo).toContain('Se actualizó la descripción')
    expect(cuerpo).not.toContain('Ahora también los explica')
    expect(cuerpo).toContain('Tu postulación sigue su curso y no tienes que hacer nada.')
    expect(String(avisos[0]!.titulo)).toBe(`Se actualizó la vacante «${tituloActual}»`)

    // A quien ya terminó no le llega nada: la noticia no le afecta.
    for (const terminada of escenario.terminadas) {
      expect(
        avisos.filter((a) => Number(a.usuario_id) === terminada.usuarioId),
      ).toHaveLength(0)
    }
    expect(correosEnviados(), 'editar una vacante no manda correos').toBe(correosAntes)

    // Y la tabla enseña lo guardado.
    expect(String(vacanteEnBase(escenario.publicada).horario)).toBe('L-V de 8 a 5')
  })

  // ---------- 2. Sin cambios, con espacios, y solo lo interno ----------

  test('guardar sin cambios —o con espacios de más— no avisa ni audita; cambiar el responsable tampoco avisa', async ({
    page,
  }) => {
    const avisosAntes = idsDeAvisos().length
    const auditoriasAntes = auditoriasDe(escenario.publicada).length

    await abrirElPanel(page)
    await elLapiz(page, tituloActual).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    await expect(confirmacion(page)).toHaveText('No había cambios que guardar')
    await expect(page.getByRole('heading', { name: 'Editar vacante' })).toHaveCount(0)
    expect(idsDeAvisos()).toHaveLength(avisosAntes)
    expect(auditoriasDe(escenario.publicada)).toHaveLength(auditoriasAntes)

    // La misma comprobación donde de verdad tiene que vivir: el backend. El
    // formulario ya recorta, así que sin esto nadie sabría si el servidor
    // también lo hace — y el PUT es una puerta abierta a cualquiera.
    const formulario = await formularioDe(escenario.publicada)
    const conEspacios = await pedirAlPanel(`/vacantes/${escenario.publicada}`, {
      metodo: 'PUT',
      cuerpo: {
        ...formulario,
        titulo: `  ${formulario.titulo as string}  `,
        horario: ` ${formulario.horario as string}\n`,
      },
    })
    expect(conEspacios.estado).toBe(200)
    expect(conEspacios.cuerpo).toEqual({ huboCambios: false, postulantesAvisados: 0 })
    expect(idsDeAvisos()).toHaveLength(avisosAntes)
    expect(auditoriasDe(escenario.publicada)).toHaveLength(auditoriasAntes)

    // Y ahora solo lo interno: quién lleva el proceso. Se guarda, se audita y no
    // sale de la empresa.
    await page.reload()
    await elLapiz(page, tituloActual).click()
    await campo(page, 'Responsable del proceso').selectOption({ label: PANEL_SIN_PERMISO })
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    await expect(confirmacion(page)).toHaveText('Cambios guardados')
    expect(idsDeAvisos(), 'lo interno no despierta a nadie').toHaveLength(avisosAntes)

    const auditorias = auditoriasDe(escenario.publicada)
    expect(auditorias).toHaveLength(auditoriasAntes + 1)
    expect(String(auditorias.at(-1)!.nuevo)).toContain('responsableUsuarioId')
  })

  // ---------- 3. El sueldo, por las dos puertas, sin duplicar ni mandar correo ----------

  test('el sueldo desde la tarjeta avisa solo por la campana; con texto en el mismo guardado, un único aviso', async ({
    page,
  }) => {
    const correosAntes = correosEnviados()
    let antes = idsDeAvisos()

    await abrirElPanel(page)
    await page.goto(`/admin/vacantes/${escenario.publicada}`)
    // El sueldo vive dentro de «Configuración de la vacante», plegada al entrar.
    await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
    await expect(page.getByRole('heading', { name: 'Remuneración' })).toBeVisible({
      timeout: 20_000,
    })

    await campo(page, 'Mínimo mensual').fill('3200')
    await campo(page, 'Por qué cambia').fill('Se ajustó la banda del puesto')
    await page.getByRole('button', { name: 'Guardar la remuneración' }).click()

    // El texto del panel ya no promete un correo que no sale. Se busca dentro de
    // la tarjeta: la pantalla del detalle tiene más de una región viva.
    const dicho = page.getByRole('status').filter({ hasText: 'Guardado:' })
    await expect(dicho).toContainText('Avisamos a 2 candidatos en su portal.')
    await expect(dicho).not.toContainText('correo')

    let nuevos = avisosDe(escenario.publicada).filter((a) => !antes.includes(Number(a.id)))
    expect(nuevos).toHaveLength(2)
    expect(new Set(nuevos.map((a) => String(a.tipo)))).toEqual(
      new Set(['REMUNERACION_ACTUALIZADA']),
    )
    expect(correosEnviados(), 'el cambio de sueldo ya no sale por correo').toBe(correosAntes)

    // Y ahora el sueldo y un campo visible en el MISMO guardado: un solo aviso
    // con las dos cosas dentro, que es lo que evita dos campanas por un cambio.
    antes = idsDeAvisos()
    await page.goto('/admin')
    await elLapiz(page, tituloActual).click()
    await campo(page, 'Ubicación').fill('Lima, San Isidro')
    await campo(page, 'Mínimo mensual').fill('3500')
    await campo(page, 'Por qué cambia el sueldo').fill('Se cierra la banda por arriba')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    await expect(confirmacion(page)).toHaveText(
      'Cambios guardados. Avisamos a 2 postulantes en su portal',
    )

    nuevos = avisosDe(escenario.publicada).filter((a) => !antes.includes(Number(a.id)))
    expect(nuevos, 'un aviso por persona, no uno por campo').toHaveLength(2)
    expect(new Set(nuevos.map((a) => String(a.tipo)))).toEqual(new Set(['VACANTE_ACTUALIZADA']))
    expect(String(nuevos[0]!.cuerpo)).toContain('Ubicación: sin indicar → Lima, San Isidro')
    expect(String(nuevos[0]!.cuerpo)).toContain(
      'Remuneración: S/ 3 200 a 4 000 → S/ 3 500 a 4 000',
    )
    expect(correosEnviados()).toBe(correosAntes)

    // El motivo queda en la auditoría, y nunca en lo que lee el candidato.
    expect(String(auditoriasDe(escenario.publicada).at(-1)!.motivo)).toBe(
      'Se cierra la banda por arriba',
    )
    expect(String(nuevos[0]!.cuerpo)).not.toContain('Se cierra la banda')
  })

  // ---------- 4. El borrador, y lo que se rechaza sin guardar a medias ----------

  test('el borrador se edita sin avisar a nadie', async ({ page }) => {
    await abrirElPanel(page)
    await elLapiz(page, TITULO_BORRADOR).click()
    await campo(page, 'Título que ve quien postula').fill(`${TITULO_BORRADOR} ·  corregido`)
    await campo(page, 'Horario').fill('Por definir')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    // «Cambios guardados» a secas: no hay nadie a quien avisar y no se inventa un cero.
    await expect(confirmacion(page)).toHaveText('Cambios guardados')
    expect(avisosDe(escenario.borrador)).toHaveLength(0)
  })

  test('la publicada no puede esconder el sueldo: la opción dice por qué, y la API lo rechaza sin guardar nada', async ({
    page,
  }) => {
    await abrirElPanel(page)
    await elLapiz(page, tituloActual).click()

    const noPublicarlo = page
      .locator('label', { hasText: 'No publicarlo' })
      .getByRole('radio')
    await expect(noPublicarlo).toBeDisabled()
    await expect(
      page.getByText(/No se puede: esta vacante ya salió publicando lo que paga/),
    ).toBeVisible()

    // El candado de verdad está en el backend: apagar un radio no es una regla.
    const antes = idsDeAvisos().length
    const formulario = await formularioDe(escenario.publicada)
    const rechazo = await pedirAlPanel(`/vacantes/${escenario.publicada}`, {
      metodo: 'PUT',
      cuerpo: {
        ...formulario,
        titulo: 'Título que no debería quedarse',
        remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null },
      },
    })
    expect(rechazo.estado).toBe(409)
    expect(String(vacanteEnBase(escenario.publicada).titulo)).toBe(tituloActual)
    expect(idsDeAvisos()).toHaveLength(antes)
  })

  // Que sin decir por qué cambia el sueldo no salga ni una petición, y que lo
  // escrito se conserve, es del formulario y se fija sin navegador en
  // `EditarVacante.test.tsx` («cambiar el sueldo de una publicada no se manda sin
  // decir por qué»).

  // ---------- 5. Permisos: lo que se esconde y lo que se contesta ----------

  test('sin el permiso no hay lápiz y la API contesta 403; fuera del alcance del rol, 404', async ({
    page,
  }) => {
    const formulario = await formularioDe(escenario.publicada)

    // Ve las vacantes —tiene `ver_vacantes`— y no puede tocarlas.
    await entrarAlPanelComo(page, PANEL_SIN_PERMISO)
    await page.goto('/admin')
    await expect(page.getByText(tituloActual)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^Editar la vacante/ })).toHaveCount(0)

    const sinPermiso = await pedirAlPanel(`/vacantes/${escenario.publicada}`, {
      metodo: 'PUT',
      cuerpo: { ...formulario, titulo: 'No debería poder' },
      token: await tokenDePanelDe(PANEL_SIN_PERMISO),
    })
    expect(sinPermiso.estado).toBe(403)

    // Con el permiso acotado a «sus vacantes», la de otro responsable no existe:
    // 404 y no 403, porque un 403 confirmaría que está ahí.
    await entrarAlPanelComo(page, PANEL_ACOTADO)
    await page.goto('/admin')
    await expect(page.getByText(tituloActual)).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('button', { name: `Editar la vacante ${tituloActual}` }),
    ).toHaveCount(0)

    const fueraDeAlcance = await pedirAlPanel(`/vacantes/${escenario.publicada}`, {
      metodo: 'PUT',
      cuerpo: { ...formulario, titulo: 'Tampoco debería poder' },
      token: await tokenDePanelDe(PANEL_ACOTADO),
    })
    expect(fueraDeAlcance.estado).toBe(404)
    expect(String(vacanteEnBase(escenario.publicada).titulo)).toBe(tituloActual)
  })

  // ---------- 6. El otro lado: la campana del candidato ----------

  test('el aviso lleva al proceso del candidato, y allí está el dato nuevo', async ({ page }) => {
    // Un cambio del título, que es lo que el proceso enseña en su encabezado.
    const nuevo = `${TITULO_PUBLICADA} · turno tarde`
    const formulario = await formularioDe(escenario.publicada)
    const guardado = await pedirAlPanel(`/vacantes/${escenario.publicada}`, {
      metodo: 'PUT',
      cuerpo: { ...formulario, titulo: nuevo },
    })
    expect(guardado.cuerpo).toEqual({ huboCambios: true, postulantesAvisados: 2 })
    tituloActual = nuevo

    const candidato = escenario.enCarrera[0]!
    await entrarAlPortal(page, candidato.correo, CLAVE_DE_CANDIDATO)
    await page.goto('/procesos')

    await page.getByRole('button', { name: /^Avisos/ }).click()
    const aviso = page
      .getByRole('dialog', { name: 'Tus avisos' })
      .getByRole('link', { name: `Se actualizó la vacante «${nuevo}»` })
    await expect(aviso).toBeVisible()
    await aviso.click()

    await expect(page).toHaveURL(new RegExp(`/procesos/${candidato.uuid}$`))
    await expect(page.getByRole('heading', { level: 1, name: nuevo })).toBeVisible()
  })
})

/**
 * Entra al panel y espera a que la lista esté: `entrarAlPanel` solo siembra el
 * token, y sin la espera el primer `click` del lápiz corre contra una tabla que
 * todavía no ha llegado.
 */
async function abrirElPanel(page: Page) {
  await entrarAlPanelComo(page, 'dev-equipo')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText(tituloActual)).toBeVisible({ timeout: 20_000 })
}
