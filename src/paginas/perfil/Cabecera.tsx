/**
 * La cabecera de identidad del perfil: la portada, la foto y quién eres.
 *
 * Es la pieza que hace que la pantalla deje de leerse como un formulario. Antes
 * de esto, «Mi perfil» eran ocho cajas de texto apiladas y nada que dijera
 * «este soy yo».
 *
 * ⚠️ **La portada no lleva texto encima, y no es un detalle de gusto.** La regla
 * del mundo dice que el color vive en el canto y el campo donde se lee se queda
 * en nube; el nombre va DEBAJO, sobre blanco. Una portada con el nombre encima
 * —como la de LinkedIn— rompe eso y de paso el contraste, porque el texto tendría
 * que sobrevivir a cualquier imagen que suba cualquiera.
 *
 * ⚠️ **Sin foto no queda un hueco.** Un disco con las iniciales sobre un tono del
 * espectro. Un contorno vacío diría «te falta algo» en una pantalla donde nada es
 * obligatorio.
 *
 * ⚠️ **Nada de aquí es violeta.** El acento significa «te toca a ti» y en esta
 * pantalla lo tiene el panel de datos por revisar. Un botón «Editar perfil» en
 * violeta le quitaría el significado a los seis sitios donde de verdad importa.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  elegirPortada,
  PORTADAS_DE_LA_CASA,
  quitarFoto,
  quitarPortada,
  subirFoto,
  subirPortada,
  urlDeLaFoto,
  urlDeLaPortada,
} from '@/api/perfil'
import type { PerfilCompleto } from '@/api/tipos'
import { useSesion } from '@/app/Sesion'
import { useAviso } from '@/ui/Avisos'
import { IconoCamara, IconoDeEnlace, IconoLapiz, IconoReloj, IconoUbicacion } from '@/ui/Iconos'
import { aniosYMeses } from './textos'
import estilos from './Cabecera.module.css'

/**
 * Lo que se sube: cuadrada y de 512 px.
 *
 * Se recorta y se recomprime en el navegador antes de mandarla. Tres motivos, y
 * el tercero es el que no se ve: se ahorra subir dos megas para pintar un disco
 * de 96 px, el backend recibe siempre lo mismo, y **el redibujado tira los
 * metadatos EXIF** — que en una foto de teléfono llevan el sitio exacto donde se
 * tomó.
 */
const LADO_FOTO = 512

/**
 * La portada, redibujada como la foto y por el mismo motivo.
 *
 * ⚠️ **Es la que MÁS falta hace.** Una foto de perfil suele ser un retrato ya
 * recortado; una portada es un paisaje o un sitio, que es justo el archivo con
 * más probabilidad de llevar las coordenadas GPS dentro. El redibujado en el
 * lienzo las tira, igual que en la foto — la regla estaba escrita ahí al lado y
 * no se le había aplicado.
 *
 * 4:1 porque la banda se pinta a 168px de alto en un carril de 68rem, y esto la
 * cubre en pantallas de mucha densidad sin subir el archivo entero por datos.
 */
const PORTADA = { ancho: 1600, alto: 400 }

/**
 * Una portada hecha con los colores de tu propia foto.
 *
 * ⚠️ **Se aclaran hacia el cielo del portal, y no es un capricho.** Los colores
 * crudos de una fotografía —una pared, una camisa, el cielo de ese día— dan una
 * banda dura que no se parece a nada del resto del portal, y encima compiten con
 * el nombre que va justo debajo. Mezclados al 55% con `--cielo` quedan como los
 * cinco fondos de la casa: un lavado suave del que la persona reconoce el tono.
 *
 * Se muestrea en 16×16 porque no hace falta más: lo que se busca es de qué color
 * es la foto, no qué hay en ella. Se cogen el píxel más oscuro y el más claro
 * —los dos extremos dan un degradado con recorrido, promediar da barro— y se
 * salta lo casi transparente.
 */
