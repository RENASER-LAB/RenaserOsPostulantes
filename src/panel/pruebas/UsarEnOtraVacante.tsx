/**
 * «Usar en otra vacante», dentro de la vista previa (spec pruebas-indice-de-la-empresa, punto 6).
 *
 * Se elige la vacante destino entre las que ofrece el servidor —de la empresa,
 * al alcance de quien mira, que usan el editor para esto y que todavía se
 * pueden editar— sin la de origen. Las que ya rinde alguien salen
 * deshabilitadas con su motivo. Si la destino tiene un borrador, se pide
 * confirmar que se reemplaza, con el texto del editor. La copia es el
 * `POST …/copia` de siempre: es una copia, no un enlace.
 *
 * Si entre desplegar y confirmar la destino empieza a rendirse, el servidor la
 * rechaza con su texto de siempre: se dice aquí, esa queda deshabilitada y la
 * lista se vuelve a pedir.
 */

import { useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { copiarDeOtraVacante, type EditorDePreguntas, type RutaDelEditor } from '../api/preguntasPropias'
import { listarDestinos, type FilaDePrueba, type TipoDePrueba, type VacanteDestino } from '../api/pruebas'
import { nombreDeLaSituacion, sinTildes } from './indice'
import estilos from './Pruebas.module.css'

/** Lo que dice una destino que se deshabilitó aquí, tras el rechazo del servidor. */
const MOTIVO_DE_LA_PESTANA: Record<TipoDePrueba, string> = {
  PERFIL_INTEGRAL: 'Ya tiene postulantes: sus preguntas no se reemplazan',
  PRUEBA_PUESTO: 'Ya la rinden candidatos: su prueba no se reemplaza',
}

interface Props {
  tipo: TipoDePrueba
  origen: FilaDePrueba
  /** Pliega el bloque como Escape: quien lo despliega devuelve el foco a «Usar en otra vacante». */
  alCancelar: () => void
  alCopiar: (destino: number, editor: EditorDePreguntas) => void
}

export function UsarEnOtraVacante({ tipo, origen, alCancelar, alCopiar }: Props) {
  const id = useId()
  const buscador = useRef<HTMLInputElement>(null)
  const [buscar, setBuscar] = useState('')
  const [elegida, setElegida] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  // Las que el servidor rechazó mientras se miraba: deshabilitadas aunque la lista vieja diga otra cosa.
  const [yaSeRinden, setYaSeRinden] = useState<number[]>([])

  const destinos = useQuery({
    queryKey: ['panel-pruebas-destinos', tipo, origen.vacanteId],
    queryFn: () => listarDestinos(tipo, origen.vacanteId),
  })

  const ruta: RutaDelEditor = tipo === 'PRUEBA_PUESTO' ? 'prueba-propia' : 'preguntas-propias'
  const copia = useMutation({
    mutationFn: (destino: number) => copiarDeOtraVacante(destino, origen.vacanteId, ruta),
    onSuccess: (editor, destino) => alCopiar(destino, editor),
    onError: (causa, destino) => {
      if (causa instanceof ErrorApi && causa.estado === 409) {
        setRechazo(causa.message)
        setYaSeRinden((antes) => [...antes, destino])
        setElegida(null)
        setConfirmando(false)
        void destinos.refetch()
        buscador.current?.focus()
      }
    },
  })

  const deshabilitada = (d: VacanteDestino) => !d.puedeRecibir || yaSeRinden.includes(d.vacanteId)
  const motivoDe = (d: VacanteDestino) =>
    !d.puedeRecibir ? d.motivo ?? MOTIVO_DE_LA_PESTANA[tipo] : MOTIVO_DE_LA_PESTANA[tipo]
  const buscado = sinTildes(buscar)
  const todas = destinos.data ?? []
  const visibles = todas
    .filter((d) => !buscado || sinTildes(d.titulo).includes(buscado))
    .sort((a, b) => Number(deshabilitada(a)) - Number(deshabilitada(b)))
  const laElegida = todas.find((d) => d.vacanteId === elegida) ?? null
  const copiando = copia.isPending
  const fallo = copia.isError && !(copia.error instanceof ErrorApi && copia.error.estado === 409)

  function copiar(e?: FormEvent) {
    e?.preventDefault()
    if (!laElegida || copiando) return
    if (laElegida.tieneBorrador && !confirmando) {
      setConfirmando(true)
      return
    }
    setRechazo(null)
    copia.mutate(laElegida.vacanteId)
  }

  const botonCopiar = (texto: string) => (
    <button className={estilos.acento} type="submit" disabled={!laElegida || copiando}>
      {copiando ? (
        <>
          <span className={estilos.giro} aria-hidden="true" />
          Copiando…
        </>
      ) : (
        texto
      )}
    </button>
  )

  return (
    <form className={estilos.copia} onSubmit={copiar} aria-label="Usar en otra vacante">
      <div className={estilos.cabeceraCopia}>
        <label htmlFor={`${id}-buscar`}>Vacante destino</label>
        <button className={estilos.fantasma} type="button" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
      <input
        ref={buscador}
        id={`${id}-buscar`}
        className={estilos.entradaCopia}
        type="search"
        placeholder="Buscar vacante…"
        autoComplete="off"
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        // El bloque nace con el foco aquí: es lo primero que se hace en él.
        autoFocus
      />

      {destinos.isPending && (
        <p className={estilos.estadoCopia} role="status">
          <span className={estilos.giro} aria-hidden="true" />
          Cargando vacantes…
        </p>
      )}
      {destinos.isError && !destinos.data && (
        <div className={estilos.avisoMalo} role="alert">
          <span>No se pudieron cargar las vacantes.</span>
          <button className={estilos.secundario} type="button" onClick={() => void destinos.refetch()}>
            Reintentar
          </button>
        </div>
      )}
      {destinos.data && (
        <div className={estilos.destinos} role="radiogroup" aria-label="Vacante destino">
          {visibles.length === 0 && (
            <p className={estilos.estadoCopia}>
              {todas.length === 0 ? 'No hay vacantes que puedan recibirla.' : 'Ninguna vacante coincide.'}
            </p>
          )}
          {visibles.map((d) => {
            const fuera = deshabilitada(d)
            const marcada = elegida === d.vacanteId
            const clase = [estilos.destino, marcada ? estilos.destinoElegido : '', fuera ? estilos.destinoFuera : '']
              .filter(Boolean)
              .join(' ')
            return (
              <label key={d.vacanteId} className={clase}>
                <input
                  type="radio"
                  name={`${id}-destino`}
                  value={d.vacanteId}
                  checked={marcada}
                  disabled={fuera || copiando}
                  onChange={() => {
                    setElegida(d.vacanteId)
                    setConfirmando(false)
                    setRechazo(null)
                    copia.reset()
                  }}
                />
                <span className={estilos.tituloDestino}>
                  {d.titulo}
                  {d.sede && <span className={estilos.sede}> · {d.sede}</span>}
                </span>
                <span className={estilos.datosDestino}>
                  Situación: {nombreDeLaSituacion(d.situacion)}
                  {d.tieneBorrador ? ' · Tiene un borrador' : ''}
                </span>
                {fuera && <span className={estilos.motivoDestino}>{motivoDe(d)}</span>}
              </label>
            )
          })}
        </div>
      )}

      <div className={estilos.accionesCopia} aria-live="polite">
        {fallo ? (
          <>
            <span className={estilos.mensajeMalo} role="alert">
              No se pudo copiar. La vacante destino no cambió.
            </span>
            <span className={estilos.botonesCopia}>
              <button className={estilos.secundario} type="button" onClick={() => copiar()}>
                Reintentar
              </button>
            </span>
          </>
        ) : confirmando ? (
          <>
            <span className={estilos.mensajeAviso}>Ya hay un borrador en esta vacante: la copia lo reemplaza entero.</span>
            <span className={estilos.botonesCopia}>
              <button
                className={estilos.secundario}
                type="button"
                disabled={copiando}
                onClick={() => {
                  setConfirmando(false)
                  setElegida(null)
                  buscador.current?.focus()
                }}
              >
                Elegir otra
              </button>
              {botonCopiar('Reemplazar y copiar')}
            </span>
          </>
        ) : (
          <>
            {rechazo && (
              <span className={estilos.mensajeMalo} role="alert">
                {rechazo}
              </span>
            )}
            <span className={estilos.botonesCopia}>{botonCopiar('Copiar y abrir')}</span>
          </>
        )}
      </div>
    </form>
  )
}
