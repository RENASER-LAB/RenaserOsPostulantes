import { expect, type Browser, type Locator, type Page } from '@playwright/test'
import { corte, entrarAlPanel } from './ayuda'
import { CLAVE_DE_CANDIDATO, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import {
  correoDeCandidata,
  empresaDelEquipo,
  idsDeLaCuenta,
  pedir,
  publicadaHace,
  resenaDe,
  retirarLoSembrado,
  sembrarContratacion,
  sembrarEmpresaB,
  sembrarEquipoDePanel,
  sembrarPostulacion,
  sembrarResenaDe,
  sembrarRespuesta,
  sembrarVacanteDe,
  tokenConClave,
  tokenDelEquipo,
  tokenDePanel,
  usuarioDelEquipo,
  type EmpresaB,
} from './ayuda-resenas'
import { sql } from './base-de-datos'

/**
 * Las reseñas entre empresas (QA del ciclo 1): lo que el spec 41 no puede
 * sembrar con una sola empresa.
 *
 * La empresa B se siembra como la siembra el alta (sin `moderar_resenas`) y su
 * usuario de Talento entra con correo y contraseña. Cada prueba trabaja sobre sus
 * propias personas: si una falla, Playwright rehace el terreno y las demás no
 * dependen de lo que dejó.
 *
 * Recorridos de la spec cubiertos aquí: 3 (con la tabla de B), 4, 5 (empresa
 * ajena y alcance), 6, 7 y 8, más los permisos (AC-01, AC-03…AC-05, AC-22,
 * AC-27) y los errores de la ficha (AC-07, AC-10, punto 23). Las pruebas
 * «RES-QA-0n» son regresiones de hallazgos de la exploración.
 */

const A_TEXTO = (quien: string, que: string) =>
  `${quien}: ${que}, con compromiso durante todo el tiempo que trabajó con nosotros.`
const RESPUESTA = 'Gracias por la oportunidad, aprendí mucho con todo el equipo de la obra.'

type Cuenta = { correo: string; usuario: number; persona: number; nombre: string }

let empresaA = ''
let equipoA = 0
let b: EmpresaB
let tokenB = ''
let vaUno = 0
let vaDos = 0
let vaTres = 0
let vbContrata = 0
let vbPostula = 0
const c: Record<string, Cuenta> = {}
const correos: string[] = []

async function cuenta(nombre: string): Promise<Cuenta> {
  const correo = correoDeCandidata()
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Reseñas', correo })
  return { correo, ...idsDeLaCuenta(correo), nombre: `${nombre} Reseñas` }
}

/** Una contratación de A sin historial, con su reseña ya publicada. */
function resenaDeA(vacante: number, quien: Cuenta, estrellas: number, texto: string, haceDias: number): number {
  const p = sembrarPostulacion(vacante, quien.usuario, 'CONTRATADO')
  return sembrarResenaDe(p, quien.persona, estrellas, texto, haceDias, equipoA)
}

function resenaDeB(quien: Cuenta, estrellas: number, texto: string, haceDias: number): number {
  const p = sembrarPostulacion(vbContrata, quien.usuario, 'CONTRATADO')
  return sembrarResenaDe(p, quien.persona, estrellas, texto, haceDias, b.usuario)
}

const postulacionDe = (vacante: number, quien: Cuenta): number =>
  Number(sql(`select id from postulacion where vacante_id = ${vacante} and usuario_id = ${quien.usuario};`))

async function paginaDelPortal(browser: Browser, quien: Cuenta): Promise<Page> {
  const pagina = await browser.newPage()
  const token = await tokenDelCandidato(quien.correo)
  await pagina.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    ['renaser_portal_token', token],
  )
  return pagina
}

async function paginaDelPanel(browser: Browser, token: string): Promise<Page> {
  const pagina = await browser.newPage()
  await pagina.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    ['renaser_panel_token', token],
  )
  return pagina
}

async function abrirVacante(page: Page, vacante: number) {
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  await corte(page, 'Toda la tanda').click()
}

async function abrirFicha(page: Page, vacante: number, quien: Cuenta) {
  await abrirVacante(page, vacante)
  await page.getByRole('button', { name: quien.nombre, exact: true }).click()
}

const bloqueAutora = (page: Page): Locator => page.getByRole('region', { name: `La reseña de ${empresaA}` })
const lectura = (page: Page): Locator => page.getByRole('region', { name: 'Reseñas de empresas' })
const lineaDeCabecera = (page: Page): Locator => page.getByRole('link', { name: /Ir a tus reseñas/ })
const tarjeta = (zona: Locator | Page, texto: string): Locator =>
  zona.getByRole('article').filter({ hasText: texto })

async function avisosDe(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: /^Avisos/ }).click()
  const lista = page.getByRole('dialog', { name: 'Tus avisos' })
  await expect(lista).toBeVisible()
  await expect(lista).not.toContainText('Buscando…')
  const textos = await lista.innerText()
  await page.getByRole('button', { name: /^Avisos/ }).click()
  return textos.split('\n')
}

