/**
 * La prueba técnica de una vacante, escrita en el editor (V67), en
 * `/admin/vacantes/:id/prueba`. Desde la V68, más simple:
 *
 *   1. **La cabecera fija**: el estado, el balance, el chip del tiempo,
 *      «Configuración» y «Publicar», la barra por criterio y las faltas, que
 *      llevan a donde se arreglan.
 *   2. **El escenario o caso práctico**, opcional y plegado.
 *   3. **Los criterios y sus preguntas**, plegables. Cada pregunta puede pedir
 *      su archivo; lo que mira cada criterio lo deduce el servidor.
 *   4. **La guía de calificación para la IA**.
 *   5. **Los entregables generales**, opcionales.
 *
 * El tiempo, la fecha límite, los materiales y las herramientas van a un panel
 * lateral: se tocan una vez. No hay tipo que elegir ni «cuestionario»: una sola
 * prueba.
 *
 * ⚠️ **El balance y las faltas los cuadra el servidor**: cada cambio devuelve el
 * editor entero y se pinta tal cual (ver `consultas.ts`).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  publicarPreguntas,
  type EditorDePreguntas as Editor,
  type PruebaDeLaVersion,
  type VersionDePreguntas,
} from '../../api/preguntasPropias'
import { fechaCortaDeLima } from '@/dominio/horaDeLima'
import { rutas } from '@/rutas'
import { IconoAjustes, IconoMas, IconoReloj } from '@/ui/Iconos'
import { useTituloDelPanel } from '../../titulo'
import { ListaDeCriterios } from './BloqueCriterio'
import { CabeceraFija } from './CabeceraFija'
import { EscenarioDeLaPrueba, GuiaParaLaIa } from './CasoYGuia'
import { ConfiguracionDeLaPrueba } from './ConfiguracionDeLaPrueba'
import { CopiarDeOtraVacante } from './CopiarDeOtraVacante'
import { FormularioCriterioDePrueba } from './CriterioDePrueba'
import { EntregablesGenerales } from './Entregables'
import { falloDe, useEditorDePreguntas, usePonerEditor, type Fallo } from './consultas'
import { ConModoDelEditor, MODO_PRUEBA } from './modo'
import {
  irAlDestino,
  numerosDePreguntas,
  preguntasEnOrden,
  useCriteriosAbiertos,
  type CampoDeLaConfiguracion,
  type Destino,
} from './navegacion'
import { MostrarFallo } from './piezas'
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

function Pagina() {
  const { id } = useParams()
  const vacanteId = Number(id)
  const consulta = useEditorDePreguntas(vacanteId)
  const poner = usePonerEditor(vacanteId)
  useTituloDelPanel(consulta.data ? `${consulta.data.titulo} · Prueba técnica` : 'Prueba técnica')

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

/**
 * Sin nada escrito todavía, la cabecera dice igual qué falta: sin criterios no
 * hay nada que rendir, y sin fecha límite no se publica.
 */
function versionVacia(editor: Editor): VersionDePreguntas {
  const avisos = ['Todavía no hay nada que rendir: agrega criterios y preguntas.']
  if (!editor.fechaLimite?.cierraEn) avisos.push('Falta la fecha límite para dar la prueba.')
  return {
    id: 0,
    estado: 'BORRADOR',
    guiaCalificacion: null,
    minutosObjetivo: null,
    versionGuia: 1,
    total: 0,
    cuantosCriterios: 0,
    cuantasPreguntas: 0,
    criterios: [],
    sinCriterio: [],
    avisos,
    prueba: null,
  }
}

/** «90 min · hasta vie 10/10, 23:59», «Sin cronómetro · hasta …»; en ámbar si falta algo. */
export function chipDelTiempo(
  prueba: PruebaDeLaVersion | null | undefined,
  cierraEn: string | null | undefined,
): { texto: string; falta: boolean } {
  const modalidad = prueba?.modalidad ?? null
  const minutos = prueba?.duracionMinutos ?? null
  let tiempo: string
  let falta = false
  if (modalidad === 'CRONOMETRADA') {
    tiempo = minutos ? `${minutos} min` : 'Faltan los minutos'
    falta = !minutos
  } else if (modalidad === 'PLAZO_ABIERTO') {
    tiempo = prueba?.plazoDias ? `${prueba.plazoDias} ${prueba.plazoDias === 1 ? 'día' : 'días'}` : 'Sin cronómetro'
  } else {
    tiempo = 'Falta el tiempo'
    falta = true
  }
  const hasta = cierraEn ? `hasta ${fechaCortaDeLima(cierraEn)}` : 'falta la fecha límite'
  return { texto: `${tiempo} · ${hasta}`, falta: falta || !cierraEn }
}

