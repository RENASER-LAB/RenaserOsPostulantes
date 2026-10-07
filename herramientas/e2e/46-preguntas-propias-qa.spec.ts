import { expect, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { crearCuentaDeCandidato, test } from './ayuda-candidato'
import { correoDePrueba, limpiarSiempre, literal, sql } from './base-de-datos'
import {
  consultar,
  crearVacante,
  cuentaDeCandidato,
  editorDe,
  elegirLaPruebaDelPuesto,
  entrarAlPanelCon,
  escribirBorrador,
  exigir,
  lugarDeLaPlataforma,
  MARCA,
  nadaLoTapa,
  pedir,
  postular,
  publicarPreguntas,
  retirarLoSembrado,
  RUTA,
  sembrarEmpresaB,
  sembrarEquipoSin,
  sembrarVacanteDeAntes,
  titulo,
  tokenConClave,
  tokenDePanel,
  vacanteDe,
  type CriterioNuevo,
  type EmpresaB,
} from './ayuda-preguntas-propias'

/**
 * QA de las preguntas propias de la vacante (V66, fase 1): el origen de las
 * preguntas, el editor, la copia entre vacantes y los permisos.
 *
 * Criterios: AC-01, AC-01b, AC-01c, AC-01d, AC-02, AC-03, AC-04, AC-05, AC-15,
 * AC-15b, AC-15c, AC-15d y AC-20. Las pruebas «QA-PP-0n» son regresiones de
 * hallazgos de la exploración con navegador.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo: vacantes con la marca `QA-PP-0553`, una
 * empresa B, cuentas de panel acotadas. `afterAll` lo retira todo.
 */

const correos: string[] = []
let equipo = ''
let ejecucion = { areaId: 0, puestoId: 0 }
let supervision = { areaId: 0, puestoId: 0 }

/** Lo mínimo publicable: un criterio con una abierta de 60 y una cerrada de 40. */
const PRUEBA_BASE = (nombre: string): CriterioNuevo[] => [
  {
    nombre,
    queEvalua: 'Domina el registro y el cierre mensual.',
    preguntas: [
      {
        tipo: 'ABIERTA',
        enunciado: `${nombre}: cuéntanos un cierre con un descuadre.`,
        puntos: 60,
        queDebeTener: 'El monto, la cuenta y en cuántos días lo cerró.',
      },
      {
        tipo: 'OPCION_UNICA',
        enunciado: `${nombre}: ¿qué libro registra primero una venta al crédito?`,
        puntos: 40,
        opciones: [
          { texto: 'Libro diario', puntos: 40 },
          { texto: 'Libro mayor', puntos: 0 },
        ],
      },
    ],
  },
]

async function vacanteConPreguntasPublicadas(nombre: string, lugar = ejecucion, guia?: string): Promise<number> {
  const id = await crearVacante(equipo, nombre, lugar)
  await exigir(`/panel/vacantes/${id}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
  await escribirBorrador(equipo, id, PRUEBA_BASE(nombre), guia ?? `Guía de ${nombre}`)
  await publicarPreguntas(equipo, id)
  return id
}

async function abrirConfiguracion(page: Page, id: number, nombre: string) {
  await page.goto(`/admin/vacantes/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: titulo(nombre) })).toBeVisible({ timeout: 20_000 })
  const grupo = page.getByRole('group', { name: 'Las preguntas del Perfil Integral' })
  if (!(await grupo.isVisible())) await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
  await expect(grupo).toBeVisible({ timeout: 15_000 })
  return grupo
}

const criterio = (page: Page, nombre: string) => page.getByRole('region', { name: `Criterio ${nombre}` })
const balance = (page: Page) => page.getByRole('region', { name: 'Balance de las preguntas' })

test.beforeAll(async () => {
  equipo = await tokenDePanel()
  ejecucion = await lugarDeLaPlataforma(equipo, 'EJECUCION')
  supervision = await lugarDeLaPlataforma(equipo, 'SUPERVISION')
})

test.afterAll(async () => {
  await limpiarSiempre([() => retirarLoSembrado(correos)])
})

