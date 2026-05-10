import { ResetDemoButton } from "../components/reset-demo-button";

export const dynamic = "force-dynamic";

export default function ResetPage() {
	return (
		<main className="grid min-h-screen place-items-center bg-slate-50 p-6">
			<div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
				<h1 className="text-lg font-semibold text-slate-900">
					Resetear demo
				</h1>
				<p className="text-sm text-slate-600">
					Borra y recrea los datos de <code>ana@demo.cl</code> y{" "}
					<code>ana2@demo.cl</code>. Pensado para volver a un estado limpio
					antes de una presentación.
				</p>
				<ResetDemoButton />
			</div>
		</main>
	);
}
