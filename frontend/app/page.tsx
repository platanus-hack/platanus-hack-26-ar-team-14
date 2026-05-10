import { redirect } from "next/navigation";
import { BitacoraDashboard } from "./components/bitacora-dashboard";
import { getCurrentTeacher, getTeacherCourses } from "./lib/auth";
import { getPriorityCourses } from "./lib/bitacora-data";

export default async function Home() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const teacherCourses = await getTeacherCourses();

	return (
		<BitacoraDashboard
			teacherName={teacher.name}
			priorityCourses={getPriorityCourses()}
			teacherCourses={teacherCourses}
		/>
	);
}
