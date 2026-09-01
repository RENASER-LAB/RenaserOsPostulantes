/**
 * El recorrido de la aplicacion instalada, con su limpieza.
 *
 * Maestro sabe recorrer la app, pero no sabe deshacer lo que la app escribio: el
 * recorrido **crea una cuenta de verdad** —es la unica forma de probar que la
 * sesion sobrevive a cerrar la aplicacion, que es la razon de ser de todo el
 * cambio de almacenamiento— y sin esto se iba acumulando una cuenta muerta en la
 * base local por cada ejecucion.
 *
 *   node herramientas/e2e-android.mjs
 *
 * Sigue la forma que tenía `e2e-simulacion-permisos.mjs` (hoy `herramientas/e2e/21-simulacion-permisos.spec.ts`): **devuelve la base como la
 * encontro, pase o falle**. La limpieza va en un `finally`, asi que tambien
 * corre si el recorrido revienta a mitad, que es justo cuando mas falta hace.
 *
 * ⚠️ **Espera un APK de `npm run build:emulador`**. Con el de `build:movil` esto
 * crearia —y luego intentaria borrar— una cuenta en la base de PRODUCCION.
 *
 * ⚠️ **La limpieza es local, por Docker.** Si el Postgres no esta en
 * `renaser-postgres`, se dice en voz alta en vez de callar: una limpieza que
 * falla en silencio es peor que no tenerla, porque nadie vuelve a mirar.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const MAESTRO = `${process.env.HOME}/.maestro/bin/maestro`
const RECORRIDO = 'herramientas/maestro/recorrido-candidato.yaml'
const LIMPIEZA = 'herramientas/limpiar-cuentas-de-maestro.sql'
const CONTENEDOR = 'renaser-postgres'
const BASE = 'renaser_db'

/** Distinto en cada pasada: el backend rechaza un correo repetido. */
const correo = `maestro.${Date.now()}@example.com`

function cuantasCuentasQuedan() {
  const salida = execFileSync(
    'docker',
    ['exec', CONTENEDOR, 'psql', '-U', 'postgres', '-d', BASE, '-t', '-c',
     "select count(*) from usuario where correo like 'maestro.%'"],
    { encoding: 'utf8' },
  )
  return Number(salida.trim())
}

function limpiar() {
  const sql = readFileSync(LIMPIEZA, 'utf8')
  execFileSync(
    'docker',
    ['exec', '-i', CONTENEDOR, 'psql', '-U', 'postgres', '-d', BASE],
    { input: sql, encoding: 'utf8' },
  )
}

console.log(`Cuenta de usar y tirar: ${correo}\n`)

let recorridoBien = false
try {
  const maestro = spawnSync(MAESTRO, ['test', RECORRIDO, '-e', `CORREO=${correo}`], {
    stdio: 'inherit',
  })
  recorridoBien = maestro.status === 0
} finally {
  // En el `finally` a proposito: si el recorrido revienta a mitad, la cuenta ya
  // esta creada y es justo cuando la limpieza hace falta.
  console.log('\nLimpiando lo que escribio el recorrido…')
  try {
    limpiar()
    const quedan = cuantasCuentasQuedan()
    if (quedan === 0) {
      console.log('La base queda como estaba: 0 cuentas de maestro.')
    } else {
      console.error(`⚠️ Quedan ${quedan} cuentas de maestro sin borrar. Míralas a mano.`)
    }
  } catch (fallo) {
    console.error('⚠️ NO se pudo limpiar. La cuenta sigue en la base local.')
    console.error(`   ${fallo.message.split('\n')[0]}`)
    console.error(`   A mano: docker exec -i ${CONTENEDOR} psql -U postgres -d ${BASE} < ${LIMPIEZA}`)
  }
}

process.exit(recorridoBien ? 0 : 1)
