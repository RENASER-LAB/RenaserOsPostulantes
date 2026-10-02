/**
 * La prueba técnica de una vacante, escrita en el editor (V67, fase 2), en
 * `/admin/vacantes/:id/prueba`.
 *
 * Es el editor de las preguntas propias —los mismos bloques de criterio, el
 * mismo balance, las mismas publicadas, recomendaciones y copia— con lo que le
 * falta a una prueba:
 *
 *   - **El caso**: el enunciado (obligatorio si hay entregables), el adjunto en
 *     PDF o Word, los materiales y las herramientas.
 *   - **El tiempo**: cronometrada con minutos o plazo abierto con días. Sin
 *     cambio inesperado.
 *   - **Los entregables**: qué se entrega, en qué formato, si es obligatorio y
 *     qué debe tener una buena entrega.
 *   - **La parte calificada de cada criterio**, y que las abiertas no llevan
 *     puntos.
 *
 * Sin entregables es un cuestionario, sin que nadie lo elija: la cabecera y los
 * textos lo dicen así.
 *
 * ⚠️ **El balance lo cuadra el servidor**: cada cambio devuelve el editor entero
 * y se pinta tal cual (ver `consultas.ts`).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  publicarPreguntas,
  type EditorDePreguntas as Editor,
  type EntregableDeLaVersion,
  type VersionDePreguntas,
} from '../../api/preguntasPropias'
import {
  agregarEntregable,
  descargarConsigna,
  editarEntregable,
  guardarDatosDeLaPrueba,
  moverEntregable,
  quitarConsigna,
  quitarEntregable,
  subirConsigna,
  type GuardarEntregable,
} from '../../api/pruebaPropia'
import { rutas } from '@/rutas'
import { IconoAbajo, IconoArriba, IconoCruz, IconoLapiz, IconoMas } from '@/ui/Iconos'
import { useTituloDelPanel } from '../../titulo'
import { BloqueCriterio } from './BloqueCriterio'
import { CopiarDeOtraVacante } from './CopiarDeOtraVacante'
import { FormularioCriterioDePrueba } from './CriterioDePrueba'
import { falloDe, useEditorDePreguntas, usePonerEditor, type Fallo } from './consultas'
import { FORMATOS, nombreDelFormato } from './formulario'
import { ConModoDelEditor, MODO_PRUEBA } from './modo'
import { BotonIcono, MostrarFallo } from './piezas'
import { PreguntasPublicadas } from './PreguntasPublicadas'
import { Recomendaciones } from './Recomendaciones'
import estilos from './EditorDePreguntas.module.css'

export function EditorDeLaPrueba() {
  return (
    <ConModoDelEditor modo={MODO_PRUEBA}>
      <Pagina />
    </ConModoDelEditor>
  )
}

/** «Prueba técnica» o «Cuestionario», según tenga entregables. */
const nombreDe = (v: VersionDePreguntas | null) =>
  v?.prueba?.cuestionario && (v.cuantasPreguntas > 0 || v.cuantosCriterios > 0)
    ? 'Cuestionario'
    : 'Prueba técnica'

