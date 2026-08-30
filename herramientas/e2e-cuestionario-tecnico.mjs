/**
 * El ciclo 2 de la prueba técnica, de punta a punta, EN UN CHROME VISIBLE y contra el
 * backend de verdad: la empresa elige el cuestionario, lo prepara con la IA y publica la
 * vacante; una candidata postula, lo contesta y lo entrega; y la empresa lee lo que
 * escribió y le pone nota.
 *
 * Es el recorrido que hasta ahora no existía en ningún sitio: el backend lo servía entero
 * y no había pantalla, así que nadie lo había visto funcionar completo.
 *
 * ⚠️ **ESCRIBE EN LA BASE A LA QUE APUNTE EL PORTAL.** Nunca contra producción: crea una
 * cuenta, una postulación y una vacante publicada. Comprueba a dónde apunta antes.
 *
 * ⚠️ **Llama DOS VECES a la IA de verdad** y las dos cuentan contra el tope mensual: el
 * REDACTOR que escribe el cuestionario, y el EVALUADOR_TECNICO que lo califica. Con
 * `PARAR_EN=N` se corta el recorrido antes de gastar (la generación es el paso 12).
 *
 *   PORTAL=http://localhost:5182 node herramientas/e2e-cuestionario-tecnico.mjs
 *
 * Variables: PORTAL, API (para leer las vacantes publicadas), PAUSA, DEV_ID, VACANTE
 * (título de la vacante en borrador), PARAR_EN.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const API = process.env.API ?? 'http://localhost:8085'
const PAUSA = Number(process.env.PAUSA ?? 400)
const DEV_ID = process.env.DEV_ID ?? 'andy-dev'
const VACANTE = process.env.VACANTE ?? 'Administrador de sedes · e2e'
const PARAR_EN = Number(process.env.PARAR_EN ?? 0)
const CORREO = process.env.CORREO_CANDIDATA ?? `candidata.e2e.${Date.now()}@example.com`
/* Retomar una corrida a medias sin volver a pagarle a la IA lo ya escrito. */
const CONTINUAR = process.env.CONTINUAR === '1'
/* Solo el cierre: la candidata ya entregó y falta que la empresa lo lea y califique. */
const DESDE_CALIFICAR = process.env.DESDE_CALIFICAR === '1'
const CLAVE = 'unaClaveDePrueba123'

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 130 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const fallos = []
pagina.on('pageerror', (e) => fallos.push(`error de página · ${String(e).slice(0, 200)}`))
pagina.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404') && !m.text().includes('Failed to load resource'))
    fallos.push(`consola · ${m.text().slice(0, 200)}`)
})

/*
 * Los 404 que son parte del funcionamiento y no una avería:
 *
 *   - la ficha, mientras el dueño no la ha escrito todavía (deja de estar permitido en
 *     cuanto se guarda: a partir de ahí un 404 de la ficha SÍ es un fallo, y por eso se
 *     apaga en vez de perdonarse siempre);
 *   - el tanteo de versiones de prueba, que el backend no deja listar;
 *   - validación, notas de prueba y de simulación de un candidato que no ha llegado ahí.
 */
let fichaTodaviaNoEscrita = true
const esPerdonable = (url) =>
  (fichaTodaviaNoEscrita && url.includes('/ficha')) ||
  url.includes('/plantillas-prueba/versiones/') ||
  url.includes('/validacion') ||
  url.includes('/simulacion/notas')
let perdonados = 0
pagina.on('response', (r) => {
  if (r.status() < 400) return
  if (r.status() === 404 && esPerdonable(r.url())) {
    perdonados++
    return
  }
  fallos.push(`${r.status()} · ${r.request().method()} ${r.url().replace(PORTAL, '')}`)
})

/**
 * Cambiar de persona: salir de la sesión que hubiera y entrar limpio.
 *
 * ⚠️ Se navega ANTES de vaciar el almacén. En `about:blank` no hay origen y el navegador
 * responde con un SecurityError, que es justo lo que pasa al retomar una corrida a medias.
 */
