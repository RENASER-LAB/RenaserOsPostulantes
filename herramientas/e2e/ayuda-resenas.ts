/**
 * El terreno de las reseñas de empresas (V63): contrataciones con su fecha, y
 * reseñas ya publicadas cuando lo que se prueba no es escribirlas.
 *
 * Las contrataciones se siembran como pide la spec: **insertando** la transición
 * a `CONTRATADO` con una fecha pasada, relativa a hoy. La tabla no deja
 * modificar una transición, pero sí insertarla.
 *
 * ⚠️ Una postulación con historial no se puede borrar (V6): la limpieza retira la
 * cuenta —`borrarCuentasDePrueba`— y marca eliminadas las vacantes. Las reseñas,
 * respuestas y reportes de lo sembrado sí se borran, y antes que nada.
 */

import { API, EQUIPO } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, sql } from './ayuda-candidato'
import { literal } from './base-de-datos'

export const MARCA = 'QA-RESENAS-C9F0'
const TEXTO_SEMBRADO = `${MARCA} sembrado por la prueba de reseñas`
const PREFIJO_CORREO = 'qa.resenas.c9f0'

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

function insertar(consulta: string): Fila {
  const filas = JSON.parse(
    sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`),
  ) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return filas[0]!
}

export const correoDeCandidata = (): string => correoDePrueba(PREFIJO_CORREO)

/** El usuario de equipo con el que entra la suite: el que escribe las reseñas. */
export const usuarioDelEquipo = (): number =>
  Number(uno(`select id from usuario where usuario_renaser_os_id = ${literal(EQUIPO)}`).id)

/** Nombre de la empresa del equipo: el que firma sus reseñas. */
export const empresaDelEquipo = (): string =>
  String(
    uno(`select o.nombre from organizacion o join usuario u on u.organizacion_id = o.id
          where u.usuario_renaser_os_id = ${literal(EQUIPO)}`).nombre,
  )

export function idsDeLaCuenta(correo: string): { usuario: number; persona: number } {
  const f = uno(`select id, persona_id from usuario where correo = ${literal(correo)}`)
  return { usuario: Number(f.id), persona: Number(f.persona_id) }
}

/**
 * Una vacante publicada de la empresa del equipo, calcada de la primera que haya
 * —su puesto, sus pesos—, con el equipo de la suite como responsable.
 */
export function sembrarVacante(titulo: string): number {
  const responsable = usuarioDelEquipo()
  const plantilla = uno(`select v.solicitud_talento_id, v.puesto_id, v.version_pesos_id,
                                v.organizacion_id
                           from vacante v join usuario u on u.organizacion_id = v.organizacion_id
                          where u.id = ${responsable} and v.eliminada_en is null
                          order by v.id limit 1`)
  const solicitud = Number(insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                   nivel_puesto_codigo, familia_codigo, resultado_principal,
                                   motivo, consecuencia_no_contratar, analisis_capacidad,
                                   responsable_usuario_id)
    select s.organizacion_id, s.origen, s.urgencia, 'CON_VACANTE', s.area_id, s.puesto_id,
           s.nivel_puesto_codigo, s.familia_codigo, ${literal(TEXTO_SEMBRADO)},
           ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
           ${responsable}
      from solicitud_talento s where s.id = ${plantilla.solicitud_talento_id}
    returning id`).id)
  return Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo,
                         publicada_en)
    values (${plantilla.organizacion_id}, ${solicitud}, ${plantilla.puesto_id},
            ${literal(`${MARCA} ${titulo}`)}, ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE',
            'PUBLICADA', ${plantilla.version_pesos_id}, ${responsable}, false, 'PLANTILLA',
            'OCULTA', now())
    returning id`).id)
}

/**
 * La contratación de una cuenta en una vacante, de hace tantos días: la
 * postulación en `CONTRATADO` y su transición INSERTADA con esa fecha.
 */
export function sembrarContratacion(vacante: number, usuario: number, haceDias: number): number {
  const organizacion = Number(uno(`select organizacion_id from vacante where id = ${vacante}`).organizacion_id)
  const postulacion = Number(insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, creado_en,
                             movido_en)
    values (${organizacion}, ${usuario}, ${vacante}, 'CONTRATADO',
            now() - make_interval(days => ${haceDias + 60}),
            now() - make_interval(days => ${haceDias}))
    returning id`).id)
  sql(`insert into transicion_estado (postulacion_id, estado_nuevo_codigo, es_sistema, ocurrida_en)
       values (${postulacion}, 'CONTRATADO', true, now() - make_interval(days => ${haceDias}));`)
  return postulacion
}

