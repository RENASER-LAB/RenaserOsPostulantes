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

import { Fragment, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aplicarEvaluacion,
  asignarPlantillaEvaluacion,
  asignarPlantillaPrueba,
  asignarVersionPesos,
  cerrarVacante,
  confirmarAvance,
  crearRequisito,
  listarPlantillasEvaluacion,
  listarPlantillasPrueba,
  listarPuestos,
  listarRequisitos,
  listarVersionesPesos,
  listarVersionesPrueba,
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
import {
  ETAPAS_PANEL,
  cifrasDeLaEtapa,
  esDelCurriculum,
  filtrar,
  laEtapaDe,
  porQueNoHayNota,
  recuentos,
  type EtapaPanel,
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

  // El backend rechaza publicar sin esto, asi que el boton lo dice antes de
  // pulsarlo en vez de fallar despues.
  const leFalta = [
    v.aplicaEvaluacion && v.plantillaEvaluacionId === null ? 'la evaluación' : null,
    v.versionPlantillaPruebaId === null ? 'la prueba del puesto' : null,
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

function Ranking({
  etapa,
  filas,
  cabeceraDelCv,
  vista,
  alCambiarVista,
  alAvanzar,
}: {
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

  const laEtapa = laEtapaDe(etapa)
  const visibles = filtrar(filas, etapa, vista)
  const cuantas = recuentos(filas, etapa)
  const cifras = cifrasDeLaEtapa(filas, etapa)
  /*
    Adecuacion y potencial son dimensiones del retrato que sale del curriculum,
    no de la prueba ni de la simulacion. Enseñarlas en las cinco pestañas hacia
    que la mesa de la prueba mostrara dos numeros del CV junto a uno de la
    prueba, y los tres con la misma pinta: la lista parecia hablar del CV
    estando en otra etapa. Donde significan algo se quedan; donde no, se van.
  */
  const delCurriculum = esDelCurriculum(etapa)
  const columnas = delCurriculum ? 8 : 6
  // Solo cuentan las marcas que se VEN: si el filtro oculta una fila marcada,
  // el boton no puede seguir diciendo que avanzara a esa persona.
  const marcadosVisibles = visibles.filter((f) => marcados.has(f.postulacionId))
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [avanzando, setAvanzando] = useState(false)

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

  return (
    <>
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
        <div className={estilos.vistas} role="group" aria-label="Qué filas se ven">
          {(
            [
              ['con-nota', `Con ${laEtapa.nota.toLowerCase()}`],
              ['aqui-ahora', 'Está aquí ahora'],
              ['toda', 'Toda la tanda'],
            ] as const
          ).map(([cual, texto]) => (
            <button
              key={cual}
              className={vista === cual ? estilos.vistaActiva : estilos.vista}
              type="button"
              aria-pressed={vista === cual}
              onClick={() => alCambiarVista(cual)}
            >
              {texto}
              <span className={estilos.cuantasEnLaVista}>{cuantas[cual]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={tabla.envoltura}>
        <table className={tabla.tabla}>
          <thead>
            <tr>
              <th aria-label="Avanza" />
              <th className={tabla.cifra}>#</th>
              <th>Candidato</th>
              {/*
                La nota se llama por su etapa y no «Nota de etapa» a secas.
                Cinco pestanas con la misma cabecera obligan a recordar en cual
                estas para saber que numero estas leyendo, y la que se recuerda
                mal siempre es la primera.
              */}
              <th className={tabla.cifra}>{laEtapa.nota}</th>
              {/*
                ⚠️ Las del retrato salen del `PerfilTalento`, que se arma UNA
                vez con el currículum y no se recalcula por etapa. En la pestaña
                de la prueba serían cifras del CV con la misma pinta que la de
                la prueba.

                ⚠️ **Solo dos, y no las cuatro.** Con «Alto rendimiento» y
                «Confianza en la evidencia» la tabla medía 1314 px dentro de una
                envoltura de 1038 —medido a 1920— y la columna de Estado, que
                dice dónde está la persona, quedaba fuera del scroll. Las otras
                dos viven en la ficha, que es donde además cabe decir qué miden:
                un «79» bajo una cabecera de dos palabras no justifica nada.
              */}
              {delCurriculum && (
                <>
                  <th className={tabla.cifra}>Adecuación</th>
                  <th className={tabla.cifra}>Potencial</th>
                </>
              )}
              {/*
                ⚠️ Antes eran una sola cifra sumada, y son dos tablas
                distintas: un riesgo crítico lo escribió el agente sobre el
                perfil y una alerta la levantó el proceso. Sumarlas daba un «3»
                que no se podía ir a mirar a ningún sitio.
              */}
              <th className={tabla.cifra}>Riesgos</th>
              <th className={tabla.cifra}>Alertas</th>
              <th>Estado</th>
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
                    Dos vacios distintos, y confundirlos manda a buscar en el
                    sitio equivocado. Sin nadie en la etapa es lo NORMAL en
                    Validación y Decisión casi siempre: se dice sin alarma y se
                    nombra el escape con las palabras que lleva escritas.

                    En un <p>, y no suelto: la celda mide lo que miden las
                    columnas, y en un teléfono la frase acababa a la derecha del
                    scroll. Ver `.vacia` en `Tabla.module.css`.
                  */}
                  <p>
                    {filas.length === 0
                      ? 'Todavía no hay postulaciones en esta vacante.'
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

          <h4 className={estilos.subtitulo}>Criterio a criterio</h4>
          <ul className={estilos.criterios} role="list">
            {perfil.data.notasCriterio.map((n) => (
              <li className={estilos.criterio} key={n.criterio}>
                <span className={estilos.notaCriterio}>
                  {n.puntaje !== null
                    ? `${n.puntaje}${n.maximo ? `/${n.maximo}` : ''}`
                    : '—'}
                </span>
                <span>
                  <b>{n.criterio}</b> · peso {n.peso}
                  {n.explicacion && (
                    <span className={estilos.explicacion}>{n.explicacion}</span>
                  )}
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
 * La configuracion de la vacante: que evaluacion, que prueba y que pesos.
 *
 * Existe porque **sin esto no se puede publicar**: el backend exige la
 * plantilla de evaluacion —si la evaluacion del banco esta encendida— y la
 * version de la prueba, y rechaza la publicacion con un mensaje que, sin esta
 * pantalla, no tenia donde resolverse.
 *
 * La plantilla de evaluacion se filtra por el nivel del puesto: el backend
 * rechaza las de otro nivel, y ofrecerlas seria dejar elegir algo que va a
 * fallar.
 */
function ConfiguracionDeLaVacante({ vacante }: { vacante: VacantePanel }) {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)

  const puestos = useQuery({
    queryKey: ['panel-puestos'],
    queryFn: listarPuestos,
  })
  const plantillasEva = useQuery({
    queryKey: ['panel-plantillas-eva'],
    queryFn: listarPlantillasEvaluacion,
  })
  const plantillasPrueba = useQuery({
    queryKey: ['panel-plantillas-prueba'],
    queryFn: listarPlantillasPrueba,
  })
  /*
    La version que ya tiene la vacante entra como pista del rastreo: los ids son
    una secuencia de toda la plataforma, y saber que existe el 47 dice donde
    buscar los suyos. Sin ella el rastreo empieza en el 1 y en una base con las
    pruebas altas no encuentra ninguna — el desplegable vacio.
  */
  const versionesPrueba = useQuery({
    queryKey: ['panel-versiones-prueba', vacante.versionPlantillaPruebaId],
    queryFn: () =>
      listarVersionesPrueba(
        vacante.versionPlantillaPruebaId === null
          ? []
          : [vacante.versionPlantillaPruebaId],
      ),
  })
  const pesos = useQuery({
    queryKey: ['panel-pesos'],
    queryFn: listarVersionesPesos,
  })

  const refrescar = () =>
    cache.invalidateQueries({ queryKey: ['panel-vacante', vacante.id] })
  const alFallar = (c: unknown) =>
    setFallo(c instanceof Error ? c.message : 'No se pudo guardar.')

  const evaluacion = useMutation({
    mutationFn: (id: number) => asignarPlantillaEvaluacion(vacante.id, id),
    onSuccess: refrescar,
    onError: alFallar,
  })
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
  const version = useMutation({
    mutationFn: (id: number) => asignarVersionPesos(vacante.id, id),
    onSuccess: refrescar,
    onError: alFallar,
  })

  const nivel = puestos.data?.find((p) => p.id === vacante.puestoId)?.nivelPuestoCodigo
  const evaluacionesDelNivel = (plantillasEva.data ?? []).filter(
    (p) => p.estado === 'PUBLICADA' && (!nivel || p.nivelPuestoCodigo === nivel),
  )

  const nombreDePlantillaPrueba = (plantillaPruebaId: number) =>
    plantillasPrueba.data?.find((p) => p.id === plantillaPruebaId)?.nombre ??
    `Plantilla ${plantillaPruebaId}`

  const listaParaPublicar =
    (!vacante.aplicaEvaluacion || vacante.plantillaEvaluacionId !== null) &&
    vacante.versionPlantillaPruebaId !== null

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

        {vacante.aplicaEvaluacion && (
          <label className={estilos.ajuste}>
            <span className={estilos.etiquetaAjuste}>
              Qué evaluación responderá{nivel ? ` · nivel ${nivel}` : ''}
            </span>
            <select
              className={estilos.eleccion}
              value={vacante.plantillaEvaluacionId ?? ''}
              onChange={(e) => evaluacion.mutate(Number(e.target.value))}
              disabled={evaluacion.isPending}
            >
              <option value="">Elige la evaluación…</option>
              {evaluacionesDelNivel.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.nombre} · {p.minutosObjetivo} min
                </option>
              ))}
            </select>
            {evaluacionesDelNivel.length === 0 && (
              <span className={estilos.pista}>
                No hay ninguna publicada para este nivel. Se crean y publican aparte, o se
                apaga la evaluación del banco y basta con la prueba del puesto.
              </span>
            )}
          </label>
        )}

        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Qué prueba del puesto rendirá</span>
          <select
            className={estilos.eleccion}
            value={vacante.versionPlantillaPruebaId ?? ''}
            onChange={(e) => prueba.mutate(Number(e.target.value))}
            disabled={prueba.isPending || versionesPrueba.isPending}
          >
            <option value="">
              {versionesPrueba.isPending ? 'Buscando las pruebas…' : 'Elige la prueba…'}
            </option>
            {(versionesPrueba.data ?? []).map((v) => (
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
          {!versionesPrueba.isPending && (versionesPrueba.data ?? []).length === 0 && (
            <span className={estilos.ayudaAjuste} role="status">
              {(plantillasPrueba.data ?? []).length === 0
                ? 'No hay ninguna plantilla de prueba escrita todavía. Se crean en el módulo de pruebas, y sin una la vacante no se puede publicar.'
                : `Hay ${(plantillasPrueba.data ?? []).length} plantilla(s) de prueba, pero ninguna con una versión que se pueda usar aquí. Falta crear y publicar una versión.`}
            </span>
          )}
        </label>

        <label className={estilos.ajuste}>
          <span className={estilos.etiquetaAjuste}>Qué pesos rigen la decisión</span>
          <select
            className={estilos.eleccion}
            value={vacante.versionPesosId ?? ''}
            onChange={(e) => version.mutate(Number(e.target.value))}
            disabled={version.isPending}
          >
            <option value="">Los pesos generales</option>
            {(pesos.data ?? [])
              .filter((p) => p.estado === 'PUBLICADA')
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.etiqueta}
                </option>
              ))}
          </select>
        </label>
      </div>

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
