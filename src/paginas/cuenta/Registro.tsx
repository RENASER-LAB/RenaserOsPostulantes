/**
 * Crear cuenta.
 *
 * Cuatro cosas que no son negociables aquí:
 *
 *   - **La ciudad es obligatoria y se dice antes de pulsar.** Es el único sitio
 *     del producto donde entra el dato —a quien ya tiene cuenta no se le vuelve a
 *     preguntar—, y el equipo de Talento criba la tanda por dónde vive la gente:
 *     una cuenta sin ciudad nace ya incompleta. El texto de ayuda del desplegable
 *     («Elige tu ciudad…», con valor `''`) no cuenta como elección, y sin ella el
 *     formulario no se envía: se marca el campo con «Selecciona tu ciudad» y se
 *     conserva todo lo demás escrito.
 *
 *   - **Son dos consentimientos distintos.** Aceptar el tratamiento de datos por
 *     Renaser es obligatorio; querer avisos de futuras vacantes es aparte y
 *     opcional, y se retira por otra ruta. Juntarlos en una sola casilla sería
 *     pedir un permiso que nadie dio.
 *   - **Aquí no se acepta ninguna vacante.** Lo que se firma es el permiso con
 *     Renaser —la cuenta, el perfil, la inteligencia artificial, los proveedores
 *     de fuera del país, el plazo—. El permiso de cada empresa se firma al
 *     postular a la suya, en `Postular`. Hasta la V54 esta pantalla pedía el
 *     texto de la vacante y quien postulaba luego a una de Renaser firmaba dos
 *     veces lo mismo.
 *   - **El texto legal no se resume aquí**, se enlaza. El que vale es el que está
 *     publicado en `/politica-de-privacidad`, no el que copió una pantalla.
 *
 * ⚠️ **Las explicaciones son deliberadamente cortas, por decisión del producto**
 * (15/09/2026). La version anterior nombraba aquí la inteligencia artificial y
 * los proveedores de fuera del Perú, que es la primera capa del aviso por capas:
 * lo que hace defendible que el resto viva detrás de un enlace. Al quitarla, TODO
 * el peso informativo recae en la política — si ese enlace se rompe o el documento
 * se recorta, el consentimiento deja de estar informado. Es lo que hay que mirar
 * antes de tocar cualquiera de los dos.
 *
 * El registro recuerda a qué vacante se estaba postulando: quien llega desde una
 * ficha sigue con su postulación al terminar, no vuelve a la portada a buscarla.
 */

import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { catalogoUbigeo } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
// Las provincias por departamento, con `EXT` suelto al final: la misma regla que
// el desplegable de ciudad del panel, escrita una vez en `dominio/ubigeo`.
import { agrupadasPorDepartamento } from '@/dominio/ubigeo'
import { rutas } from '@/rutas'
import { Campo, Consentimiento, Seleccion } from '@/ui/campos/Campo'
import estilos from './Cuenta.module.css'

const Datos = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe tu nombre.'),
    apellidos: z.string().trim().min(1, 'Escribe tus apellidos.'),
    correo: z
      .string()
      .min(1, 'Escribe tu correo.')
      .email('Esto no parece un correo. Revisa que tenga arroba y dominio.'),
    // El mismo mínimo que exige el backend: si aquí fuera menor, el envío
    // rebotaría con un error que la pantalla no supo prevenir.
    contrasena: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.'),
    repetir: z.string().min(1, 'Repite la contraseña.'),
    /*
      ⚠️ **`min(1)` y no `z.string()` a secas.** La primera opción del
      desplegable vale `''` —hace falta para que se vea que no hay nada elegido—
      y una cadena vacía es una cadena válida: sin este mínimo el formulario se
      enviaba con la ciudad sin poner y el backend lo rebotaba con un 400 que la
      pantalla no supo prevenir. Es la misma trampa que ya documentan las listas
      del perfil.

      ⚠️ **El mensaje es esta frase exacta, y sin punto final.** Es la que pidió
      el cliente y la que comprueba la prueba de la pantalla; el resto de los
      mensajes de este formulario acaban en punto, así que la tentación de
      «arreglarlo» es real. No es un descuido.
    */
    ciudadUbigeo: z.string().trim().min(1, 'Selecciona tu ciudad'),
    aceptaPlataforma: z.literal(true, {
      message: 'Sin este permiso no podemos crear tu cuenta.',
    }),
    aceptaFuturosContactos: z.boolean(),
  })
  .refine((d) => d.contrasena === d.repetir, {
    message: 'Las dos contraseñas no coinciden.',
    path: ['repetir'],
  })

