import { expect } from '@playwright/test'
import { borrarCuentasDePrueba, crearCuentaDeCandidato, test, tokenDelCandidato } from './ayuda-candidato'
import { configuracion, correoDePrueba, limpiarSiempre, literal, sql } from './base-de-datos'
import {
  consultar,
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
  pedir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, escribirPrueba, lugarDe, publicarPrueba } from './ayuda-prueba-propia'
import {
  borrarLoDeWhatsapp,
  celularUnico,
  comoElBot,
  contextoComoElBot,
  DIRECCION_DEL_CONTEXTO,
  direccionDelBot,
  firmaDelBot,
  loQueRecibioElBot,
  novedadesDe,
  ponerLaBeta,
} from './ayuda-whatsapp'

/**
 * QA del contexto y los resultados por WhatsApp (V76 del backend, contrato v2, C-1 a C-3), contra
 * el preview del clon con el bot falso y el productor v2 APAGADO (su valor por defecto):
 *
 *   - la consulta firmada `POST /api/v2/integraciones/whatsapp/contexto` haciendo de bot;
 *   - la ficha pública (sin importes ocultos ni la compensación antigua), el procedimiento real,
 *     la situación, la acción con sus plazos y el resultado consultable;
 *   - que consultar no empieza nada, ni desde el chat ni al abrir «Mis procesos»;
 *   - el listado de 9 en 9 con su cursor atado al número;
 *   - BAJA, cambio de celular, dejar de recibir y borrado de datos;
 *   - el formato de la regla 19 en los avisos de prueba disponible y de avance.
 *
 * Los eventos v2 hacia el bot (RESULTADO / CONVOCATORIA_CERRADA) solo nacen con el productor
 * encendido: aquí se comprueba que con él apagado no nace ninguno (AC-18); su envío lo cubre
 * FlujoContextoYResultadosWhatsappIT del backend.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-WA2-0076).
 */

const MARCA = 'QA-WA2-0076'
const PREFIJO = 'qa.wa2.0076'
const PRINCIPAL = 'Analista de Tesorería'
const COMO_ENTRAR = 'Inicia sesión con tu correo y contraseña y abre «Mis procesos».'
const PORTAL = configuracion().E2E_PORTAL.replace(/\/$/, '')

const FICHA = {
  proposito: 'Que la caja de las tres sedes cuadre cada día.',
  responsabilidades: 'Conciliar los bancos y preparar el flujo de caja de la semana.',
  requisitos: 'Dos años en tesorería y Excel intermedio.',
  modalidad: 'Presencial',
  horario: 'Lunes a viernes de 8:00 a 17:00',
  ubicacion: 'Cercado de Lima',
}
/** El campo antiguo de compensación, que ya no se usa: nunca debe viajar. */
const COMPENSACION_ANTIGUA = 'S/ 4 321 al mes (texto antiguo)'

/** Las once vacantes de Paula: más de diez procesos consultables para un mismo número. */
const DE_PAULA = [
  { clave: 'cuestionario', titulo: 'Cajero de Agencia' },
  { clave: 'simulacion', titulo: 'Asistente de Simulación' },
  { clave: 'cajaMiraflores', titulo: 'Auxiliar de Caja', ubicacion: 'Miraflores' },
  { clave: 'cajaSurco', titulo: 'Auxiliar de Caja', ubicacion: 'Surco' },
  { clave: 'contratado', titulo: 'Gestor de Cobranzas' },
  { clave: 'noContinua', titulo: 'Analista de Créditos' },
  { clave: 'cerrada', titulo: 'Asesor Comercial' },
  { clave: 'otraEmpresa', titulo: 'Operador Logístico' },
  { clave: 'eliminada', titulo: 'Asistente Administrativo' },
  { clave: 'recepcion', titulo: 'Recepcionista' },
  { clave: 'digitador', titulo: 'Digitador' },
] as const
type ClaveDePaula = (typeof DE_PAULA)[number]['clave']

/** Las claves que puede llevar una respuesta de la consulta: nada fuera del contrato (C-3). */
const CLAVES_DEL_CONTRATO = new Set([
  'postulaciones', 'cursor', 'consultadoEn', 'postulacionRef', 'vacante', 'titulo', 'distintivo',
  'situacion', 'resultado', 'convocatoria', 'actualizadaEn', 'actualizadoEn', 'revisionContexto',
  'ref', 'empresa', 'estado', 'cerradaEn', 'revision', 'ficha', 'descripcion', 'proposito',
  'responsabilidades', 'requisitos', 'ubicacion', 'modalidad', 'horario', 'remuneracion',
  'tipoContrato', 'beneficios', 'texto', 'procedimiento', 'codigo', 'nombre', 'explicacion', 'orden',
  'etapaCodigo', 'momento', 'accion', 'tipo', 'instrucciones', 'ingreso', 'enlace', 'duracionMinutos',
  'plazoDias', 'empezarAntesDe', 'iniciadaEn', 'entregarAntesDe', 'zonaHoraria', 'fecha',
  'esCorreccion', 'consultableHasta',
])

const correos: string[] = []
const celulares: string[] = []
let equipo = ''
let principal = 0
const vacantes = {} as Record<ClaveDePaula, number>
let betaAntes = 'false'
let otraEmpresa = 0

interface Cuenta {
  nombre: string
  correo: string
  token: string
  celular: ReturnType<typeof celularUnico>
}
interface Proceso {
  uuid: string
  id: number
  ref: string
}

let ana: Cuenta
let beto: Cuenta
let paula: Cuenta
let deAna: Proceso
let deBeto: Proceso
const dePaula = {} as Record<ClaveDePaula, Proceso>

// ---------------------------------------------------------------- ayudas

async function cuentaCon(nombre: string): Promise<Cuenta> {
  const correo = correoDePrueba(PREFIJO)
  const celular = celularUnico()
  correos.push(correo)
  celulares.push(celular.e164)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Prueba V76', correo, telefono: celular.escrito })
  return { nombre, correo, token: await tokenDelCandidato(correo), celular }
}

/** Postula, la deja esperando su calificación y pulsa «Escribir por WhatsApp» (anuncio vivo). */
async function postularYAnunciar(cuenta: Cuenta, vacante: number): Promise<Omit<Proceso, 'ref'>> {
  const uuid = await postular(cuenta.token, vacante)
  sql(`update postulacion set estado_codigo = 'PERFIL_CALIFICANDO'
        where uuid = ${literal(uuid)} and estado_codigo = 'POSTULADA';`)
  await exigir(`/portal/postulaciones/${uuid}/whatsapp`, cuenta.token, 'POST')
  return { uuid, id: postulacionPorUuid(uuid) }
}

/** El bot recibe un mensaje de ese número: sus anuncios vivos quedan ACTIVOS. */
async function escribeAlBot(cuenta: Cuenta): Promise<void> {
  const r = await comoElBot('/vinculos', 'POST', {
    telefono: cuenta.celular.e164,
    wamid: `wamid.${MARCA}.${Date.now()}`,
    texto: 'hola',
  })
  expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
}

const referenciaDe = (postulacion: number): string =>
  String(uno(`select referencia from vinculo_whatsapp where postulacion_id = ${postulacion}
               order by id desc limit 1`).referencia)

async function conVinculo(cuenta: Cuenta, vacante: number): Promise<Proceso> {
  const p = await postularYAnunciar(cuenta, vacante)
  return { ...p, ref: '' }
}

const listar = (cuenta: Cuenta | string, cursor?: string) =>
  contextoComoElBot({ telefono: typeof cuenta === 'string' ? cuenta : cuenta.celular.e164, ...(cursor ? { cursor } : {}) })
