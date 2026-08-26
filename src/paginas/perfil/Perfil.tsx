/**
 * Mi perfil.
 *
 * Un perfil por persona, no por vacante ni por empresa: se llena una vez y sirve
 * para postular a cualquier sitio.
 *
 * **Nada de aquí es obligatorio y nada bloquea ningún botón.** Se puede postular
 * con el perfil vacío, y `GET /perfil` sin perfil responde 200 con todo vacío,
 * no 404: la pantalla siempre tiene algo que pintar.
 *
 * **El perfil no puntúa.** No entra en el ranking ni cambia notas. Por eso vive
 * lejos de «Mis procesos» y no se pinta junto a ningún resultado.
 *
 * ⚠️ **El currículum no se sube desde aquí, y no es un olvido**: no existe
 * ninguna ruta para eso. El archivo llega al postular, y de ahí sale la lectura.
 * Esta pantalla informa de en qué punto está esa lectura; no ofrece un botón que
 * no existe.
 *
 * ⚠️ **La cabecera es un PUT que reemplaza los siete campos de golpe.** Se
 * siembra del GET y se manda entera. Guardar campo a campo borraría los seis que
 * no van en la petición — es la misma forma del fallo que ya costó respuestas
 * perdidas en la evaluación.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  descargarMisDatos,
  guardarCabecera,
  nivelesEducativos,
  nivelesIdioma,
  verPerfil,
} from '@/api/perfil'
import type { PerfilCompleto } from '@/api/tipos'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { AreaTexto, Campo } from '@/ui/campos/Campo'
import { Certificaciones, Educacion, Enlaces, Experiencia, Idiomas } from './Listas'
import estilos from './Perfil.module.css'

/** Mientras la lectura corre de verdad. Ver `sondeo`. */
const CADA_5_SEGUNDOS = 5_000

/**
 * Lo máximo que cabe en la pretensión.
 *
 * La columna es `numeric(12,2)` —diez dígitos enteros—, así que once desbordan
 * y Postgres corta con un 500 que la pantalla no puede explicar. Se para antes.
 */
const TOPE_PRETENSION = 9_999_999_999

/**
 * Cuántos datos dedujo la IA y nadie ha mirado todavía.
 *
 * Solo las cuatro listas con origen: los enlaces no lo llevan.
 */
function cuantosSinConfirmar(perfil: PerfilCompleto): number {
  const listas = [perfil.experiencia, perfil.educacion, perfil.idiomas, perfil.certificaciones]
  return listas
    .flat()
    .filter((d) => d.origen === 'CURRICULUM' && !d.confirmado).length
}

