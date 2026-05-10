"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "../lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

async function authedFetch(path: string, init?: RequestInit) {
	const token = await getToken();
	if (!token) throw new Error("Sesión expirada");
	const headers = new Headers(init?.headers);
	headers.set("authorization", `Bearer ${token}`);
	if (init?.body && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
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

export type LearningRecord = {
	id: number;
	course_id: number;
	course_name: string;
	class_date: string;
	block_number: number;
	registered: boolean;
	oa_numbers: string[] | null;
	observations: string | null;
};

export async function listPendingRecordsAction(): Promise<LearningRecord[]> {
	const res = await authedFetch("/libro-de-clases/pending");
	return (await res.json()) as LearningRecord[];
}

export async function getRecordAction(id: number): Promise<LearningRecord> {
	const res = await authedFetch(`/libro-de-clases/${id}`);
	return (await res.json()) as LearningRecord;
}

export async function registerRecordAction(
	id: number,
	input: { oa_numbers: string[]; observations: string | null },
): Promise<LearningRecord> {
	const res = await authedFetch(`/libro-de-clases/${id}`, {
		method: "PUT",
		body: JSON.stringify(input),
	});
	const record = (await res.json()) as LearningRecord;
	revalidatePath("/");
	revalidatePath(`/libro-de-clases/${id}`);
	return record;
}
