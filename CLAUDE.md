# Portal del candidato · contexto de trabajo

**Este archivo no guarda estado ni reglas del código: todo eso vive en `docs/` y se lee ahí.**
Empezar por [docs/README.md](docs/README.md). Lo que cambie al terminar una funcionalidad se
escribe en el documento que le toque, no aquí.

Dos caras en un mismo sitio: **el portal**, en `/`, para quien postula; y **el panel**, en
`/admin`, para el equipo de Talento — provisional aquí mientras se termina lo que permitirá a
otras empresas crear sus vacantes, y construido a sabiendas.

---

## Respuestas

Responde en el chat de manera extremadamente concisa, corta y directa. Si para implementar algo hace falta que
yo haga algo —ejecutar un script, tocar una configuración— dámelo en una sección **«Flujo de
Implementación»** con los pasos en orden. Si tengo que decidir algo, ponlo en una sección
**«Decisiones»** aparte, para que no se confunda con el texto normal.

## Cómo preguntar

No uses el vocabulario de los documentos del cliente al preguntar: sus términos son ambiguos
(«corte», «gate», «avanzar»). Interpreta el significado con el contexto y pregunta con
palabras propias y concretas, describiendo la situación real.

## Git

**No crees commits.** Los hago yo, y también los PR. Quiero poder ver los cambios antes.
Solo commitea si te lo pido explícitamente.

---

## Antes de tocar nada

Tres avisos que no se ponen detrás de un enlace, porque llegan tarde:

⚠️ **El mundo visual es «El cielo despejado» desde el 25/09/2026**, y sustituyó entero a «El
escaparate». Sale de una referencia que trajo el cliente (saasly.demos.tailgrids.com): la
escala gris fría de Tailwind v4 —página `#F9FAFB`, superficies en nube blanca encima, que es lo
que las separa—, **acción en índigo `#615FFF`** con radio **8 px**, `--accion-fuerte` casi negro
`#030712` solo para el botón de la cabecera, y **Geist** servida por el sitio. **El coral y el
crema ya no existen**, y con el coral se perdió el color propio de «te toca a ti»: es el mismo
índigo de la acción, y lo distingue la forma. **La fuente de verdad son los tokens de
[`mundo.css`](src/estilos/mundo.css)**, y [DESIGN.md](DESIGN.md) los describe con su porqué.

Las **dieciocho** pantallas del candidato están compuestas —la número dieciocho es
`/restablecer`, que llegó de main el 23/09/2026 junto con la reescritura de `/clave`—; **el
panel sigue fuera de alcance, salvo sus tres puertas**, aunque `mundo.css` es global y el
cambio de paleta también lo repintó.

⚠️ **`/admin/entrar`, `/admin/clave` y `/admin/restablecer` entraron al escaparate el
25/09/2026 y ya no viven sueltas: van DENTRO del armazón del portal**, así que llevan su
cabecera y su pie. Lo que sigue fuera es `ArmazonPanel` —el candado—, y por eso no hay bucle.
`/admin/invitacion` no entró: a esa se llega desde un enlace del correo, no desde el portal.
El resto de `/admin` conserva la disposición anterior.

⚠️ **La cabecera se ve desde el primer píxel.** Es una píldora blanca flotante a 16 px del
borde, **sin filete ni sombra** en reposo ni al bajar, como la de la referencia; sobre el gris
claro de más abajo casi no se distingue, y es a sabiendas. `--alto-cabecera` son **84 px medidos**, y
ha pasado por 61, 76, 68 y 70: si tocas su relleno **o el alto del botón «Iniciar sesión»**,
vuelve a medirlo en el navegador. El 25/09/2026 se olvidó y el token se quedó en 70 con la barra
midiendo 84.

Lo que se toca al componer una pantalla nueva vive en tres sitios y **ninguno se escribe a
mano en la hoja de la pantalla**: los tokens en [`mundo.css`](src/estilos/mundo.css), los
botones y paneles en [`piezas.module.css`](src/estilos/piezas.module.css), y el carril, el
encabezado y los bloques en [`pagina.module.css`](src/estilos/pagina.module.css).

⚠️ **`composes` solo admite una clase simple** —ni `.a.b`, ni listas—: PostCSS devuelve un 500
y la aplicación entera deja de montar. Y **un `composes` entre archivos no gana por escribirlo
después**: si necesitas una variante, se declara con nombre en la hoja compartida. Si migras
una pantalla, **actualiza DESIGN.md en la misma tanda**.