/** Una reseña ya publicada hace tantos días, cuando lo que se prueba no es escribirla. */
export function sembrarResena(
  postulacion: number,
  persona: number,
  estrellas: number,
  texto: string,
  haceDias: number,
): number {
  const p = uno(`select organizacion_id from postulacion where id = ${postulacion}`)
  return Number(insertar(`
    insert into resena (postulacion_id, organizacion_id, persona_id, estrellas, texto,
                        escrita_por_usuario_id, publicada_en)
    values (${postulacion}, ${p.organizacion_id}, ${persona}, ${estrellas}, ${literal(texto)},
            ${usuarioDelEquipo()}, now() - make_interval(days => ${haceDias}))
    returning id`).id)
}

/**
 * Que el equipo de la suite pueda moderar: `moderar_resenas` es del Administrador
 * de la plataforma. Si no lo tiene, se le da ese rol y se devuelve para quitarlo
 * al terminar; si ya lo tenía, no se toca nada.
 */
export function asegurarQueModera(): number | null {
  const usuario = usuarioDelEquipo()
  const ya = consultar(`
    select 1 from usuario_rol ur join rol_permiso rp on rp.rol_id = ur.rol_id
      join permiso p on p.id = rp.permiso_id
     where ur.usuario_id = ${usuario} and p.codigo = 'moderar_resenas'`)
  if (ya.length > 0) return null
  const rol = Number(uno(`
    select r.id from rol r join organizacion o on o.id = r.organizacion_id
     where o.es_plataforma and r.codigo = 'ADMINISTRADOR'`).id)
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rol});`)
  return rol
}

/** El token de panel del equipo de la suite. */
export async function tokenDelEquipo(): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: EQUIPO }),
  })
  if (!r.ok) throw new Error(`dev-login falló: ${r.status}`)
  return (await r.json()).token as string
}

// ---------- La empresa B, el equipo acotado y lo demás que pide la spec ----------

/** Prefijo de los ids de RENASER OS de las cuentas de panel sembradas en la plataforma. */
const PREFIJO_PANEL = 'qa-resenas-c9f0-'
/** Prefijo de los roles acotados que estrena esta prueba en la plataforma. */
const PREFIJO_ROL = 'QA_RESENAS_C9F0_'
/** El código de la empresa B lleva la marca y un sufijo por corrida: `codigo` es único. */
const PREFIJO_EMPRESA = `${MARCA}-B-`

export interface EmpresaB {
  id: number
  nombre: string
  /** El usuario de Talento de B y su correo: entra por el login del panel. */
  usuario: number
  correo: string
}

/**
 * La empresa B, sembrada como la siembra el alta de empresas
 * (`ServicioPlataformaImpl#sembrar`): los roles de la plataforma, su matriz de
 * permisos SIN `administrar_plataforma` ni `moderar_resenas`, y sus parámetros.
 * Con un usuario de Talento.
 *
 * ⚠️ **El `dev-login` solo conoce a la plataforma**: el usuario de B entra por
 * `POST /panel/auth/login` con correo y contraseña. Su contraseña es la de las
 * cuentas de candidato de la suite —`CLAVE_DE_CANDIDATO`—: se le copia el hash de
 * una cuenta ya creada por la API, sin inventar un BCrypt aquí.
 *
 * El nombre es largo a propósito: la spec pide probar nombres de empresa largos.
 */
