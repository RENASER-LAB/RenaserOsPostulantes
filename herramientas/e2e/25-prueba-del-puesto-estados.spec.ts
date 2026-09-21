import { expect, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  API,
  corte,
  entrarAlPanel,
  filasDelRanking,
  idDeVacante,
  irAVacante,
  nombresVisibles,
  pestana,
  tokenDelPanel,
  VACANTES,
} from './ayuda'
import { borrarCuentasDePrueba, crearCuentaDeCandidato, test } from './ayuda-candidato'
import { correoDePrueba, literal, sql } from './base-de-datos'

/**
 * El corte «Pendiente» y en qué punto está la prueba del puesto de cada quien.
 *
 * ⚠️ **ESCRIBE**: crea ocho cuentas `e2e.prueba.<uuid>@example.com` con su
 * postulación en la vacante LLENA, y los intentos y notas de etapa que ninguna
 * pantalla sabe dejar a medias. Todo eso se borra en `afterAll` por los correos
 * completos —nunca por prefijo— con la misma limpieza que usan `12` y `24`.
 *
 * Lo que aquí se comprueba, y que ninguna otra prueba mira:
 *
 *   1. **El corte que se llamaba «Por revisar» ahora se llama «Pendiente» y trae
 *      exactamente las mismas filas.** El rótulo es lo único que cambió, así que
 *      lo que se compara no es una lista escrita a mano sino los estados que la
 *      API devuelve para esa etapa: si el corte empezara a seleccionar a otra
 *      gente, la cifra y los nombres dejarían de casar.
 *   2. **La celda de la nota de la prueba distingue tres cosas que antes se
 *      escribían igual**: no la terminó, el sistema la cerró al vencer el plazo,
 *      y la entregó una persona y falta calificarla. La última es la única en la
 *      que el trabajo es del equipo.
 *   3. **Un cero es una nota.** Se pinta el número, no un hueco.
 *   4. **La hoja de Excel del corte hereda el rótulo nuevo** y no conserva el
 *      viejo.
 *   5. **Consultar no escribe.** Abrir el ranking y descargarlo deja la base tal
 *      cual, y volver a abrirlo después de una entrega o de una calificación
 *      cambia esa fila y ninguna otra.
 *
 * La siembra va por la API para las cuentas —es el alta de verdad— y por SQL
 * para la postulación, el intento y la nota: nadie puede dejar un intento a
 * medias «a mano» desde el panel, y la entrega automática la escribe el reloj.
 */

const CARPETA = mkdtempSync(join(tmpdir(), 'qa-prueba-estados-'))

/** Lo que se siembra, y cómo tiene que clasificarlo el backend. */
const SEMBRADOS = [
  {
    clave: 'pendiente',
    nombre: 'Zqa Sin',
    apellidos: 'Empezar',
    estado: 'PRUEBA_TURNO_CANDIDATO',
    intento: { iniciado: false, entregado: false, automatica: false },
    nota: null,
    estadoPrueba: 'INCOMPLETA',
  },
  {
    clave: 'enCurso',
    nombre: 'Zqa En',
    apellidos: 'Curso',
    estado: 'PRUEBA_TURNO_CANDIDATO',
    intento: { iniciado: true, entregado: false, automatica: false },
    nota: null,
    estadoPrueba: 'INCOMPLETA',
  },
  {
    clave: 'automatica',
    nombre: 'Zqa Entrega',
    apellidos: 'Automatica',
    estado: 'PRUEBA_POR_CONFIRMAR',
    intento: { iniciado: true, entregado: true, automatica: true },
    nota: null,
    estadoPrueba: 'INCOMPLETA',
  },
  {
    clave: 'manual',
    nombre: 'Zqa Entrega',
    apellidos: 'Manual',
    estado: 'PRUEBA_POR_CONFIRMAR',
    intento: { iniciado: true, entregado: true, automatica: false },
    nota: null,
    estadoPrueba: 'PENDIENTE_CALIFICACION',
  },
  {
    clave: 'calificada',
    nombre: 'Zqa Nota',
    apellidos: 'Setenta',
    estado: 'PRUEBA_POR_CONFIRMAR',
    intento: { iniciado: true, entregado: true, automatica: false },
    nota: '72.50',
    estadoPrueba: 'CALIFICADA',
  },
  {
    // Entrega automática CON nota: manda la nota, no quién cerró el intento.
    clave: 'cero',
    nombre: 'Zqa Nota',
    apellidos: 'Cero',
    estado: 'PRUEBA_POR_CONFIRMAR',
    intento: { iniciado: true, entregado: true, automatica: true },
    nota: '0.00',
    estadoPrueba: 'CALIFICADA',
  },
  {
    // Todavía en el perfil integral: no hay prueba de la que hablar.
    clave: 'antesDeLaTecnica',
    nombre: 'Zqa Antes',
    apellidos: 'Tecnica',
    estado: 'PERFIL_POR_CONFIRMAR',
    intento: null,
    nota: null,
    estadoPrueba: 'NO_APLICA',
  },
  {
    // En la etapa técnica y sin intento: el detalle no existe, y la fila tiene
    // que seguir estando sin que nadie le invente una entrega que calificar.
    clave: 'sinIntento',
    nombre: 'Zqa Sin',
    apellidos: 'Intento',
    estado: 'PRUEBA_POR_CONFIRMAR',
    intento: null,
    nota: null,
    estadoPrueba: 'NO_APLICA',
  },
] as const