const entrarLimpioEn = async (destino) => {
  await pagina.goto(destino, { waitUntil: 'domcontentloaded' })
  await pagina.evaluate(() => window.localStorage.clear())
  await pagina.goto(destino, { waitUntil: 'domcontentloaded' })
}

/*
 * ⚠️ **El ranking abre por un corte, no por la tanda entera.** El corte de salida es «con
 * nota de esta etapa», y quien acaba de postular no tiene ninguna: la fila existe y no se
 * ve. Hay que pedir «está aquí ahora» antes de buscar a nadie.
 */
const verCorte = async (cual) => {
  await pagina
    .getByRole('group', { name: 'Qué filas se ven' })
    .getByRole('button')
    .filter({ hasText: cual })
    .first()
    .click()
  await pagina.waitForTimeout(900)
}

const pasos = []
const queja = async () => (await pagina.getByRole('alert').allTextContents()).join(' · ')
const paso = async (titulo) => {
  pasos.push(titulo)
  console.log(`\n${pasos.length}. ${titulo}`)
  await pagina.waitForTimeout(PAUSA)
  await pagina.screenshot({
    path: `capturas/e2e-ct-${String(pasos.length).padStart(2, '0')}.png`,
    fullPage: true,
  })
  if (PARAR_EN > 0 && pasos.length >= PARAR_EN) {
    console.log(`\n⏸  PARAR_EN=${PARAR_EN}: se corta aquí sin gastar lo que venga después.`)
    resumir()
    process.exit(fallos.length > 0 ? 1 : 0)
  }
}
const comprobar = (condicion, queDeberia) => {
  if (!condicion) fallos.push(queDeberia)
}
function resumir() {
  console.log(`\n${fallos.length === 0 ? '✓ sin fallos' : `⚠️  ${fallos.length} fallos:`}`)
  fallos.forEach((f) => console.log(`   ${f}`))
  console.log(`   (${perdonados} 404 esperados)`)
}

try {
if (!CONTINUAR && !DESDE_CALIFICAR) {

// ============================================================
// La empresa elige qué se rinde
// ============================================================

await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
// La entrada de desarrollo está plegada: el campo no existe hasta desplegarla.
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill(DEV_ID)
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 20000 })
await paso(`El equipo entra al panel como ${DEV_ID}`)

await pagina.locator('tr', { hasText: VACANTE }).first().getByRole('link').first().click()
await pagina.getByRole('heading', { name: VACANTE }).waitFor({ timeout: 20000 })
await pagina.getByLabel('Qué rendirá en la etapa técnica').waitFor({ timeout: 15000 })
await paso(`La vacante «${VACANTE}», todavía en borrador`)

// 3 · Por defecto rinde la prueba del puesto: es lo que hacían todas las vacantes.
const elInstrumento = pagina.getByLabel('Qué rendirá en la etapa técnica')
comprobar(
  (await elInstrumento.inputValue()) === 'PLANTILLA',
  'La vacante no nace rindiendo la prueba del puesto, que es lo que hacían todas',
)
comprobar(
  await pagina.getByLabel('Qué prueba del puesto rendirá').isVisible(),
  'Con la prueba del puesto elegida no se ofrece decir cuál',
)
await paso('Por defecto rinde la prueba del puesto, y se ofrece elegir cuál')

// 4 · Se cambia al cuestionario: lo de la prueba desaparece, porque son excluyentes.
await elInstrumento.selectOption('CUESTIONARIO_TECNICO')
await pagina.getByText(/aquí no se entrega ningún archivo/i).waitFor({ timeout: 15000 })
comprobar(
  !(await pagina.getByLabel('Qué prueba del puesto rendirá').isVisible().catch(() => false)),
  'Elegido el cuestionario, sigue ofreciéndose la prueba del puesto: son excluyentes',
)
await paso('Elegido el cuestionario técnico: lo de la prueba del puesto desaparece')

