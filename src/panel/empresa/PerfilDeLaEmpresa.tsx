/**
 * «Perfil de la empresa» (V85): un módulo propio del menú, fuera de
 * Configuración (decisión del 16/11/2026), para que la empresa cuente por qué
 * existe. Lo que se guarda aquí lo ve el candidato junto a cada vacante y en el
 * perfil público de la empresa, en cuanto se guarda y sin volver a publicar.
 *
 * A la izquierda el editor —Identidad, Presentación, Video y enlaces— con un
 * solo «Guardar»; a la derecha la vista previa en vivo del perfil público. Por
 * debajo de 1280 px la vista previa se abre con «Vista previa».
 *
 * ⚠️ **Ningún texto de ayuda bajo los campos**: etiquetas, contadores, chips y
 * errores sí. Los errores son los del backend, con las mismas palabras y en el
 * mismo campo, y si algo no vale no se guarda nada.
 *
 * Siempre es la empresa de quien ha entrado. Sin `editar_presentacion_empresa`
 * el backend contesta 403 y aquí no se enseña el editor.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ErrorApi, direccionPublica } from '@/api/puerta'
import { verPerfilDeEmpresa } from '@/api/portal'
import type { CodigoDeRed } from '@/api/tipos'
import { diaDeLima } from '@/dominio/horaDeLima'
import {
  MAXIMO_BENEFICIO,
  MAXIMO_BENEFICIOS,
  MAXIMO_SECTOR,
  MAXIMO_TEXTO_LARGO,
  REDES,
  TAMANOS,
  leerVideo,
  lineaDeDatos,
  normalizarEnlace,
} from '@/dominio/presentacionEmpresa'
import { ahora } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { AreaTexto, Campo, Seleccion } from '@/ui/campos/Campo'
import { IconoCamara, IconoCruz } from '@/ui/Iconos'
import { Modal } from '@/ui/Modal'
import { EnlacesDeLaEmpresa, enlacesDeLaEmpresa } from '@/ui/presentacion/EnlacesDeLaEmpresa'
import { RecuadroDeVideo } from '@/ui/presentacion/RecuadroDeVideo'
import { Iniciales } from '@/paginas/vacantes/FilaDeVacante'
import cabecera from '@/paginas/perfil/Cabecera.module.css'
import areas from '../configuracion/Areas.module.css'
import {
  erroresDelGuardado,
  guardarPresentacion,
  quitarImagenDeLaEmpresa,
  subirImagenDeLaEmpresa,
  verPresentacion,
  type CualImagen,
  type PresentacionPanel,
} from '../api/presentacion'
import { useRetenerLaSesion } from '../Sesion'
import { useTituloDelPanel } from '../titulo'
import {
  MENSAJE_CORRIGE,
  MENSAJE_GUARDADO,
  MENSAJE_SIN_RED,
  anadirBeneficio,
  comoCuerpo,
  desdeLoGuardado,
  erroresDelFormulario,
  hayCambios,
  type Formulario,
} from './formulario'
import { FORMATOS_IMAGEN_EMPRESA, prepararImagen } from './imagenes'
import estilos from './PerfilDeLaEmpresa.module.css'

const CLAVE = ['panel-presentacion']

/** Lo que se hará con una imagen al guardar: subir otra, quitarla o nada. */
type Pendiente = { archivo: File; vista: string } | 'quitar' | null

function anioDeLima(): number {
  return Number(diaDeLima(new Date(ahora()).toISOString()).slice(0, 4))
}

export function PerfilDeLaEmpresaPanel() {
  useTituloDelPanel('Perfil de la empresa')
  const consulta = useQuery({ queryKey: CLAVE, queryFn: verPresentacion, retry: false })

  return (
    <div className={estilos.pagina}>
      <h1>Perfil de la empresa.</h1>
      <p className={estilos.bajada}>Lo que ven los candidatos en tu página pública y junto a cada vacante.</p>

      {consulta.isPending && <p aria-busy="true">Cargando…</p>}

      {consulta.isError &&
        (consulta.error instanceof ErrorApi && consulta.error.estado === 403 ? (
          <p className={estilos.sinPermiso} role="alert">
            No tienes permiso para editar el perfil de la empresa. Si crees que deberías, pide el acceso
            al administrador.
          </p>
        ) : (
          <p className={estilos.avisoMalo} role="alert">
            No pudimos traer el perfil de la empresa.{' '}
            <button className={estilos.chico} type="button" onClick={() => void consulta.refetch()}>
              Volver a intentarlo
            </button>
          </p>
        ))}

      {consulta.data && <Editor guardado={consulta.data} />}
    </div>
  )
}

