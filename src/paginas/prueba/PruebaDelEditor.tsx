/**
 * La prueba técnica del editor, en curso: una pregunta por pantalla.
 *
 * Hasta el 09/10/2026 iba toda en vertical —el caso a un lado, todas las preguntas seguidas y
 * los entregables debajo— mientras la evaluación del mismo proceso iba de una en una. Ahora las
 * dos usan el mismo marco (`../unaPorPantalla`), el de la maqueta aprobada el 06/10/2026: barra
 * fija, mapa con su leyenda, tarjeta de la pregunta, y aquí además el caso siempre a mano en un
 * lateral y los entregables generales como paso final.
 *
 * **El guardado pasó a la cola de la evaluación** (`useColaDeRespuestas`). Con una pregunta por
 * pantalla, las que no se ven tienen que seguir reintentando y contar en lo que falta: antes cada
 * pregunta guardaba por su cuenta mientras estaba montada, y lo que faltaba para entregar lo
 * sabían solo las preguntas pintadas. Ahora el mapa y lo que falta salen de las respuestas de
 * **todas** las preguntas —lo que trae el servidor, más lo puesto en esta sesión—.
 *
 * Lo que no cambia: lo que hace falta para entregar (todas respondidas y los obligatorios
 * subidos) y lo que pasa al vencer (se entrega sola si está completa; si no, queda «sin
 * completar»). Ver `specs/Done/editor-de-la-prueba-mas-simple.md`. La pantalla previa es
 * `FichaPrevia.tsx`, y desde el 10/10/2026 el caso, los materiales y las preguntas solo llegan
 * del servidor al empezar: aquí ya están siempre.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '@/api/cliente'
import { entregarPrueba, responderPrueba, responderPruebaCerrada } from '@/api/prueba'
import type { EntregableRequerido, MiPrueba, PreguntaPrueba } from '@/api/tipos'
import { fechaLargaDeLima } from '@/dominio/horaDeLima'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro, QUEDA_POCO } from '@/ui/Cronometro'
import { IconoDesplegar, IconoPlegar } from '@/ui/Iconos'
import { Modal } from '@/ui/Modal'
import { TextoPlano } from '@/ui/TextoPlano'
import { useColaDeRespuestas } from '../evaluacion/useColaDeRespuestas'
import {
  BarraDelMarco,
  HojaDelMapa,
  LoQueFaltaParaEntregar,
  MapaDePreguntas,
  TarjetaDePregunta,
  etiquetaDePregunta,
  primerCampo,
  rotuloDeVolver,
  useQuedaMenosDe,
  type Guardado,
} from '../unaPorPantalla/Marco'
import { asomar, useCorte, useRecorrido, type Paso } from '../unaPorPantalla/useRecorrido'
import marco from '../unaPorPantalla/Marco.module.css'
import { CasoEnElLateral } from './ElCaso'
import { Entregable, controlDelEntregable } from './Entregable'
import { RespuestaCerrada, type RespuestaCerradaValor } from './PreguntaCerrada'
import estilos from './Prueba.module.css'

/** El mismo `@Size` del backend que en la evaluacion. */
const MAXIMO_DEL_TEXTO = 20_000

/** Lo que se manda de una pregunta: el texto de una abierta, o lo marcado en una cerrada. */
type Valor = { texto: string } | RespuestaCerradaValor

const ENTREGABLES = 'entregables'
const claveDe = (id: number) => `p:${id}`

/** Lo que el servidor tiene de una pregunta, con la forma que se manda. */
function delServidor(p: PreguntaPrueba): Valor {
  if (p.tipo === 'ABIERTA') return { texto: p.respuestaTexto ?? '' }
  if (p.tipo === 'OPCION_MULTIPLE') return { marcadas: p.respuestaMarcadas ?? [] }
  return { opcionId: p.respuestaOpcionId ?? null }
}

function respondida(v: Valor): boolean {
  if ('texto' in v) return v.texto.trim() !== ''
  if ('marcadas' in v) return v.marcadas.length > 0
  return v.opcionId !== null
}

/** La pregunta tal como queda en el servidor después de guardar `v`. */
function conRespuesta(p: PreguntaPrueba, v: Valor): PreguntaPrueba {
  if ('texto' in v) return { ...p, respuestaTexto: v.texto.trim() ? v.texto : null }
  if ('marcadas' in v) return { ...p, respuestaMarcadas: v.marcadas }
  return { ...p, respuestaOpcionId: v.opcionId }
}

