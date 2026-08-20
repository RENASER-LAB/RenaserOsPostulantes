# Portal del candidato · RENASER OS

La cara que ve quien postula a una vacante de Renaser: elegir una oportunidad, postular,
responder la evaluación, hacer la prueba del puesto, elegir fecha de simulación y seguir
el estado del proceso.

El panel del equipo de Talento **no** está aquí: vive en el repositorio del backend.

Si vas a retomar el trabajo, empieza por [CLAUDE.md](CLAUDE.md): tiene el contexto completo —
con qué habla el portal, qué se decidió y por qué, y qué está a medias.

## Levantarlo

Necesitas el backend de Spring corriendo en el 8080.

```bash
npm install
```

```bash
npm run dev
```

Se abre en `http://localhost:5174`. Vite redirige `/api` al backend, así que el navegador
solo habla con Vite y no hay CORS que configurar. Si el backend está en otro puerto:

```bash
API_URL=http://localhost:8081 npm run dev
```

O de forma fija, en un `.env.local` que no se versiona:

```bash
echo "API_URL=https://ai-agents-spring-ai.onrender.com" > .env.local
```

Apuntarlo a Render sirve para probar en local contra el backend desplegado, que es
exactamente lo que hace `vercel.json` en producción.

Otros comandos:

```bash
npm run typecheck
```

```bash
npm run build
```

## Cómo está organizado

```
src/
  api/        un archivo por controlador del backend, y los tipos de sus DTOs
  app/        arranque, rutas, sesión, tema y el armazón (cabecera y pie)
  dominio/    los 18 estados de una postulación, y el reloj del servidor
  ui/         piezas compartidas: modal, aviso, barra de pasos, cronómetro
  paginas/    una carpeta por pantalla
  estilos/    las variables y los estilos, sacados del mockup
  rutas.ts    todas las direcciones del portal, en un sitio
```

### Las tres piezas que sostienen el resto

**`dominio/estados.ts`** — el corazón. El backend manda un estado con nombre
(`PRUEBA_TURNO_CANDIDATO`, `PERFIL_CALIFICANDO`…) y este archivo traduce cada uno a lo que
ve el candidato: en qué etapa pintar la barra, qué título, qué ayuda y qué botón. Ninguna
pantalla sabe qué estados existen: se lo pregunta a la tabla. Si el backend añade un
estado, se toca este archivo y nada más.

**`dominio/reloj.ts`** — la hora la manda el servidor. El cronómetro de la prueba no
cuenta hacia atrás desde un número: recalcula cuánto falta hasta la hora de vencimiento
que dio el backend, descontando el desfase entre los dos relojes. Cambiar la hora del
equipo no lo mueve.

**`api/cliente.ts`** — la única puerta al backend. Pone el token, convierte los errores
HTTP en algo que la pantalla pueda enseñar, y apunta la hora del servidor en cada
respuesta.

## De dónde sale el diseño

Del mockup `portal-candidato.html` del repositorio del backend
(`docs/mockups/`). Los colores, la escala de espacios, los cortes de pantalla y los
componentes se copiaron tal cual; lo que cambió fue la lógica, porque el mockup se escribió
antes de que el backend tuviera su modelo de estados definitivo.

Qué cambió y por qué está en [docs/01-ANALISIS-PORTAL.md](docs/01-ANALISIS-PORTAL.md).

## Desplegado: Vercel por delante, Render por detrás

En local, Vite reenvía `/api` al backend. Ese reenvío **solo existe en desarrollo**: en la
build de producción, `fetch('/api/...')` pegaría contra el dominio de Vercel, donde no hay
nada. Por eso está [vercel.json](vercel.json), que hace lo mismo en producción.

Antes de desplegar hay que **cambiar `CAMBIAME.onrender.com` por la URL real del backend**.

Las dos reglas del archivo:

- **`/api/*` → Render.** El navegador solo habla con el dominio de Vercel, y Vercel reenvía
  por detrás. Como para el navegador todo es el mismo origen, **no hace falta CORS en el
  backend** — que no lo tiene: `ConfiguracionSeguridad.java` no configura ninguno. Si el
  portal llamase a Render directamente, el navegador bloquearía todas las peticiones.
- **Todo lo demás → `index.html`.** Las rutas son reales, no con almohadilla, así que entrar
  directo a `/procesos` o a `/vacantes/4` tiene que servir el index y dejar que el enrutador
  decida. Las reescrituras se aplican después de buscar el archivo, así que los ficheros de
  `dist` se sirven igual.

⚠️ **El plan gratuito de Render duerme el servicio.** Tras unos 15 minutos sin tráfico, la
primera petición tarda cerca de un minuto en despertarlo. El portal reintenta dos veces y se
rinde mucho antes, así que un candidato que llegue al portal dormido verá la tarjeta de error
en vez de las vacantes. Hay que resolverlo antes de enseñárselo a nadie: plan de pago, o algo
que mantenga el servicio despierto.

## Lo que falta

- **La pantalla de decisión ámbar.** El estado `DECISION_TURNO_CANDIDATO` existe en el
  backend, pero no hay ninguna ruta en `/api/v1/portal` para leer qué evidencia se pide ni
  para enviarla. La pantalla existe y explica la situación, sin formulario.
- **Saber cómo se llama el candidato.** El backend devuelve solo `{ token, usuarioId }` al
  entrar. El nombre se guarda al crear la cuenta; quien entre desde otro navegador verá el
  portal sin su nombre hasta que exista una ruta que lo diga.
