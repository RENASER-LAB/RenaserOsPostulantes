/**
 * La politica de privacidad, en abierto.
 *
 * Existe porque Google Play **exige una URL de politica de privacidad que se
 * pueda leer sin sesion**, y la pantalla que ya habia —`/privacidad`— vive
 * dentro de `<Privada>`. No la sustituye: aquella es el panel de acciones
 * —retirar una postulacion, salir del radar, pedir el borrado— y todas
 * necesitan saber quien las pide. Esta solo cuenta.
 *
 * Y cubre el otro requisito de Play para una aplicacion con cuentas: **que el
 * borrado de datos se pueda pedir tambien desde la web, sin instalar nada**.
 * Por eso el penultimo bloque explica las dos formas y no solo la de dentro.
 *
 * ⚠️ **Ninguna afirmacion de aqui se escribio de memoria.** Cada una sale de lo
 * que el sistema hace de verdad —comprobado en el codigo y en las migraciones—,
 * que es lo unico que evita el fallo peor de un documento asi: prometer un
 * tratamiento que no ocurre. Los proveedores son los que configura
 * `application.yaml`; el plazo, el parametro `meses_conservar_perfil`; y lo que
 * se le quita al curriculum antes de mandarlo al modelo, `PuenteCalificacionIa`.
 *
 * **El ultimo bloque no lo escribe esta pantalla**: son los textos publicados
 * que sirve el backend, enseñados tal cual. Un documento que los resume a mano
 * se desvia del que la gente firma de verdad, y el que vale es el firmado.
 *
 * ⚠️ **El numero de version NO se enseña, y el versionado sigue intacto.** Cada
 * aceptacion queda amarrada en la base a la version exacta que se firmo, con su
 * huella —eso es lo que sostiene la prueba—; pero al candidato un «version 1.0»
 * no le dice nada y lo unico que sugiere es que hay otras versiones por ahi que
 * no puede ver. Lo que le importa es el texto, y el texto esta entero.
 *
 * ⚠️ **Sigue necesitando revision de un abogado antes de publicar en Play.** Lo
 * que cambio en la V54 es que ya no falta informacion: estan el responsable con
 * sus datos registrales, los encargados por su nombre, la salida de los datos
 * del pais y el plazo. Lo que falta es que alguien con titulo lo firme.
 */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { consentimientoDeVacante, textosConsentimiento } from '@/api/portal'
import { rutas } from '@/rutas'
import estilos from './PoliticaPublica.module.css'

/**
 * Donde escribe quien no puede entrar a su cuenta.
 *
 * ⚠️ **Sigue siendo un correo de equipo y no uno institucional.** Bajo la Ley
 * 29733 el contacto tiene que ser el del responsable del tratamiento, que es la
 * empresa. Cambiarlo es cambiar esta constante **y republicar los textos de
 * consentimiento**, que lo nombran dentro: los dos sitios o ninguno.
 */
const CORREO_DEL_EQUIPO = 'renaserlab@gmail.com'

/**
 * El ancla a la que apunta el enlace de las casillas de consentimiento.
 *
 * Existe porque esa es la promesa del hipervinculo: quien lo pulsa desde la
 * casilla no quiere la politica entera, quiere el parrafo que esta a punto de
 * firmar. Sin ancla aterriza arriba del todo y tiene que buscarlo.
 */
const ANCLA_TEXTOS = rutas.anclaDeLosTextos

/** Quien responde por estos datos, tal como consta en su ficha RUC. */
const RESPONSABLE = {
  razonSocial: 'RENASER CONSULTING S.A.C.',
  ruc: '20615428419',
  domicilio:
    'Pj. Manuel Castillo Nro. 205, Urb. Alto Selva Alegre (frente a la Clínica Oftalmosalud), Alto Selva Alegre, Arequipa, Perú',
}

/**
 * Los encargados, por su nombre y con lo que recibe cada uno.
 *
 * Por su nombre y no «proveedores de servicios de inteligencia artificial»: el
 * formulario de Seguridad de Datos de Play pregunta por ellos expresamente, y
 * declararlos de menos es motivo de retirada. Los cuatro estan fuera del Peru,
 * que es lo que convierte esto en flujo transfronterizo del articulo 15.
 */
