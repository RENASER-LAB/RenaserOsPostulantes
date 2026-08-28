/**
 * La prueba tecnica del puesto: la pagina donde el dueño llena la ficha y
 * aprueba el cuestionario que la IA escribe con ella.
 *
 * Es la primera sub-ruta de una vacante, y lo es a proposito: `Vacante.tsx`
 * apila secciones y ya pasa de las mil quinientas lineas, y esto son diez
 * respuestas largas mas una docena de preguntas con su guia. En la vacante
 * queda una tarjeta con el estado y el enlace hasta aqui.
 *
 * El orden de la pagina es el del flujo: primero la ficha, porque sin ella
 * COMPLETA no hay nada que pedir; despues el cuestionario. La ficha se consulta
 * aqui y baja a las dos secciones, asi el cuestionario sabe si puede ofrecer
 * «pedir» sin volver a preguntarle al servidor.
 *
 * ⚠️ **El servidor no ata esto a publicar la vacante.** Se puede preparar con
 * la vacante ya publicada —nadie rinde el cuestionario hasta que se publique
 * aqui, y la rendicion es del ciclo siguiente— y por eso la pagina lo dice en
 * vez de esconder nada: el momento natural es antes de publicar, no una regla.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import { verVacante } from '../../api/panel'
import { rutas } from '@/rutas'
import { CuestionarioTecnico } from './CuestionarioTecnico'
import { FichaDelPuesto } from './FichaDelPuesto'
import { claveDeLaFicha, laFichaONada } from './consultas'
import estilos from './PruebaTecnica.module.css'

export function PruebaTecnica() {
  const { id = '' } = useParams()
  const vacanteId = Number(id)

  const idValido = Number.isInteger(vacanteId) && vacanteId > 0

  const vacante = useQuery({
    queryKey: ['panel-vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: idValido,
  })
  const ficha = useQuery({
    queryKey: claveDeLaFicha(vacanteId),
    queryFn: () => laFichaONada(vacanteId),
    enabled: idValido,
  })

  // Sin vacante no hay prueba tecnica que preparar: un id que no es un numero,
  // o una vacante ajena (403/404), cortan aqui en vez de pedir `/vacantes/NaN/ficha`.
  if (!idValido || vacante.isError) {
    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.adminVacantes()}>
          ← Volver a las vacantes
        </Link>
        <p className={estilos.avisoMalo} role="alert">
          {!idValido
            ? 'Esta dirección no lleva a ninguna vacante.'
            : vacante.error instanceof Error
              ? vacante.error.message
              : 'No se pudo cargar la vacante.'}
        </p>
      </div>
    )
  }

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.adminVacante(vacanteId)}>
        ← Volver a la vacante
      </Link>

      <header className={estilos.cabecera}>
        <h1 className={estilos.titulo}>La prueba técnica del puesto</h1>
        {vacante.data && <p className={estilos.vacante}>{vacante.data.titulo}</p>}
      </header>

      <p className={estilos.explica}>
        Dos pasos. Primero la ficha: diez preguntas que se contestan con tus palabras. Con la
        ficha completa, la IA escribe el cuestionario técnico de esta vacante y tú lo revisas y
        lo publicas.
      </p>

      {vacante.data?.estado === 'PUBLICADA' && (
        <p className={estilos.nota} role="status">
          La vacante ya está publicada. La prueba técnica se puede preparar igual: nadie la rinde
          hasta que el cuestionario se publique aquí.
        </p>
      )}

      <section className={estilos.seccion}>
        <h2 className={estilos.tituloSeccion}>1 · La ficha del puesto</h2>
        {ficha.isPending && <p className={estilos.cargando}>Cargando la ficha…</p>}
        {ficha.isError &&
          (ficha.error instanceof ErrorApi && ficha.error.estado === 403 ? (
            <p className={estilos.nota} role="status">
              No se puede ver la ficha: hace falta el permiso «ver_vacantes».
            </p>
          ) : (
            <p className={estilos.avisoMalo} role="alert">
              {ficha.error instanceof Error ? ficha.error.message : 'No se pudo cargar la ficha.'}
            </p>
          ))}
        {ficha.data !== undefined && (
          <FichaDelPuesto vacanteId={vacanteId} ficha={ficha.data} />
        )}
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.tituloSeccion}>2 · El cuestionario técnico</h2>
        <CuestionarioTecnico
          vacanteId={vacanteId}
          fichaCompleta={ficha.data?.estado === 'COMPLETA'}
        />
      </section>
    </div>
  )
}