test.beforeAll(async () => {
  retirarLoSembrado([], null)
  empresaA = empresaDelEquipo()
  equipoA = usuarioDelEquipo()
  for (const n of ['Valeria', 'Fabio', 'Diana', 'Elena', 'Bruno', 'Hilda', 'Irene', 'Julia', 'Karla', 'Lucia', 'Marta', 'Nora', 'Olga']) {
    c[n.toLowerCase()] = await cuenta(n)
  }
  b = sembrarEmpresaB(c.valeria!.correo)
  tokenB = await tokenConClave(b.correo, CLAVE_DE_CANDIDATO)
  const plataforma = Number(sql('select id from organizacion where es_plataforma;'))
  vaUno = sembrarVacanteDe(plataforma, equipoA, 'Coordinador de obra')
  vaDos = sembrarVacanteDe(plataforma, equipoA, 'Asistente de almacén')
  vaTres = sembrarVacanteDe(plataforma, equipoA, 'Jefe de proyectos')
  vbContrata = sembrarVacanteDe(b.id, b.usuario, 'Operario de campo')
  vbPostula = sembrarVacanteDe(b.id, b.usuario, 'Residente de obra')

  const { valeria, fabio, diana, elena, hilda, irene, julia } = c as Record<string, Cuenta>
  // Valeria: 5 y 4 de A, 5 de B → «4,7 · 3 reseñas» (AC-12), dos empresas (AC-15).
  resenaDeA(vaUno, valeria!, 5, A_TEXTO('Valeria', 'la más antigua, ya fija'), 31)
  resenaDeA(vaDos, valeria!, 4, A_TEXTO('Valeria', 'la más reciente de A'), 5)
  resenaDeB(valeria!, 5, A_TEXTO('Valeria', 'la de la empresa B'), 10)
  // Los empates de la columna: Elena 3,0 (3) y Diana 3,0 (1); Fabio 4,5 (2).
  resenaDeA(vaUno, fabio!, 5, A_TEXTO('Fabio', 'excelente'), 12)
  resenaDeA(vaDos, fabio!, 4, A_TEXTO('Fabio', 'bueno'), 11)
  resenaDeA(vaUno, diana!, 3, A_TEXTO('Diana', 'aceptable'), 15)
  resenaDeB(elena!, 1, A_TEXTO('Elena', 'muy mala según B'), 14)
  resenaDeA(vaUno, elena!, 5, A_TEXTO('Elena', 'excelente según A'), 13)
  resenaDeA(vaDos, elena!, 3, A_TEXTO('Elena', 'aceptable según A'), 12)
  // Hilda: la que se reporta y se oculta (recorrido 3), y la que se mantiene.
  resenaDeA(vaUno, hilda!, 5, A_TEXTO('Hilda', 'reseña que se va a ocultar'), 9)
  resenaDeA(vaDos, hilda!, 3, A_TEXTO('Hilda', 'reseña que se va a mantener'), 8)
  // Irene: una sin responder y otra de hace 28 días respondida hace 27 (AC-37).
  resenaDeA(vaDos, irene!, 4, A_TEXTO('Irene', 'sin responder todavía'), 3)
  const deHace28 = resenaDeA(vaTres, irene!, 4, A_TEXTO('Irene', 'publicada hace 28 días'), 28)
  sembrarRespuesta(deHace28, irene!.usuario, 'Irene responde: gracias, fue un gusto trabajar con ustedes.', 27, 3)
  // Julia: una respuesta que A reporta y la plataforma oculta, y otra que mantiene.
  const deJulia = resenaDeA(vaUno, julia!, 5, A_TEXTO('Julia', 'con respuesta que se oculta'), 3)
  sembrarRespuesta(deJulia, julia!.usuario, 'Julia responde: agradezco la reseña y a todo el equipo de obra.', 2, 28)
  const deJulia2 = resenaDeA(vaDos, julia!, 4, A_TEXTO('Julia', 'con respuesta que se mantiene'), 4)
  sembrarRespuesta(deJulia2, julia!.usuario, 'Julia responde otra vez: fue un buen tiempo, gracias por todo.', 3, 27)
  // Todas postulan a la vacante de B, y Bruno sin ninguna reseña («—»).
  for (const n of ['valeria', 'fabio', 'diana', 'elena', 'bruno', 'hilda', 'irene', 'julia']) {
    sembrarPostulacion(vbPostula, c[n]!.usuario)
  }
})

test.afterAll(() => {
  retirarLoSembrado(correos, null)
})

// ---------------------------------------------------------------------------
// Recorrido 4 · la empresa B y la columna «Reseñas»
// ---------------------------------------------------------------------------

test('4 · la empresa B enciende la columna, ordena con empates y «—», y abre la ficha (AC-23…AC-26)', async ({
  page,
}) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_panel_token',
    tokenB,
  ])
  await abrirVacante(page, vbPostula)
  const tabla = page.getByRole('table').first()
  // AC-23: en el menú y apagada al abrir la vacante.
  await expect(tabla.getByRole('columnheader', { name: /Reseñas/ })).toHaveCount(0)
  await page.locator('summary', { hasText: 'Columnas' }).click()
  const interruptor = page.getByRole('checkbox', { name: /Reseñas de empresas/ })
  await expect(interruptor).not.toBeChecked()
  await interruptor.check()
  await page.locator('summary', { hasText: 'Columnas' }).click()
  await expect(tabla.getByRole('columnheader', { name: /Reseñas/ })).toBeVisible()

  const celdas = async () =>
    tabla
      .locator('tbody tr')
      .filter({ has: page.locator('input[aria-label^="Avanza "]') })
      .evaluateAll((trs) =>
        trs.map((tr) => {
          const nombre = tr.querySelector('input[aria-label^="Avanza "]')!.getAttribute('aria-label')!.replace('Avanza ', '')
          const tds = [...tr.querySelectorAll('td')]
          return { nombre, valor: tds[tds.length - 1]!.innerText.trim() }
        }),
      )
  const servidor = await celdas()
  const de = (n: string) => servidor.find((f) => f.nombre === n)?.valor
  expect(de('Valeria Reseñas')).toBe('4,7 (3)')
  expect(de('Fabio Reseñas')).toBe('4,5 (2)')
  expect(de('Bruno Reseñas')).toBe('—')

  const clave = (v: string) => {
    const m = /^(\d),(\d) \((\d+)\)$/.exec(v)
    return m ? { prom: Number(`${m[1]}.${m[2]}`), n: Number(m[3]) } : null
  }
  const ordenada = (filas: { valor: string }[], signo: 1 | -1) => {
    const vistas = filas.map((f) => clave(f.valor))
    const primeraSin = vistas.findIndex((v) => v === null)
    // Las filas sin reseñas van siempre al final.
    if (primeraSin >= 0) expect(vistas.slice(primeraSin).every((v) => v === null)).toBe(true)
    const con = vistas.filter((v): v is { prom: number; n: number } => v !== null)
    for (let i = 1; i < con.length; i++) {
      const d = (con[i]!.prom - con[i - 1]!.prom) || (con[i]!.n - con[i - 1]!.n)
      expect(signo * d, `orden ${signo > 0 ? 'asc' : 'desc'}: ${filas.map((f) => f.valor).join(' | ')}`).toBeGreaterThanOrEqual(0)
    }
  }
  // AC-24: por promedio y, a igualdad, por cuántas; los «—» al final; tercer clic, el del servidor.
  const cabeza = tabla.getByRole('button', { name: 'Reseñas', exact: true })
  await cabeza.click()
  const desc = await celdas()
  ordenada(desc, -1)
  const posicion = (filas: { nombre: string }[], n: string) => filas.findIndex((f) => f.nombre === n)
  expect(posicion(desc, 'Elena Reseñas')).toBeLessThan(posicion(desc, 'Diana Reseñas'))
  expect(desc[desc.length - 1]!.valor).toBe('—')
  await cabeza.click()
  const asc = await celdas()
  ordenada(asc, 1)
  expect(posicion(asc, 'Diana Reseñas')).toBeLessThan(posicion(asc, 'Elena Reseñas'))
  expect(asc[asc.length - 1]!.valor).toBe('—')
  await cabeza.click()
  expect((await celdas()).map((f) => f.nombre)).toEqual(servidor.map((f) => f.nombre))

  // AC-26: la celda abre la ficha con el bloque de lectura, textos completos y sin «Reportar».
  await tabla.getByRole('button', { name: /^Reseñas de Valeria Reseñas: 4,7 \(3\)/ }).click()
  const bloque = lectura(page)
  await expect(bloque).toBeVisible()
  await expect(bloque.getByText(empresaA).first()).toBeVisible()
  await expect(bloque.getByText(b.nombre).first()).toBeVisible()
  await expect(bloque.getByRole('button', { name: /Reportar|Responder/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: /^La reseña de/ })).toHaveCount(0)
  await bloque.getByRole('button', { name: 'Ver todas las reseñas (3)' }).click()
  const ventana = page.getByRole('dialog', { name: 'Reseñas de empresas' })
  await expect(ventana.getByText('Se ven 3 de 3')).toBeVisible()
  await expect(ventana.getByText(A_TEXTO('Valeria', 'la más antigua, ya fija'))).toBeVisible()
  await expect(ventana.getByRole('button', { name: /Reportar|Responder/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // AC-25: la columna se ofrece en las cinco etapas.
  const pestanas = page.getByRole('tablist', { name: 'Etapa del ranking' }).getByRole('tab')
  await expect(pestanas).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    await pestanas.nth(i).click()
    await page.locator('summary', { hasText: 'Columnas' }).click()
    await expect(page.getByRole('checkbox', { name: /Reseñas de empresas/ })).toHaveCount(1)
    await page.locator('summary', { hasText: 'Columnas' }).click()
  }
})

