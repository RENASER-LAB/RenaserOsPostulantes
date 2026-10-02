/**
 * Copiar de otra vacante: la biblioteca de la empresa son sus propias vacantes.
 *
 * Se ofrecen las activas, las cerradas y las archivadas (repetir una
 * contratación que ya terminó es lo habitual), nunca las eliminadas. Antes de
 * copiar se ve la prueba entera en solo lectura, al lado —debajo en el
 * teléfono—, y nada cambia hasta pulsar «Copiar esta prueba». Si ya había un
 * borrador, se pide confirmar que se reemplaza.
 *
 * La lectura va por el servidor con el mismo corte por empresa que la copia: la
 * vacante de otra empresa contesta 404.
 */

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  copiarDeOtraVacante,
  listarCopiables,
  verVistaPrevia,
  type EditorDePreguntas,
  type VacanteCopiable,
} from '../../api/preguntasPropias'
import { Modal } from '@/ui/Modal'
import { falloDe, type Fallo } from './consultas'
import { NIVELES_DE_PUESTO, nombreDelNivel } from './formulario'
import { esPrueba, useModoDelEditor } from './modo'
import { MostrarFallo } from './piezas'
import { VistaDeVersion } from './VistaDeVersion'
import estilos from './EditorDePreguntas.module.css'

// El filtro y cada vacante de la lista nombran el nivel igual: «Ejecución», no «ejecucion».
const NIVELES = [{ valor: '', nombre: 'Todos los niveles' }, ...NIVELES_DE_PUESTO]

const ESTADOS: Record<VacanteCopiable['estado'], string> = {
  ACTIVA: 'activa',
  CERRADA: 'cerrada',
  ARCHIVADA: 'archivada',
}

function fechaCorta(iso: string | null): string {
  if (!iso) return 'sin publicar'
  const f = new Date(iso)
  return `${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`
}

interface Props {
  vacanteId: number
  abierto: boolean
  hayBorrador: boolean
  alCerrar: () => void
  alCopiar: (editor: EditorDePreguntas) => void
}

export function CopiarDeOtraVacante({ vacanteId, abierto, hayBorrador, alCerrar, alCopiar }: Props) {
  const modo = useModoDelEditor()
  const deLaPrueba = esPrueba(modo)
  const [buscar, setBuscar] = useState('')
  const [nivel, setNivel] = useState('')
  const [elegida, setElegida] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const lista = useQuery({
    queryKey: ['panel-preguntas-copiables', modo.ruta, vacanteId, buscar.trim(), nivel],
    queryFn: () => listarCopiables(vacanteId, buscar, nivel, modo.ruta),
    enabled: abierto,
  })
  const previa = useQuery({
    queryKey: ['panel-preguntas-previa', modo.ruta, vacanteId, elegida],
    queryFn: () => verVistaPrevia(vacanteId, elegida!, modo.ruta),
    enabled: abierto && elegida !== null,
  })
  const copia = useMutation({
    mutationFn: () => copiarDeOtraVacante(vacanteId, elegida!, modo.ruta),
    onSuccess: (editor) => {
      setConfirmando(false)
      alCopiar(editor)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo copiar.')),
  })

  const copiar = () => {
    if (hayBorrador && !confirmando) {
      setConfirmando(true)
      return
    }
    copia.mutate()
  }

  const vistaPrevia =
    elegida === null ? (
      <p className={estilos.estado}>
        {deLaPrueba ? 'Elige una vacante para ver su prueba.' : 'Elige una vacante para ver sus preguntas.'}
      </p>
    ) : previa.isPending ? (
      <p className={estilos.estado} role="status">
        {deLaPrueba ? 'Abriendo su prueba…' : 'Abriendo sus preguntas…'}
      </p>
    ) : previa.isError ? (
      <p className={estilos.error} role="alert">
        {deLaPrueba ? 'No se pudo abrir su prueba.' : 'No se pudieron abrir sus preguntas.'}
      </p>
    ) : (
      <>
        <VistaDeVersion version={previa.data} />
        {confirmando && (
          <div className={estilos.confirmacion} role="alertdialog" aria-label="Reemplazar el borrador">
            <span>Ya hay un borrador en esta vacante: la copia lo reemplaza entero.</span>
            <button className={estilos.peligroso} type="button" onClick={copiar} disabled={copia.isPending}>
              Reemplazar el borrador
            </button>
            <button className={estilos.secundario} type="button" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        )}
        {!confirmando && (
          <button className={estilos.guardar} type="button" onClick={copiar} disabled={copia.isPending}>
            {copia.isPending ? 'Copiando…' : 'Copiar esta prueba'}
          </button>
        )}
        <MostrarFallo fallo={fallo} />
      </>
    )

  return (
    <Modal abierto={abierto} titulo="Copiar de otra vacante" onCerrar={alCerrar} pantallaCompleta>
      <div className={estilos.copiar}>
        <div className={estilos.buscador}>
          <input
            className={estilos.entrada}
            type="search"
            aria-label="Buscar por nombre"
            placeholder="Buscar…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <select
            className={estilos.eleccion}
            aria-label="Filtrar por nivel"
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
          >
            {NIVELES.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.nombre}
              </option>
            ))}
          </select>
        </div>

        <ul
          className={estilos.lista}
          aria-label={deLaPrueba ? 'Vacantes con prueba técnica' : 'Vacantes con preguntas propias'}
        >
          {lista.isPending && <li className={estilos.estado}>Buscando…</li>}
          {lista.isError && <li className={estilos.error}>No se pudo leer la lista.</li>}
          {lista.data?.length === 0 && (
            <li className={estilos.estado}>
              {deLaPrueba
                ? 'Ninguna vacante de tu empresa tiene su prueba técnica publicada'
                : 'Ninguna vacante de tu empresa tiene preguntas propias publicadas'}
              {buscar.trim() || nivel ? ' con ese filtro' : ''}.
            </li>
          )}
          {lista.data?.map((v) => (
            <li key={v.vacanteId}>
              <button
                className={estilos.copiable}
                type="button"
                aria-pressed={elegida === v.vacanteId}
                onClick={() => {
                  setElegida(v.vacanteId)
                  setConfirmando(false)
                  setFallo(null)
                }}
              >
                <b>
                  {v.titulo} · {fechaCorta(v.publicadaEn)}
                </b>
                <span>
                  {ESTADOS[v.estado]}
                  {v.nivel ? ` · ${nombreDelNivel(v.nivel)}` : ''} · {v.criterios} crit · {v.preguntas} preg
                </span>
              </button>
              {elegida === v.vacanteId && <div className={estilos.previaEnLaLista}>{vistaPrevia}</div>}
            </li>
          ))}
        </ul>

        <div className={estilos.previa} aria-label="Vista previa">
          {vistaPrevia}
        </div>
      </div>
    </Modal>
  )
}