export function sembrarEmpresaB(correoConClave: string): EmpresaB {
  const nombre = `${MARCA} Constructora Andina del Pacífico y Servicios Generales de Ingeniería Integral S.A.C.`
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const id = Number(insertar(`
    insert into organizacion (codigo, nombre)
    values (${literal(`${PREFIJO_EMPRESA}${Date.now()}`)}, ${literal(nombre)})
    returning id`).id)
  sql(`
    begin;
    insert into rol (organizacion_id, codigo, nombre, descripcion, es_sistema)
      select ${id}, codigo, nombre, descripcion, es_sistema from rol
       where organizacion_id = ${plataforma} and codigo not like ${literal(`${PREFIJO_ROL}%`)};
    insert into rol_permiso (rol_id, permiso_id, alcance)
      select nuevo.id, rp.permiso_id, rp.alcance
        from rol_permiso rp
        join rol origen on origen.id = rp.rol_id and origen.organizacion_id = ${plataforma}
        join rol nuevo on nuevo.organizacion_id = ${id} and nuevo.codigo = origen.codigo
        join permiso p on p.id = rp.permiso_id
                      and p.codigo not in ('administrar_plataforma', 'moderar_resenas');
    insert into parametro (organizacion_id, codigo, valor, tipo, descripcion)
      select ${id}, codigo, valor, tipo, descripcion from parametro
       where organizacion_id = ${plataforma}
      on conflict (organizacion_id, codigo) do nothing;
    commit;`)
  const correo = correoDePrueba(`${PREFIJO_CORREO}.b`)
  const persona = Number(insertar(`
    insert into persona (nombre, apellidos) values ('Tania', 'Talento B') returning id`).id)
  const usuario = Number(insertar(`
    insert into usuario (organizacion_id, persona_id, correo, contrasena_hash, es_equipo, es_activo)
    select ${id}, ${persona}, ${literal(correo)}, u.contrasena_hash, true, true
      from usuario u where u.correo = ${literal(correoConClave)}
    returning id`).id)
  sql(`insert into usuario_rol (usuario_id, rol_id)
       select ${usuario}, id from rol where organizacion_id = ${id} and codigo = 'TALENTO';`)
  return { id, nombre, usuario, correo }
}

/** El token de panel de un usuario que entra con correo y contraseña (la empresa B). */
export async function tokenConClave(correo: string, contrasena: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })
  if (!r.ok) throw new Error(`login de panel de ${correo} falló: ${r.status} ${await r.text()}`)
  return (await r.json()).token as string
}

/**
 * Una vacante publicada de cualquier empresa, con su área, su puesto y su
 * solicitud propios —la empresa B no tiene ninguno de los de la plataforma—.
 */
export function sembrarVacanteDe(organizacion: number, responsable: number, titulo: string): number {
  const sufijo = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const area = Number(insertar(`
    insert into area (organizacion_id, nombre)
    values (${organizacion}, ${literal(`${MARCA} ${titulo} ${sufijo}`)}) returning id`).id)
  const puesto = Number(insertar(`
    insert into puesto (organizacion_id, codigo, nombre, nivel_puesto_codigo, familia_codigo)
    values (${organizacion}, ${literal(`QA_RESENAS_${sufijo}`)}, ${literal(titulo)}, 'EJECUCION', 'OPERACIONES')
    returning id`).id)
  const solicitud = Number(insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    values (${organizacion}, 'DIRECTA', 'NORMAL', 'CON_VACANTE', ${area}, ${puesto},
            ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
            ${literal(TEXTO_SEMBRADO)}, ${responsable})
    returning id`).id)
  return Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, publicada_en)
    values (${organizacion}, ${solicitud}, ${puesto}, ${literal(`${MARCA} ${titulo}`)},
            ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE', 'PUBLICADA',
            (select min(id) from version_pesos), ${responsable}, false, now())
    returning id`).id)
}

