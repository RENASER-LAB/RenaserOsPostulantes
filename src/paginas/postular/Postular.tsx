/**
 * Postular.
 *
 * **Aquí vive el único descarte automático de todo el sistema.** El backend
 * comprueba los requisitos indispensables que el candidato confirma, y cualquiera
 * activo sin confirmar cierra la postulación en el acto, con la regla exacta
 * escrita en su historial. No hay vuelta atrás ni segunda oportunidad en esa
 * vacante.
 *
 * De ahí salen las tres decisiones de esta pantalla:
 *
 *   - **Los requisitos son preguntas de sí o no, no casillas.** Una casilla se
 *     marca sin leer; una pregunta hay que contestarla. Y no se puede enviar
 *     dejando alguna sin responder.
 *   - **Responder «no» no bloquea el envío: lo explica.** Impedirlo sería
 *     decidir por él. Lo que hace la pantalla es decir en voz alta lo que va a
 *     pasar y dejar que elija con esa información.
 *   - **El currículum se valida antes de salir** —formato y tamaño— porque un
 *     rebote del servidor después de subir 10 MB es la peor forma de enterarse.
 *
 * ⚠️ **Aqui habia una casilla de consentimiento y se retiro.** Enviar tu
 * candidatura a una empresa que TU elegiste, despues de que la pantalla te diga
 * quien la recibe, ya es el acto afirmativo que la ley 29733 pide: una casilla
 * encima no añade voluntad, añade friccion. Es lo que hacen las bolsas de empleo
 * —el permiso se da al crear la cuenta y postular es el acto—, y aqui el
 * candidato ya venia de marcar dos casillas en el registro.
 *
 * **Lo que NO se retiro es la constancia.** Al enviar se sigue guardando la
 * firma a nombre de ESA empresa, con el texto que se le enseño, la fecha y la
 * IP: cada empresa es responsable de su propio proceso y su consentimiento
 * tiene que estar a su nombre. Lo que cambio es como se da, no que se dé.
 *
 * ⚠️ **Es la unica pieza del rediseño que necesita el visto bueno del abogado**:
 * pasa de «consentimiento expreso por casilla» a «consentimiento por acto
 * inequivoco». Las dos se defienden y no son lo mismo.
 */

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verPerfil } from '@/api/perfil'
import { postular, verVacante } from '@/api/portal'
import type { Pretension, RequisitoPublico } from '@/api/tipos'
import { COMO_SE_ESCRIBE, aCifra } from '@/dominio/dinero'
import { rutas } from '@/rutas'
import { AreaTexto, Campo } from '@/ui/campos/Campo'
import { Remuneracion } from '@/ui/Remuneracion'
import estilos from './Postular.module.css'

/**
 * El centro de la banda del perfil, que es lo que se le propone.
 *
 * Mismo criterio que el backend (`Remuneracion.sugerirDesdeElPerfil`): con la
 * banda entera, el punto medio redondeado; con media banda, lo que haya; sin
 * nada, nada — y entonces el campo sale vacio, que es el caso de casi todo el
 * mundo.
 */
function sugerirDelPerfil(p: Pretension | null | undefined): number | undefined {
  if (!p) return undefined
  const min = typeof p.min === 'number' ? p.min : undefined
  const max = typeof p.max === 'number' ? p.max : undefined
  if (min === undefined && max === undefined) return undefined
  if (min === undefined) return max
  if (max === undefined) return min
  return Math.round((min + max) / 2)
}

/** El mismo tope que aplica el backend: pasarlo devuelve 413. */
const MAXIMO_CV = 10 * 1024 * 1024
const FORMATOS = ['.pdf', '.doc', '.docx']

type Respuesta = 'si' | 'no'

/**
 * La puerta, y el unico motivo por el que existe: la `key`.
 *
 * ⚠️ **React Router NO remonta el elemento cuando solo cambia el parametro de
 * la ruta.** `/vacantes/7/postular` y `/vacantes/8/postular` son el mismo
 * `element`, asi que sin esta linea el estado del formulario sobrevivia al
 * cambio de vacante: quien tecleaba 4200 para un puesto en soles, volvia atras y
 * abria otro en dolares se encontraba su 4200 intacto bajo una etiqueta que
 * decia «(USD)» — y `tocoLaPretension` seguia en true, asi que el prellenado del
 * perfil tampoco corregia nada.
 *
 * La `key` con el id de la vacante lo resuelve entero: cada convocatoria estrena
 * formulario, que es lo que cualquiera espera al abrir otra.
 */
