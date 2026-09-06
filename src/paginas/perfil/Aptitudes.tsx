/**
 * Lo que sabes hacer, como etiquetas.
 *
 * Antes era un `<input>` donde había que escribir «Excel avanzado, Power BI,
 * gestión de procesos» separando con comas, y el resultado dependía de que la
 * persona acertara con la puntuación: quien escribiera «Excel, avanzado» acababa
 * con dos aptitudes que no significan nada.
 *
 * ⚠️ **La coma sigue funcionando, y es a propósito.** Mucha gente pega su lista
 * desde un currículum de una sola línea; convertirla en etiquetas al pegar es el
 * caso que más se usa. Enter y coma hacen lo mismo.
 *
 * ⚠️ **El campo NO se vacía si queda texto a medias.** Escribir «Power BI» y
 * darle a Guardar sin pulsar Enter perdería esa última aptitud sin decir nada:
 * quien lo usa lee lo que ve, y lo que ve dice «Power BI». Lo recoge `leerTodas`.
 */

import { useRef, useState, type KeyboardEvent } from 'react'
import { IconoMas } from '@/ui/Iconos'
import estilos from './Aptitudes.module.css'

/** Al pegar una lista entera, cada coma es una aptitud. */
function separar(texto: string): string[] {
  return texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** «Excel» y «excel» son la misma: sin distinguir mayúsculas ni acentos. */
function esLaMisma(a: string, b: string): boolean {
  return a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0
}

/**
 * Lo que queda escrito sin haber pulsado Enter cuenta como una más.
 *
 * ⚠️ **Y se parte por comas igual que al pulsar Enter.** El caso que más se da es
 * pegar la lista de un currículum de una sola línea; si aquí no se partiera, quien
 * pega «Excel avanzado, Power BI, SQL» y le da a Guardar sin pulsar Enter se
 * guardaría UNA aptitud con comas dentro, que no la encuentra ninguna búsqueda.
 * Enter, coma y Guardar tienen que entender lo mismo.
 */
export function leerTodas(etiquetas: string[], pendiente: string): string[] {
  const resultado = [...etiquetas]
  for (const nueva of separar(pendiente)) {
    if (!resultado.some((e) => esLaMisma(e, nueva))) {
      resultado.push(nueva)
    }
  }
  return resultado
}

export function Aptitudes({
  etiquetas,
  onCambiar,
  pendiente,
  onPendiente,
}: {
  etiquetas: string[]
  onCambiar: (etiquetas: string[]) => void
  /** Lo que hay escrito y sin confirmar. Vive fuera para que Guardar lo vea. */
  pendiente: string
  onPendiente: (texto: string) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function anadir(texto: string) {
    const nuevas = separar(texto)
    if (nuevas.length === 0) return

    const repetidas: string[] = []
    const resultado = [...etiquetas]
    for (const nueva of nuevas) {
      if (resultado.some((e) => esLaMisma(e, nueva))) repetidas.push(nueva)
      else resultado.push(nueva)
    }
    onCambiar(resultado)
    onPendiente('')
    setAviso(
      repetidas.length > 0
        ? `Ya tenías ${repetidas.join(', ')}.`
        : `Añadida${nuevas.length === 1 ? '' : 's'} ${nuevas.join(', ')}.`,
    )
  }

  function quitar(etiqueta: string) {
    onCambiar(etiquetas.filter((e) => e !== etiqueta))
    setAviso(`Quitada ${etiqueta}.`)
    entrada.current?.focus()
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter' || evento.key === ',') {
      // Enter dentro de un formulario lo envía: aquí solo tiene que cerrar la
      // etiqueta. Sin esto, escribir una aptitud guardaba el perfil entero.
      evento.preventDefault()
      anadir(pendiente)
      return
    }
    // Retroceso con el campo vacío borra la última, como en cualquier campo de
    // etiquetas. Es lo que espera quien ya usó uno.
    if (evento.key === 'Backspace' && pendiente === '' && etiquetas.length > 0) {
      quitar(etiquetas[etiquetas.length - 1]!)
    }
  }

  return (
    <div className={estilos.campo}>
      <span className={estilos.etiqueta} id="etiqueta-aptitudes">
        Lo que sabes hacer
      </span>
      <p className={estilos.ayuda} id="ayuda-aptitudes">
        Escribe una y pulsa Enter. También puedes pegar una lista separada por comas.
      </p>

      {etiquetas.length > 0 && (
        <ul className={estilos.lista} role="list">
          {etiquetas.map((etiqueta) => (
            <li key={etiqueta} className={estilos.chip}>
              {etiqueta}
              <button
                type="button"
                className={estilos.quitar}
                onClick={() => quitar(etiqueta)}
                /* El nombre lleva la aptitud dentro: doce botones «Quitar» son
                   doce entradas idénticas en la lista de un lector de pantalla. */
                aria-label={`Quitar ${etiqueta}`}
              >
                <IconoMas tamano={14} className={estilos.aspa} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={estilos.entrada}>
        <input
          ref={entrada}
          type="text"
          value={pendiente}
          onChange={(e) => onPendiente(e.target.value)}
          onKeyDown={alTeclear}
          aria-labelledby="etiqueta-aptitudes"
          aria-describedby="ayuda-aptitudes"
          placeholder="Excel avanzado"
        />
        <button
          type="button"
          className={estilos.anadir}
          onClick={() => anadir(pendiente)}
          disabled={pendiente.trim() === ''}
        >
          Añadir
        </button>
      </div>

      {/*
        Sin esto, quitar una etiqueta con el teclado no se anuncia: el chip
        desaparece y el foco vuelve al campo sin que nadie diga qué pasó.
      */}
      <p className={estilos.soloLectores} aria-live="polite">
        {aviso ?? ''}
      </p>
    </div>
  )
}
