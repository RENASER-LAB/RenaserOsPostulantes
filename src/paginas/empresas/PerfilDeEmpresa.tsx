/**
 * El perfil público de una empresa (V85): `/empresas/<código>`, sin cuenta como
 * el tablón, del estilo de los perfiles de empresa de los portales de empleo.
 *
 * Arriba la portada a todo lo ancho, el logo superpuesto (o sus iniciales), el
 * nombre, «Sector · Tamaño · Fundada en AAAA» con lo que haya, la provincia de
 * su primera sede, «Ver vacantes (N)» y «Visitar web». Debajo, en la columna
 * principal: «Quiénes somos», «Nuestro propósito», el video, «Beneficios» y
 * «Vacantes abiertas (N)» con la tarjeta real del tablón; y a la derecha la
 * ficha fija «Datos de la empresa». En el teléfono, todo en una columna con la
 * ficha antes que lo demás.
 *
 * **Sin datos no hay bloques vacíos**: sale el nombre con sus vacantes. Una
 * empresa suspendida o un código que no existe dan «no encontrada» —sin botón
 * de reintentar: repetir la misma petición no devolvería otra cosa—.
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import { direccionPublica } from '@/api/puerta'
import { verPerfilDeEmpresa } from '@/api/portal'
import type { PerfilDeEmpresa as Perfil } from '@/api/tipos'
import { esVideoReproducible, lineaDeDatos } from '@/dominio/presentacionEmpresa'
import { rutas } from '@/rutas'
import { IconoUbicacion, IconoVisto } from '@/ui/Iconos'
import { EnlacesDeLaEmpresa, enlacesDeLaEmpresa } from '@/ui/presentacion/EnlacesDeLaEmpresa'
import { RecuadroDeVideo } from '@/ui/presentacion/RecuadroDeVideo'
import { FilaDeVacante, Iniciales } from '@/paginas/vacantes/FilaDeVacante'
import { recortado } from '@/paginas/vacantes/busqueda'
import cabecera from '@/paginas/perfil/Cabecera.module.css'
import perfil from '@/paginas/perfil/Perfil.module.css'
import lateral from '@/paginas/perfil/Lateral.module.css'
import estilos from './PerfilDeEmpresa.module.css'

const ANCLA_VACANTES = 'vacantes-abiertas'

export function PerfilDeEmpresa() {
  const { codigo = '' } = useParams()
  const consulta = useQuery({
    queryKey: ['perfil-de-empresa', codigo.toLowerCase()],
    queryFn: () => verPerfilDeEmpresa(codigo),
    enabled: codigo !== '',
    retry: (veces, error) => !(error instanceof ErrorApi && error.estado === 404) && veces < 2,
  })

  if (consulta.isPending) {
    return (
      <div className={perfil.pagina} aria-busy="true">
        <h1 className={cabecera.nombre}>Cargando la empresa…</h1>
      </div>
    )
  }

  if (consulta.isError) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.estado === 404
    return (
      <div className={perfil.pagina}>
        <Link className={perfil.volver} to={rutas.vacantes()}>
          ← Volver a las vacantes
        </Link>
        <div className={estilos.noEncontrada}>
          <h1>{noExiste ? 'No encontramos esta empresa.' : 'No pudimos cargar esta empresa.'}</h1>
          <p className={estilos.texto}>
            {noExiste
              ? 'Puede que el enlace esté mal escrito o que la empresa ya no publique en EX. Hay otros puestos abiertos.'
              : 'No pudimos conectar con el servidor.'}
          </p>
          {noExiste ? (
            <Link className={estilos.reintentar} to={rutas.vacantes()}>
              Ver los puestos abiertos
            </Link>
          ) : (
            <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>
              Intentar de nuevo
            </button>
          )}
        </div>
      </div>
    )
  }

  return <ElPerfil datos={consulta.data} />
}

export function ElPerfil({ datos }: { datos: Perfil }) {
  const vacantes = Array.isArray(datos.vacantes) ? datos.vacantes : []
  const linea = lineaDeDatos(datos)
  const logo = direccionPublica(datos.logo)
  const portada = direccionPublica(datos.portada)
  const enlaces = enlacesDeLaEmpresa(datos.paginaWeb, datos.redes)
  const web = enlaces.find((e) => e.clave === 'WEB')?.href ?? null
  const quienes = recortado(datos.quienesSomos)
  const proposito = recortado(datos.proposito)
  const video = esVideoReproducible(datos.video) ? datos.video! : null
  const beneficios = (datos.beneficios ?? []).filter((b) => recortado(b))
  const sedes = (datos.sedes ?? []).filter((s) => recortado(s))
  const sector = recortado(datos.sector)
  const tamano = recortado(datos.tamanoTexto)
  const hayFicha = Boolean(sector || tamano || datos.anioFundacion || sedes.length || enlaces.length)

  return (
    <div className={perfil.pagina}>
      <Link className={perfil.volver} to={rutas.vacantes()}>
        ← Volver a las vacantes
      </Link>

      <header className={cabecera.cabecera}>
        <div className={cabecera.zonaPortada}>
          <div
            className={cabecera.portada}
            style={portada ? { backgroundImage: `url("${portada}")` } : undefined}
            role={portada ? 'img' : undefined}
            aria-label={portada ? `Portada de ${datos.nombre}` : undefined}
          />
        </div>
        <div className={cabecera.identidad}>
          <div className={cabecera.zonaFoto}>
            <div className={`${cabecera.disco} ${estilos.discoLogo}`}>
              {logo ? (
                <img className={cabecera.imagen} src={logo} alt={`Logo de ${datos.nombre}`} />
              ) : (
                <Iniciales empresa={datos.nombre} grande className="size-full rounded-none text-4xl" />
              )}
            </div>
          </div>
          <div className={cabecera.datos}>
            <div className={estilos.cabeceraDatos}>
              <div>
                <h1 className={cabecera.nombre}>{datos.nombre}</h1>
                {linea && <p className={estilos.linea}>{linea}</p>}
                {recortado(datos.ciudad) && (
                  <p className={estilos.ciudad}>
                    <IconoUbicacion tamano={16} />
                    {datos.ciudad}
                  </p>
                )}
              </div>
              <div className={estilos.acciones}>
                <a className={estilos.verVacantes} href={`#${ANCLA_VACANTES}`}>
                  Ver vacantes ({vacantes.length})
                </a>
                {web && (
                  <a className={estilos.visitarWeb} href={web} target="_blank" rel="noopener noreferrer">
                    Visitar web
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sin ficha no queda una columna vacía a la derecha. */}
      <div className={perfil.cuerpo} style={hayFicha ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className={perfil.principal}>
          {quienes && (
            <section className={estilos.seccion} aria-labelledby="quienes-somos">
              <h2 className={estilos.tituloSeccion} id="quienes-somos">
                Quiénes somos
              </h2>
              <p className={estilos.texto}>{quienes}</p>
            </section>
          )}
          {proposito && (
            <section className={estilos.seccion} aria-labelledby="nuestro-proposito">
              <h2 className={estilos.tituloSeccion} id="nuestro-proposito">
                Nuestro propósito
              </h2>
              <p className={estilos.texto}>{proposito}</p>
            </section>
          )}
          {video && (
            <section className={estilos.seccion} aria-label={`Video de ${datos.nombre}`}>
              <RecuadroDeVideo video={video} empresa={datos.nombre} titulo={`Conoce a ${datos.nombre}`} />
            </section>
          )}
          {beneficios.length > 0 && (
            <section className={estilos.seccion} aria-labelledby="beneficios">
              <h2 className={estilos.tituloSeccion} id="beneficios">
                Beneficios
              </h2>
              <ul className={estilos.beneficios} role="list">
                {beneficios.map((b) => (
                  <li className={estilos.beneficio} key={b}>
                    <IconoVisto tamano={16} />
                    {b}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className={estilos.seccion} id={ANCLA_VACANTES} aria-labelledby="titulo-vacantes">
            <h2 className={estilos.tituloSeccion} id="titulo-vacantes">
              Vacantes abiertas ({vacantes.length})
            </h2>
            {vacantes.length === 0 ? (
              <p className={estilos.sinVacantes}>Ahora no tiene vacantes abiertas</p>
            ) : (
              <ul className={estilos.vacantes} role="list">
                {vacantes.map((v) => (
                  <li key={v.id}>
                    <FilaDeVacante vacante={v} sinEmpresa />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {hayFicha && (
          <aside className={lateral.lateral} aria-label="Datos de la empresa">
            <section className={lateral.bloque}>
              <h2 className={lateral.titulo}>Datos de la empresa</h2>
              <dl className={estilos.ficha}>
                {sector && (
                  <div className={estilos.fila}>
                    <dt>Sector</dt>
                    <dd>{sector}</dd>
                  </div>
                )}
                {tamano && (
                  <div className={estilos.fila}>
                    <dt>Tamaño</dt>
                    <dd>{tamano}</dd>
                  </div>
                )}
                {datos.anioFundacion && (
                  <div className={estilos.fila}>
                    <dt>Fundación</dt>
                    <dd>{datos.anioFundacion}</dd>
                  </div>
                )}
                {sedes.length > 0 && (
                  <div className={estilos.fila}>
                    <dt>Sedes</dt>
                    <dd>{sedes.join(' · ')}</dd>
                  </div>
                )}
              </dl>
              <EnlacesDeLaEmpresa className={estilos.enlacesDeLaFicha} enlaces={enlaces} />
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}
