import { notFound, redirect } from "next/navigation";
import {
	getRecordAction,
	listCourseRecordsAction,
} from "../../actions/libro-de-clases";
import { getPlanificacionAction, type Plan } from "../../actions/planificacion";
import { getCurrentTeacher, getTeacherCourses } from "../../lib/auth";
import { RegistroClient } from "./registro-client";

type PageProps = {
	params: Promise<{ id: string }>;
};

export default async function LibroDeClasesPage({ params }: PageProps) {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const { id } = await params;
	const recordId = Number(id);
	if (!Number.isFinite(recordId)) notFound();

	let record;
	try {
		record = await getRecordAction(recordId);
	} catch {
		notFound();
	}

	let courseRecords;
	try {
		courseRecords = await listCourseRecordsAction(record.course_id);
	} catch {
		courseRecords = [record];
	}

	let plan: Plan | null = null;
	try {
		const courses = await getTeacherCourses();
		const course = courses.find((c) => c.id === record.course_id) ?? null;
		if (course?.plan_anual_id != null) {
			plan = await getPlanificacionAction(course.plan_anual_id).catch(() => null);
		}
	} catch {
		plan = null;
	}

	return (
		<RegistroClient
			teacherName={teacher.name}
			record={record}
			courseRecords={courseRecords}
			plan={plan}
		/>
	);
}
