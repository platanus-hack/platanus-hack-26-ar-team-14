"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function UploadClient() {
	const router = useRouter();
	const [file, setFile] = useState<File | null>(null);
	const [extracting, setExtracting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onUpload(e: FormEvent) {
		e.preventDefault();
		if (!file || extracting) return;
		setExtracting(true);
		setError(null);
		try {
			const fd = new FormData();
			fd.set("file", file);
			const res = await fetch("/api/planificacion/extract", {
				method: "POST",
				body: fd,
			});
			if (!res.ok) throw new Error(await res.text());
			const out = (await res.json()) as { id: number };
			router.push(`/planificacion/${out.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setExtracting(false);
		}
	}

	return (
		<article className="bitacora-card mx-auto w-full max-w-3xl">
			<form onSubmit={onUpload} className="flex flex-col gap-6">
				<div>
					<p className="bitacora-kicker">Momento 1 · revisión con UTP</p>
					<h2 className="mt-2 font-display text-[clamp(1.6rem,2.4vw,2.4rem)] leading-tight tracking-tight text-slate-950">
						Sube tu planificación anual
					</h2>
					<p className="mt-2 text-base text-slate-600">
						Leemos el PDF, lo convertimos a una tabla estructurada y la
						ponemos a revisión con UTP en vivo.
					</p>
				</div>

				<label className="flex flex-col gap-2">
					<span className="bitacora-kicker">Archivo PDF</span>
					<input
						type="file"
						accept="application/pdf"
						onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
						className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
					/>
				</label>

				<button
					type="submit"
					className="bitacora-primary-button self-start"
					disabled={!file || extracting}
				>
					{extracting ? "Extrayendo plan…" : "Iniciar audiencia"}
				</button>

				{error ? (
					<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
						{error}
					</pre>
				) : null}
			</form>
		</article>
	);
}
