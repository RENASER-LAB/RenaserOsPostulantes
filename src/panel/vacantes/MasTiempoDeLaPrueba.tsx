/**
 * «Darle más tiempo» (V89): arriba de la pestaña «Prueba del puesto» de la ficha.
 *
 * - **Si no la completó** —se le acabó el tiempo con algo sin responder o sin
 *   subir, o se le pasó la fecha sin abrirla— se lee «No la completó · se le
 *   acabó el tiempo el 18 nov, 16:40» y debajo qué le faltó, o «No la abrió».
 *   Debajo, el botón que abre la ventana: «Hasta» (hora de Lima, vacía y
 *   futura), «Motivo» (obligatorio) y «Avisar a {nombre}» (marcada).
 * - **Con la prueba otra vez abierta** se lee «En curso · le cierra el vie 20
 *   nov, 18:00» y quién le dio más tiempo, cuándo y por qué.
 *
 * Lee lo mismo que «El plazo de esta persona» (`GET …/prueba/plazo`), con la
 * misma clave de caché: guardar aquí refresca los dos, y ese bloque deja de
 * pintarse mientras la prueba siga sin completar.
 *
 * ⚠️ **Sin el permiso `mover_postulacion` el botón no sale**, y con la vacante
 * archivada o el proceso cerrado sale apagado con su motivo al lado, como un
 * chip. El backend dice lo mismo con un 409 si alguien llega por otro lado.
 *
 * ⚠️ **Sin líneas de ayuda bajo los campos** (20/10/2026): etiquetas y errores.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { darMasTiempoDePrueba, verPlazoDePrueba } from '../api/panel'
import type { MasTiempoAplicado, PlazoVigenteDePrueba } from '../api/tipos'
import { ahora } from '@/dominio/reloj'
import { Modal } from '@/ui/Modal'
import { AreaTexto, Campo } from '@/ui/campos/Campo'
import { enfocarSinTapar } from '@/ui/campos/enfocarSinTapar'
import {
  conDiaDeLaSemanaEnLima,
  deCampoDeLima,
  diaCortoEnLima,
  diaYHoraEnLima,
} from './horaDeLima'
import estilos from './MasTiempoDeLaPrueba.module.css'

/** La clave que comparte con «El plazo de esta persona». */
export const clavePlazo = (postulacionId: number) => ['panel-plazo-prueba', postulacionId]

/** «Le faltaron 4 preguntas y «Tablero.xlsx»»: la frase del backend, con mayúscula. */
const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** El nombre de pila, para «Avisar a Beto». */
const nombreDePila = (candidato: string) => candidato.trim().split(/\s+/)[0] || candidato

interface Errores {
  hasta?: string
  motivo?: string
}

function explicarFallo(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 403) {
    return 'Tu rol no puede darle más tiempo: hace falta el permiso «mover_postulacion».'
  }
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return 'Esta postulación queda fuera de lo que tu rol puede mover, o su vacante ya no existe.'
  }
  if (causa instanceof ErrorApi && causa.estado >= 500) {
    return 'El servidor falló: su prueba sigue como estaba y no se le avisó. Vuelve a intentarlo en un momento.'
  }
  // Un 409 trae el porqué del servidor —archivada, proceso cerrado, ya no está
  // sin completar— y se dice tal cual.
  return causa instanceof Error ? causa.message : 'No se pudo darle más tiempo.'
}

/** «correo, campana y WhatsApp». */
function canalesDichos(canales: string[]): string {
  if (canales.length <= 1) return canales.join('')
  return `${canales.slice(0, -1).join(', ')} y ${canales[canales.length - 1]}`
}

