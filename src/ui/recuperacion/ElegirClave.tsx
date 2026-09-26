/**
 * Elegir la contraseña nueva con el enlace del correo. Lo usan el portal
 * (`/restablecer`, mínimo 8) y el panel (`/admin/restablecer`, mínimo 12).
 *
 * Lo que no puede cambiar al reescribirla:
 *
 *   - **El token sale de la barra al cargar**, con `replace`: vale lo mismo que
 *     una contraseña durante una hora y no tiene por qué quedarse en la barra,
 *     en el historial ni en la cabecera `Referer`. Se guarda en el estado de la
 *     pantalla y viaja solo en el cuerpo de la petición.
 *   - **Abrir la pantalla no gasta el enlace.** Los clientes de correo precargan
 *     los enlaces; solo lo gasta guardar la contraseña.
 *   - **Un enlace que no sirve se dice una sola vez y igual para todo**: vencido,
 *     usado o reemplazado dan el mismo 401 y la misma frase.
 *   - **Las reglas se comprueban aquí antes de llamar**, y un 400 del servidor
 *     —la misma contraseña de antes— va al campo: ninguno de los dos gasta el
 *     enlace, así que se puede corregir y volver a intentar.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import { Campo } from '@/ui/campos/Campo'
import { IconoAviso } from '@/ui/Iconos'
import {
  COPIALO_ENTERO,
  ENLACE_INCOMPLETO,
  ENLACE_NO_SIRVE,
  FALLO_AL_GUARDAR,
  PIDE_UNO_NUEVO,
  esquemaClaveNueva,
  type CamposClaveNueva,
} from './reglas'
import estilos from './Recuperacion.module.css'

interface Props {
  /** 8 en el portal, 12 en el panel: el mismo mínimo que el backend. */
  minimo: number
  /** Por qué ese mínimo, en palabras de su puerta. */
  ayuda: string
  /** La llamada de su puerta: `restablecerClave` o `restablecerClavePanel`. */
  restablecer: (datos: { token: string; contrasena: string }) => Promise<unknown>
  /** A dónde lleva «Pedir un enlace nuevo»: la pantalla de pedir de su puerta. */
  rutaPedirEnlace: string
  /** Cuando la contraseña ya cambió: cada puerta lleva a su pantalla de entrar. */
  alCambiar: () => void
  /*
   * Aquí había `claseFormulario`, la superficie que cada puerta le ponía al
   * formulario. Se fue el 25/09/2026: esta pieza se pinta ahora DENTRO de una
   * tarjeta que pone cada pantalla, y una superficie dentro de otra no separa
   * nada. Ver `Recuperacion.module.css`.
   */
}

type Errores = Partial<Record<keyof CamposClaveNueva, string>>
const VACIO: CamposClaveNueva = { contrasena: '', repetir: '' }

export function ElegirClave({
  minimo,
  ayuda,
  restablecer,
  rutaPedirEnlace,
  alCambiar,
}: Props) {
  const [parametros, setParametros] = useSearchParams()
  // Se lee una vez, al montar: en cuanto la barra se limpia, la dirección ya no
  // lo tiene y el estado es el único sitio donde queda.
  const [token] = useState(() => parametros.get('token')?.trim() ?? '')
  const [enlaceRoto, setEnlaceRoto] = useState(false)
  const [valores, setValores] = useState<CamposClaveNueva>(VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)
  const titular = useRef<HTMLHeadingElement>(null)
  const esquema = useMemo(() => esquemaClaveNueva(minimo), [minimo])

  useEffect(() => {
    // replace: la entrada con el token no queda en el historial, así que ni el
    // botón de atrás ni el historial lo devuelven a la barra.
    if (parametros.has('token')) setParametros(new URLSearchParams(), { replace: true })
  }, [parametros, setParametros])

  // Al saber que el enlace no sirve, el foco va al titular que lo dice.
  useEffect(() => {
    if (enlaceRoto) titular.current?.focus()
  }, [enlaceRoto])

  function cambiar<C extends keyof CamposClaveNueva>(campo: C, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  function enfocarElPrimerError() {
    // Sin el cuadro, el atributo todavía no está en el DOM cuando se busca.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enCurso.current) return
    setFallo(null)

    const revision = esquema.safeParse(valores)
    if (!revision.success) {
      const nuevos: Errores = {}
      for (const problema of revision.error.issues) {
        const campo = problema.path[0] as keyof CamposClaveNueva
        nuevos[campo] ??= problema.message
      }
      setErrores(nuevos)
      enfocarElPrimerError()
      return
    }

    enCurso.current = true
    setEnviando(true)
    try {
      await restablecer({ token, contrasena: revision.data.contrasena })
      alCambiar()
    } catch (causa) {
      if (causa instanceof ErrorApi && causa.estado === 401) {
        setEnlaceRoto(true)
      } else if (causa instanceof ErrorApi && causa.estado === 400) {
        // La regla que el servidor sabe y la pantalla no: la misma contraseña de
        // antes. Va al campo, como las demás, y el enlace sigue sirviendo.
        setErrores({ contrasena: causa.message })
        enfocarElPrimerError()
      } else {
        setFallo(FALLO_AL_GUARDAR)
      }
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  if (token === '' || enlaceRoto) {
    return (
      <>
        <h1 ref={titular} className={estilos.titular} tabIndex={-1}>
          {token === '' ? ENLACE_INCOMPLETO : ENLACE_NO_SIRVE}
        </h1>
        <p className={estilos.bajada}>
          {token === ''
            ? `${COPIALO_ENTERO} A veces se corta al pegarlo, sobre todo si ocupaba más de una línea.`
            : `${PIDE_UNO_NUEVO} Cada enlace sirve una sola vez y durante 60 minutos, y al pedir otro el anterior deja de funcionar.`}
        </p>
        <Link className={estilos.enlaceSecundario} to={rutaPedirEnlace}>
          Pedir un enlace nuevo
        </Link>
      </>
    )
  }

  return (
    <>
      <h1 className={estilos.titular}>Elige una contraseña nueva.</h1>
      <p className={estilos.bajada}>
        Es la que vas a usar para entrar a partir de ahora. Cuando la guardes, te llevamos a
        la pantalla de entrar.
      </p>

      <form
        className={estilos.formulario}
        onSubmit={alEnviar}
        noValidate
      >
        <fieldset className={estilos.grupo} disabled={enviando}>
          <Campo
            etiqueta="Contraseña nueva"
            ayuda={ayuda}
            type="password"
            autoComplete="new-password"
            value={valores.contrasena}
            onChange={(e) => cambiar('contrasena', e.target.value)}
            error={errores.contrasena}
          />
          <Campo
            etiqueta="Repetir contraseña"
            type="password"
            autoComplete="new-password"
            value={valores.repetir}
            onChange={(e) => cambiar('repetir', e.target.value)}
            error={errores.repetir}
          />

          {fallo && (
            <p className={estilos.fallo} role="alert">
              <IconoAviso tamano={18} />
              {fallo}
            </p>
          )}

          <button type="submit" className={estilos.enviar}>
            {enviando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </fieldset>
      </form>
    </>
  )
}
