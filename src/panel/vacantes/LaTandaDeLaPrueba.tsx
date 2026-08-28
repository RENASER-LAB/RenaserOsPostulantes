/**
 * Las notas de la prueba, para la tanda entera.
 *
 * El #14 puso el paso que faltaba —ponderar— en la ficha de una persona. Con
 * diecinueve que rindieron y ninguna con nota, abrir diecinueve fichas no es un
 * flujo: es la misma tarea repetida diecinueve veces.
 *
 * ⚠️ **El backend NO tiene nada en lote para la prueba, y esto lo orquesta.**
 * `criba-rapida` y `criba-fina` son del CURRICULUM. Para la prueba solo existen
 * los dos endpoints por persona, asi que aqui se llaman N veces. Comprobado
 * leyendo `CalificacionPruebaController` y `PostulacionesPanelController`.
 *
 * ⚠️ **Y tampoco sabe quien esta calificado y quien no**, que es lo primero que
 * hay que saber para no pedirle al agente lo que ya hizo. Se averigua pidiendo
 * la rubrica de cada uno —`GET .../prueba/notas`— y repartiendo aqui. Por eso
 * hay un paso de «revisar» antes de las acciones: son N peticiones y se hacen
 * cuando alguien las pide, no al abrir la pestaña.
 *
 * ## Los dos verbos NO son el mismo, y por eso son dos botones
 *
 * **Ponderar** es sincrono, no llama a ningun modelo y deja la nota en la
 * columna al momento. **Calificar** encola un trabajo del agente que tarda
 * decenas de segundos y del que aqui solo se sabe que se pidio.
 *
 * Juntarlos en un boton obligaria a mentir sobre uno de los dos: o se dice
 * «listo» sobre algo encolado, o se dice «puede tardar» sobre algo que ya
 * termino.
 *
 * ⚠️ **Nunca se escribe «calificado» sobre lo que solo se pidio.** Es la regla
 * de `CalificarConIa.tsx` y vale igual aqui: lo unico cierto tras encolar es
 * que se pidio. Ponderar es la excepcion, y solo porque su respuesta trae la
 * nota: ahi si se puede decir cuantas quedaron.
 *
 * ⚠️ **El violeta va en ponderar.** Es la que produce notas de verdad, la
 * rapida y la que no cuesta llamadas al modelo. En esta pestaña no hay otro
 * violeta —`CalificarLaTanda` solo se monta en Perfil integral— y el boton de
 * la ficha del #14 baja a secundario cuando este bloque esta delante, para no
 * tener dos violetas en la misma pantalla.
 */

import { useState } from 'react'
import {
  calcularNotaDePrueba,
  calificarPruebaConIa,
  verNotasPrueba,
} from '../api/panel'
import { ErrorApi } from '../api/cliente'
import type { FilaRanking } from '../api/tipos'
import { estaAhoraEn, tieneNota } from './ranking'
import estilos from './LaTandaDeLaPrueba.module.css'

/** Cuántas rúbricas se piden a la vez. El mismo tamaño que usa el rastreo de
 *  versiones de prueba: entra rápido sin abrir setenta conexiones de golpe. */
const TANDA = 8

interface Reparto {
  /** Rúbrica entera y sin nota de etapa: solo les falta el cálculo. */
  soloFaltaPonderar: FilaRanking[]
  /** Ningún criterio con nota: hay que pedirle la calificación al agente. */
  sinCalificar: FilaRanking[]
  /** Con parte de la rúbrica puesta. Ni una cosa ni la otra. */
  aMedias: FilaRanking[]
  /** A quien se le preguntó y no tiene rúbrica: la vacante puede no tener prueba. */
  sinRubrica: number
}

/** Quien ya la hizo y sigue sin nota. Es a quien alcanza este bloque. */
const laHicieronYSiguenSinNota = (filas: FilaRanking[]) =>
  filas.filter(
    (f) =>
      !tieneNota(f) &&
      estaAhoraEn(f.estado, 'PRUEBA_PUESTO') &&
      !f.estado.endsWith('TURNO_CANDIDATO'),
  )

