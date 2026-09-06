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
 * **El currículum vive en el perfil desde el 05/09/2026.** Se sube en la columna
 * lateral, se lee al subirlo —sin esperar a que la persona postule— y al postular
 * se reutiliza. Esta pantalla enseña en qué punto está esa lectura y ofrece
 * cambiarlo o quitarlo.
 *
 * ⚠️ **La cabecera es un PUT que reemplaza los siete campos de golpe.** Se
 * siembra del GET y se manda entera. Guardar campo a campo borraría los seis que
 * no van en la petición — es la misma forma del fallo que ya costó respuestas
 * perdidas en la evaluación.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  descargarMisDatos,
  guardarCabecera,
  nivelesEducativos,
  nivelesIdioma,
  verPerfil,
} from '@/api/perfil'
import type { PerfilCompleto } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { AreaTexto, Campo } from '@/ui/campos/Campo'
import { anclaDe, Enlaces, Idiomas } from './Listas'
import { Trayectoria } from './Trayectoria'
import { Aptitudes, leerTodas } from './Aptitudes'
import { CabeceraDelPerfil } from './Cabecera'
import { Lateral } from './Lateral'
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

/**
 * Cerrar sesión.
 *
 * Vive en «Mi cuenta», que es donde se va a buscar. Antes estaba al final de
 * «Privacidad y tratamiento de datos», detrás de retirar una postulación, salir
 * del radar de talento y pedir el borrado: tres acciones que no se deshacen y
 * que no tienen nada que ver con salir de la sesión en un ordenador prestado.
 *
 * ⚠️ **Después de salir se va a las vacantes, y es a propósito.** `salir()` solo
 * borra el token, y `Privada` no desvía: deja la dirección donde está y cambia
 * la pantalla por el muro de «Ingresa para ver tu proceso». Quedarse ahí, en
 * `/perfil`, después de haber pulsado un botón, se lee como que algo se rompió.
 * La portada es pública y confirma la salida sin decir nada.
 *
 * No pregunta antes: no se pierde nada, y volver a entrar es escribir la
 * contraseña. Confirmar lo que se deshace solo gasta el aviso que sí importa.
 */
function SalirDeLaCuenta() {
  const { salir } = useSesion()
  const navegar = useNavigate()

  return (
    <button
      type="button"
      className={estilos.salir}
      onClick={() => {
        salir()
        navegar(rutas.vacantes())
      }}
    >
      Cerrar sesión
    </button>
  )
}

