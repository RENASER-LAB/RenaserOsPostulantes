/**
 * El campo del celular, con su máscara: el mismo en el registro, «Mi cuenta», la
 * tarjeta de WhatsApp y la ficha del colaborador del panel (spec «Celular con
 * formato 999 999 999»).
 *
 * Es `Campo` con el «+51» delante, y encima la máscara de `mascaraCelular`: solo
 * cifras, de tres en tres y sin décima; con «+» delante, el número de otro país, y
 * entonces el «+51» se esconde. Lo que se pega se lee entero, y si no es un celular
 * el campo no cambia y dice el mensaje de la regla.
 *
 * Quien lo usa guarda el texto tal cual lo deja la máscara («987 654 321», o «+34 612
 * 345 678») y sigue validando al enviar con `comoE164`: un número a medias o uno que no
 * empieza por 9 se escriben, y se avisan al enviar.
 *
 * ⚠️ **El cursor se coloca aquí, en el mismo evento.** Se escribe en el `<input>` el
 * valor ya enmascarado antes de que React lo pinte: así React lo encuentra igual y no
 * lo toca, y el cursor se queda donde la persona estaba en vez de saltar al final.
 */

import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { MENSAJE_CELULAR } from '@/dominio/celular'
import { Campo } from './Campo'
import { desdeAntiguo, enmascarar, esInternacional } from './mascaraCelular'

/** El prefijo que se dibuja delante de un celular peruano. */
export const PREFIJO_PERU = '+51'

type Nativos = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode' | 'maxLength'
>

interface PropsCampoCelular extends Nativos {
  etiqueta: string
  /** Lo escrito, tal como lo deja la máscara. */
  valor: string
  alCambiar: (valor: string) => void
  error?: string
  obligatorio?: boolean
  /**
   * Un celular guardado antes de esta regla que no la cumple. Mientras el campo lo
   * tenga, se enseña tal cual, sin máscara ni «+51»; en cuanto se toca, se aplica.
   */
  antiguo?: string | null
}

export const CampoCelular = forwardRef<HTMLInputElement, PropsCampoCelular>(function CampoCelular(
  { etiqueta, valor, alCambiar, error, antiguo, placeholder = '987 654 321', ...resto },
  ref,
) {
  // El mensaje de un pegado que no se pudo leer, atado al error que había entonces:
  // si quien usa el campo pone otro —al enviar—, se ve el suyo, que es más nuevo.
  const [aviso, setAviso] = useState<{ junto: string | undefined } | null>(null)
  const sinMascara = Boolean(antiguo) && valor === antiguo
  const conPrefijo = !sinMascara && !esInternacional(valor)

  function cambiar(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.currentTarget
    const nativo = evento.nativeEvent
    const cambio = {
      anterior: valor,
      escrito: campo.value,
      cursor: campo.selectionStart ?? campo.value.length,
      tipo: 'inputType' in nativo ? (nativo as InputEvent).inputType : undefined,
    }
    const resultado = sinMascara ? desdeAntiguo(cambio) : enmascarar(cambio)
    campo.value = resultado.acepta ? resultado.valor : valor
    // Solo con el foco dentro: el autocompletado puede llegar con el campo sin foco, y
    // colocar el cursor ahí se lo daría en algunos navegadores.
    if (campo.ownerDocument.activeElement === campo) {
      campo.setSelectionRange(resultado.cursor, resultado.cursor)
    }
    if (!resultado.acepta) {
      if (resultado.aviso) setAviso({ junto: error })
      return
    }
    setAviso(null)
    if (resultado.valor !== valor) alCambiar(resultado.valor)
  }

  return (
    <Campo
      {...resto}
      ref={ref}
      etiqueta={etiqueta}
      // Teclado de teléfono en el móvil: cifras y el «+».
      type="tel"
      inputMode="tel"
      prefijo={conPrefijo ? PREFIJO_PERU : ''}
      placeholder={placeholder}
      value={valor}
      onChange={cambiar}
      error={aviso && aviso.junto === error ? MENSAJE_CELULAR : error}
    />
  )
})
