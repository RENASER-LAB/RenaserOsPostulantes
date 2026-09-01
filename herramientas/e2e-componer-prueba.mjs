/**
 * Escribir una prueba del puesto desde el panel, de punta a punta, EN UN CHROME VISIBLE y
 * contra el backend de verdad: se crea la prueba, se compone su primera versión entera
 * —enunciado escrito y subido, guía para la IA, preguntas, entregables, rúbrica y el
 * cambio inesperado—, se intenta publicar hasta que el servidor deja, y se comprueba que
 * la versión publicada aparece en el desplegable de una vacante.
 *
 * Es el recorrido que hasta ahora **nadie había visto funcionar**. Las pantallas se
 * probaron contra un backend simulado que contesta `{ok:true}` a todo lo que no sea GET,
 * así que ningún guardado real se había ejercitado: doce endpoints de edición y borrado,
 * la subida del enunciado y el listado de versiones se estrenaron aquí.
 *
 * ⚠️ **ESCRIBE EN LA BASE A LA QUE APUNTE EL BACKEND.** Nunca contra producción. Cada
 * corrida deja, y no hay forma de borrarlo desde ninguna pantalla:
 *
 *   - una plantilla de prueba nueva (el nombre lleva la hora, así que no se pisan);
 *   - una versión PUBLICADA suya, que se congela —no existe «despublicar»—;
 *   - una segunda versión en borrador;
 *   - un archivo subido y unas cuantas filas de auditoría.
 *
 * No toca ninguna vacante: la del paso final solo se mira.
 *
 * ⚠️ **No le pide nada a la IA.** No hay coste ni cola de por medio: todo lo que hace es
 * pantalla y base.
 *
 * ⚠️ **Comprueba con quién habla antes de empezar.** El 8080 suele ser Adminer, que
 * contesta 200 a todo: apuntar ahí por descuido da una e2e que «pasa» sin haber probado
 * nada. El paso 0 se asegura de que al otro lado hay un backend.
 *
 *   PORTAL=http://localhost:5199 node herramientas/e2e-componer-prueba.mjs
 *
 * Variables: PORTAL, PAUSA, DEV_ID, VACANTE (el título de la vacante en la que se mira el
 * desplegable), PUESTO (para qué puesto se escribe la prueba; en blanco = genérica).
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5199'
const PAUSA = Number(process.env.PAUSA ?? 350)
const DEV_ID = process.env.DEV_ID ?? 'andy-dev'
const VACANTE = process.env.VACANTE ?? 'Diseñador Frontend e2e prueba completa'
/*
  Genérica a propósito: el desplegable de la vacante solo ofrece las pruebas de SU puesto
  y las genéricas, así que atarla a un puesto la volvería invisible en el paso final sin
  que nada avisara. Se puede forzar con PUESTO=«Administrador» para probar el filtro.
*/
const PUESTO = process.env.PUESTO ?? ''
const SELLO = new Date().toISOString().slice(11, 19).replace(/:/g, '')
const NOMBRE = `Reto de priorización · e2e ${SELLO}`

await mkdir('capturas', { recursive: true })

// ============================================================
// 0 · Con quién estamos hablando
// ============================================================
/*
  Antes de abrir el navegador. Un backend contesta a esto con un 401 y un cuerpo JSON;
  Adminer —o cualquier otra cosa en el puerto de al lado— contesta un 200 con HTML, y a
  partir de ahí toda la e2e mide el vacío.
*/
{
  const r = await fetch(`${PORTAL}/api/v1/panel/plantillas-prueba`).catch(() => null)
  const tipo = r?.headers.get('content-type') ?? ''
  const esBackend = r != null && (r.status === 401 || r.status === 403) && tipo.includes('json')
  if (!esBackend) {
    console.error(
      `\n✗ ${PORTAL} no está sirviendo el backend del panel.\n` +
        `   Pedí /api/v1/panel/plantillas-prueba y contestó ${r?.status ?? 'nada'} (${tipo || 'sin tipo'}).\n` +
        `   Se esperaba un 401 con JSON. Lo normal es que el proxy del portal apunte al\n` +
        `   puerto equivocado —el 8080 es Adminer y contesta 200 a todo— o que el backend\n` +
        `   no esté levantado.\n`,
    )
    process.exit(1)
  }
  console.log(`✓ Al otro lado de ${PORTAL} hay un backend (401 con JSON).`)
}

const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 110 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 980 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const fallos = []
pagina.on('pageerror', (e) => fallos.push(`error de página · ${String(e).slice(0, 200)}`))
pagina.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404') && !m.text().includes('Failed to load resource'))
    fallos.push(`consola · ${m.text().slice(0, 200)}`)
})

