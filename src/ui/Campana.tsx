/**
 * La campana: lo que paso mientras no estaba.
 *
 * El portal solo sabia avisar de una forma —mandando un correo— y el correo se
 * pierde: cae en promociones, se marca leido sin abrir, llega a una direccion
 * que el cargador de curriculums invento y que nadie mira. Cuando la persona
 * entra, lo que ocurrio entretanto no estaba en ninguna parte.
 *
 * ## De donde sale la forma
 *
 * Sigue el patron de popover de notificaciones de Origin UI: boton de icono con
 * una **pildora numerada** encima, panel de 20rem, cabecera con «Notificaciones»
 * y «Marcar todas como leidas», separador, y una fila por aviso con su punto de
 * no leido **a la derecha** y la hora debajo.
 *
 * ⚠️ **Lo que se copio es el diseño, no el stack.** El original viene en
 * shadcn + Tailwind + Radix, y este portal no tiene ninguno de los tres: tiene
 * modulos CSS y los tokens de «El canto». Meter Tailwind al lado seria tener dos
 * sistemas de diseño discutiendo en la misma cabecera. Asi que la estructura, las
 * medidas y el comportamiento son los del original, y los colores salen de los
 * tokens de la casa.
 *
 * Dos decisiones que el diseño trae y valen mas que la forma:
 *
 *   - **Marcar leido lo decide la persona, no el hecho de abrir.** Antes se
 *     apagaban todos al abrir la campana, y con ellos el punto de cada fila de
 *     «Mis procesos» — sin que nadie hubiera leido nada. Ahora se apaga el que
 *     se pulsa, o todos con el boton de la cabecera.
 *   - **La fila entera es pulsable sin anidar interactivos.** El boton se estira
 *     con un `::after` sobre toda la tarjeta: un solo elemento en el arbol de
 *     accesibilidad y toda el area para el raton.
 *
 * Y una que NO se copia: el punto es ambar, no del color primario. En «El canto»
 * el violeta significa una sola cosa, «te toca a ti», y un aviso no le da ningun
 * turno — es `--duda`, «lo que cambia tu decision».
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { marcarAvisoLeido, marcarAvisosLeidos, misAvisos } from '@/api/portal'
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

  /*
    Las dos invalidan lo mismo: la campana y la lista de procesos, que pinta el
    mismo punto en cada fila. Sin esto, apagar un aviso aqui dejaria encendido su
    punto en «Mis procesos» hasta la siguiente recarga.
  */
  const refrescar = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['avisos'] }),
      cache.invalidateQueries({ queryKey: ['postulaciones'] }),
    ])
  }

  const marcarTodos = useMutation({ mutationFn: marcarAvisosLeidos, onSuccess: refrescar })
  const marcarUno = useMutation({ mutationFn: marcarAvisoLeido, onSuccess: refrescar })

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

  return (
    <div className={estilos.contenedor} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={estilos.boton}
        onClick={() => setAbierta((estaba) => !estaba)}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        // El nombre lleva la cuenta: quien usa lector de pantalla no ve la
        // pildora, y «Avisos» a secas no le dice que hay algo nuevo.
        aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      >
        <IconoCampana />
        {sinLeer > 0 && (
          <span className={estilos.pildora} aria-hidden="true">
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div className={estilos.panel} role="dialog" aria-label="Tus avisos">
          <div className={estilos.cabecera}>
            <span className={estilos.tituloPanel}>Avisos</span>
            {sinLeer > 0 && (
              <button
                type="button"
                className={estilos.marcarTodos}
                onClick={() => marcarTodos.mutate()}
                disabled={marcarTodos.isPending}
              >
                Marcar todos como leídos
              </button>
            )}
          </div>

          <div role="separator" aria-orientation="horizontal" className={estilos.separador} />

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

          {avisos.map((aviso) => {
            const cuerpo = (
              <>
                <span className={estilos.tituloAviso}>{aviso.titulo}</span>{' '}
                <span className={estilos.cuerpoAviso}>{aviso.cuerpo}</span>
              </>
            )
            return (
              <div key={aviso.id} className={estilos.aviso}>
                <div className={estilos.filaAviso}>
                  <div className={estilos.textoAviso}>
                    {/*
                      Con proceso detras es un enlace; sin el, un boton. Los dos
                      se estiran sobre la tarjeta entera con el mismo `::after`:
                      un solo elemento en el arbol de accesibilidad, y toda el
                      area para el raton.

                      Un enlace que no lleva a ninguna parte seria peor que no
                      tenerlo: se pulsa, no pasa nada, y la proxima vez ya no se
                      pulsa ninguno.
                    */}
                    {aviso.postulacionUuid ? (
                      <Link
                        className={estilos.enlaceAviso}
                        to={rutas.proceso(aviso.postulacionUuid)}
                        onClick={() => {
                          if (!aviso.leidoEn) marcarUno.mutate(aviso.id)
                          setAbierta(false)
                        }}
                      >
                        {cuerpo}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={estilos.enlaceAviso}
                        onClick={() => {
                          if (!aviso.leidoEn) marcarUno.mutate(aviso.id)
                        }}
                      >
                        {cuerpo}
                      </button>
                    )}
                    <div className={estilos.cuando}>{hace(aviso.creadoEn)}</div>
                  </div>

                  {!aviso.leidoEn && (
                    <div className={estilos.marcaNoLeido}>
                      <span className="solo-lectores">Sin leer</span>
                      <Punto />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** El punto de «sin leer». Seis pixeles, a la derecha y centrado con la fila. */
function Punto() {
  return (
    <svg
      width="6"
      height="6"
      fill="currentColor"
      viewBox="0 0 6 6"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="3" cy="3" r="3" />
    </svg>
  )
}

/**
 * La campana, dibujada.
 *
 * El mismo trazo que `Bell` de lucide —16 px, grosor 2— para no traerse la
 * libreria entera por un icono. Hereda el color: la pildora se pinta aparte.
 */
function IconoCampana() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
