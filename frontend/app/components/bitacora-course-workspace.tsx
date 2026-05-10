"use client";

import Link from "next/link";
import {
	useCallback,
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	CourseRecord,
	ObjectivePlan,
	WeekPlan,
} from "../lib/bitacora-data";
import { getUrgencyTone } from "../lib/bitacora-data";
import {
	BitacoraChatPanel,
	type BitacoraChatMessage,
	type BitacoraPendingAttachment,
} from "./bitacora-chat-panel";

type AgentContext = {
	backendCourseId: number;
	backendCourseName: string;
	planId: number;
};

type ChatMessage = BitacoraChatMessage;
type PendingAttachment = BitacoraPendingAttachment;

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

function buildInitialPrompt(course: CourseRecord, agentContext: AgentContext) {
	return [
		`Plan ID: ${agentContext.planId}.`,
		`Curso backend: ${agentContext.backendCourseName}.`,
		`Curso visible: ${course.subject} ${course.courseName}.`,
		`Brecha curricular actual: ${course.curricularGap} OAs; debería llevar ${course.expectedOAs} y lleva ${course.taughtOAs}.`,
		`Planificación ${course.planningProgress}% y aprendizaje ${course.learningProgress}%.`,
		`Carga el plan con listar_plan(${agentContext.planId}), audita cobertura, secuencia y factibilidad de la planificación,`,
		"y responde con foco en este curso específico, no de manera genérica.",
		"Explica primero los problemas prioritarios y luego sugiere acciones concretas para la semana más urgente.",
		"No reescribas el plan completo en prosa; usa la información del plan y del contexto del curso para priorizar correcciones.",
	].join(" ");
}

