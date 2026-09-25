# Trabajar en local

Con qué habla el portal, a qué base escribe según cómo lo apuntes, y cómo levantarlo en un
equipo nuevo.

---

## Con qué habla

| Pieza | Dónde |
|---|---|
| Este portal | `github.com/RENASER-LAB/RenaserOsPostulantes` · desplegado en Vercel |
| Backend | `github.com/RENASER-LAB/ai-agents--spring-ai` · Spring Boot, Java 25 |
| Backend desplegado | `https://18-204-177-210.nip.io` · EC2 en AWS, con IP fija |

La dirección del backend es una IP con `nip.io`, que resuelve cualquier `IP.nip.io` a esa IP
y por eso permite sacar un certificado de Let's Encrypt sin dominio registrado. **Es
provisional**: cuando Renaser tenga dominio propio se cambia la línea de `vercel.json` y ya.

Render quedó atrás en el commit `089e8df`. No vuelvas a apuntar ahí: los endpoints nuevos
—entre ellos `POST /portal/auth/acceso`, el que canjea el enlace del correo— solo existen en
AWS.

⚠️ **A qué base escribes depende de a dónde apunte `.env.local`, y la diferencia importa.**

| `API_URL` | El portal habla con | Y eso escribe en |
|---|---|---|
| `https://18-204-177-210.nip.io` | El Spring de AWS | **La base de producción, junto a candidatos reales** |
| `http://localhost:8081` | Tu Spring local | `renaser-postgres`, un Postgres en Docker, solo tuyo |

Apuntando a AWS, **registrarse o postular escribe junto a candidatos reales aunque el portal
corra en tu máquina**. Apuntando al local, no toca nada de producción.

⚠️ **El backend local escucha en 8081, no en 8080.** En el 8080 vive `postgresql-adminer-1`, que
responde 200 y hace creer que el backend está arriba cuando no lo está.

Aun así, **los scripts de `herramientas/capturar-*.mjs` interceptan todas las respuestas** con
`contexto.route(...)` y no llegan a pedirle nada a ningún backend. Eso no se toca: es lo que
hace que mirar una pantalla sea gratis y seguro en cualquiera de las dos configuraciones.

---

## Levantarlo en un equipo nuevo

Hace falta Node **20.19 o superior**. Con 20.17 compila pero Vite avisa en cada arranque.

```bash
npm install
```

El portal llama a `/api`, y Vite lo reenvía al backend. El destino sale de `API_URL`, que se
pone en un `.env.local` — **no está en el repositorio, hay que recrearlo**. Contra tu Spring
local:

```bash
echo "API_URL=http://localhost:8081" > .env.local
```

Y para trabajar contra el backend desplegado sin levantar nada más:

```bash
echo "API_URL=https://18-204-177-210.nip.io" > .env.local
```

```bash
npm run dev
```

Queda en `http://localhost:5174`.

Al comprobar el backend a mano, la base es `/api/v1/portal`, **no** `/api`. Pedir
`/api/vacantes` devuelve 500 y parece que el backend esté caído cuando no lo está.

---

## La entrada de desarrollo del panel

`/admin/entrar` lleva al final una entrada plegada, «Entrar con un id de desarrollo», que
canjea un id de RENASER OS por una sesión sin contraseña. En una base local recién
levantada puede ser lo único que abra el panel: el id que suele existir es **`andy-dev`**.

⚠️ **No existe en producción, y no por estar escondida: no llega a compilarse.** El bloque
va detrás de `import.meta.env.DEV || import.meta.env.VITE_PUERTA_DESARROLLO === '1'`, dos
constantes que Vite sustituye al construir, así que el sacudido de árbol se lo lleva entero
—ni el `<details>`, ni el manejador, ni el texto—. Vercel no define esa variable.

| Cómo levantas el portal | ¿Está la puerta? |
|---|---|
| `npm run dev` | Sí: `DEV` es verdadero |
| `vite preview` de un `npm run build` normal | **No** |
| `VITE_PUERTA_DESARROLLO=1 npm run build` + `vite preview` | Sí |
| Vercel | No |

Esto importa para las pruebas: **`herramientas/e2e/13-etapas.spec.ts` la abre desde la
interfaz**, igual que `herramientas/verificar-panel.mjs`. Contra `npm run dev` funcionan sin
hacer nada; si levantas un preview para correr los e2e, constrúyelo con la bandera o ese
escenario falla sin motivo aparente. Los demás escenarios no la tocan: llaman a
`/panel/auth/dev-login` por HTTP, que es cosa del backend y no del portal.

---

## E2E con un clon aislado

`herramientas/e2e/base-de-datos.ts` es el helper compartido por todos los worktrees.
Requiere **seis variables explícitas**, sin destinos por defecto:

| Variable | Valor |
|---|---|
| `E2E_PG` | Nombre o ID del contenedor PostgreSQL activo |
| `PGUSER` | Rol de pruebas del clon |
| `PGDATABASE` | Base del clon |
| `E2E_CLONE_ID` | Identidad que figura en la etiqueta del contenedor |
| `E2E_API` | URL de loopback de la API, incluida `/api/v1` |
| `E2E_PORTAL` | URL de loopback del frontend |

