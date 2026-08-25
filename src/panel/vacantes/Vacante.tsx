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
  verRanking,
  verVacante,
} from '../api/panel'
import type { FilaRanking, VacantePanel } from '../api/tipos'
import { rutas } from '@/rutas'
import { formatearFechaCorta, formatearFechaLarga } from '@/dominio/reloj'
import tabla from '../ui/Tabla.module.css'
import estilos from './Vacante.module.css'

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
  const ranking = useQuery({
    queryKey: ['panel-ranking', vacanteId],
    queryFn: () => verRanking(vacanteId),
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
        <h2 className={estilos.tituloSeccion}>El ranking de la tanda</h2>
        {ranking.isPending && <p className={estilos.cargando}>Calculando el ranking…</p>}
        {ranking.isError && (
          <p className={estilos.avisoMalo} role="alert">
            {ranking.error instanceof Error
              ? ranking.error.message
              : 'No se pudo cargar.'}
          </p>
        )}
        {ranking.data && (
          <Ranking
            filas={ranking.data.filas}
            resumen={`${ranking.data.total} en la tanda · ${ranking.data.calificados} calificados · ${ranking.data.enCurso} en curso · ${ranking.data.fallidos} con la calificación fallida`}
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

// ---------- El ranking, con seleccion y avance ----------

function Ranking({
  filas,
  resumen,
  alAvanzar,
}: {
  filas: FilaRanking[]
  resumen: string
  alAvanzar: () => Promise<void>
}) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [abierta, setAbierta] = useState<number | null>(null)
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
    for (const fila of filas.filter((f) => marcados.has(f.postulacionId))) {
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
      <p className={estilos.resumenTanda}>{resumen}</p>

      <div className={tabla.envoltura}>
        <table className={tabla.tabla}>
          <thead>
            <tr>
              <th aria-label="Avanza" />
              <th className={tabla.cifra}>#</th>
              <th>Candidato</th>
              <th className={tabla.cifra}>Nota de etapa</th>
              <th className={tabla.cifra}>Adecuación</th>
              <th className={tabla.cifra}>Potencial</th>
              <th className={tabla.cifra}>Alertas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
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
                  <td className={tabla.cifra}>{fila.notaEtapa ?? '—'}</td>
                  <td className={tabla.cifra}>{fila.adecuacion ?? '—'}</td>
                  <td className={tabla.cifra}>{fila.potencial ?? '—'}</td>
                  <td className={tabla.cifra}>
                    {fila.alertas + fila.riesgosCriticos > 0
                      ? fila.alertas + fila.riesgosCriticos
                      : '—'}
                  </td>
                  <td>{fila.estadoNombre}</td>
                </tr>
                {abierta === fila.postulacionId && (
                  <tr>
                    <td colSpan={8} className={estilos.celdaDetalle}>
                      <DetalleDelPostulante fila={fila} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className={tabla.vacia}>
                  Todavía no hay postulaciones en esta vacante.
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
          disabled={avanzando || marcados.size === 0 || motivo.trim() === ''}
        >
          {avanzando
            ? 'Avanzando…'
            : marcados.size === 0
              ? 'Marca a quienes avanzan'
              : `Avanzar a ${marcados.size} ${marcados.size === 1 ? 'persona' : 'personas'}`}
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

function DetalleDelPostulante({ fila }: { fila: FilaRanking }) {
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
  const perfil = useQuery({
    queryKey: ['panel-perfil', fila.postulacionId],
    queryFn: () => verPerfilIntegral(fila.postulacionId),
  })
  const historial = useQuery({
    queryKey: ['panel-historial', fila.postulacionId],
    queryFn: () => verHistorial(fila.postulacionId),
  })

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
        <h3 className={estilos.tituloDetalle}>Lo que calificó la IA</h3>
        {perfil.isPending && <p className={estilos.dato}>Cargando el retrato…</p>}
        {perfil.data && (
          <>
            {perfil.data.resumen ? (
              <p className={estilos.texto}>{perfil.data.resumen}</p>
            ) : (
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
                      <b>{h.tipo}</b> {h.texto}
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
      </div>
    </div>
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
  const versionesPrueba = useQuery({
    queryKey: ['panel-versiones-prueba'],
    queryFn: () => listarVersionesPrueba(),
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
                No hay ninguna publicada para este nivel. Se crean y publican aparte, o
                se apaga la evaluación del banco y basta con la prueba del puesto.
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

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}
