/**
 * Las vacantes, para el equipo: la lista y el alta.
 *
 * Crear una vacante no empieza aqui, y la pantalla no lo esconde: el flujo del
 * backend es solicitud → aprobacion de Direccion → vacante. Si no hay ninguna
 * solicitud aprobada sin vacante, el formulario lo dice y deja aprobar una en
 * el sitio, en vez de fallar al enviar con un error que no se entiende.
 *
 * ⚠️ Y escribir una solicitud NO depende de que falte: el backend admite varias
 * ABIERTA a la vez —comprobado contra el local, aprueba dos seguidas con 200—
 * asi que su boton vive en la cabecera. Antes la unica puerta estaba dentro del
 * callejon de «no hay ninguna aprobada» y con una sola abierta desaparecia: no
 * habia forma de escribir la segunda desde el panel.
 */

import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aprobarSolicitud,
  crearPuesto,
  crearSolicitud,
  crearVacante,
  listarAreas,
  listarPuestos,
  listarSolicitudes,
  listarVacantes,
  verCatalogos,
} from '../api/panel'
import type {
  Catalogos,
  CrearSolicitud,
  GuardarVacante,
  PuestoPanel,
  ResultadoEsperado,
  VacantePanel,
} from '../api/tipos'
import { rutas } from '@/rutas'
import { formatearFechaCorta } from '@/dominio/reloj'
import tabla from '../ui/Tabla.module.css'
import {
  CamposDeRemuneracion,
  REMUNERACION_VACIA,
  comoCuerpo,
} from './Remuneracion'
import {
  Area,
  Campo,
  CamposComunes,
  Selector,
  VACANTE_VACIA,
  camposParaGuardar,
  loQueFaltaEnLaVacante,
  type DatosDeVacante,
} from './CamposDeLaVacante'
import { FormularioDeEdicion } from './EditarVacante'
import estilos from './Vacantes.module.css'

/** Como se dice cada estado de vacante. Los codigos son del backend. */
const ESTADO_VACANTE: Record<string, string> = {
  BORRADOR: 'Borrador',
  PUBLICADA: 'Publicada',
  CERRADA: 'Cerrada',
}

