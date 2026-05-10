"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
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

function timeHourKey(time: string) {
	const hour = time.split(":")[0];
	return `${hour}:00`;
}

function getScheduleMap(blocks: WeeklyBlock[]) {
	const map = new Map<string, WeeklyBlock>();
	for (const block of blocks) {
		const key = `${block.day}-${timeHourKey(block.time)}`;
		if (!map.has(key)) map.set(key, block);
	}
	return map;
}

const HOUR_SLOTS = Array.from(
	{ length: 10 },
	(_, i) => `${String(i + 8).padStart(2, "0")}:00`,
);

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
	const [currentLineTop, setCurrentLineTop] = useState<number | null>(null);
	const alertRef = useRef<HTMLElement | null>(null);
	const gridRef = useRef<HTMLDivElement | null>(null);
	const atTopRef = useRef(true);
	const scheduleMap = getScheduleMap(weeklySchedule);
	const localScheduleTimes = HOUR_SLOTS;

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

	useEffect(() => {
		function parseTime(t: string): number {
			const [h, m] = t.split(":").map(Number);
			return h * 60 + (m ?? 0);
		}

		function update() {
			const grid = gridRef.current;
			if (!grid || localScheduleTimes.length === 0) return;

			const now = new Date();
			const nowMin = now.getHours() * 60 + now.getMinutes();
			const slotMins = localScheduleTimes.map(parseTime);
			const firstMin = slotMins[0];
			const lastMin = slotMins[slotMins.length - 1];

			const nodes = localScheduleTimes.map(
				(t) =>
					grid.querySelector<HTMLElement>(`[data-time="${t}"]`) ?? null,
			);
			if (nodes.some((n) => !n)) return;

			let top: number;
			if (nowMin <= firstMin) {
				top = nodes[0]!.offsetTop;
			} else if (nowMin >= lastMin) {
				const last = nodes[nodes.length - 1]!;
				top = last.offsetTop + last.offsetHeight;
			} else {
				let idx = 0;
				while (idx < slotMins.length - 1 && slotMins[idx + 1] <= nowMin) {
					idx++;
				}
				const before = nodes[idx]!;
				const after = nodes[idx + 1]!;
				const ratio =
					(nowMin - slotMins[idx]) / (slotMins[idx + 1] - slotMins[idx]);
				top =
					before.offsetTop + ratio * (after.offsetTop - before.offsetTop);
			}

			const first = nodes[0]!;
			const last = nodes[nodes.length - 1]!;
			const minTop = first.offsetTop + 6;
			const maxTop = last.offsetTop + last.offsetHeight - 6;
			top = Math.max(minTop, Math.min(maxTop, top));

			setCurrentLineTop(top);
		}

		update();
		const interval = window.setInterval(update, 60_000);
		const onResize = () => update();
		window.addEventListener("resize", onResize);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener("resize", onResize);
		};
	}, [localScheduleTimes]);

	return (
		<main className="bitacora-dashboard-shell">
			<Navbar teacherName={teacherName} active="cuaderno" />

			<section
				ref={alertRef}
				className={`bitacora-alert-banner ${showAlert ? "bitacora-alert-banner-visible" : ""}`}
			>
				<h1 className="bitacora-alert-title">
					{teacherName}, hay {priorityCourses.length} cursos que necesitan de
					tu atención ahora mismo.
				</h1>
			</section>

			<section className="mt-8 grid gap-[18px] md:grid-cols-2">
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
								<span
									className={`inline-block rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.12em] ${tone.surface} ${tone.border} ${tone.accent}`}
								>
									<span className="uppercase">Urgencia {course.urgency.toLowerCase()}</span>
									{" · "}
									{course.curricularGap} OA
									{course.curricularGap > 1 ? "s" : ""}
									<span className="uppercase"> de atraso</span>
								</span>
								<span className="bitacora-course-cta">
									Solucionar
									<ArrowRight
										className="bitacora-course-cta-icon"
										size={14}
										strokeWidth={2.5}
									/>
								</span>
							</div>
							<div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<h2 className="font-display text-[clamp(1rem,1.6vw,1.4rem)] leading-[0.95] tracking-[-0.03em] text-slate-950">
									{course.subject}
								</h2>
								<span className="font-display text-[clamp(1rem,1.6vw,1.4rem)] leading-[0.95] tracking-[-0.03em] text-slate-950">
									— {course.courseName}
								</span>
							</div>

							<p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
								Qué tienes que hacer
							</p>
							<ul className="mt-1 grid gap-0 text-sm leading-5 text-slate-700">
								{course.issues.slice(0, 4).map((issue, issueIndex) => (
									<li
										key={issue}
										className={`bitacora-course-issue ${
											issueIndex < course.issues.slice(0, 4).length - 1
												? "bitacora-course-issue-divider"
												: ""
										}`}
									>
										<ChevronRight
											className={`bitacora-course-issue-arrow ${tone.accent}`}
											size={16}
											strokeWidth={2.5}
											aria-hidden
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
			</section>

			<section className="bitacora-calendar-section mt-8">
				<div className="mb-3 text-center">
					<h2 className="bitacora-calendar-title">Tu calendario semanal</h2>
				</div>

				<ul className="bitacora-calendar-legend">
					<li className="bitacora-calendar-legend-item">
						<span className="bitacora-calendar-legend-swatch bg-[#fce7e2] border-[#b94b45]/52" />
						Urgencia alta
					</li>
					<li className="bitacora-calendar-legend-item">
						<span className="bitacora-calendar-legend-swatch bg-[#fdf1d8] border-[#d0891a]/52" />
						Urgencia media
					</li>
					<li className="bitacora-calendar-legend-item">
						<span className="bitacora-calendar-legend-swatch bg-[#dbeafe] border-[#3b82f6]/48" />
						Urgencia baja
					</li>
					<li className="bitacora-calendar-legend-item">
						<span className="bitacora-calendar-legend-swatch bg-slate-50 border-slate-200/90" />
						Al día
					</li>
				</ul>

				<div className="bitacora-calendar-board">
					<div className="bitacora-calendar-grid" ref={gridRef}>
						<div className="bitacora-calendar-corner" />
						{scheduleDays.map((day) => (
							<div key={day} className="bitacora-calendar-header">
								{day}
							</div>
						))}

						{currentLineTop !== null && (
							<div
								className="bitacora-calendar-now"
								style={{ top: currentLineTop }}
								aria-hidden
							/>
						)}

						{localScheduleTimes.map((time) => (
							<Fragment key={time}>
								<div className="bitacora-calendar-time" data-time={time}>
									{time}
								</div>
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
												className="bitacora-calendar-event bitacora-calendar-event-filled"
											>
												<span className="bitacora-calendar-event-cta">
													Ver curso
													<ArrowRight size={11} strokeWidth={2.5} />
												</span>
												<p className="text-[0.95rem] font-display leading-[1.05] tracking-[-0.03em] text-slate-950">
													{course.subject}
												</p>
												<p className="text-[0.75rem] leading-[1.1] text-slate-500">
													{course.courseName}
												</p>
												<span
													className={`mt-auto inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
														needsCorrection
															? `${tone.surface} ${tone.border} ${tone.accent}`
															: "bg-slate-50 border-slate-200/90 text-slate-500"
													}`}
												>
													{needsCorrection
														? `Atraso ${course.curricularGap} OA${
																course.curricularGap > 1 ? "s" : ""
															}`
														: "Al día"}
												</span>
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
