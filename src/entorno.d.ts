/**
 * Las variables de entorno que el portal lee de verdad.
 *
 * `vite/client` ya declara `import.meta.env` con un indice suelto, asi que sin
 * esto un `VITE_ORIGEN_APIT` mal escrito compilaria igual y llegaria vacio a
 * produccion. Declarada aqui, el tipado la conoce por su nombre.
 */

interface ImportMetaEnv {
  /**
   * El origen del backend para la aplicacion instalada. **Vacio en la web**:
   * la ruta es relativa y la reescribe Vercel. Lo rellena `build:movil`.
   */
  readonly VITE_ORIGEN_API?: string
  /**
   * Abre la entrada de desarrollo de `/admin/entrar` en un paquete construido.
   *
   * En el servidor de desarrollo no hace falta: ahi manda `import.meta.env.DEV`.
   * Existe para quien levanta un **preview** —un build— y necesita esa puerta,
   * que es el caso de `13-etapas.spec.ts`. Vercel no la define, asi que en
   * produccion el bloque no llega a compilarse. Vale `'1'`; cualquier otra cosa
   * la deja cerrada.
   */
  readonly VITE_PUERTA_DESARROLLO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
