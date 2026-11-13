/**
 * La portada: qué es este proceso y qué vacantes hay abiertas.
 *
 * ⚠️ **13/11/2026 · estilo «Northstar».** Se recompuso con el ritmo de
 * northstar-template-demo.vercel.app: el titular enorme en Onest 400 con la
 * segunda mitad en azul, el campo de columnas punteadas detrás, y una ventana
 * del portal que entra subiendo y, al bajar, se asienta (de 1,08 a 1) mientras
 * el titular se va. Debajo, las secciones van numeradas («01 / VACANTES»), la
 * de «por qué» es la banda oscura y el pie es la noche.
 *
 * Es la única pantalla en modo Persuade —quien llega todavía no ha postulado y
 * tiene que decidir si le merece la pena—, y desde el 25/09/2026 la compone
 * «El cielo despejado»: el cielo azul detrás de la cabecera —solo aquí—, el
 * titular centrado y la acción en casi negro.
 *
 * La pieza grande es el escaparate: un marco de cristal con una ventana del
 * portal dentro y el recorrido en ella, que enseña el producto en vez de
 * decorar la pantalla.
 *
 * Lo que no cambia es la promesa: lo que ve antes de entrar es lo mismo que verá
 * después, porque el recorrido se dibuja igual aquí que dentro del portal.
 *
 * Se ve sin cuenta. `GET /vacantes` es público.
 *
 * Desde el 25/09/2026 la sección de vacantes enseña **las tres más recientes** y
 * manda a `/vacantes`, que es donde se busca, se filtra y se ordena. Los enlaces
 * viejos a `/#vacantes-abiertas` siguen cayendo en esa sección.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { listarVacantes } from '@/api/portal'
import { ETAPAS } from '@/dominio/estados'
import { ahora as ahoraDelServidor } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { AlAsomarse } from '@/ui/movimiento'
import { Marca } from '@/ui/Marca'
import { IconoLupa, IconoMaletin, IconoDocumento, IconoPersonas, IconoCandado, IconoAviso } from '@/ui/Iconos'
import { FondoDeLaPortada } from './FondoDeLaPortada'
import { ciudadesDistintas, indexar, porFecha, publicadaHace } from './busqueda'
import { Tarjeta } from './Tarjeta'
import estilos from './Vacantes.module.css'

/** Cuántas enseña la portada; el resto vive en `/vacantes`. */
const RECIENTES = 3

/** Qué hace el candidato en cada etapa. Es texto de producto, no dato. */
const QUE_ES: Record<string, string> = {
  PERFIL: 'Currículum y preguntas para conocerte.',
  PRUEBA: 'Demuestra tus habilidades.',
  SIMULACION: 'Dos horas con el equipo, fecha que eliges.',
  VALIDACION: 'Un periodo corto trabajando de verdad. Pagado.',
  DECISION: 'Decide una persona, no un puntaje.',
}

/**
 * Las tres cosas que distinguen a este proceso, con una maqueta cada una.
 *
 * ⚠️ **Las tres son reglas del producto, no logros.** La portada no tiene
 * testimonios ni número de contratados a propósito —el sistema no ha pasado por
 * su primer candidato real—, y estas tarjetas no son la puerta de atrás para
 * meterlos: cada una se puede comprobar hoy mismo en el portal.
 *
 * La cuarta etapa, que es un periodo pagado, **no está aquí a propósito**: ya lo
 * dice el escaparate, y darle el tamaño de una tarjeta convierte una línea del
 * recorrido en una promesa destacada de dinero.
 */
