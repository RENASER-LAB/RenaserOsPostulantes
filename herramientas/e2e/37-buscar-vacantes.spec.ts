import { expect, type Locator, type Page } from '@playwright/test'

import { entrarAlPortal } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato, test } from './ayuda-candidato'
import {
  COMO_PRODUCCION,
  devolverLasEscondidas,
  esconderLasDemas,
  MARCA,
  ORDEN_POR_COMPLETITUD,
  ORDEN_POR_FECHA,
  ponerCiudad,
  retirarLoSembrado,
  sembrar,
} from './ayuda-buscar-vacantes'
import { limpiarSiempre, literal, sql } from './base-de-datos'

/**
 * Buscar vacantes en el portal (spec `buscar-vacantes.md`), como visitante sin
 * sesión: la lista, la búsqueda, los filtros, el orden, la dirección, la vuelta
 * desde la ficha, la portada y su cinta, y la cabecera.
 *
 * Con las decisiones del usuario del ciclo 2 (25/09/2026), que sustituyen a la
 * spec donde chocan: «Ordenar por» siempre a la vista con «Relevantes» marcado
 * —sin texto, las más completas primero—, ciudad, modalidad y fecha siempre con
 * sus cantidades, columna de filtros a la izquierda y tarjetas a lo ancho. Y
 * la del 25/09/2026 tras el ciclo 2: las etiquetas activas, encima de la lista.
 *
 * ⚠️ **ESCRIBE, y por eso siembra su propio terreno.** Las nueve «como
 * producción» de la spec, con Lima y Arequipa puestas, y aparte los juegos de
 * fechas. Las publicadas que ya había se esconden mientras corre y se devuelven
 * al final: los criterios cuentan, y una ajena cambia cada cifra. Ver
 * `ayuda-buscar-vacantes`.
 */

const buscador = (page: Page) => page.getByRole('searchbox', { name: 'Buscar vacantes' })
const lista = (page: Page) => page.getByRole('list', { name: 'Vacantes', exact: true })
const tarjetas = (page: Page) => lista(page).getByRole('listitem')
const titulos = (page: Page) => tarjetas(page).getByRole('heading', { level: 3 }).allTextContents()
const orden = (page: Page) => page.getByRole('radiogroup', { name: 'Ordenar por' })
const enCabecera = (page: Page, nombre: string) =>
  page.locator('header nav').getByRole('link', { name: nombre, exact: true })
const etiqueta = (page: Page, nombre: string) =>
  page.getByRole('button', { name: `Quitar filtro ${nombre}`, exact: true })
/**
 * El contador visible, sin la región aria-live que repite el mismo texto para el
 * lector de pantalla. Empieza por la cuenta; detrás puede ir lo que la sitúa
 * («para «…»», «en Lima»).
 */
const contador = (page: Page, texto: string) =>
  page.locator('p:not([aria-live])').filter({ hasText: new RegExp(`^${texto}(\\s|$)`) })

/**
 * Marca una casilla de filtro. No `check()`: la casilla es controlada por la
 * dirección y el router la escribe en una transición, así que el estado
 * cambia un instante después del clic y `check()` lo lee antes.
 */
async function marcar(casilla: Locator) {
  await casilla.click()
  await expect(casilla).toBeChecked()
}

async function abrirLaLista(page: Page, direccion = '/vacantes') {
  await page.goto(direccion)
  await expect(page.getByRole('heading', { level: 1, name: 'Vacantes abiertas' })).toBeVisible()
}

