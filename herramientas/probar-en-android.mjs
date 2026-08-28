/**
 * Las cinco sondas que ninguna prueba de unidad puede hacer.
 *
 * En la aplicacion instalada las peticiones **no las hace la WebView**: las hace
 * Android, por `CapacitorHttp`, que reemplaza `window.fetch`. Esa capa es lo que
 * permite no pedirle CORS al backend, y es tambien lo que puede romper tres
 * cosas que este proyecto ya pago caro:
 *
 *   - la frontera del multipart, y con ella las TRES subidas de archivo,
 *   - la cabecera `Date`, de la que vive el cronometro de la prueba,
 *   - el `application/problem+json`, sin el cual todo error del backend enmudece.
 *
 * `Evaluacion.test.tsx` y compañia sustituyen `fetch` dentro de jsdom, donde
 * `CapacitorHttp` no existe: **pueden pasar en verde con el fallo dentro**. Por
 * eso esto se mira corriendo.
 *
 *   node herramientas/probar-en-android.mjs
 *
 * ⚠️ **Espera un APK compilado con `npm run build:emulador`**, que apunta al
 * Spring local. Con el de `build:movil` estas sondas irian contra la base de
 * PRODUCCION. La sonda 0 lo comprueba y se planta si no es asi.
 *
 * ⚠️ **No escribe en ninguna base.** El multipart no se prueba contra el
 * backend sino contra un servidor de eco que levanta este mismo guion y que
 * devuelve exactamente lo que le llego. Es lo unico que responde la pregunta
 * —¿sobrevive la frontera?— sin dejar una postulacion de mentira detras.
 */

import { createServer } from 'node:http'
import { _android as android } from 'playwright'

const PAQUETE = 'com.renaser.ex'
const BACKEND = 'http://10.0.2.2:8081/api/v1/portal'
const PUERTO_ECO = 8099

let bien = 0
let mal = 0

function comprobar(queSeEspera, condicion, detalle = '') {
  if (condicion) {
    bien += 1
    console.log(`  ✓ ${queSeEspera}`)
  } else {
    mal += 1
    console.log(`  ✗ ${queSeEspera}${detalle ? `\n      ${detalle}` : ''}`)
  }
}

/**
 * El servidor de eco del multipart.
 *
 * Devuelve el `Content-Type` con su frontera, el cuerpo crudo y que partes
 * encontro. Si `CapacitorHttp` estropea el multipart, se ve aqui y en ningun
 * otro sitio: el backend contestaria un 400 generico que no distingue «la
 * frontera esta mal» de «te falta un campo».
 */
function levantarElEco() {
  return new Promise((listo) => {
    const servidor = createServer((peticion, respuesta) => {
      const trozos = []
      peticion.on('data', (t) => trozos.push(t))
      peticion.on('end', () => {
        const cuerpo = Buffer.concat(trozos).toString('binary')
        const tipo = peticion.headers['content-type'] ?? ''
        const frontera = /boundary=(.+)$/.exec(tipo)?.[1] ?? null

        respuesta.writeHead(200, {
          'Content-Type': 'application/json',
          // El eco vive fuera de la app: sin esto, el `fetch` del navegador no
          // podria leerlo. Por la capa nativa daria igual — y esa diferencia es
          // justamente una de las cosas que se estan midiendo.
          'Access-Control-Allow-Origin': '*',
        })
        respuesta.end(
          JSON.stringify({
            tipo,
            frontera,
            bytes: cuerpo.length,
            // Las partes se cuentan por la frontera declarada. Si no cuadra,
            // el servidor de destino no encontraria ni el archivo ni los campos.
            partes: frontera ? cuerpo.split(`--${frontera}`).length - 2 : 0,
            traeElArchivo: cuerpo.includes('filename="curriculum.pdf"'),
            traeElTexto: cuerpo.includes('un resultado del que estoy orgulloso'),
            traeElContenido: cuerpo.includes('%PDF-1.4'),
          }),
        )
      })
    })
    servidor.listen(PUERTO_ECO, () => listo(servidor))
  })
}

