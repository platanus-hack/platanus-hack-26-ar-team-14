"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import type { CourseRecord, ObjectivePlan, WeekPlan } from "../lib/bitacora-data";
import { getUrgencyTone } from "../lib/bitacora-data";

type ChatMessage = {
  id: string;
  role: "assistant" | "teacher";
  text: string;
};

const quickActions = [
  "Replanificar semana",
  "Subir guía",
  "Subir prueba",
  "Asignar evaluación a OA",
  "Cargar Excel de notas",
  "Generar guía de refuerzo",
] as const;

const quickReplies: Record<(typeof quickActions)[number], string> = {
  "Replanificar semana":
    "Propongo mover OA7 a la semana 18, mantener OA4 como refuerzo y desplazar el inicio de Unidad 3 a la semana 19.",
  "Subir guía":
    "Abrí una carga rápida para asociar una guía al OA priorizado de esta semana.",
  "Subir prueba":
    "Puedo asociar la próxima prueba a OA4 y OA7 para medir refuerzo y cobertura al mismo tiempo.",
  "Asignar evaluación a OA":
    "Te sugiero reasignar la próxima evaluación a OA4 y OA7 para capturar aprendizaje y cobertura en el mismo hito.",
  "Cargar Excel de notas":
    "Preparé una carga mockeada para recalcular aprendizaje promedio por OA desde las notas del curso.",
  "Generar guía de refuerzo":
    "Generé una propuesta de guía de refuerzo para OA4 enfocada en análisis de narraciones. La ubicaría en la semana 18 antes de la próxima evaluación.",
};

const evidenceOptions = [
  "Sin evidencia",
  "Guía Unidad 2",
  "Prueba Unidad 2",
  "Prueba próxima",
  "Guía de refuerzo",
  "Trabajo en clase",
  "Control 2",
  "Informe de laboratorio",
];

const weekStateClassName: Record<WeekPlan["state"], string> = {
  Completada: "bitacora-week-state-completada",
  "En riesgo": "bitacora-week-state-en-riesgo",
  Replanificar: "bitacora-week-state-replanificar",
  Próxima: "bitacora-week-state-proxima",
};

function cloneWeeks(weeks: WeekPlan[]) {
  return weeks.map((week) => ({
    ...week,
    objectives: week.objectives.map((objective) => ({ ...objective })),
  }));
}

