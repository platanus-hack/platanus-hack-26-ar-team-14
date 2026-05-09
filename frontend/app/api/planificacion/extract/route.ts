import { getToken } from "@/app/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Server actions are capped at 1MB by default; PDFs blow past that easily.
// Use a real HTTP route so the multipart upload streams to the backend.
export async function POST(req: Request) {
	const token = await getToken();
	if (!token) return new Response("unauthorized", { status: 401 });

	const form = await req.formData();
	const upstream = await fetch(`${BACKEND_URL}/planificacion/extract`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}` },
		body: form,
	});
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/json",
		},
	});
}
