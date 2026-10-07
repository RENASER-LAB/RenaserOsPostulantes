/**
 * Una vacante en la lista de `/vacantes`: la tarjeta «Expresiva», elegida el
 * 06/10/2026 entre cuatro en un prototipo (la anterior, la «actual» del 01/10,
 * llevaba insignias grises y un tinte con flecha en la elegida).
 *
 * Color con oficio: el avatar de la empresa con su tono —siempre el mismo para
 * la misma empresa—, la modalidad en una pastilla de color —Remoto verde,
 * Híbrido índigo, Presencial gris— y el sueldo publicado en verde con su
 * billete. El sueldo se dice siempre: `OCULTA` se nombra, no se esconde.
 * «Nueva» si se publicó en los últimos tres días. Sin borde: la tarjeta flota
 * con una sombra corta, y la elegida lleva una sombra más honda y el título en
 * índigo —sin contorno ni brillo de color, que se leía como neón—.
 *
 * Es **un solo enlace** cuyo nombre es el título (`aria-labelledby`), y el
 * título es el `TituloQueViaja` que cruza hasta la ficha. Con la pantalla
 * partida el clic no navega: elige la vacante para el panel de la derecha.
 */

import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { rutas } from '@/rutas'
import { IconoBillete, IconoEdificio, IconoReloj, IconoUbicacion } from '@/ui/Iconos'
import { TituloQueViaja } from '@/ui/movimiento'
import { Badge } from '@/ui/shadcn/badge'
import { cn } from '@/ui/shadcn/utils'
import { datosDeLaTarjeta, inicialesDe, recortado, resumenDe } from './busqueda'

/** La sombra de las superficies de `/vacantes`: corta, con un filo de 1 px casi transparente en lugar de borde. */
export const SOMBRA_DE_SUPERFICIE = 'shadow-[0_1px_2px_rgb(10_10_10/0.06),0_0_0_1px_rgb(10_10_10/0.04)]'

/** Remoto verde, Híbrido índigo, Presencial gris. Lo que no sea una de las tres, gris. */
const TONO_DE_MODALIDAD: Record<string, string> = {
  Remoto: 'bg-bien-bruma text-bien',
  Híbrido: 'bg-primary/10 text-primary-hover',
  Presencial: 'bg-muted text-tinta2',
}

