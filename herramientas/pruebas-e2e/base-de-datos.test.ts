import { describe, expect, it, vi } from 'vitest'
import { BaseDeDatos, configuracion, correoDePrueba, limpiarSiempre, literal, seleccionDeCorreos } from '../e2e/base-de-datos'
import { borrarCuentasDePrueba } from '../e2e/limpieza-cuentas'
import { guardarRemuneracion } from '../e2e/estado-remuneracion'

const entorno = { E2E_PG: 'clon', PGUSER: 'qa_app', PGDATABASE: 'qa_base', E2E_CLONE_ID: 'trabajo',
  E2E_API: 'http://127.0.0.1:9001/api/v1', E2E_PORTAL: 'http://localhost:9002' }
function docker(etiqueta = 'renaser.e2e.clone') {
  const info = { Id: 'a'.repeat(64), State: { Running: true }, Config: { Labels: { [etiqueta]: 'trabajo' } } }
  const ejecutar = vi.fn((args: string[], _sql?: string): string => args[0] === 'inspect' ? JSON.stringify([info]) :
    args.includes('psql') ? '["qa_base","qa_app"]' : '')
  return { info, ejecutar }
}

describe('conexión E2E aislada', () => {
  it.each(Object.keys(entorno))('exige %s antes de tocar Docker', nombre => {
    expect(() => configuracion({ ...entorno, [nombre]: '' })).toThrow('Falta')
  })
  it.each(['https://example.com', 'http://localhost.evil.test', 'file:///tmp/test', 'http://user@localhost',
    'http://localhost/?target=remote', 'http://192.168.1.2'])('rechaza URL externa o ambigua %s', url => {
    for (const nombre of ['E2E_API', 'E2E_PORTAL']) expect(() => configuracion({ ...entorno, [nombre]: url })).toThrow()
  })
  it.each(['http://localhost', 'http://127.0.0.1:4567', 'http://[::1]:4567'])('acepta loopback %s', url => {
    expect(configuracion({ ...entorno, E2E_API: url }).E2E_API).toBe(url)
  })
  it.each(['postgresql://remote/db', 'host=remote dbname=test'])('no interpreta PGDATABASE como conexión %s', PGDATABASE => {
    expect(() => configuracion({ ...entorno, PGDATABASE })).toThrow('identificador')
  })
  it.each(['claude-harness.job', 'renaser.e2e.clone'])('acepta la etiqueta %s y fija el ID', etiqueta => {
    const { ejecutar, info } = docker(etiqueta)
    const db = new BaseDeDatos(configuracion(entorno), ejecutar)
    db.sql('begin; select 1; commit;')
    expect(ejecutar).toHaveBeenLastCalledWith(expect.arrayContaining(['exec', '-i', info.Id, '-X', 'ON_ERROR_STOP=1']), 'begin; select 1; commit;')
    expect(ejecutar.mock.calls.filter(([args]) => args[0] === 'exec').every(([args]) => !args.includes('clon'))).toBe(true)
  })
  it('rechaza identidad incorrecta antes de SQL', () => {
    const { ejecutar, info } = docker(); info.Config.Labels['renaser.e2e.clone'] = 'ajeno'
    expect(() => new BaseDeDatos(configuracion(entorno), ejecutar)).toThrow('identidad')
    expect(ejecutar.mock.calls.some(([args]) => args[0] === 'exec')).toBe(false)
  })
  it('rechaza un contenedor detenido', () => {
    const { ejecutar, info } = docker(); info.State.Running = false
    expect(() => new BaseDeDatos(configuracion(entorno), ejecutar)).toThrow('detenido')
  })
  it('no reconecta al sustituir el contenedor ni al reiniciar un worker', () => {
    const { ejecutar, info } = docker(); const db = new BaseDeDatos(configuracion(entorno), ejecutar)
    info.Id = 'b'.repeat(64); ejecutar.mockClear()
    expect(() => db.sql('delete from usuario;')).toThrow('sustituido')
    expect(() => new BaseDeDatos(configuracion(entorno), ejecutar, db.id)).toThrow('sustituido')
    expect(ejecutar.mock.calls.some(([args]) => args[0] === 'exec')).toBe(false)
  })
  it('propaga desaparición y errores SQL sin reintentos', () => {
    const { ejecutar } = docker(); const db = new BaseDeDatos(configuracion(entorno), ejecutar)
    ejecutar.mockImplementationOnce(() => { throw new Error('No such container') })
    expect(() => db.sql('select 1')).toThrow('No such container')
    ejecutar.mockImplementationOnce(() => JSON.stringify([docker().info]))
      .mockImplementationOnce(() => { throw new Error('ERROR: auditoria_inmutable') })
    expect(() => db.sql('delete from auditoria')).toThrow('auditoria_inmutable')
  })
  it.each(['["otra","qa_app"]', '["qa_base","otro"]'])('verifica base y usuario efectivos %s', efectivo => {
    const { ejecutar } = docker()
    ejecutar.mockImplementation(args => args[0] === 'inspect' ? JSON.stringify([docker().info]) : efectivo)
    expect(() => new BaseDeDatos(configuracion(entorno), ejecutar)).toThrow('efectivos')
  })
  it('reserva el clon de forma exclusiva y libera usando el ID', () => {
    const { ejecutar, info } = docker(); const db = new BaseDeDatos(configuracion(entorno), ejecutar)
    const liberar = db.reservar(); liberar()
    expect(ejecutar).toHaveBeenLastCalledWith(['exec', info.Id, 'rmdir', '/tmp/renaser-e2e-en-ejecucion'])
    ejecutar.mockImplementation(args => { if (args.includes('mkdir')) throw new Error('File exists'); return JSON.stringify([info]) })
    expect(() => db.reservar()).toThrow('reservado')
  })
})

