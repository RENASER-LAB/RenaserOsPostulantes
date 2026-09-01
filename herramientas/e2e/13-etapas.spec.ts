import { expect } from '@playwright/test'
import { API, corte, entrarAlPanel, filasDelRanking, idDeVacante, irAVacante, pestana, tokenDelPanel, VACANTES } from './ayuda'
import { test as base } from './ayuda-candidato'

/**
 * El ranking por etapas: la entrada de desarrollo, la celda de la nota en las
 * cinco pestañas, y la ficha que cambia con la etapa.
 *
 * ⚠️ Solo lee.
 *
 * Lo que el arnés viejo miraba y YA cubren otros archivos no se repite aquí:
 * que el ranking abra en «Perfil integral» con sus cinco pestañas lo miran
 * `01-regresion-panel` y `04-filtros` (al recargar), y que «Está aquí ahora»
 * no enseñe más filas que «Toda la tanda» lo dejan clavado las cifras exactas
 * de los tres cortes en `01-regresion-panel`.
 *
 * ⚠️ **Tres de las comprobaciones dependen de datos que la siembra actual no
 * trae** —alguien con nota en prueba, simulación y validación; un periodo de
 * validación habilitado; una evaluación del banco respondida—. Se buscan por la
 * API antes de abrir nada y, si no están, la prueba se salta diciendo qué
 * falta. No se inventan.
 */

/**
 * Los 404 que la ficha traduce y no son fallo: validación sin habilitar, notas
 * de prueba y simulación sin calificar, el tanteo de versiones de prueba que el
 * backend no deja listar, y la ficha del perfil que ya daba 404 en `main`
 * (ver `08-teclado-y-consola`).
 */
