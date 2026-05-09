import { notFound, redirect } from "next/navigation";
import { Navbar } from "../../../components/navbar";
import { getCurrentTeacher } from "../../../lib/auth";
import {
	getGuiaAction,
	listBankQuestionsAction,
} from "../../../actions/guias";
import { EditorClient } from "../editor-client";

type Params = { id: string };

export default async function EditGuiaPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const { id } = await params;
	const guiaId = Number.parseInt(id, 10);
	if (!Number.isFinite(guiaId)) notFound();

	const [bank, guia] = await Promise.all([
		listBankQuestionsAction(),
		getGuiaAction(guiaId).catch(() => null),
	]);
	if (!guia) notFound();

	return (
		<main
			className="bitacora-dashboard-shell"
			style={{ maxWidth: "none", width: "100%", padding: "20px 16px 48px" }}
		>
			<Navbar teacherName={teacher.name} active="guias" />
			<section className="mt-4">
				<EditorClient bank={bank} initialGuia={guia} />
			</section>
		</main>
	);
}