test.describe('Buscar vacantes · las nueve como producción', () => {
  test.beforeAll(() => {
    retirarLoSembrado()
    esconderLasDemas()
    sembrar(COMO_PRODUCCION)
  })

  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(), () => devolverLasEscondidas()]))

  // ---------- AC-01 (ciclo 2: el orden siempre a la vista) ----------
  test('AC-01 · sin sesión ve las 9 con «Relevantes» marcado —las más completas primero—, el contador, y «Recientes» las pone por fecha', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await expect(tarjetas(page)).toHaveCount(9)
    expect(await titulos(page)).toEqual(ORDEN_POR_COMPLETITUD)
    await expect(contador(page, '9 vacantes abiertas')).toBeVisible()
    await expect(orden(page)).toBeVisible()
    await expect(orden(page).getByRole('radio', { name: 'Relevantes' })).toBeChecked()
    await expect(page.getByText('Más recientes primero')).toHaveCount(0)
    await expect(page).toHaveURL(/\/vacantes$/)

    // Sin texto, «Recientes» también ordena, y viaja en la dirección.
    await page.getByText('Recientes', { exact: true }).click()
    await expect(orden(page).getByRole('radio', { name: 'Recientes' })).toBeChecked()
    await expect(page).toHaveURL(/\/vacantes\?orden=recientes$/)
    expect(await titulos(page)).toEqual(ORDEN_POR_FECHA)
    await page.getByText('Relevantes', { exact: true }).click()
    await expect(page).toHaveURL(/\/vacantes$/)
    expect(await titulos(page)).toEqual(ORDEN_POR_COMPLETITUD)
    // AC-32: el título de la pestaña.
    await expect(page).toHaveTitle('Vacantes abiertas · EX')
  })

  // ---------- AC-02 y AC-03 ----------
  test('AC-02 · «GESTION» deja solo la de Gestión del Talento y el contador dice «1 de 9 vacantes»', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await buscador(page).fill('GESTION')
    await expect(tarjetas(page)).toHaveCount(1)
    expect(await titulos(page)).toEqual(['Especialista en Gestión del Talento'])
    await expect(page.getByText('1 de 9 vacantes', { exact: true })).toBeVisible()
    await expect(contador(page, '1 de 9 vacantes')).toHaveText('1 de 9 vacantes para «GESTION»')
    // Con texto el conmutador sigue ahí, y viene marcado «Relevantes».
    await expect(orden(page)).toBeVisible()
    await expect(orden(page).getByRole('radio', { name: 'Relevantes' })).toBeChecked()
    await expect(page).toHaveURL(/\/vacantes\?q=GESTION$/)
  })

  test('AC-03 · «ingeniero» trae las 2 con «ingeniero» en el título y no las que solo lo citan', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await buscador(page).fill('ingeniero')
    await expect(tarjetas(page)).toHaveCount(2)
    expect((await titulos(page)).sort()).toEqual(
      ['Ingeniero Civil Builder Junior', 'Ingeniero/a de Infraestructura'].sort(),
    )
    await expect(page.getByText('2 de 9 vacantes', { exact: true })).toBeVisible()
  })

  // ---------- AC-04 ----------
  test('AC-04 · sin coincidencias se lee «Ninguna vacante coincide» y «Ver las 9 vacantes» limpia el buscador', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await buscador(page).fill('notario')
    await expect(page.getByText(/^Ninguna vacante coincide con «notario»\.?$/)).toBeVisible()
    await expect(page.getByText('Hay 9 vacantes abiertas.')).toBeVisible()
    await expect(tarjetas(page)).toHaveCount(0)
    // Nunca el mensaje de «no hay vacantes».
    await expect(page.getByText('Ahora mismo no hay vacantes abiertas.')).toHaveCount(0)
    // El texto sigue en el buscador para corregirlo.
    await expect(buscador(page)).toHaveValue('notario')

    await page.getByRole('button', { name: 'Ver las 9 vacantes' }).click()
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(buscador(page)).toHaveValue('')
    await expect(buscador(page)).toBeFocused()
    await expect(page).toHaveURL(/\/vacantes$/)
  })

  // ---------- AC-06 y AC-07 (ciclo 2: modalidad siempre a la vista) ----------
  test('AC-06/07 · «Presencial» y «PRESENCIAL» son una sola forma, y modalidad sale aunque solo haya una escrita', async ({
    page,
  }) => {
    await abrirLaLista(page)
    // Las dos de Lima se guardaron «PRESENCIAL» y las tarjetas lo escriben «Presencial», en su fila.
    const administrador = page.getByRole('link', { name: 'Administrador', exact: true })
    await expect(administrador).toContainText('Presencial')
    await expect(administrador).toContainText('Lima')
    await expect(administrador).not.toContainText('PRESENCIAL')
    const soloPresencial = page.getByRole('group', { name: 'Modalidad' })
    await expect(soloPresencial).toBeVisible()
    await expect(soloPresencial.getByRole('checkbox', { name: 'Presencial (4)' })).toBeVisible()
    await expect(soloPresencial.getByRole('checkbox', { name: 'Sin indicar (5)' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Ciudad' })).toBeVisible()
    // Empresa no: hay una sola.
    await expect(page.getByRole('group', { name: 'Empresa' })).toHaveCount(0)

    // Al publicar otra con «Remoto» aparece con Presencial y Remoto, en el orden fijo.
    sembrar([{ clave: 'remota', titulo: 'Soporte técnico remoto', modalidad: 'Remoto', hace: 4 }])
    try {
      await page.reload()
      const modalidad = page.getByRole('group', { name: 'Modalidad' })
      await expect(modalidad).toBeVisible()
      await expect(modalidad.getByRole('checkbox', { name: 'Presencial (4)' })).toBeVisible()
      await expect(modalidad.getByRole('checkbox', { name: 'Remoto (1)' })).toBeVisible()
      await expect(modalidad.getByRole('checkbox', { name: 'Sin indicar (5)' })).toBeVisible()
      expect(
        await modalidad
          .getByRole('checkbox')
          .evaluateAll((els) =>
            els.map((e) => (e as HTMLInputElement).labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim()),
          ),
      ).toEqual(['Presencial (4)', 'Remoto (1)', 'Sin indicar (5)'])
    } finally {
      // Fuera la remota, que las demás pruebas cuentan nueve.
      retirarLoSembrado()
      sembrar(COMO_PRODUCCION)
    }
  })

  // ---------- AC-08 ----------
  test('AC-08 · marcar Lima deja 2 con su etiqueta; marcar también «Sin indicar» deja 7', async ({ page }) => {
    await abrirLaLista(page)
    const ciudad = page.getByRole('group', { name: 'Ciudad' })
    await expect(ciudad.getByRole('checkbox', { name: 'Arequipa (2)' })).toBeVisible()
    await expect(ciudad.getByRole('checkbox', { name: 'Lima (2)' })).toBeVisible()
    await expect(ciudad.getByRole('checkbox', { name: 'Sin indicar (5)' })).toBeVisible()

    await marcar(ciudad.getByRole('checkbox', { name: 'Lima (2)' }))
    await expect(tarjetas(page)).toHaveCount(2)
    await expect(page.getByText('2 de 9 vacantes', { exact: true })).toBeVisible()
    await expect(etiqueta(page, 'Lima')).toBeVisible()
    await expect(page).toHaveURL(/ciudad=1501/)
    // Dentro del grupo las opciones suman: Arequipa no baja a (0) por marcar Lima.
    await expect(ciudad.getByRole('checkbox', { name: 'Arequipa (2)' })).toBeVisible()

    await marcar(ciudad.getByRole('checkbox', { name: 'Sin indicar (5)' }))
    await expect(tarjetas(page)).toHaveCount(7)
    await expect(page.getByText('7 de 9 vacantes', { exact: true })).toBeVisible()
    await expect(etiqueta(page, 'Sin indicar')).toBeVisible()

    // «Quitar filtros» los limpia todos y conserva la búsqueda.
    await buscador(page).fill('a')
    await page.getByRole('button', { name: 'Quitar filtros' }).click()
    await expect(etiqueta(page, 'Lima')).toHaveCount(0)
    await expect(buscador(page)).toHaveValue('a')
  })

  // ---------- AC-09 ----------
  test('AC-09 · la dirección copiada abre en otro navegador con la misma búsqueda, filtro, orden y resultado', async ({
    page,
    browser,
  }) => {
    await abrirLaLista(page)
    await buscador(page).fill('ingeniero')
    await marcar(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: /^Arequipa/ }))
    await page.getByText('Recientes', { exact: true }).click()
    await expect(page).toHaveURL(/q=ingeniero/)
    await expect(page).toHaveURL(/ciudad=0401/)
    await expect(page).toHaveURL(/orden=recientes/)
    const direccion = page.url()
    const resultado = await titulos(page)
    const contador = await page.getByText(/de 9 vacantes|Ninguna vacante coincide/).first().textContent()

    const otro = await browser.newContext()
    try {
      const otra = await otro.newPage()
      await otra.goto(direccion)
      await expect(buscador(otra)).toHaveValue('ingeniero')
      await expect(etiqueta(otra, 'Arequipa')).toBeVisible()
      await expect(orden(otra).getByRole('radio', { name: 'Recientes' })).toBeChecked()
      await expect(otra.getByText(contador!.trim(), { exact: true }).first()).toBeVisible()
      expect(await titulos(otra)).toEqual(resultado)
    } finally {
      await otro.close()
    }
  })

  // ---------- AC-10 ----------
  test('AC-10 · `ciudad=0801` sale como «Cusco ✕» sin resultados y se puede quitar; `ciudad=04` se ignora', async ({
    page,
  }) => {
    await abrirLaLista(page, '/vacantes?ciudad=0801')
    await expect(etiqueta(page, 'Cusco')).toBeVisible()
    await expect(page.getByText(/^Ninguna vacante coincide en Cusco\.?$/)).toBeVisible()
    await expect(tarjetas(page)).toHaveCount(0)
    await etiqueta(page, 'Cusco').click()
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(etiqueta(page, 'Cusco')).toHaveCount(0)
    // AC-21: era la última etiqueta, así que el foco vuelve al buscador.
    await expect(buscador(page)).toBeFocused()

    await abrirLaLista(page, '/vacantes?ciudad=04')
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(page.getByRole('group', { name: 'Filtros activos' })).toHaveCount(0)
    await expect(page.getByText('9 vacantes abiertas', { exact: true })).toBeVisible()
  })

  // ---------- AC-11 ----------
  test('AC-11 · escribir letra a letra y cambiar el orden no llenan el historial: atrás vuelve a la portada', async ({
    page,
  }) => {
    await page.goto('/')
    await enCabecera(page, 'Vacantes').click()
    await expect(page).toHaveURL(/\/vacantes$/)
    await buscador(page).pressSequentially('administrativo', { delay: 30 })
    await expect(tarjetas(page)).toHaveCount(1)
    await page.getByText('Recientes', { exact: true }).click()
    await expect(page).toHaveURL(/orden=recientes/)
    await page.getByText('Relevantes', { exact: true }).click()
    await expect(page).not.toHaveURL(/orden=/)

    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page).toHaveTitle('Inicio · EX')
  })

  // ---------- AC-12 ----------
  test('AC-12 · volver de la ficha, con atrás o con «Volver», deja la lista como estaba y a la altura de la tarjeta', async ({
    page,
  }) => {
    // Una ventana baja para que la lista tenga que desplazarse.
    await page.setViewportSize({ width: 1280, height: 520 })
    await abrirLaLista(page)
    await marcar(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: /^Sin indicar/ }))
    await buscador(page).fill('o')
    await page.getByText('Recientes', { exact: true }).click()
    await expect(tarjetas(page)).toHaveCount(5)
    const direccion = page.url()

    const abrir = async () => {
      const tarjeta = page.getByRole('link', { name: 'Líder de operaciones', exact: true })
      await tarjeta.scrollIntoViewIfNeeded()
      await tarjeta.click()
      await expect(page.getByRole('heading', { level: 1, name: 'Líder de operaciones' })).toBeVisible()
    }
    const comprobar = async () => {
      await expect(page).toHaveURL(direccion)
      await expect(buscador(page)).toHaveValue('o')
      // En «Ciudad»: desde el ciclo 2 «Modalidad» también se ve, con su propio «Sin indicar».
      await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: /^Sin indicar/ })).toBeChecked()
      await expect(orden(page).getByRole('radio', { name: 'Recientes' })).toBeChecked()
      await expect(tarjetas(page)).toHaveCount(5)
      const tarjeta = page.getByRole('link', { name: 'Líder de operaciones', exact: true })
      await expect(tarjeta).toBeInViewport()
      expect(await page.evaluate(() => window.scrollY), 'la lista no volvió a la altura de la tarjeta').toBeGreaterThan(0)
    }

    await abrir()
    await page.goBack()
    await comprobar()

    await abrir()
    await page.getByRole('button', { name: '← Volver a las vacantes' }).click()
    await comprobar()
  })

  // ---------- AC-13 ----------
  test('AC-13 · sin servidor: «No pudimos cargar las vacantes», el buscador con su texto y «Intentar de nuevo»', async ({
    page,
  }) => {
    // Se corta la red al tablón (no es un dato falso: es la ausencia de respuesta).
    await page.route('**/api/v1/portal/vacantes', (ruta) => ruta.abort('connectionrefused'))
    await abrirLaLista(page, '/vacantes?q=lider')
    const fallo = page.getByRole('alert').filter({ hasText: 'No pudimos cargar las vacantes.' })
    await expect(fallo).toBeVisible({ timeout: 20_000 })
    await expect(buscador(page)).toHaveValue('lider')
    await expect(page.getByText(/Ninguna vacante coincide/)).toHaveCount(0)
    await expect(page.getByText('Ahora mismo no hay vacantes abiertas.')).toHaveCount(0)

    await page.unroute('**/api/v1/portal/vacantes')
    await fallo.getByRole('button', { name: 'Intentar de nuevo' }).click()
    await expect(tarjetas(page)).toHaveCount(1)
    expect(await titulos(page)).toEqual(['Líder de operaciones'])
    await expect(page.getByText('1 de 9 vacantes', { exact: true })).toBeVisible()
  })

  // ---------- AC-14 ----------
  test('AC-14 · «Publicada hace 3 días» en la de hace 3 días; la sin fecha no dice nada y va la última', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await expect(page.getByRole('link', { name: 'Ingeniero Civil Builder Junior' })).toContainText('Publicada hace 3 días')
    await expect(page.getByRole('link', { name: 'Administrador', exact: true })).toContainText('Publicada ayer')
    const sinFecha = page.getByRole('link', { name: 'Ingeniero/a de Infraestructura' })
    await expect(sinFecha).not.toContainText('Publicada')
    expect((await titulos(page)).at(-1)).toBe('Ingeniero/a de Infraestructura')
    // Y en el orden por fecha, también la última.
    await page.getByText('Recientes', { exact: true }).click()
    await expect(orden(page).getByRole('radio', { name: 'Recientes' })).toBeChecked()
    expect((await titulos(page)).at(-1)).toBe('Ingeniero/a de Infraestructura')
  })

  // ---------- AC-16 (ciclo 2: el conmutador se queda) ----------
  test('AC-16 · borrar el texto deja el conmutador con lo elegido, la lista vuelve al orden sin texto y no salta', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await buscador(page).fill('ingeniero')
    await expect(orden(page)).toBeVisible()
    await expect(orden(page).getByRole('radio', { name: 'Relevantes' })).toBeChecked()
    const arribaConTexto = (await lista(page).boundingBox())!.y

    await page.getByRole('button', { name: 'Borrar búsqueda' }).click()
    await expect(orden(page)).toBeVisible()
    await expect(orden(page).getByRole('radio', { name: 'Relevantes' })).toBeChecked()
    await expect(page.getByText('Más recientes primero')).toHaveCount(0)
    await expect(tarjetas(page)).toHaveCount(9)
    expect(await titulos(page)).toEqual(ORDEN_POR_COMPLETITUD)
    const arribaSinTexto = (await lista(page).boundingBox())!.y
    expect(Math.abs(arribaConTexto - arribaSinTexto), 'la lista saltó al desaparecer el conmutador').toBeLessThanOrEqual(1)
    await expect(buscador(page)).toBeFocused()
  })

  // ---------- AC-22 ----------
  test('AC-22 · la portada enseña las 3 más recientes y «Ver las 9 vacantes»; la cabecera enciende «Vacantes» donde toca', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Inicio · EX')
    const recientes = page.getByRole('list', { name: 'Vacantes más recientes' })
    await expect(recientes.getByRole('listitem')).toHaveCount(3)
    expect(await recientes.getByRole('heading', { level: 3 }).allTextContents()).toEqual(ORDEN_POR_FECHA.slice(0, 3))
    await expect(enCabecera(page, 'Inicio')).toHaveAttribute('aria-current', 'page')
    await expect(enCabecera(page, 'Vacantes')).not.toHaveAttribute('aria-current', 'page')

    await page.getByRole('link', { name: 'Ver las 9 vacantes' }).click()
    await expect(page).toHaveURL(/\/vacantes$/)
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(enCabecera(page, 'Vacantes')).toHaveAttribute('aria-current', 'page')
    await expect(enCabecera(page, 'Inicio')).not.toHaveAttribute('aria-current', 'page')

    // En la ficha, «Vacantes» sigue encendido.
    await page.getByRole('link', { name: 'Administrador', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Administrador' })).toBeVisible()
    await expect(enCabecera(page, 'Vacantes')).toHaveAttribute('aria-current', 'page')
    await expect(enCabecera(page, 'Inicio')).not.toHaveAttribute('aria-current', 'page')

    // Desde la ficha, «Vacantes» de la cabecera lleva a la lista limpia.
    await enCabecera(page, 'Vacantes').click()
    await expect(page).toHaveURL(/\/vacantes$/)

    // Los dos botones «Ver las vacantes abiertas» de la portada llevan a `/vacantes`.
    await page.goto('/')
    const botones = page.getByRole('link', { name: 'Ver las vacantes abiertas' })
    await expect(botones).toHaveCount(2)
    await botones.first().click()
    await expect(page).toHaveURL(/\/vacantes$/)

    // El enlace viejo a la sección sigue cayendo en ella.
    await page.goto('/#vacantes-abiertas')
    const seccion = page.locator('#vacantes-abiertas')
    await expect(seccion).toBeInViewport()
    await expect(page).toHaveURL(/\/#vacantes-abiertas$/)
  })

  // ---------- AC-23 ----------
  test('AC-23 · la cinta cuenta ciudades del catálogo: «2 ciudades», y «1 ciudad» al quitar las de Arequipa', async ({
    page,
  }) => {
    await page.goto('/')
    const cinta = page.locator('span', { hasText: /^\s*\d+\s*ciudad(es)?\s*$/ })
    await expect(cinta).toHaveText(/^\s*2\s*ciudades\s*$/)

    // Con las de Arequipa sin ciudad, dice «1 ciudad».
    const ids = (JSON.parse(
      sql(`select coalesce(json_agg(id), '[]') from vacante
            where descripcion like ${literal(`${MARCA}%`)} and ciudad_ubigeo = '0401'`),
    ) as number[])
    expect(ids).toHaveLength(2)
    try {
      for (const id of ids) ponerCiudad(id, null)
      await page.reload()
      await expect(cinta).toHaveText(/^\s*1\s*ciudad\s*$/)
    } finally {
      for (const id of ids) ponerCiudad(id, '0401')
    }
  })

  // ---------- AC-24 ----------
  test('AC-24 · una en borrador, una archivada y una eliminada no salen, ni cuentan, ni filtran, ni suman en la cinta', async ({
    page,
  }) => {
    sembrar([
      { clave: 'borrador', titulo: 'Contador en borrador', estado: 'BORRADOR', ciudad: '0801', hace: 'hoy' },
      { clave: 'archivada', titulo: 'Contador archivado', estado: 'CERRADA', archivada: true, ciudad: '0801', hace: 'hoy' },
      { clave: 'eliminada', titulo: 'Contador eliminado', eliminada: true, ciudad: '0801', modalidad: 'Remoto', hace: 'hoy' },
    ])
    try {
      await abrirLaLista(page)
      await expect(tarjetas(page)).toHaveCount(9)
      await expect(page.getByText('9 vacantes abiertas', { exact: true })).toBeVisible()
      await buscador(page).fill('contador')
      await expect(page.getByText(/^Ninguna vacante coincide con «contador»/)).toBeVisible()
      await buscador(page).fill('')
      await expect(page.getByRole('checkbox', { name: /^Cusco/ })).toHaveCount(0)
      // La eliminada era la única «Remoto»: la modalidad sale, pero sin esa opción.
      const modalidad = page.getByRole('group', { name: 'Modalidad' })
      await expect(modalidad.getByRole('checkbox', { name: 'Presencial (4)' })).toBeVisible()
      await expect(modalidad.getByRole('checkbox', { name: /^Remoto/ })).toHaveCount(0)

      await page.goto('/')
      await expect(page.locator('span', { hasText: /^\s*\d+\s*ciudad(es)?\s*$/ })).toHaveText(/^\s*2\s*ciudades\s*$/)
      await expect(page.getByRole('link', { name: 'Ver las 9 vacantes' })).toBeVisible()
    } finally {
      retirarLoSembrado()
      sembrar(COMO_PRODUCCION)
    }
  })

  // ---------- AC-26 ----------
  test('AC-26 · la tarjeta dice «Presencial» y «Arequipa» y la ficha añade la zona; la zona que repite la ciudad no se repite', async ({
    page,
  }) => {
    // En la portada, la tarjeta de pie sigue con su línea «Presencial · Lima».
    await page.goto('/')
    const enLaPortada = page.getByRole('list', { name: 'Vacantes más recientes' }).getByRole('link', { name: 'Administrador', exact: true })
    await expect(enLaPortada).toContainText('Presencial · Lima')

    // En la lista, a lo ancho: cada dato en su fila de la columna de datos, sin la zona si hay ciudad.
    await abrirLaLista(page)
    const marketing = page.getByRole('link', { name: 'Especialista en Marketing Digital' })
    await expect(marketing).toContainText('Presencial')
    await expect(marketing).toContainText('Arequipa')
    await expect(marketing).toContainText('9am-6pm')
    await expect(marketing).toContainText('Sueldo sin publicar')
    await expect(marketing).not.toContainText('Selva Alegre')
    await marketing.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Especialista en Marketing Digital' })).toBeVisible()
    const datos = page.locator('h1').locator('xpath=..').locator('span')
    await expect(datos.filter({ hasText: /^(Presencial|Arequipa|Selva Alegre|9am-6pm)$/ })).toHaveText([
      'Presencial',
      'Arequipa',
      'Selva Alegre',
      '9am-6pm',
    ])

    await abrirLaLista(page)
    await page.getByRole('link', { name: 'Administrador', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Administrador' })).toBeVisible()
    const datosLima = page.locator('h1').locator('xpath=..').locator('span')
    await expect(datosLima.filter({ hasText: /^(Presencial|Lima|Tiempo completo)$/ })).toHaveText([
      'Presencial',
      'Lima',
      'Tiempo completo',
    ])
    await expect(datosLima.filter({ hasText: /^Lima$/ })).toHaveCount(1)
  })

  // ---------- las correcciones del ciclo 1 de QA (F-02 a F-05) ----------
  test('F-02 · en escritorio no hay botón «Filtrar»: los filtros están a la vista, también con uno marcado', async ({
    page,
  }) => {
    await abrirLaLista(page)
    const ciudad = page.getByRole('group', { name: 'Ciudad' })
    await expect(ciudad).toBeVisible()
    await expect(page.getByRole('button', { name: /^Filtrar/ })).toBeHidden()
    await marcar(ciudad.getByRole('checkbox', { name: 'Lima (2)' }))
    await expect(etiqueta(page, 'Lima')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Filtrar/ })).toBeHidden()
  })

  test('F-03 · una búsqueda de 200 letras seguidas se parte y no saca la página de su ancho', async ({ page }) => {
    await abrirLaLista(page)
    await buscador(page).fill('x'.repeat(200))
    const aviso = page.getByText(/^Ninguna vacante coincide con «x{200}»/)
    await expect(aviso).toBeVisible()
    await expect(page.getByText('Hay 9 vacantes abiertas.')).toBeVisible()
    const medida = await aviso.evaluate((p) => ({
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      parrafo: p.getBoundingClientRect().width,
      contenedor: p.parentElement!.getBoundingClientRect().width,
    }))
    expect(medida.documento, 'la página pide scroll horizontal').toBeLessThanOrEqual(medida.ventana)
    expect(medida.parrafo, 'el aviso se sale de su contenedor').toBeLessThanOrEqual(medida.contenedor + 1)
  })

  test('F-04 · marcar un filtro o cambiar el orden no anima los títulos de las tarjetas', async ({ page }) => {
    await abrirLaLista(page)
    await expect(tarjetas(page)).toHaveCount(9)
    // Se vigila desde antes de tocar nada: motion pone un `transform` en línea en cada título que mueve.
    const vigilar = () =>
      page.evaluate(
        () =>
          new Promise<string[]>((resolver) => {
            const movidos = new Set<string>()
            const desde = performance.now()
            const mirar = () => {
              document.querySelectorAll<HTMLElement>('ul[aria-label="Vacantes"] h3').forEach((h) => {
                if (h.style.transform && h.style.transform !== 'none') movidos.add(h.textContent ?? '')
              })
              if (performance.now() - desde < 800) requestAnimationFrame(mirar)
              else resolver([...movidos])
            }
            mirar()
          }),
      )

    const alFiltrar = vigilar()
    await marcar(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: 'Lima (2)' }))
    await expect(tarjetas(page)).toHaveCount(2)
    expect(await alFiltrar, 'los títulos volaron por la rejilla al filtrar').toEqual([])

    await page.getByRole('button', { name: 'Quitar filtros' }).click()
    await expect(tarjetas(page)).toHaveCount(9)
    await buscador(page).fill('e')
    await expect(orden(page)).toBeVisible()
    const alOrdenar = vigilar()
    await page.getByText('Recientes', { exact: true }).click()
    await expect(orden(page).getByRole('radio', { name: 'Recientes' })).toBeChecked()
    expect(await alOrdenar, 'los títulos volaron por la rejilla al ordenar').toEqual([])
  })

  test('F-05 · un doble clic en una casilla la deja como estaba; dos casillas en el mismo instante quedan las dos; un doble clic en una etiqueta la quita una sola vez', async ({
    page,
  }) => {
    await abrirLaLista(page)
    const ciudad = page.getByRole('group', { name: 'Ciudad' })
    const lima = ciudad.getByRole('checkbox', { name: 'Lima (2)' })
    const arequipa = ciudad.getByRole('checkbox', { name: 'Arequipa (2)' })

    await lima.dblclick()
    // Si el doble clic se anula no cambia nada visible: se le da al router el tiempo de escribir y reescribir.
    await page.waitForTimeout(700)
    await expect(lima).not.toBeChecked()
    await expect(etiqueta(page, 'Lima')).toHaveCount(0)
    await expect(contador(page, '9 vacantes abiertas')).toBeVisible()
    await expect(page).toHaveURL(/\/vacantes$/)

    // Dos casillas en el mismo instante —sin pintado entre medias—: la segunda no pisa a la primera.
    const casillaDeArequipa = await arequipa.elementHandle()
    await lima.evaluate((a, b) => {
      ;(a as HTMLInputElement).click()
      ;(b as HTMLInputElement).click()
    }, casillaDeArequipa)
    await expect(tarjetas(page)).toHaveCount(4)
    await expect(contador(page, '4 de 9 vacantes')).toBeVisible()
    await expect(lima).toBeChecked()
    await expect(arequipa).toBeChecked()
    await expect(etiqueta(page, 'Lima')).toBeVisible()
    await expect(etiqueta(page, 'Arequipa')).toBeVisible()
    await expect(page).toHaveURL(/ciudad=1501&ciudad=0401/)

    // Dos clics en el mismo instante sobre «Lima ✕»: se va Lima, y solo Lima.
    await etiqueta(page, 'Lima').evaluate((b) => {
      ;(b as HTMLButtonElement).click()
      ;(b as HTMLButtonElement).click()
    })
    await expect(tarjetas(page)).toHaveCount(2)
    await expect(contador(page, '2 de 9 vacantes')).toBeVisible()
    await expect(etiqueta(page, 'Lima')).toHaveCount(0)
    await expect(etiqueta(page, 'Arequipa')).toBeVisible()
    await expect(page).toHaveURL(/\/vacantes\?ciudad=0401$/)
  })

  test('F-05 · `ciudad=9999` espera al catálogo sin enseñar «9999 ✕» ni «ninguna coincide», y después limpia la dirección', async ({
    page,
  }) => {
    // El catálogo tarda: mientras, la lista sigue en su esqueleto y no se pinta ninguna etiqueta.
    await page.route('**/portal/catalogos/ubigeo*', async (ruta) => {
      await new Promise((r) => setTimeout(r, 1500))
      await ruta.continue()
    })
    await page.goto('/vacantes?ciudad=9999')
    await expect(page.getByLabel('Buscando vacantes')).toBeVisible()
    expect(await page.getByRole('button', { name: /^Quitar filtro/ }).count()).toBe(0)
    expect(await page.getByText(/Ninguna vacante coincide/).count()).toBe(0)
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(page).toHaveURL(/\/vacantes$/)
    await expect(etiqueta(page, '9999')).toHaveCount(0)
    await expect(contador(page, '9 vacantes abiertas')).toBeVisible()
  })

  // ---------- la disposición del ciclo 2 ----------
  test('Ciclo 2 · en escritorio, los filtros en una columna a la izquierda, el orden arriba a la derecha y las tarjetas a lo ancho', async ({
    page,
  }) => {
    await abrirLaLista(page)
    await expect(tarjetas(page)).toHaveCount(9)
    const caja = async (l: Locator) => (await l.boundingBox())!
    const ciudad = await caja(page.getByRole('group', { name: 'Ciudad' }))
    const laLista = await caja(lista(page))
    const elOrden = await caja(orden(page))
    const laCuenta = await caja(contador(page, '9 vacantes abiertas'))
    // La columna de filtros a la izquierda de la lista, sin pisarla.
    expect(ciudad.x + ciudad.width, 'los filtros no están a la izquierda de la lista').toBeLessThanOrEqual(laLista.x)
    // El orden en la misma fila que el contador, a su derecha y encima de la lista.
    expect(Math.abs(elOrden.y + elOrden.height / 2 - (laCuenta.y + laCuenta.height / 2)), 'el orden no está en la fila del contador').toBeLessThanOrEqual(8)
    expect(elOrden.x, 'el orden no está a la derecha del contador').toBeGreaterThan(laCuenta.x + laCuenta.width)
    expect(elOrden.y + elOrden.height, 'el orden no está encima de la lista').toBeLessThanOrEqual(laLista.y)
    // Los grupos, de arriba abajo: Publicada, Ciudad, Modalidad.
    const cabezas = await page.locator('#filtros-de-vacantes').getByRole('button').allTextContents()
    expect(cabezas.map((t) => t.trim())).toEqual(['Publicada', 'Ciudad', 'Modalidad'])

    // Una tarjeta por fila, a todo el ancho de la columna de resultados, y los datos a la derecha del título.
    const primera = await caja(tarjetas(page).first())
    const segunda = await caja(tarjetas(page).nth(1))
    expect(Math.abs(primera.width - laLista.width), 'la tarjeta no ocupa todo el ancho').toBeLessThanOrEqual(1)
    expect(segunda.y, 'dos tarjetas en la misma fila').toBeGreaterThan(primera.y + primera.height - 1)
    const administrador = page.getByRole('link', { name: 'Administrador', exact: true })
    const titulo = await caja(administrador.getByRole('heading', { level: 3 }))
    const sueldo = await caja(administrador.getByText('Sueldo sin publicar', { exact: true }))
    expect(sueldo.x, 'los datos no van a la derecha del título').toBeGreaterThan(titulo.x + titulo.width)

    // La fila del contador cruza las dos columnas: empieza sobre la de filtros, y esta empieza debajo.
    const columna = await caja(page.locator('#filtros-de-vacantes'))
    expect(laCuenta.x, 'el contador no cruza sobre la columna de filtros').toBeLessThan(laLista.x)
    expect(columna.y, 'la columna de filtros no empieza bajo la fila del contador').toBeGreaterThanOrEqual(elOrden.y + elOrden.height)

    // Decisión del usuario del 25/09/2026: un filtro puesto sale como etiqueta en la columna de
    // resultados, bajo la fila del contador y encima de las tarjetas; la de filtros no se mueve.
    // Se mide en la página y no en la ventana: el clic puede desplazarla para alcanzar la casilla.
    const enLaPagina = async (l: Locator) => {
      const b = await caja(l)
      return { ...b, y: b.y + (await page.evaluate(() => window.scrollY)) }
    }
    const publicadaAntes = await enLaPagina(page.getByRole('button', { name: 'Publicada', exact: true }))
    await marcar(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: 'Lima (2)' }))
    await expect(contador(page, '2 de 9 vacantes')).toHaveText('2 de 9 vacantes en Lima')
    const publicada = await enLaPagina(page.getByRole('button', { name: 'Publicada', exact: true }))
    expect(Math.abs(publicada.y - publicadaAntes.y), 'marcar una casilla movió la columna de filtros').toBeLessThanOrEqual(1)
    const elOrdenAhora = await enLaPagina(orden(page))
    const laListaAhora = await enLaPagina(lista(page))
    for (const [nombre, pieza] of [
      ['la etiqueta', await enLaPagina(etiqueta(page, 'Lima'))],
      ['«Quitar filtros»', await enLaPagina(page.getByRole('button', { name: 'Quitar filtros', exact: true }))],
    ] as const) {
      expect(pieza.x, `${nombre} no está en la columna de resultados`).toBeGreaterThanOrEqual(laListaAhora.x - 1)
      expect(pieza.y, `${nombre} no está bajo la fila del contador`).toBeGreaterThanOrEqual(elOrdenAhora.y + elOrdenAhora.height)
      expect(pieza.y + pieza.height, `${nombre} no está encima de las tarjetas`).toBeLessThanOrEqual(laListaAhora.y)
    }
    // Un grupo se pliega.
    await page.getByRole('button', { name: 'Ciudad', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ciudad', exact: true })).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('group', { name: 'Ciudad' })).toBeHidden()
    await expect(etiqueta(page, 'Lima')).toBeVisible()
    await expect(tarjetas(page)).toHaveCount(2)
  })

  // ---------- con sesión de candidato se ve igual ----------
  test('con sesión de candidato la pantalla es la misma', async ({ page }) => {
    const correo = correoDePrueba('e2e.buscar.sesion')
    await crearCuentaDeCandidato({ nombre: 'Visita', apellidos: 'Con sesión', correo })
    try {
      await entrarAlPortal(page, correo, 'unaClaveDePrueba123')
      await abrirLaLista(page)
      await expect(tarjetas(page)).toHaveCount(9)
      await expect(page.getByText('9 vacantes abiertas', { exact: true })).toBeVisible()
      await buscador(page).fill('GESTION')
      await expect(tarjetas(page)).toHaveCount(1)
    } finally {
      borrarCuentasDePrueba([correo])
    }
  })
})

