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
 *   3. **Antes del botón se dice quién va a recibir la candidatura**, con enlace
 *      al texto que se acepta. Aquí había una casilla obligatoria y se retiró:
 *      enviar la postulación a una empresa que el candidato eligió, después de
 *      leer quién la recibe, ya es el acto afirmativo que pide la ley 29733.
 *   4. La postulación entra y sale en «Mis procesos» con su empresa.
 *
 * ⚠️ **ESCRIBE**: crea una cuenta `e2e.postular.<uuid>@example.com` y una
 * postulación. Va sobre la vacante `SIN_PRETENSION`, como el avance de etapa de
 * `09-avance`: la llena es el banco de pruebas de orden, filtros y Excel, y
 * `06-sin-ciudad` fabrica su caso sobre `OTRA`; una fila nueva en
 * cualquiera de las dos les mueve las cifras exactas. Al terminar intenta
 * borrar lo suyo; ver `borrarCuentasDePrueba` para por qué una restricción puede impedir la limpieza.
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
  /*
    La pretensión, si esta vacante la pide.

    Sale SOLO cuando la vacante publica lo que paga (V54), y el sembrador crea
    una de cada clase — así que este mismo recorrido pasa por las dos según a
    qué vacante apunte. Con el campo delante y sin rellenar, el envío se queda
    en la misma página y el fallo se lee como «postular está roto» cuando lo que
    pasa es que falta un dato obligatorio.

    Prellenado suele venir del perfil, pero estas cuentas nacen sin él: se
    escribe siempre, que además es lo que hace de verdad una persona.
  */
  const pretension = page.getByLabel(/Tu pretensión mensual/)
  if (await pretension.isVisible().catch(() => false)) {
    await pretension.fill('3500')
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

  test.afterAll(() => borrarCuentasDePrueba([CORREO]))

  test('el tablón dice de qué empresa es cada vacante', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: vacante.titulo }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(vacante.nombreEmpresa).first()).toBeVisible()
  })

  test('crear la cuenta desde la vacante vuelve al formulario de postular, y este dice a qué empresa vas', async ({
    page,
  }) => {
    await page.goto(`/registro?vacante=${vacante.id}`)
    await page.getByLabel(/^Nombre/).fill('Prueba')
    await page.getByLabel('Apellidos').fill('De Punta a Punta')
    await page.getByLabel('Correo').fill(CORREO)
    await page.getByLabel(/^Contraseña/).fill(CLAVE_DE_CANDIDATO)
    await page.getByLabel('Repite la contraseña').fill(CLAVE_DE_CANDIDATO)
    // El registro exige ciudad desde que la pide el alta (ver `02-regresion-portal`).
    await page.getByLabel('Ciudad').selectOption('1501') // Lima — Lima
    // El consentimiento de la plataforma, que es distinto del de la empresa.
    await page.locator('input[type=checkbox]').first().check()
    await page.getByRole('button', { name: /crear/i }).click()
    await expect(page).toHaveURL(/\/vacantes\/\d+\/postular/, { timeout: 20_000 })

    // Se espera al formulario: nada más cambiar de dirección la pantalla todavía
    // está en «Cargando el puesto…» y preguntar ahí no comprueba nada.
    await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })
    await expect(page.getByText(vacante.nombreEmpresa).first()).toBeVisible()
  })

  test('antes del botón se dice quién recibe la candidatura, con enlace al texto', async ({
    page,
  }) => {
    // Lo único que la casilla aportaba de verdad era el nombre de quien trata los
    // datos. Sin ella, esa frase es lo que sostiene que el consentimiento esté
    // informado, y el enlace tiene que llevar al texto de ESTA vacante, no al
    // general: una empresa puede publicar el suyo y entonces es el que se firma.
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacante.id}/postular`)

    const aviso = page.getByText(/Al enviar,/)
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText(vacante.nombreEmpresa)

    const enlace = page.getByRole('link', { name: /política de privacidad/i })
    await expect(enlace).toHaveAttribute(
      'href',
      `/politica-de-privacidad?vacante=${vacante.id}#el-texto-que-aceptas`,
    )
    // Y no queda ninguna casilla que marcar en esta pantalla.
    await expect(page.getByRole('checkbox')).toHaveCount(0)
  })

  test('la postulación entra y sale en «Mis procesos» con su empresa', async ({ page }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacante.id}/postular`)
    await rellenarElFormulario(page)
    await page.getByRole('button', { name: /enviar mi postulación/i }).click()

    // Si dijo que sí a todos los requisitos no sale el aviso; si saliera, se cierra.
    const aviso = page.getByRole('button', { name: /enviarla de todos modos/i })
    if (await aviso.isVisible().catch(() => false)) await aviso.click()

    await expect(page).toHaveURL(/\/procesos$/, { timeout: 25_000 })
    await expect(page.getByRole('heading', { name: vacante.titulo }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(vacante.nombreEmpresa).first()).toBeVisible()
  })
})
