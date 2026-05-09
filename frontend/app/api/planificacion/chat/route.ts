import { getToken } from "@/app/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

type TextPart = { type: "text"; text: string };
type DocPart = {
	type: "document";
	source: { type: "base64"; media_type: string; data: string };
};
type ContentPart = TextPart | DocPart;
type ChatMessage = { role: "user" | "assistant"; content: string | ContentPart[] };

type Body = {
	messages: ChatMessage[];
	pdf?: { name?: string; mediaType?: string; data: string } | null;
};

export async function POST(req: Request) {
	const token = await getToken();
	if (!token) return new Response("unauthorized", { status: 401 });

	const { messages, pdf } = (await req.json()) as Body;

	const outgoing: ChatMessage[] = messages.map((m, i) => {
		if (i === 0 && m.role === "user" && pdf?.data) {
			const text = typeof m.content === "string"
				? m.content
				: m.content
						.filter((p): p is TextPart => p.type === "text")
						.map((p) => p.text)
						.join("");
			const parts: ContentPart[] = [
				{ type: "text", text },
				{
					type: "document",
					source: {
						type: "base64",
						media_type: pdf.mediaType ?? "application/pdf",
						data: pdf.data,
					},
				},
			];
			return { role: "user", content: parts };
		}
		return m;
	});

	const upstream = await fetch(`${BACKEND_URL}/chat/stream`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ messages: outgoing }),
	});

	if (!upstream.ok || !upstream.body) {
		return new Response(
			`backend ${upstream.status}: ${await upstream.text()}`,
			{ status: 502 },
		);
	}

	return new Response(upstream.body, {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}
