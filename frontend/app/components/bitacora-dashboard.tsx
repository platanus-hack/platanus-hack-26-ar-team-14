"use client";

import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { LearningRecord } from "../actions/libro-de-clases";
import { getCategoryTone, scheduleDays } from "../lib/bitacora-data";
import type { CourseStatus } from "../lib/courses-status";
import type { TeacherCourse } from "../lib/auth";
import { Navbar } from "./navbar";

type ScheduleDay = (typeof scheduleDays)[number];

type DashboardProps = {
	teacherName: string;
	coursesStatus: CourseStatus[];
	teacherCourses: TeacherCourse[];
	pendingRecords: LearningRecord[];
};

function getCourseStatusHref(row: CourseStatus): string {
	if (row.category === "accion" && row.sub_tags.includes("sin_plan")) {
		return "/planificacion";
	}
	// "Falta material", "Desalineado" y "Al día" todos abren la vista combinada
	// del curso (libro + plan + chat) en su pestaña de planificación. El
	// `intent` le dice a Brunito por qué llegó el docente, así arranca el
	// análisis automáticamente (qué subir / qué revisar) en vez de un saludo
	// neutro.
	const base = `/libro-de-clases/${row.course_id}?source=course&tab=planificacion`;
	if (row.category === "accion") return `${base}&intent=subir_material`;
	if (row.category === "desalineado") return `${base}&intent=revisar_registro`;
	return base;
}

function getCourseStatusCta(row: CourseStatus): string {
	if (row.category === "accion" && row.sub_tags.includes("sin_plan")) {
		return "Vincular plan";
	}
	if (row.category === "accion") return "Subir material";
	if (row.category === "desalineado") return "Revisar registro";
	return "Ver curso";
}

function getCourseStatusLabel(row: CourseStatus): string {
	if (row.category === "accion" && row.sub_tags.includes("sin_plan")) {
		return "Falta plan";
	}
	if (row.category === "accion") return "Falta material";
	return getCategoryTone(row.category).label;
}

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
// highlight del día actual funcione consistente en cualquier navegador/zona
// durante el demo. Asume miércoles 13; la hora sí corre en tiempo real.
const CURRENT_WEEKDAY: (typeof scheduleDays)[number] = "Miércoles";

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

function getCurrentTimeMin() {
	const now = new Date();
	return now.getHours() * 60 + now.getMinutes();
}

export function BitacoraDashboard({
	teacherName,
	coursesStatus,
	teacherCourses,
	pendingRecords,
}: DashboardProps) {
	const [showAlert, setShowAlert] = useState(false);
	const [currentLineTop, setCurrentLineTop] = useState<number | null>(null);
	const alertRef = useRef<HTMLElement | null>(null);
	const gridRef = useRef<HTMLDivElement | null>(null);
	const atTopRef = useRef(true);
	const slotsByDay = getCoursesByDay(teacherCourses);
	const visibleDays: ScheduleDay[] = [...scheduleDays];

	const actionableCount = coursesStatus.filter(
		(row) => row.category !== "al_dia",
	).length;


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

			const nowMin = getCurrentTimeMin();
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

			<section className="bitacora-section-block mt-2">
				<header className="bitacora-section-header">
					<h2 className="bitacora-section-title">Libro de clases</h2>
					<p className="bitacora-section-subtitle">
						Registra las clases que dictaste y mantén tu cuaderno al día.
					</p>
				</header>
				{pendingRecords.length > 0 ? (
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
				) : (
					<div className="bitacora-section-empty">
						<span className="bitacora-section-empty-icon">
							<CheckCircle2 size={20} strokeWidth={2.2} />
						</span>
						<div className="bitacora-section-empty-text">
							<p className="bitacora-section-empty-title">Estás al día</p>
							<p className="bitacora-section-empty-subtitle">
								No hay clases pendientes por registrar.
							</p>
						</div>
					</div>
				)}
			</section>

			<section className="bitacora-section-block">
				<header className="bitacora-section-header">
					<h2 className="bitacora-section-title">Planes de estudio</h2>
					<p className="bitacora-section-subtitle">
						Revisa el avance de cada curso y actúa donde haga falta.
					</p>
				</header>
				{coursesStatus.length === 0 ? (
					<div className="bitacora-section-empty">
						<span className="bitacora-section-empty-icon">
							<CheckCircle2 size={20} strokeWidth={2.2} />
						</span>
						<div className="bitacora-section-empty-text">
							<p className="bitacora-section-empty-title">Todo en orden</p>
							<p className="bitacora-section-empty-subtitle">
								Tus cursos están al día — sin seguimientos pendientes.
							</p>
						</div>
					</div>
				) : (
					<>
						{actionableCount > 0 && (
							<section
								ref={alertRef}
								className={`bitacora-alert-banner ${showAlert ? "bitacora-alert-banner-visible" : ""}`}
							>
								<h1 className="bitacora-alert-title">
									{teacherName}, {actionableCount}{" "}
									{actionableCount === 1
										? "de tus cursos requiere"
										: "de tus cursos requieren"}{" "}
									tu atención.
								</h1>
							</section>
						)}

						<ul className="flex flex-col gap-3">
							{coursesStatus.map((row, index) => {
								const tone = getCategoryTone(row.category);
								return (
									<li key={row.id}>
										<Link
											href={getCourseStatusHref(row)}
											className="bitacora-course-card flex flex-col gap-2"
											style={{
												animationDelay: `${900 + Math.min(index, 8) * 60}ms`,
											}}
										>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<span
													className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.surface} ${tone.border} ${tone.accent}`}
												>
													<span
														className={`inline-block h-2 w-2 rounded-full ${tone.dot}`}
														aria-hidden
													/>
													{getCourseStatusLabel(row)}
												</span>
												<span className="bitacora-course-cta">
													{getCourseStatusCta(row)}
													<ArrowRight
														className="bitacora-course-cta-icon"
														size={14}
														strokeWidth={2.5}
													/>
												</span>
											</div>
											<h3 className="font-display text-[clamp(1rem,1.4vw,1.25rem)] leading-tight tracking-[-0.02em] text-slate-950">
												{row.name}
											</h3>
											{row.reasons.length > 0 && (
												<ul className="flex flex-col gap-1 text-sm leading-snug text-slate-700">
													{row.reasons.slice(0, 3).map((reason) => (
														<li
															key={reason}
															className="flex items-start gap-2"
														>
															<ChevronRight
																className={`mt-[3px] shrink-0 ${tone.accent}`}
																size={14}
																strokeWidth={2.5}
																aria-hidden
															/>
															<span>{reason}</span>
														</li>
													))}
												</ul>
											)}
										</Link>
									</li>
								);
							})}
						</ul>
					</>
				)}
			</section>

			<section className="bitacora-calendar-section mt-8">
				<div className="mb-3 text-center">
					<h2 className="bitacora-section-title">Tu calendario semanal</h2>
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
										href={`/libro-de-clases/${slot.course.id}?source=course&tab=planificacion`}
										className="bitacora-calendar-event bitacora-calendar-event-filled"
									>
										<span className="bitacora-calendar-event-cta">
											Ver curso
											<ArrowRight size={11} strokeWidth={2.5} />
										</span>
										<p className="text-[0.95rem] font-display leading-[1.05] tracking-[-0.03em] text-slate-950">
											{slot.course.name}
										</p>
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
			</section>
		</main>
	);
}