type Sembrado = (typeof SEMBRADOS)[number]
type Clave = Sembrado['clave']

/** Lo que la celda de la Nota tiene que decir, y lo que explica su título. */
const TEXTO_EN_LA_CELDA: Partial<Record<Clave, { celda: string; titulo: string | null }>> = {
  pendiente: {
    celda: 'Prueba incompleta',
    titulo: 'Prueba incompleta: no llegó a entregarla, o el sistema la cerró al vencer el plazo',
  },
  enCurso: {
    celda: 'Prueba incompleta',
    titulo: 'Prueba incompleta: no llegó a entregarla, o el sistema la cerró al vencer el plazo',
  },
  automatica: {
    celda: 'Prueba incompleta',
    titulo: 'Prueba incompleta: no llegó a entregarla, o el sistema la cerró al vencer el plazo',
  },
  manual: {
    celda: 'Pendiente de calificación',
    titulo: 'Pendiente de calificación: la entregó y su rúbrica todavía no tiene nota',
  },
  calificada: { celda: '72.5', titulo: null },
  cero: { celda: '0', titulo: null },
  antesDeLaTecnica: { celda: 'en otra etapa', titulo: null },
}

const elDe = (clave: Clave): Sembrado => {
  const suyo = SEMBRADOS.find((s) => s.clave === clave)
  if (!suyo) throw new Error(`No existe el caso «${clave}».`)
  return suyo
}
const quien = (clave: Clave) => `${elDe(clave).nombre} ${elDe(clave).apellidos}`

const correos = new Map<Clave, string>()
const correoDe = (clave: Clave) => {
  const correo = correos.get(clave)
  if (!correo) throw new Error(`No se sembró el caso «${clave}».`)
  return correo
}

let vacanteId = 0

/** Las cinco etapas y sus estados «espera a la empresa», copiados a propósito (ver `18`). */
const ETAPAS = [
  { nombre: 'Perfil integral', codigo: 'PERFIL_INTEGRAL', porRevisar: ['PERFIL_POR_CONFIRMAR'] },
  { nombre: 'Prueba del puesto', codigo: 'PRUEBA_PUESTO', porRevisar: ['PRUEBA_POR_CONFIRMAR'] },
  {
    nombre: 'Simulación',
    codigo: 'SIMULACION',
    porRevisar: ['SIMULACION_POR_HABILITAR', 'SIMULACION_POR_CONFIRMAR'],
  },
  {
    nombre: 'Validación',
    codigo: 'VALIDACION',
    porRevisar: ['VALIDACION_POR_HABILITAR', 'VALIDACION_POR_CONFIRMAR'],
  },
  { nombre: 'Decisión', codigo: 'DECISION', porRevisar: ['DECISION_POR_CONFIRMAR'] },
] as const

