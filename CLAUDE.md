# Portal del candidato · contexto de trabajo

Última actualización: 2026-09-04 · **la ficha dice QUÉ marcó la IA y no solo cuántos; lo que
entregó el candidato se ve desde la ficha; el ranking se ordena, se filtra y se descarga; la
cuenta nace con ciudad; las pruebas del puesto se escriben desde el panel; y el plazo se dice
entero**

Este archivo es para retomar el trabajo sin tener que reconstruir nada. Cuenta qué es este
proyecto, con qué habla, qué se decidió y por qué, y qué está a medias.

---

## La ficha dice QUÉ marcó la IA, y no solo cuántos (04/09/2026)

En el perfil integral la sección **«Hallazgos y alertas»** pintaba la etiqueta —`FORTALEZA`,
`RIESGO CRITICO`, `RIESGO DESARROLLABLE`, `FALTA EVIDENCIA`— y **a su lado nada**. Una columna de
rótulos sin una sola palabra de por qué. La tabla decía «1 riesgo crítico» y la única pantalla
que podía explicarlo enseñaba la palabra «riesgo crítico» otra vez.

⚠️ **La causa era un nombre de campo, y llevaba ahí desde el primer commit.** El backend manda
`HallazgoResponse(tipo, descripcion, evidencia, esCanalizable, sugerencia)`; la interfaz de
`tipos.ts` declaraba `{ tipo, texto }`, y `texto` no existe en ninguna versión de esa respuesta.
React recibía `undefined` y no dibuja `undefined`: ni un hueco, ni un error, ni un aviso en
consola. **Compilaba, pasaba el tipado y pasaba las pruebas** — porque el doble de
`verPerfilIntegral` mandaba `hallazgos: []`, así que ninguna prueba abrió nunca la lista. Es el
fallo que este archivo repite: un tipo que no es el del backend no lo dice TypeScript, lo dice la
pantalla en blanco tres meses después.

Ahora cada hallazgo sale con su **frase** y con **en qué se basa**, que es lo que permite no
creerse la afirmación a ciegas.

### Se enseñan cuatro de los cinco tipos, y agrupados

Fuera `PREFERENCIA`: «su motivación está en lo técnico» es contexto para la entrevista, no algo
que mueva una decisión. Dentro `FALTA_EVIDENCIA`, y conviene decir por qué no es un riesgo: **un
riesgo es algo que la persona hace mal; un hueco es algo que no sabemos** —la Regla 1 del
documento 03 prohíbe expresamente mezclarlos— y el hueco suele ser justo lo que decide qué
preguntar. «No hay evidencia de gestión de equipos» no descalifica a nadie.

El orden es por tipo y no el que devolvió el modelo: **primero lo que suma, luego lo que resta,
al final lo que falta por saber**. Con todo entremezclado había que leer los siete para saber si
había algo grave.

### La sugerencia llega y no se pinta

El agente propone qué hacer con cada hallazgo —«preguntarle por un cierre de caja que haya
firmado él»— y es texto útil, pero **triplicaba el alto**: siete hallazgos pasaban de siete
líneas a veintiuna en una ficha que se lee mientras se decide. El campo sigue viajando en la
respuesta para el día que tenga su sitio.

### ⚠️ Las alertas quedan fuera, y el contador se queda sin puerta

`CONTRADICCION` y `DEMASIADO_IDEAL` viajaban en la respuesta y **ni siquiera estaban declaradas
en el tipo**. Se declararon y se decidió no pintarlas: una alerta no descarta a nadie (RF-64), es
una pregunta para la conversación final, y el titular pasó de «Hallazgos y alertas» a
**«Hallazgos»** a secas para no prometer lo que no está.

**Consecuencia sabida, no olvido:** el ranking sigue contando alertas en su columna y en el «N
alerta(s)» de la ficha, y hoy ese número **no se puede abrir en ninguna pantalla**. Volver a
enseñarlas es una línea. El tipo se declara igual, porque un tipo que calla lo que el backend
manda es exactamente lo que produjo el fallo de arriba.

### ⚠️ Esto NO se enseña en la ficha de la prueba del puesto, y se probó

La columna de **Veredicto** puede decir «Con riesgo» en la pestaña de la prueba, y esa ficha no
tenía forma de explicarlo: el veredicto es `grupo_prioridad`, lo escribe la etapa 1 al cerrar el
perfil y **no se recalcula por etapa**. Parecía el sitio para responderlo. Se quitó.

El motivo es que en esa pantalla **«¿Por qué contratarlo?» y «Lectura de la prueba» salen ENTEROS
de la rúbrica de la prueba** —y están ahí justamente porque en el perfil integral la frase no
cuadraba con su número—. Una segunda lista de fortalezas sacada del currículum, pegada debajo, no
añade contexto: invita a confundir las dos fuentes. Quien vea «Con riesgo» lo mira en su pestaña.
Lo deja fijado un caso de prueba, para que no se vuelva a añadir sin saber que ya se decidió.

⚠️ **Y de paso, algo que el rótulo esconde: «Con riesgo» NO significa que haya un riesgo
crítico.** La regla del backend mete en ese grupo a dos poblaciones —quien llega a la nota alta
arrastrando un riesgo crítico, y quien se queda entre los dos cortes de nota sin arrastrar nada—.
Un 70 limpio, sin un solo hallazgo, sale «Con riesgo».

---

## Lo que entregó se ve desde la ficha (02/09/2026)

Los entregables de la prueba los leían **dos**: el propio candidato en su portal, y el agente al
armar su insumo. Quien tenía que poner a mano la nota de un criterio —los que la rúbrica reserva
a una persona, que son justo los que el modelo no puede leer: un vídeo, un enlace— **no tenía
dónde ver el vídeo**. Se le pedía un puntaje sobre algo que ninguna pantalla le enseñaba. Ahora
hay un bloque **«Lo que entregó»** en la ficha (`src/panel/vacantes/EntregablesDePrueba.tsx`),
entre la rúbrica y «Lo que escribió en la prueba»: cuánto vale, qué entregó, qué escribió — que
es el orden en que se revisa. Lo alimenta `GET /postulaciones/{id}/prueba/entregables`, nuevo.

### Salen todos los pedidos, entregados o no

⚠️ **Un hueco no se lee: se lee una lista más corta, que parece completa.** Que faltara el
tercero, y que fuera obligatorio, es justo lo que hay que ver antes de poner una nota. Por eso la
fila sale igual y **la palabra va dentro de la píldora** —«Falta, y era obligatorio»—: es la
regla de la forma primero, y en gris `--mal` y la prosa caen casi en la misma luminancia.

### El permiso tiene dos niveles, porque el enlace ES el entregable

Listar pide `abrir_ficha_candidato`; el **`enlace` y el `archivoId` viajan solo con
`descargar_entregables`**. Sin el segundo se sigue sabiendo qué entregó y cuándo —lo que necesita
quien solo lleva el seguimiento— y `porQueNoSeVe` explica el hueco con palabras.

⚠️ **No es una asimetría, es cerrar la puerta de al lado.** En la prueba de marketing la
sustentación en vídeo se entrega **pegando una dirección**, así que repartir el enlace con el
permiso flojo abriría por ahí justo lo que las dos rutas de `/archivos` cierran.

⚠️ **Y hasta la V48 abrir un entregable respondía 404 para cualquier empresa que no fuera la
plataforma.** No era del panel: el backend sellaba el archivo con la organización de quien lo
sube —el candidato, que es de la plataforma— y lo busca con la de la empresa de la vacante. El
porqué entero está en el `CLAUDE.MD` del backend. **Esta pantalla es la primera que lo habría
destapado**, y hoy no se nota porque RENASER es las dos cosas a la vez.

### ⚠️ El enlace firmado NO falla en local, y decidir por la excepción no habría caído nunca

`AlmacenArchivosEnMemoria.urlDeDescarga` devuelve `Optional.of("memoria://…")`: el endpoint
contesta **200** con una url que ningún navegador abre. Lo dice `application-local.yaml` en su
bloque de archivos. Así que el botón **no decide por la excepción —no hay ninguna— sino por el
esquema de la url**, y lo que no sea `http`/`https` cae a `/archivos/{id}/descarga`, que sirve
los bytes por el backend y funciona en los dos entornos. El `catch` sigue haciendo falta para el
403 y para la red caída; lo que nunca se dispara en local es él.


### ⚠️ `window.open` después de un `await` lo bloquea el navegador, y bloqueado devuelve `null`

**No lanza.** Un `try/catch` alrededor no se entera, así que la pantalla se quedaría diciendo
«Abriendo…» sobre una ventana que nunca existió. Por eso se pide **antes** del `await`, dentro
del gesto de la persona: se abre en blanco, se navega si la url sirve, y se cierra si toca
descargar. Es de la familia del `<button>` sin `type`: el navegador hace algo razonable, distinto
de lo que se quería, y sin error.

### El enlace del candidato es contenido de fuera

⚠️ **Solo se hace pulsable lo que parsea como `http` o `https`.** Es texto libre —la única
validación que tiene, ni en el DTO ni en la base, es que no venga en blanco—. React neutraliza
`javascript:` en un `href` pero no los demás esquemas, y lo que no pasa la guarda se pinta como
texto, que se lee y se copia, diciendo por qué no se abre.

⚠️ **El texto del enlace es la dirección entera, a propósito.** Un «Ver el vídeo» escondería a
dónde lleva, y quien va a pulsar sobre algo que escribió un desconocido tiene derecho a ver el
destino antes. Por lo mismo va con `noopener noreferrer`.

### ⚠️ Un 404 de ese endpoint son DOS cosas, y la pantalla no puede saber cuál

El backend contesta 404 cuando la persona no tiene intento de prueba —no la rindió— **y también
cuando la vacante queda fuera del alcance de quien mira**, porque `AlcanceSobreLaVacante` devuelve
404 y no 403 a propósito, para no confirmar que existe algo que no te toca. Por eso la frase **no
afirma** que no entregó: nombra las dos posibilidades. Decirlo era el fallo caro —quien califica
leería un hecho sobre la persona cuando lo que pasa es que no alcanza a verlo—, y es la misma
lección del guion del ranking, que significaba cinco cosas y no decía cuál.

**Una lista vacía sí se afirma**: una prueba sin entregables es un cuestionario y se contesta
escribiendo. El backend devuelve `[]`, no 404.

### La sexta fixtura que iba a mentir

`datos-panel.mjs` no traía la ruta, y el interceptor de `capturar-panel.mjs` acaba en `?? []`:
la captura habría escrito **«esta prueba no pedía entregar nada» sobre una postulación que sí
tenía entregables**. No es un hueco, es una afirmación falsa —y del lado que exculpa al sistema.
Ahora siembra los cuatro casos que hay que poder mirar: un enlace, un archivo, uno obligatorio
**sin** entregar, y uno cuyo archivo ya no está guardado.

### Lo que queda sin resolver

⚠️ **Con formato `CUALQUIERA` se puede perder una entrega de vista.** Quien pega un enlace y
luego sube un archivo deja **dos filas**, y de cada entregable se enseña la última versión: el
enlace anterior no se pinta en ningún sitio. Arreglarlo pide que el backend mande el historial.
Está dicho en el código y no resuelto.

### Cómo se comprueba

```bash
npm run typecheck && npm test
```

`npm test` son **528 pruebas en 30 archivos** (medido el 02/09/2026), y pasan enteras; `tsc` sale
limpio y el detector de impeccable no encuentra nada en el bloque nuevo.

⚠️ **Lo que NO se pudo comprobar: que el enlace firmado del bucket sirva bytes.** En local el
almacén es el doble en memoria y no hay bucket, así que se verificó **el camino de la descarga**
—el único que existe en los dos entornos— y el otro queda afirmado por construcción. Es el mismo
hueco que ya tiene el enunciado subido de una prueba.

---

## Los e2e viven en `herramientas/e2e/` y corren con `@playwright/test` (01/09/2026)

Había doce arneses sueltos en `herramientas/`, cada uno un `node` a pelo sobre la librería
`playwright`, con sus comprobaciones a mano y su `process.exit`. **Se migraron todos al
corredor** y la suite es una sola: 22 archivos numerados en `herramientas/e2e/`, con
`playwright.config.ts` en la raíz. Cada comprobación del script viejo es un `expect` del
nuevo; lo que se saltaba por falta de datos es un `test.skip` con el mismo motivo.

```bash
npm run test:e2e            # todo, con el Chromium clavado de la librería
npm run test:e2e:ui         # la ventana con la lista, el viaje en el tiempo y el «elegir locator»
npm run test:e2e:chrome     # el Chrome de la máquina, con ventana
npm run typecheck:e2e       # los specs NO entran en `npm run typecheck`: tienen su tsconfig
npx playwright test herramientas/e2e/15-componer-prueba.spec.ts   # uno solo
```

⚠️ **La suite no levanta nada**: espera Vite en 5174 y Spring en 8081 ya arrancados, con la base
sembrada (`scripts/sembrar-datos-de-prueba.py` del backend). **Un solo worker**: la base es
compartida y varios specs escriben. Y **17 tests se saltan** en local con motivo: los que
dependen de la IA (aquí la clave es ficticia y el trabajo acaba en `FALLIDA`), un nivel del
banco con dos versiones publicadas, una prueba entregada, una sesión con inscritos.

**Los apartados de fechas anteriores citan los scripts por su nombre de entonces.** Hoy son:

| Antes | Hoy |
|---|---|
| `e2e-panel-entrar.mjs` | `herramientas/e2e/10-panel-entrar.spec.ts` |
| `e2e-perfil.mjs` | `herramientas/e2e/11-perfil.spec.ts` |
| `e2e-postular.mjs` | `herramientas/e2e/12-postular.spec.ts` |
| `e2e-etapas.mjs` | `herramientas/e2e/13-etapas.spec.ts` |
| `e2e-vacante.mjs` | `herramientas/e2e/14-vacante.spec.ts` |
| `e2e-componer-prueba.mjs` | `herramientas/e2e/15-componer-prueba.spec.ts` |
| `e2e-cuestionario-tecnico.mjs` | `herramientas/e2e/16-cuestionario-tecnico.spec.ts` |
| `e2e-prueba-tecnica.mjs` | `herramientas/e2e/17-prueba-tecnica.spec.ts` |
| `e2e-ranking-etapa.mjs` | `herramientas/e2e/18-ranking-contra-api.spec.ts` |
| `e2e-banco.mjs` | `herramientas/e2e/19-banco.spec.ts` |
| `e2e-prueba-y-empresas.mjs` | `herramientas/e2e/20-prueba-y-empresas.spec.ts` |
| `e2e-simulacion-permisos.mjs` | `herramientas/e2e/21-simulacion-permisos.spec.ts` |

`e2e-android.mjs` se queda como script: conduce Maestro contra un APK, no un navegador.

---

## El ranking se ordena, se filtra y se descarga (01/09/2026)

La mesa donde se decide dejó de ser una lista que solo se mira. **Todo pasa en el navegador**:
ordenar o filtrar no le vuelve a pedir nada al servidor, y el corte de la botonera —«Con nota del
perfil» (el rótulo lleva el nombre de la nota de cada etapa), «Está aquí ahora» y «Toda la
tanda»— sigue mandando por encima de todo lo demás. Las reglas viven en
`src/panel/vacantes/ranking.ts`, con sus tests al lado.

### Cuatro cabeceras, tres estados cada una

Candidato, Ciudad, la nota de la etapa y Pretensión. Cada pulsación avanza: el sentido natural de
la columna —**la nota abre por la mayor**, los textos de la A a la Z, la pretensión de la más
baja—, el inverso, y al tercero **`alternarOrden` devuelve `null` y se vuelve al orden del
backend**, que es el que agrupa por prioridad y ordena la nota dentro. Sin ese tercer estado
habría que recargar para recuperarlo.

⚠️ **El orden del cliente es PLANO: manda la columna pedida y nada más.** Hubo una versión que
ordenaba la nota dentro de cada grupo de prioridad y se quitó. Dos motivos, y el segundo es el
que decide: agrupar casi nunca cambiaba el resultado —los tres grupos que la IA escribe (`ALTA`,
`POTENCIAL_CON_RIESGO`, `NO_PRIORIZADO`) cuelgan de la propia nota, y `INCOMPATIBLE` no lo
escribe nadie porque quien falla un requisito indispensable se cierra como `NO_CONTINUA` sin
llegar a tener grupo—; y cuando cambiaba algo, salía una tabla 55, 74, 61, 95 que se lee como
rota. Un orden que hay que explicar no está ordenando.

**El grupo se sigue pintando en cada fila**, dentro de la celda del candidato: ya no mueve a
nadie, pero un 95 con riesgo crítico es justo lo que hay que ver antes de llamar.

⚠️ **Los vacíos, al final, suba o baje el orden.** `elHuecoAlFinal` decide la ausencia **antes**
de aplicar el sentido. Con un `ordenar(...).reverse()` los huecos suben a la primera pantalla al
pulsar «descendente», que es como sale mal. Y los textos comparan con `localeCompare` en español,
o «Ávila» cae detrás de «Zurita».

⚠️ **`ordenar` copia antes de ordenar.** `filas` es el array de la caché de react-query; un
`.sort()` encima lo reordena para todo el que lo lea después, y el estropicio sobrevive a cambiar
de pestaña.

### Los cuatro filtros

Buscador por nombre **sin tildes ni mayúsculas** (`paraBuscar`: media tanda se llama Fátima o
Muñoz), ciudades marcables de varias en varias, y rangos de nota y de pretensión.

⚠️ **Las ciudades salen de las FILAS, nunca del catálogo de ubigeo**, y de las filas **sin
filtrar**: del catálogo serían 196 filtros que no devuelven a nadie, y de las visibles, marcar
una haría desaparecer a las demás y no habría forma de añadir la segunda.

⚠️ **Un rango deja fuera a quien no declaró el dato, y es a propósito.** Una fila sin nota no es
«≥ 60». Se dice debajo del control, y vuelven con «Ver a todos». La pretensión se cruza por
**solape**, y quien declaró un solo extremo cuenta como esa cifra a secas: «desde 5 000» entra en
«hasta 6 000» y no en «desde 6 000». Leerlo como una recta abierta sería ponerle en la boca al
candidato una cifra que no escribió.

### Ciudad y Pretensión: dos columnas que pueden no existir

⚠️ **Si ninguna fila trae una de las dos, la columna no se pinta y se dice por qué** — y los
motivos son distintos. Ciudad: solo se le pide a quien crea su cuenta desde ahora, así que hoy
casi ninguna postulación la trae. Pretensión: **hay dos causas opuestas y el nulo no las separa**
—el candidato no declaró sueldo, o quien mira no tiene `ver_pretension`, que solo tiene
Dirección—, y por eso `RankingVacante.puedeVerPretension` viaja: sin esa señal la frase tendría
que enumerar hipótesis. Una columna de guiones se lee al revés: «nadie pidió sueldo».

⚠️ **La ciudad se detecta por el código además de por el nombre** (`ciudad` o `ciudadCodigo`):
llegan de dos consultas distintas y tener código no implica tener nombre. Y
`columnasDelRanking` es **la única fuente del `colSpan`**, ahora que hay columnas que aparecen y
desaparecen con los datos.

**La pretensión no es un dato nuevo**: vive en el perfil del candidato desde antes. Nueva es la
columna.

### El Excel

`POST /vacantes/{id}/ranking/excel`, y solo en **Perfil integral** y **Prueba del puesto**: en
las otras tres el botón no existe en vez de salir y fallar con un 400.

⚠️ **Es POST y no GET porque lleva la lista entera de ids ordenada**, que en una tanda de ochenta
no cabe en una URL. Y por eso mismo no vale un `<a href>`: el token va en una cabecera, que un
enlace no puede poner. El archivo se abre con `createObjectURL`.

La hoja lleva **las filas que se ven, en el orden de la pantalla** —el backend escribe el orden
que se le manda y nada más— y dentro va `describirFiltro`: etapa, corte, filtros, orden aplicado
y, si la pretensión salió vacía, por qué. La hoja se reenvía y se abre lejos del panel, donde ya
no hay pantalla que explique que un blanco puede ser un permiso.

