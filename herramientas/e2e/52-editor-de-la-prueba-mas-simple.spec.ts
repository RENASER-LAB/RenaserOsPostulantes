import { expect, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre, sql } from './base-de-datos'
import {
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
  pedir,
  RUTA as DEL_BANCO,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  criterioDe,
  editorDe,
  entregarLaPrueba,
  escribirPrueba,
  iniciarLaPrueba,
  lugarDe,
  publicarPrueba,
  responderLaPrueba,
  retirarLoSembrado,
  RUTA,
  subirArchivo,
  titulo,
  verLaPrueba,
  type Candidata,
} from './ayuda-prueba-propia'

/**
 * QA de «Un editor de la prueba técnica más simple» (V68): los nueve recorridos de la spec
 * `editor-de-la-prueba-mas-simple`, con la IA apagada (no hace falta: nada se califica).
 *
 * La prueba de la vacante A (100 puntos), sin caso:
 *   Análisis      · 30 = abierta (1) + opción única 10 (2) + parte calificada 20 (IA)
 *   Excel         · 20 = abierta (3) + parte calificada 20 (IA); pide «Flujo de caja.xlsx»
 *   Comunicación  · 50 = abierta (4) + opción única 10 (5) + parte calificada 40 (persona)
 *   Informe final: general que cubre la 1 y la 4 (lo miran Análisis y Comunicación)
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const A1 = 'Analiza el estado de resultados de marzo.'
const C1 = '¿Qué margen tiene una venta de 100 con costo 60?'
const A2 = 'Arma un flujo de caja mensual para una tienda pequeña.'
const A3 = 'Explica el flujo a la gerencia en tres líneas.'
const C2 = '¿A quién reportas primero un descuadre?'
const CASO = 'La tienda cerró marzo con menos caja de la que esperaba la gerencia.'

const correos: string[] = []
let equipo = ''
let vacanteA = 0
let vacanteB = 0
let lia: Candidata

const NOMBRE_A = 'Editor simple A'
const NOMBRE_B = 'Editor simple B'

/** Lo que se escribe en el campo `datetime-local`: dentro de N días, en hora de Lima. */
const enLima = (dias: number) => new Date(Date.now() + dias * 24 * 3_600_000 - 5 * 3_600_000).toISOString().slice(0, 16)

const criterio = (page: Page, nombre: string) => page.getByRole('region', { name: `Criterio ${nombre}` })
const cabecera = (page: Page) => page.getByRole('region', { name: 'Balance de la prueba' })
/** El botón que pliega y despliega un criterio: su nombre, sin más. */
const plegador = (page: Page, nombre: string) => criterio(page, nombre).getByRole('button', { name: nombre, exact: true })
const pregunta = (page: Page, enunciado: string) => page.getByRole('article', { name: `Pregunta: ${enunciado}` })

