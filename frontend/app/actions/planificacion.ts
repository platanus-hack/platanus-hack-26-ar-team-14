"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "../lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export type MaterialKind = "guia" | "recurso";

export type Material = {
	id: number;
	name: string;
	kind: MaterialKind;
	guia_id: number | null;
};

export type PlanItem = {
	id: number;
	ordinal: number;
	mes: string | null;
	unidad: string | null;
	oa_codes: string[];
	objetivo: string;
	material: Material | null;
};

export type Plan = {
	id: number;
	name: string;
	asignatura: string | null;
	curso: string | null;
	anio: number | null;
	docente: string | null;
	items: PlanItem[];
};

export type PlanSummary = {
	id: number;
	name: string;
};

async function authedFetch(path: string, init?: RequestInit) {
	const token = await getToken();
	if (!token) throw new Error("Sesión expirada");
	const headers = new Headers(init?.headers);
	headers.set("authorization", `Bearer ${token}`);
	const res = await fetch(`${BACKEND_URL}${path}`, {
		...init,
		headers,
		cache: "no-store",
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`backend ${res.status}: ${body}`);
	}
	return res;
}

// Note: extraction goes through `/api/planificacion/extract` (route handler),
// not a server action — server actions cap bodies at 1MB and PDFs are larger.

export async function getPlanificacionAction(id: number): Promise<Plan> {
	const res = await authedFetch(`/planificacion/${id}`);
	return (await res.json()) as Plan;
}

export async function listPlanificacionesAction(): Promise<PlanSummary[]> {
	const res = await authedFetch("/planificacion");
	return (await res.json()) as PlanSummary[];
}

export type CourseSummary = {
	id: number;
	name: string;
	class_days: string[];
	block_number: number;
	plan_anual_id: number | null;
};

export async function listCoursesAction(): Promise<CourseSummary[]> {
	const res = await authedFetch("/courses");
	return (await res.json()) as CourseSummary[];
}

export async function setCoursePlanAction(
	courseId: number,
	planAnualId: number | null,
): Promise<CourseSummary> {
	const res = await authedFetch(`/courses/${courseId}/plan`, {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ plan_anual_id: planAnualId }),
	});
	const course = (await res.json()) as CourseSummary;
	revalidatePath("/planificacion");
	if (planAnualId !== null) revalidatePath(`/planificacion/${planAnualId}`);
	return course;
}
