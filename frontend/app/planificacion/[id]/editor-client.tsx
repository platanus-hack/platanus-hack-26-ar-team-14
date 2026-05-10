"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	getPlanificacionAction,
	type Plan,
} from "../../actions/planificacion";
import {
	BitacoraChatPanel,
	type BitacoraChatMessage,
} from "../../components/bitacora-chat-panel";
import { PlanAnualTable } from "../../components/plan-anual-table";

type Msg = BitacoraChatMessage;

function buildReviewPrompt(planId: number): string {
	return [
		`Plan ${planId}. Audítalo en silencio (listar_plan, clases_en_mes, OA y Programa según haga falta) y responde solo con la sección # Correcciones: hasta 5 bullets, una línea cada uno, terminando con "¿Aplico estos cambios?".`,
		"Salta el resumen del plan, las listas de OA cubiertos y las secciones de fuentes; el lector ve la tabla en pantalla. Espera confirmación antes de mutar.",
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

	const streamReply = useCallback(async (history: Msg[]) => {
		setBusy(true);
		const ctrl = new AbortController();
		abortRef.current = ctrl;
		const body = {
			messages: history.map((m) => ({
				role: m.role === "teacher" ? "user" : "assistant",
				content: m.transportText ?? m.text,
			})),
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
	}, [plan.id]);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		const first: Msg = {
			id: crypto.randomUUID(),
			role: "teacher",
			text: buildReviewPrompt(plan.id),
			hidden: true,
		};
		setMessages([first]);
		void streamReply([first]);
	}, [plan.id, streamReply]);

	function submitInput() {
		const text = input.trim();
		if (!text || busy) return;
		const next: Msg = { id: crypto.randomUUID(), role: "teacher", text };
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
			<PlanAnualTable
				plan={plan}
				headerExtra={
					<button
						type="button"
						onClick={onBack}
						className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
					>
						Volver
					</button>
				}
			/>

			<BitacoraChatPanel
				title="Audiencia UTP · en vivo"
				subtitle="El agente edita el plan directamente. La tabla se recarga al final de cada turno."
				messages={messages}
				busy={busy}
				error={error}
				input={input}
				onInputChange={setInput}
				onSubmit={submitInput}
				placeholder="Pide aclaraciones o un ajuste específico…"
			/>
		</div>
	);
}