export function ElTiempoDeLaPrueba({
  postulacionId,
  candidato,
}: {
  postulacionId: number
  candidato: string
}) {
  const cache = useQueryClient()
  const plazo = useQuery({
    queryKey: clavePlazo(postulacionId),
    queryFn: () => verPlazoDePrueba(postulacionId),
  })
  const [abierto, setAbierto] = useState(false)
  const [hasta, setHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [avisar, setAvisar] = useState(true)
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState<MasTiempoAplicado | null>(null)

  const dar = useMutation({
    mutationFn: (datos: { venceEn: string; motivo: string; avisar: boolean }) =>
      darMasTiempoDePrueba(postulacionId, datos.venceEn, datos.motivo, datos.avisar),
    onMutate: () => setFallo(null),
    onSuccess: (r) => {
      setAplicado(r)
      setAbierto(false)
      // La fila de la tabla, la ficha, su prueba y sus informes cambian sin recargar.
      cache.invalidateQueries({ queryKey: clavePlazo(postulacionId) })
      cache.invalidateQueries({ queryKey: ['panel-ranking'] })
      cache.invalidateQueries({ queryKey: ['panel-prueba-propia-candidato', postulacionId] })
      cache.invalidateQueries({ queryKey: ['panel-informes', postulacionId] })
      cache.invalidateQueries({ queryKey: ['panel-ficha', postulacionId] })
    },
    onError: (causa) => {
      if (causa instanceof ErrorApi && causa.estado === 400) {
        // Un 400 es un problema con lo escrito —«Esa fecha ya pasó»—: va junto al campo.
        setErrores({ hasta: causa.message })
        enfocarElError()
        return
      }
      setFallo(explicarFallo(causa))
    },
  })

  function enfocarElError() {
    requestAnimationFrame(() => {
      enfocarSinTapar(document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]'))
    })
  }

  function abrir() {
    // Llega vacía: la fecha la decide quien la da, y no se le propone ninguna.
    setHasta('')
    setMotivo('')
    setAvisar(true)
    setErrores({})
    setFallo(null)
    setAbierto(true)
  }

  function cerrarSiSePuede() {
    if (dar.isPending) return
    setAbierto(false)
  }

  function intentarDar() {
    const nuevos: Errores = {}
    const venceEn = deCampoDeLima(hasta)
    if (hasta.trim() === '') nuevos.hasta = 'Elige hasta qué día y hora tiene.'
    else if (venceEn === null) nuevos.hasta = 'Esa fecha u hora no es válida.'
    else if (Date.parse(venceEn) <= ahora()) nuevos.hasta = 'Esa fecha ya pasó: elige una futura.'
    if (motivo.trim() === '') nuevos.motivo = 'Escribe por qué se le da más tiempo.'
    setErrores(nuevos)
    if (nuevos.hasta || nuevos.motivo || venceEn === null) {
      enfocarElError()
      return
    }
    dar.mutate({ venceEn, motivo: motivo.trim(), avisar })
  }

  const datos = plazo.data
  if (!datos || !datos.existeIntento) return null
  const sinCompletar = datos.sinCompletar ?? null

  return (
    <div className={estilos.bloque}>
      {sinCompletar ? (
        <>
          <LoQueLeFalto plazo={datos} anunciar />
          {sinCompletar.puedeMover && (
            <div className={estilos.acciones}>
              <button
                type="button"
                className={estilos.principal}
                onClick={abrir}
                disabled={sinCompletar.bloqueo !== null}
                aria-haspopup="dialog"
                aria-describedby={sinCompletar.bloqueo ? `bloqueo-${postulacionId}` : undefined}
              >
                Darle más tiempo
              </button>
              {sinCompletar.bloqueo && (
                <span className={estilos.chip} id={`bloqueo-${postulacionId}`}>
                  {sinCompletar.bloqueo}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        datos.masTiempo &&
        datos.entregadoEn === null && (
          <p className={estilos.rigeHoy} role="status">
            {datos.iniciadoEn ? 'En curso' : 'Sin empezar'}
            {datos.venceEn ? ` · le cierra el ${conDiaDeLaSemanaEnLima(datos.venceEn)}` : ''}
            <span>
              Más tiempo dado el {diaCortoEnLima(datos.masTiempo.dadoEn)} por{' '}
              {datos.masTiempo.dadoPor}: {datos.masTiempo.motivo}
            </span>
          </p>
        )
      )}

      {aplicado && !sinCompletar && (
        <div className={estilos.resultado} role="status">
          <p className={estilos.loQueQueda}>Volvió a «Le toca al candidato».</p>
          <p className={estilos.detalle}>
            {aplicado.avisadoPor.length > 0
              ? `Avisado por ${canalesDichos(aplicado.avisadoPor)}`
              : 'Sin avisarle'}
          </p>
        </div>
      )}

      {sinCompletar && (
        <Modal
          abierto={abierto}
          titulo={`Darle más tiempo a ${candidato}`}
          onCerrar={cerrarSiSePuede}
          pantallaCompleta
          aPruebaDeDobleClic
          pie={
            <div className={estilos.pie}>
              <button
                type="button"
                className={estilos.secundaria}
                onClick={cerrarSiSePuede}
                disabled={dar.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={estilos.principal}
                onClick={intentarDar}
                disabled={dar.isPending}
                aria-busy={dar.isPending}
              >
                {dar.isPending ? 'Guardando…' : 'Darle más tiempo'}
              </button>
            </div>
          }
        >
          <div className={estilos.campos}>
            <LoQueLeFalto plazo={datos} />
            <Campo
              etiqueta="Hasta"
              type="datetime-local"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value)
                if (errores.hasta) setErrores({ ...errores, hasta: undefined })
              }}
              error={errores.hasta}
              disabled={dar.isPending}
            />
            <AreaTexto
              etiqueta="Motivo"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                if (errores.motivo) setErrores({ ...errores, motivo: undefined })
              }}
              error={errores.motivo}
              rows={3}
              disabled={dar.isPending}
            />
            <label className={estilos.casilla}>
              <input
                type="checkbox"
                checked={avisar}
                onChange={(e) => setAvisar(e.target.checked)}
                disabled={dar.isPending}
              />
              Avisar a {nombreDePila(candidato)}
            </label>
            {fallo && (
              <p className={estilos.avisoMalo} role="alert">
                {fallo}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

/** «No la completó · se le acabó el tiempo el 18 nov, 16:40» y, debajo, qué le faltó. */
function LoQueLeFalto({ plazo, anunciar = false }: { plazo: PlazoVigenteDePrueba; anunciar?: boolean }) {
  const sin = plazo.sinCompletar
  if (!sin) return null
  return (
    // Se anuncia en la ficha; dentro de la ventana es el mismo dato repetido y no se vuelve a decir.
    <p className={estilos.rigeHoy} role={anunciar ? 'status' : undefined}>
      No la completó
      {sin.seAcaboEn ? ` · se le acabó el tiempo el ${diaYHoraEnLima(sin.seAcaboEn)}` : ''}
      <span>
        {sin.sinAbrir
          ? 'No la abrió'
          : sin.queFalto
            ? conMayuscula(sin.queFalto)
            : 'Le faltó algo por responder o subir'}
      </span>
    </p>
  )
}
