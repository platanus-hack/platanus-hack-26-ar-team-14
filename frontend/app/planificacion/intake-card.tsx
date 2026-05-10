"use client";

import type { FormEvent } from "react";
import type { TeacherCourse } from "../lib/auth";

type Props = {
	courses: TeacherCourse[];
	courseId: number | null;
	file: File | null;
	extracting: boolean;
	error: string | null;
	onCourseChange: (id: number | null) => void;
	onFileChange: (file: File | null) => void;
	onSubmit: (e: FormEvent) => void;
};

function courseLabel(name: string): string {
	return name.replace(" - ", " · ");
}

export function IntakeCard({
	courses,
	courseId,
	file,
	extracting,
	error,
	onCourseChange,
	onFileChange,
	onSubmit,
}: Props) {
	const hasCourses = courses.length > 0;
	const canSubmit = courseId !== null && file !== null && !extracting;

	return (
		<article className="bitacora-card flex flex-col gap-6">
			<header>
				<p className="bitacora-kicker">Bitácora · planificación anual</p>
				<h2 className="mt-2 font-display text-[clamp(1.6rem,2.4vw,2.4rem)] leading-tight tracking-tight text-slate-950">
					Sube tu propuesta de planificación anual
				</h2>
			</header>

			<p className="text-base leading-7 text-slate-600">
				Carga el PDF y nuestro agente lo audita contra el Programa de Estudio
				del Mineduc para el curso y la materia que indiques.
			</p>

			{!hasCourses ? (
				<p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
					Aún no tienes cursos asignados. Pídele al equipo administrativo que te
					asigne uno antes de cargar una planificación.
				</p>
			) : (
				<form onSubmit={onSubmit} className="flex flex-col gap-5">
					<label className="flex flex-col gap-2">
						<span className="bitacora-kicker">Curso</span>
						<select
							value={courseId ?? ""}
							onChange={(ev) => {
								const v = ev.target.value;
								onCourseChange(v ? Number(v) : null);
							}}
							className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
						>
							<option value="">Elige el curso y la materia</option>
							{courses.map((c) => (
								<option key={c.id} value={c.id}>
									{courseLabel(c.name)}
								</option>
							))}
						</select>
					</label>

					<label className="flex flex-col gap-2">
						<span className="bitacora-kicker">Propuesta en PDF</span>
						<input
							type="file"
							accept="application/pdf"
							onChange={(ev) => onFileChange(ev.target.files?.[0] ?? null)}
							disabled={courseId === null}
							className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						/>
						{courseId === null ? (
							<span className="text-xs text-slate-400">
								Primero elige el curso y la materia.
							</span>
						) : null}
					</label>

					<button
						type="submit"
						className="bitacora-primary-button self-start"
						disabled={!canSubmit}
					>
						{extracting ? "Auditando…" : "Iniciar auditoría"}
					</button>

					{error ? (
						<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
							{error}
						</pre>
					) : null}
				</form>
			)}
		</article>
	);
}
