export type UrgencyLevel = "Alta" | "Media" | "Baja";
export type WeekState = "Completada" | "En riesgo" | "Replanificar" | "Próxima";
export type ObjectiveState =
  | "Enseñado"
  | "Requiere refuerzo"
  | "No enseñado"
  | "Planificado";

export type ObjectivePlan = {
  id: string;
  code: string;
  description: string;
  status: ObjectiveState;
  learning: number | null;
  evidence: string;
  taught: boolean;
};

export type WeekPlan = {
  id: string;
  weekNumber: number;
  dateRange: string;
  unit: string;
  state: WeekState;
  suggestion?: string;
  objectives: ObjectivePlan[];
};

export type CourseRecord = {
  id: string;
  subject: string;
  courseName: string;
  shortName: string;
  urgency: UrgencyLevel;
  expectedOAs: number;
  taughtOAs: number;
  curricularGap: number;
  planningProgress: number;
  learningProgress: number;
  issues: string[];
  subtitle: string;
  expectedWeekLabel: string;
  expectedVsActual: string;
  highlightReason: string;
  weeks: WeekPlan[];
  initialChatMessage: string;
};

export type WeeklyBlock = {
  day: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes";
  time: string;
  courseId: string;
  shortLabel: string;
};

export function getUrgencyFromGap(curricularGap: number): UrgencyLevel {
  if (curricularGap >= 4) return "Alta";
  if (curricularGap >= 2) return "Media";
  return "Baja";
}

export function getUrgencyTone(urgency: UrgencyLevel) {
  switch (urgency) {
    case "Alta":
      return {
        badge: "urgency-high",
        border: "border-[#b94b45]/45",
        surface: "bg-[#fff4f1]",
        accent: "text-[#8b1e18]",
      };
    case "Media":
      return {
        badge: "urgency-medium",
        border: "border-[#d0891a]/45",
        surface: "bg-[#fff8ea]",
        accent: "text-[#9a5a00]",
      };
    case "Baja":
      return {
        badge: "urgency-low",
        border: "border-[#2d7f8b]/35",
        surface: "bg-[#f3fbfc]",
        accent: "text-[#185a63]",
      };
  }
}

