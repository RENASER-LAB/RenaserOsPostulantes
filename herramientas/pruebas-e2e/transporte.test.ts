import { execFileSync } from 'node:child_process'
import { beforeEach, expect, it, vi } from 'vitest'
import { BaseDeDatos, configuracion } from '../e2e/base-de-datos'

vi.mock('node:child_process', () => {
  const execFileSync = vi.fn()
  return { execFileSync, default: { execFileSync } }
})
const ejecutar = vi.mocked(execFileSync)
const config = configuracion({ E2E_PG: 'clon', PGUSER: 'qa_app', PGDATABASE: 'qa_base',
  E2E_CLONE_ID: 'trabajo', E2E_API: 'http://localhost:9011/api/v1', E2E_PORTAL: 'http://localhost:9012' })
const info = JSON.stringify([{ Id: 'a'.repeat(64), State: { Running: true },
  Config: { Labels: { 'renaser.e2e.clone': 'trabajo' } } }])
beforeEach(() => ejecutar.mockReset())

it('usa argumentos separados, stdin, ON_ERROR_STOP y tiempo límite', () => {
  ejecutar.mockReturnValueOnce(info).mockReturnValueOnce(info).mockReturnValueOnce('["qa_base","qa_app"]')
  const db = new BaseDeDatos(config)
  ejecutar.mockReturnValueOnce(info).mockReturnValueOnce('1\n')
  expect(db.sql('select 1;')).toBe('1')
  expect(ejecutar).toHaveBeenLastCalledWith('docker',
    ['exec', '-i', 'a'.repeat(64), 'psql', '-X', '-q', '-A', '-t', '-h', '/var/run/postgresql',
      '-U', 'qa_app', '-d', 'qa_base', '-v', 'ON_ERROR_STOP=1'],
    expect.objectContaining({ input: 'select 1;', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] }))
})

it('comunica stderr de SQL y propaga los timeouts', () => {
  ejecutar.mockReturnValueOnce(info).mockReturnValueOnce(info).mockReturnValueOnce('["qa_base","qa_app"]')
  const db = new BaseDeDatos(config)
  ejecutar.mockReturnValueOnce(info).mockImplementationOnce(() => {
    throw Object.assign(new Error('Command failed'), { stderr: Buffer.from('ERROR: auditoria_inmutable') })
  })
  expect(() => db.sql('delete from auditoria;')).toThrow('ERROR: auditoria_inmutable')
  ejecutar.mockImplementationOnce(() => { throw new Error('ETIMEDOUT') })
  expect(() => db.sql('select 1;')).toThrow('ETIMEDOUT')
})