test.describe('El origen de las preguntas', () => {
  test('AC-02 · las vacantes de antes siguen con el banco de su nivel', async () => {
    // Las que existían al aplicar la V66 en este clon: las de la siembra.
    const deAntes = consultar(`select v.id from vacante v
       where v.eliminada_en is null and v.aplica_evaluacion
         and v.creado_en < (select installed_on from flyway_schema_history where version = '66')`)
    expect(deAntes.length).toBeGreaterThan(0)
    for (const v of deAntes) {
      const d = await vacanteDe(equipo, Number(v.id))
      expect.soft(d.origenPreguntas, `vacante ${v.id}`).toBe('NIVEL')
      expect.soft(d.bancoPrestado, `vacante ${v.id}`).toBe(false)
    }
  })

  // Decisión del 30/09/2026: toda vacante nueva nace con sus preguntas propias, también
  // en una empresa con banco propio publicado para el nivel. El banco sigue ofreciéndose.
  test('AC-01b · una vacante nueva de RENASER nace con sus preguntas propias y sigue ofreciendo su banco', async ({ page }) => {
    const nombre = 'Origen RENASER'
    const id = await crearVacante(equipo, nombre, ejecucion)
    const v = await vacanteDe(equipo, id)
    expect(v.origenPreguntas).toBe('VACANTE')
    expect(v.aplicaEvaluacion).toBe(true)
    expect(v.bancoDelNivelPropio).toBe(true)
    expect(v.bancoPrestado).toBe(false)

    await entrarAlPanel(page)
    const grupo = await abrirConfiguracion(page, id, nombre)
    await expect(grupo.getByRole('radio')).toHaveCount(3)
    await expect(grupo.getByRole('radio').first()).toHaveAccessibleName('Preguntas propias de esta vacante')
    await expect(grupo.getByRole('radio', { name: 'Preguntas propias de esta vacante' })).toBeChecked()
    await expect(grupo.getByRole('radio', { name: 'El banco de la empresa para su nivel' })).not.toBeChecked()
    await expect(grupo.getByRole('radio', { name: 'Sin evaluación' })).not.toBeChecked()
    await expect(grupo.getByText(/Sin preguntas/)).toBeVisible({ timeout: 15_000 })
    await expect(grupo.getByRole('link', { name: 'Escribir las preguntas →' })).toBeVisible()

    await grupo.getByText('El banco de la empresa para su nivel').click()
    await expect(grupo.getByRole('radio', { name: 'El banco de la empresa para su nivel' })).toBeChecked({ timeout: 15_000 })
    // Lo confirma el servidor: la vacante vuelve con el banco y la línea que lo nombra aparece
    await expect(grupo.getByText(/^Qué evaluación responderá/)).toBeVisible({ timeout: 15_000 })
    expect((await vacanteDe(equipo, id)).origenPreguntas).toBe('NIVEL')
  })

  /*
   * QA-PP-10 (exploración del ciclo 3). En un grupo de radios las flechas son la forma de
   * elegir con el teclado: cada flecha marca la siguiente y la guarda. Los radios se
   * deshabilitaban mientras el servidor confirmaba, y un control enfocado que se
   * deshabilita suelta el foco al <body>: tras la primera flecha el anillo desaparecía y la
   * segunda ya no llegaba a la tercera opción.
   */
  test('QA-PP-10 · con el teclado, cambiar de opción con las flechas no saca el foco del grupo', async ({ page }) => {
    const nombre = 'Origen con teclado'
    const id = await crearVacante(equipo, nombre, ejecucion)

    await entrarAlPanel(page)
    const grupo = await abrirConfiguracion(page, id, nombre)
    const propias = grupo.getByRole('radio', { name: 'Preguntas propias de esta vacante' })
    const delNivel = grupo.getByRole('radio', { name: 'El banco de la empresa para su nivel' })
    const sinEvaluacion = grupo.getByRole('radio', { name: 'Sin evaluación' })
    await expect(propias).toBeChecked()
    await propias.focus()

    await page.keyboard.press('ArrowDown')
    await expect(delNivel).toBeChecked({ timeout: 15_000 })
    await expect.poll(async () => (await vacanteDe(equipo, id)).origenPreguntas, { timeout: 15_000 }).toBe('NIVEL')
    await expect(grupo.getByText(/^Qué evaluación responderá/)).toBeVisible({ timeout: 15_000 })
    await expect(delNivel).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(sinEvaluacion).toBeChecked({ timeout: 15_000 })
    await expect.poll(async () => (await vacanteDe(equipo, id)).aplicaEvaluacion, { timeout: 15_000 }).toBe(false)
    await expect(sinEvaluacion).toBeFocused()
  })

  /*
   * QA-PP-11 (exploración del ciclo 4). La columna «Evaluación» de la lista dice de dónde
   * salen las preguntas y, con las propias, en qué punto están. La celda es texto corrido y,
   * cuando no cabe en una línea, se partía por cualquier espacio: «Sin preguntas» quedaba
   * «Preguntas propias · Sin» / «preguntas» (en la lista de RENASER ya a 1440 y 1280 px con
   * el menú abierto, y de 1024 a 375 px en cualquier lista). El estado se lee entero, se
   * parta la celda por donde se parta; y a 375 px la tabla se desplaza dentro de su caja,
   * no la página.
   */
  test('QA-PP-11 · la lista dice de dónde salen las preguntas y no parte su estado en dos líneas', async ({ page }) => {
    const sinPreguntas = 'Lista sin preguntas'
    const enBorrador = 'Lista en borrador'
    const delNivel = 'Lista del nivel'
    const apagada = 'Lista sin evaluación'
    await crearVacante(equipo, sinPreguntas, ejecucion)
    const borrador = await crearVacante(equipo, enBorrador, ejecucion)
    await escribirBorrador(equipo, borrador, [
      {
        nombre: 'Caja',
        queEvalua: 'Cuadra la caja.',
        preguntas: [{ tipo: 'ABIERTA', enunciado: 'Cuéntanos un arqueo que no cuadró.', puntos: 30, queDebeTener: 'El monto y la causa.' }],
      },
    ])
    const nivel = await crearVacante(equipo, delNivel, ejecucion)
    await exigir(`/panel/vacantes/${nivel}/origen-preguntas`, equipo, 'POST', { origen: 'NIVEL' })
    const sinEval = await crearVacante(equipo, apagada, ejecucion)
    await exigir(`/panel/vacantes/${sinEval}/origen-preguntas`, equipo, 'POST', { origen: 'SIN_EVALUACION' })

    await entrarAlPanel(page)
    await page.goto('/admin')
    await expect(page.getByRole('cell', { name: titulo(sinPreguntas), exact: true })).toBeVisible({ timeout: 20_000 })
    const cabeceras = await page.getByRole('columnheader').allTextContents()
    const columna = cabeceras.findIndex((c) => c.trim() === 'Evaluación')
    expect(columna, `cabeceras: ${cabeceras.join(' | ')}`).toBeGreaterThanOrEqual(0)
    const celda = (nombre: string) =>
      page
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: titulo(nombre), exact: true }) })
        .getByRole('cell')
        .nth(columna)

    // Lo que dice, con los nombres de la configuración de la vacante
    await expect(celda(sinPreguntas)).toHaveText(/^Preguntas propias\s*·?\s*Sin preguntas$/)
    await expect(celda(enBorrador)).toHaveText(/^Preguntas propias\s*·?\s*Borrador$/)
    await expect(celda(delNivel)).toHaveText('Banco de la empresa por nivel')
    await expect(celda(apagada)).toHaveText('Sin evaluación')

    /** En cuántas líneas se pinta `trozo` dentro de la celda (cada letra, por su renglón). */
    const lineasDe = (nombre: string, trozo: string) =>
      celda(nombre).evaluate((td, buscado) => {
        const letras: { c: string; top: number | null }[] = []
        const recorrido = document.createTreeWalker(td, NodeFilter.SHOW_TEXT)
        for (let n = recorrido.nextNode() as Text | null; n; n = recorrido.nextNode() as Text | null) {
          for (let i = 0; i < n.length; i++) {
            const r = document.createRange()
            r.setStart(n, i)
            r.setEnd(n, i + 1)
            const caja = r.getClientRects()[0]
            letras.push({ c: n.data[i]!, top: caja && caja.width > 0 ? Math.round(caja.top) : null })
          }
        }
        const texto = letras.map((l) => l.c).join('').replace(/\s/g, ' ')
        const desde = texto.indexOf(buscado)
        if (desde < 0) return -1
        const renglones = new Set(
          letras
            .slice(desde, desde + buscado.length)
            .filter((l) => l.c.trim() !== '' && l.top !== null)
            .map((l) => l.top),
        )
        return renglones.size
      }, trozo)

    for (const ancho of [1440, 1280, 1024, 800, 375]) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await expect
        .poll(() => lineasDe(sinPreguntas, 'Sin preguntas'), { message: `«Sin preguntas» a ${ancho} px` })
        .toBe(1)
      expect(await lineasDe(enBorrador, 'Borrador'), `«Borrador» a ${ancho} px`).toBe(1)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `a ${ancho} px la página no se desplaza en horizontal`,
      ).toBe(true)
    }
  })
})

