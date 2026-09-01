/**
 * Las cuatro listas de una versión: preguntas, entregables, rúbrica y variantes.
 *
 * Van juntas porque se comportan igual —añadir, corregir, quitar, todo solo en
 * borrador— y porque las cuatro fallan igual: un 409 con el motivo escrito en
 * español cuando la versión ya está publicada.
 *
 * ⚠️ **Quitar no es como las demás acciones y se ve.** El botón de quitar lleva
 * el rojo del sistema, que en este mundo significa error real y acción
 * destructiva, y nada más. Sin eso quedaba idéntico a «Corregir» y a «Añadir»,
 * que no rompen nada: tres botones iguales en una fila, uno de los cuales borra.
 */

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  actualizarCriterioRubrica,
  actualizarEntregableDePrueba,
  actualizarVarianteDeCambio,
  agregarCriterioRubrica,
  agregarEntregableDePrueba,
  agregarVarianteDeCambio,
  crearPreguntaDePrueba,
  elegirPreguntaDePrueba,
  listarPreguntasDePrueba,
  listarPuestos,
  quitarCriterioRubrica,
  quitarEntregableDePrueba,
  quitarPreguntaDePrueba,
  quitarVarianteDeCambio,
} from '../api/panel'
import type {
  CriterioDeRubrica,
  EntregableDePrueba,
  GuardarCriterioRubrica,
  GuardarEntregable,
  PreguntaDePrueba,
  TipoDePreguntaDePrueba,
  VarianteDeCambio,
} from '../api/tipos'
import type { Cuenta } from './cuotas'
import { explicarFallo } from './borrador'
import estilos from './ComponerPrueba.module.css'

// ---------- Piezas compartidas ----------

/** El contador de una lista, junto a su título: «12 de 8 a 10 · sobran 2». */
function Marcador({ cuenta }: { cuenta: Cuenta }) {
  return (
    <span className={cuenta.cumple ? estilos.marcadorBien : estilos.marcadorFalta}>
      <span className={estilos.cifra}>
        {cuenta.hay} <span className={estilos.contra}>de {cuenta.pide}</span>
      </span>
      {cuenta.falta && <span className={estilos.veredicto}>{cuenta.falta}</span>}
    </span>
  )
}

/**
 * El botón que quita algo, con su confirmación en el sitio.
 *
 * Se pregunta pegado a la fila y no en un modal, igual que en el banco de
 * preguntas: con doce criterios en pantalla, un diálogo que dice «este criterio»
 * obliga a recordar cuál se pulsó.
 */
function Quitar({
  que,
  trabajando,
  alQuitar,
}: {
  /** En minúscula y con artículo: se compone como «Quitar el criterio». */
  que: string
  trabajando: boolean
  alQuitar: () => void
}) {
  const [preguntando, setPreguntando] = useState(false)

  if (!preguntando) {
    return (
      <button className={estilos.quitar} type="button" onClick={() => setPreguntando(true)}>
        Quitar
      </button>
    )
  }

  return (
    <span className={estilos.confirmarEnLinea}>
      <button
        className={estilos.quitarSeguro}
        type="button"
        onClick={alQuitar}
        disabled={trabajando}
      >
        {trabajando ? 'Quitando…' : `Sí, quitar ${que}`}
      </button>
      <button
        className={estilos.chico}
        type="button"
        onClick={() => setPreguntando(false)}
        disabled={trabajando}
      >
        Dejarlo
      </button>
    </span>
  )
}

// ---------- Las preguntas ----------

