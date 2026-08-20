# Portal del candidato · contexto de trabajo

Última actualización: 2026-08-20 · rediseño de EX aplicado y backend movido a AWS

Este archivo es para retomar el trabajo sin tener que reconstruir nada. Cuenta qué es este
proyecto, con qué habla, qué se decidió y por qué, y qué está a medias.

---

## Qué es esto

La cara que ve **quien postula** a una vacante de Renaser: elegir oportunidad, postular,
responder la evaluación, hacer la prueba del puesto, elegir fecha de simulación y seguir el
estado del proceso.

**Qué NO es.** El panel del equipo de Talento no está aquí. Vive en el repositorio del
backend, en `frontend/`, y es otra aplicación (React sin TypeScript, sin enrutador).

---

## Con qué habla

| Pieza | Dónde |
|---|---|
| Este portal | `github.com/RENASER-LAB/RenaserOsPostulantes` · desplegado en Vercel |
| Backend | `github.com/RENASER-LAB/ai-agents--spring-ai` · Spring Boot, Java 25 |
| Backend desplegado | `https://18-204-177-210.nip.io` · EC2 en AWS, con IP fija |
| Base de datos | Supabase en la nube |

La dirección del backend es una IP con `nip.io`, que resuelve cualquier `IP.nip.io` a esa IP
y por eso permite sacar un certificado de Let's Encrypt sin dominio registrado. El HTTPS es
real y se renueva solo. **Es provisional**: cuando Renaser tenga dominio propio se cambia la
línea de `vercel.json` y ya. Si `nip.io` se cayera, el portal se quedaría sin backend.

Render quedó atrás en el commit `089e8df`. No vuelvas a apuntar ahí: los endpoints nuevos
—entre ellos `POST /portal/auth/acceso`, el que canjea el enlace del correo— solo existen en
AWS.

⚠️ **La base de datos es la de producción, y es la misma en local y en AWS.** El
`docker-compose.yml` del backend levanta un Postgres local, pero `application-secrets.yaml`
apunta la conexión a Supabase, así que ese contenedor no se usa para los datos (RabbitMQ sí).
Registrarse o postular desde el portal —también en local— **escribe junto a candidatos
reales**.

---

## Levantarlo en un equipo nuevo

Hace falta Node **20.19 o superior**. Con 20.17 compila pero Vite avisa en cada arranque.

```bash
npm install
```

El portal llama a `/api`, y Vite lo reenvía al backend. Por defecto va a
`http://localhost:8080`. Para trabajar contra el backend desplegado sin levantar nada más,
crea un `.env.local` — **no está en el repositorio, hay que recrearlo**:

```bash
echo "API_URL=https://18-204-177-210.nip.io" > .env.local
```

```bash
npm run dev
```

Queda en `http://localhost:5174`.

Si prefieres el backend en casa, borra `.env.local` y en el repositorio del backend:

```bash
docker compose up -d
```

```bash
./mvnw spring-boot:run
```

Tarda unos 40 segundos en arrancar. El README del backend pide Ollama, pero **está
desactualizado**: la configuración real usa DeepSeek y Google GenAI en la nube, y no hay
ninguna referencia a Ollama en los YAML.

---

## Las tres piezas que sostienen el resto

**`src/dominio/estados.ts`** — el corazón. El backend manda un estado con nombre
(`PRUEBA_TURNO_CANDIDATO`, `PERFIL_CALIFICANDO`…) y este archivo traduce cada uno de los 18 a
lo que ve el candidato: etapa de la barra, título, ayuda y botón. Ninguna pantalla sabe qué
estados existen: se lo pregunta a la tabla. Si el backend añade un estado, se toca aquí y en
ningún otro sitio.

La regla que lo ordena: si el estado acaba en `TURNO_CANDIDATO` hay botón; si acaba en
`CALIFICANDO`, `POR_HABILITAR` o `POR_CONFIRMAR`, solo se informa y se espera.

**`src/dominio/reloj.ts`** — la hora la manda el servidor. El cronómetro de la prueba no
cuenta hacia atrás desde un número: recalcula cuánto falta hasta la hora de vencimiento del
backend, descontando el desfase entre relojes (se saca de la cabecera `Date` de cada
respuesta). Cambiar la hora del equipo no lo mueve.

**`src/api/cliente.ts`** — la única puerta al backend. Pone el token, convierte los errores
HTTP en algo que la pantalla pueda enseñar, apunta la hora del servidor, y cierra la sesión
sola cuando un 401 revela que el token ya no vale.

---

## Decisiones tomadas

