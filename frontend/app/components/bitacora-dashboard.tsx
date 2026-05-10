"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { LearningRecord } from "../actions/libro-de-clases";
import type { CourseRecord } from "../lib/bitacora-data";
import { getUrgencyTone, scheduleDays } from "../lib/bitacora-data";
import type { TeacherCourse } from "../lib/auth";
import { Navbar } from "./navbar";

type ScheduleDay = (typeof scheduleDays)[number];

type DashboardProps = {
	teacherName: string;
	priorityCourses: CourseRecord[];
	teacherCourses: TeacherCourse[];
	pendingRecords: LearningRecord[];
};

const SPANISH_MONTHS = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

// TODO: derivar del Date real cuando saquemos el demo. Hardcoded para que la
// highlight del día actual y la línea de "ahora" funcionen consistentes en
// cualquier navegador/zona durante el demo. Asume miércoles 13 a las 9:30 AM.
const CURRENT_WEEKDAY: (typeof scheduleDays)[number] = "Miércoles";
const CURRENT_TIME_MIN = 9 * 60 + 30;

const SPANISH_WEEKDAYS = [
	"domingo",
	"lunes",
	"martes",
	"miércoles",
	"jueves",
	"viernes",
	"sábado",
];

function formatClassDate(iso: string): string {
	// iso is YYYY-MM-DD; build a local Date so we don't shift across timezones.
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	const weekday = SPANISH_WEEKDAYS[date.getDay()];
	const month = SPANISH_MONTHS[date.getMonth()];
	return `${weekday} ${date.getDate()} de ${month}`;
}

const DAY_MAP: Record<string, ScheduleDay> = {
	monday: "Lunes",
	tuesday: "Martes",
	wednesday: "Miércoles",
	thursday: "Jueves",
	friday: "Viernes",
};

const HOUR_SLOTS = Array.from(
	{ length: 10 },
	(_, i) => `${String(i + 8).padStart(2, "0")}:00`,
);

type DaySlot = {
	course: TeacherCourse;
	startRow: number;
	rowSpan: number;
};

function getCoursesByDay(
	courses: TeacherCourse[],
): Map<ScheduleDay, DaySlot[]> {
	const out = new Map<ScheduleDay, DaySlot[]>();
	const totalRows = HOUR_SLOTS.length;
	for (const course of courses) {
		const blockIdx = Math.min(
			Math.max((course.block_number ?? 1) - 1, 0),
			totalRows - 1,
		);
		for (const raw of course.class_days ?? []) {
			const day = DAY_MAP[raw.toLowerCase()];
			if (!day) continue;
			const list = out.get(day) ?? [];
			list.push({ course, startRow: blockIdx, rowSpan: 1 });
			out.set(day, list);
		}
	}
	return out;
}

