import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const VARIABLES = ['E2E_PG', 'PGUSER', 'PGDATABASE', 'E2E_CLONE_ID', 'E2E_API', 'E2E_PORTAL'] as const
type Variable = typeof VARIABLES[number]
export type Configuracion = Record<Variable, string>
export type Ejecutar = (args: string[], entrada?: string) => string

export function configuracion(entorno: NodeJS.ProcessEnv = process.env): Configuracion {
  for (const nombre of VARIABLES) {
    if (!entorno[nombre]?.trim()) throw new Error(`Falta ${nombre}: declara explícitamente el clon E2E.`)
  }
  const config = Object.fromEntries(VARIABLES.map(nombre => [nombre, entorno[nombre]!])) as Configuracion
  for (const nombre of ['E2E_API', 'E2E_PORTAL'] as const) {
    const url = new URL(config[nombre])
    if (!['http:', 'https:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.username || url.password || url.search || url.hash) {
      throw new Error(`${nombre} debe ser una URL HTTP de loopback sin credenciales, query ni fragmento.`)
    }
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(config.E2E_PG)) throw new Error('E2E_PG no es un nombre o ID de contenedor válido.')
  // Evita que psql interprete PGDATABASE como conninfo o URI y redirija la conexión.
  for (const nombre of ['PGDATABASE', 'PGUSER'] as const) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(config[nombre])) throw new Error(`${nombre} debe ser un identificador simple.`)
  }
  return config
}

const ejecutarDocker: Ejecutar = (args, entrada) => {
  try {
    return execFileSync('docker', args, {
      input: entrada, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
    })
  } catch (causa) {
    const detalle = (causa as { stderr?: Buffer | string }).stderr?.toString().trim()
    throw new Error(`Falló Docker/SQL del clon E2E: ${detalle || String(causa)}`, { cause: causa })
  }
}

type Contenedor = { Id: string; State: { Running: boolean }; Config: { Labels?: Record<string, string> } }

/** Resuelve una vez. Ninguna consulta vuelve a enlazarse a un contenedor sustituto. */
export class BaseDeDatos {
  readonly id: string
  constructor(readonly config: Configuracion, private ejecutar: Ejecutar = ejecutarDocker, idEsperado?: string) {
    const info = this.inspeccionar(config.E2E_PG)
    this.id = info.Id
    if (idEsperado && this.id !== idEsperado) throw new Error('El contenedor del clon fue sustituido.')
    this.validar(info)
    const efectivo = JSON.parse(this.sql('select json_build_array(current_database(), current_user);'))
    if (efectivo[0] !== config.PGDATABASE || efectivo[1] !== config.PGUSER) {
      throw new Error('La base o el usuario efectivos no coinciden con la configuración E2E.')
    }
  }
  private inspeccionar(destino: string): Contenedor {
    return JSON.parse(this.ejecutar(['inspect', '--type=container', destino]))[0]
  }
  private validar(info: Contenedor) {
    if (info.Id !== this.id) throw new Error('El contenedor del clon fue sustituido.')
    if (!info.State.Running) throw new Error('El contenedor del clon está detenido.')
    const etiquetas = info.Config.Labels ?? {}
    if (!['claude-harness.job', 'renaser.e2e.clone'].some(k => etiquetas[k] === this.config.E2E_CLONE_ID)) {
      throw new Error('La identidad de la etiqueta del clon no coincide con E2E_CLONE_ID.')
    }
  }
  sql(consulta: string): string {
    // Comprueba también el nombre: renombrar el original y reutilizar el nombre debe fallar.
    this.validar(this.inspeccionar(this.config.E2E_PG))
    return this.ejecutar(['exec', '-i', this.id, 'psql', '-X', '-q', '-A', '-t',
      '-h', '/var/run/postgresql', '-U', this.config.PGUSER, '-d', this.config.PGDATABASE,
      '-v', 'ON_ERROR_STOP=1'], consulta).trim()
  }
  reservar(): () => void {
    this.validar(this.inspeccionar(this.config.E2E_PG))
    // mkdir es atómico y coordina también worktrees/directorios diferentes.
    const ruta = '/tmp/renaser-e2e-en-ejecucion'
    try { this.ejecutar(['exec', this.id, 'mkdir', ruta]) }
    catch (causa) { throw new Error('El clon ya está reservado por otra ejecución E2E; conserva e inspecciona el clon.', { cause: causa }) }
    return () => { this.ejecutar(['exec', this.id, 'rmdir', ruta]) }
  }
}

let conexion: BaseDeDatos | undefined
export function baseDeDatos(): BaseDeDatos {
  return conexion ??= new BaseDeDatos(configuracion(), ejecutarDocker, process.env.E2E_CONTAINER_ID)
}
export const sql = (consulta: string): string => baseDeDatos().sql(consulta)
export const literal = (valor: string | number | null): string => valor === null ? 'null' :
  typeof valor === 'number' ? (Number.isFinite(valor) ? String(valor) : (() => { throw new Error('Número SQL inválido') })()) :
  `E'${valor.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`
export const correoDePrueba = (prefijo: string): string => {
  if (!/^[a-z0-9.]+$/.test(prefijo)) throw new Error('Prefijo de correo inválido.')
  return `${prefijo}.${randomUUID()}@example.com`
}
export function seleccionDeCorreos(correos: readonly string[]): string {
  if (!correos.length || correos.some(c => !/^[a-z0-9.-]+@example\.com$/.test(c))) {
    throw new Error('La limpieza exige una lista explícita de correos de prueba.')
  }
  return [...new Set(correos)].map(literal).join(', ')
}

/** Ejecuta todas las restauraciones y comunica todos los errores, incluso tras un test fallido. */
export async function limpiarSiempre(acciones: (() => void | Promise<void>)[]): Promise<void> {
  const errores: unknown[] = []
  for (const accion of acciones) { try { await accion() } catch (error) { errores.push(error) } }
  if (errores.length) throw new AggregateError(errores,
    `Falló la limpieza E2E; conserva el clon para inspección:\n${errores.map(String).join('\n')}`)
}
