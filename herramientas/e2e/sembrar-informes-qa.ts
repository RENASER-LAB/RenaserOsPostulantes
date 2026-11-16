/**
 * Deja a la vista de la revisión humana la vacante de la QA de los informes por etapa, con la
 * marca `REV-INF-84` (la suite usa `QA-INF-84` y su limpieza no la toca). Imprime los ids y
 * los correos, que son lo que pide la retirada:
 *
 *   npx vite-node herramientas/e2e/sembrar-informes-qa.ts
 *   npx vite-node herramientas/e2e/sembrar-informes-qa.ts -- --retirar correo1 correo2 …
 */
import { tokenDePanel } from './ayuda-preguntas-propias'
import { retirarLoDeLaQa, sembrarInformes } from './ayuda-informes-qa'

const MARCA_REVISION = 'REV-INF-84'

async function principal() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  if (args[0] === '--retirar') {
    retirarLoDeLaQa(args.slice(1), MARCA_REVISION)
    console.log('Retirado lo de', MARCA_REVISION)
    return
  }
  const correos: string[] = []
  const e = await sembrarInformes(await tokenDePanel(), correos, MARCA_REVISION)
  console.log(JSON.stringify({
    vacante: e.vacante,
    titulo: e.titulo,
    maria: e.maria.postulacion,
    bruno: e.bruno.postulacion,
    carla: e.carla.postulacion,
    sinRespuestas: e.sinRespuestas,
    sinEmbudo: e.sinEmbudo,
    correos,
  }, null, 2))
}

void principal()
