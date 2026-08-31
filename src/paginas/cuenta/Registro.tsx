/**
 * Crear cuenta.
 *
 * Dos cosas que no son negociables aquí:
 *
 *   - **Son dos consentimientos distintos.** Aceptar el tratamiento de datos
 *     para este proceso es obligatorio; querer avisos de futuras vacantes es
 *     aparte y opcional, y se retira por otra ruta. Juntarlos en una sola
 *     casilla sería pedir un permiso que nadie dio.
 *   - **El texto legal va a crecer.** Los textos vigentes todavía no nombran a
 *     las empresas que procesan los datos, y tienen que hacerlo antes del primer
 *     candidato real. Por eso el bloque los sirve del backend y les da su propio
 *     espacio con scroll, en vez de resumirlos aquí.
 *
 * El registro recuerda a qué vacante se estaba postulando: quien llega desde una
 * ficha sigue con su postulación al terminar, no vuelve a la portada a buscarla.
 */

import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { catalogoUbigeo, textosConsentimiento } from '@/api/portal'
import type { OpcionUbigeo } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { Campo, Consentimiento, Seleccion } from '@/ui/campos/Campo'
import estilos from './Cuenta.module.css'

/**
 * Las provincias, repartidas por departamento y en el orden en que llegan.
 *
 * ⚠️ **`EXT` no tiene departamento y sale aparte.** Metido en un `<optgroup>`
 * con `label={null}` el navegador pinta un grupo llamado «null»; y colgándolo de
 * un departamento inventado diría que el extranjero está en algún sitio del
 * Perú. Va suelto al final, que es donde se busca.
 *
 * El catálogo llega ya ordenado por departamento y nombre, así que aquí no se
 * reordena nada: solo se agrupa respetando el orden de llegada.
 */
function agrupadasPorDepartamento(
  opciones: OpcionUbigeo[],
): { departamentos: [string, OpcionUbigeo[]][]; sueltas: OpcionUbigeo[] } {
  const departamentos = new Map<string, OpcionUbigeo[]>()
  const sueltas: OpcionUbigeo[] = []
  for (const opcion of opciones) {
    if (opcion.departamento == null) {
      sueltas.push(opcion)
      continue
    }
    const ya = departamentos.get(opcion.departamento)
    if (ya) ya.push(opcion)
    else departamentos.set(opcion.departamento, [opcion])
  }
  return { departamentos: [...departamentos.entries()], sueltas }
}

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
    */
    ciudadUbigeo: z.string().min(1, 'Elige dónde vives.'),
    aceptaProceso: z.literal(true, {
      message: 'Sin este permiso no podemos evaluar tu candidatura.',
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
  aceptaProceso: false,
  aceptaFuturosContactos: false,
}

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

  // Los textos legales vigentes los sirve el backend, y son públicos.
  const textos = useQuery({ queryKey: ['consentimientos'], queryFn: textosConsentimiento })
  const legales = Array.isArray(textos.data) ? textos.data : []
  const legalDe = (tipo: string) =>
    legales.find((t) => t.tipo?.toUpperCase().includes(tipo))?.texto

  function cambiar<C extends keyof typeof VACIO>(campo: C, valor: (typeof VACIO)[C]) {
    setValores((v) => ({ ...v, [campo]: valor }))
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
        aceptaProceso: true,
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
    <div className={`${estilos.pagina} ${estilos.paginaAncha}`}>
      {vacante && (
        <Link className={estilos.volver} to={rutas.vacante(vacante)}>
          ← Volver al puesto
        </Link>
      )}

      <h1>Crea tu cuenta.</h1>
      <p className={estilos.bajada}>
        {vacante
          ? 'Al terminar seguimos con tu postulación, justo donde la dejaste.'
          : 'Con ella podrás postular y seguir el estado de tu proceso.'}
      </p>

      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        {/* Cuantos faltan, antes de que empiece a buscarlos por su cuenta. */}
        <p aria-live="polite" className={cuantosFaltan > 0 ? estilos.resumenErrores : estilos.oculto}>
          {cuantosFaltan > 0 &&
            (cuantosFaltan === 1
              ? 'Falta un dato por revisar. Te lo marcamos abajo.'
              : `Faltan ${cuantosFaltan} datos por revisar. Te los marcamos abajo.`)}
        </p>

        <div className={estilos.pareja}>
          <Campo
            etiqueta="Nombre"
            autoComplete="given-name"
            value={valores.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            error={errores.nombre}
          />
          <Campo
            etiqueta="Apellidos"
            autoComplete="family-name"
            value={valores.apellidos}
            onChange={(e) => cambiar('apellidos', e.target.value)}
            error={errores.apellidos}
          />
        </div>

        <Campo
          etiqueta="Correo"
          type="email"
          autoComplete="email"
          ayuda="Aquí te escribiremos cuando tu proceso avance."
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
        <Seleccion
          etiqueta="Dónde vives"
          ayuda={
            ubigeo.isError
              ? undefined
              : 'La provincia donde vives ahora. Sirve para avisarte de vacantes cerca de ti.'
          }
          value={valores.ciudadUbigeo}
          onChange={(e) => cambiar('ciudadUbigeo', e.target.value)}
          disabled={ubigeo.isPending || ubigeo.isError}
          /*
            ⚠️ **Un fallo del catálogo se dice, no se disimula.** Sin la lista no
            se puede crear la cuenta —el campo es obligatorio— y un desplegable
            apagado y mudo deja a la persona pulsando «Crear cuenta» contra un
            error que no explica nada.
          */
          error={
            ubigeo.isError
              ? 'No pudimos cargar la lista de provincias. Recarga la página e inténtalo otra vez.'
              : errores.ciudadUbigeo
          }
        >
          <option value="">
            {ubigeo.isPending ? 'Cargando las provincias…' : 'Elige tu provincia…'}
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

        <div className={estilos.pareja}>
          <Campo
            etiqueta="Contraseña"
            type="password"
            autoComplete="new-password"
            ayuda="Al menos 8 caracteres."
            value={valores.contrasena}
            onChange={(e) => cambiar('contrasena', e.target.value)}
            error={errores.contrasena}
          />
          <Campo
            etiqueta="Repite la contraseña"
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
            titulo="Tratamiento de mis datos para este proceso"
            obligatorio
            explicacion="Para evaluar tu candidatura, tu currículum y tus respuestas se procesan con servicios de terceros."
            legal={legalDe('PROCESO')}
            marcado={valores.aceptaProceso}
            checked={valores.aceptaProceso}
            onChange={(e) => cambiar('aceptaProceso', e.target.checked)}
            error={errores.aceptaProceso}
          />

          <Consentimiento
            titulo="Quiero que me avisen de futuras vacantes"
            explicacion="Es un permiso aparte y puedes retirarlo cuando quieras. Si no lo marcas, tu postulación sigue igual de válida."
            legal={legalDe('FUTUROS')}
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

        <button type="submit" className={estilos.enviar} disabled={enviando}>
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
