/**
 * La portada: qué es este proceso y qué vacantes hay abiertas.
 *
 * Es la única pantalla en modo Persuade —quien llega todavía no ha postulado y
 * tiene que decidir si le merece la pena—, y desde el rediseño de 09/2026 la
 * compone el mundo nuevo: fondo blanco, titular centrado, acción en negro y dos
 * piezas de color —la loseta con el maletín incrustada en el titular y el
 * resplandor coral dentro del escaparate—.
 *
 * La pieza grande es el escaparate: una tarjeta blanca de borde grueso con el
 * recorrido dentro, que enseña el producto en vez de decorar la pantalla. En su
 * sitio hubo una banda irisada, que se fue con el mundo anterior.
 *
 * Lo que no cambia es la promesa: lo que ve antes de entrar es lo mismo que verá
 * después, porque el recorrido se dibuja igual aquí que dentro del portal.
 *
 * Se ve sin cuenta. `GET /vacantes` es público.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listarVacantes } from '@/api/portal'
import type { VacantePublica } from '@/api/tipos'
import { ETAPAS } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { AlAsomarse } from '@/ui/movimiento'
import {
  FranjaQueSeLlena,
  TarjetaQueResponde,
  TituloQueViaja,
} from '@/ui/movimiento'
import estilos from './Vacantes.module.css'

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

export function Vacantes() {
  const consulta = useQuery({ queryKey: ['vacantes'], queryFn: listarVacantes })
  // Lo que llegue por la red no puede dar por hecho que tiene la forma
  // prometida: un cuerpo que no sea lista reventaba la pantalla entera.
  const vacantes = Array.isArray(consulta.data) ? consulta.data : []
  const ciudades = new Set(vacantes.map((v) => v.ubicacion).filter(Boolean)).size

  return (
    <div className={estilos.pagina}>
      <section className={estilos.portada}>
        <AlAsomarse>
          {/*
            ⚠️ **Aquí iba incrustada la loseta del maletín y se fue el
            25/09/2026.** Era un PNG pintado en el coral y el rosa del mundo
            anterior; con la paleta nueva quedaba como la única mancha cálida de
            la portada. Se probó a girarle el tono por CSS y se retiró entera por
            petición. El archivo sigue en `public/pieza-trabajo.png` por si vuelve
            en la paleta nueva — repintado, no rotado.
          */}
          <h1 className={estilos.entrada}>Tu próximo trabajo puede empezar aquí</h1>
          <div className={estilos.acciones}>
            <a
              className={estilos.accionPrincipal}
              href="#vacantes-abiertas"
              data-rotulo="Ver las vacantes abiertas"
            >
              Ver las vacantes abiertas
            </a>
            <Link
              className={estilos.accionSecundaria}
              to={rutas.procesos()}
              data-rotulo="Ya postulé antes"
            >
              Ya postulé antes
            </Link>
          </div>
        </AlAsomarse>


        {/*
          El escaparate: la pieza grande del mundo. Dentro va el recorrido, que
          es el producto, no un adorno.

          ⚠️ **Desde el 25/09/2026 finge ser una ventana del portal**, como la
          captura de producto que la referencia del cliente pone en el mismo
          sitio. Era una tarjeta blanca cerrada con el recorrido dentro; ahora
          lleva su barra arriba, su título, y por debajo asoma una segunda ficha
          que se corta contra el borde — que es lo que dice «esto sigue» sin
          tener que enseñarlo.

          ⚠️ **Lo que se corta es SOLO decoración.** La barra de arriba y la
          ficha que asoma van con `aria-hidden` y no llevan ningún enlace: son el
          retrato de una pantalla, no la pantalla. El recorrido —lo único que de
          verdad promete algo— queda entero y por encima del recorte, porque es
          la promesa de esta portada: lo que se ve antes de entrar es lo mismo
          que se verá después.
        */}
        <AlAsomarse variante="scaleUp" retraso={0.2}>
          <div className={estilos.escaparate}>
            <div className={estilos.marcoVentana}>
              <div className={estilos.ventana}>
                <div className={estilos.ventanaBarra} aria-hidden="true">
                  <span className={estilos.ventanaMarca} />
                  <span className={estilos.ventanaDestinos}>
                    <span />
                    <span />
                    <span className={estilos.ventanaDestinoVivo} />
                  </span>
                  <span className={estilos.ventanaAvatar} />
                </div>

                <div className={estilos.escaparateDentro}>
                  <p className={estilos.pieEscaparate}>
                    Cinco etapas para conocer cómo trabajas
                  </p>
              <ol className={estilos.recorrido} role="list">
                {ETAPAS.map((etapa, indice) => (
                  <li className={estilos.tramo} key={etapa.clave}>
                    {/*
                      E · cada etapa asoma detras de la anterior. El retraso se
                      calcula aqui y no con `AsomanEnFila` porque el escalonado
                      del padre reparte sobre HIJOS DIRECTOS, y estos cuelgan de
                      un `<li>` cada uno: el contenedor escalonado no los ve.
                    */}
                    <AlAsomarse retraso={0.2 * indice}>
                      {/* C · la franja se dibuja, escalonada por etapa. */}
                      <FranjaQueSeLlena
                        orden={indice}
                        className={indice === 0 ? estilos.barraViva : estilos.barraTramo}
                      />
                      <p className={estilos.numeroEtapa}>Etapa {indice + 1}</p>
                      <p className={estilos.nombreEtapa}>{etapa.etiqueta}</p>
                      <p className={estilos.queEsEtapa}>{QUE_ES[etapa.clave]}</p>
                    </AlAsomarse>
                  </li>
                    ))}
                  </ol>
                </div>

                {/*
                  La ficha que asoma y se corta contra el borde. Es el truco de
                  la referencia: su captura de producto no termina, se sale del
                  marco, y eso dice que la pantalla sigue sin tener que
                  enseñarla entera.

                  Decoración pura —`aria-hidden`, sin enlaces ni texto— porque
                  la mitad de ella no se ve y lo que promete algo ya está arriba.
                */}
                <div className={estilos.fichaQueAsoma} aria-hidden="true">
                  <span className={estilos.fichaLinea} style={{ width: '38%' }} />
                  <span className={estilos.fichaLineaMenor} style={{ width: '26%' }} />
                  <div className={estilos.fichaBarras}>
                    <span className={estilos.fichaBarraViva} />
                    <span className={estilos.fichaBarra} />
                    <span className={estilos.fichaBarra} />
                    <span className={estilos.fichaBarra} />
                    <span className={estilos.fichaBarra} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AlAsomarse>
      </section>

      {/*
        La cinta dice cifras verdaderas y solo verdaderas. No hay testimonios ni
        numero de contratados: el sistema todavia no ha pasado por su primer
        candidato real y inventarlos seria mentir en la portada.
      */}
      <AlAsomarse>
        <div className={estilos.cinta}>
          <span>
            <b>{vacantes.length}</b> {vacantes.length === 1 ? 'puesto abierto' : 'puestos abiertos'}
          </span>
          {ciudades > 0 && (
            <span>
              <b>{ciudades}</b> {ciudades === 1 ? 'ciudad' : 'ciudades'}
            </span>
          )}
          <span>
            <b>0</b> descartes por currículum
          </span>
          <span>Mirar no exige cuenta</span>
        </div>
      </AlAsomarse>

      <AlAsomarse>
        <section className={estilos.seccionVacantes} aria-labelledby="vacantes-abiertas">
          <div className={estilos.cabeceraSeccion}>
            <h2 id="vacantes-abiertas">Vacantes abiertas</h2>
          </div>

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
                data-rotulo="Intentar de nuevo"
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
            <div className={estilos.lista}>
              {vacantes.map((v) => (
                <Vacante key={v.id} vacante={v} />
              ))}
            </div>
          )}
        </section>
      </AlAsomarse>

      {/*
        La banda de «Por qué aquí». Va DESPUÉS de las vacantes y no antes: quien
        llega a un portal de empleo viene a ver puestos, y tres tarjetas
        explicando el método entre la portada y la lista retrasan justo eso.
        Aquí ya vio lo que hay y la pregunta que le queda es si merece la pena.

        La banda va a sangre y en nube, que es lo que da el ritmo alterno: cielo
        arriba, nube aquí, cielo otra vez en las preguntas.
      */}
      <AlAsomarse>
        <section className={estilos.banda} aria-labelledby="por-que-aqui">
          <div className={estilos.bandaDentro}>
            <div className={estilos.cabeceraSeccion}>
              <h2 id="por-que-aqui">Por qué este proceso es distinto</h2>
              <p>Tres reglas que puedes comprobar hoy mismo, sin cuenta.</p>
            </div>

            <ul className={estilos.rejillaTres} role="list">
              {LO_NUESTRO.map((cosa) => (
                <li className={estilos.tarjetaNuestra} key={cosa.clave}>
                  <Maqueta que={cosa.clave} />
                  <h3 className={estilos.tituloNuestra}>{cosa.titulo}</h3>
                  <p className={estilos.textoNuestra}>{cosa.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </AlAsomarse>

      <AlAsomarse>
        <section className={estilos.seccion} aria-labelledby="preguntas-frecuentes">
          <div className={estilos.cabeceraSeccion}>
            <h2 id="preguntas-frecuentes">Preguntas frecuentes</h2>
            <p>Lo que casi todo el mundo pregunta antes de postular.</p>
          </div>

          {/*
            `<details>` nativo: el plegable, el teclado y el lector de pantalla
            vienen gratis, y la regla de la plataforma primero dice que se mire el
            HTML antes de traer una libreria.
          */}
          <div className={estilos.preguntas}>
            {/*
              Todas cerradas de entrada. La primera venia abierta para enseñar de
              que va el plegable, y a cambio dejaba la seccion empezando por una
              respuesta: lo que se ve primero tiene que ser la lista de preguntas,
              que es lo que permite buscar la propia de un vistazo.
            */}
            {PREGUNTAS.map((p) => (
              <details className={estilos.pregunta} key={p.q}>
                <summary>
                  {p.q}
                  <span className={estilos.mas} aria-hidden="true" />
                </summary>
                <p>{p.a}</p>
              </details>
            ))}
          </div>
        </section>
      </AlAsomarse>

      <AlAsomarse>
        <section className={estilos.cierre}>
          <div className={estilos.cajaCierre}>
            <span className={estilos.halo} aria-hidden="true" />
            <h2>¿Empezamos?</h2>
            <p>
              Elige un puesto, lee sus requisitos y postula. Lo demás te lo vamos contando en
              pantalla, paso a paso.
            </p>
            <div className={estilos.acciones}>
              <a
                className={estilos.accionPrincipal}
                href="#vacantes-abiertas"
                data-rotulo="Ver las vacantes abiertas"
              >
                Ver las vacantes abiertas
              </a>
              <Link
                className={estilos.accionSecundaria}
                to={rutas.procesos()}
                data-rotulo="Entrar a mis procesos"
              >
                Entrar a mis procesos
              </Link>
            </div>
          </div>
        </section>
      </AlAsomarse>
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

function Vacante({ vacante }: { vacante: VacantePublica }) {
  const destino = rutas.vacante(vacante.id)
  const donde = [vacante.modalidad, vacante.ubicacion].filter(Boolean).join(' · ')
  // Casi todos los campos de la vacante pueden venir vacios, asi que se elige
  // el primero que traiga algo en vez de dar por hecho ninguno.
  const resumen = vacante.proposito ?? vacante.descripcion

  // D · la tarjeta se levanta al pasar por encima.
  return (
    <TarjetaQueResponde className={estilos.vacante}>
      <Link className={estilos.enlaceVacante} to={destino}>
        {donde && <span className={estilos.etiqueta}>{donde}</span>}
        {/* B · este titulo viaja hasta el titular de la ficha. */}
        <TituloQueViaja id={vacante.id} className={estilos.tituloVacante}>
          {vacante.titulo}
        </TituloQueViaja>
        {vacante.nombreEmpresa && (
          <span className={estilos.empresa}>{vacante.nombreEmpresa}</span>
        )}
        {resumen && <p className={estilos.queSeHace}>{resumen}</p>}
        <span className={estilos.pieVacante}>
          {vacante.horario && <span>{vacante.horario}</span>}
          {/*
            ⚠️ **Aqui NO va el `<Remuneracion>` compartido, y es a proposito.**
            Esa pieza es un bloque con su etiqueta, su matiz y su «actualizado
            el …»: lo que hace falta en la ficha, donde el sueldo es la mitad de
            un trato. En la tarjeta de la lista el sueldo es un dato mas del pie,
            al lado del horario, y el bloque entero rompe la fila.

            Lo que si se respeta es la regla de esa pieza: **`OCULTA` se nombra,
            no se esconde** —un hueco donde deberia ir el numero se lee como un
            fallo de carga—, y el monto **llega escrito del servidor**, asi que
            aqui no se formatea ningun numero.
          */}
          <span className={estilos.paga}>
            {!vacante.remuneracion || vacante.remuneracion.tipo === 'OCULTA'
              ? 'Sueldo sin publicar'
              : vacante.remuneracion.texto}
          </span>
        </span>
      </Link>
    </TarjetaQueResponde>
  )
}
