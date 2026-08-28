/**
 * El paso que faltaba entre calificar la prueba y verla en el ranking.
 *
 * ⚠️ **Calificar con IA no deja nota en la columna.** El agente pone la nota de
 * cada criterio de la rubrica; la nota de la ETAPA —la que sale en el ranking y
 * con la que se ordena— nace solo de `POST .../prueba/calificacion`, que
 * pondera las que ya estan puestas. Ese endpoint existe desde siempre y no
 * estaba cableado, asi que quien calificaba con IA veia la rubrica llena y la
 * columna en blanco, sin nada que pulsar.
 *
 * Comprobado en la base local: la postulacion 16 tenia sus **siete criterios
 * calificados por el agente** y ninguna nota de etapa. Un solo POST la produjo.
 *
 * ⚠️ **Un guion en la columna significa tres cosas distintas**, y solo la
 * tercera es cosa del panel:
 *
 *   1. No rindio la prueba. No hay nada que calificar.
 *   2. La rindio y nadie la califico. Falta pedirsela a la IA — ese boton ya
 *      existe, justo encima.
 *   3. **La rindio, esta calificada entera, y nadie ponderó.** Es esta pieza.
 *
 * Este bloque dice en cual de las tres esta cada persona, que es lo que la
 * pantalla no podia decir.
 */

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { calcularNotaDePrueba, verNotasPrueba } from '../api/panel'
import { ErrorApi } from '../api/cliente'
import estilos from './NotaDeLaPrueba.module.css'

export function NotaDeLaPrueba({
  postulacionId,
  /** La de la fila del ranking. `null` es «todavía no hay», y 0 es un cero. */
  notaEnElRanking,
  alCalcular,
}: {
  postulacionId: number
  notaEnElRanking: number | null
  alCalcular: () => void
}) {
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<number | null>(null)

  /*
    La misma clave que usa la rubrica de arriba: las dos leen lo mismo y
    TanStack se lo sirve de su cache, sin una segunda peticion.
  */
  const notas = useQuery({
    queryKey: ['panel-notas-prueba', postulacionId],
    queryFn: () => verNotasPrueba(postulacionId),
    retry: false,
  })

  const calcular = useMutation({
    mutationFn: () => calcularNotaDePrueba(postulacionId),
    onSuccess: (r) => {
      setFallo(null)
      setHecho(r.nota)
      alCalcular()
    },
    /*
      El 409 viene escrito en español y **nombra los criterios que faltan uno a
      uno**: es la lista exacta de lo que hay que calificar antes. Se enseña tal
      cual; resumirlo a «faltan notas» tiraría lo único accionable.
    */
    onError: (causa: unknown) => {
      setHecho(null)
      if (causa instanceof ErrorApi && causa.estado === 403) {
        setFallo('Hace falta el permiso «ajustar_nota» para calcular la nota de la prueba.')
        return
      }
      setFallo(causa instanceof Error ? causa.message : 'No se pudo calcular la nota.')
    },
  })

  if (notas.isPending || notas.isError || !notas.data) return null

  const rubrica = notas.data
  /* ⚠️ `0` es una nota. `!n.puntaje` la contaría como si faltara. */
  const puestas = rubrica.filter((n) => n.puntaje !== null)
  const faltan = rubrica.length - puestas.length

  // Sin rúbrica no hay nada que ponderar, y no es un fallo: la vacante puede no
  // tener prueba con criterios.
  if (rubrica.length === 0) return null

  const yaTieneNota = notaEnElRanking !== null || hecho !== null

  return (
    <section className={estilos.bloque}>
      <h3 className={estilos.titulo}>La nota de la prueba</h3>

      {yaTieneNota ? (
        <p className={estilos.prosa}>
          Ya está calculada: <b>{hecho ?? notaEnElRanking}</b>. Es la que sale en el ranking
          y con la que se ordena la tabla.
          {hecho === null && ' Volver a calcularla la rehace con las notas que haya ahora.'}
        </p>
      ) : faltan > 0 ? (
        /*
          Rama 2: la rúbrica está a medias. El botón de calificar con IA vive
          justo encima, así que aquí solo hay que decir qué falta y no repetirlo.
        */
        <p className={estilos.prosa}>
          {puestas.length === 0
            ? 'Ninguno de sus criterios tiene nota todavía, así que no hay nada que ponderar. Pídele la calificación a la IA aquí arriba, o pon las notas a mano.'
            : `Le faltan ${faltan} de ${rubrica.length} criterios por calificar, así que todavía no se puede calcular la nota de la etapa.`}
        </p>
      ) : (
        /*
          Rama 3: la que faltaba. Todo calificado y sin nota en el ranking — es
          exactamente lo que se ve como «está calificado y no tiene nota».
        */
        <>
          <p className={estilos.prosa}>
            Sus {rubrica.length} criterios están calificados y <b>todavía no tiene nota de la
            prueba</b>: calificar pone la nota de cada criterio, y la de la etapa —la que sale
            en el ranking— se calcula ponderándolas. Ese es el paso que falta.
          </p>
          <button
            className={estilos.principal}
            type="button"
            onClick={() => calcular.mutate()}
            disabled={calcular.isPending}
          >
            {calcular.isPending ? 'Calculando…' : 'Calcular la nota de la prueba'}
          </button>
        </>
      )}

      {hecho !== null && (
        <p className={estilos.avisoBien} role="status">
          Calculada: {hecho}. Ya sale en el ranking.
        </p>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}
