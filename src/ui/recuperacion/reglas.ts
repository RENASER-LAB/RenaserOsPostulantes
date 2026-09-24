/**
 * «Me olvidé mi contraseña»: los textos que no pueden cambiar entre el portal y
 * el panel, y las reglas de lo que se escribe.
 *
 * Viven juntos porque son la mitad del contrato con el backend. El mensaje de
 * enviado es el MISMO exista o no la cuenta —si cambiara, la pantalla serviría
 * para averiguar qué correos están registrados— y el de enlace que no sirve es
 * uno solo para vencido, usado o reemplazado, porque el backend responde el
 * mismo 401 en los tres casos.
 */

import { z } from 'zod'

/**
 * ⚠️ **Dice «60 minutos» a mano.** La vida del enlace es un parámetro del
 * backend (`minutos_vida_recuperacion`), pero la respuesta de la solicitud es un
 * 202 vacío a propósito y no puede traer el número. Si se cambia allí, se cambia
 * aquí.
 */
export const MENSAJE_ENVIADO =
  'Si ese correo tiene una cuenta, te enviamos un enlace. Revisa también tu carpeta de spam. Vale por 60 minutos.'

/** Lo que tarda en poder pedirse otra vez. El backend además limita a 3 por hora. */
export const SEGUNDOS_PARA_REENVIAR = 60

export const ENLACE_NO_SIRVE = 'Este enlace ya no sirve.'
export const PIDE_UNO_NUEVO = 'Pide uno nuevo.'
export const ENLACE_INCOMPLETO = 'El enlace está incompleto.'
export const COPIALO_ENTERO = 'Cópialo entero desde el correo.'
export const CLAVE_CAMBIADA = 'Contraseña cambiada exitosamente'

export const FALLO_AL_PEDIR =
  'No pudimos enviar tu solicitud. Revisa tu conexión y vuelve a intentarlo.'
export const FALLO_AL_GUARDAR =
  'No pudimos guardar tu contraseña. Revisa tu conexión y vuelve a intentarlo.'

/**
 * El tope de BCrypt, en bytes UTF-8: el backend guarda las contraseñas con él
 * y no acepta ni un byte más (`@CabeEnBcrypt`). Se cuenta en bytes y no en
 * letras —una tilde o una «ñ» ocupan dos, un emoji cuatro—, así que 40 «ñ»
 * pasan el mínimo y no caben.
 */
export const MAXIMO_BYTES_CLAVE = 72

/**
 * El mismo texto que devuelve el backend si le llega una más larga. No habla
 * de bytes: quien la escribe piensa en letras.
 */
export const CLAVE_DEMASIADO_LARGA =
  'La contraseña es demasiado larga. Usa como máximo 72 caracteres; las letras con tilde, la ñ y los emojis cuentan por más de uno.'

const codificador = new TextEncoder()

/** Lo que ocupa la contraseña tal como viaja y como la cifra el backend. */
export function bytesDe(valor: string): number {
  return codificador.encode(valor).length
}

export const EsquemaCorreo = z.object({
  correo: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo.')
    .email('Esto no parece un correo. Revisa que tenga arroba y dominio.'),
})

/**
 * La contraseña nueva y su repetición.
 *
 * El mínimo lo pone quien llama —8 en el portal, 12 en el panel— y es el mismo
 * que aplica el backend: si fuera menor, el envío rebotaría con un error que se
 * pudo evitar sin gastar nada.
 *
 * ⚠️ **Los espacios del principio y del final se avisan, no se recortan.** Casi
 * siempre son un espacio que se coló al pegar, y recortarlo en silencio dejaría
 * a la persona con una contraseña distinta de la que cree haber puesto. El
 * backend lo rechaza igual; aquí se dice antes.
 *
 * Un solo motivo por campo y en este orden: vacío, espacios, corta, demasiado
 * larga. Con varios a la vez, quien escucha el error con un lector de pantalla
 * no sabría cuál arreglar primero.
 */
export function esquemaClaveNueva(minimo: number) {
  return z
    .object({
      contrasena: z.string().superRefine((valor, ctx) => {
        if (valor === '') {
          ctx.addIssue({ code: 'custom', message: 'Escribe tu contraseña nueva.' })
        } else if (valor !== valor.trim()) {
          ctx.addIssue({
            code: 'custom',
            message:
              'La contraseña no puede empezar ni terminar con un espacio. Revisa si se pegó uno de más.',
          })
        } else if (valor.length < minimo) {
          ctx.addIssue({
            code: 'custom',
            message: `La contraseña necesita al menos ${minimo} caracteres.`,
          })
        } else if (bytesDe(valor) > MAXIMO_BYTES_CLAVE) {
          ctx.addIssue({ code: 'custom', message: CLAVE_DEMASIADO_LARGA })
        }
      }),
      repetir: z.string().min(1, 'Repite la contraseña.'),
    })
    .refine((d) => d.repetir === '' || d.contrasena === d.repetir, {
      message: 'Las dos contraseñas no coinciden.',
      path: ['repetir'],
    })
}

export type CamposClaveNueva = z.infer<ReturnType<typeof esquemaClaveNueva>>
