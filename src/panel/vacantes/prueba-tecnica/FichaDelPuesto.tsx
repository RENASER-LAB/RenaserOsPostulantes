/**
 * La ficha del puesto: las diez preguntas al dueño, con sus palabras.
 *
 * Es la entrada obligatoria de la prueba tecnica. Se guarda a medias las veces
 * que haga falta —BORRADOR— y el servidor la declara COMPLETA cuando tiene lo
 * que el REDACTOR necesita; ese estado es el que enciende «pedir el
 * cuestionario» en la seccion de abajo.
 *
 * ⚠️ **Se guarda con un boton, no sola.** Son diez respuestas largas escritas
 * pensando; un guardado por tecla mandaria el formulario entero decenas de
 * veces y, como el PUT es un reemplazo completo, cada envio a medias es una
 * version a medias en el servidor. Lo que si se dice todo el rato es si hay
 * cambios sin guardar, comparando con lo ultimo que el servidor confirmo — la
 * regla de no dar por guardado lo que solo se ha enviado.
 *
 * ⚠️ **Los 22 campos viajan siempre.** `aCuerpo` recorre la lista entera; un
 * campo que se olvidara aqui se borraria en el servidor sin que nadie lo viera.
 *
 * ⚠️ **Los riesgos van en orden y sin huecos.** El orden es la velocidad de
 * daño y lo decide el dueño; el riesgo N+1 se apaga hasta que el N tenga
 * texto, que es la misma regla que el backend aplica con un 400. Igual las
 * eliminatorias (maximo dos, con la pregunta de control de la clienta) y los
 * requerimientos (maximo tres).
 *
 * El tamaño de la empresa lo deriva el servidor de la cifra de gente y con el
 * sugiere la version de pesos de la etapa 1: es la unica dependencia de la
 * prueba tecnica hacia atras, y por eso el boton de «usar estos pesos» vive
 * aqui y llama al mismo endpoint que el desplegable de la vacante.
 *
 * El panel no conoce permisos: un 403 al guardar retira el boton y dice cual
 * falta, como en el banco de preguntas.
 */

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import { asignarVersionPesos, guardarFichaDelPuesto } from '../../api/panel'
import type { FichaDelPuesto as Ficha } from '../../api/tipos'
import { claveDeLaFicha } from './consultas'
import {
  CONTROL_DE_ELIMINATORIA,
  ELIMINATORIAS,
  FAMILIAS,
  PREGUNTAS,
  REQUERIMIENTOS,
  RIESGOS,
  aCuerpo,
  conFamilia,
  deFicha,
  queLeFalta,
  tieneFamilia,
  type Borrador,
} from './guion'
import estilos from './FichaDelPuesto.module.css'

/** Lo que quedaria en el servidor si se mandara ahora, para comparar sin ruido de espacios. */
const huella = (borrador: Borrador) => JSON.stringify(aCuerpo(borrador))

