---
target: el portal del candidato
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-24T20-35-57Z
slug: el-portal-del-candidato
---
Method: dual-agent (A: revisión de diseño · B: detector + evidencia de navegador)

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | 3 | El cronómetro no tiene estilo aplicado ni avisa de nada |
| 2 | Correspondencia con el mundo real | 3 | «registrado por una persona» es vocabulario de auditoría interna |
| 3 | Control y libertad | 2 | No existe recuperación de contraseña: ni ruta, ni pantalla, ni enlace |
| 4 | Consistencia y estándares | 2 | El detalle pinta dos veces el panel de acción; lo bloqueado se resuelve de dos formas |
| 5 | Prevención de errores | 3 | «Entregar prueba» nunca se apaga cuando falta un entregable obligatorio |
| 6 | Reconocer antes que recordar | 2 | El mapa del examen no es lateral: panel plegado, cerrado por defecto |
| 7 | Flexibilidad y eficiencia | 3 | Sin «añadir al calendario» en una sesión presencial de 2 h |
| 8 | Estética y minimalismo | 3 | Prosa a 91–96 caracteres por línea; el detalle cuenta el mismo viaje tres veces |
| 9 | Recuperación de errores | 3 | Hay un error irrecuperable —la contraseña— que ninguna pantalla reconoce |
| 10 | Ayuda y documentación | 3 | `talento@renaser.pe` aparece en una sola pantalla del portal |
| **Total** | | **27/40** | **Bueno, con dos agujeros de existencia, no de diseño** |

## Design Specificity Verdict

Autorizado para este producto de forma desigual: la especificidad vive en el componente y en
las palabras, no en el armazón. No es trasladable la marca tachada del recorrido, la supresión
de «lo que te esperaba» al terminar, los requisitos como preguntas de sí o no, ni el formulario
de Decisión apagado y explicado. Sí es intercambiable el armazón: cabecera de 61 px, columna
centrada, pie. Si se borra `Seguimiento.tsx` y el vocabulario de estados, no queda nada que
identifique a EX.

**Escaneo determinista.** 168 hallazgos de una sola regla, `design-system-font-size`. Una causa
con 168 sitios: `mundo.css` no expone ningún token de escala tipográfica. En navegador,
`flat-type-hierarchy` lo corrobora de forma independiente; `audit` llegó por un tercer camino.

**Hallazgo nuevo:** `line-length` real en diez bloques. El tope `62ch` de DESIGN.md compra ~93
caracteres porque `ch` es el ancho del «0» y en Libre Franklin es ancho. El número está mal
calibrado, no las pantallas.

**Falsos positivos verificados:** `cramped-padding` ×4 (la regla ignora `height`; hay 11 px de
aire real). `gradient-text` ×7, `text-occlusion` ×3 y `monotonous-spacing` ×6 eran el detector
escaneándose a sí mismo al inyectarse en línea; servido por URL externa desaparecen.

## Priority Issues

### [P0] El cronómetro no tiene estilo aplicado y no avisa
`Cronometro.tsx` usa `className = 'timer'` por defecto, `Prueba.tsx:656` no pasa `className`, y
`.timer` no existe en ninguna hoja. `.tiempo.poco` (rojo bajo diez minutos) solo se aplica al
`00:00:00` ya consumado de `Prueba.tsx:653`. Sale con `aria-live="off"`. PRODUCT.md lo nombra
como requisito concreto de accesibilidad. Arreglo: `className={estilos.tiempo}` + `poco` bajo
600 s, y un texto con `aria-live="polite"` que se anuncie en umbrales. → /impeccable harden

### [P0] No hay recuperación de contraseña
Sin ruta en `src/rutas.ts`, sin pantalla, sin enlace en `Ingresar.tsx`. Quien olvida su clave con
una evaluación abierta queda fuera de forma definitiva. Arreglo sin backend nuevo: enlace a una
pantalla que diga la verdad y ofrezca el correo; a medio plazo reusar `POST /portal/auth/acceso`,
que ya existe. → /impeccable harden

### [P1] Con el tiempo agotado, una respuesta en blanco dice que se guardó
`Prueba.tsx:334`, rama `bloqueado && estado === 'limpio'`, no comprueba `texto.trim() === ''`; la
rama no bloqueada sí lo hace. Además `.campoEnlace` no tiene `:disabled` y `.secundario:disabled`
no lleva el fondo hundido que sí lleva `.acentoGrande:disabled`. Es la regla del indicador
honesto rota en el peor minuto. → /impeccable polish

### [P1] En el hub, un rechazo y una espera se ven igual
Mismo bloque hundido para «Tu prueba está en revisión» y «Gracias por participar». La marca
tachada no aparece nunca en el hub, y la terminada es la única sin «Ver el recorrido completo».
El código explica bien por qué no pinta recorrido (sin historial serían cinco casillas vacías);
el arreglo es dar forma propia a la tarjeta cerrada con `esFinal(estado)`, ya disponible en la
lista. → /impeccable polish

### [P1] El detalle pinta dos veces el mismo panel de acción
`Proceso.tsx:160` y `Seguimiento.tsx:198` renderizan ambos el `<Link>`. Dos paneles índigo con
dos botones «Abrir prueba» para arrancar una prueba cronometrada e irreversible. Arreglo: quitar
el Link de `estadoActual` y dejarlo solo en el hito; conservarlo en los estados finales, donde no
hay hito abierto. → /impeccable distill

## Problema sistémico

Trece tamaños de letra; los dos más usados, 14 px (69) y 15 px (62), no están en la rampa de
DESIGN.md. Cinco valores solapados entre 17 y 22 px. `mundo.css` tiene tokens de color y espacio
pero ninguno de tipografía. Va junto con la medida de línea mal calibrada a 62ch.

## Persona Red Flags

- **Móvil en el transporte:** la barra fija del examen come ~190 px de 812 y repite el mismo
  número dos veces. El SEC pide arrastrar cinco asas en una pantalla que hace scroll.
- **Quien llegó por el enlace del correo:** el bloque «Con el enlace que te enviamos» son tres
  párrafos y cero botones. Si el correo no salió, no hay reenvío, ni dirección, ni recuperación.
- **Quien acaba de ser rechazado:** `detalle-rechazo` dice que tendrá que postular de nuevo y no
  tiene un solo enlace a vacantes. Termina en un registro de auditoría.

## Minor Observations

- La portada de la evaluación queda descuadrada: `.pagina` 62 rem centrado, `.portada` 40 rem
  anclada a la izquierda.
- El antetítulo: se van cinco de siete. Se quedan `DECISIÓN · TE PEDIMOS UNA COSA MÁS` y
  `CAMBIO EN EL ENCARGO`, que llevan información que el titular no lleva.
- `CLAUDE.md:61` dice «mapa lateral»; la implementación es un panel plegable superior.
- Ninguna fecha de simulación lleva zona horaria.
- `PC` y `CD` usan el mismo cuadrado: «elige una» y «marca varias» son indistinguibles.
- `.env.local` apunta el proxy de Vite a `localhost:8081`, que responde, y comparte la base de
  producción. Toda prueba de navegador tiene que interceptar la red.

## Questions to Consider

1. Si trece de dieciocho estados son esperas, ¿por qué el recorrido está plegado justo en esas
   trece? Quien actúa ya sabe qué hacer; quien espera es el que necesita el mapa.
2. El cronómetro tiene el número más importante del portal y ninguna clase aplicada. ¿Decisión
   o descuido? Si fue no alarmar, está mal calibrada.
3. Si el correo puede no salir, ¿por qué la única dirección de contacto está en la pantalla que
   menos gente ve?
