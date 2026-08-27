/**
 * Cuando cierra la prueba del puesto: para toda la vacante, o para una persona.
 *
 * Es configuracion de cada convocatoria —«todos entregan hasta el domingo»— y
 * hasta ahora no habia forma de hacerla desde el panel. Son dos alcances y son
 * distintos a proposito: la fecha de la vacante vale para todos, y la de una
 * persona manda sobre ella.
 *
 * ⚠️ **La zona horaria es el fallo caro de este archivo.** Quien usa el panel
 * escribe «domingo 23:59» pensando en su reloj, y el backend guarda un
 * `Instant` en UTC. Mandarlo mal no da error: cierra la prueba cinco horas
 * antes o despues de lo que la persona quiso, con examenes reales dentro. Las
 * dos conversiones estan abajo con su porque, y las prueba el test con fechas
 * literales en los dos sentidos — no con una ida y vuelta, que se cumple igual
 * cuando las dos funciones estan mal de forma simetrica.
 *
 * ⚠️ **El motivo es obligatorio en las dos llamadas y queda en la auditoria.**
 * No es un campo de relleno: es lo que leera alguien dentro de seis meses
 * preguntandose por que se movio una fecha.
 *
 * ⚠️ **No hay GET de la fecha vigente.** `VacantePanel` no trae ningun campo de
 * cierre de prueba, asi que el campo empieza vacio y la pantalla **no puede
 * decir que fecha rige hoy**. Se dice en voz alta en vez de fingir un valor. El
 * dia que el backend la exponga, sembrarla es una sola llamada a `aCampoLocal`.
 *
 * ⚠️ **Ninguno de los dos pinta un `<form>`.** Los dos viven dentro de
 * pantallas que ya tienen el suyo, y un `<form>` dentro de otro lo descarta el
 * navegador: el boton acaba enviando el de fuera. Todo es `type="button"` con
 * su `onClick`.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { ErrorApi } from '../api/cliente'
import { definirCierreDePrueba, definirPlazoDePrueba } from '../api/panel'
import type { CierrePruebaAplicado, PlazoDePrueba } from '../api/tipos'
import { ahora, formatearFechaLarga } from '@/dominio/reloj'
import { Campo, AreaTexto } from '@/ui/campos/Campo'
import estilos from './CierreDePrueba.module.css'

// ---------- Las dos conversiones ----------

/**
 * Lo que escribio la persona → el `Instant` que espera el backend.
 *
 * El campo `datetime-local` da hora **local y sin zona**: `2026-08-30T23:59`.
 * La especificacion dice que una cadena de fecha y hora sin desfase se
 * interpreta como hora local, asi que `new Date(...)` ya construye el instante
 * correcto y su `toISOString()` es el UTC que toca. Comprobado en Lima:
 * `2026-08-30T23:59` sale como `2026-08-31T04:59:00.000Z` — otro dia, que es
 * justo lo que hace que el fallo se cuele sin que nadie lo note.
 */
export function aInstanteUtc(local: string): string {
  return new Date(local).toISOString()
}

/**
 * El `Instant` del servidor → lo que el campo puede pintar.
 *
 * ⚠️ **Aqui es donde se cuela el error.** `toISOString().slice(0, 16)` parece
 * la vuelta natural y es la trampa: devuelve el reloj de UTC y el campo lo lee
 * como local, asi que en Lima pinta las 04:59 del dia 31 donde la persona
 * escribio las 23:59 del 30. Se arma con `getFullYear/getMonth/getDate/
 * getHours/getMinutes`, que son los que leen el reloj local — la misma solucion
 * que el «hoy» del perfil.
 *
 * El relleno a dos digitos tampoco sobra: con `2026-8-30T23:59` el campo se
 * queda **en blanco y sin decir nada**.
 */
export function aCampoLocal(instante: string): string {
  const d = new Date(instante)
  const dos = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
    `T${dos(d.getHours())}:${dos(d.getMinutes())}`
  )
}

// Con `step` sin tocar el navegador da `HH:MM`, pero algunos añaden segundos.
const FECHA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

