import { notFound, redirect } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { getCurrentTeacher } from "../../lib/auth";
import { getPlanificacionAction } from "../../actions/planificacion";
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

	return (
		<main className="bitacora-dashboard-shell" style={{ maxWidth: "none" }}>
			<Navbar teacherName={teacher.name} active="planificacion" />

			<section className="bitacora-hero">
				<div className="max-w-4xl">
					<p className="bitacora-kicker">Bitácora · planificación anual</p>
					<h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] tracking-[-0.05em] text-slate-950">
						Audiencia con <span className="text-vermilion">UTP</span> sobre tu
						planificación.
					</h1>
				</div>
			</section>

			<section className="mt-10">
				<EditorClient initialPlan={plan} />
			</section>
		</main>
	);
}
