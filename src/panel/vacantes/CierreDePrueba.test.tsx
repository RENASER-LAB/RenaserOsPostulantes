/**
 * Lo que compila perfectamente estando mal al fijar cuándo cierra la prueba.
 *
 *   0. **Mandar la hora local como si fuera UTC.** Es el fallo caro y el que
 *      justifica este archivo: nadie ve un error, la prueba simplemente se
 *      cierra cinco horas antes o después de lo que la persona quiso, con
 *      exámenes reales dentro.
 *
 *      ⚠️ **Una ida y vuelta no lo detecta.** Este par está roto y la cumple:
 *
 *          aInstanteUtc = (l) => new Date(l + 'Z').toISOString()
 *          aCampoLocal  = (i) => new Date(i).toISOString().slice(0, 16)
 *
 *      `2026-08-30T23:59` sale y vuelve idéntico, y el instante guardado está
 *      cinco horas movido. Por eso las dos direcciones se comprueban contra
 *      **fechas literales**, y la ida y vuelta es solo la tercera afirmación.
 *
 *   1. **Callar `intentosConPlazoPropio`.** Son las personas a las que la fecha NO les
 *      llegó por tener plazo propio. Sin decirlo, se cree que aplicó a todos.
 *   2. **Esconder «quitar el cierre» detrás de guardar con el campo vacío.** Es
 *      otra regla —cada intento vuelve a los días de su plantilla—, no otra
 *      fecha, y así se hace sin querer al borrar el campo para reescribirlo.
 *   3. **Avisar de la fecha pasada después de llamar.** Para entonces la prueba
 *      ya está cerrada para todo el mundo.
 *   4. **Guardar sin motivo.** El backend lo exige (`@NotBlank`) y además es lo
 *      único que explica dentro de seis meses por qué se movió una fecha.
 */

/*
 * ⚠️ **La zona se fuerza a Lima y las fechas de este archivo son literales.**
 *
 * Sin fijarla, el mismo test pasa o falla según dónde corra, que es justo la
 * clase de fallo que persigue. Se comprobó que asignar `process.env.TZ` a mitad
 * de proceso sí cambia lo que construye `new Date` en Node, y se restaura al
 * terminar para no contaminar los demás archivos del mismo worker.
 *
 * Lima es UTC-5 todo el año —no tiene horario de verano— así que `23:59` de un
 * día es siempre `04:59Z` del **siguiente**. Ese salto de día es el que hace
 * invisible el fallo.
 */
const ZONA_ANTES = process.env.TZ
process.env.TZ = 'America/Lima'

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { CierreDeLaVacante, PlazoDeUnaPersona, aCampoLocal, aInstanteUtc } from './CierreDePrueba'

afterAll(() => {
  process.env.TZ = ZONA_ANTES
})

const cierre = vi.fn()
const plazo = vi.fn()

vi.mock('../api/panel', () => ({
  definirCierreDePrueba: (vacanteId: number, cierraEn: string | null, motivo: string) =>
    cierre(vacanteId, cierraEn, motivo),
  definirPlazoDePrueba: (postulacionId: number, venceEn: string, motivo: string) =>
    plazo(postulacionId, venceEn, motivo),
}))

/** Lejos en el futuro y de noche: el instante en UTC cae ya en el día siguiente. */
const NOCHE = '2035-08-30T23:59'
const NOCHE_UTC = '2035-08-31T04:59:00.000Z'
/** Una fecha que pasó hace años, sin depender de cuándo corran las pruebas. */
const PASADA = '2020-03-01T09:00'

function montarVacante(alGuardar = () => {}) {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <CierreDeLaVacante vacanteId={7} alGuardar={alGuardar} />
    </QueryClientProvider>,
  )
}

function montarPersona(alGuardar = () => {}) {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <PlazoDeUnaPersona postulacionId={31} alGuardar={alGuardar} />
    </QueryClientProvider>,
  )
}

