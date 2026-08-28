# La versión móvil, para Google Play

**28/08/2026** · rama `feat/versionMovil` · **probado en el emulador: los tres riesgos pasan**

## Lo que se midió corriendo, y qué salió

`node herramientas/probar-en-android.mjs` contra el emulador, con la app instalada y hablando
con el Spring local: **14 comprobaciones, 14 bien**. Los tres riesgos que sostenían el diseño
**no se materializan**, así que **ninguna de las tres salidas de emergencia hace falta**:

| Riesgo | Resultado |
|---|---|
| **El multipart** | Pasa entero: las cinco partes, el nombre del archivo, su contenido y los campos de texto. **No hay que volver a `fetch` ni pedirle CORS a Vercel** |
| **La cabecera `Date`** | Llega y es una fecha válida. El cronómetro sigue viviendo del reloj del servidor |
| **`application/problem+json`** | El `Content-Type` conserva «json» y el cuerpo trae el `detail` de Spring |

Y dos cosas más que se vieron mirando:

- **Sin red la app abre entera y lo explica** —«No pudimos conectar. Revisa tu conexión», con
  reintentar—. Es exactamente lo que justificó empaquetar en vez de cargar la web, que ahí
  habría dado pantalla en blanco. De paso confirma que la capa nativa convierte un fallo de red
  en el mismo `ErrorApi(0, …)` que el navegador.
- **El teclado empuja el contenido** y el campo enfocado queda visible con su anillo violeta.

### Y el recorrido entero, con Maestro

`node herramientas/e2e-android.mjs` — **pasa**. Abre la app, recorre la lista que viene del
backend, entra a una vacante, **crea una cuenta de verdad**, y entonces **mata la aplicación y
la vuelve a abrir sin limpiar nada**: la sesión sigue puesta.

⚠️ **No se lanza `maestro` a mano.** El envoltorio existe porque Maestro sabe recorrer la app
pero no deshacer lo que la app escribió, y crear la cuenta es la única forma de probar lo de
arriba. `e2e-android.mjs` le pasa un correo de usar y tirar y **borra la cuenta al terminar,
pase o falle** —la limpieza va en un `finally`, que es justo cuando más falta hace—, igual que
el `restaurar()` de `e2e-simulacion-permisos.mjs`. Al acabar dice cuántas cuentas quedan; si no
puede limpiar, lo grita en vez de callar.

⚠️ **La limpieza borra también las filas de auditoría de esa cuenta**, y es la única excepción a
la regla de no tocar la auditoría en este proyecto: el sujeto entero es de mentira, y la clave
ajena impide borrar la cuenta sin ellas. Solo alcanza a correos `maestro.%@example.com` — el
dominio está reservado por la RFC 2606 justamente para esto.

Ese último paso es la razón de ser del cambio de almacenamiento, y es lo único que lo prueba en
el flujo real y no en una sonda.

⚠️ **Maestro exige que el texto coincida ENTERO.** Un `assertVisible: 'Tu próximo trabajo'`
falla sobre «Tu próximo trabajo puede empezar aquí.», y el fallo se lee como si la pantalla
estuviera rota. Todo va como expresión regular con `.*`.

⚠️ **Todo `tapOn` necesita su `scrollUntilVisible` antes.** `assertVisible` se conforma con que
el elemento exista en la jerarquía, pero `tapOn` toca coordenadas: sobre algo que asoma por el
borde, **el toque se da por hecho y no pasa nada**, y el fallo aparece dos pasos después, donde
no está la causa. Costó dos vueltas.

⚠️ **Y una aserción se afirmaba sobre un dato, no sobre la pantalla.** Pedía «Lo que harás» en
la ficha de la vacante, que solo se pinta si la vacante tiene responsabilidades escritas — y la
primera de la base local no las tiene. Se afirma sobre lo que toda ficha trae.