// ---------------------------------------------------------------------------
// Recorrido 2 con dos empresas · la ventana «Ver todas»
// ---------------------------------------------------------------------------

test('2 · el perfil con 5, 5 y 4 de dos empresas: cabecera, índice, resumen y la ventana (AC-12…AC-16)', async ({
  page,
  browser,
}) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(c.valeria!.correo),
  ])
  await page.goto('/perfil')
  // AC-12: «★ 4,7 · 3 reseñas», «Reseñas 3», el reparto y las dos más recientes.
  await expect(lineaDeCabecera(page)).toHaveText('4,7 · 3 reseñas')
  await expect(
    page.getByRole('navigation', { name: 'Secciones de tu perfil' }).getByRole('link', { name: /Reseñas/ }),
  ).toHaveText(/Reseñas\s*3/)
  const seccion = page.locator('#resenas')
  await expect(seccion.getByRole('list', { name: 'Reparto por estrellas' })).toContainText('2')
  const recientes = seccion.getByRole('article')
  await expect(recientes).toHaveCount(2)
  await expect(recientes.nth(0)).toContainText('la más reciente de A')
  await expect(recientes.nth(1)).toContainText('la de la empresa B')
  // AC-14: con 3 o más, «Ver todas» con el total.
  const verTodas = seccion.getByRole('button', { name: 'Ver todas las reseñas (3)' })
  await verTodas.click()
  const ventana = page.getByRole('dialog', { name: 'Reseñas de empresas' })
  await expect(ventana.getByText('Se ven 3 de 3')).toBeVisible()

  // AC-15: 5★ y una empresa → solo las que cumplen las dos.
  await ventana.getByRole('button', { name: '5 estrellas (2)', exact: true }).click()
  await expect(ventana.getByText('Se ven 2 de 3')).toBeVisible()
  await ventana.getByLabel('Empresa').selectOption({ label: b.nombre })
  await expect(ventana.getByText('Se ven 1 de 3')).toBeVisible()
  await expect(ventana.getByRole('article')).toHaveCount(1)
  await expect(ventana.getByRole('article')).toContainText('la de la empresa B')
  // La barra «4★» del resumen deja el filtro de estrellas en 4★.
  await ventana.getByRole('button', { name: /^Ver solo las de 4 estrellas/ }).click()
  await expect(ventana.getByRole('button', { name: '4 estrellas (1)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(ventana.getByRole('button', { name: '5 estrellas (2)', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(ventana.getByText('Ninguna reseña con estos filtros')).toBeVisible()
  await ventana.getByRole('button', { name: 'Quitar filtros' }).first().click()
  await expect(ventana.getByText('Se ven 3 de 3')).toBeVisible()
  // Los chips en 0 salen deshabilitados.
  await expect(ventana.getByRole('button', { name: '3 estrellas (0)', exact: true })).toBeDisabled()

  // AC-16: «Peor calificadas», de menos a más y, a igualdad, la más reciente primero.
  await ventana.getByLabel('Orden').selectOption('peores')
  const orden = await ventana.getByRole('article').allInnerTexts()
  expect(orden[0]).toContain('la más reciente de A')
  expect(orden[1]).toContain('la de la empresa B')
  expect(orden[2]).toContain('la más antigua, ya fija')
  await page.keyboard.press('Escape')
  await expect(verTodas).toBeFocused()

  // AC-14 con 2 reseñas: sin «Ver todas». AC-13 sin reseñas: sin línea en la cabecera y estado vacío.
  const fabio = await paginaDelPortal(browser, c.fabio!)
  await fabio.goto('/perfil')
  await expect(lineaDeCabecera(fabio)).toHaveText('4,5 · 2 reseñas')
  await expect(fabio.locator('#resenas').getByRole('button', { name: /Ver todas/ })).toHaveCount(0)
  await fabio.close()
  const bruno = await paginaDelPortal(browser, c.bruno!)
  await bruno.goto('/perfil')
  await expect(bruno.locator('#resenas')).toContainText('Todavía no tienes reseñas')
  await expect(lineaDeCabecera(bruno)).toHaveCount(0)
  await bruno.close()
})

// ---------------------------------------------------------------------------
// Recorrido 3 · reportar, ocultar y mantener
// ---------------------------------------------------------------------------

test('3 · la persona reporta; la plataforma oculta una y mantiene otra; cambia el promedio en el perfil y en la tabla de B (AC-19…AC-21)', async ({
  page,
  browser,
}) => {
  const hilda = c.hilda!
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(hilda.correo),
  ])
  await page.goto('/perfil')
  await expect(lineaDeCabecera(page)).toHaveText('4,0 · 2 reseñas')
  const seccion = page.locator('#resenas')
  const aOcultar = tarjeta(seccion, 'reseña que se va a ocultar')
  await aOcultar.getByRole('button', { name: 'Reportar' }).click()
  const paso = page.getByRole('dialog', { name: `Reportar la reseña de ${empresaA}` })
  await paso.getByLabel('Revela datos personales o de salud').check()
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(aOcultar.getByText('Reportada · en revisión')).toBeVisible()
  await expect(aOcultar.getByRole('button', { name: 'Reportar' })).toHaveCount(0)
  // AC-19: tampoco por la API.
  const token = await tokenDelCandidato(hilda.correo)
  const mias = (await pedir('/portal/resenas', token)).cuerpo
  const idOcultar = mias.resenas.find((r: { texto: string }) => r.texto.includes('se va a ocultar')).id
  expect((await pedir(`/portal/resenas/${idOcultar}/reporte`, token, 'POST', { motivo: 'FALSA' })).estado).toBe(409)
  // Sigue contando mientras está en revisión.
  await expect(lineaDeCabecera(page)).toHaveText('4,0 · 2 reseñas')

  const aMantener = tarjeta(seccion, 'reseña que se va a mantener')
  await aMantener.getByRole('button', { name: 'Reportar' }).click()
  await page.getByLabel('Otro motivo').check()
  await page.getByLabel(/Cuéntanos más/).fill('Exagera lo que pasó en la obra.')
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(aMantener.getByText('Reportada · en revisión')).toBeVisible()

  // La plataforma: ocultar una y mantener la otra, con nota.
  const panel = await browser.newPage()
  await entrarAlPanel(panel)
  await panel.goto('/admin/configuracion')
  const moderacion = panel.getByRole('region', { name: 'Reseñas reportadas' })
  const t1 = tarjeta(moderacion, 'reseña que se va a ocultar')
  await expect(t1).toContainText(`${empresaA} → ${hilda.nombre}`)
  await expect(t1).toContainText('Revela datos personales o de salud')
  await t1.getByRole('button', { name: 'Ocultar' }).click()
  await expect(t1.getByRole('alert')).toContainText('Escribe la nota de la revisión')
  await t1.getByLabel('Nota de la revisión').fill('Menciona un diagnóstico médico de la persona.')
  await t1.getByRole('button', { name: 'Ocultar' }).click()
  await expect(t1).toHaveCount(0)
  const t2 = tarjeta(moderacion, 'reseña que se va a mantener')
  await t2.getByLabel('Nota de la revisión').fill('Cumple las normas: describe el desempeño.')
  await t2.getByRole('button', { name: 'Mantener' }).click()
  await expect(t2).toHaveCount(0)

  // AC-20: la empresa autora la ve atenuada, con la nota.
  await abrirFicha(panel, vaUno, hilda)
  await expect(bloqueAutora(panel)).toContainText('La plataforma la ocultó: Menciona un diagnóstico médico de la persona.')
  await expect(bloqueAutora(panel).getByRole('button', { name: /Editar|Borrar/ })).toHaveCount(0)
  await panel.close()

  // El promedio cambia en el perfil…
  await page.reload()
  await expect(lineaDeCabecera(page)).toHaveText('3,0 · 1 reseña')
  await expect(seccion.getByText('reseña que se va a ocultar')).toHaveCount(0)
  // AC-21: la mantenida sigue igual y sin «Reportada».
  await expect(tarjeta(seccion, 'reseña que se va a mantener').getByText('Reportada · en revisión')).toHaveCount(0)
  const avisos = await avisosDe(page)
  expect(avisos.join(' ')).toContain('Revisamos tu reporte: la ocultamos')
  expect(avisos.join(' ')).toContain('Revisamos tu reporte: la mantuvimos')

  // …y en la tabla de la empresa B.
  const deB = await paginaDelPanel(browser, tokenB)
  await abrirVacante(deB, vbPostula)
  await deB.locator('summary', { hasText: 'Columnas' }).click()
  await deB.getByRole('checkbox', { name: /Reseñas de empresas/ }).check()
  await deB.locator('summary', { hasText: 'Columnas' }).click()
  await expect(deB.getByRole('button', { name: /^Reseñas de Hilda Reseñas: 3,0 \(1\)/ })).toBeVisible()
  await deB.close()
})