function escribir(etiqueta: string | RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

beforeEach(() => {
  cierre.mockReset()
  plazo.mockReset()
  cierre.mockResolvedValue({ cierraEn: NOCHE_UTC, intentosMovidos: 0, intentosConPlazoPropio: 0 })
  plazo.mockResolvedValue({ postulacionId: 31, venceEn: NOCHE_UTC, yaEmpezo: false })
})

afterEach(cleanup)

describe('la hora que se escribe y el instante que se guarda', () => {
  it('las 23:59 de Lima son las 04:59 UTC del día siguiente, en los dos sentidos', () => {
    // Ida: lo que el campo da como hora local → el `Instant` del backend.
    // El literal es lo que hace el test: con `new Date(l + 'Z')` saldría
    // `2035-08-30T23:59:00.000Z`, cinco horas antes, y nadie lo notaría.
    expect(aInstanteUtc(NOCHE)).toBe(NOCHE_UTC)

    // Vuelta: el `Instant` del backend → lo que el campo puede pintar. Con
    // `toISOString().slice(0, 16)` saldría `2035-08-31T04:59`: otro día y otra
    // hora, y el campo lo leería como local.
    expect(aCampoLocal(NOCHE_UTC)).toBe(NOCHE)

    // Y solo entonces la ida y vuelta, que por sí sola no prueba nada.
    expect(aCampoLocal(aInstanteUtc(NOCHE))).toBe(NOCHE)
  })

  it('rellena a dos dígitos, porque el campo se queda en blanco si no', () => {
    // `2035-1-5T03:04` no es un error para nadie: el `datetime-local`
    // simplemente no pinta nada y parece que el dato se perdió.
    expect(aCampoLocal('2035-01-05T08:04:00Z')).toBe('2035-01-05T03:04')
  })

  it('lo que se manda al servidor es el instante en UTC, no lo que se escribió', async () => {
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, 'Cierre común de la convocatoria de agosto.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    await waitFor(() =>
      expect(cierre).toHaveBeenCalledWith(7, NOCHE_UTC, 'Cierre común de la convocatoria de agosto.'),
    )
  })

  it('el eco enseña el instante en UTC antes de pulsar nada', () => {
    montarVacante()
    escribir('Se cierra el', NOCHE)

    // Es lo que quita la duda: se ve el salto de día antes de guardar.
    expect(screen.getByText(new RegExp(NOCHE_UTC))).toBeTruthy()
  })
})

describe('el motivo, que queda en la auditoría', () => {
  it('sin motivo no se llama al servidor', async () => {
    montarVacante()
    escribir('Se cierra el', NOCHE)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(cierre).not.toHaveBeenCalled()
    expect(await screen.findByText(/Escribe por qué se mueve la fecha/i)).toBeTruthy()
  })

  it('los espacios en blanco no son un motivo', async () => {
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, '    ')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(cierre).not.toHaveBeenCalled()
  })

  it('quitar el cierre tampoco se hace sin motivo', async () => {
    montarVacante()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el cierre de la vacante' }))

    expect(cierre).not.toHaveBeenCalled()
    expect(await screen.findByText(/Escribe por qué se mueve la fecha/i)).toBeTruthy()
  })

  it('sin fecha no se guarda, y se dice cuál falta', async () => {
    montarVacante()
    escribir(/Por qué se fija esta fecha/, 'Se acordó en el comité.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(cierre).not.toHaveBeenCalled()
    expect(await screen.findByText(/Elige el día y la hora/i)).toBeTruthy()
  })
})

describe('quitar el cierre es otra operación', () => {
  it('tiene su propio botón, pregunta antes y manda la fecha vacía', async () => {
    montarVacante()
    cierre.mockResolvedValue({ cierraEn: null, intentosMovidos: 2, intentosConPlazoPropio: 0 })
    escribir(/Por qué se fija esta fecha/, 'Se alarga la convocatoria sin fecha fija.')

    // No es «guardar con el campo vacío»: es un control con otro nombre.
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el cierre de la vacante' }))
    expect(cierre).not.toHaveBeenCalled()
    expect(screen.getByText(/vuelven a los días de su plantilla/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar el cierre' }))
    await waitFor(() =>
      expect(cierre).toHaveBeenCalledWith(7, null, 'Se alarga la convocatoria sin fecha fija.'),
    )

    // Y lo que queda se cuenta como la regla que es, no como una fecha.
    expect(await screen.findByText(/ya no tiene fecha de cierre/i)).toBeTruthy()
  })

  it('«mejor no» no manda nada', () => {
    montarVacante()
    escribir(/Por qué se fija esta fecha/, 'Duda del comité.')
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el cierre de la vacante' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mejor no' }))

    expect(cierre).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Quitar el cierre de la vacante' })).toBeTruthy()
  })
})

