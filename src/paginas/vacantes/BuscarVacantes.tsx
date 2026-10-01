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
 * ## La disposición desde el 01/10/2026: a la manera de LinkedIn
 *
 * Desde 641 px los filtros salen de la columna y pasan a una barra de
 * desplegables bajo la banda de búsqueda, con «Ordenar por» a su derecha. Desde 1024
 * px, además, la pantalla se parte: la lista a la izquierda y, a la derecha, la
 * vacante elegida entera (`FichaDeVacante`), que se elige pulsando su tarjeta
 * sin salir de aquí. Hasta 640 px sigue lo que viene a continuación, que fue la
 * disposición de todos los anchos hasta esa fecha. Cuál se pinta lo decide
 * `useCorte`.
 *
 * ## La disposición del ciclo 2 (25/09/2026), que queda en el teléfono
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
import { IconoCruz, IconoDesplegar, IconoLupa } from '@/ui/Iconos'
import { Button } from '@/ui/shadcn/button'
import { Checkbox } from '@/ui/shadcn/checkbox'
import { Input } from '@/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/shadcn/popover'
import { RadioGroup, RadioGroupItem } from '@/ui/shadcn/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/ui/shadcn/toggle-group'
import { cn } from '@/ui/shadcn/utils'
import { FilaDeVacante } from './FilaDeVacante'
import { PanelDeVacante } from './PanelDeVacante'
import {
  bajadaDeLaBanda,
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

/**
 * Desde aquí los filtros son una barra de desplegables encima de la lista; por
 * debajo, la columna que se pliega tras «Filtrar» del teléfono.
 */
const EN_BARRA = '(min-width: 641px)'

/** Desde aquí la pantalla se parte: la lista a la izquierda y la vacante elegida a la derecha. */
const PARTIDA = '(min-width: 1024px)'

/**
 * Si la ventana cumple el corte, y se entera si cambia.
 *
 * ⚠️ **La forma la decide el CSS; esto decide solo lo que el CSS no puede**: si
 * los filtros se pintan en la barra o en la columna, y si una tarjeta elige o
 * abre. Sin `matchMedia` —jsdom, o un WebView muy viejo— se queda en la
 * disposición de una columna, que funciona a cualquier ancho.
 */
function useCorte(consulta: string): boolean {
  const [cumple, setCumple] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const medida = window.matchMedia(consulta)
    const alCambiar = () => setCumple(medida.matches)
    alCambiar()
    medida.addEventListener('change', alCambiar)
    return () => medida.removeEventListener('change', alCambiar)
  }, [consulta])
  return cumple
}

/**
 * Un grupo de filtros, como datos: la barra lo pinta con las piezas de shadcn y
 * la columna del teléfono con casillas del sistema.
 */
interface GrupoDeFiltro {
  clave: string
  titulo: string
  /** Cuántas opciones del grupo están marcadas: lo dice el botón de la barra. */
  marcadas: number
  /** «Publicada» elige una; ciudad, modalidad y empresa, varias. */
  tipo: 'una' | 'varias'
  opciones: Array<{ valor: string; nombre: string; cantidad: number; marcada: boolean }>
  elegir: (valor: string) => void
}