/*
 * Los rechazos del servidor que esta prueba PIDE a propósito: publicar una versión a la
 * que le falta algo. Se marcan uno a uno con `esperandoRechazo` justo antes de provocarlos
 * y se apagan enseguida, para que un 400 que no fuera ese siga contando como fallo.
 *
 * ⚠️ **De 404 solo se perdona uno, y no el que perdonaba el modelo de esta prueba.** Aquel
 * dejaba pasar los de `/plantillas-prueba/versiones/` porque el panel adivinaba ids a base
 * de tantear, y ese tanteo es justo lo que esta rama borró: heredar el perdón taparía la
 * avería que esta e2e existe para ver. El único que se perdona es la ficha del puesto de
 * la vacante del último paso, que no está escrita —la escribe el dueño del puesto para el
 * cuestionario técnico, y esta vacante rinde la prueba del puesto—; la pantalla la pide
 * para saber si hay cuestionario publicado y el «no hay» viaja como un 404.
 */
let esperandoRechazo = null
let rechazosEsperados = 0
let perdonados = 0
pagina.on('response', (r) => {
  if (r.status() < 400) return
  const url = r.url()
  if (esperandoRechazo && url.includes(esperandoRechazo.enLaUrl) && r.status() === esperandoRechazo.estado) {
    rechazosEsperados++
    return
  }
  if (r.status() === 404 && /\/vacantes\/\d+\/ficha$/.test(url)) {
    perdonados++
    return
  }
  fallos.push(`${r.status()} · ${r.request().method()} ${url.replace(PORTAL, '')}`)
})

const pasos = []
const queja = async () => (await pagina.getByRole('alert').allTextContents()).join(' · ')
const paso = async (titulo) => {
  pasos.push(titulo)
  console.log(`\n${pasos.length}. ${titulo}`)
  await pagina.waitForTimeout(PAUSA)
  await pagina.screenshot({
    path: `capturas/e2e-cp-${String(pasos.length).padStart(2, '0')}.png`,
    fullPage: true,
  })
}
const comprobar = (condicion, queDeberia) => {
  if (!condicion) fallos.push(queDeberia)
  return condicion
}
/** Esperar a que algo del servidor llegue a la pantalla, y anotarlo si no llega. */
const hastaQue = async (condicion, queDeberia, ms = 20000) => {
  const limite = Date.now() + ms
  for (;;) {
    if (await condicion().catch(() => false)) return true
    if (Date.now() > limite) {
      fallos.push(queDeberia)
      return false
    }
    await pagina.waitForTimeout(200)
  }
}
function resumir() {
  console.log(`\n${fallos.length === 0 ? '✓ sin fallos' : `⚠️  ${fallos.length} fallos:`}`)
  fallos.forEach((f) => console.log(`   ${f}`))
  console.log(
    `   (${rechazosEsperados} rechazo(s) del servidor pedidos a propósito, ${perdonados} 404 esperados)`,
  )
  console.log(`   La prueba escrita se llama «${NOMBRE}».`)
}

// ---------- Cómo se agarra cada cosa de esta pantalla ----------

/*
  Los seis bloques del compositor son `<section aria-labelledby=…>`, o sea regiones con
  nombre. Agarrarlos por ahí es lo que hace que «Cómo se llama» de un entregable no se
  confunda con el «Cómo se llama» de una plantilla.
*/
const bloque = (titulo) => pagina.getByRole('region', { name: titulo })
const BALANCE = 'Lo que falta para publicar'
const DATOS = 'Qué se pide y en cuánto tiempo'
const PREGUNTAS = 'Las preguntas que responderá'
const ENTREGABLES = 'Lo que tiene que entregar'
const RUBRICA = 'Con qué se le pone la nota'
const VARIANTES = 'El cambio inesperado'

/*
  ⚠️ **`getByLabel` no sirve en esta pantalla.** Las etiquetas envuelven al control y
  llevan dentro el texto de ayuda, así que el nombre accesible de la caja del enunciado es
  «El enunciadoLo que quien la rinde lee para…». Se busca la `<label>` por su principio y
  se baja al control.
*/
const campo = (donde, etiqueta) => donde.locator('label').filter({ hasText: etiqueta }).first()
const escribir = async (donde, etiqueta, texto) =>
  campo(donde, etiqueta).locator('textarea, input').first().fill(texto)
const elegir = async (donde, etiqueta, valor) =>
  campo(donde, etiqueta).locator('select').first().selectOption(valor)
const leer = async (donde, etiqueta) =>
  campo(donde, etiqueta).locator('textarea, input, select').first().inputValue()

/**
 * Una cuenta del balance, buscada por su nombre EXACTO.
 *
 * ⚠️ Se compara contra el primer `<span>` de la fila y no contra el texto entero. Los
 * nombres se solapan —«Preguntas» es principio de «Preguntas universales»— y buscar por
 * principio de línea daba por presente el marcador del cuestionario cuando lo que había
 * era el de las universales: la afirmación de que la cuota cambia al añadir un entregable
 * fallaba sola, con la pantalla haciéndolo bien.
 */