En el harness, el adaptador exporta `E2E_CLONE_ID` desde `DB_RESOURCE_KEY`, la
identidad `resourceKey` ya registrada en el trabajo. La configuración E2E recibe
`E2E_PG=${DB_CONTAINER}`, `PGUSER=${DB_USER}`, `PGDATABASE=${DB_NAME}`,
`E2E_CLONE_ID=${DB_RESOURCE_KEY}`, `E2E_API=${URL_API}/api/v1` y
`E2E_PORTAL=${URL_WEB}`. No hay que editar helpers en cada worktree.

Para un clon independiente, su creador debe asignar al contenedor la etiqueta
`renaser.e2e.clone=mi-prueba-01`. El harness usa `claude-harness.job`.
Con el clon ya restaurado y el backend ya conectado a él, por ejemplo:

```bash
# Terminal del frontend: API_URL debe apuntar al backend de ese mismo clon.
API_URL=http://127.0.0.1:9081 VITE_ORIGEN_API= npm run dev -- --host 127.0.0.1 --port 5274 --strictPort

# Terminal de pruebas: adapta todos estos valores a tu clon.
export E2E_PG=mi-postgres-pruebas PGUSER=mi_rol PGDATABASE=mi_base
export E2E_CLONE_ID=mi-prueba-01
export E2E_API=http://127.0.0.1:9081/api/v1 E2E_PORTAL=http://127.0.0.1:5274
npm run test:e2e -- --project=escritorio
```

El helper **no crea, restaura ni sincroniza bases**, ni arranca el preview. Las
URLs locales no prueban por sí solas qué base usa la API: quien arranca el preview
debe configurar ambos contra el mismo clon. Antes de ejecutar escenarios se
comprueban las URLs, la etiqueta, el estado del contenedor y la base/usuario
SQL efectivos. Las consultas usan el ID resuelto; si cambia el contenedor,
la ejecución falla sin reconectar. `E2E_CONTAINER_ID` lo propaga internamente
Playwright a sus workers; no es una variable que deba configurar el usuario.

Se admite un worker y una ejecución E2E por clon. Una reserva atómica dentro del
contenedor impide que otros worktrees ejecuten la suite simultáneamente. Cada
trabajo necesita su propio clon. Si se mata el runner sin cierre, la reserva
`/tmp/renaser-e2e-en-ejecucion` permanece: antes de retirarla manualmente,
comprueba que ya no hay pruebas activas y revisa las escrituras pendientes.

La limpieza recibe listas de correos únicos completos o IDs capturados durante
la prueba; no barre prefijos ni plantillas. Ciudad y remuneración guardan los
valores existentes y los restauran incluso tras fallos. Los registros de auditoría
inmutable se conservan. Si una restricción impide limpiar una cuenta, el error
hace fallar el cierre y **se conserva el clon para inspección**; no se apagan
triggers. No se cambiaron los candidatos, vacantes ni expectativas heredadas:
un snapshot distinto puede seguir haciendo fallar esos escenarios.

Dos variables más, las dos opcionales y las dos apagadas por defecto:

| Variable | Qué hace |
|---|---|
| `E2E_IA_REAL=1` | Deja correr las pruebas que le piden algo a DeepSeek de verdad (`16-cuestionario-tecnico` pasos 6–12, `17-prueba-tecnica` paso 5). Sin ella se saltan diciendo por qué: la corrida automática nunca llama al proveedor. Hace falta el backend con la clave real |
| `E2E_ESCENARIO=base` | Apaga la intercepción del ranking de «Desarrollador web» (`herramientas/e2e/escenario-desarrollador-web.ts`): las pruebas del ranking se fían de lo que haya en la base, que es lo que dejan `scripts/sembrar-escenario-e2e.py` del backend o `herramientas/e2e/sembrar-escenario-desarrollador-web.ts`. Solo para medir una vía contra la otra |

El detalle de qué prueba usa qué, en [SUITE-E2E-CLASIFICACION-2026-09-25.md](SUITE-E2E-CLASIFICACION-2026-09-25.md).

Los unitarios del helper viven fuera del directorio de escenarios y corren con
`npm test`; `npm run typecheck:e2e` comprueba el tipado. Para comprobar aislamiento
real, prepara dos clones temporales del mismo snapshot autorizado, con la misma
base y rol, y ejecuta:

```bash
# Conserva las seis variables del primer clon y declara la identidad del segundo.
export E2E_OTHER_PG=otro-postgres-pruebas E2E_OTHER_CLONE_ID=mi-prueba-02
npm run test:e2e:aislamiento
```

Esta integración comprueba limpieza exacta, preservación de registros previos,
restauración tras un fallo y las huellas de todas las tablas del segundo clon.
También provoca una restricción real de auditoría, verifica el rollback y deja
la cuenta de diagnóstico en el primer clon para inspección. No usa bases de trabajo.
