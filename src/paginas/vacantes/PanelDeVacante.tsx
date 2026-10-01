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

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { Button } from '@/ui/shadcn/button'
import { Separator } from '@/ui/shadcn/separator'
import { puntosDe, recortado } from './busqueda'
import { DatosDeLaVacante, Iniciales } from './FilaDeVacante'

export function PanelDeVacante({
  vacante: v,
  publicada,
  idTitulo,
}: {
  vacante: VacantePublica
  publicada?: string | null
  idTitulo: string
}) {
  const { hayCuenta } = useSesion()
  const empresa = recortado(v.nombreEmpresa)
  const requisitos = Array.isArray(v.requisitosObjetivos) ? v.requisitosObjetivos : []
  const proposito = recortado(v.proposito)
  const descripcion = recortado(v.descripcion)

  return (
    <div className="rounded-xl border border-border-strong bg-card text-card-foreground">
      <div className="p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <Iniciales empresa={empresa} grande />
          <div className="min-w-0 flex-1">
            <h2
              id={idTitulo}
              tabIndex={-1}
              className="m-0 rounded-sm text-2xl leading-tight font-semibold tracking-tight text-foreground break-words focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {v.titulo}
            </h2>
            {empresa && <p className="mt-1 text-base text-tinta2">{empresa}</p>}
            {publicada && <p className="mt-1 text-sm text-muted-foreground">{publicada}</p>}
          </div>
        </div>

        <DatosDeLaVacante vacante={v} className="mt-5" />

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button asChild className="h-11 px-6 text-sm no-underline hover:bg-primary-hover">
            <Link to={hayCuenta ? rutas.postular(v.id) : rutas.registro(v.id)}>Postular a este puesto</Link>
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
