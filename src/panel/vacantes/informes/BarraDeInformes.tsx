import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  RUTA_DE_LA_ETAPA,
  descargarInforme,
  guardarArchivo,
  verInformesDelPostulante,
  type CodigoDeEtapa,
} from '@/panel/api/informes'
import { rutas } from '@/rutas'
import { IconoDescargar, IconoReloj } from '@/ui/Iconos'
import type { EtapaPanel } from '../ranking'
import estilos from './BarraDeInformes.module.css'

/** Cómo se llama cada informe en su botón y para el lector de pantalla. */
export const NOMBRE_DEL_INFORME: Record<CodigoDeEtapa, { corto: string; largo: string }> = {
  CV: { corto: 'CV', largo: 'el informe del CV' },
  EVALUACION: { corto: 'Evaluación', largo: 'el informe de la evaluación' },
  PRUEBA: { corto: 'Prueba', largo: 'el informe de la prueba' },
}

/** Qué informes van en la ficha de cada pestaña: el CV y la evaluación, o la prueba. */
export function informesDeLaPestana(etapa: EtapaPanel): CodigoDeEtapa[] {
  if (etapa === 'PERFIL_INTEGRAL') return ['CV', 'EVALUACION']
  if (etapa === 'PRUEBA_PUESTO') return ['PRUEBA']
  return []
}

/**
 * La barra de informes de la ficha: un botón por informe de la etapa, que baja
 * el PDF en el momento, y «Ver informes», que abre el visor en esta persona.
 *
 * - **Listo**: azul macizo con la flecha de descarga.
 * - **Generando**: contorno con halo y un círculo que gira; no se puede pulsar
 *   otra vez hasta que termina.
 * - **Sin informe**: gris con un reloj. El motivo va en el `title` y en el
 *   `aria-label`: «Todavía no tiene calificación», «La IA está calificando» o
 *   «La calificación falló».
 *
 * **Sin permiso no hay botón.** El backend solo devuelve las etapas que quien
 * mira puede ver; la que falta no se pinta.
 */
export function BarraDeInformes({
  postulacionId,
  vacanteId,
  etapa,
}: {
  postulacionId: number
  vacanteId: number
  etapa: EtapaPanel
}) {
  const deLaPestana = informesDeLaPestana(etapa)
  const estados = useQuery({
    queryKey: ['panel-informes', postulacionId],
    queryFn: () => verInformesDelPostulante(postulacionId),
    enabled: deLaPestana.length > 0,
    retry: false,
    // Mientras la IA califica, el botón se enciende solo al terminar.
    refetchInterval: (consulta) =>
      consulta.state.data?.informes.some((i) => !i.disponible && i.motivo === 'La IA está calificando')
        ? 15_000
        : false,
  })
  const [generando, setGenerando] = useState<CodigoDeEtapa | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  if (deLaPestana.length === 0 || !estados.data) return null
  const visibles = deLaPestana
    .map((codigo) => estados.data.informes.find((i) => i.etapa === codigo))
    .filter((i): i is NonNullable<typeof i> => i != null)
  if (visibles.length === 0) return null

  async function descargar(codigo: CodigoDeEtapa) {
    setGenerando(codigo)
    setFallo(null)
    try {
      const archivo = await descargarInforme(postulacionId, RUTA_DE_LA_ETAPA[codigo])
      guardarArchivo(archivo, `Informe ${NOMBRE_DEL_INFORME[codigo].corto}.pdf`)
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : 'No pudimos preparar el informe.')
    } finally {
      setGenerando(null)
    }
  }

  return (
    <div className={estilos.barra}>
      <div className={estilos.fila}>
        <div role="group" aria-label="Informes en PDF" className={estilos.fila}>
          {visibles.map((informe) => {
            const nombre = NOMBRE_DEL_INFORME[informe.etapa]
            if (generando === informe.etapa) {
              return (
                <button
                  key={informe.etapa}
                  type="button"
                  disabled
                  aria-busy="true"
                  aria-label={`Generando ${nombre.largo}`}
                  className={estilos.generando}
                >
                  <svg
                    className={estilos.gira}
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                  </svg>
                  Generando…
                </button>
              )
            }
            if (!informe.disponible) {
              const motivo = informe.motivo ?? 'Todavía no tiene calificación'
              return (
                <button
                  key={informe.etapa}
                  type="button"
                  disabled
                  title={motivo}
                  aria-label={`${nombre.largo.charAt(0).toUpperCase()}${nombre.largo.slice(1)} no está disponible. ${motivo}`}
                  className={estilos.sinInforme}
                >
                  <IconoReloj tamano={16} />
                  {nombre.corto}
                </button>
              )
            }
            return (
              <button
                key={informe.etapa}
                type="button"
                aria-label={`Descargar ${nombre.largo}`}
                className={estilos.boton}
                disabled={generando !== null}
                onClick={() => void descargar(informe.etapa)}
              >
                <IconoDescargar tamano={16} />
                {nombre.corto}
              </button>
            )
          })}
        </div>
        <Link
          className={estilos.verInformes}
          to={rutas.adminInformes(vacanteId, postulacionId, RUTA_DE_LA_ETAPA[visibles[0]!.etapa])}
        >
          Ver informes
        </Link>
      </div>
      {fallo && (
        <p className={estilos.fallo} role="alert">
          {fallo}
        </p>
      )}
      <div className={estilos.leyenda}>
        <span className={estilos.clave}>
          <span className={estilos.muestraLista} aria-hidden="true" />
          Listo para descargar
        </span>
        <span className={estilos.clave}>
          <span className={estilos.muestraGenerando} aria-hidden="true" />
          Generando
        </span>
        <span className={estilos.clave}>
          <span className={estilos.muestraSinInforme} aria-hidden="true" />
          Todavía no · el motivo al pasar el ratón
        </span>
      </div>
    </div>
  )
}
