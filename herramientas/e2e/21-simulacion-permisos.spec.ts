import { expect, test } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { apiPanel, detalleDe } from './ayuda-configuracion'

/**
 * Las dos piezas de Configuración que hablan con el backend de verdad: quién
 * eligió cada fecha de simulación, y qué puede cada rol.
 *
 * `01-regresion-panel` ya comprueba que Simulación y Configuración abren sin
 * error; aquí se ejercita el ciclo: el contrato de los inscritos, marcar la
 * asistencia, cambiar el alcance de un permiso y el candado del último
 * administrador.
 *
 * ⚠️ **Esto ESCRIBE en la base.** Cambia el alcance de un permiso y, si hay
 * alguien inscrito sin lista pasada, marca que vino. El permiso se devuelve a
 * como estaba al terminar, pase o falle; la asistencia queda como la dejó el
 * backend, porque marcar «vino» no tiene vuelta desde la API.
 *
 * Por qué existe, y qué encontró: las fixturas de `capturar-panel.mjs` traían
 * una fila con `asistio: false`, un estado que **esta ruta nunca devuelve** —
 * marcar la ausencia pone `es_vigente = false` y la lista solo trae vigentes—.
 * Con datos inventados la fila se quedaba ahí tan tranquila; contra el backend
 * la persona se desvanecía al marcarla y nada lo decía.
 *
 * ⚠️ **La base sembrada no trae ninguna sesión de simulación**, así que el
 * contrato de los inscritos y la pantalla que los enseña y marca la asistencia
 * —que aquí había y se saltaban siempre— se retiraron: la pantalla se fija sin
 * navegador en `Inscritos.test.tsx`, y el recorrido contra el backend queda
 * anotado como sin cobertura en `docs/SUITE-E2E-CLASIFICACION-2026-09-25.md`.
 * La matriz de permisos sí se ejercita entera.
 */

/** El rol y el permiso que se toca y se devuelve. Nunca `administrar_permisos`. */
const ROL_DE_PRUEBA = 'RESPONSABLE_AREA'
const PERMISO_DE_PRUEBA = 'ver_inscritos_simulacion'

interface Rol {
  id: number
  codigo: string
  nombre: string | null
}

interface Permiso {
  codigo: string
  grupo: string
  orden: number
  alcance: string | null
}

// ---------- Quién eligió cada fecha ----------

test.describe('Simulación · quién eligió cada fecha', () => {
  test('la lista de sesiones responde', async () => {
    const r = await apiPanel('/sesiones-simulacion')
    expect(r.estado, detalleDe(r)).toBe(200)
    expect(Array.isArray(r.cuerpo)).toBe(true)
  })
})

// ---------- Qué puede cada rol ----------

