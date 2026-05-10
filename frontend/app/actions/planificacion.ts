"use server";

import { getToken } from "../lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export type PlanItem = {
	id: number;
	ordinal: number;
	mes: string | null;
	unidad: string | null;
	oa_codes: string[];
	objetivo: string;
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
