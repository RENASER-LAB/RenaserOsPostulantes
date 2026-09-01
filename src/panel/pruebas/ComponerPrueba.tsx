/**
 * Componer una versión de la prueba del puesto.
 *
 * Todo lo que hace falta para que una prueba se pueda publicar, en una pantalla:
 * los datos de la versión, el enunciado (escrito o subido), la guía que orienta
 * a la IA, las preguntas, lo que hay que entregar, la rúbrica y las variantes
 * del cambio inesperado.
 *
 * ⚠️ **Todo se refresca de la versión entera, no se parchea a mano.** Ninguno de
 * los quince endpoints de edición devuelve la versión actualizada: devuelven un
 * id o nada. Así que cada cambio invalida la consulta y vuelve a pedirla. Es un
 * viaje más, y es lo que hace que **los contadores no puedan mentir**: si se
 * llevaran a mano, la suma de la rúbrica de la pantalla y la del servidor se
 * separarían al primer fallo de red, y un indicador que miente sobre lo que está
 * guardado ya costó respuestas perdidas en este proyecto.
 *
 * ⚠️ **Publicar para en la primera regla que falla.** El backend comprueba en
 * orden la duración, la cuota de preguntas y la rúbrica, y devuelve UN mensaje.
 * Por eso arriba está el balance entero: las tres a la vez, mientras se compone,
 * en vez de descubrirlas de una en una a golpe de intento fallido.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarPlantillasPrueba,
  publicarVersionDePrueba,
  verVersionDePrueba,
} from '../api/panel'
import { ErrorApi } from '../api/cliente'
import { rutas } from '@/rutas'
import type { Cuenta } from './cuotas'
import { balanceDeLaVersion } from './cuotas'
import { explicarFallo } from './borrador'
import { DatosDeLaPrueba } from './DatosDeLaPrueba'
import { Entregables, Preguntas, Rubrica, Variantes } from './ListasDeLaPrueba'
import estilos from './ComponerPrueba.module.css'

export function ComponerPrueba() {
  const { versionId } = useParams()
  const id = Number(versionId)
  const cache = useQueryClient()

  const consulta = useQuery({
    queryKey: ['panel-version-prueba', id],
    queryFn: () => verVersionDePrueba(id),
    enabled: Number.isFinite(id),
  })

  /*
    Una sola forma de refrescar, y la usan los quince `onSuccess`. La lista de
    versiones se invalida tambien porque publicar le cambia el estado a la fila
    que la pantalla anterior enseña.
  */
  const refrescar = async () => {
    await cache.invalidateQueries({ queryKey: ['panel-version-prueba', id] })
    await cache.invalidateQueries({ queryKey: ['panel-versiones-prueba'] })
  }

  const plantillas = useQuery({
    queryKey: ['panel-plantillas-prueba'],
    queryFn: listarPlantillasPrueba,
  })

  if (consulta.isLoading) {
    return (
      <div className={estilos.pagina}>
        <Volver />
        <p className={estilos.nota}>Abriendo la prueba…</p>
      </div>
    )
  }

  if (consulta.isError || !consulta.data) {
    return (
      <div className={estilos.pagina}>
        <Volver />
        <p className={estilos.avisoMalo} role="alert">
          {consulta.error instanceof ErrorApi && consulta.error.estado === 403
            ? 'No se puede abrir esta prueba: hace falta el permiso «elegir_plantilla_prueba».'
            : 'No se pudo abrir esta versión de la prueba.'}
        </p>
      </div>
    )
  }

  const { version, variantes, preguntas, entregables, rubrica } = consulta.data
  const borrador = version.estado === 'BORRADOR'
  const nombre =
    plantillas.data?.find((p) => p.id === version.plantillaPruebaId)?.nombre ??
    `Prueba ${version.plantillaPruebaId}`
  const balance = balanceDeLaVersion(version, preguntas, entregables, rubrica)

  return (
    <div className={estilos.pagina}>
      <Volver />

      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>{nombre}</h1>
        <p className={estilos.identidad}>
          <span className={borrador ? estilos.estadoBorrador : estilos.estadoPublicada}>
            {version.estado}
          </span>
          <span className={estilos.numero}>Versión {version.version}</span>
        </p>
      </div>

      {borrador ? (
        <Publicacion versionId={version.id} balance={balance} alPublicar={refrescar} />
      ) : (
        <Congelada plantillaNombre={nombre} />
      )}

      <DatosDeLaPrueba version={version} editable={borrador} alGuardar={refrescar} />

      <Preguntas
        versionId={version.id}
        elegidas={preguntas}
        editable={borrador}
        pideEntregables={balance.pideEntregables}
        universales={balance.universales}
        especificas={balance.especificas}
        delCuestionario={balance.preguntasDelCuestionario}
        alCambiar={refrescar}
      />

      <Entregables
        versionId={version.id}
        entregables={entregables}
        editable={borrador}
        alCambiar={refrescar}
      />

      <Rubrica
        versionId={version.id}
        rubrica={rubrica}
        editable={borrador}
        cuenta={balance.rubrica}
        alCambiar={refrescar}
      />

      <Variantes
        versionId={version.id}
        variantes={variantes}
        editable={borrador}
        alCambiar={refrescar}
      />
    </div>
  )
}

function Volver() {
  return (
    <Link className={estilos.volver} to={rutas.adminPruebas()}>
      Todas las pruebas
    </Link>
  )
}