export function Perfil() {
  const avisar = useAviso()
  // Vive aquí y no dentro de `Cabecera` porque quien abre el formulario es el
  // botón «Editar perfil» de la cabecera de identidad, que es otro componente.
  const [editandoCabecera, setEditandoCabecera] = useState(false)

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
          {/*
            Salir también vive aquí, y no es duplicar por duplicar: si el perfil
            no carga, esta es la pantalla entera de «Mi cuenta». Sin el botón,
            cerrar sesión volvería a estar escondido justo el día que algo falla.
          */}
          <div className={estilos.accionesDelFallo}>
            <button
              type="button"
              className={estilos.reintentar}
              onClick={() => void consulta.refetch()}
            >
              Intentar de nuevo
            </button>
            <SalirDeLaCuenta />
          </div>
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

      <CabeceraDelPerfil perfil={perfil} onEditar={() => setEditandoCabecera(true)} />

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

      {/*
        Dos columnas: lo que se lee a la izquierda, lo que acompaña a la derecha.
        Por debajo de 900 px se apilan y la lateral sube — el aviso de «te toca a
        ti» no puede quedar al final del todo en un teléfono.
      */}
      <div className={estilos.cuerpo}>
        <div className={estilos.principal}>
        <Cabecera
          perfil={perfil}
          editando={editandoCabecera}
          setEditando={setEditandoCabecera}
        />
        {/*
          ⚠️ **Una sola cronología, no tres listas.** Empleos, estudios y
          certificaciones comparten el mismo raíl ordenado por fecha: es la
          estructura que el usuario fijó el 06/09/2026. Ver `Trayectoria.tsx`.
        */}
        <Trayectoria
          experiencia={perfil.experiencia}
          educacion={perfil.educacion}
          certificaciones={perfil.certificaciones}
          niveles={educativos.data ?? []}
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
        <Enlaces filas={perfil.enlaces} />
        </div>

        <Lateral perfil={perfil} />
      </div>

      {/*
        ⚠️ **Cerrar sesión baja al pie, pero no se esconde.** Estaba en la primera
        línea, al lado del titular, y ahí competía con el nombre por la mirada en
        una cabecera que ahora es la identidad de la persona. Aquí abajo sigue
        estando en la pantalla, a un clic desde la barra de arriba —«Mi cuenta»
        lleva aquí— y sigue apareciendo también en la pantalla de fallo, que es
        donde de verdad haría falta el día que algo se rompa.
      */}
      <div className={estilos.pie}>
        <button className={estilos.descargar} type="button" onClick={() => void descargar()}>
          Descargar todos mis datos
        </button>
        <Link to={rutas.privacidad()}>Privacidad y tratamiento de datos</Link>
        <SalirDeLaCuenta />
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
      // ⚠️ Este texto decía «cuando postules subirás tu currículum», y desde que
      // se puede guardar aquí eso era mentira: mandaba a postular a alguien que
      // tenía el botón de subirlo a la derecha de la misma pantalla.
      titulo: 'Todavía no hemos leído ningún currículum tuyo',
      texto:
        'Súbelo en «Tu currículum» y sacaremos lo que podamos para ahorrarte escribirlo. También puedes llenar tu perfil a mano, o dejarlo para cuando postules.',
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
    experienciaMeses: perfil.experienciaMeses === null ? '' : String(perfil.experienciaMeses),
    ubicacion: perfil.ubicacion ?? '',
    disponibilidad: perfil.disponibilidad ?? '',
    pretensionMin: perfil.pretension ? String(perfil.pretension.min) : '',
    pretensionMax: perfil.pretension ? String(perfil.pretension.max) : '',
    moneda: perfil.pretension?.moneda ?? 'PEN',
  }
}

