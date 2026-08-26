/**
 * La ficha de una vacante.
 *
 * Se ve sin cuenta: `GET /vacantes/{id}` es publico. Postular si la pide, y por
 * eso el boton lleva a crear cuenta cuando no la hay, recordando a que vacante
 * se estaba postulando.
 *
 * **Los requisitos indispensables llevan el acento.** Son lo unico que decide el
 * sistema solo: al postular hay que confirmarlos uno por uno, y dejar alguno sin
 * marcar cierra la postulacion en el acto. Enseñarlos aqui, antes de empezar, es
 * lo que evita que alguien llegue al final y se lleve el golpe.
 *
 * Casi todos los campos del backend son texto libre y pueden venir vacios: la
 * pantalla se arma con lo que haya.
 *
 * ⚠️ **Un 404 aqui es normal, no una averia.** El tablon mezcla empresas, y la
 * vacante de una empresa suspendida deja de existir para todo el mundo. Un
 * enlace guardado o compartido puede quedarse muerto en cualquier momento, asi
 * que ese caso tiene su propia salida y **sin boton de reintentar**: repetir la
 * misma peticion nunca va a devolver otra cosa.
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import { verVacante } from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import estilos from './Vacante.module.css'

export function Vacante() {
  const { vacanteId = '' } = useParams()
  const { hayCuenta } = useSesion()

  const consulta = useQuery({
    queryKey: ['vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: vacanteId !== '',
  })

  if (consulta.isPending) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.marco} aria-busy="true">
          <h1>Cargando el puesto…</h1>
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
          <div className={`${estilos.barra} ${estilos.barraCorta}`} />
        </div>
      </div>
    )
  }

  if (consulta.isError) {
    // Que no exista y que no se pueda pedir son dos cosas distintas, y la
    // diferencia esta en si tiene sentido volver a intentarlo.
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.estado === 404

    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.vacantes()}>
          ← Volver a las vacantes
        </Link>
        <div className={estilos.marco}>
          <h1>{noExiste ? 'Este puesto ya no está abierto.' : 'No pudimos cargar este puesto.'}</h1>
          <p className={estilos.marcoTexto}>
            {noExiste
              ? 'Puede que la convocatoria se haya cerrado o que la empresa ya no esté publicando. Hay otros puestos abiertos.'
              : consulta.error instanceof Error
                ? consulta.error.message
                : 'No pudimos conectar con el servidor.'}
          </p>
          {noExiste ? (
            <Link className={estilos.reintentar} to={rutas.vacantes()}>
              Ver los puestos abiertos
            </Link>
          ) : (
            <button
              type="button"
              className={estilos.reintentar}
              onClick={() => void consulta.refetch()}
            >
              Intentar de nuevo
            </button>
          )}
        </div>
      </div>
    )
  }

  const v = consulta.data
  const requisitos = Array.isArray(v.requisitosObjetivos) ? v.requisitosObjetivos : []
  const datos = [v.modalidad, v.ubicacion, v.horario, v.compensacionPublica].filter(Boolean)

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.vacantes()}>
        ← Volver a las vacantes
      </Link>

      <div className={estilos.encabezado}>
        <h1>{v.titulo}</h1>
        {/*
          Quien contrata va aqui y no entre los datos de abajo: «Hibrido» y
          «Arequipa» se comparan de un vistazo entre vacantes, pero de quien es
          el puesto no es un metadato mas — es la mitad de la pregunta.
        */}
        {v.nombreEmpresa && <p className={estilos.empresa}>{v.nombreEmpresa}</p>}
        {datos.length > 0 && (
          <div className={estilos.donde}>
            {datos.map((d) => (
              <span className={estilos.dato} key={d}>
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      {v.proposito && (
        <section className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>El resultado que esperamos</h2>
          <p className={estilos.texto}>{v.proposito}</p>
        </section>
      )}

      {v.descripcion && !v.proposito && (
        <section className={estilos.bloque}>
          <h2 className={estilos.tituloBloque}>Sobre el puesto</h2>
          <p className={estilos.texto}>{v.descripcion}</p>
        </section>
      )}

      {/* Dos listas paralelas: en escritorio van al lado, no una debajo de otra.
          Si solo llega una, ocupa el ancho entero ella sola. */}
      <div className={estilos.dosListas}>
        {v.responsabilidades && (
          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Lo que harás</h2>
            <Puntos texto={v.responsabilidades} />
          </section>
        )}

        {v.requisitos && (
          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Lo que buscamos</h2>
            <Puntos texto={v.requisitos} />
          </section>
        )}
      </div>

      {requisitos.length > 0 && (
        <section className={estilos.requisitos}>
          <h2>Requisitos indispensables</h2>
          <p className={estilos.avisoRequisitos}>
            Estos son condición para el puesto. Al postular te pediremos que confirmes cada
            uno, y <b>no cumplir alguno cierra la postulación</b>. Léelos antes de empezar.
          </p>
          <ul className={estilos.listaRequisitos} role="list">
            {requisitos.map((r) => (
              <li className={estilos.requisito} key={r.id}>
                {r.descripcion}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={estilos.postular}>
        <Link
          className={estilos.boton}
          to={hayCuenta ? rutas.postular(v.id) : rutas.registro(v.id)}
        >
          Postular a este puesto
        </Link>
        <p className={estilos.aclaracion}>
          {hayCuenta
            ? 'Te pediremos tu currículum y un resultado del que te sientas orgulloso.'
            : 'Si aún no tienes cuenta, la creas en el siguiente paso y seguimos con tu postulación.'}
        </p>
      </div>
    </div>
  )
}

/**
 * El backend manda estos campos como un texto con saltos de linea, uno por
 * punto. Pintarlo tal cual daba un parrafo largo donde deberia haber una lista.
 */
function Puntos({ texto }: { texto: string }) {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)

  if (lineas.length < 2) return <p className={estilos.texto}>{texto}</p>

  return (
    <ul className={estilos.puntos} role="list">
      {lineas.map((linea, i) => (
        <li className={estilos.punto} key={`${i}-${linea.slice(0, 20)}`}>
          {linea}
        </li>
      ))}
    </ul>
  )
}
