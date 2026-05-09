"use client";

import {
	type FormEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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

const REVIEW_PROMPT =
	"Actúa como jefe de UTP en una audiencia con el docente. Te adjunto la planificación anual de Matemática 5° básico en PDF. Revísala: verifica cobertura contra los 27 OA del nivel, ubicación de OA por unidad, OA mal escritos o inventados, y propone ajustes concretos. Usa el formato de revisión de plan anual.";

async function fileToBase64(file: File): Promise<string> {
	const buf = await file.arrayBuffer();
	const bytes = new Uint8Array(buf);
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export function PlanificacionClient() {
	const [file, setFile] = useState<File | null>(null);
	const [pdfBase64, setPdfBase64] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [preparing, setPreparing] = useState(false);
	const [started, setStarted] = useState(false);

	const [messages, setMessages] = useState<Msg[]>([]);
	const [busy, setBusy] = useState(false);
	const [input, setInput] = useState("");
	const startedRef = useRef(false);
	const abortRef = useRef<AbortController | null>(null);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const lastTextLength = messages.reduce((a, m) => a + m.text.length, 0);
	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [messages.length, lastTextLength, busy]);

	const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
	useEffect(() => {
		if (!fileUrl) return;
		return () => URL.revokeObjectURL(fileUrl);
	}, [fileUrl]);

	async function streamReply(history: Msg[]) {
		setBusy(true);
		const ctrl = new AbortController();
		abortRef.current = ctrl;

		const isFirstWithPdf = history.length === 1 && pdfBase64 != null;
		const body = {
			messages: history.map((m) => ({ role: m.role, content: m.text })),
			pdf: isFirstWithPdf
				? {
						name: file?.name ?? "planificacion.pdf",
						mediaType: "application/pdf",
						data: pdfBase64,
					}
				: null,
		};

		const assistantId = crypto.randomUUID();
		setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);

		try {
			const res = await fetch("/api/planificacion/chat", {
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
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
			abortRef.current = null;
		}
	}

	async function onUpload(e: FormEvent) {
		e.preventDefault();
		if (!file || startedRef.current) return;
		startedRef.current = true;
		setPreparing(true);
		setError(null);
		try {
			const b64 = await fileToBase64(file);
			setPdfBase64(b64);
			setStarted(true);
			const first: Msg = {
				id: crypto.randomUUID(),
				role: "user",
				text: REVIEW_PROMPT,
			};
			setMessages([first]);
			// stream uses pdfBase64 from closure: pass directly
			void streamReplyWithPdf([first], b64);
		} catch (err) {
			startedRef.current = false;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setPreparing(false);
		}
	}

	async function streamReplyWithPdf(history: Msg[], b64: string) {
		setBusy(true);
		const ctrl = new AbortController();
		abortRef.current = ctrl;
		const body = {
			messages: history.map((m) => ({ role: m.role, content: m.text })),
			pdf: {
				name: file?.name ?? "planificacion.pdf",
				mediaType: "application/pdf",
				data: b64,
			},
		};
		const assistantId = crypto.randomUUID();
		setMessages((prev) => [
			...prev,
			{ id: assistantId, role: "assistant", text: "" },
		]);
		try {
			const res = await fetch("/api/planificacion/chat", {
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
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
			abortRef.current = null;
		}
	}

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

	function reset() {
		abortRef.current?.abort();
		setFile(null);
		setPdfBase64(null);
		setMessages([]);
		setError(null);
		setStarted(false);
		startedRef.current = false;
	}

	if (!started) {
		return (
			<article className="bitacora-card mx-auto w-full max-w-3xl">
				<form onSubmit={onUpload} className="flex flex-col gap-6">
					<div>
						<p className="bitacora-kicker">Momento 1 · revisión con UTP</p>
						<h2 className="mt-2 font-display text-[clamp(1.6rem,2.4vw,2.4rem)] leading-tight tracking-tight text-slate-950">
							Sube tu planificación anual
						</h2>
						<p className="mt-2 text-base text-slate-600">
							PDF con la distribución de OA por unidad o por mes. La audiencia
							UTP empieza apenas terminemos de leerlo.
						</p>
					</div>

					<label className="flex flex-col gap-2">
						<span className="bitacora-kicker">Archivo PDF</span>
						<input
							type="file"
							accept="application/pdf"
							onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
							className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
						/>
					</label>

					<button
						type="submit"
						className="bitacora-primary-button self-start"
						disabled={!file || preparing}
					>
						{preparing ? "Preparando…" : "Iniciar audiencia"}
					</button>

					{error ? (
						<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
							{error}
						</pre>
					) : null}
				</form>
			</article>
		);
	}

	return (
		<div className="grid h-[calc(100vh-260px)] min-h-[640px] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
			<article className="bitacora-card flex min-h-0 flex-col overflow-hidden p-0">
				<header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
					<div className="min-w-0">
						<p className="bitacora-kicker">Plan en revisión</p>
						<p className="truncate text-sm font-semibold text-slate-900">
							{file?.name ?? "planificacion.pdf"}
						</p>
					</div>
					<button
						type="button"
						onClick={reset}
						className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
					>
						Subir otro
					</button>
				</header>
				<div className="flex-1 bg-slate-100">
					{fileUrl ? (
						<object
							data={fileUrl}
							type="application/pdf"
							className="h-full w-full"
						>
							<p className="p-6 text-sm text-slate-600">
								Tu navegador no puede mostrar el PDF.{" "}
								<a
									href={fileUrl}
									target="_blank"
									rel="noreferrer"
									className="text-vermilion underline"
								>
									Ábrelo en otra pestaña
								</a>
								.
							</p>
						</object>
					) : null}
				</div>
			</article>

			<article className="bitacora-card flex min-h-0 flex-col overflow-hidden p-0">
				<header className="border-b border-slate-200/70 px-5 py-4">
					<p className="bitacora-kicker">Audiencia UTP · en vivo</p>
					<p className="mt-1 text-sm text-slate-600">
						Revisión de cobertura, ubicación de OA y propuestas de ajuste.
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
	const blocks: { kind: "tool" | "md"; text: string }[] = [];
	const buf: string[] = [];
	const flush = () => {
		const md = buf.join("\n").trim();
		buf.length = 0;
		if (md) blocks.push({ kind: "md", text: md });
	};
	for (const line of text.split("\n")) {
		if (line.startsWith("⏳") || line.startsWith("✓")) {
			flush();
			blocks.push({ kind: "tool", text: line.replace(/^[⏳✓]\s*/, "") });
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
		const trimmed = text === REVIEW_PROMPT ? "Planificación enviada para revisión." : text;
		return <p className="whitespace-pre-wrap">{trimmed}</p>;
	}
	return (
		<div className="flex flex-col gap-1.5">
			{blocks.map((b, i) =>
				b.kind === "tool" ? (
					<p
						key={i}
						className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-500"
					>
						{b.text}
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
