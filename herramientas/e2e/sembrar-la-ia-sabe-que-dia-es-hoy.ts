/**
 * Deja a la vista de la revisión humana la vacante de la QA de la spec la-ia-sabe-que-dia-es-hoy,
 * con la marca `REV-FECHA-87` (la suite usa `QA-FECHA-87` y su limpieza no la toca). Imprime los
 * ids y los correos, que son lo que pide la retirada:
 *
 *   npx vite-node herramientas/e2e/sembrar-la-ia-sabe-que-dia-es-hoy.ts
 *   npx vite-node herramientas/e2e/sembrar-la-ia-sabe-que-dia-es-hoy.ts -- --retirar correo1 correo2 …
 */
import { tokenDePanel } from './ayuda-preguntas-propias'
import { retirarLoDeLaFecha, sembrarLaFecha } from './ayuda-la-ia-sabe-que-dia-es-hoy'

const MARCA_REVISION = 'REV-FECHA-87'

async function principal() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  if (args[0] === '--retirar') {
    retirarLoDeLaFecha(args.slice(1), MARCA_REVISION)
    console.log('Retirado lo de', MARCA_REVISION)
    return
  }
  const correos: string[] = []
  const e = await sembrarLaFecha(await tokenDePanel(), correos, MARCA_REVISION)
  const ids = Object.fromEntries(
    (['robert', 'mayra', 'ruth', 'tania', 'teo', 'ximena', 'alex', 'nora', 'cesar'] as const).map((k) => [k, e[k].postulacion]),
  )
  console.log(JSON.stringify({
    vacante: e.vacante,
    vacanteCerrada: e.vacanteCerrada,
    maria: e.informes.maria.postulacion,
    ...ids,
    sinCv: e.sinCv,
    sinEntregables: e.sinEntregables,
    correos,
  }, null, 2))
}

void principal()