export function LaTandaDeLaPrueba({
  filas,
  alTerminar,
}: {
  /** Las del ranking SIN filtrar: el corte de la pantalla no cambia a quién alcanza. */
  filas: FilaRanking[]
  alTerminar: () => void
}) {
  const [reparto, setReparto] = useState<Reparto | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [trabajando, setTrabajando] = useState<'ponderar' | 'calificar' | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const pendientes = laHicieronYSiguenSinNota(filas)

  // Sin nadie a quien alcanzar no se pinta nada: un panel que dice «0 personas»
  // encima de una tabla es ruido en la pantalla que más se habita.
  if (pendientes.length === 0) return null

  async function revisar() {
    setRevisando(true)
    setFallo(null)
    setResultado(null)
    const reparto: Reparto = {
      soloFaltaPonderar: [],
      sinCalificar: [],
      aMedias: [],
      sinRubrica: 0,
    }
    try {
      /*
        Por tandas y no de una en una: con setenta pendientes, en serie son
        varios segundos de espera mirando un botón. Y no todas de golpe: son
        peticiones al mismo backend que está sirviendo la tabla.
      */
      for (let desde = 0; desde < pendientes.length; desde += TANDA) {
        const grupo = pendientes.slice(desde, desde + TANDA)
        const rubricas = await Promise.all(
          grupo.map((f) =>
            verNotasPrueba(f.postulacionId).catch(() => null),
          ),
        )
        grupo.forEach((fila, i) => {
          const rubrica = rubricas[i]
          if (!rubrica || rubrica.length === 0) {
            reparto.sinRubrica += 1
            return
          }
          /* ⚠️ `0` es una nota: `!puntaje` contaría un cero como criterio vacío. */
          const puestas = rubrica.filter((n) => n.puntaje !== null).length
          if (puestas === rubrica.length) reparto.soloFaltaPonderar.push(fila)
          else if (puestas === 0) reparto.sinCalificar.push(fila)
          else reparto.aMedias.push(fila)
        })
      }
      setReparto(reparto)
    } catch (causa) {
      setFallo(explicar(causa))
    } finally {
      setRevisando(false)
    }
  }

  /*
    Uno a uno y no en paralelo, como el avance en tanda de la tabla: si el
    backend rechaza a alguien, el mensaje dice a quién y los demás no se
    pierden por ello.
  */
  async function correr(
    que: 'ponderar' | 'calificar',
    sobre: FilaRanking[],
    llamar: (id: number) => Promise<unknown>,
  ) {
    setTrabajando(que)
    setFallo(null)
    setResultado(null)
    const bien: string[] = []
    const mal: string[] = []
    for (const fila of sobre) {
      try {
        await llamar(fila.postulacionId)
        bien.push(fila.candidato)
      } catch (causa) {
        mal.push(`${fila.candidato} (${explicar(causa)})`)
      }
    }
    setTrabajando(null)
    setReparto(null)
    setResultado(
      [
        /*
          ⚠️ Ponderar SÍ puede decir que hay nota —su respuesta la trae— y
          calificar NO: solo encola. Es la regla de los indicadores que mienten,
          y es lo que obliga a que sean dos frases distintas.
        */
        que === 'ponderar'
          ? bien.length > 0
            ? `${bien.length} ${bien.length === 1 ? 'nota calculada' : 'notas calculadas'}: ya salen en la tabla.`
            : null
          : bien.length > 0
            ? `Se pidió la calificación de ${bien.length}. El agente tarda decenas de segundos por persona; las notas irán apareciendo en la tabla.`
            : null,
        mal.length > 0 ? `No se pudo con ${mal.length}: ${mal.join('; ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    )
    alTerminar()
  }

  return (
    <section className={estilos.tanda}>
      <h3 className={estilos.titulo}>Las notas de la prueba</h3>
      <p className={estilos.explica}>
        {pendientes.length} {pendientes.length === 1 ? 'persona rindió' : 'personas rindieron'} la
        prueba y {pendientes.length === 1 ? 'sigue' : 'siguen'} sin nota. Calificar pone la nota de
        cada criterio; la de la etapa —la de la tabla— se calcula ponderándolas después.
      </p>

      {!reparto && (
        <div className={estilos.acciones}>
          <button
            className={estilos.principal}
            type="button"
            onClick={revisar}
            disabled={revisando}
          >
            {revisando
              ? `Mirando las ${pendientes.length}…`
              : `Ver qué le falta a ${pendientes.length === 1 ? 'esa persona' : `esas ${pendientes.length}`}`}
          </button>
          <span className={estilos.pista}>
            {/* Se dice el coste antes de pulsar: son N peticiones, no una. */}
            Se le pide la rúbrica a cada {pendientes.length === 1 ? 'una' : 'una de ellas'}.
          </span>
        </div>
      )}

      {reparto && (
        <>
          <ul className={estilos.reparto} role="list">
            <Grupo
              cuantas={reparto.soloFaltaPonderar.length}
              que="ya {tienen} su rúbrica calificada y solo {falta} el cálculo"
            />
            <Grupo
              cuantas={reparto.sinCalificar.length}
              que="no {tiene} ninguna nota de criterio todavía"
            />
            <Grupo
              cuantas={reparto.aMedias.length}
              que="{tiene} la rúbrica a medias: ni se puede ponderar ni conviene volver a pedirla entera"
            />
            <Grupo
              cuantas={reparto.sinRubrica}
              que="no {tiene} rúbrica de prueba que calificar"
            />
          </ul>

          <div className={estilos.acciones}>
            {reparto.soloFaltaPonderar.length > 0 && (
              <button
                className={estilos.principal}
                type="button"
                disabled={trabajando !== null}
                onClick={() =>
                  correr('ponderar', reparto.soloFaltaPonderar, calcularNotaDePrueba)
                }
              >
                {trabajando === 'ponderar'
                  ? 'Calculando…'
                  : `Calcular ${reparto.soloFaltaPonderar.length === 1 ? 'la nota que falta' : `las ${reparto.soloFaltaPonderar.length} notas que faltan`}`}
              </button>
            )}
            {reparto.sinCalificar.length > 0 && (
              <button
                className={estilos.secundario}
                type="button"
                disabled={trabajando !== null}
                onClick={() => correr('calificar', reparto.sinCalificar, calificarPruebaConIa)}
              >
                {trabajando === 'calificar'
                  ? 'Pidiendo…'
                  : `Pedirle a la IA que califique ${reparto.sinCalificar.length === 1 ? 'a esa persona' : `a esas ${reparto.sinCalificar.length}`}`}
              </button>
            )}
            <button
              className={estilos.secundario}
              type="button"
              disabled={trabajando !== null}
              onClick={() => setReparto(null)}
            >
              Dejarlo
            </button>
          </div>

          {reparto.aMedias.length > 0 && (
            <p className={estilos.pista}>
              {/*
                La rúbrica a medias no tiene acción en lote y decirlo es más
                honesto que ofrecer una que haría daño: volver a pedirle al
                agente la persona entera no está garantizado que respete lo que
                una persona ajustó a mano.
              */}
              A quien tiene la rúbrica a medias se le termina desde su ficha, criterio a criterio.
            </p>
          )}
        </>
      )}

      {resultado && (
        <p className={estilos.avisoBien} role="status">
          {resultado}
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

/**
 * Una línea del reparto, en singular o plural.
 *
 * ⚠️ **No se pinta el grupo vacío.** «0 no tienen ninguna nota» ocupa el mismo
 * sitio que una cifra real y hay que leerlo entero para descubrir que no dice
 * nada.
 */
function Grupo({ cuantas, que }: { cuantas: number; que: string }) {
  if (cuantas === 0) return null
  const una = cuantas === 1
  const texto = que
    .replace('{tienen}', una ? 'tiene' : 'tienen')
    .replace('{tiene}', una ? 'tiene' : 'tienen')
    .replace('{falta}', una ? 'le falta' : 'les falta')
  return (
    <li className={estilos.grupo}>
      <span className={estilos.cuantas}>{cuantas}</span>
      <span>{texto}</span>
    </li>
  )
}

function explicar(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 403) {
    return 'hace falta el permiso «ajustar_nota»'
  }
  if (causa instanceof Error && causa.message) return causa.message
  return 'no se pudo'
}
