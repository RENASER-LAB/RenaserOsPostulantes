/**
 * Los campos de la ficha del colaborador, compartidos por el alta, la edición
 * del perfil, el cambio y el reingreso.
 *
 * Reutilizan `Campo` y `Seleccion` del portal: la marca de obligatorio, el error
 * pegado al campo y `aria-invalid` son los de siempre. Qué lleva asterisco sale
 * de `OBLIGATORIOS_*`, que es la misma lista que valida.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { catalogoUbigeo } from '@/api/portal'
import { agrupadasPorDepartamento } from '@/dominio/ubigeo'
import { Campo, Seleccion } from '@/ui/campos/Campo'
import { listarColaboradores } from '../api/colaboradores'
import type { OpcionesColaborador, Situacion } from '../api/tiposPersonas'
import {
  OBLIGATORIOS_PERSONA,
  OBLIGATORIOS_SITUACION,
  type Errores,
  type FormPersona,
  type FormSituacion,
} from './formulario'
import estilos from './Formularios.module.css'

// ---------- Identidad, contacto, domicilio y formación ----------

export function CamposDeIdentidad({
  valor,
  alCambiar,
  errores,
  opciones,
}: {
  valor: FormPersona
  alCambiar: (parcial: Partial<FormPersona>) => void
  errores: Errores
  opciones: OpcionesColaborador
}) {
  const ob = (campo: keyof FormPersona) => OBLIGATORIOS_PERSONA.has(campo)
  return (
    <div className={estilos.rejilla}>
      <Seleccion
        etiqueta="Tipo de documento"
        obligatorio={ob('tipoDocumento')}
        value={valor.tipoDocumento}
        onChange={(e) => alCambiar({ tipoDocumento: e.target.value })}
        error={errores.tipoDocumento}
      >
        {opciones.tiposDocumento.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </Seleccion>
      <Campo
        etiqueta="Número de documento"
        obligatorio={ob('numeroDocumento')}
        value={valor.numeroDocumento}
        onChange={(e) => alCambiar({ numeroDocumento: e.target.value })}
        error={errores.numeroDocumento}
        autoComplete="off"
      />
      <Campo
        etiqueta="Nombres"
        obligatorio={ob('nombres')}
        value={valor.nombres}
        onChange={(e) => alCambiar({ nombres: e.target.value })}
        error={errores.nombres}
      />
      <Campo
        etiqueta="Apellido paterno"
        obligatorio={ob('apellidoPaterno')}
        value={valor.apellidoPaterno}
        onChange={(e) => alCambiar({ apellidoPaterno: e.target.value })}
        error={errores.apellidoPaterno}
      />
      <Campo
        etiqueta="Apellido materno · opcional"
        value={valor.apellidoMaterno}
        onChange={(e) => alCambiar({ apellidoMaterno: e.target.value })}
      />
      <Campo
        etiqueta="Fecha de nacimiento"
        obligatorio={ob('fechaNacimiento')}
        type="date"
        value={valor.fechaNacimiento}
        onChange={(e) => alCambiar({ fechaNacimiento: e.target.value })}
        error={errores.fechaNacimiento}
      />
      <Seleccion
        etiqueta="Sexo"
        obligatorio={ob('sexo')}
        value={valor.sexo}
        onChange={(e) => alCambiar({ sexo: e.target.value })}
        error={errores.sexo}
      >
        <option value="">Elige…</option>
        {opciones.sexos.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </Seleccion>
      <Seleccion
        etiqueta="Estado civil · opcional"
        value={valor.estadoCivil}
        onChange={(e) => alCambiar({ estadoCivil: e.target.value })}
      >
        <option value="">Sin indicar</option>
        {opciones.estadosCiviles.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </Seleccion>
      <Campo
        etiqueta="Nacionalidad · opcional"
        value={valor.nacionalidad}
        onChange={(e) => alCambiar({ nacionalidad: e.target.value })}
      />
      <Campo
        etiqueta="Celular · opcional"
        type="tel"
        value={valor.celular}
        onChange={(e) => alCambiar({ celular: e.target.value })}
      />
      <Campo
        etiqueta="Correo personal · opcional"
        type="email"
        value={valor.correoPersonal}
        onChange={(e) => alCambiar({ correoPersonal: e.target.value })}
        error={errores.correoPersonal}
      />
      <Campo
        etiqueta="Correo corporativo · opcional"
        type="email"
        value={valor.correoCorporativo}
        onChange={(e) => alCambiar({ correoCorporativo: e.target.value })}
        error={errores.correoCorporativo}
      />
    </div>
  )
}

export function CamposDeDomicilio({
  valor,
  alCambiar,
  opciones,
}: {
  valor: FormPersona
  alCambiar: (parcial: Partial<FormPersona>) => void
  opciones: OpcionesColaborador
}) {
  const ubigeo = useQuery({ queryKey: ['catalogo-ubigeo'], queryFn: catalogoUbigeo })
  const { departamentos, sueltas } = useMemo(
    () => agrupadasPorDepartamento(Array.isArray(ubigeo.data) ? ubigeo.data : []),
    [ubigeo.data],
  )
  return (
    <div className={estilos.rejilla}>
      <div className={estilos.anchoDoble}>
        <Campo
          etiqueta="Dirección · opcional"
          value={valor.direccion}
          onChange={(e) => alCambiar({ direccion: e.target.value })}
        />
      </div>
      <Seleccion
        etiqueta="Provincia · opcional"
        value={valor.provinciaUbigeo}
        disabled={ubigeo.isPending}
        onChange={(e) => alCambiar({ provinciaUbigeo: e.target.value })}
      >
        <option value="">{ubigeo.isPending ? 'Cargando…' : 'Sin indicar'}</option>
        {departamentos.map(([departamento, provincias]) => (
          <optgroup key={departamento} label={departamento}>
            {provincias.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </optgroup>
        ))}
        {sueltas.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.nombre}
          </option>
        ))}
      </Seleccion>
      <Seleccion
        etiqueta="Nivel educativo · opcional"
        value={valor.nivelEducativoCodigo}
        onChange={(e) => alCambiar({ nivelEducativoCodigo: e.target.value })}
      >
        <option value="">Sin indicar</option>
        {opciones.nivelesEducativos.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </Seleccion>
    </div>
  )
}

// ---------- Dónde y en qué condiciones ----------

/**
 * Sede, área, cargo, jefe, contrato, régimen y —solo con `ver_sueldos`— el
 * sueldo.
 *
 * Lo desactivado no se ofrece, salvo lo que la persona ya tiene: se conserva
 * y sale marcado «(inactivo)» para que no parezca que se perdió.
 */
