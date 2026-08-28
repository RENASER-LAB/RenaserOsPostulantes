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
 * Por eso el ultimo bloque explica las dos formas y no solo la de dentro.
 *
 * ⚠️ **Es un borrador y necesita revision legal antes de publicar en Play.**
 * No lo escribio un abogado. Cada afirmacion sale de lo que el sistema hace de
 * verdad —comprobado en el codigo y en la base—, que es lo unico que evita el
 * fallo peor de un documento asi: prometer un tratamiento que no ocurre.
 *
 * Los textos de consentimiento del backend estan en el mismo estado: llevan
 * dentro «[TEXTO PROVISIONAL: pendiente de aprobacion legal por Renaser]».
 *
 * ⚠️ **Tres huecos que solo Renaser puede rellenar, y no se inventan aqui:**
 *
 *   1. **RUC y domicilio fiscal.** La ley 29733 los pide para identificar al
 *      responsable. Se nombra la empresa y su correo, que es lo que consta.
 *   2. **El plazo de conservacion.** La tabla `politica_conservacion` de la
 *      base **esta vacia**: no hay ninguno configurado. Por eso abajo se dice
 *      cuando se borra —cuando lo pides— y no cuantos meses, que seria un
 *      numero inventado.
 *   3. **Los terceros, por su nombre.** Aqui van por categoria. El formulario
 *      de Seguridad de Datos de Play pregunta por ellos expresamente y
 *      declararlos de menos es motivo de retirada.
 */

import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import estilos from './PoliticaPublica.module.css'

/**
 * Donde escribe quien no puede entrar a su cuenta.
 *
 * ⚠️ **Es un marcador, no una decision.** Hace falta una direccion oficial de
 * Renaser: esta pagina es publica por definicion —es la que Play exige poder
 * leer sin cuenta— y bajo la Ley 29733 el contacto tiene que ser el del
 * responsable del tratamiento, que es la empresa, no una persona.
 */
const CORREO_DEL_EQUIPO = 'renaserlab@gmail.com'

export function PoliticaPublica() {
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
          Qué datos te pedimos cuando postulas a una vacante, para qué los usamos y cómo pides
          que los borremos.
        </p>
      </header>

      <section className={estilos.seccion}>
        <h2>Qué datos recogemos</h2>
        <p>Solo lo que hace falta para evaluar tu candidatura, y en el momento en que hace falta:</p>
        <ul className={estilos.lista}>
          <li>
            <strong>Al crear tu cuenta:</strong> tu nombre, tu correo electrónico y una
            contraseña.
          </li>
          <li>
            <strong>Al postular:</strong> tu currículum, en PDF o Word, y tus respuestas a los
            requisitos indispensables de esa vacante.
          </li>
          <li>
            <strong>Durante el proceso:</strong> tus respuestas a la evaluación y a la prueba del
            puesto, y si asististe a la sesión de simulación a la que te inscribiste.
          </li>
        </ul>
        <p>
          Nada de esto se recoge sin que tú lo envíes, y antes de tu primera postulación te
          pedimos tu consentimiento expreso conforme a la Ley 29733 de Protección de Datos
          Personales.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Quién trata tus datos</h2>
        <p>
          <strong>Renaser Consulting</strong> opera EX y es responsable de la plataforma. Las
          vacantes que ves las publican empresas que la usan para seleccionar personal, y cada
          una es responsable de los datos de quienes postulan a sus vacantes. En la ficha de
          cada vacante se indica de qué empresa es.
        </p>
        <p>
          Para cualquier asunto sobre tus datos puedes escribirnos a{' '}
          <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a> y lo encaminamos a
          quien corresponda.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Para qué los usamos</h2>
        <p>
          Para evaluar tu candidatura a las vacantes a las que postulas y para comunicarnos
          contigo sobre tu proceso. Si además diste tu consentimiento para futuras
          oportunidades, para avisarte cuando se abra una vacante que encaje con tu perfil.
        </p>
        <p>
          <strong>La base legal es tu consentimiento</strong>, que te pedimos de forma expresa
          antes de tu primera postulación conforme a la Ley 29733. Son dos permisos separados y
          el segundo es opcional: si no lo das, tu postulación sigue igual de válida.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Una inteligencia artificial participa, y una persona decide</h2>
        <p>
          Tu currículum y tus respuestas se procesan con inteligencia artificial para ordenarlos
          y puntuarlos. <strong>Ninguna decisión sobre tu candidatura se toma automáticamente:
          una persona del equipo revisa y confirma</strong> antes de que tu proceso avance o se
          cierre.
        </p>
        <p>
          Para que eso sea posible, tus datos se comparten con las empresas que publican las
          vacantes a las que postulas, con proveedores de servicios de inteligencia artificial
          que los procesan por encargo nuestro, y con los proveedores de infraestructura donde
          se alojan. No vendemos tus datos ni los usamos para publicidad.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Cuánto los conservamos</h2>
        <p>
          Mientras tu candidatura esté en curso y mientras mantengas tu cuenta. Si diste el
          permiso de futuras oportunidades, los conservamos también para eso hasta que lo
          retires. <strong>Puedes pedir el borrado en cualquier momento</strong>, y no hace falta
          que expliques por qué.
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2>Tus derechos</h2>
        <p>
          La Ley 29733 te da derecho a saber qué datos tuyos tenemos, a corregirlos si están
          mal, a que dejemos de usarlos y a que los borremos. Los tres primeros los ejerces
          desde <Link to={rutas.perfil()}>tu perfil</Link>, donde puedes ver y editar todo lo que
          hay sobre ti; el último, con el botón de borrado que se explica más abajo.
        </p>
        <p>
          Si algo de esto no funciona o prefieres pedirlo por escrito, escríbenos a{' '}
          <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a>.
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
            <strong>Salir de futuras oportunidades:</strong> dejamos de contactarte para vacantes
            nuevas. Tus procesos en curso no se tocan.
          </li>
          <li>
            <strong>Pedir el borrado de tus datos:</strong> eliminamos tus datos personales y tus
            respuestas. Se conserva el registro de auditoría, pero sin identificarte.
          </li>
        </ul>
      </section>

      <section className={estilos.seccion}>
        <h2>Cómo pides que borremos tus datos</h2>
        <p>Hay dos caminos, y el segundo existe para cuando el primero no es posible:</p>
        <ul className={estilos.lista}>
          <li>
            <strong>Desde tu cuenta:</strong> entra y ve a{' '}
            <Link to={rutas.privacidad()}>Privacidad y control</Link>. Ahí puedes pedir el borrado
            tú mismo. Vale igual desde la aplicación o desde el navegador.
          </li>
          <li>
            <strong>Escribiéndonos:</strong> si perdiste el acceso a tu cuenta, o prefieres no
            entrar, mándanos un correo a <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a>{' '}
            desde la dirección con la que te registraste y lo tramitamos nosotros.
          </li>
        </ul>
        <div className={estilos.contacto}>
          <p>
            <strong>Borrar tu cuenta borra también tus postulaciones.</strong> Si estás en un
            proceso abierto, quedará cerrado y no podrás retomarlo.
          </p>
          <p>
            Para cualquier duda sobre tus datos, escríbenos a{' '}
            <a href={`mailto:${CORREO_DEL_EQUIPO}`}>{CORREO_DEL_EQUIPO}</a>.
          </p>
        </div>
      </section>
    </div>
  )
}
