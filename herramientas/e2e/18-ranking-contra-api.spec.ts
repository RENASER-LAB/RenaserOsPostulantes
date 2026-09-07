import { expect, test, type Page } from '@playwright/test'
import { API, corte, entrarAlPanel, idDeVacante, nombresVisibles, pestana, tokenDelPanel, VACANTES } from './ayuda'

/**
 * El ranking, etapa por etapa, CONTRASTADO con lo que dice la API.
 *
 * ⚠️ **Solo lee.** Ni un POST: entra, mira las cinco pestañas y compara lo
 * pintado con la respuesta del backend.
 *
 * Pestañas, cortes, orden y filtros ya los cubren `01`, `03` y `04`. Lo que
 * NADIE más mira es el pacto entre el panel y el backend:
 *
 *   1. **La tabla la sirve una sola llamada.** `?etapa=` cambia de qué etapa es
 *      la nota, NO a quién devuelve, y quien filtra es el navegador. Si el backend
 *      empezara a filtrar, el navegador filtraría encima de lo ya filtrado y la
 *      pantalla seguiría pareciendo correcta: la primera comprobación lo detecta.
 *   2. **Los prefijos son un pacto no escrito.** El panel decide quién está «aquí
 *      ahora» partiendo el código del estado por su etapa. Un estado nuevo que no
 *      empiece por ninguno —o una etapa renombrada— haría desaparecer gente de las
 *      cinco pestañas sin un solo error en consola. Por eso lo pintado se compara
 *      con los estados que devuelve la API, no con una lista escrita a mano.
 *
 * ⚠️ **Quien terminó no está en ninguna etapa**, y es correcto: CONTRATADO,
 * NO_CONTINUA y CERRADA no empiezan por el prefijo de ninguna. La única forma de
 * llegar a ellos es «Toda la tanda», así que ese escape se comprueba entero.
 *
 * Se mira la vacante LLENA, que reparte su gente entre tres etapas y tiene una
 * postulación cerrada: es la que ejercita las dos mitades.
 */

/**
 * Las cinco etapas y sus prefijos, copiados del panel A PROPÓSITO.
 *
 * No se importan de `ranking.ts`: si esta prueba leyera la misma constante que
 * la pantalla, las dos se equivocarían juntas y en silencio. Aquí son la
 * segunda opinión.
 */
const ETAPAS = [
  { nombre: 'Perfil integral', codigo: 'PERFIL_INTEGRAL', prefijos: ['POSTULADA', 'PERFIL_'],
    porRevisar: ['PERFIL_POR_CONFIRMAR'],
    leToca: ['PERFIL_TURNO_CANDIDATO'] },
  { nombre: 'Prueba del puesto', codigo: 'PRUEBA_PUESTO', prefijos: ['PRUEBA_'],
    porRevisar: ['PRUEBA_POR_CONFIRMAR'],
    leToca: ['PRUEBA_TURNO_CANDIDATO'] },
  { nombre: 'Simulación', codigo: 'SIMULACION', prefijos: ['SIMULACION_'],
    porRevisar: ['SIMULACION_POR_HABILITAR', 'SIMULACION_POR_CONFIRMAR'],
    leToca: ['SIMULACION_TURNO_CANDIDATO'] },
  { nombre: 'Validación', codigo: 'VALIDACION', prefijos: ['VALIDACION_'],
    porRevisar: ['VALIDACION_POR_HABILITAR', 'VALIDACION_POR_CONFIRMAR'],
    leToca: ['VALIDACION_TURNO_CANDIDATO'] },
  { nombre: 'Decisión', codigo: 'DECISION', prefijos: ['DECISION_'],
    porRevisar: ['DECISION_POR_CONFIRMAR'],
    leToca: ['DECISION_TURNO_CANDIDATO'] },
] as const

interface Fila {
  candidato: string
  estado: string
  notaEtapa: number | null
}

const etapaDe = (estado: string) =>
  ETAPAS.find((e) => e.prefijos.some((p) => estado.startsWith(p)))?.nombre ?? null

// ---------- La API, sin navegador ----------

