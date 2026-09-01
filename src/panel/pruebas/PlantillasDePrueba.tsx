/**
 * Las pruebas del puesto: que plantillas hay y en que estado esta cada version.
 *
 * Hasta hoy esto **no se podia hacer desde ninguna pantalla**: las cinco pruebas
 * reales entraron por `scripts/cargar-convocatoria.py`, llamando a la API una
 * por una. Quien no escribe Python no podia escribir una prueba, y sin prueba
 * publicada una vacante no se puede publicar.
 *
 * ⚠️ **Una plantilla no es una prueba: es su nombre.** Lo que se rinde es una
 * VERSION suya, y la vacante apunta a la version, no a la plantilla. Por eso la
 * lista no enseña plantillas a secas —eso dejaria «Reto con entregables» como si
 * ya fuera algo que alguien puede rendir— sino cada plantilla con sus versiones
 * debajo y el estado de cada una.
 *
 * ⚠️ **Publicar es el punto de no retorno y no hay «despublicar».** Una version
 * publicada se congela: quien la este rindiendo queda atado a ella. La salida a
 * un error es una version nueva, que nace del boton de aqui.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearPlantillaPrueba,
  crearVersionDePrueba,
  listarPlantillasPrueba,
  listarPuestos,
  listarVersionesPrueba,
} from '../api/panel'
import { ErrorApi } from '../api/cliente'
import type { PlantillaPruebaPanel, VersionPrueba } from '../api/tipos'
import { rutas } from '@/rutas'
import { VERSION_NUEVA, explicarFallo } from './borrador'
import estilos from './PlantillasDePrueba.module.css'

export function PlantillasDePrueba() {
  const plantillas = useQuery({
    queryKey: ['panel-plantillas-prueba'],
    queryFn: listarPlantillasPrueba,
  })

  /*
    Una consulta por plantilla, no una sola que las traiga todas: el backend
    lista versiones **por plantilla**, y `useQueries` las pide en paralelo y
    deja cada una con su propio estado de carga. Antes esto se resolvia
    adivinando ids, que es lo que este endpoint vino a quitar.
  */
  const porPlantilla = useQueries({
    queries: (plantillas.data ?? []).map((p) => ({
      queryKey: ['panel-versiones-prueba', p.id],
      queryFn: () => listarVersionesPrueba(p.id),
    })),
  })

  /*
    Solo la lista de plantillas. Las versiones de cada una avisan dentro de su
    propia tarjeta, y sumarlas aquí ponía dos «buscando…» a la vez en la pantalla
    —uno arriba y otro dentro de cada plantilla ya pintada— diciendo lo mismo.
  */
  const buscando = plantillas.isLoading

  return (
    <div className={estilos.pagina}>
      <h1>Pruebas del puesto.</h1>
      <p className={estilos.bajada}>
        Lo que alguien resuelve cuando llega a la etapa técnica. Se escribe en una versión, se
        compone entera —enunciado, preguntas, lo que hay que entregar y la rúbrica— y se
        publica. Una vacante elige una versión publicada, y la que ya se está rindiendo no se
        toca nunca más.
      </p>

      <CrearPlantilla />

      {buscando && <p className={estilos.nota}>Buscando las pruebas…</p>}

      {plantillas.isError && !plantillas.data && (
        <p className={estilos.avisoMalo} role="alert">
          {plantillas.error instanceof ErrorApi && plantillas.error.estado === 403
            ? 'No se pueden ver las pruebas: hace falta el permiso «elegir_plantilla_prueba».'
            : 'No se pudieron cargar las pruebas del puesto.'}
        </p>
      )}

      {plantillas.data && plantillas.data.length === 0 && (
        <p className={estilos.nota}>
          Todavía no hay ninguna prueba escrita. La primera se crea aquí arriba, y sin al menos
          una publicada ninguna vacante se puede publicar.
        </p>
      )}

      {plantillas.data && plantillas.data.length > 0 && (
        <ul className={estilos.plantillas} role="list">
          {plantillas.data.map((p, i) => (
            <Plantilla
              key={p.id}
              plantilla={p}
              versiones={porPlantilla[i]?.data ?? []}
              buscando={porPlantilla[i]?.isLoading ?? false}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Una plantilla y sus versiones ----------

function Plantilla({
  plantilla,
  versiones,
  buscando,
}: {
  plantilla: PlantillaPruebaPanel
  versiones: VersionPrueba[]
  buscando: boolean
}) {
  const puestos = useQuery({ queryKey: ['panel-puestos'], queryFn: listarPuestos })
  const nombreDelPuesto = puestos.data?.find((x) => x.id === plantilla.puestoId)?.nombre

  const publicadas = versiones.filter((v) => v.estado === 'PUBLICADA')
  const borradores = versiones.filter((v) => v.estado === 'BORRADOR')

  return (
    <li className={estilos.plantilla}>
      <div className={estilos.cabecera}>
        <h2 className={estilos.nombre}>{plantilla.nombre}</h2>
        {/*
          El puesto se dice con palabras y no con una etiqueta de color: «sirve
          para cualquier puesto» es una propiedad importante —es la que hace que
          una vacante encuentre alguna prueba que ofrecer— y un tono no la dice.
        */}
        <span className={estilos.deQuien}>
          {plantilla.puestoId === null
            ? 'Genérica: sirve para cualquier puesto'
            : `Escrita para ${nombreDelPuesto ?? `el puesto ${plantilla.puestoId}`}`}
        </span>
      </div>

      {buscando && <p className={estilos.pista}>Buscando sus versiones…</p>}

      {!buscando && versiones.length === 0 && (
        <p className={estilos.pista}>
          Esta prueba no tiene ninguna versión todavía: no hay nada que rendir ni nada que una
          vacante pueda elegir.
        </p>
      )}

      {versiones.length > 0 && (
        <ul className={estilos.versiones} role="list">
          {versiones.map((v) => (
            <FilaDeVersion key={v.id} version={v} />
          ))}
        </ul>
      )}

      <NuevaVersion
        plantillaId={plantilla.id}
        hayBorrador={borradores.length > 0}
        ultimaPublicada={publicadas[0] ?? null}
      />
    </li>
  )
}

function FilaDeVersion({ version }: { version: VersionPrueba }) {
  const borrador = version.estado === 'BORRADOR'

  return (
    <li className={estilos.version}>
      <span className={borrador ? estilos.estadoBorrador : estilos.estadoPublicada}>
        {version.estado}
      </span>
      <span className={estilos.numero}>v{version.version}</span>
      <span className={estilos.resumen}>
        {borrador
          ? 'Se está componiendo. No se puede elegir en ninguna vacante todavía.'
          : `Publicada${version.publicadaEn ? ` el ${enFecha(version.publicadaEn)}` : ''}. Congelada: ya se puede elegir en una vacante.`}
      </span>
      <Link className={estilos.abrir} to={rutas.adminComponerPrueba(version.id)}>
        {borrador ? 'Componer' : 'Ver cómo quedó'}
      </Link>
    </li>
  )
}

// ---------- Crear una plantilla ----------

function CrearPlantilla() {
  const cache = useQueryClient()
  const puestos = useQuery({ queryKey: ['panel-puestos'], queryFn: listarPuestos })

  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [puestoId, setPuestoId] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)

  const creacion = useMutation({
    mutationFn: () =>
      crearPlantillaPrueba(nombre.trim(), puestoId === '' ? null : Number(puestoId)),
    onSuccess: async () => {
      setNombre('')
      setPuestoId('')
      setFallo(null)
      setAbierto(false)
      await cache.invalidateQueries({ queryKey: ['panel-plantillas-prueba'] })
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  if (!abierto) {
    return (
      <button className={estilos.empezar} type="button" onClick={() => setAbierto(true)}>
        Escribir una prueba nueva
      </button>
    )
  }

  return (
    <div className={estilos.formulario}>
      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>Cómo se llama</span>
        <input
          className={estilos.entrada}
          type="text"
          value={nombre}
          placeholder="P. ej. «Reto de priorización · Analista»"
          onChange={(e) => setNombre(e.target.value)}
        />
        <span className={estilos.pista}>
          Es el nombre con el que se elige en una vacante. Quien la rinde no lo ve.
        </span>
      </label>

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>Para qué puesto</span>
        <select
          className={estilos.entrada}
          value={puestoId}
          onChange={(e) => setPuestoId(e.target.value)}
        >
          <option value="">Cualquiera: es una prueba genérica</option>
          {(puestos.data ?? []).map((p) => (
            <option value={p.id} key={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {/*
          ⚠️ Elegir puesto ESTRECHA. El desplegable de la vacante solo ofrece las
          pruebas de su puesto y las genericas, asi que una prueba atada al
          puesto equivocado se vuelve invisible sin que nada avise.
        */}
        <span className={estilos.pista}>
          Sin puesto sirve para cualquier vacante. Con puesto, solo las vacantes de ese puesto
          la ofrecen: es lo que evita mandarle a un desarrollador la prueba de administración.
        </span>
      </label>

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      <div className={estilos.botones}>
        <button
          className={estilos.principal}
          type="button"
          onClick={() => creacion.mutate()}
          disabled={creacion.isPending || nombre.trim() === ''}
        >
          {creacion.isPending ? 'Creándola…' : 'Crear la prueba'}
        </button>
        <button
          className={estilos.chico}
          type="button"
          onClick={() => {
            setAbierto(false)
            setFallo(null)
          }}
          disabled={creacion.isPending}
        >
          Dejarlo
        </button>
      </div>
    </div>
  )
}

// ---------- Crear una version ----------

function NuevaVersion({
  plantillaId,
  hayBorrador,
  ultimaPublicada,
}: {
  plantillaId: number
  hayBorrador: boolean
  ultimaPublicada: VersionPrueba | null
}) {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)

  const creacion = useMutation({
    /*
      La version nace con lo minimo que el backend acepta y se compone despues en
      su pantalla. Pedir aqui el enunciado, la modalidad y la duracion antes de
      poder crear nada convertiria el boton en un formulario, y todo eso se
      edita igual en el paso siguiente.
    */
    mutationFn: () => crearVersionDePrueba(plantillaId, VERSION_NUEVA),
    onSuccess: async () => {
      setFallo(null)
      await cache.invalidateQueries({ queryKey: ['panel-versiones-prueba', plantillaId] })
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  return (
    <div className={estilos.piePlantilla}>
      <button
        className={estilos.chico}
        type="button"
        onClick={() => creacion.mutate()}
        disabled={creacion.isPending}
      >
        {creacion.isPending ? 'Creando el borrador…' : 'Empezar una versión nueva'}
      </button>

      <span className={estilos.pista}>
        {hayBorrador
          ? 'Ya hay un borrador sin publicar en esta prueba: conviene terminarlo antes de abrir otro.'
          : ultimaPublicada
            ? `Nace como borrador y será la v${ultimaPublicada.version + 1}. La publicada de ahora no se toca: quien la esté rindiendo sigue con ella.`
            : 'Nace como borrador: se compone entera y solo entonces se publica.'}
      </span>

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </div>
  )
}

const enFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