⚠️ **`Preferences` escribe con `editor.apply()`**, que vuelve enseguida y termina en disco por
otro hilo. La primera versión de la sonda mataba la app inmediatamente después de escribir y el
token se perdía: **era un fallo de la sonda, no del producto**, y con metro y medio de margen
sobrevive. Lo que sí queda dicho: un cierre forzado en el primer segundo tras entrar puede
perder el token, y quien lo sufra tendrá que volver a entrar. La exposición real es mínima y no
se intenta arreglar — `apply()` está dentro del plugin.

---

**El estado antes de probar** (todo sigue valiendo):

| Hecho | Pendiente |
|---|---|
| La puerta con su origen y su almacén, con 7 pruebas propias | Probar en un dispositivo: subida del currículum, `Date`, `problem+json` |
| El almacén nativo y la siembra antes de montar React | El icono adaptativo y los gráficos de la ficha |
| El proyecto `android/`, con sus App Links y sin copia de seguridad de los tokens | El texto legal de Renaser en la política pública, y un correo de empresa |
| Mulish empaquetada, sin Google Fonts | La huella SHA-256 en el `assetlinks.json` |
| La política de privacidad pública, en `/politica-de-privacidad` | Firmar y generar el `.aab` de subida |

**236 pruebas en verde, tipado limpio, y las capturas del portal y del panel rehechas** tras el
cambio de tipografía.

El `app-debug.apk` (4,3 MB) se compiló y se abrió para comprobar lo que lleva dentro: el bundle
de `build:movil` **con el origen horneado**, las dos fuentes, `allowBackup=false` y los tres
App Links con `autoVerify`.

⚠️ **El `assetlinks.json` NO viaja dentro del APK, y está bien así**: el
`ignoreAssetsPattern` de `build.gradle` descarta lo que empieza por punto. Ese archivo es del
servidor web, no de la aplicación.

**236 pruebas en verde, tipado limpio, y las 39 capturas del panel más las 15 del portal
rehechas** tras el cambio de tipografía.

El portal que hoy vive en Vercel se empaqueta como aplicación de Android y se publica en
Google Play. **No es un producto nuevo ni un rediseño: es empaquetado.** El mismo código,
dentro de un contenedor nativo.

---

## Decisiones

Las cinco que se tomaron antes de escribir esto, con lo que cada una descartó.

| Decisión | Qué descarta |
|---|---|
| **Capacitor con la app dentro del paquete** | La carcasa que carga la web de Vercel, y la reescritura en React Native |
| **La app lleva candidato y panel**, no solo el candidato | Dos aplicaciones separadas en Play |
| **v1 sale sin notificaciones push**, pero el empaquetado se elige para admitirlas | El contenedor tipo TWA, que no las da bien |
| **Los enlaces del correo abren la app** (App Links) | Entrar solo con contraseña en el teléfono |
| **Todo en este mismo repositorio** | Un repositorio aparte para lo nativo |

⚠️ **Lo de Expo no aplica.** EAS Build construye proyectos de React Native; no sabe construir
esta aplicación de Vite. No hace falta: el SDK de Android ya está instalado en la máquina
(`~/Android/Sdk`, build-tools 35 y 36, plataformas 35/36/36.1, NDK y emulador), así que el
`.aab` sale de Gradle en local.

⚠️ **El repositorio separado no es una preferencia, es que Capacitor no lo admite.** Espera
`android/` en la raíz, junto al `package.json`, y `npx cap sync` **copia** el `dist/` ya
construido dentro de ese proyecto. Con dos repositorios habría que transportar ese `dist/` en
cada cambio, y este proyecto ya tiene cinco fixturas y cuatro scripts documentados que se
quedaron atrás sin avisar; un segundo repositorio con una copia del portal dentro sería el
sexto caso.

---

## Qué archivos existentes se tocan, y cuáles no

**Ningún archivo de `src/panel/` cambia.** El panel habla con el backend a través de
`crearPuerta('/api/v1/panel', …)`, que vive en `puerta.ts`; su propio código no se entera.