const eco = await levantarElEco()
console.log(`Servidor de eco escuchando en el ${PUERTO_ECO}\n`)

const [dispositivo] = await android.devices()
if (!dispositivo) {
  console.error('No hay ningun dispositivo. Arranca el emulador y vuelve a intentarlo.')
  eco.close()
  process.exit(1)
}
console.log(`Dispositivo: ${dispositivo.model()} · ${dispositivo.serial()}\n`)

await dispositivo.shell(`am force-stop ${PAQUETE}`)
await dispositivo.shell(`am start -n ${PAQUETE}/.MainActivity`)

const webview = await dispositivo.webView({ pkg: PAQUETE })
const pagina = await webview.page()
await pagina.waitForLoadState('domcontentloaded')

// ---------------------------------------------------------------- sonda 0
console.log('0 · Se esta midiendo la aplicacion, no un navegador')

const entorno = await pagina.evaluate(() => ({
  esNativa: window.Capacitor?.isNativePlatform?.() === true,
  plataforma: window.Capacitor?.getPlatform?.() ?? null,
  // El `fetch` del navegador dice «[native code]»; el parcheado es JavaScript.
  fetchParcheado: !String(window.fetch).includes('[native code]'),
  origen: location.origin,
}))

comprobar('Capacitor dice que estamos en Android', entorno.esNativa && entorno.plataforma === 'android', JSON.stringify(entorno))
comprobar('`fetch` esta parcheado por la capa nativa', entorno.fetchParcheado, `window.fetch = ${entorno.plataforma}`)

// Sin esto, todo lo de abajo mediria el navegador y pasaria en verde sin probar
// nada. Es la sonda que hace que las otras signifiquen algo.
if (!entorno.esNativa || !entorno.fetchParcheado) {
  console.error('\n⚠️ No se esta ejecutando sobre la capa nativa. Las demas sondas no valdrian.')
  eco.close()
  await dispositivo.close()
  process.exit(1)
}

// ---------------------------------------------------------------- sonda 1
console.log('\n1 · La cabecera `Date` sobrevive (de ella vive el cronometro)')

const conLaHora = await pagina.evaluate(async (base) => {
  const r = await fetch(`${base}/vacantes`)
  return { estado: r.status, fecha: r.headers.get('Date'), tipo: r.headers.get('Content-Type') }
}, BACKEND)

comprobar('el backend local contesta', conLaHora.estado === 200, JSON.stringify(conLaHora))
comprobar(
  'llega la cabecera `Date` y es una fecha valida',
  Boolean(conLaHora.fecha) && !Number.isNaN(Date.parse(conLaHora.fecha ?? '')),
  `Date = ${conLaHora.fecha}`,
)

// ---------------------------------------------------------------- sonda 2
console.log('\n2 · Un `application/problem+json` llega con su explicacion')

const conElError = await pagina.evaluate(async (base) => {
  const r = await fetch(`${base}/vacantes/99999999`)
  const tipo = r.headers.get('Content-Type') ?? ''
  let cuerpo = null
  try {
    cuerpo = tipo.includes('json') ? await r.json() : await r.text()
  } catch {
    cuerpo = '<ilegible>'
  }
  return { estado: r.status, tipo, cuerpo }
}, BACKEND)

comprobar('responde 404', conElError.estado === 404, JSON.stringify(conElError))
comprobar(
  'el `Content-Type` conserva «json» — `leerCuerpo()` lo busca a secas',
  conElError.tipo.includes('json'),
  `Content-Type = ${conElError.tipo}`,
)
comprobar(
  'el cuerpo trae el `detail` de Spring, no un mensaje generico',
  typeof conElError.cuerpo === 'object' && Boolean(conElError.cuerpo?.detail),
  JSON.stringify(conElError.cuerpo),
)

// ---------------------------------------------------------------- sonda 3
console.log('\n3 · El multipart, que es el punto flojo conocido de esta capa')