/**
 * Una postulación SIN historial: la de quien postula a la vacante de B, o la
 * contratación que B ya reseñó y que no se escribe por la pantalla. Sin
 * transición se puede borrar, y la empresa B con ella.
 */
export function sembrarPostulacion(vacante: number, usuario: number, estado = 'PERFIL_POR_CONFIRMAR'): number {
  const organizacion = Number(uno(`select organizacion_id from vacante where id = ${vacante}`).organizacion_id)
  return Number(insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, creado_en, movido_en)
    values (${organizacion}, ${usuario}, ${vacante}, ${literal(estado)}, now() - interval '20 days',
            now() - interval '5 days')
    returning id`).id)
}

/** Una reseña de cualquier empresa, escrita por el usuario que se diga. */
export function sembrarResenaDe(
  postulacion: number,
  persona: number,
  estrellas: number,
  texto: string,
  haceDias: number,
  autor: number,
): number {
  const p = uno(`select organizacion_id from postulacion where id = ${postulacion}`)
  return Number(insertar(`
    insert into resena (postulacion_id, organizacion_id, persona_id, estrellas, texto,
                        escrita_por_usuario_id, publicada_en)
    values (${postulacion}, ${p.organizacion_id}, ${persona}, ${estrellas}, ${literal(texto)},
            ${autor}, now() - make_interval(days => ${haceDias}))
    returning id`).id)
}

/**
 * Una respuesta ya publicada hace tantos días, editable hasta dentro de tantos
 * (negativo: ya fija).
 */
export function sembrarRespuesta(
  resena: number,
  usuario: number,
  texto: string,
  haceDias: number,
  editableDias: number,
): number {
  return Number(insertar(`
    insert into respuesta_resena (resena_id, usuario_id, texto, publicada_en, editable_hasta)
    values (${resena}, ${usuario}, ${literal(texto)}, now() - make_interval(days => ${haceDias}),
            now() + make_interval(days => ${editableDias}))
    returning id`).id)
}

/** Mueve la publicación de una reseña: el plazo de edición vence con el formulario abierto. */
export function publicadaHace(resena: number, dias: number): void {
  sql(`update resena set publicada_en = now() - make_interval(days => ${dias}) where id = ${resena};`)
}

/** La reseña viva de una postulación, o `null`. */
export function resenaDe(postulacion: number): number | null {
  const filas = consultar(`select id from resena where postulacion_id = ${postulacion} and borrada_en is null`)
  return filas.length ? Number(filas[0]!.id) : null
}

/**
 * Una cuenta de panel en la PLATAFORMA —entra por el `dev-login`— con un rol que
 * ya existe (`RESPONSABLE_AREA`) o con uno acotado que estrena la prueba: el de
 * Talento sin los permisos que se digan.
 */
export function sembrarEquipoDePanel(
  sufijo: string,
  rol: { codigo: string } | { talentoSin: readonly string[] },
): { usuario: number; renaserOsId: string } {
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const renaserOsId = `${PREFIJO_PANEL}${sufijo}`
  let rolId: number
  if ('codigo' in rol) {
    rolId = Number(uno(`select id from rol where organizacion_id = ${plataforma} and codigo = ${literal(rol.codigo)}`).id)
  } else {
    const codigo = `${PREFIJO_ROL}${sufijo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
    rolId = Number(insertar(`
      insert into rol (organizacion_id, codigo, nombre, descripcion)
      values (${plataforma}, ${literal(codigo)}, ${literal(codigo)}, ${literal(TEXTO_SEMBRADO)})
      returning id`).id)
    const quitar = rol.talentoSin.map((c) => literal(c)).join(', ')
    sql(`insert into rol_permiso (rol_id, permiso_id, alcance)
         select ${rolId}, rp.permiso_id, rp.alcance from rol_permiso rp
           join rol t on t.id = rp.rol_id and t.organizacion_id = ${plataforma} and t.codigo = 'TALENTO'
           join permiso p on p.id = rp.permiso_id
          where p.codigo not in (${quitar});`)
  }
  const persona = Number(insertar(`
    insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id`).id)
  const usuario = Number(insertar(`
    insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
    values (${plataforma}, ${persona}, ${literal(renaserOsId)}, true, true) returning id`).id)
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rolId});`)
  return { usuario, renaserOsId }
}

/** El token de panel de una cuenta de la plataforma, por su id de RENASER OS. */
export async function tokenDePanel(renaserOsId: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status}`)
  return (await r.json()).token as string
}

