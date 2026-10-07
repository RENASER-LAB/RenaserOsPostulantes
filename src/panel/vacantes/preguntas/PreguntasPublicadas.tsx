/**
 * Las preguntas ya publicadas: en lectura, salvo dos cosas que cambian la vara
 * para todos a la vez.
 *
 *   - **Los puntos** (de cada pregunta, opción o nivel): se recalcula a todos al
 *     instante, sin IA. Sirve sobre todo para arreglar una clave mal puesta.
 *   - **Las instrucciones de la IA** (la guía, lo que evalúa cada criterio y lo
 *     que debe tener cada abierta): se vuelve a calificar a quien ya tiene nota.
 *     Sin saldo o con la IA apagada no se guarda nada, y se dice en una ventana.
 *
 * Ningún texto se toca: ni enunciados, ni opciones, ni el nombre de un
 * criterio. Mientras nadie haya postulado, lo que se hace es abrir un borrador.
 *
 * En la lectura los criterios salen **plegados**, con la línea del editor. En
 * «Cambiar los puntos» de la prueba también, con el total de cada criterio en su
 * línea, a la vista; en el del banco salen **desplegados**, como antes: sus únicos
 * campos son los puntos de sus preguntas (QA-13). En los dos, lo que frena el
 * guardado —en el navegador o un 400 del servidor— despliega su criterio y queda
 * debajo de la cabecera fija (QA-12). Las instrucciones de la IA no se pliegan.
 */

import { useId, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  abrirBorrador,
  cambiarPuntos,
  corregirInstrucciones,
  reintentarRecalificacion,
  type EditorDePreguntas,
  type VersionDePreguntas,
} from '../../api/preguntasPropias'
import { Modal } from '@/ui/Modal'
import { claveDelEditor, falloDe, type Fallo } from './consultas'
import {
  avisoAntesDeRecalcular,
  avisoAntesDeRecalificar,
  cerradasPorEncima,
  cuentaDelCriterio,
  faltaEnLosPuntosDelCriterio,
  nombreDelTipo,
  repartoDelCriterio,
  resultadoDelReintento,
  textoDelReparto,
} from './formulario'
import type { Calificador } from '../../api/pruebaPropia'
import {
  archivosDeLasPreguntas,
  ContenidoDePregunta,
  NombrePlegable,
  PlegarTodo,
  ResumenDelCriterio,
} from './BloqueCriterio'
import { esPrueba, useModoDelEditor } from './modo'
import { destinoDelAviso, useCriteriosPlegados } from './navegacion'
import { MostrarFallo } from './piezas'
import { VistaDeVersion } from './VistaDeVersion'
import estilos from './EditorDePreguntas.module.css'

type Modo = 'LEER' | 'PUNTOS' | 'INSTRUCCIONES'

interface Props {
  editor: EditorDePreguntas
  publicada: VersionDePreguntas
  alCambiar: (editor: EditorDePreguntas) => void
}