| Qué | Decisión | Por qué |
|---|---|---|
| Lenguaje | TypeScript | 18 estados y DTOs grandes; rompe la consistencia con el panel de criba, que es JS plano |
| Alcance | Solo el portal del candidato | El panel del equipo sigue en el repositorio del backend |
| Rutas | Reales, no con almohadilla | Necesitan que el servidor devuelva el index; lo hace `vercel.json` |
| Evaluación | **Sí se puede volver atrás** y corregir | El backend manda todas las preguntas y acepta guardarlas en cualquier orden |
| Producción | Reescritura en Vercel, no llamada directa | El backend **no configura CORS por ningún lado**; reenviando por Vercel no hace falta |

Sobre lo último: no añadas CORS al backend. Con la reescritura no se necesita, y añadirlo
abriría el backend a otros orígenes sin motivo.

---

## La cara de EX

Desde el 2026-08-20 el portal se llama **EX** por decisión de gerencia. Solo cambió la cara:
las rutas, los estados y la lógica son los mismos.

El diseño completo —las 20 pantallas de escritorio, el sistema y la versión móvil, que queda
guardada para más adelante— está en un lienzo aparte. La marca sale del estudio
`EX_Estudio_Estrategico_Darren_V3_Excelencia_Talento.html`.

| Pieza | Dónde |
|---|---|
| Paleta y temas | [src/estilos/variables.css](src/estilos/variables.css) |
| Logotipo | [src/ui/Marca.tsx](src/ui/Marca.tsx) |
| Todo lo demás | [src/estilos/base.css](src/estilos/base.css) |

Cuatro cosas que sostienen el resto:

**El champagne significa algo.** `--acento` marca el turno del candidato —el borde del panel
de siguiente paso— y el paso en el que está —la barra de cinco tramos y la de la evaluación.
Nada más. Si empieza a aparecer en botones, titulares o iconos, deja de leerse como «esto es
tuyo».

**El oscuro es el tema de la marca.** `index.html` abre en oscuro y `Tema.tsx` ya no hereda
la preferencia del sistema: sin elección previa, oscuro. El claro sigue completo.

**El champagne del tema claro es otro.** El `#d9b86c` de la marca se queda en 3,9:1 sobre el
fondo hueso; en claro se usa `#816220`, que llega a 5,1:1. No unificar los dos valores.

**La tipografía es Archivo**, servida desde Google Fonts en `index.html`. Si algún día el
portal tiene que funcionar sin red externa, hay que empaquetarla.

## Qué se corrigió del mockup

El diseño salió de `ai-agents--spring-ai/docs/mockups/portal-candidato.html`. Los colores, la
escala de espacios, los cortes de pantalla y los componentes se copiaron tal cual. La lógica
no, porque el mockup se escribió antes de que el backend fijara su modelo de estados.

El detalle completo está en [docs/01-ANALISIS-PORTAL.md](docs/01-ANALISIS-PORTAL.md). Lo
esencial:

- Las etapas son **Perfil Integral · Prueba · Simulación · Validación · Decisión**. El mockup
  enseñaba CV · Evaluación · Prueba · Simulación · Validación.
- Son 18 estados con nombre, no un número del 0 al 5.
- Crear cuenta pide nombre y apellidos por separado, y son **dos consentimientos** distintos.
- Postular confirma los **requisitos objetivos** de la vacante.
- Los entregables de la prueba son una lista, y la prueba también trae preguntas.
- El detalle de la postulación pinta el historial de verdad.
- **No se enseña el grupo de prioridad**: es clasificación interna del equipo.

---

## Trampas que ya costaron un fallo

No las reintroduzcas.

**`useEffect` con cuerpo corto.** `useEffect(() => window.scrollTo(0, 0), [ruta])` devuelve lo
que devuelva `scrollTo`, y React se lo queda como función de limpieza. Al desmontar intenta
llamarlo y lanza `destroy is not a function`, que se lleva el árbol entero: página en negro.
Siempre cuerpo entre llaves salvo que devuelvas limpieza a propósito.

**Cancelar el guardado con retardo en la limpieza.** El efecto que guardaba el texto de la
evaluación cancelaba el envío al desmontarse, y como dependía de la pregunta, cambiar de
pregunta lo cancelaba. Quien escribía y pulsaba «Siguiente» rápido perdía la respuesta. Lo
pendiente se anota en una referencia y se manda al cambiar de pregunta, al entregar y al
salir.

**Dar por guardado lo que solo se ha enviado.** Esa corrección no bastó: lo pendiente se
borraba al mandarlo, así que un guardado que fallaba —un 500, una red que parpadea— se
perdía igual, y el error se limpiaba solo al pasar de pregunta. El candidato llegaba al
final con «16 de 20 respondidas» sin saber cuáles faltaban. **Lo escrito no sale de la cola
hasta que el servidor lo confirma**, se reintenta solo cada cinco segundos, se dice cuántas
respuestas están sin guardar y no se deja entregar mientras quede alguna. Vale igual para
la evaluación y para la prueba.

