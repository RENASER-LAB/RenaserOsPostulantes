/**
 * El mundo inventado de las capturas de promocion.
 *
 * ⚠️ **Nada de aqui sale de una base de datos, y nada de aqui llega a ninguna.**
 * Son datos escritos a mano para que las pantallas se vean como se ven cuando
 * el producto esta en uso. `capturar-promocion.mjs` los sirve interceptando las
 * respuestas del navegador, asi que ningun backend —ni el de produccion, ni una
 * copia local— llega a tocarse.
 *
 * La regla que ordena este archivo: **es UNA historia**. La misma persona
 * —Lucia Mendoza Rios— con la misma trayectoria en todas las pantallas del
 * candidato, postulando a la misma vacante que el equipo mira desde el panel.
 * Un juego de datos donde cada pantalla inventa su propio nombre se lee como
 * una demo hecha a trozos.
 *
 * ⚠️ **Las fechas se calculan desde hoy, nunca literales.** El portal deriva
 * texto de ellas —«hace 4 años», «vence en 3 días», la pildora «Vencida»— asi
 * que una fecha escrita a mano envejece y la captura acaba diciendo algo raro.
 */

// ---------------------------------------------------------------- el calendario

const DIA = 86_400_000
const AHORA = Date.now()

/** Un instante ISO, desplazado n dias desde ahora. Negativo es pasado. */
export const enDias = (n) => new Date(AHORA + n * DIA).toISOString()

/**
 * El mismo desplazamiento, pero a una hora en punto.
 *
 * ⚠️ **`enDias` arrastra los minutos de ahora mismo**, y una sesion convocada a
 * las 13:01 se lee como lo que es: una fecha que calculo un script. Las que
 * alguien convoca son a las nueve y a las tres.
 */
export const enDiasALaHora = (n, hora) => {
  const d = new Date(AHORA + n * DIA)
  d.setHours(hora, 0, 0, 0)
  return d.toISOString()
}
/** Un instante ISO, desplazado n minutos desde ahora. */
export const enMinutos = (n) => new Date(AHORA + n * 60_000).toISOString()

/**
 * Una fecha `YYYY-MM-DD` a n meses de hoy, con el dia puesto a 1.
 *
 * Se arma con `getFullYear/getMonth`, no con `toISOString()`: en Lima esa
 * conversion adelanta el dia desde las siete de la tarde, y es la trampa que el
 * portal ya pago una vez con las certificaciones vencidas.
 */
export const haceMeses = (n) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ---------------------------------------------------------------- quien es ella

export const CANDIDATA = {
  nombre: 'Lucía',
  apellidos: 'Mendoza Ríos',
  correo: 'lucia.mendoza@ejemplo.pe',
}

export const SESION = { usuarioId: 1, ...CANDIDATA }

/** El proceso que se sigue de punta a punta en las capturas. */
export const UUID = '7c1f2a90-4d6b-4f18-9a2e-5b83e1c0d742'

// ---------------------------------------------------------------- las vacantes

const REQUISITOS_ANALISTA = [
  { id: 1, descripcion: 'Tengo disponibilidad para trabajar de forma híbrida en Lima.' },
  { id: 2, descripcion: 'Tengo experiencia demostrable con SQL.' },
  { id: 3, descripcion: 'Tengo estudios técnicos o universitarios concluidos.' },
]

export const VACANTE = {
  id: 1,
  titulo: 'Analista de Datos',
  nombreEmpresa: 'Clínica San Juan',
  descripcion: null,
  proposito:
    'Que los reportes semanales salgan solos y sean confiables, y que el área comercial '
    + 'deje de pedir números por chat cada lunes por la mañana.',
  responsabilidades:
    'Ordenar la información que hoy vive en hojas sueltas\n'
    + 'Armar los reportes que el área comercial usa cada semana\n'
    + 'Dejar documentado cómo se calcula cada número, para que no haya que preguntarlo\n'
    + 'Acompañar a las áreas cuando quieran una cifra nueva',
  requisitos:
    'Experiencia con SQL y con hojas de cálculo a fondo\n'
    + 'Saber explicarle un número a quien no es técnico\n'
    + 'Haber ordenado algo que antes se hacía a mano',
  modalidad: 'Híbrido',
  horario: 'Lunes a viernes, de 9 a 18',
  ubicacion: 'Lima',
  compensacionPublica: 'S/ 3 800 – S/ 4 500',
  requisitosObjetivos: REQUISITOS_ANALISTA,
}

/** El tablon. Varias empresas a proposito: el portal mezcla, y eso se enseña. */
export const VACANTES = [
  VACANTE,
  {
    id: 2,
    titulo: 'Coordinador/a de Operaciones',
    nombreEmpresa: 'Transportes del Sur',
    descripcion:
      'Llevar la operación del día a día: proveedores, rutas, caja chica y el control '
      + 'de que lo comprometido se cumpla.',
    proposito: null, responsabilidades: null, requisitos: null,
    modalidad: 'Presencial', horario: 'Lunes a sábado', ubicacion: 'Arequipa',
    compensacionPublica: 'A convenir', requisitosObjetivos: [],
  },
  {
    id: 3,
    titulo: 'Especialista en Mejora Continua',
    nombreEmpresa: 'Molinos del Norte',
    descripcion: null,
    proposito: 'Bajar el desperdicio de la línea de envasado sin parar la producción.',
    responsabilidades: null, requisitos: null,
    modalidad: 'Presencial', horario: null, ubicacion: 'Trujillo',
    compensacionPublica: null, requisitosObjetivos: [],
  },
  {
    id: 4,
    titulo: 'Analista de Planeamiento',
    nombreEmpresa: 'Andes Retail',
    descripcion: null,
    proposito: 'Que la reposición de tiendas deje de decidirse por corazonada.',
    responsabilidades: null, requisitos: null,
    modalidad: 'Remoto', horario: 'Flexible', ubicacion: 'Lima',
    compensacionPublica: 'S/ 4 000 – S/ 5 200', requisitosObjetivos: [],
  },
  {
    id: 5,
    titulo: 'Jefe/a de Servicio al Cliente',
    nombreEmpresa: 'Clínica San Juan',
    descripcion: null,
    proposito: 'Que una queja se resuelva en el primer contacto y quede aprendida.',
    responsabilidades: null, requisitos: null,
    modalidad: 'Presencial', horario: 'Turnos rotativos', ubicacion: 'Lima',
    compensacionPublica: null, requisitosObjetivos: [],
  },
]

export const CONSENTIMIENTO_DE_LA_VACANTE = {
  nombreEmpresa: 'Clínica San Juan',
  version: '1.2',
  texto:
    'Clínica San Juan tratará los datos que envíes en este formulario —tu currículum, tus '
    + 'respuestas y los resultados de las evaluaciones— con la única finalidad de evaluar tu '
    + 'candidatura a este puesto.\n\n'
    + 'Los datos se conservarán mientras dure el proceso y hasta doce meses después de su '
    + 'cierre, salvo que pidas su eliminación antes. Puedes ejercer tus derechos de acceso, '
    + 'rectificación, cancelación y oposición desde la sección de privacidad del portal.\n\n'
    + 'Parte de la evaluación se apoya en sistemas automatizados que analizan tus respuestas. '
    + 'Ninguna decisión final se toma de forma automática: siempre la revisa una persona.',
}

export const TEXTOS_DE_CONSENTIMIENTO = [
  {
    tipo: 'TRATAMIENTO_PROCESO', version: '1.2',
    texto:
      'Autorizo el tratamiento de mis datos personales para la evaluación de mi candidatura.\n\n'
      + 'Mi currículum y mis respuestas serán procesados con servicios de terceros ubicados '
      + 'fuera del país. Antes de salir, mi currículum se anonimiza: edad, sexo y estado civil '
      + 'quedan cubiertos.',
  },
  {
    tipo: 'FUTUROS_CONTACTOS', version: '1.0',
    texto:
      'Autorizo que Renaser me contacte para futuras convocatorias que encajen con mi perfil. '
      + 'Puedo retirar este permiso en cualquier momento desde el portal.',
  },
]

// ---------------------------------------------------------------- sus procesos

/**
 * Las cuatro postulaciones de Lucia.
 *
 * ⚠️ **Una esta cerrada a proposito.** La tarjeta de un proceso que no continua
 * lleva la marca tachada, y es parte de lo que el producto hace bien: decirlo
 * sin esconderlo. Una demo donde todo va bien enseña la mitad del sistema.
 */
