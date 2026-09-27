# La suite e2e, clasificada prueba a prueba (25/09/2026)

Las 329 pruebas de `herramientas/e2e/` se leyeron una a una y se pusieron en uno de tres
cubos. Este documento dice dónde quedó cada una, qué se borró y por qué, qué bajó a prueba
unitaria y en qué archivo vive ahora, qué `serial` sigue y por qué, cómo se corren las que
necesitan IA de verdad, y qué recorridos se quedaron sin cobertura.

## En números

| | Antes | Después |
|---|---|---|
| Pruebas e2e (`npx playwright test --list`) | 329 en 43 archivos | Este trabajo las dejó en **258** en los mismos 43 archivos: 250 en la corrida automática y 8 que solo corren a mano con IA real. Después llegaron de main las 44 de «Buscar vacantes en el portal» (#58, `af9214d`: 34 en `37-buscar-vacantes`, 5 en `38-buscar-vacantes-movil` y 5 en `39-buscar-vacantes-panel`), que no entran en esta clasificación. La suite integrada da **302 en 46 archivos**: **294** en la corrida automática y las mismas 8 de IA real; 21 corren en el proyecto `movil` (las 16 de antes más las 5 de `38`) y 281 en `escritorio` (`e2e/ciclo4-list.txt` en los artefactos del harness) |
| Pruebas unitarias (`npm test`) | 1 026 | **1 054** (+28; contadas antes de integrar main en eab1047, que las dejó en 1 071, y #58, con el que el recibo del controlador del ciclo 4 da 1 146; las 28 de este trabajo siguen siendo las mismas) |
| Archivos con `serial` | 15 | 14 (se quitó el de `18-ranking-contra-api`) |
| Pruebas que fallaban en cada corrida | 16 (+8 más de `03-orden`, que no estaba en esa corrida) | Las 24 dependían de un escenario que la siembra no produce, y ahora se intercepta: ninguna de ellas falló en las corridas enteras. Esas corridas destaparon otras: 5 en la del ciclo 0 (`01`, `07-movil`, `14`, `18`, `23`; rotas por cambios de producto posteriores —#32, #41/V53, #55— o por la intercepción nueva) y 2 en la del ciclo 1 (`06-sin-ciudad`, `25-editar-vacante`; solo fallan cuando la suite ya corrió antes sobre la misma base). Seis se corrigieron y pasaron en las dos corridas enteras del ciclo 2. `23-movimiento` «al volver a la portada» siguió fallando en esas dos: su causa se encontró en el ciclo 3, y en la corrida entera de comprobación de ese ciclo pasó. QA destapó además `13-etapas` «la misma ficha en Prueba del puesto», que con la traza puesta fallaba siempre, y en el ciclo 3 dos huecos que no se veían en rojo: un 500 que `13` dejaba pasar y un `09` que gastaba a una persona sembrada en cada corrida (F-12, F-13; corregidos en el ciclo 4). La corrida entera de QA del ciclo 5 dejó en rojo `37-buscar-vacantes` AC-01, que no venía de este trabajo sino de #58 (F-16; corregida en el ciclo 6 junto con cuatro vecinas del mismo hueco). La del ciclo 7 dejó en rojo `16-cuestionario-tecnico` paso 3, que venía de upstream (#25): recargaba con el guardado de los minutos todavía en vuelo, y por ir en `serial` los diez pasos siguientes no corrieron (F-18). Se corrigió en el ciclo 8 con un barrido del mismo hueco —leer o navegar antes de que termine lo que la prueba acaba de disparar— por los 46 archivos, que corrigió además `14-vacante` (los pesos), `15-componer-prueba` (traer del catálogo), dos de `24-ciudad-obligatoria` y `37-buscar-vacantes` «Ciclo 2 · en escritorio». Todo en «Lo que destapó la corrida entera», y cada corrida citada, con su resultado, en «Las corridas enteras que cita este documento». Cuántas quedan en rojo en la versión final lo dice la corrida de QA que registra el harness, no este documento |
| Pruebas que se saltaban siempre en la base sembrada | 14 | 0: se borraron y quedan anotadas abajo como recorridos sin cobertura |
| Pruebas que llamaban a DeepSeek | 2 archivos (`16`, `17`) | 0 en la corrida automática: 8 pruebas detrás de `E2E_IA_REAL=1` |
| Tiempo de la suite | ~12 min (329 pruebas; la cifra de partida de la spec, no medida en el clon) | **594,2 s (9,9 min)** y **587,9 s (9,8 min)** para las 302 de la suite integrada, en las dos corridas seguidas de QA del ciclo 4 (`e2e/ciclo4-suite-completa.log` y `e2e/ciclo4-segunda-suite-completa.log` en los artefactos del harness), frente a ~12 min para 329. Las dos dieron 294 pasan, ninguna falla y 8 saltadas, que son las de IA real y se saltan en un instante. De ese tiempo, las 44 de #58 suman ~91 s por corrida según el junit (71,8 s `37`, 13,6 s `39` y 6,0 s `38` en `e2e/ciclo4-suite-completa.xml`; lo mismo en la segunda): sin ellas la corrida rondaría los 500 s, según estima QA, en línea con las de antes de #58. Medido el 25/09/2026, de reloj, headless y con un worker, en el clon del harness. **Antes de integrar #58**, las 258 de este trabajo tardaron entre 7,8 y 8,3 minutos en las cuatro corridas enteras en verde que hay medidas: **467,1 s** en la de comprobación de la implementación del ciclo 3, sin traza; **495,4 s** y **477,5 s** en las dos seguidas de QA de ese ciclo (`e2e/ciclo3-suite-completa.log` y `e2e/ciclo3-segunda-suite-completa.log`); y **481,8 s** en la de confirmación de la implementación del ciclo 4. Las cuatro dieron 250 pasan, ninguna falla y 8 saltadas. Las corridas de QA anteriores, con fallos, tardaron 589,6 s (ciclo 0), 483,8 s (ciclo 1) y 487,5 s y 521,9 s (ciclo 2). Estas y las demás corridas enteras que cita el documento están, una a una y con su artefacto, en «Las corridas enteras que cita este documento». Ninguna de estas cifras es una promesa: el tiempo cambia con la carga de la máquina, y el que vale para la versión final es el de la corrida de QA que registra el harness. Las cinco del escenario, una a una, están en la tabla de AC-10 |

Ningún cambio toca código de producción ni `playwright.config.ts`: sigue Playwright test,
headless, un worker.

## Los tres cubos, y cómo se aplicaron

- **Recorrido**: se queda como e2e. Es lo que conecta el portal, el backend y la base de verdad
  —un alta, un guardado, una descarga, una redirección— **y también lo que solo existe en un
  navegador**: el foco, `aria-sort`, un `<select>` nativo, una hoja modal, una barra pegada al
  borde, un `reload`. Nada de eso lo puede ver jsdom.
- **Baja a unitario**: la afirmación central es una regla de `src/` —qué filas deja un filtro,
  en qué orden quedan, qué columnas existen, qué dice una celda, qué valida un formulario—. La
  prueba e2e se borró y la regla se fija (o ya estaba fijada) en un `*.test.ts(x)`. Cuando la
  e2e mezclaba una regla con un cableado de pantalla que hacía falta ver, la e2e se quedó
  **y además** la regla tiene su unitario: es el caso de los rangos de `04-filtros`.
- **Sobra**: repite lo que otra e2e ya cubre con la misma conexión, o mira algo que no puede
  romperse por sí solo (un botón nativo que se abre con Enter, un `reload` que vacía un
  formulario). Se borró; la tabla dice cuál la cubre.

Y una regla que no estaba en los cubos y salió sola: **las pruebas que se saltaban siempre**
porque la base sembrada nunca trae lo que piden (una prueba entregada, dos versiones
publicadas del mismo banco, una sesión de simulación con inscritos) no protegen nada y cuestan
tiempo en cada corrida. Se borraron y quedan anotadas al final como recorridos sin cobertura,
con lo que haría falta sembrar para tenerla.

## Lo que cambió de raíz: el escenario de «Desarrollador web»

Veinticuatro pruebas del ranking (`03-orden`, `04-filtros`, `05-excel`, `07-movil`,
`08-teclado`, y una de `20`) daban por sabido un escenario —notas 74/55/61/95, grupos
ALTA/NO_PRIORIZADO/INCOMPATIBLE, pretensiones 3100–3600 / 2500–3000 / ninguna / 4000–5200—
que la siembra de la base no produce. Lo escribía `scripts/sembrar-escenario-e2e.py` del
backend, y **su `UPDATE` de `nota_etapa` afectaba a cero filas sin decirlo**: una base recién
sembrada no tiene esa fila, así que las notas nunca llegaban y las pruebas fallaban en cada
corrida.

Ahora el escenario vive en `herramientas/e2e/escenario-desarrollador-web.ts`, con dos vías:

1. **`interceptarEscenario(page)`** —la vía por defecto—: el ranking se pide al backend de
   verdad y, antes de pintarlo, a las cuatro filas se les ponen encima la nota, el grupo, la
   ciudad y la pretensión del escenario. La base no se toca. Es el patrón que `34-filtros-y-
   seleccion-qa` ya usaba para la fila sin fecha. El Excel también funciona así: el navegador
   filtra con esas notas y le manda al backend los ids que quedan.
2. **`sembrarEscenarioEnBase()`** y el guion `herramientas/e2e/sembrar-escenario-desarrollador-web.ts`:
   lo mismo escrito en la base por SQL, con `insert … on conflict` para la nota. Sirve para
   medir una vía contra la otra y para dejar el escenario puesto en una base propia.

Con `E2E_ESCENARIO=base` la intercepción se apaga y las pruebas se fían de lo que haya en la
base. Los tiempos de cada vía se midieron en la segunda pasada (tabla de AC-10, abajo): la
intercepción ganó en las cinco pruebas y **el script de Python se borró**.

Dos sorpresas al leer, que no eran de datos sino de formato:

- `05-excel` leía las hojas «Resumen» y «Detalle». Desde el 16/09/2026 el libro es **una hoja,
  «Datos»**, con el formato resumido del cliente y **sin columna de Pretensión**. La prueba
  «celda a celda» compara ahora el «#» y el nombre; la de «la hoja avisa de que la pretensión
  salió vacía» sobra porque la hoja ya no explica columnas que no tiene (lo fija
  `ranking.test.ts`: «la descripción de la hoja no explica columnas que el Excel ya no tiene»).
- `20-prueba-y-empresas` esperaba «Adecuación» y «Potencial» como columnas del perfil integral.
  **Dejaron de ser columnas** (el retrato se lee en la ficha). La prueba fallaba por eso, no por
  la siembra; bajó a unitario. El paso `retratos()` del script de Python ya no lo lee nadie.

## La tabla, archivo por archivo

`R` = Recorrido (se queda). `U` = Baja a unitario (borrada; el unitario se nombra). `S` = Sobra
(borrada; se dice quién la cubre). `IA` = Recorrido que solo corre con `E2E_IA_REAL=1`.
`P` = borrada por saltarse siempre; anotada abajo como pendiente. Los unitarios nuevos están en
`src/panel/vacantes/ranking.escenario-e2e.test.ts` salvo que se diga otro archivo.

### 00-humo (1 → 1)

| Prueba | Cubo | Nota |
|---|---|---|
| el panel abre el listado de vacantes y entra a la 7 | R | |

### 01-regresion-panel (8 → 3)

| Prueba | Cubo | Nota |
|---|---|---|
| el listado de vacantes trae las tres publicadas y se entra a una | S | `00-humo` |
| las cinco pestañas de etapa existen y se pueden recorrer | S | `18-ranking-contra-api` las recorre contrastando cada una con la API |
| los tres cortes y sus contadores cuadran con las filas | S | `18` calcula las cifras de la API en vez de fijar 1/0/4 |
| el detalle de un candidato se despliega y se pliega | R | |
| Simulación, Configuración y el Banco de preguntas siguen abriendo | R | |
| las tres etapas que no exportan no enseñan el botón de Excel | U | `seExportaAExcel`: ya en `ranking.test.ts` («solo perfil integral y prueba del puesto») y nuevo «solo Perfil integral y Prueba del puesto exportan» |
| cambiar de pestaña con filtros puestos los limpia, pero el corte se conserva | R | renombrada «cambiar de pestaña reinicia el orden, pero la búsqueda y el corte se conservan»: absorbe la siguiente y afirma lo que hoy hace el producto —desde #55 la búsqueda (`filtros.texto`) vive en el padre y sobrevive al cambio de etapa; lo que muere con el remontaje de `<Ranking key={etapa}>` es el orden—. Que los demás filtros se conservan lo cubre `33` |
| el orden puesto tampoco sobrevive al cambio de pestaña | S | fundida en la anterior (mismo remontaje de `<Ranking key={etapa}>`) |

### 02-regresion-portal (7 → 1)

| Prueba | Cubo | Nota |
|---|---|---|
| entra, ve «Mis procesos» y abre el detalle de una postulación | R | |
| el listado público de vacantes sigue abriendo sin sesión | S | `12-postular` («el tablón dice de qué empresa…») y `23-movimiento` abren la portada |
| el catálogo de ubigeo llega y el desplegable se puebla agrupado | S | los `optgroup` se añadieron a `24` AC-01 |
| sin ciudad NO deja pasar | S | `24` AC-02 |
| el alta completa con ciudad funciona de principio a fin | S | `24` AC-03; además estas cuatro creaban cuentas `@ejemplo.pe` que nunca se limpiaban |
| «Fuera del Perú» (EXT) también se puede elegir | S | `24` «el doble clic … crea UNA cuenta» guarda EXT y lo lee de la base |
| el desplegable de ciudad se maneja solo con teclado | S | `24` «se elige y se envía solo con el teclado» |

### 03-orden (8 → 2, con el escenario interceptado)

| Prueba | Cubo | Nota |
|---|---|---|
| los tres estados de Candidato, con aria-sort coherente | R | reescrita: absorbe «el grupo se ve en la fila» y «solo una columna a la vez» |
| Ciudad ordena alfabéticamente en los dos sentidos | U | «Ciudad ordena alfabéticamente en los dos sentidos» |
| Nota abre por la MAYOR y manda la nota, cruzando grupos | U | «Nota abre por la MAYOR…»; ya estaba en `ranking.test.ts` («de mayor a menor: manda la nota aunque cruce grupos») |
| el grupo de prioridad se ve en la fila | S | fundida en la primera (los tres `title` en la tabla) |
| Pretensión: los vacíos al final SUBA O BAJE el orden | U | «Pretensión: los vacíos al final…»; el e2e de teclado lo mira de paso |
| solo una columna a la vez lleva aria-sort distinto de none | U | «solo una columna a la vez…» (`alternarOrden` + `comoSeOrdena`); la primera e2e también lo mira |
| las cabeceras de orden se pulsan con el teclado | R | reescrita: absorbe `08` «se puede ordenar entero sin tocar el ratón» (Enter, Espacio, foco) |
| ordenar una columna ENTERA vacía no rompe nada | U | «ordenar una columna ENTERA vacía no rompe nada» |

### 04-filtros (15 → 2, con el escenario interceptado)

| Prueba | Cubo | Nota |
|---|---|---|
| el buscador encuentra CON y SIN tildes, en los dos sentidos | U | mismo nombre; `ranking.test.ts` ya tenía «encuentra a Fátima escribiendo «fatima»» |
| el contador «Se ven N de M» cuadra con las filas visibles | S | `34` AC-08 («Se ven N de M») |
| multi-selección de ciudad: dos marcadas suman las dos | U | mismo nombre; los chips en pantalla los pulsan `07-movil` y `08-teclado` |
| rango de nota: quien no tiene nota queda fuera, y se dice | R + U | e2e fundida en «los rangos de nota y de pretensión del panel recortan la tabla» (el cableado de los campos); la regla, con el mismo nombre en unitario |
| rango de pretensión: solape, no contención; sin declarar queda fuera | R + U | ídem |
| los filtros se combinan entre sí y con el corte | U | mismo nombre (`filtrarFino` + `filtrosActivos` + `filtrar`) |
| «Borrar filtros» borra todos de un golpe, búsqueda incluida | S | `34` AC-06 y `08` «Borrar filtros con el ratón» |
| vacío por filtro: NO dice «nadie tiene nota», nombra el filtro | S | `34` AC-22 (tabla vacía con «Hay N sin filtrar», casilla apagada) y `05` («Nada que descargar») |
| rango invertido (80–20) deja la tabla vacía y lo explica como filtro | U | mismo nombre |
| el vacío SIN filtros sí dice que no hay a quién revisar | S | `18` («Nadie espera tu decisión» cuando el corte queda a cero) |
| el filtro sobrevive a ordenar, y el orden al filtrar | U | mismo nombre |
| recargar la página pierde filtros, orden, etapa y corte | R | solo se ve recargando |
| vacante 7: están Ciudad y Pretensión | U | mismo nombre (`queTraeLaTanda`, `columnasDelRanking`, `pretensionDicha` = «S/ 2,500 – 3,000») |
| vacante 8: la Pretensión desaparece y se explica por qué | U | mismo nombre; la columna que desaparece contra la base real la sigue mirando `06-sin-ciudad` |
| vacante 9: mismo caso, y el ancho de la fila de detalle cuadra | S | `06-sin-ciudad` «TODA VACÍA» comprueba el `colspan`; `ranking.test.ts` «cada criterio encendido es una columna más, y el colSpan la cuenta» |

### 05-excel (10 → 9; la hoja es «Datos»)

| Prueba | Cubo | Nota |
|---|---|---|
| la hoja de «Perfil integral» dice lo MISMO que la pantalla (×2 etapas) | R | reescrita: «#» y nombre celda a celda; ya no hay columna de Pretensión |
| Perfil integral: el archivo llega, pesa y lleva la fecha en el nombre | R | ahora exige la hoja única «Datos» y sus cinco primeras cabeceras |
| Prueba del puesto también exporta | R | ahora exige «Nota Examen Técnico /100» y «Nota Combinada /100» |
| EL EXCEL RESPETA EL FILTRO | R | |
| EL EXCEL RESPETA EL ORDEN | R | |
| un filtro que deja tres filas baja exactamente tres | R | con el escenario interceptado («Nota ≥ 56») |
| vacante 8: la hoja avisa de que la pretensión salió vacía y por qué | S | la hoja ya no lleva Pretensión ni la explica; `ranking.test.ts` «la descripción de la hoja no explica columnas que el Excel ya no tiene» |
| si el servidor rechaza la descarga, se enseña SU mensaje | R | |
| sin filas visibles el botón está apagado | R | |

### 06-sin-ciudad (3 → 3)

Las tres son R: le quita la ciudad a quien toca, contra la base, y se la devuelve al acabar. Es
el precedente de la siembra propia en TypeScript.

Su escenario son **las tres personas que pone el sembrador** en «Analista de experiencia del
cliente», no la vacante entera. En esa vacante también postula `22-perfil-con-foto-y-cv`, y esa
postulación no se puede borrar. «MEZCLA» afirmaba la lista exacta de la tabla, así que solo
pasaba la primera vez sobre una base limpia. Ahora afirma tres cosas: el orden de las tres
sembradas entre sí, que la fila sin ciudad es la última de toda la tabla, suba o baje el orden,
y que el desplegable ofrece tantas ciudades como hay de verdad en la vacante, leídas de la base
(dos en la siembra limpia). Una fila ajena sin ciudad haría que dejara de haber «una sola», y
entonces la prueba falla diciéndolo.

### 07-movil (10 → 9, proyecto `movil`)

| Prueba | Cubo | Nota |
|---|---|---|
| la tabla no desborda el body | R | espera la tabla antes de medir: con el escenario interceptado el ranking llega una vuelta más tarde que la cabecera |
| ordenar y filtrar funcionan igual en el teléfono | R | con el escenario interceptado |
| el pliegue de filtros abre y los chips se pulsan | R | |
| «Filtros» sube como una hoja modal | R | |
| tocar un texto de la hoja o «Borrar filtros» no saca el foco | R | |
| «Columnas» y las acciones van dentro de «Más» | R | |
| la barra de lo marcado no tapa la última fila, botones de 44 px | R | |
| el estado vacío cabe en la celda | R | |
| los tres cortes siguen pulsables | R | |
| el registro con su desplegable de ciudad se rellena en el teléfono | S | `24` «en pantalla de teléfono (375 px)», que ahora también mide el desborde |

### 08-teclado-y-consola (7 → 6, con el escenario interceptado)

| Prueba | Cubo | Nota |
|---|---|---|
| la barra de filtros entera se recorre con Tab | R | |
| los chips de ciudad se marcan con Enter y con Espacio | R | |
| «Filtros» abre con teclado, y Esc lo cierra devolviendo el foco | R | |
| pulsar un texto del panel lo deja abierto con el foco dentro | R | |
| «Borrar filtros» con el ratón: la barra lo manda a «Filtros» y el pie lo conserva | R | |
| se puede ordenar entero sin tocar el ratón | S | fundida en `03` «las cabeceras se pulsan con Enter y con Espacio, y el foco no se pierde» |
| recorrer el ranking no levanta errores nuevos en consola | R | desde el ciclo 4 juzga también la respuesta: solo pasa el 404 de `/ficha` y de las versiones de plantilla; cualquier otro error de red falla (F-12) |

### 09-avance (1 → 1) · 10-panel-entrar (6 → 6) · 11-perfil (13 → 13) · 12-postular (4 → 4)

Todas R. `10`, `11` y `12` siguen en `serial` (ver abajo). `09` siembra desde el ciclo 4 su propia
vacante con una persona en «Pendiente» del perfil, la avanza y la retira: ya no mueve a Diego
Salazar Núñez, de la siembra (F-13, en «Lo que destapó la corrida entera»).

### 13-etapas (8 → 3)

| Prueba | Cubo | Nota |
|---|---|---|
| la entrada de desarrollo sigue abriendo el panel | R | |
| en las cinco pestañas, la celda de la nota empieza por la cifra o por su guion | U | «quien no tiene nota de la etapa lleva un porqué corto…»; `ranking.test.ts` «el motivo del guion, en dos palabras»; `18` mira los guiones contra la API |
| la ficha del perfil integral trae las dos tablas | R | |
| la misma ficha en «Prueba del puesto» enseña su rúbrica, no el CV | R | tolera el 404 —y solo el 404— de `/prueba/notas`, `/prueba/entregables` y `/prueba/respuestas` de quien no rindió, y espera a que los tres bloques contesten: un 500 en cualquiera de ellos la hace fallar (ver «Lo que destapó la corrida entera», F-10 y F-12) |
| quien tiene nota en prueba, simulación y validación la conserva | P | siempre `skip`: nadie tiene nota en las tres |
| la ficha de Validación enseña el periodo y las métricas | P | siempre `skip`: ningún periodo habilitado |
| en Decisión, «Le toca al candidato» enseña exactamente a quien anuncia su contador | S | `18` «Le toca al candidato en Decisión enseña a los suyos» |
| la evaluación del banco se abre por dentro | P | siempre `skip`: ninguna evaluación respondida |

### 14-vacante (8 → 8) · 15-componer-prueba (15 → 15)

Todas R, en `serial` (cada tramo abre lo que dejó el anterior). En `14`, tres tramos fallaban
desde cambios de producto de #41/V53 y dejaban una vacante publicada en el portal en cada
corrida: `abrirLaVacante` ahora pulsa la tuerca cuando la vacante ya está publicada (la
configuración solo se abre sola en borrador), el interruptor del recorrido automático se pulsa
y se espera al servidor (la casilla la manda el backend, como la del banco), y el cierre se
confirma con «Confirmar cierre». En el ciclo 8, el tramo de los pesos espera la respuesta del
servidor: la vacante nace ya con esos pesos y el desplegable no bastaba para saber que se
guardaron. En `15`, la ayuda que trae preguntas del catálogo espera a que el catálogo haya
llegado antes de leer sus opciones. Los dos, en «Lo que destapó la corrida entera».

### 16-cuestionario-tecnico (13 → 13; 7 solo con IA real)

| Prueba | Cubo | Nota |
|---|---|---|
| 1 · nace en borrador rindiendo la prueba del puesto | R | |
| 2 · elegido el cuestionario, lo de la prueba del puesto desaparece | R | |
| 3 · cuarenta y cinco minutos, guardados a mano | R | venía de upstream (#25) y recargaba con el guardado todavía en vuelo; desde el ciclo 8 espera la respuesta del servidor antes de recargar (F-18, en «Lo que destapó la corrida entera») |
| 4 · la evaluación del banco se apaga | R | |
| 5 · publicar está apagado, y dice que falta el cuestionario | R | |
| 6 · la ficha queda completa | IA | no llama a la IA, pero solo existe para que el 7 tenga ficha; la ficha la cubre `17` paso 2 |
| 7 · la IA escribe el cuestionario | IA | |
| 8 · con el cuestionario publicado la vacante se publica | IA | |
| 9 · una candidata crea su cuenta y postula | IA | |
| 10 · el equipo la hace avanzar hasta la etapa técnica | IA | |
| 11 · la candidata rinde el cuestionario y lo entrega | IA | |
| 12 · el equipo lee lo que escribió y la nota llega al ranking | IA | |
| 13 · ni la red ni la consola se quejaron | R | |

### 17-prueba-tecnica (6 → 6; 1 solo con IA real)

Pasos 1, 2, 3, 4 y 6: R. Paso 5 («de verdad: la IA redacta, el dueño corrige y publica»): IA.

### 18-ranking-contra-api (5 → 4; ya no es `serial`)

| Prueba | Cubo | Nota |
|---|---|---|
| el contrato: `?etapa=` cambia la nota y NO la lista | R | |
| las cinco pestañas: cortes, cifras y filas cuadran con la API | R | |
| «Le toca al candidato» en Decisión enseña a los suyos | R | |
| el escape a la tanda entera trae a todos, y cada guion dice por qué | R | lee el motivo corto de la celda y la frase entera de su `title` (desde #32 el texto de la tabla no la trae) y exige que casen |
| sin errores de página en todo el recorrido | S | lo hace el `test` de `ayuda-candidato` en cada prueba; era el único motivo del `serial` |

### 19-banco (13 → 11)

| Prueba | Cubo | Nota |
|---|---|---|
| dos PUBLICADA del mismo nivel conviven | P | siempre `skip`: la base trae una publicada por nivel |
| el nivel con dos publicadas lo avisa arriba del grupo | P | ídem; la pantalla se fija en `BancoDePreguntas.test.tsx` |
| las otras once | R | contrato, guardas 409, el ciclo sobre un borrador propio y el panel |

### 20-prueba-y-empresas (14 → 2)

| Prueba | Cubo | Nota |
|---|---|---|
| GET /prueba/respuestas devuelve una lista con preguntaId, enunciado y respuesta | P | siempre `skip`: nadie tiene prueba con respuestas |
| CierrePruebaResponse trae «intentosConPlazoPropio» | R | |
| sin prueba del puesto elegida lo explica en español | S | siempre `skip` (las tres vacantes la tienen elegida); `29-plazo` AC-06 lo mira sobre su propia vacante |
| POST /prueba/calificacion-ia encola y contesta | P | siempre `skip` (nadie la entregó), y llama a la IA |
| el ranking, etapa por etapa: la nota se llama por su etapa y las dimensiones del CV desaparecen | U | «la nota se llama por su etapa en el título, y las dimensiones del CV no son columnas»; además fallaba por formato (ver arriba) |
| la ficha enseña lo que escribió pregunta a pregunta | P | siempre `skip`; la pantalla en `RespuestasDePrueba.test.tsx`; el recorrido real, en `16` paso 12 con IA |
| pedirle a la IA contesta una de las dos cosas | P | siempre `skip`; las dos ramas en `CalificarConIa.test.tsx` |
| cuándo cierra la prueba: cronometrada acepta fecha, quitar el cierre | S | `29-plazo` AC-02, AC-03 y AC-08 |
| hay postulaciones con rúbrica de prueba que mirar | S | era la guardia de las dos siguientes y **fallaba** en la base sembrada (`conRubrica` vacío) |
| con la rúbrica entera y sin nota, ofrece calcularla | P | siempre `skip`; `NotaDeLaPrueba.test.tsx` («ofrece calcularla y explica por qué faltaba») |
| con la rúbrica vacía manda a la IA y el 409 nombra los criterios | P | siempre `skip`; `NotaDeLaPrueba.test.tsx` («sin ninguna nota manda a pedirle la calificación a la IA», «el 409 se enseña entero») |
| las notas de la prueba para la tanda entera | P | en la base sembrada solo ejercitaba la rama «no se pinta el bloque»; `LaTandaDeLaPrueba.test.tsx` entero |
| calificar la tanda: pregunta antes, dice a quién alcanza y se puede echar atrás | U | `CalificarConIa.test.tsx` «pregunta antes de llamar, y dice a cuánta gente alcanza» y ««mejor no» no manda nada» |
| la entrada de las empresas vive en el pie del portal | R | |

### 21-simulacion-permisos (7 → 5)

| Prueba | Cubo | Nota |
|---|---|---|
| la lista de sesiones responde | R | |
| cada sesión: /inscritos responde 200 con los cinco campos | P | siempre `skip`: no hay sesiones |
| la pantalla enseña a quien está inscrito y marca la asistencia | P | ídem; `Inscritos.test.tsx` entero |
| los roles responden y existe el rol de prueba | R | |
| la matriz trae el catálogo entero y cambiar el alcance exige motivo | R | |
| la pantalla ofrece el rol y pinta la casilla | R | |
| quitar el último «administrar_permisos» se rechaza con 409 | R | corre: solo ADMINISTRADOR lo tiene en la base |

### 22-perfil-con-foto-y-cv (12 → 11)

Once R en `serial`. «un PDF no vale como foto, y lo dice sin jerga»: U, nuevo en
`src/paginas/perfil/archivos.test.ts` («un PDF no vale como foto»).

Las dos que postulan daban por enviada la postulación al ver `/postulación|recibimos/`, y ese
texto ya está en el propio formulario, en el botón «Enviar mi postulación». «postular sin
adjuntar nada» pasaba sin haber postulado nunca: «Líder de operaciones» pide la pretensión,
nadie la escribía y el envío se quedaba en la página. Ahora se escribe la pretensión si la
vacante la pide, y el envío se da por hecho solo cuando la pantalla llega a «Mis procesos» y el
backend cuenta la postulación. Cada corrida deja una postulación de «Prueba De Archivos» en cada
una de las dos vacantes: la cuenta se retira, pero la postulación nace con su transición y no
se puede borrar.

### 23-movimiento (7 → 7) · 23-remuneracion (5 → 5)

Todas R: el movimiento de la portada solo se mide en un navegador; la remuneración escribe y
restaura contra la base. En `23`, «al volver a la portada» era inestable en la corrida entera
(mínimo 0,88 con umbral 0,6): el observador se instalaba con `page.evaluate` después de navegar
y bajo carga su primer frame llegaba con la animación avanzada. Ahora el observador de la franja
se instala con `addInitScript` para las dos pruebas de la franja y muestrea en el instante en
que entra al DOM (`MutationObserver`) además de frame a frame; cada aparición es una anotación
y la prueba lee la que le toca. Los umbrales no cambiaron.

Con eso siguió fallando en las dos corridas enteras del ciclo 2, con otro síntoma: tras volver
no llegaba ninguna franja nueva y la espera agotaba sus 8 s. La causa era la propia prueba:
volvía atrás en cuanto cambiaba la URL, y React Router escribe la URL con `pushState` en el
mismo clic, antes de que React monte la ficha. Con la máquina cargada el `popstate` llegaba
antes de que la portada se desmontara, las dos navegaciones se resolvían en una y la portada no
llegaba a irse: no había vuelta que animar. Se reproduce siempre frenando la CPU x4 por CDP (la
versión anterior falla 3 de 3 con el mismo `TimeoutError`, y la captura es la misma que la de
QA). Ahora espera a la ficha pintada (el titular de la tarjeta en el `h1`, sin franjas en el
documento) antes de volver, y a la portada montada otra vez antes de leer. Pasa 5 de 5 con la
CPU x4 y x8, y 70 de 70 aislada con y sin traza.

### 24-ciudad-obligatoria (12 → 9)

| Prueba | Cubo | Nota |
|---|---|---|
| AC-01 · la etiqueta lo marca, el desplegable lo anuncia | R | absorbe los `optgroup` de `02` |
| AC-02 · con el botón: no navega, marca el campo, no nace ninguna cuenta | R | desde el ciclo 8 espera a que llegue la lista de ciudades antes de enviar: un campo apagado no recibe el foco que comprueba |
| con la tecla Enter: el mismo rechazo | R | el envío implícito es del navegador |
| el doble envío tampoco cuela | S | cada clic revalida; `Registro.test.tsx` «sin ciudad no se crea la cuenta…» |
| recargar no deja la ciudad puesta ni el error colgado | S | no puede romperse por sí solo: recargar reinicia el estado |
| AC-03 · el error se va al corregirlo, el registro termina | R | |
| el doble clic en «Crear cuenta» crea UNA cuenta, no dos | R | guarda EXT y lo lee de la base |
| «Fuera del Perú» (EXT) es una elección válida | S | lo demuestra la anterior |
| se elige y se envía solo con el teclado | R | desde el ciclo 8 espera a que el desplegable esté encendido antes de enfocarlo |
| en pantalla de teléfono (375 px) el campo, su marca y su error se ven | R | absorbe el desborde de `07` |
| el catálogo de ciudades no carga: se informa, se reintenta | R | con `page.route`, como estaba |
| AC-05 · a quien ya tenía cuenta sin ciudad no se le pide nada | R | |

### 25-editar-vacante (6 → 3)

| Prueba | Cubo | Nota |
|---|---|---|
| el lápiz abre un modal con los datos de ahora, y la tabla no se mueve | R | mide la fila en coordenadas de la página, no de la ventana (ver «Lo que destapó la corrida entera») |
| cancelar sin cambios cierra; con cambios pregunta y no los pierde | U | `EditarVacante.test.tsx`: «sin cambios, cancelar cierra sin preguntar», «con cambios, cancelar pregunta y «Seguir editando» los conserva», ««Descartar cambios» cierra sin guardar ni avisar» (reabre y comprueba) |
| Escape sin cambios cierra el modal y el foco vuelve al lápiz | R | el foco de vuelta solo se ve en el navegador |
| guardar dos veces lo mismo: la segunda dice que no había nada que guardar | R | |
| abrir la edición cierra el alta | U | `EditarVacante.test.tsx` «abrirlo cierra el alta: un solo formulario a la vez» |
| el lápiz se alcanza con el tabulador y se abre con Enter | S | un `<button>` nativo no puede dejar de abrirse con Enter |

### 25-prueba-del-puesto-estados (7 → 7)

Todas R: siembra ocho casos por SQL y los contrasta con la API y con el Excel.

### 26-editar-vacante-avisos (8 → 7)

Siete R en `serial`. «sin decir por qué cambia el sueldo no se envía nada, y lo escrito se
conserva»: U, `EditarVacante.test.tsx` «cambiar el sueldo de una publicada no se manda sin
decir por qué» (ya existía) y nuevo «sin el motivo del sueldo, lo escrito en los demás campos
se queda donde estaba».

### 27 · 28 · 29-eliminar · 29-plazo · 30 · 31 · 32 (9 · 3 · 6 · 11 · 5 · 2 · 5, sin cambios)

Todas R: archivar, eliminar y el plazo de la prueba escriben en terreno propio y miran la
base, la API y las dos caras (panel y portal). `27` y `29-eliminar` siguen en `serial`.

### 33-filtros-y-seleccion-en-lote (9 → 2)

| Prueba | Cubo | Nota |
|---|---|---|
| un día y un rango: conteos, etiquetas e insignia; quitar una y borrar todo | S | `34` primera prueba, sobre 32 filas en 9 días (aquí las cuatro eran del mismo día) |
| el panel flota: abrirlo y cerrarlo no mueve ni una fila | R | absorbe `aria-modal="false"` de la anterior |
| «Desde» después de «Hasta» no se aplica y se avisa | U | mismo nombre; `ranking.test.ts` ya lo tenía |
| «Últimos 7 días» rellena de hoy − 6 a hoy | U | mismo nombre; `ranking.test.ts` ya lo tenía |
| calificación con IA «Fallida»: solo las fallidas | S | `34` «IA: «Fallida» deja solo las fallidas…» con fallidas de verdad |
| los filtros se conservan al cambiar de etapa y volver | R | |
| marcar todo con un filtro puesto y avanzar: solo avanzan las que se ven | U + `34` | la regla («marcar todo no toca a las ocultas») con el mismo nombre; el avance real con los ids que salen, en `34` «avance real desde la barra» |
| con la tabla más alta que la ventana, «Descartar…» se alcanza y enseña los nombres | S | `34` «seis marcadas…» (los nombres de la ventana) y «a media tabla…» (la barra a la vista) |
| marcar todo funciona igual en dos etapas distintas | U | mismo nombre |

### 33-recuperar-contrasena (5 → 5) · 34-recuperar-contrasena-movil (4 → 4) · 35-filtros-y-seleccion-qa-movil (3 → 3)

Todas R.

### 34-filtros-y-seleccion-qa (22 → 20)

| Prueba | Cubo | Nota |
|---|---|---|
| una fila sin fecha de postulación (nula o ausente) queda fuera | U | mismo nombre; `ranking.test.ts` ya lo tenía («quien no tiene fecha queda fuera en cuanto hay filtro de fecha», con nula y ausente) |
| F-06 · «Borrar filtros» de la barra, con teclado | S | `08` «Borrar filtros con el ratón: la barra lo manda a «Filtros»» (Enter sobre un botón es el mismo clic) |
| las otras veinte | R | fecha, IA, medianoche y Tokio, selección, Excel, foco, permisos y el avance real |

### 35-recuperar-contrasena-bordes (7 → 6)

Seis R en `serial`. «enlace sin token: lo dice y lleva a pedir otro en su propia puerta»: U,
`Restablecer.test.tsx` «sin token en la dirección dice que el enlace está incompleto» (portal,
ya existía) y nuevo en `RecuperarClavePanel.test.tsx` (panel).

### 36-recuperar-contrasena-regresiones (2 → 1)

«los correos no dicen «S.A.C..»»: R. «una contraseña de más de 72 bytes no termina en un
mensaje técnico»: U, «F-01 · más de 72 bytes se para en el campo» en `Restablecer.test.tsx` y
`RecuperarClavePanel.test.tsx` (ya existían: la pantalla lo para antes de llamar).

### 37-buscar-vacantes · 38-buscar-vacantes-movil · 39-buscar-vacantes-panel (34 · 5 · 5, llegaron con #58)

Fuera de la clasificación: llegaron de main con «Buscar vacantes en el portal» (#58, `af9214d`)
después de clasificar las 329. `38` corre en el proyecto `movil`. Ninguna va en `serial` ni le
pide nada a la IA, y las 44 pasaron en las dos corridas enteras de QA del ciclo 4.

Se integraron sin tocarlas salvo dos correcciones de sincronización en `37`: la de F-16 (ciclo
6), que se cuenta aquí, y la de «Ciclo 2 · en escritorio…» (ciclo 8), que medía la página con
dos lecturas separadas durante un desplazamiento suave (en «Lo que destapó la corrida entera»).
La de F-16 venía de upstream y fallaba igual sobre `af9214d`. Tras un clic en el orden, cinco
pruebas leían la lista con `allTextContents()`, que no reintenta, esperando solo a la dirección o sin esperar
nada. React Router escribe la dirección antes de pintar, y el orden y los filtros llegan en una
transición, así que se podía leer el orden anterior. La corrida entera de QA del ciclo 5 lo cazó
en AC-01: fallaba ~10-15 % sin frenar y 10 de 10 con la CPU x4. Ahora cada lectura espera antes
a algo que sale del mismo render que la lista. En AC-01, AC-09, AC-15 y «sin texto, «Relevantes»
cuenta el sueldo…» es el radio del orden marcado. En «Ver las N vacantes» son las nueve tarjetas:
ahí «Recientes» ya estaba marcado, y el texto vacío se pinta antes de que se quite Lima. Lo que
afirman no cambia. Con la CPU x6, AC-15, la de completitud y «Ver las N» fallaban 5 de 5 sin la
corrección y pasan 20 de 20 con ella. AC-01 pasa 20 de 20 sin frenar y 10 de 10 con x4 y con x6.
En AC-09 la búsqueda no da resultados y el fallo no podía verse, pero el hueco era el mismo. `38`
y `39` se revisaron y no se tocaron: sus lecturas van detrás de un estado pintado, sea la cuenta,
la casilla marcada o el desplegable habilitado.

### 40-rubrica-vigente-en-el-excel (7, llegó el 26/09/2026)

Fuera de la clasificación: la añadió QA con «El Excel de la prueba del puesto usa la prueba
vigente», después de este recorte. Con ella la suite pasa a **309 pruebas en 47 archivos**, 301
en la corrida automática. No va en `serial` ni le pide nada a la IA. ⚠️ **Escribe**: siembra por
SQL, con la marca `QA-RUBRICA-180F`, una vacante que cambió de prueba con gente dentro, y la
retira al terminar (su ayuda es `ayuda-rubrica-vigente.ts`). Qué comprueba, en la
[bitácora](BITACORA-2026-09.md) del 26/09.

## Las cuentas de lo que bajó a unitario (AC-02 y AC-08)

Bajaron 27 pruebas. Se añadieron 28 unitarias: 25 en
`src/panel/vacantes/ranking.escenario-e2e.test.ts` —una por cada e2e del ranking que bajó,
con el mismo nombre y sobre el mismo escenario— y una en cada uno de `archivos.test.ts`,
`EditarVacante.test.tsx` y `RecuperarClavePanel.test.tsx`. Las siete restantes ya tenían su
unitario, nombrado en la tabla. `npm test`: 1 026 → 1 054.

## Los `serial` que quedan, y por qué

| Archivo | Por qué sigue en serie |
|---|---|
| `10-panel-entrar` | invitación → canje → salir → entrar → enlace gastado: cada paso deja al siguiente donde lo necesita |
| `11-perfil` | la cabecera que se llena en el paso 2 es la que el 3 comprueba que no se borra; las experiencias del 5 son las que la cronología del 11 cuenta |
| `12-postular` | la cuenta que crea el paso 2 es con la que postulan el 3 y el 4 |
| `14-vacante` | crear → configurar → publicar → cerrar sobre la misma vacante |
| `15-componer-prueba` | cada tramo abre la versión que dejó el anterior; publicar depende de todo lo escrito antes |
| `16-cuestionario-tecnico` | el ciclo entero sobre una vacante; con IA real, cada paso necesita el anterior |
| `17-prueba-tecnica` | la ficha del paso 2 es la que el 4 y el 5 necesitan |
| `22-perfil-con-foto-y-cv` | la foto que se quita, el currículum con el que se postula sin adjuntar |
| `23-remuneracion` | la banda puesta en `beforeAll` y la cuenta creada son de todas las pruebas |
| `26-editar-vacante-avisos` | cada guardado cambia el título o el sueldo que el siguiente da por puesto |
| `27-archivar-vacante` | archivar → buscarla en las dos vistas → consultarla → desarchivar |
| `29-eliminar-vacante` | eliminar → no reaparece → el candidato lo ve → la solicitud liberada |
| `33-recuperar-contrasena` | el enlace del recorrido 1 es el que el 3 usa dos veces |
| `35-recuperar-contrasena-bordes` | comparten el tope por IP y las cuentas de `beforeAll`; cada una gasta enlaces de su propia cuenta |

Se quitó el de `18-ranking-contra-api`: sus pruebas no comparten estado (cada una abre la
vacante y `contexto` se llena en `beforeAll`); el `serial` existía por la prueba final «sin
errores de página», que ahora hace el `test` de `ayuda-candidato` en cada una. Los archivos
`28`, `30`, `31` y `32` ya estaban fuera de serie a propósito (cada prueba siembra o elimina lo
suyo).

## Las que dependían del sembrador: lo medido y la decisión (AC-10)

Las pruebas que dependían de `scripts/sembrar-escenario-e2e.py` y siguen como e2e:

| Prueba | Vía por defecto | Comando con el que se midió |
|---|---|---|
| `03-orden` × 2 | interceptada | `npx playwright test herramientas/e2e/03-orden.spec.ts` |
| `04-filtros` «los rangos de nota y de pretensión…» | interceptada | `npx playwright test herramientas/e2e/04-filtros.spec.ts -g "rangos"` |
| `05-excel` «un filtro que deja tres filas…» | interceptada | `npx playwright test herramientas/e2e/05-excel.spec.ts -g "tres filas"` |
| `07-movil` «ordenar y filtrar funcionan igual en el teléfono» | interceptada | `npx playwright test herramientas/e2e/07-movil.spec.ts -g "ordenar y filtrar"` |
| `08-teclado` «la barra de filtros entera se recorre con Tab» | interceptada | `npx playwright test herramientas/e2e/08-teclado-y-consola.spec.ts -g "recorre con Tab"` |

Las otras diecinueve que dependían de él bajaron a unitario o sobraban (tabla de arriba); la
de `20` fallaba por formato.

**Cómo se midió** (25/09/2026, segunda pasada): el preview del harness arriba con la IA
apagada, sobre el mismo clon y con las seis variables de
[TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md); headless, un worker; dos corridas por lado y se
anota la mejor (las dos coincidieron a ±0,2 s). Es tiempo de reloj del comando entero:
`npx playwright test …` tarda ~1 s en arrancar, igual en las tres vías. Las tres:

```bash
# A · el sembrador de Python (hoy borrado) + las pruebas fiándose de la base
time python3 ../backend/scripts/sembrar-escenario-e2e.py \
  --api "$E2E_API" --contenedor "$E2E_PG" --db "$PGDATABASE" --usuario "$PGUSER"
time E2E_ESCENARIO=base npx playwright test herramientas/e2e/03-orden.spec.ts   # y las otras cuatro

# B · el sembrador en TypeScript + las pruebas fiándose de la base
time npx vite-node herramientas/e2e/sembrar-escenario-desarrollador-web.ts
time E2E_ESCENARIO=base npx playwright test herramientas/e2e/03-orden.spec.ts

# C · la intercepción, sin sembrar nada (lo que corre por defecto)
time npx playwright test herramientas/e2e/03-orden.spec.ts
```

El tiempo de A y de B es la suma de sembrar y correr; el de C es solo correr. Entre corrida y
corrida la base se devolvió a su estado con SQL: los dos sembradores dejan el escenario puesto
y ninguno lo quita.

| Prueba | A · Python (3,1 s de sembrar + correr) | B · TypeScript (1,7 s de sembrar + correr) | C · interceptar | Decisión |
|---|---|---|---|---|
| `03-orden` (2 pruebas) | 3,1 + 4,4 = **7,5 s** | 1,7 + 4,2 = **5,9 s** | **5,4 s** | interceptar |
| `04-filtros` (rangos) | 3,1 + 3,5 = **6,6 s** | 1,7 + 3,5 = **5,2 s** | **3,9 s** | interceptar |
| `05-excel` (tres filas) | 3,1 + 3,9 = **7,0 s** | 1,7 + 3,8 = **5,5 s** | **4,4 s** | interceptar |
| `07-movil` (ordenar y filtrar) | 3,1 + 3,2 = **6,3 s** | 1,7 + 3,2 = **4,9 s** | **3,6 s** | interceptar |
| `08-teclado` (Tab) | 3,1 + 3,4 = **6,5 s** | 1,7 + 3,7 = **5,4 s** | **3,8 s** | interceptar |

Lo que se lee de la tabla:

- **Correr fiándose de la base es 0,2–1,0 s más rápido que interceptar** —la intercepción
  vuelve a pedir el ranking y lo reescribe—, pero sembrar cuesta más que eso: 3,1 s el de
  Python (doce peticiones a la API y quince `docker exec`) y 1,7 s el de TypeScript. Con la
  regla de la tabla —sembrar más correr, prueba a prueba— la intercepción es la más rápida en
  las cinco: entre 2,2 y 3,1 s por debajo del de Python y entre 0,5 y 1,6 s por debajo del de
  TypeScript. El margen más corto es el de `03-orden` frente al de TypeScript (0,5 s, un 8 %):
  ese archivo trae dos pruebas y paga la intercepción dos veces.
- Si se mira la tanda de cinco como un todo (se siembra una vez), B y C quedan a la par
  (20,1 s frente a 21,1 s) y A en 21,5 s. Ahí lo que decide no es el reloj: **los sembradores
  dejan la base escrita** —notas, grupos, pretensiones—, y `18-ranking-contra-api` y las demás
  pruebas de esta vacante dan por sabido que esas cuatro personas no tienen nota. Fiarse de la
  base obligaría a sembrar antes y restaurar después dentro de la misma corrida; la
  intercepción no toca nada.

**Decisión: las cinco se quedan interceptadas** (la vía por defecto no cambia) y **el script de
Python se borró del backend**, porque ninguna prueba lo sigue necesitando. Para poder medirlo
hubo que corregirle dos cosas más, y las dos se fueron con él: contaba la etiqueta `UPDATE 1`
que `psql` imprime como si fuera una segunda fila (le faltaba `-q`, así que paraba en la
primera escritura), y a Sebastián lo saltaba en vez de quitarle la pretensión con la que la
cuenta nace —en el clon todas nacen con una—, con lo que «los vacíos al final» de `03-orden` no
podía salir. Con eso puesto pasó las cinco, y la tabla es de esa versión.

Lo que queda de la vía «base»: `sembrarEscenarioEnBase()`, el guion
`herramientas/e2e/sembrar-escenario-desarrollador-web.ts` y la variable `E2E_ESCENARIO=base`,
para repetir esta medición o para dejar el escenario puesto en una base propia y mirarlo en el
panel. Ninguna prueba los usa por defecto.

## Las pruebas con IA real, y cómo correrlas (AC-12)

Ninguna prueba de `npx playwright test` le pide nada a DeepSeek: las ocho que lo necesitan
se saltan con el motivo `SIN_IA_REAL` de `herramientas/e2e/ayuda.ts`. Antes, con la clave
ficticia, `16` y `17` **sí** disparaban el pedido y esperaban a que fallara.

| Archivo | Pasos | Qué le piden al proveedor |
|---|---|---|
| `16-cuestionario-tecnico` | 6 a 12 | el REDACTOR escribe el cuestionario (7) y el EVALUADOR_TECNICO lo califica (12); el 6 solo prepara la ficha para el 7 |
| `17-prueba-tecnica` | 5 | el REDACTOR escribe el cuestionario |

Para correrlas a mano:

1. El backend contra el mismo clon, con la clave real de DeepSeek en su configuración y
   `RENASER_AI_CALIFICACION_HABILITADA=true`. Cada corrida cuesta dos o tres llamadas al
   modelo y cuenta contra el tope mensual de la empresa.
2. Las seis variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md) y, además:

```bash
E2E_IA_REAL=1 npx playwright test herramientas/e2e/16-cuestionario-tecnico.spec.ts herramientas/e2e/17-prueba-tecnica.spec.ts
```

Los pasos del 16 tienen 7 minutos de tope cada uno (la generación tarda uno o dos con la
clave real). Una `FALLIDA` con la clave real **es un fallo** y no un `skip`.

## Pendientes explícitos y recorridos sin cobertura (paso 9 y AC-11)

Ninguna prueba quedó rota ni deshabilitada sin motivo. Lo que se borró por saltarse siempre
deja estos recorridos **sin cobertura e2e** (antes tampoco la tenían: se saltaban), con lo que
haría falta sembrar para tenerla. No se añaden pruebas nuevas: el objetivo era recortar.

| Recorrido | Qué haría falta en la base | Dónde se fija hoy |
|---|---|---|
| La ficha del panel enseña lo que la persona escribió en la prueba, y «pedirle a la IA» contesta «se pidió» o «no se encoló» | una postulación con la prueba del puesto ENTREGADA (intento con `entregado_en` y respuestas) | `RespuestasDePrueba.test.tsx`, `CalificarConIa.test.tsx`; con IA real, `16` paso 12 |
| Calcular la nota de la prueba con la rúbrica entera, y el 409 con la rúbrica vacía | una postulación con criterios calificados y sin nota de etapa, y otra con la rúbrica vacía | `NotaDeLaPrueba.test.tsx`; `25-prueba-del-puesto-estados` siembra intentos pero no rúbricas |
| El bloque de la tanda entera de la prueba y su reparto | varias postulaciones rendidas y sin nota en la misma vacante | `LaTandaDeLaPrueba.test.tsx` |
| `GET /prueba/respuestas` y `POST /prueba/calificacion-ia` (contrato) | una prueba entregada | ninguno en el frontend; el backend tiene sus IT |
| Quien tiene nota en prueba, simulación y validación la conserva en las tres pestañas | una persona calificada en las tres etapas | `ranking.test.ts` («quien ya la hizo…») |
| La ficha de Validación con el periodo y las métricas | una postulación en validación con periodo habilitado | ninguno en el frontend |
| La evaluación del banco abierta por dentro (cerradas que promedian, abiertas que esperan) | una evaluación del banco respondida | ninguno en el frontend |
| Dos versiones PUBLICADA del mismo nivel del banco: cuál rige, el aviso del grupo | una segunda publicada en un nivel | `BancoDePreguntas.test.tsx` |
| La lista de inscritos de una sesión de simulación y marcar la asistencia | una sesión con inscritos | `Inscritos.test.tsx` |
| Una vacante sin prueba del puesto elegida rechaza el cierre en español (por API) | una vacante sin versión de prueba | `29-plazo` AC-06 por pantalla, sobre terreno propio |

Otros pendientes que deja este trabajo:

- El tiempo de la suite no tiene una cifra fija: cambia con la carga de la máquina. El de la
  versión final es el de la corrida de QA que registra el harness; las corridas que este
  documento cita están en «Las corridas enteras que cita este documento».
- Cada corrida entera deja en la base cosas que no se pueden borrar: postulaciones con su
  transición (`12`, `22`) y trece vacantes. Tres se quedan a la vista en el panel: una CERRADA
  de `14` y dos en BORRADOR de `16` y `17`. Las otras diez quedan PUBLICADAS pero marcadas
  eliminadas, y no salen ni en el panel ni en el portal: nueve de `29`–`35` (ocho
  «QA-ELIMINA-830D…» y una «QA-FILTROS-43CA…») y, desde el ciclo 4, una «QA-AVANCE-09…» con la
  cuenta de `09` retirada. `09` ya no mueve a nadie de la siembra. Las de #58 (`37`–`39`) no
  dejan nada: retiran lo que siembran, y `37` y `38` esconden las publicadas ajenas pasándolas
  a borrador y las devuelven como estaban. QA lo midió antes y después de sus corridas de los
  ciclos 4, 5 y 6, y entre las dos seguidas de los ciclos 4 y 6 (`clon/ciclo4-*`,
  `clon/ciclo5-*` y `clon/ciclo6-*` en los artefactos del harness): cada corrida sumó una
  CERRADA, dos BORRADOR y diez eliminadas; no quedó ninguna vacante, solicitud ni cuenta con la
  marca de #58; el panel no enseñó ninguna vacante con título «QA-», y el tablón siguió con las
  tres vacantes sembradas. Cuántas vacantes enseña el panel no es una cifra fija: crece con cada
  corrida. Eran 42 tras las dos del ciclo 4, 45 tras la del ciclo 5, y 48 tras la primera del
  ciclo 6 y 51 tras la segunda, siempre con las 3 publicadas sembradas y el resto en borrador o cerradas. La suite
  está hecha para volver a correr sobre esa base, con la regla que se explica en «Lo que destapó
  la corrida entera». Lo que se acumula no se limpia: el panel enseña tres vacantes más por
  corrida, y las dos vacantes sembradas, más postulantes retirados.
- `22-perfil-con-foto-y-cv` «el currículum se guarda… deja de estar EN_CURSO» espera hasta dos
  minutos a que la lectura del currículum termine. Con la IA apagada termina en `NO_LEGIBLE` sin
  llamar a nadie (el PDF de prueba no tiene texto extraíble); si un día la lectura llamara al
  proveedor con la IA encendida, esa prueba tendría que ir detrás de `E2E_IA_REAL`.
- Los números repetidos `33`–`35` entre filtros y contraseña siguen (ya estaban en
  [PENDIENTES.md](PENDIENTES.md)).

## Lo que destapó la corrida entera (25/09/2026)

La primera pasada clasificó sin correr la suite completa, y la corrida de QA sacó cinco fallos
que la clasificación daba por verdes. La del ciclo 1 sacó dos más, que solo aparecen cuando la
suite ya corrió antes sobre la misma base. Ninguno es del producto, y todos se corrigieron en
las pruebas sin bajar ninguna expectativa.

Las dos corridas enteras del ciclo 2 (487,5 s y 521,9 s, seguidas sobre la misma base) dieron
249 pasan, 1 falla y 8 saltadas las dos veces. De los siete fallos de los ciclos 0 y 1, seis
siguieron corregidos; `23-movimiento` no: falló en las dos (F-09). Además, QA vio que `13-etapas` fallaba
siempre con la traza puesta (F-10). Las dos se corrigieron en el ciclo 3. La corrida entera de
comprobación de ese ciclo (467,1 s, sin traza) dio 250 pasan, ninguna falla y 8 saltadas, y
las dos de QA (495,4 s y 477,5 s), lo mismo. QA encontró en ese ciclo dos huecos que no se veían
en rojo: `13-etapas` perdonaba por la URL sin mirar el estado (F-12), y `09-avance` gastaba una
etapa de una persona sembrada en cada corrida (F-13). Los dos se corrigieron en el ciclo 4. La
corrida entera de QA del ciclo 5 dejó en rojo una prueba que no venía de este trabajo sino de
main (#58): `37-buscar-vacantes` AC-01 (F-16). Se corrigió en el ciclo 6, junto con sus vecinas
del mismo hueco. La del ciclo 7 dejó en rojo otra que tampoco era de este trabajo, sino de
upstream (#25): `16-cuestionario-tecnico` paso 3 (F-18). Ese fallo dependía del tiempo, como
otros antes: las corridas enteras habían destapado F-05 y F-09 en `23-movimiento` (ciclos 0 y
2) y F-16 en `37-buscar-vacantes` (ciclo 5), y el prefijo de diagnóstico con traza del ciclo 2,
F-10 en `13-etapas`. Todos tenían la misma forma: el resultado dependía de qué llegaba antes, la
prueba o lo que acababa de disparar. En el ciclo 8 se corrigió y
se barrió ese hueco por los 46 archivos y sus ayudas (ver «El barrido del ciclo 8», debajo de
la tabla):

| Archivo | Qué pasaba | Qué se hizo |
|---|---|---|
| `01-regresion-panel` | esperaba el buscador vacío al cambiar de pestaña; desde #55 la búsqueda vive en el padre y se conserva a propósito | afirma el comportamiento real: el orden se reinicia, la búsqueda y el corte siguen |
| `07-movil` «la tabla no desborda» | con la intercepción del escenario en el `beforeEach`, medía antes de que existiera la tabla (fallo introducido por este trabajo) | espera la primera fila antes de medir |
| `14-vacante` tramos 7 y 8 | `abrirLaVacante` exigía la configuración abierta, que en una vacante publicada está plegada tras la tuerca; además `check()` sobre una casilla que manda el servidor y un segundo «Cerrar vacante» que plegaba el formulario en vez de confirmar. Cada corrida dejaba una vacante publicada en el portal | el helper pulsa la tuerca si hace falta; la casilla se pulsa y se espera al servidor; se confirma con «Confirmar cierre». Los ocho tramos pasan y la vacante queda cerrada |
| `18-ranking-contra-api` «cada guion dice por qué» | buscaba las frases largas en el texto de la tabla; desde #32 la celda pinta dos palabras y la frase va en `title` | lee celda y `title`, y exige que casen |
| `23-movimiento` «al volver a la portada» | inestable en la corrida entera: observador instalado después de navegar. Arreglado eso, siguió fallando en las dos corridas del ciclo 2 (F-09): volvía atrás en cuanto cambiaba la URL, antes de que la ficha se montara, y con la máquina cargada la portada no llegaba a irse, así que no había vuelta que animar | observador con `addInitScript` que muestrea al entrar la franja al DOM (ciclo 1). En el ciclo 3 espera a la ficha pintada antes de volver y a la portada montada antes de leer. Se reprodujo y se comprobó frenando la CPU x4 y x8 (sección de `23`) |
| `13-etapas` «la misma ficha en Prueba del puesto» (ciclo 3) | la ficha pide siempre `/prueba/entregables` y `/prueba/respuestas`, y a quien no tiene intento el backend le contesta 404, que la ficha traduce en «no rindió» (F-10). El vigilante toleraba `/prueba/notas` pero no esas dos: sin traza la prueba acababa antes de que llegaran y pasaba; con la traza fallaba 10 de 10 | las dos van a los 404 esperados, y la prueba espera a que los dos bloques contesten. Sin los patrones nuevos falla 3 de 3; con ellos, el archivo pasa 30 de 30 con traza y 30 de 30 sin ella. El perdón seguía sin mirar el estado: ver F-12 |
| `13-etapas`, el vigilante de la ficha (F-12, ciclo 4) | los patrones de los 404 esperados se comparaban con la URL sin mirar el estado, así que cualquier error de esas rutas pasaba: un 500 en `/prueba/entregables` o en `/prueba/respuestas` dejaba la prueba en verde con la ficha diciendo «El sistema tuvo un problema». Y `/prueba/notas` ni se esperaba: un 500 ahí se cazaba o no según lo que tardara la prueba. El mismo agujero estaba en `08-teclado-y-consola` «recorrer el ranking»: perdonaba por el texto «Failed to load resource», que la consola escribe igual para un 404 que para un 500. `ayuda-prueba` y `ayuda-tecnica` ya perdonaban solo el 404 | en `13` se perdona la ruta con su estado, solo el 404, y la prueba espera a los tres bloques —notas, entregado y escrito—. En `08` la consola solo descarta ese eco y juzga la respuesta: el 404 de `/ficha` y de las versiones de plantilla pasa, cualquier otro error falla. Comprobado con mutaciones temporales: un 500 en `/prueba/entregables`, `/prueba/respuestas` o `/prueba/notas` hace fallar `13` 3 de 3 cada uno, y un 500 en la ficha de la vacante hace fallar `08` 3 de 3. Con el 404 real, `13` pasa 30 de 30 con traza y 30 de 30 sin ella |
| `09-avance` (F-13, ciclo 4) | movía a Diego Salazar Núñez, la postulación sembrada de «Líder de operaciones», una etapa por corrida. Las transiciones son inmutables y el recorrido acaba en CONTRATADO, así que le quedaban tres corridas; y la prueba aceptaba «No avanzaron», de modo que ni se habría notado al gastarlo | siembra su propia vacante, con una persona en PERFIL_POR_CONFIRMAR, la avanza desde el panel y la retira al terminar (cuenta retirada y vacante marcada eliminada, como `ayuda-filtros-y-seleccion`). Ahora exige «Avanzaron», el estado PRUEBA_TURNO_CANDIDATO con su transición en la base y el cambio en pantalla: sale de «Pendiente» del perfil y aparece en «Le toca al candidato» de la prueba. Pasó tres veces seguidas sobre la misma base |
| `06-sin-ciudad` «MEZCLA» (ciclo 2) | afirmaba la lista exacta de «Analista de experiencia del cliente». Cada corrida de `22` deja ahí una postulación de «Prueba De Archivos» que no se puede borrar, así que fallaba desde la segunda corrida | afirma sobre sus tres personas sembradas: el orden entre ellas, la fila sin ciudad la última de toda la tabla y el desplegable contra las ciudades reales de la vacante |
| `25-editar-vacante` «la tabla no se mueve» (ciclo 2) | comparaba `boundingBox()`, que mide contra la ventana. Las vacantes que dejan las corridas empujan «Desarrollador web» bajo el pliegue, el clic en el lápiz desplaza la página y la medida cambia sin que la tabla se mueva | trae la fila a la vista y compara su posición en el documento (caja más desplazamiento) antes y después de abrir el modal |
| `22-perfil-con-foto-y-cv`, las dos que postulan (ciclo 2) | apareció al revisar quién deja postulaciones: el texto que se esperaba ya está en el formulario, y la primera postulación nunca llegaba a crearse porque la vacante pedía la pretensión | escribe la pretensión si la vacante la pide y exige «Mis procesos» y la postulación en el backend |
| `37-buscar-vacantes` AC-01 y cuatro vecinas (F-16, ciclo 6) | venía de upstream (#58) y fallaba igual sobre `af9214d`. Tras pulsar «Relevantes» leía la lista esperando solo a la dirección, que React Router escribe antes de pintar, y a veces leía el orden anterior. La corrida entera del ciclo 5 la dejó en rojo | antes de leer, espera al radio del orden marcado; en «Ver las N vacantes», a las nueve tarjetas. Lo mismo en AC-09, AC-15, «sin texto, «Relevantes» cuenta el sueldo…» y «Ver las N vacantes». Lo que afirman no cambia. Comprobado frenando la CPU x4 y x6; el detalle está en la sección de `37` |
| `16-cuestionario-tecnico` paso 3 (F-18, ciclo 8) | venía de upstream (#25). Mientras guarda, el botón pasa a «Guardando…», así que esperar a que no hubiera ningún «Guardar» no esperaba al servidor, y la recarga abortaba el POST de `/instrumento-tecnico`: la vacante quedaba con los minutos vacíos. La corrida entera del ciclo 7 la dejó en rojo, y los pasos 4 a 13 sin correr | registra la respuesta del POST antes del clic, exige que sea correcta y solo entonces recarga; después espera a que no quede ni «Guardar» ni «Guardando…». Lo que afirma no cambia. Con el POST frenado 1,5 s, la versión anterior falla 5 de 5 y la corregida pasa 5 de 5 |
| `14-vacante` «se eligen la prueba del puesto y los pesos» (ciclo 8) | la vacante nace ya con los pesos que la prueba elige, así que el desplegable tenía ese valor antes de que el servidor contestara y la prueba terminaba con el POST de `/version-pesos` en vuelo: «el servidor los deja puestos» se daba por bueno sin respuesta | espera la respuesta del POST y exige que sea correcta. Con las escrituras frenadas 1,5 s, la versión anterior acaba con el POST en vuelo y la corregida pasa el archivo 2 de 2. La prueba del puesto ya esperaba bien —el desplegable nace vacío y solo cambia con la respuesta— y no se tocó |
| `15-componer-prueba`, traer del catálogo (ciclo 8) | el catálogo de preguntas llega aparte y el desplegable no se apaga mientras tanto; la ayuda leía sus opciones sin esperar y, con la red lenta, solo encontraba «Elige una pregunta…» y decía que el catálogo se había quedado sin preguntas | antes de leer, espera a que haya alguna opción del tipo pedido. Con toda la API a 700 ms, la versión anterior falla y deja siete tramos sin correr; la corregida pasa el archivo 2 de 2 |
| `24-ciudad-obligatoria` «con el botón…» y «solo con el teclado» (ciclo 8) | el desplegable de ciudad está apagado mientras llega la lista, y un campo apagado no recibe el foco: la primera enviaba el formulario antes y la segunda lo enfocaba antes, y con la red lenta el foco no llegaba | esperan a que el desplegable esté encendido antes de enviar y de enfocar. No va dentro de la ayuda común porque la prueba del catálogo caído la usa con el desplegable apagado. Con toda la API a 700 ms, 6 de 6 en rojo antes y 10 de 10 en verde después |
| `37-buscar-vacantes` «Ciclo 2 · en escritorio…» (ciclo 8) | medía cada pieza en la página sumando la caja y `scrollY`, leídos por separado. Marcar una casilla cambia la dirección y la página sube con un desplazamiento suave, así que las dos lecturas caían en momentos distintos: el barrido la vio mover 3 px la columna de filtros | lee caja y desplazamiento en una sola lectura. Con la página bajada 150 px antes de marcar, la versión anterior falla 3 de 5 y la corregida pasa 5 de 5 |

**El barrido del ciclo 8.** Se leyeron los 46 archivos y sus ayudas buscando tres formas del
mismo hueco: una acción que escribe seguida de recargar, navegar o consultar la base sin esperar
la respuesta; una espera a que desaparezca un botón o un texto que cambia durante la operación;
y una lectura que no reintenta (`allTextContents`, `textContent`, `count`, `boundingBox`,
`evaluate`) justo después de un clic o una navegación. Para no quedarse en la lectura, se
corrieron los 46 archivos en copias temporales con tres frenos: las escrituras de la API
retrasadas 1,5 s vigilando las que se abortan o siguen en vuelo al terminar la prueba, la CPU
frenada x4 por CDP, y toda la API retrasada 700 ms. De ahí salieron los cinco casos de la tabla
(el de `16` es F-18), y se corrigieron y se comprobaron uno a uno como dice su fila. Con la CPU
x4 no falló ninguna. Se revisó y no se tocó:

- `26-editar-vacante-avisos` «el aviso lleva al proceso del candidato…» termina con el POST que
  marca el aviso como leído todavía en vuelo. Lo dispara la pantalla al abrir el aviso, la
  prueba no afirma nada sobre él y es la última del archivo.
- `37` «a 768 px los filtros se apilan…» también mide en la ventana después de marcar, pero sus
  comparaciones aguantan el desplazamiento: con la página bajada 400 px pasa 5 de 5.
- Las demás esperas ya iban detrás de un estado que solo existe tras la respuesta o que sale del
  mismo render que lo que se lee: el aviso de «Cambios guardados», «Guardado.», el cambio de
  pantalla tras enviar, la cifra o la marca que pinta el servidor, el radio o la cuenta de
  filas. En el panel, los cortes, los filtros y el orden del ranking se aplican en el propio
  navegador y se pintan en el mismo clic. La ayuda `guardar` del portal ya esperaba a que no
  quedara «Guardar» ni «Guardando…». Los pasos de IA real de `16` (6 a 12) no pueden correr sin
  la clave y no se tocaron.

**La regla de volver a correr sobre la misma base.** Una postulación hecha desde el portal nace
con su transición, que la base no deja borrar. Una vacante con historial tampoco se borra: la
que la prueba no marca eliminada —la cerrada de `14`, los borradores de `16` y `17`— se queda
en el panel. Así que una prueba que escribe no puede prometer que deja la base como estaba, y una
prueba que lee no puede dar por hecho que la base es la de la siembra. Las listas exactas y las
posiciones en pantalla se afirman sobre el escenario de la propia prueba (sus personas, sus
vacantes), nunca sobre todo lo que haya en una vacante o en un listado compartido. Las medidas
de posición se toman en coordenadas del documento. Se comprueba corriendo dos veces seguidas
sobre la misma base: `22` + `06` y `25-editar-vacante` pasan las dos veces, y `09` tres.

Las vacantes publicadas que dejaron las corridas rotas de `14` en el clon del harness se
cerraron por la misma vía que usa la prueba (el cierre del panel).

## Las corridas enteras que cita este documento

Es una lista cerrada de la evidencia, no la cuenta de todas las corridas: cada revisión de QA
vuelve a correr la suite, y las corridas posteriores no se añaden aquí. Son corridas completas
de `npx playwright test`, todas del 25/09/2026,
headless, con un worker y en el clon del harness. La hora es la de inicio (Lima, UTC−5), y el
artefacto está en `e2e/`, dentro de los artefactos del harness del trabajo. **La cifra vigente
—cuántas pasan, cuántas fallan y cuánto tarda— es la de la corrida de QA que el harness registra
para la versión aprobada**, no la de esta tabla. El tiempo cambia con la carga de la máquina;
antes eran ~12 minutos para las 329 (tabla «En números»).

| Ciclo | Quién y cuándo | Pruebas | Pasan | Fallan | Saltadas | Tiempo | Artefacto |
|---|---|---|---|---|---|---|---|
| 0 | QA, 11:53 | 258 | 244 | 5: `01`, `07-movil`, `14`, `18`, `23-movimiento` | 8, y 1 que no llegó a correr: el último tramo de `14` («se cierra…»), en `serial` detrás del que falló | 589,6 s | `ciclo0-suite-completa.log` |
| 1 | QA, 14:25 | 258 | 248 | 2: `06-sin-ciudad`, `25-editar-vacante` | 8 | 483,8 s | `ciclo1-suite-completa.log` |
| 2 | QA, 15:14 | 258 | 249 | 1: `23-movimiento` (F-09) | 8 | 487,5 s | `ciclo2-suite-completa.log` |
| 2 | QA, 15:22, seguida de la anterior | 258 | 249 | 1: `23-movimiento` (F-09) | 8 | 521,9 s | `ciclo2-segunda-suite-completa.log` |
| 3 | implementación, comprobación sin traza | 258 | 250 | 0 | 8 | 467,1 s | del implementador; no está entre los artefactos de QA |
| 3 | QA, 16:53 | 258 | 250 | 0 | 8 | 495,4 s | `ciclo3-suite-completa.log` |
| 3 | QA, 17:02, seguida de la anterior | 258 | 250 | 0 | 8 | 477,5 s | `ciclo3-segunda-suite-completa.log` |
| 4 | implementación, confirmación antes de integrar #58 | 258 | 250 | 0 | 8 | 481,8 s | del implementador; no está entre los artefactos de QA |
| 4 | QA, 19:48, con #58 integrado | 302 | 294 | 0 | 8 | 594,2 s | `ciclo4-suite-completa.log` |
| 4 | QA, 19:58, seguida de la anterior | 302 | 294 | 0 | 8 | 587,9 s | `ciclo4-segunda-suite-completa.log` |
| 5 | QA, 22:00 | 302 | 293 | 1: `37-buscar-vacantes` AC-01 (F-16) | 8 | 596,0 s | `ciclo5-suite-completa.log` |
| 6 | QA, 22:57, con la corrección de F-16 | 302 | 294 | 0 | 8 | 593,8 s | `ciclo6-suite-completa.log` |
| 6 | QA, 23:06, seguida de la anterior | 302 | 294 | 0 | 8 | 632,4 s | `ciclo6-segunda-suite-completa.log` |
| 7 | QA, 23:48 | 302 | 290 | 1: `16-cuestionario-tecnico` paso 3 (F-18) | 1, la de IA real de `17`, y 10 que no llegaron a correr: los pasos 4 a 13 de `16`, en `serial` detrás del que falló (siete de ellos, los de IA real) | 611,7 s | `ciclo7-suite-completa.log` |

Las 8 saltadas son las de IA real (`16` y `17`) en todas menos en la del ciclo 7, donde siete de
ellas no llegaron a correr por el fallo anterior en `serial`, como dice su fila. La del ciclo 7
es la última que recoge la lista.

## Cómo se corre lo que queda

Sin cambios en el montaje: las seis variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md),
el contenedor etiquetado y `npx playwright test` (headless, un worker). Los dos proyectos
siguen: `escritorio` corre todo menos `*movil.spec.ts`, y `movil` solo esos.

```bash
npx playwright test                              # las 309 (302 + las 7 del 40): 301 corren y las 8 de IA real se saltan
npx playwright test --project=escritorio         # 288, sin las 21 de móvil
E2E_IA_REAL=1 npx playwright test 16- 17-        # las 8 de IA, a mano, con los pasos de 16 y 17 que las preparan (19)
npx vite-node herramientas/e2e/sembrar-escenario-desarrollador-web.ts \
  && E2E_ESCENARIO=base npx playwright test 03-orden 04-filtros 05-excel 07-movil 08-teclado   # repetir la medición de AC-10; deja la base escrita
```
