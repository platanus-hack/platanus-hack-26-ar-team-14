"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import {
	createGuiaAction,
	type GeneratedQuestion,
	type GuiaDetail,
	type GuiaQuestionInputItem,
	type Question,
	updateGuiaAction,
} from "../../actions/guias";

type Props = {
	bank: Question[];
	initialGuia?: GuiaDetail;
};

type WorksheetItem =
	| { type: "bank"; bankQuestionId: number }
	| { type: "generated"; generated: GeneratedQuestion };

function fromInitialGuia(initialGuia?: GuiaDetail): WorksheetItem[] {
	if (!initialGuia) return [];
	return initialGuia.items.map((item) =>
		item.type === "bank"
			? { type: "bank", bankQuestionId: item.bank_question.id }
			: {
					type: "generated",
					generated: {
						...item.generated_question,
						alternatives: item.generated_question.alternatives ?? [],
					},
				},
	);
}

function emptyGeneratedQuestion(): GeneratedQuestion {
	return {
		id: null,
		kind: "open",
		prompt: "",
		alternatives: [],
		correct_alternative: null,
		answer: null,
		oa_code: null,
		habilidad: null,
		contenido: null,
		source_note: null,
	};
}

function defaultAlternatives() {
	return [
		{ label: "A", text: "" },
		{ label: "B", text: "" },
		{ label: "C", text: "" },
		{ label: "D", text: "" },
	];
}

