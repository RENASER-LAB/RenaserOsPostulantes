import { expect, test } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import {
  abrirElBanco,
  apiPanel,
  crearBorradorDeUsarYTirar,
  descartarVersion,
  detail,
  detalleDe,
  filaDelBanco,
  versionesDelBanco,
  type VersionDelBanco,
} from './ayuda-configuracion'

/**
 * El ciclo de vida de una versión del banco, contra el backend de verdad.
 *
 * `01-regresion-panel` ya comprueba que Configuración abre y enseña el banco;
 * aquí se ejercita lo que hay detrás: el contrato, las guardas de cada estado,
 * un ciclo entero sobre una versión propia y lo que el panel deja hacer.
 *
 * ⚠️ **Publicar y archivar de verdad NO se ejercitan, a propósito.** Las dos
 * son irreversibles —no hay desarchivar, y publicar retira a todas las
 * hermanas de golpe— así que un recorrido feliz sobre las versiones sembradas
 * se comería los datos de la base y no habría forma de devolverlos. Lo que se
 * ejercita son **las guardas**, que el backend evalúa ANTES de escribir nada, y
 * **un ciclo entero sobre una versión propia**: crearla, chocar con el 409 de
 * «banco vacío» y borrarla. Eso deja la base como estaba.
 *
 * ⚠️ **Lo único que escribe: dos borradores que se crean y se borran en el
 * mismo archivo.** Uno vive lo que dura el ciclo; el otro —«e2e-banco · versión
 * de usar y tirar»— nace en `beforeAll` y muere en `afterAll`, y es el que
 * ejercita las guardas y las acciones de un BORRADOR en pantalla, porque la
 * base sembrada no trae ninguno. Si el corredor muere a mitad puede quedar
 * vivo; su etiqueta lo delata. Lo que no se deshace son las filas de auditoría
 * de crear y descartar, y es correcto que así sea.
 *
 * ⚠️ **No hay ningún Excel que importar aquí.** El script del que viene esto
 * nunca subió uno: el borrador que crea está vacío a propósito, porque el 409
 * de «banco vacío» es el único camino que ejercita publicar sin consecuencias.
 *
 * Lo que este spec fija, y no se ve leyendo el frontend:
 *
 *   1. **`VersionBancoResponse` no tiene campo `nombre`.** `tipos.ts` lo
 *      declaraba y la fixtura de las capturas lo servía; el backend manda
 *      `etiqueta`. Desde que el tiempo viaja con el banco trae además
 *      `minutosObjetivo`: son siete campos, no seis.
 *   2. **Dos PUBLICADA del mismo nivel conviven** y solo la de `publicadaEn`
 *      más reciente se le fija a quien empieza (`laPublicadaDelNivel`, con su
 *      `order by publicadaEn desc limit 1`). La base sembrada NO trae ese caso
 *      —una publicada por nivel— así que esa mitad queda en `skip`, en voz
 *      alta, en vez de pasar en verde callando.
 *   3. **Los cinco 409 están escritos en español y son específicos**, y su
 *      `detail` llega entero a la pantalla. Eso último es lo que ninguna
 *      prueba de unidad puede fijar: las de unidad construyen el `ErrorApi`
 *      con el mensaje ya puesto, así que afirman la suposición en vez de
 *      comprobarla.
 */

let versiones: VersionDelBanco[] = []
const unaEn = (estado: VersionDelBanco['estado']) => versiones.find((v) => v.estado === estado)

/** Los grupos (tipo de banco, nivel) con más de una PUBLICADA. */
function nivelesConVariasPublicadas(): VersionDelBanco[][] {
  const porNivel = new Map<string, VersionDelBanco[]>()
  for (const v of versiones.filter((v) => v.estado === 'PUBLICADA')) {
    const clave = `${v.tipoBanco}|${v.nivelPuestoCodigo ?? ''}`
    porNivel.set(clave, [...(porNivel.get(clave) ?? []), v])
  }
  return [...porNivel.values()].filter((g) => g.length > 1)
}