| Archivo | Qué cambia | Qué pasa en la web |
|---|---|---|
| `src/api/puerta.ts` | Un prefijo delante del `fetch`, y los tres `localStorage` pasan por un almacén inyectado | El prefijo es cadena vacía y el almacén es `localStorage`: la misma URL y las mismas llamadas de hoy |
| `src/main.tsx` | Una espera antes de `createRoot`, para sembrar los tokens nativos | En web esa función retorna de inmediato; no hay render diferido |
| `src/app/App.tsx` | Una `<Route>` nueva, pública, para la política que Play exige | Se añade. Ninguna ruta existente se modifica |
| `src/rutas.ts` | Una entrada nueva para esa ruta | Igual |
| `src/app/Armazon.tsx` | El título de pestaña de la ruta nueva | Igual |
| `index.html` | Se quita el enlace a Google Fonts | La tipografía pasa a venir del propio sitio |
| `src/estilos/mundo.css` | Los `@font-face` de Mulish | Igual |
| `package.json` | Dependencias nuevas y un script `build:movil` | Los scripts actuales no se tocan |

**`vercel.json` no se toca**: se creyó que había que excluir `.well-known/` del comodín y
resultó ser falso — ver la sección 5.

⚠️ **El `dist/` que Vercel sirve no engorda por Capacitor.** Su código se carga con un
`import()` dinámico condicionado a estar en la app; en la web ese `import` nunca se ejecuta y
el empaquetador lo deja fuera. Lo único que suma es la tipografía.

---

## 1 · Qué se añade al repositorio

```
capacitor.config.ts     nuevo, en la raíz
android/                nuevo, proyecto Gradle generado por Capacitor, versionado
public/.well-known/     nuevo, para el assetlinks.json de los App Links
public/tipografia/      nuevo, los archivos de Mulish
```

### ⚠️ La tipografía deja de venir de Google Fonts

Hoy `index.html` la pide a `fonts.googleapis.com`. Una aplicación instalada no puede quedarse
sin sus titulares porque el teléfono no tenga cobertura en ese momento, así que **Mulish viaja
dentro del paquete** y se declara con `@font-face` en `mundo.css`.

Es el único cambio de esta tanda que se nota también en la web, y ahí también mejora: deja de
depender de un servidor de terceros y desaparecen las dos conexiones previas (`preconnect`)
del arranque. Cuesta unos 100 KB en el `dist/`.

**Se empaquetan solo los pesos que se usan.** `mundo.css` pide 200 en titulares; hay que mirar
qué otros pesos aparecen de verdad antes de meter la familia entera, que son megabytes.

El ciclo no cambia de forma: `npm run build` sigue produciendo `dist/`, y `npx cap sync` lo
copia dentro de `android/`. **Ninguna pantalla se mueve, ninguna hoja de estilo se reescribe.**

`android/` trae su propio `.gitignore` y excluye tanto los artefactos de Gradle como el
`dist/` copiado en `app/src/main/assets/public`: no se versiona nada generado.

**Vercel no se entera** —su construcción es `npm run build`— y el `ci.yml` actual (tipado,
pruebas, compilar) sigue valiendo sin tocar una línea.

⚠️ **Antes de generar `android/`, comprobar que el identificador está libre en Play**: abrir
`https://play.google.com/store/apps/details?id=com.renaser.ex` y confirmar que responde «no se
encontró». Después no vale: `npx cap add android` escribe ese identificador en `build.gradle`,
en el manifiesto y en el árbol de paquetes de Java, y deshacerlo deja de ser una línea de
configuración para convertirse en un barrido a mano por varios archivos.

### Por qué `android/` se queda en la raíz

Se consideró agruparlo bajo una carpeta propia (`movil/android`), y **sí se puede**:
`capacitor.config.ts` admite `android: { path: … }`. Se descartó porque agrupa poco y cuesta
algo: el propio `capacitor.config.ts` tiene que quedarse en la raíz de todos modos, y
`assetlinks.json` y la tipografía son activos **web** que viven en `public/` porque Android
pide el primero en la raíz del sitio. O sea, se movería una sola carpeta, a cambio de que
ninguna guía ni ejemplo de Capacitor coincida con la estructura del repositorio el día que
algo falle. Si un día se prefiere lo contrario, es una línea del config.

