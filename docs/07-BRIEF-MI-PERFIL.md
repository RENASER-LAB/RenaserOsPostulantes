# Brief · «Mi perfil» al estilo portal de empleo

05/09/2026 · **Planificación, sin una sola línea de código escrita.**

> **Al día 05/09/2026 por la tarde: construido y verificado.** Las seis decisiones de §5 se
> tomaron ese mismo día y están en la tabla del final de este documento. Lo que se hizo vive
> en la rama `feat/perfil-del-candidato` de los dos repositorios. Este documento se conserva
> tal cual porque es el inventario de lo que había ANTES: sirve para entender por qué se
> decidió cada cosa, no para saber cómo está hoy.

La clienta pide que la pantalla de perfil del postulante «se parezca a LinkedIn»: foto de
perfil, «Acerca de», más atractiva, quizá un fondo. Este documento dice qué de eso ya está
construido, qué no existe, qué hay que decidir antes de tocar nada, y cómo se vería el
rediseño.

**El titular:** el 80 % de lo que pide ya está implementado y se ve mal. No falta producto,
falta forma. Lo único que de verdad no existe es la foto, la portada, el nombre del candidato
y subir el CV desde el perfil — y de esos cuatro, tres tocan backend.

---

## 1 · Lo que ya está implementado

La pantalla es [`src/paginas/perfil/Perfil.tsx`](../src/paginas/perfil/Perfil.tsx) (696
líneas) más [`Listas.tsx`](../src/paginas/perfil/Listas.tsx) (1251). El backend entero salió
el 25/08/2026 y está documentado en `docs/APIS-PERFIL-DEL-CANDIDATO.md` del repositorio del
motor.

### El mapa contra LinkedIn

| LinkedIn | En EX hoy | Estado |
|---|---|---|
| Nombre y apellidos en la cabecera | `persona.nombre` / `apellidos` en la base | ⚠️ **existe en la base, no llega al portal** |
| Titular (headline) | `titular` | ✅ implementado |
| **Acerca de** | **`resumen`** | ✅ **implementado — solo hay que llamarlo así** |
| Ubicación | `ubicacion` (texto libre) + `persona.ciudad_ubigeo` | ⚠️ dos fuentes que compiten |
| Experiencia | `/perfil/experiencia` — crear, editar, borrar, confirmar, **reordenar** | ✅ completo |
| Educación | `/perfil/educacion` — igual, con catálogo de 6 niveles | ✅ completo |
| Aptitudes | `habilidades[]` (texto libre) | ✅ el dato existe; se pinta como una caja de texto con comas |
| Idiomas | `/perfil/idiomas` con catálogo A1–C2 + Nativo | ✅ completo |
| Licencias y certificaciones | `/perfil/certificaciones` con aviso de vencidas | ✅ completo, y con más criterio que LinkedIn |
| Sitios web / enlaces | `/perfil/enlaces`, 6 tipos, valida dominio de LinkedIn y GitHub | ✅ completo |
| Pretensión salarial | `pretension` {min, max, moneda} | ✅ implementado (LinkedIn no lo tiene) |
| **Foto de perfil** | — | ❌ **no existe, y está descartado por escrito** |
| **Imagen de portada** | — | ❌ no existe |
| Subir CV desde el perfil | — | ❌ el CV solo entra al postular |
| Reordenar experiencia arrastrando | El endpoint existe; hoy se mueve con botones ↑↓ | ⚠️ medio |
| Vista «así te ven» | El endpoint del panel existe (`/panel/postulaciones/{id}/perfil`) | ❌ **ninguna pantalla lo consume todavía** |
| Descargar mis datos | `/perfil/descarga` | ✅ implementado (ley 29733) |

### Y algo que LinkedIn no tiene y aquí es lo más valioso

Cada dato sabe **de dónde vino** (`origen: PERSONA` o `CURRICULUM`) y **si el candidato lo
confirmó**. El currículum se lee solo y rellena el perfil; lo que salió del archivo aparece
marcado «Sin confirmar» hasta que la persona lo valida o lo corrige. Eso ya funciona de punta
a punta, incluido el sondeo cada 5 s mientras la lectura corre.

