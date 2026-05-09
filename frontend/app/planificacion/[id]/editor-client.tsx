"use client";

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
import {
	getPlanificacionAction,
	type Plan,
} from "../../actions/planificacion";

const markdownComponents: Components = {
	p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
	ul: ({ children }) => (
		<ul className="my-2 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="my-2 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>
	),
	li: ({ children }) => <li className="my-0.5">{children}</li>,
	h1: ({ children }) => (
		<h1 className="font-display mt-4 mb-2 text-[22px] leading-tight first:mt-0">
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2 className="font-display mt-4 mb-2 text-[18px] leading-tight first:mt-0">
			{children}
		</h2>
	),
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

function buildReviewPrompt(planId: number): string {
	return [
		`Plan ID: ${planId}.`,
		"Estás en una audiencia UTP sobre la planificación anual de Matemática 5° básico.",
		"Carga el plan con `listar_plan(" + planId + ")`, audita cobertura de los 27 OA,",
		"ubicación por unidad, OA mal escritos, y factibilidad por mes con `clases_en_mes`.",
		"Propón las correcciones en texto y espera mi confirmación antes de tocar el plan",
		"con `crear_item_plan`, `actualizar_item_plan` o `eliminar_item_plan`.",
		"No reescribas el plan en prosa: el frontend lo recarga desde la base de datos.",
		"Cierra con la sección # Correcciones según tu formato.",
	].join(" ");
}

export function EditorClient({ initialPlan }: { initialPlan: Plan }) {
	const router = useRouter();
	const [plan, setPlan] = useState<Plan>(initialPlan);
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
			try {
				const fresh = await getPlanificacionAction(plan.id);
				setPlan(fresh);
			} catch {
				// best-effort refresh — agent might not have edited
			}
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
			text: buildReviewPrompt(plan.id),
		};
		setMessages([first]);
		void streamReply([first]);
	}, [plan.id]);

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

	function onBack() {
		abortRef.current?.abort();
		router.push("/planificacion");
	}

	return (
		<div className="grid h-[calc(100vh-260px)] min-h-[640px] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
			<PlanTable plan={plan} onBack={onBack} />

			<article className="bitacora-card flex min-h-0 flex-col overflow-hidden p-0">
				<header className="border-b border-slate-200/70 px-5 py-4">
					<p className="bitacora-kicker">Audiencia UTP · en vivo</p>
					<p className="mt-1 text-sm text-slate-600">
						El agente edita el plan directamente. La tabla se recarga al final
						de cada turno.
					</p>
				</header>

				<div
					ref={scrollRef}
					className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
				>
					{messages.map((m) => (
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
							placeholder="Pide aclaraciones o un ajuste específico…"
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
	);
}

function PlanTable({ plan, onBack }: { plan: Plan; onBack: () => void }) {
	return (
		<article className="bitacora-card flex min-h-0 flex-col overflow-hidden p-0">
			<header className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
				<div className="min-w-0">
					<p className="bitacora-kicker">Plan #{plan.id}</p>
					<p className="truncate text-sm font-semibold text-slate-900">
						{plan.name}
					</p>
					<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
						{plan.asignatura ? <span>{plan.asignatura}</span> : null}
						{plan.curso ? <span>· {plan.curso}</span> : null}
						{plan.anio ? <span>· {plan.anio}</span> : null}
						{plan.docente ? <span>· {plan.docente}</span> : null}
					</div>
				</div>
				<button
					type="button"
					onClick={onBack}
					className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
				>
					Volver
				</button>
			</header>

			<div className="min-h-0 flex-1 overflow-auto">
				<table className="w-full border-collapse text-[13px]">
					<thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
						<tr>
							<th className="border-b border-slate-200 px-4 py-2.5">Unidad</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Mes</th>
							<th className="border-b border-slate-200 px-4 py-2.5">OA</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Objetivo</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Clases</th>
						</tr>
					</thead>
					<tbody>
						{plan.items.map((item) => (
							<tr key={item.id} className="align-top hover:bg-slate-50/60">
								<td className="border-b border-slate-100 px-4 py-2.5 font-medium text-slate-800">
									{item.unidad ?? "—"}
								</td>
								<td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">
									{item.mes ?? "—"}
								</td>
								<td className="border-b border-slate-100 px-4 py-2.5">
									<div className="flex flex-wrap gap-1">
										{item.oa_codes.length === 0 ? (
											<span className="text-slate-400">—</span>
										) : (
											item.oa_codes.map((code) => (
												<span
													key={code}
													className="rounded-full border border-vermilion/30 bg-vermilion/5 px-2 py-0.5 text-[11px] font-semibold text-vermilion"
												>
													{code}
												</span>
											))
										)}
									</div>
								</td>
								<td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">
									{item.objetivo}
								</td>
								<td className="border-b border-slate-100 px-4 py-2.5 text-right text-slate-700 tabular-nums">
									{item.cantidad_clases ?? "—"}
								</td>
							</tr>
						))}
						{plan.items.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-center text-slate-500">
									Sin filas. Pide al agente que agregue OA con `crear_item_plan`.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
		</article>
	);
}

function MessageView({
	role,
	children,
}: {
	role: Role;
	children: React.ReactNode;
}) {
	const isUser = role === "user";
	return (
		<div
			className={
				isUser
					? "self-end max-w-[90%] rounded-2xl bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white"
					: "self-start w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm leading-relaxed text-slate-800"
			}
		>
			{children}
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
		const trimmed = text.startsWith("Plan ID:")
			? "Audiencia iniciada."
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