test.describe('Una empresa sin banco propio', () => {
  test.describe.configure({ mode: 'serial' })

  let b: EmpresaB
  let tokenB = ''
  let vacanteB = 0
  let vacanteA = 0

  test.beforeAll(async () => {
    const correo = correoDePrueba('qa.pp.0553.clave')
    correos.push(correo)
    await crearCuentaDeCandidato({ nombre: 'Clave', apellidos: 'Preguntas QA', correo })
    b = sembrarEmpresaB(correo)
    tokenB = await tokenConClave(b.correo)
    vacanteA = await vacanteConPreguntasPublicadas('Origen para copiar A')
  })

  test('AC-01 · su vacante nueva nace con preguntas propias y el servidor no acepta el banco del nivel', async ({ page }) => {
    vacanteB = await crearVacante(tokenB, 'Vacante de B', { areaId: b.areaId, puestoId: b.puestoId }, b.usuario)
    const v = await vacanteDe(tokenB, vacanteB)
    expect(v.aplicaEvaluacion).toBe(true)
    expect(v.origenPreguntas).toBe('VACANTE')
    expect(v.bancoDelNivelPropio).toBe(false)
    expect(v.bancoPrestado).toBe(false)

    const nivel = await pedir(`/panel/vacantes/${vacanteB}/origen-preguntas`, tokenB, 'POST', { origen: 'NIVEL' })
    expect(nivel.estado).toBe(400)
    expect((await vacanteDe(tokenB, vacanteB)).origenPreguntas).toBe('VACANTE')

    await entrarAlPanelCon(page, tokenB)
    const grupo = await abrirConfiguracion(page, vacanteB, 'Vacante de B')
    await expect(grupo.getByRole('radio')).toHaveCount(2)
    await expect(grupo.getByRole('radio', { name: 'Preguntas propias de esta vacante' })).toBeChecked()
    await expect(grupo.getByRole('radio', { name: 'Sin evaluación' })).toBeVisible()
    await expect(grupo.getByText(/banco/i)).toHaveCount(0)

    await page.goto('/admin/configuracion')
    await expect(
      page.getByText('Tu empresa no tiene banco por nivel: las preguntas se escriben en cada vacante', { exact: false }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Banco RENASER/)).toHaveCount(0)
  })

  test('AC-01d · ni ella ni la plataforma le copian el banco; los pesos sí se personalizan', async () => {
    // V67 (decisión 13, AC-26): personalizar el banco o las pruebas ya no existe. Encenderlo
    // o apagarlo, lo pida ella o la plataforma, contesta 400 y no copia ni cambia nada.
    const YA_NO_EXISTE = 'Esta personalización ya no existe'
    const motivo = { motivo: `${MARCA}: la empresa lo pidió por teléfono` }
    for (const instrumento of ['BANCO', 'PRUEBA']) {
      const porElla = await pedir('/panel/organizacion/personalizacion', tokenB, 'POST', { instrumento })
      expect(porElla.estado).toBe(400)
      expect(porElla.cuerpo.detail).toContain(YA_NO_EXISTE)
      expect((await pedir(`/panel/organizacion/personalizacion/${instrumento}`, tokenB, 'DELETE')).estado).toBe(400)
      const porLaPlataforma = await pedir(
        `/panel/plataforma/empresas/${b.id}/personalizacion/${instrumento}`, equipo, 'POST', motivo)
      expect(porLaPlataforma.estado).toBe(400)
      expect(porLaPlataforma.cuerpo.detail).toContain(YA_NO_EXISTE)
      expect((await pedir(`/panel/plataforma/empresas/${b.id}/personalizacion/${instrumento}`, equipo, 'DELETE', motivo)).estado)
        .toBe(400)
    }
    expect((await exigir('/panel/organizacion/personalizacion', tokenB)).bancoPropio).toBe(false)
    expect(Number(consultar(`select count(*) as n from version_banco where organizacion_id = ${b.id} and vacante_id is null`)[0]!.n)).toBe(0)

    await exigir(`/panel/plataforma/empresas/${b.id}/personalizacion/PESOS`, equipo, 'POST', motivo)
    expect((await exigir('/panel/organizacion/personalizacion', tokenB)).pesosPropios).toBe(true)
    await exigir(`/panel/plataforma/empresas/${b.id}/personalizacion/PESOS`, equipo, 'DELETE', motivo)
    expect((await exigir('/panel/organizacion/personalizacion', tokenB)).pesosPropios).toBe(false)
  })

  test('AC-15 · copiar o ver las preguntas de otra empresa es 404 y no crea nada', async () => {
    const copiables = await exigir<any[]>(`${RUTA(vacanteB)}/copiables`, tokenB)
    expect(copiables.map((c) => c.vacanteId)).not.toContain(vacanteA)
    expect((await pedir(`${RUTA(vacanteB)}/copiables/${vacanteA}`, tokenB)).estado).toBe(404)
    expect((await pedir(`${RUTA(vacanteB)}/copia`, tokenB, 'POST', { vacanteOrigenId: vacanteA })).estado).toBe(404)
    expect((await editorDe(tokenB, vacanteB)).borrador).toBeNull()
    expect((await pedir(RUTA(vacanteA), tokenB)).estado).toBe(404)
    // Y al revés: la plataforma tampoco copia lo de B.
    await escribirBorrador(tokenB, vacanteB, PRUEBA_BASE('Prueba de B'))
    await publicarPreguntas(tokenB, vacanteB)
    expect((await pedir(`${RUTA(vacanteA)}/copiables/${vacanteB}`, equipo)).estado).toBe(404)
  })

  test('AC-01c · la vacante de antes con el banco prestado lo llama por su nombre y, si se cambia, no vuelve', async ({ page }) => {
    const nombre = 'Vacante de antes con el banco prestado'
    const id = sembrarVacanteDeAntes(b, nombre, true)
    const antes = await vacanteDe(tokenB, id)
    expect(antes.origenPreguntas).toBe('NIVEL')
    expect(antes.bancoPrestado).toBe(true)

    await entrarAlPanelCon(page, tokenB)
    const grupo = await abrirConfiguracion(page, id, nombre)
    await expect(grupo.getByRole('radio', { name: 'El banco de RENASER para su nivel' })).toBeChecked()
    await expect(grupo.getByRole('radio', { name: 'El banco de la empresa para su nivel' })).toHaveCount(0)
    await expect(grupo.getByText(/sigue rindiendo el banco de RENASER/)).toBeVisible()

    await grupo.getByText('Preguntas propias de esta vacante').click()
    await expect(grupo.getByRole('radio', { name: 'Preguntas propias de esta vacante' })).toBeChecked({ timeout: 15_000 })
    await page.reload()
    const otraVez = await abrirConfiguracion(page, id, nombre)
    await expect(otraVez.getByRole('radio')).toHaveCount(2)
    await expect(otraVez.getByText(/banco/i)).toHaveCount(0)
    expect((await pedir(`/panel/vacantes/${id}/origen-preguntas`, tokenB, 'POST', { origen: 'NIVEL' })).estado).toBe(400)
  })

  test('QA-PP-04 · el interruptor heredado de la evaluación no devuelve el banco prestado', async () => {
    // Apagar y encender por el endpoint de antes (que el panel ya no usa) no puede
    // traer de vuelta el banco de RENASER: «si se cambia de opción, ya no se puede
    // volver a elegir» (AC-01c), y el servidor no guarda el origen NIVEL (AC-01).
    const prestada = sembrarVacanteDeAntes(b, 'Prestada que se apaga y se enciende', true)
    await exigir(`/panel/vacantes/${prestada}/aplicacion-evaluacion`, tokenB, 'POST', { aplica: false })
    await pedir(`/panel/vacantes/${prestada}/aplicacion-evaluacion`, tokenB, 'POST', { aplica: true })
    expect((await vacanteDe(tokenB, prestada)).bancoPrestado).not.toBe(true)

    // Una vacante de antes con la evaluación apagada tampoco estrena el banco prestado.
    const apagada = sembrarVacanteDeAntes(b, 'De antes sin evaluación', false)
    await pedir(`/panel/vacantes/${apagada}/aplicacion-evaluacion`, tokenB, 'POST', { aplica: true })
    expect((await vacanteDe(tokenB, apagada)).bancoPrestado).not.toBe(true)
  })

  test('QA-PP-08 · con postulantes, el interruptor heredado no cambia de dónde salen las preguntas', async () => {
    // Desde la primera postulación el origen no se mueve (AC-16): todos los candidatos
    // se miden con la misma vara. Apagar y encender por el endpoint de antes no puede
    // dejar a una vacante con gente dentro sin el banco con el que ya se midieron.
    const prestada = sembrarVacanteDeAntes(b, 'Prestada con postulantes', true)
    await elegirLaPruebaDelPuesto(tokenB, prestada)
    const publicacion = await pedir(`/panel/vacantes/${prestada}/publicacion`, tokenB, 'POST', {})
    expect(publicacion.estado, JSON.stringify(publicacion.cuerpo)).toBeLessThan(300)
    const candidata = await cuentaDeCandidato('Postulante prestada', correos)
    await postular(candidata.token, prestada)
    const antes = await vacanteDe(tokenB, prestada)
    expect(antes.origenPreguntas).toBe('NIVEL')
    expect(antes.bancoPrestado).toBe(true)

    // Por el endpoint nuevo, con postulantes, cambiar el origen es 409.
    expect((await pedir(`/panel/vacantes/${prestada}/origen-preguntas`, tokenB, 'POST', { origen: 'SIN_EVALUACION' })).estado).toBe(409)

    // Por el de antes: o se rechaza, o se apaga sin tocar el origen; en los dos casos, al
    // volver a encender rinde el mismo banco que ya rindieron sus candidatos.
    const apagar = await pedir(`/panel/vacantes/${prestada}/aplicacion-evaluacion`, tokenB, 'POST', { aplica: false })
    const trasApagar = (await vacanteDe(tokenB, prestada)).origenPreguntas
    const encender = await pedir(`/panel/vacantes/${prestada}/aplicacion-evaluacion`, tokenB, 'POST', { aplica: true })
    const despues = await vacanteDe(tokenB, prestada)
    const rastro = JSON.stringify({
      apagar: apagar.estado,
      trasApagar,
      encender: encender.estado,
      respuestaAlEncender: encender.cuerpo?.detail ?? null,
      final: { aplica: despues.aplicaEvaluacion, origen: despues.origenPreguntas, prestado: despues.bancoPrestado },
    })
    expect(trasApagar, rastro).toBe('NIVEL')
    expect(despues.aplicaEvaluacion, rastro).toBe(true)
    expect(despues.origenPreguntas, rastro).toBe('NIVEL')
    expect(despues.bancoPrestado, rastro).toBe(true)
  })
})

