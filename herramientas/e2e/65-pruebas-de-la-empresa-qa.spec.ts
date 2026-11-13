/**
 * «Pruebas» (specs/pruebas-indice-de-la-empresa): las regresiones de la QA contra el
 * preview real, lo que los dos recorridos de `64-pruebas-de-la-empresa` no cubren.
 *
 *   - AC-07 / AC-08: la publicada con un borrador abierto y la vacante que solo tiene borrador.
 *   - AC-03: la versión que quedó en una vacante que ya no la usa (pasó al banco del nivel,
 *     a «sin evaluación» o a una plantilla) no sale, ni su vista previa.
 *   - AC-11 / AC-12 / AC-15: los destinos de la copia en pantalla (deshabilitada con
 *     postulantes, confirmar el borrador, fuera la que no usa el editor) y por API.
 *   - AC-13: el responsable de área (sin `editar_vacante`) no ve «Usar en otra vacante».
 *   - AC-05: con `ver_vacantes` de alcance SUS_VACANTES solo salen las suyas.
 *   - AC-04 / AC-14: otra empresa no ve nada nuestro, su vista previa es 404 y sus dos
 *     pestañas están vacías.
 *   - AC-01: sin `ver_vacantes` no hay «Pruebas» y la dirección enseña el aviso de permiso.
 *   - AC-06: los filtros combinados desde la dirección y en el servidor.
 *   - AC-09: «Abrir en la vacante» desde una fila de preguntas.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo: vacantes con la marca `QA-PE-0067` y un código propio
 * de la corrida, cuentas de panel `qa-pe-0067-*`, un rol `QA_PE_0067_*`, la empresa B y una
 * cuenta de candidato con su postulación. Lo retira `retirarLoSembrado` de `ayuda-prueba-propia`.
 */

import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel, tokenDelPanel } from './ayuda'
import { crearCuentaDeCandidato } from './ayuda-candidato'
import {
  elegirLaPruebaDelPuesto,
  entrarAlPanelCon,
  escribirBorrador,
  exigir,
  pedir,
  publicarPreguntas,
  RUTA as RUTA_PREGUNTAS,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import {
  crearVacante,
  empresaB,
  escribirPrueba,
  lugarDe,
  publicarPrueba,
  retirarLoSembrado,
  RUTA as RUTA_PRUEBA,
  sembrarEquipoSin,
} from './ayuda-prueba-propia'
import { correoDePrueba, literal, sql } from './base-de-datos'

test.describe.configure({ mode: 'serial' })

const SUFIJO = Math.random().toString(36).slice(2, 7)
/** Lo que distingue lo sembrado en esta corrida de cualquier otra cosa del clon. */
const CODIGO = `Indice QA ${SUFIJO}`
const MARCA_SEMBRADO = 'QA-PE-0067 sembrado por la QA del índice de pruebas'

const correos: string[] = []
let token = ''
const v = {
  /** Preguntas publicadas y además un borrador abierto con un criterio de más. */
  publicada: 0,
  /** Solo borrador, con 40 de 100 puntos: en el editor tendría faltas. */
  borrador: 0,
  /** Preguntas publicadas y una postulación: ya la rinde alguien. */
  conPostulantes: 0,
  /** Un destino con borrador: la copia pide confirmar el reemplazo. */
  destinoConBorrador: 0,
  /** Preguntas publicadas y sin postulantes, hasta que alguien postula con el bloque abierto. */
  empiezaARendirse: 0,
  /** Publicó sus preguntas y después pasó al banco del nivel. */
  porNivel: 0,
  /** Escribió un borrador y después pasó a «sin evaluación». */
  sinEvaluacion: 0,
  /** La prueba del puesto publicada (pestaña de la prueba). */
  pruebaPublicada: 0,
  /** Escribió la prueba en el editor y después se le asignó una plantilla. */
  conPlantilla: 0,
}
const t = {
  responsableDeArea: '',
  susVacantes: '',
  sinVerVacantes: '',
  empresaB: '',
}

const nombreDe = {
  publicada: 'Publicada con borrador',
  borrador: 'Solo borrador',
  conPostulantes: 'Con postulación',
  destinoConBorrador: 'Destino con borrador',
  empiezaARendirse: 'Empieza a rendirse',
  porNivel: 'Pasó al banco del nivel',
  sinEvaluacion: 'Sin evaluación',
  pruebaPublicada: 'Prueba publicada',
  conPlantilla: 'Pasó a una plantilla',
} as const

const linea = (page: Page) => page.getByRole('searchbox', { name: 'Buscar vacante o filtrar' })
const ver = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^Ver .*${CODIGO} ${nombre}`) })
const filaDe = (page: Page, nombre: string) => page.locator('tr', { has: ver(page, nombre) })
const verTodas = (page: Page) => page.getByRole('button', { name: new RegExp(`^Ver .*${CODIGO}`) })
const lectura = (page: Page) => page.locator('#lectura')
const indice = (q: string) => `/admin/pruebas?${q}`

function insertar(consulta: string): number {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as { id: number }[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas`)
  return Number(filas[0]!.id)
}

