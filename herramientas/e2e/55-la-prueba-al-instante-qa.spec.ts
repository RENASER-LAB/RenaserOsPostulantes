import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  consultar,
  cuentaDeCandidato,
  entrarAlPanelCon,
  entrarAlPortalCon,
  escribirBorrador,
  estadoDeLaPostulacion,
  exigir,
  pedir,
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
  quitarTrabajo,
  retirarLoSembrado,
} from './ayuda-prueba-propia'

/**
 * QA de la prueba al instante y de la campana en cada etapa (V70): lo que el 54 no
 * recorre. Postular sin banco desde el formulario del portal y caer en la portada (AC-2),
 * el cuestionario técnico (AC-3), el pase automático sin prueba montada (AC-7), el
 * requisito incumplido (AC-9), el correo con su plazo (AC-20/21), la campana de los
 * cierres, del retiro, del «sin avisar» y de la vacante eliminada (AC-10/11), la nota
 * «en camino» del panel (AC-5) y dos entregas a la vez (casos límite de la spec).
 *
 * La IA está apagada en el preview: la nota «en camino» se siembra como la deja la cola.
 * El cuestionario técnico y la vacante a medio montar son de antes del editor nuevo y la
 * API ya no deja crearlas: se fabrican con SQL sobre vacantes de esta corrida.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const PREGUNTA_DEL_BANCO = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
const RESPUESTA = 'En marzo la caja no cuadraba por 1.200 soles; lo hallé en dos días revisando los vales.'
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const correos: string[] = []
let equipo = ''
let sinBanco = 0
let conCuestionario = 0
let sinPrueba = 0
let conBanco = 0
let sinPase = 0
let paraEliminar = 0

/** Una fecha como la dice el sistema al candidato: «vie 10/10 a las 23:59», en hora de Lima. */
function dichaEnLima(expresion: string): string {
  // La columna no puede llamarse como el alias de `uno`: la columna le ganaría a la fila
  const dicha = String(uno(`select to_char((${expresion}) at time zone 'America/Lima', 'ID|DD/MM|HH24:MI') as dicha`).dicha)
  const [dia, fecha, hora] = dicha.split('|')
  if (!dia || !fecha || !hora) throw new Error(`Fecha ilegible: ${dicha}`)
  return `${DIAS[Number(dia) - 1]} ${fecha} a las ${hora}`
}

const correosDe = (correo: string) =>
  consultar(`select c.plantilla_correo_codigo as codigo, c.asunto, c.cuerpo from correo_enviado c
              join usuario u on u.id = c.usuario_id where u.correo = ${literal(correo)} order by c.id`)

const avisosDe = (correo: string) =>
  consultar(`select a.tipo, a.titulo, a.cuerpo, a.postulacion_id from aviso_portal a
              join usuario u on u.id = a.usuario_id where u.correo = ${literal(correo)} order by a.id`)

/** Una vacante con su prueba del editor publicada; con banco o sin él, con pase o sin él. */
async function vacante(nombre: string, opciones: { banco: boolean; pase: boolean; cronometrada: boolean }) {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  if (opciones.banco) {
    await escribirBorrador(equipo, id, [
      { nombre: 'General', preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA_DEL_BANCO, puntos: 100, queDebeTener: 'El monto y la causa.' }] },
    ])
    await publicarPreguntas(equipo, id)
  } else {
    await exigir(`/panel/vacantes/${id}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  }
  await escribirPrueba(equipo, id, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre de marzo?', queDebeTener: 'La cuenta y el monto.' }],
      },
    ],
    datos: opciones.cronometrada
      ? { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' }
      : { modalidad: 'PLAZO_ABIERTO', guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, id)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${id}/calificacion-automatica`, equipo, 'POST', { activa: opciones.pase })
  return id
}

/** Publicada como las de antes del editor, que la API ya no deja crear: con SQL. */
function publicarComoLasDeAntes(id: number) {
  sql(`update vacante set estado = 'PUBLICADA', publicada_en = now(), calificacion_automatica = true
        where id = ${id} and titulo like ${literal(`${MARCA}%`)};`)
}