interface FilaApi {
  candidato: string
  estado: string
  notaEtapa: number | null
  estadoPrueba: string | null
}

async function rankingPorApi(etapa?: string): Promise<FilaApi[]> {
  const r = await fetch(
    `${API}/panel/vacantes/${vacanteId}/ranking${etapa ? `?etapa=${etapa}` : ''}`,
    { headers: { Authorization: `Bearer ${await tokenDelPanel()}` } },
  )
  if (!r.ok) throw new Error(`El ranking contestó ${r.status}: ${await r.text()}`)
  return (await r.json()).filas as FilaApi[]
}

// ---------- Herramientas de la pantalla ----------

/**
 * En qué columna está la Nota, preguntado a la cabecera.
 *
 * ⚠️ **No vale un número escrito a mano.** Las columnas de la pestaña de la
 * prueba no son las del perfil integral, y la mesa deja encender y apagar
 * algunas: un índice fijo apuntaría a la celda de al lado el día que cambie una.
 */
async function columnaDeLaNota(page: Page): Promise<number> {
  const titulos = await page
    .locator('table thead th')
    .evaluateAll((ths) => ths.map((th) => (th.textContent ?? '').trim()))
  const i = titulos.findIndex((t) => t.startsWith('Nota'))
  if (i < 0) throw new Error(`La tabla no tiene columna «Nota». Tiene: ${titulos.join(', ')}`)
  return i
}

/** La celda de la Nota de una fila, buscada por el nombre de quien la ocupa. */
async function celdaDeLaNota(page: Page, nombre: string): Promise<Locator> {
  return filasDelRanking(page)
    .filter({ has: page.locator(`input[aria-label=${JSON.stringify(`Avanza ${nombre}`)}]`) })
    .locator('td')
    .nth(await columnaDeLaNota(page))
}

/** La cifra que lleva un corte al final de su nombre: «Pendiente 5». */
const cifraDelCorte = async (page: Page, nombre: string) =>
  Number(((await corte(page, nombre).textContent()) ?? '').match(/(\d+)\s*$/)?.[1])

/** Lo que dice la celda de la Nota de cada fila, por candidato. */
async function loQueDiceCadaFila(page: Page): Promise<Map<string, string>> {
  const dicho = new Map<string, string>()
  for (const nombre of await nombresVisibles(page)) {
    dicho.set(nombre, ((await (await celdaDeLaNota(page, nombre)).textContent()) ?? '').trim())
  }
  return dicho
}

const sinLaFilaDe = (filas: Map<string, string>, nombre: string) =>
  [...filas.entries()].filter(([quienEs]) => quienEs !== nombre).sort()

async function irALaPruebaDelPuesto(page: Page, vista: 'Pendiente' | 'Toda la tanda') {
  await irAVacante(page, VACANTES.LLENA)
  await pestana(page, 'Prueba del puesto').click()
  await corte(page, vista).click()
  await expect(corte(page, vista)).toHaveAttribute('aria-pressed', 'true')
}

/**
 * El libro, leído de verdad con openpyxl: los nombres de sus hojas y su texto.
 *
 * Buscar «Por revisar» en el XML crudo no valdría: el formato guarda las cadenas
 * compartidas aparte, y una frase partida en trozos se escaparía.
 */
function leerElLibro(ruta: string): { hojas: string[]; textos: string[] } {
  const salida = execFileSync('python3', [
    '-c',
    `
import json, sys
import openpyxl
libro = openpyxl.load_workbook(sys.argv[1], data_only=True)
textos = []
for hoja in libro.worksheets:
    for fila in hoja.iter_rows(values_only=True):
        for celda in fila:
            if isinstance(celda, str) and celda.strip():
                textos.append(celda.strip())
print(json.dumps({'hojas': libro.sheetnames, 'textos': textos}))
`,
    ruta,
  ])
  return JSON.parse(salida.toString())
}

