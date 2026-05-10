"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { PlanSummary } from "../actions/planificacion";
import type { TeacherCourse } from "../lib/auth";
import { CreatedPlansDrawer } from "./created-plans-drawer";
import { IntakeCard } from "./intake-card";

type Props = {
	courses: TeacherCourse[];
	planes: PlanSummary[];
};

export function UploadClient({ courses, planes }: Props) {
	const router = useRouter();
	const [courseId, setCourseId] = useState<number | null>(() =>
		courses.length === 1 ? courses[0].id : null,
	);
	const [file, setFile] = useState<File | null>(null);
	const [extracting, setExtracting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	async function onUpload(e: FormEvent) {
		e.preventDefault();
		if (!file || courseId === null || extracting) return;
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
		<div
			className="mx-auto grid w-full max-w-5xl items-start gap-5 lg:grid-cols-[var(--drawer-col)_minmax(0,1fr)]"
			style={
				{
					"--drawer-col": drawerOpen ? "320px" : "240px",
				} as React.CSSProperties
			}
		>
			<CreatedPlansDrawer
				planes={planes}
				open={drawerOpen}
				onToggle={() => setDrawerOpen((v) => !v)}
			/>

			<IntakeCard
				courses={courses}
				courseId={courseId}
				file={file}
				extracting={extracting}
				error={error}
				onCourseChange={setCourseId}
				onFileChange={setFile}
				onSubmit={onUpload}
			/>
		</div>
	);
}
