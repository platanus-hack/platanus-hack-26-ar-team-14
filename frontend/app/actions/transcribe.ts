"use server";

import { getToken } from "../lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function transcribeAudioAction(formData: FormData): Promise<string> {
	const token = await getToken();
	if (!token) throw new Error("Sesión expirada");

	const file = formData.get("file");
	if (!(file instanceof File)) throw new Error("Audio faltante");

	const upstream = new FormData();
	upstream.append("file", file, file.name || "audio.webm");

	const res = await fetch(`${BACKEND_URL}/transcribe`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}` },
		body: upstream,
		cache: "no-store",
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`backend ${res.status}: ${body}`);
	}
	const { text } = (await res.json()) as { text: string };
	return text;
}