describe('lo que devuelve el cierre', () => {
  it('dice cuántas personas NO cambiaron por tener fecha propia', async () => {
    cierre.mockResolvedValue({ cierraEn: NOCHE_UTC, intentosMovidos: 4, intentosConPlazoPropio: 2 })
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, 'Cierre común de agosto.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(await screen.findByText(/Se movieron 4 exámenes ya abiertos/i)).toBeTruthy()
    // Callar esta frase deja creer que la fecha aplicó a todos.
    expect(screen.getByText(/2 personas no cambiaron: tienen fecha propia/i)).toBeTruthy()
  })

  /*
   * ⚠️ **El contrato del panel y el del backend no coinciden hoy.** El `record`
   * de Java devuelve `intentosConPlazoPropio` y `tipos.ts` declara
   * `intentosConPlazoPropio`, asi que en produccion ese campo llega `undefined`.
   *
   * Esta prueba no fija el nombre del campo —el arreglo es renombrarlo en
   * `tipos.ts`— sino que la cifra que falta se dice con palabras en vez de
   * pintar «undefined personas» justo en la frase que existe para que nadie
   * crea que la fecha aplico a todos.
   */
  it('si la cifra no llega, se dice; no se pinta «undefined»', async () => {
    cierre.mockResolvedValue({ cierraEn: NOCHE_UTC, intentosMovidos: 4 })
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, 'Cierre común de agosto.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(await screen.findByText(/No pudimos leer a cuántas personas/i)).toBeTruthy()
    expect(screen.queryByText(/undefined/i)).toBeNull()
  })

  it('cuando no hay nadie con fecha propia, también lo dice', async () => {
    cierre.mockResolvedValue({ cierraEn: NOCHE_UTC, intentosMovidos: 1, intentosConPlazoPropio: 0 })
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, 'Cierre común de agosto.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    // El silencio se leería como «no había nada que decir», que es lo contrario
    // de lo que significa: aquí sí rige para toda la convocatoria.
    expect(await screen.findByText(/Nadie tenía fecha propia/i)).toBeTruthy()
  })
})

describe('una fecha que ya pasó', () => {
  it('avisa antes de llamar, no después', async () => {
    montarVacante()
    escribir('Se cierra el', PASADA)
    escribir(/Por qué se fija esta fecha/, 'Se cierra la convocatoria hoy.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    // Nada ha salido todavía: para cuando el servidor conteste, la prueba ya
    // estaría cerrada para todo el mundo.
    expect(cierre).not.toHaveBeenCalled()
    expect(screen.getByText(/cierra la prueba de esta vacante ahora mismo/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, cerrarla ahora' }))
    await waitFor(() => expect(cierre).toHaveBeenCalledTimes(1))
    expect(cierre.mock.calls[0]![1]).toBe(aInstanteUtc(PASADA))
  })

  it('se puede volver atrás sin haber cerrado nada', () => {
    montarVacante()
    escribir('Se cierra el', PASADA)
    escribir(/Por qué se fija esta fecha/, 'Se cierra la convocatoria hoy.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mejor cambio la fecha' }))

    expect(cierre).not.toHaveBeenCalled()
  })
})

describe('el plazo de una sola persona', () => {
  it('manda el instante en UTC y avisa el padre', async () => {
    const aviso = vi.fn()
    montarPersona(aviso)
    escribir('Se le cierra el', NOCHE)
    escribir(/Por qué esta persona tiene otro plazo/, 'Pidió más horas por un viaje.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar el plazo' }))

    await waitFor(() =>
      expect(plazo).toHaveBeenCalledWith(31, NOCHE_UTC, 'Pidió más horas por un viaje.'),
    )
    expect(aviso).toHaveBeenCalled()
  })

  it('si ya abrió el examen, se dice que se le cambió en vivo', async () => {
    plazo.mockResolvedValue({ postulacionId: 31, venceEn: NOCHE_UTC, yaEmpezo: true })
    montarPersona()
    escribir('Se le cierra el', NOCHE)
    escribir(/Por qué esta persona tiene otro plazo/, 'Pidió más horas.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar el plazo' }))

    expect(await screen.findByText(/mientras lo está haciendo/i)).toBeTruthy()
  })

  it('si no lo ha abierto, se dice desde cuándo rige', async () => {
    montarPersona()
    escribir('Se le cierra el', NOCHE)
    escribir(/Por qué esta persona tiene otro plazo/, 'Entra en la tanda del domingo.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar el plazo' }))

    expect(await screen.findByText(/rige desde que lo abra/i)).toBeTruthy()
  })

  it('sin motivo no se llama al servidor', () => {
    montarPersona()
    escribir('Se le cierra el', NOCHE)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar el plazo' }))

    expect(plazo).not.toHaveBeenCalled()
  })
})

describe('cuando el servidor dice que no', () => {
  it('un 403 nombra el permiso que falta, no «no se pudo»', async () => {
    cierre.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, 'Cierre común de agosto.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(await screen.findByText(/elegir_plantilla_prueba/)).toBeTruthy()
  })

  it('el 403 del plazo nombra otro permiso, que es otro', async () => {
    plazo.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montarPersona()
    escribir('Se le cierra el', NOCHE)
    escribir(/Por qué esta persona tiene otro plazo/, 'Pidió más horas.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar el plazo' }))

    expect(await screen.findByText(/mover_postulacion/)).toBeTruthy()
  })

  it('un 500 dice que sigue rigiendo la fecha de antes', async () => {
    cierre.mockRejectedValue(new ErrorApi(500, 'Internal Server Error', null))
    montarVacante()
    escribir('Se cierra el', NOCHE)
    escribir(/Por qué se fija esta fecha/, 'Cierre común de agosto.')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la fecha de cierre' }))

    expect(await screen.findByText(/sigue rigiendo la de antes/i)).toBeTruthy()
  })
})
