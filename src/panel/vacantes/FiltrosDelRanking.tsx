/**
 * El botón «Filtros», su panel y las etiquetas de lo que está puesto.
 *
 * Tres decisiones que lo ordenan:
 *
 *   - **En escritorio el panel NO es un modal.** Flota anclado al botón, sin
 *     fondo apagado, y no empuja la tabla: lo que se viene a ver al filtrar es
 *     justo cómo cambia la tabla, y un modal la taparía o la desplazaría en el
 *     momento en que hay que mirarla. Los cambios se aplican al instante.
 *   - **En el teléfono SÍ es una hoja modal**: no hay sitio para flotar sin
 *     tapar la tabla entera, así que se dice con el fondo apagado que se está
 *     en otra cosa, y el foco no se escapa detrás.
 *   - **Nada de lo que filtra se esconde.** El botón lleva cuántos filtros hay
 *     puestos, debajo de la barra va una etiqueta por cada uno, y cada sección
 *     del panel dice en su título si está recortando.
 *
 * Los filtros no viven aquí: los guarda la vacante, por encima de las pestañas,
 * para que se conserven al cambiar de etapa. Este archivo solo los pinta y los
 * cambia.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ahora } from '@/dominio/reloj'
import {
  ATAJOS_DE_FECHA,
  ESTADOS_DE_LA_IA,
  POR_QUE_NO_HAY_CIUDAD,
  SIN_FILTROS,
  atajoDeFecha,
  diaDeHoy,
  hayAlgoQueBorrar,
  hayFiltroDeFecha,
  laEtapaDe,
  porQueNoHayPretension,
  rangoDeFechaAlReves,
  type CiudadDelRanking,
  type ClaveDeFiltro,
  type EstadoDeLaIa,
  type EtapaPanel,
  type FiltroActivo,
  type Filtros,
  type QueTraeLaTanda,
} from './ranking'
import estilos from './FiltrosDelRanking.module.css'

/** El corte del teléfono, el mismo de la hoja de estilos. */
const EN_EL_TELEFONO = '(max-width: 640px)'

/**
 * Si la pantalla es la del teléfono, y se entera si cambia.
 *
 * ⚠️ **La forma la decide el CSS; esto decide solo lo que el CSS no puede**: que
 * la hoja sea un modal de verdad —`aria-modal`, el foco atrapado, la página
 * quieta detrás—. Los dos miran el mismo corte, así que no pueden discrepar.
 *
 * Sin `matchMedia` —jsdom, o un WebView muy viejo— se queda en escritorio, que
 * es la forma que no atrapa a nadie.
 */
export function useEsTelefono(): boolean {
  const [es, setEs] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(EN_EL_TELEFONO).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const consulta = window.matchMedia(EN_EL_TELEFONO)
    const alCambiar = () => setEs(consulta.matches)
    alCambiar()
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])
  return es
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Lo que cuenta como «un control que alguien pulsó» al hacer clic fuera: si el
 * foco quedó en uno de estos, se queda ahí. `summary` es «Columnas».
 *
 * ⚠️ **Sin `[tabindex]` suelto (F-02).** El `tabpanel` del ranking es enfocable
 * —tabindex 0— y envuelve la barra, la tabla y la hoja: al pulsar un texto
 * suyo, o el fondo apagado del teléfono, el navegador le da el foco a él, y un
 * contenedor que envuelve el clic no es el control que se pulsó. Un elemento
 * con tabindex cuenta solo si además tiene rol de control.
 */
const CONTROLES = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  ...[
    'button',
    'checkbox',
    'combobox',
    'link',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'radio',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'textbox',
  ].map((rol) => `[role="${rol}"]`),
].join(', ')

/** Lo que el panel deja libre hasta el borde de la ventana: el `2rem` del CSS, repartido. */
const MARGEN_CON_LA_VENTANA = 16
/** Un número escrito a mano, o nada. Una caja vacía es «sin límite», no un cero. */
const aCifra = (valor: string): number | null => {
  const limpio = valor.trim()
  if (limpio === '') return null
  const cifra = Number(limpio)
  return Number.isFinite(cifra) ? cifra : null
}

/**
 * El punto que dice «esta sección está recortando».
 *
 * Neutro, en tinta: el violeta de esta pantalla es «Avanzar», que es «te toca a
 * ti», y un filtro puesto no le pide nada a nadie. Lleva su frase para el lector
 * de pantalla, porque un punto no se lee.
 */