// ---------------------------------------------------------------------------
// Recorrido 6 · responder, y la empresa edita una reseña ya respondida
// ---------------------------------------------------------------------------

test('6 · responde; A y B ven la respuesta; A edita la de hace 28 días y la persona recibe el aviso y edita la suya (AC-33, AC-37)', async ({
  page,
  browser,
}) => {
  const irene = c.irene!
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(irene.correo),
  ])
  await page.goto('/perfil')
  const seccion = page.locator('#resenas')
  await expect(lineaDeCabecera(page)).toHaveText('4,0 · 2 reseñas')
  const sinResponder = tarjeta(seccion, 'sin responder todavía')
  await sinResponder.getByRole('button', { name: 'Responder' }).click()
  const paso = page.getByRole('dialog', { name: `Responder a la reseña de ${empresaA}` })
  await expect(paso.getByText('La verán las empresas donde te postules')).toBeVisible()
  await paso.getByLabel('Tu respuesta').fill(RESPUESTA)
  await page.getByRole('button', { name: 'Publicar respuesta' }).click()
  await expect(sinResponder.getByText(RESPUESTA)).toBeVisible()
  await expect(sinResponder.getByRole('button', { name: 'Responder' })).toHaveCount(0)
  await expect(lineaDeCabecera(page)).toHaveText('4,0 · 2 reseñas')

  // La ven la empresa autora y la empresa B.
  const panel = await browser.newPage()
  await entrarAlPanel(panel)
  await abrirFicha(panel, vaDos, irene)
  await expect(bloqueAutora(panel)).toContainText(`Respuesta de ${irene.nombre}`)
  await expect(bloqueAutora(panel)).toContainText(RESPUESTA)
  const deB = await paginaDelPanel(browser, tokenB)
  await abrirFicha(deB, vbPostula, irene)
  await expect(lectura(deB)).toContainText(`Respuesta de ${irene.nombre}`)
  await expect(lectura(deB)).toContainText(RESPUESTA)
  await deB.close()

  // AC-37: A edita la de hace 28 días, respondida hace 27: aviso antes de guardar.
  await abrirFicha(panel, vaTres, irene)
  const bloque = bloqueAutora(panel)
  await bloque.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(bloque.getByRole('note')).toHaveText(
    `${irene.nombre} ya respondió a esta reseña. Si la cambias, le avisaremos para que pueda revisar su respuesta.`,
  )
  await bloque.getByLabel('Opinión').fill(A_TEXTO('Irene', 'publicada hace 28 días y corregida'))
  await bloque.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(bloque.getByText(/· Editada/).first()).toBeVisible()
  await panel.close()

  // El aviso, y 30 días desde la edición (no 3).
  await page.reload()
  expect((await avisosDe(page)).join(' ')).toMatch(new RegExp(`${empresaA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} editó su reseña`))
  const mias = (await pedir('/portal/resenas', await tokenDelCandidato(irene.correo))).cuerpo
  const editada = mias.resenas.find((r: { texto: string }) => r.texto.includes('corregida'))
  const dias = (Date.parse(editada.respuesta.editableHasta) - Date.now()) / 86_400_000
  expect(dias).toBeGreaterThan(29)
  expect(editada.respuesta.editable).toBe(true)
  const corregida = tarjeta(seccion, 'corregida')
  await corregida.getByRole('button', { name: 'Editar', exact: true }).click()
  const pasoEditar = page.getByRole('dialog', { name: `Responder a la reseña de ${empresaA}` })
  await expect(pasoEditar.getByLabel('Tu respuesta')).toHaveValue(/Irene responde/)
  await pasoEditar.getByLabel('Tu respuesta').fill('Irene responde: gracias, ya revisé lo que ahora dice la reseña.')
  await page.getByRole('button', { name: 'Guardar respuesta' }).click()
  await expect(corregida.getByText(/Tu respuesta · .* · Editada/)).toBeVisible()
})