export function BitacoraDashboard({
	teacherName,
	priorityCourses,
	teacherCourses,
	pendingRecords,
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
	const slotsByDay = getCoursesByDay(teacherCourses);
	const visibleDays: ScheduleDay[] = [...scheduleDays];


	useEffect(() => {
		atTopRef.current = window.scrollY <= 8;

		const timeout = window.setTimeout(() => {
			const shouldPushContent = atTopRef.current;
			const nextHeight = alertRef.current?.scrollHeight ?? 0;

			if (!shouldPushContent && nextHeight > 0) {
				window.scrollBy({ top: nextHeight + 30, left: 0, behavior: "auto" });
			}

			setShowAlert(true);
		}, 1300);

		return () => window.clearTimeout(timeout);
	}, []);

	useEffect(() => {
		function parseTime(t: string): number {
			const [h, m] = t.split(":").map(Number);
			return h * 60 + (m ?? 0);
		}

		function update() {
			const grid = gridRef.current;
			if (!grid || HOUR_SLOTS.length === 0) return;

			// Hardcoded para el demo (ver CURRENT_TIME_MIN arriba).
			const nowMin = CURRENT_TIME_MIN;
			const slotMins = HOUR_SLOTS.map(parseTime);
			const firstMin = slotMins[0];
			const lastMin = slotMins[slotMins.length - 1];

			const nodes = HOUR_SLOTS.reduce<HTMLElement[]>((acc, time) => {
				const node = grid.querySelector<HTMLElement>(`[data-time="${time}"]`);
				if (node) {
					acc.push(node);
				}
				return acc;
			}, []);
			if (nodes.length !== HOUR_SLOTS.length) return;

			let top: number;
			if (nowMin <= firstMin) {
				top = nodes[0].offsetTop;
			} else if (nowMin >= lastMin) {
				const last = nodes[nodes.length - 1];
				top = last.offsetTop + last.offsetHeight;
			} else {
				let idx = 0;
				while (idx < slotMins.length - 1 && slotMins[idx + 1] <= nowMin) {
					idx++;
				}
				const before = nodes[idx];
				const after = nodes[idx + 1];
				const ratio =
					(nowMin - slotMins[idx]) / (slotMins[idx + 1] - slotMins[idx]);
				top =
					before.offsetTop + ratio * (after.offsetTop - before.offsetTop);
			}

			const first = nodes[0];
			const last = nodes[nodes.length - 1];
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
	}, []);

	return (
		<main className="bitacora-dashboard-shell">
			<Navbar teacherName={teacherName} active="cuaderno" />

			{pendingRecords.length > 0 && (
				<>
					<section className="bitacora-pending-banner">
						<h2 className="bitacora-pending-banner-title">
							{teacherName}, todavía tienes que registrar{" "}
							{pendingRecords.length}{" "}
							{pendingRecords.length === 1 ? "clase" : "clases"} en el libro de
							clases.
						</h2>
					</section>
					<section className="bitacora-pending-section">
						<ul className="bitacora-pending-list">
							{pendingRecords.map((record, index) => (
								<li key={record.id}>
									<Link
										href={`/libro-de-clases/${record.id}`}
										className="bitacora-pending-card"
										style={{
											animationDelay: `${730 + Math.min(index, 7) * 50}ms`,
										}}
									>
										<div className="bitacora-pending-card-info">
											<span className="bitacora-pending-card-course">
												{record.course_name}
											</span>
											<span className="bitacora-pending-card-date">
												{formatClassDate(record.class_date)}
											</span>
										</div>
										<span className="bitacora-pending-card-cta">
											Registrar
											<ArrowRight size={12} strokeWidth={2.5} />
										</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				</>
			)}

			<section
				ref={alertRef}
				className={`bitacora-alert-banner ${showAlert ? "bitacora-alert-banner-visible" : ""}`}
			>
				<h1 className="bitacora-alert-title">
					{teacherName}, tienes que modificar la planificación de{" "}
					{priorityCourses.length}{" "}
					{priorityCourses.length === 1 ? "curso" : "cursos"}.
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
							style={{ animationDelay: `${1900 + index * 120}ms` }}
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

				<div className="bitacora-calendar-board">
					<div
						className="bitacora-calendar-grid"
						ref={gridRef}
						style={{
							gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))`,
						}}
					>
						<div className="bitacora-calendar-corner" />
						{visibleDays.map((day) => (
							<div
								key={day}
								className={`bitacora-calendar-header${day === CURRENT_WEEKDAY ? " bitacora-calendar-header-today" : ""}`}
							>
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

							{HOUR_SLOTS.map((time, rowIdx) => (
							<Fragment key={time}>
								<div
									className="bitacora-calendar-time"
									data-time={time}
									style={{ gridColumn: 1, gridRow: rowIdx + 2 }}
								>
									{time}
								</div>
								{visibleDays.map((day, dayIdx) => {
									const slots = slotsByDay.get(day) ?? [];
									const occupied = slots.some(
										(s) => rowIdx >= s.startRow && rowIdx < s.startRow + s.rowSpan,
									);
									if (occupied) return null;
									return (
										<div
											key={`${day}-${time}`}
											className="bitacora-calendar-slot bitacora-calendar-slot-empty"
											style={{ gridColumn: dayIdx + 2, gridRow: rowIdx + 2 }}
										/>
									);
								})}
							</Fragment>
						))}

						{visibleDays.map((day, dayIdx) => {
							const slots = slotsByDay.get(day) ?? [];
							return slots.map((slot) => (
								<div
									key={`${day}-${slot.course.id}`}
									className="bitacora-calendar-slot"
									style={{
										gridColumn: dayIdx + 2,
										gridRow: `${slot.startRow + 2} / span ${slot.rowSpan}`,
									}}
								>
									<Link
										href={`/course/${slot.course.id}`}
										className="bitacora-calendar-event bitacora-calendar-event-filled"
									>
										<span className="bitacora-calendar-event-cta">
											Ver curso
											<ArrowRight size={11} strokeWidth={2.5} />
										</span>
										<p className="text-[0.95rem] font-display leading-[1.05] tracking-[-0.03em] text-slate-950">
											{slot.course.name}
										</p>
										<span
											className={`mt-auto inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${neutralTone.surface} ${neutralTone.border} ${neutralTone.accent}`}
										>
											Bloque de clase
										</span>
									</Link>
								</div>
							));
						})}

						{visibleDays.includes(CURRENT_WEEKDAY) ? (
							<div
								className="bitacora-calendar-day-highlight"
								style={{
									gridColumn: visibleDays.indexOf(CURRENT_WEEKDAY) + 2,
									gridRow: `2 / ${HOUR_SLOTS.length + 2}`,
								}}
								aria-hidden
							/>
						) : null}
					</div>
				</div>

				<p className="mt-4 text-center text-xs italic text-slate-500">
					Urgencia según alineación con tu planificación anual
				</p>
				<ul className="bitacora-calendar-legend mt-2">
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
			</section>
		</main>
	);
}
