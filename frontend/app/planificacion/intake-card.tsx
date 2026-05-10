"use client";

import { Check, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { TeacherCourse } from "../lib/auth";

const AUDIT_STEPS = [
	"Leyendo el PDF de tu plan",
	"Extrayendo OAs, unidades y secuencia",
	"Cruzando contra el Programa de Estudio del Mineduc",
	"Verificando cobertura por unidad",
	"Revisando factibilidad mensual",
	"Preparando informe",
];
const STEP_DURATION_MS = 2800;

function AuditProgress({ active }: { active: boolean }) {
	const [step, setStep] = useState(0);

	useEffect(() => {
		if (!active) {
			setStep(0);
			return;
		}
		const id = window.setInterval(() => {
			setStep((s) => Math.min(s + 1, AUDIT_STEPS.length - 1));
		}, STEP_DURATION_MS);
		return () => window.clearInterval(id);
	}, [active]);

	if (!active) return null;

	return (
		<section
			role="status"
			aria-live="polite"
			className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm"
		>
			<div className="flex items-center justify-between">
				<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-vermilion">
					Brunito audita tu plan
				</p>
				<span className="text-[11px] tabular-nums text-slate-400">
					{Math.min(step + 1, AUDIT_STEPS.length)} / {AUDIT_STEPS.length}
				</span>
			</div>
			<ol className="flex flex-col gap-2 text-sm">
				{AUDIT_STEPS.map((label, idx) => {
					const done = idx < step;
					const isActive = idx === step;
					const tone = done
						? "text-slate-400"
						: isActive
							? "text-slate-900"
							: "text-slate-300";
					return (
						<li
							key={label}
							className={`flex items-center gap-2.5 transition-colors duration-300 ${tone}`}
						>
							<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
								{done ? (
									<Check
										size={16}
										strokeWidth={2.5}
										className="text-emerald-600"
									/>
								) : isActive ? (
									<Loader2
										size={16}
										strokeWidth={2.5}
										className="animate-spin text-vermilion"
									/>
								) : (
									<span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
								)}
							</span>
							<span className={isActive ? "font-medium" : ""}>{label}</span>
						</li>
					);
				})}
			</ol>
		</section>
	);
}

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

					<AuditProgress active={extracting} />

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
