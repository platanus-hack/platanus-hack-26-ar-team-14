"use server";

import { revalidatePath } from "next/cache";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function resetDemoAction(): Promise<{ ok: true } | { error: string }> {
	const res = await fetch(`${BACKEND_URL}/reset`, {
		method: "POST",
		cache: "no-store",
	});
	if (!res.ok) {
		const body = await res.text();
		return { error: `backend ${res.status}: ${body}` };
	}
	revalidatePath("/", "layout");
	return { ok: true };
}
