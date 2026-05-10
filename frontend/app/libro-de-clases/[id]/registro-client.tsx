"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type FormEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LearningRecord } from "../../actions/libro-de-clases";
import { AGENT_NAME, AgentAvatar } from "../../components/agent-avatar";
import { Navbar } from "../../components/navbar";
import { ClassRecordsTable } from "./class-records-table";

type Props = {
	teacherName: string;
	record: LearningRecord;
	courseRecords: LearningRecord[];
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

function buildClassRecordPrompt(record: LearningRecord): string {
	const lines = [
		`Class Record ID: ${record.id}.`,
		`Curso: ${record.course_name}.`,
		`Fecha: ${formatLongDate(record.class_date)}.`,
		`Bloque: ${record.block_number}.`,
	];
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
		<strong className="font-semibold text-slate-900">{children}</strong>
	),
	em: ({ children }) => <em className="italic">{children}</em>,
	code: ({ children }) => (
		<code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em]">
			{children}
		</code>
	),
};

function Markdown({ text }: { text: string }) {
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
			{text}
		</ReactMarkdown>
	);
}

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; text: string };

export function RegistroClient({
	teacherName,
	record,
	courseRecords,
}: Props) {
	const router = useRouter();
	const [messages, setMessages] = useState<Msg[]>([]);
	const [busy, setBusy] = useState(false);
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const startedRef = useRef(false);
	const abortRef = useRef<AbortController | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	const lastTextLength = messages.reduce((a, m) => a + m.text.length, 0);
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [messages.length, lastTextLength, busy]);

	async function streamReply(history: Msg[]) {
		setBusy(true);
		const ctrl = new AbortController();
		abortRef.current = ctrl;
		const body = {
			messages: history.map((m) => ({ role: m.role, content: m.text })),
		};
		const assistantId = crypto.randomUUID();
		setMessages((prev) => [
			...prev,
			{ id: assistantId, role: "assistant", text: "" },
		]);
		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
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
			router.refresh();
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
			abortRef.current = null;
		}
	}

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		const first: Msg = {
			id: crypto.randomUUID(),
			role: "user",
			text: buildClassRecordPrompt(record),
		};
		setMessages([first]);
		void streamReply([first]);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [record.id]);

	function onSendFollowup(e: FormEvent) {
		e.preventDefault();
		const text = input.trim();
		if (!text || busy) return;
		const next: Msg = { id: crypto.randomUUID(), role: "user", text };
		const history = [...messages, next];
		setMessages(history);
		setInput("");
		void streamReply(history);
	}

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
					<span className="capitalize">
						{formatLongDate(record.class_date)}
					</span>
				</p>
			</header>

			<div className="grid h-[calc(100vh-260px)] min-h-[640px] gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(360px,1fr)]">
				<ClassRecordsTable
					records={courseRecords}
					currentRecordId={record.id}
					onAfterSave={() => router.refresh()}
				/>

				<article className="bitacora-card flex min-h-0 flex-col overflow-hidden p-0">
					<header className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-3">
						<AgentAvatar size="sm" />
						<p className="text-sm font-semibold text-slate-900">{AGENT_NAME}</p>
					</header>

					<div
						ref={scrollRef}
						className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
					>
						{messages
							.filter(
								(m) =>
									!(m.role === "user" && m.text.startsWith("Class Record ID:")),
							)
							.map((m) => (
								<MessageView key={m.id} role={m.role}>
									<AssistantText text={m.text} role={m.role} />
								</MessageView>
							))}

						{busy &&
						(messages.length === 0 ||
							messages[messages.length - 1].text === "") ? (
							<MessageView role="assistant">
								<ThinkingDots />
							</MessageView>
						) : null}

						{error ? (
							<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
								{error}
							</pre>
						) : null}
					</div>

					<form
						onSubmit={onSendFollowup}
						className="border-t border-slate-200/70 px-5 py-4"
					>
						<div className="flex items-end gap-2">
							<textarea
								rows={2}
								value={input}
								onChange={(ev) => setInput(ev.target.value)}
								placeholder="Mensaje a Bita…"
								disabled={busy}
								className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm leading-relaxed text-slate-800 focus:border-slate-400 focus:outline-none disabled:opacity-60"
							/>
							<button
								type="submit"
								disabled={busy || !input.trim()}
								className="bitacora-primary-button"
							>
								Enviar
							</button>
						</div>
					</form>
				</article>
			</div>
		</main>
	);
}

function MessageView({
	role,
	children,
}: {
	role: Role;
	children: React.ReactNode;
}) {
	if (role === "user") {
		return (
			<div className="self-end max-w-[90%] rounded-2xl bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white">
				{children}
			</div>
		);
	}
	return (
		<div className="flex w-full items-start gap-3">
			<AgentAvatar size="sm" />
			<div className="min-w-0 flex-1 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm leading-relaxed text-slate-800">
				{children}
			</div>
		</div>
	);
}

function renderAssistantText(text: string) {
	const blocks: { kind: "tool" | "md"; text: string; count?: number }[] = [];
	const buf: string[] = [];
	const flush = () => {
		const md = buf.join("\n").trim();
		buf.length = 0;
		if (md) blocks.push({ kind: "md", text: md });
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
			if (last && last.kind === "tool" && last.text === toolText) {
				last.count = (last.count ?? 1) + 1;
			} else {
				blocks.push({ kind: "tool", text: toolText });
			}
		} else {
			buf.push(line);
		}
	}
	flush();
	return blocks;
}

function AssistantText({ text, role }: { text: string; role: Role }) {
	const blocks = useMemo(() => renderAssistantText(text), [text]);
	if (role === "user") {
		const trimmed = text.startsWith("Class Record ID:")
			? "Registro iniciado."
			: text;
		return <p className="whitespace-pre-wrap">{trimmed}</p>;
	}
	return (
		<div className="flex flex-col gap-1.5">
			{blocks.map((b, i) =>
				b.kind === "tool" ? (
					<p
						key={i}
						className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-500"
					>
						<span>{b.text}</span>
						{b.count && b.count > 1 ? (
							<span className="rounded-full bg-slate-200 px-1.5 text-[10px] tabular-nums text-slate-600">
								×{b.count}
							</span>
						) : null}
					</p>
				) : (
					<Markdown key={i} text={b.text} />
				),
			)}
		</div>
	);
}

function ThinkingDots() {
	return (
		<span className="inline-flex gap-1">
			<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
			<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
			<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
		</span>
	);
}
