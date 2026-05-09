"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
	createGuiaAction,
	updateGuiaAction,
	type GuiaDetail,
	type Question,
} from "../../actions/guias";

type Props = {
	bank: Question[];
	initialGuia?: GuiaDetail;
};

export function EditorClient({ bank, initialGuia }: Props) {
	const router = useRouter();
	const isEditing = !!initialGuia;
	const [name, setName] = useState(initialGuia?.name ?? "");
	const [oaFilter, setOaFilter] = useState("");
	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState<number[]>(
		initialGuia ? initialGuia.questions.map((q) => q.id) : [],
	);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const byId = useMemo(() => {
		const m = new Map<number, Question>();
		for (const q of bank) m.set(q.id, q);
		return m;
	}, [bank]);

	const oaCodes = useMemo(() => {
		const s = new Set<string>();
		for (const q of bank) if (q.oa_code) s.add(q.oa_code);
		return Array.from(s).sort();
	}, [bank]);

	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const matches = bank.filter((q) => {
			if (oaFilter && q.oa_code !== oaFilter) return false;
			if (term && !q.prompt.toLowerCase().includes(term)) return false;
			return true;
		});
		const order = new Map(selectedIds.map((id, idx) => [id, idx]));
		return matches.slice().sort((a, b) => {
			const aSel = order.has(a.id);
			const bSel = order.has(b.id);
			if (aSel && bSel) return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
			if (aSel) return -1;
			if (bSel) return 1;
			return 0;
		});
	}, [bank, oaFilter, search, selectedIds]);

	const selectedFilteredCount = useMemo(
		() => filtered.filter((q) => selectedSet.has(q.id)).length,
		[filtered, selectedSet],
	);

	const selectedQuestions = useMemo(
		() =>
			selectedIds.map((id) => byId.get(id)).filter((q): q is Question => !!q),
		[selectedIds, byId],
	);

	const selectedOaCodes = useMemo(() => {
		const set = new Set<string>();
		for (const q of selectedQuestions) if (q.oa_code) set.add(q.oa_code);
		return Array.from(set).sort();
	}, [selectedQuestions]);

	function toggle(id: number) {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	}

	function move(index: number, dir: -1 | 1) {
		setSelectedIds((prev) => {
			const next = [...prev];
			const target = index + dir;
			if (target < 0 || target >= next.length) return prev;
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	}

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Ponle un nombre a la guía.");
			return;
		}
		if (selectedIds.length === 0) {
			setError("Elige al menos una pregunta.");
			return;
		}
		startTransition(async () => {
			try {
				if (initialGuia) {
					await updateGuiaAction(initialGuia.id, {
						name: trimmed,
						question_ids: selectedIds,
					});
				} else {
					await createGuiaAction({ name: trimmed, question_ids: selectedIds });
				}
				router.push("/guias");
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		});
	}

	const canSave = !!name.trim() && selectedIds.length > 0 && !pending;

	return (
		<form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
			{/* TOOLBAR */}
			<div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur">
				<Link
					href="/guias"
					className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 transition-colors hover:bg-slate-50"
				>
					← Archivero
				</Link>
				<span className="hidden h-4 w-px bg-slate-300 sm:inline-block" />
				<span className="font-mono text-[10px] uppercase tracking-[0.3em] text-vermilion">
					{isEditing ? "Editando · " : ""}
					{selectedIds.length === 0
						? "Sin preguntas"
						: `${selectedIds.length} pregunta${selectedIds.length === 1 ? "" : "s"}`}
				</span>
				{name.trim() ? (
					<span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 md:inline">
						· {name.trim()}
					</span>
				) : null}
				{error ? (
					<span className="font-mono text-[11px] text-vermilion">⚠ {error}</span>
				) : null}
				<button
					type="button"
					onClick={() => {
						setName("");
						setSelectedIds([]);
						setError(null);
					}}
					disabled={selectedIds.length === 0 && !name.trim()}
					className="ml-auto rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
				>
					Vaciar
				</button>
				<button
					type="submit"
					disabled={!canSave}
					className="bitacora-primary-button"
				>
					{pending
						? "Guardando…"
						: isEditing
							? "Guardar cambios"
							: "Guardar guía"}
				</button>
			</div>

			<div className="grid w-full gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
				{/* LEFT: bank */}
				<aside className="bitacora-card flex max-h-[calc(100vh-7rem)] flex-col gap-3 lg:sticky lg:top-16 lg:order-1">
					<div className="flex items-baseline justify-between">
						<h2 className="font-display text-[20px] tracking-tight text-slate-900">
							Banco
						</h2>
						<span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">
							{filtered.length}/{bank.length}
						</span>
					</div>

					<div className="flex flex-col gap-2">
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
						<input
							value={search}
							onChange={(ev) => setSearch(ev.target.value)}
							placeholder="Buscar en el enunciado…"
							className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
						/>
					</div>

					<ul className="-mx-2 flex flex-1 flex-col gap-2 overflow-y-auto px-2">
						{filtered.map((q, idx) => {
							const checked = selectedSet.has(q.id);
							const showDivider =
								selectedFilteredCount > 0 &&
								idx === selectedFilteredCount &&
								selectedFilteredCount < filtered.length;
							return (
								<li key={q.id}>
									{showDivider ? (
										<div className="mb-2 mt-1 flex items-center gap-2">
											<span className="h-px flex-1 bg-slate-200" />
											<span className="font-mono text-[9px] uppercase tracking-[0.3em] text-slate-400">
												Resto del banco
											</span>
											<span className="h-px flex-1 bg-slate-200" />
										</div>
									) : null}
									<button
										type="button"
										onClick={() => toggle(q.id)}
										className={[
											"flex w-full flex-col gap-1.5 rounded-2xl border p-3 text-left transition-colors",
											checked
												? "border-vermilion bg-vermilion/5"
												: "border-slate-200/80 bg-white/70 hover:border-slate-300",
										].join(" ")}
									>
										<div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
											{q.oa_code ? (
												<span className="rounded-full border border-vermilion/40 bg-vermilion/5 px-2 py-[1px] font-mono text-vermilion">
													{q.oa_code}
												</span>
											) : null}
											<span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-[1px] font-mono text-slate-500">
												{q.kind === "multiple_choice" ? "MC" : "Abierta"}
											</span>
											{checked ? (
												<span className="ml-auto rounded-full bg-vermilion px-2 py-[1px] font-mono text-white">
													✓ añadida
												</span>
											) : null}
										</div>
										<p className="line-clamp-3 break-words text-[12.5px] leading-snug text-slate-700">
											{q.prompt}
										</p>
									</button>
								</li>
							);
						})}
						{filtered.length === 0 ? (
							<li className="px-2 py-6 text-center text-[12px] italic text-slate-400">
								No hay preguntas{oaFilter ? ` para ${oaFilter}` : ""}.
							</li>
						) : null}
					</ul>
				</aside>

				{/* RIGHT: worksheet */}
				<section className="bitacora-card min-h-[600px] bg-[#fdfcf8] lg:order-2">
					<header className="border-b border-slate-300 pb-6">
						<p className="font-mono text-[10px] uppercase tracking-[0.35em] text-vermilion">
							Guía de trabajo
						</p>
						<input
							value={name}
							onChange={(ev) => setName(ev.target.value)}
							placeholder="Escribe el título de la guía…"
							className="mt-2 w-full border-0 bg-transparent p-0 font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
						/>
						<div className="mt-5 flex flex-wrap gap-x-10 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
							<span>Nombre: ______________________________</span>
							<span>Curso: ____________</span>
							<span>Fecha: ____________</span>
						</div>
						{selectedOaCodes.length > 0 ? (
							<div className="mt-4 flex flex-wrap items-center gap-2">
								<span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">
									OA cubiertos ·
								</span>
								{selectedOaCodes.map((c) => (
									<span
										key={c}
										className="rounded-full border border-vermilion/40 bg-vermilion/5 px-2 py-[2px] font-mono text-[10px] font-semibold tracking-[0.05em] text-vermilion"
									>
										{c}
									</span>
								))}
							</div>
						) : null}
					</header>

					{selectedQuestions.length === 0 ? (
						<div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">
								Hoja en blanco
							</p>
							<p className="max-w-sm text-center text-[15px] italic leading-relaxed text-slate-400">
								Selecciona preguntas desde el banco a la izquierda y aparecerán
								aquí como una guía lista para imprimir.
							</p>
						</div>
					) : (
						<ol className="mt-6 flex flex-col gap-7">
							{selectedQuestions.map((q, idx) => (
								<WorksheetItem
									key={q.id}
									q={q}
									number={idx + 1}
									canUp={idx > 0}
									canDown={idx < selectedQuestions.length - 1}
									onUp={() => move(idx, -1)}
									onDown={() => move(idx, 1)}
									onRemove={() => toggle(q.id)}
								/>
							))}
						</ol>
					)}
				</section>
			</div>
		</form>
	);
}

