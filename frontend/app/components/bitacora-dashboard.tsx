"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { CourseRecord, WeeklyBlock } from "../lib/bitacora-data";
import {
	getCourseById,
	getUrgencyTone,
	scheduleDays,
} from "../lib/bitacora-data";
import { Navbar } from "./navbar";

type DashboardProps = {
	teacherName: string;
	priorityCourses: CourseRecord[];
	weeklySchedule: WeeklyBlock[];
};

function getScheduleMap(blocks: WeeklyBlock[]) {
	return new Map(
		blocks.map((block) => [`${block.day}-${block.time}`, block] as const),
	);
}

export function BitacoraDashboard({
	teacherName,
	priorityCourses,
	weeklySchedule,
}: DashboardProps) {
	const neutralTone = {
		badge: "bg-slate-300",
		border: "border-slate-200/90",
		surface: "bg-slate-50",
		accent: "text-slate-500",
	};
	const [showAlert, setShowAlert] = useState(false);
	const alertRef = useRef<HTMLElement | null>(null);
	const atTopRef = useRef(true);
	const scheduleMap = getScheduleMap(weeklySchedule);
	const localScheduleTimes = Array.from(
		new Set(weeklySchedule.map((block) => block.time)),
	).toSorted();

	useEffect(() => {
		atTopRef.current = window.scrollY <= 8;

		const timeout = window.setTimeout(() => {
			const shouldPushContent = atTopRef.current;
			const nextHeight = alertRef.current?.scrollHeight ?? 0;

			if (!shouldPushContent && nextHeight > 0) {
				window.scrollBy({ top: nextHeight + 30, left: 0, behavior: "auto" });
			}

			setShowAlert(true);
		}, 950);

		return () => window.clearTimeout(timeout);
	}, []);

	return (
		<main className="bitacora-dashboard-shell">
			<Navbar teacherName={teacherName} active="cuaderno" />

			<section
				ref={alertRef}
				className={`bitacora-alert-banner ${showAlert ? "bitacora-alert-banner-visible" : ""}`}
			>
				<h1 className="bitacora-alert-title">
					{teacherName}, necesitamos corregir {priorityCourses.length} planes
					esta semana.
				</h1>
			</section>

			<section className="mt-8">
				<div className="mb-4 text-center">
					<h2 className="bitacora-calendar-title">
						Cursos según nivel de urgencia
					</h2>
					<p className="bitacora-section-subtitle">
						Ordenados por brecha curricular
					</p>
				</div>

				<div className="bitacora-priority-rail">
					<div className="bitacora-priority-rail-inner">
						{priorityCourses.map((course, index) => {
							const tone =
								course.curricularGap > 0
									? getUrgencyTone(course.urgency)
									: neutralTone;

							return (
								<Link
									key={course.id}
									href={`/course/${course.id}`}
									className="bitacora-course-card"
									style={{ animationDelay: `${index * 120}ms` }}
								>
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
												<h2 className="font-display text-[clamp(1.7rem,2.6vw,2.55rem)] leading-[0.95] tracking-[-0.05em] text-slate-950">
													{course.subject}
												</h2>
												<span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
													{course.courseName}
												</span>
											</div>
										</div>
										<span
											className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.surface} ${tone.border} ${tone.accent}`}
										>
											Urgencia {course.urgency.toLowerCase()} ·{" "}
											{course.curricularGap} OA
											{course.curricularGap > 1 ? "s" : ""} de atraso
										</span>
									</div>

									<ul className="mt-5 grid gap-0 text-sm leading-6 text-slate-700">
										{course.issues.slice(0, 4).map((issue, issueIndex) => (
											<li
												key={issue}
												className={`bitacora-course-issue ${
													issueIndex < course.issues.slice(0, 4).length - 1
														? "bitacora-course-issue-divider"
														: ""
												}`}
											>
												<span
													className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${tone.badge}`}
												/>
												<span className="bitacora-course-issue-text">
													{issue}
												</span>
											</li>
										))}
									</ul>
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			<section className="mt-8">
				<div className="mb-4 text-center">
					<h2 className="bitacora-calendar-title">Calendario semanal</h2>
					<p className="bitacora-section-subtitle">
						Cada bloque toma el color del curso según su brecha curricular
					</p>
				</div>

				<div className="bitacora-calendar-board">
					<div className="bitacora-calendar-grid">
						<div className="bitacora-calendar-corner" />
						{scheduleDays.map((day) => (
							<div key={day} className="bitacora-calendar-header">
								{day}
							</div>
						))}

						{localScheduleTimes.map((time) => (
							<Fragment key={time}>
								<div className="bitacora-calendar-time">{time}</div>
								{scheduleDays.map((day) => {
									const block = scheduleMap.get(`${day}-${time}`);
									if (!block) {
										return (
											<div
												key={`${day}-${time}`}
												className="bitacora-calendar-slot bitacora-calendar-slot-empty"
											/>
										);
									}

									const course = getCourseById(block.courseId);
									if (!course) {
										return (
											<div
												key={`${day}-${time}`}
												className="bitacora-calendar-slot bitacora-calendar-slot-empty"
											/>
										);
									}

									const needsCorrection = course.curricularGap > 0;
									const tone = needsCorrection
										? getUrgencyTone(course.urgency)
										: neutralTone;

									return (
										<div
											key={`${day}-${time}`}
											className="bitacora-calendar-slot"
										>
											<Link
												href={`/course/${course.id}`}
												className={`bitacora-calendar-event ${tone.surface} ${tone.border}`}
											>
												<div className="flex items-start justify-between gap-2">
													<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
														{course.courseName}
													</p>
													<span
														className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
															needsCorrection ? tone.accent : "text-slate-500"
														}`}
													>
														{needsCorrection ? "corregir" : "al día"}
													</span>
												</div>
												<p className="mt-2 text-[1.18rem] font-display leading-[0.98] tracking-[-0.04em] text-slate-950">
													{block.shortLabel}
												</p>
												<p
													className={`mt-auto pt-2 text-sm font-medium ${
														needsCorrection ? tone.accent : "text-slate-500"
													}`}
												>
													{needsCorrection
														? `Atraso de ${course.curricularGap} OA${
																course.curricularGap > 1 ? "s" : ""
															}`
														: "Sin atraso curricular"}
												</p>
											</Link>
										</div>
									);
								})}
							</Fragment>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