const Motivo = z
  .string()
  .trim()
  .min(1, 'Escribe por qué se mueve la fecha. Queda guardado en la auditoría.')

const Cuando = z
  .string()
  .regex(FECHA_LOCAL, 'Elige el día y la hora en que se cierra la prueba.')
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Esa fecha no existe. Revísala.')

// Dos esquemas y no uno condicional: guardar pide fecha y motivo, y quitar
// pide solo el motivo. Comparten la regla del motivo, que es lo que importa.
const Guardar = z.object({ cuando: Cuando, motivo: Motivo })
const Quitar = z.object({ motivo: Motivo })

type Errores = { cuando?: string; motivo?: string }

/**
 * El bloque de `safeParse` que se copia en todo el proyecto: primer error por
 * campo y foco al primero que lo tenga.
 *
 * El `requestAnimationFrame` no sobra: sin el, el `aria-invalid` todavia no
 * esta en el DOM cuando se busca y el foco no se mueve de sitio.
 */
function primerErrorPorCampo(issues: { path: PropertyKey[]; message: string }[]): Errores {
  const nuevos: Errores = {}
  for (const problema of issues) {
    const campo = problema.path[0] as keyof Errores
    nuevos[campo] ??= problema.message
  }
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
  return nuevos
}

/** Un 403 no se explica como un 500: uno es el reparto de permisos, otro un fallo. */
function explicarFallo(causa: unknown, permiso: string): string {
  if (causa instanceof ErrorApi && causa.estado === 403) {
    return `Tu rol no puede mover esta fecha: hace falta el permiso «${permiso}». Pídeselo a quien administra los permisos del equipo.`
  }
  if (causa instanceof ErrorApi && causa.estado >= 500) {
    return 'El servidor falló al guardar la fecha, así que sigue rigiendo la de antes. Vuelve a intentarlo en un momento.'
  }
  return causa instanceof Error ? causa.message : 'No se pudo guardar la fecha.'
}

/**
 * ⚠️ **Las dos cifras se dicen siempre, y en palabras.**
 *
 * `intentosMovidos` son los examenes ya abiertos que se movieron a la fecha
 * nueva. `intentosConPlazoPropio` son los que **no** se movieron porque esa persona
 * tiene fecha propia. Callar el segundo deja creer que la fecha aplico a todos
 * cuando no, y el numero que hay que mirar es justamente ese.
 *
 * El `Number.isFinite` es defensivo a proposito: si el campo llegara vacio por
 * un desajuste del contrato, la frase lo dice en vez de pintar «undefined».
 */
function fraseDeLosMovidos(r: CierrePruebaAplicado, quitando: boolean): string {
  if (!Number.isFinite(r.intentosMovidos)) {
    return 'No pudimos leer cuántos exámenes ya abiertos cambiaron de fecha.'
  }
  if (r.intentosMovidos === 0) {
    return 'No había ningún examen abierto que mover.'
  }
  if (r.intentosMovidos === 1) {
    return quitando
      ? '1 examen ya abierto vuelve a contar los días de su plantilla.'
      : 'Se movió 1 examen ya abierto a esa fecha.'
  }
  return quitando
    ? `${r.intentosMovidos} exámenes ya abiertos vuelven a contar los días de su plantilla.`
    : `Se movieron ${r.intentosMovidos} exámenes ya abiertos a esa fecha.`
}

/** La frase de quien NO se movio. Va aparte porque se pinta destacada. */
function fraseDelPlazoPropio(r: CierrePruebaAplicado): string {
  if (!Number.isFinite(r.intentosConPlazoPropio)) {
    return 'No pudimos leer a cuántas personas no les afectó por tener fecha propia.'
  }
  if (r.intentosConPlazoPropio === 0) {
    return 'Nadie tenía fecha propia, así que esta rige para toda la convocatoria.'
  }
  if (r.intentosConPlazoPropio === 1) {
    return '1 persona no cambió: tiene fecha propia, y esa manda sobre la de la vacante.'
  }
  return `${r.intentosConPlazoPropio} personas no cambiaron: tienen fecha propia, y esa manda sobre la de la vacante.`
}

