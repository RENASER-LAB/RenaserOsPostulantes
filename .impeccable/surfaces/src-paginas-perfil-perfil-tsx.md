---
version: 1
slug: "src-paginas-perfil-perfil-tsx"
primary_target: "src/paginas/perfil/Perfil.tsx"
related_targets: []
---

# «Mi perfil» · portal del candidato

**Alcance y modo.** La ruta `/perfil` del portal. Modo **Operate** con apertura de
identidad: el visitante completa una tarea —revisar y corregir lo que la IA sacó
de su currículum— pero lo primero que ve tiene que ser él.

**Audiencia.** Quien busca trabajo, sin segmentar, de operativo a directivo.
Entra por el teléfono tanto como por el ordenador. La mayoría de las visitas no
tienen nada que hacer; una, la de después de subir el CV, trae veinte datos por
revisar de golpe.

**Trabajo.** Reconocerse, y decir si lo que dedujo la máquina está bien.

**Contenido y prueba.** Lo que la persona escribió y lo que salió de su
currículum, cada cosa con su procedencia. Todo lo importante lleva fecha:
empleos, estudios y certificaciones.

**Restricciones.** Nada del perfil es obligatorio y nada bloquea postular
(RF-156). El perfil no puntúa (RF-164). La foto, la portada, el currículum y los
diplomas no llegan al panel. La distinción «sin confirmar» tiene que leerse sin
color — es la línea roja que fijó el usuario el 06/09/2026.

**Dirección elegida (06/09/2026).** *La columna de tiempo*: empleos, estudios y
certificaciones dejan de ser tres listas y pasan a colgar de **una sola
cronología**. La estructura ordena por fecha, así que el orden deja de ser un
trabajo de la persona.

**Momento memorable.** Los huecos entre empleos, dichos en voz alta y colocados
donde están.

**Sin decidir.** Qué hacer con `orden` en el backend cuando la pantalla deja de
exponer las flechas. La ficha del perfil en el panel, que sigue sin construirse.