**Es la pieza que un rediseño «a la LinkedIn» se lleva por delante sin darse cuenta**, porque
LinkedIn no tiene nada equivalente y no hay dónde copiarlo. Va primero en la lista de lo que
no se toca.

---

## 2 · Lo que no existe

### 2.1 La foto de perfil · hay que decidirlo, no programarlo

Está **descartada por escrito**, en dos documentos del backend:

> «**Foto de perfil.** Va en contra de que el currículum se anonimice antes de que lo lea la
> IA, que existe para no sesgar por edad, sexo o aspecto.»
> — `docs/APIS-PERFIL-DEL-CANDIDATO.md`, sección «Lo que no va a existir»

El RF-41 obliga a ocultar **foto, edad, sexo y estado civil** antes de que la IA lea el CV, y
hay código dedicado a ello (`AnonimizadorCv`, `ExtractorTextoCv`). Ahora bien, conviene
separar dos cosas que ese párrafo mezcla:

- **La IA no es el problema.** Al convertir el PDF a texto las imágenes se caen solas; una
  foto en el perfil nunca entraría en el texto que lee el modelo.
- **El problema es la ficha del panel.** El RF-163 dice que el equipo ve el perfil del
  candidato en su ficha. Ahí decide una persona, y una persona sí se sesga por una foto. Ese
  es el conflicto real.
- ⚠️ **Y hoy esa ficha no existe todavía.** El endpoint del panel está construido, pero
  ninguna pantalla de `src/panel/` lo consume: el equipo aún no ve el perfil por ningún sitio.
  Conviene decidir la foto **antes** de construirla, no después.

**Tres salidas, y la elige la clienta:**

| | Qué es | Qué cuesta | Qué se pierde |
|---|---|---|---|
| **A** | Sin foto (lo decidido hoy) | Nada | El portal se ve más frío que Bumeran |
| **B** | Foto **solo en el portal del candidato**; nunca en el panel, nunca a la IA | Backend: columna, endpoint de subida, tipos de imagen | Honestamente: una foto que nadie que decide llega a ver es casi decorativa |
| **C** | Foto también en la ficha del panel | Lo de B + **un RF nuevo** + cambio del texto de consentimiento | Se relaja la postura anti-sesgo que es el argumento de venta del producto |

⚠️ **La C no es una decisión de diseño, es una decisión de negocio.** «Aquí no se decide por
el currículum» es el posicionamiento del producto (PRODUCT.md). Si se enseña la foto a quien
decide, hay que decirlo en voz alta y dejarlo escrito, no que se cuele por una pantalla
bonita.

### 2.2 Lo demás que falta

**El nombre del candidato no llega al portal.** El backend, al entrar, devuelve un
identificador y nada más; hoy el nombre se guarda en `localStorage` al registrarse
([`src/app/Sesion.tsx`](../src/app/Sesion.tsx)) y **quien entra desde otro navegador, o por el
enlace del correo sin contraseña, ve el portal sin nombre**. Una cabecera estilo LinkedIn es
nombre + foto + titular + ubicación: hoy le faltan dos de las cuatro. Necesita un endpoint o
un campo más en el de sesión.

**La ubicación tiene dos fuentes que no coinciden.** `perfil_candidato.ubicacion` es texto
libre («Arequipa, Perú» escrito seis veces distinto), y la V47 movió la fuente buena a
`persona.ciudad_ubigeo` con catálogo cerrado de 196 provincias — dejando dicho que la columna
vieja «deja de leerse desde la aplicación». Hay que elegir cuál pinta la cabecera. Y a quien
tenía cuenta antes del 01/09 no se le preguntó nunca la ciudad: puede faltar.

**Subir el CV desde el perfil no se puede.** No hay endpoint: el archivo solo entra al
postular. Es exactamente lo que la gente espera de una pantalla así, y hoy la pantalla tiene
un párrafo explicando por qué no hay botón. Además `TiposDeArchivo` solo acepta `pdf`, `doc` y
`docx` — comprobando extensión **y** tipo declarado —, así que las imágenes rebotarían igual.