export function CamposDeSituacion({
  valor,
  alCambiar,
  errores,
  opciones,
  actual,
  excluirJefe,
}: {
  valor: FormSituacion
  alCambiar: (parcial: Partial<FormSituacion>) => void
  errores: Errores
  opciones: OpcionesColaborador
  /** La situación de la que parte un cambio: lo inactivo que ya tiene se conserva. */
  actual?: Situacion | null
  /** Quién no puede ser su propio jefe. */
  excluirJefe?: number
}) {
  const ob = (campo: keyof FormSituacion) => OBLIGATORIOS_SITUACION.has(campo)
  const conFin = opciones.contratosConFin.includes(valor.tipoContrato)
  const sinFin = valor.tipoContrato === opciones.contratoIndeterminado
  return (
    <div className={estilos.rejilla}>
      <ListaConInactivo
        etiqueta="Sede"
        obligatorio={ob('sedeId')}
        valor={valor.sedeId}
        opciones={opciones.sedes}
        conservar={actual && !actual.sedeActiva ? { id: actual.sedeId, nombre: actual.sede } : null}
        alCambiar={(sedeId) => alCambiar({ sedeId })}
        error={errores.sedeId}
      />
      <ListaConInactivo
        etiqueta="Área"
        obligatorio={ob('areaId')}
        valor={valor.areaId}
        opciones={opciones.areas}
        conservar={actual && !actual.areaActiva ? { id: actual.areaId, nombre: actual.area } : null}
        alCambiar={(areaId) => alCambiar({ areaId })}
        error={errores.areaId}
      />
      <ListaConInactivo
        etiqueta="Cargo"
        obligatorio={ob('cargoId')}
        valor={valor.cargoId}
        opciones={opciones.cargos}
        conservar={actual && !actual.cargoActivo ? { id: actual.cargoId, nombre: actual.cargo } : null}
        alCambiar={(cargoId) => alCambiar({ cargoId })}
        error={errores.cargoId}
      />
      <SelectorDeJefe
        jefeId={valor.jefeId}
        jefeNombre={valor.jefeNombre}
        excluir={excluirJefe}
        alElegir={(jefeId, jefeNombre) => alCambiar({ jefeId, jefeNombre })}
        error={errores.jefeId}
      />
      <Seleccion
        etiqueta="Tipo de contrato"
        obligatorio={ob('tipoContrato')}
        value={valor.tipoContrato}
        onChange={(e) =>
          alCambiar({
            tipoContrato: e.target.value,
            // El indeterminado no lleva fin: se vacía en vez de dejar uno escondido.
            ...(e.target.value === opciones.contratoIndeterminado ? { finContrato: '' } : {}),
          })
        }
        error={errores.tipoContrato}
      >
        <option value="">Elige…</option>
        {opciones.tiposContrato.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </Seleccion>
      <Campo
        etiqueta={conFin ? 'Fin del contrato' : 'Fin del contrato · opcional'}
        obligatorio={conFin}
        type="date"
        value={valor.finContrato}
        disabled={sinFin}
        ayuda={sinFin ? 'Un contrato a plazo indeterminado no lleva fecha de fin.' : undefined}
        onChange={(e) => alCambiar({ finContrato: e.target.value })}
        error={errores.finContrato}
      />
      <Campo
        etiqueta="Fin del periodo de prueba · opcional"
        type="date"
        value={valor.finPeriodoPrueba}
        onChange={(e) => alCambiar({ finPeriodoPrueba: e.target.value })}
        error={errores.finPeriodoPrueba}
      />
      <Seleccion
        etiqueta="Régimen laboral"
        obligatorio={ob('regimenLaboral')}
        value={valor.regimenLaboral}
        onChange={(e) => alCambiar({ regimenLaboral: e.target.value })}
        error={errores.regimenLaboral}
      >
        <option value="">Elige…</option>
        {opciones.regimenes.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.nombre}
          </option>
        ))}
      </Seleccion>
      {opciones.puedeVerSueldos && (
        <>
          <Campo
            etiqueta="Sueldo base · opcional"
            inputMode="decimal"
            value={valor.sueldoBase}
            onChange={(e) => alCambiar({ sueldoBase: e.target.value })}
            error={errores.sueldoBase}
          />
          <Seleccion
            etiqueta="Moneda"
            value={valor.moneda}
            onChange={(e) => alCambiar({ moneda: e.target.value })}
          >
            {opciones.monedas.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.nombre}
              </option>
            ))}
          </Seleccion>
        </>
      )}
    </div>
  )
}