/** El formulario de postular del portal: currículum, resultado y «Sí» a cada requisito. */
async function postularDesdeElPortal(page: Page, vacanteId: number) {
  await page.goto(`/vacantes/${vacanteId}/postular`)
  await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })
  await page.setInputFiles('input[type=file]', {
    name: 'curriculum.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 curriculum QA V70'),
  })
  await page.getByLabel('Cuéntalo con tus palabras').fill('Ordené los arqueos de tres sedes y los descuadres bajaron a cero.')
  for (const grupo of await page.locator('fieldset').filter({ has: page.getByRole('radio') }).all()) {
    await grupo.getByText('Sí', { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Enviar mi postulación' }).click()
}

async function entregarElBanco(page: Page, uuid: string) {
  await page.goto(`/procesos/${uuid}/evaluacion`)
  await page.getByRole('button', { name: /Empezar evaluación/ }).click()
  await page.getByLabel('Tu respuesta').fill(RESPUESTA)
  await page.getByRole('button', { name: /Entregar evaluación/ }).click()
  await page.getByRole('button', { name: 'Entregar', exact: true }).click()
}

test.describe('QA · la prueba al instante y la campana en cada etapa', () => {
  // Sin modo serie a propósito: cada caso es independiente y un fallo no debe esconder los demás
  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    sinBanco = await vacante('V70 sin banco con pase', { banco: false, pase: true, cronometrada: false })
    await exigir(`/panel/vacantes/${sinBanco}/requisitos`, equipo, 'POST', {
      descripcion: 'Vives en Lima Metropolitana',
      regla: 'Residencia en Lima',
    })

    // El cuestionario técnico: una vacante de antes de la V67 (como en FlujoPruebaAlInstanteIT)
    conCuestionario = await crearVacante(equipo, 'V70 cuestionario con pase', await lugarDe(equipo))
    await exigir(`/panel/vacantes/${conCuestionario}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
    sql(`update vacante set instrumento_etapa_tecnica = 'CUESTIONARIO_TECNICO', minutos_etapa_tecnica = 45
          where id = ${conCuestionario};`)
    const version = Number(
      JSON.parse(
        sql(`with f as (insert into version_banco (organizacion_id, tipo_banco, nivel_puesto_codigo, etiqueta, estado,
                                                   metodo_calificacion, vacante_id, publicada_en, creado_en)
                        select organizacion_id, 'VACANTE', 'EJECUCION', ${literal(`${MARCA} cuestionario`)}, 'PUBLICADA',
                               'CRITERIOS', id, now(), now() from vacante where id = ${conCuestionario}
                        returning id)
             select json_agg(f) from f;`),
      )[0].id,
    )
    sql(`insert into pregunta (version_banco_id, codigo, enunciado, tipo, peso, es_puntuable, es_eliminatorio,
                               presencial, orden, c3_esperado, c4_esperado, senal_de_cero, creado_en)
         values (${version}, 'T01', '¿Cuántas cajas has tenido a cargo?', 'ABIERTA', 1, true, false, false, 1,
                 'número de sedes', 'el faltante', 'No da ninguna cifra', now());`)
    publicarComoLasDeAntes(conCuestionario)

    // Pase automático con banco y SIN prueba montada: a medio montar, como las de antes
    sinPrueba = await crearVacante(equipo, 'V70 con banco y sin prueba', await lugarDe(equipo))
    await escribirBorrador(equipo, sinPrueba, [
      { nombre: 'General', preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA_DEL_BANCO, puntos: 100, queDebeTener: 'El monto.' }] },
    ])
    await publicarPreguntas(equipo, sinPrueba)
    publicarComoLasDeAntes(sinPrueba)

    conBanco = await vacante('V70 con banco y pase', { banco: true, pase: true, cronometrada: true })
    sinPase = await vacante('V70 con banco sin pase', { banco: true, pase: false, cronometrada: true })
    paraEliminar = await vacante('V70 para eliminar', { banco: false, pase: true, cronometrada: true })
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('AC-2 · sin banco, al postular desde el portal cae en la portada de su prueba con un solo correo bien escrito', async ({ page }) => {
    const ana = await cuentaDeCandidato('Ana', correos)
    await entrarAlPortalCon(page, ana.token)
    await page.goto('/procesos')
    await expect(page.getByRole('button', { name: 'Avisos' })).toBeVisible()

    await postularDesdeElPortal(page, sinBanco)

    await expect(page).toHaveURL(/\/procesos\/[0-9a-f-]+\/prueba$/, { timeout: 20_000 })
    await expect(page.getByText('Tu prueba del puesto ya está disponible')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })
    const uuid = page.url().split('/procesos/')[1]!.split('/')[0]!
    const id = postulacionPorUuid(uuid)
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id} and iniciado_en is null`).n)).toBe(1)
    expect(String(uno(`select motivo from transicion_estado where postulacion_id = ${id} order by id desc limit 1`).motivo)).toBe(
      'Pase automático al postular: la nota se calcula después',
    )

    // AC-8, AC-20, AC-21 (sin cronómetro, con fecha): un solo PRUEBA_DISPONIBLE, completo y en hora de Lima
    const suyos = correosDe(ana.correo)
    expect(suyos.map((c) => c.codigo)).toEqual(['CUENTA_CREADA', 'POSTULACION_RECIBIDA', 'PRUEBA_DISPONIBLE'])
    const prueba = suyos[2]!
    const fecha = dichaEnLima(`select prueba_cierra_en from vacante where id = ${sinBanco}`)
    expect(String(prueba.cuerpo)).toContain('Hola Ana:')
    expect(String(prueba.cuerpo)).toContain(`«${MARCA} V70 sin banco con pase»`)
    expect(String(prueba.cuerpo)).toContain(`Tienes hasta el ${fecha}.`)
    expect(String(prueba.cuerpo)).not.toContain('desde este correo')
    expect(`${prueba.asunto} ${prueba.cuerpo}`).not.toMatch(/\{\{/)

    // AC-10 · la campana ya lo cuenta en esta misma pantalla, sin recargar
    expect(avisosDe(ana.correo).map((a) => a.tipo)).toEqual(['PRUEBA_DISPONIBLE'])
    await expect(page.getByRole('button', { name: 'Avisos, 1 sin leer' })).toBeVisible({ timeout: 10_000 })
  })

  test('AC-9 · un requisito incumplido sigue llevando a «No continúa», sin prueba, con correo y campana', async () => {
    const beto = await cuentaDeCandidato('Beto', correos)
    const uuid = await postular(beto.token, sinBanco) // sin confirmar el requisito
    const id = postulacionPorUuid(uuid)
    expect(estadoDeLaPostulacion(id)).toBe('NO_CONTINUA')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(0)
    expect(correosDe(beto.correo).map((c) => c.codigo)).toContain('POSTULACION_NO_CONTINUA')
    expect(correosDe(beto.correo).map((c) => c.codigo)).not.toContain('PRUEBA_DISPONIBLE')
    const avisos = avisosDe(beto.correo)
    expect(avisos.map((a) => a.tipo)).toEqual(['POSTULACION_NO_CONTINUA'])
    expect(Number(avisos[0]!.postulacion_id)).toBe(id)
    expect(String(avisos[0]!.titulo)).toBe(`Tu proceso para ${MARCA} V70 sin banco con pase no continúa`)
  })

  test('AC-3 · con el cuestionario técnico, al postular cae en la portada del cuestionario', async ({ page }) => {
    const caro = await cuentaDeCandidato('Caro', correos)
    await entrarAlPortalCon(page, caro.token)

    await postularDesdeElPortal(page, conCuestionario)

    await expect(page).toHaveURL(/\/procesos\/[0-9a-f-]+\/prueba-tecnica$/, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Empezar la prueba' })).toBeVisible({ timeout: 20_000 })
    const id = postulacionPorUuid(page.url().split('/procesos/')[1]!.split('/')[0]!)
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(String(uno(`select e.estado from evaluacion e join postulacion p on p.evaluacion_tecnica_id = e.id
                        where p.id = ${id}`).estado)).toBe('PENDIENTE')
    const prueba = correosDe(caro.correo).filter((c) => c.codigo === 'PRUEBA_DISPONIBLE')
    expect(prueba).toHaveLength(1)
    expect(`${prueba[0]!.asunto} ${prueba[0]!.cuerpo}`).not.toMatch(/\{\{/)
    expect(String(prueba[0]!.cuerpo)).not.toMatch(/Tienes \./)
  })

  test('AC-7 · con pase y sin prueba montada, al entregar espera y se le dice que se le avisará', async ({ page }) => {
    const dani = await cuentaDeCandidato('Dani', correos)
    const uuid = await postular(dani.token, sinPrueba)
    await entrarAlPortalCon(page, dani.token)

    await entregarElBanco(page, uuid)

    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`), { timeout: 20_000 })
    await expect(
      page.getByText('Evaluación entregada. Te avisaremos por correo y en la campana cuando te toque la prueba.'),
    ).toBeVisible()
    const id = postulacionPorUuid(uuid)
    expect(['PERFIL_CALIFICANDO', 'PERFIL_POR_CONFIRMAR']).toContain(estadoDeLaPostulacion(id))
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(0)
    expect(correosDe(dani.correo).map((c) => c.codigo)).not.toContain('PRUEBA_DISPONIBLE')
  })

  test('Caso límite · dos entregas a la vez: la segunda falla, una sola transición y una sola prueba', async () => {
    const eva = await cuentaDeCandidato('Eva', correos)
    const uuid = await postular(eva.token, conBanco)
    const id = postulacionPorUuid(uuid)
    const inicio = await pedir(`/portal/evaluacion/${uuid}/inicio`, eva.token, 'POST')
    expect(inicio.estado).toBe(200)
    const preguntaId = Number(
      uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
            where p.id = ${id}`).pregunta_id,
    )
    expect((await pedir(`/portal/evaluacion/${uuid}/respuestas/${preguntaId}`, eva.token, 'PUT', { texto: RESPUESTA })).estado).toBe(200)

    const [una, otra] = await Promise.all([
      pedir(`/portal/evaluacion/${uuid}/entrega`, eva.token, 'POST'),
      pedir(`/portal/evaluacion/${uuid}/entrega`, eva.token, 'POST'),
    ])

    expect([una.estado, otra.estado].filter((e) => e >= 200 && e < 300)).toHaveLength(1)
    expect(
      Number(uno(`select count(*) as n from transicion_estado where postulacion_id = ${id}
                   and estado_nuevo_codigo = 'PERFIL_CALIFICANDO'`).n),
    ).toBe(1)
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(Number(uno(`select count(*) as n from intento_prueba where postulacion_id = ${id}`).n)).toBe(1)
    expect(correosDe(eva.correo).filter((c) => c.codigo === 'PRUEBA_DISPONIBLE')).toHaveLength(1)
  })

  test('AC-5 · con la nota del perfil por llegar, el ranking y la ficha dicen «en camino»', async ({ page }) => {
    const fer = await cuentaDeCandidato('Fer', correos)
    const uuid = await postular(fer.token, conBanco)
    const id = postulacionPorUuid(uuid)
    await pedir(`/portal/evaluacion/${uuid}/inicio`, fer.token, 'POST')
    const preguntaId = Number(
      uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
            where p.id = ${id}`).pregunta_id,
    )
    await exigir(`/portal/evaluacion/${uuid}/respuestas/${preguntaId}`, fer.token, 'PUT', { texto: RESPUESTA })
    await exigir(`/portal/evaluacion/${uuid}/entrega`, fer.token, 'POST')
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')

    // La IA está apagada en el preview: el trabajo vivo se siembra como lo deja la cola
    const trabajo = Number(
      JSON.parse(
        sql(`with f as (insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, estado, modo)
                        select organizacion_id, 'DATOS_CV', id, 'PENDIENTE', 'FINA' from postulacion where id = ${id}
                        returning id)
             select json_agg(f) from f;`),
      )[0].id,
    )
    try {
      await entrarAlPanelCon(page, equipo)
      await page.goto(`/admin/vacantes/${conBanco}`)
      await page.getByRole('button', { name: /^Toda la tanda/ }).click()
      const fila = page.getByRole('row').filter({ hasText: 'Fer Preguntas QA' })
      // «—» con «en camino» debajo: ni un 0 ni un hueco sin explicar
      await expect(fila.getByRole('cell', { name: /en camino/ })).toHaveText(/^—\s*en camino$/, { timeout: 20_000 })
      await page.getByRole('button', { name: 'Fer Preguntas QA' }).click()
      await expect(page.getByText('Nota en camino: la IA la está calculando y aparecerá aquí cuando termine.')).toBeVisible()
      await expect(page.getByText('Pase automático al entregar: la nota se calcula después').first()).toBeVisible()
    } finally {
      quitarTrabajo(trabajo)
    }
  })

  test('AC-20/AC-21 · en el pase manual, PRUEBA_DISPONIBLE sale con el tiempo y la fecha de su intento', async () => {
    const juan = await cuentaDeCandidato('Juan', correos)
    const uuid = await postular(juan.token, sinPase)
    const id = postulacionPorUuid(uuid)
    await exigir(`/portal/evaluacion/${uuid}/inicio`, juan.token, 'POST')
    const preguntaId = Number(
      uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
            where p.id = ${id}`).pregunta_id,
    )
    await exigir(`/portal/evaluacion/${uuid}/respuestas/${preguntaId}`, juan.token, 'PUT', { texto: RESPUESTA })
    await exigir(`/portal/evaluacion/${uuid}/entrega`, juan.token, 'POST')
    expect(correosDe(juan.correo).map((c) => c.codigo)).not.toContain('PRUEBA_DISPONIBLE')

    for (let paso = 0; paso < 2 && estadoDeLaPostulacion(id) !== 'PRUEBA_TURNO_CANDIDATO'; paso++) {
      await exigir(`/panel/postulaciones/${id}/confirmacion-avance`, equipo, 'POST', { motivo: `${MARCA}: confirma el equipo` })
    }
    expect(estadoDeLaPostulacion(id)).toBe('PRUEBA_TURNO_CANDIDATO')

    const prueba = correosDe(juan.correo).filter((c) => c.codigo === 'PRUEBA_DISPONIBLE')
    expect(prueba).toHaveLength(1)
    const fecha = dichaEnLima(`select vence_en from intento_prueba where postulacion_id = ${id}`)
    expect(String(prueba[0]!.cuerpo)).toContain('Hola Juan:')
    expect(String(prueba[0]!.cuerpo)).toContain(`«${MARCA} V70 con banco sin pase»`)
    expect(String(prueba[0]!.cuerpo)).toContain(`Tienes 90 minutos desde que la empieces, hasta el ${fecha}.`)
    expect(`${prueba[0]!.asunto} ${prueba[0]!.cuerpo}`).not.toMatch(/\{\{/)
    const aviso = avisosDe(juan.correo).filter((a) => a.tipo === 'PRUEBA_DISPONIBLE')
    expect(aviso).toHaveLength(1)
    expect(String(aviso[0]!.titulo)).toBe(`Tu prueba del puesto está disponible · ${MARCA} V70 con banco sin pase`)
  })

  test('AC-10/AC-11 · retiro con correo y campana; «sin avisar» sin nada; vacante eliminada con un solo aviso', async () => {
    // Retiro: el correo y su aviso, ligado al proceso
    const gus = await cuentaDeCandidato('Gus', correos)
    const uuidGus = await postular(gus.token, sinPase)
    await exigir(`/portal/postulaciones/${uuidGus}/retiro`, gus.token, 'POST')
    expect(correosDe(gus.correo).map((c) => c.codigo)).toContain('RETIRO_CONFIRMADO')
    const retiro = avisosDe(gus.correo).filter((a) => a.tipo === 'RETIRO_CONFIRMADO')
    expect(retiro).toHaveLength(1)
    expect(Number(retiro[0]!.postulacion_id)).toBe(postulacionPorUuid(uuidGus))

    // «Sin avisar»: ni correo ni aviso, y queda escrito en la transición
    const hugo = await cuentaDeCandidato('Hugo', correos)
    const idHugo = postulacionPorUuid(await postular(hugo.token, sinPase))
    const correosAntes = correosDe(hugo.correo).length
    const avisosAntes = avisosDe(hugo.correo).length
    for (const destino of ['PERFIL_POR_CONFIRMAR', 'PERFIL_TURNO_CANDIDATO']) {
      await exigir(`/panel/postulaciones/${idHugo}/transiciones`, equipo, 'POST', {
        estadoDestino: destino,
        motivo: `${MARCA}: se mueve sin avisar`,
        avisar: false,
      })
    }
    expect(correosDe(hugo.correo)).toHaveLength(correosAntes)
    expect(avisosDe(hugo.correo)).toHaveLength(avisosAntes)
    expect(String(uno(`select aviso_al_candidato from transicion_estado where postulacion_id = ${idHugo}
                        order by id desc limit 1`).aviso_al_candidato)).toBe('NINGUNO')

    // Vacante eliminada: el aviso propio, uno solo, y ningún correo de cierre
    const ines = await cuentaDeCandidato('Ines', correos)
    const idInes = postulacionPorUuid(await postular(ines.token, paraEliminar))
    expect(estadoDeLaPostulacion(idInes)).toBe('PRUEBA_TURNO_CANDIDATO')
    const correosDeInes = correosDe(ines.correo).length
    const eliminada = await pedir(`/panel/vacantes/${paraEliminar}`, equipo, 'DELETE', { motivo: `${MARCA}: se publicó por error` })
    expect(eliminada.estado).toBe(200)
    expect(estadoDeLaPostulacion(idInes)).toBe('CERRADA')
    expect(avisosDe(ines.correo).map((a) => a.tipo)).toEqual(['PRUEBA_DISPONIBLE', 'VACANTE_ELIMINADA'])
    expect(correosDe(ines.correo)).toHaveLength(correosDeInes)
  })
})
