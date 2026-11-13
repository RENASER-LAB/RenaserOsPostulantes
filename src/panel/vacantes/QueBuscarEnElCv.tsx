/**
 * «Qué buscar en el CV» (V80) en el panel: la casilla privada del formulario, los
 * puntos y el orden del ranking, el bloque de la ficha y la confirmación de
 * cambiar las líneas con candidatos dentro.
 *
 * Nada de esto lo ve el candidato: la casilla lleva su chip «Solo lo ve tu
 * equipo», y el backend no la manda a ninguna pantalla del portal.
 *
 * ⚠️ **Sin textos de ayuda bajo los campos** (decisión 6): etiquetas, chips,
 * estados y errores, sí; párrafos que expliquen, no.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { volverABuscarEnElCv } from '../api/panel'
import type { BusquedaEnElCv, FilaRanking, LineaBuscadaEnElCv } from '../api/tipos'
import { IconoAviso, IconoCandado, IconoCruz, IconoLupa, IconoMenos, IconoVisto } from '@/ui/Iconos'
import vacantes from './Vacantes.module.css'
// El control segmentado es el del corte de la tabla: se reutiliza, no se copia.
import vacantesDeLaTabla from './Vacante.module.css'
import propios from './QueBuscarEnElCv.module.css'
import {
  MAXIMO_LINEAS,
  MOTIVO_LARGA,
  MOTIVO_PROHIBIDA,
  MOTIVO_SOBRA,
  lineaDeEstado,
  puntosDichos,
  recuentosDeLaBusqueda,
  revisarLineas,
} from './reglasQueBuscar'

// ---------- La casilla del formulario ----------

/**
 * La casilla privada, debajo de «Lo que se busca». Con la vacante cerrada o
 * archivada se ve en solo lectura y sin la vista previa.
 */