async function portadaConLosColoresDe(url: string): Promise<File> {
  const imagen = await createImageBitmap(await (await fetch(url)).blob())
  const muestra = document.createElement('canvas')
  muestra.width = 16
  muestra.height = 16
  const ojo = muestra.getContext('2d', { willReadFrequently: true })
  if (!ojo) throw new Error('Tu navegador no pudo leer los colores de la foto.')
  ojo.drawImage(imagen, 0, 0, 16, 16)
  imagen.close()

  const pixeles = ojo.getImageData(0, 0, 16, 16).data
  let oscuro = [0, 0, 0]
  let claro = [255, 255, 255]
  let menor = Infinity
  let mayor = -Infinity
  for (let i = 0; i < pixeles.length; i += 4) {
    if (pixeles[i + 3]! < 128) continue
    const rgb = [pixeles[i]!, pixeles[i + 1]!, pixeles[i + 2]!]
    const luz = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!
    if (luz < menor) {
      menor = luz
      oscuro = rgb
    }
    if (luz > mayor) {
      mayor = luz
      claro = rgb
    }
  }

  // El cielo del portal, para aclarar hacia él.
  const cielo = [246, 248, 251]
  const suave = (c: number[]) =>
    `rgb(${c.map((v, i) => Math.round(v * 0.45 + cielo[i]! * 0.55)).join(',')})`

  const lienzo = document.createElement('canvas')
  lienzo.width = PORTADA.ancho
  lienzo.height = PORTADA.alto
  const pincel = lienzo.getContext('2d')
  if (!pincel) throw new Error('Tu navegador no pudo preparar la portada.')
  const degradado = pincel.createLinearGradient(0, PORTADA.alto, PORTADA.ancho, 0)
  degradado.addColorStop(0, suave(oscuro))
  degradado.addColorStop(1, suave(claro))
  pincel.fillStyle = degradado
  pincel.fillRect(0, 0, PORTADA.ancho, PORTADA.alto)

  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) =>
        blob
          ? resolver(new File([blob], 'portada.jpg', { type: 'image/jpeg' }))
          : rechazar(new Error('No pudimos preparar la portada.')),
      'image/jpeg',
      0.85,
    ),
  )
}

/** El tope del backend. Se comprueba aquí para no subir y rebotar. */
const MAXIMO_IMAGEN = 2 * 1024 * 1024

const FORMATOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Recorta al centro y devuelve un JPEG.
 *
 * El recorte es automático y no se puede mover: arrastrar y hacer zoom sobre la
 * foto es otra pantalla —gesto táctil, orientación, límites— y lo que devuelve
 * no compensa. Al centro acierta con casi cualquier foto de perfil.
 */
async function recortarAlCentro(archivo: File, ancho: number, alto: number): Promise<Blob> {
  const imagen = await createImageBitmap(archivo)
  // El trozo más grande de la imagen que tiene la proporción pedida, centrado.
  const proporcion = ancho / alto
  const recorteAncho = Math.min(imagen.width, imagen.height * proporcion)
  const recorteAlto = Math.min(imagen.height, imagen.width / proporcion)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const pincel = lienzo.getContext('2d')
  if (!pincel) throw new Error('Tu navegador no pudo preparar la imagen.')
  pincel.drawImage(
    imagen,
    (imagen.width - recorteAncho) / 2,
    (imagen.height - recorteAlto) / 2,
    recorteAncho,
    recorteAlto,
    0,
    0,
    ancho,
    alto,
  )
  imagen.close()
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No pudimos preparar la imagen.'))),
      'image/jpeg',
      0.85,
    ),
  )
}

/** Las iniciales de quien no tiene foto. Vacío devuelve vacío, no una interrogación. */
function inicialesDe(nombre: string | null, apellidos: string | null): string {
  const partes = [nombre, apellidos]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
  return partes.slice(0, 2).join('')
}

/**
 * El tono del disco, **derivado de la portada que la persona eligió**.
 *
 * ⚠️ **Antes salía de un hash del nombre, y eran dos identidades sueltas.** La
 * cabecera tenía una portada elegida a propósito y, al lado, un disco de 128px
 * de un color que nadie había decidido: la mitad de la composición era un
 * sorteo. Ahora el disco y la banda son la misma decisión.
 *
 * El violeta vuelve a ser posible aquí, y no contradice la regla del acento: lo
 * que la rompía era **imponérselo** a uno de cada cuatro candidatos. Elegir la
 * portada violeta es un acto deliberado, y el disco acompaña a lo que eligió.
 *
 * Sin portada de galería —la de bruma, una foto propia, o ninguna— no hay nada
 * que seguir, y ahí sí decide el nombre: ver `tonoDelNombre`.
 */
