import { getToken } from "@/app/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
	_req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const token = await getToken();
	if (!token) return new Response("unauthorized", { status: 401 });
	const { id } = await ctx.params;

	const upstream = await fetch(`${BACKEND_URL}/questions/${id}/image`, {
		headers: { authorization: `Bearer ${token}` },
		cache: "no-store",
	});
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type": upstream.headers.get("content-type") ?? "image/png",
			"cache-control": "public, max-age=3600",
		},
	});
}