**Imagen de portada:** mismo trabajo de backend que la foto, y encima choca con una regla del
sistema de diseño (§4.3).

---

## 3 · El diagnóstico de diseño

La pantalla actual hace bien lo difícil y mal lo fácil.

**Lo que hace bien:** el panel de «te quedan N datos por revisar», los tres estados de la
lectura del CV, la distinción «sin confirmar» legible sin color, el fallo de refresco que no
tira el formulario, el aviso de certificación vencida.

**Lo que la hace verse pobre:**

1. **Es una columna de 48 rem (768 px) con ocho formularios apilados.** No hay cabecera de
   identidad, no hay nada que se lea como «este soy yo». Se lee como un formulario de trámite,
   no como un perfil. Ocho pantallas del portal —vacantes, la ficha, mis procesos, la
   evaluación, la prueba— ya usan el carril de 68 rem; el perfil y los textos legales son las
   únicas que se quedan en 48.
2. **Cerrar sesión está en la primera línea, al lado del titular.** Es la acción más
   destructiva de la pantalla compitiendo con el titular por la mirada. Se puso ahí porque
   esta pantalla es también «Mi cuenta» — pero eso es el segundo problema.
3. **Mezcla dos cosas: «mi perfil» y «mi cuenta».** Perfil, cerrar sesión, descargar mis datos
   y privacidad viven en la misma página. LinkedIn y Bumeran los separan, y con razón: uno se
   visita para lucirse y el otro para irse.
4. **Las habilidades son un `input` de texto con comas.** Es el campo más visual de cualquier
   perfil de empleo y aquí es el más pobre.
5. **Todo pesa igual.** Ocho secciones idénticas, sin jerarquía: la experiencia laboral —lo
   único que alguien lee de verdad— tiene el mismo peso visual que los enlaces.
6. **Ninguna señal de progreso.** No hay forma de saber si el perfil está a medias.
7. **Nada que ver.** Sin foto, sin portada, sin iniciales, sin un color: es gris sobre blanco
   de arriba a abajo, en la única pantalla del portal cuyo contenido es la persona.

---

## 4 · Lo que se propone

Modo **Operate** (el candidato viene a completar algo), pero con un primer tercio de pantalla
en modo Persuade: lo primero que ve tiene que ser él, no un formulario.

### 4.1 La cabecera de identidad · lo que más cambia

Una sola pieza nueva arriba, y es la que hace que la pantalla deje de parecer un trámite:

```
┌──────────────────────────────────────────────────── portada, ancho completo ──┐
│   (banda de bruma con el canto irisado abajo)                                 │
└───────────────────────────────────────────────────────────────────────────────┘
   ⬤  Luis Rodrigo Fernández                          [ Editar perfil ]
  foto  Analista de procesos · Arequipa
  o     8 años de experiencia · Disponibilidad inmediata
 inicial ⬤ LinkedIn  ⬤ GitHub  ⬤ Portafolio
```

- **Sin foto no queda un hueco:** un disco con las **iniciales** sobre un tono del espectro
  del canto, derivado del nombre. Se ve terminado desde el primer día y no depende de ninguna
  decisión pendiente. Si luego se aprueba la foto, ocupa el mismo sitio.
- El **titular** en grande, debajo del nombre. Es el campo que hoy está enterrado en el
  formulario de la cabecera y es lo primero que se lee en cualquier portal de empleo.
- Los **enlaces** suben aquí como iconos, en vez de vivir en la última sección de la página.
- «Editar perfil» abre la cabecera; el resto se edita sección por sección, como ya hace hoy.

### 4.2 Dos columnas, y una anchura decidida a propósito

- **Carril de contenido: 68 rem** (`--ancho`, el token que ya usan ocho pantallas del portal
  y con el que se alinea la barra de navegación). Son 1088 px, prácticamente lo mismo que
  LinkedIn (1128). **Subir esta pantalla a 68 rem no la ensancha sola: la alinea con el resto
  del portal.** ⚠️ Se cambia el `max-width` de esta pantalla, **nunca el valor del token
  `--ancho` en `mundo.css`**: de él cuelgan la cabecera y las otras ocho páginas.
