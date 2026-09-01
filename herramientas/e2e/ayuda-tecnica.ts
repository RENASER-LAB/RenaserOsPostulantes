import { expect, type Page } from '@playwright/test'
import { API, tokenDelPanel } from './ayuda'

/**
 * Lo que comparten los recorridos de la prueba técnica (16 y 17): una vacante en
 * borrador recién nacida, la ficha con las palabras del dueño, el pedido a la IA
 * con su desenlace clasificado, y el vigilante de la red y la consola.
 *
 * ⚠️ **La siembra no trae ninguna vacante en borrador**: las tres están
 * publicadas. Y las dos pruebas necesitan una virgen —16 comprueba con qué
 * instrumento NACE, 17 que el riesgo 2 espera al 1 en una ficha vacía—, así que
 * cada una crea la suya por la misma API que usa el panel (solicitud, aprobación,
 * vacante). No se inventa ninguna fila: se pide lo que pediría quien lo hace a
 * mano, y queda con su título marcado por la hora para que no se confunda con
 * la de otra corrida.
 */

/** El puesto de SUPERVISIÓN de la siembra: en ese nivel el cuestionario tiene diez preguntas. */
const PUESTO = 'Líder de operaciones'
const AREA = 'Operaciones'

async function pedirAlPanel<T>(camino: string, cuerpo?: unknown, metodo?: string): Promise<T> {
  const r = await fetch(`${API}/panel${camino}`, {
    method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await tokenDelPanel()}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`${metodo ?? 'POST'} ${camino} contestó ${r.status}: ${await r.text()}`)
  const texto = await r.text()
  return (texto ? JSON.parse(texto) : null) as T
}

/** HHMMSS, para que dos corridas no se pisen el título. */
export const marcaDeHora = () => new Date().toISOString().slice(11, 19).replace(/:/g, '')

/**
 * Una vacante en BORRADOR, respaldada por una solicitud aprobada al vuelo.
 *
 * Es el mismo camino que recorre «Crear vacante» en el panel, sin la pantalla:
 * la solicitud nace con su puesto, Dirección la aprueba, y la vacante cuelga de
 * ella. Devuelve el id, que es lo único que hace falta para navegar.
 */
export async function crearVacanteEnBorrador(titulo: string): Promise<number> {
  const [areas, puestos, usuarios] = await Promise.all([
    pedirAlPanel<{ id: number; nombre: string }[]>('/areas'),
    pedirAlPanel<{ id: number; nombre: string }[]>('/puestos'),
    pedirAlPanel<{ id: number }[]>('/usuarios'),
  ])
  const area = areas.find((a) => a.nombre === AREA)
  const puesto = puestos.find((p) => p.nombre === PUESTO)
  if (!area || !puesto || usuarios.length === 0) {
    throw new Error(
      `La siembra no trae lo que hace falta para una vacante nueva: área «${AREA}», ` +
        `puesto «${PUESTO}» y al menos un usuario del equipo.`,
    )
  }
  const { id: solicitudId } = await pedirAlPanel<{ id: number }>('/solicitudes', {
    areaId: area.id,
    puestoId: puesto.id,
    urgencia: 'NORMAL',
    resultadoPrincipal: 'Que la caja cuadre todos los días',
    motivo: 'Los arqueos salen con faltantes y nadie responde por ellos.',
    consecuenciaNoContratar: 'Seguimos perdiendo plata en caja sin saber dónde.',
    analisisCapacidad: 'Las dos personas de administración ya cierran a las nueve.',
    resultadosEsperados: [
      { descripcion: 'Arqueo diario sin faltantes', indicador: 'Faltantes por mes' },
      { descripcion: 'Cuadre contra sistema cada cierre', indicador: 'Cierres cuadrados por semana' },
      { descripcion: 'Un informe mensual de caja', indicador: 'Informe entregado cada mes' },
    ],
  })
  await pedirAlPanel(`/solicitudes/${solicitudId}/aprobacion`, { motivo: 'Recorrido e2e de la prueba técnica' })
  const { id } = await pedirAlPanel<{ id: number }>('/vacantes', {
    solicitudTalentoId: solicitudId,
    titulo,
    descripcion: 'Llevas la caja y el personal de tres sedes.',
    tipoCierre: 'PERMANENTE',
    responsableUsuarioId: usuarios[0]!.id,
  })
  return id
}