function WorksheetItem({
	q,
	number,
	canUp,
	canDown,
	onUp,
	onDown,
	onRemove,
}: {
	q: Question;
	number: number;
	canUp: boolean;
	canDown: boolean;
	onUp: () => void;
	onDown: () => void;
	onRemove: () => void;
}) {
	const isMC = q.kind === "multiple_choice" && q.alternatives.length > 0;
	return (
		<li className="group relative flex gap-4">
			<div className="flex w-8 shrink-0 flex-col items-center gap-1">
				<span className="font-display text-[22px] font-semibold leading-none text-slate-900">
					{number}.
				</span>
				<div className="mt-1 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						type="button"
						onClick={onUp}
						disabled={!canUp}
						title="Subir"
						className="rounded-md border border-slate-200 bg-white px-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-30"
					>
						▲
					</button>
					<button
						type="button"
						onClick={onDown}
						disabled={!canDown}
						title="Bajar"
						className="rounded-md border border-slate-200 bg-white px-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-30"
					>
						▼
					</button>
					<button
						type="button"
						onClick={onRemove}
						title="Quitar"
						className="rounded-md border border-red-200 bg-red-50 px-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
					>
						✕
					</button>
				</div>
			</div>
			<div className="min-w-0 flex-1">
				{q.oa_code ? (
					<p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-vermilion">
						{q.oa_code}
					</p>
				) : null}
				<p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-900">
					{q.prompt}
				</p>
				{q.has_image && q.image_url ? (
					<img
						src={`/api${q.image_url}`}
						alt={`Pregunta ${q.id}`}
						className="mt-3 max-h-64 rounded-xl border border-slate-200 object-contain"
					/>
				) : null}
				{isMC ? (
					<ol className="mt-3 flex flex-col gap-1.5">
						{q.alternatives.map((alt) => (
							<li
								key={alt.label}
								className="flex items-start gap-2 text-[14px] leading-relaxed text-slate-800"
							>
								<span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 font-mono text-[11px] font-semibold uppercase text-slate-700">
									{alt.label}
								</span>
								<span className="break-words">{alt.text}</span>
							</li>
						))}
					</ol>
				) : (
					<div className="mt-3 flex flex-col gap-2">
						<div className="h-px border-b border-dashed border-slate-300" />
						<div className="h-px border-b border-dashed border-slate-300" />
						<div className="h-px border-b border-dashed border-slate-300" />
					</div>
				)}
			</div>
		</li>
	);
}
