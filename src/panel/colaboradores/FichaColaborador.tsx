/**
 * `/admin/colaboradores/:id`: la ficha del colaborador, en tres pestañas.
 *
 *   · **Perfil**: identidad, contacto, domicilio y formación. «Editar» los
 *     corrige sin historial —son erratas, no cambios de vida— y queda en la
 *     auditoría.
 *   · **Puesto y contrato**: la situación vigente hoy, el periodo actual, los
 *     cambios programados y las acciones: registrar un cambio o el cese; en una
 *     ficha cesada, reingresar o anular el cese.
 *   · **Historial**: la línea de tiempo, de lo más reciente a lo más antiguo.
 *
 * ⚠️ **El sueldo no se pinta porque no llega.** Sin `ver_sueldos`, el backend
 * no manda la clave: no hay nada que ocultar aquí.
 *
 * Una ficha de otra empresa o fuera de alcance responde 404, y se dice como
 * tal: «Este colaborador no existe».
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { rutas } from '@/rutas'
import { formatearFechaCorta } from '@/dominio/reloj'
import { Campo, Seleccion, AreaTexto } from '@/ui/campos/Campo'
import { Cargando, Fallo } from '@/ui/Mensajes'
import { Modal } from '@/ui/Modal'
import { ErrorApi } from '../api/cliente'
import {
  anularCambio,
  anularCese,
  editarPerfil,
  historialDelColaborador,
  opcionesDeColaborador,
  registrarCambio,
  registrarCese,
  reingresar,
  verColaborador,
} from '../api/colaboradores'
import type {
  EntradaHistorial,
  FichaColaborador,
  OpcionesColaborador,
  Situacion,
} from '../api/tiposPersonas'
import { CamposDeDomicilio, CamposDeIdentidad, CamposDeSituacion } from './Campos'
import { diasEntre, formatearDia, hoyEnLima, sumarDias } from './fechas'
import {
  enfocarElPrimerError,
  erroresDePersona,
  erroresDeSituacion,
  personaDesdePerfil,
  personaParaLaApi,
  situacionDesde,
  situacionParaLaApi,
  situacionVacia,
  type Errores,
  type FormPersona,
  type FormSituacion,
} from './formulario'
import { EtiquetaDeEstado, FinDeContrato } from './piezas'
import estilos from './Colaboradores.module.css'
import formularios from './Formularios.module.css'
import propios from './FichaColaborador.module.css'

type Pestana = 'perfil' | 'puesto' | 'historial'

const PESTANAS: Array<{ clave: Pestana; nombre: string }> = [
  { clave: 'perfil', nombre: 'Perfil' },
  { clave: 'puesto', nombre: 'Puesto y contrato' },
  { clave: 'historial', nombre: 'Historial' },
]

/** Qué modal está abierto. Uno a la vez: el `Modal` compartido no admite dos. */
type Abierto =
  | { que: 'cambio' }
  | { que: 'anularCambio'; situacion: Situacion }
  | { que: 'cese' }
  | { que: 'anularCese' }
  | { que: 'reingreso'; postulacionId: number | null }
  | null