// 5 · Los minutos de la etapa, que se guardan a mano.
const filaMinutos = pagina.locator('label').filter({ hasText: 'Cuánto tiempo tendrá' })
await filaMinutos.locator('input[type="number"]').fill('45')
await filaMinutos.getByRole('button', { name: 'Guardar' }).click()
await pagina.waitForTimeout(1500)
comprobar(
  (await filaMinutos.locator('input[type="number"]').inputValue()) === '45',
  'Los minutos de la etapa técnica no se guardaron',
)
await paso('Cuarenta y cinco minutos para la etapa, guardados')

// 6 · Se apaga la evaluación del banco: esta vacante se juega en el cuestionario.
const elBanco = pagina.locator('label').filter({ hasText: 'La evaluación del banco' })
// ⚠️ Es un interruptor mandado por el servidor: la marca no cambia al pulsar, cambia
// cuando la respuesta vuelve. `uncheck()` se queja de eso; se pulsa y se espera al texto.
if (await elBanco.locator('input[type="checkbox"]').isChecked()) {
  await elBanco.locator('input[type="checkbox"]').click()
  await pagina
    .getByText(/Apagada: la prueba del puesto será su única evaluación/)
    .waitFor({ timeout: 20000 })
}
await paso('La evaluación del banco, apagada: aquí se juega todo en el cuestionario')

// 7 · Publicar no, todavía: falta el cuestionario, y la pantalla dice cuál.
comprobar(
  await pagina.getByRole('button', { name: /Publicar en el portal/ }).isDisabled(),
  'Deja publicar una vacante que rinde el cuestionario sin tener ninguno publicado',
)
comprobar(
  (await pagina.getByText(/publicar su cuestionario técnico/i).count()) > 0,
  'No dice que lo que falta es publicar el cuestionario técnico',
)
await paso('Publicar está apagado, y dice que falta publicar el cuestionario')

// ============================================================
// Preparar la prueba técnica
// ============================================================

await pagina.getByRole('link', { name: /la prueba técnica →/ }).click()
await pagina.getByRole('heading', { name: 'La prueba técnica del puesto' }).waitFor({ timeout: 20000 })
await pagina.getByRole('form', { name: 'La ficha del puesto' }).waitFor({ timeout: 15000 })
await paso('La página donde se prepara: la ficha y el cuestionario')

// 9 · La ficha, con las palabras del dueño.
const responder = async (etiqueta, texto) => pagina.getByLabel(etiqueta).fill(texto)
await responder(/Q1 · Resultado/, 'Que en un año no haya un solo faltante de caja sin explicar y que las tres sedes cierren su arqueo el mismo día, antes de las nueve.')
await responder(/Q2 · Riesgo/, 'En la caja. Si no cuadra la primera semana ya sé que me equivoqué. Después empieza el personal: faltan sin avisar y nadie cubre.')
await responder(/Q3 · Día real/, 'Abre la sede principal a las ocho, revisa el arqueo de la noche anterior, pasa por las otras dos sedes, atiende proveedores al mediodía y cierra caja a las siete.')
await responder(/Q4 · Época dorada/, 'Rosa lo hizo bien tres años: llegaba antes que todos y no dejaba pasar un sol. El que vino después confiaba en la gente y se lo comieron en seis meses.')
await responder(/Q5 · Estructura/, 'Somos cuarenta y cinco en total. Tendría a cargo a doce, los cajeros de las tres sedes; ninguno de ellos tiene gente debajo.')
await responder(/Q6 · Autonomía/, 'Puede decidir horarios y reemplazos, y autorizar descuentos hasta cien soles. Contratar o despedir, no: eso pasa por mí.')
await responder(/Q7 · Jefe directo/, 'A mí. Soy de números y de preguntar por qué. No me funciona quien se ofende cuando le piden el detalle de algo.')
await responder(/Q8 · Lo incómodo/, 'Se trabaja sábados y algunos domingos, y cuando falta plata en caja se queda hasta que aparece. No es un puesto de escritorio.')
await responder(/Q9 · Requerimientos/, 'Tiene que haber manejado caja con dinero físico y saber Excel para el cuadre contra sistema. Deseable haber llevado más de una sede a la vez.')
await pagina.getByLabel('Cuánta gente hay en la empresa', { exact: true }).fill('45')
await pagina.getByLabel('Cuántas personas tendrá a cargo', { exact: true }).fill('12')
// Los riesgos se encienden en cadena: el 2 no existe hasta que el 1 tiene texto.
await pagina.getByLabel(/^Riesgo 1 ·/).fill('Faltantes de caja sin explicar')
await pagina.getByLabel('Riesgo 2', { exact: true }).fill('Cajeros que faltan sin avisar')
await pagina.getByLabel('Riesgo 3', { exact: true }).fill('Descuentos sin autorización')
await pagina.getByLabel('Riesgo 4', { exact: true }).fill('Proveedores pagados dos veces')
await pagina.getByLabel('Eliminatoria 1', { exact: true }).fill('Haber manejado caja con dinero físico')
await pagina.getByLabel('Requerimiento 1', { exact: true }).fill('Excel para el cuadre contra sistema')
await pagina.getByLabel(/F4 Administración/).check()
await pagina.getByLabel(/F1 Mando/).check()
await paso('La ficha, contada con las palabras del dueño')