export function BitacoraCourseWorkspace({
	course,
	agentContext,
}: {
	course: CourseRecord;
	agentContext: AgentContext;
}) {
	const neutralTone = {
		border: "border-slate-200/90",
		surface: "bg-slate-50",
		accent: "text-slate-500",
	};
	const [weeks, setWeeks] = useState(() => cloneWeeks(course.weeks));
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const startedRef = useRef(false);
	const abortRef = useRef<AbortController | null>(null);

	const tone =
		course.curricularGap > 0 ? getUrgencyTone(course.urgency) : neutralTone;
	const interactiveCounts = useMemo(() => {
		const taught = weeks
			.flatMap((week) => week.objectives)
			.filter((objective) => objective.taught).length;
		const measurable = weeks
			.flatMap((week) => week.objectives)
			.filter((objective) => typeof objective.learning === "number");
		const learning = measurable.length
			? Math.round(
					measurable.reduce(
						(sum, objective) => sum + (objective.learning ?? 0),
						0,
					) / measurable.length,
				)
			: course.learningProgress;

		return { taught, learning };
	}, [course.learningProgress, weeks]);

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
		});
		void submitPrompt(
			"Aplicar sugerencia",
			"Aplica la sugerencia de replanificación más urgente y explícame qué cambió en el plan.",
		);
	}

	function addFiles(files: File[]) {
		const next = files.map((file) => ({
			id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
			file,
		}));
		setPendingFiles((current) => [...current, ...next]);
	}

	function removePendingFile(fileId: string) {
		setPendingFiles((current) => current.filter((file) => file.id !== fileId));
	}

	const streamReply = useCallback(async function streamReply(
		history: ChatMessage[],
		filesToSend: File[],
	) {
		setBusy(true);
		setError(null);
		const ctrl = new AbortController();
		abortRef.current = ctrl;
		const assistantId = crypto.randomUUID();
		setMessages((current) => [
			...current,
			{ id: assistantId, role: "assistant", text: "" },
		]);

		try {
			const formData = new FormData();
			formData.append(
				"messages",
				JSON.stringify(
					history.map((message) => ({
						role: message.role === "teacher" ? "user" : "assistant",
						content: message.transportText ?? message.text,
					})),
				),
			);
			for (const file of filesToSend) {
				formData.append("files", file);
			}

			const res = await fetch("/api/chat", {
				method: "POST",
				body: formData,
				signal: ctrl.signal,
			});
			if (!res.ok || !res.body) {
				throw new Error(`${res.status}: ${await res.text()}`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				setMessages((current) =>
					current.map((message) =>
						message.id === assistantId
							? { ...message, text: message.text + chunk }
							: message,
					),
				);
			}
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			setError(err instanceof Error ? err.message : String(err));
			setMessages((current) =>
				current.filter((message) => message.id !== assistantId || message.text),
			);
		} finally {
			setBusy(false);
			abortRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		const firstMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "teacher",
			text: buildInitialPrompt(course, agentContext),
			hidden: true,
		};
		setMessages([firstMessage]);
		void streamReply([firstMessage], []);
	}, [agentContext, course, streamReply]);

	async function submitPrompt(
		text: string,
		transportText = text,
		filesToSend = pendingFiles.map((file) => file.file),
	) {
		if ((!text.trim() && filesToSend.length === 0) || busy) return;
		const nextMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "teacher",
			text: text.trim() || "Revisa estos archivos adjuntos.",
			transportText,
			attachments: filesToSend.map((file) => ({ name: file.name })),
		};
		const history = [...messages, nextMessage];
		setMessages(history);
		setInput("");
		setPendingFiles([]);
		await streamReply(history, filesToSend);
	}

	function onSubmit() {
		return submitPrompt(input);
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
										<p className="mt-2 text-sm text-slate-600">
											{course.subtitle}
										</p>
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
										<span className="pb-1 text-sm text-slate-600">
											OAs faltantes hoy
										</span>
									</div>
									<p className="mt-4 text-sm leading-6 text-slate-600">
										{course.highlightReason}
									</p>
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
								<span className="font-medium text-slate-900">
									{course.expectedVsActual}
								</span>
								<span>
									OAs marcados como enseñados en esta vista:{" "}
									{interactiveCounts.taught}
								</span>
							</div>

							<p className="max-w-3xl text-sm leading-6 text-slate-500">
								El aprendizaje se estima ponderando los objetivos enseñados por
								el desempeño promedio en evaluaciones asociadas.
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
											<article
												key={objective.id}
												className="bitacora-objective"
											>
												<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
													<div className="space-y-2">
														<div className="flex flex-wrap items-center gap-2">
															<span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold tracking-[0.16em] text-white">
																{objective.code}
															</span>
															<span className="text-sm font-medium text-slate-500">
																{objective.status}
															</span>
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
																	updateObjective(
																		week.id,
																		objective.id,
																		(current) => ({
																			...current,
																			taught: event.target.checked,
																			status: event.target.checked
																				? (current.learning ?? 100) < 40
																					? "Requiere refuerzo"
																					: "Enseñado"
																				: "No enseñado",
																		}),
																	)
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
																		updateObjective(
																			week.id,
																			objective.id,
																			(current) => {
																				const nextLearning = Number(
																					event.target.value,
																				);
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
																			},
																		)
																	}
																/>
																<span className="w-11 text-right text-sm font-semibold text-slate-700">
																	{objective.learning === null
																		? "—"
																		: `${objective.learning}%`}
																</span>
															</div>
														</label>

														<label className="bitacora-field">
															<span>Evidencia</span>
															<select
																value={objective.evidence}
																onChange={(event) =>
																	updateObjective(
																		week.id,
																		objective.id,
																		(current) => ({
																			...current,
																			evidence: event.target.value,
																		}),
																	)
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
													<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
														{week.suggestion}
													</p>
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

				<BitacoraChatPanel
					title="Copiloto pedagógico"
					messages={messages}
					busy={busy}
					error={error}
					input={input}
					onInputChange={setInput}
					onSubmit={() => void onSubmit()}
					pendingFiles={pendingFiles}
					onAddFiles={addFiles}
					onRemovePendingFile={removePendingFile}
				/>
			</div>
		</div>
	);
}
