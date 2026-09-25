/**
 * Los campos de una vacante, los mismos para escribirla y para corregirla.
 *
 * Existe porque el alta y la edicion **son el mismo formulario**. Duplicarlo
 * tendria el coste de siempre —un campo nuevo que se añade en un sitio y falta
 * en el otro— pero aqui ademas seria mentira para quien lo usa: se corrige una
 * vacante donde se escribio, con las mismas palabras y en el mismo orden.
 *
 * Lo que NO vive aqui es lo que distingue a cada uno: el alta elige la solicitud
 * y el puesto —que en la edicion son texto fijo, porque cambiarlos cambiaria la
 * evaluacion entera— y la edicion dice a cuanta gente le va a llegar el cambio.
 *
 * ## La modalidad y la ciudad se eligen de una lista (25/09/2026)
 *
 * «Modalidad» es un desplegable con Presencial, Híbrido y Remoto, y «Ciudad» el
 * mismo catálogo de provincias que el registro del candidato. Lo que antes era
 * «Ubicación» pasa a ser «Zona o referencia», texto libre y opcional.
 *
 * ⚠️ **Si nadie toca un desplegable, se guarda lo que había, letra por letra.**
 * El formulario conserva el texto guardado («PRESENCIAL») en `datos.modalidad` y
 * el desplegable solo lo TRADUCE para marcar la opción equivalente; si la persona
 * elige otra, se guarda el texto de esa opción. Corregir el horario no puede
 * convertir «PRESENCIAL» en «Presencial»: para el backend sería un cambio de
 * modalidad y avisaría a cada postulante en carrera de un cambio que no existe.
 *
 * Una vacante vieja sin modalidad o sin ciudad muestra «Sin indicar» y se puede
 * guardar así; una modalidad que no se parece a ninguna («test») aparece como
 * «test (valor anterior)», marcada, con la pista de elegir una de las tres.
 */