const detalle = (cuenta: Cuenta | string, postulacionRef: string) =>
  contextoComoElBot({ telefono: typeof cuenta === 'string' ? cuenta : cuenta.celular.e164, postulacionRef })

async function listadoOk(cuenta: Cuenta | string, cursor?: string): Promise<any> {
  const r = await listar(cuenta, cursor)
  expect(r.estado, r.crudo).toBe(200)
  dentroDelContrato(r.cuerpo)
  return r.cuerpo
}

async function detalleOk(cuenta: Cuenta | string, ref: string): Promise<any> {
  const r = await detalle(cuenta, ref)
  expect(r.estado, r.crudo).toBe(200)
  dentroDelContrato(r.cuerpo)
  return r.cuerpo
}

/** Todas las páginas del listado de un número. */
async function todoElListado(cuenta: Cuenta | string): Promise<any[]> {
  const filas: any[] = []
  let cursor: string | undefined
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const pagina = await listadoOk(cuenta, cursor)
    filas.push(...pagina.postulaciones)
    if (!pagina.cursor) return filas
    cursor = pagina.cursor
  }
  throw new Error('El listado no terminó en cinco páginas')
}

async function sinAcceso(r: Promise<{ estado: number; cuerpo: any; crudo: string }>): Promise<any> {
  const respuesta = await r
  expect(respuesta.estado, respuesta.crudo).toBe(404)
  expect(respuesta.cuerpo.codigo).toBe('SIN_ACCESO')
  return respuesta.cuerpo
}

/** Ninguna clave fuera del contrato: ni ids internos, ni notas, ni la ficha administrativa. */
function dentroDelContrato(json: unknown): void {
  const fuera: string[] = []
  const recorrer = (valor: unknown) => {
    if (Array.isArray(valor)) valor.forEach(recorrer)
    else if (valor && typeof valor === 'object') {
      for (const [clave, hijo] of Object.entries(valor)) {
        if (!CLAVES_DEL_CONTRATO.has(clave)) fuera.push(clave)
        recorrer(hijo)
      }
    }
  }
  recorrer(json)
  expect(fuera, 'Claves fuera del contrato v2').toEqual([])
}

const ms = (iso: string | null | undefined): number | null => (iso ? Date.parse(iso) : null)

/** Un instante de la base, truncado a milisegundos (como lo manda EX). */
function msDe(expresion: string, desde: string): number | null {
  const f = uno(`select (extract(epoch from date_trunc('milliseconds', ${expresion})) * 1000)::bigint as ms from ${desde}`)
  return f.ms === null ? null : Number(f.ms)
}

/** «20 de octubre a las 23:59» en hora de Lima, con el año solo si no es el actual. */
function fechaEnLima(instante: number): string {
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instante))
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  const anoActual = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date())
  const dia = `${Number(parte('day'))} de ${parte('month')}`
  return `${parte('year') === anoActual ? dia : `${dia} de ${parte('year')}`} a las ${parte('hour')}:${parte('minute')}`
}

/**
 * El enlace fijo a «Mis procesos» (regla 8, C-3): https, sin parámetros, fragmento, usuario ni
 * token. El clon sirve el portal por http, así que ahí EX no tiene un enlace válido y no lo manda.
 */
function enlaceDelContrato(enlace: string | null): void {
  if (PORTAL.startsWith('https://')) {
    expect(enlace).toBe(`${PORTAL}/procesos`)
  } else {
    expect(enlace).toBeNull()
  }
}

