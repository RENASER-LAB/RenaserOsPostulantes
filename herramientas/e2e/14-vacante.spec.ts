import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { PERDONADOS_DE_LA_VACANTE, vigilar, type Vigia } from './ayuda-prueba'

/**
 * El recorrido entero de una vacante en el panel, contra el backend de verdad:
 * crearla en borrador —y antes, si no la hay, la solicitud que la respalda—,
 * apagar y encender la evaluación del banco, elegir la prueba del puesto y los
 * pesos, publicarla, verla en la portada del portal y cerrarla.
 *
 * Es el camino que estuvo roto: publicar exige banco del nivel y versión de
 * prueba, y durante un tiempo no había dónde elegirlas.
 *
 * ⚠️ **Este archivo ESCRIBE.** Cada corrida deja una vacante CERRADA —no hay
 * forma de borrarla, y publicada la ve todo el que entre al portal—, su
 * solicitud aprobada y, si no había ninguna aprobada esperando, un puesto. El
 * título lleva la hora para que dos corridas no se pisen.
 *
 * Lo que `01-regresion-panel` ya afirma no se repite aquí: que el listado trae
 * las tres sembradas, que se entra a una y que las pestañas se recorren. De ahí
 * solo se usa lo justo para llegar a la vacante recién creada.
 *
 * Es `serial`: cada prueba es un tramo del mismo recorrido y hereda lo que dejó
 * la anterior; si una cae, las siguientes no tienen sobre qué correr.
 */

const SELLO = new Date().toISOString().slice(11, 19).replace(/:/g, '')
/** Con sello: el código del puesto sale del nombre, y repetirlo chocaría con el de la corrida anterior. */
const PUESTO = `Analista de experiencia e2e ${SELLO}`
const TITULO = `Analista de experiencia · e2e ${SELLO}`

