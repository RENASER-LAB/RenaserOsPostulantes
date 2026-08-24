# Auditoría técnica del portal · 24/08/2026

`/impeccable audit` sobre el portal completo. Es una revisión **de código**, no de diseño: lo
que sigue es medible y verificable, y no incluye juicios de UX —eso lo hace `critique`.

**Cómo se midió.** Un guion de Playwright recorrió **once rutas en dos anchos** (1280 y 375),
con las respuestas del backend interceptadas —la base real es producción y no se toca—, y midió
sobre el DOM ya pintado: contraste de cada nodo de texto contra su fondo heredado, caja de todo
lo enfocable, desborde horizontal, orden de encabezados, campos sin etiqueta y errores de
consola. Además se corrió el detector mecánico de `impeccable` sobre las veinte hojas de estilo.

---

## Nota de salud

| # | Dimensión | Nota | Hallazgo principal |
|---|---|---|---|
| 1 | Accesibilidad | 3/4 | Las 22 combinaciones de ruta comparten un único `<title>` |
| 2 | Rendimiento | 3/4 | Sin división de código: 642 kB en un solo paquete |
| 3 | Responsive | 4/4 | Cero desborde horizontal en 22 de 22 |
| 4 | Sistema de color | 4/4 | Ni un hex crudo; el sistema de tokens se usa entero |
| 5 | Integridad de implementación | 3/4 | Trece tamaños de letra donde el sistema documenta cinco |
| **Total** | | **17/20** | **Bueno — atacar las dimensiones flojas** |

## Veredicto de integridad de implementación

**Pasa.** El detector mecánico encontró **un solo tipo de hallazgo** en todo el portal, y es de
consistencia tipográfica, no de estructura. No hay copia decorativa, ni relleno, ni componentes
que podrían pertenecer a cualquier otro producto: la línea de hitos, la disciplina del acento y
los estados codificados en la forma son específicos de este producto y no se sostienen fuera de
él. El portal expresa un sistema propio y coherente.

## Resumen

- **P0 bloqueantes: 0.** Nada impide completar una tarea.
- **P1 mayores: 2.**
- **P2 menores: 4.**
- **P3 pulido: 2.**

Los tres que más importan:

1. El título de la pestaña nunca cambia (P1, WCAG 2.4.2 nivel A).
2. Trece tamaños de letra, cinco de ellos solapados en la banda de 17 a 22 px (P1).
3. Todo el portal viaja en un solo paquete de 642 kB (P2).

---

## Hallazgos

### [P1] El título de la pestaña es el mismo en todas las pantallas

- **Dónde:** `index.html:11`. No hay ningún sitio que lo actualice al navegar.
- **Categoría:** Accesibilidad.
- **Impacto:** Las 22 combinaciones medidas devuelven `EX · Empleos en Renaser`. Quien navega
  con lector de pantalla oye el mismo título al cambiar de pantalla y pierde la confirmación de
  que la navegación ocurrió. Quien tiene varias pestañas abiertas —muy probable en alguien que
  está postulando a varios sitios— no puede distinguir la suya. Y el historial del navegador
  queda con 22 entradas idénticas.
- **Estándar:** WCAG 2.4.2 *Page Titled*, **nivel A**. Es el único incumplimiento de nivel A
  que quedó.
- **Cómo se arregla:** un efecto en cada pantalla, o mejor uno solo en `Armazon.tsx` que derive
  el título de la ruta activa. `Mis procesos · EX`, `Analista de Datos · EX`.
- **Comando:** `/impeccable harden`

### [P1] Trece tamaños de letra donde el sistema documenta cinco

- **Dónde:** las veinte hojas `.module.css`. 168 avisos del detector.
- **Categoría:** Integridad de implementación.
- **Impacto:** El cuerpo del portal está bien —12, 13, 14, 15 y 16 px hacen trabajos
  distintos y reconocibles—. El problema está arriba: **17, 19, 20, 21 y 22 px** conviven
  haciendo todos «un título algo mayor que el cuerpo», sin que nada diga cuál toca. Es la
  clase de deriva que garantiza que la próxima pantalla invente un sexto valor.
