/**
 * La configuración de la prueba (V68), en un panel lateral: lo que se toca una
 * vez y no tiene por qué ocupar el centro del editor.
 *
 *   - **Tiempo**: «Cronometrada» con sus minutos (cinco como mínimo) o «Sin
 *     cronómetro». Ya no hay días.
 *   - **Fecha límite para dar la prueba**: la de la vacante, en hora de Lima.
 *     Obligatoria para publicar. Se puede poner antes de publicar; con la prueba
 *     publicada y gente en la etapa técnica, cambiarla pide un motivo.
 *   - Materiales y herramientas permitidas, opcionales.
 *
 * Con la prueba ya publicada (sin borrador) solo se cambia la fecha: el tiempo
 * y lo demás es contenido, y eso se cambia abriendo un borrador. Sin
 * `editar_vacante`, todo en lectura; las guías «!» se leen igual.
 */

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { EditorDePreguntas as Editor, VersionDePreguntas } from '../../api/preguntasPropias'
import { fijarFechaLimite, guardarDatosDeLaPrueba, type GuardarDatosDeLaPrueba } from '../../api/pruebaPropia'
import { deInstanteALima, deLimaAInstante } from '@/dominio/horaDeLima'
import { Modal } from '@/ui/Modal'
import { falloDe, type Fallo } from './consultas'
import { Guia } from './Guia'
import type { CampoDeLaConfiguracion } from './navegacion'
import { MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

export const GUIA_DEL_TIEMPO =
  'Cronometrada: tiene esos minutos desde que abre la prueba. Si la abre tarde, el reloj se corta en la fecha límite. Sin cronómetro: puede trabajar en ella hasta la fecha límite.'
export const GUIA_DE_LA_FECHA =
  'El día y la hora en que la prueba se cierra para todos: después nadie puede entregar. Es de esta convocatoria y no se copia con la prueba. Para dar más tiempo a una persona, se hace desde su ficha.'

/** Todo lo que guarda `PUT /borrador`, a partir de lo guardado y lo que cambia. */
export function datosDeLaPrueba(
  v: VersionDePreguntas | null,
  cambios: Partial<GuardarDatosDeLaPrueba> = {},
): GuardarDatosDeLaPrueba {
  const p = v?.prueba
  return {
    guiaCalificacion: v?.guiaCalificacion ?? null,
    enunciado: p?.enunciado ?? null,
    materiales: p?.materiales ?? null,
    herramientasPermitidas: p?.herramientasPermitidas ?? null,
    modalidad: p?.modalidad ?? null,
    duracionMinutos: p?.modalidad === 'CRONOMETRADA' ? (p.duracionMinutos ?? null) : null,
    ...cambios,
  }
}

/**
 * Lo que el servidor rechazaría de la fecha, dicho **antes de guardar nada**.
 *
 * «Listo» guarda en dos pasos: primero el tiempo y lo demás (`PUT /borrador`) y
 * después la fecha (`PUT /fecha-limite`). Si la fecha se rechazara en el segundo,
 * los minutos ya estarían guardados y el panel diría otra cosa (QA-02). Con
 * esto, lo que falla de la fecha frena el guardado entero. Los textos son los
 * del servidor.
 */
export function faltasDeLaFecha(fecha: string, motivo: string, pideMotivo: boolean, ahora: number = Date.now()): string[] {
  if (fecha.trim() === '') return ['La fecha límite no se quita: es obligatoria para publicar. Pon otra.']
  const faltas: string[] = []
  const instante = deLimaAInstante(fecha)
  if (instante === null) faltas.push('Esa fecha no existe. Revísala.')
  else if (new Date(instante).getTime() <= ahora) faltas.push('Esa fecha ya pasó: la fecha límite tiene que ser futura.')
  if (pideMotivo && motivo.trim() === '') {
    faltas.push('Hay personas en la etapa técnica: cambiar la fecha pide un motivo, que queda registrado.')
  }
  return faltas
}

interface Props {
  editor: Editor
  abierta: boolean
  /** El campo que se enfoca al abrir: el que lleva la falta pulsada. */
  campo: CampoDeLaConfiguracion | null
  alCerrar: () => void
  alGuardar: (editor: Editor) => void
}

export function ConfiguracionDeLaPrueba({ editor, abierta, campo, alCerrar, alGuardar }: Props) {
  return (
    <Modal
      abierto={abierta}
      titulo="Configuración de la prueba"
      onCerrar={alCerrar}
      lateral
      sinPie
    >
      {abierta && <Contenido editor={editor} campo={campo} alCerrar={alCerrar} alGuardar={alGuardar} />}
    </Modal>
  )
}

function Contenido({
  editor,
  campo,
  alCerrar,
  alGuardar,
}: {
  editor: Editor
  campo: CampoDeLaConfiguracion | null
  alCerrar: () => void
  alGuardar: (editor: Editor) => void
}) {
  const borrador = editor.borrador
  const base = borrador ?? editor.publicada
  const prueba = base?.prueba ?? null
  // El tiempo y lo demás es contenido: con la prueba ya publicada se cambia abriendo un borrador.
  const contenidoEditable = editor.puedeEditar && (borrador !== null || editor.publicada === null)
  const fechaEditable = editor.puedeEditar
  const cierraEn = editor.fechaLimite?.cierraEn ?? null
  const pideMotivo = editor.fechaLimite?.pideMotivo ?? false

  const guardados = {
    modalidad: prueba?.modalidad ?? '',
    minutos: prueba?.duracionMinutos == null ? '' : String(prueba.duracionMinutos),
    materiales: prueba?.materiales ?? '',
    herramientas: prueba?.herramientasPermitidas ?? '',
  }
  const [datos, setDatos] = useState(guardados)
  const fechaGuardada = cierraEn ? deInstanteALima(cierraEn) : ''
  const [fecha, setFecha] = useState(fechaGuardada)
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<Fallo | null>(null)

  // Al abrir desde una falta, el cursor va al campo que la arregla.
  useEffect(() => {
    if (campo === null) return
    const delTiempo: Record<string, string> = {
      CRONOMETRADA: 'configuracion-minutos',
      PLAZO_ABIERTO: 'configuracion-sin-cronometro',
    }
    const id = campo === 'fecha' ? 'configuracion-fecha' : (delTiempo[guardados.modalidad] ?? 'configuracion-cronometrada')
    document.getElementById(id)?.focus()
    // Solo al abrir: después el foco es de quien escribe.
  }, [])

  const cambioElContenido = JSON.stringify(datos) !== JSON.stringify(guardados)
  const cambioLaFecha = fecha !== fechaGuardada

  const guardado = useMutation({
    mutationFn: async () => {
      if (contenidoEditable && cambioElContenido) {
        // Lo guardado se enseña en cuanto el servidor lo acepta: si la fecha falla
        // después, la cabecera y este panel ya dicen lo que quedó (QA-02), y el
        // siguiente «Listo» solo reintenta la fecha.
        alGuardar(
          await guardarDatosDeLaPrueba(
            editor.vacanteId,
            datosDeLaPrueba(base, {
              modalidad: (datos.modalidad || null) as GuardarDatosDeLaPrueba['modalidad'],
              duracionMinutos:
                datos.modalidad === 'CRONOMETRADA' && datos.minutos.trim() ? Number(datos.minutos) : null,
              materiales: datos.materiales.trim() || null,
              herramientasPermitidas: datos.herramientas.trim() || null,
            }),
          ),
        )
      }
      if (fechaEditable && cambioLaFecha) {
        const instante = deLimaAInstante(fecha)
        if (instante === null) throw new Error('Esa fecha no existe. Revísala.')
        alGuardar(await fijarFechaLimite(editor.vacanteId, { cierraEn: instante, motivo: motivo.trim() || null }))
      }
    },
    onSuccess: () => {
      setFallo(null)
      alCerrar()
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar la configuración.')),
  })

  const campoDe = (clave: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((v) => ({ ...v, [clave]: e.target.value }))

  return (
    <form
      className={estilos.configuracion}
      aria-label="Configuración de la prueba"
      onSubmit={(e) => {
        e.preventDefault()
        if (!cambioElContenido && !cambioLaFecha) {
          alCerrar()
          return
        }
        const faltas = fechaEditable && cambioLaFecha ? faltasDeLaFecha(fecha, motivo, pideMotivo) : []
        if (faltas.length > 0) {
          setFallo({ mensaje: 'La fecha límite no se guardó.', faltas, sinPermiso: false })
          return
        }
        guardado.mutate()
      }}
    >
      {!editor.puedeEditar && (
        <p className={estilos.cartel}>La ves en lectura: cambiarla pide el permiso de editar esta vacante.</p>
      )}
      {editor.puedeEditar && !contenidoEditable && (
        <p className={estilos.ayuda}>
          La prueba ya está publicada: aquí solo se cambia la fecha. El tiempo y los materiales se
          cambian abriendo un borrador.
        </p>
      )}

      <fieldset className={estilos.grupoOpciones}>
        <legend className={estilos.etiquetaConGuia}>
          <span className={estilos.etiqueta}>Tiempo</span>
          <Guia de="Tiempo" texto={GUIA_DEL_TIEMPO} />
        </legend>
        <div className={estilos.casilla}>
          <label className={estilos.casilla}>
            <input
              id="configuracion-cronometrada"
              type="radio"
              name="modalidad"
              value="CRONOMETRADA"
              checked={datos.modalidad === 'CRONOMETRADA'}
              onChange={campoDe('modalidad')}
              disabled={!contenidoEditable}
            />
            <span>Cronometrada</span>
          </label>
          <input
            id="configuracion-minutos"
            className={estilos.entradaPuntos}
            type="number"
            inputMode="numeric"
            min={5}
            step={1}
            aria-label="Minutos"
            value={datos.minutos}
            onChange={campoDe('minutos')}
            onFocus={() => contenidoEditable && setDatos((v) => ({ ...v, modalidad: 'CRONOMETRADA' }))}
            readOnly={!contenidoEditable}
          />
          <span>min</span>
        </div>
        <label className={estilos.casilla}>
          <input
            id="configuracion-sin-cronometro"
            type="radio"
            name="modalidad"
            value="PLAZO_ABIERTO"
            checked={datos.modalidad === 'PLAZO_ABIERTO'}
            onChange={campoDe('modalidad')}
            disabled={!contenidoEditable}
          />
          <span>Sin cronómetro</span>
        </label>
      </fieldset>

      <div className={estilos.campo}>
        <span className={estilos.etiquetaConGuia}>
          <label className={estilos.etiqueta} htmlFor="configuracion-fecha">
            Fecha límite para dar la prueba
          </label>
          <Guia de="Fecha límite" texto={GUIA_DE_LA_FECHA} />
        </span>
        <input
          id="configuracion-fecha"
          className={estilos.entrada}
          type="datetime-local"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          readOnly={!fechaEditable}
        />
        {fecha.trim() === '' && <p className={estilos.obligatoriaParaPublicar}>Obligatoria para publicar la prueba</p>}
      </div>
      {fechaEditable && pideMotivo && cambioLaFecha && (
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Motivo del cambio · queda registrado</span>
          <textarea
            className={estilos.area}
            rows={2}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <span className={estilos.ayuda}>
            Hay personas en la etapa técnica: la fecha nueva se les aplica a quienes no tienen un
            plazo propio.
          </span>
        </label>
      )}

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Materiales <span className={estilos.cuenta}>(opcional)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={3}
          maxLength={2000}
          value={datos.materiales}
          onChange={campoDe('materiales')}
          readOnly={!contenidoEditable}
        />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Herramientas permitidas <span className={estilos.cuenta}>(opcional)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={2}
          maxLength={1000}
          value={datos.herramientas}
          onChange={campoDe('herramientas')}
          readOnly={!contenidoEditable}
        />
      </label>

      <MostrarFallo fallo={fallo} />
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending}>
          {guardado.isPending ? 'Guardando…' : 'Listo'}
        </button>
      </div>
    </form>
  )
}