- **Portada a sangre (100 vw)**, rompiendo el carril. Es lo que da la sensación de «ocupa toda
  la pantalla» sin llevarse por delante la medida de lectura.
- **Columna principal (≈ 2/3):** Acerca de → Experiencia → Educación → Aptitudes → Idiomas →
  Certificaciones.
- **Columna lateral pegajosa (≈ 1/3):** el medidor de completitud, el estado de la lectura del
  CV, el panel de «datos por revisar», la pretensión salarial y un índice de secciones.
- **Por debajo de 900 px: una sola columna**, con la lateral colapsando arriba (el aviso de
  «te toca a ti» no puede quedar al final en teléfono). La gente entra por los dos sitios.

### 4.3 El fondo de pantalla · sí, pero no una foto

La clienta pide «quizá un fondo». Dos cosas hay que decir:

⚠️ **Una imagen con el nombre encima está prohibida por el sistema de diseño.** La regla del
canto: *«el color vive en el canto; el campo donde hay prosa se queda en nube»*. No hay texto
sobre color en ninguna pantalla del portal. Una portada tipo LinkedIn con el nombre encima
rompe eso y de paso el contraste.

**La forma correcta:** la portada es una banda decorativa **sin nada escrito dentro**, y el
nombre va **debajo**, sobre blanco. Tres opciones, de menos a más trabajo:

1. **Canto atmosférico** (recomendada, cero backend): una banda de bruma con el espectro del
   canto —menta → aqua → rosa → violeta— difuminado en el borde inferior. Es el mundo visual
   del portal aplicado a la pantalla que hoy no lo tiene. ⚠️ Ojo: en «Mis procesos» ese mismo
   gradiente significa *avance por etapas*; aquí tiene que ir **difuso y sin tramos**, o
   empieza a sugerir un progreso que no existe.
2. **Cuatro portadas a elegir**, del mismo mundo. Da personalización sin subir archivos: la
   elección se guarda como un código en la cabecera del perfil. Backend mínimo (un campo).
3. **Portada subida por el candidato.** El trabajo entero de imágenes (subida, tipos, recorte,
   moderación) para lo que menos aporta. **No se recomienda.**

### 4.4 Medidor de completitud

Una barra en la lateral: «Tu perfil está al 60 %» y las dos cosas que más suman. Es lo que
hace que la gente llene el perfil, y es frontend puro.

⚠️ **Neutral, nunca una regañina y nunca una puerta.** Nada del perfil es obligatorio y nada
bloquea postular (RF-156). Ni rojo, ni «perfil incompleto», ni un candado. Verde de hecho
cuando está lleno y gris cuando no.

### 4.5 Las aptitudes, como etiquetas

De `input` con comas a **chips**: se escribe, Enter añade, cada una con su × . Es el cambio
que más se nota por menos código, y lo que hace que una pantalla se lea como perfil.

### 4.6 «Así te ven»

Un botón que enseña el perfil en modo lectura, tal como lo verá el equipo. **No hay un
componente que reutilizar** —la ficha del panel no está construida (§2.1)—, así que son los
mismos componentes de esta pantalla en modo lectura. Sigue siendo frontend puro, y contesta la
única pregunta que se hace quien llena un perfil.

### 4.7 Separar «Mi perfil» de «Mi cuenta»

Cerrar sesión, descargar mis datos y privacidad salen a `/cuenta`. La barra de navegación
sigue diciendo «Mi cuenta» y ofrece las dos.

⚠️ **Cerrar sesión no puede quedar escondido.** Se puso donde está justamente porque antes
estaba enterrado bajo tres acciones irreversibles. Tiene que seguir a un clic desde la barra
de arriba, y seguir estando en la pantalla de fallo del perfil.

### 4.8 Lo demás, por orden de valor