export function BitacoraCourseWorkspace({ course }: { course: CourseRecord }) {
  const [weeks, setWeeks] = useState(() => cloneWeeks(course.weeks));
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "initial-agent", role: "assistant", text: course.initialChatMessage },
  ]);
  const [input, setInput] = useState("");
  const [statusText, setStatusText] = useState("Analizando planificación");
  const [modalAction, setModalAction] = useState<string | null>(null);

  const tone = getUrgencyTone(course.urgency);
  const interactiveCounts = useMemo(() => {
    const taught = weeks
      .flatMap((week) => week.objectives)
      .filter((objective) => objective.taught).length;
    const measurable = weeks
      .flatMap((week) => week.objectives)
      .filter((objective) => typeof objective.learning === "number");
    const learning = measurable.length
      ? Math.round(
          measurable.reduce((sum, objective) => sum + (objective.learning ?? 0), 0) /
            measurable.length,
        )
      : course.learningProgress;

    return { taught, learning };
  }, [course.learningProgress, weeks]);

  function appendAssistantReply(text: string) {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-assistant`, role: "assistant", text },
    ]);
  }

  function appendTeacherMessage(text: string) {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-teacher`, role: "teacher", text },
    ]);
  }

  function updateObjective(
    weekId: string,
    objectiveId: string,
    updater: (objective: ObjectivePlan) => ObjectivePlan,
  ) {
    setWeeks((current) =>
      current.map((week) =>
        week.id !== weekId
          ? week
          : {
              ...week,
              objectives: week.objectives.map((objective) =>
                objective.id === objectiveId ? updater(objective) : objective,
              ),
            },
      ),
    );
  }

  function applyWeekSuggestion(weekId: string) {
    startTransition(() => {
      setWeeks((current) =>
        current.map((week) =>
          week.id !== weekId
            ? week
            : {
                ...week,
                state: "Próxima",
                objectives: week.objectives.map((objective) =>
                  objective.code === "OA7"
                    ? {
                        ...objective,
                        status: "Planificado",
                        evidence: "Guía de refuerzo",
                      }
                    : objective,
                ),
              },
        ),
      );
      setStatusText("Sugerencia aplicada");
      appendTeacherMessage("Aplicar sugerencia de replanificación en esta semana.");
      appendAssistantReply(
        "Listo. Moví OA7 para priorizar cobertura en la semana actual y dejé el refuerzo de OA4 preparado con evidencia sugerida.",
      );
    });
  }

  function runQuickAction(action: (typeof quickActions)[number]) {
    appendTeacherMessage(action);
    setStatusText("Actualizando recomendación");

    if (action === "Subir guía" || action === "Subir prueba" || action === "Cargar Excel de notas") {
      setModalAction(action);
    }

    startTransition(() => {
      appendAssistantReply(quickReplies[action]);
    });
  }

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    appendTeacherMessage(text);
    setInput("");
    setStatusText("Procesando nueva consulta");
    startTransition(() => {
      appendAssistantReply(
        "Puedo ayudarte a traducir esa solicitud a cambios de planificación, evidencia o evaluación. Para esta demo, te recomiendo partir por la semana con mayor brecha y por el OA con menor aprendizaje.",
      );
    });
  }

  return (
    <div className="bitacora-shell">
      <div className="bitacora-course-layout">
        <section className="bitacora-surface overflow-hidden">
          <div className="border-b border-slate-200/85 px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <Link href="/" className="bitacora-backlink">
                    ← Volver al dashboard
                  </Link>
                  <div>
                    <p className="bitacora-kicker">{course.subject}</p>
                    <h1 className="font-display text-[clamp(2rem,3vw,3.4rem)] leading-[0.98] tracking-[-0.04em] text-slate-950">
                      {course.courseName}
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">{course.subtitle}</p>
                  </div>
                </div>
                <div
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${tone.surface} ${tone.border} ${tone.accent}`}
                >
                  Brecha prioritaria · {course.curricularGap} OAs
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr_1fr]">
                <article className={`bitacora-metric-card ${tone.surface}`}>
                  <p className="bitacora-kicker">Brecha curricular</p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                      {course.curricularGap}
                    </span>
                    <span className="pb-1 text-sm text-slate-600">OAs faltantes hoy</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{course.highlightReason}</p>
                </article>
                <article className="bitacora-metric-card">
                  <p className="bitacora-kicker">Planificación</p>
                  <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                    {course.planningProgress}%
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Cobertura visible en la planificación anual.
                  </p>
                </article>
                <article className="bitacora-metric-card">
                  <p className="bitacora-kicker">Aprendizaje</p>
                  <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                    {interactiveCounts.learning}%
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Aprendizaje medido sobre OAs con evidencia asociada.
                  </p>
                </article>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{course.expectedVsActual}</span>
                <span>OAs marcados como enseñados en esta vista: {interactiveCounts.taught}</span>
              </div>

              <p className="max-w-3xl text-sm leading-6 text-slate-500">
                El aprendizaje se estima ponderando los objetivos enseñados por el desempeño promedio en evaluaciones asociadas.
              </p>
            </div>
          </div>

          <div className="bitacora-weeks">
            {weeks.map((week) => {
              const hasSuggestion = Boolean(week.suggestion);
              return (
                <details
                  key={week.id}
                  className={`bitacora-week ${week.weekNumber <= 17 ? "bitacora-week-past" : ""}`}
                  open={week.weekNumber <= 18}
                >
                  <summary className="list-none cursor-pointer">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="bitacora-kicker">
                          Semana {week.weekNumber} · {week.dateRange}
                        </p>
                        <h2 className="mt-2 font-display text-2xl leading-tight tracking-[-0.03em] text-slate-950">
                          {week.unit}
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`bitacora-week-state ${weekStateClassName[week.state]}`}
                        >
                          {week.state}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          {hasSuggestion ? "Sugerencia activa" : "Abrir semana"}
                        </span>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-6 grid gap-4">
                    {week.objectives.map((objective) => (
                      <article key={objective.id} className="bitacora-objective">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold tracking-[0.16em] text-white">
                                {objective.code}
                              </span>
                              <span className="text-sm font-medium text-slate-500">{objective.status}</span>
                            </div>
                            <h3 className="max-w-2xl text-base font-medium leading-6 text-slate-900">
                              {objective.description}
                            </h3>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="bitacora-field">
                              <span>Enseñado</span>
                              <input
                                type="checkbox"
                                checked={objective.taught}
                                onChange={(event) =>
                                  updateObjective(week.id, objective.id, (current) => ({
                                    ...current,
                                    taught: event.target.checked,
                                    status: event.target.checked
                                      ? (current.learning ?? 100) < 40
                                        ? "Requiere refuerzo"
                                        : "Enseñado"
                                      : "No enseñado",
                                  }))
                                }
                              />
                            </label>

                            <label className="bitacora-field">
                              <span>Aprendizaje</span>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={objective.learning ?? 0}
                                  onChange={(event) =>
                                    updateObjective(week.id, objective.id, (current) => {
                                      const nextLearning = Number(event.target.value);
                                      return {
                                        ...current,
                                        learning: nextLearning,
                                        status:
                                          current.taught && nextLearning < 40
                                            ? "Requiere refuerzo"
                                            : current.taught
                                              ? "Enseñado"
                                              : current.status,
                                      };
                                    })
                                  }
                                />
                                <span className="w-11 text-right text-sm font-semibold text-slate-700">
                                  {objective.learning === null ? "—" : `${objective.learning}%`}
                                </span>
                              </div>
                            </label>

                            <label className="bitacora-field">
                              <span>Evidencia</span>
                              <select
                                value={objective.evidence}
                                onChange={(event) =>
                                  updateObjective(week.id, objective.id, (current) => ({
                                    ...current,
                                    evidence: event.target.value,
                                  }))
                                }
                              >
                                {evidenceOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      </article>
                    ))}

                    {hasSuggestion ? (
                      <aside className="bitacora-suggestion">
                        <div>
                          <p className="bitacora-kicker">Sugerencia</p>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{week.suggestion}</p>
                        </div>
                        <button
                          type="button"
                          className="bitacora-primary-button"
                          onClick={() => applyWeekSuggestion(week.id)}
                        >
                          Aplicar sugerencia
                        </button>
                      </aside>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <aside className="bitacora-chat-panel">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/85">
              Copiloto pedagógico
            </p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
                Analizando planificación
              </h2>
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.95)]" />
            </div>
            <p className="mt-2 text-sm text-slate-300">{statusText}</p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-4">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                className="bitacora-chip"
                onClick={() => runQuickAction(action)}
              >
                {action}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "assistant"
                    ? "bitacora-message-agent"
                    : "bitacora-message-teacher"
                }
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {message.role === "assistant" ? "Agente" : "Profesor"}
                </p>
                <p
                  className={`whitespace-pre-line text-sm leading-6 ${
                    message.role === "assistant" ? "text-slate-100" : "text-white"
                  }`}
                >
                  {message.text}
                </p>
              </article>
            ))}
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <div className="flex gap-2">
              <button
                type="button"
                className="bitacora-attach-button"
                onClick={() => setModalAction("Adjuntar archivo")}
                aria-label="Adjuntar archivo"
              >
                ＋
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Pregúntale al copiloto cómo corregir esta planificación…"
                className="bitacora-chat-input"
              />
              <button type="button" className="bitacora-send-button" onClick={sendMessage}>
                Enviar
              </button>
            </div>
          </div>
        </aside>
      </div>

      {modalAction ? (
        <div className="bitacora-modal-backdrop" role="presentation" onClick={() => setModalAction(null)}>
          <div
            className="bitacora-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modalAction}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="bitacora-kicker">Acción rápida</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {modalAction}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Esta carga es mockeada para la demo. Al confirmar, el copiloto asume que recibió el archivo y actualiza la recomendación del plan.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="bitacora-primary-button"
                onClick={() => {
                  appendTeacherMessage(`${modalAction}: archivo listo para revisar.`);
                  appendAssistantReply(
                    "Recibí el archivo y lo dejé asociado a la semana prioritaria. Ya puedo usarlo para recalcular aprendizaje o reforzar evidencia.",
                  );
                  setStatusText("Archivo vinculado a la planificación");
                  setModalAction(null);
                }}
              >
                Confirmar carga
              </button>
              <button
                type="button"
                className="bitacora-secondary-button"
                onClick={() => setModalAction(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