async function descargarElExcel(page: Page): Promise<{ hojas: string[]; textos: string[] }> {
  const espera = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByRole('button', { name: /^Descargar Excel \(\d+\)$/ }).click()
  const descarga = await espera
  const ruta = join(CARPETA, `${Date.now()}-${descarga.suggestedFilename()}`)
  await descarga.saveAs(ruta)
  return leerElLibro(ruta)
}

// ---------- La siembra ----------

/**
 * La huella de lo que una consulta NO puede tocar.
 *
 * Abrir el ranking o descargarlo es leer: si cambiara algo de aquí —un estado,
 * una entrega, una nota, una transición o una línea de auditoría— sería que la
 * pantalla escribe por el camino.
 */
const huellaDeLaBase = () =>
  sql(`select md5(string_agg(t, '|' order by t)) from (
        select 'p:' || id || ':' || estado_codigo || ':' || movido_en as t from postulacion
        union all select 'i:' || id || ':' || coalesce(iniciado_en::text, '-') || ':'
               || coalesce(entregado_en::text, '-') || ':' || es_entrega_automatica from intento_prueba
        union all select 'n:' || id || ':' || etapa_codigo || ':' || puntaje from nota_etapa
        union all select 'tr:' || count(*)::text from transicion_estado
        union all select 'au:' || count(*)::text from auditoria
      ) x;`)

const cuando = (hay: boolean, hace: string) => (hay ? `now() - interval '${hace}'` : 'null')

async function sembrar() {
  vacanteId = await idDeVacante(VACANTES.LLENA)
  const version = sql("select coalesce(min(id)::text, '') from version_plantilla_prueba;")
  if (!version) {
    throw new Error(
      'El clon no tiene ninguna versión de plantilla de prueba: sin ella no hay intento que sembrar.',
    )
  }

  for (const caso of SEMBRADOS) {
    const correo = correoDePrueba('e2e.prueba')
    correos.set(caso.clave, correo)
    await crearCuentaDeCandidato({ nombre: caso.nombre, apellidos: caso.apellidos, correo })
  }

  const ordenes = SEMBRADOS.flatMap((caso) => {
    const correo = literal(correoDe(caso.clave))
    const lineas = [
      `insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
         select v.organizacion_id, u.id, v.id, ${literal(caso.estado)}
         from vacante v join usuario u on u.correo = ${correo}
         where v.id = ${vacanteId};`,
    ]
    if (caso.intento) {
      lineas.push(
        `insert into intento_prueba (postulacion_id, version_plantilla_prueba_id, iniciado_en,
                                     vence_en, entregado_en, es_entrega_automatica)
           select p.id, ${version}, ${cuando(caso.intento.iniciado, '2 hours')},
                  now() + interval '1 day', ${cuando(caso.intento.entregado, '1 hour')},
                  ${caso.intento.automatica}
           from postulacion p join usuario u on u.id = p.usuario_id
           where u.correo = ${correo};`,
      )
    }
    if (caso.nota) {
      lineas.push(
        `insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id)
           select p.id, 'PRUEBA_PUESTO', ${caso.nota}, v.version_pesos_id
           from postulacion p join usuario u on u.id = p.usuario_id
                              join vacante v on v.id = p.vacante_id
           where u.correo = ${correo};`,
      )
    }
    return lineas
  })
  sql(`begin;\n${ordenes.join('\n')}\ncommit;`)

  // La siembra se comprueba antes de mirar ninguna pantalla: si el backend no
  // clasificó lo sembrado como se esperaba, el fallo tiene que decir eso y no
  // «no encuentro el texto en la tabla».
  const porCandidato = new Map((await rankingPorApi('PRUEBA_PUESTO')).map((f) => [f.candidato, f]))
  for (const caso of SEMBRADOS) {
    const fila = porCandidato.get(quien(caso.clave))
    if (!fila) throw new Error(`La siembra no llegó al ranking: falta ${quien(caso.clave)}.`)
    if (fila.estadoPrueba !== caso.estadoPrueba) {
      throw new Error(
        `El backend clasificó a ${quien(caso.clave)} como ${fila.estadoPrueba} ` +
          `y no como ${caso.estadoPrueba}.`,
      )
    }
  }
}

