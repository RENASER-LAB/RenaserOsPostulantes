/**
 * Lo que se retiro de la lista de todos los dias, y sigue entero.
 *
 * ## Por que es una pantalla y no un filtro
 *
 * La propuesta primera era un selector «Activas / Archivadas» encima de la
 * tabla. Se cambio por esto: un selector deja dudando si lo que se esta mirando
 * son todas las vacantes o la mitad, y esa duda se paga cada vez que alguien
 * busca una y no aparece. Una direccion propia contesta sola —la barra del
 * navegador dice donde esta uno—, sobrevive a la recarga y al boton Atras, y se
 * puede enviar por chat.
 *
 * Los dos controles no conviven: en la cabecera de `/admin` esta el boton que
 * trae aqui, y aqui esta la vuelta. No hay ningun sitio donde elegir entre las
 * dos listas dos veces.
 *
 * ## Que se conserva
 *
 * Todo. Archivar no borra ni esconde: desde aqui se entra al detalle de la
 * vacante y alli estan sus postulantes, sus etapas, su ranking, sus fichas y sus
 * descargas, con los permisos de siempre. Lo unico que no se puede es moverla.
 *
 * El filtro no se hace aqui: se piden las archivadas al servidor. Recortar en el
 * navegador una lista que ya vino entera dejaria las archivadas al alcance de
 * cualquier busqueda de la otra pantalla.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { desarchivarVacante, listarVacantes } from '../api/panel'
import { rutas } from '@/rutas'
import { formatearFechaCorta } from '@/dominio/reloj'
import tabla from '../ui/Tabla.module.css'
import estilos from './Vacantes.module.css'

export function VacantesArchivadas() {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)
  const [dicho, setDicho] = useState<string | null>(null)

  const vacantes = useQuery({
    queryKey: ['panel-vacantes-archivadas'],
    queryFn: () => listarVacantes(true),
  })

  /*
   * ⚠️ **La guarda contra el doble clic, y `disabled` no lo es.**
   *
   * Es el mismo defecto que tenía el modal de archivo, con una cara peor: aquí
   * el segundo DELETE llega cuando el primero ya desarchivó, así que el servidor
   * contesta «Esta vacante no está archivada» —con razón— y la pantalla pintaba
   * ese 409 en rojo encima del aviso de éxito. La operación había ido bien y el
   * panel decía que no.
   *
   * `disabled={desarchivo.isPending}` solo se aplica cuando React vuelve a
   * pintar, y las dos pulsaciones de un doble clic caben antes de ese render. El
   * ref se escribe en el mismo turno del evento, así que la segunda ya lo
   * encuentra puesto.
   *
   * Guarda el id y no un booleano: son varias filas, y bloquear la tabla entera
   * porque una está en vuelo impediría devolver dos vacantes seguidas.
   */
  const enVuelo = useRef<number | null>(null)

  const desarchivo = useMutation({
    mutationFn: (id: number) => desarchivarVacante(id),
    onSuccess: async (_respuesta, id) => {
      const titulo = (vacantes.data ?? []).find((v) => v.id === id)?.titulo ?? 'La vacante'
      setFallo(null)
      setDicho(`«${titulo}» vuelve a la lista de vacantes, cerrada como estaba.`)
      await cache.invalidateQueries({ queryKey: ['panel-vacantes-archivadas'] })
      await cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
      await cache.invalidateQueries({ queryKey: ['panel-vacantes-archivadas-conteo'] })
    },
    onError: (causa) => {
      setDicho(null)
      setFallo(causa instanceof Error ? causa.message : 'No se pudo desarchivar la vacante.')
    },
    // Se suelta pase lo que pase: si falló, la fila sigue ahí y hay que poder
    // reintentarla; si fue bien, la fila se va y el hueco queda libre para la
    // siguiente. Soltarlo solo al fallar dejaría el id de una fila que ya no está.
    onSettled: () => {
      enVuelo.current = null
    },
  })

  /** Manda el desarchivo una sola vez por fila, aunque se pulse dos veces. */
  const pedirDesarchivo = (id: number) => {
    if (enVuelo.current !== null) return
    enVuelo.current = id
    desarchivo.mutate(id)
  }

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.adminVacantes()}>
        ← Volver a vacantes
      </Link>

      <div className={estilos.cabecera}>
        <div>
          <h1>Vacantes archivadas.</h1>
          <p className={estilos.bajada}>
            Convocatorias cerradas que se retiraron de la lista. Su proceso sigue completo y
            se puede consultar; para volver a moverlas, desarchívalas.
          </p>
        </div>
      </div>

      {dicho && (
        <p className={`${estilos.aviso} ${estilos.bueno}`} role="status">
          {dicho}
        </p>
      )}
      {fallo && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {fallo}
        </p>
      )}

      {vacantes.isPending && <p className={estilos.aviso}>Cargando las vacantes archivadas…</p>}
      {vacantes.isError && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {vacantes.error instanceof Error ? vacantes.error.message : 'No se pudo cargar.'}
        </p>
      )}

      {vacantes.data && (
        <div className={tabla.envoltura}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th>Vacante</th>
                <th>Estado</th>
                <th>Archivada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vacantes.data.map((v) => (
                <tr key={v.id}>
                  <td className={estilos.titulo}>{v.titulo}</td>
                  {/*
                    Se dice «Cerrada» y no «Archivada»: archivar no cambió el
                    estado, y ocultar cómo terminó la convocatoria perdería el
                    dato justo en la pantalla donde se va a consultar.
                  */}
                  <td>Cerrada</td>
                  <td className={estilos.fechaArchivo}>
                    {v.archivadaEn ? formatearFechaCorta(v.archivadaEn) : '—'}
                  </td>
                  <td className={estilos.acciones}>
                    <Link to={rutas.adminVacante(v.id)}>Ver el proceso</Link>
                    {v.puedeDesarchivar && (
                      <button
                        className={estilos.aprobar}
                        type="button"
                        aria-label={`Desarchivar la vacante ${v.titulo}`}
                        disabled={desarchivo.isPending}
                        onClick={() => pedirDesarchivo(v.id)}
                      >
                        Desarchivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {vacantes.data.length === 0 && (
                <tr>
                  <td colSpan={4} className={tabla.vacia}>
                    <p>No hay vacantes archivadas.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
