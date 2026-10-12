/**
 * Las respuestas de la evaluacion no se pierden.
 *
 * Esta pantalla ya costo dos fallos en produccion, los dos silenciosos:
 *
 *   1. Cambiar de pregunta cancelaba el guardado con retardo, asi que quien
 *      escribia y pulsaba «Siguiente» rapido perdia la respuesta.
 *   2. Lo pendiente se borraba al enviarlo, no al confirmarlo, asi que un
 *      guardado que fallaba se perdia igual —y el aviso desaparecia solo al
 *      pasar de pregunta. El candidato llegaba al final con «16 de 20».
 *
 * Las dos cosas se comprueban aqui, porque las dos veces el codigo compilaba
 * perfectamente.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { act, cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EvaluacionCandidato, PreguntaEvaluacion } from '@/api/tipos'
import { ProveedorAvisos } from '@/ui/Avisos'
import { GRACIA_TRAS_ABRIR_MS } from '@/ui/Modal'
import {
  entregarEvaluacion,
  iniciarEvaluacion,
  responderEvaluacion,
  verEvaluacion,
} from '@/api/evaluacion'
import { ErrorApi } from '@/api/cliente'
import { verPostulacion } from '@/api/portal'
import { Evaluacion } from './Evaluacion'
import { estadoDePregunta, siguienteIncompleta } from './bancoV3'

// ---------- El servidor de mentira ----------

const TOTAL = 4
/** Lo que el servidor dice tener, que no siempre es lo que manda. */
let totalDeclarado: number

/** Lo que el servidor tiene guardado de verdad. */
let guardadas: Map<number, string>
/** Las opciones que el servidor tiene guardadas. */
let opcionesGuardadas: Map<number, number>
/** La pregunta 2 es de opcion multiple, como las que no se dejaban marcar. */
const CON_OPCIONES = 2
/** Preguntas cuyo primer intento de guardado se cae. */
let fallanUnaVez: Set<number>
/** Preguntas que no hay manera de guardar, como una red que no vuelve. */
let fallanSiempre: Set<number>
/** Cuando vence el plazo. `null` = esta evaluacion no tiene ninguno. */
let venceEn: string | null

function evaluacionActual(iniciada: boolean): EvaluacionCandidato {
  return {
    id: 1,
    estado: iniciada ? 'EN_CURSO' : 'PENDIENTE',
    venceEn,
    iniciadaEn: iniciada ? '2026-08-20T10:00:00Z' : null,
    terminadaEn: null,
    minutosObjetivo: 45,
    total: totalDeclarado,
    respondidas: guardadas.size,
    preguntas: Array.from({ length: TOTAL }, (_, i) => ({
      id: i + 1,
      posicion: i + 1,
      tipo: 'ABIERTA',
      enunciado: `Pregunta ${i + 1}`,
      situacion: null,
      opciones:
        i + 1 === CON_OPCIONES
          ? [
              { id: 21, letra: 'a', texto: 'Preguntar antes de empezar' },
              { id: 22, letra: 'b', texto: 'Empezar por lo que sí entiendo' },
            ]
          : null,
      respuestaTexto: guardadas.get(i + 1) ?? null,
      respuestaOpcionId: opcionesGuardadas.get(i + 1) ?? null,
    })),
  }
}

let iniciada = false

vi.mock('@/api/evaluacion', () => ({
  verEvaluacion: vi.fn(async () => evaluacionActual(iniciada)),
  iniciarEvaluacion: vi.fn(async () => {
    iniciada = true
    return evaluacionActual(true)
  }),
  responderEvaluacion: vi.fn(async (_uuid: string, preguntaId: number, cuerpo: { texto?: string; opcionId?: number }) => {
    if (fallanSiempre.has(preguntaId) || fallanUnaVez.has(preguntaId)) {
      fallanUnaVez.delete(preguntaId)
      throw new Error('El sistema tuvo un problema. Inténtalo de nuevo en un momento.')
    }
    if (cuerpo.texto !== undefined) guardadas.set(preguntaId, cuerpo.texto)
    if (cuerpo.opcionId !== undefined) opcionesGuardadas.set(preguntaId, cuerpo.opcionId)
  }),
  entregarEvaluacion: vi.fn(async () => ({ estado: 'ENTREGADA', respondidas: guardadas.size, total: TOTAL })),
}))

// Su proceso: solo se le pregunta cuando la evaluación contesta 404.
vi.mock('@/api/portal', () => ({ verPostulacion: vi.fn() }))

// ---------- Montaje ----------

/** La cache del ultimo montaje, para las pruebas que necesitan forzar una recarga. */
let cache: QueryClient

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  cache = datos
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/procesos/x1/evaluacion']}>
          <Routes>
            <Route path="/procesos/:uuid/evaluacion" element={<Evaluacion />} />
            {/* A donde lleva entregar (V70): su proceso, o la portada de su prueba. */}
            <Route path="/procesos/:uuid" element={<p>Su proceso</p>} />
            <Route path="/procesos/:uuid/prueba" element={<p>Portada de la prueba</p>} />
            <Route path="/procesos/:uuid/prueba-tecnica" element={<p>Portada del cuestionario</p>} />
          </Routes>
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
}

async function empezar() {
  montar()
  fireEvent.click(await screen.findByRole('button', { name: /Empezar evaluación/ }))
  await screen.findByLabelText('Tu respuesta')
}

function responder(texto: string) {
  fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: texto } })
}

const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

/** El numero del mapa, buscado por lo que dice de el un lector de pantalla. */
const numeroDelMapa = (n: number) => screen.getByRole('button', { name: new RegExp(`^Pregunta ${n},`) })

/** El boton de volver, si es que hay algun salto que deshacer. */
const botonVolver = () => screen.queryByRole('button', { name: /^Volver a la/ })

/**
 * Lo que dice la tarjeta de la pregunta. Se busca dentro de ella: la leyenda del mapa también
 * dice «Sin responder».
 */
const enLaTarjeta = () => within(screen.getByRole('article'))