export function FichaDelColaborador() {
  const { id: crudo } = useParams()
  const id = Number(crudo)
  const [parametros, setParametros] = useSearchParams()
  const [pestana, setPestana] = useState<Pestana>(parametros.get('reingreso') ? 'puesto' : 'perfil')
  const [abierto, setAbierto] = useState<Abierto>(null)

  const ficha = useQuery({
    queryKey: ['panel-colaborador', id],
    queryFn: () => verColaborador(id),
    enabled: Number.isFinite(id),
    retry: false,
  })
  const opciones = useQuery({ queryKey: ['panel-colaboradores-opciones'], queryFn: opcionesDeColaborador })

  // «Reingresar desde su ficha»: el alta de un documento cesado trae aquí.
  const pideReingreso = parametros.get('reingreso') === '1'
  useEffect(() => {
    if (!pideReingreso || !ficha.data) return
    if (ficha.data.estado === 'CESADO' && ficha.data.puedeEditar) {
      const postulacion = parametros.get('postulacion')
      setAbierto({ que: 'reingreso', postulacionId: postulacion && /^\d+$/.test(postulacion) ? Number(postulacion) : null })
    }
    setParametros({}, { replace: true })
  }, [pideReingreso, ficha.data, parametros, setParametros])

  if (ficha.isPending) {
    return (
      <div className={estilos.pagina}>
        <Cargando que="Cargando la ficha…" />
      </div>
    )
  }
  if (ficha.isError) {
    const noExiste = ficha.error instanceof ErrorApi && ficha.error.esAjeno
    return (
      <div className={estilos.pagina}>
        <p>
          <Link className={estilos.volver} to={rutas.adminColaboradores()}>
            ← Colaboradores
          </Link>
        </p>
        {noExiste ? (
          <>
            <h1>Este colaborador no existe.</h1>
            <p className={estilos.explica}>
              O no es de tu empresa, o tu rol no alcanza a verlo.
            </p>
          </>
        ) : (
          <Fallo error={ficha.error} reintentar={() => ficha.refetch()} />
        )}
      </div>
    )
  }

  const f = ficha.data
  const s = f.situacion

  return (
    <div className={estilos.pagina}>
      <p>
        <Link className={estilos.volver} to={rutas.adminColaboradores()}>
          ← Colaboradores
        </Link>
      </p>
      <header className={propios.cabecera}>
        <div className={propios.quien}>
          <h1 className={propios.nombre}>{f.nombreCompleto}</h1>
          <p className={propios.documento}>
            {f.perfil.tipoDocumentoNombre} {f.perfil.numeroDocumento}
          </p>
          <EtiquetaDeEstado estado={f.estado} fechaCese={f.periodo.fechaCese} />
        </div>
        <p className={propios.resumen}>
          {[s?.cargo, s?.area].filter(Boolean).join(' · ') || 'Sin situación laboral'}
          {f.vacante && (
            <>
              {' · '}
              {f.vacanteId != null ? (
                <>
                  Contratado por la vacante{' '}
                  <Link to={rutas.adminVacante(f.vacanteId)}>«{f.vacante}»</Link>
                </>
              ) : (
                <>Contratado por la vacante «{f.vacante}»</>
              )}
            </>
          )}
        </p>
      </header>

      <Pestanas actual={pestana} alCambiar={setPestana} />

      <div
        className={propios.panel}
        role="tabpanel"
        id={`panel-${pestana}`}
        aria-labelledby={`pestana-${pestana}`}
      >
        {pestana === 'perfil' && <PestanaPerfil ficha={f} opciones={opciones.data} />}
        {pestana === 'puesto' && <PestanaPuesto ficha={f} alAbrir={setAbierto} />}
        {pestana === 'historial' && <PestanaHistorial id={f.id} />}
      </div>

      {opciones.data && (
        <>
          <ModalCambio
            abierto={abierto?.que === 'cambio'}
            ficha={f}
            opciones={opciones.data}
            alCerrar={() => setAbierto(null)}
          />
          <ModalCese abierto={abierto?.que === 'cese'} ficha={f} opciones={opciones.data} alCerrar={() => setAbierto(null)} />
          <ModalReingreso
            abierto={abierto?.que === 'reingreso'}
            postulacionId={abierto?.que === 'reingreso' ? abierto.postulacionId : null}
            ficha={f}
            opciones={opciones.data}
            alCerrar={() => setAbierto(null)}
          />
        </>
      )}
      <ModalConMotivo
        abierto={abierto?.que === 'anularCambio'}
        titulo="Anular el cambio programado"
        explicacion={
          abierto?.que === 'anularCambio'
            ? `El cambio del ${formatearDia(abierto.situacion.vigenteDesde)} (${abierto.situacion.tipoMotivoNombre}) no llegará a regir. Queda tachado en el historial y en la auditoría.`
            : ''
        }
        confirmar="Anular el cambio"
        alConfirmar={(motivo) =>
          abierto?.que === 'anularCambio' ? anularCambio(f.id, abierto.situacion.id, motivo) : Promise.resolve()
        }
        id={f.id}
        alCerrar={() => setAbierto(null)}
      />
      <ModalConMotivo
        abierto={abierto?.que === 'anularCese'}
        titulo="Anular el cese"
        explicacion="El periodo vuelve a quedar abierto, como si el cese no se hubiera registrado. Queda en el historial y en la auditoría."
        confirmar="Anular el cese"
        alConfirmar={(motivo) => anularCese(f.id, motivo)}
        id={f.id}
        alCerrar={() => setAbierto(null)}
      />
    </div>
  )
}

// ---------- Las pestañas ----------

