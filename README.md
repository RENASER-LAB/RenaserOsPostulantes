# EX · el portal del candidato y el panel del equipo

Dos caras en un mismo sitio:

- **El portal**, en `/` — quien postula: elige una oportunidad, postula, responde la
  evaluación, hace la prueba del puesto, elige fecha de simulación y sigue su proceso.
- **El panel**, en `/admin` — el equipo de Talento: las vacantes con su CRUD, el ranking
  de cada tanda etapa por etapa, las sesiones de simulación y la configuración.

El panel debería vivir integrado en RENASER OS, y ese sigue siendo el plan. Está aquí
mientras se termina lo que permitirá a otras empresas crear sus propias vacantes; se
sabe provisional y se construyó a sabiendas.

Si vas a retomar el trabajo, empieza por [CLAUDE.md](CLAUDE.md): tiene el contexto
completo — con qué habla el portal, qué se decidió y por qué, y qué está a medias.

## Levantarlo

Hace falta Node **20.19 o superior**. Con 20.17 compila pero Vite avisa en cada arranque.

```bash
npm install
```

El portal llama a `/api`, y Vite lo reenvía al backend. El destino sale de `API_URL`, que
va en un `.env.local` que **no está en el repositorio**. Contra tu Spring local:

```bash
echo "API_URL=http://localhost:8081" > .env.local
```

⚠️ **El backend local escucha en el 8081, no en el 8080.** En el 8080 vive
`postgresql-adminer-1`, que responde 200 y hace creer que el backend está arriba cuando
no lo está.

Y contra el backend desplegado, sin levantar nada más:

```bash
echo "API_URL=https://18-204-177-210.nip.io" > .env.local
```

⚠️ **Apuntando ahí escribes en la base de producción**, junto a candidatos reales, aunque
el portal corra en tu máquina. Registrarse o postular deja rastro de verdad.

```bash
npm run dev
```

Queda en `http://localhost:5174`. El panel, en `http://localhost:5174/admin`.

Otros comandos:

```bash
npm test
```

```bash
npm run build
```

## Cómo está organizado

```
src/
  api/        la puerta al backend, y los tipos de sus DTOs
  app/        arranque, rutas, sesión y el armazón (cabecera y pie)
  dominio/    los 18 estados de una postulación, y el reloj del servidor
  ui/         piezas compartidas: modal, avisos, campos, cronómetro
  paginas/    el portal, una carpeta por pantalla
  panel/      el panel del equipo, con su propia sesión y su propia puerta
  estilos/    mundo.css —la única hoja global— y las piezas que se repiten
  rutas.ts    todas las direcciones, en un sitio
```

### Las cuatro piezas que sostienen el resto

**`dominio/estados.ts`** — el corazón. El backend manda un estado con nombre
(`PRUEBA_TURNO_CANDIDATO`, `PERFIL_CALIFICANDO`…) y este archivo traduce cada uno a lo que
ve el candidato: en qué etapa está, qué título, qué ayuda y qué botón. Ninguna pantalla
sabe qué estados existen: se lo pregunta a la tabla. Si el backend añade uno, se toca
este archivo y nada más.

**`dominio/reloj.ts`** — la hora la manda el servidor. El cronómetro de la prueba no
cuenta hacia atrás desde un número: recalcula cuánto falta hasta la hora de vencimiento
que dio el backend, descontando el desfase entre los dos relojes. Cambiar la hora del
equipo no lo mueve.

**`api/puerta.ts`** — una puerta, dos llaves. Es una fábrica: el portal crea la suya
contra `/api/v1/portal` con el token del candidato, y el panel la suya contra
`/api/v1/panel` con el del equipo. Cada una con su sesión, porque **un 401 del panel no
puede cerrarle la sesión a quien está respondiendo una evaluación en otra pestaña**.