### Crear cuenta pide dónde vive

`POST /portal/cuentas` gana `ciudadUbigeo`, obligatorio: el ubigeo de nivel 2 —la provincia— o
`EXT`. Las opciones vienen de `GET /portal/catalogos/ubigeo`, **sin token**, porque quien está
creando la cuenta todavía no tiene ninguno. En pantalla, **un solo `<select>` nativo con
`<optgroup>` por departamento** y las 196 provincias, no dos encadenados; «Fuera del Perú» va
suelto al final, porque con `label={null}` el navegador pinta un grupo llamado «null» y colgarlo
de un departamento inventado diría que el extranjero está en algún sitio del Perú.

⚠️ **`z.string().min(1)` y no `z.string()` a secas.** La primera opción vale `''` —hace falta
para que se vea que no hay nada elegido— y una cadena vacía es una cadena válida: sin el mínimo
el formulario salía y el backend lo rebotaba con un 400 que la pantalla no supo prevenir.

⚠️ **Se pide UNA vez y a nadie más.** A quien ya tiene cuenta no se le pregunta nunca, así que el
panel tiene que contar con que **casi ninguna postulación trae ciudad**. De ahí que el filtro de
ciudad y su columna nazcan de las filas y no del catálogo.

⚠️ **Un fallo del catálogo se dice, no se disimula.** El campo es obligatorio: un desplegable
apagado y mudo deja a la persona pulsando «Crear cuenta» contra un error que no explica nada.

---

## El plazo se dice entero, y no desaparece a media prueba (31/08/2026)

Dos sitios donde el portal **tenía razón y callaba media verdad**. Los dos son de la misma
familia: un plazo que el candidato necesitaba para decidir cómo repartirse el tiempo, y que la
pantalla no le enseñaba.

⚠️ **Los dos plazos de la prueba pueden existir A LA VEZ, y el lateral decía uno solo.** Antes
de empezar (`estadoIntento === 'PENDIENTE'`), `Prueba.tsx` era un `if/else`: si venía
`duracionMinutos` escribía «90 minutos desde que empieces» y **se callaba `venceEn`**. Pero son
cosas distintas —los minutos los trae el instrumento, la fecha la cierra la convocatoria para
todos— y **manda el que caiga antes**, que lo decide el servidor al arrancar el intento. Quien
abriera a las 17:40 con cierre a las 18:00 leía noventa minutos y tenía veinte. Ahora se dicen
los dos, y el segundo dice **cuál acorta a cuál**. Sin `venceEn` no se inventa ninguna fecha:
las dos ramas están fijadas en `Prueba.test.tsx`.

⚠️ **En la evaluación, los días que quedan estaban solo en la portada.** Entre esa pantalla y el
aviso de la última hora hay **dos semanas** de plazo por defecto, y en todo ese tramo el
candidato no volvía a ver cuánto le quedaba: para saberlo tenía que salir del examen. Ahora va
en la línea de servicio, junto a «Pregunta 2 de 55», que es donde se mira de reojo sin
interrumpir.

⚠️ **Y desaparece por debajo de la hora**, que es exactamente cuando entra el aviso de «Queda
poco plazo» con su cuenta atrás. Dos relojes a la vez —uno diciendo «hoy» y el otro
`00:42:17`— se leen peor que el segundo solo. Por eso la frontera es **una sola constante**,
`UNA_HORA`, que gobierna las dos apariciones: dos números que se desincronizaran dejarían un
hueco sin ningún reloj, o los dos encendidos. De paso, ese corte deja fuera los dos textos de
`diasHasta` que en esa línea no encajan, «vencida» y «sin plazo».

**Y una decisión de forma que vale para los dos:** el segundo plazo va **debajo del primero**,
en `--t-menor` y `--tinta3`, no a su lado y no al mismo peso. Es la condición del dato de
arriba, no un dato hermano; subirlo haría leer dos plazos compitiendo en vez de uno con su
límite.

## Las áreas se administran desde Configuración (31/08/2026)

Las áreas son la estructura de la empresa y **hace falta una para registrar una solicitud de
talento**, que es el paso previo a cualquier vacante. El panel solo sabía *consumirlas*
(`listarAreas` para llenar desplegables): no había ninguna pantalla para crear una, y menos
para cambiarlas. Ahora hay una sección propia, `src/panel/configuracion/Areas.tsx`, entre el
banco y el equipo.

⚠️ **Son DOS listas y usar la equivocada rompe la pantalla en silencio.** `GET /areas` trae
solo las activas —es la que llena los desplegables— y `GET /areas/todas` trae también las
retiradas. Esta pantalla lee la segunda: con la primera, un área recién desactivada
desaparecería de la lista sin ninguna forma de volver a encenderla, y el botón «Retirar» sería
un viaje sin retorno.

⚠️ **La tabla del equipo también pasó a la lista de todas**, y por lo mismo: leía la de activas
y alguien de un área retirada caía en el `?? '—'`, que significa «no tiene área». Dos
situaciones distintas pintadas igual, y la falsa hacía pensar que al desactivar se perdió el
dato.

⚠️ **Retirar y borrar son cosas distintas y la pantalla lo dice.** Retirar deja todo donde está
y se deshace. Borrar exige mover antes lo que colgaba del área —las dos claves ajenas que
apuntan a ella no declaran `ON DELETE`—, y ese movimiento no se deshace.

⚠️ **El precio del borrado se enseña ANTES de confirmar.** Al abrir el bloque se pide
`GET /areas/{id}/impacto` y se escriben los dos recuentos de verdad; mientras la respuesta no
llega no se ofrece ningún botón de borrar, y si no se puede traer, tampoco. Un «¿seguro?» sin
números deja decidiendo a ciegas sobre solicitudes de candidatos reales. El bloque se despliega
**en la propia fila y no en un `<dialog>`**, como la asistencia de una simulación: tiene que
leerse pegado al nombre al que se refiere.

⚠️ **Cada cambio invalida las DOS claves de caché**, `['panel-areas-todas']` y
`['panel-areas']`. La segunda la leen el desplegable de la vacante y la tabla del equipo: sin
invalidarla, un área renombrada aquí sigue con el nombre viejo allá hasta que alguien recargue.

Los 409 del backend vienen escritos en español —el nombre repetido, y el borrado con los dos
recuentos dentro— y se enseñan tal cual: son la única indicación de qué hacer a continuación.

**Lo que encontró mirarlo, y no leerlo** (`capturar-panel.mjs`, pantalla `areas`):

- Un `flex-wrap: wrap` dentro de un flex en columna resolvía su alto a 152 px con 70 px de
  contenido: los campos se iban al fondo y quedaba un hueco vacío de ochenta píxeles justo
  encima del desplegable del destino. Se midió en el navegador; ni `align-content` ni
  `flex: none` ni `height: fit-content` lo bajaban. El bloque pasó a rejilla.
- **En gris, «Borrar» se leía idéntico a «Renombrar» y «Retirar»**: tres píldoras del mismo
  trazo, y la única que no se deshace era indistinguible. Lleva contorno de 2 px en `--mal`, no
  de 1 px en `--mal-regla` —con la regla clara salía *más pálido* que sus vecinos—.
- «En uso» va rellena y «Retirada» con trazo punteado: se separan por la forma, no por el tono.

## Las pruebas del puesto se escriben desde el panel (31/08/2026)

Hasta hoy **no había ninguna pantalla** para crear una prueba: las que existen entraron por
scripts de Python del backend —`cargar-convocatoria.py`, `cargar-prueba-administrador.py` y
`cargar-prueba-de-la-empresa.py`—, llamando a la API una por una. Quien no escribe Python no
podía escribir una prueba, y sin prueba publicada ninguna vacante se publica. Pestaña nueva
**Pruebas** (`/admin/pruebas`) con dos pantallas en `src/panel/pruebas/`:

- **`PlantillasDePrueba.tsx`** · las plantillas con sus versiones y el estado de cada una.
  Crea plantillas (nombre y puesto opcional: sin puesto es genérica) y abre borradores nuevos.
- **`ComponerPrueba.tsx`** (`/admin/pruebas/versiones/:versionId`) · la versión entera:
  datos y tiempos, el enunciado subido como archivo, la guía de calificación, preguntas,
  entregables, rúbrica y variantes. `DatosDeLaPrueba.tsx` y `ListasDeLaPrueba.tsx` son sus
  dos mitades; `cuotas.ts` calcula los contadores y tiene sus 11 pruebas.

### ⚠️ Todo se refresca de la versión entera, nunca se parchea a mano
Componer una prueba son **diecisiete llamadas de escritura** a `/plantillas-prueba` —crear la
plantilla y la versión, el `PUT` de los datos, publicar, subir la consigna, y el alta, la
corrección y el borrado de preguntas, entregables, criterios y variantes—, y **ninguna devuelve
la versión actualizada**: devuelven un id o nada. Cada `onSuccess` invalida
`['panel-version-prueba', id]`. Es un viaje más y es lo que
impide que **los contadores mientan**: llevados a mano se separarían del servidor al primer
fallo de red, que es la trampa del «indicador honesto» que ya costó respuestas perdidas aquí.

### ⚠️ `PUT /versiones/{id}` REEMPLAZA la versión entera
Lo que no viaje se guarda en nulo. Por eso los datos y la guía son **un solo formulario con un
solo botón**: partirlos haría que guardar uno borrase el otro. Y por eso `VersionResponse`
tuvo que devolver `materiales`, `herramientasPermitidas` y `minutosExtra`, que antes se podían
escribir y no leer — cargar el formulario y guardarlo los borraba sin que nadie los tocara.

### Los contadores existen porque publicar para en la primera regla que falla
El backend valida en cascada —duración, cuota de preguntas, rúbrica— y devuelve **un** mensaje.
Con la rúbrica en 140 y tres preguntas de menos hacían falta tres intentos para enterarse de
tres cosas. El balance de arriba las enseña a la vez mientras se compone. **El botón de
publicar no se apaga** aunque el balance esté en rojo: es una copia de las reglas del servidor
y una copia puede quedarse atrás; apagarlo encerraría la versión por un cálculo del panel.

⚠️ **La cuota cambia con los entregables.** Sin ninguno la prueba es un cuestionario y basta
una pregunta; con el primero pasan a hacer falta 8-10 universales y 3-5 del puesto. Es la
regla que un contador fijo habría pintado mal, y es lo que fija `cuotas.test.ts`.

### Las dos confusiones que la pantalla dice en voz alta
- **El archivo es el ENUNCIADO, no la prueba.** Subirlo no crea preguntas, ni entregables, ni
  rúbrica, y publicar exige lo mismo que antes. Además el enlace **caduca a los 180 días**.
- **La guía de calificación orienta, no sustituye a la rúbrica.** La nota sigue saliendo
  criterio a criterio y la rúbrica sigue teniendo que sumar 100.

### ⚠️ Se borró el tanteo de ids de `panel.ts`
`listarVersionesPrueba` adivinaba ids en tandas de ocho hasta dar con un hueco, porque
`GET /plantillas-prueba/{id}/versiones` no existía. **Ya existe**, y la función es una línea.
Si vuelve a aparecer código que adivina ids, alguien deshizo esto. El desplegable de la vacante
pregunta plantilla por plantilla y junta las respuestas, y ahora que llega el `estado` **ya no
ofrece borradores**: asignarlos contestaba 409.

⚠️ **Ese `useQuery` espera a que las plantillas TERMINEN, no a que acierten**:
`enabled: !plantillasPrueba.isLoading`, nunca `isSuccess`. Con `isSuccess`, un fallo al
listarlas dejaba la consulta apagada para siempre —`isPending` no baja nunca, el desplegable se
queda deshabilitado diciendo «Buscando las pruebas…», y ninguno de los tres carteles de abajo,
que exigen `!isPending`, llega a salir—. Una espera eterna sin explicar es la versión silenciosa
del indicador que miente. Terminando en error se corre igual con la lista vacía, y el cartel
—que empieza por la rama del fallo, antes que por «no hay ninguna»— dice qué pasó y enlaza a
`/admin/pruebas`.

⚠️ **Dos excepciones que parecen incoherencias y no lo son.** La versión que la vacante YA tiene
puesta no se filtra nunca —ni por estado ni por puesto—, y si su plantilla no sale en el listado
se pide suelta con `verVersionDePrueba`. Sin eso, el `<select>` se quedaría sin su `<option>` y
diría «Elige la prueba…» sobre una vacante que sí tiene prueba.

### Dos defectos que solo se vieron en el navegador
- **`composes: chico` de una clase escrita más abajo aborta la hoja entera.** PostCSS falla con
  «referenced class name not found» y la pantalla sale sin un solo estilo. En jsdom las clases
  son cadenas: ningún test lo ve.
- **Un botón suelto dentro de un bloque flexible se estira a lo ancho.** «Añadir un criterio»
  era una píldora de mil píxeles. De ahí `.bloque > .chico { align-self: flex-start }`.

Y una decisión de forma: **quitar lleva el rojo del sistema**, contorno y texto, no relleno.
Sin eso «Quitar» y «Corregir» eran dos píldoras idénticas en la misma fila y una borraba.

### Cómo se comprueba

```bash
npm run typecheck && npm test
npx playwright test herramientas/e2e/15-componer-prueba.spec.ts
```

`npm test` son **528 pruebas en 30 archivos** (medido el 02/09/2026), y pasan enteras.

`e2e-componer-prueba.mjs` escribe una prueba entera en un Chrome de verdad y contra el
backend de verdad: crea la plantilla, compone la v1 —datos, tiempos, el enunciado escrito y
subido como PDF, la guía, once preguntas, dos entregables, la rúbrica y dos variantes—,
intenta publicar hasta que el servidor deja, y comprueba el desplegable de una vacante.

⚠️ **Es lo único que ejercita la escritura de verdad.** Los tests de esta pantalla corren
contra `backend-simulado.mjs`, que **contesta `{ok:true}` a todo lo que no sea GET**: con ese
doble, ningún guardado real se había visto nunca. La e2e cubre **catorce de las diecisiete**
llamadas de escritura. Las tres que no ha ejercitado nunca nadie contra un backend de verdad
—y conviene saberlo antes de fiarse— son escribir una pregunta nueva en el catálogo (la e2e
trae las suyas de las ya sembradas), quitar un criterio de la rúbrica y quitar una variante del
cambio inesperado. Las dos últimas comparten la confirmación con las que sí se prueban, pero
**cada `quitar` es su propia mutación contra su propia ruta**: que el botón esté probado no dice
nada de la llamada que hay detrás.

⚠️ **No hay lista de 404 perdonados**, a diferencia de `e2e-cuestionario-tecnico.mjs`. Aquel
perdona los de `/plantillas-prueba/versiones/` porque el panel tanteaba ids; ese tanteo es
justo lo que se borró aquí, así que heredar el perdón taparía lo que la prueba busca. Lo
único que se perdona es el 404 de la ficha de la vacante del último paso, que no está escrita.

⚠️ **Deja rastro que nadie puede borrar**: una plantilla por corrida, una versión suya
publicada —publicar congela— y otra en borrador. Nunca contra producción.

Lo que encontró, y que ningún test con dobles podía ver:

- **`CriterioRubricaResponse` no devolvía `descripcion`.** Corregir un criterio lo reemplaza
  entero, así que el formulario se abría en blanco y guardar **borraba la explicación larga
  sin decir nada**. Arreglado en el backend; ahora se siembra como el resto de campos. Es
  exactamente el mismo agujero que ya había obligado a devolver `materiales` y
  `herramientasPermitidas`.
- **`PUT /versiones/{id}` NO se lleva por delante el enunciado subido**, que era el miedo:
  `urlConsigna` no viaja en ese contrato y el backend la deja en paz a propósito. Para verlo
  hay que subir el archivo y **guardar después** — al revés no se ejercita.
- El resto del recorrido pasa entero: la cascada de validación al publicar nombra una regla
  por intento («hay 7 universales», luego «la rúbrica suma 140.00»), el balance cambia de
  cuota al añadir el primer entregable, y el desplegable de la vacante ofrece la v1 publicada
  y no la v2 en borrador.

⚠️ **Lo que esta prueba NO puede comprobar: que el enunciado subido se pueda abrir.** En
local el almacén es el doble en memoria y reparte urls `memoria://`, que ningún navegador
abre. Se afirma que el enlace existe y que sobrevive a guardar, no que sirva bytes: un fallo
en la firma de Supabase pasaría por aquí sin que nadie se entere.