function ListaConInactivo({
  etiqueta,
  obligatorio,
  valor,
  opciones,
  conservar,
  alCambiar,
  error,
}: {
  etiqueta: string
  obligatorio: boolean
  valor: string
  opciones: Array<{ id: number; nombre: string }>
  conservar: { id: number; nombre: string | null } | null
  alCambiar: (valor: string) => void
  error?: string
}) {
  return (
    <Seleccion
      etiqueta={etiqueta}
      obligatorio={obligatorio}
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      error={error}
    >
      <option value="">Elige…</option>
      {conservar && !opciones.some((o) => o.id === conservar.id) && (
        <option value={String(conservar.id)}>{conservar.nombre ?? `#${conservar.id}`} (inactivo)</option>
      )}
      {opciones.map((o) => (
        <option key={o.id} value={String(o.id)}>
          {o.nombre}
        </option>
      ))}
    </Seleccion>
  )
}

/**
 * El jefe directo: se busca por nombre o documento entre quienes están activos
 * o por ingresar. Con 5.000 personas un desplegable no sirve; esto pregunta al
 * backend desde la segunda letra.
 */
export function SelectorDeJefe({
  jefeId,
  jefeNombre,
  excluir,
  alElegir,
  error,
}: {
  jefeId: number | null
  jefeNombre: string | null
  excluir?: number
  alElegir: (jefeId: number | null, jefeNombre: string | null) => void
  error?: string
}) {
  const [texto, setTexto] = useState('')
  const busqueda = texto.trim()
  const resultados = useQuery({
    queryKey: ['panel-colaboradores-jefes', busqueda],
    queryFn: () =>
      listarColaboradores({
        estados: ['ACTIVO', 'POR_INGRESAR'],
        sede: null,
        area: null,
        cargo: null,
        porVencer: false,
        q: busqueda,
        pagina: 0,
      }),
    enabled: busqueda.length >= 2 && jefeId == null,
  })
  const candidatos = (resultados.data?.filas ?? []).filter((f) => f.id !== excluir).slice(0, 8)

  if (jefeId != null) {
    return (
      <div className={estilos.jefe}>
        <span className={estilos.etiqueta}>Jefe directo · opcional</span>
        <div className={estilos.jefeElegido}>
          <span>{jefeNombre ?? `Colaborador ${jefeId}`}</span>
          <button className={estilos.chico} type="button" onClick={() => alElegir(null, null)}>
            Quitar
          </button>
        </div>
        {error && <p className={estilos.error}>{error}</p>}
      </div>
    )
  }

  return (
    <div className={estilos.jefe}>
      <Campo
        etiqueta="Jefe directo · opcional"
        type="search"
        value={texto}
        placeholder="Busca por nombre o documento"
        onChange={(e) => setTexto(e.target.value)}
        error={error}
        autoComplete="off"
      />
      {busqueda.length >= 2 && (
        <ul className={estilos.resultados} role="list" aria-label="Posibles jefes">
          {resultados.isPending && <li className={estilos.sinResultados}>Buscando…</li>}
          {!resultados.isPending && candidatos.length === 0 && (
            <li className={estilos.sinResultados}>Nadie activo o por ingresar con ese nombre o documento.</li>
          )}
          {candidatos.map((c) => (
            <li key={c.id}>
              <button
                className={estilos.resultado}
                type="button"
                onClick={() => {
                  alElegir(c.id, c.nombreCompleto)
                  setTexto('')
                }}
              >
                <b>{c.nombreCompleto}</b>
                <span>
                  {c.tipoDocumentoNombre} {c.numeroDocumento}
                  {c.cargo ? ` · ${c.cargo}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
