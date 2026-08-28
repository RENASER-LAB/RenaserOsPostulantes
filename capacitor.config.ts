/**
 * La caparazon nativa del portal.
 *
 * Aqui no vive ni una pantalla: la aplicacion **es el mismo `src/`** de la web,
 * compilado por Vite y copiado dentro de `android/` por `npx cap sync`. Este
 * archivo solo dice como se llama, que carpeta se empaqueta y como habla con el
 * backend.
 *
 * ⚠️ **`appId` es permanente.** Publicada la aplicacion, ese texto *es* la
 * aplicacion: cambiarlo crea otra distinta, con ficha nueva, valoraciones desde
 * cero, y deja a los instalados en la vieja. Se comprobo libre en Play antes de
 * generar `android/`.
 */

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.renaser.ex',
  appName: 'EX',
  webDir: 'dist',

  plugins: {
    /**
     * Las peticiones las hace Android, no la WebView.
     *
     * Es lo que permite **no pedirle CORS al backend**: una peticion nativa no
     * tiene origen, asi que no hay comprobacion que superar. La regla de
     * `CLAUDE.md` —no abrir el backend a otros origenes— queda intacta sin
     * tocar Spring.
     *
     * ⚠️ Parchea `fetch` globalmente, y de ahi salen las dos guardias de
     * `puerta.test.ts`: que la cabecera `Date` siga llegando (el cronometro de
     * la prueba vive de ella) y que un `application/problem+json` se siga
     * leyendo (sin eso, todo error del backend vuelve a ser mudo).
     */
    CapacitorHttp: { enabled: true },
  },
}

export default config