export function VacantesPanel() {
  const cache = useQueryClient()
  const [creando, setCreando] = useState(false)
  const [escribiendoSolicitud, setEscribiendoSolicitud] = useState(false)
  /*
   * Que vacante se esta corrigiendo, si alguna. Solo cabe una a la vez, y abrir
   * la edicion cierra el alta: dos formularios de lo mismo abiertos a la vez son
   * dos borradores distintos, y el que se guarda es el que se pulsa — que no
   * siempre es el que se estaba mirando.
   */
  const [editando, setEditando] = useState<number | null>(null)
  /** Lo que se dice en voz alta despues de guardar. */
  const [confirmacion, setConfirmacion] = useState<string | null>(null)

  const vacantes = useQuery({
    queryKey: ['panel-vacantes'],
    queryFn: listarVacantes,
  })

  /*
   * La vacante que se edita se busca en la lista recien traida, no se copia al
   * abrir: asi, cuando el guardado refresca la tabla, el formulario que siga
   * abierto lo hace sobre los datos de ahora.
   */
  const laQueSeEdita: VacantePanel | undefined = (vacantes.data ?? []).find(
    (v) => v.id === editando,
  )

  return (
    <div className={estilos.pagina}>
      <div className={estilos.cabecera}>
        <div>
          <h1>Vacantes.</h1>
          <p className={estilos.bajada}>
            Cada una con su estado. Dentro están los postulantes, el ranking y el avance
            de etapa.
          </p>
        </div>
        <div className={estilos.acciones}>
          {/*
            ⚠️ Vive aqui arriba y no dentro del alta a proposito. El backend
            admite varias solicitudes ABIERTA a la vez —comprobado: aprueba dos
            seguidas con 200— asi que escribir una no puede depender de que no
            haya ninguna. Antes la unica puerta estaba dentro del callejon de
            «no hay ninguna aprobada», y con una sola abierta desaparecia.

            Y va FUERA del `<form>` de alta, como bloque hermano: un formulario
            dentro de otro lo descarta el navegador.
          */}
          <button
            className={estilos.aprobar}
            type="button"
            onClick={() => {
              setEscribiendoSolicitud((v) => !v)
              setEditando(null)
            }}
          >
            {escribiendoSolicitud ? 'Dejarlo' : 'Escribir una solicitud'}
          </button>
          <button
            className={estilos.crear}
            type="button"
            onClick={() => {
              setCreando((v) => !v)
              setEditando(null)
              setConfirmacion(null)
            }}
          >
            {creando ? 'Cerrar el formulario' : 'Crear vacante'}
          </button>
        </div>
      </div>

      {escribiendoSolicitud && (
        <div className={estilos.alta}>
          <h2 className={estilos.tituloAlta}>Solicitud de talento</h2>
          <p className={estilos.explicacionAlta}>
            Es el paso de antes: Dirección aprueba una solicitud y esa solicitud
            respalda <b>una</b> vacante. Puede haber varias aprobadas a la vez esperando
            su vacante.
          </p>
          <SolicitudNueva alTerminar={() => setEscribiendoSolicitud(false)} />
        </div>
      )}

      {creando && (
        <FormularioDeAlta
          alCrear={async () => {
            setCreando(false)
            await cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
          }}
        />
      )}

      {laQueSeEdita && (
        <FormularioDeEdicion
          /*
           * La clave la ata a SU vacante: sin ella, pulsar el lapiz de otra fila
           * reutilizaria el mismo componente y dejaria dentro lo que se estaba
           * escribiendo en la anterior.
           */
          key={laQueSeEdita.id}
          vacante={laQueSeEdita}
          alTerminar={async (mensaje) => {
            setEditando(null)
            setConfirmacion(mensaje)
            await cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
          }}
        />
      )}

      {confirmacion && (
        <p className={`${estilos.aviso} ${estilos.bueno}`} role="status">
          {confirmacion}
        </p>
      )}

      {vacantes.isPending && <p className={estilos.aviso}>Cargando las vacantes…</p>}
      {vacantes.isError && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {vacantes.error instanceof Error
            ? vacantes.error.message
            : 'No se pudo cargar.'}
        </p>
      )}

      {vacantes.data && (
        <div className={tabla.envoltura}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th>Vacante</th>
                <th>Estado</th>
                <th>Evaluación del banco</th>
                <th>Publicada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vacantes.data.map((v) => (
                <tr key={v.id}>
                  <td className={estilos.titulo}>{v.titulo}</td>
                  <td>{ESTADO_VACANTE[v.estado] ?? v.estado}</td>
                  <td>{v.aplicaEvaluacion ? 'Encendida' : 'Apagada'}</td>
                  <td>{v.publicadaEn ? formatearFechaCorta(v.publicadaEn) : '—'}</td>
                  <td className={estilos.acciones}>
                    <Link to={rutas.adminVacante(v.id)}>Ver postulantes y gestionar</Link>
                    {/*
                      El lapiz solo donde de verdad se puede editar: el backend lo
                      decide por vacante —con «sus vacantes» solo alcanzas las que
                      diriges, y una cerrada no se toca— y la fila lo trae dicho.
                      Un boton que siempre contesta 409 es una promesa rota.
                    */}
                    {v.puedeEditar && (
                      <button
                        type="button"
                        className={estilos.lapiz}
                        // El nombre lleva el titulo: con veinte filas, «Editar» a
                        // secas repetido veinte veces no dice cual es cual a quien
                        // navega con lector de pantalla.
                        aria-label={`Editar la vacante ${v.titulo}`}
                        aria-expanded={editando === v.id}
                        onClick={() => {
                          setEditando((actual) => (actual === v.id ? null : v.id))
                          setCreando(false)
                          setEscribiendoSolicitud(false)
                          setConfirmacion(null)
                        }}
                      >
                        <IconoLapiz />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {vacantes.data.length === 0 && (
                <tr>
                  <td colSpan={5} className={tabla.vacia}>
                    <p>Todavía no hay vacantes. Crea la primera con el botón de arriba.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- El alta ----------

function FormularioDeAlta({ alCrear }: { alCrear: () => Promise<void> }) {
  const solicitudes = useQuery({
    queryKey: ['panel-solicitudes'],
    queryFn: listarSolicitudes,
  })
  const catalogos = useQuery({
    queryKey: ['panel-catalogos'],
    queryFn: verCatalogos,
  })

  // Los campos comunes con la edicion van juntos y con su tipo; los dos de aqui
  // —la solicitud que respalda y el puesto— no existen al corregir.
  const [datos, setDatos] = useState<DatosDeVacante>(VACANTE_VACIA)
  const [solicitudTalentoId, setSolicitudTalentoId] = useState('')
  const [puestoId, setPuestoId] = useState('')
  // El sueldo va aparte del resto de campos: es un objeto con cuatro partes que
  // tienen que cuadrar entre si, no una cadena mas. Ver `./Remuneracion`.
  const [remuneracion, setRemuneracion] = useState(REMUNERACION_VACIA)
  const [fallo, setFallo] = useState<string | null>(null)

  const poner = (campo: keyof DatosDeVacante) => (valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }))

  // Solo las aprobadas y sin vacante admiten una nueva.
  const abiertas = useMemo(
    () => (solicitudes.data ?? []).filter((s) => s.estado === 'ABIERTA'),
    [solicitudes.data],
  )
  const solicitudSeleccionada = abiertas.find(
    (solicitud) => String(solicitud.id) === solicitudTalentoId,
  )

  const escogerSolicitud = (valor: string) => {
    const solicitud = abiertas.find((candidata) => String(candidata.id) === valor)
    setSolicitudTalentoId(valor)
    setPuestoId(solicitud?.puestoId ? String(solicitud.puestoId) : '')
    setDatos((actuales) => ({
      ...actuales,
      titulo:
        actuales.titulo.trim() === '' && solicitud?.puestoNombre
          ? solicitud.puestoNombre
          : actuales.titulo,
      proposito:
        actuales.proposito.trim() === '' && solicitud?.resultadoPrincipal
          ? solicitud.resultadoPrincipal
          : actuales.proposito,
    }))
  }

  const creacion = useMutation({
    mutationFn: (cuerpo: GuardarVacante) => crearVacante(cuerpo),
    onSuccess: alCrear,
    onError: (causa) =>
      setFallo(causa instanceof Error ? causa.message : 'No se pudo crear la vacante.'),
  })

  function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    if (!solicitudTalentoId) {
      setFallo('Elige la solicitud que respalda la vacante.')
      return
    }
    if (!solicitudSeleccionada?.puestoId && !puestoId) {
      setFallo('Esta solicitud histórica necesita que elijas un puesto.')
      return
    }
    const falta = loQueFaltaEnLaVacante(datos)
    if (falta) {
      setFallo(falta)
      return
    }
    const sueldo = comoCuerpo(remuneracion)
    if ('error' in sueldo) {
      setFallo(sueldo.error)
      return
    }
    creacion.mutate({
      solicitudTalentoId: Number(solicitudTalentoId),
      puestoId: solicitudSeleccionada?.puestoId ? undefined : Number(puestoId),
      ...camposParaGuardar(datos),
      remuneracion: sueldo.datos,
    })
  }

  /*
   * ⚠️ El formulario NO se pinta mientras `/solicitudes` esta en vuelo, y esa
   * espera es el arreglo entero.
   *
   * Esta consulta nace con el formulario —vive dentro de este componente, que
   * solo se monta al pulsar «Crear vacante»— asi que `isPending` es cierto en
   * TODO primer clic, no solo con una red lenta. Pintar el formulario ahi lo
   * condena: si no viene ninguna ABIERTA, el bloque de abajo lo sustituye y los
   * cuatro desplegables se desmontan bajo el raton. Uno abierto se cierra en el
   * acto, que es exactamente como se ve el fallo. Y hasta entonces el de
   * solicitudes solo lleva «Elige…»: se abre una linea que no sirve de nada.
   */
  if (solicitudes.isPending) {
    return (
      <div className={estilos.alta}>
        <h2 className={estilos.tituloAlta}>Vacante nueva</h2>
        <p className={estilos.aviso}>Buscando las solicitudes aprobadas…</p>
      </div>
    )
  }

  /*
   * Sin la lista no se sabe si hay solicitudes o no, y «No hay ninguna
   * solicitud aprobada» sobre una consulta que fallo manda a escribir una que
   * quiza ya existe.
   */
  if (solicitudes.isError) {
    return (
      <div className={estilos.alta}>
        <h2 className={estilos.tituloAlta}>Vacante nueva</h2>
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {solicitudes.error instanceof Error
            ? solicitudes.error.message
            : 'No se pudieron cargar las solicitudes.'}{' '}
          Sin ellas no se sabe cuáles hay aprobadas.
        </p>
        <button
          className={estilos.aprobar}
          type="button"
          onClick={() => void solicitudes.refetch()}
        >
          Volver a intentarlo
        </button>
      </div>
    )
  }

  // ⚠️ Fuera del <form>, y no dentro: un formulario anidado lo descarta el
  // navegador, y su boton de enviar acaba enviando el de fuera.
  if (abiertas.length === 0) {
    return (
      <div className={estilos.alta}>
        <h2 className={estilos.tituloAlta}>Vacante nueva</h2>
        <SinSolicitudAprobada alAprobar={() => void solicitudes.refetch()} />
      </div>
    )
  }

  return (
    <form className={estilos.alta} onSubmit={alEnviar} noValidate>
      <h2 className={estilos.tituloAlta}>Vacante nueva</h2>

      <div className={estilos.rejilla}>
        <Selector
          etiqueta="Solicitud aprobada que la respalda"
          valor={solicitudTalentoId}
          alCambiar={escogerSolicitud}
          opciones={abiertas.map((s) => ({
            valor: String(s.id),
            texto: `#${s.id} · ${s.puestoNombre ?? 'solicitud histórica sin puesto'} · ${s.resultadoPrincipal || 'sin resultado descrito'}`,
          }))}
        />
        {solicitudSeleccionada?.puestoId && (
          <ResumenPuesto
            nombre={solicitudSeleccionada.puestoNombre ?? `Puesto ${solicitudSeleccionada.puestoId}`}
            nivel={solicitudSeleccionada.nivelPuestoCodigo}
            familia={solicitudSeleccionada.familiaCodigo}
            catalogos={catalogos.data}
          />
        )}
        {solicitudSeleccionada && !solicitudSeleccionada.puestoId && (
          <div className={estilos.anchoEntero}>
            <p className={estilos.compatibilidad}>
              Esta solicitud es anterior al catálogo. Elige su puesto para dejarla actualizada.
            </p>
            <SelectorDePuesto
              etiqueta="Puesto para esta solicitud histórica"
              valor={puestoId}
              alCambiar={setPuestoId}
            />
          </div>
        )}
        {/*
          De aqui abajo, los MISMOS campos que la edicion: se corrige una vacante
          donde se escribio, con las mismas palabras y en el mismo orden. Ver
          `CamposDeLaVacante`.
        */}
        <CamposComunes datos={datos} poner={poner} />
      </div>

      {/*
        El sueldo, fuera de la rejilla de campos y con su propio bloque.

        No es un campo mas: decide si a quien postule se le va a exigir declarar
        cuanto quiere ganar, y esa consecuencia necesita sitio para explicarse
        debajo de cada opcion. Metido entre «Horario» y «Como se cierra» seria
        una linea que nadie lee.
      */}
      <div className={estilos.bloqueRemuneracion}>
        <CamposDeRemuneracion valor={remuneracion} alCambiar={setRemuneracion} />
      </div>

      {fallo && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {fallo}
        </p>
      )}

      <button className={estilos.enviar} type="submit" disabled={creacion.isPending}>
        {creacion.isPending ? 'Creando…' : 'Crear en borrador'}
      </button>
    </form>
  )
}

/**
 * Escribir una solicitud y dejarla lista para respaldar una vacante.
 *
 * Se aprueba al vuelo —lo hace Direccion— porque una solicitud en BORRADOR no
 * sirve para abrir nada y no hay otra pantalla donde aprobarla. El motivo queda
 * auditado y no se deshace, asi que dice lo que de verdad paso.
 */
function SolicitudNueva({ alTerminar }: { alTerminar: () => void }) {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)

  const aprobacion = useMutation({
    mutationFn: (id: number) =>
      aprobarSolicitud(id, 'Escrita y aprobada desde el panel de vacantes'),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['panel-solicitudes'] })
      alTerminar()
    },
    onError: (causa) =>
      setFallo(causa instanceof Error ? causa.message : 'No se pudo aprobar.'),
  })

  return (
    <>
      <FormularioDeSolicitud alCrear={(id) => aprobacion.mutate(id)} />
      {fallo && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {fallo} La solicitud se escribió, pero quedó en borrador.
        </p>
      )}
    </>
  )
}

