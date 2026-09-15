import { expect } from '@playwright/test'
import { API, entrarAlPortal, idDeVacante, tokenDelPanel, VACANTES } from './ayuda'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  sql,
  test,
} from './ayuda-candidato'

/**
 * El trato del sueldo, mirado desde la pantalla del candidato.
 *
 * Lo que aquí se comprueba no lo puede contestar el backend solo: que la cifra se LEA
 * donde se busca, que una vacante que no la publica lo DIGA en vez de dejar un hueco, y
 * que el formulario de postular pida —o no pida— la pretensión según lo que la empresa
 * haya puesto sobre la mesa. Las tres son la mitad visible de la V54, y las tres se
 * rompen sin que ninguna prueba de servicio se entere.
 *
 * ⚠️ **ESCRIBE, y por partida doble.** Le cambia la remuneración a una vacante sembrada
 * y crea una cuenta. Lo primero es lo delicado: cambiar el sueldo de una vacante
 * publicada le deja aviso y correo a CADA candidato sembrado que siga en carrera, y esos
 * no llevan correo `@example.com`, así que `borrarCuentasDePrueba` no los alcanza. Por
 * eso `afterAll` los borra a mano y devuelve la vacante a OCULTA con la marca en vacío:
 * la base tiene que quedar como se encontró, o `18-ranking-contra-api` empieza a ver una
 * columna de pretensión que antes explicaba de otra forma.
 *
 * Va sobre `SIN_PRETENSION` y no sobre `LLENA` por lo mismo que `12-postular`: la llena
 * es el banco de pruebas de orden, filtros y Excel, y sus cifras exactas no se tocan.
 */
test.describe.configure({ mode: 'serial' })

const CORREO = correoDePrueba('e2e.remuneracion')

/** Lo que se le pone a la vacante para la prueba, y cómo el servidor lo escribe. */
const BANDA = { tipo: 'RANGO', min: 3000, max: 4000, moneda: 'PEN' }
const BANDA_ESCRITA = 'S/ 3 000 a 4 000'

let vacanteId: number

/** Le pone (o le quita) el sueldo a la vacante por el verbo propio de la V54. */
async function ponerRemuneracion(remuneracion: Record<string, unknown>, motivo: string) {
  const r = await fetch(`${API}/panel/vacantes/${vacanteId}/remuneracion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await tokenDelPanel()}`,
    },
    body: JSON.stringify({ remuneracion, motivo }),
  })
  if (!r.ok) throw new Error(`no se pudo cambiar la remuneración: ${r.status} ${await r.text()}`)
  return r.json()
}

