"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Alternative = { label: string; text: string };

type Question = {
	id: number;
	kind: "open" | "multiple_choice" | string;
	prompt: string;
	alternatives: Alternative[];
	correct_alternative: string | null;
	answer: string | null;
	asignatura: string | null;
	nivel: string | null;
	oa_code: string | null;
	habilidad: string | null;
	contenido: string | null;
	source_file: string | null;
	has_image: boolean;
	image_url: string | null;
	image_width: number | null;
	image_height: number | null;
};

export function WorksheetsClient() {
	const [questions, setQuestions] = useState<Question[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [oaFilter, setOaFilter] = useState<string>("");

	async function refresh() {
		const res = await fetch("/api/questions", { cache: "no-store" });
		if (res.ok) setQuestions((await res.json()) as Question[]);
	}

	useEffect(() => {
		void refresh();
	}, []);

	const oaCodes = useMemo(() => {
		const set = new Set<string>();
		for (const q of questions) if (q.oa_code) set.add(q.oa_code);
		return Array.from(set).sort();
	}, [questions]);

	const filtered = useMemo(
		() =>
			oaFilter ? questions.filter((q) => q.oa_code === oaFilter) : questions,
		[questions, oaFilter],
	);

	async function onUpload(e: FormEvent) {
		e.preventDefault();
		if (!file) return;
		setBusy(true);
		setError(null);
		try {
			const fd = new FormData();
			fd.set("file", file);
			const res = await fetch("/api/questions/extract", {
				method: "POST",
				body: fd,
			});
			if (!res.ok) throw new Error(await res.text());
			setFile(null);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	async function onDeleteAll() {
		if (questions.length === 0) return;
		const ok = window.confirm(
			`¿Borrar las ${questions.length} preguntas del banco? Esta acción no se puede deshacer.`,
		);
		if (!ok) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/questions", { method: "DELETE" });
			if (!res.ok) throw new Error(await res.text());
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<article className="bitacora-card w-full">
			<form
				onSubmit={onUpload}
				className="flex flex-wrap items-end gap-4 border-b border-slate-200/70 pb-6"
			>
				<label className="flex min-w-[260px] flex-1 flex-col gap-2">
					<span className="bitacora-kicker">Subir guía PDF</span>
					<input
						type="file"
						accept="application/pdf"
						onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
						className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
					/>
				</label>
				<button
					type="submit"
					className="bitacora-primary-button"
					disabled={!file || busy}
				>
					{busy ? "Procesando…" : "Extraer preguntas"}
				</button>
			</form>

			{error ? (
				<pre className="mt-5 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
					{error}
				</pre>
			) : null}

			<div className="mt-6 flex flex-wrap items-center gap-3">
				<span className="bitacora-kicker">
					{filtered.length} pregunta{filtered.length === 1 ? "" : "s"}
					{oaFilter ? ` · ${oaFilter}` : ""}
				</span>
				{oaCodes.length > 0 ? (
					<select
						value={oaFilter}
						onChange={(ev) => setOaFilter(ev.target.value)}
						className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
					>
						<option value="">Todos los OA</option>
						{oaCodes.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				) : null}
				<button
					type="button"
					onClick={() => void onDeleteAll()}
					disabled={busy || questions.length === 0}
					className="ml-auto rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Borrar todo
				</button>
			</div>

			<ol className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
				{filtered.map((q) => (
					<QuestionCard key={q.id} q={q} />
				))}
			</ol>

			{filtered.length === 0 && !busy ? (
				<p className="mt-6 text-[14px] italic text-slate-500">
					Aún no hay preguntas. Sube una guía para empezar.
				</p>
			) : null}
		</article>
	);
}

function QuestionCard({ q }: { q: Question }) {
	const isMC = q.kind === "multiple_choice" && q.alternatives.length > 0;
	return (
		<li className="flex min-w-0 flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
			<div className="flex flex-wrap items-center gap-2">
				<Tag>{isMC ? "Selección múltiple" : "Respuesta abierta"}</Tag>
				{q.oa_code ? <Tag>{q.oa_code}</Tag> : null}
				{q.nivel ? <Tag>{q.nivel}</Tag> : null}
				{q.contenido ? <Tag>{q.contenido}</Tag> : null}
				{q.habilidad ? <Tag muted>{q.habilidad}</Tag> : null}
			</div>
			{q.source_file ? (
				<span className="truncate text-xs text-slate-400">{q.source_file}</span>
			) : null}
			<p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-800">
				{q.prompt}
			</p>
			{q.has_image && q.image_url ? (
				<img
					src={`/api${q.image_url}`}
					alt={`Pregunta ${q.id}`}
					className="max-h-64 w-full self-start rounded-2xl border border-slate-200 object-contain"
				/>
			) : null}
			{isMC ? (
				<ul className="mt-1 flex flex-col gap-1.5">
					{q.alternatives.map((alt) => {
						const correct =
							q.correct_alternative != null &&
							alt.label.toLowerCase() === q.correct_alternative.toLowerCase();
						return (
							<li
								key={alt.label}
								className={[
									"flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[14px] leading-relaxed",
									correct
										? "border-emerald-300 bg-emerald-50 text-emerald-900"
										: "border-slate-200 bg-white/70 text-slate-700",
								].join(" ")}
							>
								<span
									className={[
										"mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase",
										correct
											? "bg-emerald-500 text-white"
											: "bg-slate-100 text-slate-600",
									].join(" ")}
								>
									{alt.label}
								</span>
								<span className="break-words">{alt.text}</span>
							</li>
						);
					})}
				</ul>
			) : null}
			{q.answer ? (
				<p className="break-words rounded-2xl bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
					<span className="bitacora-kicker mr-2">Respuesta</span>
					{q.answer}
				</p>
			) : null}
		</li>
	);
}

function Tag({
	children,
	muted = false,
}: {
	children: React.ReactNode;
	muted?: boolean;
}) {
	return (
		<span
			className={[
				"rounded-full border px-2.5 py-[2px] text-[11px] font-semibold",
				muted
					? "border-slate-200 bg-slate-50 text-slate-500"
					: "border-vermilion/40 bg-vermilion/5 text-vermilion",
			].join(" ")}
		>
			{children}
		</span>
	);
}