async function rankingPorApi(vacanteId: number, etapa?: string): Promise<{ estado: number; filas: Fila[] | null }> {
  const r = await fetch(`${API}/panel/vacantes/${vacanteId}/ranking${etapa ? `?etapa=${etapa}` : ''}`, {
    headers: { Authorization: `Bearer ${await tokenDelPanel()}` },
  })
  // Primero el estado y después el cuerpo: un 500 vacío se colaba como éxito al
  // mirarlo al revés.
  const texto = await r.text()
  let filas: Fila[] | null = null
  try {
    filas = texto ? (JSON.parse(texto).filas ?? null) : null
  } catch {
    filas = null
  }
  return { estado: r.status, filas }
}

// ---------- El panel ----------

/** La cifra que lleva un corte al final de su nombre: «Por revisar 1». */
const cifraDelCorte = async (page: Page, nombre: string) =>
  Number(((await corte(page, nombre).textContent()) ?? '').match(/(\d+)\s*$/)?.[1])

/** La línea de arriba de la tabla: «N de M con nota de la prueba · …». */
const lineaDeLaEtapa = (page: Page) => page.locator('p').filter({ hasText: /con nota de/ }).first()

/** El cuerpo de la tabla del ranking, que es la última de la página. */
const cuerpoDeLaTabla = (page: Page) => page.locator('table').last().locator('tbody')

const contexto = {
  vacanteId: 0,
  /** La tanda entera según la API sin `?etapa=`. */
  todas: [] as Fila[],
  erroresDePagina: [] as string[],
}

