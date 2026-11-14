# Bitácora · noviembre 2026

Lo que se hizo cada día, en orden inverso. Es historial: **para saber cómo funciona algo hoy,
mira el documento temático que corresponda** (empieza por [README.md](README.md)); esto explica
por qué llegó a ser así y qué se probó por el camino.

Sigue en [BITACORA-2026-10.md](BITACORA-2026-10.md).

**Al 13/11/2026, el titular del mes:** el portal del candidato cambió de mundo visual —de «El
cielo despejado» a «Northstar»— y el panel del equipo se quedó en el anterior. Cómo es hoy, en
[DESIGN.md](../DESIGN.md) y [EL-MUNDO-VISUAL](EL-MUNDO-VISUAL.md).

---

## El portal adopta el estilo de Northstar (13/11/2026)

Rama `feat/estilo-northstar`. El usuario pidió una **réplica exacta del estilo** de
northstar-template-demo.vercel.app —tipografía, espaciado, resaltados, botones, radios, filetes,
fondo, cabecera, animaciones— **sin su contenido ni su marca**, ignorando la paleta y las reglas
de estilo del mundo anterior. Se hizo en tres tandas.

### 1 · La portada, la cabecera, el pie y los tokens

- **Cómo se midió.** Con Playwright sobre la página real, a 1440 y 390: estilos computados de
  cada elemento visible, las `@font-face`, los `@keyframes` y transiciones de su hoja, y las
  transformaciones de su portada muestreadas cada 100 px de scroll. De ahí salen los valores
  que están en DESIGN.md: el titular en Onest 400 a `clamp(36px, 6.1vw, 88px)` con -0,055em,
  la etiqueta de 11 px y 0,16em, la barra de 69 px, los botones de 14 px en mayúsculas, la
  ventana de 64rem × 38rem y radio 28, y el «container scroll» (1,08 → 1 y 96 → -180 px al 41 %
  de una sección de 170 vh; el titular -48 px y fundido al 32 %).
- **Fuentes.** Onest y Syne son de Google Fonts (OFL): se bajaron los woff2 latin y latin-ext
  y se sirven desde `public/tipografia/`. No se copió ningún archivo de su sitio.
- **El pie** replica la noche de la referencia con un saludo que cambia de idioma (Hola,
  Allillanchu, Kamisaraki, Olá, Hello) y la llamada «VER VACANTES ———».

### 2 · El fondo y la ventana

- **El fondo era una aproximación en canvas 2D y pasó a ser el sombreador de verdad.** Se sacó
  su código interceptando `shaderSource` y los uniformes con los que se llama: el «Dithering»
  de Paper Shaders (simplex, Bayer 4×4, 4 px, escala 1,2, `#527ADA`, velocidad 0,5), un lienzo
  un 10 % más grande, y —lo que no se veía a ojo— **una máscara CSS de rayas de 1,92 px cada
  14,4 px**, que es lo que hace columnas del tramado. Portado a WebGL2 sin la librería, con
  respaldo en 2D, pausa fuera de pantalla y 30 cuadros en teléfonos. En zoom ×2 no se
  distingue del original.
- **Un fallo que costó un rato:** el fondo salía vacío. La limpieza del efecto llamaba a
  `loseContext()`, StrictMode remonta, y el lienzo recibía su contexto ya perdido. Quitado, con
  una nota en el código.
- **La ventana** no convencía al usuario («vacía y poco creíble»: una tarjeta suelta sobre
  puntos). Se rehízo siguiendo la vista «Agents» del original: métricas arriba, un grafo de
  nodos unidos por líneas en codo —la postulación avanzando por sus cinco etapas, con su
  estado— y la actividad a la derecha. Las cinco etapas siguen siendo la lista accesible.

### 3 · Las dieciocho pantallas, el panel aparte y la documentación

- **El panel se había repintado.** `mundo.css` y `piezas.module.css` son globales, y las capturas
  del panel contra `main` daban entre un 9 % y un 29 % de píxeles distintos (botones en
  mayúsculas, la acción en azul, otra letra). Se resolvió **al revés de como se había hecho**:
  la base de cada archivo compartido volvió a ser exactamente la de `main`, y todo lo Northstar
  pasó a un bloque bajo `html:not(.mundo-panel)`. `usarMundoDelPanel()` pone la clase en
  `<html>` mientras el panel está montado (`ArmazonPanel`, `InvitacionPanel`, y el aviso de error
  cuando lo roto es una pantalla del panel). Resultado: **0,000 % de diferencia** contra `main`
  en la lista de vacantes, una vacante con su ranking y simulación, a 1280 y a 390.
  Configuración y la ficha de un postulante caen en el aviso de error con los datos de prueba
  de hoy (en `main` también) y ese aviso coincide.
- **Dos trampas al comparar.** El puerto 5176 que se eligió para servir `main` lo tenía otra
  sesión, y las primeras capturas «de main» eran de otra rama (crema y naranja). Y Vite deja en
  caché las clases que una hoja trae con `composes` desde otra: tras cambiar `piezas.module.css`,
  la ficha seguía enseñando los botones viejos hasta reiniciar el servidor.
- **Las pantallas del candidato.** Además de lo que heredan de los tokens:
  - una pasada sobre sus hojas (`src/paginas/**`): ningún peso por encima de 550, y las
    etiquetas en mayúsculas con 0,16em;
  - la etiqueta «Sección / Lo que es» encima del titular en quince pantallas, con
    `data-seccion` y pintada como pseudoelemento (no se lee dos veces);
  - campos con el halo azul al enfocar; estados (vacío, error, acceso necesario) como celdas de
    filete con esqueleto que barre; el modal entra desde el 96 %; la campana sin fondo y con el
    número en azul; los mandos de la evaluación en mayúsculas; las tarjetas de `/vacantes` con
    el filete como anillo y la elegida con halo.
- **Lo que no se copió a propósito:** el borde de los campos de la referencia (1,5:1) se quedó en
  el gris de control (3,9:1), y su etiqueta al 42 % solo en la portada.
- **Verificado** con los guiones de `herramientas/capturar-*.mjs` a 1440 y 390, más una red de
  seguridad que contesta cualquier petición no interceptada: **ninguna llegó a un backend**.
  Typecheck limpio y 2185 pruebas en verde.
- **Documentación.** DESIGN.md reescrito para Northstar; `.impeccable/design.json` rehecho a
  mano a juego (no se pudo correr `/impeccable document` desde la sesión);
  [EL-MUNDO-VISUAL](EL-MUNDO-VISUAL.md) y los avisos de `CLAUDE.md` puestos al día.

## 13–14/11/2026 · Fuera el ámbar

- **Portal (13/11).** `--duda` y su familia pasan al azul marino de Northstar (`#1E3A8A`, bruma
  `#E9EDFF`, punto `#527ADA`) bajo `:root:not(.mundo-panel)`. Era la única mancha cálida y se
  leía como advertencia; el primer sitio que lo hizo notar fue la pretensión del perfil.
- **Panel (14/11).** La base de `--duda` en `mundo.css` pasa al índigo del panel (`#4338CA`,
  bruma `#EEF0FF`, tinta `#312E81`, punto `#818CF8`). Ya no queda ámbar en ninguna parte; el
  estado «en duda» se distingue por la forma (bruma, punto, etiqueta).
