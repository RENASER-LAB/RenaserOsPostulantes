/**
 * Un entregable de la prueba —un archivo o un enlace— y el enunciado adjunto.
 *
 * Los usan las dos formas de la prueba: la de plantilla, que lo enseña todo en vertical, y la
 * del editor, que va de una pregunta por pantalla (el archivo de una pregunta dentro de su
 * tarjeta; los generales en el paso «Entregables»).
 */

import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { subirArchivo, subirEnlace } from '@/api/prueba'
import type { EntregableRequerido } from '@/api/tipos'
import estilos from './Prueba.module.css'

/**
 * Que acepta este entregable, en palabras.
 *
 * `formato` llega como `ARCHIVO`, `ENLACE` o `CUALQUIERA`, y hasta ahora se
 * imprimia tal cual —«Formato: ARCHIVO»— mientras la pantalla enseñaba los dos
 * campos igualmente. El resultado real: alguien pega un enlace donde solo se
 * admite archivo, el servidor responde con un 400 y el reloj no se para.
 */
export function comoSeEntrega(formato: string | null): string {
  if (formato === 'ARCHIVO') return 'Se entrega como archivo'
  if (formato === 'ENLACE') return 'Se entrega como enlace'
  return 'Archivo o enlace, lo que prefieras'
}

/** El primer control de un entregable: a donde lleva «Ir a la pregunta N» cuando falta su archivo. */
export function controlDelEntregable(id: number): HTMLElement | null {
  const caja = document.getElementById(`entregable-${id}`)
  return (
    caja?.querySelector<HTMLElement>('input:not([tabindex="-1"]):not([disabled]), button:not([disabled])') ??
    null
  )
}

