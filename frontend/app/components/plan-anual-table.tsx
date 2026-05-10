"use client";

import { ArrowDown, Lock, Pencil } from "lucide-react";
import Link from "next/link";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { Material, Plan, PlanItem } from "../actions/planificacion";
import { OaTag } from "./oa-tag";

type Props = {
	plan: Plan;
	headerExtra?: ReactNode;
	className?: string;
};

type OaEntry = { code: string; objetivo: string };

type MonthGroup = {
	mes: string | null;
	unidades: string[];
	oa_entries: OaEntry[];
	materials: Material[];
};

const SPANISH_MONTH_ORDER: Record<string, number> = {
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	septiembre: 9,
	setiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12,
};

function mesSortKey(mes: string | null): number {
	if (!mes) return 99;
	return SPANISH_MONTH_ORDER[mes.trim().toLowerCase()] ?? 98;
}

function groupItemsByMes(items: PlanItem[]): MonthGroup[] {
	const buckets = new Map<string, MonthGroup>();
	for (const item of items) {
		const key = item.mes ?? "__sin_mes__";
		let group = buckets.get(key);
		if (!group) {
			group = {
				mes: item.mes,
				unidades: [],
				oa_entries: [],
				materials: [],
			};
			buckets.set(key, group);
		}
		if (item.unidad && !group.unidades.includes(item.unidad)) {
			group.unidades.push(item.unidad);
		}
		// Each OA in an item shares the item's objetivo text. Dedupe by code:
		// the first occurrence wins (consistent with month order).
		for (const code of item.oa_codes) {
			if (!group.oa_entries.some((e) => e.code === code)) {
				group.oa_entries.push({ code, objetivo: item.objetivo });
			}
		}
		if (
			item.material &&
			!group.materials.some((m) => m.id === item.material!.id)
		) {
			group.materials.push(item.material);
		}
	}
	return [...buckets.values()].sort(
		(a, b) => mesSortKey(a.mes) - mesSortKey(b.mes),
	);
}

