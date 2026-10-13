/**
 * La nota mínima del Perfil Integral para pasar sola a la prueba (V72).
 *
 * Vive en «Cómo avanza esta vacante», debajo del interruptor del que depende: con
 * «Calificar y avanzar sola» encendido, quien llega a esta nota pasa sola a la prueba del
 * puesto, y quien no llega espera a que alguien del equipo decida. Apagado, no hace nada, y
 * por eso el campo se ve desactivado —en gris, no solo `disabled`— y la ayuda lo dice.
 *
 * ⚠️ **Mira `puedeConfigurarElPase`, no `puedeEditar`.** Se fija con el mismo permiso que el
 * interruptor (`elegir_plantilla_evaluacion`, no `editar_vacante`), y la vacante lo trae
 * calculado igual que esos endpoints. Sin él, el campo se ve desactivado y en gris como con el
 * interruptor apagado (casos límite: «sin permiso, el campo se ve desactivado»). Mirar
 * `puedeEditar` dejaba a RESPONSABLE_AREA con la mínima bloqueada, aunque la API le deja
 * fijarla. El interruptor no cambia: sigue sin mirar permisos.
 *
 * ⚠️ **Se guarda al salir del campo, no al escribir.** Cada tecla es un valor distinto
 * —`6`, `65`— y guardar al vuelo mandaría los dos. Al salir solo se manda si cambió y es un
 * entero de 0 a 100; si no, se dice debajo y no se manda nada.
 *
 * ⚠️ **Lo escrito sin guardar se descarta en cuanto el campo deja de poder editarse**
 * (interruptor apagado, vacante cerrada, sin permiso): desactivado enseña la mínima guardada.
 * Si no, un «101» rechazado se quedaba en gris y sin aviso, como si fuera la mínima (QA-F02).
 *
 * ⚠️ **La mínima guarda por turnos con el resto de la tuerca** ({@link turnoDeLaVacante}).
 * Escribir la mínima y pulsar el interruptor, o «Sin evaluación» justo debajo, es un solo
 * gesto: salir del campo es pulsarlo, y las dos peticiones salían en el mismo milisegundo. En
 * turno, la mínima se guarda y luego lo otro (QA-F04, QA-F05).
 */

import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { fijarNotaMinima } from '../api/panel'
import type { VacantePanel } from '../api/tipos'
import estilos from './Vacante.module.css'
import { turnoDeLaVacante } from './turnoDeLaVacante'

/** La de toda vacante que no fijó otra; el backend nace con la misma (V72). */
export const NOTA_MINIMA_POR_DEFECTO = 60

export const AYUDA_NOTA_MINIMA =
  'Quien llegue a esta nota en el Perfil Integral pasa sola a la prueba del puesto. Quien no llegue espera a que alguien del equipo decida.'

/** La ayuda con el interruptor apagado: ahí la mínima no hace nada. */
export const AYUDA_APAGADA = 'Solo se usa con «Calificar y avanzar sola» encendido.'

export const FUERA_DE_RANGO = 'Escribe un número de 0 a 100'

export const NO_SE_GUARDO = 'No se pudo guardar la nota mínima'

/** Un entero de 0 a 100, o `null` si lo escrito no lo es. */
export function notaMinimaValida(escrita: string): number | null {
  const limpia = escrita.trim()
  if (limpia === '') return null
  const numero = Number(limpia)
  return Number.isInteger(numero) && numero >= 0 && numero <= 100 ? numero : null
}

export function NotaMinimaDelPase({
  vacante,
  alGuardar,
  alFallar,
}: {
  vacante: VacantePanel
  /** Para releer la vacante: la mínima que se ve es la que el servidor guardó. */
  alGuardar: () => void
  /** El mismo aviso de error que el interruptor, al pie de la configuración. */
  alFallar: (mensaje: string) => void
}) {
  const id = useId()
  const guardada = vacante.notaMinima ?? NOTA_MINIMA_POR_DEFECTO
  const apagada = !vacante.calificacionAutomatica
  // Solo con el interruptor encendido, sin cerrar y con el permiso del pase. Mientras guarda
  // también se desactiva, pero sin el gris: un parpadeo de «apagado» al guardar diría algo
  // que no pasa.
  const noSeEdita =
    apagada || vacante.estado === 'CERRADA' || !vacante.puedeConfigurarElPase

  // El borrador vuelve a la guardada cuando ella cambia y cuando el campo deja (o vuelve) de
  // poder editarse. Se ajusta al pintar y no en un efecto: con un efecto, el «101» se vería
  // un instante en gris antes de irse.
  const [escrita, setEscrita] = useState(String(guardada))
  const [borradorDe, setBorradorDe] = useState({ guardada, noSeEdita })
  if (borradorDe.guardada !== guardada || borradorDe.noSeEdita !== noSeEdita) {
    setBorradorDe({ guardada, noSeEdita })
    setEscrita(String(guardada))
  }

  const guardar = useMutation({
    mutationFn: (nota: number) => fijarNotaMinima(vacante.id, nota),
    scope: turnoDeLaVacante(vacante.id),
    onSuccess: alGuardar,
    onError: (causa: unknown) =>
      alFallar(
        causa instanceof Error && causa.message
          ? `${NO_SE_GUARDO}: ${causa.message}`
          : `${NO_SE_GUARDO}.`,
      ),
  })

  const desactivada = noSeEdita || guardar.isPending
  const nota = notaMinimaValida(escrita)
  // Un error que no se puede corregir no se enseña: desactivado, no hay nada que arreglar
  const fueraDeRango = nota === null && !noSeEdita

  const alSalir = () => {
    if (nota === null || nota === guardada) return
    guardar.mutate(nota)
  }

  return (
    <div
      className={`${estilos.ajuste} ${estilos.notaMinima}${noSeEdita ? ` ${estilos.notaMinimaApagada}` : ''}`}
    >
      <label className={estilos.etiquetaAjuste} htmlFor={`${id}-nota`}>
        Nota mínima para pasar el perfil integral
      </label>
      <span className={estilos.filaNotaMinima}>
        <input
          id={`${id}-nota`}
          className={estilos.eleccion}
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={escrita}
          onChange={(e) => setEscrita(e.target.value)}
          onBlur={alSalir}
          disabled={desactivada}
          aria-invalid={fueraDeRango}
          aria-describedby={`${id}-ayuda`}
        />
        <span className={estilos.deCien} aria-hidden="true">
          / 100
        </span>
        {guardar.isPending && (
          <span className={estilos.ayudaAjuste} role="status">
            Guardando…
          </span>
        )}
      </span>
      <span
        id={`${id}-ayuda`}
        className={fueraDeRango ? estilos.ayudaAjusteMala : estilos.ayudaAjuste}
        role={fueraDeRango ? 'alert' : undefined}
      >
        {apagada ? AYUDA_APAGADA : fueraDeRango ? FUERA_DE_RANGO : AYUDA_NOTA_MINIMA}
      </span>
    </div>
  )
}
