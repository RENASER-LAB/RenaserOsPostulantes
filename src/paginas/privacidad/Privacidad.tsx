/**
 * Privacidad y control.
 *
 * Tres cosas que se parecen y son distintas, y por eso van separadas y con su
 * explicacion al lado:
 *
 *   1. **Retirar una postulacion** — dejas esa vacante. Tus datos siguen.
 *   2. **Retirar el consentimiento de futuros contactos** — sales del Radar de
 *      Talento. Tus postulaciones en curso no se tocan.
 *   3. **Pedir el borrado de datos** — se eliminan tus datos personales y tus
 *      respuestas. La auditoria se conserva sin identificarte.
 *
 * El mockup las metia las tres en un solo modal y era facil confundirlas.
 *
 * Las dos que no se pueden deshacer piden confirmacion, y la que borra lo dice
 * en la forma antes que en el texto: es el unico recuadro del portal con el
 * contorno rojo a dos pixeles.
 *
 * ⚠️ El portal **no sabe** si el consentimiento de futuras vacantes esta activo:
 * no hay ruta para leerlo, solo para retirarlo. Por eso no hay ninguna etiqueta
 * que diga «lo tienes activado» — seria un indicador que no sale de comparar
 * con nada.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  misPostulaciones,
  pedirBorrado,
  retirarConsentimientoFuturos,
  retirarPostulacion,
} from '@/api/portal'
import type { MiPostulacion } from '@/api/tipos'
import { esFinal } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Modal } from '@/ui/Modal'
import estilos from './Privacidad.module.css'

function mensajeDe(causa: unknown, respaldo: string): string {
  return causa instanceof Error ? causa.message : respaldo
}

export function Privacidad() {
  const avisar = useAviso()
  const cache = useQueryClient()

  // Las dos irreversibles preguntan antes. Retirarse de una vacante no se
  // deshace desde el portal —hay que volver a postular— y con un solo clic se
  // pierde el proceso entero.
  const [porRetirar, setPorRetirar] = useState<MiPostulacion | null>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [motivo, setMotivo] = useState('')

  const consulta = useQuery({ queryKey: ['postulaciones'], queryFn: misPostulaciones })

  const retiro = useMutation({
    mutationFn: retirarPostulacion,
    onSuccess: async () => {
      setPorRetirar(null)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      avisar('Postulación retirada.')
    },
  })

  const futuros = useMutation({
    mutationFn: retirarConsentimientoFuturos,
    onSuccess: () => avisar('Ya no te avisaremos de futuras vacantes.'),
  })

  const borrado = useMutation({
    mutationFn: () => pedirBorrado({ motivo: motivo.trim() || undefined }),
    onSuccess: () => {
      setConfirmarBorrado(false)
      setMotivo('')
      avisar('Solicitud registrada. Te confirmaremos por correo.')
    },
  })

  const activas = consulta.data?.filter((p) => !esFinal(p.estado)) ?? []

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.procesos()}>
        ← Volver a mis procesos
      </Link>

      <div className={estilos.encabezado}>
        <h1>Tus datos, tus decisiones.</h1>
        <p className={estilos.bajada}>
          Son tres cosas distintas y se parecen mucho. Léelas antes de elegir:{' '}
          <b>solo una borra tus datos</b>.
        </p>
      </div>

      <div className={estilos.acciones}>
        {/* 1 · Retirarse de una vacante */}
        <section className={estilos.accion}>
          <div className={estilos.tituloAccion}>
            <h2>Retirarme de una postulación</h2>
            <span className={estilos.alcance}>Afecta a una vacante</span>
          </div>
          <p className={estilos.texto}>
            Sales de <b>ese</b> proceso y dejas de recibir sus avisos. Tus datos siguen
            aquí y puedes postular a otra vacante cuando quieras. <b>No se deshace</b>:
            para volver a esa vacante tendrías que postular de nuevo.
          </p>

          {/*
            El cargando y el fallo van escritos aqui y no con las piezas de
            `Mensajes`: aquellas son de pantalla entera —traen su propio marco y
            su `h1`— y dentro de este recuadro dejarian dos bordes anidados y un
            segundo `h1` por debajo de un `h2`.
          */}
          {consulta.isPending && (
            <p className={estilos.ninguna} aria-busy="true">
              Cargando tus postulaciones…
            </p>
          )}
          {consulta.isError && (
            <>
              <p className={estilos.fallo} role="alert">
                {mensajeDe(consulta.error, 'No pudimos cargar tus postulaciones.')}
              </p>
              <button
                className={estilos.secundario}
                type="button"
                onClick={() => void consulta.refetch()}
              >
                Intentar de nuevo
              </button>
            </>
          )}

          {consulta.isSuccess &&
            (activas.length === 0 ? (
              <p className={estilos.ninguna}>No tienes postulaciones en curso.</p>
            ) : (
              <div className={estilos.postulaciones}>
                {activas.map((p) => (
                  <div className={estilos.postulacion} key={p.uuid}>
                    <span className={estilos.cual}>
                      <b className={estilos.nombreVacante}>{p.vacante}</b>
                      <span className={estilos.enQueVa}>{p.estadoNombre}</span>
                    </span>
                    <button
                      className={estilos.retirar}
                      type="button"
                      onClick={() => setPorRetirar(p)}
                    >
                      Retirarme
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </section>

        {/* 2 · Futuras vacantes */}
        <section className={estilos.accion}>
          <div className={estilos.tituloAccion}>
            <h2>No avisarme de futuras vacantes</h2>
            <span className={estilos.alcance}>Afecta a los correos</span>
          </div>
          <p className={estilos.texto}>
            Retiras el permiso que diste al crear tu cuenta para que te escribamos cuando
            abra un puesto que encaje contigo. <b>Tus postulaciones en curso siguen
            igual</b>, y sus avisos también.
          </p>
          <button
            className={estilos.secundario}
            type="button"
            onClick={() => futuros.mutate()}
            disabled={futuros.isPending}
          >
            {futuros.isPending ? 'Retirando…' : 'Retirar el permiso'}
          </button>
          {futuros.isError && (
            <p className={estilos.fallo} role="alert">
              {mensajeDe(futuros.error, 'No pudimos retirar el permiso.')}
            </p>
          )}
        </section>

        {/* 3 · Borrado. La única que borra, y se ve antes de leerse. */}
        <section className={`${estilos.accion} ${estilos.borra}`}>
          <div className={estilos.tituloAccion}>
            <h2>Borrar todos mis datos</h2>
            <span className={`${estilos.alcance} ${estilos.roja}`}>Esta sí borra</span>
          </div>
          <p className={estilos.texto}>
            Pides que eliminemos tu cuenta, tu currículum, tus respuestas y todas tus
            postulaciones, en curso o terminadas. <b>No se deshace y no se recupera
            nada.</b> Te confirmamos por correo cuando esté hecho.
          </p>
          <p className={estilos.letraChica}>
            El registro de auditoría se conserva sin datos que te identifiquen, porque la
            ley obliga a poder reconstruir las decisiones que ya se tomaron.
          </p>
          <button
            className={estilos.peligroso}
            type="button"
            onClick={() => setConfirmarBorrado(true)}
          >
            Pedir el borrado
          </button>
        </section>
      </div>

      {/* ---------- Los dos avisos ---------- */}

      <Modal
        abierto={porRetirar !== null}
        titulo="Retirarte de esta postulación"
        onCerrar={() => setPorRetirar(null)}
        pie={
          <>
            <button
              className={estilos.cancelar}
              type="button"
              onClick={() => setPorRetirar(null)}
            >
              Cancelar
            </button>
            <button
              className={estilos.confirmarPeligro}
              type="button"
              onClick={() => porRetirar && retiro.mutate(porRetirar.uuid)}
              disabled={retiro.isPending}
            >
              {retiro.isPending ? 'Retirando…' : 'Sí, retirarme'}
            </button>
          </>
        }
      >
        <p className={estilos.avisoTexto}>
          Vas a salir del proceso de <b>{porRetirar?.vacante}</b>. Dejarás de recibir sus
          avisos y no podrás retomarlo: para volver tendrías que postular otra vez.
        </p>
        <p className={estilos.avisoTexto}>
          Tus datos y tus demás postulaciones no se tocan.
        </p>
        {retiro.isError && (
          <p className={estilos.fallo} role="alert">
            {mensajeDe(retiro.error, 'No pudimos retirar la postulación.')}
          </p>
        )}
      </Modal>

      <Modal
        abierto={confirmarBorrado}
        titulo="Pedir el borrado de tus datos"
        onCerrar={() => setConfirmarBorrado(false)}
        pie={
          <>
            <button
              className={estilos.cancelar}
              type="button"
              onClick={() => setConfirmarBorrado(false)}
            >
              Cancelar
            </button>
            <button
              className={estilos.confirmarPeligro}
              type="button"
              onClick={() => borrado.mutate()}
              disabled={borrado.isPending}
            >
              {borrado.isPending ? 'Enviando…' : 'Sí, pedir el borrado'}
            </button>
          </>
        }
      >
        <p className={estilos.consecuencia}>
          Las postulaciones que tengas en curso se cerrarán. No se puede deshacer.
        </p>
        <p className={estilos.avisoTexto}>
          Lo ejecuta el equipo de Renaser, así que no es inmediato. Te escribimos por
          correo cuando esté hecho.
        </p>
        <div className={estilos.motivo}>
          <label className={estilos.etiquetaMotivo} htmlFor="motivo">
            Motivo (opcional)
          </label>
          <textarea
            className={estilos.escrito}
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Si quieres, cuéntanos por qué. No es obligatorio."
          />
        </div>
        {borrado.isError && (
          <p className={estilos.fallo} role="alert">
            {mensajeDe(borrado.error, 'No pudimos registrar la solicitud.')}
          </p>
        )}
      </Modal>
    </div>
  )
}
