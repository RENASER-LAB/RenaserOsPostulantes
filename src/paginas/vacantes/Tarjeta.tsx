/**
 * La tarjeta de una vacante, en sus dos formas: de pie en la portada y a lo
 * ancho en la búsqueda.
 *
 * Es un solo enlace cuyo nombre es el título —`aria-labelledby` al `h3`—: leída
 * con un lector de pantalla la tarjeta dice «Ingeniero Civil Builder Junior», no
 * «Presencial Arequipa Ingeniero Civil Builder Junior RENASER Sueldo sin publicar».
 * Y en las dos el título es el mismo `TituloQueViaja`, que cruza hasta el
 * titular de la ficha.
 *
 * **De pie** (la portada, tres en fila): arriba, si existen, modalidad · ciudad
 * (o la zona, si no hay ciudad); después el título, la empresa y un resumen de
 * tres líneas como mucho; y un pie con el horario, el sueldo o «Sueldo sin
 * publicar», y «Publicada hace…» si se pasa.
 *
 * **A lo ancho** (`/vacantes`, una por fila): a la izquierda «Publicada hace…»,
 * el título, la empresa y el resumen en dos líneas; a la derecha, tras una
 * línea fina, una columna de datos con su icono —dónde, modalidad, horario y
 * sueldo—, y el dato que falta no se pinta. Es la forma para escanear una lista
 * larga: el ojo baja por los títulos y los datos quedan siempre en la misma
 * columna. Cuando la tarjeta es estrecha los datos bajan debajo del resumen; eso
 * lo decide su propio ancho, no el de la ventana (ver la hoja).
 */

import { Link } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { rutas } from '@/rutas'
import { IconoBillete, IconoEdificio, IconoReloj, IconoUbicacion } from '@/ui/Iconos'
import { TarjetaQueResponde, TituloQueViaja } from '@/ui/movimiento'
import { datosDeLaTarjeta, lineaDeLaTarjeta, recortado, resumenDe } from './busqueda'
import estilos from './Tarjeta.module.css'

export function Tarjeta({
  vacante,
  publicada,
  desdeLaLista,
  alAbrir,
  forma = 'dePie',
}: {
  vacante: VacantePublica
  /** «Publicada hace 3 días», ya escrito, o nada. */
  publicada?: string | null
  /**
   * Si se abre desde `/vacantes`: la ficha lo lee para que «← Volver a las
   * vacantes» vuelva a la lista tal como estaba, y no a una lista limpia.
   */
  desdeLaLista?: boolean
  alAbrir?: () => void
  /** `dePie` en la portada; `aLoAncho` en la lista de `/vacantes`. */
  forma?: 'dePie' | 'aLoAncho'
}) {
  // Casi todos los campos de la vacante pueden venir vacios —o con solo
  // espacios, que cuenta igual—, asi que se elige el primero que traiga algo en
  // vez de dar por hecho ninguno. El resumen sale de la misma regla que cuenta
  // la completitud en `busqueda.ts`: la tarjeta y el orden no discrepan.
  const resumen = resumenDe(vacante)
  const empresa = recortado(vacante.nombreEmpresa)
  const idTitulo = `vacante-${vacante.id}-titulo`
  const enlace = {
    to: rutas.vacante(vacante.id),
    'aria-labelledby': idTitulo,
    state: desdeLaLista ? { desdeLaLista: true } : undefined,
    onClick: alAbrir,
  }
  // B · este titulo viaja hasta el titular de la ficha.
  const titulo = (
    <TituloQueViaja id={vacante.id} idDom={idTitulo} className={estilos.tituloVacante}>
      {vacante.titulo}
    </TituloQueViaja>
  )

  if (forma === 'aLoAncho') {
    const datos = datosDeLaTarjeta(vacante)
    return (
      <TarjetaQueResponde className={`${estilos.vacante} ${estilos.aLoAncho}`}>
        <Link className={estilos.enlaceALoAncho} {...enlace}>
          <div className={estilos.cuerpo}>
            {publicada && <span className={estilos.cuando}>{publicada}</span>}
            {titulo}
            {empresa && <span className={estilos.empresa}>{empresa}</span>}
            {resumen && <p className={estilos.resumenCorto}>{resumen}</p>}
          </div>
          <div className={estilos.datos}>
            {datos.donde && (
              <span className={estilos.dato}>
                <IconoUbicacion tamano={16} className={estilos.iconoDato} />
                {datos.donde}
              </span>
            )}
            {datos.modalidad && (
              <span className={estilos.dato}>
                <IconoEdificio tamano={16} className={estilos.iconoDato} />
                {datos.modalidad}
              </span>
            )}
            {datos.horario && (
              <span className={estilos.dato}>
                <IconoReloj tamano={16} className={estilos.iconoDato} />
                {datos.horario}
              </span>
            )}
            {/* El sueldo publicado pesa: es lo que el ojo busca al bajar por la lista. */}
            <span className={`${estilos.dato} ${datos.sueldo.publicado ? estilos.sueldoPublicado : ''}`}>
              <IconoBillete tamano={16} className={estilos.iconoDato} />
              {datos.sueldo.texto}
            </span>
          </div>
        </Link>
      </TarjetaQueResponde>
    )
  }

  const donde = lineaDeLaTarjeta(vacante)
  const horario = recortado(vacante.horario)

  // D · la tarjeta se levanta al pasar por encima.
  return (
    <TarjetaQueResponde className={estilos.vacante}>
      <Link className={estilos.enlaceVacante} {...enlace}>
        {donde && <span className={estilos.etiqueta}>{donde}</span>}
        {titulo}
        {empresa && <span className={estilos.empresa}>{empresa}</span>}
        {resumen && <p className={estilos.queSeHace}>{resumen}</p>}
        <span className={estilos.pieVacante}>
          {horario && <span>{horario}</span>}
          {/*
            ⚠️ **Aqui NO va el `<Remuneracion>` compartido, y es a proposito.**
            Esa pieza es un bloque con su etiqueta, su matiz y su «actualizado
            el …»: lo que hace falta en la ficha, donde el sueldo es la mitad de
            un trato. En la tarjeta el sueldo es un dato mas del pie, al lado
            del horario, y el bloque entero rompe la fila.

            Lo que si se respeta es la regla de esa pieza: **`OCULTA` se nombra,
            no se esconde** —un hueco donde deberia ir el numero se lee como un
            fallo de carga—, y el monto **llega escrito del servidor**, asi que
            aqui no se formatea ningun numero.
          */}
          <span className={estilos.paga}>
            {!vacante.remuneracion || vacante.remuneracion.tipo === 'OCULTA'
              ? 'Sueldo sin publicar'
              : vacante.remuneracion.texto}
          </span>
          {publicada && <span className={estilos.fecha}>{publicada}</span>}
        </span>
      </Link>
    </TarjetaQueResponde>
  )
}
