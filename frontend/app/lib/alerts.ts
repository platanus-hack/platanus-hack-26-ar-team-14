import "server-only";

import { getToken } from "./auth";
import {
	getCourseByBackendName,
	type CourseRecord,
	type UrgencyLevel,
} from "./bitacora-data";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export type BackendAlert = {
	id: number;
	course_id: number;
	course_name: string;
	severity: "low" | "medium" | "high" | string;
	observations: string[];
};

const SEVERITY_TO_URGENCY: Record<string, UrgencyLevel> = {
	high: "Alta",
	medium: "Media",
	low: "Baja",
};

function severityToUrgency(severity: string): UrgencyLevel {
	return SEVERITY_TO_URGENCY[severity.toLowerCase()] ?? "Media";
}

export async function listAlerts(): Promise<BackendAlert[]> {
	const token = await getToken();
	if (!token) return [];
	try {
		const res = await fetch(`${BACKEND_URL}/alerts`, {
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		});
		if (!res.ok) return [];
		return (await res.json()) as BackendAlert[];
	} catch {
		return [];
	}
}

function alertToCourseRecord(alert: BackendAlert): CourseRecord {
	const mock = getCourseByBackendName(alert.course_name);
	const urgency = severityToUrgency(alert.severity);
	const observations =
		alert.observations.length > 0
			? alert.observations
			: ["Alerta sin observaciones registradas."];

	if (mock) {
		return {
			...mock,
			id: String(alert.course_id),
			urgency,
			issues: observations,
			curricularGap: Math.max(mock.curricularGap, observations.length),
		};
	}

	const [subject, ...rest] = alert.course_name.split(" - ");
	const courseName = rest.join(" - ") || alert.course_name;
	return {
		id: String(alert.course_id),
		backendCourseName: alert.course_name,
		subject: subject || alert.course_name,
		courseName,
		shortName: alert.course_name,
		urgency,
		expectedOAs: 0,
		taughtOAs: 0,
		curricularGap: observations.length,
		planningProgress: 0,
		learningProgress: 0,
		issues: observations,
		subtitle: "",
		expectedWeekLabel: "",
		expectedVsActual: "",
		highlightReason: "",
		weeks: [],
		initialChatMessage: observations.join("\n\n"),
	};
}

export async function getDashboardAlertCourses(): Promise<CourseRecord[]> {
	const alerts = await listAlerts();
	return alerts.map(alertToCourseRecord);
}