function Contenido({ editor, poner }: { editor: Editor; poner: (e: Editor) => void }) {
  const [panelIa, setPanelIa] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [nuevoCriterio, setNuevoCriterio] = useState(false)
  const [configuracion, setConfiguracion] = useState<{ abierta: boolean; campo: CampoDeLaConfiguracion | null }>({
    abierta: false,
    campo: null,
  })
  // El fallo de publicar va atado al borrador con el que se intentó: si llega otro, ya no vale.
  const [fallo, setFallo] = useState<{ de: VersionDePreguntas; fallo: Fallo } | null>(null)

  const borrador = editor.borrador
  const publicada = editor.publicada
  const editable = editor.puedeEditar
  const laUsa = editor.origen === 'PRUEBA_PROPIA'
  // Mientras hay borrador se trabaja en él. Si solo hay publicada y alguien ya empezó a
  // rendirla, no se abren borradores: la vara no se mueve (decisión 9).
  const puedeEscribir = editable && (borrador !== null || !(publicada && editor.hayPostulantes))
  const base: VersionDePreguntas | null = borrador ?? publicada
  // El taller: el borrador, o nada escrito todavía. Con solo la publicada, se lee.
  const enElTaller = borrador !== null || publicada === null
  const plegado = useCriteriosAbiertos(borrador)
  const numeros = borrador ? numerosDePreguntas(borrador) : new Map<number, number>()
  const entregables = borrador?.prueba?.entregables ?? []
  const generales = entregables.filter((e) => e.alcance !== 'PREGUNTA')

  const publicacion = useMutation({
    mutationFn: () => publicarPreguntas(editor.vacanteId, MODO_PRUEBA.ruta),
    onSuccess: (e) => {
      setFallo(null)
      poner(e)
    },
    onError: (causa) => borrador && setFallo({ de: borrador, fallo: falloDe(causa, 'No se pudo publicar la prueba.') }),
  })

  const irA = (d: Destino) => irAlDestino(d, plegado, (campo) => setConfiguracion({ abierta: true, campo }))

  const deLaCabecera = base ?? versionVacia(editor)
  const chip = chipDelTiempo(base?.prueba, editor.fechaLimite?.cierraEn)
  const cuantosEntregables = base?.prueba?.entregables.length ?? 0

  return (
    <>
      <header className={estilos.cabecera}>
        <h1>{editor.titulo} · Prueba técnica</h1>
        <p className={estilos.explica}>
          Lo que rinde quien llega a la etapa técnica. Los criterios suman 100 puntos y son las
          columnas del reporte: sus cerradas las puntúa el sistema, y su parte calificada la
          califica la IA o una persona mirando sus abiertas y los archivos de sus preguntas.
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

      <CabeceraFija
        nombre="Balance de la prueba"
        estado={borrador ? 'BORRADOR' : publicada ? 'PUBLICADA' : 'BORRADOR'}
        balance={`${deLaCabecera.total} de 100 pts`}
        cifras={
          <>
            {deLaCabecera.cuantosCriterios} {deLaCabecera.cuantosCriterios === 1 ? 'criterio' : 'criterios'} ·{' '}
            {deLaCabecera.cuantasPreguntas} {deLaCabecera.cuantasPreguntas === 1 ? 'pregunta' : 'preguntas'} ·{' '}
            {cuantosEntregables} {cuantosEntregables === 1 ? 'entregable' : 'entregables'}
          </>
        }
        version={deLaCabecera}
        chip={
          <button
            className={chip.falta ? `${estilos.chipTiempo} ${estilos.chipTiempoFalta}` : estilos.chipTiempo}
            type="button"
            aria-label={`Tiempo: ${chip.texto}. Abrir la configuración`}
            onClick={() => setConfiguracion({ abierta: true, campo: chip.falta ? (editor.fechaLimite?.cierraEn ? 'tiempo' : 'fecha') : null })}
          >
            <IconoReloj tamano={18} />
            {chip.texto}
          </button>
        }
        ajustes={
          <button
            className={estilos.configurar}
            type="button"
            aria-label="Configuración"
            onClick={() => setConfiguracion({ abierta: true, campo: null })}
          >
            <IconoAjustes tamano={18} />
            <span className={estilos.textoConfigurar}>Configuración</span>
          </button>
        }
        acciones={
          editable &&
          borrador && (
            <button
              className={estilos.publicar}
              type="button"
              aria-label={publicacion.isPending ? undefined : 'Publicar la prueba'}
              onClick={() => publicacion.mutate()}
              disabled={publicacion.isPending}
            >
              {publicacion.isPending ? (
                'Publicando…'
              ) : (
                <span>
                  Publicar<span className={estilos.restoDelRotulo}> la prueba</span>
                </span>
              )}
            </button>
          )
        }
        alIr={irA}
      />
      {fallo !== null && fallo.de === borrador && <MostrarFallo fallo={fallo.fallo} />}

      {enElTaller && (
        <>
          <EscenarioDeLaPrueba
            vacanteId={editor.vacanteId}
            version={borrador}
            editable={puedeEscribir}
            alGuardar={poner}
          />

          <section
            className={`${estilos.criterios} ${estilos.destino}`}
            aria-labelledby="titulo-criterios"
            id="criterios-y-preguntas"
            tabIndex={-1}
          >
            <div className={estilos.cabeceraSeccion}>
              <h2 className={estilos.subtitulo} id="titulo-criterios">
                Criterios y preguntas
              </h2>
              {puedeEscribir && (
                <div className={estilos.entradas}>
                  <button className={estilos.secundario} type="button" onClick={() => setPanelIa((v) => !v)}>
                    Recomendaciones por IA
                  </button>
                  <button className={estilos.secundario} type="button" onClick={() => setCopiando(true)}>
                    Copiar de otra vacante
                  </button>
                </div>
              )}
            </div>

            {panelIa && puedeEscribir && (
              <Recomendaciones
                vacanteId={editor.vacanteId}
                total={base?.total ?? 0}
                criterios={borrador?.criterios ?? []}
                alAgregar={poner}
                alCerrar={() => setPanelIa(false)}
              />
            )}

            {(borrador?.criterios.length ?? 0) === 0 && !nuevoCriterio && (
              <p className={estilos.explica}>
                Todavía no hay criterios. Agrega el primero, pide a la IA que te los proponga o copia
                la prueba de otra vacante de tu empresa.
              </p>
            )}

            {borrador && (
              <ListaDeCriterios
                vacanteId={editor.vacanteId}
                version={borrador}
                editable={editable}
                alCambiar={poner}
                plegado={plegado}
                entregables={entregables}
              />
            )}

            {puedeEscribir &&
              (nuevoCriterio ? (
                <FormularioCriterioDePrueba
                  vacanteId={editor.vacanteId}
                  criterio={null}
                  alGuardar={(e) => {
                    setNuevoCriterio(false)
                    poner(e)
                  }}
                  alCancelar={() => setNuevoCriterio(false)}
                />
              ) : (
                <button className={estilos.secundarioPequeno} type="button" onClick={() => setNuevoCriterio(true)}>
                  <IconoMas tamano={18} />
                  Agregar criterio
                </button>
              ))}
          </section>

          <GuiaParaLaIa vacanteId={editor.vacanteId} version={borrador} editable={puedeEscribir} alGuardar={poner} />

          <EntregablesGenerales
            vacanteId={editor.vacanteId}
            generales={generales}
            preguntas={borrador ? preguntasEnOrden(borrador).map((p) => ({
              id: p.id,
              numero: numeros.get(p.id) ?? 0,
              enunciado: p.enunciado,
            })) : []}
            numeros={numeros}
            editable={puedeEscribir}
            alCambiar={poner}
          />
        </>
      )}

      {!borrador && publicada && (
        <PreguntasPublicadas editor={editor} publicada={publicada} alCambiar={poner} />
      )}

      <ConfiguracionDeLaPrueba
        editor={editor}
        abierta={configuracion.abierta}
        campo={configuracion.campo}
        alCerrar={() => setConfiguracion({ abierta: false, campo: null })}
        alGuardar={poner}
      />

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