### Gradle se ejecuta con el JDK 21, que ya está en la máquina

```bash
cd android && JAVA_HOME=/home/n4nd0/Applications/android-studio/jbr ./gradlew assembleDebug
```

Se dijo «JDK 17» durante el diseño y **es falso**: Capacitor 8 compila contra
`JavaVersion.VERSION_21` (AGP 8.13, compileSdk 36, minSdk 24). Y el 25, que es el que está por
defecto en el sistema, **tampoco vale**: se probó y Gradle 8.14.3 revienta con
`Unsupported class file major version 69` —Gradle solo soporta Java 25 desde su 9.1—.

**No hay que instalar nada**: Android Studio trae su propio JDK 21.0.10 en
`~/Applications/android-studio/jbr`, y con él la compilación pasa.

⚠️ **`JAVA_HOME` va delante del comando, no en el perfil.** Así el JDK del sistema sigue siendo
el 25 y el backend —que es otro repositorio y sí es Java— no se entera de nada. Este
repositorio no ejecuta Java en ningún momento: el portal y el panel son TypeScript.

⚠️ **Subir Gradle a 9.1 para usar el 25 no compensa**: arrastra la compatibilidad del plugin de
Android y saca el proyecto de la combinación que Capacitor prueba, a cambio de nada.

---

## 2 · La puerta, y a dónde apunta

Todo el portal y todo el panel pasan por **un solo `fetch`**, en `src/api/puerta.ts:141`. Es
el único sitio del código que cambia.

```ts
// Vacío en la web: la ruta sigue siendo relativa y la reescriben Vite en
// desarrollo y `vercel.json` en produccion, igual que hoy. Con valor en la app
// instalada, que no tiene ningun servidor delante.
const ORIGEN = import.meta.env.VITE_ORIGEN_API ?? ''

respuesta = await fetch(`${ORIGEN}${base}${ruta}`, { … })
```

Se construye con `VITE_ORIGEN_API=https://<dominio-vercel> npm run build`, en un script
`build:movil` del `package.json`.

**Y ese origen es el de Vercel, no el del backend.** `CLAUDE.md` documenta que la dirección
`18-204-177-210.nip.io` es provisional y que el día que Renaser tenga dominio se cambia una
línea de `vercel.json`. Si esa IP viaja dentro del `.aab`, ese día **las aplicaciones ya
instaladas dejan de funcionar** y hace falta publicar una versión nueva. Apuntando a Vercel,
sigue siendo una línea y nadie tiene que actualizar nada.

Las peticiones salen por la capa nativa de Android, no por el navegador de la WebView:

```ts
// capacitor.config.ts
plugins: { CapacitorHttp: { enabled: true } }
```

Eso parchea `fetch` a nivel nativo y **por eso no hay CORS que pedirle al backend** — la regla
de `CLAUDE.md` queda intacta sin tocar Spring.

### ⚠️ Dos cosas que ese parche puede romper, y que se prueban, no se suponen

Las dos ya costaron un fallo documentado en este proyecto:

1. **La cabecera `Date`.** `anotarHoraDelServidor(respuesta.headers.get('Date'))`
   (`puerta.ts:159`) es de donde sale la hora del servidor con la que corre el cronómetro de
   la prueba. Si la capa nativa no expone esa cabecera, el cronómetro vuelve a depender del
   reloj del teléfono, que es exactamente lo que se arregló.
2. **`application/problem+json`.** `leerCuerpo()` busca `json` a secas justo porque Spring
   manda ahí sus errores. Si la capa nativa normaliza el `Content-Type`, todos los mensajes
   del backend vuelven a perderse — el fallo que estuvo meses sin diagnosticar.

⚠️ **Y las dos pruebas de unidad que hay en `puerta.test.ts` NO cubren este riesgo, aunque lo
parezca.** Sustituyen `fetch` por uno de mentira dentro de jsdom, donde `CapacitorHttp` no
existe: pueden ponerse rojas si alguien borra la llamada a `anotarHoraDelServidor`, que ya es
algo, pero **nunca pueden detectar que la capa nativa se coma la cabecera**. La única guardia
real de esto es la comprobación en dispositivo, y sigue pendiente. Leer esas pruebas en verde
como prueba de que el parche es seguro sería exactamente el fallo de «indicadores que mienten»
que este proyecto ya tiene documentado.