export function Perfil() {
  const avisar = useAviso()

  const consulta = useQuery({
    queryKey: ['perfil'],
    queryFn: verPerfil,
    // Solo mientras la lectura del currículum está corriendo de verdad. Es
    // seguro sondear contra `EN_CURSO`: el backend lo deriva de la cola, así que
    // no hay ningún estado que se quede girando para siempre.
    refetchInterval: (q) => (q.state.data?.lecturaCv.estado === 'EN_CURSO' ? CADA_5_SEGUNDOS : false),
  })

  const educativos = useQuery({ queryKey: ['catalogo-niveles-educativos'], queryFn: nivelesEducativos })
  const idiomas = useQuery({ queryKey: ['catalogo-niveles-idioma'], queryFn: nivelesIdioma })

  async function descargar() {
    try {
      const datos = await descargarMisDatos()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }),
      )
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = 'mis-datos-ex.json'
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'No pudimos preparar la descarga.')
    }
  }

  if (consulta.isPending) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.estado} aria-busy="true">
          <h1>Cargando tu perfil…</h1>
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
          <div className={`${estilos.barra} ${estilos.barraCorta}`} />
        </div>
      </div>
    )
  }

  // ⚠️ **`isError` a secas NO sirve aquí.** TanStack Query pone `status: 'error'`
  // aunque `data` siga estando —lo hace sin condiciones al fallar un refresco de
  // fondo— y esta pantalla se sondea sola cada cinco segundos mientras se lee el
  // curriculum. Mirando solo `isError`, un hipo del servidor desmontaba el
  // formulario entero y se llevaba lo que la persona estuviera escribiendo,
  // justo en la pantalla que le dice «puedes seguir llenando lo que quieras».
  //
  // La pantalla de fallo es solo para cuando NO hay nada que enseñar. Con datos
  // en mano, el fallo se cuenta sin tirar nada.
  if (consulta.isError && !consulta.data) {
    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.procesos()}>
          ← Volver a mis procesos
        </Link>
        <div className={estilos.estado}>
          <h1>No pudimos cargar tu perfil.</h1>
          <p className={estilos.estadoTexto}>
            {consulta.error instanceof Error
              ? consulta.error.message
              : 'No pudimos conectar con el servidor.'}
          </p>
          <button
            type="button"
            className={estilos.reintentar}
            onClick={() => void consulta.refetch()}
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const perfil = consulta.data
  const porRevisar = cuantosSinConfirmar(perfil)

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.procesos()}>
        ← Volver a mis procesos
      </Link>

      <div className={estilos.encabezado}>
        <h1>Tu perfil.</h1>
        <p className={estilos.bajada}>
          Lo llenas una vez y vale para todas las vacantes del portal. Nada es obligatorio, y
          no tenerlo no te impide postular ni cambia ninguna nota.
        </p>
      </div>

      {/*
        Lo que se anuncia va en una región que existe SIEMPRE y cambia de
        contenido. Una región viva que se monta ya con su texto dentro no se
        anuncia de forma fiable: el lector de pantalla vigila los cambios de una
        región que ya estaba, no la aparición de una nueva.
      */}
      <p className={estilos.soloLectores} aria-live="polite">
        {porRevisar > 0
          ? `Te queda${porRevisar === 1 ? '' : 'n'} ${porRevisar} dato${porRevisar === 1 ? '' : 's'} del currículum por revisar.`
          : ''}
      </p>

      {/*
        El único violeta de la pantalla. Sale solo si hay algo que revisar, que
        es lo que lo mantiene significando «te toca a ti».
      */}
      {porRevisar > 0 && (
        <section className={estilos.porRevisar}>
          {/*
            El título cuenta lo que está **sin revisar**, no lo que vino del
            currículum: decía «3 datos que sacamos de tu currículum» en una
            pantalla donde había cuatro con esa procedencia —tres pendientes y
            uno ya confirmado— y el número no cuadraba con lo que se veía.
          */}
          <h2 className={estilos.porRevisarTitulo}>
            {porRevisar === 1
              ? 'Te queda un dato por revisar'
              : `Te quedan ${porRevisar} datos por revisar`}
          </h2>
          <p className={estilos.porRevisarTexto}>
            Los sacamos de tu currículum con un sistema automático, así que pueden estar mal.
            Búscalos abajo —van marcados como <b>sin confirmar</b>— y dinos si están bien o
            corrígelos.
          </p>
        </section>
      )}

      {/*
        El refresco de fondo falló pero lo que se ve sigue siendo bueno: se dice
        que puede estar desactualizado, sin quitar nada de en medio.
      */}
      {consulta.isError && (
        <p className={estilos.desactualizado} role="status">
          No pudimos comprobar si hay algo nuevo. Lo que ves es lo último que
          sabemos; sigue funcionando y puedes seguir editando.{' '}
          <button
            type="button"
            className={estilos.reintentarEnLinea}
            onClick={() => void consulta.refetch()}
          >
            Volver a comprobar
          </button>
        </p>
      )}

      <EstadoDeLaLectura perfil={perfil} />

      <div className={estilos.secciones}>
        <Cabecera perfil={perfil} />
        <Experiencia filas={perfil.experiencia} />
        <Educacion
          filas={perfil.educacion}
          niveles={educativos.data ?? []}
          catalogoCaido={educativos.isError}
        />
        {/*
          ⚠️ Si el catálogo de niveles no llega, «Idiomas» queda **inservible**:
          el nivel es obligatorio en el backend y el selector se quedaría sin
          opciones que ofrecer. Antes se tragaba el fallo con un `?? []` y cada
          intento rebotaba con un 400 sin explicar por qué.
        */}
        <Idiomas
          filas={perfil.idiomas}
          niveles={idiomas.data ?? []}
          catalogoCaido={idiomas.isError}
        />
        <Certificaciones filas={perfil.certificaciones} />
        <Enlaces filas={perfil.enlaces} />
      </div>

      <div className={estilos.pie}>
        <button className={estilos.descargar} type="button" onClick={() => void descargar()}>
          Descargar todos mis datos
        </button>
        <Link to={rutas.privacidad()}>Privacidad y tratamiento de datos</Link>
      </div>
    </div>
  )
}

