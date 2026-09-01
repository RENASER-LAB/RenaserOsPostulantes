import { expect, test as base, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { API } from './ayuda'

/**
 * Lo que comparten los recorridos que ESCRIBEN: crear cuentas, postular,
 * llenar un perfil, canjear una invitación.
 *
 * ⚠️ **Toda cuenta que crean estas pruebas lleva un correo `<prefijo>.<instante>@example.com`.**
 * El instante evita chocar con «ese correo ya existe» entre dos corridas, y el
 * prefijo es lo que permite borrarlas al terminar: la prueba tiene que dejar la
 * base como la encontró. No es cosmética: «Toda la tanda» cuenta hasta las
 * postulaciones cerradas, así que una postulación de prueba que se quede en la
 * base mueve los recuentos exactos de `05-excel` y `06-sin-ciudad` en la
 * corrida siguiente.
 */

/** La contraseña del portal del candidato: ocho como mínimo. */
export const CLAVE_DE_CANDIDATO = 'unaClaveDePrueba123'

/** Un correo nuevo en cada corrida, con el prefijo por el que luego se borra. */
export const correoDePrueba = (prefijo: string) => `${prefijo}.${Date.now()}@example.com`

/**
 * La cuenta se crea por la API cuando lo que se prueba no es el alta.
 *
 * Lleva ciudad porque el backend la exige desde que el registro la pide: sin
 * `ciudadUbigeo` el alta rebota con 400 aunque la pantalla del perfil no la use.
 */
export async function crearCuentaDeCandidato(datos: {
  nombre: string
  apellidos: string
  correo: string
  contrasena?: string
}): Promise<void> {
  const r = await fetch(`${API}/portal/cuentas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      correo: datos.correo,
      contrasena: datos.contrasena ?? CLAVE_DE_CANDIDATO,
      ciudadUbigeo: '1501', // Lima — Lima
      aceptaProceso: true,
      aceptaFuturosContactos: false,
    }),
  })
  if (!r.ok) throw new Error(`No se pudo crear la cuenta ${datos.correo} (${r.status}): ${await r.text()}`)
}

/** El token de sesión del candidato, para pedir cosas a la API con su nombre. */
export async function tokenDelCandidato(correo: string, contrasena = CLAVE_DE_CANDIDATO): Promise<string> {
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })
  if (!r.ok) throw new Error(`login portal falló: ${r.status} ${await r.text()}`)
  return (await r.json()).token
}

/**
 * Una consulta contra el Postgres **desechable del 5434**, como en `06-sin-ciudad`.
 *
 * Va por la entrada estándar y no por `-c` para poder mandar una transacción
 * entera; `ON_ERROR_STOP` hace que un fallo a mitad reviente aquí en vez de
 * dejar la mitad borrada y seguir en silencio.
 */
export function sql(consulta: string): string {
  try {
    return execFileSync(
      'docker',
      ['exec', '-i', 'renaser-verifica', 'psql', '-U', 'postgres', '-d', 'renaser_db', '-v', 'ON_ERROR_STOP=1'],
      { input: consulta, stdio: ['pipe', 'pipe', 'pipe'] },
    ).toString()
  } catch (causa) {
    // Lo que dijo Postgres, y no «Command failed»: es lo único que explica el fallo.
    const stderr = (causa as { stderr?: Buffer }).stderr?.toString().trim()
    throw new Error(stderr || String(causa))
  }
}

/**
 * Borra las cuentas de prueba que empiezan por un prefijo, con todo lo que
 * cuelga de ellas: postulaciones, currículum, lectura por IA, evaluación del
 * banco, perfil, invitación.
 *
 * Sigue el precedente de `herramientas/limpiar-cuentas-de-maestro.sql`: solo
 * toca correos `<prefijo>.…@example.com`, un dominio reservado para esto que
 * ningún candidato de verdad puede tener, y borra también su auditoría porque
 * la clave ajena no deja quitar la cuenta sin ella.
 *
 * El orden de los `delete` es el de las claves foráneas, de las hojas al
 * tronco. Cada tabla está aquí porque referencia a otra que también se borra;
 * si una migración añade una nueva, Postgres lo dirá con un error de clave
 * ajena en vez de dejar basura.
 *
 * ⚠️ **Una cuenta CON postulación no se puede borrar del todo.** Cada
 * postulación deja filas en `transicion_estado`, que es inmutable por trigger
 * (`transicion_estado_inmutable`, como `auditoria_inmutable`): es el historial
 * de las personas reales y el `delete` revienta ahí. Por eso `12-postular`
 * avisa en vez de fallar cuando la limpieza no puede con su postulación. Quitar
 * ese rastro exige apagar el trigger dentro de la transacción —y volver a
 * encenderlo antes del `commit`—, que es una decisión de quien administra la
 * base desechable, no de una prueba.
 */
export function borrarCuentasDePrueba(prefijo: string): void {
  if (!/^[a-z0-9.]+$/.test(prefijo)) throw new Error(`Prefijo raro: «${prefijo}»`)
  const patron = `'${prefijo}.%@example.com'`
  sql(`
begin;

create temporary table qa_cuentas on commit drop as
  select u.id as usuario_id, u.persona_id from usuario u where u.correo like ${patron};
create temporary table qa_postulaciones on commit drop as
  select id from postulacion where usuario_id in (select usuario_id from qa_cuentas);
create temporary table qa_trabajos on commit drop as
  select id from trabajo_ia where postulacion_id in (select id from qa_postulaciones);
create temporary table qa_ejecuciones on commit drop as
  select id from ejecucion_ia where trabajo_ia_id in (select id from qa_trabajos);
create temporary table qa_evaluaciones on commit drop as
  select id from evaluacion where usuario_id in (select usuario_id from qa_cuentas);
create temporary table qa_cvs on commit drop as
  select id, archivo_original_id, archivo_anonimizado_id
  from cv where postulacion_id in (select id from qa_postulaciones);
create temporary table qa_intentos on commit drop as
  select id from intento_prueba where postulacion_id in (select id from qa_postulaciones);
create temporary table qa_talentos on commit drop as
  select id from perfil_talento
  where postulacion_id in (select id from qa_postulaciones)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
create temporary table qa_perfiles on commit drop as
  select id from perfil_candidato where persona_id in (select persona_id from qa_cuentas);

-- Lo que dejó la IA: la lectura del currículum y la calificación.
delete from nota_respuesta
  where ejecucion_ia_id in (select id from qa_ejecuciones)
     or respuesta_id in (select id from respuesta where evaluacion_id in (select id from qa_evaluaciones));
delete from hallazgo_perfil where perfil_talento_id in (select id from qa_talentos);
delete from sugerencia_puesto
  where perfil_talento_id in (select id from qa_talentos)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
delete from perfil_talento where id in (select id from qa_talentos);
delete from pregunta_generada
  where postulacion_id in (select id from qa_postulaciones)
     or ejecucion_ia_id in (select id from qa_ejecuciones)
     or registrada_por_usuario_id in (select usuario_id from qa_cuentas);
delete from alerta
  where postulacion_id in (select id from qa_postulaciones)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
delete from barrera_detectada
  where postulacion_id in (select id from qa_postulaciones)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
delete from dato_cv
  where postulacion_id in (select id from qa_postulaciones)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
delete from nota_criterio
  where postulacion_id in (select id from qa_postulaciones)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
delete from afirmacion_cv
  where cv_id in (select id from qa_cvs)
     or ejecucion_ia_id in (select id from qa_ejecuciones);
delete from enlace_cv where cv_id in (select id from qa_cvs);
delete from ejecucion_ia where id in (select id from qa_ejecuciones);
delete from trabajo_ia where id in (select id from qa_trabajos);

-- La postulación y lo suyo.
delete from entregable where intento_prueba_id in (select id from qa_intentos);
delete from respuesta_prueba where intento_prueba_id in (select id from qa_intentos);
delete from intento_prueba where id in (select id from qa_intentos);
delete from consentimiento
  where postulacion_id in (select id from qa_postulaciones)
     or persona_id in (select persona_id from qa_cuentas);
delete from cv where id in (select id from qa_cvs);
delete from archivo
  where id in (select archivo_original_id from qa_cvs union select archivo_anonimizado_id from qa_cvs);
delete from decision where postulacion_id in (select id from qa_postulaciones);
delete from enlace_acceso where postulacion_id in (select id from qa_postulaciones);
delete from evidencia_adicional where postulacion_id in (select id from qa_postulaciones);
delete from inscripcion_sesion where postulacion_id in (select id from qa_postulaciones);
delete from nota_etapa where postulacion_id in (select id from qa_postulaciones);
delete from transicion_estado
  where postulacion_id in (select id from qa_postulaciones)
     or usuario_id in (select usuario_id from qa_cuentas);
delete from validacion where postulacion_id in (select id from qa_postulaciones);
delete from postulacion where id in (select id from qa_postulaciones);

-- La evaluación del banco.
delete from respuesta where evaluacion_id in (select id from qa_evaluaciones);
delete from orden_pregunta where evaluacion_id in (select id from qa_evaluaciones);
delete from resultado_alineacion where evaluacion_id in (select id from qa_evaluaciones);
delete from evaluacion where id in (select id from qa_evaluaciones);

-- La cuenta, su perfil y la invitación que la trajo.
delete from usuario_rol
  where usuario_id in (select usuario_id from qa_cuentas)
     or asignado_por_usuario_id in (select usuario_id from qa_cuentas);
delete from auditoria where usuario_id in (select usuario_id from qa_cuentas);
delete from correo_enviado where usuario_id in (select usuario_id from qa_cuentas);
delete from invitacion where correo like ${patron};
delete from certificacion_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from educacion_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from enlace_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from experiencia_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from idioma_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from perfil_candidato where id in (select id from qa_perfiles);
delete from solicitud_borrado where persona_id in (select persona_id from qa_cuentas);
delete from usuario where id in (select usuario_id from qa_cuentas);
delete from persona where id in (select persona_id from qa_cuentas);

commit;
`)
}

/**
 * `test` con un vigilante puesto: un error de JavaScript en la página hace
 * fallar la prueba aunque todas las comprobaciones hayan pasado.
 *
 * Los arneses viejos lo llevaban todos —`pagina.on('pageerror')` y salir con
 * 1 si había alguno— y es la única red que atrapa un fallo de render que la
 * pantalla disimula.
 */
export const test = base.extend<{ sinErroresDeJavaScript: void }>({
  sinErroresDeJavaScript: [
    async ({ page }, usar) => {
      const errores: string[] = []
      page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
      await usar()
      expect(errores, `Errores de JavaScript en la página:\n${errores.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})

/**
 * Espera a que un formulario del portal termine de guardar: el botón «Guardar»
 * desaparece cuando el servidor confirma, y no antes.
 */
export async function guardar(page: Page) {
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /^Guardar|^Guardando/ })).toHaveCount(0)
}