const SIN_DOS_PUBLICADAS =
  'hace falta un nivel con DOS publicadas y la base local no tiene ninguno: ' +
  'esa mitad de la pantalla —el aviso y las dos etiquetas— no se ejercita'

/** El borrador propio que ejercita las guardas y la fila de un BORRADOR. */
const ETIQUETA_PROPIA = 'e2e-banco · versión de usar y tirar'
let borradorPropio: number | null = null

test.beforeAll(async () => {
  versiones = await versionesDelBanco()
  borradorPropio = await crearBorradorDeUsarYTirar(ETIQUETA_PROPIA, versiones)
})

test.afterAll(async () => {
  if (borradorPropio === null) return
  const borrada = await descartarVersion(borradorPropio)
  // «y se limpia sola al terminar»: si esto no es un 204, quedó una versión viva.
  expect(borrada.estado, detalleDe(borrada)).toBe(204)
})

// ---------- El contrato, antes de mirar ninguna pantalla ----------

test.describe('El banco · el contrato del backend', () => {
  test('GET /versiones devuelve la lista con sus siete campos, sin «nombre» y con los tres estados', async () => {
    const lista = await apiPanel('/banco-preguntas/versiones')
    expect(lista.estado, detalleDe(lista)).toBe(200)
    expect(Array.isArray(lista.cuerpo)).toBe(true)

    const primera = lista.cuerpo[0] ?? {}
    const campos = Object.keys(primera).sort()
    // El nombre de una versión es su «etiqueta»; `nombre` era un invento de la
    // fixtura. `minutosObjetivo` llegó con el tiempo del banco (PR #50).
    expect(campos).toEqual([
      'estado',
      'etiqueta',
      'id',
      'minutosObjetivo',
      'nivelPuestoCodigo',
      'publicadaEn',
      'tipoBanco',
    ])
    expect('nombre' in primera).toBe(false)

    // Los tres estados del ciclo son los únicos que llegan.
    for (const v of versiones) {
      expect(['BORRADOR', 'PUBLICADA', 'ARCHIVADA'], `estado ${v.estado} en la versión ${v.id}`).toContain(v.estado)
    }
  })

  test('dos PUBLICADA del mismo nivel conviven y todas traen publicadaEn, que es el desempate', async () => {
    const conVarias = nivelesConVariasPublicadas()
    test.skip(conVarias.length === 0, SIN_DOS_PUBLICADAS)

    expect(conVarias.length).toBeGreaterThan(0)
    const [grupo] = conVarias
    expect(grupo!.every((v) => v.publicadaEn), JSON.stringify(grupo!.map((v) => v.publicadaEn))).toBe(true)
    const masReciente = [...grupo!].sort(
      (a, b) => Date.parse(b.publicadaEn!) - Date.parse(a.publicadaEn!),
    )[0]!
    console.log(`[BANCO] rige «${masReciente.etiqueta}» (versión ${masReciente.id})`)
  })

  test('GET /versiones/{id}/preguntas trae codigo, tipo y esEliminatorio, y NUNCA logicaInterna', async () => {
    const conPreguntas = unaEn('PUBLICADA') ?? versiones[0]!
    const preguntas = await apiPanel(`/banco-preguntas/versiones/${conPreguntas.id}/preguntas`)
    expect(preguntas.estado, detalleDe(preguntas)).toBe(200)
    expect(Array.isArray(preguntas.cuerpo)).toBe(true)

    const pregunta = preguntas.cuerpo[0] ?? {}
    expect(Object.keys(pregunta), JSON.stringify(Object.keys(pregunta))).toEqual(
      expect.arrayContaining(['codigo', 'tipo', 'esEliminatorio']),
    )
    // Entra al banco pero no sale (RF-53).
    expect('logicaInterna' in pregunta).toBe(false)
  })
})

// ---------- Las guardas, que rechazan antes de escribir ----------

