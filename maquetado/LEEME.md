# El maquetado aprobado

Estas son las pantallas del portal del candidato, aprobadas el 23/08/2026. **Es maquetado**:
define qué información va en cada pantalla, con qué palabras y con qué botones. **No define
el mundo visual** —tipografía, materialidad, densidad, movimiento—; eso es lo que falta.

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
| `Color` | El estudio de color y por qué el acento es índigo |
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
- **`.caja.toca`** y todo lo índigo es «te toca a ti». El acento marca **solo** eso: el panel
  de la acción pendiente y el tramo del recorrido donde está el candidato.
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
- **Fondo blanco puro, acento índigo `#4338CA`.** El porqué está en `Color.body.html`: verde,
  ámbar y rojo ya tienen significado fijo en el sistema.
- **Del portal viejo solo sobrevive** el nombre EX y su logotipo, la palabra con la hormiga
  dentro de la X.
