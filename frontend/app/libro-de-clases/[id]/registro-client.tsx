"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningRecord } from "../../actions/libro-de-clases";
import type { Plan } from "../../actions/planificacion";
import { AGENT_NAME } from "../../components/agent-avatar";
import {
	BitacoraChatPanel,
	type BitacoraChatMessage,
	type BitacoraPendingAttachment,
} from "../../components/bitacora-chat-panel";
import { Navbar } from "../../components/navbar";
import { PlanAnualTable } from "../../components/plan-anual-table";
import { ClassRecordsTable } from "./class-records-table";

type Props = {
	teacherName: string;
	record: LearningRecord;
	courseRecords: LearningRecord[];
	plan: Plan | null;
};

const SPANISH_MONTHS = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

const SPANISH_WEEKDAYS = [
	"domingo",
	"lunes",
	"martes",
	"miércoles",
	"jueves",
	"viernes",
	"sábado",
];

function formatLongDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return `${SPANISH_WEEKDAYS[date.getDay()]} ${date.getDate()} de ${SPANISH_MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

function buildClassRecordPrompt(record: LearningRecord, planId: number | null): string {
	const lines = [
		`Class Record ID: ${record.id}.`,
		`Course ID: ${record.course_id}.`,
		`Curso: ${record.course_name}.`,
		`Fecha: ${formatLongDate(record.class_date)}.`,
		`Bloque: ${record.block_number}.`,
	];
	if (planId != null) {
		lines.push(`Plan ID: ${planId}.`);
	}
	if (record.oa_numbers && record.oa_numbers.length > 0) {
		lines.push(`OAs ya registrados: ${record.oa_numbers.join(", ")}.`);
	}
	if (record.observations) {
		lines.push(`Observaciones previas: ${record.observations}`);
	}
	lines.push(
		`Estoy registrando esta clase del ${formatLongDate(record.class_date)}. Salúdame breve y dime que puedo contarte qué hicimos en esta clase por audio o escribiéndolo, y que tú te encargas de dejar el registro en el libro de clases. Importante: NO uses la palabra "hoy" — esta clase pudo haber sido en el pasado. Refiérete siempre como "esta clase" o "la clase". No menciones la fecha ni el bloque, ya están a la vista.`,
	);
	return lines.join(" ");
}

function buildPlanOrGradesPrompt(record: LearningRecord, planId: number): string {
	return [
		`Plan ID: ${planId}.`,
		`Class Record ID: ${record.id}.`,
		`Curso: ${record.course_name}.`,
		"En este chat el docente puede pedir dos cosas y tú decides cuál según lo que escriba:",
		"(1) Registrar calificaciones de esta clase: si dicta o pega notas (ej. \"Sofía 6.2, Mateo 5.5\"), repítelas en una tabla compacta nombre · nota para confirmar, valida rango chileno 1.0–7.0, no inventes nombres ni notas, y pregunta antes de seguir si algo no calza con el curso.",
		`(2) Modificar la planificación anual: si pide ajustes al plan, carga el plan con \`listar_plan(${planId})\`, propone correcciones en texto y espera confirmación antes de tocarlo con \`crear_item_plan\`, \`actualizar_item_plan\` o \`eliminar_item_plan\`. No reescribas el plan en prosa: el frontend lo recarga desde la base de datos.`,
		"Salúdame breve y dime que puedo dictarte calificaciones de esta clase o pedirte ajustes a la planificación, lo que necesite. No asumas cuál de las dos antes de que el docente lo aclare.",
	].join(" ");
}

type Msg = BitacoraChatMessage;
type PendingAttachment = BitacoraPendingAttachment;

type ChatStream = {
	messages: Msg[];
	busy: boolean;
	error: string | null;
	input: string;
	setInput: (v: string) => void;
	pendingFiles: PendingAttachment[];
	addFiles: (files: File[]) => void;
	removePendingFile: (id: string) => void;
	submit: () => void;
};