export const PROCESOS = [
  {
    uuid: UUID, vacante: 'Analista de Datos', empresa: 'Clínica San Juan',
    estado: 'PRUEBA_TURNO_CANDIDATO', estadoNombre: 'Prueba habilitada',
    grupoPrioridad: 'PRIORIDAD_ALTA', diasSinCambio: 1, creadoEn: enDias(-24),
  },
  {
    uuid: 'b2c3d4e5-0002-4000-8000-000000000002',
    vacante: 'Analista de Planeamiento', empresa: 'Andes Retail',
    estado: 'PERFIL_CALIFICANDO', estadoNombre: 'Revisando tu currículum',
    grupoPrioridad: 'PRIORIDAD_MEDIA', diasSinCambio: 2, creadoEn: enDias(-6),
  },
  {
    uuid: 'c3d4e5f6-0003-4000-8000-000000000003',
    vacante: 'Especialista en Mejora Continua', empresa: 'Molinos del Norte',
    estado: 'SIMULACION_TURNO_CANDIDATO', estadoNombre: 'Elige tu fecha',
    grupoPrioridad: 'PRIORIDAD_ALTA', diasSinCambio: 3, creadoEn: enDias(-41),
  },
  {
    uuid: 'd4e5f6a7-0004-4000-8000-000000000004',
    vacante: 'Jefe/a de Servicio al Cliente', empresa: 'Clínica San Juan',
    estado: 'NO_CONTINUA', estadoNombre: 'No continúa',
    grupoPrioridad: null, diasSinCambio: 18, creadoEn: enDias(-77),
  },
]

