"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { PlanSummary } from "../actions/planificacion";

type Props = {
	planes: PlanSummary[];
	open: boolean;
	onToggle: () => void;
};

export function CreatedPlansDrawer({ planes, open, onToggle }: Props) {
	const count = planes.length;

	return (
		<aside className="bitacora-card flex flex-col gap-3 self-start p-5">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				aria-controls="created-plans-list"
				className="flex w-full items-center justify-between gap-3 text-left"
			>
				<span>
					<span className="bitacora-kicker block">Tu archivero</span>
					<span className="mt-1 block font-display text-[clamp(1.1rem,1.6vw,1.4rem)] leading-tight tracking-tight text-slate-950">
						Ver planes creados {count > 0 ? `(${count})` : ""}
					</span>
				</span>
				<ChevronRight
					size={18}
					strokeWidth={2.4}
					className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
				/>
			</button>

			{open ? (
				<div id="created-plans-list" className="mt-1">
					{count === 0 ? (
						<p className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm italic text-slate-500">
							Cuando subas tu primer PDF aparecerá acá.
						</p>
					) : (
						<ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
							{planes.map((p) => (
								<li key={p.id}>
									<Link
										href={`/planificacion/${p.id}`}
										className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2.5 transition-colors hover:border-vermilion/40 hover:bg-vermilion/5"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900">
												{p.name}
											</p>
											<p className="text-[10px] uppercase tracking-wider text-slate-400">
												#{p.id}
											</p>
										</div>
										<span className="shrink-0 text-xs font-semibold text-slate-500 transition-colors group-hover:text-vermilion">
											Abrir →
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}
		</aside>
	);
}
