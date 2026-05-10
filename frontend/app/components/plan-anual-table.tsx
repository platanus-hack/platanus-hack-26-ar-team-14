import type { ReactNode } from "react";
import type { Plan } from "../actions/planificacion";

type Props = {
	plan: Plan;
	headerExtra?: ReactNode;
	className?: string;
};

export function PlanAnualTable({ plan, headerExtra, className }: Props) {
	return (
		<article
			className={`bitacora-card flex min-h-0 flex-col overflow-hidden p-0 ${className ?? ""}`}
		>
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
				{headerExtra}
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
