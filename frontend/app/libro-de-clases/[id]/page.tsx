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
	searchParams: Promise<{ source?: string; tab?: string }>;
};

export default async function LibroDeClasesPage({
	params,
	searchParams,
}: PageProps) {
	const teacher = await getCurrentTeacher();
	if (!teacher) redirect("/login");

	const [{ id }, { source, tab }] = await Promise.all([params, searchParams]);
	const resourceId = Number(id);
	if (!Number.isFinite(resourceId)) notFound();

	let record;
	let courseRecords;

	if (source === "course") {
		try {
			courseRecords = await listCourseRecordsAction(resourceId);
		} catch {
			notFound();
		}
		record = courseRecords.at(-1);
		if (!record) notFound();
	} else {
		try {
			record = await getRecordAction(resourceId);
		} catch {
			notFound();
		}

		try {
			courseRecords = await listCourseRecordsAction(record.course_id);
		} catch {
			courseRecords = [record];
		}
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

	const initialTab = tab === "planificacion" && plan ? "planificacion" : "libro";

	return (
		<RegistroClient
			teacherName={teacher.name}
			record={record}
			courseRecords={courseRecords}
			plan={plan}
			initialTab={initialTab}
		/>
	);
}