/** El recorrido del proceso protagonista, leido del historial. */
export const DETALLE_DEL_PROCESO = {
  resumen: {
    uuid: UUID, vacante: 'Analista de Datos', empresa: 'Clínica San Juan',
    estado: 'PRUEBA_TURNO_CANDIDATO', estadoNombre: 'Prueba habilitada',
    grupoPrioridad: 'PRIORIDAD_ALTA', diasSinCambio: 1, creadoEn: enDias(-24),
  },
  historial: [
    { estadoAnterior: null, estadoNuevo: 'POSTULADA', fueElSistema: false, ocurridaEn: enDias(-24) },
    { estadoAnterior: 'POSTULADA', estadoNuevo: 'PERFIL_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: enDias(-24) },
    { estadoAnterior: 'PERFIL_TURNO_CANDIDATO', estadoNuevo: 'PERFIL_CALIFICANDO', fueElSistema: false, ocurridaEn: enDias(-17) },
    { estadoAnterior: 'PERFIL_CALIFICANDO', estadoNuevo: 'PERFIL_POR_CONFIRMAR', fueElSistema: true, ocurridaEn: enDias(-16) },
    { estadoAnterior: 'PERFIL_POR_CONFIRMAR', estadoNuevo: 'PRUEBA_TURNO_CANDIDATO', fueElSistema: false, ocurridaEn: enDias(-1) },
  ],
}

/** El mismo proceso, ya en simulacion. Lo usa la captura de esa etapa. */
export const PROCESO_EN_SIMULACION = {
  resumen: {
    ...DETALLE_DEL_PROCESO.resumen,
    estado: 'SIMULACION_TURNO_CANDIDATO', estadoNombre: 'Elige tu fecha', diasSinCambio: 2,
  },
  historial: [
    ...DETALLE_DEL_PROCESO.historial,
    { estadoAnterior: 'PRUEBA_TURNO_CANDIDATO', estadoNuevo: 'PRUEBA_CALIFICANDO', fueElSistema: false, ocurridaEn: enDias(-9) },
    { estadoAnterior: 'PRUEBA_CALIFICANDO', estadoNuevo: 'SIMULACION_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: enDias(-2) },
  ],
}

/** Y ya en validacion y en decision, para las dos pantallas del final. */
export const PROCESO_EN_VALIDACION = {
  resumen: {
    ...DETALLE_DEL_PROCESO.resumen,
    estado: 'VALIDACION_TURNO_CANDIDATO', estadoNombre: 'Periodo de validación', diasSinCambio: 6,
  },
  historial: [
    ...PROCESO_EN_SIMULACION.historial,
    { estadoAnterior: 'SIMULACION_TURNO_CANDIDATO', estadoNuevo: 'VALIDACION_TURNO_CANDIDATO', fueElSistema: false, ocurridaEn: enDias(-6) },
  ],
}

export const PROCESO_EN_DECISION = {
  resumen: {
    ...DETALLE_DEL_PROCESO.resumen,
    estado: 'DECISION_TURNO_CANDIDATO', estadoNombre: 'Decisión · te toca a ti', diasSinCambio: 1,
  },
  historial: [
    ...PROCESO_EN_VALIDACION.historial,
    { estadoAnterior: 'VALIDACION_TURNO_CANDIDATO', estadoNuevo: 'DECISION_TURNO_CANDIDATO', fueElSistema: false, ocurridaEn: enDias(-1) },
  ],
}

// ---------------------------------------------------------------- su perfil

export const NIVELES_EDUCATIVOS = [
  { codigo: 'SECUNDARIA', nombre: 'Secundaria completa' },
  { codigo: 'TECNICA', nombre: 'Técnica' },
  { codigo: 'UNIVERSITARIA', nombre: 'Universitaria' },
  { codigo: 'TITULADO', nombre: 'Titulado' },
  { codigo: 'MAESTRIA', nombre: 'Maestría' },
  { codigo: 'DOCTORADO', nombre: 'Doctorado' },
]

export const NIVELES_IDIOMA = [
  { codigo: 'A1', nombre: 'A1 · Principiante' },
  { codigo: 'A2', nombre: 'A2 · Básico' },
  { codigo: 'B1', nombre: 'B1 · Intermedio' },
  { codigo: 'B2', nombre: 'B2 · Intermedio alto' },
  { codigo: 'C1', nombre: 'C1 · Avanzado' },
  { codigo: 'C2', nombre: 'C2 · Superior' },
  { codigo: 'NATIVO', nombre: 'Lengua materna' },
]

/**
 * El perfil lleno y **confirmado entero**.
 *
 * ⚠️ Aqui NO hay filas sin confirmar, y es la diferencia con la fixtura de QA.
 * Aquella existe para mirar como se ve un dato que dedujo la maquina y nadie ha
 * revisado —que es lo que hay que juzgar—; una captura de promocion enseña el
 * perfil de alguien que ya hizo ese trabajo. Con veinte pildoras «Sin
 * confirmar» la pantalla cuenta otra cosa.
 */
export const PERFIL = {
  titular: 'Analista de procesos · datos que se explican solos',
  resumen:
    'Ocho años ordenando operaciones en salud y transporte. Lo que mejor se me da es dejar '
    + 'documentado por qué un número es ese número, para que no haya que preguntarlo cada mes.',
  habilidades: ['SQL', 'Power BI', 'Excel avanzado', 'Gestión de procesos', 'Automatización de reportes'],
  experienciaMeses: 98,
  ubicacion: 'Arequipa, Perú',
  disponibilidad: 'Inmediata',
  pretension: { min: 3800, max: 4500, moneda: 'PEN' },
  experiencia: [
    {
      id: 12, puesto: 'Analista senior de procesos', empresa: 'Clínica San Juan',
      desde: haceMeses(52), hasta: null,
      descripcion:
        'Rehice el reporte de ocupación de camas: pasó de tres días de trabajo manual a salir '
        + 'solo cada lunes a las siete. Dejé escrito de dónde sale cada número.',
      origen: 'PERSONA', confirmado: true,
    },
    {
      id: 13, puesto: 'Asistente de operaciones', empresa: 'Transportes del Sur',
      desde: haceMeses(90), hasta: haceMeses(53),
      descripcion: 'Llevé el control de proveedores y el cierre de caja de once rutas.',
      origen: 'CURRICULUM', confirmado: true,
    },
    {
      id: 14, puesto: 'Practicante de mejora continua', empresa: 'Molinos del Norte',
      desde: haceMeses(106), hasta: haceMeses(97), descripcion: null,
      origen: 'CURRICULUM', confirmado: true,
    },
  ],
  educacion: [
    {
      id: 3, titulo: 'Ingeniería Industrial', institucion: 'Universidad Nacional de San Agustín',
      nivelCodigo: 'TITULADO', desde: haceMeses(140), hasta: haceMeses(80),
      enCurso: false, origen: 'PERSONA', confirmado: true,
    },
  ],
  idiomas: [
    { id: 1, idioma: 'Español', nivelCodigo: 'NATIVO', origen: 'PERSONA', confirmado: true },
    { id: 2, idioma: 'Inglés', nivelCodigo: 'B2', origen: 'PERSONA', confirmado: true },
  ],
  certificaciones: [
    {
      id: 5, nombre: 'Power BI Data Analyst', entidad: 'Microsoft',
      emitidaEn: haceMeses(14), venceEn: null,
      origen: 'PERSONA', confirmado: true, tieneArchivo: true,
    },
    {
      id: 6, nombre: 'Lean Six Sigma · Green Belt', entidad: 'ASQ',
      // Vence dentro de dos años: sin esto la pildora «Vencida» aparece sola con
      // el paso del tiempo y la captura acaba contando algo que no se pretendia.
      emitidaEn: haceMeses(26), venceEn: haceMeses(-24),
      origen: 'PERSONA', confirmado: true, tieneArchivo: true,
    },
  ],
  enlaces: [
    { id: 8, tipo: 'LINKEDIN', url: 'https://linkedin.com/in/lucia-mendoza-rios' },
    { id: 9, tipo: 'PORTAFOLIO', url: 'https://luciamendoza.pe/trabajo' },
  ],
  lecturaCv: { estado: 'LISTA', actualizadoEn: enDias(-24) },
  tieneFoto: false,
  portada: { tipo: 'GALERIA', codigo: 'CANTO_AQUA' },
  cv: { nombre: 'CV-Lucia-Mendoza-Rios.pdf', tamano: 284_531, subidoEn: enDias(-24) },
}

/**
 * Las provincias del desplegable de crear cuenta.
 *
 * ⚠️ **No son las 196.** El catalogo real las trae todas; aqui van las de tres
 * departamentos y el extranjero, que es lo que cabe en una captura y lo que
 * hace falta para que el `<optgroup>` se vea agrupado de verdad. `EXT` va
 * suelto y con `departamento: null`, como lo devuelve el backend.
 */
export const UBIGEO = [
  { codigo: '0401', nombre: 'Arequipa', departamento: 'Arequipa' },
  { codigo: '0403', nombre: 'Caylloma', departamento: 'Arequipa' },
  { codigo: '0405', nombre: 'Islay', departamento: 'Arequipa' },
  { codigo: '1501', nombre: 'Lima', departamento: 'Lima' },
  { codigo: '1507', nombre: 'Huaral', departamento: 'Lima' },
  { codigo: '1508', nombre: 'Huarochirí', departamento: 'Lima' },
  { codigo: '1301', nombre: 'Trujillo', departamento: 'La Libertad' },
  { codigo: '1302', nombre: 'Ascope', departamento: 'La Libertad' },
  { codigo: '1306', nombre: 'Pacasmayo', departamento: 'La Libertad' },
  { codigo: 'EXT', nombre: 'Fuera del Perú', departamento: null },
]

// ---------------------------------------------------------------- la evaluación

const opciones = (base, textos) => textos.map((t, i) => ({ id: base + i, letra: 'ABCDE'[i], texto: t }))

/**
 * Cinco formatos del banco v3, que es lo que distingue a esta evaluacion de un
 * formulario: se responde de formas distintas segun lo que se quiera observar.
 *
 * ⚠️ **`total` tiene que cuadrar con las preguntas servidas.** Si no, la
 * pantalla pinta su estado degradado —«llegaron 5 de las 55»— y la captura
 * enseña un error en vez del examen.
 */
export const PREGUNTAS_DE_EVALUACION = [
  {
    id: 1, posicion: 1, tipo: 'PC',
    enunciado: '¿Has tenido que parar una entrega ya comprometida porque el resultado no estaba bien?',
    situacion: null, opciones: opciones(10, ['Sí', 'No']),
    respuestaTexto: null, respuestaOpcionId: 10,
  },
  {
    id: 2, posicion: 2, tipo: 'SJT-R',
    enunciado: 'Del 1 al 5, ¿qué tan probable es que hagas cada una de estas cosas?',
    situacion:
      'Tu equipo entrega un informe semanal al área comercial. Esta semana descubres, el jueves '
      + 'por la tarde, que los datos de los últimos tres informes venían de una consulta mal '
      + 'filtrada.',
    opciones: opciones(20, [
      'Avisar de inmediato al área comercial, aunque todavía no sepas el alcance del error.',
      'Rehacer los tres informes primero y avisar el lunes con la corrección ya hecha.',
      'Preguntar a tu jefe qué prefiere antes de mover nada.',
    ]),
    respuestaTexto: null, respuestaOpcionId: null,
  },
  {
    id: 3, posicion: 3, tipo: 'SEC',
    enunciado:
      'Se cae el reporte que usa el área comercial cada mañana. Ordena lo que harías, '
      + 'de primero a último.',
    situacion: null,
    opciones: opciones(30, [
      'Avisar al área comercial de que el reporte de hoy va a llegar tarde.',
      'Mirar qué cambió desde la última ejecución que sí funcionó.',
      'Reparar la causa y volver a ejecutarlo.',
      'Comprobar que los números cuadran con los del día anterior.',
      'Dejar anotado qué pasó y cómo se arregló.',
    ]),
    respuestaTexto: null, respuestaOpcionId: null,
  },
  {
    id: 4, posicion: 4, tipo: 'EF-4',
    enunciado: 'De estas cuatro frases, ¿cuál se parece más a ti y cuál menos?',
    situacion: null,
    opciones: opciones(40, [
      'Prefiero avisar de un riesgo temprano aunque después resulte que no era nada.',
      'Prefiero resolver primero y contar el problema ya resuelto.',
      'Cuando hay prisa, prefiero que alguien me diga exactamente qué hacer.',
      'Bajo presión trabajo mejor solo que coordinando.',
    ]),
    respuestaTexto: null, respuestaOpcionId: null,
  },
  {
    id: 5, posicion: 5, tipo: 'V',
    enunciado:
      'Cuéntanos una vez que un número tuyo resultó estar mal y alguien ya había decidido '
      + 'con él. ¿Qué hiciste?',
    situacion: null, opciones: [],
    respuestaTexto:
      'Fue con el reporte de ocupación. Avisé el mismo día al área, con la cifra corregida al '
      + 'lado de la anterior, y luego dejé una comprobación automática que compara el total '
      + 'con el del día previo.',
    respuestaOpcionId: null,
  },
  {
    id: 6, posicion: 6, tipo: 'PC',
    enunciado: '¿Has documentado un proceso para que otra persona pudiera hacerlo sin ti?',
    situacion: null, opciones: opciones(60, ['Sí', 'No']),
    respuestaTexto: null, respuestaOpcionId: null,
  },
]

/*
 * Doce preguntas mas, para que la evaluacion tenga el tamaño que tiene.
 *
 * ⚠️ **Con seis, el mapa lateral no cuenta nada.** Una evaluacion del banco v3
 * son entre 50 y 85 preguntas, y lo que el mapa resuelve —saltarse una y poder
 * volver sin pulsar cuarenta veces— solo se ve cuando hay de donde volver. No
 * son 55 porque cada una se escribe a mano y dieciocho ya enseñan la rejilla
 * llena; lo que no vale es servir un `total` de 55 con seis preguntas dentro,
 * que es lo que hace saltar el estado degradado de la pantalla.
 */
const MAS_PREGUNTAS = [
  ['¿Has llevado el control de un presupuesto que no era tuyo?', ['Sí', 'No']],
  ['¿Has tenido que decirle que no a un área que te pedía algo urgente?', ['Sí', 'No']],
  ['¿Has formado a alguien para que hiciera una tarea que hacías tú?', ['Sí', 'No']],
  ['¿Has trabajado con datos que sabías que estaban incompletos?', ['Sí', 'No']],
  ['¿Has propuesto un cambio que nadie te pidió?', ['Sí', 'No']],
  ['¿Has tenido que rehacer algo tuyo desde cero?', ['Sí', 'No']],
  ['¿Has coordinado con alguien de otra área sin que ninguno mandara sobre el otro?', ['Sí', 'No']],
  ['¿Has parado una tarea porque el dato de partida no era fiable?', ['Sí', 'No']],
  ['¿Te ha tocado explicar un error tuyo a alguien de fuera de tu equipo?', ['Sí', 'No']],
  ['¿Has heredado un proceso que nadie sabía cómo funcionaba?', ['Sí', 'No']],
  ['¿Has decidido con menos información de la que querías?', ['Sí', 'No']],
  ['¿Has dejado documentado algo pensando en quien viniera después?', ['Sí', 'No']],
].map(([enunciado, textos], i) => ({
  id: 100 + i, posicion: 7 + i, tipo: 'PC', enunciado, situacion: null,
  opciones: opciones(1000 + i * 10, textos),
  respuestaTexto: null,
  // Las cinco primeras contestadas: el mapa tiene que enseñar los tres estados.
  respuestaOpcionId: i < 5 ? 1000 + i * 10 : null,
}))

export const TODAS_LAS_PREGUNTAS = [...PREGUNTAS_DE_EVALUACION, ...MAS_PREGUNTAS]

export const EVALUACION_PORTADA = {
  // Antes de empezar el backend devuelve `total: 0`: el orden de preguntas se
  // arma dentro de `iniciar()`, asi que todavia no hay nada que contar.
  id: 7, estado: 'PENDIENTE', venceEn: enDias(9), iniciadaEn: null, terminadaEn: null,
  minutosObjetivo: 45, total: 0, respondidas: 0, preguntas: [],
}

export const EVALUACION_EN_CURSO = {
  id: 7, estado: 'EN_CURSO', venceEn: enDias(9), iniciadaEn: enMinutos(-18),
  terminadaEn: null, minutosObjetivo: 45,
  total: TODAS_LAS_PREGUNTAS.length, respondidas: 7,
  preguntas: TODAS_LAS_PREGUNTAS,
}

// ---------------------------------------------------------------- la prueba

const ENUNCIADO_DE_LA_PRUEBA =
  `Tienes el volcado de ventas de los últimos seis meses. El área comercial pide un reporte `
  + `semanal que hoy alguien arma a mano cada lunes y tarda tres horas.\n\n`
  + `Queremos ver cómo lo resolverías tú: qué dejas fuera, qué automatizas y qué decides no `
  + `tocar. No buscamos la solución perfecta, buscamos entender tus criterios.`

const ENTREGABLES = [
  {
    id: 1, nombre: 'El reporte funcionando',
    detalle: 'Como se lo entregarías al área comercial el lunes.',
    formato: 'ARCHIVO', esObligatorio: true, entregado: true,
  },
  {
    id: 2, nombre: 'Cómo lo montaste',
    detalle: 'Un documento corto o un repositorio: lo que explique tus decisiones.',
    formato: null, esObligatorio: true, entregado: true,
  },
  {
    id: 3, nombre: 'Un video corto explicándolo', detalle: null,
    formato: 'ENLACE', esObligatorio: false, entregado: false,
  },
]

const PREGUNTAS_DE_LA_PRUEBA = [
  {
    id: 1, tipo: 'ABIERTA', enunciado: '¿Qué decidiste dejar fuera, y por qué?',
    respuestaTexto:
      'Dejé fuera el desglose por vendedor: no lo miran cada semana y duplicaba el tiempo de '
      + 'carga. Lo dejé preparado por si lo piden, pero apagado.',
  },
  {
    id: 2, tipo: 'ABIERTA', enunciado: '¿Dónde podría fallar tu solución?',
    respuestaTexto: null,
  },
]

const BASE_DE_LA_PRUEBA = {
  id: 5, modalidad: 'Remota', duracionMinutos: 120,
  enunciado: ENUNCIADO_DE_LA_PRUEBA,
  materiales: 'El volcado en CSV y el reporte de la semana pasada, adjuntos en el correo.',
  herramientasPermitidas: 'Las que quieras, incluida IA. Te vamos a preguntar qué verificaste.',
  cambioTexto: null,
  preguntas: PREGUNTAS_DE_LA_PRUEBA,
  entregables: ENTREGABLES,
}

export const PRUEBA_ANTES = {
  ...BASE_DE_LA_PRUEBA, estadoIntento: 'PENDIENTE', iniciadoEn: null, venceEn: enDias(4),
}

export const PRUEBA_EN_CURSO = {
  ...BASE_DE_LA_PRUEBA, estadoIntento: 'EN_CURSO',
  iniciadoEn: enMinutos(-42), venceEn: enMinutos(78),
}

/** La otra forma de la etapa: preguntas escritas para esa vacante, sin entregar nada. */
export const CUESTIONARIO_TECNICO = {
  id: 9, modalidad: 'Remota', estadoIntento: 'EN_CURSO',
  iniciadoEn: enMinutos(-12), venceEn: enMinutos(48), duracionMinutos: 60,
  enunciado: 'Responde con tus palabras. No hay respuestas de manual: nos interesa cómo decides.',
  materiales: null, herramientasPermitidas: null, cambioTexto: null, entregables: [],
  preguntas: [
    {
      id: 1, tipo: 'ABIERTA',
      enunciado:
        'Un área te pide un número para una reunión que empieza en dos horas y los datos que '
        + 'tienes no cuadran. ¿Qué haces?',
      respuestaTexto:
        'Les doy el número con el margen de error que sé que tiene, y digo en qué me apoyo. '
        + 'Prefiero eso a llegar tarde con una cifra que igual habría que corregir.',
    },
    {
      id: 2, tipo: 'ABIERTA',
      enunciado: 'Cuéntanos un reporte que hayas automatizado. ¿Qué se rompió primero?',
      respuestaTexto: null,
    },
    {
      id: 3, tipo: 'ABIERTA',
      enunciado: '¿Cómo dejas documentado de dónde sale cada número?',
      respuestaTexto: null,
    },
  ],
}

// ---------------------------------------------------------------- la simulación

const TRAMOS = [
  { codigo: 'BIENVENIDA', nombre: 'Bienvenida y entrega del encargo', minutoInicio: 0, minutoFin: 15 },
  { codigo: 'PREGUNTAS', nombre: 'Preguntas al equipo', minutoInicio: 15, minutoFin: 30 },
  { codigo: 'TRABAJO', nombre: 'Trabajo', minutoInicio: 30, minutoFin: 80 },
  { codigo: 'CAMBIO', nombre: 'Aparece un cambio en el encargo', minutoInicio: 80, minutoFin: 100 },
  { codigo: 'ENTREGA', nombre: 'Entrega', minutoInicio: 100, minutoFin: 110 },
  { codigo: 'CIERRE', nombre: 'Conversación final', minutoInicio: 110, minutoFin: 120 },
]

export const SESIONES_DISPONIBLES = [
  {
    id: 41, fechaHora: enDiasALaHora(5, 9), duracionMinutos: 120, modalidad: 'Presencial',
    lugar: 'Oficina de San Isidro', enlace: null, plazasLibres: 4,
  },
  {
    id: 42, fechaHora: enDiasALaHora(8, 15), duracionMinutos: 120, modalidad: 'Presencial',
    lugar: 'Oficina de San Isidro', enlace: null, plazasLibres: 2,
  },
  {
    id: 43, fechaHora: enDiasALaHora(12, 9), duracionMinutos: 120, modalidad: 'Remota',
    lugar: null, enlace: null, plazasLibres: 6,
  },
]

export const MI_SESION = {
  inscripcionId: 7, sesionId: 41, fechaHora: enDiasALaHora(5, 9), duracionMinutos: 120,
  modalidad: 'Sesión grupal', lugar: 'Oficina de San Isidro', enlace: null,
  enunciado:
    'Trabajarás sobre el reporte semanal de una operación real, con los datos que te '
    + 'entreguemos al empezar. No hace falta que prepares nada.',
  asistio: null, tramos: TRAMOS,
}

// ---------------------------------------------------------------- el panel

import { RESPUESTAS as RESPUESTAS_DE_QA } from './datos-panel.mjs'

/**
 * El panel se apoya en la fixtura de QA y **sobrescribe lo que se ve**.
 *
 * Heredar es lo correcto: `datos-panel.mjs` copia con cuidado los `record` de
 * `src/panel/api/tipos.ts` —areas, permisos, banco, sesiones, catalogos— y
 * reescribirlos aqui solo abriria la puerta a inventarse un campo que la API no
 * devuelve, que es el fallo que ese archivo documenta cinco veces.
 *
 * Lo que sí cambia es lo que la camara enfoca:
 *
 * ⚠️ **Fuera las setenta filas de relleno.** La fixtura de QA genera una tanda
 * de 78 con casi nadie calificado, porque ese es el caso que hacia leer «76
 * calificados» encima de una columna de guiones. Es exactamente la imagen que
 * no se quiere en una captura de promocion: una tabla de rayas.
 *
 * ⚠️ **Y la vacante es la misma que el candidato ve.** Sin esto, el panel
 * enseñaria una convocatoria de infraestructura al lado del portal de una
 * analista de datos.
 */

const PUESTO = 'Analista de Datos'
const EMPRESA_ID = 1

/** Sin tildes ni eñes: un correo con acento delata que el dato es de mentira. */
const comoCorreo = (nombre) =>
  nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/*
 * Una fila del ranking, con lo que se repite ya puesto.
 *
 * ⚠️ **Todas traen ciudad y pretension a proposito.** El panel esconde esas dos
 * columnas cuando ninguna fila las trae —y explica por que, que es lo correcto
 * en produccion, donde la ciudad solo se le pide a quien crea la cuenta ahora—.
 * Una captura de promocion con dos columnas menos y un cartel explicando su
 * ausencia enseña el hueco en vez de la herramienta.
 */
const fila = (n, datos) => ({
  puesto: n,
  correo: `${comoCorreo(datos.candidato)}@ejemplo.pe`,
  archivoNombre: `cv-${comoCorreo(datos.candidato)}.pdf`,
  estadoCalificacion: 'TERMINADA',
  pasada: 'FINA',
  notasCriterio: [],
  actualizadoEn: enDias(-2),
  riesgosCriticos: 0,
  ciudad: 'Lima',
  ciudadCodigo: '1501',
  pretensionMin: 3500,
  pretensionMax: 4200,
  pretensionMoneda: 'PEN',
  ...datos,
})

/**
 * La tanda: catorce personas repartidas por etapas, casi todas con nota.
 *
 * ⚠️ **La mayoria esta parada en el perfil a proposito.** El ranking enseña
 * solo a quien esta en la etapa de la pestaña, asi que una tanda repartida a
 * partes iguales daria cinco tablas de dos filas.
 */
const FILAS = [
  fila(1, {
    postulacionId: 91, uuid: 'p1', candidato: 'Lucía Mendoza Ríos', ciudad: 'Arequipa', ciudadCodigo: '0401',
    pretensionMin: 3800, pretensionMax: 4500,
    estado: 'PRUEBA_POR_CONFIRMAR', estadoNombre: 'Prueba en revisión',
    grupoPrioridad: 'A', notaEtapa: 91, notaCurriculum: 88,
    adecuacion: 89, potencial: 92, altoRendimiento: 85, confianzaEvidencia: 90,
    resumen: 'Ordenó reportes que antes se armaban a mano y deja escrito de dónde sale cada número.',
    fortalezas: 5, alertas: 0, actualizadoEn: enDias(-1),
  }),
  fila(2, {
    postulacionId: 94, uuid: 'p4', candidato: 'Rodrigo Ayala Pinto',
    estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Perfil por confirmar',
    grupoPrioridad: 'A', notaEtapa: 86, notaCurriculum: 84,
    adecuacion: 85, potencial: 88, altoRendimiento: 80, confianzaEvidencia: 83,
    resumen: 'Llevó un equipo pequeño durante una migración que salió mal y la cuenta entera.',
    fortalezas: 4, alertas: 1,
  }),
  fila(3, {
    postulacionId: 98, uuid: 'p8', candidato: 'Ana Belén Zegarra', ciudad: 'Trujillo', ciudadCodigo: '1301',
    pretensionMin: 3600, pretensionMax: 4300,
    estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Perfil por confirmar',
    grupoPrioridad: 'A', notaEtapa: 83, notaCurriculum: 81,
    adecuacion: 84, potencial: 79, altoRendimiento: 78, confianzaEvidencia: 86,
    resumen: 'Trabajó con el área comercial de cerca; sabe traducir una cifra a una decisión.',
    fortalezas: 4, alertas: 0,
  }),
  fila(4, {
    postulacionId: 96, uuid: 'p6', candidato: 'Marcos Ibáñez Trujillo', ciudad: 'Arequipa', ciudadCodigo: '0401',
    pretensionMin: 3400, pretensionMax: 3900,
    estado: 'PRUEBA_POR_CONFIRMAR', estadoNombre: 'Prueba en revisión',
    grupoPrioridad: 'A', notaEtapa: 80, notaCurriculum: 78,
    adecuacion: 79, potencial: 82, altoRendimiento: 74, confianzaEvidencia: 77,
    resumen: 'Perfil sólido de operación; menos evidencia de decidir con poca información.',
    fortalezas: 3, alertas: 1,
  }),
  fila(5, {
    postulacionId: 93, uuid: 'p3', candidato: 'Valeria Chumpitaz Ríos', ciudad: 'Lima', ciudadCodigo: '1501',
    pretensionMin: 4000, pretensionMax: 4800,
    estado: 'PERFIL_CALIFICANDO', estadoNombre: 'Perfil · calificando',
    grupoPrioridad: 'B', notaEtapa: 77, notaCurriculum: 77,
    adecuacion: 76, potencial: 80, altoRendimiento: 72, confianzaEvidencia: 75,
    resumen: 'Trabajo sólido y sin sobresaltos.',
    fortalezas: 3, alertas: 0,
  }),
  fila(6, {
    postulacionId: 99, uuid: 'p9', candidato: 'Sergio Palomino Cárdenas', ciudad: 'Trujillo', ciudadCodigo: '1301',
    pretensionMin: 3200, pretensionMax: 3800,
    estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Perfil por confirmar',
    grupoPrioridad: 'B', notaEtapa: 74, notaCurriculum: 73,
    adecuacion: 72, potencial: 77, altoRendimiento: 70, confianzaEvidencia: 71,
    resumen: 'Buena base técnica; poca huella de haber acompañado a un área no técnica.',
    fortalezas: 2, alertas: 1,
  }),
  fila(7, {
    postulacionId: 92, uuid: 'p2', candidato: 'Diego Salazar Nuñez',
    estado: 'PERFIL_CALIFICANDO', estadoNombre: 'Perfil · calificando',
    estadoCalificacion: 'EN_CURSO', pasada: 'RAPIDA',
    grupoPrioridad: 'B', notaEtapa: 72, notaCurriculum: 70,
    adecuacion: 71, potencial: 75, altoRendimiento: 66, confianzaEvidencia: 62,
    resumen: 'Nota provisional de la criba rápida; la pasada fina todavía no ha corrido.',
    fortalezas: 2, alertas: 2,
  }),
  fila(8, {
    postulacionId: 100, uuid: 'p10', candidato: 'Patricia Ccahuana Vera',
    estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Perfil por confirmar',
    grupoPrioridad: 'B', notaEtapa: 70, notaCurriculum: 69,
    adecuacion: 68, potencial: 73, altoRendimiento: 67, confianzaEvidencia: 70,
    resumen: 'Ordenada y constante; el salto a decidir sola está por verse.',
    fortalezas: 2, alertas: 0,
  }),
  fila(9, {
    postulacionId: 101, uuid: 'p11', candidato: 'Julio Bermúdez Aranda',
    estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Perfil por confirmar',
    grupoPrioridad: 'B', notaEtapa: 68, notaCurriculum: 66,
    adecuacion: 65, potencial: 71, altoRendimiento: 64, confianzaEvidencia: 69,
    resumen: 'Viene de un área distinta y lo argumenta bien.',
    fortalezas: 2, alertas: 1, riesgosCriticos: 1,
  }),
  fila(10, {
    postulacionId: 102, uuid: 'p12', candidato: 'Milagros Ticona Flores', ciudad: 'Arequipa', ciudadCodigo: '0401',
    pretensionMin: 4200, pretensionMax: 5000,
    estado: 'SIMULACION_POR_CONFIRMAR', estadoNombre: 'Simulación por confirmar',
    grupoPrioridad: 'A', notaEtapa: 85, notaCurriculum: 82,
    adecuacion: 83, potencial: 86, altoRendimiento: 81, confianzaEvidencia: 84,
    resumen: 'Sostuvo el cambio a mitad de la simulación sin perder el entregable.',
    fortalezas: 4, alertas: 0,
  }),
  fila(11, {
    postulacionId: 103, uuid: 'p13', candidato: 'Iván Rojas Peñaloza', ciudad: 'Lima', ciudadCodigo: '1501',
    pretensionMin: 4500, pretensionMax: 5200,
    estado: 'DECISION_POR_CONFIRMAR', estadoNombre: 'En decisión final',
    grupoPrioridad: 'A', notaEtapa: 87, notaCurriculum: 85,
    adecuacion: 86, potencial: 84, altoRendimiento: 83, confianzaEvidencia: 88,
    resumen: 'Terminó la validación con las métricas cumplidas y una duda del área.',
    fortalezas: 5, alertas: 1,
  }),
  fila(12, {
    postulacionId: 104, uuid: 'p14', candidato: 'Carla Villanueva Soto', ciudad: 'Lima', ciudadCodigo: '1501',
    pretensionMin: null, pretensionMax: null,
    estado: 'PERFIL_TURNO_CANDIDATO', estadoNombre: 'Evaluación pendiente',
    estadoCalificacion: 'SIN_EMPEZAR', pasada: null,
    grupoPrioridad: null, notaEtapa: null, notaCurriculum: null,
    adecuacion: null, potencial: null, altoRendimiento: null, confianzaEvidencia: null,
    resumen: null, fortalezas: 0, alertas: 0, actualizadoEn: null,
  }),
  fila(13, {
    postulacionId: 105, uuid: 'p15', candidato: 'Óscar Farfán Beltrán', ciudad: null, ciudadCodigo: null,
    pretensionMin: null, pretensionMax: null,
    estado: 'PERFIL_TURNO_CANDIDATO', estadoNombre: 'Evaluación pendiente',
    estadoCalificacion: 'SIN_EMPEZAR', pasada: null,
    grupoPrioridad: null, notaEtapa: null, notaCurriculum: null,
    adecuacion: null, potencial: null, altoRendimiento: null, confianzaEvidencia: null,
    resumen: null, fortalezas: 0, alertas: 0, actualizadoEn: null,
  }),
  fila(14, {
    postulacionId: 97, uuid: 'p7', candidato: 'Renzo Ferrer Zavala',
    estado: 'NO_CONTINUA', estadoNombre: 'No continúa',
    grupoPrioridad: 'C', notaEtapa: 54, notaCurriculum: 56,
    adecuacion: 53, potencial: 58, altoRendimiento: 51, confianzaEvidencia: 60,
    resumen: 'No sostuvo el caso de la prueba y el cierre quedó a medias.',
    fortalezas: 1, alertas: 2, riesgosCriticos: 2, actualizadoEn: enDias(-9),
  }),
]

/** Quien tiene nota en cada etapa. En promocion, quien esta o pasó por ella. */
const NOTA_POR_ETAPA = {
  PERFIL_INTEGRAL: (f) => f.notaEtapa,
  PRUEBA_PUESTO: (f) =>
    (['PRUEBA_POR_CONFIRMAR', 'SIMULACION_POR_CONFIRMAR', 'DECISION_POR_CONFIRMAR'].includes(f.estado)
      ? f.notaEtapa : null),
  SIMULACION: (f) =>
    (['SIMULACION_POR_CONFIRMAR', 'DECISION_POR_CONFIRMAR'].includes(f.estado) ? f.notaEtapa : null),
  VALIDACION: (f) => (f.estado === 'DECISION_POR_CONFIRMAR' ? f.notaEtapa : null),
  DECISION: (f) => (f.estado === 'DECISION_POR_CONFIRMAR' ? f.notaEtapa : null),
}

export function rankingDePromocion(etapa = 'PERFIL_INTEGRAL') {
  const nota = NOTA_POR_ETAPA[etapa] ?? NOTA_POR_ETAPA.PERFIL_INTEGRAL
  return {
    vacanteId: 1, vacante: PUESTO, puesto: PUESTO, nivelPuesto: 'EJECUCION',
    puedeVerPretension: true,
    total: FILAS.length,
    conPasadaFina: FILAS.filter((f) => f.pasada === 'FINA').length,
    calificados: FILAS.filter((f) => f.estadoCalificacion === 'TERMINADA').length,
    enCurso: FILAS.filter((f) => f.estadoCalificacion === 'EN_CURSO').length,
    fallidos: 0,
    filas: FILAS.map((f) => ({ ...f, notaEtapa: nota(f) })),
  }
}

const VACANTES_DEL_PANEL = [
  {
    id: 1, titulo: PUESTO, estado: 'PUBLICADA', tipoCierre: 'MANUAL',
    puestoId: 2, solicitudTalentoId: 8, responsableUsuarioId: EMPRESA_ID,
    publicadaEn: enDias(-31), cerradaEn: null, aplicaEvaluacion: true,
    plantillaEvaluacionId: 1, versionPlantillaPruebaId: 1, versionPesosId: 2,
  },
  {
    id: 2, titulo: 'Jefe/a de Servicio al Cliente', estado: 'PUBLICADA', tipoCierre: 'MANUAL',
    puestoId: 4, solicitudTalentoId: 9, responsableUsuarioId: EMPRESA_ID,
    publicadaEn: enDias(-12), cerradaEn: null, aplicaEvaluacion: true,
    plantillaEvaluacionId: 1, versionPlantillaPruebaId: 1, versionPesosId: 2,
  },
  {
    id: 3, titulo: 'Coordinador/a de Proyectos', estado: 'BORRADOR', tipoCierre: 'MANUAL',
    puestoId: 3, solicitudTalentoId: 10, responsableUsuarioId: EMPRESA_ID,
    publicadaEn: null, cerradaEn: null, aplicaEvaluacion: false,
    plantillaEvaluacionId: null, versionPlantillaPruebaId: null, versionPesosId: null,
  },
  {
    id: 4, titulo: 'Especialista en Servicio', estado: 'CERRADA', tipoCierre: 'MANUAL',
    puestoId: 5, solicitudTalentoId: 11, responsableUsuarioId: EMPRESA_ID,
    publicadaEn: enDias(-124), cerradaEn: enDias(-37), aplicaEvaluacion: true,
    plantillaEvaluacionId: 1, versionPlantillaPruebaId: 1, versionPesosId: 2,
  },
]

/** El desglose de la evaluacion de Lucia, en el idioma de esta vacante. */
const EVALUACION_DEL_PANEL = {
  postulacionId: 91, estado: 'CALIFICADA', entregadaEn: enDias(-11),
  notaEvaluacion: 34.6,
  cerradas: { nota: 88, preguntas: 46 },
  abiertas: [
    {
      pregunta: '¿Cómo decidiste qué dejar fuera de un reporte que ya no daba abasto?',
      formato: 'V',
      respuesta:
        'Miré qué columnas se usaban de verdad: tres de las once movían todas las decisiones. '
        + 'Congelé el resto un mes y nadie las pidió, así que las quité.',
      puntaje: 4,
      explicacion: 'Ordena por uso medido y acepta el coste de congelar. Cita una consecuencia observable.',
      evidenciaCitada: 'nadie las pidió, así que las quité', confianza: 0.9, motivoAjuste: null,
    },
    {
      pregunta: 'Cuenta una vez que un número tuyo salió mal.',
      formato: 'V',
      respuesta:
        'El de ocupación de camas, por un filtro de fechas. Avisé el mismo día con la cifra '
        + 'corregida al lado de la anterior y dejé una comprobación automática contra el día previo.',
      puntaje: 4,
      explicacion: 'Nombra el error propio, la corrección y el cambio que evita que se repita.',
      evidenciaCitada: 'dejé una comprobación automática', confianza: 0.87, motivoAjuste: null,
    },
    {
      pregunta: 'Explica una decisión técnica a quien no es técnico.',
      formato: 'V',
      respuesta:
        'Les dije que rehacer el reporte era como cambiar los cimientos con la casa puesta: '
        + 'se puede, pero hay que apuntalar antes y va a haber ruido.',
      puntaje: 3,
      explicacion: 'La analogía sostiene el coste y el riesgo sin simplificarlo.',
      evidenciaCitada: 'hay que apuntalar antes', confianza: 0.82,
      motivoAjuste: 'Bajado de 4 a 3: la analogía es buena pero no dice cuánto dura el ruido.',
    },
  ],
  alineacion: [
    { bloque: 'Cómo trabaja', semaforo: 'VERDE',
      explicacion: 'Elige lo simple donde lo complejo era tentador, y lo argumenta.' },
    { bloque: 'Cómo responde a lo inesperado', semaforo: 'VERDE',
      explicacion: 'Avisa temprano y deja el rastro escrito.' },
    { bloque: 'Cómo trata a quien tiene al lado', semaforo: 'VERDE', explicacion: null },
  ],
  /*
   * ⚠️ **`patrones` no es opcional.** `DesgloseEvaluacion` lo declara como
   * array y `TablaDeLaEvaluacion` le lee el `.length` sin guarda: sin el, la
   * ficha entera se cae con «Cannot read properties of undefined». La fixtura
   * de QA tampoco lo trae, asi que ese fallo esta tambien en sus capturas.
   */
  patrones: [
    { codigo: 'CONSISTENCIA', titulo: 'Responde igual a lo mismo',
      descripcion: 'Las parejas de control coinciden.', deCuantas: 6, total: 6 },
    { codigo: 'TIEMPO', titulo: 'Se tomó el tiempo de leer',
      descripcion: 'Ninguna respuesta por debajo del umbral de lectura.', deCuantas: 46, total: 46 },
  ],
}

const RUBRICA_DEL_PANEL = [
  { criterioId: 1, nombre: 'Criterio para priorizar', puntosMaximos: 10, puntaje: 9,
    explicacion: 'Dejó fuera lo que nadie mira y lo justificó con uso medido.', origen: 'AGENTE' },
  { criterioId: 2, nombre: 'Manejo del cambio a mitad', puntosMaximos: 10, puntaje: 8,
    explicacion: 'Reordenó la entrega sin perder el entregable obligatorio.', origen: 'AGENTE' },
  { criterioId: 3, nombre: 'Claridad de la entrega', puntosMaximos: 10, puntaje: 9,
    explicacion: 'Se entiende sin preguntarle nada.', origen: 'PERSONA' },
]

const FICHA_DE_LUCIA = {
  id: 91, uuid: 'p1', candidato: 'Lucía Mendoza Ríos', correo: CANDIDATA.correo,
  vacante: PUESTO, estado: 'PRUEBA_POR_CONFIRMAR', estadoNombre: 'Prueba en revisión',
  grupoPrioridad: 'A', motivoCierre: null,
  resultadoOrgulloso:
    'Rehice el reporte de ocupación: pasó de tres días de trabajo manual a salir solo cada lunes.',
  enlaces: ['https://linkedin.com/in/lucia-mendoza-rios'], archivoCvId: 3,
  creadoEn: enDias(-24), movidoEn: enDias(-1),
}

const PERFIL_INTEGRAL_DE_LUCIA = {
  postulacionId: 91, estadoCalificacion: 'TERMINADA',
  resumen:
    'Ocho años ordenando operaciones en salud y transporte. Deja documentado de dónde sale '
    + 'cada número, y eso se nota en cómo cuenta sus decisiones.',
  adecuacion: 89, potencial: 92, altoRendimiento: 85, confianzaEvidencia: 90,
  notaEtapa: 91, actualizadoEn: enDias(-1),
  hallazgos: [
    { tipo: 'FORTALEZA',
      descripcion: 'Explica una decisión técnica a quien no es técnico sin simplificarla de más.',
      evidencia: 'Comparó rehacer el reporte con cambiar los cimientos con la casa puesta.',
      esCanalizable: false, sugerencia: null },
    { tipo: 'FORTALEZA',
      descripcion: 'Corrige un error propio antes de que se lo pidan y deja el arreglo automatizado.',
      evidencia: 'Avisó el mismo día del filtro mal puesto y añadió una comprobación diaria.',
      esCanalizable: false, sugerencia: null },
    { tipo: 'FALTA_EVIDENCIA',
      descripcion: 'No hay evidencia de haber liderado a otras personas de forma directa.',
      evidencia: 'Su trayectoria es de aporte individual dentro de equipos pequeños.',
      esCanalizable: true, sugerencia: 'Preguntarle por una vez que tuvo que coordinar sin mandar.' },
  ],
  notasCriterio: [
    { criterio: 'Criterio para priorizar', puntaje: 9, maximo: 10, peso: 0.4,
      explicacion: 'Ordena por uso medido, no por lo que le apetece.', origen: 'PRUEBA' },
    { criterio: 'Comunicación', puntaje: 9, maximo: 10, peso: 0.3,
      explicacion: 'Traduce una decisión técnica sin perder el coste ni el riesgo.',
      origen: 'EVALUACION' },
    { criterio: 'Trato con las áreas', puntaje: 8, maximo: 10, peso: 0.3,
      explicacion: 'Acompaña al área en vez de entregarle una cifra y marcharse.',
      origen: 'EVALUACION' },
  ],
}

const REQUISITOS_DEL_PANEL = [
  { id: 11, descripcion: 'Dos años o más trabajando con datos de operación.',
    regla: 'INDISPENSABLE', esActivo: true },
  { id: 12, descripcion: 'Experiencia con SQL demostrable.', regla: 'INDISPENSABLE', esActivo: true },
  { id: 13, descripcion: 'Haber trabajado con un área no técnica.', regla: 'DESEABLE', esActivo: true },
]

const RESPUESTAS_DE_PRUEBA_DEL_PANEL = [
  { preguntaId: 1, codigo: 'PP-01', orden: 1, tipo: 'ABIERTA',
    enunciado: '¿Qué decidiste dejar fuera del reporte, y por qué?',
    respuesta:
      'Dejé fuera el desglose por vendedor: no lo miran cada semana y duplicaba el tiempo de '
      + 'carga.\n\nLo dejé preparado por si lo piden, pero apagado. Prefiero que el lunes salga '
      + 'a las siete con lo que se usa que a las nueve con todo.',
    respondidaEn: enDias(-11) },
  { preguntaId: 2, codigo: 'PP-02', orden: 2, tipo: 'ABIERTA',
    enunciado: '¿Dónde podría fallar tu solución?',
    respuesta:
      'En el origen: si alguien cambia el nombre de una columna en la hoja de carga, el reporte '
      + 'sale vacío y no avisa. Puse una comprobación de filas mínimas, pero no cubre todo.',
    respondidaEn: enDias(-11) },
  { preguntaId: 3, codigo: 'PP-03', orden: 3, tipo: 'ABIERTA',
    enunciado: '¿Qué le dirías al área que pidió el cambio a dos días de la entrega?',
    respuesta: null, respondidaEn: null },
]

/*
 * Lo que entregó, con los nombres que devuelve la API de verdad.
 *
 * ⚠️ **Es `entregableRequeridoId` y `loEntrego`, no `id` ni `entregadoEn`.** Con
 * los nombres de al lado la pantalla lo pinta todo como no entregado y escribe
 * «Falta, y era obligatorio» sobre una entrega que sí está: una captura que
 * afirma algo falso del candidato, y del lado que le perjudica.
 */
const ENTREGABLES_DEL_PANEL = [
  { entregableRequeridoId: 1, nombre: 'El reporte funcionando',
    detalle: 'Como se lo entregarías al área comercial el lunes.',
    formato: 'ARCHIVO', esObligatorio: true, loEntrego: true,
    enlace: null, archivoId: 77, archivoNombre: 'reporte-semanal.xlsx',
    version: 2, subidoEn: enDias(-11), porQueNoSeVe: null },
  { entregableRequeridoId: 2, nombre: 'Cómo lo montaste',
    detalle: 'Un documento corto o un repositorio: lo que explique tus decisiones.',
    formato: 'CUALQUIERA', esObligatorio: true, loEntrego: true,
    enlace: null, archivoId: 78, archivoNombre: 'decisiones.pdf',
    version: 1, subidoEn: enDias(-11), porQueNoSeVe: null },
  { entregableRequeridoId: 3, nombre: 'Un video corto explicándolo',
    detalle: 'Opcional: cuéntalo a cámara en menos de cuatro minutos.',
    formato: 'ENLACE', esObligatorio: false, loEntrego: true,
    enlace: 'https://www.loom.com/share/ejemplo-lucia-mendoza',
    archivoId: null, archivoNombre: null,
    version: 1, subidoEn: enDias(-11), porQueNoSeVe: null },
]

/*
 * La rúbrica de la prueba, criterio a criterio.
 *
 * ⚠️ **Va en `/prueba/notas`, no en `/rubrica-prueba`.** Es de donde salen
 * además «¿Por qué contratarlo?» y «Lectura de la prueba», así que heredar la
 * de QA dejaba la ficha de una analista de datos hablando de una campaña de
 * Meta Ads.
 *
 * El último criterio va sin nota a propósito: es el que la rúbrica reserva a
 * una persona —un video no lo puede leer el agente— y enseñar ese hueco es
 * parte de lo que esta pantalla hace bien.
 */
const NOTAS_DE_LA_PRUEBA = [
  { criterioId: 31, nombre: 'Criterio para priorizar', puntosMaximos: 25, puntaje: 22,
    explicacion: 'Dejó fuera lo que nadie mira y lo justificó con uso medido.', origen: 'AGENTE' },
  { criterioId: 32, nombre: 'El reporte hace lo que promete', puntosMaximos: 25, puntaje: 23,
    explicacion: 'Sale solo, con los números cuadrados contra el día anterior.', origen: 'AGENTE' },
  { criterioId: 33, nombre: 'Sabe dónde puede fallar', puntosMaximos: 20, puntaje: 17,
    explicacion: 'Nombra el punto débil real: el origen de los datos.', origen: 'AGENTE' },
  { criterioId: 34, nombre: 'Lo deja explicado para otro', puntosMaximos: 20, puntaje: 18,
    explicacion: 'Se entiende sin preguntarle nada.', origen: 'PERSONA' },
  { criterioId: 35, nombre: 'Qué es suyo frente a la IA', puntosMaximos: 10, puntaje: 8,
    explicacion: 'Separa lo que le dio el modelo de lo que corrigió a mano.', origen: 'AGENTE' },
]

/** Lo que responde cada ruta del panel. Nada de esto sale de aqui. */
export const RESPUESTAS_DEL_PANEL = {
  ...RESPUESTAS_DE_QA,
  '/vacantes': VACANTES_DEL_PANEL,
  /*
   * La plantilla del cuestionario colgaba del puesto 1 —Ingeniero de
   * Infraestructura— y en la pantalla de Pruebas salia «Escrita para Ingeniero
   * de Infraestructura» dentro de una demo que va de una analista de datos.
   */
  /*
   * El banco, sin los dos avisos que la fixtura de QA siembra a proposito.
   *
   * ⚠️ Aquella deja **dos PUBLICADA del mismo nivel** —para poder mirar el aviso
   * de «solo una se asigna»— y el de Supervision en borrador, que enciende
   * «ninguna version publicada: quien empiece se queda sin banco». Las dos
   * cosas son correctas donde estan y son dos rectangulos ambar de advertencia
   * en medio de una captura de promocion.
   */
  '/banco-preguntas/versiones': [
    { id: 10, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'EJECUCION',
      etiqueta: 'Banco CAZATALENTOS · Ejecución',
      estado: 'PUBLICADA', minutosObjetivo: 35, publicadaEn: enDias(-16) },
    { id: 15, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'SUPERVISION',
      etiqueta: 'Banco CAZATALENTOS · Supervisión',
      estado: 'PUBLICADA', minutosObjetivo: 45, publicadaEn: enDias(-16) },
    { id: 18, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'DIRECCION',
      etiqueta: 'Banco CAZATALENTOS · Dirección',
      estado: 'PUBLICADA', minutosObjetivo: 60, publicadaEn: enDias(-16) },
    { id: 2, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'EJECUCION',
      etiqueta: 'Banco Ejecución v0.1', estado: 'ARCHIVADA',
      minutosObjetivo: null, publicadaEn: enDias(-310) },
    { id: 21, tipoBanco: 'ALINEACION', nivelPuestoCodigo: null,
      etiqueta: 'Alineación cultural · v2',
      estado: 'PUBLICADA', minutosObjetivo: null, publicadaEn: enDias(-68) },
  ],
  /*
   * La version de Direccion es nueva de aqui, asi que su contenido no lo trae la
   * fixtura de QA y «Ver que contiene» la abriria vacia. Se le da el mismo
   * juego de preguntas que a las demas.
   */
  '/banco-preguntas/versiones/18/preguntas':
    RESPUESTAS_DE_QA['/banco-preguntas/versiones/10/preguntas'],
  '/usuarios': [
    { id: 1, correo: 'talento@clinicasanjuan.pe', usuarioRenaserOsId: 'u-1', areaId: 1,
      esActivo: true, roles: ['TALENTO'] },
    { id: 2, correo: 'jefatura.datos@clinicasanjuan.pe', usuarioRenaserOsId: 'u-2', areaId: 2,
      esActivo: true, roles: ['ADMIN', 'TALENTO'] },
    { id: 3, correo: 'direccion@clinicasanjuan.pe', usuarioRenaserOsId: 'u-3', areaId: 1,
      esActivo: true, roles: ['DIRECCION'] },
  ],
  '/plantillas-prueba': [
    { id: 1, nombre: 'Reto con entregables', puestoId: null, esActiva: true },
    { id: 2, nombre: 'Cuestionario técnico', puestoId: 2, esActiva: true },
  ],
  '/vacantes/1': VACANTES_DEL_PANEL[0],
  '/vacantes/1/embudo': {
    porEstado: {
      PERFIL_TURNO_CANDIDATO: 2, PERFIL_CALIFICANDO: 2, PERFIL_POR_CONFIRMAR: 5,
      PRUEBA_POR_CONFIRMAR: 2, SIMULACION_POR_CONFIRMAR: 1,
      DECISION_POR_CONFIRMAR: 1, NO_CONTINUA: 1,
    },
  },
  '/vacantes/1/ranking': rankingDePromocion(),
  '/vacantes/1/requisitos': REQUISITOS_DEL_PANEL,
  '/postulaciones/91': FICHA_DE_LUCIA,
  '/postulaciones/91/perfil-integral': PERFIL_INTEGRAL_DE_LUCIA,
  '/postulaciones/91/evaluacion': EVALUACION_DEL_PANEL,
  '/postulaciones/91/rubrica-prueba': RUBRICA_DEL_PANEL,
  '/postulaciones/91/rubrica-simulacion': RUBRICA_DEL_PANEL,
  '/postulaciones/91/prueba/respuestas': RESPUESTAS_DE_PRUEBA_DEL_PANEL,
  '/postulaciones/91/prueba/entregables': ENTREGABLES_DEL_PANEL,
  '/postulaciones/91/prueba/notas': NOTAS_DE_LA_PRUEBA,
  '/postulaciones/91/historial': [],
  '/postulaciones/94': {
    id: 94, uuid: 'p4', candidato: 'Rodrigo Ayala Pinto', correo: 'rodrigo@ejemplo.pe',
    vacante: PUESTO, estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Perfil por confirmar',
    grupoPrioridad: 'A', motivoCierre: null,
    resultadoOrgulloso: 'Saqué adelante una migración que se cayó dos veces antes de salir.',
    enlaces: [], archivoCvId: 7, creadoEn: enDias(-20), movidoEn: enDias(-2),
  },
  '/postulaciones/94/perfil-integral': {
    postulacionId: 94, estadoCalificacion: 'TERMINADA',
    resumen: 'Llevó un equipo pequeño durante una migración que salió mal y la cuenta entera.',
    adecuacion: 85, potencial: 88, altoRendimiento: 80, confianzaEvidencia: 83,
    notaEtapa: 86, actualizadoEn: enDias(-2),
    hallazgos: [
      { tipo: 'FORTALEZA',
        descripcion: 'Cuenta el error propio antes de que se lo pregunten.',
        evidencia: 'Describió las dos caídas de la migración sin que se le preguntara por ellas.',
        esCanalizable: false, sugerencia: null },
      { tipo: 'RIESGO_DESARROLLABLE',
        descripcion: 'Poco recorrido decidiendo con presupuesto ajeno.',
        evidencia: 'Sus ejemplos son de decisiones técnicas, no de decisiones con coste.',
        esCanalizable: true, sugerencia: 'Preguntarle por una vez que tuvo que decir que no por dinero.' },
    ],
    notasCriterio: [
      { criterio: 'Criterio técnico', puntaje: 8, maximo: 10, peso: 0.4,
        explicacion: 'Volvió atrás a tiempo en vez de sostener la decisión.', origen: 'EVALUACION' },
    ],
  },
  '/postulaciones/94/evaluacion': EVALUACION_DEL_PANEL,
  '/postulaciones/94/historial': [],
}
