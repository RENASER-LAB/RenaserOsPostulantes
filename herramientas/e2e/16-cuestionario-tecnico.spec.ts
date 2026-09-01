import { expect, test } from '@playwright/test'
import { API, corte, entrarAlPanel, entrarAlPortal, filasDelRanking, pestana } from './ayuda'
import {
  crearVacanteEnBorrador,
  escribirLaFicha,
  irALaVacante,
  irAPrepararLaPruebaTecnica,
  marcaDeHora,
  pedirElCuestionarioALaIa,
  porQueNoEscribioLaIa,
  vigilarLaRed,
} from './ayuda-tecnica'

/**
 * El ciclo 2 de la prueba técnica, de punta a punta: la empresa elige el
 * cuestionario, lo prepara con la IA y publica la vacante; una candidata postula,
 * lo contesta y lo entrega; y la empresa lee lo que escribió y le pone nota.
 *
 * ⚠️ **ESCRIBE**: crea una vacante, una cuenta y una postulación en la base a la
 * que apunte el backend. Nunca contra producción.
 *
 * ⚠️ **Depende DOS VECES de la IA de verdad** —el REDACTOR que escribe el
 * cuestionario y el EVALUADOR_TECNICO que lo califica— y aquí la clave es
 * ficticia: la generación se pide de verdad y acaba en FALLIDA en segundos. Todo
 * lo que viene después de ese punto se salta con ese motivo, y por eso los
 * pasos van en serie compartiendo lo que ya se consiguió.
 *
 * El corte de salida del ranking es «con nota de esta etapa», y quien acaba de
 * postular no tiene ninguna: la fila existe y no se ve. Hay que pedir «Está aquí
 * ahora» antes de buscar a nadie.
 */
const CLAVE = 'Demo12345!'

const recorrido = {
  vacanteId: 0,
  titulo: `Administrador de sedes · e2e ${marcaDeHora()}`,
  correo: `candidata.e2e.${Date.now()}@example.com`,
  fichaEscrita: false,
  cuestionarioPublicado: false,
  vacantePublicada: false,
  postulo: false,
  enLaPrueba: false,
  entrego: false,
  /** Lo que la red y la consola dijeron en cada paso. Se juzga al final. */
  quejas: [] as string[],
}

