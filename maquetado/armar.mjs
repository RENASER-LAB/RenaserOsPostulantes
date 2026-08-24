// Envuelve cada cuerpo de wireframe (*.body.html) en el formato .dc.html,
// incrustando el CSS comun. Asi el CSS vive en un solo sitio mientras se
// itera el maquetado, y cada artboard sale autocontenido como pide el canvas.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const css = readFileSync('_base.css', 'utf8')
// La cabecera es la misma en casi todos: se escribe una vez y se sustituye aqui.
const cabecera = readFileSync('_cab.html', 'utf8').trimEnd()

for (const archivo of readdirSync('.').filter((f) => f.endsWith('.body.html'))) {
  const nombre = archivo.replace('.body.html', '')
  const cuerpo = readFileSync(archivo, 'utf8').trimEnd().replace('__CAB__', cabecera)
  writeFileSync(
    `${nombre}.dc.html`,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
${css.trimEnd()}
  </style>
</helmet>
${cuerpo}
</x-dc>
<script data-dc-script data-props='{}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`,
  )
  console.log(`  ${nombre}.dc.html`)
}