---

## 3 · La sesión

Hoy el token vive en `localStorage` (`puerta.ts:113`). En una WebView eso lo borra el sistema
al limpiar caché o al quedarse sin espacio: quien lo sufra **pierde la sesión a mitad de una
evaluación**. Pasa a almacenamiento nativo (`@capacitor/preferences`, que por debajo es
`SharedPreferences`).

⚠️ **Choca con que `leerToken()` es síncrono y el almacenamiento nativo no lo es.** No se
resuelve volviendo asíncrona la puerta —eso tocaría todas las pantallas—, sino así:

- `puerta.ts` recibe un **almacén** con tres operaciones síncronas (`leer`, `escribir`,
  `borrar`). En la web es `localStorage`, como hoy.
- En la app, ese almacén guarda los tokens **en memoria** y persiste en segundo plano.
- `main.tsx` **lee los tokens nativos antes de montar React** y siembra esa memoria. Sin eso,
  el primer render no sabría que hay sesión y rebotaría a la entrada.

Las dos sesiones —candidato (`renaser_portal_token`) y equipo (`renaser_panel_token`)— siguen
siendo independientes, con su propia clave. Un 401 de una no puede cerrar la otra, que es la
razón por la que existen dos puertas.

⚠️ **Solo se mueven los tokens, no todo lo que hay en `localStorage`.** `src/app/Sesion.tsx` y
`src/panel/Sesion.tsx` también guardan ahí el nombre que se enseña en la cabecera. Se quedan
como están: perder un token echa a alguien de una evaluación a medias, y perder el nombre solo
hace que la cabecera deje de saludar hasta el siguiente ingreso. **Esos dos archivos no se
tocan.**

---

## 4 · La subida de archivos

Hay dos, y las dos viajan como `FormData` crudo, **sin cabecera de tipo a propósito**: es el
navegador quien pone la frontera del multipart (`Opciones.formulario`, `puerta.ts:96`).

**Son tres, no dos** —el spec decía dos y faltaba justo la más difícil—:

| Qué | Dónde | Qué manda |
|---|---|---|
| El currículum | `src/api/portal.ts:57` | El archivo **más cinco campos de texto** en el mismo multipart |
| Un entregable de la prueba | `src/api/prueba.ts:22` | Un archivo suelto |
| El Excel del banco | `src/panel/api/panel.ts:281` | El archivo más dos campos de texto |

✅ **Probado en el emulador y pasa.** La sonda 3 de `probar-en-android.mjs` reproduce la forma
exacta de la primera —la difícil— contra un servidor de eco que devuelve lo que le llegó: la
frontera del multipart se conserva, llegan las cinco partes, y el archivo mantiene nombre y
contenido. La salida de emergencia de abajo **no hace falta**; se deja escrita por si un día
cambia la versión de Capacitor.

**Es el punto flojo conocido de la capa nativa de HTTP, y es lo primero que se prueba en un
teléfono de verdad**, antes de construir nada encima. Si la frontera del multipart se
estropea, las dos se rompen.

**La salida, si falla:** esas dos rutas —y solo esas— vuelven al `fetch` normal contra el
origen de Vercel, y es **Vercel**, que sí controlamos, quien añade la cabecera de CORS en su
configuración. El backend sigue sin tocarse en ninguno de los dos caminos.

⚠️ **Segunda cosa a comprobar ahí mismo:** el selector de archivos de Android no siempre
informa del tipo de un `.docx` como lo hace un escritorio. `elegirArchivo()` rechaza por tipo
con un mensaje que nombra el archivo; si el selector miente, la app rechaza currículums
válidos y le echa la culpa al candidato.

---

## 5 · Los enlaces del correo (App Links)

Tres direcciones tienen que abrir la app: `/acceso?token=…` (entrada del candidato sin
contraseña), `/invitacion?token=…` y `/admin/invitacion?token=…` (invitación al panel).

