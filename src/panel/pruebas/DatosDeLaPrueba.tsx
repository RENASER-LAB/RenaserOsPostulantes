/**
 * Los datos de la versión: qué se pide, con qué, en cuánto tiempo, y qué se le
 * dice a la IA que la califica.
 *
 * ⚠️ **Es UN formulario y un solo botón de guardar, a propósito.** El backend no
 * tiene forma de cambiar un campo suelto: `PUT /versiones/{id}` **reemplaza la
 * versión entera** y lo que no viaje se guarda en nulo. Partirlo en tres
 * bloques con tres botones —los datos, el tiempo, la guía— haría que guardar uno
 * borrase los otros dos sin que nadie los tocara.
 */

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { actualizarVersionDePrueba, subirConsignaDePrueba } from '../api/panel'
import type { GuardarVersionPrueba, VersionPrueba } from '../api/tipos'
import { MAXIMO_GUIA_CALIFICACION } from '../api/tipos'
import { comoFormulario, explicarFallo, numeroDe, textoDe } from './borrador'
import estilos from './ComponerPrueba.module.css'

export function DatosDeLaPrueba({
  version,
  editable,
  alGuardar,
}: {
  version: VersionPrueba
  editable: boolean
  alGuardar: () => Promise<void>
}) {
  const [datos, setDatos] = useState<GuardarVersionPrueba>(() => comoFormulario(version))
  const [fallo, setFallo] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  /*
    Al refrescar la versión el formulario vuelve a sembrarse: es lo que hace que
    lo que se ve sea lo que hay en el servidor y no lo que se tecleó. La clave es
    el id, así que abrir otra versión no arrastra el texto de la anterior.
  */
  useEffect(() => {
    setDatos(comoFormulario(version))
  }, [version])

  const guardado_ = useMutation({
    mutationFn: () => actualizarVersionDePrueba(version.id, datos),
    onSuccess: async () => {
      setFallo(null)
      setGuardado(true)
      await alGuardar()
    },
    onError: (c) => {
      setGuardado(false)
      setFallo(explicarFallo(c))
    },
  })

  const cambiar = <C extends keyof GuardarVersionPrueba>(
    campo: C,
    valor: GuardarVersionPrueba[C],
  ) => {
    setGuardado(false)
    setDatos((antes) => ({ ...antes, [campo]: valor }))
  }

  const cronometrada = datos.modalidad === 'CRONOMETRADA'
  const largoGuia = (datos.guiaCalificacion ?? '').length

  return (
    <section className={estilos.bloque} aria-labelledby="datos-titulo">
      <h2 className={estilos.tituloBloque} id="datos-titulo">
        Qué se pide y en cuánto tiempo
      </h2>

      <fieldset className={estilos.campos} disabled={!editable}>
        {/* El `<fieldset disabled>` apaga el bloque entero de una vez: teclado,
            foco y lectores de pantalla incluidos, sin repetir `disabled` doce
            veces ni dejarse uno. */}
        <legend className={estilos.oculto}>Los datos de la versión</legend>

        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>El enunciado</span>
          <textarea
            className={estilos.area}
            rows={5}
            value={datos.enunciado}
            onChange={(e) => cambiar('enunciado', e.target.value)}
          />
          <span className={estilos.pista}>
            Lo que quien la rinde lee para saber qué tiene que hacer. Es lo único obligatorio de
            este bloque.
          </span>
        </label>

        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Con qué material se le entrega</span>
          <textarea
            className={estilos.area}
            rows={2}
            value={datos.materiales ?? ''}
            onChange={(e) => cambiar('materiales', e.target.value || null)}
          />
          <span className={estilos.pista}>
            Lo que recibe al empezar: los veinte currículums, el archivo de datos, el caso.
          </span>
        </label>

        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Qué herramientas puede usar</span>
          <textarea
            className={estilos.area}
            rows={2}
            value={datos.herramientasPermitidas ?? ''}
            onChange={(e) => cambiar('herramientasPermitidas', e.target.value || null)}
          />
          <span className={estilos.pista}>
            Se dice en el enunciado, no se vigila: el sistema no comprueba nada de esto.
          </span>
        </label>

        <div className={estilos.fila}>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Cómo se rinde</span>
            <select
              className={estilos.entrada}
              value={datos.modalidad}
              onChange={(e) =>
                cambiar('modalidad', e.target.value as GuardarVersionPrueba['modalidad'])
              }
            >
              <option value="CRONOMETRADA">Con reloj: empieza al abrirla y no se para</option>
              <option value="PLAZO_ABIERTO">Con plazo de días, sin reloj</option>
            </select>
          </label>

          {cronometrada ? (
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Cuántos minutos dura</span>
              <input
                className={estilos.entrada}
                type="number"
                min={60}
                max={120}
                value={textoDe(datos.duracionMinutos)}
                onChange={(e) => cambiar('duracionMinutos', numeroDe(e.target.value))}
              />
              <span className={estilos.pista}>
                Entre 60 y 120. Es lo primero que el servidor comprueba al publicar.
              </span>
            </label>
          ) : (
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Cuántos días de plazo</span>
              <input
                className={estilos.entrada}
                type="number"
                min={1}
                value={textoDe(datos.plazoDias)}
                onChange={(e) => cambiar('plazoDias', numeroDe(e.target.value))}
              />
              <span className={estilos.pista}>
                Solo para las pruebas antiguas que se cargaron así. Lo normal es con reloj.
              </span>
            </label>
          )}
        </div>

        <div className={estilos.fila}>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>El cambio llega a partir del minuto</span>
            <input
              className={estilos.entrada}
              type="number"
              min={0}
              value={textoDe(datos.minutoCambioMin)}
              onChange={(e) => cambiar('minutoCambioMin', numeroDe(e.target.value))}
            />
          </label>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>…y como muy tarde en el minuto</span>
            <input
              className={estilos.entrada}
              type="number"
              min={0}
              value={textoDe(datos.minutoCambioMax)}
              onChange={(e) => cambiar('minutoCambioMax', numeroDe(e.target.value))}
            />
          </label>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Minutos extra que se dan por el cambio</span>
            <input
              className={estilos.entrada}
              type="number"
              min={0}
              value={textoDe(datos.minutosExtra)}
              onChange={(e) => cambiar('minutosExtra', numeroDe(e.target.value))}
            />
          </label>
        </div>

        {/*
          ⚠️ El minuto no es fijo y decirlo importa: si lo fuera, el segundo
          candidato de una tanda sabria de antemano cuando le llega el cambio.
        */}
        <p className={estilos.pista}>
          Es un rango, no un minuto: al empezar cada intento se sortea uno de dentro. Así el
          segundo candidato de una tanda no puede saber cuándo le va a llegar. Se deja en blanco
          si esta prueba no tiene cambio inesperado.
        </p>

        <GuiaDeCalificacion
          valor={datos.guiaCalificacion ?? ''}
          largo={largoGuia}
          alCambiar={(t) => cambiar('guiaCalificacion', t || null)}
        />
      </fieldset>

      {editable && (
        <div className={estilos.botones}>
          <button
            className={estilos.principal}
            type="button"
            onClick={() => guardado_.mutate()}
            disabled={guardado_.isPending || datos.enunciado.trim() === ''}
          >
            {guardado_.isPending ? 'Guardando…' : 'Guardar estos datos'}
          </button>
          {/*
            ⚠️ El aviso sale de que el servidor lo confirmó —el `onSuccess` de la
            mutación—, no de que se pulsó el botón, y se apaga en cuanto se
            vuelve a teclear. Un «guardado» fijo es la trampa que ya costó
            respuestas perdidas en este portal.
          */}
          {guardado && !guardado_.isPending && (
            <span className={estilos.avisoBien} role="status">
              Guardado.
            </span>
          )}
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      <ElEnunciadoComoArchivo version={version} editable={editable} alSubir={alGuardar} />
    </section>
  )
}

// ---------- La guia de calificacion ----------

/**
 * El texto que orienta a la IA que pone las notas.
 *
 * ⚠️ **Orienta, no sustituye a la rúbrica**, y decirlo aquí no es cortesía: es la
 * confusión natural. La nota sigue saliendo criterio a criterio y la rúbrica
 * sigue teniendo que sumar 100. Una guía que pidiera «califica sobre 100» no
 * tendría dónde escribirse — las notas se guardan por código de criterio— y el
 * backend la descartaría sin decir nada.
 */
function GuiaDeCalificacion({
  valor,
  largo,
  alCambiar,
}: {
  valor: string
  largo: number
  alCambiar: (texto: string) => void
}) {
  const pasado = largo > MAXIMO_GUIA_CALIFICACION

  return (
    <label className={estilos.campo}>
      <span className={estilos.etiqueta}>Qué debería mirar la IA al calificarla</span>
      <p className={estilos.aclara}>
        Lo que distingue un buen trabajo en este oficio y en esta empresa: qué pesa, qué error
        descarta, qué no hay que premiar. <strong>No reemplaza a la rúbrica.</strong> La nota
        sigue saliendo criterio a criterio, con los puntos que diga cada uno, y la rúbrica sigue
        teniendo que sumar 100. Esto solo orienta cómo se lee lo que entregó.
      </p>
      <textarea
        className={pasado ? estilos.areaMal : estilos.area}
        rows={4}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-describedby="largo-guia"
      />
      <span className={pasado ? estilos.contadorMal : estilos.contador} id="largo-guia">
        {largo} de {MAXIMO_GUIA_CALIFICACION} caracteres
        {pasado && ' · el servidor rechaza guardar por encima de ese tope'}
      </span>
    </label>
  )
}

// ---------- El enunciado subido como archivo ----------

/**
 * Subir el PDF o el Word del enunciado.
 *
 * ⚠️ **Es el ENUNCIADO, no la prueba.** De un PDF no sale ninguna nota: subirlo
 * no crea preguntas, ni entregables, ni criterios de rúbrica, y publicar sigue
 * exigiendo exactamente lo mismo que antes. Es la otra confusión natural de esta
 * pantalla, y por eso está dicho junto al botón y no en un pie.
 */
function ElEnunciadoComoArchivo({
  version,
  editable,
  alSubir,
}: {
  version: VersionPrueba
  editable: boolean
  alSubir: () => Promise<void>
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [expira, setExpira] = useState<string | null>(null)

  const subida = useMutation({
    mutationFn: () => subirConsignaDePrueba(version.id, archivo as File),
    onSuccess: async (r) => {
      setFallo(null)
      setArchivo(null)
      setExpira(r.expira)
      await alSubir()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  return (
    <div className={estilos.consigna}>
      <h3 className={estilos.tituloMenor}>El enunciado en papel</h3>
      <p className={estilos.aclara}>
        El PDF o el Word que se le enlaza en el correo, para que lo lea entero.{' '}
        <strong>Es solo el enunciado, no la prueba.</strong> Subirlo no crea ninguna pregunta,
        ningún entregable ni ningún criterio: todo eso se sigue escribiendo aquí abajo, y sin
        ello la prueba no se publica.
      </p>

      {version.urlConsigna && (
        <p className={estilos.hayArchivo}>
          <a
            className={estilos.enlace}
            href={version.urlConsigna}
            target="_blank"
            rel="noreferrer"
          >
            Ver el enunciado que hay subido
          </a>
          {/*
            ⚠️ El enlace CADUCA: el bucket es privado y la firma dura 180 dias.
            Callarlo dejaria que un correo saliera con un enlace muerto.
          */}
          <span className={estilos.pista}>
            El enlace está firmado y caduca a los 180 días
            {expira && ` (este, el ${enFecha(expira)})`}. Si un proceso se alarga más que eso,
            hay que volver a subirlo — y solo se puede mientras la versión esté en borrador.
          </span>
        </p>
      )}

      {editable && (
        <div className={estilos.subirFila}>
          <input
            className={estilos.archivo}
            type="file"
            accept=".pdf,.doc,.docx"
            aria-label="El enunciado de la prueba, en PDF o Word"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <button
            className={estilos.chico}
            type="button"
            onClick={() => subida.mutate()}
            disabled={subida.isPending || archivo === null}
          >
            {subida.isPending ? 'Subiendo…' : 'Subir el enunciado'}
          </button>
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </div>
  )
}

const enFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