const laCuenta = async (nombre) => {
  const filas = await bloque(BALANCE).getByRole('listitem').all()
  for (const fila of filas) {
    const suNombre = ((await fila.locator('span').first().textContent()) ?? '').trim()
    if (suNombre === nombre) return (await fila.textContent()).replace(/\s+/g, ' ').trim()
  }
  return null
}

/** Quitar algo de una lista: pulsar «Quitar» y confirmar en el sitio. */
const quitarDeLaLista = async (region, textoDeLaFila, queEs) => {
  const fila = bloque(region).getByRole('listitem').filter({ hasText: textoDeLaFila }).first()
  await fila.getByRole('button', { name: 'Quitar' }).click()
  await fila.getByRole('button', { name: `Sí, quitar ${queEs}` }).click()
}

try {

// ============================================================
// Entrar y crear la prueba
// ============================================================

await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
await pagina.evaluate(() => window.localStorage.clear())
await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
// La entrada de desarrollo está plegada: el campo no existe hasta desplegarla.
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill(DEV_ID)
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 25000 })
await paso(`Alguien del equipo entra al panel como ${DEV_ID}`)

// 2 · La pestaña «Pruebas» no existía hasta ayer: las cinco pruebas reales entraron por
//     un script de Python, y quien no escribe Python no podía escribir una prueba.
await pagina.getByRole('link', { name: 'Pruebas', exact: true }).click()
await pagina.getByRole('heading', { name: 'Pruebas del puesto.' }).waitFor({ timeout: 20000 })
await paso('La pestaña «Pruebas»: qué hay escrito y en qué estado está cada versión')

await pagina.getByRole('button', { name: 'Escribir una prueba nueva' }).click()
await escribir(pagina, 'Cómo se llama', NOMBRE)
if (PUESTO !== '') await elegir(pagina, 'Para qué puesto', { label: PUESTO })
await pagina.getByRole('button', { name: 'Crear la prueba' }).click()

const laPlantilla = pagina.getByRole('listitem').filter({ hasText: NOMBRE }).first()
await laPlantilla.waitFor({ timeout: 20000 }).catch(async () => {
  throw new Error(`La prueba nueva no salió en la lista: ${(await queja()) || '(sin mensaje)'}`)
})
comprobar(
  (await laPlantilla.getByText('Genérica: sirve para cualquier puesto').count()) > 0 || PUESTO !== '',
  'La prueba nueva no se declara genérica, y sin puesto debería serlo',
)
await paso(`Creada «${NOMBRE}», todavía sin ninguna versión`)

// 4 · Una plantilla no es una prueba: es su nombre. Lo que se rinde es una versión suya.
await laPlantilla.getByRole('button', { name: 'Empezar una versión nueva' }).click()
await hastaQue(
  async () => (await laPlantilla.getByText('BORRADOR').count()) > 0,
  'Crear una versión no dejó ningún borrador en la lista de la plantilla',
)
await paso('Nace la v1, en borrador: se compone entera y solo entonces se publica')

await laPlantilla.getByRole('link', { name: 'Componer' }).first().click()
await pagina.getByRole('heading', { name: NOMBRE }).waitFor({ timeout: 20000 })
await bloque(DATOS).waitFor({ timeout: 15000 })
await paso('El compositor: el balance arriba y los cinco bloques que hay que llenar')

// ============================================================
// Los datos de la versión, guardados y releídos
// ============================================================

const ENUNCIADO =
  'Te llegan a la vez veinte solicitudes de mantenimiento de las tres sedes y solo tienes ' +
  'presupuesto para ocho. Ordénalas, di cuáles no se hacen y explica con qué criterio.'
const MATERIALES =
  'El listado de las veinte solicitudes con su fecha, su sede y lo que costaría cada una.'
const HERRAMIENTAS = 'Hoja de cálculo y calculadora. No se puede consultar a nadie de la empresa.'

await escribir(bloque(DATOS), 'El enunciado', ENUNCIADO)
await escribir(bloque(DATOS), 'Con qué material se le entrega', MATERIALES)
await escribir(bloque(DATOS), 'Qué herramientas puede usar', HERRAMIENTAS)
await elegir(bloque(DATOS), 'Cómo se rinde', 'CRONOMETRADA')
await escribir(bloque(DATOS), 'Cuántos minutos dura', '90')
await escribir(bloque(DATOS), 'El cambio llega a partir del minuto', '30')
await escribir(bloque(DATOS), '…y como muy tarde en el minuto', '45')
await escribir(bloque(DATOS), 'Minutos extra que se dan por el cambio', '10')
await paso('Escritos el enunciado, el material, las herramientas y los tiempos')

