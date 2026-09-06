/**
 * La columna lateral: cuánto llevas y tu currículum.
 *
 * ⚠️ **El medidor NO es una puerta y no regaña.** Nada del perfil es obligatorio
 * y nada bloquea postular (RF-156). Por eso no hay rojo, no hay candado, no dice
 * «incompleto» y lo que falta se llama «puedes añadir», no «te falta». Un portal
 * de empleo que riñe a quien busca trabajo es exactamente lo que este no quiere
 * ser.
 *
 * ⚠️ **Y aquí tampoco hay violeta.** El acento de la pantalla lo tiene el panel
 * de datos por revisar, que es lo único que de verdad le toca al candidato.
 * Verde cuando está lleno, tinta cuando no.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { descargarCurriculum, quitarCurriculum, subirCurriculum } from '@/api/perfil'
import type { PerfilCompleto } from '@/api/tipos'
import { useAviso } from '@/ui/Avisos'
import { IconoDescargar, IconoDocumento, IconoPapelera, IconoSubir, IconoVisto } from '@/ui/Iconos'
import { anclaDe } from './Listas'
import estilos from './Lateral.module.css'

/** Los mismos formatos que acepta postular. Se comprueba aquí para no rebotar. */
const FORMATOS_CV = ['.pdf', '.doc', '.docx']
const MAXIMO_CV = 10 * 1024 * 1024

/**
 * En qué punto está una lista: vacía, con datos por revisar, o terminada.
 *
 * Son tres estados y no dos porque la pantalla tiene que decir cosas distintas:
 * a quien no tiene experiencia se le invita a añadirla; a quien la tiene sacada
 * del currículum y sin mirar, no — ya está escrita, lo que falta es decir si
 * está bien.
 */
function comoVa(filas: { origen: string; confirmado: boolean }[]): Punto {
  if (filas.length === 0) return 'vacio'
  return filas.some((f) => f.origen === 'CURRICULUM' && !f.confirmado) ? 'porRevisar' : 'listo'
}

type Punto = 'vacio' | 'porRevisar' | 'listo'

const siLoHay = (hay: boolean): Punto => (hay ? 'listo' : 'vacio')

/**
 * Lo que cuenta para el medidor, y **cuánto vale cada cosa**.
 *
 * Los pesos no son iguales a propósito: la experiencia es lo que de verdad se
 * lee de un perfil, y el currículum es lo que ahorra trabajo en cada
 * postulación. Los idiomas y las certificaciones suman poco porque hay oficios
 * enteros donde no aplican, y castigarlos por eso sería medir mal.
 *
 * ⚠️ **Un dato deducido del currículum y sin revisar NO cuenta como hecho.**
 * Antes solo se miraba si la lista tenía filas, y un perfil rellenado entero por
 * la lectura del CV marcaba **100 % en verde** mientras el panel violeta de dos
 * dedos más arriba decía «te quedan 6 datos por revisar»: dos cifras que no
 * podían ser las dos verdad, a doce centímetros. Y el verde es el color de lo
 * confirmado en todo el sistema, así que certificaba justo lo que la pantalla
 * decía que no estaba certificado.
 *
 * Ahora las dos cuentan lo mismo, y el 100 % pasa a ser el premio de haber
 * terminado de revisar — que es el trabajo que esta pantalla quiere que se haga.
 */
function partes(perfil: PerfilCompleto) {
  return [
    { que: 'tu currículum', punto: siLoHay(perfil.cv !== null), peso: 25 },
    { que: 'tu titular', punto: siLoHay(perfil.titular !== null), peso: 5 },
    { que: 'tu «Acerca de»', punto: siLoHay(perfil.resumen !== null), peso: 15 },
    { que: 'tu experiencia', punto: comoVa(perfil.experiencia), peso: 20 },
    { que: 'tu formación', punto: comoVa(perfil.educacion), peso: 10 },
    { que: 'lo que sabes hacer', punto: siLoHay(perfil.habilidades.length > 0), peso: 10 },
    { que: 'tus enlaces', punto: siLoHay(perfil.enlaces.length > 0), peso: 5 },
    { que: 'tus idiomas', punto: comoVa(perfil.idiomas), peso: 5 },
    // ⚠️ Faltaba, y por eso el medidor podía volver a decir «Está todo» con una
    // certificación sin revisar mientras el índice, treinta píxeles más abajo,
    // decía «Certificaciones · 1 por revisar». Las dos cuentas tienen que mirar
    // LAS MISMAS cuatro listas que `cuantosSinConfirmar` en `Perfil.tsx`.
    { que: 'tus certificaciones', punto: comoVa(perfil.certificaciones), peso: 5 },
  ]
}

