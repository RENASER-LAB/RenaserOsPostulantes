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

Dos avisos que no se ponen detrás de un enlace, porque llegan tarde:

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
| Tocar código: los 18 estados, la hora del servidor, la única puerta al backend, `grupoPrioridad`, las trampas que costaron un fallo, cómo se nombra aquí | [REGLAS-DEL-CODIGO](docs/REGLAS-DEL-CODIGO.md) |
| Tocar diseño: el mundo visual, sus cuatro reglas de forma, la tipografía, el mapa de `src/` | [EL-MUNDO-VISUAL](docs/EL-MUNDO-VISUAL.md), [DESIGN.md](DESIGN.md) |
| Entender qué ve y qué hace quien postula, pantalla por pantalla | [02-QUE-VE-EL-CANDIDATO](docs/02-QUE-VE-EL-CANDIDATO.md) |
| Seguir el proceso entero, los dos lados, con lo que desbloquea cada paso | [06-FLUJO-COMPLETO](docs/06-FLUJO-COMPLETO.md) |
| Tocar el panel: entrar, las tres pestañas, el ranking por etapas, qué exige publicar una vacante, los huecos del backend | [PANEL](docs/PANEL.md) |
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
