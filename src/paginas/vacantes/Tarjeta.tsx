/**
 * La tarjeta de una vacante, la misma en la portada y en la búsqueda.
 *
 * Es un solo enlace cuyo nombre es el título —`aria-labelledby` al `h3`—: leída
 * con un lector de pantalla la tarjeta dice «Ingeniero Civil Builder Junior», no
 * «Presencial Arequipa Ingeniero Civil Builder Junior RENASER Sueldo sin publicar».
 *
 * Arriba, si existen, modalidad · ciudad (o la zona, si no hay ciudad); después el
 * título, la empresa y un resumen de tres líneas como mucho; y un pie con el
 * horario, el sueldo o «Sueldo sin publicar», y «Publicada hace…» si se pasa.
 */

import { Link } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { rutas } from '@/rutas'
import { TarjetaQueResponde, TituloQueViaja } from '@/ui/movimiento'
import { lineaDeLaTarjeta } from './busqueda'
import estilos from './Tarjeta.module.css'

export function Tarjeta({
  vacante,
  publicada,
  desdeLaLista,
  alAbrir,
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
}) {
  const donde = lineaDeLaTarjeta(vacante)
  // Casi todos los campos de la vacante pueden venir vacios, asi que se elige
  // el primero que traiga algo en vez de dar por hecho ninguno.
  const resumen = vacante.proposito ?? vacante.descripcion
  const idTitulo = `vacante-${vacante.id}-titulo`

  // D · la tarjeta se levanta al pasar por encima.
  return (
    <TarjetaQueResponde className={estilos.vacante}>
      <Link
        className={estilos.enlaceVacante}
        to={rutas.vacante(vacante.id)}
        aria-labelledby={idTitulo}
        state={desdeLaLista ? { desdeLaLista: true } : undefined}
        onClick={alAbrir}
      >
        {donde && <span className={estilos.etiqueta}>{donde}</span>}
        {/* B · este titulo viaja hasta el titular de la ficha. */}
        <TituloQueViaja id={vacante.id} idDom={idTitulo} className={estilos.tituloVacante}>
          {vacante.titulo}
        </TituloQueViaja>
        {vacante.nombreEmpresa && <span className={estilos.empresa}>{vacante.nombreEmpresa}</span>}
        {resumen && <p className={estilos.queSeHace}>{resumen}</p>}
        <span className={estilos.pieVacante}>
          {vacante.horario && <span>{vacante.horario}</span>}
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
