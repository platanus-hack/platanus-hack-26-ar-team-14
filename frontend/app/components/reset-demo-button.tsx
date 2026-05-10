"use client";

import { RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { resetDemoAction } from "../actions/demo";

export function ResetDemoButton() {
	const [pending, startTransition] = useTransition();

	const onClick = () => {
		if (pending) return;
		if (
			!window.confirm(
				"¿Resetear el demo? Esto borra y recrea los datos de ana@demo.cl y ana2@demo.cl.",
			)
		) {
			return;
		}
		startTransition(async () => {
			const result = await resetDemoAction();
			if ("error" in result) {
				window.alert(`No se pudo resetear: ${result.error}`);
				return;
			}
			window.location.href = "/";
		});
	};

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={pending}
			className="inline-flex items-center gap-2 rounded-full bg-vermilion px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
		>
			<RotateCcw
				size={16}
				strokeWidth={2}
				className={pending ? "animate-spin" : undefined}
			/>
			{pending ? "Reseteando…" : "Resetear demo"}
		</button>
	);
}
