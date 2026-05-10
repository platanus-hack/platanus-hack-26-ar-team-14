import { redirect } from "next/navigation";
import { listPlanificacionesAction } from "../actions/planificacion";
import { Navbar } from "../components/navbar";
import { getCurrentTeacher, getTeacherCourses } from "../lib/auth";
import { UploadClient } from "./upload-client";

export default async function PlanificacionPage() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const [planes, courses] = await Promise.all([
		listPlanificacionesAction().catch(() => []),
		getTeacherCourses(),
	]);

	return (
		<main className="bitacora-dashboard-shell" style={{ maxWidth: "none" }}>
			<Navbar teacherName={teacher.name} active="planificacion" />

			<UploadClient courses={courses} planes={planes} />
		</main>
	);
}
