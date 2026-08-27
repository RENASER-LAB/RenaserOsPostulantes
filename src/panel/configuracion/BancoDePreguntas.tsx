/**
 * El banco de preguntas: importar, publicar, archivar, descartar y renombrar.
 *
 * Antes esto era una lista plana de trece filas donde un borrador, la version
 * que se le esta poniendo delante a la gente y una de hace un año se veian
 * igual salvo por una palabra. La operacion es distinta en cada una, y sobre
 * todo la consecuencia lo es.
 *
 * ⚠️ **Dos PUBLICADA del mismo nivel conviven, y solo una rige.** El backend
 * ordena `publicadaEn desc limit 1` para fijarle el banco a quien empieza su
 * evaluacion, asi que dejar dos publicadas "funciona" y el estado miente. En la
 * base local hay tres pares asi ahora mismo. Por eso las versiones se agrupan
 * por tipo de banco y nivel: es el unico corte en el que la pregunta «cual
 * rige» tiene respuesta.
 *
 * ⚠️ **«Rige» es «se le fija a quien empiece ahora», no «la que usa todo el
 * mundo».** Quien ya empezo conserva la suya aunque se publique otra (RF-138),
 * y su nota se calcula con las claves de la version archivada. Decirlo de otra
 * forma haria creer que publicar mueve un examen en curso.
 *
 * ⚠️ **No se ofrece «crear una version en blanco»** aunque el endpoint exista.
 * Una version vacia no se puede publicar —el backend contesta 409, «No se
 * publica un banco vacio»— y desde el panel todavia no hay forma de añadirle
 * una sola pregunta: el editor de items no esta construido. El boton crearia
 * filas que no llevan a ningun sitio. El e2e si la usa, que es donde sirve:
 * crear, chocar con el 409 y borrarla no deja rastro.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archivarVersionBanco,
  descartarBorradorBanco,
  importarBanco,
  listarVersionesBanco,
  publicarVersionBanco,
  renombrarVersionBanco,
  verCatalogos,
  verPreguntasDeVersion,
} from '../api/panel'
import { ErrorApi } from '../api/cliente'
import type { VersionBanco } from '../api/tipos'
import estilos from './BancoDePreguntas.module.css'

export function BancoDePreguntas() {
  const cache = useQueryClient()
  const versiones = useQuery({ queryKey: ['panel-banco'], queryFn: listarVersionesBanco })
  /*
    El catalogo vive aqui y no solo en el formulario de importar: sin el, el
    titulo del grupo dice «Nivel MEDIO», que es el codigo crudo del backend. Es
    el mismo fallo que la fixtura del embudo ya documenta.
  */
  const catalogos = useQuery({ queryKey: ['panel-catalogos'], queryFn: verCatalogos })
  const nombresDeNivel = new Map(
    (catalogos.data?.nivelesPuesto ?? []).map((n) => [n.codigo, n.nombre]),
  )

  /*
    Los dos permisos se aprenden por separado, y cada uno retira solo lo suyo.

    `publicar_version_banco` abre publicar, archivar y renombrar;
    `editar_banco_preguntas` abre importar y descartar. No hay ninguna ruta que
    diga que puede el usuario del panel —`Sesion` es `{token, usuarioId}`— asi
    que la unica forma de saberlo es intentarlo. Colapsarlos en una bandera
    unica retiraria acciones que si estan permitidas.
  */
  const [sinPublicar, setSinPublicar] = useState(false)
  const [sinEditar, setSinEditar] = useState(false)

  const refrescar = () => cache.invalidateQueries({ queryKey: ['panel-banco'] })

  return (
    <section className={estilos.seccion}>
      <h2 className={estilos.tituloSeccion}>El banco de preguntas</h2>
      <p className={estilos.nota}>
        Una versión se importa desde la plantilla Excel, se revisa en borrador y se
        publica. Publicar deja fuera a la que reemplaza; archivar la retira sin poner
        nada en su lugar.
      </p>

      <Importar alImportar={refrescar} sinPermiso={sinEditar} alFaltarPermiso={() => setSinEditar(true)} />

      {versiones.isLoading && <p className={estilos.nota}>Cargando las versiones…</p>}

      {versiones.isError && !versiones.data && (
        <p className={estilos.avisoMalo} role="alert">
          {versiones.error instanceof ErrorApi && versiones.error.estado === 403
            ? 'No se pueden ver las versiones del banco: hace falta el permiso «ver_banco_preguntas».'
            : 'No se pudieron cargar las versiones del banco.'}
        </p>
      )}

      {versiones.data && versiones.data.length === 0 && (
        <p className={estilos.nota}>
          Todavía no hay ninguna versión. La primera entra por el Excel de aquí arriba.
        </p>
      )}

      {versiones.data && versiones.data.length > 0 && (
        <div className={estilos.grupos}>
          {agrupar(versiones.data, nombresDeNivel).map((grupo) => (
            <Grupo
              key={grupo.clave}
              grupo={grupo}
              alCambiar={refrescar}
              sinPublicar={sinPublicar}
              sinEditar={sinEditar}
              alFaltarPublicar={() => setSinPublicar(true)}
              alFaltarEditar={() => setSinEditar(true)}
            />
          ))}
        </div>
      )}

      {(sinPublicar || sinEditar) && (
        <p className={estilos.avisoPermiso} role="status">
          {sinPublicar && sinEditar
            ? 'Se retiraron las acciones de esta sección: hacen falta los permisos «publicar_version_banco» y «editar_banco_preguntas», y este usuario no tiene ninguno de los dos.'
            : sinPublicar
              ? 'Se retiraron publicar, archivar y renombrar: hace falta el permiso «publicar_version_banco». Importar y descartar borradores siguen disponibles.'
              : 'Se retiraron importar y descartar: hace falta el permiso «editar_banco_preguntas». Publicar, archivar y renombrar siguen disponibles.'}
        </p>
      )}
    </section>
  )
}