// ---------- Lo que falta para publicar ----------

/**
 * El balance, arriba y siempre visible.
 *
 * No es un resumen decorativo: es la única forma de saber las tres cosas a la
 * vez. El backend valida en cascada y devuelve una sola, así que sin esto
 * arreglar una prueba a medio escribir son tres intentos de publicar.
 */
function Publicacion({
  versionId,
  balance,
  alPublicar,
}: {
  versionId: number
  balance: ReturnType<typeof balanceDeLaVersion>
  alPublicar: () => Promise<void>
}) {
  const [fallo, setFallo] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const publicacion = useMutation({
    mutationFn: () => publicarVersionDePrueba(versionId),
    onSuccess: async () => {
      setFallo(null)
      setConfirmando(false)
      await alPublicar()
    },
    onError: (c) => {
      setConfirmando(false)
      setFallo(explicarFallo(c))
    },
  })

  const cuentas: Array<[string, Cuenta | null]> = [
    ['La duración', balance.duracion],
    ['Preguntas universales', balance.universales],
    ['Preguntas del puesto', balance.especificas],
    ['Preguntas', balance.preguntasDelCuestionario],
    ['La rúbrica, en puntos', balance.rubrica],
  ]

  return (
    <section className={estilos.balance} aria-labelledby="balance-titulo">
      <h2 className={estilos.tituloBalance} id="balance-titulo">
        Lo que falta para publicar
      </h2>

      <ul className={estilos.cuentas} role="list">
        {cuentas.map(([nombre, cuenta]) =>
          cuenta === null ? null : (
            <li className={cuenta.cumple ? estilos.cuentaBien : estilos.cuentaFalta} key={nombre}>
              <span className={estilos.nombreCuenta}>{nombre}</span>
              {/*
                La cifra y la cuota, juntas y en cifras tabulares: «140 / 100
                exactos». Es lo que convierte el bloque en algo que se mira de
                reojo mientras se escribe, en vez de un parrafo que hay que leer.
              */}
              <span className={estilos.cifra}>
                {cuenta.hay} <span className={estilos.contra}>de {cuenta.pide}</span>
              </span>
              <span className={estilos.veredicto}>{cuenta.falta ?? 'ya está'}</span>
            </li>
          ),
        )}
      </ul>

      <p className={estilos.pista}>
        {balance.pideEntregables
          ? 'Esta prueba pide entregables, así que rige la cuota completa: las preguntas existen para que quien la rinde defienda lo que produjo.'
          : 'Esta prueba no pide ningún entregable, así que es un cuestionario: sus preguntas son la prueba y basta con una. En cuanto se le añada el primer entregable, pasarán a hacer falta 8-10 universales y 3-5 específicas.'}
      </p>

      {confirmando ? (
        <div className={estilos.confirmar} role="group">
          <p className={estilos.textoConfirmar}>
            Publicar congela esta versión: el enunciado, las preguntas, los entregables y la
            rúbrica ya no se tocan, y una vacante puede empezar a usarla.
          </p>
          {/*
            ⚠️ No hay «despublicar», y decirlo ANTES es la mitad del trabajo de
            este bloque: la salida a un error en una publicada es escribir otra
            version, no volver atras.
          */}
          <p className={estilos.avisoDentro}>
            No se puede deshacer. Para corregirla después habrá que escribir una versión nueva.
          </p>
          <div className={estilos.botones}>
            <button
              className={estilos.seguir}
              type="button"
              onClick={() => publicacion.mutate()}
              disabled={publicacion.isPending}
            >
              {publicacion.isPending ? 'Publicando…' : 'Sí, publicar'}
            </button>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={publicacion.isPending}
            >
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className={estilos.botones}>
          <button
            className={estilos.principal}
            type="button"
            onClick={() => {
              setFallo(null)
              setConfirmando(true)
            }}
            /*
              ⚠️ **No se apaga cuando falta algo.** El balance de arriba es una
              copia de las reglas del servidor, y una copia puede quedarse atras:
              apagar el boton dejaria la version encerrada por un calculo del
              panel. Quien quiera intentarlo, que lo intente y lea la respuesta
              del backend, que es la que manda.
            */
          >
            {balance.listaParaPublicar ? 'Publicar la prueba' : 'Publicar de todos modos'}
          </button>
          {!balance.listaParaPublicar && (
            <span className={estilos.pista}>
              Con algo de lo de arriba en rojo, el servidor la va a rechazar y nombrará solo lo
              primero que encuentre.
            </span>
          )}
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

function Congelada({ plantillaNombre }: { plantillaNombre: string }) {
  return (
    <section className={estilos.congelada}>
      <h2 className={estilos.tituloBalance}>Esta versión ya está publicada</h2>
      <p className={estilos.textoCongelada}>
        No se toca nada de aquí abajo, y no es que falte un botón: quien esté rindiéndola quedó
        atado a este examen, y cambiarle el enunciado a mitad sería medir a dos personas con
        varas distintas.
      </p>
      <p className={estilos.textoCongelada}>
        Para corregir algo se escribe una versión nueva desde{' '}
        <Link className={estilos.enlace} to={rutas.adminPruebas()}>
          la lista de pruebas
        </Link>
        : nace como borrador de «{plantillaNombre}», se compone entera y la vacante pasa a
        apuntar a ella cuando esté publicada.
      </p>
    </section>
  )
}
