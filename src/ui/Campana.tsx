/**
 * La campana: lo que paso mientras no estaba.
 *
 * El portal solo sabia avisar de una forma —mandando un correo— y el correo se
 * pierde: cae en promociones, se marca leido sin abrir, llega a una direccion
 * que el cargador de curriculums invento y que nadie mira. Cuando la persona
 * entra, lo que ocurrio entretanto no estaba en ninguna parte.
 *
 * Tres decisiones:
 *
 *   - **El punto es ambar, no violeta.** En «El canto» el violeta significa una
 *     sola cosa, «te toca a ti». Un aviso no es un turno suyo: es algo que pasó
 *     y que puede cambiar su decision, que es literalmente `--duda`.
 *   - **Se apaga al ABRIRLA, no al abrir cada proceso.** Enterarse de que hay
 *     algo es lo que lo apaga. Los avisos siguen ahi para releerlos.
 *   - **Sin sesion no se pide nada.** El tablon se sirve sin cuenta, y una
 *     consulta con token vacio serian 401 en cada visita anonima.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { marcarAvisosLeidos, misAvisos } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import estilos from './Campana.module.css'

/** Cuando paso, en palabras. Para un aviso, «hace dos dias» dice mas que la fecha. */
function hace(iso: string): string {
  const cuando = new Date(iso).getTime()
  if (Number.isNaN(cuando)) return ''
  const minutos = Math.floor((Date.now() - cuando) / 60000)
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}

export function Campana() {
  const { hayCuenta } = useSesion()
  const cache = useQueryClient()
  const [abierta, setAbierta] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  const consulta = useQuery({
    queryKey: ['avisos'],
    queryFn: misAvisos,
    enabled: hayCuenta,
  })

  const marcar = useMutation({
    mutationFn: marcarAvisosLeidos,
    // Se invalidan las dos: la campana y la lista de procesos, que pinta el
    // mismo punto en cada fila. Sin esto, apagar la campana dejaria los puntos
    // de «Mis procesos» encendidos hasta la siguiente recarga.
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['avisos'] }),
        cache.invalidateQueries({ queryKey: ['postulaciones'] }),
      ])
    },
  })

  const avisos = consulta.data?.avisos ?? []
  const sinLeer = consulta.data?.sinLeer ?? 0

  /*
    Cerrar al pulsar fuera y con Escape.

    Las dos, no una: el raton cierra pulsando fuera y el teclado cierra con
    Escape, y quedarse solo con la primera deja atrapado a quien navega con
    tabulador —el foco sigue dentro de un panel que no sabe como cerrar—.
  */
  useEffect(() => {
    if (!abierta) return

    function fuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierta(false)
      }
    }
    function escape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierta(false)
        // El foco vuelve al boton: dejarlo en el aire manda al tabulador al
        // principio de la pagina, que para quien no ve la pantalla es perderse.
        boton.current?.focus()
      }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierta])

  if (!hayCuenta) return null

  function alternar() {
    const abriendo = !abierta
    setAbierta(abriendo)
    // Al abrir, y solo si habia algo: una llamada por cada clic en una campana
    // vacia es trafico que no apaga nada.
    if (abriendo && sinLeer > 0) {
      marcar.mutate()
    }
  }

  return (
    <div className={estilos.contenedor} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={estilos.boton}
        onClick={alternar}
        aria-expanded={abierta}
        aria-haspopup="true"
        // El nombre lleva la cuenta: quien usa lector de pantalla no ve el
        // punto, y «Avisos» a secas no le dice que hay algo nuevo.
        aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      >
        <IconoCampana />
        {sinLeer > 0 && (
          <span className={estilos.punto} aria-hidden="true">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div className={estilos.panel} role="dialog" aria-label="Tus avisos">
          <p className={estilos.tituloPanel}>Avisos</p>

          {consulta.isPending && <p className={estilos.vacio}>Buscando…</p>}

          {consulta.isError && (
            <p className={estilos.vacio} role="alert">
              No pudimos cargar tus avisos. Vuelve a intentarlo en un momento.
            </p>
          )}

          {consulta.isSuccess && avisos.length === 0 && (
            <p className={estilos.vacio}>
              Nada nuevo por ahora. Aquí te contaremos lo que cambie en los procesos
              en los que estás.
            </p>
          )}

          <ul className={estilos.lista}>
            {avisos.map((aviso) => {
              const cuerpo = (
                <>
                  <span className={estilos.tituloAviso}>{aviso.titulo}</span>
                  <span className={estilos.cuerpoAviso}>{aviso.cuerpo}</span>
                  <span className={estilos.cuando}>{hace(aviso.creadoEn)}</span>
                </>
              )
              return (
                <li
                  key={aviso.id}
                  className={aviso.leidoEn ? estilos.aviso : `${estilos.aviso} ${estilos.nuevo}`}
                >
                  {/*
                    Con proceso detras es un enlace; sin el, texto. Un enlace que
                    no lleva a ninguna parte es peor que no tenerlo: se pulsa, no
                    pasa nada, y la proxima vez ya no se pulsa ninguno.
                  */}
                  {aviso.postulacionUuid ? (
                    <Link
                      className={estilos.enlaceAviso}
                      to={rutas.proceso(aviso.postulacionUuid)}
                      onClick={() => setAbierta(false)}
                    >
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className={estilos.enlaceAviso}>{cuerpo}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** La campana, dibujada. Hereda el color: el punto se pinta aparte. */
function IconoCampana() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