/** Una cuenta de panel de la plataforma (dev-login) con un rol. Su prefijo lo retira la limpieza. */
function cuentaDePanel(renaserOsId: string, rolId: number): number {
  const persona = insertar(`insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id`)
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const usuario = insertar(`insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
                            values (${plataforma}, ${persona}, ${literal(renaserOsId)}, true, true) returning id`)
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rolId});`)
  return usuario
}

const titulosDe = (filas: { titulo: string }[]) => filas.map((f) => f.titulo.replace(`QA-PE-0067 ${CODIGO} `, '')).sort()

test.beforeAll(async () => {
  token = await tokenDelPanel()
  const ejecucion = await lugarDe(token, 'EJECUCION')
  const supervision = await lugarDe(token, 'SUPERVISION')
  const cienPuntos = (criterio: string, enunciado: string) => [
    { nombre: criterio, preguntas: [{ tipo: 'ABIERTA' as const, enunciado, puntos: 100, queDebeTener: 'El arqueo' }] },
  ]

  v.publicada = await crearVacante(token, `${CODIGO} ${nombreDe.publicada}`, ejecucion)
  await escribirBorrador(token, v.publicada, cienPuntos('Rigor de la publicada', '¿Qué haces si la caja no cuadra?'))
  await publicarPreguntas(token, v.publicada)
  // Editar con una publicada y sin postulantes abre un borrador, copia de la publicada.
  await exigir(`${RUTA_PREGUNTAS(v.publicada)}/criterios`, token, 'POST', { nombre: 'Solo en el borrador' })

  v.borrador = await crearVacante(token, `${CODIGO} ${nombreDe.borrador}`, supervision)
  await escribirBorrador(token, v.borrador, [
    { nombre: 'Trato con el cliente', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Cuenta un reclamo difícil', puntos: 40, queDebeTener: 'Calma' }] },
  ])

  v.conPostulantes = await crearVacante(token, `${CODIGO} ${nombreDe.conPostulantes}`, ejecucion)
  await escribirBorrador(token, v.conPostulantes, cienPuntos('Orden con el efectivo', '¿Cómo cierras la caja?'))
  await publicarPreguntas(token, v.conPostulantes)
  const correo = correoDePrueba('qa.pe.0067.indice')
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre: 'Inés', apellidos: 'Índice QA', correo })
  // La vacante publicada y una postulación: lo que la pantalla y la copia miran.
  sql(`update vacante set estado = 'PUBLICADA', publicada_en = now() where id = ${v.conPostulantes};`)
  insertar(`insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
            select v.organizacion_id, u.id, v.id, 'PERFIL_POR_CONFIRMAR'
              from vacante v, usuario u where v.id = ${v.conPostulantes} and u.correo = ${literal(correo)}
            returning id`)

  v.destinoConBorrador = await crearVacante(token, `${CODIGO} ${nombreDe.destinoConBorrador}`, ejecucion)
  await escribirBorrador(token, v.destinoConBorrador, [
    { nombre: 'Borrador del destino', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Lo que ya tenía', puntos: 30, queDebeTener: 'Algo' }] },
  ])

  v.empiezaARendirse = await crearVacante(token, `${CODIGO} ${nombreDe.empiezaARendirse}`, ejecucion)
  await escribirBorrador(token, v.empiezaARendirse, cienPuntos('Lo publicado antes', '¿Cómo atiendes la fila?'))
  await publicarPreguntas(token, v.empiezaARendirse)

  v.porNivel = await crearVacante(token, `${CODIGO} ${nombreDe.porNivel}`, ejecucion)
  await escribirBorrador(token, v.porNivel, cienPuntos('Lo que dejó escrito', '¿Qué harías el primer día?'))
  await publicarPreguntas(token, v.porNivel)
  await exigir(`/panel/vacantes/${v.porNivel}/origen-preguntas`, token, 'POST', { origen: 'NIVEL' })

  v.sinEvaluacion = await crearVacante(token, `${CODIGO} ${nombreDe.sinEvaluacion}`, ejecucion)
  await escribirBorrador(token, v.sinEvaluacion, [
    { nombre: 'Borrador olvidado', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Una pregunta', puntos: 50, queDebeTener: 'Algo' }] },
  ])
  await exigir(`/panel/vacantes/${v.sinEvaluacion}/origen-preguntas`, token, 'POST', { origen: 'SIN_EVALUACION' })

  v.pruebaPublicada = await crearVacante(token, `${CODIGO} ${nombreDe.pruebaPublicada}`, ejecucion)
  await escribirPrueba(token, v.pruebaPublicada, {
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 45 },
    criterios: [{ nombre: 'Calidad del informe', puntos: 100, calificador: 'IA', preguntas: [] }],
    entregables: [{ nombre: 'Informe de caja', formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true }],
  })
  const publicada = await publicarPrueba(token, v.pruebaPublicada)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba falló: ${publicada.estado}`)

  v.conPlantilla = await crearVacante(token, `${CODIGO} ${nombreDe.conPlantilla}`, ejecucion)
  await escribirPrueba(token, v.conPlantilla, {
    datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
    criterios: [{ nombre: 'Lo que quedó escrito', puntos: 100, calificador: 'IA', preguntas: [] }],
    entregables: [{ nombre: 'Un archivo', formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true }],
  })
  await elegirLaPruebaDelPuesto(token, v.conPlantilla)

  // El responsable de área del sistema: ver_vacantes con alcance TODO y sin editar_vacante.
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const rolDelResponsable = Number(uno(`select id from rol where organizacion_id = ${plataforma} and codigo = 'RESPONSABLE_AREA'`).id)
  const responsableDeArea = `qa-pe-0067-ra-${SUFIJO}`
  cuentaDePanel(responsableDeArea, rolDelResponsable)
  t.responsableDeArea = await tokenDePanel(responsableDeArea)

  // Un rol configurado con ver_vacantes de alcance SUS_VACANTES, dueño de una sola vacante.
  const codigoRol = `QA_PE_0067_SUS_${SUFIJO.toUpperCase()}`
  const rolSus = insertar(`insert into rol (organizacion_id, codigo, nombre, descripcion)
                           values (${plataforma}, ${literal(codigoRol)}, ${literal(codigoRol)}, ${literal(MARCA_SEMBRADO)}) returning id`)
  sql(`insert into rol_permiso (rol_id, permiso_id, alcance)
       select ${rolSus}, id, 'SUS_VACANTES' from permiso where codigo = 'ver_vacantes';`)
  const susVacantes = `qa-pe-0067-sus-${SUFIJO}`
  const usuarioSus = cuentaDePanel(susVacantes, rolSus)
  sql(`update vacante set responsable_usuario_id = ${usuarioSus} where id = ${v.borrador};`)
  t.susVacantes = await tokenDePanel(susVacantes)

  t.sinVerVacantes = await tokenDePanel(sembrarEquipoSin(`sin-ver-${SUFIJO}`, ['ver_vacantes']))
  t.empresaB = (await empresaB(correos)).token
})

