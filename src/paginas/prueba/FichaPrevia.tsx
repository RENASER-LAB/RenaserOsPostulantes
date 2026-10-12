/**
 * La pantalla previa de la prueba: lo que hay que saber antes de pulsar «Empezar», en una ficha
 * corta. Sirve a las dos pruebas —la del editor y la de plantilla—, que solo cambian la condición
 * (la del editor no se entrega con huecos) y de dónde sale la fecha límite.
 *
 * **Antes de empezar no se enseña nada que dé ventaja** (decisión del usuario del 10/10/2026): ni
 * el caso, ni los materiales, ni las preguntas, ni el detalle de los archivos. El caso se lee dentro
 * del reloj, y el backend ya no los manda hasta que se empieza (`MiPrueba`). Lo que queda cabe en
 * una sola superficie, con filetes entre sus partes y sin tarjetas dentro:
 *
 *   1. **Los datos** —tiempo, fecha límite, preguntas y archivos— en una fila, y en 2×2 en el
 *      teléfono. Si falta uno, su celda no sale y las demás se reparten el ancho.
 *   2. **La condición y «Empezar prueba»**, justo debajo y en una fila: así el botón se ve al abrir
 *      la pantalla desde 520 px de alto, tenga los archivos que tenga. En el teléfono, la condición
 *      encima y el botón a todo el ancho, a la vista al abrir desde 360×740 y 375×667. La condición
 *      dice lo que la prueba tiene (`loQueDiceLaPrevia`).
 *   3. **Lo que entregarás y las herramientas permitidas**, de consulta, lado a lado si caben.
 *
 * Nada va pegado ni se mueve, y el orden del DOM es el que se ve en cualquier ancho.
 */

import type { ReactNode } from 'react'
import type { MiPrueba } from '@/api/tipos'
import { fechaLargaDeLima } from '@/dominio/horaDeLima'
import { TextoPlano } from '@/ui/TextoPlano'
import { comoSeEntrega } from './Entregable'
import { condicionDe, cuantasPreguntas, fechaLimiteDe } from './loQueDiceLaPrevia'
import estilos from './Prueba.module.css'

interface Celda {
  etiqueta: string
  valor: ReactNode
  matices: string[]
}

/** «Se entrega como archivo» → «se entrega como archivo», para seguir la frase. */
const enMinuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1)

/** «jueves 29/10 a las 15:45», en dos líneas: el día y la hora. */
function FechaEnDosLineas({ instante }: { instante: string }) {
  const fecha = fechaLargaDeLima(instante)
  const corte = fecha.indexOf(' a las ')
  if (corte < 0) return <>{fecha}</>
  return (
    <>
      <span className={estilos.lineaDeFecha}>{fecha.slice(0, corte)}</span>{' '}
      <span className={estilos.lineaDeHora}>{fecha.slice(corte + 1)}</span>
    </>
  )
}

/**
 * Las celdas que tienen algo que decir, en su orden.
 *
 * El tiempo: con reloj, sus minutos, y si además hay fecha límite, que la fecha puede acortarlos
 * —gana la que llegue antes, y lo decide el servidor al empezar—. Sin reloj y con fecha, hasta la
 * fecha. Sin reloj ni fecha, sus días desde que se empiece.
 */
