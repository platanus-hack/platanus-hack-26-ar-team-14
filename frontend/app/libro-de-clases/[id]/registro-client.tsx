"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import {
	type LearningRecord,
	registerRecordAction,
} from "../../actions/libro-de-clases";
import { Navbar } from "../../components/navbar";

type Props = {
	teacherName: string;
	record: LearningRecord;
};

const SPANISH_MONTHS = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

const SPANISH_WEEKDAYS = [
	"domingo",
	"lunes",
	"martes",
	"miércoles",
	"jueves",
	"viernes",
	"sábado",
];

function formatLongDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return `${SPANISH_WEEKDAYS[date.getDay()]} ${date.getDate()} de ${SPANISH_MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

export function RegistroClient({ teacherName, record }: Props) {
	const router = useRouter();
	const [oaInput, setOaInput] = useState(
		(record.oa_numbers ?? []).join(", "),
	);
	const [observations, setObservations] = useState(record.observations ?? "");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		const oaNumbers = oaInput
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		if (oaNumbers.length === 0) {
			setError("Indica al menos un OA cubierto en la clase.");
			return;
		}
		startTransition(async () => {
			try {
				await registerRecordAction(record.id, {
					oa_numbers: oaNumbers,
					observations: observations.trim() || null,
				});
				router.push("/");
				router.refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Error al registrar.");
			}
		});
	}

	return (
		<main className="bitacora-dashboard-shell">
			<Navbar teacherName={teacherName} active="cuaderno" />

			<div className="mb-4">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
				>
					<ArrowLeft size={14} strokeWidth={2.5} />
					Volver al cuaderno
				</Link>
			</div>

			<header className="mb-6">
				<span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#9a5a00]">
					Libro de clases
				</span>
				<h1 className="mt-1 font-display text-[clamp(1.4rem,2.4vw,2rem)] leading-[1] tracking-[-0.03em] text-slate-950">
					Registrar clase
				</h1>
				<p className="mt-2 text-sm text-slate-600">
					{record.course_name} ·{" "}
					<span className="capitalize">
						{formatLongDate(record.class_date)}
					</span>
				</p>
			</header>

			<form
				onSubmit={handleSubmit}
				className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
			>
				<div className="grid gap-2">
					<label
						htmlFor="oa-numbers"
						className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
					>
						OAs cubiertos
					</label>
					<input
						id="oa-numbers"
						type="text"
						value={oaInput}
						onChange={(e) => setOaInput(e.target.value)}
						placeholder="ej: OA1, OA4, OA7"
						className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						disabled={pending}
					/>
					<p className="text-xs text-slate-500">
						Separa los códigos con comas.
					</p>
				</div>

				<div className="grid gap-2">
					<label
						htmlFor="observations"
						className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
					>
						Observaciones
					</label>
					<textarea
						id="observations"
						value={observations}
						onChange={(e) => setObservations(e.target.value)}
						placeholder="Actividad realizada, comportamiento del curso, ajustes…"
						rows={5}
						className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						disabled={pending}
					/>
				</div>

				{error && (
					<p className="text-sm text-red-600" role="alert">
						{error}
					</p>
				)}

				<div className="flex items-center justify-end gap-3">
					<Link
						href="/"
						className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Cancelar
					</Link>
					<button
						type="submit"
						disabled={pending}
						className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
					>
						{pending ? "Guardando…" : "Guardar registro"}
					</button>
				</div>
			</form>
		</main>
	);
}
