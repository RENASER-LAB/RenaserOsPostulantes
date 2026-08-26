/**
 * El canto irisado: el material del que esta hecho el portal.
 *
 * Es una nube vista desde abajo, con la banda de color asomando por su borde.
 *
 * ⚠️ **Sin `feGaussianBlur` ni `feDisplacementMap`, y es a proposito.** La
 * primera version usaba turbulencia y desenfoque, y se veia pixelada en
 * cualquier pantalla de alta densidad: Chrome rasteriza un filtro SVG a
 * resolucion CSS y despues amplia el resultado a la del dispositivo, asi que a
 * 2x la banda salia con la mitad de resolucion que el texto de al lado. Se
 * comprobo midiendo: la misma zona capturada a 1x y a 2x no ganaba un solo
 * pixel de detalle. Si alguien vuelve a meter un filtro que cubra el ancho de
 * la pagina, el pixelado vuelve.
 *
 * Lo que hace la suavidad ahora es **geometria**: la misma curva trazada
 * muchas veces, de ancha y transparente a estrecha y opaca. Eso es vector, se
 * dibuja a la resolucion que tenga la pantalla, y no hay ningun mapa de bits
 * intermedio que ampliar. El unico filtro que queda es el grano, y vive dentro
 * de un azulejo de 160 px que se repite: su region es minuscula, y aunque se
 * rasterizara mal, es ruido — nadie puede notarlo.
 *
 * Va detras del contenido y no lleva texto encima: la prosa se lee sobre nube
 * blanca, nunca sobre el color. Es la regla que sostiene el mundo.
 */

import estilos from './Canto.module.css'

/**
 * Los bordes de nube.
 *
 * Seis tramos con ritmos distintos cada uno, a proposito: una sola curva
 * simetrica se lee como una onda dibujada, y un canto de nube no tiene periodo.
 *
 * Son dos y no uno porque dos pantallas con la misma nube se leen como la misma
 * pantalla. La semilla elige cual, asi que pedir otra semilla cambia el cielo de
 * verdad y no solo el ruido del grano.
 */
const BORDES = [
  'M -80 150 C 120 104, 232 132, 352 140 C 470 148, 560 150, 648 122 ' +
    'C 742 92, 812 44, 918 40 C 1010 36, 1074 70, 1156 88 ' +
    'C 1246 108, 1316 100, 1400 78 C 1470 60, 1510 60, 1540 66',
  'M -80 96 C 140 68, 268 116, 402 128 C 520 138, 612 118, 700 88 ' +
    'C 796 56, 884 78, 992 106 C 1092 132, 1186 150, 1288 132 ' +
    'C 1392 114, 1470 82, 1540 88',
]

/**
 * Un desenfoque hecho de trazos.
 *
 * Devuelve `n` capas entre los anchos `de` y `a`. Apiladas con una opacidad
 * baja, la suma da una caida suave desde el eje de la curva: cada capa aporta
 * su tanto donde llega, y donde no llega, nada.
 *
 * ⚠️ **El numero de capas no es un gusto, es la resolucion del degradado.** Con
 * veintidos capas el salto de ancho era de siete unidades —unos diez pixeles en
 * pantalla— y se veian como estrias concentricas. El salto tiene que quedarse
 * por debajo de dos unidades; de ahi salen estas cuentas.
 *
 * Cada capa se corre ademas en vertical, y el corrimiento se mide **contra el
 * paso**, no con un numero fijo. Sin corrimiento los bordes caen exactamente
 * concentricos y el ojo los une en lineas por poca opacidad que tengan; con un
 * corrimiento mas corto que el paso, tampoco se rompen. A cuatro quintos del
 * paso, ninguna capa cae donde caeria la siguiente.
 *
 * El 2,399 del zigzag es el angulo aureo en radianes: reparte los corrimientos
 * sin repetir un ciclo, que es justo lo que un `i % 3` no hace.
 */
function capas(n: number, de: number, a: number) {
  const paso = Math.abs(a - de) / (n - 1)
  return Array.from({ length: n }, (_, i) => ({
    ancho: de + ((a - de) * i) / (n - 1),
    dy: Math.sin(i * 2.399) * paso * 0.8,
  }))
}