test.afterAll(() => {
  retirarLoSembrado(correos)
})

test('AC-07/AC-08 · la publicada manda sobre su borrador abierto; la que solo tiene borrador se ve con su etiqueta', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))

  const publicada = filaDe(page, nombreDe.publicada)
  await expect(publicada).toContainText('Publicada')
  await expect(publicada).toContainText('Hay un borrador abierto')
  await expect(publicada).toContainText('1 criterio · 1 pregunta')

  await ver(page, nombreDe.publicada).click()
  await expect(lectura(page).getByText('Rigor de la publicada')).toBeVisible()
  await expect(lectura(page).getByText('Solo en el borrador')).toHaveCount(0)
  await expect(lectura(page).getByText('Borrador: todavía puede cambiar')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/vacante=/)

  // La de solo borrador va abajo, en «Borradores sin publicar», sin copia posible.
  const borrador = filaDe(page, nombreDe.borrador)
  await expect(borrador).toContainText('Borrador')
  await expect(borrador).toContainText('Sin publicar')
  await expect(page.locator('tbody', { has: ver(page, nombreDe.borrador) }).locator('th')).toContainText('Borradores sin publicar')
  await expect(page.locator('tbody', { has: ver(page, nombreDe.publicada) }).locator('th')).toContainText('Publicadas')
  await expect(borrador.getByRole('button', { name: /en otra vacante/ })).toHaveCount(0)

  await ver(page, nombreDe.borrador).click()
  await expect(lectura(page).getByText('Borrador: todavía puede cambiar')).toBeVisible()
  await expect(lectura(page).getByText('Trato con el cliente')).toBeVisible()
  await expect(lectura(page).getByText(/por arreglar/i)).toHaveCount(0)
  await expect(lectura(page).getByRole('button', { name: 'Usar en otra vacante' })).toHaveCount(0)

  // La API tampoco trae sus avisos: son del editor.
  const previa = await exigir<{ estado: string; avisos: string[] }>(`/panel/pruebas/${v.borrador}?tipo=PERFIL_INTEGRAL`, token)
  expect(previa.estado).toBe('BORRADOR')
  expect(previa.avisos).toEqual([])
})

