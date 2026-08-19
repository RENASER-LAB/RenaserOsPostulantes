/**
 * Mis procesos.
 *
 * Aqui es donde se ve para que sirve `dominio/estados.ts`: nada de esta
 * pantalla sabe que estados existen. Le pregunta a la tabla que titulo, que
 * boton y que tramo de la barra le toca a cada postulacion.
 *
 * Mientras alguna este calificando, la lista se vuelve a consultar sola: no hay
 * nada que hacer, pero la pantalla tiene que enterarse cuando acabe.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { misPostulaciones } from '@/api/portal'
import type { MiPostulacion } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import {
  esFinal,
  estaCalificando,
  leTocaAlCandidato,
  momentoDe,
  resumenDe,
  tonoDe,
  tramosCompletados,
  ETAPAS,
  indiceDeEtapa,
} from '@/dominio/estados'
import { describirAntiguedad } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { BarraPasos } from '@/ui/BarraPasos'
import { Cargando, Fallo } from '@/ui/Mensajes'

const CADA_15_SEGUNDOS = 15_000

function TarjetaProceso({ p }: { p: MiPostulacion }) {
  const momento = momentoDe(p.estado)
  const final = esFinal(p.estado)
  const completados = tramosCompletados(p.estado)
  const actual = momento.etapa && !final ? indiceDeEtapa(momento.etapa) : null

  return (
    <article className="card process-card">
      <div className="application">
        <div>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <span className={`tag ${tonoDe(p.estado)}`}>{resumenDe(p.estado)}</span>
            <span className="small">{p.estadoNombre}</span>
          </div>
          <h2 style={{ marginTop: 13 }}>{p.vacante}</h2>
          <p>
            {final
              ? 'Este proceso terminó.'
              : `${momento.etapa ? ETAPAS[indiceDeEtapa(momento.etapa)]?.etiqueta : 'En curso'} · ${describirAntiguedad(p.diasSinCambio)}`}
          </p>
        </div>

        {momento.accion ? (
          <Link
            className={`btn ${leTocaAlCandidato(p.estado) ? 'primary' : ''}`}
            to={momento.accion.destino(p.uuid)}
          >
            {momento.accion.etiqueta}
          </Link>
        ) : (
          <Link className="btn" to={rutas.proceso(p.uuid)}>
            Ver detalle
          </Link>
        )}
      </div>

      <BarraPasos completados={completados} actual={actual} />

      <div className="next-action">
        <div>
          <b>{momento.titulo}</b>
          <span>{momento.ayuda}</span>
        </div>
        <Link className="link" to={rutas.proceso(p.uuid)}>
          Ver detalle
        </Link>
      </div>
    </article>
  )
}

export function Procesos() {
  const { saludo } = useSesion()

  const consulta = useQuery({
    queryKey: ['postulaciones'],
    queryFn: misPostulaciones,
    // Solo insiste mientras la IA este trabajando en alguna.
    refetchInterval: (q) =>
      q.state.data?.some((p) => estaCalificando(p.estado)) ? CADA_15_SEGUNDOS : false,
  })

  if (consulta.isPending) return <Cargando que="Cargando tus procesos…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
  }

  const procesos = consulta.data
  // El recuadro de arriba enseña lo primero que de verdad depende del candidato.
  const siguiente = procesos.find((p) => leTocaAlCandidato(p.estado))
  const momentoSiguiente = siguiente ? momentoDe(siguiente.estado) : null

  return (
    <>
      <div className="pagehead">
        <div>
          {saludo && <span className="greeting">Hola, {saludo}</span>}
          <h1>Mis procesos</h1>
          <p>
            Revisa primero lo que necesitas hacer y luego el avance de todas tus
            postulaciones.
          </p>
        </div>
        <Link className="btn" to={rutas.vacantes()}>
          Ver más vacantes
        </Link>
      </div>

      {siguiente && momentoSiguiente?.accion && (
        <section className="next-step-panel">
          <div>
            <h2>{momentoSiguiente.titulo}</h2>
            <p>
              {momentoSiguiente.ayuda} Esta acción corresponde a tu postulación para{' '}
              {siguiente.vacante}.
            </p>
            <div className="next-step-meta">
              <span>
                {momentoSiguiente.etapa
                  ? ETAPAS[indiceDeEtapa(momentoSiguiente.etapa)]?.etiqueta
                  : 'En curso'}
              </span>
              <span>·</span>
              <span>{describirAntiguedad(siguiente.diasSinCambio)}</span>
            </div>
          </div>
          <Link className="btn large" to={momentoSiguiente.accion.destino(siguiente.uuid)}>
            {momentoSiguiente.accion.etiqueta}
          </Link>
        </section>
      )}

      <div className="sectionhead">
        <div>
          <h2>Todos tus procesos</h2>
          <p>Tu etapa actual y el historial de cada postulación.</p>
        </div>
      </div>

      {procesos.length === 0 ? (
        <div className="callout">
          <b>Todavía no has postulado</b>
          <p>
            Cuando envíes una postulación aparecerá aquí, con su etapa y lo que te toca
            hacer.
          </p>
        </div>
      ) : (
        <div className="process-list">
          {procesos.map((p) => (
            <TarjetaProceso key={p.uuid} p={p} />
          ))}
        </div>
      )}

      <section className="privacy-panel">
        <div className="sectionhead" style={{ marginTop: 0 }}>
          <div>
            <h2>Privacidad y control</h2>
            <p>Puedes retirar una postulación o solicitar la eliminación de tus datos.</p>
          </div>
        </div>
        <div className="card">
          <div className="row">
            <div>
              <b style={{ fontSize: 12 }}>Gestionar mis datos</b>
              <p className="small" style={{ margin: '5px 0 0' }}>
                Consulta el consentimiento y administra tus solicitudes.
              </p>
            </div>
            <Link className="btn" to={rutas.privacidad()}>
              Abrir opciones
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