function tonoDeLaPortada(portada: PerfilCompleto['portada'], nombre: string): string {
  if (portada.tipo === 'GALERIA' && portada.codigo?.startsWith('CANTO_')) {
    return portada.codigo.slice('CANTO_'.length).toLowerCase();
  }
  return tonoDelNombre(nombre);
}

/**
 * El tono del disco, derivado del nombre.
 *
 * Del espectro del canto, y **siempre el mismo para la misma persona**: si
 * cambiara entre visitas dejaría de ser suyo. No significa nada —no es un
 * estado— y por eso puede ser cualquiera de los cuatro.
 */
function tonoDelNombre(texto: string): string {
  /*
    ⚠️ **Sin violeta, y es la regla del acento.** El violeta significa una sola
    cosa en este portal: «te toca a ti». Repartiendo los cuatro tonos por el
    hash del nombre, **uno de cada cuatro candidatos** abría su perfil con un
    disco violeta de 128px que no eligió, y al lado el panel que de verdad le
    reclamaba algo quedaba como el violeta más pálido de la pantalla. El acento
    no puede salir de un sorteo.

    En la galería de portadas sí sigue: ahí lo elige la persona a propósito, y
    una banda de fondo no compite con un panel a la misma escala.
  */
  const tonos = ['menta', 'aqua', 'rosa']
  let suma = 0
  for (const letra of texto) suma += letra.codePointAt(0) ?? 0
  return tonos[suma % tonos.length]!
}

/**
 * Un menú flotante que se cierra como cualquiera espera que se cierre.
 *
 * ⚠️ **Los tres cierres hacen falta, y ninguno venía de serie.** Sin Escape, un
 * panel abierto no se puede cerrar con teclado más que acertando otra vez con su
 * propio botón. Sin el toque fuera —el primer gesto que prueba cualquiera en un
 * teléfono, donde el panel tapa media cabecera— la pantalla parece colgada. Y
 * sin devolver el foco al disparador, quien navega con teclado se queda mirando
 * un panel que ya no está.
 *
 * El cierre viaja por una referencia para que el efecto dependa solo de si está
 * abierto: pasado como dependencia, una función escrita en línea vuelve a
 * suscribir los dos escuchas en cada repintado.
 */
function useMenuFlotante(abierto: boolean, cerrar: () => void) {
  const caja = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const cerrarAhora = useRef(cerrar)
  cerrarAhora.current = cerrar

  useEffect(() => {
    if (!abierto) return
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      cerrarAhora.current()
      disparador.current?.focus()
    }
    function alPulsarFuera(evento: PointerEvent) {
      const donde = evento.target as Node
      if (caja.current?.contains(donde) || disparador.current?.contains(donde)) return
      cerrarAhora.current()
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alPulsarFuera)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alPulsarFuera)
    }
  }, [abierto])

  return { caja, disparador }
}