// ---------------------------------------------------------------------------
// Recorrido 7 · A reporta la respuesta y la plataforma la oculta
// ---------------------------------------------------------------------------

test('7 · A reporta la respuesta, la plataforma la oculta: B deja de verla y la persona la ve atenuada con aviso (AC-39, AC-40)', async ({
  page,
  browser,
}) => {
  const julia = c.julia!
  await entrarAlPanel(page)
  await abrirFicha(page, vaUno, julia)
  const bloque = bloqueAutora(page)
  await bloque.getByRole('button', { name: 'Reportar la respuesta' }).click()
  const paso = page.getByRole('dialog', { name: 'Reportar la respuesta' })
  await expect(paso.getByText('La respuesta sigue visible mientras la revisamos.')).toBeVisible()
  await paso.getByLabel('Es falsa: cuenta hechos que no pasaron').check()
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(bloque.getByText('Reportada · en revisión')).toBeVisible()

  // AC-40: la empresa B la lee sin «Reportar la respuesta», y la API se lo niega.
  const deB = await paginaDelPanel(browser, tokenB)
  await abrirFicha(deB, vbPostula, julia)
  await expect(lectura(deB)).toContainText('agradezco la reseña')
  await expect(deB.getByRole('button', { name: 'Reportar la respuesta' })).toHaveCount(0)
  const pUno = postulacionDe(vaUno, julia)
  expect(
    (await pedir(`/panel/postulaciones/${pUno}/resena/respuesta/reporte`, tokenB, 'POST', { motivo: 'OFENSIVA' })).estado,
  ).toBe(404)

  // La plataforma la oculta.
  await page.goto('/admin/configuracion')
  const moderacion = page.getByRole('region', { name: 'Reseñas reportadas' })
  const t = tarjeta(moderacion, 'agradezco la reseña')
  await expect(t).toContainText('Respuesta')
  await expect(t).toContainText('con respuesta que se oculta')
  await t.getByLabel('Nota de la revisión').fill('Atribuye hechos falsos a la empresa.')
  await t.getByRole('button', { name: 'Ocultar' }).click()
  await expect(t).toHaveCount(0)

  // Mantener la otra por la API: nada cambia y a la persona no se le avisa.
  const equipo = await tokenDelEquipo()
  const pDos = postulacionDe(vaDos, julia)
  expect(
    (await pedir(`/panel/postulaciones/${pDos}/resena/respuesta/reporte`, equipo, 'POST', { motivo: 'OFENSIVA' })).estado,
  ).toBe(200)
  const pendientes = (await pedir('/panel/resenas-reportadas', equipo)).cuerpo as { id: number; textoRespuesta: string }[]
  const otro = pendientes.find((r) => r.textoRespuesta?.includes('Julia responde otra vez'))!
  expect(
    (await pedir(`/panel/resenas-reportadas/${otro.id}/resolucion`, equipo, 'POST', {
      decision: 'MANTENER',
      nota: 'No incumple las normas.',
    })).estado,
  ).toBe(200)

  await deB.reload()
  await corte(deB, 'Toda la tanda').click()
  await deB.getByRole('button', { name: julia.nombre, exact: true }).click()
  await expect(lectura(deB)).toContainText('con respuesta que se oculta')
  await expect(lectura(deB)).not.toContainText('agradezco la reseña')
  await expect(lectura(deB)).toContainText('Julia responde otra vez')
  await deB.close()

  // La persona: atenuada con la nota, sin «Editar», «Borrar» ni «Responder», y el aviso.
  const portal = await paginaDelPortal(browser, julia)
  await portal.goto('/perfil')
  const suya = tarjeta(portal.locator('#resenas'), 'con respuesta que se oculta')
  await expect(suya).toContainText('La plataforma ocultó tu respuesta: Atribuye hechos falsos a la empresa.')
  await expect(suya.getByRole('button', { name: /^(Editar|Borrar|Responder)$/ })).toHaveCount(0)
  const avisos = (await avisosDe(portal)).join(' ')
  expect(avisos).toContain(`La plataforma ocultó tu respuesta a la reseña de ${empresaA}`)
  expect(Number(sql(`select count(*) from aviso_portal where usuario_id = ${julia.usuario}
                      and tipo = 'RESPUESTA_RESENA_OCULTADA';`))).toBe(1)
  await portal.close()
})

// ---------------------------------------------------------------------------
// Recorrido 8 · los rechazos de respuestas por la API (y la descarga)
// ---------------------------------------------------------------------------

