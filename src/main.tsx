import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sembrarAlmacenNativo } from '@/api/almacenNativo'
import { App } from '@/app/App'
// La hoja global del mundo. Lo demas son CSS Modules, uno por pantalla, y las
// utilidades de Tailwind de las piezas de shadcn. La del portal anterior —`base.css`
// y sus `variables.css`— se borro cuando la ultima pantalla dejo de necesitarla.
import '@/estilos/mundo.css'
// Las piezas de shadcn/ui, desde el 01/10/2026. Sin preflight: no cambia nada que no las use.
import '@/estilos/tailwind.css'

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Falta el <div id="raiz"> en index.html')

// Los tokens se leen ANTES de montar, no despues.
//
// En la aplicacion instalada viven en el almacenamiento nativo, que es
// asincrono: si React montara primero, el primer render no sabria que hay
// sesion y rebotaria a la entrada a quien ya estaba dentro. En la web esta
// promesa se resuelve sin hacer nada y el montaje ocurre en el mismo instante
// que antes.
void sembrarAlmacenNativo().then(() => {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
