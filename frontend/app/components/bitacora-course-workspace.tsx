"use client";

import { Mic, SendHorizontal } from "lucide-react";
import Link from "next/link";
import {
	type CSSProperties,
	useCallback,
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
	CourseRecord,
	ObjectivePlan,
	WeekPlan,
} from "../lib/bitacora-data";
import { getUrgencyTone } from "../lib/bitacora-data";

type AgentContext = {
	backendCourseId: number;
	backendCourseName: string;
	planId: number;
};

type ChatMessage = {
	id: string;
	role: "assistant" | "teacher";
	text: string;
	transportText?: string;
	attachments?: { name: string }[];
	hidden?: boolean;
};

type PendingAttachment = {
	id: string;
	file: File;
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

const markdownComponents: Components = {
	p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
	ul: ({ children }) => (
		<ul className="my-2 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="my-2 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>
	),
	li: ({ children }) => <li className="my-0.5">{children}</li>,
	strong: ({ children }) => (
		<strong className="font-semibold text-slate-950">{children}</strong>
	),
	em: ({ children }) => <em className="italic">{children}</em>,
	code: ({ children }) => (
		<code className="rounded bg-[#f4efe6] px-1 py-0.5 font-mono text-[0.9em] text-[#6a4936]">
			{children}
		</code>
	),
};

const FILE_ACCEPT =
	".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown,.csv,.xlsx";
const COMPOSER_MIN_HEIGHT = 44;
const COMPOSER_MAX_HEIGHT = 138;

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
		"y responde como copiloto pedagógico con foco en el curso, no como UTP genérico.",
		"Explica primero los problemas prioritarios y luego sugiere acciones concretas para la semana más urgente.",
		"No reescribas el plan completo en prosa; usa la información del plan y del contexto del curso para priorizar correcciones.",
	].join(" ");
}

function renderAssistantBlocks(text: string) {
	const blocks: {
		key: string;
		kind: "tool" | "md";
		text: string;
		count?: number;
	}[] = [];
	const buffer: string[] = [];
	const blockCounts = new Map<string, number>();
	const makeKey = (kind: "tool" | "md", value: string) => {
		const base = `${kind}:${value}`;
		const count = (blockCounts.get(base) ?? 0) + 1;
		blockCounts.set(base, count);
		return `${base}:${count}`;
	};
	const flush = () => {
		const md = buffer.join("\n").trim();
		buffer.length = 0;
		if (md) blocks.push({ key: makeKey("md", md), kind: "md", text: md });
	};

	for (const line of text.split("\n")) {
		if (line.startsWith("✓")) {
			flush();
			continue;
		}
		if (line.startsWith("⏳")) {
			flush();
			const toolText = line.replace(/^⏳\s*/, "");
			const last = blocks[blocks.length - 1];
			if (last?.kind === "tool" && last.text === toolText) {
				last.count = (last.count ?? 1) + 1;
			} else {
				blocks.push({
					key: makeKey("tool", toolText),
					kind: "tool",
					text: toolText,
					count: 1,
				});
			}
			continue;
		}
		buffer.push(line);
	}
	flush();
	return blocks;
}

