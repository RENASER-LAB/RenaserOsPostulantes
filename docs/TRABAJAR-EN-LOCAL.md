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