// ---------- La fecha de toda la vacante ----------

export function CierreDeLaVacante({
  vacanteId,
  alGuardar,
}: {
  vacanteId: number
  alGuardar: () => void
}) {
  const [cuando, setCuando] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState<'pasado' | 'quitar' | null>(null)
  const [aplicado, setAplicado] = useState<{ r: CierrePruebaAplicado; quitando: boolean } | null>(
    null,
  )

  // Dentro del render y no en el modulo: al leerlo al importar se queda con la
  // zona del proceso de entonces, y un test que fuerce otra estaria mirando
  // un dato que ya no corresponde a lo que se calcula.
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone

  const valida = FECHA_LOCAL.test(cuando) && !Number.isNaN(new Date(cuando).getTime())
  const instante = valida ? aInstanteUtc(cuando) : null

  const guardar = useMutation({
    mutationFn: ({ cierraEn, motivo: porQue }: { cierraEn: string | null; motivo: string }) =>
      definirCierreDePrueba(vacanteId, cierraEn, porQue),
    onMutate: () => {
      setFallo(null)
      setAplicado(null)
    },
    onSuccess: (r, variables) => {
      setAplicado({ r, quitando: variables.cierraEn === null })
      alGuardar()
    },
    onError: (causa) => setFallo(explicarFallo(causa, 'elegir_plantilla_prueba')),
  })

  function mandar(cierraEn: string | null, porQue: string) {
    setPreguntando(null)
    guardar.mutate({ cierraEn, motivo: porQue })
  }

  function intentarGuardar() {
    const revision = Guardar.safeParse({ cuando, motivo })
    if (!revision.success) {
      setErrores(primerErrorPorCampo(revision.error.issues))
      return
    }
    setErrores({})
    const iso = aInstanteUtc(revision.data.cuando)
    // ⚠️ Se avisa **antes** de llamar: una fecha ya pasada cierra la prueba a
    // todo el mundo en ese mismo momento, incluidos los que estan escribiendo.
    // El reloj es el del servidor, que es el que decide de verdad.
    if (Date.parse(iso) < ahora()) {
      setPreguntando('pasado')
      return
    }
    mandar(iso, revision.data.motivo)
  }

  function intentarQuitar() {
    const revision = Quitar.safeParse({ motivo })
    if (!revision.success) {
      setErrores(primerErrorPorCampo(revision.error.issues))
      return
    }
    setErrores({})
    setPreguntando('quitar')
  }

  return (
    <div className={estilos.bloque}>
      <h3 className={estilos.titulo}>Cuándo cierra la prueba</h3>
      <p className={estilos.prosa}>
        Una sola fecha para toda la convocatoria: «hasta el domingo», igual para todos. Sin
        ella, cada persona tiene los días que diga su plantilla contados desde que empieza,
        que dan una fecha distinta a cada una.
      </p>
      <p className={estilos.pista}>
        Esta pantalla no puede decirte qué fecha rige ahora mismo: el backend todavía no la
        devuelve al leer la vacante. Lo que guardes aquí sí queda aplicado.
      </p>

      <div className={estilos.campos}>
        <Campo
          etiqueta="Se cierra el"
          type="datetime-local"
          value={cuando}
          onChange={(e) => setCuando(e.target.value)}
          ayuda={`En tu zona horaria (${zona}). El servidor la guarda en UTC.`}
          error={errores.cuando}
          disabled={guardar.isPending}
        />

        {/* El eco es lo que quita la duda de verdad: se ve el instante exacto
            que se va a guardar, con su Z, antes de pulsar nada. */}
        {instante && (
          <p className={estilos.eco}>
            Se guardará como {instante} · eso es {formatearFechaLarga(instante)} en {zona}
          </p>
        )}

        <AreaTexto
          etiqueta="Por qué se fija esta fecha"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          ayuda="Obligatorio. Queda en la auditoría: es lo que se lee dentro de seis meses para saber por qué se movió."
          rows={3}
          error={errores.motivo}
          disabled={guardar.isPending}
        />
      </div>

      {preguntando === 'pasado' ? (
        <div className={estilos.pregunta} role="alert">
          <div className={estilos.cuerpoPregunta}>
            <p className={estilos.textoPregunta}>
              Esa fecha ya pasó. Guardarla cierra la prueba de esta vacante ahora mismo,
              incluidos los exámenes que alguien esté escribiendo en este momento.
            </p>
            <div className={estilos.botonesPregunta}>
              <button
                className={`${estilos.chico} ${estilos.seguir}`}
                type="button"
                onClick={() => mandar(aInstanteUtc(cuando), motivo.trim())}
                disabled={guardar.isPending}
              >
                Sí, cerrarla ahora
              </button>
              <button
                className={estilos.chico}
                type="button"
                onClick={() => setPreguntando(null)}
              >
                Mejor cambio la fecha
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={estilos.acciones}>
          <button
            className={estilos.principal}
            type="button"
            onClick={intentarGuardar}
            disabled={guardar.isPending}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar la fecha de cierre'}
          </button>
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {aplicado && (
        <div className={estilos.resultado} role="status">
          {aplicado.r.cierraEn ? (
            <p className={estilos.loQueQueda}>
              La prueba se cierra el {formatearFechaLarga(aplicado.r.cierraEn)} en {zona}.
            </p>
          ) : (
            <p className={estilos.loQueQueda}>
              La prueba ya no tiene fecha de cierre. Cada intento vuelve a contar los días de
              su plantilla desde que la persona lo abre.
            </p>
          )}
          <p className={estilos.detalle}>
            {fraseDeLosMovidos(aplicado.r, aplicado.quitando)}
          </p>
          <p className={estilos.loQueSorprende}>{fraseDelPlazoPropio(aplicado.r)}</p>
        </div>
      )}

      {/*
        Quitar el cierre es una operacion distinta y se ve distinta: su propia
        seccion, su propio titulo y su propio boton. Dejarla debajo del mismo
        boton «guardar» con el campo vacio la convierte en algo que se hace sin
        querer al borrar la fecha para escribir otra.
      */}
      <section className={estilos.quitar}>
        <h4 className={estilos.tituloQuitar}>Quitar el cierre</h4>
        <p className={estilos.prosa}>
          Deja la vacante sin fecha común. No es lo mismo que poner una fecha más lejana:
          cada intento vuelve a contar los días de su plantilla desde que cada persona lo
          abre, así que cada una tendrá la suya.
        </p>

        {preguntando === 'quitar' ? (
          <div className={estilos.pregunta} role="alert">
            <div className={estilos.cuerpoPregunta}>
              <p className={estilos.textoPregunta}>
                Se quita la fecha común de la vacante y los exámenes ya abiertos vuelven a los
                días de su plantilla. ¿Seguimos?
              </p>
              <div className={estilos.botonesPregunta}>
                <button
                  className={`${estilos.chico} ${estilos.seguir}`}
                  type="button"
                  onClick={() => mandar(null, motivo.trim())}
                  disabled={guardar.isPending}
                >
                  Sí, quitar el cierre
                </button>
                <button
                  className={estilos.chico}
                  type="button"
                  onClick={() => setPreguntando(null)}
                >
                  Mejor no
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className={estilos.secundaria}
            type="button"
            onClick={intentarQuitar}
            disabled={guardar.isPending}
          >
            Quitar el cierre de la vacante
          </button>
        )}
      </section>
    </div>
  )
}

// ---------- La fecha de una sola persona ----------

/**
 * El plazo de quien esta en la ficha, que manda sobre el de la vacante.
 *
 * Sirve para dos cosas opuestas —darle mas horas a quien las pidio, y meterla
 * en la tanda del domingo— asi que la pantalla **no dice si el plazo se acorto
 * o se alargo**: no conoce el anterior, y afirmarlo seria uno de esos
 * indicadores que mienten.
 */
export function PlazoDeUnaPersona({
  postulacionId,
  alGuardar,
}: {
  postulacionId: number
  alGuardar: () => void
}) {
  const [cuando, setCuando] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState(false)
  const [aplicado, setAplicado] = useState<PlazoDePrueba | null>(null)

  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone
  const valida = FECHA_LOCAL.test(cuando) && !Number.isNaN(new Date(cuando).getTime())
  const instante = valida ? aInstanteUtc(cuando) : null

  const guardar = useMutation({
    mutationFn: ({ venceEn, motivo: porQue }: { venceEn: string; motivo: string }) =>
      definirPlazoDePrueba(postulacionId, venceEn, porQue),
    onMutate: () => {
      setFallo(null)
      setAplicado(null)
    },
    onSuccess: (r) => {
      setAplicado(r)
      alGuardar()
    },
    onError: (causa) => setFallo(explicarFallo(causa, 'mover_postulacion')),
  })

  function mandar(venceEn: string, porQue: string) {
    setPreguntando(false)
    guardar.mutate({ venceEn, motivo: porQue })
  }

  function intentarGuardar() {
    const revision = Guardar.safeParse({ cuando, motivo })
    if (!revision.success) {
      setErrores(primerErrorPorCampo(revision.error.issues))
      return
    }
    setErrores({})
    const iso = aInstanteUtc(revision.data.cuando)
    if (Date.parse(iso) < ahora()) {
      setPreguntando(true)
      return
    }
    mandar(iso, revision.data.motivo)
  }

  return (
    <div className={estilos.bloque}>
      <h3 className={estilos.titulo}>El plazo de esta persona</h3>
      <p className={estilos.prosa}>
        Una fecha solo para ella, que manda sobre la de la vacante. Sirve para darle más
        horas si las pidió, y también para dejarla fuera de la fecha común de la
        convocatoria.
      </p>

      <div className={estilos.campos}>
        <Campo
          etiqueta="Se le cierra el"
          type="datetime-local"
          value={cuando}
          onChange={(e) => setCuando(e.target.value)}
          ayuda={`En tu zona horaria (${zona}). El servidor la guarda en UTC.`}
          error={errores.cuando}
          disabled={guardar.isPending}
        />

        {instante && (
          <p className={estilos.eco}>
            Se guardará como {instante} · eso es {formatearFechaLarga(instante)} en {zona}
          </p>
        )}

        <AreaTexto
          etiqueta="Por qué esta persona tiene otro plazo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          ayuda="Obligatorio. Queda en la auditoría: es lo que explica el trato distinto si alguien lo revisa."
          rows={3}
          error={errores.motivo}
          disabled={guardar.isPending}
        />
      </div>

      {preguntando ? (
        <div className={estilos.pregunta} role="alert">
          <div className={estilos.cuerpoPregunta}>
            <p className={estilos.textoPregunta}>
              Esa fecha ya pasó. Guardarla le cierra la prueba ahora mismo, aunque la esté
              escribiendo en este momento.
            </p>
            <div className={estilos.botonesPregunta}>
              <button
                className={`${estilos.chico} ${estilos.seguir}`}
                type="button"
                onClick={() => mandar(aInstanteUtc(cuando), motivo.trim())}
                disabled={guardar.isPending}
              >
                Sí, cerrársela ahora
              </button>
              <button
                className={estilos.chico}
                type="button"
                onClick={() => setPreguntando(false)}
              >
                Mejor cambio la fecha
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={estilos.acciones}>
          <button
            className={estilos.principal}
            type="button"
            onClick={intentarGuardar}
            disabled={guardar.isPending}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar el plazo'}
          </button>
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {aplicado && (
        <div className={estilos.resultado} role="status">
          <p className={estilos.loQueQueda}>
            Se le cierra el {formatearFechaLarga(aplicado.venceEn)} en {zona}.
          </p>
          {/* ⚠️ `yaEmpezo` cambia el significado de lo que se acaba de hacer:
              no es lo mismo fijar el plazo de quien no ha abierto el examen que
              cambiárselo a quien lo tiene delante. */}
          {aplicado.yaEmpezo ? (
            <p className={estilos.loQueSorprende}>
              Ya tiene el examen abierto: acabas de cambiarle el plazo mientras lo está
              haciendo.
            </p>
          ) : (
            <p className={estilos.detalle}>
              Todavía no ha abierto el examen. Este plazo rige desde que lo abra.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