- **Arrastrar para reordenar** experiencia y educación (el endpoint ya existe), conservando los
  botones ↑↓ para teclado — es un requisito de accesibilidad del proyecto.
- **Línea de tiempo** en Experiencia: filete vertical, «Actualidad» cuando `hasta` es `null`,
  duración calculada.
- **Logotipos de empresa y universidad:** ❌ no. Requiere un servicio externo de logotipos y
  filtra a terceros a qué empresas mira este sistema.
- **Estados vacíos con una frase y un botón**, uno por sección, en vez de secciones que
  aparecen vacías sin explicación.

### 4.9 Lo que NO se toca

1. **La marca «Sin confirmar» y la distinción origen persona / currículum.** Legible sin
   color, con la palabra dentro de la píldora. Es lo que separa este perfil de uno normal.
2. **El violeta significa una sola cosa: «te toca a ti».** El botón «Editar perfil» **no** es
   violeta; la cabecera **no** es violeta. Hoy el único violeta de la pantalla es el panel de
   datos por revisar y así se queda.
3. **Nada obligatorio, nada bloqueado.**
4. **La pretensión salarial** sigue siendo solo del candidato y de quien tenga el permiso.
5. **Mulish, solo tema claro.**

---

## 5 · Lo que hay que decidir antes de programar

| # | Decisión | Quién |
|---|---|---|
| 1 | **Foto: A, B o C** de la tabla de §2.1. Si es C, hay RF nuevo y cambio de consentimiento | Clienta + Renaser |
| 2 | Portada: canto atmosférico, cuatro a elegir, o ninguna | Clienta |
| 3 | ¿Se abre un endpoint para **subir el CV desde el perfil**? Es lo que la gente espera | Renaser |
| 4 | ¿De dónde sale el **nombre** en la cabecera? Hace falta que el backend lo devuelva | Backend |
| 5 | Ubicación: ¿`ciudad_ubigeo` o el texto libre? | Backend |
| 6 | ¿Se separa «Mi cuenta» del perfil? | Clienta |

---

## 6 · Plan por fases

**Fase 1 — Rediseño puro (sin backend).** Cabecera de identidad con iniciales, dos columnas a
68 rem, portada de canto, aptitudes como chips, medidor de completitud, «Así te ven», línea de
tiempo, estados vacíos, arrastrar para reordenar. **Es la mayor parte de lo que la clienta
pide y no depende de ninguna decisión pendiente.**

Entran en la fase dos cosas que no se ven en una maqueta:

- **Reescribir `Perfil.test.tsx`** (286 casos y selectores). Una reestructura a dos columnas
  más los chips rompe buena parte de sus consultas; es trabajo de la fase, no un imprevisto.
- ⚠️ **Comprobar el resultado en pantalla necesita a la clienta o a quien tenga cuenta.** El
  perfil vive detrás del ingreso y aquí no se escriben contraseñas de nadie. O bien alguien
  entra y mira, o bien se levanta la base local de diagnóstico con su acceso de desarrollo
  para poder verlo sin credenciales reales.

**Fase 2 — Los huecos de backend.** El nombre en la sesión, la ubicación resuelta, subir el CV
desde el perfil.

**Fase 3 — La foto**, si se aprueba: columna, endpoint, tipos de imagen, recorte, y la decisión
de si el panel la ve.

---

## 7 · Sobre Bumeran como referencia

Su perfil de postulante está tras el ingreso y no se ha entrado a ninguna cuenta, así que aquí
no se describe pantalla por pantalla. Lo que sí es patrón común del sector —y ya está recogido
arriba— es la cabecera con foto y titular, el perfil dividido en secciones editables una a una,
el medidor de completitud y el CV colgando del perfil y no de cada postulación.

**Y una diferencia que conviene no perder de vista:** en Bumeran y en LinkedIn el perfil es lo
que se juzga. Aquí no: lo que decide son las pruebas, y el perfil no puntúa (RF-164). El
rediseño puede tomar prestada su forma, pero la pantalla no debe empezar a insinuar que llenar
mejor el perfil mejora las opciones de nadie.

