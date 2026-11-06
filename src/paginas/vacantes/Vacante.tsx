/**
 * La ficha de una vacante.
 *
 * Se ve sin cuenta: `GET /vacantes/{id}` es publico. Postular si la pide, y por
 * eso el boton lleva a crear cuenta cuando no la hay, recordando a que vacante
 * se estaba postulando.
 *
 * **Los requisitos indispensables van en ambar.** Son lo unico que decide el
 * sistema solo: al postular hay que confirmarlos uno por uno, y dejar alguno sin
 * marcar cierra la postulacion en el acto. Enseñarlos aqui, antes de empezar, es
 * lo que evita que alguien llegue al final y se lleve el golpe. No van en coral
 * porque aqui todavia no hay postulacion y por tanto no hay turno.
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
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import { verVacante } from '@/api/portal'
import type { RemuneracionPublica } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import { rutas } from '@/rutas'
import { Remuneracion } from '@/ui/Remuneracion'
import { TituloQueViaja } from '@/ui/movimiento'
import { TextoPlano } from '@/ui/TextoPlano'
import { modalidadCanonica, normalizar } from './busqueda'
import estilos from './Vacante.module.css'

/**
 * «← Volver a las vacantes».
 *
 * Si se llegó desde `/vacantes`, vuelve atrás en el historial: la lista se monta
 * con la misma búsqueda, los mismos filtros y el mismo orden, y se desplaza hasta
 * la tarjeta que se abrió. Si se llegó directo por un enlace, no hay lista a la
 * que volver y lleva a `/vacantes` limpia.
 */
