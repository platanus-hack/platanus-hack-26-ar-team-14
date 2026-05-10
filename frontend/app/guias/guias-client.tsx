"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteGuiaAction, type GuiaSummary } from "../actions/guias";

type Props = {
	guias: GuiaSummary[];
};

type SortKey = "id" | "name" | "questions";
type SortDir = "asc" | "desc";

export function GuiasClient({ guias }: Props) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const [busyId, setBusyId] = useState<number | null>(null);
	const [query, setQuery] = useState("");
	const [sortKey, setSortKey] = useState<SortKey>("id");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	function onDelete(id: number, label: string) {
		if (!window.confirm(`¿Borrar la guía "${label}"?`)) return;
		setBusyId(id);
		startTransition(async () => {
			try {
				await deleteGuiaAction(id);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusyId(null);
			}
		});
	}

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir(key === "name" ? "asc" : "desc");
		}
	}

	const rows = useMemo(() => {
		const term = query.trim().toLowerCase();
		const list = term
			? guias.filter(
					(g) =>
						g.name.toLowerCase().includes(term) ||
						g.oa_codes.some((c) => c.toLowerCase().includes(term)),
				)
			: [...guias];
		list.sort((a, b) => {
			const dir = sortDir === "asc" ? 1 : -1;
			if (sortKey === "name") return dir * a.name.localeCompare(b.name);
			if (sortKey === "questions")
				return dir * (a.question_count - b.question_count);
			return dir * (a.id - b.id);
		});
		return list;
	}, [guias, query, sortKey, sortDir]);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="font-mono text-[10px] uppercase tracking-[0.35em] text-vermilion">
						{guias.length} {guias.length === 1 ? "guía" : "guías"} guardadas
					</p>
					<p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
						Tu archivero. Cada guía es una colección de preguntas del banco
						lista para imprimir o repartir.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<input
						value={query}
						onChange={(ev) => setQuery(ev.target.value)}
						placeholder="Buscar por título u OA…"
						className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
					/>
					<Link href="/guias/editor" className="bitacora-primary-button">
						+ Crear guía nueva
					</Link>
				</div>
			</div>

			{error ? (
				<pre className="whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
					{error}
				</pre>
			) : null}

			{guias.length === 0 ? (
				<div className="bitacora-card flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
					<p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">
						Archivero vacío
					</p>
					<h2 className="max-w-md font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-tight tracking-tight text-slate-900">
						Aún no has armado ninguna guía.
					</h2>
					<Link href="/guias/editor" className="bitacora-primary-button mt-2">
						Crear mi primera guía
					</Link>
				</div>
			) : (
				<div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-left">
							<thead>
								<tr className="border-b border-slate-200 bg-slate-50/60">
									<Th
										width="80px"
										sortable
										active={sortKey === "id"}
										dir={sortDir}
										onClick={() => toggleSort("id")}
									>
										#
									</Th>
									<Th
										sortable
										active={sortKey === "name"}
										dir={sortDir}
										onClick={() => toggleSort("name")}
									>
										Título
									</Th>
									<Th width="280px">OAs cubiertos</Th>
									<Th
										width="140px"
										sortable
										active={sortKey === "questions"}
										dir={sortDir}
										onClick={() => toggleSort("questions")}
										align="right"
									>
										Preguntas
									</Th>
									<Th width="120px" align="right">
										&nbsp;
									</Th>
								</tr>
							</thead>
							<tbody>
								{rows.map((g, idx) => (
									<tr
										key={g.id}
										onClick={() => router.push(`/guias/editor/${g.id}`)}
										className={[
											"group cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-vermilion/5",
											idx % 2 === 1 ? "bg-slate-50/30" : "",
										].join(" ")}
									>
										<td className="px-5 py-3 align-middle font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
											#{g.id.toString().padStart(3, "0")}
										</td>
										<td className="px-5 py-3 align-middle">
											<span className="font-display text-[18px] leading-tight tracking-tight text-slate-900">
												{g.name}
											</span>
										</td>
										<td className="px-5 py-3 align-middle">
											{g.oa_codes.length === 0 ? (
												<span className="font-mono text-[11px] text-slate-300">
													—
												</span>
											) : (
												<div className="flex flex-wrap gap-1">
													{g.oa_codes.map((code) => (
														<span
															key={code}
															className="rounded-full border border-vermilion/30 bg-vermilion/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-vermilion"
														>
															{code}
														</span>
													))}
												</div>
											)}
										</td>
										<td className="px-5 py-3 text-right align-middle">
											<span className="font-mono text-[12px] text-slate-700">
												{g.question_count}
											</span>
											<span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
												{g.question_count === 1 ? "preg." : "pregs."}
											</span>
										</td>
										<td className="px-5 py-3 text-right align-middle">
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onDelete(g.id, g.name);
												}}
												disabled={pending && busyId === g.id}
												className="opacity-0 transition-opacity group-hover:opacity-100 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-vermilion hover:bg-vermilion/10 disabled:opacity-30"
											>
												{pending && busyId === g.id ? "Borrando…" : "Borrar"}
											</button>
										</td>
									</tr>
								))}
								{rows.length === 0 ? (
									<tr>
										<td
											colSpan={5}
											className="px-5 py-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400"
										>
											Sin resultados para «{query}»
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

function Th({
	children,
	width,
	align = "left",
	sortable = false,
	active = false,
	dir = "asc",
	onClick,
}: {
	children: React.ReactNode;
	width?: string;
	align?: "left" | "right";
	sortable?: boolean;
	active?: boolean;
	dir?: SortDir;
	onClick?: () => void;
}) {
	const arrow = active ? (dir === "asc" ? "↑" : "↓") : sortable ? "↕" : "";
	return (
		<th
			style={width ? { width } : undefined}
			className={[
				"px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.25em]",
				active ? "text-vermilion" : "text-slate-500",
				align === "right" ? "text-right" : "text-left",
			].join(" ")}
		>
			{sortable ? (
				<button
					type="button"
					onClick={onClick}
					className="inline-flex items-center gap-1 hover:text-slate-900"
				>
					<span>{children}</span>
					<span className="text-[9px] opacity-60">{arrow}</span>
				</button>
			) : (
				children
			)}
		</th>
	);
}
