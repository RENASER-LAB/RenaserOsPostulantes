import { expect, type Page } from '@playwright/test'
import { API } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  consultar,
  cuentaDeCandidato,
  empezarEvaluacion,
  entrarAlPanelCon,
  entrarAlPortalCon,
  entregar,
  escribirBorrador,
  estadoDeLaPostulacion,
  exigir,
  pedir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  responder,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, MARCA, publicarPrueba, retirarLoSembrado } from './ayuda-prueba-propia'

/**
 * El Perfil Integral se responde mientras la vacante esté abierta (V78), los recorridos de la
 * Verificación de `specs/Ready/perfil-integral-hasta-el-cierre-de-la-vacante`:
 *
 *   1. Crear una vacante con «Fecha límite» desde la pantalla: sin día se rechaza; con día
 *      queda guardada a las 23:59 de Lima, y la cabecera lo dice con la hora (AC-01..AC-03).
 *   2. Postular y ver la portada de la evaluación sin ningún plazo (AC-05, AC-06).
 *   3. Cerrar a mano con gente a medias: quien no terminó queda cerrado, quien entregó sigue,
 *      y quien tenía la evaluación abierta lee que la vacante se cerró (AC-09, AC-12).
 *   4. La vacante con fecha límite se cierra sola al pasar su día (AC-10). Lo cierra el sondeo
 *      del backend, que corre cada minuto: la prueba lo espera.
 *
 * Los detalles que no necesitan navegador —WhatsApp v2, la migración, reabrir, el barrido dos
 * veces— los recorre `FlujoPerfilHastaElCierreIT` en el backend.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067). Repetible sobre
 * el mismo clon: cada corrida titula sus vacantes con su propio sufijo.
 */

const PREGUNTA = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
const RESPUESTA = 'En marzo la caja no cuadraba por 1.200 soles; lo hallé en dos días revisando los vales.'
const VACANTE_CERRADA = 'La vacante se cerró y esta evaluación ya no se puede responder.'
const SOLICITUD_SEMBRADA = `${MARCA} solicitud del cierre por fecha (V78)`
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
/**
 * Sufijo de esta corrida en los títulos: la limpieza solo rellena `eliminada_en`, así que las
 * vacantes de corridas anteriores siguen en la tabla. Los títulos empiezan por la MARCA para que
 * `retirarLoSembrado` las siga encontrando.
 */
const CORRIDA = String(Date.now())
const CIERRE_A_MANO = `Cierre a mano (V78) ${CORRIDA}`
const CIERRE_POR_FECHA = `Cierre por fecha (V78) ${CORRIDA}`

const correos: string[] = []
let equipo = ''
let permanente = 0
let conFecha = 0

/** Un día de Lima a tantos días de hoy, como lo escribe el selector: «2026-10-31». */
function diaDeLimaEn(dias: number): string {
  const enLima = new Date(Date.now() - 5 * 3_600_000 + dias * 24 * 3_600_000)
  return enLima.toISOString().slice(0, 10)
}

/** Las 23:59:59 de Lima de ese día, como la guarda el servidor. */
const finDelDiaEnLima = (dia: string) => new Date(`${dia}T23:59:59-05:00`).toISOString()

/** «vie 30/10, 23:59», como lo pinta el panel. */
function fechaCorta(dia: string): string {
  const [anio, mes, numero] = dia.split('-').map(Number) as [number, number, number]
  const semana = DIAS[new Date(Date.UTC(anio, mes - 1, numero)).getUTCDay()]
  return `${semana} ${String(numero).padStart(2, '0')}/${String(mes).padStart(2, '0')}, 23:59`
}

/** Una vacante publicada con sus preguntas propias (una abierta) y la prueba del editor. */
async function vacantePublicada(nombre: string, minutos: boolean): Promise<number> {
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await escribirBorrador(
    equipo,
    vacante,
    [{ nombre: 'General', preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA, puntos: 100, queDebeTener: 'El monto.' }] }],
    minutos ? 'Mira el monto y la causa.' : undefined,
  )
  await publicarPreguntas(equipo, vacante)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre?', queDebeTener: 'La cuenta.' }],
      },
    ],
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  return vacante
}