await bloque(DATOS).getByRole('button', { name: 'Guardar estos datos' }).click()
/*
  ⚠️ El «Guardado.» sale del `onSuccess` de la mutación, o sea de que el servidor lo
  confirmó. Esperarlo es lo único que distingue guardar de haber pulsado un botón.
*/
await bloque(DATOS)
  .getByText('Guardado.', { exact: true })
  .waitFor({ timeout: 20000 })
  .catch(async () => {
    throw new Error(`Los datos no se guardaron: ${(await queja()) || '(sin mensaje)'}`)
  })
await paso('Guardados, y el servidor lo confirma')

/*
 * 9 · **Este es el paso que de verdad importa.**
 *
 * `PUT /versiones/{id}` reemplaza la versión ENTERA: lo que la pantalla no mande se guarda
 * en nulo. Un formulario al que le faltara un campo borraría ese campo sin que nadie lo
 * tocara, y nada en la pantalla lo diría — el estado de React seguiría enseñando lo
 * tecleado. La única forma de verlo es recargar y volver a leer del servidor.
 */
await pagina.reload({ waitUntil: 'domcontentloaded' })
await bloque(DATOS).waitFor({ timeout: 20000 })
comprobar((await leer(bloque(DATOS), 'El enunciado')) === ENUNCIADO, 'El enunciado no sobrevivió a recargar')
comprobar(
  (await leer(bloque(DATOS), 'Con qué material se le entrega')) === MATERIALES,
  'Los materiales no sobrevivieron a recargar: el PUT reemplaza la versión entera y se perdieron',
)
comprobar(
  (await leer(bloque(DATOS), 'Qué herramientas puede usar')) === HERRAMIENTAS,
  'Las herramientas no sobrevivieron a recargar',
)
comprobar((await leer(bloque(DATOS), 'Cuántos minutos dura')) === '90', 'Los 90 minutos no sobrevivieron')
comprobar(
  (await leer(bloque(DATOS), 'El cambio llega a partir del minuto')) === '30' &&
    (await leer(bloque(DATOS), '…y como muy tarde en el minuto')) === '45' &&
    (await leer(bloque(DATOS), 'Minutos extra que se dan por el cambio')) === '10',
  'El rango del cambio inesperado no sobrevivió a recargar',
)
await paso('Recargada: lo guardado sigue ahí, campo por campo')

// ============================================================
// El enunciado como archivo
// ============================================================

await pagina.locator('input[type=file]').setInputFiles({
  name: 'enunciado-priorizacion.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 el enunciado de la prueba de priorización, en papel'),
})
await bloque(DATOS).getByRole('button', { name: 'Subir el enunciado' }).click()
const elEnunciadoSubido = pagina.getByRole('link', { name: 'Ver el enunciado que hay subido' })
await elEnunciadoSubido.waitFor({ timeout: 25000 }).catch(async () => {
  throw new Error(`El enunciado no quedó subido: ${(await queja()) || '(sin mensaje)'}`)
})
/*
  ⚠️ Se comprueba que el enlace ESTÁ, no que se abra. En local el almacén es el doble en
  memoria y reparte urls «memoria://», que ningún navegador abre: es el entorno, no una
  avería. Lo que importa es que la versión quedó apuntando a un archivo.
*/
comprobar(
  ((await elEnunciadoSubido.getAttribute('href')) ?? '').length > 0,
  'El enunciado subido no dejó ningún enlace',
)
await paso('Subido el PDF del enunciado, y la versión queda enlazada a él')

/*
 * 11 · Y ahora al revés: **guardar los datos DESPUÉS de subir**.
 *
 * El formulario de arriba no manda `urlConsigna` —no viaja en ese contrato—, así que un
 * PUT que pusiera en nulo todo lo que no recibe se llevaría por delante el enunciado
 * recién subido. Guardar primero y subir después nunca lo habría enseñado.
 */
await escribir(bloque(DATOS), 'Cuántos minutos dura', '95')
await bloque(DATOS).getByRole('button', { name: 'Guardar estos datos' }).click()
await bloque(DATOS).getByText('Guardado.', { exact: true }).waitFor({ timeout: 20000 })
await pagina.reload({ waitUntil: 'domcontentloaded' })
await bloque(DATOS).waitFor({ timeout: 20000 })
comprobar((await leer(bloque(DATOS), 'Cuántos minutos dura')) === '95', 'El cambio a 95 minutos no se guardó')
comprobar(
  await pagina
    .getByRole('link', { name: 'Ver el enunciado que hay subido' })
    .isVisible()
    .catch(() => false),
  'Guardar los datos borró el enunciado subido: el PUT reemplaza la versión entera y se llevó urlConsigna',
)
await paso('Guardar los datos otra vez NO se lleva por delante el enunciado subido')

// ============================================================
// La guía que orienta a la IA
// ============================================================

const GUIA =
  'Lo que distingue un buen trabajo aquí es que el orden se justifique con el coste de no ' +
  'hacerlo, no con la antigüedad de la solicitud. Premia a quien diga en voz alta qué deja ' +
  'fuera y por qué. Descarta a quien reparta el presupuesto a partes iguales para no elegir.'