/**
 * El callejon honesto: sin solicitud aprobada no hay vacante. Se deja aprobar
 * aqui mismo una en borrador —lo hace Direccion— para no mandar a nadie a
 * buscar otra pantalla que no existe.
 */
/**
 * El punto muerto de antes de la vacante, con salida.
 *
 * El backend no deja abrir una vacante sin una solicitud aprobada que la
 * respalde, y aqui se puede hacer las dos cosas: aprobar una que este en
 * borrador, o escribir la solicitud desde cero. Sin esto, una base recien
 * montada deja la pantalla sin ninguna salida.
 */
function SinSolicitudAprobada({ alAprobar }: { alAprobar: () => void }) {
  const solicitudes = useQuery({
    queryKey: ['panel-solicitudes'],
    queryFn: listarSolicitudes,
  })
  const [fallo, setFallo] = useState<string | null>(null)
  const [pidiendo, setPidiendo] = useState(false)

  const borradores = (solicitudes.data ?? []).filter((s) => s.estado === 'BORRADOR')

  const aprobacion = useMutation({
    mutationFn: (id: number) =>
      aprobarSolicitud(id, 'Aprobada desde el panel para abrir la vacante'),
    onSuccess: alAprobar,
    onError: (causa) =>
      setFallo(causa instanceof Error ? causa.message : 'No se pudo aprobar.'),
  })

  return (
    <div className={estilos.sinSolicitud}>
      <p className={estilos.explicacion}>
        <b>No hay ninguna solicitud aprobada sin vacante.</b> El flujo empieza por una
        solicitud de contratación que Dirección aprueba; recién entonces se puede abrir la
        vacante.
      </p>

      {borradores.length > 0 && (
        <ul className={estilos.borradores} role="list">
          {borradores.map((s) => (
            <li className={estilos.borrador} key={s.id}>
              <span>
                Solicitud #{s.id} · {s.resultadoPrincipal || 'sin resultado descrito'}
              </span>
              <button
                className={estilos.aprobar}
                type="button"
                onClick={() => aprobacion.mutate(s.id)}
                disabled={aprobacion.isPending}
              >
                Aprobar
              </button>
            </li>
          ))}
        </ul>
      )}

      {pidiendo ? (
        <FormularioDeSolicitud
          alCrear={(id) => {
            setPidiendo(false)
            aprobacion.mutate(id)
          }}
        />
      ) : (
        <button
          className={estilos.aprobar}
          type="button"
          onClick={() => setPidiendo(true)}
        >
          Escribir una solicitud nueva
        </button>
      )}

      {fallo && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {fallo}
        </p>
      )}
    </div>
  )
}