/**
 * En qué punto está la lectura del último currículum.
 *
 * ⚠️ **`NO_LEGIBLE` no es un error y no se pinta como tal.** Da igual si el PDF
 * estaba escaneado, si la lectura se agotó en reintentos o si nadie llegó a
 * pedirla: de ese archivo no salió nada, el perfil se quedó como estaba, y lo
 * que toca ofrecer en los tres casos es lo mismo — llenarlo a mano. El sistema
 * prefirió no leer nada antes que inventarse datos.
 */
function EstadoDeLaLectura({ perfil }: { perfil: PerfilCompleto }) {
  const { estado } = perfil.lecturaCv

  // Cuando ya está lista y no queda nada sin confirmar, no hay nada que decir:
  // un panel que anuncia que todo está bien es ruido en cada visita.
  if (estado === 'LISTA') return null

  const textos: Record<string, { titulo: string; texto: string }> = {
    SIN_CV: {
      titulo: 'Todavía no hemos leído ningún currículum tuyo',
      texto:
        'Cuando postules a una vacante subirás tu currículum, y de ahí sacaremos lo que podamos para ahorrarte escribirlo. Mientras tanto puedes llenar tu perfil a mano.',
    },
    EN_CURSO: {
      titulo: 'Estamos leyendo tu currículum',
      texto:
        'Tarda menos de un minuto. Puedes seguir llenando lo que quieras: lo que escribas tú no se pisa nunca.',
    },
    NO_LEGIBLE: {
      titulo: 'De tu currículum no pudimos sacar nada',
      texto:
        'Suele pasar cuando el archivo es una foto o un PDF escaneado. No se perdió nada de lo que ya tenías, y puedes llenar tu perfil a mano aquí abajo.',
    },
  }

  const contenido = textos[estado]
  if (!contenido) return null

  const enCurso = estado === 'EN_CURSO'

  return (
    <section
      className={`${estilos.lectura} ${enCurso ? estilos.trabajando : ''}`}
      aria-live="polite"
      aria-busy={enCurso ? true : undefined}
    >
      <h2 className={estilos.lecturaTitulo}>
        {/*
          Sin esto, «Estamos leyendo tu currículum» se veía exactamente igual
          que «Todavía no hemos leído ninguno»: mismo panel, misma tipografía y
          ninguna señal de que algo estuviera pasando, en un texto que promete
          que tarda menos de un minuto.
        */}
        {enCurso && <span className={estilos.latido} aria-hidden="true" />}
        {contenido.titulo}
      </h2>
      <p className={estilos.lecturaTexto}>{contenido.texto}</p>
    </section>
  )
}

// ---------- La cabecera del perfil ----------

interface CamposCabecera {
  titular: string
  resumen: string
  habilidades: string
  experienciaMeses: string
  ubicacion: string
  disponibilidad: string
  pretensionMin: string
  pretensionMax: string
  moneda: string
}

function sembrar(perfil: PerfilCompleto): CamposCabecera {
  return {
    titular: perfil.titular ?? '',
    resumen: perfil.resumen ?? '',
    habilidades: (perfil.habilidades ?? []).join(', '),
    experienciaMeses: perfil.experienciaMeses === null ? '' : String(perfil.experienciaMeses),
    ubicacion: perfil.ubicacion ?? '',
    disponibilidad: perfil.disponibilidad ?? '',
    pretensionMin: perfil.pretension ? String(perfil.pretension.min) : '',
    pretensionMax: perfil.pretension ? String(perfil.pretension.max) : '',
    moneda: perfil.pretension?.moneda ?? 'PEN',
  }
}