const ENCARGADOS = [
  {
    nombre: 'DeepSeek',
    para: 'Califica el currículum, las respuestas abiertas y la prueba del puesto',
    que: 'El currículum ya recortado y las respuestas que escribiste',
  },
  {
    nombre: 'Google',
    para: 'Busca por significado dentro del sistema',
    que: 'Fragmentos de texto convertidos en números',
  },
  {
    nombre: 'Supabase',
    para: 'Guarda la base de datos y los archivos',
    que: 'Tu cuenta, tu perfil y los archivos que subes',
  },
  {
    nombre: 'Amazon Web Services',
    para: 'Aloja los servidores donde corre el sistema',
    que: 'Todo lo anterior, mientras el sistema funciona',
  },
  {
    nombre: 'Vercel',
    para: 'Sirve las páginas del portal, esta incluida',
    que: 'Lo que escribes en ellas, camino del servidor',
  },
]

export function PoliticaPublica() {
  /*
    Los textos publicados, para enseñarlos al final tal cual. Publico como el
    tablon: quien esta leyendo esta pagina puede no tener cuenta todavia.

    Si la peticion falla no se tapa el documento: lo de arriba se lee igual y
    abajo se dice que el texto no cargo, con la direccion para pedirlo. Un
    bloque vacio y mudo en la pagina legal es peor que decir que fallo.
  */
  const textos = useQuery({ queryKey: ['consentimientos'], queryFn: textosConsentimiento })
  const legales = Array.isArray(textos.data) ? textos.data : []
  const deLaCuenta = legales.find((t) => t.tipo?.toUpperCase().includes('PLATAFORMA'))
  const deLaVacante = legales.find((t) => t.tipo?.toUpperCase() === 'PROCESO')
  const deFuturos = legales.find((t) => t.tipo?.toUpperCase().includes('FUTUROS'))

  /*
    Cuando se llega desde una vacante, con el nombre de ESA empresa dentro.

    El texto es el mismo para todas —uno solo, de la plataforma— y la lista publica
    lo sirve compuesto con «la empresa que publica la vacante», que sirve para
    leerlo en frio. Pero quien llega aqui desde el formulario de postular no esta
    leyendo en frio: esta a punto de firmar, y lo que tiene que leer es su nombre,
    no un marcador de posicion. Es la promesa del enlace.
  */
  const [parametros] = useSearchParams()
  const vacante = parametros.get('vacante')
  const deEstaVacante = useQuery({
    queryKey: ['consentimiento-vacante', vacante],
    queryFn: () => consentimientoDeVacante(vacante!),
    enabled: vacante !== null,
  })
  const porVacante = deEstaVacante.data

  /*
    El salto al ancla, a mano.

    ⚠️ **El enrutador no lo hace solo.** Con `#el-texto-que-aceptas` en la
    direccion, react-router monta la pagina arriba del todo y se queda ahi: quien
    pulsa el enlace desde una casilla aterriza en el titulo y tiene que buscar el
    parrafo que iba a firmar, que es justo lo que el ancla venia a evitar.

    Y va atado a `textos.isSuccess` y no solo al montaje: los textos llegan por
    red y el bloque no existe todavia cuando la pagina se pinta por primera vez,
    asi que saltar antes seria saltar a la nada.
  */
  const { hash, key } = useLocation()
  useEffect(() => {
    if (!hash || !textos.isSuccess) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
    // `key` y no solo `hash`: si ya estás en esta página y vuelves a llegar al MISMO
    // ancla, la cadena no cambia y React no reejecutaría — el salto no ocurriría y el
    // enlace parecería roto. `key` cambia en cada navegación.
  }, [hash, key, textos.isSuccess])

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        {/*
          Se llama distinto que `/privacidad` a proposito. Aquella se anuncia en
          el pie como «Privacidad y tratamiento de datos» y es el panel de
          acciones; esta es el documento. Con el mismo titulo, dos paginas con
          acceso distinto se leerian como la misma y la de la sesion parecerian
          un error.
        */}
        <h1>Política de privacidad</h1>
        <p className={estilos.bajada}>
          Qué datos te pedimos, para qué los usamos, quién más los ve y cómo pides que los
          borremos. Escrito para que se entienda; el texto que firmas, palabra por palabra,
          está al final.
        </p>
      </header>

      <section className={estilos.seccion}>
        <h2>Quién responde por tus datos</h2>
        <dl className={estilos.identidad}>
          <div>
            <dt>Responsable</dt>
            <dd>{RESPONSABLE.razonSocial}</dd>
          </div>
          <div>
            <dt>RUC</dt>
            <dd>{RESPONSABLE.ruc}</dd>
          </div>
          <div>
            <dt>Domicilio</dt>
            <dd>{RESPONSABLE.domicilio}</dd>
          </div>
          <div>
            <dt>Contacto</dt>
            <dd>
              <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a>
            </dd>
          </div>
        </dl>
        <p>
          Renaser opera este portal y es responsable de tu cuenta y de tu perfil. Las
          vacantes las publican empresas que usan el portal para seleccionar personal, y{' '}
          <strong>cada una responde por el proceso de sus propias vacantes</strong>. En la
          ficha de cada vacante se dice de qué empresa es.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Tres permisos, y no son el mismo</h2>
        <p>
          Es lo que más confunde, así que va primero: no hay un permiso, hay tres, y cada
          uno se lo das a alguien distinto y por una vía distinta.
        </p>
        <ul className={estilos.lista}>
          <li>
            <strong>Al crear tu cuenta marcas una casilla</strong> y aceptas que{' '}
            <b>Renaser</b> trate tus datos: la cuenta, tu perfil, la evaluación con
            inteligencia artificial, los proveedores de los que hablamos abajo y el plazo de
            conservación. Es uno solo y vale para todo el portal.
          </li>
          <li>
            <strong>Al enviar una postulación</strong> aceptas que <b>esa empresa</b> lea tu
            currículum y tus respuestas y decida sobre tu candidatura.{' '}
            <b>Aquí no hay casilla</b>: enviarla es el permiso, y por eso antes del botón te
            decimos quién la va a recibir. Vale solo para esa vacante y no alcanza a las
            demás empresas del portal.
          </li>
          <li>
            <strong>Avisos de futuras vacantes</strong> es el tercero, y es opcional: una
            segunda casilla al crear la cuenta. Si no la marcas, tus postulaciones valen
            exactamente igual.
          </li>
        </ul>
        <p>
          De cada permiso guardamos la versión exacta del texto que aceptaste, la fecha, la
          dirección IP y el navegador. Es lo que exige la Ley 29733 para poder probar que el
          consentimiento lo diste tú.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Qué datos recogemos</h2>
        <p>Solo lo que hace falta para evaluar tu candidatura, y cuando hace falta:</p>
        <ul className={estilos.lista}>
          <li>
            <strong>Al crear tu cuenta:</strong> tu nombre, tus apellidos, tu correo, una
            contraseña y la provincia donde vives.
          </li>
          <li>
            <strong>Si los das o salen de tu currículum:</strong> tu teléfono, tu documento de
            identidad y tu fecha de nacimiento. Los que lee la inteligencia artificial de tu
            currículum aparecen marcados como tales en tu perfil, para que puedas corregirlos.
          </li>
          <li>
            <strong>Si armas tu perfil:</strong> tu titular, tu resumen, tus habilidades, tu
            experiencia, tu formación, tu disponibilidad, tus enlaces, tu currículum y, si
            las subes, tu foto y tu portada.
          </li>
          <li>
            <strong>Al postular:</strong> tu currículum para esa vacante y tus respuestas a
            sus requisitos indispensables.
          </li>
          <li>
            <strong>Durante el proceso:</strong> tus respuestas a la evaluación y a la prueba
            del puesto, y si asististe a la sesión de simulación a la que te inscribiste.
          </li>
          <li>
            <strong>Si la indicas:</strong> tu pretensión salarial, que no aparece en
            ninguna lista ni en ningún ranking.
          </li>
        </ul>
        <p>Nada de esto se recoge sin que tú lo envíes.</p>
      </section>

      <section className={estilos.seccion}>
        <h2>Para qué los usamos</h2>
        <p>
          Para crear y mantener tu cuenta, armar tu perfil a partir de tu currículum,
          presentar tu candidatura a las vacantes a las que postules y escribirte sobre el
          estado de tus procesos. Si además diste el permiso de futuras vacantes, para
          avisarte cuando se abra una que encaje contigo.
        </p>
        <p>
          <strong>La base legal es tu consentimiento</strong>, expreso y previo, conforme a
          la Ley 29733 de Protección de Datos Personales y su reglamento. No vendemos tus
          datos ni los usamos para publicidad.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Una inteligencia artificial participa, y una persona decide</h2>
        <p>
          Tu currículum y tus respuestas se procesan con inteligencia artificial para
          ordenarlos y puntuarlos.{' '}
          <strong>Ninguna nota te contrata ni te descarta por sí sola</strong>: quien decide
          si sigues en el proceso o no es siempre una persona de la empresa, y puedes pedirle
          que revise ese resultado si no estás de acuerdo.
        </p>
        {/*
          ⚠️ **Estas tres se enumeran porque existen, no por prudencia.** La versión
          anterior de esta página decía que «ninguna decisión se toma automáticamente», y
          era falso: `ServicioEvaluacionImpl.cerrarVencidas` cierra la postulación sola
          —lo dispara `SondeoVencimientos` cada 60 segundos, sin interruptor que lo
          apague—, `ServicioPostulacionPortalImpl` descarta al postular por requisito
          objetivo, y `PaseAutomatico` (V53) avanza etapas en las vacantes marcadas. Un
          documento legal que promete lo que el código no hace es peor que no tenerlo: es
          la prueba en contra.
        */}
        <p>El sistema sí hace tres cosas solo, y ninguna depende de una nota:</p>
        <ul className={estilos.lista}>
          <li>
            <strong>Te cierra la postulación al postular</strong> si tú mismo declaras que no
            cumples un requisito indispensable de la vacante.
          </li>
          <li>
            <strong>Cierra tu proceso si se te pasa el plazo</strong> que tenías para
            responder una evaluación o una prueba. Te avisamos por correo cuando ocurre.
          </li>
          <li>
            <strong>Te pasa a la etapa siguiente sin esperar a nadie</strong>, cuando la
            empresa configuró su vacante para avanzar sola.
          </li>
        </ul>
        <p>
          En cualquiera de los tres puedes escribirnos y pedir que una persona lo revise.
        </p>
        <p>
          Antes de enviar tu currículum al modelo,{' '}
          <strong>le quitamos la foto, la edad, el sexo y el estado civil</strong>. Lo que
          sale es esa versión recortada, nunca el archivo completo que subiste: la idea es
          que la máquina no pueda inclinarse por nada de eso.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Quién más ve tus datos, y que salen del Perú</h2>
        <p>
          Las empresas a cuyas vacantes postulas, y estos proveedores, que trabajan por
          encargo nuestro y solo para lo anterior:
        </p>
        <div className={estilos.tablaEnvoltorio}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Quién</th>
                <th scope="col">Para qué</th>
                <th scope="col">Qué recibe</th>
              </tr>
            </thead>
            <tbody>
              {ENCARGADOS.map((encargado) => (
                <tr key={encargado.nombre}>
                  <th scope="row">{encargado.nombre}</th>
                  <td>{encargado.para}</td>
                  <td>{encargado.que}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Todos están fuera del Perú</strong>, y también el proveedor de correo con el
          que te escribimos, así que tus datos salen del país. Eso es lo que la Ley 29733
          llama flujo transfronterizo y por eso te lo decimos antes de que aceptes, no
          después. Renaser sigue respondiendo por ellos ante ti.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Cuánto los conservamos</h2>
        <p>
          Mientras tengas cuenta. Si pasas <strong>24 meses sin actividad</strong> —sin
          postular y sin tocar tu perfil—, tu perfil se elimina con todo lo que cuelga de él;
          ese es el plazo que tenemos puesto hoy, y si alguna empresa del portal necesitara
          uno más largo para sus procesos, se aplica el más largo de los dos. Lo que sostiene
          una decisión ya tomada en un proceso se conserva por el permiso que firmaste con esa
          empresa.
        </p>
        <p>
          <strong>Puedes pedir el borrado antes, cuando quieras</strong>, y no hace falta que
          expliques por qué.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Tus derechos</h2>
        <p>
          La Ley 29733 te da derecho a saber qué datos tuyos tenemos, a corregirlos si están
          mal, a oponerte a que los usemos y a que los borremos. Los dos primeros los ejerces
          desde <Link to={rutas.perfil()}>tu perfil</Link>, donde puedes ver y editar todo lo
          que hay sobre ti. Los dos últimos viven en{' '}
          <Link to={rutas.privacidad()}>Privacidad y control</Link>: ahí retiras una
          postulación, sales de los avisos de futuras vacantes y pides el borrado.{' '}
          <strong>Pedir el borrado no es borrar en el acto</strong>: la solicitud queda
          registrada y la ejecutamos dentro de los plazos de la ley.
        </p>
        <p>
          Si algo de esto no funciona o prefieres pedirlo por escrito, escríbenos a{' '}
          <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a>. Y si no te
          atendemos, puedes reclamar ante la{' '}
          <strong>Autoridad Nacional de Protección de Datos Personales</strong> del
          Ministerio de Justicia y Derechos Humanos.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Qué puedes hacer con tus datos</h2>
        <p>En cualquier momento, y sin tener que dar explicaciones:</p>
        <ul className={estilos.lista}>
          <li>
            <strong>Retirar una postulación:</strong> dejas esa vacante. El resto de tus datos
            siguen como estaban.
          </li>
          <li>
            <strong>Salir de futuras vacantes:</strong> dejamos de contactarte para vacantes
            nuevas. Tus procesos en curso no se tocan.
          </li>
          <li>
            <strong>Pedir el borrado de tus datos:</strong> eliminamos tus datos personales y
            tus respuestas. Se conserva el registro de auditoría, pero sin identificarte.
          </li>
        </ul>
      </section>

      <section className={estilos.seccion}>
        <h2>Cómo pides que borremos tus datos</h2>
        <p>Hay dos caminos, y el segundo existe para cuando el primero no es posible:</p>
        <ul className={estilos.lista}>
          <li>
            <strong>Desde tu cuenta:</strong> entra y ve a{' '}
            <Link to={rutas.privacidad()}>Privacidad y control</Link>. Ahí puedes pedir el
            borrado tú mismo. Vale igual desde la aplicación o desde el navegador.
          </li>
          <li>
            <strong>Escribiéndonos:</strong> si perdiste el acceso a tu cuenta, o prefieres no
            entrar, mándanos un correo a{' '}
            <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a> desde la dirección
            con la que te registraste y lo tramitamos nosotros.
          </li>
        </ul>
        <div className={estilos.contacto}>
          <p>
            <strong>Borrar tu cuenta borra también tus postulaciones.</strong> Si estás en un
            proceso abierto, quedará cerrado y no podrás retomarlo.
          </p>
        </div>
      </section>

      <section className={estilos.seccion} id={ANCLA_TEXTOS}>
        <h2>El texto que aceptas, palabra por palabra</h2>
        <p>
          Lo de arriba explica; esto es lo que firmas. Sale del sistema tal como está
          publicado, así que es exactamente el que queda guardado con tu aceptación.
        </p>

        {textos.isPending && <p aria-busy="true">Cargando el texto vigente…</p>}
        {/*
          Los dos fallos, y el segundo es el silencioso: el backend puede contestar 200 con
          la lista vacía —o con uno solo de los dos textos— y entonces no hay error que
          mostrar ni nada que pintar, y esta sección se queda con su título y el vacío
          debajo. Es justo el «bloque vacío y mudo en la pagina legal» que la cabecera de
          este archivo dice querer evitar, así que se dice con las mismas palabras.
        */}
        {(textos.isError || (!textos.isPending && !deLaCuenta)) && (
          <p role="alert">
            No pudimos cargar el texto vigente. Pídenoslo a{' '}
            <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a> y te lo mandamos.
          </p>
        )}

        {deLaCuenta && (
          <article className={estilos.textoLegal}>
            <h3>Al crear tu cuenta</h3>
            <p className={estilos.literal}>{deLaCuenta.texto}</p>
          </article>
        )}

        {porVacante ? (
          <article className={estilos.textoLegal}>
            <h3>Al postular a {porVacante.nombreEmpresa}</h3>
            <p className={estilos.nota}>
              Es el texto que aceptas al enviar tu postulación a esta vacante.
            </p>
            <p className={estilos.literal}>{porVacante.texto}</p>
          </article>
        ) : (
          deLaVacante && (
            <article className={estilos.textoLegal}>
              <h3>Al postular a una vacante</h3>
              <p className={estilos.nota}>
                Es el mismo para todas las empresas del portal; donde dice «la empresa que
                publica la vacante», en cada vacante aparece el nombre de la suya.
              </p>
              <p className={estilos.literal}>{deLaVacante.texto}</p>
            </article>
          )
        )}

        {deFuturos && (
          <article className={estilos.textoLegal}>
            <h3>Avisos de futuras vacantes · opcional</h3>
            <p className={estilos.literal}>{deFuturos.texto}</p>
          </article>
        )}

        {!textos.isPending && deLaCuenta && !(deLaVacante && deFuturos) && (
          <p role="alert">
            Falta por cargar alguno de los textos. Pídenoslo a{' '}
            <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a>.
          </p>
        )}
      </section>
    </div>
  )
}
