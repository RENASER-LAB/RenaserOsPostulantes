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
 */

import { useQuery } from '@tanstack/react-query'
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
  modalidad: string
  horario: string
  ubicacion: string
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
  tipoCierre: 'PERMANENTE',
  plazas: '',
  cierraEn: '',
}

/**
 * Lo guardado, traido al formulario.
 *
 * Los nulos se vuelven cadenas vacias: un `value={null}` convierte el input en
 * no controlado y React lo avisa en consola la primera vez que se teclea.
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

/**
 * Los campos comunes del alta y de la edicion, en el orden en que se piensan.
 *
 * Van sueltos dentro de la rejilla del formulario que los monta: un `<div>`
 * propio aqui romperia las columnas del que los usa.
 */
export function CamposComunes({
  datos,
  poner,
}: {
  datos: DatosDeVacante
  poner: (campo: keyof DatosDeVacante) => (valor: string) => void
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

      <Campo
        etiqueta="Modalidad (Presencial, Híbrido…)"
        valor={datos.modalidad}
        alCambiar={poner('modalidad')}
      />
      <Campo etiqueta="Horario" valor={datos.horario} alCambiar={poner('horario')} />
      <Campo etiqueta="Ubicación" valor={datos.ubicacion} alCambiar={poner('ubicacion')} />
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

// ---------- Piezas del formulario ----------

interface PropsCampo {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  ancho?: boolean
  numerico?: boolean
  tipo?: string
}

export function Campo({ etiqueta, valor, alCambiar, ancho, numerico, tipo }: PropsCampo) {
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
