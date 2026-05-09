import { redirect } from "next/navigation";
import { BitacoraDashboard } from "./components/bitacora-dashboard";
import { getCurrentTeacher } from "./lib/auth";
import { getPriorityCourses, weeklySchedule } from "./lib/bitacora-data";

export default async function Home() {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	return (
		<BitacoraDashboard
			teacherName={teacher.name}
			priorityCourses={getPriorityCourses()}
			weeklySchedule={weeklySchedule}
		/>
	);
}