test.describe('Un editor de la prueba técnica más simple', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)
    vacanteA = await crearVacante(equipo, NOMBRE_A, lugar)
    vacanteB = await crearVacante(equipo, NOMBRE_B, lugar)
    for (const v of [vacanteA, vacanteB]) {
      await exigir(`/panel/vacantes/${v}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
    }
    await escribirPrueba(equipo, vacanteA, {
      criterios: [
        {
          nombre: 'Análisis', puntosCalificados: 20, calificador: 'IA',
          preguntas: [
            { tipo: 'ABIERTA', enunciado: A1, queDebeTener: 'El margen y su lectura.' },
            { tipo: 'OPCION_UNICA', enunciado: C1, puntos: 10, opciones: [{ texto: '40 %', puntos: 10 }, { texto: '60 %', puntos: 0 }] },
          ],
        },
        {
          nombre: 'Excel', puntosCalificados: 20, calificador: 'IA',
          preguntas: [{ tipo: 'ABIERTA', enunciado: A2, queDebeTener: 'Ingresos, egresos y saldo.' }],
        },
        {
          nombre: 'Comunicación', puntosCalificados: 40, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'ABIERTA', enunciado: A3, queDebeTener: 'Claridad sin jerga.' },
            { tipo: 'OPCION_UNICA', enunciado: C2, puntos: 10, opciones: [{ texto: 'A la jefatura', puntos: 10 }, { texto: 'A nadie', puntos: 0 }] },
          ],
        },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90 },
      fechaLimite: null,
    })
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('recorridos 1 a 4: sin caso, un archivo desde su pregunta, un general de dos, «Mira» solo y la fecha desde su falta', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteA}/prueba`)
    await expect(cabecera(page)).toContainText('100 de 100 pts', { timeout: 20_000 })
    await expect(page.locator('main')).not.toContainText(/cuestionario/i)

    // AC-15: al entrar, todo plegado (ninguno tiene una falta suya); desplegar y plegar todo
    for (const nombre of ['Análisis', 'Excel', 'Comunicación']) {
      await expect(plegador(page, nombre)).toHaveAttribute('aria-expanded', 'false')
    }
    await expect(criterio(page, 'Análisis')).toContainText('30 pts (sistema 10 + IA 20)')
    await expect(criterio(page, 'Análisis')).toContainText('· 2 preguntas')
    await page.getByRole('button', { name: 'Desplegar todo' }).click()
    await expect(pregunta(page, A1)).toBeVisible()
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    await expect(pregunta(page, A1)).toHaveCount(0)

    // AC-03 (recorrido 3): el caso se abre, se escribe y se quita con confirmación
    await page.getByRole('button', { name: 'Agregar un caso' }).click()
    await page.getByRole('textbox', { name: /^Enunciado/ }).fill(CASO)
    await expect(page.locator('main')).not.toContainText('Va también en el correo')
    await page.getByRole('button', { name: 'Guardar el caso' }).click()
    await expect(page.getByRole('button', { name: /Guardar el caso|Guardando/ })).toHaveCount(0, { timeout: 20_000 })
    expect((await editorDe(equipo, vacanteA)).borrador.prueba.enunciado).toBe(CASO)
    // Plegado, enseña el principio del caso
    await page.getByRole('region', { name: /Escenario o caso práctico/ }).getByRole('button', { name: 'Plegar' }).click()
    await expect(page.getByRole('region', { name: /Escenario o caso práctico/ })).toContainText(CASO)
    await page.getByRole('button', { name: 'Ver el caso' }).click()
    await page.getByRole('button', { name: 'Quitar el caso' }).click()
    const confirmar = page.getByRole('alertdialog', { name: 'Quitar el caso' })
    await expect(confirmar).toContainText('Se borran el enunciado y el PDF. Las preguntas y los entregables se quedan como están.')
    await confirmar.getByRole('button', { name: 'Quitar el caso' }).click()
    await expect(page.getByRole('button', { name: 'Agregar un caso' })).toBeVisible({ timeout: 20_000 })
    expect((await editorDe(equipo, vacanteA)).borrador.prueba.enunciado ?? null).toBeNull()

    // AC-04/AC-07: el archivo se pide desde su pregunta; «Enlace» en un criterio de IA avisa
    await plegador(page, 'Excel').click()
    const pregunta3 = pregunta(page, A2)
    await pregunta3.getByRole('button', { name: 'Pedir un archivo para esta pregunta' }).click()
    const archivo = page.getByRole('form', { name: 'Archivo de la pregunta 3' })
    await archivo.getByLabel('Nombre').fill('Flujo de caja.xlsx')
    await archivo.getByLabel('Formato').selectOption('ENLACE')
    await expect(archivo.getByRole('status')).toHaveText(
      'La IA no abre enlaces: este criterio lo califica la IA, así que solo leerá la respuesta escrita.',
    )
    await archivo.getByLabel('Formato').selectOption('ARCHIVO')
    await archivo.getByRole('button', { name: 'Pedir el archivo' }).click()
    await expect(pregunta3).toContainText('Flujo de caja.xlsx', { timeout: 20_000 })
    await expect(pregunta3.getByRole('button', { name: 'Pedir un archivo para esta pregunta' })).toHaveCount(0)
    await expect(criterio(page, 'Excel')).toContainText('Flujo de caja.xlsx (pregunta 3)')
    // Pedirlo dos veces en la misma pregunta no crea dos
    const deLaPregunta = (await editorDe(equipo, vacanteA)).borrador.prueba.entregables[0].preguntaId
    const otro = await pedir(`${RUTA(vacanteA)}/entregables`, equipo, 'POST', {
      nombre: 'Otro', formato: 'ARCHIVO', obligatorio: true, preguntaId: deLaPregunta, todaLaPrueba: false, cubre: [],
    })
    expect(otro.estado).toBe(400)

    // AC-05: un general que cubre la 1 y la 4 lo miran los dos criterios
    const generales = page.getByRole('region', { name: /Entregables generales/ })
    await expect(generales).toContainText('Ninguno. Úsalo solo si un archivo reúne varias respuestas.')
    await generales.getByRole('button', { name: 'Agregar entregable general' }).click()
    const general = page.getByRole('form', { name: 'Entregable general nuevo' })
    await general.getByLabel('Nombre').fill('Informe final')
    await general.getByLabel('Estas preguntas').check()
    const casillas = general.getByRole('group', { name: 'Las preguntas que cubre' }).getByRole('checkbox')
    await casillas.nth(0).check()
    await casillas.nth(3).check()
    await general.getByRole('button', { name: 'Pedir el archivo' }).click()
    await expect(generales).toContainText('Cubre: las preguntas 1 y 4', { timeout: 20_000 })
    await page.getByRole('button', { name: 'Desplegar todo' }).click()
    await expect(criterio(page, 'Análisis')).toContainText('Informe final (general)')
    await expect(criterio(page, 'Comunicación')).toContainText('Informe final (general)')
    await expect(criterio(page, 'Excel')).not.toContainText('Informe final')

    // AC-04: el formulario del criterio no tiene «Mira»
    await page.getByRole('button', { name: 'Editar el criterio Análisis' }).click()
    const form = page.getByRole('form', { name: 'Editar el criterio Análisis' })
    await expect(form).toBeVisible()
    await expect(form).not.toContainText('Mira')
    await form.getByRole('button', { name: 'Cancelar' }).click()

    // AC-08/AC-16: sin fecha no se publica; la falta abre la configuración con el cursor en la fecha
    expect((await publicarPrueba(equipo, vacanteA)).estado).toBe(400)
    await cabecera(page).getByRole('button', { name: 'Publicar la prueba' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Falta la fecha límite' })).toBeVisible({ timeout: 20_000 })
    await cabecera(page).getByRole('button', { name: /Falta la fecha límite para dar la prueba/ }).click()
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    const fecha = configuracion.getByLabel('Fecha límite para dar la prueba')
    await expect(fecha).toBeFocused()
    await expect(configuracion).toContainText('Obligatoria para publicar la prueba')
    // AC-12: ningún campo de días; AC-18: la guía con el teclado
    await expect(configuracion.getByLabel(/Días/)).toHaveCount(0)
    await configuracion.getByRole('button', { name: 'Guía: Fecha límite' }).focus()
    await expect(configuracion.getByRole('tooltip')).toContainText('no se copia con la prueba')
    // AC-09: sin publicar, la fecha se guarda en la vacante sin pedir motivo
    await fecha.fill(enLima(20))
    await expect(configuracion).not.toContainText('Motivo del cambio')
    await configuracion.getByRole('button', { name: 'Listo' }).click()
    await expect(configuracion).toHaveCount(0, { timeout: 20_000 })
    await expect(cabecera(page)).toContainText(/90 min · hasta \S+ \d\d\/\d\d, \d\d:\d\d/)
    expect(uno(`select prueba_cierra_en is not null as puesta from vacante where id = ${vacanteA}`).puesta).toBe(true)

    // AC-02: sin enunciado y con entregables, se publica
    await cabecera(page).getByRole('button', { name: 'Publicar la prueba' }).click()
    await expect(page.getByText(/^Publicada\./)).toBeVisible({ timeout: 20_000 })
    await exigir(`/panel/vacantes/${vacanteA}/publicacion`, equipo, 'POST')
  })

  test('recorrido 5: la candidata ve la pantalla previa sin caso, sube el archivo en su pregunta y no entrega sin el general', async ({ page }) => {
    lia = await candidataEnLaPrueba(equipo, vacanteA, 'Lía', correos)

    // AC-20: la API del portal no trae puntos, criterios, calificadores ni qué mira cada uno
    const vista = await verLaPrueba(lia)
    expect(vista.estado).toBe(200)
    expect(JSON.stringify(vista.cuerpo)).not.toMatch(/puntos|puntaje|criterio|calificador|queDebeTener|correcta/i)
    const flujo = (vista.cuerpo.entregables as any[]).find((e) => e.nombre === 'Flujo de caja.xlsx')
    const informe = (vista.cuerpo.entregables as any[]).find((e) => e.nombre === 'Informe final')
    expect(flujo.preguntaId).not.toBeNull()
    expect(informe.preguntaId ?? null).toBeNull()

    // AC-19: la pantalla previa, sin ningún bloque de caso
    await entrarAlPortalCon(page, lia.token)
    await page.goto(`/procesos/${lia.uuid}/prueba`)
    await expect(page.getByText('Fecha límite', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Tendrás 90 minutos desde que pulses Empezar')).toBeVisible()
    await expect(page.getByText('5 preguntas · 2 archivos que subir')).toBeVisible()
    await expect(page.getByRole('heading', { name: /El caso|El encargo|De qué va/ })).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText(/cuestionario/i)

    // Responde todo por la API y empieza en la pantalla
    const p = (await iniciarLaPrueba(lia)).cuerpo
    const q = (t: string) => (p.preguntas as any[]).find((x) => x.enunciado === t)
    for (const t of [A1, A2, A3]) {
      expect((await responderLaPrueba(lia, q(t).id, { texto: 'Una respuesta pensada.' })).estado).toBe(200)
    }
    for (const t of [C1, C2]) {
      expect((await responderLaPrueba(lia, q(t).id, { opcionId: q(t).opciones[0].id })).estado).toBe(200)
    }
    await page.reload()
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })

    // El archivo de la pregunta, dentro de ella
    const enLaPregunta = page.locator(`#entregable-${flujo.id}`)
    await expect(enLaPregunta).toContainText('Archivo de esta pregunta: Flujo de caja.xlsx')
    await enLaPregunta.locator('input[type="file"]').setInputFiles({
      name: 'flujo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 el flujo de caja'),
    })
    await expect(enLaPregunta).toContainText('Recibimos flujo.pdf', { timeout: 20_000 })

    // Sin el general obligatorio no entrega: lo dice y lleva a los entregables; el servidor tampoco
    await page.getByRole('button', { name: 'Entregar prueba' }).click()
    const falta = page.getByRole('alert').filter({ hasText: 'Te falta subir' })
    await expect(falta).toContainText('Te falta subir «Informe final».')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await falta.getByRole('button', { name: 'Ir a los entregables' }).click()
    const directa = await entregarLaPrueba(lia)
    expect(directa.estado).toBe(400)

    // Lo sube y entrega
    expect(await subirArchivo(lia, informe.id, 'informe.pdf')).toBe(200)
    expect((await entregarLaPrueba(lia)).estado).toBe(200)
  })

  test('AC-10: con la prueba publicada y alguien dentro, cambiar la fecha pide motivo y queda en la auditoría', async ({ page }) => {
    expect((await editorDe(equipo, vacanteA)).fechaLimite.pideMotivo).toBe(true)
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteA}/prueba`)
    await cabecera(page).getByRole('button', { name: 'Configuración', exact: true }).click()
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    await configuracion.getByLabel('Fecha límite para dar la prueba').fill(enLima(25))
    await configuracion.getByRole('button', { name: 'Listo' }).click()
    await expect(configuracion.getByRole('alert')).toContainText('pide un motivo', { timeout: 20_000 })
    await configuracion.getByRole('textbox', { name: /Motivo del cambio/ }).fill('Se amplía la convocatoria.')
    await configuracion.getByRole('button', { name: 'Listo' }).click()
    await expect(configuracion).toHaveCount(0, { timeout: 20_000 })
    expect(
      uno(`select motivo from auditoria where accion = 'fijar_fecha_limite_prueba_propia' and entidad_id = ${vacanteA}
            order by id desc limit 1`).motivo,
    ).toBe('Se amplía la convocatoria.')
  })

  test('recorrido 6: copiar la prueba a otra vacante trae el alcance de los archivos y no la fecha (AC-14)', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteB}/prueba`)
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByText(titulo(NOMBRE_A)).click()
    await expect(dialogo).toContainText('De la pregunta 3', { timeout: 20_000 })
    await expect(dialogo).toContainText('Cubre: las preguntas 1 y 4')
    await dialogo.getByRole('button', { name: 'Copiar esta prueba' }).click()
    await expect(page.getByRole('region', { name: /Entregables generales/ })).toContainText('Cubre: las preguntas 1 y 4', {
      timeout: 20_000,
    })
    await expect(cabecera(page)).toContainText('falta la fecha límite')

    const b = await editorDe(equipo, vacanteB)
    expect(b.fechaLimite.cierraEn ?? null).toBeNull()
    const alcances = (b.borrador.prueba.entregables as any[]).map((e) => e.alcance).sort()
    expect(alcances).toEqual(['PREGUNTA', 'PREGUNTAS'])
    const sinFecha = await publicarPrueba(equipo, vacanteB)
    expect(sinFecha.estado).toBe(400)
    expect(JSON.stringify(sinFecha.cuerpo.faltas)).toContain('Falta la fecha límite')
  })

  test('recorrido 7: una prueba publicada antes de la V68, con «Mira» a mano, conserva su ficha y su nota (AC-22)', async () => {
    const antes = await exigir<any>(`/panel/postulaciones/${lia.postulacion}/prueba-propia`, equipo)
    const publicada = (await editorDe(equipo, vacanteA)).publicada
    const comunicacion = criterioDe(publicada, 'Comunicación').id
    const informe = (publicada.prueba.entregables as any[]).find((e) => e.nombre === 'Informe final').id
    // Como la dejó la V67: el general sin alcance y mirado a mano solo por «Comunicación».
    sql(`delete from entregable_cubre_pregunta where entregable_requerido_id = ${informe};
         update entregable_requerido set alcance = null where id = ${informe};
         insert into criterio_banco_entregable (criterio_banco_id, entregable_requerido_id) values (${comunicacion}, ${informe});`)
    const despues = await exigir<any>(`/panel/postulaciones/${lia.postulacion}/prueba-propia`, equipo)
    const deCriterio = (p: any, nombre: string) => (p.criterios as any[]).find((c) => c.nombre === nombre)
    expect(deCriterio(despues, 'Comunicación').entregables).toContain(informe)
    expect(deCriterio(despues, 'Análisis').entregables).not.toContain(informe)
    expect(despues.nota).toEqual(antes.nota)
    for (const c of antes.criterios as any[]) {
      expect(deCriterio(despues, c.nombre).nota).toEqual(c.nota)
    }
  })

  test('recorrido 8: la vacante con PLANTILLA conserva «Plazos de la prueba»; la del editor no lo tiene (AC-13)', async ({ page }) => {
    const existente = Number(uno(`select id from vacante where instrumento_etapa_tecnica = 'PLANTILLA'
                                    and eliminada_en is null and titulo not like 'QA-%' order by id limit 1`).id)
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${existente}`)
    await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
    await expect(page.locator('details summary', { hasText: 'Plazos de la prueba' })).toBeVisible({ timeout: 20_000 })
    await page.goto(`/admin/vacantes/${vacanteA}`)
    await expect(page.getByRole('heading', { level: 1, name: titulo(NOMBRE_A) })).toBeVisible({ timeout: 20_000 })
    const grupo = page.getByRole('group', { name: 'Prueba técnica' })
    if (!(await grupo.isVisible())) await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
    await expect(grupo).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('details summary', { hasText: 'Plazos de la prueba' })).toHaveCount(0)
  })

  test('recorrido 9: el editor del banco pliega, sus avisos llevan a la pregunta y publica como hoy (AC-25, AC-26)', async ({ page }) => {
    const banco = await crearVacante(equipo, 'Editor simple · banco', await lugarDe(equipo))
    await exigir(`/panel/vacantes/${banco}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    await escribirBorrador(equipo, banco, [
      { nombre: 'Casos', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Cuéntanos un cierre difícil.', puntos: 60 }] },
      {
        nombre: 'Tributación',
        preguntas: [{
          tipo: 'OPCION_UNICA', enunciado: '¿Cuál es la tasa general del IGV?', puntos: 40,
          opciones: [{ texto: '18 %', puntos: 30 }, { texto: '19 %', puntos: 0 }],
        }],
      },
    ])
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${banco}/preguntas`)
    const balance = page.getByRole('region', { name: 'Balance de las preguntas' })
    await expect(balance).toContainText('100 de 100 puntos', { timeout: 20_000 })
    // «Tributación» tiene una falta: sale desplegado y en ámbar; «Casos», plegado
    await expect(plegador(page, 'Casos')).toHaveAttribute('aria-expanded', 'false')
    await expect(plegador(page, 'Tributación')).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    await expect(pregunta(page, '¿Cuál es la tasa general del IGV?')).toHaveCount(0)
    // El aviso lleva a su criterio abierto y a esa pregunta
    await balance.getByRole('button', { name: /^La pregunta 2/ }).click()
    await expect(pregunta(page, '¿Cuál es la tasa general del IGV?')).toBeVisible()
    await expect(plegador(page, 'Tributación')).toHaveAttribute('aria-expanded', 'true')

    // Se corrige y se publica como hoy
    const editor = await exigir<any>(DEL_BANCO(banco), equipo)
    const igv = (editor.borrador.criterios as any[]).find((c) => c.nombre === 'Tributación').preguntas[0]
    await exigir(`${DEL_BANCO(banco)}/preguntas/${igv.id}`, equipo, 'PUT', {
      tipo: 'OPCION_UNICA', enunciado: igv.enunciado, puntos: 40, criterioId: igv.criterioId,
      opciones: [{ texto: '18 %', puntos: 40 }, { texto: '19 %', puntos: 0 }],
    })
    await page.reload()
    await expect(balance).toContainText('0 avisos', { timeout: 20_000 })
    await page.getByRole('button', { name: 'Publicar las preguntas' }).click()
    await expect(page.getByText(/^Publicadas\./)).toBeVisible({ timeout: 20_000 })
  })
})
