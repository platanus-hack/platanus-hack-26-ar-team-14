"use client";

import { useState, useTransition } from "react";
import {
	type CourseSummary,
	setCoursePlanAction,
} from "../../actions/planificacion";

export function CourseLinker({
	planId,
	initialCourses,
}: {
	planId: number;
	initialCourses: CourseSummary[];
}) {
	const [courses, setCourses] = useState<CourseSummary[]>(initialCourses);
	const [pendingId, setPendingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [, startTransition] = useTransition();

	function toggle(course: CourseSummary) {
		const linkedToThis = course.plan_anual_id === planId;
		const next = linkedToThis ? null : planId;
		setPendingId(course.id);
		setError(null);
		startTransition(async () => {
			try {
				const updated = await setCoursePlanAction(course.id, next);
				setCourses((prev) =>
					prev.map((c) => (c.id === updated.id ? updated : c)),
				);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setPendingId(null);
			}
		});
	}

	const linkedCount = courses.filter((c) => c.plan_anual_id === planId).length;

	return (
		<article className="bitacora-card p-5">
			<header className="flex items-baseline justify-between gap-3">
				<div>
					<p className="bitacora-kicker">Cursos vinculados</p>
					<h2 className="mt-1 text-base font-semibold text-slate-900">
						Asocia este plan a uno o más cursos
					</h2>
					<p className="mt-1 text-xs text-slate-600">
						Los cursos vinculados usarán esta planificación como su plan anual.
					</p>
				</div>
				<span className="text-xs font-semibold text-slate-500">
					{linkedCount} / {courses.length}
				</span>
			</header>

			{courses.length === 0 ? (
				<p className="mt-4 text-sm text-slate-500">
					No tienes cursos creados todavía.
				</p>
			) : (
				<ul className="mt-4 grid gap-2 sm:grid-cols-2">
					{courses.map((course) => {
						const linkedToThis = course.plan_anual_id === planId;
						const linkedToOther =
							course.plan_anual_id !== null && !linkedToThis;
						const busy = pendingId === course.id;
						return (
							<li key={course.id}>
								<label
									className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
										linkedToThis
											? "border-vermilion/40 bg-vermilion/5"
											: "border-slate-200 bg-white hover:bg-slate-50"
									} ${busy ? "opacity-60" : ""}`}
								>
									<input
										type="checkbox"
										className="mt-1 h-4 w-4 accent-vermilion"
										checked={linkedToThis}
										disabled={busy}
										onChange={() => toggle(course)}
									/>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-slate-900">
											{course.name}
										</p>
										<p className="text-xs text-slate-600">
											{linkedToThis
												? "Vinculado a este plan"
												: linkedToOther
													? `Vinculado a otro plan (#${course.plan_anual_id})`
													: "Sin plan asignado"}
										</p>
									</div>
								</label>
							</li>
						);
					})}
				</ul>
			)}

			{error ? (
				<p className="mt-3 text-xs font-semibold text-vermilion">{error}</p>
			) : null}
		</article>
	);
}
