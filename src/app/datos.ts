/**
 * El cliente de datos del portal: la caché de TanStack Query, ya cableada.
 *
 * ⚠️ **Está aparte de `App` para que se pueda crear igual en una prueba.**
 * Mientras el `new QueryClient(...)` y su cableado vivían sueltos dentro de
 * `App.tsx`, cualquier prueba se hacía su propio cliente a mano y quitar el
 * cableado de verdad no rompía nada: los 598 tests seguían en verde con la
 * suscripción anulada. Aquí hay un solo sitio donde se monta, y es el que se
 * prueba.
 */

import { QueryClient } from '@tanstack/react-query'
import { ErrorApi } from '@/api/cliente'
import { soltarUrlsDeArchivos } from '@/paginas/perfil/archivos'

export function crearClienteDeDatos(): QueryClient {
  const datos = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,

        // Insistir con un 401 o un 404 no arregla nada: o no hay sesion, o no es
        // suyo. Los demas fallos si se reintentan.
        retry: (intentos, causa) =>
          causa instanceof ErrorApi && (causa.esSesionCaida || causa.esAjeno)
            ? false
            : intentos < 2,

        // Al leer se intenta siempre. Por defecto la libreria deja la peticion
        // «en pausa» cuando cree que no hay red, y la pantalla se queda girando
        // sin decir nada; `api/cliente.ts` ya convierte un fallo de conexion en
        // un error con su mensaje, y eso se puede enseñar.
        networkMode: 'always',
      },

      mutations: {
        /*
          ⚠️ **Al escribir tambien se intenta siempre, y esto cambio.**

          Antes se dejaba el modo de fabrica —`online`— con un argumento razonable: sin red,
          la libreria deja la mutacion «en pausa» y la reintenta sola al volver, y para el
          guardado automatico de una respuesta a media evaluacion guardar tarde es mejor que
          fallar. El argumento dejo de valer cuando `useColaDeRespuestas` se quedo con esa
          responsabilidad, y **hace lo mismo mejor**: reintenta con espera creciente y ademas
          apunta lo pendiente en el navegador, asi que sobrevive a recargar y a cerrar la
          pestaña —cosa que una mutacion en pausa no hace—.

          Con las dos a la vez, la pausa de la libreria se tragaba el rechazo: la cola nunca
          se enteraba de que no habia llegado, no reintentaba, y `vaciar()` —que espera a que
          la cola quede limpia antes de entregar— **no resolvia nunca**. El candidato sin red
          se quedaba con «Entregar» en «Guardando…» y deshabilitado, sin nada que lo
          explicara y con el plazo corriendo.

          Intentandolo siempre, un corte de red es un rechazo normal: la cola lo ve, lo apunta
          y lo reintenta ella.
        */
        networkMode: 'always',
      },
    },
  })

  /*
    Las urls de blob de los archivos del perfil se sueltan cuando la caché
    suelta su dato.

    ⚠️ **Va aquí y no en la pantalla que las pinta**, y es lo que arregla la
    foto rota al volver a «Mi perfil»: la url la crea la consulta y la enseña
    quien la tenga montada, así que atarla a un componente la mataba antes de
    tiempo — y atarla a nada la dejaba viva para siempre. Aquí vive lo mismo que
    el cliente. Ver `paginas/perfil/archivos`.
  */
  soltarUrlsDeArchivos(datos)

  return datos
}
