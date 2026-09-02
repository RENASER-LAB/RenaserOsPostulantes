/**
 * Una vacante por dentro: el embudo, el ranking y el avance de etapa.
 *
 * Es la pantalla de trabajo del equipo. Tres decisiones que la ordenan:
 *
 *   - **El ranking es la mesa de decision.** Cada fila lleva su casilla de
 *     avance; se marca a quienes pasan, se escribe UN motivo y se confirma en
 *     tanda. El backend aplica a cada uno el estado siguiente que calcula su
 *     maquina de estados: aqui no se elige el destino, solo quien avanza.
 *   - **La ficha se abre debajo de la fila**, no en otra pagina: comparar
 *     candidatos es ir y volver, y cada ida a otra pantalla pierde el sitio.
 *   - **Los fallos del avance se cuentan uno a uno.** Avanzar en tanda puede
 *     fallar a medias; decir «fallo» a secas dejaria sin saber quien si paso.
 */

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aplicarEvaluacion,
  elegirInstrumentoTecnico,
  asignarPlantillaPrueba,
  asignarVersionPesos,
  cerrarVacante,
  confirmarAvance,
  crearRequisito,
  descargarExcelDelRanking,
  listarVersionesBanco,
  listarPlantillasPrueba,
  listarPuestos,
  listarRequisitos,
  listarVersionesPesos,
  listarVersionesPrueba,
  verVersionDePrueba,
  publicarVacante,
  quitarRequisito,
  verCatalogos,
  verEmbudo,
  verFicha,
  verHistorial,
  verPerfilIntegral,
  verDesgloseEvaluacion,
  verMetricasValidacion,
  verNotasPrueba,
  verNotasSimulacion,
  verRanking,
  verValidacion,
  verVacante,
} from '../api/panel'
import { ErrorApi } from '../api/cliente'
import type {
  DesgloseEvaluacion,
  ElegirInstrumentoTecnico as DatosDelInstrumento,
  InstrumentoTecnico,
  FilaRanking,
  NotaCriterioEtapa,
  RankingVacante,
  VacantePanel,
} from '../api/tipos'
import { rutas } from '@/rutas'
import { formatearFechaCorta, formatearFechaLarga } from '@/dominio/reloj'
import tabla from '../ui/Tabla.module.css'
import { RespuestasDePrueba } from './RespuestasDePrueba'
import { CierreDeLaVacante, PlazoDeUnaPersona } from './CierreDePrueba'
import { CalificarAUno, CalificarLaTanda } from './CalificarConIa'
import { NotaDeLaPrueba } from './NotaDeLaPrueba'
import { LaTandaDeLaPrueba } from './LaTandaDeLaPrueba'
import { EstadoDeLaPruebaTecnica } from './prueba-tecnica/EstadoDeLaPruebaTecnica'
import { claveDelCuestionario } from './prueba-tecnica/consultas'
import { verCuestionarioTecnico } from '../api/panel'
import {
  ETAPAS_PANEL,
  POR_QUE_NO_HAY_CIUDAD,
  porQueNoHayPretension,
  SIN_FILTROS,
  alternarOrden,
  CORTE_DE_LA_TANDA,
  cifrasDeLaEtapa,
  ciudadesDelRanking,
  columnasDelRanking,
  comoSeOrdena,
  criteriosQueSePintan,
  cuantoCubre,
  describirFiltro,
  esDelCurriculum,
  filtrar,
  filtrarFino,
  hayFiltroPuesto,
  laEtapaDe,
  nombreDelGrupo,
  ordenar,
  porQueNoHayNota,
  pretensionDicha,
  queTraeLaTanda,
  recuentos,
  resumenDeLaTanda,
  rotuloDeVista,
  seExportaAExcel,
  notaDelCriterio,
  notaEscrita,
  tonoDelCriterio,
  type CiudadDelRanking,
  type EtapaPanel,
  type Filtros,
  type Orden,
  type QueTraeLaTanda,
  type Vista,
} from './ranking'
import estilos from './Vacante.module.css'

/**
 * El semaforo del sistema, aplicado a lo que la IA marca.
 *
 * Verde, ambar y rojo ya significan hecho, duda y error en todo el producto, y
 * un hallazgo es exactamente eso. Lo que no encaja en los tres se queda neutro
 * en vez de inventarle un color.
 */
function tonoDe(codigo: string): string {
  const c = codigo.toUpperCase()
  if (c === 'FORTALEZA' || c === 'VERDE') return estilos.bien ?? ''
  if (c === 'ALERTA' || c === 'AMBAR' || c === 'ÁMBAR') return estilos.duda ?? ''
  if (c === 'RIESGO' || c === 'RIESGO_CRITICO' || c === 'ROJO') return estilos.mal ?? ''
  return ''
}

/** El codigo del backend, dicho como se lee. */
function enPalabras(codigo: string): string {
  return codigo.replaceAll('_', ' ').toLowerCase()
}