export function Postular() {
  const { vacanteId = '' } = useParams()
  return <FormularioDePostular key={vacanteId} vacanteId={vacanteId} />
}

function FormularioDePostular({ vacanteId }: { vacanteId: string }) {
  const navegar = useNavigate()
  const cache = useQueryClient()
  const campoArchivo = useRef<HTMLInputElement>(null)
  const dialogo = useRef<HTMLDialogElement>(null)

  const [cv, setCv] = useState<File | null>(null)
  /**
   * Si sube uno distinto **solo para esta vacante**.
   *
   * ⚠️ Y de verdad es solo para esta: el currículum del perfil no cambia. Es lo
   * que permite mandar una versión a medida sin reescribir lo que la persona
   * decidió dejar guardado.
   */
  const [otroCv, setOtroCv] = useState(false)
  const [encima, setEncima] = useState(false)
  const [resultado, setResultado] = useState('')
  const [portafolio, setPortafolio] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  /**
   * Cuanto quiere ganar aqui.
   *
   * Nace vacio y lo rellena un efecto cuando llega su perfil: ver `sugerido`.
   * Un `useState(calculo)` no serviria — el perfil todavia no ha llegado cuando
   * este componente se monta, y el valor inicial se calcula una sola vez.
   */
  const [pretension, setPretension] = useState('')
  const [tocoLaPretension, setTocoLaPretension] = useState(false)
  const [respuestas, setRespuestas] = useState<Record<number, Respuesta>>({})
  const [errores, setErrores] = useState<{
    cv?: string
    resultado?: string
    requisitos?: string
    pretension?: string
  }>({})
  const [fallo, setFallo] = useState<string | null>(null)

  const vacante = useQuery({
    queryKey: ['vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: vacanteId !== '',
  })

  /*
    Aqui se pedia el texto legal de esta vacante para pintarlo bajo la casilla. La
    casilla se retiro y el texto se lee en `/politica-de-privacidad?vacante=…`, a
    donde lleva el enlace de encima del boton. El nombre de la empresa, que es lo
    unico que esta pantalla necesita, ya viene con la vacante.
  */

  /**
   * El currículum que ya tiene guardado, si lo tiene.
   *
   * Un fallo aquí NO impide postular: se cae al camino de siempre, que es subir
   * el archivo en el momento. Perder una postulación porque no se pudo leer el
   * perfil sería exactamente al revés de para qué está el perfil.
   */
  const perfil = useQuery({ queryKey: ['perfil'], queryFn: verPerfil })
  const elDelPerfil = perfil.data?.cv ?? null

  /**
   * Lo que se le propone, sacado de la banda de su perfil.
   *
   * **El centro de la banda, no el borde bajo.** Quien puso «3000 a 4000» no
   * esta diciendo que quiera 3000: esta diciendo que su expectativa vive ahi
   * dentro. Prellenar con el minimo le regalaria a la empresa el borde bajo de
   * su propia expectativa cada vez que alguien pulsa enviar sin mirar.
   *
   * `undefined` si no tiene nada guardado, que es el caso de casi todo el
   * mundo: entonces el campo sale vacio y lo escribe el.
   */
  const sugerido = sugerirDelPerfil(perfil.data?.pretension)

  /*
    Se rellena UNA vez, cuando llega el perfil, y nunca vuelve a pisarlo.

    `tocoLaPretension` es lo que lo garantiza: sin esa bandera, una revalidacion
    de react-query —cambiar de pestaña y volver— reescribiria encima del numero
    que la persona acaba de teclear. Es el mismo fallo que el CV tuvo y que
    arreglo esperar al perfil antes de pintar.
  */
  useEffect(() => {
    if (!tocoLaPretension && pretension === '' && sugerido !== undefined) {
      setPretension(String(sugerido))
    }
  }, [sugerido, tocoLaPretension, pretension])

  const envio = useMutation({
    mutationFn: postular,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      navegar(rutas.procesos())
    },
    onError: (causa) =>
      setFallo(
        causa instanceof Error
          ? causa.message
          : 'No pudimos enviar tu postulación. Vuelve a intentarlo.',
      ),
  })

  /*
    ⚠️ **También se espera al perfil, no solo a la vacante.** Mientras su
    consulta estaba pendiente, `elDelPerfil` era null y la pantalla pintaba la
    zona de arrastrar; al llegar la respuesta saltaba a «Es el que tienes
    guardado en tu perfil». Con conexión lenta daba tiempo a empezar a arrastrar
    un archivo y que la interfaz cambiara debajo.
  */
  if (vacante.isPending || perfil.isPending) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.marco} aria-busy="true">
          <h1>Cargando el puesto…</h1>
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
          <div className={`${estilos.barra} ${estilos.barraCorta}`} />
        </div>
      </div>
    )
  }

  if (vacante.isError) {
    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.vacantes()}>
          ← Volver a las vacantes
        </Link>
        <div className={estilos.marco}>
          <h1>No pudimos cargar este puesto.</h1>
          <p className={estilos.marcoTexto}>
            {vacante.error instanceof Error
              ? vacante.error.message
              : 'No pudimos conectar con el servidor.'}
          </p>
          <button
            type="button"
            className={estilos.reintentar}
            onClick={() => void vacante.refetch()}
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const v = vacante.data
  const requisitos: RequisitoPublico[] = Array.isArray(v.requisitosObjetivos)
    ? v.requisitosObjetivos
    : []
  /**
   * El trato: si la empresa publica lo que paga, el tiene que decir lo suyo.
   *
   * Y si no lo publica, no se le pide **ni como opcional**: aceptarle un numero
   * mientras la empresa esconde el suyo es justo el desequilibrio que esto vino
   * a romper. El campo no sale en absoluto.
   */
  const exigePretension = v.remuneracion?.tipo !== undefined
    && v.remuneracion.tipo !== 'OCULTA'

  const sinResponder = requisitos.filter((r) => respuestas[r.id] === undefined)
  const noCumple = requisitos.filter((r) => respuestas[r.id] === 'no')

  // Los dos endpoints traen el nombre de la empresa. Se prefiere el del texto
  // legal porque es el que quedara firmado; el de la vacante es el respaldo, y
  // «la empresa» solo si ninguno llego — la frase tiene que seguir teniendo
  // sentido aunque falte el dato.
  const quienTrata = v.nombreEmpresa ?? 'la empresa'

  function elegirArchivo(archivo: File | undefined) {
    setErrores((e) => ({ ...e, cv: undefined }))
    if (!archivo) return

    const extension = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase()
    if (!FORMATOS.includes(extension)) {
      setErrores((e) => ({
        ...e,
        cv: `«${archivo.name}» no es un PDF ni un Word. Convierte tu currículum a PDF y vuelve a intentarlo.`,
      }))
      return
    }
    if (archivo.size > MAXIMO_CV) {
      setErrores((e) => ({
        ...e,
        cv: `Tu archivo pesa ${pesoLegible(archivo.size)} y el máximo son 10 MB. Guárdalo como PDF comprimido o quita las imágenes más pesadas.`,
      }))
      return
    }
    setCv(archivo)
  }

  function soltar(evento: DragEvent) {
    evento.preventDefault()
    setEncima(false)
    elegirArchivo(evento.dataTransfer.files[0])
  }

  /** Lo que falta por rellenar. Vacío significa que se puede enviar. */
  function revisar() {
    const nuevos: typeof errores = {}
    // Sin currículum guardado y sin adjuntar uno no hay postulación. Con uno
    // guardado, no adjuntar nada es lo normal: se usa el suyo.
    if (!cv && (otroCv || !elDelPerfil)) {
      nuevos.cv = 'Adjunta tu currículum para continuar.'
    }
    if (!resultado.trim()) {
      nuevos.resultado = 'Cuéntanos un resultado del que te sientas orgulloso.'
    }
    if (exigePretension) {
      // `aCifra` y no `Number`: `Number('3,500')` vale 3.5, y pasaria las tres
      // comprobaciones de abajo dejando registrado que pide S/ 3.50. Ver
      // `dominio/dinero`.
      const numero = aCifra(pretension)
      if (pretension.trim() === '') {
        nuevos.pretension = 'Dinos cuánto quieres ganar: la empresa ya dijo lo suyo.'
      } else if (numero === null || numero <= 0) {
        nuevos.pretension = COMO_SE_ESCRIBE
      } else if (numero > 1_000_000) {
        // El mismo techo que aplica el backend. Que salte aqui evita que descubra
        // el dedo de mas despues de haber subido 10 MB de curriculum.
        nuevos.pretension = 'Esa cifra parece un error de tecleo: revísala.'
      }
    }
    if (sinResponder.length > 0) {
      nuevos.requisitos =
        sinResponder.length === 1
          ? 'Falta responder un requisito.'
          : `Faltan ${sinResponder.length} requisitos por responder.`
    }
    return nuevos
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)

    const nuevos = revisar()
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    // Si dijo que no cumple alguno, la postulación se va a cerrar sola. No se
    // le impide enviarla —eso sería decidir por él— pero no puede pasar sin
    // saberlo.
    if (noCumple.length > 0) {
      dialogo.current?.showModal()
      return
    }

    mandar()
  }

  function mandar() {
    dialogo.current?.close()
    envio.mutate({
      vacanteId: v.id,
      // null significa «usa el de mi perfil». Ver `postular` en `api/portal.ts`.
      cv: otroCv || !elDelPerfil ? cv : null,
      resultadoOrgulloso: resultado.trim(),
      portafolio: portafolio.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      requisitosConfirmados: requisitos
        .filter((r) => respuestas[r.id] === 'si')
        .map((r) => r.id),
      /*
        `true` porque el acto ES este: la persona leyo encima del boton quien va a
        recibir su candidatura y lo pulso. No es una constante que se cuela en
        lugar de una decision —esa era la casilla— sino el valor que corresponde
        al unico camino por el que se llega aqui. El backend lo sigue exigiendo
        para cortarle el paso a quien llame a la API a pelo.
      */
      aceptaTratamiento: true,
      // Solo si la vacante lo pide. El backend lo ignoraria igualmente, pero
      // mandarlo escribiria en su registro un numero que nadie le pidio.
      ...(exigePretension
        ? {
            // El `??` no puede saltar: `revisar()` ya cortó el envío si no es
            // una cifra. Está para que el tipo sea `number` y no `number | null`.
            pretensionMonto: aCifra(pretension) ?? 0,
            pretensionMoneda: v.remuneracion.moneda ?? 'PEN',
          }
        : {}),
    })
  }

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.vacante(v.id)}>
        ← Volver al puesto
      </Link>

      <div className={estilos.encabezado}>
        <h1>Postula a este puesto.</h1>
        <span className={estilos.puesto}>
          {v.titulo}
          {v.nombreEmpresa ? ` · ${v.nombreEmpresa}` : ''}
        </span>
      </div>

      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        <section className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>Tu currículum</h2>

          {/*
            ⚠️ **Con currículum guardado, esta pantalla no pide nada.** Es lo que
            hace que la segunda postulación cueste un minuto y no media hora: se
            usa el suyo salvo que diga lo contrario.

            Y si dice lo contrario, se le dice EXPLÍCITAMENTE que su perfil no
            cambia. Sin esa frase, cualquiera supondría que subir otro archivo
            reemplaza el que tiene guardado — que es justo lo que no pasa.
          */}
          {elDelPerfil && !otroCv ? (
            <div className={estilos.delPerfil}>
              <div className={estilos.elegido}>
                <span className={estilos.marcaElegido} aria-hidden="true" />
                <span className={estilos.nombreArchivo}>{elDelPerfil.nombre}</span>
                <span className={estilos.pesoArchivo}>{pesoLegible(elDelPerfil.tamano)}</span>
              </div>
              <p className={estilos.explicacionPerfil}>
                Es el que tienes guardado en tu perfil. Lo mandaremos con esta postulación.
              </p>
              <button
                type="button"
                className={estilos.otroCv}
                onClick={() => setOtroCv(true)}
              >
                Usar otro solo para esta vacante
              </button>
            </div>
          ) : cv ? (
            <div className={estilos.elegido}>
              <span className={estilos.marcaElegido} aria-hidden="true" />
              <span className={estilos.nombreArchivo}>{cv.name}</span>
              <span className={estilos.pesoArchivo}>{pesoLegible(cv.size)}</span>
              <button type="button" className={estilos.quitar} onClick={() => setCv(null)}>
                Cambiar
              </button>
            </div>
          ) : (
            <div
              className={`${estilos.zona}${encima ? ` ${estilos.encima}` : ''}${
                errores.cv ? ` ${estilos.conError}` : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setEncima(true)
              }}
              onDragLeave={() => setEncima(false)}
              onDrop={soltar}
            >
              <span className={estilos.zonaTexto}>
                Arrastra tu currículum aquí
                <span className={estilos.zonaDetalle}>PDF o Word · hasta 10 MB</span>
              </span>
              <button
                type="button"
                className={estilos.elegir}
                onClick={() => campoArchivo.current?.click()}
                aria-invalid={errores.cv ? true : undefined}
                aria-describedby={errores.cv ? 'error-cv' : undefined}
              >
                Buscar en mi equipo
              </button>
            </div>
          )}

          <input
            ref={campoArchivo}
            className={estilos.oculto}
            type="file"
            aria-label="Tu currículum para esta vacante"
            accept={FORMATOS.join(',')}
            tabIndex={-1}
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
          />

          {errores.cv && (
            <p className={estilos.resumenErrores} id="error-cv" role="alert">
              {errores.cv}
            </p>
          )}

          {otroCv && elDelPerfil && (
            <p className={estilos.avisoOtroCv}>
              Este archivo vale <b>solo para esta vacante</b>. El de tu perfil se queda como
              está.{' '}
              <button
                type="button"
                className={estilos.volverAlDelPerfil}
                onClick={() => {
                  setOtroCv(false)
                  setCv(null)
                }}
              >
                Usar el de mi perfil
              </button>
            </p>
          )}

          <p className={estilos.anonimo}>
            Antes de que ningún sistema lo lea, tapamos tu edad, sexo y estado civil.
            Guardamos las dos versiones para poder demostrar que se hizo.
          </p>
        </section>

        <section className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>Un resultado del que te sientas orgulloso</h2>
          <AreaTexto
            etiqueta="Cuéntalo con tus palabras"
            ayuda="Algo que hiciste y salió bien. Qué había antes, qué hiciste tú, y cómo quedó."
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            error={errores.resultado}
          />
        </section>

        {/*
          El bloque del trato, y solo si hay trato.

          Va DESPUES del resultado del que se siente orgulloso y ANTES de los
          enlaces, que es donde encaja: lo del dinero se decide con el puesto
          fresco en la cabeza, no al final, junto al boton, cuando lo unico que
          se quiere es terminar.

          Lo que la empresa ofrece se repite aqui, arriba del campo. Estaba en
          la pantalla anterior y ya no se ve: pedirle su cifra sin recordarle la
          de ellos le obliga a volver atras o a decidir de memoria.
        */}
        {exigePretension && (
          /*
            Sin encabezado, a diferencia de los otros bloques: es un `<div>` y no
            una `<section>` a proposito. Una region sin nombre es ruido en el
            arbol de accesibilidad —se anuncia como «region» y no dice de que—,
            y aqui la etiqueta del campo ya dice lo que se pide.
          */
          <div className={estilos.bloque}>
            <div className={estilos.loQueOfrecen}>
              <Remuneracion remuneracion={v.remuneracion} />
            </div>

            <Campo
              etiqueta={`Tu pretensión mensual (${v.remuneracion.moneda ?? 'PEN'})`}
              ayuda="Una cifra mensual, bruta. Puedes cambiarla en cada vacante."
              type="text"
              inputMode="decimal"
              value={pretension}
              onChange={(e) => {
                setTocoLaPretension(true)
                setPretension(e.target.value)
                setErrores((x) => ({ ...x, pretension: undefined }))
              }}
              error={errores.pretension}
            />
          </div>
        )}

        <section className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>Enlaces</h2>
          <p className={estilos.explicacion}>
            Opcionales. Si tienes algo publicado que muestre cómo trabajas, ayuda.
          </p>
          <div className={estilos.enlaces}>
            <Campo
              etiqueta="Portafolio"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={portafolio}
              onChange={(e) => setPortafolio(e.target.value)}
            />
            <Campo
              etiqueta="LinkedIn"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />
            <Campo
              etiqueta="GitHub u otro"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
            />
          </div>
        </section>

        {requisitos.length > 0 && (
          <section className={estilos.requisitos}>
            <h2>Requisitos indispensables</h2>
            <div className={estilos.listaRequisitos}>
              {requisitos.map((r) => (
                <Requisito
                  key={r.id}
                  requisito={r}
                  respuesta={respuestas[r.id]}
                  invalido={errores.requisitos !== undefined && respuestas[r.id] === undefined}
                  onResponder={(valor) => {
                    setRespuestas((v) => ({ ...v, [r.id]: valor }))
                    setErrores((e) => ({ ...e, requisitos: undefined }))
                  }}
                />
              ))}
            </div>

            {errores.requisitos && (
              <p className={estilos.faltaResponder} role="alert">
                {errores.requisitos}
              </p>
            )}

            {noCumple.length > 0 && (
              <p className={estilos.consecuencia}>
                <span>
                  Dijiste que no cumples {noCumple.length === 1 ? 'uno' : noCumple.length} de
                  los requisitos. Puedes enviar la postulación igual, pero{' '}
                  <b>se cerrará automáticamente</b> y no podrás volver a postular a este
                  puesto. Si crees que te equivocaste al responder, cámbialo antes de enviar.
                </span>
              </p>
            )}
          </section>
        )}

        {/*
          Lo último antes del botón, que es donde la ley espera encontrarlo: se
          informa justo antes de mandar los datos, no al principio del formulario.
        */}
        <p className={estilos.avisoDatos}>
          Al enviar, <b>{quienTrata}</b> —que es quien publica esta vacante y quien
          decide— recibirá tu currículum y tus respuestas, y quedará registrado tu
          permiso para este proceso. Puedes leerlo entero en la{' '}
          <Link
            to={rutas.politica(rutas.anclaDeLosTextos, vacanteId)}
            target="_blank"
            rel="noreferrer"
          >
            política de privacidad
          </Link>
          .
        </p>

        <div className={estilos.envio}>
          {fallo && (
            <p className={estilos.resumenErrores} role="alert">
              {fallo}
            </p>
          )}
          <button type="submit" className={estilos.enviar} disabled={envio.isPending}>
            {envio.isPending ? 'Enviando…' : 'Enviar mi postulación'}
          </button>
        </div>
      </form>

      <dialog ref={dialogo} className={estilos.aviso} aria-labelledby="titulo-aviso">
        <h2 className={estilos.avisoTitulo} id="titulo-aviso">
          Esta postulación se va a cerrar
        </h2>
        <p className={estilos.avisoTexto}>
          Respondiste que no cumples {noCumple.length === 1 ? 'este requisito' : 'estos requisitos'}:
        </p>
        <ul className={estilos.avisoLista} role="list">
          {noCumple.map((r) => (
            <li key={r.id}>{r.descripcion}</li>
          ))}
        </ul>
        <p className={estilos.avisoTexto}>
          Son condición para el puesto, así que al enviarla se cerrará de inmediato y{' '}
          <b>no podrás volver a postular a esta vacante</b>. Tu currículum y tus datos se
          guardan igual.
        </p>
        <div className={estilos.avisoBotones}>
          <button
            type="button"
            className={estilos.volverAtras}
            onClick={() => dialogo.current?.close()}
          >
            Volver y revisar
          </button>
          <button
            type="button"
            className={estilos.enviarIgual}
            onClick={mandar}
            disabled={envio.isPending}
          >
            Enviarla de todos modos
          </button>
        </div>
      </dialog>
    </div>
  )
}

function Requisito({
  requisito,
  respuesta,
  invalido,
  onResponder,
}: {
  requisito: RequisitoPublico
  respuesta: Respuesta | undefined
  invalido: boolean
  onResponder: (valor: Respuesta) => void
}) {
  const nombre = `requisito-${requisito.id}`

  return (
    <fieldset
      className={`${estilos.requisito}${respuesta === 'no' ? ` ${estilos.respondidoNo}` : ''}`}
    >
      <legend className={estilos.textoRequisito}>{requisito.descripcion}</legend>
      <div className={estilos.siNo}>
        {(['si', 'no'] as const).map((valor) => (
          <label
            key={valor}
            className={`${estilos.opcion}${respuesta === valor ? ` ${estilos.elegida}` : ''}`}
          >
            <input
              className={estilos.radio}
              type="radio"
              name={nombre}
              value={valor}
              checked={respuesta === valor}
              onChange={() => onResponder(valor)}
              aria-invalid={invalido ? true : undefined}
            />
            {valor === 'si' ? 'Sí' : 'No'}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function pesoLegible(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
