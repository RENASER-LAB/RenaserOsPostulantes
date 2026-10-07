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
 * La prueba al instante y la campana en cada etapa (V70), los dos recorridos de la
 * Verificación de `specs/la-prueba-al-instante-y-avisos-de-etapa.md`:
 *
 *   1. Vacante con pase automático: el candidato entrega el banco y cae en la portada de su
 *      prueba —el reloj sin arrancar—, y la campana tiene el aviso.
 *   2. Vacante sin pase automático: entrega el banco y ve que se le avisará; el equipo
 *      confirma y el aviso aparece en la campana.
 *
 * Las dos vacantes llevan banco (preguntas propias, una abierta) y la prueba del editor,
 * cronometrada y con fecha límite. La IA está apagada: el pase al instante no la necesita.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const PREGUNTA_DEL_BANCO = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
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
  await page.getByRole('button', { name: /Entregar evaluación/ }).click()
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

  test('1 · con pase automático, al entregar el banco cae en la portada de su prueba y la campana avisa', async ({ page }) => {
    const ana = await cuentaDeCandidato('Ana', correos)
    const uuid = await postular(ana.token, conPase)
    await entrarAlPortalCon(page, ana.token)

    await entregarElBanco(page, uuid)

    // En la misma respuesta: la portada de su prueba, con el reloj sin arrancar
    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}/prueba$`), { timeout: 20_000 })
    await expect(page.getByText('Tu prueba del puesto ya está disponible')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })
    const id = postulacionPorUuid(uuid)
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(Number(uno(`select count(*) as n from intento_prueba
                        where postulacion_id = ${id} and iniciado_en is null`).n)).toBe(1)
    expect(String(uno(`select motivo from transicion_estado where postulacion_id = ${id}
                        order by id desc limit 1`).motivo)).toBe(
      'Pase automático al entregar: la nota se calcula después',
    )

    // Y la campana lo dice, ligado a su proceso
    const aviso = await avisoDeLaPruebaEnLaCampana(page)
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText(`${MARCA} Al instante con pase`)
  })

  test('2 · sin pase automático espera; cuando el equipo confirma, la campana avisa', async ({ page }) => {
    const beto = await cuentaDeCandidato('Beto', correos)
    const uuid = await postular(beto.token, sinPase)
    await entrarAlPortalCon(page, beto.token)

    await entregarElBanco(page, uuid)

    // Como hoy: de vuelta a su proceso, sabiendo que se le avisará
    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`), { timeout: 20_000 })
    await expect(
      page.getByText('Evaluación entregada. Te avisaremos por correo y en la campana cuando te toque la prueba.'),
    ).toBeVisible()
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