// ---------- Como se agrupan ----------

interface GrupoDeVersiones {
  clave: string
  titulo: string
  /** La PUBLICADA mas reciente del grupo, que es la que se le fija a quien empiece. */
  rige: VersionBanco | null
  filas: VersionBanco[]
}

/**
 * Un grupo por cada par (tipo de banco, nivel), que es exactamente el corte con
 * el que el backend resuelve cual rige y cuales archiva al publicar.
 *
 * ⚠️ **En ALINEACION el nivel es null y eso no es un dato que falte**: ese banco
 * no depende del nivel del puesto. Un `?? '—'` lo pintaria como un hueco.
 */
export function agrupar(
  versiones: VersionBanco[],
  nombresDeNivel: Map<string, string> = new Map(),
): GrupoDeVersiones[] {
  const porClave = new Map<string, VersionBanco[]>()
  for (const v of versiones) {
    const clave = `${v.tipoBanco}|${v.nivelPuestoCodigo ?? ''}`
    porClave.set(clave, [...(porClave.get(clave) ?? []), v])
  }

  return [...porClave.entries()]
    .map(([clave, filas]) => {
      const publicadas = filas.filter((v) => v.estado === 'PUBLICADA')
      const rige =
        publicadas.length === 0
          ? null
          : publicadas.reduce((masReciente, v) =>
              instante(v) > instante(masReciente) ? v : masReciente,
            )
      const [tipoBanco, nivel] = clave.split('|')
      return {
        clave,
        titulo:
          tipoBanco === 'ALINEACION'
            ? 'Banco de alineación'
            : nivel === undefined || nivel === ''
              ? 'Banco por nivel, sin nivel asignado'
              : `Nivel ${nombresDeNivel.get(nivel) ?? nivel}`,
        rige,
        filas: [...filas].sort(porRelevancia),
      }
    })
    /*
      Los bancos por nivel primero y el de alineacion al final, no por orden
      alfabetico: «Banco de alineación» empieza por B y se colaba delante de
      los tres niveles, que son el trabajo de todos los dias.
    */
    .sort(
      (a, b) =>
        Number(a.clave.startsWith('ALINEACION')) - Number(b.clave.startsWith('ALINEACION')) ||
        a.titulo.localeCompare(b.titulo, 'es'),
    )
}

