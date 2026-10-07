/**
 * Las preguntas propias de una vacante, agrupadas por criterios (V66, fase 1).
 *
 * Arriba, la cabecera fija (V68): cuántos puntos van de 100, cuántos criterios y
 * preguntas, una barra por criterio y «⚠ N por arreglar →», que lleva de falta en
 * falta; cada una está escrita donde se arregla. Debajo, un bloque plegable por criterio
 * con sus preguntas: al entrar, plegados salvo los que tienen una falta. Solo
 * cambia la interfaz: lo que exige publicar, los datos y la API son los de siempre. Quien no quiere pensar en criterios no está
 * obligado: la primera pregunta sin criterio crea «General».
 *
 * Tres estados de la pantalla, y cada uno dice lo suyo:
 *   - **Sin nada**: «Todavía no hay preguntas», con las entradas.
 *   - **Borrador**: se escribe, se ordena y se publica.
 *   - **Publicada**: en lectura, salvo los puntos y las instrucciones de la IA.
 *
 * ⚠️ **El balance lo cuadra el servidor.** Cada cambio devuelve el editor entero
 * y se pinta tal cual (ver `consultas.ts`).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  agregarCriterio,
  guardarDatosDelBorrador,
  publicarPreguntas,
  type EditorDePreguntas as Editor,
  type VersionDePreguntas,
} from '../../api/preguntasPropias'
import { rutas } from '@/rutas'
import { IconoMas } from '@/ui/Iconos'
import { useTituloDelPanel } from '../../titulo'
import { ListaDeCriterios } from './BloqueCriterio'
import { CabeceraFija } from './CabeceraFija'
import { CopiarDeOtraVacante } from './CopiarDeOtraVacante'
import { falloDe, useEditorDePreguntas, usePonerEditor, type Fallo } from './consultas'
import { FormularioPregunta } from './FormularioPregunta'
import { preguntaNueva } from './formulario'
import { faltasSinSitio, irAlDestino, useCriteriosAbiertos, type Destino } from './navegacion'
import { ListaDeFaltas, MostrarFallo } from './piezas'
import { PreguntasPublicadas } from './PreguntasPublicadas'
import { Recomendaciones } from './Recomendaciones'
import estilos from './EditorDePreguntas.module.css'

export function EditorDePreguntas() {
  const { id } = useParams()
  const vacanteId = Number(id)
  const consulta = useEditorDePreguntas(vacanteId)
  const poner = usePonerEditor(vacanteId)
  useTituloDelPanel(consulta.data ? `${consulta.data.titulo} · Preguntas` : 'Preguntas')

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.adminVacante(vacanteId)}>
        ← La vacante
      </Link>
      {consulta.isPending && <Esqueleto />}
      {consulta.isError && (
        <p className={estilos.error} role="alert">
          No se pudieron abrir las preguntas de esta vacante. Si es de otra empresa, o se
          eliminó, no está a tu alcance.
        </p>
      )}
      {consulta.data && <Contenido editor={consulta.data} poner={poner} />}
    </div>
  )
}

function Contenido({ editor, poner }: { editor: Editor; poner: (e: Editor) => void }) {
  const [panelIa, setPanelIa] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [nuevoCriterio, setNuevoCriterio] = useState(false)
  const [nuevaPregunta, setNuevaPregunta] = useState(false)
  // El fallo de publicar va atado al borrador con el que se intentó. En cuanto el
  // servidor devuelve otro (se corrigió algo, se copió encima…), la lista de faltas
  // ya no es la de ese borrador y dejaría al balance diciendo una cosa y ella otra.
  const [fallo, setFallo] = useState<{ de: VersionDePreguntas; fallo: Fallo } | null>(null)

  const borrador = editor.borrador
  const publicada = editor.publicada
  const editable = editor.puedeEditar
  const noLasUsa = !editor.aplicaEvaluacion || editor.origen !== 'VACANTE'
  // Mientras hay borrador, se trabaja en él. Si solo hay publicada y ya hay gente
  // dentro, no se abren borradores: la vara no se mueve.
  const puedeEscribir = editable && (borrador !== null || !(publicada && editor.hayPostulantes))
  const base: VersionDePreguntas | null = borrador ?? publicada
  // Plegables y avisos que llevan a donde se arreglan (V68): solo la interfaz cambia.
  const plegado = useCriteriosAbiertos(borrador)

  const publicacion = useMutation({
    mutationFn: () => publicarPreguntas(editor.vacanteId),
    onSuccess: (e) => {
      setFallo(null)
      poner(e)
    },
    onError: (causa) =>
      borrador && setFallo({ de: borrador, fallo: falloDe(causa, 'No se pudieron publicar las preguntas.') }),
  })

  const irA = (d: Destino) => irAlDestino(d, plegado)

  return (
    <>
      <header className={estilos.cabecera}>
        <h1>{editor.titulo} · Preguntas</h1>
        <p className={estilos.explica}>
          Lo que responde quien postula a esta vacante. Los criterios suman 100 puntos y son las
          columnas del reporte; lo cerrado lo puntúa el sistema y lo abierto, la IA.
        </p>
        {noLasUsa && (
          <p className={estilos.cartel}>
            Esta vacante no usa ahora sus preguntas propias: se usan si en la vacante eliges
            «Preguntas propias de esta vacante».
          </p>
        )}
        {!editable && (
          <p className={estilos.cartel}>
            Las ves en lectura: cambiarlas pide el permiso de editar esta vacante.
          </p>
        )}
      </header>

      {base && (
        <CabeceraFija
          nombre="Balance de las preguntas"
          estado={borrador ? 'BORRADOR' : 'PUBLICADAS'}
          balance={`${base.total} de 100 puntos`}
          cifras={
            <>
              {base.cuantosCriterios} {base.cuantosCriterios === 1 ? 'criterio' : 'criterios'} ·{' '}
              {base.cuantasPreguntas} {base.cuantasPreguntas === 1 ? 'pregunta' : 'preguntas'} ·{' '}
              {base.avisos.length} {base.avisos.length === 1 ? 'aviso' : 'avisos'}
            </>
          }
          version={base}
          faltas={borrador ? borrador.avisos : []}
          publicar={
            editable && borrador
              ? { complemento: ' las preguntas', publicando: publicacion.isPending, alPublicar: () => publicacion.mutate() }
              : null
          }
          alIr={irA}
        />
      )}
      {fallo !== null && fallo.de === borrador && <MostrarFallo fallo={fallo.fallo} />}

      {puedeEscribir && (base === null || borrador !== null || !editor.hayPostulantes) && (
        <div className={estilos.entradas}>
          <button className={estilos.secundario} type="button" onClick={() => setNuevoCriterio(true)}>
            <IconoMas tamano={18} />
            Agregar criterio
          </button>
          {base === null && (
            <button className={estilos.secundario} type="button" onClick={() => setNuevaPregunta(true)}>
              <IconoMas tamano={18} />
              Agregar pregunta
            </button>
          )}
          <button className={estilos.secundario} type="button" onClick={() => setPanelIa((v) => !v)}>
            Recomendaciones por IA
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setCopiando(true)}>
            Copiar de otra vacante
          </button>
        </div>
      )}

      {nuevoCriterio && (
        <NuevoCriterio
          vacanteId={editor.vacanteId}
          alGuardar={(e) => {
            setNuevoCriterio(false)
            poner(e)
          }}
          alCancelar={() => setNuevoCriterio(false)}
        />
      )}

      {nuevaPregunta && (
        <FormularioPregunta
          vacanteId={editor.vacanteId}
          preguntaId={null}
          inicial={preguntaNueva(null)}
          criterios={base?.criterios ?? []}
          alGuardar={(e) => {
            setNuevaPregunta(false)
            poner(e)
          }}
          alCancelar={() => setNuevaPregunta(false)}
        />
      )}

      {panelIa && puedeEscribir && (
        <Recomendaciones
          vacanteId={editor.vacanteId}
          total={base?.total ?? 0}
          criterios={borrador?.criterios ?? []}
          alAgregar={poner}
          alCerrar={() => setPanelIa(false)}
        />
      )}

      {base === null && !nuevaPregunta && (
        <section className={estilos.vacio} aria-label="Sin preguntas">
          <h2>Todavía no hay preguntas</h2>
          <p className={estilos.explica}>
            Escribe la primera, pide a la IA que te proponga criterios y preguntas, o copia las de
            otra vacante de tu empresa.
          </p>
        </section>
      )}

      {borrador && (
        <>
          <GuiaYMinutos version={borrador} vacanteId={editor.vacanteId} editable={editable} alGuardar={poner} />
          <div className={`${estilos.criterios} ${estilos.destino}`} id="criterios-y-preguntas" tabIndex={-1}>
            <ListaDeFaltas faltas={faltasSinSitio(borrador.avisos, borrador)} nombre="Lo que falta para publicar" />
            <ListaDeCriterios vacanteId={editor.vacanteId} version={borrador} editable={editable} alCambiar={poner} plegado={plegado} />
          </div>
        </>
      )}

      {!borrador && publicada && (
        <PreguntasPublicadas editor={editor} publicada={publicada} alCambiar={poner} />
      )}

      <CopiarDeOtraVacante
        vacanteId={editor.vacanteId}
        abierto={copiando}
        hayBorrador={borrador !== null}
        alCerrar={() => setCopiando(false)}
        alCopiar={(e) => {
          setCopiando(false)
          poner(e)
        }}
      />
    </>
  )
}

// ---------- La guía y los minutos ----------

function GuiaYMinutos({
  vacanteId,
  version,
  editable,
  alGuardar,
}: {
  vacanteId: number
  version: VersionDePreguntas
  editable: boolean
  alGuardar: (e: Editor) => void
}) {
  const guiaGuardada = version.guiaCalificacion ?? ''
  const minutosGuardados = version.minutosObjetivo === null ? '' : String(version.minutosObjetivo)
  const [guia, setGuia] = useState(guiaGuardada)
  const [minutos, setMinutos] = useState(minutosGuardados)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  /*
   * ⚠️ Lo que se ve es lo guardado. Si el servidor trae otra guía u otros minutos
   * —copiar encima de un borrador los reemplaza—, el cuadro se pone al día. Sin
   * esto seguía enseñando los del borrador viejo y «Guardar la guía» borraba la
   * copiada (QA-PP-02). Otros cambios del borrador no la tocan, así que lo que se
   * está escribiendo sin guardar no se pierde por agregar una pregunta.
   */
  const firma = `${version.id}|${guiaGuardada}|${minutosGuardados}`
  const [firmaVista, setFirmaVista] = useState(firma)
  if (firmaVista !== firma) {
    setFirmaVista(firma)
    setGuia(guiaGuardada)
    setMinutos(minutosGuardados)
    setFallo(null)
  }
  const cambiado = guia !== guiaGuardada || minutos !== minutosGuardados

  const guardado = useMutation({
    mutationFn: () =>
      guardarDatosDelBorrador(vacanteId, {
        guiaCalificacion: guia.trim() || null,
        minutosObjetivo: minutos.trim() === '' ? null : Number(minutos),
      }),
    onSuccess: (e) => {
      setFallo(null)
      alGuardar(e)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar.')),
  })

  return (
    <section className={estilos.guia} aria-label="Guía de calificación y minutos">
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Guía de calificación para la IA{' '}
          <span className={estilos.cuenta}>(opcional · {guia.length} de 2000)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={3}
          maxLength={2000}
          placeholder="Qué distingue una buena respuesta en este puesto…"
          value={guia}
          onChange={(e) => setGuia(e.target.value)}
          readOnly={!editable}
        />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>Minutos estimados</span>
        <input
          className={estilos.entradaPuntos}
          type="number"
          min={1}
          max={600}
          step={1}
          value={minutos}
          onChange={(e) => setMinutos(e.target.value)}
          readOnly={!editable}
        />
      </label>
      <p className={estilos.conQueCalifica}>
        La IA califica con esta guía, con lo que debe tener cada respuesta y con los datos de la
        vacante que se llenaron al crearla.
      </p>
      {editable && cambiado && (
        <div className={estilos.acciones}>
          <button className={estilos.guardar} type="button" onClick={() => guardado.mutate()} disabled={guardado.isPending}>
            {guardado.isPending ? 'Guardando…' : 'Guardar la guía y los minutos'}
          </button>
        </div>
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}

// ---------- Criterio nuevo ----------

function NuevoCriterio({
  vacanteId,
  alGuardar,
  alCancelar,
}: {
  vacanteId: number
  alGuardar: (e: Editor) => void
  alCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [queEvalua, setQueEvalua] = useState('')
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const guardado = useMutation({
    mutationFn: () => agregarCriterio(vacanteId, { nombre: nombre.trim(), queEvalua: queEvalua.trim() || null }),
    onSuccess: alGuardar,
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo agregar el criterio.')),
  })
  return (
    <form
      className={estilos.formulario}
      aria-label="Criterio nuevo"
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) guardado.mutate()
      }}
    >
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>Nombre del criterio</span>
        <input
          className={estilos.entrada}
          type="text"
          maxLength={120}
          placeholder="Por ejemplo: Conocimiento contable"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Qué evalúa <span className={estilos.cuenta}>(opcional · {queEvalua.length} de 1000)</span>
        </span>
        <textarea className={estilos.area} rows={2} maxLength={1000} value={queEvalua} onChange={(e) => setQueEvalua(e.target.value)} />
      </label>
      <p className={estilos.ayuda}>
        Sus puntos son la suma de sus preguntas. El sistema califica sus cerradas y la IA, sus abiertas.
      </p>
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending || !nombre.trim()}>
          {guardado.isPending ? 'Guardando…' : 'Agregar el criterio'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
    </form>
  )
}

// ---------- Cargando ----------

function Esqueleto() {
  return (
    <div className={estilos.criterios} aria-busy="true" aria-label="Abriendo las preguntas">
      {[0, 1].map((i) => (
        <div className={estilos.esqueleto} key={i}>
          <div className={estilos.huesoTitulo} />
          <div className={estilos.huesoPregunta} />
          <div className={estilos.huesoPregunta} />
        </div>
      ))}
    </div>
  )
}
