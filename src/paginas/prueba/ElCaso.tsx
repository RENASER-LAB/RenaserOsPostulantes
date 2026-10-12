/**
 * El caso de la prueba del editor en su lateral, y su vista de lectura.
 *
 * Hasta el 09/10/2026 el lateral enseñaba el caso entero: en una columna de 20rem, un caso
 * largo era un bloque continuo que obligaba a bajar sin fin mientras corría el reloj. Desde la
 * revisión humana de ese día el lateral enseña **el comienzo**, recortado a unas líneas, y
 * «Leer el caso completo» lo abre en una ventana de lectura: unos 70 caracteres por línea, la
 * letra del cuerpo, sus párrafos y saltos de línea, y el adjunto si lo hay. Se cierra con ✕ o con
 * Escape y el foco vuelve al botón (lo hace `Modal`); en el teléfono ocupa la pantalla.
 *
 * Un caso corto que cabe entero va entero y sin botón. El adjunto se ve siempre en el lateral.
 */

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '@/ui/Modal'
import { TextoPlano } from '@/ui/TextoPlano'
import marco from '../unaPorPantalla/Marco.module.css'
import { Consigna } from './Entregable'
import estilos from './Prueba.module.css'

/** Las líneas del caso que enseña el lateral. Es el `-webkit-line-clamp` de `.casoRecortado`. */
const LINEAS_DEL_LATERAL = 7

/**
 * Lo que cabe en una línea del lateral: 270 px de texto (20rem menos su relleno) a 16 px de
 * Geist, medido en el navegador con prosa en castellano —unos 35—, un poco a la baja.
 */
const CARACTERES_POR_LINEA = 34

/**
 * Si el caso no cabe en las líneas del lateral, estimado por su texto: cada línea escrita ocupa
 * lo que mida en líneas del lateral, y una en blanco cuenta como una. Es una estimación que no
 * depende de la maquetación, así que decide igual en el navegador y en las pruebas; cuando hay
 * maquetación, `useCabeEntero` la afina (un caso «largo» que en una columna ancha cabe entero
 * no lleva botón).
 */
function esCasoLargo(texto: string): boolean {
  const lineas = texto
    .trim()
    .split('\n')
    .reduce((suma, linea) => suma + Math.max(1, Math.ceil(linea.trim().length / CARACTERES_POR_LINEA)), 0)
  return lineas > LINEAS_DEL_LATERAL
}

/**
 * Si lo recortado cabe entero en su caja, medido. `null` cuando no se puede saber —sin
 * maquetación, como en jsdom—: entonces manda la estimación.
 */
function useCabeEntero(caja: RefObject<HTMLElement | null>, activo: boolean): boolean | null {
  const [cabe, setCabe] = useState<boolean | null>(null)
  useLayoutEffect(() => {
    const el = caja.current
    if (!activo || !el) {
      setCabe(null)
      return
    }
    let vivo = true
    const medir = () => {
      if (!vivo) return
      setCabe(el.clientHeight === 0 ? null : el.scrollHeight <= el.clientHeight + 1)
    }
    medir()
    // El ancho cambia al pasar del lateral a la barra plegable, y la letra puede llegar después.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(el)
    void document.fonts?.ready.then(medir)
    return () => {
      vivo = false
      observador?.disconnect()
    }
  }, [caja, activo])
  return cabe
}

export function CasoEnElLateral({
  enunciado,
  consigna,
}: {
  enunciado: string | null | undefined
  consigna: { nombre: string | null; url: string | null } | null | undefined
}) {
  const [leyendo, setLeyendo] = useState(false)
  const recorte = useRef<HTMLDivElement>(null)
  const texto = enunciado?.trim() ? enunciado : null
  const largo = texto !== null && esCasoLargo(texto)
  const cabe = useCabeEntero(recorte, largo)
  const conBoton = largo && cabe !== true

  return (
    <div className={estilos.parteLateral}>
      {texto && (
        <div ref={recorte} className={largo ? estilos.casoRecortado : undefined}>
          {/*
           * Recortado, sus enlaces salen del orden de Tab: uno bajo el recorte recibía el foco sin
           * verse y el navegador desplazaba el recorte, que se quedaba pintado encima de sí mismo
           * (QA-UPP-07). Con Tab se pasa a «Leer el caso completo», y en la ventana sí se tabulan.
           */}
          <TextoPlano
            texto={texto}
            queEs="el enunciado de la prueba"
            className={estilos.parrafoLateral}
            enlacesTabulables={!conBoton}
            listas
          />
        </div>
      )}
      {conBoton && (
        <button
          type="button"
          className={`${marco.mando} ${estilos.leerElCaso}`}
          aria-haspopup="dialog"
          onClick={() => setLeyendo(true)}
        >
          Leer el caso completo
        </button>
      )}
      {consigna && <Consigna consigna={consigna} />}

      {/* Fuera del lateral: es pegajoso y su contexto de apilado dejaría la ventana debajo de la barra. */}
      {texto &&
        leyendo &&
        createPortal(
          <Modal abierto titulo="El caso" onCerrar={() => setLeyendo(false)} pantallaCompleta sinPie aPruebaDeDobleClic>
            <TextoPlano texto={texto} queEs="el enunciado de la prueba" className={estilos.parrafoDeLectura} listas />
            {consigna && <Consigna consigna={consigna} />}
          </Modal>,
          document.body,
        )}
    </div>
  )
}
