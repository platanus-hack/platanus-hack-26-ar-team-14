import type { UIMessage } from "ai";
import { getToken } from "../../lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

type IncomingMessage =
	| UIMessage
	| { role: "user" | "assistant" | "system"; content: string };

type ChatBody = { messages: IncomingMessage[] };

function messageText(m: IncomingMessage): string {
	if ("content" in m && typeof m.content === "string") return m.content;
	if ("parts" in m && Array.isArray(m.parts)) {
		return m.parts
			.filter((p): p is { type: "text"; text: string } => p.type === "text")
			.map((p) => p.text)
			.join("");
	}
	return "";
}

export async function POST(req: Request) {
	const token = await getToken();
	if (!token) return new Response("unauthorized", { status: 401 });

	const { messages } = (await req.json()) as ChatBody;

	const upstream = await fetch(`${BACKEND_URL}/chat/stream`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			messages: messages.map((m) => ({
				role: m.role,
				content: messageText(m),
			})),
		}),
	});

	if (!upstream.ok || !upstream.body) {
		return new Response(
			`backend ${upstream.status}: ${await upstream.text()}`,
			{
				status: 502,
			},
		);
	}

	return new Response(upstream.body, {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}