type Campos = z.infer<typeof Datos>
type Errores = Partial<Record<keyof Campos, string>>

const VACIO = {
  nombre: '',
  apellidos: '',
  correo: '',
  contrasena: '',
  repetir: '',
  ciudadUbigeo: '',
  aceptaPlataforma: false,
  aceptaFuturosContactos: false,
}

/**
 * Qué campos llevan asterisco: los que el esquema NO deja pasar vacíos.
 *
 * ⚠️ **Se deduce del esquema, no se escribe a mano.** Una lista escrita aparte
 * envejece sola: el día que una validación se afloje —o que llegue un campo
 * nuevo— la pantalla seguiría marcando lo de antes, y un asterisco que miente es
 * peor que ninguno. Aquí la única fuente es `Datos`.
 *
 * La pregunta que se le hace a cada campo es «¿vale su valor vacío?»: `''` para
 * el texto y `false` para las casillas. Por eso el permiso obligatorio
 * —`z.literal(true)`, que rechaza `false`— sale marcado, y el de futuras
 * vacantes —`z.boolean()`, al que `false` le vale— no. Preguntar por `undefined`
 * no serviría: a `z.boolean()` tampoco le vale, y saldría marcado todo.
 */
const OBLIGATORIOS: ReadonlySet<keyof Campos> = new Set(
  (Object.keys(VACIO) as (keyof Campos)[]).filter(
    (campo) => !Datos.shape[campo].safeParse(VACIO[campo]).success,
  ),
)

/** Si el esquema exige ese campo; es lo que pinta el asterisco de su etiqueta. */
const exigido = (campo: keyof Campos) => OBLIGATORIOS.has(campo)

