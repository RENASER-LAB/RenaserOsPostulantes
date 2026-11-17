import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  RUTA_DE_LA_ETAPA,
  descargarInforme,
  descargarInformesDeLaVacante,
  descargarInformesDelPostulante,
  guardarArchivo,
  verInforme,
  verInformesDelPostulante,
  verVisorDeLaVacante,
  type CelularDelVisor,
  type CodigoDeEtapa,
  type EstadoDeUnInforme,
  type EtapaDelInforme,
  type PostulanteDelVisor,
} from '@/panel/api/informes'
import { rutas } from '@/rutas'
import {
  IconoAnterior,
  IconoDeEnlace,
  IconoDescargar,
  IconoDocumento,
  IconoLapiz,
  IconoLupa,
  IconoReloj,
  IconoSiguiente,
  IconoTelefono,
  IconoWhatsapp,
} from '@/ui/Iconos'
import piezas from '@/estilos/piezas.module.css'
import { nombreDelGrupo, rotuloCortoDelGrupo } from '../ranking'
import estilosVacante from '../Vacante.module.css'
import { CuerpoDelInforme } from './CuerpoDelInforme'
import estilos from './Visor.module.css'

const ROTULO: Record<CodigoDeEtapa, string> = { CV: 'CV', EVALUACION: 'Evaluación', PRUEBA: 'Prueba' }
const ETAPA_DE_LA_RUTA: Record<EtapaDelInforme, CodigoDeEtapa> = {
  cv: 'CV',
  evaluacion: 'EVALUACION',
  prueba: 'PRUEBA',
}
/** La pestaña del ranking donde vive cada informe: «Abrir ficha» lleva ahí. */
const PESTANA_DE_LA_FICHA: Record<CodigoDeEtapa, string> = {
  CV: 'PERFIL_INTEGRAL',
  EVALUACION: 'PERFIL_INTEGRAL',
  PRUEBA: 'PRUEBA_PUESTO',
}

const redondear = (n: number | null) => (n == null ? '—' : String(Math.round(n)))

/**
 * El visor de informes de una vacante (paso 1b de la spec informe-pdf-por-etapa).
 *
 * A la izquierda, los postulantes —arriba quienes tienen las tres notas, ordenados por
 * su nota combinada; debajo los demás, en el orden del ranking—, con buscador, sus tres
 * notas y su grupo; a la derecha, el informe del elegido en sus tres pestañas. Se
 * pasa de uno a otro sin recargar la página, y quién y qué pestaña van en la
 * dirección para que la ficha pueda abrir aquí a una persona.
 *
 * **Solo lee.** Ajustar notas, calificar, mover o descartar siguen en la ficha:
 * «Abrir ficha» lleva a ella.
 */
