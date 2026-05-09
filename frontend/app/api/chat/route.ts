import type { UIMessage } from "ai";
import { getToken } from "../../lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

type ChatBody = { messages: UIMessage[] };

function extractText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
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
        content: extractText(m),
      })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`backend ${upstream.status}: ${await upstream.text()}`, {
      status: 502,
    });
  }

  return new Response(upstream.body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