test.describe('El ranking contra la API · lo pintado es lo que el backend dijo', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    contexto.vacanteId = await idDeVacante(VACANTES.LLENA)
    const base = await rankingPorApi(contexto.vacanteId)
    contexto.todas = base.filas ?? []
  })

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => contexto.erroresDePagina.push(String(e).slice(0, 200)))
  })

  test('el contrato: la tanda entera, y «?etapa=» cambia la nota y NO la lista', async () => {
    const base = await rankingPorApi(contexto.vacanteId)
    expect(base.estado, 'GET /vacantes/{id}/ranking no devuelve la tanda').toBe(200)
    expect(Array.isArray(base.filas)).toBe(true)
    test.skip(contexto.todas.length === 0, `«${VACANTES.LLENA}» no tiene postulaciones: no hay ranking que contrastar.`)

    const etapasOcupadas = new Set(contexto.todas.map((f) => etapaDe(f.estado)).filter(Boolean))
    test.info().annotations.push({
      type: 'la tanda',
      description: `${contexto.todas.length} postulaciones repartidas en ${etapasOcupadas.size} etapa(s)`,
    })
    if (etapasOcupadas.size < 2) {
      test.info().annotations.push({
        type: 'aviso',
        description: 'toda la tanda está en la misma etapa: el filtro se ejercita a medias',
      })
    }

    /*
      ⚠️ El `?etapa=` cambia la NOTA, no la lista. Es lo que obliga a filtrar en
      el navegador; el día que el backend filtre, esto se pone rojo y el filtro
      del panel sobra.
    */
    for (const etapa of ETAPAS) {
      const suya = await rankingPorApi(contexto.vacanteId, etapa.codigo)
      expect(suya.estado, `?etapa=${etapa.codigo} contestó ${suya.estado}`).toBe(200)
      expect(
        suya.filas?.length,
        `?etapa=${etapa.codigo} devolvió otra cantidad de filas: si el backend ya filtra, el panel puede dejar de hacerlo`,
      ).toBe(contexto.todas.length)
    }
  })

  test('las cinco pestañas: cortes, cifras y filas cuadran con lo que dice la API', async ({ page }) => {
    test.skip(contexto.todas.length === 0, 'Sin postulaciones no hay nada que contrastar.')
    const todas = contexto.todas
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${contexto.vacanteId}`)
    await expect(page.getByRole('heading', { name: 'El ranking, etapa por etapa' })).toBeVisible({ timeout: 20_000 })

    // Abre por lo que espera una decisión de la empresa: la bandeja de trabajo.
    await expect(corte(page, 'Por revisar')).toHaveAttribute('aria-pressed', 'true')

    let algunaVacia = false
    for (const etapa of ETAPAS) {
      await pestana(page, etapa.nombre).click()
      await expect(pestana(page, etapa.nombre)).toHaveAttribute('aria-selected', 'true')

      /*
        ⚠️ **Cada pestaña pide su propio ranking**, y `notaEtapa` es lo único
        que cambia: hay que traer el de ESTA etapa para saber quién tiene nota
        aquí. Comparar contra el del perfil daría el fallo que la pantalla arregla.
      */
      const suyas = (await rankingPorApi(contexto.vacanteId, etapa.codigo)).filas ?? []
      const conNota = suyas.filter((f) => f.notaEtapa !== null)
      const deLaEtapa = todas.filter((f) => etapaDe(f.estado) === etapa.nombre)
      /*
        ⚠️ **El corte NO es «con nota»: es el estado.** La nota no se borra al
        avanzar, así que en el perfil integral «con nota» traía a quien ya
        estaba rindiendo la prueba —gente sobre la que no hay nada que decidir—.
      */
      const porRevisar = todas.filter((f) => (etapa.porRevisar as readonly string[]).includes(f.estado))
      const leToca = todas.filter((f) => (etapa.leToca as readonly string[]).includes(f.estado))

      await expect(corte(page, 'Por revisar'), `${etapa.nombre}: el corte «por revisar» no dice ${porRevisar.length}`).toHaveText(
        new RegExp(`${porRevisar.length}\\s*$`),
      )
      expect(await cifraDelCorte(page, 'Le toca al candidato'), `${etapa.nombre}: «le toca al candidato» no dice ${leToca.length}`).toBe(
        leToca.length,
      )
      /*
        Los dos primeros cortes son disjuntos —o espera a la empresa, o al
        candidato— y juntos NO llegan a la etapa entera: quien está siendo
        calificado por la IA no espera a ninguna persona y no sale en ninguno.
      */
      expect(porRevisar.length + leToca.length, `${etapa.nombre}: los dos cortes se solapan o se pasan de la etapa`).toBeLessThanOrEqual(
        deLaEtapa.length,
      )
      expect(await cifraDelCorte(page, 'Toda la tanda'), `${etapa.nombre}: «toda la tanda» no dice ${todas.length}`).toBe(
        todas.length,
      )

      // Se pintan los que esperan decisión en ESTA etapa, ni uno más.
      const pintados = await nombresVisibles(page)
      expect(
        pintados.length,
        `${etapa.nombre}: la API dice ${porRevisar.length} por revisar y la tabla enseña ${pintados.length}`,
      ).toBe(
        porRevisar.length,
      )

      /*
        Las tres categorías de la cabecera tienen que sumar las que no tienen
        nota. Con dos —«esperando a la persona» y «esperando al equipo»— los
        `CALIFICANDO` no salían en ninguna: en una vacante real de 78 se perdían
        15 personas, y eran las que rindieron la prueba y siguen sin nota.
      */
      const sinNota = suyas.length - conNota.length
      const linea = (await lineaDeLaEtapa(page).innerText()) ?? ''
      if (sinNota > 0) {
        const cifras = [...linea.matchAll(/(\d+) (?:ya la hicieron|sin hacerla|en otra etapa)/g)]
        const suman = cifras.reduce((a, m) => a + Number(m[1]), 0)
        expect(suman, `${etapa.nombre}: las categorías suman ${suman} y no las ${sinNota} sin nota en «${linea.trim()}»`).toBe(sinNota)
      }

      // La cifra de la etapa NO puede ser la de la cola del currículum, que es de
      // donde salía «76 calificados» encima de una columna de guiones.
      expect(linea, `${etapa.nombre}: la cifra de arriba no es de la etapa`).toContain(`${conNota.length} de ${todas.length}`)

      if (etapa.nombre !== 'Perfil integral' && etapa.nombre !== 'Decisión') {
        const delCv = page.locator('p').filter({ hasText: /La criba del currículum/ }).first()
        await expect(delCv, `${etapa.nombre}: la línea del currículum no dice que no habla de esta etapa`).toContainText(
          'no de esta etapa',
        )
      }

      if (porRevisar.length === 0) {
        algunaVacia = true
        const dice = (await cuerpoDeLaTabla(page).textContent()) ?? ''
        expect(dice, `${etapa.nombre}: sin nadie que revisar, no lo dice ni nombra los escapes`).toMatch(
          /Nadie espera tu decisión[\s\S]*Toda la tanda/,
        )
        expect(dice, `${etapa.nombre}: lo confunde con «todavía no hay postulaciones»`).not.toContain(
          'Todavía no hay postulaciones',
        )
      }
    }
    if (!algunaVacia) {
      test.info().annotations.push({ type: 'aviso', description: 'ninguna etapa quedó sin nadie que revisar: esa copia no se ejercitó' })
    }
  })

  test('«Le toca al candidato» en Decisión enseña a los suyos, y quien terminó no se cuela', async ({ page }) => {
    test.skip(contexto.todas.length === 0, 'Sin postulaciones no hay nada que contrastar.')
    const todas = contexto.todas
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${contexto.vacanteId}`)
    await pestana(page, 'Decisión').click()
    await corte(page, 'Le toca al candidato').click()
    await expect(corte(page, 'Le toca al candidato')).toHaveAttribute('aria-pressed', 'true')

    const leToca = todas.filter((f) => f.estado === 'DECISION_TURNO_CANDIDATO')
    const terminadas = todas.filter((f) => etapaDe(f.estado) === null)
    await expect
      .poll(async () => (await nombresVisibles(page)).length, {
        message: `en Decisión debía enseñar a los ${leToca.length} que tienen algo pendiente`,
      })
      .toBe(leToca.length)
    const aqui = await nombresVisibles(page)
    const coladas = terminadas.filter((f) => aqui.includes(f.candidato))
    expect(coladas.map((f) => f.candidato), 'quien ya terminó se cuela en «le toca al candidato»').toEqual([])
  })

  test('el escape a la tanda entera trae a todos, incluidos los que terminaron, y cada guion dice por qué', async ({ page }) => {
    test.skip(contexto.todas.length === 0, 'Sin postulaciones no hay nada que contrastar.')
    const todas = contexto.todas
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${contexto.vacanteId}`)
    await pestana(page, 'Decisión').click()
    await corte(page, 'Toda la tanda').click()
    await expect(corte(page, 'Toda la tanda')).toHaveAttribute('aria-pressed', 'true')

    await expect
      .poll(async () => (await nombresVisibles(page)).length, { message: `pulsarlo debía traer las ${todas.length} de la tanda` })
      .toBe(todas.length)
    const conTodos = await nombresVisibles(page)

    const terminadas = todas.filter((f) => etapaDe(f.estado) === null)
    if (terminadas.length > 0) {
      expect(
        terminadas.every((f) => conTodos.includes(f.candidato)),
        `faltan los ${terminadas.length} que ya terminaron, que no están en ninguna etapa`,
      ).toBe(true)
    } else {
      test.info().annotations.push({
        type: 'aviso',
        description: 'nadie ha terminado su proceso en esta vacante: esa mitad no se ejercita',
      })
    }

    /*
      El porqué de cada guion. Un guion significaba cinco cosas y la más confusa
      era «el currículum está calificado y esta etapa no».
    */
    const cuerpo = (await cuerpoDeLaTabla(page).textContent()) ?? ''
    const motivos = [
      'Su proceso está en',
      'Terminó su proceso sin nota de esta etapa',
      'Le toca a la persona',
      'Ya la hizo: su nota se calcula en la ficha',
      'pendiente de que el equipo la cierre',
      'El equipo no la ha habilitado',
      'Sin nota de esta etapa',
    ].filter((m) => cuerpo.includes(m))
    test.info().annotations.push({ type: 'motivos', description: `${motivos.length} motivo(s) distintos en pantalla` })
    expect(motivos.length, 'ninguna fila sin nota explicaba su guion').toBeGreaterThan(0)

    // Que el corte sobreviva al cambio de pestaña ya lo cubre `01-regresion-panel`
    // («cambiar de pestaña con filtros puestos los limpia, pero el corte se
    // conserva»): no se repite aquí.
  })

  test('sin errores de página en todo el recorrido', () => {
    expect(contexto.erroresDePagina, contexto.erroresDePagina.join(' · ')).toEqual([])
  })
})
