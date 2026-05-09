import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { getCurrentTeacher } from "../lib/auth";
import { PlanificacionClient } from "./planificacion-client";

export default async function PlanificacionPage() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

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
					<p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
						Sube tu planificación anual en PDF: el jefe de UTP la audita en
						tiempo real, marca brechas frente a los 27 OA del nivel y propone
						ajustes con OA y página del Programa.
					</p>
				</div>
			</section>

			<section className="mt-10">
				<PlanificacionClient />
			</section>
		</main>
	);
}
