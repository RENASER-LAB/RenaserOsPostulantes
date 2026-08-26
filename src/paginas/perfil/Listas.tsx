/**
 * Las cinco listas del perfil.
 *
 * ⚠️ **No son cinco iguales**, y tratarlas como si lo fueran devuelve 404:
 * reordenar solo existe en experiencia y educación; confirmar, en las cuatro que
 * llevan origen; y los enlaces no tienen ni editar ni confirmar.
 *
 * ⚠️ **Los enlaces son otra cosa a propósito.** No llevan `origen` porque una
 * dirección no es un dato que un modelo deduzca de un archivo y la persona tenga
 * que validar: es una dirección o no lo es. Cambiar uno es borrarlo y crear el
 * nuevo.
 *
 * **Cómo se marca el origen** (ver la cabecera de `Perfil.module.css`): la
 * palabra va dentro de la píldora y el botón «Está bien» existe solo donde hay
 * algo que confirmar. En gris se distinguen igual.
 */

import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TIPOS_DE_ENLACE,
  borrarCertificacion,
  borrarEducacion,
  borrarEnlace,
  borrarExperiencia,
  borrarIdioma,
  confirmarCertificacion,
  confirmarEducacion,
  confirmarExperiencia,
  confirmarIdioma,
  crearCertificacion,
  crearEducacion,
  crearEnlace,
  crearExperiencia,
  crearIdioma,
  editarCertificacion,
  editarEducacion,
  editarExperiencia,
  editarIdioma,
  ordenarEducacion,
  ordenarExperiencia,
} from '@/api/perfil'
import type {
  CertificacionPerfil,
  ConOrigen,
  EducacionPerfil,
  EnlacePerfil,
  ExperienciaPerfil,
  IdiomaPerfil,
  OpcionCatalogo,
} from '@/api/tipos'
import { ahora } from '@/dominio/reloj'
import { AreaTexto, Campo } from '@/ui/campos/Campo'
import estilos from './Perfil.module.css'

// ---------- Piezas compartidas ----------

/**
 * Una fecha del backend (`2022-03-01`) en algo legible.
 *
 * Se parte a mano y no con `new Date`: una fecha sin hora se interpreta como
 * UTC, y en Lima eso la corre un día hacia atrás. «Marzo 2022» pasaría a ser
 * «febrero 2022» sin que nadie tocara nada.
 */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function mesYAno(fecha: string | null): string | null {
  if (!fecha) return null
  const [ano, mes] = fecha.split('-')
  const indice = Number(mes) - 1
  if (!ano || Number.isNaN(indice) || !MESES[indice]) return fecha
  return `${MESES[indice]} de ${ano}`
}

/** «marzo de 2022 — Actualidad». `hasta: null` es «sigo aquí», no un hueco. */
function periodo(desde: string | null, hasta: string | null, enCurso = false): string {
  const inicio = mesYAno(desde)
  const fin = enCurso || hasta === null ? 'Actualidad' : mesYAno(hasta)
  if (!inicio) return fin ?? ''
  return `${inicio} — ${fin}`
}

/**
 * ¿Ya venció? Se compara en texto: el formato ISO ordena solo.
 *
 * ⚠️ **El hoy NO puede salir de `toISOString()`**, que devuelve UTC: en Lima,
 * desde las siete de la tarde ya da la fecha de mañana, y una certificación que
 * vence hoy se marcaba «Vencida» esa misma tarde. Es la misma trampa que
 * `mesYAno` documenta doce líneas más arriba.
 *
 * Y el ahora sale del reloj del servidor, no del equipo: cambiar la hora de la
 * máquina no puede mover un vencimiento.
 */