test.describe('Regresión · el sueldo se ve y se pide', () => {
  test.beforeAll(async () => {
    vacanteId = await idDeVacante(VACANTES.SIN_PRETENSION)
    await crearCuentaDeCandidato({
      nombre: 'Remu',
      apellidos: 'De Prueba',
      correo: CORREO,
    })
    await ponerRemuneracion(BANDA, 'Prueba de punta a punta de la remuneración')
  })

  test.afterAll(async () => {
    // El orden importa: primero se devuelve la vacante a como estaba —eso genera un
    // segundo aviso— y solo después se barren TODOS los avisos y correos de esta vacante.
    try {
      await ponerRemuneracion({ tipo: 'OCULTA' }, 'Fin de la prueba de punta a punta')
      // ⚠️ `auditoria` NO se toca: es inmutable por trigger (`auditoria_inmutable`, V8) y el
      // `delete` revienta ahí, tumbando con ON_ERROR_STOP toda la limpieza que iba detrás.
      // Y está bien que se quede: que la empresa cambió el sueldo cuatro veces esta tarde es
      // exactamente lo que la auditoría existe para recordar.
      sql(`
begin;
delete from aviso_portal where vacante_id = ${vacanteId};
delete from correo_enviado where plantilla_correo_codigo = 'REMUNERACION_ACTUALIZADA';
update vacante set remuneracion_actualizada_en = null where id = ${vacanteId};
commit;`)
    } catch (causa) {
      console.warn(
        `[23-remuneracion] No se pudo devolver «${VACANTES.SIN_PRETENSION}» a su estado: ` +
          String(causa).split('\n')[0],
      )
    }
    try {
      borrarCuentasDePrueba('e2e.remuneracion')
    } catch (causa) {
      console.warn(`[23-remuneracion] No se pudo borrar ${CORREO}: ` + String(causa).split('\n')[0])
    }
  })

  test('la vacante enseña lo que paga arriba, escrito de una sola forma', async ({ page }) => {
    await page.goto(`/vacantes/${vacanteId}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

    // La frase la arma el servidor y la pantalla no la vuelve a escribir: si alguna vez
    // divergen, el correo del cambio dirá una cosa y el portal otra sobre el mismo sueldo.
    await expect(page.getByText(BANDA_ESCRITA)).toBeVisible()
    await expect(page.getByText('Remuneración').first()).toBeVisible()
    // Un rango dice que es un rango: «3 000 a 4 000» sin más se lee como una promesa de 4 000.
    await expect(page.getByText('según experiencia')).toBeVisible()
  })

  test('si la vacante la enseña, el formulario pide la propia y repite la de la empresa', async ({
    page,
  }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacanteId}/postular`)
    await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })

    await expect(page.getByRole('heading', { name: 'Cuánto quieres ganar' })).toBeVisible()
    // La cifra de la empresa se repite aquí: estaba en la pantalla anterior y ya no se ve,
    // y nadie decide cuánto pedir sin tenerla delante.
    await expect(page.getByText(BANDA_ESCRITA)).toBeVisible()
    await expect(page.getByLabel(/Tu pretensión mensual/)).toBeVisible()
    // Y se dice quién la va a leer, que es la pregunta que se hace cualquiera antes de
    // escribir una cifra.
    await expect(page.getByText(/Solo la ve quien decide el sueldo/)).toBeVisible()
  })

  test('sin cifra la pantalla lo para, y no llega ni una petición al servidor', async ({ page }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacanteId}/postular`)
    await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })

    await page.setInputFiles('input[type=file]', {
      name: 'curriculum.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 curriculum de prueba de la remuneracion'),
    })
    await page
      .locator('textarea')
      .first()
      .fill('Ordené el reporte semanal de ocupación: pasó de tres días de trabajo a salir cada lunes.')
    for (const grupo of await page.locator('fieldset').filter({ has: page.getByRole('radio') }).all()) {
      await grupo.getByText('Sí', { exact: true }).click()
    }
    // El campo se vacía a mano: el perfil puede haberlo prellenado con el centro de su banda.
    await page.getByLabel(/Tu pretensión mensual/).fill('')

    const peticiones: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/postulaciones') && r.method() === 'POST') peticiones.push(r.url())
    })

    await page.getByRole('button', { name: /enviar mi postulación/i }).click()

    // El candado es la pantalla, no el servidor: enterarse de que falta la cifra DESPUÉS
    // de subir el currículum es hacerle pagar el viaje entero por un campo vacío.
    await expect(page.getByLabel(/Tu pretensión mensual/)).toBeVisible()
    expect(peticiones).toHaveLength(0)
    await expect(page).toHaveURL(new RegExp(`/vacantes/${vacanteId}/postular`))
  })

  test('una vacante que no lo publica lo DICE, y entonces no pide la pretensión', async ({ page }) => {
    await ponerRemuneracion({ tipo: 'OCULTA' }, 'La empresa decide no publicar el sueldo')

    await page.goto(`/vacantes/${vacanteId}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
    // El hueco se lee como un fallo de carga. Y además es el dato que explica por qué el
    // formulario de postular no le va a exigir la suya.
    await expect(page.getByText('La empresa no publica el sueldo')).toBeVisible()
    await expect(page.getByText(BANDA_ESCRITA)).toHaveCount(0)

    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto(`/vacantes/${vacanteId}/postular`)
    await expect(page.locator('input[type=file]')).toBeAttached({ timeout: 15_000 })
    // El bloque del trato sale solo cuando hay trato.
    await expect(page.getByRole('heading', { name: 'Cuánto quieres ganar' })).toHaveCount(0)
    await expect(page.getByLabel(/Tu pretensión mensual/)).toHaveCount(0)

    // Se deja puesta otra vez para el afterAll, que es quien la devuelve a OCULTA y limpia.
    await ponerRemuneracion(BANDA, 'Se vuelve a publicar para cerrar la prueba')
  })
})
