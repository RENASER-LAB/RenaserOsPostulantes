import { expect, type Page } from '@playwright/test'
import { API, entrarAlPortal, VACANTES } from './ayuda'
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
 * Lo que el perfil ganó el 05/09/2026: foto, portada, currículum propio y
 * diplomas — y lo que eso cambia al postular.
 *
 * ⚠️ **La afirmación que sostiene toda la rama y que solo se puede comprobar
 * aquí:** subir un currículum distinto para una vacante **no toca el del
 * perfil**. En la pantalla las dos cosas se ven igual de bien; la diferencia
 * está en el servidor, así que se pregunta por API antes y después.
 *
 * ⚠️ **ESCRIBE**: crea `e2e.archivos.<instante>@example.com`, le sube archivos y
 * postula a dos vacantes. Al terminar borra lo suyo.
 *
 * En serie a propósito: cada paso cuenta con lo que dejó el anterior —la foto
 * que se quita, el currículum con el que se postula sin adjuntar nada—.
 */
test.describe.configure({ mode: 'serial' })

const CORREO = correoDePrueba('e2e.archivos')
const CERTIFICADO = 'Seguridad y salud en el trabajo'

/** Un PNG de 1×1 de verdad: el backend valida extensión y tipo declarado. */
const PNG_MINIMO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const UN_CV = (texto: string) => ({
  name: 'curriculum.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4 ${texto}`),
})

interface PerfilVisto {
  tieneFoto: boolean
  portada: { tipo: string; codigo: string | null }
  cv: { nombre: string; tamano: number } | null
  lecturaCv: { estado: string }
  certificaciones: { id: number; nombre: string; tieneArchivo: boolean }[]
}

let token = ''
const pedirPerfil = async (): Promise<PerfilVisto> =>
  (await fetch(`${API}/portal/perfil`, { headers: { Authorization: `Bearer ${token}` } })).json()