test.describe.serial('El recorrido entero de una vacante', () => {
  let vigia: Vigia
  let idVacante: number | null = null

  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    vigia = vigilar(page, { perdonar404: PERDONADOS_DE_LA_VACANTE })
  })

  // Pasar no basta: que nada haya fallado por debajo mientras tanto.
  test.afterEach(() => {
    expect(vigia.fallos, vigia.fallos.join('\n')).toEqual([])
  })

  async function abrirLaVacante(page: Page) {
    if (idVacante === null) throw new Error('La vacante todavía no se creó: este tramo va después del alta')
    await page.goto(`/admin/vacantes/${idVacante}`)
    await expect(page.getByRole('heading', { name: 'Qué responderá quien postule' })).toBeVisible({ timeout: 15_000 })
  }

  test('nace en borrador, respaldada por una solicitud aprobada (y si no la hay, se escribe aquí mismo)', async ({ page }) => {
    // Cuando hay que escribir la solicitud son veinte campos y dos guardados.
    test.slow()

    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
    await page.getByRole('button', { name: 'Crear vacante' }).click()

    // El formulario no se pinta hasta que `/solicitudes` contesta, y entonces
    // sale UNA de dos cosas: el alta, o el aviso de que no hay solicitud aprobada.
    const tituloDelAlta = page.getByLabel('Título que ve quien postula')
    const escribirUna = page.getByRole('button', { name: 'Escribir una solicitud nueva' })
    await expect(tituloDelAlta.or(escribirUna)).toBeVisible({ timeout: 15_000 })

    const laEscribimos = await escribirUna.isVisible()
    if (laEscribimos) {
      await test.step('No hay solicitud aprobada: el panel lo dice y deja escribir una', async () => {
        await escribirUna.click()
        await expect(page.getByLabel('El resultado principal que se busca')).toBeVisible()
      })

      await test.step('El puesto nace en la solicitud, con su nivel y su familia', async () => {
        await page.getByRole('button', { name: 'Crear un puesto nuevo' }).click()
        await page.getByLabel('Nombre del puesto').fill(PUESTO)
        await page.getByRole('radio', { name: 'Ejecución' }).check()
        await page.getByLabel('Familia del puesto').selectOption({ label: 'Operaciones' })
        await page.getByRole('button', { name: 'Guardar y elegir este puesto' }).click()

        // El puesto creado queda elegido, y con su nivel y familia a la vista.
        const elegido = page.getByLabel('Puesto seleccionado')
        await expect(elegido).toBeVisible({ timeout: 15_000 })
        await expect(elegido).toContainText(PUESTO)
        await expect(elegido).toContainText('Ejecución · Operaciones')
      })

      await test.step('La solicitud de contratación, rellenada y aprobada en el acto', async () => {
        await page.getByLabel('Área que pide').selectOption({ label: 'Crecimiento' })
        await page.getByLabel('Urgencia').selectOption({ index: 0 })
        await page.getByLabel('El resultado principal que se busca').fill(
          'Que quien ya es cliente reciba respuesta el mismo día',
        )
        await page.getByLabel('Por qué hace falta').fill(
          'Las consultas de clientes se acumulan y hoy las atiende quien puede, entre otras tareas.',
        )
        await page.getByLabel('Qué pasa si no se contrata').fill(
          'Seguimos respondiendo tarde y perdiendo clientes que ya nos habían elegido.',
        )
        await page.getByLabel('Por qué el equipo actual no puede asumirlo').fill(
          'El equipo de Crecimiento son dos personas y ya están al límite con la captación.',
        )
        // Tres es el mínimo que acepta el backend.
        const esperados = [
          ['Responder toda consulta el mismo día', 'Horas hasta la primera respuesta'],
          ['Un informe mensual de lo que más se repite', 'Informe entregado cada mes'],
          ['Menos clientes que se van sin avisar', 'Bajas mensuales'],
        ] as const
        for (const [i, [descripcion, indicador]] of esperados.entries()) {
          await page.getByLabel(`Resultado ${i + 1}`, { exact: true }).fill(descripcion)
          await page.getByLabel(`Cómo se medirá ${i + 1}`, { exact: true }).fill(indicador)
        }
        await page.getByRole('button', { name: /Crear la solicitud y aprobarla/ }).click()
        // Aprobada, ya se puede abrir la vacante: el alta aparece sola.
        await expect(tituloDelAlta).toBeVisible({ timeout: 15_000 })
      })
    }

    await test.step('El alta hereda el puesto de la solicitud y no deja escoger otro', async () => {
      // La solicitud recién aprobada si la escribimos; si ya había una
      // esperando, la primera. Y el puesto que se espera ver es el suyo, que
      // viaja en el texto de la opción: «#id · puesto · resultado».
      const solicitudes = page.getByLabel('Solicitud aprobada que la respalda')
      const opciones = solicitudes.locator('option:not([value=""])')
      await expect(opciones.first()).toBeAttached()
      const opcion = laEscribimos ? opciones.filter({ hasText: PUESTO }).first() : opciones.first()
      const valor = await opcion.getAttribute('value')
      const puestoEsperado = ((await opcion.textContent()) ?? '').split(' · ')[1]?.trim() ?? ''
      expect(valor, 'la solicitud aprobada no aparece entre las que respaldan una vacante').toBeTruthy()
      await solicitudes.selectOption(valor as string)

      const heredado = page.getByLabel('Puesto seleccionado')
      await expect(heredado).toBeVisible({ timeout: 10_000 })
      await expect(heredado, 'la vacante no enseña el puesto heredado de la solicitud').toContainText(puestoEsperado)
      if (laEscribimos) await expect(heredado).toContainText('Ejecución · Operaciones')
      // El puesto manda —su nivel decide qué evaluación vale— y por eso ya no se elige aquí.
      await expect(page.getByLabel('Puesto del catálogo'), 'la vacante moderna todavía deja escoger otro puesto').toHaveCount(0)
    })

    await test.step(`Rellenar el alta · «${TITULO}» y crearla en borrador`, async () => {
      await page.getByLabel('Responsable del proceso').selectOption({ index: 1 })
      await tituloDelAlta.fill(TITULO)
      await page.getByLabel('Descripción').fill(
        'Acompañas a quien ya es cliente: resuelves sus dudas, detectas lo que se repite y lo llevas al equipo que puede arreglarlo.',
      )
      await page.getByLabel('Modalidad (Presencial, Híbrido…)').fill('Híbrido')
      await page.getByLabel('Horario').fill('Lunes a viernes, 9:00 a 18:00')
      await page.getByLabel('Ubicación').fill('San Isidro, Lima')
      await page.getByRole('button', { name: /Crear en borrador/ }).click()

      // Creada: está en la lista. Si en vez de eso la pantalla se queja, que se lea la queja.
      const enLaLista = page.getByRole('cell', { name: TITULO, exact: true })
      const queja = page.getByRole('alert')
      await expect(enLaLista.or(queja).first()).toBeVisible({ timeout: 15_000 })
      if (await queja.count()) {
        throw new Error(`No se creó la vacante. La pantalla dice: ${(await queja.allTextContents()).join(' · ')}`)
      }
      await expect(enLaLista).toBeVisible()
    })
  })

  test('recién creada, publicar está apagado y dice qué falta', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('row').filter({ hasText: TITULO }).getByRole('link', { name: /Ver postulantes/ }).click()
    await expect(page).toHaveURL(/\/admin\/vacantes\/\d+$/)
    idVacante = Number(page.url().match(/\/admin\/vacantes\/(\d+)$/)![1])
    await expect(page.getByRole('heading', { name: 'Qué responderá quien postule' })).toBeVisible({ timeout: 15_000 })

    // Lo que el backend exige antes de publicar: el botón lo espera, y dice qué falta.
    const publicar = page.getByRole('button', { name: /Publicar en el portal/ })
    await expect(publicar, 'el botón de publicar no espera a que se elija la prueba').toBeDisabled()
    await expect(page.getByText(/Antes hay que elegir/)).toBeVisible()
  })

  /**
   * Se prueba este ajuste y no los otros porque es el único que cambia lo que se
   * pide. La casilla la manda el servidor, no el navegador: no se marca sola al
   * pulsarla, cambia cuando el backend lo confirma. Por eso se espera al texto.
   *
   * ⚠️ Nombrada, no `getByRole('checkbox')` a secas: el ranking por etapas trajo
   * a esta misma pantalla la casilla «Ver la tanda entera» —y una por fila del
   * ranking—, así que el selector anónimo se rompe por ambigüedad.
   */
  test('el interruptor del banco se apaga y se vuelve a encender, y lo confirma el servidor', async ({ page }) => {
    await abrirLaVacante(page)
    const interruptor = page.getByRole('checkbox', { name: /La evaluación del banco/ })

    await interruptor.click()
    await expect(page.getByText(/Apagada: la prueba del puesto/)).toBeVisible({ timeout: 15_000 })
    await expect(interruptor).not.toBeChecked()

    await interruptor.click()
    await expect(page.getByText(/Encendida: responderá el cuestionario/)).toBeVisible({ timeout: 15_000 })
    await expect(interruptor).toBeChecked()
  })

  /**
   * Aquí había un `selectOption` sobre «Qué evaluación responderá». Ese
   * desplegable ya no existe: la plantilla tenía una sola respuesta legal —una
   * publicada por nivel— y desde que se retiraron las cuotas tampoco decide qué
   * preguntas caen. Ahora es una línea que nombra el banco del nivel.
   */
  test('el banco del nivel se dice, no se pregunta', async ({ page }) => {
    await abrirLaVacante(page)
    const etiqueta = page.getByText(/^Qué evaluación responderá/)
    await expect(etiqueta).toBeVisible()
    const linea = etiqueta.locator('..')
    // Nombra el banco y de dónde sale su duración; no ofrece elegir.
    await expect(linea).toContainText('Lo fija el nivel del puesto', { timeout: 15_000 })
    await expect(linea.locator('select')).toHaveCount(0)
    console.log(`[VACANTE] ${((await linea.innerText()).replace(/\n/g, ' · '))}`)
  })

  test('se eligen la prueba del puesto y los pesos, y el servidor los deja puestos', async ({ page }) => {
    await abrirLaVacante(page)

    await test.step('La prueba del puesto', async () => {
      const selPrueba = page.getByLabel('Qué prueba del puesto rendirá')
      // Un <option> nunca es «visible»: se espera a que haya alguno, no a verlo.
      await expect
        .poll(() => selPrueba.locator('option').count(), {
          timeout: 30_000,
          message: 'el desplegable de la prueba del puesto no ofrece ninguna versión publicada',
        })
        .toBeGreaterThan(1)
      const ofrecidas = await selPrueba.locator('option:not([value=""])').allTextContents()
      console.log(`[VACANTE] pruebas ofrecidas: ${ofrecidas.join(' | ')}`)
      await selPrueba.selectOption({ index: 1 })
      await expect(selPrueba).not.toHaveValue('', { timeout: 15_000 })
    })

    await test.step('Los pesos que rigen la decisión', async () => {
      const selPesos = page.getByLabel('Qué pesos rigen la decisión')
      const publicadas = selPesos.locator('option:not([value=""])')
      await expect
        .poll(() => publicadas.count(), { message: 'no hay ninguna versión de pesos publicada que elegir' })
        .toBeGreaterThan(0)
      console.log(`[VACANTE] pesos ofrecidos: ${await publicadas.count()}`)
      const elegida = (await publicadas.first().getAttribute('value')) as string
      await selPesos.selectOption(elegida)
      await expect(selPesos).toHaveValue(elegida, { timeout: 15_000 })
    })
  })

  test('ahora sí: se publica, y ya la ve quien postula', async ({ page }) => {
    await abrirLaVacante(page)
    await expect(page.getByText('Todo listo: ya se puede publicar.')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Publicar en el portal/ }).click()
    await expect(page.getByText(/Publicada el/)).toBeVisible({ timeout: 15_000 })

    // Y comprobarlo desde el lado del candidato: la portada del portal.
    await page.goto('/')
    await expect(page.getByText(TITULO).first()).toBeVisible({ timeout: 15_000 })
  })

  /**
   * Recoger. Una vacante publicada la ve todo el que entre al portal, y no hay
   * forma de borrarla: lo más cerca que se puede dejar es cerrada.
   */
  test('se cierra: el e2e no deja vacantes sueltas en el portal', async ({ page }) => {
    await abrirLaVacante(page)
    await page.getByPlaceholder('Motivo del cierre').fill('Limpieza: la dejó el e2e')
    await page.getByRole('button', { name: 'Cerrar vacante' }).click()
    await expect(page.getByText(/^Cerrada/)).toBeVisible({ timeout: 15_000 })
  })
})
