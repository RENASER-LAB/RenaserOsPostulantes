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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