export function VacantePanelDetalle() {
  const { id = '' } = useParams()
  const vacanteId = Number(id)
  const cache = useQueryClient()

  const vacante = useQuery({
    queryKey: ['panel-vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: Number.isFinite(vacanteId),
  })
  const embudo = useQuery({
    queryKey: ['panel-embudo', vacanteId],
    queryFn: () => verEmbudo(vacanteId),
    enabled: Number.isFinite(vacanteId),
  })
  /*
    ⚠️ Aqui arriba y no junto a `v`, que es donde se usa: abajo quedaria detras
    de los `return` de cargando y de fallo, y un hook que a veces no se llama
    rompe el arbol entero. Comparte cache con el de la seccion de configuracion
    —misma `queryKey`— asi que no cuesta una peticion mas.
  */
  const elBanco = useBancoDelNivel(vacante.data?.puestoId)
  // Lo mismo para el otro instrumento: sin esto la puerta de publicar solo sabría mirar
  // la plantilla, y una vacante con cuestionario listo se quedaría sin poder publicarse.
  const cuestionarioPublicado = useCuestionarioPublicado(vacanteId)
  // La etapa elegida manda sobre la query: cambiar de pestana pide el ranking
  // con la nota de esa etapa, no reordena en el navegador una nota vieja.
  const [etapa, setEtapa] = useState<EtapaPanel>('PERFIL_INTEGRAL')
  /*
    La tabla trae a toda la tanda y se mira por uno de tres cortes. Sin ninguno,
    una vacante con treinta postulaciones repetía las treinta cinco veces y
    ninguna de las cinco listas era la mesa de decidir de su etapa.

    **Por defecto, quien ya tiene nota de esta etapa**: es con lo que se decide.
    «Está aquí ahora» es el otro trabajo —perseguir a quien falta— y fuera del
    perfil integral casi no se solapan: en la prueba, quien está ahí ahora es
    quien todavía NO la ha rendido.

    ⚠️ Vive aquí y no dentro de `<Ranking>` porque aquel lleva `key={etapa}`:
    dentro, cambiar de pestaña lo remontaría y volvería al corte por defecto
    justo después de que alguien pidiera otro.
  */
  const [vista, setVista] = useState<Vista>('con-nota')
  const ranking = useQuery({
    queryKey: ['panel-ranking', vacanteId, etapa],
    queryFn: () => verRanking(vacanteId, etapa),
    enabled: Number.isFinite(vacanteId),
  })
  const catalogos = useQuery({
    queryKey: ['panel-catalogos'],
    queryFn: verCatalogos,
  })

  const [fallo, setFallo] = useState<string | null>(null)

  const publicacion = useMutation({
    mutationFn: () => publicarVacante(vacanteId),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['panel-vacante', vacanteId] }),
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo publicar.'),
  })
  const [motivoCierre, setMotivoCierre] = useState('')
  const cierre = useMutation({
    mutationFn: () => cerrarVacante(vacanteId, motivoCierre.trim()),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['panel-vacante', vacanteId] }),
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo cerrar.'),
  })

  // El nombre legible de cada estado sale del catalogo del backend: una sola
  // fuente, igual que en el portal.
  const nombreDeEstado = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const e of catalogos.data?.estados ?? []) mapa.set(e.codigo, e.nombre)
    return (codigo: string) => mapa.get(codigo) ?? codigo
  }, [catalogos.data])

  const ordenDeEstado = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of catalogos.data?.estados ?? []) mapa.set(e.codigo, e.orden)
    return (codigo: string) => mapa.get(codigo) ?? 99
  }, [catalogos.data])

  if (vacante.isPending) return <p className={estilos.cargando}>Cargando la vacante…</p>
  if (vacante.isError) {
    return (
      <p className={`${estilos.avisoMalo}`} role="alert">
        {vacante.error instanceof Error ? vacante.error.message : 'No se pudo cargar.'}
      </p>
    )
  }

  const v = vacante.data
  /*
    ⚠️ **Solo se afirma que falta cuando se SABE que falta.** Mientras las
    listas viajan, o si no se pudieron leer, el boton no se bloquea: quien
    decide es el backend, y deshabilitar «Publicar» por no haber podido mirar
    deja la vacante atascada por un permiso que no es el de publicar.
  */
  const faltaElBanco = !elBanco.buscando && !elBanco.noSePuedeSaber && !elBanco.banco

  /*
    Lo que el backend rechaza al publicar, dicho antes de pulsar en vez de
    fallar despues.

    ⚠️ **Ya NO es la plantilla de evaluacion, es el BANCO del nivel.** La guarda
    del backend cambio con la V44: la plantilla se resuelve sola y lo que de
    verdad falta cuando no hay examen posible es el banco. Dejar aqui la
    condicion vieja deshabilitaba «Publicar» para siempre —la vacante nace sin
    plantilla y ya no hay desplegable que la ponga— y mandaba a un bloque donde
    no queda nada que pulsar.
  */
  // ⚠️ Desde el ciclo 2 la etapa técnica se cumple de DOS formas y la vacante dice cuál
  // usa: la prueba del puesto de siempre, o el cuestionario CAZATALENTOS aprobado para
  // ella. Pedir siempre la plantilla dejaría «Publicar» apagado para siempre en una
  // vacante que eligió el cuestionario y lo tiene listo.
  const rindeElCuestionario = v.instrumentoEtapaTecnica === 'CUESTIONARIO_TECNICO'
  const leFalta = [
    v.aplicaEvaluacion && faltaElBanco ? 'un banco de preguntas publicado de su nivel' : null,
    rindeElCuestionario
      ? cuestionarioPublicado === false
        ? 'publicar su cuestionario técnico'
        : null
      : v.versionPlantillaPruebaId === null
        ? 'la prueba del puesto'
        : null,
  ].filter(Boolean)

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.adminVacantes()}>
        ← Volver a las vacantes
      </Link>

      <div className={estilos.cabecera}>
        <div>
          <h1>{v.titulo}</h1>
          <p className={estilos.datosVacante}>
            {v.estado === 'PUBLICADA' && v.publicadaEn
              ? `Publicada el ${formatearFechaCorta(v.publicadaEn)}`
              : v.estado === 'BORRADOR'
                ? 'En borrador: todavía no aparece en el portal'
                : `Cerrada${v.cerradaEn ? ` el ${formatearFechaCorta(v.cerradaEn)}` : ''}`}
            {' · '}
            {v.aplicaEvaluacion ? 'con evaluación del banco' : 'sin evaluación del banco'}
          </p>
        </div>

        {v.estado === 'BORRADOR' && (
          <div className={estilos.cierre}>
            <button
              className={estilos.publicar}
              type="button"
              onClick={() => publicacion.mutate()}
              disabled={publicacion.isPending || leFalta.length > 0}
            >
              {publicacion.isPending ? 'Publicando…' : 'Publicar en el portal'}
            </button>
            {leFalta.length > 0 && (
              <span className={estilos.pista}>
                Antes hay que elegir {leFalta.join(' y ')}, aquí abajo.
              </span>
            )}
          </div>
        )}
        {v.estado === 'PUBLICADA' && (
          <div className={estilos.cierre}>
            <input
              className={estilos.entradaMotivo}
              type="text"
              placeholder="Motivo del cierre"
              value={motivoCierre}
              onChange={(e) => setMotivoCierre(e.target.value)}
            />
            <button
              className={estilos.cerrar}
              type="button"
              onClick={() => cierre.mutate()}
              disabled={cierre.isPending || motivoCierre.trim() === ''}
            >
              Cerrar vacante
            </button>
          </div>
        )}
      </div>

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      <ConfiguracionDeLaVacante vacante={v} />

      {/* ---------- El embudo ---------- */}
      {embudo.data && Object.keys(embudo.data.porEstado).length > 0 && (
        <section className={estilos.seccion}>
          <h2 className={estilos.tituloSeccion}>En qué va la tanda</h2>
          <ul className={estilos.embudo} role="list">
            {Object.entries(embudo.data.porEstado)
              .sort(([a], [b]) => ordenDeEstado(a) - ordenDeEstado(b))
              .map(([estado, cuantos]) => (
                <li className={estilos.tramoEmbudo} key={estado}>
                  <span className={estilos.cuantos}>{cuantos}</span>
                  <span className={estilos.enQue}>{nombreDeEstado(estado)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* ---------- El ranking ---------- */}
      <section className={estilos.seccion}>
        <h2 className={estilos.tituloSeccion}>El ranking, etapa por etapa</h2>

        {/* Una pestana por etapa: la tabla es la misma mesa de decidir, lo que
            cambia es de que etapa es la nota con la que se ordena. */}
        <div className={estilos.pestanas} role="tablist" aria-label="Etapa del ranking">
          {ETAPAS_PANEL.map((e) => (
            <button
              key={e.codigo}
              type="button"
              role="tab"
              aria-selected={etapa === e.codigo}
              className={etapa === e.codigo ? estilos.pestanaActiva : estilos.pestana}
              onClick={() => setEtapa(e.codigo)}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        {ranking.isPending && <p className={estilos.cargando}>Calculando el ranking…</p>}
        {ranking.isError && (
          <p className={estilos.avisoMalo} role="alert">
            {ranking.error instanceof Error
              ? ranking.error.message
              : 'No se pudo cargar.'}
          </p>
        )}
        {/*
          Solo en Perfil integral, y fuera de `<Ranking>`.

          Solo ahi porque es donde caen sus notas: las dos cribas puntuan el
          curriculum, y ofrecerlas mirando la tabla de la prueba invita a creer
          que califican esa. Y fuera del `<Ranking>` porque aquel lleva
          `key={etapa}`: dentro, cualquier refresco de la tabla lo remontaria y
          se llevaria por delante la espera de una pasada en vuelo.

          ⚠️ Cambiar de pestaña con una criba pedida SI la desmonta y se pierde
          el sondeo. La peticion sigue viva en el servidor —el bloque nunca dice
          lo contrario— pero nadie volvera a refrescar solo.
        */}
        {etapa === 'PERFIL_INTEGRAL' && ranking.data && (
          <CalificarLaTanda
            vacanteId={vacanteId}
            total={ranking.data.total}
            alTerminar={() => {
              cache.invalidateQueries({ queryKey: ['panel-ranking', vacanteId] })
              cache.invalidateQueries({ queryKey: ['panel-embudo', vacanteId] })
            }}
          />
        )}
        {/*
          ⚠️ **Solo en la prueba, y encima de la tabla.** El equivalente del
          currículum —`CalificarLaTanda`— vive justo arriba y solo en Perfil
          integral: las dos nunca coinciden, así que el violeta de la pantalla
          es siempre uno.

          Recibe `ranking.data.filas` SIN filtrar: a quién alcanza no puede
          depender del corte que esté puesto en la tabla. Quien rindió y sigue
          sin nota no sale en «con nota de la prueba», que es el corte por
          defecto.
        */}
        {etapa === 'PRUEBA_PUESTO' && ranking.data && (
          <LaTandaDeLaPrueba
            filas={ranking.data.filas}
            alTerminar={() => {
              cache.invalidateQueries({ queryKey: ['panel-ranking', vacanteId] })
              cache.invalidateQueries({ queryKey: ['panel-notas-prueba'] })
            }}
          />
        )}
        {ranking.data && (
          <Ranking
            key={etapa}
            vacanteId={vacanteId}
            etapa={etapa}
            filas={ranking.data.filas}
            cabeceraDelCv={ranking.data}
            vista={vista}
            alCambiarVista={setVista}
            alAvanzar={async () => {
              await cache.invalidateQueries({
                queryKey: ['panel-ranking', vacanteId],
              })
              await cache.invalidateQueries({
                queryKey: ['panel-embudo', vacanteId],
              })
            }}
          />
        )}
      </section>

      <Requisitos vacanteId={vacanteId} />
    </div>
  )
}

// ---------- Las etapas del panel ----------

/**
 * Las cinco etapas que conoce el ranking del backend, en su orden.
 *
 * `prefijos` es como se sabe quien esta parado en cada una HOY: el codigo de
 * estado de una postulacion empieza por el nombre de su etapa. Los estados
 * finales (NO_CONTINUA, CERRADA...) no empiezan por ninguno, y es correcto:
 * quien termino ya no esta "en" ninguna etapa.
 */
/**
 * Solo un 404 significa «todavia no hay». Un 403 —el rol no alcanza— o un 500
 * disfrazados de «sin datos» mienten: se dice lo que el backend dijo.
 */
const leerFallo = (causa: unknown, sinDatos: string) =>
  causa instanceof ErrorApi && causa.estado === 404
    ? sinDatos
    : causa instanceof Error
      ? causa.message
      : sinDatos

const noHayNadaQueRefrescar = () => {}

// ---------- El ranking, con seleccion y avance ----------

/**
 * La flecha de orden y el pliegue de los filtros, DIBUJADOS.
 *
 * Estaban puestos con glifos de la fuente —`▲▼↕` y `▾▴`—, y un glifo no es un
 * icono: cambia de tamaño, de peso y de línea base con la familia, y al lado
 * del ojo de `Campo` —24×24, trazo 1.6, cabos redondos— se leía como venido de
 * otro sistema. Se trazan con esa misma pluma para que sean el mismo objeto.
 *
 * ⚠️ **La flecha no lleva color.** El estado de orden se lee en la forma y en
 * `aria-sort`; el violeta de esta pantalla ya significa otra cosa.
 */
function Pluma({ children, clase }: { children: ReactNode; clase?: string }) {
  return (
    <svg
      className={clase}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

function FlechaDeOrden({ como }: { como: 'ascending' | 'descending' | 'none' }) {
  return (
    <Pluma clase={estilos.flecha}>
      {como === 'ascending' ? (
        <path d="M12 19V5m0 0-5 5m5-5 5 5" />
      ) : como === 'descending' ? (
        <path d="M12 5v14m0 0 5-5m-5 5-5-5" />
      ) : (
        /* Sin ordenar: las dos direcciones a la vez y más tenue, para que se
           vea que la cabecera SE PUEDE pulsar sin fingir que ya está ordenada. */
        <path d="m8 10 4-4 4 4M8 14l4 4 4-4" opacity="0.5" />
      )}
    </Pluma>
  )
}

function Ranking({
  vacanteId,
  etapa,
  filas,
  cabeceraDelCv,
  vista,
  alCambiarVista,
  alAvanzar,
}: {
  vacanteId: number
  etapa: EtapaPanel
  filas: FilaRanking[]
  /** Las cuatro cifras del backend, que son de la cola del currículum. */
  cabeceraDelCv: RankingVacante
  vista: Vista
  alCambiarVista: (v: Vista) => void
  alAvanzar: () => Promise<void>
}) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [abierta, setAbierta] = useState<number | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  /*
    Sin orden puesto manda el del backend —grupo de prioridad y, dentro, nota—,
    que es la opinión del producto sobre la tanda. Por eso el estado arranca en
    `null` en vez de en una columna cualquiera: nadie ha pedido todavía otra
    cosa.
  */
  const [orden, setOrden] = useState<Orden | null>(null)
  /*
    Las columnas de criterio arrancan apagadas. La tabla ya se sale de su
    envoltura con once columnas —ver el comentario de la celda del candidato— y
    los ocho criterios del currículum la llevarían a veinte. Quien viene a
    comparar criterio a criterio las enciende; quien viene a ver quién encabeza
    la tanda no paga ese scroll.
  */
  const [verCriterios, setVerCriterios] = useState(false)

  const laEtapa = laEtapaDe(etapa)
  /*
    ⚠️ **Los tres pasos, en este orden y con un nombre cada uno.** El corte de
    la botonera recorta la tanda, los filtros recortan ese corte, y el orden
    ordena lo que quedó. `visibles` es lo ÚLTIMO, y es lo único que se pinta y
    lo único que viaja al Excel: cualquier otro array daría una hoja distinta de
    la pantalla desde la que se pidió.
  */
  const delCorte = filtrar(filas, etapa, vista)
  const filtradas = filtrarFino(delCorte, filtros)
  const visibles = ordenar(filtradas, orden)

  const cuantas = recuentos(filas, etapa)
  const cifras = cifrasDeLaEtapa(filas, etapa)
  /*
    ⚠️ **De las filas SIN filtrar, siempre.** Sobre las visibles, marcar una
    ciudad haría desaparecer las demás de la lista y no habría manera de añadir
    la segunda; y el aviso de «todavía no hay ciudades» se encendería en cuanto
    un filtro dejara la tabla vacía, diciendo una falsedad.
  */
  const ciudades = ciudadesDelRanking(filas)
  /*
    ⚠️ **Qué de lo nuevo trae de verdad esta tanda**, también de las filas sin
    filtrar. La ciudad puede faltar entera —solo se le pide a quien crea cuenta
    desde ahora— y la pretensión viaja bajo el permiso `ver_pretension`, que solo
    tiene DIRECCIÓN: para todo el rol TALENTO llega nula siempre. Una columna
    entera de guiones no informa, y la de pretensión además se lee al revés
    —«nadie pidió sueldo»—, así que la columna no se pinta y se dice por qué.

    El motivo NO se adivina mirando los nulos: `puedeVerPretension` viaja en la
    respuesta justamente para poder decir cuál de los dos es.
  */
  const trae = queTraeLaTanda(filas, cabeceraDelCv.puedeVerPretension)
  /*
    Adecuacion y potencial son dimensiones del retrato que sale del curriculum,
    no de la prueba ni de la simulacion. Enseñarlas en las cinco pestañas hacia
    que la mesa de la prueba mostrara dos numeros del CV junto a uno de la
    prueba, y los tres con la misma pinta: la lista parecia hablar del CV
    estando en otra etapa. Donde significan algo se quedan; donde no, se van.
  */
  const delCurriculum = esDelCurriculum(etapa)
  /*
    ⚠️ **El `colSpan` se DERIVA de la lista de columnas.** Estaba escrito a mano
    —«8 : 6» sobre nueve y siete columnas reales— y con Ciudad y Pretensión
    serían once y nueve: la fila de detalle y la celda del «no hay» medían menos
    que la tabla y el bloque de dentro salía estrecho. Contando la lista, añadir
    una columna no puede volver a descuadrarlo.
  */
  /*
    ⚠️ **Los criterios salen de las filas SIN filtrar, y por el mismo motivo que
    las ciudades.** Sobre las visibles, un filtro que dejara fuera a la única
    persona con un criterio puntuado borraría esa columna de la tabla, y la
    cabecera cambiaría de forma al escribir en el buscador.
  */
  const criterios = criteriosQueSePintan(etapa, filas, verCriterios)
  const columnasDeLaTabla = columnasDelRanking(etapa, trae, criterios)
  const columnas = columnasDeLaTabla.length
  // Solo cuentan las marcas que se VEN: si el filtro oculta una fila marcada,
  // el boton no puede seguir diciendo que avanzara a esa persona.
  const marcadosVisibles = visibles.filter((f) => marcados.has(f.postulacionId))
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [avanzando, setAvanzando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [falloDescarga, setFalloDescarga] = useState<string | null>(null)

  /**
   * El Excel de lo que se está viendo.
   *
   * ⚠️ **No vale un `<a href>`.** El token del panel va como `Bearer` en una
   * cabecera y un enlace no puede ponerla: la descarga sale de una petición
   * normal y el archivo se abre con `createObjectURL`, igual que la de datos del
   * portal del candidato.
   *
   * ⚠️ **Los ids viajan en el orden de `visibles`**, que es el de la pantalla, y
   * el backend escribe las filas en ESE orden. Mandar cualquier otro array —las
   * filas sin filtrar, o las del corte sin ordenar— daría una hoja que no se
   * parece a la tabla desde la que se pidió.
   */
  async function descargarExcel() {
    setDescargando(true)
    setFalloDescarga(null)
    try {
      const archivo = await descargarExcelDelRanking(vacanteId, {
        etapa,
        postulacionIds: visibles.map((f) => f.postulacionId),
        /*
          `trae` viaja dentro de la descripción: la hoja se descarga, se reenvía
          y se abre fuera del panel, donde ya no hay ninguna pantalla que pueda
          explicar que una columna de pretensión en blanco puede ser un permiso
          y no un candidato que no pidió sueldo.
        */
        filtroDescrito: describirFiltro(etapa, vista, filtros, orden, ciudades, trae),
      })
      const url = URL.createObjectURL(archivo.contenido)
      const enlace = document.createElement('a')
      enlace.href = url
      // El nombre lo pone el servidor en `Content-Disposition`; el de reserva es
      // por si esa cabecera no llega, para no guardar un archivo sin nombre.
      enlace.download = archivo.nombre ?? `ranking-${etapa.toLowerCase()}.xlsx`
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (causa) {
      /*
        El mensaje del servidor tal cual: es él quien sabe por qué no se pudo
        —una etapa que no exporta, un permiso que falta—, y traducirlo a «no se
        pudo descargar» borraría justo lo que hay que arreglar.
      */
      setFalloDescarga(
        causa instanceof Error ? causa.message : 'No pudimos preparar la descarga.',
      )
    } finally {
      setDescargando(false)
    }
  }

  const alternar = (id: number) =>
    setMarcados((antes) => {
      const nuevos = new Set(antes)
      if (nuevos.has(id)) nuevos.delete(id)
      else nuevos.add(id)
      return nuevos
    })

  async function avanzarMarcados() {
    setAvanzando(true)
    setResultado(null)
    const avanzaron: string[] = []
    const fallaron: string[] = []
    // Uno a uno, no en paralelo: si el backend rechaza a alguien, el mensaje
    // dice a quien, y los demas no se pierden por ello.
    for (const fila of marcadosVisibles) {
      try {
        await confirmarAvance(fila.postulacionId, motivo.trim())
        avanzaron.push(fila.candidato)
      } catch (causa) {
        fallaron.push(
          `${fila.candidato} (${causa instanceof Error ? causa.message : 'falló'})`,
        )
      }
    }
    setAvanzando(false)
    setMarcados(new Set())
    setMotivo('')
    setResultado(
      [
        avanzaron.length > 0 ? `Avanzaron: ${avanzaron.join(', ')}.` : null,
        fallaron.length > 0 ? `No avanzaron: ${fallaron.join('; ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    )
    await alAvanzar()
  }

  const resumen = resumenDeLaTanda(filas, etapa)

  return (
    <>
      {/*
        Las cinco cifras de la tanda, de un vistazo y antes de la tabla.

        ⚠️ **Las cinco se derivan de `filas`, ninguna del backend.** Los
        contadores de la respuesta —calificados, en curso, fallidos— son de la
        cola que califica el CURRÍCULUM y salen idénticos en las cinco pestañas;
        un «2 aún calificando» sacado de ahí hablaría del CV estando en la
        prueba. Ver `resumenDeLaTanda`.

        ⚠️ **El corte del cuarto se dice en el rótulo.** Es 70 escrito a mano
        porque la nota mínima que la vacante sí declara no viaja por la API.
        «Con 70 o más» es comprobable; «llegan al mínimo» sería una afirmación
        sobre un mínimo que esta pantalla no ha leído.
      */}
      <div className={estilos.cifrasDeLaTanda}>
        {/*
          El rótulo NO repite el de la línea de abajo, que dice «N de M con nota
          de la prueba». Dos frases idénticas a dos alturas se leen como dos
          datos distintos que no cuadran. Aquí va lo que el recuadro cuenta —los
          que ya tienen nota— y el desglose se queda donde estaba.
        */}
        <div className={estilos.cifraTanda}>
          <b>{resumen.conNota}</b>
          <span>de {filas.length} ya calificados</span>
        </div>
        {/*
          «de la tanda» no sobra: la tabla de abajo puede estar filtrada a Lima y
          estas dos siguen siendo de todos. Es la misma convención que ya sigue
          la línea de recuentos —se cuenta de las filas sin filtrar—, pero una
          mediana es justo la cifra que alguien esperaría ver recalcularse al
          filtrar, así que aquí se dice de qué conjunto sale.
        */}
        <div className={estilos.cifraTanda}>
          <b>{resumen.mediana ?? '—'}</b>
          <span>nota mediana de la tanda /100</span>
        </div>
        <div className={estilos.cifraTanda}>
          <b>{resumen.media ?? '—'}</b>
          <span>nota media de la tanda /100</span>
        </div>
        <div className={estilos.cifraTanda}>
          <b>{resumen.lleganAlCorte}</b>
          <span>con {CORTE_DE_LA_TANDA} o más</span>
        </div>
        {/*
          El rótulo no repite el de la línea de abajo —«N ya la hicieron y siguen
          sin nota»— por lo mismo que el primero: dos frases iguales a dos
          alturas se leen como dos datos que no cuadran. Aquí va a quién señala,
          que es de quien el equipo tiene trabajo pendiente.
        */}
        <div className={estilos.cifraTanda}>
          <b>{resumen.calificando}</b>
          <span>esperan nota del equipo</span>
        </div>
      </div>

      <div className={estilos.filaResumen}>
        <div className={estilos.recuentos}>
          {/*
            ⚠️ **Las cifras de la etapa, contadas de las filas.** Las cuatro del
            backend —calificados, en curso, fallidos— salen de la cola que
            califica el CURRÍCULUM y son idénticas en las cinco pestañas: en la
            de la prueba decían «76 calificados» encima de setenta y ocho
            guiones. Aquí se cuenta lo de esta etapa, y lo del currículum baja
            a su propia línea con su nombre puesto.
          */}
          <p className={estilos.resumenTanda}>
            {cifras.conNota} de {filas.length} con {laEtapa.nota.toLowerCase()}
            {cifras.sinNota > 0 && (
              <span className={estilos.detalleTanda}>
                {' · '}
                {[
                  cifras.hechasSinNota > 0
                    ? `${cifras.hechasSinNota} ya la hicieron y siguen sin nota`
                    : null,
                  cifras.esperandoALaPersona > 0
                    ? `${cifras.esperandoALaPersona} sin hacerla todavía`
                    : null,
                  cifras.enOtraEtapa > 0 ? `${cifras.enOtraEtapa} en otra etapa` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </p>
          {/*
            La línea del currículum, con su nombre delante. Fuera del perfil
            dice además que no habla de esta etapa: es la frase que faltaba
            cuando «65 calificados» se leía sobre una columna de guiones.
          */}
          <p className={estilos.cuantasSeVen}>
            {delCurriculum ? 'La criba con IA' : 'La criba del currículum con IA'} va por{' '}
            {cabeceraDelCv.calificados} de {cabeceraDelCv.total} calificados
            {cabeceraDelCv.enCurso > 0 && `, ${cabeceraDelCv.enCurso} en curso`}
            {cabeceraDelCv.fallidos > 0 && `, ${cabeceraDelCv.fallidos} fallidos`}
            {delCurriculum ? '.' : ' — eso es del currículum, no de esta etapa.'}
          </p>
        </div>

        {/*
          Tres cortes del mismo listado, no tres peticiones.

          ⚠️ **Los dos primeros casi no se solapan fuera del perfil**, y por eso
          hacen falta los dos: quien «está aquí ahora» en la prueba es quien
          TODAVÍA no la ha rendido —hay que perseguirlo— y quien ya tiene nota
          pasó de largo —con él se decide—. En la vacante 3 son una fila cada
          uno, sin una sola persona en común.

          Cada posición lleva su cifra: sin ellas hay que pulsar las tres para
          saber si alguna tiene algo dentro.
        */}
        {/* El rótulo sale de `rotuloDeVista`: el mismo que viaja dentro del
            Excel, para que la hoja no diga que salió de un corte con otro
            nombre que el que se pulsó. */}
        <div className={estilos.vistas} role="group" aria-label="Qué filas se ven">
          {(['con-nota', 'aqui-ahora', 'toda'] as const).map((cual) => (
            <button
              key={cual}
              className={vista === cual ? estilos.vistaActiva : estilos.vista}
              type="button"
              aria-pressed={vista === cual}
              onClick={() => alCambiarVista(cual)}
            >
              {rotuloDeVista(cual, etapa)}
              <span className={estilos.cuantasEnLaVista}>{cuantas[cual]}</span>
            </button>
          ))}
        </div>
      </div>

      {/*
        El interruptor de los criterios, solo donde los criterios hablan de esta
        etapa. `notasCriterio` viene SIEMPRE del currículum: fuera del perfil
        serían ocho columnas del CV con pinta de ser de la prueba.

        Va apagado por defecto —la tabla ya se sale de su envoltura con once
        columnas— y dice cuántas columnas va a añadir, para que encenderlo no
        sorprenda.
      */}
      {delCurriculum && criteriosQueSePintan(etapa, filas, true).length > 0 && (
        <p className={estilos.interruptorCriterios}>
          <label>
            <input
              type="checkbox"
              checked={verCriterios}
              onChange={(e) => setVerCriterios(e.target.checked)}
            />
            Ver los criterios en la tabla
          </label>
          <span>
            {criteriosQueSePintan(etapa, filas, true).length} columnas más, una por criterio,
            con el fondo teñido según lo que cubre cada nota.
          </span>
        </p>
      )}

      <BarraDeFiltros
        etapa={etapa}
        filtros={filtros}
        alCambiar={setFiltros}
        ciudades={ciudades}
        trae={trae}
        cuantasSeVen={visibles.length}
        cuantasHabia={delCorte.length}
        puedeDescargar={seExportaAExcel(etapa)}
        descargando={descargando}
        alDescargar={() => void descargarExcel()}
      />
      {falloDescarga && (
        <p className={estilos.avisoMalo} role="alert">
          {falloDescarga}
        </p>
      )}

      <div className={tabla.envoltura}>
        <table className={tabla.tabla}>
          {/*
            La cabecera se pinta de `columnasDeLaTabla`, que es la MISMA lista de
            la que sale el `colSpan`. El cuerpo va escrito a mano justo debajo y
            en este orden exacto: al añadir una columna hay que tocar los dos
            sitios, pero la cabecera y el ancho de la fila de detalle ya no
            pueden discrepar entre sí, que era el fallo.

            La nota se llama por su etapa y no «Nota de etapa» a secas: cinco
            pestañas con la misma cabecera obligan a recordar en cuál estás para
            saber qué número estás leyendo.

            ⚠️ Adecuación y Potencial salen del `PerfilTalento`, que se arma UNA
            vez con el currículum y no se recalcula por etapa; y son solo dos de
            las cuatro porque con las otras la tabla medía 1314 px dentro de una
            envoltura de 1038 y la columna de Estado quedaba fuera del scroll.

            ⚠️ Riesgos y Alertas son dos columnas y no una suma: un riesgo
            crítico lo escribió el agente sobre el perfil y una alerta la levantó
            el proceso. Sumarlas daba un «3» que no se podía ir a mirar.
          */}
          <thead>
            <tr>
              {columnasDeLaTabla.map((columna) => {
                if (columna.clave === 'avance') return <th key={columna.clave} aria-label="Avanza" />
                const clase = columna.cifra ? tabla.cifra : undefined
                /*
                  El peso va bajo el nombre del criterio, en pequeño, como en el
                  informe del que sale esta pantalla. No es decoración: un 90 en
                  un criterio que pesa 25 y un 90 en uno que pesa 5 se leen igual
                  y no valen lo mismo.
                */
                if (columna.peso != null) {
                  return (
                    <th key={columna.clave} className={`${clase} ${estilos.cabeceraCriterio}`}>
                      {columna.titulo}
                      {/*
                        «peso 0» se lee como un peso pequeño, y no lo es: un
                        criterio con peso cero NO puede mover la nota de nadie
                        —el backend suma `puntaje × peso` y divide por la suma de
                        pesos—. Se dice con palabras, y sus celdas van sin teñir.
                      */}
                      <span>{columna.peso === 0 ? 'no pondera' : `peso ${columna.peso}`}</span>
                    </th>
                  )
                }
                if (!columna.ordenable) {
                  return (
                    <th key={columna.clave} className={clase}>
                      {columna.titulo}
                    </th>
                  )
                }
                const cual = columna.ordenable
                const como = comoSeOrdena(orden, cual)
                return (
                  /*
                    `aria-sort` va en el `<th>` y no en el botón: es la celda la
                    que está ordenada. El botón se queda con el nombre de la
                    columna como nombre accesible, que es el patrón de una tabla
                    ordenable, y la flecha es decorativa —lo que un lector
                    anuncia es el `aria-sort`—.
                  */
                  <th
                    key={columna.clave}
                    className={[
                      clase,
                      estilos.cabeceraOrdenable,
                      columna.cifra ? estilos.cabeceraCifra : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-sort={como}
                  >
                    <button
                      type="button"
                      className={estilos.ordenarPor}
                      onClick={() => setOrden((antes) => alternarOrden(antes, cual))}
                      title={`Ordenar por ${columna.titulo}`}
                    >
                      {columna.titulo}
                      <FlechaDeOrden como={como} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <Fragment key={fila.postulacionId}>
                <tr
                  className={tabla.pulsable}
                  onClick={() =>
                    setAbierta(abierta === fila.postulacionId ? null : fila.postulacionId)
                  }
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Avanza ${fila.candidato}`}
                      checked={marcados.has(fila.postulacionId)}
                      onChange={() => alternar(fila.postulacionId)}
                    />
                  </td>
                  <td className={tabla.cifra}>{fila.puesto}</td>
                  <td>
                    <span className={estilos.candidato}>{fila.candidato}</span>
                    <span className={estilos.correo}>{fila.correo}</span>
                  </td>
                  {/*
                    ⚠️ **Las dos celdas van con la MISMA condición que su
                    cabecera**, o la fila se desalinea de la tabla entera. Cuando
                    la tanda no trae el dato la columna no existe: ni cabecera ni
                    celda, y el motivo se dice en la barra de filtros.

                    Un guion aquí es «esta persona no lo declaró», y solo puede
                    significar eso porque al menos otra sí lo declaró.
                  */}
                  {trae.hayCiudad && (
                    <td className={estilos.celdaCiudad}>{fila.ciudad ?? '—'}</td>
                  )}
                  {trae.hayPretension && (
                    <td className={`${tabla.cifra} ${estilos.celdaPretension}`}>
                      {pretensionDicha(fila) ?? '—'}
                    </td>
                  )}
                  <td className={tabla.cifra}>
                    {fila.notaEtapa ?? '—'}
                    {/*
                      Una nota de la criba rapida es provisional y la fina la
                      va a pisar. Decirlo con la palabra y no con un color: en
                      escala de grises un 82 provisional y un 82 firme serian
                      el mismo 82, y ordenar por el primero es decidir con algo
                      que va a cambiar.
                    */}
                    {delCurriculum && fila.pasada === 'RAPIDA' && fila.notaEtapa !== null && (
                      <span className={estilos.provisional}>provisional</span>
                    )}
                    {/*
                      ⚠️ **El guion tenía cinco significados y no decía cuál.**
                      «Están calificados pero no se ve su nota» era exactamente
                      esto: el currículum estaba calificado —lo decía la cifra
                      de arriba— y la prueba no, y el guion no distinguía eso de
                      «no ha llegado» ni de «pasó sin nota».
                    */}
                    {fila.notaEtapa === null && (
                      <span className={estilos.porQue}>{porQueNoHayNota(fila, etapa)}</span>
                    )}
                  </td>
                  {/*
                    ⚠️ **El veredicto es el grupo de prioridad, no una etiqueta
                    nueva.** El informe del cliente traía un «Fuerte / Sólido /
                    Parcial» calculado de la nota, y sus cortes —80 y 65— son
                    exactamente los de este grupo. Con una diferencia a favor del
                    grupo: mira además el riesgo crítico, así que baja a alguien
                    de 92 que la nota sola dejaría arriba. Dos rótulos que casi
                    siempre dicen lo mismo obligan a explicar el caso en que no.

                    Sube de píldora dentro del candidato a columna propia porque
                    ahora se lee al comparar, no al identificar.

                    ⚠️ **Sin semáforo, y eso es deliberado**: pintar
                    «incompatible» en rojo convierte una fila de una mesa de
                    trabajo en un veredicto. Ver `.grupo` en la hoja.

                    ⚠️ `INCOMPATIBLE` está en el catálogo del backend pero hoy
                    **ningún camino del código lo escribe** —sale de requisitos
                    objetivos que aún no se comprueban al postular—. La columna
                    no lo promete: pinta lo que llega.

                    El guion es «la IA todavía no ha calificado su currículum»:
                    el grupo se asigna al terminar esa pasada.
                  */}
                  <td>
                    {nombreDelGrupo(fila.grupoPrioridad) ? (
                      <span className={estilos.grupo}>
                        {nombreDelGrupo(fila.grupoPrioridad)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {/*
                    Una columna por criterio, en el MISMO orden que la cabecera
                    —las dos salen de `criterios`—.

                    ⚠️ **El color va al fondo de la celda, nunca al número.** Un
                    18 verde y un 18 rojo tienen que seguir siendo el mismo 18,
                    y la tabla se tiene que poder leer en escala de grises. Es la
                    misma razón por la que «provisional» va en palabra.

                    ⚠️ **Un hueco NO es un rojo.** Sin nota puede ser que la IA
                    no haya llegado o que ese criterio sea de método PERSONA y le
                    toque a alguien; teñirlo de rojo diría que lo hizo mal.

                    El `title` lleva el nombre entero: la cabecera lo recorta y
                    ocho columnas estrechas se vuelven ilegibles sin él.
                  */}
                  {criterios.map((criterio) => {
                    const nota = notaDelCriterio(fila, criterio.nombre)
                    const tono = nota ? tonoDelCriterio(nota) : 'hueco'
                    const cubre = nota ? cuantoCubre(nota) : null
                    return (
                      <td
                        key={criterio.nombre}
                        className={`${tabla.cifra} ${estilos.celdaCriterio} ${estilos[tono]!}`}
                        title={
                          cubre === null
                            ? `${criterio.nombre}: todavía sin nota`
                            : `${criterio.nombre}: ${Math.round(cubre * 100)} % del criterio` +
                              (criterio.peso === 0
                                ? ' · no pondera: no mueve la nota final'
                                : '')
                        }
                      >
                        {notaEscrita(nota)}
                      </td>
                    )
                  })}
                  {delCurriculum && (
                    <>
                      <td className={tabla.cifra}>{fila.adecuacion ?? '—'}</td>
                      <td className={tabla.cifra}>{fila.potencial ?? '—'}</td>
                    </>
                  )}
                  <td className={tabla.cifra}>
                    {fila.riesgosCriticos > 0 ? (
                      <span className={estilos.riesgo}>{fila.riesgosCriticos}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={tabla.cifra}>{fila.alertas > 0 ? fila.alertas : '—'}</td>
                  <td>{fila.estadoNombre}</td>
                </tr>
                {abierta === fila.postulacionId && (
                  <tr>
                    <td colSpan={columnas} className={estilos.celdaDetalle}>
                      <DetalleDelPostulante fila={fila} etapa={etapa} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={columnas} className={tabla.vacia}>
                  {/*
                    ⚠️ **Ahora son TRES vacíos**, y confundirlos manda a buscar
                    en el sitio equivocado. Sin nadie en la etapa es lo NORMAL en
                    Validación y Decisión casi siempre: se dice sin alarma y se
                    nombra el escape con las palabras que lleva escritas.

                    El tercero es nuevo y lo trae la barra de filtros: si el
                    corte SÍ tiene gente y lo que la esconde es un filtro
                    puesto, decir «nadie tiene nota» sería falso —los hay— y
                    mandaría a pulsar el corte de al lado, que tampoco es. Se
                    nombra el filtro, que es lo que hay que quitar.

                    En un <p>, y no suelto: la celda mide lo que miden las
                    columnas, y en un teléfono la frase acababa a la derecha del
                    scroll. Ver `.vacia` en `Tabla.module.css`.
                  */}
                  <p>
                    {filas.length === 0
                      ? 'Todavía no hay postulaciones en esta vacante.'
                      : delCorte.length > 0
                        ? `Ninguna de las ${delCorte.length} de este corte pasa los filtros que ` +
                          `hay puestos. Pulsa «Ver a todos» para quitarlos.`
                        : vista === 'con-nota'
                          ? `Nadie tiene todavía ${laEtapa.nota.toLowerCase()}: hace falta ` +
                            `${laEtapa.loQueDejaNota}. Pulsa «Toda la tanda» para las ` +
                            `${filas.length} de la vacante.`
                          : `Nadie está en ${laEtapa.nombre} ahora mismo. Pulsa «Toda la ` +
                            `tanda» para las ${filas.length} de la vacante.`}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/*
        La leyenda solo existe mientras hay algo que leer. Una leyenda de colores
        sobre una tabla sin colores es ruido, y además enseñaría tres tonos que
        no aparecen en ninguna celda.

        El hueco va nombrado con sus dos causas, que es lo que impide leerlo como
        un cero.
      */}
      {criterios.length > 0 && (
        <p className={estilos.leyendaCriterios}>
          <span>
            <i className={estilos.bien} /> cubre 70 % o más del criterio
          </span>
          <span>
            <i className={estilos.duda} /> entre 40 y 69 %
          </span>
          <span>
            <i className={estilos.mal} /> menos del 40 %
          </span>
          <span>
            <i className={estilos.hueco} /> sin nota: la IA aún no llegó, o ese criterio lo
            puntúa una persona
          </span>
        </p>
      )}

      {/* La mesa de avance: un motivo para la tanda marcada. */}
      <div className={estilos.avance}>
        <input
          className={estilos.entradaMotivo}
          type="text"
          placeholder="Motivo del avance (obligatorio)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <button
          className={estilos.avanzar}
          type="button"
          onClick={() => void avanzarMarcados()}
          disabled={avanzando || marcadosVisibles.length === 0 || motivo.trim() === ''}
        >
          {avanzando
            ? 'Avanzando…'
            : marcadosVisibles.length === 0
              ? 'Marca a quienes avanzan'
              : `Avanzar a ${marcadosVisibles.length} ${marcadosVisibles.length === 1 ? 'persona' : 'personas'}`}
        </button>
      </div>
      {resultado && (
        <p className={estilos.resultadoAvance} role="status">
          {resultado}
        </p>
      )}
    </>
  )
}

// ---------- La barra de filtros, y la descarga de lo que se ve ----------

/**
 * Un número escrito a mano, o nada.
 *
 * Una caja vacía es «sin límite», no un cero: tratarla como cero pondría un
 * «Nota ≥ 0» que no filtra nada y encendería igualmente el aviso de «hay
 * filtros puestos». Lo que no sea un número tampoco pasa.
 */
const aCifra = (valor: string): number | null => {
  const limpio = valor.trim()
  if (limpio === '') return null
  const cifra = Number(limpio)
  return Number.isFinite(cifra) ? cifra : null
}

/**
 * Los cuatro filtros y el botón del Excel, encima de la tabla.
 *
 * ⚠️ **La búsqueda por nombre se queda a la vista y el resto se pliega.** Es la
 * que se usa a diario —«¿dónde está Camila?»— y las otras tres son de recortar
 * una tanda entera, que se hace de vez en cuando. Seis controles fijos sobre una
 * mesa de decidir compiten con la tabla, que es lo que se viene a mirar.
 *
 * ⚠️ **Pero un filtro plegado NO puede quedar escondido.** El resumen del pliegue
 * lleva cuántos hay puestos, y debajo de la barra se dice cuántas filas quedan de
 * cuántas: un recorte que no se ve es la trampa del indicador que miente.
 */
function BarraDeFiltros({
  etapa,
  filtros,
  alCambiar,
  ciudades,
  trae,
  cuantasSeVen,
  cuantasHabia,
  puedeDescargar,
  descargando,
  alDescargar,
}: {
  etapa: EtapaPanel
  filtros: Filtros
  alCambiar: (f: Filtros) => void
  /** Las que de verdad hay en la tanda. Vacío significa que todavía no hay ninguna. */
  ciudades: CiudadDelRanking[]
  /** Qué columnas nuevas trae la tanda. Lo que no trae, no se ofrece filtrar. */
  trae: QueTraeLaTanda
  cuantasSeVen: number
  cuantasHabia: number
  puedeDescargar: boolean
  descargando: boolean
  alDescargar: () => void
}) {
  const cambiar = <C extends keyof Filtros>(campo: C, valor: Filtros[C]) =>
    alCambiar({ ...filtros, [campo]: valor })

  const alternarCiudad = (codigo: string) =>
    cambiar(
      'ciudades',
      filtros.ciudades.includes(codigo)
        ? filtros.ciudades.filter((c) => c !== codigo)
        : [...filtros.ciudades, codigo],
    )

  const puesto = hayFiltroPuesto(filtros)
  const plegados = [
    filtros.ciudades.length > 0,
    filtros.notaMin != null || filtros.notaMax != null,
    filtros.pretensionMin != null || filtros.pretensionMax != null,
  ].filter(Boolean).length

  return (
    <div className={estilos.filtros}>
      <div className={estilos.filaFiltros}>
        <label className={estilos.campoFiltro}>
          <span className={estilos.rotuloFiltro}>Buscar por nombre</span>
          {/*
            `type="search"` y no `text`: trae la cruz de borrar del sistema y el
            teclado de búsqueda en el móvil, gratis. Es la regla de la plataforma
            primero, la misma por la que el registro usa un `<select>` nativo.
          */}
          <input
            className={estilos.buscador}
            type="search"
            value={filtros.texto}
            onChange={(e) => cambiar('texto', e.target.value)}
            placeholder="Parte del nombre"
          />
        </label>

        <details className={estilos.masFiltros}>
          <summary className={estilos.resumenFiltros}>
            Ciudad, nota y pretensión
            {plegados > 0 && <span className={estilos.cuantosFiltros}>{plegados}</span>}
            <Pluma clase={estilos.pliegue}>
              <path d="m7 10 5 5 5-5" />
            </Pluma>
          </summary>

          <div className={estilos.cuerpoFiltros}>
            <fieldset className={estilos.grupoFiltro}>
              <legend className={estilos.rotuloFiltro}>Ciudad</legend>
              {/*
                ⚠️ **Si nadie tiene ciudad, aquí no va un desplegable vacío.** La
                ciudad solo se le pide a quien crea cuenta desde ahora, así que
                hoy la tanda entera viene sin ella: un control con cero opciones
                se lee como una pantalla rota, y servirlo del catálogo de ubigeo
                ofrecería 196 filtros que no devuelven a nadie. Se dice lo que
                pasa, que es lo único honesto que hay que decir.
              */}
              {ciudades.length === 0 ? (
                <p className={estilos.porQueNoSale}>{POR_QUE_NO_HAY_CIUDAD}</p>
              ) : (
                <div className={estilos.chips}>
                  {ciudades.map((ciudad) => {
                    const marcada = filtros.ciudades.includes(ciudad.codigo)
                    return (
                      <button
                        key={ciudad.codigo}
                        type="button"
                        className={marcada ? estilos.chipMarcado : estilos.chip}
                        aria-pressed={marcada}
                        onClick={() => alternarCiudad(ciudad.codigo)}
                      >
                        {ciudad.nombre}
                        <span className={estilos.cuantasEnLaVista}>{ciudad.cuantas}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </fieldset>

            <fieldset className={estilos.grupoFiltro}>
              <legend className={estilos.rotuloFiltro}>{laEtapaDe(etapa).nota}</legend>
              <div className={estilos.rango}>
                <input
                  className={estilos.cifraFiltro}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  aria-label={`${laEtapaDe(etapa).nota}, desde`}
                  placeholder="desde"
                  value={filtros.notaMin ?? ''}
                  onChange={(e) => cambiar('notaMin', aCifra(e.target.value))}
                />
                <span aria-hidden="true">–</span>
                <input
                  className={estilos.cifraFiltro}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  aria-label={`${laEtapaDe(etapa).nota}, hasta`}
                  placeholder="hasta"
                  value={filtros.notaMax ?? ''}
                  onChange={(e) => cambiar('notaMax', aCifra(e.target.value))}
                />
              </div>
              {/* Se dice, porque es lo que sorprende: una fila sin nota no es
                  «≥ 60» y desaparece en cuanto se escribe un extremo. */}
              <p className={estilos.pistaFiltro}>Quien no tiene nota queda fuera.</p>
            </fieldset>

            <fieldset className={estilos.grupoFiltro}>
              <legend className={estilos.rotuloFiltro}>Pretensión</legend>
              {/*
                ⚠️ **Sin pretensión en la tanda no hay rango que ofrecer**, y
                sobre todo hay que decir por qué. Un rango que solo puede quitar
                filas y nunca dejar ninguna es un control roto; y una columna en
                blanco se lee como «nadie pidió sueldo», que puede ser falso: la
                pretensión viaja bajo el permiso `ver_pretension` y solo lo tiene
                Dirección. `puedeVerPretension` dice cuál de los dos motivos es,
                así que la frase afirma uno en vez de enumerar hipótesis.
              */}
              {!trae.hayPretension ? (
                <p className={estilos.porQueNoSale}>
                  {porQueNoHayPretension(trae.puedeVerPretension)}
                </p>
              ) : (
                <>
                  <div className={estilos.rango}>
                    <input
                      className={estilos.cifraFiltro}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label="Pretensión, desde"
                      placeholder="desde"
                      value={filtros.pretensionMin ?? ''}
                      onChange={(e) => cambiar('pretensionMin', aCifra(e.target.value))}
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      className={estilos.cifraFiltro}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label="Pretensión, hasta"
                      placeholder="hasta"
                      value={filtros.pretensionMax ?? ''}
                      onChange={(e) => cambiar('pretensionMax', aCifra(e.target.value))}
                    />
                  </div>
                  {/* Solape y no contención: quien solo declaró un extremo entra
                      si ese extremo cabe en la banda. Ver `filtrarFino`. */}
                  <p className={estilos.pistaFiltro}>
                    Sale quien pida algo dentro de esa banda. Quien no la declaró queda fuera.
                  </p>
                </>
              )}
            </fieldset>
          </div>
        </details>

        {puesto && (
          <button
            type="button"
            className={estilos.quitarFiltros}
            onClick={() => alCambiar(SIN_FILTROS)}
          >
            Ver a todos
          </button>
        )}

        {/*
          ⚠️ **Sin violeta.** En esta pantalla el violeta es «Avanzar a N
          personas», la acción principal, y ya está puesto ahí abajo. Descargar
          una hoja no compite con eso.

          ⚠️ **Y el botón dice si está trabajando.** Armar el Excel de setenta y
          ocho filas con su detalle tarda; un botón que no cambia invita a
          pulsarlo tres veces y a bajar tres archivos iguales.
        */}
        {puedeDescargar && (
          <button
            type="button"
            className={estilos.descargar}
            onClick={alDescargar}
            disabled={descargando || cuantasSeVen === 0}
            aria-busy={descargando}
          >
            {descargando
              ? 'Preparando el Excel…'
              : cuantasSeVen === 0
                ? 'Nada que descargar'
                : `Descargar Excel (${cuantasSeVen})`}
          </button>
        )}
      </div>

      {/*
        Cuántas quedan de cuántas, en cuanto hay un filtro puesto. Es la misma
        regla que la cifra dentro de cada corte: ocultar sin decirlo es el
        indicador que miente, y aquí además parte del recorte está plegado.

        ⚠️ **La región viva se monta siempre y solo se esconde.** Naciendo con su
        contenido, el lector de pantalla no anuncia nada: para él no hubo cambio,
        apareció un párrafo nuevo. Es la trampa que el registro ya documenta con
        su `.oculto`, y aquí `.solo-lectores` de `mundo.css` hace lo mismo — deja
        el texto en el árbol de accesibilidad y fuera de la vista.
      */}
      <p className={puesto ? estilos.cuantasFiltradas : 'solo-lectores'} role="status">
        {puesto &&
          `Se ven ${cuantasSeVen} de ${cuantasHabia} de este corte.` +
            (puedeDescargar ? ' El Excel lleva exactamente estas, en este orden.' : '')}
      </p>
    </div>
  )
}

// ---------- La ficha, abierta debajo de la fila ----------

function DetalleDelPostulante({ fila, etapa }: { fila: FilaRanking; etapa: EtapaPanel }) {
  const catalogos = useQuery({
    queryKey: ['panel-catalogos'],
    queryFn: verCatalogos,
  })
  const nombreDeEstado = (codigo: string) =>
    catalogos.data?.estados.find((e) => e.codigo === codigo)?.nombre ?? codigo

  const ficha = useQuery({
    queryKey: ['panel-ficha', fila.postulacionId],
    queryFn: () => verFicha(fila.postulacionId),
  })
  const historial = useQuery({
    queryKey: ['panel-historial', fila.postulacionId],
    queryFn: () => verHistorial(fila.postulacionId),
  })

  const cache = useQueryClient()
  /*
    El ranking se invalida por prefijo, sin la vacante ni la etapa: una nota
    nueva cambia el orden de las cinco tablas, no solo el de la que se esta
    mirando, y aqui dentro no se conoce el id de la vacante.
  */
  const refrescarLasNotas = (clave: string) => () => {
    cache.invalidateQueries({ queryKey: [clave, fila.postulacionId] })
    cache.invalidateQueries({ queryKey: ['panel-ranking'] })
  }

  return (
    <div className={estilos.detalle}>
      <div className={estilos.columnaDetalle}>
        <h3 className={estilos.tituloDetalle}>La ficha</h3>
        {ficha.data && (
          <>
            <p className={estilos.dato}>
              <b>{ficha.data.candidato}</b> · {ficha.data.correo}
            </p>
            <p className={estilos.dato}>
              Postuló el {formatearFechaCorta(ficha.data.creadoEn)} ·{' '}
              {ficha.data.estadoNombre}
            </p>
            {ficha.data.resultadoOrgulloso && (
              <>
                <h4 className={estilos.subtitulo}>El resultado del que está orgulloso</h4>
                <p className={estilos.texto}>{ficha.data.resultadoOrgulloso}</p>
              </>
            )}
            {ficha.data.enlaces.length > 0 && (
              <p className={estilos.dato}>
                Enlaces:{' '}
                {ficha.data.enlaces.map((enlace) => (
                  <a href={enlace} target="_blank" rel="noreferrer" key={enlace}>
                    {enlace}
                  </a>
                ))}
              </p>
            )}
            {fila.archivoNombre && (
              <p className={estilos.dato}>Currículum: {fila.archivoNombre}</p>
            )}
          </>
        )}

        <h3 className={estilos.tituloDetalle}>Cómo llegó hasta aquí</h3>
        {historial.data && (
          <ol className={estilos.historial} role="list">
            {historial.data.map((paso, i) => (
              <li className={estilos.paso} key={`${paso.ocurridaEn}-${i}`}>
                <span className={estilos.cuandoPaso}>
                  {formatearFechaLarga(paso.ocurridaEn)}
                </span>
                <span>
                  {nombreDeEstado(paso.estadoNuevo)}
                  {paso.motivo ? ` — ${paso.motivo}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={estilos.columnaDetalle}>
        {etapa === 'PRUEBA_PUESTO' ? (
          <>
            <CriteriosDeEtapa
              titulo="La prueba del puesto, criterio a criterio"
              postulacionId={fila.postulacionId}
              clave="prueba"
              pedir={verNotasPrueba}
              sinDatos="Todavía no rindió la prueba, o nadie la calificó."
            />
            {/*
              La rubrica dice que nota le pusieron; esto, a que. Van juntas
              porque contrastar la una con la otra es el trabajo: leer un 6 de
              10 sin poder ver el texto que lo merecio es creerse el 6.
            */}
            <CalificarAUno
              postulacionId={fila.postulacionId}
              etapa="PRUEBA_PUESTO"
              alTerminar={refrescarLasNotas('panel-notas-prueba')}
            />
            {/*
              ⚠️ **El paso que faltaba, y por el que la columna salía vacía.**
              Calificar con IA pone la nota de cada criterio; la de la etapa
              nace solo de ponderarlas, y ese endpoint no estaba cableado. En la
              base local había una postulación con sus siete criterios
              calificados y la columna en blanco por esto exactamente.

              Va detrás del botón de la IA porque ese es el orden real: primero
              se califica, después se pondera.
            */}
            <NotaDeLaPrueba
              postulacionId={fila.postulacionId}
              notaEnElRanking={fila.notaEtapa}
              alCalcular={refrescarLasNotas('panel-notas-prueba')}
            />
            <RespuestasDePrueba postulacionId={fila.postulacionId} />
            {/*
              Al final y no arriba: la fecha propia se toca despues de mirar si
              rindio y que escribio, no antes. Quien no entrego nada es
              justamente de quien se decide si darle mas horas.
            */}
            <PlazoDeUnaPersona
              postulacionId={fila.postulacionId}
              /*
                No hay nada que refrescar y no es un descuido: la fecha propia
                no sale en ninguna otra parte de la ficha —`FichaPostulacion` no
                la trae— y el propio control ya ensena lo que contesto el
                servidor. Invalidar consultas aqui seria pedir datos que nadie
                va a mirar; el dia que la ficha traiga el plazo, esto pasa a
                refrescarla.
              */
              alGuardar={noHayNadaQueRefrescar}
            />
          </>
        ) : etapa === 'SIMULACION' ? (
          <CriteriosDeEtapa
            titulo="La simulación, criterio a criterio"
            postulacionId={fila.postulacionId}
            clave="simulacion"
            pedir={verNotasSimulacion}
            sinDatos="Todavía no pasó por la simulación, o nadie la calificó."
          />
        ) : etapa === 'VALIDACION' ? (
          <Validacion postulacionId={fila.postulacionId} />
        ) : (
          <>
            <LoQueCalificoLaIA fila={fila} />
            {/*
              Solo en Perfil integral y no en Decision, aunque las dos ensenen
              el mismo retrato: recalificar es rehacer la preseleccion, y
              ofrecerlo en la mesa donde se decide invita a mover la nota de
              alguien mientras se le esta juzgando.
            */}
            {etapa === 'PERFIL_INTEGRAL' && (
              <CalificarAUno
                postulacionId={fila.postulacionId}
                etapa="PERFIL_INTEGRAL"
                alTerminar={refrescarLasNotas('panel-perfil')}
              />
            )}
          </>
        )}
      </div>

      {/*
        La banda: lo que se compara renglon a renglon va a todo lo ancho, y no
        dentro de una columna. Solo aparece donde hay evaluacion del banco —
        Perfil integral y Decision—; las otras tres etapas caben en su columna.
      */}
      {(etapa === 'PERFIL_INTEGRAL' || etapa === 'DECISION') && (
        <div className={estilos.banda}>
          <LaEvaluacionDelBanco fila={fila} />
        </div>
      )}
    </div>
  )
}

/**
 * El perfil integral: las dos tablas. La del CV —los ocho criterios con su
 * porque— y la de la evaluacion del banco —cada respuesta abierta con la nota
 * y la evidencia que cito la IA, lo cerrado, y los semaforos—.
 *
 * En Decision se ensena esto mismo: decidir es mirar el retrato completo.
 */
function LoQueCalificoLaIA({ fila }: { fila: FilaRanking }) {
  const perfil = useQuery({
    queryKey: ['panel-perfil', fila.postulacionId],
    queryFn: () => verPerfilIntegral(fila.postulacionId),
  })

  /*
    Las cuatro dimensiones del retrato, que son lo que sostiene la nota.
    Llegan **en la propia fila del ranking**, así que se pintan al instante:
    esperar a `verPerfilIntegral` para enseñar cifras que ya se tienen deja la
    justificación en blanco durante el segundo en el que se decide.
  */
  const RETRATO = [
    ['Adecuación', fila.adecuacion, 'cuánto encaja con lo que el puesto pide'],
    ['Potencial', fila.potencial, 'cuánto puede crecer en el puesto'],
    ['Alto rendimiento', fila.altoRendimiento, 'evidencia de haber rendido por encima'],
    ['Confianza en la evidencia', fila.confianzaEvidencia, 'cuánto se apoya en hechos y no en adjetivos'],
  ] as const

  const criteriosDeLaFicha =
    fila.notasCriterio?.length ? fila.notasCriterio : (perfil.data?.notasCriterio ?? [])

  return (
    <>
      <h3 className={estilos.tituloDetalle}>Lo que calificó la IA</h3>

      {/*
        ⚠️ **Con su procedencia dicha.** Las cuatro salen del `PerfilTalento`,
        que se arma una vez con el currículum y no se recalcula por etapa: en la
        ficha abierta desde Decisión son las mismas de hace tres semanas.
      */}
      {RETRATO.some(([, valor]) => valor !== null) && (
        <>
          <h4 className={estilos.subtitulo}>El retrato del currículum, en cifras</h4>
          <dl className={estilos.retrato}>
            {RETRATO.map(([nombre, valor, porQue]) => (
              <div className={estilos.dimension} key={nombre}>
                <dt className={estilos.nombreDimension}>{nombre}</dt>
                <dd className={estilos.cifraDimension}>{valor ?? '—'}</dd>
                <dd className={estilos.porQueDimension}>{porQue}</dd>
              </div>
            ))}
          </dl>
          <p className={estilos.dato}>
            {fila.fortalezas} fortaleza{fila.fortalezas === 1 ? '' : 's'} ·{' '}
            {fila.riesgosCriticos} riesgo{fila.riesgosCriticos === 1 ? '' : 's'} crítico
            {fila.riesgosCriticos === 1 ? '' : 's'} · {fila.alertas} alerta
            {fila.alertas === 1 ? '' : 's'}
            {fila.actualizadoEn && ` · calificado el ${formatearFechaCorta(fila.actualizadoEn)}`}
            {fila.pasada === 'RAPIDA' && ' · criba rápida: la fina va a pisar esta nota'}
          </p>
        </>
      )}

      {/* El porqué en prosa, también desde la fila: no espera a la petición. */}
      {fila.resumen && <p className={estilos.texto}>{fila.resumen}</p>}

      {perfil.isPending && <p className={estilos.dato}>Cargando el retrato…</p>}
      {perfil.data && (
        <>
          {!perfil.data.resumen && !fila.resumen && (
            <p className={estilos.dato}>
              Sin retrato todavía: la calificación está{' '}
              {perfil.data.estadoCalificacion.toLowerCase().replaceAll('_', ' ')}.
            </p>
          )}

          {perfil.data.hallazgos.length > 0 && (
            <>
              <h4 className={estilos.subtitulo}>Hallazgos y alertas</h4>
              <ul className={estilos.hallazgos} role="list">
                {perfil.data.hallazgos.map((h, i) => (
                  <li className={estilos.hallazgo} key={i}>
                    <span className={`${estilos.etiqueta} ${tonoDe(h.tipo)}`}>
                      {enPalabras(h.tipo)}
                    </span>
                    <span>{h.texto}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

        </>
      )}

      {/*
        ⚠️ **Criterio a criterio se pinta de la FILA, no de la petición.** Los
        ocho criterios con su puntaje, su máximo, su peso y su explicación ya
        viajan en `fila.notasCriterio`; estaban llegando y nadie los leía, y la
        ficha volvía a pedir por HTTP lo que ya tenía en memoria. Es el mismo
        razonamiento del retrato de arriba: dejar la justificación en blanco
        durante el segundo en el que se decide es justo lo que no se quiere.

        El respaldo a `perfil.data` no es ceremonia: mientras el backend viaja en
        paralelo, una respuesta antigua puede no traer el campo, y sin esto la
        ficha se quedaría sin criterios en vez de tardar un segundo en tenerlos.
      */}
      {criteriosDeLaFicha.length > 0 && (
        <>
          <h4 className={estilos.subtitulo}>Criterio a criterio</h4>
          <ul className={estilos.criterios} role="list">
            {criteriosDeLaFicha.map((n) => {
              const cubre = cuantoCubre(n)
              return (
                <li className={estilos.criterio} key={n.criterio}>
                  <span className={estilos.notaCriterio}>{notaEscrita(n)}</span>
                  {/*
                    La barrita mide lo mismo que tiñe la celda de la tabla: sale
                    de `tonoDelCriterio`, así que la ficha y la tabla no pueden
                    discrepar sobre si un criterio está cubierto.

                    `aria-hidden` porque no añade nada a un lector: el «18/20» de
                    al lado ya lo dice, y con más precisión.
                  */}
                  <span className={estilos.barraCriterio} aria-hidden="true">
                    {cubre !== null && (
                      <span
                        className={estilos[tonoDelCriterio(n)]}
                        style={{ width: `${Math.min(100, Math.round(cubre * 100))}%` }}
                      />
                    )}
                  </span>
                  <span>
                    <b>{n.criterio}</b> · peso {n.peso}
                    {/*
                      Quién puso la nota. `motivoAjuste` no nulo significa
                      exactamente una cosa —lo garantiza un CHECK en la base: sin
                      motivo, la nota ajustada no entra— y es lo primero que hay
                      que ver antes de discutir un número.
                    */}
                    {n.motivoAjuste != null
                      ? ' · ajustada a mano'
                      : n.origen === 'AGENTE'
                        ? ' · la puso la IA'
                        : ''}
                    {/*
                      La confianza va de 0 a 100, no de 0 a 1. Tratarla como
                      fracción pintaría un 87 % como un 8.700 %.
                    */}
                    {n.confianza != null && ` · confianza ${n.confianza}`}
                    {n.explicacion && (
                      <span className={estilos.explicacion}>{n.explicacion}</span>
                    )}
                    {n.motivoAjuste && (
                      <span className={estilos.explicacion}>
                        Una persona corrigió esta nota: {n.motivoAjuste}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}

/**
 * La evaluacion del banco, en su propia banda.
 *
 * Vivia dentro de la columna derecha, en quinientos pixeles, y con cincuenta
 * preguntas eso era una tabla de tres columnas partida a martillazos al lado de
 * media pantalla vacia. La ficha y el retrato son ORIENTACION —cortos, se leen
 * una vez— y esto es el TRABAJO: se compara renglon a renglon y necesita el
 * ancho entero.
 */
function LaEvaluacionDelBanco({ fila }: { fila: FilaRanking }) {
  const evaluacion = useQuery({
    queryKey: ['panel-desglose-evaluacion', fila.postulacionId],
    queryFn: () => verDesgloseEvaluacion(fila.postulacionId),
  })

  return (
    <>
      <h3 className={estilos.tituloDetalle}>La evaluación del banco</h3>
      {evaluacion.isPending && <p className={estilos.dato}>Abriendo la evaluación…</p>}
      {evaluacion.data && <TablaDeLaEvaluacion desglose={evaluacion.data} />}
    </>
  )
}

/**
 * La evaluacion del banco, abierta por dentro. Una respuesta sin nota se
 * ensena igual: respondida y pendiente es informacion, no un hueco.
 */
function TablaDeLaEvaluacion({ desglose }: { desglose: DesgloseEvaluacion }) {
  if (desglose.estado === null) {
    return (
      <p className={estilos.dato}>
        Esta postulación no lleva evaluación del banco: la vacante se publicó con ella
        apagada.
      </p>
    )
  }

  const sinNota = desglose.abiertas.filter((a) => a.puntaje === null).length

  return (
    <>
      <p className={estilos.dato}>
        {desglose.notaEvaluacion !== null
          ? `Nota de la evaluación: ${desglose.notaEvaluacion} sobre 100. `
          : 'Todavía sin nota de conjunto. '}
        {desglose.cerradas.preguntas > 0 &&
          `Las ${desglose.cerradas.preguntas} cerradas promedian ${desglose.cerradas.nota}.`}
        {sinNota > 0 &&
          ` ${sinNota} ${sinNota === 1 ? 'respuesta abierta espera' : 'respuestas abiertas esperan'} calificación.`}
      </p>

      {desglose.abiertas.length > 0 && (
        <div className={tabla.envoltura}>
          <table className={`${tabla.tabla} ${estilos.tablaEvaluacion}`}>
            <thead>
              <tr>
                <th>Pregunta y respuesta</th>
                <th className={`${tabla.cifra} ${estilos.celdaNota}`}>Nota</th>
                <th>Lo que vio la IA</th>
              </tr>
            </thead>
            <tbody>
              {desglose.abiertas.map((a, i) => (
                <tr key={i}>
                  <td className={estilos.celdaRespuesta}>
                    <b>{a.pregunta}</b>
                    <span className={estilos.respuestaDada}>{a.respuesta}</span>
                  </td>
                  <td className={tabla.cifra}>
                    {a.puntaje !== null ? `${a.puntaje}/4` : '—'}
                  </td>
                  <td className={estilos.celdaExplicacion}>
                    {a.explicacion ?? 'Pendiente de calificar.'}
                    {a.evidenciaCitada && (
                      <span className={estilos.evidencia}>Citó: {a.evidenciaCitada}</span>
                    )}
                    {a.motivoAjuste && (
                      <span className={estilos.evidencia}>
                        Nota ajustada a mano: {a.motivoAjuste}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {desglose.alineacion.length > 0 && (
        <>
          <h4 className={estilos.subtitulo}>Alineación personal</h4>
          <ul className={estilos.hallazgos} role="list">
            {desglose.alineacion.map((a) => (
              <li className={estilos.hallazgo} key={a.bloque}>
                <span className={`${estilos.etiqueta} ${tonoDe(a.semaforo)}`}>
                  {enPalabras(a.semaforo)}
                </span>
                <span>
                  <b>{a.bloque}</b>
                  {a.explicacion ? ` — ${a.explicacion}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/**
 * Las notas por criterio de una etapa que califica con rubrica: la prueba y
 * la simulacion comparten forma porque el backend les da la misma.
 */
const autorDeLaNota = (origen: string) =>
  origen === 'AGENTE' ? 'calificó la IA' : origen === 'PERSONA' ? 'ajustado a mano' : origen

function CriteriosDeEtapa({
  titulo,
  postulacionId,
  clave,
  pedir,
  sinDatos,
}: {
  titulo: string
  postulacionId: number
  clave: string
  pedir: (postulacionId: number) => Promise<NotaCriterioEtapa[]>
  sinDatos: string
}) {
  const notas = useQuery({
    queryKey: [`panel-notas-${clave}`, postulacionId],
    queryFn: () => pedir(postulacionId),
    retry: false,
  })

  return (
    <>
      <h3 className={estilos.tituloDetalle}>{titulo}</h3>
      {notas.isPending && <p className={estilos.dato}>Cargando las notas…</p>}
      {notas.isError && <p className={estilos.dato}>{leerFallo(notas.error, sinDatos)}</p>}
      {notas.data &&
        (notas.data.length === 0 ? (
          <p className={estilos.dato}>{sinDatos}</p>
        ) : (
          <ul className={estilos.criterios} role="list">
            {notas.data.map((n) => (
              <li className={estilos.criterio} key={n.criterioId}>
                <span className={estilos.notaCriterio}>
                  {n.puntaje !== null
                    ? `${n.puntaje}${n.puntosMaximos ? `/${n.puntosMaximos}` : ''}`
                    : '—'}
                </span>
                <span>
                  <b>{n.nombre}</b>
                  {/*
                    ⚠️ **Los dos valores son `AGENTE` y `PERSONA`**, nunca `IA`:
                    los escriben `PuentePruebaIaImpl` y `ServicioCalificacionPrueba`.
                    Comparando con `'IA'`, toda nota puesta por el agente caía en
                    el `else` y decía «ajustado a mano» — es decir, que un humano
                    tocó una nota que nadie tocó.

                    Un valor que no se conozca se enseña tal cual en vez de
                    caer en una de las dos ramas: inventarle un autor es peor
                    que no saberlo.
                  */}
                  {n.origen && ` · ${autorDeLaNota(n.origen)}`}
                  {n.explicacion && (
                    <span className={estilos.explicacion}>{n.explicacion}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </>
  )
}

/** El periodo de validacion: la cabecera del periodo y sus metricas. */
function Validacion({ postulacionId }: { postulacionId: number }) {
  // 404 mientras nadie la habilite: es lo normal antes de llegar aqui.
  const periodo = useQuery({
    queryKey: ['panel-validacion', postulacionId],
    queryFn: () => verValidacion(postulacionId),
    retry: false,
  })

  return (
    <>
      <h3 className={estilos.tituloDetalle}>El periodo de validación</h3>
      {periodo.isPending && <p className={estilos.dato}>Cargando el periodo…</p>}
      {periodo.isError && (
        <p className={estilos.dato}>
          Todavía no tiene un periodo de validación habilitado.
        </p>
      )}
      {periodo.data && (
        <p className={estilos.dato}>
          {periodo.data.dias ? `${periodo.data.dias} días` : 'Sin plazo definido'}
          {periodo.data.modalidad ? ` · ${periodo.data.modalidad}` : ''}
          {' · '}
          {periodo.data.inicioEn
            ? `del ${formatearFechaCorta(periodo.data.inicioEn)}`
            : 'sin empezar'}
          {periodo.data.finEn ? ` al ${formatearFechaCorta(periodo.data.finEn)}` : ''}
          {' · '}
          {periodo.data.estado.toLowerCase().replaceAll('_', ' ')}
        </p>
      )}
      {periodo.data && (
        <CriteriosDeEtapa
          titulo="Las métricas del periodo"
          postulacionId={postulacionId}
          clave="validacion"
          pedir={verMetricasValidacion}
          sinDatos="Sin métricas completadas todavía."
        />
      )}
    </>
  )
}

// ---------- Los requisitos indispensables ----------

function Requisitos({ vacanteId }: { vacanteId: number }) {
  const cache = useQueryClient()
  const requisitos = useQuery({
    queryKey: ['panel-requisitos', vacanteId],
    queryFn: () => listarRequisitos(vacanteId),
  })
  const [descripcion, setDescripcion] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)

  const invalidar = () =>
    cache.invalidateQueries({ queryKey: ['panel-requisitos', vacanteId] })

  const alta = useMutation({
    // La regla es la descripcion misma: el backend la guarda para poder
    // explicar despues por que se cerro una postulacion.
    mutationFn: () => crearRequisito(vacanteId, descripcion.trim(), descripcion.trim()),
    onSuccess: async () => {
      setDescripcion('')
      await invalidar()
    },
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo añadir.'),
  })
  const baja = useMutation({
    mutationFn: (requisitoId: number) => quitarRequisito(vacanteId, requisitoId),
    onSuccess: invalidar,
    onError: (c) => setFallo(c instanceof Error ? c.message : 'No se pudo desactivar.'),
  })

  const activos = (requisitos.data ?? []).filter((r) => r.esActivo)

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Requisitos indispensables</h2>
      <p className={estilos.notaRequisitos}>
        Lo único que descarta sin intervención humana: quien postule y no confirme uno,
        queda fuera en el acto. Por eso se escriben como frases que se responden con sí o
        no.
      </p>

      <ul className={estilos.requisitos} role="list">
        {activos.map((r) => (
          <li className={estilos.requisito} key={r.id}>
            <span>{r.descripcion}</span>
            <button
              className={estilos.quitarRequisito}
              type="button"
              onClick={() => baja.mutate(r.id)}
              disabled={baja.isPending}
            >
              Desactivar
            </button>
          </li>
        ))}
        {activos.length === 0 && (
          <li className={estilos.sinRequisitos}>
            No hay ninguno: nadie será descartado automáticamente.
          </li>
        )}
      </ul>

      <div className={estilos.altaRequisito}>
        <input
          className={estilos.entradaMotivo}
          type="text"
          placeholder="«Tengo disponibilidad para trabajar de forma híbrida en Lima.»"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <button
          className={estilos.anadir}
          type="button"
          onClick={() => alta.mutate()}
          disabled={alta.isPending || descripcion.trim() === ''}
        >
          Añadir requisito
        </button>
      </div>
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

// ---------- Lo que hace falta para poder publicar ----------

/**
 * El banco de preguntas que va a responder quien postule a esta vacante.
 *
 * No se elige: se publica por NIVEL en Configuracion y rige para toda la
 * organizacion, asi que la vacante lo hereda del nivel de su puesto. Es la
 * misma resolucion que hace el backend en `crearAlPostular`, adelantada aqui
 * para poder decir de antemano que se va a responder y cuanto durara.
 *
 * Vive fuera de la seccion porque **la cabecera tambien lo necesita**: sin
 * banco del nivel el backend rechaza publicar, y el boton tiene que decirlo
 * antes de pulsarlo. Las dos consultas comparten `queryKey`, asi que llamarlo
 * dos veces no cuesta una peticion mas.
 */
/**
 * Si el cuestionario técnico de esta vacante está publicado.
 *
 * <p>Comparte `queryKey` con la tarjeta de estado, así que no cuesta una petición más. Y
 * distingue las tres cosas que no son lo mismo: todavía no se sabe, no se puede saber
 * —`ver_vacantes` alcanza, pero un 403 o un 500 no son un «no hay»— y no hay.
 */
function useCuestionarioPublicado(vacanteId: number) {
  const cuestionario = useQuery({
    queryKey: claveDelCuestionario(vacanteId),
    queryFn: () => verCuestionarioTecnico(vacanteId),
  })
  if (cuestionario.isPending || cuestionario.isError) {
    return null      // no se sabe: no se afirma que falte
  }
  return cuestionario.data.estado === 'PUBLICADA'
}

function useBancoDelNivel(puestoId: number | undefined) {
  const puestos = useQuery({ queryKey: ['panel-puestos'], queryFn: listarPuestos })
  const bancos = useQuery({
    queryKey: ['panel-versiones-banco'],
    queryFn: listarVersionesBanco,
  })

  const puesto = puestoId == null ? undefined : puestos.data?.find((p) => p.id === puestoId)
  const nivel = puesto?.nivelPuestoCodigo

  /*
    ⚠️ **`isError` es tan importante como `isPending`, y por motivos distintos.**
    `GET /banco-preguntas/versiones` pide `ver_banco_preguntas`, que el detalle
    de la vacante NO pide: un rol con `ver_vacantes` y sin aquel recibe un 403
    aqui. Sin esta rama, `data` llega vacio, `isPending` es falso y la pantalla
    afirmaria «no hay ningun banco publicado para este nivel» —que es mentira, y
    ademas contradice al backend, que si lo ve y deja publicar—.

    Lo mismo con el puesto: `listarPuestos` solo devuelve los ACTIVOS, asi que
    una vacante de un puesto desactivado se quedaria en «buscando» para siempre.
  */
  const noSePuedeSaber =
    bancos.isError ||
    puestos.isError ||
    (puestoId != null && !puestos.isPending && puesto == null)

  /*
    Mismo desempate que el backend: `publicadaEn desc`, la mas reciente. El
    orden en que llega la lista es `creadoEn desc`, que NO es lo mismo — con dos
    publicadas del mismo nivel (situacion que el panel del banco documenta y
    avisa) el panel nombraria una y el candidato responderia la otra.
  */
  const banco = !nivel
    ? undefined
    : (bancos.data ?? [])
        .filter(
          (b) =>
            b.tipoBanco === 'NIVEL' &&
            b.estado === 'PUBLICADA' &&
            b.nivelPuestoCodigo === nivel,
        )
        .sort((a, b) => (b.publicadaEn ?? '').localeCompare(a.publicadaEn ?? ''))[0]

  return {
    banco,
    nivel,
    noSePuedeSaber,
    buscando: !noSePuedeSaber && (puestos.isPending || bancos.isPending || !nivel),
  }
}

/**
 * La configuracion de la vacante: que responde, que prueba rinde y que pesos rigen.
 *
 * Existe porque **sin esto no se puede publicar**: el backend exige la version
 * de la prueba y —si la evaluacion del banco esta encendida— un banco publicado
 * del nivel del puesto, y rechaza la publicacion con un mensaje que, sin esta
 * pantalla, no tenia donde resolverse.
 *
 * ⚠️ **La plantilla de evaluacion ya no se elige aqui, ni se filtra, ni se
 * exige.** La resuelve el nivel desde la V44: era una pregunta con una sola
 * respuesta legal y, con las cuotas retiradas, tampoco decide que preguntas
 * caen. En su sitio hay una linea que dice que banco se va a responder.
 */
function ConfiguracionDeLaVacante({ vacante }: { vacante: VacantePanel }) {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)

  const {
    banco: bancoDelNivel,
    nivel,
    noSePuedeSaber,
    buscando: buscandoElBanco,
  } = useBancoDelNivel(vacante.puestoId)
  const plantillasPrueba = useQuery({
    queryKey: ['panel-plantillas-prueba'],
    queryFn: listarPlantillasPrueba,
  })
  /*
    Las versiones de cada plantilla, ahora que el backend sabe listarlas.

    Aqui habia un rastreo que **adivinaba ids** —de ocho en ocho hasta dar con
    un hueco— porque `GET /plantillas-prueba/{id}/versiones` no existia. Ya
    existe: se pregunta plantilla por plantilla y se juntan. Cuelga de
    `plantillasPrueba` a proposito, y por eso el `enabled`: sin el, la primera
    pasada preguntaria por una lista vacia y el desplegable saldria sin
    opciones antes de que nadie lo tocara.
  */
  const idsDePlantillas = (plantillasPrueba.data ?? []).map((p) => p.id)
  const versionesPrueba = useQuery({
    queryKey: [
      'panel-versiones-prueba',
      idsDePlantillas,
      vacante.versionPlantillaPruebaId,
    ],
    /*
      ⚠️ **Se espera a que las plantillas TERMINEN, no a que acierten.** Con
      `isSuccess`, un fallo al listarlas dejaba esta consulta apagada para
      siempre: `isPending` no baja nunca, el desplegable se queda deshabilitado
      diciendo «Buscando las pruebas…», y ninguno de los tres carteles de abajo
      —que exigen `!isPending`— llega a salir. Una espera eterna sin explicar,
      que es la version silenciosa del indicador que miente. Terminando en
      error, se corre igual con la lista vacia y el cartel dice qué pasó.
    */
    enabled: !plantillasPrueba.isLoading,
    queryFn: async () => {
      const porPlantilla = await Promise.all(
        idsDePlantillas.map((id) => listarVersionesPrueba(id)),
      )
      const todas = porPlantilla.flat()

      /*
        ⚠️ **La que la vacante ya tiene puesta se busca aparte si hace falta.**
        Normalmente esta entre las de arriba: el backend valida la asignacion
        contra el mismo dueño que resuelve el listado de plantillas. Pero si esa
        resolucion cambio despues de asignarla —la empresa personalizo sus
        instrumentos—, su plantilla ya no sale en la lista y la version elegida
        no llegaria nunca. El `<select>` se quedaria sin su `<option>` y diria
        «Elige la prueba…» sobre una vacante que si tiene prueba.
      */
      const puesta = vacante.versionPlantillaPruebaId
      if (puesta === null || todas.some((v) => v.id === puesta)) return todas
      const suelta = await verVersionDePrueba(puesta).catch(() => null)
      return suelta === null ? todas : [...todas, suelta.version]
    },
  })
  const pesos = useQuery({
    queryKey: ['panel-pesos'],
    queryFn: listarVersionesPesos,
  })

  const refrescar = () =>
    cache.invalidateQueries({ queryKey: ['panel-vacante', vacante.id] })
  const alFallar = (c: unknown) =>
    setFallo(c instanceof Error ? c.message : 'No se pudo guardar.')

  const prueba = useMutation({
    mutationFn: (id: number) => asignarPlantillaPrueba(vacante.id, id),
    onSuccess: refrescar,
    onError: alFallar,
  })
  const banco = useMutation({
    mutationFn: (aplica: boolean) => aplicarEvaluacion(vacante.id, aplica),
    onSuccess: refrescar,
    onError: alFallar,
  })
  /*
    Qué se rinde en la etapa técnica, y en cuántos minutos. Van juntos en la misma
    llamada porque el backend los recibe juntos: los minutos son parte de la vara, no un
    ajuste aparte, y cambiarlos con gente dentro se frena igual que cambiar de
    instrumento.
  */
  const instrumento = useMutation({
    mutationFn: (datos: DatosDelInstrumento) => elegirInstrumentoTecnico(vacante.id, datos),
    onSuccess: refrescar,
    onError: alFallar,
  })
  const version = useMutation({
    mutationFn: (id: number) => asignarVersionPesos(vacante.id, id),
    onSuccess: refrescar,
    onError: alFallar,
  })


  /*
    ⚠️ `Number('')` es `0`, no `undefined`.

    Elegir la linea vacia de un desplegable mandaba un id `0` al backend, que
    contesta «not found with id: '0'» sobre una fila que nadie escogio. Volver a
    «Elige…» no es una eleccion: no se manda nada.
  */
  const alElegir = (valor: string, mutar: (id: number) => void) => {
    if (valor !== '') {
      mutar(Number(valor))
    }
  }

  /*
    Las pruebas que sirven para ESTE puesto.

    Sin filtrar, una vacante de Desarrollador web ofrecia el «Cuestionario
    tecnico · Administrador General»: elegirla es escoger una prueba de otro
    puesto sin que nada avise. Es la misma razon por la que el banco lo fija el
    nivel y no se elige.

    ⚠️ **Una plantilla con `puestoId` null es generica y vale para cualquiera**,
    asi que se queda: filtrarla fuera dejaria sin opciones a casi toda vacante.
  */
  /*
    Las que se pueden elegir de verdad: publicadas.

    Antes no se sabia —el rastreo por ids no traia el estado— y el desplegable
    ofrecia borradores que el backend rechaza con un 409 («Esa version todavia
    esta en borrador»). Ahora el estado llega, y el cartel de mas abajo ya
    decia lo que hay que hacer con ellas: «falta crear y publicar una version».
  */
  const versionesUsables = (versionesPrueba.data ?? []).filter(
    (v) => v.estado === 'PUBLICADA' || v.id === vacante.versionPlantillaPruebaId,
  )

  const pruebasDelPuesto = versionesUsables.filter((v) => {
    /*
      ⚠️ **La que la vacante YA tiene puesta no se filtra nunca.** El backend
      no valida el puesto al asignarla, asi que existen asignaciones cruzadas
      legitimas; escondiendola, el `<select>` no encontraria su `<option>` y
      diria «Elige la prueba…» sobre una vacante que si tiene prueba elegida.
    */
    if (v.id === vacante.versionPlantillaPruebaId) return true
    const suyo = plantillasPrueba.data?.find((p) => p.id === v.plantillaPruebaId)
    return suyo == null || suyo.puestoId == null || suyo.puestoId === vacante.puestoId
  })

  const nombreDePlantillaPrueba = (plantillaPruebaId: number) =>
    plantillasPrueba.data?.find((p) => p.id === plantillaPruebaId)?.nombre ??
    `Plantilla ${plantillaPruebaId}`

  // La misma regla que el boton de publicar, y por eso mira lo mismo: el banco en vez de
  // la plantilla de evaluacion, y el instrumento que la vacante eligio para su etapa
  // tecnica. Si las dos se separan, el boton y el cartel se contradicen en la misma
  // pantalla — que es como se descubrio la vez anterior.
  const cuestionarioPublicado = useCuestionarioPublicado(vacante.id)
  const listaParaPublicar =
    (!vacante.aplicaEvaluacion || bancoDelNivel != null) &&
    (vacante.instrumentoEtapaTecnica === 'CUESTIONARIO_TECNICO'
      ? cuestionarioPublicado === true
      : vacante.versionPlantillaPruebaId !== null)

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>Qué responderá quien postule</h2>

      {vacante.estado === 'BORRADOR' && listaParaPublicar && (
        <p className={estilos.listaParaPublicar} role="status">
          Todo listo: ya se puede publicar.
        </p>
      )}

      <div className={estilos.configuracion}>
        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>La evaluación del banco</span>
          <span className={estilos.interruptor}>
            <input
              type="checkbox"
              checked={vacante.aplicaEvaluacion}
              onChange={(e) => banco.mutate(e.target.checked)}
              disabled={banco.isPending}
            />
            {vacante.aplicaEvaluacion
              ? 'Encendida: responderá el cuestionario del banco'
              : 'Apagada: la prueba del puesto será su única evaluación'}
          </span>
        </label>

        {/*
          Qué banco responderá quien postule. **Es una línea, no un desplegable**,
          y eso es el cambio: aquí se elegía la plantilla de evaluación, una
          pregunta obligatoria para publicar que solo tenía una respuesta legal
          —hay una publicada por nivel, y el backend rechazaba las de otro—. Y
          desde que se retiraron las cuotas, la plantilla ni siquiera decide qué
          preguntas caen: el examen es el banco entero del nivel.

          Lo que faltaba no era elegir mejor, era decir qué va a pasar. Antes la
          pantalla nombraba «el cuestionario del banco» sin decir cuál, así que
          quien publicaba una vacante no tenía forma de saber qué se iba a
          responder ni cuánto duraría.
        */}
        {vacante.aplicaEvaluacion && (
          <div className={estilos.ajuste}>
            <span className={estilos.etiquetaAjuste}>
              Qué evaluación responderá{nivel ? ` · nivel ${nivel}` : ''}
            </span>
            {noSePuedeSaber ? (
              /*
                No se dice ni que hay banco ni que no lo hay: no se sabe. La
                causa mas comun es un permiso —`ver_banco_preguntas` no viene
                con `ver_vacantes`— y afirmar cualquiera de las dos cosas
                contradiria al backend, que si lo ve.
              */
              <span className={estilos.ayudaAjuste} role="status">
                No se pudo averiguar qué banco le toca a este nivel. Publicar seguirá
                funcionando si lo hay: quien decide es el backend. Suele faltar el permiso
                para ver el banco de preguntas.
              </span>
            ) : buscandoElBanco ? (
              <p className={estilos.bancoQueRige} role="status">
                Buscando el banco de este nivel…
              </p>
            ) : bancoDelNivel ? (
              <>
                <p className={estilos.bancoQueRige}>{bancoDelNivel.etiqueta}</p>
                {/*
                  ⚠️ `typeof … === 'number'`, no `!== null`. El campo nacio en la V44,
                  asi que un backend anterior NO LO MANDA y llega `undefined`: con un
                  `!== null` eso cae en la otra rama y pinta «undefined minutos» en la
                  cara de quien publica la vacante. Lo encontro el e2e contra un backend
                  sin la migracion, que es exactamente lo que pasa mientras el portal va
                  por delante en un despliegue.
                */}
                <span className={estilos.ayudaAjuste}>
                  {typeof bancoDelNivel.minutosObjetivo === 'number'
                    ? `${bancoDelNivel.minutosObjetivo} minutos. Lo fija el nivel del puesto: para cambiarlo se publica otra versión en Configuración.`
                    : 'Lo fija el nivel del puesto. Para cambiarlo se publica otra versión en Configuración.'}
                </span>
              </>
            ) : (
              /*
                Ámbar y no rojo: nadie se ha equivocado, pero cambia lo que se
                puede hacer ahora. Es lo que impide publicar, así que dice dónde
                se arregla y cuál es la otra salida.
              */
              <p className={estilos.pista} role="status">
                No hay ningún banco publicado para este nivel, así que la vacante no se puede
                publicar todavía. Se publica uno en Configuración, o se apaga la evaluación aquí
                arriba y basta con la prueba del puesto.
              </p>
            )}
          </div>
        )}

        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Qué rendirá en la etapa técnica</span>
          <select
            className={estilos.eleccion}
            value={vacante.instrumentoEtapaTecnica}
            onChange={(e) =>
              instrumento.mutate({
                instrumento: e.target.value as InstrumentoTecnico,
                minutos: vacante.minutosEtapaTecnica,
              })
            }
            disabled={instrumento.isPending}
          >
            <option value="PLANTILLA">Una prueba del puesto, de las que ya están escritas</option>
            <option value="CUESTIONARIO_TECNICO">
              El cuestionario técnico que escribe la IA para esta vacante
            </option>
          </select>
          <span className={estilos.ayudaAjuste}>
            {vacante.instrumentoEtapaTecnica === 'CUESTIONARIO_TECNICO'
              ? 'Preguntas escritas para este puesto y esta empresa, a partir de lo que cuente el dueño. Se contestan escribiendo: aquí no se entrega ningún archivo.'
              : 'Un problema nuevo que resolver, con su enunciado y lo que hay que entregar. Se elige abajo.'}
          </span>
        </label>

        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Cuánto tiempo tendrá</span>
          <MinutosDeLaEtapa vacante={vacante} alGuardar={instrumento.mutate}
                            guardando={instrumento.isPending} />
        </label>

        {/* Todo lo que no sea el cuestionario es la prueba del puesto, incluido un campo
            que no llegara: `PLANTILLA` es el valor por defecto del servidor, y esconder
            los dos desplegables dejaría la vacante sin forma de configurarse. */}
        {vacante.instrumentoEtapaTecnica !== 'CUESTIONARIO_TECNICO' && (
        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Qué prueba del puesto rendirá</span>
          <select
            className={estilos.eleccion}
            value={vacante.versionPlantillaPruebaId ?? ''}
            onChange={(e) => alElegir(e.target.value, prueba.mutate)}
            disabled={prueba.isPending || versionesPrueba.isPending}
          >
            <option value="">
              {versionesPrueba.isPending ? 'Buscando las pruebas…' : 'Elige la prueba…'}
            </option>
            {pruebasDelPuesto.map((v) => (
              <option value={v.id} key={v.id}>
                {nombreDePlantillaPrueba(v.plantillaPruebaId)} · v{v.version}
              </option>
            ))}
          </select>
          {/*
            Un desplegable con una sola linea y esa vacia no dice nada: quien lo
            abre no sabe si el panel sigue cargando, si le falta permiso o si de
            verdad no hay ninguna prueba escrita. Y como esta eleccion es
            obligatoria para publicar, quedarse callado aqui es dejar la vacante
            atascada sin explicar en que. Las plantillas SI se listan de verdad,
            asi que se puede distinguir «no hay ninguna prueba» de «hay
            plantillas pero ninguna version que se pueda usar».
          */}
          {!versionesPrueba.isPending && pruebasDelPuesto.length === 0 && (
            <span className={estilos.ayudaAjuste} role="status">
              {/* ⚠️ El fallo va primero: sin esta rama, no poder leer las pruebas
                  se contaba como que no hay ninguna, y mandaba a escribir una
                  que a lo mejor ya existe. */}
              {plantillasPrueba.isError
                ? 'No se pudieron cargar las pruebas del puesto, así que no hay ninguna que ofrecer aquí. Puede ser un problema de permiso o del servidor: al recargar se vuelve a intentar.'
                : (plantillasPrueba.data ?? []).length === 0
                ? 'No hay ninguna prueba escrita todavía, y sin una la vacante no se puede publicar.'
                : versionesUsables.length === 0
                  ? `Hay ${(plantillasPrueba.data ?? []).length} prueba(s) escritas, pero ninguna con una versión publicada que se pueda usar aquí. Falta terminar y publicar una versión.`
                  : 'Ninguna de las pruebas escritas es de este puesto. Hace falta una para él, o una genérica que valga para cualquiera. Sin ella la vacante no se puede publicar.'}{' '}
              {/* El sitio donde se arregla, y ahora existe: hasta hoy este texto
                  mandaba a «el módulo de pruebas», que no era ninguna pantalla. */}
              <Link to={rutas.adminPruebas()}>Ir a las pruebas del puesto</Link>.
            </span>
          )}
        </label>
        )}

        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Qué pesos rigen la decisión</span>
          <select
            className={estilos.eleccion}
            value={vacante.versionPesosId ?? ''}
            onChange={(e) => alElegir(e.target.value, version.mutate)}
            disabled={version.isPending}
          >
            <option value="" disabled={vacante.versionPesosId !== null}>
              Los pesos generales
            </option>
            {(pesos.data ?? [])
              .filter((p) => p.estado === 'PUBLICADA')
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.etiqueta}
                </option>
              ))}
          </select>
          {/*
            ⚠️ **No hay forma de volver a los pesos generales.** El backend solo
            tiene `POST .../version-pesos`, que exige un id: ninguna ruta
            desasigna. Sin la linea, elegir «Los pesos generales» mandaba un id
            `0` y contestaba «not found with id: '0'»; con el guardian puesto no
            haria nada, que engaña igual. Se apaga la opcion y se dice por que.
          */}
          {vacante.versionPesosId !== null && (
            <span className={estilos.ayudaAjuste}>
              Ya no se puede volver a los pesos generales desde aquí: se cambia por otra versión
              publicada, no se quita.
            </span>
          )}
        </label>
      </div>

      {/*
        La prueba tecnica del puesto —la ficha del dueño y el cuestionario que
        redacta la IA— es de esta misma familia, lo que se le pide a quien
        postule, pero no cabe en un desplegable: tiene su pagina. Aqui queda el
        estado y el enlace. No entra en `leFalta` ni en `listaParaPublicar`: el
        servidor no lo exige para publicar la vacante.
      */}
      <EstadoDeLaPruebaTecnica vacanteId={vacante.id} />

      {/*
        Fuera de la rejilla de los tres desplegables, y no como un cuarto: una
        fecha con su motivo, sus dos acciones y lo que contesta el servidor no
        cabe en una celda hecha para un `select` de una linea. Y no lleva `key`
        ni se remonta al refrescar la vacante: las cifras de a quien alcanzo el
        cambio viven en su estado, y remontarlo las borraria justo despues de
        pulsar.
      */}
      {/*
        Dos casos en los que el control no se ofrece, comprobados llamando al
        backend y no leyendo el codigo:

        - **Vacante cerrada**: contesta 409 «Una vacante cerrada no se edita».
        - **Sin version de prueba elegida**: revienta con un 400 cuyo texto es
          «The given id must not be null» — el `findById(null)` de Spring Data
          saliendo a la cara de quien usa el panel, en ingles. Es un fallo del
          backend, pero ofrecer el control aqui seria ofrecer una averia.

        En los dos casos se dice por que en vez de esconderlo sin mas: un hueco
        callado en la pantalla que ordena la prueba se lee como que falta una
        pieza del panel.
      */}
      {vacante.estado === 'CERRADA' ? (
        <p className={estilos.ayudaAjuste}>
          La vacante está cerrada, así que su prueba ya no admite una fecha nueva.
        </p>
      ) : vacante.versionPlantillaPruebaId === null ? (
        <p className={estilos.ayudaAjuste}>
          Para fijar cuándo cierra la prueba hay que elegir antes cuál es: la fecha
          se calcula sobre la versión de la plantilla.
        </p>
      ) : (
        <CierreDeLaVacante vacanteId={vacante.id} alGuardar={refrescar} />
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

/**
 * Cuánto tiempo tiene el candidato en la etapa técnica.
 *
 * ⚠️ **Con un botón, no al escribir.** Cada tecla en un campo numérico es un valor
 * distinto —`4`, `45`, `450`— y guardar al vuelo mandaría los tres; peor aún, el servidor
 * frena el cambio cuando alguien ya empezó, así que cada tecla sería un 409 en la cara de
 * quien escribe.
 *
 * Vacío es un valor: significa «el que traiga el instrumento elegido», y es lo que tienen
 * todas las vacantes que existían antes de esto.
 *
 * ⚠️ **El suelo son cinco minutos, no uno.** Este número manda sobre el reloj del
 * instrumento —hasta convierte una prueba de plazo abierto en cronometrada—, así que un uno
 * es una prueba que el servidor entrega sola sesenta segundos después de que el candidato la
 * abra. El mismo suelo lo valida el backend, y aquí se dice antes de intentarlo.
 */
/** El suelo del reloj de la etapa técnica. El mismo que valida el backend. */
const MINIMO = 5

function MinutosDeLaEtapa({
  vacante,
  alGuardar,
  guardando,
}: {
  vacante: VacantePanel
  alGuardar: (datos: DatosDelInstrumento) => void
  guardando: boolean
}) {
  const guardados = vacante.minutosEtapaTecnica
  const [escrito, setEscrito] = useState(guardados === null ? '' : String(guardados))
  useEffect(() => {
    setEscrito(guardados === null ? '' : String(guardados))
  }, [guardados])

  const limpio = escrito.trim()
  const comoNumero = limpio === '' ? null : Number(limpio)
  const valido = comoNumero === null || (Number.isInteger(comoNumero) && comoNumero >= MINIMO)
  const cambio = comoNumero !== guardados

  return (
    <>
      <span className={estilos.filaMinutos}>
        <input
          className={estilos.eleccion}
          type="number"
          min={MINIMO}
          inputMode="numeric"
          value={escrito}
          placeholder="El del instrumento"
          onChange={(e) => setEscrito(e.target.value)}
          disabled={guardando}
        />
        {cambio && valido && (
          <button
            className={estilos.guardarMinutos}
            type="button"
            onClick={() =>
              alGuardar({
                instrumento: vacante.instrumentoEtapaTecnica,
                minutos: comoNumero,
              })
            }
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </span>
      {/*
        Tres frases y no una, porque el campo dice tres cosas distintas.

        La de en blanco ya estaba y sigue siendo cierta para los dos instrumentos. La del
        número escrito es nueva y es el arreglo: antes este campo no hacía nada con la prueba
        del puesto, y ahora manda sobre el reloj de la plantilla —incluso sobre una de plazo
        abierto, que pasa a contar minutos—. Quien lo escribe tiene que saberlo aquí, no
        descubrirlo por lo que le pase al candidato.
      */}
      <span className={estilos.ayudaAjuste}>
        {!valido
          ? `Los minutos son un número entero de ${MINIMO} o más, o se deja vacío.`
          : comoNumero === null
            ? 'En blanco, rige el tiempo que traiga el instrumento elegido. El reloj de cada candidato arranca cuando abre su prueba, no antes.'
            : 'Este tiempo manda sobre el que traiga el instrumento elegido. El reloj de cada candidato arranca cuando abre su prueba, no antes.'}
      </span>
    </>
  )
}