test('8 · rechazos de respuestas por la API, reportar y responder a la vez, y la descarga (AC-29, AC-34…AC-36, AC-38, AC-41)', async () => {
  const karla = c.karla!
  const r1 = resenaDeA(vaUno, karla, 4, A_TEXTO('Karla', 'sin responder'), 3)
  const r2 = resenaDeA(vaDos, karla, 5, A_TEXTO('Karla', 'que la empresa borra'), 2)
  const r3 = resenaDeA(vaTres, karla, 3, A_TEXTO('Karla', 'con respuesta ya fija'), 40)
  sembrarRespuesta(r3, karla.usuario, 'Karla responde: respuesta de hace un mes que ya no se cambia.', 31, -1)
  const suya = await tokenDelCandidato(karla.correo)
  const responder = (id: number, texto: string, token = suya, metodo = 'POST') =>
    pedir(`/portal/resenas/${id}/respuesta`, token, metodo, { texto })

  // AC-34: vacía, corta, larga.
  expect((await responder(r1, '    ')).estado).toBe(400)
  expect((await responder(r1, 'x'.repeat(29))).estado).toBe(400)
  expect((await responder(r1, 'x'.repeat(501))).estado).toBe(400)
  // AC-35: otra cuenta del portal y un usuario del panel.
  expect((await responder(r1, RESPUESTA, await tokenDelCandidato(c.bruno!.correo))).estado).toBe(404)
  expect([401, 403]).toContain((await responder(r1, RESPUESTA, await tokenDelEquipo())).estado)
  // AC-41: reportada y pendiente, se puede responder, y el reporte sigue pendiente.
  expect((await pedir(`/portal/resenas/${r1}/reporte`, suya, 'POST', { motivo: 'FALSA' })).estado).toBe(204)
  expect((await pedir(`/portal/resenas/${r1}/reporte`, suya, 'POST', { motivo: 'FALSA' })).estado).toBe(409)
  expect((await responder(r1, RESPUESTA)).estado).toBe(201)
  expect(sql(`select estado from reporte_resena where resena_id = ${r1};`)).toBe('PENDIENTE')
  // Segunda respuesta a la misma reseña.
  expect((await responder(r1, RESPUESTA)).estado).toBe(409)
  // AC-36: editar dentro del plazo sale «Editada»; borrarla deja responder de nuevo.
  expect((await responder(r1, `${RESPUESTA} Editada.`, suya, 'PUT')).estado).toBe(204)
  let mias = (await pedir('/portal/resenas', suya)).cuerpo
  expect(mias.resenas.find((r: { id: number }) => r.id === r1).respuesta.editada).toBe(true)
  expect((await pedir(`/portal/resenas/${r1}/respuesta`, suya, 'DELETE')).estado).toBe(204)
  expect((await responder(r1, RESPUESTA)).estado).toBe(201)
  // La de hace 31 días: ni editar ni borrar.
  expect((await responder(r3, `${RESPUESTA} Tarde.`, suya, 'PUT')).estado).toBe(409)
  expect((await pedir(`/portal/resenas/${r3}/respuesta`, suya, 'DELETE')).estado).toBe(409)
  // AC-38 y punto 26: la empresa la borra; responder a una reseña borrada → 404.
  expect(
    (await pedir(`/panel/postulaciones/${postulacionDe(vaDos, karla)}/resena`, await tokenDelEquipo(), 'DELETE')).estado,
  ).toBe(200)
  expect((await responder(r2, RESPUESTA)).estado).toBe(404)
  // AC-40: la empresa B no puede reportar la respuesta de una reseña de A.
  expect(
    (await pedir(`/panel/postulaciones/${postulacionDe(vaUno, karla)}/resena/respuesta/reporte`, tokenB, 'POST', {
      motivo: 'OTRO',
      comentario: 'x',
    })).estado,
  ).toBe(404)

  // AC-29: la descarga lleva sus reseñas visibles, sus respuestas y sus reportes con el resultado.
  const descarga = (await pedir('/portal/perfil/descarga', suya)).cuerpo
  const textos = JSON.stringify(descarga.misResenas)
  expect(textos).toContain('Karla: sin responder')
  expect(textos).toContain(RESPUESTA)
  expect(textos).toContain('respuesta de hace un mes')
  expect(textos).not.toContain('que la empresa borra')
  expect(descarga.misResenas.reportes).toEqual([expect.objectContaining({ motivo: 'FALSA', estado: 'PENDIENTE' })])
  mias = (await pedir('/portal/resenas', suya)).cuerpo
  expect(mias.resenas).toHaveLength(2)
})

// ---------------------------------------------------------------------------
// Recorrido 5 y permisos · quién puede escribir y leer
// ---------------------------------------------------------------------------

