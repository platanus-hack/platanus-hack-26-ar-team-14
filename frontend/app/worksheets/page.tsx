import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { getCurrentTeacher } from "../lib/auth";
import { WorksheetsClient } from "./worksheets-client";

export default async function WorksheetsPage() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	return (
		<main className="bitacora-dashboard-shell" style={{ maxWidth: "none" }}>
			<Navbar teacherName={teacher.name} active="guias" />

			<section className="bitacora-hero">
				<div className="max-w-4xl">
					<p className="bitacora-kicker">Bitácora · banco de preguntas</p>
					<h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] tracking-[-0.05em] text-slate-950">
						Banco de <span className="text-vermilion">preguntas</span> para tus
						guías.
					</h1>
					<p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
						Sube guías en PDF: extraemos cada pregunta con su OA, contenido e
						imagen para que después armes nuevas guías combinándolas.
					</p>
				</div>
			</section>

			<section className="mt-10">
				<WorksheetsClient />
			</section>
		</main>
	);
}
