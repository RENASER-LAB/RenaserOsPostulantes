import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { API } from './ayuda'
import { literal, sql } from './base-de-datos'
import { consultar, entrarAlPanelCon, exigir, pedir, tokenDePanel, uno } from './ayuda-preguntas-propias'
import { DECLARADAS, DEMOSTRADAS, ENTREGABLES, FORTALEZAS } from './ayuda-informes-qa'
import {
  AFIRMACION_CON_PREGUNTA_TAPADA,
  AFIRMACION_TAPADA,
  ENLACE_ENTREGABLE,
  HALLAZGO_TAPADO,
  JUSTIFICACION_TAPADA,
  combinada,
  retirarLoDeLaFecha,
  sembrarLaFecha,
  type EscenarioFecha,
  type Sembrada,
} from './ayuda-la-ia-sabe-que-dia-es-hoy'

/**
 * QA de la spec la-ia-sabe-que-dia-es-hoy (backend specs/Ready/la-ia-sabe-que-dia-es-hoy.md):
 * el orden del visor de informes y de su .zip, los entregables con enlace, el celular en el
 * visor, que ningún texto con la marca del anonimizador llegue al panel, y la lista previa del
 * comando que recalifica a los afectados (con la IA apagada en el preview la tanda no encola a
 * nadie: cada afectado sale en «fallidas» y conserva su calificación).
 *
 * Siembra su propia vacante (`ayuda-la-ia-sabe-que-dia-es-hoy.ts`) y la retira al final.
 */

const CARPETA = process.env.QA_FECHA_EVIDENCIA ?? mkdtempSync(join(tmpdir(), 'qa-fecha-87-'))
const correos: string[] = []
let equipo: string
let e: EscenarioFecha

interface Celular { texto: string; llamar: string; whatsapp: string | null }
interface PostulanteDelVisor {
  postulacionId: number
  puesto: number
  candidato: string
  notaCv: number | null
  notaEvaluacion: number | null
  notaPrueba: number | null
  celular: Celular | null
}
interface Visor { postulantes: PostulanteDelVisor[]; etapas: string[] }