export function Registro() {
  const { registrar } = useSesion()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const vacante = params.get('vacante')

  const [valores, setValores] = useState(VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cuantosFaltan = Object.keys(errores).length

  /*
    El catálogo de provincias, público como los textos legales: quien está
    creando su cuenta todavía no tiene token con el que pedirlo.
  */
  const ubigeo = useQuery({ queryKey: ['catalogo-ubigeo'], queryFn: catalogoUbigeo })
  const { departamentos, sueltas } = useMemo(
    () => agrupadasPorDepartamento(Array.isArray(ubigeo.data) ? ubigeo.data : []),
    [ubigeo.data],
  )

  /*
    Aqui se pedian los textos legales al backend para pintarlos plegados bajo cada
    casilla. Ya no: esta pantalla no necesita el documento, solo el enlace a
    `/politica-de-privacidad`, que los enseña publicados palabra por palabra. Una
    peticion menos en el formulario de alta, que es el peor sitio para esperar.
  */

  /*
    Al corregir un campo se le retira su error. Sin esto, quien eligió su ciudad
    después del rebote seguía leyendo «Selecciona tu ciudad» debajo de la ciudad
    que acababa de elegir, y el resumen de arriba seguía contándola como pendiente:
    el aviso decía lo contrario de lo que la pantalla mostraba.
  */
  function cambiar<C extends keyof typeof VACIO>(campo: C, valor: (typeof VACIO)[C]) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => {
      if (e[campo] === undefined) return e
      const quedan = { ...e }
      // Se borra la clave, no se pone en `undefined`: el resumen de arriba cuenta
      // las claves del objeto, y una clave vacia seguiria sumando un dato que ya
      // no falta.
      delete quedan[campo]
      return quedan
    })
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)

    const revision = Datos.safeParse(valores)
    if (!revision.success) {
      const nuevos: Errores = {}
      for (const problema of revision.error.issues) {
        const campo = problema.path[0] as keyof Campos
        nuevos[campo] ??= problema.message
      }
      setErrores(nuevos)
      // El primer campo con problema recibe el foco: si no, en un formulario
      // largo el error queda fuera de la pantalla y parece que no pasó nada.
      requestAnimationFrame(() => {
        const primero = document.querySelector<HTMLElement>('[aria-invalid="true"]')
        primero?.focus()
      })
      return
    }

    setErrores({})
    setEnviando(true)
    try {
      await registrar({
        nombre: revision.data.nombre,
        apellidos: revision.data.apellidos,
        correo: revision.data.correo,
        contrasena: revision.data.contrasena,
        ciudadUbigeo: revision.data.ciudadUbigeo,
        // Del formulario y no un `true` a pelo: hoy el esquema solo deja pasar `true`
        // —`z.literal(true)`—, pero el backend firma este dato con la fecha y la IP, y
        // firmar una constante en vez de lo que la persona marcó es la clase de atajo que
        // sobrevive al día en que la casilla deje de ser obligatoria.
        aceptaPlataforma: revision.data.aceptaPlataforma,
        aceptaFuturosContactos: revision.data.aceptaFuturosContactos,
      })
      navegar(vacante ? rutas.postular(vacante) : rutas.procesos())
    } catch (causa) {
      setFallo(
        causa instanceof Error
          ? causa.message
          : 'No pudimos crear tu cuenta. Vuelve a intentarlo en un momento.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={estilos.paginaAncha}>
      {vacante && (
        <Link className={estilos.volver} to={rutas.vacante(vacante)}>
          ← Volver al puesto
        </Link>
      )}

      <h1 className={estilos.titular}>Crea tu cuenta.</h1>
      {/*
        Solo cuando se viene de una vacante: ahi la frase hace un trabajo —dice
        que la postulacion no se pierde por crear la cuenta en medio—. Llegando
        por tu cuenta no habia nada que contar, y un parrafo de relleno bajo el
        titulo solo aleja el primer campo.
      */}
      {vacante && (
        <p className={estilos.bajada}>
          Al terminar seguimos con tu postulación, justo donde la dejaste.
        </p>
      )}

      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        {/* Cuantos faltan, antes de que empiece a buscarlos por su cuenta. */}
        <p aria-live="polite" className={cuantosFaltan > 0 ? estilos.resumenErrores : estilos.oculto}>
          {cuantosFaltan > 0 &&
            (cuantosFaltan === 1
              ? 'Falta un dato por revisar. Te lo marcamos abajo.'
              : `Faltan ${cuantosFaltan} datos por revisar. Te los marcamos abajo.`)}
        </p>

        {/*
          Qué significa el asterisco, dicho una vez y antes del primer campo.
          Con siete marcas en la pantalla, un símbolo sin explicar es un símbolo
          que cada cual interpreta. Va después del resumen de errores a propósito:
          cuando hay algo que corregir, eso es lo primero que hay que leer.

          Para el lector de pantalla esta línea es de más —cada etiqueta ya dice
          «obligatorio» por su cuenta—, pero tampoco estorba: es una frase corta y
          se oye una sola vez, al entrar al formulario.
        */}
        <p className={estilos.leyendaObligatorios}>
          Los campos con <span className={estilos.obligatorioEnLaLeyenda}>*</span> son
          obligatorios.
        </p>

        <div className={estilos.pareja}>
          <Campo
            etiqueta="Nombre"
            obligatorio={exigido('nombre')}
            autoComplete="given-name"
            value={valores.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            error={errores.nombre}
          />
          <Campo
            etiqueta="Apellidos"
            obligatorio={exigido('apellidos')}
            autoComplete="family-name"
            value={valores.apellidos}
            onChange={(e) => cambiar('apellidos', e.target.value)}
            error={errores.apellidos}
          />
        </div>

        <Campo
          etiqueta="Correo"
          obligatorio={exigido('correo')}
          type="email"
          autoComplete="email"
          value={valores.correo}
          onChange={(e) => cambiar('correo', e.target.value)}
          error={errores.correo}
        />

        {/*
          Un solo desplegable con las provincias agrupadas por departamento, no
          dos encadenados: dos obligan a esperar una petición entre el primero y
          el segundo, y aquí solo se pregunta una cosa.

          ⚠️ **Se pide UNA vez, al crear la cuenta.** A quien ya tiene cuenta no
          se le pregunta nunca, así que esta pantalla es el único sitio del
          producto donde entra el dato.
        */}
        {/*
          ⚠️ **La etiqueta es «Ciudad», y eso cambió el 17/09/2026.** Se llamó
          «Dónde vives» y luego «Ubicación» (15/09). Ahora dice lo mismo que el
          dato que guarda —`ciudadUbigeo`—, lo mismo que la columna del panel y lo
          mismo que el aviso cuando falta: tres nombres distintos para un solo
          campo obligan a quien lo lee a adivinar que hablan de lo mismo.

          Sin `ayuda`: las ayudas de campo de este formulario se quitaron a
          propósito el 15/09, y lo que explicaría —que son provincias y que «Fuera
          del Perú» existe— ya se lee en el propio desplegable.
        */}
        <Seleccion
          etiqueta="Ciudad"
          obligatorio={exigido('ciudadUbigeo')}
          value={valores.ciudadUbigeo}
          onChange={(e) => cambiar('ciudadUbigeo', e.target.value)}
          disabled={ubigeo.isPending || ubigeo.isError}
          /*
            ⚠️ **Un fallo del catálogo se dice, no se disimula.** Sin la lista no
            se puede crear la cuenta —el campo es obligatorio— y un desplegable
            apagado y mudo deja a la persona pulsando «Crear cuenta» contra un
            error que no explica nada.

            Y el fallo del catálogo tapa el de «no has elegido»: sin lista, que
            no haya ciudad elegida no es culpa de nadie, y pedirle que elija de
            un desplegable vacío sería echarle la culpa del fallo.
          */
          error={
            ubigeo.isError
              ? 'No pudimos cargar la lista de ciudades. Vuelve a intentarlo.'
              : errores.ciudadUbigeo
          }
        >
          <option value="">
            {ubigeo.isPending ? 'Cargando las ciudades…' : 'Elige tu ciudad…'}
          </option>
          {departamentos.map(([departamento, provincias]) => (
            <optgroup key={departamento} label={departamento}>
              {provincias.map((provincia) => (
                <option key={provincia.codigo} value={provincia.codigo}>
                  {provincia.nombre}
                </option>
              ))}
            </optgroup>
          ))}
          {/* `EXT` y cualquier otro sin departamento: sueltas al final, porque
              no cuelgan de ningún sitio del Perú. */}
          {sueltas.map((opcion) => (
            <option key={opcion.codigo} value={opcion.codigo}>
              {opcion.nombre}
            </option>
          ))}
        </Seleccion>
        {/*
          Reintentar sin perder lo escrito. Antes el aviso decía «recarga la
          página», que con este formulario a medias es pedirle que lo escriba
          otra vez por un fallo que no es suyo. `type="button"`: dentro de un
          formulario, uno sin tipo envía —la trampa que este portal ya pagó.
        */}
        {ubigeo.isError && (
          <button
            type="button"
            className={estilos.reintentarCatalogo}
            onClick={() => void ubigeo.refetch()}
            disabled={ubigeo.isFetching}
          >
            {ubigeo.isFetching ? 'Cargando las ciudades…' : 'Volver a cargar las ciudades'}
          </button>
        )}

        <div className={estilos.pareja}>
          <Campo
            etiqueta="Contraseña"
            obligatorio={exigido('contrasena')}
            type="password"
            autoComplete="new-password"
            ayuda="Al menos 8 caracteres."
            value={valores.contrasena}
            onChange={(e) => cambiar('contrasena', e.target.value)}
            error={errores.contrasena}
          />
          <Campo
            etiqueta="Repite la contraseña"
            obligatorio={exigido('repetir')}
            type="password"
            autoComplete="new-password"
            value={valores.repetir}
            onChange={(e) => cambiar('repetir', e.target.value)}
            error={errores.repetir}
          />
        </div>

        <div className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>Antes de seguir, dos permisos</h2>

          <Consentimiento
            titulo="Acepto el tratamiento de mis datos"
            obligatorio={exigido('aceptaPlataforma')}
            explicacion={
              <>
                Puedes leer el permiso entero en la{' '}
                <Link to={rutas.politica(rutas.anclaDeLosTextos)} target="_blank" rel="noreferrer">
                  política de privacidad
                </Link>
                .
              </>
            }
            marcado={valores.aceptaPlataforma}
            checked={valores.aceptaPlataforma}
            onChange={(e) => cambiar('aceptaPlataforma', e.target.checked)}
            error={errores.aceptaPlataforma}
          />

          <Consentimiento
            titulo="Quiero que me avisen de futuras vacantes"
            obligatorio={exigido('aceptaFuturosContactos')}
            explicacion="Conserva tu perfil para avisarte de otras vacantes. Es un permiso aparte y lo retiras cuando quieras."
            marcado={valores.aceptaFuturosContactos}
            checked={valores.aceptaFuturosContactos}
            onChange={(e) => cambiar('aceptaFuturosContactos', e.target.checked)}
          />
        </div>

        {fallo && (
          <p className={estilos.falloEnvio} role="alert">
            {fallo}
          </p>
        )}

        <button
          type="submit"
          className={estilos.enviar}
          disabled={enviando}
          data-rotulo={enviando ? 'Creando tu cuenta…' : 'Crear cuenta y seguir'}
        >
          {enviando ? 'Creando tu cuenta…' : 'Crear cuenta y seguir'}
        </button>
      </form>

      <p className={estilos.pie}>
        ¿Ya tienes cuenta?{' '}
        <Link to={vacante ? rutas.ingresar(vacante) : rutas.ingresar()}>Entra aquí</Link>
        .
      </p>
    </div>
  )
}
