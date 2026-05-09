import { redirect } from "next/navigation";
import { listBankQuestionsAction } from "../../actions/guias";
import { Navbar } from "../../components/navbar";
import { getCurrentTeacher } from "../../lib/auth";
import { EditorClient } from "./editor-client";

export default async function GuiaEditorPage() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const bank = await listBankQuestionsAction();

	return (
		<main
			className="bitacora-dashboard-shell"
			style={{ maxWidth: "none", width: "100%", padding: "20px 16px 48px" }}
		>
			<Navbar teacherName={teacher.name} active="guias" />
			<section className="mt-4">
				<EditorClient bank={bank} />
			</section>
		</main>
	);
}
