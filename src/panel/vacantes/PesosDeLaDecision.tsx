/**
 * «Pesos de la decisión»: qué versión de pesos rige la vacante, y cambiarla con
 * candidatos dentro (V74, specs/pesos-con-candidatos-y-fin-del-prestamo.md).
 *
 * Hasta la V74 el desplegable dejaba de servir con la primera postulación: el
 * servidor contestaba 409 para no medir a unos con una vara y a otros con otra.
 * Ahora la vara cambia **para todos a la vez**: el servidor recalcula a cada
 * candidato con nota, sin IA y sin mover a nadie de etapa.
 *
 * Por eso, si hay alguien con nota, **antes de guardar sale una confirmación**
 * que dice a cuántas personas toca y qué pesos cambian, antes y después. Sin
 * nadie con nota se guarda sin preguntar, como antes de la primera postulación.
 *
 * El cambio lo pide también el botón «Usar estos pesos» de la ficha del puesto,
 * y por eso la mecánica vive en `useCambioDePesos`: los dos sitios preguntan
 * igual, y ninguno recalcula a nadie sin avisar.
 */

import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asignarVersionPesos, listarVersionesPesos, preverCambioDePesos } from '../api/panel'
import type { CambioDePesosPrevisto, PesoAntesYDespues, VacantePanel } from '../api/tipos'
import { Modal } from '@/ui/Modal'
import estilos from './Vacante.module.css'
import modal from './Vacantes.module.css'
import propios from './PesosDeLaDecision.module.css'
import { turnoDeLaVacante } from './turnoDeLaVacante'