function Puesto({ si }: { si: boolean }) {
  if (!si) return null
  return (
    <>
      <span className={estilos.marcaPuesto} aria-hidden="true" />
      {/* Con la coma delante y no un espacio: hay lectores que recortan el
          espacio inicial de cada trozo y pegarían «IA(filtrando)». */}
      <span className="solo-lectores">, filtrando</span>
    </>
  )
}

interface Props {
  etapa: EtapaPanel
  filtros: Filtros
  alCambiar: (f: Filtros) => void
  /** Las ciudades que de verdad hay en la tanda. Vacío: todavía no hay ninguna. */
  ciudades: CiudadDelRanking[]
  trae: QueTraeLaTanda
  /** Cuántas filas hay en cada estado de la IA, de la tanda sin filtrar. */
  calificaciones: Record<EstadoDeLaIa, number>
  cuantasSeVen: number
  cuantasHabia: number
  /** La cifra de la insignia: cuántas etiquetas hay debajo de la barra. */
  cuantosPuestos: number
  /**
   * El botón, desde fuera: al quitar una etiqueta el foco vuelve aquí, y la
   * etiqueta que lo tenía ya no existe.
   */
  boton: RefObject<HTMLButtonElement | null>
}

export function FiltrosDelRanking({
  etapa,
  filtros,
  alCambiar,
  ciudades,
  trae,
  calificaciones,
  cuantasSeVen,
  cuantasHabia,
  cuantosPuestos,
  boton,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  /** Cuánto se corre el panel a la izquierda para no salirse de la ventana. */
  const [corrimiento, setCorrimiento] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const enElTelefono = useEsTelefono()
  const id = useId()
  const idAviso = `${id}-aviso-fecha`

  const cambiar = (parte: Partial<Filtros>) => alCambiar({ ...filtros, ...parte })

  /*
    Cerrar devuelve el foco al botón —Esc, «Listo», o un clic fuera que no cayó
    en otro control—, y lo devuelve SIN desplazar la página.

    ⚠️ **`preventScroll` no es un detalle.** Con la tabla recorrida, el botón
    queda arriba, fuera de la ventana; un `focus()` a secas subía la página hasta
    él en mitad del clic, y el clic acababa en otra fila o se perdía (F-03).
  */
  const cerrarRef = useRef<(devolverFoco?: boolean) => void>(() => {})
  cerrarRef.current = (devolverFoco = true) => {
    setAbierto(false)
    if (devolverFoco) boton.current?.focus({ preventScroll: true })
  }

  /*
    En escritorio el panel sale del botón hacia la derecha. Si el botón está
    lejos del borde izquierdo y la ventana es estrecha —una tableta en vertical—,
    se saldría por la derecha y crearía scroll horizontal (F-05): se corre a la
    izquierda lo justo, sin pasar del borde izquierdo. En el teléfono es una hoja
    a ancho completo y esto no aplica.
  */
  useLayoutEffect(() => {
    if (!abierto || enElTelefono) {
      setCorrimiento(0)
      return
    }
    function encajar() {
      const elPanel = panel.current
      const ancla = elPanel?.offsetParent
      if (!elPanel || !(ancla instanceof HTMLElement)) return
      const ventana = document.documentElement.clientWidth
      const desde = ancla.getBoundingClientRect().left
      const sobra = desde + elPanel.offsetWidth - (ventana - MARGEN_CON_LA_VENTANA)
      setCorrimiento(sobra > 0 ? Math.max(0, Math.min(sobra, desde - MARGEN_CON_LA_VENTANA)) : 0)
    }
    encajar()
    window.addEventListener('resize', encajar)
    return () => window.removeEventListener('resize', encajar)
  }, [abierto, enElTelefono])

  useEffect(() => {
    if (!abierto) return
    // Al abrir, el foco entra: con teclado, el panel tiene que ser alcanzable
    // sin recorrer la página entera.
    panel.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()

    const esDelPanel = (nodo: Node) =>
      !!(panel.current?.contains(nodo) || boton.current?.contains(nodo))

    /*
      Con qué se movió la persona por última vez. El foco que sale del panel
      cierra solo si salió con el teclado: con el puntero, lo cierra el clic, y
      cerrar antes —al bajar el dedo— desmonta el panel en mitad del gesto.

      Empieza en «no»: hasta que se pulse una tecla con el panel abierto, un foco
      que sale lo ha movido el código, no la persona, y no es salir del panel.
    */
    let conTeclado = false
    /** Si el gesto en curso empezó fuera del panel. */
    let gestoFuera = false

    function alUsarTeclado() {
      conTeclado = true
    }

    function alPulsarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        cerrarRef.current()
        return
      }
      // Solo la hoja del teléfono atrapa el foco: en escritorio el panel no es
      // modal, y salir de él con Tab es tan legítimo como hacer clic fuera.
      if (!enElTelefono || e.key !== 'Tab' || !panel.current) return
      const dentro = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (dentro.length === 0) return
      const primero = dentro[0]!
      const ultimo = dentro[dentro.length - 1]!
      // El panel mismo tiene el foco si se pulsó un texto suyo: Mayús+Tab desde
      // ahí saldría a «Filtros», detrás de la hoja.
      const enElBorde = document.activeElement === panel.current
      if (e.shiftKey && (document.activeElement === primero || enElBorde)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (document.activeElement === ultimo || enElBorde)) {
        e.preventDefault()
        primero.focus()
      }
    }

    function alApretar(e: PointerEvent) {
      conTeclado = false
      const donde = e.target as Node | null
      gestoFuera = !!donde && !esDelPanel(donde)
    }

    /*
      Un clic fuera cierra en el `click` y no en el `pointerdown`.

      ⚠️ **Cerrar al bajar el dedo robaba el clic (F-03).** Al desmontarse, el
      panel acorta la página; si estaba bajada, el navegador la recoge y lo que
      había bajo el puntero al soltar ya es otra cosa: la casilla no se marcaba y
      el primer «Descargar Excel» no bajaba nada. En el `click` el destino ya está
      decidido, y este cierre va en fase de captura, antes que el de React.

      Solo cuenta si el gesto EMPEZÓ fuera: arrastrar para seleccionar el texto
      de un campo y soltar fuera no es salir del panel. Pulsar «Filtros» tampoco:
      ese clic ya cierra por su cuenta.

      Si el foco quedó en un control —la casilla, la búsqueda, «Columnas»—, es
      el que se pulsó y se queda ahí. Si quedó en nada —un título— o en un
      contenedor —el `tabpanel` del ranking, que el navegador enfoca al pulsar
      un texto de la tabla o el fondo apagado de la hoja—, vuelve a «Filtros»
      (F-02). Ver `CONTROLES`.
    */
    function alHacerClic(e: MouseEvent) {
      const empezoFuera = gestoFuera
      gestoFuera = false
      const donde = e.target as Node | null
      if (!empezoFuera || !donde || esDelPanel(donde)) return
      const activo = document.activeElement
      const pulsoUnControl =
        activo instanceof HTMLElement &&
        activo !== document.body &&
        !esDelPanel(activo) &&
        activo.matches(CONTROLES)
      cerrarRef.current(!pulsoUnControl)
    }

    /*
      Salir del panel con Tab lo cierra, como un clic fuera (F-04): abierto en
      escritorio tapa la tabla, y el foco caía en controles que quedaban debajo.
      El foco se queda donde lo llevó la persona. Volver a «Filtros» con
      Mayús+Tab no es salir: el panel sigue colgando de él.
    */
    function alEntrarElFoco(e: FocusEvent) {
      const donde = e.target as Node | null
      if (!conTeclado || !donde || esDelPanel(donde)) return
      cerrarRef.current(false)
    }

    document.addEventListener('keydown', alUsarTeclado, true)
    document.addEventListener('keydown', alPulsarTecla)
    document.addEventListener('pointerdown', alApretar, true)
    document.addEventListener('click', alHacerClic, true)
    document.addEventListener('focusin', alEntrarElFoco)
    // En el teléfono la página no se mueve detrás de la hoja.
    const antes = document.body.style.overflow
    if (enElTelefono) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alUsarTeclado, true)
      document.removeEventListener('keydown', alPulsarTecla)
      document.removeEventListener('pointerdown', alApretar, true)
      document.removeEventListener('click', alHacerClic, true)
      document.removeEventListener('focusin', alEntrarElFoco)
      document.body.style.overflow = antes
    }
  }, [abierto, enElTelefono, boton])

  const laEtapa = laEtapaDe(etapa)
  const alReves = rangoDeFechaAlReves(filtros)
  const nota = filtros.notaMin != null || filtros.notaMax != null
  const pretension = filtros.pretensionMin != null || filtros.pretensionMax != null

  return (
    <div className={estilos.ancla}>
      <button
        ref={boton}
        type="button"
        className={estilos.boton}
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => (abierto ? cerrarRef.current() : setAbierto(true))}
      >
        Filtros
        {cuantosPuestos > 0 && (
          <span className={estilos.insignia} data-cifra>
            <span aria-hidden="true">{cuantosPuestos}</span>
            <span className="solo-lectores">
              {/* «activos» y no «puestos»: en esta pantalla un puesto es un
                  puesto de trabajo. */}
              {`, ${cuantosPuestos} ${cuantosPuestos === 1 ? 'activo' : 'activos'}`}
            </span>
          </span>
        )}
        <svg
          className={estilos.pliegue}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>

      {abierto && (
        <>
          {/* Solo se ve en el teléfono: en escritorio el panel no apaga nada. */}
          <div className={estilos.fondo} aria-hidden="true" />
          {/*
            `tabIndex={-1}`: pulsar un texto del panel —un título, «Se ven X de
            Y»— le da el foco al panel y no al `tabpanel` que lo envuelve, que
            era el primer antepasado enfocable. Sin esto el foco salía de la
            hoja modal con un simple toque, y el Tab siguiente la cerraba.
          */}
          <div
            ref={panel}
            id={id}
            className={estilos.panel}
            style={!enElTelefono && corrimiento > 0 ? { left: -corrimiento } : undefined}
            role="dialog"
            aria-modal={enElTelefono}
            aria-label="Filtros"
            tabIndex={-1}
          >
            <p className={estilos.tituloHoja} aria-hidden="true">
              Filtros
            </p>
            <div className={estilos.cuerpo}>
              {/* ---------- Fecha de postulación ---------- */}
              <fieldset className={estilos.seccion}>
                <legend className={estilos.tituloSeccion}>
                  Fecha de postulación
                  <Puesto si={hayFiltroDeFecha(filtros)} />
                </legend>
                <div className={estilos.modos} role="radiogroup" aria-label="Cómo se elige la fecha">
                  <label className={estilos.opcion}>
                    <input
                      type="radio"
                      name={`${id}-modo`}
                      checked={filtros.fechaModo === 'dia'}
                      onChange={() => cambiar({ fechaModo: 'dia' })}
                    />
                    Un día
                  </label>
                  <label className={estilos.opcion}>
                    <input
                      type="radio"
                      name={`${id}-modo`}
                      checked={filtros.fechaModo === 'rango'}
                      onChange={() => cambiar({ fechaModo: 'rango' })}
                    />
                    Rango
                  </label>
                </div>

                {filtros.fechaModo === 'dia' ? (
                  <label className={estilos.campoFecha}>
                    <span>Día</span>
                    <input
                      className={estilos.fecha}
                      type="date"
                      aria-label="Postulados el día"
                      value={filtros.fechaDia ?? ''}
                      onChange={(e) => cambiar({ fechaDia: e.target.value || null })}
                    />
                  </label>
                ) : (
                  <div className={estilos.rangoFechas}>
                    {/*
                      Los dos campos señalan el aviso: cualquiera de los dos puede
                      ser el que está mal, y quien lee con lector de pantalla oye
                      el problema en el campo donde está.
                    */}
                    <label className={estilos.campoFecha}>
                      <span>Desde</span>
                      <input
                        className={alReves ? estilos.fechaMal : estilos.fecha}
                        type="date"
                        aria-label="Postulados desde"
                        aria-invalid={alReves || undefined}
                        aria-describedby={alReves ? idAviso : undefined}
                        value={filtros.fechaDesde ?? ''}
                        onChange={(e) => cambiar({ fechaDesde: e.target.value || null })}
                      />
                    </label>
                    <label className={estilos.campoFecha}>
                      <span>Hasta</span>
                      <input
                        className={alReves ? estilos.fechaMal : estilos.fecha}
                        type="date"
                        aria-label="Postulados hasta"
                        aria-invalid={alReves || undefined}
                        aria-describedby={alReves ? idAviso : undefined}
                        value={filtros.fechaHasta ?? ''}
                        onChange={(e) => cambiar({ fechaHasta: e.target.value || null })}
                      />
                    </label>
                  </div>
                )}
                {/*
                  ⚠️ **Al revés no se aplica, y se dice junto a los campos.**
                  Aplicado vaciaría la tabla sin explicación; girado en silencio
                  adivinaría lo que alguien quiso escribir. El aviso dice el
                  problema y cómo se arregla, no «fecha inválida».
                */}
                {alReves && (
                  <p id={idAviso} className={estilos.aviso} role="alert">
                    «Desde» es posterior a «Hasta», así que el filtro de fecha no se aplica.
                    Cambia una de las dos fechas.
                  </p>
                )}
                <div className={estilos.atajos}>
                  {ATAJOS_DE_FECHA.map(({ atajo, rotulo }) => (
                    <button
                      key={atajo}
                      type="button"
                      className={estilos.atajo}
                      onClick={() => {
                        // El día de hoy es el del navegador, con la hora del
                        // servidor: un reloj local adelantado no cambia de día.
                        const { desde, hasta } = atajoDeFecha(atajo, diaDeHoy(ahora()))
                        cambiar({ fechaModo: 'rango', fechaDesde: desde, fechaHasta: hasta })
                      }}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <p className={estilos.pista}>Quien no tiene fecha queda fuera.</p>
              </fieldset>

              {/* ---------- Calificación con IA ---------- */}
              <fieldset className={estilos.seccion}>
                <legend className={estilos.tituloSeccion}>
                  Calificación con IA
                  <Puesto si={filtros.calificacion.length > 0} />
                </legend>
                <div className={estilos.casillas}>
                  {ESTADOS_DE_LA_IA.map((estado) => {
                    const marcada = filtros.calificacion.includes(estado.codigo)
                    return (
                      <label key={estado.codigo} className={estilos.opcion}>
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() =>
                            cambiar({
                              calificacion: marcada
                                ? filtros.calificacion.filter((c) => c !== estado.codigo)
                                : [...filtros.calificacion, estado.codigo],
                            })
                          }
                        />
                        {estado.nombre}
                        <span className={estilos.cuenta} data-cifra>
                          {calificaciones[estado.codigo]}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {/*
                  ⚠️ **Fuera del perfil integral hay que decirlo.** El estado sale
                  de la cola que califica el CURRÍCULUM, no de la etapa que se
                  mira: en la prueba del puesto, «Calificada» no dice nada de la
                  prueba.
                */}
                {etapa !== 'PERFIL_INTEGRAL' && (
                  <p className={estilos.pista}>Es la calificación del currículum.</p>
                )}
              </fieldset>

              {/* ---------- Ciudad ---------- */}
              <fieldset className={estilos.seccion}>
                <legend className={estilos.tituloSeccion}>
                  Ciudad
                  <Puesto si={filtros.ciudades.length > 0} />
                </legend>
                {/*
                  Si nadie tiene ciudad, aquí no va un control vacío: la ciudad
                  solo se le pide a quien crea cuenta desde ahora, y servirla del
                  catálogo de ubigeo ofrecería 196 filtros que no devuelven a
                  nadie. Se dice lo que pasa.
                */}
                {ciudades.length === 0 ? (
                  <p className={estilos.porQueNoSale}>{POR_QUE_NO_HAY_CIUDAD}</p>
                ) : (
                  <div className={estilos.chips}>
                    {ciudades.map((ciudad) => {
                      const marcada = filtros.ciudades.includes(ciudad.codigo)
                      return (
                        <button
                          key={ciudad.codigo}
                          type="button"
                          className={marcada ? estilos.chipMarcado : estilos.chip}
                          aria-pressed={marcada}
                          onClick={() =>
                            cambiar({
                              ciudades: marcada
                                ? filtros.ciudades.filter((c) => c !== ciudad.codigo)
                                : [...filtros.ciudades, ciudad.codigo],
                            })
                          }
                        >
                          {ciudad.nombre}
                          <span className={estilos.cuenta} data-cifra>
                            {ciudad.cuantas}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </fieldset>

              {/* ---------- Nota de la etapa ---------- */}
              <fieldset className={estilos.seccion}>
                {/* El nombre de la nota de ESTA etapa: el filtro se conserva al
                    cambiar de pestaña y habla siempre de la que se mira. */}
                <legend className={estilos.tituloSeccion}>
                  {laEtapa.nota}
                  <Puesto si={nota} />
                </legend>
                <div className={estilos.rango}>
                  <input
                    className={estilos.cifra}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    aria-label={`${laEtapa.nota}, desde`}
                    placeholder="desde"
                    value={filtros.notaMin ?? ''}
                    onChange={(e) => cambiar({ notaMin: aCifra(e.target.value) })}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    className={estilos.cifra}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    aria-label={`${laEtapa.nota}, hasta`}
                    placeholder="hasta"
                    value={filtros.notaMax ?? ''}
                    onChange={(e) => cambiar({ notaMax: aCifra(e.target.value) })}
                  />
                </div>
                <p className={estilos.pista}>Quien no tiene nota queda fuera.</p>
              </fieldset>

              {/* ---------- Pretensión ---------- */}
              <fieldset className={estilos.seccion}>
                <legend className={estilos.tituloSeccion}>
                  Pretensión
                  <Puesto si={pretension} />
                </legend>
                {/*
                  Sin pretensión en la tanda no hay rango que ofrecer, y hay que
                  decir cuál de los tres motivos es: `puedeVerPretension` y
                  `vacanteMuestraSueldo` viajan para eso.
                */}
                {!trae.hayPretension ? (
                  <p className={estilos.porQueNoSale}>
                    {porQueNoHayPretension(trae.puedeVerPretension, trae.vacanteMuestraSueldo)}
                  </p>
                ) : (
                  <>
                    <div className={estilos.rango}>
                      <input
                        className={estilos.cifra}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label="Pretensión, desde"
                        placeholder="desde"
                        value={filtros.pretensionMin ?? ''}
                        onChange={(e) => cambiar({ pretensionMin: aCifra(e.target.value) })}
                      />
                      <span aria-hidden="true">–</span>
                      <input
                        className={estilos.cifra}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label="Pretensión, hasta"
                        placeholder="hasta"
                        value={filtros.pretensionMax ?? ''}
                        onChange={(e) => cambiar({ pretensionMax: aCifra(e.target.value) })}
                      />
                    </div>
                    {/* Solape y no contención: ver `filtrarFino`. */}
                    <p className={estilos.pista}>
                      Sale quien pida algo dentro de esa banda. Quien no la declaró queda fuera.
                    </p>
                  </>
                )}
              </fieldset>
            </div>

            <div className={estilos.pie}>
              <p className={estilos.seVen} data-cifra>
                Se ven {cuantasSeVen} de {cuantasHabia}
              </p>
              {/*
                ⚠️ **Apagado con `aria-disabled` y no con `disabled` (F-06).**
                Al pulsarlo se apaga él mismo, y un botón `disabled` suelta el
                foco a `<body>`: quien va con teclado salía del panel abierto
                —de la hoja modal, en el teléfono— sin haberlo pedido. Así el
                foco se queda en él, se oye que ya no hay nada que borrar, y
                pulsarlo de nuevo no hace nada.
              */}
              <button
                type="button"
                className={estilos.borrar}
                aria-disabled={!hayAlgoQueBorrar(filtros)}
                onClick={() => {
                  if (hayAlgoQueBorrar(filtros)) alCambiar(SIN_FILTROS)
                }}
              >
                Borrar filtros
              </button>
              <button type="button" className={estilos.listo} onClick={() => cerrarRef.current()}>
                Listo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Una etiqueta por filtro puesto, debajo de la barra, cada una con su «×».
 *
 * Sin filtros no se pinta nada —ni una fila vacía—: esa fila no ocupa sitio
 * mientras no tenga algo que decir.
 *
 * La etiqueta entera es el botón de quitar, y no solo la «×»: es un blanco de
 * 44 px en vez de uno de 16, y en el teléfono eso es la diferencia entre
 * acertar y no.
 */
export function EtiquetasDeFiltros({
  puestos,
  alQuitar,
}: {
  puestos: FiltroActivo[]
  alQuitar: (clave: ClaveDeFiltro) => void
}) {
  if (puestos.length === 0) return null
  return (
    <ul className={estilos.etiquetas} aria-label="Filtros activos">
      {puestos.map((puesto) => (
        <li key={puesto.clave}>
          <button type="button" className={estilos.etiqueta} onClick={() => alQuitar(puesto.clave)}>
            {puesto.texto}
            <span className={estilos.aspa} aria-hidden="true">
              ×
            </span>
            <span className="solo-lectores"> (quitar este filtro)</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