/**
 * La solicitud de contratación: por qué hace falta contratar a alguien.
 *
 * El puesto nace aquí. Su nivel y familia se enseñan para confirmar la decisión,
 * pero el backend los deriva del catálogo: no hay dos fuentes de verdad.
 */
function FormularioDeSolicitud({ alCrear }: { alCrear: (id: number) => void }) {
  const areas = useQuery({ queryKey: ['panel-areas'], queryFn: listarAreas })
  const catalogos = useQuery({
    queryKey: ['panel-catalogos'],
    queryFn: verCatalogos,
  })
  const [fallo, setFallo] = useState<string | null>(null)
  const [datos, setDatos] = useState({
    areaId: '',
    puestoId: '',
    urgencia: 'NORMAL',
    resultadoPrincipal: '',
    motivo: '',
    consecuenciaNoContratar: '',
    analisisCapacidad: '',
  })
  // Tres es el minimo que acepta el backend, asi que se abren tres.
  const [resultados, setResultados] = useState<ResultadoEsperado[]>([
    { descripcion: '', indicador: '' },
    { descripcion: '', indicador: '' },
    { descripcion: '', indicador: '' },
  ])
  const ponerResultado = (i: number, campo: keyof ResultadoEsperado) => (valor: string) =>
    setResultados((rs) => rs.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)))
  const poner = (campo: keyof typeof datos) => (valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }))

  const creacion = useMutation({
    mutationFn: (cuerpo: CrearSolicitud) => crearSolicitud(cuerpo),
    onSuccess: alCrear,
    onError: (causa) =>
      setFallo(causa instanceof Error ? causa.message : 'No se pudo crear la solicitud.'),
  })

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    setFallo(null)
    if (!datos.puestoId) {
      setFallo('Elige o crea el puesto solicitado antes de continuar.')
      return
    }
    creacion.mutate({
      areaId: Number(datos.areaId),
      puestoId: Number(datos.puestoId),
      urgencia: datos.urgencia,
      resultadoPrincipal: datos.resultadoPrincipal,
      motivo: datos.motivo,
      consecuenciaNoContratar: datos.consecuenciaNoContratar,
      analisisCapacidad: datos.analisisCapacidad,
      resultadosEsperados: resultados
        .filter((r) => r.descripcion.trim() !== '')
        .map((r) => ({
          descripcion: r.descripcion.trim(),
          indicador: r.indicador?.trim() || null,
        })),
    })
  }

  return (
    <form className={estilos.formulario} onSubmit={enviar} noValidate>
      <SelectorDePuesto
        etiqueta="Puesto solicitado"
        valor={datos.puestoId}
        alCambiar={poner('puestoId')}
      />

      <div className={estilos.rejilla}>
        <Selector
          etiqueta="Área que pide"
          valor={datos.areaId}
          alCambiar={poner('areaId')}
          cargando={areas.isPending}
          vacio="No hay ningún área dada de alta"
          opciones={(areas.data ?? []).map((a) => ({
            valor: String(a.id),
            texto: a.nombre,
          }))}
        />
        <Selector
          etiqueta="Urgencia"
          valor={datos.urgencia}
          alCambiar={poner('urgencia')}
          sinVacio
          cargando={catalogos.isPending}
          opciones={(catalogos.data?.urgencias ?? []).map((u) => ({
            valor: u.codigo,
            texto: u.nombre,
          }))}
        />
        <Campo
          etiqueta="El resultado principal que se busca"
          valor={datos.resultadoPrincipal}
          alCambiar={poner('resultadoPrincipal')}
          ancho
        />
        <Area
          etiqueta="Por qué hace falta"
          valor={datos.motivo}
          alCambiar={poner('motivo')}
          ancho
        />
        <Area
          etiqueta="Qué pasa si no se contrata"
          valor={datos.consecuenciaNoContratar}
          alCambiar={poner('consecuenciaNoContratar')}
          ancho
        />
        <Area
          etiqueta="Por qué el equipo actual no puede asumirlo"
          valor={datos.analisisCapacidad}
          alCambiar={poner('analisisCapacidad')}
          ancho
        />
      </div>

      <fieldset className={estilos.resultados}>
        <legend className={estilos.etiqueta}>
          Qué tiene que conseguir · entre 3 y 5, con cómo se medirá
        </legend>
        {resultados.map((r, i) => (
          <div className={estilos.rejilla} key={i}>
            <Campo
              etiqueta={`Resultado ${i + 1}`}
              valor={r.descripcion}
              alCambiar={ponerResultado(i, 'descripcion')}
            />
            <Campo
              etiqueta={`Cómo se medirá ${i + 1}`}
              valor={r.indicador ?? ''}
              alCambiar={ponerResultado(i, 'indicador')}
            />
          </div>
        ))}
        {resultados.length < 5 && (
          <button
            className={estilos.aprobar}
            type="button"
            onClick={() =>
              setResultados((rs) => [...rs, { descripcion: '', indicador: '' }])
            }
          >
            Añadir otro resultado
          </button>
        )}
      </fieldset>

      {fallo && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {fallo}
        </p>
      )}

      <button className={estilos.enviar} type="submit" disabled={creacion.isPending}>
        {creacion.isPending ? 'Creando…' : 'Crear la solicitud y aprobarla'}
      </button>
    </form>
  )
}

