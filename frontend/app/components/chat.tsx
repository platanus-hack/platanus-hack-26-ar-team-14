"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	EmptyState,
	ErrorNote,
	MessageBlock,
	NotebookForm,
	ThinkingDots,
	ToolLine,
} from "./notebook";

const markdownComponents: Components = {
	p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
	ul: ({ children }) => (
		<ul className="my-2 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="my-2 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>
	),
	li: ({ children }) => <li className="my-0.5">{children}</li>,
	h1: ({ children }) => (
		<h1 className="font-display mt-4 mb-2 text-[28px] leading-tight first:mt-0">
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2 className="font-display mt-4 mb-2 text-[22px] leading-tight first:mt-0">
			{children}
		</h2>
	),
	h3: ({ children }) => (
		<h3 className="font-display mt-3 mb-1 text-[20px] leading-tight first:mt-0">
			{children}
		</h3>
	),
	strong: ({ children }) => (
		<strong className="font-semibold text-ink">{children}</strong>
	),
	em: ({ children }) => <em className="italic">{children}</em>,
	a: ({ href, children }) => (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="text-vermilion underline underline-offset-2"
		>
			{children}
		</a>
	),
	code: ({ children }) => (
		<code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.9em]">
			{children}
		</code>
	),
	pre: ({ children }) => (
		<pre className="my-2 overflow-x-auto rounded bg-ink/5 p-3 font-mono text-[14px]">
			{children}
		</pre>
	),
	blockquote: ({ children }) => (
		<blockquote className="my-2 border-l-2 border-rule/60 pl-3 italic text-ink-soft">
			{children}
		</blockquote>
	),
	hr: () => <hr className="my-3 border-rule/40" />,
	table: ({ children }) => (
		<div className="my-2 overflow-x-auto">
			<table className="w-full border-collapse text-[16px]">{children}</table>
		</div>
	),
	th: ({ children }) => (
		<th className="border-b border-rule/60 px-2 py-1 text-left font-semibold">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="border-b border-rule/30 px-2 py-1">{children}</td>
	),
};

function Markdown({ text }: { text: string }) {
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
			{text}
		</ReactMarkdown>
	);
}

function AssistantText({ text }: { text: string }) {
	const blocks: ReactNode[] = [];
	const buffer: string[] = [];
	let key = 0;

	const flush = () => {
		if (buffer.length === 0) return;
		const md = buffer.join("\n").trim();
		buffer.length = 0;
		if (md) blocks.push(<Markdown key={key++} text={md} />);
	};

	let lastTool: { text: string; count: number; index: number } | null = null;
	for (const line of text.split("\n")) {
		if (line.startsWith("✓")) {
			flush();
			lastTool = null;
			continue;
		}
		if (line.startsWith("⏳")) {
			flush();
			const toolText = line.replace(/^⏳\s*/, "");
			if (lastTool && lastTool.text === toolText) {
				lastTool.count += 1;
				blocks[lastTool.index] = (
					<ToolLine key={key++} count={lastTool.count}>
						{toolText}
					</ToolLine>
				);
			} else {
				lastTool = { text: toolText, count: 1, index: blocks.length };
				blocks.push(<ToolLine key={key++}>{toolText}</ToolLine>);
			}
		} else {
			buffer.push(line);
			lastTool = null;
		}
	}
	flush();

	return <div className="flex flex-col gap-1">{blocks}</div>;
}

export function Chat() {
	const [input, setInput] = useState("");
	const { messages, sendMessage, status, error } = useChat({
		transport: new TextStreamChatTransport({ api: "/api/chat" }),
	});

	const busy = status === "submitted" || status === "streaming";

	const scrollRef = useRef<HTMLElement | null>(null);

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	});

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const text = input.trim();
		if (!text || busy) return;
		sendMessage({ text });
		setInput("");
	}

	return (
		<div className="paper-card mr-2 mb-2 flex min-h-0 flex-1 flex-col gap-5 px-6 py-6 sm:px-7">
			<section
				ref={scrollRef}
				className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1"
			>
				{messages.length === 0 ? (
					<EmptyState>¿Qué OA estás trabajando hoy?</EmptyState>
				) : null}

				{messages.map((m) => (
					<MessageBlock
						key={m.id}
						speaker={m.role === "user" ? "teacher" : "assistant"}
					>
						{m.parts.map((p) =>
							p.type === "text" ? (
								<AssistantText key={`${m.id}-${p.text}`} text={p.text} />
							) : null,
						)}
					</MessageBlock>
				))}

				{busy ? (
					<MessageBlock speaker="assistant">
						<ThinkingDots />
					</MessageBlock>
				) : null}

				{error ? <ErrorNote>{error.message}</ErrorNote> : null}
			</section>

			<div className="border-t border-rule/40 pt-4">
				<NotebookForm
					value={input}
					onChange={setInput}
					onSubmit={onSubmit}
					disabled={busy}
				/>
			</div>
		</div>
	);
}