import { useId, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { catalogoUbigeo } from '@/api/portal'
import { agrupadasPorDepartamento } from '@/dominio/ubigeo'
import { listarUsuarios, verCatalogos } from '../api/panel'
import type { VacantePanel } from '../api/tipos'
import estilos from './Vacantes.module.css'

/** Lo que el formulario tiene en la mano: texto, que es lo que hay en un input. */
export interface DatosDeVacante {
  responsableUsuarioId: string
  titulo: string
  descripcion: string
  proposito: string
  responsabilidades: string
  requisitos: string
  /** Tal como está guardada («PRESENCIAL»), o la opción elegida («Presencial»). */
  modalidad: string
  horario: string
  /** La zona o referencia: barrio, distrito o dirección. Hasta la V62, «Ubicación». */
  ubicacion: string
  /** El código de la ciudad del catálogo, o vacío. */
  ciudadUbigeo: string
  tipoCierre: string
  plazas: string
  cierraEn: string
}

export const VACANTE_VACIA: DatosDeVacante = {
  responsableUsuarioId: '',
  titulo: '',
  descripcion: '',
  proposito: '',
  responsabilidades: '',
  requisitos: '',
  modalidad: '',
  horario: '',
  ubicacion: '',
  ciudadUbigeo: '',
  tipoCierre: 'PERMANENTE',
  plazas: '',
  cierraEn: '',
}

/** Las tres del desplegable, con su tilde: se guarda exactamente este texto. */
export const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'] as const

function sinTildesNiMayusculas(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Qué opción del desplegable marca una modalidad guardada: «PRESENCIAL» marca
 * Presencial y «Hibrido» marca Híbrido, sin mirar mayúsculas ni tildes. Vacía es
 * `''` («Sin indicar» o «Elige…»); lo que no se parece a ninguna («test») es su
 * propio valor, para que salga como opción propia y marcada.
 */
export function opcionDeModalidad(guardada: string): string {
  const limpia = guardada.trim()
  if (limpia === '') return ''
  const clave = sinTildesNiMayusculas(limpia)
  return MODALIDADES.find((m) => sinTildesNiMayusculas(m) === clave) ?? limpia
}

/** Presencial e Híbrido tienen una ciudad; Remoto puede no tenerla. */
export function modalidadPideCiudad(modalidad: string): boolean {
  const opcion = opcionDeModalidad(modalidad)
  return opcion === 'Presencial' || opcion === 'Híbrido'
}

/**
 * Lo guardado, traido al formulario.
 *
 * Los nulos se vuelven cadenas vacias: un `value={null}` convierte el input en
 * no controlado y React lo avisa en consola la primera vez que se teclea.
 *
 * La modalidad viaja TAL CUAL está guardada, sin traducirla a la opción: es lo
 * que hace que guardar sin tocar el desplegable devuelva el mismo texto.
 */
export function vacanteComoFormulario(v: VacantePanel): DatosDeVacante {
  return {
    responsableUsuarioId: String(v.responsableUsuarioId ?? ''),
    titulo: v.titulo ?? '',
    descripcion: v.descripcion ?? '',
    proposito: v.proposito ?? '',
    responsabilidades: v.responsabilidades ?? '',
    requisitos: v.requisitos ?? '',
    modalidad: v.modalidad ?? '',
    horario: v.horario ?? '',
    ubicacion: v.ubicacion ?? '',
    ciudadUbigeo: v.ciudad?.codigo ?? '',
    tipoCierre: v.tipoCierre ?? 'PERMANENTE',
    plazas: v.plazas === null ? '' : String(v.plazas),
    // El input de fecha quiere «2026-12-01» y el backend habla en instantes.
    cierraEn: v.cierraEn ? v.cierraEn.slice(0, 10) : '',
  }
}

/**
 * Lo que el formulario manda, con los textos ya recortados.
 *
 * ⚠️ **Lo que no está aqui, el backend NO lo toca al editar.** `abreEn` no viaja
 * —esta entrega no ofrece la fecha de apertura— y `plazas`/`cierraEn` viajan solo
 * con la forma de cierre que las usa, que es cuando la pantalla las enseña. El
 * backend lee esa ausencia como «no me lo has enseñado» y conserva lo guardado;
 * antes la leia como un nulo y abrir el lapiz y pulsar guardar vaciaba en
 * silencio datos que nadie habia visto.
 *
 * La modalidad y la ciudad viajan como están en `datos`: lo guardado si nadie
 * tocó el desplegable, la opción elegida si alguien lo hizo.
 */
export function camposParaGuardar(datos: DatosDeVacante) {
  return {
    responsableUsuarioId: Number(datos.responsableUsuarioId),
    titulo: datos.titulo.trim(),
    descripcion: datos.descripcion.trim(),
    proposito: datos.proposito.trim() || undefined,
    responsabilidades: datos.responsabilidades.trim() || undefined,
    requisitos: datos.requisitos.trim() || undefined,
    modalidad: datos.modalidad.trim() || undefined,
    horario: datos.horario.trim() || undefined,
    ubicacion: datos.ubicacion.trim() || undefined,
    ciudadUbigeo: datos.ciudadUbigeo.trim() || undefined,
    tipoCierre: datos.tipoCierre,
    plazas:
      datos.tipoCierre === 'PLAZAS' && datos.plazas ? Number(datos.plazas) : undefined,
    cierraEn:
      datos.tipoCierre === 'FECHA' && datos.cierraEn
        ? new Date(datos.cierraEn).toISOString()
        : undefined,
  }
}

/**
 * Lo minimo que ve quien postula, y que la forma de cierre cuadre. Se comprueba
 * antes de enviar, no despues.
 *
 * ⚠️ **Las plazas y la fecha se validan aqui porque si no se pierden en
 * silencio.** `Number('5,5')` es `NaN`, y un `NaN` en el cuerpo viaja como
 * `null`: la vacante se guardaria «por plazas» sin ninguna plaza, sin que nadie
 * viera un error. Lo mismo con la forma «por fecha» y el dia vacio.
 */
export function loQueFaltaEnLaVacante(datos: DatosDeVacante): string | null {
  if (!datos.responsableUsuarioId) {
    return 'Elige el responsable del proceso.'
  }
  if (datos.titulo.trim() === '' || datos.descripcion.trim() === '') {
    return 'El título y la descripción son lo mínimo que ve quien postula.'
  }
  if (datos.tipoCierre === 'PLAZAS') {
    const plazas = Number(datos.plazas.trim())
    if (datos.plazas.trim() === '' || !Number.isInteger(plazas) || plazas < 1) {
      return 'Escribe cuántas plazas hay, en un número entero.'
    }
  }
  if (datos.tipoCierre === 'FECHA' && datos.cierraEn.trim() === '') {
    return 'Elige el día en que cierra la vacante.'
  }
  return null
}

/** Lo que falta en los dos desplegables, cada uno con su frase. */
export interface ErroresDeLosDesplegables {
  modalidad?: string
  ciudadUbigeo?: string
}

/**
 * Al crear, la modalidad es obligatoria, y la ciudad lo es si la modalidad es
 * Presencial o Híbrido; con Remoto es opcional. Si se cambia de Remoto a
 * Presencial sin ciudad, vuelve a pedirse.
 *
 * Al editar una vacante vieja no se exige nada que no tuviera: corregir el
 * horario no obliga a decidir la ciudad —se guarda «Sin indicar»—. Lo que sí se
 * exige es la ciudad si la persona acaba de ELEGIR Presencial o Híbrido en una
 * vacante que no la tiene: eso ya es decidir, y una presencial sin ciudad es lo
 * que esta pantalla existe para evitar.
 */
export function loQueFaltaEnLosDesplegables(
  datos: DatosDeVacante,
  guardada?: VacantePanel,
): ErroresDeLosDesplegables {
  const errores: ErroresDeLosDesplegables = {}
  const creando = guardada === undefined
  if (creando && opcionDeModalidad(datos.modalidad) === '') {
    errores.modalidad = 'Elige si es presencial, híbrida o remota.'
  }
  const modalidadCambio = !creando && datos.modalidad !== (guardada.modalidad ?? '')
  if ((creando || modalidadCambio) && modalidadPideCiudad(datos.modalidad) && datos.ciudadUbigeo === '') {
    errores.ciudadUbigeo = 'Elige la ciudad del puesto.'
  }
  return errores
}

/**
 * Los campos comunes del alta y de la edicion, en el orden en que se piensan.
 *
 * Van sueltos dentro de la rejilla del formulario que los monta: un `<div>`
 * propio aqui romperia las columnas del que los usa.
 *
 * `guardada` es la vacante que se corrige, o nada al crear: decide si los
 * desplegables ofrecen «Sin indicar» y «(valor anterior)».
 */
export function CamposComunes({
  datos,
  poner,
  guardada,
  errores = {},
}: {
  datos: DatosDeVacante
  poner: (campo: keyof DatosDeVacante) => (valor: string) => void
  guardada?: VacantePanel
  errores?: ErroresDeLosDesplegables
}) {
  const usuarios = useQuery({ queryKey: ['panel-usuarios'], queryFn: listarUsuarios })
  const catalogos = useQuery({ queryKey: ['panel-catalogos'], queryFn: verCatalogos })

  return (
    <>
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

      <SelectorDeModalidad
        valor={datos.modalidad}
        alCambiar={poner('modalidad')}
        guardada={guardada}
        error={errores.modalidad}
      />
      <SelectorDeCiudad
        valor={datos.ciudadUbigeo}
        alCambiar={poner('ciudadUbigeo')}
        guardada={guardada}
        error={errores.ciudadUbigeo}
      />
      <Campo etiqueta="Horario" valor={datos.horario} alCambiar={poner('horario')} />
      <Campo
        etiqueta="Zona o referencia (opcional)"
        valor={datos.ubicacion}
        alCambiar={poner('ubicacion')}
        pista="Barrio, distrito o dirección. Se ve en la ficha de la vacante"
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
    </>
  )
}

/**
 * «Modalidad»: Presencial, Híbrido o Remoto.
 *
 * El `<select>` marca la opción equivalente a lo guardado —«PRESENCIAL» marca
 * Presencial— pero `valor` sigue siendo el texto guardado hasta que alguien elige
 * otra opción. Ver el encabezado del archivo.
 */
function SelectorDeModalidad({
  valor,
  alCambiar,
  guardada,
  error,
}: {
  valor: string
  alCambiar: (valor: string) => void
  guardada?: VacantePanel
  error?: string
}) {
  const marcada = opcionDeModalidad(valor)
  const creando = guardada === undefined
  const esDeLasTres = (MODALIDADES as readonly string[]).includes(marcada)
  const rara = marcada !== '' && !esDeLasTres
  const opciones = [
    ...(rara ? [{ valor: marcada, texto: `${marcada} (valor anterior)` }] : []),
    ...MODALIDADES.map((m) => ({ valor: m, texto: m })),
  ]
  return (
    <Selector
      etiqueta="Modalidad"
      valor={marcada}
      alCambiar={alCambiar}
      opciones={opciones}
      // Al crear, «Elige…»; en una vacante vieja sin modalidad, «Sin indicar», que
      // se puede guardar tal cual. Con una guardada, no hay opción vacía.
      sinVacio={!creando && marcada !== ''}
      textoVacio={creando ? 'Elige…' : 'Sin indicar'}
      pista={rara ? 'Elige una de las tres para que el portal pueda filtrarla' : undefined}
      error={error}
    />
  )
}

/**
 * «Ciudad»: las provincias del catálogo agrupadas por departamento, con «Fuera
 * del Perú» al final. Las mismas que el registro del candidato, del mismo
 * endpoint público.
 */
function SelectorDeCiudad({
  valor,
  alCambiar,
  guardada,
  error,
}: {
  valor: string
  alCambiar: (valor: string) => void
  guardada?: VacantePanel
  error?: string
}) {
  const id = useId()
  const ubigeo = useQuery({ queryKey: ['catalogo-ubigeo'], queryFn: catalogoUbigeo })
  const { departamentos, sueltas } = useMemo(
    () => agrupadasPorDepartamento(Array.isArray(ubigeo.data) ? ubigeo.data : []),
    [ubigeo.data],
  )
  const creando = guardada === undefined
  // Una ciudad guardada que el catálogo ya no ofrece sigue marcada: lo que la
  // vacante tiene se ve, aunque no se pueda elegir para una nueva.
  const guardadaFueraDelCatalogo =
    guardada?.ciudad
    && ubigeo.data
    && !ubigeo.data.some((o) => o.codigo === guardada.ciudad?.codigo)
      ? guardada.ciudad
      : null
  const cargando = ubigeo.isPending
  const fallo = ubigeo.isError
  const idAyuda = `${id}-ayuda`
  const mensaje = fallo ? 'No pudimos cargar la lista de ciudades. Vuelve a intentarlo.' : error
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        Ciudad
      </label>
      <select
        id={id}
        className={estilos.entrada}
        value={valor}
        disabled={cargando || fallo}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={mensaje ? true : undefined}
        aria-describedby={mensaje ? idAyuda : undefined}
      >
        <option value="">
          {cargando ? 'Cargando…' : creando || valor !== '' ? 'Elige la ciudad…' : 'Sin indicar'}
        </option>
        {guardadaFueraDelCatalogo && (
          <option value={guardadaFueraDelCatalogo.codigo}>
            {guardadaFueraDelCatalogo.nombre} (valor anterior)
          </option>
        )}
        {departamentos.map(([departamento, provincias]) => (
          <optgroup key={departamento} label={departamento}>
            {provincias.map((provincia) => (
              <option key={provincia.codigo} value={provincia.codigo}>
                {provincia.nombre}
              </option>
            ))}
          </optgroup>
        ))}
        {/* `EXT` y cualquier otra sin departamento: sueltas al final. */}
        {sueltas.map((opcion) => (
          <option key={opcion.codigo} value={opcion.codigo}>
            {opcion.nombre}
          </option>
        ))}
      </select>
      {mensaje && (
        <span className={estilos.errorCampo} id={idAyuda}>
          {mensaje}
        </span>
      )}
    </div>
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
  /** Una línea bajo el campo que dice qué va ahí. */
  pista?: string
}

/*
 * ⚠️ La pista y el error van FUERA del `<label>` y el campo se ata por `htmlFor`.
 * Dentro del `<label>` se sumarían al nombre del campo: «Zona o referencia
 * (opcional) Barrio, distrito o dirección…» es lo que oiría un lector de pantalla
 * y lo que rompe `getByLabelText`. Fuera, y atados con `aria-describedby`, se
 * leen después del nombre, que es su sitio.
 */
export function Campo({ etiqueta, valor, alCambiar, ancho, numerico, tipo, pista }: PropsCampo) {
  const id = useId()
  return (
    <div className={`${estilos.campo}${ancho ? ` ${estilos.anchoEntero}` : ''}`}>
      <label className={estilos.etiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        className={estilos.entrada}
        type={tipo ?? 'text'}
        inputMode={numerico ? 'numeric' : undefined}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-describedby={pista ? `${id}-pista` : undefined}
      />
      {pista && (
        <span className={estilos.pista} id={`${id}-pista`}>
          {pista}
        </span>
      )}
    </div>
  )
}

export function Area({ etiqueta, valor, alCambiar, ancho }: PropsCampo) {
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
export function Selector({
  etiqueta,
  valor,
  alCambiar,
  opciones,
  sinVacio,
  cargando,
  vacio,
  textoVacio,
  pista,
  error,
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  opciones: { valor: string; texto: string }[]
  sinVacio?: boolean
  cargando?: boolean
  /** Que decir cuando la lista llego y no traia nada. */
  vacio?: string
  /** Lo que dice la opción vacía; «Elige…» si no se dice otra cosa. */
  textoVacio?: string
  /** Una línea bajo el campo. */
  pista?: string
  /** Lo que falta o está mal, bajo el campo y atado a él. */
  error?: string
}) {
  const id = useId()
  const sinNada = !cargando && opciones.length === 0
  const idPista = `${id}-pista`
  const idError = `${id}-error`
  const describe = [pista ? idPista : null, error ? idError : null].filter(Boolean).join(' ')
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <select
        id={id}
        className={estilos.entrada}
        value={valor}
        disabled={cargando || sinNada}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe || undefined}
      >
        {cargando && <option value="">Cargando…</option>}
        {sinNada && <option value="">{vacio ?? 'No hay ninguna'}</option>}
        {!cargando && !sinNada && !sinVacio && <option value="">{textoVacio ?? 'Elige…'}</option>}
        {!cargando &&
          opciones.map((o) => (
            <option value={o.valor} key={o.valor}>
              {o.texto}
            </option>
          ))}
      </select>
      {pista && (
        <span className={estilos.pista} id={idPista}>
          {pista}
        </span>
      )}
      {error && (
        <span className={estilos.errorCampo} id={idError}>
          {error}
        </span>
      )}
    </div>
  )
}
