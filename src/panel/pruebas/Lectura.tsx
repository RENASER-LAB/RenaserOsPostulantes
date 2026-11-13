/**
 * La vista previa de «Pruebas», en solo lectura (spec pruebas-indice-de-la-empresa, punto 4).
 *
 * Desde 1280 px es una columna a la derecha de la lista, fija bajo la barra y
 * con su propio scroll, sin velo y sin bloquear la lista. De 641 a 1279 px sube
 * como hoja desde abajo sobre el área de contenido, y en el teléfono ocupa la
 * pantalla: las dos son modales (el foco no sale, Escape cierra) y la hoja se
 * cierra arrastrando hacia abajo o cambia de prueba deslizando de lado.
 *
 * Enseña la versión publicada; si la vacante solo tiene borrador, el borrador
 * con «Borrador: todavía puede cambiar» y sin sus avisos ni «N por arreglar»,
 * que son del editor. La lectura es `VistaDeVersion`, la de siempre.
 */

import { useEffect, useRef, type PointerEvent as EventoDePuntero, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { rutas } from '@/rutas'
import { IconoAbrirFuera, IconoAnterior, IconoCopiar, IconoCruz, IconoDesplegar, IconoSiguiente } from '@/ui/Iconos'
import { ErrorApi } from '../api/cliente'
import type { EditorDePreguntas } from '../api/preguntasPropias'
import { verPrueba, type FilaDePrueba } from '../api/pruebas'
import { VistaDeVersion } from '../vacantes/preguntas/VistaDeVersion'
import { nivelParaLeer, nombreDeLaSituacion, partesDelResumen, PESTANAS, textoDeLaVersion, tipoDe, type Pestana } from './indice'
import { MarcasDeEstado, ResumenDeLaPrueba } from './piezas'
import { UsarEnOtraVacante } from './UsarEnOtraVacante'
import type { ModoDeLectura } from './useModoDeLectura'
import estilos from './Pruebas.module.css'

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'

interface Props {
  modo: ModoDeLectura
  /** Si está abierta: cerrada sigue montada (fuera de la vista) para poder animar la salida. */
  abierta: boolean
  vacanteId: number | null
  /** La fila de la lista, si sigue en ella. */
  fila: FilaDePrueba | null
  pestana: Pestana
  posicion: { indice: number; total: number }
  conCopia: boolean
  /** Abrir y cerrar sin animar: lo que se hace con el teclado no se anima. */
  sinTransicion: boolean
  alCerrar: (conTeclado: boolean) => void
  alMover: (paso: 1 | -1) => void
  alAlternarCopia: () => void
  /** «Cancelar» del bloque: lo pliega como Escape, con el foco de vuelta en «Usar en otra vacante». */
  alCerrarCopia: () => void
  alCopiar: (destino: number, editor: EditorDePreguntas) => void
  /** La vacante ya no existe (404): la lista se refresca. */
  alDesaparecer: () => void
}

export function Lectura({
  modo,
  abierta,
  vacanteId,
  fila,
  pestana,
  posicion,
  conCopia,
  sinTransicion,
  alCerrar,
  alMover,
  alAlternarCopia,
  alCerrarCopia,
  alCopiar,
  alDesaparecer,
}: Props) {
  const tipo = tipoDe(pestana)
  const caja = useRef<HTMLElement>(null)
  const cuerpo = useRef<HTMLDivElement>(null)
  const modal = abierta && modo !== 'lado'

  const previa = useQuery({
    queryKey: ['panel-pruebas-previa', tipo, vacanteId],
    queryFn: () => verPrueba(vacanteId!, tipo),
    enabled: vacanteId !== null,
    retry: false,
  })
  const yaNoExiste = previa.error instanceof ErrorApi && previa.error.estado === 404

  // La lista se refresca una vez por vacante que desaparece.
  const avisada = useRef<number | null>(null)
  useEffect(() => {
    if (yaNoExiste && vacanteId !== null && avisada.current !== vacanteId) {
      avisada.current = vacanteId
      alDesaparecer()
    }
  }, [yaNoExiste, vacanteId, alDesaparecer])

  // Cada prueba se lee desde arriba.
  useEffect(() => {
    if (cuerpo.current) cuerpo.current.scrollTop = 0
  }, [vacanteId])

  // Modal: el foco no sale de la hoja. Al abrirla va al título (lo hace quien la abre).
  useEffect(() => {
    if (!modal) return
    function alPulsar(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !caja.current) return
      const dentro = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (dentro.length === 0) return
      const primero = dentro[0]!
      const ultimo = dentro[dentro.length - 1]!
      if (!caja.current.contains(document.activeElement)) {
        e.preventDefault()
        primero.focus()
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alPulsar)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = antes
    }
  }, [modal])

  const arrastre = useArrastre(caja, modo, alCerrar, alMover)

  const clases = [estilos.lectura, estilos[`lectura_${modo}`], abierta ? estilos.lecturaAbierta : '', sinTransicion ? estilos.sinTransicion : '']
    .filter(Boolean)
    .join(' ')

  const rutaDelEditor = (id: number) => (pestana === 'prueba' ? rutas.adminPruebaPropia(id) : rutas.adminPreguntasPropias(id))
  const puedeCopiar = !!fila?.puedeUsarEnOtra && !!previa.data && previa.data.estado === 'PUBLICADA'

  let contenido: ReactNode = null
  if (vacanteId !== null) {
    if (yaNoExiste) {
      contenido = (
        <div className={estilos.marcoLectura}>
          <h2 className={estilos.tituloVacio} id="lectura-titulo" tabIndex={-1} data-titulo-lectura="">
            Esta vacante ya no existe
          </h2>
          <div className={estilos.botonesMarco}>
            <button className={estilos.secundario} type="button" onClick={() => alCerrar(false)}>
              Volver a la lista
            </button>
          </div>
        </div>
      )
    } else {
      contenido = (
        <>
          <p className={estilos.antetitulo}>
            <span className={estilos.datos}>
              <span className={estilos.dato}>{PESTANAS.find((p) => p.clave === pestana)!.nombre}</span>
              {fila && <span className={estilos.dato}>{nivelParaLeer(fila.nivel)}</span>}
              {fila && <span className={estilos.dato}>Situación: {nombreDeLaSituacion(fila.situacion)}</span>}
            </span>
          </p>
          <h2 className={estilos.tituloLectura} id="lectura-titulo" tabIndex={-1} data-titulo-lectura="">
            {fila ? fila.titulo : 'Vista previa'}
            {fila?.sede && <span className={estilos.sede}> {fila.sede}</span>}
          </h2>
          {fila && (
            <div className={estilos.subtitulo}>
              <MarcasDeEstado fila={fila} />
              <span>
                <ResumenDeLaPrueba partes={partesDelResumen(fila, pestana)} />
              </span>
              <span>{textoDeLaVersion(fila)}</span>
            </div>
          )}
          <div className={estilos.accionesLectura}>
            <Link className={estilos.secundario} to={rutaDelEditor(vacanteId)}>
              <IconoAbrirFuera tamano={18} />
              Abrir en la vacante
            </Link>
            {puedeCopiar && (
              <button
                className={estilos.acento}
                type="button"
                aria-expanded={conCopia}
                aria-controls="bloque-de-copia"
                onClick={alAlternarCopia}
              >
                <IconoCopiar tamano={18} />
                Usar en otra vacante
              </button>
            )}
          </div>
          {puedeCopiar && conCopia && fila && (
            <div id="bloque-de-copia" className={estilos.envolturaCopia}>
              <UsarEnOtraVacante tipo={tipo} origen={fila} alCancelar={alCerrarCopia} alCopiar={alCopiar} />
            </div>
          )}
          {previa.isPending && (
            <div className={estilos.cargaLectura} aria-busy="true">
              <p className={estilos.estadoCopia}>
                <span className={estilos.giro} aria-hidden="true" />
                Cargando la vista previa…
              </p>
              <div className={`${estilos.barraCarga} ${estilos.barraLarga}`} />
              <div className={`${estilos.barraCarga} ${estilos.barraCorta}`} />
              <div className={`${estilos.barraCarga} ${estilos.barraLarga}`} />
            </div>
          )}
          {previa.isError && !yaNoExiste && (
            <div className={estilos.avisoMalo} role="alert">
              <span>No se pudo cargar la vista previa.</span>
              <button
                className={estilos.secundario}
                type="button"
                disabled={previa.isFetching}
                onClick={() => void previa.refetch()}
              >
                {previa.isFetching ? 'Reintentando…' : 'Reintentar'}
              </button>
            </div>
          )}
          {previa.data && (
            <>
              {previa.data.estado === 'BORRADOR' && <p className={estilos.notaBorrador}>Borrador: todavía puede cambiar</p>}
              <div className={estilos.vistaDeVersion}>
                <VistaDeVersion version={previa.data} enColumnas />
              </div>
            </>
          )}
        </>
      )
    }
  }

  return (
    <>
      {modo === 'hoja' && (
        <div
          className={[estilos.velo, abierta ? estilos.veloVisible : '', sinTransicion ? estilos.sinTransicion : ''].filter(Boolean).join(' ')}
          aria-hidden="true"
          onClick={() => alCerrar(false)}
        />
      )}
      <section
        ref={caja}
        className={clases}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal ? true : undefined}
        aria-labelledby="lectura-titulo"
        aria-hidden={abierta ? undefined : true}
        inert={!abierta}
        id="lectura"
        tabIndex={-1}
      >
        <div className={estilos.cabeceraLectura} {...arrastre}>
          {modo !== 'lado' && <div className={estilos.asa} aria-hidden="true" />}
          <div className={estilos.barraLectura}>
            <button className={estilos.fantasma} type="button" onClick={(e) => alCerrar(e.detail === 0)}>
              {modo === 'lado' ? <IconoCruz tamano={18} /> : <IconoDesplegar tamano={18} />}
              {modo === 'lado' ? 'Cerrar' : 'Volver'}
              <kbd className={estilos.tecla} aria-hidden="true">
                Esc
              </kbd>
            </button>
            {modo !== 'lado' && (
              <div className={estilos.paginador}>
                <button
                  className={estilos.botonIcono}
                  type="button"
                  aria-label="Anterior"
                  disabled={posicion.indice <= 0}
                  onClick={() => alMover(-1)}
                >
                  <IconoAnterior />
                </button>
                <span className={estilos.numero}>
                  {posicion.indice >= 0 ? posicion.indice + 1 : '–'} / {posicion.total}
                </span>
                <button
                  className={estilos.botonIcono}
                  type="button"
                  aria-label="Siguiente"
                  disabled={posicion.indice < 0 || posicion.indice >= posicion.total - 1}
                  onClick={() => alMover(1)}
                >
                  <IconoSiguiente />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={estilos.cuerpoLectura} ref={cuerpo}>
          {contenido}
        </div>
      </section>
    </>
  )
}

/**
 * Los gestos de la hoja (no en la columna de al lado): hacia abajo la cierra y
 * de lado cambia de prueba. Se arrastra desde la cabecera, nunca desde un botón.
 */
function useArrastre(
  caja: React.RefObject<HTMLElement | null>,
  modo: ModoDeLectura,
  alCerrar: (conTeclado: boolean) => void,
  alMover: (paso: 1 | -1) => void,
) {
  const inicio = useRef<{ x: number; y: number; t: number; eje: 'x' | 'y' | null; id: number } | null>(null)

  function alBajar(e: EventoDePuntero<HTMLDivElement>) {
    if (modo === 'lado' || (e.target as HTMLElement).closest('button, a, input, label')) return
    inicio.current = { x: e.clientX, y: e.clientY, t: performance.now(), eje: null, id: e.pointerId }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function alMoverPuntero(e: EventoDePuntero<HTMLDivElement>) {
    const i = inicio.current
    if (!i || e.pointerId !== i.id || !caja.current) return
    const dx = e.clientX - i.x
    const dy = e.clientY - i.y
    if (!i.eje && Math.hypot(dx, dy) > 6) i.eje = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x'
    if (!i.eje) return
    caja.current.classList.add(estilos.arrastrando!)
    caja.current.style.transform = i.eje === 'y' ? `translateY(${dy < 0 ? dy / 5 : dy}px)` : `translateX(${dx * 0.4}px)`
  }

  function alSoltar(e: EventoDePuntero<HTMLDivElement>) {
    const i = inicio.current
    if (!i || e.pointerId !== i.id) return
    inicio.current = null
    const dx = e.clientX - i.x
    const dy = e.clientY - i.y
    const dt = Math.max(1, performance.now() - i.t)
    if (caja.current) {
      caja.current.classList.remove(estilos.arrastrando!)
      caja.current.style.transform = ''
    }
    const alto = caja.current?.offsetHeight ?? 0
    if (i.eje === 'y' && (dy > alto * 0.25 || (dy / dt > 0.11 && dy > 20))) alCerrar(false)
    else if (i.eje === 'x' && (Math.abs(dx) > 80 || (Math.abs(dx) / dt > 0.3 && Math.abs(dx) > 30))) alMover(dx < 0 ? 1 : -1)
  }

  return { onPointerDown: alBajar, onPointerMove: alMoverPuntero, onPointerUp: alSoltar, onPointerCancel: alSoltar }
}
