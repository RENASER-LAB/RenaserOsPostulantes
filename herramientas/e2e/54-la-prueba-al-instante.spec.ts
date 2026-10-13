import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import {
  cuentaDeCandidato,
  entrarAlPortalCon,
  escribirBorrador,
  estadoDeLaPostulacion,
  exigir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import {
  crearVacante,
  escribirPrueba,
  lugarDe,
  MARCA,
  publicarPrueba,
  retirarLoSembrado,
} from './ayuda-prueba-propia'

/**
 * Entregar el banco y la campana en cada etapa (V70), con la regla de la V72: **ya no hay
 * prueba al instante**. Los dos recorridos:
 *
 *   1. Vacante con pase automático: el candidato entrega el banco y vuelve a su proceso con
 *      el aviso de que se le avisará; queda calificando, sin prueba. El pase llega con la
 *      nota del Perfil Integral si alcanza la mínima: eso lo recorre el 58.
 *   2. Vacante sin pase automático: entrega el banco y ve el mismo aviso; el equipo
 *      confirma y el aviso de la prueba aparece en la campana.
 *
 * Las dos vacantes llevan banco (preguntas propias, una abierta) y la prueba del editor,
 * cronometrada y con fecha límite. La IA está apagada.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const PREGUNTA_DEL_BANCO = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
const ENTREGADA = 'Evaluación entregada. Te avisaremos por correo y en la campana cuando haya novedades.'
const RESPUESTA = 'En marzo la caja no cuadraba por 1.200 soles; lo hallé en dos días revisando los vales.'

const correos: string[] = []
let equipo = ''
let conPase = 0
let sinPase = 0

/** Una vacante publicada con banco y prueba del editor, con o sin pase automático. */
async function vacanteConBancoYPrueba(nombre: string, paseAutomatico: boolean): Promise<number> {
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await escribirBorrador(equipo, vacante, [
    {
      nombre: 'General',
      preguntas: [
        { tipo: 'ABIERTA', enunciado: PREGUNTA_DEL_BANCO, puntos: 100, queDebeTener: 'El monto, la causa y el plazo.' },
      ],
    },
  ])
  await publicarPreguntas(equipo, vacante)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [
          { tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre de marzo?', queDebeTener: 'La cuenta y el monto.' },
        ],
      },
    ],
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${vacante}/calificacion-automatica`, equipo, 'POST', { activa: paseAutomatico })
  return vacante
}

/** Responde la única pregunta del banco desde el portal y la entrega. */
async function entregarElBanco(page: Page, uuid: string) {
  await page.goto(`/procesos/${uuid}/evaluacion`)
  await page.getByRole('button', { name: /Empezar evaluación/ }).click()
  await page.getByLabel('Tu respuesta').fill(RESPUESTA)
  await page.getByRole('button', { name: 'Entregar la evaluación' }).click()
  await page.getByRole('button', { name: 'Entregar', exact: true }).click()
}

/** El aviso de la prueba en la campana, abriéndola desde la cabecera. */
async function avisoDeLaPruebaEnLaCampana(page: Page) {
  await page.getByRole('button', { name: /^Avisos/ }).click()
  return page
    .getByRole('dialog', { name: 'Tus avisos' })
    .getByRole('link', { name: /Tu prueba del puesto está disponible/ })
}

test.describe('La prueba al instante y la campana en cada etapa', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    conPase = await vacanteConBancoYPrueba('Al instante con pase', true)
    sinPase = await vacanteConBancoYPrueba('Al instante sin pase', false)
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('1 · con pase automático, al entregar el banco vuelve a su proceso y espera la nota, sin prueba (V72)', async ({ page }) => {
    const ana = await cuentaDeCandidato('Ana', correos)
    const uuid = await postular(ana.token, conPase)
    await entrarAlPortalCon(page, ana.token)

    await entregarElBanco(page, uuid)

    // V72: ninguna portada de la prueba al entregar. De vuelta a su proceso, con el aviso
    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`), { timeout: 20_000 })
    await expect(page.getByText(ENTREGADA)).toBeVisible()
    await expect(page.getByText('Tu prueba del puesto ya está disponible')).toHaveCount(0)
    const id = postulacionPorUuid(uuid)
    expect(estadoDeLaPostulacion(id)).toBe('PERFIL_CALIFICANDO')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(0)

    // Y la campana no tiene ningún aviso de la prueba
    await page.getByRole('button', { name: /^Avisos/ }).click()
    await expect(
      page.getByRole('dialog', { name: 'Tus avisos' }).getByRole('link', { name: /Tu prueba del puesto está disponible/ }),
    ).toHaveCount(0)
  })

  test('2 · sin pase automático espera; cuando el equipo confirma, la campana avisa', async ({ page }) => {
    const beto = await cuentaDeCandidato('Beto', correos)
    const uuid = await postular(beto.token, sinPase)
    await entrarAlPortalCon(page, beto.token)

    await entregarElBanco(page, uuid)

    // Como hoy: de vuelta a su proceso, sabiendo que se le avisará
    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`), { timeout: 20_000 })
    await expect(page.getByText(ENTREGADA)).toBeVisible()
    const id = postulacionPorUuid(uuid)
    expect(['PERFIL_CALIFICANDO', 'PERFIL_POR_CONFIRMAR']).toContain(estadoDeLaPostulacion(id))
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(0)

    // El equipo confirma: el perfil, si sigue ahí, y después la prueba
    for (let paso = 0; paso < 2 && estadoDeLaPostulacion(id) !== 'PRUEBA_TURNO_CANDIDATO'; paso++) {
      await exigir(`/panel/postulaciones/${id}/confirmacion-avance`, equipo, 'POST', {
        motivo: `${MARCA}: confirma el equipo`,
      })
    }
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')

    await page.goto('/procesos')
    const aviso = await avisoDeLaPruebaEnLaCampana(page)
    await expect(aviso).toBeVisible({ timeout: 20_000 })
    await aviso.click()
    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`))
  })
})