test('5 · permisos: el Responsable de la vacante la publica; empresa ajena, otro Responsable, sin permiso y sin estar contratado se rechazan (AC-01, AC-03…AC-05, AC-22, AC-27)', async ({
  page,
  browser,
}) => {
  const lucia = c.lucia!
  const respVac = sembrarEquipoDePanel('resp-vac', { codigo: 'RESPONSABLE_AREA' })
  const respOtra = sembrarEquipoDePanel('resp-otra', { codigo: 'RESPONSABLE_AREA' })
  const lector = sembrarEquipoDePanel('lector', { talentoSin: ['resenar_contratado'] })
  const ciego = sembrarEquipoDePanel('ciego', { talentoSin: ['resenar_contratado', 'ver_resenas_candidato'] })
  const plataforma = Number(sql('select id from organizacion where es_plataforma;'))
  const vacResp = sembrarVacanteDe(plataforma, respVac.usuario, 'Supervisor de planta')
  sembrarVacanteDe(plataforma, respOtra.usuario, 'Supervisor de turno')
  const contratada = sembrarContratacion(vacResp, lucia.usuario, 31)
  const abierta = sembrarPostulacion(vaUno, lucia.usuario, 'PERFIL_POR_CONFIRMAR')
  const opinion = { estrellas: 4, texto: A_TEXTO('Lucia', 'publicada por su Responsable') }

  // AC-04: la empresa B, 404 sin confirmar que existe; y otro Responsable, fuera de su alcance.
  expect((await pedir(`/panel/postulaciones/${contratada}/resena`, tokenB, 'POST', opinion)).estado).toBe(404)
  const otro = await pedir(`/panel/postulaciones/${contratada}/resena`, await tokenDePanel(respOtra.renaserOsId), 'POST', opinion)
  expect(otro.estado).toBe(404)
  expect(JSON.stringify(otro.cuerpo)).toContain('fuera de tu alcance')
  // AC-03: en un estado distinto de CONTRATADO.
  expect((await pedir(`/panel/postulaciones/${abierta}/resena`, await tokenDelEquipo(), 'POST', opinion)).estado).toBe(409)
  // AC-05: sin `resenar_contratado`: el rechazo, y el bloque de escribir no viaja.
  const tokenLector = await tokenDePanel(lector.renaserOsId)
  expect((await pedir(`/panel/postulaciones/${contratada}/resena`, tokenLector, 'POST', opinion)).estado).toBe(403)
  const vistaLector = (await pedir(`/panel/postulaciones/${contratada}/resenas`, tokenLector)).cuerpo
  expect(vistaLector.puedeResenar).toBe(false)
  expect(vistaLector.miResena ?? null).toBeNull()
  // AC-27: sin `ver_resenas_candidato`: ni la lectura ni el dato en el ranking.
  const tokenCiego = await tokenDePanel(ciego.renaserOsId)
  expect((await pedir(`/panel/postulaciones/${contratada}/resenas`, tokenCiego)).estado).toBe(403)
  const ranking = (await pedir(`/panel/vacantes/${vacResp}/ranking`, tokenCiego)).cuerpo
  expect(ranking.puedeVerResenas).toBe(false)
  expect(ranking.filas.every((f: Record<string, unknown>) => f.resenas == null)).toBe(true)
  // AC-22: ni la empresa B ni quien no tiene `moderar_resenas` ven la moderación.
  expect((await pedir('/panel/resenas-reportadas', tokenB)).estado).toBe(403)
  expect((await pedir('/panel/resenas-reportadas', tokenLector)).estado).toBe(403)

  // AC-01: el Responsable de ESA vacante ve el formulario y la publica desde la ficha.
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_panel_token',
    await tokenDePanel(respVac.renaserOsId),
  ])
  await abrirFicha(page, vacResp, lucia)
  const bloque = bloqueAutora(page)
  await expect(bloque.getByText('La verán la persona, que podrá responderla')).toBeVisible()
  await bloque.getByRole('radio', { name: '1 estrella, Muy mala' }).focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(bloque.getByRole('radio', { name: '4 estrellas, Buena' })).toBeChecked()
  await bloque.getByLabel('Opinión').fill(opinion.texto)
  await bloque.getByRole('button', { name: 'Publicar reseña' }).click()
  await expect(bloque.getByText(/Puedes cambiarla hasta el/)).toBeVisible()

  // El lector ve la reseña en la lectura, sin el bloque de escribir; el ciego, nada.
  const pLector = await paginaDelPanel(browser, tokenLector)
  await abrirFicha(pLector, vacResp, lucia)
  await expect(lectura(pLector)).toContainText('publicada por su Responsable')
  await expect(pLector.getByRole('region', { name: /^La reseña de/ })).toHaveCount(0)
  await pLector.close()
  const pCiego = await paginaDelPanel(browser, tokenCiego)
  await abrirVacante(pCiego, vacResp)
  await pCiego.locator('summary', { hasText: 'Columnas' }).click()
  await expect(pCiego.getByRole('checkbox', { name: /Reseñas de empresas/ })).toHaveCount(0)
  await pCiego.locator('summary', { hasText: 'Columnas' }).click()
  await pCiego.getByRole('button', { name: lucia.nombre, exact: true }).click()
  await expect(pCiego.locator(`#ficha-${contratada}`)).toBeVisible()
  await expect(pCiego.getByText('Cargando las reseñas…')).toHaveCount(0)
  await expect(lectura(pCiego)).toHaveCount(0)
  await expect(pCiego.getByRole('region', { name: /^La reseña de/ })).toHaveCount(0)
  await pCiego.close()

  // AC-22: la configuración de la empresa B no tiene la pantalla.
  const pB = await paginaDelPanel(browser, tokenB)
  await pB.goto('/admin/configuracion')
  await expect(pB.getByRole('heading', { level: 2 }).first()).toBeVisible()
  await expect(pB.getByRole('heading', { name: 'Reseñas reportadas' })).toHaveCount(0)
  await pB.close()
})

// ---------------------------------------------------------------------------
// Los errores de la ficha: otra persona publicó antes, y el plazo vence abierto
// ---------------------------------------------------------------------------

test('23-24 · otra persona de la empresa publicó antes, y el plazo vence con el formulario abierto (AC-07, AC-09)', async ({
  page,
}) => {
  const marta = c.marta!
  const contratada = sembrarContratacion(vaDos, marta.usuario, 40)
  await entrarAlPanel(page)
  await abrirFicha(page, vaDos, marta)
  const bloque = bloqueAutora(page)
  await expect(bloque.getByRole('button', { name: 'Publicar reseña' })).toBeVisible()
  // Mientras tanto, otra sesión de la misma empresa la publica.
  expect(
    (await pedir(`/panel/postulaciones/${contratada}/resena`, await tokenDelEquipo(), 'POST', {
      estrellas: 5,
      texto: A_TEXTO('Marta', 'la que publicó otra persona primero'),
    })).estado,
  ).toBe(201)
  await bloque.locator('label').filter({ hasText: '3 estrellas' }).click()
  await bloque.getByLabel('Opinión').fill(A_TEXTO('Marta', 'la segunda, que no debe entrar'))
  await bloque.getByRole('button', { name: 'Publicar reseña' }).click()
  await expect(bloque.getByRole('alert')).toContainText('ya tiene una reseña')
  await expect(bloque).toContainText('la que publicó otra persona primero')
  await expect(bloque.getByRole('button', { name: 'Editar', exact: true })).toBeVisible()

  // El plazo de edición vence con el formulario abierto: manda el reloj del servidor.
  await bloque.getByRole('button', { name: 'Editar', exact: true }).click()
  publicadaHace(resenaDe(contratada)!, 31)
  await bloque.getByLabel('Opinión').fill(A_TEXTO('Marta', 'edición que llega tarde'))
  await bloque.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(bloque.getByRole('alert')).toContainText('Ya no se puede cambiar')
  await expect(bloque.getByText('Ya no se puede cambiar.')).toBeVisible()
  await expect(bloque.getByRole('button', { name: /^(Editar|Borrar)$/ })).toHaveCount(0)
})