const personas = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`

const cifra = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : Number(valor).toLocaleString('es-PE', { maximumFractionDigits: 2 })

const iguales = (a: number | null | undefined, b: number | null | undefined) =>
  (a ?? null) === null ? (b ?? null) === null : (b ?? null) !== null && Number(a) === Number(b)

/**
 * Pedir otra versión de pesos para una vacante, con la confirmación cuando hace
 * falta.
 *
 * `elegir(id)` pregunta primero al servidor qué pasaría: si es la misma no hace
 * nada; si nadie tiene nota la guarda ya; si alguien la tiene, abre el diálogo
 * que devuelve `dialogo`, y quien llama lo pinta donde quiera.
 */
export function useCambioDePesos({
  vacanteId,
  alFallar,
  alCambiar,
}: {
  vacanteId: number
  /** Lo que no se pudo ni preguntar (un 403, el servidor caído): lo cuenta quien llama. */
  alFallar: (causa: unknown) => void
  alCambiar?: () => void
}) {
  const cache = useQueryClient()
  const [previsto, setPrevisto] = useState<CambioDePesosPrevisto | null>(null)
  const [preguntando, setPreguntando] = useState(false)
  const [recalculadas, setRecalculadas] = useState<number | null>(null)
  /*
   * ⚠️ La guarda de verdad contra el doble clic en «Cambiar y recalcular»: un
   * `disabled` llega en el render siguiente y las dos pulsaciones caben antes.
   * Recalcular dos veces no rompe nada, pero el segundo cambio no cambiaría
   * nada y su aviso diría «se recalcularon 0 personas» encima del primero.
   */
  const yaSeEnvio = useRef(false)

  const cambio = useMutation({
    mutationFn: (versionPesosId: number) => asignarVersionPesos(vacanteId, versionPesosId),
    scope: turnoDeLaVacante(vacanteId),
    onSuccess: async (hecho) => {
      setPrevisto(null)
      setRecalculadas(hecho?.personasRecalculadas ?? 0)
      await cache.invalidateQueries({ queryKey: ['panel-vacante', vacanteId] })
      // Las notas cambiaron para toda la tanda: el ranking y su ficha se releen
      await cache.invalidateQueries({ queryKey: ['panel-ranking', vacanteId] })
      await cache.invalidateQueries({ queryKey: ['panel-perfil'] })
      alCambiar?.()
    },
    onSettled: () => {
      yaSeEnvio.current = false
    },
    onError: (causa) => {
      // Con el diálogo abierto, el fallo se cuenta en él; sin diálogo, lo cuenta quien llama
      if (previsto === null) alFallar(causa)
    },
  })

  const elegir = async (versionPesosId: number) => {
    setRecalculadas(null)
    cambio.reset()
    setPreguntando(true)
    try {
      const lo = await preverCambioDePesos(vacanteId, versionPesosId)
      if (!lo.cambia) return
      if (lo.personasConNota === 0) {
        cambio.mutate(versionPesosId)
      } else {
        setPrevisto(lo)
      }
    } catch (causa) {
      alFallar(causa)
    } finally {
      setPreguntando(false)
    }
  }

  const cancelar = () => {
    if (cambio.isPending) return
    setPrevisto(null)
    cambio.reset()
  }

  const confirmar = () => {
    if (previsto === null || yaSeEnvio.current) return
    yaSeEnvio.current = true
    cambio.mutate(previsto.versionNuevaId)
  }

  const dialogo: ReactNode =
    previsto === null ? null : (
      <ConfirmacionDePesos
        previsto={previsto}
        guardando={cambio.isPending}
        fallo={cambio.isError ? cambio.error : null}
        alCancelar={cancelar}
        alConfirmar={confirmar}
      />
    )

  return {
    elegir,
    ocupado: preguntando || cambio.isPending,
    dialogo,
    /** Cuántas se recalcularon en el último cambio que salió bien, o `null`. */
    recalculadas,
  }
}

/** El diálogo de antes de guardar: a quién toca y qué pesos cambian. */
export function ConfirmacionDePesos({
  previsto,
  guardando,
  fallo,
  alCancelar,
  alConfirmar,
}: {
  previsto: CambioDePesosPrevisto
  guardando: boolean
  fallo: unknown
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const n = previsto.personasConNota
  const reparto = (previsto.perfilIntegral ?? [])
    .map((p) => `${p.nombre} ${cifra(p.antes)} → ${cifra(p.despues)}`)
    .join(' · ')
  return (
    <Modal
      abierto
      titulo={`¿Cambiar a «${previsto.etiquetaNueva}»?`}
      onCerrar={alCancelar}
      aPruebaDeDobleClic
      pie={
        <>
          <button
            className={modal.secundarioModal}
            type="button"
            onClick={alCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            className={modal.guardar}
            type="button"
            onClick={alConfirmar}
            disabled={guardando}
          >
            {guardando ? `Recalculando ${personas(n)}…` : 'Cambiar y recalcular'}
          </button>
        </>
      }
    >
      <p className={propios.texto}>
        Se recalcularán las notas de {personas(n)} con los pesos nuevos: currículum, Perfil
        Integral, simulación, validación y nota final. No se llama a la IA y nadie cambia de
        etapa. Las decisiones ya tomadas se mantienen.
      </p>
      <table className={propios.comparacion}>
        <caption>
          Qué cambia{previsto.etiquetaAnterior ? ` desde «${previsto.etiquetaAnterior}»` : ''}
        </caption>
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col" className={propios.cifra}>
              Antes
            </th>
            <th scope="col" className={propios.cifra}>
              Después
            </th>
          </tr>
        </thead>
        <tbody>
          {(previsto.etapas ?? []).map((etapa: PesoAntesYDespues) => (
            <tr key={etapa.codigo}>
              <th scope="row">
                {etapa.nombre}
                {etapa.codigo === 'PERFIL_INTEGRAL' && reparto && (
                  <span className={propios.reparto}>{reparto}</span>
                )}
              </th>
              <td className={propios.cifra} data-rotulo="Antes">
                {cifra(etapa.antes)}
              </td>
              <td
                className={`${propios.cifra} ${iguales(etapa.antes, etapa.despues) ? '' : propios.cambia}`}
                data-rotulo="Después"
              >
                {cifra(etapa.despues)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {fallo !== null && fallo !== undefined && (
        <p className={`${modal.aviso} ${modal.malo}`} role="alert">
          No se cambió nada: la vacante sigue con sus pesos y sus notas.{' '}
          {fallo instanceof Error ? fallo.message : ''}
        </p>
      )}
    </Modal>
  )
}

/**
 * El bloque «Pesos de la decisión» de la configuración de la vacante.
 *
 * El desplegable sigue activo con candidatos dentro mientras la vacante no esté
 * cerrada ni archivada; cerrada, se queda en solo lectura con el porqué.
 */
export function PesosDeLaDecision({
  vacante,
  alFallar,
}: {
  vacante: VacantePanel
  alFallar: (causa: unknown) => void
}) {
  const pesos = useQuery({ queryKey: ['panel-pesos'], queryFn: listarVersionesPesos })
  const cambio = useCambioDePesos({ vacanteId: vacante.id, alFallar })
  const soloLectura = vacante.estado === 'CERRADA' || vacante.archivadaEn !== null

  /*
    ⚠️ `Number('')` es `0`, no `undefined`: elegir la línea vacía no es una
    elección, y no se manda nada.
  */
  const alElegir = (valor: string) => {
    if (valor !== '') void cambio.elegir(Number(valor))
  }

  return (
    <>
      <label className={estilos.ajuste}>
        <span className={estilos.etiquetaAjuste}>Qué pesos rigen la decisión</span>
        <select
          className={estilos.eleccion}
          value={vacante.versionPesosId ?? ''}
          onChange={(e) => alElegir(e.target.value)}
          disabled={soloLectura || cambio.ocupado}
        >
          <option value="" disabled={vacante.versionPesosId !== null}>
            Los pesos generales
          </option>
          {(pesos.data ?? [])
            .filter((p) => p.estado === 'PUBLICADA' || p.id === vacante.versionPesosId)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.etiqueta}
              </option>
            ))}
        </select>
        {/*
          ⚠️ **No hay forma de volver a los pesos generales.** El backend solo
          tiene `POST .../version-pesos`, que exige un id: ninguna ruta
          desasigna. Se apaga la opcion y se dice por que.
        */}
        {soloLectura ? (
          <span className={estilos.ayudaAjuste}>
            La vacante está cerrada: sus pesos ya no se cambian y sus notas se quedan con los
            que tenía.
          </span>
        ) : (
          vacante.versionPesosId !== null && (
            <span className={estilos.ayudaAjuste}>
              Se cambia por otra versión publicada, también con candidatos dentro: se recalcula
              a todos a la vez. No se puede volver a los pesos generales desde aquí.
            </span>
          )
        )}
        {cambio.recalculadas !== null && cambio.recalculadas > 0 && (
          <span className={`${modal.aviso} ${modal.bueno} ${propios.hecho}`} role="status">
            Pesos cambiados: se recalcularon {personas(cambio.recalculadas)}.
          </span>
        )}
      </label>
      {cambio.dialogo}
    </>
  )
}
