# El maquetado aprobado

> ⚠️ **Esto NO es el diseño del portal, y buena parte de lo que dice sobre color es falso
> desde el 10/09/2026.**
>
> El mundo visual es **«El escaparate»**: fondo gris `#F5F5F5`, acción en **negro** `#0A0A0A`,
> coral `#FF7C61` para «te toca a ti», Figtree. El índigo `#4338CA` que se ve en estos
> archivos y que este documento llegó a dar por indiscutible **se sustituyó**, y la migración
> del portal del candidato ya está terminada.
>
> Lo que sigue valiendo de aquí, y por eso no se borra, es **qué información va en cada
> pantalla y con qué palabras**. Para el color, la forma y el movimiento la verdad es
> [DESIGN.md](../DESIGN.md) y los tokens de [`src/estilos/mundo.css`](../src/estilos/mundo.css).

Estas son las pantallas del portal del candidato, aprobadas el 23/08/2026. **Es maquetado**:
define qué información va en cada pantalla, con qué palabras y con qué botones. **No define
el mundo visual** —tipografía, materialidad, densidad, movimiento—; eso vive en DESIGN.md.

Se ve entero en https://claude.ai/code/artifact/7239da41-c745-472c-9b90-19df9d4ef666 pero
**los archivos de esta carpeta son la fuente**, y son HTML normal que se lee sin nada
especial.

## Qué archivo es qué

- **`*.body.html`** — la fuente de cada pantalla. **Esto es lo que se lee y lo que se edita.**
- **`*.dc.html`** — derivados: el mismo cuerpo con el CSS incrustado y envuelto para el lienzo.
  Se regeneran con `node armar.mjs`. No editarlos.
- **`_base.css`** — los estilos del maquetado, en un solo sitio.
- **`_cab.html`** — la cabecera, que es igual en casi todas.
- **`canvas.json`** — dónde se coloca cada pantalla en el lienzo y las notas al margen.
- **`descartadas/`** — las variantes que no se eligieron. Están por si hay que volver a
  mirarlas; **no son el diseño**.

## Las pantallas

| Archivo | Qué es |
|---|---|
| `Main` | El índice del lienzo: qué se eligió y cómo leerlo |
| `Color` | ~~El estudio de color y por qué el acento es índigo~~ · **obsoleto**: el índigo se sustituyó el 10/09/2026 |
| `HubB` | **Mis procesos.** El centro del portal: cada postulación con su recorrido de cinco etapas |
| `EvaluacionA` | **La evaluación.** Una pregunta por pantalla con mapa lateral. La pantalla más difícil del portal |
| `EsperaA` | **Cuando no hay nada que hacer.** Trece de los dieciocho estados son esto |
| `Vacantes` | Portada con las vacantes abiertas · pública |
| `FichaVacante` | La ficha de una vacante · pública |
| `CrearCuenta` | Crear cuenta y los dos consentimientos · pública |
| `Entrar` | Los **dos** caminos de entrada: contraseña, y el enlace del correo · pública |
| `Postular` | CV, enlaces y los requisitos indispensables |
| `DetalleProceso` | El historial real de una postulación |
| `PruebaReto` | La prueba con entregables, cronómetro y cambio inesperado |
| `PruebaCuestionario` | La misma prueba sin entregables: 20 preguntas. Es la vacante Administrador |
| `Simulacion` | Elegir fecha, y la sesión ya confirmada |
| `DecisionAmbar` | El caso ámbar. **Maquetada sin backend detrás** |
| `Validacion` | El periodo de validación. **Maquetada sin backend detrás** |
| `Privacidad` | Las tres acciones que hoy se confunden, separadas |

## Cómo leerlo

Cada pantalla es un `<div class="marco">` con la cabecera y el cuerpo. Las convenciones:

- **Los bloques grises con líneas** (`.linea`) son contenido real que existe en el backend,
  dibujado como barra para no distraer con texto de relleno. No son huecos.
- **`.caja.toca`** y todo lo índigo es «te toca a ti». ⚠️ **En el portal ese color es hoy el
  coral `#FF7C61`**; el índigo se quedó solo en estos archivos HTML. Lo que no cambió es la
  regla: el color marca **solo** eso, y como mucho una vez por pantalla.
- **`.caja.gris`** es una espera o un contenido secundario.
- **`.nota`** es un aviso para quien lee el maquetado, no texto de la pantalla.
- **Lo que va entre corchetes** —`[FIGURA CONTRACTUAL]`, `[NOMBRE DEL RESPONSABLE]`— son datos
  que Renaser todavía no ha definido.
- Los textos **son los definitivos propuestos**, no relleno: la mitad del trabajo de este
  maquetado fue que el candidato entienda qué le toca sin perderse.

De dónde sale cada dato de cada pantalla está en
[../docs/02-QUE-VE-EL-CANDIDATO.md](../docs/02-QUE-VE-EL-CANDIDATO.md), sacado de los
contratos del backend.

## Lo que ya está decidido y no se rediscute

- **Solo tema claro.** Petición del cliente.
- ~~**Fondo blanco puro, acento índigo `#4338CA`.**~~ **Sustituido el 10/09/2026** por el
  fondo gris `#F5F5F5` con la acción en negro y el coral `#FF7C61` como único color. Lo que
  sigue vigente de aquella decisión es el porqué: verde, ámbar y rojo ya tienen significado
  fijo en el sistema —hecho, duda, error—, así que ni el acento ni la acción podían ser
  ninguno de esos.
- **Del portal viejo solo sobrevive** el nombre EX y su logotipo, la palabra con la hormiga
  dentro de la X.

## Lo que este maquetado no cubre

**«Mi perfil» no está aquí.** Es la pantalla más grande del portal y nació después; su brief
vive en [../docs/07-BRIEF-MI-PERFIL.md](../docs/07-BRIEF-MI-PERFIL.md).