await escribir(bloque(DATOS), 'Qué debería mirar la IA al calificarla', GUIA)
comprobar(
  (await bloque(DATOS).getByText(`${GUIA.length} de 2000 caracteres`).count()) > 0,
  'El contador de la guía no cuenta lo que hay escrito',
)
await bloque(DATOS).getByRole('button', { name: 'Guardar estos datos' }).click()
await bloque(DATOS)
  .getByText('Guardado.', { exact: true })
  .waitFor({ timeout: 20000 })
  .catch(async () => {
    throw new Error(`La guía no se guardó: ${(await queja()) || '(sin mensaje)'}`)
  })
await pagina.reload({ waitUntil: 'domcontentloaded' })
await bloque(DATOS).waitFor({ timeout: 20000 })
comprobar(
  (await leer(bloque(DATOS), 'Qué debería mirar la IA al calificarla')) === GUIA,
  'La guía de calificación no sobrevivió a recargar',
)
await paso('La guía de calificación, escrita, guardada y releída del servidor')

// ============================================================
// Los entregables, y lo que le hacen a la cuota de preguntas
// ============================================================

/*
 * 13 · Sin entregables la prueba es un cuestionario: sus preguntas SON la prueba y basta
 * con una. El primer entregable cambia eso —pasan a hacer falta 8-10 universales y 3-5 del
 * puesto—, y el balance tiene que decirlo en el momento, no al intentar publicar.
 */
comprobar(
  (await laCuenta('Preguntas')) !== null && (await laCuenta('Preguntas universales')) === null,
  'Sin entregables, el balance no trata la prueba como un cuestionario',
)
await paso('Con cero entregables el balance pide «al menos 1» pregunta: es un cuestionario')

const pedirEntregable = async (nombre, detalle, formato) => {
  await bloque(ENTREGABLES).getByRole('button', { name: 'Pedir un entregable' }).click()
  await escribir(bloque(ENTREGABLES), 'Cómo se llama', nombre)
  await elegir(bloque(ENTREGABLES), 'En qué forma se entrega', formato)
  await escribir(bloque(ENTREGABLES), 'Qué tiene que contener', detalle)
  await bloque(ENTREGABLES).getByRole('button', { name: 'Añadirlo' }).click()
  await hastaQue(
    async () => (await bloque(ENTREGABLES).getByRole('listitem').filter({ hasText: nombre }).count()) > 0,
    `El entregable «${nombre}» no llegó a la lista`,
  )
}

await pedirEntregable(
  'La lista priorizada',
  'Las veinte solicitudes ordenadas, con las ocho que se hacen marcadas.',
  'ARCHIVO',
)
await hastaQue(
  async () => (await laCuenta('Preguntas universales')) !== null,
  'Añadir el primer entregable no hizo aparecer la cuota de preguntas universales',
)
comprobar(
  (await laCuenta('Preguntas')) === null,
  'Con un entregable ya puesto, el balance sigue tratando la prueba como un cuestionario',
)
await paso('El primer entregable cambia la prueba: ahora el balance pide 8-10 y 3-5 preguntas')

await pedirEntregable('El descarte', 'Las doce que no se hacen y por qué.', 'CUALQUIERA')

// 15 · Corregir uno: es uno de los endpoints que nadie había visto por pantalla.
const filaDescarte = bloque(ENTREGABLES).getByRole('listitem').filter({ hasText: 'El descarte' }).first()
await filaDescarte.getByRole('button', { name: 'Corregir' }).click()
await escribir(bloque(ENTREGABLES), 'Cómo se llama', 'El descarte, con su motivo')
await escribir(
  bloque(ENTREGABLES),
  'Qué tiene que contener',
  'Las doce que no se hacen, cada una con la razón de por qué no, en una línea.',
)
await bloque(ENTREGABLES).getByRole('button', { name: 'Guardarlo' }).click()
await hastaQue(
  async () =>
    (await bloque(ENTREGABLES).getByRole('listitem').filter({ hasText: 'El descarte, con su motivo' }).count()) > 0,
  'Corregir el entregable no cambió lo que se ve',
)
await paso('Dos entregables, y el segundo corregido: el PUT de entregables funciona')

// 16 · Y quitar uno, que es el otro endpoint nuevo.
await pedirEntregable('Un tercero de sobra', 'Está aquí para que se le pueda quitar.', 'ENLACE')
await quitarDeLaLista(ENTREGABLES, 'Un tercero de sobra', 'el entregable')
await hastaQue(
  async () =>
    (await bloque(ENTREGABLES).getByRole('listitem').filter({ hasText: 'Un tercero de sobra' }).count()) === 0,
  'Quitar el entregable no lo sacó de la lista',
)
await paso('Y uno quitado: quedan los dos que la prueba pide de verdad')

