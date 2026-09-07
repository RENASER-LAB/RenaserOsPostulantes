import { useState } from 'react'
import { descargarArchivo } from '../api/panel'
import estilos from './Vacante.module.css'

export function DescargarCv({ archivoId, nombre }: { archivoId: number; nombre: string }) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function descargar() {
    setDescargando(true)
    setError(null)
    try {
      const archivo = await descargarArchivo(archivoId)
      const url = URL.createObjectURL(archivo.contenido)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = archivo.nombre ?? nombre
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No pudimos descargar el currículum. Inténtalo de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      <button type="button" className={estilos.descargarCv} onClick={descargar}
        disabled={descargando} aria-label={`Descargar currículum: ${nombre}`}>
        {descargando ? 'Descargando…' : nombre}
      </button>
      {error && <span role="alert" className={estilos.errorCv}>{error}</span>}
    </>
  )
}