test.describe('El editor, agrupado por criterios', () => {
  test.describe.configure({ mode: 'serial' })

  const nombre = 'Editor de punta a punta'
  let id = 0

  test.beforeAll(async () => {
    id = await crearVacante(equipo, nombre, ejecucion)
    await exigir(`/panel/vacantes/${id}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
  })

  test('AC-03/AC-04 · «General» aparece solo, y el balance cuadra con el servidor en los cuatro tipos', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${id}/preguntas`)
    await expect(page.getByText('Todavía no hay preguntas')).toBeVisible({ timeout: 20_000 })

    // Una pregunta sin criterios crea «General».
    await page.getByRole('button', { name: 'Agregar pregunta' }).click()
    await page.getByLabel('Enunciado').fill('Cuéntanos un cierre con un descuadre. ¿Cómo lo hallaste?')
    await page.getByLabel('Puntos', { exact: true }).fill('20')
    await page.getByRole('button', { name: 'Agregar la pregunta' }).click()
    await expect(criterio(page, 'General')).toBeVisible({ timeout: 20_000 })

    // Un segundo criterio con una cerrada de cada tipo.
    await page.getByRole('button', { name: 'Agregar criterio' }).click()
    await page.getByLabel('Nombre del criterio').fill('Conocimiento contable')
    await page.getByRole('button', { name: 'Agregar el criterio' }).click()
    const conocimiento = criterio(page, 'Conocimiento contable')
    await expect(conocimiento).toBeVisible({ timeout: 20_000 })

    const nueva = async () => {
      await conocimiento.getByRole('button', { name: 'Agregar pregunta' }).click()
      return page.getByRole('form', { name: 'Pregunta nueva' })
    }
    let f = await nueva()
    await f.getByLabel('Tipo').selectOption('Opción única')
    await f.getByLabel('Enunciado').fill('¿Qué libro registra primero una venta al crédito?')
    await f.getByLabel('Puntos', { exact: true }).fill('10')
    await f.getByRole('textbox', { name: 'Opción 1' }).fill('Libro diario')
    await f.getByRole('spinbutton', { name: 'Puntos de la opción 1' }).fill('10')
    await f.getByRole('textbox', { name: 'Opción 2' }).fill('Libro mayor')
    await f.getByRole('button', { name: 'Agregar la pregunta' }).click()
    await expect(conocimiento.getByText('¿Qué libro registra primero una venta al crédito?')).toBeVisible({ timeout: 20_000 })

    f = await nueva()
    await f.getByLabel('Tipo').selectOption('Opción múltiple')
    await f.getByLabel('Enunciado').fill('¿Qué documentos sustentan una compra al crédito?')
    await f.getByLabel('Puntos', { exact: true }).fill('10')
    await f.getByRole('button', { name: 'Agregar opción' }).click()
    const multiple: [string, string][] = [['Factura', '6'], ['Guía de remisión', '6'], ['Boleta personal', '-4']]
    for (const [i, [texto, puntos]] of multiple.entries()) {
      await f.getByRole('textbox', { name: `Opción ${i + 1}` }).fill(texto)
      await f.getByRole('spinbutton', { name: `Puntos de la opción ${i + 1}` }).fill(puntos)
    }
    await f.getByRole('button', { name: 'Agregar la pregunta' }).click()
    await expect(conocimiento.getByText('¿Qué documentos sustentan una compra al crédito?')).toBeVisible({ timeout: 20_000 })

    f = await nueva()
    await f.getByLabel('Tipo').selectOption('Escala')
    await f.getByLabel('Enunciado').fill('¿Cuánto dominas las conciliaciones bancarias?')
    await f.getByLabel('Puntos', { exact: true }).fill('10')
    while ((await f.getByRole('spinbutton', { name: /^Puntos de(l| el) nivel \d+$/ }).count()) < 10) {
      await f.getByRole('button', { name: 'Agregar nivel' }).click()
    }
    await expect(f.getByRole('button', { name: 'Agregar nivel' })).toHaveCount(0)
    for (let n = 1; n <= 10; n++) {
      await f.getByRole('spinbutton', { name: new RegExp(`^Puntos de(l| el) nivel ${n}$`) }).fill(String(n))
    }
    await f.getByRole('button', { name: 'Agregar la pregunta' }).click()
    await expect(conocimiento.getByText('¿Cuánto dominas las conciliaciones bancarias?')).toBeVisible({ timeout: 20_000 })

    // Cambiar puntos: la abierta pasa de 20 a 25.
    const general = criterio(page, 'General')
    await general.getByRole('button', { name: 'Editar la pregunta' }).click()
    await general.getByLabel('Puntos', { exact: true }).fill('25')
    await general.getByRole('button', { name: 'Guardar la pregunta' }).click()
    await expect(general.getByText('25 pts', { exact: true }).first()).toBeVisible({ timeout: 20_000 })

    // Tras refrescar, lo pintado es lo del servidor.
    await page.reload()
    await expect(balance(page)).toBeVisible({ timeout: 20_000 })
    const servidor = (await editorDe(equipo, id)).borrador
    expect(servidor.total).toBe(55)
    await expect(balance(page)).toContainText(`${servidor.total} de 100 puntos`)
    await expect(balance(page)).toContainText(`${servidor.cuantosCriterios} criterios`)
    await expect(balance(page)).toContainText(`${servidor.cuantasPreguntas} preguntas`)
    for (const c of servidor.criterios) {
      await expect(criterio(page, c.nombre).getByText(new RegExp(`^${c.puntos} pts`)).first()).toBeVisible()
    }
    expect(servidor.criterios.find((c: any) => c.nombre === 'Conocimiento contable').puntos).toBe(30)
    expect(servidor.criterios.find((c: any) => c.nombre === 'General').puntos).toBe(25)
  })

  test('AC-05 · con 95, un criterio vacío y una clave sin máximo, cada falta se ve en su sitio y publicar no publica', async ({ page }) => {
    // Hasta 95: una cerrada de 40 cuya mejor opción da 30 (no llega al máximo).
    const editor = await exigir(`${RUTA(id)}/criterios`, equipo, 'POST', { nombre: 'Tributación' })
    const tributacion = editor.borrador.criterios.find((c: any) => c.nombre === 'Tributación').id
    await exigir(`${RUTA(id)}/preguntas`, equipo, 'POST', {
      tipo: 'OPCION_UNICA',
      enunciado: '¿Cuál es la tasa general del IGV en el Perú?',
      puntos: 40,
      criterioId: tributacion,
      opciones: [{ texto: '18 %', puntos: 30 }, { texto: '19 %', puntos: 0 }],
    })
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${id}/preguntas`)
    await page.getByRole('button', { name: 'Agregar criterio' }).click()
    await page.getByLabel('Nombre del criterio').fill('Manejo de Excel')
    await page.getByRole('button', { name: 'Agregar el criterio' }).click()
    await expect(criterio(page, 'Manejo de Excel').getByText('El criterio «Manejo de Excel» no tiene preguntas.')).toBeVisible({ timeout: 20_000 })
    await expect(balance(page)).toContainText('95 de 100 puntos')
    // Las tres, cada una en su sitio: el total, el criterio vacío y la tarjeta de la clave.
    await expect(balance(page)).toContainText('Los puntos suman 95 de 100: faltan 5.')
    await expect(
      page.getByRole('article', { name: 'Pregunta: ¿Cuál es la tasa general del IGV en el Perú?' })
        .getByRole('list', { name: 'Lo que le falta para publicar' }),
    ).toContainText('Alguna opción tiene que dar los 40 puntos de la pregunta.')
    await expect(balance(page).getByRole('button', { name: '3 por arreglar' })).toBeVisible()

    // «Publicar» no publica: lleva a la primera, la de los puntos.
    await page.getByRole('button', { name: 'Publicar las preguntas' }).click()
    await expect(page.locator('#criterios-y-preguntas')).toBeFocused()
    await expect(page.getByText(/^Publicadas./)).toHaveCount(0)

    const directo = await pedir(`${RUTA(id)}/publicacion`, equipo, 'POST')
    expect(directo.estado).toBe(400)
    expect(directo.cuerpo.faltas).toHaveLength(3)
    const servidor = await editorDe(equipo, id)
    expect(servidor.publicada).toBeNull()
    expect(servidor.borrador.estado).toBe('BORRADOR')
  })

  test('AC-17 · la vacante no se publica sin sus preguntas publicadas', async ({ page }) => {
    // Todo lo demás listo (la prueba del puesto elegida): solo faltan sus preguntas publicadas.
    await elegirLaPruebaDelPuesto(equipo, id)
    const r = await pedir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST', {})
    expect(r.estado).toBe(409)
    expect(JSON.stringify(r.cuerpo)).toContain('preguntas propias')
    expect((await vacanteDe(equipo, id)).estado).toBe('BORRADOR')
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: titulo(nombre) })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Publicar en el portal' })).toBeDisabled()
    await expect(page.getByText(/Todo listo/)).toHaveCount(0)
  })
})

test.describe('Copiar de otra vacante', () => {
  test.describe.configure({ mode: 'serial' })

  let activa = 0
  let archivada = 0
  let eliminada = 0
  let deSupervision = 0
  let destino = 0

  test.beforeAll(async () => {
    activa = await vacanteConPreguntasPublicadas('Copiable activa')
    archivada = await vacanteConPreguntasPublicadas('Copiable archivada', ejecucion, 'Guía de la archivada')
    eliminada = await vacanteConPreguntasPublicadas('Copiable eliminada')
    deSupervision = await vacanteConPreguntasPublicadas('Copiable de supervisión', supervision)
    sql(`update vacante set estado = 'CERRADA', archivada_en = now() where id = ${archivada};
         update vacante set eliminada_en = now() where id = ${eliminada};`)
    destino = await crearVacante(equipo, 'Destino de la copia', ejecucion)
    await exigir(`/panel/vacantes/${destino}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    await exigir(`${RUTA(destino)}/criterios`, equipo, 'POST', { nombre: 'Criterio que se reemplaza' })
  })

  test('AC-15b/AC-15c · se ofrecen la activa y la archivada, se ven sin copiar y la copia es independiente', async ({ page }) => {
    const lista = await exigir<any[]>(`${RUTA(destino)}/copiables?buscar=${encodeURIComponent('Copiable')}`, equipo)
    const ids = lista.map((c) => c.vacanteId)
    expect(ids).toContain(activa)
    expect(ids).toContain(archivada)
    expect(ids).not.toContain(eliminada)
    const deLaArchivada = lista.find((c) => c.vacanteId === archivada)
    expect(deLaArchivada).toMatchObject({ estado: 'ARCHIVADA', criterios: 1, preguntas: 2 })
    expect(lista.find((c) => c.vacanteId === activa)).toMatchObject({ estado: 'ACTIVA', criterios: 1, preguntas: 2 })

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${destino}/preguntas`)
    await expect(criterio(page, 'Criterio que se reemplaza')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar de otra vacante' })
    await dialogo.getByRole('searchbox', { name: 'Buscar por nombre' }).fill(`${MARCA} Copiable`)
    const opcion = (t: string) => dialogo.getByRole('button', { name: new RegExp(`^${MARCA} ${t}`) })
    await expect(opcion('Copiable activa')).toBeVisible({ timeout: 20_000 })
    await expect(opcion('Copiable archivada')).toContainText(/archivada · .*1 crit · 2 preg/)
    await expect(opcion('Copiable archivada')).toContainText('1 crit · 2 preg')
    await expect(opcion('Copiable eliminada')).toHaveCount(0)
    await expect(dialogo.getByText('Elige una vacante para ver sus preguntas.')).toBeVisible()

    // La vista previa, en solo lectura: el borrador no cambia hasta copiar.
    await opcion('Copiable archivada').click()
    await expect(dialogo.getByText('Guía de la archivada').last()).toBeVisible({ timeout: 20_000 })
    // Sus criterios salen plegados: se despliegan para leer sus preguntas.
    await dialogo.getByRole('button', { name: 'Desplegar todo' }).last().click()
    await expect(dialogo.getByText('Copiable archivada: cuéntanos un cierre con un descuadre.').last()).toBeVisible()
    expect((await editorDe(equipo, destino)).borrador.criterios.map((c: any) => c.nombre)).toEqual(['Criterio que se reemplaza'])

    await dialogo.getByRole('button', { name: 'Copiar esta prueba' }).click()
    await dialogo.getByRole('button', { name: 'Reemplazar el borrador' }).click()
    await expect(dialogo).toBeHidden({ timeout: 20_000 })
    await expect(criterio(page, 'Copiable archivada')).toBeVisible({ timeout: 20_000 })
    await expect(criterio(page, 'Criterio que se reemplaza')).toHaveCount(0)

    // Cambiar la copia no toca la archivada.
    const copia = (await editorDe(equipo, destino)).borrador
    expect(copia.guiaCalificacion).toBe('Guía de la archivada')
    const abierta = copia.criterios[0].preguntas.find((p: any) => p.tipo === 'ABIERTA')
    await exigir(`${RUTA(destino)}/preguntas/${abierta.id}`, equipo, 'PUT', {
      tipo: 'ABIERTA', enunciado: 'Enunciado cambiado en la copia', puntos: 60, criterioId: abierta.criterioId,
    })
    const original = (await editorDe(equipo, archivada)).publicada
    expect(original.criterios[0].preguntas.map((p: any) => p.enunciado)).toContain(
      'Copiable archivada: cuéntanos un cierre con un descuadre.',
    )
    expect(JSON.stringify(original)).not.toContain('Enunciado cambiado en la copia')
  })

  test('AC-15d · el filtro por nivel ayuda a encontrar, y se copia de otro nivel', async ({ page }) => {
    const ejecucionSolo = await exigir<any[]>(`${RUTA(destino)}/copiables?nivel=EJECUCION&buscar=${encodeURIComponent(MARCA)}`, equipo)
    expect(ejecucionSolo.map((c) => c.vacanteId)).toContain(activa)
    expect(ejecucionSolo.map((c) => c.vacanteId)).not.toContain(deSupervision)

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${destino}/preguntas`)
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar de otra vacante' })
    await dialogo.getByRole('searchbox', { name: 'Buscar por nombre' }).fill(`${MARCA} Copiable`)
    await expect(dialogo.getByRole('button', { name: new RegExp(`^${MARCA} Copiable de supervisión`) })).toBeVisible({ timeout: 20_000 })
    await dialogo.getByRole('combobox', { name: 'Filtrar por nivel' }).selectOption({ label: 'Ejecución' })
    await expect(dialogo.getByRole('button', { name: new RegExp(`^${MARCA} Copiable de supervisión`) })).toHaveCount(0, { timeout: 20_000 })
    await expect(dialogo.getByRole('button', { name: new RegExp(`^${MARCA} Copiable activa`) })).toBeVisible()
    await dialogo.getByRole('button', { name: 'Cerrar' }).last().click()

    // Sin filtro, la de Supervisión se copia en una de Ejecución.
    const copiado = await exigir(`${RUTA(destino)}/copia`, equipo, 'POST', { vacanteOrigenId: deSupervision })
    expect(copiado.borrador.criterios.map((c: any) => c.nombre)).toEqual(['Copiable de supervisión'])
  })

  test('QA-PP-02 · tras copiar encima de un borrador, la guía que se ve es la copiada', async ({ page }) => {
    const otra = await crearVacante(equipo, 'Guía que se pisa', ejecucion)
    await exigir(`/panel/vacantes/${otra}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    await escribirBorrador(equipo, otra, PRUEBA_BASE('Borrador con guía local'), 'Guía local del borrador')

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${otra}/preguntas`)
    const guia = page.getByRole('textbox', { name: /Guía de calificación para la IA/ })
    await expect(guia).toHaveValue('Guía local del borrador', { timeout: 20_000 })
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar de otra vacante' })
    await dialogo.getByRole('searchbox', { name: 'Buscar por nombre' }).fill(`${MARCA} Copiable archivada`)
    await dialogo.getByRole('button', { name: new RegExp(`^${MARCA} Copiable archivada`) }).click()
    await dialogo.getByRole('button', { name: 'Copiar esta prueba' }).click()
    await dialogo.getByRole('button', { name: 'Reemplazar el borrador' }).click()
    await expect(dialogo).toBeHidden({ timeout: 20_000 })
    await expect(criterio(page, 'Copiable archivada')).toBeVisible({ timeout: 20_000 })

    expect((await editorDe(equipo, otra)).borrador.guiaCalificacion).toBe('Guía de la archivada')
    // Lo que se ve tiene que ser lo guardado: si no, «Guardar la guía» borra la copiada.
    await expect(guia).toHaveValue('Guía de la archivada')
  })
})

