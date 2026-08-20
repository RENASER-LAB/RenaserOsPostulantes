/**
 * Entrar con el enlace que llego por correo.
 *
 * Existe porque hay candidatos que nunca eligieron una contrasena. Cuando una
 * convocatoria llega como una carpeta de curriculums, el sistema les crea la
 * cuenta a ellos: con un correo armado del nombre del archivo y una clave que
 * nadie les dijo. Por la puerta de /ingresar no pueden pasar, y no hay pantalla
 * de recuperar contrasena. Sin esto, el aviso que se les manda lleva a una
 * puerta cerrada.
 *
 * Aqui no hay formulario: el token viene en la direccion, se canjea y se entra.
 * Lo unico que ve el candidato es una espera corta y, si algo va mal, un motivo
 * que se entiende.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { misPostulaciones } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { leTocaAlCandidato } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { Marca } from '@/ui/Marca'

/**
 * A donde mandar a alguien que acaba de entrar por el enlace.
 *
 * Un enlace se manda para pedir algo concreto, asi que hacerle dar un clic mas
 * para llegar sobra. Pero mandarlo directo falla en dos casos reales: si tiene
 * mas de una postulacion no hay forma de saber a cual, y si ya entrego lo suyo
 * aterrizaria en una pantalla donde no puede hacer nada y pareceria rota.
 *
 * Por eso el atajo solo se toma cuando no hay ambiguedad: una sola postulacion,
 * y el estado dice que le toca a el. En cualquier otro caso ve su lista, que
 * siempre es una respuesta correcta.
 */
async function aDondeIr(): Promise<string> {
  try {
    const mias = await misPostulaciones()
    const suyas = mias.filter((p) => leTocaAlCandidato(p.estado))
    const unica = suyas[0]
    if (mias.length === 1 && suyas.length === 1 && unica) {
      return rutas.proceso(unica.uuid)
    }
  } catch {
    // Si la lista falla, la lista es justo la pantalla que sabe explicarlo.
  }
  return rutas.procesos()
}

export function Acceso() {
  const { entrarConEnlace } = useSesion()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  // React 18 monta dos veces en desarrollo. Sin este cerrojo el token se
  // canjearia dos veces y el contador de usos del enlace mentiria.
  const yaSeIntento = useRef(false)

  const token = parametros.get('token')

  useEffect(() => {
    if (yaSeIntento.current) return
    yaSeIntento.current = true

    if (!token) {
      setError('El enlace está incompleto. Cópialo entero desde el correo.')
      return
    }

    entrarConEnlace(token)
      .then(aDondeIr)
      .then((destino) => {
        // replace: el token se queda fuera del historial del navegador. Vale lo
        // mismo que una contrasena y no tiene por que sobrevivir al boton de
        // atras ni quedar escrito en la barra de direcciones.
        navegar(destino, { replace: true })
      })
      .catch(() => {
        setError('Este enlace ya no sirve. Puede haber vencido o haber sido reemplazado por uno más nuevo.')
      })
  }, [token, entrarConEnlace, navegar])

  if (!error) {
    return (
      <div className="pagehead centrado">
        <div>
          <Marca tamano={46} acento />
          <h1>Entrando…</h1>
          <p>Un momento, estamos abriendo tu proceso.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pagehead centrado">
        <div>
          <Marca tamano={46} acento />
          <h1>No pudimos abrir tu enlace.</h1>
          <p>{error}</p>
        </div>
      </div>

      <div className="card form-card">
        <p className="small">
          Si tienes contraseña, puedes{' '}
          <Link className="link" to={rutas.ingresar()}>
            entrar con tu correo
          </Link>
          . Si no, escríbenos respondiendo al correo que recibiste y te mandamos
          un enlace nuevo.
        </p>
      </div>
    </>
  )
}
