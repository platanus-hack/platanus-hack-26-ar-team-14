import { notFound, redirect } from "next/navigation";
import { BitacoraCourseWorkspace } from "../../components/bitacora-course-workspace";
import { getCurrentTeacher } from "../../lib/auth";
import { getCourseById } from "../../lib/bitacora-data";

type CoursePageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/login");

  const { courseId } = await params;
  const course = getCourseById(courseId);
  if (!course) notFound();

  return <BitacoraCourseWorkspace course={course} />;
}
