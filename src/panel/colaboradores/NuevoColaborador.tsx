/**
 * `/admin/colaboradores/nuevo`: el alta manual, en tres bloques.
 *
 * Con `?postulacion=ID` es el alta de alguien contratado por selección: sale
 * precargada con lo que ya se sabe —nombre, apellidos enteros en «apellido
 * paterno» para que RR.HH. los separe, correo, celular del CV, cargo y área— y
 * la ficha queda enlazada a esa contratación. La fecha de ingreso nunca se
 * precarga: contratar y empezar a trabajar no suelen ser el mismo día.
 *
 * ⚠️ **Si la sesión caduca a mitad del formulario, no se sale de él.** El alta
 * retiene la sesión (`useRetenerLaSesion`): el 401 al guardar se dice ahí mismo,
 * con un enlace para entrar en otra pestaña, y al volver basta con guardar. Por
 * si se sale igual —se cierra la pestaña, se recarga—, lo escrito también se
 * guarda en `sessionStorage` mientras se escribe, y al volver el alta lo
 * recupera y lo dice.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { rutas } from '@/rutas'
import { Campo } from '@/ui/campos/Campo'
import { Cargando, Fallo } from '@/ui/Mensajes'
import { ErrorApi } from '../api/cliente'
import { darDeAlta, opcionesDeColaborador, precargaDelContratado } from '../api/colaboradores'
import type { OpcionesColaborador, Precarga } from '../api/tiposPersonas'
import { CamposDeDomicilio, CamposDeIdentidad, CamposDeSituacion } from './Campos'
import {
  enfocarElPrimerError,
  erroresDePersona,
  erroresDeSituacion,
  personaDesdePrecarga,
  personaParaLaApi,
  personaVacia,
  situacionParaLaApi,
  situacionVacia,
  type Errores,
  type FormPersona,
  type FormSituacion,
} from './formulario'
import estilos from './Colaboradores.module.css'
import formularios from './Formularios.module.css'
import { useRetenerLaSesion } from '../Sesion'
import { AvisoDeFallo, explicarFallo, useUnaVez } from '../ui/Envio'

interface Borrador {
  persona: FormPersona
  ingreso: string
  situacion: FormSituacion
}

const claveDelBorrador = (postulacionId: number | null) =>
  `renaser_panel_alta_colaborador:${postulacionId ?? 'nuevo'}`

function leerBorrador(clave: string): Borrador | null {
  try {
    const texto = sessionStorage.getItem(clave)
    return texto ? (JSON.parse(texto) as Borrador) : null
  } catch {
    return null
  }
}

function guardarBorrador(clave: string, borrador: Borrador | null) {
  try {
    if (borrador) sessionStorage.setItem(clave, JSON.stringify(borrador))
    else sessionStorage.removeItem(clave)
  } catch {
    // Sin almacenamiento, el formulario funciona igual; solo no se recupera.
  }
}

/** Lo que el backend contesta cuando el documento ya tiene ficha. */
interface Choque {
  colaboradorId: number
  cesado: boolean
  mensaje: string
}

export function NuevoColaborador() {
  const [parametros] = useSearchParams()
  const crudo = parametros.get('postulacion')
  const postulacionId = crudo && /^\d+$/.test(crudo) ? Number(crudo) : null

  const opciones = useQuery({ queryKey: ['panel-colaboradores-opciones'], queryFn: opcionesDeColaborador })
  const precarga = useQuery({
    queryKey: ['panel-colaboradores-precarga', postulacionId],
    queryFn: () => precargaDelContratado(postulacionId!),
    enabled: postulacionId !== null,
    staleTime: 0,
  })

  if (opciones.isPending || (postulacionId !== null && precarga.isPending)) {
    return (
      <div className={estilos.pagina}>
        <Cargando que="Preparando el alta…" />
      </div>
    )
  }
  // Con las opciones ya traídas, un fallo al refrescarlas (al volver a la
  // pestaña con la sesión caducada) no desmonta el formulario.
  if (!opciones.data) {
    return (
      <div className={estilos.pagina}>
        <Fallo error={opciones.error} reintentar={() => opciones.refetch()} />
      </div>
    )
  }
  if (!opciones.data.puedeEditar) {
    return (
      <div className={estilos.pagina}>
        <h1>Nuevo colaborador.</h1>
        <p className={estilos.avisoMalo} role="alert">
          Tu rol no puede dar de alta colaboradores.
        </p>
      </div>
    )
  }
  if (postulacionId !== null && precarga.isError && !precarga.data) {
    return (
      <div className={estilos.pagina}>
        <h1>Nuevo colaborador.</h1>
        <Fallo error={precarga.error} reintentar={() => precarga.refetch()} />
      </div>
    )
  }

  return (
    <Formulario
      // Remontar al cambiar de contratación: el borrador y la precarga son de ella.
      key={postulacionId ?? 'nuevo'}
      postulacionId={postulacionId}
      precarga={precarga.data ?? null}
      opciones={opciones.data}
    />
  )
}

