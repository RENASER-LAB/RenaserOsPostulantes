---
target: «Mi perfil» del portal del candidato
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-09-06T06-47-21Z
slug: src-paginas-perfil-perfil-tsx
---
Método: dos agentes aislados (A revisión de diseño · B detector y navegador).

## Puntuación · 26/40 (sin cambio respecto a la corrida anterior)

| # | Heurística | Antes | Ahora | Hallazgo |
|---|---|---|---|---|
| 1 | Visibilidad del estado | 3 | 3 | El medidor puede volver a decir «Está todo» con certificaciones sin confirmar |
| 2 | Sistema y mundo real | 3 | 2 | La línea de tiempo hace tres promesas falsas: no ordena por fecha, el alto no mide meses, y el hueco se dibuja contra el par equivocado |
| 3 | Control y libertad | 1 | 2 | Los menús ya cierran con Escape y clic fuera; siguen siete borrados sin deshacer ni gestión de foco |
| 4 | Consistencia | 2 | 2 | «Editar perfil» / «Editar lo tuyo»; `.marca.delCv` viste origen y nivel |
| 5 | Prevención de errores | 2 | 2 | La entrada es ejemplar; el borrado no tiene una sola guarda |
| 6 | Reconocer > recordar | 3 | 3 | El índice es un avance; su primera entrada es un enlace muerto |
| 7 | Flexibilidad | 3 | 3 | Aptitudes como etiquetas; reordenar sigue siendo una flecha por viaje |
| 8 | Estética y minimalismo | 3 | 3 | La gramática de la caja es buena; el canalón muere al 40 % |
| 9 | Diagnóstico y recuperación | 3 | 3 | Los fallos de la foto salen lejos de la foto |
| 10 | Ayuda y documentación | 3 | 3 | No se dice quién ve el resto del perfil |

## Reglas no negociables
- Violeta = «te toca a ti»: **incumplida**. `tonoDe()` da disco `--canto-violeta` a 1 de cada 4, y hay portada «Violeta» a sangre.
- Prosa sobre color: cumplida. · Nada obligatorio: cumplida. · Foto solo del candidato: cumplida donde se dice, ausente en la portada.
- Forma antes que color: cumplida, pero `.marca.delCv` se reutiliza para el nivel educativo.

## Problemas prioritarios

**[P1] El hueco de empleo se dibuja contra el par equivocado.** `<Hueco>` se emite ANTES de `<Fila i>` pero describe el salto entre `filas[i+1]` (abajo) y `filas[i]`: va una posición demasiado arriba, siempre. Afirma un vacío laboral donde no lo hay. Arreglo: emitirlo después de `<Fila i>`.

**[P1] La línea de tiempo no mide lo que dice medir.** `min-height` no gana nunca con datos reales: 130 meses → 189,6 px y 46 meses → 185,9 px. El alto correlaciona con la longitud del texto, no con los meses. Y el orden no es cronológico (la lectura del CV añade al final). Arreglo: escribir la duración en palabras —`mesesDelTramo` ya la calcula y se pierde en CSS— y ordenar por fecha o dejar de afirmar que baja el tiempo.

**[P1] Los 29 controles de fila a `opacity: 0.55` dan 2,5:1.** Por debajo del mínimo hasta que el ratón entra en la fila. Arreglo: bajar el peso con el token (`--tinta3` en reposo, `--tinta` en hover/foco), no con transparencia.

**[P1] El índice pierde cuatro de seis entradas en un portátil, y la primera es un enlace muerto.** El `aside` mide 885 px con `top: 77px`; en una ventana de 800 px las últimas cuatro quedan bajo el borde para siempre. Y `#seccion-acerca-de-ti` solo se pinta en la rama de edición, así que no existe en el estado normal.

**[P2] El medidor puede volver a decir «Está todo» con datos sin confirmar.** `partes()` no incluye `certificaciones`; `cuantosSinConfirmar()` sí. Es el P0 anterior sobreviviendo en una de las cuatro listas.

## Menores
Canalón derecho vacío desde el 40 %; «Está bien» idéntico a «Añadir experiencia»; la pretensión va en `--duda-bruma`, que ahora significa «esto te toca»; dos enlaces a `/privacidad` con nombres distintos (deliberado, escrito en `Armazon.tsx`); `border-radius: 1px` en el raíl fuera de la escala.

## Lo que funciona
La gramática de la caja aguanta la prueba en gris: sin color, el único rectángulo con borde es la fila que te toca. El estado vacío no regaña. El idioma no se puede copiar.
