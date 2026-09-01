import { expect } from '@playwright/test'
import { API, entrarAlPortal } from './ayuda'
import {
  borrarCuentasDePrueba,
  CLAVE_DE_CANDIDATO,
  correoDePrueba,
  crearCuentaDeCandidato,
  guardar,
  test,
  tokenDelCandidato,
} from './ayuda-candidato'

/**
 * «Mi perfil» de punta a punta, contra el backend de verdad.
 *
 * Recorre las cinco listas con sus operaciones reales —que **no son las mismas
 * en las cinco**— y la trampa que más importa:
 *
 *   ⚠️ **La cabecera es un PUT que reemplaza los siete campos.** Aquí se
 *   comprueba de la única forma que vale: se llena entera, se guarda, se cambia
 *   UN solo campo, se vuelve a guardar, y se pide el perfil al servidor. Si
 *   volvió con los otros seis vacíos, el guardado los borró.
 *
 * ⚠️ **ESCRIBE**: crea una cuenta `e2e.perfil.<instante>@example.com`, llena su
 * perfil, y la borra al terminar. La cuenta se crea por la API: lo que se
 * prueba aquí es el perfil, no el alta.
 *
 * Los pasos van en serie a propósito: cada uno cuenta con lo que dejó el
 * anterior (la cabecera llena, las dos experiencias que se reordenan…), y
 * partirlos en pruebas independientes obligaría a rellenar el perfil entero
 * antes de cada una.
 */
test.describe.configure({ mode: 'serial' })

const CORREO = correoDePrueba('e2e.perfil')

interface Perfil {
  titular: string | null
  resumen: string | null
  habilidades: string[]
  experienciaMeses: number | null
  ubicacion: string | null
  disponibilidad: string | null
  pretension: { min: number; max: number; moneda: string } | null
  experiencia: { id: number; puesto: string; empresa: string; origen: string; confirmado: boolean }[]
  educacion: { nivelCodigo: string }[]
  enlaces: { id: number }[]
}

let token = ''
/** El perfil como lo tiene el servidor, que es lo único que cuenta. */
const pedirPerfil = async (): Promise<Perfil> =>
  (await fetch(`${API}/portal/perfil`, { headers: { Authorization: `Bearer ${token}` } })).json()

