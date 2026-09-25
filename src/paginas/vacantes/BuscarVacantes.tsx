/**
 * Buscar vacantes: escribir lo que se busca, acotar con lo que los datos permiten
 * acotar, elegir el orden y ver cuántas quedan.
 *
 * Se ve sin cuenta y con cuenta se ve igual. Todo pasa en el navegador sobre la
 * lista que ya trajo `GET /vacantes`; la lógica vive en `./busqueda` y aquí solo
 * se pinta y se decide qué se enseña en cada estado.
 *
 * ## La dirección guarda la búsqueda, y sin llenar el historial
 *
 * `/vacantes?q=analista&ciudad=1501&publicada=7d&orden=recientes` se puede
 * compartir y quien la reciba ve lo mismo. Cada letra, cada casilla y cada cambio
 * de orden escriben la dirección con `replace`: pulsar atrás sale de `/vacantes`
 * hacia donde se estaba, no deshace una letra. En la app, el botón atrás del
 * teléfono recorre el mismo historial.
 *
 * ⚠️ **El texto del buscador vive en estado local y se copia a la dirección, no
 * al revés.** React Router navega dentro de una transición, y un `<input>`
 * controlado por un valor que llega con retraso pierde letras al teclear rápido.
 * Los filtros y el orden sí se leen de la dirección: cambian de golpe, no letra
 * a letra.
 *
 * ## Volver de una ficha deja la lista como estaba
 *
 * Al abrir una tarjeta se apunta qué tarjeta y en qué entrada del historial
 * (`location.key`). Al volver —con atrás o con «← Volver a las vacantes»— la
 * lista se monta con la misma dirección, y cuando los datos están, se desplaza
 * hasta esa tarjeta. Si la lista se abre de nuevo desde la navegación, la
 * entrada es otra y no se desplaza nada.
 *
 * ## La disposición (ciclo 2, 25/09/2026)
 *
 * En escritorio, la fila del contador con «Ordenar por» a todo el ancho; debajo,
 * una columna de filtros a la izquierda —los grupos Publicada, Ciudad, Modalidad
 * y Empresa, que se pliegan— y a la derecha la de resultados: las etiquetas
 * activas y «Quitar filtros» encima de las tarjetas a lo ancho, una por fila.
 * En el teléfono, una columna: los filtros plegados tras «Filtrar (n)» y las
 * etiquetas siempre a la vista, encima de la lista.
 *
 * ⚠️ **Lo que se ve y lo que recorre Tab van en el mismo orden, y eso decide
 * dónde va cada cosa.** El punto 38 manda buscador → orden → filtros →
 * etiquetas → resultados. Por eso la fila del orden cruza las dos columnas —si
 * fuera solo de la de resultados, Tab iría de su esquina a la columna de
 * filtros y volvería a subir a la de resultados— y las etiquetas no viven en la
 * columna de filtros: ahí se pintaban encima de los grupos, Tab bajaba por los
 * grupos y volvía a subir, y la primera casilla marcada empujaba los grupos
 * 69 px bajo el puntero (decisión del usuario del 25/09/2026). Ahora se lee
 * fila, columna de filtros, columna de resultados, y marcar una casilla solo
 * mueve la lista. En una sola columna el orden es el mismo sin tocar nada.
 *
 * ## Lo que se anuncia
 *
 * El contador se lee en voz alta cuando la persona deja de escribir —medio
 * segundo— y no con cada letra; cambiar el orden anuncia por qué se ordena.
 * Filtrar y ordenar nunca mueven el foco; quitar una etiqueta lo pasa a la
 * siguiente o, si era la última, al buscador.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { catalogoUbigeo, listarVacantes } from '@/api/portal'
import { ahora as ahoraDelServidor } from '@/dominio/reloj'
import { IconoCruz, IconoDesplegar } from '@/ui/Iconos'
import { Tarjeta } from './Tarjeta'
import {
  contador,
  detalleDelContador,
  escribirEstado,
  etiquetas as etiquetasDe,
  grupos as gruposDe,
  hayFiltros,
  indexar,
  leerEstado,
  opcionesDeFecha,
  publicadaHace,
  resultados,
  SIN_FILTROS,
  sinEtiqueta,
  vacantesEnPlural,
  type Estado,
  type Etiqueta,
  type Filtros,
  type Orden,
  type Ventana,
} from './busqueda'
import estilos from './BuscarVacantes.module.css'

/** Dónde se apunta la tarjeta abierta, para volver a ella. */
const CLAVE_DE_VUELTA = 'vacantes:vuelta'

