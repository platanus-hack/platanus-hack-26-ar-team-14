"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-6 font-sans">
      <h1 className="text-xl font-semibold">Asistente curricular — 5° básico</h1>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Pregúntame sobre OA, unidades o actividades del Programa.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {m.role === "user" ? "Tú" : "Asistente"}
            </span>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {m.parts.map((p, i) =>
                p.type === "text" ? <span key={i}>{p.text}</span> : null,
              )}
            </div>
          </div>
        ))}
        {busy && (
          <span className="text-xs text-zinc-400">El asistente está pensando…</span>
        )}
        {error && (
          <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
            {error.message}
          </pre>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