const LO_NUESTRO = [
  {
    clave: 'curriculum',
    titulo: 'Tu currículum no te descarta',
    texto:
      'Entra al proceso y lo lee una persona, pero por diseño no cierra tu postulación. Lo único que la cierra en el acto es no cumplir un requisito indispensable.',
  },
  {
    clave: 'sin-cuenta',
    titulo: 'Mirar no exige cuenta',
    texto:
      'Puedes ver las vacantes abiertas, leer una ficha entera y leer los textos legales sin registrarte. La cuenta se crea recién cuando decides postular.',
  },
  {
    clave: 'persona',
    titulo: 'Decide una persona, no un puntaje',
    texto:
      'Una inteligencia artificial ayuda a ordenar y a resumir, pero no elige. Al final del recorrido mira alguien del equipo, y mira todo lo que hiciste.',
  },
] as const

/** Lo que casi todo el mundo pregunta antes de postular. */
const PREGUNTAS = [
  {
    q: '¿Necesito cuenta para mirar?',
    a: 'No. Puedes ver las vacantes abiertas, leer una ficha completa y leer los textos legales sin registrarte. La cuenta se crea recién cuando decides postular.',
  },
  {
    q: '¿Cuánto dura todo el proceso?',
    a: 'Depende de la vacante: cada empresa pone sus propios plazos, y los que todavía no están definidos no te los inventamos. No tienes que estar pendiente — cada vez que te toque algo te avisamos, y hasta entonces no hay nada que hacer de tu lado.',
  },
  {
    q: '¿Mi currículum me puede descartar?',
    a: 'No. Entra al proceso, pero por diseño no descarta a nadie. Lo único que cierra una postulación en el acto es no cumplir un requisito indispensable.',
  },
  {
    q: '¿Veo mi puntaje?',
    a: 'No. Verás en qué etapa estás y si tienes algo pendiente, nada más. La decisión final la toma una persona mirando todo el recorrido.',
  },
]

/** La curva de entrada de la referencia, la misma que `--salida`. */
const SALIDA = [0.16, 1, 0.3, 1] as const

/** «01 / VACANTES»: la etiqueta de sección de la referencia. */
function Etiqueta({ numero, children }: { numero: string; children: ReactNode }) {
  return (
    <p className={estilos.etiqueta}>
      {numero} / {children}
    </p>
  )
}

