import { useState, type ReactNode } from 'react'
import type {
  BloqueDelInforme,
  CriterioDelInforme,
  Informe,
  PreguntaDelAnexo,
  PuntoDelInforme,
} from '@/panel/api/informes'
import { IconoDesplegar } from '@/ui/Iconos'
import estilos from './Visor.module.css'

const ORIGEN: Record<string, string> = { CV: 'CV', EVALUACION: 'Evaluación', PRUEBA: 'Prueba' }

/**
 * El informe como página: los mismos datos del PDF, organizados para leer rápido.
 *
 * Arriba el resumen; «Qué se evaluó» con barras que se despliegan; los bloques en
 * tarjetas con su icono; lo pendiente con chips de origen; y el anexo en acordeón
 * cerrado. **Nada se recorta: lo largo se despliega.**
 */
export function CuerpoDelInforme({ informe }: { informe: Informe }) {
  return (
    <div className={estilos.informe}>
      <div className={estilos.izquierda}>
        {informe.aviso && (
          <section className={estilos.aviso} role="note">
            {informe.aviso}
          </section>
        )}
        {informe.experiencia && <Experiencia informe={informe} />}
        {informe.etapa !== 'CV' && informe.resumen?.texto && (
          <section className={estilos.seccion} aria-label={informe.resumen.titulo}>
            <span className={estilos.etiqueta}>{informe.resumen.titulo}</span>
            <p className={estilos.resumen}>{informe.resumen.texto}</p>
          </section>
        )}
        {informe.evaluado && <QueSeEvaluo informe={informe} />}
        {informe.detalle.length > 0 && <ElPorque informe={informe} />}
        {informe.anexo && <ElAnexo informe={informe} />}
      </div>
      <div className={estilos.derecha}>
        {informe.bloques.map((bloque) => (
          <Bloque key={bloque.codigo} bloque={bloque} enLaPrueba={informe.etapa === 'PRUEBA'} />
        ))}
        <span className={estilos.meta}>
          Generado el {formatear(informe.generadoEn)}
          {informe.nota.base ? ` · ${informe.nota.base}` : ''}
        </span>
      </div>
    </div>
  )
}

function formatear(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(new Date(iso))
}

function Experiencia({ informe }: { informe: Informe }) {
  const e = informe.experiencia!
  return (
    <section className={estilos.seccion} aria-label="Experiencia profesional">
      <span className={estilos.etiqueta}>Experiencia profesional</span>
      <div className={estilos.experiencia}>
        <div className={estilos.datoBruma}>
          <span className={estilos.etiquetaChica}>Total</span>
          <span className={estilos.datoGrande}>{e.total}</span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.etiquetaChica}>Último puesto</span>
          <span className={estilos.datoFuerte}>{e.ultimoPuesto}</span>
          {e.ultimoDetalle && <span className={estilos.datoSub}>{e.ultimoDetalle}</span>}
        </div>
        <div className={estilos.dato}>
          <span className={estilos.etiquetaChica}>Formación máxima</span>
          <span className={estilos.datoFuerte}>{e.formacion}</span>
        </div>
      </div>
      {e.habilidades.length > 0 && (
        <div className={estilos.pastillas}>
          {e.habilidades.map((h) => (
            <span key={h} className={estilos.pastilla}>
              {h}
            </span>
          ))}
        </div>
      )}
      {e.perfil && <p className={estilos.perfil}>{e.perfil}</p>}
      {informe.resumen?.texto && (
        <div className={estilos.detalle}>
          <span className={estilos.etiqueta}>{informe.resumen.titulo}</span>
          <p className={estilos.resumen}>{informe.resumen.texto}</p>
        </div>
      )}
    </section>
  )
}

function QueSeEvaluo({ informe }: { informe: Informe }) {
  const evaluado = informe.evaluado!
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (nombre: string) =>
    setAbiertos((antes) => {
      const despues = new Set(antes)
      if (despues.has(nombre)) despues.delete(nombre)
      else despues.add(nombre)
      return despues
    })
  return (
    <section className={estilos.seccion} aria-label="Qué se evaluó">
      <div className={estilos.entreDos}>
        <span className={estilos.etiqueta}>Qué se evaluó</span>
        {evaluado.escala && <span className={estilos.meta}>{evaluado.escala}</span>}
      </div>
      {evaluado.criterios.length === 0 ? (
        <p className={estilos.vacio}>Sin datos</p>
      ) : (
        <div>
          {evaluado.criterios.map((c) => (
            <Criterio
              key={c.nombre}
              criterio={c}
              abierto={abiertos.has(c.nombre)}
              alPulsar={() => alternar(c.nombre)}
            />
          ))}
        </div>
      )}
      {evaluado.pie && <span className={estilos.meta}>{evaluado.pie}</span>}
    </section>
  )
}

