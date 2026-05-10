"use client";

import { Loader2, Mic, SendHorizontal, Square } from "lucide-react";
import {
	type CSSProperties,
	type DragEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { transcribeAudioAction } from "../actions/transcribe";

export type BitacoraChatMessage = {
	id: string;
	role: "assistant" | "teacher";
	text: string;
	transportText?: string;
	attachments?: { name: string }[];
	hidden?: boolean;
};

export type BitacoraPendingAttachment = {
	id: string;
	file: File;
};

const FILE_ACCEPT_DEFAULT =
	".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown,.csv,.xlsx,.xls";
const COMPOSER_MIN_HEIGHT = 44;
const COMPOSER_MAX_HEIGHT = 138;

const markdownComponents: Components = {
	p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
	ul: ({ children }) => (
		<ul className="my-2 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="my-2 list-decimal pl-5 first:mt-0 last:mb-0">{children}</ol>
	),
	li: ({ children }) => <li className="my-0.5">{children}</li>,
	strong: ({ children }) => (
		<strong className="font-semibold text-slate-950">{children}</strong>
	),
	em: ({ children }) => <em className="italic">{children}</em>,
	a: ({ href, children }) => {
		const target = typeof href === "string" ? href : "#";
		const internal = target.startsWith("/");
		return (
			<a
				href={target}
				{...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
				className="inline-flex items-center gap-1 rounded-md bg-[#9a5a00] px-2 py-0.5 font-medium text-white no-underline transition-colors hover:bg-[#7a4600]"
			>
				{children}
			</a>
		);
	},
	code: ({ children }) => (
		<code className="rounded bg-[#f4efe6] px-1 py-0.5 font-mono text-[0.9em] text-[#6a4936]">
			{children}
		</code>
	),
};

function renderAssistantBlocks(text: string) {
	const blocks: {
		key: string;
		kind: "tool" | "md";
		text: string;
		count?: number;
	}[] = [];
	const buffer: string[] = [];
	const blockCounts = new Map<string, number>();
	const makeKey = (kind: "tool" | "md", value: string) => {
		const base = `${kind}:${value}`;
		const count = (blockCounts.get(base) ?? 0) + 1;
		blockCounts.set(base, count);
		return `${base}:${count}`;
	};
	const flush = () => {
		const md = buffer.join("\n").trim();
		buffer.length = 0;
		if (md) blocks.push({ key: makeKey("md", md), kind: "md", text: md });
	};

	for (const line of text.split("\n")) {
		if (line.startsWith("✓")) {
			flush();
			continue;
		}
		if (line.startsWith("⏳")) {
			flush();
			const toolText = line.replace(/^⏳\s*/, "");
			const last = blocks[blocks.length - 1];
			if (last?.kind === "tool" && last.text === toolText) {
				last.count = (last.count ?? 1) + 1;
			} else {
				blocks.push({
					key: makeKey("tool", toolText),
					kind: "tool",
					text: toolText,
					count: 1,
				});
			}
			continue;
		}
		buffer.push(line);
	}
	flush();
	return blocks;
}

function AssistantBody({ text }: { text: string }) {
	const blocks = useMemo(() => renderAssistantBlocks(text), [text]);
	return (
		<div className="flex flex-col gap-2">
			{blocks.map((block) =>
				block.kind === "tool" ? (
					<p
						key={block.key}
						className="inline-flex w-fit items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[11px] font-medium text-slate-300"
					>
						<span>{block.text}</span>
						{(block.count ?? 1) > 1 ? (
							<span className="rounded-full bg-white/10 px-1.5 text-[10px] text-slate-200">
								×{block.count}
							</span>
						) : null}
					</p>
				) : (
					<ReactMarkdown
						key={block.key}
						remarkPlugins={[remarkGfm]}
						components={markdownComponents}
					>
						{block.text}
					</ReactMarkdown>
				),
			)}
		</div>
	);
}

function pickAudioMimeType(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	const candidates = [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/ogg;codecs=opus",
		"audio/mp4",
	];
	for (const t of candidates) {
		if (MediaRecorder.isTypeSupported(t)) return t;
	}
	return undefined;
}

function isFileDrag(event: DragEvent<HTMLElement>) {
	return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export type BitacoraChatPanelProps = {
	title: string;
	subtitle?: ReactNode;
	messages: BitacoraChatMessage[];
	busy: boolean;
	error: string | null;
	input: string;
	onInputChange: (value: string) => void;
	onSubmit: () => void;
	placeholder?: string;
	pendingFiles?: BitacoraPendingAttachment[];
	onAddFiles?: (files: File[]) => void;
	onRemovePendingFile?: (id: string) => void;
	acceptFiles?: string;
	className?: string;
	teacherName?: string;
	assistantName?: string;
};

export function BitacoraChatPanel({
	title,
	subtitle,
	messages,
	busy,
	error,
	input,
	onInputChange,
	onSubmit,
	placeholder = "Mensaje…",
	pendingFiles,
	onAddFiles,
	onRemovePendingFile,
	acceptFiles = FILE_ACCEPT_DEFAULT,
	className,
	teacherName,
	assistantName = "Brunito",
}: BitacoraChatPanelProps) {
	const supportsFiles = Boolean(onAddFiles);
	const visibleMessages = useMemo(
		() =>
			messages.filter(
				(m) =>
					!m.hidden &&
					!(m.role === "assistant" && m.text.length === 0),
			),
		[messages],
	);
	const [isDraggingFiles, setIsDraggingFiles] = useState(false);
	const [composerHeight, setComposerHeight] = useState(COMPOSER_MIN_HEIGHT);
	const [recording, setRecording] = useState(false);
	const [transcribing, setTranscribing] = useState(false);
	const [micError, setMicError] = useState<string | null>(null);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const dragDepthRef = useRef(0);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	});

	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "0px";
		const nextHeight = Math.min(
			COMPOSER_MAX_HEIGHT,
			Math.max(COMPOSER_MIN_HEIGHT, el.scrollHeight),
		);
		el.style.height = `${nextHeight}px`;
		el.style.overflowY =
			el.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
		setComposerHeight(nextHeight);
	});

	useEffect(() => {
		return () => {
			const rec = recorderRef.current;
			if (rec && rec.state === "recording") rec.stop();
			streamRef.current?.getTracks().forEach((t) => {
				t.stop();
			});
		};
	}, []);

	async function startRecording() {
		setMicError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mimeType = pickAudioMimeType();
			const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			chunksRef.current = [];
			rec.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			rec.onstop = async () => {
				stream.getTracks().forEach((t) => {
					t.stop();
				});
				streamRef.current = null;
				const type = rec.mimeType || "audio/webm";
				const blob = new Blob(chunksRef.current, { type });
				chunksRef.current = [];
				if (blob.size === 0) return;
				setTranscribing(true);
				try {
					const ext = type.includes("mp4")
						? "m4a"
						: type.includes("ogg")
							? "ogg"
							: "webm";
					const file = new File([blob], `nota.${ext}`, { type });
					const fd = new FormData();
					fd.append("file", file);
					const text = await transcribeAudioAction(fd);
					if (text) {
						onInputChange(input ? `${input} ${text}` : text);
					}
				} catch (e) {
					setMicError(
						e instanceof Error ? e.message : "Error transcribiendo",
					);
				} finally {
					setTranscribing(false);
				}
			};
			rec.start();
			recorderRef.current = rec;
			setRecording(true);
		} catch (e) {
			setMicError(
				e instanceof Error ? e.message : "No se pudo acceder al micrófono",
			);
		}
	}

	function stopRecording() {
		const rec = recorderRef.current;
		if (rec && rec.state === "recording") rec.stop();
		setRecording(false);
	}

	function handleFiles(fileList: FileList | File[]) {
		if (!onAddFiles) return;
		onAddFiles(Array.from(fileList));
	}

	function handleDragEnter(event: DragEvent<HTMLElement>) {
		if (!supportsFiles || !isFileDrag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current += 1;
		setIsDraggingFiles(true);
	}

	function handleDragOver(event: DragEvent<HTMLElement>) {
		if (!supportsFiles || !isFileDrag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "copy";
		setIsDraggingFiles(true);
	}

	function handleDragLeave(event: DragEvent<HTMLElement>) {
		if (!supportsFiles || !isFileDrag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) {
			setIsDraggingFiles(false);
		}
	}

	function handleDrop(event: DragEvent<HTMLElement>) {
		if (!supportsFiles || !isFileDrag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = 0;
		setIsDraggingFiles(false);
		if (event.dataTransfer.files.length > 0) {
			handleFiles(event.dataTransfer.files);
		}
	}

	const showSendButton =
		input.length > 0 || (pendingFiles && pendingFiles.length > 0);
	const canSendNow = !busy && !transcribing;
	const composerStyle: CSSProperties & {
		"--bitacora-composer-height"?: string;
	} = {
		"--bitacora-composer-height": `${composerHeight}px`,
	};

	return (
		<aside
			className={`bitacora-chat-panel ${className ?? ""} ${isDraggingFiles ? "bitacora-chat-panel-drag" : ""}`}
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="border-b border-slate-200/80 px-5 py-5">
				<h2 className="bitacora-chat-title">{title}</h2>
				{subtitle ? (
					<div className="mt-1 text-sm text-slate-600">{subtitle}</div>
				) : null}
			</div>

			<div
				ref={scrollRef}
				className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
			>
				{visibleMessages.map((message) => (
					<article
						key={message.id}
						className={
							message.role === "assistant"
								? "bitacora-message-agent"
								: "bitacora-message-teacher"
						}
					>
						<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
							{message.role === "assistant"
								? assistantName
								: (teacherName ?? "Profesor")}
						</p>
						{message.attachments?.length ? (
							<div className="mb-3 flex flex-wrap gap-2">
								{message.attachments.map((attachment) => (
									<span
										key={attachment.name}
										className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500"
									>
										{attachment.name}
									</span>
								))}
							</div>
						) : null}
						{message.role === "assistant" ? (
							<AssistantBody text={message.text} />
						) : (
							<p className="whitespace-pre-wrap text-sm leading-6 text-[#7a3125]">
								{message.text}
							</p>
						)}
					</article>
				))}

				{busy ? (
					<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
						Pensando…
					</div>
				) : null}

				{error ? (
					<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-[12px] text-red-700">
						{error}
					</pre>
				) : null}

				{micError ? (
					<p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
						{micError}
					</p>
				) : null}
			</div>

			<div className="border-t border-slate-200/80 px-5 py-4">
				<fieldset
					className={`bitacora-chat-composer ${isDraggingFiles ? "bitacora-chat-composer-drag" : ""}`}
					aria-label="Editor del chat"
				>
					{supportsFiles ? (
						<input
							ref={fileInputRef}
							type="file"
							accept={acceptFiles}
							multiple
							className="hidden"
							onChange={(event) => {
								if (event.target.files?.length) {
									handleFiles(event.target.files);
									event.target.value = "";
								}
							}}
						/>
					) : null}

					{pendingFiles && pendingFiles.length > 0 ? (
						<div className="mb-3 flex flex-wrap gap-2">
							{pendingFiles.map((file) => (
								<span key={file.id} className="bitacora-file-pill">
									{file.file.name}
									<button
										type="button"
										onClick={() => onRemovePendingFile?.(file.id)}
										aria-label={`Quitar ${file.file.name}`}
									>
										×
									</button>
								</span>
							))}
						</div>
					) : null}

					<div className="bitacora-chat-composer-row" style={composerStyle}>
						<textarea
							ref={textareaRef}
							value={input}
							onChange={(event) => onInputChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									if (canSendNow) onSubmit();
								}
							}}
							rows={1}
							placeholder={placeholder}
							className="bitacora-chat-input bitacora-chat-textarea"
						/>
						{supportsFiles ? (
							<div className="bitacora-chat-controls-left">
								<button
									type="button"
									className="bitacora-attach-button"
									onClick={() => fileInputRef.current?.click()}
									aria-label="Adjuntar archivo"
								>
									＋
								</button>
							</div>
						) : null}
						{showSendButton ? (
							<button
								type="button"
								className="bitacora-send-button"
								onClick={() => {
									if (canSendNow) onSubmit();
								}}
								disabled={!canSendNow}
								aria-label="Enviar mensaje"
							>
								<SendHorizontal size={15} strokeWidth={2.2} />
							</button>
						) : (
							<button
								type="button"
								className="bitacora-send-button bitacora-send-button-mic"
								onClick={recording ? stopRecording : startRecording}
								disabled={transcribing}
								aria-label={
									transcribing
										? "Transcribiendo"
										: recording
											? "Detener y transcribir"
											: "Grabar nota de voz"
								}
								title={
									transcribing
										? "Transcribiendo…"
										: recording
											? "Detener y transcribir"
											: "Grabar nota de voz"
								}
							>
								{transcribing ? (
									<Loader2 size={16} strokeWidth={2.2} className="animate-spin" />
								) : recording ? (
									<Square size={14} strokeWidth={2.2} className="fill-current" />
								) : (
									<Mic size={16} strokeWidth={2.2} />
								)}
							</button>
						)}
					</div>
				</fieldset>
			</div>
		</aside>
	);
}