/** El valor de «Cualquier fecha» en los radios: Radix no admite uno vacío. */
const CUALQUIER_FECHA = 'cualquiera'

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
  const enBarra = useCorte(EN_BARRA)
  const partida = useCorte(PARTIDA)
  const panel = useRef<HTMLElement>(null)
  /** Si la vacante se eligió con el teclado: entonces el foco salta al panel. */
  const focoAlPanel = useRef(false)
  /*
    La vacante elegida viaja en la dirección (`?vacante=27`) para que se pueda
    compartir y para que, al volver de postular, siga elegida. Se guarda aparte
    porque `escribir` arma la dirección desde el estado y la perdería.
  */
  const vacanteVigente = useRef<string | null>(params.get('vacante'))

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
    if (alcanzada === -1) vacanteVigente.current = params.get('vacante')
    enVuelo.current = alcanzada === -1 ? [] : enVuelo.current.slice(alcanzada + 1)
  }, [params])

  function vigente(): Estado {
    return enVuelo.current[enVuelo.current.length - 1]?.estado ?? estado
  }

  function escribir(siguiente: Estado) {
    const direccion = escribirEstado(siguiente)
    if (vacanteVigente.current) direccion.set('vacante', vacanteVigente.current)
    enVuelo.current.push({ direccion: direccion.toString(), estado: siguiente })
    setParams(direccion, { replace: true })
  }

  /* Elegir no ensucia el historial, como filtrar: atrás sale de `/vacantes`. */
  function elegir(id: number, porTeclado: boolean) {
    vacanteVigente.current = String(id)
    focoAlPanel.current = porTeclado
    escribir(vigente())
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

  /*
    La vacante del panel: la que pide la dirección si sigue en la lista, y si no
    —un filtro la dejó fuera, o no se eligió ninguna— la primera. El panel pinta
    con los datos de la lista: `GET /vacantes` trae lo mismo que la ficha.
  */
  const pedida = Number(params.get('vacante')) || null
  const laElegida = partida ? (lista.find((v) => v.vacante.id === pedida) ?? lista[0] ?? null) : null
  const elegida = laElegida?.vacante ?? null

  // Al cambiar de vacante, el panel vuelve arriba; y si se eligió con Intro, el foco va a su título.
  useEffect(() => {
    if (!elegida) return
    panel.current?.scrollTo?.({ top: 0 })
    if (focoAlPanel.current) {
      focoAlPanel.current = false
      document.getElementById('vacante-elegida-titulo')?.focus()
    }
    // Solo cuando cambia cuál: el objeto se rehace en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegida?.id])

  function recordar(id: number) {
    sessionStorage.setItem(CLAVE_DE_VUELTA, JSON.stringify({ id, key: location.key }))
  }

  /* «Buscar» —el botón o la tecla del teléfono— cierra el teclado; no recarga ni navega. */
  function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    buscador.current?.blur()
  }

  /*
    Las piezas que las dos disposiciones comparten —la de la barra, desde 641
    px, y la de la columna que se pliega, en el teléfono—: se escriben una vez y
    cada disposición las coloca donde le toca.
  */
  const elAviso = ninguna ? (
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
  )

  const losGrupos: GrupoDeFiltro[] = [
    ...(fechas.length > 0
      ? [
          {
            clave: 'publicada',
            titulo: 'Publicada',
            marcadas: estado.filtros.publicada ? 1 : 0,
            tipo: 'una' as const,
            opciones: fechas.map((opcion) => ({
              valor: opcion.valor ?? CUALQUIER_FECHA,
              nombre: opcion.nombre,
              cantidad: opcion.cantidad,
              marcada: estado.filtros.publicada === opcion.valor,
            })),
            elegir: (valor: string) =>
              cambiarFiltros({
                ...vigente().filtros,
                publicada: valor === CUALQUIER_FECHA ? null : (valor as Ventana),
              }),
          },
        ]
      : []),
    ...grupos.map((grupo) => ({
      clave: grupo.clave,
      titulo: grupo.titulo,
      marcadas: estado.filtros[grupo.clave].length,
      tipo: 'varias' as const,
      opciones: grupo.opciones.map((opcion) => ({
        valor: opcion.valor,
        nombre: opcion.nombre,
        cantidad: opcion.cantidad,
        marcada: estado.filtros[grupo.clave].includes(opcion.valor),
      })),
      elegir: (valor: string) => alternar(grupo.clave, valor),
    })),
  ]

  /* Las opciones con las casillas del sistema: la columna que se pliega del teléfono. */
  function opcionesDelSistema(g: GrupoDeFiltro) {
    return g.opciones.map((opcion) => (
      <label className={estilos.opcion} key={opcion.valor}>
        <input
          className={estilos.casilla}
          type={g.tipo === 'una' ? 'radio' : 'checkbox'}
          name={g.tipo === 'una' ? g.clave : undefined}
          value={opcion.valor}
          checked={opcion.marcada}
          onChange={() => g.elegir(opcion.valor)}
        />
        <span className={estilos.nombreDeOpcion}>{opcion.nombre}</span>{' '}
        <span className={estilos.cantidad}>({opcion.cantidad})</span>
      </label>
    ))
  }

  /*
    Las opciones dentro del desplegable de la barra, con las casillas y los radios
    de shadcn (Radix por dentro). Cada fila es una etiqueta entera de 44 px: se
    acierta pulsando el texto, no solo la casilla.
  */
  function opcionesDelDesplegable(g: GrupoDeFiltro) {
    const fila =
      'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 text-sm text-foreground hover:bg-accent'
    const cuantas = (cantidad: number) => (
      <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">({cantidad})</span>
    )
    if (g.tipo === 'una') {
      return (
        <RadioGroup
          id={`opciones-${g.clave}`}
          aria-labelledby={`grupo-${g.clave}`}
          value={g.opciones.find((o) => o.marcada)?.valor ?? CUALQUIER_FECHA}
          onValueChange={g.elegir}
          className="gap-0"
        >
          {g.opciones.map((opcion) => (
            <label className={fila} key={opcion.valor}>
              <RadioGroupItem value={opcion.valor} />
              <span className="min-w-0 break-words">{opcion.nombre}</span>{' '}
              {cuantas(opcion.cantidad)}
            </label>
          ))}
        </RadioGroup>
      )
    }
    return (
      <div id={`opciones-${g.clave}`} role="group" aria-labelledby={`grupo-${g.clave}`} className="flex flex-col">
        {g.opciones.map((opcion) => (
          <label className={fila} key={opcion.valor}>
            <Checkbox checked={opcion.marcada} onCheckedChange={() => g.elegir(opcion.valor)} />
            <span className="min-w-0 break-words">{opcion.nombre}</span>{' '}
            {cuantas(opcion.cantidad)}
          </label>
        ))}
      </div>
    )
  }

  /*
    La barra de filtros desde 641 px: un desplegable por grupo (Popover de
    shadcn) y, empujado a la derecha, el orden. Radix lleva lo que antes se
    escribía a mano: Escape cierra y devuelve el foco al botón, pulsar fuera
    cierra, y abrir uno cierra el anterior.
  */
  const laBarra = (
    <div
      className={cn(
        'relative z-[2] flex flex-wrap items-center gap-2 border-b border-border-strong pb-5',
        partida && 'col-span-2',
      )}
    >
      {cargando &&
        [0, 1, 2].map((n) => (
          <span
            key={n}
            aria-hidden="true"
            className="h-10 w-28 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
          />
        ))}
      {hayQueAcotar &&
        losGrupos.map((g) => (
          <Popover key={g.clave}>
            <PopoverTrigger asChild>
              <Button
                id={`grupo-${g.clave}`}
                // Con algo marcado se oye «Ciudad, 2 marcadas». Con un `<span>` oculto, Chrome
                // leía «Ciudad , 2 marcadas»: mete un espacio en la juntura.
                aria-label={
                  g.marcadas > 0
                    ? `${g.titulo}, ${g.marcadas} ${g.marcadas === 1 ? 'marcada' : 'marcadas'}`
                    : undefined
                }
                variant="outline"
                className={cn(
                  'group h-10 gap-2 border-input bg-card px-3.5 text-sm font-medium text-foreground shadow-none',
                  g.marcadas > 0 && 'border-primary bg-primary/[0.06] text-primary-hover hover:bg-primary/10',
                )}
              >
                {g.titulo}
                {g.marcadas > 0 && (
                  <span
                    aria-hidden="true"
                    className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums"
                  >
                    {g.marcadas}
                  </span>
                )}
                <IconoDesplegar
                  tamano={16}
                  className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-[min(60vh,26rem)] w-72 overflow-y-auto p-1.5">
              {opcionesDelDesplegable(g)}
            </PopoverContent>
          </Popover>
        ))}
      {/* A la derecha, como en LinkedIn: primero se acota y después se ordena (01/10/2026). */}
      <div className="ml-auto flex items-center gap-3">
        <span id="ordenar-por" className="text-sm text-muted-foreground">
          Ordenar por
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={estado.orden}
          onValueChange={(orden) => {
            // Radix deja desmarcar la elegida; aquí siempre hay un orden.
            if (orden) cambiarOrden(orden as Orden)
          }}
          aria-labelledby="ordenar-por"
          className="bg-card"
        >
          {(['relevantes', 'recientes'] as const).map((orden) => (
            <ToggleGroupItem
              key={orden}
              value={orden}
              className="h-10 border-input px-4 text-sm font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {orden === 'relevantes' ? 'Relevantes' : 'Recientes'}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )

  /*
    El orden en el teléfono: dos radios del sistema bajo el contador. Siempre,
    con o sin texto, y con «Relevantes» marcado de entrada. Sin texto,
    «Relevantes» pone primero las vacantes que más dicen de sí mismas (ver
    `completitudDe`).
  */
  const elOrdenDelTelefono = (
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
  )

  /* Las etiquetas de lo que está filtrando, con su equis: quitar una es pulsarla. */
  const lasEtiquetas = activas.length > 0 && (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros activos">
      <ul role="list" className="m-0 flex max-w-full list-none flex-wrap gap-2 p-0">
        {activas.map((etiqueta, i) => (
          <li key={`${etiqueta.grupo}-${etiqueta.valor}`} className="max-w-full min-w-0">
            <Button
              ref={(nodo: HTMLButtonElement | null) => {
                botonesDeEtiqueta.current[i] = nodo
              }}
              type="button"
              variant="outline"
              aria-label={`Quitar filtro ${etiqueta.nombre}`}
              onClick={() => quitarEtiqueta(etiqueta, i)}
              className="h-auto min-h-11 max-w-full min-w-0 shrink gap-1.5 rounded-full border-border-strong bg-card py-2 pr-2.5 pl-3.5 text-left text-sm font-medium whitespace-normal shadow-none [overflow-wrap:anywhere] sm:min-h-9 sm:py-1.5"
            >
              {etiqueta.nombre}
              <IconoCruz tamano={14} className="text-muted-foreground" />
            </Button>
          </li>
        ))}
      </ul>
      {hayFiltros(estado.filtros) && (
        <Button
          type="button"
          variant="link"
          onClick={quitarFiltros}
          className="h-11 px-2 text-sm text-tinta2 underline underline-offset-4 hover:text-foreground sm:h-9"
        >
          Quitar filtros
        </Button>
      )}
    </div>
  )

  const laLista = cargando ? (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Buscando vacantes">
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex gap-4 rounded-xl border border-border-strong bg-card p-4">
          <div className="size-11 shrink-0 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2.5 pt-1">
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    lista.length > 0 && (
      <ul role="list" aria-label="Vacantes" className="m-0 flex list-none flex-col gap-3 p-0">
        {lista.map((v) => (
          <li id={`vacante-${v.vacante.id}`} key={v.vacante.id}>
            <FilaDeVacante
              vacante={v.vacante}
              publicada={publicadaHace(v.publicadaEn, ahora)}
              // Pantalla partida: la fila elige la vacante del panel; si no, abre su ficha.
              elegida={partida && elegida?.id === v.vacante.id}
              alElegir={partida ? (porTeclado) => elegir(v.vacante.id, porTeclado) : undefined}
              alAbrir={partida ? undefined : () => recordar(v.vacante.id)}
            />
          </li>
        ))}
      </ul>
    )
  )

  botonesDeEtiqueta.current.length = activas.length

  return (
    <div className={estilos.pagina}>
      {/*
        La banda de búsqueda (01/10/2026): el titular, cuántas hay y el buscador,
        juntos en una superficie arriba, con el campo y el botón de shadcn.
      */}
      <div className="mt-2 rounded-xl border border-border-strong bg-card px-5 py-6 sm:px-8 sm:py-7">
        <h1 className="m-0 text-[length:var(--t-encabezado)] leading-tight font-semibold tracking-tight text-foreground">
          Vacantes abiertas
        </h1>
        {!sinVacantes && (
          <>
            <p className="mt-2 text-base text-tinta2">{bajadaDeLaBanda(cargando || fallo ? null : total)}</p>
            <form className="mt-5 flex max-w-3xl gap-3" role="search" onSubmit={alEnviar}>
              {/* Oculta a la vista desde el 01/10/2026: repetía el titular de encima, y la lupa
                  ya dice que es un buscador. Los lectores de pantalla la siguen leyendo. */}
              <label className="sr-only" htmlFor="buscar-vacantes">
                Buscar vacantes
              </label>
              <div className="relative min-w-0 flex-1">
                <IconoLupa
                  tamano={20}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                />
                {/* 16 px de letra también en escritorio: por debajo iOS hace zoom al enfocar. */}
                <Input
                  ref={buscador}
                  id="buscar-vacantes"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Puesto, empresa o ciudad"
                  value={q}
                  onChange={(e) => cambiarQ(e.target.value)}
                  className="h-12 bg-card pr-12 pl-11 text-base shadow-none md:text-base [&::-webkit-search-cancel-button]:appearance-none"
                />
                {q !== '' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Borrar búsqueda"
                    onClick={() => {
                      cambiarQ('')
                      buscador.current?.focus()
                    }}
                    className="absolute top-1/2 right-1 size-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <IconoCruz tamano={18} />
                  </Button>
                )}
              </div>
              {/*
                La lista ya se acota al escribir, así que «Buscar» no trae nada nuevo: es el
                gesto que espera quien viene de cualquier bolsa de empleo. En el teléfono
                se va: el teclado trae su tecla, que hace lo mismo.
              */}
              <Button type="submit" className="h-12 px-6 text-sm hover:bg-primary-hover max-sm:hidden">
                Buscar
              </Button>
            </form>
          </>
        )}
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
          ) : enBarra ? (
            /*
              Desde 641 px: la barra a todo el ancho y, debajo, la lista; desde
              1024, a su derecha, el panel con la vacante elegida. En el
              documento va como se ve: filtros y orden, contador, etiquetas,
              filas y panel.
            */
            <div
              className={cn(
                'mt-8 grid items-start gap-5',
                partida && 'grid-cols-[minmax(0,26rem)_minmax(0,1fr)]',
              )}
            >
              {laBarra}
              <div className="flex min-w-0 flex-col gap-3">
                <div className={estilos.filaContador}>{elAviso}</div>
                {lasEtiquetas}
                {laLista}
              </div>
              {laElegida && (
                /*
                  Pegado bajo la cabecera mientras la lista baja, y con su propio
                  desplazamiento: una vacante larga se lee entera sin perder la
                  lista de vista.
                */
                <section
                  ref={panel}
                  aria-labelledby="vacante-elegida-titulo"
                  className="sticky top-[calc(var(--alto-cabecera)+12px)] max-h-[calc(100vh-var(--alto-cabecera)-24px)] overflow-y-auto overscroll-contain rounded-xl"
                >
                  <PanelDeVacante
                    key={laElegida.vacante.id}
                    vacante={laElegida.vacante}
                    publicada={publicadaHace(laElegida.publicadaEn, ahora)}
                    idTitulo="vacante-elegida-titulo"
                  />
                </section>
              )}
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
                {elAviso}
                {elOrdenDelTelefono}
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
                    {losGrupos.map((g) => (
                      <div className={estilos.grupo} key={g.clave}>
                        <CabezaDelGrupo
                          clave={g.clave}
                          titulo={g.titulo}
                          abierto={!plegados.has(g.clave)}
                          alPulsar={plegar}
                        />
                        <div
                          id={`opciones-${g.clave}`}
                          className={estilos.opciones}
                          role={g.tipo === 'una' ? 'radiogroup' : 'group'}
                          aria-labelledby={`grupo-${g.clave}`}
                          hidden={plegados.has(g.clave)}
                        >
                          {opcionesDelSistema(g)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/*
                La columna de resultados: las etiquetas activas encima de las
                filas. Van aquí y no en la de filtros para que marcar una
                casilla no mueva los grupos bajo el puntero; en el documento
                siguen después de los filtros, que es su turno en Tab.
              */}
              <div className={estilos.resultados}>
                {lasEtiquetas}
                {laLista}
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