test('10 · borrarla dentro del plazo libera la contratación y se lleva la respuesta (AC-10, AC-38)', async ({
  page,
  browser,
}) => {
  const nora = c.nora!
  const contratada = sembrarContratacion(vaTres, nora.usuario, 40)
  const resena = sembrarResenaDe(contratada, nora.persona, 2, A_TEXTO('Nora', 'que la empresa borra'), 2, equipoA)
  sembrarRespuesta(resena, nora.usuario, 'Nora responde: no estoy de acuerdo con lo que dice esta reseña.', 1, 29)
  await entrarAlPanel(page)
  await abrirFicha(page, vaTres, nora)
  const bloque = bloqueAutora(page)
  await expect(bloque).toContainText('Nora responde')
  await bloque.getByRole('button', { name: 'Borrar', exact: true }).click()
  await bloque.getByRole('group', { name: 'Borrar la reseña' }).getByRole('button', { name: 'Borrar' }).click()
  await expect(bloque.getByRole('button', { name: 'Publicar reseña' })).toBeVisible()
  await expect(lectura(page)).toContainText('Sin reseñas de empresas')

  const portal = await paginaDelPortal(browser, nora)
  await portal.goto('/perfil')
  await expect(portal.locator('#resenas')).toContainText('Todavía no tienes reseñas')
  await expect(lineaDeCabecera(portal)).toHaveCount(0)
  await portal.close()

  // Se vuelve a reseñar, con un plazo nuevo.
  await bloque.locator('label').filter({ hasText: '4 estrellas' }).click()
  await bloque.getByLabel('Opinión').fill(A_TEXTO('Nora', 'la nueva después de borrar'))
  await bloque.getByRole('button', { name: 'Publicar reseña' }).click()
  await expect(bloque.getByText(/Puedes cambiarla hasta el/)).toBeVisible()
  await expect(bloque).not.toContainText('Nora responde')
})

// ---------------------------------------------------------------------------
// Regresiones de los hallazgos de la exploración
// ---------------------------------------------------------------------------

test('RES-QA-01 · la ventana «Ver todas» no se sale de su ancho con un nombre de empresa largo (escritorio)', async ({
  page,
}) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(c.valeria!.correo),
  ])
  await page.goto('/perfil')
  await page.locator('#resenas').getByRole('button', { name: 'Ver todas las reseñas (3)' }).click()
  const ventana = page.getByRole('dialog', { name: 'Reseñas de empresas' })
  await expect(ventana.getByLabel('Empresa')).toBeVisible()
  const medidas = await ventana.evaluate((d) => {
    const caja = d.getBoundingClientRect()
    const cuerpo = d.children[1] as HTMLElement
    const select = d.querySelector('select')!.getBoundingClientRect()
    return { derecha: caja.right, selectDerecha: select.right, desborde: cuerpo.scrollWidth - cuerpo.clientWidth }
  })
  expect(medidas.selectDerecha, 'el desplegable «Empresa» no cabe en la ventana').toBeLessThanOrEqual(medidas.derecha)
  expect(medidas.desborde, 'la ventana tiene scroll horizontal').toBeLessThanOrEqual(0)
})

test('RES-QA-02 · al volver de un paso o terminarlo, el foco no se pierde fuera de la ventana', async ({
  page,
  browser,
}) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(c.valeria!.correo),
  ])
  await page.goto('/perfil')
  await page.locator('#resenas').getByRole('button', { name: 'Ver todas las reseñas (3)' }).click()
  const ventana = page.getByRole('dialog')
  await tarjeta(ventana, 'la más reciente de A').getByRole('button', { name: 'Reportar' }).click()
  await expect(ventana.getByRole('heading', { name: `Reportar la reseña de ${empresaA}` })).toBeVisible()
  await ventana.getByRole('button', { name: 'Volver' }).click()
  await expect(ventana.getByRole('heading', { name: 'Reseñas de empresas' })).toBeVisible()
  const dentro = await page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]')))
  expect(dentro, 'tras «Volver», el foco quedó fuera de la ventana modal').toBe(true)

  // En el panel: al enviar «Reportar la respuesta», el foco no cae en <body>.
  const olga = c.olga!
  const resena = resenaDeA(vaDos, olga, 4, A_TEXTO('Olga', 'con respuesta para reportar'), 3)
  sembrarRespuesta(resena, olga.usuario, 'Olga responde: gracias, aprendí mucho en el almacén.', 2, 28)
  const panel = await browser.newPage()
  await entrarAlPanel(panel)
  await abrirFicha(panel, vaDos, olga)
  await bloqueAutora(panel).getByRole('button', { name: 'Reportar la respuesta' }).click()
  await panel.getByLabel('Tiene insultos o lenguaje ofensivo').check()
  await panel.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(bloqueAutora(panel).getByText('Reportada · en revisión')).toBeVisible()
  const foco = await panel.evaluate(() => document.activeElement?.tagName)
  await panel.close()
  expect(foco, 'tras enviar el reporte, el foco cayó en <body>').not.toBe('BODY')
})

test('RES-QA-03 · un doble clic en «Publicar respuesta» envía una sola respuesta', async ({ page }) => {
  const olga = c.olga!
  resenaDeA(vaTres, olga, 5, A_TEXTO('Olga', 'para el doble clic'), 2)
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(olga.correo),
  ])
  const envios: number[] = []
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && /\/portal\/resenas\/\d+\/respuesta$/.test(r.url())) envios.push(r.status())
  })
  await page.goto('/perfil')
  await tarjeta(page.locator('#resenas'), 'para el doble clic').getByRole('button', { name: 'Responder' }).click()
  await page.getByRole('dialog').getByLabel('Tu respuesta').fill(RESPUESTA)
  await page.getByRole('button', { name: 'Publicar respuesta' }).dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(1000)
  expect(envios, 'se enviaron dos POST de la misma respuesta').toEqual([201])
})

test('RES-QA-04 · el índice marca «Reseñas» al pulsarla aunque la sección sea corta', async ({ page }) => {
  // La ventana de la exploración: con 900 px de alto, «Enlaces» y la sección vacía
  // de reseñas caben a la vez en la banda que vigila el índice.
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), [
    'renaser_portal_token',
    await tokenDelCandidato(c.bruno!.correo),
  ])
  await page.goto('/perfil')
  const indice = page.getByRole('navigation', { name: 'Secciones de tu perfil' })
  await indice.getByRole('link', { name: /^Reseñas/ }).click()
  await expect(page).toHaveURL(/#resenas$/)
  await page.waitForTimeout(800)
  await expect(indice.locator('[aria-current]')).toHaveText(/^Reseñas/)
})