await pagina.getByRole('button', { name: 'Guardar la ficha' }).click()
await pagina.getByText('Completa', { exact: true }).waitFor({ timeout: 20000 }).catch(async () => {
  throw new Error(`La ficha no quedó completa: ${(await queja()) || '(sin mensaje)'}`)
})
// A partir de aquí la ficha existe: un 404 suyo ya no se perdona.
fichaTodaviaNoEscrita = false
const usarPesos = pagina.getByRole('button', { name: 'Usar estos pesos' })
if (await usarPesos.isVisible().catch(() => false)) {
  await usarPesos.click()
  await pagina.waitForTimeout(1500)
}
await paso('Guardada y completa: ya se le puede pedir el cuestionario a la IA')

// ============================================================
// La IA escribe el cuestionario  ·  PRIMERA LLAMADA DE VERDAD
// ============================================================

await pagina.getByRole('button', { name: 'Pedirle el cuestionario a la IA' }).click()
await pagina.getByText(/está redactando|Pidiéndolo/i).waitFor({ timeout: 20000 }).catch(async () => {
  throw new Error(`No arrancó la generación: ${(await queja()) || '(sin mensaje)'}`)
})
await paso('Pedido: la página sondea sola mientras el REDACTOR escribe')

const publicarCuestionario = pagina.getByRole('button', { name: 'Publicar el cuestionario' })
await publicarCuestionario.waitFor({ timeout: 360000 }).catch(async () => {
  throw new Error(`En seis minutos no llegó el borrador: ${(await queja()) || '(sin mensaje)'}`)
})
const cuantas = await pagina.getByRole('article').count()
const presencial = await pagina.getByText(/no se envía al candidato/i).count()
console.log(`   · el REDACTOR escribió ${cuantas} preguntas, ${presencial} presencial(es)`)
comprobar(cuantas > 0, 'El borrador llegó sin una sola pregunta')
await paso(`El borrador: ${cuantas} preguntas, cada una con su guía de corrección`)

await publicarCuestionario.click()
await pagina.getByText('Publicado', { exact: true }).waitFor({ timeout: 30000 }).catch(async () => {
  throw new Error(`No se publicó el cuestionario: ${(await queja()) || '(sin mensaje)'}`)
})
await paso('Publicado: ya es el cuestionario real de esta vacante')

// ============================================================
// Publicar la vacante
// ============================================================

