import { descargarArchivo, enlaceDeArchivo } from '@/panel/api/panel'

/**
 * Abre un archivo entregado en una pestaña nueva con su enlace firmado de siempre
 * (`/archivos/{id}/enlace`), desde el nombre del entregable en el visor de informes.
 *
 * ⚠️ **La pestaña se pide ANTES del `await`.** Después el navegador ya no la considera parte
 * del clic y la bloquea. Y se pide **sin** `noopener` en las opciones: con él `window.open`
 * devuelve `null` y no habría forma de llevarla al enlace; el `opener` se corta a mano, que
 * protege igual a esta pestaña de la que se abre.
 *
 * ⚠️ **En local el enlace firmado no abre** (`memoria://…`): se decide por el esquema, y lo que
 * no sea `http`/`https` cae a la descarga por el backend, el camino que funciona en los dos
 * entornos. Lanza si tampoco se pudo descargar, para que quien llama lo diga.
 */
export async function abrirArchivoEntregado(archivoId: number, nombre: string): Promise<void> {
  const ventana = window.open('', '_blank')
  if (ventana) ventana.opener = null
  try {
    const firmado = await enlaceDeArchivo(archivoId)
    if (/^https?:/i.test(firmado.url) && ventana) {
      ventana.location.href = firmado.url
      return
    }
  } catch {
    // Sin enlace firmado: se descarga por el backend, abajo.
  }
  ventana?.close()
  const archivo = await descargarArchivo(archivoId)
  const url = URL.createObjectURL(archivo.contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.nombre ?? nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Solo lo que un navegador abre sin riesgo: `http` y `https`. */
export function esWeb(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const leida = new URL(url)
    return leida.protocol === 'http:' || leida.protocol === 'https:'
  } catch {
    return false
  }
}