/** Los enlaces de un aviso: ninguno lleva token, parámetros ni credenciales. */
function sinEnlacesConToken(texto: string): void {
  for (const url of texto.match(/https?:\/\/\S+/g) ?? []) {
    expect(url).toMatch(/^https:\/\/[^\s?#@]+$/)
    expect(url.toLowerCase()).not.toContain('token')
  }
  expect(texto.toLowerCase()).not.toContain('token')
  expect(texto).not.toContain('/acceso')
}

/** El cierre de un aviso de la regla 19: el enlace fijo (si EX tiene uno válido) y cómo entrar. */
function cierreDelAviso(): string {
  return PORTAL.startsWith('https://') ? `\n\n👉 ${PORTAL}/procesos\n${COMO_ENTRAR}` : `\n\n${COMO_ENTRAR}`
}

/** Lo que una consulta NO puede tocar: estado, historial, intentos, evaluaciones, avisos y vínculos. */
function huellaDe(postulacion: number): string {
  return JSON.stringify(consultar(`
    select p.estado_codigo, p.movido_en,
           (select count(*) from transicion_estado t where t.postulacion_id = p.id) as transiciones,
           (select json_agg(json_build_array(i.id, i.iniciado_en, i.vence_en, i.entregado_en, i.no_completada) order by i.id)
              from intento_prueba i where i.postulacion_id = p.id) as intentos,
           (select json_agg(json_build_array(e.id, e.estado, e.iniciada_en, e.vence_en, e.terminada_en) order by e.id)
              from evaluacion e where e.id in (p.evaluacion_id, p.evaluacion_tecnica_id)) as evaluaciones,
           (select count(*) from aviso_whatsapp a where a.postulacion_id = p.id) as avisos,
           (select json_agg(json_build_array(v.id, v.estado, v.motivo_cierre) order by v.id)
              from vinculo_whatsapp v where v.postulacion_id = p.id) as vinculos,
           (select count(*) from resultado_whatsapp r where r.postulacion_id = p.id) as resultados,
           (select count(*) from evento_whatsapp e where e.postulacion_id = p.id) as eventos
      from postulacion p where p.id = ${postulacion}`))
}

async function mover(postulacion: number, estadoDestino: string, avisar: boolean, motivo = `${MARCA}: la mueve la QA`) {
  await exigir(`/panel/postulaciones/${postulacion}/transiciones`, equipo, 'POST', { estadoDestino, motivo, avisar })
}

async function hastaQueLlegue(e164: string, tipo: string, cuantas = 1) {
  await expect
    .poll(async () => (await loQueRecibioElBot(e164)).filter((l) => l.tipo === tipo).length, {
      timeout: 40_000,
      intervals: [500, 1_000, 2_000],
    })
    .toBeGreaterThanOrEqual(cuantas)
}

async function revocacionesDe(e164: string): Promise<{ ref: string; motivo: string }[]> {
  return (await loQueRecibioElBot(e164))
    .filter((l) => l.tipo === 'REVOCACION')
    .map((l) => ({ ref: l.cuerpo.postulacionRef, motivo: String(l.cuerpo.motivo) }))
}

const eventosV2Para = (postulaciones: number[]): number =>
  Number(uno(`select count(*) as n from evento_whatsapp where postulacion_id in (${postulaciones.join(',')})`).n)

/**
 * Una vacante publicada a mano, sin instrumentos y sin evaluación inicial (no tiene preguntas con
 * que armarla): basta para postular y consultar.
 */
async function vacanteSencilla(titulo: string, ubicacion: string | null, lugar: { areaId: number; puestoId: number }): Promise<number> {
  const id = await crearVacante(equipo, titulo, lugar, undefined, MARCA)
  sql(`update vacante set estado = 'PUBLICADA', publicada_en = now(), aplica_evaluacion = false,
                          ubicacion = ${literal(ubicacion)}
        where id = ${id};`)
  return id
}

// ---------------------------------------------------------------- las pruebas

test.describe('El contexto y los resultados por WhatsApp (v2), haciendo de bot contra el clon', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    test.setTimeout(240_000)
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)

    // La vacante principal, como la publica el equipo: preguntas, prueba cronometrada de 90
    // minutos con su fecha límite y publicación. Su ficha pública se rellena aparte.
    principal = await crearVacante(equipo, PRINCIPAL, lugar, undefined, MARCA)
    await escribirBorrador(equipo, principal, [
      {
        nombre: 'General',
        preguntas: [
          { tipo: 'ABIERTA', enunciado: 'Cuéntanos una conciliación difícil.', puntos: 100, queDebeTener: 'El monto y la causa.' },
        ],
      },
    ])
    await publicarPreguntas(equipo, principal)
    await escribirPrueba(equipo, principal, {
      criterios: [
        {
          nombre: 'Caja',
          puntosCalificados: 100,
          calificador: 'IA',
          preguntas: [{ tipo: 'ABIERTA', enunciado: 'PREGUNTA-INTERNA-QA ¿Cómo cuadrarías la caja?', queDebeTener: 'El arqueo.' }],
        },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'GUIA-INTERNA-QA mira el arqueo.' },
    })
    const publicada = await publicarPrueba(equipo, principal)
    if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
    await exigir(`/panel/vacantes/${principal}/publicacion`, equipo, 'POST')
    await exigir(`/panel/vacantes/${principal}/calificacion-automatica`, equipo, 'POST', { activa: false })
    sql(`update vacante set proposito = ${literal(FICHA.proposito)}, responsabilidades = ${literal(FICHA.responsabilidades)},
                            requisitos = ${literal(FICHA.requisitos)}, modalidad = ${literal(FICHA.modalidad)},
                            horario = ${literal(FICHA.horario)}, ubicacion = ${literal(FICHA.ubicacion)},
                            compensacion_publica = ${literal(COMPENSACION_ANTIGUA)}
          where id = ${principal};`)

    for (const v of DE_PAULA) {
      vacantes[v.clave] = await vacanteSencilla(v.titulo, 'ubicacion' in v ? v.ubicacion : null, lugar)
    }
    betaAntes = await ponerLaBeta(equipo, true)
  })

  test.afterAll(async () => {
    await limpiarSiempre([
      () => ponerLaBeta(equipo, betaAntes === 'true').then(() => undefined),
      () => borrarLoDeWhatsapp(celulares),
      () => borrarCuentasDePrueba(correos),
      () => {
        sql(`update vacante set eliminada_en = now() where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null;`)
        sql(`update solicitud_talento set estado = 'ARCHIVADA'
              where motivo like ${literal(`${MARCA}%`)} and estado <> 'ARCHIVADA';`)
        if (otraEmpresa) sql(`update organizacion set es_activa = false where id = ${otraEmpresa};`)
      },
    ])
  })

  test('AC-19 · sin firma, de otra ruta, otro secreto, fuera de plazo u otro cuerpo: 401; lo que no vale, 400; sin procesos, lista vacía', async () => {
    const nadie = celularUnico()
    celulares.push(nadie.e164)
    const cuerpo = { telefono: nadie.e164 }
    const texto = JSON.stringify(cuerpo)
    const ahora = Math.floor(Date.now() / 1000)

    const rechazos = {
      sinFirma: await contextoComoElBot(cuerpo, { firma: null }),
      firmadaParaV1: await contextoComoElBot(cuerpo, { firma: firmaDelBot(direccionDelBot('/novedades'), texto) }),
      firmadaParaOtraRutaV2: await contextoComoElBot(cuerpo, {
        firma: firmaDelBot(DIRECCION_DEL_CONTEXTO.replace(/\/contexto$/, '/otra'), texto),
      }),
      otroSecreto: await contextoComoElBot(cuerpo, { firma: firmaDelBot(DIRECCION_DEL_CONTEXTO, texto, { secreto: 'otro-secreto' }) }),
      marcaVieja: await contextoComoElBot(cuerpo, { firma: firmaDelBot(DIRECCION_DEL_CONTEXTO, texto, { marca: ahora - 6 * 60 }) }),
      marcaFutura: await contextoComoElBot(cuerpo, { firma: firmaDelBot(DIRECCION_DEL_CONTEXTO, texto, { marca: ahora + 6 * 60 }) }),
      otroCuerpo: await contextoComoElBot(cuerpo, { texto: JSON.stringify({ telefono: '+51900000000' }) }),
    }
    for (const [caso, r] of Object.entries(rechazos)) {
      expect(r.estado, `${caso}: ${r.crudo}`).toBe(401)
      expect(r.cuerpo?.codigo, caso).toBe('FIRMA_INVALIDA')
    }

    // Bien firmada y sin procesos: 200 con la lista vacía. No es un error ni un descarte.
    const vacia = await listadoOk(nadie.e164)
    expect(vacia).toEqual({ postulaciones: [], cursor: null, consultadoEn: expect.any(String) })
    expect(Math.abs(Date.parse(vacia.consultadoEn) - Date.now())).toBeLessThan(60_000)

    // Lo que no cumple el contrato: 400 VALIDACION.
    const malos: unknown[] = [
      {},
      { telefono: 'no-es-un-numero' },
      { telefono: nadie.e164, postulacionRef: `pw_${'0'.repeat(32)}`, cursor: 'c1.1.abc' },
      { telefono: nadie.e164, postulacionRef: 'x'.repeat(65) },
      { telefono: nadie.e164, cursor: 'c'.repeat(201) },
    ]
    for (const malo of malos) {
      const r = await contextoComoElBot(malo)
      expect(r.estado, `${JSON.stringify(malo)}: ${r.crudo}`).toBe(400)
      expect(r.cuerpo.codigo).toBe('VALIDACION')
    }
    const roto = await contextoComoElBot(null, { firma: firmaDelBot(DIRECCION_DEL_CONTEXTO, '{roto'), texto: '{roto' })
    expect(roto.estado, roto.crudo).toBe(400)
    expect(roto.cuerpo.codigo).toBe('VALIDACION')

    // Sin efectos: ni vínculo, ni baja, para ese número.
    expect(Number(uno(`select count(*) as n from vinculo_whatsapp where telefono = ${literal(nadie.e164)}`).n)).toBe(0)
    expect(Number(uno(`select count(*) as n from whatsapp_baja where telefono = ${literal(nadie.e164)}`).n)).toBe(0)
  })

  test('AC-01/03/04/05/06/07 · Ana: listado y ficha pública, sin importes ocultos ni datos internos; en revisión, sin tarea', async () => {
    ana = await cuentaCon('Ana')
    beto = await cuentaCon('Beto')
    const a = await postularYAnunciar(ana, principal)
    await escribeAlBot(ana)
    const b = await postularYAnunciar(beto, principal)
    await escribeAlBot(beto)
    deAna = { ...a, ref: referenciaDe(a.id) }
    deBeto = { ...b, ref: referenciaDe(b.id) }
    expect(deAna.ref).toMatch(/^pw_[0-9a-f]{32}$/)
    const antes = huellaDe(deAna.id)
    const titulo = `${MARCA} ${PRINCIPAL}`

    // El listado: solo la suya, con referencia, título, distintivo y situación.
    const lista = await listadoOk(ana)
    expect(lista).toEqual({
      postulaciones: [{
        postulacionRef: deAna.ref,
        vacante: { titulo, distintivo: expect.any(String) },
        situacion: 'ACTIVA',
        resultado: null,
        convocatoria: 'PUBLICADA',
        actualizadaEn: expect.any(String),
      }],
      cursor: null,
      consultadoEn: expect.any(String),
    })
    expect(lista.postulaciones[0].vacante.distintivo).toContain(FICHA.ubicacion)

    // El contexto: la ficha pública, campo a campo, y nada de la administrativa.
    const c = await detalleOk(ana, deAna.ref)
    expect(Object.keys(c).sort()).toEqual(['accion', 'actualizadoEn', 'consultadoEn', 'postulacionRef', 'procedimiento',
      'resultado', 'revisionContexto', 'situacion', 'vacante'])
    expect(c.postulacionRef).toBe(deAna.ref)
    expect(c.vacante.ref).toMatch(/^vc_[0-9a-f]{32}$/)
    expect(c.vacante.titulo).toBe(titulo)
    expect(c.vacante.convocatoria).toEqual({ estado: 'PUBLICADA', cerradaEn: null, revision: 0 })
    const descripcion = String(uno(`select descripcion from vacante where id = ${principal}`).descripcion)
    const publicado = (texto: string) => ({ estado: 'PUBLICADO', texto })
    const noPublicado = { estado: 'NO_PUBLICADO', texto: null }
    expect(c.vacante.ficha).toEqual({
      descripcion: publicado(descripcion),
      proposito: publicado(FICHA.proposito),
      responsabilidades: publicado(FICHA.responsabilidades),
      requisitos: { estado: 'PUBLICADO', texto: expect.stringContaining(FICHA.requisitos) },
      ubicacion: { estado: 'PUBLICADO', texto: expect.stringContaining(FICHA.ubicacion) },
      modalidad: publicado(FICHA.modalidad),
      horario: publicado(FICHA.horario),
      remuneracion: noPublicado,
      tipoContrato: noPublicado,
      beneficios: noPublicado,
    })
    const legible = JSON.stringify(c)
    for (const prohibido of ['4 321', '4321', 'texto antiguo', 'PREGUNTA-INTERNA-QA', 'GUIA-INTERNA-QA', deAna.uuid, ana.correo]) {
      expect(legible, `no debe viajar «${prohibido}»`).not.toContain(prohibido)
    }

    // AC-06 · el procedimiento real de esta vacante: evaluación inicial y prueba cronometrada.
    const aplicaEvaluacion = uno(`select aplica_evaluacion from vacante where id = ${principal}`).aplica_evaluacion as unknown
    expect(c.procedimiento.map((e: any) => [e.codigo, e.orden, e.estado])).toEqual([
      ['PERFIL_INTEGRAL', 1, 'ACTUAL'],
      ['PRUEBA_PUESTO', 2, 'PREVISTA'],
      ['SIMULACION', 3, 'PREVISTA'],
      ['VALIDACION', 4, 'PREVISTA'],
      ['DECISION', 5, 'PREVISTA'],
    ])
    expect(c.procedimiento[0].explicacion).toBe(aplicaEvaluacion === false
      ? 'Se revisa tu currículum. Esta vacante no pide una evaluación escrita.'
      : 'Tu currículum y una evaluación escrita.')
    expect(c.procedimiento[1]).toMatchObject({ nombre: 'La prueba del puesto', explicacion: 'Un encargo real del puesto, con tiempo medido.' })

    // AC-08 · al postular le toca su evaluación inicial: sin cronómetro, con el vencimiento real.
    expect(uno(`select estado_codigo from postulacion where id = ${deAna.id}`).estado_codigo).toBe('PERFIL_TURNO_CANDIDATO')
    expect(c.situacion).toMatchObject({
      estado: 'ACTIVA', etapaCodigo: 'PERFIL_INTEGRAL', momento: 'TURNO_CANDIDATO',
      titulo: 'Tienes una evaluación pendiente',
      texto: 'Tus respuestas se guardan solas. Puedes salir y volver donde lo dejaste.',
    })
    const evaluacion = consultar(`select e.iniciada_en, (extract(epoch from date_trunc('milliseconds', e.vence_en)) * 1000)::bigint as vence
                                    from evaluacion e join postulacion p on p.evaluacion_id = e.id where p.id = ${deAna.id}`)
    const vence = evaluacion.length ? Number(evaluacion[0]!.vence) : null
    expect(c.accion).toMatchObject({
      tipo: 'EVALUACION_INICIAL', estado: 'HABILITADA', modalidad: 'PLAZO_ABIERTO', duracionMinutos: null,
      plazoDias: null, iniciadaEn: null, zonaHoraria: 'America/Lima',
      instrucciones: 'Tus respuestas se guardan solas. Puedes salir y volver donde lo dejaste.',
    })
    expect(ms(c.accion.empezarAntesDe)).toBe(vence)
    expect(ms(c.accion.entregarAntesDe)).toBe(vence)
    enlaceDelContrato(c.accion.enlace)
    expect(c.resultado).toBeNull()
    expect(Date.parse(c.consultadoEn)).toBeGreaterThanOrEqual(Date.parse(c.actualizadoEn))

    // AC-05 · un campo vacío es NO_PUBLICADO, no una condición.
    sql(`update vacante set horario = null where id = ${principal};`)
    expect((await detalleOk(ana, deAna.ref)).vacante.ficha.horario).toEqual(noPublicado)
    sql(`update vacante set horario = ${literal(FICHA.horario)} where id = ${principal};`)

    // AC-04 · fijo y rango con el texto del portal; oculto, ningún importe (ni el campo antiguo).
    const revisionOculta = c.revisionContexto
    sql(`update vacante set remuneracion_tipo = 'FIJA', remuneracion_min = 3500, remuneracion_moneda = 'PEN',
                            remuneracion_actualizada_en = now() where id = ${principal};`)
    const fija = await detalleOk(ana, deAna.ref)
    expect(fija.vacante.ficha.remuneracion).toEqual(publicado('S/ 3 500'))
    expect(fija.revisionContexto).toBeGreaterThan(revisionOculta)
    sql(`update vacante set remuneracion_tipo = 'RANGO', remuneracion_min = 3000, remuneracion_max = 4500,
                            remuneracion_actualizada_en = now() where id = ${principal};`)
    expect((await detalleOk(ana, deAna.ref)).vacante.ficha.remuneracion).toEqual(publicado('S/ 3 000 a 4 500'))
    sql(`update vacante set remuneracion_tipo = 'OCULTA', remuneracion_min = null, remuneracion_max = null,
                            remuneracion_moneda = null, remuneracion_actualizada_en = now() where id = ${principal};`)
    const oculta = await detalleOk(ana, deAna.ref)
    expect(oculta.vacante.ficha.remuneracion).toEqual(noPublicado)
    const vacanteOculta = JSON.stringify({ ...oculta.vacante, ref: undefined })
    for (const importe of ['S/', '3 500', '3500', '3 000', '4 500', '4500', '4 321', '4321']) {
      expect(vacanteOculta, `con el sueldo oculto no viaja «${importe}»`).not.toContain(importe)
    }

    // AC-01 · una referencia ajena, inventada o con otra forma: el mismo 404, sin datos.
    const ajena = await sinAcceso(detalle(ana, deBeto.ref))
    expect(await sinAcceso(detalle(ana, `pw_${'0'.repeat(32)}`))).toEqual(ajena)
    expect(await sinAcceso(detalle(ana, 'cualquier-cosa'))).toEqual(ajena)
    expect(await sinAcceso(detalle(beto, deAna.ref))).toEqual(ajena)
    expect(JSON.stringify(ajena)).not.toContain(PRINCIPAL)
    expect((await detalleOk(beto, deBeto.ref)).postulacionRef).toBe(deBeto.ref)
    expect((await listadoOk(beto)).postulaciones.map((p: any) => p.postulacionRef)).toEqual([deBeto.ref])

    // Solo lectura: nada de lo de Ana cambió por consultar (ni su evaluación empezó).
    expect(huellaDe(deAna.id)).toBe(antes)

    // AC-07 · su perfil pasa a revisión: la situación lo dice y no hay tarea pendiente.
    await mover(deAna.id, 'PERFIL_POR_CONFIRMAR', false, `${MARCA}: perfil en revisión`)
    const enRevision = await detalleOk(ana, deAna.ref)
    expect(enRevision.situacion).toMatchObject({
      estado: 'ACTIVA', etapaCodigo: 'PERFIL_INTEGRAL', momento: 'POR_CONFIRMAR', titulo: 'Tu perfil está en revisión',
      texto: 'Una persona del equipo revisa el resultado y confirma si continúas.',
    })
    expect(enRevision.accion).toBeNull()
    expect(enRevision.procedimiento.map((e: any) => e.estado)).toEqual(['ACTUAL', 'PREVISTA', 'PREVISTA', 'PREVISTA', 'PREVISTA'])
  })

  test('AC-08/AC-22/AC-23 · prueba habilitada: aviso con la regla 19, plazos reales, y consultar o abrir «Mis procesos» no la empieza', async ({ page, browser }, testInfo) => {
    await mover(deAna.id, 'PRUEBA_TURNO_CANDIDATO', true, `${MARCA}: pasa a la prueba`)
    await hastaQueLlegue(ana.celular.e164, 'AVISO')
    const avisos = (await loQueRecibioElBot(ana.celular.e164)).filter((l) => l.tipo === 'AVISO')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]!.cuerpo.tipo).toBe('PRUEBA_DISPONIBLE')

    // El plazo para empezar es el real: el del intento sin empezar o, sin él, el cierre de la prueba.
    const intento = consultar(`select (extract(epoch from date_trunc('milliseconds', vence_en)) * 1000)::bigint as vence,
                                      iniciado_en from intento_prueba where postulacion_id = ${deAna.id}`)
    const cierre = msDe('prueba_cierra_en', `vacante where id = ${principal}`)
    const empezar = intento.length && intento[0]!.iniciado_en === null && intento[0]!.vence !== null
      ? Number(intento[0]!.vence) : cierre
    expect(empezar, 'la vacante tiene fecha límite de la prueba').not.toBeNull()

    // AC-23 · el aviso con el formato de la regla 19, sin superar 1000 caracteres.
    const texto = String(avisos[0]!.cuerpo.texto)
    const esperado = `¡Felicidades, Ana! 🎉\n\n📌 *${MARCA} ${PRINCIPAL}*\nTu *prueba del puesto* ya está disponible.\n`
      + `⏰ Puedes empezarla hasta el *${fechaEnLima(empezar!)}* (hora de Lima).${cierreDelAviso()}`
    expect(texto).toBe(esperado)
    expect(texto.length).toBeLessThanOrEqual(1000)
    sinEnlacesConToken(texto)

    // AC-08/AC-22 · la acción: habilitada, cronometrada de 90 minutos, con su fecha para empezar.
    const c = await detalleOk(ana, deAna.ref)
    expect(c.situacion).toMatchObject({ estado: 'ACTIVA', etapaCodigo: 'PRUEBA_PUESTO', momento: 'TURNO_CANDIDATO',
      titulo: 'Prueba del puesto habilitada' })
    expect(c.procedimiento.map((e: any) => e.estado)).toEqual(['HECHA', 'ACTUAL', 'PREVISTA', 'PREVISTA', 'PREVISTA'])
    expect(c.accion).toMatchObject({
      tipo: 'PRUEBA_PUESTO', estado: 'HABILITADA', modalidad: 'CRONOMETRADA', duracionMinutos: 90, plazoDias: null,
      iniciadaEn: null, entregarAntesDe: null, zonaHoraria: 'America/Lima',
      instrucciones: 'El cronómetro empieza cuando confirmes, y no se detiene al cerrar la página.',
    })
    expect(ms(c.accion.empezarAntesDe)).toBe(empezar)
    expect(c.accion.ingreso).toContain('Inicia sesión en el portal con tu correo y contraseña')
    enlaceDelContrato(c.accion.enlace)
    expect(JSON.stringify(c)).not.toContain('PREGUNTA-INTERNA-QA')

    // Consultar una y otra vez no inicia el intento ni toca nada.
    const antes = huellaDe(deAna.id)
    for (let vez = 0; vez < 3; vez++) {
      await detalleOk(ana, deAna.ref)
      await listadoOk(ana)
    }
    expect(huellaDe(deAna.id)).toBe(antes)

    // «Mis procesos» con su sesión: la prueba sigue ahí, sin empezar. Abrir la lista tampoco la empieza.
    await entrarAlPortalCon(page, ana.token)
    await page.goto('/procesos')
    await expect(page.getByRole('link', { name: /Abrir prueba/ }).first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('ana-mis-procesos-prueba-sin-empezar.png'), fullPage: true })
    expect(huellaDe(deAna.id)).toBe(antes)

    // Sin sesión, la dirección de «Mis procesos» no da acceso: pide ingresar.
    const anonimo = await browser.newContext({ baseURL: PORTAL })
    try {
      const sinSesion = await anonimo.newPage()
      await sinSesion.goto('/procesos')
      await expect(sinSesion.getByRole('heading', { name: 'Ingresa para ver tu proceso.' })).toBeVisible()
      await expect(sinSesion.getByRole('link', { name: /Abrir prueba/ })).toHaveCount(0)
      await sinSesion.screenshot({ path: testInfo.outputPath('mis-procesos-sin-sesion.png'), fullPage: true })
    } finally {
      await anonimo.close()
    }

    // Empezada desde el portal: EN_CURSO, con su inicio y su límite de entrega reales.
    const inicio = await pedir(`/portal/prueba/${deAna.uuid}/inicio`, ana.token, 'POST')
    expect(inicio.estado, JSON.stringify(inicio.cuerpo).slice(0, 300)).toBe(200)
    const enCurso = await detalleOk(ana, deAna.ref)
    expect(enCurso.accion).toMatchObject({ tipo: 'PRUEBA_PUESTO', estado: 'EN_CURSO', modalidad: 'CRONOMETRADA', duracionMinutos: 90,
      instrucciones: 'Ya la empezaste: entrégala en el portal antes del límite. El tiempo sigue corriendo aunque cierres la página.' })
    expect(ms(enCurso.accion.iniciadaEn)).toBe(msDe('iniciado_en', `intento_prueba where postulacion_id = ${deAna.id}`))
    expect(ms(enCurso.accion.entregarAntesDe)).toBe(msDe('vence_en', `intento_prueba where postulacion_id = ${deAna.id}`))
    expect(ms(enCurso.accion.empezarAntesDe)).toBe(cierre)
    enlaceDelContrato(enCurso.accion.enlace)
    expect(enCurso.revisionContexto).toBeGreaterThan(c.revisionContexto)
  })

  test('AC-10 · la convocatoria cierra con la prueba en curso: la consulta lo separa y nada se cierra por eso', async () => {
    const antes = await detalleOk(ana, deAna.ref)
    const estadoDeBeto = String(uno(`select estado_codigo from postulacion where id = ${deBeto.id}`).estado_codigo)
    await exigir(`/panel/vacantes/${principal}/cierre`, equipo, 'POST', { motivo: `${MARCA}: cierre de la convocatoria` })

    const c = await detalleOk(ana, deAna.ref)
    expect(c.vacante.convocatoria).toMatchObject({ estado: 'CERRADA', revision: 1 })
    expect(ms(c.vacante.convocatoria.cerradaEn)).toBe(msDe('cerrada_en', `vacante where id = ${principal}`))
    expect(c.situacion).toMatchObject({ estado: 'ACTIVA', etapaCodigo: 'PRUEBA_PUESTO', momento: 'TURNO_CANDIDATO' })
    expect(c.accion).toMatchObject({ tipo: 'PRUEBA_PUESTO', estado: 'EN_CURSO' })
    expect(c.resultado).toBeNull()
    expect(c.revisionContexto).toBeGreaterThan(antes.revisionContexto)

    const fila = (await listadoOk(ana)).postulaciones[0]
    expect(fila).toMatchObject({ postulacionRef: deAna.ref, situacion: 'ACTIVA', resultado: null, convocatoria: 'CERRADA' })
    expect((await listadoOk(beto)).postulaciones[0]).toMatchObject({ situacion: 'ACTIVA', convocatoria: 'CERRADA' })

    // Ni la postulación ni el vínculo se cierran; con el productor apagado no nace ningún evento.
    for (const p of [deAna, deBeto]) {
      expect(uno(`select v.estado, p.estado_codigo from vinculo_whatsapp v join postulacion p on p.id = v.postulacion_id
                   where v.postulacion_id = ${p.id}`)).toEqual({
        estado: 'ACTIVO', estado_codigo: p === deAna ? 'PRUEBA_TURNO_CANDIDATO' : estadoDeBeto,
      })
    }
    expect(eventosV2Para([deAna.id, deBeto.id])).toBe(0)
    for (const quien of [ana, beto]) {
      const tipos = (await loQueRecibioElBot(quien.celular.e164)).map((l) => l.tipo)
      expect(tipos).not.toContain('EVENTO')
      expect(tipos).not.toContain('REVOCACION')
    }
  })

  test('AC-02 · Paula con once procesos: páginas de 9 y 2 sin perder ninguno; el cursor es de su número', async () => {
    test.setTimeout(180_000)
    paula = await cuentaCon('Paula')
    for (const v of DE_PAULA) {
      const p = await conVinculo(paula, vacantes[v.clave])
      dePaula[v.clave] = p
    }
    await escribeAlBot(paula)
    for (const v of DE_PAULA) dePaula[v.clave].ref = referenciaDe(dePaula[v.clave].id)

    const primera = await listadoOk(paula)
    expect(primera.postulaciones).toHaveLength(9)
    expect(typeof primera.cursor).toBe('string')
    expect(primera.cursor.length).toBeLessThanOrEqual(200)
    const segunda = await listadoOk(paula, primera.cursor)
    expect(segunda.postulaciones).toHaveLength(2)
    expect(segunda.cursor).toBeNull()

    const vistas = [...primera.postulaciones, ...segunda.postulaciones].map((p: any) => p.postulacionRef)
    expect(new Set(vistas).size).toBe(11)
    // Las más recientes primero.
    const enOrden = consultar(`select referencia from vinculo_whatsapp where telefono = ${literal(paula.celular.e164)}
                                 and estado = 'ACTIVO' order by id desc`).map((f) => String(f.referencia))
    expect(vistas).toEqual(enOrden)
    expect([...vistas].sort()).toEqual(DE_PAULA.map((v) => dePaula[v.clave].ref).sort())

    // El cursor no sirve con otro número, alterado ni inventado; y no se combina con una referencia.
    await sinAcceso(listar(ana, primera.cursor))
    const ultimo = primera.cursor.slice(-1)
    await sinAcceso(listar(paula, `${primera.cursor.slice(0, -1)}${ultimo === 'a' ? 'b' : 'a'}`))
    await sinAcceso(listar(paula, `c1.zz.${'0'.repeat(32)}`))
    const combinado = await contextoComoElBot({ telefono: paula.celular.e164, postulacionRef: dePaula.recepcion.ref, cursor: primera.cursor })
    expect(combinado.estado, combinado.crudo).toBe(400)
    expect(combinado.cuerpo.codigo).toBe('VALIDACION')

    // Una referencia concreta devuelve solo su contexto.
    const una = await detalleOk(paula, dePaula.recepcion.ref)
    expect(una.postulacionRef).toBe(dePaula.recepcion.ref)
    expect(una.vacante.titulo).toBe(`${MARCA} Recepcionista`)

    // Dos títulos iguales: el distintivo los separa con un dato público (su zona).
    const caja = [...primera.postulaciones, ...segunda.postulaciones].filter((p: any) => p.vacante.titulo === `${MARCA} Auxiliar de Caja`)
    expect(caja).toHaveLength(2)
    expect(caja[0].vacante.distintivo).not.toBe(caja[1].vacante.distintivo)
    expect(caja.map((p: any) => p.vacante.distintivo).join(' | ')).toMatch(/Miraflores/)
    expect(caja.map((p: any) => p.vacante.distintivo).join(' | ')).toMatch(/Surco/)
  })

  test('AC-06/AC-07/AC-23 · etapas reales: cuestionario sin evaluación inicial; simulación por habilitar y por elegir, con su aviso', async () => {
    // Una vacante con cuestionario técnico de 45 minutos y sin evaluación inicial.
    sql(`update vacante set instrumento_etapa_tecnica = 'CUESTIONARIO_TECNICO', aplica_evaluacion = false,
                            minutos_etapa_tecnica = 45 where id = ${vacantes.cuestionario};`)
    sql(`update postulacion set estado_codigo = 'PRUEBA_TURNO_CANDIDATO' where id = ${dePaula.cuestionario.id};`)
    const cuestionario = await detalleOk(paula, dePaula.cuestionario.ref)
    expect(cuestionario.procedimiento[0]).toMatchObject({ codigo: 'PERFIL_INTEGRAL', estado: 'HECHA',
      explicacion: 'Se revisa tu currículum. Esta vacante no pide una evaluación escrita.' })
    expect(cuestionario.procedimiento[1]).toMatchObject({ codigo: 'PRUEBA_PUESTO', estado: 'ACTUAL', nombre: 'La prueba técnica',
      explicacion: 'Preguntas sobre este puesto, que se responden escribiendo.' })
    expect(cuestionario.situacion).toMatchObject({ etapaCodigo: 'PRUEBA_PUESTO', titulo: 'Tu prueba técnica está lista' })
    expect(cuestionario.accion).toMatchObject({ tipo: 'CUESTIONARIO_TECNICO', estado: 'HABILITADA', modalidad: 'CRONOMETRADA',
      duracionMinutos: 45, plazoDias: null, iniciadaEn: null, entregarAntesDe: null })

    // Una vacante sin instrumento elegido no promete un tiempo medido.
    const sencilla = await detalleOk(paula, dePaula.recepcion.ref)
    expect(sencilla.procedimiento[1].explicacion).toBe('Un encargo real del puesto.')

    // Simulación por habilitar: prevista sin fecha, sin tarea ni cita.
    await mover(dePaula.simulacion.id, 'SIMULACION_POR_HABILITAR', false)
    const porHabilitar = await detalleOk(paula, dePaula.simulacion.ref)
    expect(porHabilitar.accion).toBeNull()
    expect(porHabilitar.situacion).toMatchObject({ etapaCodigo: 'SIMULACION', momento: 'POR_HABILITAR',
      titulo: 'Esperando una fecha de simulación' })
    expect(porHabilitar.procedimiento.map((e: any) => e.estado)).toEqual(['HECHA', 'HECHA', 'ACTUAL', 'PREVISTA', 'PREVISTA'])

    // Le toca elegir fecha: aviso de avance con la regla 19 y una acción sin fechas inventadas.
    await mover(dePaula.simulacion.id, 'SIMULACION_TURNO_CANDIDATO', true)
    await hastaQueLlegue(paula.celular.e164, 'AVISO')
    const avance = (await loQueRecibioElBot(paula.celular.e164)).filter((l) => l.tipo === 'AVISO')
    expect(avance).toHaveLength(1)
    expect(avance[0]!.cuerpo.tipo).toBe('POSTULACION_AVANZA')
    const texto = String(avance[0]!.cuerpo.texto)
    expect(texto).toBe(`Hola, Paula 👋\n\n📌 *${MARCA} Asistente de Simulación*\nTe toca: *Confirma tu simulación*\n`
      + `Elige una de las fechas disponibles. La sesión es grupal y dura dos horas.${cierreDelAviso()}`)
    expect(texto.length).toBeLessThanOrEqual(1000)
    sinEnlacesConToken(texto)
    const porElegir = await detalleOk(paula, dePaula.simulacion.ref)
    expect(porElegir.accion).toMatchObject({ tipo: 'SIMULACION', estado: 'HABILITADA', modalidad: null, duracionMinutos: null,
      plazoDias: null, empezarAntesDe: null, iniciadaEn: null, entregarAntesDe: null,
      instrucciones: 'Elige una de las fechas disponibles. La sesión es grupal y dura dos horas.' })
    enlaceDelContrato(porElegir.accion.enlace)
  })

  test('AC-09/AC-11/AC-18 · contratado, no continúa y cerrada: resultados distintos con fecha, sin causa interna; 30 días; v1 intacto', async () => {
    const finales = [
      { clave: 'contratado', tipo: 'CONTRATADO', avisar: true, motivo: `${MARCA}: motivo interno, sueldo pactado 9 876`, titulo: 'Te damos la bienvenida' },
      { clave: 'noContinua', tipo: 'NO_CONTINUA', avisar: false, motivo: `${MARCA}: motivo interno, nota 41 de 100`, titulo: 'Proceso finalizado' },
      { clave: 'cerrada', tipo: 'CERRADA', avisar: true, motivo: `${MARCA}: motivo interno, postulación duplicada`, titulo: 'Postulación cerrada' },
    ] as const
    for (const f of finales) await mover(dePaula[f.clave].id, f.tipo, f.avisar, f.motivo)

    const listado = await todoElListado(paula)
    expect(listado).toHaveLength(11)
    for (const f of finales) {
      const p = dePaula[f.clave]
      // Registrado con el hecho: tipo, fecha de la transición, revisión 1 y 30 días de consulta.
      const fila = uno(`select tipo, revision, es_correccion, acceso_revocado_en,
                               (extract(epoch from date_trunc('milliseconds', fecha)) * 1000)::bigint as fecha,
                               (extract(epoch from date_trunc('milliseconds', consultable_hasta)) * 1000)::bigint as hasta
                          from resultado_whatsapp where postulacion_id = ${p.id}`)
      const ocurrida = msDe('max(ocurrida_en)', `transicion_estado where postulacion_id = ${p.id} and estado_nuevo_codigo = ${literal(f.tipo)}`)
      expect(fila).toMatchObject({ tipo: f.tipo, revision: 1, es_correccion: false, acceso_revocado_en: null })
      expect(Number(fila.fecha)).toBe(ocurrida)
      expect(Number(fila.hasta) - Number(fila.fecha)).toBe(30 * 24 * 3_600_000)

      expect(listado.find((r: any) => r.postulacionRef === p.ref)).toMatchObject({ situacion: 'FINAL', resultado: f.tipo })
      const c = await detalleOk(paula, p.ref)
      expect(c.resultado).toEqual({ tipo: f.tipo, fecha: expect.any(String), revision: 1, explicacion: null,
        esCorreccion: false, consultableHasta: expect.any(String) })
      expect(ms(c.resultado.fecha)).toBe(ocurrida)
      expect(ms(c.resultado.consultableHasta)).toBe(Number(fila.hasta))
      expect(c.accion).toBeNull()
      expect(c.situacion).toMatchObject({ estado: 'FINAL', etapaCodigo: null, momento: null, titulo: f.titulo })
      expect(c.procedimiento.length).toBeGreaterThan(0)
      expect(c.procedimiento.every((e: any) => e.estado === 'HECHA')).toBe(true)
      const legible = JSON.stringify(c)
      for (const interno of ['motivo interno', '9 876', 'nota 41', 'duplicada']) expect(legible).not.toContain(interno)
    }
    // Los demás siguen activos, cada uno con su contexto.
    expect(listado.filter((r: any) => r.situacion === 'ACTIVA')).toHaveLength(8)

    // AC-18 · v1 sigue: la revocación PROCESO_TERMINADO de siempre y ningún evento v2 (productor apagado).
    const refsFinales = finales.map((f) => dePaula[f.clave].ref).sort()
    await expect
      .poll(async () => (await revocacionesDe(paula.celular.e164)).filter((r) => r.motivo === 'PROCESO_TERMINADO')
        .map((r) => r.ref).sort(), { timeout: 40_000, intervals: [500, 1_000, 2_000] })
      .toEqual(refsFinales)
    expect((await loQueRecibioElBot(paula.celular.e164)).map((l) => l.tipo)).not.toContain('EVENTO')
    expect(eventosV2Para(finales.map((f) => dePaula[f.clave].id))).toBe(0)
    const novedades = await novedadesDe(paula.celular.e164)
    expect(novedades.estado).toBe(200)
    const titulosVivos = novedades.cuerpo.novedades.map((n) => n.vacante)
    for (const f of finales) {
      expect(titulosVivos).not.toContain(`${MARCA} ${DE_PAULA.find((v) => v.clave === f.clave)!.titulo}`)
    }

    // Consultar no reabre ni habilita avisos: el vínculo terminado sigue cerrado.
    const huellas = finales.map((f) => huellaDe(dePaula[f.clave].id))
    for (const f of finales) await detalleOk(paula, dePaula[f.clave].ref)
    expect(finales.map((f) => huellaDe(dePaula[f.clave].id))).toEqual(huellas)

    // AC-11 · pasados sus 30 días deja de consultarse; lo demás sigue igual.
    sql(`update resultado_whatsapp set consultable_hasta = now() - interval '1 minute'
          where postulacion_id = ${dePaula.noContinua.id};`)
    const despues = await todoElListado(paula)
    expect(despues.map((r: any) => r.postulacionRef)).not.toContain(dePaula.noContinua.ref)
    expect(despues).toHaveLength(10)
    await sinAcceso(detalle(paula, dePaula.noContinua.ref))
    expect((await detalleOk(paula, dePaula.contratado.ref)).resultado.tipo).toBe('CONTRATADO')
    expect((await detalleOk(paula, dePaula.recepcion.ref)).situacion.estado).toBe('ACTIVA')
  })

  test('AC-01 · la vacante de otra organización no se entrega; la vacante eliminada sigue la ruta v1 sin resultado consultable', async () => {
    const original = Number(uno(`select organizacion_id from vacante where id = ${vacantes.otraEmpresa}`).organizacion_id)
    otraEmpresa = Number(JSON.parse(sql(`with f as (insert into organizacion (codigo, nombre)
                                         values (${literal(`${MARCA}-B-${Date.now()}`)}, ${literal(`${MARCA} Constructora Andina`)})
                                         returning id) select json_agg(f) from f;`))[0].id)
    try {
      sql(`update vacante set organizacion_id = ${otraEmpresa} where id = ${vacantes.otraEmpresa};`)
      await sinAcceso(detalle(paula, dePaula.otraEmpresa.ref))
      expect((await todoElListado(paula)).map((r: any) => r.postulacionRef)).not.toContain(dePaula.otraEmpresa.ref)
    } finally {
      sql(`update vacante set organizacion_id = ${original} where id = ${vacantes.otraEmpresa};`)
    }
    expect((await detalleOk(paula, dePaula.otraEmpresa.ref)).postulacionRef).toBe(dePaula.otraEmpresa.ref)

    // Eliminar la vacante cierra la postulación sin resultado v2 ni aviso final: la revocación de siempre.
    await exigir(`/panel/vacantes/${vacantes.eliminada}`, equipo, 'DELETE', { motivo: `${MARCA}: la QA elimina la vacante` })
    expect(uno(`select estado_codigo from postulacion where id = ${dePaula.eliminada.id}`).estado_codigo).toBe('CERRADA')
    expect(Number(uno(`select count(*) as n from resultado_whatsapp where postulacion_id = ${dePaula.eliminada.id}`).n)).toBe(0)
    await sinAcceso(detalle(paula, dePaula.eliminada.ref))
    await expect
      .poll(async () => (await revocacionesDe(paula.celular.e164)).filter((r) => r.ref === dePaula.eliminada.ref).map((r) => r.motivo),
        { timeout: 40_000, intervals: [500, 1_000, 2_000] })
      .toEqual(['PROCESO_TERMINADO'])
  })

  test('AC-15 · BAJA, cambio de celular y dejar de recibir retiran el acceso, también al resultado', async () => {
    // BAJA de Beto (activo) y de Paula (con un resultado consultable).
    for (const quien of [beto, paula]) {
      const baja = await comoElBot('/bajas', 'POST', { telefono: quien.celular.e164 })
      expect([200, 204], JSON.stringify(baja.cuerpo)).toContain(baja.estado)
      expect(await listadoOk(quien)).toEqual({ postulaciones: [], cursor: null, consultadoEn: expect.any(String) })
    }
    await sinAcceso(detalle(beto, deBeto.ref))
    await sinAcceso(detalle(paula, dePaula.contratado.ref))
    await sinAcceso(detalle(paula, dePaula.recepcion.ref))
    expect(uno(`select acceso_revocado_motivo from resultado_whatsapp where postulacion_id = ${dePaula.contratado.id}`)
      .acceso_revocado_motivo).toBe('BAJA')

    // Carla cambia de celular con un proceso activo y otro terminado.
    const carla = await cuentaCon('Carla')
    const activo = await conVinculo(carla, vacantes.recepcion)
    const terminado = await conVinculo(carla, vacantes.digitador)
    await escribeAlBot(carla)
    activo.ref = referenciaDe(activo.id)
    terminado.ref = referenciaDe(terminado.id)
    await mover(terminado.id, 'CERRADA', true)
    expect(await todoElListado(carla)).toHaveLength(2)
    const nuevo = celularUnico()
    celulares.push(nuevo.e164)
    await exigir('/portal/cuenta/telefono', carla.token, 'PUT', { telefono: nuevo.escrito })
    expect((await listadoOk(carla)).postulaciones).toEqual([])
    await sinAcceso(detalle(carla, activo.ref))
    await sinAcceso(detalle(carla, terminado.ref))
    expect((await listadoOk(nuevo.e164)).postulaciones).toEqual([])
    expect(uno(`select acceso_revocado_motivo from resultado_whatsapp where postulacion_id = ${terminado.id}`)
      .acceso_revocado_motivo).toBe('CAMBIO_CELULAR')

    // Dora deja de recibir desde el portal.
    const dora = await cuentaCon('Dora')
    const suyo = await conVinculo(dora, vacantes.recepcion)
    await escribeAlBot(dora)
    suyo.ref = referenciaDe(suyo.id)
    expect((await detalleOk(dora, suyo.ref)).postulacionRef).toBe(suyo.ref)
    await exigir(`/portal/postulaciones/${suyo.uuid}/whatsapp`, dora.token, 'DELETE')
    expect((await listadoOk(dora)).postulaciones).toEqual([])
    await sinAcceso(detalle(dora, suyo.ref))
  })

  test('AC-21 · el borrado de datos no deja aviso final ni copia del resultado, y el número ya no consulta nada', async () => {
    const eva = await cuentaCon('Eva')
    const activo = await conVinculo(eva, vacantes.recepcion)
    const terminado = await conVinculo(eva, vacantes.digitador)
    await escribeAlBot(eva)
    activo.ref = referenciaDe(activo.id)
    terminado.ref = referenciaDe(terminado.id)
    await mover(terminado.id, 'NO_CONTINUA', true)
    expect((await todoElListado(eva)).map((r: any) => r.situacion).sort()).toEqual(['ACTIVA', 'FINAL'])
    const personaId = Number(uno(`select persona_id from usuario where correo = ${literal(eva.correo)}`).persona_id)

    await exigir('/portal/solicitudes-borrado', eva.token, 'POST', { motivo: `${MARCA}: la QA pide el borrado` })
    const solicitud = Number(uno(`select id from solicitud_borrado where persona_id = ${personaId} and ejecutado_en is null`).id)
    await exigir(`/panel/solicitudes-borrado/${solicitud}/ejecucion`, equipo, 'POST', { motivo: `${MARCA}: lo pidió la titular` })

    const ids = [activo.id, terminado.id].join(',')
    expect(Number(uno(`select count(*) as n from resultado_whatsapp where postulacion_id in (${ids})`).n)).toBe(0)
    expect(Number(uno(`select count(*) as n from evento_whatsapp where postulacion_id in (${ids})`).n)).toBe(0)
    expect(Number(uno(`select count(*) as n from vinculo_whatsapp where persona_id = ${personaId}`).n)).toBe(0)
    expect(uno(`select estado_codigo from postulacion where id = ${activo.id}`).estado_codigo).toBe('CERRADA')
    expect(await listadoOk(eva)).toEqual({ postulaciones: [], cursor: null, consultadoEn: expect.any(String) })
    await sinAcceso(detalle(eva, activo.ref))
    await expect
      .poll(async () => (await revocacionesDe(eva.celular.e164)).filter((r) => r.ref === activo.ref).map((r) => r.motivo),
        { timeout: 40_000, intervals: [500, 1_000, 2_000] })
      .toEqual(['BORRADO_DATOS'])
    expect((await loQueRecibioElBot(eva.celular.e164)).map((l) => l.tipo)).not.toContain('EVENTO')
  })

  test('C-3 · editar la ficha publicada mueve la fecha real del último cambio y la revisión del contexto', async () => {
    const gabi = await cuentaCon('Gabi')
    const suyo = await conVinculo(gabi, vacantes.digitador)
    await escribeAlBot(gabi)
    suyo.ref = referenciaDe(suyo.id)
    const antes = await detalleOk(gabi, suyo.ref)
    expect(antes.vacante.ficha.horario).toEqual({ estado: 'NO_PUBLICADO', texto: null })

    // El equipo corrige el horario de la vacante publicada desde el panel (PUT del formulario entero).
    const v = await exigir<any>(`/panel/vacantes/${vacantes.digitador}`, equipo)
    const editada = await exigir<any>(`/panel/vacantes/${vacantes.digitador}`, equipo, 'PUT', {
      solicitudTalentoId: v.solicitudTalentoId,
      responsableUsuarioId: v.responsableUsuarioId,
      titulo: v.titulo,
      descripcion: v.descripcion,
      proposito: v.proposito ?? undefined,
      responsabilidades: v.responsabilidades ?? undefined,
      requisitos: v.requisitos ?? undefined,
      modalidad: v.modalidad ?? undefined,
      horario: 'Turno noche, de 22:00 a 6:00',
      ubicacion: v.ubicacion ?? undefined,
      ciudadUbigeo: v.ciudadUbigeo ?? undefined,
      tipoCierre: v.tipoCierre,
      plazas: v.plazas ?? undefined,
      cierraEn: v.cierraEn ?? undefined,
      remuneracion: v.remuneracion,
    })
    expect(editada.huboCambios).toBe(true)

    const despues = await detalleOk(gabi, suyo.ref)
    expect(despues.vacante.ficha.horario).toEqual({ estado: 'PUBLICADO', texto: 'Turno noche, de 22:00 a 6:00' })
    // Contrato v2, C-3: `actualizadoEn` es la fecha real del último cambio y `revisionContexto`
    // crece con él. El horario cambió: los dos tienen que moverse.
    expect(Date.parse(despues.actualizadoEn), 'actualizadoEn tras editar el horario').toBeGreaterThan(Date.parse(antes.actualizadoEn))
    expect(despues.revisionContexto, 'revisionContexto tras editar el horario').toBeGreaterThan(antes.revisionContexto)
  })
})