test('AC-03 · lo que quedó en una vacante que ya no lo usa no sale, ni se puede mirar', async ({ page }) => {
  const preguntas = await exigir<{ titulo: string }[]>(`/panel/pruebas?tipo=PERFIL_INTEGRAL&buscar=${encodeURIComponent(CODIGO)}`, token)
  expect(titulosDe(preguntas)).toEqual(
    [nombreDe.conPostulantes, nombreDe.destinoConBorrador, nombreDe.empiezaARendirse, nombreDe.publicada, nombreDe.borrador].sort(),
  )
  const prueba = await exigir<{ titulo: string }[]>(`/panel/pruebas?tipo=PRUEBA_PUESTO&buscar=${encodeURIComponent(CODIGO)}`, token)
  expect(titulosDe(prueba)).toEqual([nombreDe.pruebaPublicada])

  expect((await pedir(`/panel/pruebas/${v.porNivel}?tipo=PERFIL_INTEGRAL`, token)).estado).toBe(404)
  expect((await pedir(`/panel/pruebas/${v.sinEvaluacion}?tipo=PERFIL_INTEGRAL`, token)).estado).toBe(404)
  expect((await pedir(`/panel/pruebas/${v.conPlantilla}?tipo=PRUEBA_PUESTO`, token)).estado).toBe(404)

  await entrarAlPanel(page)
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))
  await expect(verTodas(page)).toHaveCount(5)
  await expect(ver(page, nombreDe.porNivel)).toHaveCount(0)
  await expect(ver(page, nombreDe.sinEvaluacion)).toHaveCount(0)
  await page.getByRole('tab', { name: /Prueba del puesto/ }).click()
  await expect(verTodas(page)).toHaveCount(1)
  await expect(filaDe(page, nombreDe.pruebaPublicada)).toContainText('1 criterio · 0 preguntas · 1 entregable · 45 min')
})

