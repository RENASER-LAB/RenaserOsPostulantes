import { seleccionDeCorreos, sql } from './base-de-datos'

/** Borra solo las cuentas indicadas, en una transacción. Los triggers siguen activos.
 * Si la auditoría impide borrar, el error se propaga y se conserva el clon.
 */
export function borrarCuentasDePrueba(correos: readonly string[], consultar: typeof sql = sql): void {
  if (!correos.length) return
  const seleccion = seleccionDeCorreos(correos)
  consultar(`
begin;

create temporary table qa_cuentas on commit drop as
  select u.id as usuario_id, u.persona_id from usuario u where u.correo in (${seleccion});
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

-- Lo que el perfil guarda desde la V51: la lectura de su currículum —que no
-- cuelga de ninguna postulación— y los archivos que son suyos y de nadie más.
create temporary table qa_lecturas on commit drop as
  select id, archivo_id from lectura_cv_perfil
  where persona_id in (select persona_id from qa_cuentas);
create temporary table qa_trabajos_perfil on commit drop as
  select id from trabajo_ia
  where referencia_tabla = 'lectura_cv_perfil'
    and referencia_id in (select id from qa_lecturas);
create temporary table qa_archivos_perfil on commit drop as
  select foto_archivo_id as id from perfil_candidato where id in (select id from qa_perfiles)
  union select portada_archivo_id from perfil_candidato where id in (select id from qa_perfiles)
  union select cv_archivo_id from perfil_candidato where id in (select id from qa_perfiles)
  union select archivo_id from certificacion_perfil
        where perfil_candidato_id in (select id from qa_perfiles)
  union select archivo_id from qa_lecturas;

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
-- La lectura del currículum del perfil no tiene postulación detrás, así que sus
-- trabajos no salen de qa_trabajos: se buscan por su referencia.
delete from ejecucion_ia where trabajo_ia_id in (select id from qa_trabajos_perfil);
delete from trabajo_ia where id in (select id from qa_trabajos_perfil);
delete from lectura_cv_perfil where id in (select id from qa_lecturas);

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
-- La campana del portal (V55). Cuelga del usuario y, cuando el aviso nace de una
-- postulación, también de ella: por eso se borra por las dos vías y ANTES que las dos.
-- Sin esto, una cuenta de prueba a la que le cambiaron el sueldo de su vacante no se
-- puede borrar —la clave ajena lo impide— y, con ON_ERROR_STOP, la limpieza entera se
-- deshace y deja en la base todo lo que venía a quitar.
delete from aviso_portal
  where usuario_id in (select usuario_id from qa_cuentas)
     or postulacion_id in (select id from qa_postulaciones);
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
delete from invitacion where correo in (${seleccion});
delete from certificacion_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from educacion_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from enlace_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from experiencia_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from idioma_perfil where perfil_candidato_id in (select id from qa_perfiles);
delete from perfil_candidato where id in (select id from qa_perfiles);
-- Ahora que nadie los referencia: la foto, la portada, el currículum y los diplomas.
delete from archivo where id in (select id from qa_archivos_perfil where id is not null);
delete from solicitud_borrado where persona_id in (select persona_id from qa_cuentas);
delete from usuario where id in (select usuario_id from qa_cuentas);
delete from persona where id in (select persona_id from qa_cuentas);

commit;
`)
}