function celdasDe(prueba: MiPrueba): Celda[] {
  const celdas: Celda[] = []
  const fecha = fechaLimiteDe(prueba)
  const preguntas = cuantasPreguntas(prueba)
  const obligatorios = prueba.entregables.filter((e) => e.esObligatorio).length

  if (prueba.duracionMinutos) {
    celdas.push({
      etiqueta: 'Tiempo',
      valor: `${prueba.duracionMinutos} min`,
      matices: [
        'desde que pulses Empezar',
        ...(fecha ? ['o hasta la fecha límite, si llega antes'] : []),
      ],
    })
  } else if (fecha) {
    celdas.push({ etiqueta: 'Tiempo', valor: 'Hasta la fecha límite', matices: [] })
  } else if (prueba.plazoDias) {
    celdas.push({
      etiqueta: 'Tiempo',
      valor: `${prueba.plazoDias} ${prueba.plazoDias === 1 ? 'día' : 'días'}`,
      matices: ['desde que pulses Empezar'],
    })
  }
  if (fecha) {
    celdas.push({ etiqueta: 'Fecha límite', valor: <FechaEnDosLineas instante={fecha} />, matices: [] })
  }
  if (preguntas > 0) {
    celdas.push({ etiqueta: 'Preguntas', valor: String(preguntas), matices: [] })
  }
  if (prueba.entregables.length > 0) {
    celdas.push({
      etiqueta: 'Archivos',
      valor: String(prueba.entregables.length),
      matices: obligatorios > 0 ? [`${obligatorios} ${obligatorios === 1 ? 'obligatorio' : 'obligatorios'}`] : [],
    })
  }
  return celdas
}

export function FichaPrevia({ prueba, alEmpezar }: { prueba: MiPrueba; alEmpezar: () => void }) {
  const celdas = celdasDe(prueba)
  const condicion = condicionDe(prueba)
  const herramientas = prueba.herramientasPermitidas?.trim() ? prueba.herramientasPermitidas : null
  const hayEntregables = prueba.entregables.length > 0
  // Con un backend anterior las preguntas aún llegan: su número sale de ahí si no viene aparte.
  const numeroDeLaPregunta = new Map(prueba.preguntas.map((p, i) => [p.id, p.posicion ?? i + 1]))
  const enLaPregunta = (e: MiPrueba['entregables'][number]) =>
    e.posicionDeLaPregunta ?? (e.preguntaId != null ? numeroDeLaPregunta.get(e.preguntaId) : undefined)

  return (
    <div className={estilos.ficha}>
      {celdas.length > 0 && (
        <dl className={estilos.franja}>
          {celdas.map((c) => (
            <div className={estilos.celda} key={c.etiqueta}>
              <dt className={estilos.etiquetaDeCelda}>{c.etiqueta}</dt>
              <dd className={estilos.valorDeCelda} data-cifra>
                {c.valor}
              </dd>
              {c.matices.map((m) => (
                <dd className={estilos.matizDeCelda} key={m}>
                  {m}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      )}

      <div className={estilos.empezarDesdeLaFicha}>
        {/* La prueba del editor no se entrega con huecos (decisión 11); la de plantilla entrega lo
            guardado. Dice lo que la prueba tiene: sus preguntas, sus obligatorios y su tiempo. */}
        {condicion && <p className={estilos.condicion}>{condicion}</p>}
        <button type="button" className={estilos.empezarLaPrueba} onClick={alEmpezar} data-rotulo="Empezar prueba">
          Empezar prueba
        </button>
      </div>

      {(hayEntregables || herramientas) && (
        <div className={hayEntregables && herramientas ? estilos.consultaEnDos : estilos.consulta}>
          {hayEntregables && (
            <section className={estilos.parteDeLaFicha}>
              <h2 className={estilos.tituloDeParte}>Lo que entregarás</h2>
              {/* Saberlo antes de empezar evita descubrirlo con el reloj corriendo. Sin su detalle:
                  eso se lee dentro de la prueba. */}
              <ul className={estilos.archivosPorEntregar}>
                {prueba.entregables.map((e) => {
                  const numero = enLaPregunta(e)
                  return (
                    <li className={estilos.archivoPorEntregar} key={e.id}>
                      <p className={estilos.nombreDelArchivo}>{e.nombre}</p>
                      <p className={estilos.alcanceDelArchivo}>
                        {e.esObligatorio ? 'obligatorio' : 'opcional'}
                        {numero != null && ` · en la pregunta ${numero}`}
                        {` · ${enMinuscula(comoSeEntrega(e.formato))}`}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {herramientas && (
            <section className={estilos.parteDeLaFicha}>
              <h2 className={estilos.tituloDeParte}>Herramientas permitidas</h2>
              <TextoPlano texto={herramientas} queEs="el documento" className={estilos.textoDeLaFicha} listas />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
