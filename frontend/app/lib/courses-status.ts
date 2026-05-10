import "server-only";

import { getToken } from "./auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export type CourseStatusCategory = "accion" | "desalineado" | "al_dia";

export type CourseStatus = {
	id: string;
	course_id: number;
	name: string;
	plan_anual_id: number | null;
	category: CourseStatusCategory;
	sub_tags: string[];
	reasons: string[];
	manual_alert_ids: number[];
};

export async function getCoursesStatus(): Promise<CourseStatus[]> {
	const token = await getToken();
	if (!token) return [];
	try {
		const res = await fetch(`${BACKEND_URL}/dashboard/courses-status`, {
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		});
		if (!res.ok) return [];
		return (await res.json()) as CourseStatus[];
	} catch {
		return [];
	}
}
