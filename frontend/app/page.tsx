import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "./components/logout-button";
import { getCurrentTeacher } from "./lib/auth";
import {
	getCourseById,
	getPriorityCourses,
	getUrgencyTone,
	scheduleDays,
	weeklySchedule,
} from "./lib/bitacora-data";

export default async function Home() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const priorityCourses = getPriorityCourses();

	return (
		<main className="bitacora-dashboard-shell">
			<section className="bitacora-hero">
				<div className="flex flex-wrap items-start justify-between gap-6">
					<div className="max-w-4xl">
						<p className="bitacora-kicker">Bitácora · copiloto pedagógico</p>
						<h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.92] tracking-[-0.06em] text-slate-950">
							{teacher.name}, necesitamos corregir {priorityCourses.length}{" "}
							planes esta semana.
						</h1>
						<p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
							Priorizamos tus cursos según brecha curricular, aprendizaje medido
							y avance respecto de la planificación anual.
						</p>
					</div>

					<div className="flex items-center gap-4 rounded-full border border-white/65 bg-white/75 px-5 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
						<div>
							<p className="text-sm font-medium text-slate-500">Profesor</p>
							<p className="text-base font-semibold text-slate-900">
								{teacher.name}
							</p>
						</div>
						<LogoutButton />
					</div>
				</div>
			</section>

			<section className="mt-10 space-y-5">
				{priorityCourses.map((course) => {
					const tone = getUrgencyTone(course.urgency);

					return (
						<article key={course.id} className="bitacora-card">
							<div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr_0.8fr]">
								<div>
									<div className="flex flex-wrap items-center gap-3">
										<span className="bitacora-kicker">{course.subject}</span>
										<span
											className={`rounded-full border px-3 py-1 text-sm font-semibold ${tone.surface} ${tone.border} ${tone.accent}`}
										>
											Urgencia {course.urgency.toLowerCase()}
										</span>
									</div>
									<h2 className="mt-3 font-display text-[clamp(2rem,3vw,3rem)] leading-[0.95] tracking-[-0.04em] text-slate-950">
										{course.courseName}
									</h2>
									<p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
										{course.highlightReason}
									</p>

									<ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
										{course.issues.slice(0, 4).map((issue) => (
											<li key={issue} className="flex gap-3">
												<span
													className={`mt-2 h-2.5 w-2.5 rounded-full ${tone.badge}`}
												/>
												<span>{issue}</span>
											</li>
										))}
									</ul>
								</div>

								<div className="grid grid-cols-2 gap-3 self-start">
									<div className="bitacora-stat-card">
										<span className="bitacora-stat-label">OAs esperados</span>
										<strong className="bitacora-stat-value">
											{course.expectedOAs}
										</strong>
									</div>
									<div className="bitacora-stat-card">
										<span className="bitacora-stat-label">OAs enseñados</span>
										<strong className="bitacora-stat-value">
											{course.taughtOAs}
										</strong>
									</div>
									<div className="bitacora-stat-card">
										<span className="bitacora-stat-label">
											Brecha curricular
										</span>
										<strong className="bitacora-stat-value">
											+{course.curricularGap}
										</strong>
									</div>
									<div className="bitacora-stat-card">
										<span className="bitacora-stat-label">% aprendizaje</span>
										<strong className="bitacora-stat-value">
											{course.learningProgress}%
										</strong>
									</div>
									<div className="bitacora-stat-card col-span-2">
										<span className="bitacora-stat-label">% planificación</span>
										<strong className="bitacora-stat-value">
											{course.planningProgress}%
										</strong>
									</div>
								</div>

								<div className="flex flex-col justify-between gap-5">
									<div
										className={`rounded-[24px] border px-5 py-5 ${tone.surface} ${tone.border}`}
									>
										<p className="bitacora-kicker">Por qué se prioriza</p>
										<p className="mt-3 text-base leading-7 text-slate-700">
											Debería llevar {course.expectedOAs} OAs enseñados y solo
											lleva {course.taughtOAs}. La brecha curricular actual es
											de {course.curricularGap} OAs.
										</p>
									</div>

									<Link
										href={`/course/${course.id}`}
										className="bitacora-primary-button justify-center text-center"
									>
										Solucionar plan
									</Link>
								</div>
							</div>
						</article>
					);
				})}
			</section>

			<section className="mt-12">
				<div className="mb-5 flex items-end justify-between gap-4">
					<div>
						<p className="bitacora-kicker">Calendario semanal</p>
						<h2 className="mt-2 font-display text-[clamp(2rem,3vw,3rem)] leading-[0.95] tracking-[-0.04em] text-slate-950">
							Dónde se concentra la urgencia esta semana
						</h2>
					</div>
					<p className="max-w-md text-sm leading-6 text-slate-500">
						Cada bloque toma el color del curso según su brecha curricular
						medida hoy.
					</p>
				</div>

				<div className="grid gap-4 lg:grid-cols-5">
					{scheduleDays.map((day) => (
						<div key={day} className="bitacora-calendar-day">
							<div className="border-b border-slate-200/80 px-4 py-4">
								<p className="font-medium text-slate-900">{day}</p>
							</div>
							<div className="space-y-3 px-3 py-4">
								{weeklySchedule
									.filter((block) => block.day === day)
									.map((block) => {
										const course = getCourseById(block.courseId);
										if (!course) return null;
										const tone = getUrgencyTone(course.urgency);
										const needsCorrection = course.curricularGap > 0;

										return (
											<Link
												key={`${day}-${block.time}-${block.courseId}`}
												href={`/course/${course.id}`}
												className={`bitacora-calendar-block ${tone.surface} ${tone.border}`}
											>
												<div className="flex items-center justify-between gap-3">
													<span className="text-sm font-semibold text-slate-900">
														{block.time}
													</span>
													{needsCorrection ? (
														<span
															className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.accent}`}
														>
															requiere corrección
														</span>
													) : (
														<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
															al día
														</span>
													)}
												</div>
												<p className="mt-3 text-base font-semibold leading-6 text-slate-900">
													{block.shortLabel}
												</p>
												{needsCorrection ? (
													<p
														className={`mt-2 text-sm font-medium ${tone.accent}`}
													>
														+{course.curricularGap} OA
														{course.curricularGap > 1 ? "s" : ""}
													</p>
												) : (
													<p className="mt-2 text-sm font-medium text-slate-500">
														Sin atraso curricular
													</p>
												)}
											</Link>
										);
									})}
							</div>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