/** Postula por la API; con `hasta` la deja empezada o entregada. */
async function postulanteEn(
  vacante: number,
  nombre: string,
  hasta: 'sin empezar' | 'a medias' | 'entregada',
): Promise<{ id: number; uuid: string; token: string }> {
  const cuenta = await cuentaDeCandidato(nombre, correos)
  const uuid = await postular(cuenta.token, vacante)
  const id = postulacionPorUuid(uuid)
  if (hasta !== 'sin empezar') await empezarEvaluacion(cuenta.token, uuid)
  if (hasta === 'entregada') {
    const pregunta = Number(
      uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
            where p.id = ${id}`).pregunta_id,
    )
    await responder(cuenta.token, uuid, pregunta, { texto: RESPUESTA })
    await entregar(cuenta.token, uuid)
  }
  return { id, uuid, token: cuenta.token }
}

const estadoDeSuEvaluacion = (id: number): string =>
  String(uno(`select e.estado from evaluacion e join postulacion p on p.evaluacion_id = e.id where p.id = ${id}`).estado)

const motivoDeCierre = (id: number): string | null =>
  uno(`select motivo_cierre from postulacion where id = ${id}`).motivo_cierre as string | null

/** Nada en la página habla de un plazo del Perfil Integral. */
async function sinNingunPlazo(page: Page) {
  await expect(page.getByText(/para entregarla|Se entrega hoy|Queda poco plazo/)).toHaveCount(0)
  await expect(page.getByText(/^Quedan \d/)).toHaveCount(0)
  await expect(page.getByText(/\b\d+ días?\b/)).toHaveCount(0)
}

test.describe('El Perfil Integral dura hasta que la vacante se cierra', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    permanente = await vacantePublicada(CIERRE_A_MANO, true)
    conFecha = await vacantePublicada(CIERRE_POR_FECHA, false)
    sql(`update vacante set tipo_cierre = 'FECHA', cierra_en = ${literal(finDelDiaEnLima(diaDeLimaEn(2)))}
          where id = ${conFecha};`)
  })

  test.afterAll(async () => {
    await limpiarSiempre([
      () => retirarLoSembrado(correos),
      () => {
        sql(`update solicitud_talento set estado = 'ARCHIVADA'
              where motivo = ${literal(SOLICITUD_SEMBRADA)} and estado <> 'ARCHIVADA';`)
      },
    ])
  })

  test('1 · crear con «Fecha límite»: sin día no se guarda; con día queda a las 23:59 de Lima (AC-01, AC-02, AC-03)', async ({ page }) => {
    const lugar = await lugarDe(equipo)
    const { id: solicitud } = await exigir<{ id: number }>('/panel/solicitudes', equipo, 'POST', {
      areaId: lugar.areaId,
      puestoId: lugar.puestoId,
      urgencia: 'NORMAL',
      resultadoPrincipal: 'Que la caja cuadre cada día',
      motivo: SOLICITUD_SEMBRADA,
      consecuenciaNoContratar: 'La caja sigue sin cuadrar.',
      analisisCapacidad: 'El equipo no alcanza.',
      resultadosEsperados: [
        { descripcion: 'Caja cuadrada', indicador: 'Descuadres por semana' },
        { descripcion: 'Arqueos al día', indicador: 'Arqueos por semana' },
        { descripcion: 'Reporte a tiempo', indicador: 'Días de retraso' },
      ],
    })
    await exigir(`/panel/solicitudes/${solicitud}/aprobacion`, equipo, 'POST', { motivo: SOLICITUD_SEMBRADA })
    const titulo = `${MARCA} Cajero con fecha límite ${CORRIDA}`
    const vivasConEseTitulo = () =>
      consultar(`select id from vacante where titulo = ${literal(titulo)} and eliminada_en is null`)
    const dia = diaDeLimaEn(5)

    await entrarAlPanelCon(page, equipo)
    // El listado de vacantes del panel es la portada del panel, /admin (no hay /admin/vacantes).
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Crear vacante' }).click()
    const respaldo = page.getByLabel('Solicitud aprobada que la respalda')
    await expect(respaldo.locator('option', { hasText: `#${solicitud} ` })).toHaveCount(1)
    await respaldo.selectOption(String(solicitud))
    const responsable = page.getByLabel('Responsable del proceso', { exact: true })
    await expect(responsable).toBeEnabled()
    await responsable.selectOption({ index: 1 })
    await page.getByLabel('Título que ve quien postula').fill(titulo)
    await page.getByLabel('Descripción', { exact: true }).fill('Lleva la caja de la tienda.')
    await page.getByLabel('Modalidad', { exact: true }).selectOption('Remoto')

    const cierre = page.getByLabel('Cómo se cierra', { exact: true })
    await expect(cierre).toBeEnabled()
    await expect(cierre.locator('option')).toHaveText(['Permanente', 'Fecha límite'])
    await expect(cierre).toHaveValue('PERMANENTE')
    await expect(page.getByText(/plazas/i)).toHaveCount(0)

    await cierre.selectOption('FECHA')
    await page.getByRole('button', { name: 'Crear en borrador' }).click()
    await expect(page.getByRole('alert')).toHaveText('Elige el día en que cierra la vacante.')
    expect(vivasConEseTitulo()).toHaveLength(0)

    await page.getByLabel('Fecha de cierre').fill(dia)
    await page.getByRole('button', { name: 'Crear en borrador' }).click()
    await expect.poll(() => vivasConEseTitulo().length, {
      timeout: 15_000,
    }).toBe(1)

    const guardada = uno(`select id, tipo_cierre, to_json(cierra_en) as cierra_en from vacante
                           where titulo = ${literal(titulo)} and eliminada_en is null`)
    expect(guardada.tipo_cierre).toBe('FECHA')
    expect(new Date(String(guardada.cierra_en)).toISOString()).toBe(finDelDiaEnLima(dia))

    await page.goto(`/admin/vacantes/${guardada.id}`)
    await expect(page.getByText(`se cierra el ${fechaCorta(dia)}`)).toBeVisible({ timeout: 20_000 })
  })

  test('2 · la portada no dice ningún plazo, ni días, ni texto en su lugar; dentro, la barra tampoco (AC-05, AC-06)', async ({ page }) => {
    const ana = await postulanteEn(permanente, 'Ana', 'sin empezar')
    expect(uno(`select e.vence_en from evaluacion e join postulacion p on p.evaluacion_id = e.id
                 where p.id = ${ana.id}`).vence_en).toBeNull()
    await entrarAlPortalCon(page, ana.token)

    await page.goto(`/procesos/${ana.uuid}/evaluacion`)
    await expect(page.getByRole('heading', { name: /Tu evaluación\s*está lista/ })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('25 min')).toBeVisible()
    await sinNingunPlazo(page)

    await page.getByRole('button', { name: /Empezar evaluación/ }).click()
    await expect(page.getByLabel('Tu respuesta')).toBeVisible()
    await sinNingunPlazo(page)

    // Sin minutos de referencia no se dibuja la banda de datos vacía (AC-06)
    const eva = await postulanteEn(conFecha, 'Eva', 'sin empezar')
    const otra = await page.context().newPage()
    await entrarAlPortalCon(otra, eva.token)
    await otra.goto(`/procesos/${eva.uuid}/evaluacion`)
    await expect(otra.getByRole('button', { name: /Empezar evaluación/ })).toBeVisible({ timeout: 20_000 })
    await expect(otra.getByText(/de referencia/)).toHaveCount(0)
    await expect(otra.locator('[class*="_datos_"]')).toHaveCount(0)
    await sinNingunPlazo(otra)
    await otra.close()
  })

  test('3 · cerrar a mano: quien no terminó queda cerrado y quien tenía la evaluación abierta lee que la vacante se cerró (AC-09, AC-12)', async ({ page, browser }) => {
    const ana = Number(uno(`select p.id from postulacion p where p.vacante_id = ${permanente} order by p.id limit 1`).id)
    const beto = await postulanteEn(permanente, 'Beto', 'a medias')
    const carla = await postulanteEn(permanente, 'Carla', 'entregada')

    // Beto tiene la evaluación abierta en su navegador cuando el equipo cierra la vacante
    const contextoDeBeto = await browser.newContext()
    const paginaDeBeto = await contextoDeBeto.newPage()
    await entrarAlPortalCon(paginaDeBeto, beto.token)
    await paginaDeBeto.goto(`/procesos/${beto.uuid}/evaluacion`)
    await expect(paginaDeBeto.getByLabel('Tu respuesta')).toBeVisible({ timeout: 20_000 })

    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${permanente}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
    const ajustes = page.getByRole('region', { name: 'Configuración de la vacante' })
    if (!(await ajustes.isVisible())) await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
    await ajustes.getByRole('button', { name: 'Cerrar vacante' }).click()
    await page.getByLabel('Motivo del cierre').fill(`${MARCA} ya contratamos`)
    await page.getByRole('button', { name: 'Confirmar cierre' }).click()
    await expect(page.getByText(/^Cerrada el /)).toBeVisible({ timeout: 20_000 })

    for (const id of [ana, beto.id]) {
      expect(estadoDeLaPostulacion(id)).toBe('CERRADA')
      expect(motivoDeCierre(id)).toBe('PLAZO_VENCIDO')
      expect(estadoDeSuEvaluacion(id)).toBe('VENCIDA')
    }
    expect(estadoDeLaPostulacion(carla.id)).toBe('PERFIL_CALIFICANDO')

    // Beto intenta guardar: el servidor lo rechaza y la pantalla dice por qué
    await paginaDeBeto.getByLabel('Tu respuesta').fill(RESPUESTA)
    await expect(paginaDeBeto.getByRole('alert')).toHaveText(VACANTE_CERRADA, { timeout: 20_000 })
    // Y entregar tampoco vale
    const entrega = await pedir(`/portal/evaluacion/${beto.uuid}/entrega`, beto.token, 'POST')
    expect(entrega.estado).toBe(409)
    expect(entrega.cuerpo.detail).toBe(VACANTE_CERRADA)
    await contextoDeBeto.close()
  })

  test('4 · la vacante con fecha límite se cierra sola al pasar su día: autor el sistema, fuera del tablón (AC-10)', async () => {
    test.setTimeout(180_000)
    const eva = Number(uno(`select p.id from postulacion p where p.vacante_id = ${conFecha} order by p.id limit 1`).id)
    const gina = await postulanteEn(conFecha, 'Gina', 'entregada')

    sql(`update vacante set cierra_en = now() - interval '1 minute' where id = ${conFecha};`)

    await expect
      .poll(() => String(uno(`select estado from vacante where id = ${conFecha}`).estado), {
        timeout: 150_000,
        intervals: [5_000],
      })
      .toBe('CERRADA')

    expect(
      consultar(`select coalesce(usuario_id::text, 'sistema') as autor, motivo from auditoria
                  where accion = 'cerrar_vacante' and entidad_id = ${conFecha}`),
    ).toEqual([{ autor: 'sistema', motivo: 'Llegó la fecha de cierre' }])
    await expect.poll(() => estadoDeLaPostulacion(eva), { timeout: 70_000, intervals: [5_000] }).toBe('CERRADA')
    expect(motivoDeCierre(eva)).toBe('PLAZO_VENCIDO')
    expect(estadoDeLaPostulacion(gina.id)).toBe('PERFIL_CALIFICANDO')

    const tablon = await fetch(`${API}/portal/vacantes`).then((r) => r.text())
    expect(tablon).not.toContain(CIERRE_POR_FECHA)
  })
})