test.describe('Regresión · «Mi perfil», lista por lista', () => {
  test.beforeAll(async () => {
    await crearCuentaDeCandidato({ nombre: 'Prueba', apellidos: 'Del Perfil', correo: CORREO })
    token = await tokenDelCandidato(CORREO)
  })

  test.afterAll(() => {
    try {
      borrarCuentasDePrueba('e2e.perfil')
    } catch (causa) {
      console.warn(`[11-perfil] No se pudo borrar la cuenta ${CORREO}: ${String(causa).split('\n')[0]}`)
    }
  })

  test.beforeEach(async ({ page }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { name: 'Tu perfil.' })).toBeVisible({ timeout: 20_000 })
  })

  test('un perfil recién creado se abre sin romperse y ofrece empezar', async ({ page }) => {
    // `GET /perfil` sin perfil responde 200 con todo vacío, no 404.
    await expect(page.getByRole('button', { name: 'Escribir quién eres' })).toBeVisible()
  })

  test('la cabecera se guarda entera', async ({ page }) => {
    await page.getByRole('button', { name: 'Escribir quién eres' }).click()
    await page.getByLabel('Titular').fill('Analista de procesos')
    await page.getByLabel('En pocas palabras').fill('Ocho años ordenando operaciones.')
    await page.getByLabel('Lo que sabes hacer').fill('Excel avanzado, Power BI, SQL')
    await page.getByLabel('Experiencia, en meses').fill('96')
    await page.getByLabel('Dónde estás').fill('Arequipa, Perú')
    await page.getByLabel('Desde cuándo puedes empezar').fill('Inmediata')
    await page.getByLabel('Desde', { exact: true }).fill('3500')
    await page.getByLabel('Hasta', { exact: true }).fill('4200')
    await guardar(page)

    const perfil = await pedirPerfil()
    expect(perfil.titular).toBe('Analista de procesos')
    expect(perfil.experienciaMeses).toBe(96)
    expect(perfil.habilidades).toHaveLength(3)
    expect(perfil.pretension).not.toBeNull()
  })

  test('LA TRAMPA: cambiar solo el titular no borra los otros seis campos', async ({ page }) => {
    await page.getByRole('button', { name: 'Editar quién eres' }).click()
    await page.getByLabel('Titular').fill('Jefa de operaciones')
    await guardar(page)

    const perfil = await pedirPerfil()
    expect(perfil.titular).toBe('Jefa de operaciones')
    expect(perfil.resumen).toBe('Ocho años ordenando operaciones.')
    expect(perfil.habilidades).toHaveLength(3)
    expect(perfil.experienciaMeses).toBe(96)
    expect(perfil.ubicacion).toBe('Arequipa, Perú')
    expect(perfil.disponibilidad).toBe('Inmediata')
    expect(perfil.pretension?.min).toBe(3500)
  })

  test('la pretensión es todo o nada: un solo número se para en la pantalla', async ({ page }) => {
    await page.getByRole('button', { name: 'Editar quién eres' }).click()
    await page.getByLabel('Hasta', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(/pon también el máximo/i)).toBeVisible()

    // Se deja como estaba para lo que viene.
    await page.getByLabel('Hasta', { exact: true }).fill('4200')
    await guardar(page)
    expect((await pedirPerfil()).pretension?.max).toBe(4200)
  })

  test('dos experiencias se crean, y nacen como de la persona y confirmadas', async ({ page }) => {
    for (const [puesto, empresa, desde] of [
      ['Analista senior', 'Clínica San Juan', '2022-03-01'],
      ['Asistente de operaciones', 'Transportes del Sur', '2019-01-01'],
    ] as const) {
      await page.getByRole('button', { name: 'Añadir experiencia' }).click()
      await page.getByLabel('Puesto').fill(puesto)
      await page.getByLabel('Empresa').fill(empresa)
      await page.getByLabel('Desde', { exact: true }).fill(desde)
      await guardar(page)
    }

    const { experiencia } = await pedirPerfil()
    expect(experiencia).toHaveLength(2)
    // Lo que escribe la persona no es un dato del currículum por validar.
    expect(experiencia.every((e) => e.origen === 'PERSONA' && e.confirmado)).toBe(true)
  })

  test('las flechas reordenan de verdad', async ({ page }) => {
    const antes = (await pedirPerfil()).experiencia
    expect(antes).toHaveLength(2)
    const [primera, segunda] = antes
    if (!primera || !segunda) throw new Error('El perfil no tiene las dos experiencias que creó el test anterior')

    // El botón nombra la fila entera —puesto y empresa— para distinguirla de
    // otra con el mismo cargo.
    await page.getByRole('button', { name: `Bajar ${primera.puesto} en ${primera.empresa}` }).click()

    await expect
      .poll(async () => (await pedirPerfil()).experiencia.map((e) => e.id))
      .toEqual([segunda.id, primera.id])
  })

  test('los estudios se guardan con el nivel del catálogo', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir estudios' }).click()
    await page.getByLabel('Qué estudiaste').fill('Ingeniería Industrial')
    await page.getByLabel('Dónde', { exact: true }).fill('UNSA')
    await page.locator('#nivel-educativo').selectOption('TITULADO')
    await guardar(page)

    const { educacion } = await pedirPerfil()
    expect(educacion).toHaveLength(1)
    expect(educacion[0]?.nivelCodigo).toBe('TITULADO')
  })

  test('al elegir el nivel de un idioma se explica qué significa, ahí mismo', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir idioma' }).click()
    await page.getByLabel('Idioma', { exact: true }).fill('Inglés')
    await page.locator('#nivel-idioma').selectOption('B2')
    await expect(page.getByText(/me manejo en una reunión de trabajo/i)).toBeVisible()
    await guardar(page)
  })

  test('una certificación caducada se avisa en la pantalla', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir certificación' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Soporte Vital Básico (BLS)')
    await page.getByLabel('Quién la emitió').fill('American Heart Association')
    await page.getByLabel('Emitida en').fill('2022-05-01')
    await page.getByLabel('Vence en').fill('2024-05-01')
    await guardar(page)

    await expect(page.getByText('Vencida', { exact: true })).toBeVisible()
  })

  test('un enlace se guarda, y no ofrece editar ni confirmar, que es lo que existe', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir enlace' }).click()
    await page.locator('#tipo-enlace').selectOption('LINKEDIN')
    await page.getByLabel('Dirección').fill('https://linkedin.com/in/prueba-e2e')
    await guardar(page)

    expect((await pedirPerfil()).enlaces).toHaveLength(1)
    // Los enlaces no llevan editar ni confirmar: el backend no los tiene.
    await expect(page.getByRole('button', { name: /^Editar el enlace/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Confirmar el enlace/ })).toHaveCount(0)
  })

  test('el enlace se quita', async ({ page }) => {
    await page.getByRole('button', { name: /^Quitar el enlace de LinkedIn/ }).click()
    await expect.poll(async () => (await pedirPerfil()).enlaces.length).toBe(0)
  })
})