const texto = (ruta: string): string => execFileSync('pdftotext', [ruta, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
const enlacesDelPdf = (ruta: string): string[] =>
  execFileSync('pdfinfo', ['-url', ruta], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/).slice(2).join(' '))
    .filter(Boolean)

async function bajar(ruta: string, token = equipo): Promise<{ estado: number; archivo: string }> {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
  const archivo = join(CARPETA, `api-${r.status}-${Math.random().toString(36).slice(2)}${ruta.endsWith('zip') ? '.zip' : '.pdf'}`)
  writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
  return { estado: r.status, archivo }
}

const visorDe = (token: string): Promise<Visor> => exigir<Visor>(`/panel/vacantes/${e.vacante}/informes`, token)
const del = (v: Visor, s: Sembrada): PostulanteDelVisor => v.postulantes.find((p) => p.postulacionId === s.postulacion)!
const lugar = (v: Visor, s: Sembrada): number => v.postulantes.findIndex((p) => p.postulacionId === s.postulacion)

async function abrirElVisor(page: Page, token: string, quien: Sembrada, etapa: 'cv' | 'evaluacion' | 'prueba' = 'cv') {
  await entrarAlPanelCon(page, token)
  await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${quien.postulacion}&etapa=${etapa}`)
  await expect(page.getByRole('heading', { level: 2, name: quien.nombre })).toBeVisible({ timeout: 20_000 })
}

test.describe('QA · la IA sabe qué día es hoy, el visor ordenado, entregables y celular', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000)
    equipo = await tokenDePanel()
    e = await sembrarLaFecha(equipo, correos)
  })

  test.afterAll(() => {
    retirarLoDeLaFecha(correos)
  })

  test('AC-09 · API: los que tienen las tres notas arriba por nota combinada (desempate por la prueba); los demás debajo en el orden del ranking', async () => {
    const visor = await visorDe(equipo)
    const ranking = await exigir<{ filas: { postulacionId: number }[] }>(`/panel/vacantes/${e.vacante}/ranking`, equipo)
    // El oráculo: con las tres notas, de mayor a menor combinada; a igual combinada, la prueba y luego la evaluación.
    const conLasTres = visor.postulantes.filter((p) => p.notaCv != null && p.notaEvaluacion != null && p.notaPrueba != null)
    const orden = [...conLasTres].sort((a, b) =>
      combinada(e.vacante, b.notaEvaluacion!, b.notaPrueba!) - combinada(e.vacante, a.notaEvaluacion!, a.notaPrueba!) ||
      b.notaPrueba! - a.notaPrueba! || b.notaEvaluacion! - a.notaEvaluacion!)
    const resto = ranking.filas.map((f) => f.postulacionId).filter((id) => !conLasTres.some((p) => p.postulacionId === id))
    expect(visor.postulantes.map((p) => p.postulacionId)).toEqual([...orden.map((p) => p.postulacionId), ...resto])
    // Numerados 1, 2, 3… en este orden, no con el puesto del ranking.
    expect(visor.postulantes.map((p) => p.puesto)).toEqual(visor.postulantes.map((_, i) => i + 1))

    // La captura del 16/11: Robert (86,71) > Ruth (80,29) > Mayra (79,43); Tania (prueba 80) antes que Teo (76) con 74,29.
    expect(lugar(visor, e.robert)).toBeLessThan(lugar(visor, e.ruth))
    expect(lugar(visor, e.ruth)).toBeLessThan(lugar(visor, e.mayra))
    expect(combinada(e.vacante, 70, 80)).toBe(combinada(e.vacante, 73, 76))
    expect(lugar(visor, e.tania)).toBeLessThan(lugar(visor, e.teo))
    // Ximena (Perfil 90, grupo ALTA) y Alex van primero en el ranking, pero sin prueba bajan.
    const primeroDelRanking = ranking.filas.findIndex((f) => f.postulacionId === e.ximena.postulacion)
    expect(primeroDelRanking).toBeLessThan(ranking.filas.findIndex((f) => f.postulacionId === e.robert.postulacion))
    for (const conTres of [e.robert, e.mayra, e.ruth, e.tania, e.teo]) {
      expect(lugar(visor, conTres)).toBeLessThan(lugar(visor, e.ximena))
      expect(lugar(visor, conTres)).toBeLessThan(lugar(visor, e.alex))
    }
  })

  test('AC-10 · API y pantalla: sin permiso para ver la nota del CV el orden es el mismo y la columna CV sale vacía', async ({ page }) => {
    const deDireccion = await visorDe(equipo)
    const sinCvToken = await tokenDePanel(e.sinCv)
    const sinCv = await visorDe(sinCvToken)
    expect(sinCv.etapas).not.toContain('CV')
    expect(sinCv.postulantes.map((p) => p.postulacionId)).toEqual(deDireccion.postulantes.map((p) => p.postulacionId))
    expect(sinCv.postulantes.map((p) => p.puesto)).toEqual(deDireccion.postulantes.map((p) => p.puesto))
    expect(sinCv.postulantes.every((p) => p.notaCv === null)).toBe(true)

    await abrirElVisor(page, sinCvToken, e.robert, 'evaluacion')
    const filas = page.getByRole('complementary', { name: 'Postulantes de la vacante' }).getByRole('button')
    await expect(filas).toHaveCount(sinCv.postulantes.length)
    for (const [i, p] of sinCv.postulantes.entries()) {
      await expect(filas.nth(i)).toContainText(p.candidato)
      await expect(filas.nth(i).getByLabel(/^CV /)).toHaveAttribute('aria-label', 'CV —')
    }
  })

  test('AC-09 · pantalla: número de cada fila, «Puesto N de M» y «ordenados por nota combinada»', async ({ page }) => {
    const visor = await visorDe(equipo)
    await abrirElVisor(page, equipo, e.ruth)
    const total = visor.postulantes.length
    await expect(page.getByText(`${total} postulantes, ordenados por nota combinada`)).toBeVisible()
    await expect(page.getByText('en el orden del ranking')).toHaveCount(0)
    await expect(page.getByText(`Puesto ${del(visor, e.ruth).puesto} de ${total}`, { exact: true })).toBeVisible()
    await expect(page.getByText(/Puesto \d+ del ranking/)).toHaveCount(0)
    const filas = page.getByRole('complementary', { name: 'Postulantes de la vacante' }).getByRole('button')
    await expect(filas).toHaveCount(total)
    for (const [i, p] of visor.postulantes.entries()) {
      await expect(filas.nth(i)).toContainText(p.candidato)
      await expect(filas.nth(i).locator('span').first()).toHaveText(String(i + 1))
    }
  })

  test('AC-11 · el .zip de la vacante numera sus carpetas en el mismo orden que el visor', async () => {
    const visor = await visorDe(equipo)
    const zip = await bajar(`/panel/vacantes/${e.vacante}/informes/zip`)
    expect(zip.estado).toBe(200)
    const entradas = execFileSync('python3', ['-I', '-c',
      'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip.archivo], { encoding: 'utf8' })
      .trim().split('\n')
    const carpetas = [...new Set(entradas.filter((n) => n.includes('/')).map((n) => n.split('/')[0]!))]
    expect(carpetas.length).toBeGreaterThan(2)
    for (const carpeta of carpetas) {
      const m = /^(\d{2}) - (.+)$/.exec(carpeta)
      expect(m, carpeta).not.toBeNull()
      const p = visor.postulantes[Number(m![1]) - 1]
      expect(p, carpeta).toBeTruthy()
      expect(carpeta).toBe(`${m![1]} - ${p!.candidato.replace(/[\\/:*?"<>|]/g, '')}`)
    }
    // Robert va antes que Ruth también en las carpetas.
    const n = (s: Sembrada) => carpetas.findIndex((c) => c.endsWith(s.nombre))
    if (n(e.robert) >= 0 && n(e.ruth) >= 0) expect(n(e.robert)).toBeLessThan(n(e.ruth))
  })

  test('AC-14 a AC-16 · API: el celular de la cuenta, el del CV, ninguno, un fijo y uno corto', async () => {
    const visor = await visorDe(equipo)
    // Los de las cuentas son nuevos en cada siembra (V92: un número es de una sola cuenta).
    const robert = e.celularDeRobert
    expect(del(visor, e.robert).celular).toEqual({
      texto: robert.escrito, llamar: `tel:${robert.e164}`, whatsapp: `https://wa.me/${robert.e164.slice(1)}`,
    })
    expect(del(visor, e.mayra).celular).toEqual({
      texto: '923 456 789', llamar: 'tel:+51923456789', whatsapp: 'https://wa.me/51923456789',
    })
    expect(del(visor, e.ruth).celular).toBeNull()
    expect(del(visor, e.ximena).celular?.whatsapp).toBeNull()
    expect(del(visor, e.ximena).celular?.llamar).toBe(`tel:${e.fijoDeXimena}`)
    expect(del(visor, e.alex).celular?.whatsapp).toBeNull()
    expect(del(visor, e.alex).celular?.llamar).toBe('tel:98765432')
  })

  test('AC-14 a AC-16 · pantalla: «☎ 9xx xxx xxx» llama, «WhatsApp» abre otra pestaña; sin número nada; fijo sin WhatsApp; nunca en el PDF', async ({ page }) => {
    const robert = e.celularDeRobert
    await abrirElVisor(page, equipo, e.robert)
    const tarjeta = page.getByRole('region', { name: 'Postulante' })
    const llamar = tarjeta.getByRole('link', { name: `Llamar al ${robert.escrito}` })
    await expect(llamar).toHaveAttribute('href', `tel:${robert.e164}`)
    await expect(llamar).toContainText(robert.escrito)
    const wa = tarjeta.getByRole('link', { name: `Escribir por WhatsApp al ${robert.escrito}` })
    await expect(wa).toHaveAttribute('href', `https://wa.me/${robert.e164.slice(1)}`)
    await expect(wa).toHaveAttribute('target', '_blank')
    await expect(wa).toHaveAttribute('rel', /noopener/)
    await expect(tarjeta.getByText('912 345 678')).toHaveCount(0)

    // María: el celular va antes que las redes.
    await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${e.informes.maria.postulacion}&etapa=cv`)
    await expect(page.getByRole('heading', { level: 2, name: e.informes.maria.nombre })).toBeVisible()
    // Las redes llegan con el informe, después de la lista: se espera a que estén.
    await expect(page.getByRole('region', { name: 'Postulante' }).locator('a[href^="https://www.linkedin.com/"]')).toBeVisible()
    const hrefs = await page.getByRole('region', { name: 'Postulante' }).locator('a[href]').evaluateAll((as) =>
      as.map((a) => a.getAttribute('href') ?? ''))
    // El de su cuenta, que desde la V92 es único y ya no coincide con el del CV.
    const tel = hrefs.indexOf(`tel:${e.informes.maria.celular.e164}`)
    expect(tel, hrefs.join(' | ')).toBeGreaterThanOrEqual(0)
    const red = hrefs.findIndex((h) => h.startsWith('https://www.linkedin.com/'))
    expect(red).toBeGreaterThan(tel)

    for (const [quien, conWhatsapp, numero] of [[e.ruth, false, null], [e.ximena, false, e.fijoDeXimena], [e.alex, false, '98765432']] as const) {
      await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${quien.postulacion}&etapa=cv`)
      await expect(page.getByRole('heading', { level: 2, name: quien.nombre })).toBeVisible()
      const t = page.getByRole('region', { name: 'Postulante' })
      await expect(t.getByRole('link', { name: /WhatsApp/ })).toHaveCount(conWhatsapp ? 1 : 0)
      if (numero) await expect(t.getByRole('link', { name: `Llamar al ${numero}` })).toBeVisible()
      else await expect(t.getByRole('link', { name: /^Llamar al/ })).toHaveCount(0)
    }

    // Los PDF siguen sin datos de contacto.
    const pdf = await bajar(`/panel/postulaciones/${e.robert.postulacion}/informes/cv/pdf`)
    expect(pdf.estado).toBe(200)
    const todo = texto(pdf.archivo)
    for (const p of [robert.escrito, robert.e164.slice(3), '912 345 678']) expect(todo).not.toContain(p)
    expect(enlacesDelPdf(pdf.archivo).some((u) => u.startsWith('tel:') || u.includes('wa.me'))).toBe(false)
  })

  test('D-1 · celular: de una persona anonimizada el visor no enseña ni el de la cuenta ni el del CV; la de al lado sigue con el suyo', async ({ page }) => {
    // Robert tiene celular en la cuenta y en el CV; Mayra solo en el CV. Se marcan como lo deja el
    // borrado de datos (anonimizado_en) solo durante esta prueba. El número de la cuenta de Robert
    // se deja a propósito: aunque quedara alguno, no sale.
    const personaDe = (s: Sembrada) => Number(uno(`select u.persona_id from usuario u join postulacion x on x.usuario_id = u.id
                                                     where x.id = ${s.postulacion}`).persona_id)
    const ids = [personaDe(e.robert), personaDe(e.mayra)]
    expect(ids.every((id) => Number.isInteger(id) && id > 0), 'personas de Robert y Mayra').toBe(true)
    expect(Number(uno(`select count(*) as n from persona where id in (${ids.join(',')}) and anonimizado_en is null`).n)).toBe(2)
    sql(`update persona set anonimizado_en = now() where id in (${ids.join(',')});`)
    try {
      const visor = await visorDe(equipo)
      expect(del(visor, e.robert), 'Robert sigue en el visor').toBeTruthy()
      expect(del(visor, e.mayra), 'Mayra sigue en el visor').toBeTruthy()
      expect(del(visor, e.robert).celular ?? null).toBeNull()
      expect(del(visor, e.mayra).celular ?? null).toBeNull()
      const delVisor = JSON.stringify(visor)
      for (const n of [e.celularDeRobert.e164.slice(3), '912 345 678', '923-456-789', '923456789']) expect(delVisor).not.toContain(n)
      // La de al lado, sin anonimizar, sigue con el del CV (8 cifras: sin WhatsApp).
      expect(del(visor, e.alex).celular?.llamar).toBe('tel:98765432')

      // En la misma pantalla, quien no está anonimizado sí enseña el suyo.
      await abrirElVisor(page, equipo, e.alex)
      await expect(page.getByRole('region', { name: 'Postulante' }).getByRole('link', { name: 'Llamar al 98765432' })).toBeVisible()
      for (const quien of [e.robert, e.mayra]) {
        await page.goto(`/admin/vacantes/${e.vacante}/informes?postulante=${quien.postulacion}&etapa=cv`)
        // El visor ya pinta a una persona anonimizada como «(anonimizado)».
        await expect(page.getByRole('heading', { level: 2, name: '(anonimizado)' })).toBeVisible({ timeout: 20_000 })
        const t = page.getByRole('region', { name: 'Postulante' })
        // La fila de la cabecera ya está pintada (ahí iría el celular) y el informe terminó de llegar.
        await expect(t.getByRole('link', { name: /^Abrir la ficha/ })).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expect(t.getByRole('link', { name: /^Llamar al/ })).toHaveCount(0)
        await expect(t.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0)
        await expect(t.locator('a[href^="tel:"], a[href*="wa.me"]')).toHaveCount(0)
        for (const n of [e.celularDeRobert.escrito, '912 345 678', '923 456 789']) await expect(page.getByText(n)).toHaveCount(0)
      }
    } finally {
      sql(`update persona set anonimizado_en = null where id in (${ids.join(',')});`)
    }
    expect(del(await visorDe(equipo), e.robert).celular?.texto).toBe(e.celularDeRobert.escrito)
  })

  test('AC-12 · con «descargar_entregables»: el archivo y el enlace se abren desde el visor; el PDF enlaza la dirección', async ({ page }) => {
    const informe = await exigir<any>(`/panel/postulaciones/${e.informes.maria.postulacion}/informes/prueba`, equipo)
    const [archivo, enlace] = [ENTREGABLES[0], ENTREGABLES[1]].map((n) =>
      (informe.anexo.entregables as any[]).find((x) => x.nombre === n))
    expect(archivo.entregado).toBe(true)
    expect(typeof archivo.archivoId).toBe('number')
    expect(enlace.entregado).toBe(true)
    expect(enlace.url).toBe(ENLACE_ENTREGABLE)

    await abrirElVisor(page, equipo, e.informes.maria, 'prueba')
    const abreArchivo = page.getByRole('button', { name: `Abrir «${ENTREGABLES[0]}» en una pestaña nueva` })
    await expect(abreArchivo).toBeVisible()
    const abreEnlace = page.getByRole('link', { name: `Abrir «${ENTREGABLES[1]}» en una pestaña nueva` })
    await expect(abreEnlace).toHaveAttribute('href', ENLACE_ENTREGABLE)
    await expect(abreEnlace).toHaveAttribute('target', '_blank')
    await expect(page.getByText('Entregado', { exact: true })).toHaveCount(2)
    // En local el enlace firmado es memoria://: el visor cae a la descarga por el backend.
    const enlaceFirmado = page.waitForResponse((r) => r.url().includes(`/archivos/${archivo.archivoId}/enlace`))
    const descarga = page.waitForEvent('download', { timeout: 30_000 })
    await abreArchivo.click()
    expect((await enlaceFirmado).status()).toBe(200)
    expect((await descarga).suggestedFilename()).toBe('cronograma.pdf')

    const pdf = await bajar(`/panel/postulaciones/${e.informes.maria.postulacion}/informes/prueba/pdf`)
    expect(pdf.estado).toBe(200)
    expect(enlacesDelPdf(pdf.archivo)).toContain(ENLACE_ENTREGABLE)
    expect(texto(pdf.archivo)).not.toContain('CONTENIDO-SECRETO-QA-INF-84')
  })

  test('AC-13 · sin «descargar_entregables»: ni el visor ni el PDF traen con qué abrir los entregables', async ({ page }) => {
    const token = await tokenDePanel(e.sinEntregables)
    const informe = await exigir<any>(`/panel/postulaciones/${e.informes.maria.postulacion}/informes/prueba`, token)
    for (const x of informe.anexo.entregables as any[]) {
      expect(x.archivoId ?? null).toBeNull()
      expect(x.url ?? null).toBeNull()
    }
    await abrirElVisor(page, token, e.informes.maria, 'prueba')
    await expect(page.getByText(ENTREGABLES[0], { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Abrir «/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Abrir «/ })).toHaveCount(0)
    const pdf = await bajar(`/panel/postulaciones/${e.informes.maria.postulacion}/informes/prueba/pdf`, token)
    expect(pdf.estado).toBe(200)
    expect(enlacesDelPdf(pdf.archivo)).not.toContain(ENLACE_ENTREGABLE)
  })

  test('AC-08 · la marca [DATO NO UTILIZABLE] no llega ni al informe, ni al PDF, ni a la ficha, ni al ranking', async ({ page }) => {
    const maria = e.informes.maria.postulacion
    const cv = JSON.stringify(await exigir(`/panel/postulaciones/${maria}/informes/cv`, equipo))
    expect(cv).not.toContain('DATO NO UTILIZABLE')
    expect(cv).not.toContain(AFIRMACION_CON_PREGUNTA_TAPADA)
    expect(cv).toContain(DEMOSTRADAS[0])
    expect(cv).toContain(DECLARADAS[0]!.pregunta)
    const evaluacion = JSON.stringify(await exigir(`/panel/postulaciones/${maria}/informes/evaluacion`, equipo))
    expect(evaluacion).not.toContain('DATO NO UTILIZABLE')
    expect(evaluacion).toContain(FORTALEZAS[0])
    for (const etapa of ['cv', 'evaluacion']) {
      const pdf = await bajar(`/panel/postulaciones/${maria}/informes/${etapa}/pdf`)
      expect(pdf.estado).toBe(200)
      expect(texto(pdf.archivo)).not.toContain('DATO NO UTILIZABLE')
    }
    const ficha = JSON.stringify(await exigir(`/panel/postulaciones/${maria}/perfil-integral`, equipo))
    expect(ficha).not.toContain('DATO NO UTILIZABLE')
    expect(ficha).toContain(FORTALEZAS[0])
    const ranking = await exigir<any>(`/panel/vacantes/${e.vacante}/ranking`, equipo)
    const suya = (ranking.filas as any[]).find((f) => f.postulacionId === maria)
    expect(JSON.stringify(suya)).not.toContain('DATO NO UTILIZABLE')

    await abrirElVisor(page, equipo, e.informes.maria, 'cv')
    await expect(page.getByText(DEMOSTRADAS[0]!)).toBeVisible()
    await expect(page.getByText(/DATO NO UTILIZABLE/)).toHaveCount(0)
    for (const t of [AFIRMACION_TAPADA, HALLAZGO_TAPADO, JUSTIFICACION_TAPADA]) await expect(page.getByText(t)).toHaveCount(0)
  })

  test('AC-17 · el comando en modo de prueba: afectados en curso de vacantes abiertas, motivo, vacante y coste, sin llamar a la IA', async () => {
    const antes = Number(uno('select count(*) as n from trabajo_ia').n)
    const lista = await exigir<any>('/panel/plataforma/recalificacion-por-la-fecha', equipo)
    const afectado = (s: Sembrada) => (lista.afectados as any[]).find((a) => a.postulacionId === s.postulacion)
    expect(afectado(e.robert)).toMatchObject({ porLaFecha: true, porLosAnios: false, vacanteId: e.vacante, estado: 'PENDIENTE', llamadas: 3 })
    expect(afectado(e.tania)).toMatchObject({ porLaFecha: true, porLosAnios: false, vacanteId: e.vacante })
    expect(afectado(e.mayra)).toMatchObject({ porLaFecha: false, porLosAnios: true, vacanteId: e.vacante })
    // Ni la ajustada a mano, ni la que ya no continúa, ni la de la vacante cerrada; tampoco quien no tiene nada.
    for (const s of [e.ruth, e.nora, e.cesar, e.informes.maria, e.informes.carla, e.ximena]) {
      expect(afectado(s), s.nombre).toBeUndefined()
    }
    expect((lista.vacantes as any[]).find((v) => v.vacanteId === e.vacante)?.afectados).toBe(3)
    expect((lista.vacantes as any[]).some((v) => v.vacanteId === e.vacanteCerrada)).toBe(false)
    expect(lista.llamadasEstimadas).toBeGreaterThanOrEqual(9)
    expect(Number(uno('select count(*) as n from trabajo_ia').n)).toBe(antes)

    // El comando de administración, en modo de prueba (sin --confirmar), contra el mismo backend.
    const script = ['../backend', '../Backend-EX', '../../Backend-EX']
      .map((d) => resolve(process.cwd(), d, 'scripts/recalificar-afectados-por-la-fecha.py'))
      .find((r) => existsSync(r))
    expect(script, 'scripts/recalificar-afectados-por-la-fecha.py del backend').toBeTruthy()
    const salida = execFileSync('python3', ['-I', script!, '--api', API.replace(/\/api\/v1\/?$/, ''), '--usuario', 'dev-equipo'],
      { encoding: 'utf8' })
    writeFileSync(join(CARPETA, 'comando-modo-prueba.txt'), salida)
    expect(salida).toContain('Coste estimado:')
    expect(salida).toContain(`postulacion ${e.robert.postulacion} · ${e.robert.nombre}`)
    expect(salida).toMatch(new RegExp(`postulacion ${e.mayra.postulacion} · .* · anos · 3 llamadas`))
    expect(salida).not.toContain(`postulacion ${e.cesar.postulacion} `)
    expect(salida).toContain('Nada pedido')
    expect(Number(uno('select count(*) as n from trabajo_ia').n)).toBe(antes)
  })

  test('AC-17 · QA-FECHA-01/03: un CV que solo dice la edad no sale «por los años»; tampoco «Joven de 22 años en búsqueda de…»', async () => {
    // Ruth tiene un retrato viejo y ningún motivo propio (su justificación la ajustó una persona).
    // Teo recibe un retrato viejo solo durante esta prueba. Los dos CV dicen la edad, no
    // experiencia: si la regla nueva tapa la edad igual que la vieja, no hay años perdidos.
    const textoDe = (s: Sembrada) => uno(`select texto_extraido from cv where postulacion_id = ${s.postulacion}`).texto_extraido as string | null
    const deRuth = textoDe(e.ruth)
    const deTeo = textoDe(e.teo)
    const version = Number(uno(`select v.version_pesos_id from postulacion p join vacante v on v.id = p.vacante_id
                                 where p.id = ${e.teo.postulacion}`).version_pesos_id)
    const retratoDeTeo = Number(sql(`insert into perfil_talento (postulacion_id, confianza_evidencia, resumen, version_pesos_id)
                                     values (${e.teo.postulacion}, 60, 'QAFECHA retrato temporal', ${version}) returning id;`))
    expect(Number.isInteger(retratoDeTeo) && retratoDeTeo > 0, 'retrato temporal de Teo').toBe(true)
    try {
      sql(`update cv set texto_extraido = ${literal('Ruth Suri\n34 años\nEn búsqueda de nuevos retos laborales')}
            where postulacion_id = ${e.ruth.postulacion};
           update cv set texto_extraido = ${literal('Joven de 22 años en búsqueda de mi primer empleo')}
            where postulacion_id = ${e.teo.postulacion};`)
      const lista = await exigir<any>('/panel/plataforma/recalificacion-por-la-fecha', equipo)
      const afectado = (s: Sembrada) => (lista.afectados as any[]).find((a) => a.postulacionId === s.postulacion)
      // Sigue saliendo quien sí perdió años de experiencia.
      expect(afectado(e.mayra)).toMatchObject({ porLosAnios: true })
      expect(afectado(e.ruth), 'QA-FECHA-01 · «34 años» solo en su línea').toBeUndefined()
      expect(afectado(e.teo), 'QA-FECHA-03 · «Joven de 22 años en búsqueda de…» es una edad, no años de experiencia').toBeUndefined()
    } finally {
      sql(`update cv set texto_extraido = ${literal(deRuth)} where postulacion_id = ${e.ruth.postulacion};
           update cv set texto_extraido = ${literal(deTeo)} where postulacion_id = ${e.teo.postulacion};
           delete from perfil_talento where id = ${retratoDeTeo};`)
    }
  })

  test('AC-17 · D-2: «Tengo 10 años de experiencia…» sale «por los años» (API y comando); lo que tapan las dos reglas no sale', async () => {
    // Teo recibe un retrato viejo solo durante esta prueba y un CV que la regla vieja tapaba
    // («Tengo 10 años de experiencia» llegaba como «Tengo [DATO NO UTILIZABLE] de experiencia»):
    // con D-2 llega entero, así que perdió años de experiencia. Ruth dice su edad con una señal
    // delante y algo de la lista detrás: las dos reglas la tapan, no perdió nada.
    const textoDe = (s: Sembrada) => uno(`select texto_extraido from cv where postulacion_id = ${s.postulacion}`).texto_extraido as string | null
    const deRuth = textoDe(e.ruth)
    const deTeo = textoDe(e.teo)
    const antes = Number(uno('select count(*) as n from trabajo_ia').n)
    const version = Number(uno(`select v.version_pesos_id from postulacion p join vacante v on v.id = p.vacante_id
                                 where p.id = ${e.teo.postulacion}`).version_pesos_id)
    const retratoDeTeo = Number(sql(`insert into perfil_talento (postulacion_id, confianza_evidencia, resumen, version_pesos_id)
                                     values (${e.teo.postulacion}, 60, 'QAFECHA retrato temporal D-2', ${version}) returning id;`))
    expect(Number.isInteger(retratoDeTeo) && retratoDeTeo > 0, 'retrato temporal de Teo').toBe(true)
    try {
      sql(`update cv set texto_extraido = ${literal('Teo Empate\nTengo 10 años de experiencia en ventas.\nProfesional de 5 años de trayectoria.')}
            where postulacion_id = ${e.teo.postulacion};
           update cv set texto_extraido = ${literal('Tengo 34 años trabajando en Ripley. Juan Pérez, 34 años como cajero. Mujer de más de 40 años.')}
            where postulacion_id = ${e.ruth.postulacion};`)
      const lista = await exigir<any>('/panel/plataforma/recalificacion-por-la-fecha', equipo)
      const afectado = (s: Sembrada) => (lista.afectados as any[]).find((a) => a.postulacionId === s.postulacion)
      expect(afectado(e.teo), 'D-2.1 · la experiencia gana a la señal').toMatchObject({ porLosAnios: true, porLaFecha: false, vacanteId: e.vacante })
      expect(afectado(e.ruth), 'tapado por las dos reglas: no perdió años').toBeUndefined()
      expect(afectado(e.mayra)).toMatchObject({ porLosAnios: true })

      const script = ['../backend', '../Backend-EX', '../../Backend-EX']
        .map((d) => resolve(process.cwd(), d, 'scripts/recalificar-afectados-por-la-fecha.py'))
        .find((r) => existsSync(r))
      expect(script, 'scripts/recalificar-afectados-por-la-fecha.py del backend').toBeTruthy()
      const salida = execFileSync('python3', ['-I', script!, '--api', API.replace(/\/api\/v1\/?$/, ''), '--usuario', 'dev-equipo'],
        { encoding: 'utf8' })
      writeFileSync(join(CARPETA, 'comando-modo-prueba-d2.txt'), salida)
      expect(salida).toMatch(new RegExp(`postulacion ${e.teo.postulacion} · .* · anos · \\d+ llamadas`))
      expect(salida).not.toContain(`postulacion ${e.ruth.postulacion} `)
      expect(salida).toContain('Nada pedido')
      expect(Number(uno('select count(*) as n from trabajo_ia').n)).toBe(antes)
    } finally {
      sql(`update cv set texto_extraido = ${literal(deRuth)} where postulacion_id = ${e.ruth.postulacion};
           update cv set texto_extraido = ${literal(deTeo)} where postulacion_id = ${e.teo.postulacion};
           delete from perfil_talento where id = ${retratoDeTeo};`)
    }
  })

  test('AC-19 · con la IA apagada la tanda no encola a nadie: cada afectado sale en fallidas, conserva su nota, su grupo y su etapa', async () => {
    const ids = [e.robert, e.tania, e.mayra].map((s) => s.postulacion).join(',')
    const foto = () => JSON.stringify(consultar(`select p.id, p.estado_codigo, p.grupo_prioridad,
        (select json_agg(n.puntaje order by n.etapa_codigo) from nota_etapa n where n.postulacion_id = p.id) as notas,
        (select count(*) from trabajo_ia t where t.postulacion_id = p.id) as trabajos
      from postulacion p where p.id in (${ids}) order by p.id`))
    const antes = foto()
    const sinPlataforma = await tokenDePanel(e.informes.sinRespuestas)
    expect((await pedir('/panel/plataforma/recalificacion-por-la-fecha', sinPlataforma)).estado).toBe(403)
    expect((await pedir('/panel/plataforma/recalificacion-por-la-fecha', sinPlataforma, 'POST')).estado).toBe(403)

    const tanda = await exigir<any>('/panel/plataforma/recalificacion-por-la-fecha', equipo, 'POST')
    expect(tanda.encoladas).toBe(0)
    for (const s of [e.robert, e.tania, e.mayra]) {
      const fallida = (tanda.fallidas as any[]).find((f) => f.postulacionId === s.postulacion)
      expect(fallida?.motivo, s.nombre).toContain('apagada')
    }
    expect(foto()).toBe(antes)
    // Siguen en la lista, para reintentarlo.
    const lista = await exigir<any>('/panel/plataforma/recalificacion-por-la-fecha', equipo)
    for (const s of [e.robert, e.tania, e.mayra]) {
      expect((lista.afectados as any[]).some((a) => a.postulacionId === s.postulacion), s.nombre).toBe(true)
    }
  })
})
