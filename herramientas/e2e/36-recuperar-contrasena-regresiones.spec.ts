import { expect } from '@playwright/test'

import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato, test } from './ayuda-candidato'
import {
  crearCuentaDeEquipo,
  esperarEnlace,
  holgarElTopePorIp,
  pedirPorApi,
  PLANTILLA_CANDIDATO,
  PLANTILLA_EQUIPO,
} from './ayuda-recuperacion'
import { literal, sql } from './base-de-datos'

/**
 * «Me olvidé mi contraseña»: regresiones de lo que encontró QA explorando.
 *
 * La organización plataforma se llama «RENASER CONSULTING S.A.C.», y las
 * plantillas sembradas ponen un punto detrás de `{{nombre_empresa}}`: los
 * correos salían con «S.A.C..». Solo el backend puede demostrar que ya no.
 *
 * El otro hallazgo —una contraseña de más de 72 bytes, el tope de BCrypt, que
 * llegaba al campo como «password cannot be more than 72 bytes»— se para hoy en
 * la pantalla, y eso se fija sin navegador en `Restablecer.test.tsx` y
 * `RecuperarClavePanel.test.tsx` (F-01, en las dos puertas).
 *
 * ⚠️ **ESCRIBE**: crea cuentas `e2e.rcr.*.<uuid>@example.com` y las borra al
 * terminar. La auditoría de cada solicitud queda, sin usuario ni token.
 */

/** El último cuerpo de ese correo, o '' si no hay. */
function ultimoCuerpo(correo: string, plantilla: string): string {
  return sql(`select c.cuerpo from correo_enviado c join usuario u on u.id = c.usuario_id
    where u.correo = ${literal(correo)} and c.plantilla_correo_codigo = ${literal(plantilla)}
    order by c.id desc limit 1;`)
}

test.describe('Me olvidé mi contraseña · regresiones de QA', () => {
  let devolverElTope: () => void = () => {}
  test.beforeAll(() => {
    devolverElTope = holgarElTopePorIp()
  })
  test.afterAll(() => {
    devolverElTope()
  })

  test('los correos de recuperación no dicen «S.A.C..» con el punto repetido', async () => {
    const candidata = correoDePrueba('e2e.rcr.punto')
    const equipo = correoDePrueba('e2e.rcr.equipo')
    try {
      await crearCuentaDeCandidato({ nombre: 'Punto', apellidos: 'Recupera', correo: candidata })
      await crearCuentaDeEquipo(equipo, 'unaClaveLargaDePunto2026')
      expect(await pedirPorApi('portal', candidata)).toBe(202)
      expect(await pedirPorApi('panel', equipo)).toBe(202)
      await esperarEnlace(candidata, PLANTILLA_CANDIDATO)
      await esperarEnlace(equipo, PLANTILLA_EQUIPO)

      const delCandidato = ultimoCuerpo(candidata, PLANTILLA_CANDIDATO)
      const delEquipo = ultimoCuerpo(equipo, PLANTILLA_EQUIPO)
      // Dos puntos seguidos que no son unos puntos suspensivos
      expect(delCandidato, 'correo del candidato').not.toMatch(/[^.]\.\.(?!\.)/)
      expect(delEquipo, 'correo del equipo').not.toMatch(/[^.]\.\.(?!\.)/)
    } finally {
      borrarCuentasDePrueba([candidata, equipo])
    }
  })
})