export const bitacoraCourses: CourseRecord[] = [
  {
    id: "lenguaje-5a",
    subject: "Lenguaje y Comunicación",
    courseName: "5° Básico A",
    shortName: "Lenguaje 5°A",
    urgency: "Alta",
    expectedOAs: 7,
    taughtOAs: 2,
    curricularGap: 5,
    planningProgress: 62,
    learningProgress: 41,
    subtitle: "Planificación anual dinámica · Semana 18 de 38",
    expectedWeekLabel: "Semana 18 de 38",
    expectedVsActual: "OAs esperados: 7 · OAs enseñados: 2",
    highlightReason:
      "Este curso es urgente porque debería llevar 7 OAs y solo lleva 2.",
    issues: [
      "Debería llevar 7 OAs enseñados y solo lleva 2.",
      "OA4 fue enseñado, pero el aprendizaje promedio es 38%.",
      "OA7 está planificado demasiado tarde para la próxima evaluación.",
      "La Unidad 2 necesita replanificación inmediata.",
    ],
    initialChatMessage:
      "Encontré 3 problemas prioritarios en este plan:\n\n1. Hay una brecha curricular de 5 OAs: a esta altura deberías llevar 7 OAs enseñados y solo llevas 2.\n2. OA4 fue enseñado, pero el aprendizaje promedio es 38%.\n3. OA7 está planificado para dos semanas más, pero debería adelantarse porque es prerrequisito de la próxima evaluación.\n\nTe sugiero replanificar la semana 18, agregar una guía de refuerzo para OA4 y reasignar la próxima prueba a OA4 y OA7.",
    weeks: [
      {
        id: "w17",
        weekNumber: 17,
        dateRange: "6–10 mayo",
        unit: "Unidad 2: Narraciones y comprensión lectora",
        state: "Completada",
        objectives: [
          {
            id: "oa2",
            code: "OA2",
            description:
              "Comprender textos aplicando estrategias de comprensión lectora",
            status: "Enseñado",
            learning: 56,
            evidence: "Guía Unidad 2",
            taught: true,
          },
          {
            id: "oa4-w17",
            code: "OA4",
            description: "Analizar aspectos relevantes de narraciones leídas",
            status: "Requiere refuerzo",
            learning: 38,
            evidence: "Prueba Unidad 2",
            taught: true,
          },
        ],
      },
      {
        id: "w18",
        weekNumber: 18,
        dateRange: "13–17 mayo",
        unit: "Unidad 2: Narraciones y comprensión lectora",
        state: "Replanificar",
        suggestion:
          "Adelantar OA7 a esta semana y agregar una guía de refuerzo para OA4 antes de la próxima evaluación.",
        objectives: [
          {
            id: "oa7-w18",
            code: "OA7",
            description:
              "Evaluar información explícita e implícita del texto",
            status: "No enseñado",
            learning: null,
            evidence: "Sin evidencia",
            taught: false,
          },
          {
            id: "oa4-w18",
            code: "OA4",
            description: "Analizar aspectos relevantes de narraciones leídas",
            status: "Requiere refuerzo",
            learning: 38,
            evidence: "Prueba Unidad 2",
            taught: true,
          },
        ],
      },
      {
        id: "w19",
        weekNumber: 19,
        dateRange: "20–24 mayo",
        unit: "Unidad 3: Textos no literarios",
        state: "En riesgo",
        objectives: [
          {
            id: "oa7-w19",
            code: "OA7",
            description:
              "Evaluar información explícita e implícita del texto",
            status: "Planificado",
            learning: null,
            evidence: "Prueba próxima",
            taught: false,
          },
        ],
      },
    ],
  },
  {
    id: "ciencias-6b",
    subject: "Ciencias Naturales",
    courseName: "6° Básico B",
    shortName: "Ciencias 6°B",
    urgency: "Media",
    expectedOAs: 6,
    taughtOAs: 3,
    curricularGap: 3,
    planningProgress: 58,
    learningProgress: 49,
    subtitle: "Planificación anual dinámica · Semana 18 de 38",
    expectedWeekLabel: "Semana 18 de 38",
    expectedVsActual: "OAs esperados: 6 · OAs enseñados: 3",
    highlightReason:
      "Este curso está priorizado porque debería llevar 6 OAs y solo lleva 3.",
    issues: [
      "Debería llevar 6 OAs enseñados y solo lleva 3.",
      "Dos OAs priorizados no tienen evidencia asociada.",
      "La evaluación de la Unidad 1 no está conectada a objetivos específicos.",
      "Falta actividad de refuerzo para contenidos descendidos.",
    ],
    initialChatMessage:
      "Detecté una brecha curricular de 3 OAs y dos vacíos de evidencia. Te conviene conectar la evaluación de la Unidad 1 con objetivos específicos y agregar un refuerzo corto antes del próximo bloque de laboratorio.",
    weeks: [
      {
        id: "w17",
        weekNumber: 17,
        dateRange: "6–10 mayo",
        unit: "Unidad 1: Ecosistemas y redes tróficas",
        state: "Completada",
        objectives: [
          {
            id: "oa3",
            code: "OA3",
            description: "Explicar relaciones entre organismos y ambiente",
            status: "Enseñado",
            learning: 54,
            evidence: "Informe de laboratorio",
            taught: true,
          },
        ],
      },
      {
        id: "w18",
        weekNumber: 18,
        dateRange: "13–17 mayo",
        unit: "Unidad 1: Ecosistemas y redes tróficas",
        state: "En riesgo",
        suggestion:
          "Asociar evidencia a los dos OAs priorizados y agregar un refuerzo breve antes de la evaluación.",
        objectives: [
          {
            id: "oa6",
            code: "OA6",
            description: "Analizar cambios en cadenas alimentarias",
            status: "Planificado",
            learning: null,
            evidence: "Sin evidencia",
            taught: false,
          },
          {
            id: "oa7",
            code: "OA7",
            description: "Relacionar factores humanos y equilibrio ecosistémico",
            status: "No enseñado",
            learning: null,
            evidence: "Sin evidencia",
            taught: false,
          },
        ],
      },
      {
        id: "w19",
        weekNumber: 19,
        dateRange: "20–24 mayo",
        unit: "Unidad 2: Fuerza y movimiento",
        state: "Próxima",
        objectives: [
          {
            id: "oa8",
            code: "OA8",
            description: "Describir efectos de fuerzas en objetos cotidianos",
            status: "Planificado",
            learning: null,
            evidence: "Prueba próxima",
            taught: false,
          },
        ],
      },
    ],
  },
  {
    id: "historia-4a",
    subject: "Historia",
    courseName: "4° Básico A",
    shortName: "Historia 4°A",
    urgency: "Baja",
    expectedOAs: 5,
    taughtOAs: 4,
    curricularGap: 1,
    planningProgress: 71,
    learningProgress: 66,
    subtitle: "Planificación anual dinámica · Semana 18 de 38",
    expectedWeekLabel: "Semana 18 de 38",
    expectedVsActual: "OAs esperados: 5 · OAs enseñados: 4",
    highlightReason:
      "Este curso está levemente bajo lo esperado: debería llevar 5 OAs y lleva 4.",
    issues: [
      "Debería llevar 5 OAs enseñados y lleva 4.",
      "Una semana futura está sobrecargada de objetivos.",
      "Falta asociar una guía a OA9.",
      "El avance está levemente bajo lo esperado.",
    ],
    initialChatMessage:
      "La brecha curricular es baja, pero veo una sobrecarga en una semana futura y una guía faltante para OA9. Conviene ajustar ahora para no acumular riesgo.",
    weeks: [
      {
        id: "w17",
        weekNumber: 17,
        dateRange: "6–10 mayo",
        unit: "Unidad 2: Vida cotidiana colonial",
        state: "Completada",
        objectives: [
          {
            id: "oa5",
            code: "OA5",
            description: "Comparar aspectos de la vida cotidiana colonial",
            status: "Enseñado",
            learning: 69,
            evidence: "Guía comparativa",
            taught: true,
          },
        ],
      },
      {
        id: "w18",
        weekNumber: 18,
        dateRange: "13–17 mayo",
        unit: "Unidad 2: Vida cotidiana colonial",
        state: "Próxima",
        objectives: [
          {
            id: "oa9",
            code: "OA9",
            description: "Relacionar cambios políticos y vida cotidiana",
            status: "Planificado",
            learning: null,
            evidence: "Sin evidencia",
            taught: false,
          },
        ],
      },
      {
        id: "w19",
        weekNumber: 19,
        dateRange: "20–24 mayo",
        unit: "Unidad 3: Organización republicana",
        state: "En riesgo",
        suggestion:
          "Mover uno de los objetivos de esta semana para evitar sobrecarga y agregar una guía a OA9.",
        objectives: [
          {
            id: "oa10",
            code: "OA10",
            description: "Explicar cambios de la organización republicana",
            status: "Planificado",
            learning: null,
            evidence: "Prueba próxima",
            taught: false,
          },
        ],
      },
    ],
  },
  {
    id: "matematica-5a",
    subject: "Matemática",
    courseName: "5° Básico A",
    shortName: "Matemática 5°A",
    urgency: "Baja",
    expectedOAs: 5,
    taughtOAs: 5,
    curricularGap: 0,
    planningProgress: 74,
    learningProgress: 68,
    subtitle: "Planificación anual dinámica · Semana 18 de 38",
    expectedWeekLabel: "Semana 18 de 38",
    expectedVsActual: "OAs esperados: 5 · OAs enseñados: 5",
    highlightReason:
      "Este curso va al día: no requiere corrección inmediata.",
    issues: [
      "El avance curricular está alineado a la fecha.",
      "Conviene monitorear el desempeño del último control.",
    ],
    initialChatMessage:
      "Este plan va al día. Si quieres, puedo ayudarte a revisar aprendizaje o preparar refuerzo específico antes de la próxima evaluación.",
    weeks: [
      {
        id: "w17",
        weekNumber: 17,
        dateRange: "6–10 mayo",
        unit: "Unidad 2: Fracciones y decimales",
        state: "Completada",
        objectives: [
          {
            id: "oa12",
            code: "OA12",
            description: "Resolver problemas con fracciones equivalentes",
            status: "Enseñado",
            learning: 71,
            evidence: "Control 2",
            taught: true,
          },
        ],
      },
      {
        id: "w18",
        weekNumber: 18,
        dateRange: "13–17 mayo",
        unit: "Unidad 2: Fracciones y decimales",
        state: "Próxima",
        objectives: [
          {
            id: "oa13",
            code: "OA13",
            description: "Representar decimales en recta numérica",
            status: "Planificado",
            learning: null,
            evidence: "Guía práctica",
            taught: false,
          },
        ],
      },
    ],
  },
];