// ============================================================
// Las preguntas
// ============================================================

/*
 * Se traen del catálogo, que es de toda la plataforma. Se pide la primera disponible de
 * cada tipo y se vuelve a mirar el desplegable en cada vuelta: `disponibles` encoge según
 * se añaden, así que una lista leída una sola vez elegiría dos veces la misma.
 */
const traerPregunta = async (tipo) => {
  const desplegable = campo(bloque(PREGUNTAS), 'Traer una del catálogo').locator('select')
  const opciones = await desplegable.locator('option').all()
  for (const opcion of opciones) {
    const valor = await opcion.getAttribute('value')
    const texto = (await opcion.textContent()) ?? ''
    if (valor === '' || !texto.includes(` · ${tipo} · `)) continue
    const codigo = texto.split(' · ')[0]
    await desplegable.selectOption(valor)
    await bloque(PREGUNTAS).getByRole('button', { name: 'Añadirla' }).click()
    await hastaQue(
      async () => (await bloque(PREGUNTAS).getByRole('listitem').filter({ hasText: codigo }).count()) > 0,
      `La pregunta ${codigo} no llegó a la lista de la versión`,
    )
    return codigo
  }
  fallos.push(`El catálogo se quedó sin preguntas de tipo ${tipo}`)
  return null
}

const universales = []
for (let i = 0; i < 8; i++) {
  const codigo = await traerPregunta('UNIVERSAL')
  if (codigo) universales.push(codigo)
}
for (let i = 0; i < 3; i++) await traerPregunta('ESPECIFICA')

comprobar(
  (await laCuenta('Preguntas universales'))?.includes('ya está') === true,
  `Con ocho universales el balance no las da por buenas: ${await laCuenta('Preguntas universales')}`,
)
comprobar(
  (await laCuenta('Preguntas del puesto'))?.includes('ya está') === true,
  `Con tres específicas el balance no las da por buenas: ${await laCuenta('Preguntas del puesto')}`,
)
await paso('Ocho universales y tres del puesto: las dos cuotas, en verde')

// 18 · Quitar una y ver que el balance lo dice al momento, sin recargar.
const laQuitada = universales[universales.length - 1]
await quitarDeLaLista(PREGUNTAS, laQuitada, 'la pregunta')
await hastaQue(
  async () => (await laCuenta('Preguntas universales'))?.includes('faltan 1 pregunta') === true,
  `Quitada una universal, el balance no dice que falta una: ${await laCuenta('Preguntas universales')}`,
)
await paso(`Quitada la ${laQuitada}: el balance pasa a rojo y dice que falta una`)

// ============================================================
// La rúbrica
// ============================================================

const anadirCriterio = async (codigo, nombre, puntos, quien, descripcion) => {
  await bloque(RUBRICA).getByRole('button', { name: 'Añadir un criterio' }).click()
  await escribir(bloque(RUBRICA), 'Código', codigo)
  await escribir(bloque(RUBRICA), 'Cuántos puntos vale', String(puntos))
  await elegir(bloque(RUBRICA), 'Quién lo comprueba', quien)
  await escribir(bloque(RUBRICA), 'Qué mira este criterio', nombre)
  if (descripcion) await escribir(bloque(RUBRICA), 'La explicación larga, si hace falta', descripcion)
  await bloque(RUBRICA).getByRole('button', { name: 'Añadirlo' }).click()
  await hastaQue(
    async () => (await bloque(RUBRICA).getByRole('listitem').filter({ hasText: codigo }).count()) > 0,
    `El criterio ${codigo} no llegó a la rúbrica`,
  )
}

await anadirCriterio('CRITERIO_ORDEN', 'El orden se justifica con el coste de no hacerlo', 40, 'AGENTE',
  'Se mira si el argumento de cada posición nombra una consecuencia concreta.')
await anadirCriterio('CRITERIO_DESCARTE', 'Dice qué deja fuera y lo sostiene', 40, 'AGENTE')
await anadirCriterio('CRITERIO_CUENTAS', 'Las ocho elegidas caben en el presupuesto', 60, 'PERSONA')

comprobar(
  (await laCuenta('La rúbrica, en puntos'))?.includes('sobran 40 puntos') === true,
  `Con 140 puntos el balance no dice que sobran 40: ${await laCuenta('La rúbrica, en puntos')}`,
)
await paso('Tres criterios que suman 140: el balance dice que sobran 40 puntos')

// ============================================================
// Publicar: una regla por intento
// ============================================================

/*
 * El backend valida en cascada —duración, cuota de preguntas, rúbrica— y **para en la
 * primera que falla**, así que nombra una sola cosa aunque haya tres mal. Se intenta con
 * todo mal a la vez, se arregla lo que diga, y se vuelve.
 */
const intentarPublicar = async () => {
  await pagina.getByRole('button', { name: /^Publicar (la prueba|de todos modos)$/ }).click()
  await pagina.getByRole('button', { name: 'Sí, publicar' }).click()
}

