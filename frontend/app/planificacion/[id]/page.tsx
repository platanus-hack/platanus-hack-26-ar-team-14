import { notFound, redirect } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { getCurrentTeacher } from "../../lib/auth";
import {
	getPlanificacionAction,
	listCoursesAction,
} from "../../actions/planificacion";
import { CourseLinker } from "./course-linker";
import { EditorClient } from "./editor-client";

type Params = { id: string };

export default async function PlanificacionEditorPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const { id } = await params;
	const planId = Number.parseInt(id, 10);
	if (!Number.isFinite(planId)) notFound();

	const plan = await getPlanificacionAction(planId).catch(() => null);
	if (!plan) notFound();

	const courses = await listCoursesAction().catch(() => []);

	return (
		<main className="bitacora-dashboard-shell" style={{ maxWidth: "none" }}>
			<Navbar teacherName={teacher.name} active="planificacion" />

			<section className="bitacora-hero">
				<div className="max-w-4xl">
					<p className="bitacora-kicker">Bitácora · planificación anual</p>
					<h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] tracking-[-0.05em] text-slate-950">
						<span className="text-vermilion">Brunito</span> audita tu
						planificación.
					</h1>
				</div>
			</section>

			<section className="mt-10">
				<CourseLinker planId={plan.id} initialCourses={courses} />
			</section>

			<section className="mt-6">
				<EditorClient initialPlan={plan} teacherName={teacher.name} />
			</section>
		</main>
	);
}