export function FichaDelPuesto({
  vacanteId,
  ficha,
}: {
  vacanteId: number
  /** Lo ultimo que confirmo el servidor. `null` = todavia no se ha empezado. */
  ficha: Ficha | null
}) {
  const cache = useQueryClient()
  const [borrador, setBorrador] = useState<Borrador>(() => deFicha(ficha))
  // Lo ultimo que confirmo el servidor, por dos caminos: el prop (la consulta
  // de la pagina, que cambia p. ej. al asignar los pesos) y la respuesta del
  // PUT. Se compara contra esto, no contra el prop a secas: la respuesta del
  // guardado ES una confirmacion aunque la consulta tarde un render en verla.
  const [confirmada, setConfirmada] = useState<Ficha | null>(ficha)
  useEffect(() => {
    setConfirmada(ficha)
  }, [ficha])
  const [fallo, setFallo] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [guardadaEn, setGuardadaEn] = useState<number | null>(null)

  const guardado = useMutation({
    // El borrador viaja como variable y no se lee del cierre: asi `onSuccess`
    // sabe exactamente que se mando y puede compararlo con lo que hay ahora.
    mutationFn: (enviado: Borrador) => guardarFichaDelPuesto(vacanteId, aCuerpo(enviado)),
    onSuccess: async (guardada, enviado) => {
      // La respuesta ES la ficha confirmada: se pone en la cache (cancelando
      // antes un GET en vuelo, que si llegara despues la pisaria con lo viejo)
      // y el borrador se alinea con ella —recortes de espacios incluidos— asi
      // «sin guardar» vuelve a ser falso por comparacion, no por decreto.
      //
      // ⚠️ Solo si nadie escribio mientras el PUT viajaba. Los campos no se
      // apagan al guardar, y sustituir a ciegas borraba lo tecleado en ese
      // medio segundo sin decir nada: el QA lo reprodujo.
      await cache.cancelQueries({ queryKey: claveDeLaFicha(vacanteId) })
      cache.setQueryData(claveDeLaFicha(vacanteId), guardada)
      setConfirmada(guardada)
      setBorrador((actual) => (huella(actual) === huella(enviado) ? deFicha(guardada) : actual))
      setFallo(null)
      setGuardadaEn(Date.now())
    },
    onError: (causa) => {
      if (causa instanceof ErrorApi && causa.estado === 403) {
        setSinPermiso(true)
        return
      }
      setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar la ficha.')
    },
  })

  const pesos = useMutation({
    mutationFn: (versionPesosId: number) => asignarVersionPesos(vacanteId, versionPesosId),
    onSuccess: async () => {
      // La vacante cambia (su versionPesosId) y la ficha tambien (yaAsignada).
      await cache.invalidateQueries({ queryKey: ['panel-vacante', vacanteId] })
      await cache.invalidateQueries({ queryKey: claveDeLaFicha(vacanteId) })
    },
    onError: (causa) => {
      if (causa instanceof ErrorApi && causa.estado === 403) {
        setSinPermiso(true)
        return
      }
      setFallo(causa instanceof Error ? causa.message : 'No se pudieron asignar los pesos.')
    },
  })

  const sucio = huella(borrador) !== huella(deFicha(confirmada))
  const faltan = queLeFalta(borrador)

  // Cerrar la pestaña con cambios sin guardar pregunta antes. Solo eso: dentro
  // del portal no hay enrutador de datos que bloquee la navegacion, asi que lo
  // que se hace es decirlo en pantalla todo el rato.
  useEffect(() => {
    if (!sucio) {
      return
    }
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => {
      window.removeEventListener('beforeunload', avisar)
    }
  }, [sucio])

  const escribir = (campo: keyof Borrador, valor: string) =>
    setBorrador((b) => ({ ...b, [campo]: valor }))

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (sinPermiso || guardado.isPending) return
    guardado.mutate(borrador)
  }

  return (
    <form className={estilos.ficha} onSubmit={enviar} aria-label="La ficha del puesto">
      <div className={estilos.cabecera}>
        <p className={estilos.explica}>
          Con tus palabras y sin lenguaje de recursos humanos: el agente escribe el cuestionario a
          partir de lo que cuentes aquí. Se puede guardar a medias y volver.
        </p>
        <Chip ficha={confirmada} />
      </div>

      <ol className={estilos.preguntas}>
        {PREGUNTAS.map((p) => (
          <li key={p.campo} className={estilos.pregunta}>
            <label className={estilos.campo}>
              <span className={estilos.titulo}>
                Q{p.numero} · {p.titulo}
                {p.opcional && <span className={estilos.opcional}> · opcional</span>}
              </span>
              <span className={estilos.enunciado}>{p.pregunta}</span>
              <textarea
                className={estilos.area}
                value={borrador[p.campo]}
                onChange={(e) => escribir(p.campo, e.target.value)}
                rows={3}
              />
              <span className={estilos.ayuda}>{p.ayuda}</span>
            </label>

            {p.campo === 'q5Estructura' && (
              <div className={estilos.cifras}>
                <label className={estilos.campoCifra}>
                  <span className={estilos.titulo}>Cuánta gente hay en la empresa</span>
                  <input
                    className={estilos.entrada}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={borrador.genteEnEmpresa}
                    onChange={(e) => escribir('genteEnEmpresa', e.target.value)}
                  />
                </label>
                <label className={estilos.campoCifra}>
                  <span className={estilos.titulo}>Cuántas personas tendrá a cargo</span>
                  <input
                    className={estilos.entrada}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={borrador.genteACargo}
                    onChange={(e) => escribir('genteACargo', e.target.value)}
                  />
                </label>
                <Tamano ficha={confirmada} pesos={pesos} sinPermiso={sinPermiso} />
              </div>
            )}

            {p.campo === 'q2Riesgo' && (
              <fieldset className={estilos.grupo}>
                <legend className={estilos.titulo}>Los cuatro riesgos, en orden</legend>
                <p className={estilos.ayuda}>
                  Cortos, uno por casilla. El 1 es el que se nota primero si contratas mal: el
                  orden es la velocidad del daño, no la importancia, y manda en el cuestionario.
                </p>
                {RIESGOS.map((campo, i) => {
                  const anterior = i === 0 ? null : (RIESGOS[i - 1] ?? null)
                  const apagado = anterior !== null && borrador[anterior].trim() === ''
                  return (
                    <label key={campo} className={estilos.campoCorto}>
                      <span className={estilos.etiqueta}>
                        Riesgo {i + 1}
                        {i === 0 ? ' · el que se nota primero' : ''}
                      </span>
                      <input
                        className={estilos.entrada}
                        type="text"
                        value={borrador[campo]}
                        onChange={(e) => escribir(campo, e.target.value)}
                        disabled={apagado}
                        maxLength={500}
                      />
                    </label>
                  )
                })}
              </fieldset>
            )}

            {p.campo === 'q4EpocaDorada' && (
              <fieldset className={estilos.grupo}>
                <legend className={estilos.titulo}>Las eliminatorias · máximo dos</legend>
                <p className={estilos.ayuda}>{CONTROL_DE_ELIMINATORIA}</p>
                {ELIMINATORIAS.map((campo, i) => {
                  const anterior = i === 0 ? null : (ELIMINATORIAS[i - 1] ?? null)
                  const apagado = anterior !== null && borrador[anterior].trim() === ''
                  return (
                    <label key={campo} className={estilos.campoCorto}>
                      <span className={estilos.etiqueta}>Eliminatoria {i + 1}</span>
                      <input
                        className={estilos.entrada}
                        type="text"
                        value={borrador[campo]}
                        onChange={(e) => escribir(campo, e.target.value)}
                        disabled={apagado}
                        maxLength={500}
                      />
                    </label>
                  )
                })}
              </fieldset>
            )}

            {p.campo === 'q9Requerimientos' && (
              <fieldset className={estilos.grupo}>
                <legend className={estilos.titulo}>Los requerimientos · máximo tres</legend>
                {REQUERIMIENTOS.map((campo, i) => {
                  const anterior = i === 0 ? null : (REQUERIMIENTOS[i - 1] ?? null)
                  const apagado = anterior !== null && borrador[anterior].trim() === ''
                  return (
                    <label key={campo} className={estilos.campoCorto}>
                      <span className={estilos.etiqueta}>Requerimiento {i + 1}</span>
                      <input
                        className={estilos.entrada}
                        type="text"
                        value={borrador[campo]}
                        onChange={(e) => escribir(campo, e.target.value)}
                        disabled={apagado}
                        maxLength={500}
                      />
                    </label>
                  )
                })}
              </fieldset>
            )}
          </li>
        ))}
      </ol>

      <fieldset className={estilos.grupo}>
        <legend className={estilos.titulo}>De qué familia es el puesto</legend>
        <p className={estilos.ayuda}>
          Una o más. Decide con qué vocabulario se lee lo que conteste el candidato; él nunca ve
          la lista.
        </p>
        <div className={estilos.familias}>
          {FAMILIAS.map((f) => (
            <label key={f.codigo} className={estilos.familia}>
              <input
                type="checkbox"
                checked={tieneFamilia(borrador.familias, f.codigo)}
                onChange={(e) =>
                  escribir('familias', conFamilia(borrador.familias, f.codigo, e.target.checked))
                }
              />
              <span>
                <b>
                  {f.codigo} {f.nombre}
                </b>
                <span className={estilos.pista}> · {f.pista}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={estilos.acciones}>
        {!sinPermiso && (
          <button
            className={estilos.guardar}
            type="submit"
            disabled={guardado.isPending}
            aria-busy={guardado.isPending}
          >
            {guardado.isPending ? 'Guardando…' : 'Guardar la ficha'}
          </button>
        )}
        {sucio ? (
          <span className={estilos.sinGuardar} role="status">
            Hay cambios sin guardar.
          </span>
        ) : (
          guardadaEn !== null && (
            <span className={estilos.guardada} role="status">
              Guardada.
            </span>
          )
        )}
      </div>

      {faltan.length > 0 ? (
        <p className={estilos.faltan}>
          Para que quede completa falta: {faltan.join(', ')}.
        </p>
      ) : (
        // Solo mientras haya algo sin guardar: despues de guardar, quien dice
        // si esta completa es el chip del servidor, y esto no puede contradecirlo.
        sucio &&
        confirmada?.estado !== 'COMPLETA' && (
          <p className={estilos.faltan}>No falta nada de la lista: al guardar quedará completa.</p>
        )
      )}

      {sinPermiso && (
        <p className={estilos.sinPermiso} role="status">
          Se retiró guardar: hace falta el permiso «editar_vacante». Lo escrito se puede leer,
          pero no se guarda desde este usuario.
        </p>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </form>
  )
}

/** BORRADOR o COMPLETA, tal como lo dijo el servidor. Sin ficha, todavia no hay nada. */
function Chip({ ficha }: { ficha: Ficha | null }) {
  if (!ficha) {
    return <span className={estilos.chipVacio}>Sin empezar</span>
  }
  if (ficha.estado === 'COMPLETA') {
    return <span className={estilos.chipCompleta}>Completa</span>
  }
  return <span className={estilos.chipBorrador}>A medias</span>
}

/**
 * El tamaño que el servidor derivo y los pesos que sugiere.
 *
 * Solo aparece con una ficha guardada que traiga cifra: es un dato del
 * servidor, no algo que el panel calcule al vuelo — la regla de los bordes
 * (30/31, 200/201) vive alla y aqui no se duplica.
 */
function Tamano({
  ficha,
  pesos,
  sinPermiso,
}: {
  ficha: Ficha | null
  pesos: { mutate: (id: number) => void; isPending: boolean }
  sinPermiso: boolean
}) {
  if (!ficha?.tamano) return null
  const sugeridos = ficha.pesosSugeridos
  return (
    <p className={estilos.tamano} role="status">
      Por la gente en la empresa, el puesto es <b>{ficha.tamano}</b>.{' '}
      {sugeridos === null ? (
        'No hay una versión de pesos publicada para ese tamaño; rigen los de la vacante.'
      ) : sugeridos.yaAsignada ? (
        <>
          Ya rigen los pesos «{sugeridos.etiqueta}» en esta vacante.
        </>
      ) : (
        <>
          Le corresponden los pesos «{sugeridos.etiqueta}».{' '}
          {!sinPermiso && (
            <button
              className={estilos.usarPesos}
              type="button"
              onClick={() => pesos.mutate(sugeridos.id)}
              disabled={pesos.isPending}
            >
              {pesos.isPending ? 'Asignando…' : 'Usar estos pesos'}
            </button>
          )}
        </>
      )}
    </p>
  )
}
