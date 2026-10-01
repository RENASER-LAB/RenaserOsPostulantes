/**
 * Escribir una pregunta: el tipo, el enunciado, los puntos, su criterio y, segun
 * el tipo, lo que debe tener una buena respuesta o sus opciones y niveles.
 *
 * Lo mismo sirve para una pregunta nueva y para corregir una del borrador: se
 * abre en su sitio, dentro del criterio, y no en una ventana aparte.
 *
 * Los puntos se escriben en enteros. Si alguien pone decimales no se redondea
 * aqui: el servidor lo rechaza con la lista de lo que falta, que es la misma que
 * se pinta al publicar.
 */

import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  agregarPregunta,
  editarPregunta,
  type CriterioDeLaVersion,
  type EditorDePreguntas,
  type TipoDePreguntaPropia,
} from '../../api/preguntasPropias'
import { IconoCruz, IconoMas } from '@/ui/Iconos'
import { falloDe, type Fallo } from './consultas'
import {
  TIPOS,
  conOtroTipo,
  esCerrada,
  faltaEvidente,
  paraGuardar,
  type PreguntaEnEdicion,
} from './formulario'
import { esPrueba, useModoDelEditor } from './modo'
import { BotonIcono, MostrarFallo } from './piezas'
import estilos from './EditorDePreguntas.module.css'

interface Props {
  vacanteId: number
  /** Nula para una pregunta nueva. */
  preguntaId: number | null
  inicial: PreguntaEnEdicion
  criterios: CriterioDeLaVersion[]
  alGuardar: (editor: EditorDePreguntas) => void
  alCancelar: () => void
}