function useChatStream(
	initialPrompt: string,
	resetKey: string | number,
	refreshOnTurn: boolean,
): ChatStream {
	const router = useRouter();
	const [messages, setMessages] = useState<Msg[]>([]);
	const [busy, setBusy] = useState(false);
	const [input, setInput] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
	const [error, setError] = useState<string | null>(null);
	const initializedKeyRef = useRef<string | number | null>(null);
	const abortRef = useRef<AbortController | null>(null);

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

	const streamReply = useCallback(
		async (history: Msg[], filesToSend: File[]) => {
			setBusy(true);
			const ctrl = new AbortController();
			abortRef.current = ctrl;
			const assistantId = crypto.randomUUID();
			setMessages((prev) => [
				...prev,
				{ id: assistantId, role: "assistant", text: "" },
			]);
			try {
				const formData = new FormData();
				formData.append(
					"messages",
					JSON.stringify(
						history.map((m) => ({
							role: m.role === "teacher" ? "user" : "assistant",
							content: m.transportText ?? m.text,
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
					setMessages((prev) =>
						prev.map((m) =>
							m.id === assistantId ? { ...m, text: m.text + chunk } : m,
						),
					);
				}
				if (refreshOnTurn) router.refresh();
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				setError(err instanceof Error ? err.message : String(err));
				setMessages((prev) =>
					prev.filter((message) => message.id !== assistantId || message.text),
				);
			} finally {
				setBusy(false);
				abortRef.current = null;
			}
		},
		[router, refreshOnTurn],
	);

	useEffect(() => {
		if (initializedKeyRef.current === resetKey) return;
		initializedKeyRef.current = resetKey;
		abortRef.current?.abort();
		setError(null);
		setInput("");
		setPendingFiles([]);
		if (!initialPrompt) {
			setMessages([]);
			return;
		}
		const first: Msg = {
			id: crypto.randomUUID(),
			role: "teacher",
			text: initialPrompt,
			hidden: true,
		};
		setMessages([first]);
		void streamReply([first], []);
	}, [resetKey, initialPrompt, streamReply]);

	function submit() {
		const text = input.trim();
		const filesToSend = pendingFiles.map((file) => file.file);
		if ((!text && filesToSend.length === 0) || busy) return;
		const next: Msg = {
			id: crypto.randomUUID(),
			role: "teacher",
			text: text || "Revisa estos archivos adjuntos.",
			attachments: filesToSend.map((file) => ({ name: file.name })),
		};
		const history = [...messages, next];
		setMessages(history);
		setInput("");
		setPendingFiles([]);
		void streamReply(history, filesToSend);
	}

	return {
		messages,
		busy,
		error,
		input,
		setInput,
		pendingFiles,
		addFiles,
		removePendingFile,
		submit,
	};
}

type TabId = "libro" | "planificacion";

export function RegistroClient({
	teacherName,
	record,
	courseRecords,
	plan,
}: Props) {
	const router = useRouter();
	const [tab, setTab] = useState<TabId>("libro");

	const registro = useChatStream(
		buildClassRecordPrompt(record, plan?.id ?? null),
		`registro-${record.id}`,
		true,
	);
	const planificacion = useChatStream(
		plan ? buildPlanOrGradesPrompt(record, plan.id) : "",
		`plan-${record.id}-${plan?.id ?? "none"}`,
		true,
	);

	const tabs: { id: TabId; label: string; available: boolean }[] = [
		{ id: "libro", label: "Libro de clases", available: true },
		{ id: "planificacion", label: "Planificación", available: plan !== null },
	];

	return (
		<main
			className="bitacora-dashboard-shell"
			style={{ maxWidth: "min(100vw - 48px, 1280px)" }}
		>
			<Navbar teacherName={teacherName} active="cuaderno" />

			<div className="mb-4">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
				>
					<ArrowLeft size={14} strokeWidth={2.5} />
					Volver al cuaderno
				</Link>
			</div>

			<header className="mb-6">
				<span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#9a5a00]">
					Libro de clases
				</span>
				<h1 className="mt-1 font-display text-[clamp(1.4rem,2.4vw,2rem)] leading-[1] tracking-[-0.03em] text-slate-950">
					Registro de clase
				</h1>
				<p className="mt-2 text-sm text-slate-600">
					{record.course_name} ·{" "}
					<span className="capitalize">{formatLongDate(record.class_date)}</span>
				</p>
			</header>

			<nav
				role="tablist"
				aria-label="Vistas del registro"
				className="mb-4 flex flex-wrap gap-1 border-b border-slate-200"
			>
				{tabs
					.filter((t) => t.available)
					.map((t) => {
						const active = tab === t.id;
						return (
							<button
								key={t.id}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setTab(t.id)}
								className={`relative -mb-px px-4 py-2 text-sm font-medium transition-colors ${
									active
										? "text-slate-900"
										: "text-slate-500 hover:text-slate-800"
								}`}
							>
								{t.label}
								{active && (
									<span className="absolute inset-x-2 -bottom-px h-0.5 bg-[#9a5a00]" />
								)}
							</button>
						);
					})}
			</nav>

			<div
				role="tabpanel"
				hidden={tab !== "libro"}
				className="grid h-[calc(100vh-320px)] min-h-[600px] gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(360px,1fr)]"
			>
				<ClassRecordsTable
					records={courseRecords}
					currentRecordId={record.id}
					onAfterSave={() => router.refresh()}
				/>
				<BitacoraChatPanel
					title={AGENT_NAME}
					messages={registro.messages}
					busy={registro.busy}
					error={registro.error}
					input={registro.input}
					onInputChange={registro.setInput}
					onSubmit={registro.submit}
					pendingFiles={registro.pendingFiles}
					onAddFiles={registro.addFiles}
					onRemovePendingFile={registro.removePendingFile}
					placeholder="Mensaje a Bita…"
					teacherName={teacherName}
					assistantName="Bita"
				/>
			</div>

			{plan && (
				<div
					role="tabpanel"
					hidden={tab !== "planificacion"}
					className="grid h-[calc(100vh-320px)] min-h-[600px] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]"
				>
					<PlanAnualTable plan={plan} />
					<BitacoraChatPanel
						title="Calificaciones o plan"
						subtitle="Dícta notas de esta clase o pide ajustes a la planificación; el agente decide según lo que escribas."
						messages={planificacion.messages}
						busy={planificacion.busy}
						error={planificacion.error}
						input={planificacion.input}
						onInputChange={planificacion.setInput}
						onSubmit={planificacion.submit}
						pendingFiles={planificacion.pendingFiles}
						onAddFiles={planificacion.addFiles}
						onRemovePendingFile={planificacion.removePendingFile}
						placeholder={"Ej.: Sofía 6.2, Mateo 5.5… o \"mueve OA8 a junio\""}
						teacherName={teacherName}
						assistantName="Bita"
					/>
				</div>
			)}
		</main>
	);
}
