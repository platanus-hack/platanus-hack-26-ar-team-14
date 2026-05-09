import { redirect } from "next/navigation";
import { PageShell, PageTitle, Topbar } from "../components/notebook";
import { getCurrentTeacher } from "../lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
	const teacher = await getCurrentTeacher();
	if (teacher) redirect("/");

	return (
		<PageShell>
			<Topbar />
			<PageTitle
				pre="Entra a tu"
				emphasis="cuaderno"
				post="."
				subtitle="Inicia sesión con tu cuenta de profesor para continuar la planificación."
			/>
			<div className="paper-card mr-2 mb-2 px-6 py-6 sm:px-7">
				<LoginForm />
			</div>
		</PageShell>
	);
}