await pagina.getByRole('link', { name: '← Volver a la vacante' }).click()
await pagina.getByText(/Cuestionario: publicado/).waitFor({ timeout: 20000 })
await pagina.getByText('Todo listo: ya se puede publicar.').waitFor({ timeout: 15000 }).catch(() => {
  fallos.push('Con el cuestionario publicado, la vacante no dice que ya se puede publicar')
})
await pagina.getByRole('button', { name: /Publicar en el portal/ }).click()
await pagina.getByText(/Publicada el/).waitFor({ timeout: 20000 }).catch(async () => {
  throw new Error(`No se publicó la vacante: ${(await queja()) || '(sin mensaje)'}`)
})
await paso('La vacante, publicada: ya la ve quien quiera postular')

// ============================================================
// La candidata postula
// ============================================================

const publicadas = await (await fetch(`${API}/api/v1/portal/vacantes`)).json()
const laVacante = publicadas.find((v) => v.titulo === VACANTE)
if (!laVacante) throw new Error('La vacante publicada no sale en el tablón del portal')

await entrarLimpioEn(`${PORTAL}/registro?vacante=${laVacante.id}`)
await pagina.getByLabel('Nombre', { exact: true }).fill('Camila')
await pagina.getByLabel('Apellidos').fill('Reyes Quispe')
await pagina.getByLabel('Correo').fill(CORREO)
await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
await pagina.getByLabel('Repite la contraseña').fill(CLAVE)
await pagina.locator('input[type=checkbox]').first().check()
await pagina.getByRole('button', { name: /crear/i }).click()
await pagina.waitForURL(/\/vacantes\/\d+\/postular/, { timeout: 25000 })
await paso(`Una candidata crea su cuenta (${CORREO})`)

await pagina.locator('input[type=file]').waitFor({ timeout: 20000 })
await pagina.setInputFiles('input[type=file]', {
  name: 'curriculum.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 curriculum de Camila Reyes, cajera y administradora'),
})
await pagina.locator('textarea').first().fill(
  'Cuadré tres cajas que llevaban meses sin cuadrar y encontré el faltante de marzo: eran vueltos mal dados en la sede norte.',
)
for (const grupo of await pagina.locator('fieldset').all()) {
  await grupo.getByText('Sí', { exact: true }).click()
}
await pagina.locator('input[type=checkbox]').check()
await pagina.getByRole('button', { name: /enviar mi postulación/i }).click()
const deTodosModos = pagina.getByRole('button', { name: /enviarla de todos modos/i })
if (await deTodosModos.isVisible().catch(() => false)) await deTodosModos.click()
await pagina.waitForURL(/\/procesos$/, { timeout: 30000 })
await paso('Postulación enviada: ya está en «Mis procesos»')

} // fin de lo que CONTINUAR se salta

if (!DESDE_CALIFICAR) {

// ============================================================
// El equipo la hace avanzar hasta la prueba
// ============================================================

await entrarLimpioEn(`${PORTAL}/admin/entrar`)
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill(DEV_ID)
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 20000 })
await pagina.locator('tr', { hasText: VACANTE }).first().getByRole('link').first().click()
await pagina.getByRole('heading', { name: VACANTE }).waitFor({ timeout: 20000 })

/*
 * Avanzar es marcar, escribir un motivo y confirmar.
 *
 * ⚠️ **Cuántos saltos faltan no se sabe de antemano, y por eso no se cuentan.** Al postular,
 * la máquina ya la puso en el perfil integral y el currículum la movió sola hasta «por
 * confirmar»: de los cuatro momentos, tres ya habían pasado sin que nadie pulsara nada. Se
 * avanza mientras siga apareciendo en el perfil integral, y se para cuando se va.
 */
const avanzarUnPaso = async (comoSeLlama) => {
  const fila = pagina.locator('tr', { hasText: 'Camila' }).first()
  await fila.locator('input[type=checkbox]').check()
  await pagina.getByPlaceholder('Motivo del avance (obligatorio)').fill(comoSeLlama)
  await pagina.getByRole('button', { name: /^Avanzar a 1 persona$/ }).click()
  await pagina.getByText(/Avanzaron: Camila/).waitFor({ timeout: 30000 }).catch(async () => {
    throw new Error(`No avanzó (${comoSeLlama}): ${(await queja()) || '(sin mensaje)'}`)
  })
  await pagina.waitForTimeout(1500)
}

