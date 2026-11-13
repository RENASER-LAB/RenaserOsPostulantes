/**
 * La lista de «Pruebas»: la tabla del panel agrupada en «Publicadas» y
 * «Borradores sin publicar» (spec pruebas-indice-de-la-empresa, «Referencia visual»).
 *
 * Las columnas se adaptan al ancho de la LISTA, no al de la pantalla (consultas
 * de contenedor en la hoja): ancha, Vacante · Nivel · Situación · Estado ·
 * Resumen · Versión · Acciones; media, «Nivel y situación» y «Resumen y versión»
 * apiladas; estrecha y teléfono, cada fila pasa a tarjeta con sus botones en
 * una línea. Con una prueba abierta al lado, la lista es compacta.
 *
 * Abrir una fila («Ver», el clic en la fila o Enter) es cosa de quien la pinta.
 */

import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import { IconoAbrirFuera, IconoCopiar } from '@/ui/Iconos'
import type { FilaDePrueba } from '../api/pruebas'
import { agrupar, fechaCorta, nivelParaLeer, nombreDeLaSituacion, partesDelResumen, PESTANAS, textoDeLaVersion, tituloConSede, type Pestana } from './indice'
import { MarcasDeEstado, ResumenDeLaPrueba } from './piezas'
import estilos from './Pruebas.module.css'

interface Props {
  filas: FilaDePrueba[]
  pestana: Pestana
  abierta: number | null
  /** `conTeclado`: se abrió con Enter o Espacio (no se anima). */
  alAbrir: (vacanteId: number, conTeclado: boolean) => void
  alUsarEnOtra: (vacanteId: number, conTeclado: boolean) => void
}

export function ListaDePruebas({ filas, pestana, abierta, alAbrir, alUsarEnOtra }: Props) {
  const { publicadas, borradores } = agrupar(filas)
  const nombre = PESTANAS.find((p) => p.clave === pestana)!.nombre
  const grupo = (titulo: string, lista: FilaDePrueba[]) =>
    lista.length > 0 && (
      <tbody>
        <tr className={estilos.filaGrupo}>
          <th colSpan={8} scope="colgroup">
            {titulo}
            <span className={estilos.cuentaGrupo}>{lista.length}</span>
          </th>
        </tr>
        {lista.map((f) => (
          <Fila
            key={f.vacanteId}
            fila={f}
            pestana={pestana}
            abierta={abierta === f.vacanteId}
            alAbrir={alAbrir}
            alUsarEnOtra={alUsarEnOtra}
          />
        ))}
      </tbody>
    )

  return (
    <div className={estilos.envoltura}>
      <table className={estilos.tabla} aria-label={nombre}>
        <thead>
          <tr>
            <th className={estilos.cVacante}>Vacante</th>
            <th className={estilos.cNivel}>
              Nivel<span className={estilos.soloMedia}> y situación</span>
            </th>
            <th className={estilos.cSituacion}>Situación</th>
            <th className={estilos.cEstado}>Estado</th>
            <th className={estilos.cResumen}>
              Resumen<span className={estilos.soloMedia}> y versión</span>
            </th>
            <th className={estilos.cVersion}>Versión</th>
            <th className={estilos.cDatos}>Datos</th>
            <th className={estilos.cAcciones}>
              <span className="solo-lectores">Acciones</span>
            </th>
          </tr>
        </thead>
        {grupo('Publicadas', publicadas)}
        {grupo('Borradores sin publicar', borradores)}
      </table>
    </div>
  )
}

function Fila({
  fila,
  pestana,
  abierta,
  alAbrir,
  alUsarEnOtra,
}: {
  fila: FilaDePrueba
  pestana: Pestana
  abierta: boolean
  alAbrir: Props['alAbrir']
  alUsarEnOtra: Props['alUsarEnOtra']
}) {
  const nombre = tituloConSede(fila)
  const ruta = pestana === 'prueba' ? rutas.adminPruebaPropia(fila.vacanteId) : rutas.adminPreguntasPropias(fila.vacanteId)
  return (
    <tr
      className={abierta ? `${estilos.fila} ${estilos.filaAbierta}` : estilos.fila}
      data-vacante={fila.vacanteId}
      onClick={(e) => {
        // Los botones y enlaces de la fila hacen lo suyo; el resto de la fila la abre.
        if ((e.target as HTMLElement).closest('a, button')) return
        alAbrir(fila.vacanteId, false)
      }}
    >
      <td className={estilos.cVacante}>
        <button
          type="button"
          className={estilos.ver}
          data-recorrible=""
          data-ver={fila.vacanteId}
          aria-controls="lectura"
          aria-expanded={abierta}
          title={nombre}
          onClick={(e) => alAbrir(fila.vacanteId, e.detail === 0)}
        >
          <span className="solo-lectores">Ver</span> {fila.titulo}
          {fila.sede && <span className={estilos.sede}> · {fila.sede}</span>}
        </button>
      </td>
      <td className={estilos.cNivel}>{nivelParaLeer(fila.nivel)}</td>
      <td className={estilos.cSituacion}>{nombreDeLaSituacion(fila.situacion)}</td>
      <td className={estilos.cEstado}>
        <MarcasDeEstado fila={fila} />
      </td>
      <td className={estilos.cResumen}>
        <ResumenDeLaPrueba partes={partesDelResumen(fila, pestana)} />
      </td>
      <td className={estilos.cVersion}>{fila.publicadaEn ? fechaCorta(fila.publicadaEn) : 'Sin publicar'}</td>
      <td className={estilos.cDatos}>
        <span className={estilos.datos}>
          <span className={estilos.dato}>{nivelParaLeer(fila.nivel)}</span>
          <span className={estilos.dato}>Situación: {nombreDeLaSituacion(fila.situacion)}</span>
          <span className={estilos.dato}>{textoDeLaVersion(fila)}</span>
        </span>
      </td>
      <td className={estilos.cAcciones}>
        <Link className={`${estilos.chico} ${estilos.soloIcono}`} to={ruta} aria-label={`Abrir «${nombre}» en la vacante`}>
          <IconoAbrirFuera tamano={18} />
          <span className={estilos.textoChico}>Abrir en la vacante</span>
        </Link>
        {fila.puedeUsarEnOtra && (
          <button
            type="button"
            className={`${estilos.chico} ${estilos.soloIcono}`}
            aria-label={`Usar «${nombre}» en otra vacante`}
            title="Usar en otra vacante"
            onClick={(e) => alUsarEnOtra(fila.vacanteId, e.detail === 0)}
          >
            <IconoCopiar tamano={18} />
            <span className={estilos.textoChico}>Usar en otra vacante</span>
          </button>
        )}
      </td>
    </tr>
  )
}