test.describe('Permisos del editor', () => {
  test('AC-20 · sin editar_vacante el editor se ve en lectura, sin botones que acaben en 403', async ({ page }) => {
    const id = await vacanteConPreguntasPublicadas('Solo lectura')
    const borrador = await crearVacante(equipo, 'Solo lectura con borrador', ejecucion)
    await exigir(`/panel/vacantes/${borrador}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    await escribirBorrador(equipo, borrador, PRUEBA_BASE('Borrador ajeno'))
    const lector = await tokenDePanel(sembrarEquipoSin('lector', ['editar_vacante']))

    const editor = await editorDe(lector, id)
    expect(editor.puedeEditar).toBe(false)
    for (const [ruta, metodo, cuerpo] of [
      [`${RUTA(id)}/borrador`, 'POST', undefined],
      [`${RUTA(id)}/publicada/puntos`, 'PUT', { preguntas: [] }],
      [`${RUTA(id)}/publicada/instrucciones`, 'PUT', { guiaCalificacion: 'x' }],
      [`${RUTA(borrador)}/criterios`, 'POST', { nombre: 'No debería' }],
      [`${RUTA(borrador)}/publicacion`, 'POST', undefined],
      [`${RUTA(borrador)}/copia`, 'POST', { vacanteOrigenId: id }],
      [`${RUTA(borrador)}/recomendaciones`, 'POST', {}],
    ] as const) {
      expect.soft((await pedir(ruta, lector, metodo, cuerpo)).estado, `${metodo} ${ruta}`).toBe(403)
    }

    await entrarAlPanelCon(page, lector)
    for (const vacante of [id, borrador]) {
      await page.goto(`/admin/vacantes/${vacante}/preguntas`)
      await expect(page.getByText('Las ves en lectura: cambiarlas pide el permiso de editar esta vacante.')).toBeVisible({
        timeout: 20_000,
      })
      // Ningún botón que actúe: solo plegar, desplegar y la pastilla de las faltas, que lleva a donde se arreglan (V68).
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const queActuan = await page.locator('main button').evaluateAll(
        (botones) =>
          botones.filter(
            (b) =>
              !b.hasAttribute('aria-expanded') &&
              !['Desplegar todo', 'Plegar todo'].includes((b.textContent ?? '').trim()) &&
              !/^\d+ por arreglar/.test((b.textContent ?? '').trim()),
          ).length,
      )
      expect(queActuan).toBe(0)
    }
  })
})

test.describe('Regresiones del balance', () => {
  async function borradorA95(): Promise<number> {
    const id = await crearVacante(equipo, `Balance ${Date.now()}`, ejecucion)
    await exigir(`/panel/vacantes/${id}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    const preguntas = Array.from({ length: 6 }, (_, i) => ({
      tipo: 'ABIERTA' as const,
      enunciado: `Pregunta abierta ${i + 1} para alargar la página y tener que bajar.`,
      puntos: i === 0 ? 20 : 15,
    }))
    await escribirBorrador(equipo, id, [{ nombre: 'Casos', preguntas }])
    return id
  }

  test('QA-PP-01 · al bajar por el editor el balance sigue a la vista y «Publicar» se puede pulsar', async ({ page }) => {
    const id = await borradorA95()
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${id}/preguntas`)
    await expect(balance(page)).toContainText('95 de 100 puntos', { timeout: 20_000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    expect(await nadaLoTapa(page, { role: 'button', name: 'Publicar las preguntas' })).toBe(true)

    // En el teléfono, la línea del balance («95 de 100 puntos» y «Publicar») también queda pegada arriba y a la vista.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const resumen = balance(page).getByText('95 de 100 puntos', { exact: true })
    await expect(resumen).toBeVisible()
    const tapado = await resumen.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const enElCentro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !(enElCentro !== null && (enElCentro === el || el.contains(enElCentro)))
    })
    expect(tapado).toBe(false)
  })

  test('QA-05 · en el teléfono, la línea del criterio se lee en orden: sus puntos y después sus preguntas', async ({ page }) => {
    const id = await borradorA95()
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/admin/vacantes/${id}/preguntas`)
    await expect(balance(page)).toContainText('95 de 100 puntos', { timeout: 20_000 })
    // «Casos · 95 pts (IA 95) · 6 preguntas»: los puntos, en la misma fila y a la izquierda, o en una fila de más arriba.
    const linea = page.getByRole('region', { name: 'Criterio Casos' }).locator('header').first()
    const puntos = await linea.getByText(/^\d+ pts\b/).first().boundingBox()
    const cuenta = await linea.getByText(/^· \d+ preguntas?/).first().boundingBox()
    expect(puntos && cuenta).toBeTruthy()
    const enOrden = Math.abs(puntos!.y - cuenta!.y) < 6 ? puntos!.x < cuenta!.x : puntos!.y < cuenta!.y
    expect(enOrden).toBe(true)
  })

  test('QA-PP-03 · con faltas, «Publicar» no deja una lista que se quede vieja: lleva a la primera, y al corregir la pastilla se va', async ({ page }) => {
    const id = await borradorA95()
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${id}/preguntas`)
    const pastilla = balance(page).getByRole('button', { name: '1 por arreglar' })
    await expect(pastilla).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Publicar las preguntas' }).click()
    await expect(page.locator('#criterios-y-preguntas')).toBeFocused()
    const faltas = page.getByRole('alert').filter({ hasText: 'Los puntos suman 95 de 100' })
    await expect(faltas).toHaveCount(0)

    // Se corrige: la primera abierta pasa de 20 a 25 y el borrador suma 100, sin avisos.
    // Los criterios salen plegados al entrar (V68): se despliegan para llegar a ella.
    await page.getByRole('button', { name: 'Desplegar todo' }).click()
    const primera = page.getByRole('article', { name: /Pregunta abierta 1 para alargar/ })
    await primera.getByRole('button', { name: 'Editar la pregunta' }).click()
    await page.getByLabel('Puntos', { exact: true }).fill('25')
    await page.getByRole('button', { name: 'Guardar la pregunta' }).click()
    await expect(balance(page)).toContainText('100 de 100 puntos', { timeout: 20_000 })
    await expect(balance(page)).toContainText('0 avisos')
    await expect(balance(page).getByRole('button', { name: /por arreglar/ })).toHaveCount(0)
    await expect(faltas).toHaveCount(0)
  })
})

test.describe('Recomendaciones por IA', () => {
  test('AC-13/AC-14b · con la IA apagada no se encola; una propuesta lista no cambia el borrador hasta agregarla, y con 100 no queda sitio', async ({ page }) => {
    const nombre = 'Recomendaciones'
    const id = await crearVacante(equipo, nombre, ejecucion)
    await exigir(`/panel/vacantes/${id}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    const editor = await escribirBorrador(equipo, id, [
      { nombre: 'Conocimiento contable', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Cuéntanos un cierre difícil.', puntos: 50 }] },
      { nombre: 'Manejo de Excel', preguntas: [] },
    ])
    const excel = editor.borrador.criterios.find((c: any) => c.nombre === 'Manejo de Excel').id as number

    // En el preview la IA está apagada: no se encola nada y se dice (punto 18 de la spec).
    const pedida = await pedir(`${RUTA(id)}/recomendaciones`, equipo, 'POST', { indicacion: 'énfasis en Excel' })
    expect(pedida.estado).toBe(200)
    expect(pedida.cuerpo.encolada).toBe(false)
    expect(pedida.cuerpo.mensaje).toMatch(/apagada/)
    expect(Number(consultar(`select count(*) as n from propuesta_preguntas where vacante_id = ${id}`)[0]!.n)).toBe(0)

    // La propuesta que habría dejado el agente simulado: 50 puntos, uno para «Manejo de Excel».
    const propuesta = [
      {
        criterioExistenteId: excel, nombre: 'Manejo de Excel', queEvalua: null,
        preguntas: [{
          tipo: 'OPCION_UNICA', enunciado: '¿Qué función suma solo lo que cumple una condición?', puntos: 20, queDebeTener: null,
          opciones: [{ texto: 'SUMAR.SI', puntos: 20 }, { texto: 'BUSCARV', puntos: 0 }],
        }],
      },
      {
        criterioExistenteId: null, nombre: 'Priorización', queEvalua: 'Ordena el trabajo cuando todo es urgente.',
        preguntas: [{
          tipo: 'ABIERTA', enunciado: 'Cuéntanos una semana de cierre con tres urgencias a la vez.', puntos: 30,
          queDebeTener: 'Qué dejó para después y por qué.', opciones: [],
        }],
      },
    ]
    sql(`insert into propuesta_preguntas (organizacion_id, vacante_id, indicacion, puntos_que_faltan, estado, contenido, terminada_en)
         select organizacion_id, id, 'énfasis en Excel', 50, 'LISTA', ${literalJson(propuesta)}, now() from vacante where id = ${id};`)

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${id}/preguntas`)
    await expect(balance(page)).toContainText('50 de 100 puntos', { timeout: 20_000 })
    await page.getByRole('button', { name: 'Recomendaciones por IA' }).click()
    const panel = page.getByRole('region', { name: 'Recomendaciones por IA' })
    await expect(panel).toContainText('La IA completará los 50 puntos que faltan')
    await expect(panel).toContainText('¿Qué función suma solo lo que cumple una condición?', { timeout: 20_000 })
    await expect(panel).toContainText('Priorización')
    expect((await editorDe(equipo, id)).borrador.total).toBe(50) // nada cambia solo

    await panel.getByRole('button', { name: 'Agregar sus preguntas' }).click()
    await expect(balance(page)).toContainText('70 de 100 puntos', { timeout: 20_000 })
    await expect(criterio(page, 'Manejo de Excel')).toContainText('¿Qué función suma solo lo que cumple una condición?')
    await panel.getByRole('button', { name: 'Agregar el criterio' }).click()
    await expect(balance(page)).toContainText('100 de 100 puntos', { timeout: 20_000 })
    const servidor = (await editorDe(equipo, id)).borrador
    expect(servidor.total).toBe(100)
    expect(servidor.criterios.map((c: any) => c.nombre)).toEqual(['Conocimiento contable', 'Manejo de Excel', 'Priorización'])

    // Con el borrador en 100 no se pide nada: no queda sitio.
    await expect(panel).toContainText('no queda sitio', { timeout: 20_000 })
    const llena = await pedir(`${RUTA(id)}/recomendaciones`, equipo, 'POST', {})
    expect(llena.estado).toBe(409)
    expect(JSON.stringify(llena.cuerpo)).toContain('no queda sitio')
  })
})

function literalJson(valor: unknown): string {
  return `${literal(JSON.stringify(valor))}::jsonb`
}