⚠️ **A qué base escribes depende de a dónde apunte `API_URL` en `.env.local`.** Con
`https://18-204-177-210.nip.io` el portal habla con el Spring de AWS y **registrarse o postular
escribe junto a candidatos reales, aunque el portal corra en tu máquina**. Con
`http://localhost:8081` no toca nada de producción.

⚠️ **El backend local escucha en 8081, no en 8080.** En el 8080 vive `postgresql-adminer-1`,
que responde 200 y hace creer que el backend está arriba cuando no lo está.

El detalle, en [docs/TRABAJAR-EN-LOCAL.md](docs/TRABAJAR-EN-LOCAL.md).

---

## Dónde está cada cosa

| Si vas a… | Lee |
|---|---|
| Orientarte en los documentos | [docs/README.md](docs/README.md) |
| Levantarlo, elegir backend, saber a qué base escribes, mirar pantallas sin tocar la base | [TRABAJAR-EN-LOCAL](docs/TRABAJAR-EN-LOCAL.md), [README.md](README.md) |
| Tocar código: los 18 estados, la hora del servidor, la única puerta al backend, `grupoPrioridad`, las trampas que costaron un fallo, la marca de obligatorio de los formularios, cómo se nombra aquí | [REGLAS-DEL-CODIGO](docs/REGLAS-DEL-CODIGO.md) |
| Tocar diseño: el mundo visual, sus reglas nombradas, la tipografía, el mapa de `src/`, qué lee `impeccable` | [DESIGN.md](DESIGN.md) y [EL-MUNDO-VISUAL](docs/EL-MUNDO-VISUAL.md); los tokens con su porqué en [`src/estilos/mundo.css`](src/estilos/mundo.css). **DESIGN.md y `.impeccable/design.json` se regeneran juntos**, con `/impeccable document` |
| Entender qué ve y qué hace quien postula, pantalla por pantalla | [02-QUE-VE-EL-CANDIDATO](docs/02-QUE-VE-EL-CANDIDATO.md) |
| Seguir el proceso entero, los dos lados, con lo que desbloquea cada paso | [06-FLUJO-COMPLETO](docs/06-FLUJO-COMPLETO.md) |
| Tocar el panel: entrar y recuperar la contraseña, las tres pestañas, el ranking por etapas, qué exige publicar una vacante, corregirla en su modal, archivarla y dónde queda, eliminarla por borrado lógico, el plazo de su prueba, los huecos del backend | [PANEL](docs/PANEL.md) |
| Saber qué falta, qué está a medias y qué promesa hoy no se cumple | [PENDIENTES](docs/PENDIENTES.md), [03-ESTADO-DEL-REDISENO](docs/03-ESTADO-DEL-REDISENO.md) |
| Saber por qué algo quedó así, qué se probó al construirlo o qué se hizo un día concreto | [BITACORA-2026-09](docs/BITACORA-2026-09.md), [BITACORA-2026-08](docs/BITACORA-2026-08.md) |
| Las 17 pantallas del maquetado, que es lo que se lee para construir | [maquetado/LEEME.md](maquetado/LEEME.md) |
| El backend: sus endpoints, sus reglas y sus documentos | `~/Documentos/RENASER-RECLUTAMIENTO` — su `CLAUDE.MD` y su `docs/` |

`PRODUCT.md` en la raíz es de la herramienta de mockups, no de este trabajo.

---

## Mantener este archivo al día

Es lo primero que lee una sesión nueva. **Si miente, la sesión trabaja sobre una idea falsa
del proyecto** — ya pasó: decía que el tema oscuro era el de la marca cuando el código ya
forzaba el claro.

- **Es un mapa, no un historial.** Aquí solo van las reglas de trabajo y los enlaces. Lo que
  se hizo un día concreto va a la bitácora del mes; cómo funciona algo hoy, a su documento.
- **Borrar lo que dejó de ser cierto**, no acumular. Este archivo se lee entero cada sesión:
  cuanto más largo, menos se sostiene.
- **Verificar antes de escribir.** Lo que dice el código, no lo que se recuerda.
- Si añades un documento a `docs/`, añade su fila en [docs/README.md](docs/README.md).