/*
  Sin `publicadaEn` una version no puede regir: el `order by` del backend la
  dejaria detras de cualquiera que si la tenga. Cero es lo que dice eso.
*/
const instante = (v: VersionBanco) => (v.publicadaEn ? Date.parse(v.publicadaEn) : 0)

/* Lo que rige primero, lo que se decide despues, la historia al final. */
const PESO_DEL_ESTADO = { PUBLICADA: 0, BORRADOR: 1, ARCHIVADA: 2 }

function porRelevancia(a: VersionBanco, b: VersionBanco) {
  const porEstado = PESO_DEL_ESTADO[a.estado] - PESO_DEL_ESTADO[b.estado]
  return porEstado !== 0 ? porEstado : instante(b) - instante(a) || b.id - a.id
}

// ---------- Un grupo ----------

function Grupo({
  grupo,
  alCambiar,
  sinPublicar,
  sinEditar,
  alFaltarPublicar,
  alFaltarEditar,
}: {
  grupo: GrupoDeVersiones
  alCambiar: () => void
  sinPublicar: boolean
  sinEditar: boolean
  alFaltarPublicar: () => void
  alFaltarEditar: () => void
}) {
  const publicadas = grupo.filas.filter((v) => v.estado === 'PUBLICADA')
  /*
    ⚠️ **«En este nivel» no vale para ALINEACION**, que no tiene nivel: ese
    banco se elige por otra via y todo lo que el backend hace con el nivel
    —repuntar a quien no empezo, y la guarda de archivar sin reemplazo— esta
    dentro de un `if ("NIVEL".equals(tipoBanco))`. Prometer ahi una guarda que
    no se dispara es peor que no decir nada.
  */
  const porNivel = !grupo.clave.startsWith('ALINEACION')

  return (
    <div className={estilos.grupo}>
      <h3 className={estilos.tituloGrupo}>{grupo.titulo}</h3>

      {publicadas.length === 0 && (
        <p className={estilos.sinVigente}>
          {porNivel
            ? 'Ninguna versión publicada: quien empiece su evaluación en este nivel se queda sin banco de preguntas.'
            : 'Ninguna versión publicada de este banco: no hay ninguna que asignar.'}
        </p>
      )}

      {/*
        El aviso de las dos publicadas. Es el hallazgo que esta pantalla existe
        para enseñar: en la base local hay tres niveles asi, y hasta ahora las
        dos filas decian PUBLICADA sin mas.
      */}
      {publicadas.length > 1 && (
        <p className={estilos.avisoDuda} role="status">
          Hay {publicadas.length} versiones publicadas de este banco y solo una se
          asigna. Archiva las que sobran para que el estado deje de decir que circulan.
        </p>
      )}

      <ul className={estilos.versiones} role="list">
        {grupo.filas.map((v) => (
          <Fila
            key={v.id}
            version={v}
            rige={grupo.rige?.id === v.id}
            hermanasPublicadas={publicadas.filter((h) => h.id !== v.id)}
            porNivel={porNivel}
            alCambiar={alCambiar}
            sinPublicar={sinPublicar}
            sinEditar={sinEditar}
            alFaltarPublicar={alFaltarPublicar}
            alFaltarEditar={alFaltarEditar}
          />
        ))}
      </ul>
    </div>
  )
}

// ---------- Una version ----------

type Pregunta = 'publicar' | 'archivar' | 'descartar' | 'renombrar' | null

