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
 * ⚠️ **La casilla del tratamiento de datos SÍ bloquea, y no contradice lo de
 * arriba.** Los requisitos son preguntas porque una respuesta equivocada
 * descarta a la persona, y ahí decidir por ella sería peor. El consentimiento es
 * otra cosa: es la ley 29733, el backend responde 400 sin él, y no hay nada que
 * el candidato pueda elegir — o acepta que esa empresa trate sus datos, o no hay
 * postulación. El precedente de la casa es `Registro.tsx`, que ya usa esta misma
 * pieza para el consentimiento obligatorio de la plataforma.
 *
 * Se acepta **por vacante y no una vez en la cuenta** porque quien trata los
 * datos es la empresa de esa vacante, y el tablón mezcla empresas.
 */

import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { consentimientoDeVacante, postular, verVacante } from '@/api/portal'
import type { RequisitoPublico } from '@/api/tipos'
import { rutas } from '@/rutas'
import { AreaTexto, Campo, Consentimiento } from '@/ui/campos/Campo'
import estilos from './Postular.module.css'

/** El mismo tope que aplica el backend: pasarlo devuelve 413. */
const MAXIMO_CV = 10 * 1024 * 1024
const FORMATOS = ['.pdf', '.doc', '.docx']

type Respuesta = 'si' | 'no'

export function Postular() {
  const { vacanteId = '' } = useParams()
  const navegar = useNavigate()
  const cache = useQueryClient()
  const campoArchivo = useRef<HTMLInputElement>(null)
  const dialogo = useRef<HTMLDialogElement>(null)

  const [cv, setCv] = useState<File | null>(null)
  const [encima, setEncima] = useState(false)
  const [resultado, setResultado] = useState('')
  const [portafolio, setPortafolio] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  const [respuestas, setRespuestas] = useState<Record<number, Respuesta>>({})
  const [acepta, setAcepta] = useState(false)
  const [errores, setErrores] = useState<{
    cv?: string
    resultado?: string
    requisitos?: string
    acepta?: string
  }>({})
  const [fallo, setFallo] = useState<string | null>(null)

  const vacante = useQuery({
    queryKey: ['vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: vacanteId !== '',
  })

  // El texto legal de la empresa de esta vacante. Si no llega, la casilla sigue
  // saliendo y sigue bloqueando: lo que se pierde es poder leer el texto, no el
  // consentimiento. Al reves —dejar postular porque el texto no cargo— seria
  // firmar algo que nadie enseño.
  const consentimiento = useQuery({
    queryKey: ['consentimiento-vacante', vacanteId],
    queryFn: () => consentimientoDeVacante(vacanteId),
    enabled: vacanteId !== '',
  })

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

  if (vacante.isPending) {
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
  const sinResponder = requisitos.filter((r) => respuestas[r.id] === undefined)
  const noCumple = requisitos.filter((r) => respuestas[r.id] === 'no')

  // Los dos endpoints traen el nombre de la empresa. Se prefiere el del texto
  // legal porque es el que quedara firmado; el de la vacante es el respaldo, y
  // «la empresa» solo si ninguno llego — la frase tiene que seguir teniendo
  // sentido aunque falte el dato.
  const quienTrata = consentimiento.data?.nombreEmpresa ?? v.nombreEmpresa ?? 'la empresa'

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
    if (!cv) nuevos.cv = 'Adjunta tu currículum para continuar.'
    if (!resultado.trim()) {
      nuevos.resultado = 'Cuéntanos un resultado del que te sientas orgulloso.'
    }
    if (sinResponder.length > 0) {
      nuevos.requisitos =
        sinResponder.length === 1
          ? 'Falta responder un requisito.'
          : `Faltan ${sinResponder.length} requisitos por responder.`
    }
    // Aqui, y no en el aviso de los requisitos, para que se resuelva ANTES: sin
    // el permiso no hay postulacion posible, asi que preguntarle si quiere
    // enviarla igual seria ofrecer algo que no existe.
    if (!acepta) {
      nuevos.acepta = 'Sin este permiso no podemos recibir tu postulación.'
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
      cv: cv!,
      resultadoOrgulloso: resultado.trim(),
      portafolio: portafolio.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      requisitosConfirmados: requisitos
        .filter((r) => respuestas[r.id] === 'si')
        .map((r) => r.id),
      aceptaTratamiento: acepta,
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

          {cv ? (
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
            accept={FORMATOS.join(',')}
            tabIndex={-1}
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
          />

          {errores.cv && (
            <p className={estilos.resumenErrores} id="error-cv" role="alert">
              {errores.cv}
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
            <p className={estilos.avisoRequisitos}>
              Léelos con calma y responde con sinceridad.{' '}
              <b>Es lo único que el sistema decide solo</b>: si no cumples alguno, tu
              postulación se cierra al enviarla y no podrás volver a postular a este puesto.
            </p>

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
          acepta justo antes de mandar los datos, no al principio del formulario.
        */}
        <section className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>Permiso para tratar tus datos</h2>
          <Consentimiento
            titulo={`Acepto que ${quienTrata} trate mis datos para este proceso`}
            explicacion={
              <>
                Tu currículum y tus respuestas los va a leer{' '}
                <b>{quienTrata}</b>, que es quien publica esta vacante y quien decide.
                Es un permiso por vacante: no cubre a las demás empresas del portal.
              </>
            }
            obligatorio
            legal={consentimiento.data?.texto}
            marcado={acepta}
            checked={acepta}
            error={errores.acepta}
            onChange={(e) => {
              setAcepta(e.target.checked)
              setErrores((x) => ({ ...x, acepta: undefined }))
            }}
          />
          {consentimiento.isError && (
            <p className={estilos.explicacion}>
              No pudimos cargar el texto completo. Puedes pedírselo al equipo antes de
              aceptar, o continuar: el permiso es el mismo.
            </p>
          )}
        </section>

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