esperandoRechazo = { enLaUrl: '/publicacion', estado: 400 }
await intentarPublicar()
const primerRechazo = await pagina
  .getByRole('alert')
  .first()
  .textContent({ timeout: 20000 })
  .catch(() => null)
comprobar(
  /universales/.test(primerRechazo ?? ''),
  `El primer rechazo debería hablar de las preguntas universales, que es lo primero que falla; dijo: ${primerRechazo}`,
)
await paso(`Publicar rechazado, y el motivo se lee: «${(primerRechazo ?? '').trim()}»`)

// 21 · Se devuelve la pregunta que faltaba y se vuelve a intentar: ahora toca la rúbrica.
await traerPregunta('UNIVERSAL')
await hastaQue(
  async () => (await laCuenta('Preguntas universales'))?.includes('ya está') === true,
  'Devuelta la octava universal, el balance sigue diciendo que falta',
)
await intentarPublicar()
await hastaQue(
  async () => /rúbrica/i.test((await pagina.getByRole('alert').first().textContent()) ?? ''),
  'El segundo rechazo no habla de la rúbrica, que es lo único que quedaba mal',
)
const textoSegundo = (await pagina.getByRole('alert').first().textContent().catch(() => '')) ?? ''
comprobar(
  /140/.test(textoSegundo),
  `El rechazo de la rúbrica no dice cuánto suma hoy, que es lo que la hace arreglable: ${textoSegundo}`,
)
await paso(`Arreglada la pregunta, el siguiente rechazo es el otro: «${textoSegundo.trim()}»`)

// 22 · Corregir un criterio para que la rúbrica sume 100.
const filaCuentas = bloque(RUBRICA).getByRole('listitem').filter({ hasText: 'CRITERIO_CUENTAS' }).first()
await filaCuentas.getByRole('button', { name: 'Corregir' }).click()
await escribir(bloque(RUBRICA), 'Cuántos puntos vale', '20')
await bloque(RUBRICA).getByRole('button', { name: 'Guardarlo' }).click()
await hastaQue(
  async () => (await laCuenta('La rúbrica, en puntos'))?.includes('ya está') === true,
  `Corregido el criterio a 20 puntos, la rúbrica no llega a 100: ${await laCuenta('La rúbrica, en puntos')}`,
)
/*
  ⚠️ **La explicación larga tiene que seguir ahí al volver a abrir el criterio.** Corregir
  manda el criterio ENTERO, así que si el listado no la devuelve el formulario se abre en
  blanco y guardar la borra sin decir nada. CRITERIO_ORDEN nació con explicación: se abre
  para mirarla y se deja como estaba.
*/
const filaOrden = bloque(RUBRICA).getByRole('listitem').filter({ hasText: 'CRITERIO_ORDEN' }).first()
await filaOrden.getByRole('button', { name: 'Corregir' }).click()
comprobar(
  (await leer(bloque(RUBRICA), 'La explicación larga, si hace falta')).includes('consecuencia concreta'),
  'Al corregir un criterio, su explicación larga se abre en blanco: guardarla así la borra sin avisar',
)
await bloque(RUBRICA).getByRole('button', { name: 'Dejarlo' }).click()
await paso('Corregido a 20: la rúbrica suma 100 y el balance queda entero en verde')

// 23 · El cambio inesperado: no hace falta para publicar, pero es una lista más y sus
//     tres endpoints tampoco se habían visto.
await bloque(VARIANTES).getByRole('button', { name: 'Escribir un cambio posible' }).click()
await escribir(
  bloque(VARIANTES),
  'Qué le pasa a mitad de la prueba',
  'El presupuesto se recorta a la mitad: ahora solo caben cuatro.',
)
await bloque(VARIANTES).getByRole('button', { name: 'Añadirlo' }).click()
await hastaQue(
  async () => (await bloque(VARIANTES).getByRole('listitem').filter({ hasText: 'se recorta' }).count()) > 0,
  'La variante del cambio inesperado no llegó a la lista',
)
await bloque(VARIANTES).getByRole('button', { name: 'Escribir un cambio posible' }).click()
await escribir(
  bloque(VARIANTES),
  'Qué le pasa a mitad de la prueba',
  'Se cae el techo de la sede norte: hay una solicitud nueva que no estaba en el listado.',
)
await bloque(VARIANTES).getByRole('button', { name: 'Añadirlo' }).click()
await hastaQue(
  async () => (await bloque(VARIANTES).getByRole('listitem').count()) === 2,
  'La segunda variante no llegó a la lista',
)
const laVariante = bloque(VARIANTES).getByRole('listitem').filter({ hasText: 'techo' }).first()
await laVariante.getByRole('button', { name: 'Corregir' }).click()
await escribir(
  bloque(VARIANTES),
  'Qué le pasa a mitad de la prueba',
  'Se cae el techo de la sede norte: entra una solicitud urgente que no estaba en el listado.',
)
await bloque(VARIANTES).getByRole('button', { name: 'Guardarlo' }).click()
await hastaQue(
  async () => (await bloque(VARIANTES).getByRole('listitem').filter({ hasText: 'urgente' }).count()) > 0,
  'Corregir la variante no cambió lo que se ve',
)
await paso('Dos formas posibles del cambio inesperado, y una corregida')