function Formulario({
  postulacionId,
  precarga,
  opciones,
}: {
  postulacionId: number | null
  precarga: Precarga | null
  opciones: OpcionesColaborador
}) {
  const navegar = useNavigate()
  const cache = useQueryClient()
  const raiz = useRef<HTMLFormElement>(null)
  const clave = claveDelBorrador(postulacionId)

  const [recuperado] = useState(() => leerBorrador(clave))
  const [persona, setPersona] = useState<FormPersona>(
    () => recuperado?.persona ?? (precarga ? personaDesdePrecarga(precarga) : personaVacia()),
  )
  const [ingreso, setIngreso] = useState(recuperado?.ingreso ?? '')
  const [situacion, setSituacion] = useState<FormSituacion>(() => {
    if (recuperado) return recuperado.situacion
    const vacia = situacionVacia()
    if (!precarga) return vacia
    return {
      ...vacia,
      cargoId: precarga.cargoId == null ? '' : String(precarga.cargoId),
      areaId: precarga.areaId == null ? '' : String(precarga.areaId),
      sueldoBase: precarga.sueldoBase == null ? '' : String(precarga.sueldoBase),
      moneda: precarga.moneda ?? 'PEN',
    }
  })
  const [errores, setErrores] = useState<Errores>({})
  // Solo se guarda lo que alguien escribió: abrir el alta y salir no deja borrador.
  const [tocado, setTocado] = useState(false)
  const [choque, setChoque] = useState<Choque | null>(null)
  const [fallo, setFallo] = useState<ReactNode>(null)
  useRetenerLaSesion(true)
  const unaVez = useUnaVez()

  useEffect(() => {
    if (tocado) guardarBorrador(clave, { persona, ingreso, situacion })
  }, [clave, tocado, persona, ingreso, situacion])

  const alta = useMutation({
    mutationFn: () =>
      darDeAlta({
        persona: personaParaLaApi(persona),
        fechaIngreso: ingreso,
        situacion: situacionParaLaApi(situacion, opciones.puedeVerSueldos),
        postulacionId,
      }),
    onSuccess: async ({ id }) => {
      guardarBorrador(clave, null)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['panel-colaboradores'] }),
        cache.invalidateQueries({ queryKey: ['panel-colaboradores-pendientes'] }),
        cache.invalidateQueries({ queryKey: ['panel-ficha'] }),
      ])
      navegar(rutas.adminColaborador(id))
    },
    onError: (causa) => {
      const cuerpo = causa instanceof ErrorApi ? (causa.cuerpo as { colaboradorId?: number; cesado?: boolean } | null) : null
      if (causa instanceof ErrorApi && causa.estado === 409 && cuerpo?.colaboradorId != null) {
        setChoque({ colaboradorId: cuerpo.colaboradorId, cesado: Boolean(cuerpo.cesado), mensaje: causa.message })
        setFallo(null)
        return
      }
      setChoque(null)
      setFallo(explicarFallo(causa, 'No se pudo dar de alta.'))
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (alta.isPending) return
    const nuevos: Errores = {
      ...erroresDePersona(persona),
      ...erroresDeSituacion(situacion, ingreso, opciones, opciones.puedeVerSueldos),
    }
    if (ingreso === '') nuevos.fechaIngreso = 'Indica la fecha de ingreso.'
    setErrores(nuevos)
    setChoque(null)
    setFallo(null)
    if (Object.keys(nuevos).length > 0) {
      enfocarElPrimerError(raiz.current)
      return
    }
    unaVez(() => alta.mutateAsync())
  }

  if (precarga?.colaboradorId != null) {
    return (
      <div className={estilos.pagina}>
        <h1>Nuevo colaborador.</h1>
        <p className={estilos.explica}>
          Esta contratación ya tiene su ficha de colaborador.{' '}
          <Link to={rutas.adminColaborador(precarga.colaboradorId)}>Ver su ficha</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={estilos.pagina}>
      <p>
        <Link className={estilos.volver} to={rutas.adminColaboradores()}>
          ← Colaboradores
        </Link>
      </p>
      <header className={estilos.cabecera}>
        <div>
          <h1>Nuevo colaborador.</h1>
          <p className={estilos.bajada}>
            {precarga
              ? `Contratado por la vacante «${precarga.vacante}». Revisa lo que llegó de selección —los apellidos vienen juntos en «apellido paterno»— y completa el resto.`
              : 'La ficha, su primer periodo y su situación laboral se crean juntos. Queda en la auditoría.'}
          </p>
        </div>
      </header>

      {recuperado && (
        <p className={estilos.avisoBueno} role="status">
          Recuperamos lo que estabas escribiendo antes de salir del panel.
        </p>
      )}

      <form ref={raiz} className={formularios.formulario} onSubmit={enviar} noValidate>
        <section className={formularios.bloque}>
          <h2 className={formularios.tituloBloque}>Identidad y contacto</h2>
          <CamposDeIdentidad
            valor={persona}
            alCambiar={(parcial) => {
              setTocado(true)
              setPersona((p) => ({ ...p, ...parcial }))
            }}
            errores={errores}
            opciones={opciones}
          />
        </section>
        <section className={formularios.bloque}>
          <h2 className={formularios.tituloBloque}>Domicilio y formación</h2>
          <CamposDeDomicilio
            valor={persona}
            alCambiar={(parcial) => {
              setTocado(true)
              setPersona((p) => ({ ...p, ...parcial }))
            }}
            opciones={opciones}
          />
        </section>
        <section className={formularios.bloque}>
          <h2 className={formularios.tituloBloque}>Ingreso y puesto</h2>
          <div className={formularios.rejilla}>
            <Campo
              etiqueta="Fecha de ingreso"
              obligatorio
              type="date"
              value={ingreso}
              onChange={(e) => {
                setTocado(true)
                setIngreso(e.target.value)
              }}
              error={errores.fechaIngreso}
              ayuda="Si es futura, la persona sale «Por ingresar» hasta ese día."
            />
          </div>
          <CamposDeSituacion
            valor={situacion}
            alCambiar={(parcial) => {
              setTocado(true)
              setSituacion((s) => ({ ...s, ...parcial }))
            }}
            errores={errores}
            opciones={opciones}
          />
        </section>

        {choque && (
          // Con AvisoDeFallo, como cualquier rechazo: al enviar, el botón se desactiva y suelta el
          // foco; el aviso lo toma y quien usa el teclado llega al enlace sin volver arriba.
          <AvisoDeFallo className={estilos.avisoMalo}>
            {choque.mensaje}.{' '}
            <Link
              to={
                choque.cesado
                  ? rutas.adminColaborador(choque.colaboradorId, {
                      postulacionId: postulacionId ?? undefined,
                    })
                  : rutas.adminColaborador(choque.colaboradorId)
              }
            >
              {choque.cesado ? 'Reingresar desde su ficha' : 'Ver su ficha'}
            </Link>
          </AvisoDeFallo>
        )}
        {fallo && <AvisoDeFallo className={estilos.avisoMalo}>{fallo}</AvisoDeFallo>}

        <div className={formularios.botones}>
          <button className={formularios.enviar} type="submit" disabled={alta.isPending}>
            {alta.isPending ? 'Guardando…' : 'Dar de alta'}
          </button>
          <Link
            className={formularios.chico}
            to={rutas.adminColaboradores()}
            onClick={() => guardarBorrador(clave, null)}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