/** Una llamada a la API con un token: estado y cuerpo (JSON si lo hay). */
export async function pedir(
  ruta: string,
  token: string,
  metodo = 'GET',
  cuerpo?: unknown,
): Promise<{ estado: number; cuerpo: any }> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let json: unknown = null
  try { json = texto ? JSON.parse(texto) : null } catch { json = texto }
  return { estado: r.status, cuerpo: json }
}

/** Quita lo sembrado: reseñas y lo suyo, cuentas por correo exacto, vacantes por la marca. */
export function retirarLoSembrado(correos: readonly string[], rolPrestado: number | null): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${MARCA}%`)}`)
  if (vacantes.length) {
    const ids = vacantes.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      create temporary table qa_resenas on commit drop as
        select r.id from resena r join postulacion p on p.id = r.postulacion_id
         where p.vacante_id in (${ids});
      delete from reporte_resena where resena_id in (select id from qa_resenas);
      delete from respuesta_resena where resena_id in (select id from qa_resenas);
      delete from resena where id in (select id from qa_resenas);
      -- Los avisos de las reseñas no cuelgan de ninguna vacante: se quitan por la
      -- cuenta de quien postuló, que puede quedar retenida por su historial.
      delete from aviso_portal
        where tipo in ('RESENA_PUBLICADA', 'RESENA_EDITADA', 'REPORTE_RESENA_RESUELTO',
                       'RESPUESTA_RESENA_OCULTADA')
          and usuario_id in (select usuario_id from postulacion where vacante_id in (${ids}));
      -- Las postulaciones sin historial (las de la empresa B, y las que solo postulan)
      -- sí se pueden borrar.
      delete from aviso_portal where postulacion_id in (
        select p.id from postulacion p where p.vacante_id in (${ids})
           and not exists (select 1 from transicion_estado t where t.postulacion_id = p.id));
      delete from postulacion p where p.vacante_id in (${ids})
         and not exists (select 1 from transicion_estado t where t.postulacion_id = p.id);
      commit;`)
  }
  const huerfanos = consultar(
    // Solo cuentas del portal: el usuario de la empresa B es responsable de sus
    // vacantes y se retira con ella, al final.
    `select correo from usuario where correo like ${literal(`${PREFIJO_CORREO}.%@example.com`)} and not es_equipo`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) {
    /*
      Quien respondió o reportó por el portal dejó auditoría, y la auditoría no se
      puede borrar (V6): `borrarCuentasDePrueba` fallaría entera al intentarlo. Esas
      cuentas se retiran como las que tienen historial: sin sesión y con un correo
      que ninguna barrida vuelve a recoger.
    */
    const lista = todos.map((c) => literal(c)).join(', ')
    const conAuditoria = consultar(`
      select correo from usuario u where u.correo in (${lista})
         and exists (select 1 from auditoria a where a.usuario_id = u.id)`).map((f) => String(f.correo))
    if (conAuditoria.length) {
      sql(`update usuario set es_activo = false,
                  correo = 'e2e.retirada.' || gen_random_uuid() || '@example.com'
            where correo in (${conAuditoria.map((c) => literal(c)).join(', ')});`)
    }
    const borrables = todos.filter((c) => !conAuditoria.includes(c))
    if (borrables.length) borrarCuentasDePrueba(borrables)
  }
  if (vacantes.length) {
    const ids = vacantes.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from vacante
        where id in (${ids})
          and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      -- Las que conservan contrataciones con historial no se pueden borrar: se
      -- marcan eliminadas y salen de todas partes.
      update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
      commit;`)
  }
  sql(`
    begin;
    create temporary table qa_solicitudes on commit drop as
      select id, area_id, puesto_id from solicitud_talento s
       where s.motivo = ${literal(TEXTO_SEMBRADO)}
         and not exists (select 1 from vacante v where v.solicitud_talento_id = s.id);
    delete from solicitud_talento where id in (select id from qa_solicitudes);
    delete from area a where a.nombre like ${literal(`${MARCA} %`)}
       and not exists (select 1 from solicitud_talento s where s.area_id = a.id);
    delete from puesto p where p.codigo like 'QA\\_RESENAS\\_%'
       and not exists (select 1 from solicitud_talento s where s.puesto_id = p.id)
       and not exists (select 1 from vacante v where v.puesto_id = p.id);
    commit;`)
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)

  // Las cuentas de panel de la plataforma y sus roles acotados. La que escribió
  // una reseña deja auditoría, que no se puede borrar: esa se desactiva.
  sql(`
    begin;
    create temporary table qa_panel on commit drop as
      select id, persona_id from usuario where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    delete from usuario_rol where usuario_id in (select id from qa_panel);
    delete from usuario u where u.id in (select id from qa_panel)
       and not exists (select 1 from auditoria a where a.usuario_id = u.id)
       and not exists (select 1 from vacante v where v.responsable_usuario_id = u.id)
       and not exists (select 1 from solicitud_talento s where s.responsable_usuario_id = u.id);
    update usuario set es_activo = false,
           usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
     where id in (select id from qa_panel);
    delete from persona where id in (select persona_id from qa_panel)
       and not exists (select 1 from usuario u where u.persona_id = persona.id);
    delete from rol_permiso where rol_id in (select id from rol where codigo like ${literal(`${PREFIJO_ROL}%`)});
    delete from rol r where r.codigo like ${literal(`${PREFIJO_ROL}%`)}
       and not exists (select 1 from usuario_rol ur where ur.rol_id = r.id);
    commit;`)

  // La empresa B: lo suyo y ella. Si algo la ata —una auditoría—, se suspende.
  const empresas = consultar(`select id from organizacion where codigo like ${literal(`${PREFIJO_EMPRESA}%`)}`)
  for (const { id } of empresas) {
    sql(`
      begin;
      delete from usuario_rol where usuario_id in (select id from usuario where organizacion_id = ${id});
      delete from usuario_rol where rol_id in (select id from rol where organizacion_id = ${id});
      delete from usuario u where u.organizacion_id = ${id}
         and not exists (select 1 from auditoria a where a.usuario_id = u.id);
      delete from rol_permiso where rol_id in (select id from rol where organizacion_id = ${id});
      delete from rol r where r.organizacion_id = ${id}
         and not exists (select 1 from usuario_rol ur where ur.rol_id = r.id);
      delete from parametro where organizacion_id = ${id};
      delete from aviso_portal where organizacion_id = ${id};
      delete from organizacion o where o.id = ${id}
         and not exists (select 1 from auditoria a where a.organizacion_id = o.id)
         and not exists (select 1 from usuario u where u.organizacion_id = o.id)
         and not exists (select 1 from vacante v where v.organizacion_id = o.id);
      update organizacion set es_activa = false where id = ${id};
      commit;`)
  }
  sql(`delete from persona p where p.apellidos = 'Talento B'
         and not exists (select 1 from usuario u where u.persona_id = p.id);`)

  if (rolPrestado !== null) {
    sql(`delete from usuario_rol where usuario_id = ${usuarioDelEquipo()} and rol_id = ${rolPrestado};`)
  }
}
