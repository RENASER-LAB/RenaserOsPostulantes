/**
 * El cuestionario tecnico de la vacante: pedirselo a la IA, revisarlo y publicarlo.
 *
 * El agente REDACTOR escribe un borrador a partir de la ficha del puesto, con la
 * estructura fija del nivel y la guia de calificacion de cada pregunta (C3, C4 y
 * señal de 0). **La IA propone y el dueño publica**: nada de lo que se ve aqui
 * llega a un candidato hasta que alguien pulsa «Publicar», y eso vuelve a pasar
 * la aduana entera en el servidor.
 *
 * ⚠️ **Pedir no es tener.** El POST contesta 202 al momento y la IA tarda uno o
 * dos minutos. Lo unico cierto tras el 202 es que se pidio, y por eso aqui no
 * se escribe «listo» ni «generado» hasta que el GET traiga preguntas. Es la
 * regla de `CalificarConIa.tsx`, con la diferencia de que aqui **si** hay
 * endpoint de estado: `generacion` dice SIN_PEDIR, EN_CURSO, FALLIDA o LISTA.
 *
 * **Como se entera: el mismo sondeo acotado.** Mientras `generacion` sea
 * EN_CURSO se refresca unas cuantas veces con los huecos creciendo y se para;
 * si al abrir la pagina ya esta EN_CURSO, arranca solo. Al llegar LISTA o
 * FALLIDA se corta, que seguir refrescando lo que ya termino es tirar
 * peticiones. Al agotarse no dice que fallo —no lo sabe— dice que dejo de mirar.
 *
 * ⚠️ **`encolada=false` no es un error.** Significa que ya hay una generacion
 * viva o que la IA esta apagada para esta empresa, y las dos se resuelven
 * esperando o hablando con quien administra: nube hundida y `role="status"`.
 *
 * ⚠️ **El 400 de publicar es una lista, no una linea.** El servidor junta los
 * errores de la aduana con « · » y aqui se vuelven a separar: quien lee tiene
 * que saber cuantas cosas hay que corregir y cuales.
 *
 * ⚠️ **La PRESENCIAL se pinta distinta y se dice por que.** Es la muestra de
 * trabajo, se marca en el borrador y **nunca se envia al candidato**: se ve
 * aqui para que el dueño la use en su entrevista, no para que la corrija como
 * si fuera una mas.
 */

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import {
  corregirPreguntaTecnica,
  generarCuestionarioTecnico,
  publicarCuestionarioTecnico,
  verCuestionarioTecnico,
} from '../../api/panel'
import type { CuestionarioTecnico as Cuestionario, PreguntaDelCuestionario } from '../../api/tipos'
import { Modal } from '@/ui/Modal'
import { Vacio } from '@/ui/Vacio'
import { useSondeoAcotado } from '../useSondeoAcotado'
import { GENERACION, agruparPorBloque, erroresDeLaAduana } from './bloques'
import { claveDelCuestionario } from './consultas'
import estilos from './CuestionarioTecnico.module.css'

/**
 * Cada cuanto se vuelve a mirar mientras el REDACTOR trabaja. Tarda uno o dos
 * minutos, asi que se mira mas espaciado que las notas de una persona; la
 * longitud del array es el tope y es lo que se le dice a quien mira.
 */
const PASOS_REDACTOR = [15_000, 20_000, 30_000, 40_000, 60_000, 60_000] as const

type Fallo = { texto: string; permiso: boolean }

/**
 * Por que no se pudo. Un 403 es el reparto de permisos funcionando y no se
 * reintenta; un 400 o 409 es el servidor explicando una regla, y se pinta tal
 * cual; un 500 se reintenta, y hay que decir que no quedo nada en cola.
 */
function explicarFallo(causa: unknown, que: string): Fallo {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 403) {
      return {
        permiso: true,
        texto: `Tu rol no puede ${que}: hace falta el permiso «editar_vacante». Pídeselo a quien administra los permisos del panel.`,
      }
    }
    if (causa.estado === 404) {
      return {
        permiso: true,
        texto: 'El servidor no encuentra esta vacante, o queda fuera de tu alcance. No se hizo nada.',
      }
    }
    if (causa.estado >= 500) {
      return {
        permiso: false,
        texto: `El servidor falló al ${que} (error ${causa.estado}). No se hizo nada: vuelve a intentarlo, y si se repite avisa a quien mantiene el backend.`,
      }
    }
    return { permiso: false, texto: causa.message }
  }
  return {
    permiso: false,
    texto:
      causa instanceof Error
        ? `No llegamos a pedirlo: ${causa.message}`
        : 'No llegamos a pedirlo. Comprueba la conexión y vuelve a intentarlo.',
  }
}

