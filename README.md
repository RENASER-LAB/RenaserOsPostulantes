# Portal del candidato · RENASER OS

La cara que ve quien postula a una vacante de Renaser: elegir una oportunidad, postular,
responder la evaluación, hacer la prueba del puesto, elegir fecha de simulación y seguir
el estado del proceso.

El panel del equipo de Talento **no** está aquí: vive en el repositorio del backend.

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

## Lo que falta

- **La pantalla de decisión ámbar.** El estado `DECISION_TURNO_CANDIDATO` existe en el
  backend, pero no hay ninguna ruta en `/api/v1/portal` para leer qué evidencia se pide ni
  para enviarla. La pantalla existe y explica la situación, sin formulario.
- **Saber cómo se llama el candidato.** El backend devuelve solo `{ token, usuarioId }` al
  entrar. El nombre se guarda al crear la cuenta; quien entre desde otro navegador verá el
  portal sin su nombre hasta que exista una ruta que lo diga.
