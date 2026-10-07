/**
 * La vacante elegida, a la derecha de la lista de `/vacantes` con la pantalla
 * partida (desde 1024 px, 01/10/2026), con las piezas de shadcn/ui.
 *
 * Dice lo mismo que la ficha —`GET /vacantes` trae lo mismo que
 * `GET /vacantes/{id}`, así que no pide nada— con el orden de una bolsa de
 * empleo: arriba quién, dónde y «Postular»; debajo, lo que se lee. Los
 * requisitos indispensables van en ámbar, como en la ficha: al postular hay que
 * confirmarlos uno por uno, y no cumplir alguno cierra la postulación.
 *
 * ⚠️ **El título NO es el `TituloQueViaja`.** La tarjeta de la izquierda ya
 * lleva ese `layoutId`, y dos a la vez en pantalla hacen que motion anime uno
 * sobre el otro. Aquí es un `h2` quieto, que recibe el foco si la vacante se
 * eligió con Intro.
 */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { Button } from '@/ui/shadcn/button'
import { Separator } from '@/ui/shadcn/separator'
import { cn } from '@/ui/shadcn/utils'
import { puntosDe, recortado } from './busqueda'
import { DatosDeLaVacante, Iniciales, SOMBRA_DE_SUPERFICIE } from './FilaDeVacante'