export function Vacantes() {
  const consulta = useQuery({ queryKey: ['vacantes'], queryFn: listarVacantes })
  // Lo que llegue por la red no puede dar por hecho que tiene la forma
  // prometida: un cuerpo que no sea lista reventaba la pantalla entera.
  const vacantes = useMemo(
    () => (Array.isArray(consulta.data) ? consulta.data : []),
    [consulta.data],
  )
  // Ciudades de verdad, del catálogo: «Selva Alegre» es un barrio y no cuenta, y
  // las que no dicen ciudad tampoco.
  const ciudades = ciudadesDistintas(vacantes)
  // Las tres más recientes, con las que no tienen fecha al final; y la hora del
  // servidor tomada al llegar los datos, para el «Publicada hace…» de cada una.
  const recientes = useMemo(() => [...indexar(vacantes)].sort(porFecha).slice(0, RECIENTES), [vacantes])
  const ahora = useMemo(() => ahoraDelServidor(), [consulta.dataUpdatedAt])

  return (
    <div className={estilos.pagina}>
      <Portada />

      {/*
        La cinta dice cifras verdaderas y solo verdaderas. No hay testimonios ni
        numero de contratados: el sistema todavia no ha pasado por su primer
        candidato real y inventarlos seria mentir en la portada.
      */}
      <section className={estilos.seccion} aria-label="El portal en cifras">
        <AlAsomarse variante="subir">
          <ul className={estilos.cinta} role="list">
            <li>
              <span className={estilos.cintaIndice}>01</span>
              <b data-cifra="">{vacantes.length}</b>
              <span>{vacantes.length === 1 ? 'Puesto abierto' : 'Puestos abiertos'}</span>
            </li>
            <li>
              <span className={estilos.cintaIndice}>02</span>
              <b data-cifra="">{ciudades}</b>
              <span>{ciudades === 1 ? 'Ciudad' : 'Ciudades'}</span>
            </li>
            <li>
              <span className={estilos.cintaIndice}>03</span>
              <b data-cifra="">0</b>
              <span>Descartes por currículum</span>
            </li>
            <li>
              <span className={estilos.cintaIndice}>04</span>
              <b>Sin cuenta</b>
              <span>Para mirar</span>
            </li>
          </ul>
        </AlAsomarse>
      </section>

      <section className={estilos.seccion} aria-labelledby="vacantes-abiertas">
        <AlAsomarse variante="subir">
          <div className={estilos.cabeceraSeccion}>
            <Etiqueta numero="01">Vacantes</Etiqueta>
            <h2 id="vacantes-abiertas">Vacantes abiertas</h2>
          </div>
        </AlAsomarse>

        {consulta.isPending && (
          <div className={estilos.marco} aria-busy="true">
            <h3>Buscando vacantes…</h3>
            <div className={estilos.barra} />
            <div className={`${estilos.barra} ${estilos.barraMedia}`} />
            <div className={`${estilos.barra} ${estilos.barraCorta}`} />
          </div>
        )}

        {consulta.isError && (
          <div className={estilos.marco}>
            <h3>No pudimos cargar las vacantes.</h3>
            <p className={estilos.marcoTexto}>
              {consulta.error instanceof Error
                ? consulta.error.message
                : 'No pudimos conectar con el servidor.'}
            </p>
            <button
              type="button"
              className={estilos.reintentar}
              onClick={() => void consulta.refetch()}
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {!consulta.isPending && !consulta.isError && vacantes.length === 0 && (
          <div className={estilos.marco}>
            <h3>Ahora mismo no hay vacantes abiertas.</h3>
            <p className={estilos.marcoTexto}>
              Publicamos convocatorias nuevas con frecuencia. Vuelve por aquí en unos días.
            </p>
          </div>
        )}

        {vacantes.length > 0 && (
          <AlAsomarse variante="subir">
            <ul className={estilos.lista} role="list" aria-label="Vacantes más recientes">
              {recientes.map((v) => (
                <li key={v.vacante.id}>
                  <Tarjeta vacante={v.vacante} publicada={publicadaHace(v.publicadaEn, ahora)} />
                </li>
              ))}
            </ul>
            {/*
              Todas viven en `/vacantes`, donde se busca y se filtra. Aquí van las
              tres más recientes: la portada es para decidir si merece la pena.
            */}
            <div className={estilos.verTodasLasVacantes}>
              <Link className={estilos.verTodas} to={rutas.vacantes()}>
                Ver las {vacantes.length} vacantes
              </Link>
            </div>
          </AlAsomarse>
        )}
      </section>

      {/*
        La banda de «Por qué aquí», en la noche de la referencia. Va DESPUÉS de
        las vacantes: quien llega a un portal de empleo viene a ver puestos.
      */}
      <section className={estilos.banda} aria-labelledby="por-que-aqui">
        <div className={estilos.bandaDentro}>
          <AlAsomarse variante="subir">
            <div className={estilos.cabeceraSeccion}>
              <Etiqueta numero="02">Por qué aquí</Etiqueta>
              <h2 id="por-que-aqui">Por qué este proceso es distinto</h2>
              <p>Tres reglas que puedes comprobar hoy mismo, sin cuenta.</p>
            </div>
          </AlAsomarse>

          <ul className={estilos.rejillaTres} role="list">
            {LO_NUESTRO.map((cosa, i) => (
              <li key={cosa.clave}>
                <AlAsomarse variante="subir" retraso={0.08 * i} className={estilos.tarjetaNuestra}>
                  <Maqueta que={cosa.clave} />
                  <div className={estilos.textosNuestra}>
                    <h3 className={estilos.tituloNuestra}>{cosa.titulo}</h3>
                    <p className={estilos.textoNuestra}>{cosa.texto}</p>
                  </div>
                </AlAsomarse>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${estilos.seccion} ${estilos.seccionPreguntas}`} aria-labelledby="preguntas-frecuentes">
        <AlAsomarse variante="subir">
          <div className={estilos.cabeceraSeccion}>
            <Etiqueta numero="03">Preguntas</Etiqueta>
            <h2 id="preguntas-frecuentes">Preguntas frecuentes</h2>
            <p>Lo que casi todo el mundo pregunta antes de postular.</p>
          </div>
        </AlAsomarse>

        {/*
          `<details>` nativo: el plegable, el teclado y el lector de pantalla
          vienen gratis. Todas cerradas de entrada: lo que se ve primero tiene que
          ser la lista de preguntas.
        */}
        <AlAsomarse variante="subir" className={estilos.preguntas}>
          {PREGUNTAS.map((p, i) => (
            <details className={estilos.pregunta} key={p.q}>
              <summary>
                <span className={estilos.indicePregunta} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={estilos.textoPregunta}>{p.q}</span>
                <span className={estilos.mas} aria-hidden="true" />
              </summary>
              <p>{p.a}</p>
            </details>
          ))}
        </AlAsomarse>
      </section>

      <section id="empezamos" className={estilos.cierre} aria-labelledby="titulo-cierre">
        <FondoDeLaPortada className={estilos.campoCierre} />
        <div className={estilos.veloCierre} aria-hidden="true" />
        <AlAsomarse variante="subir" className={estilos.cajaCierre}>
          <h2 id="titulo-cierre">
            ¿<span className={estilos.resalte}>Empezamos</span>?
          </h2>
          <p>
            Elige un puesto, lee sus requisitos y postula. Lo demás te lo vamos contando en
            pantalla, paso a paso.
          </p>
          <div className={estilos.acciones}>
            <Link className={estilos.accionPrincipal} to={rutas.vacantes()}>
              Ver las vacantes abiertas
            </Link>
            <Link className={estilos.accionSecundaria} to={rutas.procesos()}>
              Entrar a mis procesos
            </Link>
          </div>
        </AlAsomarse>
      </section>
    </div>
  )
}

/**
 * La primera pantalla: el titular, el campo punteado detrás y la ventana del
 * portal.
 *
 * El movimiento es el «container scroll» de la referencia:
 *
 *   - Al cargar, el titular sube 10 px y aparece, y la ventana entra desde 64 px
 *     más abajo y al 94 % (1,2 s con la curva de salida: es lo primero que se
 *     ve y solo una vez por visita, así que puede ser larga).
 *   - Al bajar, la sección mide 170 vh (160 en el teléfono) y su interior va
 *     pegado: el titular sube 48 px fundiéndose y la ventana pasa de 1,08 a 1
 *     y de 96 px a -180, así que sube a ocupar el sitio del titular. Son los
 *     valores medidos en la referencia. Todo `transform` y `opacity`.
 *   - Con menos movimiento no hay nada de eso: la sección mide lo que su
 *     contenido y todo está quieto en su sitio final.
 */
function Portada() {
  const quieto = useReducedMotion() ?? false
  const seccion = useRef<HTMLElement>(null)
  const movil = usarTelefono()
  // Medido en la referencia: sobre el alto de la sección, la ventana termina de
  // asentarse al 41 % y el titular se ha ido al 32 %. En el teléfono la
  // ventana empieza menos crecida (1,06 y 72 px) y sube menos (-130).
  const { scrollYProgress } = useScroll({ target: seccion, offset: ['start start', 'end start'] })
  const escala = useTransform(scrollYProgress, [0, 0.41], movil ? [1.06, 1] : [1.08, 1])
  const bajada = useTransform(scrollYProgress, [0, 0.41], movil ? [72, -130] : [96, -180])
  const subida = useTransform(scrollYProgress, [0, 0.33], [0, -48])
  // ⚠️ Con función y no con rangos: con rangos, motion le pasa la opacidad a un
  // ScrollTimeline del navegador que en Chromium sin cabeza se quedaba en 1.
  const desvanecido = useTransform(scrollYProgress, (p) => Math.min(1, Math.max(0, 1 - (p - 0.02) / 0.29)))

  return (
    <section
      ref={seccion}
      className={`${estilos.portada} ${quieto ? estilos.portadaQuieta : ''}`}
      aria-labelledby="titulo-portada"
    >
      <div className={estilos.portadaPegada}>
        <div className={estilos.campo} aria-hidden="true">
          <FondoDeLaPortada className={estilos.lienzo} />
          <div className={estilos.luz} />
          <div className={estilos.grano} />
        </div>

        <div className={estilos.portadaDentro}>
          <motion.div
            className={estilos.capaTitular}
            style={quieto ? undefined : { y: subida, opacity: desvanecido }}
          >
            <motion.div
              className={estilos.titularYAcciones}
              initial={quieto ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: SALIDA }}
            >
              <h1 id="titulo-portada" className={estilos.entrada}>
                <span>Tu próximo trabajo</span>{' '}
                <span className={estilos.resalte}>puede empezar aquí.</span>
              </h1>
              <p className={estilos.bajada}>
                Cinco etapas para conocer cómo trabajas. Tu currículum no te descarta, y mirar
                no exige cuenta.
              </p>
              <div className={estilos.acciones}>
                <Link className={estilos.accionPrincipal} to={rutas.vacantes()}>
                  Ver las vacantes abiertas
                </Link>
                {/* En el teléfono se esconde, como el segundo botón de la referencia:
                    «Mis procesos» está a un toque en el menú y en el cierre. */}
                <Link className={estilos.accionSoloAncha} to={rutas.procesos()}>
                  Ya postulé antes
                </Link>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className={estilos.capaVentana}
            style={quieto ? undefined : { scale: escala, y: bajada }}
          >
            <div className={estilos.entradaVentana}>
              <Ventana />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/** Si la pantalla es de teléfono (hasta 767 px, el corte `md` de la referencia). */
function usarTelefono() {
  const consulta = '(max-width: 767px)'
  const [es, setEs] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const lista = window.matchMedia(consulta)
    const alCambiar = () => setEs(lista.matches)
    lista.addEventListener('change', alCambiar)
    return () => lista.removeEventListener('change', alCambiar)
  }, [])
  return es
}

/**
 * La ventana del portal: la captura de producto de la referencia —su vista
 * «Agents», con métricas arriba, un grafo de nodos unidos por líneas y la
 * actividad en vivo a la derecha—, traducida a lo que vive quien postula: una
 * postulación avanzando por sus cinco etapas.
 *
 * ⚠️ **Lo que la rodea es decoración** —la barra con los tres puntos, la
 * columna lateral, las métricas, la actividad— y va `aria-hidden`, sin enlaces.
 * **El recorrido no**: las cinco etapas son la promesa de esta portada —lo que
 * se ve antes de entrar es lo que se verá después— y se leen como lista.
 *
 * Los datos son de ejemplo y genéricos (un puesto de «Analista de Datos», sin
 * personas): ilustran el producto, no cuentan nada de nadie.
 *
 * El movimiento, una vez por visita y después de que la ventana termina de
 * entrar: los nodos aparecen en cascada (8 px y 94 %, 500 ms, la curva de
 * salida), las líneas se funden detrás, y la actividad llega de una en una.
 * Lo único que sigue moviéndose es el trazo de la línea viva —movimiento
 * constante, lineal— y el pulso del punto de la etapa en curso. Nada de eso
 * existe con `prefers-reduced-motion`.
 */

/** El estado de cada etapa en la postulación de ejemplo. */
const ESTADO_DE_EJEMPLO: Record<string, 'hecho' | 'curso' | 'pendiente'> = {
  PERFIL: 'hecho',
  PRUEBA: 'curso',
  SIMULACION: 'pendiente',
  VALIDACION: 'pendiente',
  DECISION: 'pendiente',
}

const ROTULO_DE_ESTADO = { hecho: 'Hecho', curso: 'En curso', pendiente: 'Pendiente' } as const

/** Lo que cuenta la columna de actividad, de lo más nuevo a lo más viejo. */
const ACTIVIDAD = [
  { cuando: 'ahora', quien: 'Prueba', que: 'habilitada · 48 h' },
  { cuando: '2 min', quien: 'Perfil', que: 'completado' },
  { cuando: '18 min', quien: 'Preguntas', que: 'respondidas · 5 de 5' },
  { cuando: '1 h', quien: 'CV', que: 'leído por una persona' },
  { cuando: 'ayer', quien: 'Requisitos', que: 'confirmados' },
  { cuando: 'ayer', quien: 'Postulación', que: 'recibida' },
] as const

/** Las líneas del grafo: de qué nodo a qué nodo, y si es la que está viva. */
const LINEAS: Array<[string, string, boolean]> = [
  ['POSTULACION', 'PERFIL', false],
  ['PERFIL', 'PRUEBA', true],
  ['PRUEBA', 'SIMULACION', false],
  ['SIMULACION', 'VALIDACION', false],
  ['VALIDACION', 'DECISION', false],
]

/**
 * Dibuja las líneas midiendo los nodos de verdad (`offset*`, que no se
 * entera de la escala de la ventana al hacer scroll). En codo, como las de la
 * referencia: si están en la misma fila, de lado a lado; si no, baja, cruza y
 * vuelve a bajar.
 */
function usarLineas(lienzo: React.RefObject<HTMLDivElement | null>) {
  const [trazos, setTrazos] = useState<Array<{ d: string; viva: boolean }>>([])
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 })
  useEffect(() => {
    const el = lienzo.current
    if (!el) return
    function medir() {
      if (!el) return
      const nodo = (clave: string) => el.querySelector<HTMLElement>(`[data-nodo="${clave}"]`)
      const nuevos: Array<{ d: string; viva: boolean }> = []
      for (const [de, a, viva] of LINEAS) {
        const n1 = nodo(de)
        const n2 = nodo(a)
        if (!n1 || !n2 || n1.offsetParent === null) continue
        // Los nodos se centran con `translateX(-50%)`, que `offsetLeft` no ve:
        // su borde izquierdo de verdad está medio ancho antes.
        const izq1 = n1.offsetLeft - n1.offsetWidth / 2
        const izq2 = n2.offsetLeft - n2.offsetWidth / 2
        const x1 = izq1 + n1.offsetWidth / 2
        const x2 = izq2 + n2.offsetWidth / 2
        const misma = Math.abs(n1.offsetTop - n2.offsetTop) < 8
        if (misma) {
          const izq = x1 < x2
          const y = n1.offsetTop + n1.offsetHeight / 2
          const sx = izq ? izq1 + n1.offsetWidth : izq1
          const ex = izq ? izq2 : izq2 + n2.offsetWidth
          nuevos.push({ d: `M${sx} ${y} H${ex}`, viva })
        } else {
          const y1 = n1.offsetTop + n1.offsetHeight
          const y2 = n2.offsetTop
          const medio = Math.round((y1 + y2) / 2)
          nuevos.push({ d: `M${x1} ${y1} V${medio} H${x2} V${y2}`, viva })
        }
      }
      setTrazos(nuevos)
      setCaja({ ancho: el.offsetWidth, alto: el.offsetHeight })
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [lienzo])
  return { trazos, caja }
}

function Ventana() {
  const lienzo = useRef<HTMLDivElement>(null)
  const { trazos, caja } = usarLineas(lienzo)

  return (
    <div className={estilos.ventana}>
      <div className={estilos.ventanaBarra} aria-hidden="true">
        <span className={estilos.semaforo}>
          <i />
          <i />
          <i />
        </span>
        <span className={estilos.ventanaTitulo}>
          <Marca tamano={10} /> Portal del candidato · Mis procesos
        </span>
        <span />
      </div>

      <div className={estilos.ventanaApp}>
        <aside className={estilos.lateral} aria-hidden="true">
          <div className={estilos.lateralMarca}>
            <Marca tamano={16} />
            <span>Portal EX</span>
            <span className={estilos.lateralFlecha}>▾</span>
          </div>
          <div className={estilos.lateralBuscar}>
            <IconoLupa tamano={12} />
            <span>Buscar vacantes</span>
            <kbd>⌘K</kbd>
          </div>
          <ul className={estilos.lateralLista}>
            <li>
              <IconoMaletin tamano={12} /> Vacantes <b className={estilos.cuenta}>12</b>
            </li>
            <li className={estilos.lateralVivo}>
              <IconoDocumento tamano={12} /> Mis procesos <i className={estilos.puntoVerde} />
            </li>
            <li>
              <IconoAviso tamano={12} /> Avisos <b className={estilos.cuenta}>2</b>
            </li>
            <li>
              <IconoPersonas tamano={12} /> Perfil
            </li>
          </ul>
          <p className={estilos.lateralGrupo}>Mis postulaciones</p>
          <ul className={estilos.lateralLista}>
            <li>
              <i className={estilos.puntoAzul} /> Analista de Datos <i className={estilos.puntoVerde} />
            </li>
            <li>
              <i className={estilos.puntoGris} /> Asistente Contable
            </li>
          </ul>
          <p className={estilos.lateralGrupo}>Tus datos</p>
          <ul className={estilos.lateralLista}>
            <li>
              <IconoCandado tamano={12} /> Privacidad
            </li>
            <li>
              <IconoDocumento tamano={12} /> Mi currículum
            </li>
          </ul>
        </aside>

        <div className={estilos.ventanaCuerpo}>
          <div className={estilos.ventanaCabecera} aria-hidden="true">
            <b>Analista de Datos</b>
            <span>★</span>
            <em>Clínica · Lima · Híbrido</em>
          </div>

          <div className={estilos.metricas} aria-hidden="true">
            <span className={estilos.metricaViva}>
              <b>2</b> Postulaciones
            </span>
            <span>
              <b>1</b> Te toca
            </span>
            <span>
              <b>2/5</b> Etapa actual
            </span>
            <span>
              <b>0</b> Descartes por CV
            </span>
          </div>

          <div className={estilos.ventanaTurno} aria-hidden="true">
            <span className={estilos.punto} />
            <b>Perfil</b> → Prueba del puesto
          </div>

          <div className={estilos.ventanaZona}>
            <div ref={lienzo} className={estilos.grafo}>
              <svg
                className={estilos.lineas}
                width={caja.ancho}
                height={caja.alto}
                viewBox={`0 0 ${caja.ancho || 1} ${caja.alto || 1}`}
                aria-hidden="true"
              >
                {trazos.map((t, i) => (
                  <path key={i} d={t.d} className={t.viva ? estilos.lineaViva : estilos.linea} />
                ))}
              </svg>

              <div className={`${estilos.nodo} ${estilos.nodoRaiz}`} data-nodo="POSTULACION" aria-hidden="true">
                <span className={estilos.nodoCabeza}>
                  <span className={estilos.nodoIcono}>
                    <IconoDocumento tamano={10} />
                  </span>
                  <b>Tu postulación</b>
                </span>
                <span className={estilos.nodoQue}>Recibida · CV leído</span>
                <span className={`${estilos.estado} ${estilos.estadoHecho}`}>Hecho</span>
              </div>

              <p className={estilos.pieEscaparate}>Cinco etapas para conocer cómo trabajas</p>
              <ol className={estilos.recorrido} role="list">
                {ETAPAS.map((etapa, indice) => {
                  const estado = ESTADO_DE_EJEMPLO[etapa.clave] ?? 'pendiente'
                  return (
                    <li
                      key={etapa.clave}
                      data-nodo={etapa.clave}
                      className={`${estilos.nodo} ${estilos[`nodo${etapa.clave}`] ?? ''} ${
                        estado === 'curso' ? estilos.nodoVivo : ''
                      }`}
                      style={{ animationDelay: `${1000 + indice * 70}ms` }}
                    >
                      <span className={estilos.nodoCabeza}>
                        <span className={estilos.nodoIcono} aria-hidden="true">
                          {indice + 1}
                        </span>
                        <b className={estilos.nombreEtapa}>{etapa.etiqueta}</b>
                      </span>
                      <span className={estilos.queEsEtapa}>{QUE_ES[etapa.clave]}</span>
                      <span
                        className={`${estilos.estado} ${
                          estado === 'hecho'
                            ? estilos.estadoHecho
                            : estado === 'curso'
                              ? estilos.estadoCurso
                              : ''
                        }`}
                        aria-hidden="true"
                      >
                        {ROTULO_DE_ESTADO[estado]}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className={estilos.actividad} aria-hidden="true">
              <p>Actividad</p>
              {ACTIVIDAD.map((a, i) => (
                <span
                  key={a.quien}
                  className={i === 0 ? estilos.actividadViva : undefined}
                  style={{ animationDelay: `${1500 + (ACTIVIDAD.length - 1 - i) * 450}ms` }}
                >
                  <em>{a.cuando}</em> <b>{a.quien}</b> {a.que}
                </span>
              ))}
              <p className={estilos.actividadSiguiente}>Lo siguiente</p>
              <span className={estilos.siguiente}>
                <b>Simulación</b> dos horas con el equipo · eliges la fecha
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * La maqueta que corona cada tarjeta de «Por qué este proceso es distinto».
 *
 * ⚠️ **Son piezas del portal, no ilustraciones.** La referencia que pidió esto
 * pone capturas de su panel; aquí se dibuja lo mismo con divs y los tokens del
 * mundo. Una captura serían tres PNG que hay que volver a hacer cada vez que
 * cambie una pantalla —y que ya estarían desactualizados—; esto se repinta solo
 * el día que cambie `mundo.css`.
 *
 * ⚠️ **Todas van `aria-hidden`.** Lo que dicen ya está en el título y el texto
 * de al lado: leerlas otra vez sería repetirle lo mismo dos veces a quien usa
 * lector de pantalla.
 */
function Maqueta({ que }: { que: 'curriculum' | 'sin-cuenta' | 'persona' }) {
  if (que === 'curriculum') {
    return (
      <div className={estilos.maqueta} aria-hidden="true">
        <div className={estilos.maquetaFicha}>
          <span className={estilos.maquetaLinea} style={{ width: '62%' }} />
          <span className={estilos.maquetaLinea} style={{ width: '88%' }} />
          <span className={estilos.maquetaLinea} style={{ width: '74%' }} />
        </div>
        <span className={estilos.maquetaSello}>Sigue en proceso</span>
      </div>
    )
  }

  if (que === 'sin-cuenta') {
    return (
      <div className={estilos.maqueta} aria-hidden="true">
        <div className={estilos.maquetaFicha}>
          <span className={estilos.maquetaEtiqueta}>Vacante abierta</span>
          <span className={estilos.maquetaTitulo} />
          <span className={estilos.maquetaLinea} style={{ width: '70%' }} />
        </div>
        <span className={estilos.maquetaSello}>Sin iniciar sesión</span>
      </div>
    )
  }

  return (
    <div className={estilos.maqueta} aria-hidden="true">
      <div className={estilos.maquetaFicha}>
        <div className={estilos.maquetaFila}>
          <span className={estilos.maquetaCara} />
          <span className={estilos.maquetaLinea} style={{ width: '54%' }} />
        </div>
        <span className={estilos.maquetaLinea} style={{ width: '80%' }} />
      </div>
      <span className={estilos.maquetaSello}>Decide el equipo</span>
    </div>
  )
}
