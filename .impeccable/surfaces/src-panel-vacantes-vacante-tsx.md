---
version: 1
slug: "src-panel-vacantes-vacante-tsx"
primary_target: "src/panel/vacantes/Vacante.tsx"
related_targets:
  - "src/panel/vacantes/Vacante.module.css"
  - "src/panel/vacantes/CierreDePrueba.tsx"
  - "src/panel/vacantes/CalificarConIa.module.css"
---

# Ficha de vacante · panel del equipo

Modo **Operate**. El equipo de Talento vuelve a esta pantalla para revisar candidatos y su avance por las cinco etapas.

Dirección aprobada: conservar la identidad EX y priorizar el seguimiento en vacantes publicadas. Cabecera compacta con estado; configuración desplegable cerca de la cabecera, abierta inicialmente en borradores; resumen de avance; ranking con herramientas agrupadas. La configuración reúne banco, instrumento técnico con prueba y duración, pesos, plazos y requisitos.

Cerrar una vacante requiere abrir un formulario independiente con motivo visible, confirmación y cancelación. Los filtros, cifras, permisos, calificaciones y reglas del proceso conservan su significado. Plegar ajustes no desmonta sus formularios ni pierde texto pendiente.

Las pestañas se recorren con flechas, Inicio y Fin. Cada candidato tiene un botón accesible para abrir su detalle. Búsqueda, filtros, columnas y exportación comparten barra. Los criterios adicionales se eligen dentro de Columnas.

En móvil se apilan campos y grupos; la tabla conserva su desplazamiento horizontal interno. El color violeta sigue reservado a las acciones. No se inventa una fecha vigente que el backend no expone.

Verificación inicial: 137 pruebas de vacante, calificación y plazos aprobadas; build de producción aprobado; detector sin alertas. Revisión visual a 1280 y 390 px, sin desbordamiento horizontal de la página. La vista local usa fixtures y no acredita la integración con producción.
