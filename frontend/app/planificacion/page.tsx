import Link from "next/link";
import { redirect } from "next/navigation";
import { listPlanificacionesAction } from "../actions/planificacion";
import { Navbar } from "../components/navbar";
import { getCurrentTeacher } from "../lib/auth";
import { UploadClient } from "./upload-client";

export default async function PlanificacionPage() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const planes = await listPlanificacionesAction().catch(() => []);

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

			<section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
				<UploadClient />

				<article className="bitacora-card flex flex-col gap-5">
					<header>
						<p className="bitacora-kicker">Planes existentes</p>
						<h2 className="mt-2 font-display text-[clamp(1.4rem,2vw,2rem)] leading-tight tracking-tight text-slate-950">
							{planes.length === 0
								? "Aún no subiste ninguno"
								: `${planes.length} plan${planes.length === 1 ? "" : "es"} en revisión`}
						</h2>
					</header>

					{planes.length === 0 ? (
						<p className="text-sm text-slate-500">
							Cuando subas tu primer PDF aparecerá acá. Cada plan se guarda
							para que puedas seguir editándolo después con UTP.
						</p>
					) : (
						<ul className="flex flex-col gap-2">
							{planes.map((p) => (
								<li key={p.id}>
									<Link
										href={`/planificacion/${p.id}`}
										className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 transition-colors hover:border-vermilion/40 hover:bg-vermilion/5"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900">
												{p.name}
											</p>
											<p className="text-[11px] uppercase tracking-wider text-slate-400">
												#{p.id}
											</p>
										</div>
										<span className="shrink-0 text-sm font-semibold text-slate-500 transition-colors group-hover:text-vermilion">
											Abrir →
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</article>
			</section>
		</main>
	);
}