function Cabecera({ perfil }: { perfil: PerfilCompleto }) {
  const cache = useQueryClient()
  const avisar = useAviso()
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState<CamposCabecera>(() => sembrar(perfil))
  const [fallo, setFallo] = useState<string | null>(null)
  const [errores, setErrores] = useState<Partial<Record<keyof CamposCabecera, string>>>({})

  // Si el perfil se refresca solo —el sondeo de la lectura del CV— y no se está
  // editando, el formulario se resiembra. Mientras se edita NO se toca: pisar lo
  // que alguien está escribiendo es peor que enseñar un dato viejo.
  useEffect(() => {
    if (!editando) setValores(sembrar(perfil))
  }, [perfil, editando])

  const guardado = useMutation({
    mutationFn: guardarCabecera,
    onSuccess: async () => {
      setEditando(false)
      setFallo(null)
      await cache.invalidateQueries({ queryKey: ['perfil'] })
      // Se dice guardado DESPUES de que el servidor lo confirme, nunca antes.
      avisar('Perfil actualizado.')
    },
    onError: (causa) =>
      setFallo(causa instanceof Error ? causa.message : 'No pudimos guardar tu perfil.'),
  })

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)

    const nuevos: Partial<Record<keyof CamposCabecera, string>> = {}

    const meses = valores.experienciaMeses.trim()
    if (meses !== '') {
      const n = Number(meses)
      if (!Number.isInteger(n) || n < 0 || n > 720) {
        nuevos.experienciaMeses = 'Ponlo en meses, entre 0 y 720 (sesenta años).'
      }
    }

    // La pretensión es TODO O NADA: o van los tres campos o no va ninguno. Un
    // mínimo suelto sin moneda da 400, así que se para antes de salir.
    const min = valores.pretensionMin.trim()
    const max = valores.pretensionMax.trim()
    const hayAlguno = min !== '' || max !== ''
    if (hayAlguno) {
      if (min === '') nuevos.pretensionMin = 'Pon también el mínimo, o borra los dos.'
      if (max === '') nuevos.pretensionMax = 'Pon también el máximo, o borra los dos.'
      if (min !== '' && max !== '' && Number(min) > Number(max)) {
        nuevos.pretensionMax = 'El máximo no puede ser menor que el mínimo.'
      }
      // La columna es `numeric(12,2)`: once dígitos enteros la desbordan y
      // Postgres devuelve un 500 opaco en vez de un 400 que se pueda enseñar.
      for (const [campo, valor] of [
        ['pretensionMin', min],
        ['pretensionMax', max],
      ] as const) {
        if (valor !== '' && Number(valor) > TOPE_PRETENSION) {
          nuevos[campo] = 'Ese número es demasiado grande. Revísalo.'
        }
      }
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }
    setErrores({})

    // El objeto va COMPLETO. Ver la cabecera del archivo: esto es un PUT.
    guardado.mutate({
      titular: valores.titular.trim() || null,
      resumen: valores.resumen.trim() || null,
      habilidades: valores.habilidades
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h !== ''),
      experienciaMeses: meses === '' ? null : Number(meses),
      ubicacion: valores.ubicacion.trim() || null,
      disponibilidad: valores.disponibilidad.trim() || null,
      pretension:
        hayAlguno && min !== '' && max !== ''
          ? { min: Number(min), max: Number(max), moneda: valores.moneda }
          : null,
    })
  }

  function cambiar<C extends keyof CamposCabecera>(campo: C, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const vacia =
    !perfil.titular &&
    !perfil.resumen &&
    (perfil.habilidades ?? []).length === 0 &&
    perfil.experienciaMeses === null &&
    !perfil.ubicacion &&
    !perfil.disponibilidad &&
    !perfil.pretension

  if (!editando) {
    return (
      <section className={estilos.seccion}>
        <div className={estilos.tituloSeccion}>
          <h2>Quién eres</h2>
        </div>
        <p className={estilos.explicacion}>
          Lo primero que lee el equipo cuando abre tu candidatura.
        </p>

        {vacia ? (
          <p className={estilos.ninguna}>Todavía no has escrito nada aquí.</p>
        ) : (
          <ul className={estilos.filas} role="list">
            <li className={estilos.fila}>
              {perfil.titular && (
                <div className={estilos.cabeceraFila}>
                  <span className={estilos.queEs}>{perfil.titular}</span>
                  {perfil.ubicacion && <span className={estilos.donde}>{perfil.ubicacion}</span>}
                </div>
              )}
              {perfil.resumen && <p className={estilos.detalleFila}>{perfil.resumen}</p>}
              {/*
                Las aptitudes van en píldoras y las condiciones en una línea de
                pie: separadas por el mismo `·` y al mismo tamaño se leían como
                una sola lista envuelta en dos renglones, y son dos cosas.
              */}
              {(perfil.habilidades ?? []).length > 0 && (
                <ul className={estilos.habilidades} role="list">
                  {perfil.habilidades.map((h) => (
                    <li className={estilos.habilidad} key={h}>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              <p className={estilos.cuando}>
                {perfil.experienciaMeses !== null && `${aniosYMeses(perfil.experienciaMeses)}`}
                {perfil.experienciaMeses !== null && perfil.disponibilidad && ' · '}
                {perfil.disponibilidad}
                {perfil.pretension && (perfil.experienciaMeses !== null || perfil.disponibilidad)
                  ? ' · '
                  : ''}
                {perfil.pretension &&
                  `${perfil.pretension.moneda} ${perfil.pretension.min}–${perfil.pretension.max}`}
              </p>
            </li>
          </ul>
        )}

        {/*
          Nombra lo que edita, y no «Editar» a secas: la pantalla tiene un
          «Editar» por cada fila de cada lista, y en la lista de botones de un
          lector de pantalla todos serian la misma entrada.
        */}
        <button className={estilos.anadir} type="button" onClick={() => setEditando(true)}>
          {vacia ? 'Escribir quién eres' : 'Editar quién eres'}
        </button>
      </section>
    )
  }

  return (
    <section className={estilos.seccion}>
      <div className={estilos.tituloSeccion}>
        <h2>Quién eres</h2>
      </div>
      <p className={estilos.explicacion}>
        Lo primero que lee el equipo cuando abre tu candidatura.
      </p>

      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        <Campo
          etiqueta="Titular"
          ayuda="Una línea que diga a qué te dedicas. Por ejemplo: «Analista de procesos»."
          maxLength={200}
          value={valores.titular}
          onChange={(e) => cambiar('titular', e.target.value)}
        />

        <AreaTexto
          etiqueta="En pocas palabras"
          ayuda="Qué sabes hacer y qué buscas. Dos o tres frases bastan."
          maximo={2000}
          value={valores.resumen}
          onChange={(e) => cambiar('resumen', e.target.value)}
        />

        <Campo
          etiqueta="Lo que sabes hacer"
          ayuda="Sepáralas con comas. Por ejemplo: Excel avanzado, Power BI, gestión de procesos."
          value={valores.habilidades}
          onChange={(e) => cambiar('habilidades', e.target.value)}
        />

        <div className={estilos.pareja}>
          <Campo
            etiqueta="Experiencia, en meses"
            ayuda="Ocho años son 96 meses."
            type="number"
            min={0}
            max={720}
            value={valores.experienciaMeses}
            onChange={(e) => cambiar('experienciaMeses', e.target.value)}
            error={errores.experienciaMeses}
          />
          <Campo
            etiqueta="Dónde estás"
            maxLength={200}
            value={valores.ubicacion}
            onChange={(e) => cambiar('ubicacion', e.target.value)}
          />
        </div>

        <Campo
          etiqueta="Desde cuándo puedes empezar"
          ayuda="Por ejemplo: «Inmediata» o «A partir de octubre»."
          maxLength={200}
          value={valores.disponibilidad}
          onChange={(e) => cambiar('disponibilidad', e.target.value)}
        />

        {/*
          `fieldset` + `legend` y no un `span`: son dos campos que solo
          significan algo juntos, y sin el grupo un lector de pantalla anuncia
          «Desde» y «Hasta» sueltos — en una pantalla donde hay otros cuatro
          «Desde»/«Hasta» que son fechas.
        */}
        <fieldset className={estilos.grupo}>
          <legend className={estilos.etiqueta}>Lo que esperas ganar</legend>
          <p className={estilos.ayuda}>
            Opcional, y solo lo ve quien negocia — nunca aparece junto a tus notas. Van los dos
            números o ninguno.
          </p>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Desde"
              type="number"
              min={0}
              value={valores.pretensionMin}
              onChange={(e) => cambiar('pretensionMin', e.target.value)}
              error={errores.pretensionMin}
            />
            <Campo
              etiqueta="Hasta"
              type="number"
              min={0}
              value={valores.pretensionMax}
              onChange={(e) => cambiar('pretensionMax', e.target.value)}
              error={errores.pretensionMax}
            />
          </div>
          <div className={estilos.campoSuelto}>
            <label className={estilos.etiqueta} htmlFor="moneda">
              Moneda
            </label>
            <select
              className={estilos.seleccion}
              id="moneda"
              value={valores.moneda}
              onChange={(e) => cambiar('moneda', e.target.value)}
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
        </fieldset>

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}

        <div className={estilos.pieFormulario}>
          <button className={estilos.guardar} type="submit" disabled={guardado.isPending}>
            {guardado.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            className={estilos.cancelar}
            type="button"
            onClick={() => {
              setValores(sembrar(perfil))
              setErrores({})
              setFallo(null)
              setEditando(false)
            }}
            disabled={guardado.isPending}
          >
            Dejarlo
          </button>
        </div>
      </form>
    </section>
  )
}

/** 96 meses son ocho años, y así es como lo dice una persona. */
function aniosYMeses(meses: number): string {
  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  if (anios === 0) return resto === 1 ? '1 mes de experiencia' : `${resto} meses de experiencia`
  const parteAnios = anios === 1 ? '1 año' : `${anios} años`
  if (resto === 0) return `${parteAnios} de experiencia`
  return `${parteAnios} y ${resto === 1 ? '1 mes' : `${resto} meses`} de experiencia`
}
