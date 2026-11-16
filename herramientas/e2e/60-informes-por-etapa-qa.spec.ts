import { expect, test, type Download, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { API } from './ayuda'
import { entrarAlPanelCon, exigir, pedir, tokenDePanel, uno, consultar } from './ayuda-preguntas-propias'
import {
  ALERTA,
  A_FORTALECER,
  CONTRADICHAS,
  CONTENIDO_DEL_ENTREGABLE,
  CRITICA,
  CRITERIOS_PRUEBA,
  DECLARADAS,
  DEMOSTRADAS,
  ENTREGABLES,
  EXPLICACION_CON_SIGLA,
  FALTA_EVIDENCIA,
  FORTALEZAS,
  MOTIVO_CV,
  MOTIVO_PRUEBA,
  PREGUNTA_ABIERTA_1,
  PREGUNTA_ABIERTA_2,
  PREGUNTA_CERRADA,
  PROHIBIDOS,
  RESPUESTA_2,
  MUCHO,
  SIN_INFO,
  curriculumConMucho,
  curriculumCorriente,
  retirarLoDeLaQa,
  sembrarInformes,
  type Escenario,
} from './ayuda-informes-qa'

/**
 * QA de los informes por etapa (specs/Ready/informe-pdf-por-etapa, con la decisión D-1: nada se
 * recorta y los bloques del resumen empiezan en la primera hoja).
 *
 * A diferencia de `43-informes-por-etapa`, que busca en la base a alguien con informe y se salta
 * si no lo hay, esta suite siembra su propia vacante (`ayuda-informes-qa.ts`) y la retira al
 * final: ningún caso se omite por falta de datos. El texto del PDF se lee con `pdftotext`.
 */

/** Con QA_INFORMES_EVIDENCIA, los PDF y .zip descargados se guardan ahí para revisarlos a ojo. */
const CARPETA = process.env.QA_INFORMES_EVIDENCIA ?? mkdtempSync(join(tmpdir(), 'qa-informes-84-'))
const correos: string[] = []
let equipo: string
let e: Escenario

/** El texto del PDF, de una página o de todas, con los espacios juntados. */
function texto(ruta: string, pagina?: number): string {
  const rango = pagina ? ['-f', String(pagina), '-l', String(pagina)] : []
  return execFileSync('pdftotext', [...rango, ruta, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
}

const paginas = (ruta: string): number =>
  Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [ruta], { encoding: 'utf8' }))![1])

/** Las direcciones enlazadas dentro del PDF (las anotaciones de enlace). */
const enlacesDelPdf = (ruta: string): string[] =>
  execFileSync('pdfinfo', ['-url', ruta], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/).slice(2).join(' '))
    .filter(Boolean)

/** Pide un archivo con sesión y lo guarda: estado, nombre del Content-Disposition y ruta. */
async function bajar(ruta: string, token = equipo): Promise<{ estado: number; nombre: string | null; archivo: string }> {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
  const cuerpo = Buffer.from(await r.arrayBuffer())
  const disposicion = r.headers.get('content-disposition') ?? ''
  const m = /filename\*=UTF-8''([^;]+)/.exec(disposicion)
  const nombre = m ? decodeURIComponent(m[1]!) : null
  const archivo = join(CARPETA, `api-${r.status}-${nombre ?? Math.random().toString(36).slice(2)}`)
  writeFileSync(archivo, cuerpo)
  return { estado: r.status, nombre, archivo }
}

/** Lo que no puede aparecer nunca en un informe por D-1: ni «…» ni «y N más». */
function sinRecortes(t: string) {
  expect(t).not.toContain('…')
  expect(t).not.toMatch(/\by \d+ más\b/)
}

/** Cuántas veces sale un número suelto (no dentro de una fecha, una hora ni otra cifra). */
const vecesQueSale = (t: string, n: number): number =>
  (t.match(new RegExp(`(?<![\\d/:.,])${n}(?![\\d/:.,%])`, 'g')) ?? []).length