/** «Entregar la evaluación»: en la barra, o relleno en la última pregunta (nunca los dos). */
const entregarLaEvaluacion = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Entregar la evaluación' }))

// Sin `globals`, la libreria no limpia sola entre pruebas y los arboles se
// van apilando: la segunda prueba encontraria dos de cada cosa.
afterEach(async () => {
  cleanup()
  // ⚠️ Al desmontar, la cola manda lo que le quede, y esa peticion **aterriza despues**. Sin
  // esperarla aqui, la respuesta de una prueba acaba contada en la siguiente, que ya reseteo
  // `guardadas`: un fallo que no tiene nada que ver con lo que esa prueba mira.
  await new Promise((seguir) => setTimeout(seguir, 0))
})

beforeEach(() => {
  // ⚠️ La cola apunta lo pendiente en `localStorage` para que cerrar la pestaña no cueste una
  // respuesta, y la clave sale del uuid —que aqui es el mismo en todas las pruebas—. Sin
  // limpiarlo, lo que una prueba deja a medias lo reenvia la siguiente al montar.
  window.localStorage.clear()
  // La pregunta en la que se estaba se apunta en la pestaña (una pregunta por pantalla): sin
  // limpiarla, cada prueba empezaría donde dejó la anterior.
  window.sessionStorage.clear()
  guardadas = new Map()
  totalDeclarado = TOTAL
  opcionesGuardadas = new Map()
  fallanUnaVez = new Set()
  fallanSiempre = new Set()
  venceEn = null
  iniciada = false
  vi.clearAllMocks()
})

// ---------- Las pruebas ----------

