/**
 * «Pruebas» (`/admin/pruebas`): el índice de las preguntas y pruebas que la
 * empresa escribió en el editor de sus vacantes (spec pruebas-indice-de-la-empresa).
 *
 * Es de **solo lectura**: aquí se busca, se mira y se copia; para editar se
 * entra en la vacante, con sus reglas de siempre. Dos pestañas —«Preguntas del
 * Perfil Integral» y «Prueba del puesto»—, y la pestaña, los filtros, lo que se
 * busca y la fila abierta viven en la dirección: se pueden enlazar y
 * sobreviven a una recarga.
 *
 * Teclado: «/» o Ctrl/⌘+K enfocan la búsqueda; ↓ pasa de la línea a las filas y
 * ↑/↓ las recorren (con la vista previa al lado, cambian la fila abierta);
 * Enter abre; Escape cierra lo de arriba —la ventanita de filtros, el bloque de
 * copia, la vista previa—. Lo que se hace con el teclado no se anima.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as EventoDeTeclado } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { rutas } from '@/rutas'
import { Vacio } from '@/ui/Vacio'
import { ErrorApi } from '../api/cliente'
import type { EditorDePreguntas } from '../api/preguntasPropias'
import { listarPruebas, type FilaDePrueba } from '../api/pruebas'
import { Pestanas } from '../ui/Pestanas'
import { claveDelEditor } from '../vacantes/preguntas/consultas'
import { BotonDeFiltros, ColumnaDeFiltros, LineaDeBusqueda, ListaDeSugerencias } from './Busqueda'
import {
  admite,
  cuantosFiltros,
  escribirEstado,
  leerEstado,
  PESTANAS,
  SIN_FILTROS,
  sugerencias,
  textoDelTitulo,
  type EstadoDeLaPantalla,
  type Grupo,
  type Pestana,
  type Sugerencia,
} from './indice'
import { Lectura } from './Lectura'
import { ListaDePruebas } from './ListaDePruebas'
import { useModoDeLectura } from './useModoDeLectura'
import estilos from './Pruebas.module.css'

/**
 * La marca de lo que esta pantalla escribe en la dirección. La navegación de
 * react-router va en una transición y se pinta cuando puede, a veces después de
 * otras pulsaciones: lo que llega sin la marca vino de fuera (un enlace del menú).
 */
const DESDE_PRUEBAS = { desdePruebas: true } as const
const esDePruebas = (estado: unknown) => (estado as { desdePruebas?: boolean } | null)?.desdePruebas === true

const VACIO: Record<Pestana, { titulo: string; texto: string }> = {
  preguntas: {
    titulo: 'Ninguna vacante tiene preguntas propias todavía',
    texto: 'Las preguntas del Perfil Integral se escriben dentro de cada vacante.',
  },
  prueba: {
    titulo: 'Ninguna vacante tiene prueba del puesto todavía',
    texto: 'La prueba del puesto se escribe dentro de cada vacante.',
  },
}

