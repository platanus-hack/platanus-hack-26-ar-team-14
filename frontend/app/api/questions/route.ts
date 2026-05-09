import { getToken } from "@/app/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: Request) {
	const token = await getToken();
	if (!token) return new Response("unauthorized", { status: 401 });

	const url = new URL(req.url);
	const upstream = await fetch(
		`${BACKEND_URL}/questions?${url.searchParams.toString()}`,
		{
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		},
	);
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/json",
		},
	});
}

export async function DELETE() {
	const token = await getToken();
	if (!token) return new Response("unauthorized", { status: 401 });

	const upstream = await fetch(`${BACKEND_URL}/questions`, {
		method: "DELETE",
		headers: { authorization: `Bearer ${token}` },
	});
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/json",
		},
	});
}