test('AC-11/AC-12/AC-15 · en el bloque de copia: con postulantes deshabilitada, sin el editor fuera, y con borrador se confirma', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))
  await page.getByRole('button', { name: new RegExp(`^Usar «.*${CODIGO} ${nombreDe.publicada}.*» en otra vacante`) }).click()
  const grupo = page.getByRole('radiogroup', { name: 'Vacante destino' })
  await expect(grupo).toBeVisible()
  await page.getByRole('searchbox', { name: 'Vacante destino' }).fill(CODIGO)
  const destino = (nombre: string) => grupo.getByRole('radio', { name: new RegExp(`${CODIGO} ${nombre}`) })

  await expect(destino(nombreDe.conPostulantes)).toBeDisabled()
  await expect(grupo.locator('label', { has: page.getByRole('radio', { name: new RegExp(`${CODIGO} ${nombreDe.conPostulantes}`) }) })).toContainText(
    'Ya tiene postulantes: sus preguntas no se reemplazan',
  )
  await expect(destino(nombreDe.porNivel)).toHaveCount(0)
  await expect(destino(nombreDe.sinEvaluacion)).toHaveCount(0)
  await expect(destino(nombreDe.publicada)).toHaveCount(0)
  await expect(destino(nombreDe.destinoConBorrador)).toBeEnabled()
  await expect(grupo.locator('label', { has: page.getByRole('radio', { name: new RegExp(`${CODIGO} ${nombreDe.destinoConBorrador}`) }) })).toContainText('Tiene un borrador')

  const aviso = page.getByText('Ya hay un borrador en esta vacante: la copia lo reemplaza entero.')
  await destino(nombreDe.destinoConBorrador).check()
  await page.getByRole('button', { name: 'Copiar y abrir' }).click()
  await expect(aviso).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/pruebas/)
  // Hasta confirmar, el borrador del destino sigue como estaba.
  const sinTocar = await exigir<any>(RUTA_PREGUNTAS(v.destinoConBorrador), token)
  expect(sinTocar.borrador.criterios.map((c: any) => c.nombre)).toEqual(['Borrador del destino'])

  await page.getByRole('button', { name: 'Elegir otra' }).click()
  await expect(aviso).toHaveCount(0)
  await destino(nombreDe.destinoConBorrador).check()
  await page.getByRole('button', { name: 'Copiar y abrir' }).click()
  await page.getByRole('button', { name: 'Reemplazar y copiar' }).click()

  await expect(page).toHaveURL(new RegExp(`/admin/vacantes/${v.destinoConBorrador}/preguntas$`))
  const copiado = await exigir<any>(RUTA_PREGUNTAS(v.destinoConBorrador), token)
  expect(copiado.borrador.criterios.map((c: any) => c.nombre)).toEqual(['Rigor de la publicada'])
  expect(copiado.borrador.total).toBe(100)
  // Se copia la publicada, no el borrador abierto del origen, que sigue igual.
  const origen = await exigir<any>(RUTA_PREGUNTAS(v.publicada), token)
  expect(origen.borrador.criterios.map((c: any) => c.nombre)).toContain('Solo en el borrador')
})