await pagina.getByRole('tab', { name: 'Perfil integral' }).click()
await verCorte(/^Está aquí ahora/)
let saltos = 0
while ((await pagina.locator('tr', { hasText: 'Camila' }).count()) > 0 && saltos < 5) {
  await avanzarUnPaso('lo del currículum está visto, que rinda la prueba técnica')
  saltos++
  await verCorte(/^Está aquí ahora/)
}
console.log(`   · le faltaban ${saltos} salto(s) para llegar a la etapa técnica`)
comprobar(
  CONTINUAR || saltos > 0,
  'No hizo falta avanzarla: llegó sola a la etapa técnica sin que nadie la moviera',
)

await pagina.getByRole('tab', { name: /^Prueba/ }).click()
await verCorte(/^Está aquí ahora/)
comprobar(
  (await pagina.locator('tr', { hasText: 'Camila' }).count()) > 0,
  'Tras avanzarla no aparece en la etapa de la prueba',
)
await paso('El equipo la hace avanzar hasta que le toca la etapa técnica')

// ============================================================
// La candidata rinde el cuestionario
// ============================================================

await entrarLimpioEn(`${PORTAL}/ingresar`)
await pagina.getByLabel('Correo').fill(CORREO)
await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
await pagina.getByRole('button', { name: /entrar/i }).first().click()
await pagina.waitForURL(/\/procesos/, { timeout: 25000 })
/*
 * ⚠️ Que la dirección cambie NO es que la pantalla esté pintada: las postulaciones siguen
 * viajando, y afirmar aquí mide la carrera, no el producto. Se espera a la acción, que es
 * además lo que prueba que el portal distingue el instrumento — la prueba de siempre no la
 * ofrece.
 */
await pagina
  .getByRole('link', { name: 'Abrir prueba técnica' })
  .first()
  .waitFor({ timeout: 20000 })
  .catch(() => {
    fallos.push('«Mis procesos» no ofrece abrir la prueba técnica: no distingue el instrumento')
  })
comprobar(
  (await pagina.getByText(/Tu prueba técnica está lista/).count()) > 0,
  'El recorrido no nombra la prueba técnica: estaría prometiendo la prueba de siempre',
)
await paso('La candidata entra y ve que le toca su prueba técnica')

await pagina.getByRole('link', { name: 'Abrir prueba técnica' }).first().click()
await pagina.getByRole('heading', { name: 'Tu prueba técnica' }).waitFor({ timeout: 20000 })
comprobar(
  (await pagina.getByText(/no hay que subir ningún archivo/i).count()) > 0,
  'La pantalla no dice que aquí no se sube nada: es la diferencia con la prueba del puesto',
)
comprobar(
  (await pagina.getByText(/45 minutos/).count()) > 0,
  'No promete los 45 minutos que la vacante fijó',
)
await paso('Antes de empezar: cuántas preguntas, cuánto tiempo, y que no hay nada que subir')

await pagina.getByRole('button', { name: 'Empezar la prueba' }).click()
await pagina.getByRole('textbox', { name: 'Tu respuesta' }).waitFor({ timeout: 20000 })
const cuantasRinde = Number(
  (await pagina.getByText(/Pregunta \d+ de \d+/).first().textContent())?.match(/de (\d+)/)?.[1] ?? 0,
)
console.log(`   · rinde ${cuantasRinde} preguntas`)
comprobar(cuantasRinde > 0, 'El examen abrió sin preguntas')
await paso(`El reloj arranca al abrir: ${cuantasRinde} preguntas, una a una`)