/** Cuánto se espera desde la última letra antes de anunciar el contador. */
const ESPERA_DEL_ANUNCIO = 500

const NOMBRE_DEL_ORDEN: Record<Orden, string> = {
  relevantes: 'Ordenadas por relevancia',
  recientes: 'Ordenadas por más recientes',
}

export function BuscarVacantes() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const desdeLaDireccion = useMemo(() => leerEstado(params), [params])
  const [q, setQ] = useState(desdeLaDireccion.q)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  /** Los grupos que la persona plegó. Empiezan todos abiertos: con cuatro grupos, abiertos llenan. */
  const [plegados, setPlegados] = useState<ReadonlySet<string>>(() => new Set())
  const [anuncio, setAnuncio] = useState('')
  const buscador = useRef<HTMLInputElement>(null)
  const botonesDeEtiqueta = useRef<(HTMLButtonElement | null)[]>([])
  /** Qué etiqueta recibe el foco después de quitar una, o `null`. */
  const focoPendiente = useRef<number | null>(null)

  const consulta = useQuery({ queryKey: ['vacantes'], queryFn: listarVacantes })
  const vacantes = useMemo(
    () => (Array.isArray(consulta.data) ? consulta.data : []),
    [consulta.data],
  )
  const indice = useMemo(() => indexar(vacantes), [vacantes])
  // La hora del servidor, tomada cuando llegan los datos y no en cada render:
  // las ventanas de fecha y el «hace N días» no se recalculan solos.
  const ahora = useMemo(() => ahoraDelServidor(), [consulta.dataUpdatedAt])

  const estado: Estado = useMemo(
    () => ({
      q,
      filtros: desdeLaDireccion.filtros,
      orden: desdeLaDireccion.orden,
    }),
    [q, desdeLaDireccion.filtros, desdeLaDireccion.orden],
  )

  /*
    El catálogo entero solo si la dirección trae una ciudad que ninguna vacante
    tiene: hace falta para ponerle nombre a la etiqueta («Cusco ✕») y para
    descartar el código que no sea del catálogo. Con las ciudades que sí están en
    la lista no se pide nada.
  */
  const codigosDesconocidos = useMemo(
    () =>
      estado.filtros.ciudades.filter(
        (c) => c !== 'sin-indicar' && !indice.some((v) => v.ciudad === c),
      ),
    [estado.filtros.ciudades, indice],
  )
  const catalogo = useQuery({
    queryKey: ['catalogo-ubigeo'],
    queryFn: catalogoUbigeo,
    enabled: codigosDesconocidos.length > 0,
  })
  const nombresDelCatalogo = useMemo(
    () => new Map((Array.isArray(catalogo.data) ? catalogo.data : []).map((o) => [o.codigo, o.nombre])),
    [catalogo.data],
  )
  /*
    Mientras el catálogo no llega, de un código que ninguna vacante tiene no se
    sabe si es Cusco o basura: la lista se queda en su esqueleto y la etiqueta
    no se pinta, en vez de decir «9999 ✕ · ninguna coincide» un instante y
    retractarse. Si el catálogo falla, se sigue con el código tal cual.
  */
  const esperandoCatalogo = codigosDesconocidos.length > 0 && catalogo.isPending

  /*
    ⚠️ **Lo escrito a la dirección tarda un instante en verse.** React Router
    la escribe dentro de una transición, así que tras un clic `params` —y con
    él `estado`— sigue siendo el de antes hasta que esa transición se pinta. Un
    doble clic sobre una casilla son dos clics en el mismo instante: los dos
    leían el mismo estado y la marcaban dos veces en vez de dejarla como
    estaba; y marcar dos casillas seguidas perdía la primera. Por eso todo lo
    que escribe parte de `vigente()`: lo último escrito mientras el router no
    lo alcanza, y lo pintado en cuanto lo alcanza. Si la dirección cambia a
    otra cosa —atrás, un enlace—, manda la dirección y lo que había en vuelo se
    olvida.
  */
  const enVuelo = useRef<Array<{ direccion: string; estado: Estado }>>([])

  useEffect(() => {
    const direccion = params.toString()
    const alcanzada = enVuelo.current.findIndex((e) => e.direccion === direccion)
    enVuelo.current = alcanzada === -1 ? [] : enVuelo.current.slice(alcanzada + 1)
  }, [params])

  function vigente(): Estado {
    return enVuelo.current[enVuelo.current.length - 1]?.estado ?? estado
  }

  function escribir(siguiente: Estado) {
    const direccion = escribirEstado(siguiente)
    enVuelo.current.push({ direccion: direccion.toString(), estado: siguiente })
    setParams(direccion, { replace: true })
  }

  function cambiarQ(texto: string) {
    setQ(texto)
    escribir({ ...vigente(), q: texto })
  }

  function cambiarFiltros(filtros: Filtros) {
    escribir({ ...vigente(), filtros })
  }

  function cambiarOrden(orden: Orden) {
    escribir({ ...vigente(), orden })
    setAnuncio(NOMBRE_DEL_ORDEN[orden])
  }

  function alternar(grupo: 'ciudades' | 'modalidades' | 'empresas', valor: string) {
    const filtros = vigente().filtros
    const actuales = filtros[grupo]
    const siguientes = actuales.includes(valor)
      ? actuales.filter((v) => v !== valor)
      : [...actuales, valor]
    cambiarFiltros({ ...filtros, [grupo]: siguientes })
  }

  function quitarEtiqueta(etiqueta: Etiqueta, indice: number) {
    focoPendiente.current = indice
    escribir(sinEtiqueta(vigente(), etiqueta))
  }

  function quitarFiltros() {
    focoPendiente.current = 0
    cambiarFiltros(SIN_FILTROS)
  }

  /* Quita la búsqueda y los filtros; el orden elegido se queda, que sin texto también ordena. */
  function verTodas() {
    setQ('')
    escribir({ ...vigente(), q: '', filtros: SIN_FILTROS })
    buscador.current?.focus()
  }

  function plegar(clave: string) {
    setPlegados((antes) => {
      const despues = new Set(antes)
      if (despues.has(clave)) despues.delete(clave)
      else despues.add(clave)
      return despues
    })
  }

  /*
    Un código que no es ciudad del catálogo se ignora: en cuanto el catálogo
    llega, se quita de la dirección sin decir nada. Los que sí lo son se quedan
    aunque hoy no tengan vacantes.
  */
  useEffect(() => {
    if (!catalogo.data || codigosDesconocidos.length === 0) return
    const invalidos = codigosDesconocidos.filter((c) => !nombresDelCatalogo.has(c))
    if (invalidos.length === 0) return
    const actual = vigente()
    escribir({
      ...actual,
      filtros: {
        ...actual.filtros,
        ciudades: actual.filtros.ciudades.filter((c) => !invalidos.includes(c)),
      },
    })
    // Solo cuando llega el catálogo: lo demás ya está en `estado`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo.data])

  const total = indice.length
  const lista = useMemo(() => resultados(indice, estado, ahora), [indice, estado, ahora])
  const grupos = useMemo(() => gruposDe(indice, estado, ahora), [indice, estado, ahora])
  const fechas = useMemo(() => opcionesDeFecha(indice, estado, ahora), [indice, estado, ahora])
  const activas = useMemo(
    () =>
      etiquetasDe(estado, indice, nombresDelCatalogo).filter(
        (e) => !(esperandoCatalogo && e.grupo === 'ciudades' && codigosDesconocidos.includes(e.valor)),
      ),
    [estado, indice, nombresDelCatalogo, esperandoCatalogo, codigosDesconocidos],
  )
  const cargando = consulta.isPending || esperandoCatalogo
  const fallo = consulta.isError && consulta.data === undefined
  const sinVacantes = !cargando && !fallo && total === 0
  const ninguna = !cargando && !fallo && total > 0 && lista.length === 0
  const textoDelContador = contador(lista.length, total, estado, activas)
  const detalle = ninguna ? '' : detalleDelContador(estado, activas)
  // Los filtros, con lo que se sabe: mientras carga, un (0) en cada opción mentiría.
  const hayQueAcotar = !cargando && total > 0

  // El contador, anunciado cuando se deja de escribir y no con cada letra.
  useEffect(() => {
    if (cargando || fallo || sinVacantes) return
    const espera = window.setTimeout(() => setAnuncio(textoDelContador), ESPERA_DEL_ANUNCIO)
    return () => window.clearTimeout(espera)
  }, [textoDelContador, cargando, fallo, sinVacantes])

  // El foco tras quitar una etiqueta: la siguiente o, si no hay, el buscador.
  useEffect(() => {
    const indice = focoPendiente.current
    if (indice === null) return
    focoPendiente.current = null
    const siguiente = botonesDeEtiqueta.current[indice] ?? null
    if (siguiente) siguiente.focus()
    else buscador.current?.focus()
  }, [activas])

  // Al volver de una ficha, hasta la tarjeta que se abrió.
  useEffect(() => {
    if (cargando || fallo) return
    const crudo = sessionStorage.getItem(CLAVE_DE_VUELTA)
    if (!crudo) return
    let vuelta: { id: number; key: string }
    try {
      vuelta = JSON.parse(crudo) as { id: number; key: string }
    } catch {
      sessionStorage.removeItem(CLAVE_DE_VUELTA)
      return
    }
    if (vuelta.key !== location.key) return
    sessionStorage.removeItem(CLAVE_DE_VUELTA)
    const cuadro = requestAnimationFrame(() => {
      const nodo = document.getElementById(`vacante-${vuelta.id}`)
      if (!nodo) return
      const cabecera =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-cabecera')) || 70
      window.scrollTo({ top: nodo.getBoundingClientRect().top + window.scrollY - cabecera - 16 })
    })
    return () => cancelAnimationFrame(cuadro)
  }, [cargando, fallo, location.key])

  function recordar(id: number) {
    sessionStorage.setItem(CLAVE_DE_VUELTA, JSON.stringify({ id, key: location.key }))
  }

  /* La tecla «Buscar» del teclado del teléfono cierra el teclado; no recarga ni navega. */
  function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    buscador.current?.blur()
  }

  botonesDeEtiqueta.current.length = activas.length

  return (
    <div className={estilos.pagina}>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titular}>Vacantes abiertas</h1>
      </div>

      {sinVacantes ? (
        <div className={estilos.marco}>
          <p className={estilos.tituloMarco}>Ahora mismo no hay vacantes abiertas.</p>
          <p className={estilos.marcoTexto}>
            Publicamos convocatorias nuevas con frecuencia. Vuelve por aquí en unos días.
          </p>
        </div>
      ) : (
        <>
          <form className={estilos.buscador} role="search" onSubmit={alEnviar}>
            <label className={estilos.etiquetaBuscador} htmlFor="buscar-vacantes">
              Buscar vacantes
            </label>
            <div className={estilos.cajaBuscador}>
              <input
                ref={buscador}
                id="buscar-vacantes"
                className={estilos.entrada}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Puesto, empresa o ciudad"
                value={q}
                onChange={(e) => cambiarQ(e.target.value)}
              />
              {q !== '' && (
                <button
                  className={estilos.borrar}
                  type="button"
                  aria-label="Borrar búsqueda"
                  onClick={() => {
                    cambiarQ('')
                    buscador.current?.focus()
                  }}
                >
                  <IconoCruz tamano={18} />
                </button>
              )}
            </div>
          </form>

          <p className={estilos.soloLectores} aria-live="polite" aria-atomic="true">
            {anuncio}
          </p>

          {fallo ? (
            <div className={estilos.marco} role="alert">
              <p className={estilos.tituloMarco}>No pudimos cargar las vacantes.</p>
              <p className={estilos.marcoTexto}>
                {consulta.error instanceof Error
                  ? consulta.error.message
                  : 'No pudimos conectar con el servidor.'}
              </p>
              <button
                className={estilos.reintentar}
                type="button"
                onClick={() => void consulta.refetch()}
                data-rotulo="Intentar de nuevo"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : (
            <div className={estilos.reparto}>
              {/*
                La fila de encima de las dos columnas: el contador —o, si no
                queda ninguna, el aviso en su sitio— con «Ordenar por» a la
                derecha, y «Filtrar» en el teléfono.

                «Ninguna coincide» va aquí, justo después del buscador en el
                orden de lectura y con la salida al lado: quien no encuentra
                nada tiene que enterarse antes de llegar a los filtros. Nunca
                dice «no hay vacantes»: las hay, solo que ninguna coincide.
              */}
              <div className={estilos.filaContador}>
                {ninguna ? (
                  <div className={estilos.ninguna}>
                    <p className={estilos.contador}>{textoDelContador}.</p>
                    <p className={estilos.hayVacantes}>Hay {vacantesEnPlural(total)}.</p>
                    <button
                      className={estilos.verTodas}
                      type="button"
                      onClick={verTodas}
                      data-rotulo={`Ver las ${total} vacantes`}
                    >
                      Ver las {total} vacantes
                    </button>
                  </div>
                ) : (
                  !cargando && (
                    <p className={estilos.contador}>
                      <span className={estilos.cuenta}>{textoDelContador}</span>
                      {detalle && <span className={estilos.detalle}> {detalle}</span>}
                    </p>
                  )
                )}
                {/*
                  Siempre, con o sin texto, y con «Relevantes» marcado de
                  entrada. Sin texto, «Relevantes» pone primero las vacantes
                  que más dicen de sí mismas (ver `completitudDe`).
                */}
                <div className={estilos.orden} role="radiogroup" aria-labelledby="ordenar-por">
                  <span className={estilos.tituloDelOrden} id="ordenar-por">
                    Ordenar por
                  </span>
                  <span className={estilos.opcionesDeOrden}>
                    {(['relevantes', 'recientes'] as const).map((orden) => (
                      <label className={estilos.opcionDeOrden} key={orden}>
                        <input
                          className={estilos.soloLectores}
                          type="radio"
                          name="orden"
                          value={orden}
                          checked={estado.orden === orden}
                          onChange={() => cambiarOrden(orden)}
                        />
                        <span className={estilos.caraDelOrden}>
                          {orden === 'relevantes' ? 'Relevantes' : 'Recientes'}
                        </span>
                      </label>
                    ))}
                  </span>
                </div>
                {hayQueAcotar && (
                  <button
                    className={estilos.filtrar}
                    type="button"
                    aria-expanded={filtrosAbiertos}
                    aria-controls="filtros-de-vacantes"
                    onClick={() => setFiltrosAbiertos((abiertos) => !abiertos)}
                  >
                    Filtrar{activas.length > 0 ? ` (${activas.length})` : ''}
                  </button>
                )}
              </div>

              <div className={estilos.columnaFiltros}>
                {cargando && (
                  <div className={estilos.esqueletoDeFiltros} aria-hidden="true">
                    <div className={`${estilos.barra} ${estilos.barraCorta}`} />
                    <div className={estilos.barra} />
                    <div className={`${estilos.barra} ${estilos.barraMedia}`} />
                  </div>
                )}

                {hayQueAcotar && (
                  <div
                    id="filtros-de-vacantes"
                    className={`${estilos.filtros} ${filtrosAbiertos ? estilos.filtrosAbiertos : ''}`}
                  >
                    {fechas.length > 0 && (
                      <div className={estilos.grupo}>
                        <CabezaDelGrupo
                          clave="publicada"
                          titulo="Publicada"
                          abierto={!plegados.has('publicada')}
                          alPulsar={plegar}
                        />
                        <div
                          id="opciones-publicada"
                          className={estilos.opciones}
                          role="radiogroup"
                          aria-labelledby="grupo-publicada"
                          hidden={plegados.has('publicada')}
                        >
                          {fechas.map((opcion) => (
                            <label className={estilos.opcion} key={opcion.valor ?? 'cualquiera'}>
                              <input
                                className={estilos.casilla}
                                type="radio"
                                name="publicada"
                                value={opcion.valor ?? ''}
                                checked={estado.filtros.publicada === opcion.valor}
                                onChange={() =>
                                  cambiarFiltros({ ...vigente().filtros, publicada: opcion.valor as Ventana | null })
                                }
                              />
                              <span className={estilos.nombreDeOpcion}>{opcion.nombre}</span>{' '}
                              <span className={estilos.cantidad}>({opcion.cantidad})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {grupos.map((grupo) => (
                      <div className={estilos.grupo} key={grupo.clave}>
                        <CabezaDelGrupo
                          clave={grupo.clave}
                          titulo={grupo.titulo}
                          abierto={!plegados.has(grupo.clave)}
                          alPulsar={plegar}
                        />
                        <div
                          id={`opciones-${grupo.clave}`}
                          className={estilos.opciones}
                          role="group"
                          aria-labelledby={`grupo-${grupo.clave}`}
                          hidden={plegados.has(grupo.clave)}
                        >
                          {grupo.opciones.map((opcion) => (
                            <label className={estilos.opcion} key={opcion.valor}>
                              <input
                                className={estilos.casilla}
                                type="checkbox"
                                checked={estado.filtros[grupo.clave].includes(opcion.valor)}
                                onChange={() => alternar(grupo.clave, opcion.valor)}
                              />
                              <span className={estilos.nombreDeOpcion}>{opcion.nombre}</span>{' '}
                              <span className={estilos.cantidad}>({opcion.cantidad})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/*
                La columna de resultados: las etiquetas activas encima de las
                tarjetas. Van aquí y no en la de filtros para que marcar una
                casilla no mueva los grupos bajo el puntero; en el documento
                siguen después de los filtros, que es su turno en Tab.
              */}
              <div className={estilos.resultados}>
                {activas.length > 0 && (
                  <div className={estilos.etiquetas} role="group" aria-label="Filtros activos">
                    <ul className={estilos.listaDeEtiquetas} role="list">
                      {activas.map((etiqueta, i) => (
                        <li key={`${etiqueta.grupo}-${etiqueta.valor}`}>
                          <button
                            ref={(nodo) => {
                              botonesDeEtiqueta.current[i] = nodo
                            }}
                            className={estilos.etiqueta}
                            type="button"
                            aria-label={`Quitar filtro ${etiqueta.nombre}`}
                            onClick={() => quitarEtiqueta(etiqueta, i)}
                          >
                            {etiqueta.nombre}
                            <IconoCruz tamano={16} className={estilos.cruz} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {hayFiltros(estado.filtros) && (
                      <button className={estilos.quitarFiltros} type="button" onClick={quitarFiltros}>
                        Quitar filtros
                      </button>
                    )}
                  </div>
                )}

                {cargando ? (
                  <div className={estilos.lista} aria-busy="true" aria-label="Buscando vacantes">
                    {[0, 1, 2].map((n) => (
                      <div className={estilos.esqueleto} key={n}>
                        <div className={estilos.esqueletoDentro}>
                          <div className={estilos.esqueletoCuerpo}>
                            <div className={`${estilos.barra} ${estilos.barraCorta}`} />
                            <div className={estilos.barra} />
                            <div className={`${estilos.barra} ${estilos.barraMedia}`} />
                          </div>
                          <div className={estilos.esqueletoDatos}>
                            <div className={`${estilos.barra} ${estilos.barraMedia}`} />
                            <div className={`${estilos.barra} ${estilos.barraMedia}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  lista.length > 0 && (
                    <ul className={estilos.lista} role="list" aria-label="Vacantes">
                      {lista.map((v) => (
                        <li id={`vacante-${v.vacante.id}`} key={v.vacante.id}>
                          <Tarjeta
                            vacante={v.vacante}
                            publicada={publicadaHace(v.publicadaEn, ahora)}
                            desdeLaLista
                            forma="aLoAncho"
                            alAbrir={() => recordar(v.vacante.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * La cabeza de un grupo de filtros: su nombre y el pico que lo pliega.
 *
 * Es un botón de desplegar y no un `<details>`: `<details>` ya es un grupo para
 * el lector de pantalla, y el grupo de verdad —el de las casillas, que se nombra
 * por este botón— quedaría dentro de otro con el mismo nombre.
 */
function CabezaDelGrupo({
  clave,
  titulo,
  abierto,
  alPulsar,
}: {
  clave: string
  titulo: string
  abierto: boolean
  alPulsar: (clave: string) => void
}) {
  return (
    <button
      id={`grupo-${clave}`}
      className={estilos.cabezaDelGrupo}
      type="button"
      aria-expanded={abierto}
      aria-controls={`opciones-${clave}`}
      onClick={() => alPulsar(clave)}
    >
      {titulo}
      <IconoDesplegar tamano={18} className={estilos.pico} />
    </button>
  )
}
