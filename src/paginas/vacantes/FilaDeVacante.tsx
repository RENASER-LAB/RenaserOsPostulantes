/**
 * Una vacante en la lista de `/vacantes`, con las piezas de shadcn/ui (desde el
 * 01/10/2026; sustituye a la tarjeta «a lo ancho»).
 *
 * Como en LinkedIn: el cuadro con las iniciales de la empresa, el título, la
 * empresa y, debajo, los datos en insignias —dónde, modalidad, horario y
 * sueldo—. El sueldo se dice siempre: `OCULTA` se nombra, no se esconde.
 *
 * Es **un solo enlace** cuyo nombre es el título (`aria-labelledby`), y el
 * título es el `TituloQueViaja` que cruza hasta la ficha. Con la pantalla
 * partida el clic no navega: elige la vacante para el panel de la derecha.
 */

import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { rutas } from '@/rutas'
import { IconoBillete, IconoEdificio, IconoReloj, IconoSiguiente, IconoUbicacion } from '@/ui/Iconos'
import { TituloQueViaja } from '@/ui/movimiento'
import { Badge } from '@/ui/shadcn/badge'
import { cn } from '@/ui/shadcn/utils'
import { datosDeLaTarjeta, inicialesDe, recortado, resumenDe } from './busqueda'

export function FilaDeVacante({
  vacante,
  publicada,
  alAbrir,
  alElegir,
  elegida = false,
}: {
  vacante: VacantePublica
  /** «Publicada hace 3 días», ya escrito, o nada. */
  publicada?: string | null
  /** Al abrir la ficha: la lista apunta a qué tarjeta volver. */
  alAbrir?: () => void
  /**
   * Con la pantalla partida: el clic elige en vez de navegar. `porTeclado` es
   * `true` si se pulsó con Intro, para llevar el foco al panel. Con Ctrl, Cmd o
   * Mayús el enlace se abre como siempre: por eso sigue siendo un enlace.
   */
  alElegir?: (porTeclado: boolean) => void
  /** La que se lee en el panel: marcada en índigo, que es «dónde estás». */
  elegida?: boolean
}) {
  const empresa = recortado(vacante.nombreEmpresa)
  const resumen = resumenDe(vacante)
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
        'group relative flex gap-4 rounded-xl border border-border-strong bg-card p-4 text-card-foreground no-underline transition-[border-color,box-shadow,background-color] duration-200',
        'hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        // La elegida: fondo apenas tintado y la flecha hacia el panel (abajo), sin contorno (01/10/2026).
        elegida && 'bg-primary/[0.04] pr-10',
      )}
    >
      {/*
        La elegida apunta al panel: un «›» dentro, a la derecha, y un triángulo índigo
        que sale de su borde hacia el hueco entre la lista y el panel. Dice «esta es la
        que se lee ahí» sin rodear la fila entera.
      */}
      {elegida && (
        <>
          <IconoSiguiente
            tamano={20}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-primary-hover"
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-full h-4 w-2 -translate-y-1/2 bg-primary [clip-path:polygon(0_0,100%_50%,0_100%)]"
          />
        </>
      )}
      <Iniciales empresa={empresa} />
      <div className="min-w-0 flex-1">
        <TituloQueViaja
          id={vacante.id}
          idDom={idTitulo}
          className={cn(
            'm-0 text-base leading-snug font-semibold tracking-tight text-foreground break-words group-hover:text-primary-hover',
            elegida && 'text-primary-hover',
          )}
        >
          {vacante.titulo}
        </TituloQueViaja>
        {empresa && <p className="mt-0.5 text-sm text-tinta2">{empresa}</p>}
        {!alElegir && resumen && (
          <p className="mt-2 line-clamp-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            {resumen}
          </p>
        )}
        <DatosDeLaVacante vacante={vacante} className="mt-3" />
        {/* Abajo y en su línea: al lado del título lo partía en tres en la lista estrecha. */}
        {publicada && <p className="mt-3 text-xs text-muted-foreground tabular-nums">{publicada}</p>}
      </div>
    </Link>
  )
}

/**
 * El cuadro de la empresa. Decorativo: el nombre ya va escrito al lado. Si un
 * día el backend trae el logotipo, va aquí con `AvatarImage`.
 */
export function Iniciales({ empresa, grande = false }: { empresa: string | null; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary-hover',
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
  const insignia = 'h-6 gap-1.5 rounded-md px-2 text-xs font-medium [&>svg]:size-3.5'
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
