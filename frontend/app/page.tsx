import { redirect } from "next/navigation";
import { listPendingRecordsAction } from "./actions/libro-de-clases";
import { BitacoraDashboard } from "./components/bitacora-dashboard";
import { getCurrentTeacher, getTeacherCourses } from "./lib/auth";
import { getPriorityCourses } from "./lib/bitacora-data";

export default async function Home() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const [teacherCourses, pendingRecords] = await Promise.all([
		getTeacherCourses(),
		listPendingRecordsAction().catch(() => []),
	]);

	return (
		<BitacoraDashboard
			teacherName={teacher.name}
			priorityCourses={getPriorityCourses()}
			teacherCourses={teacherCourses}
			pendingRecords={pendingRecords}
		/>
	);
}