test.describe('Buscar vacantes · las fechas', () => {
  test.beforeAll(() => {
    retirarLoSembrado()
    esconderLasDemas()
  })
  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(), () => devolverLasEscondidas()]))
  test.afterEach(() => retirarLoSembrado())

  // ---------- AC-15 ----------
  test('AC-15 · «Relevantes» pone primero el título que empieza por lo buscado; «Recientes», la publicada ayer', async ({
    page,
  }) => {
    sembrar([
      { clave: 'datos', titulo: 'Perito de Datos', hace: 20 },
      { clave: 'coordinador', titulo: 'Coordinador de Peritos', hace: 'ayer' },
    ])
    await abrirLaLista(page)
    await buscador(page).fill('perito')
    await expect(tarjetas(page)).toHaveCount(2)
    expect(await titulos(page)).toEqual(['Perito de Datos', 'Coordinador de Peritos'])
    await page.getByText('Recientes', { exact: true }).click()
    expect(await titulos(page)).toEqual(['Coordinador de Peritos', 'Perito de Datos'])
    // Cambiar el orden no mueve la búsqueda.
    await expect(buscador(page)).toHaveValue('perito')
  })

  // ---------- AC-17 ----------
  test('AC-17 · «Publicada» cuenta Cualquier fecha (4), 24 horas (1), 7 días (2) y 30 días (3); elegir 7 días deja 2', async ({
    page,
  }) => {
    sembrar([
      { clave: 'hoy', titulo: 'Publicada hoy mismo', hace: 'hoy' },
      { clave: 'tres', titulo: 'Publicada hace tres días', hace: 3 },
      { clave: 'diez', titulo: 'Publicada hace diez días', hace: 10 },
      { clave: 'cuarenta', titulo: 'Publicada hace cuarenta días', hace: 40 },
    ])
    await abrirLaLista(page)
    const publicada = page.getByRole('radiogroup', { name: 'Publicada' })
    await expect(publicada).toBeVisible()
    await expect(publicada.getByRole('radio', { name: 'Cualquier fecha (4)' })).toBeChecked()
    await expect(publicada.getByRole('radio', { name: 'Últimas 24 horas (1)' })).toBeVisible()
    await expect(publicada.getByRole('radio', { name: 'Últimos 7 días (2)' })).toBeVisible()
    await expect(publicada.getByRole('radio', { name: 'Últimos 30 días (3)' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Publicada hoy mismo' })).toContainText('Publicada hoy')
    await expect(page.getByRole('link', { name: 'Publicada hace diez días' })).toContainText('Publicada hace 10 días')
    await expect(page.getByRole('link', { name: 'Publicada hace cuarenta días' })).toContainText('Publicada hace 5 semanas')

    await publicada.getByText('Últimos 7 días', { exact: false }).click()
    await expect(tarjetas(page)).toHaveCount(2)
    expect(await titulos(page)).toEqual(['Publicada hoy mismo', 'Publicada hace tres días'])
    await expect(etiqueta(page, 'Últimos 7 días')).toBeVisible()
    await expect(page).toHaveURL(/publicada=7d/)
  })

  // ---------- AC-18 (ciclo 2: la fecha se ve siempre) ----------
  test('AC-18 · si todas se publicaron hace más de 30 días, «Publicada» sale igual con sus ceros, y ciudad y modalidad con «Sin indicar»', async ({
    page,
  }) => {
    sembrar([
      { clave: 'a', titulo: 'Vieja de treinta y cinco días', hace: 35 },
      { clave: 'b', titulo: 'Vieja de cuarenta y cinco días', hace: 45 },
      { clave: 'c', titulo: 'Vieja de sesenta días', hace: 60 },
    ])
    await abrirLaLista(page)
    await expect(tarjetas(page)).toHaveCount(3)
    const publicada = page.getByRole('radiogroup', { name: 'Publicada' })
    await expect(publicada).toBeVisible()
    await expect(publicada.getByRole('radio', { name: 'Cualquier fecha (3)' })).toBeChecked()
    for (const ventana of ['Últimas 24 horas (0)', 'Últimos 7 días (0)', 'Últimos 30 días (0)']) {
      await expect(publicada.getByRole('radio', { name: ventana })).toBeVisible()
    }
    await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: 'Sin indicar (3)' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Modalidad' }).getByRole('checkbox', { name: 'Sin indicar (3)' })).toBeVisible()
  })

  // ---------- AC-05 ----------
  test('AC-05 · sin vacantes publicadas, `/vacantes?q=analista` dice «Ahora mismo no hay vacantes abiertas» sin buscador', async ({
    page,
  }) => {
    // Todo escondido y nada sembrado: el tablón contesta una lista vacía de verdad.
    await abrirLaLista(page, '/vacantes?q=analista')
    await expect(page.getByText('Ahora mismo no hay vacantes abiertas.')).toBeVisible()
    await expect(buscador(page)).toHaveCount(0)
    await expect(orden(page)).toHaveCount(0)
    await expect(page.locator('#filtros-de-vacantes')).toHaveCount(0)
    await expect(page.getByText(/Ninguna vacante coincide/)).toHaveCount(0)
  })
})

/**
 * Regresiones del rediseño del ciclo 2 (decisiones del usuario del 25/09/2026),
 * añadidas por QA: el teclado en la columna de filtros, el orden por completitud
 * con el sueldo publicado, el resumen de la tarjeta a lo ancho, el corte de 641 a
 * 900 px y la salida de «ninguna coincide» con el orden elegido.
 */
test.describe('Buscar vacantes · el rediseño del ciclo 2 (QA)', () => {
  test.beforeAll(() => {
    retirarLoSembrado()
    esconderLasDemas()
  })
  test.afterAll(() => limpiarSiempre([() => retirarLoSembrado(), () => devolverLasEscondidas()]))
  test.afterEach(() => retirarLoSembrado())

  /** Lo que tiene el foco, en pocas palabras: la etiqueta, el nombre o el texto. */
  const enfocado = (page: Page) =>
    page.evaluate(() => {
      const e = document.activeElement as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null }
      const etiqueta = e.labels?.[0]?.textContent ?? ''
      const nombre = e.getAttribute('aria-label') ?? (etiqueta || e.textContent || '')
      return { tag: e.tagName, nombre: nombre.replace(/\s+/g, ' ').trim(), href: e.getAttribute('href') }
    })

  // ---------- puntos 38 y 40: una parada por tarjeta ----------
  test('Tab recorre buscador → borrar → orden → grupos → etiquetas → resultados, y cada tarjeta es UNA parada: su enlace', async ({
    page,
  }) => {
    const ids = sembrar(COMO_PRODUCCION)
    await abrirLaLista(page, '/vacantes?q=a&ciudad=1501')
    await expect(tarjetas(page)).toHaveCount(2)

    await buscador(page).focus()
    const recorrido: { tag: string; nombre: string; href: string | null }[] = [await enfocado(page)]
    // Hasta el enlace de la primera tarjeta, con un tope por si el foco se escapa.
    for (let i = 0; i < 40 && !recorrido[recorrido.length - 1]!.href?.startsWith('/vacantes/'); i++) {
      await page.keyboard.press('Tab')
      recorrido.push(await enfocado(page))
    }
    const nombres = recorrido.map((p) => p.nombre)
    const posicion = (texto: string) => nombres.findIndex((n) => n === texto || n.startsWith(texto))
    expect(posicion('Buscar vacantes')).toBe(0)
    expect(posicion('Borrar búsqueda')).toBe(1)
    expect(posicion('Relevantes')).toBe(2)
    expect(posicion('Publicada')).toBeGreaterThan(posicion('Relevantes'))
    expect(posicion('Ciudad')).toBeGreaterThan(posicion('Publicada'))
    expect(posicion('Quitar filtro Lima')).toBeGreaterThan(posicion('Modalidad'))
    expect(posicion('Quitar filtros')).toBe(posicion('Quitar filtro Lima') + 1)
    // Lo siguiente a «Quitar filtros» es ya el enlace de la primera tarjeta: nada sin nombre en medio.
    const primera = recorrido[recorrido.length - 1]!
    expect(recorrido.length - 1, `entre «Quitar filtros» y la primera tarjeta hubo otra parada: ${JSON.stringify(recorrido.slice(-3))}`).toBe(
      posicion('Quitar filtros') + 1,
    )
    expect(primera.tag).toBe('A')
    expect(primera.href).toBe(`/vacantes/${ids.administrador}`)

    // Y de una tarjeta a la siguiente, un solo Tab.
    await page.keyboard.press('Tab')
    const segunda = await enfocado(page)
    expect(segunda, 'la segunda parada no es el enlace de la segunda tarjeta').toMatchObject({
      tag: 'A',
      href: `/vacantes/${ids.asistente}`,
    })
    expect(recorrido.filter((p) => p.tag === 'ARTICLE')).toEqual([])
  })

  // ---------- grupos plegables con teclado ----------
  test('un grupo se pliega y se despliega con Enter y con Espacio, el foco se queda en su cabeza y plegado Tab se salta sus opciones', async ({
    page,
  }) => {
    sembrar(COMO_PRODUCCION)
    await abrirLaLista(page)
    const cabeza = page.getByRole('button', { name: 'Ciudad', exact: true })
    await expect(cabeza).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'Publicada', exact: true })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'Modalidad', exact: true })).toHaveAttribute('aria-expanded', 'true')

    await cabeza.focus()
    await page.keyboard.press('Enter')
    await expect(cabeza).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('group', { name: 'Ciudad' })).toBeHidden()
    await expect(cabeza).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Modalidad', exact: true })).toBeFocused()

    await cabeza.focus()
    await page.keyboard.press('Space')
    await expect(cabeza).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: 'Arequipa (2)' })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: 'Arequipa (2)' })).toBeFocused()
    // Plegar no filtra nada ni toca la dirección.
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(page).toHaveURL(/\/vacantes$/)
  })

  // ---------- completitud: el sueldo publicado cuenta, y pesa más que la fecha ----------
  test('sin texto, «Relevantes» cuenta el sueldo publicado y la completitud manda sobre la fecha; «Recientes» va por fecha', async ({
    page,
  }) => {
    const ids = sembrar([
      { clave: 'reciente', titulo: 'Reciente con sueldo y poco más', hace: 'ayer' },
      { clave: 'media', titulo: 'Media sin sueldo', modalidad: 'Presencial', ciudad: '1501', horario: '9am-6pm', hace: 30 },
      { clave: 'completa', titulo: 'Completa sin fecha', modalidad: 'Remoto', ciudad: '0401', horario: 'Tiempo completo', hace: null },
    ])
    for (const [id, tipo] of [
      [ids.reciente, 'FIJA'],
      [ids.completa, 'RANGO'],
    ] as const) {
      sql(`update vacante set remuneracion_tipo = ${literal(tipo)}, remuneracion_min = 3000,
             remuneracion_max = ${tipo === 'RANGO' ? 4500 : 'null'}, remuneracion_moneda = 'PEN'
           where id = ${id} and descripcion like ${literal(`${MARCA}%`)};`)
    }
    await abrirLaLista(page)
    await expect(tarjetas(page)).toHaveCount(3)
    // 5 de 5, 4 de 5 y 2 de 5: la sin fecha va primero porque dice más.
    expect(await titulos(page)).toEqual(['Completa sin fecha', 'Media sin sueldo', 'Reciente con sueldo y poco más'])
    await expect(page.getByRole('link', { name: 'Completa sin fecha', exact: true })).toContainText('S/ 3 000 a 4 500')

    await page.getByText('Recientes', { exact: true }).click()
    await expect(page).toHaveURL(/\/vacantes\?orden=recientes$/)
    expect(await titulos(page)).toEqual(['Reciente con sueldo y poco más', 'Media sin sueldo', 'Completa sin fecha'])
  })

  // ---------- el resumen: un propósito de solo espacios cuenta como vacío ----------
  test('la tarjeta a lo ancho usa la descripción cuando el propósito es solo espacios', async ({ page }) => {
    sembrar([{ clave: 'blanco', titulo: 'Puesto con propósito en blanco', proposito: '   ', modalidad: 'Remoto', hace: 2 }])
    await abrirLaLista(page)
    const tarjeta = page.getByRole('link', { name: 'Puesto con propósito en blanco', exact: true })
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta.locator('p')).toHaveText(`${MARCA} · Puesto con propósito en blanco`)
  })

  // ---------- de 641 a 900 px ----------
  test('a 768 px los filtros se apilan abiertos entre el contador y la lista, sin «Filtrar», y la tarjeta mantiene los datos a su derecha', async ({
    page,
  }) => {
    sembrar(COMO_PRODUCCION)
    await page.setViewportSize({ width: 768, height: 1000 })
    await abrirLaLista(page)
    await expect(tarjetas(page)).toHaveCount(9)
    await expect(page.getByRole('button', { name: /^Filtrar/ })).toBeHidden()
    const caja = async (l: Locator) => (await l.boundingBox())!
    const filtros = await caja(page.locator('#filtros-de-vacantes'))
    const cuenta = await caja(contador(page, '9 vacantes abiertas'))
    expect(filtros.y, 'los filtros no van debajo del contador').toBeGreaterThan(cuenta.y + cuenta.height - 1)
    expect(filtros.y + filtros.height, 'los filtros no van encima de la lista').toBeLessThanOrEqual((await caja(lista(page))).y)
    for (const grupo of ['Publicada', 'Ciudad', 'Modalidad']) {
      await expect(page.getByRole('button', { name: grupo, exact: true })).toHaveAttribute('aria-expanded', 'true')
    }
    const administrador = page.getByRole('link', { name: 'Administrador', exact: true })
    const titulo = await caja(administrador.getByRole('heading', { level: 3 }))
    const sueldo = await caja(administrador.getByText('Sueldo sin publicar', { exact: true }))
    expect(sueldo.x, 'a 768 los datos bajaron debajo del título').toBeGreaterThan(titulo.x + titulo.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

    await marcar(page.getByRole('group', { name: 'Ciudad' }).getByRole('checkbox', { name: 'Lima (2)' }))
    const laEtiqueta = await caja(etiqueta(page, 'Lima'))
    expect(laEtiqueta.y, 'la etiqueta no va entre los filtros y la lista').toBeGreaterThan(filtros.y)
    expect(laEtiqueta.y + laEtiqueta.height).toBeLessThanOrEqual((await caja(lista(page))).y)
  })

  // ---------- «Ver las N vacantes» conserva el orden ----------
  test('«Ver las N vacantes» quita búsqueda y filtros, conserva «Recientes» y enfoca el buscador', async ({ page }) => {
    sembrar(COMO_PRODUCCION)
    await abrirLaLista(page, '/vacantes?q=notario&ciudad=1501&orden=recientes')
    await expect(page.getByText('Ninguna vacante coincide con «notario» en Lima.')).toBeVisible()
    await expect(orden(page).getByRole('radio', { name: 'Recientes' })).toBeChecked()
    await page.getByRole('button', { name: 'Ver las 9 vacantes' }).click()
    await expect(page).toHaveURL(/\/vacantes\?orden=recientes$/)
    await expect(buscador(page)).toHaveValue('')
    await expect(buscador(page)).toBeFocused()
    await expect(orden(page).getByRole('radio', { name: 'Recientes' })).toBeChecked()
    expect(await titulos(page)).toEqual(ORDEN_POR_FECHA)
  })
})
