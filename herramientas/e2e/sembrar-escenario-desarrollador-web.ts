/**
 * Deja en la base el escenario de «Desarrollador web»: el mismo que las
 * pruebas del ranking ponen encima del ranking real al interceptarlo.
 *
 *     export E2E_PG=… PGUSER=… PGDATABASE=… E2E_CLONE_ID=… E2E_API=… E2E_PORTAL=…
 *     npx vite-node herramientas/e2e/sembrar-escenario-desarrollador-web.ts
 *
 * Existe para medir la vía «sembrar la base» contra la vía «interceptar el
 * ranking» (ver `escenario-desarrollador-web.ts`; la medición del 25/09/2026,
 * en `docs/SUITE-E2E-CLASIFICACION-2026-09-25.md`, la ganó interceptar) y para
 * dejar el escenario puesto en una base propia. Después de correrlo, las
 * pruebas se lanzan con `E2E_ESCENARIO=base`. No se restaura solo: el escenario
 * se queda puesto.
 */

import { ESCENARIO, sembrarEscenarioEnBase } from './escenario-desarrollador-web'

const empezo = Date.now()
sembrarEscenarioEnBase()
for (const p of ESCENARIO) {
  const pretension = p.pretension ? `${p.pretension.min}–${p.pretension.max} ${p.pretension.moneda}` : 'sin pretensión'
  console.log(`  · ${p.nombre}: nota ${p.nota}, grupo ${p.grupo}, ${pretension}`)
}
console.log(`Listo en ${Date.now() - empezo} ms.`)
