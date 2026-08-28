/**
 * La tarjeta de la vacante que dice en que va su prueba tecnica y lleva a
 * prepararla.
 *
 * Vive bajo «Que respondera quien postule», al lado de los desplegables de
 * plantillas y pesos: es de la misma familia —lo que se le pide a quien
 * postule— pero no cabe en un `<select>`, asi que es una tarjeta con dos
 * estados y un enlace.
 *
 * ⚠️ **No entra en la puerta de publicar la vacante.** El servidor no lo exige
 * y el panel no inventa puertas: la tarjeta informa y enlaza. Si un dia el
 * backend lo exija, hay que tocar `leFalta` y `listaParaPublicar` en
 * `Vacante.tsx`, los dos, o el boton y el cartel se contradicen.
 */

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verCuestionarioTecnico } from '../../api/panel'
import type { CuestionarioTecnico, FichaDelPuesto } from '../../api/tipos'
import { rutas } from '@/rutas'
import { GENERACION } from './bloques'
import { claveDeLaFicha, claveDelCuestionario, laFichaONada } from './consultas'
import estilos from './EstadoDeLaPruebaTecnica.module.css'

function estadoDeLaFicha(ficha: FichaDelPuesto | null): string {
  if (ficha === null) return 'sin empezar'
  return ficha.estado === 'COMPLETA' ? 'completa' : 'a medias'
}

function estadoDelCuestionario(c: CuestionarioTecnico): string {
  if (c.generacion === GENERACION.EN_CURSO) return 'la IA lo está redactando'
  if (c.estado === 'PUBLICADA') {
    return c.generacion === GENERACION.FALLIDA ? 'publicado · la última regeneración falló' : 'publicado'
  }
  if (c.estado === 'BORRADOR') return 'en borrador, sin publicar'
  if (c.generacion === GENERACION.FALLIDA) return 'la última generación falló'
  return 'sin pedir'
}

export function EstadoDeLaPruebaTecnica({ vacanteId }: { vacanteId: number }) {
  const ficha = useQuery({
    queryKey: claveDeLaFicha(vacanteId),
    queryFn: () => laFichaONada(vacanteId),
  })
  const cuestionario = useQuery({
    queryKey: claveDelCuestionario(vacanteId),
    queryFn: () => verCuestionarioTecnico(vacanteId),
  })

  const laFicha = ficha.isPending
    ? '…'
    : ficha.isError
      ? 'no se pudo leer'
      : estadoDeLaFicha(ficha.data)
  const elCuestionario = cuestionario.isPending
    ? '…'
    : cuestionario.isError
      ? 'no se pudo leer'
      : estadoDelCuestionario(cuestionario.data)

  const publicado = cuestionario.data?.estado === 'PUBLICADA'

  return (
    <div className={estilos.tarjeta}>
      <div className={estilos.texto}>
        <b className={estilos.titulo}>La prueba técnica del puesto</b>
        <p className={estilos.estado} role="status">
          Ficha: {laFicha} · Cuestionario: {elCuestionario}
        </p>
      </div>
      <Link className={estilos.enlace} to={rutas.adminPruebaTecnica(vacanteId)}>
        {publicado ? 'Ver la prueba técnica →' : 'Preparar la prueba técnica →'}
      </Link>
    </div>
  )
}
