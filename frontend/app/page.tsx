import { redirect } from "next/navigation";
import { listPendingRecordsAction } from "./actions/libro-de-clases";
import { BitacoraDashboard } from "./components/bitacora-dashboard";
import { getCurrentTeacher, getTeacherCourses } from "./lib/auth";
import { getCoursesStatus } from "./lib/courses-status";

export default async function Home() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const [teacherCourses, pendingRecords, coursesStatus] = await Promise.all([
		getTeacherCourses(),
		listPendingRecordsAction().catch(() => []),
		getCoursesStatus(),
	]);

	return (
		<BitacoraDashboard
			teacherName={teacher.name}
			coursesStatus={coursesStatus}
			teacherCourses={teacherCourses}
			pendingRecords={pendingRecords}
		/>
	);
}