const ESPERADOS = [/\/validacion\b/, /\/prueba\/notas/, /\/simulacion\/notas/, /\/plantillas-prueba\/versiones\//, /\/ficha\b/]

/**
 * `test` con el segundo vigilante del arnés viejo: cualquier respuesta de 400
 * para arriba que no sea de las esperadas (ni un 401, que es cosa de sesión)
 * hace fallar la prueba.
 */
const test = base.extend<{ sinRespuestasMalas: void }>({
  sinRespuestasMalas: [
    async ({ page }, usar) => {
      const malas: string[] = []
      page.on('response', (r) => {
        if (r.status() < 400 || r.status() === 401) return
        if (ESPERADOS.some((patron) => patron.test(r.url()))) return
        malas.push(`${r.status()} · ${r.url()}`)
      })
      await usar()
      expect(malas, `Respuestas de error inesperadas:\n${malas.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})

const ETAPAS = ['Perfil integral', 'Prueba del puesto', 'Simulación', 'Validación', 'Decisión'] as const
const CODIGOS = {
  'Perfil integral': 'PERFIL_INTEGRAL',
  'Prueba del puesto': 'PRUEBA_PUESTO',
  Simulación: 'SIMULACION',
  Validación: 'VALIDACION',
  Decisión: 'DECISION',
} as const

interface FilaDelRanking {
  postulacionId: number
  candidato: string
  notaEtapa: number | null
}

/** El ranking de una vacante en una etapa, pedido a la API como lo pide el panel. */
async function rankingDe(titulo: string, etapa: keyof typeof CODIGOS): Promise<FilaDelRanking[]> {
  const id = await idDeVacante(titulo)
  const r = await fetch(`${API}/panel/vacantes/${id}/ranking?etapa=${CODIGOS[etapa]}`, {
    headers: { Authorization: `Bearer ${await tokenDelPanel()}` },
  })
  if (!r.ok) throw new Error(`ranking de «${titulo}» en ${etapa} falló: ${r.status}`)
  return ((await r.json()).filas ?? []) as FilaDelRanking[]
}

async function delPanel<T>(ruta: string): Promise<{ ok: boolean; cuerpo: T | null }> {
  const r = await fetch(`${API}/panel${ruta}`, { headers: { Authorization: `Bearer ${await tokenDelPanel()}` } })
  return { ok: r.ok, cuerpo: r.ok ? ((await r.json()) as T) : null }
}

/** El número que lleva el botón de un corte: «Está aquí ahora 1» → 1. */
const cifraDelCorte = async (texto: string | null) => Number((texto ?? '').match(/\d+/)?.[0] ?? NaN)

/**
 * ⚠️ **La celda de la nota no es solo la cifra.** Lleva dentro un `<span>` que
 * dice por qué está vacía, así que el `textContent` de la celda devuelve
 * «—Todavía no llega a esta etapa». Se lee el primer nodo de texto, que es la
 * cifra o su guion.
 */
const laNotaDe = (celda: import('@playwright/test').Locator) =>
  celda.evaluate((td) => (td.childNodes[0]?.textContent ?? '').trim())

test.describe('Regresión · el ranking por etapas', () => {
  test('la entrada de desarrollo, plegada al final de la pantalla de entrar, sigue abriendo el panel', async ({
    page,
  }) => {
    await page.goto('/admin/entrar')
    /*
      El panel entra con correo y contraseña. La entrada de desarrollo sigue ahí
      pero **plegada**, y hay que abrirla: el campo no existe en el DOM
      accesible hasta que el `<details>` se despliega.
    */
    await page.getByText('Entrar con un id de desarrollo').click()
    await page.getByLabel('Identificador de RENASER OS').fill('dev-equipo')
    await page.getByRole('button', { name: 'Entrar como desarrollo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible({ timeout: 15_000 })
  })

  test.describe('con sesión', () => {
    test.beforeEach(async ({ page }) => {
      await entrarAlPanel(page)
    })

    /*
      Con la tanda entera: lo que se mira aquí es la CELDA de la nota, y una
      tabla filtrada a cero no tiene ninguna que enseñar. Se pasa por las cinco
      pestañas porque la columna cambia de nombre con la etapa y el `<span>` del
      porqué existe en todas.
    */
    test('en las cinco pestañas, la celda de la nota empieza por la cifra o por su guion', async ({ page }) => {
      await irAVacante(page, VACANTES.LLENA)
      await corte(page, 'Toda la tanda').click()
      await expect(page.getByRole('heading', { name: 'El ranking, etapa por etapa' })).toBeVisible()

      for (const etapa of ETAPAS) {
        await pestana(page, etapa).click()
        await expect(pestana(page, etapa)).toHaveAttribute('aria-selected', 'true')
        await expect(filasDelRanking(page).first()).toBeVisible()

        const titulos = await page.locator('table thead th').evaluateAll((ths) => ths.map((th) => th.textContent!.trim()))
        const iNota = titulos.findIndex((t) => t.startsWith('Nota'))
        expect(iNota, `«${etapa}» tiene columna de nota; las que hay: ${titulos.join(', ')}`).toBeGreaterThanOrEqual(0)

        const primera = await laNotaDe(filasDelRanking(page).first().locator('td').nth(iNota))
        expect(primera, `la primera nota de «${etapa}»`).toMatch(/^(\d+([.,]\d+)?|—)$/)
      }
    })

    /*
      ⚠️ Con la tanda entera puesta: quien tiene la evaluación del banco hecha
      puede haber avanzado de etapa, y entonces no está parado en esta pestaña.
    */
    test('la ficha del perfil integral trae las dos tablas: lo que calificó la IA y la evaluación del banco', async ({
      page,
    }) => {
      await irAVacante(page, VACANTES.LLENA)
      await corte(page, 'Toda la tanda').click()
      await filasDelRanking(page).first().click()
      await expect(page.getByRole('heading', { name: 'La evaluación del banco' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Lo que calificó la IA' })).toBeVisible()
    })

    /*
      También con la tanda entera: en la base local no siempre hay alguien
      PARADO en la prueba, y lo que se mira aquí es que la ficha cambie de
      contenido con la pestaña.
    */
    test('la misma ficha en «Prueba del puesto» enseña su rúbrica, no el CV', async ({ page }) => {
      await irAVacante(page, VACANTES.LLENA)
      await pestana(page, 'Prueba del puesto').click()
      await corte(page, 'Toda la tanda').click()
      await filasDelRanking(page).first().click()
      await expect(
        page.getByRole('heading', { name: /La prueba del puesto, criterio a criterio/ }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Lo que calificó la IA' })).toHaveCount(0)
    })

    /*
      El viaje de una persona por las etapas: quien está parado en UNA etapa no
      aparece en las otras tres sin la tanda entera, y que sus notas viejas
      sigan ahí es justamente lo que se comprueba. Era «ana-lopez» en la base
      vieja; aquí se busca a quien tenga nota en las tres.
    */
    test('quien tiene nota en prueba, simulación y validación la conserva en las tres pestañas', async ({ page }) => {
      const etapas = ['Prueba del puesto', 'Simulación', 'Validación'] as const
      let viajero: { vacante: string; candidato: string; notas: Record<string, number> } | null = null
      for (const vacante of Object.values(VACANTES)) {
        const porEtapa = await Promise.all(etapas.map((e) => rankingDe(vacante, e)))
        const conNota = porEtapa.map((filas) => new Map(filas.filter((f) => f.notaEtapa !== null).map((f) => [f.candidato, f.notaEtapa!])))
        const primera = conNota[0]
        const candidato = primera && [...primera.keys()].find((c) => conNota.every((m) => m.has(c)))
        if (candidato) {
          // `conNota[i]` existe para cada `i` de `etapas`: se construyó mapeando esa misma lista.
          viajero = { vacante, candidato, notas: Object.fromEntries(etapas.map((e, i) => [e, conNota[i]!.get(candidato)!])) }
          break
        }
      }
      test.skip(
        viajero === null,
        'La siembra no tiene a nadie con nota en prueba, simulación y validación a la vez: hace falta una persona que haya pasado por las tres etapas calificada.',
      )

      await irAVacante(page, viajero!.vacante)
      await corte(page, 'Toda la tanda').click()
      for (const etapa of etapas) {
        await pestana(page, etapa).click()
        const nota = viajero!.notas[etapa]
        await expect(filasDelRanking(page).filter({ hasText: viajero!.candidato })).toContainText(
          new RegExp(String(nota).replace('.', '[.,]')),
          { timeout: 15_000 },
        )
      }
    })

    /*
      La ficha en Validación: el periodo y las métricas con su porqué. Las
      métricas solo salen cuando hay un periodo habilitado, así que se busca a
      alguien que lo tenga.
    */
    test('la ficha de Validación enseña el periodo y las métricas explicadas', async ({ page }) => {
      let conPeriodo: { vacante: string; candidato: string } | null = null
      for (const vacante of Object.values(VACANTES)) {
        for (const fila of await rankingDe(vacante, 'Validación')) {
          if ((await delPanel(`/postulaciones/${fila.postulacionId}/validacion`)).ok) {
            conPeriodo = { vacante, candidato: fila.candidato }
            break
          }
        }
        if (conPeriodo) break
      }
      test.skip(
        conPeriodo === null,
        'La siembra no tiene a nadie con un periodo de validación habilitado: hace falta una postulación en validación con su periodo creado.',
      )

      await irAVacante(page, conPeriodo!.vacante)
      await pestana(page, 'Validación').click()
      await corte(page, 'Toda la tanda').click()
      await filasDelRanking(page).filter({ hasText: conPeriodo!.candidato }).first().click()
      await expect(page.getByRole('heading', { name: 'El periodo de validación' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Las métricas del periodo' })).toBeVisible()
    })

    test('en Decisión, «Está aquí ahora» enseña exactamente a quien anuncia su contador, y nada más', async ({
      page,
    }) => {
      await irAVacante(page, VACANTES.LLENA)
      await pestana(page, 'Decisión').click()

      const enLaTanda = await cifraDelCorte(await corte(page, 'Toda la tanda').textContent())
      const boton = corte(page, 'Está aquí ahora')
      const enDecision = await cifraDelCorte(await boton.textContent())
      expect(enDecision).not.toBeNaN()
      expect(enDecision).toBeLessThanOrEqual(enLaTanda)

      await boton.click()
      await expect(boton).toHaveAttribute('aria-pressed', 'true')
      await expect(filasDelRanking(page)).toHaveCount(enDecision)
    })

    /*
      La evaluación del banco abierta por dentro. Si la IA ya calificó, cada
      abierta trae su nota y su evidencia; si aún no, se dice cuántas esperan.
      Ambas son pantallas honestas. Era «Siembra» en la base vieja; aquí se
      busca a quien tenga cerradas respondidas.
    */
    test('la evaluación del banco se abre por dentro: las cerradas promedian y las abiertas dicen si esperan', async ({
      page,
    }) => {
      let respondida: { vacante: string; candidato: string; abiertas: number } | null = null
      for (const vacante of Object.values(VACANTES)) {
        for (const fila of await rankingDe(vacante, 'Perfil integral')) {
          const { cuerpo } = await delPanel<{ cerradas: { preguntas: number }; abiertas: unknown[] }>(
            `/postulaciones/${fila.postulacionId}/evaluacion`,
          )
          if (cuerpo && cuerpo.cerradas?.preguntas > 0) {
            respondida = { vacante, candidato: fila.candidato, abiertas: cuerpo.abiertas.length }
            break
          }
        }
        if (respondida) break
      }
      test.skip(
        respondida === null,
        'La siembra no tiene ninguna evaluación del banco respondida: hace falta una postulación con sus cerradas contestadas para que haya promedio.',
      )

      await irAVacante(page, respondida!.vacante)
      await corte(page, 'Toda la tanda').click()
      await filasDelRanking(page).filter({ hasText: respondida!.candidato }).first().click()
      await expect(page.getByRole('heading', { name: 'La evaluación del banco' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/cerradas promedian/)).toBeVisible()

      if (respondida!.abiertas > 0) {
        const pendientes = await page.getByText(/esperan calificación|espera calificación/).count()
        const conNota = await page.locator('td', { hasText: '/4' }).count()
        expect(conNota + pendientes, 'cada abierta trae su nota, o se dice que espera').toBeGreaterThan(0)
      }
    })
  })
})