test.describe('Permisos · qué puede cada rol', () => {
  let roles: Rol[] = []
  let rol: Rol | undefined

  test.beforeAll(async () => {
    const r = await apiPanel<Rol[]>('/roles')
    roles = Array.isArray(r.cuerpo) ? r.cuerpo : []
    rol = roles.find((x) => x.codigo === ROL_DE_PRUEBA)
  })

  test('los roles responden y existe el rol de prueba', async () => {
    const r = await apiPanel<Rol[]>('/roles')
    expect(r.estado, detalleDe(r)).toBe(200)
    expect(r.cuerpo.length).toBeGreaterThan(0)
    expect(rol, `existe el rol ${ROL_DE_PRUEBA}`).toBeTruthy()
  })

  test('la matriz trae el catálogo entero ordenado, y cambiar el alcance exige motivo y se lee de vuelta', async () => {
    expect(rol).toBeTruthy()
    const matriz = await apiPanel<Permiso[]>(`/roles/${rol!.id}/permisos`)
    expect(matriz.estado, detalleDe(matriz)).toBe(200)
    // El catálogo entero, no solo lo concedido.
    expect(matriz.cuerpo.length, `${matriz.cuerpo.length} permisos`).toBeGreaterThan(50)

    // El orden: por grupo y, dentro del grupo, por `orden`. La pantalla lo copia.
    const grupos = [...new Set(matriz.cuerpo.map((p) => p.grupo))]
    const ordenado = grupos.every((g) => {
      const del = matriz.cuerpo.filter((p) => p.grupo === g).map((p) => p.orden)
      return del.every((n, i) => i === 0 || del[i - 1]! <= n)
    })
    expect(ordenado).toBe(true)

    const casilla = matriz.cuerpo.find((p) => p.codigo === PERMISO_DE_PRUEBA)
    expect(casilla, `la casilla ${PERMISO_DE_PRUEBA} está en el catálogo`).toBeTruthy()
    const original = casilla!.alcance ?? null

    // Cambiar el alcance, y comprobar que se guardó. Se devuelve pase o falle.
    const destino = original === 'TODO' ? 'SUS_VACANTES' : 'TODO'
    try {
      const sinMotivo = await apiPanel(`/roles/${rol!.id}/permisos/${PERMISO_DE_PRUEBA}`, {
        method: 'PUT',
        cuerpo: { alcance: destino, motivo: '' },
      })
      expect(sinMotivo.estado, detalleDe(sinMotivo)).toBe(400)

      const cambio = await apiPanel(`/roles/${rol!.id}/permisos/${PERMISO_DE_PRUEBA}`, {
        method: 'PUT',
        cuerpo: { alcance: destino, motivo: 'Prueba automatizada: se revierte al terminar.' },
      })
      expect([200, 204], detalleDe(cambio)).toContain(cambio.estado)

      const relectura = await apiPanel<Permiso[]>(`/roles/${rol!.id}/permisos`)
      const ahora = relectura.cuerpo.find((p) => p.codigo === PERMISO_DE_PRUEBA)
      expect(ahora?.alcance, `esperaba ${destino}, llegó ${ahora?.alcance}`).toBe(destino)
    } finally {
      const vuelta =
        original === null
          ? await apiPanel(`/roles/${rol!.id}/permisos/${PERMISO_DE_PRUEBA}/revocacion`, {
              method: 'POST',
              cuerpo: { motivo: 'Fin del e2e: se devuelve el reparto a como estaba.' },
            })
          : await apiPanel(`/roles/${rol!.id}/permisos/${PERMISO_DE_PRUEBA}`, {
              method: 'PUT',
              cuerpo: { alcance: original, motivo: 'Fin del e2e: se devuelve el reparto a como estaba.' },
            })
      console.log(`[PERMISOS] ↩ permiso devuelto a ${original ?? '(sin conceder)'} [${vuelta.estado}]`)
      expect([200, 204], `no se pudo devolver el permiso: ${detalleDe(vuelta)}`).toContain(vuelta.estado)
    }
  })

  test('la pantalla ofrece el rol, pinta la casilla por su código y dice cuántos están concedidos', async ({ page }) => {
    expect(rol).toBeTruthy()
    await entrarAlPanel(page)
    await page.goto('/admin/configuracion')

    const pestanaDelRol = page
      .getByRole('group', { name: 'Rol que se edita' })
      .getByRole('button', { name: rol!.nombre ?? rol!.codigo, exact: true })
    await expect(pestanaDelRol).toBeVisible({ timeout: 20_000 })
    await pestanaDelRol.click()

    await expect(page.getByText(PERMISO_DE_PRUEBA, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/permisos concedidos/)).toBeVisible()
  })

  /**
   * El candado del último administrador.
   *
   * ⚠️ Solo se intenta si `administrar_permisos` lo tiene UN solo rol: si lo
   * tuvieran dos, la revocación no sería «la última», el backend la aceptaría y
   * el spec habría escrito de verdad. En ese caso se salta y se dice.
   */
  test('quitar el último «administrar_permisos» se rechaza con 409', async () => {
    const admin = roles.find((r) => r.codigo === 'ADMINISTRADOR')
    expect(admin, 'existe el rol ADMINISTRADOR').toBeTruthy()

    const conElPermiso: { rol: Rol; alcance: string }[] = []
    for (const r of roles) {
      const permisos = await apiPanel<Permiso[]>(`/roles/${r.id}/permisos`)
      const suyo = (permisos.cuerpo ?? []).find((p) => p.codigo === 'administrar_permisos')
      if (suyo?.alcance) conElPermiso.push({ rol: r, alcance: suyo.alcance })
    }
    test.skip(
      conElPermiso.length !== 1 || conElPermiso[0]!.rol.id !== admin!.id,
      `administrar_permisos lo tienen ${conElPermiso.map((x) => x.rol.codigo).join(', ') || 'nadie'}: revocárselo a ADMINISTRADOR no sería el último y escribiría de verdad`,
    )

    const ultimo = await apiPanel(`/roles/${admin!.id}/permisos/administrar_permisos/revocacion`, {
      method: 'POST',
      cuerpo: { motivo: 'Prueba: el backend debe negarse.' },
    })
    if (ultimo.estado < 300) {
      // Si esto pasó, el reparto quedó sin nadie que lo toque: se devuelve antes de fallar.
      const vuelta = await apiPanel(`/roles/${admin!.id}/permisos/administrar_permisos`, {
        method: 'PUT',
        cuerpo: { alcance: conElPermiso[0]!.alcance, motivo: 'Fin del e2e: el candado no saltó y se devuelve el permiso.' },
      })
      console.log(`[PERMISOS] ↩ administrar_permisos devuelto a ADMINISTRADOR [${vuelta.estado}]`)
    }
    expect(ultimo.estado, detalleDe(ultimo)).toBe(409)
  })
})