**`estilos/mundo.css`** — los tokens del mundo visual, con el porqué de cada uno. Todo lo
demás son CSS Modules, uno por pantalla; lo que se repite se trae con `composes` desde
`piezas.module.css`, no escribiendo clases en el JSX.

## De dónde sale el diseño

Del rediseño de agosto de 2026, no del portal original. El mundo visual se llama **«El
seguimiento»**: tu postulación como algo que va en camino, con hitos cumplidos que no se
apagan y un siguiente hito siempre nombrado.

- Los tokens con su razón de ser, las ocho reglas con nombre y los do's and don'ts están
  en [DESIGN.md](DESIGN.md).
- El maquetado de las 17 pantallas, en HTML plano, en [maquetado/](maquetado/LEEME.md).
- El brief de la pantalla que ordena el resto, en
  [docs/04-BRIEF-MIS-PROCESOS.md](docs/04-BRIEF-MIS-PROCESOS.md).

**Solo tema claro**, por petición del cliente. Fondo blanco puro y acento índigo
`#4338CA`, que significa una sola cosa: «te toca a ti».

## Verificarlo de verdad

Los guiones de `herramientas/` abren un Chrome real y recorren el producto. Los de
`capturar-*.mjs` interceptan todas las respuestas y no piden nada a ningún backend: mirar
una pantalla es gratis y seguro. Los dos e2e sí hablan con el backend local y escriben en
su base:

```bash
npx playwright test herramientas/e2e/14-vacante.spec.ts
```

De la solicitud de talento a la vacante publicada en el portal, pasando por elegir la
evaluación y la prueba. Cierra la vacante que crea: una publicada la ve cualquiera y no
hay forma de borrarla.

```bash
npx playwright test herramientas/e2e/13-etapas.spec.ts
```

El ranking por etapas: las cinco pestañas, el filtro de «aquí ahora», y la ficha que
cambia con la etapa — las dos tablas del perfil integral incluidas.

## Desplegado: Vercel por delante, AWS por detrás

En local, Vite reenvía `/api` al backend. Ese reenvío **solo existe en desarrollo**: en la
build de producción, `fetch('/api/...')` pegaría contra el dominio de Vercel, donde no hay
nada. Por eso está [vercel.json](vercel.json), que hace lo mismo en producción.

- **`/api/*` → `https://18-204-177-210.nip.io`**, el Spring en una EC2 con IP fija. El
  navegador solo habla con el dominio de Vercel, así que para él todo es el mismo origen y
  **no hace falta CORS en el backend** — que no lo tiene, y no debe tenerlo: añadirlo lo
  abriría a otros orígenes sin motivo.
- **Todo lo demás → `index.html`.** Las rutas son reales, no con almohadilla, así que
  entrar directo a `/procesos` o a `/admin/vacantes/4` tiene que servir el index y dejar
  que el enrutador decida.

⚠️ **La dirección es prestada.** `nip.io` resuelve cualquier `IP.nip.io` a esa IP, que es
lo que permitió sacar un certificado de Let's Encrypt sin dominio registrado. Cuando
Renaser tenga dominio propio se cambia esa línea y ya.

## Lo que falta, y no es diseño

- **La decisión ámbar.** `DECISION_TURNO_CANDIDATO` existe, pero no hay ruta para leer qué
  evidencia se pide ni para enviarla. La pantalla está entera y el formulario, **apagado**
  con un `fieldset disabled`, diciendo por qué antes de que nadie escriba.
- **La validación del candidato.** Su pantalla existe y **no se enlaza**: el backend no
  expone ni los días, ni el responsable, ni las métricas para quien las vive. El panel sí
  las tiene.
- **Saber cómo se llama el candidato.** El backend devuelve solo `{ token, usuarioId }` al
  entrar. Quien entre desde otro navegador verá el portal sin su nombre.
- **El correo no sale.** El backend tiene `renaser.correo.transporte` en `log` por defecto:
  todo «te avisaremos por correo» es hoy una promesa que el sistema desplegado puede no
  cumplir.