function Fila({
  version,
  rige,
  hermanasPublicadas,
  porNivel,
  alCambiar,
  sinPublicar,
  sinEditar,
  alFaltarPublicar,
  alFaltarEditar,
}: {
  version: VersionBanco
  rige: boolean
  hermanasPublicadas: VersionBanco[]
  /** Un banco de ALINEACION no reparte por nivel: ver el comentario de `Grupo`. */
  porNivel: boolean
  alCambiar: () => void
  sinPublicar: boolean
  sinEditar: boolean
  alFaltarPublicar: () => void
  alFaltarEditar: () => void
}) {
  const [pregunta, setPregunta] = useState<Pregunta>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState(version.etiqueta)

  const contenido = useQuery({
    queryKey: ['panel-banco-preguntas', version.id],
    queryFn: () => verPreguntasDeVersion(version.id),
    enabled: abierta,
  })

  /*
    Los cuatro verbos son una sola mutacion con un discriminante, no cuatro.

    Los cuatro fallan igual —409 con el motivo escrito por el backend en
    español, 403 sin permiso, 404 cuando la version no es de esta
    organizacion— y solo hay un boton pulsado a la vez. Cuatro mutaciones
    obligaban a sumar cuatro `isPending` para saber si algo estaba en marcha.
  */
  const accion = useMutation({
    mutationFn: (que: Exclude<Pregunta, null>) => {
      if (que === 'publicar') return publicarVersionBanco(version.id)
      if (que === 'archivar') return archivarVersionBanco(version.id)
      if (que === 'descartar') return descartarBorradorBanco(version.id)
      return renombrarVersionBanco(version.id, nuevaEtiqueta.trim())
    },
    onSuccess: (_, que) => {
      setPregunta(null)
      setFallo(null)
      setHecho(loQuePaso(que, hermanasPublicadas, porNivel))
      alCambiar()
    },
    onError: (causa: unknown, que) => {
      setHecho(null)
      if (causa instanceof ErrorApi && causa.estado === 403) {
        /*
          Publicar, archivar y renombrar piden `publicar_version_banco`;
          descartar pide `editar_banco_preguntas`. Un 403 de uno no dice nada
          del otro, asi que cada uno retira solo lo suyo.
        */
        if (que === 'descartar') alFaltarEditar()
        else alFaltarPublicar()
        setPregunta(null)
        return
      }
      setFallo(explicar(causa))
    },
  })

  const trabajando = accion.isPending

  return (
    <li className={estilos.version}>
      <div className={estilos.cabeceraVersion}>
        <span className={estilos.estadoVersion}>{version.estado}</span>
        {/*
          Quien rige y quien no lo dicen con palabras dentro de la propia
          etiqueta, no con un tono: en escala de grises las dos publicadas del
          mismo nivel tienen que seguir distinguiendose.
        */}
        {version.estado === 'PUBLICADA' &&
          (rige ? (
            <span className={estilos.rige}>Se asigna a quien empiece ahora</span>
          ) : (
            <span className={estilos.noRige}>Publicada, pero no se asigna a nadie</span>
          ))}
        <span className={estilos.etiquetaVersion}>{version.etiqueta}</span>
      </div>

      <p className={estilos.datosVersion}>
        Versión {version.id}
        {version.publicadaEn && ` · publicada el ${enFecha(version.publicadaEn)}`}
      </p>

      <div className={estilos.acciones}>
        <button
          className={estilos.chico}
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
        >
          {abierta ? 'Ocultar lo que contiene' : 'Ver qué contiene'}
        </button>

        {version.estado === 'BORRADOR' && !sinPublicar && (
          <button
            className={estilos.principal}
            type="button"
            onClick={() => setPregunta('publicar')}
            disabled={trabajando}
          >
            Publicar
          </button>
        )}

        {version.estado === 'BORRADOR' && !sinEditar && (
          <button
            className={estilos.chico}
            type="button"
            onClick={() => setPregunta('descartar')}
            disabled={trabajando}
          >
            Descartar
          </button>
        )}

        {version.estado === 'PUBLICADA' && !sinPublicar && (
          <>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => setPregunta('archivar')}
              disabled={trabajando}
            >
              Archivar
            </button>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => {
                setNuevaEtiqueta(version.etiqueta)
                setPregunta('renombrar')
              }}
              disabled={trabajando}
            >
              Renombrar
            </button>
          </>
        )}

        {version.estado === 'ARCHIVADA' && (
          <span className={estilos.pista}>
            Archivada: ya no se asigna y no se vuelve a tocar. Sus claves se conservan
            para calificar a quien la respondió.
          </span>
        )}
      </div>

      {pregunta === 'publicar' && (
        <Confirmar
          texto={
            hermanasPublicadas.length > 0
              ? `Publicar esta versión archiva ${hermanasPublicadas.length === 1 ? 'la que hay publicada' : `las ${hermanasPublicadas.length} publicadas`} de este mismo banco: ${listar(hermanasPublicadas)}. Quien todavía no empezó su evaluación pasa a esta; quien ya empezó conserva la suya.`
              : porNivel
                ? 'Al publicarla, se le asigna a todo el que empiece su evaluación en este nivel. Antes, el backend comprueba la clave de cada pregunta.'
                : 'Al publicarla pasa a ser la versión vigente de este banco. Antes, el backend comprueba la clave de cada pregunta.'
          }
          aviso="Si alguna pregunta no cuadra, el backend rechaza la publicación y nombra solo la primera que encuentra: puede haber más detrás."
          verbo="publicar"
          trabajando={trabajando}
          alSeguir={() => accion.mutate('publicar')}
          alVolver={() => setPregunta(null)}
        />
      )}

      {pregunta === 'archivar' && (
        <Confirmar
          texto={
            porNivel
              ? 'Archivar retira esta versión sin poner otra en su lugar. Quien no empezó pasa a la publicada que quede; si no queda ninguna, el backend rechaza el archivado y dice a cuánta gente dejaría sin banco.'
              : /*
                  ⚠️ En ALINEACION el backend NO comprueba si queda reemplazo
                  —esa guarda vive dentro de un `if NIVEL`— así que archivar la
                  única publicada de este banco funciona y no deja nada detrás.
                */
                'Archivar retira esta versión. En un banco de alineación el backend no comprueba si queda alguna publicada detrás: si es la última, este banco se queda sin ninguna versión vigente.'
          }
          verbo="archivar"
          trabajando={trabajando}
          alSeguir={() => accion.mutate('archivar')}
          alVolver={() => setPregunta(null)}
        />
      )}

      {pregunta === 'descartar' && (
        <Confirmar
          texto={`Descartar borra este borrador entero${contenido.data ? ` con sus ${contenido.data.length} preguntas` : ' con todas sus preguntas'}, sus opciones, sus tramos y sus pares.`}
          aviso="No se deshace y no hay papelera."
          verbo="descartar"
          grave
          trabajando={trabajando}
          alSeguir={() => accion.mutate('descartar')}
          alVolver={() => setPregunta(null)}
        />
      )}

      {pregunta === 'renombrar' && (
        <div className={estilos.renombrar}>
          <label className={estilos.etiquetaCampo} htmlFor={`etiqueta-${version.id}`}>
            El nombre de la versión
          </label>
          <input
            className={estilos.entrada}
            id={`etiqueta-${version.id}`}
            type="text"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
          />
          <p className={estilos.pista}>
            Solo cambia el nombre. Las preguntas, sus claves y su puntuación no se tocan
            desde aquí.
          </p>
          <div className={estilos.botonesPregunta}>
            <button
              className={estilos.principal}
              type="button"
              onClick={() => accion.mutate('renombrar')}
              disabled={trabajando || nuevaEtiqueta.trim() === ''}
            >
              {trabajando ? 'Guardando…' : 'Guardar el nombre'}
            </button>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => setPregunta(null)}
              disabled={trabajando}
            >
              Dejarlo como está
            </button>
          </div>
        </div>
      )}

      {hecho && (
        <p className={estilos.avisoBien} role="status">
          {hecho}
        </p>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      {abierta && <Contenido consulta={contenido} />}
    </li>
  )
}