function Pestanas({ actual, alCambiar }: { actual: Pestana; alCambiar: (p: Pestana) => void }) {
  const lista = useRef<HTMLDivElement>(null)

  function alPulsar(e: KeyboardEvent<HTMLButtonElement>) {
    const i = PESTANAS.findIndex((p) => p.clave === actual)
    let siguiente = -1
    if (e.key === 'ArrowRight') siguiente = (i + 1) % PESTANAS.length
    else if (e.key === 'ArrowLeft') siguiente = (i - 1 + PESTANAS.length) % PESTANAS.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = PESTANAS.length - 1
    if (siguiente < 0) return
    e.preventDefault()
    const destino = PESTANAS[siguiente]!
    alCambiar(destino.clave)
    lista.current?.querySelector<HTMLButtonElement>(`#pestana-${destino.clave}`)?.focus()
  }

  return (
    <div className={propios.pestanas} role="tablist" aria-label="Secciones de la ficha" ref={lista}>
      {PESTANAS.map((p) => (
        <button
          key={p.clave}
          id={`pestana-${p.clave}`}
          className={p.clave === actual ? `${propios.pestana} ${propios.pestanaActiva}` : propios.pestana}
          type="button"
          role="tab"
          aria-selected={p.clave === actual}
          aria-controls={`panel-${p.clave}`}
          tabIndex={p.clave === actual ? 0 : -1}
          onClick={() => alCambiar(p.clave)}
          onKeyDown={alPulsar}
        >
          {p.nombre}
        </button>
      ))}
    </div>
  )
}

// ---------- Perfil ----------

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className={propios.dato}>
      <dt>{etiqueta}</dt>
      <dd>{children ?? '—'}</dd>
    </div>
  )
}

function PestanaPerfil({ ficha, opciones }: { ficha: FichaColaborador; opciones?: OpcionesColaborador }) {
  const [editando, setEditando] = useState(false)
  const p = ficha.perfil

  if (editando && opciones) {
    return <EditarPerfil ficha={ficha} opciones={opciones} alTerminar={() => setEditando(false)} />
  }

  return (
    <div className={propios.bloques}>
      {ficha.puedeEditar && (
        <div className={propios.accionesPestana}>
          <button className={estilos.secundario} type="button" onClick={() => setEditando(true)} disabled={!opciones}>
            Editar
          </button>
        </div>
      )}
      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>Identidad</h2>
        <dl className={propios.datos}>
          <Dato etiqueta="Documento">
            {p.tipoDocumentoNombre} {p.numeroDocumento}
          </Dato>
          <Dato etiqueta="Nombres">{p.nombres}</Dato>
          <Dato etiqueta="Apellido paterno">{p.apellidoPaterno}</Dato>
          <Dato etiqueta="Apellido materno">{p.apellidoMaterno}</Dato>
          <Dato etiqueta="Fecha de nacimiento">{formatearDia(p.fechaNacimiento)}</Dato>
          <Dato etiqueta="Sexo">{p.sexoNombre}</Dato>
          <Dato etiqueta="Estado civil">{p.estadoCivilNombre}</Dato>
          <Dato etiqueta="Nacionalidad">{p.nacionalidad}</Dato>
        </dl>
      </section>
      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>Contacto</h2>
        <dl className={propios.datos}>
          <Dato etiqueta="Celular">{p.celular}</Dato>
          <Dato etiqueta="Correo personal">{p.correoPersonal}</Dato>
          <Dato etiqueta="Correo corporativo">{p.correoCorporativo}</Dato>
        </dl>
      </section>
      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>Domicilio</h2>
        <dl className={propios.datos}>
          <Dato etiqueta="Dirección">{p.direccion}</Dato>
          <Dato etiqueta="Provincia">{p.provinciaNombre}</Dato>
        </dl>
      </section>
      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>Formación</h2>
        <dl className={propios.datos}>
          <Dato etiqueta="Nivel educativo">{p.nivelEducativoNombre}</Dato>
        </dl>
      </section>
    </div>
  )
}