export function CuestionarioTecnico({
  vacanteId,
  fichaCompleta,
}: {
  vacanteId: number
  /** Sin ficha COMPLETA el servidor rechaza generar (409), asi que el boton no se ofrece. */
  fichaCompleta: boolean
}) {
  const cache = useQueryClient()
  const cuestionario = useQuery({
    queryKey: claveDelCuestionario(vacanteId),
    queryFn: () => verCuestionarioTecnico(vacanteId),
  })
  const refrescar = () => {
    void cache.invalidateQueries({ queryKey: claveDelCuestionario(vacanteId) })
  }
  const sondeo = useSondeoAcotado(PASOS_REDACTOR, refrescar)

  const [pidiendo, setPidiendo] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const [noSeEncolo, setNoSeEncolo] = useState(false)
  const [preguntandoRegenerar, setPreguntandoRegenerar] = useState(false)
  const [aduana, setAduana] = useState<string[] | null>(null)
  const [publicadoAhora, setPublicadoAhora] = useState(false)

  const generacion = cuestionario.data?.generacion
  const enCurso = generacion === GENERACION.EN_CURSO

  // El sondeo sigue al servidor y no al boton: si al abrir ya esta EN_CURSO
  // arranca solo, y en cuanto deja de estarlo se corta (y olvida la cuenta)
  // aunque queden vueltas. `agotado` evita que un EN_CURSO eterno (IA apagada
  // a medias) lo reinicie sin fin: agotado se queda agotado hasta que el
  // servidor salga de EN_CURSO o alguien vuelva a pedir.
  const { mirando, agotado, empezar, parar } = sondeo
  useEffect(() => {
    if (generacion === undefined) {
      return
    }
    if (enCurso && !mirando && !agotado) {
      empezar()
    } else if (!enCurso && (mirando || agotado)) {
      parar()
    }
  }, [generacion, enCurso, mirando, agotado, empezar, parar])

  async function pedir() {
    setPreguntandoRegenerar(false)
    setPidiendo(true)
    setFallo(null)
    setNoSeEncolo(false)
    setAduana(null)
    setPublicadoAhora(false)
    try {
      const respuesta = await generarCuestionarioTecnico(vacanteId)
      if (!respuesta?.encolada) {
        setNoSeEncolo(true)
        return
      }
      // ⚠️ El boton sigue apagado hasta que el GET vuelva diciendo EN_CURSO.
      // Soltarlo con el 202 abria una ventana de medio segundo en la que
      // `generacion` aun decia SIN_PEDIR: el sondeo se cortaba solo, no se
      // veia «esta redactando» y un segundo clic mandaba un segundo POST que
      // el servidor frenaba con «ya hay una en curso» — por el propio clic.
      await cache.invalidateQueries({ queryKey: claveDelCuestionario(vacanteId) })
    } catch (causa) {
      setFallo(explicarFallo(causa, 'pedirle el cuestionario a la IA'))
    } finally {
      setPidiendo(false)
    }
  }

  const publicacion = useMutation({
    mutationFn: () => publicarCuestionarioTecnico(vacanteId),
    onSuccess: () => {
      setAduana(null)
      setFallo(null)
      setPublicadoAhora(true)
      refrescar()
    },
    onError: (causa) => {
      if (causa instanceof ErrorApi && causa.estado === 400) {
        setAduana(erroresDeLaAduana(causa.message))
        return
      }
      setFallo(explicarFallo(causa, 'publicar el cuestionario'))
    },
  })

  if (cuestionario.isPending) {
    return <p className={estilos.cargando}>Cargando el cuestionario…</p>
  }
  if (cuestionario.isError) {
    const causa = cuestionario.error
    return causa instanceof ErrorApi && causa.estado === 403 ? (
      <p className={estilos.sinCambios} role="status">
        No se puede ver el cuestionario: hace falta el permiso «ver_vacantes».
      </p>
    ) : (
      <p className={estilos.avisoMalo} role="alert">
        {causa instanceof Error ? causa.message : 'No se pudo cargar el cuestionario.'}
      </p>
    )
  }

  const c = cuestionario.data
  const hayBorrador = c.estado === 'BORRADOR'
  const grupos = agruparPorBloque(c.preguntas)
  const ocupado = pidiendo || enCurso || sondeo.mirando || publicacion.isPending
  const puedeGenerar = fichaCompleta && !ocupado && !fallo?.permiso

  const botonGenerar = (
    <button
      className={c.preguntas.length === 0 ? estilos.generar : estilos.regenerar}
      type="button"
      onClick={c.preguntas.length === 0 ? pedir : () => setPreguntandoRegenerar(true)}
      disabled={!puedeGenerar}
      aria-busy={pidiendo}
    >
      {pidiendo
        ? 'Pidiéndolo…'
        : c.preguntas.length === 0
          ? 'Pedirle el cuestionario a la IA'
          : 'Volver a generar'}
    </button>
  )

  return (
    <div className={estilos.cuestionario}>
      <div className={estilos.cabecera}>
        <p className={estilos.explica}>
          La IA escribe el borrador con la estructura fija del nivel y la guía de calificación
          de cada pregunta. Tú lo corriges con tus palabras y lo publicas: hasta entonces ningún
          candidato lo ve. Cada generación cuenta contra el tope de IA de tu empresa.
        </p>
        <Chip cuestionario={c} />
      </div>

      {enCurso && sondeo.mirando && (
        <p className={estilos.esperando} role="status">
          <b>La IA está redactando el cuestionario.</b> Tarda uno o dos minutos. Refrescamos por
          ti: {sondeo.vueltas} de {sondeo.total} veces. Las preguntas que aparezcan salen del
          servidor.
        </p>
      )}

      {enCurso && sondeo.agotado && (
        <p className={estilos.agotado} role="status">
          Dejamos de refrescar después de {sondeo.total} intentos. <b>No quiere decir que
          fallara</b>: la generación sigue su curso en el servidor —con el tope de IA agotado
          espera a que haya cupo—. Vuelve a mirar dentro de un rato.{' '}
          <button className={estilos.mirarOtraVez} type="button" onClick={refrescar}>
            Mirar otra vez
          </button>
        </p>
      )}

      {generacion === GENERACION.FALLIDA && !pidiendo && (
        <p className={estilos.avisoMalo} role="alert">
          La última generación falló: la IA no consiguió un cuestionario que pase la aduana, o
          se agotaron los reintentos. Se puede volver a pedir.
        </p>
      )}

      {c.desactualizado && !enCurso && (
        <p className={estilos.sinCambios} role="status">
          <b>La ficha cambió después de generar este cuestionario.</b> Puedes volver a generarlo
          con la ficha nueva, o seguir con este tal cual.
        </p>
      )}

      {noSeEncolo && (
        <p className={estilos.sinCambios} role="status">
          <b>No se encoló nada.</b> Ya hay una generación en curso para esta vacante, o la IA
          está apagada para tu empresa.{' '}
          <button className={estilos.mirarOtraVez} type="button" onClick={refrescar}>
            Mirar otra vez
          </button>
        </p>
      )}

      {fallo &&
        (fallo.permiso ? (
          <p className={estilos.sinCambios} role="status">
            {fallo.texto}
          </p>
        ) : (
          <p className={estilos.avisoMalo} role="alert">
            {fallo.texto}
          </p>
        ))}

      {aduana && (
        <div className={estilos.avisoMalo} role="alert">
          <div>
            <b>El cuestionario no pasa la aduana.</b> Corrige esto y vuelve a publicar:
            <ul className={estilos.listaAduana}>
              {aduana.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {publicadoAhora && c.estado === 'PUBLICADA' && (
        <p className={estilos.publicado} role="status">
          Publicado. Este es el cuestionario que rendirá quien llegue a la prueba técnica de
          esta vacante.
        </p>
      )}

      {c.preguntas.length === 0 ? (
        !enCurso && (
          <Vacio
            titulo="Todavía no hay cuestionario"
            accion={
              fichaCompleta ? (
                botonGenerar
              ) : (
                <span className={estilos.completaLaFicha}>
                  Completa la ficha del puesto primero: el agente escribe a partir de ella.
                </span>
              )
            }
          >
            {fichaCompleta
              ? 'La ficha está completa. Pídele a la IA el borrador y revísalo aquí antes de publicarlo.'
              : 'Se pide con la ficha completa, y se revisa aquí antes de publicarlo.'}
          </Vacio>
        )
      ) : (
        <>
          <div className={estilos.bloques}>
            {grupos.map((g) => (
              <section key={g.bloque} className={estilos.bloque}>
                <h3 className={estilos.tituloBloque}>{g.nombre}</h3>
                {g.explica && <p className={estilos.explicaBloque}>{g.explica}</p>}
                {g.preguntas.map((p) => (
                  <Tarjeta
                    key={p.id}
                    vacanteId={vacanteId}
                    pregunta={p}
                    editable={hayBorrador && !ocupado && fallo?.permiso !== true}
                    alCorregir={refrescar}
                    alFaltarPermiso={() =>
                      setFallo(explicarFallo(new ErrorApi(403, ''), 'corregir el cuestionario'))
                    }
                  />
                ))}
              </section>
            ))}
          </div>

          <div className={estilos.acciones}>
            {hayBorrador && (
              <button
                className={estilos.publicar}
                type="button"
                onClick={() => publicacion.mutate()}
                disabled={ocupado || fallo?.permiso === true}
                aria-busy={publicacion.isPending}
              >
                {publicacion.isPending ? 'Publicando…' : 'Publicar el cuestionario'}
              </button>
            )}
            {botonGenerar}
            {!fichaCompleta && (
              <span className={estilos.completaLaFicha}>
                Para volver a generar, completa la ficha del puesto.
              </span>
            )}
          </div>
        </>
      )}

      <Modal
        abierto={preguntandoRegenerar}
        titulo="¿Volver a generar el cuestionario?"
        onCerrar={() => setPreguntandoRegenerar(false)}
        pie={
          <>
            <button className={estilos.confirmar} type="button" onClick={pedir}>
              Sí, volver a generar
            </button>
            <button
              className={estilos.cancelar}
              type="button"
              onClick={() => setPreguntandoRegenerar(false)}
            >
              Mejor no
            </button>
          </>
        }
      >
        <p>
          {hayBorrador
            ? 'El borrador de ahora, con las correcciones que le hayas hecho, se archiva y lo reemplaza uno nuevo escrito desde cero con la ficha actual.'
            : 'El cuestionario publicado sigue vigente: la IA escribe un borrador nuevo aparte, y solo lo reemplaza cuando publiques ese borrador.'}{' '}
          Cuenta como una generación más contra el tope de IA.
        </p>
      </Modal>
    </div>
  )
}

/** Sin cuestionario, borrador o publicado: lo que dijo el servidor. */
function Chip({ cuestionario }: { cuestionario: Cuestionario }) {
  if (cuestionario.estado === 'PUBLICADA') {
    return <span className={estilos.chipPublicado}>Publicado</span>
  }
  if (cuestionario.estado === 'BORRADOR') {
    return <span className={estilos.chipBorrador}>Borrador · sin publicar</span>
  }
  return <span className={estilos.chipBorrador}>Sin cuestionario</span>
}

/**
 * Una pregunta con su guia, y el modo de corregirla.
 *
 * ⚠️ Corregir manda los cuatro campos aunque cambie uno: el PUT es un
 * reemplazo. Y solo se ofrece sobre el borrador; sobre lo publicado no hay
 * boton, porque cambiarlo con candidatos midiendose seria mover la vara.
 */
function Tarjeta({
  vacanteId,
  pregunta,
  editable,
  alCorregir,
  alFaltarPermiso,
}: {
  vacanteId: number
  pregunta: PreguntaDelCuestionario
  editable: boolean
  alCorregir: () => void
  alFaltarPermiso: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState({
    enunciado: pregunta.enunciado,
    c3Esperado: pregunta.c3Esperado ?? '',
    c4Esperado: pregunta.c4Esperado ?? '',
    senalDeCero: pregunta.senalDeCero ?? '',
  })
  const [fallo, setFallo] = useState<string | null>(null)

  const correccion = useMutation({
    mutationFn: () =>
      corregirPreguntaTecnica(vacanteId, pregunta.id, {
        enunciado: campos.enunciado.trim(),
        c3Esperado: campos.c3Esperado.trim() || null,
        c4Esperado: campos.c4Esperado.trim() || null,
        senalDeCero: campos.senalDeCero.trim() || null,
      }),
    onSuccess: () => {
      setEditando(false)
      setFallo(null)
      alCorregir()
    },
    onError: (causa) => {
      if (causa instanceof ErrorApi && causa.estado === 403) {
        setEditando(false)
        alFaltarPermiso()
        return
      }
      setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar la corrección.')
    },
  })

  const empezar = () => {
    setCampos({
      enunciado: pregunta.enunciado,
      c3Esperado: pregunta.c3Esperado ?? '',
      c4Esperado: pregunta.c4Esperado ?? '',
      senalDeCero: pregunta.senalDeCero ?? '',
    })
    setFallo(null)
    setEditando(true)
  }

  const escribir = (campo: keyof typeof campos, valor: string) =>
    setCampos((v) => ({ ...v, [campo]: valor }))

  return (
    <article
      className={pregunta.presencial ? estilos.tarjetaPresencial : estilos.tarjeta}
      aria-label={`Pregunta ${pregunta.codigo}`}
    >
      <header className={estilos.cabeceraTarjeta}>
        <span className={estilos.codigo}>{pregunta.codigo}</span>
        {pregunta.presencial && (
          <span className={estilos.marcaPresencial}>
            Presencial · no se envía al candidato, es para tu entrevista
          </span>
        )}
      </header>

      {editando ? (
        <div className={estilos.edicion}>
          <label className={estilos.campoEdicion}>
            <span className={estilos.etiqueta}>Enunciado</span>
            <textarea
              className={estilos.area}
              value={campos.enunciado}
              onChange={(e) => escribir('enunciado', e.target.value)}
              rows={3}
            />
          </label>
          <label className={estilos.campoEdicion}>
            <span className={estilos.etiqueta}>C3 · el dato duro que se espera</span>
            <textarea
              className={estilos.area}
              value={campos.c3Esperado}
              onChange={(e) => escribir('c3Esperado', e.target.value)}
              rows={2}
            />
          </label>
          <label className={estilos.campoEdicion}>
            <span className={estilos.etiqueta}>C4 · la parte incómoda</span>
            <textarea
              className={estilos.area}
              value={campos.c4Esperado}
              onChange={(e) => escribir('c4Esperado', e.target.value)}
              rows={2}
            />
          </label>
          <label className={estilos.campoEdicion}>
            <span className={estilos.etiqueta}>Señal de 0</span>
            <textarea
              className={estilos.area}
              value={campos.senalDeCero}
              onChange={(e) => escribir('senalDeCero', e.target.value)}
              rows={2}
            />
          </label>
          <div className={estilos.accionesTarjeta}>
            <button
              className={estilos.confirmar}
              type="button"
              onClick={() => correccion.mutate()}
              disabled={correccion.isPending || campos.enunciado.trim() === ''}
            >
              {correccion.isPending ? 'Guardando…' : 'Guardar la corrección'}
            </button>
            <button
              className={estilos.cancelar}
              type="button"
              onClick={() => setEditando(false)}
              disabled={correccion.isPending}
            >
              Cancelar
            </button>
          </div>
          {fallo && (
            <p className={estilos.avisoMalo} role="alert">
              {fallo}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className={estilos.enunciado}>{pregunta.enunciado}</p>
          <dl className={estilos.guia}>
            <div>
              <dt>C3 · dato duro</dt>
              <dd>{pregunta.c3Esperado ?? <span className={estilos.sinGuia}>sin guía</span>}</dd>
            </div>
            <div>
              <dt>C4 · lo incómodo</dt>
              <dd>{pregunta.c4Esperado ?? <span className={estilos.sinGuia}>sin guía</span>}</dd>
            </div>
            <div>
              <dt>Señal de 0</dt>
              <dd>{pregunta.senalDeCero ?? <span className={estilos.sinGuia}>sin guía</span>}</dd>
            </div>
          </dl>
          {editable && (
            <div className={estilos.accionesTarjeta}>
              <button className={estilos.corregir} type="button" onClick={empezar}>
                Corregir
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}