export function CabeceraDelPerfil({
  perfil,
  onEditar,
}: {
  perfil: PerfilCompleto
  onEditar: () => void
}) {
  const { nombre, apellidos } = useSesion()
  const nombreCompleto = [nombre, apellidos].filter(Boolean).join(' ').trim()
  /*
    Uno o ninguno, nunca los dos. Con un booleano por menú se podían abrir los
    dos a la vez y entre los dos paneles tapaban el nombre, las señas y los
    enlaces — justo la información que la cabecera existe para enseñar.
  */
  const [menu, setMenu] = useState<'foto' | 'portada' | null>(null)
  const iniciales = inicialesDe(nombre, apellidos)

  return (
    <header className={estilos.cabecera}>
      <Portada
        perfil={perfil}
        abierto={menu === 'portada'}
        onAlternar={() => setMenu((m) => (m === 'portada' ? null : 'portada'))}
        onCerrar={() => setMenu(null)}
      />

      <div className={estilos.identidad}>
        <Foto
          tieneFoto={perfil.tieneFoto}
          iniciales={iniciales}
          tono={tonoDeLaPortada(perfil.portada, nombreCompleto || 'EX')}
          abierto={menu === 'foto'}
          onAlternar={() => setMenu((m) => (m === 'foto' ? null : 'foto'))}
          onCerrar={() => setMenu(null)}
        />

        <div className={estilos.datos}>
          <div className={estilos.nombreYAccion}>
            <h1 className={estilos.nombre}>
              {/*
                Sin nombre no se inventa uno ni se deja el hueco: se dice qué
                pantalla es. Puede pasar de verdad —quien entra por el enlace del
                correo antes de que el backend devolviera el nombre— y un `<h1>`
                vacío deja la pantalla sin encabezado para un lector de pantalla.
              */}
              {nombreCompleto || 'Tu perfil'}
            </h1>
            <button type="button" className={estilos.editar} onClick={onEditar}>
              <IconoLapiz tamano={16} />
              Editar perfil
            </button>
          </div>

          {perfil.titular && <p className={estilos.titular}>{perfil.titular}</p>}

          <ul className={estilos.senas}>
            {perfil.ubicacion && (
              <li>
                <IconoUbicacion tamano={16} />
                {perfil.ubicacion}
              </li>
            )}
            {perfil.experienciaMeses !== null && perfil.experienciaMeses > 0 && (
              <li>
                <IconoReloj tamano={16} />
                {aniosYMeses(perfil.experienciaMeses)}
              </li>
            )}
            {perfil.disponibilidad && (
              <li>
                <span className={estilos.punto} aria-hidden="true" />
                {perfil.disponibilidad}
              </li>
            )}
          </ul>

          {perfil.enlaces.length > 0 && (
            <ul className={estilos.enlaces}>
              {perfil.enlaces.map((enlace) => (
                <li key={enlace.id}>
                  <a href={enlace.url} target="_blank" rel="noreferrer noopener">
                    <IconoDeEnlace tipo={enlace.tipo} tamano={16} />
                    {nombreDelTipo(enlace.tipo)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  )
}

function nombreDelTipo(tipo: string): string {
  const nombres: Record<string, string> = {
    LINKEDIN: 'LinkedIn',
    GITHUB: 'GitHub',
    PORTAFOLIO: 'Portafolio',
    PUBLICACION: 'Publicación',
    PRODUCTO: 'Producto',
    OTRO: 'Enlace',
  }
  return nombres[tipo] ?? 'Enlace'
}

// ---------- La foto ----------

function Foto({
  tieneFoto,
  iniciales,
  tono,
  abierto,
  onAlternar,
  onCerrar,
}: {
  tieneFoto: boolean
  iniciales: string
  tono: string
  abierto: boolean
  onAlternar: () => void
  onCerrar: () => void
}) {
  const cache = useQueryClient()
  const avisar = useAviso()
  const entrada = useRef<HTMLInputElement>(null)
  const { caja, disparador } = useMenuFlotante(abierto, onCerrar)

  // La imagen se baja como blob porque un `<img src>` no manda el token. La url
  // se revoca al cambiar o al desmontar: sin eso, cada refresco deja un blob
  // colgado en memoria — y esta pantalla se refresca sola mientras se lee el CV.
  const foto = useQuery({
    queryKey: ['perfil-foto'],
    queryFn: urlDeLaFoto,
    enabled: tieneFoto,
    staleTime: Infinity,
  })

  useEffect(() => {
    const url = foto.data
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [foto.data])

  const subida = useMutation({
    mutationFn: async (archivo: File) => {
      const cuadrada = await recortarAlCentro(archivo, LADO_FOTO, LADO_FOTO)
      await subirFoto(new File([cuadrada], 'foto.jpg', { type: 'image/jpeg' }))
    },
    onSuccess: async () => {
      onCerrar()
      await cache.invalidateQueries({ queryKey: ['perfil'] })
      await cache.invalidateQueries({ queryKey: ['perfil-foto'] })
      avisar('Foto actualizada.')
    },
    onError: (causa) =>
      avisar(causa instanceof Error ? causa.message : 'No pudimos guardar tu foto.'),
  })

  const quitada = useMutation({
    mutationFn: quitarFoto,
    onSuccess: async () => {
      onCerrar()
      await cache.invalidateQueries({ queryKey: ['perfil'] })
      await cache.invalidateQueries({ queryKey: ['perfil-foto'] })
      avisar('Foto quitada.')
    },
    onError: (causa) =>
      avisar(causa instanceof Error ? causa.message : 'No pudimos quitar tu foto.'),
  })

  function elegir(archivo: File | undefined) {
    if (!archivo) return
    if (!FORMATOS_IMAGEN.includes(archivo.type)) {
      avisar('La foto tiene que ser JPG, PNG o WebP.')
      return
    }
    if (archivo.size > MAXIMO_IMAGEN) {
      avisar('La foto no puede pesar más de 2 MB. Prueba a guardarla más pequeña.')
      return
    }
    subida.mutate(archivo)
  }

  const ocupado = subida.isPending || quitada.isPending

  return (
    <div className={estilos.zonaFoto}>
      <div className={`${estilos.disco} ${estilos[`tono-${tono}`]}`}>
        {tieneFoto && foto.data ? (
          <img className={estilos.imagen} src={foto.data} alt="Tu foto de perfil" />
        ) : (
          /*
            Las iniciales no son texto que alguien tenga que leer: el nombre está
            justo al lado, en el `<h1>`. Anunciarlas otra vez sería repetirlo
            deletreado.
          */
          <span className={estilos.iniciales} aria-hidden="true">
            {iniciales}
          </span>
        )}
      </div>

      <button
        type="button"
        className={estilos.botonFoto}
        ref={disparador}
        onClick={onAlternar}
        disabled={ocupado}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-controls="menu-de-la-foto"
      >
        <IconoCamara tamano={16} />
        <span className={estilos.soloLectores}>
          {tieneFoto ? 'Cambiar tu foto de perfil' : 'Añadir una foto de perfil'}
        </span>
      </button>

      {abierto && (
        <div ref={caja} id="menu-de-la-foto" className={estilos.menuFoto} role="group"
             aria-label="Tu foto">
          <button
            type="button"
            className={estilos.accionFoto}
            onClick={() => entrada.current?.click()}
            disabled={ocupado}
          >
            {tieneFoto ? 'Cambiar la foto' : 'Subir una foto'}
          </button>
          {tieneFoto && (
            <button
              type="button"
              className={estilos.accionFoto}
              onClick={() => quitada.mutate()}
              disabled={ocupado}
            >
              Quitar la foto
            </button>
          )}
          <p className={estilos.pistaFoto}>
            JPG, PNG o WebP, hasta 2 MB. Solo la ves tú: no se envía a las empresas.
          </p>
        </div>
      )}

      <input
        ref={entrada}
        className={estilos.entradaOculta}
        type="file"
        aria-label="Tu foto de perfil"
        accept={FORMATOS_IMAGEN.join(',')}
        onChange={(e) => {
          elegir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ---------- La portada ----------

function Portada({
  perfil,
  abierto,
  onAlternar,
  onCerrar,
}: {
  perfil: PerfilCompleto
  abierto: boolean
  onAlternar: () => void
  onCerrar: () => void
}) {
  const cache = useQueryClient()
  const avisar = useAviso()
  const entrada = useRef<HTMLInputElement>(null)
  const { caja, disparador } = useMenuFlotante(abierto, onCerrar)

  const propia = useQuery({
    queryKey: ['perfil-portada'],
    queryFn: urlDeLaPortada,
    enabled: perfil.portada.tipo === 'PROPIA',
    staleTime: Infinity,
  })

  useEffect(() => {
    const url = propia.data
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [propia.data])

  async function refrescar(mensaje: string) {
    onCerrar()
    await cache.invalidateQueries({ queryKey: ['perfil'] })
    await cache.invalidateQueries({ queryKey: ['perfil-portada'] })
    avisar(mensaje)
  }

  const cambio = useMutation({
    mutationFn: async (
      accion:
        | { tipo: 'galeria'; codigo: string }
        | { tipo: 'propia'; archivo: File }
        | { tipo: 'deLaFoto' }
        | { tipo: 'ninguna' },
    ) => {
      if (accion.tipo === 'galeria') return elegirPortada(accion.codigo)
      if (accion.tipo === 'ninguna') return quitarPortada()
      if (accion.tipo === 'deLaFoto') {
        const url = await urlDeLaFoto()
        try {
          return await subirPortada(await portadaConLosColoresDe(url))
        } finally {
          // La url del blob se suelta pase lo que pase: si no, cada intento deja
          // uno colgado en memoria de una pantalla que se refresca sola.
          URL.revokeObjectURL(url)
        }
      }
      const banda = await recortarAlCentro(accion.archivo, PORTADA.ancho, PORTADA.alto)
      return subirPortada(new File([banda], 'portada.jpg', { type: 'image/jpeg' }))
    },
    onSuccess: () => refrescar('Portada actualizada.'),
    onError: (causa) =>
      avisar(causa instanceof Error ? causa.message : 'No pudimos cambiar tu portada.'),
  })

  // Sin portada elegida, la de la casa por defecto. La pantalla nunca sale con un
  // hueco gris arriba: eso se lee como que algo no cargó.
  const codigo = perfil.portada.tipo === 'GALERIA' ? perfil.portada.codigo : 'BRUMA'
  const esPropia = perfil.portada.tipo === 'PROPIA' && propia.data

  return (
    <div className={estilos.zonaPortada}>
      <div
        className={`${estilos.portada} ${esPropia ? '' : estilos[`portada-${codigo}`]}`}
        style={esPropia ? { backgroundImage: `url(${propia.data})` } : undefined}
        /*
          Decorativa de verdad: no dice nada del candidato ni de su proceso, y
          describirla («banda de color verde azulado») solo alargaría el camino
          hasta el nombre para quien navega con lector de pantalla.
        */
        aria-hidden="true"
      />

      <button
        type="button"
        ref={disparador}
        className={estilos.botonPortada}
        onClick={onAlternar}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-controls="menu-de-la-portada"
      >
        <IconoCamara tamano={16} />
        Portada
      </button>

      {abierto && (
        <div ref={caja} id="menu-de-la-portada" className={estilos.menuPortada}>
          <p className={estilos.tituloMenu}>Elige un fondo</p>
          <ul className={estilos.galeria}>
            {PORTADAS_DE_LA_CASA.map((opcion) => {
              const elegida = perfil.portada.tipo === 'GALERIA' && perfil.portada.codigo === opcion.codigo
              return (
                <li key={opcion.codigo}>
                  <button
                    type="button"
                    className={`${estilos.muestra} ${estilos[`portada-${opcion.codigo}`]} ${
                      elegida ? estilos.muestraElegida : ''
                    }`}
                    onClick={() => cambio.mutate({ tipo: 'galeria', codigo: opcion.codigo })}
                    aria-pressed={elegida}
                  >
                    <span className={estilos.soloLectores}>{opcion.nombre}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className={estilos.accionesPortada}>
            {/*
              Solo con foto: sin ella no hay colores de los que sacarla, y un
              botón que no puede hacer nada es peor que no estar.
            */}
            {perfil.tieneFoto && (
              <button
                type="button"
                className={estilos.accionMenor}
                onClick={() => cambio.mutate({ tipo: 'deLaFoto' })}
                disabled={cambio.isPending}
              >
                Los colores de mi foto
              </button>
            )}
            <button
              type="button"
              className={estilos.accionMenor}
              onClick={() => entrada.current?.click()}
            >
              Subir la mía
            </button>
            {perfil.portada.tipo !== 'NINGUNA' && (
              <button
                type="button"
                className={estilos.accionMenor}
                onClick={() => cambio.mutate({ tipo: 'ninguna' })}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={entrada}
        className={estilos.entradaOculta}
        type="file"
        aria-label="La portada de tu perfil"
        accept={FORMATOS_IMAGEN.join(',')}
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (!archivo) return
          if (!FORMATOS_IMAGEN.includes(archivo.type)) {
            avisar('La portada tiene que ser JPG, PNG o WebP.')
            return
          }
          if (archivo.size > MAXIMO_IMAGEN) {
            avisar('La portada no puede pesar más de 2 MB.')
            return
          }
          cambio.mutate({ tipo: 'propia', archivo })
        }}
      />
    </div>
  )
}