function nombreDeCatalogo(codigo: string | null, opciones = [] as { codigo: string; nombre: string }[]) {
  if (!codigo) return 'Sin clasificar'
  return opciones.find((opcion) => opcion.codigo === codigo)?.nombre
    ?? codigo.toLowerCase().replaceAll('_', ' ').replace(/^./, (letra) => letra.toUpperCase())
}

function ResumenPuesto({
  nombre,
  nivel,
  familia,
  catalogos,
}: {
  nombre: string
  nivel: string | null
  familia: string | null
  catalogos?: Catalogos
}) {
  return (
    <div className={`${estilos.puestoResumen} ${estilos.anchoEntero}`} aria-label="Puesto seleccionado">
      <span className={estilos.etiqueta}>Puesto seleccionado</span>
      <strong>{nombre}</strong>
      <span className={estilos.clasificacionPuesto}>
        {nombreDeCatalogo(nivel, catalogos?.nivelesPuesto)} ·{' '}
        {nombreDeCatalogo(familia, catalogos?.familias)}
      </span>
    </div>
  )
}

/**
 * La misma decisión de puesto sirve para una solicitud nueva y para reparar una
 * solicitud histórica. La creación inline es un fieldset, nunca otro formulario.
 */
function SelectorDePuesto({
  etiqueta,
  valor,
  alCambiar,
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
}) {
  const cache = useQueryClient()
  const puestos = useQuery({ queryKey: ['panel-puestos'], queryFn: listarPuestos })
  const catalogos = useQuery({ queryKey: ['panel-catalogos'], queryFn: verCatalogos })
  const [creando, setCreando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState({
    nombre: '',
    nivelPuestoCodigo: '',
    familiaCodigo: '',
  })
  const puestoSeleccionado = (puestos.data ?? []).find((puesto) => String(puesto.id) === valor)
  const errorId = `error-puesto-${etiqueta.toLowerCase().replaceAll(' ', '-')}`

  const alta = useMutation({
    mutationFn: () => crearPuesto({
      nombre: nuevo.nombre.trim(),
      nivelPuestoCodigo: nuevo.nivelPuestoCodigo,
      familiaCodigo: nuevo.familiaCodigo,
    }),
    onSuccess: (id) => {
      const puesto: PuestoPanel = {
        id,
        codigo: '',
        nombre: nuevo.nombre.trim(),
        nivelPuestoCodigo: nuevo.nivelPuestoCodigo,
        familiaCodigo: nuevo.familiaCodigo,
      }
      cache.setQueryData<PuestoPanel[]>(['panel-puestos'], (actuales = []) => [
        ...actuales.filter((actual) => actual.id !== id),
        puesto,
      ])
      void cache.invalidateQueries({ queryKey: ['panel-puestos'], refetchType: 'none' })
      alCambiar(String(id))
      setCreando(false)
      setFallo(null)
    },
    onError: (causa) =>
      setFallo(causa instanceof Error ? causa.message : 'No se pudo crear el puesto.'),
  })

  const guardar = () => {
    setFallo(null)
    if (!nuevo.nombre.trim() || !nuevo.nivelPuestoCodigo || !nuevo.familiaCodigo) {
      setFallo('Escribe el nombre y elige el nivel y la familia del puesto.')
      return
    }
    alta.mutate()
  }

  return (
    <fieldset className={estilos.puesto}>
      <legend className={estilos.etiqueta}>{etiqueta}</legend>
      <p className={estilos.ayudaPuesto}>
        El puesto define el nivel de evaluación y la familia de trabajo de todo el proceso.
      </p>
      <div className={estilos.puestoCabecera}>
        <Selector
          etiqueta={etiqueta}
          valor={valor}
          alCambiar={alCambiar}
          cargando={puestos.isPending}
          vacio="Todavía no hay puestos; crea el primero"
          opciones={(puestos.data ?? []).map((puesto) => ({
            valor: String(puesto.id),
            texto: `${puesto.nombre} · ${nombreDeCatalogo(puesto.nivelPuestoCodigo, catalogos.data?.nivelesPuesto)} · ${nombreDeCatalogo(puesto.familiaCodigo, catalogos.data?.familias)}`,
          }))}
        />
        <button
          className={estilos.aprobar}
          type="button"
          aria-expanded={creando}
          onClick={() => {
            setCreando((actual) => !actual)
            setFallo(null)
          }}
        >
          {creando ? 'Cancelar puesto nuevo' : 'Crear un puesto nuevo'}
        </button>
      </div>

      {puestoSeleccionado && (
        <ResumenPuesto
          nombre={puestoSeleccionado.nombre}
          nivel={puestoSeleccionado.nivelPuestoCodigo}
          familia={puestoSeleccionado.familiaCodigo}
          catalogos={catalogos.data}
        />
      )}

      {creando && (
        <div className={estilos.puestoNuevo}>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Nombre del puesto</span>
            <input
              className={estilos.entrada}
              value={nuevo.nombre}
              aria-describedby={fallo ? errorId : undefined}
              onChange={(evento) => setNuevo((actual) => ({ ...actual, nombre: evento.target.value }))}
            />
          </label>

          <fieldset className={estilos.niveles} aria-describedby={fallo ? errorId : undefined}>
            <legend className={estilos.etiqueta}>Nivel del puesto</legend>
            <div className={estilos.opcionesNivel}>
              {(catalogos.data?.nivelesPuesto ?? []).map((nivel) => (
                <label className={estilos.opcionNivel} key={nivel.codigo}>
                  <input
                    type="radio"
                    name={`nivel-${etiqueta}`}
                    value={nivel.codigo}
                    checked={nuevo.nivelPuestoCodigo === nivel.codigo}
                    onChange={(evento) => setNuevo((actual) => ({
                      ...actual,
                      nivelPuestoCodigo: evento.target.value,
                    }))}
                  />
                  <span>{nivel.nombre}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Familia del puesto</span>
            <select
              className={estilos.entrada}
              value={nuevo.familiaCodigo}
              disabled={catalogos.isPending || (catalogos.data?.familias.length ?? 0) === 0}
              aria-describedby={fallo ? errorId : undefined}
              onChange={(evento) => setNuevo((actual) => ({
                ...actual,
                familiaCodigo: evento.target.value,
              }))}
            >
              <option value="">Elige…</option>
              {(catalogos.data?.familias ?? []).map((familia) => (
                <option value={familia.codigo} key={familia.codigo}>{familia.nombre}</option>
              ))}
            </select>
          </label>

          {fallo && <p className={`${estilos.aviso} ${estilos.malo}`} id={errorId} role="alert">{fallo}</p>}
          <button
            className={estilos.aprobar}
            type="button"
            disabled={alta.isPending || catalogos.isPending}
            onClick={guardar}
          >
            {alta.isPending ? 'Guardando puesto…' : 'Guardar y elegir este puesto'}
          </button>
        </div>
      )}
    </fieldset>
  )
}

/**
 * El lapiz de cada fila.
 *
 * Mismo trazo que el resto de iconos del panel —16 px, grosor 2, hereda el
 * color— para no traerse una libreria entera por un dibujo. El nombre
 * accesible lo pone el boton que lo envuelve: aqui el SVG se esconde.
 */
function IconoLapiz() {
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
      focusable="false"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