export function EditorClient({ bank, initialGuia }: Props) {
	const router = useRouter();
	const isEditing = !!initialGuia;
	const [name, setName] = useState(initialGuia?.name ?? "");
	const [oaFilter, setOaFilter] = useState("");
	const [search, setSearch] = useState("");
	const [worksheetItems, setWorksheetItems] = useState<WorksheetItem[]>(
		fromInitialGuia(initialGuia),
	);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const byId = useMemo(() => {
		const map = new Map<number, Question>();
		for (const q of bank) map.set(q.id, q);
		return map;
	}, [bank]);

	const oaCodes = useMemo(() => {
		const set = new Set<string>();
		for (const q of bank) if (q.oa_code) set.add(q.oa_code);
		return Array.from(set).sort();
	}, [bank]);

	const selectedBankIds = useMemo(
		() =>
			new Set(
				worksheetItems
					.filter((item) => item.type === "bank")
					.map((item) => item.bankQuestionId),
			),
		[worksheetItems],
	);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const matches = bank.filter((q) => {
			if (oaFilter && q.oa_code !== oaFilter) return false;
			if (term && !q.prompt.toLowerCase().includes(term)) return false;
			return true;
		});
		const order = new Map<number, number>();
		worksheetItems.forEach((item, idx) => {
			if (item.type === "bank") order.set(item.bankQuestionId, idx);
		});
		return matches.slice().sort((a, b) => {
			const aSel = order.has(a.id);
			const bSel = order.has(b.id);
			if (aSel && bSel) return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
			if (aSel) return -1;
			if (bSel) return 1;
			return 0;
		});
	}, [bank, oaFilter, search, worksheetItems]);

	const worksheetView = useMemo(
		() =>
			worksheetItems.map((item) =>
				item.type === "bank"
					? ({
							type: "bank",
							question: byId.get(item.bankQuestionId) ?? null,
						} as const)
					: ({ type: "generated", generated: item.generated } as const),
			),
		[worksheetItems, byId],
	);

	const selectedOaCodes = useMemo(() => {
		const set = new Set<string>();
		for (const item of worksheetView) {
			if (item.type === "bank" && item.question?.oa_code)
				set.add(item.question.oa_code);
			if (item.type === "generated" && item.generated.oa_code)
				set.add(item.generated.oa_code);
		}
		return Array.from(set).sort();
	}, [worksheetView]);

	function toggleBankQuestion(id: number) {
		setWorksheetItems((current) => {
			const existingIndex = current.findIndex(
				(item) => item.type === "bank" && item.bankQuestionId === id,
			);
			if (existingIndex >= 0) {
				return current.filter((_, index) => index !== existingIndex);
			}
			return [...current, { type: "bank", bankQuestionId: id }];
		});
	}

	function addGeneratedQuestion() {
		setWorksheetItems((current) => [
			...current,
			{ type: "generated", generated: emptyGeneratedQuestion() },
		]);
	}

	function move(index: number, dir: -1 | 1) {
		setWorksheetItems((current) => {
			const next = [...current];
			const target = index + dir;
			if (target < 0 || target >= next.length) return current;
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	}

	function remove(index: number) {
		setWorksheetItems((current) => current.filter((_, i) => i !== index));
	}

	function updateGenerated(index: number, patch: Partial<GeneratedQuestion>) {
		setWorksheetItems((current) =>
			current.map((item, i) =>
				i !== index || item.type !== "generated"
					? item
					: { ...item, generated: { ...item.generated, ...patch } },
			),
		);
	}

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Ponle un nombre a la guía.");
			return;
		}
		if (worksheetItems.length === 0) {
			setError("Elige o redacta al menos una pregunta.");
			return;
		}

		const items: GuiaQuestionInputItem[] = worksheetItems.map((item) =>
			item.type === "bank"
				? { type: "bank", question_id: item.bankQuestionId }
				: {
						type: "generated",
						generated: {
							kind: item.generated.kind,
							prompt: item.generated.prompt,
							alternatives: item.generated.alternatives,
							correct_alternative: item.generated.correct_alternative,
							answer: item.generated.answer,
							oa_code: item.generated.oa_code,
							habilidad: item.generated.habilidad,
							contenido: item.generated.contenido,
							source_note: item.generated.source_note,
						},
					},
		);

		startTransition(async () => {
			try {
				if (initialGuia) {
					await updateGuiaAction(initialGuia.id, { name: trimmed, items });
				} else {
					await createGuiaAction({ name: trimmed, items });
				}
				router.push("/guias");
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		});
	}

	const canSave = !!name.trim() && worksheetItems.length > 0 && !pending;

	return (
		<form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
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
					{worksheetItems.length === 0
						? "Sin preguntas"
						: `${worksheetItems.length} pregunta${worksheetItems.length === 1 ? "" : "s"}`}
				</span>
				{name.trim() ? (
					<span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 md:inline">
						· {name.trim()}
					</span>
				) : null}
				{error ? (
					<span className="font-mono text-[11px] text-vermilion">
						⚠ {error}
					</span>
				) : null}
				<button
					type="button"
					onClick={() => {
						setName("");
						setWorksheetItems([]);
						setError(null);
					}}
					disabled={worksheetItems.length === 0 && !name.trim()}
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
							{oaCodes.map((code) => (
								<option key={code} value={code}>
									{code}
								</option>
							))}
						</select>
						<input
							value={search}
							onChange={(ev) => setSearch(ev.target.value)}
							placeholder="Buscar en el enunciado…"
							className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
						/>
						<button
							type="button"
							onClick={addGeneratedQuestion}
							className="rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
						>
							Agregar pregunta nueva
						</button>
					</div>

					<ul className="-mx-2 flex flex-1 flex-col gap-2 overflow-y-auto px-2">
						{filtered.map((q) => {
							const checked = selectedBankIds.has(q.id);
							return (
								<li key={q.id}>
									<button
										type="button"
										onClick={() => toggleBankQuestion(q.id)}
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
					</ul>
				</aside>

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
								{selectedOaCodes.map((code) => (
									<span
										key={code}
										className="rounded-full border border-vermilion/40 bg-vermilion/5 px-2 py-[2px] font-mono text-[10px] font-semibold tracking-[0.05em] text-vermilion"
									>
										{code}
									</span>
								))}
							</div>
						) : null}
					</header>

					{worksheetView.length === 0 ? (
						<div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">
								Hoja en blanco
							</p>
							<p className="max-w-sm text-center text-[15px] italic leading-relaxed text-slate-400">
								Selecciona preguntas desde el banco o redacta nuevas y
								aparecerán aquí.
							</p>
						</div>
					) : (
						<ol className="mt-6 flex flex-col gap-7">
							{worksheetView.map((item, idx) => (
								<WorksheetItemEditor
									key={
										item.type === "bank"
											? `bank-${item.question?.id ?? idx}`
											: `generated-${idx}`
									}
									item={item}
									number={idx + 1}
									canUp={idx > 0}
									canDown={idx < worksheetView.length - 1}
									onUp={() => move(idx, -1)}
									onDown={() => move(idx, 1)}
									onRemove={() => remove(idx)}
									onGeneratedChange={(patch) => updateGenerated(idx, patch)}
								/>
							))}
						</ol>
					)}
				</section>
			</div>
		</form>
	);
}

function WorksheetItemEditor({
	item,
	number,
	canUp,
	canDown,
	onUp,
	onDown,
	onRemove,
	onGeneratedChange,
}: {
	item:
		| { type: "bank"; question: Question | null }
		| { type: "generated"; generated: GeneratedQuestion };
	number: number;
	canUp: boolean;
	canDown: boolean;
	onUp: () => void;
	onDown: () => void;
	onRemove: () => void;
	onGeneratedChange: (patch: Partial<GeneratedQuestion>) => void;
}) {
	const q = item.type === "bank" ? item.question : null;
	const generated = item.type === "generated" ? item.generated : null;
	const alternatives =
		item.type === "bank"
			? (q?.alternatives ?? [])
			: (generated?.alternatives ?? []);
	const isMC =
		(item.type === "bank" ? q?.kind : generated?.kind) === "multiple_choice" &&
		alternatives.length > 0;

	function updateGeneratedAlternative(altIndex: number, text: string) {
		if (!generated) return;
		const next = (
			generated.alternatives.length > 0
				? generated.alternatives
				: defaultAlternatives()
		).map((alt, index) => (index === altIndex ? { ...alt, text } : alt));
		onGeneratedChange({ alternatives: next });
	}

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
						className="rounded-md border border-slate-200 bg-white px-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-30"
					>
						▲
					</button>
					<button
						type="button"
						onClick={onDown}
						disabled={!canDown}
						className="rounded-md border border-slate-200 bg-white px-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-30"
					>
						▼
					</button>
					<button
						type="button"
						onClick={onRemove}
						className="rounded-md border border-red-200 bg-red-50 px-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
					>
						✕
					</button>
				</div>
			</div>
			<div className="min-w-0 flex-1">
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
						{item.type === "bank" ? "Banco" : "Generada"}
					</span>
					{(q?.oa_code ?? generated?.oa_code) ? (
						<span className="rounded-full border border-vermilion/40 bg-vermilion/5 px-2 py-[2px] font-mono text-[10px] font-semibold tracking-[0.05em] text-vermilion">
							{q?.oa_code ?? generated?.oa_code}
						</span>
					) : null}
				</div>

				{item.type === "bank" && q ? (
					<>
						<p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-900">
							{q.prompt}
						</p>
						{q.has_image && q.image_url ? (
							<Image
								src={`/api${q.image_url}`}
								alt={`Pregunta ${q.id}`}
								width={q.image_width ?? 1200}
								height={q.image_height ?? 900}
								unoptimized
								className="mt-3 max-h-64 rounded-xl border border-slate-200 object-contain"
							/>
						) : null}
					</>
				) : null}

				{item.type === "generated" && generated ? (
					<div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
						<input
							value={generated.oa_code ?? ""}
							onChange={(ev) =>
								onGeneratedChange({ oa_code: ev.target.value || null })
							}
							placeholder="OA7"
							className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
						/>
						<select
							value={generated.kind}
							onChange={(ev) =>
								onGeneratedChange(
									ev.target.value === "multiple_choice"
										? {
												kind: "multiple_choice",
												answer: null,
												alternatives:
													generated.alternatives.length > 0
														? generated.alternatives
														: defaultAlternatives(),
												correct_alternative:
													generated.correct_alternative ?? "A",
											}
										: {
												kind: "open",
												alternatives: [],
												correct_alternative: null,
											},
								)
							}
							className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
						>
							<option value="open">Abierta</option>
							<option value="multiple_choice">Selección múltiple</option>
						</select>
						<textarea
							value={generated.prompt}
							onChange={(ev) => onGeneratedChange({ prompt: ev.target.value })}
							placeholder="Enunciado de la pregunta…"
							className="min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
						/>
						{generated.kind === "multiple_choice" ? (
							<div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3">
								<div className="flex items-center justify-between">
									<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
										Alternativas
									</p>
									<select
										value={generated.correct_alternative ?? "A"}
										onChange={(ev) =>
											onGeneratedChange({
												correct_alternative: ev.target.value || null,
											})
										}
										className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
									>
										{(generated.alternatives.length > 0
											? generated.alternatives
											: defaultAlternatives()
										).map((alt) => (
											<option key={alt.label} value={alt.label}>
												Correcta: {alt.label}
											</option>
										))}
									</select>
								</div>
								{(generated.alternatives.length > 0
									? generated.alternatives
									: defaultAlternatives()
								).map((alt, altIndex) => (
									<label key={alt.label} className="grid gap-1">
										<span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
											Opción {alt.label}
										</span>
										<input
											value={alt.text}
											onChange={(ev) =>
												updateGeneratedAlternative(altIndex, ev.target.value)
											}
											placeholder={`Texto de la alternativa ${alt.label}…`}
											className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
										/>
									</label>
								))}
							</div>
						) : (
							<textarea
								value={generated.answer ?? ""}
								onChange={(ev) =>
									onGeneratedChange({ answer: ev.target.value || null })
								}
								placeholder="Respuesta esperada…"
								className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
							/>
						)}
						<textarea
							value={generated.source_note ?? ""}
							onChange={(ev) =>
								onGeneratedChange({ source_note: ev.target.value || null })
							}
							placeholder="Nota breve sobre por qué esta pregunta ayuda…"
							className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
						/>
					</div>
				) : null}

				{isMC ? (
					<ol className="mt-3 flex flex-col gap-1.5">
						{alternatives.map((alt) => (
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
				) : null}
			</div>
		</li>
	);
}
