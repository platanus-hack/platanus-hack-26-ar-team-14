import { redirect } from "next/navigation";
import { listGuiasAction } from "../actions/guias";
import { Navbar } from "../components/navbar";
import { getCurrentTeacher } from "../lib/auth";
import { GuiasClient } from "./guias-client";

export default async function GuiasPage() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const guias = await listGuiasAction();

	return (
		<main
			className="bitacora-dashboard-shell"
			style={{ maxWidth: "none", width: "100%", padding: "24px 24px 64px" }}
		>
			<Navbar teacherName={teacher.name} active="guias" />

			<section className="mt-8 mb-6">
				<p className="font-mono text-[10px] uppercase tracking-[0.35em] text-vermilion">
					Bitácora · archivero de guías
				</p>
				<h1 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[1] tracking-[-0.04em] text-slate-950">
					Tus <span className="text-vermilion italic">guías</span>.
				</h1>
			</section>

			<section className="mt-6">
				<GuiasClient guias={guias} />
			</section>
		</main>
	);
}