test.describe('Regresión · el perfil guarda tu foto, tu portada y tu currículum', () => {
  test.beforeAll(async () => {
    await crearCuentaDeCandidato({ nombre: 'Prueba', apellidos: 'De Archivos', correo: CORREO })
    token = await tokenDelCandidato(CORREO)
  })

  test.afterAll(() => {
    try {
      borrarCuentasDePrueba('e2e.archivos')
    } catch (causa) {
      console.warn(`[22-perfil] No se pudo borrar ${CORREO}: ${String(causa).split('\n')[0]}`)
    }
  })

  test.beforeEach(async ({ page }) => {
    await entrarAlPortal(page, CORREO, CLAVE_DE_CANDIDATO)
    await page.goto('/perfil')
    // ⚠️ El `h1` es el NOMBRE del candidato desde el rediseño del 05/09/2026: la
    // cabecera de identidad sustituyó al título «Tu perfil.». Esperar por él
    // comprueba de paso que el nombre viaja en la sesión, que era el otro
    // arreglo — antes venía de `localStorage` y quien entraba desde otro
    // navegador se quedaba sin él.
    await expect(page.getByRole('heading', { level: 1, name: 'Prueba De Archivos' }))
      .toBeVisible({ timeout: 20_000 })
  })

  test('sin foto no queda un hueco: salen sus iniciales', async ({ page }) => {
    // El disco de iniciales es la respuesta a «no tengo foto», no un vacío.
    await expect(page.getByText('PD', { exact: true })).toBeVisible()
    expect((await pedirPerfil()).tieneFoto).toBe(false)
  })

  test('la foto se sube, se ve y se quita', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir una foto de perfil' }).click()
    await page.setInputFiles('input[aria-label="Tu foto de perfil"]', {
      name: 'yo.png',
      mimeType: 'image/png',
      buffer: PNG_MINIMO,
    })

    await expect.poll(async () => (await pedirPerfil()).tieneFoto, { timeout: 15_000 }).toBe(true)
    // Y se pinta: el `img` sale del blob que devuelve `GET /perfil/foto`.
    await expect(page.getByRole('img', { name: /tu foto/i })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Cambiar tu foto de perfil' }).click()
    await page.getByRole('button', { name: 'Quitar la foto' }).click()
    await expect.poll(async () => (await pedirPerfil()).tieneFoto, { timeout: 15_000 }).toBe(false)
  })

  test('la foto sigue viéndose al ir a otra pantalla del portal y volver', async ({ page }) => {
    // ⚠️ **Solo se ve yendo y viniendo POR DENTRO del portal.** La foto se baja
    // como blob y se pinta con una url de `createObjectURL` que se guarda en la
    // caché de la pantalla; soltarla al salir dejaba la caché apuntando a una
    // url muerta y al volver la persona veía su foto rota. Un `page.goto`
    // recarga: caché vacía, imagen pedida otra vez, el fallo no aparece.
    await page.getByRole('button', { name: 'Añadir una foto de perfil', exact: true }).click()
    await page.setInputFiles('input[aria-label="Tu foto de perfil"]', {
      name: 'yo.png',
      mimeType: 'image/png',
      buffer: PNG_MINIMO,
    })
    await expect.poll(async () => (await pedirPerfil()).tieneFoto, { timeout: 20_000 }).toBe(true)
    await expect(page.getByRole('img', { name: /tu foto/i })).toBeVisible({ timeout: 15_000 })

    // Los enlaces de la cabecera, que es como se mueve la gente por el portal.
    await page.getByRole('link', { name: 'Mis procesos', exact: true }).click()
    await expect(page.getByRole('img', { name: /tu foto/i })).toHaveCount(0)
    await page.getByRole('link', { name: 'Mi cuenta', exact: true }).click()

    // Lo que se comprueba es que la imagen CARGÓ, no que el `<img>` esté ahí:
    // con la url revocada el elemento sale igual, vacío por dentro, y
    // `toBeVisible` pasaría tan contento.
    const laFoto = page.getByRole('img', { name: /tu foto/i })
    await expect(laFoto).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(async () => laFoto.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0)

    // El recorrido va en serie: se devuelve el perfil sin foto, como lo dejó el
    // paso anterior.
    await page.getByRole('button', { name: 'Cambiar tu foto de perfil' }).click()
    await page.getByRole('button', { name: 'Quitar la foto' }).click()
    await expect.poll(async () => (await pedirPerfil()).tieneFoto, { timeout: 15_000 }).toBe(false)
  })

  test('un PDF no vale como foto, y lo dice sin jerga', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir una foto de perfil' }).click()
    await page.setInputFiles('input[aria-label="Tu foto de perfil"]', UN_CV('esto no es una foto'))

    await expect(page.getByText(/no es una imagen|JPG, PNG o WebP/i).first()).toBeVisible({
      timeout: 15_000,
    })
    expect((await pedirPerfil()).tieneFoto).toBe(false)
  })

  test('la portada se elige de la galería y se queda elegida', async ({ page }) => {
    await page.getByRole('button', { name: 'Portada', exact: true }).click()
    await page.getByRole('button', { name: 'Aqua' }).click()

    await expect
      .poll(async () => (await pedirPerfil()).portada, { timeout: 15_000 })
      .toEqual({ tipo: 'GALERIA', codigo: 'CANTO_AQUA' })

    // Y la muestra elegida queda marcada, que es lo que se ve al reabrir el menú.
    await page.getByRole('button', { name: 'Portada', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Aqua', pressed: true })).toBeVisible()
  })

  test('los menús de foto y portada se cierran, y nunca están los dos abiertos', async ({ page }) => {
    const laPortada = page.getByRole('button', { name: 'Portada', exact: true })
    // Exacto: el `input[type=file]` se llama «Tu foto de perfil» y sale como
    // botón en el árbol de accesibilidad, así que una expresión regular coge los dos.
    const laFoto = page.getByRole('button', { name: 'Añadir una foto de perfil', exact: true })
    const menuPortada = page.locator('#menu-de-la-portada')
    const menuFoto = page.locator('#menu-de-la-foto')

    await laPortada.click()
    await expect(menuPortada).toBeVisible()
    await expect(laPortada).toHaveAttribute('aria-haspopup', 'true')

    // Excluyentes: entre los dos paneles tapaban el nombre y las señas.
    await laFoto.click()
    await expect(menuPortada).toHaveCount(0)
    await expect(menuFoto).toBeVisible()

    // Escape cierra y devuelve el foco a quien lo abrió.
    await page.keyboard.press('Escape')
    await expect(menuFoto).toHaveCount(0)
    await expect(laFoto).toBeFocused()

    // Y tocar fuera también, que es el primer gesto que se prueba en un teléfono.
    await laPortada.click()
    await expect(menuPortada).toBeVisible()
    await page.getByRole('heading', { level: 1 }).click()
    await expect(menuPortada).toHaveCount(0)
  })

  test('la portada puede salir de los colores de tu propia foto', async ({ page }) => {
    // Personalización sin pedirle a nadie que elija: si hay foto, la portada se
    // arma con sus colores aclarados hacia el cielo del portal.
    await page.getByRole('button', { name: 'Añadir una foto de perfil', exact: true }).click()
    await page.setInputFiles('input[aria-label="Tu foto de perfil"]', {
      name: 'yo.png',
      mimeType: 'image/png',
      buffer: PNG_MINIMO,
    })
    await expect.poll(async () => (await pedirPerfil()).tieneFoto, { timeout: 20_000 }).toBe(true)

    await page.getByRole('button', { name: 'Portada', exact: true }).click()
    await page.getByRole('button', { name: 'Los colores de mi foto' }).click()

    await expect
      .poll(async () => (await pedirPerfil()).portada.tipo, { timeout: 25_000 })
      .toBe('PROPIA')

    // Y sin foto el botón no está: uno que no puede hacer nada es peor que
    // ninguno.
    await page.getByRole('button', { name: 'Cambiar tu foto de perfil' }).click()
    await page.getByRole('button', { name: 'Quitar la foto' }).click()
    await expect.poll(async () => (await pedirPerfil()).tieneFoto, { timeout: 15_000 }).toBe(false)
    await page.getByRole('button', { name: 'Portada', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Los colores de mi foto' })).toHaveCount(0)

    // El recorrido va en serie: se devuelve el perfil como estaba para que el
    // paso siguiente no herede una portada propia a medio camino.
    await page.getByRole('button', { name: 'Aqua' }).click()
    await expect.poll(async () => (await pedirPerfil()).portada.tipo).toBe('GALERIA')
  })

  test('la portada propia se sube redibujada, no el archivo crudo', async ({ page }) => {
    await page.getByRole('button', { name: 'Portada', exact: true }).click()
    await page.getByRole('button', { name: 'Subir la mía' }).click()
    await page.setInputFiles('input[aria-label="La portada de tu perfil"]', {
      name: 'paisaje.png',
      mimeType: 'image/png',
      buffer: PNG_MINIMO,
    })

    await expect
      .poll(async () => (await pedirPerfil()).portada.tipo, { timeout: 20_000 })
      .toBe('PROPIA')

    // ⚠️ Lo que se manda es un JPEG salido del lienzo, no el PNG que se eligió.
    // El redibujado es lo que tira los metadatos EXIF —en una portada, que suele
    // ser una foto de un sitio, ahí van las coordenadas GPS—, así que el nombre y
    // el tipo del archivo guardado son la prueba de que pasó por él.
    const cabeceras = await page.evaluate(async () => {
      const r = await fetch('/api/v1/portal/perfil/portada', {
        headers: { Authorization: `Bearer ${localStorage.getItem('renaser_portal_token')}` },
      })
      return r.headers.get('content-type')
    })
    expect(cabeceras).toContain('image/jpeg')

    // Se deja como estaba para los pasos siguientes.
    await page.getByRole('button', { name: 'Portada', exact: true }).click()
    await page.getByRole('button', { name: 'Aqua' }).click()
    await expect.poll(async () => (await pedirPerfil()).portada.codigo).toBe('CANTO_AQUA')
  })

  test('el currículum se guarda en el perfil y deja de estar «sin currículum»', async ({ page }) => {
    expect((await pedirPerfil()).lecturaCv.estado).toBe('SIN_CV')

    await page.getByRole('button', { name: 'Subir mi currículum' }).click()
    await page.setInputFiles('input[aria-label="Tu currículum"]', UN_CV('el que vive en mi perfil'))

    await expect.poll(async () => (await pedirPerfil()).cv?.nombre, { timeout: 20_000 }).toBe(
      'curriculum.pdf',
    )
    await expect(page.getByText('curriculum.pdf').first()).toBeVisible()

    // La lectura arranca sola. En qué acaba depende de si la IA está encendida
    // —LISTA si leyó algo, NO_LEGIBLE si no—, y las dos son respuestas: lo que
    // NO puede es quedarse EN_CURSO para siempre, que es lo que veía el
    // candidato antes de que la cola cerrara las lecturas agotadas.
    await expect
      .poll(async () => (await pedirPerfil()).lecturaCv.estado, { timeout: 120_000 })
      .not.toBe('EN_CURSO')
  })

  test('postular sin adjuntar nada usa el del perfil, y el perfil no cambia', async ({ page }) => {
    const antes = await pedirPerfil()
    expect(antes.cv).not.toBeNull()

    const vacantes = (await (await fetch(`${API}/portal/vacantes`)).json()) as {
      id: number
      titulo: string
    }[]
    const vacante = vacantes.find((v) => v.titulo === VACANTES.SIN_PRETENSION)
    if (!vacante) throw new Error(`No está publicada «${VACANTES.SIN_PRETENSION}»: ¿se sembró la base?`)

    await page.goto(`/vacantes/${vacante.id}/postular`)
    // Ya no pide currículum: dice cuál va a mandar.
    await expect(page.getByText('curriculum.pdf').first()).toBeVisible({ timeout: 20_000 })
    // El input sigue en el DOM —escondido, esperando a «usar otro»—, así que lo
    // que se comprueba es que NO se le pide nada: no hay zona de arrastrar.
    await expect(page.getByText(/arrastra tu currículum/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Usar otro solo para esta vacante' })).toBeVisible()

    await rellenarLoDemas(page)
    await page.getByRole('button', { name: /^Enviar/ }).click()
    await expect(page.getByText(/postulación|recibimos/i).first()).toBeVisible({ timeout: 30_000 })

    // Lo que importa: el del perfil sigue siendo el mismo archivo.
    expect((await pedirPerfil()).cv).toEqual(antes.cv)
  })

  test('LA TRAMPA: postular con otro currículum NO cambia el del perfil', async ({ page }) => {
    const antes = await pedirPerfil()

    const vacantes = (await (await fetch(`${API}/portal/vacantes`)).json()) as {
      id: number
      titulo: string
    }[]
    const vacante = vacantes.find((v) => v.titulo === VACANTES.OTRA)
    if (!vacante) throw new Error(`No está publicada «${VACANTES.OTRA}»: ¿se sembró la base?`)

    await page.goto(`/vacantes/${vacante.id}/postular`)
    await page.getByRole('button', { name: 'Usar otro solo para esta vacante' }).click()
    // Y se dice, con esas palabras, que el del perfil se queda como está.
    await expect(page.getByText(/solo para esta vacante/i).first()).toBeVisible()

    await page.setInputFiles('input[aria-label="Tu currículum para esta vacante"]', {
      name: 'a-medida.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 el que mando solo a esta'),
    })
    await rellenarLoDemas(page)
    await page.getByRole('button', { name: /^Enviar/ }).click()
    await expect(page.getByText(/postulación|recibimos/i).first()).toBeVisible({ timeout: 30_000 })

    // El del perfil no se enteró: mismo nombre y mismo tamaño que antes.
    expect((await pedirPerfil()).cv).toEqual(antes.cv)
  })

  test('una certificación lleva su diploma adjunto', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir certificación' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill(CERTIFICADO)
    await page.getByLabel('Quién la emitió').fill('Sencico')
    await guardar(page)

    await page.getByRole('button', { name: `Adjuntar el diploma de ${CERTIFICADO}` }).click()
    await page.setInputFiles(`input[aria-label="El diploma de ${CERTIFICADO}"]`, {
      name: 'diploma.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mi diploma'),
    })

    await expect
      .poll(async () => (await pedirPerfil()).certificaciones.some((c) => c.tieneArchivo), {
        timeout: 20_000,
      })
      .toBe(true)
    await expect(page.getByRole('button', { name: `Ver el diploma de ${CERTIFICADO}` })).toBeVisible()

    await page.getByRole('button', { name: `Quitar el diploma de ${CERTIFICADO}` }).click()
    await expect
      .poll(async () => (await pedirPerfil()).certificaciones.some((c) => c.tieneArchivo), {
        timeout: 20_000,
      })
      .toBe(false)
  })
})

/** El resto del formulario de postular: el resultado y los requisitos de sí o no. */
async function rellenarLoDemas(page: Page) {
  await page
    .locator('textarea')
    .first()
    .fill('Ordené el cierre de caja de tres sedes: dejó de haber faltantes sin dueño.')
  for (const grupo of await page.locator('fieldset').filter({ has: page.getByRole('radio') }).all()) {
    await grupo.getByText('Sí', { exact: true }).click()
    await expect(grupo.getByRole('radio', { name: 'Sí' })).toBeChecked()
  }
  await page.getByLabel(/acepto|tratamiento/i).first().check()
}