describe('la evaluacion no pierde respuestas', () => {
  it('manda lo escrito al cambiar de pregunta, sin esperar al temporizador', async () => {
    await empezar()

    // Escribir y pulsar «Siguiente» de inmediato: el caso que fallaba.
    responder('Primera respuesta.')
    siguiente()

    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'))
  })

  it('no da por guardado lo que el servidor rechazo, y lo reintenta solo', async () => {
    fallanUnaVez.add(1)
    await empezar()

    responder('Primera respuesta.')
    siguiente()

    // El primer intento se cayo, asi que no esta guardada...
    await waitFor(() => expect(responderEvaluacion).toHaveBeenCalled())
    expect(guardadas.has(1)).toBe(false)

    // ...pero la cola vuelve sola, sin que nadie pulse nada. Antes hacia falta un boton
    // rojo de «Reintentar ahora» en mitad del examen.
    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'), { timeout: 4000 })
  })

  it('lo que no llego sigue en la cola al cambiar de pregunta', async () => {
    // Que no llegue nunca: si solo fallara una vez, el reintento la salvaria y no habria
    // nada pendiente que comprobar.
    fallanSiempre.add(1)
    await empezar()

    responder('Primera respuesta.')
    siguiente()

    // Antes el error se limpiaba al pasar de pregunta y no quedaba ni rastro. Ahora lo que
    // no llego sigue pendiente —la 1 no cuenta como respondida— mientras las demas van.
    siguiente() // la 2 es de opciones: se salta
    responder('Tercera respuesta.')
    siguiente()

    await waitFor(() => expect(guardadas.get(3)).toBe('Tercera respuesta.'))
    expect(guardadas.has(1)).toBe(false)

    // Y no se le enseña ningun cartel rojo por ello: la cola sigue a lo suyo.
    expect(screen.queryByText(/sin guardar/i)).toBeNull()
    expect(screen.queryByText(/Reintentar ahora/i)).toBeNull()
  })

  it('entregar manda antes lo que quede en la cola', async () => {
    await empezar()

    // La ultima respuesta se escribe y se pulsa «Entregar» de inmediato: antes del
    // temporizador, que es justo cuando se perdia.
    responder('Primera respuesta.')
    siguiente()
    fireEvent.click(await screen.findByRole('radio', { name: /Preguntar antes de empezar/ }))
    siguiente()
    responder('Tercera respuesta.')
    siguiente()
    responder('Cuarta respuesta.')
    entregarLaEvaluacion()

    // El modal no abre hasta que lo pendiente ha llegado, asi que lo que cuenta ya es lo
    // que el servidor tiene de verdad.
    await screen.findByRole('button', { name: 'Entregar' })
    expect(guardadas.get(4)).toBe('Cuarta respuesta.')
  })

  it('lo escrito justo antes de «Siguiente» no se pierde', async () => {
    // ⚠️ **El fallo que motivo la reescritura.** Encolar desde un efecto dejaba un hueco
    // entre la ultima tecla y el envio, y en ese hueco cabia el clic: cuando el efecto por
    // fin corria, el borrador ya era de otra pregunta y se iba sin hacer nada. Aqui no se
    // deja pasar ni un tick entre escribir y navegar.
    await empezar()

    responder('Primera respuesta.')
    siguiente()
    siguiente() // la 2 es de opciones: no tiene donde escribir
    responder('Y esta es la tercera.')
    siguiente()

    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'))
    await waitFor(() => expect(guardadas.get(3)).toBe('Y esta es la tercera.'))
  })

  it('borrar lo escrito deja la pregunta sin responder, y no da error', async () => {
    guardadas.set(1, 'Algo que ya estaba guardado.')
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Empezar evaluación/ }))
    // Entra en la primera sin responder (la 2); la 1 está detrás.
    await screen.findByText(/Pregunta 2 de 4/)
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))

    await screen.findByDisplayValue('Algo que ya estaba guardado.')
    responder('')

    // El servidor recibe el vacio y borra la respuesta. Antes esto era un 400 «Hay que
    // escribir una respuesta» en pantalla, y encima el texto viejo se quedaba en el
    // servidor: el recuadro vacio y el contador diciendo «respondida».
    await waitFor(() => expect(guardadas.get(1)).toBe(''))
    expect(screen.queryByText(/Hay que escribir una respuesta/)).toBeNull()
    await waitFor(() => expect(enLaTarjeta().getByText('Sin responder')).toBeTruthy())
  })

  it('⚠️ una recarga que arrancó antes del guardado no pisa lo confirmado', async () => {
    // La carrera que midió QA, con los tiempos que vio: la recarga del examen sale al volver
    // a la pestaña, el backend le contesta una foto **sin** la respuesta nueva, y esa foto
    // aterriza DESPUÉS de que el guardado se confirme. React Query la mete en la caché encima
    // de lo confirmado: la pregunta vuelve a salir sin responder, el contador retrocede y el
    // mapa la pinta en blanco. Y no se arreglaba solo —la copia ya está escrita—: seguía mal
    // noventa segundos después.
    await empezar()

    // Una recarga que se queda a medio camino, con la foto de antes de responder.
    const fotoVieja = evaluacionActual(true)
    let aterrizar: () => void = () => {}
    vi.mocked(verEvaluacion).mockImplementationOnce(
      () => new Promise((cumplir) => { aterrizar = () => cumplir(fotoVieja) }),
    )
    const recarga = cache.refetchQueries({ queryKey: ['evaluacion', 'x1'] })

    // Mientras viaja, el candidato responde y se mueve: ya no hay borrador que la tape.
    responder('Primera respuesta.')
    siguiente()
    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'))
    await waitFor(() => expect(screen.getByText('1 de 4 respondidas')).toBeTruthy())

    // Ahora aterriza la foto vieja.
    aterrizar()
    await recarga
    await new Promise((seguir) => setTimeout(seguir, 50))

    // El contador NO retrocede, y la respuesta sigue estando.
    expect(screen.getByText('1 de 4 respondidas')).toBeTruthy()
    expect(guardadas.get(1)).toBe('Primera respuesta.')
  })

  it('lo pendiente al cerrar la pestaña se manda al volver a abrir', async () => {
    // Que no llegue ni siquiera el envio de salida: si llegara, no habria nada apuntado que
    // recuperar y la prueba pasaria sin comprobar lo que dice comprobar.
    fallanSiempre.add(1)
    const { unmount } = montar()
    fireEvent.click(await screen.findByRole('button', { name: /Empezar evaluación/ }))
    await screen.findByLabelText('Tu respuesta')

    responder('Lo que escribí antes de que se cortara.')
    await waitFor(() => expect(responderEvaluacion).toHaveBeenCalled())
    expect(guardadas.has(1)).toBe(false)
    unmount()
    await new Promise((seguir) => setTimeout(seguir, 0))
    expect(guardadas.has(1)).toBe(false)

    // Vuelve la red. Al abrir otra vez, lo apuntado sale solo sin que nadie escriba nada.
    fallanSiempre.delete(1)
    montar()
    await waitFor(() => expect(guardadas.get(1)).toBe('Lo que escribí antes de que se cortara.'))
  })

  it('⚠️ lo que sí llegó al salir no vuelve a mandarse, ni pisa una corrección', async () => {
    // El fallo que encontró QA. Al salir de la pantalla se manda lo que queda, y esa
    // confirmacion llega cuando ya no hay pantalla: el borrado de la nota del navegador iba
    // colgado del repintado, asi que no se hacia. La respuesta se quedaba apuntada como
    // pendiente aunque estuviera guardada, y al volver a abrir el examen se remandaba
    // **pisando cualquier correccion posterior**. Perdia respuestas justo la pieza cuyo
    // trabajo es no perderlas.
    const { unmount } = montar()
    fireEvent.click(await screen.findByRole('button', { name: /Empezar evaluación/ }))
    await screen.findByLabelText('Tu respuesta')

    responder('Lo que escribí al salir.')
    unmount()
    await waitFor(() => expect(guardadas.get(1)).toBe('Lo que escribí al salir.'))

    // Alguien corrige esa respuesta desde otro sitio —otra pestaña, el telefono—.
    guardadas.set(1, 'Lo corregido después.')

    // Ya esta empezada: al volver se entra directo a la pregunta.
    montar()
    await screen.findByLabelText('Tu respuesta')
    await new Promise((seguir) => setTimeout(seguir, 100))

    // No se remanda nada: la correccion sobrevive.
    expect(guardadas.get(1)).toBe('Lo corregido después.')
  })

  it('la opción marcada se ve marcada aunque el servidor la rechace', async () => {
    fallanSiempre.add(CON_OPCIONES)
    await empezar()
    siguiente()

    const opcion = await screen.findByRole('radio', { name: /Preguntar antes de empezar/ })
    fireEvent.click(opcion)

    // Antes el radio salia del servidor: si el guardado se caia, no se marcaba
    // y parecia que no se podia elegir nada.
    await waitFor(() => expect((opcion as HTMLInputElement).checked).toBe(true))
    // Y el candidato no ve ningun cartel por ello: la cola lo reintenta sola.
    expect(screen.queryByText(/sin guardar/i)).toBeNull()
  })

  it('no deja entregar con preguntas en blanco: el aviso dice cuáles y lleva a la primera (AC-10)', async () => {
    await empezar()

    // Solo se responde la primera; quedan tres en blanco.
    responder('Primera respuesta.')
    siguiente()
    siguiente()
    siguiente()
    entregarLaEvaluacion()

    // El mismo aviso que la prueba, y sin la ventana de recuento de antes.
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('Para entregar te falta responder 3 preguntas (la 2, la 3 y la 4).')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entregarEvaluacion).not.toHaveBeenCalled()

    // Y desde ahi se va a la que falta, moviendo el navegador de preguntas.
    fireEvent.click(within(aviso).getByRole('button', { name: 'Ir a la pregunta 2' }))
    await waitFor(() => expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy())
    // Es un salto: se puede volver a donde se pulsó «Entregar».
    expect(screen.getByRole('button', { name: 'Volver a la 4' })).toBeTruthy()
  })

  it('avisa cuando el servidor manda menos preguntas de las que dice tener', async () => {
    // El caso de «no puedo pasar de la 16»: el candidato se queda sin
    // «Siguiente» a mitad y la barra no llega al final.
    totalDeclarado = 50
    await empezar()

    expect(screen.getByText(/llegaron 4 de las 50/)).toBeTruthy()
  })

  it('el indicador no dice «guardado» en una pregunta en blanco', async () => {
    await empezar()
    expect(enLaTarjeta().getByText('Sin responder')).toBeTruthy()

    responder('Algo escrito.')
    await waitFor(() => expect(enLaTarjeta().getByText('Guardado')).toBeTruthy())
  })

  it('el guardado lo dice solo la cabecera de la tarjeta: ni la portada ni la pregunta dicen «se guarda sola»', async () => {
    montar()
    await screen.findByRole('button', { name: /Empezar evaluación/ })
    expect(screen.getByText(/Puedes salir y volver las veces que quieras/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/se guarda sola/i)

    fireEvent.click(screen.getByRole('button', { name: /Empezar evaluación/ }))
    await screen.findByLabelText('Tu respuesta')
    responder('Algo escrito.')
    await waitFor(() => expect(enLaTarjeta().getByText('Guardado')).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/se guarda sola/i)
  })

  it('AC-08: si el guardado falla, la casilla sale a medias y la tarjeta lo dice hasta que llega', async () => {
    fallanUnaVez.add(1)
    await empezar()

    responder('Primera respuesta.')
    siguiente()

    // Ya no está en pantalla, y el mapa dice que no llegó.
    await waitFor(() =>
      expect(numeroDelMapa(1).getAttribute('aria-label')).toBe(
        'Pregunta 1, a medias, no se pudo guardar; se reintenta',
      ),
    )
    // La cola la reintenta sola, sin que nadie vuelva a ella.
    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'), { timeout: 4000 })
    await waitFor(() => expect(numeroDelMapa(1).getAttribute('aria-label')).toBe('Pregunta 1, lista'))
  })

  it('AC-08: en la pregunta que falló, «No se pudo guardar; se reintenta»', async () => {
    fallanSiempre.add(1)
    await empezar()

    responder('Primera respuesta.')
    await waitFor(() =>
      expect(enLaTarjeta().getByText('No se pudo guardar; se reintenta')).toBeTruthy(),
      { timeout: 3000 },
    )
    // Lo escrito sigue ahí: nada se pierde.
    expect((screen.getByLabelText('Tu respuesta') as HTMLTextAreaElement).value).toBe('Primera respuesta.')
  })
})