function Pagina() {
  const { id } = useParams()
  const vacanteId = Number(id)
  const consulta = useEditorDePreguntas(vacanteId)
  const poner = usePonerEditor(vacanteId)
  const base = consulta.data ? (consulta.data.borrador ?? consulta.data.publicada) : null
  useTituloDelPanel(consulta.data ? `${consulta.data.titulo} · ${nombreDe(base)}` : 'Prueba técnica')

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.adminVacante(vacanteId)}>
        ← La vacante
      </Link>
      {consulta.isPending && (
        <div className={estilos.criterios} aria-busy="true" aria-label="Abriendo la prueba">
          <div className={estilos.esqueleto}>
            <div className={estilos.huesoTitulo} />
            <div className={estilos.huesoPregunta} />
          </div>
        </div>
      )}
      {consulta.isError && (
        <p className={estilos.error} role="alert">
          No se pudo abrir la prueba de esta vacante. Si es de otra empresa, o se eliminó, no está a
          tu alcance.
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
  const [nuevoEntregable, setNuevoEntregable] = useState(false)
  const [fallo, setFallo] = useState<{ de: VersionDePreguntas; fallo: Fallo } | null>(null)

  const borrador = editor.borrador
  const publicada = editor.publicada
  const editable = editor.puedeEditar
  const laUsa = editor.origen === 'PRUEBA_PROPIA'
  // Mientras hay borrador se trabaja en él. Si solo hay publicada y alguien ya empezó a
  // rendirla, no se abren borradores: la vara no se mueve (decisión 9).
  const puedeEscribir = editable && (borrador !== null || !(publicada && editor.hayPostulantes))
  const base: VersionDePreguntas | null = borrador ?? publicada
  const entregables = borrador?.prueba?.entregables ?? []
  const nombre = nombreDe(base)

  return (
    <>
      <header className={estilos.cabecera}>
        <h1>
          {editor.titulo} · {nombre}
        </h1>
        <p className={estilos.explica}>
          Lo que rinde quien llega a la etapa técnica. Los criterios suman 100 puntos y son las
          columnas del reporte: sus cerradas las puntúa el sistema, y su parte calificada la
          califica la IA o una persona mirando sus abiertas y los entregables que elijas. Sin
          entregables es un cuestionario.
        </p>
        {!laUsa && (
          <p className={estilos.cartel}>
            Esta vacante no rinde esta prueba: su etapa técnica es la de antes (una plantilla o el
            cuestionario técnico).
          </p>
        )}
        {!editable && (
          <p className={estilos.cartel}>
            La ves en lectura: cambiarla pide el permiso de editar esta vacante.
          </p>
        )}
      </header>

      {borrador && (
        <Balance
          vacanteId={editor.vacanteId}
          version={borrador}
          nombre={nombre}
          editable={editable}
          alPublicar={poner}
          fallo={fallo !== null && fallo.de === borrador ? fallo.fallo : null}
          setFallo={(f) => setFallo(f === null ? null : { de: borrador, fallo: f })}
        />
      )}

      {puedeEscribir && (
        <div className={estilos.entradas}>
          <button className={estilos.secundario} type="button" onClick={() => setNuevoCriterio(true)}>
            <IconoMas tamano={18} />
            Agregar criterio
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setNuevoEntregable(true)}>
            <IconoMas tamano={18} />
            Agregar entregable
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setPanelIa((v) => !v)}>
            Recomendaciones por IA
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setCopiando(true)}>
            Copiar de otra vacante
          </button>
        </div>
      )}

      {nuevoCriterio && (
        <FormularioCriterioDePrueba
          vacanteId={editor.vacanteId}
          criterio={null}
          entregables={entregables}
          alGuardar={(e) => {
            setNuevoCriterio(false)
            poner(e)
          }}
          alCancelar={() => setNuevoCriterio(false)}
        />
      )}

      {nuevoEntregable && (
        <FormularioEntregable
          vacanteId={editor.vacanteId}
          entregable={null}
          alGuardar={(e) => {
            setNuevoEntregable(false)
            poner(e)
          }}
          alCancelar={() => setNuevoEntregable(false)}
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

      {base === null && !nuevoCriterio && !nuevoEntregable && (
        <section className={estilos.vacio} aria-label="Sin prueba">
          <h2>Todavía no hay prueba</h2>
          <p className={estilos.explica}>
            Agrega un criterio o un entregable, pide a la IA que te proponga el caso y los criterios,
            o copia la prueba de otra vacante de tu empresa.
          </p>
        </section>
      )}

      {borrador && (
        <>
          <DatosDeLaPrueba version={borrador} vacanteId={editor.vacanteId} editable={editable} alGuardar={poner} />
          <Entregables
            vacanteId={editor.vacanteId}
            entregables={entregables}
            criterios={borrador.criterios.map((c) => ({ id: c.id, nombre: c.nombre }))}
            editable={editable}
            alCambiar={poner}
          />
          <div className={estilos.criterios}>
            {borrador.criterios.map((c, i) => (
              <BloqueCriterio
                key={c.id}
                vacanteId={editor.vacanteId}
                criterio={c}
                preguntas={c.preguntas}
                todos={borrador.criterios}
                editable={editable}
                primero={i === 0}
                ultimo={i === borrador.criterios.length - 1}
                alCambiar={poner}
                entregables={entregables}
              />
            ))}
            {borrador.sinCriterio.length > 0 && (
              <BloqueCriterio
                vacanteId={editor.vacanteId}
                criterio={null}
                preguntas={borrador.sinCriterio}
                todos={borrador.criterios}
                editable={editable}
                primero
                ultimo
                alCambiar={poner}
                entregables={entregables}
              />
            )}
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

// ---------- El balance ----------

function Balance({
  vacanteId,
  version,
  nombre,
  editable,
  alPublicar,
  fallo,
  setFallo,
}: {
  vacanteId: number
  version: VersionDePreguntas
  nombre: string
  editable: boolean
  alPublicar: (e: Editor) => void
  fallo: Fallo | null
  setFallo: (f: Fallo | null) => void
}) {
  const publicacion = useMutation({
    mutationFn: () => publicarPreguntas(vacanteId, MODO_PRUEBA.ruta),
    onSuccess: (e) => {
      setFallo(null)
      alPublicar(e)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo publicar la prueba.')),
  })
  const avisos = version.avisos
  const entregables = version.prueba?.entregables.length ?? 0
  const cifras = (
    <>
      <b>{version.total}</b> de 100 puntos · {version.cuantosCriterios}{' '}
      {version.cuantosCriterios === 1 ? 'criterio' : 'criterios'} · {entregables}{' '}
      {entregables === 1 ? 'entregable' : 'entregables'} · {avisos.length}{' '}
      {avisos.length === 1 ? 'aviso' : 'avisos'}
    </>
  )
  const detalle = (
    <>
      {avisos.length > 0 && (
        <ul className={estilos.avisos} aria-label="Lo que frena la publicación">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <MostrarFallo fallo={fallo} />
    </>
  )
  const textoDelBoton = nombre === 'Cuestionario' ? 'Publicar el cuestionario' : 'Publicar la prueba'
  const boton = editable && (
    <button
      className={estilos.publicar}
      type="button"
      onClick={() => publicacion.mutate()}
      disabled={publicacion.isPending}
    >
      {publicacion.isPending ? 'Publicando…' : textoDelBoton}
    </button>
  )
  return (
    <section className={estilos.balance} aria-label={nombre === 'Cuestionario' ? 'Balance del cuestionario' : 'Balance de la prueba'}>
      <div className={estilos.balanceLargo}>
        <div className={estilos.lineaBalance}>
          <span className={estilos.estadoVersion}>BORRADOR</span>
          <p className={estilos.cifras}>{cifras}</p>
          {boton}
        </div>
        {detalle}
      </div>
      <details className={estilos.balanceCorto}>
        <summary>
          {version.total}/100 · {avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'}
        </summary>
        <div className={estilos.lineaBalance}>
          <p className={estilos.cifras}>{cifras}</p>
          {boton}
        </div>
        {detalle}
      </details>
    </section>
  )
}

// ---------- El caso, el tiempo y la guía ----------

function DatosDeLaPrueba({
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
  const prueba = version.prueba
  const guardados = {
    guia: version.guiaCalificacion ?? '',
    enunciado: prueba?.enunciado ?? '',
    materiales: prueba?.materiales ?? '',
    herramientas: prueba?.herramientasPermitidas ?? '',
    modalidad: prueba?.modalidad ?? 'CRONOMETRADA',
    minutos: prueba?.duracionMinutos == null ? '' : String(prueba.duracionMinutos),
    dias: prueba?.plazoDias == null ? '' : String(prueba.plazoDias),
  }
  const [datos, setDatos] = useState(guardados)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  /*
   * ⚠️ Lo que se ve es lo guardado: si el servidor trae otro caso u otro tiempo —copiar
   * encima de un borrador los reemplaza—, el formulario se pone al día. Lo que se está
   * escribiendo sin guardar no se pierde por agregar una pregunta, que no los toca.
   */
  const firma = JSON.stringify([version.id, guardados])
  const [firmaVista, setFirmaVista] = useState(firma)
  if (firmaVista !== firma) {
    setFirmaVista(firma)
    setDatos(guardados)
    setFallo(null)
  }
  const cambiado = JSON.stringify(datos) !== JSON.stringify(guardados)
  const cuestionario = prueba?.cuestionario ?? true

  const guardado = useMutation({
    mutationFn: () =>
      guardarDatosDeLaPrueba(vacanteId, {
        guiaCalificacion: datos.guia.trim() || null,
        enunciado: datos.enunciado.trim() || null,
        materiales: datos.materiales.trim() || null,
        herramientasPermitidas: datos.herramientas.trim() || null,
        modalidad: datos.modalidad as 'CRONOMETRADA' | 'PLAZO_ABIERTO',
        duracionMinutos: datos.modalidad === 'CRONOMETRADA' && datos.minutos.trim() ? Number(datos.minutos) : null,
        plazoDias: datos.modalidad === 'PLAZO_ABIERTO' && datos.dias.trim() ? Number(datos.dias) : null,
      }),
    onSuccess: (e) => {
      setFallo(null)
      alGuardar(e)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar.')),
  })
  const adjunto = useMutation({
    mutationFn: (archivo: File) => subirConsigna(vacanteId, archivo),
    onSuccess: (e) => {
      setFallo(null)
      alGuardar(e)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo subir el enunciado.')),
  })
  const sinAdjunto = useMutation({
    mutationFn: () => quitarConsigna(vacanteId),
    onSuccess: alGuardar,
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo quitar el enunciado.')),
  })
  const abrirAdjunto = async () => {
    if (!prueba?.consigna) return
    const archivo = await descargarConsigna(prueba.consigna.archivoId).catch(() => null)
    if (!archivo) {
      setFallo(falloDe(new Error('No se pudo abrir el enunciado adjunto.'), ''))
      return
    }
    const url = URL.createObjectURL(archivo.contenido)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const campo = (clave: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((v) => ({ ...v, [clave]: e.target.value }))

  return (
    <section className={estilos.seccionPrueba} aria-label="El caso, el tiempo y la guía">
      <h2 className={estilos.subtitulo}>
        El caso{' '}
        <span className={estilos.cuenta}>
          {cuestionario ? '(opcional en un cuestionario)' : '(obligatorio: hay entregables)'}
        </span>
      </h2>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Enunciado <span className={estilos.cuenta}>({datos.enunciado.length} de 10000)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={5}
          maxLength={10000}
          placeholder="La situación que tiene que resolver: qué pasó, con qué cifras y qué se le pide."
          value={datos.enunciado}
          onChange={campo('enunciado')}
          readOnly={!editable}
        />
      </label>
      <div className={estilos.adjunto}>
        <span className={estilos.etiqueta}>Enunciado en PDF o Word</span>
        {prueba?.consigna ? (
          <span className={estilos.filaAdjunto}>
            <button className={estilos.enlaceBoton} type="button" onClick={() => void abrirAdjunto()}>
              {prueba.consigna.nombre ?? 'El enunciado adjunto'}
            </button>
            {editable && (
              <button
                className={estilos.secundarioPequeno}
                type="button"
                onClick={() => sinAdjunto.mutate()}
                disabled={sinAdjunto.isPending}
              >
                Quitar
              </button>
            )}
          </span>
        ) : (
          editable && (
            <label className={estilos.secundarioPequeno}>
              {adjunto.isPending ? 'Subiendo…' : 'Subir PDF o Word'}
              <input
                className={estilos.soloLectores}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) adjunto.mutate(archivo)
                  e.target.value = ''
                }}
              />
            </label>
          )
        )}
        <span className={estilos.ayuda}>Opcional: como la consigna de las pruebas de antes. Va también en el correo que avisa de la prueba.</span>
      </div>
      <div className={estilos.filaFormulario}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Materiales <span className={estilos.cuenta}>(opcional)</span></span>
          <textarea className={estilos.area} rows={2} maxLength={2000} value={datos.materiales} onChange={campo('materiales')} readOnly={!editable} />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Herramientas permitidas <span className={estilos.cuenta}>(opcional)</span></span>
          <textarea className={estilos.area} rows={2} maxLength={1000} value={datos.herramientas} onChange={campo('herramientas')} readOnly={!editable} />
        </label>
      </div>

      <fieldset className={estilos.grupoOpciones}>
        <legend className={estilos.subtitulo}>Tiempo</legend>
        <div className={estilos.radios}>
          <label className={estilos.casilla}>
            <input
              type="radio"
              name="modalidad"
              value="CRONOMETRADA"
              checked={datos.modalidad === 'CRONOMETRADA'}
              onChange={campo('modalidad')}
              disabled={!editable}
            />
            <span>Cronometrada</span>
            <input
              className={estilos.entradaPuntos}
              type="number"
              inputMode="numeric"
              min={5}
              step={1}
              aria-label="Minutos"
              value={datos.minutos}
              onChange={campo('minutos')}
              disabled={!editable || datos.modalidad !== 'CRONOMETRADA'}
            />
            <span>min</span>
          </label>
          <label className={estilos.casilla}>
            <input
              type="radio"
              name="modalidad"
              value="PLAZO_ABIERTO"
              checked={datos.modalidad === 'PLAZO_ABIERTO'}
              onChange={campo('modalidad')}
              disabled={!editable}
            />
            <span>Plazo abierto</span>
            <input
              className={estilos.entradaPuntos}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              aria-label="Días"
              value={datos.dias}
              onChange={campo('dias')}
              disabled={!editable || datos.modalidad !== 'PLAZO_ABIERTO'}
            />
            <span>días</span>
          </label>
        </div>
        <p className={estilos.ayuda}>
          Cronometrada: el reloj corre desde que la abre, cinco minutos como mínimo. Plazo abierto:
          tiene esos días para entregarla. No hay cambio inesperado.
        </p>
      </fieldset>

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Guía de calificación para la IA{' '}
          <span className={estilos.cuenta}>(opcional · {datos.guia.length} de 2000)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={3}
          maxLength={2000}
          placeholder="Qué distingue una buena entrega en este puesto…"
          value={datos.guia}
          onChange={campo('guia')}
          readOnly={!editable}
        />
      </label>
      <p className={estilos.conQueCalifica}>
        La IA califica con esta guía, el caso, el tiempo que tuvo cada persona, lo que debe tener
        cada abierta y cada entregable, y los datos de la vacante que se llenaron al crearla.
      </p>
      {editable && cambiado && (
        <div className={estilos.acciones}>
          <button className={estilos.guardar} type="button" onClick={() => guardado.mutate()} disabled={guardado.isPending}>
            {guardado.isPending ? 'Guardando…' : 'Guardar el caso, el tiempo y la guía'}
          </button>
        </div>
      )}
      <MostrarFallo fallo={fallo} />
    </section>
  )
}

// ---------- Los entregables ----------

function Entregables({
  vacanteId,
  entregables,
  criterios,
  editable,
  alCambiar,
}: {
  vacanteId: number
  entregables: EntregableDeLaVersion[]
  criterios: { id: number; nombre: string }[]
  editable: boolean
  alCambiar: (e: Editor) => void
}) {
  return (
    <section className={estilos.seccionPrueba} aria-label="Los entregables">
      <h2 className={estilos.subtitulo}>Entregables</h2>
      {entregables.length === 0 ? (
        <p className={estilos.explica}>
          Sin entregables: es un cuestionario y solo se responde escribiendo y eligiendo.
        </p>
      ) : (
        <ol className={estilos.preguntas}>
          {entregables.map((e, i) => (
            <li key={e.id}>
              <TarjetaEntregable
                vacanteId={vacanteId}
                entregable={e}
                criterios={criterios}
                editable={editable}
                primero={i === 0}
                ultimo={i === entregables.length - 1}
                alCambiar={alCambiar}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function TarjetaEntregable({
  vacanteId,
  entregable,
  criterios,
  editable,
  primero,
  ultimo,
  alCambiar,
}: {
  vacanteId: number
  entregable: EntregableDeLaVersion
  criterios: { id: number; nombre: string }[]
  editable: boolean
  primero: boolean
  ultimo: boolean
  alCambiar: (e: Editor) => void
}) {
  const [editando, setEditando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const alFallar = (c: unknown) => setFallo(falloDe(c, 'No se pudo guardar.'))
  const alTerminar = (e: Editor) => {
    setFallo(null)
    alCambiar(e)
  }
  const mover = useMutation({
    mutationFn: (direccion: 'ARRIBA' | 'ABAJO') => moverEntregable(vacanteId, entregable.id, direccion),
    onSuccess: alTerminar,
    onError: alFallar,
  })
  const quitar = useMutation({
    mutationFn: () => quitarEntregable(vacanteId, entregable.id),
    onSuccess: alTerminar,
    onError: alFallar,
  })
  const loMiran = criterios.filter((c) => entregable.criterios.includes(c.id))

  if (editando) {
    return (
      <FormularioEntregable
        vacanteId={vacanteId}
        entregable={entregable}
        alGuardar={(e) => {
          setEditando(false)
          alTerminar(e)
        }}
        alCancelar={() => setEditando(false)}
      />
    )
  }
  const ocupado = mover.isPending || quitar.isPending
  return (
    <article className={estilos.pregunta} aria-label={`Entregable: ${entregable.nombre}`}>
      <div className={estilos.cabeceraPregunta}>
        <span className={estilos.chip}>{nombreDelFormato(entregable.formato)}</span>
        <span className={estilos.chip}>{entregable.obligatorio ? 'obligatorio' : 'opcional'}</span>
        {editable && (
          <div className={estilos.botones}>
            <BotonIcono etiqueta={`Subir el entregable ${entregable.nombre}`} onClick={() => mover.mutate('ARRIBA')} disabled={primero || ocupado}>
              <IconoArriba />
            </BotonIcono>
            <BotonIcono etiqueta={`Bajar el entregable ${entregable.nombre}`} onClick={() => mover.mutate('ABAJO')} disabled={ultimo || ocupado}>
              <IconoAbajo />
            </BotonIcono>
            <BotonIcono etiqueta={`Editar el entregable ${entregable.nombre}`} onClick={() => setEditando(true)} disabled={ocupado}>
              <IconoLapiz />
            </BotonIcono>
            <BotonIcono
              etiqueta={`Quitar el entregable ${entregable.nombre}`}
              onClick={() => (loMiran.length > 0 ? setQuitando(true) : quitar.mutate())}
              disabled={ocupado}
            >
              <IconoCruz />
            </BotonIcono>
          </div>
        )}
      </div>
      <p className={estilos.enunciado}>{entregable.nombre}</p>
      {entregable.detalle && <p className={estilos.queEvalua}>{entregable.detalle}</p>}
      {entregable.queDebeTener && (
        <p className={estilos.queDebeTener}>
          <b>Qué debe tener:</b> {entregable.queDebeTener}
        </p>
      )}
      {loMiran.length === 0 ? (
        <p className={estilos.aviso}>No está en ningún criterio: así no se publica.</p>
      ) : (
        <p className={estilos.ayuda}>Lo mira: {loMiran.map((c) => c.nombre).join(', ')}.</p>
      )}
      {quitando && (
        <div className={estilos.confirmacion} role="alertdialog" aria-label="Quitar el entregable">
          <span>
            {loMiran.length === 1
              ? `Lo mira «${loMiran[0]?.nombre ?? ''}»: desaparece también de lo que mira ese criterio.`
              : `Lo miran ${loMiran.length} criterios: desaparece también de lo que mira cada uno.`}
          </span>
          <button
            className={estilos.peligroso}
            type="button"
            onClick={() => {
              setQuitando(false)
              quitar.mutate()
            }}
          >
            Quitar el entregable
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setQuitando(false)}>
            Cancelar
          </button>
        </div>
      )}
      <MostrarFallo fallo={fallo} />
    </article>
  )
}

function FormularioEntregable({
  vacanteId,
  entregable,
  alGuardar,
  alCancelar,
}: {
  vacanteId: number
  entregable: EntregableDeLaVersion | null
  alGuardar: (e: Editor) => void
  alCancelar: () => void
}) {
  const [datos, setDatos] = useState<GuardarEntregable>({
    nombre: entregable?.nombre ?? '',
    detalle: entregable?.detalle ?? '',
    formato: entregable?.formato ?? 'ARCHIVO',
    obligatorio: entregable?.obligatorio ?? true,
    queDebeTener: entregable?.queDebeTener ?? '',
  })
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const guardado = useMutation({
    mutationFn: () => {
      const cuerpo: GuardarEntregable = {
        nombre: datos.nombre.trim(),
        detalle: datos.detalle?.trim() || null,
        formato: datos.formato,
        obligatorio: datos.obligatorio,
        queDebeTener: datos.queDebeTener?.trim() || null,
      }
      return entregable === null
        ? agregarEntregable(vacanteId, cuerpo)
        : editarEntregable(vacanteId, entregable.id, cuerpo)
    },
    onSuccess: (e) => {
      setFallo(null)
      alGuardar(e)
    },
    onError: (causa) => setFallo(falloDe(causa, 'No se pudo guardar el entregable.')),
  })
  return (
    <form
      className={estilos.formulario}
      aria-label={entregable === null ? 'Entregable nuevo' : `Editar el entregable ${entregable.nombre}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (datos.nombre.trim()) guardado.mutate()
      }}
    >
      <div className={estilos.filaFormulario}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Nombre</span>
          <input
            className={estilos.entrada}
            type="text"
            maxLength={200}
            placeholder="Por ejemplo: Tablero.xlsx"
            value={datos.nombre}
            onChange={(e) => setDatos((v) => ({ ...v, nombre: e.target.value }))}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Formato</span>
          <select
            className={estilos.eleccion}
            value={datos.formato ?? 'ARCHIVO'}
            onChange={(e) => setDatos((v) => ({ ...v, formato: e.target.value as GuardarEntregable['formato'] }))}
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Qué debe contener <span className={estilos.cuenta}>(lo lee quien rinde)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={2}
          maxLength={1000}
          placeholder="Por ejemplo: la conciliación de marzo, con el descuadre ubicado"
          value={datos.detalle ?? ''}
          onChange={(e) => setDatos((v) => ({ ...v, detalle: e.target.value }))}
        />
      </label>
      <label className={estilos.casilla}>
        <input
          type="checkbox"
          checked={datos.obligatorio}
          onChange={(e) => setDatos((v) => ({ ...v, obligatorio: e.target.checked }))}
        />
        <span>Obligatorio: sin él no se puede entregar</span>
      </label>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>
          Qué debe tener una buena entrega{' '}
          <span className={estilos.cuenta}>(opcional · {(datos.queDebeTener ?? '').length} de 1000)</span>
        </span>
        <textarea
          className={estilos.area}
          rows={2}
          maxLength={1000}
          value={datos.queDebeTener ?? ''}
          onChange={(e) => setDatos((v) => ({ ...v, queDebeTener: e.target.value }))}
        />
        <span className={estilos.ayuda}>Lo leen la IA y quien califica; quien rinde no lo ve.</span>
      </label>
      <div className={estilos.acciones}>
        <button className={estilos.guardar} type="submit" disabled={guardado.isPending || !datos.nombre.trim()}>
          {guardado.isPending ? 'Guardando…' : entregable === null ? 'Agregar el entregable' : 'Guardar el entregable'}
        </button>
        <button className={estilos.secundario} type="button" onClick={alCancelar} disabled={guardado.isPending}>
          Cancelar
        </button>
      </div>
      <MostrarFallo fallo={fallo} />
    </form>
  )
}
