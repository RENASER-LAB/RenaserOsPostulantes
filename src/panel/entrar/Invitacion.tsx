/**
 * Aceptar la invitación al panel.
 *
 * Es la única forma de que nazca una cuenta de equipo: el panel no tiene
 * registro público. Alguien que ya está dentro invita por correo, y el enlace
 * de ese correo trae un token de un solo uso que se canjea aquí poniendo el
 * nombre y una contraseña.
 *
 * ⚠️ **El token viaja en el cuerpo, nunca en la dirección de la API.** En la
 * barra ya está —viene del correo y no hay otra forma—, pero de ahí no puede
 * pasar a una petición: acabaría en los registros del servidor y en la cabecera
 * `Referer` de cualquier recurso externo.
 *
 * ⚠️ **Esta pantalla NO puede vivir dentro del armazón del panel.** Ese armazón
 * manda a `/admin/entrar` a quien no tiene sesión, y quien viene de una
 * invitación es justo eso: alguien sin sesión todavía.
 *
 * ⚠️ **La contraseña exige 12 caracteres, no 8.** Es la regla del backend y
 * tiene motivo: una cuenta de equipo ve los datos de mucha gente. Si el mínimo
 * de aquí fuera menor, el envío rebotaría con un error que se pudo evitar.
 *
 * Vencida, usada o revocada dan **el mismo error genérico**, a propósito:
 * distinguirlas le diría a quien prueba enlaces cuál de sus intentos acertó.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { rutas } from '@/rutas'
import { Marca } from '@/ui/Marca'
import { Campo } from '@/ui/campos/Campo'
import { useSesionPanel } from '../Sesion'
import { useTituloDelPanel } from '../titulo'
import estilos from './Entrar.module.css'

/** El mismo mínimo que aplica el backend. Ver la cabecera. */
const MINIMO_CONTRASENA = 12

const Datos = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe tu nombre.'),
    apellidos: z.string().trim().min(1, 'Escribe tus apellidos.'),
    contrasena: z
      .string()
      .min(
        MINIMO_CONTRASENA,
        `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`,
      ),
    repetir: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((d) => d.contrasena === d.repetir, {
    message: 'Las dos contraseñas no coinciden.',
    path: ['repetir'],
  })

type Campos = z.infer<typeof Datos>
type Errores = Partial<Record<keyof Campos, string>>

const VACIO: Campos = { nombre: '', apellidos: '', contrasena: '', repetir: '' }

export function InvitacionPanel() {
  useTituloDelPanel('Crear mi acceso')
  const [parametros] = useSearchParams()
  const token = parametros.get('token') ?? ''
  const { aceptar } = useSesionPanel()
  const navegar = useNavigate()

  const [valores, setValores] = useState<Campos>(VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function cambiar<C extends keyof Campos>(campo: C, valor: Campos[C]) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  // Sin token no hay nada que canjear, y el formulario solo serviria para
  // perder lo escrito al pulsar. Se dice antes de que nadie escriba.
  if (token === '') {
    return (
      <div className={estilos.pagina}>
        <h1>El enlace está incompleto.</h1>
        <p className={estilos.bajada}>
          Cópialo entero desde el correo: a veces se corta al pegarlo, sobre todo si
          ocupaba más de una línea. Si sigue sin funcionar, pídele a quien te invitó que
          te mande uno nuevo.
        </p>
        <p className={estilos.queEs}>
          <Link to={rutas.adminEntrar()}>Ya tengo cuenta, quiero entrar →</Link>
        </p>
      </div>
    )
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)

    const revision = Datos.safeParse(valores)
    if (!revision.success) {
      const nuevos: Errores = {}
      for (const problema of revision.error.issues) {
        const campo = problema.path[0] as keyof Campos
        nuevos[campo] ??= problema.message
      }
      setErrores(nuevos)
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    setEnviando(true)
    try {
      await aceptar({
        token,
        nombre: revision.data.nombre,
        apellidos: revision.data.apellidos,
        contrasena: revision.data.contrasena,
      })
      // `replace` a proposito: el token vale lo mismo que una contrasena y no
      // tiene por que sobrevivir al boton de atras.
      navegar(rutas.adminVacantes(), { replace: true })
    } catch (causa) {
      setFallo(
        causa instanceof Error
          ? causa.message
          : 'Este enlace ya no sirve. Puede haber vencido o haberse usado antes.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={estilos.pagina}>
      <span className={estilos.marca}>
        <Marca />
      </span>
      <h1>Crea tu acceso al panel.</h1>
      <p className={estilos.bajada}>
        Te invitaron al equipo. Pon tu nombre y una contraseña, y entras directo — no hace
        falta confirmar nada por correo.
      </p>

      <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
        <Campo
          etiqueta="Nombre"
          type="text"
          autoComplete="given-name"
          value={valores.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          error={errores.nombre}
        />

        <Campo
          etiqueta="Apellidos"
          type="text"
          autoComplete="family-name"
          value={valores.apellidos}
          onChange={(e) => cambiar('apellidos', e.target.value)}
          error={errores.apellidos}
        />

        <Campo
          etiqueta="Contraseña"
          ayuda={`Al menos ${MINIMO_CONTRASENA} caracteres. Es más que en el portal del candidato porque desde aquí se ven los datos de muchas personas.`}
          type="password"
          autoComplete="new-password"
          value={valores.contrasena}
          onChange={(e) => cambiar('contrasena', e.target.value)}
          error={errores.contrasena}
        />

        <Campo
          etiqueta="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={valores.repetir}
          onChange={(e) => cambiar('repetir', e.target.value)}
          error={errores.repetir}
        />

        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}

        <button className={estilos.enviar} type="submit" disabled={enviando}>
          {enviando ? 'Creando tu acceso…' : 'Crear mi acceso y entrar'}
        </button>
      </form>

      <section className={estilos.camino}>
        <h2 className={estilos.tituloCamino}>Si el enlace no funciona</h2>
        <p className={estilos.queEs}>
          Las invitaciones <b>se usan una sola vez y caducan</b>. Si ya entraste con esta o
          pasó demasiado tiempo, pídele a quien te invitó que te mande una nueva: es
          inmediato y no pierdes nada.
        </p>
      </section>
    </div>
  )
}