export function VisorDeInformes() {
  const { id = '' } = useParams()
  const vacanteId = Number(id)
  const [query, setQuery] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [preparando, setPreparando] = useState(false)
  const [descargando, setDescargando] = useState<'PDF' | 'TRES' | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; fallo: boolean } | null>(null)

  const visor = useQuery({
    queryKey: ['panel-visor-informes', vacanteId],
    queryFn: () => verVisorDeLaVacante(vacanteId),
    enabled: Number.isFinite(vacanteId),
  })
  const postulantes = useMemo(() => visor.data?.postulantes ?? [], [visor.data])
  const pedido = Number(query.get('postulante'))
  const actual: PostulanteDelVisor | undefined =
    postulantes.find((p) => p.postulacionId === pedido) ?? postulantes[0]
  const indice = actual ? postulantes.indexOf(actual) : -1

  const estados = useQuery({
    queryKey: ['panel-informes', actual?.postulacionId],
    queryFn: () => verInformesDelPostulante(actual!.postulacionId),
    enabled: actual != null,
    refetchInterval: (consulta) =>
      consulta.state.data?.informes.some((i) => i.motivo === 'La IA está calificando') ? 15_000 : false,
  })
  const deLasEtapas: EstadoDeUnInforme[] = estados.data?.informes ?? []
  const rutaPedida = query.get('etapa') as EtapaDelInforme | null
  const etapaPedida = rutaPedida && ETAPA_DE_LA_RUTA[rutaPedida]
  const pestana: CodigoDeEtapa | undefined =
    deLasEtapas.find((e) => e.etapa === etapaPedida && e.disponible)?.etapa ??
    deLasEtapas.find((e) => e.disponible)?.etapa ??
    deLasEtapas[0]?.etapa
  const estadoDeLaPestana = deLasEtapas.find((e) => e.etapa === pestana)

  const informe = useQuery({
    queryKey: ['panel-informe', actual?.postulacionId, pestana],
    queryFn: () => verInforme(actual!.postulacionId, RUTA_DE_LA_ETAPA[pestana!]),
    enabled: actual != null && pestana != null && estadoDeLaPestana?.disponible === true,
    // Mientras el redactor escribe, se vuelve a pedir: los textos llegan sin recargar.
    refetchInterval: (consulta) => (consulta.state.data?.textosEnCamino ? 20_000 : false),
  })

  const filtrados = postulantes.filter((p) =>
    p.candidato.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')),
  )

  function elegir(postulacionId: number, etapa?: CodigoDeEtapa) {
    const siguiente = new URLSearchParams(query)
    siguiente.set('postulante', String(postulacionId))
    if (etapa) siguiente.set('etapa', RUTA_DE_LA_ETAPA[etapa])
    setQuery(siguiente, { replace: true })
    setAviso(null)
  }

  async function descargarPdf() {
    if (!actual || !pestana) return
    setDescargando('PDF')
    setAviso(null)
    try {
      guardarArchivo(await descargarInforme(actual.postulacionId, RUTA_DE_LA_ETAPA[pestana]), 'Informe.pdf')
    } catch (causa) {
      setAviso({ texto: causa instanceof Error ? causa.message : 'No pudimos preparar el PDF.', fallo: true })
    } finally {
      setDescargando(null)
    }
  }

  async function descargarSusTres() {
    if (!actual) return
    setDescargando('TRES')
    setAviso(null)
    try {
      guardarArchivo(await descargarInformesDelPostulante(actual.postulacionId), 'Informes.zip')
      const faltan = deLasEtapas.filter((e) => !e.disponible)
      setAviso({
        texto: faltan.length
          ? `Se descargaron sus informes. Falta ${faltan
              .map((e) => `${ROTULO[e.etapa]} (${(e.motivo ?? '').toLowerCase()})`)
              .join(', ')}.`
          : 'Se descargaron sus 3 informes.',
        fallo: false,
      })
    } catch (causa) {
      setAviso({ texto: causa instanceof Error ? causa.message : 'No pudimos preparar el .zip.', fallo: true })
    } finally {
      setDescargando(null)
    }
  }

  async function descargarLaVacante() {
    setPreparando(true)
    try {
      guardarArchivo(await descargarInformesDeLaVacante(vacanteId), 'Informes de la vacante.zip')
      setAviso({ texto: 'Listo: se descargaron los informes de toda la vacante.', fallo: false })
    } catch (causa) {
      setAviso({
        texto: causa instanceof Error ? causa.message : 'No pudimos preparar los informes de la vacante.',
        fallo: true,
      })
    } finally {
      setPreparando(false)
    }
  }

  if (visor.isPending) {
    return <div className={estilosVacante.pagina}>Cargando los informes…</div>
  }
  if (visor.isError) {
    return (
      <div className={estilosVacante.pagina}>
        <Link className={piezas.volver} to={rutas.adminVacante(vacanteId)}>
          ← Volver a la vacante
        </Link>
        <p role="alert">{visor.error instanceof Error ? visor.error.message : 'No pudimos abrir los informes.'}</p>
      </div>
    )
  }

  const anterior = indice > 0 ? postulantes[indice - 1] : undefined
  const siguiente = indice >= 0 && indice < postulantes.length - 1 ? postulantes[indice + 1] : undefined
  const posicion = indice >= 0 ? `${indice + 1} de ${postulantes.length}` : `0 de ${postulantes.length}`

  return (
    <div className={estilosVacante.pagina}>
      <Link className={piezas.volver} to={rutas.adminVacante(vacanteId)}>
        ← Volver a la vacante
      </Link>

      <header className={estilosVacante.cabecera}>
        <div>
          <p className={estilos.etiqueta}>Visor de informes</p>
          <h1>{visor.data.vacante ?? 'Vacante'}</h1>
          {visor.data.puesto && <p className={estilosVacante.datosVacante}>{visor.data.puesto}</p>}
        </div>
        <div className={estilos.cabeceraAcciones}>
          <button
            type="button"
            className={piezas.secundario}
            disabled={preparando || postulantes.length === 0}
            onClick={() => void descargarLaVacante()}
          >
            <IconoDescargar tamano={16} />
            &nbsp;{preparando ? 'Preparando…' : 'Descargar los de toda la vacante'}
          </button>
          <span className={estilos.cuantos}>
            {postulantes.length} {postulantes.length === 1 ? 'postulante' : 'postulantes'}, ordenados por nota combinada
          </span>
        </div>
      </header>

      {aviso && (
        <p role="status" className={aviso.fallo ? estilos.estadoFallo : estilos.estado}>
          {aviso.texto}
        </p>
      )}

      {postulantes.length === 0 ? (
        <p className={estilos.vacio}>Esta vacante todavía no tiene postulantes.</p>
      ) : (
        <div className={estilos.cuerpo}>
          <div className={estilos.barraMovil}>
            <button
              type="button"
              className={estilos.flecha}
              aria-label="Postulante anterior"
              disabled={!anterior}
              onClick={() => anterior && elegir(anterior.postulacionId)}
            >
              <IconoAnterior tamano={18} />
            </button>
            <select
              className={estilos.selector}
              aria-label="Elegir postulante"
              value={actual?.postulacionId ?? ''}
              onChange={(e) => elegir(Number(e.target.value))}
            >
              {postulantes.map((p, i) => (
                <option key={p.postulacionId} value={p.postulacionId}>
                  {i + 1} de {postulantes.length} · {p.candidato}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={estilos.flecha}
              aria-label="Postulante siguiente"
              disabled={!siguiente}
              onClick={() => siguiente && elegir(siguiente.postulacionId)}
            >
              <IconoSiguiente tamano={18} />
            </button>
          </div>

          <aside className={estilos.lista} aria-label="Postulantes de la vacante">
            <div className={estilos.listaCabeza}>
              <div className={estilos.entreDos}>
                <span className={estilos.etiqueta}>Postulantes</span>
                <span className={estilos.meta}>{postulantes.length}</span>
              </div>
              <label className={estilos.buscador}>
                <IconoLupa tamano={16} />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre"
                  aria-label="Buscar postulante"
                />
              </label>
              <div className={estilos.columnas} aria-hidden="true">
                <span>#</span>
                <span>Nombre</span>
                <span className={estilos.numero}>CV</span>
                <span className={estilos.numero}>Eva</span>
                <span className={estilos.numero}>Pru</span>
              </div>
            </div>
            <div>
              {filtrados.map((p) => (
                <button
                  key={p.postulacionId}
                  type="button"
                  className={p === actual ? estilos.filaActual : estilos.fila}
                  aria-current={p === actual ? 'true' : undefined}
                  onClick={() => elegir(p.postulacionId)}
                >
                  <span className={estilos.puesto}>{p.puesto}</span>
                  <span className={estilos.nombreFila}>
                    <span style={{ fontWeight: p === actual ? 550 : 400 }}>{p.candidato}</span>
                    {p.grupo && (
                      <span className={estilosVacante.grupo} title={nombreDelGrupo(p.grupo) ?? undefined}>
                        {rotuloCortoDelGrupo(p.grupo)}
                      </span>
                    )}
                  </span>
                  <span className={estilos.numero} aria-label={`CV ${redondear(p.notaCv)}`}>
                    {redondear(p.notaCv)}
                  </span>
                  <span className={estilos.numero} aria-label={`Evaluación ${redondear(p.notaEvaluacion)}`}>
                    {redondear(p.notaEvaluacion)}
                  </span>
                  <span className={estilos.numero} aria-label={`Prueba ${redondear(p.notaPrueba)}`}>
                    {redondear(p.notaPrueba)}
                  </span>
                </button>
              ))}
              {filtrados.length === 0 && (
                <div className={estilos.ninguno}>Ningún postulante se llama «{busqueda}».</div>
              )}
            </div>
          </aside>

          <div className={estilos.principal}>
            {actual && (
              <section className={estilos.tarjeta} aria-label="Postulante">
                <div className={`${estilos.entreDos} ${estilos.ocultaEnMovil}`}>
                  <span className={estilos.etiqueta}>
                    Puesto {actual.puesto} de {postulantes.length}
                  </span>
                  <div className={estilos.navegar}>
                    <button
                      type="button"
                      className={piezas.secundario}
                      disabled={!anterior}
                      onClick={() => anterior && elegir(anterior.postulacionId)}
                    >
                      ← Anterior
                    </button>
                    <span className={estilos.posicion}>{posicion}</span>
                    <button
                      type="button"
                      className={piezas.secundario}
                      disabled={!siguiente}
                      onClick={() => siguiente && elegir(siguiente.postulacionId)}
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>

                <div className={estilos.quien}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 className={estilos.nombre}>{actual.candidato}</h2>
                      {actual.grupo && (
                        <span className={estilosVacante.grupo}>{nombreDelGrupo(actual.grupo)}</span>
                      )}
                    </div>
                    <div className={estilos.enlaces}>
                      {visor.data.vacante && <span>{visor.data.vacante}</span>}
                      {/* Currículum, luego el celular y después las redes. */}
                      {(informe.data?.enlaces ?? [])
                        .filter((e) => e.tipo === 'CV')
                        .map((e) => (
                          <a key={e.url} href={e.url} target="_blank" rel="noreferrer">
                            <IconoDocumento tamano={16} />
                            Currículum
                          </a>
                        ))}
                      {actual.celular && <Celular celular={actual.celular} />}
                      {(informe.data?.enlaces ?? [])
                        .filter((e) => e.tipo !== 'CV')
                        .map((e) => (
                          <a key={e.url} href={e.url} target="_blank" rel="noreferrer">
                            <IconoDeEnlace tipo={e.tipo} tamano={16} />
                            {e.rotulo}
                          </a>
                        ))}
                      {pestana && (
                        <Link
                          className={estilos.abrirFichaMovil}
                          to={rutas.adminFichaEnLaVacante(vacanteId, actual.postulacionId, PESTANA_DE_LA_FICHA[pestana])}
                        >
                          ✎ Abrir ficha
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className={estilos.acciones}>
                    {pestana && (
                      <Link
                        className={`${piezas.secundario} ${estilos.ocultaEnMovil}`}
                        aria-label="Abrir la ficha para ajustar notas, mover de etapa o descartar"
                        to={rutas.adminFichaEnLaVacante(vacanteId, actual.postulacionId, PESTANA_DE_LA_FICHA[pestana])}
                      >
                        <IconoLapiz tamano={16} />
                        &nbsp;Abrir ficha
                      </Link>
                    )}
                    <button
                      type="button"
                      className={piezas.acentoMenor}
                      disabled={!estadoDeLaPestana?.disponible || descargando !== null}
                      onClick={() => void descargarPdf()}
                    >
                      <IconoDescargar tamano={16} />
                      &nbsp;{descargando === 'PDF' ? 'Generando…' : 'Descargar PDF'}
                    </button>
                    <button
                      type="button"
                      className={piezas.secundario}
                      disabled={!deLasEtapas.some((e) => e.disponible) || descargando !== null}
                      onClick={() => void descargarSusTres()}
                    >
                      {descargando === 'TRES' ? 'Preparando…' : 'Descargar sus 3 informes'}
                    </button>
                  </div>
                </div>

                <div role="tablist" aria-label="Informe" className={estilos.pestanasInforme}>
                  {deLasEtapas.map((e) => {
                    const activa = e.etapa === pestana
                    const clase = !e.disponible ? estilos.pestanaApagada : activa ? estilos.pestanaActiva : estilos.pestana
                    return (
                      <button
                        key={e.etapa}
                        type="button"
                        role="tab"
                        aria-selected={activa}
                        aria-disabled={!e.disponible}
                        title={e.disponible ? undefined : (e.motivo ?? undefined)}
                        className={clase}
                        onClick={() => e.disponible && elegir(actual.postulacionId, e.etapa)}
                      >
                        <span>{ROTULO[e.etapa]}</span>
                        <span className={estilos.notaPestana}>{e.disponible ? redondear(e.nota) : ''}</span>
                        {!e.disponible && <IconoReloj tamano={14} />}
                      </button>
                    )
                  })}
                </div>
                {deLasEtapas
                  .filter((e) => !e.disponible)
                  .map((e) => (
                    <span key={e.etapa} className={estilos.porQue}>
                      {ROTULO[e.etapa]}: {e.motivo}
                    </span>
                  ))}
              </section>
            )}

            {estados.isError && (
              <p role="alert" className={estilos.estadoFallo}>
                {estados.error instanceof Error ? estados.error.message : 'No pudimos leer sus informes.'}
              </p>
            )}
            {informe.isPending && estadoDeLaPestana?.disponible && <p className={estilos.meta}>Armando el informe…</p>}
            {informe.isError && (
              <p role="alert" className={estilos.estadoFallo}>
                {informe.error instanceof Error ? informe.error.message : 'No pudimos armar el informe.'}
              </p>
            )}
            {informe.data && estadoDeLaPestana?.disponible && <CuerpoDelInforme informe={informe.data} />}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * El celular del candidato, en la fila de enlaces de la cabecera: «☎ 987 654 321» para
 * llamar y, si es un celular peruano, «WhatsApp» para abrir la conversación en otra pestaña.
 * Lo arma el backend (el de su cuenta o, si no tiene, el del CV); aquí solo se pinta, y solo
 * si los enlaces son los que se esperan.
 */
function Celular({ celular }: { celular: CelularDelVisor }) {
  const llamar = celular.llamar.startsWith('tel:') ? celular.llamar : null
  const whatsapp = celular.whatsapp?.startsWith('https://wa.me/') ? celular.whatsapp : null
  return (
    <>
      {llamar ? (
        <a href={llamar} aria-label={`Llamar al ${celular.texto}`}>
          <IconoTelefono tamano={16} />
          {celular.texto}
        </a>
      ) : (
        <span>
          <IconoTelefono tamano={16} /> {celular.texto}
        </span>
      )}
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Escribir por WhatsApp al ${celular.texto}`}>
          <IconoWhatsapp tamano={16} />
          WhatsApp
        </a>
      )}
    </>
  )
}