/** Las dos que más suman, en palabras. */
function nombrar(partes: { que: string }[]): string {
  return partes.slice(0, 2).map((p) => p.que).join(' y ')
}

export function Lateral({ perfil }: { perfil: PerfilCompleto }) {
  return (
    <aside className={estilos.lateral}>
      <Completitud perfil={perfil} />
      <TuCurriculum perfil={perfil} />
      <Indice perfil={perfil} />
    </aside>
  )
}

/** Las secciones del perfil, en el orden en que se pintan. */
const SECCIONES = [
  { titulo: 'Acerca de ti', cuenta: [] },
  // Empleos, estudios y certificaciones comparten sección desde que hay una
  // sola cronología: el índice cuenta las tres juntas porque juntas se pintan.
  { titulo: 'Tu trayectoria', cuenta: ['experiencia', 'educacion', 'certificaciones'] },
  { titulo: 'Idiomas', cuenta: ['idiomas'] },
  { titulo: 'Enlaces', cuenta: ['enlaces'] },
] as const

/**
 * Dónde estás y qué te queda por delante.
 *
 * ⚠️ **Con nueve secciones y cuatro mil píxeles, no había forma de saltar ni de
 * saber cuánto quedaba.** Y la columna derecha se moría a un tercio: dos
 * tarjetas y luego canalón vacío hasta el pie.
 *
 * Cada sección dice **cuántas cosas tiene y cuántas esperan revisión**, así que
 * el índice no es solo navegación: es el resumen de dónde está el trabajo. La
 * que tiene algo por revisar se marca, con la palabra y no solo con el color.
 */