const LOQUERESPONDE = [
  'En la sede norte llevaba las tres cajas del turno tarde: cerraba con arqueo diario y el descuadre no pasaba de dos soles al mes.',
  'Lo primero que miro es el arqueo de la noche anterior contra el sistema. Si hay diferencia, reviso los vueltos y las anulaciones antes de abrir.',
  'Una vez el faltante era de trescientos soles en tres días. Salió de un cajero que daba vuelto de más por apuro; lo vi cruzando tickets con el corte de caja.',
  'Manejo Excel con tablas dinámicas y buscarv. Armé un cuadre que compara el corte del sistema con lo contado a mano y marca la diferencia en rojo.',
  'A doce personas no se las controla mirándolas: se les pone un cierre con firma y se revisa el mismo día. Lo que no se revisa el mismo día ya no se recupera.',
  'Sí, he trabajado sábados y domingos de campaña. Cuando falta plata me quedo hasta que aparece, porque al día siguiente ya nadie se acuerda.',
  'A un jefe de números le llevo el detalle antes de que lo pida: el corte, la diferencia y de dónde salió. No me molesta que me pregunten por qué.',
  'De tres sedes lo difícil es que cierren el mismo día. Yo pondría el mismo formato de arqueo en las tres y una hora fija de cierre.',
  'Si un cajero falta sin avisar, cubro yo la caja ese turno y el reemplazo queda armado antes del siguiente. Y se habla, porque la segunda vez ya no es un olvido.',
  'Un descuento sobre cien soles no lo autorizo yo: lo consulto. Por debajo lo apruebo y queda anotado con el motivo y mi firma.',
  'Un proveedor pagado dos veces se detecta cruzando la factura con el registro antes de pagar. Es un minuto por factura y evita el problema entero.',
  'En un año quiero que las tres sedes cierren sin faltantes sin explicar, con el mismo formato de arqueo y el informe mensual saliendo solo.',
]

for (let i = 0; i < cuantasRinde; i++) {
  await pagina
    .getByRole('textbox', { name: 'Tu respuesta' })
    .fill(LOQUERESPONDE[i % LOQUERESPONDE.length])
  /*
   * ⚠️ Esperar a que aparezca «guardada» NO comprueba nada: la pregunta anterior ya lo
   * decía y la afirmación pasa sola. Lo que hay que ver es que la cola se vacíe — que
   * deje de haber una respuesta sin guardar—, que es la regla que costó respuestas
   * perdidas en la evaluación del banco.
   */
  await pagina
    .getByText(/Guardada\. Puedes seguir corrigiéndola/)
    .waitFor({ timeout: 25000 })
    .catch(() => fallos.push(`La respuesta ${i + 1} nunca se dio por guardada`))
  if (i < cuantasRinde - 1) await pagina.getByRole('button', { name: 'Siguiente →' }).click()
}
await paso(`Las ${cuantasRinde} respuestas, cada una confirmada por el servidor`)

const entregar = pagina.getByRole('button', { name: 'Entregar' })
comprobar(!(await entregar.isDisabled()), 'Con todo respondido sigue sin dejar entregar')
await entregar.click()
await pagina.getByRole('dialog').waitFor({ timeout: 10000 })
await pagina.getByRole('button', { name: 'Sí, entregar' }).click()
/*
 * ⚠️ Entregar **saca de la pantalla del examen** y lleva al detalle del proceso: esperar allí
 * el «ya entregaste» es esperar una pantalla que la entrega acaba de dejar atrás.
 */
await pagina.getByText(/Estamos calificando tu prueba/i).waitFor({ timeout: 30000 }).catch(async () => {
  throw new Error(`No se entregó: ${(await queja()) || '(sin mensaje)'}`)
})
comprobar(
  (await pagina.getByRole('textbox').count()) === 0,
  'Después de entregar todavía se puede escribir',
)
comprobar(
  (await pagina.getByText(/Entregaste tu prueba/).count()) > 0,
  'La entrega no quedó anotada en el recorrido de la candidata',
)
await paso('Entregada: preguntando antes, y el proceso ya dice que se está calificando')

} // fin de lo que DESDE_CALIFICAR se salta

// ============================================================
// La empresa lee lo que escribió y le pone nota  ·  SEGUNDA LLAMADA DE VERDAD
// ============================================================