export function Preguntas({
  versionId,
  elegidas,
  editable,
  pideEntregables,
  universales,
  especificas,
  delCuestionario,
  alCambiar,
}: {
  versionId: number
  elegidas: PreguntaDePrueba[]
  editable: boolean
  pideEntregables: boolean
  universales: Cuenta | null
  especificas: Cuenta | null
  delCuestionario: Cuenta | null
  alCambiar: () => Promise<void>
}) {
  const catalogo = useQuery({
    queryKey: ['panel-preguntas-prueba'],
    queryFn: () => listarPreguntasDePrueba(),
  })
  const [fallo, setFallo] = useState<string | null>(null)
  const [aElegir, setAElegir] = useState('')

  const elegir = useMutation({
    mutationFn: (preguntaId: number) => elegirPreguntaDePrueba(versionId, preguntaId),
    onSuccess: async () => {
      setFallo(null)
      setAElegir('')
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const quitar = useMutation({
    mutationFn: (preguntaId: number) => quitarPreguntaDePrueba(versionId, preguntaId),
    onSuccess: async () => {
      setFallo(null)
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const yaElegidas = new Set(elegidas.map((p) => p.id))
  const disponibles = (catalogo.data ?? []).filter((p) => !yaElegidas.has(p.id))

  return (
    <section className={estilos.bloque} aria-labelledby="preguntas-titulo">
      <div className={estilos.cabeceraBloque}>
        <h2 className={estilos.tituloBloque} id="preguntas-titulo">
          Las preguntas que responderá
        </h2>
        <div className={estilos.marcadores}>
          {universales && (
            <span className={estilos.grupoMarcador}>
              <span className={estilos.nombreMarcador}>Universales</span>
              <Marcador cuenta={universales} />
            </span>
          )}
          {especificas && (
            <span className={estilos.grupoMarcador}>
              <span className={estilos.nombreMarcador}>Del puesto</span>
              <Marcador cuenta={especificas} />
            </span>
          )}
          {delCuestionario && (
            <span className={estilos.grupoMarcador}>
              <span className={estilos.nombreMarcador}>En total</span>
              <Marcador cuenta={delCuestionario} />
            </span>
          )}
        </div>
      </div>

      <p className={estilos.aclara}>
        {pideEntregables
          ? 'Sirven para que defienda lo que entregó: por qué hizo lo que hizo, qué dejó fuera. Con entregables hacen falta entre 8 y 10 universales y entre 3 y 5 del puesto.'
          : 'Esta prueba no pide entregables, así que las preguntas son la prueba entera y no rige ninguna cuota: basta con una. En cuanto se añada un entregable, empezarán a hacer falta 8-10 universales y 3-5 del puesto.'}
      </p>

      {elegidas.length === 0 ? (
        <p className={estilos.pista}>Todavía no tiene ninguna pregunta.</p>
      ) : (
        <ul className={estilos.lista} role="list">
          {elegidas.map((p) => (
            <li className={estilos.item} key={p.id}>
              <span className={estilos.codigo}>{p.codigo}</span>
              <span className={estilos.marcaTipo}>{p.tipo}</span>
              <span className={estilos.texto}>{p.enunciado}</span>
              {editable && (
                <Quitar
                  que="la pregunta"
                  trabajando={quitar.isPending}
                  alQuitar={() => quitar.mutate(p.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <>
          <div className={estilos.subirFila}>
            <label className={estilos.campoAncho}>
              <span className={estilos.etiqueta}>Traer una del catálogo</span>
              <select
                className={estilos.entrada}
                value={aElegir}
                onChange={(e) => setAElegir(e.target.value)}
              >
                <option value="">Elige una pregunta…</option>
                {disponibles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.codigo} · {p.tipo} · {p.enunciado}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => elegir.mutate(Number(aElegir))}
              disabled={elegir.isPending || aElegir === ''}
            >
              {elegir.isPending ? 'Añadiendo…' : 'Añadirla'}
            </button>
          </div>

          {disponibles.length === 0 && (catalogo.data ?? []).length > 0 && (
            <p className={estilos.pista}>
              Ya están elegidas todas las preguntas del catálogo. Para tener más hay que
              escribirlas aquí abajo.
            </p>
          )}

          <PreguntaNueva alCrear={alCambiar} />
        </>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

/**
 * Escribir una pregunta que no está en el catálogo.
 *
 * ⚠️ **El catálogo es de toda la plataforma, no de esta empresa ni de esta
 * prueba.** El backend no lo acota por organización: `listarPreguntasCatalogo`
 * las devuelve todas. Así que una pregunta escrita aquí la va a ver cualquiera
 * que componga otra prueba, y quitarla de una versión no la borra de ningún
 * sitio. Se dice, porque nada en la pantalla lo insinuaría.
 */
function PreguntaNueva({ alCrear }: { alCrear: () => Promise<void> }) {
  const puestos = useQuery({ queryKey: ['panel-puestos'], queryFn: listarPuestos })

  const [abierto, setAbierto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [enunciado, setEnunciado] = useState('')
  const [tipo, setTipo] = useState<TipoDePreguntaDePrueba>('UNIVERSAL')
  const [puestoId, setPuestoId] = useState('')
  const [revela, setRevela] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)

  const creacion = useMutation({
    mutationFn: () =>
      crearPreguntaDePrueba({
        codigo: codigo.trim(),
        enunciado: enunciado.trim(),
        tipo,
        puestoId: puestoId === '' ? null : Number(puestoId),
        revela: revela.trim() === '' ? null : revela.trim(),
      }),
    onSuccess: async () => {
      setCodigo('')
      setEnunciado('')
      setRevela('')
      setFallo(null)
      setAbierto(false)
      await alCrear()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  if (!abierto) {
    return (
      <button className={estilos.chico} type="button" onClick={() => setAbierto(true)}>
        Escribir una pregunta nueva
      </button>
    )
  }

  return (
    <div className={estilos.formularioDentro}>
      <p className={estilos.aclara}>
        Va al catálogo de preguntas, que es <strong>de toda la plataforma</strong>: la verá
        quien componga cualquier otra prueba. Al crearla queda escrita, pero todavía hay que
        añadirla a esta versión con el desplegable de arriba.
      </p>

      <div className={estilos.fila}>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>Código</span>
          <input
            className={estilos.entrada}
            type="text"
            value={codigo}
            placeholder="U11"
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>De qué tipo</span>
          <select
            className={estilos.entrada}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDePreguntaDePrueba)}
          >
            <option value="UNIVERSAL">Universal: vale para cualquier puesto</option>
            <option value="ESPECIFICA">Del puesto: sobre este oficio</option>
            <option value="PREVIA">Previa: se responde antes de empezar</option>
          </select>
        </label>
        <label className={estilos.campo}>
          <span className={estilos.etiqueta}>De qué puesto</span>
          <select
            className={estilos.entrada}
            value={puestoId}
            onChange={(e) => setPuestoId(e.target.value)}
          >
            <option value="">De ninguno en concreto</option>
            {(puestos.data ?? []).map((p) => (
              <option value={p.id} key={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>La pregunta</span>
        <textarea
          className={estilos.area}
          rows={2}
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
        />
      </label>

      <label className={estilos.campo}>
        <span className={estilos.etiqueta}>Qué mide</span>
        <input
          className={estilos.entrada}
          type="text"
          value={revela}
          onChange={(e) => setRevela(e.target.value)}
        />
        {/*
          ⚠️ `revela` no se le enseña a quien lee la respuesta, y es a proposito:
          saber que se buscaba condiciona la lectura. Es interno.
        */}
        <span className={estilos.pista}>
          Para quien escribe la prueba. No se le enseña a quien la rinde ni a quien lee la
          respuesta: saber qué se buscaba condiciona la lectura.
        </span>
      </label>

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}

      <div className={estilos.botones}>
        <button
          className={estilos.principal}
          type="button"
          onClick={() => creacion.mutate()}
          disabled={creacion.isPending || codigo.trim() === '' || enunciado.trim() === ''}
        >
          {creacion.isPending ? 'Creándola…' : 'Crear la pregunta'}
        </button>
        <button
          className={estilos.chico}
          type="button"
          onClick={() => setAbierto(false)}
          disabled={creacion.isPending}
        >
          Dejarlo
        </button>
      </div>
    </div>
  )
}

// ---------- Los entregables ----------

const ENTREGABLE_EN_BLANCO: GuardarEntregable = {
  nombre: '',
  detalle: '',
  formato: 'CUALQUIERA',
  esObligatorio: true,
}

export function Entregables({
  versionId,
  entregables,
  editable,
  alCambiar,
}: {
  versionId: number
  entregables: EntregableDePrueba[]
  editable: boolean
  alCambiar: () => Promise<void>
}) {
  const [fallo, setFallo] = useState<string | null>(null)
  const [editando, setEditando] = useState<number | null>(null)
  const [datos, setDatos] = useState<GuardarEntregable>(ENTREGABLE_EN_BLANCO)
  const [anadiendo, setAnadiendo] = useState(false)

  const cerrar = async () => {
    setEditando(null)
    setAnadiendo(false)
    setDatos(ENTREGABLE_EN_BLANCO)
    setFallo(null)
    await alCambiar()
  }

  const guardar = useMutation({
    mutationFn: () =>
      editando === null
        ? agregarEntregableDePrueba(versionId, datos).then(() => undefined)
        : actualizarEntregableDePrueba(editando, datos),
    onSuccess: cerrar,
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const quitar = useMutation({
    mutationFn: (id: number) => quitarEntregableDePrueba(id),
    onSuccess: async () => {
      setFallo(null)
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const componiendo = anadiendo || editando !== null

  return (
    <section className={estilos.bloque} aria-labelledby="entregables-titulo">
      <div className={estilos.cabeceraBloque}>
        <h2 className={estilos.tituloBloque} id="entregables-titulo">
          Lo que tiene que entregar
        </h2>
        <span className={estilos.grupoMarcador}>
          <span className={estilos.nombreMarcador}>Entregables</span>
          <span className={estilos.marcadorNeutro}>
            <span className={estilos.cifra}>{entregables.length}</span>
          </span>
        </span>
      </div>

      {/*
        ⚠️ Este bloque decide la cuota del anterior: sin entregables la prueba es
        un cuestionario y basta una pregunta; con uno solo, hacen falta once.
      */}
      <p className={estilos.aclara}>
        Un archivo, un enlace o lo que prefiera. <strong>Añadir el primero cambia la prueba</strong>
        : deja de ser un cuestionario y pasan a hacer falta entre 8 y 10 preguntas universales y
        entre 3 y 5 del puesto.
      </p>

      {entregables.length === 0 ? (
        <p className={estilos.pista}>
          No pide ninguno: esta prueba se responde solo contestando preguntas.
        </p>
      ) : (
        <ul className={estilos.lista} role="list">
          {entregables.map((e) => (
            <li className={estilos.item} key={e.id}>
              <span className={estilos.codigo}>{e.nombre}</span>
              <span className={estilos.marcaTipo}>{e.formato}</span>
              {!e.esObligatorio && <span className={estilos.marcaTipo}>Opcional</span>}
              <span className={estilos.texto}>{e.detalle}</span>
              {editable && (
                <>
                  <button
                    className={estilos.chico}
                    type="button"
                    onClick={() => {
                      setAnadiendo(false)
                      setEditando(e.id)
                      setDatos({
                        nombre: e.nombre,
                        detalle: e.detalle,
                        formato: e.formato,
                        esObligatorio: e.esObligatorio,
                      })
                    }}
                  >
                    Corregir
                  </button>
                  <Quitar
                    que="el entregable"
                    trabajando={quitar.isPending}
                    alQuitar={() => quitar.mutate(e.id)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && !componiendo && (
        <button
          className={estilos.chico}
          type="button"
          onClick={() => {
            setDatos(ENTREGABLE_EN_BLANCO)
            setAnadiendo(true)
          }}
        >
          Pedir un entregable
        </button>
      )}

      {editable && componiendo && (
        <div className={estilos.formularioDentro}>
          <div className={estilos.fila}>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Cómo se llama</span>
              <input
                className={estilos.entrada}
                type="text"
                value={datos.nombre}
                onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              />
            </label>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>En qué forma se entrega</span>
              <select
                className={estilos.entrada}
                value={datos.formato}
                onChange={(e) =>
                  setDatos({ ...datos, formato: e.target.value as GuardarEntregable['formato'] })
                }
              >
                <option value="CUALQUIERA">Como prefiera: archivo o enlace</option>
                <option value="ARCHIVO">Un archivo</option>
                <option value="ENLACE">Un enlace</option>
              </select>
            </label>
          </div>

          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Qué tiene que contener</span>
            <textarea
              className={estilos.area}
              rows={2}
              value={datos.detalle}
              onChange={(e) => setDatos({ ...datos, detalle: e.target.value })}
            />
          </label>

          <label className={estilos.casilla}>
            <input
              type="checkbox"
              checked={datos.esObligatorio}
              onChange={(e) => setDatos({ ...datos, esObligatorio: e.target.checked })}
            />
            <span>Es obligatorio: sin él no puede entregar la prueba</span>
          </label>

          <div className={estilos.botones}>
            <button
              className={estilos.principal}
              type="button"
              onClick={() => guardar.mutate()}
              disabled={
                guardar.isPending || datos.nombre.trim() === '' || datos.detalle.trim() === ''
              }
            >
              {guardar.isPending ? 'Guardando…' : editando === null ? 'Añadirlo' : 'Guardarlo'}
            </button>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => {
                setEditando(null)
                setAnadiendo(false)
                setFallo(null)
              }}
              disabled={guardar.isPending}
            >
              Dejarlo
            </button>
          </div>
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

// ---------- La rubrica ----------

const CRITERIO_EN_BLANCO: GuardarCriterioRubrica = {
  codigo: '',
  nombre: '',
  descripcion: null,
  puntos: 0,
  metodoVerificacion: 'AGENTE',
}

export function Rubrica({
  versionId,
  rubrica,
  editable,
  cuenta,
  alCambiar,
}: {
  versionId: number
  rubrica: CriterioDeRubrica[]
  editable: boolean
  cuenta: Cuenta
  alCambiar: () => Promise<void>
}) {
  const [fallo, setFallo] = useState<string | null>(null)
  const [editando, setEditando] = useState<number | null>(null)
  const [anadiendo, setAnadiendo] = useState(false)
  const [datos, setDatos] = useState<GuardarCriterioRubrica>(CRITERIO_EN_BLANCO)

  const guardar = useMutation({
    mutationFn: () =>
      editando === null
        ? agregarCriterioRubrica(versionId, datos).then(() => undefined)
        : actualizarCriterioRubrica(editando, datos),
    onSuccess: async () => {
      setEditando(null)
      setAnadiendo(false)
      setDatos(CRITERIO_EN_BLANCO)
      setFallo(null)
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const quitar = useMutation({
    mutationFn: (id: number) => quitarCriterioRubrica(id),
    onSuccess: async () => {
      setFallo(null)
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const componiendo = anadiendo || editando !== null

  return (
    <section className={estilos.bloque} aria-labelledby="rubrica-titulo">
      <div className={estilos.cabeceraBloque}>
        <h2 className={estilos.tituloBloque} id="rubrica-titulo">
          Con qué se le pone la nota
        </h2>
        <span className={estilos.grupoMarcador}>
          <span className={estilos.nombreMarcador}>Suman</span>
          <Marcador cuenta={cuenta} />
        </span>
      </div>

      <p className={estilos.aclara}>
        Cada criterio dice cuántos puntos vale y quién lo comprueba.{' '}
        <strong>Tienen que sumar 100 exactos</strong>, y esta es la única fuente de la nota: la
        guía que orienta a la IA no la sustituye ni añade puntos por su cuenta.
      </p>

      {rubrica.length === 0 ? (
        <p className={estilos.pista}>
          Sin criterios no hay nota que poner, y la prueba no se puede publicar.
        </p>
      ) : (
        <ul className={estilos.lista} role="list">
          {rubrica.map((c) => (
            <li className={estilos.item} key={c.id}>
              <span className={estilos.codigo}>{c.codigo}</span>
              <span className={estilos.puntos}>{c.puntos ?? 0} pts</span>
              <span className={estilos.marcaTipo}>{quienComprueba(c.metodoVerificacion)}</span>
              <span className={estilos.texto}>{c.nombre}</span>
              {editable && (
                <>
                  <button
                    className={estilos.chico}
                    type="button"
                    onClick={() => {
                      setAnadiendo(false)
                      setEditando(c.id)
                      setDatos({
                        codigo: c.codigo,
                        nombre: c.nombre,
                        /*
                          ⚠️ La explicacion larga se siembra igual que el resto, y
                          no en nulo: corregir un criterio lo REEMPLAZA entero, asi
                          que abrir el formulario sin ella la borraba al guardar
                          sin que nadie la tocara. `CriterioRubricaResponse` no la
                          devolvia; se añadio al encontrarlo el e2e del compositor.
                        */
                        descripcion: c.descripcion,
                        puntos: c.puntos ?? 0,
                        metodoVerificacion: c.metodoVerificacion,
                      })
                    }}
                  >
                    Corregir
                  </button>
                  <Quitar
                    que="el criterio"
                    trabajando={quitar.isPending}
                    alQuitar={() => quitar.mutate(c.id)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && !componiendo && (
        <button
          className={estilos.chico}
          type="button"
          onClick={() => {
            setDatos(CRITERIO_EN_BLANCO)
            setAnadiendo(true)
          }}
        >
          Añadir un criterio
        </button>
      )}

      {editable && componiendo && (
        <div className={estilos.formularioDentro}>
          <div className={estilos.fila}>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Código</span>
              <input
                className={estilos.entrada}
                type="text"
                value={datos.codigo}
                placeholder="CRITERIO"
                onChange={(e) => setDatos({ ...datos, codigo: e.target.value })}
              />
              <span className={estilos.pista}>Único dentro de esta rúbrica.</span>
            </label>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Cuántos puntos vale</span>
              <input
                className={estilos.entrada}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={String(datos.puntos)}
                onChange={(e) => setDatos({ ...datos, puntos: Number(e.target.value) })}
              />
              {editando === null && (
                <span className={estilos.pista}>
                  Ahora suman {cuenta.hay}: quedan {Math.max(0, 100 - cuenta.hay)} por repartir.
                </span>
              )}
            </label>
            <label className={estilos.campo}>
              <span className={estilos.etiqueta}>Quién lo comprueba</span>
              <select
                className={estilos.entrada}
                value={datos.metodoVerificacion}
                onChange={(e) =>
                  setDatos({
                    ...datos,
                    metodoVerificacion: e.target
                      .value as GuardarCriterioRubrica['metodoVerificacion'],
                  })
                }
              >
                <option value="AGENTE">La IA, leyendo lo que entregó</option>
                <option value="PERSONA">Una persona del equipo, a mano</option>
                <option value="SISTEMA">El sistema, solo</option>
              </select>
            </label>
          </div>

          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Qué mira este criterio</span>
            <input
              className={estilos.entrada}
              type="text"
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            />
          </label>

          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>La explicación larga, si hace falta</span>
            <textarea
              className={estilos.area}
              rows={2}
              value={datos.descripcion ?? ''}
              onChange={(e) => setDatos({ ...datos, descripcion: e.target.value || null })}
            />
            <span className={estilos.pista}>
              Es para quien lee la rúbrica en el panel, no para quien rinde la prueba. Al
              corregir el criterio vuelve a salir tal cual se escribió.
            </span>
          </label>

          {fallo && (
            <p className={estilos.avisoMalo} role="alert">
              {fallo}
            </p>
          )}

          <div className={estilos.botones}>
            <button
              className={estilos.principal}
              type="button"
              onClick={() => guardar.mutate()}
              disabled={
                guardar.isPending || datos.codigo.trim() === '' || datos.nombre.trim() === ''
              }
            >
              {guardar.isPending ? 'Guardando…' : editando === null ? 'Añadirlo' : 'Guardarlo'}
            </button>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => {
                setEditando(null)
                setAnadiendo(false)
                setFallo(null)
              }}
              disabled={guardar.isPending}
            >
              Dejarlo
            </button>
          </div>
        </div>
      )}

      {fallo && !componiendo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}

const quienComprueba = (metodo: CriterioDeRubrica['metodoVerificacion']) =>
  metodo === 'AGENTE' ? 'La IA' : metodo === 'PERSONA' ? 'Una persona' : 'El sistema'

// ---------- Las variantes del cambio inesperado ----------

export function Variantes({
  versionId,
  variantes,
  editable,
  alCambiar,
}: {
  versionId: number
  variantes: VarianteDeCambio[]
  editable: boolean
  alCambiar: () => Promise<void>
}) {
  const [fallo, setFallo] = useState<string | null>(null)
  const [editando, setEditando] = useState<number | null>(null)
  const [anadiendo, setAnadiendo] = useState(false)
  const [texto, setTexto] = useState('')

  const guardar = useMutation({
    mutationFn: () =>
      editando === null
        ? agregarVarianteDeCambio(versionId, texto.trim()).then(() => undefined)
        : actualizarVarianteDeCambio(editando, texto.trim()),
    onSuccess: async () => {
      setEditando(null)
      setAnadiendo(false)
      setTexto('')
      setFallo(null)
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const quitar = useMutation({
    mutationFn: (id: number) => quitarVarianteDeCambio(id),
    onSuccess: async () => {
      setFallo(null)
      await alCambiar()
    },
    onError: (c) => setFallo(explicarFallo(c)),
  })

  const componiendo = anadiendo || editando !== null

  return (
    <section className={estilos.bloque} aria-labelledby="variantes-titulo">
      <div className={estilos.cabeceraBloque}>
        <h2 className={estilos.tituloBloque} id="variantes-titulo">
          El cambio inesperado
        </h2>
        <span className={estilos.grupoMarcador}>
          <span className={estilos.nombreMarcador}>Formas posibles</span>
          <span className={estilos.marcadorNeutro}>
            <span className={estilos.cifra}>{variantes.length}</span>
          </span>
        </span>
      </div>

      {/*
        Ni el minuto ni la forma son fijos: los dos se sortean. Sin esta linea,
        escribir una sola variante parece bastar y no lo es — con una, todos los
        candidatos de la tanda reciben exactamente el mismo giro.
      */}
      <p className={estilos.aclara}>
        A mitad de la prueba le llega un giro que cambia el problema. Se escribe más de uno y{' '}
        <strong>se sortea cuál le toca a cada persona</strong>, igual que se sortea el minuto:
        así el segundo candidato de una tanda no puede prepararlo. No es obligatorio para
        publicar.
      </p>

      {variantes.length === 0 ? (
        <p className={estilos.pista}>
          No tiene ninguno: esta prueba transcurre entera como dice el enunciado.
        </p>
      ) : (
        <ul className={estilos.lista} role="list">
          {variantes.map((v) => (
            <li className={estilos.item} key={v.id}>
              <span className={estilos.texto}>{v.texto}</span>
              {editable && (
                <>
                  <button
                    className={estilos.chico}
                    type="button"
                    onClick={() => {
                      setAnadiendo(false)
                      setEditando(v.id)
                      setTexto(v.texto)
                    }}
                  >
                    Corregir
                  </button>
                  <Quitar
                    que="la variante"
                    trabajando={quitar.isPending}
                    alQuitar={() => quitar.mutate(v.id)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && !componiendo && (
        <button
          className={estilos.chico}
          type="button"
          onClick={() => {
            setTexto('')
            setAnadiendo(true)
          }}
        >
          Escribir un cambio posible
        </button>
      )}

      {editable && componiendo && (
        <div className={estilos.formularioDentro}>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Qué le pasa a mitad de la prueba</span>
            <textarea
              className={estilos.area}
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <div className={estilos.botones}>
            <button
              className={estilos.principal}
              type="button"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending || texto.trim() === ''}
            >
              {guardar.isPending ? 'Guardando…' : editando === null ? 'Añadirlo' : 'Guardarlo'}
            </button>
            <button
              className={estilos.chico}
              type="button"
              onClick={() => {
                setEditando(null)
                setAnadiendo(false)
                setFallo(null)
              }}
              disabled={guardar.isPending}
            >
              Dejarlo
            </button>
          </div>
        </div>
      )}

      {fallo && (
        <p className={estilos.avisoMalo} role="alert">
          {fallo}
        </p>
      )}
    </section>
  )
}