function Editor({ guardado }: { guardado: PresentacionPanel }) {
  const cache = useQueryClient()
  const inicial = useMemo(() => desdeLoGuardado(guardado), [guardado])
  const [datos, setDatos] = useState<Formulario>(inicial)
  const [logo, setLogo] = useState<Pendiente>(null)
  const [portada, setPortada] = useState<Pendiente>(null)
  const [nuevo, setNuevo] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<'bien' | 'corrige' | 'red' | null>(null)
  const [previaAbierta, setPreviaAbierta] = useState(false)

  // Al guardar, la sección vuelve a mostrar lo guardado.
  useEffect(() => setDatos(inicial), [inicial])

  // Las vistas de las imágenes elegidas se sueltan al cambiarlas o al salir.
  useEffect(() => () => soltar(logo), [logo])
  useEffect(() => () => soltar(portada), [portada])

  const cambiado = hayCambios(datos, inicial) || logo !== null || portada !== null
  useRetenerLaSesion(cambiado)

  const guardar = useMutation({
    mutationFn: async () => {
      let ultimo = await guardarPresentacion(comoCuerpo(datos))
      for (const [cual, pendiente] of [
        ['logo', logo],
        ['portada', portada],
      ] as const) {
        try {
          if (pendiente === 'quitar') ultimo = await quitarImagenDeLaEmpresa(cual)
          else if (pendiente) ultimo = await subirImagenDeLaEmpresa(cual, pendiente.archivo)
        } catch (causa) {
          throw new FalloDeImagen(cual, causa)
        }
      }
      return ultimo
    },
    onSuccess: (respuesta) => {
      setLogo(null)
      setPortada(null)
      setErrores({})
      setAviso('bien')
      cache.setQueryData(CLAVE, respuesta)
      void cache.invalidateQueries({ queryKey: ['perfil-de-empresa'] })
    },
    onError: (causa) => {
      if (causa instanceof FalloDeImagen) {
        setErrores({ [causa.cual]: causa.message })
        setAviso('red')
        void cache.invalidateQueries({ queryKey: CLAVE })
        return
      }
      const delServidor = erroresDelGuardado(causa)
      if (Object.keys(delServidor).length > 0) {
        setErrores(delServidor)
        setAviso('corrige')
        return
      }
      // Sin red, el formulario conserva lo escrito.
      setAviso('red')
    },
  })

  function poner<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setDatos((antes) => ({ ...antes, [campo]: valor }))
    setErrores((antes) => {
      const { [campo as string]: _quitado, ...resto } = antes
      return resto
    })
    setAviso(null)
  }

  function ponerRed(red: CodigoDeRed, valor: string) {
    setDatos((antes) => ({ ...antes, redes: { ...antes.redes, [red]: valor } }))
    setErrores((antes) => {
      const { [red]: _quitado, ...resto } = antes
      return resto
    })
    setAviso(null)
  }

  async function elegirImagen(cual: CualImagen, archivo: File | undefined) {
    if (!archivo) return
    const preparada = await prepararImagen(archivo, cual)
    if ('error' in preparada) {
      setErrores((antes) => ({ ...antes, [cual]: preparada.error }))
      return
    }
    const pendiente = { archivo: preparada.archivo, vista: URL.createObjectURL(preparada.archivo) }
    if (cual === 'logo') setLogo(pendiente)
    else setPortada(pendiente)
    setErrores(({ [cual]: _quitado, ...resto }) => resto)
    setAviso(null)
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (guardar.isPending) return
    const encontrados = erroresDelFormulario(datos, anioDeLima())
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setAviso('corrige')
      return
    }
    setErrores({})
    setAviso(null)
    guardar.mutate()
  }

  function dejarlo() {
    setDatos(inicial)
    setLogo(null)
    setPortada(null)
    setNuevo('')
    setErrores({})
    setAviso(null)
  }

  const vistaLogo = vistaDe(logo, guardado.logo)
  const vistaPortada = vistaDe(portada, guardado.portada)
  const sedes = guardado.sedes ?? []
  const previa = (
    <VistaPrevia
      codigo={guardado.codigo}
      nombre={guardado.nombre}
      ciudad={guardado.ciudad ?? null}
      datos={datos}
      logo={vistaLogo}
      portada={vistaPortada}
    />
  )

  return (
    <div className={estilos.dos}>
      <form className={estilos.editor} noValidate onSubmit={enviar} aria-label="Perfil de la empresa">
        <section className={estilos.seccion} aria-labelledby="sec-identidad">
          <h2 className={estilos.tituloSeccion} id="sec-identidad">
            Identidad
          </h2>
          <div className={estilos.imagenes}>
            <ZonaDeImagen
              cual="logo"
              rotulo="Logo"
              vista={vistaLogo}
              error={errores.logo}
              nombre={guardado.nombre}
              alElegir={(a) => void elegirImagen('logo', a)}
              alQuitar={() => setLogo(guardado.logo ? 'quitar' : null)}
            />
            <ZonaDeImagen
              cual="portada"
              rotulo="Foto de portada"
              vista={vistaPortada}
              error={errores.portada}
              nombre={guardado.nombre}
              alElegir={(a) => void elegirImagen('portada', a)}
              alQuitar={() => setPortada(guardado.portada ? 'quitar' : null)}
            />
          </div>
          <Campo etiqueta="Nombre de la empresa" value={guardado.nombre} readOnly />
          <div className={estilos.pareja}>
            <Campo
              etiqueta="Sector"
              value={datos.sector}
              maxLength={MAXIMO_SECTOR}
              error={errores.sector}
              onChange={(e) => poner('sector', e.target.value)}
            />
            <Seleccion
              etiqueta="Tamaño"
              value={datos.tamano}
              error={errores.tamano}
              onChange={(e) => poner('tamano', e.target.value)}
            >
              <option value="">Sin indicar</option>
              {TAMANOS.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.texto}
                </option>
              ))}
            </Seleccion>
            <Campo
              etiqueta="Año de fundación"
              value={datos.anioFundacion}
              inputMode="numeric"
              maxLength={4}
              error={errores.anioFundacion}
              onChange={(e) => poner('anioFundacion', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
          <div>
            <div className={estilos.cabeceraSedes}>
              <span className={estilos.rotulo}>Sedes</span>
              <Link className={estilos.gestionar} to={rutas.adminConfiguracion()}>
                Gestionar sedes
              </Link>
            </div>
            {sedes.length === 0 ? (
              <p className={areas.vacio}>Todavía no hay ninguna sede.</p>
            ) : (
              <ul className={areas.filas} role="list" aria-label="Sedes">
                {sedes.map((s, i) => (
                  <li className={areas.fila} key={`${s.nombre}-${i}`}>
                    <div className={areas.queEs}>
                      <span className={areas.nombre}>{s.nombre}</span>
                    </div>
                    {s.provincia && <span className={areas.explica}>{s.provincia}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={estilos.seccion} aria-labelledby="sec-presentacion">
          <h2 className={estilos.tituloSeccion} id="sec-presentacion">
            Presentación
          </h2>
          <AreaTexto
            etiqueta="Quiénes somos"
            value={datos.quienesSomos}
            maxLength={MAXIMO_TEXTO_LARGO}
            rows={5}
            error={errores.quienesSomos}
            onChange={(e) => poner('quienesSomos', e.target.value)}
          />
          <Contador escrito={datos.quienesSomos.length} maximo={MAXIMO_TEXTO_LARGO} />
          <AreaTexto
            etiqueta="Nuestro propósito"
            value={datos.propositoEmpresa}
            maxLength={MAXIMO_TEXTO_LARGO}
            rows={6}
            error={errores.propositoEmpresa}
            onChange={(e) => poner('propositoEmpresa', e.target.value)}
          />
          <Contador escrito={datos.propositoEmpresa.length} maximo={MAXIMO_TEXTO_LARGO} />
          <div>
            <div className={estilos.cabeceraSedes}>
              <span className={estilos.rotulo} id="rotulo-beneficios">
                Beneficios
              </span>
              <span className={estilos.contador}>
                {datos.beneficios.length} / {MAXIMO_BENEFICIOS}
              </span>
            </div>
            {datos.beneficios.length > 0 && (
              <ul className={estilos.beneficios} role="list" aria-labelledby="rotulo-beneficios">
                {datos.beneficios.map((b, i) => (
                  <li className={estilos.beneficio} key={`${b}-${i}`}>
                    {b}
                    <button
                      type="button"
                      className={estilos.quitarBeneficio}
                      aria-label={`Quitar ${b}`}
                      onClick={() =>
                        poner(
                          'beneficios',
                          datos.beneficios.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <IconoCruz tamano={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className={estilos.anadir}>
              <Campo
                etiqueta="Nuevo beneficio"
                etiquetaOculta
                value={nuevo}
                maxLength={MAXIMO_BENEFICIO}
                placeholder="Seguro EPS"
                disabled={datos.beneficios.length >= MAXIMO_BENEFICIOS}
                error={errores.beneficios}
                onChange={(e) => setNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    poner('beneficios', anadirBeneficio(datos.beneficios, nuevo))
                    setNuevo('')
                  }
                }}
              />
              <button
                type="button"
                className={estilos.chico}
                disabled={datos.beneficios.length >= MAXIMO_BENEFICIOS || nuevo.trim() === ''}
                onClick={() => {
                  poner('beneficios', anadirBeneficio(datos.beneficios, nuevo))
                  setNuevo('')
                }}
              >
                Añadir
              </button>
            </div>
          </div>
        </section>

        <section className={estilos.seccion} aria-labelledby="sec-video">
          <h2 className={estilos.tituloSeccion} id="sec-video">
            Video y enlaces
          </h2>
          <Campo
            etiqueta="Video de presentación"
            value={datos.videoPresentacion}
            inputMode="url"
            error={errores.videoPresentacion}
            onChange={(e) => poner('videoPresentacion', e.target.value)}
          />
          <div className={estilos.enlaces}>
            <Campo
              etiqueta="Página web"
              value={datos.paginaWeb}
              inputMode="url"
              error={errores.paginaWeb}
              onChange={(e) => poner('paginaWeb', e.target.value)}
            />
            {REDES.map((red) => (
              <Campo
                key={red.codigo}
                etiqueta={red.nombre}
                value={datos.redes[red.codigo]}
                inputMode="url"
                error={errores[red.codigo]}
                onChange={(e) => ponerRed(red.codigo, e.target.value)}
              />
            ))}
          </div>
        </section>

        <div className={estilos.pie}>
          <button className={estilos.guardar} type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          {cambiado && (
            <button className={estilos.chico} type="button" onClick={dejarlo} disabled={guardar.isPending}>
              Dejarlo
            </button>
          )}
          <button className={estilos.botonPrevia} type="button" onClick={() => setPreviaAbierta(true)}>
            Vista previa
          </button>
          <a className={estilos.verPerfil} href={rutas.empresa(guardado.codigo)} target="_blank" rel="noopener noreferrer">
            Ver perfil público ↗
          </a>
        </div>
        {aviso === 'bien' && (
          <p className={estilos.avisoBien} role="status">
            {MENSAJE_GUARDADO}
          </p>
        )}
        {aviso === 'corrige' && (
          <p className={estilos.avisoMalo} role="alert">
            {MENSAJE_CORRIGE}
          </p>
        )}
        {aviso === 'red' && (
          <p className={estilos.avisoMalo} role="alert">
            {MENSAJE_SIN_RED}
          </p>
        )}
      </form>

      <aside className={estilos.previa} aria-label="Vista previa del perfil público">
        {previa}
      </aside>

      <Modal abierto={previaAbierta} titulo="Vista previa" lateral onCerrar={() => setPreviaAbierta(false)}>
        {previa}
      </Modal>
    </div>
  )
}

/** Un fallo al subir o quitar una imagen, después de haber guardado lo demás. */
class FalloDeImagen extends Error {
  readonly cual: CualImagen

  constructor(cual: CualImagen, causa: unknown) {
    super(causa instanceof Error ? causa.message : 'No se pudo guardar la imagen.')
    this.cual = cual
  }
}

function soltar(pendiente: Pendiente) {
  if (pendiente && pendiente !== 'quitar') URL.revokeObjectURL(pendiente.vista)
}

/** Lo que se ve de una imagen: la elegida, ninguna si se va a quitar, o la guardada. */
function vistaDe(pendiente: Pendiente, guardada: string | null | undefined): string | null {
  if (pendiente === 'quitar') return null
  if (pendiente) return pendiente.vista
  return direccionPublica(guardada)
}

/** «N / 1500», siempre a la vista (el `Cuenta` compartido solo sale pasado el 80 %). */
function Contador({ escrito, maximo }: { escrito: number; maximo: number }) {
  return (
    <p className={`${estilos.contador}${escrito >= maximo ? ` ${estilos.contadorLleno}` : ''}`} aria-live="polite">
      {escrito} / {maximo}
    </p>
  )
}

function ZonaDeImagen({
  cual,
  rotulo,
  vista,
  error,
  nombre,
  alElegir,
  alQuitar,
}: {
  cual: CualImagen
  rotulo: string
  vista: string | null
  error?: string
  nombre: string
  alElegir: (archivo: File | undefined) => void
  alQuitar: () => void
}) {
  const id = `imagen-${cual}`
  return (
    <div className={estilos.zonaImagen}>
      <span className={estilos.rotulo} id={`${id}-rotulo`}>
        {rotulo}
      </span>
      <div className={cual === 'logo' ? estilos.logo : estilos.portada}>
        {vista ? (
          <img src={vista} alt={cual === 'logo' ? `Logo de ${nombre}` : `Portada de ${nombre}`} />
        ) : cual === 'logo' ? (
          <Iniciales empresa={nombre} grande className="size-full rounded-none text-2xl" />
        ) : null}
      </div>
      <div className={estilos.botonesImagen}>
        <label className={cabecera.accionFoto} htmlFor={id}>
          <IconoCamara tamano={16} />
          {vista ? 'Cambiar' : cual === 'logo' ? 'Subir logo' : 'Subir portada'}
        </label>
        {vista && (
          <button type="button" className={cabecera.accionFoto} onClick={alQuitar}>
            Quitar
          </button>
        )}
      </div>
      <input
        id={id}
        className={cabecera.entradaOculta}
        type="file"
        aria-labelledby={`${id}-rotulo`}
        accept={FORMATOS_IMAGEN_EMPRESA.join(',')}
        onChange={(e) => {
          alElegir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {error && (
        <p className={estilos.errorImagen} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * El perfil público en pequeño, con lo que se está escribiendo: cambia al
 * escribir. Las vacantes son las de verdad, del perfil público.
 */
function VistaPrevia({
  codigo,
  nombre,
  ciudad,
  datos,
  logo,
  portada,
}: {
  codigo: string
  nombre: string
  ciudad: string | null
  datos: Formulario
  logo: string | null
  portada: string | null
}) {
  const publico = useQuery({
    queryKey: ['perfil-de-empresa', codigo.toLowerCase()],
    queryFn: () => verPerfilDeEmpresa(codigo),
    retry: false,
  })
  const vacantes = publico.data?.vacantes ?? []
  const linea = lineaDeDatos({
    sector: datos.sector,
    tamanoTexto: TAMANOS.find((t) => t.codigo === datos.tamano)?.texto ?? null,
    anioFundacion: /^\d{4}$/.test(datos.anioFundacion) ? Number(datos.anioFundacion) : null,
  })
  const video = leerVideo(normalizarEnlace(datos.videoPresentacion))
  const enlaces = enlacesDeLaEmpresa(
    normalizarEnlace(datos.paginaWeb),
    REDES.map((r) => ({ red: r.codigo, enlace: normalizarEnlace(datos.redes[r.codigo]) })),
  )
  const beneficios = datos.beneficios.filter((b) => b.trim())

  return (
    <div className={estilos.tarjetaPrevia}>
      <div className={estilos.portadaPrevia} style={portada ? { backgroundImage: `url("${portada}")` } : undefined} />
      <div className={estilos.cabeceraPrevia}>
        <div className={estilos.logoPrevia}>
          {logo ? (
            <img src={logo} alt="" />
          ) : (
            <Iniciales empresa={nombre} grande className="size-full rounded-none text-xl" />
          )}
        </div>
      </div>
      <div className={estilos.cuerpoPrevia}>
        <div>
          <p className={estilos.nombrePrevia}>{nombre}</p>
          {linea && <p className={estilos.lineaPrevia}>{linea}</p>}
          {ciudad && <p className={estilos.lineaPrevia}>{ciudad}</p>}
        </div>
        {datos.quienesSomos.trim() && (
          <div>
            <p className={estilos.tituloPrevia}>Quiénes somos</p>
            <p className={estilos.textoPrevia}>{datos.quienesSomos.trim()}</p>
          </div>
        )}
        {datos.propositoEmpresa.trim() && (
          <div>
            <p className={estilos.tituloPrevia}>Nuestro propósito</p>
            <p className={estilos.textoPrevia}>{datos.propositoEmpresa.trim()}</p>
          </div>
        )}
        {video && <RecuadroDeVideo video={video} empresa={nombre} />}
        {beneficios.length > 0 && (
          <div>
            <p className={estilos.tituloPrevia}>Beneficios</p>
            <p className={estilos.textoPrevia}>{beneficios.join(' · ')}</p>
          </div>
        )}
        <div>
          <p className={estilos.tituloPrevia}>Vacantes abiertas ({vacantes.length})</p>
          {vacantes.length > 0 && (
            <ul className={estilos.vacantesPrevia} role="list">
              {vacantes.map((v) => (
                <li className={estilos.vacantePrevia} key={v.id}>
                  {v.titulo}
                  <span>{[v.modalidad, v.ciudad?.nombre].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <EnlacesDeLaEmpresa enlaces={enlaces} etiqueta="Enlaces de la vista previa" />
      </div>
    </div>
  )
}