Hacen falta dos piezas:

1. **`public/.well-known/assetlinks.json`**, con el identificador (`com.renaser.ex`) y la
   huella SHA-256 de la clave de firma que gestiona Play.
2. **Los `intent-filter` con `autoVerify`** en `AndroidManifest.xml`, para esas tres rutas.

⚠️ **El origen que va dentro del `.aab` y el sitio donde vive el `assetlinks.json` tienen que
ser el mismo dominio.** Hoy los dos son `renaser-os-postulantes.vercel.app`. El día que Renaser
tenga dominio propio hay que mover las dos cosas a la vez y declarar **los dos hosts** en los
`intent-filter` mientras haya apps instaladas apuntando al viejo. Olvidarlo no rompe la app: se
manifiesta meses después como «el enlace del correo abre Chrome».

### El comodín del `vercel.json` NO se lo come — comprobado

Durante el diseño se dio por hecho que la segunda regla de `vercel.json` —que manda todo lo
que no empieza por `api/` al `index.html`— se tragaría el `assetlinks.json` y devolvería HTML
donde Android espera JSON. **Es falso, y `vercel.json` no se toca.**

Vercel aplica las reescrituras **después** de comprobar el sistema de archivos: un archivo real
se sirve directo y la regla ni se evalúa. La prueba está en el propio despliegue de hoy —
`/assets/index-*.js` encaja en ese mismo comodín y se sirve como JavaScript; si no fuera así,
el portal estaría roto ahora mismo.

⚠️ **Y Vite sí copia la carpeta que empieza por punto.** Era la otra duda; se resolvió
mirando el `dist/` construido, no suponiéndolo: `public/.well-known/assetlinks.json` aparece en
`dist/.well-known/assetlinks.json`.

⚠️ **No se puede probar de punta a punta**: el backend tiene `renaser.correo.transporte` en
`log`, así que hoy ningún correo sale de verdad. Se prueba disparando el enlace contra el
dispositivo con `adb shell am start -a android.intent.action.VIEW -d "…"`.

---

## 6 · El panel dentro de la misma app

Va incluido, como se decidió. **Ya es alcanzable sin barra de direcciones**: el pie del portal
tiene «Entrar al panel de empresas» (`Armazon.tsx:135`). No hay que inventar ninguna entrada.

⚠️ **Google revisa lo que hay detrás de la sesión.** En la ficha hay que darles credenciales
de demostración —una cuenta de candidato y una del panel— o rechazan la app por no poder
revisarla.

Queda dicho, porque se decidió a sabiendas: el panel no está compuesto para un teléfono. El
ranking es una tabla ancha con scroll horizontal y el banco de preguntas se llena importando
un Excel. En la práctica el equipo lo seguirá usando en el escritorio; en el teléfono está
disponible, no optimizado. **Componer el panel para móvil no es de esta tanda.**

---

## 7 · Lo que Play exige y no es código

**El hueco más real:** Play pide una URL de política de privacidad **abierta, sin sesión**, y
`/privacidad` está dentro de `<Privada>` (`App.tsx:213`). Además, para una aplicación con
cuentas, Play exige **borrado de cuenta desde dentro de la app y también desde una web
accesible sin instalarla**. Lo primero ya existe (`pedirBorrado`); lo segundo no.

Las dos cosas se resuelven con **una página pública nueva** —la política, y cómo pedir el
borrado— dejando `/privacidad` como está: allí viven las acciones, que sí necesitan sesión.

El resto es trámite:

- Formulario de seguridad de datos: se recoge nombre, correo, currículum y respuestas de
  evaluación. El consentimiento de la ley 29733 ya está en el flujo de postular.
- `targetSdk` 35 o 36; las dos plataformas están instaladas.
- `.aab` (no `.apk`), firmado con la firma gestionada por Play.

### El `.aab` se genera y va firmado

`gradlew bundleRelease` produce `android/app/build/outputs/bundle/release/app-release.aab`
(3,2 MB), con `META-INF/SUBIDA.RSA` dentro.