function hoyEnLocal(): string {
  const d = new Date(ahora())
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function estaVencida(venceEn: string | null): boolean {
  if (!venceEn) return false
  return venceEn < hoyEnLocal()
}

/** Cómo se llama cada campo cuando hay que echarlo en falta en voz alta. */
const COMO_SE_LLAMA: Record<string, string> = {
  puesto: 'el puesto',
  empresa: 'la empresa',
  desde: 'la fecha de inicio',
  titulo: 'qué estudiaste',
  institucion: 'dónde lo estudiaste',
  idioma: 'el idioma',
  nivel: 'el nivel',
  nombre: 'el nombre',
  url: 'la dirección',
}

/**
 * Qué falta de lo que el backend exige, dicho en palabras.
 *
 * ⚠️ **Sin esto el envío salía a la red y volvía con un 400.** Los formularios
 * llevan `noValidate` y ningún campo lleva `required`, así que nada lo paraba:
 * quien olvidaba la fecha de inicio de un empleo veía un error del servidor en
 * vez de un aviso al lado del campo. Los obligatorios salen de las anotaciones
 * `@NotBlank` y `@NotNull` de `DtosPerfil.java`.
 */
function queFalta(valores: Record<string, unknown>, obligatorios: string[]): string | null {
  const vacios = obligatorios.filter((c) => String(valores[c] ?? '').trim() === '')
  if (vacios.length === 0) return null
  const nombres = vacios.map((c) => COMO_SE_LLAMA[c] ?? c)
  if (nombres.length === 1) return `Falta ${nombres[0]}.`
  const ultimo = nombres.pop()
  return `Faltan ${nombres.join(', ')} y ${ultimo}.`
}

function Marca({ dato }: { dato: ConOrigen }) {
  if (dato.origen === 'PERSONA') return null
  if (!dato.confirmado) {
    return <span className={`${estilos.marca} ${estilos.duda}`}>Sin confirmar</span>
  }
  return <span className={`${estilos.marca} ${estilos.delCv}`}>Del currículum</span>
}

interface PropsFila {
  dato: ConOrigen
  /** Lo que se lee: el título de la fila y su detalle. */
  children: ReactNode
  /**
   * Con qué se nombra esta fila en los `aria-label` de sus botones.
   *
   * ⚠️ **Tiene que distinguirla de las demás, no solo titularla.** Con el puesto
   * a secas, dos empleos con el mismo cargo en dos empresas distintas —cambiar
   * de empresa manteniendo el cargo es lo normal— dejaban dos botones «Quitar
   * Analista de procesos» idénticos en la lista de un lector de pantalla.
   */
  queEs: string
  onConfirmar: () => void
  onEditar: () => void
  onQuitar: () => void
  ocupado: boolean
  /** Las flechas, solo donde el backend deja reordenar. */
  mover?: { arriba: (() => void) | null; abajo: (() => void) | null }
}

function Fila({ dato, children, queEs, onConfirmar, onEditar, onQuitar, ocupado, mover }: PropsFila) {
  const sinConfirmar = dato.origen === 'CURRICULUM' && !dato.confirmado

  return (
    <li className={`${estilos.fila} ${sinConfirmar ? estilos.sinConfirmar : ''}`}>
      {children}
      {/*
        Cada botón nombra sobre qué actúa con su `aria-label`. Sin eso, una
        pantalla con cinco listas deja veinte botones llamados «Quitar» que en la
        lista de un lector de pantalla son veinte entradas idénticas. Es la misma
        razón por la que el enlace de «Mis procesos» nombra su vacante.
      */}
      <div className={estilos.acciones}>
        {/*
          El botón de confirmar existe SOLO donde hay algo sin confirmar: su
          presencia es la mitad de la señal, y por eso se lee en gris.
        */}
        {sinConfirmar && (
          <button
            className={estilos.confirmar}
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            aria-label={`Confirmar ${queEs}`}
          >
            Está bien
          </button>
        )}
        <button
          className={estilos.enlaceAccion}
          type="button"
          onClick={onEditar}
          disabled={ocupado}
          aria-label={`${sinConfirmar ? 'Corregir' : 'Editar'} ${queEs}`}
        >
          {sinConfirmar ? 'Corregir' : 'Editar'}
        </button>
        <button
          className={estilos.quitar}
          type="button"
          onClick={onQuitar}
          disabled={ocupado}
          aria-label={`Quitar ${queEs}`}
        >
          Quitar
        </button>
        {mover && (
          <>
            <button
              className={estilos.mover}
              type="button"
              onClick={() => mover.arriba?.()}
              disabled={ocupado || !mover.arriba}
              aria-label={`Subir ${queEs}`}
            >
              ↑
            </button>
            <button
              className={estilos.mover}
              type="button"
              onClick={() => mover.abajo?.()}
              disabled={ocupado || !mover.abajo}
              aria-label={`Bajar ${queEs}`}
            >
              ↓
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** El armazón de una sección: título, explicación, filas y el botón de añadir. */
interface PropsSeccion {
  titulo: string
  explicacion: string
  cuantosSinConfirmar: number
  vacia: string
  hayAlgo: boolean
  fallo: string | null
  children: ReactNode
}

function Seccion({
  titulo,
  explicacion,
  cuantosSinConfirmar,
  vacia,
  hayAlgo,
  fallo,
  children,
}: PropsSeccion) {
  return (
    <section className={estilos.seccion}>
      <div className={estilos.tituloSeccion}>
        <h2>{titulo}</h2>
        {cuantosSinConfirmar > 0 && (
          <span className={estilos.cuantos}>
            {cuantosSinConfirmar === 1
              ? '1 sin confirmar'
              : `${cuantosSinConfirmar} sin confirmar`}
          </span>
        )}
      </div>
      <p className={estilos.explicacion}>{explicacion}</p>
      {fallo && (
        <p className={estilos.fallo} role="alert">
          {fallo}
        </p>
      )}
      {!hayAlgo && <p className={estilos.ninguna}>{vacia}</p>}
      {children}
    </section>
  )
}

/**
 * El cableado que comparten las cinco listas.
 *
 * Devuelve las mutaciones ya atadas a la caché y un `fallo` que se lee de una
 * sola pieza. Cada `onSuccess` invalida `['perfil']`: el GET del perfil es la
 * única fuente, así que no hay estado que sincronizar a mano.
 */
function useLista() {
  const cache = useQueryClient()
  const [fallo, setFallo] = useState<string | null>(null)

  // ⚠️ **Refrescar limpia el fallo**, y por eso lo usan todos los `onSuccess`.
  // Sin esto, un borrado que fallaba dejaba su aviso rojo en pantalla mientras
  // la operación siguiente iba bien: el mensaje decía que algo estaba mal cuando
  // ya no lo estaba. Es la familia de «indicadores que mienten».
  const refrescar = () => {
    setFallo(null)
    return cache.invalidateQueries({ queryKey: ['perfil'] })
  }
  const alFallar = (causa: unknown) =>
    setFallo(causa instanceof Error ? causa.message : 'No pudimos guardar el cambio.')

  return { fallo, setFallo, refrescar, alFallar }
}

/**
 * El orden nuevo tras mover una fila un puesto arriba o abajo.
 *
 * Se reordena con flechas y no arrastrando: desde el teléfono responde casi
 * todo el mundo, y arrastrar ahí va mal. Es la misma decisión que ya se tomó en
 * el SEC de la evaluación.
 */
function conLaFilaMovida(ids: number[], indice: number, hacia: number): number[] {
  const destino = indice + hacia
  if (destino < 0 || destino >= ids.length) return ids
  const copia = [...ids]
  const sacado = copia[indice]
  const otro = copia[destino]
  if (sacado === undefined || otro === undefined) return ids
  copia[indice] = otro
  copia[destino] = sacado
  return copia
}

// ---------- Experiencia ----------

const EXPERIENCIA_VACIA = { puesto: '', empresa: '', desde: '', hasta: '', descripcion: '' }

export function Experiencia({ filas }: { filas: ExperienciaPerfil[] }) {
  const { fallo, setFallo, refrescar, alFallar } = useLista()
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const [valores, setValores] = useState(EXPERIENCIA_VACIA)

  const cerrar = () => {
    setEditando(null)
    setValores(EXPERIENCIA_VACIA)
    setFallo(null)
  }

  const alta = useMutation({
    mutationFn: crearExperiencia,
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const cambio = useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: typeof EXPERIENCIA_VACIA }) =>
      editarExperiencia(id, {
        puesto: datos.puesto.trim(),
        empresa: datos.empresa.trim(),
        desde: datos.desde,
        hasta: datos.hasta || null,
        descripcion: datos.descripcion.trim() || null,
      }),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const baja = useMutation({
    mutationFn: borrarExperiencia,
    onSuccess: refrescar,
    onError: alFallar,
  })

  const confirmacion = useMutation({
    mutationFn: confirmarExperiencia,
    onSuccess: refrescar,
    onError: alFallar,
  })

  const orden = useMutation({
    mutationFn: ordenarExperiencia,
    onSuccess: refrescar,
    onError: alFallar,
  })

  const ocupado =
    alta.isPending || cambio.isPending || baja.isPending || confirmacion.isPending || orden.isPending

  function mover(indice: number, hacia: number) {
    orden.mutate(conLaFilaMovida(filas.map((f) => f.id), indice, hacia))
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    // Lo que el backend exige. Se para aquí para que el aviso salga junto al
    // formulario y no como un 400 después de ir y volver.
    const falta = queFalta(valores, ['puesto', 'empresa', 'desde'])
    if (falta) {
      setFallo(falta)
      return
    }
    if (editando === 'nueva') {
      alta.mutate({
        puesto: valores.puesto.trim(),
        empresa: valores.empresa.trim(),
        desde: valores.desde,
        hasta: valores.hasta || null,
        descripcion: valores.descripcion.trim() || null,
      })
    } else if (typeof editando === 'number') {
      cambio.mutate({ id: editando, datos: valores })
    }
  }

  return (
    <Seccion
      titulo="Experiencia"
      explicacion="Dónde has trabajado y qué hiciste. Lo más reciente arriba; puedes cambiar el orden con las flechas."
      cuantosSinConfirmar={filas.filter((f) => f.origen === 'CURRICULUM' && !f.confirmado).length}
      vacia="Todavía no hay nada aquí."
      hayAlgo={filas.length > 0}
      fallo={fallo}
    >
      {filas.length > 0 && (
        <ul className={estilos.filas} role="list">
          {filas.map((f, i) => (
            <Fila
              key={f.id}
              dato={f}
              queEs={`${f.puesto} en ${f.empresa}`}
              ocupado={ocupado}
              onConfirmar={() => confirmacion.mutate(f.id)}
              onEditar={() => {
                setEditando(f.id)
                setValores({
                  puesto: f.puesto,
                  empresa: f.empresa,
                  desde: f.desde,
                  hasta: f.hasta ?? '',
                  descripcion: f.descripcion ?? '',
                })
              }}
              onQuitar={() => baja.mutate(f.id)}
              mover={{
                arriba: i > 0 ? () => mover(i, -1) : null,
                abajo: i < filas.length - 1 ? () => mover(i, 1) : null,
              }}
            >
              <div className={estilos.cabeceraFila}>
                <span className={estilos.queEs}>{f.puesto}</span>
                <span className={estilos.donde}>{f.empresa}</span>
                <Marca dato={f} />
              </div>
              <p className={estilos.cuando}>{periodo(f.desde, f.hasta)}</p>
              {f.descripcion && <p className={estilos.detalleFila}>{f.descripcion}</p>}
            </Fila>
          ))}
        </ul>
      )}

      {editando !== null ? (
        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Puesto"
              maxLength={200}
              value={valores.puesto}
              onChange={(e) => setValores((v) => ({ ...v, puesto: e.target.value }))}
            />
            <Campo
              etiqueta="Empresa"
              maxLength={200}
              value={valores.empresa}
              onChange={(e) => setValores((v) => ({ ...v, empresa: e.target.value }))}
            />
          </div>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Desde"
              type="date"
              value={valores.desde}
              onChange={(e) => setValores((v) => ({ ...v, desde: e.target.value }))}
            />
            <Campo
              etiqueta="Hasta"
              ayuda="Déjalo en blanco si sigues ahí."
              type="date"
              value={valores.hasta}
              onChange={(e) => setValores((v) => ({ ...v, hasta: e.target.value }))}
            />
          </div>
          <AreaTexto
            etiqueta="Qué hacías"
            ayuda="Opcional. Lo que estaba a tu cargo y qué cambió mientras estuviste."
            maximo={2000}
            value={valores.descripcion}
            onChange={(e) => setValores((v) => ({ ...v, descripcion: e.target.value }))}
          />
          <div className={estilos.pieFormulario}>
            <button className={estilos.guardar} type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button className={estilos.cancelar} type="button" onClick={cerrar} disabled={ocupado}>
              Dejarlo
            </button>
          </div>
        </form>
      ) : (
        <button
          className={estilos.anadir}
          type="button"
          onClick={() => {
            setValores(EXPERIENCIA_VACIA)
            setEditando('nueva')
          }}
        >
          Añadir experiencia
        </button>
      )}
    </Seccion>
  )
}

// ---------- Educación ----------

const EDUCACION_VACIA = {
  titulo: '',
  institucion: '',
  nivelCodigo: '',
  desde: '',
  hasta: '',
  enCurso: false,
}

export function Educacion({
  filas,
  niveles,
  catalogoCaido = false,
}: {
  filas: EducacionPerfil[]
  niveles: OpcionCatalogo[]
  catalogoCaido?: boolean
}) {
  const { fallo, setFallo, refrescar, alFallar } = useLista()
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const [valores, setValores] = useState(EDUCACION_VACIA)

  const cerrar = () => {
    setEditando(null)
    setValores(EDUCACION_VACIA)
    setFallo(null)
  }

  const comoLaMandaElBackend = (v: typeof EDUCACION_VACIA) => ({
    titulo: v.titulo.trim(),
    institucion: v.institucion.trim(),
    nivelCodigo: v.nivelCodigo || null,
    desde: v.desde || null,
    hasta: v.hasta || null,
    enCurso: v.enCurso,
  })

  const alta = useMutation({
    mutationFn: () => crearEducacion(comoLaMandaElBackend(valores)),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const cambio = useMutation({
    mutationFn: (id: number) => editarEducacion(id, comoLaMandaElBackend(valores)),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const baja = useMutation({ mutationFn: borrarEducacion, onSuccess: refrescar, onError: alFallar })
  const confirmacion = useMutation({
    mutationFn: confirmarEducacion,
    onSuccess: refrescar,
    onError: alFallar,
  })
  const orden = useMutation({ mutationFn: ordenarEducacion, onSuccess: refrescar, onError: alFallar })

  const ocupado =
    alta.isPending || cambio.isPending || baja.isPending || confirmacion.isPending || orden.isPending

  function mover(indice: number, hacia: number) {
    orden.mutate(conLaFilaMovida(filas.map((f) => f.id), indice, hacia))
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    const falta = queFalta(valores, ['titulo', 'institucion'])
    if (falta) {
      setFallo(falta)
      return
    }
    if (editando === 'nueva') alta.mutate()
    else if (typeof editando === 'number') cambio.mutate(editando)
  }

  const nombreDelNivel = (codigo: string | null) =>
    niveles.find((n) => n.codigo === codigo)?.nombre ?? codigo

  return (
    <Seccion
      titulo="Estudios"
      explicacion="Lo que estudiaste y dónde. Si sigues estudiando, márcalo y no hace falta poner una fecha de fin."
      cuantosSinConfirmar={filas.filter((f) => f.origen === 'CURRICULUM' && !f.confirmado).length}
      vacia="Todavía no hay nada aquí."
      hayAlgo={filas.length > 0}
      // Aquí el nivel es opcional, así que se puede seguir trabajando sin el
      // catálogo; lo único que se pierde es poder elegirlo, y se dice.
      fallo={
        catalogoCaido
          ? 'No pudimos cargar la lista de niveles de estudio. Puedes añadir y editar igual; el nivel podrás elegirlo cuando vuelva.'
          : fallo
      }
    >
      {filas.length > 0 && (
        <ul className={estilos.filas} role="list">
          {filas.map((f, i) => (
            <Fila
              key={f.id}
              dato={f}
              queEs={`${f.titulo} en ${f.institucion}`}
              ocupado={ocupado}
              onConfirmar={() => confirmacion.mutate(f.id)}
              onEditar={() => {
                setEditando(f.id)
                setValores({
                  titulo: f.titulo,
                  institucion: f.institucion,
                  nivelCodigo: f.nivelCodigo ?? '',
                  desde: f.desde ?? '',
                  hasta: f.hasta ?? '',
                  enCurso: f.enCurso,
                })
              }}
              onQuitar={() => baja.mutate(f.id)}
              mover={{
                arriba: i > 0 ? () => mover(i, -1) : null,
                abajo: i < filas.length - 1 ? () => mover(i, 1) : null,
              }}
            >
              <div className={estilos.cabeceraFila}>
                <span className={estilos.queEs}>{f.titulo}</span>
                <span className={estilos.donde}>{f.institucion}</span>
                {f.nivelCodigo && (
                  <span className={`${estilos.marca} ${estilos.delCv}`}>
                    {nombreDelNivel(f.nivelCodigo)}
                  </span>
                )}
                <Marca dato={f} />
              </div>
              <p className={estilos.cuando}>{periodo(f.desde, f.hasta, f.enCurso)}</p>
            </Fila>
          ))}
        </ul>
      )}

      {editando !== null ? (
        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Qué estudiaste"
              maxLength={200}
              value={valores.titulo}
              onChange={(e) => setValores((v) => ({ ...v, titulo: e.target.value }))}
            />
            <Campo
              etiqueta="Dónde"
              maxLength={200}
              value={valores.institucion}
              onChange={(e) => setValores((v) => ({ ...v, institucion: e.target.value }))}
            />
          </div>
          <div className={estilos.campoSuelto}>
            <label className={estilos.etiqueta} htmlFor="nivel-educativo">
              Nivel
            </label>
            <select
              className={estilos.seleccion}
              id="nivel-educativo"
              value={valores.nivelCodigo}
              onChange={(e) => setValores((v) => ({ ...v, nivelCodigo: e.target.value }))}
            >
              <option value="">Sin especificar</option>
              {niveles.map((n) => (
                <option key={n.codigo} value={n.codigo}>
                  {n.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Desde"
              type="date"
              value={valores.desde}
              onChange={(e) => setValores((v) => ({ ...v, desde: e.target.value }))}
            />
            <Campo
              etiqueta="Hasta"
              type="date"
              value={valores.hasta}
              disabled={valores.enCurso}
              onChange={(e) => setValores((v) => ({ ...v, hasta: e.target.value }))}
            />
          </div>
          <label className={estilos.casilla}>
            <input
              type="checkbox"
              checked={valores.enCurso}
              onChange={(e) => setValores((v) => ({ ...v, enCurso: e.target.checked }))}
            />
            Sigo estudiando esto
          </label>
          <div className={estilos.pieFormulario}>
            <button className={estilos.guardar} type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button className={estilos.cancelar} type="button" onClick={cerrar} disabled={ocupado}>
              Dejarlo
            </button>
          </div>
        </form>
      ) : (
        <button
          className={estilos.anadir}
          type="button"
          onClick={() => {
            setValores(EDUCACION_VACIA)
            setEditando('nueva')
          }}
        >
          Añadir estudios
        </button>
      )}
    </Seccion>
  )
}

// ---------- Idiomas ----------

/**
 * Qué significa cada nivel, en palabras de todos los días.
 *
 * El catálogo del backend trae «B2 · Intermedio alto», que es una etiqueta, no
 * una explicación: mucha gente no sabe cuál es su nivel y elegiría al azar, y
 * entonces el dato no vale nada. Esto es copia del frontend atada al código; un
 * código que no esté aquí simplemente no lleva línea.
 */
const QUE_SIGNIFICA: Record<string, string> = {
  A1: 'Puedo presentarme y decir cosas muy sencillas.',
  A2: 'Me apaño en situaciones cotidianas y frases cortas.',
  B1: 'Sigo una conversación normal si no va muy rápido.',
  B2: 'Me manejo en una reunión de trabajo sin perderme.',
  C1: 'Trabajo en este idioma con soltura, también por escrito.',
  C2: 'Lo uso como el mío, en cualquier contexto.',
  NATIVO: 'Es mi lengua materna.',
}

export function Idiomas({
  filas,
  niveles,
  catalogoCaido = false,
}: {
  filas: IdiomaPerfil[]
  niveles: OpcionCatalogo[]
  catalogoCaido?: boolean
}) {
  const { fallo, setFallo, refrescar, alFallar } = useLista()
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const [idioma, setIdioma] = useState('')
  const [nivel, setNivel] = useState('')

  const cerrar = () => {
    setEditando(null)
    setIdioma('')
    setNivel('')
    setFallo(null)
  }

  const alta = useMutation({
    mutationFn: () => crearIdioma({ idioma: idioma.trim(), nivelCodigo: nivel }),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const cambio = useMutation({
    mutationFn: (id: number) => editarIdioma(id, { idioma: idioma.trim(), nivelCodigo: nivel }),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const baja = useMutation({ mutationFn: borrarIdioma, onSuccess: refrescar, onError: alFallar })
  const confirmacion = useMutation({
    mutationFn: confirmarIdioma,
    onSuccess: refrescar,
    onError: alFallar,
  })

  const ocupado = alta.isPending || cambio.isPending || baja.isPending || confirmacion.isPending

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    // El nivel es `@NotBlank` y la opción por defecto del selector vale '': sin
    // esta guarda, añadir un idioma sin elegir nivel rebotaba con un 400.
    const falta = queFalta({ idioma, nivel }, ['idioma', 'nivel'])
    if (falta) {
      setFallo(falta)
      return
    }
    if (editando === 'nueva') alta.mutate()
    else if (typeof editando === 'number') cambio.mutate(editando)
  }

  const nombreDelNivel = (codigo: string) =>
    niveles.find((n) => n.codigo === codigo)?.nombre ?? codigo

  return (
    <Seccion
      titulo="Idiomas"
      explicacion="Qué idiomas hablas y hasta dónde. Al elegir el nivel verás qué significa cada uno."
      cuantosSinConfirmar={filas.filter((f) => f.origen === 'CURRICULUM' && !f.confirmado).length}
      vacia="Todavía no hay nada aquí."
      hayAlgo={filas.length > 0}
      fallo={
        catalogoCaido
          ? 'No pudimos cargar la lista de niveles, así que ahora mismo no se puede añadir un idioma. Lo que ya tienes sigue guardado; vuelve a cargar la página en un momento.'
          : fallo
      }
    >
      {filas.length > 0 && (
        <ul className={estilos.filas} role="list">
          {filas.map((f) => (
            <Fila
              key={f.id}
              dato={f}
              queEs={f.idioma}
              ocupado={ocupado}
              onConfirmar={() => confirmacion.mutate(f.id)}
              onEditar={() => {
                setEditando(f.id)
                setIdioma(f.idioma)
                setNivel(f.nivelCodigo)
              }}
              onQuitar={() => baja.mutate(f.id)}
            >
              <div className={estilos.cabeceraFila}>
                <span className={estilos.queEs}>{f.idioma}</span>
                <span className={estilos.donde}>{nombreDelNivel(f.nivelCodigo)}</span>
                <Marca dato={f} />
              </div>
              {QUE_SIGNIFICA[f.nivelCodigo] && (
                <p className={estilos.detalleFila}>{QUE_SIGNIFICA[f.nivelCodigo]}</p>
              )}
            </Fila>
          ))}
        </ul>
      )}

      {editando !== null ? (
        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <Campo
            etiqueta="Idioma"
            maxLength={100}
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
          />
          <div className={estilos.campoSuelto}>
            <label className={estilos.etiqueta} htmlFor="nivel-idioma">
              Nivel
            </label>
            <select
              className={estilos.seleccion}
              id="nivel-idioma"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
            >
              <option value="">Elige uno</option>
              {niveles.map((n) => (
                <option key={n.codigo} value={n.codigo}>
                  {n.nombre}
                </option>
              ))}
            </select>
            {/*
              La explicación va aquí, viva, y no en una tabla aparte: se lee
              justo cuando se está eligiendo, que es cuando sirve de algo.
            */}
            {QUE_SIGNIFICA[nivel] && <p className={estilos.ayuda}>{QUE_SIGNIFICA[nivel]}</p>}
          </div>
          <div className={estilos.pieFormulario}>
            <button className={estilos.guardar} type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button className={estilos.cancelar} type="button" onClick={cerrar} disabled={ocupado}>
              Dejarlo
            </button>
          </div>
        </form>
      ) : (
        <button
          className={estilos.anadir}
          type="button"
          disabled={catalogoCaido}
          onClick={() => {
            setIdioma('')
            setNivel('')
            setEditando('nueva')
          }}
        >
          Añadir idioma
        </button>
      )}
    </Seccion>
  )
}

// ---------- Certificaciones ----------

const CERTIFICACION_VACIA = { nombre: '', entidad: '', emitidaEn: '', venceEn: '' }

export function Certificaciones({ filas }: { filas: CertificacionPerfil[] }) {
  const { fallo, setFallo, refrescar, alFallar } = useLista()
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const [valores, setValores] = useState(CERTIFICACION_VACIA)

  const cerrar = () => {
    setEditando(null)
    setValores(CERTIFICACION_VACIA)
    setFallo(null)
  }

  const comoLaManda = () => ({
    nombre: valores.nombre.trim(),
    entidad: valores.entidad.trim() || null,
    emitidaEn: valores.emitidaEn || null,
    venceEn: valores.venceEn || null,
  })

  const alta = useMutation({
    mutationFn: () => crearCertificacion(comoLaManda()),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const cambio = useMutation({
    mutationFn: (id: number) => editarCertificacion(id, comoLaManda()),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const baja = useMutation({
    mutationFn: borrarCertificacion,
    onSuccess: refrescar,
    onError: alFallar,
  })
  const confirmacion = useMutation({
    mutationFn: confirmarCertificacion,
    onSuccess: refrescar,
    onError: alFallar,
  })

  const ocupado = alta.isPending || cambio.isPending || baja.isPending || confirmacion.isPending

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    const falta = queFalta(valores, ['nombre'])
    if (falta) {
      setFallo(falta)
      return
    }
    if (editando === 'nueva') alta.mutate()
    else if (typeof editando === 'number') cambio.mutate(editando)
  }

  return (
    <Seccion
      titulo="Certificaciones"
      explicacion="Certificados, colegiaturas y cursos con constancia. Si alguno caduca, pon la fecha: te avisamos aquí antes de que te pille."
      cuantosSinConfirmar={filas.filter((f) => f.origen === 'CURRICULUM' && !f.confirmado).length}
      vacia="Todavía no hay nada aquí."
      hayAlgo={filas.length > 0}
      fallo={fallo}
    >
      {filas.length > 0 && (
        <ul className={estilos.filas} role="list">
          {filas.map((f) => (
            <Fila
              key={f.id}
              dato={f}
              queEs={f.nombre}
              ocupado={ocupado}
              onConfirmar={() => confirmacion.mutate(f.id)}
              onEditar={() => {
                setEditando(f.id)
                setValores({
                  nombre: f.nombre,
                  entidad: f.entidad ?? '',
                  emitidaEn: f.emitidaEn ?? '',
                  venceEn: f.venceEn ?? '',
                })
              }}
              onQuitar={() => baja.mutate(f.id)}
            >
              <div className={estilos.cabeceraFila}>
                <span className={estilos.queEs}>{f.nombre}</span>
                {f.entidad && <span className={estilos.donde}>{f.entidad}</span>}
                {/*
                  Una certificación vencida importa de verdad en salud
                  —colegiatura, primeros auxilios— y es mucho mejor verlo aquí
                  que descubrirlo tarde. Lleva la palabra dentro, como todo.
                */}
                {estaVencida(f.venceEn) && (
                  <span className={`${estilos.marca} ${estilos.vencida}`}>Vencida</span>
                )}
                <Marca dato={f} />
              </div>
              {/*
                Se arma juntando los trozos que existen: encadenar condiciones
                dejaba «Emitida en febrero de 2024No caduca» cuando no habia
                fecha de vencimiento.
              */}
              <p className={estilos.cuando}>
                {[
                  f.emitidaEn ? `Emitida en ${mesYAno(f.emitidaEn)}` : null,
                  f.venceEn ? `Vence en ${mesYAno(f.venceEn)}` : 'No caduca',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Fila>
          ))}
        </ul>
      )}

      {editando !== null ? (
        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Nombre"
              maxLength={200}
              value={valores.nombre}
              onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
            />
            <Campo
              etiqueta="Quién la emitió"
              maxLength={200}
              value={valores.entidad}
              onChange={(e) => setValores((v) => ({ ...v, entidad: e.target.value }))}
            />
          </div>
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Emitida en"
              type="date"
              value={valores.emitidaEn}
              onChange={(e) => setValores((v) => ({ ...v, emitidaEn: e.target.value }))}
            />
            <Campo
              etiqueta="Vence en"
              ayuda="Déjalo en blanco si no caduca."
              type="date"
              value={valores.venceEn}
              onChange={(e) => setValores((v) => ({ ...v, venceEn: e.target.value }))}
            />
          </div>
          <div className={estilos.pieFormulario}>
            <button className={estilos.guardar} type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button className={estilos.cancelar} type="button" onClick={cerrar} disabled={ocupado}>
              Dejarlo
            </button>
          </div>
        </form>
      ) : (
        <button
          className={estilos.anadir}
          type="button"
          onClick={() => {
            setValores(CERTIFICACION_VACIA)
            setEditando('nueva')
          }}
        >
          Añadir certificación
        </button>
      )}
    </Seccion>
  )
}

// ---------- Enlaces ----------

export function Enlaces({ filas }: { filas: EnlacePerfil[] }) {
  const { fallo, setFallo, refrescar, alFallar } = useLista()
  const [anadiendo, setAnadiendo] = useState(false)
  const [tipo, setTipo] = useState<string>(TIPOS_DE_ENLACE[0].codigo)
  const [url, setUrl] = useState('')

  const cerrar = () => {
    setAnadiendo(false)
    setTipo(TIPOS_DE_ENLACE[0].codigo)
    setUrl('')
    setFallo(null)
  }

  const alta = useMutation({
    mutationFn: () => crearEnlace({ tipo, url: url.trim() }),
    onSuccess: async () => {
      cerrar()
      await refrescar()
    },
    onError: alFallar,
  })

  const baja = useMutation({ mutationFn: borrarEnlace, onSuccess: refrescar, onError: alFallar })

  const ocupado = alta.isPending || baja.isPending

  const nombreDelTipo = (codigo: string) =>
    TIPOS_DE_ENLACE.find((t) => t.codigo === codigo)?.nombre ?? codigo

  return (
    <Seccion
      titulo="Enlaces"
      explicacion="Sitios donde se puede ver cómo trabajas. Para cambiar uno, quítalo y añade el nuevo."
      cuantosSinConfirmar={0}
      vacia="Todavía no hay nada aquí."
      hayAlgo={filas.length > 0}
      fallo={fallo}
    >
      {filas.length > 0 && (
        <ul className={estilos.filas} role="list">
          {filas.map((f) => (
            <li className={estilos.fila} key={f.id}>
              <div className={estilos.cabeceraFila}>
                <span className={estilos.queEs}>{nombreDelTipo(f.tipo)}</span>
                <a className={estilos.donde} href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.url}
                </a>
              </div>
              <div className={estilos.acciones}>
                {/*
                  Solo quitar: los enlaces no llevan origen —una dirección no es
                  algo que un modelo deduzca y haya que validar— así que no hay
                  ni editar ni confirmar en el backend.
                */}
                <button
                  className={estilos.quitar}
                  type="button"
                  onClick={() => baja.mutate(f.id)}
                  disabled={ocupado}
                  aria-label={`Quitar el enlace de ${nombreDelTipo(f.tipo)}`}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {anadiendo ? (
        <form
          className={estilos.formulario}
          onSubmit={(e) => {
            e.preventDefault()
            setFallo(null)
            const falta = queFalta({ url }, ['url'])
            if (falta) {
              setFallo(falta)
              return
            }
            alta.mutate()
          }}
          noValidate
        >
          <div className={estilos.campoSuelto}>
            <label className={estilos.etiqueta} htmlFor="tipo-enlace">
              Qué es
            </label>
            <select
              className={estilos.seleccion}
              id="tipo-enlace"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              {TIPOS_DE_ENLACE.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {(tipo === 'LINKEDIN' || tipo === 'GITHUB') && (
              <p className={estilos.ayuda}>
                Tiene que ser una dirección de {nombreDelTipo(tipo)}; si no, se rechaza.
              </p>
            )}
          </div>
          <Campo
            etiqueta="Dirección"
            type="url"
            maxLength={500}
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className={estilos.pieFormulario}>
            <button className={estilos.guardar} type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button className={estilos.cancelar} type="button" onClick={cerrar} disabled={ocupado}>
              Dejarlo
            </button>
          </div>
        </form>
      ) : (
        <button className={estilos.anadir} type="button" onClick={() => setAnadiendo(true)}>
          Añadir enlace
        </button>
      )}
    </Seccion>
  )
}