export function CasillaQueBuscar({
  valor,
  alCambiar,
  soloLectura = false,
}: {
  valor: string
  alCambiar?: (valor: string) => void
  soloLectura?: boolean
}) {
  const revision = revisarLineas(valor)
  return (
    <div className={`${vacantes.anchoEntero} ${propios.casilla}`}>
      <label className={propios.recuadroPrivado}>
        <span className={propios.cabeceraCasilla}>
          <span className={vacantes.etiqueta}>Qué buscar en el CV, uno por línea</span>
          <span className={propios.chipPrivado}>
            <IconoCandado tamano={14} />
            Solo lo ve tu equipo
          </span>
        </span>
        <textarea
          className={vacantes.area}
          value={valor}
          readOnly={soloLectura}
          aria-invalid={revision.hayErrores || undefined}
          onChange={(e) => alCambiar?.(e.target.value)}
        />
      </label>
      {!soloLectura && (
        <section className={propios.vistaPrevia} aria-label="La IA buscará esto en cada CV que llegue">
          <div className={propios.cabeceraPrevia}>
            <b>La IA buscará esto en cada CV que llegue</b>
            <span className={propios.cuantasCaben}>
              {revision.seGuardan.length} de {MAXIMO_LINEAS} como máximo
            </span>
          </div>
          {revision.lineas.length === 0 ? (
            <p className={propios.nadaTodavia}>
              Nada todavía. Sin líneas, la ficha no muestra el checklist.
            </p>
          ) : (
            <ul className={propios.lineasPrevias}>
              {revision.lineas.map((linea) => {
                const mala = linea.como === 'PROHIBIDA' || linea.como === 'LARGA'
                return (
                  <li
                    key={linea.texto}
                    className={[
                      propios.lineaPrevia,
                      mala ? propios.lineaMala : null,
                      linea.como === 'SOBRA' ? propios.lineaSobra : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {mala ? <IconoAviso tamano={16} /> : <IconoLupa tamano={16} />}
                    <span className={propios.textoPrevio}>{linea.texto}</span>
                    {linea.como === 'PROHIBIDA' && (
                      <span className={propios.motivoPrevio}>{MOTIVO_PROHIBIDA}</span>
                    )}
                    {linea.como === 'LARGA' && (
                      <span className={propios.motivoPrevio}>{MOTIVO_LARGA}</span>
                    )}
                    {linea.como === 'SOBRA' && (
                      <span className={propios.motivoPrevio}>{MOTIVO_SOBRA}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

// ---------- Los puntos del ranking ----------

const CLASE_DEL_PUNTO: Record<string, string | undefined> = {
  TIENE: propios.puntoTiene,
  MENCIONA: propios.puntoMenciona,
  NO_APARECE: propios.puntoNoAparece,
}

/**
 * Un punto por línea, en su orden, bajo el nombre y el correo: verde lo tiene,
 * ámbar lo menciona, blanco con borde no aparece, punteado pendiente o buscando.
 * En su lugar, «CV sin texto» o «No se pudo buscar».
 */
export function PuntosDeLoBuscado({ busqueda }: { busqueda: BusquedaEnElCv | null | undefined }) {
  if (!busqueda) return null
  if (busqueda.estado === 'SIN_TEXTO' || busqueda.estado === 'FALLIDA') {
    return (
      <span className={propios.etiquetaPunto}>
        {busqueda.estado === 'SIN_TEXTO' ? 'CV sin texto' : 'No se pudo buscar'}
      </span>
    )
  }
  return (
    <span className={propios.puntos}>
      <span className={propios.paraLectores}>{puntosDichos(busqueda)}</span>
      {busqueda.lineas.map((linea) => (
        <span
          key={linea.orden}
          aria-hidden="true"
          className={`${propios.punto} ${
            (linea.estado && CLASE_DEL_PUNTO[linea.estado]) ?? propios.puntoPendiente
          }`}
        />
      ))}
    </span>
  )
}

// ---------- La línea de estado y el orden ----------

/**
 * «5 de 7 listos · 1 buscando · 1 CV sin texto» y el control «De siempre | Por lo
 * buscado», el mismo segmentado que el corte de la tabla. Solo sale si la vacante
 * busca algo.
 */
export function EstadoDeLoBuscado({
  filas,
  porLoBuscado,
  alCambiarOrden,
}: {
  filas: FilaRanking[]
  porLoBuscado: boolean
  alCambiarOrden: (porLoBuscado: boolean) => void
}) {
  return (
    <div className={propios.estadoYOrden}>
      <p className={propios.lineaDeEstado}>
        <IconoVisto tamano={16} />
        {lineaDeEstado(recuentosDeLaBusqueda(filas))}
      </p>
      <div className={propios.orden}>
        <span id="orden-por-lo-buscado">Orden</span>
        <div className={vacantesDeLaTabla.vistas} role="group" aria-labelledby="orden-por-lo-buscado">
          {([false, true] as const).map((cual) => (
            <button
              key={String(cual)}
              type="button"
              className={porLoBuscado === cual ? vacantesDeLaTabla.vistaActiva : vacantesDeLaTabla.vista}
              aria-pressed={porLoBuscado === cual}
              onClick={() => alCambiarOrden(cual)}
            >
              {cual ? 'Por lo buscado' : 'De siempre'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- El bloque de la ficha ----------

const ETIQUETA_DE_LA_LINEA: Record<string, string> = {
  TIENE: 'Lo tiene',
  MENCIONA: 'Lo menciona, sin detalle',
  NO_APARECE: 'No aparece',
}

const cifra = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : Number(valor).toLocaleString('es-PE', { maximumFractionDigits: 2 })

function IconoDeLaLinea({ estado }: { estado: LineaBuscadaEnElCv['estado'] }) {
  if (estado === 'TIENE') {
    return (
      <span className={`${propios.iconoLinea} ${propios.iconoTiene}`}>
        <IconoVisto tamano={14} />
      </span>
    )
  }
  if (estado === 'MENCIONA') {
    return (
      <span className={`${propios.iconoLinea} ${propios.iconoMenciona}`}>
        <IconoMenos tamano={14} />
      </span>
    )
  }
  return (
    <span className={`${propios.iconoLinea} ${propios.iconoNoAparece}`}>
      <IconoCruz tamano={14} />
    </span>
  )
}

/**
 * Lo primero de la ficha, en cualquier pestaña: el recuento, la nota del CV con
 * sus dos filas y una fila por línea buscada. En lugar de la lista, el estado si
 * no terminó; con «No se pudo buscar», «Volver a buscar» a quien tiene
 * `ajustar_nota`.
 */
export function LoBuscadoEnLaFicha({
  fila,
  peso,
  puedeVolverABuscar,
}: {
  fila: FilaRanking
  /** Cuánto pesa «Qué buscar en el CV» en la nota del CV, en %. */
  peso: number | null | undefined
  /** `ajustar_nota`, y la vacante ni cerrada ni archivada. */
  puedeVolverABuscar: boolean
}) {
  const busqueda = fila.busqueda
  const cache = useQueryClient()
  const [aviso, setAviso] = useState<string | null>(null)
  // La guarda de verdad contra el doble clic: el `disabled` llega en el render siguiente.
  const yaSeEnvio = useRef(false)
  const otraVez = useMutation({
    mutationFn: () => volverABuscarEnElCv(fila.postulacionId),
    onSuccess: async (respuesta) => {
      setAviso(respuesta.mensaje)
      await cache.invalidateQueries({ queryKey: ['panel-ranking'] })
    },
    onError: (causa) =>
      setAviso(causa instanceof Error ? causa.message : 'No se pudo volver a buscar.'),
    onSettled: () => {
      yaSeEnvio.current = false
    },
  })
  if (!busqueda) return null

  const terminada = busqueda.estado === 'TERMINADA'
  // La fila de la nota dice lo mismo que el estado de abajo: fallida no es «buscando».
  const comoVaLoBuscado = terminada
    ? `${busqueda.tiene} de ${busqueda.total}`
    : busqueda.estado === 'FALLIDA'
      ? 'no se pudo buscar'
      : 'buscando…'
  const p = peso ?? 0
  const notaDelCv = fila.notaCurriculum
  return (
    <section className={propios.bloqueFicha} aria-label="Qué buscar en el CV">
      <h4 className={propios.tituloBloque}>
        Qué buscar en el CV
        {terminada && (
          <span className={propios.recuentoBloque}>
            {busqueda.tiene} de {busqueda.total}
          </span>
        )}
      </h4>

      {notaDelCv !== null && notaDelCv !== undefined && busqueda.estado !== 'SIN_TEXTO' && (
        <div className={propios.notaDelCv}>
          <span className={propios.notaDelCvTitulo}>Nota del CV</span>
          <span className={propios.notaDelCvCifra}>{cifra(notaDelCv)}</span>
          <span>Criterios generales</span>
          <span className={propios.pesa}>
            {terminada ? `pesan ${cifra(100 - p)} %` : 'por ahora, todo'}
          </span>
          <span className={propios.cifraParte}>{cifra(busqueda.notaCriteriosGenerales)}</span>
          <span>Qué buscar en el CV · {comoVaLoBuscado}</span>
          <span className={propios.pesa}>{terminada ? `pesa ${cifra(p)} %` : 'aún no suma'}</span>
          <span className={propios.cifraParte}>
            {terminada ? cifra(busqueda.notaLoBuscado) : '—'}
          </span>
        </div>
      )}

      {terminada ? (
        <ul className={propios.listaBuscada}>
          {busqueda.lineas.map((linea) => (
            <li key={linea.orden} className={propios.lineaBuscada}>
              <IconoDeLaLinea estado={linea.estado} />
              <span className={propios.textoLinea}>{linea.texto}</span>
              <span
                className={`${propios.etiquetaLinea} ${
                  linea.estado === 'TIENE'
                    ? propios.etiquetaTiene
                    : linea.estado === 'MENCIONA'
                      ? propios.etiquetaMenciona
                      : propios.etiquetaNoAparece
                }`}
              >
                {ETIQUETA_DE_LA_LINEA[linea.estado ?? 'NO_APARECE']}
              </span>
              {linea.frase && (
                <p className={`${propios.detalleLinea} ${propios.frase}`}>«{linea.frase}»</p>
              )}
              {linea.nota && <p className={propios.detalleLinea}>{linea.nota}</p>}
              {linea.estado !== 'TIENE' && linea.pregunta && (
                <p className={propios.detalleLinea}>
                  <b>Para la entrevista:</b> {linea.pregunta}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={propios.estadoEnLugar}>
          {busqueda.estado === 'SIN_TEXTO'
            ? 'CV sin texto: no se pudo buscar.'
            : busqueda.estado === 'FALLIDA'
              ? 'No se pudo buscar.'
              : 'Buscando en su CV…'}
          {busqueda.estado === 'FALLIDA' && puedeVolverABuscar && (
            <button
              type="button"
              className={vacantes.secundarioModal}
              disabled={otraVez.isPending}
              onClick={() => {
                if (yaSeEnvio.current) return
                yaSeEnvio.current = true
                setAviso(null)
                otraVez.mutate()
              }}
            >
              {otraVez.isPending ? 'Encolando…' : 'Volver a buscar'}
            </button>
          )}
        </p>
      )}
      {aviso && (
        <p className={propios.nadaTodavia} role="status">
          {aviso}
        </p>
      )}
    </section>
  )
}

// ---------- La confirmación de cambiar las líneas ----------

/**
 * «¿Volver a buscar en N CV?» antes de guardar líneas distintas con CV calificados.
 * Quitar todas también pregunta.
 *
 * Va DENTRO del modal de edición, arriba, como la pregunta de descartar cambios: un
 * segundo modal encima del primero se pelearía con él por el foco y por Escape.
 * El formulario sigue montado debajo, así que «Cancelar» devuelve lo escrito tal
 * cual. A prueba de doble clic con `yaSeEnvio`, como la de los pesos.
 */
export function ConfirmarNuevaBusqueda({
  cvs,
  quitando,
  guardando,
  alCancelar,
  alConfirmar,
}: {
  cvs: number
  /** Si se quitan todas las líneas: no se vuelve a buscar nada. */
  quitando: boolean
  guardando: boolean
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const yaSeEnvio = useRef(false)
  // Si el guardado falla, se puede volver a confirmar.
  useEffect(() => {
    if (!guardando) yaSeEnvio.current = false
  }, [guardando])
  const enCv = `${cvs} CV`
  const titulo = quitando ? `¿Quitar lo que se busca en ${enCv}?` : `¿Volver a buscar en ${enCv}?`
  return (
    <div className={vacantes.descartar} role="alertdialog" aria-label={titulo}>
      <p className={vacantes.descartarTexto}>
        <b>{titulo}</b>
        <br />
        {quitando
          ? 'Las notas del CV vuelven a los criterios generales.'
          : 'Las notas del CV se recalculan al terminar.'}
        <br />
        No cambia nadie de etapa.
      </p>
      <div className={vacantes.descartarBotones}>
        <button
          className={vacantes.secundarioModal}
          type="button"
          onClick={alCancelar}
          disabled={guardando}
        >
          Cancelar
        </button>
        <button
          className={vacantes.guardar}
          type="button"
          autoFocus
          disabled={guardando}
          onClick={() => {
            if (yaSeEnvio.current) return
            yaSeEnvio.current = true
            alConfirmar()
          }}
        >
          {guardando ? 'Guardando…' : quitando ? 'Guardar y quitar' : 'Guardar y volver a buscar'}
        </button>
      </div>
    </div>
  )
}