| Qué | Dónde |
|---|---|
| La llave de subida | `~/llaves/renaser-ex-subida.jks` — **fuera del proyecto a propósito** |
| Su contraseña y su alias | `android/keystore.properties`, que está en `.gitignore` |
| Validez | Hasta enero de 2054 (RSA 4096) |
| Huella SHA-256 de la llave de subida | `73:90:10:70:9B:A9:EA:A9:17:C2:C7:3C:99:C0:A2:81:BA:5C:A3:C0:C6:83:75:18:FA:60:5B:25:93:0C:FC:C0` |

⚠️ **Esa huella NO es la que va en el `assetlinks.json`.** Con la firma gestionada por Play,
Google genera **otra** llave —la de firma de la app— y reempaqueta lo que se sube; los teléfonos
verifican contra esa, no contra la de subida. La que hay que copiar al `assetlinks.json` sale de
Play Console → Integridad de la app, **después** de subir el primer paquete. Poner la de subida
es el error clásico, y el síntoma es que los enlaces del correo abren Chrome sin decir por qué.

⚠️ **Si se pierde la llave de subida, no hay copia.** Google puede reiniciarla, pero es un
trámite; guardarla fuera del portátil es parte del trabajo.

⚠️ **Sin `keystore.properties`, la compilación sigue funcionando y el paquete sale sin firmar.**
Es a propósito: quien clone el repositorio tiene que poder compilar sin pedirle la llave a nadie.
Lo que no puede es subir eso a Play.

### ⚠️ La trampa que casi manda localhost a Play, y la guarda que la cierra

`bundleRelease` **empaqueta lo que encuentre en `assets/public` y no reconstruye los archivos
web**. Ocurrió aquí: el primer `.aab` se generó justo después de un `npm run build:emulador`, y
llevaba dentro `10.0.2.2:8081`. Compiló sin un aviso, pesaba lo mismo y parecía perfecto.

Ahora `build.gradle` tiene una tarea que corre antes de `bundleRelease` y `assembleRelease`, y
**revienta la compilación** en dos casos:

| Qué caza | Cómo llega ahí |
|---|---|
| El paquete lleva `10.0.2.2` | Se empaquetó tras `npm run build:emulador` |
| El paquete no lleva ningún origen | Se empaquetó tras `npm run build` a secas; las rutas quedarían relativas y la app se pediría los datos a sí misma |

El mensaje nombra el archivo culpable y dice qué comando corregir. Comprobado: se pone roja con
el estado que produjo el fallo, y pasa tras `npm run build:movil`.
- `versionCode` y `versionName` en `android/app/build.gradle`, atados a la versión del
  `package.json`.

---

## 8 · Cómo se comprueba

**`npm test` sigue siendo el contrato** —**229 pruebas en 19 archivos**, medido hoy en este
worktree; `CLAUDE.md` todavía dice 49 y se ha quedado atrás—, más pruebas nuevas sobre la
puerta:

- que en la web el origen siga vacío y la ruta siga siendo relativa,
- que en la app lleve el origen de Vercel,
- que la hora del servidor se siga anotando,
- que un error `application/problem+json` siga llegando con su mensaje.

⚠️ **Ningún script existente cubre nada de esto.** Los `capturar-*.mjs` interceptan las
respuestas y corren en un Chrome de escritorio a densidad 1. Va una lista corta de
comprobación **en dispositivo o emulador**, que es donde estas cosas se ven:

1. Subir un currículum en PDF y otro en `.docx`.
2. El cronómetro de la prueba, apagando la pantalla en medio y volviendo.
3. El teclado tapando el campo activo en la evaluación.
4. El enlace del correo, disparado con `adb`.
5. Qué se ve sin red: tiene que abrir la app y explicarse, no quedarse en blanco.

---

## 9 · Lo que queda fuera, y por qué