/**
 * Moverse por el examen.
 *
 * Sale de una queja de alguien que ya lo habia hecho entero: se salto una
 * pregunta, el aviso lo mando de la 50 a la 10, y para volver a donde estaba no
 * habia mas remedio que pulsar «Siguiente» cuarenta veces. Con una pregunta por
 * pantalla y sin vista de conjunto, un hueco es un hueco a ciegas.
 */
describe('moverse por el examen sin perderse', () => {
  it('el mapa dice como está cada pregunta, y sin depender del color (AC-03)', async () => {
    await empezar()
    responder('Uno.')

    // En escritorio el mapa está a la vista al entrar, con su leyenda.
    const mapa = screen.getByRole('navigation', { name: `Las ${TOTAL} preguntas` })
    expect(within(mapa).getByText('Lista')).toBeTruthy()
    expect(within(mapa).getByText('A medias')).toBeTruthy()
    expect(within(mapa).getByText('Sin responder')).toBeTruthy()

    // El nombre accesible lleva el número y el estado escritos; la actual lo dice.
    expect(screen.getByRole('button', { name: 'Pregunta 1, lista (estás aquí)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pregunta 2, sin responder' })).toBeTruthy()

    // Y pulsar una casilla lleva a esa pregunta.
    fireEvent.click(numeroDelMapa(3))
    await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Pregunta 3, sin responder (estás aquí)' })).toBeTruthy()
  })

  it('en escritorio el mapa se oculta y vuelve desde la barra', async () => {
    await empezar()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar el mapa' }))
    expect(screen.queryByRole('navigation', { name: `Las ${TOTAL} preguntas` })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: `Ver las ${TOTAL}` }))
    expect(screen.getByRole('navigation', { name: `Las ${TOTAL} preguntas` })).toBeTruthy()
  })

  it('«siguiente sin responder» da la vuelta al llegar al final', async () => {
    await empezar()
    responder('Uno.')
    siguiente() // la 2 es de opciones y se queda sin responder
    siguiente()
    responder('Tres.')
    siguiente() // ya en la ultima

    responder('Cuatro.')
    // El unico hueco que queda esta detras: en la 2.
    await screen.findByText('Te falta 1 por terminar')

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente sin responder' }))

    await waitFor(() => expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy())
  })

  it('AC-05: «Volver a la N» recuerda el primer salto y se olvida al navegar a mano', async () => {
    // Respondidas la 1 y la 3; sin responder la 2 y la 4.
    guardadas.set(1, 'Uno.')
    guardadas.set(3, 'Tres.')
    iniciada = true
    montar()
    // Sin nada apuntado en la pestaña, entra en la primera sin responder: la 2.
    await waitFor(() => expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy())
    siguiente()
    await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())

    // Moverse de una en una no deja nada que deshacer.
    expect(botonVolver()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente sin responder' }))
    await waitFor(() => expect(screen.getByText(/Pregunta 4 de 4/)).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Volver a la 3' })).toBeTruthy()

    // Otra vez: da la vuelta a la 2 y sigue recordando la 3, el primer salto.
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente sin responder' }))
    await waitFor(() => expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Volver a la 3' })).toBeTruthy()

    // Al seguir a mano, la 3 ya no es «de donde venia».
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(botonVolver()).toBeNull())
  })

  it('el «volver» lleva al sitio del salto y desaparece', async () => {
    await empezar()
    siguiente()
    siguiente()

    fireEvent.click(numeroDelMapa(1))
    await waitFor(() => expect(screen.getByText(/Pregunta 1 de 4/)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Volver a la 3' }))
    await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())
    expect(botonVolver()).toBeNull()
  })

  it('«Ir al final» ya no existe; con todas, la barra dice «Todo listo para entregar»', async () => {
    await empezar()
    expect(screen.queryByRole('button', { name: 'Ir al final' })).toBeNull()

    responder('Uno.')
    siguiente()
    fireEvent.click(await screen.findByRole('radio', { name: /Preguntar antes de empezar/ }))
    await waitFor(() => expect(opcionesGuardadas.get(2)).toBe(21))
    siguiente()
    responder('Tres.')
    siguiente()
    responder('Cuatro.')
    await screen.findByText('Todo listo para entregar')
    expect(screen.getByText('4 de 4 respondidas')).toBeTruthy()

    fireEvent.click(numeroDelMapa(1))
    await waitFor(() => expect(screen.getByText(/Pregunta 1 de 4/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Ir al final' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Siguiente sin responder' })).toBeNull()
  })

  it('AC-09: al recargar vuelve a la pregunta en la que estaba', async () => {
    await empezar()
    siguiente()
    siguiente()
    await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())
    cleanup()

    // Otro montaje en la misma pestaña: lo apuntado en `sessionStorage` manda.
    montar()
    await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())
  })

  it('sin nada apuntado (o sin almacenamiento), entra en la primera sin responder', async () => {
    guardadas.set(1, 'Uno.')
    opcionesGuardadas.set(CON_OPCIONES, 21)
    iniciada = true
    const leer = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Almacenamiento bloqueado')
    })
    try {
      montar()
      await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())
    } finally {
      leer.mockRestore()
    }
  })

  it('un doble clic en «Siguiente» avanza una sola pregunta', async () => {
    await empezar()
    const boton = screen.getByRole('button', { name: 'Siguiente' })
    fireEvent.click(boton, { detail: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }), { detail: 2 })
    await waitFor(() => expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy())
  })

  it('QA-UPP-01: el segundo clic de un doble clic en «Siguiente» no marca la opción que queda debajo', async () => {
    await empezar()
    const boton = screen.getByRole('button', { name: 'Siguiente' })
    fireEvent.mouseDown(boton, { detail: 1 })
    fireEvent.click(boton, { detail: 1 })
    await waitFor(() => expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy())

    // La 2 es más alta: la segunda pulsación cae sobre una de sus opciones, y no cuenta.
    const radio = screen.getByRole('radio', { name: /Preguntar antes de empezar/ })
    const opcion = radio.closest('label')!
    expect(fireEvent.mouseDown(opcion, { detail: 2 })).toBe(false)
    expect(fireEvent.click(opcion, { detail: 2 })).toBe(false)
    expect(fireEvent.click(radio, { detail: 2 })).toBe(false)
    fireEvent.dblClick(opcion, { detail: 2 })
    await new Promise((seguir) => setTimeout(seguir, 0))
    expect((radio as HTMLInputElement).checked).toBe(false)
    expect(responderEvaluacion).not.toHaveBeenCalled()
    expect(numeroDelMapa(2).getAttribute('aria-label')).toBe('Pregunta 2, sin responder (estás aquí)')
    expect(screen.getByText(/Pregunta 2 de 4/)).toBeTruthy()

    // Un clic suelto después sí la marca.
    fireEvent.mouseDown(opcion, { detail: 1 })
    fireEvent.click(opcion, { detail: 1 })
    await waitFor(() =>
      expect(responderEvaluacion).toHaveBeenCalledWith('x1', 2, expect.objectContaining({ opcionId: 21 })),
    )
  })

  it('QA-UPP-01: un doble clic que empieza y acaba en el mismo sitio sigue siendo suyo', async () => {
    await empezar()
    const campo = screen.getByLabelText('Tu respuesta')
    fireEvent.mouseDown(campo, { detail: 1 })
    fireEvent.click(campo, { detail: 1 })
    // Seleccionar una palabra con doble clic dentro del texto no se toca.
    expect(fireEvent.mouseDown(campo, { detail: 2 })).toBe(true)
    expect(fireEvent.click(campo, { detail: 2 })).toBe(true)
  })

  it('QA-UPP-01: con huecos, el doble clic en «Entregar» de la última no responde lo que el aviso empuja', async () => {
    await empezar()
    siguiente()
    siguiente()
    siguiente()
    await waitFor(() => expect(screen.getByText(/Pregunta 4 de 4/)).toBeTruthy())
    const entregar = within(screen.getByRole('article')).getByRole('button', { name: 'Entregar la evaluación' })
    fireEvent.mouseDown(entregar, { detail: 1 })
    fireEvent.click(entregar, { detail: 1 })
    await screen.findByText(/Para entregar te falta responder/)
    // El aviso aparece encima y la tarjeta baja: la segunda pulsación cae en su campo.
    const campo = screen.getByLabelText('Tu respuesta')
    expect(fireEvent.mouseDown(campo, { detail: 2 })).toBe(false)
    expect(fireEvent.click(campo, { detail: 2 })).toBe(false)
  })

  it('en la última, «Entregar la evaluación» sustituye a «Siguiente» y no se repite en la barra', async () => {
    await empezar()
    // En las demás, la barra lo lleva con contorno.
    expect(screen.getAllByRole('button', { name: 'Entregar la evaluación' })).toHaveLength(1)
    siguiente()
    siguiente()
    siguiente()
    await waitFor(() => expect(screen.getByText(/Pregunta 4 de 4/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Entregar la evaluación' })).toHaveLength(1)
    expect(within(screen.getByRole('article')).getByRole('button', { name: 'Entregar la evaluación' })).toBeTruthy()
  })
})

/**
 * El mapa en el teléfono: una hoja desde abajo, sin animación, que se cierra al elegir.
 * `matchMedia` responde como una ventana de 375 px.
 */
describe('en el teléfono (AC-12)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: /max-width/.test(consulta),
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('«Ver las N» abre la hoja; elegir una casilla la cierra y lleva a ella', async () => {
    await empezar()
    // No hay columna de mapa: se abre desde la barra.
    expect(screen.queryByRole('navigation', { name: `Las ${TOTAL} preguntas` })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `Ver las ${TOTAL}` }))

    const hoja = screen.getByRole('dialog', { name: `Las ${TOTAL} preguntas` })
    expect(within(hoja).getByText('Te faltan 4 por terminar.')).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: /^Pregunta 3,/ }))

    expect(screen.queryByRole('dialog', { name: `Las ${TOTAL} preguntas` })).toBeNull()
    await waitFor(() => expect(screen.getByText(/Pregunta 3 de 4/)).toBeTruthy())
  })

  it('la hoja se cierra con Escape y el foco vuelve al botón', async () => {
    await empezar()
    const boton = screen.getByRole('button', { name: `Ver las ${TOTAL}` })
    fireEvent.click(boton)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(boton)
  })

  it('QA-UPP-02 y 03: la hoja empieza donde acaba la barra ya con «Ocultar el mapa», la sigue, y ese botón la cierra', async () => {
    await empezar()
    const boton = screen.getByRole('button', { name: `Ver las ${TOTAL}` })
    const barra = boton.parentElement!.parentElement!
    let crece = 0
    // Con «Ocultar el mapa», más ancho, la barra se parte en una fila más: 314 → 366 px.
    const medida = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const bajo = this === barra ? (boton.textContent === 'Ocultar el mapa' ? 366 : 314) + crece : 0
      return { top: 0, left: 0, right: 0, x: 0, y: 0, width: 0, bottom: bajo, height: bajo, toJSON: () => ({}) }
    })
    try {
      fireEvent.click(boton)
      const hoja = screen.getByRole('dialog', { name: `Las ${TOTAL} preguntas` })
      expect(boton.textContent).toBe('Ocultar el mapa')
      expect(boton.getAttribute('aria-expanded')).toBe('true')
      expect(hoja.parentElement!.style.top).toBe('366px')

      // Si la barra cambia —el aviso del plazo, otra fila—, la hoja la sigue.
      crece = 40
      fireEvent(window, new Event('resize'))
      expect(hoja.parentElement!.style.top).toBe('406px')

      fireEvent.click(boton)
      expect(screen.queryByRole('dialog', { name: `Las ${TOTAL} preguntas` })).toBeNull()
      expect(boton.textContent).toBe(`Ver las ${TOTAL}`)
      expect(boton.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(boton)

      // Y vuelve a abrirse.
      fireEvent.click(boton)
      expect(screen.getByRole('dialog', { name: `Las ${TOTAL} preguntas` })).toBeTruthy()
    } finally {
      medida.mockRestore()
    }
  })

  it('«Entregar la evaluación» va debajo de la pregunta, una sola vez', async () => {
    await empezar()
    expect(screen.getAllByRole('button', { name: 'Entregar la evaluación' })).toHaveLength(1)
  })
})