// 24 · Y ahora sí.
await intentarPublicar()
await pagina
  .getByText('Esta versión ya está publicada')
  .waitFor({ timeout: 25000 })
  .catch(async () => {
    throw new Error(`No se publicó: ${(await queja()) || '(sin mensaje)'}`)
  })
esperandoRechazo = null
comprobar(
  (await bloque(BALANCE).count()) === 0,
  'Publicada, la pantalla sigue ofreciendo publicar',
)
comprobar(
  (await pagina.getByRole('button', { name: 'Añadir un criterio' }).count()) === 0,
  'Publicada, la rúbrica sigue dejando añadir criterios: una publicada se congela',
)
comprobar(
  (await pagina.getByRole('button', { name: 'Guardar estos datos' }).count()) === 0,
  'Publicada, los datos siguen dejando guardarse',
)
await paso('Publicada: se congela entera, y no hay «despublicar»')

// ============================================================
// Una versión en borrador que NO debe salir en ninguna vacante
// ============================================================

await pagina.getByRole('link', { name: 'Todas las pruebas' }).click()
await pagina.getByRole('heading', { name: 'Pruebas del puesto.' }).waitFor({ timeout: 20000 })
const laPlantillaOtraVez = pagina.getByRole('listitem').filter({ hasText: NOMBRE }).first()
await hastaQue(
  async () => (await laPlantillaOtraVez.getByText('PUBLICADA').count()) > 0,
  'La lista de pruebas no se enteró de que la v1 se publicó',
)
await laPlantillaOtraVez.getByRole('button', { name: 'Empezar una versión nueva' }).click()
await hastaQue(
  async () => (await laPlantillaOtraVez.getByText('BORRADOR').count()) > 0,
  'No se pudo abrir una v2 en borrador sobre la publicada',
)
await paso('Sobre la publicada nace una v2 en borrador: la v1 no se toca')

// ============================================================
// La vacante: qué se ofrece de verdad en el desplegable
// ============================================================

/*
 * El desplegable «Qué prueba del puesto rendirá» adivinaba ids por fuerza bruta hasta
 * ayer: pedía versiones de ocho en ocho hasta dar con un hueco. Ahora pregunta plantilla
 * por plantilla al listado de versiones, que es lo que además le trae el estado — y con el
 * estado puede dejar fuera los borradores, que el backend rechaza con un 409.
 */
await pagina.getByRole('link', { name: 'Vacantes', exact: true }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 20000 })
const filaDeLaVacante = pagina.locator('tr', { hasText: VACANTE }).first()
await filaDeLaVacante.waitFor({ timeout: 20000 }).catch(() => {
  throw new Error(
    `No hay ninguna vacante llamada «${VACANTE}» en la que mirar el desplegable. ` +
      'Se elige con la variable VACANTE, y tiene que rendir la prueba del puesto.',
  )
})
await filaDeLaVacante.getByRole('link').first().click()
await pagina.getByRole('heading', { name: VACANTE }).waitFor({ timeout: 20000 })

const elDesplegable = campo(pagina, 'Qué prueba del puesto rendirá').locator('select')
await elDesplegable.waitFor({ timeout: 20000 })
await hastaQue(
  async () => !(await elDesplegable.isDisabled()),
  'El desplegable de la prueba del puesto se quedó buscando para siempre',
)
const loQueOfrece = await elDesplegable.locator('option').allTextContents()
console.log(`   · ofrece: ${loQueOfrece.map((t) => t.trim()).join(' | ')}`)
comprobar(
  loQueOfrece.some((t) => t.includes(`${NOMBRE} · v1`)),
  `La versión recién publicada no sale en el desplegable de la vacante. Ofrece: ${loQueOfrece.join(' | ')}`,
)
comprobar(
  !loQueOfrece.some((t) => t.includes(`${NOMBRE} · v2`)),
  'El desplegable ofrece la v2, que está en borrador: el backend la rechazaría con un 409',
)
await paso('La v1 publicada se ofrece en la vacante; la v2 en borrador, no')

} catch (causa) {
  fallos.push(`se cortó · ${causa instanceof Error ? causa.message.split('\n')[0] : causa}`)
  await pagina.screenshot({ path: 'capturas/e2e-cp-fallo.png', fullPage: true }).catch(() => {})
}

resumir()
console.log('\nEl navegador queda abierto. Ciérralo cuando termines de mirar.')
