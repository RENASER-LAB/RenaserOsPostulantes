---
target: «Mi perfil» del portal del candidato
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-09-06T03-54-29Z
slug: src-paginas-perfil-perfil-tsx
---
**Method: dual-agent** (A: revisión de diseño · B: detector + evidencia de navegador, aisladas)

## Salud de diseño — 26/40 · Aceptable, con trabajo pendiente

| # | Heurística | Nota | Hallazgo |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Tres estados de lectura bien distinguidos; quitar una fila es mudo |
| 2 | Sistema y mundo real | 3 | «Experiencia, en meses» obliga a calcular; «aquí al lado» señala abajo en móvil |
| 3 | Control y libertad | 1 | Los menús no cierran con Escape ni clic fuera; ocho acciones destructivas sin deshacer |
| 4 | Consistencia y estándares | 2 | «Editar perfil» y «Editar lo tuyo» abren lo mismo; dos enlaces a /privacidad |
| 5 | Prevención de errores | 2 | Impecable en la entrada, cero guardas en el borrado |
| 6 | Reconocer antes que recordar | 3 | Las cinco portadas solo se distinguen por color |
| 7 | Flexibilidad y eficiencia | 3 | Reordenar sigue siendo solo flechas |
| 8 | Estética y minimalismo | 3 | El tercio final apila dos pies |
| 9 | Diagnóstico y recuperación | 3 | Los errores de la foto salen lejos de la foto |
| 10 | Ayuda y documentación | 3 | Nadie dice quién ve el resto del perfil |

## Veredicto de especificidad: authored, con un injerto sin asimilar

La maquinaria PERSONA/CURRICULUM, el idioma propio y las portadas derivadas de --canto-* no las puede
usar otro portal. El injerto es el medidor de completitud, copiado de LinkedIn, y es donde falla.

Detector estático: 0 hallazgos (exit 0), validado con pasada de control sobre src/ entero.
Superposición en vivo: 8 en /perfil (7 contraste + 1 espaciado), 2 en /postular.
`cramped-padding` de /postular es falso positivo verificado: mide padding declarado (0) e ignora
los 12px de aire real del centrado flex en una caja de 48px.

## Problemas prioritarios

### [P0] El medidor dice 100 % en verde sobre seis datos que nadie ha confirmado
Verificado contra datos reales: medidor = 100 %, panel = «Te quedan 6 datos por revisar».
`partes()` cuenta presencia; `cuantosSinConfirmar()` cuenta confirmación. `--bien` significa
«lo confirmado» en todo el sistema.
Arreglo: que `partes()` exija `hecho && !sinConfirmar` en las cuatro listas con origen.
Comando: /impeccable clarify

### [P1] Nueve textos por debajo del contraste mínimo
`--tinta3` (#68727f) da 4,40:1 en las seis fechas y en los botones ↑↓, y 4,31:1 en el peso del CV.
Mínimo 4,5:1. Las etiquetas en mayúsculas pasan por los pelos (4,59:1).
Arreglo: oscurecer el token, o pasar esos textos a --tinta2 sobre fondo teñido.
Comando: /impeccable audit

### [P1] Los dos menús flotantes no se cierran, y pueden quedar los dos abiertos
Cero Escape, cero pointerdown, cero aria-haspopup/aria-controls, y dos booleanos independientes.
Arreglo: un solo estado 'foto' | 'portada' | null, más Escape y pointerdown fuera devolviendo foco.
Comando: /impeccable harden

### [P1] Ocho acciones destructivas sin pregunta, sin aviso y sin deshacer
`baja` lleva onSuccess: refrescar y ningún avisar(). «Quitarlo» (diploma) y «Quitar» (certificación
entera) conviven a ~40px. El «Quitarlo» del currículum mide 72x20px.
Arreglo: avisar() con el nombre de lo borrado y un «Deshacer»; renombrar a «Quitar el diploma».
Comando: /impeccable harden

### [P2] La portada sube el EXIF que la foto sí descarta
`cuadrarAlCentro()` pasa la foto por canvas y su comentario dice que es para tirar el EXIF;
`subirPortada(accion.archivo)` manda el File original sin tocarlo.
Arreglo: mismo canvas con proporción de banda (1600x400, cover, JPEG 0.85).
Comando: /impeccable harden

## Banderas rojas por persona
- Sin currículum y sin nombre: disco de color vacío de 128px; un «0» a 34px como elemento más grande;
  «súbelo aquí al lado» cuando en móvil está debajo.
- Teléfono: «Editar perfil» se cuela entre el nombre y el titular al envolver; la cámara tapa las
  iniciales; tocar fuera no cierra los menús; la portada sube cruda hasta 2 MB.
- Teclado / lector: menús sin Escape ni gestión de foco; «Quitar» destruye el foco en silencio;
  las flechas reordenan sin anunciarlo.

## Observaciones menores
- La cabecera de Perfil.tsx dice que el currículum no se sube desde ahí y que no existe ruta. Falso.
- Las seis capturas de comprobación están dos revisiones atrás (13:20 vs CSS de 13:32 y 13:36).
- El punto verde de «Inmediata» usa --bien, que significa «lo confirmado».
- document.querySelector('[aria-invalid]') busca en todo el documento, no en su form.
- CSS huérfano: .tituloYSalida, .encabezado, .bajada, .secciones.
- Parpadeo en Postular mientras la consulta del perfil está pendiente.
- «Así te ven» y arrastrar para reordenar no llegaron y no están en la tabla de decisiones.

## Preguntas
1. Si el medidor puede decir 100 % con seis datos sin revisar, ¿qué mide? Y si el perfil no puntúa
   (RF-164), ¿por qué el número más grande de la pantalla es un porcentaje?
2. La foto solo la ve el candidato: ¿no debería decirse donde se sube, no dentro de un menú?
3. ¿Qué se rompe si «Quitar» empieza a poder deshacerse?
4. Las cinco portadas se distinguen solo por color, en un sistema cuya primera regla es la forma.
