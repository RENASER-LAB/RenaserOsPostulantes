import assert from 'node:assert/strict'
import { BaseDeDatos, configuracion, correoDePrueba, literal, limpiarSiempre } from '../e2e/base-de-datos'
import { borrarCuentasDePrueba } from '../e2e/limpieza-cuentas'
import { guardarRemuneracion } from '../e2e/estado-remuneracion'

// Ambos clones deben existir ya y contener el mismo snapshot autorizado.
const a = new BaseDeDatos(configuracion())
const b = new BaseDeDatos(configuracion({ ...process.env,
  E2E_PG: process.env.E2E_OTHER_PG, E2E_CLONE_ID: process.env.E2E_OTHER_CLONE_ID }))
assert.notEqual(a.id, b.id, 'La integración exige dos contenedores distintos.')
const liberarA = a.reservar()
let liberarB: (() => void) | undefined
const consultar = a.sql.bind(a)
const huella = (db: BaseDeDatos) => {
  const tablas: string[] = JSON.parse(db.sql(`select json_agg(tablename order by tablename) from pg_tables where schemaname = 'public';`))
  return db.sql(tablas.map(t => {
    const tabla = `"${t.replaceAll('"', '""')}"`
    return `select ${literal(t)} as tabla, md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text), '')) as huella from public.${tabla} t`
  }).join(' union all ') + ' order by tabla;')
}
const crear = (correo: string): number => Number(consultar(`with p as (
  insert into persona(nombre, apellidos) values ('Prueba', 'Aislamiento') returning id)
  insert into usuario(persona_id, organizacion_id, correo)
  select id, (select min(id) from organizacion), ${literal(correo)} from p returning id;`))
try {
  liberarB = b.reservar()
  const antesB = huella(b)
  const antesA = huella(a)
  const previo = correoDePrueba('e2e.aislamiento')
  const nuevo = correoDePrueba('e2e.aislamiento')
  const idPrevio = crear(previo)
  crear(nuevo)
  borrarCuentasDePrueba([nuevo], consultar)
  assert.equal(consultar(`select count(*) from usuario where id = ${idPrevio};`), '1')
  assert.equal(consultar(`select count(*) from usuario where correo = ${literal(nuevo)};`), '0')
  borrarCuentasDePrueba([previo], consultar)
  assert.equal(huella(a), antesA, 'La limpieza alteró registros anteriores del clon A.')

  const vacante = Number(consultar('select min(id) from vacante;'))
  const estado = guardarRemuneracion(vacante, consultar)
  // Un fallo a mitad del escenario debe ejecutar igualmente la restauración.
  await assert.rejects(async () => {
    try {
      consultar(`update vacante set remuneracion_tipo='RANGO', remuneracion_min=1234,
        remuneracion_max=5678, remuneracion_moneda='USD', remuneracion_actualizada_en=now() where id=${vacante};`)
      throw new Error('fallo de prueba intencional')
    } finally { estado.restaurar() }
  }, /fallo de prueba intencional/)
  assert.equal(huella(a), antesA, 'No se restauró la remuneración original tras fallar.')
  assert.equal(huella(b), antesB, 'Se modificó el segundo clon.')
  console.log('OK: limpieza exacta, registros previos intactos, restauración tras fallo y clon B intacto.')

  const bloqueado = correoDePrueba('e2e.auditoria')
  const usuario = crear(bloqueado)
  consultar(`insert into auditoria(organizacion_id, usuario_id, accion, entidad)
    select organizacion_id, id, 'E2E_AISLAMIENTO', 'usuario' from usuario where id=${usuario};`)
  const antesRestriccion = huella(a)
  await assert.rejects(limpiarSiempre([() => borrarCuentasDePrueba([bloqueado], consultar)]), /conserva el clon.*|auditoría|inmutable/s)
  assert.equal(huella(a), antesRestriccion, 'La limpieza fallida no hizo rollback completo.')
  assert.equal(huella(b), antesB)
  console.log(`OK: restricción real comunicada y transacción revertida. Conserva ${a.config.E2E_PG}; cuenta de diagnóstico: ${bloqueado}`)
} finally {
  await limpiarSiempre([() => liberarB?.(), liberarA])
}
