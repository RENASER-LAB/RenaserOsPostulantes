/**
 * El catálogo de ciudades, repartido por departamento.
 *
 * Lo usan el registro del candidato y el formulario de vacante del panel: son las
 * mismas ciudades, agrupadas igual, y la regla vive una sola vez.
 *
 * ⚠️ **`EXT` no tiene departamento y sale aparte.** Metido en un `<optgroup>`
 * con `label={null}` el navegador pinta un grupo llamado «null»; y colgándolo de
 * un departamento inventado diría que el extranjero está en algún sitio del
 * Perú. Va suelto al final, que es donde se busca.
 *
 * El catálogo llega ya ordenado por departamento y nombre, así que aquí no se
 * reordena nada: solo se agrupa respetando el orden de llegada.
 */

import type { OpcionUbigeo } from '@/api/tipos'

export function agrupadasPorDepartamento(
  opciones: OpcionUbigeo[],
): { departamentos: [string, OpcionUbigeo[]][]; sueltas: OpcionUbigeo[] } {
  const departamentos = new Map<string, OpcionUbigeo[]>()
  const sueltas: OpcionUbigeo[] = []
  for (const opcion of opciones) {
    if (opcion.departamento == null) {
      sueltas.push(opcion)
      continue
    }
    const ya = departamentos.get(opcion.departamento)
    if (ya) ya.push(opcion)
    else departamentos.set(opcion.departamento, [opcion])
  }
  return { departamentos: [...departamentos.entries()], sueltas }
}