export function Entregable({
  uuid,
  entregable,
  bloqueado,
  alSubir,
  siSeCerroLaPuerta,
  seEnsena,
  deLaPregunta = false,
  falta = false,
  recibido,
  alRecibir,
  quieto = false,
}: {
  uuid: string
  entregable: EntregableRequerido
  /** V68: el archivo de una pregunta, que se sube dentro de ella. */
  deLaPregunta?: boolean
  /**
   * La pregunta está respondida y falta este archivo obligatorio: el recuadro va en ámbar, que
   * es lo que frena la entrega.
   */
  falta?: boolean
  /** Con el tiempo agotado ya no se admite nada: el servidor lo rechaza. */
  bloqueado: boolean
  alSubir: () => void
  /** Un 404 al subir: la vacante pudo retirarse con la prueba abierta. Ver `usePantallaAbierta`. */
  siSeCerroLaPuerta: (causa: unknown) => boolean
  seEnsena: (causa: unknown) => boolean
  /**
   * Lo último que se mandó desde esta pantalla, si quien lo pinta lo recuerda. La prueba del
   * editor lo guarda fuera para que «Recibimos «X»» siga ahí al volver a la pregunta.
   */
  recibido?: string | null
  alRecibir?: (nombre: string) => void
  /**
   * Sin el rótulo que gira al pasar por encima: dentro de la prueba de una pregunta por
   * pantalla no se mueve nada (la regla del reloj). La de plantilla sigue como siempre.
   */
  quieto?: boolean
}) {
  const campoArchivo = useRef<HTMLInputElement>(null)
  const [enlace, setEnlace] = useState('')
  // Se guarda la causa y no solo el texto: un 404 no se enseña mientras se comprueba si es
  // la vacante retirada.
  const [fallo, setFallo] = useState<{ causa: unknown; texto: string } | null>(null)
  const error = fallo !== null && seEnsena(fallo.causa) ? fallo.texto : null
  const alFallar = (causa: unknown, siNoHayTexto: string) => {
    siSeCerroLaPuerta(causa)
    setFallo({ causa, texto: causa instanceof Error ? causa.message : siNoHayTexto })
  }

  /*
   * El backend solo dice `entregado: true`. No devuelve el nombre del archivo
   * ni la direccion que se guardo —su contrato de candidato no los lleva—, asi
   * que lo unico que se puede enseñar sin inventar nada es lo que se acaba de
   * mandar desde esta pantalla, y solo mientras siga abierta.
   */
  const [propio, setPropio] = useState<string | null>(null)
  const ultimoEnvio = recibido !== undefined ? recibido : propio
  const anotar = (nombre: string) => {
    setPropio(nombre)
    alRecibir?.(nombre)
  }

  // Un formato que no conocemos (o nulo) se trata como «los dos». Enseñar de
  // mas se corrige con un aviso del servidor; esconder el campo bueno deja al
  // candidato sin ninguna forma de entregar.
  const aceptaArchivo = entregable.formato !== 'ENLACE'
  const aceptaEnlace = entregable.formato !== 'ARCHIVO'

  const archivo = useMutation({
    mutationFn: (f: File) => subirArchivo(uuid, entregable.id, f),
    onSuccess: (_resultado, f) => {
      setFallo(null)
      anotar(f.name)
      alSubir()
    },
    onError: (c) => alFallar(c, 'No se pudo subir.'),
  })

  const url = useMutation({
    mutationFn: (valor: string) => subirEnlace(uuid, entregable.id, valor),
    onSuccess: (_resultado, valor) => {
      setFallo(null)
      anotar(valor)
      setEnlace('')
      alSubir()
    },
    onError: (c) => alFallar(c, 'No se pudo guardar el enlace.'),
  })

  const yaEsta = entregable.entregado || ultimoEnvio != null

  return (
    <div
      id={`entregable-${entregable.id}`}
      className={`${estilos.entregable}${yaEsta ? ` ${estilos.recibido}` : ''}${
        falta && !yaEsta ? ` ${estilos.falta}` : ''
      }`}
    >
      <div className={estilos.cabeceraEntregable}>
        <div>
          <p className={estilos.nombreEntregable}>
            {deLaPregunta && 'Archivo de esta pregunta: '}
            {entregable.nombre}{' '}
            <span className={estilos.obligatorio}>
              {entregable.esObligatorio ? '· obligatorio' : '· opcional'}
            </span>
          </p>
          {entregable.detalle && (
            <p className={estilos.detalleEntregable}>{entregable.detalle}</p>
          )}
        </div>
        {yaEsta && <span className={estilos.marcaRecibido}>Entregado</span>}
      </div>

      {yaEsta && (
        <p className={estilos.detalleEntregable}>
          {ultimoEnvio ? (
            <>
              Recibimos <b>{ultimoEnvio}</b>.
            </>
          ) : (
            'Ya recibimos tu entrega.'
          )}
          {!bloqueado && ' Si envías otra cosa, reemplaza a esta.'}
        </p>
      )}

      {falta && !yaEsta && (
        <p className={estilos.faltaElArchivo}>Sin este archivo no se puede entregar la prueba.</p>
      )}

      <span className={estilos.comoSeEntrega}>{comoSeEntrega(entregable.formato)}</span>

      <div className={estilos.formasDeEntregar}>
        {aceptaEnlace && (
          <>
            <label className={estilos.oculto} htmlFor={`enlace-${entregable.id}`}>
              Enlace
            </label>
            <input
              id={`enlace-${entregable.id}`}
              className={estilos.campoEnlace}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={enlace}
              disabled={bloqueado}
              onChange={(e) => setEnlace(e.target.value)}
            />
            <button
              className={estilos.subir}
              type="button"
              onClick={() => url.mutate(enlace.trim())}
              disabled={bloqueado || !enlace.trim() || url.isPending}
              data-rotulo={quieto ? undefined : url.isPending ? 'Guardando…' : 'Guardar enlace'}
            >
              {url.isPending ? 'Guardando…' : 'Guardar enlace'}
            </button>
          </>
        )}
        {aceptaArchivo && (
          <>
            <input
              ref={campoArchivo}
              type="file"
              className={estilos.oculto}
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) archivo.mutate(f)
              }}
            />
            <button
              className={estilos.subir}
              type="button"
              onClick={() => campoArchivo.current?.click()}
              disabled={bloqueado || archivo.isPending}
              data-rotulo={quieto ? undefined : archivo.isPending ? 'Subiendo…' : 'Seleccionar archivo'}
            >
              {archivo.isPending ? 'Subiendo…' : 'Seleccionar archivo'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

/** El enunciado adjunto en PDF o Word. Sin dirección (en local), solo su nombre. */
export function Consigna({ consigna }: { consigna: { nombre: string | null; url: string | null } }) {
  const nombre = consigna.nombre ?? 'El enunciado adjunto'
  return (
    <p className={estilos.texto} style={{ marginTop: 'var(--e3)' }}>
      {consigna.url ? (
        <a href={consigna.url} target="_blank" rel="noopener noreferrer">
          Abrir el enunciado adjunto: {nombre}
        </a>
      ) : (
        <>Enunciado adjunto: {nombre}.</>
      )}
    </p>
  )
}
