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
import { Tarjeta } from './Tarjeta'
import {
  contador,
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
      orden: params.get('orden') === 'recientes' && q.trim() !== '' ? 'recientes' : 'relevantes',
    }),
    [q, desdeLaDireccion.filtros, params],
  )

  /*
    El catálogo entero solo si la dirección trae una ciudad que ninguna vacante
    tiene: hace falta para ponerle nombre a la etiqueta («Cusco ✕») y para
    descartar el código que no sea del catálogo. Con las ciudades que sí están en
    la lista no se pide nada.
  */
  const codigosDesconocidos = estado.filtros.ciudades.filter(
    (c) => c !== 'sin-indicar' && !indice.some((v) => v.ciudad === c),
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

  function escribir(siguiente: Estado) {
    setParams(escribirEstado(siguiente), { replace: true })
  }

  function cambiarQ(texto: string) {
    setQ(texto)
    escribir({ ...estado, q: texto })
  }

  function cambiarFiltros(filtros: Filtros) {
    escribir({ ...estado, filtros })
  }

  function cambiarOrden(orden: Orden) {
    escribir({ ...estado, orden })
    setAnuncio(NOMBRE_DEL_ORDEN[orden])
  }

  function alternar(grupo: 'ciudades' | 'modalidades' | 'empresas', valor: string) {
    const actuales = estado.filtros[grupo]
    const siguientes = actuales.includes(valor)
      ? actuales.filter((v) => v !== valor)
      : [...actuales, valor]
    cambiarFiltros({ ...estado.filtros, [grupo]: siguientes })
  }

  function quitarEtiqueta(etiqueta: Etiqueta, indice: number) {
    focoPendiente.current = indice
    escribir(sinEtiqueta(estado, etiqueta))
  }

  function quitarFiltros() {
    focoPendiente.current = 0
    cambiarFiltros(SIN_FILTROS)
  }

  function verTodas() {
    setQ('')
    escribir({ q: '', filtros: SIN_FILTROS, orden: 'relevantes' })
    buscador.current?.focus()
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
    escribir({
      ...estado,
      filtros: {
        ...estado.filtros,
        ciudades: estado.filtros.ciudades.filter((c) => !invalidos.includes(c)),
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
    () => etiquetasDe(estado, indice, nombresDelCatalogo),
    [estado, indice, nombresDelCatalogo],
  )
  const hayTexto = q.trim() !== ''
  const hayQueAcotar = grupos.length > 0 || fechas !== null
  const cargando = consulta.isPending
  const fallo = consulta.isError && consulta.data === undefined
  const sinVacantes = !cargando && !fallo && total === 0
  const ninguna = !cargando && !fallo && total > 0 && lista.length === 0
  const textoDelContador = contador(lista.length, total, estado, activas)

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
                  <span aria-hidden="true">✕</span>
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
            <>
              {/*
                «Ninguna coincide» va justo después del buscador en el orden de
                lectura, con la salida al lado: quien no encuentra nada tiene que
                enterarse antes de llegar a los filtros. Nunca dice «no hay
                vacantes»: las hay, solo que ninguna coincide.
              */}
              {ninguna && (
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
              )}

              <div className={estilos.filaContador}>
                {!cargando && !ninguna && (
                  <p className={estilos.contador}>{textoDelContador}</p>
                )}
                {/*
                  Con texto, el conmutador; sin texto, «Más recientes primero» en su
                  mismo sitio. Sin nada escrito no hay relevancia que medir, y un
                  botón que no cambia nada parece roto. Ocupan el mismo sitio para
                  que la lista no salte al empezar a escribir.
                */}
                {hayTexto ? (
                  <div className={estilos.orden} role="radiogroup" aria-labelledby="ordenar-por">
                    <span className={estilos.tituloDelOrden} id="ordenar-por">
                      Ordenar por
                    </span>
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
                  </div>
                ) : (
                  <p className={estilos.ordenFijo}>Más recientes primero</p>
                )}
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

              {hayQueAcotar && (
                <div
                  id="filtros-de-vacantes"
                  className={`${estilos.filtros} ${filtrosAbiertos ? estilos.filtrosAbiertos : ''}`}
                >
                  {grupos.map((grupo) => (
                    <div
                      className={estilos.grupo}
                      role="group"
                      aria-labelledby={`grupo-${grupo.clave}`}
                      key={grupo.clave}
                    >
                      <span className={estilos.tituloDelGrupo} id={`grupo-${grupo.clave}`}>
                        {grupo.titulo}
                      </span>
                      <div className={estilos.opciones}>
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

                  {fechas && (
                    <div
                      className={estilos.grupo}
                      role="radiogroup"
                      aria-labelledby="grupo-publicada"
                    >
                      <span className={estilos.tituloDelGrupo} id="grupo-publicada">
                        Publicada
                      </span>
                      <div className={estilos.opciones}>
                        {fechas.map((opcion) => (
                          <label className={estilos.opcion} key={opcion.valor ?? 'cualquiera'}>
                            <input
                              className={estilos.casilla}
                              type="radio"
                              name="publicada"
                              value={opcion.valor ?? ''}
                              checked={estado.filtros.publicada === opcion.valor}
                              onChange={() =>
                                cambiarFiltros({ ...estado.filtros, publicada: opcion.valor as Ventana | null })
                              }
                            />
                            <span className={estilos.nombreDeOpcion}>{opcion.nombre}</span>{' '}
                            <span className={estilos.cantidad}>({opcion.cantidad})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                          {etiqueta.nombre} <span aria-hidden="true">✕</span>
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
                      <div className={`${estilos.barra} ${estilos.barraCorta}`} />
                      <div className={estilos.barra} />
                      <div className={`${estilos.barra} ${estilos.barraMedia}`} />
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
                          alAbrir={() => recordar(v.vacante.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