test('AC-11/AC-15 · por API: los destinos dicen el motivo y el servidor rechaza las dos copias', async () => {
  const destinos = await exigir<{ vacanteId: number; puedeRecibir: boolean; motivo: string | null }[]>(
    `/panel/pruebas/destinos?tipo=PERFIL_INTEGRAL&excluir=${v.publicada}`,
    token,
  )
  const ids = destinos.map((d) => d.vacanteId)
  expect(ids).not.toContain(v.publicada)
  expect(ids).not.toContain(v.porNivel)
  expect(ids).not.toContain(v.sinEvaluacion)
  expect(destinos.find((d) => d.vacanteId === v.conPostulantes)).toMatchObject({
    puedeRecibir: false,
    motivo: 'Ya tiene postulantes: sus preguntas no se reemplazan',
  })
  expect(destinos.find((d) => d.vacanteId === v.borrador)).toMatchObject({ puedeRecibir: true })

  const conPostulantes = await pedir(`${RUTA_PREGUNTAS(v.conPostulantes)}/copia`, token, 'POST', { vacanteOrigenId: v.publicada })
  expect(conPostulantes.estado).toBe(409)
  expect(JSON.stringify(conPostulantes.cuerpo)).toContain('Esta vacante ya tiene postulantes')

  for (const sinEditor of [v.porNivel, v.sinEvaluacion]) {
    const antes = await exigir<any>(RUTA_PREGUNTAS(sinEditor), token)
    const r = await pedir(`${RUTA_PREGUNTAS(sinEditor)}/copia`, token, 'POST', { vacanteOrigenId: v.publicada })
    expect(r.estado, `vacante ${sinEditor}`).toBe(409)
    expect(JSON.stringify(r.cuerpo)).toContain('no responde preguntas propias')
    const despues = await exigir<any>(RUTA_PREGUNTAS(sinEditor), token)
    expect(despues.borrador?.id ?? null).toBe(antes.borrador?.id ?? null)
  }

  const destinosDeLaPrueba = await exigir<{ vacanteId: number }[]>(
    `/panel/pruebas/destinos?tipo=PRUEBA_PUESTO&excluir=${v.pruebaPublicada}`,
    token,
  )
  expect(destinosDeLaPrueba.map((d) => d.vacanteId)).not.toContain(v.conPlantilla)
  expect(destinosDeLaPrueba.map((d) => d.vacanteId)).not.toContain(v.pruebaPublicada)
  const conPlantilla = await pedir(`${RUTA_PRUEBA(v.conPlantilla)}/copia`, token, 'POST', { vacanteOrigenId: v.pruebaPublicada })
  expect(conPlantilla.estado).toBe(409)
  expect(JSON.stringify(conPlantilla.cuerpo)).toContain('no rinde la prueba del editor')
})

test('caso límite · la destino empieza a rendirse entre desplegar y confirmar: el rechazo se dice y queda deshabilitada', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))
  await page.getByRole('button', { name: new RegExp(`^Usar «.*${CODIGO} ${nombreDe.publicada}.*» en otra vacante`) }).click()
  const grupo = page.getByRole('radiogroup', { name: 'Vacante destino' })
  await page.getByRole('searchbox', { name: 'Vacante destino' }).fill(CODIGO)
  const destino = grupo.getByRole('radio', { name: new RegExp(`${CODIGO} ${nombreDe.empiezaARendirse}`) })
  await expect(destino).toBeEnabled()
  await destino.check()

  // Alguien postula con el bloque abierto.
  insertar(`insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
            select v.organizacion_id, u.id, v.id, 'PERFIL_POR_CONFIRMAR'
              from vacante v, usuario u where v.id = ${v.empiezaARendirse} and u.correo = ${literal(correos[0]!)}
            returning id`)
  const antes = await exigir<any>(RUTA_PREGUNTAS(v.empiezaARendirse), token)

  await page.getByRole('button', { name: 'Copiar y abrir' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Esta vacante ya tiene postulantes' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/pruebas/)
  await expect(destino).toBeDisabled()
  await expect(grupo.locator('label', { has: page.getByRole('radio', { name: new RegExp(`${CODIGO} ${nombreDe.empiezaARendirse}`) }) })).toContainText('Ya tiene postulantes: sus preguntas no se reemplazan')
  const despues = await exigir<any>(RUTA_PREGUNTAS(v.empiezaARendirse), token)
  expect(despues.publicada.id).toBe(antes.publicada.id)
  expect(despues.borrador).toBeNull()
})