function MaterialPill({
	material,
	className,
}: {
	material: Material;
	className?: string;
}) {
	const kindLabel = material.kind === "recurso" ? "Recurso" : "Guía";
	const kindClass =
		material.kind === "recurso"
			? "border-slate-300 bg-slate-50 text-slate-700"
			: "border-emerald-300 bg-emerald-50 text-emerald-700";
	const animSuffix = className ? ` ${className}` : "";

	const inner = (
		<>
			<span
				className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindClass}`}
			>
				{kindLabel}
			</span>
			<span className="truncate">{material.name}</span>
		</>
	);

	if (material.guia_id != null) {
		return (
			<Link
				href={`/guias/editor/${material.guia_id}`}
				className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50${animSuffix}`}
			>
				{inner}
			</Link>
		);
	}
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50${animSuffix}`}
		>
			{inner}
		</span>
	);
}

function groupKeyOf(group: MonthGroup): string {
	return group.mes ?? "__sin_mes__";
}

function computeGroupSig(group: MonthGroup): string {
	return JSON.stringify({
		u: [...group.unidades].sort(),
		o: group.oa_entries
			.map((e) => `${e.code}|${e.objetivo}`)
			.sort(),
		m: group.materials
			.map((m) => `${m.id}|${m.name}|${m.kind}|${m.guia_id ?? ""}`)
			.sort(),
	});
}

export function PlanAnualTable({ plan, headerExtra, className }: Props) {
	const groups = useMemo(() => groupItemsByMes(plan.items), [plan.items]);
	const currentMonthKey = new Date().getMonth() + 1;
	const currentGroupIndex = groups.findIndex(
		(g) => mesSortKey(g.mes) === currentMonthKey,
	);
	const hasCurrent = currentGroupIndex >= 0;

	const currentRowRef = useRef<HTMLTableRowElement | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const [currentVisible, setCurrentVisible] = useState(true);

	const scrollToCurrent = useCallback(() => {
		currentRowRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
	}, []);

	useEffect(() => {
		if (hasCurrent) scrollToCurrent();
	}, [hasCurrent, scrollToCurrent]);

	useEffect(() => {
		const root = scrollContainerRef.current;
		const target = currentRowRef.current;
		if (!root || !target) return;
		const observer = new IntersectionObserver(
			([entry]) => setCurrentVisible(entry.isIntersecting),
			{ root, threshold: 0.4 },
		);
		observer.observe(target);
		return () => observer.disconnect();
	}, [hasCurrent]);

	const seenSigsRef = useRef<Map<string, string>>(new Map());
	const seenOasRef = useRef<Map<string, Set<string>>>(new Map());
	const seenMatsRef = useRef<Map<string, Set<number>>>(new Map());
	const initialDiffRef = useRef(true);
	const animTimeoutRef = useRef<number | null>(null);
	const [changedGroups, setChangedGroups] = useState<Set<string>>(
		() => new Set(),
	);
	const [newOasByGroup, setNewOasByGroup] = useState<Map<string, Set<string>>>(
		() => new Map(),
	);
	const [newMatsByGroup, setNewMatsByGroup] = useState<
		Map<string, Set<number>>
	>(() => new Map());

	useEffect(() => {
		return () => {
			if (animTimeoutRef.current !== null) {
				window.clearTimeout(animTimeoutRef.current);
				animTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const nextChanged = new Set<string>();
		const nextOas = new Map<string, Set<string>>();
		const nextMats = new Map<string, Set<number>>();

		for (const group of groups) {
			const key = groupKeyOf(group);
			const sig = computeGroupSig(group);
			const prevSig = seenSigsRef.current.get(key);
			const prevOas = seenOasRef.current.get(key) ?? new Set<string>();
			const prevMats = seenMatsRef.current.get(key) ?? new Set<number>();

			const currOas = new Set(group.oa_entries.map((e) => e.code));
			const currMats = new Set(group.materials.map((m) => m.id));

			if (!initialDiffRef.current) {
				if (prevSig !== undefined && prevSig !== sig) {
					nextChanged.add(key);
				}
				const addedOas = [...currOas].filter((c) => !prevOas.has(c));
				const addedMats = [...currMats].filter((id) => !prevMats.has(id));
				if (addedOas.length > 0) nextOas.set(key, new Set(addedOas));
				if (addedMats.length > 0) nextMats.set(key, new Set(addedMats));
			}

			seenSigsRef.current.set(key, sig);
			seenOasRef.current.set(key, currOas);
			seenMatsRef.current.set(key, currMats);
		}

		// Drop tracking for removed groups so they don't leak.
		const liveKeys = new Set(groups.map(groupKeyOf));
		for (const k of seenSigsRef.current.keys()) {
			if (!liveKeys.has(k)) {
				seenSigsRef.current.delete(k);
				seenOasRef.current.delete(k);
				seenMatsRef.current.delete(k);
			}
		}

		initialDiffRef.current = false;

		if (nextChanged.size === 0 && nextOas.size === 0 && nextMats.size === 0) {
			return;
		}

		// Replace any in-flight clear: a fresh diff arrived, so the highlight
		// window restarts from now.
		if (animTimeoutRef.current !== null) {
			window.clearTimeout(animTimeoutRef.current);
		}
		setChangedGroups(nextChanged);
		setNewOasByGroup(nextOas);
		setNewMatsByGroup(nextMats);
		animTimeoutRef.current = window.setTimeout(() => {
			animTimeoutRef.current = null;
			setChangedGroups(new Set());
			setNewOasByGroup(new Map());
			setNewMatsByGroup(new Map());
		}, 1700);
	}, [groups]);

	return (
		<article
			className={`bitacora-card flex min-h-0 flex-col overflow-hidden p-0 ${className ?? ""}`}
		>
			<header className="flex items-start justify-between gap-3 border-b border-slate-200/70 border-l-4 border-l-teal bg-teal/[0.03] px-5 py-4">
				<div className="min-w-0">
					<h2 className="font-display text-2xl leading-tight tracking-[-0.02em] text-teal">
						Plan anual
					</h2>
					<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-600">
						{plan.asignatura ? <span>{plan.asignatura}</span> : null}
						{plan.curso ? <span>· {plan.curso}</span> : null}
						{plan.anio ? <span>· {plan.anio}</span> : null}
						{plan.docente ? <span>· {plan.docente}</span> : null}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{hasCurrent ? (
						<button
							type="button"
							onClick={scrollToCurrent}
							title="Volver al mes actual"
							aria-hidden={currentVisible}
							tabIndex={currentVisible ? -1 : 0}
							className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-opacity duration-200 hover:bg-amber-100 ${
								currentVisible ? "pointer-events-none opacity-0" : "opacity-100"
							}`}
						>
							<ArrowDown size={12} strokeWidth={2.5} />
							Ir al mes actual
						</button>
					) : null}
					{headerExtra}
				</div>
			</header>

			<div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto">
				<table className="w-full border-collapse text-[13px]">
					<thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
						<tr>
							<th className="border-b border-slate-200 px-4 py-2.5">Mes</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Unidad</th>
							<th className="border-b border-slate-200 px-4 py-2.5">
								Objetivos de aprendizaje
							</th>
							<th className="border-b border-slate-200 px-4 py-2.5">
								Material docente
							</th>
						</tr>
					</thead>
					<tbody>
						{groups.map((group, idx) => {
							const isCurrent = idx === currentGroupIndex;
							const monthKey = mesSortKey(group.mes);
							const isPast =
								!isCurrent && hasCurrent && monthKey < currentMonthKey;
							const isFuture =
								!isCurrent && (!hasCurrent || monthKey > currentMonthKey);
							const groupKey = groupKeyOf(group);
							const justChanged = changedGroups.has(groupKey);
							const newOasInGroup = newOasByGroup.get(groupKey);
							const newMatsInGroup = newMatsByGroup.get(groupKey);

							let rowClass = "group align-top";
							if (isCurrent) {
								rowClass +=
									" bg-vermilion/5 ring-1 ring-inset ring-vermilion/30";
							} else if (isPast) {
								rowClass += " bg-slate-50/40 text-slate-400";
							} else {
								rowClass += " hover:bg-teal/[0.04]";
							}
							if (justChanged) {
								rowClass += " plan-row-just-changed";
							}

							const monthCellClass = isPast
								? "border-b border-slate-100 px-4 py-2.5 font-medium text-slate-400"
								: "border-b border-slate-100 px-4 py-2.5 font-medium text-slate-800";
							const unidadCellClass = isPast
								? "border-b border-slate-100 px-4 py-2.5 text-slate-400"
								: "border-b border-slate-100 px-4 py-2.5 text-slate-700";
							const cellOpacity = isPast ? "opacity-60" : "";

							return (
								<tr
									key={`${group.mes ?? "sin-mes"}-${idx}`}
									ref={isCurrent ? currentRowRef : undefined}
									className={rowClass}
								>
									<td className={monthCellClass}>
										<span className="inline-flex items-center gap-1.5">
											{group.mes ?? "—"}
											{isPast ? (
												<Lock
													size={11}
													strokeWidth={2}
													className="text-slate-300"
													aria-label="Mes pasado, inmutable"
												/>
											) : null}
											{isFuture ? (
												<Pencil
													size={11}
													strokeWidth={2}
													className="text-teal/50 transition-colors group-hover:text-teal"
													aria-label="Mes futuro, editable"
												/>
											) : null}
										</span>
									</td>
									<td className={unidadCellClass}>
										{group.unidades.length === 0 ? (
											<span className="text-slate-300">—</span>
										) : (
											<div className="flex flex-col gap-0.5">
												{group.unidades.map((u) => (
													<span key={u}>{u}</span>
												))}
											</div>
										)}
									</td>
									<td className={`border-b border-slate-100 px-4 py-2.5 ${cellOpacity}`}>
										<div className="flex flex-wrap gap-1">
											{group.oa_entries.length === 0 ? (
												<span className="text-slate-300">—</span>
											) : (
												group.oa_entries.map((e) => (
													<OaTag
														key={e.code}
														code={e.code}
														objetivo={e.objetivo}
														className={
															newOasInGroup?.has(e.code)
																? "plan-pill-just-added"
																: undefined
														}
													/>
												))
											)}
										</div>
									</td>
									<td className={`border-b border-slate-100 px-4 py-2.5 ${cellOpacity}`}>
										{group.materials.length === 0 ? (
											<span className="text-slate-300">—</span>
										) : (
											<div className="flex flex-col items-start gap-1">
												{group.materials.map((m) => (
													<MaterialPill
														key={m.id}
														material={m}
														className={
															newMatsInGroup?.has(m.id)
																? "plan-pill-just-added"
																: undefined
														}
													/>
												))}
											</div>
										)}
									</td>
								</tr>
							);
						})}
						{groups.length === 0 ? (
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