test.beforeAll(sembrar)
test.afterAll(() => borrarCuentasDePrueba([...correos.values()]))

test.describe('Nuevo · «Pendiente» y en qué punto está la prueba del puesto', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('AC-01 · el corte se llama «Pendiente» en las cinco pestañas y trae las mismas filas', async ({
    page,
  }) => {
    await irAVacante(page, VACANTES.LLENA)
    // Abre por él: es la bandeja de trabajo, y el rótulo nuevo tiene que estar
    // ya en lo primero que se ve.
    await expect(corte(page, 'Pendiente')).toHaveAttribute('aria-pressed', 'true')

    for (const etapa of ETAPAS) {
      await pestana(page, etapa.nombre).click()
      await corte(page, 'Pendiente').click()

      const suyas = (await rankingPorApi(etapa.codigo))
        .filter((f) => (etapa.porRevisar as readonly string[]).includes(f.estado))
        .map((f) => f.candidato)
        .sort()

      expect(
        await cifraDelCorte(page, 'Pendiente'),
        `${etapa.nombre}: la cifra del corte no dice ${suyas.length}`,
      ).toBe(suyas.length)
      expect(
        (await nombresVisibles(page)).sort(),
        `${etapa.nombre}: «Pendiente» no trae las mismas filas que esperan una decisión`,
      ).toEqual(suyas)
      // Y el rótulo viejo no queda en ninguna parte de la pantalla.
      await expect(page.getByText('Por revisar')).toHaveCount(0)
    }
  })

  test('AC-03 a AC-08 · cada estado del intento dice lo suyo, y solo lo suyo', async ({ page }) => {
    await irALaPruebaDelPuesto(page, 'Toda la tanda')

    for (const [clave, esperado] of Object.entries(TEXTO_EN_LA_CELDA)) {
      const nombre = quien(clave as Clave)
      const celda = await celdaDeLaNota(page, nombre)
      await expect(celda, `${nombre}: la celda no dice «${esperado!.celda}»`).toContainText(
        esperado!.celda,
      )
      if (esperado!.titulo) {
        await expect(
          celda.locator(`[title=${JSON.stringify(esperado!.titulo)}]`),
          `${nombre}: el título de la celda no explica el estado`,
        ).toHaveCount(1)
      }
    }

    // AC-05 al revés: una entrega automática sin nota NO puede leerse como una
    // entrega de persona esperando calificación, que es lo que mandaría al
    // equipo a calificar lo que nadie terminó.
    await expect(await celdaDeLaNota(page, quien('automatica'))).not.toContainText(
      'Pendiente de calificación',
    )

    // AC-08: quien no llegó a la etapa técnica conserva su indicador de siempre
    // y nunca se etiqueta como una entrega pendiente de calificar.
    const antes = await celdaDeLaNota(page, quien('antesDeLaTecnica'))
    await expect(antes).not.toContainText('Pendiente de calificación')
    await expect(antes).not.toContainText('Prueba incompleta')
  })

  test('AC-07 · una nota de cero es un número, no un hueco', async ({ page }) => {
    await irALaPruebaDelPuesto(page, 'Toda la tanda')

    const celda = await celdaDeLaNota(page, quien('cero'))
    // El texto entero de la celda: «0» y nada más, sin guion ni motivo de
    // ausencia. Tratar el cero como un hueco convertiría a quien sacó cero en
    // alguien que no rindió.
    expect((await celda.textContent())?.trim()).toBe('0')
    await expect(celda).not.toContainText('Prueba incompleta')
    await expect(celda).not.toContainText('Pendiente de calificación')
    await expect(celda).not.toContainText('—')
  })

  test('AC-10 · en la etapa técnica sin intento la fila se conserva y no se inventa una entrega', async ({
    page,
  }) => {
    // Sin intento no hay detalle que leer. La respuesta no puede caerse por esa
    // fila ni colarla como una entrega que calificar: es el caso neutro.
    // (Hoy esa celda hereda el texto del estado de la postulación; lo que aquí
    // se fija es lo que la spec exige, que es que la fila siga y que nunca diga
    // «Pendiente de calificación».)
    await irALaPruebaDelPuesto(page, 'Toda la tanda')

    const todas = await rankingPorApi('PRUEBA_PUESTO')
    expect((await nombresVisibles(page)).sort()).toEqual(todas.map((f) => f.candidato).sort())

    const nombre = quien('sinIntento')
    expect(todas.find((f) => f.candidato === nombre)?.estadoPrueba).toBe('NO_APLICA')
    const celda = await celdaDeLaNota(page, nombre)
    await expect(celda).toBeVisible()
    await expect(celda).not.toContainText('Pendiente de calificación')
    await expect(celda).not.toContainText('Prueba incompleta')
  })

  test('AC-02 · el Excel del corte dice «Pendiente» y no conserva «Por revisar»', async ({
    page,
  }) => {
    await irALaPruebaDelPuesto(page, 'Pendiente')
    const cuantas = await filasDelRanking(page).count()

    const libro = await descargarElExcel(page)
    expect(libro.hojas, 'el libro no es una sola hoja llamada «Datos»').toEqual(['Datos'])
    const descrito = libro.textos.find((t) => t.startsWith('Filtro aplicado'))
    expect(descrito, 'la hoja no dice de qué corte salió').toBeTruthy()
    expect(descrito).toContain('Pendiente')
    expect(descrito).toContain(`${cuantas} candidatos`)
    // Ni en esa frase ni en ninguna otra celda del libro.
    expect(libro.textos.filter((t) => t.includes('Por revisar'))).toEqual([])
  })

  test('tras entregar y tras calificar, recargar cambia esa fila y ninguna otra', async ({
    page,
  }) => {
    await irALaPruebaDelPuesto(page, 'Toda la tanda')
    const antes = await loQueDiceCadaFila(page)
    const suyo = quien('pendiente')
    expect(antes.get(suyo)).toContain('Prueba incompleta')

    // Entrega a mano lo que tenía sin empezar: el trabajo pasa a ser del equipo.
    sql(`update intento_prueba i
           set iniciado_en = coalesce(i.iniciado_en, now() - interval '30 minutes'),
               entregado_en = now(), es_entrega_automatica = false
         from postulacion p join usuario u on u.id = p.usuario_id
         where i.postulacion_id = p.id and u.correo = ${literal(correoDe('pendiente'))};`)

    await irALaPruebaDelPuesto(page, 'Toda la tanda')
    const traLaEntrega = await loQueDiceCadaFila(page)
    expect(traLaEntrega.get(suyo)).toContain('Pendiente de calificación')
    expect(sinLaFilaDe(traLaEntrega, suyo)).toEqual(sinLaFilaDe(antes, suyo))

    // Y cuando la rúbrica deja nota, manda la cifra.
    sql(`insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id)
         select p.id, 'PRUEBA_PUESTO', 55.25, v.version_pesos_id
         from postulacion p join usuario u on u.id = p.usuario_id
                            join vacante v on v.id = p.vacante_id
         where u.correo = ${literal(correoDe('pendiente'))};`)

    await irALaPruebaDelPuesto(page, 'Toda la tanda')
    const traLaNota = await loQueDiceCadaFila(page)
    expect(traLaNota.get(suyo)).toBe('55.25')
    expect(sinLaFilaDe(traLaNota, suyo)).toEqual(sinLaFilaDe(antes, suyo))
  })

  test('consultar el ranking y descargarlo no escribe nada', async ({ page }) => {
    const antes = huellaDeLaBase()

    await irAVacante(page, VACANTES.LLENA)
    for (const etapa of ETAPAS) {
      await pestana(page, etapa.nombre).click()
      await corte(page, 'Toda la tanda').click()
      await expect(filasDelRanking(page).first()).toBeVisible()
    }
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Pendiente').click()
    await descargarElExcel(page)
    await page.reload()
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()

    expect(huellaDeLaBase(), 'abrir o descargar el ranking cambió algo en la base').toBe(antes)
  })
})