/** Si lo confirmado sigue siendo lo que hay en la cola. Son valores pequeños. */
const loMismo = (enCola: Valor, confirmado: Valor) => JSON.stringify(enCola) === JSON.stringify(confirmado)

export function PruebaDelEditor({
  uuid,
  prueba,
  tiempoAgotado,
  refrescar,
  siSeCerroLaPuerta,
  seEnsena,
}: {
  uuid: string
  prueba: MiPrueba
  tiempoAgotado: boolean
  refrescar: () => void
  siSeCerroLaPuerta: (causa: unknown) => boolean
  seEnsena: (causa: unknown) => boolean
}) {
  const navegar = useNavigate()
  const avisar = useAviso()
  const cache = useQueryClient()
  // En el teléfono el mapa es una hoja desde abajo; por debajo de 1100 px el caso va plegado
  // encima de la pregunta. Sin `matchMedia` (jsdom), la disposición de escritorio.
  const escritorio = useCorte('(min-width: 761px)', true)
  const lateralAlLado = useCorte('(min-width: 1100px)', true)

  /** Lo puesto en esta sesión, por pregunta: manda sobre lo que traiga una recarga. */
  const [puesto, setPuesto] = useState<Record<number, Valor>>({})
  /** Lo subido desde esta pantalla, para decir «Recibimos «X»» aunque se vuelva a la pregunta. */
  const [recibidos, setRecibidos] = useState<Record<number, string>>({})
  const [loQueFalta, setLoQueFalta] = useState(false)
  /** Cuántas veces se pulsó «Entregar la prueba» con huecos. */
  const [vecesQueFalta, setVecesQueFalta] = useState(0)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const [mapaVisible, setMapaVisible] = useState(true)
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [lateralVisible, setLateralVisible] = useState(true)
  const [lateralDesplegado, setLateralDesplegado] = useState(false)
  const botonMapa = useRef<HTMLButtonElement>(null)
  const botonVerLateral = useRef<HTMLButtonElement>(null)
  const botonOcultarLateral = useRef<HTMLButtonElement>(null)
  /** Solo tras pulsar «Ocultar» o «Ver el caso»: al montar o recargar no se toca el foco. */
  const focoDelLateral = useRef(false)
  const avisoDeFaltas = useRef<HTMLDivElement>(null)
  // Una entrega en vuelo, sabido en el mismo clic: el botón se apaga en el pintado siguiente.
  const entregando = useRef(false)

  /*
    Con el tiempo agotado ya no se manda nada: el servidor lo rechazaría y la cola seguiría
    insistiendo. Por referencia, porque los reintentos corren desde temporizadores armados antes.
    Un 409 inventado aquí es lo que la cola entiende como «esto no va a entrar»: lo saca y lo
    marca, y la tarjeta dice que no llegó a guardarse a tiempo.
  */
  const agotado = useRef(tiempoAgotado)
  agotado.current = tiempoAgotado

  const mandar = useCallback(
    async (preguntaId: number, valor: Valor) => {
      if (agotado.current) throw new ErrorApi(409, 'Terminó el plazo de esta prueba.')
      try {
        if ('texto' in valor) await responderPrueba(uuid, preguntaId, valor.texto)
        else await responderPruebaCerrada(uuid, preguntaId, valor)
      } catch (causa) {
        siSeCerroLaPuerta(causa)
        throw causa
      }
      // Una recarga que arrancó antes de este guardado trae una foto sin esta respuesta: se
      // cancela antes de escribir lo confirmado. Ver el comentario largo en `Evaluacion.tsx`.
      await cache.cancelQueries({ queryKey: ['prueba', uuid] })
      cache.setQueryData<MiPrueba>(['prueba', uuid], (previo) =>
        previo === undefined
          ? previo
          : {
              ...previo,
              preguntas: previo.preguntas.map((p) => (p.id === preguntaId ? conRespuesta(p, valor) : p)),
            },
      )
    },
    [uuid, cache, siSeCerroLaPuerta],
  )

  const cola = useColaDeRespuestas<Valor>(mandar, loMismo, `renaser_prueba_pendiente_${uuid}_${prueba.id}`)

  // ---------- Lo que hay de cada pregunta ----------

  const numeroDe = (p: PreguntaPrueba, i: number) => p.posicion ?? i + 1
  const archivoDe = new Map<number, EntregableRequerido>(
    prueba.entregables.filter((e) => e.preguntaId != null).map((e) => [e.preguntaId!, e]),
  )
  const generales = prueba.entregables.filter((e) => e.preguntaId == null || !archivoDe.has(e.preguntaId))
  const subido = (e: EntregableRequerido) => e.entregado || recibidos[e.id] !== undefined
  const valorDe = (p: PreguntaPrueba): Valor =>
    puesto[p.id] ?? cola.sinConfirmar.find((s) => s.id === p.id)?.valor ?? delServidor(p)

  const estadoDe = (p: PreguntaPrueba): Pick<Paso, 'estado' | 'matiz'> => {
    const tiene = respondida(valorDe(p))
    const archivo = archivoDe.get(p.id)
    if (cola.atascadas.includes(p.id)) return { estado: 'a-medias', matiz: 'no se pudo guardar' }
    if (cola.reintentando.includes(p.id)) return { estado: 'a-medias', matiz: 'no se pudo guardar; se reintenta' }
    if (tiene && archivo?.esObligatorio && !subido(archivo)) return { estado: 'a-medias', matiz: 'falta su archivo' }
    if (!tiene && archivo && subido(archivo)) return { estado: 'a-medias', matiz: 'falta responderla' }
    return tiene ? { estado: 'lista' } : { estado: 'vacia' }
  }

  const generalesQueFaltan = generales.filter((e) => e.esObligatorio && !subido(e))
  const pasos: Paso[] = prueba.preguntas.map((p, i) => {
    const n = numeroDe(p, i)
    return { clave: claveDe(p.id), rotulo: String(n), nombre: `Pregunta ${n}`, ...estadoDe(p) }
  })
  if (generales.length > 0) {
    const estado = generalesQueFaltan.length === 0 ? 'lista' : generales.some(subido) ? 'a-medias' : 'vacia'
    pasos.push({
      clave: ENTREGABLES,
      rotulo: 'Entregables',
      nombre: 'Entregables',
      estado,
      estadoDicho: estado === 'lista' ? 'listos' : estado === 'vacia' ? 'sin subir' : null,
      matiz: estado === 'a-medias' ? `falta ${generalesQueFaltan.map((e) => `«${e.nombre}»`).join(', ')}` : null,
    })
  }

  const recorrido = useRecorrido(pasos, `renaser_posicion_prueba_${uuid}_${prueba.id}`, cola.mandarYa)
  const { indice, paso, refBarra, refTarjeta, refEnunciado } = recorrido
  const faltan = pasos.filter((p) => p.estado !== 'lista').length
  const esUltimo = indice === pasos.length - 1
  const indiceDe = (clave: string) => pasos.findIndex((p) => p.clave === clave)

  // ---------- Entregar ----------

  const sinResponder = prueba.preguntas
    .map((p, i) => ({ p, numero: numeroDe(p, i) }))
    .filter(({ p }) => !respondida(valorDe(p)))
  const archivosQueFaltan = prueba.entregables
    .filter((e) => e.esObligatorio && !subido(e) && archivoDe.has(e.preguntaId ?? -1))
    .map((e) => {
      const i = prueba.preguntas.findIndex((p) => p.id === e.preguntaId)
      return { id: e.id, nombre: e.nombre, numero: i >= 0 ? numeroDe(prueba.preguntas[i]!, i) : 0 }
    })

  // Si el tiempo se acaba con el diálogo de entrega abierto, entregar ya no es una opción.
  useEffect(() => {
    if (tiempoAgotado) setConfirmarEntrega(false)
  }, [tiempoAgotado])

  // El aviso de lo que falta, a la vista cada vez que se pulsa «Entregar…» con huecos.
  useEffect(() => {
    if (vecesQueFalta > 0) asomar(avisoDeFaltas.current, refBarra.current)
  }, [vecesQueFalta, refBarra])

  const entrega = useMutation({
    // ⚠️ **Primero se manda lo que quede sin confirmar, y se espera.** Si no llega —servidor
    // caído, red que no vuelve—, se para aquí y se dice dentro del diálogo: entregar ahora
    // dejaría fuera lo último que se respondió.
    mutationFn: async () => {
      if (!(await cola.vaciar())) {
        throw new Error(
          'No pudimos guardar todo lo que respondiste. Revisa tu conexión e inténtalo otra vez: ' +
            'entregar ahora dejaría fuera lo último que cambiaste.',
        )
      }
      return entregarPrueba(uuid)
    },
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Prueba entregada.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
    onError: siSeCerroLaPuerta,
  })

  /*
    El ámbar de un archivo obligatorio que falta —y su «Sin este archivo no se puede entregar la
    prueba.»— sale desde que se intenta entregar con huecos, el mismo momento que el aviso de lo
    que falta, y se queda en cada archivo hasta que se sube. Antes lo hacía en cuanto se respondía
    la pregunta, y avisaba de un problema que el candidato aún no tenía (revisión humana del
    09/10/2026). El mapa sigue marcando la pregunta a medias desde el principio.
  */
  const yaIntentoEntregar = vecesQueFalta > 0

  const pulsarEntregar = () => {
    if (tiempoAgotado) return
    if (sinResponder.length > 0 || archivosQueFaltan.length > 0 || generalesQueFaltan.length > 0) {
      setLoQueFalta(true)
      setVecesQueFalta((n) => n + 1)
      return
    }
    setLoQueFalta(false)
    setConfirmarEntrega(true)
  }

  // ---------- Responder ----------

  const escribir = (p: PreguntaPrueba, texto: string) => {
    if (tiempoAgotado) return
    setPuesto((antes) => ({ ...antes, [p.id]: { texto } }))
    // Ya es lo que el servidor tiene: no hay nada que mandar, salvo que viaje una petición con
    // lo de en medio (entonces se encola lo del servidor y el último en escribir manda).
    if (texto === (p.respuestaTexto ?? '')) {
      if (cola.estaViajando(p.id)) cola.encolar(p.id, { texto })
      else cola.olvidar(p.id)
      return
    }
    cola.encolar(p.id, { texto })
  }

  const elegir = (p: PreguntaPrueba, valor: RespuestaCerradaValor) => {
    if (tiempoAgotado) return
    setPuesto((antes) => ({ ...antes, [p.id]: valor }))
    // Lo que se marca de un toque sale ya: no hay «dejar de escribir» al que esperar.
    cola.encolar(p.id, valor, { yaMismo: true })
  }

  /** Lo que dice la tarjeta de su guardado: lo que hay, no lo que gustaría. */
  const guardadoDe = (p: PreguntaPrueba): Guardado => {
    const tiene = respondida(valorDe(p))
    const enCola = cola.sinConfirmar.some((s) => s.id === p.id)
    const atascada = cola.atascadas.includes(p.id)
    if (tiempoAgotado) {
      if (enCola || atascada) return { texto: 'No llegó a guardarse antes de que terminara el tiempo.', tono: 'fallo' }
      return tiene
        ? { texto: 'Guardado antes de que terminara el tiempo.', tono: 'neutro' }
        : { texto: 'Se quedó sin responder.', tono: 'neutro' }
    }
    if (atascada) return { texto: 'No se pudo guardar', tono: 'fallo' }
    if (cola.reintentando.includes(p.id)) return { texto: 'No se pudo guardar; se reintenta', tono: 'fallo' }
    if (enCola) return { texto: 'Guardando…', tono: 'neutro' }
    return tiene ? { texto: 'Guardado', tono: 'neutro' } : { texto: 'Sin responder', tono: 'neutro' }
  }

  // ---------- Moverse ----------

  const irAlaPregunta = (preguntaId: number) =>
    recorrido.saltarA(indiceDe(claveDe(preguntaId)), primerCampo(refTarjeta))

  /** Al archivo que falta de una pregunta, o a los entregables del final si es nulo. */
  const irAlEntregable = (id: number | null) => {
    if (id === null) {
      const primero = generalesQueFaltan[0] ?? generales[0]
      recorrido.saltarA(indiceDe(ENTREGABLES), () => (primero ? controlDelEntregable(primero.id) : null))
      return
    }
    const deLaPregunta = prueba.entregables.find((e) => e.id === id)?.preguntaId
    const destino = deLaPregunta != null ? indiceDe(claveDe(deLaPregunta)) : indiceDe(ENTREGABLES)
    recorrido.saltarA(destino, () => controlDelEntregable(id))
  }

  const cerrarHoja = () => {
    setHojaAbierta(false)
    botonMapa.current?.focus()
  }

  /** «Ver las N» u «Ocultar el mapa»: en el teléfono abre la hoja o la cierra (QA-UPP-03). */
  const alternarMapa = () => {
    if (escritorio) {
      setMapaVisible((v) => !v)
      return
    }
    if (hojaAbierta) cerrarHoja()
    else setHojaAbierta(true)
  }

  // ---------- El lateral: «El caso», «Para esta prueba» o nada ----------

  const hayCaso = Boolean(prueba.enunciado?.trim()) || Boolean(prueba.consigna)
  const hayLateral =
    hayCaso || Boolean(prueba.materiales) || Boolean(prueba.herramientasPermitidas) || generales.length > 0
  const tituloLateral = hayCaso ? 'El caso' : 'Para esta prueba'
  const botonDelLateral = hayCaso ? 'Ver el caso' : 'Para esta prueba'

  /*
    El botón pulsado desaparece al ocultar o mostrar el lateral (QA-UPP-12): el foco pasa al que
    lo devuelve, como la hoja del mapa al cerrarse, o entra en el lateral por su «Ocultar», como la
    hoja al abrirse. Tras el pintado, cuando el botón de destino ya existe.
  */
  const mostrarLateral = (visible: boolean) => {
    focoDelLateral.current = true
    setLateralVisible(visible)
  }
  useEffect(() => {
    if (!focoDelLateral.current) return
    focoDelLateral.current = false
    const destino = lateralVisible ? botonOcultarLateral : botonVerLateral
    destino.current?.focus()
  }, [lateralVisible])

  const contenidoLateral = (
    <>
      {/* Un caso largo sale recortado, con «Leer el caso completo» (`ElCaso`). */}
      {hayCaso && <CasoEnElLateral enunciado={prueba.enunciado} consigna={prueba.consigna} />}
      {prueba.materiales && (
        <section className={estilos.parteLateral}>
          <h3 className={estilos.tituloParte}>Materiales</h3>
          <TextoPlano texto={prueba.materiales} queEs="el material de apoyo" className={estilos.parrafoLateral} listas />
        </section>
      )}
      {prueba.herramientasPermitidas && (
        <section className={estilos.parteLateral}>
          <h3 className={estilos.tituloParte}>Herramientas permitidas</h3>
          <TextoPlano texto={prueba.herramientasPermitidas} queEs="el documento" className={estilos.parrafoLateral} listas />
        </section>
      )}
      {generales.length > 0 && (
        <section className={estilos.parteLateral}>
          <h3 className={estilos.tituloParte}>Por entregar</h3>
          {/* Solo de consulta: desde aquí no se sube nada, así que cada archivo se sube en un
              solo sitio —el paso «Entregables»—. */}
          <ul className={estilos.porEntregar} role="list">
            {generales.map((e) => (
              <li className={estilos.filaPorEntregar} key={e.id}>
                <span
                  className={`${estilos.marcaPorEntregar}${subido(e) ? ` ${estilos.marcaSubida}` : ''}`}
                  aria-hidden="true"
                />
                <span className={estilos.queEntregar}>
                  <span className={estilos.nombrePorEntregar}>{e.nombre}</span>
                  <span className={estilos.estadoPorEntregar}>
                    {subido(e) ? 'subido' : e.esObligatorio ? 'obligatorio, pendiente' : 'opcional, pendiente'}
                  </span>
                </span>
                <button
                  type="button"
                  className={estilos.irAEntregar}
                  aria-label={`Ir a subir «${e.nombre}»`}
                  onClick={() => recorrido.saltarA(indiceDe(ENTREGABLES), () => controlDelEntregable(e.id))}
                >
                  Ir →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )

  // ---------- El tiempo, en la barra ----------

  const cronometrada = Boolean(prueba.duracionMinutos)
  const hastaCuando = prueba.venceEn ?? prueba.fechaLimite ?? null
  const fechaPoco = useQuedaMenosDe(cronometrada ? null : hastaCuando, QUEDA_POCO)
  const tiempo = tiempoAgotado ? (
    <>
      <span className={estilos.queEs}>Se acabó el tiempo</span>
      <span className={`${estilos.numeroReloj} ${estilos.numeroPoco}`}>00:00:00</span>
    </>
  ) : cronometrada ? (
    <>
      <span className={estilos.queEs}>Tiempo restante</span>
      <Cronometro
        venceEn={prueba.venceEn}
        alAgotarse={refrescar}
        className={estilos.numeroReloj}
        classNamePoco={estilos.numeroPoco}
        /* La frase del umbral se ve: el rojo del número es color, y el color solo no es una señal. */
        classNameAviso={estilos.avisoDelReloj}
      />
    </>
  ) : hastaCuando ? (
    <span>Hasta el {fechaLargaDeLima(hastaCuando)}</span>
  ) : null

  // ---------- Lo que se pinta ----------

  // Sin preguntas ni entregables no hay nada que recorrer. No debería publicarse así, pero si
  // llega, se dice en vez de dejar la página en blanco con el reloj corriendo.
  if (!paso) {
    return (
      <div className={estilos.cerrada}>
        <h1>Esta prueba no tiene nada que responder.</h1>
        <p className={estilos.cerradaTexto}>
          No llegó ninguna pregunta ni ningún archivo que subir. Escríbele a quien lleva tu proceso
          antes de que termine el plazo.
        </p>
      </div>
    )
  }

  const pregunta = paso.clave === ENTREGABLES ? null : prueba.preguntas.find((p) => claveDe(p.id) === paso.clave)
  const numero = pregunta ? numeroDe(pregunta, prueba.preguntas.indexOf(pregunta)) : 0
  const idEnunciado = `enunciado-${paso.clave.replace(':', '-')}`
  const siguientePaso = pasos[indice + 1]
  const entregarFinal = { texto: 'Entregar la prueba', alPulsar: pulsarEntregar }
  const siguiente = esUltimo
    ? tiempoAgotado
      ? null
      : entregarFinal
    : {
        texto: siguientePaso?.clave === ENTREGABLES ? 'Siguiente: entregables' : 'Siguiente',
        alPulsar: () => recorrido.navegarA(indice + 1),
      }
  // «Entregar la prueba» nunca dos veces a la vez: en el último paso solo va el relleno.
  const entregarSuelto = !esUltimo && !tiempoAgotado

  const lateralAlLadoVisible = hayLateral && lateralAlLado && lateralVisible

  return (
    <div className={marco.marco}>
      <BarraDelMarco
        refBarra={refBarra}
        tiempo={tiempo}
        tiempoPoco={!tiempoAgotado && !cronometrada && fechaPoco}
        donde={paso.clave === ENTREGABLES ? 'Entregables' : `Pregunta ${numero} de ${prueba.preguntas.length}`}
        faltan={faltan}
        mapa={{
          abierto: escritorio ? mapaVisible : hojaAbierta,
          preguntas: prueba.preguntas.length,
          alPulsar: alternarMapa,
          refBoton: botonMapa,
          controla: 'mapa-de-la-prueba',
        }}
        siguienteSinResponder={
          recorrido.proximaSinTerminar >= 0 ? () => recorrido.saltarA(recorrido.proximaSinTerminar) : null
        }
        volverA={recorrido.volverA ? { rotulo: rotuloDeVolver(recorrido.volverA), alPulsar: recorrido.volver } : null}
        entregar={escritorio && entregarSuelto ? { texto: 'Entregar la prueba', alPulsar: pulsarEntregar } : null}
        extra={
          hayLateral && lateralAlLado && !lateralVisible ? (
            <button type="button" className={marco.mando} ref={botonVerLateral} onClick={() => mostrarLateral(true)}>
              {botonDelLateral}
            </button>
          ) : null
        }
      />

      <div
        className={`${marco.cuerpo}${escritorio && mapaVisible ? ` ${marco.conMapa}` : ''}${
          lateralAlLadoVisible ? ` ${marco.conLateral}` : ''
        }`}
      >
        {escritorio && mapaVisible && (
          <MapaDePreguntas
            id="mapa-de-la-prueba"
            titulo={`Las ${prueba.preguntas.length} preguntas`}
            pasos={pasos}
            indice={indice}
            alElegir={(i) => recorrido.saltarA(i)}
          />
        )}

        <div className={`${marco.centro}${lateralAlLadoVisible ? '' : ` ${marco.leer}`}`}>
          {tiempoAgotado && (
            <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
              <span>
                <b>Terminó el plazo de esta prueba</b>. Ya no se puede escribir ni subir nada: el
                servidor no lo admitiría. Quedó guardado todo lo que llegó a tiempo, y en unos
                segundos se entregará sola si está completa; si falta algo, quedará sin completar.
                No cierres la página.
              </span>
            </p>
          )}

          {prueba.cambioTexto && (
            <div className={estilos.cambio} role="status">
              <div>
                <p className={estilos.tituloCambio}>Cambio en el encargo</p>
                <p className={estilos.textoCambio}>{prueba.cambioTexto}</p>
              </div>
            </div>
          )}

          {loQueFalta && !tiempoAgotado && (
            <div ref={avisoDeFaltas}>
              <LoQueFaltaParaEntregar
                preguntas={sinResponder.map(({ p, numero: n }) => ({ id: p.id, numero: n }))}
                archivos={archivosQueFaltan}
                entregables={generalesQueFaltan.map((e) => e.nombre)}
                hayEntregables={prueba.entregables.length > 0}
                alIr={irAlaPregunta}
                alIrAlEntregable={irAlEntregable}
              />
            </div>
          )}

          {/* Por debajo de 1100 px el lateral es una barra plegable encima de la pregunta. */}
          {hayLateral && !lateralAlLado && (
            <div className={estilos.lateralPlegable}>
              <button
                type="button"
                className={estilos.abrirLateral}
                aria-expanded={lateralDesplegado}
                aria-controls="lateral-de-la-prueba"
                onClick={() => setLateralDesplegado((v) => !v)}
              >
                <span>{botonDelLateral}</span>
                {lateralDesplegado ? <IconoPlegar tamano={18} /> : <IconoDesplegar tamano={18} />}
              </button>
              {lateralDesplegado && (
                <div className={estilos.cuerpoPlegable} id="lateral-de-la-prueba">
                  {contenidoLateral}
                </div>
              )}
            </div>
          )}

          {pregunta ? (
            <TarjetaDePregunta
              refTarjeta={refTarjeta}
              refEnunciado={refEnunciado}
              idEnunciado={idEnunciado}
              etiqueta={etiquetaDePregunta(numero, pregunta.tipo)}
              guardado={guardadoDe(pregunta)}
              enunciado={pregunta.enunciado}
              anterior={{ alPulsar: () => recorrido.navegarA(indice - 1), desactivado: indice === 0 }}
              siguiente={siguiente}
            >
              {pregunta.tipo === 'ABIERTA' ? (
                /* `readOnly` y no `disabled`: lo escrito sigue siendo suyo y se puede leer y
                   seleccionar aunque ya no se pueda cambiar. */
                <textarea
                  key={pregunta.id}
                  className={estilos.respuesta}
                  aria-labelledby={idEnunciado}
                  placeholder="Tu respuesta…"
                  value={(valorDe(pregunta) as { texto: string }).texto ?? ''}
                  maxLength={MAXIMO_DEL_TEXTO}
                  readOnly={tiempoAgotado}
                  aria-disabled={tiempoAgotado}
                  onChange={(e) => escribir(pregunta, e.target.value)}
                />
              ) : (
                <RespuestaCerrada
                  key={pregunta.id}
                  pregunta={pregunta}
                  numero={numero}
                  valor={valorDe(pregunta) as RespuestaCerradaValor}
                  bloqueado={tiempoAgotado}
                  idEnunciado={idEnunciado}
                  alCambiar={(v) => elegir(pregunta, v)}
                />
              )}
              {archivoDe.get(pregunta.id) && (
                <Entregable
                  key={archivoDe.get(pregunta.id)!.id}
                  uuid={uuid}
                  entregable={archivoDe.get(pregunta.id)!}
                  bloqueado={tiempoAgotado}
                  alSubir={refrescar}
                  siSeCerroLaPuerta={siSeCerroLaPuerta}
                  seEnsena={seEnsena}
                  deLaPregunta
                  quieto
                  falta={yaIntentoEntregar && Boolean(archivoDe.get(pregunta.id)!.esObligatorio)}
                  recibido={recibidos[archivoDe.get(pregunta.id)!.id] ?? null}
                  alRecibir={(nombre) => setRecibidos((r) => ({ ...r, [archivoDe.get(pregunta.id)!.id]: nombre }))}
                />
              )}
            </TarjetaDePregunta>
          ) : (
            <TarjetaDePregunta
              refTarjeta={refTarjeta}
              refEnunciado={refEnunciado}
              idEnunciado={idEnunciado}
              etiqueta="Paso final"
              enunciado="Entregables"
              anterior={{ alPulsar: () => recorrido.navegarA(indice - 1), desactivado: indice === 0 }}
              siguiente={siguiente}
            >
              <p className={estilos.texto}>
                {tiempoAgotado
                  ? 'Ya no se admiten envíos.'
                  : 'Los archivos de toda la prueba. Cada uno indica si se entrega como archivo o como enlace.'}
              </p>
              <div className={estilos.entregables}>
                {generales.map((e) => (
                  <Entregable
                    key={e.id}
                    uuid={uuid}
                    entregable={e}
                    bloqueado={tiempoAgotado}
                    alSubir={refrescar}
                    siSeCerroLaPuerta={siSeCerroLaPuerta}
                    seEnsena={seEnsena}
                    falta={yaIntentoEntregar && e.esObligatorio}
                    recibido={recibidos[e.id] ?? null}
                    quieto
                    alRecibir={(nombre) => setRecibidos((r) => ({ ...r, [e.id]: nombre }))}
                  />
                ))}
              </div>
            </TarjetaDePregunta>
          )}

          {!escritorio && entregarSuelto && (
            <button
              type="button"
              className={`${marco.mando} ${marco.mandoEntregar} ${estilos.entregarAbajo}`}
              onClick={pulsarEntregar}
            >
              Entregar la prueba
            </button>
          )}
        </div>

        {lateralAlLadoVisible && (
          <aside className={estilos.lateralDelCaso} aria-labelledby="titulo-del-lateral" id="lateral-de-la-prueba">
            <div className={estilos.cabezaLateral}>
              <h2 className={estilos.tituloLateral} id="titulo-del-lateral">
                {tituloLateral}
              </h2>
              <button
                type="button"
                className={estilos.ocultarLateral}
                ref={botonOcultarLateral}
                aria-label={hayCaso ? 'Ocultar el caso' : 'Ocultar «Para esta prueba»'}
                onClick={() => mostrarLateral(false)}
              >
                Ocultar
              </button>
            </div>
            {contenidoLateral}
          </aside>
        )}
      </div>

      {!escritorio && hojaAbierta && (
        <HojaDelMapa
          id="mapa-de-la-prueba"
          titulo={`Las ${prueba.preguntas.length} preguntas`}
          pasos={pasos}
          indice={indice}
          faltan={faltan}
          refBarra={refBarra}
          alElegir={(i) => {
            setHojaAbierta(false)
            recorrido.saltarA(i)
          }}
          alCerrar={cerrarHoja}
        />
      )}

      <Modal
        abierto={confirmarEntrega}
        titulo="Entregar la prueba"
        onCerrar={() => setConfirmarEntrega(false)}
        aPruebaDeDobleClic
        pie={
          <>
            <button
              type="button"
              className={estilos.cancelar}
              onClick={() => setConfirmarEntrega(false)}
            >
              Seguir revisando
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={() => {
                if (entregando.current) return
                entregando.current = true
                entrega.mutate(undefined, {
                  onSettled: () => {
                    entregando.current = false
                  },
                })
              }}
              disabled={entrega.isPending}
            >
              {entrega.isPending ? 'Entregando…' : 'Entregar'}
            </button>
          </>
        }
      >
        <p className={estilos.confirmacionTexto}>
          <b>Respondiste las {prueba.preguntas.length} preguntas</b>
          {prueba.entregables.some((e) => e.esObligatorio) ? ' y subiste los archivos obligatorios' : ''}.
          Después de entregar no podrás modificar archivos, enlaces ni respuestas.
        </p>
        {entrega.isError && seEnsena(entrega.error) && (
          <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
            <span>{entrega.error instanceof Error ? entrega.error.message : 'No pudimos entregar.'}</span>
          </p>
        )}
      </Modal>
    </div>
  )
}