test.describe('El banco · las guardas del ciclo (ninguna escribe nada)', () => {
  test('publicar o descartar una PUBLICADA se rechaza con 409 y lo explica', async () => {
    const publicada = unaEn('PUBLICADA')
    test.skip(!publicada, 'no hay ninguna PUBLICADA en la base local: dos guardas no se ejercitan')

    const r = await apiPanel(`/banco-preguntas/versiones/${publicada!.id}/publicacion`, { method: 'POST' })
    expect(r.estado, detalleDe(r)).toBe(409)
    expect(detail(r)).toMatch(/borrador/i)

    const d = await apiPanel(`/banco-preguntas/versiones/${publicada!.id}`, { method: 'DELETE' })
    expect(d.estado, detalleDe(d)).toBe(409)
    expect(detail(d)).toMatch(/solo un borrador se edita/i)
  })

  test('archivar o renombrar un BORRADOR se rechaza con 409: se edita entero, no por el nombre', async () => {
    const r = await apiPanel(`/banco-preguntas/versiones/${borradorPropio}/archivado`, { method: 'POST' })
    expect(r.estado, detalleDe(r)).toBe(409)
    expect(detail(r)).toMatch(/publicada/i)

    // Renombrar es corrección editorial: solo de una publicada.
    const e = await apiPanel(`/banco-preguntas/versiones/${borradorPropio}/etiqueta`, {
      method: 'PATCH',
      cuerpo: { etiqueta: 'e2e-banco: no debería llegar a escribirse' },
    })
    expect(e.estado, detalleDe(e)).toBe(409)
    expect(detail(e)).toMatch(/un borrador se edita entero/i)
  })

  test('renombrar una ARCHIVADA se rechaza: es historia', async () => {
    const archivada = unaEn('ARCHIVADA')
    test.skip(!archivada, 'no hay ninguna ARCHIVADA en la base local: una guarda no se ejercita')

    const e = await apiPanel(`/banco-preguntas/versiones/${archivada!.id}/etiqueta`, {
      method: 'PATCH',
      cuerpo: { etiqueta: 'e2e-banco: no debería llegar a escribirse' },
    })
    expect(e.estado, detalleDe(e)).toBe(409)
    expect(detail(e)).toMatch(/archivada ya no se toca/i)
  })
})

// ---------- Un ciclo entero sobre una versión propia ----------

test.describe('El banco · un ciclo entero sobre una versión propia', () => {
  test('crear, chocar con el 409 de banco vacío y borrar deja la base como estaba', async () => {
    const id = await crearBorradorDeUsarYTirar('e2e-banco · la del ciclo', versiones)

    try {
      const enLista = await apiPanel<VersionDelBanco[]>('/banco-preguntas/versiones')
      const suya = enLista.cuerpo.find((v) => v.id === id)
      expect(suya?.estado, JSON.stringify(suya)).toBe('BORRADOR')

      /*
        Aquí está la gracia de usar una versión propia: `validarCoherencia`
        lanza antes de tocar el estado, así que este 409 no escribe nada — y es
        el único camino que ejercita el endpoint de publicar sin consecuencias.
      */
      const publicar = await apiPanel(`/banco-preguntas/versiones/${id}/publicacion`, { method: 'POST' })
      expect(publicar.estado, detalleDe(publicar)).toBe(409)
      expect(detail(publicar)).toMatch(/banco vacío/i)

      const sigueBorrador = await apiPanel<VersionDelBanco[]>('/banco-preguntas/versiones')
      expect(sigueBorrador.cuerpo.find((v) => v.id === id)?.estado).toBe('BORRADOR')

      const vacia = await apiPanel(`/banco-preguntas/versiones/${id}/preguntas`)
      expect(vacia.estado, detalleDe(vacia)).toBe(200)
      expect(vacia.cuerpo).toHaveLength(0)
    } finally {
      const borrada = await descartarVersion(id)
      expect(borrada.estado, detalleDe(borrada)).toBe(204)
      const despues = await apiPanel<VersionDelBanco[]>('/banco-preguntas/versiones')
      expect(despues.cuerpo.some((v) => v.id === id)).toBe(false)
    }
  })
})

