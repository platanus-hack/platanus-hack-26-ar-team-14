import { redirect } from "next/navigation";
import { listPendingRecordsAction } from "./actions/libro-de-clases";
import { BitacoraDashboard } from "./components/bitacora-dashboard";
import { getDashboardAlertCourses } from "./lib/alerts";
import { getCurrentTeacher, getTeacherCourses } from "./lib/auth";

export default async function Home() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const [teacherCourses, pendingRecords, alertCourses] = await Promise.all([
		getTeacherCourses(),
		listPendingRecordsAction().catch(() => []),
		getDashboardAlertCourses(),
	]);

	return (
		<BitacoraDashboard
			teacherName={teacher.name}
			priorityCourses={alertCourses}
			teacherCourses={teacherCourses}
			pendingRecords={pendingRecords}
		/>
	);
}