| Qué | Por qué |
|---|---|
| **Notificaciones push** | Se decidió sacar v1 sin ellas. El backend no tiene dónde guardar el token del dispositivo ni quién dispare el envío. El empaquetado elegido las admite sin rehacerse |
| **iOS** | La petición es Play. Capacitor lo permitiría después; no se diseña ahora |
| **Rediseño móvil** | El portal ya compone en 375 px y las capturas ya se hacen a ese ancho. Si se cuela, el alcance se dispara |
| **Actualizaciones en caliente** | Cada cambio pasa por una versión de Play. Simplifica la revisión y evita una dependencia más |

### El contrato del push, para poder pedirlo sin ambigüedad

Cuando toque, el backend necesita: guardar el token de dispositivo por usuario (alta y baja),
y disparar un aviso **cuando el estado de una postulación pasa a uno que acaba en
`TURNO_CANDIDATO`** — que es exactamente donde `src/dominio/estados.ts` ya decide que hay
botón, o sea, el «te toca a ti» del portal. No hace falta inventar una regla nueva: ya existe.

---

## Riesgos, y qué se hace si pasan

| Riesgo | Qué se hace |
|---|---|
| La capa nativa rompe el multipart | Esas dos rutas vuelven a `fetch`, con el CORS puesto en Vercel |
| La capa nativa se come la cabecera `Date` | La hora del servidor se lee del cuerpo de una ruta conocida, o se desactiva el parche para esa petición |
| Play rechaza por «funcionalidad mínima» | El riesgo es bajo con la app empaquetada dentro; si pasa, la respuesta es enseñar lo nativo que ya hay (App Links, almacenamiento, selector de archivos) |
| `assetlinks.json` no se verifica | Mirar que la URL devuelve JSON y no HTML, y que la huella SHA-256 es la de la firma **de Play**, no la de depuración |

---

## Los valores fijados, y lo que aún falta

### Decidido

| Qué | Valor |
|---|---|
| **Identificador de la aplicación** | `com.renaser.ex` — permanente, no se cambia nunca más |
| **Nombre del proyecto en Vercel** | `renaser-os-postulantes` — pasa a ser una constante de producción |
| **Origen que va dentro del `.aab`** | `https://renaser-os-postulantes.vercel.app` |
| **Tipo de cuenta de Play** | De organización, verificada con D-U-N-S |

**La cuenta con D-U-N-S está exenta de la regla de los 12 probadores durante 14 días**, así que
se publica directo a producción sin test cerrado previo. Era el mayor riesgo de calendario.

### ⚠️ El origen es un dominio de Vercel, y eso ata dos manos

`renaser-os-postulantes.vercel.app` no caduca, así que sirve — pero queda escrito dentro del
`.aab` de cada teléfono.

**El nombre del proyecto en Vercel deja de ser un detalle de organización y pasa a ser una
constante de producción.** La URL `…vercel.app` se deriva de él: renombrar el proyecto —aunque
sea ordenando— cambia la dirección y **todas las apps instaladas dejan de conectar a la vez**,
sin aviso, y sin más arreglo que publicar una versión nueva y esperar a que cada persona
actualice. Quien vaya a tocar la configuración de Vercel tiene que saberlo.

Si Renaser va a tener dominio propio, lo barato es comprarlo y apuntarlo a Vercel **antes** de
publicar. Mientras la app no haya salido, cambiar la dirección es solo otro `build:movil`.

### Falta, y bloquea publicar (no construir)

| Qué | Para qué | Quién lo tiene |
|---|---|---|
| **La huella SHA-256 de la firma de Play** | Sin ella los App Links no se verifican. Sale de Play Console **después** de crear la aplicación | Play Console → Integridad de la app |
| **Dos cuentas de demostración** | Google revisa lo que hay detrás de la sesión: una de candidato y una del panel | Base de producción |
| **El icono y los gráficos de la ficha** | En el repositorio solo hay `public/hormiga.svg`, un trazo de 24×24 que no sobrevive al tamaño de un icono de lanzador. Hacen falta un icono adaptativo (figura y fondo separados, con margen de recorte), un PNG de 512×512, un gráfico de 1024×500 y dos capturas | Diseño |
| **El texto de la política de privacidad** | Para la página pública que Play exige | Renaser |