export function PreguntasPublicadas({ editor, publicada, alCambiar }: Props) {
  const cache = useQueryClient()
  const vacanteId = editor.vacanteId
  const modoDelEditor = useModoDelEditor()
  const deLaPrueba = esPrueba(modoDelEditor)
  const [modo, setModo] = useState<Modo>('LEER')
  const [hecho, setHecho] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const recalificacion = editor.recalificacion
  const enCurso = (recalificacion?.recalificando ?? 0) > 0
  const refrescar = () =>
    cache.invalidateQueries({ queryKey: claveDelEditor(vacanteId, modoDelEditor.ruta) })

  const borrador = useMutation({
    mutationFn: () => abrirBorrador(vacanteId, modoDelEditor.ruta),
    onSuccess: alCambiar,
    onError: (c) => setFallo(falloDe(c, 'No se pudo abrir el borrador.')),
  })
  const reintento = useMutation({
    mutationFn: () => reintentarRecalificacion(vacanteId, modoDelEditor.ruta),
    onSuccess: (r) => {
      setHecho(resultadoDelReintento(r))
      void refrescar()
    },
    onError: (c) => setFallo(falloDe(c, 'No se pudo reintentar.')),
  })

  return (
    <div className={estilos.criterios}>
      {deLaPrueba ? (
        <p className={estilos.cartel}>
          Publicada. Desde que alguien empieza a rendirla solo se cambian los puntos y las
          instrucciones de la IA, y cualquiera de los dos vuelve a calcular la nota de todos.
          {!editor.hayPostulantes && ' Mientras nadie la haya abierto, se puede abrir un borrador y publicar otra.'}
        </p>
      ) : (
        <p className={estilos.cartel}>
          Publicadas. Desde la primera postulación solo se cambian los puntos y las instrucciones de
          la IA, y cualquiera de los dos vuelve a calcular la nota de todos.
        </p>
      )}

      {recalificacion && (recalificacion.recalificando > 0 || recalificacion.pendientes > 0) && (
        <div className={estilos.recalificando} role="status">
          {recalificacion.recalificando > 0 && (
            <p>
              Recalificando con la guía nueva: {recalificacion.alDia} de {recalificacion.conNota}{' '}
              {recalificacion.conNota === 1 ? 'ya tiene' : 'ya tienen'} la nota nueva. Cada persona
              conserva la anterior hasta que llega la suya.
            </p>
          )}
          {recalificacion.pendientes > 0 && (
            <>
              <p>
                Pendiente de recalificar: {recalificacion.pendientes}{' '}
                {recalificacion.pendientes === 1 ? 'persona conserva' : 'personas conservan'} la nota
                de la guía anterior.
              </p>
              <ul>
                {recalificacion.motivos.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              {editor.puedeEditar && (
                <button
                  className={estilos.secundarioPequeno}
                  type="button"
                  onClick={() => reintento.mutate()}
                  disabled={reintento.isPending}
                >
                  Reintentar
                </button>
              )}
            </>
          )}
        </div>
      )}

      {editor.puedeEditar && modo === 'LEER' && (
        <div className={estilos.entradas}>
          {!editor.hayPostulantes && (
            <button
              className={estilos.secundario}
              type="button"
              onClick={() => borrador.mutate()}
              disabled={borrador.isPending}
            >
              {deLaPrueba ? 'Abrir un borrador' : 'Abrir un borrador para cambiarlas'}
            </button>
          )}
          <button
            className={estilos.secundario}
            type="button"
            onClick={() => {
              setHecho(null)
              setModo('PUNTOS')
            }}
            disabled={enCurso}
          >
            Cambiar los puntos
          </button>
          <button
            className={estilos.secundario}
            type="button"
            onClick={() => {
              setHecho(null)
              setModo('INSTRUCCIONES')
            }}
            disabled={enCurso}
          >
            Corregir las instrucciones de la IA
          </button>
        </div>
      )}
      {enCurso && editor.puedeEditar && (
        <p className={estilos.ayuda}>
          Mientras se recalifica, ni la guía ni los puntos se pueden volver a cambiar.
        </p>
      )}

      {hecho && (
        <p className={estilos.estado} role="status">
          {hecho}
        </p>
      )}
      <MostrarFallo fallo={fallo} />

      {modo === 'LEER' && <VistaDeVersion version={publicada} />}
      {modo === 'PUNTOS' && (
        <CambiarLosPuntos
          vacanteId={vacanteId}
          publicada={publicada}
          rindieron={recalificacion?.rindieron ?? 0}
          alTerminar={(mensaje) => {
            setModo('LEER')
            setHecho(mensaje)
            void refrescar()
          }}
          alCancelar={() => setModo('LEER')}
        />
      )}
      {modo === 'INSTRUCCIONES' && (
        <CorregirLasInstrucciones
          vacanteId={vacanteId}
          publicada={publicada}
          conNota={recalificacion?.conNota ?? 0}
          alTerminar={(mensaje) => {
            setModo('LEER')
            setHecho(mensaje)
            void refrescar()
          }}
          alCancelar={() => setModo('LEER')}
        />
      )}
    </div>
  )
}

// ---------- Los puntos ----------

/**
 * Cómo queda repartido un criterio publicado con los puntos nuevos (V69), como en
 * el lápiz pero sin selector: «Cerradas: 60 pts · Abiertas y archivos: 40 pts, los
 * califica la IA». Quién califica no se cambia aquí, y los puntos de abiertas y
 * archivos no pueden quedar en 0: tiene abiertas o archivos que alguien califica.
 * `total` va tal cual se escribió: si no es un entero de 0 a 100 no se reparte, se
 * dice qué está mal. Sin calificador no se da por hecha la IA (QA-10).
 */
function RepartoPublicado({
  id,
  nombre,
  total: escrito,
  cerradas,
  calificador,
}: {
  /** El campo del total lo usa para describirse con esta línea. */
  id: string
  nombre: string
  total: string
  cerradas: number
  calificador: Calificador | null | undefined
}) {
  const malEscrito = faltaEnLosPuntosDelCriterio(escrito)
  if (malEscrito !== null) {
    return (
      <p id={id} className={estilos.aviso}>
        {malEscrito}
      </p>
    )
  }
  const total = Number(escrito)
  const reparto = repartoDelCriterio(total, cerradas)
  if (reparto.tipo === 'POR_ENCIMA') {
    return (
      <p id={id} className={estilos.aviso}>
        {cerradasPorEncima(nombre, cerradas, total)}
      </p>
    )
  }
  if (reparto.tipo === 'SISTEMA') {
    return (
      <p id={id} className={estilos.aviso}>
        Sus cerradas suman {cerradas}: no le queda nada que calificar, y tiene abiertas o archivos que
        alguien califica.
      </p>
    )
  }
  return (
    <p id={id} className={estilos.reparto}>
      {textoDelReparto(cerradas, reparto.otros, calificador)}
    </p>
  )
}

/** Los puntos de una pregunta van de 0 a 100, y los de una opción de −100 a 100. */
const PUNTOS_MAXIMOS = 100

/**
 * Lo que el navegador frena por `step`, `min` o `max` en una pregunta desplegada
 * —los límites de la forma del servidor—; plegada no hay campo que frenar, y se
 * mira aquí. Vacío no frena: es lo de siempre (AC-10).
 */
function fueraDeLaForma(valor: string | undefined, minimo: number): boolean {
  const texto = (valor ?? '').trim()
  if (texto === '') return false
  const numero = Number(texto)
  return !Number.isInteger(numero) || numero < minimo || numero > PUNTOS_MAXIMOS
}

function CambiarLosPuntos({
  vacanteId,
  publicada,
  rindieron,
  alTerminar,
  alCancelar,
}: {
  vacanteId: number
  publicada: VersionDePreguntas
  rindieron: number
  alTerminar: (mensaje: string) => void
  alCancelar: () => void
}) {
  const modoDelEditor = useModoDelEditor()
  const deLaPrueba = esPrueba(modoDelEditor)
  // En la prueba (V67) las abiertas no llevan puntos: no se ofrecen.
  const preguntas = useMemo(
    () =>
      [...publicada.criterios.flatMap((c) => c.preguntas), ...publicada.sinCriterio].filter(
        (p) => !(deLaPrueba && p.tipo === 'ABIERTA'),
      ),
    [publicada, deLaPrueba],
  )
  // En la prueba (V69) se escribe lo que vale cada criterio con parte calificada; su
  // parte es eso menos sus cerradas. Uno solo de cerradas vale lo que sumen.
  const conParte = deLaPrueba ? publicada.criterios.filter((c) => (c.puntosCalificados ?? 0) > 0) : []
  const [totales, setTotales] = useState<Record<number, string>>(
    () => Object.fromEntries(conParte.map((c) => [c.id, String(c.puntos)])),
  )
  const [puntos, setPuntos] = useState<Record<number, string>>(
    () => Object.fromEntries(preguntas.map((p) => [p.id, String(p.puntos)])),
  )
  const [opciones, setOpciones] = useState<Record<number, string>>(
    () => Object.fromEntries(preguntas.flatMap((p) => p.opciones.map((o) => [o.id, String(o.puntos)]))),
  )
  const [confirmando, setConfirmando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  // Lo que el último 400 dijo de cada pregunta, bajo su campo hasta que se toca.
  const [faltasDeLaPregunta, setFaltasDeLaPregunta] = useState<Record<number, string[]>>({})
  const corregida = (pregunta: number) =>
    setFaltasDeLaPregunta((v) =>
      pregunta in v ? Object.fromEntries(Object.entries(v).filter(([id]) => Number(id) !== pregunta)) : v,
    )
  // En la prueba, cada criterio en su línea con el total a la vista y sus preguntas
  // plegadas. En el banco no hay total en la línea: sus campos son los puntos de las
  // preguntas, y salen a la vista como antes de los plegables (QA-13).
  const plegado = useCriteriosPlegados(publicada, !deLaPrueba)
  const base = useId()
  const idDelTotal = (criterio: number) => `${base}-total-${criterio}`
  const idDelReparto = (criterio: number) => `${base}-reparto-${criterio}`
  const idDeLaPregunta = (pregunta: number) => `${base}-pregunta-${pregunta}`
  const idDeLaOpcion = (opcion: number) => `${base}-opcion-${opcion}`
  const idDeSusFaltas = (pregunta: number) => `${base}-faltas-${pregunta}`
  // Un total que no es un entero de 0 a 100 no se envía: su falta ya está bajo el campo,
  // y el servidor daría otra suma que la escrita (QA-11).
  const malEscrito = (criterio: number) => faltaEnLosPuntosDelCriterio(totales[criterio] ?? '') !== null

  /** El primer campo que frena el guardado, criterio a criterio: su total, o una pregunta o una opción. */
  const primerCampoMal = (): { criterio: number; campo: string } | null => {
    for (const c of publicada.criterios) {
      if (conParte.includes(c) && malEscrito(c.id)) return { criterio: c.id, campo: idDelTotal(c.id) }
      for (const p of c.preguntas.filter((q) => !(deLaPrueba && q.tipo === 'ABIERTA'))) {
        if (fueraDeLaForma(puntos[p.id], 0)) return { criterio: c.id, campo: idDeLaPregunta(p.id) }
        const opcion = p.opciones.find((o) => fueraDeLaForma(opciones[o.id], -PUNTOS_MAXIMOS))
        if (opcion) return { criterio: c.id, campo: idDeLaOpcion(opcion.id) }
      }
    }
    return null
  }

  /**
   * Lleva al campo que frena el guardado (QA-12): despliega su criterio y baja hasta
   * su bloque —la línea del criterio para el total, la tarjeta para una pregunta—,
   * que se para debajo de la cabecera fija con el campo y su falta a la vista.
   */
  const llevarAlCampo = (criterios: number[], campo: string) => {
    flushSync(() => plegado.abrir(criterios))
    const el = document.getElementById(campo)
    if (!el) return
    el.closest<HTMLElement>('[data-ancla]')?.scrollIntoView?.({ block: 'start' })
    el.focus({ preventScroll: true })
  }

  /**
   * El navegador frena un total fuera de 0-100 o con decimales antes de `onSubmit`, y
   * avisa con `invalid` a cada campo mal escrito: se despliegan sus criterios y se baja
   * al primero, que es al que el navegador da el foco (su globo sale ya a la vista).
   */
  const alFrenarElNavegador = (campo: HTMLInputElement, criterio: number) => {
    const primero = Array.from(campo.form?.elements ?? []).find(
      (el) => el instanceof HTMLInputElement && el.willValidate && !el.validity.valid,
    )
    if (primero === campo) llevarAlCampo([criterio], campo.id)
    else plegado.abrir([criterio])
  }

  /**
   * Un 400 del servidor nombra lo que falla: «La pregunta 3 (…)» o «El criterio «X»…»
   * (QA-13). Se despliegan sus criterios, lo de cada pregunta se dice bajo su campo y se
   * baja al primero, aunque su criterio estuviera plegado. La suma ya está arriba, a la vista.
   */
  const llevarALasFaltas = (f: Fallo) => {
    const porPregunta: Record<number, string[]> = {}
    const criterios: number[] = []
    let primero: string | null = null
    for (const falta of f.faltas ?? [f.mensaje]) {
      const d = destinoDelAviso(falta, publicada)
      if (d.tipo === 'PREGUNTA' && d.criterioId !== null && preguntas.some((p) => p.id === d.preguntaId)) {
        porPregunta[d.preguntaId] = [...(porPregunta[d.preguntaId] ?? []), falta]
        criterios.push(d.criterioId)
        primero ??= idDeLaPregunta(d.preguntaId)
      } else if (d.tipo === 'CRITERIO' && conParte.some((c) => c.id === d.criterioId)) {
        criterios.push(d.criterioId)
        primero ??= idDelTotal(d.criterioId)
      }
    }
    setFaltasDeLaPregunta(porPregunta)
    if (primero) llevarAlCampo(criterios, primero)
  }

  const deLasPreguntas = (lista: VersionDePreguntas['sinCriterio']) =>
    lista.filter((p) => !(deLaPrueba && p.tipo === 'ABIERTA')).reduce((s, p) => s + (Number(puntos[p.id]) || 0), 0)
  const suma =
    publicada.criterios.reduce(
      (s, c) => s + (conParte.includes(c) ? Number(totales[c.id]) || 0 : deLasPreguntas(c.preguntas)),
      0,
    ) + deLasPreguntas(publicada.sinCriterio)

  const guardado = useMutation({
    mutationFn: () =>
      cambiarPuntos(
        vacanteId,
        {
          preguntas: preguntas.map((p) => ({
            id: p.id,
            puntos: Number(puntos[p.id]),
            opciones: p.opciones.map((o) => ({ id: o.id, puntos: Number(opciones[o.id]) })),
          })),
          ...(deLaPrueba ? { criterios: conParte.map((c) => ({ id: c.id, puntos: Number(totales[c.id]) })) } : {}),
        },
        modoDelEditor.ruta,
      ),
    onSuccess: (r) =>
      alTerminar(
        r.personas === 0
          ? 'Puntos guardados.'
          : `Puntos guardados: se recalcularon las notas de ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}, sin IA y sin mover a nadie de etapa.`,
      ),
    onError: (c) => {
      setConfirmando(false)
      const f = falloDe(c, 'No se pudieron cambiar los puntos.')
      setFallo(f)
      llevarALasFaltas(f)
    },
  })

  return (
    <form
      className={estilos.criterios}
      aria-label="Cambiar los puntos"
      onSubmit={(e) => {
        e.preventDefault()
        // Lo que el navegador no frena: un total vacío, o decimales en una pregunta plegada.
        const mal = primerCampoMal()
        if (mal) {
          setConfirmando(false)
          llevarAlCampo([mal.criterio], mal.campo)
          return
        }
        if (rindieron > 0 && !confirmando) {
          setConfirmando(true)
          return
        }
        guardado.mutate()
      }}
    >
      <p className={estilos.cifras}>
        Suma de lo escrito: <b>{suma}</b> de 100. El total tiene que seguir en 100.
      </p>
      {publicada.criterios.length > 0 && (
        <PlegarTodo alDesplegar={plegado.desplegarTodo} alPlegar={plegado.plegarTodo} />
      )}
      {publicada.criterios.map((c) => {
        const abierto = plegado.abierto(c.id)
        const suyas = c.preguntas.filter((p) => !(deLaPrueba && p.tipo === 'ABIERTA'))
        return (
          <section
            className={`${estilos.criterio} ${estilos.destino}`}
            key={c.id}
            aria-label={`Criterio ${c.nombre}`}
            data-ancla
          >
            {/* En el banco la línea no lleva campo: sus puntos van al borde derecho (AC-12). */}
            <header className={deLaPrueba ? estilos.cabeceraCriterio : estilos.cabeceraSinBotones}>
              <NombrePlegable titulo={c.nombre} abierto={abierto} alAlternar={() => plegado.alternar(c.id)} />
              <ResumenDelCriterio
                criterio={c}
                cuenta={cuentaDelCriterio(
                  c.preguntas.length,
                  deLaPrueba ? archivosDeLasPreguntas(c.preguntas, publicada.prueba?.entregables ?? []) : 0,
                )}
              />
              {conParte.includes(c) && (
                <label className={`${estilos.filaOpcion} ${estilos.totalEnLaLinea}`}>
                  <span className={estilos.textoOpcion}>Puntos del criterio</span>
                  <input
                    id={idDelTotal(c.id)}
                    className={`${estilos.entradaPuntos} ${estilos.campoQueFrena}`}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={0}
                    max={100}
                    aria-label={`Puntos del criterio «${c.nombre}»`}
                    aria-invalid={malEscrito(c.id) || undefined}
                    aria-describedby={idDelReparto(c.id)}
                    value={totales[c.id]}
                    onChange={(e) => setTotales((v) => ({ ...v, [c.id]: e.target.value }))}
                    onInvalid={(e) => alFrenarElNavegador(e.currentTarget, c.id)}
                  />
                </label>
              )}
            </header>
            {conParte.includes(c) && (
              <RepartoPublicado
                id={idDelReparto(c.id)}
                nombre={c.nombre}
                total={totales[c.id] ?? ''}
                cerradas={deLasPreguntas(c.preguntas)}
                calificador={c.calificador}
              />
            )}
            {abierto &&
              suyas.map((p) => {
                const susFaltas = faltasDeLaPregunta[p.id]
                return (
                  <div className={`${estilos.pregunta} ${estilos.destino}`} key={p.id} data-ancla>
                    <div className={estilos.cabeceraPregunta}>
                      <span className={estilos.chip}>{nombreDelTipo(p.tipo)}</span>
                      <label className={estilos.filaOpcion}>
                        <span className={estilos.etiqueta}>Puntos</span>
                        <input
                          id={idDeLaPregunta(p.id)}
                          className={`${estilos.entradaPuntos} ${estilos.campoQueFrena}`}
                          type="number"
                          step={1}
                          min={0}
                          max={PUNTOS_MAXIMOS}
                          aria-label={`Puntos de «${p.enunciado.slice(0, 40)}»`}
                          aria-invalid={susFaltas ? true : undefined}
                          aria-describedby={susFaltas ? idDeSusFaltas(p.id) : undefined}
                          value={puntos[p.id]}
                          onChange={(e) => {
                            setPuntos((v) => ({ ...v, [p.id]: e.target.value }))
                            corregida(p.id)
                          }}
                        />
                      </label>
                    </div>
                    {susFaltas && (
                      <div id={idDeSusFaltas(p.id)}>
                        {susFaltas.map((f) => (
                          <p className={estilos.aviso} key={f}>
                            {f}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className={estilos.enunciado}>{p.enunciado}</p>
                    {p.opciones.map((o) => (
                      <label className={estilos.filaOpcion} key={o.id}>
                        <span className={estilos.textoOpcion}>
                          {p.tipo === 'ESCALA' && o.texto !== String(o.orden) ? `${o.orden} · ${o.texto}` : o.texto}
                        </span>
                        <input
                          id={idDeLaOpcion(o.id)}
                          className={`${estilos.entradaPuntos} ${estilos.campoQueFrena}`}
                          type="number"
                          step={1}
                          min={-PUNTOS_MAXIMOS}
                          max={PUNTOS_MAXIMOS}
                          aria-label={`Puntos de la opción «${o.texto}»`}
                          value={opciones[o.id]}
                          onChange={(e) => {
                            setOpciones((v) => ({ ...v, [o.id]: e.target.value }))
                            corregida(p.id)
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )
              })}
          </section>
        )
      })}
      {confirmando && (
        <div className={estilos.confirmacion} role="alertdialog" aria-label="Recalcular las notas">
          <span>{avisoAntesDeRecalcular(rindieron)}</span>
        </div>
      )}
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending}>
          {guardado.isPending ? 'Guardando…' : confirmando ? 'Sí, recalcular a todos' : 'Guardar los puntos'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
    </form>
  )
}

// ---------- Las instrucciones de la IA ----------

/** El texto que el backend usa cuando no hay con qué recalificar. */
const esSinSaldo = (mensaje: string) =>
  /saldo|apagada|suspendida|tope/i.test(mensaje)

/** Si el mensaje del backend ya dice que el cambio no se guardó (y por qué). */
const explicaQueNoSeGuardo = (mensaje: string) => /no se guardó/i.test(mensaje)

function CorregirLasInstrucciones({
  vacanteId,
  publicada,
  conNota,
  alTerminar,
  alCancelar,
}: {
  vacanteId: number
  publicada: VersionDePreguntas
  conNota: number
  alTerminar: (mensaje: string) => void
  alCancelar: () => void
}) {
  const [guia, setGuia] = useState(publicada.guiaCalificacion ?? '')
  const [queEvalua, setQueEvalua] = useState<Record<number, string>>(
    () => Object.fromEntries(publicada.criterios.map((c) => [c.id, c.queEvalua ?? ''])),
  )
  const abiertas = publicada.criterios.flatMap((c) => c.preguntas).filter((p) => p.tipo === 'ABIERTA')
  const [queDebeTener, setQueDebeTener] = useState<Record<number, string>>(
    () => Object.fromEntries(abiertas.map((p) => [p.id, p.queDebeTener ?? ''])),
  )
  const modoDelEditor = useModoDelEditor()
  // En la prueba (V67) se corrige también lo que debe tener cada entregable.
  const entregables = publicada.prueba?.entregables ?? []
  const [deEntregables, setDeEntregables] = useState<Record<number, string>>(
    () => Object.fromEntries(entregables.map((e) => [e.id, e.queDebeTener ?? ''])),
  )
  const [confirmando, setConfirmando] = useState(false)
  const [sinSaldo, setSinSaldo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const guardado = useMutation({
    mutationFn: () =>
      corregirInstrucciones(
        vacanteId,
        {
          guiaCalificacion: guia,
          criterios: publicada.criterios.map((c) => ({ id: c.id, texto: queEvalua[c.id] ?? '' })),
          preguntas: abiertas.map((p) => ({ id: p.id, texto: queDebeTener[p.id] ?? '' })),
          ...(entregables.length > 0
            ? { entregables: entregables.map((e) => ({ id: e.id, texto: deEntregables[e.id] ?? '' })) }
            : {}),
        },
        modoDelEditor.ruta,
      ),
    onSuccess: (r) =>
      alTerminar(
        r.personas === 0
          ? 'Instrucciones guardadas. Quien responda desde ahora se califica con ellas.'
          : `Instrucciones guardadas: se vuelve a calificar a ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}. Cada una conserva su nota hasta que llega la nueva.`,
      ),
    onError: (c) => {
      setConfirmando(false)
      const f = falloDe(c, 'No se pudieron guardar las instrucciones.')
      if (esSinSaldo(f.mensaje)) {
        setSinSaldo(f.mensaje)
        return
      }
      setFallo(f)
    },
  })

  return (
    <form
      className={estilos.criterios}
      aria-label="Corregir las instrucciones de la IA"
      onSubmit={(e) => {
        e.preventDefault()
        if (conNota > 0 && !confirmando) {
          setConfirmando(true)
          return
        }
        guardado.mutate()
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Guía de calificación para la IA{' '}
          <span className={estilos.cuenta}>(opcional · {guia.length} de 2000)</span>
        </span>
        <textarea className={estilos.area} rows={4} maxLength={2000} value={guia} onChange={(e) => setGuia(e.target.value)} />
      </label>
      {publicada.criterios.map((c) => (
        <section className={estilos.criterio} key={c.id}>
          <h3 className={estilos.nombreCriterio}>{c.nombre}</h3>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Qué evalúa</span>
            <textarea
              className={estilos.area}
              rows={2}
              maxLength={1000}
              value={queEvalua[c.id]}
              onChange={(e) => setQueEvalua((v) => ({ ...v, [c.id]: e.target.value }))}
            />
          </label>
          {c.preguntas
            .filter((p) => p.tipo === 'ABIERTA')
            .map((p) => (
              <div className={estilos.pregunta} key={p.id}>
                <ContenidoDePregunta pregunta={{ ...p, queDebeTener: null }} />
                <label className={estilos.campo}>
                  <span className={estilos.etiqueta}>Qué debe tener una buena respuesta</span>
                  <textarea
                    className={estilos.area}
                    rows={2}
                    maxLength={1000}
                    value={queDebeTener[p.id]}
                    onChange={(e) => setQueDebeTener((v) => ({ ...v, [p.id]: e.target.value }))}
                  />
                </label>
              </div>
            ))}
        </section>
      ))}
      {entregables.length > 0 && (
        <section className={estilos.criterio} aria-label="Los entregables">
          <h3 className={estilos.nombreCriterio}>Entregables</h3>
          {entregables.map((e) => (
            <label className={estilos.campo} key={e.id}>
              <span className={estilos.etiqueta}>Qué debe tener una buena entrega · {e.nombre}</span>
              <textarea
                className={estilos.area}
                rows={2}
                maxLength={1000}
                value={deEntregables[e.id]}
                onChange={(ev) => setDeEntregables((v) => ({ ...v, [e.id]: ev.target.value }))}
              />
            </label>
          ))}
        </section>
      )}
      {confirmando && (
        <div className={estilos.confirmacion} role="alertdialog" aria-label="Volver a calificar">
          <span>{avisoAntesDeRecalificar(conNota)}</span>
        </div>
      )}
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending}>
          {guardado.isPending ? 'Guardando…' : confirmando ? 'Sí, volver a calificar' : 'Guardar las instrucciones'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
      <Modal abierto={sinSaldo !== null} titulo="La IA no tiene saldo" onCerrar={() => setSinSaldo(null)}>
        {/* El motivo y por qué no se guardó los dice el servidor, como en «Reintentar»
            (QA-PP-09): la frase propia solo sale si su mensaje no lo explica ya. */}
        {sinSaldo !== null && !explicaQueNoSeGuardo(sinSaldo) && (
          <p className={estilos.explica}>
            No se puede recalificar ahora, así que el cambio no se guardó: guardarlo sin
            recalificar dejaría a unos candidatos medidos con una guía y a otros con otra.
          </p>
        )}
        <p className={estilos.explica}>{sinSaldo}</p>
      </Modal>
    </form>
  )
}
