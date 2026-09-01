import { expect, test } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
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
 * La prueba técnica del puesto de punta a punta: una vacante en borrador, su
 * ficha hasta que queda COMPLETA, y el cuestionario que escribe la IA, corregido
 * y publicado.
 *
 * ⚠️ **ESCRIBE**: crea una vacante y le guarda la ficha. Nunca contra producción.
 *
 * ⚠️ **Le pide el cuestionario a la IA de verdad**, y aquí la clave es ficticia:
 * la generación acaba en FALLIDA en segundos y el paso que corrige y publica se
 * salta con ese motivo. Con la clave real cuesta una llamada al modelo y cuenta
 * contra el tope mensual de la empresa.
 */
const recorrido = {
  vacanteId: 0,
  titulo: `Administrador de sedes · e2e ${marcaDeHora()}`,
  fichaEscrita: false,
  quejas: [] as string[],
}

test.describe('La prueba técnica del puesto · la ficha y el cuestionario', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    recorrido.vacanteId = await crearVacanteEnBorrador(recorrido.titulo)
  })

  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    vigilarLaRed(page, recorrido.quejas, {
      fichaEscrita: () => recorrido.fichaEscrita,
      enQue: () => test.info().title,
    })
  })

  test('1 · la vacante enseña en qué va su prueba técnica, y lleva a prepararla', async ({ page }) => {
    await irALaVacante(page, recorrido.vacanteId, recorrido.titulo)
    await expect(page.getByRole('heading', { name: 'Qué responderá quien postule' })).toBeVisible({ timeout: 15_000 })
    // Recién nacida: ni ficha ni cuestionario, y la tarjeta lo dice tal cual.
    await expect(page.getByText(/Ficha: sin empezar · Cuestionario: sin pedir/)).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: /la prueba técnica →/ }).click()
    await expect(page.getByRole('heading', { name: 'La prueba técnica del puesto' })).toBeVisible({ timeout: 15_000 })
  })

  test('2 · la ficha: el riesgo 2 espera al 1, avisa de lo que hay sin guardar, y al guardar queda completa', async ({ page }) => {
    await irAPrepararLaPruebaTecnica(page, recorrido.vacanteId)

    // La vacante es nueva, así que la ficha llega vacía: las dos comprobaciones
    // de abajo solo tienen sentido así.
    await expect(page.getByLabel(/Riesgo 1/)).toHaveValue('')
    // El riesgo 2 se enciende solo cuando el 1 tiene texto.
    await expect(page.getByLabel('Riesgo 2', { exact: true }), 'El riesgo 2 estaba encendido sin riesgo 1').toBeDisabled()

    await escribirLaFicha(page)
    await expect(
      page.getByText('Hay cambios sin guardar.'),
      'Con la ficha escrita y sin guardar no dice «Hay cambios sin guardar»',
    ).toBeVisible()

    // Guardar: el servidor la declara COMPLETA y deriva el tamaño.
    await page.getByRole('button', { name: 'Guardar la ficha' }).click()
    await expect(page.getByText('Guardada.'), 'No se guardó la ficha').toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Completa', { exact: true })).toBeVisible({ timeout: 5_000 })
    recorrido.fichaEscrita = true
    const tamano = page.getByText(/el puesto es/)
    await expect(tamano, 'Con 45 personas el tamaño debía ser MEDIA').toContainText('MEDIA')
  })

  test('3 · los pesos que sugiere el tamaño: tres desenlaces y ninguno es un fallo', async ({ page }) => {
    await irAPrepararLaPruebaTecnica(page, recorrido.vacanteId)

    // Si hay una versión publicada para ese tamaño y no es la de la vacante, se
    // ofrece usarla; si ya rige, no hay botón; y sin versión, tampoco. Los tres
    // son correctos: lo que no puede pasar es que no diga ninguno.
    const usarPesos = page.getByRole('button', { name: 'Usar estos pesos' })
    const yaRigen = page.getByText(/Ya rigen los pesos/)
    const sinVersion = page.getByText(/No hay una versión de pesos publicada para ese tamaño/)
    await expect(usarPesos.or(yaRigen).or(sinVersion).first()).toBeVisible({ timeout: 15_000 })

    if (await usarPesos.isVisible()) {
      await usarPesos.click()
      await expect(yaRigen).toBeVisible({ timeout: 15_000 })
      test.info().annotations.push({ type: 'pesos', description: 'los sugeridos quedaron asignados a la vacante' })
    } else if (await yaRigen.isVisible()) {
      test.info().annotations.push({ type: 'pesos', description: 'los sugeridos ya eran los de la vacante: no hay botón' })
    } else {
      test.info().annotations.push({ type: 'pesos', description: 'sin versión publicada para ese tamaño: no hay botón' })
    }
  })

  test('4 · con la ficha completa se ofrece pedirle el cuestionario a la IA', async ({ page }) => {
    await irAPrepararLaPruebaTecnica(page, recorrido.vacanteId)
    const pedir = page.getByRole('button', { name: 'Pedirle el cuestionario a la IA' })
    const volverAGenerar = page.getByRole('button', { name: 'Volver a generar' })
    await expect(pedir.or(volverAGenerar), 'Con la ficha completa no se ofrece pedir el cuestionario').toBeVisible({
      timeout: 15_000,
    })
  })

  test('5 · de verdad: la IA redacta, el dueño corrige una pregunta y publica', async ({ page }) => {
    test.setTimeout(420_000)
    await irAPrepararLaPruebaTecnica(page, recorrido.vacanteId)

    const desenlace = await pedirElCuestionarioALaIa(page)
    test.skip(desenlace === 'FALLIDA' || desenlace === 'NO_ENCOLADA', porQueNoEscribioLaIa(desenlace))
    expect(desenlace, 'La generación no llegó a un borrador: la página dejó de sondear o el pedido fue rechazado').toBe('LISTA')

    // «Corregir» solo existe con un borrador con preguntas.
    await expect(page.getByRole('button', { name: 'Corregir' }).first()).toBeVisible()
    const cuantas = await page.getByRole('article').count()
    const presenciales = await page.getByText(/no se envía al candidato/).count()
    test.info().annotations.push({ type: 'el REDACTOR', description: `${cuantas} preguntas, ${presenciales} presencial(es)` })

    // Corregir una con las palabras del dueño: viajan los cuatro campos.
    const primera = page.getByRole('article').first()
    await primera.getByRole('button', { name: 'Corregir' }).click()
    const enunciado = primera.getByLabel('Enunciado')
    const original = await enunciado.inputValue()
    await enunciado.fill(`${original} (en soles, por favor)`)
    await primera.getByRole('button', { name: 'Guardar la corrección' }).click()
    await expect(primera.getByText(/\(en soles, por favor\)/)).toBeVisible({ timeout: 15_000 })

    // Publicar: el acto humano. Publicado, ya no se corrige.
    await page.getByRole('button', { name: 'Publicar el cuestionario' }).click()
    await expect(page.getByText('Publicado', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Corregir' }), 'Publicado y sigue ofreciendo corregir').toHaveCount(0)

    // De vuelta en la vacante, la tarjeta lo cuenta.
    await page.getByRole('link', { name: '← Volver a la vacante' }).click()
    await expect(page.getByText(/Cuestionario: publicado/)).toBeVisible({ timeout: 15_000 })
  })

  test('6 · ni la red ni la consola se quejaron en todo el recorrido', () => {
    expect(recorrido.quejas, recorrido.quejas.join('\n')).toEqual([])
  })
})