function Criterio({
  criterio,
  abierto,
  alPulsar,
}: {
  criterio: CriterioDelInforme
  abierto: boolean
  alPulsar: () => void
}) {
  const deRedactor = criterio.texto != null && criterio.texto !== criterio.explicacion
  const hayQueDesplegar = Boolean(criterio.texto || criterio.explicacion || criterio.motivoAjuste ||
    criterio.pendiente || criterio.preguntas)
  return (
    <div className={estilos.criterio}>
      <button
        type="button"
        className={estilos.desplegar}
        aria-expanded={abierto}
        onClick={alPulsar}
        disabled={!hayQueDesplegar}
      >
        <span className={estilos.nombreCriterio}>
          <span>{criterio.nombre}</span>
          {criterio.quien && <span className={estilos.quienPuso}>{criterio.quien}</span>}
          {criterio.ajustada && (
            <span className={estilos.ajustada} title="Ajustada a mano">
              ✎ Ajustada
            </span>
          )}
        </span>
        <span className={estilos.pista} aria-hidden="true">
          <span className={estilos.lleno} style={{ width: `${criterio.porcentaje ?? 0}%` }} />
        </span>
        <span className={estilos.notaCriterio}>
          {criterio.nota == null ? '—' : criterio.notaTexto}
          {criterio.nota != null && criterio.maximoTexto && (
            <span className={estilos.maximo}> {criterio.maximoTexto}</span>
          )}
        </span>
        <span className={abierto ? estilos.iconoAbierto : estilos.icono} aria-hidden="true">
          <IconoDesplegar tamano={16} />
        </span>
      </button>
      {abierto && (
        <div className={estilos.textosCriterio}>
          {deRedactor && (
            <div className={estilos.demostro}>
              <span className={estilos.etiquetaAzul}>Lo que demostró</span>
              <span>{criterio.texto}</span>
            </div>
          )}
          {(criterio.explicacion || criterio.motivoAjuste || criterio.pendiente || criterio.preguntas) && (
            <div className={estilos.porQueNota}>
              <span className={estilos.etiquetaChica}>Por qué esta nota</span>
              {criterio.explicacion && <span>{criterio.explicacion}</span>}
              {criterio.ajustada && (
                <span className={estilos.ajustada}>
                  ✎ Ajustada a mano{criterio.motivoAjuste ? `: ${criterio.motivoAjuste}` : ''}
                </span>
              )}
              {criterio.nota == null && criterio.pendiente && <span>{criterio.pendiente}</span>}
              {criterio.preguntas && <span className={estilos.meta}>{criterio.preguntas}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ElPorque({ informe }: { informe: Informe }) {
  return (
    <section className={estilos.seccion} aria-label={informe.detalleTitulo ?? 'El porqué de cada nota'}>
      <span className={estilos.etiqueta}>{informe.detalleTitulo ?? 'El porqué de cada nota'}</span>
      {informe.detalle.map((d, i) => (
        <div key={`${d.numero ?? i}-${d.titulo}`} className={estilos.detalle}>
          <div className={estilos.entreDos}>
            <b>
              {d.numero != null ? `${d.numero}. ` : ''}
              {d.titulo}
            </b>
            {d.notaTexto && <span className={estilos.chip}>{d.notaTexto}</span>}
          </div>
          {d.meta && <span className={estilos.etiquetaChica}>{d.meta}</span>}
          {d.ajustada && (
            <span className={estilos.ajustada}>
              ✎ Ajustada a mano{d.motivoAjuste ? `: ${d.motivoAjuste}` : ''}
            </span>
          )}
          {d.explicacion && <span>{d.explicacion}</span>}
          {d.evidencia && <span className={estilos.datoSub}>Citó: «{d.evidencia}»</span>}
          {d.senales.length > 0 && (
            <span className={estilos.meta}>
              {d.senales.map((s) => `${s.cumple ? '✓' : '—'} ${s.nombre}`).join(' · ')}
            </span>
          )}
          {d.pendiente && <span className={estilos.meta}>{d.pendiente}</span>}
        </div>
      ))}
      {informe.detallePie && <span className={estilos.meta}>{informe.detallePie}</span>}
    </section>
  )
}

function ElAnexo({ informe }: { informe: Informe }) {
  const anexo = informe.anexo!
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set())
  const todas = anexo.preguntas.length > 0 && abiertas.size === anexo.preguntas.length
  const alternar = (n: number) =>
    setAbiertas((antes) => {
      const despues = new Set(antes)
      if (despues.has(n)) despues.delete(n)
      else despues.add(n)
      return despues
    })
  return (
    <section className={estilos.seccion} aria-label="Anexo">
      <div className={estilos.entreDos}>
        <div>
          <span className={estilos.etiqueta}>Anexo</span>
          <div className={estilos.datoGrande}>{anexo.titulo}</div>
        </div>
        {anexo.preguntas.length > 0 && (
          <button
            type="button"
            className={estilos.botonChico}
            onClick={() =>
              setAbiertas(todas ? new Set() : new Set(anexo.preguntas.map((p) => p.numero)))
            }
          >
            {todas ? 'Cerrar todas' : 'Abrir todas'}
          </button>
        )}
      </div>
      {anexo.caso && (
        <div className={estilos.demostro}>
          <span className={estilos.etiquetaAzul}>El caso que se le planteó</span>
          <span style={{ whiteSpace: 'pre-line' }}>{anexo.caso}</span>
        </div>
      )}
      <div>
        {anexo.preguntas.map((p) => (
          <Pregunta
            key={p.numero}
            pregunta={p}
            abierta={abiertas.has(p.numero)}
            alPulsar={() => alternar(p.numero)}
          />
        ))}
      </div>
      {anexo.entregables.length > 0 && (
        <div className={estilos.detalle}>
          <div className={estilos.entreDos}>
            <span className={estilos.etiqueta}>Entregables pedidos</span>
            {anexo.entregablesResumen && <span className={estilos.meta}>{anexo.entregablesResumen}</span>}
          </div>
          {anexo.entregables.map((e) => (
            <div key={e.nombre} className={estilos.entregable}>
              <span className={estilos.entregableTexto}>
                <b>{e.nombre}</b>
                <span className={estilos.meta}>{e.detalle}</span>
              </span>
              <span className={e.entregado ? estilos.entregado : estilos.noEntregado}>
                {e.entregado ? 'Entregado' : 'No entregado'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Pregunta({
  pregunta,
  abierta,
  alPulsar,
}: {
  pregunta: PreguntaDelAnexo
  abierta: boolean
  alPulsar: () => void
}) {
  return (
    <div className={estilos.pregunta}>
      <button type="button" className={estilos.abrirPregunta} aria-expanded={abierta} onClick={alPulsar}>
        <span className={estilos.circulo}>{pregunta.numero}</span>
        <span className={estilos.textoPregunta}>
          <span className={estilos.enunciado}>{pregunta.enunciado}</span>
          {pregunta.meta && <span className={estilos.etiquetaChica}>{pregunta.meta}</span>}
          {pregunta.loQueDemostro && (
            <span className={estilos.lineaDemostro}>
              <b>Lo que demostró:</b> {pregunta.loQueDemostro}
            </span>
          )}
        </span>
        <span className={abierta ? estilos.iconoAbierto : estilos.icono} aria-hidden="true">
          <IconoDesplegar tamano={16} />
        </span>
      </button>
      {abierta &&
        (pregunta.respuesta == null ? (
          <div className={estilos.sinRespuesta}>Sin respuesta.</div>
        ) : (
          <div className={estilos.respuesta}>
            <span className={estilos.etiquetaChica}>Su respuesta</span>
            {pregunta.respuesta}
          </div>
        ))}
    </div>
  )
}

function Bloque({ bloque, enLaPrueba }: { bloque: BloqueDelInforme; enLaPrueba: boolean }) {
  const pendiente = bloque.tono === 'PENDIENTE' || bloque.tono === 'CV'
  return (
    <section
      className={bloque.tono === 'PENDIENTE' ? estilos.bloquePendiente : estilos.bloque}
      aria-label={bloque.titulo}
    >
      <div className={estilos.tituloBloque}>
        <IconoDelBloque tono={bloque.tono} />
        <h3 className={claseDelTono(bloque.tono)}>{bloque.titulo}</h3>
        {pendiente && bloque.puntos.length > 0 && (
          <span className={estilos.meta}>{bloque.puntos.length}</span>
        )}
      </div>
      {bloque.puntos.length === 0 ? (
        <p className={estilos.vacio}>{bloque.vacio}</p>
      ) : pendiente ? (
        enLaPrueba && bloque.tono === 'PENDIENTE' ? (
          <PendienteEnGrupos puntos={bloque.puntos} />
        ) : (
          bloque.puntos.map((p, i) => <Duda key={`${i}-${p.texto}`} punto={p} />)
        )
      ) : (
        <ul className={estilos.puntos}>
          {bloque.puntos.map((p, i) => (
            <li key={`${i}-${p.texto}`}>
              {p.texto}
              {p.detalle && <span className={estilos.sugerencia}> → {p.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Lo pendiente de la entrevista, en sus tres grupos y nunca recortado: «De la
 * prueba» y «De la evaluación» abiertos, y «Del CV (N)» plegado —suele ser el más
 * largo—, con un clic para desplegarlo entero.
 */
function PendienteEnGrupos({ puntos }: { puntos: PuntoDelInforme[] }) {
  const grupos: { nombre: string; puntos: PuntoDelInforme[] }[] = []
  for (const p of puntos) {
    const nombre = p.grupo ?? 'Pendiente'
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.nombre === nombre) ultimo.puntos.push(p)
    else grupos.push({ nombre, puntos: [p] })
  }
  return (
    <>
      {grupos.map((g) => (
        <GrupoPendiente key={g.nombre} nombre={g.nombre} puntos={g.puntos} plegado={g.nombre === 'Del CV'} />
      ))}
    </>
  )
}

function GrupoPendiente({
  nombre,
  puntos,
  plegado,
}: {
  nombre: string
  puntos: PuntoDelInforme[]
  plegado: boolean
}) {
  const [abierto, setAbierto] = useState(!plegado)
  return (
    <div>
      <button
        type="button"
        className={estilos.grupoPendiente}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        <span>
          {nombre} ({puntos.length})
        </span>
        <span className={abierto ? estilos.iconoAbierto : estilos.icono} aria-hidden="true">
          <IconoDesplegar tamano={14} />
        </span>
      </button>
      {abierto && puntos.map((p, i) => <Duda key={`${i}-${p.texto}`} punto={p} />)}
    </div>
  )
}

function Duda({ punto }: { punto: PuntoDelInforme }) {
  const chips = [punto.origen ? ORIGEN[punto.origen] : null, punto.etiqueta].filter(Boolean)
  return (
    <div className={estilos.duda} style={{ marginTop: 8 }}>
      <span className={estilos.dudaTitulo}>
        {chips.map((c) => (
          <span key={c} className={estilos.chip}>
            {c}
          </span>
        ))}
        <span>{punto.texto}</span>
      </span>
      {punto.detalle && <span className={estilos.dudaPregunta}>{punto.detalle}</span>}
    </div>
  )
}

function claseDelTono(tono: BloqueDelInforme['tono']): string {
  switch (tono) {
    case 'BIEN':
      return estilos.bien ?? ''
    case 'MAL':
      return estilos.mal ?? ''
    case 'PENDIENTE':
      return estilos.pendiente ?? ''
    default:
      return estilos.neutro ?? ''
  }
}

function IconoDelBloque({ tono }: { tono: BloqueDelInforme['tono'] }): ReactNode {
  const comun = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    style: { flexShrink: 0 },
  }
  switch (tono) {
    case 'BIEN':
      return (
        <svg {...comun} stroke="#0B7A63">
          <circle cx="12" cy="12" r="10" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      )
    case 'MAL':
      return (
        <svg {...comun} stroke="#C22A3F">
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      )
    case 'NEUTRO':
      return (
        <svg {...comun} stroke="#2B2F2D">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      )
    default:
      return (
        <svg {...comun} stroke={tono === 'PENDIENTE' ? '#1E3A8A' : '#111312'}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M9.5 8.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5" />
          <path d="M12 15h.01" />
        </svg>
      )
  }
}