/** La vacante por su id, y que esté pintada: el título en el h1. */
export async function irALaVacante(page: Page, id: number, titulo: string) {
  await page.goto(`/admin/vacantes/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible({ timeout: 20_000 })
}

/** La página donde se prepara la prueba técnica: la ficha y el cuestionario. */
export async function irAPrepararLaPruebaTecnica(page: Page, id: number) {
  await page.goto(`/admin/vacantes/${id}/prueba-tecnica`)
  await expect(page.getByRole('heading', { name: 'La prueba técnica del puesto' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('form', { name: 'La ficha del puesto' })).toBeVisible({ timeout: 15_000 })
}

/** La ficha del puesto, contada con las palabras del dueño de las tres sedes. */
export const LA_FICHA = {
  'Q1 · Resultado':
    'Que en un año no haya un solo faltante de caja sin explicar y que las tres sedes cierren su arqueo el mismo día, antes de las nueve.',
  'Q2 · Riesgo':
    'En la caja. Si no cuadra la primera semana ya sé que me equivoqué. Después empieza el personal: faltan sin avisar y nadie cubre.',
  'Q3 · Día real':
    'Abre la sede principal a las ocho, revisa el arqueo de la noche anterior, pasa por las otras dos sedes, atiende proveedores al mediodía y cierra caja a las siete.',
  'Q4 · Época dorada':
    'Rosa lo hizo bien tres años: llegaba antes que todos y no dejaba pasar un sol. El que vino después confiaba en la gente y se lo comieron en seis meses.',
  'Q5 · Estructura':
    'Somos cuarenta y cinco en total. Tendría a cargo a doce, los cajeros de las tres sedes; ninguno de ellos tiene gente debajo.',
  'Q6 · Autonomía':
    'Puede decidir horarios y reemplazos, y autorizar descuentos hasta cien soles. Contratar o despedir, no: eso pasa por mí.',
  'Q7 · Jefe directo':
    'A mí. Soy de números y de preguntar por qué. No me funciona quien se ofende cuando le piden el detalle de algo.',
  'Q8 · Lo incómodo':
    'Se trabaja sábados y algunos domingos, y cuando falta plata en caja se queda hasta que aparece. No es un puesto de escritorio.',
  'Q9 · Requerimientos':
    'Tiene que haber manejado caja con dinero físico y saber Excel para el cuadre contra sistema. Deseable haber llevado más de una sede a la vez.',
} as const

/**
 * Escribe la ficha entera sin guardarla. Los riesgos se encienden en cadena —el 2
 * no existe hasta que el 1 tiene texto—, así que el orden de aquí importa.
 */
export async function escribirLaFicha(page: Page) {
  for (const [etiqueta, texto] of Object.entries(LA_FICHA)) {
    await page.getByLabel(new RegExp(etiqueta)).fill(texto)
  }
  await page.getByLabel('Cuánta gente hay en la empresa', { exact: true }).fill('45')
  await page.getByLabel('Cuántas personas tendrá a cargo', { exact: true }).fill('12')
  await page.getByLabel(/Riesgo 1/).fill('Faltantes de caja sin explicar')
  await page.getByLabel('Riesgo 2', { exact: true }).fill('Cajeros que faltan sin avisar')
  await page.getByLabel('Riesgo 3', { exact: true }).fill('Descuentos sin autorización')
  await page.getByLabel('Riesgo 4', { exact: true }).fill('Proveedores pagados dos veces')
  await page.getByLabel('Eliminatoria 1', { exact: true }).fill('Haber manejado caja con dinero físico')
  await page.getByLabel('Requerimiento 1', { exact: true }).fill('Excel para el cuadre contra sistema')
  await page.getByLabel(/F4 Administración/).check()
  await page.getByLabel(/F1 Mando/).check()
}

/** Lo que dicen los avisos de la pantalla, para que un fallo diga por qué. */
export const queja = async (page: Page) => (await page.getByRole('alert').allTextContents()).join(' · ')

/**
 * Cómo acabó el pedido a la IA.
 *
 *   LISTA        el REDACTOR escribió el borrador y ya se puede publicar.
 *   FALLIDA      el trabajo se encoló y murió: es lo que pasa aquí, con la clave
 *                ficticia, en menos de cinco segundos.
 *   NO_ENCOLADA  la IA está apagada para la empresa, o ya había una en curso.
 *   AGOTADA      la página dejó de sondear con la generación todavía en curso.
 *   RECHAZADA    el POST no llegó a encolar nada: un 4xx/5xx explicado en pantalla.
 */
export type DesenlaceDeLaIa = 'LISTA' | 'FALLIDA' | 'NO_ENCOLADA' | 'AGOTADA' | 'RECHAZADA'

/**
 * Pide el cuestionario y espera al DESENLACE, no a la señal de que empezó.
 *
 * ⚠️ «La IA está redactando» es un cartel de paso: con la clave ficticia el
 * trabajo pasa a FALLIDA antes de que el sondeo llegue a pintarlo, y esperarlo
 * sería medir una carrera. Lo que se espera es una de las cinco salidas; con la
 * clave real tarda uno o dos minutos y por eso el tope es de seis.
 */
export async function pedirElCuestionarioALaIa(page: Page): Promise<DesenlaceDeLaIa> {
  const pedir = page.getByRole('button', { name: 'Pedirle el cuestionario a la IA' })
  if (await pedir.isVisible().catch(() => false)) {
    await pedir.click()
  } else {
    // Ya había un cuestionario: se regenera, y eso pregunta antes.
    await page.getByRole('button', { name: 'Volver a generar' }).click()
    await page.getByRole('button', { name: 'Sí, volver a generar' }).click()
  }

  const lista = page.getByRole('button', { name: 'Publicar el cuestionario' })
  const fallida = page.getByRole('alert').filter({ hasText: /La última generación falló/ })
  const noEncolada = page.getByRole('status').filter({ hasText: /No se encoló nada/ })
  const agotada = page.getByRole('status').filter({ hasText: /Dejamos de refrescar/ })
  const rechazada = page
    .getByRole('alert')
    .filter({ hasText: /No llegamos a pedirlo|El servidor falló al|no puede pedirle/ })
  await expect(lista.or(fallida).or(noEncolada).or(agotada).or(rechazada).first()).toBeVisible({
    timeout: 360_000,
  })
  if (await lista.isVisible()) return 'LISTA'
  if (await fallida.isVisible()) return 'FALLIDA'
  if (await noEncolada.isVisible()) return 'NO_ENCOLADA'
  if (await agotada.isVisible()) return 'AGOTADA'
  return 'RECHAZADA'
}

/** El motivo con el que se salta lo que dependía de que la IA escribiera. */
export function porQueNoEscribioLaIa(desenlace: DesenlaceDeLaIa): string {
  return desenlace === 'FALLIDA'
    ? 'La IA no corre en este entorno: la clave es ficticia y la generación acabó en FALLIDA. ' +
        'Con la clave real, una FALLIDA aquí sería un fallo.'
    : 'La IA está apagada para esta empresa (no se encoló nada): sin cuestionario no hay ciclo que cerrar.'
}

/**
 * Vigila la red y la consola de una página y va apuntando lo que no debería pasar.
 *
 * Los 404 que son parte del funcionamiento y no una avería:
 *
 *   - la ficha, mientras el dueño no la ha escrito todavía (deja de perdonarse
 *     en cuanto se guarda: a partir de ahí un 404 suyo SÍ es un fallo);
 *   - el tanteo de versiones de prueba, que el backend no deja listar;
 *   - validación y notas de simulación de quien no ha llegado ahí.
 */
export function vigilarLaRed(
  page: Page,
  fallos: string[],
  opciones: { fichaEscrita: () => boolean; enQue: () => string },
) {
  const esPerdonable = (url: string) =>
    (!opciones.fichaEscrita() && url.includes('/ficha')) ||
    url.includes('/plantillas-prueba/versiones/') ||
    url.includes('/validacion') ||
    url.includes('/simulacion/notas')
  page.on('pageerror', (e) => fallos.push(`[${opciones.enQue()}] error de página · ${String(e).slice(0, 200)}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (m.text().includes('404') || m.text().includes('Failed to load resource')) return
    fallos.push(`[${opciones.enQue()}] consola · ${m.text().slice(0, 200)}`)
  })
  page.on('response', (r) => {
    if (r.status() < 400) return
    if (r.status() === 404 && esPerdonable(r.url())) return
    fallos.push(`[${opciones.enQue()}] ${r.status()} · ${r.request().method()} ${r.url().replace(API, '')}`)
  })
}
