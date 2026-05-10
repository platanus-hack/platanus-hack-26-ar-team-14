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

export type GuiaSummary = {
	id: number;
	name: string;
	question_count: number;
	oa_codes: string[];
};

export type Alternative = { label: string; text: string };

export type Question = {
	id: number;
	kind: string;
	prompt: string;
	alternatives: Alternative[];
	correct_alternative: string | null;
	answer: string | null;
	asignatura: string | null;
	nivel: string | null;
	oa_code: string | null;
	habilidad: string | null;
	contenido: string | null;
	source_file: string | null;
	has_image: boolean;
	image_url: string | null;
	image_width: number | null;
	image_height: number | null;
};

export type GeneratedQuestion = {
	id: number | null;
	kind: string;
	prompt: string;
	alternatives: Alternative[];
	correct_alternative: string | null;
	answer: string | null;
	oa_code: string | null;
	habilidad: string | null;
	contenido: string | null;
	source_note: string | null;
};

export type GuiaQuestionItem =
	| {
			type: "bank";
			ordinal: number;
			bank_question: Question;
			generated_question: null;
	  }
	| {
			type: "generated";
			ordinal: number;
			bank_question: null;
			generated_question: GeneratedQuestion;
	  };

export type GuiaDetail = {
	id: number;
	name: string;
	items: GuiaQuestionItem[];
};

export type GuiaQuestionInputItem =
	| { type: "bank"; question_id: number }
	| {
			type: "generated";
			generated: {
				kind: string;
				prompt: string;
				alternatives: Alternative[];
				correct_alternative: string | null;
				answer: string | null;
				oa_code: string | null;
				habilidad: string | null;
				contenido: string | null;
				source_note: string | null;
			};
	  };

export async function listGuiasAction(): Promise<GuiaSummary[]> {
	const res = await authedFetch("/guias");
	return (await res.json()) as GuiaSummary[];
}

export async function listBankQuestionsAction(): Promise<Question[]> {
	const res = await authedFetch("/questions");
	return (await res.json()) as Question[];
}

export async function createGuiaAction(input: {
	name: string;
	items: GuiaQuestionInputItem[];
}): Promise<GuiaDetail> {
	const res = await authedFetch("/guias", {
		method: "POST",
		body: JSON.stringify(input),
	});
	const detail = (await res.json()) as GuiaDetail;
	revalidatePath("/guias");
	return detail;
}

export async function getGuiaAction(id: number): Promise<GuiaDetail> {
	const res = await authedFetch(`/guias/${id}`);
	return (await res.json()) as GuiaDetail;
}

export async function updateGuiaAction(
	id: number,
	input: { name: string; items: GuiaQuestionInputItem[] },
): Promise<GuiaDetail> {
	const res = await authedFetch(`/guias/${id}`, {
		method: "PUT",
		body: JSON.stringify(input),
	});
	const detail = (await res.json()) as GuiaDetail;
	revalidatePath("/guias");
	revalidatePath(`/guias/editor/${id}`);
	return detail;
}

export async function deleteGuiaAction(id: number): Promise<void> {
	await authedFetch(`/guias/${id}`, { method: "DELETE" });
	revalidatePath("/guias");
}