// ---------- El panel ----------

test.describe('El banco · lo que el panel enseña y deja hacer', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('las versiones se pintan sin undefined, agrupadas por el nombre del nivel y con una sola que rige por grupo', async ({ page }) => {
    const seccion = await abrirElBanco(page)
    // Los grupos se titulan con el catálogo: hasta que llega, dirían el código
    // («Nivel DIRECCION»). Se espera a que el primero deje de ser un código.
    await expect(seccion.locator('h3').first()).not.toHaveText(/^Nivel [A-Z_]+$/, { timeout: 20_000 })
    const texto = await seccion.innerText()

    // Los siete campos son los que el backend manda: ninguna fila pinta un hueco.
    expect(texto).not.toMatch(/undefined|\[object Object\]|NaN/)

    const cuantasRigen = await seccion.getByText('Se asigna a quien empiece ahora').count()
    expect(cuantasRigen, 'alguna publicada dice que se le asigna a quien empiece').toBeGreaterThan(0)

    // Una por grupo como máximo: si hubiera dos «se asigna» en el mismo nivel,
    // el desempate estaría mal.
    const grupos = await seccion.locator('h3').count()
    expect(cuantasRigen, `${cuantasRigen} rigen sobre ${grupos} grupos`).toBeLessThanOrEqual(grupos)

    // El título del grupo usa el nombre del nivel, no su código.
    const titulos = await seccion.locator('h3').allInnerTexts()
    expect(titulos.some((t) => /^Nivel /.test(t)), JSON.stringify(titulos)).toBe(true)
    expect(titulos.some((t) => /^Nivel [A-Z_]+$/.test(t)), JSON.stringify(titulos)).toBe(false)
  })

  test('el nivel con dos publicadas lo avisa arriba del grupo y dice cuál NO se asigna', async ({ page }) => {
    test.skip(nivelesConVariasPublicadas().length === 0, SIN_DOS_PUBLICADAS)
    const seccion = await abrirElBanco(page)

    const cuantasRigen = await seccion.getByText('Se asigna a quien empiece ahora').count()
    const cuantasNo = await seccion.getByText('Publicada, pero no se asigna a nadie').count()
    expect(cuantasNo, `${cuantasRigen} rigen, ${cuantasNo} no`).toBeGreaterThan(0)
    await expect(seccion.getByText(/Hay \d+ versiones publicadas de este banco y solo una se asigna/)).toBeVisible()
  })

  test('un borrador ofrece Publicar y Descartar, no Renombrar, y pulsar Publicar pregunta antes en la propia fila', async ({ page }) => {
    const seccion = await abrirElBanco(page)
    const fila = filaDelBanco(seccion, ETIQUETA_PROPIA)
    await expect(fila).toBeVisible()
    await expect(fila.getByText('BORRADOR', { exact: true })).toBeVisible()

    await expect(fila.getByRole('button', { name: 'Publicar' })).toHaveCount(1)
    await expect(fila.getByRole('button', { name: 'Descartar' })).toHaveCount(1)
    // El backend lo rechaza con 409: un borrador se edita entero.
    await expect(fila.getByRole('button', { name: 'Renombrar' })).toHaveCount(0)

    // Preguntar antes: pulsar no publica.
    await fila.getByRole('button', { name: 'Publicar' }).click()
    const pregunta = fila.getByText(/Publicar esta versión/)
    await expect(pregunta).toBeVisible()
    // La pregunta dice que publicar archiva a las otras publicadas del nivel.
    await expect(pregunta).toContainText(/archiva/)
    // Y avisa de que el rechazo del backend nombra una sola pregunta.
    await expect(fila.getByText(/nombra solo la primera que encuentra/)).toBeVisible()

    await fila.getByRole('button', { name: 'Volver' }).click()
    await expect(fila.getByRole('button', { name: 'Sí, publicar' })).toHaveCount(0)
  })

  test('una archivada no ofrece ninguna acción y dice por qué', async ({ page }) => {
    test.skip(!unaEn('ARCHIVADA'), 'no hay ninguna ARCHIVADA en pantalla')
    const seccion = await abrirElBanco(page)
    const fila = seccion.getByRole('listitem').filter({ has: page.getByText('ARCHIVADA', { exact: true }) }).first()
    await expect(fila).toBeVisible()

    await expect(fila.getByRole('button', { name: 'Archivar' })).toHaveCount(0)
    await expect(fila.getByRole('button', { name: 'Publicar' })).toHaveCount(0)
    await expect(fila.getByRole('button', { name: 'Renombrar' })).toHaveCount(0)
    // En vez de dejar la fila muda.
    await expect(fila.getByText(/ya no se asigna/)).toBeVisible()
  })

  test('lo que contiene una versión sale del backend, cuadra con la API y no filtra la lógica interna', async ({ page }) => {
    const publicada = unaEn('PUBLICADA')
    test.skip(!publicada, 'no hay ninguna PUBLICADA en pantalla')
    const seccion = await abrirElBanco(page)

    const fila = filaDelBanco(seccion, publicada!.etiqueta)
    await fila.getByRole('button', { name: 'Ver qué contiene' }).click()

    const resumen = fila.getByText(/\d+ preguntas · \d+ puntúan/)
    await expect(resumen).toBeVisible({ timeout: 20_000 })
    const dicho = await resumen.innerText()

    // La cifra tiene que casar con lo que la API devuelve para esa versión, y
    // no ser la rama de «versión vacía» disfrazada de resumen.
    const desdeApi = await apiPanel<unknown[]>(`/banco-preguntas/versiones/${publicada!.id}/preguntas`)
    const cuantas = Number(dicho.match(/^(\d+)/)?.[1])
    expect(cuantas, `${cuantas} en pantalla, ${desdeApi.cuerpo.length} en la API de la versión ${publicada!.id}`).toBeGreaterThan(0)
    expect(cuantas).toBe(desdeApi.cuerpo.length)

    await expect(fila.getByText(/logicaInterna|lógica interna/i)).toHaveCount(0)
  })

  /**
   * Lo único que ata el `detail` del backend al texto que se lee en pantalla.
   *
   * ⚠️ **Los tests de unidad no pueden probar esto**: construyen el `ErrorApi`
   * con el mensaje ya puesto, así que afirman la suposición. Entre el 409 y el
   * párrafo rojo hay una pieza que ninguno de los dos lados mira —la puerta,
   * que elige entre `detail`, `title` y `message`— y si un día eligiera mal,
   * TODOS los 409 dirían «El estado actual no permite esta operación» y las
   * pruebas de unidad seguirían en verde.
   *
   * Se hace con el borrador propio, que publica a un 409 seguro y **no
   * escribe nada**: `validarCoherencia` lanza antes de tocar el estado.
   */
  test('el «detail» del 409 llega entero a la pantalla, no el título genérico de Spring', async ({ page }) => {
    const seccion = await abrirElBanco(page)
    const fila = filaDelBanco(seccion, ETIQUETA_PROPIA)
    await expect(fila).toBeVisible()

    await fila.getByRole('button', { name: 'Publicar' }).click()
    await fila.getByRole('button', { name: 'Sí, publicar' }).click()

    const rojo = fila.locator('[role=alert]')
    await expect(rojo).toBeVisible({ timeout: 20_000 })
    const dicho = await rojo.innerText()

    expect(dicho).toMatch(/banco vacío/i)
    // El «title» de Spring no distingue un 409 de otro.
    expect(dicho).not.toMatch(/El estado actual no permite esta operación/i)
    // El rechazo no escribió nada.
    await expect(fila.getByText('BORRADOR', { exact: true })).toBeVisible()
  })
})
