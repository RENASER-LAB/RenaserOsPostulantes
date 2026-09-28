#!/usr/bin/env python3
"""
Los derivados del logotipo de EX: el favicon, los iconos de Android y las
pantallas de arranque.

    python3 herramientas/derivados-del-logotipo.py

Parte SIEMPRE de `src/ui/logotipo.png`, el archivo que entrego el usuario tal
cual (808 x 714, negro puro sobre transparente, sin margen). Si el logotipo
vuelve a cambiar, se sustituye ese archivo y se corre esto otra vez: nada de lo
que escribe se retoca a mano.

Escribe:

- `public/favicon.png`: 64 x 64, el logotipo en tinta sobre un cuadrado claro
  de esquinas redondeadas, para que se vea tambien en una barra de pestañas
  oscura.
- Los iconos del lanzador de Android en las cinco densidades: el clasico
  (`ic_launcher.png`), el redondo (`ic_launcher_round.png`) y la figura del
  adaptativo (`ic_launcher_foreground.png`). El fondo del adaptativo es el
  color `ic_launcher_background` (#F6F8FB) y no se toca.
- `android/icono-play-512.png`, el de la ficha de Play.
- Las once `splash.png` de la pantalla de arranque, sobre `--cielo`.

Como en el PR #18, se pinta a varios aumentos y se reduce: el circulo del
redondo y las esquinas del favicon salen de Pillow sin suavizar, y es la
reduccion la que les da el antialiasing.

⚠️ **Se ejecuta como script, nunca como modulo importado**: importarlo dejaria
un `__pycache__` en el arbol de trabajo. Necesita Pillow.

⚠️ **El adaptativo tiene que caber en el circulo central de 66 dp** del lienzo
de 108: cada fabricante recorta con su forma y lo que se sale desaparece en
algun telefono. Lo primero que se corta son las esquinas —la «E» y la antena—,
asi que el tamaño se calcula con el punto del dibujo mas lejano al centro, no
con su caja. El script lo comprueba al final y se para si no se cumple.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'src' / 'ui' / 'logotipo.png'
RECURSOS = RAIZ / 'android' / 'app' / 'src' / 'main' / 'res'

# Las medidas que la spec da por buenas. Si el archivo no las tiene, no es el
# logotipo que se espera y no se genera nada.
MEDIDAS_DEL_ORIGEN = (808, 714)

TINTA = (0x10, 0x18, 0x28)  # --tinta
BRUMA = (0xF6, 0xF8, 0xFB)  # ic_launcher_background, el fondo del icono
CIELO = (0xF9, 0xFA, 0xFB)  # --cielo, el color con el que el telefono pinta su barra

AUMENTO = 8
# Un lienzo de 1920 a 8 aumentos pasa de 15 000 px de lado. Por encima de este
# lado se baja el aumento: la esquina que suavizar ahi es la del logotipo, que
# ya llega suavizado del remuestreo.
LADO_MAXIMO_AUMENTADO = 4096

DENSIDADES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

# Las proporciones del PR #18: en el clasico y el redondo el dibujo ocupa el
# 66 % del lado por su dimension mayor; en el de Play, el 62 %.
PROPORCION_CLASICO = 0.66
PROPORCION_PLAY = 0.62

# El adaptativo: lienzo de 108 dp, circulo seguro de 66 dp. Se deja 1 dp de
# holgura para que el suavizado del borde tampoco se salga.
LIENZO_ADAPTATIVO_DP = 108
RADIO_SEGURO_DP = 66 / 2
RADIO_OBJETIVO_DP = RADIO_SEGURO_DP - 1

FAVICON_LADO = 64
FAVICON_RADIO = 14
FAVICON_PROPORCION = 0.80

# El arranque: el logotipo mide como mucho un tercio del lado corto. Se queda
# algo por debajo para que respire.
PROPORCION_ARRANQUE = 0.30

# Las once pantallas de arranque de la plantilla de Capacitor, con sus medidas.
ARRANQUES = {
    'drawable': (480, 320),
    'drawable-land-mdpi': (480, 320),
    'drawable-land-hdpi': (800, 480),
    'drawable-land-xhdpi': (1280, 720),
    'drawable-land-xxhdpi': (1600, 960),
    'drawable-land-xxxhdpi': (1920, 1280),
    'drawable-port-mdpi': (320, 480),
    'drawable-port-hdpi': (480, 800),
    'drawable-port-xhdpi': (720, 1280),
    'drawable-port-xxhdpi': (960, 1600),
    'drawable-port-xxxhdpi': (1280, 1920),
}


def cargar_origen() -> Image.Image:
    """La forma del logotipo: su canal alfa. El color del archivo se ignora."""
    if not ORIGEN.exists():
        sys.exit(f'No existe {ORIGEN.relative_to(RAIZ)}: copia ahi el logotipo original.')
    imagen = Image.open(ORIGEN)
    if imagen.size != MEDIDAS_DEL_ORIGEN:
        sys.exit(
            f'{ORIGEN.relative_to(RAIZ)} mide {imagen.size} y se esperaba {MEDIDAS_DEL_ORIGEN}: '
            'si el logotipo cambio de verdad, revisa tambien la proporcion de `Marca`.'
        )
    return imagen.convert('RGBA').getchannel('A')


def radio_del_dibujo(forma: Image.Image) -> float:
    """
    La distancia, en pixeles del origen, del centro de la caja al punto pintado
    mas lejano. Es lo que decide si el dibujo cabe en un circulo.
    """
    ancho, alto = forma.size
    cx, cy = ancho / 2, alto / 2
    mayor = 0.0
    for indice, valor in enumerate(forma.tobytes()):
        if valor == 0:
            continue
        y, x = divmod(indice, ancho)
        # La esquina del pixel mas alejada del centro, no su centro.
        dx = max(abs(x - cx), abs(x + 1 - cx))
        dy = max(abs(y - cy), abs(y + 1 - cy))
        mayor = max(mayor, math.hypot(dx, dy))
    return mayor


def aumento_para(ancho: int, alto: int) -> int:
    return max(1, min(AUMENTO, LADO_MAXIMO_AUMENTADO // max(ancho, alto)))


def logotipo_aumentado(forma: Image.Image, lienzo: tuple[int, int], ancho_logo: float, aumento: int) -> Image.Image:
    """El logotipo centrado en un lienzo `aumento` veces mayor, como mascara."""
    ancho_origen, alto_origen = forma.size
    ancho = max(1, round(ancho_logo * aumento))
    alto = max(1, round(ancho_logo * alto_origen / ancho_origen * aumento))
    lw, lh = lienzo[0] * aumento, lienzo[1] * aumento
    mascara = Image.new('L', (lw, lh), 0)
    mascara.paste(forma.resize((ancho, alto), Image.Resampling.LANCZOS), ((lw - ancho) // 2, (lh - alto) // 2))
    return mascara


def fondo_aumentado(tipo: str | None, lienzo: tuple[int, int], aumento: int) -> Image.Image | None:
    if tipo is None:
        return None
    lw, lh = lienzo[0] * aumento, lienzo[1] * aumento
    if tipo == 'cuadrado':
        return Image.new('L', (lw, lh), 255)
    mascara = Image.new('L', (lw, lh), 0)
    dibujo = ImageDraw.Draw(mascara)
    if tipo == 'circulo':
        dibujo.ellipse((0, 0, lw - 1, lh - 1), fill=255)
    elif tipo == 'redondeado':
        dibujo.rounded_rectangle((0, 0, lw - 1, lh - 1), radius=FAVICON_RADIO * aumento, fill=255)
    else:
        raise ValueError(tipo)
    return mascara


def fuera_del_circulo(lienzo_aumentado: tuple[int, int], radio: float) -> Image.Image:
    """Blanco todo lo que queda fuera del circulo centrado de ese radio."""
    lw, lh = lienzo_aumentado
    mascara = Image.new('L', (lw, lh), 255)
    ImageDraw.Draw(mascara).ellipse(
        (lw / 2 - radio, lh / 2 - radio, lw / 2 + radio, lh / 2 + radio), fill=0
    )
    return mascara


def componer(
    forma: Image.Image,
    lienzo: tuple[int, int],
    ancho_logo: float,
    fondo: tuple[int, int, int] | None,
    tipo_de_fondo: str | None,
    opaco: bool = False,
    radio_que_no_puede_pasar: float | None = None,
) -> Image.Image:
    """
    Pinta el logotipo en tinta sobre su fondo, a varios aumentos, y reduce.

    Las mascaras se reducen por separado y el color se mezcla ya a su tamaño:
    asi no importa como trate Pillow el alfa premultiplicado al reducir.
    """
    aumento = aumento_para(*lienzo)
    logo = logotipo_aumentado(forma, lienzo, ancho_logo, aumento)
    silueta = fondo_aumentado(tipo_de_fondo, lienzo, aumento)

    if radio_que_no_puede_pasar is not None:
        fuera = fuera_del_circulo(logo.size, radio_que_no_puede_pasar * aumento)
        if ImageChops.multiply(logo, fuera).getbbox() is not None:
            sys.exit(f'El logotipo se sale del circulo de {radio_que_no_puede_pasar:.1f} px en {lienzo}.')

    if silueta is not None:
        logo = ImageChops.multiply(logo, silueta)

    logo = logo.reduce(aumento)
    tinta = Image.new('RGB', lienzo, TINTA)

    if silueta is None:
        resultado = tinta.convert('RGBA')
        resultado.putalpha(logo)
        return resultado

    assert fondo is not None
    color = Image.composite(tinta, Image.new('RGB', lienzo, fondo), logo)
    if opaco:
        return color
    resultado = color.convert('RGBA')
    resultado.putalpha(silueta.reduce(aumento))
    return resultado


def guardar(imagen: Image.Image, ruta: Path, escritos: list[Path]) -> None:
    if not ruta.parent.is_dir():
        sys.exit(f'No existe la carpeta {ruta.parent.relative_to(RAIZ)}: ¿se corre desde el portal?')
    imagen.save(ruta, optimize=True)
    escritos.append(ruta)


def main() -> None:
    forma = cargar_origen()
    ancho_origen, alto_origen = forma.size
    alto_por_ancho = alto_origen / ancho_origen
    radio_origen = radio_del_dibujo(forma)
    escritos: list[Path] = []

    # El favicon.
    guardar(
        componer(forma, (FAVICON_LADO, FAVICON_LADO), FAVICON_LADO * FAVICON_PROPORCION, BRUMA, 'redondeado'),
        RAIZ / 'public' / 'favicon.png',
        escritos,
    )

    for carpeta, densidad in DENSIDADES.items():
        destino = RECURSOS / f'mipmap-{carpeta}'

        # El clasico y el redondo: 48 dp, fondo a sangre o en circulo.
        lado = round(48 * densidad)
        ancho = lado * PROPORCION_CLASICO
        guardar(componer(forma, (lado, lado), ancho, BRUMA, 'cuadrado'), destino / 'ic_launcher.png', escritos)
        guardar(
            componer(forma, (lado, lado), ancho, BRUMA, 'circulo', radio_que_no_puede_pasar=lado / 2),
            destino / 'ic_launcher_round.png',
            escritos,
        )

        # El adaptativo: solo la figura, sobre transparente. El tamaño lo
        # decide el punto mas lejano, que tiene que quedar dentro de 32 dp.
        lienzo = round(LIENZO_ADAPTATIVO_DP * densidad)
        por_dp = lienzo / LIENZO_ADAPTATIVO_DP
        escala = RADIO_OBJETIVO_DP * por_dp / radio_origen
        guardar(
            componer(
                forma,
                (lienzo, lienzo),
                ancho_origen * escala,
                None,
                None,
                radio_que_no_puede_pasar=RADIO_SEGURO_DP * por_dp,
            ),
            destino / 'ic_launcher_foreground.png',
            escritos,
        )

    # La ficha de Play: 512 a sangre; el recorte lo pone la tienda. Va con alfa
    # —opaca entera— porque la tienda pide PNG de 32 bits.
    guardar(
        componer(forma, (512, 512), 512 * PROPORCION_PLAY, BRUMA, 'cuadrado'),
        RAIZ / 'android' / 'icono-play-512.png',
        escritos,
    )

    # Las pantallas de arranque, opacas como las de la plantilla.
    for carpeta, (ancho, alto) in ARRANQUES.items():
        ancho_logo = min(ancho, alto) * PROPORCION_ARRANQUE
        guardar(
            componer(forma, (ancho, alto), ancho_logo, CIELO, 'cuadrado', opaco=True),
            RECURSOS / carpeta / 'splash.png',
            escritos,
        )

    for ruta in escritos:
        with Image.open(ruta) as imagen:
            print(f'{ruta.relative_to(RAIZ)}  {imagen.size[0]}x{imagen.size[1]}  {imagen.mode}')
    print(f'{len(escritos)} archivos desde {ORIGEN.relative_to(RAIZ)} (alto/ancho {alto_por_ancho:.4f}).')


if __name__ == '__main__':
    main()