// ---------- Las cuentas del mapa, sin pintar nada ----------

/** Un item `V` de dos datos: el unico formato que se puede dejar a medias. */
function preguntaV(respuestaTexto: string | null): PreguntaEvaluacion {
  return {
    id: 99,
    posicion: 1,
    tipo: 'V',
    enunciado: 'Años haciendo este trabajo: ___ · Personas a tu cargo: ___',
    situacion: null,
    opciones: null,
    respuestaTexto,
    respuestaOpcionId: null,
  }
}

/**
 * El plazo, mientras se responde.
 *
 * Estaba solo en la portada. Entre esa pantalla y el aviso de la ultima hora hay dos
 * semanas de plazo por defecto, y en todo ese tramo el candidato no volvia a ver cuanto le
 * quedaba: tenia que salirse de la evaluacion para saberlo.
 */
describe('el plazo mientras se responde', () => {
  /** Dentro de N horas, en el formato que manda el servidor. */
  const dentroDe = (horas: number) =>
    new Date(Date.now() + horas * 3_600_000).toISOString()

  it('con dias por delante, los dice en la linea de servicio', async () => {
    venceEn = dentroDe(24 * 3 + 1)
    await empezar()

    expect(screen.getByText(/3 días para entregarla/)).toBeTruthy()
  })

  it('el ultimo dia lo dice con palabras, no con un cero', async () => {
    // `diasHasta` devuelve «hoy» por debajo de las 24 h, y «hoy para entregarla» no se
    // dice: es la unica salida que no compone con la frase.
    venceEn = dentroDe(5)
    await empezar()

    expect(screen.getByText('Se entrega hoy')).toBeTruthy()
  })

  it('⚠️ por debajo de la hora desaparece: manda la cuenta atras del aviso', async () => {
    // Dos relojes a la vez, uno diciendo «hoy» y el otro `00:42:17`, se leen peor que el
    // segundo solo.
    venceEn = dentroDe(0.5)
    await empezar()

    expect(screen.queryByText(/para entregarla/)).toBeNull()
    expect(screen.queryByText('Se entrega hoy')).toBeNull()
    expect(screen.getByText(/Queda poco plazo/)).toBeTruthy()
    // La cuenta atrás, en la barra y en rojo (AC-11).
    const cuenta = screen.getByText(/^Quedan [0-9]{2}:[0-9]{2}:[0-9]{2}$/)
    expect(cuenta.closest('div')?.className).toMatch(/poco/)
  })

  it('con más de una hora, el plazo de la barra no va en rojo', async () => {
    venceEn = dentroDe(5)
    await empezar()
    expect(screen.getByText('Se entrega hoy').closest('div')?.className).not.toMatch(/poco/)
  })

  it('AC-11: el aviso de plazo ya no promete entregar lo respondido', async () => {
    venceEn = dentroDe(0.5)
    await empezar()

    expect(screen.queryByText(/se entregará lo que tengas respondido/)).toBeNull()
    expect(document.body.textContent).toContain('Cuando se acabe, la evaluación se cierra sin entregarse. Entrégala antes.')
  })

  it('sin plazo no se inventa ninguno', async () => {
    venceEn = null
    await empezar()

    expect(screen.queryByText(/para entregarla/)).toBeNull()
    expect(screen.queryByText(/sin plazo/i)).toBeNull()
  })
})