- **Recuento:** 14px (69) · 15px (62) · 16px (30) · 13px (21) · 12px (9) · 17px (7) · 22px (4) ·
  19px (3) · 21px (2) · 20px, 26px, 28px, 30px (1 cada uno).
- **Cómo se arregla:** consolidar la banda alta a dos escalones —19 px para el título de bloque
  y 22 px para el destacado— y dejar 26–30 px solo donde son cifra, no texto: el cronómetro de
  la prueba y el número de la evaluación. Después **regenerar `DESIGN.md`**, porque hoy su rampa
  documenta cinco roles y la realidad son trece.
- **Comando:** `/impeccable typeset`, y luego `/impeccable document`

### [P2] La etiqueta permanentemente apagada no se puede leer

- **Dónde:** `src/paginas/decision/Decision.module.css` → `.enviar`; el mismo par de colores en
  `Simulacion.module.css` → `.enviar:disabled`.
- **Categoría:** Accesibilidad.
- **Impacto:** `--tinta3` sobre `--hundido2` da **4,25:1**, por debajo de 4,5. WCAG **exime**
  los controles inactivos, así que técnicamente no es un incumplimiento. Pero en «Decisión» el
  botón *nunca* se habilita: no hay ruta en el backend, y el candidato solo lo va a ver así.
  Una etiqueta que solo existe en su estado ilegible es distinta de un botón que se apaga un
  momento.
- **Cómo se arregla:** en la pantalla de decisión, subir la etiqueta a `--tinta2` (7,0:1) o
  quitar el botón y dejar solo la explicación. En el resto, donde apagado es transitorio, se
  puede dejar.
- **Comando:** `/impeccable polish`

### [P2] El enlace de correo suelto mide 23 px de alto

- **Dónde:** `src/paginas/decision/Decision.module.css` → `.correo`.
- **Categoría:** Accesibilidad / Responsive.
- **Impacto:** 135×23 px. **No tiene la excepción de enlace en línea**, porque va solo en su
  propio renglón con `display: inline-block` y margen propio: es un objetivo aislado. Y es la
  vía real de contacto en la única pantalla donde el formulario está apagado.
- **Estándar:** WCAG 2.5.8 *Target Size (Minimum)*, nivel AA: 24×24 px.
- **Cómo se arregla:** `min-height: 44px` y `align-items: center`, como el resto de lo pulsable.
- **Comando:** `/impeccable adapt`

### [P2] Todo el portal viaja en un solo paquete

- **Dónde:** `src/app/App.tsx` importa las quince pantallas de forma estática.
- **Categoría:** Rendimiento.
- **Impacto:** 642 kB sin comprimir, 200 kB con gzip, en un único fragmento. Quien entra a
  mirar vacantes —la pantalla pública, la que más visitas tendrá— descarga también la
  evaluación, la prueba, `@dnd-kit` entero y `motion`, que no va a usar. Vite ya avisa en cada
  compilación.
- **Cómo se arregla:** `React.lazy` en las rutas privadas pesadas —evaluación, prueba,
  simulación— con `Suspense`. Las públicas se quedan en el paquete principal.
- **Comando:** `/impeccable optimize`

### [P2] `prefers-reduced-motion` apaga toda respuesta, no solo la animación

- **Dónde:** `src/estilos/mundo.css:202`.
- **Categoría:** Accesibilidad.
- **Impacto:** La regla global pone `transition-duration: 0.01ms !important` en todo. Quien
  pide menos movimiento pierde también las transiciones de estado de 140 ms de los botones,
  que no son decorativas: son la confirmación de que el puntero está encima. La intención era
  matar la única animación del portal, y para eso `Seguimiento.tsx` ya usa `useReducedMotion`
  correctamente.
- **Cómo se arregla:** dejar el bloque global solo sobre `animation-*`, y sacar
  `transition-duration` de él.
- **Comando:** `/impeccable polish`

### [P3] Seis botones sin `type`

- **Dónde:** `Evaluacion.tsx:819,822` y `Prueba.tsx:793,796,827,830`, todos en el pie de un
  `<Modal>`.
