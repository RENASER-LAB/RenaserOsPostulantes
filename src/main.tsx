import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
// La unica hoja global que queda. Todo lo demas son CSS Modules, uno por
// pantalla. La del portal anterior —`base.css` y sus `variables.css`— se borro
// cuando la ultima pantalla dejo de necesitarla.
import '@/estilos/mundo.css'

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Falta el <div id="raiz"> en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