---

## 9 · Lo que se decidió y se construyó · 05/09/2026

Las seis decisiones de §5, resueltas por el usuario, y lo que salió de cada una.

| # | Decisión de §5 | Lo que se decidió | Dónde vive |
|---|---|---|---|
| 1 | Foto: A, B o C | **Solo la ve el candidato** (opción B). Ni el panel ni la IA. Es el flanco del RF-41: esconderle la cara a la IA y enseñársela a quien decide desharía la regla por la puerta de al lado | `PintorDePerfil.sinLoDelCandidato`, con test propio |
| 2 | Portada | **Galería y foto propia**, excluyentes. Cinco fondos derivados de los tokens `--canto-*` | `PortadasDeLaCasa`, `Cabecera.tsx` |
| 3 | Subir el CV desde el perfil | **Sí**, y además **se lee al subirlo**, sin esperar a que postule | `POST /portal/perfil/cv` → `lectura_cv_perfil` |
| 4 | De dónde sale el nombre | **Del backend, por dos caminos**: al entrar, y con `GET /portal/auth/sesion` cuando el portal arranca de un token guardado | `DtosPortal.QuienSoy`, `Sesion.tsx` |
| 5 | Ubicación | Se queda el **texto libre** del perfil: `ciudad_ubigeo` solo existe para quien se registró después del 01/09 | sin cambios |
| 6 | Separar «Mi cuenta» | **No se separa.** Cerrar sesión baja al pie de la pantalla, que es donde no compite con nada | `Perfil.tsx` |

**Y una decisión de producto que no estaba en la tabla:** al postular, quien tenga currículum
en su perfil no vuelve a subirlo; si sube otro, ese vale **solo para esa vacante** y el del
perfil no cambia. El archivo se **copia** sellado con la organización de la vacante en vez de
compartir la fila, que es el fallo que arregló la V48 visto desde el otro lado.

### Lo que se encontró por el camino y también se arregló

Ninguna de estas estaba en el plan; salieron al verificar.

- **Se pagaba dos veces la misma lectura** (RF-161): quitar el currículum borraba el historial
  de lecturas, así que volver a subir el mismo PDF llamaba al modelo otra vez. Ahora las
  lecturas no se borran nunca —son el recibo— y la pantalla busca por el archivo que hay.
- **Una lectura cerrada resucitaba**: el trabajo seguía en la cola después de cancelarla, y al
  terminar volcaba al perfil los datos de un currículum que la persona acababa de borrar.
- **El nombre no llegaba en la segunda visita**: con el token guardado y sin nombre en
  `localStorage`, la cabecera decía «Tu perfil» sobre un disco de iniciales vacío.
- **Las aptitudes pegadas se guardaban como una sola**: escribir «Excel, Power BI, SQL» y
  pulsar Guardar sin Enter creaba una aptitud con comas dentro.
- **Los cinco `input[type=file]` no tenían nombre**, y son enfocables; los botones del diploma
  tampoco decían sobre qué actuaban, contra la regla que el propio `Listas.tsx` escribe.
- **La limpieza de cuentas de prueba no conocía las tablas nuevas**, así que dejaba la lectura,
  sus trabajos de IA y los archivos del perfil colgando en la base desechable.

### Lo que sigue pendiente, y no es un olvido

- **La ficha del perfil en el panel no se construye aquí.** El endpoint existe desde agosto y
  ninguna pantalla lo consume. «Solo el candidato» no significa «el panel lo enseña todo menos
  la foto»: significa que cuando esa ficha se construya, nacerá sin foto y sin diplomas.
- **El recorte interactivo de la foto** —arrastrar y hacer zoom— queda fuera a propósito. Se
  sube ya encuadrada al centro y recomprimida a 512 px, que de paso descarta los EXIF.
- **RF-169: el consentimiento actual no cubre el perfil**, y la foto lo hace más urgente. Queda
  anotado; no se resuelve aquí.
- **El bucket de producción se llama `curriculums`** y las imágenes irían al mismo. Decidir si
  se separa antes de desplegar.
