import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/estilos/base.css'

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Falta el <div id="raiz"> en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