export function FilaDeVacante({
  vacante,
  publicada,
  nueva = false,
  alAbrir,
  alElegir,
  elegida = false,
}: {
  vacante: VacantePublica
  /** «Publicada hace 3 días», ya escrito, o nada. */
  publicada?: string | null
  /** Publicada en los últimos tres días: lleva «Nueva». */
  nueva?: boolean
  /** Al abrir la ficha: la lista apunta a qué tarjeta volver. */
  alAbrir?: () => void
  /**
   * Con la pantalla partida: el clic elige en vez de navegar. `porTeclado` es
   * `true` si se pulsó con Intro, para llevar el foco al panel. Con Ctrl, Cmd o
   * Mayús el enlace se abre como siempre: por eso sigue siendo un enlace.
   */
  alElegir?: (porTeclado: boolean) => void
  /** La que se lee en el panel. */
  elegida?: boolean
}) {
  const empresa = recortado(vacante.nombreEmpresa)
  const resumen = resumenDe(vacante)
  const datos = datosDeLaTarjeta(vacante)
  const idTitulo = `vacante-${vacante.id}-titulo`

  function alPulsar(evento: MouseEvent<HTMLAnchorElement>) {
    const conModificador = evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey
    if (alElegir && evento.button === 0 && !conModificador) {
      evento.preventDefault()
      // Intro sobre un enlace dispara un clic con `detail` 0: no hubo puntero.
      alElegir(evento.detail === 0)
      return
    }
    alAbrir?.()
  }

  return (
    <Link
      to={rutas.vacante(vacante.id)}
      aria-labelledby={idTitulo}
      aria-current={elegida ? 'true' : undefined}
      state={alElegir ? undefined : { desdeLaLista: true }}
      onClick={alPulsar}
      className={cn(
        'relative block rounded-2xl bg-card p-4 text-card-foreground no-underline [-webkit-tap-highlight-color:transparent]',
        SOMBRA_DE_SUPERFICIE,
        'transition-[box-shadow,scale] duration-200 ease-out motion-safe:active:scale-[0.98]',
        'hover:shadow-[0_4px_12px_rgb(10_10_10/0.08),0_0_0_1px_rgb(10_10_10/0.06)]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        // Sin levantarse: la primera, elegida, sigue a la altura del panel.
        elegida &&
          'shadow-[0_10px_24px_rgb(10_10_10/0.10),0_0_0_1px_rgb(10_10_10/0.06)] hover:shadow-[0_10px_24px_rgb(10_10_10/0.10),0_0_0_1px_rgb(10_10_10/0.06)]',
      )}
    >
      <div className="flex items-start gap-3">
        <Iniciales empresa={empresa} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <TituloQueViaja
              id={vacante.id}
              idDom={idTitulo}
              className={cn(
                'm-0 text-base leading-snug font-semibold tracking-tight text-foreground transition-colors duration-150 [overflow-wrap:anywhere]',
                elegida && 'text-primary-hover',
              )}
            >
              {vacante.titulo}
            </TituloQueViaja>
            {nueva && (
              <span className="mt-0.5 shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                Nueva
              </span>
            )}
          </div>
          {empresa && <p className="m-0 mt-0.5 text-sm text-tinta2 [overflow-wrap:anywhere]">{empresa}</p>}
          {/* En su línea: detrás de «RENASER CONSULTING S.A.C.» se partía en «hace 4 / semanas». */}
          {publicada && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{publicada}</p>}
          {!alElegir && resumen && (
            <p className="mt-2 line-clamp-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{resumen}</p>
          )}
        </div>
      </div>
      {/* Alineado con el texto, no con el avatar: 44 px de avatar y 12 de hueco. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 pl-14">
        {datos.modalidad && (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold [overflow-wrap:anywhere]',
              TONO_DE_MODALIDAD[datos.modalidad] ?? 'bg-muted text-tinta2',
            )}
          >
            {datos.modalidad}
          </span>
        )}
        {datos.donde && (
          <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-tinta2 [overflow-wrap:anywhere]">
            <IconoUbicacion tamano={14} />
            {datos.donde}
          </span>
        )}
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1 text-[13px] [overflow-wrap:anywhere]',
            datos.sueldo.publicado ? 'font-semibold text-bien' : 'text-muted-foreground',
          )}
        >
          <IconoBillete tamano={14} />
          {datos.sueldo.texto}
        </span>
      </div>
    </Link>
  )
}

/** Tonos del mundo para el avatar: índigo, verde, ámbar y gris. */
const TONOS_DE_EMPRESA = [
  'bg-primary/12 text-primary-hover',
  'bg-bien-bruma text-bien',
  'bg-duda-bruma text-duda-tinta',
  'bg-nube-honda text-tinta2',
]

/** El mismo tono para la misma empresa, en la lista y en el panel. */
function tonoDe(empresa: string | null): string {
  let h = 0
  for (const c of empresa ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONOS_DE_EMPRESA[h % TONOS_DE_EMPRESA.length]!
}

/**
 * El avatar de la empresa: redondo y con su tono. Decorativo: el nombre ya va
 * escrito al lado. Si un día el backend trae el logotipo, va aquí.
 */
export function Iniciales({ empresa, grande = false }: { empresa: string | null; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        tonoDe(empresa),
        grande ? 'size-14 text-lg' : 'size-11 text-sm',
      )}
    >
      {inicialesDe(empresa) || '·'}
    </span>
  )
}

/** Dónde, modalidad, horario y sueldo, en insignias. Lo que falta no se pinta; el sueldo, siempre. */
export function DatosDeLaVacante({ vacante, className }: { vacante: VacantePublica; className?: string }) {
  const datos = datosDeLaTarjeta(vacante)
  // Las de shadcn no parten (`whitespace-nowrap`): una zona de 60 letras sacaba la fila de su ancho.
  const insignia =
    'h-auto min-h-6 max-w-full shrink justify-start gap-1.5 rounded-md px-2 py-0.5 text-left text-xs font-medium whitespace-normal [overflow-wrap:anywhere] [&>svg]:size-3.5'
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {datos.donde && (
        <Badge variant="secondary" className={cn(insignia, 'text-tinta2')}>
          <IconoUbicacion tamano={14} />
          {datos.donde}
        </Badge>
      )}
      {datos.modalidad && (
        <Badge variant="secondary" className={cn(insignia, 'text-tinta2')}>
          <IconoEdificio tamano={14} />
          {datos.modalidad}
        </Badge>
      )}
      {datos.horario && (
        <Badge variant="secondary" className={cn(insignia, 'text-tinta2')}>
          <IconoReloj tamano={14} />
          {datos.horario}
        </Badge>
      )}
      <Badge
        variant="outline"
        className={cn(
          insignia,
          datos.sueldo.publicado ? 'border-primary/30 bg-primary/5 text-primary-hover' : 'text-muted-foreground',
        )}
      >
        <IconoBillete tamano={14} />
        {datos.sueldo.texto}
      </Badge>
    </div>
  )
}