function Indice({ perfil }: { perfil: PerfilCompleto }) {
  const [aqui, setAqui] = useState<string | null>(null)

  useEffect(() => {
    const secciones = SECCIONES.map((s) => document.getElementById(anclaDe(s.titulo))).filter(
      (e): e is HTMLElement => e !== null,
    )
    if (secciones.length === 0) return

    /*
      ⚠️ **Se lleva la cuenta de TODAS, no solo de las que cambiaron.** El
      observador avisa únicamente de las que cruzan el borde, así que quedarse
      con la primera de esa tanda dejaba la marca en la sección que acababa de
      salir. Aquí se mantiene el conjunto de las que están dentro y se elige la
      primera en orden de página, que es la que se está leyendo.

      El margen de arriba descuenta la cabecera fija; el de abajo deja como zona
      activa solo la banda superior de la ventana. Sin él, con dos secciones
      cortas a la vez en pantalla, la marca bailaba al desplazar un píxel.
    */
    const dentro = new Set<string>()
    const enOrden = secciones.map((s) => s.id)
    const vigia = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) dentro.add(e.target.id)
          else dentro.delete(e.target.id)
        }
        const primera = enOrden.find((id) => dentro.has(id))
        // Sin ninguna dentro de la banda —entre dos secciones largas— se queda
        // la última marcada: apagarlo todo parpadea y no dice nada mejor.
        if (primera) setAqui(primera)
      },
      { rootMargin: '-88px 0px -60% 0px', threshold: 0 },
    )
    secciones.forEach((s) => vigia.observe(s))
    return () => vigia.disconnect()
  }, [])

  return (
    <nav className={estilos.bloqueIndice} aria-label="Secciones de tu perfil">
      <h2 className={estilos.titulo}>En esta página</h2>
      <ul className={estilos.indice}>
        {SECCIONES.map((s) => {
          const ancla = anclaDe(s.titulo)
          // El tipo se ensancha a propósito: aquí solo se cuentan filas y su
          // origen, que es lo único que las cinco listas tienen en común.
          const filas: { origen?: string; confirmado?: boolean }[] = s.cuenta.flatMap(
            (k) => perfil[k] as { origen?: string; confirmado?: boolean }[],
          )
          const sinConfirmar = filas.filter(
            (f) => f.origen === 'CURRICULUM' && !f.confirmado,
          ).length
          return (
            <li key={s.titulo}>
              <a
                href={`#${ancla}`}
                className={aqui === ancla ? estilos.aqui : undefined}
                /* La sección en la que estás, dicha y no solo pintada. */
                aria-current={aqui === ancla ? 'true' : undefined}
              >
                <span className={estilos.nombreSeccion}>{s.titulo}</span>
                {sinConfirmar > 0 ? (
                  <span className={estilos.porRevisar}>{sinConfirmar} por revisar</span>
                ) : filas.length > 0 ? (
                  <span className={estilos.cuantas}>{filas.length}</span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Completitud({ perfil }: { perfil: PerfilCompleto }) {
  const todas = partes(perfil)
  const total = todas.filter((p) => p.punto === 'listo').reduce((suma, p) => suma + p.peso, 0)
  const vacias = todas.filter((p) => p.punto === 'vacio')
  const porRevisar = todas.filter((p) => p.punto === 'porRevisar')
  const lleno = vacias.length === 0 && porRevisar.length === 0

  return (
    <section className={estilos.bloque}>
      <h2 className={estilos.titulo}>Tu perfil</h2>

      <p className={estilos.cifra}>
        {total}
        <span className={estilos.porciento}>%</span>
      </p>

      {/*
        La barra es decorativa: la cifra ya está escrita justo encima en texto, y
        un `progressbar` anunciado repetiría el mismo número con otras palabras.
      */}
      <div className={estilos.barra} aria-hidden="true">
        <span
          className={`${estilos.avance} ${lleno ? estilos.avanceLleno : ''}`}
          style={{ transform: `scaleX(${total / 100})` }}
        />
      </div>

      {lleno ? (
        <p className={estilos.textoConIcono}>
          <IconoVisto tamano={16} /> Está todo. Puedes cambiar lo que quieras cuando quieras.
        </p>
      ) : (
        <>
          {/*
            Revisar va primero, y con otro verbo. Lo que sacamos del currículum ya
            está escrito: pedir que lo «añada» sería mandarle a escribir algo que
            tiene delante. Se nombran las dos que más suman; una lista de seis
            pendientes no se lee, se ignora.
          */}
          {porRevisar.length > 0 && (
            <p className={estilos.texto}>
              Falta que revises <b>{nombrar(porRevisar)}</b>.
            </p>
          )}
          {vacias.length > 0 && (
            <p className={estilos.texto}>
              Puedes añadir {vacias.length === 1 ? '' : 'lo que falte, empezando por '}
              <b>{nombrar(vacias)}</b>.
            </p>
          )}
          <p className={estilos.pista}>Nada de esto es obligatorio para postular.</p>
        </>
      )}
    </section>
  )
}

function TuCurriculum({ perfil }: { perfil: PerfilCompleto }) {
  const cache = useQueryClient()
  const avisar = useAviso()
  const entrada = useRef<HTMLInputElement>(null)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)

  const subida = useMutation({
    mutationFn: subirCurriculum,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['perfil'] })
      avisar('Currículum guardado. Lo estamos leyendo para llenar tu perfil.')
    },
    onError: (causa) =>
      avisar(causa instanceof Error ? causa.message : 'No pudimos guardar tu currículum.'),
  })

  const quitada = useMutation({
    mutationFn: quitarCurriculum,
    onSuccess: async () => {
      setConfirmandoQuitar(false)
      await cache.invalidateQueries({ queryKey: ['perfil'] })
      avisar('Currículum quitado. Lo que ya está en tu perfil se queda.')
    },
    onError: (causa) =>
      avisar(causa instanceof Error ? causa.message : 'No pudimos quitarlo.'),
  })

  async function descargar() {
    try {
      const archivo = await descargarCurriculum()
      const url = URL.createObjectURL(archivo.contenido)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = archivo.nombre ?? 'mi-curriculum'
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'No pudimos preparar la descarga.')
    }
  }

  function elegir(archivo: File | undefined) {
    if (!archivo) return
    const extension = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase()
    if (!FORMATOS_CV.includes(extension)) {
      avisar(`«${archivo.name}» no es un PDF ni un Word. Conviértelo a PDF y vuelve a intentarlo.`)
      return
    }
    if (archivo.size > MAXIMO_CV) {
      avisar('El archivo no puede pesar más de 10 MB.')
      return
    }
    subida.mutate(archivo)
  }

  const ocupado = subida.isPending || quitada.isPending

  return (
    <section className={estilos.bloque}>
      <h2 className={estilos.titulo}>Tu currículum</h2>

      {perfil.cv ? (
        <>
          <div className={estilos.archivo}>
            <IconoDocumento tamano={20} />
            <div className={estilos.datosArchivo}>
              <p className={estilos.nombreArchivo} title={perfil.cv.nombre}>
                {perfil.cv.nombre}
              </p>
              <p className={estilos.pesoArchivo}>{pesoLegible(perfil.cv.tamano)}</p>
            </div>
          </div>

          <p className={estilos.pista}>
            Lo usaremos cuando postules, sin que tengas que volver a subirlo.
          </p>

          <div className={estilos.acciones}>
            <button
              type="button"
              className={estilos.accionMenor}
              onClick={() => void descargar()}
              disabled={ocupado}
            >
              <IconoDescargar tamano={16} /> Descargar
            </button>
            <button
              type="button"
              className={estilos.accionMenor}
              onClick={() => entrada.current?.click()}
              disabled={ocupado}
            >
              <IconoSubir tamano={16} /> Cambiar
            </button>
          </div>

          {/*
            Quitar el currículum sí pregunta, y los demás botones de esta pantalla
            no: el archivo no se puede deshacer desde aquí —hay que volver a
            tenerlo a mano— y sin él la siguiente postulación vuelve a pedirlo.
          */}
          {confirmandoQuitar ? (
            <div className={estilos.confirmar}>
              <p className={estilos.textoConfirmar}>
                ¿Quitarlo? Lo que ya está en tu perfil se queda; solo tendrás que subir uno al
                postular.
              </p>
              <div className={estilos.acciones}>
                <button
                  type="button"
                  className={estilos.accionMenor}
                  onClick={() => quitada.mutate()}
                  disabled={ocupado}
                >
                  Sí, quitarlo
                </button>
                <button
                  type="button"
                  className={estilos.accionMenor}
                  onClick={() => setConfirmandoQuitar(false)}
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={estilos.quitar}
              onClick={() => setConfirmandoQuitar(true)}
              disabled={ocupado}
            >
              <IconoPapelera tamano={16} /> Quitarlo
            </button>
          )}
        </>
      ) : (
        <>
          <p className={estilos.texto}>
            Guárdalo aquí y lo leeremos para llenar tu perfil. Después no tendrás que subirlo
            en cada vacante.
          </p>
          <button
            type="button"
            className={estilos.subir}
            onClick={() => entrada.current?.click()}
            disabled={ocupado}
          >
            <IconoSubir tamano={16} />
            {subida.isPending ? 'Subiendo…' : 'Subir mi currículum'}
          </button>
          <p className={estilos.pista}>PDF o Word, hasta 10 MB.</p>
        </>
      )}

      <input
        ref={entrada}
        className={estilos.entradaOculta}
        type="file"
        aria-label="Tu currículum"
        accept={FORMATOS_CV.join(',')}
        onChange={(e) => {
          elegir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </section>
  )
}

function pesoLegible(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