function AssistantBody({ text }: { text: string }) {
	const blocks = useMemo(() => renderAssistantBlocks(text), [text]);
	return (
		<div className="flex flex-col gap-2">
			{blocks.map((block) =>
				block.kind === "tool" ? (
					<p
						key={block.key}
						className="inline-flex w-fit items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[11px] font-medium text-slate-300"
					>
						<span>{block.text}</span>
						{(block.count ?? 1) > 1 ? (
							<span className="rounded-full bg-white/10 px-1.5 text-[10px] text-slate-200">
								×{block.count}
							</span>
						) : null}
					</p>
				) : (
					<ReactMarkdown
						key={block.key}
						remarkPlugins={[remarkGfm]}
						components={markdownComponents}
					>
						{block.text}
					</ReactMarkdown>
				),
			)}
		</div>
	);
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
	const [isDraggingFiles, setIsDraggingFiles] = useState(false);
	const [composerHeight, setComposerHeight] = useState(COMPOSER_MIN_HEIGHT);

	const startedRef = useRef(false);
	const abortRef = useRef<AbortController | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
	const messageCount = messages.length;

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		if (!busy && messageCount === 0) return;
		el.scrollTop = el.scrollHeight;
	}, [busy, messageCount]);

	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "0px";
		const nextHeight = Math.min(
			COMPOSER_MAX_HEIGHT,
			Math.max(COMPOSER_MIN_HEIGHT, el.scrollHeight),
		);
		el.style.height = `${nextHeight}px`;
		el.style.overflowY =
			el.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
		setComposerHeight(nextHeight);
	});

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

	function addFiles(fileList: FileList | File[]) {
		const next = Array.from(fileList).map((file) => ({
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

	const showSendButton = input.length > 0 || pendingFiles.length > 0;

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

				<aside className="bitacora-chat-panel">
					<div className="border-b border-slate-200/80 px-5 py-5">
						<h2 className="bitacora-chat-title">Copiloto pedagógico</h2>
					</div>

					<div
						ref={scrollRef}
						className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
					>
						{messages
							.filter(
								(message) =>
									!message.hidden &&
									!(message.role === "assistant" && message.text.length === 0),
							)
							.map((message) => (
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
								{message.attachments?.length ? (
									<div className="mb-3 flex flex-wrap gap-2">
										{message.attachments.map((attachment) => (
											<span
												key={attachment.name}
												className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500"
											>
												{attachment.name}
											</span>
										))}
									</div>
								) : null}
								{message.role === "assistant" ? (
									<AssistantBody text={message.text} />
								) : (
									<p className="whitespace-pre-wrap text-sm leading-6 text-[#7a3125]">
										{message.text}
									</p>
								)}
							</article>
						))}

						{busy ? (
							<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
								Pensando…
							</div>
						) : null}

						{error ? (
							<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
								{error}
							</pre>
						) : null}
					</div>

					<div className="border-t border-slate-200/80 px-5 py-4">
						<fieldset
							className={`bitacora-chat-composer ${isDraggingFiles ? "bitacora-chat-composer-drag" : ""}`}
							aria-label="Editor del chat con zona para arrastrar archivos"
							onDragEnter={(event) => {
								event.preventDefault();
								setIsDraggingFiles(true);
							}}
							onDragOver={(event) => event.preventDefault()}
							onDragLeave={(event) => {
								event.preventDefault();
								if (event.currentTarget.contains(event.relatedTarget as Node)) {
									return;
								}
								setIsDraggingFiles(false);
							}}
							onDrop={(event) => {
								event.preventDefault();
								setIsDraggingFiles(false);
								if (event.dataTransfer.files.length > 0) {
									addFiles(event.dataTransfer.files);
								}
							}}
						>
							<input
								ref={fileInputRef}
								type="file"
								accept={FILE_ACCEPT}
								multiple
								className="hidden"
								onChange={(event) => {
									if (event.target.files?.length) {
										addFiles(event.target.files);
										event.target.value = "";
									}
								}}
							/>

							{pendingFiles.length > 0 ? (
								<div className="mb-3 flex flex-wrap gap-2">
									{pendingFiles.map((file) => (
										<span
											key={file.id}
											className="bitacora-file-pill"
										>
											{file.file.name}
											<button
												type="button"
												onClick={() => removePendingFile(file.id)}
												aria-label={`Quitar ${file.file.name}`}
											>
												×
											</button>
										</span>
									))}
								</div>
							) : null}

							<div
								className="bitacora-chat-composer-row"
								style={
									{
										"--bitacora-composer-height": `${composerHeight}px`,
									} as CSSProperties
								}
							>
								<textarea
									ref={textareaRef}
									value={input}
									onChange={(event) => setInput(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											void onSubmit();
										}
									}}
									rows={1}
									placeholder="Mensaje…"
									className="bitacora-chat-input bitacora-chat-textarea"
								/>
								<div className="bitacora-chat-controls-left">
									<button
										type="button"
										className="bitacora-attach-button"
										onClick={() => fileInputRef.current?.click()}
										aria-label="Adjuntar archivo"
									>
										＋
									</button>
								</div>
								{showSendButton ? (
									<button
										type="button"
										className="bitacora-send-button"
										onClick={() => void onSubmit()}
										disabled={busy}
										aria-label="Enviar mensaje"
									>
										<SendHorizontal size={15} strokeWidth={2.2} />
									</button>
								) : (
									<button
										type="button"
										className="bitacora-send-button bitacora-send-button-mic"
										aria-label="Enviar audio"
										title="Enviar audio"
									>
										<Mic size={16} strokeWidth={2.2} />
									</button>
								)}
							</div>
						</fieldset>
					</div>
				</aside>
			</div>
		</div>
	);
}