Para reproducirlo: `POST /api/v1/portal/_fallos/5` en el backend simulado hace caer uno de
cada cinco guardados. Con eso salía el «16 de 20» exacto; con el arreglo llegan las veinte.

**Indicadores que mienten.** Ese mismo sitio ponía «Respuesta guardada» siempre, porque era
texto fijo. Si un indicador dice que algo está a salvo, tiene que salir de comparar con lo
que hay en el servidor. Y una pregunta en blanco no está «guardada»: está **sin responder**,
que es otra cosa.

**Mirar el cuerpo antes que el estado.** El cliente devolvía `undefined` cuando no había
cuerpo, *antes* de comprobar si la respuesta había fallado; un 500 vacío se colaba como
éxito. Primero el estado, después el cuerpo.

**`<button>` sin `type`.** Por defecto es de envío. Dentro de un formulario, lo envía.

---

## Cómo se escribe aquí

- **Todo en español**, incluidos los nombres del código, como en el backend. Sin eñes ni
  tildes en identificadores: el backend usa `contrasena`, no `contraseña`.
- Carpetas por funcionalidad, no por tipo de archivo.
- Los comentarios explican **por qué**, no qué. Si un comentario describe lo que ya se lee en
  la línea siguiente, sobra.
- Las rutas del portal viven todas en `src/rutas.ts`. No escribir direcciones sueltas.
- Los tipos de `src/api/tipos.ts` copian los `record` de Java uno a uno. Si cambia allá,
  cambia aquí.

---

## Dónde estamos

El recorrido de postulación está probado de punta a punta contra el backend real: registro,
subida de CV, confirmación de requisitos, envío (201) y el panel mostrando la acción
pendiente con el historial correcto.

Encima de eso hay tres cosas nuevas de agosto: la cara de EX, ocho pruebas automáticas sobre
la evaluación con su CI en GitHub Actions, y el salto de Render a AWS que trajo el acceso por
enlace del correo (`/acceso`, PR #1).

### Pendiente

| Qué | Estado |
|---|---|
| ~~El backend no responde~~ | **Resuelto.** El de AWS contesta en algo más de un segundo y sirve las vacantes reales. Ojo con una trampa al comprobarlo a mano: la base es `/api/v1/portal`, no `/api`. Pedir `/api/vacantes` devuelve 500, y parece que el backend esté caído cuando no lo está |
| ~~La corrección de la evaluación sin validar~~ | **Validada.** Con uno de cada cinco guardados cayendo, antes se perdían cuatro de veinte respuestas; ahora llegan las veinte. Lo mismo comprobado en la prueba del puesto |
| **Pantalla de decisión ámbar** | `DECISION_TURNO_CANDIDATO` existe en el backend pero **no hay ruta** para pedir ni enviar la evidencia adicional. La pantalla explica la situación, sin formulario |
| **Saber cómo se llama el candidato** | El backend solo devuelve `{ token, usuarioId }` al entrar. El nombre se guarda al crear la cuenta; quien entre desde otro navegador verá el portal sin su nombre |
| **La dirección del backend es prestada** | `nip.io` es un servicio de terceros y la IP va escrita a mano en `vercel.json`. Mientras no haya dominio propio, el portal depende de las dos cosas |
| **Cuenta de prueba** | `prueba.portal.qa.20260819@example.com` quedó como **candidata activa** en la base real, postulada a Ingeniero/a de Infraestructura (`f7a53fcc-11eb-4369-be96-bee577bdea85`). Aparece en el panel del equipo junto a candidatos de verdad |
| **Vercel escribe en producción** | El portal desplegado usa la misma base real. Quien tenga el enlace puede registrarse y postular |

### Lo primero al retomar

1. Mirar los logs de la instancia de AWS si algo falla del lado del backend.
2. Cerrar lo de «estancado en la 16 de 20»: el backend no acepta entregar una evaluación
   incompleta —`ServicioEvaluacionImpl.entregar` lanza si faltan respuestas— y su
   `GlobalControllerAdvice` no maneja `IllegalArgumentException`, así que el motivo real sale
   como un 500 genérico. Falta saber **por qué** no se guardan esas respuestas: los logs de
   AWS lo dicen, la pantalla no puede.
3. Comprobar si hay evaluaciones ya entregadas con menos respuestas de las que deberían —
   las que se perdieron **no se recuperan**, nunca llegaron al servidor.