- **Categoría:** Integridad de implementación.
- **Impacto:** Ninguno hoy: los seis están fuera de un `<form>`, así que el `type="submit"` de
  fábrica no envía nada. Pero es exactamente la trampa que el `CLAUDE.md` de este proyecto tiene
  anotada por haber costado un fallo real, y el día que uno de esos modales entre en un
  formulario, entrega la prueba sin querer.
- **Cómo se arregla:** `type="button"` en los seis.
- **Comando:** `/impeccable harden`

### [P3] Las casillas de consentimiento miden 23 px de alto

- **Dónde:** `src/ui/campos/Campo.module.css`, componente `Consentimiento`.
- **Categoría:** Accesibilidad.
- **Impacto:** La casilla es de 20×20 y su etiqueta asociada, de 590×23. El área efectiva es
  ancha pero baja: 23 px, un píxel por debajo del mínimo. Están en el registro, que es puerta
  de entrada obligatoria.
- **Estándar:** WCAG 2.5.8, nivel AA: 24×24 px.
- **Cómo se arregla:** subir el interlineado de la etiqueta o darle `min-height: 24px`. Es un
  píxel.
- **Comando:** `/impeccable adapt`

---

## Falsos positivos verificados

Dos hallazgos automáticos que se comprobaron y **no son defectos**:

- **`<input type="file">` sin nombre accesible.** Lleva `tabIndex={-1}` a propósito: está fuera
  del orden de tabulación y lo dispara el botón «Elegir archivo», que sí es enfocable y llama a
  `campoArchivo.current?.click()` (`Postular.tsx:245`). Es el patrón correcto, no un descuido.
- **Enlaces de 18 px en «Entra aquí» y «Créala aquí».** Van dentro de una frase, y WCAG 2.5.8
  exime explícitamente los enlaces en línea del mínimo de 24 px.

## Problemas sistémicos

**Solo uno, y es la banda tipográfica alta.** Cinco tamaños entre 17 y 22 px repartidos por
nueve hojas, sin regla que diga cuál usar. No es un descuido de una pantalla: es que el sistema
no llegó a fijar ese escalón, y cada pantalla lo resolvió por su cuenta.

Lo que **no** apareció, y suele aparecer: colores a mano (cero), objetivos táctiles pequeños de
forma generalizada (dos casos aislados), desborde en móvil (ninguno), campos sin etiqueta
(ninguno real), errores de consola (ninguno propio).

## Lo que está bien y hay que conservar

- **Cero desborde horizontal en 22 de 22** combinaciones de ruta y ancho. Es el fallo más común
  en un portal responsive y aquí no hay ni uno.
- **El anillo de foco funciona en todo lo enfocable**, con 2 px de acento y separación. Se
  comprobó tabulando: seis de seis elementos consecutivos lo tienen.
- **Ni un solo color escrito a mano** en las veinte hojas. Todo pasa por los tokens.
- **Los errores de formulario están atados a su campo** con `aria-describedby` y **dicen el
  problema y cómo se arregla**, no «campo inválido».
- **El estado se lee en la forma antes que en el color** en todo el portal —relleno, contorno
  grueso, discontinuo, tachado—, así que quien no distingue colores lee lo mismo.
- **Los `landmarks` están completos** —`header`, `nav`, `main`, `footer`— y `lang="es"`.
- **El orden de encabezados es correcto** en las once rutas: un `h1` visible y ningún salto de
  nivel. Los varios `h1` que aparecen en el código son ramas excluyentes, no encabezados
  simultáneos.
- **Sin imágenes que optimizar**: la única pieza gráfica es la hormiga de EX, un SVG en línea.

## Acciones recomendadas, por orden

1. **[P1] `/impeccable harden`** — el `<title>` por ruta y los seis `type="button"`.
2. **[P1] `/impeccable typeset`** — consolidar la banda de 17 a 22 px a dos escalones.
3. **[P2] `/impeccable optimize`** — `React.lazy` en evaluación, prueba y simulación.
4. **[P2] `/impeccable adapt`** — el enlace de correo y las casillas de consentimiento a 44 px.
5. **[P3] `/impeccable document`** — regenerar `DESIGN.md` con la rampa ya consolidada.
6. **[P3] `/impeccable polish`** — el contraste del botón apagado y el bloque de movimiento
   reducido, más lo que salga de `critique`.