npm run test:e2e          # Playwright con el Chromium clavado de la librería
npm run test:e2e:chrome   # el Chrome de la máquina, con ventana, para mirar un fallo
```

⚠️ **La suite no levanta nada**: da por hecho el Vite en 5174 y el Spring en 8081 ya arrancados,
porque arrancarlos ella abriría un segundo backend contra la misma base. **Un solo worker y sin
paralelo**: la base es compartida y la prueba de avance de etapa muta `estado`, que cambia los
contadores de «Está aquí ahora» de cualquier otra que esté corriendo. El archivo de móvil lo
corre solo el proyecto `movil`, a 375 px.

---

## La vacante elige qué prueba se rinde, y el candidato la contesta (30/08/2026)

La etapa **Prueba del puesto** se cumple de **dos formas, nunca las dos a la vez**, y la
vacante dice cuál. Lo decidió la clienta: el cuestionario CAZATALENTOS no es un añadido a la
prueba de siempre, es su alternativa.

| Instrumento | Qué rinde | Qué exige para publicar |
|---|---|---|
| `PLANTILLA` (por defecto) | La prueba del puesto de siempre: enunciado, entregables, reloj | Una versión de plantilla de prueba elegida |
| `CUESTIONARIO_TECNICO` | Preguntas escritas para ESA vacante por el REDACTOR | El cuestionario **publicado** |

⚠️ **Por defecto es `PLANTILLA`, y no es una preferencia: es lo que hacían todas las vacantes
que ya existían.** La migración se lo puso a todas, así que ninguna cambió de comportamiento.

### Dónde se elige, y hasta cuándo

En el detalle de la vacante, bajo «Qué responderá quien postule», mientras está en
**BORRADOR**. Al lado, **cuánto tiempo tendrá la etapa** — se guarda con su propio botón, que
solo aparece cuando el número cambió.

⚠️ **Se puede cambiar mientras nadie haya rendido todavía, y ni un minuto más.** Lo frena
`exigirVaraQuieta` en el backend, y los minutos cuentan como parte de la vara: cambiarlos con
gente dentro movería el examen bajo los pies de quien lo está haciendo.

⚠️ **El suelo de esos minutos son CINCO, no uno.** Ese número manda sobre el reloj del
instrumento elegido —hasta convierte una prueba de plazo abierto en cronometrada—, así que un
uno es una prueba que el servidor entrega sola sesenta segundos después de que el candidato la
abra. El mismo suelo lo valida el backend; el panel lo dice antes de intentarlo, y el campo
tiene tres textos de ayuda porque dice tres cosas distintas: el número inválido, el campo en
blanco («rige el tiempo del instrumento») y el número escrito («este tiempo manda sobre el del
instrumento»). El del medio ya estaba; el último es el arreglo, porque hasta ahora este campo
no hacía nada con la prueba del puesto y quien lo escribe tiene que enterarse aquí, no por lo
que le pase al candidato.

⚠️ **El desplegable de la prueba del puesto DESAPARECE al elegir el cuestionario**, y no es
cosmética: dejarlo visible invita a configurar las dos y sugiere que conviven.

### Qué ve el candidato

`/procesos/:uuid/prueba-tecnica` (`CuestionarioTecnico.tsx`). Una pregunta por pantalla, sin
mapa lateral —son once o doce, no cuarenta— y **sin nada que subir**: esta etapa se contesta
escribiendo. El reloj arranca **al abrirla**, no al avanzarle la etapa.

⚠️ **`momentoDeLaEtapa(estado, instrumentoEtapaTecnica)` envuelve a `momentoDe`, y por eso
existe.** Los dos instrumentos comparten los MISMOS estados, así que `PRUEBA_TURNO_CANDIDATO`
por sí solo no dice a qué pantalla mandar a nadie. Un instrumento nulo o desconocido se trata
como la prueba de siempre — es lo que hacían todas las vacantes y lo que manda un backend
anterior.

⚠️ **La pregunta PRESENCIAL nunca se le envía.** El REDACTOR escribe 12 para DIRECCION y el
candidato rinde 11: la muestra de trabajo se hace en persona. Comprobado en el e2e.

⚠️ **Lo escrito no sale de la cola hasta que el servidor lo confirma**, con la misma regla que
la evaluación del banco. Vive en `useColaDeRespuestas.ts`, extraído para no tener dos copias de
lo que ya costó respuestas perdidas una vez.

### Y aquí NO hay que ponderar

Con la prueba del puesto, la nota de la etapa nace de **ponderar la rúbrica a mano**: alguien
pulsa «Calcular la nota de la prueba». Con el cuestionario la calcula el método —índice =
puntos ÷ (4 × preguntas) × 100— y **llega hecha**.

Por eso `NotaDeLaPrueba` no pinta nada en esta etapa: su primera línea es
`if (rubrica.length === 0) return null`, y un cuestionario técnico no usa criterios de rúbrica.
**No es un hueco, es la rama correcta** — pero cuesta un rato entenderlo mirando la pantalla,
así que queda escrito.

⚠️ **Una respuesta sin un episodio concreto vale CERO**, aunque cumpla los otros tres
criterios: `FormulasCazatalentos.puntaje` corta con `if (cumpleSenalCero || !c1Episodio)`. En el
e2e las once respuestas inventadas describían prácticas habituales y el índice salió **0,00** —
parecía un fallo y era el método haciendo su trabajo. Si un día una nota baja sorprende, mirar
`c1Episodio` antes que el código.

### Cómo se comprueba

```bash
npm run typecheck && npm test
npx playwright test herramientas/e2e/16-cuestionario-tecnico.spec.ts
```

El e2e recorre el ciclo entero en un Chrome de verdad: la empresa elige, la IA escribe, la
candidata contesta y entrega, y el equipo lo lee con nota.

⚠️ **Gasta DOS llamadas al modelo** —el REDACTOR y el EVALUADOR_TECNICO— y las dos cuentan
contra el tope de la empresa. Tres escapes para no pagar de más:

| Variable | Para qué |
|---|---|
| `PARAR_EN=10` | Corta justo antes de la generación: ejercita todo el panel gratis |
| `CONTINUAR=1` | Retoma desde el avance, con `CORREO_CANDIDATA` |
| `DESDE_CALIFICAR=1` | Solo el cierre: la candidata ya entregó |

⚠️ **Necesita una vacante recién creada en BORRADOR**: afirma el estado de salida —instrumento
`PLANTILLA`, sin minutos— así que una segunda corrida sobre la misma vacante falla en el paso 3.

⚠️ **Y necesita su propia base y su propio vhost de RabbitMQ.** Compartir el broker con otro
backend le roba los mensajes: el trabajo de la IA se lo come el otro proceso y el cuestionario
no llega nunca.

Cuatro cosas que encontró y que ningún test de unidad podía ver:

- La ruta del portal para entrar es **`/ingresar`**; `/entrar` es la del panel.
- **La ficha del ranking no se abre con un enlace**: el `onClick` va en la fila entera, y la
  celda de la casilla para la propagación a propósito.
- **Entregar SACA de la pantalla del examen** y lleva al detalle del proceso, que pasa a decir
  «Estamos calificando tu prueba».
- **Al postular, tres de los cuatro saltos hasta la etapa técnica ya han pasado solos.** La
  máquina la pone en el perfil integral y el currículum la mueve hasta «por confirmar» sin que
  nadie pulse nada. Se avanza mientras la persona siga apareciendo, no se cuentan saltos.

---

## El tiempo viaja con el banco, y la vacante deja de preguntar (28/08/2026, noche)

Migración **V44** en el backend — el PR #49 se llevó el 43. Dos cosas que son la
misma: la plantilla de evaluación dejó de estorbar y el tiempo del examen se mudó a quien lo determina.

### La plantilla ya no hacía lo que su nombre promete

Nació para **muestrear** el banco —cuántas preguntas de cada tipo pedirle— y ese mecanismo
está retirado desde el banco v3. Lo dice `ServicioEvaluacionImpl.armarOrden`: sirve el banco
**entero** del nivel, sin leer una sola cuota. El banco CAZATALENTOS lo confirma —es fijo,
todos los del mismo nivel responden lo mismo en el mismo orden—.

Con las cuotas muertas, elegirla era una pregunta **obligatoria para publicar y con una sola
respuesta legal**: hay una publicada por nivel, y `asignarPlantillaEvaluacion` ya rechazaba
las de otro. Medido: de las 22 vacantes de la base local, **las 19 que eligieron plantilla
eligieron la única de su nivel**. Cero excepciones.

Ahora la vacante no pregunta y la resuelve `laPlantilla()`, con el mismo desempate que el
banco —`publicadaEn desc limit 1`—. `asignarPlantillaEvaluacion` **se queda entera**: es el
escape para el día que haya dos del mismo nivel.

### ⚠️ La guarda de publicar cambió de sujeto: es el BANCO, no la plantilla

`exigirBancoDelNivel` sustituye a las dos guardas viejas. Lo que de verdad falta cuando no
hay examen posible es el banco, y ese error salía en `crearAlPostular` —o sea, **encima del
candidato que acababa de mandar su currículum**—.

⚠️ **No mira `vacante.isAplicaEvaluacion()`, y es a propósito.** Al ENCENDER la evaluación la
vacante todavía la tiene apagada —el `set` viene después—, así que preguntárselo dentro dejaba
pasar justo el caso que existe para frenar. Decide quien llama. **Lo encontró su propio test.**

⚠️ **Y el panel tenía que cambiar a la vez.** `leFalta` y `listaParaPublicar` seguían pidiendo
`plantillaEvaluacionId` justo después de borrar el desplegable que era la única forma de
ponerlo: «Publicar» quedaba deshabilitado **para siempre**, apuntando a un bloque sin nada que
pulsar. Ningún test lo vio porque **ninguno pintaba la vacante en BORRADOR**, que es el único
estado donde ese botón existe. Ahora hay tres que sí.

### El tiempo vive en el banco, con la plantilla de respaldo

Son sus 21, 18 o 15 preguntas las que se tardan en responder. Mientras el número vivía en la
plantilla **nadie lo miraba**: DIRECCION estuvo once días en 45 minutos contra los 50-60 que
pide `docs/CAZATALENTOS-BANCO-RENASER.md`.

Los valores son el **tope** del rango del documento —DIR 60, SUP 45, EJE 35—, y no el medio
porque la clienta declara pendiente cronometrar el primer envío real y **acortar** preguntas si
alguien pasa de 60 minutos. Se empieza por arriba y se recorta con datos.

⚠️ **La columna nace nullable y hay respaldo.** Los bancos v3 y v0.1 no tienen minutos propios
y las evaluaciones ya rendidas cuelgan de ellos: sin la rama se quedarían sin tiempo al
abrirlas. La V44 **no toca las archivadas** a propósito — ponerles el número nuevo reescribiría
hacia atrás lo que se le dijo a esa gente.

⚠️ **Y el número se perdía en la primera actualización del banco.** Nada lo escribe salvo la
migración: ni el importador de Excel —el archivo **no lo trae**, comprobado hoja por hoja: la
portada está vacía y la única con números guarda los pesos de los pilares— ni `crearVersion`, y
no hay endpoint que lo edite. Publicar la v4 de Dirección archivaba la v3 con sus 60 minutos y
dejaba el examen leyendo el de la plantilla, que es **justo el valor que la V44 vino a
corregir**. Ahora `publicarVersion` lo hereda de la que reemplaza, y `CopiadorDeInstrumentos`
lo copia como ya copiaba `metodoCalificacion`.

### Lo que ve el panel

Donde había un desplegable hay una frase: **«Banco CAZATALENTOS · Ejecutivo y Operativo — 35
minutos»**. Los datos ya estaban a mano; lo que faltaba no era elegir mejor, era decir qué va a
pasar. `useBancoDelNivel` los resuelve una vez y lo comparten la cabecera y la sección.

⚠️ **Tres ramas, no dos, y la tercera es la que importa.** `GET /banco-preguntas/versiones`
pide `ver_banco_preguntas`, que el detalle de la vacante **no** pide: un rol con `ver_vacantes`
y sin aquel recibe un 403. Sin mirar `isError`, la pantalla afirmaría «no hay ningún banco
publicado para este nivel» —mentira, y además contradiciendo al backend, que sí lo ve y deja
publicar—. Ahora dice que **no se pudo saber**, y **no bloquea el botón**: quien decide es el
backend, y frenar por no haber podido mirar atasca la vacante por un permiso que no es el de
publicar. Lo mismo con un puesto desactivado, que `listarPuestos` no devuelve.

⚠️ **El desempate del panel tuvo que copiar al del backend.** La lista llega en `creadoEn desc`
y el backend elige por `publicadaEn desc`: con dos publicadas del mismo nivel —situación que el
panel del banco documenta y avisa— el panel nombraría una y el candidato respondería la otra.

### Tres defectos del mismo bloque que caían de paso

- **`Number('')` es `0`.** Volver a «Elige…» mandaba un id `0` y el backend contestaba «not
  found with id: '0'». ⚠️ **Su primera prueba pasaba en verde con el fallo dentro, dos veces**:
  sobre un `<select>` que ya vale `''` el navegador no dispara `change`, y `mutate` **encola**,
  así que un `not.toHaveBeenCalled()` justo después del evento corre antes de que la mutación
  salga. Se **cuentan** las llamadas.
- **La prueba del puesto no se filtraba.** Ofrecía «Cuestionario técnico · Administrador
  General» para una vacante de Desarrollador web. ⚠️ **La genérica (`puestoId: null`) sigue
  saliendo**, y **la que la vacante ya tiene puesta no se filtra nunca**: el backend no valida
  el puesto al asignarla, así que esconderla dejaría el `<select>` diciendo «Elige la prueba…»
  sobre una vacante que sí la tiene.
- **«Los pesos generales» era una opción que no existe.** No hay ruta que desasigne: solo
  `POST .../version-pesos`, que exige un id. Se apaga la opción y se dice por qué.
---

## La prueba técnica del puesto: la ficha y el cuestionario de la IA (28/08/2026)

El backend cerró el ciclo 1 del método CAZATALENTOS (PR #48, V42): una **ficha del puesto**
que llena el dueño con sus palabras y un **cuestionario técnico por vacante** que redacta el
agente REDACTOR a partir de ella y el dueño corrige y publica. Esto es su pantalla:
`/admin/vacantes/:id/prueba-tecnica`, la **primera sub-ruta de una vacante**, con una tarjeta
de estado bajo «Qué responderá quien postule» que enlaza a ella. Todo vive en
`src/panel/vacantes/prueba-tecnica/`.

### Página propia, y no dos secciones más en la vacante

`Vacante.tsx` apila secciones y pasa de las mil quinientas líneas; la ficha son diez respuestas
largas y el cuestionario una docena de preguntas con su guía. En la vacante queda solo la
tarjeta (`EstadoDeLaPruebaTecnica.tsx`): «Ficha: a medias · Cuestionario: sin pedir» y el
enlace. **No entra en la puerta de publicar la vacante** —ni en `leFalta` ni en
`listaParaPublicar`—: el backend no lo exige, y el panel no inventa puertas. Si un día lo
exige, hay que tocar las dos o el botón y el cartel se contradicen.

### La ficha (`FichaDelPuesto.tsx`, guion en `guion.ts`)

- **Se guarda con un botón, no sola.** Son respuestas pensadas, y el `PUT` es un **reemplazo
  completo**: lo que no viaje se borra en el servidor. `aCuerpo` recorre los 22 campos del
  record siempre, y hay test que los cuenta.
- **«Hay cambios sin guardar» sale de comparar** con lo último que el servidor confirmó, y
  «Guardada.» también — nunca por decreto. `beforeunload` avisa si se cierra la pestaña; dentro
  del portal no hay enrutador de datos que bloquee, así que se dice en pantalla todo el rato.
- **COMPLETA la decide el servidor** y llega en `estado`; `queLeFalta` es una copia para decir
  *qué* falta antes de guardar (Q1–Q9, las dos cifras, los cuatro riesgos, la primera
  eliminatoria, una familia). Si difieren, manda el servidor y se corrige la lista.
- **Los riesgos van en orden y sin huecos.** El N+1 se apaga hasta que el N tenga texto, que es
  la regla que el backend aplica con un 400. Igual eliminatorias (2) y requerimientos (3).
- El **tamaño** (MICRO/MEDIA/GRANDE) lo deriva el servidor de la cifra de gente y sugiere la
  `version_pesos` de la etapa 1; «Usar estos pesos» llama al mismo `asignarVersionPesos` que el
  desplegable de la vacante. Con `yaAsignada` lo dice y no ofrece botón.

⚠️ **«ficha» ya significa la ficha del candidato** (`verFicha`, `FichaPostulacion`). Lo nuevo se
llama *del puesto*: `verFichaDelPuesto`, `FichaDelPuesto`.

⚠️ **Los tests de Playwright piden `exact: true`** en «Cuánta gente hay en la empresa»: la
pregunta Q5 lleva esa misma frase dentro de su etiqueta y `getByLabel` a secas resuelve dos
elementos. En vitest no pasa: `getByLabelText` con texto es exacto.

### El cuestionario (`CuestionarioTecnico.tsx`, bloques en `bloques.ts`)

- **Pedir no es tener.** `POST …/generacion` contesta 202 y la IA tarda uno o dos minutos. Aquí
  **sí hay endpoint de estado**: `generacion` dice SIN_PEDIR · EN_CURSO · FALLIDA · LISTA, así
  que el sondeo sigue al servidor y no al botón: arranca solo si al abrir ya está EN_CURSO y
  **se corta al salir de EN_CURSO** aunque queden vueltas. Para eso `useSondeoAcotado` —que
  salió de `CalificarConIa.tsx` a su archivo, sin cambiar de comportamiento— ganó un `parar`.
  Al agotarse dice «dejamos de refrescar», nunca «falló».
- **`encolada=false` no es un error**: ya hay una generación viva o la IA está apagada. Nube
  hundida y `status`. FALLIDA sí es `alert`, y se puede volver a pedir.
- **El 400 de publicar es una lista.** El servidor junta la aduana con « · » y
  `erroresDeLaAduana` la separa para pintar un `<ul>`; un 409 (la ficha a medias) se lee tal
  cual.
- **La PRESENCIAL se pinta distinta** (contorno ámbar y su marca escrita): es la muestra de
  trabajo y **nunca se envía al candidato**. Solo la lleva DIR.
- **Corregir manda los cuatro campos** aunque cambie uno (reemplazo), y solo sobre el borrador:
  sobre lo publicado no hay botón. «Volver a generar» pregunta en un `Modal` y dice qué se
  pierde según haya borrador (se archiva) o publicado (sigue vigente hasta publicar el nuevo).
- Cada generación cuenta contra el tope de IA de la empresa, y el texto lo dice.

### Cómo se comprueba

```bash
npm run typecheck && npm test           # 41 tests nuevos: guion, bloques, ficha, cuestionario, tarjeta
npx playwright test herramientas/e2e/17-prueba-tecnica.spec.ts             # Chrome real: hasta la ficha COMPLETA
npx playwright test herramientas/e2e/17-prueba-tecnica.spec.ts # …y el cuestionario de verdad, hasta publicarlo
```

⚠️ **Sin `DE_VERDAD=1` no le pide nada a la IA** —cuesta una llamada a DeepSeek y cuenta
contra el tope— y lo dice. Contra una base recién sembrada hacen falta un área y un puesto
(el catálogo nace vacío) y las `version_pesos` CAZATALENTOS publicadas para que aparezca
«Usar estos pesos»; el script del backend `completar-y-publicar-pesos-cazatalentos.py` lo hace.

### El ciclo 2 ya está hecho

Que el candidato **rinda** el cuestionario y que se califique contando criterios entró el
30/08 — ver la sección de arriba. Lo que sigue faltando es la textura F1–F7, la repregunta, el
índice combinado 45/55 y el corte automático por índice.
---

## La contraseña se puede mirar, y salir dejó de estar escondido (28/08/2026)

Tres cosas pedidas de una vez, y las tres tocan la misma pregunta: dónde espera encontrar algo
quien lo está buscando.

### El ojo se implementa UNA vez, en `Campo.tsx`

Hay **cinco** campos de contraseña —entrar, crear cuenta con su repetición, la entrada del
equipo y la invitación con la suya— repartidos entre el portal y el panel, y los cinco usan el
mismo `Campo` de `@/ui/campos/Campo`. Escribirlo en cada pantalla habría sido escribirlo cinco
veces y arreglarlo cinco veces. Es la razón por la que esa pieza existe.

⚠️ **`type` se saca del spread a mano.** Llegaba dentro de `...resto` y aterrizaba en el
`<input>`; si se deja ahí y encima se escribe otro `type`, **el que gana lo decide el orden de
las líneas**. El ojo dejaría de cambiar nada sin que nada fallara.

⚠️ **El botón lleva `type="button"`.** Sin él es de envío: pulsar el ojo intentaría entrar. Es
la trampa que este portal ya pagó una vez, y por eso tiene test propio.

⚠️ **El icono dice la ACCIÓN, no el estado.** Con la contraseña tapada se dibuja el ojo abierto
—«mostrar»—, que es lo que también dice su `aria-label`. Al revés, el dibujo diría una cosa y
quien usa lector de pantalla oiría la contraria.

Y va dibujado a mano en SVG, no como emoji: un glifo cambia de forma en cada sistema y no
hereda el grosor de trazo. Sin violeta —aquí no le toca nada a nadie, solo está mirando lo que
ya escribió—: `--tinta3`, **4,88:1** contra la nube en reposo, `--tinta2` al pasar por encima.

⚠️ **Medir el color después de un `click()` de Playwright da el del hover**, porque el ratón se
queda encima: la primera medida salió 7,5:1, que es `--tinta2`. Se lee sin tocar el ratón.

⚠️ **`getByLabel('Contraseña')` de Playwright ya no basta, y rompió un e2e.** Busca por
subcadena, y ahora «Mostrar la contraseña» también casa: resolvía **dos** elementos.
`e2e-panel-entrar.mjs` usaba ese selector en dos sitios y se pasó a
`getByRole('textbox', { name: 'Contraseña' })`. Los otros tres usos ya llevaban `exact: true`
y siguen valiendo. En Testing Library **no** pasa: `getByLabelText` es exacto por defecto.

### Cerrar sesión vive en «Mi cuenta», no al final de Privacidad

Estaba en el pie de «Privacidad y tratamiento de datos», detrás de retirar una postulación,
salir del radar de talento y pedir el borrado — **tres acciones que no se deshacen** y que no
tienen nada que ver con salir de la sesión en un ordenador prestado. Ahora está arriba en
`/perfil`, que es a donde lleva «Mi cuenta» de la cabecera, alineado con la base del titular.

⚠️ **También está en la pantalla de fallo del perfil.** Si el perfil no carga, esa **es** la
pantalla entera de «Mi cuenta»: sin el botón ahí, cerrar sesión volvería a estar escondido
justo el día que algo se rompe.

⚠️ **Después de salir se navega a las vacantes.** `salir()` solo borra el token, y `Privada` no
desvía: deja la dirección y cambia la pantalla por el muro de «Ingresa para ver tu proceso».
Quedarse en `/perfil` después de pulsar un botón se lee como que algo falló.

No pregunta antes: no se pierde nada. Confirmar lo que no destruye gasta el aviso que sí
importa.

### Fuera el bloque «Con el enlace que te enviamos»

Por decisión del cliente. Con él se fueron la frase «Hay dos formas de entrar…» —que con un
solo camino mentía—, el subtítulo «Con tu correo y contraseña» y la caja que los separaba:
sin nada al lado, un recuadro no separa de nada. La pantalla quedó como su hermana de crear
cuenta, que es lo que dice la cabecera de `Cuenta.module.css`.

⚠️ **El mecanismo NO se tocó.** `/acceso` sigue canjeando el token igual, y quien llega por el
enlace del correo entra sin pasar por aquí. Lo que ya no ocurre es que alguien de esa vía que
aterrice en `/ingresar` se entere de dónde buscar su correo — y sigue siendo, según
`PRODUCT.md`, la vía de toda una tanda de candidatos.

⚠️ **`.caminos`, `.camino`, `.tituloCamino` y `.queEs` NO son CSS muerto**: los usa `/clave`,
que sigue teniendo dos salidas en paralelo. Solo se borraron `.pista` y `.asunto`.

El maquetado (`maquetado/Entrar.body.html`) conserva el bloque: es la especificación aprobada
y material de referencia, no la pantalla.

### Cómo se comprueba

`npm test` — **247** (236 + 11 nuevos), y `npx tsc --noEmit` limpio.

- `Campo.test.tsx`, **6**: que nace tapada, que no se pierde lo escrito, que el ojo **no envía
  el formulario**, que apunta al campo, que un campo que no es contraseña no lo lleva, y que el
  error sigue atado con el campo destapado.
- `Ingresar.test.tsx`, **3**: que los tres textos del bloque no vuelven, que el formulario y sus
  dos salidas siguen, y que la contraseña se puede mirar desde ahí.
- `Perfil.test.tsx` sube a **10**: que «Cerrar sesión» se ve al entrar y que borra el token.

⚠️ **`Perfil.test.tsx` necesitaba `ProveedorSesion` y no lo tenía**, en `montar()` y en un
`render` suelto. Sin él, los ocho tests que ya había reventaban en cuanto el perfil miró la
sesión.

Y a ojo, con lo que ya existe y sin backend: `capturar-publico.mjs`, `capturar-perfil.mjs`,
`capturar-panel-entrar.mjs` y `capturar-privacidad.mjs` —esta última porque al quitar el botón
se fue con él el `.pie` que cerraba la página; cierra bien, el bloque rojo ya trae su contorno—.
El detector de impeccable pasa con **cero** hallazgos.

⚠️ **`e2e-panel-entrar.mjs` se tocó y NO se pudo correr**: necesita el backend en el 8081, que
no estaba levantado. Es justo el escenario que este archivo repite —un e2e roto no avisa, deja
de correrse— así que queda dicho: hay que pasarlo con el backend arriba.

---

## Calificar y ponderar la prueba de la tanda entera (28/08/2026, noche)

El #14 puso el paso que faltaba —ponderar— en la ficha de una persona. Con **diecinueve que
rindieron y ninguna con nota** en una vacante real, abrir diecinueve fichas no es un flujo: es
la misma tarea repetida diecinueve veces. `LaTandaDeLaPrueba.tsx` va **encima de la tabla**, y
solo en la pestaña de la prueba.

### ⚠️ El backend no tiene nada en lote para la prueba, y esto lo orquesta

`criba-rapida` y `criba-fina` son del **currículum** (`PostulacionesPanelController`). Para la
prueba solo existen los dos endpoints **por persona**, así que aquí se llaman N veces, una a una
como el avance en tanda: si el backend rechaza a alguien, el mensaje dice a quién y los demás no
se pierden.

⚠️ **Y tampoco sabe quién está calificado y quién no.** Se averigua pidiendo la rúbrica de cada
uno —`GET .../prueba/notas`, por tandas de ocho— y repartiendo en el panel. Por eso hay un paso
de «revisar» antes de las acciones: son N peticiones y se hacen cuando alguien las pide, no al
abrir la pestaña. El botón dice el coste antes de pulsarlo.

### Los dos verbos NO son el mismo, y por eso son dos botones

**Ponderar** es síncrono, no llama a ningún modelo y deja la nota en la columna al momento.
**Calificar** encola un trabajo del agente que tarda decenas de segundos.

Juntarlos obligaría a mentir sobre uno de los dos: o se dice «listo» sobre algo encolado, o se
dice «puede tardar» sobre algo que ya terminó. Por eso las dos frases del resultado son
distintas, y **solo ponderar puede decir que hay nota** —su respuesta la trae—. Es la regla de
`CalificarConIa.tsx` y hay test.

El reparto tiene **tres grupos**, y el tercero no tiene acción en lote:

| Grupo | Qué se ofrece |
|---|---|
| Rúbrica entera, sin nota de etapa | **Calcular** — el violeta |
| Ningún criterio con nota | Pedirle la calificación a la IA |
| **Rúbrica a medias** | Nada: se termina desde su ficha, criterio a criterio |

⚠️ Volver a pedirle al agente una persona a medias no está garantizado que respete lo que alguien
ajustó a mano, así que se dice en vez de ofrecer una acción que haría daño.

⚠️ **El violeta pasa de la ficha a la tanda.** El botón del #14 baja a secundario: este bloque
está siempre encima de la tabla, y con la ficha abierta se verían dos violetas en la misma
pantalla. Es la misma regla por la que el botón de una persona de `CalificarConIa` es secundario.

### Y lo que se perdió al fusionar el #14 antes de tiempo

Las cifras de la cabecera se quedaron en dos categorías —«esperando a la persona» y «esperando
al equipo»— y **`CALIFICANDO` no caía en ninguna**: en la vacante real de 78 eso son **15
personas fuera de la cuenta**, justo las que rindieron y siguen sin nota. Recuperado aquí: son
tres, **suman siempre**, y la accionable va primero. Con su test y su comprobación en el e2e.

### Cómo se comprueba

```bash
npx playwright test herramientas/e2e/20-prueba-y-empresas.spec.ts
```

**40 comprobaciones** (35 + 5 nuevas): a quién alcanza el bloque, que no alcanza a quien no ha
rendido, y que el reparto cuadra con lo que devuelve la API.

⚠️ **La vacante se elige, no se fija.** A quien alcanza es a quien está **parado** en la prueba
sin nota, y el estado retrocede: en la base local las que rindieron volvieron a
`PERFIL_CALIFICANDO`, así que la vacante de las pruebas rendidas **no tiene ni un caso**.
Fijarla dejaba esta mitad sin ejercitar y pasando en verde. Es el patrón de
`e2e-ranking-etapa.mjs`.

⚠️ **No se pulsa ninguno de los dos botones, y el script lo dice.** Ponderar escribe y se comería
el caso; calificar cuesta una llamada al modelo por persona.

### Lo que habría que pedirle al backend

**Que `calificacion-ia` pondere al terminar el agente.** Es la raíz: si la nota de etapa naciera
sola al acabar la calificación, ni el botón de la ficha del #14 ni la mitad de este bloque harían
falta. Un endpoint de lote ahorraría las N llamadas, pero no arregla la causa.
---

## El desplegable se cerraba solo, y no era del `<select>` (28/08/2026)

«Lo intento abrir pero se cierra al instante», sobre los cuatro desplegables de **Vacante
nueva**. La sospecha obvia —el `<select>` envuelto en `<label>`, que es como está todo el
panel— **es falsa y se descartó midiendo**: en Chrome y en Firefox el clic no se duplica, y con
datos el desplegable se abre y se queda abierto.

### Lo que pasaba: el formulario se desmonta bajo el ratón

`listarSolicitudes` **nace con el formulario** —su `useQuery` vive dentro de `FormularioDeAlta`,
que solo se monta al pulsar «Crear vacante»— así que `isPending` es cierto en **todo primer
clic**, no solo con una red lenta. La guarda era
`if (abiertas.length === 0 && !solicitudes.isPending)`, o sea: **pintar el formulario mientras
la lista viaja**. Si no venía ninguna `ABIERTA`, lo sustituía el callejón de «no hay ninguna
aprobada» y los cuatro `<select>` se desmontaban con el ratón encima.

Medido en Chrome contra el backend local, retrasando solo esa respuesta:

| | Con la lista en vuelo | Al llegar la respuesta |
|---|---|---|
| Antes | **4 desplegables**, el de solicitud con **1 sola opción** | **0** — se desmontan |
| Ahora | 0, y una línea que dice «Buscando las solicitudes aprobadas…» | 0 |

⚠️ **El segundo síntoma es el mismo sin desmontaje.** Un `<select>` cuya única línea es
«Elige…» se abre, no hay nada que elegir y no se dice por qué. Ahora `Selector` se apaga y lo
cuenta mientras su lista viaja, y **distingue eso de que la lista llegara vacía** —«No hay
ningún puesto en el catálogo»—: una manda a esperar y la otra a dar de alta un puesto.

### ⚠️ El backend admite VARIAS solicitudes abiertas, y el panel lo impedía

Comprobado contra el local: se crearon dos y **las dos se aprobaron con 200**. No hay ninguna
regla que limite a una.

El botón de escribir una solicitud vivía **dentro** del callejón de «no hay ninguna aprobada».
En cuanto había una, ese bloque desaparecía y se llevaba el botón: **con una sola abierta no
había forma de escribir la segunda desde el panel**. Ahora vive en la cabecera y existe siempre.

⚠️ **Va FUERA del `<form>` de alta, como bloque hermano.** Un formulario dentro de otro lo
descarta el navegador, y en esta misma pantalla ya costó un fallo. Hay test:
`document.querySelectorAll('form form').length === 0`.

⚠️ **Y la fixtura mentía otra vez, la quinta.** `datos-panel.mjs` servía `estado: 'APROBADA'`,
que el backend no usa —los de verdad son `ABIERTA`, `CON_VACANTE`, `RECHAZADA`, `BORRADOR`—,
así que las capturas enseñaban el callejón creyendo enseñar el formulario y **sus cuatro
desplegables no se miraban nunca**. Ahora siembra una `ABIERTA` y una `CON_VACANTE`.

### Cómo se comprueba

`Vacantes.test.tsx`, **7 tests**, y los cinco primeros **se ponen rojos sin el arreglo**
(comprobado revirtiendo el archivo con `git stash`).

⚠️ **El del desmontaje mira ANTES de soltar la respuesta, y eso es lo que lo hace valer.**
Afirmar solo el estado final pasa en verde con el fallo dentro: al terminar tampoco hay
`<select>`, porque los cuatro ya se desmontaron. Lo que no puede pasar es que llegaran a existir.

⚠️ **Este fallo no se ve en una captura**: la fixtura contesta al momento, así que la ventana
donde ocurre no existe. Se reproduce retrasando `/solicitudes` con `contexto.route(...)`.

---

## Calificar la prueba no dejaba nota en el ranking (28/08/2026)

La columna «Nota de la prueba» seguía en blanco después de calificar, y **no era la pantalla**.

### El paso que faltaba, y que el panel no ofrecía

`POST /postulaciones/{id}/prueba/calificacion` —«Ponderar las notas ya puestas»— **existe desde
siempre y no estaba cableado**. Calificar con IA pone la nota de **cada criterio** de la rúbrica;
la nota de la **etapa** —la que sale en la columna y con la que se ordena— nace solo de
ponderarlas. Sin ese botón, la rúbrica se llenaba y la columna se quedaba vacía, sin nada que
pulsar.

Comprobado en la base local: la postulación **16** tenía sus **siete criterios calificados por el
agente** y ninguna nota de etapa. Un solo POST la produjo (`{"nota": 0.00}`).

⚠️ **Un guion en la columna significa tres cosas y solo una es del panel:**

| Situación | Qué toca |
|---|---|
| No rindió la prueba | Nada que calificar |
| La rindió y nadie la calificó | Pedirle la calificación a la IA (ese botón ya existía) |
| **Calificada entera y sin ponderar** | El botón nuevo. **Era el caso invisible** |

`NotaDeLaPrueba.tsx` dice en cuál de las tres está cada persona, debajo de la rúbrica.

⚠️ **El 409 nombra los criterios que faltan uno a uno**, en español, y se enseña tal cual:
resumirlo a «faltan notas» tiraría lo único accionable del mensaje.

⚠️ **`0` es una nota.** La 16 tiene sus siete criterios en 0.0 y su nota de etapa es 0.00. Un
`!puntaje` la contaría como vacía y escondería el botón justo en la fila que lo necesita.

### ⚠️ El estado de una postulación RETROCEDE, y eso rompía un texto del #13

Comprobado en el historial de las postulaciones 16 y 18: **`PRUEBA_CALIFICANDO →
PERFIL_CALIFICANDO`**. Rindieron la prueba y volvieron al perfil —se recalifica el currículum y
el proceso va hacia atrás—.

Por eso el ranking **ya no dice «Todavía no llega a esta etapa» ni «Pasó de esta etapa»**: sobre
la 16, que tiene los siete criterios de la prueba calificados, la primera frase era falsa. Dice
**dónde está ahora** —«Su proceso está en Perfil integral»—, que es lo único que se puede
afirmar con lo que la fila trae, y además dice qué pestaña mirar.

Lo mismo con `CALIFICANDO`: decía «Calificándose ahora mismo» y eso afirma que el sistema está
trabajando. Puede que nadie haya pedido la calificación, o que esté calificada y solo falte
ponderar. Ahora dice **«Ya la hizo: su nota se calcula en la ficha»**.

### ⚠️ Toda nota de la IA decía «ajustado a mano»

`origen` vale **`AGENTE`** o **`PERSONA`** —los escriben `PuentePruebaIaImpl` y
`ServicioCalificacionPrueba`—, y el panel comparaba con `'IA'`, que no llega nunca. Así que
**toda nota puesta por el agente caía en el `else` y decía que un humano la había tocado**. Un
valor desconocido se enseña tal cual en vez de caer en una de las dos ramas: inventarle un autor
es peor que no saberlo.

### Cómo se comprueba

```bash
npx playwright test herramientas/e2e/20-prueba-y-empresas.spec.ts
```

**35 comprobaciones** (28 + 7 nuevas): las tres situaciones del guion, que la rúbrica entera
ofrece el botón, que la vacía no lo ofrece, y el 409 con sus criterios nombrados.

⚠️ **El botón NO se pulsa, a propósito, y el script lo dice en voz alta.** Calcular escribe, y se
comería el único caso de la base local que reproduce el fallo: sin él, la próxima vez que alguien
corra la prueba no tendrá nada que mirar.

⚠️ **Y el repro se consumió una vez.** Al diagnosticar se ponderó la 16 y se perdió el caso;
hubo que recrearlo con un `delete from nota_etapa where postulacion_id=16 and etapa_codigo =
'PRUEBA_PUESTO'`. Si vuelve a hacer falta, es esa línea.

---

## El ranking enseña quién tiene nota, y por qué el resto no (28/08/2026)

Tres cosas, y la del medio explica la queja que las trajo: «algunos ya respondieron, están
calificados y no se ve su nota».

### ⚠️ Lo que estaba mintiendo: las cuatro cifras de arriba son de OTRA etapa

`calificados`, `enCurso`, `fallidos` y `conPasadaFina` salen de **`ColaCalificacionIa`**, que es
la cola que califica el **currículum** con IA, y el servicio no la filtra por `?etapa=`.
`notaEtapa` sí sale de `nota_etapa` filtrada por la etapa pedida.

Medido contra el backend vivo, vacante 3: las cuatro cifras son **idénticas en las cinco
pestañas** (16 / 5 / 0 / 9) mientras las filas con `notaEtapa` van **5, 1, 1, 1**. De ahí salía
«76 calificados» encima de setenta y ocho guiones, y la lectura natural era que la pantalla
estaba rota.

Ahora cada pestaña **cuenta lo suyo** —«1 de 78 con nota de la prueba · 11 esperando a la
persona»— y lo del currículum baja a su propia línea **con su nombre puesto**: «La criba del
currículum con IA va por 65 de 78 calificados — eso es del currículum, no de esta etapa».

⚠️ **Casi ningún campo del ranking es de la etapa que se mira.** `?etapa=` cambia UNA cosa.
`estadoCalificacion`, `pasada`, `adecuacion`, `potencial`, `altoRendimiento`,
`confianzaEvidencia`, `resumen`, `fortalezas`, `riesgosCriticos` y **hasta `notasCriterio`** se
arman sin mirar la etapa: los tres primeros vienen de la cola del CV, el resto del
`PerfilTalento` y de los criterios del currículum (`delCurriculum` usa la constante
`ETAPA = "PERFIL_INTEGRAL"`). Está escrito en la cabecera de `ranking.ts`.

### Un guion significaba cinco cosas y no decía cuál

`porQueNoHayNota()` lo nombra debajo de la cifra, en palabras: «Le toca a la persona: aún no la
ha hecho», «Calificándose ahora mismo», «Hecha, pendiente de que el equipo la cierre»,
«Todavía no llega a esta etapa», «Pasó de esta etapa sin que quedara nota» y «Terminó su
proceso sin nota de esta etapa».

⚠️ **`estadoCalificacion` NO sirve para explicarlo fuera del perfil.** Un `TERMINADA` en la
pestaña de la prueba dice que el currículum está calificado y no dice nada de la prueba —es
exactamente el origen de la queja—. Lo que sí es de la etapa es **dónde está parada la
persona**, y de ahí salen los seis motivos. Hay test: los seis son distintos entre sí, con
`estadoCalificacion` fijo en `TERMINADA` en las seis filas para que ninguna regla pueda
apoyarse en él.

### Tres cortes, no una casilla

«Con nota de esta etapa» (por defecto), «Está aquí ahora» y «Toda la tanda», cada uno con su
cifra dentro. El del PR #11 se queda: **los dos primeros eligen gente casi opuesta** fuera del
perfil integral. En la prueba, quien «está aquí ahora» es quien **todavía no la ha rendido** —hay
que perseguirlo— y quien tiene nota **ya pasó de largo** —con él se decide—. Medido en la vacante
3: una fila cada uno, **sin una sola persona en común**.

Las tres cifras se cuentan **de las filas sin filtrar**, nunca de lo que se pinta: derivarlas de
lo visible haría que «Con nota» dijera siempre «12 de 12».

### Lo que justifica la decisión de la IA, y dónde cabe

| Dónde | Qué |
|---|---|
| La tabla, solo en Perfil integral y Decisión | Adecuación y Potencial |
| **Riesgos y Alertas, separadas** | Eran una cifra sumada. Son dos tablas distintas: un riesgo crítico lo escribió el agente sobre el perfil, una alerta la levantó el proceso. El «3» sumado no se podía ir a mirar a ningún sitio |
| La ficha abierta | Las **cuatro** dimensiones con **qué mide cada una** debajo, el recuento de fortalezas/riesgos/alertas, cuándo se calificó, si la nota es de la criba rápida, y el `resumen` en prosa |

⚠️ **El retrato de la ficha sale de `fila`, no de `verPerfilIntegral`.** Ya viene en el ranking:
esperar a otra petición para enseñar cifras que ya se tienen deja la justificación en blanco
durante el segundo en el que se decide.

⚠️ **Con las cuatro dimensiones en la tabla, no cabía.** Medido a 1920: 1314 px dentro de una
envoltura de 1038, y la columna de **Estado quedaba fuera del scroll**. Con dos: 1052 sobre
1038. Las otras dos viven en la ficha, que además es donde cabe decir qué miden — un «79» bajo
una cabecera de dos palabras no justifica nada.

⚠️ **El retrato salía a una sola columna** aunque el CSS pedía `auto-fit`: la columna del
detalle mide **323 px medidos**, no los 660 que parecían. Es `repeat(2, …)` fijo.

### Cómo se comprueba

`ranking.ts` sale de `Vacante.tsx` con **18 tests propios** —las reglas tienen casos, no
dibujo— y `Vacante.test.tsx` sube a 14.

⚠️ **El mock de `verRanking` tuvo que respetar la etapa.** Devolvía la misma nota en las cinco
pestañas, así que no podía probar una pantalla que va justamente de eso: tres afirmaciones mías
eran falsas y pasaban. Ahora hay un `NOTAS_POR_ETAPA` y Camila reproduce el caso del usuario —el
currículum calificado, la prueba sin nota—.

⚠️ **Y la fixtura mentía dos veces más.** `estadoCalificacion: 'CALIFICADA'` y `'PENDIENTE'`
**no existen** (los cuatro son `SIN_EMPEZAR`, `EN_CURSO`, `TERMINADA`, `FALLIDA`), y el ranking
servía la misma nota en las cinco pestañas porque **el interceptor de `capturar-panel.mjs`
descarta la query string**. Las dos corregidas: `rankingDeLaEtapa()` responde por etapa y el
interceptor mira `searchParams` en esa única ruta.

⚠️ **Y a escala real.** La fixtura tenía 8 filas y una tanda de verdad trae 78: con ocho no se ve
si la tabla desborda ni si el control cabe al lado de las cifras. Ahora las 8 escritas a mano
—cada una cubre un caso— más 70 generadas, con casi nadie con nota fuera del perfil, que es como
se ve una vacante de verdad.

```bash
npx playwright test herramientas/e2e/18-ranking-contra-api.spec.ts
```

**42 comprobaciones contra el backend vivo, solo lectura.** Además de lo que ya miraba, fija que
**la cifra de cabecera es de la etapa y no de la criba del CV**, que la línea del currículum dice
que no habla de esta etapa, y que cada guion trae su motivo. En la vacante 3 los dos primeros
cortes divergen en las cuatro etapas que no son el perfil:

| Pestaña | Con nota | Está aquí ahora |
|---|---:|---:|
| Perfil integral | 5 | 12 |
| Prueba del puesto | 1 | 1 |
| Simulación | 1 | 0 |
| Validación | 1 | 0 |
| Decisión | 0 | 1 |

⚠️ **`e2e-etapas.mjs` se rompió por lo de siempre y hubo que tocarlo**: entraba por la casilla
«Ver la tanda entera», que ya no existe. Y además **leía la nota con un `textContent` de la
celda**, que ahora devuelve «—Todavía no llega a esta etapa» porque el porqué vive dentro: se lee
el primer nodo de texto. Su `verTandaEntera(false)` vuelve a «Está aquí ahora», que es lo que ese
paso mide — no al corte por defecto.

---

## El banco de preguntas tiene ciclo de vida (27/08/2026, noche)

`BancoPreguntasController` lleva desde siempre publicar, archivar, descartar, renombrar y
crear, y el panel solo sabía importar el Excel y listar. Ahora vive en su propio archivo,
`src/panel/configuracion/BancoDePreguntas.tsx`, porque una lista plana no sostiene cinco verbos
con cinco consecuencias distintas.

### Lo que estaba mintiendo: tres bancos «PUBLICADA» por nivel y solo uno circula

`laPublicadaDelNivel` es `order by publicadaEn desc limit 1` por organización, tipo de banco y
nivel — **eso es lo que se le fija a quien empieza su evaluación**. Dejar dos publicadas del
mismo nivel «funciona» y el backend ni se queja. En la base local hay **tres niveles así ahora
mismo**: las de agosto rigen y las de abril no, y las seis filas decían exactamente lo mismo.

Por eso las versiones **se agrupan por (tipo de banco, nivel)**: es el único corte donde la
pregunta «cuál rige» tiene respuesta. Cada grupo avisa si tiene más de una publicada, y las dos
etiquetas —«Se asigna a quien empiece ahora» y «Publicada, pero no se asigna a nadie»— **llevan
la frase entera dentro**, no un tono: en gris las dos filas volverían a ser la misma.

⚠️ **«Rige» es «se le fija a quien empiece ahora», no «la que usa todo el mundo».** Quien ya
empezó conserva la suya aunque se publique otra (RF-138) y se le califica con las claves de la
versión archivada. Decirlo de otra forma haría creer que publicar mueve un examen en curso.

### Publicar archiva a TODAS las hermanas, no a «la anterior»

Es un `for` sobre `findPublicadasHermanas`. Publicar el borrador de Dirección archiva la 8 **y**
la 4. La confirmación las **nombra una a una** por su etiqueta, antes de pulsar y otra vez
después.

⚠️ **`validarCoherencia` para en la primera pregunta que falla**, no recolecta. El 409 nombra un
solo código; si hay tres rotas hacen falta tres intentos. La pantalla lo dice, para que nadie
lea ese mensaje como la lista completa. (El importador de Excel sí recolecta todo — son dos
mecanismos distintos.)

### Los cinco 409 vienen escritos en español y se enseñan tal cual

| Qué | Qué contesta |
|---|---|
| Publicar una PUBLICADA | «Solo se publica una versión en borrador; esta está PUBLICADA» |
| Archivar un BORRADOR | «Solo se archiva una versión publicada…» |
| Archivar sin reemplazo | «Archivar dejaría a N candidato(s) sin banco de preguntas…» |
| Renombrar un BORRADOR / una ARCHIVADA | «un borrador se edita entero» / «una archivada ya no se toca» |
| Publicar una versión vacía | «No se publica un banco vacío…» |

⚠️ **Que ese `detail` llegue entero a la pantalla no lo puede probar un test de unidad.** Los de
unidad construyen el `ErrorApi` con el mensaje ya puesto, así que afirman la suposición; entre
el 409 y el párrafo rojo hay una pieza que ninguno de los dos lados mira —`mensajeDe()` de
`puerta.ts`, que elige entre `detail`, `title` y `message`—. Si un día eligiera `title`, los
cinco 409 dirían «El estado actual no permite esta operación» y todo seguiría en verde. El e2e
lo comprueba en pantalla, con una versión propia que publica a un 409 seguro.

**El único que hay que traducir es el 404**, y es el que más engaña: `laVersionPropia` compara
el `organizacionId` y a lo ajeno lo trata como inexistente. Una empresa que **no personalizó**
el banco ve en la lista las versiones de la plataforma —`listarVersiones` resuelve el dueño con
`DuenoDelInstrumento`— y publicar cualquiera de ellas responde «no encontrada» sobre una fila
que está mirando. `VersionBancoResponse` no trae el dueño, así que no hay forma de saberlo
antes: se aprende del primer 404 y se dice qué significa.

### Tres tipos que mentían, y la tercera fixtura inventada

- **`VersionBanco` declaraba un campo `nombre`** que el `record` no tiene —el nombre es
  `etiqueta`— y lo tapaba con un `[otros: string]: unknown`. Ahora es copia exacta de
  `VersionBancoResponse`, y `tsc` señaló solo la rama muerta que lo usaba.
- **`importarBanco` decía devolver una `VersionBanco`** y devuelve `ResultadoImportacion`: el
  recuento de preguntas, opciones, tramos, campos, pares y dimensiones. Ese recuento es lo único
  que permite comprobar que el Excel entró entero —a un archivo sin la hoja de opciones se le
  importan las preguntas y no falla— y se tiraba para decir «Banco importado» a secas.
- **La fixtura de `datos-panel.mjs` servía `nombre: 'v3'` y ningún `tipoBanco`.** Es la **cuarta**
  vez que una fixtura inventada tapa algo, y la segunda el mismo día. Ahora siembra el escenario
  de la base local: **dos publicadas del mismo nivel**, un
  borrador, una archivada y un banco de ALINEACION sin nivel.

### ⚠️ Un banco de ALINEACION no reparte por nivel, y el backend lo trata distinto

`archivarVersion` mete la guarda de «archivar sin reemplazo» **dentro de un
`if ("NIVEL".equals(tipoBanco))`**, y `archivarYRepuntar` hace lo mismo con el repunte de quien
no empezó. En un banco de alineación ninguna de las dos se dispara: archivar la única publicada
funciona y deja el banco sin nada detrás, sin avisar.

Por eso tres frases de la pantalla cambian según el tipo de banco, y ninguna dice «en este
nivel» sobre ALINEACION. Es invisible en las capturas y en la base local —hoy no hay ninguna
versión de alineación— así que **la guardan tres tests de unidad**.

### Dos permisos, no uno

`publicar_version_banco` abre publicar, archivar y renombrar; `editar_banco_preguntas` abre
importar y descartar. Se aprenden **por separado** del primer 403 y cada uno retira solo lo
suyo — colapsarlos retiraría acciones que sí están permitidas. Sigue sin haber `GET
/panel/auth/yo`.

### Lo que no se ofrece, aunque el endpoint exista

**Crear una versión en blanco.** `POST /banco-preguntas/versiones` funciona, pero una versión
vacía no se puede publicar (409) y **desde el panel no hay forma de añadirle una sola pregunta**:
el editor de ítems —preguntas, opciones, tramos, campos de caso, pares— no está construido. El
botón crearía filas que no llevan a ningún sitio. La función de API sí existe porque **el e2e la
usa**, que es donde sirve.

**Los `PATCH .../textos` de una publicada** (corregir el enunciado de una pregunta, el texto de
una opción…) tampoco se cablearon: son la misma pieza que el editor de ítems.

### El e2e de esta tanda

```bash
npx playwright test herramientas/e2e/19-banco.spec.ts
```

45 comprobaciones: el contrato con sus seis campos exactos, los tres niveles con dos publicadas,
las cinco guardas, el ciclo entero de una versión propia, lo que la pantalla enseña de cada
estado, y el `detail` del 409 leído en el párrafo rojo.

⚠️ **Publicar y archivar de verdad NO se ejercitan, a propósito, y el script lo dice en voz
alta.** Las dos son irreversibles —no hay desarchivar— y un recorrido feliz se comería las
versiones sembradas sin forma de devolverlas. Lo que se ejercita son **las guardas**, que el
backend evalúa antes de escribir nada, y **un ciclo entero sobre una versión propia**: crearla,
chocar con el 409 de «banco vacío» y borrarla. Renombrar con éxito tampoco se prueba: solo vale
sobre una PUBLICADA, que es justo la que no se toca.

⚠️ Lo único que escribe es esa versión de usar y tirar. Si el script muere a mitad puede quedar
viva: su etiqueta empieza por **`e2e-banco `**.

### `verificar-panel.mjs` llevaba roto desde el 25/08

Buscaba el encabezado «El ranking de la tanda», que se llama «El ranking, etapa por etapa» desde
que el ranking se dividió en pestañas. **Reventaba ahí**, así que la simulación y la
configuración no se miraban desde entonces. Es la cuarta vez que un script se queda atrás sin
avisar. Arreglado, y de paso abre el banco.

⚠️ `esClave` llega siempre en `false` en la base local: el importador de Excel no marca ningún
ítem ★. La cifra del resumen dice «0 marcadas como clave» y eso es la verdad, no un campo que no
llega.
## El ranking enseña una etapa, no la tanda entera (27/08/2026, noche)

Las cinco pestañas traían **las mismas filas**: el `?etapa=` del backend cambia de qué etapa es
la nota, **no a quién devuelve**. En la vacante 3 de la base local eso son las 16 postulaciones
repetidas cinco veces, con la nota de la prueba vacía en quien todavía no la ha rendido y vieja
en quien pasó de ahí hace semanas. **Ninguna de las cinco listas era la mesa de decidir de su
etapa.** Ahora cada pestaña abre filtrada: 12 en Perfil integral, 1 en la Prueba, 1 en Decisión.

**El filtro se quedó, invertido: «Ver la tanda entera».** Es un escape, no el modo normal.

⚠️ **Quien terminó no está en ninguna etapa, y con esto deja de verse en las cinco pestañas.**
`CONTRATADO`, `NO_CONTINUA` y `CERRADA` no empiezan por el prefijo de ninguna. Se llega a ellos
solo por el escape — y por eso el escape **vive en el padre y sobrevive al cambio de pestaña**:
la tabla se remonta entera con `key={etapa}`, así que dentro se apagaría solo al mirar la etapa
siguiente. Si hace falta un sitio propio para las terminadas, es una decisión aparte.

⚠️ **Filtrar por defecto obliga a decir cuántas se ven**, y sale de contar las filas pintadas:
«Se ven 3 de 8: quienes están en Perfil integral ahora mismo». Sin esa línea, tres filas debajo
de un resumen que habla de ocho personas parecen una tabla rota. Las cuatro cifras del backend
—tanda, calificados, en curso, fallidos— **son de la tanda entera y se quedan como estaban**.

⚠️ **Los dos vacíos no son el mismo.** «Todavía no hay postulaciones» y «nadie está en
Validación ahora mismo» mandan a buscar en sitios distintos, y **el segundo es ahora el estado
normal** de Validación y Decisión en casi toda vacante: se dice sin alarma y se nombra el
escape con las palabras que lleva escritas la casilla.

**Y la celda del «no hay» hereda el ancho de la tabla, no el de la pantalla** — la misma trampa
que la fila de detalle, y ahora importa porque esa celda se ve a diario. En un teléfono la frase
terminaba a la derecha del scroll. Se arregla en `Tabla.module.css` con `100cqi` + `sticky`
sobre el hijo de `.vacia`, así que **el texto va dentro de un `<p>`**, no suelto en el `<td>`.
Vale para las tres tablas del panel.

### Cómo se comprueba

```bash
npx playwright test herramientas/e2e/18-ranking-contra-api.spec.ts
```

29 comprobaciones contra el backend vivo, **solo lectura**. Elige sola la vacante que reparte su
gente entre más etapas —tomar «la primera» dejaría la prueba a merced del orden del backend— y
compara **lo pintado contra los estados que devuelve la API**, no contra una lista escrita a
mano. Lo primero que mira es que `?etapa=` siga sin filtrar: el día que el backend filtre, esa
comprobación se pone roja y el filtro del navegador sobra.

Y `Vacante.test.tsx`, 9 tests: el filtro por defecto, la terminada fuera de las cinco pestañas,
el escape que sobrevive al cambio de pestaña, los dos vacíos, y que una marca escondida por el
filtro no siga contando en el botón de avanzar.

⚠️ **`e2e-etapas.mjs` necesitaba la tanda entera en cuatro sitios y por eso se tocó**: el viaje
de ana-lopez por cuatro etapas y las dos fichas dejaron de encontrar a nadie al filtrar. **Es el
recordatorio de siempre**: al cambiar una pantalla, corre los `e2e-*` que pasan por ella.

⚠️ **Y la fixtura volvió a tapar el fallo, por tercera vez.** `datos-panel.mjs` traía tres filas
en tres etapas distintas: con el filtro puesto, cinco tablas de una fila y las capturas parecían
rotas. Ahora son ocho filas repartidas —una ya terminada, para ver que queda fuera— y sus cifras
cuadran con las filas. **La ficha de Perfil integral tuvo que cambiar de protagonista**: Camila
está en la prueba, así que en esa pestaña ya no existe.

---

## La prueba por dentro, y la entrada de las empresas (27/08/2026, tarde)

Cuatro huecos del panel que ya tenían endpoint y nadie había cableado, más el enlace que le
faltaba al portal. Todo verificado contra el backend local, no leído.

### Qué se cerró, y qué resultó estar hecho ya

| Lo que faltaba | Cómo quedó |
|---|---|
| **Calificar con IA** | Dos sitios: la tanda entera —criba rápida y fina, encima de la tabla, solo en Perfil integral— y una persona, en su ficha |
| **Ver las respuestas** | `GET /postulaciones/{id}/prueba/respuestas` en la ficha, debajo de la rúbrica |
| **Fecha de cierre** | Dos alcances: la vacante entera y el plazo propio de una persona |
| **Ranking por etapa** | El `?etapa=` ya se mandaba; lo que faltaba eran **las columnas** |
| Apagar el banco | Ya estaba hecho. El interruptor lleva ahí desde el 25/08 |
| Listar versiones de prueba | Sigue sin endpoint, pero **el desplegable vacío era otra cosa** — ver abajo |

### El ranking enseñaba la nota del CV en las cinco pestañas

Las cabeceras eran fijas. «Adecuación» y «Potencial» son dimensiones del retrato que sale del
currículum, y salían igual en Prueba, Simulación y Validación: tres cifras con la misma pinta,
dos de ellas de otra etapa. Ahora **la nota se llama por su etapa** —«Nota de la prueba»— y las
dos del currículum solo aparecen donde significan algo (Perfil integral y Decisión).

⚠️ **Una nota de la criba rápida es provisional y ahora lo dice**, con la palabra debajo de la
cifra. En una columna de números un tono distinto se lee como otro número; y ordenar por una
nota que la criba fina va a pisar es decidir con algo que va a cambiar.

### El desplegable de la prueba estaba vacío por una fixtura que mentía

`datos-panel.mjs` traía `'/plantillas-prueba': [{ …, versiones: [...] }]`. El backend **no
devuelve eso**: `PlantillaResponse` es `{id, nombre, puestoId, esActiva}` y las versiones se
piden una a una. Como la fixtura tampoco servía ninguna versión suelta, en las capturas el
desplegable salía vacío. **Es la segunda vez que una fixtura inventada tapa un fallo** —la
primera fue el `asistio: false`— y las dos veces costó buscar en el sitio equivocado.

⚠️ **El mecanismo tiene nombre y conviene reconocerlo a la tercera.** El interceptor de
`capturar-panel.mjs` acaba en `?? []`, así que **ninguna ruta del panel devuelve nunca un 404**:
toda ruta que la fixtura no conozca contesta 200 con una lista vacía. De ahí salen los dos
fallos. Dos consecuencias al escribir una pantalla nueva: **su rama de «no hay» no se puede ver
en una captura** —hay que mirarla con un test o con el backend de verdad—, y **una fixtura con
una forma que la API no devuelve se ve perfecta** hasta que alguien la usa.

El rastreo de ids sigue existiendo porque `GET /plantillas-prueba/{id}/versiones` sigue sin
existir, pero ya no empieza siempre en el 1 a ciegas:

- **Entra como pista la versión que la vacante ya tiene.** Los ids son una secuencia de toda la
  plataforma: una empresa cuyas pruebas vivan del 40 para arriba no encontraba ninguna, porque
  tres 404 al principio lo paraban.
- **Va por tandas de ocho en paralelo**, no de una en una.
- **Y si no encuentra nada, lo dice**, distinguiendo «no hay ninguna plantilla escrita» de «hay
  plantillas pero ninguna versión usable». Un desplegable con una sola línea vacía deja atascada
  la publicación de la vacante sin explicar en qué.

### Cuatro trampas que encontró el e2e contra el backend vivo

Las cuatro estaban escritas, compilando y con los tests en verde.

**`CierrePruebaResponse` se llama `intentosConPlazoPropio`, no `conPlazoPropio`.** El nombre
corto es una variable local dentro de la implementación de Java. Con él, el campo llegaba
`undefined` y **el único número que ese bloque existe para no callar** —a cuánta gente NO le
aplicó la fecha porque tiene la suya— se perdía en silencio.

**⚠️ `estado` no siempre es `ENCOLADA`, y `SIN_CAMBIOS` significa que NO se encoló nada.** Hay
cuatro motivos —la rúbrica no le reserva criterios al agente, ya hay un trabajo en marcha…— y
todos contestan 200. Tratar el 200 como «se pidió» pintaba «la IA está calificando» y arrancaba
cinco refrescos sobre una cola vacía: **«indicadores que mienten» otra vez**, en una pantalla
nueva. Ahora solo `ENCOLADA` cuenta como encolado, un estado desconocido tampoco se da por
bueno, y en esa rama **sí se pinta el `mensaje` del backend** porque es lo único que distingue
los cuatro motivos.

**Sin versión de prueba elegida, `POST /vacantes/{id}/cierre-prueba` revienta en inglés.** El
`findById(vacante.getVersionPlantillaPruebaId())` recibe null y Spring Data contesta 400 «The
given id must not be null». Es un fallo del backend; mientras tanto **el panel no ofrece ahí el
control** y dice que falta elegir la prueba. Tampoco lo ofrece en una vacante cerrada, que
responde 409.

**Una prueba `CRONOMETRADA` no admite fecha de cierre**, y el backend lo explica bien: el plazo
son los minutos que corren desde que cada uno empieza. El panel enseña ese mensaje tal cual.

### La zona horaria, otra vez

Las dos fechas viajan como `Instant`. `new Date('2036-01-15T23:59').toISOString()` sí da el
instante correcto —la cadena sin zona se interpreta como local—, pero **la vuelta no**:
`toISOString().slice(0,16)` devolvería el reloj de UTC y el campo lo leería como local. Se arma
con `getFullYear/getMonth/getDate/getHours/getMinutes`.

⚠️ **La ida y vuelta sola no prueba nada**: un par de funciones mal escritas la cumple. El test
fija `TZ=America/Lima` y afirma **literales en las dos direcciones**, con el salto de día
(`2035-08-30T23:59` ⇄ `2035-08-31T04:59:00.000Z`). Y la pantalla dice en qué zona se está
hablando, con el eco del instante exacto que se va a guardar.

### La entrada de las empresas va en el pie, no en la cabecera

Los tres enlaces de arriba son el camino de quien postula; un cuarto para otro público los
diluye justo cuando quien busca trabajo más los necesita. Quien trabaja en el panel entra una
vez y lo guarda: lo que necesita es que exista un sitio donde encontrarlo.

⚠️ **Dice «Entrar», nunca «Crear cuenta».** Las cuentas del panel nacen solo por invitación, y
un enlace que prometa registrarse lleva a una pantalla que no puede cumplirlo.

### El e2e de esta tanda

```bash
npx playwright test herramientas/e2e/20-prueba-y-empresas.spec.ts
```

28 comprobaciones: el contrato de los cuatro endpoints, las columnas que cambian con la
pestaña, la ficha con lo escrito, el cierre rechazado por cronometrada, la criba que pregunta
antes y el pie del portal. **Es lo que encontró las cuatro trampas de arriba.**

⚠️ **Escribe poco y todo idempotente**: quita un cierre que ya estaba quitado y pide una
calificación. Lo que no se deshace son las filas de auditoría, y es correcto que así sea.

⚠️ **Esperar a que la URL cambie no basta para dar la sesión por abierta.** El token se guarda
un instante después de la redirección; navegar en ese hueco recarga sin sesión y el panel rebota
a la entrada. El fallo parecía del detalle de la vacante y era de la prueba.

⚠️ **Contra el backend real no valen los `waitForTimeout` fijos** que sirven con las fixturas:
se espera a que la pieza exista.

### Lo que no entra, y por qué

- **La consola de los diez eventos de simulación** sigue sin construirse (viene del #44).
- **`POST /panel/postulaciones/{id}/ausencia-simulacion`**, igual.
- **`POST /prueba/calificacion`** —ponderar las notas ya puestas— y `POST /criterios/{id}/nota`
  —ajustar una a mano— existen y no se cablearon: son la mesa de calificar entera, y esta tanda
  iba de poder ver y de poder pedir.
- **No hay `GET` del cierre vigente de una vacante**: `VacantePanel` no trae el campo, así que
  el formulario empieza vacío y lo dice en vez de fingir que ese hueco significa «sin fecha».

---

## Los inscritos de una sesión, y quién puede qué (27/08/2026)

El backend fusionó el #44 (migración **V40**) y el portal se puso al día con las dos piezas.

### Ya se sabe **quiénes** vienen a una sesión

`GET /panel/sesiones-simulacion/{id}/inscritos` devuelve la lista con nombre, vacante, cuándo
se inscribió y la asistencia. Cada fila de la tabla de sesiones se abre con **«Ver quién
viene»** y enseña la lista, donde se pasa lista con `POST /panel/inscripciones/{id}/asistencia`.

Lo que de verdad desbloquea es la **`inscripcionId`**: es lo que piden asistencia y marcas, y
hasta ahora no había forma de averiguarla desde el panel.

⚠️ **`asistio` tiene TRES valores, no dos.** Vacío es «nadie ha pasado lista todavía», que no
es «no vino»: uno es una tarea pendiente del equipo y el otro cierra el paso de alguien. Un
`!asistio` en el JSX los colapsa y convierte una sesión sin pasar lista en una a la que no fue
nadie. Hay test.

⚠️ **Marcar «No vino» hace que la persona DESAPAREZCA de la lista, y `asistio: false` no llega
nunca por esta ruta.** `marcarAsistencia(false)` pone `es_vigente = false` y `listarInscritos`
solo devuelve las vigentes. Comprobado contra el backend vivo, no leído.

Eso obliga a dos cosas que parecen rarezas y no lo son: **la ausencia pregunta antes** —en dos
pasos dentro de la propia fila, para que la pregunta se vea pegada al nombre— y **después se
dice quién se fue y a dónde**, porque la postulación vuelve a la bandeja del equipo. Sin eso se
pulsa, la fila se desvanece y no queda ni rastro. La píldora «No asistió» se queda como rama
defensiva: el contrato admite el valor y pintar «Sin pasar lista» sobre una ausencia sería peor.

⚠️ **Esto lo escondió una fixtura.** `datos-panel.mjs` traía una fila con `asistio: false`, un
estado que la API real nunca devuelve, así que con datos inventados todo se veía bien. **Una
fixtura que enseña un estado inalcanzable no es un descuido inofensivo: tapa justo el fallo.**

⚠️ **El conteo de la sesión y la longitud de la lista NO son lo mismo, y pueden divergir.** El
backend recorta la lista por alcance y deja el conteo entero —es aforo, no identidades—.
Derivar el número de `inscritos.length` enseñaría «0 de 5» en una sesión llena. Cuando
divergen, la pantalla **dice por qué** en vez de dejar dos cifras contradictorias.

⚠️ **Entrar a `/admin/simulacion` ya no implica poder gestionarla.** Los dos GET de sesiones
admiten ahora `crear_sesiones_simulacion` **o** `ver_inscritos_simulacion`, pero crear, ampliar
cupo y cancelar siguen pidiendo el primero: un responsable de área llega a la tabla y esos tres
botones le responden 403. Como no hay forma de saberlo antes, **se aprende del primer 403**: se
retiran las tres acciones y se explica. «Ver quién viene» se queda, que es lo que sí puede.

### El reparto de permisos se edita desde el panel · Configuración

`GET/PUT/POST` sobre `/panel/roles/{id}/permisos[/{codigo}[/revocacion]]`. Se elige un rol y
sale **el catálogo entero** (71 permisos, 9 grupos), con el alcance de lo concedido y vacío en
lo que no.

⚠️ **Un cambio vale desde la petición siguiente de cada afectado**, sin desplegar y sin que
nadie vuelva a entrar — y sin que nadie reciba aviso. Por eso el motivo es obligatorio en los
dos verbos y queda auditado.

⚠️ **Hacen falta DOS permisos, no uno.** La matriz es de `administrar_permisos`, pero elegir el
rol necesita `crear_usuarios_y_asignar_roles`, que es lo que abre `GET /roles`. Hoy solo
Administrador tiene los dos, y conceder el primero sin el segundo deja a alguien mirando una
lista de roles vacía. La pantalla nombra cuál de los dos falta.

⚠️ **Quitar un permiso NO es un `PUT` con alcance vacío**: tiene su propia ruta de revocación,
y es POST porque el motivo va en el cuerpo. El backend **rechaza con 409 quitar el último
`administrar_permisos`** —dejaría el reparto sin nadie que pueda tocarlo— y ese mensaje se
enseña tal cual.

⚠️ **`PROPIO` casi nunca es lo que se quiere aquí**, y por eso es la única de las cuatro
píldoras con punto: se lee de quien llama, y en el panel nadie mira su propia postulación. En
toda la simulación el backend lo trata como «no alcanza a nadie», así que parece un permiso
concedido y no concede nada.

### El e2e contra el backend de verdad

`npx playwright test herramientas/e2e/21-simulacion-permisos.spec.ts` — 32 comprobaciones
sobre las dos piezas: la lista, la asistencia con su confirmación, la matriz, conceder, el
rechazo sin motivo y el 409 del último administrador. **Es lo que encontró el fallo de arriba**;
los `capturar-*.mjs` no podían, porque interceptan las respuestas.

⚠️ **Escribe en la base local y lo devuelve todo al terminar**, pase o falle (`restaurar()`).
Nunca toca `administrar_permisos`. Lo que no se puede deshacer son las filas de auditoría de los
cambios de permiso, y es correcto que así sea.

⚠️ **Necesita que haya alguien inscrito en una sesión** o esa mitad no se ejercita — lo dice en
voz alta en vez de pasar en verde. Hoy la base local no tiene ninguna inscripción.

⚠️ **No uses `.first()` sobre «Ver quién viene»**: la tabla ordena como quiera el backend y la
primera fila puede ser una sesión vacía. La primera versión de esta prueba lo hizo y el fallo
parecía del panel.

### Tres scripts que llevaban rotos desde la reescritura del login (27/08)

No lo rompió esta rama: **estaban así en main** y nadie lo había corrido desde el PR #8. Los
tres entraban al panel por el formulario viejo de RENASER OS.

| Script | Qué le pasaba |
|---|---|
| `e2e-etapas.mjs` | Buscaba «Tu identificador de RENASER OS» |
| `e2e-vacante.mjs` | Lo mismo, **y además** `getByRole('checkbox')` a secas ya era ambiguo |
| `verificar-panel.mjs` | Lo mismo del login |

⚠️ **La entrada de desarrollo existe pero está plegada**, así que hay que abrir el `<details>`
antes: el campo no está en el DOM accesible hasta entonces. El bloque que funciona es

```js
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill('andy-dev')
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
```

⚠️ **`getByRole('checkbox')` sin nombre ya no vale en el detalle de una vacante**: el ranking
por etapas trajo más casillas —«Ver la tanda entera» y una por fila—.

**Al cambiar una pantalla, corre los `e2e-*` que pasan por ella.** Un e2e roto no avisa de que
está roto: simplemente deja de correrse, y lo que guardaba queda sin guardia.

### Dos cosas que se encontraron mirándolo, no leyéndolo

**Una fila de detalle hereda el ancho de la tabla, no el de la pantalla.** El `colSpan` sobre
siete columnas mide lo que miden las siete, que aquí es más que el viewport: el contenido se
iba a la derecha del scroll y **en un teléfono no se veía ni una píldora de asistencia** —justo
lo que hay que mirar para pasar lista, que se hace de pie en la sala—. Se resuelve en
`Tabla.module.css` con `container-type: inline-size` en la envoltura y `width: 100cqi` +
`position: sticky` en el bloque de dentro. **Vale para cualquier tabla del panel que despliegue
algo**, por eso vive ahí y no en la hoja de la pantalla.

**`!important` no era la salida.** `.tabla td` le gana en especificidad a una clase suelta de
otro CSS Module, así que el reset del relleno tenía que vivir en la hoja de la tabla.

### Lo que este commit deja a mano y no se construyó

**La consola de los diez eventos observables.** `POST` y `GET /panel/inscripciones/{id}/marcas`
existen desde antes y ahora son **alcanzables** —esa era la razón de ser de la `inscripcionId`—
pero no se implementó: no es nuevo del #44 y es la pieza más grande. `ocurridaEn` vacío
significa «ahora, según el servidor»: **no mandar la hora del cliente**.

También sigue sin cablearse `POST /panel/postulaciones/{id}/ausencia-simulacion`, que es lo que
decide entre otra fecha y cerrar para quien faltó.

---

## Multiempresa y «Mi perfil» (26/08/2026)

El backend fusionó dos tandas grandes —el perfil (#36, migración V36) y el multiempresa (#41,
V37-V39)— y el portal se puso al día con las tres primeras piezas.

### El portal estaba roto, y esto es lo que lo arreglaba

`POST /portal/postulaciones` **exige `aceptaTratamiento` y sin él responde 400**. El portal no
lo mandaba: ninguna postulación entraba. Ahora la pantalla de postular lleva la casilla del
tratamiento de datos **de la empresa de esa vacante**, con su texto legal servido por
`GET /vacantes/{id}/consentimiento` (público, para poder leerlo antes de decidir).

⚠️ **Esa casilla SÍ bloquea, y no contradice la regla de los requisitos.** Los requisitos son
preguntas de sí o no porque una respuesta descarta a la persona y decidir por ella sería peor.
El consentimiento es la ley 29733: sin él no hay postulación posible, así que preguntarle si
quiere enviarla igual sería ofrecer algo que no existe. El candado vive dentro de `revisar()`,
que es lo que hace que se resuelva **antes** que el aviso del descarte automático.

### El tablón mezcla empresas, a propósito

`VacantePublica` gana `nombreEmpresa` y `MiPostulacion` gana `empresa`. ⚠️ **Se llaman distinto
en el backend y aquí se copian tal cual**, sin igualarlos: son dos `record` distintos.

⚠️ **Una vacante de empresa suspendida devuelve 404, y eso es normal.** Antes el portal no
distinguía ningún 404: pintaba «no pudimos cargar» con un botón de reintentar que no podía
funcionar, y filtraba el mensaje interno del backend en inglés. Ahora la ficha tiene su rama.

### Entrar al panel cambió de raíz

RENASER OS quedó dormido: `POST /panel/auth/login` con correo y contraseña, para todo el equipo.
**Las cuentas nacen solo por invitación** (`POST /panel/auth/invitacion`, contraseña **mínimo
12**, no 8 como el portal) y **no hay recuperación de contraseña** — no existe el endpoint, y la
pantalla lo dice en vez de fingirlo, igual que la `/clave` del candidato.

⚠️ **El enlace de la invitación cae en un agujero si `renaser.panel.url` no lleva `/admin`.** El
backend lo arma como `{esa propiedad}/invitacion?token=…`, el portal vive en `/admin/*`, y el
comodín `path="*"` está dentro del armazón del candidato: sin nada más, `/invitacion` rebotaba a
la portada y **el token desaparecía en silencio**. Hay una ruta suelta que redirige conservando
el token; el día que la propiedad esté bien puesta en todos los entornos, se puede borrar.

### «Mi perfil» · `/perfil`

Un perfil por persona, no por vacante. 23 endpoints. **Nada es obligatorio y nada bloquea.**

⚠️ **`PUT /perfil` reemplaza los siete campos de la cabecera de golpe.** Se siembra del `GET` y
se manda entero. Guardar campo a campo borraría los seis que no van — la misma forma del fallo
que ya costó respuestas perdidas en la evaluación. Hay test.

⚠️ **Las cinco listas NO tienen las mismas operaciones**, y tratarlas como si sí devuelve 404:

| Lista | Ruta | Reordenar | Confirmar | Editar |
|---|---|:-:|:-:|:-:|
| Experiencia | `/experiencia` **singular** | sí | sí | sí |
| Educación | `/educacion` **singular** | sí | sí | sí |
| Idiomas | `/idiomas` | — | sí | sí |
| Certificaciones | `/certificaciones` | — | sí | sí |
| Enlaces | `/enlaces` | — | — | **no** |

**Cómo se marca de dónde salió cada dato.** Es la regla que más se nota en el uso: un dato con
`origen: CURRICULUM` sin confirmar **lo dedujo un modelo y nadie lo ha verificado**. Se marca
con **la forma, no con el violeta**: píldora con la palabra «Sin confirmar» dentro, y el botón
«Está bien» que existe solo ahí. Un CV recién leído puede dejar veinte filas sin confirmar de
golpe, y veinte filas violetas no son énfasis — además le quitarían el significado al violeta de
«Mis procesos». **El violeta aparece una sola vez**: el panel de arriba con el recuento.
Se comprueba con `node herramientas/capturar-perfil.mjs --caso gris`.

⚠️ **`NO_LEGIBLE` no es un error y no se pinta como tal**: del archivo no salió nada, el sistema
prefirió no leer antes que inventarse datos, y lo que toca ofrecer es llenarlo a mano.

⚠️ **No hay endpoint para subir el CV al perfil.** El archivo llega al postular. La pantalla
informa del estado de la lectura; no ofrece un botón que no existe.

**«Mi cuenta» de la cabecera ahora lleva a `/perfil`**, no a privacidad: aquella es la pantalla
de retirar consentimientos y pedir el borrado, que no es «mi cuenta». Privacidad se enlaza desde
dentro del perfil y desde el pie.

### Cuatro trampas que encontró el QA de esta tanda

Ninguna se veía leyendo el código; las cuatro estaban escritas y compilando.

**`isError` de TanStack Query se enciende aunque haya datos.** Lo pone sin condiciones al
fallar un refresco de fondo (`query-core`, caso `"error"`). Como «Mi perfil» se sondea sola
cada cinco segundos mientras se lee el currículum, **un hipo del servidor desmontaba el
formulario entero con lo que la persona estuviera escribiendo dentro** — en la pantalla que le
dice «puedes seguir llenando lo que quieras». La pantalla de fallo es solo para cuando **no
hay nada que enseñar**: `consulta.isError && !consulta.data`. Hay test.

**`AreaTexto` tenía `maximo` y no lo pasaba al elemento.** Solo pintaba el contador: se podía
escribir de más y el guardado rebotaba con el `@Size` del backend. Ahora `maximo` implica
`maxLength`. Y **todos los campos de texto llevan su tope**, que sale de `DtosPerfil.java`.

**`new Date().toISOString()` para el «hoy» es UTC.** En Lima, desde las siete de la tarde
devuelve la fecha de mañana, así que una certificación que vencía hoy se marcaba **Vencida**
esa misma tarde. Es la misma trampa que el propio archivo documenta para las fechas sin hora.
El hoy sale de `ahora()` de `reloj.ts` y se arma con `getFullYear/getMonth/getDate`.

**Una píldora con tres significados es una píldora sin significado.** «Sin confirmar»
(procedencia pendiente), «Del currículum» (procedencia), «Titulado» (atributo) y «Vencida»
(alerta) compartían silueta y solo las separaba el color: en gris eran idénticas. «Vencida»
lleva ahora un punto. **Al añadir una etiqueta nueva a esa familia, mírala en gris primero**
(`node herramientas/capturar-perfil.mjs --caso gris`).

### Lo que falta de estas dos tandas

Las pantallas de **empresa** (textos legales, invitar al equipo, personalizar instrumentos) y las
de **plataforma** (alta y suspensión de empresas, tope de IA, consumo). Los 16 endpoints existen;
el detalle está en `docs/APIS-MULTIEMPRESA.md` del backend.

⚠️ **Sigue sin haber ruta que diga qué puede el usuario del panel.** `Sesion` es solo
`{token, usuarioId}` y en los catálogos no hay permisos, así que esas secciones tendrán que pedir
y desaparecer con el 403. Un `GET /panel/auth/yo` lo arreglaría de un golpe.

---

## ⚠️ Lo primero: el mundo visual ya no es «El seguimiento» (25/08/2026)

En la rama `update/impeccable` se eligió un mundo nuevo y **buena parte de lo que este archivo
dice más abajo sobre el aspecto del portal ya no es cierto**. Lo que sigue valiendo entero es
todo lo que no es aspecto: el producto, los 18 estados, las trampas que costaron un fallo, cómo
se escribe aquí, y con qué habla el portal.

El mundo nuevo se llama **«El canto»**: una nube difractando la luz del sol por su borde. Tu
candidatura es esa banda de color, que se forma tramo a tramo.

| Lo que decía este archivo | Lo que es ahora |
|---|---|
| Papel blanco `#ffffff` de fondo | Fondo de bruma fría `--cielo #f6f8fb`; las superficies son nube blanca encima |
| Acento índigo `#4338CA` | Violeta `--activo #5638d6`. **Sigue significando una sola cosa: «te toca a ti»** |
| Tipografía Libre Franklin | **Mulish**, con el titular en peso 200 |
| **Cero radios** en todo | `--radio: 14px` en superficies y **píldoras** en todos los controles |
| Tinta casi negra `#1c1c1e` | Pizarra `--tinta #232b36`, gris azulado |
| Marcas cuadradas en el recorrido | **Franjas de espectro**: el color es posicional y dice cuánto has avanzado |

**Solo tema claro y el logotipo EX siguen intactos**, que son los dos compromisos con el cliente.

**Los nombres de los tokens cambiaron en las veinte hojas**: `--papel`→`--nube`,
`--hundido`→`--nube-hundida`, `--hundido2`→`--nube-honda`, `--acento*`→`--activo*`,
`--mal-papel`→`--mal-bruma`, `--duda-papel`→`--duda-bruma`.

### Qué está migrado y qué no

**`DESIGN.md` y `.impeccable/design.json` están al día** (25/08): se regeneraron desde el código
una vez el mundo estuvo construido y estable en la capa de tokens. El detector pasa con tres
avisos, y los tres son `#000` dentro de un `mask-image` —máscaras, no colores—.

Migrado del todo, con su composición propia: `mundo.css`, `piezas.module.css`, el armazón del
portal, «Mis procesos» y su recorrido, la portada pública —sus cinco etapas son ahora la banda
del espectro—, y **el panel del equipo entero**.

Las otras pantallas del candidato tienen la paleta, la tipografía, los botones, los radios y las
superficies del mundo nuevo, pero **no se han recompuesto**: siguen con la disposición que
tenían. Se ven del mismo mundo; no están rediseñadas.

### El panel comparte el mundo pero no la atmósfera (25/08/2026)

El panel del equipo usa el mismo sistema —bruma, nube, Mulish, píldoras, el semáforo— y ninguna
paleta inventada. Lo que **no** hereda es el canto irisado a sangre: doscientos píxeles de
atmósfera son un regalo en una pantalla que se visita cada tres días y un estorbo en una
herramienta que se habita la jornada entera. De todo el mundo se queda **un filete del espectro
de dos píxeles** cruzando la cabecera, que además distingue las dos pestañas de un vistazo.

⚠️ **El violeta significa cosas distintas en cada producto, y es a propósito.** En el portal es
«te toca a ti», y su rareza es lo que lo hace legible entre trece estados de espera. En el panel
no hay esa distinción —todo le toca al equipo— así que es simplemente la acción principal.

Por eso **lo elegido no se marca con color en el panel, se marca cambiando de superficie**: las
cinco pestañas del ranking son un control segmentado sobre bruma con la activa en nube, y la
pestaña de la cabecera lleva un fondo gris. Si además llevaran violeta, el violeta dejaría de
señalar la acción. Y las etiquetas de la IA —fortaleza, alerta, riesgo— van en píldora con el
semáforo, con la palabra dentro: el color no es la única señal.

### La trampa que costó tres rondas: los filtros SVG y la densidad de pixel

`Canto.tsx` no usa `feGaussianBlur` ni `feDisplacementMap`, **y no es un descuido**. Chrome
rasteriza un filtro SVG a resolución CSS y después amplía el resultado a la del dispositivo, así
que en una pantalla de alta densidad la banda salía pixelada al lado de un texto nítido. La
suavidad la hace ahora geometría: la misma curva trazada ochenta veces, de ancha y transparente
a estrecha y opaca.

⚠️ **Los `herramientas/capturar-*.mjs` capturan a densidad 1 y este fallo ahí no se ve.** Para
mirarlo está `herramientas/capturar-densidad.mjs`, que saca la misma pantalla a 1× y a 2×: si la
zona sospechosa a 2× no tiene más detalle que la de 1× ampliada, hay un mapa de bits en medio.

### Mirar el panel sin tocar la base

`herramientas/verificar-panel.mjs` recorre el panel contra el backend local **y escribe en la
base**. Para solo mirarlo está `herramientas/capturar-panel.mjs`, que intercepta las respuestas
y sirve un escenario de prueba: **trece pantallas** —incluidas la ficha del ranking abierta en
Perfil integral y en Prueba, una etapa sin nadie dentro, la tanda entera de 78 con sus notas
vacías explicadas, una sesión con sus inscritos desplegados, la matriz de permisos de un rol y
el banco con una versión abierta—, en **los tres anchos**, sin tocar nada. Sus fixturas copian los `record` de `src/panel/api/tipos.ts`; si el
contrato cambia allá, aquí revientan con un `Cannot read properties of undefined`.

⚠️ **`--gris` es la comprobación de la regla de la forma primero**, igual que en el perfil:
`node herramientas/capturar-panel.mjs --gris`. El panel tiene ya tres familias de etiquetas
—los tres estados de la asistencia, los cuatro alcances de un permiso y las dos de una versión
publicada— y en color se distinguen solas.

---

## Respuestas

Responde en el chat de manera breve, corta y directa. Si para implementar algo hace falta que
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

## Qué es esto

La cara que ve **quien postula** a una vacante de Renaser: elegir oportunidad, postular,
responder la evaluación, hacer la prueba del puesto, elegir fecha de simulación y seguir el
estado de su proceso.

**Y desde el 25/08, también el panel del equipo — aquí mismo y a sabiendas de que es
provisional.** El plan sigue siendo que viva integrado en RENASER OS (`~/Documentos/RenaserOs`),
pero mientras un agente de backend trabaja en que otras empresas puedan crear sus propias
vacantes (modelo Indeed), el panel se construye en este repositorio, bajo `/admin`:

- **Se entra como usuario del equipo**, no como candidato. El backend tiene
  `POST /api/v1/panel/auth/dev-login` hecho justo para esto: emite un token de equipo sin
  RENASER OS, se apaga en producción con `app.seguridad.dev-login-activo=false`, y el primer
  id que entra se crea solo con los tres roles. En la base local ya existen `andy-dev` y un
  UUID; el id es **texto**, no número.
- **La base del panel es `/api/v1/panel`**, con token propio (`renaser_panel_token`), aparte
  del token del candidato. Un 401 del panel no puede cerrar la sesión del portal ni al revés.
- Tres pestañas: **Vacantes** (el CRUD, y dentro de cada una el embudo, el ranking con las
  notas de la IA, la ficha de cada postulante y avanzar de etapa), **Simulación** (crear y
  gestionar las sesiones presenciales) y **Configuración** (parámetros, banco de preguntas por
  Excel, usuarios y roles, áreas).
- ⚠️ **Huecos del backend, comprobados el 27/08**: `GET /panel/bandeja` devuelve 500; y **no hay
  forma de listar las versiones de una plantilla de prueba**, solo de pedir una suelta por su
  id. Y `POST /vacantes/{id}/cierre-prueba` contesta 400 **en inglés** si la vacante no tiene
  versión elegida. Se enseña lo que existe, como hizo el portal con la decisión ámbar.
  (El hueco de «quiénes se inscribieron» se cerró: ver la sección del 27/08.)

### El ranking es por etapas (25/08)

Cinco pestañas sobre la misma tabla: las cuatro etapas que puntúan y Decisión. La tabla
sigue siendo la mesa de decidir —casillas, motivo, avance en lote—; lo que cambia con la
pestaña es **de qué etapa es la nota** (`GET /vacantes/{id}/ranking?etapa=…`, hecho a
juego en el backend) y **qué enseña la ficha** al abrir una fila:

| Pestaña | La ficha muestra |
|---|---|
| Perfil integral y Decisión | **Dos tablas**: el CV criterio a criterio, y la evaluación del banco —cada respuesta abierta con la nota, el porqué y la evidencia citada por la IA (`GET /postulaciones/{id}/evaluacion`, nuevo)— |
| Prueba / Simulación | La rúbrica con nota, explicación y origen (IA o ajuste a mano). Comparten componente porque el backend les da la misma forma |
| Validación | La cabecera del periodo y sus métricas. **El panel sí tiene ruta de validación**; la que falta es la del candidato |

Cada pestaña enseña **solo a quien está parado en esa etapa** — ver la sección del 27/08 por
la tarde. Se deriva del prefijo del estado (`PRUEBA_*`, `SIMULACION_*`…).

⚠️ **La clave de DeepSeek del `application-secrets.yaml` local está muerta** (401 del
proveedor desde el 25/08; el 24/08 funcionaba). Sin ella la IA no califica: las abiertas
de la evaluación quedan «pendiente de calificar», que el panel enseña sin fingir. Hay una
evaluación entregada de verdad en la base local —sembrada con
`scripts/sembrar-evaluacion-local.py` del backend— esperando esa clave.

Verificarlo entero: `npx playwright test herramientas/e2e/13-etapas.spec.ts`
(Chrome visible, solo lee).

### Publicar una vacante exige tres cosas antes (25/08)

Era el atasco: el backend rechaza publicar y el panel no tenía dónde resolverlo. Ahora las
tres viven en el detalle de la vacante, bajo **«Qué responderá quien postule»**.

| Qué | Obligatorio |
|---|---|
| **Banco publicado del nivel del puesto** | **Sí, si `aplicaEvaluacion` está encendido.** No se elige aquí: se publica en Configuración y la vacante lo hereda de su puesto (V44) |
| Versión de plantilla de prueba | **Solo si la vacante rinde la prueba del puesto.** Si eligió el cuestionario técnico, lo obligatorio es tenerlo publicado — ver la sección del 30/08 |
| Versión de pesos | No: sin elegir, rigen los generales |

⚠️ **La plantilla de evaluación ya NO se elige ni se exige** — ver la sección del 28/08 por la
noche. La resuelve el nivel.

Y antes que todo eso, la vacante misma exige **una solicitud de talento aprobada** que no haya
usado ninguna otra. **Escribir una solicitud se ofrece siempre, desde la cabecera** —puede haber
varias `ABIERTA` a la vez, ver la seccion del 28/08— y si no hay ninguna el panel ademas deja
aprobar un borrador ahi mismo; el backend le exige **entre 3 y 5 resultados esperados**, cada
uno con su indicador.

⚠️ **La prueba del puesto sí se elige, y se filtra por el puesto de la vacante.** La genérica
—`puestoId: null`— vale para cualquiera y sigue saliendo; la que la vacante ya tiene puesta no
se filtra nunca, porque el backend admite asignaciones cruzadas.

⚠️ **`listarVersionesPrueba` tantea ids y deja 404 en la consola.** No es un fallo: es el hueco
del backend. Va por tandas de ocho en paralelo, sembrado con la versión que la vacante ya tiene
—ver la sección del 27/08 por la tarde—, y el día que exista
`GET /plantillas-prueba/{id}/versiones` esa función se borra entera.

⚠️ **Un `<form>` dentro de otro `<form>` lo descarta el navegador**, y su botón de enviar acaba
enviando el de fuera. Pasó con el formulario de solicitud dentro del de alta: se veía bien y no
hacía nada. Va fuera, con un `return` temprano.

**El recorrido entero, los dos lados**, está en
[docs/06-FLUJO-COMPLETO.md](docs/06-FLUJO-COMPLETO.md), y se comprueba con
`npx playwright test herramientas/e2e/14-vacante.spec.ts`: abre un Chrome de verdad y va de la solicitud a la vacante
publicada en el portal. ⚠️ Escribe en la base local.

---

## Estamos en un rediseño, no en un retoque

El portal que hay en `src/` **se va a reemplazar entero**. Lo único que sobrevive es el
nombre **EX** y su logotipo: la palabra con la hormiga dentro de la X.

| Pieza | Dónde |
|---|---|
| **El maquetado, en el repositorio** | [maquetado/LEEME.md](maquetado/LEEME.md) — las 17 pantallas en HTML plano. **Esto es lo que se lee para construir** |
| El mismo maquetado, para verlo | https://claude.ai/code/artifact/7239da41-c745-472c-9b90-19df9d4ef666 |
| Qué ve el candidato, pantalla por pantalla | [docs/02-QUE-VE-EL-CANDIDATO.md](docs/02-QUE-VE-EL-CANDIDATO.md) |
| La auditoría técnica y sus ocho pendientes | [docs/05-AUDITORIA.md](docs/05-AUDITORIA.md) |
| Estado del rediseño y qué sigue | [docs/03-ESTADO-DEL-REDISENO.md](docs/03-ESTADO-DEL-REDISENO.md) |

### Lo que se decidió (23/08/2026)

| Pantalla | Cómo queda |
|---|---|
| Mis procesos | Cada postulación con su camino de cinco etapas dibujado y un punto donde estás. La acción vive dentro de la etapa |
| Evaluación | Una pregunta por pantalla, con **mapa lateral** de todas y su estado. Resuelve el problema conocido: saltarse una y no poder volver sin pulsar cuarenta veces |
| Cuando no hay nada que hacer | Se dice claro que no hay nada pendiente y se ofrece algo útil mientras tanto. **Trece de los dieciocho estados son esto** |

**Solo tema claro.** Es petición del cliente. Desaparecen el bloque `html[data-theme="dark"]`
y el proveedor de tema; el `index.html` deja de abrir en oscuro.

**Fondo blanco puro y acento índigo `#4338CA`**, en lugar del champagne `#816220`. La razón
no es estética: verde, ámbar y rojo ya tienen significado fijo en el sistema —aprobado, en
duda, error— así que el acento no podía ser ninguno de esos, ni un verde azulado, que junto a
una etiqueta verde real se lee como «aprobado». Al cliente le gusta la estética de Apple pero
pidió que no fuera su azul.

**El acento significa una sola cosa: «te toca a ti».** Marca el panel de la acción pendiente
y el tramo del recorrido donde está el candidato. Si empieza a aparecer en botones sueltos,
titulares o iconos, deja de leerse.

### El mundo visual: «El seguimiento»

Tu postulación como algo que va en camino: hitos cumplidos y un siguiente hito siempre
nombrado. **La acción vive dentro del hito abierto**, no en un botón suelto al pie, para que
«dónde estoy» y «qué hago» sean la misma mirada.

Lo que lo separa de un rastreo de paquete cualquiera: **lo cumplido no se apaga**. Una etapa
cerrada se sigue leyendo con el mismo peso, porque el producto trata de acumular evidencia.

Cuatro reglas de forma que vienen de ahí y no se negocian por comodidad:

- **El estado se lee en la forma antes que en el color** —relleno, contorno grueso, contorno
  fino, tachado—. Quien no distingue colores lee el mismo recorrido.
- **Cero radios** y las reglas a un píxel. Los estados son marcas impresas, no cromo.
- **La tipografía hace la jerarquía.** Ningún recuadro ni sombra crea un nivel que el tamaño
  ya crea.
- **Un solo momento con movimiento**: la marca que se asienta al cerrarse una etapa.

Tipografía **Libre Franklin**, servida desde Google Fonts. No usar Inter, Roboto, Geist,
Instrument Sans ni Space Grotesk: el detector de `impeccable` las marca como sobreexpuestas.

El brief completo está en [docs/04-BRIEF-MIS-PROCESOS.md](docs/04-BRIEF-MIS-PROCESOS.md), y
los tokens con su porqué en [src/estilos/mundo.css](src/estilos/mundo.css).

### Dónde está el código nuevo

| Pieza | Estado |
|---|---|
| `src/estilos/mundo.css` | **La única hoja global que queda.** Todo lo demás son CSS Modules, uno por pantalla |
| `src/estilos/piezas.module.css` | Lo que se repite: los cuatro botones y el enlace de volver. **No se escribe en el JSX**, se trae con `composes` desde la hoja de cada pantalla |
| `src/paginas/vacantes/` | La portada y la ficha de vacante. **Públicas**, se ven sin cuenta |
| `src/paginas/cuenta/` | Entrar —un solo formulario desde el 28/08— y crear cuenta. Comparten `Cuenta.module.css` |
| `src/paginas/postular/` | Postular. **Aquí vive el único descarte automático del sistema** |
| `src/paginas/procesos/` | «Mis procesos», el detalle de una postulación y la línea de hitos |
| `src/paginas/evaluacion/` | La evaluación y los ocho formatos del banco v3. **Solo se migró el estilo: la lógica no se tocó** |
| `src/paginas/prueba/` | La prueba, en sus dos formas. Igual: estilo migrado, lógica intacta |
| `src/paginas/simulacion/` | Elegir fecha, y la sesión ya reservada con su agenda. Dos momentos en una ruta |
| `src/paginas/validacion/` | **Nueva.** El periodo trabajando. Ver más abajo por qué no se enlaza |
| `src/paginas/decision/` | El caso ámbar. El formulario va entero y **apagado**, ver más abajo |
| `src/paginas/privacidad/` | Las tres acciones que se confunden. Las dos que no se deshacen ahora preguntan antes |
| `src/ui/Estados.module.css` | Cargando, fallo, acceso necesario, vacío y el salvavidas. Comparten hoja porque comparten forma |
| `src/ui/Modal.tsx` | El aviso compartido: entrega de la evaluación, de la prueba, y las dos confirmaciones de privacidad |
| `src/ui/TextoPlano.tsx` | El texto del backend con sus enlaces. Ya no usa `--acento` |
| `src/ui/campos/` | Campo, AreaTexto y Consentimiento: etiqueta atada al campo, error atado al campo, y el error dicho en palabras |
| `src/app/Armazon.tsx` | Cabecera y pie nuevos, ya globales |

`src/estilos/base.css` y `src/estilos/variables.css` **están borradas**, y con ellas su import
en `main.tsx` y el `BarraPasos.tsx` que ya no usaba nadie. Si algo se ve sin estilo, es que
quedó una clase suelta del portal viejo: se busca con `grep -rn 'className="' src`, y lo único
que debe salir son las tres de `Marca.tsx`, que viven en `mundo.css`.

`src/dominio/estados.ts` creció con cuatro funciones y no se quitó nada de lo que ya había:

| Función | Para qué |
|---|---|
| `recorridoDe()` | En qué punto está cada una de las cinco etapas |
| `fechasDelRecorrido()` | Cuándo se alcanzó cada etapa, leído del historial |
| `etapaDeCorteDe()` | Dónde se detuvo una postulación terminada. Los tres estados finales no lo dicen; el historial sí |
| `comoOcurrio()` | El nombre de un cambio **en pasado**. Los títulos de `MOMENTOS` están en presente y en un registro de hace tres semanas suenan a que sigue pendiente |

⚠️ **La lista de postulaciones no trae historial y el detalle sí.** De ahí sale que «Mis
procesos» pinte el recorrido sin fechas y el detalle con ellas, y que una postulación
terminada solo pueda enseñar dónde se detuvo en el detalle. No es un descuido: inventar una
fecha sería peor que no ponerla.

### Cómo se resolvió el descarte automático

Los requisitos indispensables **no son casillas, son preguntas de sí o no**. Una casilla se
marca sin leer; una pregunta hay que contestarla, y no se puede enviar dejando alguna en
blanco.

Responder «no» **no bloquea el envío**: lo explica. Impedirlo sería decidir por el candidato.
Lo que hace la pantalla es nombrar los requisitos que dijo no cumplir, decir que la postulación
se cerrará de inmediato y que no podrá volver a postular, y dejarle elegir. La opción por
defecto del aviso es volver y revisar.

### La evaluación: los 35 tests son la especificación

`Evaluacion.test.tsx` y `Formatos.test.tsx` prueban exactamente los fallos que ya costaron
respuestas perdidas: que lo escrito se mande al cambiar de pregunta, que lo rechazado no se dé
por guardado, que el aviso sobreviva al cambio de pregunta, que no se pueda entregar con algo
pendiente, y las ocho formas de responder.

**Al rehacer esta pantalla se migró el estilo y no se tocó la lógica**, y los 49 tests siguieron
en verde en cada paso. Si en el futuro hay que cambiar el comportamiento, esos tests son el
contrato: si uno se pone rojo, la pregunta no es cómo callarlo.

Dos avisos por si se retoca:

- **No partir textos con elementos dentro.** Poner `<b>` alrededor de los números de «Pregunta 2
  de 4» rompió cuatro tests, y por la misma razón que rompe a un lector de pantalla: la frase
  deja de leerse de una pieza.
- **El SEC se ordena solo con flechas, no arrastrando.** Arrastrar va mal en un teléfono, y
  desde el teléfono responde casi todo el mundo. `@dnd-kit` está instalado pero **no lo importa
  nadie**, y `Formatos.module.css` conserva `.asa` y `.arrastrando` de ese intento: es CSS
  muerto. Si algún día se cablea el arrastre, las flechas se quedan igual — son lo probado.
- **`.letra` también es CSS muerto, y a propósito.** La letra de una opción va pegada a su texto
  con `conLetra()`. Separarla en su propio `<span>` deja el nombre accesible como
  «a.Aviso antes de mover nada», sin espacio, y rompe la prueba de `INV`. Es la misma trampa que
  «Pregunta 2 de 4».

### Dos pantallas que están completas y no están conectadas

Las dos se maquetaron enteras a propósito, para poder juzgarlas y para dejar escrito qué hay
que pedirle al backend. Ninguna finge tener datos que no tiene.

**Decisión ámbar** (`/procesos/:uuid/decision`). El formulario está entero y **deshabilitado**,
con un `fieldset disabled`, y se dice por qué antes de que nadie escriba. La acción que sí
funciona —escribirle al equipo— es la que lleva el acento. Dejarlo escribible para fallar al
pulsar sería la versión peor: se pierde lo escrito, y lo que se aprende es que la pantalla
miente. Los endpoints que hacen falta están en la cabecera de `Decision.tsx`.

**Validación** (`/procesos/:uuid/validacion`). La ruta existe y funciona, pero **no se enlaza
desde ningún sitio**: `VALIDACION_TURNO_CANDIDATO` sigue llevando al detalle del proceso.
El maquetado tiene «Día 6 de 15», una barra al 40 % y un nombre de responsable, y de todo eso
el backend no expone nada. Enseñárselo inventado a quien de verdad está trabajando esos días
es peor que no enseñarlo — la misma regla por la que «Mis procesos» pinta el recorrido sin
fechas. Lo que sí sale es real: la vacante, y la fecha de inicio leída del historial.
**Conectarla es una línea en `dominio/estados.ts`** cuando el backend abra su ruta.

### Lo que sigue

Ahora tocan **los comandos de `impeccable`**, sobre el portal completo, que es donde rinden.
Correrlos pantalla a pantalla es caro y no ve lo que importa: la consistencia entre ellas.

| Orden | Comando | Qué hace |
|---|---|---|
| 1 | ~~`extract`~~ | **Hecho el 24/08.** Ver abajo |
| 2 | ~~`document`~~ | **Hecho el 24/08.** `DESIGN.md` en la raíz y `.impeccable/design.json` al lado |
| 3 | ~~`audit`~~ | **Hecho el 24/08: 17/20.** El informe, en [docs/05-AUDITORIA.md](docs/05-AUDITORIA.md) |
| 4 | ~~`critique`~~ | **Hecho el 24/08: 27/40.** En `.impeccable/critique/`. Dos P0: el cronómetro y la contraseña |
| 5 | ~~`polish`~~ | **Hecho el 24/08**, junto con `typeset`, `harden` y `distill` |

### Lo que dejó `extract` (24/08/2026)

Cincuenta bloques con forma de botón repartidos por dieciséis hojas se quedaron en **cuatro
piezas** en `src/estilos/piezas.module.css`, más el enlace de volver. El CSS del portal pasó de
79,9 kB a 68,9 kB.

Se traen con **`composes`, no con clases en el JSX**: el marcado no cambió ni una línea, y cada
pantalla conserva su nombre propio —`.entregar` se sigue llamando entregar— mientras comparte
la forma. Un botón que se llama por lo que hace se lee; uno que se llama `.botonSecundario`
obliga a ir al JSX para saber qué hace. Y como `composes` añade la clase al elemento, los
`:hover` y `:disabled` de la pieza se aplican solos.

⚠️ **En las piezas solo va la apariencia.** Los márgenes, el `align-self` y los anchos son del
sitio donde está el botón, no de la pieza. Meterlos allí la haría imposible de reusar.

Cinco tokens nuevos en `mundo.css`, todos por valores que estaban escritos a mano en dos sitios
o más: `--tinta-invertida`, `--tinta-pulsado`, `--duda-papel`, `--duda-tinta` y `--mal-pulsado`.
**No queda ni un hex crudo en las hojas de pantalla**, y se comprueba así:

```bash
grep -rno "#[0-9a-fA-F]\{3,8\}" src --include='*.module.css'
```

⚠️ **El antetítulo en versalitas no se extrajo, y `critique` ya decidió qué pasa con él:
se van cinco de los siete.** Se quedan `DECISIÓN · TE PEDIMOS UNA COSA MÁS` —sin él, «Queremos
resolver una duda antes de decidir» se lee como un rechazo— y `CAMBIO EN EL ENCARGO`, que es
título de bloque y no antetítulo. El razonamiento completo está en [DESIGN.md](DESIGN.md).

Después de cualquiera que toque código: `npm test` —los 49 son el contrato— y volver a pasar
los `herramientas/capturar-*.mjs`.

### Lo que se arregló el 24/08 (los P0 y P1 de `audit` y `critique`)

| Qué | Dónde |
|---|---|
| **El cronómetro no tenía estilo ni avisaba** | `Cronometro.tsx` salía con `className='timer'`, una clase que no existía en ninguna hoja. Ahora recibe `--t-cifra`, se pone rojo bajo los diez minutos y **avisa por voz en umbrales** —media hora, diez, cinco, un minuto—, nunca cada segundo |
| **No había recuperación de contraseña** | Ruta `/clave` nueva. **No restablece nada y lo dice**: no hay endpoint. Ofrece el enlace del correo y la dirección del equipo |
| **El título de la pestaña era el mismo en las 22 rutas** | `TituloDeLaPagina` en `Armazon.tsx`, con `matchPath` sobre `patrones` |
| **Una respuesta en blanco decía «guardada»** | Con el tiempo agotado, `Prueba.tsx` no comprobaba el texto vacío. La rama viva sí lo hacía |
| **Lo apagado parecía pulsable** | `.campoEnlace:disabled` no existía y `.secundario:disabled` no llevaba fondo |
| **El detalle pintaba dos veces la acción** | `Proceso.tsx` y `Seguimiento.tsx` renderizaban ambos el `<Link>`. El panel de arriba **solo sale ya si el proceso terminó**, que es cuando no hay hito abierto que aloje el cierre |
| **Un rechazo se veía igual que una espera** | La tarjeta cerrada del hub lleva ahora la **marca tachada** y fondo de papel |
| **Trece tamaños de letra** | Diez tokens `--t-*` en `mundo.css`. **El detector pasó de 168 hallazgos a 0** |
| **La prosa iba a 91-96 caracteres por línea** | `--medida: 47ch` y `--medida-corta: 42ch`. Medido en el navegador: **68-72** |
| **Seis `<button>` sin `type`** | En los pies de `Modal` de la evaluación y la prueba |
| **El aviso rojo del examen parpadeaba en cada pregunta** | Colgaba de la cola de guardado, que se llena al responder y se vacía un segundo después. Ahora cuelga de `error`, que solo tiene valor cuando un guardado **falló de verdad**. El candado de la entrega sigue mirando la cola |

### El portal compone en escritorio (24/08/2026)

Ocupaba 760 px en una pantalla de 1920 y parecía hecho para el teléfono. Ahora el ancho es
`--ancho` (68rem) y **se usa para componer, no para leer**: la prosa sigue cortada por
`--medida`, así que nada alarga sus líneas.

| Pantalla | Qué gana |
|---|---|
| Portada | Las cinco etapas **en horizontal** — son una secuencia. Y cada vacante usa las dos mitades: el puesto a la izquierda, dónde y la entrada a la derecha |
| Ficha | «Lo que harás» y «Lo que buscamos» en paralelo |
| Examen | **El mapa al lado, no encima.** La pregunta ya no se mueve al abrirlo |
| Armazón | La cabecera y el pie van con lo demás: si no, la marca queda metida respecto al contenido |

**Los formularios no se ensanchan** —entrar, crear cuenta, la clave y postular—: un formulario
ancho se lee peor. Privacidad se queda en 48rem.

Cortes en **900 px** para las composiciones y **1100 px** para el mapa del examen.

⚠️ **Las capturas ahora son de tres anchos**: 1920, 1280 y 375. Sin el ancho grande, la red no
ve justamente lo que se acaba de arreglar. `capturar.mjs` se quedó fuera del primer cambio
porque usa un `const TAMANOS` en vez del array en línea, así que **el hub estuvo sin mirarse a
1920**. Si añades un script, comprueba que tiene los tres.

### Lo que dejó `layout` (24/08/2026)

| Qué | Medido |
|---|---|
| **Los paneles crecieron con el contenedor y su texto no** | Relleno de 0,41 → **0,91**. El tope estaba en los párrafos; ahora está en el panel |
| **El mapa del examen volvía a abrirse por arriba entre 900 y 1099 px** | La pregunta saltaba 127 px. Ahora **0 px** en 900, 1000 y 1280 |
| **Dos desfases pegajosos estaban a ojo** | El mapa se pegaba 44 px demasiado arriba y se metía bajo la barra. Ahora son tokens medidos: `--alto-avance: 116px`, `--alto-reloj: 71px` |
| **La prueba componía la pantalla de 30 s y dejaba plana la de 2 h** | `.columnas` solo se usaba en la portada. Ahora el encargo va fijo a la izquierda: el alto pasó de 2220 a **1205 px** y el primer campo de y=718 a **y=352** |
| **La escala del SJT se estiraba a 908 px** | Son cinco dígitos. Tope de 22rem → **352 px** |
| **El aviso del tiempo agotado iba a 106 caracteres por línea** | El único párrafo sin medida, y el más urgente |
| **`space-between` separaba cada vacante de su propia fecha** | 644 px de nada entre dos cosas que son el mismo dato |

⚠️ **Un elemento pegajoso no adivina la altura del que tiene encima**: se mide y se guarda en
un token junto a la barra que la produce. Los dos que había escritos a mano estaban mal.

⚠️ **La medida se elige midiendo, no contando `ch`.** En Libre Franklin el cero es ancho: 62ch
compraban 91-96 caracteres. Si cambias el tope, mídelo en el navegador.

**Dónde vive el mundo visual ahora.** En [DESIGN.md](DESIGN.md), en la raíz: la paleta con el
porqué de cada color, la escala tipográfica, las ocho **reglas con nombre** —«la regla de una
sola voz», «la regla de la forma primero»…— y los do's y don'ts. Al lado va
`.impeccable/design.json`, que lleva lo que el formato de `DESIGN.md` no admite: las rampas
tonales, las tres sombras, el movimiento y ocho componentes en HTML y CSS que el panel puede
pintar. **Los dos se regeneran juntos**, nunca uno solo.

⚠️ **Si cambias los tokens de `mundo.css`, `DESIGN.md` miente hasta que lo regeneres.** Es el
mismo riesgo que tiene este archivo, y se arregla igual: `/impeccable document`.

⚠️ **`document` estuvo prohibido y ya no lo está.** La razón era que generaba `DESIGN.md` a
partir del código, y el código era el portal viejo. Ese código ya no está.

**No usar `craft`**: está deprecado.

**Cómo se construyó cada pantalla**, por si hace falta repetirlo: escribir su `.module.css`
con los tokens de `mundo.css`, migrar las clases del `.tsx` sin tocar la lógica, correr
`npm test` (los 49 son el contrato), y mirarla de verdad con un script de
`herramientas/capturar-*.mjs` en escritorio y en móvil.

Dependencias acordadas. Instaladas y en uso: `motion` (**solo fuera del examen**) y `zod`.

⚠️ **`react-hook-form` y `@hookform/resolvers` están instalados y NO los usa nadie** (corregido
el 26/08: este archivo decía que sí). Ni un `useForm` ni un `zodResolver` en todo `src`. **Los
formularios de aquí son `useState` + `zod.safeParse` a mano**, y el bloque exacto que se copia
está en `Registro.tsx`: `safeParse` → primer error por campo (`nuevos[campo] ??= mensaje`) →
`requestAnimationFrame` que enfoca el primer `[aria-invalid="true"]`. Ese `requestAnimationFrame`
no sobra: sin él el atributo todavía no está en el DOM cuando se busca.

**`@dnd-kit` está instalado y no se usa**: el `SEC` se resolvió con flechas, que es lo que
funciona en un teléfono — y el reordenar del perfil, igual. **Radix no se instaló y no hace
falta**: los tres sitios que lo pedían los resuelve el HTML. Estilos con **CSS Modules**, no
Tailwind.

⚠️ **Instálalas dentro del worktree.** `node_modules` no se comparte entre worktrees, así que
un `npm install` en el repositorio principal no llega aquí — ya pasó dos veces.

**Antes de traer Radix, mira si el HTML ya lo resuelve.** El aviso de postular usa `dialog`
nativo, el recorrido plegable usa `details`, y apagar el formulario de la decisión entero es un
`fieldset disabled`: foco atrapado, tecla de escape y teclado vienen gratis. Radix es para lo
que la plataforma no cubre.

Nada de librería de fechas —`reloj.ts` es crítico—, nada de gestor de estado —TanStack Query
ya cubre lo que hay— y ningún kit de componentes encima de los primitivos.

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

## Reglas que el código nuevo hereda

Los archivos se pueden reescribir enteros. Estos comportamientos no: cada uno costó un fallo
real. Hoy viven en `src/dominio/estados.ts`, `src/dominio/reloj.ts` y `src/api/cliente.ts`,
que conviene leer antes de tirarlos.

**Una sola fuente para los 18 estados.** El backend manda un estado con nombre
(`PRUEBA_TURNO_CANDIDATO`, `PERFIL_CALIFICANDO`…) y un solo archivo traduce cada uno a lo que
ve el candidato: etapa, título, ayuda y botón. Ninguna pantalla sabe qué estados existen. Si
el backend añade uno, se toca ahí y en ningún otro sitio. La regla que lo ordena: si acaba en
`TURNO_CANDIDATO` hay botón; si acaba en `CALIFICANDO`, `POR_HABILITAR` o `POR_CONFIRMAR`,
solo se informa y se espera.

**La hora la manda el servidor.** El cronómetro de la prueba no cuenta hacia atrás desde un
número: recalcula cuánto falta hasta la hora de vencimiento del backend, descontando el
desfase entre relojes (sale de la cabecera `Date` de cada respuesta). Cambiar la hora del
equipo no lo mueve.

**Una sola puerta al backend.** Un módulo pone el token, convierte los errores HTTP en algo
que la pantalla pueda enseñar, apunta la hora del servidor y cierra la sesión sola cuando un
401 revela que el token ya no vale.

**`grupoPrioridad` nunca se pinta en el portal.** Llega en la respuesta de las postulaciones del
candidato, pero es la clasificación interna del equipo y nadie tiene que enterarse por su propio
portal de en qué casilla lo pusieron. **En el panel sí se pinta**, en cada fila del ranking: ahí
quien mira es el dueño de esa clasificación. La regla se lee sobre la sesión del candidato, y lo
que no puede pasar es que el dato cruce de una cara a la otra.

**Las ocho formas de respuesta del banco v3.** `PC`, abierta/`V`, `EF-4`, `SJT-R`, `SEC`,
`INV`, `DE` y `CD`. La forma exacta de lo que se envía la valida el backend y responde 400 si
no cuadra.

---

## Trampas que ya costaron un fallo

No las reintroduzcas, aunque se reescriba todo.

**`useEffect` con cuerpo corto.** `useEffect(() => window.scrollTo(0, 0), [ruta])` devuelve lo
que devuelva `scrollTo`, y React se lo queda como función de limpieza. Al desmontar intenta
llamarlo y lanza `destroy is not a function`, que se lleva el árbol entero: página en negro.
Siempre cuerpo entre llaves salvo que devuelvas limpieza a propósito.

**Cancelar el guardado con retardo en la limpieza.** El efecto que guardaba el texto de la
evaluación cancelaba el envío al desmontarse, y como dependía de la pregunta, cambiar de
pregunta lo cancelaba. Quien escribía y pulsaba «Siguiente» rápido perdía la respuesta.

**Dar por guardado lo que solo se ha enviado.** Esa corrección no bastó: lo pendiente se
borraba al mandarlo, así que un guardado que fallaba —un 500, una red que parpadea— se perdía
igual. El candidato llegaba al final con «16 de 20 respondidas» sin saber cuáles faltaban.
**Lo escrito no sale de la cola hasta que el servidor lo confirma**, se reintenta solo cada
cinco segundos, se dice cuántas están sin guardar y no se deja entregar mientras quede
alguna. Vale para la evaluación y para la prueba.

**Indicadores que mienten.** Ese mismo sitio ponía «Respuesta guardada» siempre, porque era
texto fijo. Si un indicador dice que algo está a salvo, tiene que salir de comparar con lo
que hay en el servidor. Y una pregunta en blanco no está «guardada»: está **sin responder**,
que es otra cosa.

**Creer que el backend habla `application/json`.** No: Spring devuelve sus errores como
`application/problem+json`. Comprobar el tipo con `includes('application/json')` da falso
sobre ese, así que **todos** los errores se leían con `.text()` y su explicación se perdía.
Meses sin poder diagnosticar nada. Se comprueba con `includes('json')`.

**Límites del backend que el portal no conoce.** El texto de una respuesta tiene un
`@Size(max = 20_000)`. Si el portal deja escribir más, el guardado rebota y la respuesta no
llega.

**Mirar el cuerpo antes que el estado.** Un 500 vacío se colaba como éxito. Primero el
estado, después el cuerpo.

**`<button>` sin `type`.** Por defecto es de envío. Dentro de un formulario, lo envía.

---

## Cómo se escribe aquí

- **Todo en español**, incluidos los nombres del código, como en el backend. Sin eñes ni
  tildes en identificadores: el backend usa `contrasena`, no `contraseña`.
- Carpetas por funcionalidad, no por tipo de archivo.
- Los comentarios explican **por qué**, no qué. Si un comentario describe lo que ya se lee en
  la línea siguiente, sobra.
- Las rutas del portal viven todas en un solo archivo. No escribir direcciones sueltas.
- Los tipos de la API copian los `record` de Java uno a uno. Si cambia allá, cambia aquí.
- **No añadir CORS al backend.** Con la reescritura de Vercel no se necesita, y añadirlo
  abriría el backend a otros orígenes sin motivo.

---

## Lo que falta, y no es diseño

| Qué | Estado |
|---|---|
| **Decisión ámbar** | `DECISION_TURNO_CANDIDATO` existe, pero **no hay ruta** para leer qué evidencia se pide ni para enviarla. La pantalla está entera y el formulario, apagado |
| **Validación** | Tampoco hay ruta: ni días, ni responsable, ni métricas. La pantalla existe y **no se enlaza** hasta que las haya |
| **Si el consentimiento de futuras vacantes está activo** | Solo hay ruta para retirarlo, no para leerlo. Por eso privacidad no enseña ninguna etiqueta de «lo tienes activado» |
| **Saber cómo se llama el candidato** | El backend solo devuelve `{ token, usuarioId }` al entrar. Quien entre desde otro navegador verá el portal sin su nombre |
| **Cuántas preguntas tendrá la evaluación** | El backend arma el orden dentro de `iniciar()`, así que antes devuelve `total: 0`. La portada ya no lo pinta. Cuando `pintar()` sepa contarlas sin armarlas, la cifra vuelve sola |
| **El correo no sale** | El backend tiene `renaser.correo.transporte` en `log` por defecto. Todo «te avisaremos por correo» es hoy una promesa que el sistema desplegado puede no cumplir |
| **Los consentimientos van a crecer** | Todavía no nombran a DeepSeek ni a Google, y tienen que hacerlo antes del primer candidato real. El bloque necesita sitio para un texto bastante más largo |
| **La dirección del backend es prestada** | `nip.io` es de terceros y la IP va escrita a mano en `vercel.json` |
| **Cuenta de prueba en la base real** | `prueba.portal.qa.20260819@example.com` quedó como candidata activa, postulada a Ingeniero/a de Infraestructura (`f7a53fcc-11eb-4369-be96-bee577bdea85`) |
| **Vercel escribe en producción** | El portal desplegado usa la misma base real |

Pendiente de comprobar: si hay evaluaciones ya entregadas con menos respuestas de las que
deberían. Las que se perdieron **no se recuperan**, nunca llegaron al servidor.

---

## Mantener este archivo al día

Es lo primero que lee una sesión nueva. **Si miente, la sesión trabaja sobre una idea falsa
del proyecto** — ya pasó: decía que el tema oscuro era el de la marca cuando el código ya
forzaba el claro.

- **Fechar** la sección que cambie.
- **Borrar lo que dejó de ser cierto**, no acumular. Este archivo se lee entero cada sesión:
  cuanto más largo, menos se sostiene.
- **Verificar antes de escribir.** Lo que dice el código, no lo que se recuerda.
- Es un mapa para orientarse, no un historial. Lo que se hizo un día concreto va a un
  documento en `docs/`; aquí queda solo el estado presente.
