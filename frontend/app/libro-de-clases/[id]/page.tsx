import { notFound, redirect } from "next/navigation";
import { getRecordAction } from "../../actions/libro-de-clases";
import { getCurrentTeacher } from "../../lib/auth";
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

	return <RegistroClient teacherName={teacher.name} record={record} />;
}