export function PanelDeVacante({
  vacante: v,
  publicada,
  idTitulo,
  contenedor,
}: {
  vacante: VacantePublica
  publicada?: string | null
  idTitulo: string
  /** Lo que se desplaza: con él, la barra de «Postular» sabe cuándo el botón de arriba salió de la vista. */
  contenedor?: RefObject<HTMLElement | null>
}) {
  const { hayCuenta } = useSesion()
  const destino = hayCuenta ? rutas.postular(v.id) : rutas.registro(v.id)
  const postular = useRef<HTMLDivElement>(null)
  const [conBarra, setConBarra] = useState(false)

  /*
    La barra de arriba (05/10/2026): al bajar por una vacante larga, el título
    y «Postular» se quedan pegados arriba del panel, como en LinkedIn. Sale
    cuando el botón de la cabecera se va por arriba —no por abajo— y se va en
    cuanto vuelve a verse.
  */
  useEffect(() => {
    const raiz = contenedor?.current
    const boton = postular.current
    if (!raiz || !boton || typeof IntersectionObserver !== 'function') return
    const observador = new IntersectionObserver(
      ([e]) => {
        if (!e) return
        const arriba = e.rootBounds ? e.boundingClientRect.top < e.rootBounds.top : false
        setConBarra(!e.isIntersecting && arriba)
      },
      { root: raiz },
    )
    observador.observe(boton)
    return () => observador.disconnect()
  }, [contenedor])

  const empresa = recortado(v.nombreEmpresa)
  const requisitos = Array.isArray(v.requisitosObjetivos) ? v.requisitosObjetivos : []
  const proposito = recortado(v.proposito)
  const descripcion = recortado(v.descripcion)

  return (
    // Al cambiar de vacante el panel se monta de nuevo (`key`) y entra con un fundido de 150 ms
    // (05/10/2026): sin él, el texto de la anterior se cambiaba de golpe y parecía un parpadeo.
    // Solo opacidad: se elige vacante muchas veces seguidas y un desplazamiento cansaría.
    // Como las tarjetas de la lista (06/10/2026): sin borde y con su misma sombra, al mismo nivel.
    <div className={cn('animate-in fade-in-0 duration-150 ease-out rounded-2xl bg-card text-card-foreground', SOMBRA_DE_SUPERFICIE)}>
      {/*
        Pegada arriba con alto cero, y la barra encima del contenido: así
        aparecer no empuja el texto. Entra deslizándose 8 px desde arriba y se
        va al instante.
      */}
      <div className="sticky top-0 z-10 h-0">
        {conBarra && (
          <div className="absolute inset-x-0 top-0 flex items-center gap-4 rounded-t-2xl border-b border-border bg-card/90 px-6 py-3 backdrop-blur-md animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out motion-reduce:slide-in-from-top-0 lg:px-8">
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-base font-semibold tracking-tight text-foreground">{v.titulo}</p>
              {empresa && <p className="m-0 truncate text-sm text-muted-foreground">{empresa}</p>}
            </div>
            <Button asChild className="h-9 shrink-0 px-4 text-sm no-underline hover:bg-primary-hover">
              <Link to={destino}>Postular</Link>
            </Button>
          </div>
        )}
      </div>
      <div className="p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <Iniciales empresa={empresa} grande />
          <div className="min-w-0 flex-1">
            <h2
              id={idTitulo}
              tabIndex={-1}
              className="m-0 rounded-sm text-2xl leading-tight font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {v.titulo}
            </h2>
            {empresa && <p className="mt-1 text-base text-tinta2">{empresa}</p>}
            {publicada && <p className="mt-1 text-sm text-muted-foreground">{publicada}</p>}
          </div>
        </div>

        <DatosDeLaVacante vacante={v} className="mt-5" />

        <div ref={postular} className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild className="h-11 px-6 text-sm no-underline hover:bg-primary-hover">
            <Link to={destino}>Postular a este puesto</Link>
          </Button>
          <p className="max-w-[40ch] text-sm text-muted-foreground">
            {hayCuenta
              ? 'Te pediremos tu currículum y un resultado del que te sientas orgulloso.'
              : 'Si aún no tienes cuenta, la creas en el siguiente paso.'}
          </p>
        </div>
      </div>

      <Separator className="bg-border" />

      <div className="flex flex-col gap-8 p-6 lg:p-8">
        {proposito ? (
          <Bloque titulo="El resultado que esperamos">
            <p className="whitespace-pre-line">{proposito}</p>
          </Bloque>
        ) : (
          descripcion && (
            <Bloque titulo="Sobre el puesto">
              <p className="whitespace-pre-line">{descripcion}</p>
            </Bloque>
          )
        )}
        {recortado(v.responsabilidades) && (
          <Bloque titulo="Lo que harás">
            <Puntos texto={v.responsabilidades!} />
          </Bloque>
        )}
        {recortado(v.requisitos) && (
          <Bloque titulo="Lo que buscamos">
            <Puntos texto={v.requisitos!} />
          </Bloque>
        )}

        {requisitos.length > 0 && (
          <section className="rounded-lg border border-duda/25 bg-duda-bruma p-5 text-duda-tinta">
            <h3 className="m-0 text-base font-semibold">Requisitos indispensables</h3>
            <p className="mt-2 text-sm leading-relaxed">
              Al postular te pediremos que confirmes cada uno, y <b>no cumplir alguno cierra la postulación</b>.
              Léelos antes de empezar.
            </p>
            <ul role="list" className="mt-4 flex flex-col gap-2.5">
              {requisitos.map((r) => (
                <li key={r.id} className="relative pl-4 text-sm leading-relaxed">
                  <span aria-hidden="true" className="absolute top-[0.55em] left-0 size-1.5 bg-duda" />
                  {r.descripcion}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="m-0 text-lg font-semibold tracking-tight text-foreground">{titulo}</h3>
      <div className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-tinta2">{children}</div>
    </section>
  )
}

/** Un punto por línea; con uno solo, un párrafo. */
function Puntos({ texto }: { texto: string }) {
  const puntos = puntosDe(texto)
  if (puntos.length < 2) return <p className="whitespace-pre-line">{texto}</p>
  return (
    <ul role="list" className="flex flex-col gap-2.5">
      {puntos.map((punto, i) => (
        <li key={`${i}-${punto.slice(0, 20)}`} className="relative pl-4">
          <span aria-hidden="true" className="absolute top-[0.6em] left-0 size-1.5 rounded-full bg-border-strong" />
          {punto}
        </li>
      ))}
    </ul>
  )
}
