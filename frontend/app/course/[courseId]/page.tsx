import { notFound, redirect } from "next/navigation";
import { BitacoraCourseWorkspace } from "../../components/bitacora-course-workspace";
import { getCurrentTeacher, getTeacherCourses } from "../../lib/auth";
import { getCourseByBackendName, getCourseById } from "../../lib/bitacora-data";

type CoursePageProps = {
	params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");
	const teacherCourses = await getTeacherCourses();

	const { courseId } = await params;
	const backendCourseId = Number.parseInt(courseId, 10);
	const realCourse = Number.isFinite(backendCourseId)
		? teacherCourses.find((course) => course.id === backendCourseId) ?? null
		: null;
	const mockCourse = realCourse
		? getCourseByBackendName(realCourse.name)
		: getCourseById(courseId);
	const linkedCourse =
		realCourse ??
		(mockCourse
			? teacherCourses.find(
					(course) => course.name === mockCourse.backendCourseName,
				) ?? null
			: null);

	if (!mockCourse || !linkedCourse || linkedCourse.plan_anual_id === null) notFound();

	return (
		<BitacoraCourseWorkspace
			course={mockCourse}
			agentContext={{
				backendCourseId: linkedCourse.id,
				backendCourseName: linkedCourse.name,
				planId: linkedCourse.plan_anual_id,
			}}
		/>
	);
}