describe('el estado de cada pregunta', () => {
  it('separa la empezada a medias de la que está en blanco', () => {
    expect(estadoDePregunta(preguntaV(null))).toBe('vacia')
    // Media respuesta no se guarda, asi que contarla como respondida seria
    // prometer una entrega que el servidor va a rechazar.
    expect(estadoDePregunta(preguntaV('Años haciendo este trabajo: 12'))).toBe('a-medias')
    expect(
      estadoDePregunta(preguntaV('Años haciendo este trabajo: 12 · Personas a tu cargo: 3')),
    ).toBe('lista')
  })

  it('el siguiente hueco da la vuelta y nunca es el que ya se está mirando', () => {
    const conHuecoEnLa2 = ['lista', 'vacia', 'lista', 'lista'] as const

    expect(siguienteIncompleta([...conHuecoEnLa2], 3)).toBe(1)
    expect(siguienteIncompleta([...conHuecoEnLa2], 0)).toBe(1)
    // El unico hueco es el de delante: no hay «siguiente» al que mandar a nadie.
    expect(siguienteIncompleta(['lista', 'a-medias'], 1)).toBe(-1)
    expect(siguienteIncompleta(['lista', 'lista'], 0)).toBe(-1)
  })
})

describe('cuando la empresa retiró la vacante', () => {
  it('el enlace viejo dice que la vacante ya no está, sin ofrecer reintentar', async () => {
    const yaNoExiste = new ErrorApi(404, "Postulación not found with código: 'x1'")
    vi.mocked(verEvaluacion).mockRejectedValueOnce(yaNoExiste)
    vi.mocked(verPostulacion).mockRejectedValueOnce(yaNoExiste)
    montar()

    expect(
      await screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'No pudimos abrir tu evaluación.' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).toBeNull()
  })

  /*
    Con la evaluación abierta desde antes de que la retiren, quien se entera es el botón.
    Antes solo la prueba del puesto lo sabía leer: aquí «Empezar evaluación» se tragaba el
    404, cada respuesta quedaba en «No se pudo guardar» sin decir por qué y la entrega
    enseñaba el texto del servidor dentro del modal (QA-830D-C3-1).
  */
  const yaNoExiste = () => new ErrorApi(404, "Postulación not found with código: 'x1'")

  /** La siguiente lectura de la evaluación y la de su proceso contestan que ya no existe. */
  function laRetiran() {
    vi.mocked(verEvaluacion).mockRejectedValueOnce(yaNoExiste())
    vi.mocked(verPostulacion).mockRejectedValueOnce(yaNoExiste())
  }

  const elAviso = () =>
    screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ })

  it('abierta sin empezar, «Empezar evaluación» con 404 dice que la vacante ya no está', async () => {
    montar()
    const empezarla = await screen.findByRole('button', { name: /Empezar evaluación/ })

    vi.mocked(iniciarEvaluacion).mockRejectedValueOnce(yaNoExiste())
    laRetiran()
    fireEvent.click(empezarla)

    expect(await elAviso()).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Empezar evaluación/ })).toBeNull()
    expect(screen.queryByText(/not found/)).toBeNull()
  })

  it('en curso, una respuesta con 404 dice que la vacante ya no está, no «No se pudo guardar»', async () => {
    await empezar()

    vi.mocked(responderEvaluacion).mockRejectedValueOnce(yaNoExiste())
    laRetiran()
    responder('Una respuesta que ya no tiene dónde guardarse.')
    siguiente()

    expect(await elAviso()).toBeTruthy()
    expect(screen.queryByText('No se pudo guardar')).toBeNull()
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull()
  })

  it('al entregar, un 404 lo dice fuera del modal y sin el texto del servidor', async () => {
    guardadas.set(1, 'Uno.')
    opcionesGuardadas.set(CON_OPCIONES, 21)
    guardadas.set(3, 'Tres.')
    guardadas.set(4, 'Cuatro.')
    iniciada = true
    montar()
    // Con todo respondido, la barra lleva «Entregar la evaluación» desde cualquier pregunta.
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar la evaluación' }))
    const entregarla = await screen.findByRole('button', { name: 'Entregar' })

    vi.mocked(entregarEvaluacion).mockRejectedValueOnce(yaNoExiste())
    laRetiran()
    fireEvent.click(entregarla)

    expect(await elAviso()).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/not found/)).toBeNull()
  })

  it('un 404 al empezar con la evaluación todavía ahí no se hace pasar por una vacante retirada', async () => {
    montar()
    const empezarla = await screen.findByRole('button', { name: /Empezar evaluación/ })

    // La evaluación se vuelve a leer y sigue ahí: el 404 era otra cosa, y se dice.
    vi.mocked(iniciarEvaluacion).mockRejectedValueOnce(
      new ErrorApi(404, 'No tienes una evaluación asignada'),
    )
    fireEvent.click(empezarla)

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /No tienes una evaluación asignada/,
    )
    expect(screen.queryByRole('heading', { name: /Esta vacante ya no está disponible/ })).toBeNull()
    expect(verEvaluacion).toHaveBeenCalledTimes(2)
    // Ni se le preguntó a su proceso: la evaluación contestó.
    expect(verPostulacion).not.toHaveBeenCalled()
  })

  it('un 404 al responder con la evaluación todavía ahí sigue en «No se pudo guardar»', async () => {
    await empezar()

    vi.mocked(responderEvaluacion).mockRejectedValueOnce(
      new ErrorApi(404, 'Pregunta not found with id: 1'),
    )
    responder('Una respuesta.')
    siguiente()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))

    expect(await screen.findByText('No se pudo guardar')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Esta vacante ya no está disponible/ })).toBeNull()
    expect(verPostulacion).not.toHaveBeenCalled()
  })

  it('un fallo que no es 404 al empezar se dice, en vez de tragárselo', async () => {
    montar()
    const empezarla = await screen.findByRole('button', { name: /Empezar evaluación/ })

    vi.mocked(iniciarEvaluacion).mockRejectedValueOnce(
      new ErrorApi(500, 'El sistema tuvo un problema. Inténtalo de nuevo en un momento.'),
    )
    fireEvent.click(empezarla)

    expect((await screen.findByRole('alert')).textContent).toMatch(/El sistema tuvo un problema/)
    // Un 500 no es una puerta cerrada: ni se vuelve a leer la evaluación.
    expect(verEvaluacion).toHaveBeenCalledTimes(1)
  })
})

