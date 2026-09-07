/**
 * Lo que el servidor acepta en cada archivo del perfil, comprobado aquí antes
 * de mandarlo.
 *
 * El perfil deja subir cuatro archivos —la foto, la portada, el currículum y el
 * diploma de cada certificación— y cada uno tenía su propia comprobación
 * escrita a mano en su pantalla. Por eso no se comportaban igual: el diploma no
 * miraba el formato y prometía diez megas para una foto que el servidor corta
 * en dos, y el mismo error se decía con palabras distintas en cada sitio.
 *
 * ⚠️ **Las reglas son del backend, no de aquí.** Se copian a propósito para que
 * el aviso salga al instante en vez de después de subir el archivo entero, pero
 * quien manda es el servidor:
 *
 *   imagen  JPG, PNG o WebP, hasta 2 MB  → `TiposDeArchivo.exigirImagen`
 *   PDF     hasta 10 MB                  → el multipart de Spring
 *
 * ⚠️ **Un diploma puede ser las dos cosas** —un PDF o la foto del papel— y el
 * servidor decide por el tipo declarado (`ServicioArchivosDelPerfilImpl.guardarDiploma`
 * bifurca por `esImagen`, o sea por un `content-type` que empieza por `image/`).
 * Aquí se bifurca igual: mirar si está entre los formatos aceptados mandaría un
 * GIF por la rama del PDF y le contestaría con el mensaje equivocado.
 */

import type { QueryClient } from '@tanstack/react-query'

/**
 * Suelta las urls de blob cuando la **caché** suelta el dato, no cuando se
 * desmonta quien las pintaba.
 *
 * La foto, la portada y los diplomas se bajan en bytes —un `<img src>` no manda
 * el token— y se pintan con `URL.createObjectURL`. Esa url no es del componente
 * que la enseña: es del dato que vive en la caché de TanStack Query. Revocarla
 * al desmontar dejaba la consulta guardada apuntando a una url ya liberada, y
 * quien salía de «Mi perfil» y volvía antes de cinco minutos veía su foto rota
 * y la banda gris de portada que la pantalla no puede enseñar nunca.
 *
 * ⚠️ **Atarla al `removed` de la caché cubre los tres finales de una url y no
 * hay un cuarto:** el recolector se lleva la consulta pasado su `gcTime`, un
 * `removeQueries` la quita a mano, y `clear()` —el de cerrar sesión— se las
 * lleva todas. Volver a entrar dentro del `gcTime` reusa la url viva sin bajar
 * la imagen otra vez; pasado el plazo se vuelve a pedir, que es lo correcto.
 *
 * Lo único que NO pasa por aquí es sustituir una imagen por otra: ahí la url
 * vieja se cae del `state.data` sin que la consulta se vaya, así que la suelta
 * a mano quien sube la nueva (`renovarLaUrl`, en `Cabecera`).
 *
 * Se engancha una vez donde se crea el `QueryClient`, y por eso vive lo que
 * viva la aplicación.
 *
 * @returns la función que corta la suscripción.
 */
export function soltarUrlsDeArchivos(cache: QueryClient): () => void {
  return cache.getQueryCache().subscribe((evento) => {
    if (evento.type !== 'removed') return
    const dato = evento.query.state.data
    if (typeof dato === 'string' && dato.startsWith('blob:')) {
      URL.revokeObjectURL(dato)
    }
  })
}

/** `TiposDeArchivo.MAXIMO_IMAGEN`: dos megas para una foto. */
export const MAXIMO_IMAGEN = 2 * 1024 * 1024

/** Lo que corta un PDF: el `max-file-size` del multipart, no una regla propia. */
export const MAXIMO_DOCUMENTO = 10 * 1024 * 1024

/** `TiposDeArchivo.TIPOS_IMAGEN`. Ni GIF ni SVG, y no por descuido. */
export const FORMATOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

/** `TiposDeArchivo.EXTENSIONES`. El currículum se mira por extensión. */
export const FORMATOS_CV = ['.pdf', '.doc', '.docx']

/** `TiposDeArchivo.EXTENSIONES_IMAGEN`. Ojo: `.jfif` es un JPEG y NO está. */
const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp']

const extensionDe = (nombre: string) => nombre.slice(nombre.lastIndexOf('.')).toLowerCase()

/**
 * La foto, la portada y la foto de un diploma: los tres, la misma regla.
 *
 * @param comoSeLlama cómo se llama esa imagen en la pantalla, ya en mayúscula y
 *                    con su artículo: «La foto», «La portada».
 * @returns el aviso que hay que enseñar, o `null` si el archivo vale.
 */
export function revisarImagen(archivo: File, comoSeLlama: string): string | null {
  if (!FORMATOS_IMAGEN.includes(archivo.type)) {
    return `${comoSeLlama} tiene que ser JPG, PNG o WebP.`
  }
  if (archivo.size > MAXIMO_IMAGEN) {
    return `${comoSeLlama} no puede pesar más de 2 MB. Prueba a guardarla más pequeña.`
  }
  return null
}

/** El currículum: PDF o Word, hasta 10 MB. Se mira por extensión, como el backend. */
export function revisarCurriculum(archivo: File): string | null {
  if (!FORMATOS_CV.includes(extensionDe(archivo.name))) {
    return `«${archivo.name}» no es un PDF ni un Word. Conviértelo a PDF y vuelve a intentarlo.`
  }
  if (archivo.size > MAXIMO_DOCUMENTO) {
    return 'El archivo no puede pesar más de 10 MB.'
  }
  return null
}

/**
 * El diploma de una certificación: un PDF, o la foto del papel.
 *
 * ⚠️ **El tope depende de cuál de las dos sea**, y esa es toda la gracia: la
 * pantalla ofrecía diez megas para las dos y el servidor rechazaba la foto de
 * un diploma de tres —lo normal en un móvil— después de subirla entera.
 */
export function revisarDiploma(archivo: File): string | null {
  if (archivo.type.startsWith('image/')) {
    const reparo = revisarImagen(archivo, 'La foto del diploma')
    if (reparo) return reparo
    // ⚠️ **Aquí sí se mira la extensión, y en la foto y la portada no.** El
    // servidor exige que casen las dos —`TiposDeArchivo.exigirImagen`— y el
    // diploma se manda crudo, tal como salió del selector: un `.jfif`, que es
    // un JPEG de toda la vida y el que da Windows al guardar una imagen de la
    // web, pasa el tipo declarado y rebota por la extensión. La foto y la
    // portada no lo necesitan porque se redibujan en un lienzo y salen de aquí
    // llamándose `foto.jpg` y `portada.jpg`.
    if (!EXTENSIONES_IMAGEN.includes(extensionDe(archivo.name))) {
      return `«${archivo.name}» no acaba en .jpg, .jpeg, .png ni .webp. Guárdala con una de esas y vuelve a intentarlo.`
    }
    return null
  }
  if (archivo.type !== 'application/pdf') {
    return 'El diploma tiene que ser un PDF o una foto en JPG, PNG o WebP.'
  }
  if (archivo.size > MAXIMO_DOCUMENTO) {
    return 'El archivo no puede pesar más de 10 MB.'
  }
  return null
}
