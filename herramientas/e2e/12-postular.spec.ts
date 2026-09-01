import { expect, type Page } from '@playwright/test'
import { API, entrarAlPortal, VACANTES } from './ayuda'
import { borrarCuentasDePrueba, CLAVE_DE_CANDIDATO, correoDePrueba, test } from './ayuda-candidato'

/**
 * Postular de punta a punta, contra el backend de verdad.
 *
 * Recorre lo que la primera fase tenía que arreglar:
 *
 *   1. El tablón dice de qué empresa es cada vacante.
 *   2. La ficha también, y no como un metadato más.
 *   3. **Postular sin aceptar el tratamiento de datos se para en la pantalla**,
 *      no en el servidor. Es el candado: sin él, el backend responde 400 y el
 *      candidato se entera después de subir su currículum.
 *   4. Aceptando, la postulación entra y sale en «Mis procesos» con su empresa.
 *
 * ⚠️ **ESCRIBE**: crea una cuenta `e2e.postular.<instante>@example.com` y una
 * postulación. Va sobre la vacante `SIN_PRETENSION`, como el avance de etapa de
 * `09-avance`: la llena es el banco de pruebas de orden, filtros y Excel, y
 * `06-sin-ciudad` fabrica su caso sobre `OTRA` con ids fijos; una fila nueva en
 * cualquiera de las dos les mueve las cifras exactas. Al terminar intenta
 * borrar lo suyo; ver `borrarCuentasDePrueba` para por qué la postulación puede
 * quedarse.
 *
 * Los pasos van en serie: la cuenta que crea el segundo es con la que postulan
 * el tercero y el cuarto.
 */
test.describe.configure({ mode: 'serial' })

// Un correo distinto en cada corrida: la cuenta se crea de verdad y dos
// corridas seguidas chocarían con «ese correo ya existe».
const CORREO = correoDePrueba('e2e.postular')

interface VacantePublica {
  id: number
  titulo: string
  nombreEmpresa: string
}

let vacante: VacantePublica

/** Lo que hay que rellenar antes del candado: el currículum, el resultado y los requisitos. */
async function rellenarElFormulario(page: Page) {
  // Visualmente oculto a propósito —es el botón el que lo abre—, así que se
  // espera a que exista, no a que se vea.
  await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })
  await page.setInputFiles('input[type=file]', {
    name: 'curriculum.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 curriculum de prueba de punta a punta'),
  })
  await page
    .locator('textarea')
    .first()
    .fill('Ordené el reporte semanal de ocupación: pasó de tres días de trabajo a salir solo cada lunes.')
  // Los requisitos son preguntas de sí o no, una por `fieldset`. Se pulsa la
  // etiqueta y no el `<input>`: el radio va oculto debajo de ella, que es lo
  // que la persona ve y toca.
  for (const grupo of await page.locator('fieldset').filter({ has: page.getByRole('radio') }).all()) {
    await grupo.getByText('Sí', { exact: true }).click()
    await expect(grupo.getByRole('radio', { name: 'Sí' })).toBeChecked()
  }
}

test.describe('Regresión · postular de punta a punta', () => {
  test.beforeAll(async () => {
    // Por TÍTULO y no por id: los ids cambian con cada siembra.
    const publicadas = (await (await fetch(`${API}/portal/vacantes`)).json()) as VacantePublica[]
    const elegida = publicadas.find((v) => v.titulo === VACANTES.SIN_PRETENSION)
    if (!elegida) {
      throw new Error(
        `No hay ninguna vacante publicada titulada «${VACANTES.SIN_PRETENSION}». ¿Se sembró la base? ` +
          `Las que hay: ${publicadas.map((v) => v.titulo).join(', ') || '(ninguna)'}`,
      )
    }
    vacante = elegida
  })

  test.afterAll(() => {
    try {
      borrarCuentasDePrueba('e2e.postular')
    } catch (causa) {
      console.warn(
        `[12-postular] No se pudo borrar la cuenta ${CORREO} ni su postulación a «${vacante?.titulo}»: ` +
          String(causa).split('\n')[0],
      )
    }
  })

  test('el tablón dice de qué empresa es cada vacante', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: vacante.titulo }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(vacante.nombreEmpresa).first()).toBeVisible()
  })

  test('crear la cuenta desde la vacante vuelve al formulario de postular, y este dice a qué empresa vas', async ({
    page,
  }) => {
    await page.goto(`/registro?vacante=${vacante.id}`)
    await page.getByLabel('Nombre', { exact: true }).fill('Prueba')
    await page.getByLabel('Apellidos').fill('De Punta a Punta')
    await page.getByLabel('Correo').fill(CORREO)
    await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE_DE_CANDIDATO)
    await page.getByLabel('Repite la contraseña').fill(CLAVE_DE_CANDIDATO)
    // El registro exige ciudad desde que la pide el alta (ver `02-regresion-portal`).
    await page.getByLabel('Dónde vives').selectOption('1501') // Lima — Lima
    // El consentimiento de la plataforma, que es distinto del de la empresa.
    await page.locator('input[type=checkbox]').first().check()
    await page.getByRole('button', { name: /crear/i }).click()
    await expect(page).toHaveURL(/\/vacantes\/\d+\/postular/, { timeout: 20_000 })

    // Se espera al formulario: nada más cambiar de dirección la pantalla todavía
    // está en «Cargando el puesto…» y preguntar ahí no comprueba nada.
    await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })
    await expect(page.getByText(vacante.nombreEmpresa).first()).toBeVisible()
  })

  test('sin aceptar el tratamiento, la pantalla lo para, explica por qué, y no llega ni una petición al servidor', async ({
    page,
  }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacante.id}/postular`)
    await rellenarElFormulario(page)

    const peticiones: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/postulaciones') && r.method() === 'POST') peticiones.push(r.url())
    })

    await page.getByRole('button', { name: /enviar mi postulación/i }).click()
    await expect(page.getByText(/sin este permiso/i)).toBeVisible()
    await expect(page).toHaveURL(/\/postular$/)
    expect(peticiones, 'el candado tiene que pararlo antes de salir').toEqual([])
  })

  test('aceptando, la postulación entra y sale en «Mis procesos» con su empresa', async ({ page }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacante.id}/postular`)
    await rellenarElFormulario(page)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /enviar mi postulación/i }).click()

    // Si dijo que sí a todos los requisitos no sale el aviso; si saliera, se cierra.
    const aviso = page.getByRole('button', { name: /enviarla de todos modos/i })
    if (await aviso.isVisible().catch(() => false)) await aviso.click()

    await expect(page).toHaveURL(/\/procesos$/, { timeout: 25_000 })
    await expect(page.getByRole('heading', { name: vacante.titulo }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(vacante.nombreEmpresa).first()).toBeVisible()
  })
})