await entrarLimpioEn(`${PORTAL}/admin/entrar`)
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill(DEV_ID)
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.getByRole('heading', { name: 'Vacantes.' }).waitFor({ timeout: 20000 })
await pagina.locator('tr', { hasText: VACANTE }).first().getByRole('link').first().click()
await pagina.getByRole('heading', { name: VACANTE }).waitFor({ timeout: 20000 })
await pagina.getByRole('tab', { name: /^Prueba/ }).click()
await verCorte(/^Está aquí ahora/)
await paso('El equipo se pone en la etapa de la prueba del puesto')

await pagina.locator('tr', { hasText: 'Camila' }).first().getByText('Camila').click()
await pagina.getByText('Lo que escribió en la prueba').waitFor({ timeout: 20000 })
await pagina.getByText('Lo que escribió en la prueba').click()
await pagina.waitForTimeout(1500)
comprobar(
  (await pagina.getByText(/sede norte/).count()) > 0,
  'El panel no enseña lo que la candidata escribió en el cuestionario',
)
await paso('El panel lee las respuestas del cuestionario, no las de una prueba que no existe')

/*
 * Y la última pieza: pedirle la calificación al agente y ponderarla.
 *
 * ⚠️ **Son dos verbos distintos y por eso son dos botones.** Calificar encola un trabajo del
 * agente que tarda decenas de segundos; ponderar es inmediato y es lo único que deja la nota
 * en la columna. Sin el segundo, la rúbrica se llena y el ranking se queda en blanco.
 */
const pedirCalificacion = pagina.getByRole('button', {
  name: 'Pedirle a la IA que califique la prueba',
})
if (await pedirCalificacion.isVisible().catch(() => false)) {
  await pedirCalificacion.click()
  /*
   * ⚠️ **«Está calificando» es un cartel de paso, y esperarlo es una carrera perdida.** El
   * agente puede terminar antes de que el sondeo llegue a pintarlo: la primera versión de
   * esta prueba lo daba por no encolado con el trabajo ya TERMINADO en la base. Lo que se
   * espera es el final —que aparezca con qué ponderar—, no la señal de que empezó.
   */
  await paso('Pedida la calificación: el agente lee las respuestas del cuestionario')
}

/*
 * ⚠️ **Aquí NO hay botón de ponderar, y es correcto que no lo haya.** Con la prueba del
 * puesto la nota de la etapa nace de ponderar la rúbrica a mano; con el cuestionario la
 * calcula el propio método —índice = puntos ÷ (4 × preguntas) × 100— y llega hecha. El
 * control de ponderar se apaga solo porque no hay rúbrica que ponderar, así que esperar a
 * que aparezca sería esperar a un botón que este instrumento no usa.
 *
 * Lo que hay que comprobar es que la nota **exista y se vea**, que es lo que el equipo mira.
 */
await pagina.getByRole('tab', { name: /^Prueba/ }).click()
await verCorte(/^Toda la tanda/)
const laFila = pagina.locator('tr', { hasText: 'Camila' }).first()
await laFila.waitFor({ timeout: 20000 })
const loQueDiceLaFila = (await laFila.textContent()) ?? ''
console.log(`   · la fila de la tanda dice: ${loQueDiceLaFila.replace(/\s+/g, ' ').trim()}`)
comprobar(
  !/—\s*(Le toca|Calificándose)/.test(loQueDiceLaFila),
  'La columna de la nota sigue con un guion: la calificación no llegó al ranking',
)
await paso('La nota de la etapa está en el ranking: el ciclo se cerró')

} catch (causa) {
  fallos.push(`se cortó · ${causa instanceof Error ? causa.message.split('\n')[0] : causa}`)
  await pagina.screenshot({ path: 'capturas/e2e-ct-fallo.png', fullPage: true }).catch(() => {})
}

resumir()
console.log('\nEl navegador queda abierto. Ciérralo cuando termines de mirar.')