function Cabecera({
  perfil,
  editando,
  setEditando,
}: {
  perfil: PerfilCompleto
  editando: boolean
  setEditando: (abierto: boolean) => void
}) {
  const cache = useQueryClient()
  const avisar = useAviso()
  const suSitio = useRef<HTMLElement>(null)
  const [valores, setValores] = useState<CamposCabecera>(() => sembrar(perfil))
  // Las aptitudes salen del texto separado por «|» y vuelven a él al guardar. El
  // `pendiente` vive aquí y no dentro del campo para que Guardar pueda recoger lo
  // que quedó escrito sin pulsar Enter.
  const [aptitudes, setAptitudes] = useState<string[]>(() => perfil.habilidades ?? [])
  const [aptitudPendiente, setAptitudPendiente] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
  const [errores, setErrores] = useState<Partial<Record<keyof CamposCabecera, string>>>({})

  // Si el perfil se refresca solo —el sondeo de la lectura del CV— y no se está
  // editando, el formulario se resiembra. Mientras se edita NO se toca: pisar lo
  // que alguien está escribiendo es peor que enseñar un dato viejo.
  useEffect(() => {
    if (!editando) {
      setValores(sembrar(perfil))
      setAptitudes(perfil.habilidades ?? [])
      setAptitudPendiente('')
    }
  }, [perfil, editando])

  // El botón que abre esto vive arriba del todo, en la cabecera de identidad, y
  // el formulario aparece más abajo: sin traer la vista, pulsar «Editar perfil»
  // no parecía hacer nada.
  useEffect(() => {
    if (editando) suSitio.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editando])

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
      // ⚠️ Se guarda el formulario ANTES del fotograma siguiente: React limpia
      // `currentTarget` en cuanto el manejador termina, y dentro del
      // `requestAnimationFrame` ya es null.
      const formulario = evento.currentTarget
      requestAnimationFrame(() => {
        // Dentro de ESTE formulario. Buscando en todo el documento, con otro
        // formulario abierto y con error más arriba, el foco saltaba al campo
        // equivocado de una sección que no se estaba enviando.
        formulario.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }
    setErrores({})

    // El objeto va COMPLETO. Ver la cabecera del archivo: esto es un PUT.
    guardado.mutate({
      titular: valores.titular.trim() || null,
      resumen: valores.resumen.trim() || null,
      // `leerTodas` recoge lo que quedó escrito sin pulsar Enter: quien escribe
      // «Power BI» y le da a Guardar espera que se guarde, no que se pierda.
      habilidades: leerTodas(aptitudes, aptitudPendiente),
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
      /* ⚠️ El ancla va en las DOS ramas. Estaba solo en la de edición, así que
         en el estado normal —el que se ve— `#seccion-acerca-de-ti` no existía:
         la primera entrada del índice era un enlace muerto y el observador
         nunca podía marcarla. Solo se pinta una rama a la vez, así que el id
         no se duplica. */
      <section className={estilos.seccion} id={anclaDe('Acerca de ti')} ref={suSitio}>
        <div className={estilos.tituloSeccion}>
          <h2>Acerca de ti</h2>
        </div>

        {/*
          ⚠️ El titular, la ubicación y los años ya NO se pintan aquí: viven en la
          cabecera de identidad, arriba. Repetirlos hacía que la misma frase
          apareciera dos veces en la misma pantalla, y la segunda parecía otro
          dato distinto que no cuadraba.

          Lo que se queda es lo que la cabecera no puede llevar: el texto largo,
          las aptitudes y la pretensión.
        */}
        {vacia ? (
          <p className={estilos.ninguna}>
            Cuéntale al equipo qué sabes hacer y qué buscas. Dos o tres frases bastan.
          </p>
        ) : (
          <div className={estilos.acercaDe}>
            {perfil.resumen && <p className={estilos.resumen}>{perfil.resumen}</p>}

            {(perfil.habilidades ?? []).length > 0 && (
              <>
                <h3 className={estilos.subtitulo}>Lo que sabes hacer</h3>
                <ul className={estilos.habilidades} role="list">
                  {perfil.habilidades.map((h) => (
                    <li className={estilos.habilidad} key={h}>
                      {h}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/*
              La pretensión, apartada y con su aviso. Es el único dato del perfil
              que no ve todo el equipo, y quien lo escribe merece saberlo antes de
              escribirlo, no después.
            */}
            {perfil.pretension && (
              <p className={estilos.pretension}>
                <span className={estilos.etiquetaPretension}>Pretensión</span>
                {perfil.pretension.moneda} {perfil.pretension.min}–{perfil.pretension.max}
                <span className={estilos.notaPretension}>
                  Solo la ve quien tiene permiso, y nunca sale en las listas.
                </span>
              </p>
            )}
          </div>
        )}

        {/*
          Nombra lo que edita, y no «Editar» a secas: la pantalla tiene un
          «Editar» por cada fila de cada lista, y en la lista de botones de un
          lector de pantalla todos serian la misma entrada.
        */}
        <button className={estilos.anadir} type="button" onClick={() => setEditando(true)}>
          {vacia ? 'Escribir sobre ti' : 'Editar lo tuyo'}
        </button>
      </section>
    )
  }

  return (
    <section className={estilos.seccion} id={anclaDe('Acerca de ti')} ref={suSitio}>
      <div className={estilos.tituloSeccion}>
        <h2>Acerca de ti</h2>
      </div>
      <p className={estilos.explicacion}>
        Esto es lo primero que lee el equipo cuando abre tu candidatura. Lo de aquí arriba —tu
        titular, dónde estás— también se edita en este formulario.
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

        <Aptitudes
          etiquetas={aptitudes}
          onCambiar={setAptitudes}
          pendiente={aptitudPendiente}
          onPendiente={setAptitudPendiente}
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