export function FormularioPregunta({
  vacanteId,
  preguntaId,
  inicial,
  criterios,
  alGuardar,
  alCancelar,
}: Props) {
  const id = useId()
  const modo = useModoDelEditor()
  // En la prueba (V67) la abierta no lleva puntos: la califica el criterio entero.
  const sinPuntosEnAbiertas = esPrueba(modo)
  const [p, setP] = useState<PreguntaEnEdicion>(inicial)
  const [fallo, setFallo] = useState<Fallo | null>(null)

  const guardado = useMutation({
    mutationFn: () =>
      preguntaId === null
        ? agregarPregunta(vacanteId, paraGuardar(p, sinPuntosEnAbiertas), modo.ruta)
        : editarPregunta(vacanteId, preguntaId, paraGuardar(p, sinPuntosEnAbiertas), modo.ruta),
    onSuccess: (editor) => {
      setFallo(null)
      alGuardar(editor)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar la pregunta.')),
  })

  const cerrada = esCerrada(p.tipo)
  const escala = p.tipo === 'ESCALA'
  const minimo = escala ? 3 : 2
  const evidente = faltaEvidente(p, sinPuntosEnAbiertas)
  const conPuntos = !(sinPuntosEnAbiertas && p.tipo === 'ABIERTA')

  const opcion = (i: number, campo: 'texto' | 'puntos', valor: string) =>
    setP((v) => ({
      ...v,
      opciones: v.opciones.map((o, j) => (j === i ? { ...o, [campo]: valor } : o)),
    }))

  return (
    <form
      className={estilos.formulario}
      aria-label={preguntaId === null ? 'Pregunta nueva' : 'Corregir la pregunta'}
      onSubmit={(e) => {
        e.preventDefault()
        if (!evidente) guardado.mutate()
      }}
    >
      <div className={estilos.filaFormulario}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Tipo</span>
          <select
            className={estilos.eleccion}
            value={p.tipo}
            onChange={(e) => setP((v) => conOtroTipo(v, e.target.value as TipoDePreguntaPropia))}
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        {conPuntos && (
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Puntos</span>
            <input
              className={estilos.entradaPuntos}
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              max={100}
              value={p.puntos}
              onChange={(e) => setP((v) => ({ ...v, puntos: e.target.value }))}
            />
          </label>
        )}
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Criterio</span>
          <select
            className={estilos.eleccion}
            value={p.criterioId ?? ''}
            onChange={(e) =>
              setP((v) => ({ ...v, criterioId: e.target.value === '' ? null : Number(e.target.value) }))
            }
          >
            {criterios.length === 0 && <option value="">«General» (se crea solo)</option>}
            {criterios.length > 0 && <option value="">Sin criterio</option>}
            {criterios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>Enunciado</span>
        <textarea
          className={estilos.area}
          rows={3}
          maxLength={2000}
          value={p.enunciado}
          onChange={(e) => setP((v) => ({ ...v, enunciado: e.target.value }))}
        />
      </label>

      {p.tipo === 'ABIERTA' && (
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>
            Qué debe tener una buena respuesta{' '}
            <span className={estilos.cuenta}>(opcional · {p.queDebeTener.length} de 1000)</span>
          </span>
          <textarea
            className={estilos.area}
            rows={2}
            maxLength={1000}
            value={p.queDebeTener}
            onChange={(e) => setP((v) => ({ ...v, queDebeTener: e.target.value }))}
          />
          <span className={estilos.ayuda}>
            {sinPuntosEnAbiertas
              ? 'En la prueba, una abierta no lleva puntos: la IA o una persona califican la parte calificada de su criterio mirando la respuesta y esto.'
              : 'Llega a la IA cuando califica. Con 0 puntos, la respuesta se guarda y se ve, pero no se manda a la IA.'}
          </span>
        </label>
      )}

      {cerrada && (
        <fieldset className={estilos.grupoOpciones}>
          <legend className={estilos.etiqueta}>
            {escala ? 'Niveles, del menor al mayor' : 'Opciones'}
          </legend>
          {p.tipo === 'OPCION_MULTIPLE' && (
            <p className={estilos.ayuda}>
              Se suma lo marcado, sin bajar de 0 ni pasar de los puntos de la pregunta. Una opción
              puede restar para castigar marcar lo que no va.
            </p>
          )}
          {p.opciones.map((o, i) => (
            <div className={estilos.filaOpcion} key={i}>
              {escala && <span className={estilos.nivel}>Nivel {i + 1}</span>}
              <input
                className={estilos.entrada}
                type="text"
                maxLength={500}
                aria-label={escala ? `Rótulo del nivel ${i + 1} (opcional)` : `Opción ${i + 1}`}
                placeholder={escala ? (i === 0 ? 'Nada (opcional)' : 'Rótulo (opcional)') : `Opción ${i + 1}`}
                value={o.texto}
                onChange={(e) => opcion(i, 'texto', e.target.value)}
              />
              <input
                className={estilos.entradaPuntos}
                type="number"
                inputMode="numeric"
                step={1}
                aria-label={escala ? `Puntos del nivel ${i + 1}` : `Puntos de la opción ${i + 1}`}
                id={`${id}-puntos-${i}`}
                value={o.puntos}
                onChange={(e) => opcion(i, 'puntos', e.target.value)}
              />
              <BotonIcono
                etiqueta={`Quitar ${escala ? `el nivel ${i + 1}` : `la opción ${i + 1}`}`}
                onClick={() =>
                  setP((v) => ({ ...v, opciones: v.opciones.filter((_, j) => j !== i) }))
                }
                disabled={p.opciones.length <= minimo}
              >
                <IconoCruz tamano={18} />
              </BotonIcono>
            </div>
          ))}
          {p.opciones.length < 10 && (
            <button
              className={estilos.secundarioPequeno}
              type="button"
              onClick={() =>
                setP((v) => ({
                  ...v,
                  opciones: [...v.opciones, { texto: '', puntos: '0' }],
                }))
              }
            >
              <IconoMas tamano={18} />
              {escala ? 'Agregar nivel' : 'Agregar opción'}
            </button>
          )}
          {!escala && (
            <p className={estilos.ayuda}>
              {p.tipo === 'OPCION_UNICA'
                ? 'Se lleva los puntos de la opción elegida: alguna tiene que dar los puntos de la pregunta, y ninguna restar.'
                : 'Entre 2 y 10 opciones.'}
            </p>
          )}
          {escala && (
            <p className={estilos.ayuda}>
              Entre 3 y 10 niveles. Se lleva los puntos del nivel elegido: alguno tiene que dar los
              puntos de la pregunta.
            </p>
          )}
        </fieldset>
      )}

      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending || !!evidente}>
          {guardado.isPending ? 'Guardando…' : preguntaId === null ? 'Agregar la pregunta' : 'Guardar la pregunta'}
        </button>
        <button
          className={estilos.secundario}
          type="button"
          onClick={alCancelar}
          disabled={guardado.isPending}
        >
          Cancelar
        </button>
      </div>
      {evidente && p.enunciado.trim() !== '' && <p className={estilos.ayuda}>{evidente}</p>}
      <MostrarFallo fallo={fallo} />
    </form>
  )
}
