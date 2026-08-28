-- Borra las cuentas que deja el recorrido de Maestro.
--
-- Las crea `herramientas/maestro/recorrido-candidato.yaml` con un correo
-- `maestro.<instante>@example.com`, y sin esto se van acumulando en la base
-- local: la prueba tiene que dejar la base como la encontro.
--
-- ⚠️ **Solo toca correos que empiezan por `maestro.`**, que es un prefijo que
-- ningun candidato de verdad puede tener — nadie se registra con eso a mano y
-- el dominio es `example.com`, reservado por la RFC 2606 justamente para esto.
--
-- ⚠️ **Borra tambien sus filas de auditoria.** En este proyecto la auditoria no
-- se toca, y con razon; la excepcion es que aqui el sujeto entero es de mentira
-- y la clave ajena impide borrar la cuenta sin ellas. Lo que se conserva
-- siempre es la auditoria de las personas reales.
--
--   docker exec -i renaser-postgres psql -U postgres -d renaser_db \
--     < herramientas/limpiar-cuentas-de-maestro.sql

begin;

create temporary table a_borrar on commit drop as
select u.id as usuario_id, u.persona_id
from usuario u
where u.correo like 'maestro.%@example.com';

delete from usuario_rol where usuario_id in (select usuario_id from a_borrar);
delete from usuario_rol where asignado_por_usuario_id in (select usuario_id from a_borrar);
delete from auditoria where usuario_id in (select usuario_id from a_borrar);
delete from correo_enviado where usuario_id in (select usuario_id from a_borrar);
delete from consentimiento where persona_id in (select persona_id from a_borrar);
delete from perfil_candidato where persona_id in (select persona_id from a_borrar);
delete from solicitud_borrado where persona_id in (select persona_id from a_borrar);

delete from usuario where id in (select usuario_id from a_borrar);
delete from persona where id in (select persona_id from a_borrar);

commit;