export function PruebasPanel() {
  const [query, setQuery] = useSearchParams()
  const estado = leerEstado(query)
  const direccion = useLocation()
  const navegar = useNavigate()
  const cache = useQueryClient()
  const { modo, cabeLaColumna, esTelefono } = useModoDeLectura()
  const buscador = useRef<HTMLInputElement>(null)
  const columnaLista = useRef<HTMLDivElement>(null)
  const focoAntes = useRef<HTMLElement | null>(null)

  // El bloque de copia es de una vacante: se despliega cuando la dirección ya la tiene abierta.
  // Antes, la vista previa seguiría con la anterior (o cerrada e `inert`): el bloque nacería
  // para otra vacante, o sin poder tomar el foco.
  const [copiaDe, setCopiaDe] = useState<number | null>(null)
  const conCopia = copiaDe !== null && copiaDe === estado.vacante
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [sinTransicion, setSinTransicion] = useState(false)
  // La hoja conserva la última vacante mientras sale, para no vaciarse a mitad de la animación.
  // Es de su pestaña: una dirección que cambia de pestaña (el menú) no la pide con el otro tipo.
  const [ultima, setUltima] = useState(estado.vacante === null ? null : { vacante: estado.vacante, pestana: estado.pestana })
  useEffect(() => {
    if (estado.vacante !== null) setUltima({ vacante: estado.vacante, pestana: estado.pestana })
  }, [estado.vacante, estado.pestana])
  const ultimaDeLaPestana = ultima?.pestana === estado.pestana ? ultima.vacante : null

  // La línea manda sobre lo que se busca: si el campo saliera de la dirección, cada pulsación lo
  // repintaría con el valor de antes mientras la navegación espera, y se perderían letras.
  const [buscar, setBuscar] = useState(estado.buscar)
  const buscarActual = useRef(estado.buscar)

  const cambiar = useCallback(
    (cambio: Partial<EstadoDeLaPantalla>) => {
      if (cambio.buscar !== undefined) {
        buscarActual.current = cambio.buscar
        setBuscar(cambio.buscar)
      }
      // `antes` puede ser de antes de la última pulsación: lo buscado sale de la línea.
      setQuery((antes) => escribirEstado({ ...leerEstado(antes), buscar: buscarActual.current, ...cambio }), {
        replace: true,
        state: DESDE_PRUEBAS,
      })
    },
    [setQuery],
  )

  // Una dirección que llega de fuera (el menú, un enlace) trae su búsqueda.
  const deFuera = !esDePruebas(direccion.state)
  useEffect(() => {
    if (!deFuera) return
    buscarActual.current = estado.buscar
    setBuscar(estado.buscar)
  }, [deFuera, direccion.key, estado.buscar])

  const preguntas = useQuery({
    queryKey: ['panel-pruebas', 'PERFIL_INTEGRAL'],
    queryFn: () => listarPruebas('PERFIL_INTEGRAL'),
  })
  const prueba = useQuery({
    queryKey: ['panel-pruebas', 'PRUEBA_PUESTO'],
    queryFn: () => listarPruebas('PRUEBA_PUESTO'),
  })
  const consultas = { preguntas, prueba }
  const lista = consultas[estado.pestana]
  const filas = lista.data ?? []
  const visibles = filas.filter((f) => admite(f, estado.filtros, buscar))
  const sugs = lista.data ? sugerencias(buscar, estado.filtros, filas) : []
  const vacia = !!lista.data && filas.length === 0
  const leyendo = estado.vacante !== null
  const modal = leyendo && modo !== 'lado'
  const fila: FilaDePrueba | null = filas.find((f) => f.vacanteId === (estado.vacante ?? ultimaDeLaPestana)) ?? null
  const conColumna = cabeLaColumna && !leyendo && !vacia
  const n = cuantosFiltros(estado.filtros)
  const sinPermiso = lista.error instanceof ErrorApi && lista.error.estado === 403

  // ---------- Abrir y cerrar la vista previa ----------

  const verDe = (id: number | null) =>
    id === null ? null : columnaLista.current?.querySelector<HTMLElement>(`[data-ver="${id}"]`) ?? null

  // Lo que espera a que la dirección se pinte con la vacante abierta (o con ninguna). Antes, la
  // hoja seguiría `inert` (el foco no entraría) y la lista también (el foco caería en el body);
  // y animar o no se decide para el pintado que la abre, no para uno anterior.
  const focoPendiente = useRef<{ vacante: number | null; enfocar: () => void } | null>(null)
  const sinAnimarHasta = useRef<{ vacante: number | null } | null>(null)

  useLayoutEffect(() => {
    const foco = focoPendiente.current
    if (foco && foco.vacante === estado.vacante) {
      focoPendiente.current = null
      foco.enfocar()
    }
    const quieta = sinAnimarHasta.current
    if (quieta && quieta.vacante === estado.vacante) {
      sinAnimarHasta.current = null
      requestAnimationFrame(() => requestAnimationFrame(() => setSinTransicion(false)))
    }
  })

  const enfocarAlPintar = (vacante: number | null, enfocar: () => void) => {
    focoPendiente.current = { vacante, enfocar }
  }

  const sinAnimar = (vacante: number | null) => {
    sinAnimarHasta.current = { vacante }
    setSinTransicion(true)
  }

  const enfocarTitulo = () =>
    document.querySelector<HTMLElement>('#lectura [data-titulo-lectura]')?.focus({ preventScroll: true })

  // El buscador del bloque de copia. Si la vista previa aún carga, el bloque no está: el foco
  // espera en el título (el botón de la fila ya no se ve) y el bloque lo toma al nacer.
  const enfocarCopia = () => {
    const campo = document.querySelector<HTMLElement>('#bloque-de-copia input[type="search"]')
    if (campo) campo.focus({ preventScroll: true })
    else enfocarTitulo()
  }

  function abrir(id: number, conTeclado: boolean, { copia = false, desdeLista = false } = {}) {
    if (!leyendo) focoAntes.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (conTeclado && modo !== 'lado' && !leyendo) sinAnimar(id)
    setCopiaDe(copia ? id : null)
    setFiltrosAbiertos(false)
    cambiar({ vacante: id })
    if (copia) enfocarAlPintar(id, enfocarCopia)
    else if (modo !== 'lado') enfocarAlPintar(id, enfocarTitulo)
    else if (!desdeLista) enfocarAlPintar(id, () => verDe(id)?.focus({ preventScroll: true }))
  }

  function cerrar(conTeclado: boolean) {
    if (!leyendo) return
    const era = estado.vacante
    if (conTeclado && modo !== 'lado') sinAnimar(null)
    setCopiaDe(null)
    cambiar({ vacante: null })
    enfocarAlPintar(null, () => {
      const boton = verDe(era)
      if (boton) boton.focus({ preventScroll: modo !== 'lado' })
      else if (focoAntes.current && document.contains(focoAntes.current)) focoAntes.current.focus({ preventScroll: true })
      else buscador.current?.focus({ preventScroll: true })
    })
  }

  function mover(paso: 1 | -1) {
    const i = visibles.findIndex((f) => f.vacanteId === estado.vacante)
    const siguiente = visibles[i + paso]
    if (!siguiente) return
    abrir(siguiente.vacanteId, true, { desdeLista: true })
    enfocarAlPintar(siguiente.vacanteId, enfocarTitulo)
  }

  function usarEnOtra(id: number, conTeclado: boolean) {
    if (estado.vacante !== id) abrir(id, conTeclado, { copia: true })
    else if (conCopia) enfocarCopia()
    else {
      setCopiaDe(id)
      enfocarAlPintar(id, enfocarCopia)
    }
  }

  // Plegar el bloque es lo mismo desde «Cancelar», desde Escape o desde el botón que lo
  // despliega (como `closeCopy` en la maqueta): el foco vuelve a «Usar en otra vacante» de la
  // vista previa. Se enfoca tras pintar: antes, el control que tenía el foco desaparece con el
  // bloque y lo deja en el `body`.
  function cerrarCopia() {
    setCopiaDe(null)
    enfocarAlPintar(estado.vacante, () =>
      document.querySelector<HTMLElement>('#lectura [aria-controls="bloque-de-copia"]')?.focus({ preventScroll: true }),
    )
  }

  const alCopiar = (destino: number, editor: EditorDePreguntas) => {
    const ruta = estado.pestana === 'prueba' ? 'prueba-propia' : 'preguntas-propias'
    // El editor de la destino abre ya con el borrador copiado, sin otra petición.
    cache.setQueryData(claveDelEditor(destino, ruta), editor)
    void cache.invalidateQueries({ queryKey: ['panel-pruebas'] })
    void cache.invalidateQueries({ queryKey: ['panel-vacante', destino] })
    setCopiaDe(null)
    cambiar({ vacante: null })
    navegar(estado.pestana === 'prueba' ? rutas.adminPruebaPropia(destino) : rutas.adminPreguntasPropias(destino))
  }

  const alDesaparecer = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ['panel-pruebas'] })
  }, [cache])

  // ---------- Pestañas, búsqueda y filtros ----------

  function cambiarPestana(pestana: Pestana) {
    if (pestana === estado.pestana) return
    setCopiaDe(null)
    setFiltrosAbiertos(false)
    setUltima(null)
    cambiar({ pestana, vacante: null })
  }

  const alternar = (grupo: Grupo, valor: string) => {
    const actuales = estado.filtros[grupo]
    const nuevos = actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor]
    cambiar({ filtros: { ...estado.filtros, [grupo]: nuevos } })
  }

  const quitar = (grupo: Grupo, valores: string[]) =>
    cambiar({ filtros: { ...estado.filtros, [grupo]: estado.filtros[grupo].filter((v) => !valores.includes(v)) } })

  const quitarFiltros = () => cambiar({ filtros: SIN_FILTROS })

  const aplicar = (s: Sugerencia) => {
    const actuales = estado.filtros[s.grupo]
    cambiar({
      buscar: '',
      filtros: { ...estado.filtros, [s.grupo]: actuales.includes(s.valor) ? actuales : [...actuales, s.valor] },
    })
    buscador.current?.focus()
  }

  const recorribles = () => [...(columnaLista.current?.querySelectorAll<HTMLElement>('[data-recorrible]') ?? [])]

  function enfocarEnLaLista(destino: HTMLElement) {
    destino.focus()
    const id = Number(destino.dataset.ver)
    if (leyendo && modo === 'lado' && destino.dataset.ver && id !== estado.vacante) {
      abrir(id, true, { desdeLista: true })
    }
  }

  function alPulsarEnLaLista(e: EventoDeTeclado<HTMLDivElement>) {
    const objetivo = e.target as HTMLElement
    if (!objetivo.matches('[data-recorrible]')) return
    const todos = recorribles()
    const i = todos.indexOf(objetivo)
    let destino: HTMLElement | undefined
    if (e.key === 'ArrowDown') destino = todos[i + 1]
    else if (e.key === 'ArrowUp') {
      if (i <= 0) {
        e.preventDefault()
        buscador.current?.focus()
        return
      }
      destino = todos[i - 1]
    } else if (e.key === 'Home') destino = todos[0]
    else if (e.key === 'End') destino = todos[todos.length - 1]
    else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Escribir sobre una fila sigue escribiendo en la búsqueda.
      buscador.current?.focus()
      return
    }
    if (!destino) return
    e.preventDefault()
    enfocarEnLaLista(destino)
  }

  // ---------- Teclado de toda la pantalla ----------

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      // Con el cajón del menú abierto, el teclado es suyo.
      if (document.querySelector('#cajon-del-menu')) return
      if (e.key === 'Escape') {
        if (filtrosAbiertos) {
          e.preventDefault()
          setFiltrosAbiertos(false)
          document.querySelector<HTMLElement>('[aria-controls="ventana-filtros"]')?.focus()
        } else if (conCopia) {
          e.preventDefault()
          cerrarCopia()
        } else if (leyendo) {
          e.preventDefault()
          cerrar(true)
        }
        return
      }
      const escribiendo = (e.target as HTMLElement | null)?.matches?.('input, textarea, select') ?? false
      if (modal && !escribiendo && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.altKey && !e.metaKey) {
        e.preventDefault()
        mover(e.key === 'ArrowRight' ? 1 : -1)
        return
      }
      if (!modal && ((e.key === '/' && !escribiendo) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault()
        buscador.current?.focus()
        buscador.current?.select()
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  })

  // ---------- Lo que se pinta ----------

  const cuentaDe = (p: Pestana): number | string | undefined => {
    const c = consultas[p]
    if (c.isPending) return '…'
    return c.data?.length
  }

  let anuncio = ''
  if (lista.isPending) anuncio = 'Buscando…'
  else if (vacia) anuncio = VACIO[estado.pestana].titulo
  else if (lista.data) anuncio = `${visibles.length} ${visibles.length === 1 ? 'vacante' : 'vacantes'}`

  let cuerpo = null
  if (lista.isPending) {
    cuerpo = (
      <div className={estilos.envoltura} aria-busy="true">
        <div className={estilos.cabeceraGrupo}>
          <span className={estilos.giro} aria-hidden="true" />
          Buscando…
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={estilos.filaCarga}>
            <div className={`${estilos.barraCarga} ${estilos.barraLarga}`} />
            <div className={`${estilos.barraCarga} ${estilos.barraCorta}`} />
          </div>
        ))}
      </div>
    )
  } else if (vacia) {
    cuerpo = (
      <Vacio
        titulo={VACIO[estado.pestana].titulo}
        accion={
          <Link className={estilos.acento} to={rutas.adminVacantes()}>
            Ir a Vacantes
          </Link>
        }
      >
        {VACIO[estado.pestana].texto}
      </Vacio>
    )
  } else if (lista.data && visibles.length === 0) {
    if (sugs.length === 0) {
      cuerpo = (
        <div className={estilos.marco}>
          <h2 className={estilos.tituloVacio}>Ninguna coincide con los filtros</h2>
          <div className={estilos.botonesMarco}>
            <button
              className={estilos.secundario}
              type="button"
              onClick={() => {
                cambiar({ filtros: SIN_FILTROS, buscar: '' })
                buscador.current?.focus()
              }}
            >
              Quitar filtros
            </button>
          </div>
        </div>
      )
    } else if (textoDelTitulo(buscar)) {
      cuerpo = (
        <div className={`${estilos.marco} ${estilos.marcoEstrecho}`}>
          <p className={estilos.textoMarco}>Ningún título dice «{buscar}».</p>
        </div>
      )
    }
  } else if (lista.data) {
    cuerpo = (
      <ListaDePruebas
        filas={visibles}
        pestana={estado.pestana}
        abierta={estado.vacante}
        alAbrir={(id, conTeclado) => {
          if (estado.vacante === id && modo === 'lado' && conTeclado) {
            enfocarTitulo()
            return
          }
          abrir(id, conTeclado)
        }}
        alUsarEnOtra={usarEnOtra}
      />
    )
  }

  const clasesPagina = [
    estilos.pagina,
    leyendo ? estilos.leyendo : '',
    modo === 'lado' ? estilos.modoLado : '',
    conColumna ? estilos.conColumna : '',
  ]
    .filter(Boolean)
    .join(' ')
  const indice = visibles.findIndex((f) => f.vacanteId === estado.vacante)

  return (
    <div className={clasesPagina}>
      <div className={estilos.cabeceraModulo} inert={modal}>
        <h1>Pruebas.</h1>
        <div className={estilos.envolturaPestanas}>
          <Pestanas
            pestanas={PESTANAS.map((p) => ({ clave: p.clave, nombre: p.nombre, cuenta: cuentaDe(p.clave) }))}
            actual={estado.pestana}
            alCambiar={cambiarPestana}
            etiqueta="Tipo"
            prefijo="pruebas-"
            iguales
          />
        </div>
        {!vacia && !sinPermiso && (
          <div className={estilos.busqueda}>
            <LineaDeBusqueda
              ref={buscador}
              buscar={buscar}
              filtros={estado.filtros}
              sugerencias={sugs}
              esTelefono={esTelefono}
              alEscribir={(texto) => cambiar({ buscar: texto })}
              alQuitar={quitar}
              alConfirmar={() => {
                if (visibles[0]) abrir(visibles[0].vacanteId, true)
                else if (sugs[0]) aplicar(sugs[0])
              }}
              alBajar={() => {
                const destino =
                  columnaLista.current?.querySelector<HTMLElement>('[data-ver]') ?? recorribles()[0]
                if (destino) enfocarEnLaLista(destino)
              }}
              alSubir={() => {
                const sugerencias = columnaLista.current?.querySelectorAll<HTMLElement>('[data-recorrible]:not([data-ver])')
                const ultimaSugerencia = sugerencias?.[sugerencias.length - 1]
                if (ultimaSugerencia) ultimaSugerencia.focus()
              }}
            />
            {!conColumna && (
              <BotonDeFiltros
                filtros={estado.filtros}
                filas={filas}
                abierto={filtrosAbiertos}
                esTelefono={esTelefono}
                alAbrir={setFiltrosAbiertos}
                alAlternar={alternar}
                alQuitarTodo={quitarFiltros}
              />
            )}
            {n > 0 && (
              <button
                className={estilos.fantasma}
                type="button"
                onClick={() => {
                  quitarFiltros()
                  buscador.current?.focus()
                }}
              >
                Quitar filtros
              </button>
            )}
          </div>
        )}
        {lista.isError && (
          <div className={estilos.avisoMalo} role="alert">
            <span>
              {sinPermiso && lista.error instanceof Error
                ? lista.error.message
                : lista.data
                  ? 'No se pudo actualizar la lista.'
                  : 'No se pudo cargar la lista.'}
            </span>
            {!sinPermiso && (
              <button
                className={estilos.secundario}
                type="button"
                disabled={lista.isFetching}
                onClick={() => void lista.refetch()}
              >
                {lista.isFetching ? (
                  <>
                    <span className={estilos.giro} aria-hidden="true" />
                    Reintentando…
                  </>
                ) : (
                  'Reintentar'
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={estilos.reparto}
        role="tabpanel"
        id={`pruebas-panel-${estado.pestana}`}
        aria-labelledby={`pruebas-pestana-${estado.pestana}`}
      >
        {conColumna && (
          <ColumnaDeFiltros filtros={estado.filtros} filas={filas} alAlternar={alternar} alQuitarTodo={quitarFiltros} />
        )}
        <div className={estilos.columnaLista} ref={columnaLista} onKeyDown={alPulsarEnLaLista} inert={modal}>
          {!vacia && <ListaDeSugerencias sugerencias={sugs} alAplicar={aplicar} />}
          {cuerpo}
        </div>
        <Lectura
          modo={modo}
          abierta={leyendo}
          vacanteId={estado.vacante ?? ultimaDeLaPestana}
          fila={fila}
          pestana={estado.pestana}
          posicion={{ indice, total: visibles.length }}
          conCopia={conCopia}
          sinTransicion={sinTransicion}
          alCerrar={cerrar}
          alMover={mover}
          alAlternarCopia={() => (conCopia ? cerrarCopia() : setCopiaDe(estado.vacante))}
          alCerrarCopia={cerrarCopia}
          alCopiar={alCopiar}
          alDesaparecer={alDesaparecer}
        />
      </div>
      <p className="solo-lectores" aria-live="polite">
        {anuncio}
      </p>
    </div>
  )
}
