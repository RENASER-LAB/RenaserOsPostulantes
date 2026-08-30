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
  listarUsuarios,
  listarVacantes,
  verCatalogos,
} from '../api/panel'
import type {
  Catalogos,
  CrearSolicitud,
  GuardarVacante,
  PuestoPanel,
  ResultadoEsperado,
} from '../api/tipos'
import { rutas } from '@/rutas'
import { formatearFechaCorta } from '@/dominio/reloj'
import tabla from '../ui/Tabla.module.css'
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

  const vacantes = useQuery({
    queryKey: ['panel-vacantes'],
    queryFn: listarVacantes,
  })

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
            onClick={() => setEscribiendoSolicitud((v) => !v)}
          >
            {escribiendoSolicitud ? 'Dejarlo' : 'Escribir una solicitud'}
          </button>
          <button
            className={estilos.crear}
            type="button"
            onClick={() => setCreando((v) => !v)}
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
                  <td>
                    <Link to={rutas.adminVacante(v.id)}>Ver postulantes y gestionar</Link>
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
  const usuarios = useQuery({
    queryKey: ['panel-usuarios'],
    queryFn: listarUsuarios,
  })
  const catalogos = useQuery({
    queryKey: ['panel-catalogos'],
    queryFn: verCatalogos,
  })

  const [datos, setDatos] = useState({
    solicitudTalentoId: '',
    puestoId: '',
    responsableUsuarioId: '',
    titulo: '',
    descripcion: '',
    proposito: '',
    responsabilidades: '',
    requisitos: '',
    modalidad: '',
    horario: '',
    ubicacion: '',
    compensacionPublica: '',
    tipoCierre: 'PERMANENTE',
    plazas: '',
    cierraEn: '',
  })
  const [fallo, setFallo] = useState<string | null>(null)

  const poner = (campo: keyof typeof datos) => (valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }))

  // Solo las aprobadas y sin vacante admiten una nueva.
  const abiertas = useMemo(
    () => (solicitudes.data ?? []).filter((s) => s.estado === 'ABIERTA'),
    [solicitudes.data],
  )
  const solicitudSeleccionada = abiertas.find(
    (solicitud) => String(solicitud.id) === datos.solicitudTalentoId,
  )

  const escogerSolicitud = (valor: string) => {
    const solicitud = abiertas.find((candidata) => String(candidata.id) === valor)
    setDatos((actuales) => ({
      ...actuales,
      solicitudTalentoId: valor,
      puestoId: solicitud?.puestoId ? String(solicitud.puestoId) : '',
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
    if (!datos.solicitudTalentoId || !datos.responsableUsuarioId) {
      setFallo('Elige la solicitud y el responsable del proceso.')
      return
    }
    if (!solicitudSeleccionada?.puestoId && !datos.puestoId) {
      setFallo('Esta solicitud histórica necesita que elijas un puesto.')
      return
    }
    if (datos.titulo.trim() === '' || datos.descripcion.trim() === '') {
      setFallo('El título y la descripción son lo mínimo que ve quien postula.')
      return
    }
    creacion.mutate({
      solicitudTalentoId: Number(datos.solicitudTalentoId),
      puestoId: solicitudSeleccionada?.puestoId
        ? undefined
        : Number(datos.puestoId),
      responsableUsuarioId: Number(datos.responsableUsuarioId),
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      proposito: datos.proposito.trim() || undefined,
      responsabilidades: datos.responsabilidades.trim() || undefined,
      requisitos: datos.requisitos.trim() || undefined,
      modalidad: datos.modalidad.trim() || undefined,
      horario: datos.horario.trim() || undefined,
      ubicacion: datos.ubicacion.trim() || undefined,
      compensacionPublica: datos.compensacionPublica.trim() || undefined,
      tipoCierre: datos.tipoCierre,
      plazas:
        datos.tipoCierre === 'PLAZAS' && datos.plazas ? Number(datos.plazas) : undefined,
      cierraEn:
        datos.tipoCierre === 'FECHA' && datos.cierraEn
          ? new Date(datos.cierraEn).toISOString()
          : undefined,
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
          valor={datos.solicitudTalentoId}
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
              valor={datos.puestoId}
              alCambiar={poner('puestoId')}
            />
          </div>
        )}
        <Selector
          etiqueta="Responsable del proceso"
          valor={datos.responsableUsuarioId}
          alCambiar={poner('responsableUsuarioId')}
          cargando={usuarios.isPending}
          vacio="No hay ningún usuario del equipo"
          opciones={(usuarios.data ?? []).map((u) => ({
            valor: String(u.id),
            texto: u.correo ?? u.usuarioRenaserOsId ?? `Usuario ${u.id}`,
          }))}
        />

        <Campo
          etiqueta="Título que ve quien postula"
          valor={datos.titulo}
          alCambiar={poner('titulo')}
          ancho
        />
        <Area
          etiqueta="Descripción"
          valor={datos.descripcion}
          alCambiar={poner('descripcion')}
          ancho
        />
        <Area
          etiqueta="El resultado que se espera (propósito)"
          valor={datos.proposito}
          alCambiar={poner('proposito')}
          ancho
        />
        <Area
          etiqueta="Lo que hará, una responsabilidad por línea"
          valor={datos.responsabilidades}
          alCambiar={poner('responsabilidades')}
          ancho
        />
        <Area
          etiqueta="Lo que se busca, un requisito por línea"
          valor={datos.requisitos}
          alCambiar={poner('requisitos')}
          ancho
        />

        <Campo
          etiqueta="Modalidad (Presencial, Híbrido…)"
          valor={datos.modalidad}
          alCambiar={poner('modalidad')}
        />
        <Campo etiqueta="Horario" valor={datos.horario} alCambiar={poner('horario')} />
        <Campo
          etiqueta="Ubicación"
          valor={datos.ubicacion}
          alCambiar={poner('ubicacion')}
        />
        <Campo
          etiqueta="Compensación pública (si se publica)"
          valor={datos.compensacionPublica}
          alCambiar={poner('compensacionPublica')}
        />

        <Selector
          etiqueta="Cómo se cierra"
          valor={datos.tipoCierre}
          alCambiar={poner('tipoCierre')}
          sinVacio
          cargando={catalogos.isPending}
          opciones={(catalogos.data?.tiposCierre ?? []).map((t) => ({
            valor: t.codigo,
            texto: t.nombre,
          }))}
        />
        {datos.tipoCierre === 'PLAZAS' && (
          <Campo
            etiqueta="Cuántas plazas"
            valor={datos.plazas}
            alCambiar={poner('plazas')}
            numerico
          />
        )}
        {datos.tipoCierre === 'FECHA' && (
          <Campo
            etiqueta="Fecha de cierre"
            valor={datos.cierraEn}
            alCambiar={poner('cierraEn')}
            tipo="date"
          />
        )}
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

// ---------- Piezas del formulario ----------

interface PropsCampo {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  ancho?: boolean
  numerico?: boolean
  tipo?: string
}

function Campo({ etiqueta, valor, alCambiar, ancho, numerico, tipo }: PropsCampo) {
  return (
    <label className={`${estilos.campo}${ancho ? ` ${estilos.anchoEntero}` : ''}`}>
      <span className={estilos.etiqueta}>{etiqueta}</span>
      <input
        className={estilos.entrada}
        type={tipo ?? 'text'}
        inputMode={numerico ? 'numeric' : undefined}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
      />
    </label>
  )
}

function Area({ etiqueta, valor, alCambiar, ancho }: PropsCampo) {
  return (
    <label className={`${estilos.campo}${ancho ? ` ${estilos.anchoEntero}` : ''}`}>
      <span className={estilos.etiqueta}>{etiqueta}</span>
      <textarea
        className={estilos.area}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
      />
    </label>
  )
}

/**
 * Un desplegable que no miente sobre lo que lleva dentro.
 *
 * ⚠️ Un `<select>` cuya unica linea es «Elige…» se abre y parece cerrarse solo:
 * no hay nada que elegir y no se dice por que. Mientras su lista viaja se apaga
 * y lo cuenta; si llega vacia, tambien. Las dos cosas son informacion, y un
 * control apagado ya se ve apagado.
 */
function Selector({
  etiqueta,
  valor,
  alCambiar,
  opciones,
  sinVacio,
  cargando,
  vacio,
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  opciones: { valor: string; texto: string }[]
  sinVacio?: boolean
  cargando?: boolean
  /** Que decir cuando la lista llego y no traia nada. */
  vacio?: string
}) {
  const sinNada = !cargando && opciones.length === 0
  return (
    <label className={estilos.campo}>
      <span className={estilos.etiqueta}>{etiqueta}</span>
      <select
        className={estilos.entrada}
        value={valor}
        disabled={cargando || sinNada}
        onChange={(e) => alCambiar(e.target.value)}
      >
        {cargando && <option value="">Cargando…</option>}
        {sinNada && <option value="">{vacio ?? 'No hay ninguna'}</option>}
        {!cargando && !sinNada && !sinVacio && <option value="">Elige…</option>}
        {!cargando &&
          opciones.map((o) => (
            <option value={o.valor} key={o.valor}>
              {o.texto}
            </option>
          ))}
      </select>
    </label>
  )
}