// ---------- Lo que contiene una version ----------

function Contenido({
  consulta,
}: {
  consulta: ReturnType<typeof useQuery<Awaited<ReturnType<typeof verPreguntasDeVersion>>>>
}) {
  if (consulta.isLoading) return <p className={estilos.pista}>Cargando las preguntas…</p>

  if (consulta.isError && !consulta.data) {
    return (
      <p className={estilos.avisoMalo} role="alert">
        {consulta.error instanceof ErrorApi && consulta.error.estado === 403
          ? 'No se pueden ver las preguntas: hace falta el permiso «ver_banco_preguntas».'
          : 'No se pudieron cargar las preguntas de esta versión.'}
      </p>
    )
  }

  const preguntas = consulta.data ?? []

  if (preguntas.length === 0) {
    return (
      <p className={estilos.pista}>
        Esta versión no tiene ninguna pregunta. Publicarla no es posible: un banco vacío
        no se le puede poner delante a nadie.
      </p>
    )
  }

  const puntuan = preguntas.filter((p) => p.esPuntuable).length
  const eliminatorias = preguntas.filter((p) => p.esEliminatorio).length
  const claves = preguntas.filter((p) => p.esClave).length
  const formatos = [...new Set(preguntas.map((p) => p.tipo))].sort()

  return (
    <div className={estilos.contenido}>
      <p className={estilos.resumen}>
        {preguntas.length} preguntas · {puntuan} puntúan · {eliminatorias} eliminatorias ·{' '}
        {claves} marcadas como clave
      </p>
      <p className={estilos.pista}>Formatos: {formatos.join(', ')}</p>

      <ul className={estilos.preguntas} role="list">
        {preguntas.map((p) => (
          <li className={estilos.pregunta} key={p.id}>
            <span className={estilos.codigoPregunta}>{p.codigo}</span>
            <span className={estilos.tipoPregunta}>{p.tipo}</span>
            <span className={estilos.enunciado}>{p.enunciado}</span>
            {p.esEliminatorio && <span className={estilos.marcaGrave}>Eliminatoria</span>}
            {p.esClave && <span className={estilos.marca}>Clave</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Importar el Excel ----------

function Importar({
  alImportar,
  sinPermiso,
  alFaltarPermiso,
}: {
  alImportar: () => void
  sinPermiso: boolean
  alFaltarPermiso: () => void
}) {
  const catalogos = useQuery({ queryKey: ['panel-catalogos'], queryFn: verCatalogos })

  const [archivo, setArchivo] = useState<File | null>(null)
  const [nivel, setNivel] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const importacion = useMutation({
    mutationFn: () => importarBanco(archivo as File, nivel, etiqueta.trim()),
    onSuccess: (r) => {
      /*
        El recuento es lo unico que permite comprobar que el archivo entro
        entero: un Excel al que le falta la hoja de opciones importa sus
        preguntas y no falla. Antes se decia «Banco importado» a secas y ese
        dato se tiraba.
      */
      setResultado(
        `«${r.etiqueta}» quedó en borrador (versión ${r.versionBancoId}): ${r.preguntas} preguntas, ${r.opciones} opciones, ${r.rangos} tramos, ${r.camposCaso} campos de caso, ${r.pares} pares y ${r.dimensionesAsignadas} dimensiones asignadas.`,
      )
      setFallo(null)
      setArchivo(null)
      setEtiqueta('')
      alImportar()
    },
    onError: (c: unknown) => {
      setResultado(null)
      if (c instanceof ErrorApi && c.estado === 403) {
        alFaltarPermiso()
        return
      }
      setFallo(explicar(c))
    },
  })

  if (sinPermiso) return null

  return (
    <div className={estilos.importarBloque}>
      <p className={estilos.nota}>
        Si el archivo tiene problemas, el backend devuelve la lista completa y no importa
        nada: la versión solo se crea entera.
      </p>

      <div className={estilos.importar}>
        <input
          className={estilos.archivo}
          type="file"
          accept=".xlsx,.xls"
          aria-label="La plantilla Excel del banco"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <select
          className={estilos.entrada}
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          aria-label="Nivel del puesto al que pertenece el banco"
        >
          <option value="">Nivel del puesto…</option>
          {(catalogos.data?.nivelesPuesto ?? []).map((n) => (
            <option value={n.codigo} key={n.codigo}>
              {n.nombre}
            </option>
          ))}
        </select>
        <input
          className={estilos.entrada}
          type="text"
          placeholder="Etiqueta de la versión (p. ej. «v4 borrador septiembre»)"
          aria-label="Etiqueta de la versión"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
        />
        <button
          className={estilos.subir}
          type="button"
          onClick={() => importacion.mutate()}
          disabled={importacion.isPending || !archivo || nivel === '' || etiqueta.trim() === ''}
        >
          {importacion.isPending ? 'Importando…' : 'Importar el Excel'}
        </button>
      </div>

      {resultado && (
        <p className={estilos.avisoBien} role="status">
          {resultado}
        </p>
      )}
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </div>
  )
}

// ---------- La pregunta de antes ----------

/**
 * Se pregunta en el sitio y no en un modal, igual que la ausencia de una
 * simulacion: la consecuencia tiene que leerse pegada a la fila que la sufre.
 * Con trece versiones en pantalla, un dialogo que dice «esta versión» obliga a
 * recordar cual se pulso.
 */
function Confirmar({
  texto,
  aviso,
  verbo,
  grave = false,
  trabajando,
  alSeguir,
  alVolver,
}: {
  texto: string
  aviso?: string
  /** En minuscula: se compone como «Sí, publicar». */
  verbo: string
  grave?: boolean
  trabajando: boolean
  alSeguir: () => void
  alVolver: () => void
}) {
  return (
    <div className={grave ? estilos.preguntaGrave : estilos.preguntaCaja} role="group">
      <div className={estilos.cuerpoPregunta}>
        <p className={estilos.textoPregunta}>{texto}</p>
        {aviso && <p className={estilos.avisoDentro}>{aviso}</p>}
        <div className={estilos.botonesPregunta}>
          <button
            className={grave ? estilos.seguirGrave : estilos.seguir}
            type="button"
            onClick={alSeguir}
            disabled={trabajando}
          >
            {trabajando ? 'Un momento…' : `Sí, ${verbo}`}
          </button>
          <button
            className={estilos.chico}
            type="button"
            onClick={alVolver}
            disabled={trabajando}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Piezas sueltas ----------

/*
  Lo que hay que decir DESPUES, que casi nunca es lo mismo que se prometio
  antes. Publicar nombra a las que dejo archivadas —el `for` del backend las
  retira todas, no solo a la ultima— y archivar recuerda que a quien ya empezo
  no se le movio nada.
*/
function loQuePaso(
  que: Exclude<Pregunta, null>,
  hermanas: VersionBanco[],
  porNivel: boolean,
): string {
  if (que === 'publicar') {
    if (hermanas.length > 0) {
      return `Publicada. Quedaron archivadas ${hermanas.length === 1 ? 'la versión' : 'las versiones'} ${listar(hermanas)}.`
    }
    return porNivel
      ? 'Publicada. Es la que se le asigna a quien empiece su evaluación en este nivel.'
      : 'Publicada. Es la versión vigente de este banco.'
  }
  if (que === 'archivar') {
    return porNivel
      ? 'Archivada. Quien no había empezado pasa a la versión que la reemplaza; quien ya empezó conserva la suya.'
      : 'Archivada. En un banco de alineación nadie se repunta a otra versión: quien la tenga asignada la conserva.'
  }
  if (que === 'descartar') return 'Borrador descartado con todas sus preguntas.'
  return 'Renombrada.'
}

const listar = (versiones: VersionBanco[]) =>
  versiones.map((v) => `«${v.etiqueta}»`).join(' y ')

/*
  El 409 del backend viene escrito en español y es especifico —nombra la
  pregunta que falla, o a cuanta gente dejaria sin banco—, asi que se enseña
  tal cual. El 404 es el unico que hay que traducir: dice que la version no
  existe cuando si existe y se esta viendo en la lista.
*/
function explicar(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return 'Esta versión no es de tu empresa: es del banco de la plataforma, que tu empresa usa pero no administra. Para cambiarla hay que personalizar el banco.'
  }
  if (causa instanceof Error && causa.message) return causa.message
  return 'No se pudo completar la operación.'
}

const enFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