// ---------- La prueba al instante (V70) ----------

describe('al entregar, la prueba al instante', () => {
  /** Todas respondidas en el servidor; se abre la última y se entrega. */
  async function entregarTodo(clics = 1) {
    for (let n = 1; n <= TOTAL; n++) guardadas.set(n, `Respuesta ${n}.`)
    opcionesGuardadas.set(CON_OPCIONES, 21)
    iniciada = true
    montar()
    await screen.findByLabelText('Tu respuesta')
    siguiente()
    siguiente()
    siguiente()
    entregarLaEvaluacion()
    const entregar = await screen.findByRole('button', { name: 'Entregar' })
    await waitFor(() => expect((entregar as HTMLButtonElement).disabled).toBe(false))
    for (let i = 0; i < clics; i++) fireEvent.click(entregar)
  }

  /** Lo que dice su postulación ya guardada, después de entregar. */
  function quedoEn(estado: string, instrumentoEtapaTecnica: string | null = 'PRUEBA_PROPIA') {
    vi.mocked(verPostulacion).mockResolvedValueOnce({
      resumen: { uuid: 'x1', estado, instrumentoEtapaTecnica, pruebaSinCompletar: false },
      historial: [],
    } as unknown as Awaited<ReturnType<typeof verPostulacion>>)
  }

  it('QA-UPP-14: un doble clic en «Entregar la evaluación» no entrega aunque el segundo caiga en «Entregar»; leído el diálogo, sí', async () => {
    // El reloj con el que el diálogo cuenta su primer medio segundo, adelantable sin pararlo.
    const real = performance.now.bind(performance)
    let adelanto = 0
    vi.spyOn(performance, 'now').mockImplementation(() => real() + adelanto)
    /** Un toque o un clic entero, como lo da el navegador: apretar, soltar y el `click`. */
    const pulsar = (el: Element, detail: number) => {
      fireEvent.pointerDown(el)
      fireEvent.mouseDown(el, { detail })
      fireEvent.pointerUp(el)
      fireEvent.mouseUp(el, { detail })
      fireEvent.click(el, { detail })
    }
    for (let n = 1; n <= TOTAL; n++) guardadas.set(n, `Respuesta ${n}.`)
    opcionesGuardadas.set(CON_OPCIONES, 21)
    iniciada = true
    quedoEn('PERFIL_CALIFICANDO')
    montar()
    await screen.findByLabelText('Tu respuesta')
    siguiente()
    siguiente()
    siguiente()

    pulsar(screen.getByRole('button', { name: 'Entregar la evaluación' }), 1)
    const dialogo = await screen.findByRole('dialog', { name: 'Entregar la evaluación' })
    const entregar = within(dialogo).getByRole('button', { name: 'Entregar' })
    await waitFor(() => expect((entregar as HTMLButtonElement).disabled).toBe(false))
    // El segundo de la serie, pase el tiempo que pase
    pulsar(entregar, 2)
    adelanto += 2 * GRACIA_TRAS_ABRIR_MS
    pulsar(entregar, 2)
    // La entrega llama al servidor unas microtareas después del clic: se espera antes de mirarlo.
    await act(() => new Promise((seguir) => setTimeout(seguir, 20)))
    expect(entregarEvaluacion).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Entregar la evaluación' })).toBe(dialogo)

    // Leído, un clic normal entrega
    pulsar(entregar, 1)
    expect(await screen.findByText('Su proceso')).toBeTruthy()
    expect(entregarEvaluacion).toHaveBeenCalledTimes(1)
  })

  it('con pase automático lleva a la portada de su prueba y lo dice', async () => {
    quedoEn('PRUEBA_TURNO_CANDIDATO')
    await entregarTodo()

    expect(await screen.findByText('Portada de la prueba')).toBeTruthy()
    expect(screen.getByText('Tu prueba del puesto ya está disponible')).toBeTruthy()
    expect(verPostulacion).toHaveBeenCalledWith('x1')
  })

  it('si la vacante rinde el cuestionario técnico, lleva a la portada del cuestionario', async () => {
    quedoEn('PRUEBA_TURNO_CANDIDATO', 'CUESTIONARIO_TECNICO')
    await entregarTodo()

    expect(await screen.findByText('Portada del cuestionario')).toBeTruthy()
  })

  it('sin pase automático vuelve a su proceso y dice que se le avisará', async () => {
    quedoEn('PERFIL_CALIFICANDO')
    await entregarTodo()

    expect(await screen.findByText('Su proceso')).toBeTruthy()
    expect(
      screen.getByText(
        'Evaluación entregada. Te avisaremos por correo y en la campana cuando te toque la prueba.',
      ),
    ).toBeTruthy()
  })

  it('si no se puede saber dónde quedó, el camino de siempre: su proceso', async () => {
    vi.mocked(verPostulacion).mockRejectedValueOnce(new Error('sin red'))
    await entregarTodo()

    expect(await screen.findByText('Su proceso')).toBeTruthy()
  })

  it('AC-10: la campana de la cabecera vuelve a pedir sus avisos, sin recargar', async () => {
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    try {
      quedoEn('PRUEBA_TURNO_CANDIDATO')
      await entregarTodo()

      expect(await screen.findByText('Portada de la prueba')).toBeTruthy()
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['avisos'] })
    } finally {
      invalidar.mockRestore()
    }
  })

  it('QA-V70-01: un doble clic en «Entregar» manda una sola entrega', async () => {
    quedoEn('PERFIL_CALIFICANDO')
    await entregarTodo(2)

    expect(await screen.findByText('Su proceso')).toBeTruthy()
    expect(entregarEvaluacion).toHaveBeenCalledTimes(1)
  })
})