function EditarPerfil({
  ficha,
  opciones,
  alTerminar,
}: {
  ficha: FichaColaborador
  opciones: OpcionesColaborador
  alTerminar: () => void
}) {
  const cache = useQueryClient()
  const raiz = useRef<HTMLFormElement>(null)
  const [persona, setPersona] = useState<FormPersona>(() => personaDesdePerfil(ficha.perfil))
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<ReactNode>(null)

  const guardado = useMutation({
    mutationFn: () => editarPerfil(ficha.id, personaParaLaApi(persona)),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['panel-colaborador', ficha.id] }),
        cache.invalidateQueries({ queryKey: ['panel-colaboradores'] }),
      ])
      alTerminar()
    },
    onError: (causa) => {
      const cuerpo = causa instanceof ErrorApi ? (causa.cuerpo as { colaboradorId?: number } | null) : null
      if (causa instanceof ErrorApi && causa.estado === 409 && cuerpo?.colaboradorId != null) {
        setFallo(
          <>
            Ese documento ya es de otra ficha. <Link to={rutas.adminColaborador(cuerpo.colaboradorId)}>Ver esa ficha</Link>
          </>,
        )
        return
      }
      setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar.')
    },
  })

  return (
    <form
      ref={raiz}
      className={formularios.formulario}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (guardado.isPending) return
        const nuevos = erroresDePersona(persona)
        setErrores(nuevos)
        setFallo(null)
        if (Object.keys(nuevos).length > 0) {
          enfocarElPrimerError(raiz.current)
          return
        }
        guardado.mutate()
      }}
    >
      <p className={estilos.explica}>
        Corregir estos datos no deja historial: son erratas, no cambios. Cada edición queda en la
        auditoría con el valor anterior y el nuevo.
      </p>
      <section className={formularios.bloque}>
        <h2 className={formularios.tituloBloque}>Identidad y contacto</h2>
        <CamposDeIdentidad
          valor={persona}
          alCambiar={(parcial) => setPersona((p) => ({ ...p, ...parcial }))}
          errores={errores}
          opciones={opciones}
        />
      </section>
      <section className={formularios.bloque}>
        <h2 className={formularios.tituloBloque}>Domicilio y formación</h2>
        <CamposDeDomicilio
          valor={persona}
          alCambiar={(parcial) => setPersona((p) => ({ ...p, ...parcial }))}
          opciones={opciones}
        />
      </section>
      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
      <div className={formularios.botones}>
        <button className={formularios.enviar} type="submit" disabled={guardado.isPending}>
          {guardado.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button className={formularios.chico} type="button" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ---------- Puesto y contrato ----------

function PestanaPuesto({ ficha, alAbrir }: { ficha: FichaColaborador; alAbrir: (a: Abierto) => void }) {
  const s = ficha.situacion
  const cesado = ficha.estado === 'CESADO'
  const conCese = ficha.periodo.fechaCese != null

  return (
    <div className={propios.bloques}>
      {ficha.puedeEditar && (
        <div className={propios.accionesPestana}>
          {cesado ? (
            <>
              <button className={estilos.crear} type="button" onClick={() => alAbrir({ que: 'reingreso', postulacionId: null })}>
                Reingresar
              </button>
              {ficha.puedeAnularCese && (
                <button className={estilos.secundario} type="button" onClick={() => alAbrir({ que: 'anularCese' })}>
                  Anular el cese
                </button>
              )}
            </>
          ) : (
            <>
              <button className={estilos.crear} type="button" onClick={() => alAbrir({ que: 'cambio' })} disabled={!ficha.base}>
                Registrar un cambio
              </button>
              {conCese ? (
                ficha.puedeAnularCese && (
                  <button className={estilos.secundario} type="button" onClick={() => alAbrir({ que: 'anularCese' })}>
                    Anular el cese
                  </button>
                )
              ) : (
                <button className={estilos.secundario} type="button" onClick={() => alAbrir({ que: 'cese' })}>
                  Registrar el cese
                </button>
              )}
            </>
          )}
        </div>
      )}

      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>{cesado ? 'La última situación' : 'La situación vigente hoy'}</h2>
        {s ? (
          <dl className={propios.datos}>
            <Dato etiqueta="Sede">
              {s.sede}
              {!s.sedeActiva && ' (inactivo)'}
            </Dato>
            <Dato etiqueta="Área">
              {s.area}
              {!s.areaActiva && ' (inactivo)'}
            </Dato>
            <Dato etiqueta="Cargo">
              {s.cargo}
              {!s.cargoActivo && ' (inactivo)'}
            </Dato>
            <Dato etiqueta="Jefe directo">
              {s.jefe ? (
                <>
                  {s.jefeId != null ? <Link to={rutas.adminColaborador(s.jefeId)}>{s.jefe}</Link> : s.jefe}
                  {s.jefeCesado && ' (cesado)'}
                </>
              ) : null}
            </Dato>
            <Dato etiqueta="Tipo de contrato">{s.tipoContratoNombre}</Dato>
            <Dato etiqueta="Fin del contrato">
              <FinDeContrato fin={s.finContrato} estado={ficha.estado} />
            </Dato>
            <Dato etiqueta="Fin del periodo de prueba">{s.finPeriodoPrueba ? formatearDia(s.finPeriodoPrueba) : null}</Dato>
            <Dato etiqueta="Régimen laboral">{s.regimenNombre}</Dato>
            {ficha.puedeVerSueldos && (
              <Dato etiqueta="Sueldo base">{s.sueldoBase != null ? formatearSueldo(s.sueldoBase, s.moneda) : null}</Dato>
            )}
            <Dato etiqueta="Rige desde">{formatearDia(s.vigenteDesde)}</Dato>
          </dl>
        ) : (
          <p className={estilos.explica}>Esta ficha todavía no tiene situación laboral.</p>
        )}
      </section>

      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>El periodo actual</h2>
        <dl className={propios.datos}>
          <Dato etiqueta="Ingreso">{formatearDia(ficha.periodo.fechaIngreso)}</Dato>
          {ficha.periodo.fechaCese && (
            <>
              <Dato etiqueta="Cese">{formatearDia(ficha.periodo.fechaCese)}</Dato>
              <Dato etiqueta="Motivo del cese">{ficha.periodo.motivoCeseNombre}</Dato>
              {ficha.periodo.observacionCese && <Dato etiqueta="Observación">{ficha.periodo.observacionCese}</Dato>}
            </>
          )}
        </dl>
      </section>

      <section className={propios.bloque}>
        <h2 className={propios.tituloBloque}>Cambios programados</h2>
        {ficha.programados.length === 0 ? (
          <p className={estilos.explica}>No hay cambios con fecha futura.</p>
        ) : (
          <ul className={propios.programados} role="list">
            {ficha.programados.map((p) => (
              <li className={propios.programado} key={p.id}>
                <span>
                  Desde el <b>{formatearDia(p.vigenteDesde)}</b> · {p.tipoMotivoNombre}
                  {p.detalleMotivo ? ` · ${p.detalleMotivo}` : ''}
                </span>
                {ficha.puedeEditar && (
                  <button className={estilos.chico} type="button" onClick={() => alAbrir({ que: 'anularCambio', situacion: p })}>
                    Anular
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function formatearSueldo(monto: number, moneda?: string): string {
  const cifra = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto)
  return `${moneda === 'USD' ? 'US$' : 'S/'} ${cifra}`
}

// ---------- Historial ----------

function PestanaHistorial({ id }: { id: number }) {
  const historial = useQuery({ queryKey: ['panel-colaborador-historial', id], queryFn: () => historialDelColaborador(id) })

  if (historial.isPending) return <Cargando que="Cargando el historial…" />
  if (historial.isError) return <Fallo error={historial.error} reintentar={() => historial.refetch()} />
  if (historial.data.length === 0) return <p className={estilos.explica}>Todavía no hay nada en el historial.</p>

  return (
    <ol className={propios.historial}>
      {historial.data.map((e, i) => (
        <LineaDelHistorial entrada={e} key={`${e.tipo}-${e.fecha}-${e.registradoEn ?? i}-${i}`} />
      ))}
    </ol>
  )
}

function LineaDelHistorial({ entrada: e }: { entrada: EntradaHistorial }) {
  return (
    <li className={e.anulado ? `${propios.linea} ${propios.anulada}` : propios.linea}>
      <div className={propios.cuando}>
        <span className={propios.fechaLinea}>{formatearDia(e.fecha)}</span>
        {e.programado && <span className={propios.programadoMarca}>Programado</span>}
        {e.anulado && <span className={propios.anuladoMarca}>Anulado</span>}
      </div>
      <div className={propios.que}>
        <p className={propios.tituloLinea}>{e.titulo}</p>
        {e.cambios.length > 0 && (
          <ul className={propios.cambios} role="list">
            {e.cambios.map((c) => (
              <li key={c.campo}>
                <b>{c.campo}:</b> {c.antes != null ? `${c.antes} → ` : ''}
                {c.despues ?? '—'}
              </li>
            ))}
          </ul>
        )}
        {e.detalle && <p className={propios.detalle}>{e.detalle}</p>}
        <p className={propios.autor}>
          {e.registradoPor ? `Registrado por ${e.registradoPor}` : 'Registrado'}
          {e.registradoEn ? ` el ${formatearFechaCorta(e.registradoEn)}` : ''}
        </p>
        {e.anulado && (
          <p className={propios.autor}>
            Anulado{e.anuladoPor ? ` por ${e.anuladoPor}` : ''}
            {e.anuladoEn ? ` el ${formatearFechaCorta(e.anuladoEn)}` : ''}
            {e.motivoAnulacion ? `: ${e.motivoAnulacion}` : ''}
          </p>
        )}
      </div>
    </li>
  )
}

// ---------- Los modales ----------

function useRefrescarLaFicha(id: number) {
  const cache = useQueryClient()
  return async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['panel-colaborador', id] }),
      cache.invalidateQueries({ queryKey: ['panel-colaborador-historial', id] }),
      cache.invalidateQueries({ queryKey: ['panel-colaboradores'] }),
    ])
  }
}

function mensajeDe(causa: unknown, porDefecto: string): string {
  return causa instanceof Error ? causa.message : porDefecto
}

function Pie({
  alCerrar,
  enviando,
  confirmar,
  deshabilitado,
  formulario,
}: {
  alCerrar: () => void
  enviando: boolean
  confirmar: string
  deshabilitado?: boolean
  formulario: string
}) {
  return (
    <>
      <button className={formularios.chico} type="button" onClick={alCerrar}>
        Cancelar
      </button>
      <button className={formularios.enviar} type="submit" form={formulario} disabled={enviando || deshabilitado}>
        {enviando ? 'Guardando…' : confirmar}
      </button>
    </>
  )
}

function ModalCambio({
  abierto,
  ficha,
  opciones,
  alCerrar,
}: {
  abierto: boolean
  ficha: FichaColaborador
  opciones: OpcionesColaborador
  alCerrar: () => void
}) {
  const refrescar = useRefrescarLaFicha(ficha.id)
  const raiz = useRef<HTMLFormElement>(null)
  const hoy = hoyEnLima()
  const base = ficha.base
  const [desde, setDesde] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [situacion, setSituacion] = useState<FormSituacion>(() => (base ? situacionDesde(base) : situacionVacia()))
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)

  // Cada vez que se abre, parte de la situación de ahora.
  useEffect(() => {
    if (!abierto) return
    setDesde(hoyEnLima())
    setMotivo('')
    setDetalle('')
    setSituacion(base ? situacionDesde(base) : situacionVacia())
    setErrores({})
    setFallo(null)
  }, [abierto, base])

  const cambio = useMutation({
    mutationFn: () =>
      registrarCambio(ficha.id, {
        vigenteDesde: desde,
        tipoMotivo: motivo,
        detalle: detalle.trim() === '' ? null : detalle.trim(),
        situacion: situacionParaLaApi(situacion, opciones.puedeVerSueldos),
      }),
    onSuccess: async () => {
      await refrescar()
      alCerrar()
    },
    onError: (causa) => setFallo(mensajeDe(causa, 'No se pudo registrar el cambio.')),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (cambio.isPending || !base) return
    const nuevos: Errores = erroresDeSituacion(situacion, ficha.periodo.fechaIngreso, opciones, opciones.puedeVerSueldos)
    if (desde === '') nuevos.desde = 'Indica desde cuándo rige.'
    else if (diasEntre(ficha.periodo.fechaIngreso, desde) < 0) {
      nuevos.desde = `No puede regir antes de la fecha de ingreso (${formatearDia(ficha.periodo.fechaIngreso)}).`
    } else if (diasEntre(base.vigenteDesde, desde) < 0) {
      nuevos.desde = `No puede regir antes del último cambio, que rige desde el ${formatearDia(base.vigenteDesde)}.`
    }
    if (motivo === '') nuevos.motivo = 'Elige el tipo de motivo.'
    if (motivo === 'OTRO' && detalle.trim() === '') nuevos.detalle = 'Con «otro», escribe el detalle.'
    setErrores(nuevos)
    setFallo(null)
    if (Object.keys(nuevos).length > 0) {
      enfocarElPrimerError(raiz.current)
      return
    }
    if (!cambiaAlgo(situacion, base, opciones.puedeVerSueldos)) {
      setFallo('El cambio tiene que cambiar al menos un dato.')
      return
    }
    cambio.mutate()
  }

  const futuro = desde !== '' && diasEntre(hoy, desde) > 0

  return (
    <Modal
      abierto={abierto}
      titulo="Registrar un cambio"
      onCerrar={alCerrar}
      pantallaCompleta
      pie={<Pie alCerrar={alCerrar} enviando={cambio.isPending} confirmar="Guardar el cambio" formulario="form-cambio" />}
    >
      <form id="form-cambio" ref={raiz} className={formularios.formulario} onSubmit={enviar} noValidate>
        <p className={estilos.explica}>
          La situación anterior termina el día antes y la nueva rige desde la fecha que elijas. Un
          cambio ya vigente no se borra: se corrige con otro de tipo «corrección».
        </p>
        <div className={formularios.rejilla}>
          <Campo
            etiqueta="Rige desde"
            obligatorio
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            error={errores.desde}
            ayuda={futuro ? 'Es una fecha futura: el cambio queda programado y rige ese día.' : undefined}
          />
          <Seleccion
            etiqueta="Tipo de motivo"
            obligatorio
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            error={errores.motivo}
          >
            <option value="">Elige…</option>
            {opciones.motivosCambio.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.nombre}
              </option>
            ))}
          </Seleccion>
          <div className={formularios.anchoDoble}>
            <Campo
              etiqueta={motivo === 'OTRO' ? 'Detalle' : 'Detalle · opcional'}
              obligatorio={motivo === 'OTRO'}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              error={errores.detalle}
            />
          </div>
        </div>
        <CamposDeSituacion
          valor={situacion}
          alCambiar={(parcial) => setSituacion((s) => ({ ...s, ...parcial }))}
          errores={errores}
          opciones={opciones}
          actual={base}
          excluirJefe={ficha.id}
        />
        {fallo && (
          <p className={estilos.avisoMalo} role="alert">
            {fallo}
          </p>
        )}
      </form>
    </Modal>
  )
}

function cambiaAlgo(f: FormSituacion, base: Situacion, conSueldo: boolean): boolean {
  const antes = situacionDesde(base)
  const campos: Array<keyof FormSituacion> = [
    'sedeId',
    'areaId',
    'cargoId',
    'tipoContrato',
    'finContrato',
    'finPeriodoPrueba',
    'regimenLaboral',
  ]
  if (campos.some((c) => f[c] !== antes[c]) || f.jefeId !== antes.jefeId) return true
  if (!conSueldo) return false
  const nuevo = f.sueldoBase.trim() === '' ? null : Number(f.sueldoBase.replace(',', '.'))
  const viejo = antes.sueldoBase === '' ? null : Number(antes.sueldoBase)
  return nuevo !== viejo || (nuevo != null && f.moneda !== antes.moneda)
}

function ModalCese({
  abierto,
  ficha,
  opciones,
  alCerrar,
}: {
  abierto: boolean
  ficha: FichaColaborador
  opciones: OpcionesColaborador
  alCerrar: () => void
}) {
  const refrescar = useRefrescarLaFicha(ficha.id)
  const [fecha, setFecha] = useState(hoyEnLima())
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setFecha(hoyEnLima())
    setMotivo('')
    setObservacion('')
    setErrores({})
    setFallo(null)
  }, [abierto])

  const cese = useMutation({
    mutationFn: () =>
      registrarCese(ficha.id, {
        fechaCese: fecha,
        motivoCodigo: motivo,
        observacion: observacion.trim() === '' ? null : observacion.trim(),
      }),
    onSuccess: async () => {
      await refrescar()
      alCerrar()
    },
    onError: (causa) => setFallo(mensajeDe(causa, 'No se pudo registrar el cese.')),
  })

  const seAnulan = fecha === '' ? [] : ficha.programados.filter((p) => diasEntre(fecha, p.vigenteDesde) > 0)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (cese.isPending) return
    const nuevos: Errores = {}
    if (fecha === '') nuevos.fecha = 'Indica el último día trabajado.'
    else if (diasEntre(ficha.periodo.fechaIngreso, fecha) < 0) {
      nuevos.fecha = `No puede ser anterior a la fecha de ingreso (${formatearDia(ficha.periodo.fechaIngreso)}).`
    }
    if (motivo === '') nuevos.motivo = 'Elige el motivo.'
    setErrores(nuevos)
    setFallo(null)
    if (Object.keys(nuevos).length === 0) cese.mutate()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={`Registrar el cese de ${ficha.perfil.nombres}`}
      onCerrar={alCerrar}
      pantallaCompleta
      pie={<Pie alCerrar={alCerrar} enviando={cese.isPending} confirmar="Registrar el cese" formulario="form-cese" />}
    >
      <form id="form-cese" className={formularios.formulario} onSubmit={enviar} noValidate>
        <div className={formularios.rejilla}>
          <Campo
            etiqueta="Fecha de cese (último día trabajado)"
            obligatorio
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            error={errores.fecha}
          />
          <Seleccion etiqueta="Motivo" obligatorio value={motivo} onChange={(e) => setMotivo(e.target.value)} error={errores.motivo}>
            <option value="">Elige…</option>
            {opciones.motivosCese.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.nombre}
              </option>
            ))}
          </Seleccion>
          <div className={formularios.anchoEntero}>
            <AreaTexto
              etiqueta="Observación · opcional"
              value={observacion}
              rows={2}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>
        </div>

        <div className={propios.consecuencias}>
          <h3 className={propios.tituloConsecuencias}>Antes de confirmar</h3>
          <ul role="list">
            <li>
              {fecha
                ? `Pasa a Cesado desde el ${formatearDia(sumarDias(fecha, 1))}; hasta ese día sigue Activo.`
                : 'Pasa a Cesado desde el día siguiente a la fecha de cese.'}{' '}
              Sigue en el sistema y su ficha no se borra nunca.
            </li>
            {ficha.reportes.length > 0 && (
              <li>
                {ficha.reportes.length === 1
                  ? '1 persona la tiene como jefe: '
                  : `${ficha.reportes.length} personas la tienen como jefe: `}
                <b>{ficha.reportes.map((r) => r.nombre).join('; ')}</b>. Conviene cambiarles el jefe;
                mientras tanto lo conservan.
              </li>
            )}
            {seAnulan.length > 0 && (
              <li>
                Se anularán estos cambios programados después del cese:{' '}
                {seAnulan.map((p) => `${formatearDia(p.vigenteDesde)} (${p.tipoMotivoNombre})`).join(', ')}.
              </li>
            )}
          </ul>
        </div>
        {fallo && (
          <p className={estilos.avisoMalo} role="alert">
            {fallo}
          </p>
        )}
      </form>
    </Modal>
  )
}