test.describe('El ciclo 2 · la vacante elige el cuestionario y la candidata lo rinde', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    recorrido.vacanteId = await crearVacanteEnBorrador(recorrido.titulo)
  })

  test.beforeEach(async ({ page }) => {
    vigilarLaRed(page, recorrido.quejas, {
      fichaEscrita: () => recorrido.fichaEscrita,
      enQue: () => test.info().title,
    })
  })

  // ============================================================
  // La empresa elige qué se rinde
  // ============================================================

  test('1 · nace en borrador rindiendo la prueba del puesto, y se ofrece elegir cuál', async ({ page }) => {
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)
    await expect(page.getByText('En borrador: todavía no aparece en el portal')).toBeVisible()

    // Por defecto rinde la prueba del puesto: es lo que hacían todas las vacantes.
    await expect(page.getByLabel('Qué rendirá en la etapa técnica')).toHaveValue('PLANTILLA')
    await expect(page.getByLabel('Qué prueba del puesto rendirá')).toBeVisible()
  })

  test('2 · elegido el cuestionario técnico, lo de la prueba del puesto desaparece', async ({ page }) => {
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)

    await page.getByLabel('Qué rendirá en la etapa técnica').selectOption('CUESTIONARIO_TECNICO')
    await expect(page.getByText(/aquí no se entrega ningún archivo/i)).toBeVisible({ timeout: 15_000 })
    // Son excluyentes: con el cuestionario elegido no se ofrece decir qué prueba.
    await expect(page.getByLabel('Qué prueba del puesto rendirá')).toHaveCount(0)
  })

  test('3 · cuarenta y cinco minutos para la etapa, guardados a mano', async ({ page }) => {
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)

    const fila = page.locator('label').filter({ hasText: 'Cuánto tiempo tendrá' })
    const minutos = fila.locator('input[type="number"]')
    await minutos.fill('45')
    await fila.getByRole('button', { name: 'Guardar' }).click()
    // El botón solo existe mientras lo escrito difiere de lo guardado: que se vaya
    // es la señal de que el servidor contestó con 45.
    await expect(fila.getByRole('button', { name: 'Guardar' })).toHaveCount(0)
    await expect(minutos).toHaveValue('45')
    // Y sobrevive a recargar: está en la base, no en la pantalla.
    await page.reload()
    await expect(page.locator('label').filter({ hasText: 'Cuánto tiempo tendrá' }).locator('input[type="number"]')).toHaveValue('45')
  })

  test('4 · la evaluación del banco se apaga: aquí se juega todo en el cuestionario', async ({ page }) => {
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)

    const banco = page.locator('label').filter({ hasText: 'La evaluación del banco' })
    const interruptor = banco.locator('input[type="checkbox"]')
    // ⚠️ Es un interruptor mandado por el servidor: la marca no cambia al pulsar,
    // cambia cuando la respuesta vuelve. `uncheck()` se queja de eso; se pulsa y
    // se espera al texto.
    if (await interruptor.isChecked()) await interruptor.click()
    await expect(page.getByText(/Apagada: la prueba del puesto será su única evaluación/)).toBeVisible({
      timeout: 20_000,
    })
  })

  test('5 · publicar está apagado, y dice que lo que falta es el cuestionario', async ({ page }) => {
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)

    await expect(page.getByRole('button', { name: /Publicar en el portal/ })).toBeDisabled()
    await expect(page.getByText(/publicar su cuestionario técnico/i)).toBeVisible()
  })

  // ============================================================
  // Preparar la prueba técnica
  // ============================================================

  test('6 · la ficha, con las palabras del dueño, queda completa', async ({ page }) => {
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)
    await page.getByRole('link', { name: /la prueba técnica →/ }).click()
    await expect(page.getByRole('heading', { name: 'La prueba técnica del puesto' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('form', { name: 'La ficha del puesto' })).toBeVisible({ timeout: 15_000 })

    await escribirLaFicha(page)
    await page.getByRole('button', { name: 'Guardar la ficha' }).click()
    await expect(page.getByText('Completa', { exact: true }), 'La ficha no quedó completa').toBeVisible({
      timeout: 20_000,
    })
    // A partir de aquí la ficha existe: un 404 suyo ya no se perdona.
    recorrido.fichaEscrita = true

    const usarPesos = page.getByRole('button', { name: 'Usar estos pesos' })
    if (await usarPesos.isVisible().catch(() => false)) {
      await usarPesos.click()
      await expect(page.getByText(/Ya rigen los pesos/)).toBeVisible({ timeout: 15_000 })
    }
  })

  // ============================================================
  // La IA escribe el cuestionario  ·  PRIMERA LLAMADA DE VERDAD
  // ============================================================

  test('7 · la IA escribe el cuestionario y el dueño lo publica', async ({ page }) => {
    test.setTimeout(420_000)
    await entrarAlPanel(page)
    await irAPrepararLaPruebaTecnica(page, recorrido.vacanteId)

    const desenlace = await pedirElCuestionarioALaIa(page)
    test.skip(desenlace === 'FALLIDA' || desenlace === 'NO_ENCOLADA', porQueNoEscribioLaIa(desenlace))
    expect(desenlace, 'La generación no llegó a un borrador: la página dejó de sondear o el pedido fue rechazado').toBe('LISTA')

    const cuantas = await page.getByRole('article').count()
    const presenciales = await page.getByText(/no se envía al candidato/i).count()
    test.info().annotations.push({
      type: 'el REDACTOR',
      description: `${cuantas} preguntas, ${presenciales} presencial(es)`,
    })
    expect(cuantas, 'El borrador llegó sin una sola pregunta').toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Publicar el cuestionario' }).click()
    await expect(page.getByText('Publicado', { exact: true })).toBeVisible({ timeout: 30_000 })
    recorrido.cuestionarioPublicado = true
  })

  // ============================================================
  // Publicar la vacante
  // ============================================================

  test('8 · con el cuestionario publicado, la vacante dice que está lista y se publica', async ({ page }) => {
    test.skip(!recorrido.cuestionarioPublicado, 'Sin cuestionario publicado no hay vacante que publicar: la IA no lo escribió.')
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)

    await expect(page.getByText(/Cuestionario: publicado/)).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText('Todo listo: ya se puede publicar.'),
      'Con el cuestionario publicado, la vacante no dice que ya se puede publicar',
    ).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Publicar en el portal/ }).click()
    await expect(page.getByText(/Publicada el/)).toBeVisible({ timeout: 20_000 })
    recorrido.vacantePublicada = true
  })

  // ============================================================
  // La candidata postula
  // ============================================================

  test('9 · una candidata crea su cuenta y postula a la vacante', async ({ page }) => {
    test.skip(!recorrido.vacantePublicada, 'La vacante no llegó a publicarse: no hay a qué postular.')

    const publicadas = (await (await fetch(`${API}/portal/vacantes`)).json()) as { id: number; titulo: string }[]
    const laVacante = publicadas.find((v) => v.titulo === recorrido.titulo)
    expect(laVacante, 'La vacante publicada no sale en el tablón del portal').toBeTruthy()

    await page.goto(`/registro?vacante=${laVacante!.id}`)
    await page.getByLabel('Nombre', { exact: true }).fill('Camila')
    await page.getByLabel('Apellidos', { exact: true }).fill('Reyes Quispe')
    await page.getByLabel('Correo', { exact: true }).fill(recorrido.correo)
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
    await page.getByLabel('Repite la contraseña').fill(CLAVE)
    // El alta exige ciudad desde que existe el filtro por ciudad del ranking.
    await page.getByLabel('Dónde vives').selectOption('1501') // Lima — Lima
    await page.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /crear cuenta/i }).click()
    await page.waitForURL(/\/vacantes\/\d+\/postular/, { timeout: 25_000 })

    await page.locator('input[type="file"]').waitFor({ timeout: 20_000 })
    await page.setInputFiles('input[type="file"]', {
      name: 'curriculum.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 curriculum de Camila Reyes, cajera y administradora'),
    })
    await page
      .getByLabel('Cuéntalo con tus palabras')
      .fill('Cuadré tres cajas que llevaban meses sin cuadrar y encontré el faltante de marzo: eran vueltos mal dados en la sede norte.')
    // Los requisitos son preguntas de sí o no: se contesta que sí a todos.
    for (const si of await page.getByRole('radio', { name: 'Sí' }).all()) await si.check()
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /enviar mi postulación/i }).click()
    const deTodosModos = page.getByRole('button', { name: /enviarla de todos modos/i })
    if (await deTodosModos.isVisible().catch(() => false)) await deTodosModos.click()
    await page.waitForURL(/\/procesos$/, { timeout: 30_000 })
    recorrido.postulo = true
  })

  // ============================================================
  // El equipo la hace avanzar hasta la prueba
  // ============================================================

  test('10 · el equipo la hace avanzar hasta que le toca la etapa técnica', async ({ page }) => {
    test.skip(!recorrido.postulo, 'Nadie postuló: no hay a quién avanzar.')
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)

    const camila = () => filasDelRanking(page).filter({ hasText: 'Camila' })
    /*
     * Avanzar es marcar, escribir un motivo y confirmar.
     *
     * ⚠️ **Cuántos saltos faltan no se sabe de antemano, y por eso no se cuentan.**
     * Al postular, la máquina ya la puso en el perfil integral y el currículum la
     * movió sola hasta «por confirmar»: de los cuatro momentos, tres ya habían
     * pasado sin que nadie pulsara nada. Se avanza mientras siga apareciendo en el
     * perfil integral, y se para cuando se va.
     */
    const avanzarUnPaso = async (motivo: string) => {
      await camila().first().locator('input[type="checkbox"]').check()
      await page.getByPlaceholder('Motivo del avance (obligatorio)').fill(motivo)
      await page.getByRole('button', { name: /^Avanzar a 1 persona$/ }).click()
      await expect(page.locator('[role="status"]').filter({ hasText: /Avanzaron: Camila/ })).toBeVisible({
        timeout: 30_000,
      })
    }

    await pestana(page, 'Perfil integral').click()
    await corte(page, 'Está aquí ahora').click()
    let saltos = 0
    while ((await camila().count()) > 0 && saltos < 5) {
      await avanzarUnPaso('lo del currículum está visto, que rinda la prueba técnica')
      saltos++
      await corte(page, 'Está aquí ahora').click()
    }
    test.info().annotations.push({ type: 'saltos', description: `le faltaban ${saltos} para la etapa técnica` })
    expect(saltos, 'No hizo falta avanzarla: llegó sola a la etapa técnica sin que nadie la moviera').toBeGreaterThan(0)

    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Está aquí ahora').click()
    await expect(camila(), 'Tras avanzarla no aparece en la etapa de la prueba').toHaveCount(1)
    recorrido.enLaPrueba = true
  })

  // ============================================================
  // La candidata rinde el cuestionario
  // ============================================================

  test('11 · la candidata ve que le toca su prueba técnica, la rinde y la entrega', async ({ page }) => {
    test.skip(!recorrido.enLaPrueba, 'La candidata no llegó a la etapa técnica: no hay prueba que rendir.')
    test.setTimeout(240_000)
    await entrarAlPortal(page, recorrido.correo, CLAVE)
    await page.goto('/procesos')

    /*
     * ⚠️ Que la dirección cambie NO es que la pantalla esté pintada: las
     * postulaciones siguen viajando. Se espera a la acción, que es además lo que
     * prueba que el portal distingue el instrumento — la prueba de siempre no la
     * ofrece.
     */
    await expect(
      page.getByRole('link', { name: 'Abrir prueba técnica' }).first(),
      '«Mis procesos» no ofrece abrir la prueba técnica: no distingue el instrumento',
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText(/Tu prueba técnica está lista/).first(),
      'El recorrido no nombra la prueba técnica: estaría prometiendo la prueba de siempre',
    ).toBeVisible()

    await page.getByRole('link', { name: 'Abrir prueba técnica' }).first().click()
    await expect(page.getByRole('heading', { name: 'Tu prueba técnica' })).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText(/no hay que subir ningún archivo/i),
      'La pantalla no dice que aquí no se sube nada: es la diferencia con la prueba del puesto',
    ).toBeVisible()
    await expect(page.getByText(/45 minutos/), 'No promete los 45 minutos que la vacante fijó').toBeVisible()

    await page.getByRole('button', { name: 'Empezar la prueba' }).click()
    await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toBeVisible({ timeout: 20_000 })
    const cuantasRinde = Number(
      (await page.getByText(/Pregunta \d+ de \d+/).first().textContent())?.match(/de (\d+)/)?.[1] ?? 0,
    )
    expect(cuantasRinde, 'El examen abrió sin preguntas').toBeGreaterThan(0)

    const LO_QUE_RESPONDE = [
      'En la sede norte llevaba las tres cajas del turno tarde: cerraba con arqueo diario y el descuadre no pasaba de dos soles al mes.',
      'Lo primero que miro es el arqueo de la noche anterior contra el sistema. Si hay diferencia, reviso los vueltos y las anulaciones antes de abrir.',
      'Una vez el faltante era de trescientos soles en tres días. Salió de un cajero que daba vuelto de más por apuro; lo vi cruzando tickets con el corte de caja.',
      'Manejo Excel con tablas dinámicas y buscarv. Armé un cuadre que compara el corte del sistema con lo contado a mano y marca la diferencia en rojo.',
      'A doce personas no se las controla mirándolas: se les pone un cierre con firma y se revisa el mismo día. Lo que no se revisa el mismo día ya no se recupera.',
      'Sí, he trabajado sábados y domingos de campaña. Cuando falta plata me quedo hasta que aparece, porque al día siguiente ya nadie se acuerda.',
      'A un jefe de números le llevo el detalle antes de que lo pida: el corte, la diferencia y de dónde salió. No me molesta que me pregunten por qué.',
      'De tres sedes lo difícil es que cierren el mismo día. Yo pondría el mismo formato de arqueo en las tres y una hora fija de cierre.',
      'Si un cajero falta sin avisar, cubro yo la caja ese turno y el reemplazo queda armado antes del siguiente. Y se habla, porque la segunda vez ya no es un olvido.',
      'Un descuento sobre cien soles no lo autorizo yo: lo consulto. Por debajo lo apruebo y queda anotado con el motivo y mi firma.',
      'Un proveedor pagado dos veces se detecta cruzando la factura con el registro antes de pagar. Es un minuto por factura y evita el problema entero.',
      'En un año quiero que las tres sedes cierren sin faltantes sin explicar, con el mismo formato de arqueo y el informe mensual saliendo solo.',
    ]
    for (let i = 0; i < cuantasRinde; i++) {
      await page.getByRole('textbox', { name: 'Tu respuesta' }).fill(LO_QUE_RESPONDE[i % LO_QUE_RESPONDE.length]!)
      /*
       * ⚠️ Esperar a que aparezca «guardada» NO comprueba nada por sí solo: la
       * pregunta anterior ya lo decía. Lo que importa es que ESTA respuesta la
       * confirme el servidor antes de pasar a la siguiente, que es la regla que
       * costó respuestas perdidas en la evaluación del banco.
       */
      await expect(
        page.getByText(/Guardada\. Puedes seguir corrigiéndola/),
        `La respuesta ${i + 1} nunca se dio por guardada`,
      ).toBeVisible({ timeout: 25_000 })
      if (i < cuantasRinde - 1) await page.getByRole('button', { name: 'Siguiente →' }).click()
    }

    const entregar = page.getByRole('button', { name: 'Entregar' })
    await expect(entregar, 'Con todo respondido sigue sin dejar entregar').toBeEnabled()
    await entregar.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Sí, entregar' }).click()
    /*
     * ⚠️ Entregar **saca de la pantalla del examen** y lleva al detalle del
     * proceso: esperar allí el «ya entregaste» es esperar una pantalla que la
     * entrega acaba de dejar atrás.
     */
    await expect(page.getByText(/Estamos calificando tu prueba/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('textbox'), 'Después de entregar todavía se puede escribir').toHaveCount(0)
    await expect(
      page.getByText(/Entregaste tu prueba/),
      'La entrega no quedó anotada en el recorrido de la candidata',
    ).toBeVisible()
    recorrido.entrego = true
  })

  // ============================================================
  // La empresa lee lo que escribió y le pone nota  ·  SEGUNDA LLAMADA DE VERDAD
  // ============================================================

  test('12 · el equipo lee lo que escribió, y la nota de la etapa llega al ranking', async ({ page }) => {
    test.skip(!recorrido.entrego, 'No hay entrega que leer: la candidata no rindió.')
    test.setTimeout(240_000)
    await entrarAlPanel(page)
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Está aquí ahora').click()

    await filasDelRanking(page).filter({ hasText: 'Camila' }).first().click()
    await expect(page.getByText('Lo que escribió en la prueba')).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText(/sede norte/).first(),
      'El panel no enseña lo que la candidata escribió en el cuestionario',
    ).toBeVisible({ timeout: 15_000 })

    /*
     * Calificar encola un trabajo del agente que tarda decenas de segundos.
     *
     * ⚠️ **«Está calificando» es un cartel de paso, y esperarlo es una carrera
     * perdida**: el agente puede terminar antes de que el sondeo llegue a pintarlo.
     * Lo que se espera es el final —la nota en la fila—, no la señal de que empezó.
     */
    const pedirCalificacion = page.getByRole('button', { name: 'Pedirle a la IA que califique la prueba' })
    if (await pedirCalificacion.isVisible().catch(() => false)) await pedirCalificacion.click()

    /*
     * ⚠️ **Aquí NO hay botón de ponderar, y es correcto que no lo haya.** Con la
     * prueba del puesto la nota de la etapa nace de ponderar la rúbrica a mano;
     * con el cuestionario la calcula el propio método —índice = puntos ÷ (4 ×
     * preguntas) × 100— y llega hecha. Lo que hay que comprobar es que la nota
     * **exista y se vea**, que es lo que el equipo mira.
     */
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Toda la tanda').click()
    const laFila = filasDelRanking(page).filter({ hasText: 'Camila' }).first()
    await expect(laFila).toBeVisible({ timeout: 20_000 })
    await expect(
      laFila,
      'La columna de la nota sigue con un guion: la calificación no llegó al ranking',
    ).not.toHaveText(/—\s*(Le toca|Calificándose|Ya la hizo)/, { timeout: 180_000 })
  })

  test('13 · ni la red ni la consola se quejaron en todo el recorrido', () => {
    expect(recorrido.quejas, recorrido.quejas.join('\n')).toEqual([])
  })
})