test('AC-13 · el responsable de área ve el índice sin «Usar en otra vacante», y la API no le deja copiar', async ({ page }) => {
  await entrarAlPanelCon(page, t.responsableDeArea)
  await page.goto('/admin')
  await expect(page.getByRole('navigation', { name: 'Menú del panel' }).getByRole('link', { name: 'Pruebas', exact: true })).toBeVisible()
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))
  await expect(verTodas(page)).toHaveCount(5)
  await expect(page.getByRole('button', { name: /en otra vacante/ })).toHaveCount(0)

  await ver(page, nombreDe.publicada).click()
  await expect(lectura(page).getByText('Rigor de la publicada')).toBeVisible()
  await expect(lectura(page).getByRole('link', { name: 'Abrir en la vacante' })).toBeVisible()
  await expect(lectura(page).getByRole('button', { name: 'Usar en otra vacante' })).toHaveCount(0)

  const filas = await exigir<{ puedeUsarEnOtra: boolean }[]>(
    `/panel/pruebas?tipo=PERFIL_INTEGRAL&buscar=${encodeURIComponent(CODIGO)}`,
    t.responsableDeArea,
  )
  expect(filas.every((f) => !f.puedeUsarEnOtra)).toBe(true)
  expect((await pedir('/panel/pruebas/destinos?tipo=PERFIL_INTEGRAL', t.responsableDeArea)).estado).toBe(403)
  const copia = await pedir(`${RUTA_PREGUNTAS(v.borrador)}/copia`, t.responsableDeArea, 'POST', { vacanteOrigenId: v.publicada })
  expect(copia.estado).toBe(403)
})

test('AC-05 · con ver_vacantes de alcance SUS_VACANTES solo salen las suyas', async ({ page }) => {
  const filas = await exigir<{ vacanteId: number }[]>(
    `/panel/pruebas?tipo=PERFIL_INTEGRAL&buscar=${encodeURIComponent(CODIGO)}`,
    t.susVacantes,
  )
  expect(filas.map((f) => f.vacanteId)).toEqual([v.borrador])
  expect((await pedir(`/panel/pruebas/${v.publicada}?tipo=PERFIL_INTEGRAL`, t.susVacantes)).estado).toBe(404)
  expect((await pedir(`/panel/pruebas/${v.borrador}?tipo=PERFIL_INTEGRAL`, t.susVacantes)).estado).toBe(200)

  await entrarAlPanelCon(page, t.susVacantes)
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))
  await expect(ver(page, nombreDe.borrador)).toBeVisible()
  await expect(verTodas(page)).toHaveCount(1)
})

