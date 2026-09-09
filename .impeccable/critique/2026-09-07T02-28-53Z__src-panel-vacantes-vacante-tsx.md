---
target: Ficha de cada vacante del panel administrativo
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-07T02-28-53Z
slug: src-panel-vacantes-vacante-tsx
---
Method: dual-agent (A: /root/vacante_diseno · B: /root/vacante_evidencia)

La mejora principal es que una vacante publicada abra en el seguimiento de candidatos, con la configuración disponible sin ocupar la entrada.

| Criterio | /4 | Hallazgo principal |
|---|---:|---|
| Estado del sistema | 3 | Estados claros; algunos guardados tienen poca señal local. |
| Lenguaje | 3 | Comprensible, con algunas explicaciones demasiado técnicas. |
| Control del usuario | 2 | El formulario de cierre está siempre expuesto. |
| Consistencia | 3 | Identidad coherente; distintas formas de guardar ajustes. |
| Prevención de errores | 2 | Buenas restricciones de publicación; cierre poco separado. |
| Reconocimiento | 3 | Conteos útiles; ajustes relacionados quedan dispersos. |
| Eficiencia | 3 | Buenas herramientas, pero se llega tarde al ranking. |
| Jerarquía y sencillez | 2 | Configuración y plazos dominan la entrada. |
| Recuperación | 2 | Hay mensajes, pero algunas salidas dependen de recargar. |
| Ayuda | 3 | Explica consecuencias reales; necesita mejor distribución. |
| Total | 26/40 | Aceptable; necesita ordenar prioridades. |

La identidad de EX funciona: tipografía, colores suaves y etapas propias del proceso. También funcionan los conteos de candidatos, los filtros y la identificación de notas provisionales. La composición debe responder mejor al estado de la vacante.

- **P1 · Acercar el ranking.** En la vista de escritorio revisada, la primera tabla empieza aproximadamente a 2.380 px del inicio. Propuesta: cabecera compacta, resumen de avance y ranking; configuración desplegable, abierta inicialmente cuando la vacante esté en borrador. Fuente: src/panel/vacantes/Vacante.tsx, ConfiguracionDeLaVacante antes del embudo y ranking. Comandos: layout/distill.
- **P1 · Corregir accesos por teclado y etiquetas.** Tres campos sin etiqueta asociada: motivo del cierre, motivo del avance y nuevo requisito. Los nombres de candidatos abren la ficha al pulsarlos, pero no aparecen como enlaces o botones enfocables. Las pestañas necesitan completar su comportamiento accesible y asociación a paneles. Fuente: Vacante.tsx, cabecera, ranking y requisitos. Comando: harden.
- **P2 · Separar el cierre de la vacante.** Dejar una acción secundaria que abra su formulario con motivo visible y cancelación, en vez de mostrar permanentemente el campo junto al título. Fuente: Vacante.tsx, cabecera; Vacante.module.css, cierre. Comandos: layout/harden.
- **P2 · Agrupar la configuración por significado.** Banco de evaluación, prueba técnica —instrumento, prueba y duración juntos—, pesos y plazos. La opción del selector técnico hoy se corta y los controles relacionados saltan entre columnas. El formulario del plazo consume mucho alto con una columna estrecha y espacio lateral libre. Fuente: Vacante.module.css, configuracion; Vacante.tsx, ConfiguracionDeLaVacante y CierreDeLaVacante. Comandos: layout/distill.
- **P2 · Ordenar las herramientas del ranking.** Mantener las etapas visibles; reunir búsqueda, filtros, columnas y Excel en una barra consistente, con la criba y su progreso claramente separados. Fuente: Vacante.tsx, Ranking, filaResumen y controlesDeColumnas. Comandos: layout/distill.

Para Alex, usuario frecuente, el problema es recorrer configuración y plazos cada vez que vuelve a revisar candidatos. Para Sam, que navega con teclado, faltan accesos esenciales a las fichas y etiquetas persistentes. Para el coordinador nuevo, configurar, evaluar y cerrar requieren una separación más clara.

La carga cognitiva viene de mezclar tareas abiertas: seis ajustes, plazos, cierre y herramientas antes de la tabla. Las cinco etapas son necesarias por el dominio y deben mantenerse visibles. El recorrido empieza con calma visual, atraviesa explicaciones extensas y tarda en llegar a las decisiones.

Observaciones menores: conservar explicaciones de consecuencias y límites reales; distribuir la ayuda extensa mediante revelado progresivo. No sustituir datos desconocidos por afirmaciones de éxito.

El detector automático encontró 0 alertas en el componente (exit 0, JSON []). La inspección visual y accesible sí encontró los problemas anteriores. No hubo falsos positivos del detector. Sin overlay: la API del navegador solo admite evaluate de lectura; se usaron capturas nativas, árbol accesible y DOM de lectura.

Revisión con fixtures en escritorio 1280×720. Los totales inconsistentes del embudo, códigos de estado, fallo al cargar cuestionario y error de detalle del candidato dependen potencialmente de la cobertura de fixtures; no se afirman como fallos de producción. Móvil pendiente de la propuesta implementada.

Pregunta para decidir la propuesta: ¿Aplicamos esta organización y después comparamos la cabecera y la barra del ranking en Live?