describe('limpieza exacta', () => {
  it('genera correos únicos incluso en el mismo milisegundo', () => {
    const correos = Array.from({ length: 1000 }, () => correoDePrueba('e2e.perfil'))
    expect(new Set(correos).size).toBe(1000)
  })
  it('rechaza prefijos, comodines y correos ajenos', () => {
    for (const correo of ['e2e.perfil', 'e2e.%@example.com', 'real@empresa.com', "x'@example.com"])
      expect(() => seleccionDeCorreos([correo])).toThrow('lista explícita')
  })
  it('selecciona solo correos completos dentro de una transacción, sin apagar triggers', () => {
    const ejecutar = vi.fn((_consulta: string) => '')
    borrarCuentasDePrueba(['e2e.perfil.nuevo@example.com'], ejecutar)
    const consulta = ejecutar.mock.calls[0]![0]
    expect(consulta).toContain("u.correo in (E'e2e.perfil.nuevo@example.com')")
    expect(consulta).toContain("invitacion where correo in (E'e2e.perfil.nuevo@example.com')")
    expect(consulta).not.toMatch(/like|disable trigger|session_replication_role/i)
    expect(consulta.trim()).toMatch(/^begin;[\s\S]*commit;$/)
    expect(() => borrarCuentasDePrueba(['e2e.perfil.nuevo@example.com'], () => { throw new Error('auditoria_inmutable') })).toThrow('auditoria_inmutable')
  })
  it('no ejecuta SQL con una lista vacía', () => {
    const consultar = vi.fn(); borrarCuentasDePrueba([], consultar); expect(consultar).not.toHaveBeenCalled()
  })
  it('escapa comillas y barras sin alterar los valores restaurados', () => {
    expect(literal("O'Brien\\Lima")).toBe("E'O''Brien\\\\Lima'")
  })
  it('ejecuta todas las restauraciones y hace visibles sus fallos', async () => {
    const restaurar = vi.fn()
    await expect(limpiarSiempre([() => { throw new Error('restricción') }, restaurar])).rejects.toThrow('restricción')
    expect(restaurar).toHaveBeenCalledOnce()
  })
  it('restaura remuneración real y borra solo IDs nuevos aunque falle la acción', async () => {
    const original = { remuneracion_tipo: 'RANGO', remuneracion_min: 1234, remuneracion_max: 5678,
      remuneracion_moneda: 'USD', remuneracion_actualizada_en: '2026-01-01T10:00:00.123456Z' }
    const consultar = vi.fn((_consulta: string) => '')
      .mockReturnValueOnce(JSON.stringify([original]))
      .mockReturnValueOnce('[{"id":10}]').mockReturnValueOnce('[{"id":20}]')
      .mockReturnValueOnce('[{"id":10},{"id":11}]').mockReturnValueOnce('[{"id":20},{"id":21}]')
    const estado = guardarRemuneracion(9, consultar)
    await expect(estado.registrar(async () => { throw new Error('test fallido') })).rejects.toThrow('test fallido')
    estado.restaurar()
    const consulta = consultar.mock.lastCall![0]
    expect(consulta).toContain('remuneracion_min = 1234')
    expect(consulta).toContain('2026-01-01T10:00:00.123456Z')
    expect(consulta).toContain('aviso_portal where id in (11) and vacante_id = 9')
    expect(consulta).toContain('correo_enviado where id in (21)')
    expect(consulta).not.toMatch(/in \(10|in \(20|plantilla_correo_codigo/)
  })
})