async function abrirLaFicha(page: Page, nombre: string, pestana: 'Perfil integral' | 'Prueba del puesto') {
  await page.goto(`/admin/vacantes/${e.vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  await page.getByRole('tab', { name: pestana, exact: true }).click()
  await page.getByRole('group', { name: 'Qué filas se ven' }).getByRole('button', { name: /^Toda la tanda/ }).click()
  const fila = page.locator('table tbody tr', { has: page.getByLabel(`Avanza ${nombre}`, { exact: true }) })
  await fila.locator('td').nth(1).click()
  await expect(page.getByRole('group', { name: 'Informes en PDF' })).toBeVisible({ timeout: 20_000 })
}

async function guardar(descarga: Download): Promise<string> {
  const ruta = join(CARPETA, `ui-${descarga.suggestedFilename()}`)
  await descarga.saveAs(ruta)
  return ruta
}

test.describe('QA · los informes por etapa con datos sembrados', () => {
  // Sin modo serie: cada prueba es independiente y un fallo no esconde las demás (el worker nuevo
  // vuelve a sembrar y el viejo retira lo suyo).

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    equipo = await tokenDePanel()
    e = await sembrarInformes(equipo, correos)
  })

  test.afterAll(() => {
    retirarLoDeLaQa(correos)
  })

  test('API · el informe del CV: bloques en la primera hoja, nada recortado, enlaces web y nada prohibido', async () => {
    const pdf = await bajar(`/panel/postulaciones/${e.maria.postulacion}/informes/cv/pdf`)
    expect(pdf.estado).toBe(200)
    expect(pdf.nombre).toBe(`Informe CV - ${e.maria.nombre} - ${e.titulo}.pdf`)
    const primera = texto(pdf.archivo, 1)
    // AC-01 con D-1: la cabecera y todos los bloques empiezan en la primera hoja.
    for (const parte of [e.titulo, e.maria.nombre, 'EXPERIENCIA PROFESIONAL', 'QUÉ SE EVALUÓ', 'Lo que el CV demuestra',
      'No cuadra', 'Por verificar en la evaluación']) {
      expect.soft(primera.toUpperCase(), `«${parte}» en la primera hoja`).toContain(parte.toUpperCase())
    }
    const todo = texto(pdf.archivo)
    // AC-01h / D-1: las siete demostradas, completas.
    for (const d of DEMOSTRADAS) expect(todo).toContain(d)
    for (const c of CONTRADICHAS) expect(todo).toContain(c)
    // AC-02: cada duda con su pregunta de validación.
    for (const d of [...DECLARADAS, SIN_INFO]) {
      expect(todo).toContain(d.texto)
      expect(todo).toContain(d.pregunta)
    }
    // AC-01d con D-1: la explicación completa bajo su barra; la sigla no la corta.
    expect(todo).toContain(EXPLICACION_CON_SIGLA)
    expect(todo).toContain('FIN-DE-LA-EXPLICACION.')
    // AC-06: nota final, «ajustada a mano» y el motivo.
    expect(todo.toLowerCase()).toContain('ajustada a mano')
    expect(todo).toContain(MOTIVO_CV)
    sinRecortes(todo)
    // AC-11: ni pretensión ni celular.
    for (const p of PROHIBIDOS) expect(todo).not.toContain(p)
    expect(todo).not.toContain('Por verificar en la entrevista')
    // AC-01e: solo enlaces http/https, como mucho cuatro redes. «Currículum (PDF)» necesita un almacén
    // que firme enlaces: el del preview (disco local) no firma, igual que en la columna CV del Excel.
    expect(todo).toContain('LinkedIn')
    expect(todo).toContain('Los enlaces caducan 8 horas después de generar el informe')
    const enlaces = enlacesDelPdf(pdf.archivo)
    expect(enlaces).toContain('https://www.linkedin.com/in/qa-inf-84')
    for (const u of enlaces) expect(u).toMatch(/^https?:\/\//)
    expect(enlaces.some((u) => u.includes('javascript') || u.startsWith('ftp'))).toBe(false)
    expect(enlaces.filter((u) => /qa-inf-84/.test(u)).length).toBeLessThanOrEqual(4)
  })

  test('API · D-1: con un currículum corriente, los tres bloques del CV empiezan en la primera hoja', async () => {
    curriculumCorriente(e.carla.postulacion)
    const pdf = await bajar(`/panel/postulaciones/${e.carla.postulacion}/informes/cv/pdf`)
    expect(pdf.estado).toBe(200)
    const primera = texto(pdf.archivo, 1)
    for (const parte of ['Lo que el CV demuestra', 'No cuadra', 'Por verificar en la evaluación']) {
      expect.soft(primera, `«${parte}» en la primera hoja`).toContain(parte)
    }
    expect(texto(pdf.archivo)).toContain('¿En qué reuniones usaste el inglés?')
  })

  test('API · D-1 / F-1: con mucho contenido, cada bloque del CV empieza en la primera hoja con su primer punto y ninguno se parte ni se recorta', async () => {
    curriculumConMucho(e.carla.postulacion)
    const pdf = await bajar(`/panel/postulaciones/${e.carla.postulacion}/informes/cv/pdf`)
    expect(pdf.estado).toBe(200)
    const total = paginas(pdf.archivo)
    expect(total).toBeGreaterThanOrEqual(2)
    const hojas = Array.from({ length: total }, (_, i) => texto(pdf.archivo, i + 1))
    const primera = hojas[0]!
    expect.soft(primera.toUpperCase(), '«Qué se evaluó» en la primera hoja').toContain('QUÉ SE EVALUÓ')
    for (const [bloque, primerPunto] of [
      ['Lo que el CV demuestra', MUCHO.demostradas[0]!],
      ['No cuadra', MUCHO.contradichas[0]!],
      ['Por verificar en la evaluación', MUCHO.dudas[0]!.texto],
    ] as const) {
      expect.soft(primera, `«${bloque}» empieza en la primera hoja`).toContain(bloque)
      expect.soft(primera, `el primer punto de «${bloque}» en la primera hoja`).toContain(primerPunto)
    }
    // Nada se recorta y ningún punto se parte: cada punto está entero en una sola hoja, y cada duda
    // con su pregunta de validación en la misma.
    for (const punto of [...MUCHO.demostradas, ...MUCHO.contradichas]) {
      expect.soft(hojas.some((h) => h.includes(punto)), `«${punto}» entero en una hoja`).toBe(true)
    }
    for (const d of MUCHO.dudas) {
      expect.soft(hojas.some((h) => h.includes(d.texto) && h.includes(d.pregunta)), `«${d.texto}» y su pregunta juntas`).toBe(true)
    }
    const todo = texto(pdf.archivo)
    // Las ocho explicaciones completas bajo su barra (sin redactor, D-1).
    expect(todo.split(MUCHO.explicacion).length - 1).toBe(8)
    sinRecortes(todo)
    for (const p of PROHIBIDOS) expect(todo).not.toContain(p)
  })

  test('API · el informe de la evaluación: cuatro bloques y «Lo que pidió el CV» en la primera hoja, anexo entero y señales', async () => {
    const pdf = await bajar(`/panel/postulaciones/${e.maria.postulacion}/informes/evaluacion/pdf`)
    expect(pdf.estado).toBe(200)
    expect(pdf.nombre).toBe(`Informe evaluación - ${e.maria.nombre} - ${e.titulo}.pdf`)
    const primera = texto(pdf.archivo, 1)
    // AC-01b
    for (const parte of ['Puntos fuertes', 'Puntos a fortalecer', 'Debilidades a tener en cuenta', 'Lo que pidió el CV',
      'Por contrastar', 'Por verificar en la prueba del puesto']) {
      expect.soft(primera.toUpperCase(), `«${parte}» en la primera hoja`).toContain(parte.toUpperCase())
    }
    const todo = texto(pdf.archivo)
    for (const f of FORTALEZAS) expect(todo).toContain(f)
    for (const h of A_FORTALECER) {
      expect(todo).toContain(h.texto)
      expect(todo).toContain(h.sugerencia)
    }
    for (const t of [CRITICA, FALTA_EVIDENCIA, ALERTA]) expect(todo).toContain(t)
    sinRecortes(todo)
    for (const p of PROHIBIDOS) expect(todo).not.toContain(p)
    expect(todo).not.toContain('Por verificar en la entrevista')
    // AC-03: todas las preguntas, en el orden en que las vio, con la opción elegida o el texto.
    const orden = consultar(`select q.enunciado from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
                              join pregunta q on q.id = o.pregunta_id where p.id = ${e.maria.postulacion} order by o.posicion`)
      .map((f) => String(f.enunciado))
    expect(orden.sort()).toEqual([PREGUNTA_ABIERTA_1, PREGUNTA_ABIERTA_2, PREGUNTA_CERRADA].sort())
    const inicioDelAnexo = todo.lastIndexOf('Preguntas y respuestas')
    expect(inicioDelAnexo).toBeGreaterThan(0)
    const anexo = todo.slice(inicioDelAnexo)
    const posiciones = consultar(`select q.enunciado from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
                                   join pregunta q on q.id = o.pregunta_id where p.id = ${e.maria.postulacion} order by o.posicion`)
      .map((f) => anexo.indexOf(String(f.enunciado)))
    expect(posiciones.every((p) => p >= 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
    expect(todo).toContain('«Más de 40»')
    expect(todo).toContain('Navidad Ñandú')
    expect(todo).toContain('<b>entrevistas grupales</b> & filtros por WhatsApp')
    expect(todo).toContain('Mi jefa dijo: "no se puede".')
    expect(todo).toContain(RESPUESTA_2)
    // AC-03: el detalle trae la explicación de cada abierta; AC-04: las señales de la que las tiene.
    expect(todo).toContain('QAINF explicación abierta 1: cuenta la campaña con cifras propias y su papel.')
    for (const s of ['Episodio real', 'Fue suyo', 'Dato duro', 'Incomodidad']) expect(todo).toContain(s)
    expect(todo).toContain('QAINF motivo abierta 2: la IA no la calificó')
  })

  test('API · el informe de la prueba: criterios con máximo y quién, nota una vez, entrevista con origen y entregables sin contenido', async () => {
    const pdf = await bajar(`/panel/postulaciones/${e.maria.postulacion}/informes/prueba/pdf`)
    expect(pdf.estado).toBe(200)
    expect(pdf.nombre).toBe(`Informe prueba - ${e.maria.nombre} - ${e.titulo}.pdf`)
    const primera = texto(pdf.archivo, 1)
    for (const parte of ['Puntos fuertes', 'Puntos a fortalecer', 'Por verificar en la entrevista']) {
      expect.soft(primera.toUpperCase(), `«${parte}» en la primera hoja`).toContain(parte.toUpperCase())
    }
    const todo = texto(pdf.archivo)
    for (const c of CRITERIOS_PRUEBA) expect(todo).toContain(c)
    // AC-05: máximo y quién la puso.
    expect(todo).toMatch(/\/ ?30/)
    expect(todo).toMatch(/\/ ?20/)
    expect(todo).toContain('Persona')
    expect(todo).toContain('IA')
    expect(todo).toContain(MOTIVO_PRUEBA)
    // AC-01i: la nota de cada criterio, una sola vez.
    for (const n of [27, 17, 11, 19]) expect(vecesQueSale(todo, n), `la nota ${n}`).toBe(1)
    const pocas = /EN POCAS LÍNEAS (.{0,40})/.exec(todo)
    if (pocas) expect(pocas[1]).not.toMatch(/^\d/)
    // AC-01c: lo pendiente de la evaluación, las dudas del CV y lo de la prueba, con su origen.
    expect(todo).toContain(FALTA_EVIDENCIA)
    expect(todo).toContain(DECLARADAS[0]!.texto)
    expect(todo).toContain(ENTREGABLES[1])
    // AC-05: los entregables con «entregado» / «no entregado»; nunca su contenido.
    expect(todo.toLowerCase()).toContain('no entregado')
    expect(todo).toContain(ENTREGABLES[0])
    expect(todo).not.toContain(CONTENIDO_DEL_ENTREGABLE)
    sinRecortes(todo)
    for (const p of PROHIBIDOS) expect(todo).not.toContain(p)
    expect(paginas(pdf.archivo)).toBeGreaterThanOrEqual(1)
  })

  test('API · permisos: sin «ver respuestas» la evaluación da 403 y no sale; otra postulación inexistente da 404', async () => {
    const limitado = await tokenDePanel(e.sinRespuestas)
    const estados = await exigir<{ informes: { etapa: string }[] }>(`/panel/postulaciones/${e.maria.postulacion}/informes`, limitado)
    expect(estados.informes.map((i) => i.etapa)).not.toContain('EVALUACION')
    expect((await pedir(`/panel/postulaciones/${e.maria.postulacion}/informes/evaluacion`, limitado)).estado).toBe(403)
    expect((await bajar(`/panel/postulaciones/${e.maria.postulacion}/informes/evaluacion/pdf`, limitado)).estado).toBe(403)
    expect((await bajar(`/panel/postulaciones/${e.maria.postulacion}/informes/cv/pdf`, limitado)).estado).toBe(200)
    const sinEmbudo = await tokenDePanel(e.sinEmbudo)
    expect((await pedir(`/panel/vacantes/${e.vacante}/informes`, sinEmbudo)).estado).toBe(403)
    const inexistente = Number(uno('select coalesce(max(id), 0) + 100000 as id from postulacion').id)
    expect((await bajar(`/panel/postulaciones/${inexistente}/informes/cv/pdf`)).estado).toBe(404)
  })

  test('Ficha · Perfil Integral: CV y Evaluación listos descargan su PDF con nombre, candidato y nota', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    await abrirLaFicha(page, e.maria.nombre, 'Perfil integral')
    const grupo = page.getByRole('group', { name: 'Informes en PDF' })
    for (const [boton, prefijo, ruta] of [
      ['Descargar el informe del CV', 'Informe CV', 'cv'],
      ['Descargar el informe de la evaluación', 'Informe evaluación', 'evaluacion'],
    ] as const) {
      const espera = page.waitForEvent('download', { timeout: 30_000 })
      await grupo.getByRole('button', { name: boton }).click()
      const descarga = await espera
      expect(descarga.suggestedFilename()).toBe(`${prefijo} - ${e.maria.nombre} - ${e.titulo}.pdf`)
      const t = texto(await guardar(descarga))
      const informe = await exigir<{ nota: { texto: string } }>(`/panel/postulaciones/${e.maria.postulacion}/informes/${ruta}`, equipo)
      expect(t).toContain(e.maria.nombre)
      expect(t).toContain(informe.nota.texto)
    }
    await expect(grupo.getByRole('button', { name: 'Descargar el informe del CV' })).toBeEnabled()
  })

  test('Ficha · Prueba del puesto: «Prueba» descarga su PDF', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    await abrirLaFicha(page, e.maria.nombre, 'Prueba del puesto')
    const espera = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('group', { name: 'Informes en PDF' }).getByRole('button', { name: 'Descargar el informe de la prueba' }).click()
    const descarga = await espera
    expect(descarga.suggestedFilename()).toBe(`Informe prueba - ${e.maria.nombre} - ${e.titulo}.pdf`)
    expect(texto(await guardar(descarga))).toContain('Por verificar en la entrevista')
  })

  test('Ficha · AC-08: con la evaluación calificándose, «Evaluación» sale gris y desactivado con su motivo', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    await abrirLaFicha(page, e.bruno.nombre, 'Perfil integral')
    const boton = page.getByRole('group', { name: 'Informes en PDF' }).getByRole('button', { name: /informe de la evaluación/ })
    await expect(boton).toBeDisabled()
    await expect(boton).toHaveAttribute('title', 'La IA está calificando')
    await expect(boton).toHaveAttribute('aria-label', /La IA está calificando/)
  })

  test('Ficha · AC-09: una cuenta real sin «ver respuestas de la evaluación» no ve ese botón', async ({ page }) => {
    await entrarAlPanelCon(page, await tokenDePanel(e.sinRespuestas))
    await abrirLaFicha(page, e.maria.nombre, 'Perfil integral')
    const grupo = page.getByRole('group', { name: 'Informes en PDF' })
    await expect(grupo.getByRole('button', { name: 'Descargar el informe del CV' })).toBeVisible()
    await expect(grupo.getByRole('button', { name: /evaluación/ })).toHaveCount(0)
  })

  test('Visor · lista en el orden del ranking, «Siguiente →» sin recargar, PDF de la pestaña y .zip de la vacante', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${e.vacante}`)
    await page.getByRole('link', { name: 'Ver informes' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/admin/vacantes/${e.vacante}/informes`))
    const visor = await exigir<{ postulantes: { candidato: string }[] }>(`/panel/vacantes/${e.vacante}/informes`, equipo)
    const lista = page.getByRole('complementary', { name: 'Postulantes de la vacante' })
    await expect(lista.getByRole('button')).toHaveCount(visor.postulantes.length)
    expect(visor.postulantes.map((p) => p.candidato).sort()).toEqual([e.maria.nombre, e.bruno.nombre, e.carla.nombre].sort())
    for (const [i, p] of visor.postulantes.entries()) {
      await expect(lista.getByRole('button').nth(i)).toContainText(p.candidato)
    }

    await lista.getByRole('button', { name: new RegExp(e.maria.nombre) }).click()
    await expect(page.getByRole('heading', { level: 2, name: e.maria.nombre })).toBeVisible()
    await page.evaluate(() => ((window as unknown as { __sinRecargar: boolean }).__sinRecargar = true))
    const indice = visor.postulantes.findIndex((p) => p.candidato === e.maria.nombre)
    const siguiente = visor.postulantes[indice + 1] ?? null
    if (siguiente) {
      await page.getByRole('button', { name: 'Siguiente →' }).click()
      await expect(page.getByRole('heading', { level: 2, name: siguiente.candidato })).toBeVisible()
      expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true)
      await page.getByRole('button', { name: '← Anterior' }).click()
      await expect(page.getByRole('heading', { level: 2, name: e.maria.nombre })).toBeVisible()
    }

    // Las tres pestañas de María con su nota, y el PDF de la abierta.
    const pestanas = page.getByRole('tablist', { name: 'Informe' })
    await expect(pestanas.getByRole('tab')).toHaveCount(3)
    await pestanas.getByRole('tab', { name: /Prueba/ }).click()
    const espera = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Descargar PDF' }).click()
    expect((await espera).suggestedFilename()).toBe(`Informe prueba - ${e.maria.nombre} - ${e.titulo}.pdf`)

    // Bruno: la evaluación desactivada con su motivo.
    await lista.getByRole('button', { name: new RegExp(e.bruno.nombre) }).click()
    const eva = pestanas.getByRole('tab', { name: /Evaluación/ })
    await expect(eva).toHaveAttribute('aria-disabled', 'true')
    await expect(eva).toHaveAttribute('title', 'La IA está calificando')

    // AC-01f2: el .zip de toda la vacante.
    const esperaZip = page.waitForEvent('download', { timeout: 60_000 })
    await page.getByRole('button', { name: /Descargar los de toda la vacante/ }).click()
    const zip = await guardar(await esperaZip)
    const entradas = execFileSync('python3', ['-I', '-c',
      'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' })
      .trim().split('\n')
    const carpetas = new Set(entradas.filter((n) => n.includes('/')).map((n) => n.split('/')[0]!))
    expect([...carpetas].some((c) => c.includes('María José'))).toBe(true)
    expect(entradas.some((n) => n.endsWith('/1 - Informe del CV.pdf') && n.includes('María José'))).toBe(true)
    expect(entradas.some((n) => n.endsWith('/2 - Informe de la evaluación.pdf') && n.includes('María José'))).toBe(true)
    expect(entradas.some((n) => n.endsWith('/3 - Informe de la prueba del puesto.pdf') && n.includes('María José'))).toBe(true)
    const aviso = entradas.find((n) => n.startsWith('LEEME'))
    expect(aviso).toBeTruthy()
    const leeme = execFileSync('python3', ['-I', '-c',
      'import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())', zip, aviso!], { encoding: 'utf8' })
    expect(leeme).toContain(e.bruno.nombre)
    expect(leeme).toContain('La IA está calificando')
    // «una carpeta por postulante» visible (AC-01f2: 13 visibles → 13 carpetas).
    expect(carpetas.size, `carpetas: ${[...carpetas].join(' | ')}`).toBe(visor.postulantes.length)
  })

  test('Visor · «Abrir ficha» lleva a la ficha abierta aunque la persona no esté en el corte «Pendiente»', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    // Carla (solo CV) y María desde las pestañas CV y Evaluación: ninguna espera decisión en
    // Perfil Integral, así que el corte «Pendiente» no las enseña (F-4).
    for (const [quien, etapa] of [[e.carla, 'cv'], [e.maria, 'cv'], [e.maria, 'evaluacion']] as const) {
      await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${quien.postulacion}&etapa=${etapa}`)
      await expect(page.getByRole('heading', { level: 2, name: quien.nombre })).toBeVisible()
      await page.getByRole('link', { name: /Abrir la ficha para ajustar/ }).click()
      await expect(page).toHaveURL(new RegExp(`etapa=PERFIL_INTEGRAL&postulante=${quien.postulacion}`))
      const ficha = page.locator(`#ficha-${quien.postulacion}`)
      await expect(ficha, `${quien.nombre} desde «${etapa}»`).toBeVisible({ timeout: 20_000 })
      await expect(ficha.getByRole('group', { name: 'Informes en PDF' })).toBeVisible()
    }
  })

  test('Visor · «Abrir ficha» deja a la vista el comienzo de la ficha, con su barra de informes, en escritorio y a 390 px', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    for (const [ancho, alto, enlace] of [[1440, 900, /Abrir la ficha para ajustar/], [390, 844, /✎ Abrir ficha/]] as const) {
      await page.setViewportSize({ width: ancho, height: alto })
      for (const quien of [e.carla, e.maria]) {
        await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${quien.postulacion}&etapa=cv`)
        await expect(page.getByRole('heading', { level: 2, name: quien.nombre })).toBeVisible()
        await page.getByRole('link', { name: enlace }).click()
        const ficha = page.locator(`#ficha-${quien.postulacion}`)
        // Con la ficha ya cargada (su «Criterio a criterio»), se mira dónde quedó la vista.
        await expect(ficha.getByText('Criterio a criterio')).toBeVisible({ timeout: 20_000 })
        await expect(ficha.getByRole('group', { name: 'Informes en PDF' }), `${quien.nombre} a ${ancho} px`).toBeInViewport()
      }
    }
  })

  test('Visor · un solo «Abrir ficha» en escritorio y uno solo a 390 px', async ({ page }) => {
    await entrarAlPanelCon(page, equipo)
    for (const ancho of [1440, 390]) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${e.maria.postulacion}&etapa=cv`)
      await expect(page.getByRole('heading', { level: 2, name: e.maria.nombre })).toBeVisible()
      await expect(page.getByText('Lo que el CV demuestra').first()).toBeVisible({ timeout: 20_000 })
      const enlaces = page.getByRole('link', { name: /Abrir ficha|Abrir la ficha/ })
      let visibles = 0
      for (let i = 0; i < (await enlaces.count()); i++) if (await enlaces.nth(i).isVisible()) visibles++
      expect(visibles, `enlaces «Abrir ficha» visibles a ${ancho} px`).toBe(1)
    }
  })

  test('Visor · AC-01g: a 390×844 la lista es un selector con anterior y siguiente y nada se sale', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await entrarAlPanelCon(page, equipo)
    await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${e.maria.postulacion}&etapa=cv`)
    const selector = page.getByRole('combobox', { name: 'Elegir postulante' })
    await expect(selector).toBeVisible()
    await expect(page.getByRole('button', { name: 'Postulante anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Postulante siguiente' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Postulantes de la vacante' })).toBeHidden()
    await expect(page.getByRole('heading', { level: 2, name: e.maria.nombre })).toBeVisible()
    await expect(page.getByText('Lo que el CV demuestra').first()).toBeVisible({ timeout: 20_000 })
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(ancho).toBeLessThanOrEqual(390)
    const pestanas = page.getByRole('tablist', { name: 'Informe' })
    const overflow = await pestanas.evaluate((n) => getComputedStyle(n).overflowX)
    expect(['auto', 'scroll']).toContain(overflow)
  })

  test('Ficha · AC-08b: a 390 px los botones miden 44 px, en mayúsculas, y caben en la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await entrarAlPanelCon(page, equipo)
    await abrirLaFicha(page, e.maria.nombre, 'Perfil integral')
    const grupo = page.getByRole('group', { name: 'Informes en PDF' })
    for (const nombre of ['Descargar el informe del CV', 'Descargar el informe de la evaluación']) {
      const boton = grupo.getByRole('button', { name: nombre })
      const caja = (await boton.boundingBox())!
      expect(Math.round(caja.height)).toBeGreaterThanOrEqual(44)
      expect(caja.x).toBeGreaterThanOrEqual(0)
      expect(caja.x + caja.width).toBeLessThanOrEqual(390)
      expect(await boton.evaluate((n) => getComputedStyle(n).textTransform)).toBe('uppercase')
    }
  })
})