function Volver() {
  const { state } = useLocation()
  const navegar = useNavigate()
  const desdeLaLista = Boolean((state as { desdeLaLista?: boolean } | null)?.desdeLaLista)
  if (desdeLaLista) {
    return (
      <button className={estilos.volverAtras} type="button" onClick={() => navegar(-1)}>
        ← Volver a las vacantes
      </button>
    )
  }
  return (
    <Link className={estilos.volver} to={rutas.vacantes()}>
      ← Volver a las vacantes
    </Link>
  )
}

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
        <Volver />
        <div className={estilos.marco}>
          {/*
            «Esta vacante ya no está disponible» cubre los tres casos que aquí
            dan 404 —cerrada, empresa suspendida y retirada por la empresa— y no
            los distingue a propósito: para quien mira, los tres significan lo
            mismo y explicar cuál es cuál sería contar por dentro de otra
            empresa. La frase es la que dice la decisión del 21/09/2026 para la
            vacante eliminada, y vale igual para las otras dos.
          */}
          <h1>
            {noExiste
              ? 'Esta vacante ya no está disponible.'
              : 'No pudimos cargar este puesto.'}
          </h1>
          <p className={estilos.marcoTexto}>
            {noExiste
              ? 'Puede que la convocatoria se haya cerrado o que la empresa la haya retirado. Hay otros puestos abiertos.'
              : consulta.error instanceof Error
                ? consulta.error.message
                : 'No pudimos conectar con el servidor.'}
          </p>
          {noExiste ? (
            <Link
              className={estilos.reintentar}
              to={rutas.vacantes()}
              data-rotulo="Ver los puestos abiertos"
            >
              Ver los puestos abiertos
            </Link>
          ) : (
            <button
              type="button"
              className={estilos.reintentar}
              onClick={() => void consulta.refetch()}
              data-rotulo="Intentar de nuevo"
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
  const modalidad = modalidadCanonica(v.modalidad)
  const ciudad = v.ciudad?.nombre ?? null
  const zona = (v.ubicacion ?? '').trim() || null
  const lugar = [ciudad, zona && (!ciudad || normalizar(zona) !== normalizar(ciudad)) ? zona : null]
    .filter(Boolean)
    .join(' · ')
  const horario = (v.horario ?? '').trim() || null
  const sobreElPuesto = v.proposito || v.descripcion

  return (
    <div className={estilos.pagina}>
      <Volver />

      <div className={estilos.encabezado}>
        {/* B · el otro extremo del titulo que viaja desde la tarjeta. */}
        <TituloQueViaja id={v.id} como="h1" className={estilos.titular}>
          {v.titulo}
        </TituloQueViaja>
        {v.nombreEmpresa && <p className={estilos.empresa}>{v.nombreEmpresa}</p>}
      </div>

      {/*
        Dos columnas: a la izquierda se lee, a la derecha queda fijo lo que se
        compara entre vacantes —sueldo, modalidad, ciudad, horario— y el boton.
        La tarjeta va primero en el arbol para que en movil quede arriba; en
        escritorio la rejilla la manda a la derecha.
      */}
      <div className={estilos.reparto}>
        <aside className={estilos.lateral} aria-label="Lo esencial del puesto">
          <div className={estilos.tarjeta}>
            <Remuneracion remuneracion={v.remuneracion} />
            {(modalidad || lugar || horario) && (
              <dl className={estilos.ficha}>
                {modalidad && (
                  <div className={estilos.fila}>
                    <dt>Modalidad</dt>
                    <dd>{modalidad}</dd>
                  </div>
                )}
                {lugar && (
                  <div className={estilos.fila}>
                    <dt>Ciudad</dt>
                    <dd>{lugar}</dd>
                  </div>
                )}
                {horario && (
                  <div className={estilos.fila}>
                    <dt>Horario</dt>
                    <dd>
                      {horario.split(/\s+·\s+/).map((parte, i) => (
                        <span className={estilos.linea} key={`${i}-${parte}`}>
                          {parte}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {/* Un solo boton: en movil este mismo bloque se pega abajo. */}
            <div className={estilos.accion}>
              <Link
                className={estilos.boton}
                to={hayCuenta ? rutas.postular(v.id) : rutas.registro(v.id)}
                data-rotulo="Postular a este puesto"
              >
                Postular a este puesto
              </Link>
            </div>
          </div>
        </aside>

        <article className={estilos.contenido}>
          {sobreElPuesto && (
            <section className={estilos.bloque}>
              <h2 className={estilos.tituloBloque}>
                {v.proposito ? 'El resultado que esperamos' : 'Sobre el puesto'}
              </h2>
              <Descripcion texto={sobreElPuesto} yaDichos={{ horario: horario !== null, lugar: lugar !== '', modalidad: modalidad !== null, montos: montosDe(v.remuneracion) }} />
            </section>
          )}

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
        </article>
      </div>
    </div>
  )
}

/**
 * Una linea que es un titulo dentro del texto libre: «LO QUE OFRECEMOS»,
 * «HORARIO». Toda en mayusculas, corta y con al menos tres letras; un «S/ 3500»
 * o una sigla suelta no cuentan.
 */
function esTitulo(linea: string): boolean {
  const t = linea.trim().replace(/:$/, '')
  if (t.length < 3 || t.length > 60) return false
  const letras = t.replace(/[^\p{L}]/gu, '')
  return letras.length >= 3 && letras === letras.toLocaleUpperCase('es') && letras !== letras.toLocaleLowerCase('es')
}

/** «LO QUE OFRECEMOS» → «Lo que ofrecemos». */
function enFrase(linea: string): string {
  const t = linea.trim().replace(/:$/, '').toLocaleLowerCase('es')
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1)
}

/** Lo que la tarjeta lateral ya dice, para no repetirlo en la descripcion. */
interface YaDichos {
  horario: boolean
  lugar: boolean
  modalidad: boolean
  /** Los montos de la remuneracion publicada, solo con sus cifras: «3500». */
  montos: string[]
}

function montosDe(r: RemuneracionPublica | null | undefined): string[] {
  if (!r || r.tipo === 'OCULTA') return []
  return [r.min, r.max].filter((n): n is number => typeof n === 'number').map((n) => String(Math.round(n)))
}

/** Los tramos cuyo titulo es un dato que ya esta en la tarjeta. */
function tramoRepetido(titulo: string, ya: YaDichos): boolean {
  const t = normalizar(titulo)
  if (ya.horario && /^(horario|horarios|jornada)( de trabajo| laboral)?$/.test(t)) return true
  if (ya.lugar && /^(ubicacion|lugar|lugar de trabajo|sede)$/.test(t)) return true
  if (ya.modalidad && /^modalidad( de trabajo)?$/.test(t)) return true
  if (ya.montos.length > 0 && /^(remuneracion|sueldo|salario)$/.test(t)) return true
  return false
}

/**
 * Una viñeta que empieza por el mismo monto de la tarjeta: se le quita el monto
 * y se queda lo demas («S/ 3,500 fijos + bonos por resultados» → «Bonos por
 * resultados.»). Si no queda nada, la linea sobra entera.
 */
function sinMontoRepetido(linea: string, montos: string[]): string | null {
  const m = /^([ \t]*[-•*][ \t]+)?S\/\.?\s*([\d.,\s]+)(.*)$/.exec(linea)
  if (!m) return linea
  const cifra = (m[2] ?? '').replace(/[^\d]/g, '')
  if (!montos.includes(cifra)) return linea
  const resto = (m[3] ?? '')
    .replace(/^\s*(fijos?|mensuales?|soles|netos?|brutos?)\b/i, '')
    .replace(/^\s*[+,;:·-]\s*/, '')
    .trim()
  if (!resto || /^[.\s]*$/.test(resto)) return null
  return `${m[1] ?? ''}${resto.charAt(0).toLocaleUpperCase('es')}${resto.slice(1)}`
}

/**
 * La descripcion, con sus titulos en mayusculas convertidos en subtitulos y sus
 * lineas «•» en listas. Si no trae titulos, se ve como parrafos. Lo que ya dice
 * la tarjeta lateral no se repite.
 */
function Descripcion({ texto, yaDichos }: { texto: string; yaDichos: YaDichos }) {
  const tramos: { titulo: string | null; cuerpo: string[] }[] = [{ titulo: null, cuerpo: [] }]
  for (const linea of texto.split('\n')) {
    if (esTitulo(linea)) tramos.push({ titulo: enFrase(linea), cuerpo: [] })
    else {
      const limpia = sinMontoRepetido(linea, yaDichos.montos)
      if (limpia !== null) tramos.at(-1)!.cuerpo.push(limpia)
    }
  }
  return (
    <div className={estilos.descripcion}>
      {tramos.map((t, i) => {
        if (t.titulo && tramoRepetido(t.titulo, yaDichos)) {
          // El tramo repetido se va, pero no la frase de cierre que venga
          // despues de su primer parrafo (p. ej. «Postula y construye…»).
          const resto = t.cuerpo.join('\n').trim().split(/\n[ \t]*\n+/).slice(1).join('\n\n')
          return resto ? (
            <div className={estilos.tramo} key={i}>
              <TextoPlano texto={resto} listas className={estilos.texto} />
            </div>
          ) : null
        }
        const cuerpo = t.cuerpo.join('\n').trim()
        if (!t.titulo && !cuerpo) return null
        return (
          <div className={estilos.tramo} key={i}>
            {t.titulo && <h3 className={estilos.subtitulo}>{t.titulo}</h3>}
            {cuerpo && <TextoPlano texto={cuerpo} listas className={estilos.texto} />}
          </div>
        )
      })}
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