export const weeklySchedule: WeeklyBlock[] = [
  { day: "Lunes", time: "08:15", courseId: "lenguaje-5a", shortLabel: "Lenguaje 5°A" },
  { day: "Lunes", time: "10:00", courseId: "ciencias-6b", shortLabel: "Ciencias 6°B" },
  { day: "Lunes", time: "11:45", courseId: "historia-4a", shortLabel: "Historia 4°A" },
  { day: "Martes", time: "08:15", courseId: "lenguaje-5a", shortLabel: "Lenguaje 5°A" },
  { day: "Martes", time: "12:00", courseId: "matematica-5a", shortLabel: "Matemática 5°A" },
  { day: "Miércoles", time: "09:00", courseId: "ciencias-6b", shortLabel: "Ciencias 6°B" },
  { day: "Miércoles", time: "11:00", courseId: "lenguaje-5a", shortLabel: "Lenguaje 5°A" },
  { day: "Jueves", time: "08:15", courseId: "historia-4a", shortLabel: "Historia 4°A" },
  { day: "Jueves", time: "10:00", courseId: "lenguaje-5a", shortLabel: "Lenguaje 5°A" },
  { day: "Viernes", time: "09:45", courseId: "ciencias-6b", shortLabel: "Ciencias 6°B" },
  { day: "Viernes", time: "12:00", courseId: "historia-4a", shortLabel: "Historia 4°A" },
];

export const scheduleDays = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
] as const;

export function getCourseById(courseId: string) {
  return bitacoraCourses.find((course) => course.id === courseId) ?? null;
}

export function getPriorityCourses() {
  return bitacoraCourses
    .filter((course) => course.curricularGap > 0)
    .toSorted((left, right) => right.curricularGap - left.curricularGap);
}