/** El resplandor: la luz que se sale de la banda. */
const RESPLANDOR = capas(80, 178, 24)

/** El nucleo: donde las gotas tienen el mismo tamaño y el color es pleno. */
const NUCLEO = capas(18, 26, 10)

/** La pluma del cuerpo de la nube, que deshilacha su borde sobre el color. */
const PLUMA = capas(24, 120, 8)

interface Props {
  /** Elige el borde y siembra el grano. Otra semilla es otro cielo. */
  semilla?: number
  /**
   * Cuanta luz tiene el canto, de 0 a 1.
   *
   * No es un mando de gusto: es el estado del fenomeno. En «Mis procesos» la
   * banda esta **formada** —hay un proceso en marcha y el candidato lo esta
   * viviendo— y va al maximo. En la portada todavia no ha empezado nada, asi
   * que la banda esta **formandose**: la misma luz, mas floja y mas repartida.
   */
  intensidad?: number
}

export function Canto({ semilla = 12, intensidad = 1 }: Props) {
  const espectro = `espectro-${semilla}`
  const granoFiltro = `grano-filtro-${semilla}`
  const granoAzulejo = `grano-azulejo-${semilla}`
  const borde = BORDES[semilla % BORDES.length]
  const cuerpo = `${borde} L 1540 -140 L -80 -140 Z`
  const luz = (base: number) => (base * intensidad).toFixed(4)

  return (
    <div className={estilos.canto} aria-hidden="true">
      <svg
        className={estilos.cielo}
        viewBox="0 0 1440 320"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id={espectro} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#16a184" />
            <stop offset="18%" stopColor="#2c96b0" />
            <stop offset="34%" stopColor="#4f8ac9" />
            <stop offset="51%" stopColor="#9068a6" />
            <stop offset="68%" stopColor="#d2497e" />
            <stop offset="84%" stopColor="#a04ab0" />
            <stop offset="100%" stopColor="#6b4be0" />
          </linearGradient>

          {/*
            El grano, en un azulejo pequeño y repetido.
            Rompe las franjas de valor constante que deja cualquier degradado
            grande sobre ocho bits por canal. Es el unico filtro que queda, y su
            region mide 160 px: no le afecta el problema de resolucion que echo
            fuera a los otros tres.
          */}
          <filter
            id={granoFiltro}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed={semilla} />
            <feColorMatrix type="saturate" values="0" />
          </filter>

          <pattern id={granoAzulejo} width="160" height="160" patternUnits="userSpaceOnUse">
            <rect width="160" height="160" filter={`url(#${granoFiltro})`} />
          </pattern>
        </defs>

        <g fill="none" stroke={`url(#${espectro})`} strokeLinecap="round">
          {RESPLANDOR.map(({ ancho, dy }, i) => (
            <path
              key={`r${i}`}
              d={borde}
              strokeWidth={ancho}
              opacity={luz(0.013)}
              transform={`translate(0 ${dy.toFixed(2)})`}
            />
          ))}
          {NUCLEO.map(({ ancho, dy }, i) => (
            <path
              key={`n${i}`}
              d={borde}
              strokeWidth={ancho}
              opacity={luz(0.13)}
              transform={`translate(0 ${dy.toFixed(2)})`}
            />
          ))}
        </g>

        {/*
          El cuerpo de la nube, encima. Tapa la mitad superior de la banda, y su
          pluma hace que el color asome desflecado en vez de cortado a cuchillo.
        */}
        <path d={cuerpo} fill="#ffffff" />
        <g fill="none" stroke="#ffffff" strokeLinecap="round">
          {PLUMA.map(({ ancho, dy }, i) => (
            <path
              key={`p${i}`}
              d={borde}
              strokeWidth={ancho}
              opacity="0.03"
              transform={`translate(0 ${dy.toFixed(2)})`}
            />
          ))}
        </g>

        <rect className={estilos.grano} width="1440" height="320" fill={`url(#${granoAzulejo})`} />
      </svg>
    </div>
  )
}