function ModalReingreso({
  abierto,
  postulacionId,
  ficha,
  opciones,
  alCerrar,
}: {
  abierto: boolean
  postulacionId: number | null
  ficha: FichaColaborador
  opciones: OpcionesColaborador
  alCerrar: () => void
}) {
  const refrescar = useRefrescarLaFicha(ficha.id)
  const cache = useQueryClient()
  const raiz = useRef<HTMLFormElement>(null)
  const [ingreso, setIngreso] = useState('')
  const [situacion, setSituacion] = useState<FormSituacion>(() =>
    ficha.base ? situacionDesde(ficha.base) : situacionVacia(),
  )
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setIngreso('')
    setSituacion(ficha.base ? situacionDesde(ficha.base) : situacionVacia())
    setErrores({})
    setFallo(null)
  }, [abierto, ficha.base])

  const reingreso = useMutation({
    mutationFn: () =>
      reingresar(ficha.id, {
        fechaIngreso: ingreso,
        situacion: situacionParaLaApi(situacion, opciones.puedeVerSueldos),
        postulacionId,
      }),
    onSuccess: async () => {
      await Promise.all([refrescar(), cache.invalidateQueries({ queryKey: ['panel-colaboradores-pendientes'] })])
      alCerrar()
    },
    onError: (causa) => setFallo(mensajeDe(causa, 'No se pudo reingresar.')),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (reingreso.isPending) return
    const nuevos: Errores = erroresDeSituacion(situacion, ingreso, opciones, opciones.puedeVerSueldos)
    const ultimoCese = ficha.periodo.fechaCese
    if (ingreso === '') nuevos.ingreso = 'Indica la fecha de reingreso.'
    else if (ultimoCese && diasEntre(ultimoCese, ingreso) <= 0) {
      nuevos.ingreso = `Tiene que ser posterior al último cese (${formatearDia(ultimoCese)}).`
    }
    setErrores(nuevos)
    setFallo(null)
    if (Object.keys(nuevos).length > 0) {
      enfocarElPrimerError(raiz.current)
      return
    }
    reingreso.mutate()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={`Reingresar a ${ficha.perfil.nombres}`}
      onCerrar={alCerrar}
      pantallaCompleta
      pie={<Pie alCerrar={alCerrar} enviando={reingreso.isPending} confirmar="Reingresar" formulario="form-reingreso" />}
    >
      <form id="form-reingreso" ref={raiz} className={formularios.formulario} onSubmit={enviar} noValidate>
        <p className={estilos.explica}>
          Abre un periodo nuevo con el motivo «Reingreso»; los anteriores se quedan en el historial.
          Trae la última situación: cámbiala si ahora es otra.
          {postulacionId != null && ' El periodo nuevo queda enlazado a su contratación por selección.'}
        </p>
        <div className={formularios.rejilla}>
          <Campo
            etiqueta="Fecha de reingreso"
            obligatorio
            type="date"
            value={ingreso}
            onChange={(e) => setIngreso(e.target.value)}
            error={errores.ingreso}
          />
        </div>
        <CamposDeSituacion
          valor={situacion}
          alCambiar={(parcial) => setSituacion((s) => ({ ...s, ...parcial }))}
          errores={errores}
          opciones={opciones}
          excluirJefe={ficha.id}
        />
        {fallo && (
          <p className={estilos.avisoMalo} role="alert">
            {fallo}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Anular un cambio programado o un cese: un motivo y confirmar. */
function ModalConMotivo({
  abierto,
  titulo,
  explicacion,
  confirmar,
  alConfirmar,
  id,
  alCerrar,
}: {
  abierto: boolean
  titulo: string
  explicacion: string
  confirmar: string
  alConfirmar: (motivo: string) => Promise<void>
  id: number
  alCerrar: () => void
}) {
  const refrescar = useRefrescarLaFicha(id)
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setMotivo('')
    setFallo(null)
  }, [abierto])

  const accion = useMutation({
    mutationFn: () => alConfirmar(motivo.trim()),
    onSuccess: async () => {
      await refrescar()
      alCerrar()
    },
    onError: (causa) => setFallo(mensajeDe(causa, 'No se pudo guardar.')),
  })

  const formulario = `form-motivo-${confirmar.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={alCerrar}
      pie={
        <Pie
          alCerrar={alCerrar}
          enviando={accion.isPending}
          confirmar={confirmar}
          deshabilitado={motivo.trim() === ''}
          formulario={formulario}
        />
      }
    >
      <form
        id={formulario}
        className={formularios.formulario}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!accion.isPending && motivo.trim() !== '') accion.mutate()
        }}
      >
        <p className={estilos.explica}>{explicacion}</p>
        <Campo etiqueta="Motivo" obligatorio value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {fallo && (
          <p className={estilos.avisoMalo} role="alert">
            {fallo}
          </p>
        )}
      </form>
    </Modal>
  )
}