test('AC-04/AC-14 · otra empresa no ve nada nuestro, su vista previa es 404 y sus dos pestañas están vacías', async ({ page }) => {
  const nuestras = Object.values(v)
  for (const tipo of ['PERFIL_INTEGRAL', 'PRUEBA_PUESTO']) {
    const filas = await exigir<{ vacanteId: number }[]>(`/panel/pruebas?tipo=${tipo}`, t.empresaB)
    expect(filas.filter((f) => nuestras.includes(f.vacanteId))).toEqual([])
    const destinos = await exigir<{ vacanteId: number }[]>(`/panel/pruebas/destinos?tipo=${tipo}`, t.empresaB)
    expect(destinos.filter((d) => nuestras.includes(d.vacanteId))).toEqual([])
  }
  expect((await pedir(`/panel/pruebas/${v.publicada}?tipo=PERFIL_INTEGRAL`, t.empresaB)).estado).toBe(404)
  expect((await pedir(`/panel/pruebas/${v.pruebaPublicada}?tipo=PRUEBA_PUESTO`, t.empresaB)).estado).toBe(404)

  await entrarAlPanelCon(page, t.empresaB)
  await page.goto(indice('tipo=prueba'))
  await expect(page.getByText('Ninguna vacante tiene prueba del puesto todavía').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir a Vacantes' })).toHaveAttribute('href', '/admin')
  await expect(linea(page)).toHaveCount(0)
  await page.getByRole('tab', { name: /Preguntas del Perfil Integral/ }).click()
  await expect(page.getByText('Ninguna vacante tiene preguntas propias todavía').first()).toBeVisible()
})

test('AC-01 · sin ver_vacantes no hay «Pruebas» en el menú y la dirección da el aviso de permiso', async ({ page }) => {
  expect((await pedir(`/panel/pruebas?tipo=PERFIL_INTEGRAL`, t.sinVerVacantes)).estado).toBe(403)

  await entrarAlPanelCon(page, t.sinVerVacantes)
  const sesion = page.waitForResponse((r) => r.url().includes('/panel/sesion') && r.ok())
  await page.goto('/admin/pruebas')
  await sesion
  const menu = page.getByRole('navigation', { name: 'Menú del panel' })
  await expect(menu.getByRole('link', { name: 'Configuración', exact: true })).toBeVisible()
  // El menú de reserva (sin sesión) trae «Vacantes»: que se vaya prueba que ya es el de sus permisos.
  await expect(menu.getByRole('link', { name: 'Vacantes', exact: true })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Pruebas', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText(/permiso/i)
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
})

test('AC-06 · los filtros combinados desde la dirección, en pantalla y en el servidor', async ({ page }) => {
  const buscar = encodeURIComponent(CODIGO)
  const servidor = (q: string) => exigir<{ vacanteId: number }[]>(`/panel/pruebas?tipo=PERFIL_INTEGRAL&buscar=${buscar}&${q}`, token)
  // Las publicadas, la más reciente arriba.
  expect((await servidor('nivel=EJECUCION&estado=PUBLICADA&situacion=SIN_PUBLICAR')).map((f) => f.vacanteId)).toEqual([
    v.empiezaARendirse,
    v.publicada,
  ])
  expect((await servidor('estado=EN_USO&situacion=PUBLICADA')).map((f) => f.vacanteId)).toEqual([v.conPostulantes])
  expect((await servidor('nivel=SUPERVISION&estado=BORRADOR')).map((f) => f.vacanteId)).toEqual([v.borrador])
  // El buscador no distingue tildes ni mayúsculas.
  const sinTildes = await exigir<{ vacanteId: number }[]>(
    `/panel/pruebas?tipo=PERFIL_INTEGRAL&buscar=${encodeURIComponent(`${CODIGO} CON POSTULACION`)}`,
    token,
  )
  expect(sinTildes.map((f) => f.vacanteId)).toEqual([v.conPostulantes])

  await entrarAlPanel(page)
  await page.goto(indice(`tipo=preguntas&buscar=${buscar}&nivel=EJECUCION&estado=PUBLICADA&situacion=SIN_PUBLICAR`))
  await expect(ver(page, nombreDe.publicada)).toBeVisible()
  await expect(verTodas(page)).toHaveCount(2)

  await page.goto(indice(`tipo=preguntas&buscar=${buscar}&estado=EN_USO&situacion=PUBLICADA`))
  await expect(ver(page, nombreDe.conPostulantes)).toBeVisible()
  await expect(verTodas(page)).toHaveCount(1)
  await expect(filaDe(page, nombreDe.conPostulantes)).toContainText('La rinde alguien')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Quitar Estado: La rinde alguien' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quitar Situación: Publicada' })).toBeVisible()
  await expect(verTodas(page)).toHaveCount(1)

  await page.goto(indice(`tipo=preguntas&buscar=${buscar}&nivel=SUPERVISION&estado=PUBLICADA`))
  await expect(page.getByRole('heading', { name: 'Ninguna coincide con los filtros' })).toBeVisible()
  await page.getByRole('button', { name: 'Quitar filtros' }).first().click()
  await expect(page).not.toHaveURL(/nivel=|estado=/)
  await expect(page.getByRole('heading', { name: 'Ninguna coincide con los filtros' })).toHaveCount(0)
})

test('AC-09 · «Abrir en la vacante» desde una fila de preguntas lleva a su editor', async ({ page }) => {
  await entrarAlPanel(page)
  await page.goto(indice(`tipo=preguntas&buscar=${encodeURIComponent(CODIGO)}`))
  await page.getByRole('link', { name: new RegExp(`^Abrir «.*${CODIGO} ${nombreDe.conPostulantes}.*» en la vacante`) }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/vacantes/${v.conPostulantes}/preguntas$`))
  await expect(page.getByText('Orden con el efectivo').first()).toBeVisible()
})
