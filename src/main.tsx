import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sembrarAlmacenNativo } from '@/api/almacenNativo'
import { App } from '@/app/App'
// La unica hoja global que queda. Todo lo demas son CSS Modules, uno por
// pantalla. La del portal anterior —`base.css` y sus `variables.css`— se borro
// cuando la ultima pantalla dejo de necesitarla.
import '@/estilos/mundo.css'

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
