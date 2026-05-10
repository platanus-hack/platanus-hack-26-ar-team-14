"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningRecord } from "../../actions/libro-de-clases";
import {
	BitacoraChatPanel,
	type BitacoraChatMessage,
} from "../../components/bitacora-chat-panel";
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

type Msg = BitacoraChatMessage;

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
			router.refresh();
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
			abortRef.current = null;
		}
	}, [router]);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		const first: Msg = {
			id: crypto.randomUUID(),
			role: "teacher",
			text: buildClassRecordPrompt(record),
			hidden: true,
		};
		setMessages([first]);
		void streamReply([first]);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [record.id]);

	function submitInput() {
		const text = input.trim();
		if (!text || busy) return;
		const next: Msg = { id: crypto.randomUUID(), role: "teacher", text };
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

				<BitacoraChatPanel
					title="Registro en vivo"
					subtitle="Cuéntale al agente qué hicieron en esta clase y se encarga del libro."
					messages={messages}
					busy={busy}
					error={error}
					input={input}
					onInputChange={setInput}
					onSubmit={submitInput}
					placeholder="Mensaje a Bita…"
				/>
			</div>
		</main>
	);
}
