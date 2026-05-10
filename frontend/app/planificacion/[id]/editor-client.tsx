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

type Msg = BitacoraChatMessage;

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
			<PlanTable plan={plan} onBack={onBack} />

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
							</tr>
						))}
						{plan.items.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-slate-500">
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