const conElArchivo = await pagina.evaluate(async (puerto) => {
  // La misma forma exacta que `postular()` en `src/api/portal.ts`: un archivo
  // y cinco campos de texto en el mismo `FormData`, **sin cabecera de tipo** —
  // la pone quien envia, y esa frontera es lo que puede romperse.
  const pdf = new File([new Blob(['%PDF-1.4 currículum de prueba'])], 'curriculum.pdf', {
    type: 'application/pdf',
  })
  const formulario = new FormData()
  formulario.append('vacanteId', '1')
  formulario.append('cv', pdf)
  formulario.append('resultadoOrgulloso', 'un resultado del que estoy orgulloso')
  formulario.append('linkedin', 'https://linkedin.com/in/prueba')
  formulario.append('aceptaTratamiento', 'true')

  const r = await fetch(`http://10.0.2.2:${puerto}/eco`, { method: 'POST', body: formulario })
  return await r.json()
}, PUERTO_ECO)

comprobar(
  'el `Content-Type` llega como multipart y con su frontera',
  conElArchivo.tipo?.includes('multipart/form-data') && Boolean(conElArchivo.frontera),
  `Content-Type = ${conElArchivo.tipo}`,
)
comprobar('llegan las cinco partes', conElArchivo.partes === 5, `partes = ${conElArchivo.partes}`)
comprobar('el archivo conserva su nombre', conElArchivo.traeElArchivo === true)
comprobar('el archivo conserva su contenido', conElArchivo.traeElContenido === true)
comprobar('los campos de texto viajan con el', conElArchivo.traeElTexto === true)

// ---------------------------------------------------------------- sonda 4
console.log('\n4 · El token sobrevive a cerrar la aplicacion')

await pagina.evaluate(async () => {
  await window.Capacitor.Plugins.Preferences.set({
    key: 'renaser_portal_token',
    value: 'sonda-de-prueba',
  })
})

// ⚠️ `Preferences` escribe con `editor.apply()` —comprobado en el fuente del
// plugin—, que vuelve enseguida y termina de escribir a disco en otro hilo.
// `am force-stop` es un SIGKILL: sin este margen, la sonda mide la carrera
// entre las dos cosas y no lo que quiere medir, que es si el dato sobrevive.
// Con el margen, un fallo aqui si seria del producto.
await new Promise((sigue) => setTimeout(sigue, 1500))

await dispositivo.shell(`am force-stop ${PAQUETE}`)
await dispositivo.shell(`am start -n ${PAQUETE}/.MainActivity`)

const otraVista = await dispositivo.webView({ pkg: PAQUETE })
const otraPagina = await otraVista.page()
await otraPagina.waitForLoadState('domcontentloaded')

const guardado = await otraPagina.evaluate(async () => {
  const { value } = await window.Capacitor.Plugins.Preferences.get({ key: 'renaser_portal_token' })
  return { nativo: value, enElNavegador: localStorage.getItem('renaser_portal_token') }
})

comprobar(
  'el almacenamiento nativo lo conserva tras matar la app',
  guardado.nativo === 'sonda-de-prueba',
  JSON.stringify(guardado),
)
comprobar(
  'y NO se quedo tambien en `localStorage`, que es lo que se queria evitar',
  guardado.enElNavegador === null,
  `localStorage = ${guardado.enElNavegador}`,
)

// Se limpia lo unico que esta sonda escribio.
await otraPagina.evaluate(async () => {
  await window.Capacitor.Plugins.Preferences.remove({ key: 'renaser_portal_token' })
})

// ----------------------------------------------------------------- cierre
console.log(`\n${bien} bien · ${mal} mal`)
console.log(
  '\nLo que esto NO mira, y hay que mirar a ojo: el teclado tapando el campo activo,\n' +
    'el cronometro con la pantalla apagada, que se ve sin red, y el selector de\n' +
    'archivos de Android con un .docx.',
)

eco.close()
await dispositivo.close()
process.exit(mal === 0 ? 0 : 1)
